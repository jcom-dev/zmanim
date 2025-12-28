// File: publisher_audit.go
// Purpose: Publisher-facing audit log API endpoints
// Pattern: 6-step-handler
// Dependencies: PublisherResolver, actions.sql queries
// Compliance: PublisherResolver:yes, SQLc:yes, slog:yes

package handlers

import (
	"encoding/base64"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// =============================================================================
// Response Types for Publisher Audit API
// =============================================================================

// AuditActor represents the actor who performed an action
type AuditActor struct {
	UserID    string `json:"user_id,omitempty"`
	ClerkID   string `json:"clerk_id,omitempty"`
	Name      string `json:"name,omitempty"`
	Email     string `json:"email,omitempty"`
	IPAddress string `json:"ip_address,omitempty"`
	IsSystem  bool   `json:"is_system"`
}

// AuditResource represents the affected resource
type AuditResource struct {
	Type string `json:"type,omitempty"`
	ID   string `json:"id,omitempty"`
	Name string `json:"name,omitempty"`
}

// PublisherAuditLogEntry represents a single audit log entry for publishers
//
//	@Description	Publisher audit log entry details
type PublisherAuditLogEntry struct {
	// Unique identifier (UUID)
	ID string `json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`
	// Event type in format category.action
	EventType string `json:"event_type" example:"publisher.update"`
	// Event category
	EventCategory string `json:"event_category" example:"publisher"`
	// Event action
	EventAction string `json:"event_action" example:"update"`
	// When the event occurred
	OccurredAt time.Time `json:"occurred_at"`
	// Actor who performed the action
	Actor AuditActor `json:"actor"`
	// Resource affected
	Resource AuditResource `json:"resource"`
	// Event status (success, failure, error, completed, pending)
	Status string `json:"status" example:"completed"`
	// Error message if failed
	ErrorMessage string `json:"error_message,omitempty"`
	// Duration in milliseconds
	DurationMs *int32 `json:"duration_ms,omitempty" example:"125"`
	// Changes (before/after) - matches frontend AuditChanges interface
	Changes *AuditChanges `json:"changes,omitempty"`
	// Operation type (CREATE, UPDATE, DELETE, etc.)
	OperationType string `json:"operation_type" example:"CREATE"`
	// Request ID for correlation
	RequestID string `json:"request_id,omitempty"`
	// Additional metadata
	Metadata json.RawMessage `json:"metadata,omitempty"`
}

// PublisherAuditLogsPage represents a paginated list of audit logs for publishers
//
//	@Description	Paginated publisher audit log response
type PublisherAuditLogsPage struct {
	// List of audit log entries
	Data []PublisherAuditLogEntry `json:"data"`
	// Cursor for next page (empty if no more pages)
	NextCursor string `json:"next_cursor,omitempty"`
	// Whether there are more results
	HasMore bool `json:"has_more"`
	// Total count (if available)
	Total int64 `json:"total,omitempty"`
}

// PublisherAuditFilters represents query filter parameters for publisher audit logs
type PublisherAuditFilters struct {
	ResourceType *string    `json:"resource_type,omitempty"`
	ResourceID   *string    `json:"resource_id,omitempty"`
	EventAction  *string    `json:"event_action,omitempty"`
	From         *time.Time `json:"from,omitempty"`
	To           *time.Time `json:"to,omitempty"`
	PublisherID  *int32     `json:"publisher_id,omitempty"`
}

// PublisherAuditExportRequest represents an export request body for publisher audit logs
//
//	@Description	Request body for publisher audit log export
type PublisherAuditExportRequest struct {
	// Export format: "csv" or "json"
	Format string `json:"format" example:"csv"`
	// Filter criteria
	Filters *PublisherAuditFilters `json:"filters,omitempty"`
}

// =============================================================================
// Handler Methods
// =============================================================================

// GetPublisherAuditLogs returns paginated audit logs for the authenticated publisher
//
//	@Summary		List publisher audit logs
//	@Description	Returns paginated audit log entries for the authenticated publisher's activities
//	@Tags			Publisher Audit Logs
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string						true	"Publisher ID"
//	@Param			resource_type	query		string						false	"Filter by resource type"
//	@Param			resource_id		query		string						false	"Filter by resource ID"
//	@Param			event_action	query		string						false	"Filter by action (create, update, delete)"
//	@Param			from			query		string						false	"Start date (RFC3339)"
//	@Param			to				query		string						false	"End date (RFC3339)"
//	@Param			cursor			query		string						false	"Pagination cursor"
//	@Param			limit			query		int							false	"Page size (max 100)"
//	@Success		200				{object}	APIResponse{data=PublisherAuditLogsPage}	"Audit logs"
//	@Failure		400				{object}	APIResponse{error=APIError}	"Invalid request"
//	@Failure		401				{object}	APIResponse{error=APIError}	"Unauthorized"
//	@Failure		403				{object}	APIResponse{error=APIError}	"Forbidden"
//	@Router			/publisher/audit-logs [get]
func (h *Handlers) GetPublisherAuditLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context (SECURITY: validates against JWT)
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. Parse query parameters
	filters := parsePublisherAuditFilters(r)

	// Restrict to own publisher (SECURITY CRITICAL)
	publisherIDInt, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}
	filters.PublisherID = &publisherIDInt

	cursor := r.URL.Query().Get("cursor")
	limit := parseIntOrDefault(r.URL.Query().Get("limit"), 50)

	// 3. Validate
	if limit < 1 || limit > 100 {
		RespondValidationError(w, r, "Limit must be between 1 and 100", nil)
		return
	}

	// 4. Decode cursor if present
	var cursorTimestamp *time.Time
	var cursorID *string
	if cursor != "" {
		ts, id, cursorErr := decodePubAuditCursor(cursor)
		if cursorErr != nil {
			RespondBadRequest(w, r, "Invalid cursor")
			return
		}
		cursorTimestamp = &ts
		cursorID = &id
	}

	// 5. Query audit events using GetAuditLogs
	// Convert filter times to pgtype.Timestamptz
	var fromDate pgtype.Timestamptz
	if filters.From != nil {
		fromDate = pgtype.Timestamptz{Time: *filters.From, Valid: true}
	}
	var toDate pgtype.Timestamptz
	if filters.To != nil {
		toDate = pgtype.Timestamptz{Time: *filters.To, Valid: true}
	}

	// Build query params for GetAuditLogs which supports filtering
	var actionTypeFilter *string
	if filters.EventAction != nil {
		actionTypeFilter = filters.EventAction
	}

	rows, err := h.db.Queries.GetAuditLogs(ctx, sqlcgen.GetAuditLogsParams{
		EventAction:       actionTypeFilter,
		PublisherIDFilter: filters.PublisherID,
		FromDate:          fromDate,
		ToDate:            toDate,
		LimitCount:        int32(limit + 1), // Fetch one extra to determine if more pages exist
		OffsetCount:       0,                // We use cursor-based, so offset is 0
	})
	if err != nil {
		slog.Error("failed to get publisher audit logs", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to retrieve audit logs")
		return
	}

	// 6. Filter by cursor if provided (since we can't do cursor in SQL with current query)
	var filteredRows []sqlcgen.GetAuditLogsRow
	for _, row := range rows {
		// Apply cursor filter
		if cursorTimestamp != nil && cursorID != nil {
			if row.StartedAt.Time.After(*cursorTimestamp) ||
				(row.StartedAt.Time.Equal(*cursorTimestamp) && row.ID >= *cursorID) {
				continue
			}
		}
		// Apply resource type filter
		if filters.ResourceType != nil && row.ResourceType != nil && *row.ResourceType != *filters.ResourceType {
			continue
		}
		// Apply resource ID filter
		if filters.ResourceID != nil && row.ResourceID != nil && *row.ResourceID != *filters.ResourceID {
			continue
		}
		filteredRows = append(filteredRows, row)
		if len(filteredRows) > limit {
			break
		}
	}

	// Determine if there are more results
	hasMore := len(filteredRows) > limit
	if hasMore {
		filteredRows = filteredRows[:limit]
	}

	// Build response
	var nextCursor string
	if hasMore && len(filteredRows) > 0 {
		lastRow := filteredRows[len(filteredRows)-1]
		nextCursor = encodePubAuditCursor(lastRow.StartedAt.Time, lastRow.ID)
	}

	// Format events
	events := make([]PublisherAuditLogEntry, 0, len(filteredRows))
	for _, row := range filteredRows {
		events = append(events, formatPublisherAuditLogRow(row))
	}

	// 7. Respond
	response := PublisherAuditLogsPage{
		Data:       events,
		NextCursor: nextCursor,
		HasMore:    hasMore,
	}
	RespondJSON(w, r, http.StatusOK, response)
}

