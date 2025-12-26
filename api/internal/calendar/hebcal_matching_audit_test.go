package calendar

import (
	"context"
	"database/sql"
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// TestHebCalTagMatching implements Phase 2 of the HebCal Tag Coverage Audit Plan
//
// Purpose: Test all collected HebCal events against the database matching function
// to validate that we have 100% coverage of all events in the tag-driven architecture
//
// Requirements:
// - Database must be running with current schema
// - Set DATABASE_URL environment variable
// - Run Phase 1 first (TestHebCalCoverageAudit) to collect events
//
// Output: CSV file with match results in _bmad-output/hebcal-audit-match-results.csv
func TestHebCalTagMatching(t *testing.T) {
	// Skip if database not available
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("Skipping database test - DATABASE_URL not set")
	}

	// Connect to database
	db, err := connectToTestDB(t)
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Collect all events
	t.Log("Starting HebCal Tag Matching Audit - Phase 2: Tag Matching")

	locations := GetAuditLocations()
	hebrewYears := HebrewYearRange(5775, 5885) // Testing 111 years for comprehensive coverage

	t.Logf("Testing %d Hebrew years across %d locations", len(hebrewYears), len(locations))

	// Collect events from HebCal
	var allEvents []AuditEvent
	for _, loc := range locations {
		t.Logf("Collecting events for location: %s (IsIsrael=%v)", loc.Name, loc.IsIsrael)

		for _, year := range hebrewYears {
			events := collectEventsForYear(t, year, loc)

			// Hebrew year is already set by collectEventsForYear
			allEvents = append(allEvents, events...)
		}
	}

	t.Logf("Collected %d total event instances", len(allEvents))

	// Phase 2: Match events against database
	matchResults, err := auditEventMatching(t, db, allEvents)
	if err != nil {
		t.Fatalf("Failed to audit event matching: %v", err)
	}

	t.Logf("Completed matching for %d events", len(matchResults))

	// Export results to CSV
	err = exportMatchResultsToCSV(matchResults)
	if err != nil {
		t.Fatalf("Failed to export match results: %v", err)
	}

	// Calculate and report statistics
	stats := calculateMatchStatistics(matchResults)
	reportMatchStatistics(t, stats)

	// Generate executive summary report
	err = generateExecutiveSummaryReport(t, stats, matchResults)
	if err != nil {
		t.Fatalf("Failed to generate executive summary: %v", err)
	}

	// Generate detailed unmapped events report
	err = generateUnmappedEventsReport(t, matchResults)
	if err != nil {
		t.Fatalf("Failed to generate unmapped events report: %v", err)
	}

	t.Log("Generated unmapped events report: _bmad-output/hebcal-audit-unmapped-events.md")

	// Write summary findings
	t.Logf("\n=== AUDIT SUMMARY ===")
	t.Logf("Coverage: %.1f%% (%d/%d events matched)",
		stats.CoveragePercent,
		stats.MappedCount,
		stats.TotalEvents)

	if stats.UnmappedCount > 0 {
		t.Logf("WARNING: %d events unmapped", stats.UnmappedCount)
		t.Logf("See _bmad-output/hebcal-audit-match-results.csv for full details")
	} else {
		t.Log("SUCCESS: 100% coverage - all events mapped!")
	}

	// Phase 3: Generate unused tags report (reverse gap analysis)
	err = generateUnusedTagsReport(t, db, matchResults)
	if err != nil {
		t.Fatalf("Failed to generate unused tags report: %v", err)
	}

	t.Log("Generated unused tags report: _bmad-output/hebcal-audit-unused-tags.md")

	// Phase 3: Generate actionable SQL recommendations report
	unusedTags, err := findUnusedTags(t, db, matchResults)
	if err != nil {
		t.Fatalf("Failed to find unused tags: %v", err)
	}

	err = generateRecommendationsReport(t, matchResults, unusedTags)
	if err != nil {
		t.Fatalf("Failed to generate recommendations report: %v", err)
	}

	t.Log("Generated recommendations report: _bmad-output/hebcal-audit-recommendations.md")
}

// auditEventMatching tests each event against the database matching function
func auditEventMatching(t *testing.T, db *sql.DB, events []AuditEvent) ([]MatchResult, error) {
	t.Helper()

	var results []MatchResult
	ctx := context.Background()

	// Deduplicate events by (Title, Category, Location)
	dedup := NewEventDeduplicator()

	for _, event := range events {
		// Only test unique events
		if !dedup.AddEvent(event.Title, event.Category, event.Location) {
			continue
		}

		// Call the database matching function
		var tagID sql.NullInt32
		var tagKey sql.NullString
		var matchType sql.NullString

		err := db.QueryRowContext(ctx,
			"SELECT tag_id, tag_key, match_type FROM match_hebcal_event($1, $2)",
			event.Title,
			sql.NullString{String: event.Category, Valid: event.Category != ""},
		).Scan(&tagID, &tagKey, &matchType)

		result := MatchResult{
			Title:      event.Title,
			Category:   event.Category,
			Date:       event.Date.Format("2006-01-02"),
			Location:   event.Location,
			IsIsrael:   event.IsIsrael,
			HebrewYear: event.HebrewYear,
		}

		if err == sql.ErrNoRows {
			// No match found - leave MatchedTag and MatchType empty
			result.MatchedTag = ""
			result.MatchType = ""
		} else if err != nil {
			t.Logf("Warning: Error matching event %q (category: %s): %v",
				event.Title, event.Category, err)
			result.MatchedTag = ""
			result.MatchType = ""
		} else {
			// Match found
			if tagKey.Valid {
				result.MatchedTag = tagKey.String
			}
			if matchType.Valid {
				result.MatchType = matchType.String
			}
		}

		results = append(results, result)
	}

	t.Logf("Tested %d unique events against database", len(results))
	return results, nil
}

