package diff

import (
	"encoding/json"
	"testing"
)

// TestCompareAlgorithms_NoChanges tests comparing identical configs
func TestCompareAlgorithms_NoChanges(t *testing.T) {
	config := `{
		"name": "Test Algorithm",
		"zmanim": [
			{"key": "sunrise", "nameEnglish": "Sunrise", "formula": "sunrise"}
		]
	}`

	diff, err := CompareAlgorithms(json.RawMessage(config), json.RawMessage(config))
	if err != nil {
		t.Fatalf("CompareAlgorithms error: %v", err)
	}

	if diff.TotalChanges != 0 {
		t.Errorf("Expected 0 changes, got %d", diff.TotalChanges)
	}
}

// TestCompareAlgorithms_AddedZman tests detecting added zmanim
func TestCompareAlgorithms_AddedZman(t *testing.T) {
	v1 := `{
		"zmanim": [
			{"key": "sunrise", "nameEnglish": "Sunrise", "formula": "sunrise"}
		]
	}`
	v2 := `{
		"zmanim": [
			{"key": "sunrise", "nameEnglish": "Sunrise", "formula": "sunrise"},
			{"key": "sunset", "nameEnglish": "Sunset", "formula": "sunset"}
		]
	}`

	diff, err := CompareAlgorithms(json.RawMessage(v1), json.RawMessage(v2))
	if err != nil {
		t.Fatalf("CompareAlgorithms error: %v", err)
	}

	if len(diff.AddedZmanim) != 1 {
		t.Errorf("Expected 1 added zman, got %d", len(diff.AddedZmanim))
	}
	if diff.AddedZmanim[0] != "sunset" {
		t.Errorf("Expected 'sunset' to be added, got %s", diff.AddedZmanim[0])
	}
}

// TestCompareAlgorithms_RemovedZman tests detecting removed zmanim
func TestCompareAlgorithms_RemovedZman(t *testing.T) {
	v1 := `{
		"zmanim": [
			{"key": "sunrise", "nameEnglish": "Sunrise", "formula": "sunrise"},
			{"key": "sunset", "nameEnglish": "Sunset", "formula": "sunset"}
		]
	}`
	v2 := `{
		"zmanim": [
			{"key": "sunrise", "nameEnglish": "Sunrise", "formula": "sunrise"}
		]
	}`

	diff, err := CompareAlgorithms(json.RawMessage(v1), json.RawMessage(v2))
	if err != nil {
		t.Fatalf("CompareAlgorithms error: %v", err)
	}

	if len(diff.RemovedZmanim) != 1 {
		t.Errorf("Expected 1 removed zman, got %d", len(diff.RemovedZmanim))
	}
	if diff.RemovedZmanim[0] != "sunset" {
		t.Errorf("Expected 'sunset' to be removed, got %s", diff.RemovedZmanim[0])
	}
}

// TestCompareAlgorithms_ModifiedFormula tests detecting formula changes
func TestCompareAlgorithms_ModifiedFormula(t *testing.T) {
	v1 := `{
		"zmanim": [
			{"key": "alos", "nameEnglish": "Dawn", "formula": "sunrise - 72min"}
		]
	}`
	v2 := `{
		"zmanim": [
			{"key": "alos", "nameEnglish": "Dawn", "formula": "solar(16.1, before_sunrise)"}
		]
	}`

	diff, err := CompareAlgorithms(json.RawMessage(v1), json.RawMessage(v2))
	if err != nil {
		t.Fatalf("CompareAlgorithms error: %v", err)
	}

	if len(diff.Changes) != 1 {
		t.Errorf("Expected 1 change, got %d", len(diff.Changes))
	}

	change := diff.Changes[0]
	if change.ZmanKey != "alos" {
		t.Errorf("Expected zman key 'alos', got %s", change.ZmanKey)
	}
	if change.Field != "formula" {
		t.Errorf("Expected field 'formula', got %s", change.Field)
	}
	if change.OldValue != "sunrise - 72min" {
		t.Errorf("Expected old value 'sunrise - 72min', got %s", change.OldValue)
	}
	if change.NewValue != "solar(16.1, before_sunrise)" {
		t.Errorf("Expected new value 'solar(16.1, before_sunrise)', got %s", change.NewValue)
	}
}