// GetPublisherAuditLog returns a single audit log entry by ID
//
//	@Summary		Get audit log details
//	@Description	Returns detailed information for a specific audit log entry
//	@Tags			Publisher Audit Logs
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string						true	"Publisher ID"
//	@Param			id				path		string						true	"Audit log ID"
//	@Success		200				{object}	APIResponse{data=PublisherAuditLogEntry}	"Audit log details"
//	@Failure		400				{object}	APIResponse{error=APIError}	"Invalid request"
//	@Failure		401				{object}	APIResponse{error=APIError}	"Unauthorized"
//	@Failure		403				{object}	APIResponse{error=APIError}	"Access denied"
//	@Failure		404				{object}	APIResponse{error=APIError}	"Not found"
//	@Router			/publisher/audit-logs/{id} [get]
func (h *Handlers) GetPublisherAuditLog(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. Get event ID from URL
	eventID := chi.URLParam(r, "id")
	if eventID == "" {
		RespondValidationError(w, r, "Event ID is required", nil)
		return
	}

	// 3. Validate it looks like a UUID
	if len(eventID) < 32 {
		RespondBadRequest(w, r, "Invalid event ID format")
		return
	}

	// 4. Fetch events by request ID (since actions table uses request_id for correlation)
	// The ID passed is the UUID of the action, so we'll query and filter
	actions, err := h.db.Queries.GetActionsByRequest(ctx, eventID)
	if err != nil {
		// Try a different approach - query by publisher and match ID
		publisherIDInt, convErr := stringToInt32(pc.PublisherID)
		if convErr != nil {
			RespondInternalError(w, r, "Failed to verify publisher")
			return
		}

		// Fallback to GetPublisherActivities and find the action
		activities, actErr := h.db.Queries.GetPublisherActivities(ctx, sqlcgen.GetPublisherActivitiesParams{
			PublisherID: &publisherIDInt,
			Limit:       1000,
			Offset:      0,
		})
		if actErr != nil {
			RespondNotFound(w, r, "Audit log entry not found")
			return
		}

		// Find the matching action by ID
		var foundActivity *sqlcgen.GetPublisherActivitiesRow
		for i := range activities {
			if activities[i].ID == eventID {
				foundActivity = &activities[i]
				break
			}
		}

		if foundActivity == nil {
			RespondNotFound(w, r, "Audit log entry not found")
			return
		}

		// Format and respond
		event := formatPublisherActivityRow(*foundActivity)
		RespondJSON(w, r, http.StatusOK, event)
		return
	}

	// Find the specific action matching the ID
	var foundAction *sqlcgen.Action
	for i := range actions {
		if actions[i].ID == eventID {
			foundAction = &actions[i]
			break
		}
	}

	if foundAction == nil {
		RespondNotFound(w, r, "Audit log entry not found")
		return
	}

	// 5. Verify event belongs to this publisher (SECURITY)
	publisherIDInt, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondInternalError(w, r, "Failed to verify publisher")
		return
	}

	if foundAction.PublisherID == nil || *foundAction.PublisherID != publisherIDInt {
		RespondForbidden(w, r, "Access denied to this audit log entry")
		return
	}

	// 6. Format and respond
	event := formatPublisherActionRow(*foundAction)
	RespondJSON(w, r, http.StatusOK, event)
}

