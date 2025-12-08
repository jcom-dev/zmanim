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
	"github.com/jcom-dev/zmanim-lab/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim-lab/internal/models"
)

// GetPublisherCoverage returns the current publisher's coverage areas
// @Summary Get publisher coverage areas
// @Description Returns all geographic coverage areas configured for the authenticated publisher
// @Tags Coverage
// @Produce json
// @Security BearerAuth
// @Param X-Publisher-Id header string true "Publisher ID"
// @Success 200 {object} APIResponse{data=models.PublisherCoverageListResponse} "List of coverage areas"
// @Failure 401 {object} APIResponse{error=APIError} "Unauthorized"
// @Failure 404 {object} APIResponse{error=APIError} "Publisher not found"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /publisher/coverage [get]
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
		Coverage: coverage,
		Total:    len(coverage),
	})
}

// CreatePublisherCoverage adds a new coverage area for the publisher
// @Summary Create coverage area
// @Description Adds a new geographic coverage area (continent, country, region, district, or city level)
// @Tags Coverage
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param X-Publisher-Id header string true "Publisher ID"
// @Param request body models.PublisherCoverageCreateRequest true "Coverage area configuration"
// @Success 201 {object} APIResponse{data=models.PublisherCoverage} "Created coverage area"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid request or duplicate coverage"
// @Failure 401 {object} APIResponse{error=APIError} "Unauthorized"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /publisher/coverage [post]
func (h *Handlers) CreatePublisherCoverage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}

	// Parse request body
	var req models.PublisherCoverageCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Validate coverage level
	validLevels := map[string]bool{"continent": true, "country": true, "region": true, "district": true, "city": true}
	if !validLevels[req.CoverageLevel] {
		RespondBadRequest(w, r, "Invalid coverage_level: must be 'continent', 'country', 'region', 'district', or 'city'")
		return
	}

	// Default priority
	priority := int32(5)
	if req.Priority != nil && *req.Priority >= 1 && *req.Priority <= 10 {
		priority = int32(*req.Priority)
	}

	var coverage models.PublisherCoverage

	// Convert publisher ID to int32
	publisherIDInt, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

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

	case "district":
		if req.DistrictID == nil {
			RespondBadRequest(w, r, "district_id is required for district-level coverage")
			return
		}
		// Check for duplicate
		exists, _ := h.db.Queries.CheckDuplicateCoverageDistrict(ctx, sqlcgen.CheckDuplicateCoverageDistrictParams{
			PublisherID: publisherIDInt,
			DistrictID:  req.DistrictID,
		})
		if exists {
			RespondBadRequest(w, r, "Coverage already exists for this district")
			return
		}
		row, err := h.db.Queries.CreateCoverageDistrict(ctx, sqlcgen.CreateCoverageDistrictParams{
			PublisherID: publisherIDInt,
			DistrictID:  req.DistrictID,
			Priority:    &priority,
			IsActive:    true,
		})
		if err != nil {
			slog.Error("failed to create district coverage", "error", err)
			RespondInternalError(w, r, "Failed to create coverage")
			return
		}
		coverage = createCoverageDistrictRowToModel(row)

	case "city":
		if req.CityID == nil {
			RespondBadRequest(w, r, "city_id is required for city-level coverage")
			return
		}

		// Check for duplicate
		exists, _ := h.db.Queries.CheckDuplicateCoverageCity(ctx, sqlcgen.CheckDuplicateCoverageCityParams{
			PublisherID: publisherIDInt,
			CityID:      req.CityID,
		})
		if exists {
			RespondBadRequest(w, r, "Coverage already exists for this city")
			return
		}
		row, err := h.db.Queries.CreateCoverageCity(ctx, sqlcgen.CreateCoverageCityParams{
			PublisherID: publisherIDInt,
			CityID:      req.CityID,
			Priority:    &priority,
			IsActive:    true,
		})
		if err != nil {
			slog.Error("failed to create city coverage", "error", err)
			RespondInternalError(w, r, "Failed to create coverage")
			return
		}
		coverage = createCoverageCityRowToModel(row)
	}

	RespondJSON(w, r, http.StatusCreated, coverage)
}

// UpdatePublisherCoverage updates a coverage area's priority or active status
// @Summary Update coverage area
// @Description Updates an existing coverage area's priority or active status
// @Tags Coverage
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param X-Publisher-Id header string true "Publisher ID"
// @Param id path string true "Coverage area ID"
// @Param request body models.PublisherCoverageUpdateRequest true "Fields to update"
// @Success 200 {object} APIResponse{data=models.PublisherCoverage} "Updated coverage area"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid request"
// @Failure 401 {object} APIResponse{error=APIError} "Unauthorized"
// @Failure 404 {object} APIResponse{error=APIError} "Coverage area not found"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /publisher/coverage/{id} [put]
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

	RespondJSON(w, r, http.StatusOK, coverage)
}

