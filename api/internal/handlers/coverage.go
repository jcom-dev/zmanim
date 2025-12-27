// File: coverage.go
// Purpose: Publisher coverage area CRUD - manages geographic service areas
// Pattern: 6-step-handler
// Dependencies: Queries: coverage.sql, geo_boundaries.sql
// Frequency: high - 777 lines
// Compliance: Check docs/adr/ for pattern rationale

package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/models"
	"github.com/jcom-dev/zmanim/internal/services"
)

// GetRepresentativeLocalities returns one representative locality per coverage area for preview
//
//	@Summary		Get representative localities for coverage
//	@Description	Returns one representative locality per coverage area using ID-based joins. Used by Algorithm Editor.
//	@Tags			Coverage
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string												true	"Publisher ID"
//	@Success		200				{array}		sqlcgen.GetRepresentativeLocalitiesForCoverageRow	"List of representative localities"
//	@Failure		401				{object}	APIResponse{error=APIError}							"Unauthorized"
//	@Failure		404				{object}	APIResponse{error=APIError}							"Publisher not found"
//	@Failure		500				{object}	APIResponse{error=APIError}							"Internal server error"
//	@Router			/publisher/coverage/localities [get]
func (h *Handlers) GetRepresentativeLocalities(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	publisherIDInt, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	localities, err := h.db.Queries.GetRepresentativeLocalitiesForCoverage(ctx, publisherIDInt)
	if err != nil {
		slog.Error("failed to get representative localities", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to get localities")
		return
	}

	RespondJSON(w, r, http.StatusOK, localities)
}

// GetPublisherCoverage returns the current publisher's coverage areas
//
//	@Summary		Get publisher coverage areas
//	@Description	Returns all geographic coverage areas configured for the authenticated publisher
//	@Tags			Coverage
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string													true	"Publisher ID"
//	@Success		200				{object}	APIResponse{data=models.PublisherCoverageListResponse}	"List of coverage areas"
//	@Failure		401				{object}	APIResponse{error=APIError}								"Unauthorized"
//	@Failure		404				{object}	APIResponse{error=APIError}								"Publisher not found"
//	@Failure		500				{object}	APIResponse{error=APIError}								"Internal server error"
//	@Router			/publisher/coverage [get]
func (h *Handlers) GetPublisherCoverage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}

	// Convert publisher ID to int32
	publisherIDInt, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Get publisher's is_global status
	isGlobal, err := h.db.Queries.GetPublisherIsGlobal(ctx, publisherIDInt)
	if err != nil {
		slog.Error("failed to fetch is_global status", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to fetch publisher status")
		return
	}

	// If publisher is global, return empty coverage with message
	if isGlobal {
		RespondJSON(w, r, http.StatusOK, models.PublisherCoverageListResponse{
			IsGlobal: true,
			Coverage: []models.PublisherCoverage{},
			Total:    0,
			Message:  stringPtr("Publisher has global coverage - no regional restrictions"),
		})
		return
	}

	// Query coverage areas using SQLc
	rows, err := h.db.Queries.GetPublisherCoverage(ctx, publisherIDInt)
	if err != nil {
		slog.Error("failed to fetch coverage", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to fetch coverage areas")
		return
	}

	coverage := make([]models.PublisherCoverage, 0, len(rows))
	for _, row := range rows {
		c := coverageRowToModel(row)
		coverage = append(coverage, c)
	}

	RespondJSON(w, r, http.StatusOK, models.PublisherCoverageListResponse{
		IsGlobal: false,
		Coverage: coverage,
		Total:    len(coverage),
	})
}

// CreatePublisherCoverage adds a new coverage area for the publisher
//
//	@Summary		Create coverage area
//	@Description	Adds a new geographic coverage area (continent, country, region, or locality level)
//	@Tags			Coverage
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string										true	"Publisher ID"
//	@Param			request			body		models.PublisherCoverageCreateRequest		true	"Coverage area configuration"
//	@Success		201				{object}	APIResponse{data=models.PublisherCoverage}	"Created coverage area"
//	@Failure		400				{object}	APIResponse{error=APIError}					"Invalid request or duplicate coverage"
//	@Failure		401				{object}	APIResponse{error=APIError}					"Unauthorized"
//	@Failure		500				{object}	APIResponse{error=APIError}					"Internal server error"
//	@Router			/publisher/coverage [post]
func (h *Handlers) CreatePublisherCoverage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}

	// Convert publisher ID to int32
	publisherIDInt, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Check if publisher is global
	isGlobal, err := h.db.Queries.GetPublisherIsGlobal(ctx, publisherIDInt)
	if err != nil {
		slog.Error("Failed to check is_global status", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to check global status")
		return
	}
	if isGlobal {
		RespondBadRequest(w, r, "Cannot modify coverage for global publisher. Disable global coverage first.")
		return
	}

	// Parse request body
	var req models.PublisherCoverageCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Validate coverage level
	validLevels := map[string]bool{"continent": true, "country": true, "region": true, "locality": true}
	if !validLevels[req.CoverageLevel] {
		RespondBadRequest(w, r, "Invalid coverage_level: must be 'continent', 'country', 'region', or 'locality'")
		return
	}

	// Default priority
	priority := int32(5)
	if req.Priority != nil && *req.Priority >= 1 && *req.Priority <= 10 {
		priority = int32(*req.Priority)
	}

	var coverage models.PublisherCoverage

	// Create coverage based on level using appropriate SQLc query
	switch req.CoverageLevel {
	case "continent":
		if req.ContinentCode == nil || *req.ContinentCode == "" {
			RespondBadRequest(w, r, "continent_code is required for continent-level coverage")
			return
		}
		// Look up continent ID from code
		continent, err := h.db.Queries.GetContinentByCode(ctx, *req.ContinentCode)
		if err != nil {
			slog.Error("failed to find continent", "code", *req.ContinentCode, "error", err)
			RespondBadRequest(w, r, "Invalid continent code")
			return
		}
		continentID := continent.ID
		// Check for duplicate
		exists, _ := h.db.Queries.CheckDuplicateCoverageContinent(ctx, sqlcgen.CheckDuplicateCoverageContinentParams{
			PublisherID: publisherIDInt,
			ContinentID: &continentID,
		})
		if exists {
			RespondBadRequest(w, r, "Coverage already exists for this continent")
			return
		}
		row, err := h.db.Queries.CreateCoverageContinent(ctx, sqlcgen.CreateCoverageContinentParams{
			PublisherID: publisherIDInt,
			ContinentID: &continentID,
			Priority:    &priority,
			IsActive:    true,
		})
		if err != nil {
			slog.Error("failed to create continent coverage", "error", err)
			RespondInternalError(w, r, "Failed to create coverage")
			return
		}
		coverage = createCoverageContinentRowToModel(row)

	case "country":
		if req.CountryID == nil {
			RespondBadRequest(w, r, "country_id is required for country-level coverage")
			return
		}
		// Check for duplicate
		exists, _ := h.db.Queries.CheckDuplicateCoverageCountry(ctx, sqlcgen.CheckDuplicateCoverageCountryParams{
			PublisherID: publisherIDInt,
			CountryID:   req.CountryID,
		})
		if exists {
			RespondBadRequest(w, r, "Coverage already exists for this country")
			return
		}
		row, err := h.db.Queries.CreateCoverageCountry(ctx, sqlcgen.CreateCoverageCountryParams{
			PublisherID: publisherIDInt,
			CountryID:   req.CountryID,
			Priority:    &priority,
			IsActive:    true,
		})
		if err != nil {
			slog.Error("failed to create country coverage", "error", err)
			RespondInternalError(w, r, "Failed to create coverage")
			return
		}
		coverage = createCoverageCountryRowToModel(row)

	case "region":
		if req.RegionID == nil {
			RespondBadRequest(w, r, "region_id is required for region-level coverage")
			return
		}
		// Check for duplicate
		exists, _ := h.db.Queries.CheckDuplicateCoverageRegion(ctx, sqlcgen.CheckDuplicateCoverageRegionParams{
			PublisherID: publisherIDInt,
			RegionID:    req.RegionID,
		})
		if exists {
			RespondBadRequest(w, r, "Coverage already exists for this region")
			return
		}
		row, err := h.db.Queries.CreateCoverageRegion(ctx, sqlcgen.CreateCoverageRegionParams{
			PublisherID: publisherIDInt,
			RegionID:    req.RegionID,
			Priority:    &priority,
			IsActive:    true,
		})
		if err != nil {
			slog.Error("failed to create region coverage", "error", err)
			RespondInternalError(w, r, "Failed to create coverage")
			return
		}
		coverage = createCoverageRegionRowToModel(row)

	case "locality":
		if req.LocalityID == nil {
			RespondBadRequest(w, r, "locality_id is required for locality-level coverage")
			return
		}

		// Check for duplicate
		exists, _ := h.db.Queries.CheckDuplicateCoverageLocality(ctx, sqlcgen.CheckDuplicateCoverageLocalityParams{
			PublisherID: publisherIDInt,
			LocalityID:  req.LocalityID,
		})
		if exists {
			RespondBadRequest(w, r, "Coverage already exists for this locality")
			return
		}
		row, err := h.db.Queries.CreateCoverageLocality(ctx, sqlcgen.CreateCoverageLocalityParams{
			PublisherID: publisherIDInt,
			LocalityID:  req.LocalityID,
			Priority:    &priority,
			IsActive:    true,
		})
		if err != nil {
			slog.Error("failed to create locality coverage", "error", err)
			RespondInternalError(w, r, "Failed to create coverage")
			return
		}
		coverage = createCoverageLocalityRowToModel(row)
	}

	// Log coverage add activity
	metadata := map[string]interface{}{
		"coverage_id":    coverage.ID,
		"coverage_level": req.CoverageLevel,
		"priority":       priority,
	}
	if req.ContinentCode != nil {
		metadata["continent_code"] = *req.ContinentCode
	}
	if req.CountryID != nil {
		metadata["country_id"] = *req.CountryID
	}
	if req.RegionID != nil {
		metadata["region_id"] = *req.RegionID
	}
	if req.LocalityID != nil {
		metadata["locality_id"] = *req.LocalityID
	}

	_ = h.activityService.LogAction(
		ctx,
		services.ActionCoverageAdd,
		services.ConceptCoverage,
		"coverage",
		int32ToString(coverage.ID),
		pc.PublisherID,
		metadata,
	)

	if h.cache != nil {
		if err := h.cache.InvalidatePublisherCache(ctx, pc.PublisherID); err != nil {
			slog.Warn("failed to invalidate cache after coverage creation",
				"error", err,
				"publisher_id", pc.PublisherID,
			)
		}
	}

	RespondJSON(w, r, http.StatusCreated, coverage)
}

