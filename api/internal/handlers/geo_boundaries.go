// File: geo_boundaries.go
// Purpose: PostGIS geographic queries - country/region/city boundary lookup
// Pattern: 6-step-handler
// Dependencies: Queries: geo_boundaries.sql (PostGIS ST_Contains)
// Frequency: high - 781 lines
// Compliance: Check docs/adr/ for pattern rationale

package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// In-memory cache for country boundaries (static data, rarely changes)
var (
	countryBoundariesCache     []byte
	countryBoundariesCacheOnce sync.Once
	countryBoundariesCacheMu   sync.RWMutex
	countryBoundariesCacheTime time.Time
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
	RecommendedLevel string             `json:"recommended_level"` // country, region, district, city
	Levels           SmartLookupLevels  `json:"levels"`
	Counts           *SmartLookupCounts `json:"counts,omitempty"`   // Entity counts for debugging/frontend logic
	VisibleCounts    *VisibleCounts     `json:"visible_counts,omitempty"` // Counts of entities in viewport
	NearbyCities     []NearestCity      `json:"nearby_cities,omitempty"`
}

// SmartLookupCounts contains entity counts used for selection logic
type SmartLookupCounts struct {
	Regions           int `json:"regions"`             // Total regions in country
	Districts         int `json:"districts"`           // Total districts in country
	DistrictsInRegion int `json:"districts_in_region"` // Districts in current region
}

// VisibleCounts contains counts of entities visible in the current viewport
type VisibleCounts struct {
	Countries int `json:"countries"` // Countries visible in viewport
	Regions   int `json:"regions"`   // Regions visible in viewport
	Districts int `json:"districts"` // Districts visible in viewport
}

// SmartLookupLevels contains all available levels at a point
type SmartLookupLevels struct {
	Country  *SmartLevelInfo `json:"country,omitempty"`
	Region   *SmartLevelInfo `json:"region,omitempty"`
	District *SmartLevelInfo `json:"district,omitempty"`
}

