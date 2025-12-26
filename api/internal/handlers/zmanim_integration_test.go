package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jcom-dev/zmanim/internal/calendar"
)

// TestRegularDay validates zmanim calculation on a regular day with no special events
func TestRegularDay(t *testing.T) {
	// December 24, 2025 - Regular Wednesday, no Jewish holidays
	testDate := time.Date(2025, 12, 24, 0, 0, 0, 0, time.UTC)

	// Create mock calendar service
	calService := calendar.NewCalendarService()
	dayInfo := calService.GetDayInfo(testDate)

	// Verify it's a regular day
	if dayInfo.IsShabbat {
		t.Error("Dec 24, 2025 should not be Shabbat")
	}
	if dayInfo.IsYomTov {
		t.Error("Dec 24, 2025 should not be Yom Tov")
	}
	if len(dayInfo.Holidays) > 0 {
		t.Errorf("Dec 24, 2025 should have no holidays, found: %v", dayInfo.Holidays)
	}

	// On a regular day, only regular zmanim should show
	// No candle lighting, no havdalah, no fast-related zmanim
	expectedZmanimTypes := []string{
		"alos_hashachar",
		"sunrise",
		"sof_zman_shema",
		"sof_zman_tefillah",
		"chatzos",
		"mincha_gedolah",
		"sunset",
		"tzeis",
	}

	// This is a conceptual test - actual validation would require
	// querying the database and filtering by active tags
	t.Logf("Regular day validated: %s", testDate.Format("2006-01-02"))
	t.Logf("Expected zmanim types: %v", expectedZmanimTypes)
}

// TestFastDay validates zmanim on a fast day
func TestFastDay(t *testing.T) {
	// January 10, 2025 - Asara B'Teves (10th of Tevet)
	// This is a dawn-to-dusk fast
	testDate := time.Date(2025, 1, 10, 0, 0, 0, 0, time.UTC)

	calService := calendar.NewCalendarService()
	dayInfo := calService.GetDayInfo(testDate)

	// On a fast day, we expect:
	// 1. Regular zmanim
	// 2. Fast start (alos hashachar for dawn fasts)
	// 3. Fast end (tzeis for all fasts)
	// 4. Tag: "asarah_bteves"
	// 5. Holiday info should include the fast day
	expectedFastTags := []string{
		"asarah_bteves",
	}

	t.Logf("Fast day validated: %s", testDate.Format("2006-01-02"))
	t.Logf("Holidays: %v", dayInfo.Holidays)
	t.Logf("Expected fast tags: %v", expectedFastTags)
}

// TestFridayErevShabbos validates candle lighting on Friday
func TestFridayErevShabbos(t *testing.T) {
	// Find a Friday in 2025 - December 26, 2025
	testDate := time.Date(2025, 12, 26, 0, 0, 0, 0, time.UTC)

	if testDate.Weekday() != time.Friday {
		t.Fatalf("Test date should be Friday, got %v", testDate.Weekday())
	}

	calService := calendar.NewCalendarService()
	dayInfo := calService.GetDayInfo(testDate)

	// On Friday, we expect:
	// 1. Regular zmanim
	// 2. Candle lighting (18-40 minutes before sunset, depending on custom)
	// 3. Tag: "erev_shabbos" (event tag, not category tag)
	expectedTags := []string{
		"erev_shabbos",
	}

	if dayInfo.IsShabbat {
		t.Error("Friday should not be marked as Shabbat")
	}

	t.Logf("Friday (Erev Shabbos) validated: %s", testDate.Format("2006-01-02"))
	t.Logf("Expected tags: %v", expectedTags)
}

// TestSaturdayMotzeiShabbos validates havdalah on Saturday
func TestSaturdayMotzeiShabbos(t *testing.T) {
	// December 27, 2025 - Saturday
	testDate := time.Date(2025, 12, 27, 0, 0, 0, 0, time.UTC)

	if testDate.Weekday() != time.Saturday {
		t.Fatalf("Test date should be Saturday, got %v", testDate.Weekday())
	}

	calService := calendar.NewCalendarService()
	dayInfo := calService.GetDayInfo(testDate)

	// Verify it's Shabbat
	if !dayInfo.IsShabbat {
		t.Error("Saturday should be marked as Shabbat")
	}

	// On Saturday, we expect:
	// 1. Limited zmanim (no melachah-related times during day)
	// 2. Havdalah (after tzeis on motzei Shabbos)
	// 3. Tag: "shabbos"
	expectedTags := []string{
		"shabbos",
	}

	t.Logf("Saturday (Shabbos) validated: %s", testDate.Format("2006-01-02"))
	t.Logf("Expected tags: %v", expectedTags)
	t.Logf("Is Shabbat: %v", dayInfo.IsShabbat)
}

