package calendar

import (
	"strings"
	"testing"
	"time"
)

// TestEventCoverage validates that we have database patterns for all hebcal-go events
// This test ensures 100% coverage of all events that hebcal-go can generate
// TODO: Re-enable once database integration is complete
func _TestEventCoverage_Disabled(t *testing.T) {
	t.Skip("Disabled pending database integration")
}

// TestSpecificDates validates event detection for specific known dates
func TestSpecificDates(t *testing.T) {
	tests := []struct {
		name            string
		date            string // YYYY-MM-DD
		isIsrael        bool
		expectedEvents  []string // Expected event codes
		expectedShabbat bool
	}{
		{
			name:           "Regular Weekday",
			date:           "2025-01-15", // Wednesday
			isIsrael:       false,
			expectedEvents: []string{},
			expectedShabbat: false,
		},
		{
			name:           "Shabbat",
			date:           "2025-01-18", // Saturday
			isIsrael:       false,
			expectedEvents: []string{}, // Just Shabbat
			expectedShabbat: true,
		},
		{
			name:           "Asarah B'Tevet",
			date:           "2025-01-10", // 10 Tevet 5785
			isIsrael:       false,
			expectedEvents: []string{"asarah_bteves"},
			expectedShabbat: false,
		},
		{
			name:           "Rosh Hashana Day 1",
			date:           "2025-09-23", // 1 Tishrei 5786
			isIsrael:       false,
			expectedEvents: []string{"rosh_hashanah"},
			expectedShabbat: false,
		},
		{
			name:           "Rosh Hashana Day 2",
			date:           "2025-09-24", // 2 Tishrei 5786
			isIsrael:       false,
			expectedEvents: []string{"rosh_hashanah"},
			expectedShabbat: false,
		},
		{
			name:           "Yom Kippur",
			date:           "2025-10-02", // 10 Tishrei 5786
			isIsrael:       false,
			expectedEvents: []string{"yom_kippur"},
			expectedShabbat: false,
		},
		{
			name:           "Sukkot I - Diaspora",
			date:           "2025-10-07", // 15 Tishrei 5786
			isIsrael:       false,
			expectedEvents: []string{"sukkos"},
			expectedShabbat: false,
		},
		{
			name:           "Sukkot II - Diaspora",
			date:           "2025-10-08", // 16 Tishrei 5786
			isIsrael:       false,
			expectedEvents: []string{"sukkos"},
			expectedShabbat: false,
		},
		{
			name:           "Sukkot I - Israel",
			date:           "2025-10-07", // 15 Tishrei 5786
			isIsrael:       true,
			expectedEvents: []string{"sukkos"},
			expectedShabbat: false,
		},
		{
			name:           "Sukkot II (Chol HaMoed) - Israel",
			date:           "2025-10-08", // 16 Tishrei 5786
			isIsrael:       true,
			expectedEvents: []string{"chol_hamoed_sukkos"},
			expectedShabbat: false,
		},
		{
			name:           "Chol HaMoed Sukkot Day 3",
			date:           "2025-10-11", // 19 Tishrei 5786
			isIsrael:       false,
			expectedEvents: []string{"chol_hamoed_sukkos"},
			expectedShabbat: false,
		},
		{
			name:           "Hoshana Raba",
			date:           "2025-10-13", // 21 Tishrei 5786
			isIsrael:       false,
			expectedEvents: []string{"hoshanah_rabbah"},
			expectedShabbat: false,
		},
		{
			name:           "Shemini Atzeret - Diaspora",
			date:           "2025-10-14", // 22 Tishrei 5786
			isIsrael:       false,
			expectedEvents: []string{"shemini_atzeres"},
			expectedShabbat: false,
		},
		{
			name:           "Simchat Torah - Diaspora",
			date:           "2025-10-15", // 23 Tishrei 5786
			isIsrael:       false,
			expectedEvents: []string{"shemini_atzeres"}, // Day 2 in diaspora
			expectedShabbat: false,
		},
		{
			name:           "Shemini Atzeret/Simchat Torah - Israel",
			date:           "2025-10-14", // 22 Tishrei 5786
			isIsrael:       true,
			expectedEvents: []string{"shemini_atzeres"},
			expectedShabbat: false,
		},
		{
			name:           "Chanukah Day 1",
			date:           "2025-12-15", // 25 Kislev 5786
			isIsrael:       false,
			expectedEvents: []string{"chanukah"},
			expectedShabbat: false,
		},
		{
			name:           "Chanukah Day 5",
			date:           "2025-12-19", // 29 Kislev 5786
			isIsrael:       false,
			expectedEvents: []string{"chanukah"},
			expectedShabbat: false,
		},
		{
			name:           "Pesach I - Diaspora",
			date:           "2025-04-13", // 15 Nisan 5785
			isIsrael:       false,
			expectedEvents: []string{"pesach_first"},
			expectedShabbat: false,
		},
		{
			name:           "Pesach II - Diaspora",
			date:           "2025-04-14", // 16 Nisan 5785
			isIsrael:       false,
			expectedEvents: []string{"pesach_first"},
			expectedShabbat: false,
		},
		{
			name:           "Pesach I - Israel",
			date:           "2025-04-13", // 15 Nisan 5785
			isIsrael:       true,
			expectedEvents: []string{"pesach_first"},
			expectedShabbat: false,
		},
		{
			name:           "Pesach II (Chol HaMoed) - Israel",
			date:           "2025-04-14", // 16 Nisan 5785
			isIsrael:       true,
			expectedEvents: []string{"chol_hamoed_pesach"},
			expectedShabbat: false,
		},
		{
			name:           "Chol HaMoed Pesach",
			date:           "2025-04-16", // 18 Nisan 5785
			isIsrael:       false,
			expectedEvents: []string{"chol_hamoed_pesach"},
			expectedShabbat: false,
		},
		{
			name:           "Pesach VII - Diaspora",
			date:           "2025-04-19", // 21 Nisan 5785
			isIsrael:       false,
			expectedEvents: []string{"pesach_last"},
			expectedShabbat: false,
		},
		{
			name:           "Pesach VIII - Diaspora",
			date:           "2025-04-20", // 22 Nisan 5785
			isIsrael:       false,
			expectedEvents: []string{"pesach_last"},
			expectedShabbat: false,
		},
		{
			name:           "Pesach VII - Israel",
			date:           "2025-04-19", // 21 Nisan 5785
			isIsrael:       true,
			expectedEvents: []string{"pesach_last"},
			expectedShabbat: false,
		},
		{
			name:           "Shavuot - Israel",
			date:           "2025-06-02", // 6 Sivan 5785
			isIsrael:       true,
			expectedEvents: []string{"shavuos"},
			expectedShabbat: false,
		},
		{
			name:           "Shavuot Day I - Diaspora",
			date:           "2025-06-02", // 6 Sivan 5785
			isIsrael:       false,
			expectedEvents: []string{"shavuos"},
			expectedShabbat: false,
		},
		{
			name:           "Shavuot Day II - Diaspora",
			date:           "2025-06-03", // 7 Sivan 5785
			isIsrael:       false,
			expectedEvents: []string{"shavuos"},
			expectedShabbat: false,
		},
		{
			name:           "Tisha B'Av",
			date:           "2025-08-03", // 9 Av 5785
			isIsrael:       false,
			expectedEvents: []string{"tisha_bav"},
			expectedShabbat: false,
		},
		{
			name:           "Tzom Gedaliah",
			date:           "2025-09-25", // 3 Tishrei 5786
			isIsrael:       false,
			expectedEvents: []string{"tzom_gedaliah"},
			expectedShabbat: false,
		},
		{
			name:           "Ta'anit Esther",
			date:           "2025-03-13", // 13 Adar 5785
			isIsrael:       false,
			expectedEvents: []string{"taanis_esther"},
			expectedShabbat: false,
		},
		{
			name:           "Purim",
			date:           "2025-03-14", // 14 Adar 5785
			isIsrael:       false,
			expectedEvents: []string{"purim"},
			expectedShabbat: false,
		},
		{
			name:           "Shushan Purim",
			date:           "2025-03-15", // 15 Adar 5785
			isIsrael:       false,
			expectedEvents: []string{"shushan_purim"},
			expectedShabbat: false,
		},
		{
			name:           "Rosh Chodesh",
			date:           "2025-01-30", // 1 Shevat 5785
			isIsrael:       false,
			expectedEvents: []string{"rosh_chodesh"},
			expectedShabbat: false,
		},
	}

	service := &CalendarService{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			date, err := time.Parse("2006-01-02", tt.date)
			if err != nil {
				t.Fatalf("Invalid test date: %v", err)
			}

			loc := Location{
				Latitude:  40.7128, // Default to NYC
				Longitude: -74.0060,
				Timezone:  "America/New_York",
				IsIsrael:  tt.isIsrael,
			}

			if tt.isIsrael {
				loc.Latitude = 31.7683
				loc.Longitude = 35.2137
				loc.Timezone = "Asia/Jerusalem"
			}

			info := service.GetEventDayInfo(date, loc, "")

			// Check Shabbat
			if info.IsShabbat != tt.expectedShabbat {
				t.Errorf("IsShabbat = %v, want %v", info.IsShabbat, tt.expectedShabbat)
			}

			// Collect all event codes from ActiveEvents
			actualCodes := make(map[string]bool)
			for _, ev := range info.ActiveEvents {
				if ev.EventCode != "shabbos" { // Skip Shabbat for event comparison
					actualCodes[ev.EventCode] = true
				}
			}

			// Check expected events
			for _, expectedCode := range tt.expectedEvents {
				if !actualCodes[expectedCode] {
					t.Errorf("Expected event code %q not found. Got events: %v", expectedCode, info.ActiveEvents)
				}
			}

			// Check for unexpected events
			for actualCode := range actualCodes {
				found := false
				for _, expectedCode := range tt.expectedEvents {
					if actualCode == expectedCode {
						found = true
						break
					}
				}
				if !found && actualCode != "shabbos" {
					t.Errorf("Unexpected event code %q found", actualCode)
				}
			}
		})
	}
}

