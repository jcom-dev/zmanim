// File: external_api.go
// Purpose: External API handlers for M2M authenticated endpoints
// Pattern: 6-step-handler
// Dependencies: Queries: external_api.sql | Services: Cache
// Epic: 8 - Finalize and External API
// Story: 8.5 - List Publisher Zmanim for External API

package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim/internal/services"
	"github.com/redis/go-redis/v9"
)

// ExternalPublisherZman represents a zman for external API response
type ExternalPublisherZman struct {
	ZmanKey        string `json:"zman_key"`
	MasterZmanID   string `json:"master_zman_id,omitempty"`
	EnglishName    string `json:"english_name"`
	HebrewName     string `json:"hebrew_name"`
	VersionID      string `json:"version_id"`
	FormulaType    string `json:"formula_type"`
	FormulaSummary string `json:"formula_summary"`
}

// ExternalPublisherZmanimResponse is the response structure for GET /external/publishers/{id}/zmanim
type ExternalPublisherZmanimResponse struct {
	PublisherID   string                  `json:"publisher_id"`
	PublisherName string                  `json:"publisher_name"`
	Zmanim        []ExternalPublisherZman `json:"zmanim"`
	Total         int                     `json:"total"`
	GeneratedAt   string                  `json:"generated_at"`
}

// BulkZmanimRequest is the request structure for POST /external/zmanim/calculate
type BulkZmanimRequest struct {
	PublisherID string          `json:"publisher_id"`
	LocalityID  int32           `json:"locality_id"`
	DateRange   BulkDateRange   `json:"date_range"`
	Zmanim      []BulkZmanQuery `json:"zmanim"`
}

// BulkDateRange represents a date range for bulk calculation
type BulkDateRange struct {
	Start string `json:"start"` // YYYY-MM-DD
	End   string `json:"end"`   // YYYY-MM-DD
}

// BulkZmanQuery represents a zman to calculate
type BulkZmanQuery struct {
	ZmanKey   string `json:"zman_key"`
	VersionID string `json:"version_id,omitempty"`
}

// BulkZmanimResponse is the response structure for POST /external/zmanim/calculate
type BulkZmanimResponse struct {
	PublisherID       string            `json:"publisher_id"`
	Location          LocationInfo      `json:"location"`
	Results           []BulkZmanResult  `json:"results"`
	DateRange         BulkDateRangeInfo `json:"date_range"`
	Cached            bool              `json:"cached"`
	CalculationTimeMS int64             `json:"calculation_time_ms"`
	GeneratedAt       string            `json:"generated_at"`
}

// BulkZmanResult represents the times for a single zman across the date range
type BulkZmanResult struct {
	ZmanKey   string            `json:"zman_key"`
	VersionID string            `json:"version_id"`
	Times     map[string]string `json:"times"` // date -> time (HH:MM:SS)
}

// BulkDateRangeInfo provides summary of the date range
type BulkDateRangeInfo struct {
	Start string `json:"start"`
	End   string `json:"end"`
	Days  int    `json:"days"`
}