// UpdatePublisherCoverage updates a coverage area's priority or active status
//
//	@Summary		Update coverage area
//	@Description	Updates an existing coverage area's priority or active status
//	@Tags			Coverage
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string										true	"Publisher ID"
//	@Param			id				path		string										true	"Coverage area ID"
//	@Param			request			body		models.PublisherCoverageUpdateRequest		true	"Fields to update"
//	@Success		200				{object}	APIResponse{data=models.PublisherCoverage}	"Updated coverage area"
//	@Failure		400				{object}	APIResponse{error=APIError}					"Invalid request"
//	@Failure		401				{object}	APIResponse{error=APIError}					"Unauthorized"
//	@Failure		404				{object}	APIResponse{error=APIError}					"Coverage area not found"
//	@Failure		500				{object}	APIResponse{error=APIError}					"Internal server error"
//	@Router			/publisher/coverage/{id} [put]
func (h *Handlers) UpdatePublisherCoverage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	coverageID := chi.URLParam(r, "id")

	if coverageID == "" {
		RespondBadRequest(w, r, "Coverage ID is required")
		return
	}

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}

	// Convert IDs to int32
	coverageIDInt, err := stringToInt32(coverageID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid coverage ID")
		return
	}

	publisherIDInt, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Check if publisher is global
	isGlobal, err := h.db.Queries.GetPublisherIsGlobal(ctx, publisherIDInt)
	if err != nil {
		slog.Error("Failed to check is_global status", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to check global status")
		return
	}
	if isGlobal {
		RespondBadRequest(w, r, "Cannot modify coverage for global publisher. Disable global coverage first.")
		return
	}

	// Verify ownership by fetching the coverage
	existingCoverage, err := h.db.Queries.GetPublisherCoverageByID(ctx, coverageIDInt)
	if err != nil {
		RespondNotFound(w, r, "Coverage not found")
		return
	}
	if existingCoverage.PublisherID != publisherIDInt {
		RespondNotFound(w, r, "Coverage not found or not owned by publisher")
		return
	}

	// Parse request body
	var req models.PublisherCoverageUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	if req.Priority == nil && req.IsActive == nil {
		RespondBadRequest(w, r, "No fields to update")
		return
	}

	var coverage models.PublisherCoverage

	// Update priority if provided
	if req.Priority != nil {
		if *req.Priority < 1 || *req.Priority > 10 {
			RespondBadRequest(w, r, "Priority must be between 1 and 10")
			return
		}
		priority := int32(*req.Priority)
		row, err := h.db.Queries.UpdateCoveragePriority(ctx, sqlcgen.UpdateCoveragePriorityParams{
			ID:       coverageIDInt,
			Priority: &priority,
		})
		if err != nil {
			slog.Error("failed to update coverage priority", "error", err)
			RespondInternalError(w, r, "Failed to update coverage")
			return
		}
		coverage = updateCoverageRowToModel(row)
	}

	// Update active status if provided
	if req.IsActive != nil {
		row, err := h.db.Queries.UpdateCoverageActive(ctx, sqlcgen.UpdateCoverageActiveParams{
			ID:       coverageIDInt,
			IsActive: *req.IsActive,
		})
		if err != nil {
			slog.Error("failed to update coverage active status", "error", err)
			RespondInternalError(w, r, "Failed to update coverage")
			return
		}
		coverage = updateCoverageActiveRowToModel(row)
	}

	// Log coverage update activity
	metadata := map[string]interface{}{
		"coverage_id":    coverageID,
		"coverage_level": existingCoverage.CoverageLevelKey,
	}
	if req.Priority != nil {
		metadata["new_priority"] = *req.Priority
		metadata["old_priority"] = existingCoverage.Priority
	}
	if req.IsActive != nil {
		metadata["new_is_active"] = *req.IsActive
		metadata["old_is_active"] = existingCoverage.IsActive
	}

	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		EventCategory:      AuditCategoryCoverage,
		EventAction:        AuditActionUpdate,
		ResourceType:       "coverage",
		ResourceID:         coverageID,
		ChangesBefore:      existingCoverage,
		ChangesAfter:       coverage,
		Status:             AuditStatusSuccess,
		AdditionalMetadata: metadata,
	})

	if h.cache != nil {
		if err := h.cache.InvalidatePublisherCache(ctx, pc.PublisherID); err != nil {
			slog.Warn("failed to invalidate cache after coverage update",
				"error", err,
				"publisher_id", pc.PublisherID,
			)
		}
	}

	RespondJSON(w, r, http.StatusOK, coverage)
}

