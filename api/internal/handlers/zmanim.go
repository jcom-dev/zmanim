package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/jcom-dev/zmanim-lab/internal/algorithm"
	"github.com/jcom-dev/zmanim-lab/internal/astro"
	"github.com/jcom-dev/zmanim-lab/internal/calendar"
	"github.com/jcom-dev/zmanim-lab/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim-lab/internal/middleware"
	"github.com/jcom-dev/zmanim-lab/internal/models"
)

// ZmanimRequest represents a request for zmanim calculations
type ZmanimRequestParams struct {
	CityID      int64  `json:"city_id"`
	PublisherID string `json:"publisher_id,omitempty"`
	Date        string `json:"date"` // YYYY-MM-DD format
}

// ZmanimWithFormulaResponse represents the enhanced zmanim response
type ZmanimWithFormulaResponse struct {
	Date      string               `json:"date"`
	Location  ZmanimLocationInfo   `json:"location"`
	Publisher *ZmanimPublisherInfo `json:"publisher,omitempty"`
	Zmanim    []ZmanWithFormula    `json:"zmanim"`
	Cached    bool                 `json:"cached"`
	CachedAt  *time.Time           `json:"cached_at,omitempty"`
}

// ZmanimPublisherInfo contains publisher details for the response
type ZmanimPublisherInfo struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Logo        *string `json:"logo,omitempty"` // Base64 data URL
	IsCertified bool    `json:"is_certified"`   // Whether this is a certified/authoritative source
}

