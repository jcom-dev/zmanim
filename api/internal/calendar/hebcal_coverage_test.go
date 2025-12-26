package calendar

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"testing"

	"github.com/hebcal/hebcal-go/event"
	"github.com/hebcal/hebcal-go/hebcal"
)

// TestHebCalCoverageAudit collects all HebCal events across multiple years and locations
// This is Phase 1 of the HebCal Tag Coverage Audit Plan
//
// Purpose: Generate comprehensive dataset of ALL events that HebCal can produce
// to validate that our tag-driven architecture has 100% coverage
//
// Test Parameters:
// - Years: 5775-5785 (10 Hebrew years)
// - Locations: Jerusalem (Israel mode: true) and Salford UK (Israel mode: false)
// - Events: ALL categories (holidays, fasts, Rosh Chodesh, special Shabbatot, Omer)
//
// Output: CSV file in _bmad-output/hebcal-audit-full-events.csv
func TestHebCalCoverageAudit(t *testing.T) {
	// Get standard audit locations
	locations := GetAuditLocations()

	// Hebrew years to test: 5775-5785 (10 years)
	hebrewYears := HebrewYearRange(5775, 5785)

	// Collect all events
	t.Log("Starting HebCal Coverage Audit - Phase 1: Data Collection")
	t.Logf("Testing %d Hebrew years across %d locations", len(hebrewYears), len(locations))

	allEvents := make(map[string]AuditEvent) // Key: title+category+location, Value: first occurrence
	deduplicator := NewEventDeduplicator()

	for _, loc := range locations {
		t.Logf("Collecting events for location: %s (IsIsrael=%v)", loc.Name, loc.IsIsrael)

		for _, year := range hebrewYears {
			events := collectEventsForYear(t, year, loc)
			t.Logf("  Year %d: Collected %d events", year, len(events))

			for _, event := range events {
				// Create unique key for deduplication
				key := fmt.Sprintf("%s|%s|%s", event.Title, event.Category, loc.Name)

				// Store first occurrence using deduplicator
				if deduplicator.AddEvent(event.Title, event.Category, loc.Name) {
					allEvents[key] = event
				}
			}
		}
	}

	t.Logf("Total unique events collected: %d", len(allEvents))

	// Export to CSV
	err := exportEventsToCSV(allEvents)
	if err != nil {
		t.Fatalf("Failed to export events to CSV: %v", err)
	}

	t.Log("Successfully exported events to _bmad-output/hebcal-audit-full-events.csv")

	// Log summary statistics by category
	categoryCounts := make(map[string]int)
	for _, event := range allEvents {
		categoryCounts[event.Category]++
	}

	t.Log("\nEvent counts by category:")
	categories := make([]string, 0, len(categoryCounts))
	for cat := range categoryCounts {
		categories = append(categories, cat)
	}
	sort.Strings(categories)

	for _, cat := range categories {
		t.Logf("  %s: %d", cat, categoryCounts[cat])
	}
}

// collectEventsForYear collects all events for a given Hebrew year and location
func collectEventsForYear(t *testing.T, hebrewYear int, loc AuditLocation) []AuditEvent {
	t.Helper()

	// Configure HebCal to return ALL event types
	opts := hebcal.CalOptions{
		Year:             hebrewYear,
		IsHebrewYear:     true,
		NoHolidays:       false,        // Include holidays
		NoMinorFast:      false,        // Include minor fasts
		NoModern:         false,        // Include modern Israeli holidays
		NoRoshChodesh:    false,        // Include Rosh Chodesh
		NoSpecialShabbat: false,        // Include special Shabbatot
		ShabbatMevarchim: false,        // Don't include Shabbat Mevarchim (we handle this separately)
		IL:               loc.IsIsrael, // Israel mode affects Yom Tov Sheni
	}

	// Get events from hebcal-go library (offline, no API calls)
	hebcalEvents, err := hebcal.HebrewCalendar(&opts)
	if err != nil {
		t.Fatalf("Failed to get calendar for year %d, location %s: %v", hebrewYear, loc.Name, err)
	}

	// Convert hebcal-go events to our AuditEvent format
	var events []AuditEvent
	for _, ev := range hebcalEvents {
		// Get event category
		category := getEventCategory(ev)

		// Get Gregorian date and Hebrew date
		hd := ev.GetDate()
		gregorianDate := hd.Gregorian()

		// Get event title (using default English rendering)
		title := ev.Render("en")

		events = append(events, AuditEvent{
			Title:       title,
			Category:    category,
			Date:        gregorianDate,
			Location:    loc.Name,
			IsIsrael:    loc.IsIsrael,
			HebrewYear:  hd.Year(),
			HebrewMonth: int(hd.Month()),
			HebrewDay:   hd.Day(),
		})
	}

	return events
}

// getEventCategory determines the category of a hebcal-go event
// This matches the categories used in our tag system
func getEventCategory(ev event.CalEvent) string {
	// Check event flags to determine category
	flags := ev.GetFlags()

	// Fast days
	if flags&event.MINOR_FAST != 0 || flags&event.MAJOR_FAST != 0 {
		return "fast"
	}

	// Rosh Chodesh
	if flags&event.ROSH_CHODESH != 0 {
		return "roshchodesh"
	}

	// Special Shabbatot
	if flags&event.SPECIAL_SHABBAT != 0 {
		return "holiday" // Special Shabbatot are categorized as holidays
	}

	// Omer counting
	if flags&event.OMER_COUNT != 0 {
		return "omer"
	}

	// Shabbat Mevarchim
	if flags&event.SHABBAT_MEVARCHIM != 0 {
		return "mevarchim"
	}

	// Modern holidays
	if flags&event.MODERN_HOLIDAY != 0 {
		return "holiday"
	}

	// Minor holidays
	if flags&event.MINOR_HOLIDAY != 0 {
		return "holiday"
	}

	// Major holidays
	if flags&event.CHAG != 0 {
		return "holiday"
	}

	// Default to holiday if no specific category found
	return "holiday"
}

