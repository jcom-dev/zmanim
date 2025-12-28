// File: correction_requests.go
// Purpose: Publisher correction request handlers
// Pattern: 6-step handler pattern
// Story: 6.5 - Public Correction Requests

package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/middleware"
	"github.com/jcom-dev/zmanim/internal/services"
)

// CreateCorrectionRequest creates a new locality correction request
// POST /api/v1/publisher/correction-requests
func (h *Handlers) CreateCorrectionRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. URL params - none for POST

	// 3. Parse body
	var req struct {
		LocalityID       int64    `json:"locality_id"`
		ProposedLatitude *float64 `json:"proposed_latitude"`
		ProposedLong     *float64 `json:"proposed_longitude"`
		ProposedElev     *int32   `json:"proposed_elevation"`
		Reason           string   `json:"correction_reason"`
		EvidenceURLs     []string `json:"evidence_urls"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// 4. Validate
	if req.LocalityID == 0 {
		RespondValidationError(w, r, "Locality ID is required", map[string]string{"locality_id": "Locality ID is required"})
		return
	}

	// At least one proposed value must be provided
	if req.ProposedLatitude == nil && req.ProposedLong == nil && req.ProposedElev == nil {
		RespondValidationError(w, r, "At least one correction must be proposed", map[string]string{
			"proposed_values": "At least one of latitude, longitude, or elevation must be provided",
		})
		return
	}

	// Reason is required and must be at least 20 characters
	if len(req.Reason) < 20 {
		RespondValidationError(w, r, "Correction reason must be at least 20 characters", map[string]string{
			"correction_reason": "Reason must be at least 20 characters",
		})
		return
	}

	// Validate latitude/longitude ranges
	if req.ProposedLatitude != nil && (*req.ProposedLatitude < -90 || *req.ProposedLatitude > 90) {
		RespondValidationError(w, r, "Latitude must be between -90 and 90", map[string]string{
			"proposed_latitude": "Latitude must be between -90 and 90",
		})
		return
	}

	if req.ProposedLong != nil && (*req.ProposedLong < -180 || *req.ProposedLong > 180) {
		RespondValidationError(w, r, "Longitude must be between -180 and 180", map[string]string{
			"proposed_longitude": "Longitude must be between -180 and 180",
		})
		return
	}

	// Get requester info from Clerk
	userID := middleware.GetUserID(ctx)
	var requesterEmail string
	var requesterName *string

	if h.clerkService != nil && userID != "" {
		user, err := h.clerkService.GetUser(ctx, userID)
		if err == nil {
			if len(user.EmailAddresses) > 0 {
				requesterEmail = user.EmailAddresses[0].EmailAddress
			}
			if user.FirstName != nil && user.LastName != nil {
				fullName := *user.FirstName + " " + *user.LastName
				requesterName = &fullName
			} else if user.FirstName != nil {
				requesterName = user.FirstName
			}
		}
	}

	if requesterEmail == "" {
		RespondInternalError(w, r, "Unable to determine requester email")
		return
	}

	// 5. SQLc query
	publisherID, err := strconv.ParseInt(pc.PublisherID, 10, 32)
	if err != nil {
		RespondInternalError(w, r, "Invalid publisher ID")
		return
	}
	publisherIDInt32 := int32(publisherID)
	localityIDInt32 := int32(req.LocalityID)
	result, err := h.db.Queries.CreateCorrectionRequest(ctx, sqlcgen.CreateCorrectionRequestParams{
		LocalityID:        &localityIDInt32,
		PublisherID:       &publisherIDInt32,
		RequesterEmail:    requesterEmail,
		RequesterName:     requesterName,
		ProposedLatitude:  req.ProposedLatitude,
		ProposedLongitude: req.ProposedLong,
		ProposedElevation: req.ProposedElev,
		CorrectionReason:  req.Reason,
		EvidenceUrls:      req.EvidenceURLs,
	})

	if err != nil {
		slog.Error("failed to create correction request",
			"error", err,
			"publisher_id", pc.PublisherID,
			"locality_id", req.LocalityID)
		h.LogAuditEvent(ctx, r, pc, AuditEventParams{
			ActionType:   services.ActionCorrectionRequestCreate,
			ResourceType: "correction_request",
			ResourceID:   fmt.Sprintf("%d", req.LocalityID),
			Status:       AuditStatusFailure,
			ErrorMessage: err.Error(),
		})
		RespondInternalError(w, r, "Failed to create correction request")
		return
	}

	slog.Info("correction request created",
		"request_id", result.ID,
		"publisher_id", pc.PublisherID,
		"locality_id", req.LocalityID,
		"requester_email", requesterEmail)

	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:   services.ActionCorrectionRequestCreate,
		ResourceType: "correction_request",
		ResourceID:   fmt.Sprintf("%d", result.ID),
		Status:       AuditStatusSuccess,
		ChangesAfter: map[string]interface{}{
			"locality_id":     req.LocalityID,
			"requester_email": requesterEmail,
			"proposed_lat":    req.ProposedLatitude,
			"proposed_lng":    req.ProposedLong,
			"proposed_elev":   req.ProposedElev,
		},
	})

	// 6. Respond
	RespondJSON(w, r, http.StatusCreated, result)
}

// GetPublisherCorrectionRequests returns all correction requests from the current publisher
// GET /api/v1/publisher/correction-requests
func (h *Handlers) GetPublisherCorrectionRequests(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. URL params - none

	// 3. Parse body - none for GET

	// 4. Validate - none

	// 5. SQLc query
	publisherID, err := strconv.ParseInt(pc.PublisherID, 10, 32)
	if err != nil {
		RespondInternalError(w, r, "Invalid publisher ID")
		return
	}
	publisherIDInt32 := int32(publisherID)
	requests, err := h.db.Queries.GetPublisherCorrectionRequests(ctx, &publisherIDInt32)
	if err != nil {
		slog.Error("failed to get publisher correction requests",
			"error", err,
			"publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to retrieve correction requests")
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"requests": requests,
		"total":    len(requests),
	})
}

// GetCorrectionRequestByID returns a single correction request by ID
// GET /api/v1/publisher/correction-requests/{id}
func (h *Handlers) GetCorrectionRequestByID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. URL params
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid request ID")
		return
	}

	// 3. Parse body - none for GET

	// 4. Validate - none

	// 5. SQLc query
	request, err := h.db.Queries.GetCorrectionRequestByID(ctx, int32(id))
	if err != nil {
		slog.Error("failed to get correction request",
			"error", err,
			"request_id", id,
			"publisher_id", pc.PublisherID)
		RespondNotFound(w, r, "Correction request not found")
		return
	}

	// Verify the request belongs to this publisher
	publisherID, err := strconv.ParseInt(pc.PublisherID, 10, 32)
	if err != nil {
		RespondInternalError(w, r, "Invalid publisher ID")
		return
	}
	if request.PublisherID == nil || *request.PublisherID != int32(publisherID) {
		RespondForbidden(w, r, "You do not have access to this correction request")
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, request)
}

// UpdateCorrectionRequest updates a pending correction request
// PUT /api/v1/publisher/correction-requests/{id}
func (h *Handlers) UpdateCorrectionRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. URL params
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid request ID")
		return
	}

	// 3. Parse body
	var req struct {
		LocalityID       int64    `json:"locality_id"`
		ProposedLatitude *float64 `json:"proposed_latitude"`
		ProposedLong     *float64 `json:"proposed_longitude"`
		ProposedElev     *int32   `json:"proposed_elevation"`
		Reason           string   `json:"correction_reason"`
		EvidenceURLs     []string `json:"evidence_urls"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// 4. Validate - First get the existing request to verify ownership and status
	existingRequest, err := h.db.Queries.GetCorrectionRequestByID(ctx, int32(id))
	if err != nil {
		slog.Error("failed to get correction request for update",
			"error", err,
			"request_id", id,
			"publisher_id", pc.PublisherID)
		RespondNotFound(w, r, "Correction request not found")
		return
	}

	// Verify the request belongs to this publisher
	publisherID, err := strconv.ParseInt(pc.PublisherID, 10, 32)
	if err != nil {
		RespondInternalError(w, r, "Invalid publisher ID")
		return
	}
	if existingRequest.PublisherID == nil || *existingRequest.PublisherID != int32(publisherID) {
		RespondForbidden(w, r, "You do not have access to this correction request")
		return
	}

	// Only allow updating pending requests
	if existingRequest.Status != "pending" {
		RespondValidationError(w, r, "Only pending requests can be updated", map[string]string{
			"status": "Cannot update a request that has been " + existingRequest.Status,
		})
		return
	}

	// Validate required fields
	if req.LocalityID == 0 {
		RespondValidationError(w, r, "Locality ID is required", map[string]string{"locality_id": "Locality ID is required"})
		return
	}

	// At least one proposed value must be provided
	if req.ProposedLatitude == nil && req.ProposedLong == nil && req.ProposedElev == nil {
		RespondValidationError(w, r, "At least one correction must be proposed", map[string]string{
			"proposed_values": "At least one of latitude, longitude, or elevation must be provided",
		})
		return
	}

	// Reason is required and must be at least 20 characters
	if len(req.Reason) < 20 {
		RespondValidationError(w, r, "Correction reason must be at least 20 characters", map[string]string{
			"correction_reason": "Reason must be at least 20 characters",
		})
		return
	}

	// Validate latitude/longitude ranges
	if req.ProposedLatitude != nil && (*req.ProposedLatitude < -90 || *req.ProposedLatitude > 90) {
		RespondValidationError(w, r, "Latitude must be between -90 and 90", map[string]string{
			"proposed_latitude": "Latitude must be between -90 and 90",
		})
		return
	}

	if req.ProposedLong != nil && (*req.ProposedLong < -180 || *req.ProposedLong > 180) {
		RespondValidationError(w, r, "Longitude must be between -180 and 180", map[string]string{
			"proposed_longitude": "Longitude must be between -180 and 180",
		})
		return
	}

	// 5. SQLc query - Update the request
	localityIDInt32 := int32(req.LocalityID)
	result, err := h.db.Queries.UpdateCorrectionRequest(ctx, sqlcgen.UpdateCorrectionRequestParams{
		ID:                int32(id),
		LocalityID:        &localityIDInt32,
		ProposedLatitude:  req.ProposedLatitude,
		ProposedLongitude: req.ProposedLong,
		ProposedElevation: req.ProposedElev,
		CorrectionReason:  req.Reason,
		EvidenceUrls:      req.EvidenceURLs,
	})

	if err != nil {
		slog.Error("failed to update correction request",
			"error", err,
			"request_id", id,
			"publisher_id", pc.PublisherID)
		h.LogAuditEvent(ctx, r, pc, AuditEventParams{
			ActionType:   services.ActionCorrectionRequestUpdate,
			ResourceType: "correction_request",
			ResourceID:   idStr,
			Status:       AuditStatusFailure,
			ErrorMessage: err.Error(),
		})
		RespondInternalError(w, r, "Failed to update correction request")
		return
	}

	slog.Info("correction request updated",
		"request_id", id,
		"publisher_id", pc.PublisherID,
		"locality_id", req.LocalityID)

	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:   services.ActionCorrectionRequestUpdate,
		ResourceType: "correction_request",
		ResourceID:   idStr,
		Status:       AuditStatusSuccess,
		ChangesBefore: map[string]interface{}{
			"locality_id":   existingRequest.LocalityID,
			"proposed_lat":  existingRequest.ProposedLatitude,
			"proposed_lng":  existingRequest.ProposedLongitude,
			"proposed_elev": existingRequest.ProposedElevation,
		},
		ChangesAfter: map[string]interface{}{
			"locality_id":   req.LocalityID,
			"proposed_lat":  req.ProposedLatitude,
			"proposed_lng":  req.ProposedLong,
			"proposed_elev": req.ProposedElev,
		},
	})

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, result)
}