// TestCompareAlgorithms_ModifiedName tests detecting name changes
func TestCompareAlgorithms_ModifiedName(t *testing.T) {
	v1 := `{
		"zmanim": [
			{"key": "sunrise", "nameEnglish": "Sunrise", "nameHebrew": "נץ", "formula": "sunrise"}
		]
	}`
	v2 := `{
		"zmanim": [
			{"key": "sunrise", "nameEnglish": "Sunrise (HaNetz)", "nameHebrew": "נץ החמה", "formula": "sunrise"}
		]
	}`

	diff, err := CompareAlgorithms(json.RawMessage(v1), json.RawMessage(v2))
	if err != nil {
		t.Fatalf("CompareAlgorithms error: %v", err)
	}

	// Should have 2 changes: nameEnglish and nameHebrew
	if len(diff.Changes) != 2 {
		t.Errorf("Expected 2 changes, got %d", len(diff.Changes))
	}

	fieldChanges := make(map[string]bool)
	for _, c := range diff.Changes {
		fieldChanges[c.Field] = true
	}

	if !fieldChanges["nameEnglish"] {
		t.Error("Expected nameEnglish change")
	}
	if !fieldChanges["nameHebrew"] {
		t.Error("Expected nameHebrew change")
	}
}

// TestCompareAlgorithms_ConfigChange tests detecting top-level config changes
func TestCompareAlgorithms_ConfigChange(t *testing.T) {
	v1 := `{
		"name": "My Algorithm",
		"description": "Original description",
		"zmanim": []
	}`
	v2 := `{
		"name": "My Algorithm v2",
		"description": "Updated description",
		"zmanim": []
	}`

	diff, err := CompareAlgorithms(json.RawMessage(v1), json.RawMessage(v2))
	if err != nil {
		t.Fatalf("CompareAlgorithms error: %v", err)
	}

	if len(diff.Changes) != 2 {
		t.Errorf("Expected 2 config changes, got %d", len(diff.Changes))
	}

	for _, c := range diff.Changes {
		if c.ZmanKey != "_config" {
			t.Errorf("Expected config change, got zman_key %s", c.ZmanKey)
		}
	}
}

// TestCompareAlgorithms_MultipleChanges tests complex diff with multiple change types
func TestCompareAlgorithms_MultipleChanges(t *testing.T) {
	v1 := `{
		"name": "GRA Algorithm",
		"zmanim": [
			{"key": "alos", "nameEnglish": "Dawn", "formula": "sunrise - 72min"},
			{"key": "sunrise", "nameEnglish": "Sunrise", "formula": "sunrise"},
			{"key": "old_zman", "nameEnglish": "Old", "formula": "sunset"}
		]
	}`
	v2 := `{
		"name": "GRA Algorithm v2",
		"zmanim": [
			{"key": "alos", "nameEnglish": "Alos Hashachar", "formula": "solar(16.1, before_sunrise)"},
			{"key": "sunrise", "nameEnglish": "Sunrise", "formula": "sunrise"},
			{"key": "new_zman", "nameEnglish": "New", "formula": "sunset + 18min"}
		]
	}`

	diff, err := CompareAlgorithms(json.RawMessage(v1), json.RawMessage(v2))
	if err != nil {
		t.Fatalf("CompareAlgorithms error: %v", err)
	}

	// Should have: 1 added, 1 removed, 2 modified (name + formula for alos), 1 config change
	if len(diff.AddedZmanim) != 1 {
		t.Errorf("Expected 1 added, got %d", len(diff.AddedZmanim))
	}
	if len(diff.RemovedZmanim) != 1 {
		t.Errorf("Expected 1 removed, got %d", len(diff.RemovedZmanim))
	}

	// Check summary is generated
	if diff.Summary == "" {
		t.Error("Expected non-empty summary")
	}
}

// TestGenerateSummary tests summary generation
func TestGenerateSummary(t *testing.T) {
	tests := []struct {
		name     string
		diff     *AlgorithmDiff
		contains string
	}{
		{
			name:     "no changes",
			diff:     &AlgorithmDiff{TotalChanges: 0},
			contains: "No changes",
		},
		{
			name: "added only",
			diff: &AlgorithmDiff{
				AddedZmanim:  []string{"sunset"},
				TotalChanges: 1,
			},
			contains: "1 zmanim added",
		},
		{
			name: "removed only",
			diff: &AlgorithmDiff{
				RemovedZmanim: []string{"old"},
				TotalChanges:  1,
			},
			contains: "1 zmanim removed",
		},
		{
			name: "modified only",
			diff: &AlgorithmDiff{
				Changes:      []ZmanChange{{ZmanKey: "alos", Field: "formula"}},
				TotalChanges: 1,
			},
			contains: "1 zmanim modified",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			summary := generateSummary(tt.diff)
			if summary == "" {
				t.Error("Expected non-empty summary")
			}
			// Just check it doesn't panic
		})
	}
}
