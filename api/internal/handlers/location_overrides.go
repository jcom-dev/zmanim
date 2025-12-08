// File: location_overrides.go
// Purpose: Publisher location overrides CRUD - allows publishers to override city coordinates/elevation
// Pattern: 6-step-handler
// Dependencies: Queries: location_overrides.sql
// Compliance: Check docs/adr/ for pattern rationale

package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim-lab/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim-lab/internal/models"
)

// CreateLocationOverride creates a new location override for a city
// @Summary Create location override
// @Description Creates a publisher-specific override for city coordinates or elevation
// @Tags Location Overrides
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param X-Publisher-Id header string true "Publisher ID"
// @Param cityId path int true "City ID"
// @Param request body models.LocationOverrideCreateRequest true "Override data"
// @Success 201 {object} APIResponse{data=models.PublisherLocationOverride} "Created override"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid request"
// @Failure 401 {object} APIResponse{error=APIError} "Unauthorized"
// @Failure 409 {object} APIResponse{error=APIError} "Override already exists for this city"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /publisher/locations/{cityId}/override [post]
func (h *Handlers) CreateLocationOverride(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. Extract URL params
	cityIDStr := chi.URLParam(r, "cityId")
	cityID, err := strconv.ParseInt(cityIDStr, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid city ID")
		return
	}

	// 3. Parse body
	var req models.LocationOverrideCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// 4. Validate
	if err := validateLocationOverride(req); err != nil {
		RespondBadRequest(w, r, err.Error())
		return
	}

	// Convert publisher ID to int32
	publisherIDInt, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Check if override already exists
	existing, err := h.db.Queries.GetLocationOverrideByCityID(ctx, sqlcgen.GetLocationOverrideByCityIDParams{
		PublisherID: publisherIDInt,
		CityID:      int32(cityID),
	})
	if err == nil && existing.ID > 0 {
		RespondConflict(w, r, "Location override already exists for this city. Use PUT to update.")
		return
	}

	// 5. SQLc query
	params := sqlcgen.CreateLocationOverrideParams{
		PublisherID:       publisherIDInt,
		CityID:            int32(cityID),
		OverrideLatitude:  req.OverrideLatitude,
		OverrideLongitude: req.OverrideLongitude,
		OverrideElevation: toInt32Ptr(req.OverrideElevation),
		Reason:            toStringPtr(req.Reason),
	}

	override, err := h.db.Queries.CreateLocationOverride(ctx, params)
	if err != nil {
		slog.Error("failed to create location override",
			"error", err,
			"publisher_id", pc.PublisherID,
			"city_id", cityID)
		RespondInternalError(w, r, "Failed to create location override")
		return
	}

	// 6. Respond
	result := overrideRowToModel(override, "", "")
	RespondJSON(w, r, http.StatusCreated, result)
}

// GetPublisherLocationOverrides returns all location overrides for the authenticated publisher
// @Summary Get publisher location overrides
// @Description Returns all location overrides configured for the authenticated publisher
// @Tags Location Overrides
// @Produce json
// @Security BearerAuth
// @Param X-Publisher-Id header string true "Publisher ID"
// @Success 200 {object} APIResponse{data=models.LocationOverridesListResponse} "List of overrides"
// @Failure 401 {object} APIResponse{error=APIError} "Unauthorized"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /publisher/location-overrides [get]
func (h *Handlers) GetPublisherLocationOverrides(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// Convert publisher ID to int32
	publisherIDInt, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// 5. SQLc query
	rows, err := h.db.Queries.GetPublisherLocationOverrides(ctx, publisherIDInt)
	if err != nil {
		slog.Error("failed to fetch location overrides",
			"error", err,
			"publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to fetch location overrides")
		return
	}

	overrides := make([]models.PublisherLocationOverride, 0, len(rows))
	for _, row := range rows {
		override := models.PublisherLocationOverride{
			ID:                int(row.ID),
			PublisherID:       int(row.PublisherID),
			CityID:            int(row.CityID),
			CityName:          row.CityName,
			CountryName:       row.CountryName,
			OverrideLatitude:  row.OverrideLatitude,
			OverrideLongitude: row.OverrideLongitude,
			OverrideElevation: fromInt32Ptr(row.OverrideElevation),
			Reason:            derefString(row.Reason),
			CreatedAt:         row.CreatedAt,
			UpdatedAt:         row.UpdatedAt,
		}
		overrides = append(overrides, override)
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, models.LocationOverridesListResponse{
		Overrides: overrides,
		Total:     len(overrides),
	})
}

