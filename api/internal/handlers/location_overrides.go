// File: location_overrides.go
// Purpose: Publisher location overrides CRUD - allows publishers to override locality coordinates/elevation
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
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/models"
	"github.com/jcom-dev/zmanim/internal/services"
)

// CreateLocationOverride creates a new location override for a locality
//
//	@Summary		Create location override
//	@Description	Creates a publisher-specific override for locality coordinates or elevation
//	@Tags			Location Overrides
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string												true	"Publisher ID"
//	@Param			localityId		path		int													true	"Locality ID"
//	@Param			request			body		models.LocationOverrideCreateRequest				true	"Override data"
//	@Success		201				{object}	APIResponse{data=models.PublisherLocationOverride}	"Created override"
//	@Failure		400				{object}	APIResponse{error=APIError}							"Invalid request"
//	@Failure		401				{object}	APIResponse{error=APIError}							"Unauthorized"
//	@Failure		409				{object}	APIResponse{error=APIError}							"Override already exists for this locality"
//	@Failure		500				{object}	APIResponse{error=APIError}							"Internal server error"
//	@Router			/publisher/localities/{localityId}/override [post]
func (h *Handlers) CreateLocationOverride(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. Extract URL params
	localityIDStr := chi.URLParam(r, "localityId")
	localityID, err := strconv.ParseInt(localityIDStr, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid locality ID")
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

	// Check if location override already exists for this publisher + locality
	localityIDInt32 := int32(localityID)
	existing, err := h.db.Queries.GetPublisherLocationOverrideByLocality(ctx, sqlcgen.GetPublisherLocationOverrideByLocalityParams{
		PublisherID: &publisherIDInt,
		LocalityID:  localityIDInt32,
	})
	if err == nil && existing.ID > 0 {
		RespondConflict(w, r, "Location override already exists for this locality. Use PUT to update.")
		return
	}

	// 5. SQLc queries - create location and elevation overrides
	// Location override (lat/long)
	params := sqlcgen.CreatePublisherLocationOverrideParams{
		LocalityID:  localityIDInt32,
		PublisherID: publisherIDInt,
		Latitude:    *req.OverrideLatitude,
		Longitude:   *req.OverrideLongitude,
		Reason:      toStringPtr(req.Reason),
	}

	override, err := h.db.Queries.CreatePublisherLocationOverride(ctx, params)
	if err != nil {
		slog.Error("failed to create location override",
			"error", err,
			"publisher_id", pc.PublisherID,
			"locality_id", localityID)
		RespondInternalError(w, r, "Failed to create location override")
		return
	}

	// Elevation override (if provided)
	var elevationValue *int
	if req.OverrideElevation != nil {
		// Check if elevation override already exists
		existingElev, err := h.db.Queries.GetPublisherElevationOverrideByLocality(ctx, sqlcgen.GetPublisherElevationOverrideByLocalityParams{
			PublisherID: &publisherIDInt,
			LocalityID:  localityIDInt32,
		})
		if err == nil && existingElev.ID > 0 {
			// Update existing elevation override
			_, err = h.db.Queries.UpdateLocalityElevationOverride(ctx, sqlcgen.UpdateLocalityElevationOverrideParams{
				ID:         existingElev.ID,
				ElevationM: int32(*req.OverrideElevation),
				Reason:     toStringPtr(req.Reason),
			})
			if err != nil {
				slog.Warn("failed to update elevation override",
					"error", err,
					"publisher_id", pc.PublisherID,
					"locality_id", localityID)
			}
		} else {
			// Create new elevation override
			_, err = h.db.Queries.CreatePublisherElevationOverride(ctx, sqlcgen.CreatePublisherElevationOverrideParams{
				LocalityID:  localityIDInt32,
				PublisherID: publisherIDInt,
				ElevationM:  int32(*req.OverrideElevation),
				Reason:      toStringPtr(req.Reason),
			})
			if err != nil {
				slog.Warn("failed to create elevation override",
					"error", err,
					"publisher_id", pc.PublisherID,
					"locality_id", localityID)
			}
		}
		elevationValue = req.OverrideElevation
	}

	if h.cache != nil {
		if err := h.cache.InvalidateZmanimForLocality(ctx, pc.PublisherID, localityIDStr); err != nil {
			slog.Warn("failed to invalidate cache after location override creation",
				"error", err,
				"publisher_id", pc.PublisherID,
				"locality_id", localityIDStr,
			)
		}
	}

	// Log location override creation
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:   services.ActionLocationOverrideCreated,
		ResourceType: "location_override",
		ResourceID:   int32ToString(override.ID),
		ResourceName: localityIDStr,
		ChangesAfter: map[string]interface{}{
			"locality_id":        localityID,
			"override_latitude":  req.OverrideLatitude,
			"override_longitude": req.OverrideLongitude,
			"override_elevation": elevationValue,
			"reason":             req.Reason,
		},
		Status: AuditStatusSuccess,
	})

	// 6. Respond
	result := locationOverrideRowToModel(override, "", "", elevationValue)
	RespondJSON(w, r, http.StatusCreated, result)
}