// DeleteCorrectionRequest deletes a correction request (publisher can only delete their own pending requests)
// DELETE /api/v1/publisher/correction-requests/{id}
func (h *Handlers) DeleteCorrectionRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. URL params
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid request ID")
		return
	}

	// 3. Parse body - none for DELETE

	// 4. Validate - Get the request first to verify ownership and status
	request, err := h.db.Queries.GetCorrectionRequestByID(ctx, int32(id))
	if err != nil {
		slog.Error("failed to get correction request for deletion",
			"error", err,
			"request_id", id,
			"publisher_id", pc.PublisherID)
		RespondNotFound(w, r, "Correction request not found")
		return
	}

	// Verify the request belongs to this publisher
	publisherID, err := strconv.ParseInt(pc.PublisherID, 10, 32)
	if err != nil {
		RespondInternalError(w, r, "Invalid publisher ID")
		return
	}
	if request.PublisherID == nil || *request.PublisherID != int32(publisherID) {
		RespondForbidden(w, r, "You do not have access to this correction request")
		return
	}

	// Only allow deletion of pending requests
	if request.Status != "pending" {
		RespondValidationError(w, r, "Only pending requests can be deleted", map[string]string{
			"status": "Cannot delete a request that has been " + request.Status,
		})
		return
	}

	// 5. SQLc query - Delete the request
	err = h.db.Queries.DeleteCorrectionRequest(ctx, int32(id))
	if err != nil {
		slog.Error("failed to delete correction request",
			"error", err,
			"request_id", id,
			"publisher_id", pc.PublisherID)
		h.LogAuditEvent(ctx, r, pc, AuditEventParams{
			ActionType:   services.ActionCorrectionRequestDelete,
			ResourceType: "correction_request",
			ResourceID:   idStr,
			Status:       AuditStatusFailure,
			ErrorMessage: err.Error(),
		})
		RespondInternalError(w, r, "Failed to delete correction request")
		return
	}

	slog.Info("correction request deleted",
		"request_id", id,
		"publisher_id", pc.PublisherID,
		"locality_id", request.LocalityID)

	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:   services.ActionCorrectionRequestDelete,
		ResourceType: "correction_request",
		ResourceID:   idStr,
		Status:       AuditStatusSuccess,
		ChangesBefore: map[string]interface{}{
			"locality_id": request.LocalityID,
			"status":      request.Status,
		},
	})

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"message": "Correction request deleted successfully",
	})
}

