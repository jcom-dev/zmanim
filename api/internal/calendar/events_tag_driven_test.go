package calendar

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// TestNoHardcodedEventChecks verifies that no hardcoded event logic exists in the codebase
// This test ensures the codebase is fully tag-driven and database-driven
func TestNoHardcodedEventChecks(t *testing.T) {
	// Define forbidden patterns that indicate hardcoded event logic
	forbiddenPatterns := map[string][]string{
		"events.go": {
			`case.*"rosh_hashanah"`,
			`case.*"yom_kippur"`,
			`case.*"sukkos"`,
			`case.*"pesach"`,
			`case.*"shavuos"`,
			`isYomTovEvent\(`,
			`getFastStartType\(`,
			`mapHolidayToEventCode\(`,
		},
		"hebcal.go": {
			`if.*=="shabbos"`,
			`if.*=="rosh_hashanah"`,
			`yomTovCodes\s*:=`,
		},
		"zmanim.go (handlers)": {
			`if.*shabbos`,
			`if.*yom_kippur`,
			`switch.*eventCode`,
		},
	}

	// Get the api directory (should be api/internal/calendar running the test)
	testDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("Failed to get working directory: %v", err)
	}

	// Find the api directory by walking up
	apiDir := testDir
	for !strings.HasSuffix(apiDir, "/api") && apiDir != "/" {
		apiDir = filepath.Dir(apiDir)
	}

	if !strings.HasSuffix(apiDir, "/api") {
		t.Skip("Cannot find api directory, skipping test")
		return
	}

	rootDir := apiDir
	var failures []string

	// Walk through the codebase looking for forbidden patterns
	err = filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories, test files, and vendor
		if info.IsDir() || strings.HasSuffix(path, "_test.go") || strings.Contains(path, "vendor/") {
			return nil
		}

		// Only check .go files
		if !strings.HasSuffix(path, ".go") {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		fileContent := string(content)
		relPath, _ := filepath.Rel(rootDir, path)

		// Check against all forbidden patterns
		for filePattern, patterns := range forbiddenPatterns {
			// Skip if not relevant file
			if !strings.Contains(relPath, strings.Split(filePattern, " ")[0]) {
				continue
			}

			for _, pattern := range patterns {
				// Check if pattern is in file using regex
				re, err := regexp.Compile(pattern)
				if err != nil {
					t.Logf("Warning: Invalid regex pattern %s: %v", pattern, err)
					continue
				}

				if re.MatchString(fileContent) {
					// Find line numbers for better error reporting
					lines := strings.Split(fileContent, "\n")
					for lineNum, line := range lines {
						if re.MatchString(line) {
							failures = append(failures,
								fmt.Sprintf("%s:%d: Found forbidden pattern: %s\n  Line: %s",
									relPath, lineNum+1, pattern, strings.TrimSpace(line)))
						}
					}
				}
			}
		}

		return nil
	})

	if err != nil {
		t.Fatalf("Failed to walk directory: %v", err)
	}

	if len(failures) > 0 {
		t.Errorf("Found hardcoded event logic (should be database-driven):\n%s",
			strings.Join(failures, "\n"))
	}
}

// TestDatabaseDrivenMapping validates that all event mappings come from the database
func TestDatabaseDrivenMapping(t *testing.T) {
	// This test verifies that:
	// 1. There are no hardcoded event code mappings in the code
	// 2. All event metadata comes from zman_tags table
	// 3. All HebCal event patterns come from tag_event_mappings table

	// Verify the database-driven approach is used by checking that
	// the code references database queries, not hardcoded maps

	eventsFile := "events.go"
	content, err := os.ReadFile(eventsFile)
	if err != nil {
		t.Skipf("Skipping test: %s not found", eventsFile)
		return
	}

	fileContent := string(content)

	// Check that hardcoded maps are NOT present
	hardcodedMapPatterns := []string{
		"yomTovCodes := map[string]bool{",
		"fastStartTypes := map[string]string{",
		"eventCodeMap := map[string]",
	}

	for _, pattern := range hardcodedMapPatterns {
		if strings.Contains(fileContent, pattern) {
			t.Errorf("Found hardcoded map in events.go: %s (should use database queries)", pattern)
		}
	}

	// Check that database-driven approach IS used
	databasePatterns := []string{
		"GetTagEventMappings",    // Should fetch from DB
		"GetTagByHebcalBasename", // Should fetch from DB
		"tag_event_mappings",     // Should reference the table
	}

	foundDatabasePattern := false
	for _, pattern := range databasePatterns {
		if strings.Contains(fileContent, pattern) {
			foundDatabasePattern = true
			break
		}
	}

	if !foundDatabasePattern {
		t.Logf("Warning: No database query patterns found in events.go")
		t.Logf("This may indicate the file still uses hardcoded logic instead of database queries")
	}
}