// ExportPublisherAuditLogs exports audit logs in CSV or JSON format
//
//	@Summary		Export publisher audit logs
//	@Description	Exports audit logs in CSV or JSON format for the authenticated publisher
//	@Tags			Publisher Audit Logs
//	@Accept			json
//	@Produce		application/octet-stream
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string						true	"Publisher ID"
//	@Param			request			body		PublisherAuditExportRequest	true	"Export request"
//	@Success		200				{file}		binary						"Export file"
//	@Failure		400				{object}	APIResponse{error=APIError}	"Invalid request"
//	@Failure		401				{object}	APIResponse{error=APIError}	"Unauthorized"
//	@Failure		403				{object}	APIResponse{error=APIError}	"Forbidden"
//	@Failure		429				{object}	APIResponse{error=APIError}	"Rate limit exceeded"
//	@Router			/publisher/audit-logs/export [post]
func (h *Handlers) ExportPublisherAuditLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. Parse request body
	var req PublisherAuditExportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// 3. Validate format
	if req.Format != "csv" && req.Format != "json" {
		RespondValidationError(w, r, "Format must be 'csv' or 'json'", nil)
		return
	}

	// Validate date range (max 1 year)
	if req.Filters != nil && req.Filters.From != nil && req.Filters.To != nil {
		diff := req.Filters.To.Sub(*req.Filters.From)
		if diff > 365*24*time.Hour {
			RespondValidationError(w, r, "Date range cannot exceed 1 year", nil)
			return
		}
	}

	// 4. Build filters with publisher restriction
	publisherIDInt, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	var fromDate pgtype.Timestamptz
	var toDate pgtype.Timestamptz
	var actionTypeFilter *string

	if req.Filters != nil {
		if req.Filters.From != nil {
			fromDate = pgtype.Timestamptz{Time: *req.Filters.From, Valid: true}
		}
		if req.Filters.To != nil {
			toDate = pgtype.Timestamptz{Time: *req.Filters.To, Valid: true}
		}
		actionTypeFilter = req.Filters.EventAction
	}

	// 5. Query all events (with reasonable limit for export)
	const maxExportRows = 10000
	rows, err := h.db.Queries.GetAuditLogs(ctx, sqlcgen.GetAuditLogsParams{
		EventAction:       actionTypeFilter,
		PublisherIDFilter: &publisherIDInt,
		FromDate:          fromDate,
		ToDate:            toDate,
		LimitCount:        maxExportRows,
		OffsetCount:       0,
	})
	if err != nil {
		slog.Error("failed to export audit logs", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to export audit logs")
		return
	}

	// Apply additional filters
	var filteredRows []sqlcgen.GetAuditLogsRow
	for _, row := range rows {
		if req.Filters != nil && req.Filters.ResourceType != nil && row.ResourceType != nil {
			if *row.ResourceType != *req.Filters.ResourceType {
				continue
			}
		}
		filteredRows = append(filteredRows, row)
	}

	// 6. Stream export based on format
	filename := fmt.Sprintf("audit-logs-%s-%s.%s", pc.PublisherID, time.Now().Format("2006-01-02"), req.Format)

	if req.Format == "csv" {
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

		csvWriter := csv.NewWriter(w)
		defer csvWriter.Flush()

		// Write header
		header := []string{"id", "event_type", "occurred_at", "actor", "resource_type", "resource_id", "status", "error_message"}
		if err := csvWriter.Write(header); err != nil {
			slog.Error("failed to write CSV header", "error", err)
			return
		}

		// Write rows
		for _, row := range filteredRows {
			record := []string{
				row.ID,
				row.EventAction,
				row.StartedAt.Time.Format(time.RFC3339),
				stringFromStringPtr(row.ActorID),
				stringFromStringPtr(row.ResourceType),
				stringFromStringPtr(row.ResourceID),
				stringFromStringPtr(row.Status),
				stringFromStringPtr(row.ErrorMessage), // Now available in GetAuditLogsRow
			}
			if err := csvWriter.Write(record); err != nil {
				slog.Error("failed to write CSV row", "error", err)
				return
			}
		}
	} else {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

		encoder := json.NewEncoder(w)
		events := make([]PublisherAuditLogEntry, 0, len(filteredRows))
		for _, row := range filteredRows {
			events = append(events, formatPublisherAuditLogRow(row))
		}

		if err := encoder.Encode(events); err != nil {
			slog.Error("failed to encode JSON export", "error", err)
			return
		}
	}
}

