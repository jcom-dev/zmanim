// File: admin_corrections.go
// Purpose: Admin correction request handlers
// Pattern: 6-step handler pattern
// Story: 6.5 - Public Correction Requests

package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/middleware"
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

// AdminApproveCorrectionRequest approves a correction request and updates the city data
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

	// 5. Apply correction to geo_cities
	err = h.db.Queries.ApplyCityCorrection(ctx, sqlcgen.ApplyCityCorrectionParams{
		ID:                correctionReq.CityID,
		ProposedLatitude:  correctionReq.ProposedLatitude,
		ProposedLongitude: correctionReq.ProposedLongitude,
		ProposedElevation: correctionReq.ProposedElevation,
	})
	if err != nil {
		slog.Error("failed to apply city correction",
			"error", err,
			"request_id", id,
			"city_id", correctionReq.CityID)
		RespondInternalError(w, r, "Failed to apply correction")
		return
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
		"city_id", correctionReq.CityID,
		"admin_id", adminUserID)

	// Send approval email in background
	if h.emailService != nil && h.emailService.IsEnabled() {
		go func() {
			city, err := h.db.Queries.GetCityByID(ctx, int32(correctionReq.CityID))
			if err != nil {
				slog.Error("failed to get city for email", "error", err, "city_id", correctionReq.CityID)
				return
			}

			err = h.emailService.SendCorrectionApproved(
				correctionReq.RequesterEmail,
				city.Name,
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
		"message": "Correction request approved and city data updated",
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

	// 5. Update request status (no city update for rejection)
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

	slog.Info("correction request rejected",
		"request_id", id,
		"city_id", correctionReq.CityID,
		"admin_id", adminUserID)

	// Send rejection email in background
	if h.emailService != nil && h.emailService.IsEnabled() {
		go func() {
			city, err := h.db.Queries.GetCityByID(ctx, int32(correctionReq.CityID))
			if err != nil {
				slog.Error("failed to get city for email", "error", err, "city_id", correctionReq.CityID)
				return
			}

			err = h.emailService.SendCorrectionRejected(
				correctionReq.RequesterEmail,
				city.Name,
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

// AdminUpdateCity allows admin to directly update city data without a correction request
// PUT /api/v1/admin/cities/{cityId}
func (h *Handlers) AdminUpdateCity(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Admin context
	adminUserID := middleware.GetUserID(ctx)
	if adminUserID == "" {
		RespondUnauthorized(w, r, "Admin authentication required")
		return
	}

	// 2. URL params
	cityIDStr := chi.URLParam(r, "cityId")
	cityID, err := strconv.ParseInt(cityIDStr, 10, 64)
	if err != nil {
		RespondBadRequest(w, r, "Invalid city ID")
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

	// 5. SQLc query
	err = h.db.Queries.AdminUpdateCity(ctx, sqlcgen.AdminUpdateCityParams{
		ID:        cityID,
		Latitude:  req.Latitude,
		Longitude: req.Longitude,
		Elevation: req.Elevation,
	})
	if err != nil {
		slog.Error("failed to update city",
			"error", err,
			"city_id", cityID,
			"admin_id", adminUserID)
		RespondInternalError(w, r, "Failed to update city")
		return
	}

	slog.Info("city updated by admin",
		"city_id", cityID,
		"admin_id", adminUserID)

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"status":  "updated",
		"message": "City data updated successfully",
	})
}
