// File: calendar.go
// Purpose: Hebrew/Gregorian calendar conversion and date utilities
// Pattern: utility-handler
// Dependencies: hdate package for Jewish calendar calculations
// Frequency: medium - 674 lines
// Compliance: Check docs/adr/ for pattern rationale

package handlers

import (
	"net/http"
	"time"

	"github.com/jcom-dev/zmanim/internal/calendar"
)

// ============================================
// TYPES FOR CALENDAR RESPONSES
// ============================================

// WeekCalendarResponse represents the weekly calendar API response
type WeekCalendarResponse struct {
	StartDate string             `json:"start_date"`
	EndDate   string             `json:"end_date"`
	Days      []calendar.DayInfo `json:"days"`
}

// GetWeekCalendar returns Hebrew calendar data for a week
// GET /api/calendar/week?date=YYYY-MM-DD
func (h *Handlers) GetWeekCalendar(w http.ResponseWriter, r *http.Request) {
	// Parse date parameter
	dateStr := r.URL.Query().Get("date")
	var startDate time.Time
	var err error

	if dateStr != "" {
		startDate, err = time.Parse("2006-01-02", dateStr)
		if err != nil {
			RespondBadRequest(w, r, "Invalid date format. Use YYYY-MM-DD")
			return
		}
	} else {
		startDate = time.Now()
	}

	// Get week info
	calendarSvc := calendar.NewCalendarService()
	weekInfo := calendarSvc.GetWeekInfo(startDate)

	RespondJSON(w, r, http.StatusOK, WeekCalendarResponse{
		StartDate: weekInfo.StartDate,
		EndDate:   weekInfo.EndDate,
		Days:      weekInfo.Days,
	})
}

// GetHebrewDate returns the Hebrew date for a given Gregorian date
// GET /api/calendar/hebrew-date?date=YYYY-MM-DD
func (h *Handlers) GetHebrewDate(w http.ResponseWriter, r *http.Request) {
	dateStr := r.URL.Query().Get("date")
	var date time.Time
	var err error

	if dateStr != "" {
		date, err = time.Parse("2006-01-02", dateStr)
		if err != nil {
			RespondBadRequest(w, r, "Invalid date format. Use YYYY-MM-DD")
			return
		}
	} else {
		date = time.Now()
	}

	calendarSvc := calendar.NewCalendarService()
	hebrewDate := calendarSvc.GetHebrewDate(date)

	RespondJSON(w, r, http.StatusOK, hebrewDate)
}

// GetShabbatTimes returns Shabbat times for a given location and date
// GET /api/calendar/shabbat?date=YYYY-MM-DD&lat=31.7683&lon=35.2137&tz=Asia/Jerusalem
func (h *Handlers) GetShabbatTimes(w http.ResponseWriter, r *http.Request) {
	dateStr := r.URL.Query().Get("date")
	latStr := r.URL.Query().Get("lat")
	lonStr := r.URL.Query().Get("lon")
	tzName := r.URL.Query().Get("tz")

	if tzName == "" {
		tzName = "UTC"
	}

	var date time.Time
	var err error

	if dateStr != "" {
		date, err = time.Parse("2006-01-02", dateStr)
		if err != nil {
			RespondBadRequest(w, r, "Invalid date format. Use YYYY-MM-DD")
			return
		}
	} else {
		date = time.Now()
	}

	// Parse coordinates
	var lat, lon float64
	if latStr != "" {
		_, err = parseFloat(latStr, &lat)
		if err != nil {
			RespondBadRequest(w, r, "Invalid latitude")
			return
		}
	} else {
		lat = 31.7683 // Jerusalem default
	}

	if lonStr != "" {
		_, err = parseFloat(lonStr, &lon)
		if err != nil {
			RespondBadRequest(w, r, "Invalid longitude")
			return
		}
	} else {
		lon = 35.2137 // Jerusalem default
	}

	calendarSvc := calendar.NewCalendarService()
	shabbatTimes := calendarSvc.GetShabbatTimes(date, lat, lon, tzName)

	RespondJSON(w, r, http.StatusOK, shabbatTimes)
}

// GetGregorianDate converts a Hebrew date to Gregorian
// GET /api/calendar/gregorian-date?year=5785&month=9&day=1
func (h *Handlers) GetGregorianDate(w http.ResponseWriter, r *http.Request) {
	yearStr := r.URL.Query().Get("year")
	monthStr := r.URL.Query().Get("month")
	dayStr := r.URL.Query().Get("day")

	if yearStr == "" || monthStr == "" || dayStr == "" {
		RespondBadRequest(w, r, "year, month, and day parameters are required")
		return
	}

	calendarSvc := calendar.NewCalendarService()
	gregorianDate, err := calendarSvc.HebrewToGregorian(yearStr, monthStr, dayStr)
	if err != nil {
		RespondBadRequest(w, r, err.Error())
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]string{
		"date": gregorianDate,
	})
}