// GetPublisherLocationOverrides returns all location overrides for the authenticated publisher
//
//	@Summary		Get publisher location overrides
//	@Description	Returns all location overrides configured for the authenticated publisher
//	@Tags			Location Overrides
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string													true	"Publisher ID"
//	@Success		200				{object}	APIResponse{data=models.LocationOverridesListResponse}	"List of overrides"
//	@Failure		401				{object}	APIResponse{error=APIError}								"Unauthorized"
//	@Failure		500				{object}	APIResponse{error=APIError}								"Internal server error"
//	@Router			/publisher/location-overrides [get]
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

	// 5. SQLc queries - fetch location and elevation overrides
	rows, err := h.db.Queries.GetPublisherLocationOverridesNew(ctx, &publisherIDInt)
	if err != nil {
		slog.Error("failed to fetch location overrides",
			"error", err,
			"publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to fetch location overrides")
		return
	}

	// Also fetch elevation overrides to merge
	elevRows, err := h.db.Queries.GetPublisherElevationOverrides(ctx, &publisherIDInt)
	if err != nil {
		slog.Warn("failed to fetch elevation overrides",
			"error", err,
			"publisher_id", pc.PublisherID)
	}

	// Build elevation map by locality_id
	elevationByLocality := make(map[int32]int32)
	for _, elev := range elevRows {
		elevationByLocality[elev.LocalityID] = elev.ElevationM
	}

	overrides := make([]models.PublisherLocationOverride, 0, len(rows))
	for _, row := range rows {
		override := models.PublisherLocationOverride{
			ID:                int(row.ID),
			PublisherID:       int(publisherIDInt),
			LocalityID:        int(row.LocalityID),
			LocalityName:      row.LocalityName,
			CountryName:       row.CountryName,
			OverrideLatitude:  &row.Latitude,
			OverrideLongitude: &row.Longitude,
			Reason:            derefString(row.Reason),
			CreatedAt:         row.CreatedAt.Time,
			UpdatedAt:         row.UpdatedAt.Time,
		}
		// Add elevation if we have an override for this locality
		if elev, ok := elevationByLocality[row.LocalityID]; ok {
			elevInt := int(elev)
			override.OverrideElevation = &elevInt
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
//
//	@Summary		Update location override
//	@Description	Updates an existing publisher location override
//	@Tags			Location Overrides
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string												true	"Publisher ID"
//	@Param			id				path		int													true	"Override ID"
//	@Param			request			body		models.LocationOverrideUpdateRequest				true	"Updated override data"
//	@Success		200				{object}	APIResponse{data=models.PublisherLocationOverride}	"Updated override"
//	@Failure		400				{object}	APIResponse{error=APIError}							"Invalid request"
//	@Failure		401				{object}	APIResponse{error=APIError}							"Unauthorized"
//	@Failure		403				{object}	APIResponse{error=APIError}							"Forbidden - override belongs to another publisher"
//	@Failure		404				{object}	APIResponse{error=APIError}							"Override not found"
//	@Failure		500				{object}	APIResponse{error=APIError}							"Internal server error"
//	@Router			/publisher/location-overrides/{id} [put]
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

	// Verify ownership - use new query
	existing, err := h.db.Queries.GetLocalityLocationOverrideByID(ctx, int32(id))
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

	// Check ownership - publisher_id in new schema
	if existing.PublisherID == nil || *existing.PublisherID != publisherIDInt {
		RespondForbidden(w, r, "You do not have permission to modify this override")
		return
	}

	// 5. SQLc queries - update location and elevation overrides
	params := sqlcgen.UpdateLocalityLocationOverrideParams{
		ID:        int32(id),
		Latitude:  *req.OverrideLatitude,
		Longitude: *req.OverrideLongitude,
		Reason:    toStringPtr(req.Reason),
	}

	override, err := h.db.Queries.UpdateLocalityLocationOverride(ctx, params)
	if err != nil {
		slog.Error("failed to update location override",
			"error", err,
			"override_id", id)
		RespondInternalError(w, r, "Failed to update location override")
		return
	}

	// Elevation override (if provided)
	var elevationValue *int
	if req.OverrideElevation != nil {
		// Check if elevation override already exists
		existingElev, err := h.db.Queries.GetPublisherElevationOverrideByLocality(ctx, sqlcgen.GetPublisherElevationOverrideByLocalityParams{
			PublisherID: &publisherIDInt,
			LocalityID:  existing.LocalityID,
		})
		if err == nil && existingElev.ID > 0 {
			// Update existing elevation override
			_, err = h.db.Queries.UpdateLocalityElevationOverride(ctx, sqlcgen.UpdateLocalityElevationOverrideParams{
				ID:         existingElev.ID,
				ElevationM: int32(*req.OverrideElevation),
				Reason:     toStringPtr(req.Reason),
			})
			if err != nil {
				slog.Warn("failed to update elevation override",
					"error", err,
					"publisher_id", pc.PublisherID,
					"locality_id", existing.LocalityID)
			}
		} else {
			// Create new elevation override
			_, err = h.db.Queries.CreatePublisherElevationOverride(ctx, sqlcgen.CreatePublisherElevationOverrideParams{
				LocalityID:  existing.LocalityID,
				PublisherID: publisherIDInt,
				ElevationM:  int32(*req.OverrideElevation),
				Reason:      toStringPtr(req.Reason),
			})
			if err != nil {
				slog.Warn("failed to create elevation override",
					"error", err,
					"publisher_id", pc.PublisherID,
					"locality_id", existing.LocalityID)
			}
		}
		elevationValue = req.OverrideElevation
	}

	if h.cache != nil {
		localityIDStr := strconv.FormatInt(int64(existing.LocalityID), 10)
		if err := h.cache.InvalidateZmanimForLocality(ctx, pc.PublisherID, localityIDStr); err != nil {
			slog.Warn("failed to invalidate cache after location override update",
				"error", err,
				"publisher_id", pc.PublisherID,
				"locality_id", localityIDStr,
			)
		}
	}

	// Log location override update
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:   services.ActionLocationOverrideUpdated,
		ResourceType: "location_override",
		ResourceID:   idStr,
		ResourceName: strconv.FormatInt(int64(existing.LocalityID), 10),
		ChangesBefore: map[string]interface{}{
			"latitude":  existing.Latitude,
			"longitude": existing.Longitude,
		},
		ChangesAfter: map[string]interface{}{
			"latitude":  req.OverrideLatitude,
			"longitude": req.OverrideLongitude,
			"elevation": elevationValue,
			"reason":    req.Reason,
		},
		Status: AuditStatusSuccess,
	})

	// 6. Respond
	result := updateOverrideRowToModel(override, "", "", elevationValue)
	RespondJSON(w, r, http.StatusOK, result)
}