// MatchStatistics holds statistics about match results
type MatchStatistics struct {
	TotalEvents     int
	MappedCount     int
	UnmappedCount   int
	CoveragePercent float64
	ByMatchType     map[string]int
	ByCategory      map[string]CategoryMatchStats
	UnmappedEvents  []UnmappedEvent
}

// CategoryMatchStats holds statistics per category
type CategoryMatchStats struct {
	Total           int
	Mapped          int
	Unmapped        int
	CoveragePercent float64
}

// UnmappedEvent represents an event that didn't match any tag
type UnmappedEvent struct {
	Title    string
	Category string
	Location string
}

// calculateMatchStatistics analyzes match results and returns statistics
func calculateMatchStatistics(results []MatchResult) MatchStatistics {
	stats := MatchStatistics{
		TotalEvents: len(results),
		ByMatchType: make(map[string]int),
		ByCategory:  make(map[string]CategoryMatchStats),
	}

	for _, result := range results {
		// Count by match type
		if result.MatchedTag != "" {
			stats.MappedCount++
			stats.ByMatchType[result.MatchType]++
		} else {
			stats.UnmappedCount++
			stats.UnmappedEvents = append(stats.UnmappedEvents, UnmappedEvent{
				Title:    result.Title,
				Category: result.Category,
				Location: result.Location,
			})
		}

		// Count by category
		catStats := stats.ByCategory[result.Category]
		catStats.Total++
		if result.MatchedTag != "" {
			catStats.Mapped++
		} else {
			catStats.Unmapped++
		}
		stats.ByCategory[result.Category] = catStats
	}

	// Calculate percentages
	if stats.TotalEvents > 0 {
		stats.CoveragePercent = float64(stats.MappedCount) / float64(stats.TotalEvents) * 100
	}

	for cat, catStats := range stats.ByCategory {
		if catStats.Total > 0 {
			catStats.CoveragePercent = float64(catStats.Mapped) / float64(catStats.Total) * 100
			stats.ByCategory[cat] = catStats
		}
	}

	return stats
}

// reportMatchStatistics logs detailed match statistics
func reportMatchStatistics(t *testing.T, stats MatchStatistics) {
	t.Helper()

	t.Logf("\n=== Match Statistics ===")
	t.Logf("Total Unique Events: %d", stats.TotalEvents)
	t.Logf("Mapped: %d (%.1f%%)", stats.MappedCount, stats.CoveragePercent)
	t.Logf("Unmapped: %d (%.1f%%)", stats.UnmappedCount, 100-stats.CoveragePercent)

	t.Logf("\n=== Match Type Breakdown ===")
	matchTypes := make([]string, 0, len(stats.ByMatchType))
	for mt := range stats.ByMatchType {
		matchTypes = append(matchTypes, mt)
	}
	sort.Strings(matchTypes)

	for _, mt := range matchTypes {
		count := stats.ByMatchType[mt]
		percent := float64(count) / float64(stats.MappedCount) * 100
		t.Logf("  %s: %d (%.1f%% of mapped)", mt, count, percent)
	}

	t.Logf("\n=== Coverage by Category ===")
	categories := make([]string, 0, len(stats.ByCategory))
	for cat := range stats.ByCategory {
		categories = append(categories, cat)
	}
	sort.Strings(categories)

	for _, cat := range categories {
		catStats := stats.ByCategory[cat]
		t.Logf("  %s: %d/%d mapped (%.1f%%)",
			cat, catStats.Mapped, catStats.Total, catStats.CoveragePercent)
	}

	if len(stats.UnmappedEvents) > 0 {
		t.Logf("\n=== Unmapped Events (%d) ===", len(stats.UnmappedEvents))

		// Group by category for clearer reporting
		byCategory := make(map[string][]UnmappedEvent)
		for _, event := range stats.UnmappedEvents {
			byCategory[event.Category] = append(byCategory[event.Category], event)
		}

		for _, cat := range categories {
			events := byCategory[cat]
			if len(events) == 0 {
				continue
			}

			t.Logf("\n  Category: %s (%d events)", cat, len(events))
			for i, event := range events {
				if i >= 5 {
					t.Logf("    ... and %d more", len(events)-5)
					break
				}
				t.Logf("    - %s (location: %s)", event.Title, event.Location)
			}
		}
	}
}

// exportMatchResultsToCSV writes match results to a CSV file
func exportMatchResultsToCSV(results []MatchResult) error {
	// Create output directory
	outputDir := filepath.Join("..", "..", "..", "_bmad-output")
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Create CSV file
	outputPath := filepath.Join(outputDir, "hebcal-audit-match-results.csv")
	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create CSV file: %w", err)
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// Write header
	header := []string{
		"HebCal Title",
		"HebCal Category",
		"Date",
		"Location",
		"Israel Mode",
		"Matched Tag",
		"Match Type",
		"Hebrew Year",
	}
	if err := writer.Write(header); err != nil {
		return fmt.Errorf("failed to write CSV header: %w", err)
	}

	// Sort results for consistent output
	sort.Slice(results, func(i, j int) bool {
		if results[i].Category != results[j].Category {
			return results[i].Category < results[j].Category
		}
		if results[i].Title != results[j].Title {
			return results[i].Title < results[j].Title
		}
		return results[i].Location < results[j].Location
	})

	// Write rows
	for _, result := range results {
		israelMode := "false"
		if result.IsIsrael {
			israelMode = "true"
		}

		row := []string{
			result.Title,
			result.Category,
			result.Date,
			result.Location,
			israelMode,
			result.MatchedTag,
			result.MatchType,
			fmt.Sprintf("%d", result.HebrewYear),
		}

		if err := writer.Write(row); err != nil {
			return fmt.Errorf("failed to write CSV row: %w", err)
		}
	}

	return nil
}

