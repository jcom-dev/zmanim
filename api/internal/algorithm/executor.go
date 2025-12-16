package algorithm

import (
	"fmt"
	"sort"
	"time"

	"github.com/jcom-dev/zmanim/internal/astro"
)

// Executor executes algorithm calculations
type Executor struct {
	date      time.Time
	latitude  float64
	longitude float64
	elevation float64 // Elevation in meters above sea level
	timezone  *time.Location

	// Cached core calculations
	sunTimes   *astro.SunTimes
	alos72     time.Time
	tzeis72    time.Time
	calculated map[string]time.Time
}

// NewExecutor creates a new algorithm executor (sea level)
func NewExecutor(date time.Time, latitude, longitude float64, tz *time.Location) *Executor {
	return NewExecutorWithElevation(date, latitude, longitude, 0, tz)
}

// NewExecutorWithElevation creates a new algorithm executor with elevation support
// Elevation is in meters above sea level and affects sunrise/sunset calculations
func NewExecutorWithElevation(date time.Time, latitude, longitude, elevation float64, tz *time.Location) *Executor {
	// Calculate core sun times with elevation adjustment
	sunTimes := astro.CalculateSunTimesWithElevation(date, latitude, longitude, elevation, tz)

	// Calculate alos/tzeis 72 for MGA calculations
	alos72 := astro.SubtractMinutes(sunTimes.Sunrise, 72)
	tzeis72 := astro.AddMinutes(sunTimes.Sunset, 72)

	return &Executor{
		date:       date,
		latitude:   latitude,
		longitude:  longitude,
		elevation:  elevation,
		timezone:   tz,
		sunTimes:   sunTimes,
		alos72:     alos72,
		tzeis72:    tzeis72,
		calculated: make(map[string]time.Time),
	}
}

// Execute runs the algorithm and returns all calculated zmanim
func (e *Executor) Execute(config *AlgorithmConfig) (*ZmanimResults, error) {
	results := &ZmanimResults{
		Date: e.date.Format("2006-01-02"),
		Location: LocationInfo{
			Latitude:  e.latitude,
			Longitude: e.longitude,
			Elevation: e.elevation,
			Timezone:  e.timezone.String(),
		},
		Zmanim: []ZmanResult{},
	}

	// First pass: calculate all zmanim that don't depend on others
	for zmanKey, zmanConfig := range config.Zmanim {
		if zmanConfig.Method != "midpoint" {
			t, err := e.calculateZman(zmanKey, &zmanConfig)
			if err != nil {
				return nil, fmt.Errorf("failed to calculate %s: %w", zmanKey, err)
			}
			e.calculated[zmanKey] = t
		}
	}

	// Second pass: calculate midpoint zmanim (which depend on others)
	for zmanKey, zmanConfig := range config.Zmanim {
		if zmanConfig.Method == "midpoint" {
			t, err := e.calculateZman(zmanKey, &zmanConfig)
			if err != nil {
				return nil, fmt.Errorf("failed to calculate %s: %w", zmanKey, err)
			}
			e.calculated[zmanKey] = t
		}
	}

	// Build ordered results
	// Note: Display names are populated by the handler from database (master_zmanim_registry)
	orderedKeys := getOrderedZmanimKeys(config)
	for _, key := range orderedKeys {
		zmanConfig := config.Zmanim[key]
		t := e.calculated[key]

		results.Zmanim = append(results.Zmanim, ZmanResult{
			Name:       key, // Handler will override with database-driven display name
			Key:        key,
			Time:       t,
			TimeString: astro.FormatTime(t),
			Formula:    GetFormulaInfo(key, &zmanConfig),
		})
	}

	return results, nil
}

// calculateZman calculates a single zman based on its configuration
func (e *Executor) calculateZman(key string, config *ZmanConfig) (time.Time, error) {
	switch config.Method {
	case "sunrise":
		return e.sunTimes.Sunrise, nil

	case "sunset":
		return e.sunTimes.Sunset, nil

	case "solar_angle":
		return e.calculateSolarAngle(config)

	case "fixed_minutes":
		return e.calculateFixedMinutes(config)

	case "proportional":
		return e.calculateProportional(config)

	case "midpoint":
		return e.calculateMidpoint(config)

	default:
		return time.Time{}, fmt.Errorf("unknown method: %s", config.Method)
	}
}

