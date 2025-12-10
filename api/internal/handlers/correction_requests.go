// File: correction_requests.go
// Purpose: Publisher correction request handlers
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

// CreateCorrectionRequest creates a new city correction request
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
		CityID           int64    `json:"city_id"`
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
	if req.CityID == 0 {
		RespondValidationError(w, r, "City ID is required", map[string]string{"city_id": "City ID is required"})
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
	result, err := h.db.Queries.CreateCorrectionRequest(ctx, sqlcgen.CreateCorrectionRequestParams{
		CityID:            req.CityID,
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
			"city_id", req.CityID)
		RespondInternalError(w, r, "Failed to create correction request")
		return
	}

	slog.Info("correction request created",
		"request_id", result.ID,
		"publisher_id", pc.PublisherID,
		"city_id", req.CityID,
		"requester_email", requesterEmail)

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