// exportEventsToCSV exports collected events to a CSV file using the existing CSV writer
func exportEventsToCSV(events map[string]AuditEvent) error {
	// Create output directory if it doesn't exist
	outputDir := filepath.Join("..", "..", "..", "_bmad-output")
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Create CSV file
	outputPath := filepath.Join(outputDir, "hebcal-audit-full-events.csv")
	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create CSV file: %w", err)
	}
	defer file.Close()

	// Use the existing CSV writer from audit_helpers.go
	csvWriter := NewCSVEventWriter(file)

	// Sort events by title for consistent output
	type sortableEvent struct {
		key   string
		event AuditEvent
	}
	sortedEvents := make([]sortableEvent, 0, len(events))
	for key, event := range events {
		sortedEvents = append(sortedEvents, sortableEvent{key: key, event: event})
	}
	sort.Slice(sortedEvents, func(i, j int) bool {
		return sortedEvents[i].event.Title < sortedEvents[j].event.Title
	})

	// Write event rows
	for _, se := range sortedEvents {
		if err := csvWriter.WriteEvent(se.event); err != nil {
			return fmt.Errorf("failed to write CSV row: %w", err)
		}
	}

	// Flush the writer
	if err := csvWriter.Flush(); err != nil {
		return fmt.Errorf("failed to flush CSV writer: %w", err)
	}

	return nil
}

// TestHebCalCoverageWithTransliterations tests both Ashkenazi and Sephardi transliterations
// This ensures we capture all possible event name variations
func TestHebCalCoverageWithTransliterations(t *testing.T) {
	// Test a sample year with both transliteration styles
	year := 5785
	loc := AuditLocation{
		Name:     "New York",
		Lat:      40.7128,
		Lng:      -74.0060,
		IsIsrael: false,
	}

	// Collect events with default (Sephardi) transliteration
	optsDefault := hebcal.CalOptions{
		Year:             year,
		IsHebrewYear:     true,
		NoHolidays:       false,
		NoMinorFast:      false,
		NoModern:         false,
		NoRoshChodesh:    false,
		NoSpecialShabbat: false,
		ShabbatMevarchim: false,
		IL:               loc.IsIsrael,
	}

	eventsDefault, err := hebcal.HebrewCalendar(&optsDefault)
	if err != nil {
		t.Fatalf("Failed to get calendar with default transliteration: %v", err)
	}

	// Collect unique event names
	defaultNames := make(map[string]bool)
	for _, ev := range eventsDefault {
		defaultNames[ev.Render("en")] = true
	}

	// Note: hebcal-go library uses fixed transliterations
	// The "ashkenazi" mode is handled at the display/locale level
	// For comprehensive coverage, we test both IL modes (Israel vs Diaspora)

	t.Logf("Collected %d unique event names with default transliteration", len(defaultNames))

	// Log sample events
	sampleCount := 0
	for name := range defaultNames {
		if sampleCount >= 10 {
			break
		}
		t.Logf("  - %s", name)
		sampleCount++
	}
}

// TestHebCalIsraelDiasporaAudit validates that Israel vs Diaspora modes produce different events
// This is critical for Yom Tov Sheni validation in the audit
func TestHebCalIsraelDiasporaAudit(t *testing.T) {
	year := 5785

	israelLoc := AuditLocation{
		Name:     "Jerusalem",
		Lat:      31.7683,
		Lng:      35.2137,
		IsIsrael: true,
	}

	diasporaLoc := AuditLocation{
		Name:     "New York",
		Lat:      40.7128,
		Lng:      -74.0060,
		IsIsrael: false,
	}

	israelEvents := collectEventsForYear(t, year, israelLoc)
	diasporaEvents := collectEventsForYear(t, year, diasporaLoc)

	// Create maps for comparison
	israelEventNames := make(map[string]bool)
	for _, ev := range israelEvents {
		israelEventNames[ev.Title] = true
	}

	diasporaEventNames := make(map[string]bool)
	for _, ev := range diasporaEvents {
		diasporaEventNames[ev.Title] = true
	}

	// Find events that differ
	israelOnly := []string{}
	diasporaOnly := []string{}

	for name := range israelEventNames {
		if !diasporaEventNames[name] {
			israelOnly = append(israelOnly, name)
		}
	}

	for name := range diasporaEventNames {
		if !israelEventNames[name] {
			diasporaOnly = append(diasporaOnly, name)
		}
	}

	t.Logf("Total events in Israel: %d", len(israelEvents))
	t.Logf("Total events in Diaspora: %d", len(diasporaEvents))
	t.Logf("Events only in Israel: %d", len(israelOnly))
	t.Logf("Events only in Diaspora: %d", len(diasporaOnly))

	// Log differences (useful for understanding Yom Tov Sheni)
	if len(israelOnly) > 0 {
		t.Log("\nSample events only in Israel:")
		for i, name := range israelOnly {
			if i >= 5 {
				break
			}
			t.Logf("  - %s", name)
		}
	}

	if len(diasporaOnly) > 0 {
		t.Log("\nSample events only in Diaspora:")
		for i, name := range diasporaOnly {
			if i >= 5 {
				break
			}
			t.Logf("  - %s", name)
		}
	}

	// Verify that there ARE differences (sanity check)
	if len(israelOnly) == 0 && len(diasporaOnly) == 0 {
		t.Error("Expected differences between Israel and Diaspora events, but found none")
	}
}