// GetCorrectionRequests returns correction requests filtered by role
// GET /api/v1/auth/correction-requests
// Story 9.3: Unified endpoint replacing /publisher/correction-requests and /admin/correction-requests
func (h *Handlers) GetCorrectionRequests(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Get user role from context
	role := middleware.GetUserRole(ctx)
	if role == "" {
		RespondUnauthorized(w, r, "Authentication required")
		return
	}

	// 2. URL params
	statusFilter := r.URL.Query().Get("status")
	publisherIDParam := r.URL.Query().Get("publisher_id")

	// 3. Parse body - none for GET

	// 4. Validate status filter if provided
	if statusFilter != "" && statusFilter != "pending" && statusFilter != "approved" && statusFilter != "rejected" {
		RespondValidationError(w, r, "Invalid status filter", map[string]string{
			"status": "Status must be one of: pending, approved, rejected",
		})
		return
	}

	// 5. SQLc query - role-based filtering
	if role == "admin" {
		// Admin sees all requests (with optional filters)
		var statusPtr *string
		if statusFilter != "" {
			statusPtr = &statusFilter
		}

		requests, err := h.db.Queries.GetAllCorrectionRequests(ctx, statusPtr)
		if err != nil {
			slog.Error("failed to get correction requests", "error", err, "role", role)
			RespondInternalError(w, r, "Failed to retrieve correction requests")
			return
		}

		// If publisher_id filter provided, filter results
		if publisherIDParam != "" {
			pubID, err := strconv.ParseInt(publisherIDParam, 10, 32)
			if err == nil {
				filtered := []sqlcgen.GetAllCorrectionRequestsRow{}
				for _, req := range requests {
					if req.PublisherID != nil && *req.PublisherID == int32(pubID) {
						filtered = append(filtered, req)
					}
				}
				requests = filtered
			}
		}

		// 6. Respond
		RespondJSON(w, r, http.StatusOK, map[string]interface{}{
			"requests": requests,
			"total":    len(requests),
		})
		return
	}

	if role == "publisher" {
		// Publisher sees only their own requests
		pc := h.publisherResolver.MustResolve(w, r)
		if pc == nil {
			return
		}

		publisherID, err := strconv.ParseInt(pc.PublisherID, 10, 32)
		if err != nil {
			RespondInternalError(w, r, "Invalid publisher ID")
			return
		}
		publisherIDInt32 := int32(publisherID)

		requests, err := h.db.Queries.GetPublisherCorrectionRequests(ctx, &publisherIDInt32)
		if err != nil {
			slog.Error("failed to get publisher correction requests",
				"error", err,
				"publisher_id", pc.PublisherID,
				"role", role)
			RespondInternalError(w, r, "Failed to retrieve correction requests")
			return
		}

		// 6. Respond
		RespondJSON(w, r, http.StatusOK, map[string]interface{}{
			"requests": requests,
			"total":    len(requests),
		})
		return
	}

	// No valid role found
	RespondUnauthorized(w, r, "Invalid role")
}