// parseFloat is a helper to parse float strings
func parseFloat(s string, f *float64) (bool, error) {
	n, err := parseFloatValue(s)
	if err != nil {
		return false, err
	}
	*f = n
	return true, nil
}

func parseFloatValue(s string) (float64, error) {
	// Simple float parsing
	var result float64
	var sign float64 = 1
	var decimal float64 = 0
	var decimalPlaces float64 = 1

	i := 0
	if len(s) > 0 && s[0] == '-' {
		sign = -1
		i++
	}

	for ; i < len(s); i++ {
		c := s[i]
		if c == '.' {
			decimal = 1
			continue
		}
		if c < '0' || c > '9' {
			break
		}
		digit := float64(c - '0')
		if decimal > 0 {
			decimalPlaces *= 10
			result = result + digit/decimalPlaces
		} else {
			result = result*10 + digit
		}
	}

	return sign * result, nil
}

// ============================================
// CALENDAR EVENT INFO HANDLERS
// ============================================

// GetEventDayInfo returns event information for a specific date and location
// GET /api/v1/calendar/day-info?date=YYYY-MM-DD&latitude=X&longitude=Y
func (h *Handlers) GetEventDayInfo(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	dateStr := r.URL.Query().Get("date")
	latStr := r.URL.Query().Get("latitude")
	lonStr := r.URL.Query().Get("longitude")
	timezone := r.URL.Query().Get("timezone")

	// Validate required parameters
	validationErrors := make(map[string]string)
	if dateStr == "" {
		validationErrors["date"] = "Date is required (YYYY-MM-DD format)"
	}
	if latStr == "" {
		validationErrors["latitude"] = "Latitude is required"
	}
	if lonStr == "" {
		validationErrors["longitude"] = "Longitude is required"
	}

	if len(validationErrors) > 0 {
		RespondValidationError(w, r, "Missing required parameters", validationErrors)
		return
	}

	// Parse date
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid date format. Use YYYY-MM-DD")
		return
	}

	// Parse latitude
	var latitude float64
	if _, err := parseFloat(latStr, &latitude); err != nil {
		RespondBadRequest(w, r, "Invalid latitude value")
		return
	}

	// Parse longitude
	var longitude float64
	if _, err := parseFloat(lonStr, &longitude); err != nil {
		RespondBadRequest(w, r, "Invalid longitude value")
		return
	}

	// Validate coordinate ranges
	if latitude < -90 || latitude > 90 {
		RespondBadRequest(w, r, "Latitude must be between -90 and 90")
		return
	}
	if longitude < -180 || longitude > 180 {
		RespondBadRequest(w, r, "Longitude must be between -180 and 180")
		return
	}

	if timezone == "" {
		timezone = "UTC"
	}

	// Create location
	loc := calendar.Location{
		Latitude:  latitude,
		Longitude: longitude,
		Timezone:  timezone,
		IsIsrael:  calendar.IsLocationInIsrael(latitude, longitude),
	}

	// Get transliteration style from query parameter (default to ashkenazi)
	transliterationStyle := r.URL.Query().Get("transliteration_style")
	if transliterationStyle == "" {
		transliterationStyle = "ashkenazi"
	}

	// Get calendar service with database adapter for event mapping
	dbAdapter := NewCalendarDBAdapter(h.db.Queries)
	calendarService := calendar.NewCalendarServiceWithDB(dbAdapter)
	dayInfo := calendarService.GetEventDayInfo(date, loc, transliterationStyle)

	RespondJSON(w, r, http.StatusOK, dayInfo)
}

