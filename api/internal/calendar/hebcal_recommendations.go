package calendar

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"testing"
)

// findUnusedTags queries the database for tags that were never matched in the audit
func findUnusedTags(t *testing.T, db *sql.DB, results []MatchResult) ([]UnusedTagInfo, error) {
	t.Helper()

	ctx := context.Background()

	// Build set of all matched tags
	matchedTags := make(map[string]bool)
	for _, result := range results {
		if result.MatchedTag != "" {
			matchedTags[result.MatchedTag] = true
		}
	}

	// Query all tags with HebCal matching configuration
	rows, err := db.QueryContext(ctx, `
		SELECT
			id,
			tag_key,
			display_name_hebrew,
			display_name_english_ashkenazi,
			hebcal_match_type,
			COALESCE(hebcal_match_string, '') as match_string,
			COALESCE(hebcal_match_pattern, '') as match_pattern,
			COALESCE(hebcal_match_category, '') as match_category,
			is_hidden
		FROM zman_tags
		WHERE hebcal_match_type IS NOT NULL
		ORDER BY tag_key
	`)
	if err != nil {
		return nil, fmt.Errorf("query tags: %w", err)
	}
	defer rows.Close()

	var unusedTags []UnusedTagInfo
	for rows.Next() {
		var tag UnusedTagInfo
		err := rows.Scan(
			&tag.TagID,
			&tag.TagKey,
			&tag.DisplayNameHebrew,
			&tag.DisplayNameEnglish,
			&tag.MatchType,
			&tag.MatchString,
			&tag.MatchPattern,
			&tag.MatchCategory,
			&tag.IsHidden,
		)
		if err != nil {
			return nil, fmt.Errorf("scan tag row: %w", err)
		}

		// Check if this tag was matched
		if !matchedTags[tag.TagKey] {
			unusedTags = append(unusedTags, tag)
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate tag rows: %w", err)
	}

	t.Logf("Found %d unused tags out of %d total HebCal-mappable tags", len(unusedTags), len(matchedTags)+len(unusedTags))

	return unusedTags, nil
}

// generateRecommendationsReport creates an actionable SQL recommendations report
func generateRecommendationsReport(t *testing.T, results []MatchResult, unusedTags []UnusedTagInfo) error {
	t.Helper()

	// Create output directory
	outputDir := filepath.Join("..", "..", "..", "_bmad-output")
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Create markdown file
	outputPath := filepath.Join(outputDir, "hebcal-audit-recommendations.md")
	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create recommendations file: %w", err)
	}
	defer file.Close()

	// Write header
	fmt.Fprintf(file, "# HebCal Tag Coverage - Actionable Recommendations\n\n")
	fmt.Fprintf(file, "**Generated:** %s\n", "2025-12-25")
	fmt.Fprintf(file, "**Purpose:** SQL statements to fix unmapped events and investigate unused tags\n\n")
	fmt.Fprintf(file, "---\n\n")

	// Collect unmapped events
	unmappedEvents := collectUnmappedEventsByPattern(results)

	if len(unmappedEvents) == 0 && len(unusedTags) == 0 {
		fmt.Fprintf(file, "## No Recommendations Needed\n\n")
		fmt.Fprintf(file, "All HebCal events are mapped and all tags are in use. Coverage is 100%%!\n")
		return nil
	}

	// Section 1: High Priority Fixes
	fmt.Fprintf(file, "## HIGH PRIORITY: Unmapped Events Requiring Action\n\n")

	if len(unmappedEvents) == 0 {
		fmt.Fprintf(file, "_No unmapped events found. All HebCal events are covered!_\n\n")
	} else {
		fmt.Fprintf(file, "These events from HebCal are not matching any tags. Review and apply SQL fixes below.\n\n")

		priorityCount := 0
		for _, event := range unmappedEvents {
			recommendation := analyzeUnmappedEvent(event)
			if recommendation.Priority == "HIGH" {
				priorityCount++
				writeRecommendation(file, recommendation)
			}
		}

		if priorityCount == 0 {
			fmt.Fprintf(file, "_All unmapped events are low priority or intentionally ignored._\n\n")
		}
	}

	// Section 2: Medium Priority Fixes
	fmt.Fprintf(file, "---\n\n")
	fmt.Fprintf(file, "## MEDIUM PRIORITY: Pattern Extensions\n\n")

	mediumCount := 0
	for _, event := range unmappedEvents {
		recommendation := analyzeUnmappedEvent(event)
		if recommendation.Priority == "MEDIUM" {
			mediumCount++
			writeRecommendation(file, recommendation)
		}
	}

	if mediumCount == 0 {
		fmt.Fprintf(file, "_No medium priority recommendations._\n\n")
	}

	// Section 3: Low Priority / Intentional Ignores
	fmt.Fprintf(file, "---\n\n")
	fmt.Fprintf(file, "## LOW PRIORITY: Review & Document\n\n")

	lowCount := 0
	for _, event := range unmappedEvents {
		recommendation := analyzeUnmappedEvent(event)
		if recommendation.Priority == "LOW" || recommendation.Priority == "IGNORE" {
			lowCount++
			writeRecommendation(file, recommendation)
		}
	}

	if lowCount == 0 {
		fmt.Fprintf(file, "_No low priority items._\n\n")
	}

	// Section 4: Unused Tags Investigation
	fmt.Fprintf(file, "---\n\n")
	fmt.Fprintf(file, "## UNUSED TAGS: Investigate Why No Matches\n\n")

	if len(unusedTags) == 0 {
		fmt.Fprintf(file, "_All tags were matched at least once across 10 years. Great coverage!_\n\n")
	} else {
		fmt.Fprintf(file, "These tags exist in the database but were never matched during the audit.\n")
		fmt.Fprintf(file, "Verify the patterns are correct or consider removing if obsolete.\n\n")

		for _, tag := range unusedTags {
			writeUnusedTagRecommendation(file, tag)
		}
	}

	// Summary footer
	fmt.Fprintf(file, "---\n\n")
	fmt.Fprintf(file, "## Summary\n\n")
	fmt.Fprintf(file, "- **Unmapped Events:** %d\n", len(unmappedEvents))
	fmt.Fprintf(file, "- **Unused Tags:** %d\n", len(unusedTags))
	fmt.Fprintf(file, "\n")
	fmt.Fprintf(file, "**Next Steps:**\n")
	fmt.Fprintf(file, "1. Review HIGH PRIORITY items and run SQL fixes\n")
	fmt.Fprintf(file, "2. Test changes with `./scripts/run-hebcal-matching-audit.sh`\n")
	fmt.Fprintf(file, "3. Investigate UNUSED TAGS to verify patterns\n")
	fmt.Fprintf(file, "4. Document any intentional ignores in this file\n")

	return nil
}