// UnusedTag represents a tag that never matched any HebCal event
type UnusedTag struct {
	TagKey        string
	MatchType     string
	MatchString   string
	MatchPattern  string
	MatchCategory string
	DisplayName   string
}

// generateUnusedTagsReport creates a markdown report of tags that never matched
func generateUnusedTagsReport(t *testing.T, db *sql.DB, results []MatchResult) error {
	t.Helper()

	// Collect all tags that were matched
	matchedTags := make(map[string]bool)
	for _, result := range results {
		if result.MatchedTag != "" {
			matchedTags[result.MatchedTag] = true
		}
	}

	t.Logf("Found %d unique tags that matched events", len(matchedTags))

	// Query all tags with hebcal mapping
	ctx := context.Background()
	rows, err := db.QueryContext(ctx, `
		SELECT
			tag_key,
			hebcal_match_type,
			COALESCE(hebcal_match_string, '') as match_string,
			COALESCE(hebcal_match_pattern, '') as match_pattern,
			COALESCE(hebcal_match_category, '') as match_category,
			display_name_english_ashkenazi
		FROM zman_tags
		WHERE hebcal_match_type IS NOT NULL
		ORDER BY hebcal_match_type, tag_key
	`)
	if err != nil {
		return fmt.Errorf("failed to query tags: %w", err)
	}
	defer rows.Close()

	var allTags []UnusedTag
	var unusedTags []UnusedTag

	for rows.Next() {
		var tag UnusedTag
		if err := rows.Scan(
			&tag.TagKey,
			&tag.MatchType,
			&tag.MatchString,
			&tag.MatchPattern,
			&tag.MatchCategory,
			&tag.DisplayName,
		); err != nil {
			return fmt.Errorf("failed to scan tag: %w", err)
		}

		allTags = append(allTags, tag)

		// Check if this tag was matched
		if !matchedTags[tag.TagKey] {
			unusedTags = append(unusedTags, tag)
		}
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error iterating tags: %w", err)
	}

	t.Logf("Found %d total HebCal-mappable tags", len(allTags))
	t.Logf("Found %d unused tags (never matched)", len(unusedTags))

	// Create output directory
	outputDir := filepath.Join("..", "..", "..", "_bmad-output")
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Create markdown report
	outputPath := filepath.Join(outputDir, "hebcal-audit-unused-tags.md")
	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create report file: %w", err)
	}
	defer file.Close()

	// Write report header
	fmt.Fprintf(file, "# HebCal Tag Coverage Audit - Unused Tags Report (Reverse Gap)\n\n")
	fmt.Fprintf(file, "**Generated:** %s\n", "2025-12-25")
	fmt.Fprintf(file, "**Purpose:** Identify tags with HebCal mappings that NEVER matched any event\n\n")
	fmt.Fprintf(file, "---\n\n")

	// Write summary
	fmt.Fprintf(file, "## Summary\n\n")
	fmt.Fprintf(file, "- **Total HebCal-Mappable Tags:** %d\n", len(allTags))
	fmt.Fprintf(file, "- **Tags Matched:** %d (%.1f%%)\n",
		len(allTags)-len(unusedTags),
		float64(len(allTags)-len(unusedTags))/float64(len(allTags))*100)
	fmt.Fprintf(file, "- **Tags Never Matched:** %d (%.1f%%)\n\n",
		len(unusedTags),
		float64(len(unusedTags))/float64(len(allTags))*100)

	if len(unusedTags) == 0 {
		fmt.Fprintf(file, "## Result\n\n")
		fmt.Fprintf(file, "**SUCCESS:** All %d HebCal-mappable tags matched at least one event across 10 Hebrew years!\n\n", len(allTags))
		fmt.Fprintf(file, "This indicates:\n")
		fmt.Fprintf(file, "- No obsolete or misconfigured tag mappings\n")
		fmt.Fprintf(file, "- All tags are actively used\n")
		fmt.Fprintf(file, "- No cleanup required\n\n")
		return nil
	}

	// Write unused tags by match type
	fmt.Fprintf(file, "---\n\n")
	fmt.Fprintf(file, "## Unused Tags by Match Type\n\n")

	// Group by match type
	byMatchType := make(map[string][]UnusedTag)
	for _, tag := range unusedTags {
		byMatchType[tag.MatchType] = append(byMatchType[tag.MatchType], tag)
	}

	// Write each match type section
	matchTypeOrder := []string{"exact", "group", "category"}
	for _, matchType := range matchTypeOrder {
		tags := byMatchType[matchType]
		if len(tags) == 0 {
			continue
		}

		fmt.Fprintf(file, "### %s Match (%d tags)\n\n", matchType, len(tags))

		for _, tag := range tags {
			fmt.Fprintf(file, "#### `%s`\n\n", tag.TagKey)
			fmt.Fprintf(file, "- **Display Name:** %s\n", tag.DisplayName)
			fmt.Fprintf(file, "- **Match Type:** %s\n", tag.MatchType)

			switch tag.MatchType {
			case "exact":
				fmt.Fprintf(file, "- **Match String:** `%s`\n", tag.MatchString)
			case "group":
				fmt.Fprintf(file, "- **Match Pattern:** `%s`\n", tag.MatchPattern)
			case "category":
				fmt.Fprintf(file, "- **Match Category:** `%s`\n", tag.MatchCategory)
			}

			fmt.Fprintf(file, "\n**Recommendation:**\n")
			recommendation := getRecommendation(tag)
			fmt.Fprintf(file, "%s\n\n", recommendation)
		}
	}

	// Write recommendations section
	fmt.Fprintf(file, "---\n\n")
	fmt.Fprintf(file, "## General Recommendations\n\n")
	fmt.Fprintf(file, "For each unused tag, consider one of the following actions:\n\n")
	fmt.Fprintf(file, "1. **Verify Pattern** - Check if the HebCal event name has changed\n")
	fmt.Fprintf(file, "2. **Remove Mapping** - If the event is obsolete or not used by HebCal\n")
	fmt.Fprintf(file, "3. **Mark as Rare** - Some events only occur in specific years (e.g., leap year events)\n")
	fmt.Fprintf(file, "4. **Check Location** - Some events may be Israel-only or diaspora-only\n\n")

	fmt.Fprintf(file, "To verify a tag pattern:\n")
	fmt.Fprintf(file, "```sql\n")
	fmt.Fprintf(file, "-- Check current mapping\n")
	fmt.Fprintf(file, "SELECT tag_key, hebcal_match_type, hebcal_match_string, hebcal_match_pattern, hebcal_match_category\n")
	fmt.Fprintf(file, "FROM zman_tags\n")
	fmt.Fprintf(file, "WHERE tag_key = 'tag_name';\n\n")
	fmt.Fprintf(file, "-- Remove mapping if obsolete\n")
	fmt.Fprintf(file, "UPDATE zman_tags\n")
	fmt.Fprintf(file, "SET hebcal_match_type = NULL,\n")
	fmt.Fprintf(file, "    hebcal_match_string = NULL,\n")
	fmt.Fprintf(file, "    hebcal_match_pattern = NULL,\n")
	fmt.Fprintf(file, "    hebcal_match_category = NULL\n")
	fmt.Fprintf(file, "WHERE tag_key = 'tag_name';\n")
	fmt.Fprintf(file, "```\n\n")

	t.Logf("Generated unused tags report: %s", outputPath)
	return nil
}