// DeletePublisherCoverage removes a coverage area
//
//	@Summary		Delete coverage area
//	@Description	Removes a geographic coverage area from the publisher
//	@Tags			Coverage
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string						true	"Publisher ID"
//	@Param			id				path		string						true	"Coverage area ID"
//	@Success		200				{object}	APIResponse{data=object}	"Deletion confirmation"
//	@Failure		400				{object}	APIResponse{error=APIError}	"Invalid request"
//	@Failure		401				{object}	APIResponse{error=APIError}	"Unauthorized"
//	@Failure		404				{object}	APIResponse{error=APIError}	"Coverage area not found"
//	@Failure		500				{object}	APIResponse{error=APIError}	"Internal server error"
//	@Router			/publisher/coverage/{id} [delete]
func (h *Handlers) DeletePublisherCoverage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	coverageID := chi.URLParam(r, "id")

	if coverageID == "" {
		RespondBadRequest(w, r, "Coverage ID is required")
		return
	}

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}

	// Convert IDs to int32
	coverageIDInt, err := stringToInt32(coverageID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid coverage ID")
		return
	}

	publisherIDInt, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Check if publisher is global
	isGlobal, err := h.db.Queries.GetPublisherIsGlobal(ctx, publisherIDInt)
	if err != nil {
		slog.Error("Failed to check is_global status", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to check global status")
		return
	}
	if isGlobal {
		RespondBadRequest(w, r, "Cannot modify coverage for global publisher. Disable global coverage first.")
		return
	}

	// Verify ownership by fetching the coverage
	existingCoverage, err := h.db.Queries.GetPublisherCoverageByID(ctx, coverageIDInt)
	if err != nil {
		RespondNotFound(w, r, "Coverage not found")
		return
	}
	if existingCoverage.PublisherID != publisherIDInt {
		RespondNotFound(w, r, "Coverage not found or not owned by publisher")
		return
	}

	// Delete coverage
	if err := h.db.Queries.DeleteCoverage(ctx, coverageIDInt); err != nil {
		slog.Error("failed to delete coverage", "error", err)
		RespondInternalError(w, r, "Failed to delete coverage")
		return
	}

	// Log coverage removal activity
	metadata := map[string]interface{}{
		"coverage_id":    coverageID,
		"coverage_level": existingCoverage.CoverageLevelKey,
	}
	if existingCoverage.ContinentID != nil {
		metadata["continent_id"] = *existingCoverage.ContinentID
	}
	if existingCoverage.CountryID != nil {
		metadata["country_id"] = *existingCoverage.CountryID
	}
	if existingCoverage.RegionID != nil {
		metadata["region_id"] = *existingCoverage.RegionID
	}
	if existingCoverage.LocalityID != nil {
		metadata["locality_id"] = *existingCoverage.LocalityID
	}

	_ = h.activityService.LogAction(
		ctx,
		services.ActionCoverageRemove,
		services.ConceptCoverage,
		"coverage",
		coverageID,
		pc.PublisherID,
		metadata,
	)

	if h.cache != nil {
		if err := h.cache.InvalidatePublisherCache(ctx, pc.PublisherID); err != nil {
			slog.Warn("failed to invalidate cache after coverage deletion",
				"error", err,
				"publisher_id", pc.PublisherID,
			)
		}
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"message": "Coverage deleted successfully",
	})
}

