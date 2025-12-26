package calendar

import (
	"context"
	"log/slog"
	"time"

	"github.com/hebcal/hdate"
	"github.com/hebcal/hebcal-go/hebcal"
	"github.com/hebcal/hebcal-go/locales"
)

// JewishEvent represents a Jewish event from our database model
type JewishEvent struct {
	Code                 string `json:"code"`
	NameHebrew           string `json:"name_hebrew"`
	NameEnglish          string `json:"name_english"`
	EventType            string `json:"event_type"` // weekly, yom_tov, fast, informational
	DurationDaysIsrael   int    `json:"duration_days_israel"`
	DurationDaysDiaspora int    `json:"duration_days_diaspora"`
	FastStartType        string `json:"fast_start_type,omitempty"` // dawn, sunset
}

// EventDayInfo contains detailed event information for a specific date
type EventDayInfo struct {
	GregorianDate   string        `json:"gregorian_date"`
	HebrewDate      HebrewDate    `json:"hebrew_date"`
	DayOfWeek       int           `json:"day_of_week"`
	IsShabbat       bool          `json:"is_shabbat"`
	IsYomTov        bool          `json:"is_yomtov"`
	IsFastDay       bool          `json:"is_fast_day"`
	IsInIsrael      bool          `json:"is_in_israel"`
	ActiveEvents    []ActiveEvent `json:"active_events"`    // Events happening today
	ErevEvents      []ActiveEvent `json:"erev_events"`      // Events starting tonight (for day_before zmanim)
	MoetzeiEvents   []ActiveEvent `json:"moetzei_events"`   // Events ending tonight (for day_of zmanim)
	SpecialContexts []string      `json:"special_contexts"` // shabbos_to_yomtov, yomtov_day2, etc.
	Holidays        []Holiday     `json:"holidays"`         // Raw holiday info from hebcal
}

// ActiveEvent represents an event that's active/relevant for a date
type ActiveEvent struct {
	EventCode     string `json:"event_code"`
	NameHebrew    string `json:"name_hebrew"`
	NameEnglish   string `json:"name_english"`
	DayNumber     int    `json:"day_number"`   // 1 for day 1, 2 for day 2 of multi-day events
	TotalDays     int    `json:"total_days"`   // Total days of event (location-aware)
	IsFinalDay    bool   `json:"is_final_day"` // Is this the last day of the event?
	FastStartType string `json:"fast_start_type,omitempty"`
}

// Location represents a geographic location for calendar calculations
type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Timezone  string  `json:"timezone"`
	IsIsrael  bool    `json:"is_israel"`
}

// IsLocationInIsrael determines if coordinates are in Israel
func IsLocationInIsrael(lat, lon float64) bool {
	// Approximate Israel bounding box
	// Latitude: 29.5 to 33.5
	// Longitude: 34.0 to 36.0
	return lat >= 29.5 && lat <= 33.5 && lon >= 34.0 && lon <= 36.0
}

// GetEventDayInfo returns comprehensive event information for a date and location
// transliterationStyle: "ashkenazi" for Ashkenazi transliterations, "sephardi" or "" for Sephardi (default)
func (s *CalendarService) GetEventDayInfo(date time.Time, loc Location, transliterationStyle string) EventDayInfo {
	hd := s.GetHebrewDate(date)
	dow := int(date.Weekday())
	holidays := s.GetHolidaysWithStyle(date, transliterationStyle)

	info := EventDayInfo{
		GregorianDate: date.Format("2006-01-02"),
		HebrewDate:    hd,
		DayOfWeek:     dow,
		IsShabbat:     dow == 6, // Saturday
		IsInIsrael:    loc.IsIsrael,
		Holidays:      holidays,
	}

	// Check for Yom Tov and fasts
	for _, h := range holidays {
		if h.Yomtov {
			info.IsYomTov = true
		}
		if h.Category == "fast" {
			info.IsFastDay = true
		}
	}

	// Get active events, erev events, and motzei events
	info.ActiveEvents = s.getActiveEvents(date, loc, transliterationStyle)
	info.ErevEvents = s.getErevEvents(date, loc, transliterationStyle)
	info.MoetzeiEvents = s.getMoetzeiEvents(date, loc, transliterationStyle)

	// Detect special contexts
	info.SpecialContexts = s.detectSpecialContexts(date, loc, &info)

	return info
}

