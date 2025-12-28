// File: admin_corrections.go
// Purpose: Admin correction request handlers
// Pattern: 6-step handler pattern
// Story: 6.5 - Public Correction Requests

package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/middleware"
	"github.com/jcom-dev/zmanim/internal/services"
)

// AdminGetAllCorrectionRequests returns all correction requests (optionally filtered by status)
// GET /api/v1/admin/correction-requests?status=pending
func (h *Handlers) AdminGetAllCorrectionRequests(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Admin context (no resolver needed - middleware handles auth)

	// 2. URL params
	statusFilter := r.URL.Query().Get("status")
	var statusPtr *string
	if statusFilter != "" {
		statusPtr = &statusFilter
	}

	// 3. Parse body - none for GET

	// 4. Validate
	if statusFilter != "" && statusFilter != "pending" && statusFilter != "approved" && statusFilter != "rejected" {
		RespondValidationError(w, r, "Invalid status filter", map[string]string{
			"status": "Status must be one of: pending, approved, rejected",
		})
		return
	}

	// 5. SQLc query
	requests, err := h.db.Queries.GetAllCorrectionRequests(ctx, statusPtr)
	if err != nil {
		slog.Error("failed to get correction requests", "error", err)
		RespondInternalError(w, r, "Failed to retrieve correction requests")
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"requests": requests,
		"total":    len(requests),
	})
}

// AdminApproveCorrectionRequest approves a correction request and updates the locality data
// POST /api/v1/admin/correction-requests/{id}/approve
func (h *Handlers) AdminApproveCorrectionRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Admin context
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
		ReviewNotes string `json:"review_notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Body is optional, continue without review notes
		req.ReviewNotes = ""
	}

	// 4. Validate - get the correction request
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

	// 5. Apply correction using admin overrides (highest system-wide priority)
	localityID := int32(0)
	if correctionReq.LocalityID != nil {
		localityID = *correctionReq.LocalityID
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

	// Update request status
	err = h.db.Queries.UpdateCorrectionRequestStatus(ctx, sqlcgen.UpdateCorrectionRequestStatusParams{
		ID:          int32(id),
		Status:      "approved",
		ReviewedBy:  &adminUserID,
		ReviewNotes: &req.ReviewNotes,
	})
	if err != nil {
		slog.Error("failed to update correction request status",
			"error", err,
			"request_id", id)
		RespondInternalError(w, r, "Failed to update request status")
		return
	}

	slog.Info("correction request approved",
		"request_id", id,
		"locality_id", localityID,
		"admin_id", adminUserID)

	// Log admin action with diff
	_ = h.activityService.LogActionWithDiff(
		ctx,
		services.ActionAdminCorrectionApprove,
		services.ConceptAdmin,
		"correction_request",
		idStr,
		"",
		&services.ActionDiff{
			Old: map[string]interface{}{
				"status": "pending",
			},
			New: map[string]interface{}{
				"status":       "approved",
				"approved_by":  adminUserID,
				"review_notes": req.ReviewNotes,
			},
		},
		services.ExtractActionContext(r),
	)

	// Send approval email in background
	if h.emailService != nil && h.emailService.IsEnabled() {
		go func() {
			// Use context.WithoutCancel to prevent cancellation when HTTP response is sent
			bgCtx := context.WithoutCancel(ctx)
			locality, err := h.db.Queries.GetLocalityByID(bgCtx, localityID)
			if err != nil {
				slog.Error("failed to get locality for email", "error", err, "locality_id", localityID)
				return
			}

			err = h.emailService.SendCorrectionApproved(
				correctionReq.RequesterEmail,
				locality.Name,
				req.ReviewNotes,
			)
			if err != nil {
				slog.Error("failed to send approval email", "error", err, "to", correctionReq.RequesterEmail)
			}
		}()
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"status":  "approved",
		"message": "Correction request approved and locality data updated",
	})
}

// AdminRejectCorrectionRequest rejects a correction request
// POST /api/v1/admin/correction-requests/{id}/reject
func (h *Handlers) AdminRejectCorrectionRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Admin context
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
		ReviewNotes string `json:"review_notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// 4. Validate
	if req.ReviewNotes == "" {
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

	// 5. Update request status (no locality update for rejection)
	err = h.db.Queries.UpdateCorrectionRequestStatus(ctx, sqlcgen.UpdateCorrectionRequestStatusParams{
		ID:          int32(id),
		Status:      "rejected",
		ReviewedBy:  &adminUserID,
		ReviewNotes: &req.ReviewNotes,
	})
	if err != nil {
		slog.Error("failed to update correction request status",
			"error", err,
			"request_id", id)
		RespondInternalError(w, r, "Failed to update request status")
		return
	}

	rejLocalityID := int32(0)
	if correctionReq.LocalityID != nil {
		rejLocalityID = *correctionReq.LocalityID
	}
	slog.Info("correction request rejected",
		"request_id", id,
		"locality_id", rejLocalityID,
		"admin_id", adminUserID)

	// Log admin action with diff
	_ = h.activityService.LogActionWithDiff(
		ctx,
		services.ActionAdminCorrectionReject,
		services.ConceptAdmin,
		"correction_request",
		idStr,
		"",
		&services.ActionDiff{
			Old: map[string]interface{}{
				"status": "pending",
			},
			New: map[string]interface{}{
				"status":           "rejected",
				"rejection_reason": req.ReviewNotes,
				"rejected_by":      adminUserID,
			},
		},
		services.ExtractActionContext(r),
	)

	// Send rejection email in background
	if h.emailService != nil && h.emailService.IsEnabled() {
		go func() {
			// Use context.WithoutCancel to prevent cancellation when HTTP response is sent
			bgCtx := context.WithoutCancel(ctx)
			locality, err := h.db.Queries.GetLocalityByID(bgCtx, rejLocalityID)
			if err != nil {
				slog.Error("failed to get locality for email", "error", err, "locality_id", rejLocalityID)
				return
			}

			err = h.emailService.SendCorrectionRejected(
				correctionReq.RequesterEmail,
				locality.Name,
				req.ReviewNotes,
			)
			if err != nil {
				slog.Error("failed to send rejection email", "error", err, "to", correctionReq.RequesterEmail)
			}
		}()
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"status":  "rejected",
		"message": "Correction request rejected",
	})
}