// getRecommendation returns a recommendation for an unused tag
func getRecommendation(tag UnusedTag) string {
	// Special cases based on tag knowledge
	switch tag.TagKey {
	case "purim_meshulash":
		return "**Rare Event** - Purim Meshulash only occurs when Purim falls on Friday in Jerusalem (Shushan Purim on Shabbat). This is extremely rare but valid. Keep mapping."
	case "purim_katan":
		return "**Leap Year Only** - Purim Katan occurs on 14 Adar I during Hebrew leap years. Verify HebCal includes this event during leap years. May need to extend test range."
	case "rosh_hashana_labehemos":
		return "**Rare/Historical** - Rosh Hashana LaBehemot (1st of Elul) is mentioned in Mishnah but not commonly observed. Verify if HebCal includes this event."
	case "chag_habanot":
		return "**Regional Custom** - Chag HaBanot is a North African/Sephardic custom. Verify if HebCal includes this event."
	default:
		// Generic recommendation based on match type
		switch tag.MatchType {
		case "exact":
			return fmt.Sprintf("Verify that HebCal uses exact string `%s`. Check HebCal documentation or API responses. If name changed, update `hebcal_match_string`.", tag.MatchString)
		case "group":
			return fmt.Sprintf("Verify regex pattern `%s` against HebCal event titles. Test pattern against known HebCal responses. Pattern may be too strict or event name may have changed.", tag.MatchPattern)
		case "category":
			return fmt.Sprintf("Verify HebCal category `%s` exists. Check if HebCal still uses this category in their API responses.", tag.MatchCategory)
		default:
			return "Review mapping configuration and verify against HebCal API documentation."
		}
	}
}

// connectToTestDB connects to the test database
func connectToTestDB(t *testing.T) (*sql.DB, error) {
	t.Helper()

	// Get database URL from environment
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL not set")
	}

	// Connect using pgx driver
	db, err := sql.Open("pgx", dbURL)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return db, nil
}

