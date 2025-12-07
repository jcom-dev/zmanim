package handlers

import (
	"log/slog"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim-lab/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim-lab/internal/models"
)

// SearchCities handles city search with autocomplete and filtering
// @Summary Search cities
// @Description Search for cities by name with optional filtering by country, region, or continent. Uses fuzzy matching for typo tolerance.
// @Tags Cities
// @Produce json
// @Param search query string false "Search query (min 2 chars for fuzzy match)"
// @Param country_code query string false "ISO 3166-1 alpha-2 country code"
// @Param region_code query string false "Region/state code"
// @Param continent_code query string false "Continent code (AF, AS, EU, NA, OC, SA, AN)"
// @Param limit query int false "Max results (default 20, max 100)"
// @Param offset query int false "Offset for pagination (default 0)"
// @Success 200 {object} APIResponse{data=models.CitySearchResponse} "List of matching cities"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid parameters"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /cities [get]
func (h *Handlers) SearchCities(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get query parameters
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	countryCode := strings.TrimSpace(r.URL.Query().Get("country_code"))
	regionCode := strings.TrimSpace(r.URL.Query().Get("region_code"))
	continentCode := strings.TrimSpace(r.URL.Query().Get("continent_code"))

	// Parse limit (default 20, max 100)
	limit := int32(20)
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = int32(parsed)
		}
	}

	// Parse offset
	offset := int32(0)
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = int32(parsed)
		}
	}

	// If search is provided and long enough, use fuzzy search
	if search != "" && len(search) >= 2 {
		rows, err := h.db.Queries.SearchCitiesFuzzy(ctx, sqlcgen.SearchCitiesFuzzyParams{
			ContinentCode: nullableString(continentCode),
			CountryCode:   nullableString(countryCode),
			RegionCode:    nullableString(regionCode),
			Search:        nullableString(search),
			Limit:         limit,
		})
		if err != nil {
			slog.Error("failed to search cities", "error", err, "search", search)
			RespondInternalError(w, r, "Failed to search cities")
			return
		}

		cities := make([]models.City, 0, len(rows))
		for _, row := range rows {
			city := searchCitiesFuzzyRowToCity(row)
			cities = append(cities, city)
		}

		RespondJSON(w, r, http.StatusOK, models.CitySearchResponse{
			Cities: cities,
			Total:  len(cities),
		})
		return
	}

	// Use standard search with filters
	rows, err := h.db.Queries.SearchCities(ctx, sqlcgen.SearchCitiesParams{
		ContinentCode: nullableString(continentCode),
		CountryCode:   nullableString(countryCode),
		RegionCode:    nullableString(regionCode),
		SearchName:    nullableString(search),
		Limit:         limit,
		Offset:        offset,
	})
	if err != nil {
		slog.Error("failed to search cities", "error", err, "search", search)
		RespondInternalError(w, r, "Failed to search cities")
		return
	}

	cities := make([]models.City, 0, len(rows))
	for _, row := range rows {
		city := searchCitiesRowToCity(row)
		cities = append(cities, city)
	}

	RespondJSON(w, r, http.StatusOK, models.CitySearchResponse{
		Cities: cities,
		Total:  len(cities),
	})
}