// getActiveEvents returns events that are active on the given date
func (s *CalendarService) getActiveEvents(date time.Time, loc Location, transliterationStyle string) []ActiveEvent {
	var events []ActiveEvent
	hd := hdate.FromTime(date)

	// Check if it's Shabbat (Saturday - the actual day of Shabbos)
	if date.Weekday() == time.Saturday {
		shabbatName := GetTransliteratedName("Shabbat", transliterationStyle)
		events = append(events, ActiveEvent{
			EventCode:   "shabbos",
			NameHebrew:  "שבת",
			NameEnglish: shabbatName,
			DayNumber:   1,
			TotalDays:   1,
			IsFinalDay:  true,
		})
	}

	// Get holidays from hebcal (now location-aware for candle lighting)
	holidays := s.getHebcalEventsWithLocation(date, loc.Latitude, loc.Longitude, transliterationStyle)
	slog.Info("getActiveEvents: retrieved holidays from HebCal",
		"date", date.Format("2006-01-02"),
		"holiday_count", len(holidays))

	for _, h := range holidays {
		slog.Info("getActiveEvents: processing holiday", "name", h.Name, "category", h.Category)
		if ev := s.holidayToActiveEvent(h, hd, loc, transliterationStyle); ev != nil {
			events = append(events, *ev)
			slog.Info("getActiveEvents: added active event", "event_code", ev.EventCode)
		}
	}

	slog.Info("getActiveEvents: final event count", "count", len(events))
	return events
}

// getErevEvents returns events starting tonight (for day_before display)
func (s *CalendarService) getErevEvents(date time.Time, loc Location, transliterationStyle string) []ActiveEvent {
	var events []ActiveEvent

	// Check if tomorrow is Shabbat (erev Shabbos today)
	tomorrow := date.AddDate(0, 0, 1)
	if tomorrow.Weekday() == time.Saturday {
		erevShabbosName := GetTransliteratedName("Erev Shabbat", transliterationStyle)
		events = append(events, ActiveEvent{
			EventCode:   "erev_shabbos",
			NameHebrew:  "ערב שבת",
			NameEnglish: erevShabbosName,
			DayNumber:   1,
			TotalDays:   1,
			IsFinalDay:  true,
		})
	}

	// Check tomorrow's holidays (tag-driven approach)
	tomorrowHolidays := s.getHebcalEventsWithLocation(tomorrow, loc.Latitude, loc.Longitude, transliterationStyle)
	hdTomorrow := hdate.FromTime(tomorrow)

	for _, h := range tomorrowHolidays {
		ev := s.holidayToActiveEvent(h, hdTomorrow, loc, transliterationStyle)
		if ev != nil && ev.DayNumber == 1 {
			// Only include if it's the first day of the event
			events = append(events, *ev)
		}
	}

	return events
}

// getMoetzeiEvents returns events ending tonight (for day_of display like havdalah)
func (s *CalendarService) getMoetzeiEvents(date time.Time, loc Location, transliterationStyle string) []ActiveEvent {
	var events []ActiveEvent

	// Check if today is Shabbat (motzei Shabbos tonight)
	if date.Weekday() == time.Saturday {
		// Check if there's no Yom Tov immediately following
		tomorrow := date.AddDate(0, 0, 1)
		tomorrowHolidays := s.getHebcalEventsWithLocation(tomorrow, loc.Latitude, loc.Longitude, transliterationStyle)
		hasYomTovTomorrow := false
		for _, h := range tomorrowHolidays {
			if h.Yomtov {
				hasYomTovTomorrow = true
				break
			}
		}

		if !hasYomTovTomorrow {
			shabbatName := GetTransliteratedName("Shabbat", transliterationStyle)
			events = append(events, ActiveEvent{
				EventCode:   "shabbos",
				NameHebrew:  "שבת",
				NameEnglish: shabbatName,
				DayNumber:   1,
				TotalDays:   1,
				IsFinalDay:  true,
			})
		}
	}

	// Check for Yom Tov or fast ending
	hd := hdate.FromTime(date)
	holidays := s.getHebcalEventsWithLocation(date, loc.Latitude, loc.Longitude, transliterationStyle)
	for _, h := range holidays {
		ev := s.holidayToActiveEvent(h, hd, loc, transliterationStyle)
		if ev != nil && ev.IsFinalDay {
			events = append(events, *ev)
		}
	}

	return events
}

