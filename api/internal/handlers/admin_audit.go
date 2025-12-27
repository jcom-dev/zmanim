// File: admin_audit.go
// Purpose: Admin-only audit log endpoints - view all audit logs, stats, export
// Pattern: 6-step-handler-admin
// Dependencies: Queries: actions.sql | Services: ActivityService
// Frequency: low - admin dashboard only
// Compliance: Check docs/adr/ for pattern rationale

package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// =============================================================================
// Response Types for Admin Audit API
// =============================================================================

// AuditLogResponse represents a single audit log entry
type AuditLogResponse struct {
	ID              string                 `json:"id"`
	ActionType      string                 `json:"action_type"`
	Category        string                 `json:"category"`
	UserID          *string                `json:"user_id,omitempty"`
	PublisherID     *int32                 `json:"publisher_id,omitempty"`
	PublisherName   string                 `json:"publisher_name,omitempty"`
	EntityType      *string                `json:"entity_type,omitempty"`
	EntityID        *string                `json:"entity_id,omitempty"`
	Status          *string                `json:"status,omitempty"`
	ErrorMessage    *string                `json:"error_message,omitempty"`
	StartedAt       time.Time              `json:"started_at"`
	CompletedAt     *time.Time             `json:"completed_at,omitempty"`
	DurationMs      *int32                 `json:"duration_ms,omitempty"`
	Changes         map[string]interface{} `json:"changes,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
	Description     string                 `json:"description"`
	ParentActionID  string                 `json:"parent_action_id,omitempty"`
	RequestID       string                 `json:"request_id,omitempty"`
}

// AuditStatsResponse represents aggregated audit statistics for dashboard
type AuditStatsResponse struct {
	TotalEvents24h       int64              `json:"total_events_24h"`
	TotalEvents7d        int64              `json:"total_events_7d"`
	EventsByCategory     map[string]int64   `json:"events_by_category"`
	EventsByAction       map[string]int64   `json:"events_by_action"`
	EventsByStatus       map[string]int64   `json:"events_by_status"`
	TopActors            []ActorStats       `json:"top_actors"`
	TopPublishers        []PublisherStats   `json:"top_publishers"`
	RecentCriticalEvents []AuditLogResponse `json:"recent_critical_events"`
}

// ActorStats represents statistics for an actor (user)
type ActorStats struct {
	UserID     string `json:"user_id"`
	Username   string `json:"username"`
	EventCount int64  `json:"event_count"`
}

// PublisherStats represents statistics for a publisher
type PublisherStats struct {
	PublisherID   int32  `json:"publisher_id"`
	PublisherName string `json:"publisher_name"`
	EventCount    int64  `json:"event_count"`
}

// AuditExportRequest represents export request body
type AuditExportRequest struct {
	Format      string  `json:"format"`       // csv or json
	ActionType  *string `json:"action_type,omitempty"`
	Category    *string `json:"category,omitempty"`
	PublisherID *int32  `json:"publisher_id,omitempty"`
	ActorID     *string `json:"actor_id,omitempty"`
	Status      *string `json:"status,omitempty"`
	StartDate   *string `json:"start_date,omitempty"`
	EndDate     *string `json:"end_date,omitempty"`
	Limit       int     `json:"limit,omitempty"`
}

// =============================================================================
// GET /api/v1/admin/audit-logs
// Admin version with additional filters - can see ALL audit logs
// =============================================================================

// GetAdminAuditLogs returns audit logs with full admin access
//
//	@Summary		List all audit logs (admin)
//	@Description	Returns paginated audit logs with filtering. Admin can see all events across all publishers.
//	@Tags			Admin
//	@Produce		json
//	@Security		BearerAuth
//	@Param			page			query		int		false	"Page number (default 1)"
//	@Param			page_size		query		int		false	"Items per page (default 50, max 100)"
//	@Param			action_type		query		string	false	"Filter by action type"
//	@Param			category		query		string	false	"Filter by category (concept)"
//	@Param			publisher_id	query		int		false	"Filter by publisher ID"
//	@Param			actor_id		query		string	false	"Filter by actor (user) ID"
//	@Param			status			query		string	false	"Filter by status"
//	@Param			start_date		query		string	false	"Filter by start date (RFC3339)"
//	@Param			end_date		query		string	false	"Filter by end date (RFC3339)"
//	@Success		200				{object}	APIResponse{data=object}	"Audit logs"
//	@Failure		401				{object}	APIResponse{error=APIError}	"Unauthorized"
//	@Failure		403				{object}	APIResponse{error=APIError}	"Forbidden - admin role required"
//	@Failure		500				{object}	APIResponse{error=APIError}	"Internal server error"
//	@Router			/admin/audit-logs [get]
func (h *Handlers) GetAdminAuditLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse query parameters
	page, _ := parseIntFromQuery(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := parseIntFromQuery(r.URL.Query().Get("page_size"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	actionType := r.URL.Query().Get("action_type")
	category := r.URL.Query().Get("category")
	publisherIDStr := r.URL.Query().Get("publisher_id")
	actorID := r.URL.Query().Get("actor_id")
	status := r.URL.Query().Get("status")
	startDateStr := r.URL.Query().Get("start_date")
	endDateStr := r.URL.Query().Get("end_date")

	// Parse publisher ID
	var publisherID *int32
	if publisherIDStr != "" {
		if id, err := strconv.ParseInt(publisherIDStr, 10, 32); err == nil {
			idInt32 := int32(id)
			publisherID = &idInt32
		}
	}

	// Parse dates
	var startDate, endDate pgtype.Timestamptz
	if startDateStr != "" {
		if t, err := time.Parse(time.RFC3339, startDateStr); err == nil {
			startDate = pgtype.Timestamptz{Time: t, Valid: true}
		}
	}
	if endDateStr != "" {
		if t, err := time.Parse(time.RFC3339, endDateStr); err == nil {
			endDate = pgtype.Timestamptz{Time: t, Valid: true}
		}
	}

	// Query audit logs with extended filters
	rows, err := h.db.Queries.GetAdminAuditLogsExtended(ctx, sqlcgen.GetAdminAuditLogsExtendedParams{
		ActionTypeFilter:  nilIfEmpty(actionType),
		CategoryFilter:    nilIfEmpty(category),
		PublisherIDFilter: publisherID,
		UserIDFilter:      nilIfEmpty(actorID),
		StatusFilter:      nilIfEmpty(status),
		StartDate:         startDate,
		EndDate:           endDate,
		LimitVal:          int32(pageSize),
		OffsetVal:         int32(offset),
	})
	if err != nil {
		slog.Error("failed to get admin audit logs", "error", err)
		RespondInternalError(w, r, "Failed to retrieve audit logs")
		return
	}

	// Get total count
	total, err := h.db.Queries.CountAdminAuditLogsExtended(ctx, sqlcgen.CountAdminAuditLogsExtendedParams{
		ActionTypeFilter:  nilIfEmpty(actionType),
		CategoryFilter:    nilIfEmpty(category),
		PublisherIDFilter: publisherID,
		UserIDFilter:      nilIfEmpty(actorID),
		StatusFilter:      nilIfEmpty(status),
		StartDate:         startDate,
		EndDate:           endDate,
	})
	if err != nil {
		slog.Warn("failed to count audit logs", "error", err)
		total = 0
	}

	// Format response
	entries := make([]AuditLogResponse, 0, len(rows))
	for _, row := range rows {
		entry := formatAuditLogEntry(row)
		entries = append(entries, entry)
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"entries":   entries,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// =============================================================================
// GET /api/v1/admin/audit-logs/stats
// Dashboard statistics endpoint
// =============================================================================

// GetAdminAuditStats returns aggregated audit statistics for admin dashboard
//
//	@Summary		Get audit statistics (admin)
//	@Description	Returns aggregated statistics for the admin audit dashboard
//	@Tags			Admin
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	APIResponse{data=AuditStatsResponse}	"Audit statistics"
//	@Failure		401	{object}	APIResponse{error=APIError}				"Unauthorized"
//	@Failure		403	{object}	APIResponse{error=APIError}				"Forbidden - admin role required"
//	@Failure		500	{object}	APIResponse{error=APIError}				"Internal server error"
//	@Router			/admin/audit-logs/stats [get]
func (h *Handlers) GetAdminAuditStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get 24h count
	stats24h, err := h.db.Queries.GetAuditStats24h(ctx)
	if err != nil {
		slog.Error("failed to get 24h audit stats", "error", err)
		stats24h = 0
	}

	// Get 7d count
	stats7d, err := h.db.Queries.GetAuditStats7d(ctx)
	if err != nil {
		slog.Error("failed to get 7d audit stats", "error", err)
		stats7d = 0
	}

	// Get events by category
	categoryRows, err := h.db.Queries.GetAuditStatsByCategory(ctx)
	if err != nil {
		slog.Error("failed to get category stats", "error", err)
		categoryRows = nil
	}
	eventsByCategory := make(map[string]int64)
	for _, row := range categoryRows {
		// Category is string, not *string
		if row.Category != "" {
			eventsByCategory[row.Category] = row.EventCount
		}
	}

	// Get events by action
	actionRows, err := h.db.Queries.GetAuditStatsByAction(ctx)
	if err != nil {
		slog.Error("failed to get action stats", "error", err)
		actionRows = nil
	}
	eventsByAction := make(map[string]int64)
	for _, row := range actionRows {
		eventsByAction[row.Action] = row.EventCount
	}

	// Get events by status
	statusRows, err := h.db.Queries.GetAuditStatsByStatus(ctx)
	if err != nil {
		slog.Error("failed to get status stats", "error", err)
		statusRows = nil
	}
	eventsByStatus := make(map[string]int64)
	for _, row := range statusRows {
		eventsByStatus[row.Status] = row.EventCount
	}

	// Get top actors (users)
	actorRows, err := h.db.Queries.GetTopActors(ctx, 10)
	if err != nil {
		slog.Error("failed to get top actors", "error", err)
		actorRows = nil
	}
	topActors := make([]ActorStats, 0, len(actorRows))
	for _, row := range actorRows {
		if row.UserID != nil {
			topActors = append(topActors, ActorStats{
				UserID:     *row.UserID,
				Username:   *row.UserID, // Username would come from Clerk, using ID as fallback
				EventCount: row.EventCount,
			})
		}
	}

	// Get top publishers
	publisherRows, err := h.db.Queries.GetTopPublishers(ctx, 10)
	if err != nil {
		slog.Error("failed to get top publishers", "error", err)
		publisherRows = nil
	}
	topPublishers := make([]PublisherStats, 0, len(publisherRows))
	for _, row := range publisherRows {
		if row.PublisherID != nil {
			topPublishers = append(topPublishers, PublisherStats{
				PublisherID:   *row.PublisherID,
				PublisherName: row.PublisherName,
				EventCount:    row.EventCount,
			})
		}
	}

	// Get recent critical events
	criticalRows, err := h.db.Queries.GetRecentCriticalEvents(ctx, 10)
	if err != nil {
		slog.Error("failed to get critical events", "error", err)
		criticalRows = nil
	}
	recentCritical := make([]AuditLogResponse, 0, len(criticalRows))
	for _, row := range criticalRows {
		entry := AuditLogResponse{
			ID:            row.ID,
			ActionType:    row.ActionType,
			Category:      row.Concept,
			UserID:        row.UserID,
			PublisherID:   row.PublisherID,
			PublisherName: row.PublisherName,
			EntityType:    row.EntityType,
			EntityID:      row.EntityID,
			Status:        row.Status,
			ErrorMessage:  row.ErrorMessage,
			Description:   formatAuditActionDescription(row.ActionType, row.EntityType),
		}
		if row.StartedAt.Valid {
			entry.StartedAt = row.StartedAt.Time
		}
		// Parse metadata
		if row.Metadata != nil {
			var metadata map[string]interface{}
			if json.Unmarshal(row.Metadata, &metadata) == nil {
				entry.Metadata = metadata
			}
		}
		recentCritical = append(recentCritical, entry)
	}

	response := AuditStatsResponse{
		TotalEvents24h:       stats24h,
		TotalEvents7d:        stats7d,
		EventsByCategory:     eventsByCategory,
		EventsByAction:       eventsByAction,
		EventsByStatus:       eventsByStatus,
		TopActors:            topActors,
		TopPublishers:        topPublishers,
		RecentCriticalEvents: recentCritical,
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// =============================================================================
// GET /api/v1/admin/audit-logs/{id}
// Get single audit log entry - admin can view any event
// =============================================================================

// GetAdminAuditLogByID returns a single audit log entry by ID
//
//	@Summary		Get audit log by ID (admin)
//	@Description	Returns a single audit log entry. Admin can view any event.
//	@Tags			Admin
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string								true	"Audit log ID"
//	@Success		200	{object}	APIResponse{data=AuditLogResponse}	"Audit log entry"
//	@Failure		401	{object}	APIResponse{error=APIError}			"Unauthorized"
//	@Failure		403	{object}	APIResponse{error=APIError}			"Forbidden - admin role required"
//	@Failure		404	{object}	APIResponse{error=APIError}			"Audit log not found"
//	@Failure		500	{object}	APIResponse{error=APIError}			"Internal server error"
//	@Router			/admin/audit-logs/{id} [get]
func (h *Handlers) GetAdminAuditLogByID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get ID from URL - ID is a string (ULID or UUID format)
	idStr := chi.URLParam(r, "id")
	if idStr == "" {
		RespondValidationError(w, r, "Audit log ID is required", nil)
		return
	}

	// Query single entry - ID is string type
	row, err := h.db.Queries.GetAuditLogByID(ctx, idStr)
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Audit log not found")
			return
		}
		slog.Error("failed to get audit log by ID", "error", err, "id", idStr)
		RespondInternalError(w, r, "Failed to retrieve audit log")
		return
	}

	// Format response
	entry := AuditLogResponse{
		ID:            row.ID,
		ActionType:    row.ActionType,
		Category:      row.Concept,
		UserID:        row.UserID,
		PublisherID:   row.PublisherID,
		PublisherName: row.PublisherName,
		EntityType:    row.EntityType,
		EntityID:      row.EntityID,
		Status:        row.Status,
		ErrorMessage:  row.ErrorMessage,
		Description:   formatAuditActionDescription(row.ActionType, row.EntityType),
		RequestID:     row.RequestID,
	}

	if row.StartedAt.Valid {
		entry.StartedAt = row.StartedAt.Time
	}
	if row.CompletedAt.Valid {
		entry.CompletedAt = &row.CompletedAt.Time
	}
	// DurationMs is *int32, not pgtype.Int32
	entry.DurationMs = row.DurationMs

	// ParentActionID is pgtype.UUID - convert to string if valid
	if row.ParentActionID.Valid {
		uuidBytes := row.ParentActionID.Bytes
		entry.ParentActionID = fmt.Sprintf("%x-%x-%x-%x-%x",
			uuidBytes[0:4], uuidBytes[4:6], uuidBytes[6:8], uuidBytes[8:10], uuidBytes[10:16])
	}

	// Parse payload for changes
	if row.Payload != nil {
		var changes map[string]interface{}
		if json.Unmarshal(row.Payload, &changes) == nil {
			entry.Changes = changes
		}
	}

	// Parse metadata
	if row.Metadata != nil {
		var metadata map[string]interface{}
		if json.Unmarshal(row.Metadata, &metadata) == nil {
			entry.Metadata = metadata
		}
	}

	RespondJSON(w, r, http.StatusOK, entry)
}

// =============================================================================
// POST /api/v1/admin/audit-logs/export
// Export audit logs - admin version with full access
// =============================================================================

// ExportAdminAuditLogs exports audit logs in CSV or JSON format
//
//	@Summary		Export audit logs (admin)
//	@Description	Exports audit logs in CSV or JSON format. Admin can export any publisher's logs.
//	@Tags			Admin
//	@Accept			json
//	@Produce		application/json,text/csv
//	@Security		BearerAuth
//	@Param			request	body		AuditExportRequest				true	"Export parameters"
//	@Success		200		{file}		file							"Exported data"
//	@Failure		400		{object}	APIResponse{error=APIError}		"Invalid request"
//	@Failure		401		{object}	APIResponse{error=APIError}		"Unauthorized"
//	@Failure		403		{object}	APIResponse{error=APIError}		"Forbidden - admin role required"
//	@Failure		500		{object}	APIResponse{error=APIError}		"Internal server error"
//	@Router			/admin/audit-logs/export [post]
func (h *Handlers) ExportAdminAuditLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse request body
	var req AuditExportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Validate format
	if req.Format != "csv" && req.Format != "json" {
		req.Format = "json" // Default to JSON
	}

	// Set default and max limit
	if req.Limit <= 0 {
		req.Limit = 1000
	}
	if req.Limit > 10000 {
		req.Limit = 10000 // Admin gets higher limit
	}

	// Parse dates
	var startDate, endDate pgtype.Timestamptz
	if req.StartDate != nil && *req.StartDate != "" {
		if t, err := time.Parse(time.RFC3339, *req.StartDate); err == nil {
			startDate = pgtype.Timestamptz{Time: t, Valid: true}
		}
	}
	if req.EndDate != nil && *req.EndDate != "" {
		if t, err := time.Parse(time.RFC3339, *req.EndDate); err == nil {
			endDate = pgtype.Timestamptz{Time: t, Valid: true}
		}
	}

	// Query audit logs
	rows, err := h.db.Queries.GetAdminAuditLogsExtended(ctx, sqlcgen.GetAdminAuditLogsExtendedParams{
		ActionTypeFilter:  req.ActionType,
		CategoryFilter:    req.Category,
		PublisherIDFilter: req.PublisherID,
		UserIDFilter:      req.ActorID,
		StatusFilter:      req.Status,
		StartDate:         startDate,
		EndDate:           endDate,
		LimitVal:          int32(req.Limit),
		OffsetVal:         0,
	})
	if err != nil {
		slog.Error("failed to get audit logs for export", "error", err)
		RespondInternalError(w, r, "Failed to retrieve audit logs")
		return
	}

	// Format entries
	entries := make([]AuditLogResponse, 0, len(rows))
	for _, row := range rows {
		entry := formatAuditLogEntry(row)
		entries = append(entries, entry)
	}

	// Generate filename
	timestamp := time.Now().Format("2006-01-02-150405")
	filename := fmt.Sprintf("audit-logs-%s.%s", timestamp, req.Format)

	if req.Format == "csv" {
		// Export as CSV
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

		writer := csv.NewWriter(w)
		// Write header
		header := []string{
			"ID", "Action Type", "Category", "User ID", "Publisher ID",
			"Publisher Name", "Entity Type", "Entity ID", "Status",
			"Started At", "Duration (ms)", "Description",
		}
		if err := writer.Write(header); err != nil {
			slog.Error("failed to write CSV header", "error", err)
			return
		}

		// Write rows
		for _, entry := range entries {
			row := []string{
				entry.ID,
				entry.ActionType,
				entry.Category,
				ptrToString(entry.UserID),
				formatInt32Ptr(entry.PublisherID),
				entry.PublisherName,
				ptrToString(entry.EntityType),
				ptrToString(entry.EntityID),
				ptrToString(entry.Status),
				entry.StartedAt.Format(time.RFC3339),
				formatInt32Ptr(entry.DurationMs),
				entry.Description,
			}
			if err := writer.Write(row); err != nil {
				slog.Error("failed to write CSV row", "error", err)
				return
			}
		}
		writer.Flush()
	} else {
		// Export as JSON
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

		exportData := map[string]interface{}{
			"export_date": time.Now().UTC().Format(time.RFC3339),
			"total":       len(entries),
			"entries":     entries,
		}

		encoder := json.NewEncoder(w)
		encoder.SetIndent("", "  ")
		if err := encoder.Encode(exportData); err != nil {
			slog.Error("failed to encode JSON export", "error", err)
		}
	}
}

// =============================================================================
// Helper Functions
// =============================================================================

// formatAuditLogEntry converts database row to response format
func formatAuditLogEntry(row sqlcgen.GetAdminAuditLogsExtendedRow) AuditLogResponse {
	entry := AuditLogResponse{
		ID:            row.ID,
		ActionType:    row.ActionType,
		Category:      row.Concept,
		UserID:        row.UserID,
		PublisherID:   row.PublisherID,
		PublisherName: row.PublisherName,
		EntityType:    row.EntityType,
		EntityID:      row.EntityID,
		Status:        row.Status,
		ErrorMessage:  row.ErrorMessage,
		Description:   formatAuditActionDescription(row.ActionType, row.EntityType),
		RequestID:     row.RequestID,
	}

	if row.StartedAt.Valid {
		entry.StartedAt = row.StartedAt.Time
	}
	if row.CompletedAt.Valid {
		entry.CompletedAt = &row.CompletedAt.Time
	}
	// DurationMs is *int32, not wrapped type
	entry.DurationMs = row.DurationMs

	// Parse payload for changes
	if row.Payload != nil {
		var changes map[string]interface{}
		if json.Unmarshal(row.Payload, &changes) == nil {
			entry.Changes = changes
		}
	}

	// Parse metadata
	if row.Metadata != nil {
		var metadata map[string]interface{}
		if json.Unmarshal(row.Metadata, &metadata) == nil {
			entry.Metadata = metadata
		}
	}

	return entry
}

// formatAuditActionDescription creates a human-readable description for an audit action
func formatAuditActionDescription(actionType string, entityType *string) string {
	switch actionType {
	// Admin actions
	case "admin_publisher_verify":
		return "Publisher Verified"
	case "admin_publisher_suspend":
		return "Publisher Suspended"
	case "admin_publisher_reactivate":
		return "Publisher Reactivated"
	case "admin_publisher_delete":
		return "Publisher Deleted"
	case "admin_publisher_restore":
		return "Publisher Restored"
	case "admin_publisher_permanent_delete":
		return "Publisher Permanently Deleted"
	case "admin_publisher_certified":
		return "Publisher Certified Status Changed"
	case "admin_publisher_create":
		return "Publisher Created"
	case "admin_publisher_update":
		return "Publisher Updated"
	case "admin_user_add":
		return "User Added to Publisher"
	case "admin_user_remove":
		return "User Removed from Publisher"
	case "admin_correction_approve":
		return "Correction Request Approved"
	case "admin_correction_reject":
		return "Correction Request Rejected"
	case "admin_publisher_export":
		return "Publisher Data Exported"
	case "admin_publisher_import":
		return "Publisher Data Imported"
	case "admin_cache_flush":
		return "Cache Flushed"

	// Publisher actions
	case "profile_update":
		return "Publisher Profile Updated"
	case "algorithm_save":
		return "Algorithm Draft Saved"
	case "algorithm_publish":
		return "Algorithm Published"
	case "coverage_add":
		return "Coverage Area Added"
	case "coverage_remove":
		return "Coverage Area Removed"
	case "coverage_update":
		return "Coverage Area Updated"
	case "zman_create":
		return "Zman Created"
	case "zman_update":
		return "Zman Updated"
	case "zman_delete":
		return "Zman Deleted"
	case "zman_restore":
		return "Zman Restored"
	case "zman_publish":
		return "Zman Published"
	case "zman_unpublish":
		return "Zman Unpublished"

	default:
		// Fallback: format action type nicely
		if entityType != nil && *entityType != "" {
			return fmt.Sprintf("%s on %s", formatActionTypeNice(actionType), *entityType)
		}
		return formatActionTypeNice(actionType)
	}
}

// formatActionTypeNice converts action_type to Title Case
func formatActionTypeNice(actionType string) string {
	// Replace underscores with spaces and capitalize
	result := ""
	capitalizeNext := true
	for _, c := range actionType {
		if c == '_' {
			result += " "
			capitalizeNext = true
		} else if capitalizeNext && c >= 'a' && c <= 'z' {
			result += string(c - 32) // Convert to uppercase
			capitalizeNext = false
		} else {
			result += string(c)
			capitalizeNext = false
		}
	}
	return result
}

// ptrToString returns the string value or empty string for nil pointer
func ptrToString(s *string) string {
	if s != nil {
		return *s
	}
	return ""
}

// formatInt32Ptr formats int32 pointer as string
func formatInt32Ptr(i *int32) string {
	if i != nil {
		return fmt.Sprintf("%d", *i)
	}
	return ""
}