// GetExternalPublisherZmanim returns all enabled zmanim for a publisher (external API)
//
//	@Summary		List publisher zmanim (External API)
//	@Description	Returns all enabled zmanim for a publisher with formula metadata for external API consumers
//	@Tags			External API
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string												true	"Publisher ID"
//	@Success		200	{object}	APIResponse{data=ExternalPublisherZmanimResponse}	"Publisher zmanim list"
//	@Failure		400	{object}	APIResponse{error=APIError}							"Invalid publisher ID"
//	@Failure		401	{object}	APIResponse{error=APIError}							"Unauthorized"
//	@Failure		404	{object}	APIResponse{error=APIError}							"Publisher not found"
//	@Failure		500	{object}	APIResponse{error=APIError}							"Internal server error"
//	@Router			/external/publishers/{id}/zmanim [get]
func (h *Handlers) GetExternalPublisherZmanim(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Extract/resolve context - publisher ID from URL (not from header for external API)
	publisherIDStr := chi.URLParam(r, "id")
	if publisherIDStr == "" {
		RespondBadRequest(w, r, "Publisher ID is required")
		return
	}

	// 2. Validate publisher ID
	publisherID, err := stringToInt32(publisherIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID format")
		return
	}

	// Check cache first (1 hour TTL)
	cacheKey := fmt.Sprintf("external:publisher:%s:zmanim", publisherIDStr)
	if h.cache != nil {
		// Access Redis client directly for external API caching
		cached, err := h.cache.Client().Get(ctx, cacheKey).Bytes()
		if err == nil && cached != nil {
			var response ExternalPublisherZmanimResponse
			if err := json.Unmarshal(cached, &response); err == nil {
				slog.Info("serving cached external zmanim list", "publisher_id", publisherIDStr)
				w.Header().Set("Cache-Control", "public, max-age=3600") // 1 hour
				RespondJSON(w, r, http.StatusOK, response)
				return
			}
		} else if err != redis.Nil {
			slog.Warn("cache get error", "error", err, "key", cacheKey)
		}
	}

	// 3. Parse body - none for GET request

	// 4. Validate - verify publisher exists and get name
	publisher, err := h.db.Queries.GetPublisherByID(ctx, publisherID)
	if err != nil {
		slog.Error("failed to get publisher", "error", err, "publisher_id", publisherID)
		RespondNotFound(w, r, "Publisher not found")
		return
	}

	// 5. SQLc query - get enabled zmanim
	zmanim, err := h.db.Queries.GetPublisherZmanimForExternal(ctx, publisherID)
	if err != nil {
		slog.Error("failed to fetch external zmanim", "error", err, "publisher_id", publisherID)
		RespondInternalError(w, r, "Failed to fetch zmanim")
		return
	}

	// Convert to response format
	externalZmanim := make([]ExternalPublisherZman, 0, len(zmanim))
	for _, z := range zmanim {
		var masterZmanID string
		if z.ID != 0 {
			masterZmanID = int32ToString(z.ID)
		}

		// Type assertions for interface{} fields (formula_summary comes from CASE in SQL)
		formulaSummary, _ := z.FormulaSummary.(string)

		externalZmanim = append(externalZmanim, ExternalPublisherZman{
			ZmanKey:        z.ZmanKey,
			MasterZmanID:   masterZmanID,
			EnglishName:    z.EnglishName,
			HebrewName:     z.HebrewName,
			VersionID:      z.VersionID, // Now directly a string
			FormulaType:    z.FormulaType,
			FormulaSummary: formulaSummary,
		})
	}

	// 6. Respond with formatted response
	response := ExternalPublisherZmanimResponse{
		PublisherID:   publisherIDStr,
		PublisherName: publisher.Name,
		Zmanim:        externalZmanim,
		Total:         len(externalZmanim),
		GeneratedAt:   time.Now().UTC().Format(time.RFC3339),
	}

	// Cache the response for 1 hour
	if h.cache != nil {
		if responseJSON, err := json.Marshal(response); err == nil {
			if err := h.cache.Client().Set(ctx, cacheKey, responseJSON, 3600*time.Second).Err(); err != nil {
				slog.Warn("failed to cache external zmanim list", "error", err, "publisher_id", publisherIDStr)
			}
		}
	}

	// Set cache headers
	w.Header().Set("Cache-Control", "public, max-age=3600") // 1 hour

	slog.Info("fetched external zmanim list", "publisher_id", publisherIDStr, "count", len(externalZmanim))
	RespondJSON(w, r, http.StatusOK, response)
}