// GetPublishersForLocality returns publishers serving a specific locality
//
//	@Summary		Get publishers for locality
//	@Description	Returns all publishers that have coverage for the specified locality (via locality, region, country, or continent level)
//	@Tags			Localities
//	@Produce		json
//	@Param			localityId	path		int														true	"Locality ID"
//	@Success		200			{object}	APIResponse{data=models.PublishersForLocalityResponse}	"Publishers serving this locality"
//	@Failure		400			{object}	APIResponse{error=APIError}								"Invalid request"
//	@Failure		500			{object}	APIResponse{error=APIError}								"Internal server error"
//	@Router			/localities/{localityId}/publishers [get]
func (h *Handlers) GetPublishersForLocality(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	localityIDStr := chi.URLParam(r, "localityId")

	if localityIDStr == "" {
		RespondBadRequest(w, r, "Locality ID is required")
		return
	}

	localityID, err := strconv.ParseInt(localityIDStr, 10, 64)
	if err != nil {
		RespondBadRequest(w, r, "Invalid locality_id format: must be an integer")
		return
	}

	// Get locality details
	localityRow, err := h.db.Queries.GetLocalityByID(ctx, int32(localityID))
	if err != nil {
		slog.Error("failed to get locality", "error", err, "locality_id", localityID)
		RespondNotFound(w, r, "Locality not found")
		return
	}

	// Use pre-computed display_hierarchy from search index, fallback to simple format
	displayName := localityRow.Name + ", " + localityRow.CountryName
	if localityRow.DisplayHierarchy != nil && *localityRow.DisplayHierarchy != "" {
		displayName = *localityRow.DisplayHierarchy
	}

	locality := &models.Locality{
		ID:               strconv.Itoa(int(localityRow.ID)),
		Name:             localityRow.Name,
		Country:          localityRow.CountryName,
		CountryCode:      localityRow.CountryCode,
		Timezone:         localityRow.Timezone,
		DisplayName:      displayName,
		LocalityType:     localityRow.LocalityTypeCode,
		LocalityTypeName: localityRow.LocalityTypeName,
		DisplayHierarchy: localityRow.DisplayHierarchy,
	}
	// Coordinates come from view (nullable via LEFT JOIN)
	if localityRow.Latitude != nil {
		locality.Latitude = *localityRow.Latitude
	}
	if localityRow.Longitude != nil {
		locality.Longitude = *localityRow.Longitude
	}
	if localityRow.ElevationM != nil {
		elev := int(*localityRow.ElevationM)
		locality.Elevation = &elev
	}

	// Get publishers for locality using SQLc
	rows, err := h.db.Queries.GetPublishersForLocality(ctx, int32(localityID))
	if err != nil {
		slog.Error("failed to get publishers for locality", "error", err, "locality_id", localityID)
		RespondInternalError(w, r, "Failed to fetch publishers for locality")
		return
	}

	// Convert SQLc rows to models
	publishers := make([]models.PublisherForLocality, 0, len(rows))
	for _, row := range rows {
		publishers = append(publishers, models.PublisherForLocality{
			PublisherID:   int32ToString(row.PublisherID),
			PublisherName: row.PublisherName,
			CoverageLevel: row.CoverageLevel,
			Priority:      int(row.Priority),
			MatchType:     row.MatchType,
		})
	}

	RespondJSON(w, r, http.StatusOK, models.PublishersForLocalityResponse{
		Locality:    locality,
		Publishers:  publishers,
		HasCoverage: len(publishers) > 0,
	})
}

