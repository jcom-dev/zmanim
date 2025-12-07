// File: publisher_zmanim.go
// Purpose: Publisher zmanim CRUD, linking, versioning, soft delete, restore
// Pattern: 6-step-handler
// Dependencies: Queries: zmanim.sql, algorithms.sql | Services: Cache
// Frequency: critical - 1,901 lines
// Compliance: Check docs/adr/ for pattern rationale

package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jcom-dev/zmanim-lab/internal/calendar"
	"github.com/jcom-dev/zmanim-lab/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim-lab/internal/dsl"
)

// PublisherZman represents a single zman formula for a publisher
type PublisherZman struct {
	ID               string    `json:"id" db:"id"`
	PublisherID      string    `json:"publisher_id" db:"publisher_id"`
	ZmanKey          string    `json:"zman_key" db:"zman_key"`
	HebrewName       string    `json:"hebrew_name" db:"hebrew_name"`
	EnglishName      string    `json:"english_name" db:"english_name"`
	Transliteration  *string   `json:"transliteration,omitempty" db:"transliteration"`
	Description      *string   `json:"description,omitempty" db:"description"`
	FormulaDSL       string    `json:"formula_dsl" db:"formula_dsl"`
	AIExplanation    *string   `json:"ai_explanation" db:"ai_explanation"`
	PublisherComment *string   `json:"publisher_comment" db:"publisher_comment"`
	IsEnabled        bool      `json:"is_enabled" db:"is_enabled"`
	IsVisible        bool      `json:"is_visible" db:"is_visible"`
	IsPublished      bool      `json:"is_published" db:"is_published"`
	IsBeta           bool      `json:"is_beta" db:"is_beta"`
	IsCustom         bool      `json:"is_custom" db:"is_custom"`
	IsEventZman      bool      `json:"is_event_zman" db:"is_event_zman"`
	Category         string    `json:"category" db:"category"`
	TimeCategory     string    `json:"time_category,omitempty" db:"time_category"` // For ordering (from registry)
	Dependencies     []string  `json:"dependencies" db:"dependencies"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
	Tags             []ZmanTag `json:"tags,omitempty" db:"tags"` // Tags from master zman
	// Linked zmanim support
	MasterZmanID              *string `json:"master_zman_id,omitempty" db:"master_zman_id"`
	LinkedPublisherZmanID     *string `json:"linked_publisher_zman_id,omitempty" db:"linked_publisher_zman_id"`
	SourceType                *string `json:"source_type,omitempty" db:"source_type"`
	IsLinked                  bool    `json:"is_linked" db:"is_linked"`
	LinkedSourcePublisherName *string `json:"linked_source_publisher_name,omitempty" db:"linked_source_publisher_name"`
	LinkedSourceIsDeleted     bool    `json:"linked_source_is_deleted" db:"linked_source_is_deleted"`
	// Source/original values from registry or linked publisher (for diff/revert functionality)
	SourceHebrewName      *string `json:"source_hebrew_name,omitempty" db:"source_hebrew_name"`
	SourceEnglishName     *string `json:"source_english_name,omitempty" db:"source_english_name"`
	SourceTransliteration *string `json:"source_transliteration,omitempty" db:"source_transliteration"`
	SourceDescription     *string `json:"source_description,omitempty" db:"source_description"`
	SourceFormulaDSL      *string `json:"source_formula_dsl,omitempty" db:"source_formula_dsl"`
}


// CreateZmanRequest represents the request body for creating a zman
type CreateZmanRequest struct {
	ZmanKey          string  `json:"zman_key" validate:"required"`
	HebrewName       string  `json:"hebrew_name" validate:"required"`
	EnglishName      string  `json:"english_name" validate:"required"`
	FormulaDSL       string  `json:"formula_dsl" validate:"required"`
	AIExplanation    *string `json:"ai_explanation"`
	PublisherComment *string `json:"publisher_comment"`
	IsEnabled        *bool   `json:"is_enabled"`
	IsVisible        *bool   `json:"is_visible"`
}

// UpdateZmanRequest represents the request body for updating a zman
type UpdateZmanRequest struct {
	HebrewName       *string `json:"hebrew_name"`
	EnglishName      *string `json:"english_name"`
	Transliteration  *string `json:"transliteration"`
	Description      *string `json:"description"`
	FormulaDSL       *string `json:"formula_dsl"`
	AIExplanation    *string `json:"ai_explanation"`
	PublisherComment *string `json:"publisher_comment"`
	IsEnabled        *bool   `json:"is_enabled"`
	IsVisible        *bool   `json:"is_visible"`
	IsPublished      *bool   `json:"is_published"`
	IsBeta           *bool   `json:"is_beta"`
	Category         *string `json:"category"`
}

// DayContext contains day-specific information for zmanim filtering
// This is entirely database/tag-driven - no hardcoded logic
type DayContext struct {
	Date                string   `json:"date"`                  // YYYY-MM-DD
	DayOfWeek           int      `json:"day_of_week"`           // 0=Sunday, 6=Saturday
	DayName             string   `json:"day_name"`              // "Sunday", "Friday", etc.
	HebrewDate          string   `json:"hebrew_date"`           // "23 Kislev 5785"
	HebrewDateFormatted string   `json:"hebrew_date_formatted"` // Hebrew letters format
	IsErevShabbos       bool     `json:"is_erev_shabbos"`       // Friday
	IsShabbos           bool     `json:"is_shabbos"`            // Saturday
	IsYomTov            bool     `json:"is_yom_tov"`            // Yom Tov day
	IsFastDay           bool     `json:"is_fast_day"`           // Fast day
	Holidays            []string `json:"holidays"`              // Holiday names
	ActiveEventCodes    []string `json:"active_event_codes"`    // Event codes active today
	ShowCandleLighting  bool     `json:"show_candle_lighting"`  // Should show candle lighting zmanim
	ShowHavdalah        bool     `json:"show_havdalah"`         // Should show havdalah zmanim
	ShowFastStart       bool     `json:"show_fast_start"`       // Should show fast start zmanim
	ShowFastEnd         bool     `json:"show_fast_end"`         // Should show fast end zmanim
	SpecialContexts     []string `json:"special_contexts"`      // shabbos_to_yomtov, etc.
}

// PublisherZmanWithTime extends PublisherZman with calculated time
type PublisherZmanWithTime struct {
	PublisherZman
	Time  *string `json:"time,omitempty"`  // Calculated time HH:MM:SS (nil if calculation failed)
	Error *string `json:"error,omitempty"` // Error message if calculation failed
}

// FilteredZmanimResponse is returned when date/location params are provided
type FilteredZmanimResponse struct {
	DayContext DayContext              `json:"day_context"`
	Zmanim     []PublisherZmanWithTime `json:"zmanim"`
}

// extractDependencies extracts @references from a DSL formula
func extractDependencies(formula string) []string {
	// Match @word_pattern (alphanumeric + underscores)
	re := regexp.MustCompile(`@([a-z_][a-z0-9_]*)`)
	matches := re.FindAllStringSubmatch(formula, -1)

	deps := make(map[string]bool) // Use map to avoid duplicates
	for _, match := range matches {
		if len(match) > 1 {
			deps[match[1]] = true
		}
	}

	// Convert map to slice
	result := make([]string, 0, len(deps))
	for dep := range deps {
		result = append(result, dep)
	}

	return result
}

// Day names for DayContext
var dayNames = []string{"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"}

// GetPublisherZmanim returns all zmanim for a publisher
// @Summary Get publisher zmanim
// @Description Returns all zmanim formulas for a publisher. With optional date/location params, returns filtered zmanim with calculated times and day context.
// @Tags Publisher Zmanim
// @Produce json
// @Security BearerAuth
// @Param X-Publisher-Id header string true "Publisher ID"
// @Param date query string false "Date for filtering and calculation (YYYY-MM-DD)"
// @Param latitude query number false "Latitude for time calculation (required with date)"
// @Param longitude query number false "Longitude for time calculation (required with date)"
// @Param timezone query string false "Timezone for calculation (defaults to UTC)"
// @Success 200 {object} APIResponse{data=object} "List of zmanim or filtered response with day context"
// @Failure 401 {object} APIResponse{error=APIError} "Unauthorized"
// @Failure 404 {object} APIResponse{error=APIError} "Publisher not found"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /publisher/zmanim [get]
func (h *Handlers) GetPublisherZmanim(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}
	publisherID := pc.PublisherID

	// Check for optional date/location params
	dateStr := r.URL.Query().Get("date")
	latStr := r.URL.Query().Get("latitude")
	lonStr := r.URL.Query().Get("longitude")
	timezone := r.URL.Query().Get("timezone")

	// Fetch all zmanim first
	zmanim, err := h.fetchPublisherZmanim(ctx, publisherID)
	if err != nil {
		slog.Error("failed to fetch zmanim", "error", err, "publisher_id", publisherID)
		RespondInternalError(w, r, "Failed to fetch zmanim")
		return
	}

	// If no date param, return all zmanim (original behavior)
	if dateStr == "" {
		slog.Info("fetched zmanim (unfiltered)", "count", len(zmanim), "publisher_id", publisherID)
		RespondJSON(w, r, http.StatusOK, zmanim)
		return
	}

	// Parse date
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid date format. Use YYYY-MM-DD")
		return
	}

	// Parse coordinates
	var latitude, longitude float64
	if latStr != "" {
		latitude, err = strconv.ParseFloat(latStr, 64)
		if err != nil || latitude < -90 || latitude > 90 {
			RespondBadRequest(w, r, "Invalid latitude. Must be between -90 and 90")
			return
		}
	}
	if lonStr != "" {
		longitude, err = strconv.ParseFloat(lonStr, 64)
		if err != nil || longitude < -180 || longitude > 180 {
			RespondBadRequest(w, r, "Invalid longitude. Must be between -180 and 180")
			return
		}
	}
	if timezone == "" {
		timezone = "UTC"
	}

	// Check cache first
	cacheKey := fmt.Sprintf("%s:%s:%.4f:%.4f", publisherID, dateStr, latitude, longitude)
	if h.cache != nil {
		cached, err := h.cache.GetZmanim(ctx, publisherID, cacheKey, dateStr)
		if err == nil && cached != nil {
			var response FilteredZmanimResponse
			if err := json.Unmarshal(cached.Data, &response); err == nil {
				slog.Info("serving cached filtered zmanim", "publisher_id", publisherID, "date", dateStr)
				RespondJSON(w, r, http.StatusOK, response)
				return
			}
		}
	}

	// Build day context using calendar service
	calService := calendar.NewCalendarService()
	loc := calendar.Location{
		Latitude:  latitude,
		Longitude: longitude,
		Timezone:  timezone,
		IsIsrael:  calendar.IsLocationInIsrael(latitude, longitude),
	}
	zmanimCtx := calService.GetZmanimContext(date, loc)
	hebrewDate := calService.GetHebrewDate(date)

	// Build holidays list from hebcal
	holidays := calService.GetHolidays(date)
	holidayNames := make([]string, 0, len(holidays))
	for _, h := range holidays {
		holidayNames = append(holidayNames, h.Name)
	}

	dayCtx := DayContext{
		Date:                dateStr,
		DayOfWeek:           int(date.Weekday()),
		DayName:             dayNames[date.Weekday()],
		HebrewDate:          hebrewDate.Formatted,
		HebrewDateFormatted: hebrewDate.Hebrew,
		IsErevShabbos:       date.Weekday() == time.Friday,
		IsShabbos:           date.Weekday() == time.Saturday,
		IsYomTov:            false, // Will be set below
		IsFastDay:           zmanimCtx.ShowFastStarts || zmanimCtx.ShowFastEnds,
		Holidays:            holidayNames,
		ActiveEventCodes:    zmanimCtx.ActiveEventCodes,
		ShowCandleLighting:  zmanimCtx.ShowCandleLighting || zmanimCtx.ShowCandleLightingSheni,
		ShowHavdalah:        zmanimCtx.ShowShabbosYomTovEnds,
		ShowFastStart:       zmanimCtx.ShowFastStarts,
		ShowFastEnd:         zmanimCtx.ShowFastEnds,
		SpecialContexts:     zmanimCtx.DisplayContexts,
	}

	// Check for Yom Tov from holidays
	for _, h := range holidays {
		if h.Yomtov {
			dayCtx.IsYomTov = true
			break
		}
	}

	// Filter and calculate times
	filteredZmanim := h.filterAndCalculateZmanim(zmanim, dayCtx, date, latitude, longitude, timezone)

	response := FilteredZmanimResponse{
		DayContext: dayCtx,
		Zmanim:     filteredZmanim,
	}

	// Cache the response
	if h.cache != nil {
		if err := h.cache.SetZmanim(ctx, publisherID, cacheKey, dateStr, response); err != nil {
			slog.Warn("failed to cache filtered zmanim", "error", err, "publisher_id", publisherID)
		}
	}

	slog.Info("fetched filtered zmanim", "count", len(filteredZmanim), "publisher_id", publisherID, "date", dateStr)
	RespondJSON(w, r, http.StatusOK, response)
}

// WeekDayZmanim represents zmanim for a single day in a week response
type WeekDayZmanim struct {
	DayContext DayContext              `json:"day_context"`
	Zmanim     []PublisherZmanWithTime `json:"zmanim"`
}

// WeekZmanimResponse is the response for the batch week endpoint
type WeekZmanimResponse struct {
	Days []WeekDayZmanim `json:"days"`
}

// GetPublisherZmanimWeek returns all zmanim for a publisher for an entire week
// This is a batch endpoint that calculates all 7 days in one request with caching
// GET /api/v1/publisher/zmanim/week?start_date=YYYY-MM-DD&latitude=X&longitude=Y&timezone=Z
func (h *Handlers) GetPublisherZmanimWeek(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}
	publisherID := pc.PublisherID

	// Parse query params
	startDateStr := r.URL.Query().Get("start_date")
	latStr := r.URL.Query().Get("latitude")
	lonStr := r.URL.Query().Get("longitude")
	timezone := r.URL.Query().Get("timezone")

	// Validate required params
	if startDateStr == "" {
		RespondBadRequest(w, r, "start_date is required (YYYY-MM-DD)")
		return
	}

	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid start_date format. Use YYYY-MM-DD")
		return
	}

	// Parse coordinates
	var latitude, longitude float64
	if latStr != "" {
		latitude, err = strconv.ParseFloat(latStr, 64)
		if err != nil || latitude < -90 || latitude > 90 {
			RespondBadRequest(w, r, "Invalid latitude. Must be between -90 and 90")
			return
		}
	}
	if lonStr != "" {
		longitude, err = strconv.ParseFloat(lonStr, 64)
		if err != nil || longitude < -180 || longitude > 180 {
			RespondBadRequest(w, r, "Invalid longitude. Must be between -180 and 180")
			return
		}
	}
	if timezone == "" {
		timezone = "UTC"
	}

	// Check cache first - use week start date as key
	cacheKey := fmt.Sprintf("week:%s:%s:%.4f:%.4f", publisherID, startDateStr, latitude, longitude)
	if h.cache != nil {
		cached, err := h.cache.GetZmanim(ctx, publisherID, cacheKey, startDateStr)
		if err == nil && cached != nil {
			var response WeekZmanimResponse
			if err := json.Unmarshal(cached.Data, &response); err == nil {
				slog.Info("serving cached week zmanim", "publisher_id", publisherID, "start_date", startDateStr)
				RespondJSON(w, r, http.StatusOK, response)
				return
			}
		}
	}

	// Fetch all zmanim once
	zmanim, err := h.fetchPublisherZmanim(ctx, publisherID)
	if err != nil {
		slog.Error("failed to fetch zmanim", "error", err, "publisher_id", publisherID)
		RespondInternalError(w, r, "Failed to fetch zmanim")
		return
	}

	// Build calendar service for day contexts
	calService := calendar.NewCalendarService()
	loc := calendar.Location{
		Latitude:  latitude,
		Longitude: longitude,
		Timezone:  timezone,
		IsIsrael:  calendar.IsLocationInIsrael(latitude, longitude),
	}

	// Calculate all 7 days
	days := make([]WeekDayZmanim, 7)
	for i := 0; i < 7; i++ {
		date := startDate.AddDate(0, 0, i)
		dateStr := date.Format("2006-01-02")

		// Build day context
		zmanimCtx := calService.GetZmanimContext(date, loc)
		hebrewDate := calService.GetHebrewDate(date)
		holidays := calService.GetHolidays(date)
		holidayNames := make([]string, 0, len(holidays))
		for _, h := range holidays {
			holidayNames = append(holidayNames, h.Name)
		}

		dayCtx := DayContext{
			Date:                dateStr,
			DayOfWeek:           int(date.Weekday()),
			DayName:             dayNames[date.Weekday()],
			HebrewDate:          hebrewDate.Formatted,
			HebrewDateFormatted: hebrewDate.Hebrew,
			IsErevShabbos:       date.Weekday() == time.Friday,
			IsShabbos:           date.Weekday() == time.Saturday,
			IsYomTov:            false,
			IsFastDay:           zmanimCtx.ShowFastStarts || zmanimCtx.ShowFastEnds,
			Holidays:            holidayNames,
			ActiveEventCodes:    zmanimCtx.ActiveEventCodes,
			ShowCandleLighting:  zmanimCtx.ShowCandleLighting || zmanimCtx.ShowCandleLightingSheni,
			ShowHavdalah:        zmanimCtx.ShowShabbosYomTovEnds,
			ShowFastStart:       zmanimCtx.ShowFastStarts,
			ShowFastEnd:         zmanimCtx.ShowFastEnds,
			SpecialContexts:     zmanimCtx.DisplayContexts,
		}

		// Check for Yom Tov
		for _, h := range holidays {
			if h.Yomtov {
				dayCtx.IsYomTov = true
				break
			}
		}

		// Filter and calculate times for this day
		filteredZmanim := h.filterAndCalculateZmanim(zmanim, dayCtx, date, latitude, longitude, timezone)

		days[i] = WeekDayZmanim{
			DayContext: dayCtx,
			Zmanim:     filteredZmanim,
		}
	}

	response := WeekZmanimResponse{Days: days}

	// Cache the response
	if h.cache != nil {
		if err := h.cache.SetZmanim(ctx, publisherID, cacheKey, startDateStr, response); err != nil {
			slog.Warn("failed to cache week zmanim", "error", err, "publisher_id", publisherID)
		}
	}

	slog.Info("fetched week zmanim", "publisher_id", publisherID, "start_date", startDateStr)
	RespondJSON(w, r, http.StatusOK, response)
}

// fetchPublisherZmanim retrieves all zmanim for a publisher from the database
func (h *Handlers) fetchPublisherZmanim(ctx context.Context, publisherID string) ([]PublisherZman, error) {
	// Convert publisherID to int32
	publisherIDInt32, err := stringToInt32(publisherID)
	if err != nil {
		return nil, fmt.Errorf("invalid publisher ID: %w", err)
	}

	// Use SQLc generated query
	sqlcResults, err := h.db.Queries.FetchPublisherZmanim(ctx, publisherIDInt32)
	if err != nil {
		return nil, err
	}

	// Convert SQLc results to PublisherZman slice
	zmanim := make([]PublisherZman, 0, len(sqlcResults))
	for _, row := range sqlcResults {
		var tags []ZmanTag
		if row.Tags != nil {
			if tagsBytes, err := json.Marshal(row.Tags); err == nil {
				_ = json.Unmarshal(tagsBytes, &tags)
			}
		}
		if tags == nil {
			tags = []ZmanTag{}
		}

		// Convert nullable fields
		var masterZmanID, linkedPublisherZmanID, linkedSourcePublisherName *string
		if row.MasterZmanID != nil {
			idStr := int32ToString(*row.MasterZmanID)
			masterZmanID = &idStr
		}
		if row.LinkedPublisherZmanID != nil {
			idStr := int32ToString(*row.LinkedPublisherZmanID)
			linkedPublisherZmanID = &idStr
		}
		if row.LinkedSourcePublisherName != nil {
			linkedSourcePublisherName = row.LinkedSourcePublisherName
		}

		// Convert source values
		var sourceHebrewName, sourceEnglishName, sourceTransliteration, sourceDescription, sourceFormulaDSL *string
		if row.SourceHebrewName != "" {
			sourceHebrewName = &row.SourceHebrewName
		}
		if row.SourceEnglishName != "" {
			sourceEnglishName = &row.SourceEnglishName
		}
		if row.SourceTransliteration != nil && *row.SourceTransliteration != "" {
			sourceTransliteration = row.SourceTransliteration
		}
		if row.SourceDescription != nil && *row.SourceDescription != "" {
			sourceDescription = row.SourceDescription
		}
		if row.SourceFormulaDsl != "" {
			sourceFormulaDSL = &row.SourceFormulaDsl
		}

		// Convert category from *string to string
		category := ""
		if row.Category != nil {
			category = *row.Category
		}

		// Convert source_type from *string to *string (already nullable)
		var sourceType *string
		if row.SourceType != nil {
			sourceType = row.SourceType
		}

		zmanim = append(zmanim, PublisherZman{
			ID:                        int32ToString(row.ID),
			PublisherID:               int32ToString(row.PublisherID),
			ZmanKey:                   row.ZmanKey,
			HebrewName:                row.HebrewName,
			EnglishName:               row.EnglishName,
			Transliteration:           row.Transliteration,
			Description:               row.Description,
			FormulaDSL:                row.FormulaDsl,
			AIExplanation:             row.AiExplanation,
			PublisherComment:          row.PublisherComment,
			IsEnabled:                 row.IsEnabled,
			IsVisible:                 row.IsVisible,
			IsPublished:               row.IsPublished,
			IsBeta:                    row.IsBeta,
			IsCustom:                  row.IsCustom,
			IsEventZman:               row.IsEventZman,
			Category:                  category,
			TimeCategory:              row.TimeCategory,
			Dependencies:              row.Dependencies,
			CreatedAt:                 row.CreatedAt.Time,
			UpdatedAt:                 row.UpdatedAt.Time,
			Tags:                      tags,
			MasterZmanID:              masterZmanID,
			LinkedPublisherZmanID:     linkedPublisherZmanID,
			SourceType:                sourceType,
			IsLinked:                  row.IsLinked,
			LinkedSourcePublisherName: linkedSourcePublisherName,
			LinkedSourceIsDeleted:     row.LinkedSourceIsDeleted,
			SourceHebrewName:          sourceHebrewName,
			SourceEnglishName:         sourceEnglishName,
			SourceTransliteration:     sourceTransliteration,
			SourceDescription:         sourceDescription,
			SourceFormulaDSL:          sourceFormulaDSL,
		})
	}

	return zmanim, nil
}

// filterAndCalculateZmanim filters zmanim based on day context and calculates times
// Filtering is entirely tag-driven - no hardcoded zman keys
func (h *Handlers) filterAndCalculateZmanim(zmanim []PublisherZman, dayCtx DayContext, date time.Time, lat, lon float64, timezone string) []PublisherZmanWithTime {
	var result []PublisherZmanWithTime

	// Load timezone
	tz, err := time.LoadLocation(timezone)
	if err != nil {
		tz = time.UTC
	}

	// Set date to start of day in timezone
	date = time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, tz)

	// Create DSL execution context for time calculation
	var execCtx *dsl.ExecutionContext
	if lat != 0 || lon != 0 {
		execCtx = dsl.NewExecutionContext(date, lat, lon, 0, tz)
	}

	for _, z := range zmanim {
		// Only include enabled zmanim
		if !z.IsEnabled {
			continue
		}

		// Check if this zman should be shown based on tags and day context
		if !h.shouldShowZman(z, dayCtx) {
			continue
		}

		// Build result with calculated time
		zwt := PublisherZmanWithTime{
			PublisherZman: z,
		}

		// Calculate time if we have location
		if execCtx != nil && z.FormulaDSL != "" {
			timeResult, _, calcErr := dsl.ExecuteFormulaWithBreakdown(z.FormulaDSL, execCtx)
			if calcErr != nil {
				errStr := calcErr.Error()
				zwt.Error = &errStr
			} else if !timeResult.IsZero() {
				timeStr := timeResult.Format("15:04:05")
				zwt.Time = &timeStr
			}
		}

		result = append(result, zwt)
	}

	// Sort all zmanim by calculated time for chronological display
	sortPublisherZmanimByTime(result)

	return result
}

// shouldShowZman determines if a zman should be shown based on its tags and day context
// This is entirely tag-driven - no hardcoded zman keys
func (h *Handlers) shouldShowZman(z PublisherZman, dayCtx DayContext) bool {
	// Check for behavior tags
	isCandleLighting := hasTagKey(z.Tags, "is_candle_lighting")
	isHavdalah := hasTagKey(z.Tags, "is_havdalah")
	isFastStart := hasTagKey(z.Tags, "is_fast_start")
	isFastEnd := hasTagKey(z.Tags, "is_fast_end")

	// If it's not an event zman (no behavior tags), always show it
	if !isCandleLighting && !isHavdalah && !isFastStart && !isFastEnd {
		return true
	}

	// Filter event zmanim based on day context
	if isCandleLighting && !dayCtx.ShowCandleLighting {
		return false
	}
	if isHavdalah && !dayCtx.ShowHavdalah {
		return false
	}
	if isFastStart && !dayCtx.ShowFastStart {
		return false
	}
	if isFastEnd && !dayCtx.ShowFastEnd {
		return false
	}

	return true
}

// hasTagKey checks if a zman has a specific tag by tag_key
func hasTagKey(tags []ZmanTag, tagKey string) bool {
	for _, t := range tags {
		if t.TagKey == tagKey {
			return true
		}
	}
	return false
}

// sqlcZmanRow is an interface for SQLc generated row types
type sqlcZmanRow interface {
	GetID() string
	GetPublisherID() string
	GetZmanKey() string
	GetHebrewName() string
	GetEnglishName() string
	GetFormulaDsl() string
	GetAiExplanation() *string
	GetPublisherComment() *string
	GetIsEnabled() bool
	GetIsVisible() bool
	GetIsPublished() bool
	GetIsCustom() bool
	GetCategory() string
	GetDependencies() []string
	GetSortOrder() int32
	GetCreatedAt() time.Time
	GetUpdatedAt() time.Time
}

// Convert GetPublisherZmanimRow to PublisherZman
func getPublisherZmanimRowToPublisherZman(z sqlcgen.GetPublisherZmanimRow) PublisherZman {
	var masterZmanID, linkedPublisherZmanID, linkedSourcePublisherName *string
	if z.MasterZmanID != nil {
		idStr := int32ToString(*z.MasterZmanID)
		masterZmanID = &idStr
	}
	if z.LinkedPublisherZmanID != nil {
		idStr := int32ToString(*z.LinkedPublisherZmanID)
		linkedPublisherZmanID = &idStr
	}
	if z.LinkedSourcePublisherName != nil {
		linkedSourcePublisherName = z.LinkedSourcePublisherName
	}

	// Convert source values - COALESCE makes these non-nullable strings
	var sourceHebrewName, sourceEnglishName, sourceTransliteration, sourceDescription, sourceFormulaDSL *string
	if z.SourceHebrewName != "" {
		sourceHebrewName = &z.SourceHebrewName
	}
	if z.SourceEnglishName != "" {
		sourceEnglishName = &z.SourceEnglishName
	}
	if z.SourceTransliteration != nil && *z.SourceTransliteration != "" {
		sourceTransliteration = z.SourceTransliteration
	}
	if z.SourceDescription != nil && *z.SourceDescription != "" {
		sourceDescription = z.SourceDescription
	}
	if z.SourceFormulaDsl != "" {
		sourceFormulaDSL = &z.SourceFormulaDsl
	}

	// Parse tags from JSON
	var tags []ZmanTag
	if z.Tags != nil {
		if tagsBytes, err := json.Marshal(z.Tags); err == nil {
			_ = json.Unmarshal(tagsBytes, &tags)
		}
	}

	// Convert Category from *string to string (use empty string if nil)
	category := ""
	if z.Category != nil {
		category = *z.Category
	}

	return PublisherZman{
		ID:                        int32ToString(z.ID),
		PublisherID:               int32ToString(z.PublisherID),
		ZmanKey:                   z.ZmanKey,
		HebrewName:                z.HebrewName,
		EnglishName:               z.EnglishName,
		Transliteration:           z.Transliteration,
		Description:               z.Description,
		FormulaDSL:                z.FormulaDsl,
		AIExplanation:             z.AiExplanation,
		PublisherComment:          z.PublisherComment,
		IsEnabled:                 z.IsEnabled,
		IsVisible:                 z.IsVisible,
		IsPublished:               z.IsPublished,
		IsBeta:                    z.IsBeta,
		IsCustom:                  z.IsCustom,
		IsEventZman:               z.IsEventZman,
		Category:                  category,
		TimeCategory:              z.TimeCategory,
		Dependencies:              z.Dependencies,
		CreatedAt:                 z.CreatedAt.Time,
		UpdatedAt:                 z.UpdatedAt.Time,
		Tags:                      tags,
		MasterZmanID:              masterZmanID,
		LinkedPublisherZmanID:     linkedPublisherZmanID,
		SourceType:                z.SourceType,
		IsLinked:                  z.IsLinked,
		LinkedSourcePublisherName: linkedSourcePublisherName,
		LinkedSourceIsDeleted:     z.LinkedSourceIsDeleted,
		SourceHebrewName:          sourceHebrewName,
		SourceEnglishName:         sourceEnglishName,
		SourceTransliteration:     sourceTransliteration,
		SourceDescription:         sourceDescription,
		SourceFormulaDSL:          sourceFormulaDSL,
	}
}

// Convert GetPublisherZmanByKeyRow to PublisherZman
func getPublisherZmanByKeyRowToPublisherZman(z sqlcgen.GetPublisherZmanByKeyRow) PublisherZman {
	var masterZmanID, linkedPublisherZmanID, linkedSourcePublisherName *string
	if z.MasterZmanID != nil {
		idStr := int32ToString(*z.MasterZmanID)
		masterZmanID = &idStr
	}
	if z.LinkedPublisherZmanID != nil {
		idStr := int32ToString(*z.LinkedPublisherZmanID)
		linkedPublisherZmanID = &idStr
	}
	if z.LinkedSourcePublisherName != nil {
		linkedSourcePublisherName = z.LinkedSourcePublisherName
	}

	// Convert source values - COALESCE makes these non-nullable strings
	var sourceHebrewName, sourceEnglishName, sourceTransliteration, sourceDescription, sourceFormulaDSL *string
	if z.SourceHebrewName != "" {
		sourceHebrewName = &z.SourceHebrewName
	}
	if z.SourceEnglishName != "" {
		sourceEnglishName = &z.SourceEnglishName
	}
	if z.SourceTransliteration != nil && *z.SourceTransliteration != "" {
		sourceTransliteration = z.SourceTransliteration
	}
	if z.SourceDescription != nil && *z.SourceDescription != "" {
		sourceDescription = z.SourceDescription
	}
	if z.SourceFormulaDsl != "" {
		sourceFormulaDSL = &z.SourceFormulaDsl
	}

	// Convert Category from *string to string (use empty string if nil)
	category := ""
	if z.Category != nil {
		category = *z.Category
	}

	return PublisherZman{
		ID:                        int32ToString(z.ID),
		PublisherID:               int32ToString(z.PublisherID),
		ZmanKey:                   z.ZmanKey,
		HebrewName:                z.HebrewName,
		EnglishName:               z.EnglishName,
		Transliteration:           z.Transliteration,
		Description:               z.Description,
		FormulaDSL:                z.FormulaDsl,
		AIExplanation:             z.AiExplanation,
		PublisherComment:          z.PublisherComment,
		IsEnabled:                 z.IsEnabled,
		IsVisible:                 z.IsVisible,
		IsPublished:               z.IsPublished,
		IsBeta:                    z.IsBeta,
		IsCustom:                  z.IsCustom,
		Category:                  category,
		TimeCategory:              z.TimeCategory,
		Dependencies:              z.Dependencies,
		CreatedAt:                 z.CreatedAt.Time,
		UpdatedAt:                 z.UpdatedAt.Time,
		MasterZmanID:              masterZmanID,
		LinkedPublisherZmanID:     linkedPublisherZmanID,
		SourceType:                z.SourceType,
		IsLinked:                  z.IsLinked,
		LinkedSourcePublisherName: linkedSourcePublisherName,
		SourceHebrewName:          sourceHebrewName,
		SourceEnglishName:         sourceEnglishName,
		SourceTransliteration:     sourceTransliteration,
		SourceDescription:         sourceDescription,
		SourceFormulaDSL:          sourceFormulaDSL,
	}
}

// Convert CreatePublisherZmanRow to PublisherZman
func createPublisherZmanRowToPublisherZman(z sqlcgen.CreatePublisherZmanRow) PublisherZman {
	return PublisherZman{
		ID:               int32ToString(z.ID),
		PublisherID:      int32ToString(z.PublisherID),
		ZmanKey:          z.ZmanKey,
		HebrewName:       z.HebrewName,
		EnglishName:      z.EnglishName,
		FormulaDSL:       z.FormulaDsl,
		AIExplanation:    z.AiExplanation,
		PublisherComment: z.PublisherComment,
		IsEnabled:        z.IsEnabled,
		IsVisible:        z.IsVisible,
		IsPublished:      z.IsPublished,
		IsBeta:           z.IsBeta,
		IsCustom:         z.IsCustom,
		Category:         "", // CreatePublisherZmanRow doesn't have Category field
		Dependencies:     z.Dependencies,
		CreatedAt:        z.CreatedAt.Time,
		UpdatedAt:        z.UpdatedAt.Time,
	}
}

// Convert UpdatePublisherZmanRow to PublisherZman
func updatePublisherZmanRowToPublisherZman(z sqlcgen.UpdatePublisherZmanRow) PublisherZman {
	return PublisherZman{
		ID:               int32ToString(z.ID),
		PublisherID:      int32ToString(z.PublisherID),
		ZmanKey:          z.ZmanKey,
		HebrewName:       z.HebrewName,
		EnglishName:      z.EnglishName,
		Transliteration:  z.Transliteration,
		Description:      z.Description,
		FormulaDSL:       z.FormulaDsl,
		AIExplanation:    z.AiExplanation,
		PublisherComment: z.PublisherComment,
		IsEnabled:        z.IsEnabled,
		IsVisible:        z.IsVisible,
		IsPublished:      z.IsPublished,
		IsBeta:           z.IsBeta,
		IsCustom:         z.IsCustom,
		Category:         "", // UpdatePublisherZmanRow doesn't have Category field
		Dependencies:     z.Dependencies,
		CreatedAt:        z.CreatedAt.Time,
		UpdatedAt:        z.UpdatedAt.Time,
	}
}

// NOTE: Template import functions removed - template system no longer used
// Convert ImportZmanimFromTemplatesRow to PublisherZman
// func importZmanimFromTemplatesRowToPublisherZman(z sqlcgen.ImportZmanimFromTemplatesRow) PublisherZman {
// 	return PublisherZman{
// 		ID:               z.ID,
// 		PublisherID:      z.PublisherID,
// 		ZmanKey:          z.ZmanKey,
// 		HebrewName:       z.HebrewName,
// 		EnglishName:      z.EnglishName,
// 		FormulaDSL:       z.FormulaDsl,
// 		AIExplanation:    z.AiExplanation,
// 		PublisherComment: z.PublisherComment,
// 		IsEnabled:        z.IsEnabled,
// 		IsVisible:        z.IsVisible,
// 		IsPublished:      z.IsPublished,
// 		IsCustom:         z.IsCustom,
// 		Category:         z.Category,
// 		Dependencies:     z.Dependencies,
// 		CreatedAt:        z.CreatedAt.Time,
// 		UpdatedAt:        z.UpdatedAt.Time,
// 	}
// }

// Convert ImportZmanimFromTemplatesByKeysRow to PublisherZman
// func importZmanimFromTemplatesByKeysRowToPublisherZman(z sqlcgen.ImportZmanimFromTemplatesByKeysRow) PublisherZman {
// 	return PublisherZman{
// 		ID:               z.ID,
// 		PublisherID:      z.PublisherID,
// 		ZmanKey:          z.ZmanKey,
// 		HebrewName:       z.HebrewName,
// 		EnglishName:      z.EnglishName,
// 		FormulaDSL:       z.FormulaDsl,
// 		AIExplanation:    z.AiExplanation,
// 		PublisherComment: z.PublisherComment,
// 		IsEnabled:        z.IsEnabled,
// 		IsVisible:        z.IsVisible,
// 		IsPublished:      z.IsPublished,
// 		IsCustom:         z.IsCustom,
// 		Category:         z.Category,
// 		Dependencies:     z.Dependencies,
// 		CreatedAt:        z.CreatedAt.Time,
// 		UpdatedAt:        z.UpdatedAt.Time,
// 	}
// }

// GetPublisherZman returns a single zman by key
// @Summary Get single zman
// @Description Returns a single zman formula by its unique key
// @Tags Publisher Zmanim
// @Produce json
// @Security BearerAuth
// @Param X-Publisher-Id header string true "Publisher ID"
// @Param zmanKey path string true "Zman key"
// @Success 200 {object} APIResponse{data=PublisherZman} "Zman details"
// @Failure 401 {object} APIResponse{error=APIError} "Unauthorized"
// @Failure 404 {object} APIResponse{error=APIError} "Zman not found"
// @Router /publisher/zmanim/{zmanKey} [get]
func (h *Handlers) GetPublisherZman(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}
	publisherIDStr := pc.PublisherID

	// Convert publisher ID from string to int32
	publisherID, err := stringToInt32(publisherIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	zmanKey := chi.URLParam(r, "zmanKey")

	// Use SQLc generated query
	sqlcZman, err := h.db.Queries.GetPublisherZmanByKey(ctx, sqlcgen.GetPublisherZmanByKeyParams{
		PublisherID: publisherID,
		ZmanKey:     zmanKey,
	})

	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Zman not found")
		return
	}
	if err != nil {
		RespondInternalError(w, r, "Failed to fetch zman")
		return
	}

	z := getPublisherZmanByKeyRowToPublisherZman(sqlcZman)

	RespondJSON(w, r, http.StatusOK, z)
}

// CreatePublisherZman creates a new custom zman
// @Summary Create custom zman
// @Description Creates a new custom zman formula for the publisher
// @Tags Publisher Zmanim
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param X-Publisher-Id header string true "Publisher ID"
// @Param request body CreateZmanRequest true "Zman data"
// @Success 201 {object} APIResponse{data=PublisherZman} "Created zman"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid request or duplicate key"
// @Failure 401 {object} APIResponse{error=APIError} "Unauthorized"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /publisher/zmanim [post]
func (h *Handlers) CreatePublisherZman(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}
	publisherIDStr := pc.PublisherID

	// Convert publisher ID from string to int32
	publisherID, err := stringToInt32(publisherIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	var req CreateZmanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Validate formula (basic check - full validation done by DSL validator)
	if len(strings.TrimSpace(req.FormulaDSL)) == 0 {
		RespondBadRequest(w, r, "Formula cannot be empty")
		return
	}

	// Extract dependencies from formula
	dependencies := extractDependencies(req.FormulaDSL)

	// Set defaults
	isEnabled := true
	if req.IsEnabled != nil {
		isEnabled = *req.IsEnabled
	}

	isVisible := true
	if req.IsVisible != nil {
		isVisible = *req.IsVisible
	}

	// Use SQLc generated query
	sqlcZman, insertErr := h.db.Queries.CreatePublisherZman(ctx, sqlcgen.CreatePublisherZmanParams{
		ID:               0, // Let database generate SERIAL ID
		PublisherID:      publisherID,
		ZmanKey:          req.ZmanKey,
		HebrewName:       req.HebrewName,
		EnglishName:      req.EnglishName,
		FormulaDsl:       req.FormulaDSL,
		AiExplanation:    req.AIExplanation,
		PublisherComment: req.PublisherComment,
		IsEnabled:        isEnabled,
		IsVisible:        isVisible,
		IsPublished:      false, // New zmanim start unpublished
		IsCustom:         true,  // Custom zmanim are always user-created
		TimeCategoryID:   nil,   // No category for custom zmanim
		Dependencies:     dependencies,
		MasterZmanID:     nil,
		LinkedPublisherZmanID: nil,
		SourceTypeID:     1, // Default source type (e.g., "custom")
	})

	if insertErr != nil {
		// Check for unique constraint violation
		if strings.Contains(insertErr.Error(), "duplicate key") {
			RespondBadRequest(w, r, fmt.Sprintf("Zman with key '%s' already exists", req.ZmanKey))
			return
		}
		RespondInternalError(w, r, "Failed to create zman")
		return
	}

	// Invalidate cache - new zman affects calculations
	if h.cache != nil {
		if err := h.cache.InvalidatePublisherCache(ctx, publisherIDStr); err != nil {
			slog.Warn("failed to invalidate cache after creating zman", "error", err, "publisher_id", publisherIDStr)
		}
	}

	z := createPublisherZmanRowToPublisherZman(sqlcZman)

	RespondJSON(w, r, http.StatusCreated, z)
}

// UpdatePublisherZman updates an existing zman
// @Summary Update zman
// @Description Updates an existing zman formula's properties
// @Tags Publisher Zmanim
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param X-Publisher-Id header string true "Publisher ID"
// @Param zmanKey path string true "Zman key"
// @Param request body UpdateZmanRequest true "Fields to update"
// @Success 200 {object} APIResponse{data=PublisherZman} "Updated zman"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid request"
// @Failure 401 {object} APIResponse{error=APIError} "Unauthorized"
// @Failure 404 {object} APIResponse{error=APIError} "Zman not found"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /publisher/zmanim/{zmanKey} [put]
func (h *Handlers) UpdatePublisherZman(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}
	publisherIDStr := pc.PublisherID

	// Convert publisher ID from string to int32
	publisherID, err := stringToInt32(publisherIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	zmanKey := chi.URLParam(r, "zmanKey")

	// Read and log the raw body for debugging
	bodyBytes, readErr := io.ReadAll(r.Body)
	if readErr != nil {
		slog.Error("UpdatePublisherZman: failed to read body", "error", readErr)
		RespondBadRequest(w, r, "Failed to read request body")
		return
	}
	slog.Debug("UpdatePublisherZman: raw body", "zman_key", zmanKey, "body", string(bodyBytes))

	var req UpdateZmanRequest
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		slog.Error("UpdatePublisherZman: failed to decode body", "error", err)
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	slog.Info("UpdatePublisherZman: request",
		"zman_key", zmanKey, "category", req.Category, "is_enabled", req.IsEnabled, "is_published", req.IsPublished, "is_beta", req.IsBeta)

	// At least one field must be provided
	if req.HebrewName == nil && req.EnglishName == nil && req.Transliteration == nil &&
		req.Description == nil && req.FormulaDSL == nil &&
		req.AIExplanation == nil && req.PublisherComment == nil &&
		req.IsEnabled == nil && req.IsVisible == nil && req.IsPublished == nil &&
		req.IsBeta == nil && req.Category == nil {
		slog.Error("UpdatePublisherZman: no fields to update")
		RespondBadRequest(w, r, "No fields to update")
		return
	}

	// Extract dependencies if formula is updated
	var dependencies []string
	if req.FormulaDSL != nil {
		dependencies = extractDependencies(*req.FormulaDSL)
	}

	// Use SQLc generated query
	sqlcZman, updateErr := h.db.Queries.UpdatePublisherZman(ctx, sqlcgen.UpdatePublisherZmanParams{
		PublisherID:      publisherID,
		ZmanKey:          zmanKey,
		HebrewName:       req.HebrewName,
		EnglishName:      req.EnglishName,
		Transliteration:  req.Transliteration,
		Description:      req.Description,
		FormulaDsl:       req.FormulaDSL,
		AiExplanation:    req.AIExplanation,
		PublisherComment: req.PublisherComment,
		IsEnabled:        req.IsEnabled,
		IsVisible:        req.IsVisible,
		IsPublished:      req.IsPublished,
		IsBeta:           req.IsBeta,
		Dependencies:     dependencies,
	})

	if updateErr == pgx.ErrNoRows {
		RespondNotFound(w, r, "Zman not found")
		return
	}
	if updateErr != nil {
		RespondInternalError(w, r, "Failed to update zman")
		return
	}

	// Invalidate all cached data for this publisher when formula or is_enabled changes
	if h.cache != nil && (req.FormulaDSL != nil || req.IsEnabled != nil) {
		if err := h.cache.InvalidatePublisherCache(ctx, publisherIDStr); err != nil {
			slog.Warn("failed to invalidate cache", "error", err, "publisher_id", publisherIDStr)
		} else {
			slog.Info("invalidated cache", "publisher_id", publisherIDStr, "reason", "zman_updated")
		}
	}

	z := updatePublisherZmanRowToPublisherZman(sqlcZman)

	RespondJSON(w, r, http.StatusOK, z)
}

// DeletePublisherZman deletes a custom zman
// DELETE /api/v1/publisher/zmanim/{zmanKey}
func (h *Handlers) DeletePublisherZman(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}
	publisherIDStr := pc.PublisherID

	// Convert publisher ID from string to int32
	publisherID, err := stringToInt32(publisherIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	zmanKey := chi.URLParam(r, "zmanKey")

	// Use SQLc generated query
	_, deleteErr := h.db.Queries.DeletePublisherZman(ctx, sqlcgen.DeletePublisherZmanParams{
		PublisherID: publisherID,
		ZmanKey:     zmanKey,
	})

	if deleteErr == pgx.ErrNoRows {
		RespondBadRequest(w, r, "Can only delete custom zmanim, or zman not found")
		return
	}
	if deleteErr != nil {
		RespondInternalError(w, r, "Failed to delete zman")
		return
	}

	// Invalidate cache - deleted zman affects calculations
	if h.cache != nil {
		if err := h.cache.InvalidatePublisherCache(ctx, fmt.Sprintf("%d", publisherID)); err != nil {
			slog.Warn("failed to invalidate cache after deleting zman", "error", err, "publisher_id", publisherID)
		}
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Zman deleted successfully",
	})
}

// ImportZmanim bulk imports zmanim from another publisher
// POST /api/v1/publisher/zmanim/import
func (h *Handlers) ImportZmanim(w http.ResponseWriter, r *http.Request) {
	RespondBadRequest(w, r, "Import feature is currently under maintenance. Please use the master registry instead.")
}


// BrowsePublicZmanim allows browsing public zmanim from other publishers
// GET /api/v1/zmanim/browse?q=search&category=optional
func (h *Handlers) BrowsePublicZmanim(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	searchQuery := r.URL.Query().Get("q")
	category := r.URL.Query().Get("category")

	// Parse category to int32 if provided
	var categoryID int32
	if category != "" {
		catID, err := stringToInt32(category)
		if err != nil {
			RespondBadRequest(w, r, "Invalid category ID")
			return
		}
		categoryID = catID
	}

	// Use SQLc generated query
	sqlcResults, err := h.db.Queries.BrowsePublicZmanim(ctx, sqlcgen.BrowsePublicZmanimParams{
		Column1: searchQuery, // Search term (can be empty)
		Column2: categoryID,  // Category filter (can be empty)
	})
	if err != nil {
		RespondInternalError(w, r, "Failed to browse zmanim")
		return
	}

	type BrowseResult struct {
		ID            string `json:"id"`
		PublisherID   string `json:"publisher_id"`
		PublisherName string `json:"publisher_name"`
		ZmanKey       string `json:"zman_key"`
		HebrewName    string `json:"hebrew_name"`
		EnglishName   string `json:"english_name"`
		FormulaDSL    string `json:"formula_dsl"`
		Category      string `json:"category"`
		UsageCount    int    `json:"usage_count"`
	}

	results := make([]BrowseResult, len(sqlcResults))
	for i, r := range sqlcResults {
		categoryStr := ""
		if r.Category != nil {
			categoryStr = *r.Category
		}
		results[i] = BrowseResult{
			ID:            int32ToString(r.ID),
			PublisherID:   int32ToString(r.PublisherID),
			PublisherName: r.PublisherName,
			ZmanKey:       r.ZmanKey,
			HebrewName:    r.HebrewName,
			EnglishName:   r.EnglishName,
			FormulaDSL:    r.FormulaDsl,
			Category:      categoryStr,
			UsageCount:    int(r.UsageCount),
		}
	}

	RespondJSON(w, r, http.StatusOK, results)
}

// VerifiedPublisher represents a verified publisher for linking
type VerifiedPublisher struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	LogoURL     *string `json:"logo_url,omitempty"`
	ZmanimCount int     `json:"zmanim_count"`
}

// PublisherZmanForLinking represents a zman available for linking/copying
type PublisherZmanForLinking struct {
	ID            string  `json:"id"`
	PublisherID   string  `json:"publisher_id"`
	PublisherName string  `json:"publisher_name"`
	ZmanKey       string  `json:"zman_key"`
	HebrewName    string  `json:"hebrew_name"`
	EnglishName   string  `json:"english_name"`
	FormulaDSL    string  `json:"formula_dsl"`
	Category      string  `json:"category"`
	SourceType    *string `json:"source_type,omitempty"`
}

// CreateFromPublisherRequest represents the request for copying/linking from another publisher
type CreateFromPublisherRequest struct {
	SourcePublisherZmanID string `json:"source_publisher_zman_id" validate:"required"`
	Mode                  string `json:"mode" validate:"required"` // "copy" or "link"
}

// GetVerifiedPublishers returns verified publishers that can be linked to
// GET /api/v1/publishers/verified
func (h *Handlers) GetVerifiedPublishers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context (to exclude self)
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}
	publisherIDStr := pc.PublisherID

	// Convert publisher ID to int32
	publisherID, err := stringToInt32(publisherIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Use SQLc generated query
	sqlcResults, err := h.db.Queries.GetVerifiedPublishers(ctx, publisherID)
	if err != nil {
		slog.Error("failed to fetch verified publishers", "error", err)
		RespondInternalError(w, r, "Failed to fetch publishers")
		return
	}

	// Convert SQLc results to VerifiedPublisher slice
	publishers := make([]VerifiedPublisher, 0, len(sqlcResults))
	for _, row := range sqlcResults {
		publishers = append(publishers, VerifiedPublisher{
			ID:          int32ToString(row.ID),
			Name:        row.Name,
			LogoURL:     row.LogoUrl,
			ZmanimCount: int(row.ZmanimCount),
		})
	}

	RespondJSON(w, r, http.StatusOK, publishers)
}

// GetPublisherZmanimForLinking returns zmanim from a publisher available for linking
// GET /api/v1/publishers/{publisherId}/zmanim
func (h *Handlers) GetPublisherZmanimForLinking(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get current publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}
	currentPublisherIDStr := pc.PublisherID

	// Get target publisher ID from URL
	sourcePublisherIDStr := chi.URLParam(r, "publisherId")
	if sourcePublisherIDStr == "" {
		RespondBadRequest(w, r, "Publisher ID is required")
		return
	}

	// Convert IDs to int32
	sourcePublisherID, err := stringToInt32(sourcePublisherIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid source publisher ID")
		return
	}
	currentPublisherID, err := stringToInt32(currentPublisherIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid current publisher ID")
		return
	}

	// Verify source publisher is verified using SQLc
	isVerified, err := h.db.Queries.CheckPublisherVerified(ctx, sourcePublisherID)
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Publisher not found")
		return
	}
	if err != nil {
		RespondInternalError(w, r, "Failed to verify publisher")
		return
	}
	if !isVerified {
		RespondForbidden(w, r, "Publisher is not verified for linking")
		return
	}

	// Use SQLc generated query to get zmanim for linking
	sqlcResults, err := h.db.Queries.GetPublisherZmanimForLinking(ctx, sqlcgen.GetPublisherZmanimForLinkingParams{
		PublisherID: sourcePublisherID,
		Column2:     currentPublisherID, // Exclude zmanim already owned by current publisher
	})
	if err != nil {
		slog.Error("failed to fetch zmanim for linking", "error", err)
		RespondInternalError(w, r, "Failed to fetch zmanim")
		return
	}

	// Convert SQLc results to PublisherZmanForLinking slice
	zmanim := make([]PublisherZmanForLinking, 0, len(sqlcResults))
	for _, row := range sqlcResults {
		category := ""
		if row.Category != nil {
			category = *row.Category
		}
		var sourceType *string
		if row.SourceType != nil {
			sourceType = row.SourceType
		}

		zmanim = append(zmanim, PublisherZmanForLinking{
			ID:            int32ToString(row.ID),
			PublisherID:   int32ToString(row.PublisherID),
			PublisherName: row.PublisherName,
			ZmanKey:       row.ZmanKey,
			HebrewName:    row.HebrewName,
			EnglishName:   row.EnglishName,
			FormulaDSL:    row.FormulaDsl,
			Category:      category,
			SourceType:    sourceType,
		})
	}

	RespondJSON(w, r, http.StatusOK, zmanim)
}

// CreateZmanFromPublisher creates a zman by copying or linking from another publisher
// POST /api/v1/publisher/zmanim/from-publisher
func (h *Handlers) CreateZmanFromPublisher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}
	publisherID := pc.PublisherID

	var req CreateFromPublisherRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Validate mode
	if req.Mode != "copy" && req.Mode != "link" {
		RespondBadRequest(w, r, "Mode must be 'copy' or 'link'")
		return
	}

	// Convert source zman ID to int32
	sourceZmanIDInt32, err := stringToInt32(req.SourcePublisherZmanID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid source zman ID")
		return
	}

	// Fetch source zman using SQLc
	sourceZman, err := h.db.Queries.GetSourceZmanForLinking(ctx, sourceZmanIDInt32)
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Source zman not found or not available")
		return
	}
	if err != nil {
		slog.Error("failed to fetch source zman", "error", err)
		RespondInternalError(w, r, "Failed to fetch source zman")
		return
	}

	// For linking, verify source publisher is verified
	if req.Mode == "link" && !sourceZman.IsVerified {
		RespondForbidden(w, r, "Can only link to zmanim from verified publishers")
		return
	}

	// Convert publisherID to int32
	publisherIDInt32, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Check if zman_key already exists for this publisher using SQLc
	existsResult, err := h.db.Queries.CheckZmanKeyExists(ctx, sqlcgen.CheckZmanKeyExistsParams{
		PublisherID: publisherIDInt32,
		ZmanKey:     sourceZman.ZmanKey,
	})
	if err != nil {
		RespondInternalError(w, r, "Failed to check existing zman")
		return
	}
	if existsResult {
		RespondBadRequest(w, r, fmt.Sprintf("Zman with key '%s' already exists", sourceZman.ZmanKey))
		return
	}

	// Prepare parameters for insert
	var linkedID *int32
	var formulaDSL string
	if req.Mode == "copy" {
		linkedID = nil
		formulaDSL = sourceZman.FormulaDsl
	} else {
		// Mode is "link"
		linkedID = &sourceZmanIDInt32
		formulaDSL = "" // For linked zmanim, formula is resolved at query time
	}

	// Convert master_zman_id if present
	var masterZmanIDInt32 *int32
	if sourceZman.MasterZmanID != nil {
		masterZmanIDInt32 = sourceZman.MasterZmanID
	}

	// Insert the new zman using SQLc
	result, err := h.db.Queries.CreateLinkedOrCopiedZman(ctx, sqlcgen.CreateLinkedOrCopiedZmanParams{
		PublisherID:           publisherIDInt32,
		ZmanKey:               sourceZman.ZmanKey,
		HebrewName:            sourceZman.HebrewName,
		EnglishName:           sourceZman.EnglishName,
		FormulaDsl:            formulaDSL,
		TimeCategoryID:        nil, // Will be inherited from source if needed
		Dependencies:          sourceZman.Dependencies,
		MasterZmanID:          masterZmanIDInt32,
		LinkedPublisherZmanID: linkedID,
	})

	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			RespondBadRequest(w, r, fmt.Sprintf("Zman with key '%s' already exists", sourceZman.ZmanKey))
			return
		}
		slog.Error("failed to create zman from publisher", "error", err)
		RespondInternalError(w, r, "Failed to create zman")
		return
	}

	// Invalidate cache - new linked/copied zman affects calculations
	if h.cache != nil {
		if err := h.cache.InvalidatePublisherCache(ctx, publisherID); err != nil {
			slog.Warn("failed to invalidate cache after creating linked zman", "error", err, "publisher_id", publisherID)
		}
	}

	// Convert IDs to strings for response
	var linkedIDStr *string
	if linkedID != nil {
		linkedStr := int32ToString(*linkedID)
		linkedIDStr = &linkedStr
	}
	var masterZmanIDStr *string
	if masterZmanIDInt32 != nil {
		masterStr := int32ToString(*masterZmanIDInt32)
		masterZmanIDStr = &masterStr
	}

	// Convert category to string
	category := ""
	if sourceZman.Category != nil {
		category = *sourceZman.Category
	}

	// Determine source type string
	var sourceTypeStr string
	if req.Mode == "copy" {
		sourceTypeStr = "copied"
	} else {
		sourceTypeStr = "linked"
	}

	// Return the created zman
	response := PublisherZman{
		ID:                    int32ToString(result.ID),
		PublisherID:           publisherID,
		ZmanKey:               sourceZman.ZmanKey,
		HebrewName:            sourceZman.HebrewName,
		EnglishName:           sourceZman.EnglishName,
		FormulaDSL:            sourceZman.FormulaDsl, // Return the resolved formula
		IsEnabled:             true,
		IsVisible:             true,
		IsPublished:           false,
		IsCustom:              false,
		Category:              category,
		Dependencies:          sourceZman.Dependencies,
		CreatedAt:             result.CreatedAt.Time,
		UpdatedAt:             result.UpdatedAt.Time,
		MasterZmanID:          masterZmanIDStr,
		LinkedPublisherZmanID: linkedIDStr,
		SourceType:            &sourceTypeStr,
		IsLinked:              req.Mode == "link",
	}

	RespondJSON(w, r, http.StatusCreated, response)
}

// ============================================================================
// Publisher Zman Tags
// ============================================================================

// GetPublisherZmanTags returns all tags for a specific publisher zman
// GET /api/v1/publisher/zmanim/{zmanKey}/tags
func (h *Handlers) GetPublisherZmanTags(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID
	zmanKey := chi.URLParam(r, "zmanKey")

	// First get the publisher_zman_id using SQLc
	publisherIDInt32, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	zmanID, err := h.db.Queries.GetPublisherZmanIDByKey(ctx, sqlcgen.GetPublisherZmanIDByKeyParams{
		PublisherID: publisherIDInt32,
		ZmanKey:     zmanKey,
	})
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Zman not found")
		return
	}
	if err != nil {
		slog.Error("failed to find zman", "error", err)
		RespondInternalError(w, r, "Failed to find zman")
		return
	}

	// Get tags using SQLc
	tags, err := h.db.Queries.GetPublisherZmanTags(ctx, zmanID)
	if err != nil {
		slog.Error("failed to get tags", "error", err)
		RespondInternalError(w, r, "Failed to get tags")
		return
	}

	RespondJSON(w, r, http.StatusOK, tags)
}

// UpdatePublisherZmanTagsRequest represents the request body for updating tags
type UpdatePublisherZmanTagsRequest struct {
	Tags []TagAssignment `json:"tags"`
}

// UpdatePublisherZmanTags replaces all tags for a publisher zman
// PUT /api/v1/publisher/zmanim/{zmanKey}/tags
func (h *Handlers) UpdatePublisherZmanTags(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID
	zmanKey := chi.URLParam(r, "zmanKey")

	var req UpdatePublisherZmanTagsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// First get the publisher_zman_id using SQLc
	publisherIDInt32, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	zmanID, err := h.db.Queries.GetPublisherZmanIDByKey(ctx, sqlcgen.GetPublisherZmanIDByKeyParams{
		PublisherID: publisherIDInt32,
		ZmanKey:     zmanKey,
	})
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Zman not found")
		return
	}
	if err != nil {
		slog.Error("failed to find zman", "error", err)
		RespondInternalError(w, r, "Failed to find zman")
		return
	}

	// Delete existing tags using SQLc
	err = h.db.Queries.DeletePublisherZmanTags(ctx, zmanID)
	if err != nil {
		slog.Error("failed to delete existing tags", "error", err)
		RespondInternalError(w, r, "Failed to update tags")
		return
	}

	// Insert new tags with is_negated using SQLc
	for _, tag := range req.Tags {
		tagID, err := stringToInt32(tag.TagID)
		if err != nil {
			slog.Error("invalid tag ID", "error", err, "tag_id", tag.TagID)
			RespondBadRequest(w, r, "Invalid tag ID")
			return
		}

		err = h.db.Queries.InsertPublisherZmanTag(ctx, sqlcgen.InsertPublisherZmanTagParams{
			PublisherZmanID: zmanID,
			TagID:           tagID,
			IsNegated:       tag.IsNegated,
		})
		if err != nil {
			slog.Error("failed to insert tag", "error", err, "tag_id", tag.TagID)
			RespondInternalError(w, r, "Failed to update tags")
			return
		}
	}

	// Fetch updated tags
	tags, err := h.db.Queries.GetPublisherZmanTags(ctx, zmanID)
	if err != nil {
		slog.Error("failed to get updated tags", "error", err)
		RespondInternalError(w, r, "Tags updated but failed to fetch")
		return
	}

	RespondJSON(w, r, http.StatusOK, tags)
}

// AddTagRequest represents the request body for adding a single tag
type AddTagRequest struct {
	IsNegated bool `json:"is_negated"`
}

// AddTagToPublisherZman adds a single tag to a publisher zman
// POST /api/v1/publisher/zmanim/{zmanKey}/tags/{tagId}
func (h *Handlers) AddTagToPublisherZman(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID
	zmanKey := chi.URLParam(r, "zmanKey")
	tagID := chi.URLParam(r, "tagId")

	// Parse optional request body for is_negated
	var req AddTagRequest
	if r.Body != nil && r.ContentLength > 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			// Ignore decode errors - default to is_negated=false
		}
	}

	// Get the publisher_zman_id using SQLc
	publisherIDInt32, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	zmanID, err := h.db.Queries.GetPublisherZmanIDByKey(ctx, sqlcgen.GetPublisherZmanIDByKeyParams{
		PublisherID: publisherIDInt32,
		ZmanKey:     zmanKey,
	})
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Zman not found")
		return
	}
	if err != nil {
		slog.Error("failed to find zman", "error", err)
		RespondInternalError(w, r, "Failed to find zman")
		return
	}

	// Convert tagID to int32
	tagIDInt32, err := stringToInt32(tagID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid tag ID")
		return
	}

	// Add the tag with is_negated using SQLc
	err = h.db.Queries.AddTagToPublisherZman(ctx, sqlcgen.AddTagToPublisherZmanParams{
		PublisherZmanID: zmanID,
		TagID:           tagIDInt32,
		IsNegated:       req.IsNegated,
	})
	if err != nil {
		slog.Error("failed to add tag", "error", err)
		RespondInternalError(w, r, "Failed to add tag")
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Tag added successfully",
	})
}

// RemoveTagFromPublisherZman removes a single tag from a publisher zman
// DELETE /api/v1/publisher/zmanim/{zmanKey}/tags/{tagId}
func (h *Handlers) RemoveTagFromPublisherZman(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID
	zmanKey := chi.URLParam(r, "zmanKey")
	tagID := chi.URLParam(r, "tagId")

	// Get the publisher_zman_id using SQLc
	publisherIDInt32, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	zmanID, err := h.db.Queries.GetPublisherZmanIDByKey(ctx, sqlcgen.GetPublisherZmanIDByKeyParams{
		PublisherID: publisherIDInt32,
		ZmanKey:     zmanKey,
	})
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Zman not found")
		return
	}
	if err != nil {
		slog.Error("failed to find zman", "error", err)
		RespondInternalError(w, r, "Failed to find zman")
		return
	}

	// Convert tagID to int32
	tagIDInt32, err := stringToInt32(tagID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid tag ID")
		return
	}

	// Remove the tag using SQLc
	err = h.db.Queries.RemoveTagFromPublisherZman(ctx, sqlcgen.RemoveTagFromPublisherZmanParams{
		PublisherZmanID: zmanID,
		TagID:           tagIDInt32,
	})
	if err != nil {
		slog.Error("failed to remove tag", "error", err)
		RespondInternalError(w, r, "Failed to remove tag")
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Tag removed successfully",
	})
}