// ZmanimLocationInfo contains location details for the response
type ZmanimLocationInfo struct {
	CityID    int64   `json:"city_id,omitempty"`
	CityName  string  `json:"city_name,omitempty"`
	Country   string  `json:"country,omitempty"`
	Region    *string `json:"region"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Elevation *int32  `json:"elevation,omitempty"`
	Timezone  string  `json:"timezone"`
}

// ZmanWithFormula represents a single zman with formula details
type ZmanWithFormula struct {
	Name         string         `json:"name"`
	HebrewName   string         `json:"hebrew_name,omitempty"`
	Key          string         `json:"key"`
	Time         string         `json:"time"`
	IsBeta       bool           `json:"is_beta"`
	IsCore       bool           `json:"is_core"`
	TimeCategory string         `json:"time_category,omitempty"`
	Tags         []ZmanTag      `json:"tags,omitempty"`
	Formula      FormulaDetails `json:"formula"`
}

// FormulaDetails contains information about how a zman was calculated
type FormulaDetails struct {
	Method         string                 `json:"method"`
	DisplayName    string                 `json:"display_name"`
	DSL            string                 `json:"dsl,omitempty"`
	Parameters     map[string]interface{} `json:"parameters"`
	Explanation    string                 `json:"explanation"`
	HalachicSource string                 `json:"halachic_source,omitempty"`
}

// GetZmanimForCity calculates zmanim for a city with formula details
// @Summary Get zmanim for a city
// @Description Calculates Jewish prayer times (zmanim) for a specific city and date, optionally using a publisher's custom algorithm
// @Tags Zmanim
// @Accept json
// @Produce json
// @Param cityId query string true "City ID from the cities database"
// @Param publisherId query string false "Publisher ID for custom algorithm (uses default if not specified)"
// @Param date query string false "Date in YYYY-MM-DD format (defaults to today)"
// @Success 200 {object} APIResponse{data=ZmanimWithFormulaResponse} "Calculated zmanim with formula details"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid parameters"
// @Failure 404 {object} APIResponse{error=APIError} "City not found"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /zmanim [get]
func (h *Handlers) GetZmanimForCity(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse query parameters
	cityIDStr := r.URL.Query().Get("cityId")
	publisherID := r.URL.Query().Get("publisherId")
	dateStr := r.URL.Query().Get("date")

	// Validate required parameters
	if cityIDStr == "" {
		RespondBadRequest(w, r, "cityId parameter is required")
		return
	}

	cityID, err := strconv.ParseInt(cityIDStr, 10, 64)
	if err != nil {
		RespondBadRequest(w, r, "cityId must be a valid integer")
		return
	}

	// Default publisher ID for cache key
	cachePublisherID := publisherID
	if cachePublisherID == "" {
		cachePublisherID = "default"
	}

	// Default to today if no date specified
	if dateStr == "" {
		dateStr = time.Now().Format("2006-01-02")
	}

	// Parse date
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid date format. Use YYYY-MM-DD")
		return
	}

	// Cache key uses string representation of city ID
	cityIDCacheKey := strconv.FormatInt(cityID, 10)

	// Check cache first (if available)
	if h.cache != nil {
		cached, err := h.cache.GetZmanim(ctx, cachePublisherID, cityIDCacheKey, dateStr)
		if err != nil {
			slog.Error("cache read error", "error", err)
		} else if cached != nil {
			// Return cached response
			var response ZmanimWithFormulaResponse
			if err := json.Unmarshal(cached.Data, &response); err == nil {
				response.Cached = true
				response.CachedAt = &cached.CachedAt
				RespondJSON(w, r, http.StatusOK, response)
				return
			}
		}
	}

	// Get city details
	cityDetails, err := h.db.Queries.GetCityDetailsForZmanim(ctx, int32(cityID))
	if err != nil {
		RespondNotFound(w, r, "City not found")
		return
	}

	cityName := cityDetails.Name
	country := cityDetails.Country
	region := &cityDetails.Region
	timezone := cityDetails.Timezone
	latitude := cityDetails.Latitude
	longitude := cityDetails.Longitude
	elevation := cityDetails.Elevation

	// Check for publisher-specific location overrides (Story 6.4)
	if publisherID != "" {
		pubID, err := stringToInt32(publisherID)
		if err == nil {
			override, err := h.db.Queries.GetLocationOverrideForCalculation(ctx, sqlcgen.GetLocationOverrideForCalculationParams{
				PublisherID: pubID,
				CityID:      int32(cityID),
			})
			if err == nil {
				// Apply overrides if they exist
				if override.OverrideLatitude != nil {
					latitude = *override.OverrideLatitude
				}
				if override.OverrideLongitude != nil {
					longitude = *override.OverrideLongitude
				}
				if override.OverrideElevation != nil {
					elevation = *override.OverrideElevation
				}
				slog.Debug("using location override",
					"publisher_id", publisherID,
					"city_id", cityID,
					"override_lat", latitude,
					"override_lon", longitude,
					"override_elev", elevation)
			}
		}
	}

	// Load timezone
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
		timezone = "UTC"
	}

	// Get algorithm configuration and publisher info
	var algorithmConfig *algorithm.AlgorithmConfig
	var publisherInfo *ZmanimPublisherInfo
	if publisherID != "" {
		// Convert publisherID to int32
		pubID, err := stringToInt32(publisherID)
		if err != nil {
			RespondBadRequest(w, r, "Invalid publisher ID")
			return
		}

		// First, get publisher info (logo_data is the base64 embedded logo)
		pubInfo, err := h.db.Queries.GetPublisherInfoForZmanim(ctx, pubID)
		if err == nil {
			publisherInfo = &ZmanimPublisherInfo{
				ID:          publisherID,
				Name:        pubInfo.Name,
				Logo:        pubInfo.LogoData,
				IsCertified: pubInfo.IsCertified,
			}
		}

		// Try to get publisher's algorithm
		configJSON, err := h.db.Queries.GetPublisherAlgorithm(ctx, pubID)
		if err == nil && len(configJSON) > 2 {
			algorithmConfig, _ = algorithm.ParseAlgorithm(configJSON)
		}
	}

	// Use default algorithm if none found
	if algorithmConfig == nil {
		algorithmConfig = algorithm.DefaultAlgorithm()
	}

	// Execute algorithm
	executor := algorithm.NewExecutor(date, latitude, longitude, loc)
	results, err := executor.Execute(algorithmConfig)
	if err != nil {
		RespondInternalError(w, r, "Failed to calculate zmanim")
		return
	}

	// Fetch beta status for zmanim if a publisher is specified
	betaStatusMap := make(map[string]bool)
	if publisherID != "" {
		pubID, err := stringToInt32(publisherID)
		if err == nil {
			betaZmanim, betaErr := h.db.Queries.GetPublisherBetaZmanim(ctx, pubID)
			if betaErr == nil {
				for _, zman := range betaZmanim {
					betaStatusMap[zman.ZmanKey] = zman.IsBeta
				}
			}
		}
	}

	// Fetch metadata for all zmanim from master registry (database is source of truth)
	type zmanMetadata struct {
		TimeCategory   string
		HebrewName     string
		EnglishName    string
		DSL            string
		IsCore         bool
		HalachicSource string
	}
	zmanMetadataMap := make(map[string]zmanMetadata)
	metadataRows, metadataErr := h.db.Queries.GetAllMasterZmanimMetadata(ctx)
	if metadataErr == nil {
		for _, row := range metadataRows {
			isCore := false
			if row.IsCore != nil {
				isCore = *row.IsCore
			}
			zmanMetadataMap[row.ZmanKey] = zmanMetadata{
				TimeCategory:   row.TimeCategory,
				HebrewName:     row.CanonicalHebrewName,
				EnglishName:    row.CanonicalEnglishName,
				DSL:            row.DefaultFormulaDsl,
				IsCore:         isCore,
				HalachicSource: row.HalachicSource,
			}
		}
	}

	// Fetch tags for all zmanim
	tagsMap := make(map[string][]ZmanTag)
	tagsRows, tagsErr := h.db.Queries.GetAllZmanimTags(ctx)
	if tagsErr == nil {
		for _, row := range tagsRows {
			sortOrder := 0
			if row.SortOrder != nil {
				sortOrder = int(*row.SortOrder)
			}
			tag := ZmanTag{
				ID:                 row.ID,
				TagKey:             row.TagKey,
				Name:               row.Name,
				DisplayNameEnglish: row.DisplayNameEnglish,
				DisplayNameHebrew:  row.DisplayNameHebrew,
				TagType:            row.TagType,
				Color:              row.Color,
				SortOrder:          sortOrder,
				IsNegated:          row.IsNegated,
				CreatedAt:          row.CreatedAt.Time,
				Description:        nil,
			}
			tagsMap[row.ZmanKey] = append(tagsMap[row.ZmanKey], tag)
		}
	}

	// Build response
	response := ZmanimWithFormulaResponse{
		Date: dateStr,
		Location: ZmanimLocationInfo{
			CityID:    cityID,
			CityName:  cityName,
			Country:   country,
			Region:    region,
			Latitude:  latitude,
			Longitude: longitude,
			Elevation: &elevation,
			Timezone:  timezone,
		},
		Publisher: publisherInfo,
		Zmanim:    make([]ZmanWithFormula, 0, len(results.Zmanim)),
		Cached:    false,
	}

	for _, zman := range results.Zmanim {
		metadata := zmanMetadataMap[zman.Key]
		// Use database English name if available, otherwise log warning and use key
		englishName := metadata.EnglishName
		if englishName == "" {
			slog.Warn("missing english name in master_zmanim_registry", "zman_key", zman.Key)
			englishName = zman.Key // Fallback to key (no hardcoded names)
		}
		response.Zmanim = append(response.Zmanim, ZmanWithFormula{
			Name:         englishName,
			HebrewName:   metadata.HebrewName,
			Key:          zman.Key,
			Time:         zman.TimeString,
			IsBeta:       betaStatusMap[zman.Key],
			IsCore:       metadata.IsCore,
			TimeCategory: metadata.TimeCategory,
			Tags:         tagsMap[zman.Key],
			Formula: FormulaDetails{
				Method:         zman.Formula.Method,
				DisplayName:    zman.Formula.DisplayName,
				DSL:            metadata.DSL,
				Parameters:     zman.Formula.Parameters,
				Explanation:    zman.Formula.Explanation,
				HalachicSource: metadata.HalachicSource,
			},
		})
	}

	// Add event-based zmanim (candle lighting, havdalah)
	calService := calendar.NewCalendarService()
	isIsrael := calendar.IsLocationInIsrael(latitude, longitude)
	zmanimContext := calService.GetZmanimContext(date.In(loc), calendar.Location{
		Latitude:  latitude,
		Longitude: longitude,
		Timezone:  timezone,
		IsIsrael:  isIsrael,
	})

	// Get sunset time from executor
	sunTimes := executor.GetSunTimes()

	// Add candle lighting if needed (Friday or erev Yom Tov)
	if zmanimContext.ShowCandleLighting {
		// Default: 18 minutes before sunset
		candleLightingTime := astro.SubtractMinutes(sunTimes.Sunset, 18)
		// Get Hebrew name from master registry - NO FALLBACK (database is source of truth)
		candleMetadata := zmanMetadataMap["candle_lighting"]
		candleHebrewName := candleMetadata.HebrewName
		if candleHebrewName == "" {
			slog.Warn("missing hebrew name in master_zmanim_registry", "zman_key", "candle_lighting")
		}
		response.Zmanim = append(response.Zmanim, ZmanWithFormula{
			Name:         "Candle Lighting",
			HebrewName:   candleHebrewName,
			Key:          "candle_lighting",
			Time:         astro.FormatTime(candleLightingTime),
			IsBeta:       false,    // System-generated, never beta
			TimeCategory: "sunset", // Candle lighting is near sunset
			Formula: FormulaDetails{
				Method:      "fixed_minutes",
				DisplayName: "18 minutes before sunset",
				Parameters: map[string]interface{}{
					"minutes": -18,
					"from":    "sunset",
				},
				Explanation: "Traditional candle lighting time, 18 minutes before sunset",
			},
		})
	}

	// Add havdalah if needed (Motzei Shabbat or Motzei Yom Tov)
	if zmanimContext.ShowShabbosYomTovEnds {
		// Default: 42 minutes after sunset (8.5° below horizon approximation)
		havdalahTime := astro.AddMinutes(sunTimes.Sunset, 42)
		// Get Hebrew name from master registry - NO FALLBACK (database is source of truth)
		havdalahMetadata := zmanMetadataMap["havdalah"]
		havdalahHebrewName := havdalahMetadata.HebrewName
		if havdalahHebrewName == "" {
			slog.Warn("missing hebrew name in master_zmanim_registry", "zman_key", "havdalah")
		}
		response.Zmanim = append(response.Zmanim, ZmanWithFormula{
			Name:         "Havdalah",
			HebrewName:   havdalahHebrewName,
			Key:          "havdalah",
			Time:         astro.FormatTime(havdalahTime),
			IsBeta:       false,       // System-generated, never beta
			TimeCategory: "nightfall", // Havdalah is after nightfall
			Formula: FormulaDetails{
				Method:      "fixed_minutes",
				DisplayName: "42 minutes after sunset",
				Parameters: map[string]interface{}{
					"minutes": 42,
					"from":    "sunset",
				},
				Explanation: "Traditional havdalah time, approximately 42 minutes after sunset",
			},
		})
	}

	// Filter zmanim based on negated tags (e.g., "NOT on Shabbos")
	hebrewDate := calService.GetHebrewDate(date)
	hebrewMonth := int32(hebrewDate.MonthNum)
	hebrewDay := int32(hebrewDate.Day)
	todayTags, err := h.db.Queries.GetTagsForHebrewDate(ctx, sqlcgen.GetTagsForHebrewDateParams{
		HebrewMonth:    &hebrewMonth,
		HebrewDayStart: &hebrewDay,
	})
	if err != nil {
		slog.Error("failed to get tags for Hebrew date", "error", err, "date", dateStr)
	} else {
		// Create map of today's tag IDs for fast lookup
		todayTagIDs := make(map[int32]bool)
		for _, tag := range todayTags {
			todayTagIDs[tag.ID] = true
		}

		// Filter zmanim: exclude if any negated tag matches today
		filteredZmanim := make([]ZmanWithFormula, 0, len(response.Zmanim))
		for _, zman := range response.Zmanim {
			shouldInclude := true
			for _, tag := range zman.Tags {
				// Tag ID is already int32, use it directly
				tagIDInt := tag.ID
				// If tag is negated AND matches today, exclude this zman
				if tag.IsNegated && todayTagIDs[tagIDInt] {
					shouldInclude = false
					slog.Debug("excluding zman due to negated tag",
						"zman", zman.Key,
						"tag", tag.Name,
						"date", dateStr)
					break
				}
			}
			if shouldInclude {
				filteredZmanim = append(filteredZmanim, zman)
			}
		}
		response.Zmanim = filteredZmanim
	}

	// Sort all zmanim by calculated time for chronological display
	sortZmanimByTime(response.Zmanim)

	// Cache the result (if cache available)
	if h.cache != nil {
		if err := h.cache.SetZmanim(ctx, cachePublisherID, cityIDCacheKey, dateStr, response); err != nil {
			slog.Error("cache write error", "error", err)
		}
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// GetZmanimByCoordinates calculates zmanim for coordinates (legacy)
// @Summary Calculate zmanim by coordinates (legacy)
// @Description Calculates zmanim using raw latitude/longitude coordinates. Prefer the GET /zmanim endpoint with cityId for better accuracy.
// @Tags Zmanim
// @Accept json
// @Produce json
// @Param request body models.ZmanimRequest true "Coordinates and date"
// @Success 200 {object} APIResponse{data=ZmanimWithFormulaResponse} "Calculated zmanim"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid request"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /zmanim [post]
func (h *Handlers) GetZmanimByCoordinates(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req models.ZmanimRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Validate request
	validationErrors := make(map[string]string)
	if req.Date == "" {
		validationErrors["date"] = "Date is required"
	}
	if req.Latitude < -90 || req.Latitude > 90 {
		validationErrors["latitude"] = "Latitude must be between -90 and 90"
	}
	if req.Longitude < -180 || req.Longitude > 180 {
		validationErrors["longitude"] = "Longitude must be between -180 and 180"
	}
	if len(validationErrors) > 0 {
		RespondValidationError(w, r, "Invalid request parameters", validationErrors)
		return
	}

	if req.Timezone == "" {
		req.Timezone = "UTC"
	}

	response, err := h.zmanimService.CalculateZmanim(ctx, &req)
	if err != nil {
		RespondInternalError(w, r, "Failed to calculate zmanim")
		return
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// InvalidatePublisherCache invalidates cached calculations for a publisher
// @Summary Invalidate publisher cache
// @Description Clears all cached zmanim calculations for the authenticated publisher
// @Tags Publisher
// @Produce json
// @Security BearerAuth
// @Param X-Publisher-Id header string true "Publisher ID"
// @Success 200 {object} APIResponse{data=object} "Cache invalidated"
// @Failure 401 {object} APIResponse{error=APIError} "Unauthorized"
// @Failure 404 {object} APIResponse{error=APIError} "Publisher not found"
// @Router /publisher/cache [delete]
func (h *Handlers) InvalidatePublisherCache(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from context
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		RespondUnauthorized(w, r, "User ID not found in context")
		return
	}

	// Get publisher ID from header or database lookup
	publisherID := r.Header.Get("X-Publisher-Id")
	if publisherID == "" {
		pubID, err := h.db.Queries.GetPublisherByClerkUserID(ctx, &userID)
		if err != nil {
			RespondNotFound(w, r, "Publisher not found")
			return
		}
		publisherID = int32ToString(pubID)
	}

	var redisDeleted int64

	// Invalidate Redis cache (if available)
	if h.cache != nil {
		if err := h.cache.InvalidatePublisherCache(ctx, publisherID); err != nil {
			slog.Error("redis cache invalidation error", "error", err)
		} else {
			slog.Info("redis cache invalidated", "publisher_id", publisherID)
			redisDeleted = 1 // Indicates success (actual count is logged by cache)
		}
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"message":           "Cache invalidated",
		"redis_invalidated": redisDeleted > 0,
	})
}