// =============================================================================
// Helper Functions
// =============================================================================

// parsePublisherAuditFilters extracts filter parameters from the request
func parsePublisherAuditFilters(r *http.Request) PublisherAuditFilters {
	filters := PublisherAuditFilters{}

	if rt := r.URL.Query().Get("resource_type"); rt != "" {
		filters.ResourceType = &rt
	}
	if rid := r.URL.Query().Get("resource_id"); rid != "" {
		filters.ResourceID = &rid
	}
	if ea := r.URL.Query().Get("event_action"); ea != "" {
		filters.EventAction = &ea
	}
	if from := r.URL.Query().Get("from"); from != "" {
		if t, err := time.Parse(time.RFC3339, from); err == nil {
			filters.From = &t
		}
	}
	if to := r.URL.Query().Get("to"); to != "" {
		if t, err := time.Parse(time.RFC3339, to); err == nil {
			filters.To = &t
		}
	}

	return filters
}

// parseIntOrDefault parses an integer string with a default value
func parseIntOrDefault(s string, defaultVal int) int {
	if s == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return v
}

// encodePubAuditCursor encodes a timestamp and ID into a base64 cursor
func encodePubAuditCursor(timestamp time.Time, id string) string {
	raw := fmt.Sprintf("%d_%s", timestamp.UnixMilli(), id)
	return base64.StdEncoding.EncodeToString([]byte(raw))
}

