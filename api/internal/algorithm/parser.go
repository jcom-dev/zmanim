package algorithm

import (
	"encoding/json"
	"fmt"
)

// ParseAlgorithm parses a JSON algorithm configuration
func ParseAlgorithm(configJSON []byte) (*AlgorithmConfig, error) {
	var config AlgorithmConfig
	if err := json.Unmarshal(configJSON, &config); err != nil {
		return nil, fmt.Errorf("failed to parse algorithm config: %w", err)
	}

	if err := ValidateAlgorithm(&config); err != nil {
		return nil, fmt.Errorf("invalid algorithm config: %w", err)
	}

	return &config, nil
}

// ValidateAlgorithm validates an algorithm configuration
func ValidateAlgorithm(config *AlgorithmConfig) error {
	if config.Name == "" {
		return fmt.Errorf("algorithm name is required")
	}

	if len(config.Zmanim) == 0 {
		return fmt.Errorf("algorithm must define at least one zman")
	}

	for name, zman := range config.Zmanim {
		if err := validateZmanConfig(name, &zman); err != nil {
			return err
		}
	}

	return nil
}

// validateZmanConfig validates a single zman configuration
func validateZmanConfig(name string, config *ZmanConfig) error {
	validMethods := map[string]bool{
		"sunrise":       true,
		"sunset":        true,
		"solar_angle":   true,
		"fixed_minutes": true,
		"proportional":  true,
		"midpoint":      true,
	}

	if !validMethods[config.Method] {
		return fmt.Errorf("invalid method '%s' for zman '%s'", config.Method, name)
	}

	switch config.Method {
	case "solar_angle":
		if _, ok := config.Params["degrees"]; !ok {
			return fmt.Errorf("solar_angle method requires 'degrees' parameter for zman '%s'", name)
		}
	case "fixed_minutes":
		if _, ok := config.Params["minutes"]; !ok {
			return fmt.Errorf("fixed_minutes method requires 'minutes' parameter for zman '%s'", name)
		}
		if _, ok := config.Params["from"]; !ok {
			return fmt.Errorf("fixed_minutes method requires 'from' parameter for zman '%s'", name)
		}
	case "proportional":
		if _, ok := config.Params["hours"]; !ok {
			return fmt.Errorf("proportional method requires 'hours' parameter for zman '%s'", name)
		}
		if _, ok := config.Params["base"]; !ok {
			return fmt.Errorf("proportional method requires 'base' parameter for zman '%s'", name)
		}
	case "midpoint":
		if _, ok := config.Params["start"]; !ok {
			return fmt.Errorf("midpoint method requires 'start' parameter for zman '%s'", name)
		}
		if _, ok := config.Params["end"]; !ok {
			return fmt.Errorf("midpoint method requires 'end' parameter for zman '%s'", name)
		}
	}

	return nil
}

// GetFormulaInfo returns human-readable formula information for a zman configuration
func GetFormulaInfo(zmanKey string, config *ZmanConfig) FormulaInfo {
	info := FormulaInfo{
		Method:     config.Method,
		Parameters: config.Params,
	}

	switch config.Method {
	case "sunrise":
		info.DisplayName = "Sunrise"
		info.Explanation = "The moment when the upper edge of the sun appears on the horizon"

	case "sunset":
		info.DisplayName = "Sunset"
		info.Explanation = "The moment when the upper edge of the sun disappears below the horizon"

	case "solar_angle":
		degrees := getFloat(config.Params, "degrees", 0)
		info.DisplayName = "Solar Depression Angle"
		info.Explanation = fmt.Sprintf("When the sun is %.1f° below the horizon", degrees)

	case "fixed_minutes":
		minutes := getFloat(config.Params, "minutes", 0)
		from := getString(config.Params, "from", "sunset")
		info.DisplayName = "Fixed Minutes"
		info.Explanation = fmt.Sprintf("%.0f minutes after %s", minutes, from)

	case "proportional":
		hours := getFloat(config.Params, "hours", 0)
		base := getString(config.Params, "base", "gra")
		baseName := "sunrise to sunset"
		if base == "mga" {
			baseName = "72 minutes before sunrise to 72 minutes after sunset"
		}
		info.DisplayName = "Proportional Hours"
		info.Explanation = fmt.Sprintf("%.2f proportional hours from %s", hours, baseName)

	case "midpoint":
		start := getString(config.Params, "start", "sunrise")
		end := getString(config.Params, "end", "sunset")
		info.DisplayName = "Midpoint"
		info.Explanation = fmt.Sprintf("Midpoint between %s and %s", start, end)
	}

	return info
}

// Helper functions for extracting typed values from params
func getFloat(params map[string]interface{}, key string, defaultVal float64) float64 {
	if val, ok := params[key]; ok {
		switch v := val.(type) {
		case float64:
			return v
		case int:
			return float64(v)
		case int64:
			return float64(v)
		}
	}
	return defaultVal
}

func getString(params map[string]interface{}, key string, defaultVal string) string {
	if val, ok := params[key]; ok {
		if s, ok := val.(string); ok {
			return s
		}
	}
	return defaultVal
}