// TestMultiDayEvents validates that multi-day events report correct day numbers
func TestMultiDayEvents(t *testing.T) {
	tests := []struct {
		name         string
		date         string
		isIsrael     bool
		expectedCode string
		expectedDay  int
		expectedTotal int
	}{
		{
			name:         "Rosh Hashana Day 1",
			date:         "2025-09-23",
			isIsrael:     false,
			expectedCode: "rosh_hashanah",
			expectedDay:  1,
			expectedTotal: 2,
		},
		{
			name:         "Rosh Hashana Day 2",
			date:         "2025-09-24",
			isIsrael:     false,
			expectedCode: "rosh_hashanah",
			expectedDay:  2,
			expectedTotal: 2,
		},
		{
			name:         "Chanukah Day 1",
			date:         "2025-12-15",
			isIsrael:     false,
			expectedCode: "chanukah",
			expectedDay:  1,
			expectedTotal: 8,
		},
		{
			name:         "Chanukah Day 5",
			date:         "2025-12-19",
			isIsrael:     false,
			expectedCode: "chanukah",
			expectedDay:  5,
			expectedTotal: 8,
		},
		{
			name:         "Chanukah Day 8",
			date:         "2025-12-22",
			isIsrael:     false,
			expectedCode: "chanukah",
			expectedDay:  8,
			expectedTotal: 8,
		},
		{
			name:         "Sukkot Day 1 - Diaspora",
			date:         "2025-10-07",
			isIsrael:     false,
			expectedCode: "sukkos",
			expectedDay:  1,
			expectedTotal: 2,
		},
		{
			name:         "Sukkot Day 2 - Diaspora",
			date:         "2025-10-08",
			isIsrael:     false,
			expectedCode: "sukkos",
			expectedDay:  2,
			expectedTotal: 2,
		},
		{
			name:         "Sukkot Day 1 - Israel",
			date:         "2025-10-07",
			isIsrael:     true,
			expectedCode: "sukkos",
			expectedDay:  1,
			expectedTotal: 1,
		},
		{
			name:         "Pesach I - Diaspora",
			date:         "2025-04-13",
			isIsrael:     false,
			expectedCode: "pesach_first",
			expectedDay:  1,
			expectedTotal: 2,
		},
		{
			name:         "Pesach II - Diaspora",
			date:         "2025-04-14",
			isIsrael:     false,
			expectedCode: "pesach_first",
			expectedDay:  2,
			expectedTotal: 2,
		},
		{
			name:         "Pesach VII - Diaspora",
			date:         "2025-04-19",
			isIsrael:     false,
			expectedCode: "pesach_last",
			expectedDay:  1,
			expectedTotal: 2,
		},
		{
			name:         "Pesach VIII - Diaspora",
			date:         "2025-04-20",
			isIsrael:     false,
			expectedCode: "pesach_last",
			expectedDay:  2,
			expectedTotal: 2,
		},
	}

	service := &CalendarService{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			date, err := time.Parse("2006-01-02", tt.date)
			if err != nil {
				t.Fatalf("Invalid test date: %v", err)
			}

			loc := Location{
				Latitude:  40.7128,
				Longitude: -74.0060,
				Timezone:  "America/New_York",
				IsIsrael:  tt.isIsrael,
			}

			if tt.isIsrael {
				loc.Latitude = 31.7683
				loc.Longitude = 35.2137
				loc.Timezone = "Asia/Jerusalem"
			}

			info := service.GetEventDayInfo(date, loc, "")

			// Find the expected event
			var foundEvent *ActiveEvent
			for i, ev := range info.ActiveEvents {
				if ev.EventCode == tt.expectedCode {
					foundEvent = &info.ActiveEvents[i]
					break
				}
			}

			if foundEvent == nil {
				t.Fatalf("Event code %q not found in ActiveEvents", tt.expectedCode)
			}

			if foundEvent.DayNumber != tt.expectedDay {
				t.Errorf("DayNumber = %d, want %d", foundEvent.DayNumber, tt.expectedDay)
			}

			if foundEvent.TotalDays != tt.expectedTotal {
				t.Errorf("TotalDays = %d, want %d", foundEvent.TotalDays, tt.expectedTotal)
			}

			expectedFinal := (foundEvent.DayNumber == foundEvent.TotalDays)
			if foundEvent.IsFinalDay != expectedFinal {
				t.Errorf("IsFinalDay = %v, want %v", foundEvent.IsFinalDay, expectedFinal)
			}
		})
	}
}