// DeletePublisherCoverage removes a coverage area
// @Summary Delete coverage area
// @Description Removes a geographic coverage area from the publisher
// @Tags Coverage
// @Produce json
// @Security BearerAuth
// @Param X-Publisher-Id header string true "Publisher ID"
// @Param id path string true "Coverage area ID"
// @Success 200 {object} APIResponse{data=object} "Deletion confirmation"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid request"
// @Failure 401 {object} APIResponse{error=APIError} "Unauthorized"
// @Failure 404 {object} APIResponse{error=APIError} "Coverage area not found"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /publisher/coverage/{id} [delete]
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

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"message": "Coverage deleted successfully",
	})
}

// GetPublishersForCity returns publishers serving a specific city
// @Summary Get publishers for city
// @Description Returns all publishers that have coverage for the specified city (via city, district, region, country, or continent level)
// @Tags Cities
// @Produce json
// @Param cityId path int true "City ID"
// @Success 200 {object} APIResponse{data=models.PublishersForCityResponse} "Publishers serving this city"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid request"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /cities/{cityId}/publishers [get]
func (h *Handlers) GetPublishersForCity(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	cityIDStr := chi.URLParam(r, "cityId")

	if cityIDStr == "" {
		RespondBadRequest(w, r, "City ID is required")
		return
	}

	cityID, err := strconv.ParseInt(cityIDStr, 10, 64)
	if err != nil {
		RespondBadRequest(w, r, "Invalid city_id format: must be an integer")
		return
	}

	// Get city details
	cityRow, err := h.db.Queries.GetCityByID(ctx, int32(cityID))
	if err != nil {
		slog.Error("failed to get city", "error", err, "city_id", cityID)
		RespondNotFound(w, r, "City not found")
		return
	}

	// Build display name
	displayName := cityRow.Name
	if cityRow.Region != "" {
		displayName = cityRow.Name + ", " + cityRow.Region + ", " + cityRow.Country
	} else {
		displayName = cityRow.Name + ", " + cityRow.Country
	}

	city := &models.City{
		ID:          strconv.Itoa(int(cityRow.ID)),
		Name:        cityRow.Name,
		Country:     cityRow.Country,
		CountryCode: cityRow.CountryCode,
		Latitude:    cityRow.Latitude,
		Longitude:   cityRow.Longitude,
		Timezone:    cityRow.Timezone,
		DisplayName: displayName,
	}
	if cityRow.Region != "" {
		city.Region = &cityRow.Region
	}
	if cityRow.ElevationM != nil {
		elev := int(*cityRow.ElevationM)
		city.Elevation = &elev
	}
	if cityRow.ContinentCode != "" {
		city.Continent = &cityRow.ContinentCode
	}

	// Get publishers for city using SQLc
	rows, err := h.db.Queries.GetPublishersForCity(ctx, int32(cityID))
	if err != nil {
		slog.Error("failed to get publishers for city", "error", err, "city_id", cityID)
		RespondInternalError(w, r, "Failed to fetch publishers for city")
		return
	}

	// Convert SQLc rows to models
	publishers := make([]models.PublisherForCity, 0, len(rows))
	for _, row := range rows {
		publishers = append(publishers, models.PublisherForCity{
			PublisherID:   int32ToString(row.PublisherID),
			PublisherName: row.PublisherName,
			CoverageLevel: row.CoverageLevel,
			Priority:      int(row.Priority),
			MatchType:     row.MatchType,
		})
	}

	RespondJSON(w, r, http.StatusOK, models.PublishersForCityResponse{
		City:        city,
		Publishers:  publishers,
		HasCoverage: len(publishers) > 0,
	})
}