// UpdateCorrectionRequestStatus updates the status of a correction request (admin only)
// PUT /api/v1/auth/correction-requests/{id}/status
// Story 9.3: Unified endpoint replacing POST /admin/correction-requests/{id}/approve and /reject
func (h *Handlers) UpdateCorrectionRequestStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Check admin role
	role := middleware.GetUserRole(ctx)
	if role != "admin" {
		RespondForbidden(w, r, "Admin role required")
		return
	}

	adminUserID := middleware.GetUserID(ctx)
	if adminUserID == "" {
		RespondUnauthorized(w, r, "Admin authentication required")
		return
	}

	// 2. URL params
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid request ID")
		return
	}

	// 3. Parse body
	var req struct {
		Status      string `json:"status"`
		ReviewNotes string `json:"review_notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// 4. Validate
	if req.Status != "approved" && req.Status != "rejected" {
		RespondValidationError(w, r, "Invalid status", map[string]string{
			"status": "Status must be either 'approved' or 'rejected'",
		})
		return
	}

	// For rejection, review notes are required
	if req.Status == "rejected" && req.ReviewNotes == "" {
		RespondValidationError(w, r, "Review notes are required for rejection", map[string]string{
			"review_notes": "Please provide a reason for rejection",
		})
		return
	}

	// Get the correction request
	correctionReq, err := h.db.Queries.GetCorrectionRequestByID(ctx, int32(id))
	if err != nil {
		slog.Error("failed to get correction request",
			"error", err,
			"request_id", id)
		RespondNotFound(w, r, "Correction request not found")
		return
	}

	// Check if already processed
	if correctionReq.Status != "pending" {
		RespondValidationError(w, r, "Request has already been processed", map[string]string{
			"status": "This request has already been " + correctionReq.Status,
		})
		return
	}

	// 5. Apply correction using admin overrides if approved
	var conflictingRequestIDs []int32
	if req.Status == "approved" {
		var localityID int32
		if correctionReq.LocalityID != nil {
			localityID = *correctionReq.LocalityID
		}

		// Store original default source values for history (before applying corrections)
		// Use original_* fields which exclude admin overrides, so we can properly revert
		// Note: If these are 0/0/0, it means no default source data exists (only admin override)
		var originalLat, originalLng *float64
		var originalElev *int32
		if correctionReq.OriginalLatitude != 0 || correctionReq.OriginalLongitude != 0 {
			lat := correctionReq.OriginalLatitude
			lng := correctionReq.OriginalLongitude
			originalLat = &lat
			originalLng = &lng
		}
		if correctionReq.OriginalElevation != 0 {
			elev := correctionReq.OriginalElevation
			originalElev = &elev
		}

		// Apply coordinate override if proposed lat/lng exist
		if correctionReq.ProposedLatitude != nil && correctionReq.ProposedLongitude != nil {
			reason := "Applied from correction request #" + idStr
			_, err = h.db.Queries.CreateAdminLocationOverride(ctx, sqlcgen.CreateAdminLocationOverrideParams{
				LocalityID: localityID,
				Latitude:   *correctionReq.ProposedLatitude,
				Longitude:  *correctionReq.ProposedLongitude,
				Reason:     &reason,
				CreatedBy:  &adminUserID,
			})
			if err != nil {
				slog.Error("failed to apply location correction",
					"error", err,
					"request_id", id,
					"locality_id", localityID)
				RespondInternalError(w, r, "Failed to apply location correction")
				return
			}
		}

		// Apply elevation override if proposed elevation exists
		if correctionReq.ProposedElevation != nil {
			reason := "Applied from correction request #" + idStr
			_, err = h.db.Queries.CreateAdminElevationOverride(ctx, sqlcgen.CreateAdminElevationOverrideParams{
				LocalityID: localityID,
				ElevationM: *correctionReq.ProposedElevation,
				Reason:     &reason,
				CreatedBy:  &adminUserID,
			})
			if err != nil {
				slog.Error("failed to apply elevation correction",
					"error", err,
					"request_id", id,
					"locality_id", localityID)
				RespondInternalError(w, r, "Failed to apply elevation correction")
				return
			}
		}

		// CRITICAL: Invalidate cache for the locality after applying corrections
		if h.cache != nil {
			localityIDStr := strconv.FormatInt(int64(localityID), 10)
			pattern := fmt.Sprintf("calc:*:%s:*", localityIDStr)
			if err := h.cache.DeleteByPattern(ctx, pattern); err != nil {
				slog.Error("cache invalidation failed after approval",
					"locality_id", localityID,
					"error", err)
			}
		}

		// Insert history record for approval
		notes := "Approved by admin"
		if req.ReviewNotes != "" {
			notes = "Approved: " + req.ReviewNotes
		}
		_, err = h.db.Queries.InsertCorrectionHistory(ctx, sqlcgen.InsertCorrectionHistoryParams{
			CorrectionRequestID: int32(id),
			LocalityID:          localityID,
			Action:              "approved",
			PerformedBy:         adminUserID,
			PreviousLatitude:    originalLat,
			PreviousLongitude:   originalLng,
			PreviousElevation:   originalElev,
			NewLatitude:         correctionReq.ProposedLatitude,
			NewLongitude:        correctionReq.ProposedLongitude,
			NewElevation:        correctionReq.ProposedElevation,
			Notes:               &notes,
		})
		if err != nil {
			slog.Error("failed to insert approval history",
				"error", err,
				"request_id", id)
			// Non-fatal - continue
		}

		// Check for conflicting pending requests
		duplicates, err := h.db.Queries.CheckDuplicateCorrectionRequests(ctx, &localityID)
		if err == nil {
			for _, dup := range duplicates {
				if dup.Status == "pending" && dup.ID != int32(id) {
					conflictingRequestIDs = append(conflictingRequestIDs, dup.ID)
				}
			}
		}
	}

	// Update request status
	reviewNotesPtr := &req.ReviewNotes
	err = h.db.Queries.UpdateCorrectionRequestStatus(ctx, sqlcgen.UpdateCorrectionRequestStatusParams{
		ID:          int32(id),
		Status:      req.Status,
		ReviewedBy:  &adminUserID,
		ReviewNotes: reviewNotesPtr,
	})
	if err != nil {
		slog.Error("failed to update correction request status",
			"error", err,
			"request_id", id)
		RespondInternalError(w, r, "Failed to update request status")
		return
	}

	slog.Info("correction request status updated",
		"request_id", id,
		"locality_id", correctionReq.LocalityID,
		"status", req.Status,
		"admin_id", adminUserID)

	// Send email notification in background
	if h.emailService != nil && h.emailService.IsEnabled() {
		go func() {
			// Use locality name from the correction request (already joined)
			localityName := correctionReq.LocalityName

			if req.Status == "approved" {
				err = h.emailService.SendCorrectionApproved(
					correctionReq.RequesterEmail,
					localityName,
					req.ReviewNotes,
				)
			} else {
				err = h.emailService.SendCorrectionRejected(
					correctionReq.RequesterEmail,
					localityName,
					req.ReviewNotes,
				)
			}

			if err != nil {
				slog.Error("failed to send email notification",
					"error", err,
					"to", correctionReq.RequesterEmail,
					"status", req.Status)
			}
		}()
	}

	// 6. Respond with conflicts if any
	response := map[string]interface{}{
		"status":  req.Status,
		"message": "Correction request " + req.Status + " successfully",
	}

	if len(conflictingRequestIDs) > 0 {
		response["conflicting_request_ids"] = conflictingRequestIDs
		response["warning"] = fmt.Sprintf("There are %d other pending request(s) for this locality", len(conflictingRequestIDs))
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// ApprovalResponse represents the response when approving a correction request
type ApprovalResponse struct {
	Status              string  `json:"status"`
	Message             string  `json:"message"`
	ConflictingRequests []int32 `json:"conflicting_request_ids,omitempty"`
	Warning             string  `json:"warning,omitempty"`
}

// CheckCorrectionDuplicates checks for duplicate correction requests for a locality
// GET /api/v1/publisher/correction-requests/check-duplicates?locality_id={id}
func (h *Handlers) CheckCorrectionDuplicates(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context - optional for this endpoint
	// Publishers can see all pending requests from any publisher for transparency

	// 2. URL params
	localityIDParam := r.URL.Query().Get("locality_id")
	if localityIDParam == "" {
		RespondBadRequest(w, r, "locality_id is required")
		return
	}

	localityID, err := strconv.ParseInt(localityIDParam, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid locality_id")
		return
	}

	// 3. Parse body - none for GET

	// 4. Validate - none

	// 5. SQLc query
	localityIDInt32 := int32(localityID)
	duplicates, err := h.db.Queries.CheckDuplicateCorrectionRequests(ctx, &localityIDInt32)
	if err != nil {
		slog.Error("failed to check duplicate correction requests",
			"error", err,
			"locality_id", localityID)
		RespondInternalError(w, r, "Failed to check for duplicates")
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, duplicates)
}

// GetCorrectionRequestHistory returns the history of correction requests for a locality
// GET /api/v1/admin/correction-requests/history?locality_id={id}
func (h *Handlers) GetCorrectionRequestHistory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Check admin role
	role := middleware.GetUserRole(ctx)
	if role != "admin" {
		RespondForbidden(w, r, "Admin role required")
		return
	}

	// 2. URL params
	localityIDParam := r.URL.Query().Get("locality_id")
	if localityIDParam == "" {
		RespondBadRequest(w, r, "locality_id is required")
		return
	}

	localityID, err := strconv.ParseInt(localityIDParam, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid locality_id")
		return
	}

	// 3. Parse body - none for GET

	// 4. Validate - none

	// 5. SQLc query
	localityIDInt32 := int32(localityID)
	history, err := h.db.Queries.GetCorrectionRequestHistory(ctx, &localityIDInt32)
	if err != nil {
		slog.Error("failed to get correction request history",
			"error", err,
			"locality_id", localityID)
		RespondInternalError(w, r, "Failed to retrieve history")
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"requests": history,
		"total":    len(history),
	})
}

// RevertCorrectionRequest reverts an approved correction request
// POST /api/v1/admin/correction-requests/{id}/revert
func (h *Handlers) RevertCorrectionRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Check admin role
	role := middleware.GetUserRole(ctx)
	if role != "admin" {
		RespondForbidden(w, r, "Admin role required")
		return
	}

	adminUserID := middleware.GetUserID(ctx)
	if adminUserID == "" {
		RespondUnauthorized(w, r, "Admin authentication required")
		return
	}

	// 2. URL params
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid request ID")
		return
	}

	// 3. Parse body
	var req struct {
		RevertReason string `json:"revert_reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// 4. Validate
	if len(req.RevertReason) < 20 {
		RespondValidationError(w, r, "Revert reason must be at least 20 characters", map[string]string{
			"revert_reason": "Reason must be at least 20 characters",
		})
		return
	}

	// Get the correction request to verify it's approved
	correctionReq, err := h.db.Queries.GetCorrectionRequestByID(ctx, int32(id))
	if err != nil {
		slog.Error("failed to get correction request for revert",
			"error", err,
			"request_id", id)
		RespondNotFound(w, r, "Correction request not found")
		return
	}

	if correctionReq.Status != "approved" {
		RespondValidationError(w, r, "Only approved requests can be reverted", map[string]string{
			"status": "This request has status: " + correctionReq.Status,
		})
		return
	}

	var localityID int32
	if correctionReq.LocalityID != nil {
		localityID = *correctionReq.LocalityID
	}

	// Get history to find previous values
	history, err := h.db.Queries.GetRequestHistory(ctx, int32(id))
	if err != nil {
		slog.Error("failed to get request history for revert",
			"error", err,
			"request_id", id)
		RespondInternalError(w, r, "Failed to retrieve history")
		return
	}

	// Find the approval record to get "before" values
	var previousLat, previousLng *float64
	var previousElev *int32
	for _, h := range history {
		if h.Action == "approved" {
			previousLat = h.PreviousLatitude
			previousLng = h.PreviousLongitude
			previousElev = h.PreviousElevation
			break
		}
	}

	// 5. Revert the admin overrides
	// If previous values existed, restore them; otherwise delete the override

	// Revert location override
	if correctionReq.ProposedLatitude != nil && correctionReq.ProposedLongitude != nil {
		if previousLat != nil && previousLng != nil {
			// Restore previous values
			reason := "Reverted from correction request #" + idStr
			_, err = h.db.Queries.CreateAdminLocationOverride(ctx, sqlcgen.CreateAdminLocationOverrideParams{
				LocalityID: localityID,
				Latitude:   *previousLat,
				Longitude:  *previousLng,
				Reason:     &reason,
				CreatedBy:  &adminUserID,
			})
			if err != nil {
				slog.Error("failed to restore location override",
					"error", err,
					"request_id", id,
					"locality_id", localityID)
				RespondInternalError(w, r, "Failed to restore location")
				return
			}
		} else {
			// Delete admin override to fall back to default source
			err = h.db.Queries.DeleteLocalityLocationOverrideByLocality(ctx, sqlcgen.DeleteLocalityLocationOverrideByLocalityParams{
				LocalityID:  localityID,
				PublisherID: nil,
			})
			if err != nil {
				slog.Error("failed to delete location override",
					"error", err,
					"request_id", id,
					"locality_id", localityID)
				RespondInternalError(w, r, "Failed to delete location override")
				return
			}
		}
	}

	// Revert elevation override
	if correctionReq.ProposedElevation != nil {
		if previousElev != nil {
			// Restore previous value
			reason := "Reverted from correction request #" + idStr
			_, err = h.db.Queries.CreateAdminElevationOverride(ctx, sqlcgen.CreateAdminElevationOverrideParams{
				LocalityID: localityID,
				ElevationM: *previousElev,
				Reason:     &reason,
				CreatedBy:  &adminUserID,
			})
			if err != nil {
				slog.Error("failed to restore elevation override",
					"error", err,
					"request_id", id,
					"locality_id", localityID)
				RespondInternalError(w, r, "Failed to restore elevation")
				return
			}
		} else {
			// Delete admin override to fall back to default source
			err = h.db.Queries.DeleteLocalityElevationOverrideByLocality(ctx, sqlcgen.DeleteLocalityElevationOverrideByLocalityParams{
				LocalityID:  localityID,
				PublisherID: nil,
			})
			if err != nil {
				slog.Error("failed to delete elevation override",
					"error", err,
					"request_id", id,
					"locality_id", localityID)
				RespondInternalError(w, r, "Failed to delete elevation override")
				return
			}
		}
	}

	// Update request status to reverted
	err = h.db.Queries.RevertCorrectionRequest(ctx, sqlcgen.RevertCorrectionRequestParams{
		RevertedBy:   &adminUserID,
		RevertReason: &req.RevertReason,
		ID:           int32(id),
	})
	if err != nil {
		slog.Error("failed to update request status to reverted",
			"error", err,
			"request_id", id)
		RespondInternalError(w, r, "Failed to update request status")
		return
	}

	// Insert revert history record
	notes := "Reverted by admin: " + req.RevertReason
	_, err = h.db.Queries.InsertCorrectionHistory(ctx, sqlcgen.InsertCorrectionHistoryParams{
		CorrectionRequestID: int32(id),
		LocalityID:          localityID,
		Action:              "reverted",
		PerformedBy:         adminUserID,
		PreviousLatitude:    correctionReq.ProposedLatitude,
		PreviousLongitude:   correctionReq.ProposedLongitude,
		PreviousElevation:   correctionReq.ProposedElevation,
		NewLatitude:         previousLat,
		NewLongitude:        previousLng,
		NewElevation:        previousElev,
		Notes:               &notes,
	})
	if err != nil {
		slog.Error("failed to insert revert history",
			"error", err,
			"request_id", id)
		// Non-fatal - continue
	}

	// CRITICAL: Invalidate cache for the locality
	if h.cache != nil {
		localityIDStr := strconv.FormatInt(int64(localityID), 10)
		pattern := fmt.Sprintf("calc:*:%s:*", localityIDStr)
		if err := h.cache.DeleteByPattern(ctx, pattern); err != nil {
			slog.Error("cache invalidation failed after revert",
				"locality_id", localityID,
				"error", err)
		}
	}

	slog.Info("correction request reverted",
		"request_id", id,
		"locality_id", localityID,
		"admin_id", adminUserID)

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"status":  "reverted",
		"message": "Correction request reverted successfully",
	})
}