// detectSpecialContexts identifies special situations using HebCal event flags
func (s *CalendarService) detectSpecialContexts(date time.Time, loc Location, info *EventDayInfo) []string {
	var contexts []string

	// Check for Shabbos going into Yom Tov
	if date.Weekday() == time.Saturday && len(info.ErevEvents) > 0 {
		// Check if any erev event tomorrow is a Yom Tov
		tomorrow := date.AddDate(0, 0, 1)
		tomorrowHolidays := s.GetHolidays(tomorrow)
		for _, h := range tomorrowHolidays {
			if h.Yomtov {
				contexts = append(contexts, "shabbos_to_yomtov")
				break
			}
		}
	}

	// Check for Yom Tov Sheni (Day 2 in Diaspora)
	if !loc.IsIsrael && len(info.ActiveEvents) > 0 {
		for _, active := range info.ActiveEvents {
			if active.DayNumber == 2 && active.TotalDays == 2 {
				contexts = append(contexts, "yomtov_day2")
				break
			}
		}
	}

	// Check for consecutive Yom Tov days (YT to YT)
	if info.IsYomTov && len(info.ErevEvents) > 0 {
		tomorrow := date.AddDate(0, 0, 1)
		tomorrowHolidays := s.GetHolidays(tomorrow)
		for _, h := range tomorrowHolidays {
			if h.Yomtov {
				contexts = append(contexts, "yomtov_to_yomtov")
				break
			}
		}
	}

	return contexts
}

// getHebcalEvents gets raw hebcal events for a date (without location - legacy)
func (s *CalendarService) getHebcalEvents(date time.Time) []Holiday {
	hd := hdate.FromTime(date)
	year := hd.Year()

	opts := hebcal.CalOptions{
		Year:             year,
		IsHebrewYear:     true,
		NoHolidays:       false,
		NoMinorFast:      false,
		NoModern:         false,
		NoRoshChodesh:    false,
		NoSpecialShabbat: true,
		ShabbatMevarchim: false,
	}

	events, _ := hebcal.HebrewCalendar(&opts)

	var holidays []Holiday
	dateStr := date.Format("2006-01-02")

	for _, ev := range events {
		evDate := ev.GetDate().Gregorian()
		if evDate.Format("2006-01-02") == dateStr {
			holidays = append(holidays, eventToHoliday(ev))
		}
	}

	return holidays
}

// getHebcalEventsWithLocation gets raw hebcal events for a date with location
// Uses the hebcal-go library directly (no external API calls)
func (s *CalendarService) getHebcalEventsWithLocation(date time.Time, lat, lon float64, transliterationStyle string) []Holiday {
	// Use the hebcal-go library directly for all holiday lookups
	holidays := s.GetHolidaysWithStyle(date, transliterationStyle)

	slog.Debug("getHebcalEventsWithLocation: fetched events from library",
		"date", date.Format("2006-01-02"),
		"count", len(holidays))

	return holidays
}