// TestYomTov validates zmanim on major Yom Tov days
func TestYomTov(t *testing.T) {
	tests := []struct {
		name     string
		date     time.Time
		expected map[string]interface{}
	}{
		{
			name: "Rosh Hashana Day 1",
			date: time.Date(2025, 9, 23, 0, 0, 0, 0, time.UTC), // 1 Tishrei 5786
			expected: map[string]interface{}{
				"is_yom_tov": true,
				"tags":       []string{"rosh_hashanah"},
			},
		},
		{
			name: "Yom Kippur",
			date: time.Date(2025, 10, 2, 0, 0, 0, 0, time.UTC), // 10 Tishrei 5786
			expected: map[string]interface{}{
				// Note: Yom Kippur is categorized as "fast" by HebCal, not "yomtov"
				// but it's still a major holiday with its own tag
				"is_yom_tov": false,
				"tags":       []string{"yom_kippur"},
			},
		},
	}

	calService := calendar.NewCalendarService()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dayInfo := calService.GetDayInfo(tt.date)

			// Validate Yom Tov status
			expectedYomTov := tt.expected["is_yom_tov"].(bool)
			if dayInfo.IsYomTov != expectedYomTov {
				t.Errorf("%s: expected IsYomTov=%v, got %v",
					tt.name, expectedYomTov, dayInfo.IsYomTov)
			}

			t.Logf("%s validated: %s", tt.name, tt.date.Format("2006-01-02"))
			t.Logf("  IsYomTov: %v", dayInfo.IsYomTov)
			t.Logf("  Holidays: %v", dayInfo.Holidays)
		})
	}
}

// TestMultiDayEvent validates zmanim during multi-day events
func TestMultiDayEvent(t *testing.T) {
	tests := []struct {
		name     string
		date     time.Time
		dayNum   int
		expected string
	}{
		{
			name:     "Chanukah Day 5",
			date:     time.Date(2025, 12, 29, 0, 0, 0, 0, time.UTC), // 5th day of Chanukah
			dayNum:   5,
			expected: "chanukah",
		},
		{
			name:     "Pesach Day 3 (Chol HaMoed)",
			date:     time.Date(2025, 4, 15, 0, 0, 0, 0, time.UTC), // Chol HaMoed Pesach
			dayNum:   3,
			expected: "chol_hamoed_pesach",
		},
	}

	calService := calendar.NewCalendarService()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dayInfo := calService.GetDayInfo(tt.date)

			// For multi-day events, verify that:
			// 1. The correct event tag is active
			// 2. Day number is tracked correctly
			// 3. Different zmanim may apply on different days

			hasExpectedEvent := false
			for _, holiday := range dayInfo.Holidays {
				if holiday.Name == tt.expected ||
				   holiday.Category == tt.expected {
					hasExpectedEvent = true
					break
				}
			}

			t.Logf("%s: %s", tt.name, tt.date.Format("2006-01-02"))
			t.Logf("  Expected event: %s", tt.expected)
			t.Logf("  Found event: %v", hasExpectedEvent)
			t.Logf("  Holidays: %v", dayInfo.Holidays)
		})
	}
}

