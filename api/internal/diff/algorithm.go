package diff

import (
	"encoding/json"
	"fmt"
	"sort"
)

// AlgorithmDiff represents the difference between two algorithm versions
type AlgorithmDiff struct {
	Summary       string       `json:"summary"`
	Changes       []ZmanChange `json:"changes"`
	AddedZmanim   []string     `json:"added_zmanim"`
	RemovedZmanim []string     `json:"removed_zmanim"`
	TotalChanges  int          `json:"total_changes"`
}

// ZmanChange represents a change to a specific zman field
type ZmanChange struct {
	ZmanKey    string `json:"zman_key"`
	ZmanName   string `json:"zman_name,omitempty"`
	Field      string `json:"field"`
	OldValue   string `json:"old_value"`
	NewValue   string `json:"new_value"`
	ChangeType string `json:"change_type"` // modified, added, removed
}

// ZmanConfig represents a zman configuration for comparison
type ZmanConfig struct {
	Key         string `json:"key"`
	NameEnglish string `json:"nameEnglish,omitempty"`
	NameHebrew  string `json:"nameHebrew,omitempty"`
	Formula     string `json:"formula,omitempty"`
	Method      string `json:"method,omitempty"`
	Enabled     bool   `json:"enabled,omitempty"`
}

// AlgorithmConfig represents the algorithm configuration structure
type AlgorithmConfig struct {
	Name        string       `json:"name,omitempty"`
	Description string       `json:"description,omitempty"`
	Template    string       `json:"template,omitempty"`
	Zmanim      []ZmanConfig `json:"zmanim,omitempty"`
}

// CompareAlgorithms compares two algorithm configurations and returns the differences
func CompareAlgorithms(v1Config, v2Config json.RawMessage) (*AlgorithmDiff, error) {
	var v1, v2 AlgorithmConfig

	if err := json.Unmarshal(v1Config, &v1); err != nil {
		return nil, fmt.Errorf("failed to parse v1 config: %w", err)
	}
	if err := json.Unmarshal(v2Config, &v2); err != nil {
		return nil, fmt.Errorf("failed to parse v2 config: %w", err)
	}

	diff := &AlgorithmDiff{
		Changes:       []ZmanChange{},
		AddedZmanim:   []string{},
		RemovedZmanim: []string{},
	}

	// Build maps by key for easy lookup
	v1Zmanim := make(map[string]ZmanConfig)
	v2Zmanim := make(map[string]ZmanConfig)

	for _, z := range v1.Zmanim {
		v1Zmanim[z.Key] = z
	}
	for _, z := range v2.Zmanim {
		v2Zmanim[z.Key] = z
	}

	// Get all unique keys
	allKeys := make(map[string]bool)
	for k := range v1Zmanim {
		allKeys[k] = true
	}
	for k := range v2Zmanim {
		allKeys[k] = true
	}

	// Sort keys for consistent output
	sortedKeys := make([]string, 0, len(allKeys))
	for k := range allKeys {
		sortedKeys = append(sortedKeys, k)
	}
	sort.Strings(sortedKeys)

	// Compare each zman
	for _, key := range sortedKeys {
		z1, exists1 := v1Zmanim[key]
		z2, exists2 := v2Zmanim[key]

		if !exists1 {
			// Added in v2
			diff.AddedZmanim = append(diff.AddedZmanim, key)
			continue
		}
		if !exists2 {
			// Removed in v2
			diff.RemovedZmanim = append(diff.RemovedZmanim, key)
			continue
		}

		// Compare fields
		zmanName := z1.NameEnglish
		if zmanName == "" {
			zmanName = key
		}

		// Compare formula
		if z1.Formula != z2.Formula {
			diff.Changes = append(diff.Changes, ZmanChange{
				ZmanKey:    key,
				ZmanName:   zmanName,
				Field:      "formula",
				OldValue:   z1.Formula,
				NewValue:   z2.Formula,
				ChangeType: "modified",
			})
		}

		// Compare English name
		if z1.NameEnglish != z2.NameEnglish {
			diff.Changes = append(diff.Changes, ZmanChange{
				ZmanKey:    key,
				ZmanName:   zmanName,
				Field:      "nameEnglish",
				OldValue:   z1.NameEnglish,
				NewValue:   z2.NameEnglish,
				ChangeType: "modified",
			})
		}

		// Compare Hebrew name
		if z1.NameHebrew != z2.NameHebrew {
			diff.Changes = append(diff.Changes, ZmanChange{
				ZmanKey:    key,
				ZmanName:   zmanName,
				Field:      "nameHebrew",
				OldValue:   z1.NameHebrew,
				NewValue:   z2.NameHebrew,
				ChangeType: "modified",
			})
		}

		// Compare method
		if z1.Method != z2.Method {
			diff.Changes = append(diff.Changes, ZmanChange{
				ZmanKey:    key,
				ZmanName:   zmanName,
				Field:      "method",
				OldValue:   z1.Method,
				NewValue:   z2.Method,
				ChangeType: "modified",
			})
		}

		// Compare enabled status
		if z1.Enabled != z2.Enabled {
			diff.Changes = append(diff.Changes, ZmanChange{
				ZmanKey:    key,
				ZmanName:   zmanName,
				Field:      "enabled",
				OldValue:   fmt.Sprintf("%v", z1.Enabled),
				NewValue:   fmt.Sprintf("%v", z2.Enabled),
				ChangeType: "modified",
			})
		}
	}

	// Check top-level config changes
	if v1.Name != v2.Name {
		diff.Changes = append(diff.Changes, ZmanChange{
			ZmanKey:    "_config",
			Field:      "name",
			OldValue:   v1.Name,
			NewValue:   v2.Name,
			ChangeType: "modified",
		})
	}

	if v1.Description != v2.Description {
		diff.Changes = append(diff.Changes, ZmanChange{
			ZmanKey:    "_config",
			Field:      "description",
			OldValue:   v1.Description,
			NewValue:   v2.Description,
			ChangeType: "modified",
		})
	}

	// Calculate total changes
	diff.TotalChanges = len(diff.Changes) + len(diff.AddedZmanim) + len(diff.RemovedZmanim)

	// Generate summary
	diff.Summary = generateSummary(diff)

	return diff, nil
}

func generateSummary(diff *AlgorithmDiff) string {
	if diff.TotalChanges == 0 {
		return "No changes detected between versions"
	}

	parts := []string{}

	if len(diff.AddedZmanim) > 0 {
		parts = append(parts, fmt.Sprintf("%d zmanim added", len(diff.AddedZmanim)))
	}
	if len(diff.RemovedZmanim) > 0 {
		parts = append(parts, fmt.Sprintf("%d zmanim removed", len(diff.RemovedZmanim)))
	}

	// Count unique modified zmanim
	modifiedZmanim := make(map[string]bool)
	for _, c := range diff.Changes {
		if c.ZmanKey != "_config" {
			modifiedZmanim[c.ZmanKey] = true
		}
	}
	if len(modifiedZmanim) > 0 {
		parts = append(parts, fmt.Sprintf("%d zmanim modified", len(modifiedZmanim)))
	}

	// Check for config changes
	configChanges := 0
	for _, c := range diff.Changes {
		if c.ZmanKey == "_config" {
			configChanges++
		}
	}
	if configChanges > 0 {
		parts = append(parts, fmt.Sprintf("%d config changes", configChanges))
	}

	if len(parts) == 0 {
		return "Minor changes"
	}

	result := ""
	for i, p := range parts {
		if i == 0 {
			result = p
		} else if i == len(parts)-1 {
			result += " and " + p
		} else {
			result += ", " + p
		}
	}

	return result
}