// GetZmanimContext returns the zmanim context for a specific date and location
// GET /api/v1/calendar/zmanim-context?date=YYYY-MM-DD&latitude=X&longitude=Y
func (h *Handlers) GetZmanimContext(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	dateStr := r.URL.Query().Get("date")
	latStr := r.URL.Query().Get("latitude")
	lonStr := r.URL.Query().Get("longitude")
	timezone := r.URL.Query().Get("timezone")

	// Validate required parameters
	validationErrors := make(map[string]string)
	if dateStr == "" {
		validationErrors["date"] = "Date is required (YYYY-MM-DD format)"
	}
	if latStr == "" {
		validationErrors["latitude"] = "Latitude is required"
	}
	if lonStr == "" {
		validationErrors["longitude"] = "Longitude is required"
	}

	if len(validationErrors) > 0 {
		RespondValidationError(w, r, "Missing required parameters", validationErrors)
		return
	}

	// Parse date
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid date format. Use YYYY-MM-DD")
		return
	}

	// Parse latitude
	var latitude float64
	if _, err := parseFloat(latStr, &latitude); err != nil {
		RespondBadRequest(w, r, "Invalid latitude value")
		return
	}

	// Parse longitude
	var longitude float64
	if _, err := parseFloat(lonStr, &longitude); err != nil {
		RespondBadRequest(w, r, "Invalid longitude value")
		return
	}

	// Validate coordinate ranges
	if latitude < -90 || latitude > 90 {
		RespondBadRequest(w, r, "Latitude must be between -90 and 90")
		return
	}
	if longitude < -180 || longitude > 180 {
		RespondBadRequest(w, r, "Longitude must be between -180 and 180")
		return
	}

	if timezone == "" {
		timezone = "UTC"
	}

	// Create location
	loc := calendar.Location{
		Latitude:  latitude,
		Longitude: longitude,
		Timezone:  timezone,
		IsIsrael:  calendar.IsLocationInIsrael(latitude, longitude),
	}

	// Get transliteration style from query parameter (default to ashkenazi)
	transliterationStyle := r.URL.Query().Get("transliteration_style")
	if transliterationStyle == "" {
		transliterationStyle = "ashkenazi"
	}

	// Get calendar service with database adapter for event mapping
	dbAdapter := NewCalendarDBAdapter(h.db.Queries)
	calendarService := calendar.NewCalendarServiceWithDB(dbAdapter)
	zmanimContext := calendarService.GetZmanimContext(date, loc, transliterationStyle)

	RespondJSON(w, r, http.StatusOK, zmanimContext)
}

// GetWeekEventInfo returns event information for a week starting from a date
// GET /api/v1/calendar/week-events?start_date=YYYY-MM-DD&latitude=X&longitude=Y
func (h *Handlers) GetWeekEventInfo(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	startDateStr := r.URL.Query().Get("start_date")
	latStr := r.URL.Query().Get("latitude")
	lonStr := r.URL.Query().Get("longitude")
	timezone := r.URL.Query().Get("timezone")

	// Validate required parameters
	validationErrors := make(map[string]string)
	if startDateStr == "" {
		validationErrors["start_date"] = "Start date is required (YYYY-MM-DD format)"
	}
	if latStr == "" {
		validationErrors["latitude"] = "Latitude is required"
	}
	if lonStr == "" {
		validationErrors["longitude"] = "Longitude is required"
	}

	if len(validationErrors) > 0 {
		RespondValidationError(w, r, "Missing required parameters", validationErrors)
		return
	}

	// Parse date
	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid date format. Use YYYY-MM-DD")
		return
	}

	// Parse latitude
	var latitude float64
	if _, err := parseFloat(latStr, &latitude); err != nil {
		RespondBadRequest(w, r, "Invalid latitude value")
		return
	}

	// Parse longitude
	var longitude float64
	if _, err := parseFloat(lonStr, &longitude); err != nil {
		RespondBadRequest(w, r, "Invalid longitude value")
		return
	}

	// Validate coordinate ranges
	if latitude < -90 || latitude > 90 {
		RespondBadRequest(w, r, "Latitude must be between -90 and 90")
		return
	}
	if longitude < -180 || longitude > 180 {
		RespondBadRequest(w, r, "Longitude must be between -180 and 180")
		return
	}

	if timezone == "" {
		timezone = "UTC"
	}

	// Create location
	loc := calendar.Location{
		Latitude:  latitude,
		Longitude: longitude,
		Timezone:  timezone,
		IsIsrael:  calendar.IsLocationInIsrael(latitude, longitude),
	}

	// Get transliteration style from query parameter (default to ashkenazi)
	transliterationStyle := r.URL.Query().Get("transliteration_style")
	if transliterationStyle == "" {
		transliterationStyle = "ashkenazi"
	}

	// Get calendar service with database adapter for event mapping
	dbAdapter := NewCalendarDBAdapter(h.db.Queries)
	calendarService := calendar.NewCalendarServiceWithDB(dbAdapter)

	// Get info for each day of the week
	weekInfo := make(map[string]calendar.EventDayInfo)
	for i := 0; i < 7; i++ {
		date := startDate.AddDate(0, 0, i)
		dateKey := date.Format("2006-01-02")
		weekInfo[dateKey] = calendarService.GetEventDayInfo(date, loc, transliterationStyle)
	}

	RespondJSON(w, r, http.StatusOK, weekInfo)
}

// ============================================
// REGISTRY HANDLERS WITH EVENT FILTERING
// ============================================