// TestErevEvents validates that erev events are correctly detected
func TestErevEvents(t *testing.T) {
	tests := []struct {
		name         string
		date         string
		isIsrael     bool
		expectedErev []string
	}{
		{
			name:         "Friday (Erev Shabbos)",
			date:         "2025-01-17",
			isIsrael:     false,
			expectedErev: []string{"shabbos"},
		},
		{
			name:         "Erev Pesach",
			date:         "2025-04-12", // 14 Nisan
			isIsrael:     false,
			expectedErev: []string{"pesach_first"},
		},
		{
			name:         "Erev Yom Kippur",
			date:         "2025-10-01", // 9 Tishrei
			isIsrael:     false,
			expectedErev: []string{"yom_kippur"},
		},
		{
			name:         "Erev Rosh Hashana",
			date:         "2025-09-22", // 29 Elul
			isIsrael:     false,
			expectedErev: []string{"rosh_hashanah"},
		},
	}

	service := &CalendarService{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			date, err := time.Parse("2006-01-02", tt.date)
			if err != nil {
				t.Fatalf("Invalid test date: %v", err)
			}

			loc := Location{
				Latitude:  40.7128,
				Longitude: -74.0060,
				Timezone:  "America/New_York",
				IsIsrael:  tt.isIsrael,
			}

			if tt.isIsrael {
				loc.Latitude = 31.7683
				loc.Longitude = 35.2137
				loc.Timezone = "Asia/Jerusalem"
			}

			info := service.GetEventDayInfo(date, loc, "")

			actualErev := make(map[string]bool)
			for _, ev := range info.ErevEvents {
				actualErev[ev.EventCode] = true
			}

			for _, expectedCode := range tt.expectedErev {
				if !actualErev[expectedCode] {
					t.Errorf("Expected erev event %q not found. Got: %v", expectedCode, info.ErevEvents)
				}
			}
		})
	}
}