// holidayToActiveEvent converts a Holiday to ActiveEvent using database-driven event mapping
func (s *CalendarService) holidayToActiveEvent(h Holiday, hd hdate.HDate, loc Location, transliterationStyle string) *ActiveEvent {
	// If no database is configured, return nil (service operates in standalone mode)
	if s.db == nil {
		slog.Warn("holidayToActiveEvent: database adapter is nil, cannot match events")
		return nil
	}

	// Use original HebCal name for database matching (before transformation)
	// This ensures "Chanukah: 1 Candle" matches the database pattern "^Chanukah:"
	hebcalName := h.HebcalOriginal
	if hebcalName == "" {
		// Fallback to transformed name if original not available
		hebcalName = h.Name
	}

	slog.Info("holidayToActiveEvent: attempting to match HebCal event",
		"hebcal_original", h.HebcalOriginal,
		"hebcal_name", hebcalName,
		"category", h.Category,
		"yomtov", h.Yomtov)

	// Query database for matching tag using HebCal event name and category
	tagMatch, metadata, err := s.GetEventCodeFromHebcal(hebcalName, h.Category, hd, loc.IsIsrael)
	if err != nil {
		// Error during matching - log and skip
		slog.Warn("hebcal event matching error", "event", hebcalName, "error", err)
		return nil
	}
	if tagMatch == nil {
		// No match found - skip this event (this is normal for unmapped events)
		slog.Debug("no database match found for hebcal event", "event", hebcalName, "category", h.Category)
		return nil
	}

	slog.Info("holidayToActiveEvent: matched event to tag",
		"hebcal_event", hebcalName,
		"tag_key", tagMatch.TagKey,
		"hebrew_name", tagMatch.DisplayNameHebrew)

	// Select appropriate English name based on transliteration style
	englishName := tagMatch.DisplayNameEnglishAshkenazi
	if transliterationStyle == "sephardi" && tagMatch.DisplayNameEnglishSephardi != nil {
		englishName = *tagMatch.DisplayNameEnglishSephardi
	}

	// Determine total days based on location (Israel vs Diaspora)
	totalDays := metadata.DurationDaysIsrael
	if !loc.IsIsrael {
		totalDays = metadata.DurationDaysDiaspora
	}

	// Extract day number from ORIGINAL event title (e.g., "Chanukah: 3 Candles" or "Pesach II" -> day number)
	dayNumber := extractDayNumber(hebcalName, totalDays)

	// Determine if this is the final day
	isFinalDay := (dayNumber == totalDays)

	return &ActiveEvent{
		EventCode:     tagMatch.TagKey,
		NameHebrew:    tagMatch.DisplayNameHebrew,
		NameEnglish:   englishName,
		DayNumber:     dayNumber,
		TotalDays:     totalDays,
		IsFinalDay:    isFinalDay,
		FastStartType: metadata.FastStartType,
	}
}

// HebcalTagMatch represents a matched tag from the database
type HebcalTagMatch struct {
	TagKey                      string
	DisplayNameHebrew           string
	DisplayNameEnglishAshkenazi string
	DisplayNameEnglishSephardi  *string
}

// EventMetadata contains additional event information
type EventMetadata struct {
	DurationDaysIsrael   int
	DurationDaysDiaspora int
	FastStartType        string // "dawn" or "sunset"
}

// GetEventCodeFromHebcal maps HebCal event name to tag using database pattern matching
// Returns the tag match and metadata from database, or nil if no match found
func (s *CalendarService) GetEventCodeFromHebcal(hebcalEventName string, hebcalCategory string, hd hdate.HDate, isIsrael bool) (*HebcalTagMatch, *EventMetadata, error) {
	// If no database is configured, return nil (service operates in standalone mode)
	if s.db == nil {
		return nil, nil, nil
	}

	// Query database for matching tags using the PostgreSQL match_hebcal_event function
	ctx := context.Background()
	matches, err := s.db.MatchHebcalEvent(ctx, MatchHebcalEventParams{
		HebcalTitle:    hebcalEventName,
		HebcalCategory: hebcalCategory,
	})

	if err != nil {
		return nil, nil, err
	}

	// If no matches found, return nil
	if len(matches) == 0 {
		return nil, nil, nil
	}

	// Take the first match (database function returns best match first)
	match := matches[0]

	tagMatch := &HebcalTagMatch{
		TagKey:                      match.TagKey,
		DisplayNameHebrew:           match.DisplayNameHebrew,
		DisplayNameEnglishAshkenazi: match.DisplayNameEnglishAshkenazi,
		DisplayNameEnglishSephardi:  match.DisplayNameEnglishSephardi,
	}

	// Return basic metadata structure (event duration and fast start type expansion tracked in backlog)
	metadata := &EventMetadata{
		DurationDaysIsrael:   1,
		DurationDaysDiaspora: 1,
		FastStartType:        "",
	}

	return tagMatch, metadata, nil
}