// DeleteLocationOverride deletes a location override
//
//	@Summary		Delete location override
//	@Description	Deletes a publisher location override
//	@Tags			Location Overrides
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string								true	"Publisher ID"
//	@Param			id				path		int									true	"Override ID"
//	@Success		200				{object}	APIResponse{data=map[string]string}	"Delete confirmation"
//	@Failure		400				{object}	APIResponse{error=APIError}			"Invalid request"
//	@Failure		401				{object}	APIResponse{error=APIError}			"Unauthorized"
//	@Failure		403				{object}	APIResponse{error=APIError}			"Forbidden - override belongs to another publisher"
//	@Failure		404				{object}	APIResponse{error=APIError}			"Override not found"
//	@Failure		500				{object}	APIResponse{error=APIError}			"Internal server error"
//	@Router			/publisher/location-overrides/{id} [delete]
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

	// Verify ownership - use new query
	existing, err := h.db.Queries.GetLocalityLocationOverrideByID(ctx, int32(id))
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

	// Check ownership - publisher_id in new schema
	if existing.PublisherID == nil || *existing.PublisherID != publisherIDInt {
		RespondForbidden(w, r, "You do not have permission to delete this override")
		return
	}

	// 5. SQLc queries - delete location and elevation overrides
	if err := h.db.Queries.DeleteLocalityLocationOverride(ctx, int32(id)); err != nil {
		slog.Error("failed to delete location override",
			"error", err,
			"override_id", id)
		RespondInternalError(w, r, "Failed to delete location override")
		return
	}

	// Also delete elevation override if it exists
	existingElev, err := h.db.Queries.GetPublisherElevationOverrideByLocality(ctx, sqlcgen.GetPublisherElevationOverrideByLocalityParams{
		PublisherID: &publisherIDInt,
		LocalityID:  existing.LocalityID,
	})
	if err == nil && existingElev.ID > 0 {
		if err := h.db.Queries.DeleteLocalityElevationOverride(ctx, existingElev.ID); err != nil {
			slog.Warn("failed to delete elevation override",
				"error", err,
				"publisher_id", pc.PublisherID,
				"locality_id", existing.LocalityID)
		}
	}

	if h.cache != nil {
		localityIDStr := strconv.FormatInt(int64(existing.LocalityID), 10)
		if err := h.cache.InvalidateZmanimForLocality(ctx, pc.PublisherID, localityIDStr); err != nil {
			slog.Warn("failed to invalidate cache after location override deletion",
				"error", err,
				"publisher_id", pc.PublisherID,
				"locality_id", localityIDStr,
			)
		}
	}

	// Log location override deletion
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:   services.ActionLocationOverrideDeleted,
		ResourceType: "location_override",
		ResourceID:   idStr,
		ResourceName: strconv.FormatInt(int64(existing.LocalityID), 10),
		ChangesBefore: map[string]interface{}{
			"locality_id": existing.LocalityID,
			"latitude":    existing.Latitude,
			"longitude":   existing.Longitude,
		},
		Status: AuditStatusSuccess,
	})

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

