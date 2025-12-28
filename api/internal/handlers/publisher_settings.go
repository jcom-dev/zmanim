// File: publisher_settings.go
// Purpose: Publisher calculation settings handlers
// Pattern: 6-step-handler
// Compliance: PublisherResolver:✓ SQLc:✓ slog:✓

package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/services"
)

// CalculationSettingsResponse represents the calculation settings for a publisher
type CalculationSettingsResponse struct {
	IgnoreElevation      bool   `json:"ignore_elevation"`
	TransliterationStyle string `json:"transliteration_style"`
}

// UpdateCalculationSettingsRequest represents a request to update calculation settings
type UpdateCalculationSettingsRequest struct {
	IgnoreElevation      bool   `json:"ignore_elevation"`
	TransliterationStyle string `json:"transliteration_style"`
}

// GetPublisherCalculationSettings returns the calculation settings for the current publisher
//
//	@Summary		Get calculation settings
//	@Description	Returns the calculation settings for the authenticated publisher
//	@Tags			Publisher
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string											false	"Publisher ID"
//	@Success		200				{object}	APIResponse{data=CalculationSettingsResponse}	"Calculation settings"
//	@Failure		401				{object}	APIResponse{error=APIError}						"Unauthorized"
//	@Failure		404				{object}	APIResponse{error=APIError}						"Publisher not found"
//	@Router			/publisher/settings/calculation [get]
func (h *Handlers) GetPublisherCalculationSettings(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. Convert publisher ID to int32
	publisherID, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// 3. Get calculation settings from database
	settings, err := h.db.Queries.GetPublisherCalculationSettings(ctx, publisherID)
	if err != nil {
		slog.Error("failed to get calculation settings", "error", err, "publisher_id", pc.PublisherID)
		RespondNotFound(w, r, "Publisher not found")
		return
	}

	// 4. Respond with settings
	RespondJSON(w, r, http.StatusOK, CalculationSettingsResponse{
		IgnoreElevation:      settings.IgnoreElevation,
		TransliterationStyle: settings.TransliterationStyle,
	})
}

// UpdatePublisherCalculationSettings updates the calculation settings for the current publisher
//
//	@Summary		Update calculation settings
//	@Description	Updates the calculation settings for the authenticated publisher
//	@Tags			Publisher
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string											false	"Publisher ID"
//	@Param			request			body		UpdateCalculationSettingsRequest				true	"Calculation settings"
//	@Success		200				{object}	APIResponse{data=CalculationSettingsResponse}	"Updated calculation settings"
//	@Failure		400				{object}	APIResponse{error=APIError}						"Invalid request"
//	@Failure		401				{object}	APIResponse{error=APIError}						"Unauthorized"
//	@Failure		404				{object}	APIResponse{error=APIError}						"Publisher not found"
//	@Router			/publisher/settings/calculation [put]
func (h *Handlers) UpdatePublisherCalculationSettings(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. Parse request body
	var req UpdateCalculationSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// 3. Validate transliteration style
	if req.TransliterationStyle != "" && req.TransliterationStyle != "ashkenazi" && req.TransliterationStyle != "sephardi" {
		RespondBadRequest(w, r, "Invalid transliteration style. Must be 'ashkenazi' or 'sephardi'")
		return
	}

	// 4. Convert publisher ID to int32
	publisherID, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// 5. Fetch existing settings for audit logging (before state)
	existing, err := h.db.Queries.GetPublisherCalculationSettings(ctx, publisherID)
	if err != nil {
		slog.Error("failed to get existing calculation settings", "error", err, "publisher_id", pc.PublisherID)
		RespondNotFound(w, r, "Publisher not found")
		return
	}

	// 6. Update calculation settings in database
	translitStyle := req.TransliterationStyle
	if translitStyle == "" {
		translitStyle = "ashkenazi"
	}
	updated, err := h.db.Queries.UpdatePublisherCalculationSettings(ctx, sqlcgen.UpdatePublisherCalculationSettingsParams{
		ID:                   publisherID,
		IgnoreElevation:      req.IgnoreElevation,
		TransliterationStyle: translitStyle,
	})
	if err != nil {
		slog.Error("failed to update calculation settings", "error", err, "publisher_id", pc.PublisherID)
		if err.Error() == "no rows in result set" {
			RespondNotFound(w, r, "Publisher not found")
			return
		}
		RespondInternalError(w, r, "Failed to update calculation settings")
		return
	}

	// 7. Invalidate cache - calculation settings affect results
	if h.cache != nil {
		if err := h.cache.InvalidatePublisherCache(ctx, pc.PublisherID); err != nil {
			slog.Warn("failed to invalidate cache after settings update", "error", err, "publisher_id", pc.PublisherID)
		}
	}

	// 8. Log audit event
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:   services.ActionSettingsCalculationUpdated,
		ResourceType: "calculation_settings",
		ResourceID:   pc.PublisherID,
		ChangesBefore: map[string]interface{}{
			"ignore_elevation":      existing.IgnoreElevation,
			"transliteration_style": existing.TransliterationStyle,
		},
		ChangesAfter: map[string]interface{}{
			"ignore_elevation":      updated.IgnoreElevation,
			"transliteration_style": updated.TransliterationStyle,
		},
		Status: AuditStatusSuccess,
	})

	// 9. Respond with updated settings
	RespondJSON(w, r, http.StatusOK, CalculationSettingsResponse{
		IgnoreElevation:      updated.IgnoreElevation,
		TransliterationStyle: updated.TransliterationStyle,
	})
}