// AdminUpdateLocality allows admin to directly update locality data without a correction request
// PUT /api/v1/admin/localities/{localityId}
func (h *Handlers) AdminUpdateLocality(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Admin context
	adminUserID := middleware.GetUserID(ctx)
	if adminUserID == "" {
		RespondUnauthorized(w, r, "Admin authentication required")
		return
	}

	// 2. URL params
	localityIDStr := chi.URLParam(r, "localityId")
	localityID, err := strconv.ParseInt(localityIDStr, 10, 64)
	if err != nil {
		RespondBadRequest(w, r, "Invalid locality ID")
		return
	}

	// 3. Parse body
	var req struct {
		Latitude  *float64 `json:"latitude"`
		Longitude *float64 `json:"longitude"`
		Elevation *int32   `json:"elevation"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// 4. Validate
	if req.Latitude == nil && req.Longitude == nil && req.Elevation == nil {
		RespondValidationError(w, r, "At least one field must be provided", map[string]string{
			"fields": "At least one of latitude, longitude, or elevation must be provided",
		})
		return
	}

	// Validate ranges
	if req.Latitude != nil && (*req.Latitude < -90 || *req.Latitude > 90) {
		RespondValidationError(w, r, "Latitude must be between -90 and 90", map[string]string{
			"latitude": "Latitude must be between -90 and 90",
		})
		return
	}

	if req.Longitude != nil && (*req.Longitude < -180 || *req.Longitude > 180) {
		RespondValidationError(w, r, "Longitude must be between -180 and 180", map[string]string{
			"longitude": "Longitude must be between -180 and 180",
		})
		return
	}

	// 5. Apply admin overrides (highest system-wide priority)
	// Apply coordinate override if lat/lng provided
	if req.Latitude != nil && req.Longitude != nil {
		reason := "Admin direct update"
		_, err = h.db.Queries.CreateAdminLocationOverride(ctx, sqlcgen.CreateAdminLocationOverrideParams{
			LocalityID: int32(localityID),
			Latitude:   *req.Latitude,
			Longitude:  *req.Longitude,
			Reason:     &reason,
			CreatedBy:  &adminUserID,
		})
		if err != nil {
			slog.Error("failed to update locality location",
				"error", err,
				"locality_id", localityID,
				"admin_id", adminUserID)
			RespondInternalError(w, r, "Failed to update locality location")
			return
		}
	}

	// Apply elevation override if elevation provided
	if req.Elevation != nil {
		reason := "Admin direct update"
		_, err = h.db.Queries.CreateAdminElevationOverride(ctx, sqlcgen.CreateAdminElevationOverrideParams{
			LocalityID: int32(localityID),
			ElevationM: *req.Elevation,
			Reason:     &reason,
			CreatedBy:  &adminUserID,
		})
		if err != nil {
			slog.Error("failed to update locality elevation",
				"error", err,
				"locality_id", localityID,
				"admin_id", adminUserID)
			RespondInternalError(w, r, "Failed to update locality elevation")
			return
		}
	}

	slog.Info("locality updated by admin",
		"locality_id", localityID,
		"admin_id", adminUserID)

	// Log admin audit event
	changesAfter := map[string]interface{}{}
	if req.Latitude != nil {
		changesAfter["latitude"] = *req.Latitude
	}
	if req.Longitude != nil {
		changesAfter["longitude"] = *req.Longitude
	}
	if req.Elevation != nil {
		changesAfter["elevation"] = *req.Elevation
	}
	_ = h.activityService.LogAdminAction(ctx, r, services.AdminAuditParams{
		ActionType:   services.ActionAdminLocalityUpdate,
		ResourceType: "locality",
		ResourceID:   localityIDStr,
		ChangesAfter: changesAfter,
		Severity:     services.SeverityInfo,
		Status:       "success",
	})

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"status":  "updated",
		"message": "Locality data updated successfully",
	})
}
