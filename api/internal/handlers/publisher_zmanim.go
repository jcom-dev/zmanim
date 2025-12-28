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
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jcom-dev/zmanim/internal/calendar"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/services"
)

// PublisherZman represents a single zman formula for a publisher
type PublisherZman struct {
	ID               string     `json:"id" db:"id"`
	PublisherID      string     `json:"publisher_id" db:"publisher_id"`
	ZmanKey          string     `json:"zman_key" db:"zman_key"`
	HebrewName       string     `json:"hebrew_name" db:"hebrew_name"`
	EnglishName      string     `json:"english_name" db:"english_name"`
	Transliteration  *string    `json:"transliteration,omitempty" db:"transliteration"`
	Description      *string    `json:"description,omitempty" db:"description"`
	FormulaDSL       string     `json:"formula_dsl" db:"formula_dsl"`
	AIExplanation    *string    `json:"ai_explanation" db:"ai_explanation"`
	PublisherComment *string    `json:"publisher_comment" db:"publisher_comment"`
	IsEnabled        bool       `json:"is_enabled" db:"is_enabled"`
	IsVisible        bool       `json:"is_visible" db:"is_visible"`
	IsPublished      bool       `json:"is_published" db:"is_published"`
	IsBeta           bool       `json:"is_beta" db:"is_beta"`
	IsCustom         bool       `json:"is_custom" db:"is_custom"`
	IsEventZman      bool       `json:"is_event_zman" db:"is_event_zman"`
	DisplayStatus    string     `json:"display_status" db:"display_status"`         // core, optional, hidden
	TimeCategory     string     `json:"time_category,omitempty" db:"time_category"` // For ordering (from registry)
	Dependencies     []string   `json:"dependencies" db:"dependencies"`
	RoundingMode     string     `json:"rounding_mode" db:"rounding_mode"` // Story 8-34: floor | math | ceil
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt        *time.Time `json:"deleted_at,omitempty" db:"deleted_at"` // Soft delete timestamp
	Tags             []ZmanTag  `json:"tags,omitempty" db:"tags"`             // Tags from master zman
	// Linked zmanim support
	MasterZmanID              *string `json:"master_zman_id,omitempty" db:"master_zman_id"`
	LinkedPublisherZmanID     *string `json:"linked_publisher_zman_id,omitempty" db:"linked_publisher_zman_id"`
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
	DisplayStatus    *string `json:"display_status"` // core, optional, hidden
	RoundingMode     *string `json:"rounding_mode"`  // Story 8-34: floor | math | ceil
}

// HolidayInfo contains bilingual holiday information
type HolidayInfo struct {
	Name       string `json:"name"`        // English name
	NameHebrew string `json:"name_hebrew"` // Hebrew name
	Category   string `json:"category"`    // major, minor, fast, roshchodesh, shabbat
	IsYomTov   bool   `json:"is_yom_tov"`  // Is this a Yom Tov
}

// DayContext contains day-specific information for zmanim filtering
// This is entirely database/tag-driven - no hardcoded logic
type DayContext struct {
	Date                string        `json:"date"`                  // YYYY-MM-DD
	DayOfWeek           int           `json:"day_of_week"`           // 0=Sunday, 6=Saturday
	DayName             string        `json:"day_name"`              // "Sunday", "Friday", etc.
	HebrewDate          string        `json:"hebrew_date"`           // "23 Kislev 5785"
	HebrewDateFormatted string        `json:"hebrew_date_formatted"` // Hebrew letters format
	Holidays            []HolidayInfo `json:"holidays"`              // Holiday info with bilingual names
	ActiveEventCodes    []string      `json:"active_event_codes"`    // Event codes active today
	SpecialContexts     []string      `json:"special_contexts"`      // shabbos_to_yomtov, etc.
}

// PublisherZmanWithTime extends PublisherZman with calculated time
type PublisherZmanWithTime struct {
	PublisherZman
	Time          *string `json:"time,omitempty"`         // Calculated time HH:MM:SS with actual seconds
	TimeRounded   *string `json:"time_rounded,omitempty"` // Rounded time HH:MM (no seconds)
	Timestamp     *int64  `json:"timestamp,omitempty"`    // Unix seconds (nil if calculation failed)
	Error         *string `json:"error,omitempty"`        // Error message if calculation failed
	IsActiveToday bool    `json:"is_active_today"`        // Whether this zman is active for the current day context
}

// GetTimeCategory implements services.SortableZman
func (z *PublisherZmanWithTime) GetTimeCategory() string {
	return z.TimeCategory
}

// GetCalculatedTime implements services.SortableZman
func (z *PublisherZmanWithTime) GetCalculatedTime() *string {
	return z.Time
}

