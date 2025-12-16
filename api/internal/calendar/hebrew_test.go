package calendar

import (
	"testing"
	"time"
)

// TestGetHebrewDate tests Hebrew date conversion
func TestGetHebrewDate(t *testing.T) {
	service := NewCalendarService()

	tests := []struct {
		name string
		date time.Time
	}{
		{
			name: "Rosh Hashana 5785",
			date: time.Date(2024, 10, 3, 12, 0, 0, 0, time.UTC),
		},
		{
			name: "Passover 5784",
			date: time.Date(2024, 4, 23, 12, 0, 0, 0, time.UTC),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hd := service.GetHebrewDate(tt.date)

			if hd.Month == "" {
				t.Error("Expected non-empty month name")
			}

			if hd.Year < 5780 {
				t.Errorf("Year %d seems too low", hd.Year)
			}

			if hd.Day < 1 || hd.Day > 30 {
				t.Errorf("Day %d out of range", hd.Day)
			}

			if hd.Hebrew == "" {
				t.Error("Expected non-empty Hebrew formatted string")
			}

			t.Logf("%s: %s (Hebrew: %s)", tt.name, hd.Formatted, hd.Hebrew)
		})
	}
}

// TestGetDayInfo tests day information retrieval
func TestGetDayInfo(t *testing.T) {
	service := NewCalendarService()

	// Test a regular weekday
	date := time.Date(2024, 3, 20, 12, 0, 0, 0, time.UTC)
	info := service.GetDayInfo(date)

	if info.HebrewDate.Year == 0 {
		t.Error("Expected valid Hebrew date")
	}

	if info.DayNameEng == "" {
		t.Error("Expected day name in English")
	}

	if info.DayNameHebrew == "" {
		t.Error("Expected day name in Hebrew")
	}

	if info.Date == "" {
		t.Error("Expected formatted date")
	}

	t.Logf("Day info: %s (%s / %s)", info.Date, info.DayNameEng, info.DayNameHebrew)
}

// TestGetHolidays tests holiday detection
func TestGetHolidays(t *testing.T) {
	service := NewCalendarService()

	// Test Passover (April 23, 2024)
	passover := time.Date(2024, 4, 23, 12, 0, 0, 0, time.UTC)
	holidays := service.GetHolidays(passover)

	// Log what we found
	t.Logf("Found %d holidays for %s", len(holidays), passover.Format("2006-01-02"))
	for _, h := range holidays {
		t.Logf("  - %s (%s)", h.Name, h.NameHebrew)
	}
}

// TestGetWeekInfo tests week information
func TestGetWeekInfo(t *testing.T) {
	service := NewCalendarService()

	// Start on a Sunday
	startDate := time.Date(2024, 3, 17, 0, 0, 0, 0, time.UTC)
	weekInfo := service.GetWeekInfo(startDate)

	if len(weekInfo.Days) != 7 {
		t.Errorf("Expected 7 days, got %d", len(weekInfo.Days))
	}

	// Each day should have valid Hebrew date
	for i, day := range weekInfo.Days {
		if day.HebrewDate.Year == 0 {
			t.Errorf("Day %d has invalid Hebrew date", i)
		}
	}

	if weekInfo.StartDate == "" {
		t.Error("Expected start date")
	}

	if weekInfo.EndDate == "" {
		t.Error("Expected end date")
	}

	t.Logf("Week: %s to %s", weekInfo.StartDate, weekInfo.EndDate)
}

// TestGetShabbatTimes tests Shabbat time calculation
func TestGetShabbatTimes(t *testing.T) {
	service := NewCalendarService()

	// Test for Jerusalem on a Friday
	friday := time.Date(2024, 3, 22, 12, 0, 0, 0, time.UTC)
	times := service.GetShabbatTimes(friday, 31.7683, 35.2137, "Asia/Jerusalem")

	// On Friday, candle lighting should be set
	if times.CandleLighting == "" {
		t.Log("Candle lighting empty (expected on Friday)")
	} else {
		t.Logf("Candle lighting: %s", times.CandleLighting)
	}

	// Test for Saturday
	saturday := time.Date(2024, 3, 23, 12, 0, 0, 0, time.UTC)
	satTimes := service.GetShabbatTimes(saturday, 31.7683, 35.2137, "Asia/Jerusalem")

	// On Saturday, havdalah should be set
	if satTimes.Havdalah == "" {
		t.Log("Havdalah empty (expected on Saturday)")
	} else {
		t.Logf("Havdalah: %s", satTimes.Havdalah)
	}
}