// TestFastDays validates fast day detection and properties
func TestFastDays(t *testing.T) {
	tests := []struct {
		name          string
		date          string
		expectedFast  bool
		expectedStart string // "dawn" or "sunset"
	}{
		{
			name:          "Yom Kippur",
			date:          "2025-10-02",
			expectedFast:  true,
			expectedStart: "sunset",
		},
		{
			name:          "Tisha B'Av",
			date:          "2025-08-03",
			expectedFast:  true,
			expectedStart: "sunset",
		},
		{
			name:          "Tzom Gedaliah",
			date:          "2025-09-25",
			expectedFast:  true,
			expectedStart: "dawn",
		},
		{
			name:          "Asara B'Tevet",
			date:          "2025-01-10",
			expectedFast:  true,
			expectedStart: "dawn",
		},
		{
			name:          "Ta'anit Esther",
			date:          "2025-03-13",
			expectedFast:  true,
			expectedStart: "dawn",
		},
		{
			name:          "Shiva Asar B'Tammuz",
			date:          "2025-07-13",
			expectedFast:  true,
			expectedStart: "dawn",
		},
	}

	service := &CalendarService{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			date, err := time.Parse("2006-01-02", tt.date)
			if err != nil {
				t.Fatalf("Invalid test date: %v", err)
			}

			loc := Location{
				Latitude:  40.7128,
				Longitude: -74.0060,
				Timezone:  "America/New_York",
				IsIsrael:  false,
			}

			info := service.GetEventDayInfo(date, loc, "")

			if info.IsFastDay != tt.expectedFast {
				t.Errorf("IsFastDay = %v, want %v", info.IsFastDay, tt.expectedFast)
			}

			// Check that at least one active event has the correct fast start type
			if tt.expectedFast {
				foundFast := false
				for _, ev := range info.ActiveEvents {
					if ev.FastStartType != "" {
						foundFast = true
						if ev.FastStartType != tt.expectedStart {
							t.Errorf("FastStartType = %q, want %q", ev.FastStartType, tt.expectedStart)
						}
					}
				}
				if !foundFast {
					t.Errorf("No fast event found with FastStartType")
				}
			}
		})
	}
}

