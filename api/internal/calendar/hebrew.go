package calendar

import (
	"context"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/hebcal/hdate"
	"github.com/hebcal/hebcal-go/event"
	"github.com/hebcal/hebcal-go/hebcal"
)

// Type aliases for sqlc generated types to avoid circular imports
// These types are defined in internal/db/sqlcgen/tag_events.sql.go
// We use concrete struct definitions here to avoid import cycles

// MatchHebcalEventParams matches the sqlcgen type
type MatchHebcalEventParams struct {
	HebcalTitle    string
	HebcalCategory string
}

// MatchHebcalEventRow matches the sqlcgen type structure
type MatchHebcalEventRow struct {
	ID                          int32
	TagKey                      string
	DisplayNameHebrew           string
	DisplayNameEnglishAshkenazi string
	DisplayNameEnglishSephardi  *string
	TagTypeID                   int32
	TagType                     string
	TagTypeDisplayHebrew        string
	TagTypeDisplayEnglish       string
	Description                 *string
	Color                       *string
	SortOrder                   *int32
	MatchType                   interface{} // NullHebcalMatchType
}

// chanukahCandleRegex matches "Chanukah: X Candles" pattern from Hebcal
var chanukahCandleRegex = regexp.MustCompile(`(\d+)\s*Candles?`)

// chanukahDayRegex matches "Chanukah: Xth Day" or "Chanukah: X Day" pattern
var chanukahDayRegex = regexp.MustCompile(`(\d+)(?:st|nd|rd|th)?\s*Day`)

// chanukahHebrewCandleRegex matches Hebrew "חנוכה: X׳ נרות" pattern (after niqqud removal)
// Hebrew numerals: ב=2, ג=3, ד=4, ה=5, ו=6, ז=7, ח=8
var chanukahHebrewCandleRegex = regexp.MustCompile(`חנוכה:\s*([בגדהוזח])׳?\s*נרות`)

// chanukahHebrewDayRegex matches Hebrew "חנוכה: יום X" pattern (after niqqud removal)
var chanukahHebrewDayRegex = regexp.MustCompile(`חנוכה:\s*יום\s*([אבגדהוזח])׳?`)

// niqqudRegex matches Hebrew niqqud (vowel marks) - Unicode range U+05B0 to U+05C7
var niqqudRegex = regexp.MustCompile(`[\x{05B0}-\x{05C7}]`)

// hebrewNumeralMap maps Hebrew letters to their numeric values for days 1-8
var hebrewNumeralMap = map[rune]int{
	'א': 1, 'ב': 2, 'ג': 3, 'ד': 4,
	'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8,
}

