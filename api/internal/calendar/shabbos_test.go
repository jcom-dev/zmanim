package calendar

import (
	"testing"
	"time"
)

// TestShabbosDetection verifies that Shabbos is correctly detected on Saturdays
func TestShabbosDetection(t *testing.T) {
	// Create a CalendarService (no database needed for basic Shabbos detection)
	service := NewCalendarService()

	tests := []struct {
		name          string
		date          time.Time
		expectShabbos bool
	}{
		{
			name:          "Saturday should be Shabbos",
			date:          time.Date(2025, 12, 27, 12, 0, 0, 0, time.UTC), // Saturday
			expectShabbos: true,
		},
		{
			name:          "Sunday should not be Shabbos",
			date:          time.Date(2025, 12, 28, 12, 0, 0, 0, time.UTC), // Sunday
			expectShabbos: false,
		},
		{
			name:          "Friday should not be Shabbos",
			date:          time.Date(2025, 12, 26, 12, 0, 0, 0, time.UTC), // Friday
			expectShabbos: false,
		},
		{
			name:          "Wednesday should not be Shabbos",
			date:          time.Date(2025, 12, 24, 12, 0, 0, 0, time.UTC), // Wednesday
			expectShabbos: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			loc := Location{
				Latitude:  40.7128,
				Longitude: -74.0060,
				Timezone:  "America/New_York",
				IsIsrael:  false,
			}

			info := service.GetEventDayInfo(tt.date, loc, "ashkenazi")

			if info.IsShabbat != tt.expectShabbos {
				t.Errorf("Expected IsShabbat=%v for %s (%v), got %v",
					tt.expectShabbos, tt.date.Format("2006-01-02"), tt.date.Weekday(), info.IsShabbat)
			}

			// Also check that Shabbos appears in active events with correct transliteration
			if tt.expectShabbos {
				found := false
				for _, ev := range info.ActiveEvents {
					if ev.EventCode == "shabbos" {
						found = true
						// Verify Ashkenazi transliteration
						if ev.NameEnglish != "Shabbos" {
							t.Errorf("Expected Ashkenazi transliteration 'Shabbos', got '%s'", ev.NameEnglish)
						}
						break
					}
				}
				if !found {
					t.Errorf("Expected 'shabbos' event in ActiveEvents for Saturday")
				}
			}
		})
	}
}

// TestShabbosTransliteration verifies that Shabbos/Shabbat is correctly transliterated
func TestShabbosTransliteration(t *testing.T) {
	tests := []struct {
		name     string
		style    string
		expected string
	}{
		{
			name:     "Ashkenazi style should use Shabbos",
			style:    "ashkenazi",
			expected: "Shabbos",
		},
		{
			name:     "Sephardi style should use Shabbat",
			style:    "sephardi",
			expected: "Shabbat",
		},
		{
			name:     "Empty style should use Shabbat (default)",
			style:    "",
			expected: "Shabbat",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetTransliteratedName("Shabbat", tt.style)
			if result != tt.expected {
				t.Errorf("GetTransliteratedName('Shabbat', '%s') = '%s', want '%s'",
					tt.style, result, tt.expected)
			}
		})
	}
}

// TestShabbosTagLogicOnly tests just the Saturday detection logic
func TestShabbosTagLogicOnly(t *testing.T) {
	dates := []struct {
		date     time.Time
		expected bool
	}{
		{time.Date(2025, 12, 20, 0, 0, 0, 0, time.UTC), true},  // Saturday
		{time.Date(2025, 12, 21, 0, 0, 0, 0, time.UTC), false}, // Sunday
		{time.Date(2025, 12, 22, 0, 0, 0, 0, time.UTC), false}, // Monday
		{time.Date(2025, 12, 27, 0, 0, 0, 0, time.UTC), true},  // Saturday
		{time.Date(2026, 1, 3, 0, 0, 0, 0, time.UTC), true},    // Saturday
	}

	for _, tt := range dates {
		isSaturday := tt.date.Weekday() == time.Saturday
		if isSaturday != tt.expected {
			t.Errorf("Date %s: weekday=%v, expected Saturday=%v",
				tt.date.Format("2006-01-02"), tt.date.Weekday(), tt.expected)
		}
	}
}