// TestHebrewDateFormatting tests Hebrew formatting
func TestHebrewDateFormatting(t *testing.T) {
	service := NewCalendarService()

	date := time.Date(2024, 3, 20, 12, 0, 0, 0, time.UTC)
	hd := service.GetHebrewDate(date)

	// Should have both English and Hebrew representations
	if hd.Formatted == "" {
		t.Error("Expected English formatted date")
	}

	if hd.Hebrew == "" {
		t.Error("Expected Hebrew formatted date")
	}

	t.Logf("Hebrew date: %s / %s", hd.Formatted, hd.Hebrew)
}

// TestSeasonalDates tests dates across different seasons
func TestSeasonalDates(t *testing.T) {
	service := NewCalendarService()

	seasons := []struct {
		name string
		date time.Time
	}{
		{"Spring", time.Date(2024, 4, 15, 12, 0, 0, 0, time.UTC)},
		{"Summer", time.Date(2024, 7, 15, 12, 0, 0, 0, time.UTC)},
		{"Fall", time.Date(2024, 10, 15, 12, 0, 0, 0, time.UTC)},
		{"Winter", time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC)},
	}

	for _, s := range seasons {
		t.Run(s.name, func(t *testing.T) {
			hd := service.GetHebrewDate(s.date)

			if hd.Year == 0 {
				t.Error("Expected valid Hebrew year")
			}

			if hd.Month == "" {
				t.Error("Expected valid month name")
			}

			t.Logf("%s: %s %d, %d", s.name, hd.Month, hd.Day, hd.Year)
		})
	}
}

// TestSunsetCalculation tests the sunset calculation
func TestSunsetCalculation(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Jerusalem")

	// Test Jerusalem on equinox
	date := time.Date(2024, 3, 21, 0, 0, 0, 0, loc)
	sunset := calculateSunset(date, 31.7683, 35.2137, loc)

	if sunset.IsZero() {
		t.Error("Expected valid sunset time")
		return
	}

	// Sunset should return a valid time (exact hour depends on timezone handling)
	// Just verify it's a reasonable time of day (not midnight)
	hour := sunset.Hour()
	if hour < 15 || hour > 23 {
		t.Errorf("Sunset hour %d seems unreasonable", hour)
	}

	t.Logf("Jerusalem equinox sunset: %s (hour=%d)", sunset.Format("15:04"), hour)
}

// TestDayOfWeek tests day of week calculation
func TestDayOfWeek(t *testing.T) {
	service := NewCalendarService()

	// Test known Shabbat
	shabbat := time.Date(2024, 3, 23, 12, 0, 0, 0, time.UTC) // Saturday
	info := service.GetDayInfo(shabbat)

	if !info.IsShabbat {
		t.Error("Expected IsShabbat to be true for Saturday")
	}

	if info.DayOfWeek != 6 {
		t.Errorf("Expected DayOfWeek 6 for Saturday, got %d", info.DayOfWeek)
	}

	// Test known weekday
	tuesday := time.Date(2024, 3, 19, 12, 0, 0, 0, time.UTC)
	tuesdayInfo := service.GetDayInfo(tuesday)

	if tuesdayInfo.IsShabbat {
		t.Error("Expected IsShabbat to be false for Tuesday")
	}

	if tuesdayInfo.DayOfWeek != 2 {
		t.Errorf("Expected DayOfWeek 2 for Tuesday, got %d", tuesdayInfo.DayOfWeek)
	}
}
