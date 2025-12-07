// File: geo_boundaries.go
// Purpose: PostGIS geographic queries - country/region/city boundary lookup
// Pattern: 6-step-handler
// Dependencies: Queries: geo_boundaries.sql (PostGIS ST_Contains)
// Frequency: high - 781 lines
// Compliance: Check docs/adr/ for pattern rationale

package handlers

import (
	"encoding/json"
	"log/slog"
	"math"
	"net/http"
	"strconv"

	"github.com/jcom-dev/zmanim-lab/internal/db/sqlcgen"
)

// GeoJSONFeatureCollection represents a GeoJSON FeatureCollection
type GeoJSONFeatureCollection struct {
	Type     string                 `json:"type"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
	Features []GeoJSONFeature       `json:"features"`
}

// GeoJSONFeature represents a GeoJSON Feature
type GeoJSONFeature struct {
	Type       string                 `json:"type"`
	ID         interface{}            `json:"id"`
	Properties map[string]interface{} `json:"properties"`
	Geometry   json.RawMessage        `json:"geometry"`
}

// PointLookupResponse represents the response from point-in-polygon lookup
type PointLookupResponse struct {
	Country      *CountryInfo  `json:"country,omitempty"`
	Region       *RegionInfo   `json:"region,omitempty"`
	District     *DistrictInfo `json:"district,omitempty"`
	NearestCites []NearestCity `json:"nearest_cities,omitempty"`
}

// SmartLookupResponse represents the response from zoom-aware point lookup
type SmartLookupResponse struct {
	RecommendedLevel string               `json:"recommended_level"` // country, region, district, city
	Levels           SmartLookupLevels    `json:"levels"`
	NearbyCities     []NearestCity        `json:"nearby_cities,omitempty"`
}

// SmartLookupLevels contains all available levels at a point
type SmartLookupLevels struct {
	Country  *SmartLevelInfo `json:"country,omitempty"`
	Region   *SmartLevelInfo `json:"region,omitempty"`
	District *SmartLevelInfo `json:"district,omitempty"`
}

// SmartLevelInfo represents a geographic level with area for smart selection
type SmartLevelInfo struct {
	ID       interface{} `json:"id"`
	Code     string      `json:"code"`
	Name     string      `json:"name"`
	AreaKm2  *float64    `json:"area_km2,omitempty"`
	Label    string      `json:"label,omitempty"` // e.g., "State", "Province", "County"
}

// CountryInfo represents country info in lookup response
type CountryInfo struct {
	ID        int16  `json:"id"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	ADM1Label string `json:"adm1_label,omitempty"`
	ADM2Label string `json:"adm2_label,omitempty"`
	HasADM1   bool   `json:"has_adm1"`
	HasADM2   bool   `json:"has_adm2"`
}

