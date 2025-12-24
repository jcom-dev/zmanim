// File: zmanim.go
// Purpose: Public zmanim calculation endpoints
// Pattern: 6-step-handler
// Dependencies: Queries: zmanim.sql | Services: UnifiedZmanimService, CalculationLogService
// Frequency: critical - main public API for zmanim calculations
//
// # Public Zmanim API
//
// This file contains the public-facing zmanim calculation endpoints:
//   - GET /zmanim - Calculate zmanim for a locality (requires publisherId, localityId)
//   - POST /zmanim - Calculate zmanim by raw coordinates (legacy)
//   - DELETE /publisher/cache - Invalidate publisher's cached calculations
//
// The GET endpoint uses UnifiedZmanimService for calculations, which handles:
//   - Coordinate resolution (locality → lat/lon with publisher overrides)
//   - DSL formula evaluation via the dsl package
//   - Redis caching for performance
//   - Calculation logging for analytics
//
// Response includes formula details, tags, and metadata from master registry.

package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jcom-dev/zmanim/internal/calendar"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/middleware"
	"github.com/jcom-dev/zmanim/internal/models"
	"github.com/jcom-dev/zmanim/internal/services"
)

// ZmanimRequestParams represents a request for zmanim calculations
type ZmanimRequestParams struct {
	LocalityID  int64  `json:"locality_id"`
	PublisherID string `json:"publisher_id,omitempty"`
	Date        string `json:"date"` // YYYY-MM-DD format
}

// ZmanimFilterParams represents optional filter parameters for zmanim queries
type ZmanimFilterParams struct {
	IncludeDisabled    bool // Include is_enabled=false zmanim (default: false)
	IncludeUnpublished bool // Include is_published=false zmanim (default: false)
	IncludeBeta        bool // Include is_beta=true zmanim (default: true)
}

// ZmanimWithFormulaResponse represents the enhanced zmanim response
type ZmanimWithFormulaResponse struct {
	Date       string                `json:"date"`
	DayContext *ZmanimDayContext     `json:"day_context,omitempty"`
	Location   LocationInfo          `json:"location"`
	Publisher  *ZmanimPublisherInfo  `json:"publisher,omitempty"`
	Zmanim     []ZmanWithFormula     `json:"zmanim"`
	Filters    *ZmanimFiltersApplied `json:"filters,omitempty"` // Show which filters were applied
	Cached     bool                  `json:"cached"`
	CachedAt   *time.Time            `json:"cached_at,omitempty"`
}

// ZmanimDayContext contains calendar/holiday info for the requested date
type ZmanimDayContext struct {
	HebrewDate       string              `json:"hebrew_date"`        // e.g., "1 Tevet 5785"
	HebrewDateHebrew string              `json:"hebrew_date_hebrew"` // e.g., "א׳ טבת תשפ״ה"
	DayOfWeek        int                 `json:"day_of_week"`        // 0=Sunday, 6=Saturday
	DayNameEng       string              `json:"day_name_eng"`       // e.g., "Sunday"
	DayNameHebrew    string              `json:"day_name_hebrew"`    // e.g., "יום ראשון"
	IsShabbat        bool                `json:"is_shabbat"`
	IsYomTov         bool                `json:"is_yom_tov"`
	Holidays         []ZmanimHolidayInfo `json:"holidays,omitempty"`
}

// ZmanimHolidayInfo represents a holiday/event for the day
type ZmanimHolidayInfo struct {
	Name       string `json:"name"`
	NameHebrew string `json:"name_hebrew"`
	Category   string `json:"category"` // "major", "minor", "shabbat", "roshchodesh", "fast"
	IsYomTov   bool   `json:"is_yom_tov"`
}

// ZmanimFiltersApplied shows which filters were applied to the response
type ZmanimFiltersApplied struct {
	IncludeDisabled    bool `json:"include_disabled"`
	IncludeUnpublished bool `json:"include_unpublished"`
	IncludeBeta        bool `json:"include_beta"`
}

// ZmanimPublisherInfo contains publisher details for the response
type ZmanimPublisherInfo struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Logo        *string `json:"logo,omitempty"` // Base64 data URL
	IsCertified bool    `json:"is_certified"`   // Whether this is a certified/authoritative source
}