// GetRegions returns regions using normalized schema, optionally filtered by country_code or search
//
//	@Summary		List regions
//	@Description	Returns regions/states with their locality counts, filtered by country code or search query
//	@Tags			Geography
//	@Produce		json
//	@Param			country_code	query		string						false	"Filter by ISO country code (required if search not provided)"
//	@Param			search			query		string						false	"Search query for region name (min 2 chars)"
//	@Param			limit			query		int							false	"Max results (default 20, max 100)"
//	@Success		200				{object}	APIResponse{data=object}	"List of regions"
//	@Failure		400				{object}	APIResponse{error=APIError}	"Either country_code or search required"
//	@Failure		500				{object}	APIResponse{error=APIError}	"Internal server error"
//	@Router			/regions [get]
func (h *Handlers) GetRegions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	countryCode := strings.TrimSpace(r.URL.Query().Get("country_code"))
	search := strings.TrimSpace(r.URL.Query().Get("search"))

	// Either country_code or search must be provided
	if countryCode == "" && search == "" {
		RespondBadRequest(w, r, "Either country_code or search query parameter is required")
		return
	}

	// Get limit (default 20, max 100)
	limit := int32(20)
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = int32(parsed)
		}
	}

	type Region struct {
		ID            int32  `json:"id"`
		Code          string `json:"code"`
		Name          string `json:"name"`
		CountryID     int32  `json:"country_id,omitempty"`
		CountryCode   string `json:"country_code,omitempty"`
		CountryName   string `json:"country_name,omitempty"`
		LocalityCount int64  `json:"locality_count,omitempty"`
	}

	var regions []Region

	if search != "" && len(search) >= 2 {
		// Search across all regions using SQLc
		rows, err := h.db.Queries.SearchRegions(ctx, sqlcgen.SearchRegionsParams{
			Column1: &search,
			Limit:   limit,
		})
		if err != nil {
			slog.Error("failed to search regions", "error", err)
			RespondInternalError(w, r, "Failed to fetch regions")
			return
		}
		for _, row := range rows {
			regions = append(regions, Region{
				ID:            row.ID,
				Code:          row.Code,
				Name:          row.Name,
				CountryID:     int32(row.CountryID),
				CountryCode:   row.CountryCode,
				CountryName:   row.Country,
				LocalityCount: row.LocalityCount,
			})
		}
	} else {
		// Filter by country code using SQLc
		rows, err := h.db.Queries.GetRegionsByCountry(ctx, countryCode)
		if err != nil {
			slog.Error("failed to get regions by country", "error", err)
			RespondInternalError(w, r, "Failed to fetch regions")
			return
		}
		for _, row := range rows {
			regions = append(regions, Region{
				ID:            row.ID,
				Code:          row.Code,
				Name:          row.Name,
				LocalityCount: row.LocalityCount,
			})
		}
	}

	if regions == nil {
		regions = []Region{}
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"regions": regions,
		"total":   len(regions),
	})
}

