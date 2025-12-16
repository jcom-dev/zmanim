// File: geo_boundaries.go
// Purpose: Geographic boundary handlers - STUBBED after Overture migration
// Pattern: 6-step-handler
// Note: Boundary tables were removed in migration 4. Localities are point-only.

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
	Country         *CountryInfo      `json:"country,omitempty"`
	Region          *RegionInfo       `json:"region,omitempty"`
	NearestLocality *NearestLocality  `json:"nearest_locality,omitempty"`
	Localities      []NearestLocality `json:"localities,omitempty"`
}

// SmartLookupResponse represents the response from zoom-aware point lookup
type SmartLookupResponse struct {
	RecommendedLevel string            `json:"recommended_level"` // country, region, locality
	Levels           SmartLookupLevels `json:"levels"`
	NearbyLocalities []NearestLocality `json:"nearby_localities,omitempty"`
}

// SmartLookupLevels contains all available levels at a point
type SmartLookupLevels struct {
	Country *SmartLevelInfo `json:"country,omitempty"`
	Region  *SmartLevelInfo `json:"region,omitempty"`
}

// SmartLevelInfo represents a geographic level with area for smart selection
type SmartLevelInfo struct {
	ID    interface{} `json:"id"`
	Code  string      `json:"code"`
	Name  string      `json:"name"`
	Label string      `json:"label,omitempty"` // e.g., "State", "Province", "County"
}

// CountryInfo represents country info in lookup response
type CountryInfo struct {
	ID        int16  `json:"id"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	ADM1Label string `json:"adm1_label,omitempty"`
}

// RegionInfo represents region info in lookup response
type RegionInfo struct {
	ID        int32  `json:"id"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	CountryID int16  `json:"country_id,omitempty"`
}

