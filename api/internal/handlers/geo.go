// File: geo.go
// Purpose: Geographic endpoints - continents, countries, regions
// Pattern: 6-step-handler
// Dependencies: Queries: geo.sql
// Frequency: moderate - static geographic data with in-memory caching
//
// Geographic endpoints provide reference data for location selection.
// Continents are cached in memory since they never change.

package handlers

import (
	"log/slog"
	"net/http"
	"sync"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// Continents are static geographic data - cache them in memory
var (
	continentsCache       []sqlcgen.GetContinentsRow
	continentsCacheMu     sync.RWMutex
	continentsCacheLoaded bool
)

// GetCountries returns all countries, optionally filtered by continent
//
//	@Summary		List countries
//	@Description	Returns all countries with optional continent filter
//	@Tags			Geographic
//	@Produce		json
//	@Param			continent_code	query		string						false	"Continent code filter (AF, AS, EU, NA, OC, SA, AN)"
//	@Success		200				{object}	APIResponse{data=[]object}	"List of countries"
//	@Router			/countries [get]
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
//
//	@Summary		Get country by code
//	@Description	Returns a single country by its ISO 3166-1 alpha-2 code
//	@Tags			Geographic
//	@Produce		json
//	@Param			country_code	path		string						true	"ISO 3166-1 alpha-2 country code"
//	@Success		200				{object}	APIResponse{data=object}	"Country details"
//	@Failure		404				{object}	APIError					"Country not found"
//	@Router			/countries/{country_code} [get]
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

// GetContinents returns all continents with locality counts
//
//	@Summary		List continents
//	@Description	Returns all continents with their locality counts
//	@Tags			Geographic
//	@Produce		json
//	@Success		200	{object}	APIResponse{data=[]object}	"List of continents"
//	@Router			/continents [get]
func (h *Handlers) GetContinents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Check cache first (read lock)
	continentsCacheMu.RLock()
	if continentsCacheLoaded {
		result := continentsCache
		continentsCacheMu.RUnlock()
		RespondJSON(w, r, http.StatusOK, result)
		return
	}
	continentsCacheMu.RUnlock()

	// Cache miss - load from database
	rows, err := h.db.Queries.GetContinents(ctx)
	if err != nil {
		slog.Error("failed to get continents", "error", err)
		RespondInternalError(w, r, "Failed to get continents")
		return
	}

	// Store in cache
	continentsCacheMu.Lock()
	continentsCache = rows
	continentsCacheLoaded = true
	continentsCacheMu.Unlock()

	slog.Info("loaded continents into cache", "count", len(rows))
	RespondJSON(w, r, http.StatusOK, rows)
}

// GetRegionsByCountry returns regions for a country
//
//	@Summary		List regions by country
//	@Description	Returns all regions/states for a given country code
//	@Tags			Geographic
//	@Produce		json
//	@Param			country_code	path		string						true	"ISO 3166-1 alpha-2 country code"
//	@Success		200				{object}	APIResponse{data=[]object}	"List of regions"
//	@Router			/countries/{country_code}/regions [get]
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