// generateExecutiveSummaryReport creates a comprehensive markdown summary report
// per Phase 3 of the audit plan (Appendix B format)
func generateExecutiveSummaryReport(t *testing.T, stats MatchStatistics, results []MatchResult) error {
	t.Helper()

	// Create output directory
	outputDir := filepath.Join("..", "..", "..", "_bmad-output")
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Create markdown file
	outputPath := filepath.Join(outputDir, "hebcal-audit-summary.md")
	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create summary file: %w", err)
	}
	defer file.Close()

	// Analyze multi-day events
	multiDayResults := analyzeMultiDayEvents(results)

	// Write report header
	fmt.Fprintf(file, "# HebCal Tag Coverage Audit Report\n")
	fmt.Fprintf(file, "**Date:** %s\n", time.Now().Format("2006-01-02"))
	fmt.Fprintf(file, "**Years Tested:** 5775-5785 (10 Hebrew years)\n")
	fmt.Fprintf(file, "**Locations:** Jerusalem, Salford\n\n")

	// Overall coverage summary
	fmt.Fprintf(file, "## Summary\n")
	fmt.Fprintf(file, "- **Total Unique Events:** %d\n", stats.TotalEvents)
	fmt.Fprintf(file, "- **Events Mapped:** %d (%.1f%%)\n", stats.MappedCount, stats.CoveragePercent)
	fmt.Fprintf(file, "- **Events Unmapped:** %d (%.1f%%)\n\n", stats.UnmappedCount, 100-stats.CoveragePercent)

	// Category breakdown table
	fmt.Fprintf(file, "## Coverage by Category\n\n")
	fmt.Fprintf(file, "| Category | Total | Mapped | Unmapped | Coverage %% |\n")
	fmt.Fprintf(file, "|----------|-------|--------|----------|------------|\n")

	// Sort categories for consistent output
	categories := make([]string, 0, len(stats.ByCategory))
	for cat := range stats.ByCategory {
		categories = append(categories, cat)
	}
	sort.Strings(categories)

	for _, cat := range categories {
		catStats := stats.ByCategory[cat]
		fmt.Fprintf(file, "| %s | %d | %d | %d | %.1f%% |\n",
			cat, catStats.Total, catStats.Mapped, catStats.Unmapped, catStats.CoveragePercent)
	}
	fmt.Fprintf(file, "\n")

	// Match type distribution
	fmt.Fprintf(file, "## Match Type Distribution\n\n")
	if stats.MappedCount > 0 {
		fmt.Fprintf(file, "| Match Type | Count | Percentage |\n")
		fmt.Fprintf(file, "|------------|-------|------------|\n")

		// Sort match types
		matchTypes := make([]string, 0, len(stats.ByMatchType))
		for mt := range stats.ByMatchType {
			matchTypes = append(matchTypes, mt)
		}
		sort.Strings(matchTypes)

		for _, mt := range matchTypes {
			count := stats.ByMatchType[mt]
			percent := float64(count) / float64(stats.MappedCount) * 100
			fmt.Fprintf(file, "| %s | %d | %.1f%% |\n", mt, count, percent)
		}
		fmt.Fprintf(file, "\n")
	} else {
		fmt.Fprintf(file, "No events were matched.\n\n")
	}

	// Multi-day event validation
	fmt.Fprintf(file, "## Multi-Day Event Validation\n\n")
	fmt.Fprintf(file, "| Event Group | Days Expected | Days Found | All Matched? | Match Type | Notes |\n")
	fmt.Fprintf(file, "|-------------|---------------|------------|--------------|------------|-------|\n")

	// Sort multi-day results by event group
	eventGroups := make([]string, 0, len(multiDayResults))
	for group := range multiDayResults {
		eventGroups = append(eventGroups, group)
	}
	sort.Strings(eventGroups)

	for _, group := range eventGroups {
		result := multiDayResults[group]
		matched := "✓ Yes"
		if !result.AllMatched {
			matched = "✗ No"
		}

		notes := result.Notes
		if notes == "" {
			notes = "-"
		}

		fmt.Fprintf(file, "| %s | %d | %d | %s | %s | %s |\n",
			result.EventGroup,
			result.DaysExpected,
			result.DaysFound,
			matched,
			result.MatchType,
			notes)
	}
	fmt.Fprintf(file, "\n")

	// Unmapped events section
	if len(stats.UnmappedEvents) > 0 {
		fmt.Fprintf(file, "## Unmapped Events\n\n")
		fmt.Fprintf(file, "The following %d events were not mapped to any tags:\n\n", len(stats.UnmappedEvents))

		// Group by category
		byCategory := make(map[string][]UnmappedEvent)
		for _, event := range stats.UnmappedEvents {
			byCategory[event.Category] = append(byCategory[event.Category], event)
		}

		for _, cat := range categories {
			events := byCategory[cat]
			if len(events) == 0 {
				continue
			}

			fmt.Fprintf(file, "### Category: %s (%d events)\n\n", cat, len(events))
			for _, event := range events {
				fmt.Fprintf(file, "- **%s** (location: %s)\n", event.Title, event.Location)
			}
			fmt.Fprintf(file, "\n")
		}
	} else {
		fmt.Fprintf(file, "## Unmapped Events\n\n")
		fmt.Fprintf(file, "🎉 **SUCCESS!** All events matched to tags - 100%% coverage achieved!\n\n")
	}

	// Recommendations section
	fmt.Fprintf(file, "## Recommendations\n\n")
	if stats.UnmappedCount > 0 {
		fmt.Fprintf(file, "Based on the unmapped events, consider the following actions:\n\n")
		fmt.Fprintf(file, "1. Review each unmapped event to determine if it should have a tag\n")
		fmt.Fprintf(file, "2. For legitimate events, add new tags or extend existing patterns\n")
		fmt.Fprintf(file, "3. For events that should be ignored, document the decision\n")
		fmt.Fprintf(file, "4. Verify HebCal API naming matches our expectations\n\n")
	} else {
		fmt.Fprintf(file, "All events are currently mapped. Consider:\n\n")
		fmt.Fprintf(file, "1. Running this audit periodically to catch HebCal API changes\n")
		fmt.Fprintf(file, "2. Adding this test to CI/CD pipeline for regression testing\n")
		fmt.Fprintf(file, "3. Testing additional years or locations as needed\n\n")
	}

	// Footer
	fmt.Fprintf(file, "---\n\n")
	fmt.Fprintf(file, "*Report generated by HebCal Tag Coverage Audit - Phase 3*\n")

	t.Logf("Executive summary written to: %s", outputPath)
	return nil
}

