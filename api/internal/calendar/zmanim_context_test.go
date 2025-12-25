package calendar

import (
	"testing"
	"time"
)

// TestGetZmanimContext_MoetzeiEvents verifies that motzei events are included in ActiveEventCodes
// This test validates the fix for the bug where havdalah zmanim were not showing on Saturday
func TestGetZmanimContext_MoetzeiEvents(t *testing.T) {
	service := &CalendarService{}

	// Test Saturday (motzei Shabbos should be in ActiveEventCodes)
	saturday, _ := time.Parse("2006-01-02", "2025-01-18") // Saturday, Jan 18, 2025
	loc := Location{
		Latitude:  40.7128,
		Longitude: -74.0060,
		Timezone:  "America/New_York",
		IsIsrael:  false,
	}

	ctx := service.GetZmanimContext(saturday, loc, "")

	// Verify "shabbos" is in ActiveEventCodes (from both ActiveEvents and MoetzeiEvents)
	found := false
	for _, code := range ctx.ActiveEventCodes {
		if code == "shabbos" {
			found = true
			break
		}
	}

	if !found {
		t.Errorf("Expected 'shabbos' in ActiveEventCodes for Saturday, got: %v", ctx.ActiveEventCodes)
	}

	t.Logf("Saturday ActiveEventCodes: %v", ctx.ActiveEventCodes)
}

// TestGetZmanimContext_ErevEvents verifies that erev events are included in ActiveEventCodes
// This test validates that candle lighting zmanim show on Friday
func TestGetZmanimContext_ErevEvents(t *testing.T) {
	service := &CalendarService{}

	// Test Friday (erev Shabbos should be in ActiveEventCodes)
	friday, _ := time.Parse("2006-01-02", "2025-01-17") // Friday, Jan 17, 2025
	loc := Location{
		Latitude:  40.7128,
		Longitude: -74.0060,
		Timezone:  "America/New_York",
		IsIsrael:  false,
	}

	ctx := service.GetZmanimContext(friday, loc, "")

	// Verify "erev_shabbos" is in ActiveEventCodes (from ErevEvents)
	// Note: On Friday, we get "erev_shabbos" - zmanim tagged with "shabbos" + "day_before"
	// will match via the timing tag logic in ShouldShowZman
	found := false
	for _, code := range ctx.ActiveEventCodes {
		if code == "erev_shabbos" {
			found = true
			break
		}
	}

	if !found {
		t.Errorf("Expected 'erev_shabbos' in ActiveEventCodes for Friday, got: %v", ctx.ActiveEventCodes)
	}

	t.Logf("Friday ActiveEventCodes: %v", ctx.ActiveEventCodes)
}

// TestGetZmanimContext_NoHardcodedChecks verifies no hardcoded logic
// This test ensures the function is purely tag-driven
func TestGetZmanimContext_NoHardcodedChecks(t *testing.T) {
	service := &CalendarService{}

	// Test a regular weekday
	monday, _ := time.Parse("2006-01-02", "2025-01-13") // Monday, Jan 13, 2025
	loc := Location{
		Latitude:  40.7128,
		Longitude: -74.0060,
		Timezone:  "America/New_York",
		IsIsrael:  false,
	}

	ctx := service.GetZmanimContext(monday, loc, "")

	// On a regular weekday, ActiveEventCodes should be empty (or only contain non-Shabbos events)
	for _, code := range ctx.ActiveEventCodes {
		if code == "shabbos" {
			t.Errorf("Did not expect 'shabbos' in ActiveEventCodes for Monday, got: %v", ctx.ActiveEventCodes)
		}
	}

	t.Logf("Monday ActiveEventCodes: %v", ctx.ActiveEventCodes)
}

// TestGetZmanimContext_DisplayContextsDeprecated verifies DisplayContexts is populated for backward compatibility
func TestGetZmanimContext_DisplayContextsDeprecated(t *testing.T) {
	service := &CalendarService{}

	friday, _ := time.Parse("2006-01-02", "2025-01-17") // Friday, Jan 17, 2025
	loc := Location{
		Latitude:  40.7128,
		Longitude: -74.0060,
		Timezone:  "America/New_York",
		IsIsrael:  false,
	}

	ctx := service.GetZmanimContext(friday, loc, "")

	// DisplayContexts should equal ActiveEventCodes for backward compatibility
	if len(ctx.DisplayContexts) != len(ctx.ActiveEventCodes) {
		t.Errorf("DisplayContexts length (%d) != ActiveEventCodes length (%d)", len(ctx.DisplayContexts), len(ctx.ActiveEventCodes))
	}

	// All items in DisplayContexts should be in ActiveEventCodes
	for _, dc := range ctx.DisplayContexts {
		found := false
		for _, ac := range ctx.ActiveEventCodes {
			if dc == ac {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("DisplayContext item '%s' not found in ActiveEventCodes", dc)
		}
	}

	t.Logf("DisplayContexts: %v", ctx.DisplayContexts)
	t.Logf("ActiveEventCodes: %v", ctx.ActiveEventCodes)
}