// Helper functions to convert SQLc rows to models

func coverageRowToModel(row sqlcgen.GetPublisherCoverageRow) models.PublisherCoverage {
	c := models.PublisherCoverage{
		ID:                row.ID,
		PublisherID:       row.PublisherID,
		CoverageLevelID:   row.CoverageLevelID,
		CoverageLevelKey:  &row.CoverageLevelKey,
		ContinentID:       row.ContinentID,
		CountryID:         row.CountryID,
		RegionID:          row.RegionID,
		LocalityID:        row.LocalityID,
		IsActive:          row.IsActive,
		CreatedAt:         row.CreatedAt.Time,
		UpdatedAt:         row.UpdatedAt.Time,
		ContinentName:     stringPtrIfNotEmpty(row.ContinentName),
		CountryCode:       stringPtrIfNotEmpty(row.CountryCode),
		CountryName:       stringPtrIfNotEmpty(row.CountryName),
		RegionCode:        stringPtrIfNotEmpty(row.RegionCode),
		RegionName:        stringPtrIfNotEmpty(row.RegionName),
		LocalityName:      stringPtrIfNotEmpty(row.LocalityName),
		LocalityLatitude:  row.LocalityLatitude,
		LocalityLongitude: row.LocalityLongitude,
		LocalityTimezone:  row.LocalityTimezone,
		LocalityCount:     row.LocalityCount,
	}
	if row.Priority != nil {
		c.Priority = int(*row.Priority)
	}
	return c
}