// GetHebrewName implements services.SortableZman
func (z *PublisherZmanWithTime) GetHebrewName() string {
	return z.HebrewName
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
//
//	@Summary		Get publisher zmanim
//	@Description	Returns all zmanim formulas for a publisher. With optional locality_id param, returns zmanim with calculated times and day context.
//	@Tags			Publisher Zmanim
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string						true	"Publisher ID"
//	@Param			locality_id		query		string						false	"Locality ID for calculated times (triggers unified response with day_context)"
//	@Param			date			query		string						false	"Date for calculation (YYYY-MM-DD, defaults to today when locality_id provided)"
//	@Param			latitude		query		number						false	"DEPRECATED: Use locality_id instead. Latitude for time calculation"
//	@Param			longitude		query		number						false	"DEPRECATED: Use locality_id instead. Longitude for time calculation"
//	@Param			timezone		query		string						false	"DEPRECATED: Use locality_id instead. Timezone for calculation"
//	@Success		200				{object}	APIResponse{data=object}	"List of zmanim or filtered response with day context"
//	@Failure		401				{object}	APIResponse{error=APIError}	"Unauthorized"
//	@Failure		404				{object}	APIResponse{error=APIError}	"Publisher not found"
//	@Failure		500				{object}	APIResponse{error=APIError}	"Internal server error"
//	@Router			/publisher/zmanim [get]
func (h *Handlers) GetPublisherZmanim(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}
	publisherID := pc.PublisherID

	// locality_id is required
	localityIDStr := r.URL.Query().Get("locality_id")
	if localityIDStr == "" {
		RespondBadRequest(w, r, "locality_id is required")
		return
	}

	dateStr := r.URL.Query().Get("date")
	includeDisabled := r.URL.Query().Get("includeDisabled") == "true"
	includeUnpublished := r.URL.Query().Get("includeUnpublished") == "true"
	includeInactive := r.URL.Query().Get("includeInactive") == "true"

	// Parse locality_id
	localityID, err := strconv.ParseInt(localityIDStr, 10, 64)
	if err != nil {
		RespondBadRequest(w, r, "Invalid locality_id")
		return
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

	// Convert publisher ID to int32
	publisherIDInt32, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Build calendar context for event filtering
	// Note: We need to get zmanimCtx early to pass ActiveEventCodes to CalculateZmanim
	// Get locality details first
	localityID32 := int32(localityID)
	locality, err := h.db.Queries.GetLocalityDetailsForZmanim(ctx, localityID32)
	if err != nil {
		RespondNotFound(w, r, "Locality not found")
		return
	}

	// Build calendar service with database adapter for event mapping
	dbAdapter := NewCalendarDBAdapter(h.db.Queries)
	calService := calendar.NewCalendarServiceWithDB(dbAdapter)
	var lat, lng float64
	if locality.Latitude != nil {
		lat = *locality.Latitude
	}
	if locality.Longitude != nil {
		lng = *locality.Longitude
	}

	loc := calendar.Location{
		Latitude:  lat,
		Longitude: lng,
		Timezone:  locality.Timezone,
		IsIsrael:  calendar.IsLocationInIsrael(lat, lng),
	}

	// Load timezone for date parsing
	tz, err := time.LoadLocation(locality.Timezone)
	if err != nil {
		tz = time.UTC
	}
	dateInTz := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, tz)

	// Get publisher's transliteration style preference
	transliterationStyle, err := h.db.Queries.GetPublisherTransliterationStyle(ctx, publisherIDInt32)
	if err != nil {
		slog.Warn("failed to get publisher transliteration style, using default", "error", err, "publisher_id", publisherID)
		transliterationStyle = "ashkenazi" // Default to Ashkenazi
	}

	zmanimCtx := calService.GetZmanimContext(dateInTz, loc, transliterationStyle)

	slog.Info("calendar context for publisher zmanim",
		"date", dateStr,
		"active_event_codes", zmanimCtx.ActiveEventCodes,
		"event_count", len(zmanimCtx.ActiveEventCodes),
		"publisher_id", publisherID,
		"include_inactive", includeInactive)

	// Determine ActiveEventCodes for filtering
	// ALWAYS pass actual event codes - service layer uses them for:
	// 1. Filtering (when show_in_preview=false) - controlled by service logic
	// 2. Computing is_active_today field (always, even with includeInactive=true)
	activeEventCodes := zmanimCtx.ActiveEventCodes

	// Use unified calculation service (includes caching, coordinate resolution, etc.)
	calcResult, err := h.zmanimService.CalculateZmanim(ctx, services.CalculateParams{
		LocalityID:         localityID,
		PublisherID:        publisherIDInt32,
		Date:               date,
		IncludeDisabled:    includeDisabled,
		IncludeUnpublished: includeUnpublished,
		IncludeBeta:        true,
		IncludeInactive:    includeInactive,
		ActiveEventCodes:   activeEventCodes,
	})
	if err != nil {
		slog.Error("calculation failed", "error", err, "publisher_id", publisherID, "locality_id", localityID)
		RespondInternalError(w, r, "Failed to calculate zmanim")
		return
	}

	// Get Hebrew date for day context
	hebrewDate := calService.GetHebrewDate(dateInTz)

	// Build holidays list (with publisher's transliteration style)
	holidays := calService.GetHolidaysWithStyle(dateInTz, transliterationStyle)
	holidayInfos := make([]HolidayInfo, 0, len(holidays))
	for _, hol := range holidays {
		holidayInfos = append(holidayInfos, HolidayInfo{
			Name:       hol.Name,
			NameHebrew: hol.NameHebrew,
			Category:   hol.Category,
			IsYomTov:   hol.Yomtov,
		})
	}

	dayCtx := DayContext{
		Date:                dateStr,
		DayOfWeek:           int(dateInTz.Weekday()),
		DayName:             dayNames[dateInTz.Weekday()],
		HebrewDate:          hebrewDate.Formatted,
		HebrewDateFormatted: hebrewDate.Hebrew,
		Holidays:            holidayInfos,
		ActiveEventCodes:    zmanimCtx.ActiveEventCodes,
		SpecialContexts:     zmanimCtx.DisplayContexts,
	}

	// Fetch publisher zmanim metadata for enrichment
	zmanimMetadata, err := h.fetchPublisherZmanim(ctx, publisherID, &transliterationStyle)
	if err != nil {
		slog.Error("failed to fetch zmanim metadata", "error", err, "publisher_id", publisherID)
		RespondInternalError(w, r, "Failed to fetch zmanim metadata")
		return
	}

	// Build metadata lookup map
	metadataMap := make(map[string]PublisherZman)
	for _, z := range zmanimMetadata {
		metadataMap[z.ZmanKey] = z
	}

	// Convert calculation results to PublisherZmanWithTime with full metadata
	zmanimWithTime := make([]PublisherZmanWithTime, 0, len(calcResult.Zmanim))
	for _, calcZman := range calcResult.Zmanim {
		metadata, ok := metadataMap[calcZman.Key]
		if !ok {
			// Shouldn't happen, but handle gracefully
			slog.Warn("calculated zman has no metadata", "zman_key", calcZman.Key)
			continue
		}

		timestamp := calcZman.Timestamp
		zmanimWithTime = append(zmanimWithTime, PublisherZmanWithTime{
			PublisherZman: metadata,
			Time:          &calcZman.TimeExact,
			TimeRounded:   &calcZman.TimeRounded,
			Timestamp:     &timestamp,
			IsActiveToday: calcZman.IsActiveToday,
		})
	}

	// Sort zmanim using the unified service
	if h.zmanimService != nil {
		sortable := make([]services.SortableZman, len(zmanimWithTime))
		for i := range zmanimWithTime {
			sortable[i] = &zmanimWithTime[i]
		}
		h.zmanimService.SortZmanim(sortable, false)
		// Convert back to original slice (sorted order)
		sorted := make([]PublisherZmanWithTime, len(sortable))
		for i, s := range sortable {
			sorted[i] = *s.(*PublisherZmanWithTime)
		}
		zmanimWithTime = sorted
	}

	response := FilteredZmanimResponse{
		DayContext: dayCtx,
		Zmanim:     zmanimWithTime,
	}

	slog.Info("fetched zmanim with locality_id", "count", len(zmanimWithTime), "publisher_id", publisherID, "locality_id", localityID, "date", dateStr, "cached", calcResult.FromCache)
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
// GET /api/v1/publisher/zmanim/week?start_date=YYYY-MM-DD&locality_id=X
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
	localityIDStr := r.URL.Query().Get("locality_id")

	// Validate required params
	if startDateStr == "" {
		RespondBadRequest(w, r, "start_date is required (YYYY-MM-DD)")
		return
	}

	if localityIDStr == "" {
		RespondBadRequest(w, r, "locality_id is required")
		return
	}

	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid start_date format. Use YYYY-MM-DD")
		return
	}

	localityID, err := strconv.ParseInt(localityIDStr, 10, 64)
	if err != nil {
		RespondBadRequest(w, r, "Invalid locality_id")
		return
	}

	// Use unified calculation service (timezone derived from locality)
	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Get publisher's transliteration style preference for tag display names
	transliterationStyle, err := h.db.Queries.GetPublisherTransliterationStyle(ctx, publisherIDInt)
	if err != nil {
		slog.Warn("failed to get publisher transliteration style, using default", "error", err, "publisher_id", publisherID)
		transliterationStyle = "ashkenazi" // Default to Ashkenazi
	}

	// Fetch all publisher zmanim to get names, flags, etc.
	zmanimMeta, err := h.fetchPublisherZmanim(ctx, publisherID, &transliterationStyle)
	if err != nil {
		slog.Error("failed to fetch publisher zmanim", "error", err, "publisher_id", publisherID)
		RespondInternalError(w, r, "Failed to fetch zmanim metadata")
		return
	}

	// Build lookup map by zman_key
	zmanByKey := make(map[string]PublisherZman, len(zmanimMeta))
	for _, z := range zmanimMeta {
		zmanByKey[z.ZmanKey] = z
	}

	// Get locality for calendar context (needed BEFORE calculation for ActiveEventCodes)
	localityID32 := int32(localityID)
	locality, err := h.db.Queries.GetLocalityDetailsForZmanim(ctx, localityID32)
	if err != nil {
		slog.Error("failed to get locality", "error", err, "locality_id", localityID)
		RespondInternalError(w, r, "Failed to get locality")
		return
	}

	// Build calendar service with database adapter for event mapping
	dbAdapter := NewCalendarDBAdapter(h.db.Queries)
	calService := calendar.NewCalendarServiceWithDB(dbAdapter)

	// Dereference coordinates (handle nil case)
	var lat, lng float64
	if locality.Latitude != nil {
		lat = *locality.Latitude
	}
	if locality.Longitude != nil {
		lng = *locality.Longitude
	}

	loc := calendar.Location{
		Latitude:  lat,
		Longitude: lng,
		Timezone:  locality.Timezone,
		IsIsrael:  calendar.IsLocationInIsrael(lat, lng),
	}

	// Create ActiveEventCodes provider for each day's calendar context
	// This ensures CalculateRange uses central ShouldShowZman logic with proper event codes
	activeEventCodesProvider := func(date time.Time) []string {
		zmanimCtx := calService.GetZmanimContext(date, loc, transliterationStyle)
		return zmanimCtx.ActiveEventCodes
	}

	results, err := h.zmanimService.CalculateRange(ctx, services.RangeParams{
		LocalityID:               localityID,
		PublisherID:              publisherIDInt,
		StartDate:                startDate,
		EndDate:                  startDate.AddDate(0, 0, 6),
		IncludeDisabled:          false,
		IncludeUnpublished:       false,
		IncludeBeta:              false,
		ActiveEventCodesProvider: activeEventCodesProvider,
	})
	if err != nil {
		slog.Error("failed to calculate week zmanim", "error", err, "publisher_id", publisherID, "locality_id", localityID)
		RespondInternalError(w, r, "Failed to calculate zmanim")
		return
	}

	// Build response with day contexts
	days := make([]WeekDayZmanim, 0, len(results))
	for _, dayResult := range results {
		date, _ := time.Parse("2006-01-02", dayResult.Date)

		// Build day context
		zmanimCtx := calService.GetZmanimContext(date, loc, transliterationStyle)
		hebrewDate := calService.GetHebrewDate(date)
		holidays := calService.GetHolidaysWithStyle(date, transliterationStyle)
		holidayInfos := make([]HolidayInfo, 0, len(holidays))
		for _, h := range holidays {
			holidayInfos = append(holidayInfos, HolidayInfo{
				Name:       h.Name,
				NameHebrew: h.NameHebrew,
				Category:   h.Category,
				IsYomTov:   h.Yomtov,
			})
		}

		dayCtx := DayContext{
			Date:                dayResult.Date,
			DayOfWeek:           int(date.Weekday()),
			DayName:             dayNames[date.Weekday()],
			HebrewDate:          hebrewDate.Formatted,
			HebrewDateFormatted: hebrewDate.Hebrew,
			Holidays:            holidayInfos,
			ActiveEventCodes:    zmanimCtx.ActiveEventCodes,
			SpecialContexts:     zmanimCtx.DisplayContexts,
		}

		// Convert service result to handler format, merging with zman metadata
		zmanimWithTime := make([]PublisherZmanWithTime, 0, len(dayResult.Zmanim))
		for _, z := range dayResult.Zmanim {
			timestamp := z.Timestamp
			// Look up full zman metadata by key
			meta, hasMeta := zmanByKey[z.Key]
			pz := PublisherZman{
				ID:      strconv.FormatInt(z.ID, 10),
				ZmanKey: z.Key,
			}
			if hasMeta {
				pz = meta
				pz.ID = strconv.FormatInt(z.ID, 10) // Keep the ID from calculation result
			}
			zmanimWithTime = append(zmanimWithTime, PublisherZmanWithTime{
				PublisherZman: pz,
				Time:          &z.TimeExact,
				TimeRounded:   &z.TimeRounded,
				Timestamp:     &timestamp,
				IsActiveToday: z.IsActiveToday,
			})
		}

		// Sort zmanim by category order (Jewish day structure: dawn → midnight)
		if h.zmanimService != nil {
			if len(zmanimWithTime) > 0 {
				sortable := make([]services.SortableZman, len(zmanimWithTime))
				for i := range zmanimWithTime {
					sortable[i] = &zmanimWithTime[i]
				}
				h.zmanimService.SortZmanim(sortable, false)
				sorted := make([]PublisherZmanWithTime, len(sortable))
				for i, s := range sortable {
					sorted[i] = *s.(*PublisherZmanWithTime)
				}
				zmanimWithTime = sorted
			}
		}

		days = append(days, WeekDayZmanim{
			DayContext: dayCtx,
			Zmanim:     zmanimWithTime,
		})
	}

	response := WeekZmanimResponse{Days: days}

	slog.Info("fetched week zmanim", "publisher_id", publisherID, "start_date", startDateStr, "locality_id", localityID)
	RespondJSON(w, r, http.StatusOK, response)
}

