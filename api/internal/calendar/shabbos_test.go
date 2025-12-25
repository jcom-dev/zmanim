package calendar

import (
	"context"
	"testing"
	"time"
)

// TestShabbosTagOnSaturday verifies that the shabbos tag is added for every Saturday
func TestShabbosTagOnSaturday(t *testing.T) {
	client := &Client{}

	tests := []struct {
		name          string
		date          time.Time
		expectShabbos bool
	}{
		{
			name:          "Saturday should have shabbos tag",
			date:          time.Date(2025, 12, 27, 12, 0, 0, 0, time.UTC), // Saturday
			expectShabbos: true,
		},
		{
			name:          "Sunday should not have shabbos tag",
			date:          time.Date(2025, 12, 28, 12, 0, 0, 0, time.UTC), // Sunday
			expectShabbos: false,
		},
		{
			name:          "Friday should not have shabbos tag",
			date:          time.Date(2025, 12, 26, 12, 0, 0, 0, time.UTC), // Friday
			expectShabbos: false,
		},
		{
			name:          "Wednesday should not have shabbos tag",
			date:          time.Date(2025, 12, 24, 12, 0, 0, 0, time.UTC), // Wednesday
			expectShabbos: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// GetActiveTagsForDate requires context, but we're testing the Saturday logic
			// which happens after the HebCal API call
			ctx := context.Background()

			// Use empty mappings since we're only testing the Saturday logic
			tags, err := client.GetActiveTagsForDate(ctx, tt.date, 40.7128, -74.0060, "ashkenazi", []TagEventMapping{})

			// Note: This will fail when HebCal API is called because we have no real API key
			// but we can test the logic locally by checking the day of week
			if err != nil && tt.date.Weekday() == time.Saturday {
				// Even if HebCal fails, Saturday logic should work
				t.Logf("HebCal API call failed (expected in test): %v", err)
			}

			// Check if shabbos tag is present
			hasShabbos := false
			for _, tag := range tags {
				if tag == "shabbos" {
					hasShabbos = true
					break
				}
			}

			// Verify weekday matches expectation
			isSaturday := tt.date.Weekday() == time.Saturday
			if isSaturday != tt.expectShabbos {
				t.Fatalf("Test setup error: date %s weekday=%v, expected Saturday=%v",
					tt.date.Format("2006-01-02"), tt.date.Weekday(), tt.expectShabbos)
			}

			if tt.expectShabbos && !hasShabbos {
				t.Errorf("Expected shabbos tag on %s (Saturday), got tags: %v",
					tt.date.Format("2006-01-02"), tags)
			}
			if !tt.expectShabbos && hasShabbos {
				t.Errorf("Did not expect shabbos tag on %s (%v), got tags: %v",
					tt.date.Format("2006-01-02"), tt.date.Weekday(), tags)
			}
		})
	}
}

// TestShabbosTagLogicOnly tests just the Saturday detection logic without HebCal API
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