// analyzeMultiDayEvents detects and validates multi-day events like Pesach, Chanukah, etc.
func analyzeMultiDayEvents(results []MatchResult) map[string]*MultiDayEventResult {
	multiDayResults := make(map[string]*MultiDayEventResult)

	// Track events by pattern
	type eventOccurrence struct {
		matchType string
		location  string
		isIsrael  bool
	}

	eventCounts := make(map[string]map[string]int) // eventGroup -> location -> count
	eventInfo := make(map[string]eventOccurrence)

	for _, result := range results {
		// Detect multi-day event patterns
		var eventGroup string

		// Chanukah: "Chanukah: Day 1", "Chanukah: Day 2", etc.
		if len(result.Title) >= 9 && result.Title[:9] == "Chanukah:" {
			eventGroup = "Chanukah"
		} else if len(result.Title) >= 7 && result.Title[:7] == "Pesach " {
			// Pesach: "Pesach I", "Pesach II", etc.
			if result.IsIsrael {
				eventGroup = "Pesach (Israel)"
			} else {
				eventGroup = "Pesach (Diaspora)"
			}
		} else if len(result.Title) >= 7 && result.Title[:7] == "Sukkot " {
			// Sukkot: "Sukkot I", "Sukkot II", etc.
			if result.IsIsrael {
				eventGroup = "Sukkot (Israel)"
			} else {
				eventGroup = "Sukkot (Diaspora)"
			}
		} else if len(result.Title) >= 8 && result.Title[:8] == "Shavuot " {
			// Shavuot: "Shavuot I", "Shavuot II"
			if result.IsIsrael {
				eventGroup = "Shavuot (Israel)"
			} else {
				eventGroup = "Shavuot (Diaspora)"
			}
		} else if result.Title == "Rosh Hashana" || result.Title == "Rosh Hashana II" {
			// Rosh Hashana: no number for day 1, "II" for day 2
			eventGroup = "Rosh Hashana"
		}

		if eventGroup != "" {
			if eventCounts[eventGroup] == nil {
				eventCounts[eventGroup] = make(map[string]int)
			}
			eventCounts[eventGroup][result.Location]++

			// Store match type and location info
			if _, exists := eventInfo[eventGroup]; !exists {
				eventInfo[eventGroup] = eventOccurrence{
					matchType: result.MatchType,
					location:  result.Location,
					isIsrael:  result.IsIsrael,
				}
			}
		}
	}

	// Define expected day counts
	expectedDays := map[string]int{
		"Chanukah":           8,
		"Pesach (Israel)":    7,
		"Pesach (Diaspora)":  8,
		"Sukkot (Israel)":    7,
		"Sukkot (Diaspora)":  8,
		"Shavuot (Israel)":   1,
		"Shavuot (Diaspora)": 2,
		"Rosh Hashana":       2,
	}

	// Build results
	for group, expected := range expectedDays {
		counts := eventCounts[group]
		if counts == nil {
			counts = make(map[string]int)
		}

		// Sum across all locations (each location should have the full set)
		maxFound := 0
		for _, count := range counts {
			if count > maxFound {
				maxFound = count
			}
		}

		info := eventInfo[group]
		allMatched := maxFound == expected && maxFound > 0
		matchType := info.matchType
		if matchType == "" {
			matchType = "-"
		}

		notes := ""
		if maxFound == 0 {
			notes = "Not found in test data"
		} else if maxFound < expected {
			notes = fmt.Sprintf("Missing %d days", expected-maxFound)
		}

		multiDayResults[group] = &MultiDayEventResult{
			EventGroup:   group,
			DaysExpected: expected,
			DaysFound:    maxFound,
			AllMatched:   allMatched,
			MatchType:    matchType,
			Notes:        notes,
		}
	}

	return multiDayResults
}