// GetNearbyCity finds the nearest city to given coordinates
// @Summary Find nearest city
// @Description Finds the nearest city to the given GPS coordinates using PostGIS spatial queries
// @Tags Cities
// @Produce json
// @Param lat query number true "Latitude (-90 to 90)"
// @Param lng query number true "Longitude (-180 to 180)"
// @Success 200 {object} APIResponse{data=object} "Nearest city with distance"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid coordinates"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /cities/nearby [get]
func (h *Handlers) GetNearbyCity(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse latitude
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

	// Parse longitude
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

	// Use SQLc query for nearest city
	row, err := h.db.Queries.GetNearestCity(ctx, sqlcgen.GetNearestCityParams{
		Longitude: lng,
		Latitude:  lat,
	})
	if err != nil {
		slog.Error("failed to find nearby city", "error", err, "lat", lat, "lng", lng)
		RespondInternalError(w, r, "Failed to find nearby city")
		return
	}

	city := nearestCityRowToCity(row)
	distanceMeters := row.DistanceMeters

	// Return city with distance info
	response := map[string]interface{}{
		"city":           city,
		"distance_km":    math.Round(distanceMeters/1000*10) / 10,
		"distance_miles": math.Round(distanceMeters/1609.34*10) / 10,
		"searched_lat":   lat,
		"searched_lng":   lng,
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// GetCityByID returns a single city by ID
// @Summary Get city by ID
// @Description Returns a single city by its ID
// @Tags Cities
// @Produce json
// @Param id path string true "City ID"
// @Success 200 {object} APIResponse{data=models.City} "City details"
// @Failure 404 {object} APIResponse{error=APIError} "City not found"
// @Router /cities/{id} [get]
func (h *Handlers) GetCityByID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get city ID from URL path
	idStr := chi.URLParam(r, "id")
	if idStr == "" {
		RespondBadRequest(w, r, "City ID is required")
		return
	}

	// Convert string ID to int32
	cityID, err := stringToInt32(idStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid city ID")
		return
	}

	row, err := h.db.Queries.GetCityByID(ctx, cityID)
	if err != nil {
		RespondNotFound(w, r, "City not found")
		return
	}

	city := getCityByIDRowToCity(row)
	RespondJSON(w, r, http.StatusOK, city)
}

// GetCountries returns all countries, optionally filtered by continent
// @Summary List countries
// @Description Returns all countries with optional continent filter
// @Tags Geographic
// @Produce json
// @Param continent_code query string false "Continent code filter (AF, AS, EU, NA, OC, SA, AN)"
// @Success 200 {object} APIResponse{data=[]object} "List of countries"
// @Router /countries [get]
func (h *Handlers) GetCountries(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	continentCode := r.URL.Query().Get("continent_code")

	if continentCode != "" {
		rows, err := h.db.Queries.GetCountriesByContinent(ctx, continentCode)
		if err != nil {
			slog.Error("failed to get countries by continent", "error", err)
			RespondInternalError(w, r, "Failed to get countries")
			return
		}
		RespondJSON(w, r, http.StatusOK, rows)
		return
	}

	rows, err := h.db.Queries.GetCountries(ctx)
	if err != nil {
		slog.Error("failed to get countries", "error", err)
		RespondInternalError(w, r, "Failed to get countries")
		return
	}
	RespondJSON(w, r, http.StatusOK, rows)
}

// GetCountryByCode returns a single country by its ISO code
// @Summary Get country by code
// @Description Returns a single country by its ISO 3166-1 alpha-2 code
// @Tags Geographic
// @Produce json
// @Param country_code path string true "ISO 3166-1 alpha-2 country code"
// @Success 200 {object} APIResponse{data=object} "Country details"
// @Failure 404 {object} APIError "Country not found"
// @Router /countries/{country_code} [get]
func (h *Handlers) GetCountryByCode(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	countryCode := chi.URLParam(r, "country_code")
	if countryCode == "" {
		RespondBadRequest(w, r, "Country code is required")
		return
	}

	row, err := h.db.Queries.GetCountryByCode(ctx, countryCode)
	if err != nil {
		slog.Error("failed to get country", "error", err, "code", countryCode)
		RespondNotFound(w, r, "Country not found")
		return
	}
	RespondJSON(w, r, http.StatusOK, row)
}

// GetContinents returns all continents with city counts
// @Summary List continents
// @Description Returns all continents with their city counts
// @Tags Geographic
// @Produce json
// @Success 200 {object} APIResponse{data=[]object} "List of continents"
// @Router /continents [get]
func (h *Handlers) GetContinents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	rows, err := h.db.Queries.GetContinents(ctx)
	if err != nil {
		slog.Error("failed to get continents", "error", err)
		RespondInternalError(w, r, "Failed to get continents")
		return
	}
	RespondJSON(w, r, http.StatusOK, rows)
}

// GetRegionsByCountry returns regions for a country
// @Summary List regions by country
// @Description Returns all regions/states for a given country code
// @Tags Geographic
// @Produce json
// @Param country_code path string true "ISO 3166-1 alpha-2 country code"
// @Success 200 {object} APIResponse{data=[]object} "List of regions"
// @Router /countries/{country_code}/regions [get]
func (h *Handlers) GetRegionsByCountry(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	countryCode := chi.URLParam(r, "country_code")
	if countryCode == "" {
		RespondBadRequest(w, r, "Country code is required")
		return
	}

	rows, err := h.db.Queries.GetRegionsByCountry(ctx, countryCode)
	if err != nil {
		slog.Error("failed to get regions", "error", err, "country", countryCode)
		RespondInternalError(w, r, "Failed to get regions")
		return
	}
	RespondJSON(w, r, http.StatusOK, rows)
}

// GetDistrictsByCountry returns districts for a country
// @Summary List districts by country
// @Description Returns all districts for a given country code
// @Tags Geographic
// @Produce json
// @Param country_code path string true "ISO 3166-1 alpha-2 country code"
// @Success 200 {object} APIResponse{data=[]object} "List of districts"
// @Router /countries/{country_code}/districts [get]
func (h *Handlers) GetDistrictsByCountry(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	countryCode := chi.URLParam(r, "country_code")
	if countryCode == "" {
		RespondBadRequest(w, r, "Country code is required")
		return
	}

	rows, err := h.db.Queries.GetDistrictsByCountry(ctx, countryCode)
	if err != nil {
		slog.Error("failed to get districts", "error", err, "country", countryCode)
		RespondInternalError(w, r, "Failed to get districts")
		return
	}
	RespondJSON(w, r, http.StatusOK, rows)
}