// decodePubAuditCursor decodes a base64 cursor into timestamp and ID
func decodePubAuditCursor(cursor string) (time.Time, string, error) {
	decoded, err := base64.StdEncoding.DecodeString(cursor)
	if err != nil {
		return time.Time{}, "", err
	}

	parts := strings.SplitN(string(decoded), "_", 2)
	if len(parts) != 2 {
		return time.Time{}, "", fmt.Errorf("invalid cursor format")
	}

	timestampMs, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return time.Time{}, "", err
	}

	timestamp := time.UnixMilli(timestampMs)
	return timestamp, parts[1], nil
}

// formatPublisherAuditLogRow converts a database row to an API response
func formatPublisherAuditLogRow(row sqlcgen.GetAuditLogsRow) PublisherAuditLogEntry {
	// Extract actor details from metadata
	actorName := ""
	ipAddress := ""
	if row.Metadata != nil {
		var meta map[string]interface{}
		if err := json.Unmarshal(row.Metadata, &meta); err == nil {
			if name, ok := meta["actor_name"].(string); ok {
				actorName = name
			}
			if ip, ok := meta["ip_address"].(string); ok {
				ipAddress = ip
			}
		}
	}

	// Determine operation type from action
	operationType := getOperationType(row.EventAction)

	// Extract before/after from payload (which contains ActionDiff with old/new)
	var changes *AuditChanges
	if row.Payload != nil {
		var diff struct {
			Old map[string]interface{} `json:"old"`
			New map[string]interface{} `json:"new"`
		}
		if err := json.Unmarshal(row.Payload, &diff); err == nil {
			if diff.Old != nil || diff.New != nil {
				changes = &AuditChanges{
					Before: diff.Old,
					After:  diff.New,
				}
			}
		}
	}

	return PublisherAuditLogEntry{
		ID:            row.ID,
		EventType:     row.EventCategory + "." + row.EventAction,
		EventCategory: row.EventCategory,
		EventAction:   row.EventAction,
		OccurredAt:    row.StartedAt.Time,
		Actor: AuditActor{
			UserID:    stringFromStringPtr(row.ActorID),
			Name:      actorName,
			IPAddress: ipAddress,
			IsSystem:  actorName == "System",
		},
		Resource: AuditResource{
			Type: stringFromStringPtr(row.ResourceType),
			ID:   stringFromStringPtr(row.ResourceID),
		},
		Status:        stringFromStringPtr(row.Status),
		OperationType: operationType,
		Changes:       changes,
		Metadata:      row.Metadata,
	}
}