// generateUnmappedEventsReport creates a detailed markdown report for unmapped events (Phase 3)
func generateUnmappedEventsReport(t *testing.T, results []MatchResult) error {
	t.Helper()

	// Collect unmapped events using the UnmappedEventCollector
	collector := NewUnmappedEventCollector()

	for _, result := range results {
		if result.MatchedTag == "" {
			collector.AddUnmappedEvent(
				result.Title,
				result.Category,
				result.Date,
				result.Location,
				result.IsIsrael,
			)
		}
	}

	unmappedEvents := collector.GetUnmappedEvents()
	if len(unmappedEvents) == 0 {
		return nil
	}

	// Create output directory
	outputDir := filepath.Join("..", "..", "..", "_bmad-output")
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Create markdown file
	outputPath := filepath.Join(outputDir, "hebcal-audit-unmapped-events.md")
	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create report file: %w", err)
	}
	defer file.Close()

	// Write report header
	fmt.Fprintf(file, "# HebCal Unmapped Events - Gap Analysis Report\n\n")
	fmt.Fprintf(file, "**Generated:** 2025-12-25\n")
	fmt.Fprintf(file, "**Test Scope:** Hebrew Years 5775-5785 (10 years)\n")
	fmt.Fprintf(file, "**Locations:** Jerusalem (Israel mode), Salford (Diaspora mode)\n\n")
	fmt.Fprintf(file, "---\n\n")

	// Executive summary
	fmt.Fprintf(file, "## Executive Summary\n\n")
	fmt.Fprintf(file, "This report details all HebCal events that did not match any tag in the database.\n")
	fmt.Fprintf(file, "Each unmapped event represents a potential gap in coverage that requires a decision:\n\n")
	fmt.Fprintf(file, "- **Add New Tag** - Event should be tracked and displayed to users\n")
	fmt.Fprintf(file, "- **Extend Pattern** - Existing tag pattern should be modified to capture variation\n")
	fmt.Fprintf(file, "- **Intentional Ignore** - Event is not needed for the platform (e.g., Omer count, Torah readings)\n\n")
	fmt.Fprintf(file, "**Total Unmapped Events:** %d\n\n", len(unmappedEvents))
	fmt.Fprintf(file, "---\n\n")

	// Group events by category
	eventsByCategory := make(map[string][]*UnmappedEventInfo)
	for _, event := range unmappedEvents {
		eventsByCategory[event.Category] = append(eventsByCategory[event.Category], event)
	}

	// Get sorted categories
	categories := make([]string, 0, len(eventsByCategory))
	for cat := range eventsByCategory {
		categories = append(categories, cat)
	}
	sort.Strings(categories)

	// Write events grouped by category
	fmt.Fprintf(file, "## Unmapped Events by Category\n\n")

	eventNumber := 1
	for _, category := range categories {
		events := eventsByCategory[category]

		fmt.Fprintf(file, "### Category: %s (%d events)\n\n", category, len(events))

		for _, event := range events {
			// Determine location context
			locationContext := ""
			if len(event.Locations) == 1 {
				for loc := range event.Locations {
					locationContext = loc + " only"
				}
			} else {
				locationContext = "Both locations"
			}

			// Determine Israel mode context
			israelModeContext := ""
			israelCount := 0
			diasporaCount := 0
			for _, isIsrael := range event.IsIsraelSeen {
				if isIsrael {
					israelCount++
				} else {
					diasporaCount++
				}
			}
			if israelCount > 0 && diasporaCount > 0 {
				israelModeContext = "Both Israel and Diaspora modes"
			} else if israelCount > 0 {
				israelModeContext = "Israel mode only"
			} else {
				israelModeContext = "Diaspora mode only"
			}

			// Write event details
			fmt.Fprintf(file, "#### %d. \"%s\"\n\n", eventNumber, event.Title)
			fmt.Fprintf(file, "- **Category:** %s\n", event.Category)
			fmt.Fprintf(file, "- **First Date Seen:** %s\n", event.FirstDate)
			fmt.Fprintf(file, "- **Occurrences:** %d times across test period\n", len(event.Dates))
			fmt.Fprintf(file, "- **Locations:** %s\n", locationContext)
			fmt.Fprintf(file, "- **Israel Mode Context:** %s\n\n", israelModeContext)

			// Generate recommendation based on category and pattern
			recommendation := generateEventRecommendation(event)
			fmt.Fprintf(file, "**Recommendation:** %s\n\n", recommendation.Action)

			if recommendation.SQLExample != "" {
				fmt.Fprintf(file, "**SQL Example:**\n```sql\n%s\n```\n\n", recommendation.SQLExample)
			}

			if recommendation.Notes != "" {
				fmt.Fprintf(file, "**Notes:** %s\n\n", recommendation.Notes)
			}

			fmt.Fprintf(file, "---\n\n")
			eventNumber++
		}
	}

	// Analysis section
	fmt.Fprintf(file, "## Analysis: Common Gap Patterns\n\n")
	fmt.Fprintf(file, "### Why do these gaps exist?\n\n")

	// Analyze by category
	if categoryEvents, exists := eventsByCategory["omer"]; exists && len(categoryEvents) > 0 {
		fmt.Fprintf(file, "#### Omer Count Events (%d events)\n\n", len(categoryEvents))
		fmt.Fprintf(file, "HebCal returns daily Omer count events (49 days between Pesach and Shavuot).\n")
		fmt.Fprintf(file, "These are currently unmapped because:\n\n")
		fmt.Fprintf(file, "- The platform doesn't currently display Omer count zmanim\n")
		fmt.Fprintf(file, "- Adding a category tag `hebcal_omer` (hidden) would map but not display them\n")
		fmt.Fprintf(file, "- **Decision needed:** Should we track Omer count for future features?\n\n")
	}

	if categoryEvents, exists := eventsByCategory["parashat"]; exists && len(categoryEvents) > 0 {
		fmt.Fprintf(file, "#### Torah Reading Events (%d events)\n\n", len(categoryEvents))
		fmt.Fprintf(file, "HebCal returns weekly Torah portion names.\n")
		fmt.Fprintf(file, "These are already handled by the `hebcal_parashat` category tag (hidden).\n")
		fmt.Fprintf(file, "If unmapped, it indicates the category matching is not working correctly.\n\n")
	}

	// Observed fast days
	hasObservedFasts := false
	for _, events := range eventsByCategory {
		for _, event := range events {
			if strings.Contains(event.Title, "(observed)") {
				hasObservedFasts = true
				break
			}
		}
	}

	if hasObservedFasts {
		fmt.Fprintf(file, "#### Observed Fast Days\n\n")
		fmt.Fprintf(file, "Some fast days are postponed when they fall on Shabbat, resulting in titles like:\n")
		fmt.Fprintf(file, "- \"Tzom Gedaliah (observed)\"\n")
		fmt.Fprintf(file, "- \"Asara B'Tevet (observed)\"\n\n")
		fmt.Fprintf(file, "**Solution:** Change exact matches to group patterns that handle optional \" (observed)\" suffix.\n\n")
		fmt.Fprintf(file, "**Example:**\n")
		fmt.Fprintf(file, "```sql\n")
		fmt.Fprintf(file, "UPDATE zman_tags\n")
		fmt.Fprintf(file, "SET hebcal_match_type = 'group',\n")
		fmt.Fprintf(file, "    hebcal_match_pattern = '^Tzom Gedaliah( \\(observed\\))?$',\n")
		fmt.Fprintf(file, "    hebcal_match_string = NULL\n")
		fmt.Fprintf(file, "WHERE tag_key = 'tzom_gedaliah';\n")
		fmt.Fprintf(file, "```\n\n")
	}

	// Special variations
	fmt.Fprintf(file, "### Event Title Variations\n\n")
	fmt.Fprintf(file, "HebCal may return slightly different titles for the same event depending on:\n\n")
	fmt.Fprintf(file, "- **Year variations:** Leap years, calendar edge cases\n")
	fmt.Fprintf(file, "- **Location variations:** Jerusalem vs. diaspora (e.g., Shushan Purim)\n")
	fmt.Fprintf(file, "- **Transliteration:** Ashkenazi vs. Sephardi spelling\n")
	fmt.Fprintf(file, "- **Postponement:** Observed fast days when moved to Sunday\n\n")
	fmt.Fprintf(file, "Each variation should either:\n")
	fmt.Fprintf(file, "1. Be captured by existing regex patterns (group match)\n")
	fmt.Fprintf(file, "2. Have its own exact match entry\n")
	fmt.Fprintf(file, "3. Be documented as intentionally unmapped\n\n")

	fmt.Fprintf(file, "---\n\n")

	// Action Items
	fmt.Fprintf(file, "## Action Items\n\n")
	fmt.Fprintf(file, "For each unmapped event above:\n\n")
	fmt.Fprintf(file, "1. Review the event details and recommendation\n")
	fmt.Fprintf(file, "2. Decide on the appropriate action (add tag / extend pattern / ignore)\n")
	fmt.Fprintf(file, "3. If adding or extending, run the provided SQL\n")
	fmt.Fprintf(file, "4. Re-run the audit to verify 100%% coverage\n\n")

	fmt.Fprintf(file, "**Goal:** Zero unmapped events (all events either tagged or documented as intentional)\n\n")

	t.Logf("Generated unmapped events report: %s", outputPath)
	return nil
}