// YearExportResponse is the response for the year export endpoint
type YearExportResponse struct {
	Publisher    string             `json:"publisher"`
	HebrewYear   int                `json:"hebrew_year"`
	Location     YearExportLocation `json:"location"`
	GeneratedAt  string             `json:"generated_at"`
	ZmanimOrder  []string           `json:"zmanim_order"`  // Ordered list of zman_keys
	ZmanimLabels map[string]string  `json:"zmanim_labels"` // zman_key -> display name
	Days         []YearExportDayRow `json:"days"`
}

// YearExportLocation contains the location info for export
type YearExportLocation struct {
	Name      string  `json:"name"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Timezone  string  `json:"timezone"`
}

// YearExportDayRow represents a single day's data in the export
type YearExportDayRow struct {
	Date       string            `json:"date"`        // YYYY-MM-DD
	DayOfWeek  string            `json:"day_of_week"` // Sun, Mon, etc.
	HebrewDate string            `json:"hebrew_date"` // Hebrew date string
	Times      map[string]string `json:"times"`       // zman_key -> HH:MM:SS
}

// GetPublisherZmanimYear returns all zmanim for a publisher for an entire Hebrew year
// GET /api/v1/publisher/zmanim/year?hebrew_year=5786&locality_id=542028
//
//	@Summary		Get zmanim for a full Hebrew year
//	@Description	Returns all zmanim calculations for a full Hebrew year for export/comparison
//	@Tags			Publisher Zmanim
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string									true	"Publisher ID"
//	@Param			hebrew_year		query		int										true	"Hebrew year (e.g., 5786)"
//	@Param			locality_id		query		int										true	"Locality ID for coordinate resolution"
//	@Success		200				{object}	APIResponse{data=YearExportResponse}	"Year zmanim data"
//	@Failure		400				{object}	APIResponse{error=APIError}				"Invalid parameters"
//	@Failure		401				{object}	APIResponse{error=APIError}				"Unauthorized"
//	@Failure		404				{object}	APIResponse{error=APIError}				"Locality not found"
//	@Router			/publisher/zmanim/year [get]
func (h *Handlers) GetPublisherZmanimYear(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}
	publisherID := pc.PublisherID

	// Parse query params
	hebrewYearStr := r.URL.Query().Get("hebrew_year")
	localityIDStr := r.URL.Query().Get("locality_id")

	// Validate required params
	if hebrewYearStr == "" {
		RespondBadRequest(w, r, "hebrew_year is required")
		return
	}
	hebrewYear, err := strconv.Atoi(hebrewYearStr)
	if err != nil || hebrewYear < 5700 || hebrewYear > 6000 {
		RespondBadRequest(w, r, "Invalid hebrew_year. Must be between 5700 and 6000")
		return
	}

	if localityIDStr == "" {
		RespondBadRequest(w, r, "locality_id is required")
		return
	}
	localityID, err := strconv.ParseInt(localityIDStr, 10, 64)
	if err != nil {
		RespondBadRequest(w, r, "Invalid locality_id")
		return
	}

	// Convert publisher ID to int32
	publisherIDInt32, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Get effective locality location (same pattern as ZmanimService.CalculateZmanim)
	// Priority: publisher override > admin override > default (overture/glo90)
	location, err := h.db.Queries.GetEffectiveLocalityLocation(ctx, sqlcgen.GetEffectiveLocalityLocationParams{
		LocalityID:  int32(localityID),
		PublisherID: pgtype.Int4{Int32: publisherIDInt32, Valid: true},
	})
	if err != nil {
		slog.Error("failed to get locality location", "error", err, "locality_id", localityID)
		RespondNotFound(w, r, "Locality not found")
		return
	}

	// Get locality name and hierarchy for display
	localityInfo, err := h.db.Queries.GetLocalityForReport(ctx, int32(localityID))
	if err != nil {
		slog.Warn("failed to get locality info, using fallback", "error", err, "locality_id", localityID)
		localityInfo.Name = fmt.Sprintf("Locality %d", localityID)
	}

	// Extract coordinates (resolved with publisher overrides)
	latitude := location.Latitude
	longitude := location.Longitude
	elevation := float64(location.ElevationM)
	locationName := localityInfo.Name
	if localityInfo.DisplayHierarchy != nil && *localityInfo.DisplayHierarchy != "" {
		locationName = *localityInfo.DisplayHierarchy
	}

	// Load timezone from locality
	tz, err := time.LoadLocation(location.Timezone)
	if err != nil {
		slog.Warn("invalid timezone, using UTC", "timezone", location.Timezone, "error", err)
		tz = time.UTC
	}

	// Get Hebrew year date range
	calService := calendar.NewCalendarService()
	startDate, endDate := calService.GetHebrewYearRange(hebrewYear)

	slog.Info("calculating year zmanim",
		"publisher_id", publisherID,
		"hebrew_year", hebrewYear,
		"start_date", startDate.Format("2006-01-02"),
		"end_date", endDate.Format("2006-01-02"),
		"locality_id", localityID,
		"location_name", locationName,
		"latitude", latitude,
		"longitude", longitude,
		"elevation", elevation,
		"timezone", location.Timezone,
	)

	// Get transliteration style (publisher ID already converted above)
	transliterationStyle, err := h.db.Queries.GetPublisherTransliterationStyle(ctx, publisherIDInt32)
	if err != nil {
		slog.Warn("failed to get publisher transliteration style, using default", "error", err, "publisher_id", publisherID)
		transliterationStyle = "ashkenazi" // Default to Ashkenazi
	}

	// Fetch all zmanim once
	zmanim, err := h.fetchPublisherZmanim(ctx, publisherID, &transliterationStyle)
	if err != nil {
		slog.Error("failed to fetch zmanim", "error", err, "publisher_id", publisherID)
		RespondInternalError(w, r, "Failed to fetch zmanim")
		return
	}

	// Filter to only enabled, non-event zmanim (everyday zmanim)
	everydayZmanim := make([]PublisherZman, 0)
	for _, z := range zmanim {
		if z.IsEnabled && !z.IsEventZman {
			everydayZmanim = append(everydayZmanim, z)
		}
	}

	// Build zmanim order and labels
	zmanimOrder := make([]string, len(everydayZmanim))
	zmanimLabels := make(map[string]string)
	for i, z := range everydayZmanim {
		zmanimOrder[i] = z.ZmanKey
		zmanimLabels[z.ZmanKey] = z.EnglishName
	}

	// Get publisher name
	publisherName, err := h.db.Queries.GetPublisherNameByID(ctx, publisherIDInt32)
	if err != nil {
		publisherName = "Unknown Publisher"
	}

	// Build formulas map for dependency resolution
	formulas := make(map[string]string)
	for _, z := range everydayZmanim {
		if z.FormulaDSL != "" {
			formulas[z.ZmanKey] = z.FormulaDSL
		}
	}

	// Calculate for each day
	var days []YearExportDayRow
	dayNames := []string{"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"}

	// Prevent unbounded loop - Hebrew leap year max ~385 days
	const maxIterations = 400
	iterations := 0
	for date := startDate; !date.After(endDate); date = date.AddDate(0, 0, 1) {
		iterations++
		if iterations > maxIterations {
			slog.Error("year export exceeded maximum iterations", "start_date", startDate, "end_date", endDate, "iterations", iterations)
			RespondBadRequest(w, r, "Date range too large for export")
			return
		}
		dateLocal := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, tz)
		dateStr := dateLocal.Format("2006-01-02")

		// Get Hebrew date
		hebrewDate := calService.GetHebrewDate(dateLocal)

		// Calculate all formulas using the service (handles references like @alos_12)
		calculatedTimes, calcErr := h.zmanimService.ExecuteFormulasWithCoordinates(
			dateLocal, latitude, longitude, elevation, tz, formulas,
		)
		if calcErr != nil {
			slog.Warn("formula execution had errors for date", "date", dateStr, "error", calcErr)
		}

		// Build times map from calculated results
		times := make(map[string]string)
		for zmanKey, timeResult := range calculatedTimes {
			if !timeResult.IsZero() {
				times[zmanKey] = timeResult.Format("15:04:05")
			}
		}

		days = append(days, YearExportDayRow{
			Date:       dateStr,
			DayOfWeek:  dayNames[dateLocal.Weekday()],
			HebrewDate: hebrewDate.Formatted,
			Times:      times,
		})
	}

	response := YearExportResponse{
		Publisher:  publisherName,
		HebrewYear: hebrewYear,
		Location: YearExportLocation{
			Name:      locationName,
			Latitude:  latitude,
			Longitude: longitude,
			Timezone:  location.Timezone,
		},
		GeneratedAt:  time.Now().UTC().Format(time.RFC3339),
		ZmanimOrder:  zmanimOrder,
		ZmanimLabels: zmanimLabels,
		Days:         days,
	}

	slog.Info("generated year zmanim export",
		"publisher_id", publisherID,
		"hebrew_year", hebrewYear,
		"days_count", len(days),
		"zmanim_count", len(everydayZmanim),
	)

	RespondJSON(w, r, http.StatusOK, response)
}

// fetchPublisherZmanim retrieves all zmanim for a publisher from the database
// transliterationStyle: "ashkenazi" (default) or "sephardi" - controls tag display names
func (h *Handlers) fetchPublisherZmanim(ctx context.Context, publisherID string, transliterationStyle *string) ([]PublisherZman, error) {
	// Convert publisherID to int32
	publisherIDInt32, err := stringToInt32(publisherID)
	if err != nil {
		return nil, fmt.Errorf("invalid publisher ID: %w", err)
	}

	// Use SQLc generated query (exclude deleted by default)
	sqlcResults, err := h.db.Queries.FetchPublisherZmanim(ctx, sqlcgen.FetchPublisherZmanimParams{
		PublisherID:    publisherIDInt32,
		IncludeDeleted: nil, // nil = false, exclude deleted items
	})
	if err != nil {
		return nil, err
	}

	slog.Info("FetchPublisherZmanim SQL results", "count", len(sqlcResults))

	// Determine effective transliteration style
	effectiveStyle := "ashkenazi" // Default
	if transliterationStyle != nil && *transliterationStyle == "sephardi" {
		effectiveStyle = "sephardi"
	}

	// Convert SQLc results to PublisherZman slice
	zmanim := make([]PublisherZman, 0, len(sqlcResults))
	for i, row := range sqlcResults {
		slog.Info("fetchPublisherZmanim: processing row",
			"index", i,
			"zman_key", row.ZmanKey,
			"master_zman_id", row.MasterZmanID,
			"tags_field_nil", row.Tags == nil)

		var tags []ZmanTag
		if row.Tags != nil {
			// Intermediate struct to parse raw JSON with both transliteration fields
			type rawTag struct {
				ID                          int32   `json:"id"`
				TagKey                      string  `json:"tag_key"`
				DisplayNameHebrew           string  `json:"display_name_hebrew"`
				DisplayNameEnglishAshkenazi string  `json:"display_name_english_ashkenazi"`
				DisplayNameEnglishSephardi  *string `json:"display_name_english_sephardi"`
				TagType                     string  `json:"tag_type"`
				IsNegated                   bool    `json:"is_negated"`
				IsModified                  bool    `json:"is_modified"`
				SourceIsNegated             *bool   `json:"source_is_negated"`
			}

			var rawTags []rawTag
			if tagsBytes, err := json.Marshal(row.Tags); err == nil {
				slog.Info("fetchPublisherZmanim: parsing tags", "zman_key", row.ZmanKey, "raw_json", string(tagsBytes))
				if err := json.Unmarshal(tagsBytes, &rawTags); err != nil {
					slog.Error("fetchPublisherZmanim: failed to unmarshal tags", "error", err, "json", string(tagsBytes))
				} else {
					slog.Info("fetchPublisherZmanim: successfully parsed raw tags", "zman_key", row.ZmanKey, "count", len(rawTags))

					// Convert raw tags to ZmanTag, selecting correct display name
					for _, rt := range rawTags {
						displayName := rt.DisplayNameEnglishAshkenazi // Default
						if effectiveStyle == "sephardi" && rt.DisplayNameEnglishSephardi != nil && *rt.DisplayNameEnglishSephardi != "" {
							displayName = *rt.DisplayNameEnglishSephardi
						}

						tags = append(tags, ZmanTag{
							ID:                          rt.ID,
							TagKey:                      rt.TagKey,
							Name:                        rt.TagKey, // Keep tag_key as name for backward compatibility
							DisplayNameHebrew:           rt.DisplayNameHebrew,
							DisplayNameEnglish:          displayName, // Selected based on transliteration style
							DisplayNameEnglishAshkenazi: rt.DisplayNameEnglishAshkenazi,
							DisplayNameEnglishSephardi:  rt.DisplayNameEnglishSephardi,
							TagType:                     rt.TagType,
							Description:                 nil,
							Color:                       nil,
							IsNegated:                   rt.IsNegated,
							IsModified:                  rt.IsModified,
							SourceIsNegated:             rt.SourceIsNegated,
							CreatedAt:                   time.Time{},
						})
					}
				}
			}
		} else {
			slog.Info("fetchPublisherZmanim: no tags in SQL row", "zman_key", row.ZmanKey)
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

		// Handle deleted_at pointer
		var deletedAt *time.Time
		if row.DeletedAt.Valid {
			deletedAt = &row.DeletedAt.Time
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
			DisplayStatus:             string(row.DisplayStatus),
			TimeCategory:              row.TimeCategory,
			Dependencies:              row.Dependencies,
			RoundingMode:              row.RoundingMode,
			CreatedAt:                 row.CreatedAt.Time,
			UpdatedAt:                 row.UpdatedAt.Time,
			DeletedAt:                 deletedAt,
			Tags:                      tags,
			MasterZmanID:              masterZmanID,
			LinkedPublisherZmanID:     linkedPublisherZmanID,
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
func getEventAndJewishDayTags(tags []ZmanTag) []ZmanTag {
	var result []ZmanTag
	for _, t := range tags {
		if t.TagType == "event" || t.TagType == "jewish_day" {
			result = append(result, t)
		}
	}
	return result
}

// Deprecated: sliceContainsString - logic moved to ZmanimService
// Kept for backward compatibility but should not be used in new code
func sliceContainsString(slice []string, s string) bool {
	for _, item := range slice {
		if item == s {
			return true
		}
	}
	return false
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
			slog.Info("parsing tags from SQL row", "zman_key", z.ZmanKey, "raw_json", string(tagsBytes))
			if err := json.Unmarshal(tagsBytes, &tags); err != nil {
				slog.Error("failed to unmarshal tags", "error", err, "json", string(tagsBytes))
			} else {
				slog.Info("successfully parsed tags", "zman_key", z.ZmanKey, "count", len(tags), "tags", tags)
			}
		}
	} else {
		slog.Info("no tags in SQL row", "zman_key", z.ZmanKey)
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
		DisplayStatus:             string(z.DisplayStatus),
		TimeCategory:              z.TimeCategory,
		Dependencies:              z.Dependencies,
		RoundingMode:              z.RoundingMode,
		CreatedAt:                 z.CreatedAt.Time,
		UpdatedAt:                 z.UpdatedAt.Time,
		Tags:                      tags,
		MasterZmanID:              masterZmanID,
		LinkedPublisherZmanID:     linkedPublisherZmanID,
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
		DisplayStatus:             string(z.DisplayStatus),
		TimeCategory:              z.TimeCategory,
		Dependencies:              z.Dependencies,
		RoundingMode:              z.RoundingMode,
		CreatedAt:                 z.CreatedAt.Time,
		UpdatedAt:                 z.UpdatedAt.Time,
		MasterZmanID:              masterZmanID,
		LinkedPublisherZmanID:     linkedPublisherZmanID,
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
		RoundingMode:     "math", // Default rounding mode
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
		DisplayStatus:    string(z.DisplayStatus),
		RoundingMode:     z.RoundingMode,
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
//
//	@Summary		Get single zman
//	@Description	Returns a single zman formula by its unique key
//	@Tags			Publisher Zmanim
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string							true	"Publisher ID"
//	@Param			zmanKey			path		string							true	"Zman key"
//	@Success		200				{object}	APIResponse{data=PublisherZman}	"Zman details"
//	@Failure		401				{object}	APIResponse{error=APIError}		"Unauthorized"
//	@Failure		404				{object}	APIResponse{error=APIError}		"Zman not found"
//	@Router			/publisher/zmanim/{zmanKey} [get]
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
//
//	@Summary		Create custom zman
//	@Description	Creates a new custom zman formula for the publisher
//	@Tags			Publisher Zmanim
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string							true	"Publisher ID"
//	@Param			request			body		CreateZmanRequest				true	"Zman data"
//	@Success		201				{object}	APIResponse{data=PublisherZman}	"Created zman"
//	@Failure		400				{object}	APIResponse{error=APIError}		"Invalid request or duplicate key"
//	@Failure		401				{object}	APIResponse{error=APIError}		"Unauthorized"
//	@Failure		500				{object}	APIResponse{error=APIError}		"Internal server error"
//	@Router			/publisher/zmanim [post]
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
		ID:                    0, // Let database generate SERIAL ID
		PublisherID:           publisherID,
		ZmanKey:               req.ZmanKey,
		HebrewName:            req.HebrewName,
		EnglishName:           req.EnglishName,
		FormulaDsl:            req.FormulaDSL,
		AiExplanation:         req.AIExplanation,
		PublisherComment:      req.PublisherComment,
		IsEnabled:             isEnabled,
		IsVisible:             isVisible,
		IsPublished:           false, // New zmanim start unpublished
		IsCustom:              true,  // Custom zmanim are always user-created
		TimeCategoryID:        nil,   // No category for custom zmanim
		Dependencies:          dependencies,
		MasterZmanID:          nil,
		LinkedPublisherZmanID: nil,
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

	// Log zman creation
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:   services.ActionZmanCreate,
		ResourceType: "publisher_zman",
		ResourceID:   int32ToString(sqlcZman.ID),
		ResourceName: req.ZmanKey,
		ChangesAfter: req,
		Status:       AuditStatusSuccess,
		AdditionalMetadata: map[string]interface{}{
			"zman_key":     req.ZmanKey,
			"hebrew_name":  req.HebrewName,
			"english_name": req.EnglishName,
			"is_custom":    true,
		},
	})

	RespondJSON(w, r, http.StatusCreated, z)
}

// UpdatePublisherZman updates an existing zman
//
//	@Summary		Update zman
//	@Description	Updates an existing zman formula's properties
//	@Tags			Publisher Zmanim
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string							true	"Publisher ID"
//	@Param			zmanKey			path		string							true	"Zman key"
//	@Param			request			body		UpdateZmanRequest				true	"Fields to update"
//	@Success		200				{object}	APIResponse{data=PublisherZman}	"Updated zman"
//	@Failure		400				{object}	APIResponse{error=APIError}		"Invalid request"
//	@Failure		401				{object}	APIResponse{error=APIError}		"Unauthorized"
//	@Failure		404				{object}	APIResponse{error=APIError}		"Zman not found"
//	@Failure		500				{object}	APIResponse{error=APIError}		"Internal server error"
//	@Router			/publisher/zmanim/{zmanKey} [put]
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
		"zman_key", zmanKey, "display_status", req.DisplayStatus, "is_enabled", req.IsEnabled, "is_published", req.IsPublished, "is_beta", req.IsBeta, "rounding_mode", req.RoundingMode)

	// At least one field must be provided
	if req.HebrewName == nil && req.EnglishName == nil && req.Transliteration == nil &&
		req.Description == nil && req.FormulaDSL == nil &&
		req.AIExplanation == nil && req.PublisherComment == nil &&
		req.IsEnabled == nil && req.IsVisible == nil && req.IsPublished == nil &&
		req.IsBeta == nil && req.DisplayStatus == nil && req.RoundingMode == nil {
		slog.Error("UpdatePublisherZman: no fields to update")
		RespondBadRequest(w, r, "No fields to update")
		return
	}

	// Extract dependencies if formula is updated
	var dependencies []string
	if req.FormulaDSL != nil {
		dependencies = extractDependencies(*req.FormulaDSL)
	}

	// Log the actual value being passed
	if req.RoundingMode != nil {
		slog.Info("UpdatePublisherZman: rounding_mode value", "value", *req.RoundingMode)
	} else {
		slog.Info("UpdatePublisherZman: rounding_mode is nil")
	}

	// Convert display_status to NullDisplayStatus
	var displayStatus sqlcgen.NullDisplayStatus
	if req.DisplayStatus != nil {
		displayStatus = sqlcgen.NullDisplayStatus{
			DisplayStatus: sqlcgen.DisplayStatus(*req.DisplayStatus),
			Valid:         true,
		}
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
		DisplayStatus:    displayStatus,
		RoundingMode:     req.RoundingMode,
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

	// Invalidate all cached data for this publisher on any field change
	if h.cache != nil {
		if err := h.cache.InvalidatePublisherCache(ctx, publisherIDStr); err != nil {
			slog.Warn("failed to invalidate cache", "error", err, "publisher_id", publisherIDStr)
		} else {
			slog.Info("invalidated cache", "publisher_id", publisherIDStr, "reason", "zman_updated")
		}
	}

	z := updatePublisherZmanRowToPublisherZman(sqlcZman)

	// Log zman update
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:   services.ActionZmanUpdate,
		ResourceType: "publisher_zman",
		ResourceID:   int32ToString(sqlcZman.ID),
		ResourceName: zmanKey,
		ChangesAfter: req,
		Status:       AuditStatusSuccess,
		AdditionalMetadata: map[string]interface{}{
			"zman_key": zmanKey,
		},
	})

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

	// Log zman deletion
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:   services.ActionZmanDelete,
		ResourceType: "publisher_zman",
		ResourceID:   zmanKey,
		ResourceName: zmanKey,
		Status:       AuditStatusSuccess,
		AdditionalMetadata: map[string]interface{}{
			"zman_key": zmanKey,
		},
	})

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Zman deleted successfully",
	})
}

// ImportZmanimRequest represents the request body for bulk importing zmanim
type ImportZmanimRequest struct {
	Source      string   `json:"source"`       // "defaults" or "publisher"
	PublisherID *string  `json:"publisher_id"` // Required when source is "publisher"
	ZmanKeys    []string `json:"zman_keys"`    // Optional: specific keys to import
}

// ImportZmanimResponse represents the response for bulk import
type ImportZmanimResponse struct {
	Data    []PublisherZman `json:"data"`
	Count   int             `json:"count"`
	Message string          `json:"message"`
}

// ImportZmanim bulk imports zmanim from defaults or another publisher
// POST /api/v1/publisher/zmanim/import
func (h *Handlers) ImportZmanim(w http.ResponseWriter, r *http.Request) {
	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	ctx := r.Context()
	publisherIDStr := pc.PublisherID

	// Convert publisher ID to int32 for SQLc queries
	publisherID, err := stringToInt32(publisherIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// 2. Parse request body
	var req ImportZmanimRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// 3. Validate request
	if req.Source != "defaults" && req.Source != "publisher" {
		RespondBadRequest(w, r, "Invalid source: must be 'defaults' or 'publisher'")
		return
	}

	var importedZmanim []PublisherZman

	// 4. Import based on source
	if req.Source == "defaults" {
		// Import everyday zmanim from master registry
		rows, err := h.db.Queries.ImportEverydayZmanimFromRegistry(ctx, publisherID)
		if err != nil {
			slog.Error("failed to import everyday zmanim", "error", err, "publisher_id", publisherID)
			RespondInternalError(w, r, "Failed to import zmanim")
			return
		}

		// Convert rows to PublisherZman response
		for _, row := range rows {
			importedZmanim = append(importedZmanim, importRowToPublisherZman(row))
		}
	} else if req.Source == "publisher" {
		// Import from another publisher - requires zman_keys
		if req.PublisherID == nil || *req.PublisherID == "" {
			RespondBadRequest(w, r, "publisher_id is required when source is 'publisher'")
			return
		}
		if len(req.ZmanKeys) == 0 {
			RespondBadRequest(w, r, "zman_keys is required when source is 'publisher'")
			return
		}

		// For now, import from master registry by keys
		// This supports the case where user browses public zmanim and imports specific ones
		rows, err := h.db.Queries.ImportZmanimFromRegistryByKeys(ctx, sqlcgen.ImportZmanimFromRegistryByKeysParams{
			PublisherID: publisherID,
			Column2:     req.ZmanKeys,
		})
		if err != nil {
			slog.Error("failed to import zmanim by keys", "error", err, "publisher_id", publisherID, "keys", req.ZmanKeys)
			RespondInternalError(w, r, "Failed to import zmanim")
			return
		}

		// Convert rows to PublisherZman response
		for _, row := range rows {
			importedZmanim = append(importedZmanim, importByKeysRowToPublisherZman(row))
		}
	}

	// 5. Invalidate cache
	if h.cache != nil {
		if len(importedZmanim) > 0 {
			if err := h.cache.InvalidatePublisherCache(ctx, publisherIDStr); err != nil {
				slog.Warn("failed to invalidate cache after import", "error", err, "publisher_id", publisherID)
			}
		}
	}

	// 5b. Log import operation
	importedKeys := make([]string, len(importedZmanim))
	for i, z := range importedZmanim {
		importedKeys[i] = z.ZmanKey
	}
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:   services.ActionZmanCreate,
		ResourceType: "publisher_zman",
		ResourceID:   publisherIDStr,
		Status:       AuditStatusSuccess,
		AdditionalMetadata: map[string]interface{}{
			"source":        req.Source,
			"source_id":     req.PublisherID,
			"imported_keys": importedKeys,
			"count":         len(importedZmanim),
			"operation":     "bulk_import",
		},
	})

	// 6. Respond with imported zmanim
	response := ImportZmanimResponse{
		Data:    importedZmanim,
		Count:   len(importedZmanim),
		Message: fmt.Sprintf("Successfully imported %d zmanim", len(importedZmanim)),
	}
	RespondJSON(w, r, http.StatusOK, response)
}

// importRowToPublisherZman converts an ImportEverydayZmanimFromRegistryRow to PublisherZman
func importRowToPublisherZman(row sqlcgen.ImportEverydayZmanimFromRegistryRow) PublisherZman {
	var createdAt, updatedAt time.Time
	if row.CreatedAt.Valid {
		createdAt = row.CreatedAt.Time
	}
	if row.UpdatedAt.Valid {
		updatedAt = row.UpdatedAt.Time
	}

	var masterZmanID *string
	if row.MasterZmanID != nil {
		s := int32ToString(*row.MasterZmanID)
		masterZmanID = &s
	}

	return PublisherZman{
		ID:               int32ToString(row.ID),
		PublisherID:      int32ToString(row.PublisherID),
		ZmanKey:          row.ZmanKey,
		HebrewName:       row.HebrewName,
		EnglishName:      row.EnglishName,
		Transliteration:  row.Transliteration,
		Description:      row.Description,
		FormulaDSL:       row.FormulaDsl,
		AIExplanation:    row.AiExplanation,
		PublisherComment: row.PublisherComment,
		IsEnabled:        row.IsEnabled,
		IsVisible:        row.IsVisible,
		IsPublished:      row.IsPublished,
		IsCustom:         row.IsCustom,
		Dependencies:     row.Dependencies,
		CreatedAt:        createdAt,
		UpdatedAt:        updatedAt,
		MasterZmanID:     masterZmanID,
		DisplayStatus:    "optional", // Default to optional for newly imported
		RoundingMode:     "floor",    // Default rounding mode
	}
}

// importByKeysRowToPublisherZman converts an ImportZmanimFromRegistryByKeysRow to PublisherZman
func importByKeysRowToPublisherZman(row sqlcgen.ImportZmanimFromRegistryByKeysRow) PublisherZman {
	var createdAt, updatedAt time.Time
	if row.CreatedAt.Valid {
		createdAt = row.CreatedAt.Time
	}
	if row.UpdatedAt.Valid {
		updatedAt = row.UpdatedAt.Time
	}

	var masterZmanID *string
	if row.MasterZmanID != nil {
		s := int32ToString(*row.MasterZmanID)
		masterZmanID = &s
	}

	return PublisherZman{
		ID:               int32ToString(row.ID),
		PublisherID:      int32ToString(row.PublisherID),
		ZmanKey:          row.ZmanKey,
		HebrewName:       row.HebrewName,
		EnglishName:      row.EnglishName,
		Transliteration:  row.Transliteration,
		Description:      row.Description,
		FormulaDSL:       row.FormulaDsl,
		AIExplanation:    row.AiExplanation,
		PublisherComment: row.PublisherComment,
		IsEnabled:        row.IsEnabled,
		IsVisible:        row.IsVisible,
		IsPublished:      row.IsPublished,
		IsCustom:         row.IsCustom,
		Dependencies:     row.Dependencies,
		CreatedAt:        createdAt,
		UpdatedAt:        updatedAt,
		MasterZmanID:     masterZmanID,
		DisplayStatus:    "optional", // Default to optional for newly imported
		RoundingMode:     "floor",    // Default rounding mode
	}
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
	ID            string `json:"id"`
	PublisherID   string `json:"publisher_id"`
	PublisherName string `json:"publisher_name"`
	ZmanKey       string `json:"zman_key"`
	HebrewName    string `json:"hebrew_name"`
	EnglishName   string `json:"english_name"`
	FormulaDSL    string `json:"formula_dsl"`
	Category      string `json:"category"`
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

		zmanim = append(zmanim, PublisherZmanForLinking{
			ID:            int32ToString(row.ID),
			PublisherID:   int32ToString(row.PublisherID),
			PublisherName: row.PublisherName,
			ZmanKey:       row.ZmanKey,
			HebrewName:    row.HebrewName,
			EnglishName:   row.EnglishName,
			FormulaDSL:    row.FormulaDsl,
			Category:      category,
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

	// Log zman copy/link operation
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:   services.ActionZmanCreate,
		ResourceType: "publisher_zman",
		ResourceID:   int32ToString(result.ID),
		ResourceName: sourceZman.ZmanKey,
		Status:       AuditStatusSuccess,
		AdditionalMetadata: map[string]interface{}{
			"mode":                     req.Mode,
			"source_publisher_zman_id": req.SourcePublisherZmanID,
			"source_publisher_id":      sourceZman.PublisherID,
			"zman_key":                 sourceZman.ZmanKey,
			"operation":                req.Mode, // "copy" or "link"
		},
	})

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
		Dependencies:          sourceZman.Dependencies,
		CreatedAt:             result.CreatedAt.Time,
		UpdatedAt:             result.UpdatedAt.Time,
		MasterZmanID:          masterZmanIDStr,
		LinkedPublisherZmanID: linkedIDStr,
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
		slog.Error("failed to decode request body", "error", err)
		RespondBadRequest(w, r, "Invalid request body")
		return
	}
	slog.Info("received tag update request", "tags", req.Tags, "count", len(req.Tags))

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
		// TagID is now int32, no conversion needed
		err = h.db.Queries.InsertPublisherZmanTag(ctx, sqlcgen.InsertPublisherZmanTagParams{
			PublisherZmanID: zmanID,
			TagID:           tag.TagID,
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

	if h.cache != nil {
		if err := h.cache.InvalidatePublisherCache(ctx, publisherID); err != nil {
			slog.Warn("failed to invalidate cache after tag update",
				"error", err,
				"publisher_id", publisherID,
			)
		}
	}

	// Log tag update
	tagIDs := make([]int32, len(req.Tags))
	for i, tag := range req.Tags {
		tagIDs[i] = tag.TagID
	}
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:   services.ActionZmanUpdate,
		ResourceType: "publisher_zman_tags",
		ResourceID:   int32ToString(zmanID),
		ResourceName: zmanKey,
		Status:       AuditStatusSuccess,
		AdditionalMetadata: map[string]interface{}{
			"zman_key":  zmanKey,
			"tag_ids":   tagIDs,
			"tag_count": len(req.Tags),
			"operation": "tags_bulk_update",
		},
	})

	RespondJSON(w, r, http.StatusOK, tags)
}

// RevertPublisherZmanTags reverts all tags to master registry state
// POST /api/v1/publisher/zmanim/{zmanKey}/tags/revert
func (h *Handlers) RevertPublisherZmanTags(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID

	// 2. Extract URL params
	zmanKey := chi.URLParam(r, "zmanKey")

	// 3. Parse body - none needed for this endpoint

	// 4. Validate - get publisher_zman_id
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

	// 5. SQLc query - delete all publisher-specific tags (revert to master)
	err = h.db.Queries.RevertPublisherZmanTags(ctx, zmanID)
	if err != nil {
		slog.Error("failed to revert tags", "error", err, "zman_id", zmanID)
		RespondInternalError(w, r, "Failed to revert tags")
		return
	}

	// Fetch updated tags (now showing master tags only)
	tags, err := h.db.Queries.GetZmanTags(ctx, zmanID)
	if err != nil {
		slog.Error("failed to get reverted tags", "error", err)
		RespondInternalError(w, r, "Tags reverted but failed to fetch")
		return
	}

	if h.cache != nil {
		if err := h.cache.InvalidatePublisherCache(ctx, publisherID); err != nil {
			slog.Warn("failed to invalidate cache after tag revert",
				"error", err,
				"publisher_id", publisherID,
			)
		}
	}

	// Log tag revert
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:   services.ActionZmanUpdate,
		ResourceType: "publisher_zman_tags",
		ResourceID:   int32ToString(zmanID),
		ResourceName: zmanKey,
		Status:       AuditStatusSuccess,
		AdditionalMetadata: map[string]interface{}{
			"zman_key":  zmanKey,
			"operation": "tags_revert_to_registry",
		},
	})

	// 6. Respond
	response := map[string]interface{}{
		"message": "Tags reverted to registry",
		"tags":    tags,
	}
	RespondJSON(w, r, http.StatusOK, response)
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

	if h.cache != nil {
		if err := h.cache.InvalidatePublisherCache(ctx, publisherID); err != nil {
			slog.Warn("failed to invalidate cache after adding tag",
				"error", err,
				"publisher_id", publisherID,
			)
		}
	}

	// Log tag addition
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:   services.ActionZmanUpdate,
		ResourceType: "publisher_zman_tag",
		ResourceID:   int32ToString(zmanID),
		ResourceName: zmanKey,
		ChangesAfter: map[string]interface{}{
			"tag_id":     tagIDInt32,
			"is_negated": req.IsNegated,
		},
		Status: AuditStatusSuccess,
		AdditionalMetadata: map[string]interface{}{
			"zman_key":  zmanKey,
			"operation": "tag_add",
		},
	})

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

	if h.cache != nil {
		if err := h.cache.InvalidatePublisherCache(ctx, publisherID); err != nil {
			slog.Warn("failed to invalidate cache after removing tag",
				"error", err,
				"publisher_id", publisherID,
			)
		}
	}

	// Log tag removal
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:   services.ActionZmanUpdate,
		ResourceType: "publisher_zman_tag",
		ResourceID:   int32ToString(zmanID),
		ResourceName: zmanKey,
		ChangesBefore: map[string]interface{}{
			"tag_id": tagIDInt32,
		},
		Status: AuditStatusSuccess,
		AdditionalMetadata: map[string]interface{}{
			"zman_key":  zmanKey,
			"operation": "tag_remove",
		},
	})

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Tag removed successfully",
	})
}

// mustParseInt32 converts a string to int32, panicking on error
// This is safe to use in handlers because publisher IDs are always valid
func mustParseInt32(s string) int32 {
	val, err := strconv.ParseInt(s, 10, 32)
	if err != nil {
		panic(fmt.Sprintf("failed to parse int32: %v", err))
	}
	return int32(val)
}
