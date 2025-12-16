// File: localities.go
// Purpose: Locality handlers using new geo_localities schema
// Pattern: 6-step-handler
// Compliance: SQLc:✓ slog:✓ response-helpers:✓

package handlers

import (
	"database/sql"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// GetLocality returns a single locality by ID
// GET /localities/{id}
//
//	@Summary		Get locality by ID
//	@Description	Returns a single locality with type and hierarchy information
//	@Tags			Geographic
//	@Produce		json
//	@Param			id	path		int												true	"Locality ID"
//	@Success		200	{object}	APIResponse{data=sqlcgen.GetLocalityByIDRow}	"Locality details"
//	@Failure		400	{object}	APIResponse{error=APIError}						"Invalid locality ID"
//	@Failure		404	{object}	APIResponse{error=APIError}						"Locality not found"
//	@Failure		500	{object}	APIResponse{error=APIError}						"Internal server error"
//	@Router			/localities/{id} [get]
func (h *Handlers) GetLocality(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. No publisher context (public endpoint)

	// 2. Extract URL params
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid locality ID")
		return
	}

	// 3. No body to parse for GET

	// 4. Validate (done via parsing)

	// 5. SQLc query
	locality, err := h.db.Queries.GetLocalityByID(ctx, int32(id))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			RespondNotFound(w, r, "Locality not found")
			return
		}
		slog.Error("failed to get locality", "error", err, "id", id)
		RespondInternalError(w, r, "Failed to get locality")
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, locality)
}

// ListLocalities returns localities with optional filters
// GET /localities
//
//	@Summary		List localities
//	@Description	Returns localities filtered by country, region, or type
//	@Tags			Geographic
//	@Produce		json
//	@Param			country_id			query		int												false	"Country ID filter"
//	@Param			region_id			query		int												false	"Region ID filter"
//	@Param			locality_type_id	query		int												false	"Locality type ID filter"
//	@Param			limit				query		int												false	"Results per page (default: 50, max: 200)"
//	@Param			offset				query		int												false	"Pagination offset (default: 0)"
//	@Success		200					{object}	APIResponse{data=[]sqlcgen.ListLocalitiesRow}	"List of localities"
//	@Failure		400					{object}	APIResponse{error=APIError}						"Invalid parameters"
//	@Failure		500					{object}	APIResponse{error=APIError}						"Internal server error"
//	@Router			/localities [get]
func (h *Handlers) ListLocalities(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. No publisher context (public endpoint)

	// 2. Extract query params
	var countryID *int32
	if idStr := r.URL.Query().Get("country_id"); idStr != "" {
		id, err := strconv.ParseInt(idStr, 10, 32)
		if err != nil {
			RespondBadRequest(w, r, "Invalid country_id")
			return
		}
		val := int32(id)
		countryID = &val
	}

	var regionID *int32
	if idStr := r.URL.Query().Get("region_id"); idStr != "" {
		id, err := strconv.ParseInt(idStr, 10, 32)
		if err != nil {
			RespondBadRequest(w, r, "Invalid region_id")
			return
		}
		val := int32(id)
		regionID = &val
	}

	var localityTypeID *int16
	if idStr := r.URL.Query().Get("locality_type_id"); idStr != "" {
		id, err := strconv.ParseInt(idStr, 10, 16)
		if err != nil {
			RespondBadRequest(w, r, "Invalid locality_type_id")
			return
		}
		val := int16(id)
		localityTypeID = &val
	}

	// Note: parent_locality_id filtering is now done via BrowseHierarchy query
	// ListLocalities uses inherited_region_id for region filtering

	limit := int32(50)
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		l, err := strconv.ParseInt(limitStr, 10, 32)
		if err != nil || l < 1 || l > 200 {
			RespondBadRequest(w, r, "Invalid limit (must be 1-200)")
			return
		}
		limit = int32(l)
	}

	offset := int32(0)
	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		o, err := strconv.ParseInt(offsetStr, 10, 32)
		if err != nil || o < 0 {
			RespondBadRequest(w, r, "Invalid offset")
			return
		}
		offset = int32(o)
	}

	// 3. No body to parse for GET

	// 4. Validate (done via parsing)

	// 5. SQLc query
	localities, err := h.db.Queries.ListLocalities(ctx, sqlcgen.ListLocalitiesParams{
		CountryID:         countryID,
		InheritedRegionID: regionID, // region_id param maps to inherited_region_id
		LocalityTypeID:    localityTypeID,
		LimitVal:          limit,
		OffsetVal:         offset,
	})
	if err != nil {
		slog.Error("failed to list localities", "error", err)
		RespondInternalError(w, r, "Failed to list localities")
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, localities)
}

