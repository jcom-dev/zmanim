package dsl

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/jcom-dev/zmanim/internal/astro"
)

// TestValidationBaseline tests DSL formulas on three Jerusalem dates
// and outputs results to JSON for validation and reference
func TestValidationBaseline(t *testing.T) {
	// Test location: Jerusalem
	const (
		latitude  = 31.7683
		longitude = 35.2137
		elevation = 800.0 // meters
	)

	// Load timezone
	loc, err := time.LoadLocation("Asia/Jerusalem")
	if err != nil {
		t.Fatalf("Failed to load timezone: %v", err)
	}

	// Test dates
	testDates := []struct {
		name string
		date time.Time
	}{
		{
			name: "Winter Solstice",
			date: time.Date(2025, 12, 21, 0, 0, 0, 0, loc),
		},
		{
			name: "Spring Equinox",
			date: time.Date(2025, 3, 20, 0, 0, 0, 0, loc),
		},
		{
			name: "Summer Solstice",
			date: time.Date(2025, 6, 21, 0, 0, 0, 0, loc),
		},
	}

	// Test formulas (using CURRENT function names)
	testFormulas := []string{
		"visible_sunrise",
		"visible_sunset - 18min",
		"solar(-16.1, before_visible_sunrise)",
		"first_valid(solar(16.1, before_visible_sunrise), visible_sunrise - 72min)",
		"midpoint(visible_sunrise, visible_sunset)",
		"proportional_hours(3, gra)",
	}

	// Results structure for JSON output
	type FormulaResults struct {
		Date     string            `json:"date"`
		Name     string            `json:"name"`
		Formulas map[string]string `json:"formulas"`
	}

	var allResults []FormulaResults

	// Execute formulas for each date
	for _, td := range testDates {
		t.Run(td.name, func(t *testing.T) {
			// Create execution context
			ctx := NewExecutionContext(td.date, latitude, longitude, elevation, loc)

			results := FormulaResults{
				Date:     td.date.Format("2006-01-02"),
				Name:     td.name,
				Formulas: make(map[string]string),
			}

			// Execute each formula
			for _, formula := range testFormulas {
				result, err := ExecuteFormula(formula, ctx)
				if err != nil {
					t.Errorf("Formula %q failed: %v", formula, err)
					results.Formulas[formula] = "ERROR: " + err.Error()
				} else if result.IsZero() {
					t.Errorf("Formula %q returned zero time", formula)
					results.Formulas[formula] = "ERROR: zero time"
				} else {
					// Format time as HH:MM:SS
					timeStr := astro.FormatTime(result)
					results.Formulas[formula] = timeStr
					t.Logf("  %s = %s", formula, timeStr)
				}
			}

			allResults = append(allResults, results)
		})
	}

	// Write results to JSON file
	outputPath := filepath.Join("..", "..", "..", "docs", "sprint-artifacts", "baseline-test-results.json")

	// Create JSON with pretty printing
	jsonData, err := json.MarshalIndent(allResults, "", "  ")
	if err != nil {
		t.Fatalf("Failed to marshal JSON: %v", err)
	}

	// Write to file
	err = os.WriteFile(outputPath, jsonData, 0644)
	if err != nil {
		t.Fatalf("Failed to write JSON file: %v", err)
	}

	t.Logf("Baseline results written to: %s", outputPath)
}