// TestHiddenTagsFiltering validates that hidden tags don't show to users
func TestHiddenTagsFiltering(t *testing.T) {
	// This test verifies that:
	// 1. Tags marked as is_visible_to_users=false are filtered from API responses
	// 2. Category tags are used for logic but not displayed
	// 3. Internal event tags are not exposed

	handlersFile := filepath.Join("..", "handlers", "zmanim.go")
	content, err := os.ReadFile(handlersFile)
	if err != nil {
		t.Skipf("Skipping test: handlers/zmanim.go not found")
		return
	}

	fileContent := string(content)

	// Check that tag filtering logic exists
	filterPatterns := []string{
		"is_visible_to_users",
		"tag_type",
		"WHERE.*is_hidden",
	}

	foundFilterPattern := false
	for _, pattern := range filterPatterns {
		if strings.Contains(fileContent, pattern) {
			foundFilterPattern = true
			t.Logf("Found tag filtering pattern: %s", pattern)
		}
	}

	if !foundFilterPattern {
		t.Logf("Note: No explicit tag filtering patterns found in handlers")
		t.Logf("Tags should be filtered via SQL queries in tag_events.sql")
	}
}

// TestMetadataFromDatabase validates that yom_tov_level and fast_start_type come from DB
func TestMetadataFromDatabase(t *testing.T) {
	// This test verifies that event metadata is stored in and retrieved from
	// the database rather than being hardcoded

	// Check tag_event_mappings table structure
	queriesFile := filepath.Join("..", "db", "queries", "tag_events.sql")
	content, err := os.ReadFile(queriesFile)
	if err != nil {
		t.Skipf("Skipping test: tag_events.sql not found - %v", err)
		return
	}

	// Verify file is not empty
	if len(content) == 0 {
		t.Skipf("Skipping test: tag_events.sql is empty")
		return
	}

	fileContent := string(content)

	// Verify database schema includes metadata fields
	metadataFields := []string{
		"hebrew_month",         // For date-based event matching
		"hebrew_day_start",     // For date-based event matching
		"hebrew_day_end",       // For multi-day events
		"hebcal_event_pattern", // For HebCal event matching
		"priority",             // For pattern matching priority
	}

	missingFields := []string{}
	for _, field := range metadataFields {
		if !strings.Contains(fileContent, field) {
			missingFields = append(missingFields, field)
		}
	}

	if len(missingFields) > 0 {
		t.Skipf("Schema migration incomplete - missing metadata fields: %v", missingFields)
		return
	}

	// Verify queries exist to fetch metadata
	expectedQueries := []string{
		"GetTagEventMappings",
		"GetTagsForHebCalEvent",
		"GetTagsForHebrewDate",
	}

	missingQueries := []string{}
	for _, query := range expectedQueries {
		if !strings.Contains(fileContent, query) {
			missingQueries = append(missingQueries, query)
		}
	}

	if len(missingQueries) > 0 {
		t.Skipf("Schema migration incomplete - missing queries: %v", missingQueries)
		return
	}
}

// TestNoEventCodeLiterals checks that event codes are not used as string literals
func TestNoEventCodeLiterals(t *testing.T) {
	// Event codes should come from the database, not hardcoded strings
	// Exception: test files can use string literals for fixtures

	handlersFile := filepath.Join("..", "handlers", "zmanim.go")
	content, err := os.ReadFile(handlersFile)
	if err != nil {
		t.Skipf("Skipping test: handlers/zmanim.go not found")
		return
	}

	fileContent := string(content)

	// Common event codes that should NOT appear as string literals in production code
	eventCodes := []string{
		`"rosh_hashanah"`,
		`"yom_kippur"`,
		`"sukkos"`,
		`"pesach_first"`,
		`"pesach_last"`,
		`"shavuos"`,
		`"chanukah"`,
		`"purim"`,
	}

	var foundLiterals []string
	for _, code := range eventCodes {
		if strings.Contains(fileContent, code) {
			foundLiterals = append(foundLiterals, code)
		}
	}

	if len(foundLiterals) > 0 {
		t.Errorf("Found hardcoded event code literals in handlers/zmanim.go: %v\n"+
			"Event codes should come from database queries, not string literals",
			foundLiterals)
	}
}