// SearchLocalities performs tiered search across localities
// GET /localities/search
//
//	@Summary		Search localities
//	@Description	Performs tiered search (exact keyword → fuzzy trigram) with population ranking. When publisher_id is provided, filters to localities within the publisher's coverage areas (hierarchy-aware).
//	@Tags			Geographic
//	@Produce		json
//	@Param			q				query		string											true	"Search query"
//	@Param			entity_types	query		string											false	"Comma-separated entity types (locality,region,country)"
//	@Param			country_id		query		int												false	"Filter by country ID"
//	@Param			region_id		query		int												false	"Filter by inherited region ID (resolved from hierarchy)"
//	@Param			publisher_id	query		string											false	"Filter to publisher's coverage areas (UUID)"
//	@Param			limit			query		int												false	"Maximum results (default: 20, max: 100)"
//	@Success		200				{object}	APIResponse{data=[]sqlcgen.SearchLocalitiesRow}	"Search results"
//	@Failure		400				{object}	APIResponse{error=APIError}						"Invalid parameters"
//	@Failure		500				{object}	APIResponse{error=APIError}						"Internal server error"
//	@Router			/localities/search [get]
func (h *Handlers) SearchLocalities(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. No publisher context (public endpoint)

	// 2. Extract query params
	query := r.URL.Query().Get("q")
	if query == "" {
		RespondBadRequest(w, r, "Search query is required")
		return
	}

	if len(query) < 2 {
		RespondBadRequest(w, r, "Search query must be at least 2 characters")
		return
	}

	// Check for publisher_id filter (hierarchy-aware coverage filtering)
	publisherIDStr := r.URL.Query().Get("publisher_id")

	var entityTypes []string
	if typesStr := r.URL.Query().Get("entity_types"); typesStr != "" {
		// Parse comma-separated entity types into slice
		entityTypes = strings.Split(typesStr, ",")
	}

	var countryID *int32
	if idStr := r.URL.Query().Get("country_id"); idStr != "" {
		id, err := strconv.ParseInt(idStr, 10, 32)
		if err != nil {
			RespondBadRequest(w, r, "Invalid country_id")
			return
		}
		val := int32(id)
		countryID = &val
	}

	var regionID *int32
	if idStr := r.URL.Query().Get("region_id"); idStr != "" {
		id, err := strconv.ParseInt(idStr, 10, 32)
		if err != nil {
			RespondBadRequest(w, r, "Invalid region_id")
			return
		}
		val := int32(id)
		regionID = &val
	}

	// Note: parent_region_id and parent_locality_id filtering is now done via BrowseHierarchy query
	// SearchLocalities uses inherited_region_id for region filtering

	limit := int32(20)
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		l, err := strconv.ParseInt(limitStr, 10, 32)
		if err != nil || l < 1 || l > 100 {
			RespondBadRequest(w, r, "Invalid limit (must be 1-100)")
			return
		}
		limit = int32(l)
	}

	// 3. No body to parse for GET

	// 4. Validate (done via parsing)

	// 5. SQLc query - use publisher-filtered query if publisher_id provided
	if publisherIDStr != "" {
		publisherID, err := strconv.ParseInt(publisherIDStr, 10, 32)
		if err != nil {
			RespondBadRequest(w, r, "Invalid publisher_id")
			return
		}

		// Use hierarchy-aware publisher coverage filter
		results, err := h.db.Queries.SearchLocalitiesWithPublisherCoverage(ctx, sqlcgen.SearchLocalitiesWithPublisherCoverageParams{
			PublisherID: int32(publisherID),
			Query:       query,
			LimitVal:    limit,
		})
		if err != nil {
			slog.Error("failed to search localities with publisher coverage", "error", err, "query", query, "publisher_id", publisherIDStr)
			RespondInternalError(w, r, "Failed to search localities")
			return
		}

		// 6. Respond
		RespondJSON(w, r, http.StatusOK, results)
		return
	}

	// Standard search without publisher filtering
	results, err := h.db.Queries.SearchLocalities(ctx, sqlcgen.SearchLocalitiesParams{
		Query:             query,
		EntityTypes:       entityTypes,
		CountryID:         countryID,
		InheritedRegionID: regionID, // region_id param maps to inherited_region_id
		LimitVal:          limit,
	})
	if err != nil {
		slog.Error("failed to search localities", "error", err, "query", query)
		RespondInternalError(w, r, "Failed to search localities")
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, results)
}