// Generic converter for Create/Update rows (they all have the same structure)
type coverageRowLike interface {
	sqlcgen.CreateCoverageContinentRow | sqlcgen.CreateCoverageCountryRow | sqlcgen.CreateCoverageRegionRow | sqlcgen.CreateCoverageLocalityRow | sqlcgen.UpdateCoveragePriorityRow | sqlcgen.UpdateCoverageActiveRow
}

func createCoverageRowToModel[T coverageRowLike](row T) models.PublisherCoverage {
	// Use type assertion to access the common fields
	var c models.PublisherCoverage
	switch any(row).(type) {
	case sqlcgen.CreateCoverageContinentRow:
		r := any(row).(sqlcgen.CreateCoverageContinentRow)
		c = models.PublisherCoverage{
			ID:              r.ID,
			PublisherID:     r.PublisherID,
			CoverageLevelID: r.CoverageLevelID,
			ContinentID:     r.ContinentID,
			CountryID:       r.CountryID,
			RegionID:        r.RegionID,
			LocalityID:      r.LocalityID,
			IsActive:        r.IsActive,
			CreatedAt:       r.CreatedAt.Time,
			UpdatedAt:       r.UpdatedAt.Time,
		}
		if r.Priority != nil {
			c.Priority = int(*r.Priority)
		}
	case sqlcgen.CreateCoverageCountryRow:
		r := any(row).(sqlcgen.CreateCoverageCountryRow)
		c = models.PublisherCoverage{
			ID:              r.ID,
			PublisherID:     r.PublisherID,
			CoverageLevelID: r.CoverageLevelID,
			ContinentID:     r.ContinentID,
			CountryID:       r.CountryID,
			RegionID:        r.RegionID,
			LocalityID:      r.LocalityID,
			IsActive:        r.IsActive,
			CreatedAt:       r.CreatedAt.Time,
			UpdatedAt:       r.UpdatedAt.Time,
		}
		if r.Priority != nil {
			c.Priority = int(*r.Priority)
		}
	case sqlcgen.CreateCoverageRegionRow:
		r := any(row).(sqlcgen.CreateCoverageRegionRow)
		c = models.PublisherCoverage{
			ID:              r.ID,
			PublisherID:     r.PublisherID,
			CoverageLevelID: r.CoverageLevelID,
			ContinentID:     r.ContinentID,
			CountryID:       r.CountryID,
			RegionID:        r.RegionID,
			LocalityID:      r.LocalityID,
			IsActive:        r.IsActive,
			CreatedAt:       r.CreatedAt.Time,
			UpdatedAt:       r.UpdatedAt.Time,
		}
		if r.Priority != nil {
			c.Priority = int(*r.Priority)
		}
	case sqlcgen.CreateCoverageLocalityRow:
		r := any(row).(sqlcgen.CreateCoverageLocalityRow)
		c = models.PublisherCoverage{
			ID:              r.ID,
			PublisherID:     r.PublisherID,
			CoverageLevelID: r.CoverageLevelID,
			ContinentID:     r.ContinentID,
			CountryID:       r.CountryID,
			RegionID:        r.RegionID,
			LocalityID:      r.LocalityID,
			IsActive:        r.IsActive,
			CreatedAt:       r.CreatedAt.Time,
			UpdatedAt:       r.UpdatedAt.Time,
		}
		if r.Priority != nil {
			c.Priority = int(*r.Priority)
		}
	case sqlcgen.UpdateCoveragePriorityRow:
		r := any(row).(sqlcgen.UpdateCoveragePriorityRow)
		c = models.PublisherCoverage{
			ID:              r.ID,
			PublisherID:     r.PublisherID,
			CoverageLevelID: r.CoverageLevelID,
			ContinentID:     r.ContinentID,
			CountryID:       r.CountryID,
			RegionID:        r.RegionID,
			LocalityID:      r.LocalityID,
			IsActive:        r.IsActive,
			CreatedAt:       r.CreatedAt.Time,
			UpdatedAt:       r.UpdatedAt.Time,
		}
		if r.Priority != nil {
			c.Priority = int(*r.Priority)
		}
	case sqlcgen.UpdateCoverageActiveRow:
		r := any(row).(sqlcgen.UpdateCoverageActiveRow)
		c = models.PublisherCoverage{
			ID:              r.ID,
			PublisherID:     r.PublisherID,
			CoverageLevelID: r.CoverageLevelID,
			ContinentID:     r.ContinentID,
			CountryID:       r.CountryID,
			RegionID:        r.RegionID,
			LocalityID:      r.LocalityID,
			IsActive:        r.IsActive,
			CreatedAt:       r.CreatedAt.Time,
			UpdatedAt:       r.UpdatedAt.Time,
		}
		if r.Priority != nil {
			c.Priority = int(*r.Priority)
		}
	}
	return c
}

