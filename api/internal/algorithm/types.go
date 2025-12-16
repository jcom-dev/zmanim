// Package algorithm provides parsing and execution of zmanim calculation algorithms
package algorithm

import "time"

// Method represents a calculation method type
type Method string

const (
	MethodSunrise      Method = "sunrise"
	MethodSunset       Method = "sunset"
	MethodSolarAngle   Method = "solar_angle"
	MethodFixedMinutes Method = "fixed_minutes"
	MethodProportional Method = "proportional"
	MethodMidpoint     Method = "midpoint"
)

// ProportionalBase represents the base for proportional calculations
type ProportionalBase string

const (
	BaseGRA ProportionalBase = "gra"
	BaseMGA ProportionalBase = "mga"
)

// TimeBase represents the base time for fixed minutes calculations
type TimeBase string

const (
	FromSunrise TimeBase = "sunrise"
	FromSunset  TimeBase = "sunset"
	FromAlos    TimeBase = "alos"
	FromTzeis   TimeBase = "tzeis"
)

// ZmanConfig represents the configuration for a single zman calculation
type ZmanConfig struct {
	Method string                 `json:"method"`
	Params map[string]interface{} `json:"params"`
}

// AlgorithmConfig represents a full algorithm configuration
type AlgorithmConfig struct {
	Name        string                `json:"name"`
	Description string                `json:"description,omitempty"`
	Version     string                `json:"version,omitempty"`
	Zmanim      map[string]ZmanConfig `json:"zmanim"`
}

// ZmanResult represents the result of a single zman calculation
type ZmanResult struct {
	Name       string      `json:"name"`
	Key        string      `json:"key"`
	Time       time.Time   `json:"-"`
	TimeString string      `json:"time"`
	Formula    FormulaInfo `json:"formula"`
}

// FormulaInfo contains details about how a zman was calculated
type FormulaInfo struct {
	Method      string                 `json:"method"`
	DisplayName string                 `json:"display_name"`
	Parameters  map[string]interface{} `json:"parameters"`
	Explanation string                 `json:"explanation"`
}

// ZmanimResults contains all calculated zmanim
type ZmanimResults struct {
	Date     string       `json:"date"`
	Location LocationInfo `json:"location"`
	Zmanim   []ZmanResult `json:"zmanim"`
}

// LocationInfo contains location details
type LocationInfo struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Elevation float64 `json:"elevation"` // Elevation in meters above sea level
	Timezone  string  `json:"timezone"`
	CityName  string  `json:"city_name,omitempty"`
}

// NOTE: Zman display names are now fetched from master_zmanim_registry table.
// The following deprecated constants have been removed in favor of database-driven values:
// - StandardZmanim (use master_zmanim_registry.is_core = true)
// - ZmanDisplayNames (use master_zmanim_registry.canonical_english_name)
// - ZmanBilingualNames (use master_zmanim_registry.canonical_hebrew_name + canonical_english_name)
// - GetBilingualName() and GetDisplayName() functions

// DefaultAlgorithm returns a standard algorithm configuration
func DefaultAlgorithm() *AlgorithmConfig {
	return &AlgorithmConfig{
		Name:        "Standard",
		Description: "Standard zmanim calculation using common methods",
		Version:     "1.0.0",
		Zmanim: map[string]ZmanConfig{
			"alos_hashachar": {
				Method: "solar_angle",
				Params: map[string]interface{}{"degrees": 16.1},
			},
			"misheyakir": {
				Method: "solar_angle",
				Params: map[string]interface{}{"degrees": 11.5},
			},
			"sunrise": {
				Method: "sunrise",
				Params: map[string]interface{}{},
			},
			"sof_zman_shma_gra": {
				Method: "proportional",
				Params: map[string]interface{}{"hours": 3.0, "base": "gra"},
			},
			"sof_zman_shma_mga": {
				Method: "proportional",
				Params: map[string]interface{}{"hours": 3.0, "base": "mga"},
			},
			"sof_zman_tfila_gra": {
				Method: "proportional",
				Params: map[string]interface{}{"hours": 4.0, "base": "gra"},
			},
			"sof_zman_tfila_mga": {
				Method: "proportional",
				Params: map[string]interface{}{"hours": 4.0, "base": "mga"},
			},
			"chatzos": {
				Method: "midpoint",
				Params: map[string]interface{}{"start": "sunrise", "end": "sunset"},
			},
			"mincha_gedola": {
				Method: "proportional",
				Params: map[string]interface{}{"hours": 6.5, "base": "gra"},
			},
			"mincha_ketana": {
				Method: "proportional",
				Params: map[string]interface{}{"hours": 9.5, "base": "gra"},
			},
			"plag_hamincha": {
				Method: "proportional",
				Params: map[string]interface{}{"hours": 10.75, "base": "gra"},
			},
			"sunset": {
				Method: "sunset",
				Params: map[string]interface{}{},
			},
			"tzais": {
				Method: "solar_angle",
				Params: map[string]interface{}{"degrees": 8.5},
			},
			"tzais_72": {
				Method: "fixed_minutes",
				Params: map[string]interface{}{"minutes": 72.0, "from": "sunset"},
			},
		},
	}
}