// UnmappedEventPattern represents a pattern of unmapped events
type UnmappedEventPattern struct {
	Title       string
	Category    string
	Occurrences int
	Locations   []string
}

// Recommendation represents an actionable SQL fix
type Recommendation struct {
	Priority string // HIGH, MEDIUM, LOW, IGNORE
	Title    string
	Category string
	Issue    string
	Action   string
	SQL      string
	Notes    string
}

// collectUnmappedEventsByPattern groups unmapped events by pattern
func collectUnmappedEventsByPattern(results []MatchResult) []UnmappedEventPattern {
	patterns := make(map[string]*UnmappedEventPattern)

	for _, result := range results {
		if result.MatchedTag != "" {
			continue // Skip mapped events
		}

		key := fmt.Sprintf("%s|%s", result.Title, result.Category)
		if pattern, exists := patterns[key]; exists {
			pattern.Occurrences++
			// Track unique locations
			locationFound := false
			for _, loc := range pattern.Locations {
				if loc == result.Location {
					locationFound = true
					break
				}
			}
			if !locationFound {
				pattern.Locations = append(pattern.Locations, result.Location)
			}
		} else {
			patterns[key] = &UnmappedEventPattern{
				Title:       result.Title,
				Category:    result.Category,
				Occurrences: 1,
				Locations:   []string{result.Location},
			}
		}
	}

	// Convert to slice and sort by occurrences
	var result []UnmappedEventPattern
	for _, pattern := range patterns {
		result = append(result, *pattern)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Occurrences > result[j].Occurrences
	})

	return result
}