// CalculateExternalBulkZmanim calculates zmanim for a date range (Story 8-6)
//
//	@Summary		Calculate bulk zmanim (External API)
//	@Description	Calculates zmanim for up to 365 days in one request
//	@Tags			External API
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			request	body		BulkZmanimRequest						true	"Bulk calculation request"
//	@Success		200		{object}	APIResponse{data=BulkZmanimResponse}	"Bulk calculation results"
//	@Failure		400		{object}	APIResponse{error=APIError}				"Invalid request"
//	@Failure		401		{object}	APIResponse{error=APIError}				"Unauthorized"
//	@Failure		404		{object}	APIResponse{error=APIError}				"Publisher or locality not found"
//	@Failure		500		{object}	APIResponse{error=APIError}				"Internal server error"
//	@Router			/external/zmanim/calculate [post]
func (h *Handlers) CalculateExternalBulkZmanim(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	startTime := time.Now()

	// 1. Extract/resolve context - none needed for this endpoint

	// 2. URL params - none

	// 3. Parse request body
	var req BulkZmanimRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// 4. Validate request
	// Validate publisher ID
	if req.PublisherID == "" {
		RespondBadRequest(w, r, "publisher_id is required")
		return
	}
	publisherID, err := stringToInt32(req.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher_id format")
		return
	}

	// Validate locality ID
	if req.LocalityID <= 0 {
		RespondBadRequest(w, r, "locality_id is required")
		return
	}

	// Validate and parse dates
	if req.DateRange.Start == "" || req.DateRange.End == "" {
		RespondBadRequest(w, r, "date_range.start and date_range.end are required")
		return
	}

	startDate, err := time.Parse("2006-01-02", req.DateRange.Start)
	if err != nil {
		RespondBadRequest(w, r, "Invalid date_range.start format (use YYYY-MM-DD)")
		return
	}

	endDate, err := time.Parse("2006-01-02", req.DateRange.End)
	if err != nil {
		RespondBadRequest(w, r, "Invalid date_range.end format (use YYYY-MM-DD)")
		return
	}

	// Validate date range
	if endDate.Before(startDate) {
		RespondBadRequest(w, r, "date_range.end must be after date_range.start")
		return
	}

	// Calculate number of days
	daysDiff := int(endDate.Sub(startDate).Hours()/24) + 1
	if daysDiff > 365 {
		RespondBadRequest(w, r, "date_range cannot exceed 365 days")
		return
	}

	// Validate zmanim list
	if len(req.Zmanim) == 0 {
		RespondBadRequest(w, r, "zmanim list cannot be empty")
		return
	}

	// 5. SQLc queries - get publisher and locality
	_, err = h.db.Queries.GetPublisherByID(ctx, publisherID)
	if err != nil {
		slog.Error("failed to get publisher", "error", err, "publisher_id", publisherID)
		RespondNotFound(w, r, "Publisher not found")
		return
	}

	locality, err := h.db.Queries.GetLocalityByID(ctx, req.LocalityID)
	if err != nil {
		slog.Error("failed to get locality", "error", err, "locality_id", req.LocalityID)
		RespondNotFound(w, r, "Locality not found")
		return
	}

	// Get publisher's enabled zmanim
	publisherZmanim, err := h.db.Queries.GetPublisherZmanimForExternal(ctx, publisherID)
	if err != nil {
		slog.Error("failed to fetch publisher zmanim", "error", err, "publisher_id", publisherID)
		RespondInternalError(w, r, "Failed to fetch publisher zmanim")
		return
	}

	// Build map of publisher zmanim for quick lookup
	zmanimMap := make(map[string]struct {
		Formula   string
		VersionID string
	})
	for _, pz := range publisherZmanim {
		zmanimMap[pz.ZmanKey] = struct {
			Formula   string
			VersionID string
		}{
			Formula:   pz.FormulaDsl,
			VersionID: pz.VersionID, // Now directly a string
		}
	}

	// Validate requested zmanim keys
	for _, z := range req.Zmanim {
		if _, exists := zmanimMap[z.ZmanKey]; !exists {
			RespondBadRequest(w, r, fmt.Sprintf("zman_key '%s' not found or not enabled for this publisher", z.ZmanKey))
			return
		}
	}

	// Calculate zmanim for the date range using the unified service
	// (timezone is derived from locality by the service)
	dayResults, err := h.zmanimService.CalculateRange(ctx, services.RangeParams{
		LocalityID:  int64(req.LocalityID),
		PublisherID: publisherID,
		StartDate:   startDate,
		EndDate:     endDate,
	})
	if err != nil {
		slog.Error("failed to calculate bulk zmanim", "error", err)
		RespondInternalError(w, r, "Failed to calculate zmanim")
		return
	}

	// Transform service results (per-day) to external API format (per-zman)
	results := transformDayResultsToBulkResults(dayResults, req.Zmanim, zmanimMap)

	// 6. Respond with results
	calculationTime := time.Since(startTime).Milliseconds()

	// Extract coordinates (nullable via LEFT JOIN from view)
	var lat, lng float64
	if locality.Latitude != nil {
		lat = *locality.Latitude
	}
	if locality.Longitude != nil {
		lng = *locality.Longitude
	}

	// Handle optional fields
	var displayHierarchyStr string
	if locality.DisplayHierarchy != nil {
		displayHierarchyStr = *locality.DisplayHierarchy
	}

	response := BulkZmanimResponse{
		PublisherID: req.PublisherID,
		Location: LocationInfo{
			LocalityID:       strconv.FormatInt(int64(locality.ID), 10),
			LocalityName:     locality.Name,
			Country:          locality.CountryName,
			CountryCode:      locality.CountryCode,
			Region:           nil, // Not available in this query
			DisplayHierarchy: displayHierarchyStr,
			Latitude:         lat,
			Longitude:        lng,
			Elevation:        0, // Not available in bulk query
			Timezone:         locality.Timezone,
		},
		Results: results,
		DateRange: BulkDateRangeInfo{
			Start: req.DateRange.Start,
			End:   req.DateRange.End,
			Days:  daysDiff,
		},
		Cached:            false,
		CalculationTimeMS: calculationTime,
		GeneratedAt:       time.Now().UTC().Format(time.RFC3339),
	}

	// Log the bulk calculation (AC: 7 - bulk API calls log efficiently)
	if h.calculationLogService != nil {
		// Log each day in the date range
		logEntries := make([]services.CalculationLogEntry, 0, daysDiff)
		for d := startDate; d.Before(endDate) || d.Equal(endDate); d = d.AddDate(0, 0, 1) {
			logEntries = append(logEntries, services.CalculationLogEntry{
				PublisherID:    publisherID,
				LocalityID:     int64(req.LocalityID),
				DateCalculated: d,
				CacheHit:       false,
				ResponseTimeMs: int16(calculationTime / int64(daysDiff)),
				ZmanCount:      int16(len(req.Zmanim)),
				Source:         services.SourceExternal,
			})
		}
		h.calculationLogService.LogBatch(logEntries)
	}

	slog.Info("calculated bulk zmanim",
		"publisher_id", req.PublisherID,
		"locality_id", req.LocalityID,
		"days", daysDiff,
		"zmanim_count", len(req.Zmanim),
		"calculation_time_ms", calculationTime)

	RespondJSON(w, r, http.StatusOK, response)
}

// transformDayResultsToBulkResults transforms per-day results to per-zman results
// Service returns []DayResult (each day has all zmanim)
// External API expects []BulkZmanResult (each zman has all days)
func transformDayResultsToBulkResults(
	dayResults []services.DayResult,
	requestedZmanim []BulkZmanQuery,
	zmanimMap map[string]struct{ Formula, VersionID string },
) []BulkZmanResult {
	// Initialize results structure for each requested zman
	results := make([]BulkZmanResult, len(requestedZmanim))
	for i, z := range requestedZmanim {
		zmInfo := zmanimMap[z.ZmanKey]
		results[i] = BulkZmanResult{
			ZmanKey:   z.ZmanKey,
			VersionID: zmInfo.VersionID,
			Times:     make(map[string]string, len(dayResults)),
		}
	}

	// Populate times from day results
	for _, dayResult := range dayResults {
		for _, calculatedZman := range dayResult.Zmanim {
			// Find the corresponding result entry
			for i := range results {
				if results[i].ZmanKey == calculatedZman.Key {
					// Use rounded time (HH:MM) for bulk export display
					results[i].Times[dayResult.Date] = calculatedZman.TimeRounded
					break
				}
			}
		}
	}

	return results
}