// EventRecommendation represents the recommended action for an unmapped event
type EventRecommendation struct {
	Action     string
	SQLExample string
	Notes      string
}

// generateEventRecommendation generates a recommendation for an unmapped event
func generateEventRecommendation(event *UnmappedEventInfo) EventRecommendation {
	// Omer count events
	if event.Category == "omer" {
		return EventRecommendation{
			Action: "Add category tag `hebcal_omer` (hidden)",
			SQLExample: `INSERT INTO zman_tags (
    tag_key,
    display_name_hebrew,
    display_name_english_ashkenazi,
    display_name_english_sephardi,
    tag_type_id,
    hebcal_match_type,
    hebcal_match_category,
    is_visible
) VALUES (
    'hebcal_omer',
    'ספירת העומר',
    'Omer Count',
    'Omer Count',
    170,  -- Hidden event tag type
    'category',
    'omer',
    false
);`,
			Notes: "This will map all 49 Omer count events without displaying them to users.",
		}
	}

	// Observed fast days
	if strings.Contains(event.Title, "(observed)") {
		baseTitle := event.Title[:len(event.Title)-len(" (observed)")]
		tagKey := titleToTagKey(baseTitle)

		return EventRecommendation{
			Action: "Extend existing tag pattern to handle '(observed)' suffix",
			SQLExample: fmt.Sprintf(`UPDATE zman_tags
SET hebcal_match_type = 'group',
    hebcal_match_pattern = '^%s( \(observed\))?$',
    hebcal_match_string = NULL
WHERE tag_key = '%s';`, baseTitle, tagKey),
			Notes: "Fast days are postponed when they fall on Shabbat. The pattern should match both regular and observed versions.",
		}
	}

	// Torah readings (parashat)
	if event.Category == "parashat" {
		return EventRecommendation{
			Action: "Verify category tag exists and matching is working",
			SQLExample: `-- Category tag should already exist:
SELECT * FROM zman_tags WHERE tag_key = 'hebcal_parashat';

-- If missing, add it:
INSERT INTO zman_tags (
    tag_key,
    display_name_hebrew,
    display_name_english_ashkenazi,
    display_name_english_sephardi,
    tag_type_id,
    hebcal_match_type,
    hebcal_match_category,
    is_visible
) VALUES (
    'hebcal_parashat',
    'פרשת השבוע',
    'Torah Portion',
    'Torah Portion',
    170,
    'category',
    'parashat',
    false
);`,
			Notes: "Torah readings are intentionally hidden but should still map via category matching.",
		}
	}

	// Candles/Havdalah/Mevarchim should be category-matched
	if event.Category == "candles" || event.Category == "havdalah" || event.Category == "mevarchim" {
		return EventRecommendation{
			Action: "Verify category tag exists",
			SQLExample: fmt.Sprintf(`-- Category tag should exist:
SELECT * FROM zman_tags WHERE hebcal_match_category = '%s';`, event.Category),
			Notes: fmt.Sprintf("Events with category '%s' should be automatically matched via category tag.", event.Category),
		}
	}

	// Special Shabbatot or holidays
	if event.Category == "holiday" || event.Category == "shabbat" {
		tagKey := titleToTagKey(event.Title)

		return EventRecommendation{
			Action: "Add new exact match tag",
			SQLExample: fmt.Sprintf(`INSERT INTO zman_tags (
    tag_key,
    display_name_hebrew,
    display_name_english_ashkenazi,
    display_name_english_sephardi,
    tag_type_id,
    hebcal_match_type,
    hebcal_match_string,
    is_visible
) VALUES (
    '%s',
    '[Hebrew Name]',
    '%s',
    '%s',
    [tag_type_id],  -- Choose appropriate type
    'exact',
    '%s',
    true  -- Set to false if should be hidden
);`, tagKey, event.Title, event.Title, event.Title),
			Notes: "New holiday or special Shabbat that should be tracked. Update Hebrew name and tag type as appropriate.",
		}
	}

	// Default recommendation
	return EventRecommendation{
		Action: "Investigate and decide: add tag, extend pattern, or intentionally ignore",
		Notes:  fmt.Sprintf("Category '%s' needs analysis to determine appropriate handling.", event.Category),
	}
}

// titleToTagKey converts an event title to a tag key
func titleToTagKey(title string) string {
	// Simple conversion: lowercase and replace spaces/apostrophes with underscores
	key := title
	key = strings.ToLower(key)
	key = strings.ReplaceAll(key, " ", "_")
	key = strings.ReplaceAll(key, "'", "")
	key = strings.ReplaceAll(key, "(", "")
	key = strings.ReplaceAll(key, ")", "")
	return key
}