// analyzeUnmappedEvent determines the priority and generates a recommendation
func analyzeUnmappedEvent(event UnmappedEventPattern) Recommendation {
	// Check for "(observed)" suffix pattern
	if len(event.Title) > 11 && event.Title[len(event.Title)-11:] == " (observed)" {
		baseTitle := event.Title[:len(event.Title)-11]
		return Recommendation{
			Priority: "HIGH",
			Title:    event.Title,
			Category: event.Category,
			Issue:    fmt.Sprintf("Event \"%s\" has \"(observed)\" suffix not matching exact pattern", event.Title),
			Action:   "Change to group match with optional suffix pattern",
			SQL: fmt.Sprintf(`-- Fix: "%s" not matching with "(observed)" suffix
UPDATE zman_tags
SET hebcal_match_type = 'group',
    hebcal_match_pattern = '^%s( \\(observed\\))?$',
    hebcal_match_string = NULL
WHERE hebcal_match_string = '%s';`, event.Title, escapeRegex(baseTitle), baseTitle),
			Notes: fmt.Sprintf("Occurs %d times across %v", event.Occurrences, event.Locations),
		}
	}

	// Check for Omer count events
	if event.Category == "omer" {
		return Recommendation{
			Priority: "MEDIUM",
			Title:    event.Title,
			Category: event.Category,
			Issue:    "Omer count events are not mapped",
			Action:   "Add category tag for Omer if tracking is desired",
			SQL: `-- Add Omer category tag (if needed for tracking)
INSERT INTO zman_tags (
    tag_key,
    display_name_hebrew,
    display_name_english_ashkenazi,
    tag_type_id,
    is_hidden,
    hebcal_match_type,
    hebcal_match_category
) VALUES (
    'hebcal_omer',
    'ספירת העומר',
    'Counting of the Omer',
    1,  -- tag_type_id for events
    true,  -- Hidden by default
    'category',
    'omer'
);`,
			Notes: "This will create a hidden tag for all 49 Omer days. Only add if you need to track Omer events.",
		}
	}

	// Check for parashat (Torah readings) - intentionally ignored
	if event.Category == "parashat" {
		return Recommendation{
			Priority: "IGNORE",
			Title:    event.Title,
			Category: event.Category,
			Issue:    "Parashat (Torah readings) not mapped",
			Action:   "Intentionally unmapped - already have hebcal_parashat category tag",
			SQL:      "-- No action needed - parashat events are tracked via category match",
			Notes:    "The hebcal_parashat tag uses category='parashat' match, which catches all Torah readings",
		}
	}

	// Check for candles/havdalah - should already be matched
	if event.Category == "candles" || event.Category == "havdalah" {
		return Recommendation{
			Priority: "HIGH",
			Title:    event.Title,
			Category: event.Category,
			Issue:    fmt.Sprintf("Category '%s' event not matching despite having category tag", event.Category),
			Action:   "INVESTIGATE - This should be matching via category tag",
			SQL:      fmt.Sprintf("-- INVESTIGATE: Why is category='%s' not matching?\n-- Check match_hebcal_event() function", event.Category),
			Notes:    "This is unexpected - all candles/havdalah should match automatically",
		}
	}

	// Default: Low priority unknown event
	return Recommendation{
		Priority: "LOW",
		Title:    event.Title,
		Category: event.Category,
		Issue:    "Unknown event type not currently mapped",
		Action:   "Review if this event should be tracked",
		SQL:      fmt.Sprintf("-- Manual review needed for: \"%s\" (category: %s)\n-- Decide: Add new tag, extend pattern, or intentionally ignore", event.Title, event.Category),
		Notes:    fmt.Sprintf("Occurs %d times. Review HebCal documentation for this event type.", event.Occurrences),
	}
}

// writeRecommendation writes a recommendation to the file
func writeRecommendation(file *os.File, rec Recommendation) {
	fmt.Fprintf(file, "### %s: %s\n\n", rec.Priority, rec.Title)
	fmt.Fprintf(file, "**Category:** %s  \n", rec.Category)
	fmt.Fprintf(file, "**Issue:** %s  \n", rec.Issue)
	fmt.Fprintf(file, "**Action:** %s  \n\n", rec.Action)

	if rec.SQL != "" {
		fmt.Fprintf(file, "```sql\n%s\n```\n\n", rec.SQL)
	}

	if rec.Notes != "" {
		fmt.Fprintf(file, "**Notes:** %s\n\n", rec.Notes)
	}

	fmt.Fprintf(file, "---\n\n")
}

// writeUnusedTagRecommendation writes unused tag info to the file
func writeUnusedTagRecommendation(file *os.File, tag UnusedTagInfo) {
	fmt.Fprintf(file, "### Tag: `%s`\n\n", tag.TagKey)
	fmt.Fprintf(file, "**Display Name:** %s (%s)  \n", tag.DisplayNameHebrew, tag.DisplayNameEnglish)
	fmt.Fprintf(file, "**Match Type:** %s  \n", tag.MatchType)

	switch tag.MatchType {
	case "exact":
		fmt.Fprintf(file, "**Match String:** \"%s\"  \n", tag.MatchString)
	case "group":
		fmt.Fprintf(file, "**Match Pattern:** `%s`  \n", tag.MatchPattern)
	case "category":
		fmt.Fprintf(file, "**Match Category:** %s  \n", tag.MatchCategory)
	}

	fmt.Fprintf(file, "**Hidden:** %v  \n\n", tag.IsHidden)

	fmt.Fprintf(file, "**Recommendation:**  \n")
	fmt.Fprintf(file, "- Verify the pattern is correct by checking HebCal API documentation\n")
	fmt.Fprintf(file, "- This tag may be for rare events not occurring in the 10-year test window (5775-5785)\n")
	fmt.Fprintf(file, "- Consider testing with a longer date range if this is a known event\n\n")

	fmt.Fprintf(file, "```sql\n")
	fmt.Fprintf(file, "-- If obsolete, consider removing:\n")
	fmt.Fprintf(file, "-- DELETE FROM zman_tags WHERE tag_key = '%s';\n", tag.TagKey)
	fmt.Fprintf(file, "```\n\n")
	fmt.Fprintf(file, "---\n\n")
}

// Helper functions for pattern analysis

func escapeRegex(text string) string {
	// Escape common regex special characters for PostgreSQL regex
	var result string
	for _, char := range text {
		switch char {
		case '(', ')', '[', ']', '.', '*', '+', '?', '^', '$', '|', '\\':
			result += "\\"
			result += string(char)
		default:
			result += string(char)
		}
	}
	return result
}