// UpdateLocationOverride updates an existing location override
// @Summary Update location override
// @Description Updates an existing publisher location override
// @Tags Location Overrides
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param X-Publisher-Id header string true "Publisher ID"
// @Param id path int true "Override ID"
// @Param request body models.LocationOverrideUpdateRequest true "Updated override data"
// @Success 200 {object} APIResponse{data=models.PublisherLocationOverride} "Updated override"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid request"
// @Failure 401 {object} APIResponse{error=APIError} "Unauthorized"
// @Failure 403 {object} APIResponse{error=APIError} "Forbidden - override belongs to another publisher"
// @Failure 404 {object} APIResponse{error=APIError} "Override not found"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /publisher/location-overrides/{id} [put]
func (h *Handlers) UpdateLocationOverride(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. Extract URL params
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid override ID")
		return
	}

	// 3. Parse body
	var req models.LocationOverrideUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// 4. Validate
	if err := validateLocationOverride(req); err != nil {
		RespondBadRequest(w, r, err.Error())
		return
	}

	// Convert publisher ID to int32
	publisherIDInt, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Verify ownership
	existing, err := h.db.Queries.GetLocationOverrideByID(ctx, int32(id))
	if err != nil {
		if err == sql.ErrNoRows {
			RespondNotFound(w, r, "Location override not found")
		} else {
			slog.Error("failed to fetch location override",
				"error", err,
				"override_id", id)
			RespondInternalError(w, r, "Failed to fetch location override")
		}
		return
	}

	if existing.PublisherID != publisherIDInt {
		RespondForbidden(w, r, "You do not have permission to modify this override")
		return
	}

	// 5. SQLc query
	params := sqlcgen.UpdateLocationOverrideParams{
		ID:                int32(id),
		OverrideLatitude:  req.OverrideLatitude,
		OverrideLongitude: req.OverrideLongitude,
		OverrideElevation: toInt32Ptr(req.OverrideElevation),
		Reason:            toStringPtr(req.Reason),
	}

	override, err := h.db.Queries.UpdateLocationOverride(ctx, params)
	if err != nil {
		slog.Error("failed to update location override",
			"error", err,
			"override_id", id)
		RespondInternalError(w, r, "Failed to update location override")
		return
	}

	// 6. Respond
	result := overrideRowToModel(override, "", "")
	RespondJSON(w, r, http.StatusOK, result)
}

// DeleteLocationOverride deletes a location override
// @Summary Delete location override
// @Description Deletes a publisher location override
// @Tags Location Overrides
// @Produce json
// @Security BearerAuth
// @Param X-Publisher-Id header string true "Publisher ID"
// @Param id path int true "Override ID"
// @Success 200 {object} APIResponse{data=map[string]string} "Delete confirmation"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid request"
// @Failure 401 {object} APIResponse{error=APIError} "Unauthorized"
// @Failure 403 {object} APIResponse{error=APIError} "Forbidden - override belongs to another publisher"
// @Failure 404 {object} APIResponse{error=APIError} "Override not found"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /publisher/location-overrides/{id} [delete]
func (h *Handlers) DeleteLocationOverride(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. Extract URL params
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid override ID")
		return
	}

	// Convert publisher ID to int32
	publisherIDInt, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Verify ownership
	existing, err := h.db.Queries.GetLocationOverrideByID(ctx, int32(id))
	if err != nil {
		if err == sql.ErrNoRows {
			RespondNotFound(w, r, "Location override not found")
		} else {
			slog.Error("failed to fetch location override",
				"error", err,
				"override_id", id)
			RespondInternalError(w, r, "Failed to fetch location override")
		}
		return
	}

	if existing.PublisherID != publisherIDInt {
		RespondForbidden(w, r, "You do not have permission to delete this override")
		return
	}

	// 5. SQLc query
	if err := h.db.Queries.DeleteLocationOverride(ctx, int32(id)); err != nil {
		slog.Error("failed to delete location override",
			"error", err,
			"override_id", id)
		RespondInternalError(w, r, "Failed to delete location override")
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, map[string]string{
		"message": "Location override deleted successfully",
	})
}

// Helper functions

func validateLocationOverride(req interface{}) error {
	switch v := req.(type) {
	case models.LocationOverrideCreateRequest:
		return validateOverrideValues(v.OverrideLatitude, v.OverrideLongitude, v.OverrideElevation)
	case models.LocationOverrideUpdateRequest:
		return validateOverrideValues(v.OverrideLatitude, v.OverrideLongitude, v.OverrideElevation)
	}
	return nil
}

func validateOverrideValues(lat, lon *float64, elev *int) error {
	if lat != nil {
		if *lat < -90 || *lat > 90 {
			return errors.New("latitude must be between -90 and 90")
		}
	}
	if lon != nil {
		if *lon < -180 || *lon > 180 {
			return errors.New("longitude must be between -180 and 180")
		}
	}
	// Elevation can be negative (below sea level), so no validation needed
	return nil
}

func overrideRowToModel(row sqlcgen.PublisherLocationOverride, cityName, countryName string) models.PublisherLocationOverride {
	return models.PublisherLocationOverride{
		ID:                int(row.ID),
		PublisherID:       int(row.PublisherID),
		CityID:            int(row.CityID),
		CityName:          cityName,
		CountryName:       countryName,
		OverrideLatitude:  row.OverrideLatitude,
		OverrideLongitude: row.OverrideLongitude,
		OverrideElevation: fromInt32Ptr(row.OverrideElevation),
		Reason:            derefString(row.Reason),
		CreatedAt:         row.CreatedAt,
		UpdatedAt:         row.UpdatedAt,
	}
}

// Helper functions for type conversions
func toInt32Ptr(v *int) *int32 {
	if v == nil {
		return nil
	}
	val := int32(*v)
	return &val
}

func fromInt32Ptr(v *int32) *int {
	if v == nil {
		return nil
	}
	val := int(*v)
	return &val
}

func derefString(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func toStringPtr(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}