// locationOverrideRowToModel converts a CreatePublisherLocationOverrideRow to the API model
func locationOverrideRowToModel(row sqlcgen.CreatePublisherLocationOverrideRow, localityName, countryName string, elevation *int) models.PublisherLocationOverride {
	publisherID := 0
	if row.PublisherID != nil {
		publisherID = int(*row.PublisherID)
	}
	return models.PublisherLocationOverride{
		ID:                int(row.ID),
		PublisherID:       publisherID,
		LocalityID:        int(row.LocalityID),
		LocalityName:      localityName,
		CountryName:       countryName,
		OverrideLatitude:  &row.Latitude,
		OverrideLongitude: &row.Longitude,
		OverrideElevation: elevation,
		Reason:            derefString(row.Reason),
		CreatedAt:         row.CreatedAt.Time,
		UpdatedAt:         row.UpdatedAt.Time,
	}
}

// updateOverrideRowToModel converts an UpdateLocalityLocationOverrideRow to the API model
func updateOverrideRowToModel(row sqlcgen.UpdateLocalityLocationOverrideRow, localityName, countryName string, elevation *int) models.PublisherLocationOverride {
	publisherID := 0
	if row.PublisherID != nil {
		publisherID = int(*row.PublisherID)
	}
	return models.PublisherLocationOverride{
		ID:                int(row.ID),
		PublisherID:       publisherID,
		LocalityID:        int(row.LocalityID),
		LocalityName:      localityName,
		CountryName:       countryName,
		OverrideLatitude:  &row.Latitude,
		OverrideLongitude: &row.Longitude,
		OverrideElevation: elevation,
		Reason:            derefString(row.Reason),
		CreatedAt:         row.CreatedAt.Time,
		UpdatedAt:         row.UpdatedAt.Time,
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

// pgtypeInt4 creates a pgtype.Int4 from an int32
func pgtypeInt4(v int32) pgtype.Int4 {
	return pgtype.Int4{Int32: v, Valid: true}
}