// ZmanWithFormula represents a single zman with formula details
type ZmanWithFormula struct {
	Name         string         `json:"name"`
	HebrewName   string         `json:"hebrew_name,omitempty"`
	Key          string         `json:"key"`
	Time         string         `json:"time"`                   // Exact time HH:MM:SS with actual seconds
	TimeRounded  string         `json:"time_rounded,omitempty"` // Rounded time HH:MM (no seconds)
	Timestamp    *int64         `json:"timestamp,omitempty"`    // Unix seconds
	IsBeta       bool           `json:"is_beta"`
	IsCore       bool           `json:"is_core"`
	IsEnabled    bool           `json:"is_enabled"`
	IsPublished  bool           `json:"is_published"`
	TimeCategory string         `json:"time_category,omitempty"`
	RoundingMode string         `json:"rounding_mode"` // floor | math | ceil (default: math)
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

// GetTimeCategory implements services.SortableZman
func (z *ZmanWithFormula) GetTimeCategory() string {
	return z.TimeCategory
}

// GetCalculatedTime implements services.SortableZman
func (z *ZmanWithFormula) GetCalculatedTime() *string {
	if z.Time == "" {
		return nil
	}
	return &z.Time
}

// formatZmanName converts snake_case to Title Case for display
func formatZmanName(key string) string {
	// Simple formatter: replace underscores with spaces and title case
	words := []string{}
	for _, word := range []rune(key) {
		if word == '_' {
			words = append(words, " ")
		} else if len(words) == 0 || words[len(words)-1] == " " {
			words = append(words, string([]rune{word - 32})) // uppercase first letter
		} else {
			words = append(words, string(word))
		}
	}
	result := ""
	for _, w := range words {
		result += w
	}
	return result
}

// GetHebrewName implements services.SortableZman
func (z *ZmanWithFormula) GetHebrewName() string {
	return z.HebrewName
}

// buildDayContext creates day context info from a date using the calendar service
func buildDayContext(date time.Time) *ZmanimDayContext {
	calService := calendar.NewCalendarService()
	dayInfo := calService.GetDayInfo(date)
	hebrewDate := calService.GetHebrewDate(date)

	// Convert holidays
	holidays := make([]ZmanimHolidayInfo, 0, len(dayInfo.Holidays))
	for _, h := range dayInfo.Holidays {
		holidays = append(holidays, ZmanimHolidayInfo{
			Name:       h.Name,
			NameHebrew: h.NameHebrew,
			Category:   h.Category,
			IsYomTov:   h.Yomtov,
		})
	}

	return &ZmanimDayContext{
		HebrewDate:       hebrewDate.Formatted,
		HebrewDateHebrew: hebrewDate.Hebrew,
		DayOfWeek:        dayInfo.DayOfWeek,
		DayNameEng:       dayInfo.DayNameEng,
		DayNameHebrew:    dayInfo.DayNameHebrew,
		IsShabbat:        dayInfo.IsShabbat,
		IsYomTov:         dayInfo.IsYomTov,
		Holidays:         holidays,
	}
}

// GetZmanimForLocality calculates zmanim for a locality with formula details
//
//	@Summary		Get zmanim for a locality
//	@Description	Calculates zmanim for a specific locality and date using the Halachic Authority's configured DSL formulas with complete transparency
//	@Tags			Zmanim
//	@Accept			json
//	@Produce		json
//	@Param			localityId			query		string										true	"Locality ID from the localities database"
//	@Param			publisherId			query		string										true	"Publisher ID (required - each publisher has unique zmanim configuration)"
//	@Param			date				query		string										false	"Date in YYYY-MM-DD format (defaults to today)"
//	@Param			includeDisabled		query		bool										false	"Include disabled zmanim (default: false)"
//	@Param			includeUnpublished	query		bool										false	"Include unpublished zmanim (default: false)"
//	@Param			includeBeta			query		bool										false	"Include beta zmanim (default: true)"
//	@Success		200					{object}	APIResponse{data=ZmanimWithFormulaResponse}	"Calculated zmanim with formula details"
//	@Failure		400					{object}	APIResponse{error=APIError}					"Invalid parameters"
//	@Failure		404					{object}	APIResponse{error=APIError}					"Locality or publisher not found"
//	@Failure		500					{object}	APIResponse{error=APIError}					"Internal server error"
//	@Router			/zmanim [get]
func (h *Handlers) GetZmanimForLocality(w http.ResponseWriter, r *http.Request) {
	start := time.Now() // Track response time for logging
	ctx := r.Context()

	// Parse query parameters
	localityIDStr := r.URL.Query().Get("localityId")
	publisherID := r.URL.Query().Get("publisherId")
	dateStr := r.URL.Query().Get("date")

	// Parse filter parameters
	filters := ZmanimFilterParams{
		IncludeDisabled:    r.URL.Query().Get("includeDisabled") == "true",
		IncludeUnpublished: r.URL.Query().Get("includeUnpublished") == "true",
		IncludeBeta:        r.URL.Query().Get("includeBeta") != "false", // Default true
	}

	// Validate required parameters
	if localityIDStr == "" {
		RespondBadRequest(w, r, "localityId parameter is required")
		return
	}

	localityID, err := strconv.ParseInt(localityIDStr, 10, 64)
	if err != nil {
		RespondBadRequest(w, r, "localityId must be a valid integer")
		return
	}

	// Publisher ID is optional - if not provided, use default calculation
	// This allows users to view zmanim without selecting a publisher
	useDefault := publisherID == ""

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

	// Get locality details (for response metadata and coordinate resolution)
	localityDetails, err := h.db.Queries.GetLocalityDetailsForZmanim(ctx, int32(localityID))
	if err != nil {
		RespondNotFound(w, r, "Locality not found")
		return
	}

	localityName := localityDetails.Name
	country := localityDetails.Country
	countryCode := localityDetails.CountryCode
	region := localityDetails.Region
	displayHierarchy := localityDetails.DisplayHierarchy
	timezone := localityDetails.Timezone

	// Get coordinates from default values (nullable from view)
	var latitude, longitude float64
	if localityDetails.Latitude != nil && localityDetails.Longitude != nil {
		latitude = *localityDetails.Latitude
		longitude = *localityDetails.Longitude
	} else {
		RespondBadRequest(w, r, "Locality has no coordinate data")
		return
	}
	elevation := localityDetails.Elevation

	// Load timezone (used for date operations)
	tz, err := time.LoadLocation(timezone)
	if err != nil {
		RespondBadRequest(w, r, fmt.Sprintf("Invalid timezone for locality: %s", timezone))
		return
	}

	var publisherInfo *ZmanimPublisherInfo
	var calcResult *services.CalculationResult
	var pubID int32

	if useDefault {
		// Default calculation mode - return basic zmanim without publisher
		// Define default zmanim with formulas and categories
		type defaultZmanDef struct {
			formula     string
			category    string
			displayName string
			hebrewName  string
		}
		defaultZmanimDefs := map[string]defaultZmanDef{
			"alos_hashachar":     {formula: "solar(16.1, before_sunrise)", category: "dawn", displayName: "Alos Hashachar", hebrewName: "עלות השחר"},
			"misheyakir":         {formula: "solar(11.5, before_sunrise)", category: "dawn", displayName: "Misheyakir", hebrewName: "משיכיר"},
			"sunrise":            {formula: "sunrise", category: "sunrise", displayName: "Sunrise", hebrewName: "הנץ החמה"},
			"sof_zman_shema_mga": {formula: "@alos_hashachar + ((@sunrise - @alos_hashachar) * 3 / 4)", category: "morning", displayName: "Sof Zman Shema (MGA)", hebrewName: "סוף זמן שמע מג״א"},
			"sof_zman_shema_gra": {formula: "@sunrise + 3h", category: "morning", displayName: "Sof Zman Shema (GRA)", hebrewName: "סוף זמן שמע גר״א"},
			"sof_zman_tefillah":  {formula: "@sunrise + 4h", category: "morning", displayName: "Sof Zman Tefillah", hebrewName: "סוף זמן תפילה"},
			"chatzos":            {formula: "solar_noon", category: "midday", displayName: "Chatzos", hebrewName: "חצות"},
			"mincha_gedolah":     {formula: "@chatzos + 30min", category: "afternoon", displayName: "Mincha Gedolah", hebrewName: "מנחה גדולה"},
			"mincha_ketanah":     {formula: "@chatzos + 2h30min", category: "afternoon", displayName: "Mincha Ketanah", hebrewName: "מנחה קטנה"},
			"plag_hamincha":      {formula: "@mincha_ketanah + 1h15min", category: "afternoon", displayName: "Plag HaMincha", hebrewName: "פלג המנחה"},
			"sunset":             {formula: "sunset", category: "sunset", displayName: "Sunset", hebrewName: "שקיעה"},
			"tzeis_8_5_degrees":  {formula: "solar(8.5, after_sunset)", category: "nightfall", displayName: "Tzeis (8.5°)", hebrewName: "צאת הכוכבים"},
			"tzeis_72_minutes":   {formula: "@sunset + 72min", category: "nightfall", displayName: "Tzeis (72 min)", hebrewName: "צאת הכוכבים ר״ת"},
		}

		// Extract just the formulas for calculation
		defaultFormulas := make(map[string]string)
		for key, def := range defaultZmanimDefs {
			defaultFormulas[key] = def.formula
		}

		calculatedTimes, err := h.unifiedZmanimService.ExecuteFormulasWithCoordinates(
			date, latitude, longitude, float64(elevation), tz, defaultFormulas,
		)
		if err != nil {
			slog.Error("default calculation failed", "error", err, "locality_id", localityID)
			RespondInternalError(w, r, "Failed to calculate default zmanim")
			return
		}

		// Build simplified response for default zmanim
		displayHierarchyStr := ""
		if displayHierarchy != nil {
			displayHierarchyStr = *displayHierarchy
		}

		response := ZmanimWithFormulaResponse{
			Date:       dateStr,
			DayContext: buildDayContext(date),
			Location: LocationInfo{
				LocalityID:       strconv.FormatInt(localityID, 10),
				LocalityName:     localityName,
				Country:          country,
				CountryCode:      countryCode,
				Region:           region,
				DisplayHierarchy: displayHierarchyStr,
				Latitude:         latitude,
				Longitude:        longitude,
				Elevation:        float64(elevation),
				Timezone:         timezone,
			},
			Publisher: nil, // No publisher for default calculation
			Zmanim:    make([]ZmanWithFormula, 0, len(calculatedTimes)),
			Filters: &ZmanimFiltersApplied{
				IncludeDisabled:    false,
				IncludeUnpublished: false,
				IncludeBeta:        true,
			},
			Cached:   false,
			CachedAt: nil,
		}

		// Convert calculated times to ZmanWithFormula
		for key, t := range calculatedTimes {
			timeExact, timeRounded := services.ApplyRounding(t.In(tz), "math")
			timestamp := t.Unix()
			def := defaultZmanimDefs[key]

			response.Zmanim = append(response.Zmanim, ZmanWithFormula{
				Name:         def.displayName,
				HebrewName:   def.hebrewName,
				Key:          key,
				Time:         timeExact,
				TimeRounded:  timeRounded,
				Timestamp:    &timestamp,
				IsBeta:       false,
				IsCore:       true,
				IsEnabled:    true,
				IsPublished:  true,
				TimeCategory: def.category,
				RoundingMode: "math",
				Tags:         []ZmanTag{},
				Formula: FormulaDetails{
					Method:      "dsl",
					DisplayName: def.displayName,
					DSL:         def.formula,
					Parameters:  map[string]interface{}{},
					Explanation: "Default calculation using standard formula",
				},
			})
		}

		// Sort default zmanim chronologically by calculated time
		if h.unifiedZmanimService != nil {
			sortable := make([]services.SortableZman, len(response.Zmanim))
			for i := range response.Zmanim {
				sortable[i] = &response.Zmanim[i]
			}
			h.unifiedZmanimService.SortZmanim(sortable, false)
			sorted := make([]ZmanWithFormula, len(sortable))
			for i, s := range sortable {
				sorted[i] = *s.(*ZmanWithFormula)
			}
			response.Zmanim = sorted
		}

		RespondJSON(w, r, http.StatusOK, response)
		return
	} else {
		// Publisher-specific calculation
		pubID, err := stringToInt32(publisherID)
		if err != nil {
			RespondBadRequest(w, r, "Invalid publisher ID")
			return
		}

		// Use hierarchical coordinate resolution with publisher context
		localityID32 := int32(localityID)
		pubIDForLookup := pgtype.Int4{Int32: pubID, Valid: true}

		effectiveLocation, err := h.db.Queries.GetEffectiveLocalityLocation(ctx, sqlcgen.GetEffectiveLocalityLocationParams{
			LocalityID:  localityID32,
			PublisherID: pubIDForLookup,
		})
		if err == nil {
			latitude = effectiveLocation.Latitude
			longitude = effectiveLocation.Longitude
			elevation = effectiveLocation.ElevationM

			if effectiveLocation.HasPublisherCoordinateOverride || effectiveLocation.HasAdminCoordinateOverride {
				slog.Debug("using coordinate override",
					"publisher_id", publisherID,
					"locality_id", localityID,
					"override_lat", latitude,
					"override_lon", longitude,
					"source", effectiveLocation.CoordinateSourceKey,
					"has_publisher_override", effectiveLocation.HasPublisherCoordinateOverride,
					"has_admin_override", effectiveLocation.HasAdminCoordinateOverride)
			}
		}

		// Get publisher info
		pubInfo, err := h.db.Queries.GetPublisherInfoForZmanim(ctx, pubID)
		if err != nil {
			RespondNotFound(w, r, "Publisher not found")
			return
		}

		publisherInfo = &ZmanimPublisherInfo{
			ID:          publisherID,
			Name:        pubInfo.Name,
			Logo:        pubInfo.LogoData,
			IsCertified: pubInfo.IsCertified,
		}

		// Use unified calculation service (timezone derived from locality)
		calcResult, err = h.unifiedZmanimService.CalculateZmanim(ctx, services.CalculateParams{
			LocalityID:         localityID,
			PublisherID:        pubID,
			Date:               date,
			IncludeDisabled:    filters.IncludeDisabled,
			IncludeUnpublished: filters.IncludeUnpublished,
			IncludeBeta:        filters.IncludeBeta,
		})
		if err != nil {
			slog.Error("calculation failed", "error", err, "publisher_id", publisherID, "locality_id", localityID)
			RespondInternalError(w, r, "Failed to calculate zmanim")
			return
		}
	}

	// Track cache status for logging
	cacheHit := calcResult.FromCache

	// Fetch metadata for all zmanim from master registry
	zmanMetadataMap := h.loadZmanMetadata(ctx)

	// Fetch tags for all zmanim
	tagsMap := h.loadZmanTags(ctx)

	// Load publisher zmanim for enrichment
	publisherZmanim, err := h.db.Queries.GetPublisherZmanim(ctx, pubID)
	if err != nil {
		slog.Error("failed to load publisher zmanim", "error", err, "publisher_id", publisherID)
		RespondInternalError(w, r, "Failed to load publisher zmanim configuration")
		return
	}

	// Build lookup map for publisher zmanim config
	zmanConfigMap := make(map[string]sqlcgen.GetPublisherZmanimRow)
	for _, pz := range publisherZmanim {
		zmanConfigMap[pz.ZmanKey] = pz
	}

	// Build response with enriched metadata
	displayHierarchyStr := ""
	if displayHierarchy != nil {
		displayHierarchyStr = *displayHierarchy
	}

	response := ZmanimWithFormulaResponse{
		Date:       dateStr,
		DayContext: buildDayContext(date),
		Location: LocationInfo{
			LocalityID:       strconv.FormatInt(localityID, 10),
			LocalityName:     localityName,
			Country:          country,
			CountryCode:      countryCode,
			Region:           region,
			DisplayHierarchy: displayHierarchyStr,
			Latitude:         latitude,
			Longitude:        longitude,
			Elevation:        float64(elevation),
			Timezone:         timezone,
		},
		Publisher: publisherInfo,
		Zmanim:    make([]ZmanWithFormula, 0, len(calcResult.Zmanim)),
		Filters: &ZmanimFiltersApplied{
			IncludeDisabled:    filters.IncludeDisabled,
			IncludeUnpublished: filters.IncludeUnpublished,
			IncludeBeta:        filters.IncludeBeta,
		},
		Cached:   calcResult.FromCache,
		CachedAt: calcResult.CachedAt,
	}

	// Enrich calculated zmanim with metadata
	for _, calcZman := range calcResult.Zmanim {
		pz := zmanConfigMap[calcZman.Key]
		metadata := zmanMetadataMap[calcZman.Key]

		// Use publisher's names if set, otherwise fall back to master registry
		englishName := pz.EnglishName
		if englishName == "" {
			englishName = metadata.EnglishName
		}
		if englishName == "" {
			englishName = calcZman.Key
		}

		hebrewName := pz.HebrewName
		if hebrewName == "" {
			hebrewName = metadata.HebrewName
		}

		// Get time category
		timeCategory := metadata.TimeCategory
		if pz.Category != nil {
			timeCategory = *pz.Category
		}

		timestamp := calcZman.Timestamp
		response.Zmanim = append(response.Zmanim, ZmanWithFormula{
			Name:         englishName,
			HebrewName:   hebrewName,
			Key:          calcZman.Key,
			Time:         calcZman.TimeExact,
			TimeRounded:  calcZman.TimeRounded,
			Timestamp:    &timestamp,
			IsBeta:       pz.IsBeta,
			IsCore:       metadata.IsCore,
			IsEnabled:    pz.IsEnabled,
			IsPublished:  pz.IsPublished,
			TimeCategory: timeCategory,
			RoundingMode: calcZman.RoundingMode,
			Tags:         tagsMap[calcZman.Key],
			Formula: FormulaDetails{
				Method:         "dsl",
				DisplayName:    pz.FormulaDsl,
				DSL:            pz.FormulaDsl,
				Parameters:     map[string]interface{}{},
				Explanation:    getFormulaExplanation(pz.AiExplanation),
				HalachicSource: metadata.HalachicSource,
			},
		})
	}

	// Filter zmanim based on negated tags (e.g., "NOT on Shabbos")
	h.filterByNegatedTags(ctx, &response, date)

	// Sort all zmanim using the unified service
	if h.unifiedZmanimService != nil {
		sortable := make([]services.SortableZman, len(response.Zmanim))
		for i := range response.Zmanim {
			sortable[i] = &response.Zmanim[i]
		}
		h.unifiedZmanimService.SortZmanim(sortable, false)
		// Convert back to original slice (sorted order)
		sorted := make([]ZmanWithFormula, len(sortable))
		for i, s := range sortable {
			sorted[i] = *s.(*ZmanWithFormula)
		}
		response.Zmanim = sorted
	}

	// Log the calculation
	if h.calculationLogService != nil {
		h.calculationLogService.Log(services.CalculationLogEntry{
			PublisherID:    pubID,
			LocalityID:     localityID,
			DateCalculated: date,
			CacheHit:       cacheHit,
			ResponseTimeMs: int16(time.Since(start).Milliseconds()),
			ZmanCount:      int16(len(response.Zmanim)),
			Source:         services.SourceWeb,
		})
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// zmanMetadata holds metadata from master registry
type zmanMetadata struct {
	TimeCategory   string
	HebrewName     string
	EnglishName    string
	DSL            string
	IsCore         bool
	HalachicSource string
}

// loadZmanMetadata fetches metadata for all zmanim from master registry
func (h *Handlers) loadZmanMetadata(ctx context.Context) map[string]zmanMetadata {
	result := make(map[string]zmanMetadata)
	metadataRows, err := h.db.Queries.GetAllMasterZmanimMetadata(ctx)
	if err != nil {
		slog.Error("failed to load master zmanim metadata", "error", err)
		return result
	}

	for _, row := range metadataRows {
		isCore := false
		if row.IsCore != nil {
			isCore = *row.IsCore
		}
		result[row.ZmanKey] = zmanMetadata{
			TimeCategory:   row.TimeCategory,
			HebrewName:     row.CanonicalHebrewName,
			EnglishName:    row.CanonicalEnglishName,
			DSL:            row.DefaultFormulaDsl,
			IsCore:         isCore,
			HalachicSource: row.HalachicSource,
		}
	}
	return result
}

// loadZmanTags fetches tags for all zmanim
func (h *Handlers) loadZmanTags(ctx context.Context) map[string][]ZmanTag {
	result := make(map[string][]ZmanTag)
	tagsRows, err := h.db.Queries.GetAllZmanimTags(ctx)
	if err != nil {
		slog.Error("failed to load zmanim tags", "error", err)
		return result
	}

	for _, row := range tagsRows {
		sortOrder := 0
		if row.SortOrder != nil {
			sortOrder = int(*row.SortOrder)
		}
		tag := ZmanTag{
			ID:                 row.ID,
			TagKey:             row.TagKey,
			Name:               row.Name,
			DisplayNameEnglish: row.DisplayNameEnglishAshkenazi,
			DisplayNameHebrew:  row.DisplayNameHebrew,
			TagType:            row.TagType,
			Color:              row.Color,
			SortOrder:          sortOrder,
			IsNegated:          row.IsNegated,
			CreatedAt:          row.CreatedAt.Time,
			Description:        nil,
		}
		result[row.ZmanKey] = append(result[row.ZmanKey], tag)
	}
	return result
}

// getFormulaExplanation extracts explanation from AI explanation or returns empty
func getFormulaExplanation(aiExplanation *string) string {
	if aiExplanation != nil {
		return *aiExplanation
	}
	return ""
}

// filterByNegatedTags filters zmanim based on negated tags (e.g., "NOT on Shabbos")
func (h *Handlers) filterByNegatedTags(ctx context.Context, response *ZmanimWithFormulaResponse, date time.Time) {
	calService := calendar.NewCalendarService()
	hebrewDate := calService.GetHebrewDate(date)
	hebrewMonth := int32(hebrewDate.MonthNum)
	hebrewDay := int32(hebrewDate.Day)

	todayTags, err := h.db.Queries.GetTagsForHebrewDate(ctx, sqlcgen.GetTagsForHebrewDateParams{
		HebrewMonth:    &hebrewMonth,
		HebrewDayStart: &hebrewDay,
	})
	if err != nil {
		slog.Error("failed to get tags for Hebrew date", "error", err, "date", date.Format("2006-01-02"))
		return
	}

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
			if tag.IsNegated && todayTagIDs[tag.ID] {
				shouldInclude = false
				slog.Debug("excluding zman due to negated tag",
					"zman", zman.Key,
					"tag", tag.Name,
					"date", date.Format("2006-01-02"))
				break
			}
		}
		if shouldInclude {
			filteredZmanim = append(filteredZmanim, zman)
		}
	}
	response.Zmanim = filteredZmanim
}

// GetZmanimByCoordinates calculates zmanim for coordinates (legacy)
//
//	@Summary		Calculate zmanim by coordinates (legacy)
//	@Description	Calculates zmanim using raw latitude/longitude coordinates. Prefer the GET /zmanim endpoint with localityId for better accuracy.
//	@Tags			Zmanim
//	@Accept			json
//	@Produce		json
//	@Param			request	body		models.ZmanimRequest						true	"Coordinates and date"
//	@Success		200		{object}	APIResponse{data=ZmanimWithFormulaResponse}	"Calculated zmanim"
//	@Failure		400		{object}	APIResponse{error=APIError}					"Invalid request"
//	@Failure		500		{object}	APIResponse{error=APIError}					"Internal server error"
//	@Router			/zmanim [post]
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

	response, err := h.legacyZmanimService.CalculateZmanim(ctx, &req)
	if err != nil {
		RespondInternalError(w, r, "Failed to calculate zmanim")
		return
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// InvalidatePublisherCache invalidates cached calculations for a publisher
//
//	@Summary		Invalidate publisher cache
//	@Description	Clears all cached zmanim calculations for the authenticated publisher
//	@Tags			Publisher
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string						true	"Publisher ID"
//	@Success		200				{object}	APIResponse{data=object}	"Cache invalidated"
//	@Failure		401				{object}	APIResponse{error=APIError}	"Unauthorized"
//	@Failure		404				{object}	APIResponse{error=APIError}	"Publisher not found"
//	@Router			/publisher/cache [delete]
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
