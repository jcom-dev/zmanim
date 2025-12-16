package calendar

import (
	"time"

	"github.com/hebcal/hdate"
	"github.com/hebcal/hebcal-go/hebcal"
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
func (s *CalendarService) GetEventDayInfo(date time.Time, loc Location) EventDayInfo {
	hd := s.GetHebrewDate(date)
	dow := int(date.Weekday())
	holidays := s.GetHolidays(date)

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
	info.ActiveEvents = s.getActiveEvents(date, loc)
	info.ErevEvents = s.getErevEvents(date, loc)
	info.MoetzeiEvents = s.getMoetzeiEvents(date, loc)

	// Detect special contexts
	info.SpecialContexts = s.detectSpecialContexts(date, loc, &info)

	return info
}

// getActiveEvents returns events that are active on the given date
func (s *CalendarService) getActiveEvents(date time.Time, loc Location) []ActiveEvent {
	var events []ActiveEvent
	hd := hdate.FromTime(date)

	// Check if it's Shabbat
	if date.Weekday() == time.Saturday {
		events = append(events, ActiveEvent{
			EventCode:   "shabbos",
			NameHebrew:  "שבת",
			NameEnglish: "Shabbos",
			DayNumber:   1,
			TotalDays:   1,
			IsFinalDay:  true,
		})
	}

	// Get holidays from hebcal
	holidays := s.getHebcalEvents(date)
	for _, h := range holidays {
		if ev := s.holidayToActiveEvent(h, hd, loc); ev != nil {
			events = append(events, *ev)
		}
	}

	return events
}

// getErevEvents returns events starting tonight (for day_before display)
func (s *CalendarService) getErevEvents(date time.Time, loc Location) []ActiveEvent {
	var events []ActiveEvent

	// Check if tomorrow is Shabbat (today is Friday = erev Shabbos)
	if date.Weekday() == time.Friday {
		events = append(events, ActiveEvent{
			EventCode:   "shabbos",
			NameHebrew:  "שבת",
			NameEnglish: "Shabbos",
			DayNumber:   1,
			TotalDays:   1,
			IsFinalDay:  true,
		})
	}

	// Check tomorrow's holidays
	tomorrow := date.AddDate(0, 0, 1)
	tomorrowHolidays := s.getHebcalEvents(tomorrow)
	hdTomorrow := hdate.FromTime(tomorrow)

	for _, h := range tomorrowHolidays {
		ev := s.holidayToActiveEvent(h, hdTomorrow, loc)
		if ev != nil && ev.DayNumber == 1 {
			// Only include if it's the first day of the event
			events = append(events, *ev)
		}
	}

	return events
}

// getMoetzeiEvents returns events ending tonight (for day_of display like havdalah)
func (s *CalendarService) getMoetzeiEvents(date time.Time, loc Location) []ActiveEvent {
	var events []ActiveEvent

	// Check if today is Shabbat (motzei Shabbos tonight)
	if date.Weekday() == time.Saturday {
		// Check if there's no Yom Tov immediately following
		tomorrow := date.AddDate(0, 0, 1)
		tomorrowHolidays := s.getHebcalEvents(tomorrow)
		hasYomTovTomorrow := false
		for _, h := range tomorrowHolidays {
			if h.Yomtov {
				hasYomTovTomorrow = true
				break
			}
		}

		if !hasYomTovTomorrow {
			events = append(events, ActiveEvent{
				EventCode:   "shabbos",
				NameHebrew:  "שבת",
				NameEnglish: "Shabbos",
				DayNumber:   1,
				TotalDays:   1,
				IsFinalDay:  true,
			})
		}
	}

	// Check for Yom Tov or fast ending
	hd := hdate.FromTime(date)
	holidays := s.getHebcalEvents(date)
	for _, h := range holidays {
		ev := s.holidayToActiveEvent(h, hd, loc)
		if ev != nil && ev.IsFinalDay {
			events = append(events, *ev)
		}
	}

	return events
}

// detectSpecialContexts identifies special situations
func (s *CalendarService) detectSpecialContexts(date time.Time, loc Location, info *EventDayInfo) []string {
	var contexts []string

	// Check for Shabbos going into Yom Tov
	if date.Weekday() == time.Saturday {
		// Check if there's a Yom Tov starting tonight
		for _, erev := range info.ErevEvents {
			if erev.EventCode != "shabbos" && isYomTovEvent(erev.EventCode) {
				contexts = append(contexts, "shabbos_to_yomtov")
				break
			}
		}
	}

	// Check for Yom Tov Sheni (Day 2 in Diaspora)
	if !loc.IsIsrael {
		for _, active := range info.ActiveEvents {
			if active.DayNumber == 2 && active.TotalDays == 2 {
				contexts = append(contexts, "yomtov_day2")
				break
			}
		}
	}

	// Check for consecutive Yom Tov days (YT to YT)
	todayHasYomTov := false
	for _, active := range info.ActiveEvents {
		if isYomTovEvent(active.EventCode) {
			todayHasYomTov = true
			break
		}
	}
	if todayHasYomTov {
		for _, erev := range info.ErevEvents {
			if isYomTovEvent(erev.EventCode) && erev.EventCode != "shabbos" {
				contexts = append(contexts, "yomtov_to_yomtov")
				break
			}
		}
	}

	return contexts
}

// getHebcalEvents gets raw hebcal events for a date
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

// holidayToActiveEvent converts a Holiday to ActiveEvent
func (s *CalendarService) holidayToActiveEvent(h Holiday, hd hdate.HDate, loc Location) *ActiveEvent {
	// Map holiday names to our event codes
	code, dayNum, totalDays := mapHolidayToEventCode(h.Name, hd, loc.IsIsrael)
	if code == "" {
		return nil
	}

	fastStartType := ""
	if h.Category == "fast" {
		fastStartType = getFastStartType(code)
	}

	return &ActiveEvent{
		EventCode:     code,
		NameHebrew:    h.NameHebrew,
		NameEnglish:   h.Name,
		DayNumber:     dayNum,
		TotalDays:     totalDays,
		IsFinalDay:    dayNum == totalDays,
		FastStartType: fastStartType,
	}
}

// mapHolidayToEventCode maps hebcal holiday name to our event code
func mapHolidayToEventCode(name string, hd hdate.HDate, isIsrael bool) (code string, dayNum, totalDays int) {
	// This is a simplified mapping - would need to be more comprehensive
	switch {
	case contains(name, "Rosh Hashana"):
		if contains(name, "I") && !contains(name, "II") {
			return "rosh_hashanah", 1, 2
		}
		return "rosh_hashanah", 2, 2

	case contains(name, "Yom Kippur"):
		return "yom_kippur", 1, 1

	case contains(name, "Sukkot") && (contains(name, "I") || contains(name, "II")):
		if isIsrael {
			return "sukkos", 1, 1
		}
		if contains(name, "I") && !contains(name, "II") {
			return "sukkos", 1, 2
		}
		return "sukkos", 2, 2

	case contains(name, "Sukkot") && contains(name, "Chol ha-Moed"):
		return "chol_hamoed_sukkos", 1, 1

	case contains(name, "Hoshana Raba"):
		return "hoshanah_rabbah", 1, 1

	case contains(name, "Shmini Atzeret"):
		if isIsrael {
			return "shemini_atzeres", 1, 1
		}
		return "shemini_atzeres", 1, 2

	case contains(name, "Simchat Torah"):
		if isIsrael {
			return "shemini_atzeres", 1, 1 // Same day in Israel
		}
		return "shemini_atzeres", 2, 2

	case contains(name, "Pesach") && (contains(name, "I") || contains(name, "II")):
		if isIsrael {
			if contains(name, "VII") {
				return "pesach_last", 1, 1
			}
			return "pesach_first", 1, 1
		}
		if contains(name, "VII") || contains(name, "VIII") {
			if contains(name, "VII") {
				return "pesach_last", 1, 2
			}
			return "pesach_last", 2, 2
		}
		if contains(name, "I") && !contains(name, "II") {
			return "pesach_first", 1, 2
		}
		return "pesach_first", 2, 2

	case contains(name, "Pesach") && contains(name, "Chol ha-Moed"):
		return "chol_hamoed_pesach", 1, 1

	case contains(name, "Shavuot"):
		if isIsrael {
			return "shavuos", 1, 1
		}
		if contains(name, "I") && !contains(name, "II") {
			return "shavuos", 1, 2
		}
		if contains(name, "II") {
			return "shavuos", 2, 2
		}
		return "shavuos", 1, 2

	case contains(name, "Tish'a B'Av"):
		return "tisha_bav", 1, 1

	case contains(name, "Tzom Gedaliah"):
		return "tzom_gedaliah", 1, 1

	case contains(name, "Asara B'Tevet"):
		return "asarah_bteves", 1, 1

	case contains(name, "Ta'anit Esther"):
		return "taanis_esther", 1, 1

	case contains(name, "Tzom Tammuz"), contains(name, "17 of Tamuz"):
		return "shiva_asar_btamuz", 1, 1

	case contains(name, "Rosh Chodesh"):
		return "rosh_chodesh", 1, 1

	case contains(name, "Chanukah"):
		return "chanukah", hd.Day(), 8 // Simplified

	case contains(name, "Purim") && !contains(name, "Shushan"):
		return "purim", 1, 1

	case contains(name, "Shushan Purim"):
		return "shushan_purim", 1, 1
	}

	return "", 0, 0
}

// getFastStartType returns the start type for a fast
func getFastStartType(code string) string {
	switch code {
	case "yom_kippur", "tisha_bav":
		return "sunset"
	case "tzom_gedaliah", "asarah_bteves", "shiva_asar_btamuz", "taanis_esther":
		return "dawn"
	default:
		return ""
	}
}

// isYomTovEvent checks if an event code is a Yom Tov
func isYomTovEvent(code string) bool {
	yomTovCodes := map[string]bool{
		"rosh_hashanah":   true,
		"yom_kippur":      true,
		"sukkos":          true,
		"shemini_atzeres": true,
		"pesach_first":    true,
		"pesach_last":     true,
		"shavuos":         true,
	}
	return yomTovCodes[code]
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
	ShowDailyZmanim         bool     `json:"show_daily_zmanim"`
	ShowCandleLighting      bool     `json:"show_candle_lighting"`
	ShowCandleLightingSheni bool     `json:"show_candle_lighting_sheni"` // After tzeis
	ShowShabbosYomTovEnds   bool     `json:"show_shabbos_yomtov_ends"`
	ShowFastStarts          bool     `json:"show_fast_starts"`
	FastStartType           string   `json:"fast_start_type"` // dawn or sunset
	ShowFastEnds            bool     `json:"show_fast_ends"`
	ShowChametzTimes        bool     `json:"show_chametz_times"`
	DisplayContexts         []string `json:"display_contexts"` // shabbos, yom_tov, yom_kippur, etc.
	ActiveEventCodes        []string `json:"active_event_codes"`
}

// GetZmanimContext determines what zmanim to show for a date
func (s *CalendarService) GetZmanimContext(date time.Time, loc Location) ZmanimContext {
	info := s.GetEventDayInfo(date, loc)

	ctx := ZmanimContext{
		ShowDailyZmanim: true, // Always show daily zmanim
	}

	// Collect active event codes
	for _, ev := range info.ActiveEvents {
		ctx.ActiveEventCodes = append(ctx.ActiveEventCodes, ev.EventCode)
	}

	// Check for candle lighting (erev events)
	// Also add erev events to ActiveEventCodes so event-tagged zmanim show on erev
	for _, erev := range info.ErevEvents {
		if erev.EventCode == "shabbos" || isYomTovEvent(erev.EventCode) {
			// Add to active event codes so event-tagged zmanim will show
			ctx.ActiveEventCodes = appendUnique(ctx.ActiveEventCodes, erev.EventCode)

			// Check if we need regular or sheni candle lighting
			hasSpecialContext := false
			for _, sc := range info.SpecialContexts {
				if sc == "shabbos_to_yomtov" || sc == "yomtov_to_yomtov" || sc == "yomtov_day2" {
					hasSpecialContext = true
					break
				}
			}

			if hasSpecialContext {
				ctx.ShowCandleLightingSheni = true
			} else {
				ctx.ShowCandleLighting = true
			}

			if erev.EventCode == "shabbos" {
				ctx.DisplayContexts = appendUnique(ctx.DisplayContexts, "shabbos")
			} else {
				ctx.DisplayContexts = appendUnique(ctx.DisplayContexts, erev.EventCode)
			}
		}
	}

	// Check for Shabbos/Yom Tov ends (motzei events)
	for _, motzei := range info.MoetzeiEvents {
		ctx.ShowShabbosYomTovEnds = true
		if motzei.EventCode == "shabbos" {
			ctx.DisplayContexts = appendUnique(ctx.DisplayContexts, "shabbos")
		} else {
			ctx.DisplayContexts = appendUnique(ctx.DisplayContexts, motzei.EventCode)
		}
	}

	// Check for fast days
	for _, active := range info.ActiveEvents {
		if active.FastStartType != "" {
			ctx.ShowFastEnds = true
			ctx.DisplayContexts = appendUnique(ctx.DisplayContexts, active.EventCode)
		}
	}

	// Check for fast starting tomorrow (sunset-based fasts)
	for _, erev := range info.ErevEvents {
		if erev.FastStartType == "sunset" {
			ctx.ShowFastStarts = true
			ctx.FastStartType = "sunset"
			ctx.DisplayContexts = appendUnique(ctx.DisplayContexts, erev.EventCode)
		}
	}

	// Check for fast starting today at dawn
	for _, active := range info.ActiveEvents {
		if active.FastStartType == "dawn" && active.DayNumber == 1 {
			ctx.ShowFastStarts = true
			ctx.FastStartType = "dawn"
		}
	}

	// Check for Erev Pesach (chametz times)
	hd := hdate.FromTime(date)
	if hd.Month() == hdate.Nisan && hd.Day() == 14 {
		ctx.ShowChametzTimes = true
	}

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