// TestIsraelDiasporaDifferences validates Israel vs Diaspora differences
func TestIsraelDiasporaDifferences(t *testing.T) {
	tests := []struct {
		name           string
		date           string
		israelEvent    string
		israelDayNum   int
		israelTotal    int
		diasporaEvent  string
		diasporaDayNum int
		diasporaTotal  int
	}{
		{
			name:           "Sukkot Day 1",
			date:           "2025-10-07",
			israelEvent:    "sukkos",
			israelDayNum:   1,
			israelTotal:    1,
			diasporaEvent:  "sukkos",
			diasporaDayNum: 1,
			diasporaTotal:  2,
		},
		{
			name:           "Sukkot Day 2",
			date:           "2025-10-08",
			israelEvent:    "chol_hamoed_sukkos",
			israelDayNum:   1,
			israelTotal:    1,
			diasporaEvent:  "sukkos",
			diasporaDayNum: 2,
			diasporaTotal:  2,
		},
		{
			name:           "Pesach Day 1",
			date:           "2025-04-13",
			israelEvent:    "pesach_first",
			israelDayNum:   1,
			israelTotal:    1,
			diasporaEvent:  "pesach_first",
			diasporaDayNum: 1,
			diasporaTotal:  2,
		},
		{
			name:           "Shavuot",
			date:           "2025-06-02",
			israelEvent:    "shavuos",
			israelDayNum:   1,
			israelTotal:    1,
			diasporaEvent:  "shavuos",
			diasporaDayNum: 1,
			diasporaTotal:  2,
		},
	}

	service := &CalendarService{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			date, err := time.Parse("2006-01-02", tt.date)
			if err != nil {
				t.Fatalf("Invalid test date: %v", err)
			}

			// Test Israel
			israelLoc := Location{
				Latitude:  31.7683,
				Longitude: 35.2137,
				Timezone:  "Asia/Jerusalem",
				IsIsrael:  true,
			}

			israelInfo := service.GetEventDayInfo(date, israelLoc, "")
			var israelFound *ActiveEvent
			for i, ev := range israelInfo.ActiveEvents {
				if strings.Contains(ev.EventCode, "sukkos") || strings.Contains(ev.EventCode, "pesach") || strings.Contains(ev.EventCode, "shavuos") {
					israelFound = &israelInfo.ActiveEvents[i]
					break
				}
			}

			if israelFound == nil {
				t.Fatalf("Israel: Expected event not found")
			}

			if israelFound.EventCode != tt.israelEvent {
				t.Errorf("Israel: EventCode = %q, want %q", israelFound.EventCode, tt.israelEvent)
			}
			if israelFound.DayNumber != tt.israelDayNum {
				t.Errorf("Israel: DayNumber = %d, want %d", israelFound.DayNumber, tt.israelDayNum)
			}
			if israelFound.TotalDays != tt.israelTotal {
				t.Errorf("Israel: TotalDays = %d, want %d", israelFound.TotalDays, tt.israelTotal)
			}

			// Test Diaspora
			diasporaLoc := Location{
				Latitude:  40.7128,
				Longitude: -74.0060,
				Timezone:  "America/New_York",
				IsIsrael:  false,
			}

			diasporaInfo := service.GetEventDayInfo(date, diasporaLoc, "")
			var diasporaFound *ActiveEvent
			for i, ev := range diasporaInfo.ActiveEvents {
				if strings.Contains(ev.EventCode, "sukkos") || strings.Contains(ev.EventCode, "pesach") || strings.Contains(ev.EventCode, "shavuos") {
					diasporaFound = &diasporaInfo.ActiveEvents[i]
					break
				}
			}

			if diasporaFound == nil {
				t.Fatalf("Diaspora: Expected event not found")
			}

			if diasporaFound.EventCode != tt.diasporaEvent {
				t.Errorf("Diaspora: EventCode = %q, want %q", diasporaFound.EventCode, tt.diasporaEvent)
			}
			if diasporaFound.DayNumber != tt.diasporaDayNum {
				t.Errorf("Diaspora: DayNumber = %d, want %d", diasporaFound.DayNumber, tt.diasporaDayNum)
			}
			if diasporaFound.TotalDays != tt.diasporaTotal {
				t.Errorf("Diaspora: TotalDays = %d, want %d", diasporaFound.TotalDays, tt.diasporaTotal)
			}
		})
	}
}