// calculateSolarAngle calculates time when sun is at a specific angle below horizon
func (e *Executor) calculateSolarAngle(config *ZmanConfig) (time.Time, error) {
	degrees := getFloat(config.Params, "degrees", 0)
	if degrees == 0 {
		return time.Time{}, fmt.Errorf("degrees parameter required for solar_angle method")
	}

	// Determine if this is a morning or evening time based on the degrees
	// Typically, alos/dawn times use larger angles (>10°) and are morning
	// tzeis/dusk times use smaller angles (<10°) and are evening
	// But we need to check the context - we return the appropriate time based on usage

	// Use elevation-adjusted calculation
	dawn, dusk := astro.SunTimeAtAngleWithElevation(e.date, e.latitude, e.longitude, e.elevation, e.timezone, degrees)

	// If degrees > 10, it's likely alos (return dawn)
	// If degrees < 10, it's likely tzeis (return dusk)
	// This is a heuristic - actual usage depends on zman name
	if degrees > 10 {
		return dawn, nil
	}
	return dusk, nil
}

// calculateFixedMinutes calculates time N minutes from a base time
func (e *Executor) calculateFixedMinutes(config *ZmanConfig) (time.Time, error) {
	minutes := getFloat(config.Params, "minutes", 0)
	from := getString(config.Params, "from", "sunset")

	var baseTime time.Time
	switch from {
	case "sunrise":
		baseTime = e.sunTimes.Sunrise
	case "sunset":
		baseTime = e.sunTimes.Sunset
	case "alos":
		// Look up calculated alos, or use 72 min before sunrise
		if t, ok := e.calculated["alos_hashachar"]; ok {
			baseTime = t
		} else {
			baseTime = e.alos72
		}
	case "tzeis":
		// Look up calculated tzeis, or use sunset
		if t, ok := e.calculated["tzeis_hakochavim"]; ok {
			baseTime = t
		} else {
			baseTime = e.sunTimes.Sunset
		}
	default:
		// Try to find it in calculated times
		if t, ok := e.calculated[from]; ok {
			baseTime = t
		} else {
			return time.Time{}, fmt.Errorf("unknown base time: %s", from)
		}
	}

	return astro.AddMinutes(baseTime, minutes), nil
}

// calculateProportional calculates proportional hours
func (e *Executor) calculateProportional(config *ZmanConfig) (time.Time, error) {
	hours := getFloat(config.Params, "hours", 0)
	base := getString(config.Params, "base", "gra")

	switch base {
	case "gra":
		return astro.ShaosZmaniyosGRA(e.sunTimes.Sunrise, e.sunTimes.Sunset, hours), nil
	case "mga":
		return astro.ShaosZmaniyosMGA(e.alos72, e.tzeis72, hours), nil
	default:
		return time.Time{}, fmt.Errorf("unknown proportional base: %s", base)
	}
}

// calculateMidpoint calculates the midpoint between two times
func (e *Executor) calculateMidpoint(config *ZmanConfig) (time.Time, error) {
	startKey := getString(config.Params, "start", "")
	endKey := getString(config.Params, "end", "")

	var startTime, endTime time.Time

	// Get start time
	switch startKey {
	case "sunrise":
		startTime = e.sunTimes.Sunrise
	case "sunset":
		startTime = e.sunTimes.Sunset
	default:
		if t, ok := e.calculated[startKey]; ok {
			startTime = t
		} else {
			return time.Time{}, fmt.Errorf("unknown start time: %s", startKey)
		}
	}

	// Get end time
	switch endKey {
	case "sunrise":
		endTime = e.sunTimes.Sunrise
	case "sunset":
		endTime = e.sunTimes.Sunset
	default:
		if t, ok := e.calculated[endKey]; ok {
			endTime = t
		} else {
			return time.Time{}, fmt.Errorf("unknown end time: %s", endKey)
		}
	}

	return astro.Midpoint(startTime, endTime), nil
}

// GetSunTimes returns the calculated sun times
func (e *Executor) GetSunTimes() *astro.SunTimes {
	return e.sunTimes
}

// getOrderedZmanimKeys returns zmanim keys in chronological order
func getOrderedZmanimKeys(config *AlgorithmConfig) []string {
	// Define standard order
	standardOrder := map[string]int{
		"alos_hashachar":     1,
		"misheyakir":         2,
		"sunrise":            3,
		"sof_zman_shma_mga":  4,
		"sof_zman_shma_gra":  5,
		"sof_zman_tfila_mga": 6,
		"sof_zman_tfila_gra": 7,
		"chatzos":            8,
		"mincha_gedola":      9,
		"mincha_ketana":      10,
		"plag_hamincha":      11,
		"sunset":             12,
		"tzais":              13,
		"tzais_72":           14,
	}

	keys := make([]string, 0, len(config.Zmanim))
	for key := range config.Zmanim {
		keys = append(keys, key)
	}

	sort.Slice(keys, func(i, j int) bool {
		oi := standardOrder[keys[i]]
		oj := standardOrder[keys[j]]
		if oi == 0 {
			oi = 100 // Unknown zmanim go at the end
		}
		if oj == 0 {
			oj = 100
		}
		return oi < oj
	})

	return keys
}