// GetNearbyLocalities finds localities near a point
// GET /localities/nearby
//
//	@Summary		Find nearby localities
//	@Description	Finds localities within a radius of given GPS coordinates
//	@Tags			Geographic
//	@Produce		json
//	@Param			lat			query		number													true	"Latitude (-90 to 90)"
//	@Param			lng			query		number													true	"Longitude (-180 to 180)"
//	@Param			radius_m	query		number													false	"Radius in meters (default: 50000, max: 200000)"
//	@Param			limit		query		int														false	"Maximum results (default: 20, max: 100)"
//	@Success		200			{object}	APIResponse{data=[]sqlcgen.GetLocalitiesNearPointRow}	"Nearby localities with distances"
//	@Failure		400			{object}	APIResponse{error=APIError}								"Invalid parameters"
//	@Failure		500			{object}	APIResponse{error=APIError}								"Internal server error"
//	@Router			/localities/nearby [get]
func (h *Handlers) GetNearbyLocalities(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. No publisher context (public endpoint)

	// 2. Extract query params
	latStr := r.URL.Query().Get("lat")
	if latStr == "" {
		RespondBadRequest(w, r, "Latitude is required")
		return
	}
	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil || lat < -90 || lat > 90 {
		RespondBadRequest(w, r, "Invalid latitude")
		return
	}

	lngStr := r.URL.Query().Get("lng")
	if lngStr == "" {
		RespondBadRequest(w, r, "Longitude is required")
		return
	}
	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil || lng < -180 || lng > 180 {
		RespondBadRequest(w, r, "Invalid longitude")
		return
	}

	radiusM := float64(50000) // Default 50km
	if radiusStr := r.URL.Query().Get("radius_m"); radiusStr != "" {
		radius, err := strconv.ParseFloat(radiusStr, 64)
		if err != nil || radius < 1 || radius > 200000 {
			RespondBadRequest(w, r, "Invalid radius_m (must be 1-200000)")
			return
		}
		radiusM = radius
	}

	limit := int32(20)
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		l, err := strconv.ParseInt(limitStr, 10, 32)
		if err != nil || l < 1 || l > 100 {
			RespondBadRequest(w, r, "Invalid limit (must be 1-100)")
			return
		}
		limit = int32(l)
	}

	// 3. No body to parse for GET

	// 4. Validate (done via parsing)

	// 5. SQLc query
	localities, err := h.db.Queries.GetLocalitiesNearPoint(ctx, sqlcgen.GetLocalitiesNearPointParams{
		Lng:      lng,
		Lat:      lat,
		RadiusM:  radiusM,
		LimitVal: limit,
	})
	if err != nil {
		slog.Error("failed to find nearby localities", "error", err, "lat", lat, "lng", lng)
		RespondInternalError(w, r, "Failed to find nearby localities")
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, localities)
}

// BrowseHierarchy returns children of ANY entity for unified hierarchical browsing
// GET /localities/browse
//
//	@Summary		Browse geographic hierarchy
//	@Description	Returns children of any entity (continent, country, region, or locality). When parent_type is omitted, returns all continents (top-level).
//	@Tags			Geographic
//	@Produce		json
//	@Param			parent_type	query		string											false	"Parent entity type (continent, country, region, or locality). Omit for continents."
//	@Param			parent_id	query		int												false	"Parent entity ID. Required when parent_type is provided."
//	@Param			limit		query		int												false	"Maximum results (default: 500, max: 1000)"
//	@Success		200			{object}	APIResponse{data=[]sqlcgen.BrowseHierarchyRow}	"Browse results"
//	@Failure		400			{object}	APIResponse{error=APIError}						"Invalid parameters"
//	@Failure		500			{object}	APIResponse{error=APIError}						"Internal server error"
//	@Router			/localities/browse [get]
func (h *Handlers) BrowseHierarchy(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. No publisher context (public endpoint)

	// 2. Extract query params - parent_type is optional (nil = get continents)
	var parentType *string
	parentTypeStr := r.URL.Query().Get("parent_type")
	if parentTypeStr != "" {
		if parentTypeStr != "continent" && parentTypeStr != "country" && parentTypeStr != "region" && parentTypeStr != "locality" {
			RespondBadRequest(w, r, "Invalid parent_type (must be continent, country, region, or locality)")
			return
		}
		parentType = &parentTypeStr
	}

	// parent_id is required when parent_type is provided
	var parentID *int32
	parentIDStr := r.URL.Query().Get("parent_id")
	if parentIDStr != "" {
		pid, err := strconv.ParseInt(parentIDStr, 10, 32)
		if err != nil {
			RespondBadRequest(w, r, "Invalid parent_id")
			return
		}
		pidInt := int32(pid)
		parentID = &pidInt
	} else if parentType != nil {
		// parent_id is required when parent_type is provided
		RespondBadRequest(w, r, "parent_id is required when parent_type is provided")
		return
	}

	limit := int32(500)
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		l, err := strconv.ParseInt(limitStr, 10, 32)
		if err != nil || l < 1 || l > 1000 {
			RespondBadRequest(w, r, "Invalid limit (must be 1-1000)")
			return
		}
		limit = int32(l)
	}

	// 3. No body to parse for GET

	// 4. Validate (done via parsing)

	// 5. SQLc query - unified for all entity types
	// When parentType is nil, returns continents (entities with no parent)
	results, err := h.db.Queries.BrowseHierarchy(ctx, sqlcgen.BrowseHierarchyParams{
		ParentType: parentType,
		ParentID:   parentID,
		LimitVal:   limit,
	})
	if err != nil {
		slog.Error("failed to browse hierarchy", "error", err, "parent_type", parentTypeStr, "parent_id", parentIDStr)
		RespondInternalError(w, r, "Failed to browse hierarchy")
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, results)
}