// hebrewDayNumerals maps day numbers to Hebrew letters
var hebrewDayNumerals = []string{"", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"}

// HebrewDate represents a date in the Hebrew calendar
type HebrewDate struct {
	Day       int    `json:"day"`
	Month     string `json:"month"`
	MonthNum  int    `json:"month_num"`
	Year      int    `json:"year"`
	Hebrew    string `json:"hebrew"`    // כ"ג כסלו תשפ"ה
	Formatted string `json:"formatted"` // 23 Kislev 5785
}

// Holiday represents a Jewish holiday or event
type Holiday struct {
	Name           string `json:"name"`
	NameHebrew     string `json:"name_hebrew"`
	Category       string `json:"category"`           // "major", "minor", "shabbat", "roshchodesh", "fast"
	Candles        bool   `json:"candles"`            // Should light candles
	Yomtov         bool   `json:"yomtov"`             // Is yom tov
	Desc           string `json:"desc,omitempty"`
	HebcalOriginal string `json:"hebcal_original,omitempty"` // Original HebCal event name (for database matching)
}

// DayInfo contains information about a single day
type DayInfo struct {
	Date          string     `json:"date"` // ISO 8601 format
	HebrewDate    HebrewDate `json:"hebrew_date"`
	DayOfWeek     int        `json:"day_of_week"`
	DayNameHebrew string     `json:"day_name_hebrew"`
	DayNameEng    string     `json:"day_name_eng"`
	Holidays      []Holiday  `json:"holidays"`
	IsShabbat     bool       `json:"is_shabbat"`
	IsYomTov      bool       `json:"is_yomtov"`
}

// ShabbatTimes contains Shabbat-specific times
type ShabbatTimes struct {
	CandleLighting string `json:"candle_lighting,omitempty"`
	Havdalah       string `json:"havdalah,omitempty"`
}

// WeekInfo contains a week's worth of day information
type WeekInfo struct {
	StartDate string    `json:"start_date"`
	EndDate   string    `json:"end_date"`
	Days      []DayInfo `json:"days"`
}

// Hebrew day names
var hebrewDayNames = []string{
	"יום ראשון", // Sunday
	"יום שני",   // Monday
	"יום שלישי", // Tuesday
	"יום רביעי", // Wednesday
	"יום חמישי", // Thursday
	"יום שישי",  // Friday
	"שבת קודש",  // Shabbat
}

var englishDayNames = []string{
	"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Shabbat",
}

// Hebrew month names
var hebrewMonthNames = map[hdate.HMonth]string{
	hdate.Nisan:    "ניסן",
	hdate.Iyyar:    "אייר",
	hdate.Sivan:    "סיון",
	hdate.Tamuz:    "תמוז",
	hdate.Av:       "אב",
	hdate.Elul:     "אלול",
	hdate.Tishrei:  "תשרי",
	hdate.Cheshvan: "חשון",
	hdate.Kislev:   "כסלו",
	hdate.Tevet:    "טבת",
	hdate.Shvat:    "שבט",
	hdate.Adar1:    "אדר",
	hdate.Adar2:    "אדר ב׳",
}

// DBAdapter interface for database operations needed by CalendarService
// This interface allows CalendarService to use database queries without
// importing sqlcgen package (avoiding circular dependencies)
type DBAdapter interface {
	MatchHebcalEvent(ctx context.Context, params MatchHebcalEventParams) ([]MatchHebcalEventRow, error)
}

// CalendarService provides Hebrew calendar functionality
type CalendarService struct {
	db DBAdapter // Optional database for tag-driven event matching
}

// NewCalendarService creates a new calendar service without database
// Use this for standalone calendar operations that don't need event tag mapping
func NewCalendarService() *CalendarService {
	return &CalendarService{}
}

// NewCalendarServiceWithDB creates a new calendar service with database integration
// Use this when you need database-driven HebCal event matching to tags
// The db parameter should be created using the adapter in the handlers package
func NewCalendarServiceWithDB(db DBAdapter) *CalendarService {
	return &CalendarService{db: db}
}

// HebrewToGregorian converts a Hebrew date to Gregorian date string
func (s *CalendarService) HebrewToGregorian(yearStr, monthStr, dayStr string) (string, error) {
	var year, month, day int
	_, err := fmt.Sscanf(yearStr, "%d", &year)
	if err != nil {
		return "", fmt.Errorf("invalid year: %s", yearStr)
	}
	_, err = fmt.Sscanf(monthStr, "%d", &month)
	if err != nil {
		return "", fmt.Errorf("invalid month: %s", monthStr)
	}
	_, err = fmt.Sscanf(dayStr, "%d", &day)
	if err != nil {
		return "", fmt.Errorf("invalid day: %s", dayStr)
	}

	// Create Hebrew date and convert to Gregorian
	hd := hdate.New(year, hdate.HMonth(month), day)
	gregorian := hd.Gregorian()
	return gregorian.Format("2006-01-02"), nil
}

// GetHebrewDate converts a Gregorian date to Hebrew date
func (s *CalendarService) GetHebrewDate(date time.Time) HebrewDate {
	hd := hdate.FromTime(date)

	// Format Hebrew string manually
	hebrewMonth := hebrewMonthNames[hd.Month()]
	hebrewStr := fmt.Sprintf("%s %s %d", formatHebrewDay(hd.Day()), hebrewMonth, hd.Year())
	engStr := fmt.Sprintf("%d %s %d", hd.Day(), hd.MonthName("en"), hd.Year())

	return HebrewDate{
		Day:       hd.Day(),
		Month:     hd.MonthName("en"),
		MonthNum:  int(hd.Month()),
		Year:      hd.Year(),
		Hebrew:    hebrewStr,
		Formatted: engStr,
	}
}

// formatHebrewDay formats a day number in Hebrew letters
func formatHebrewDay(day int) string {
	// Simple numeric representation for now
	// In production, use gematriya for full Hebrew numerals
	return fmt.Sprintf("%d", day)
}

// GetDayInfo returns complete information for a given date
func (s *CalendarService) GetDayInfo(date time.Time) DayInfo {
	dow := int(date.Weekday())
	hd := s.GetHebrewDate(date)
	holidays := s.GetHolidays(date)

	// Check if any holiday is yom tov
	isYomTov := false
	for _, h := range holidays {
		if h.Yomtov {
			isYomTov = true
			break
		}
	}

	return DayInfo{
		Date:          date.Format("2006-01-02"),
		HebrewDate:    hd,
		DayOfWeek:     dow,
		DayNameHebrew: hebrewDayNames[dow],
		DayNameEng:    englishDayNames[dow],
		Holidays:      holidays,
		IsShabbat:     dow == 6,
		IsYomTov:      isYomTov,
	}
}

// excludedHolidays are minor observances with no zmanim significance
var excludedHolidays = map[string]bool{
	"Chag HaBanot":           true, // North African daughters' observance
	"Rosh Hashana LaBehemot": true, // New Year for Animal Tithes
}

// GetHolidays returns holidays for a given date (uses Sephardi transliteration by default)
func (s *CalendarService) GetHolidays(date time.Time) []Holiday {
	return s.GetHolidaysWithStyle(date, "")
}

// GetHolidaysWithStyle returns holidays for a given date with specified transliteration style
// transliterationStyle: "ashkenazi" for Ashkenazi transliterations (Shabbos, Sukkos), "" or "sephardi" for Sephardi (Shabbat, Sukkot)
func (s *CalendarService) GetHolidaysWithStyle(date time.Time, transliterationStyle string) []Holiday {
	hd := hdate.FromTime(date)
	year := hd.Year()

	// Get calendar events for the Hebrew year
	// NoModern: true excludes modern Israeli holidays (Yom HaAtzmaut, Yom HaZikaron, etc.)
	opts := hebcal.CalOptions{
		Year:             year,
		IsHebrewYear:     true,
		NoHolidays:       false,
		NoMinorFast:      false,
		NoModern:         true,
		NoRoshChodesh:    false,
		NoSpecialShabbat: false,
		ShabbatMevarchim: true,
	}

	events, _ := hebcal.HebrewCalendar(&opts)

	var holidays []Holiday
	dateStr := date.Format("2006-01-02")

	for _, ev := range events {
		evDate := ev.GetDate().Gregorian()
		if evDate.Format("2006-01-02") == dateStr {
			holiday := eventToHolidayWithStyle(ev, transliterationStyle)
			// Skip excluded holidays that have no zmanim significance
			if excludedHolidays[holiday.Name] {
				continue
			}
			holidays = append(holidays, holiday)
		}
	}

	return holidays
}

// GetWeekInfo returns information for a week starting from the given date
func (s *CalendarService) GetWeekInfo(startDate time.Time) WeekInfo {
	// Adjust to Sunday if not already
	dow := int(startDate.Weekday())
	if dow != 0 {
		startDate = startDate.AddDate(0, 0, -dow)
	}

	days := make([]DayInfo, 7)
	for i := 0; i < 7; i++ {
		date := startDate.AddDate(0, 0, i)
		days[i] = s.GetDayInfo(date)
	}

	endDate := startDate.AddDate(0, 0, 6)

	return WeekInfo{
		StartDate: startDate.Format("2006-01-02"),
		EndDate:   endDate.Format("2006-01-02"),
		Days:      days,
	}
}

// GetShabbatTimes calculates Shabbat candle lighting and havdalah times
func (s *CalendarService) GetShabbatTimes(date time.Time, lat, lon float64, tzName string) ShabbatTimes {
	loc, err := time.LoadLocation(tzName)
	if err != nil {
		loc = time.UTC
	}

	times := ShabbatTimes{}
	dow := date.Weekday()

	// Calculate sunset using simple algorithm
	sunset := calculateSunset(date, lat, lon, loc)

	// Friday - candle lighting (18 minutes before sunset)
	if dow == time.Friday && !sunset.IsZero() {
		candleLighting := sunset.Add(-18 * time.Minute)
		times.CandleLighting = candleLighting.Format("15:04")
	}

	// Saturday - havdalah (42 minutes after sunset)
	if dow == time.Saturday && !sunset.IsZero() {
		havdalah := sunset.Add(42 * time.Minute)
		times.Havdalah = havdalah.Format("15:04")
	}

	return times
}

// calculateSunset is a simple sunset calculation
func calculateSunset(date time.Time, lat, lon float64, loc *time.Location) time.Time {
	// Day of year
	dayOfYear := float64(date.YearDay())

	// Fractional year (gamma)
	gamma := 2 * math.Pi / 365 * (dayOfYear - 1)

	// Equation of time (minutes)
	eqTime := 229.18 * (0.000075 + 0.001868*math.Cos(gamma) - 0.032077*math.Sin(gamma) -
		0.014615*math.Cos(2*gamma) - 0.040849*math.Sin(2*gamma))

	// Solar declination (radians)
	decl := 0.006918 - 0.399912*math.Cos(gamma) + 0.070257*math.Sin(gamma) -
		0.006758*math.Cos(2*gamma) + 0.000907*math.Sin(2*gamma) -
		0.002697*math.Cos(3*gamma) + 0.00148*math.Sin(3*gamma)

	// Hour angle for sunset (degrees)
	latRad := lat * math.Pi / 180
	zenith := 90.833 * math.Pi / 180

	cosHA := (math.Cos(zenith) - math.Sin(latRad)*math.Sin(decl)) / (math.Cos(latRad) * math.Cos(decl))

	if cosHA < -1 || cosHA > 1 {
		return time.Time{} // No sunset (polar regions)
	}

	ha := math.Acos(cosHA) * 180 / math.Pi

	// Sunset time in minutes from midnight UTC
	sunsetMinutes := 720 + 4*(lon+ha) - eqTime

	// Convert to local time
	hours := int(sunsetMinutes / 60)
	mins := int(sunsetMinutes) % 60

	sunset := time.Date(date.Year(), date.Month(), date.Day(), hours, mins, 0, 0, time.UTC)
	return sunset.In(loc)
}

// GetHebrewYearRange returns the start and end Gregorian dates for a Hebrew year
// A Hebrew year starts on 1 Tishrei and ends on 29 Elul (or 30 Elul in a leap year)
func (s *CalendarService) GetHebrewYearRange(hebrewYear int) (start time.Time, end time.Time) {
	// Start: 1 Tishrei of the given Hebrew year
	startHd := hdate.New(hebrewYear, hdate.Tishrei, 1)
	start = startHd.Gregorian()

	// End: 29 Elul of the same Hebrew year (last day before next Rosh Hashana)
	endHd := hdate.New(hebrewYear+1, hdate.Tishrei, 1)
	end = endHd.Gregorian().AddDate(0, 0, -1) // Day before next Rosh Hashana

	return start, end
}

// transformChanukahName normalizes Chanukah holiday names to "Chanukah Day X"
// Hebcal returns two different formats:
// - "Chanukah: X Candles" (days 1-7) where day = candles - 1
// - "Chanukah: 8th Day" (day 8) where day is explicit
func transformChanukahName(name string) string {
	if !strings.Contains(name, "Chanukah") {
		return name
	}

	// Try matching "X Candles" format first (days 1-7)
	matches := chanukahCandleRegex.FindStringSubmatch(name)
	if len(matches) >= 2 {
		candles, err := strconv.Atoi(matches[1])
		if err == nil && candles >= 2 && candles <= 8 {
			return fmt.Sprintf("Chanukah Day %d", candles-1)
		}
	}

	// Try matching "Xth Day" format (day 8)
	matches = chanukahDayRegex.FindStringSubmatch(name)
	if len(matches) >= 2 {
		day, err := strconv.Atoi(matches[1])
		if err == nil && day >= 1 && day <= 8 {
			return fmt.Sprintf("Chanukah Day %d", day)
		}
	}

	return name
}

// stripNiqqud removes Hebrew vowel marks (niqqud) from a string
func stripNiqqud(s string) string {
	return niqqudRegex.ReplaceAllString(s, "")
}

// transformChanukahHebrewName normalizes Hebrew Chanukah holiday names to "חנוכה יום X׳"
// Hebcal returns Hebrew format "חֲנוּכָּה: ח׳ נֵרוֹת" (with niqqud) where ח=8 candles = day 7
func transformChanukahHebrewName(name string) string {
	// Strip niqqud for matching
	stripped := stripNiqqud(name)

	if !strings.Contains(stripped, "חנוכה") {
		return name
	}

	// Try matching "X׳ נרות" format (candles format for days 1-7)
	matches := chanukahHebrewCandleRegex.FindStringSubmatch(stripped)
	if len(matches) >= 2 {
		hebrewLetter := []rune(matches[1])[0]
		if candles, ok := hebrewNumeralMap[hebrewLetter]; ok && candles >= 2 && candles <= 8 {
			day := candles - 1
			if day >= 1 && day <= 8 {
				return fmt.Sprintf("חנוכה יום %s׳", hebrewDayNumerals[day])
			}
		}
	}

	// Try matching "יום X" format (day 8 format)
	matches = chanukahHebrewDayRegex.FindStringSubmatch(stripped)
	if len(matches) >= 2 {
		hebrewLetter := []rune(matches[1])[0]
		if day, ok := hebrewNumeralMap[hebrewLetter]; ok && day >= 1 && day <= 8 {
			return fmt.Sprintf("חנוכה יום %s׳", hebrewDayNumerals[day])
		}
	}

	return name
}

// eventToHoliday converts a hebcal event to our Holiday type (uses Sephardi transliteration)
func eventToHoliday(ev event.CalEvent) Holiday {
	return eventToHolidayWithStyle(ev, "")
}

// eventToHolidayWithStyle converts a hebcal event to our Holiday type with specified transliteration
// transliterationStyle: "ashkenazi" for Ashkenazi (Shabbos, Sukkos), "" or "sephardi" for Sephardi (Shabbat, Sukkot)
func eventToHolidayWithStyle(ev event.CalEvent, transliterationStyle string) Holiday {
	// Use hebcal-go's built-in locale support for transliteration
	locale := "en" // Default: Sephardi
	if transliterationStyle == "ashkenazi" {
		locale = "ashkenazi"
	}

	desc := ev.Render(locale)
	hebrewName := ev.Render("he")
	originalDesc := ev.Render("en") // Always store Sephardi for database matching

	// Transform Chanukah candle count to day number
	desc = transformChanukahName(desc)
	hebrewName = transformChanukahHebrewName(hebrewName)

	// Determine category and properties based on event flags
	category := "minor"
	candles := false
	yomtov := false

	flags := ev.GetFlags()

	if flags&event.MAJOR_FAST != 0 || flags&event.MINOR_FAST != 0 {
		category = "fast"
	} else if flags&event.ROSH_CHODESH != 0 {
		category = "roshchodesh"
	} else if flags&event.SPECIAL_SHABBAT != 0 {
		category = "shabbat"
	} else if flags&event.CHAG != 0 {
		category = "major"
		yomtov = true
		candles = true
	} else if flags&event.LIGHT_CANDLES != 0 || flags&event.LIGHT_CANDLES_TZEIS != 0 {
		candles = true
	}

	return Holiday{
		Name:           desc,
		NameHebrew:     hebrewName,
		Category:       category,
		Candles:        candles,
		Yomtov:         yomtov,
		HebcalOriginal: originalDesc, // Store original (Sephardi) for database matching
	}
}