// GetRegions returns regions using normalized schema, optionally filtered by country_code or search
// @Summary List regions
// @Description Returns regions/states with their city counts, filtered by country code or search query
// @Tags Geography
// @Produce json
// @Param country_code query string false "Filter by ISO country code (required if search not provided)"
// @Param search query string false "Search query for region name (min 2 chars)"
// @Param limit query int false "Max results (default 20, max 100)"
// @Success 200 {object} APIResponse{data=object} "List of regions"
// @Failure 400 {object} APIResponse{error=APIError} "Either country_code or search required"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /regions [get]
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
		ID          int32  `json:"id"`
		Code        string `json:"code"`
		Name        string `json:"name"`
		CountryID   int32  `json:"country_id,omitempty"`
		CountryCode string `json:"country_code,omitempty"`
		CountryName string `json:"country_name,omitempty"`
		CityCount   int64  `json:"city_count,omitempty"`
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
				ID:          row.ID,
				Code:        row.Code,
				Name:        row.Name,
				CountryID:   int32(row.CountryID),
				CountryCode: row.CountryCode,
				CountryName: row.Country,
				CityCount:   row.CityCount,
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
				ID:   row.ID,
				Code: row.Code,
				Name: row.Name,
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
		ID:               row.ID,
		PublisherID:      row.PublisherID,
		CoverageLevelID:  row.CoverageLevelID,
		CoverageLevelKey: &row.CoverageLevelKey,
		ContinentID:      row.ContinentID,
		CountryID:        row.CountryID,
		RegionID:         row.RegionID,
		DistrictID:       row.DistrictID,
		CityID:           row.CityID,
		IsActive:         row.IsActive,
		CreatedAt:        row.CreatedAt.Time,
		UpdatedAt:        row.UpdatedAt.Time,
		ContinentName:    stringPtrIfNotEmpty(row.ContinentName),
		CountryCode:      stringPtrIfNotEmpty(row.CountryCode),
		CountryName:      stringPtrIfNotEmpty(row.CountryName),
		RegionCode:       stringPtrIfNotEmpty(row.RegionCode),
		RegionName:       stringPtrIfNotEmpty(row.RegionName),
		DistrictCode:     stringPtrIfNotEmpty(row.DistrictCode),
		DistrictName:     stringPtrIfNotEmpty(row.DistrictName),
		CityName:         stringPtrIfNotEmpty(row.CityName),
		CityLatitude:     row.CityLatitude,
		CityLongitude:    row.CityLongitude,
		CityTimezone:     row.CityTimezone,
	}
	if row.Priority != nil {
		c.Priority = int(*row.Priority)
	}
	return c
}

// Generic converter for Create/Update rows (they all have the same structure)
type coverageRowLike interface {
	sqlcgen.CreateCoverageContinentRow | sqlcgen.CreateCoverageCountryRow | sqlcgen.CreateCoverageRegionRow | sqlcgen.CreateCoverageDistrictRow | sqlcgen.CreateCoverageCityRow | sqlcgen.UpdateCoveragePriorityRow | sqlcgen.UpdateCoverageActiveRow
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
			DistrictID:      r.DistrictID,
			CityID:          r.CityID,
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
			DistrictID:      r.DistrictID,
			CityID:          r.CityID,
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
			DistrictID:      r.DistrictID,
			CityID:          r.CityID,
			IsActive:        r.IsActive,
			CreatedAt:       r.CreatedAt.Time,
			UpdatedAt:       r.UpdatedAt.Time,
		}
		if r.Priority != nil {
			c.Priority = int(*r.Priority)
		}
	case sqlcgen.CreateCoverageDistrictRow:
		r := any(row).(sqlcgen.CreateCoverageDistrictRow)
		c = models.PublisherCoverage{
			ID:              r.ID,
			PublisherID:     r.PublisherID,
			CoverageLevelID: r.CoverageLevelID,
			ContinentID:     r.ContinentID,
			CountryID:       r.CountryID,
			RegionID:        r.RegionID,
			DistrictID:      r.DistrictID,
			CityID:          r.CityID,
			IsActive:        r.IsActive,
			CreatedAt:       r.CreatedAt.Time,
			UpdatedAt:       r.UpdatedAt.Time,
		}
		if r.Priority != nil {
			c.Priority = int(*r.Priority)
		}
	case sqlcgen.CreateCoverageCityRow:
		r := any(row).(sqlcgen.CreateCoverageCityRow)
		c = models.PublisherCoverage{
			ID:              r.ID,
			PublisherID:     r.PublisherID,
			CoverageLevelID: r.CoverageLevelID,
			ContinentID:     r.ContinentID,
			CountryID:       r.CountryID,
			RegionID:        r.RegionID,
			DistrictID:      r.DistrictID,
			CityID:          r.CityID,
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
			DistrictID:      r.DistrictID,
			CityID:          r.CityID,
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
			DistrictID:      r.DistrictID,
			CityID:          r.CityID,
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

func createCoverageDistrictRowToModel(row sqlcgen.CreateCoverageDistrictRow) models.PublisherCoverage {
	return createCoverageRowToModel(row)
}

func createCoverageCityRowToModel(row sqlcgen.CreateCoverageCityRow) models.PublisherCoverage {
	return createCoverageRowToModel(row)
}

func updateCoverageRowToModel(row sqlcgen.UpdateCoveragePriorityRow) models.PublisherCoverage {
	return createCoverageRowToModel(row)
}

func updateCoverageActiveRowToModel(row sqlcgen.UpdateCoverageActiveRow) models.PublisherCoverage {
	return createCoverageRowToModel(row)
}