// NearestLocality represents a nearby locality in lookup response
type NearestLocality struct {
	ID          int32   `json:"id"`
	Name        string  `json:"name"`
	CountryCode string  `json:"country_code"`
	RegionName  *string `json:"region_name,omitempty"`
	DistanceKm  float64 `json:"distance_km"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
}

// GetCountryBoundaries returns empty feature collection (boundaries removed in Overture migration)
//
//	@Summary		Get country boundaries
//	@Description	Returns empty GeoJSON FeatureCollection - boundary tables were removed
//	@Tags			Geographic Boundaries
//	@Produce		json
//	@Param			continent	query		string						false	"Filter by continent code (e.g., EU, NA, AS)"
//	@Success		200			{object}	GeoJSONFeatureCollection	"GeoJSON FeatureCollection (empty)"
//	@Router			/geo/boundaries/countries [get]
func (h *Handlers) GetCountryBoundaries(w http.ResponseWriter, r *http.Request) {
	continent := r.URL.Query().Get("continent")

	metadata := map[string]interface{}{
		"level":   "country",
		"count":   0,
		"message": "Boundary data not available - point-only data in Overture migration",
	}
	if continent != "" {
		metadata["continent"] = continent
	}

	fc := GeoJSONFeatureCollection{
		Type:     "FeatureCollection",
		Metadata: metadata,
		Features: []GeoJSONFeature{},
	}

	RespondJSON(w, r, http.StatusOK, fc)
}

// getCountryBoundariesFromCache returns cached country boundaries or nil if not cached
func (h *Handlers) getCountryBoundariesFromCache(ctx context.Context) []byte {
	countryBoundariesCacheMu.RLock()
	defer countryBoundariesCacheMu.RUnlock()

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

// GetRegionBoundaries returns empty feature collection (boundaries removed)
//
//	@Summary		Get region boundaries (ADM1)
//	@Description	Returns empty GeoJSON FeatureCollection - boundary tables were removed
//	@Tags			Geographic Boundaries
//	@Produce		json
//	@Param			country_code	query		string						true	"ISO 3166-1 alpha-2 country code (e.g., US, IL, GB)"
//	@Success		200				{object}	GeoJSONFeatureCollection	"GeoJSON FeatureCollection (empty)"
//	@Failure		400				{object}	APIResponse{error=APIError}	"Country code is required"
//	@Router			/geo/boundaries/regions [get]
func (h *Handlers) GetRegionBoundaries(w http.ResponseWriter, r *http.Request) {
	countryCode := r.URL.Query().Get("country_code")
	if countryCode == "" {
		countryCode = r.URL.Query().Get("country_id")
	}

	if countryCode == "" {
		RespondBadRequest(w, r, "country_code is required")
		return
	}

	metadata := map[string]interface{}{
		"level":        "region",
		"country_code": countryCode,
		"count":        0,
		"message":      "Boundary data not available - point-only data in Overture migration",
	}

	fc := GeoJSONFeatureCollection{
		Type:     "FeatureCollection",
		Metadata: metadata,
		Features: []GeoJSONFeature{},
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(fc)
}

// LookupPointLocation finds nearest localities at coordinates
//
//	@Summary		Point lookup
//	@Description	Given lat/lng coordinates, returns nearby localities with country/region info
//	@Tags			Geographic Boundaries
//	@Produce		json
//	@Param			lat	query		number									true	"Latitude"
//	@Param			lng	query		number									true	"Longitude"
//	@Success		200	{object}	APIResponse{data=PointLookupResponse}	"Location lookup result"
//	@Failure		400	{object}	APIResponse{error=APIError}				"Invalid coordinates"
//	@Failure		500	{object}	APIResponse{error=APIError}				"Internal server error"
//	@Router			/geo/boundaries/lookup [get]
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

	// Find nearest localities (within 50km, limit 5)
	localities, err := h.db.Queries.GetLocalitiesNearPoint(ctx, sqlcgen.GetLocalitiesNearPointParams{
		Lat:      lat,
		Lng:      lng,
		RadiusM:  50000, // 50km in meters
		LimitVal: 5,
	})
	if err != nil {
		slog.Error("failed to get localities near point", "error", err, "lat", lat, "lng", lng)
		RespondInternalError(w, r, "Failed to lookup location")
		return
	}

	for _, loc := range localities {
		distanceKm := 0.0
		if loc.DistanceM != nil {
			if dist, ok := loc.DistanceM.(float64); ok {
				distanceKm = dist / 1000.0
			}
		}
		nl := NearestLocality{
			ID:          loc.ID,
			Name:        loc.Name,
			CountryCode: loc.CountryCode,
			DistanceKm:  distanceKm,
			Latitude:    loc.Latitude,
			Longitude:   loc.Longitude,
		}
		response.Localities = append(response.Localities, nl)
	}

	if len(response.Localities) > 0 {
		response.NearestLocality = &response.Localities[0]

		// Get country info from the nearest locality
		nearestLoc := localities[0]
		if nearestLoc.CountryID != nil {
			country, err := h.db.Queries.GetCountryByID(ctx, *nearestLoc.CountryID)
			if err == nil {
				response.Country = &CountryInfo{
					ID:   country.ID,
					Code: country.Code,
					Name: country.Name,
				}
				if country.Adm1Label != nil {
					response.Country.ADM1Label = *country.Adm1Label
				}
			}
		}

		// Get region info from the nearest locality's inherited region
		if nearestLoc.InheritedRegionID != nil {
			region, err := h.db.Queries.GetRegionByID(ctx, *nearestLoc.InheritedRegionID)
			if err == nil {
				response.Region = &RegionInfo{
					ID:   region.ID,
					Code: region.Code,
					Name: region.Name,
				}
				if nearestLoc.CountryID != nil {
					response.Region.CountryID = *nearestLoc.CountryID
				}
			}
		}
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// GetBoundaryStats returns statistics about boundary coverage
//
//	@Summary		Get boundary statistics
//	@Description	Returns counts of boundaries at each level (all zeros after Overture migration)
//	@Tags			Geographic Boundaries
//	@Produce		json
//	@Success		200	{object}	APIResponse					"Boundary statistics"
//	@Failure		500	{object}	APIResponse{error=APIError}	"Internal server error"
//	@Router			/geo/boundaries/stats [get]
func (h *Handlers) GetBoundaryStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	stats, err := h.db.Queries.GetBoundaryStats(ctx)
	if err != nil {
		slog.Error("failed to get boundary stats", "error", err)
		RespondInternalError(w, r, "Failed to get boundary stats")
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"countries": stats.CountryBoundaries,
		"regions":   stats.RegionBoundaries,
		"message":   "Boundary tables were removed in Overture migration - all counts are 0",
	})
}

// SmartLookupPointLocation performs zoom-aware point lookup
//
//	@Summary		Smart point lookup
//	@Description	Given lat/lng coordinates and zoom level, returns recommended selection level
//	@Tags			Geographic Boundaries
//	@Produce		json
//	@Param			lat		query		number									true	"Latitude"
//	@Param			lng		query		number									true	"Longitude"
//	@Param			zoom	query		number									false	"Map zoom level (0-20, default 5)"
//	@Success		200		{object}	APIResponse{data=SmartLookupResponse}	"Smart location lookup result"
//	@Failure		400		{object}	APIResponse{error=APIError}				"Invalid coordinates"
//	@Failure		500		{object}	APIResponse{error=APIError}				"Internal server error"
//	@Router			/geo/boundaries/at-point [get]
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

	zoom := 5.0
	if zoomStr != "" {
		zoom, err = strconv.ParseFloat(zoomStr, 64)
		if err != nil || zoom < 0 || zoom > 22 {
			zoom = 5.0
		}
	}

	response := SmartLookupResponse{
		RecommendedLevel: "country",
		Levels:           SmartLookupLevels{},
	}

	// Find nearby localities to derive country/region info
	localities, err := h.db.Queries.GetLocalitiesNearPoint(ctx, sqlcgen.GetLocalitiesNearPointParams{
		Lng:      lng,
		Lat:      lat,
		RadiusM:  100000, // 100km radius for country/region detection
		LimitVal: 10,
	})
	if err != nil {
		slog.Error("failed to get localities near point", "error", err, "lat", lat, "lng", lng)
		RespondInternalError(w, r, "Failed to lookup location")
		return
	}

	// Derive country and region from nearest locality
	if len(localities) > 0 {
		nearestLoc := localities[0]

		// Get country info
		if nearestLoc.CountryID != nil {
			country, err := h.db.Queries.GetCountryByID(ctx, *nearestLoc.CountryID)
			if err == nil {
				response.Levels.Country = &SmartLevelInfo{
					ID:    country.ID,
					Code:  country.Code,
					Name:  country.Name,
					Label: "Country",
				}

				// Get region info from inherited region
				if nearestLoc.InheritedRegionID != nil {
					region, err := h.db.Queries.GetRegionByID(ctx, *nearestLoc.InheritedRegionID)
					if err == nil {
						regionLabel := "Region"
						if country.Adm1Label != nil && *country.Adm1Label != "" {
							regionLabel = *country.Adm1Label
						}
						response.Levels.Region = &SmartLevelInfo{
							ID:    region.ID,
							Code:  region.Code,
							Name:  region.Name,
							Label: regionLabel,
						}
					}
				}
			}
		}

		// Build nearby localities list
		for _, loc := range localities {
			distanceKm := 0.0
			if loc.DistanceM != nil {
				if dist, ok := loc.DistanceM.(float64); ok {
					distanceKm = dist / 1000.0
				}
			}
			nl := NearestLocality{
				ID:          loc.ID,
				Name:        loc.Name,
				CountryCode: loc.CountryCode,
				DistanceKm:  distanceKm,
				Latitude:    loc.Latitude,
				Longitude:   loc.Longitude,
			}
			response.NearbyLocalities = append(response.NearbyLocalities, nl)
		}
	}

	// Determine recommended level based on zoom
	if zoom >= 8 {
		response.RecommendedLevel = "locality"
	} else if zoom >= 5 && response.Levels.Region != nil {
		response.RecommendedLevel = "region"
	} else {
		response.RecommendedLevel = "country"
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// GetFeatureGeometry returns a single feature's geometry for map preview
//
//	@Summary		Get single feature geometry
//	@Description	Returns GeoJSON geometry for a specific geographic feature
//	@Tags			Geography
//	@Produce		json
//	@Param			type	path		string						true	"Feature type: country, region, or locality"
//	@Param			id		path		string						true	"Feature ID"
//	@Success		200		{object}	GeoJSONFeature				"GeoJSON Feature with geometry"
//	@Failure		400		{object}	APIResponse{error=APIError}	"Invalid type or ID"
//	@Failure		404		{object}	APIResponse{error=APIError}	"Feature not found"
//	@Router			/geo/feature/{type}/{id} [get]
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
	case "locality":
		id, parseErr := strconv.ParseInt(featureID, 10, 32)
		if parseErr != nil {
			RespondBadRequest(w, r, "Invalid locality ID")
			return
		}
		feature, err = h.getLocalityFeature(ctx, int32(id))
	default:
		RespondBadRequest(w, r, "Invalid type. Must be: country, region, or locality")
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
	// Get country info with boundary geometry
	country, err := h.db.Queries.GetCountryBoundaryGeoJSON(ctx, code)
	if err != nil {
		return GeoJSONFeature{}, fmt.Errorf("not found")
	}

	// Check if we have boundary geometry
	hasBoundary := false
	if b, ok := country.HasBoundary.(bool); ok {
		hasBoundary = b
	}

	var geometry json.RawMessage
	if boundaryStr, ok := country.BoundaryGeojson.(string); ok && boundaryStr != "" && hasBoundary {
		geometry = json.RawMessage(boundaryStr)
	} else {
		geometry = json.RawMessage(`null`)
	}

	return GeoJSONFeature{
		Type: "Feature",
		ID:   country.Code,
		Properties: map[string]interface{}{
			"type":         "country",
			"id":           country.ID,
			"code":         country.Code,
			"name":         country.Name,
			"has_boundary": hasBoundary,
		},
		Geometry: geometry,
	}, nil
}

func (h *Handlers) getRegionFeature(ctx context.Context, id int32) (GeoJSONFeature, error) {
	// Get region info with boundary geometry
	region, err := h.db.Queries.GetRegionBoundaryGeoJSON(ctx, id)
	if err != nil {
		return GeoJSONFeature{}, fmt.Errorf("not found")
	}

	// Check if we have boundary geometry
	hasBoundary := false
	if b, ok := region.HasBoundary.(bool); ok {
		hasBoundary = b
	}

	var geometry json.RawMessage
	if boundaryStr, ok := region.BoundaryGeojson.(string); ok && boundaryStr != "" && hasBoundary {
		geometry = json.RawMessage(boundaryStr)
	} else {
		geometry = json.RawMessage(`null`)
	}

	return GeoJSONFeature{
		Type: "Feature",
		ID:   region.ID,
		Properties: map[string]interface{}{
			"type":         "region",
			"id":           region.ID,
			"code":         region.Code,
			"name":         region.Name,
			"has_boundary": hasBoundary,
		},
		Geometry: geometry,
	}, nil
}

func (h *Handlers) getLocalityFeature(ctx context.Context, id int32) (GeoJSONFeature, error) {
	// Get locality info with boundary geometry
	locality, err := h.db.Queries.GetLocalityBoundaryGeoJSON(ctx, id)
	if err != nil {
		return GeoJSONFeature{}, fmt.Errorf("not found")
	}

	// Extract coordinates (nullable)
	var lat, lng float64
	if locality.Latitude != nil {
		lat = *locality.Latitude
	}
	if locality.Longitude != nil {
		lng = *locality.Longitude
	}

	// Check if we have boundary geometry
	hasBoundary := false
	if b, ok := locality.HasBoundary.(bool); ok {
		hasBoundary = b
	}

	// Use boundary GeoJSON if available, otherwise fallback to point
	var geometry json.RawMessage
	if boundaryStr, ok := locality.BoundaryGeojson.(string); ok && boundaryStr != "" {
		geometry = json.RawMessage(boundaryStr)
	} else {
		// Fallback to point geometry
		pointGeometry := fmt.Sprintf(`{"type":"Point","coordinates":[%f,%f]}`, lng, lat)
		geometry = json.RawMessage(pointGeometry)
	}

	return GeoJSONFeature{
		Type: "Feature",
		ID:   locality.ID,
		Properties: map[string]interface{}{
			"type":         "locality",
			"id":           locality.ID,
			"name":         locality.Name,
			"latitude":     lat,
			"longitude":    lng,
			"has_boundary": hasBoundary,
		},
		Geometry: geometry,
	}, nil
}