// Simple wrappers for backward compatibility
func createCoverageContinentRowToModel(row sqlcgen.CreateCoverageContinentRow) models.PublisherCoverage {
	return createCoverageRowToModel(row)
}

func createCoverageCountryRowToModel(row sqlcgen.CreateCoverageCountryRow) models.PublisherCoverage {
	return createCoverageRowToModel(row)
}

func createCoverageRegionRowToModel(row sqlcgen.CreateCoverageRegionRow) models.PublisherCoverage {
	return createCoverageRowToModel(row)
}

func createCoverageLocalityRowToModel(row sqlcgen.CreateCoverageLocalityRow) models.PublisherCoverage {
	return createCoverageRowToModel(row)
}

func updateCoverageRowToModel(row sqlcgen.UpdateCoveragePriorityRow) models.PublisherCoverage {
	return createCoverageRowToModel(row)
}

func updateCoverageActiveRowToModel(row sqlcgen.UpdateCoverageActiveRow) models.PublisherCoverage {
	return createCoverageRowToModel(row)
}

// UpdateGlobalCoverage toggles the publisher's global coverage flag
//
//	@Summary		Update global coverage setting
//	@Description	Updates the publisher's is_global flag. Coverage records are preserved when switching to global.
//	@Tags			Coverage
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string						true	"Publisher ID"
//	@Param			request			body		object{is_global=bool}		true	"Global coverage flag"
//	@Success		200				{object}	APIResponse{data=object}	"Updated global coverage status"
//	@Failure		400				{object}	APIResponse{error=APIError}	"Invalid request"
//	@Failure		401				{object}	APIResponse{error=APIError}	"Unauthorized"
//	@Failure		500				{object}	APIResponse{error=APIError}	"Internal server error"
//	@Router			/publisher/settings/global-coverage [put]
func (h *Handlers) UpdateGlobalCoverage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher from context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. Parse request body
	var req struct {
		IsGlobal bool `json:"is_global"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Convert publisher ID to int32
	publisherIDInt, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// 2b. Get current is_global state before update for audit
	previousIsGlobal, err := h.db.Queries.GetPublisherIsGlobal(ctx, publisherIDInt)
	if err != nil {
		slog.Error("failed to get current is_global", "error", err, "publisher_id", pc.PublisherID)
		previousIsGlobal = false
	}

	// 3. Update is_global flag using SQLc query
	_, err = h.db.Queries.UpdatePublisherIsGlobal(ctx, sqlcgen.UpdatePublisherIsGlobalParams{
		ID:       publisherIDInt,
		IsGlobal: req.IsGlobal,
	})
	if err != nil {
		slog.Error("failed to update is_global", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to update global coverage setting")
		return
	}

	// 4. Get coverage count (coverage records are preserved)
	coverageCount, err := h.db.Queries.GetCoverageCountByPublisher(ctx, publisherIDInt)
	if err != nil {
		slog.Error("failed to get coverage count", "error", err, "publisher_id", pc.PublisherID)
		coverageCount = 0
	}

	// 4b. Log global coverage update
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		EventCategory: AuditCategorySettings,
		EventAction:   AuditActionUpdate,
		ResourceType:  "publisher_settings",
		ResourceID:    pc.PublisherID,
		ResourceName:  "global_coverage",
		ChangesBefore: map[string]interface{}{"is_global": previousIsGlobal},
		ChangesAfter:  map[string]interface{}{"is_global": req.IsGlobal},
		Status:        AuditStatusSuccess,
		AdditionalMetadata: map[string]interface{}{
			"coverage_count_preserved": coverageCount,
		},
	})

	// 5. Invalidate cache if available
	if h.cache != nil {
		if err := h.cache.InvalidatePublisherCache(ctx, pc.PublisherID); err != nil {
			slog.Warn("failed to invalidate cache after global coverage update",
				"error", err,
				"publisher_id", pc.PublisherID,
			)
		}
	}

	// 6. Return response
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"is_global":                   req.IsGlobal,
		"previous_coverage_preserved": true,
		"coverage_count":              coverageCount,
	})
}