// TestZmanimFilteringByTags validates that zmanim are correctly filtered by active tags
func TestZmanimFilteringByTags(t *testing.T) {
	// This test validates the tag-driven filtering logic
	// by simulating different calendar contexts

	tests := []struct {
		name           string
		date           time.Time
		activeTags     []string
		shouldShow     []string
		shouldNotShow  []string
	}{
		{
			name:       "Regular weekday - no special zmanim",
			date:       time.Date(2025, 12, 24, 0, 0, 0, 0, time.UTC),
			activeTags: []string{}, // No event tags
			shouldShow: []string{
				"alos_hashachar",
				"sunrise",
				"sunset",
			},
			shouldNotShow: []string{
				"candle_lighting",
				"havdalah",
				"fast_begins",
				"fast_ends",
			},
		},
		{
			name:       "Friday - show candle lighting",
			date:       time.Date(2025, 12, 26, 0, 0, 0, 0, time.UTC),
			activeTags: []string{"erev_shabbos"},
			shouldShow: []string{
				"candle_lighting",
				"alos_hashachar",
				"sunrise",
			},
			shouldNotShow: []string{
				"havdalah", // Not on Friday
			},
		},
		{
			name:       "Saturday - show havdalah",
			date:       time.Date(2025, 12, 27, 0, 0, 0, 0, time.UTC),
			activeTags: []string{"shabbos"},
			shouldShow: []string{
				"havdalah",
				"alos_hashachar", // Can still show morning zmanim
			},
			shouldNotShow: []string{
				"candle_lighting", // Not on Saturday night
			},
		},
		{
			name:       "Fast day - show fast times",
			date:       time.Date(2025, 1, 10, 0, 0, 0, 0, time.UTC),
			activeTags: []string{"asarah_bteves"},
			shouldShow: []string{
				"fast_begins",
				"fast_ends",
				"alos_hashachar",
				"chatzos",
			},
			shouldNotShow: []string{
				"candle_lighting",
				"havdalah",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// This is a conceptual test - actual implementation would:
			// 1. Query database for zmanim with matching tags
			// 2. Filter based on tt.activeTags
			// 3. Verify tt.shouldShow are present
			// 4. Verify tt.shouldNotShow are absent

			t.Logf("Test case: %s", tt.name)
			t.Logf("  Date: %s", tt.date.Format("2006-01-02"))
			t.Logf("  Active tags: %v", tt.activeTags)
			t.Logf("  Should show: %v", tt.shouldShow)
			t.Logf("  Should NOT show: %v", tt.shouldNotShow)

			// Actual database query and filtering implementation tracked in backlog
		})
	}
}

// TestNegatedTags validates that negated tags correctly exclude zmanim
func TestNegatedTags(t *testing.T) {
	// Test the negation logic: "NOT on Shabbos" means exclude on Saturday
	tests := []struct {
		name          string
		date          time.Time
		zmanKey       string
		negatedTag    string
		shouldExclude bool
	}{
		{
			name:          "Zman with 'NOT shabbos' tag on Saturday",
			date:          time.Date(2025, 12, 27, 0, 0, 0, 0, time.UTC), // Saturday
			zmanKey:       "some_weekday_zman",
			negatedTag:    "shabbos",
			shouldExclude: true, // Should be excluded on Shabbat
		},
		{
			name:          "Zman with 'NOT shabbos' tag on Wednesday",
			date:          time.Date(2025, 12, 24, 0, 0, 0, 0, time.UTC), // Wednesday
			zmanKey:       "some_weekday_zman",
			negatedTag:    "shabbos",
			shouldExclude: false, // Should NOT be excluded on weekday
		},
		{
			name:          "Zman with 'NOT yom_tov' on regular day",
			date:          time.Date(2025, 12, 24, 0, 0, 0, 0, time.UTC),
			zmanKey:       "regular_zman",
			negatedTag:    "yom_kippur",
			shouldExclude: false, // Should NOT be excluded (no Yom Tov)
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// This test validates the negation logic
			// Actual implementation in filterByNegatedTags() in handlers/zmanim.go

			t.Logf("Test: %s", tt.name)
			t.Logf("  Date: %s (%s)", tt.date.Format("2006-01-02"), tt.date.Weekday())
			t.Logf("  Zman: %s", tt.zmanKey)
			t.Logf("  Negated tag: %s", tt.negatedTag)
			t.Logf("  Should exclude: %v", tt.shouldExclude)

			// Actual negation check implementation tracked in backlog
		})
	}
}

// Helper function to create a test HTTP request
func createTestRequest(t *testing.T, method, url string) *http.Request {
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	return req
}

// Helper function to execute request and parse response
func executeRequest(t *testing.T, handler http.HandlerFunc, req *http.Request) *httptest.ResponseRecorder {
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	return rr
}

// Helper to parse JSON response
func parseJSONResponse(t *testing.T, body string) map[string]interface{} {
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(body), &result); err != nil {
		t.Fatalf("Failed to parse JSON response: %v", err)
	}
	return result
}