// extractDayNumber extracts the day number from HebCal event names like "Rosh Hashana I", "Pesach II", etc.
// Returns 1-based day number, defaulting to 1 if no Roman numeral found
func extractDayNumber(hebcalEventName string, totalDays int) int {
	// Map of Roman numerals to numbers
	romanToNum := map[string]int{
		"I":    1,
		"II":   2,
		"III":  3,
		"IV":   4,
		"V":    5,
		"VI":   6,
		"VII":  7,
		"VIII": 8,
	}

	// Check for Roman numerals in the event name
	for roman, num := range romanToNum {
		// Look for " I", " II", etc. (with space before to avoid false matches)
		if contains(hebcalEventName, " "+roman) && num <= totalDays {
			return num
		}
	}

	// Special handling for Chanukah which has day numbers like "Chanukah: 3 Candles"
	if contains(hebcalEventName, "Chanukah") {
		// For Chanukah, we can infer from the Hebrew date
		// Chanukah starts on 25 Kislev and lasts 8 days
		// This is a simplified approach - could be enhanced if needed
		return 1
	}

	// Default to day 1 if no specific day found
	return 1
}

// contains is a simple string contains helper
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsImpl(s, substr))
}

func containsImpl(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// GetZmanimContext determines which zmanim should be displayed for a date
// Returns the context info needed to select appropriate zmanim and display names
type ZmanimContext struct {
	DisplayContexts  []string `json:"display_contexts"`   // DEPRECATED: Use category tags instead. Kept for backward compatibility.
	ActiveEventCodes []string `json:"active_event_codes"` // Event codes active on this date (includes today, erev, and motzei events)
}

// GetZmanimContext determines what zmanim to show for a date
// transliterationStyle: "ashkenazi" for Ashkenazi transliterations, "sephardi" or "" for Sephardi (default)
func (s *CalendarService) GetZmanimContext(date time.Time, loc Location, transliterationStyle string) ZmanimContext {
	info := s.GetEventDayInfo(date, loc, transliterationStyle)

	slog.Info("GetZmanimContext: received event day info",
		"date", date.Format("2006-01-02"),
		"active_events_count", len(info.ActiveEvents),
		"erev_events_count", len(info.ErevEvents),
		"moetzei_events_count", len(info.MoetzeiEvents))

	ctx := ZmanimContext{
		ActiveEventCodes: []string{}, // Initialize as empty slice, not nil
	}

	// Collect active event codes from events happening today
	for _, ev := range info.ActiveEvents {
		ctx.ActiveEventCodes = appendUnique(ctx.ActiveEventCodes, ev.EventCode)
		slog.Info("GetZmanimContext: added active event", "event_code", ev.EventCode)
	}

	// Add erev events to ActiveEventCodes (for candle lighting zmanim)
	// These events are starting tonight, so we need their day_before zmanim
	for _, erev := range info.ErevEvents {
		ctx.ActiveEventCodes = appendUnique(ctx.ActiveEventCodes, erev.EventCode)
		slog.Info("GetZmanimContext: added erev event", "event_code", erev.EventCode)
	}

	// Add motzei events to ActiveEventCodes (for havdalah zmanim)
	// These events are ending tonight, so we need their day_of zmanim
	// This fixes the bug where motzei_shabbos was missing from ActiveEventCodes
	for _, motzei := range info.MoetzeiEvents {
		ctx.ActiveEventCodes = appendUnique(ctx.ActiveEventCodes, motzei.EventCode)
		slog.Info("GetZmanimContext: added moetzei event", "event_code", motzei.EventCode)
	}

	slog.Info("GetZmanimContext: final result",
		"active_event_codes", ctx.ActiveEventCodes,
		"count", len(ctx.ActiveEventCodes))

	// DisplayContexts is DEPRECATED - kept for backward compatibility
	// Frontend should use category tags (category_candle_lighting, category_havdalah, etc.)
	// instead of DisplayContexts for grouping zmanim
	ctx.DisplayContexts = ctx.ActiveEventCodes

	return ctx
}

func appendUnique(slice []string, s string) []string {
	for _, existing := range slice {
		if existing == s {
			return slice
		}
	}
	return append(slice, s)
}

// GetTransliteratedName returns the holiday name in the appropriate transliteration style
// transliterationStyle: "ashkenazi" for Ashkenazi transliterations, "sephardi" or "" for Sephardi (default)
func GetTransliteratedName(name string, transliterationStyle string) string {
	// Normalize transliteration style
	locale := "en" // Default to Sephardic (en)
	if transliterationStyle == "ashkenazi" {
		locale = "ashkenazi"
	}

	// Try to look up the translation from hebcal-go locales
	if translated, ok := locales.LookupTranslation(name, locale); ok {
		return translated
	}

	// If no translation found, return the original name
	return name
}