// RegionInfo represents region info in lookup response
type RegionInfo struct {
	ID        int32  `json:"id"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	CountryID int16  `json:"country_id,omitempty"`
}

// DistrictInfo represents district info in lookup response
type DistrictInfo struct {
	ID       int32  `json:"id"`
	Code     string `json:"code"`
	Name     string `json:"name"`
	RegionID int32  `json:"region_id,omitempty"`
}

// NearestCity represents a nearby city in lookup response
type NearestCity struct {
	ID           int32   `json:"id"`
	Name         string  `json:"name"`
	NameLocal    *string `json:"name_local,omitempty"`
	CountryCode  string  `json:"country_code"`
	RegionName   *string `json:"region_name,omitempty"`
	DistrictName *string `json:"district_name,omitempty"`
	DistanceKm   float64 `json:"distance_km"`
}

// GetCountryBoundaries returns all country boundaries as GeoJSON
// @Summary Get country boundaries
// @Description Returns all country boundaries as a GeoJSON FeatureCollection for map rendering
// @Tags Geographic Boundaries
// @Produce json
// @Param continent query string false "Filter by continent code (e.g., EU, NA, AS)"
// @Success 200 {object} GeoJSONFeatureCollection "GeoJSON FeatureCollection of country boundaries"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /geo/boundaries/countries [get]
func (h *Handlers) GetCountryBoundaries(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	continent := r.URL.Query().Get("continent")

	var features []GeoJSONFeature
	var metadata = map[string]interface{}{
		"level": "country",
	}

	if continent != "" {
		metadata["continent"] = continent
		rows, err := h.db.Queries.GetCountryBoundariesByContinent(ctx, continent)
		if err != nil {
			slog.Error("failed to get country boundaries by continent", "error", err, "continent", continent)
			RespondInternalError(w, r, "Failed to get country boundaries")
			return
		}
		features = convertCountryBoundariesToFeatures(rows)
		metadata["count"] = len(features)
	} else {
		rows, err := h.db.Queries.GetAllCountryBoundaries(ctx)
		if err != nil {
			slog.Error("failed to get all country boundaries", "error", err)
			RespondInternalError(w, r, "Failed to get country boundaries")
			return
		}
		features = convertAllCountryBoundariesToFeatures(rows)
		metadata["count"] = len(features)
	}

	fc := GeoJSONFeatureCollection{
		Type:     "FeatureCollection",
		Metadata: metadata,
		Features: features,
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(fc)
}

// GetRegionBoundaries returns region boundaries for a country as GeoJSON
// @Summary Get region boundaries (ADM1)
// @Description Returns region/state boundaries for a specific country as a GeoJSON FeatureCollection
// @Tags Geographic Boundaries
// @Produce json
// @Param country_code query string true "ISO 3166-1 alpha-2 country code (e.g., US, IL, GB)"
// @Success 200 {object} GeoJSONFeatureCollection "GeoJSON FeatureCollection of region boundaries"
// @Failure 400 {object} APIResponse{error=APIError} "Country code is required"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /geo/boundaries/regions [get]
func (h *Handlers) GetRegionBoundaries(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	countryCode := r.URL.Query().Get("country_code")
	if countryCode == "" {
		countryCode = r.URL.Query().Get("country_id")
	}

	if countryCode == "" {
		RespondBadRequest(w, r, "country_code is required")
		return
	}

	rows, err := h.db.Queries.GetRegionBoundariesByCountry(ctx, countryCode)
	if err != nil {
		slog.Error("failed to get region boundaries", "error", err, "country_code", countryCode)
		RespondInternalError(w, r, "Failed to get region boundaries")
		return
	}

	features := convertRegionBoundariesToFeatures(rows)

	// Get country info for metadata
	country, _ := h.db.Queries.GetCountryByCode(ctx, countryCode)

	metadata := map[string]interface{}{
		"level":        "region",
		"country_code": countryCode,
		"count":        len(features),
	}
	if country.Adm1Label != nil {
		metadata["level_label"] = *country.Adm1Label
	}

	fc := GeoJSONFeatureCollection{
		Type:     "FeatureCollection",
		Metadata: metadata,
		Features: features,
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(fc)
}

// GetDistrictBoundaries returns district boundaries as GeoJSON
// @Summary Get district boundaries (ADM2)
// @Description Returns district/county boundaries for a specific country or region as a GeoJSON FeatureCollection
// @Tags Geographic Boundaries
// @Produce json
// @Param country_code query string false "ISO 3166-1 alpha-2 country code (e.g., US, GB)"
// @Param region_id query int false "Region ID to filter districts"
// @Success 200 {object} GeoJSONFeatureCollection "GeoJSON FeatureCollection of district boundaries"
// @Failure 400 {object} APIResponse{error=APIError} "country_code or region_id is required"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /geo/boundaries/districts [get]
func (h *Handlers) GetDistrictBoundaries(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	countryCode := r.URL.Query().Get("country_code")
	regionIDStr := r.URL.Query().Get("region_id")

	var features []GeoJSONFeature
	metadata := map[string]interface{}{
		"level": "district",
	}

	if regionIDStr != "" {
		regionID, err := strconv.ParseInt(regionIDStr, 10, 32)
		if err != nil {
			RespondBadRequest(w, r, "Invalid region_id")
			return
		}

		rows, err := h.db.Queries.GetDistrictBoundariesByRegion(ctx, int32(regionID))
		if err != nil {
			slog.Error("failed to get district boundaries by region", "error", err, "region_id", regionID)
			RespondInternalError(w, r, "Failed to get district boundaries")
			return
		}
		features = convertDistrictBoundariesByRegionToFeatures(rows)
		metadata["region_id"] = regionID
		metadata["count"] = len(features)

		if len(rows) > 0 {
			metadata["region_code"] = rows[0].RegionCode
			metadata["region_name"] = rows[0].RegionName
		}
	} else if countryCode != "" {
		rows, err := h.db.Queries.GetDistrictBoundariesByCountry(ctx, countryCode)
		if err != nil {
			slog.Error("failed to get district boundaries by country", "error", err, "country_code", countryCode)
			RespondInternalError(w, r, "Failed to get district boundaries")
			return
		}
		features = convertDistrictBoundariesToFeatures(rows)
		metadata["country_code"] = countryCode
		metadata["count"] = len(features)

		// Get country info for metadata
		country, _ := h.db.Queries.GetCountryByCode(ctx, countryCode)
		if country.Adm2Label != nil {
			metadata["level_label"] = *country.Adm2Label
		}
	} else {
		RespondBadRequest(w, r, "country_code or region_id is required")
		return
	}

	fc := GeoJSONFeatureCollection{
		Type:     "FeatureCollection",
		Metadata: metadata,
		Features: features,
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(fc)
}

// LookupPointLocation performs point-in-polygon lookup to find country/region/district at coordinates
// @Summary Point-in-polygon lookup
// @Description Given lat/lng coordinates, returns the country, region, and district containing that point, plus nearby cities
// @Tags Geographic Boundaries
// @Produce json
// @Param lat query number true "Latitude"
// @Param lng query number true "Longitude"
// @Success 200 {object} APIResponse{data=PointLookupResponse} "Location lookup result"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid coordinates"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /geo/boundaries/lookup [get]
func (h *Handlers) LookupPointLocation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")

	if latStr == "" || lngStr == "" {
		RespondBadRequest(w, r, "lat and lng query parameters are required")
		return
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil || lat < -90 || lat > 90 {
		RespondBadRequest(w, r, "Invalid latitude value")
		return
	}

	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil || lng < -180 || lng > 180 {
		RespondBadRequest(w, r, "Invalid longitude value")
		return
	}

	response := PointLookupResponse{}

	// Lookup country
	country, err := h.db.Queries.LookupCountryByPoint(ctx, sqlcgen.LookupCountryByPointParams{
		StMakepoint:   lng,
		StMakepoint_2: lat,
	})
	if err == nil {
		response.Country = &CountryInfo{
			ID:   country.ID,
			Code: country.Code,
			Name: country.Name,
		}
		if country.HasAdm1 != nil {
			response.Country.HasADM1 = *country.HasAdm1
		}
		if country.HasAdm2 != nil {
			response.Country.HasADM2 = *country.HasAdm2
		}
		if country.Adm1Label != nil {
			response.Country.ADM1Label = *country.Adm1Label
		}
		if country.Adm2Label != nil {
			response.Country.ADM2Label = *country.Adm2Label
		}
	}

	// Lookup region
	region, err := h.db.Queries.LookupRegionByPoint(ctx, sqlcgen.LookupRegionByPointParams{
		StMakepoint:   lng,
		StMakepoint_2: lat,
	})
	if err == nil {
		response.Region = &RegionInfo{
			ID:        region.ID,
			Code:      region.Code,
			Name:      region.Name,
			CountryID: region.CountryID,
		}
	}

	// Lookup district
	district, err := h.db.Queries.LookupDistrictByPoint(ctx, sqlcgen.LookupDistrictByPointParams{
		StMakepoint:   lng,
		StMakepoint_2: lat,
	})
	if err == nil {
		response.District = &DistrictInfo{
			ID:       district.ID,
			Code:     district.Code,
			Name:     district.Name,
			RegionID: district.RegionID,
		}
	}

	// Find nearest cities (within 50km, limit 5)
	cities, err := h.db.Queries.LookupNearestCities(ctx, sqlcgen.LookupNearestCitiesParams{
		StMakepoint:   lng,
		StMakepoint_2: lat,
		StDwithin:     50000, // 50km radius
		Limit:         5,
	})
	if err == nil && len(cities) > 0 {
		for _, c := range cities {
			nc := NearestCity{
				ID:          c.ID,
				Name:        c.Name,
				CountryCode: c.CountryCode,
				DistanceKm:  float64(c.DistanceKm),
			}
			// RegionName is now always present (required JOIN)
			nc.RegionName = &c.RegionName
			if c.DistrictName != nil {
				nc.DistrictName = c.DistrictName
			}
			response.NearestCites = append(response.NearestCites, nc)
		}
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// GetBoundaryStats returns statistics about boundary coverage
// @Summary Get boundary statistics
// @Description Returns counts of boundaries at each level
// @Tags Geographic Boundaries
// @Produce json
// @Success 200 {object} APIResponse "Boundary statistics"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /geo/boundaries/stats [get]
func (h *Handlers) GetBoundaryStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	stats, err := h.db.Queries.GetBoundaryStats(ctx)
	if err != nil {
		slog.Error("failed to get boundary stats", "error", err)
		RespondInternalError(w, r, "Failed to get boundary stats")
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"countries": map[string]interface{}{
			"total":           stats.TotalCountries,
			"with_boundaries": stats.CountriesWithBoundaries,
		},
		"regions": map[string]interface{}{
			"total":           stats.TotalRegions,
			"with_boundaries": stats.RegionsWithBoundaries,
		},
		"districts": map[string]interface{}{
			"total":           stats.TotalDistricts,
			"with_boundaries": stats.DistrictsWithBoundaries,
		},
	})
}

// Helper functions to convert database rows to GeoJSON features

func convertAllCountryBoundariesToFeatures(rows []sqlcgen.GetAllCountryBoundariesRow) []GeoJSONFeature {
	features := make([]GeoJSONFeature, 0, len(rows))
	for _, row := range rows {
		feature := GeoJSONFeature{
			Type: "Feature",
			ID:   row.ID,
			Properties: map[string]interface{}{
				"id":             row.ID,
				"code":           row.Code,
				"name":           row.Name,
				"continent_code": row.ContinentCode,
				"continent_name": row.ContinentName,
				"has_adm1":       row.HasAdm1,
				"has_adm2":       row.HasAdm2,
			},
			Geometry: json.RawMessage(row.BoundaryGeojson),
		}

		if row.Adm1Label != nil {
			feature.Properties["adm1_label"] = *row.Adm1Label
		}
		if row.Adm2Label != nil {
			feature.Properties["adm2_label"] = *row.Adm2Label
		}
		if row.AreaKm2 != nil {
			feature.Properties["area_km2"] = *row.AreaKm2
		}
		if row.CentroidLng != nil && row.CentroidLat != nil {
			feature.Properties["centroid"] = []interface{}{row.CentroidLng, row.CentroidLat}
		}

		features = append(features, feature)
	}
	return features
}

func convertCountryBoundariesToFeatures(rows []sqlcgen.GetCountryBoundariesByContinentRow) []GeoJSONFeature {
	features := make([]GeoJSONFeature, 0, len(rows))
	for _, row := range rows {
		feature := GeoJSONFeature{
			Type: "Feature",
			ID:   row.ID,
			Properties: map[string]interface{}{
				"id":             row.ID,
				"code":           row.Code,
				"name":           row.Name,
				"continent_code": row.ContinentCode,
				"continent_name": row.ContinentName,
				"has_adm1":       row.HasAdm1,
				"has_adm2":       row.HasAdm2,
			},
			Geometry: json.RawMessage(row.BoundaryGeojson),
		}

		if row.Adm1Label != nil {
			feature.Properties["adm1_label"] = *row.Adm1Label
		}
		if row.Adm2Label != nil {
			feature.Properties["adm2_label"] = *row.Adm2Label
		}
		if row.AreaKm2 != nil {
			feature.Properties["area_km2"] = *row.AreaKm2
		}
		if row.CentroidLng != nil && row.CentroidLat != nil {
			feature.Properties["centroid"] = []interface{}{row.CentroidLng, row.CentroidLat}
		}

		features = append(features, feature)
	}
	return features
}

func convertRegionBoundariesToFeatures(rows []sqlcgen.GetRegionBoundariesByCountryRow) []GeoJSONFeature {
	features := make([]GeoJSONFeature, 0, len(rows))
	for _, row := range rows {
		feature := GeoJSONFeature{
			Type: "Feature",
			ID:   row.ID,
			Properties: map[string]interface{}{
				"id":           row.ID,
				"name":         row.Name,
				"code":         row.Code,
				"country_code": row.CountryCode,
				"country_name": row.CountryName,
			},
			Geometry: json.RawMessage(row.BoundaryGeojson),
		}

		if row.AreaKm2 != nil {
			feature.Properties["area_km2"] = *row.AreaKm2
		}
		if row.CentroidLng != nil && row.CentroidLat != nil {
			feature.Properties["centroid"] = []interface{}{row.CentroidLng, row.CentroidLat}
		}

		features = append(features, feature)
	}
	return features
}

func convertDistrictBoundariesToFeatures(rows []sqlcgen.GetDistrictBoundariesByCountryRow) []GeoJSONFeature {
	features := make([]GeoJSONFeature, 0, len(rows))
	for _, row := range rows {
		feature := GeoJSONFeature{
			Type: "Feature",
			ID:   row.ID,
			Properties: map[string]interface{}{
				"id":           row.ID,
				"name":         row.Name,
				"code":         row.Code,
				"region_id":    row.RegionID,
				"region_code":  row.RegionCode,
				"region_name":  row.RegionName,
				"country_code": row.CountryCode,
			},
			Geometry: json.RawMessage(row.BoundaryGeojson),
		}

		if row.AreaKm2 != nil {
			feature.Properties["area_km2"] = *row.AreaKm2
		}
		if row.CentroidLng != nil && row.CentroidLat != nil {
			feature.Properties["centroid"] = []interface{}{row.CentroidLng, row.CentroidLat}
		}

		features = append(features, feature)
	}
	return features
}

func convertDistrictBoundariesByRegionToFeatures(rows []sqlcgen.GetDistrictBoundariesByRegionRow) []GeoJSONFeature {
	features := make([]GeoJSONFeature, 0, len(rows))
	for _, row := range rows {
		feature := GeoJSONFeature{
			Type: "Feature",
			ID:   row.ID,
			Properties: map[string]interface{}{
				"id":          row.ID,
				"name":        row.Name,
				"code":        row.Code,
				"region_code": row.RegionCode,
				"region_name": row.RegionName,
			},
			Geometry: json.RawMessage(row.BoundaryGeojson),
		}

		if row.AreaKm2 != nil {
			feature.Properties["area_km2"] = *row.AreaKm2
		}
		if row.CentroidLng != nil && row.CentroidLat != nil {
			feature.Properties["centroid"] = []interface{}{row.CentroidLng, row.CentroidLat}
		}

		features = append(features, feature)
	}
	return features
}

// SmartLookupPointLocation performs zoom-aware point lookup with recommended selection level
// @Summary Smart point-in-polygon lookup
// @Description Given lat/lng coordinates and zoom level, returns all geographic levels with a recommended selection level based on entity sizes relative to viewport
// @Tags Geographic Boundaries
// @Produce json
// @Param lat query number true "Latitude"
// @Param lng query number true "Longitude"
// @Param zoom query number false "Map zoom level (0-20, default 5)"
// @Success 200 {object} APIResponse{data=SmartLookupResponse} "Smart location lookup result"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid coordinates"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /geo/boundaries/at-point [get]
func (h *Handlers) SmartLookupPointLocation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")
	zoomStr := r.URL.Query().Get("zoom")

	if latStr == "" || lngStr == "" {
		RespondBadRequest(w, r, "lat and lng query parameters are required")
		return
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil || lat < -90 || lat > 90 {
		RespondBadRequest(w, r, "Invalid latitude value")
		return
	}

	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil || lng < -180 || lng > 180 {
		RespondBadRequest(w, r, "Invalid longitude value")
		return
	}

	zoom := 5.0 // default
	if zoomStr != "" {
		zoom, err = strconv.ParseFloat(zoomStr, 64)
		if err != nil || zoom < 0 || zoom > 22 {
			zoom = 5.0
		}
	}

	response := SmartLookupResponse{
		RecommendedLevel: "country", // default
		Levels:           SmartLookupLevels{},
	}

	// Lookup all levels with area information
	result, err := h.db.Queries.LookupAllLevelsByPointWithArea(ctx, sqlcgen.LookupAllLevelsByPointWithAreaParams{
		StMakepoint:   lng,
		StMakepoint_2: lat,
	})
	if err != nil {
		// No country found at this point (ocean, etc.)
		RespondJSON(w, r, http.StatusOK, response)
		return
	}

	// Build country info
	countryLabel := "Country"
	if result.Adm1Label != nil && *result.Adm1Label != "" {
		countryLabel = "Country"
	}
	response.Levels.Country = &SmartLevelInfo{
		ID:      result.CountryID,
		Code:    result.CountryCode,
		Name:    result.CountryName,
		AreaKm2: result.CountryAreaKm2,
		Label:   countryLabel,
	}

	// Build region info if available
	if result.RegionID != nil {
		regionLabel := "Region"
		if result.Adm1Label != nil && *result.Adm1Label != "" {
			regionLabel = *result.Adm1Label
		}
		response.Levels.Region = &SmartLevelInfo{
			ID:      *result.RegionID,
			Code:    *result.RegionCode,
			Name:    *result.RegionName,
			AreaKm2: result.RegionAreaKm2,
			Label:   regionLabel,
		}
	}

	// Build district info if available
	if result.DistrictID != nil {
		districtLabel := "District"
		if result.Adm2Label != nil && *result.Adm2Label != "" {
			districtLabel = *result.Adm2Label
		}
		response.Levels.District = &SmartLevelInfo{
			ID:      *result.DistrictID,
			Code:    *result.DistrictCode,
			Name:    *result.DistrictName,
			AreaKm2: result.DistrictAreaKm2,
			Label:   districtLabel,
		}
	}

	// Calculate recommended level based on zoom and entity areas
	response.RecommendedLevel = calculateRecommendedLevel(zoom, result)

	// Find nearby cities for city-level selection
	if response.RecommendedLevel == "city" || zoom >= 8 {
		cities, err := h.db.Queries.LookupNearestCities(ctx, sqlcgen.LookupNearestCitiesParams{
			StMakepoint:   lng,
			StMakepoint_2: lat,
			StDwithin:     50000, // 50km radius
			Limit:         5,
		})
		if err == nil && len(cities) > 0 {
			for _, c := range cities {
				nc := NearestCity{
					ID:          c.ID,
					Name:        c.Name,
					CountryCode: c.CountryCode,
					DistanceKm:  float64(c.DistanceKm),
				}
				nc.RegionName = &c.RegionName
				if c.DistrictName != nil {
					nc.DistrictName = c.DistrictName
				}
				response.NearbyCities = append(response.NearbyCities, nc)
			}
		}
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// calculateRecommendedLevel determines the best selection level based on zoom and entity areas
// Returns the most specific level that is large enough to be clickable at the current zoom
func calculateRecommendedLevel(zoom float64, result sqlcgen.LookupAllLevelsByPointWithAreaRow) string {
	// Cap zoom at 12 - beyond this is street level, just select nearest city
	// Zoom 12 ≈ 380m viewport width, good enough to identify a city
	const maxUsefulZoom = 12.0
	if zoom > maxUsefulZoom {
		return "city"
	}

	// Calculate viewport area based on Web Mercator tile math
	// meters_per_pixel ≈ 156543 / 2^zoom (at equator)
	// Assuming a ~1000x1000 pixel viewport (typical map embed)
	//
	// Zoom  0: ~24,500 km² viewport
	// Zoom  5: ~24 km² viewport
	// Zoom 10: ~6 km² viewport
	// Zoom 12: ~0.4 km² viewport (max useful)
	metersPerPixel := 156543.0 / math.Pow(2, zoom)
	viewportWidthKm := metersPerPixel * 1000 / 1000 // 1000 pixels, convert m to km
	viewportAreaKm2 := viewportWidthKm * viewportWidthKm

	// Minimum entity area relative to viewport for it to be "selectable"
	// Entity should be at least 0.5% of viewport to be easily clickable
	minSelectableRatio := 0.005
	minSelectableArea := viewportAreaKm2 * minSelectableRatio

	// Helper to check if an area is large enough to select
	isSelectable := func(areaKm2 *float64) bool {
		return areaKm2 != nil && *areaKm2 >= minSelectableArea
	}

	// City-states (Monaco, Vatican, Singapore) - always recommend city
	// These are too small to meaningfully select at country level
	if result.IsCityState != nil && *result.IsCityState {
		return "city"
	}

	// Try most specific level first, fall back to broader levels if too small

	// District: only recommend if large enough to click
	if result.DistrictID != nil && isSelectable(result.DistrictAreaKm2) {
		return "district"
	}

	// Region: only recommend if large enough to click
	if result.RegionID != nil && isSelectable(result.RegionAreaKm2) {
		return "region"
	}

	// Country: only recommend if large enough to click
	if isSelectable(result.CountryAreaKm2) {
		return "country"
	}

	// Country is too small for current zoom - recommend city selection
	// This handles cases like clicking on Monaco at low zoom where the country
	// itself is too small to be a meaningful selection target
	return "city"
}