// formatPublisherActionRow converts Action to API response
func formatPublisherActionRow(row sqlcgen.Action) PublisherAuditLogEntry {
	// Extract actor details from metadata
	actorName := ""
	actorEmail := ""
	ipAddress := ""
	if row.Metadata != nil {
		var meta map[string]interface{}
		if err := json.Unmarshal(row.Metadata, &meta); err == nil {
			if name, ok := meta["actor_name"].(string); ok {
				actorName = name
			}
			if email, ok := meta["actor_email"].(string); ok {
				actorEmail = email
			}
			if ip, ok := meta["ip_address"].(string); ok {
				ipAddress = ip
			}
		}
	}

	var durationMs *int32
	if row.DurationMs != nil {
		durationMs = row.DurationMs
	}

	// Determine operation type from action
	operationType := getOperationType(row.ActionType)

	// Extract before/after from payload (which contains ActionDiff with old/new)
	var changes *AuditChanges
	if row.Payload != nil {
		var diff struct {
			Old map[string]interface{} `json:"old"`
			New map[string]interface{} `json:"new"`
		}
		if err := json.Unmarshal(row.Payload, &diff); err == nil {
			if diff.Old != nil || diff.New != nil {
				changes = &AuditChanges{
					Before: diff.Old,
					After:  diff.New,
				}
			}
		}
	}

	return PublisherAuditLogEntry{
		ID:            row.ID,
		EventType:     row.Concept + "." + row.ActionType,
		EventCategory: row.Concept,
		EventAction:   row.ActionType,
		OccurredAt:    row.StartedAt.Time,
		Actor: AuditActor{
			UserID:    stringFromStringPtr(row.UserID),
			Name:      actorName,
			Email:     actorEmail,
			IPAddress: ipAddress,
			IsSystem:  actorName == "System",
		},
		Resource: AuditResource{
			Type: stringFromStringPtr(row.EntityType),
			ID:   stringFromStringPtr(row.EntityID),
		},
		Status:        stringFromStringPtr(row.Status),
		ErrorMessage:  stringFromStringPtr(row.ErrorMessage),
		DurationMs:    durationMs,
		OperationType: operationType,
		Changes:       changes,
		RequestID:     row.RequestID,
		Metadata:      row.Metadata,
	}
}

// formatPublisherActivityRow converts GetPublisherActivitiesRow to API response
func formatPublisherActivityRow(row sqlcgen.GetPublisherActivitiesRow) PublisherAuditLogEntry {
	// Extract actor details from metadata
	actorName := ""
	actorEmail := ""
	ipAddress := ""
	if row.Metadata != nil {
		var meta map[string]interface{}
		if err := json.Unmarshal(row.Metadata, &meta); err == nil {
			if name, ok := meta["actor_name"].(string); ok {
				actorName = name
			}
			if email, ok := meta["actor_email"].(string); ok {
				actorEmail = email
			}
			if ip, ok := meta["ip_address"].(string); ok {
				ipAddress = ip
			}
		}
	}

	var durationMs *int32
	if row.DurationMs != nil {
		durationMs = row.DurationMs
	}

	// Determine operation type from action
	operationType := getOperationType(row.ActionType)

	// Extract before/after from payload (which contains ActionDiff with old/new)
	var changes *AuditChanges
	if row.Payload != nil {
		var diff struct {
			Old map[string]interface{} `json:"old"`
			New map[string]interface{} `json:"new"`
		}
		if err := json.Unmarshal(row.Payload, &diff); err == nil {
			if diff.Old != nil || diff.New != nil {
				changes = &AuditChanges{
					Before: diff.Old,
					After:  diff.New,
				}
			}
		}
	}

	return PublisherAuditLogEntry{
		ID:            row.ID,
		EventType:     row.Concept + "." + row.ActionType,
		EventCategory: row.Concept,
		EventAction:   row.ActionType,
		OccurredAt:    row.StartedAt.Time,
		Actor: AuditActor{
			UserID:    stringFromStringPtr(row.UserID),
			Name:      actorName,
			Email:     actorEmail,
			IPAddress: ipAddress,
			IsSystem:  actorName == "System",
		},
		Resource: AuditResource{
			Type: stringFromStringPtr(row.EntityType),
			ID:   stringFromStringPtr(row.EntityID),
		},
		Status:        stringFromStringPtr(row.Status),
		ErrorMessage:  stringFromStringPtr(row.ErrorMessage),
		DurationMs:    durationMs,
		OperationType: operationType,
		Changes:       changes,
		RequestID:     row.RequestID,
		Metadata:      row.Metadata,
	}
}

// getOperationType maps action type to operation type
func getOperationType(actionType string) string {
	// Map action types to CRUD operations
	if strings.Contains(actionType, "create") || strings.Contains(actionType, "_add") {
		return "CREATE"
	}
	if strings.Contains(actionType, "update") {
		return "UPDATE"
	}
	if strings.Contains(actionType, "delete") || strings.Contains(actionType, "remove") {
		return "DELETE"
	}
	if strings.Contains(actionType, "publish") {
		return "EXECUTE"
	}
	return "READ"
}