// DEPRECATED: master_zman_events table is empty (tag-driven instead)
// GetMasterZmanimByEvent returns zmanim filtered by Jewish event
// GET /api/v1/registry/zmanim/by-event?event_code=shabbos
/* func (h *Handlers) GetMasterZmanimByEvent(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	eventCode := r.URL.Query().Get("event_code")
	if eventCode == "" {
		RespondBadRequest(w, r, "event_code parameter is required")
		return
	}

	dayNumberStr := r.URL.Query().Get("day_number")
	var zmanim []MasterZman

	// Note: day_number filtering is ignored because the schema doesn't have applies_to_day column
	// Day filtering should be done in the application layer if needed
	if dayNumberStr != "" {
		// Use the same query for both cases since schema doesn't support day filtering
		rows, err := h.db.Queries.GetMasterZmanimByEventAndDay(ctx, eventCode)
		if err != nil {
			RespondInternalError(w, r, "Failed to get zmanim")
			return
		}

		for _, row := range rows {
			zmanim = append(zmanim, MasterZman{
				ID:                   intToString(row.ID),
				ZmanKey:              row.ZmanKey,
				CanonicalHebrewName:  row.CanonicalHebrewName,
				CanonicalEnglishName: row.CanonicalEnglishName,
				Transliteration:      row.Transliteration,
				Description:          row.Description,
				HalachicNotes:        row.HalachicNotes,
				HalachicSource:       row.HalachicSource,
				TimeCategory:         stringPtrToString(row.TimeCategory),
				DefaultFormulaDSL:    stringPtrToString(row.DefaultFormulaDsl),
				IsCore:               *row.IsCore,
				CreatedAt:            row.CreatedAt.Time,
				UpdatedAt:            row.UpdatedAt.Time,
			})
		}
	} else {
		rows, err := h.db.Queries.GetMasterZmanimByEvent(ctx, eventCode)
		if err != nil {
			RespondInternalError(w, r, "Failed to get zmanim")
			return
		}

		for _, row := range rows {
			zmanim = append(zmanim, MasterZman{
				ID:                   intToString(row.ID),
				ZmanKey:              row.ZmanKey,
				CanonicalHebrewName:  row.CanonicalHebrewName,
				CanonicalEnglishName: row.CanonicalEnglishName,
				Transliteration:      row.Transliteration,
				Description:          row.Description,
				HalachicNotes:        row.HalachicNotes,
				HalachicSource:       row.HalachicSource,
				TimeCategory:         stringPtrToString(row.TimeCategory),
				DefaultFormulaDSL:    stringPtrToString(row.DefaultFormulaDsl),
				IsCore:               *row.IsCore,
				CreatedAt:            row.CreatedAt.Time,
				UpdatedAt:            row.UpdatedAt.Time,
			})
		}
	}

	if zmanim == nil {
		zmanim = []MasterZman{}
	}

	RespondJSON(w, r, http.StatusOK, zmanim)
} */

// DEPRECATED: master_zman_events table is empty (tag-driven instead)
// GetZmanApplicableEvents returns which Jewish events a zman applies to
// GET /api/v1/registry/zmanim/{zmanKey}/events
/* func (h *Handlers) GetZmanApplicableEvents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	zmanKey := r.URL.Query().Get("zman_key")

	if zmanKey == "" {
		RespondBadRequest(w, r, "zman_key is required")
		return
	}

	rows, err := h.db.Queries.GetZmanApplicableEvents(ctx, zmanKey)
	if err != nil {
		RespondInternalError(w, r, "Failed to get applicable events")
		return
	}

	var events []map[string]interface{}
	for _, row := range rows {
		e := JewishEventResponse{
			ID:                   intToString(row.ID),
			Code:                 row.Code,
			NameHebrew:           row.NameHebrew,
			NameEnglish:          row.NameEnglish,
			EventType:            stringPtrToString(row.EventType),
			DurationDaysIsrael:   int32PtrToInt(row.DurationDaysIsrael),
			DurationDaysDiaspora: int32PtrToInt(row.DurationDaysDiaspora),
			FastStartType:        row.FastStartType,
			ParentEventCode:      row.ParentEventCode,
			SortOrder:            int32PtrToInt(row.SortOrder),
		}

		eventMap := map[string]interface{}{
			"event":                 e,
			"is_primary":            row.IsPrimary,
			"override_hebrew_name":  row.OverrideHebrewName,
			"override_english_name": row.OverrideEnglishName,
		}
		events = append(events, eventMap)
	}

	if events == nil {
		events = []map[string]interface{}{}
	}

	RespondJSON(w, r, http.StatusOK, events)
} */