// SmartLevelInfo represents a geographic level with area for smart selection
type SmartLevelInfo struct {
	ID      interface{} `json:"id"`
	Code    string      `json:"code"`
	Name    string      `json:"name"`
	AreaKm2 *float64    `json:"area_km2,omitempty"`
	Label   string      `json:"label,omitempty"` // e.g., "State", "Province", "County"
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

	// For all-countries request, use in-memory cache (data is static)
	if continent == "" {
		cached := h.getCountryBoundariesFromCache(ctx)
		if cached != nil {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Cache-Control", "public, max-age=86400") // 24 hours
			w.Header().Set("X-Cache", "HIT")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(cached)
			return
		}
	}

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

		// Cache the result for all-countries request
		fc := GeoJSONFeatureCollection{
			Type:     "FeatureCollection",
			Metadata: metadata,
			Features: features,
		}
		if data, err := json.Marshal(fc); err == nil {
			h.cacheCountryBoundaries(data)
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Cache-Control", "public, max-age=86400")
			w.Header().Set("X-Cache", "MISS")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(data)
			return
		}
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

// getCountryBoundariesFromCache returns cached country boundaries or nil if not cached
func (h *Handlers) getCountryBoundariesFromCache(ctx context.Context) []byte {
	countryBoundariesCacheMu.RLock()
	defer countryBoundariesCacheMu.RUnlock()

	// Return cache if it exists and is less than 24 hours old
	if countryBoundariesCache != nil && time.Since(countryBoundariesCacheTime) < 24*time.Hour {
		return countryBoundariesCache
	}
	return nil
}

// cacheCountryBoundaries stores country boundaries in memory
func (h *Handlers) cacheCountryBoundaries(data []byte) {
	countryBoundariesCacheMu.Lock()
	defer countryBoundariesCacheMu.Unlock()

	countryBoundariesCache = data
	countryBoundariesCacheTime = time.Now()
	slog.Info("cached country boundaries", "size_bytes", len(data))
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

// GetCityBoundaries retrieves city boundaries for multiple cities by IDs
// @Summary Get city boundaries
// @Description Returns GeoJSON boundaries for specified cities
// @Tags Geographic Boundaries
// @Produce json
// @Param city_ids query string true "Comma-separated list of city IDs (e.g., '123,456,789')"
// @Success 200 {object} GeoJSONFeatureCollection "GeoJSON FeatureCollection of city boundaries"
// @Failure 400 {object} APIResponse{error=APIError} "city_ids is required"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /geo/boundaries/cities [get]
func (h *Handlers) GetCityBoundaries(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	cityIDsStr := r.URL.Query().Get("city_ids")

	if cityIDsStr == "" {
		RespondBadRequest(w, r, "city_ids parameter is required")
		return
	}

	// Parse comma-separated city IDs
	cityIDStrs := strings.Split(cityIDsStr, ",")
	cityIDs := make([]int32, 0, len(cityIDStrs))
	for _, idStr := range cityIDStrs {
		id, err := strconv.ParseInt(strings.TrimSpace(idStr), 10, 32)
		if err != nil {
			RespondBadRequest(w, r, fmt.Sprintf("Invalid city ID: %s", idStr))
			return
		}
		cityIDs = append(cityIDs, int32(id))
	}

	// Fetch city boundaries from database
	rows, err := h.db.Queries.GetCityBoundariesByIDs(ctx, cityIDs)
	if err != nil {
		slog.Error("failed to get city boundaries", "error", err, "city_ids", cityIDs)
		RespondInternalError(w, r, "Failed to get city boundaries")
		return
	}

	// Convert to GeoJSON features
	features := make([]GeoJSONFeature, 0, len(rows))
	for _, row := range rows {
		// Extract centroid coordinates with proper type conversion
		centroidLng, _ := row.CentroidLng.(float64)
		centroidLat, _ := row.CentroidLat.(float64)

		feature := GeoJSONFeature{
			Type:     "Feature",
			ID:       int(row.ID),
			Geometry: json.RawMessage(row.BoundaryGeojson),
			Properties: map[string]interface{}{
				"id":           row.ID,
				"name":         row.Name,
				"country_code": row.CountryCode,
				"region_name":  row.RegionName,
				"area_km2":     row.AreaKm2,
				"centroid":     []float64{centroidLng, centroidLat},
			},
		}
		features = append(features, feature)
	}

	fc := GeoJSONFeatureCollection{
		Type: "FeatureCollection",
		Metadata: map[string]interface{}{
			"level": "city",
			"count": len(features),
		},
		Features: features,
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(fc)
}

func (h *Handlers) GetCityBoundary(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	cityIDStr := r.URL.Query().Get("city_id")

	if cityIDStr == "" {
		RespondBadRequest(w, r, "city_id parameter is required")
		return
	}

	cityID, err := strconv.ParseInt(cityIDStr, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, fmt.Sprintf("Invalid city ID: %s", cityIDStr))
		return
	}

	// Fetch city boundary from database
	row, err := h.db.Queries.GetCityBoundaryByID(ctx, int32(cityID))
	if err != nil {
		if err.Error() == "no rows in result set" {
			RespondNotFound(w, r, "City boundary not found")
			return
		}
		slog.Error("failed to get city boundary", "error", err, "city_id", cityID)
		RespondInternalError(w, r, "Failed to get city boundary")
		return
	}

	feature := GeoJSONFeature{
		Type:     "Feature",
		ID:       int(row.ID),
		Geometry: json.RawMessage(row.BoundaryGeojson),
		Properties: map[string]interface{}{
			"id":           row.ID,
			"name":         row.Name,
			"country_code": row.CountryCode,
			"region_name":  row.RegionName,
			"district_name": row.DistrictName,
			"area_km2":     row.AreaKm2,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(feature)
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

	// Parse optional viewport bounds (west,south,east,north)
	boundsStr := r.URL.Query().Get("bounds")
	var bounds *[4]float64
	if boundsStr != "" {
		parts := strings.Split(boundsStr, ",")
		if len(parts) == 4 {
			var b [4]float64
			valid := true
			for i, p := range parts {
				b[i], err = strconv.ParseFloat(p, 64)
				if err != nil {
					valid = false
					break
				}
			}
			if valid {
				bounds = &b
			}
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

	// Add counts to response for debugging/frontend logic
	response.Counts = &SmartLookupCounts{
		Regions:           int(result.RegionCount),
		Districts:         int(result.DistrictCount),
		DistrictsInRegion: int(result.DistrictsInRegion),
	}

	// Estimate visible entities from viewport size and country data
	// This is much faster than running COUNT queries
	var visibleCounts *VisibleCounts
	if bounds != nil {
		viewportWidth := bounds[2] - bounds[0]   // east - west (degrees)
		viewportHeight := bounds[3] - bounds[1]  // north - south (degrees)

		// Estimate counts based on viewport size and known data density
		// World is ~360x180 degrees, ~200 countries → ~0.003 countries/sq degree
		// France (~10x10 degrees) has ~100 regions → ~1 region/sq degree in dense areas
		// France has ~3700 districts → ~37 districts/sq degree
		viewportArea := viewportWidth * viewportHeight

		// Rough estimates based on where the click is (use country data if available)
		estCountries := int(viewportArea * 0.003) // Very rough global average
		if estCountries < 1 {
			estCountries = 1
		}

		estRegions := 0
		estDistricts := 0

		// Use country-specific data for better estimates
		if result.RegionCount > 0 && result.CountryAreaKm2 != nil {
			// Estimate how much of the country is visible
			// Rough conversion: 1 degree ≈ 111km at equator
			viewportKm2 := viewportWidth * viewportHeight * 111 * 111 * 0.7 // 0.7 for latitude adjustment
			countryFraction := viewportKm2 / *result.CountryAreaKm2
			if countryFraction > 1 {
				countryFraction = 1
			}
			estRegions = int(float64(result.RegionCount) * countryFraction)
			if estRegions < 1 && viewportKm2 < *result.CountryAreaKm2/2 {
				estRegions = 1 // At least 1 region if viewport is smaller than half the country
			}

			estDistricts = int(float64(result.DistrictCount) * countryFraction)
		}

		visibleCounts = &VisibleCounts{
			Countries: estCountries,
			Regions:   estRegions,
			Districts: estDistricts,
		}
		response.VisibleCounts = visibleCounts
	}

	// Calculate recommended level based on visible entities (or fallback to zoom-based)
	response.RecommendedLevel = calculateRecommendedLevel(zoom, result, visibleCounts)

	// Find nearby cities for city-level selection
	if response.RecommendedLevel == "city" || zoom >= 8 {
		cities, err := h.db.Queries.LookupNearestCities(ctx, sqlcgen.LookupNearestCitiesParams{
			StMakepoint:   lng,
			StMakepoint_2: lat,
			StDwithin:     50000, // 50km radius
			Limit:         5,
		})
		if err != nil {
			slog.Error("LookupNearestCities failed", "error", err, "lng", lng, "lat", lat)
		}
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

// calculateRecommendedLevel determines the best selection level based on visible entities
// Logic: Use the number of visible entities to determine granularity
// - Few visible (1-5): Select at this level - it's clear what the user clicked
// - Medium visible (6-30): Select at this level - manageable choices
// - Many visible (30+): Might be overwhelming, but zoom-based rules apply
func calculateRecommendedLevel(zoom float64, result sqlcgen.LookupAllLevelsByPointWithAreaRow, visible *VisibleCounts) string {
	// City-states (Monaco, Vatican, Singapore) - always recommend city
	if result.IsCityState != nil && *result.IsCityState {
		return "city"
	}

	// At high zoom (10+), recommend city selection
	if zoom >= 10.0 {
		return "city"
	}

	// If we have visible counts, use them for smart selection
	if visible != nil {
		// The key insight: if user is zoomed into 1 country but can see many regions,
		// they probably want to select a region. If they see 1 region with many districts,
		// they probably want a district.

		// Priority: most specific level where entities are visible
		// But only if zoom level supports it

		// District level: zoom >= 6 and districts visible and not too many
		if zoom >= 6.0 && result.DistrictID != nil && visible.Districts > 0 {
			// At zoom 6-8 with moderate districts, select district
			if visible.Districts <= 50 {
				return "district"
			}
			// Too many districts - select region instead
			if result.RegionID != nil {
				return "region"
			}
		}

		// Region level: zoom >= 3.5 and regions visible
		if zoom >= 3.5 && result.RegionID != nil && visible.Regions > 0 {
			// If only 1 country visible, prefer region selection
			if visible.Countries <= 1 && visible.Regions <= 30 {
				return "region"
			}
			// If 2-5 countries visible but we're zoomed enough, still allow region
			if visible.Countries <= 5 && zoom >= 5.0 {
				return "region"
			}
		}

		// Country level: few countries visible
		if visible.Countries >= 2 && visible.Countries <= 10 {
			return "country"
		}

		// Only 1 country visible - go more specific if available
		if visible.Countries == 1 {
			if result.RegionID != nil {
				return "region"
			}
		}
	}

	// Fallback: use zoom-based logic when no visible counts
	if zoom >= 8.0 && result.DistrictID != nil {
		return "district"
	}
	if zoom >= 4.0 && result.RegionID != nil {
		return "region"
	}
	return "country"
}

// GetFeatureGeometry returns a single feature's geometry for map preview
// @Summary Get single feature geometry
// @Description Returns GeoJSON geometry for a specific geographic feature (country, region, district, or city). For cities without boundaries, returns a point geometry.
// @Tags Geography
// @Produce json
// @Param type path string true "Feature type: country, region, district, or city"
// @Param id path string true "Feature ID (numeric for region/district/city, or country code for country)"
// @Success 200 {object} GeoJSONFeature "GeoJSON Feature with geometry"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid type or ID"
// @Failure 404 {object} APIResponse{error=APIError} "Feature not found"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /geo/feature/{type}/{id} [get]
func (h *Handlers) GetFeatureGeometry(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	featureType := strings.ToLower(chi.URLParam(r, "type"))
	featureID := chi.URLParam(r, "id")

	if featureType == "" || featureID == "" {
		RespondBadRequest(w, r, "Type and ID are required")
		return
	}

	var feature GeoJSONFeature
	var err error

	switch featureType {
	case "country":
		feature, err = h.getCountryFeature(ctx, featureID)
	case "region":
		id, parseErr := strconv.ParseInt(featureID, 10, 32)
		if parseErr != nil {
			RespondBadRequest(w, r, "Invalid region ID")
			return
		}
		feature, err = h.getRegionFeature(ctx, int32(id))
	case "district":
		id, parseErr := strconv.ParseInt(featureID, 10, 32)
		if parseErr != nil {
			RespondBadRequest(w, r, "Invalid district ID")
			return
		}
		feature, err = h.getDistrictFeature(ctx, int32(id))
	case "city":
		id, parseErr := strconv.ParseInt(featureID, 10, 32)
		if parseErr != nil {
			RespondBadRequest(w, r, "Invalid city ID")
			return
		}
		feature, err = h.getCityFeature(ctx, int32(id))
	default:
		RespondBadRequest(w, r, "Invalid type. Must be: country, region, district, or city")
		return
	}

	if err != nil {
		if err.Error() == "not found" {
			RespondNotFound(w, r, "Feature not found")
			return
		}
		slog.Error("failed to get feature geometry", "type", featureType, "id", featureID, "error", err)
		RespondInternalError(w, r, "Failed to get feature geometry")
		return
	}

	RespondJSON(w, r, http.StatusOK, feature)
}

func (h *Handlers) getCountryFeature(ctx context.Context, code string) (GeoJSONFeature, error) {
	// Try by ID first if numeric, else by code
	if id, parseErr := strconv.ParseInt(code, 10, 16); parseErr == nil {
		row, err := h.db.Queries.GetCountryBoundaryByID(ctx, int16(id))
		if err != nil {
			return GeoJSONFeature{}, fmt.Errorf("not found")
		}
		centroid := []float64{0, 0}
		if lng, ok := row.CentroidLng.(float64); ok {
			centroid[0] = lng
		}
		if lat, ok := row.CentroidLat.(float64); ok {
			centroid[1] = lat
		}
		return GeoJSONFeature{
			Type: "Feature",
			ID:   row.Code,
			Properties: map[string]interface{}{
				"type":     "country",
				"id":       row.ID,
				"code":     row.Code,
				"name":     row.Name,
				"area_km2": row.AreaKm2,
				"centroid": centroid,
			},
			Geometry: json.RawMessage(row.BoundaryGeojson),
		}, nil
	}

	// Must be a country code - look up by code
	row, err := h.db.Queries.GetCountryBoundaryByCode(ctx, code)
	if err != nil {
		return GeoJSONFeature{}, fmt.Errorf("not found")
	}
	centroid := []float64{0, 0}
	if lng, ok := row.CentroidLng.(float64); ok {
		centroid[0] = lng
	}
	if lat, ok := row.CentroidLat.(float64); ok {
		centroid[1] = lat
	}
	return GeoJSONFeature{
		Type: "Feature",
		ID:   row.Code,
		Properties: map[string]interface{}{
			"type":     "country",
			"id":       row.ID,
			"code":     row.Code,
			"name":     row.Name,
			"area_km2": row.AreaKm2,
			"centroid": centroid,
		},
		Geometry: json.RawMessage(row.BoundaryGeojson),
	}, nil
}

func (h *Handlers) getRegionFeature(ctx context.Context, id int32) (GeoJSONFeature, error) {
	row, err := h.db.Queries.GetRegionBoundaryByID(ctx, id)
	if err != nil {
		return GeoJSONFeature{}, fmt.Errorf("not found")
	}

	centroid := []float64{0, 0}
	if lng, ok := row.CentroidLng.(float64); ok {
		centroid[0] = lng
	}
	if lat, ok := row.CentroidLat.(float64); ok {
		centroid[1] = lat
	}

	return GeoJSONFeature{
		Type: "Feature",
		ID:   row.ID,
		Properties: map[string]interface{}{
			"type":         "region",
			"id":           row.ID,
			"code":         row.Code,
			"name":         row.Name,
			"country_code": row.CountryCode,
			"country_name": row.CountryName,
			"area_km2":     row.AreaKm2,
			"centroid":     centroid,
		},
		Geometry: json.RawMessage(row.BoundaryGeojson),
	}, nil
}

func (h *Handlers) getDistrictFeature(ctx context.Context, id int32) (GeoJSONFeature, error) {
	row, err := h.db.Queries.GetDistrictBoundaryByID(ctx, id)
	if err != nil {
		return GeoJSONFeature{}, fmt.Errorf("not found")
	}

	centroid := []float64{0, 0}
	if lng, ok := row.CentroidLng.(float64); ok {
		centroid[0] = lng
	}
	if lat, ok := row.CentroidLat.(float64); ok {
		centroid[1] = lat
	}

	return GeoJSONFeature{
		Type: "Feature",
		ID:   row.ID,
		Properties: map[string]interface{}{
			"type":         "district",
			"id":           row.ID,
			"code":         row.Code,
			"name":         row.Name,
			"region_id":    row.RegionID,
			"region_name":  row.RegionName,
			"country_code": row.CountryCode,
			"country_name": row.CountryName,
			"area_km2":     row.AreaKm2,
			"centroid":     centroid,
		},
		Geometry: json.RawMessage(row.BoundaryGeojson),
	}, nil
}

func (h *Handlers) getCityFeature(ctx context.Context, id int32) (GeoJSONFeature, error) {
	// First try to get boundary
	row, err := h.db.Queries.GetCityBoundaryByID(ctx, id)
	if err == nil && row.BoundaryGeojson != "" {
		// Has boundary polygon
		return GeoJSONFeature{
			Type: "Feature",
			ID:   row.ID,
			Properties: map[string]interface{}{
				"type":         "city",
				"id":           row.ID,
				"name":         row.Name,
				"area_km2":     row.AreaKm2,
				"has_boundary": true,
			},
			Geometry: json.RawMessage(row.BoundaryGeojson),
		}, nil
	}

	// No boundary - return point geometry from city coordinates
	city, err := h.db.Queries.GetCityByID(ctx, id)
	if err != nil {
		return GeoJSONFeature{}, fmt.Errorf("not found")
	}

	// Create point GeoJSON
	pointGeometry := fmt.Sprintf(`{"type":"Point","coordinates":[%f,%f]}`, city.Longitude, city.Latitude)

	return GeoJSONFeature{
		Type: "Feature",
		ID:   city.ID,
		Properties: map[string]interface{}{
			"type":         "city",
			"id":           city.ID,
			"name":         city.Name,
			"latitude":     city.Latitude,
			"longitude":    city.Longitude,
			"has_boundary": false,
		},
		Geometry: json.RawMessage(pointGeometry),
	}, nil
}