// GetDistrictsByRegion returns districts for a region
// @Summary List districts by region
// @Description Returns all districts for a given region ID
// @Tags Geographic
// @Produce json
// @Param region_id path int true "Region ID"
// @Success 200 {object} APIResponse{data=[]object} "List of districts"
// @Router /regions/{region_id}/districts [get]
func (h *Handlers) GetDistrictsByRegion(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	regionIDStr := chi.URLParam(r, "region_id")
	if regionIDStr == "" {
		RespondBadRequest(w, r, "Region ID is required")
		return
	}

	regionID, err := strconv.ParseInt(regionIDStr, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid region ID")
		return
	}

	rows, err := h.db.Queries.GetDistrictsByRegion(ctx, int32(regionID))
	if err != nil {
		slog.Error("failed to get districts", "error", err, "region_id", regionID)
		RespondInternalError(w, r, "Failed to get districts")
		return
	}
	RespondJSON(w, r, http.StatusOK, rows)
}

// Helper functions to convert SQLc rows to models.City

func searchCitiesRowToCity(row sqlcgen.SearchCitiesRow) models.City {
	city := models.City{
		ID:          int32ToString(row.ID),
		Name:        row.Name,
		Country:     row.Country,
		CountryCode: row.CountryCode,
		Region:      &row.Region,
		Latitude:    row.Latitude,
		Longitude:   row.Longitude,
		Timezone:    row.Timezone,
		Continent:   &row.Continent,
	}
	if row.Population != nil {
		pop := int(*row.Population)
		city.Population = &pop
	}
	if row.ElevationM != nil {
		elev := int(*row.ElevationM)
		city.Elevation = &elev
	}
	city.DisplayName = buildDisplayName(city)
	return city
}

func searchCitiesFuzzyRowToCity(row sqlcgen.SearchCitiesFuzzyRow) models.City {
	city := models.City{
		ID:          int32ToString(row.ID),
		Name:        row.Name,
		Country:     row.Country,
		CountryCode: row.CountryCode,
		Region:      &row.Region,
		Latitude:    row.Latitude,
		Longitude:   row.Longitude,
		Timezone:    row.Timezone,
		Continent:   &row.Continent,
	}
	if row.Population != nil {
		pop := int(*row.Population)
		city.Population = &pop
	}
	if row.ElevationM != nil {
		elev := int(*row.ElevationM)
		city.Elevation = &elev
	}
	city.DisplayName = buildDisplayName(city)
	return city
}

func getCityByIDRowToCity(row sqlcgen.GetCityByIDRow) models.City {
	city := models.City{
		ID:          int32ToString(row.ID),
		Name:        row.Name,
		Country:     row.Country,
		CountryCode: row.CountryCode,
		Region:      &row.Region,
		Latitude:    row.Latitude,
		Longitude:   row.Longitude,
		Timezone:    row.Timezone,
		Continent:   &row.Continent,
	}
	if row.Population != nil {
		pop := int(*row.Population)
		city.Population = &pop
	}
	if row.ElevationM != nil {
		elev := int(*row.ElevationM)
		city.Elevation = &elev
	}
	city.DisplayName = buildDisplayName(city)
	return city
}

func nearestCityRowToCity(row sqlcgen.GetNearestCityRow) models.City {
	city := models.City{
		ID:          int32ToString(row.ID),
		Name:        row.Name,
		Country:     row.Country,
		CountryCode: row.CountryCode,
		Region:      &row.Region,
		Latitude:    row.Latitude,
		Longitude:   row.Longitude,
		Timezone:    row.Timezone,
		Continent:   &row.Continent,
	}
	if row.Population != nil {
		pop := int(*row.Population)
		city.Population = &pop
	}
	if row.ElevationM != nil {
		elev := int(*row.ElevationM)
		city.Elevation = &elev
	}
	city.DisplayName = buildDisplayName(city)
	return city
}

// buildDisplayName creates a formatted display name for a city
func buildDisplayName(city models.City) string {
	parts := []string{city.Name}

	if city.Region != nil && *city.Region != "" {
		parts = append(parts, *city.Region)
	}

	parts = append(parts, city.Country)

	return strings.Join(parts, ", ")
}

// nullableString returns a pointer to the string if non-empty, nil otherwise
func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
