// File: executor.go
// Purpose: DSL formula execution engine - primitives, solar angles, time arithmetic
// Pattern: calculation-engine
// Dependencies: astro/sun.go for solar calculations
// Frequency: critical - used by all zmanim calculations
// Compliance: Check docs/adr/ for pattern rationale

package dsl

import (
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/jcom-dev/zmanim/internal/astro"
)

// ExecutionContext provides all the data needed to execute a DSL formula
type ExecutionContext struct {
	Date      time.Time
	Latitude  float64
	Longitude float64
	Elevation float64
	Timezone  *time.Location

	// Cached astronomical primitives (computed lazily)
	sunTimes *astro.SunTimes

	// Publisher's zmanim for references (computed in dependency order)
	ZmanimCache map[string]time.Time
}

// NewExecutionContext creates a new execution context
func NewExecutionContext(date time.Time, latitude, longitude, elevation float64, tz *time.Location) *ExecutionContext {
	return &ExecutionContext{
		Date:        date,
		Latitude:    latitude,
		Longitude:   longitude,
		Elevation:   elevation,
		Timezone:    tz,
		ZmanimCache: make(map[string]time.Time),
	}
}

// getSunTimes lazily computes and caches sun times (with elevation support)
func (ctx *ExecutionContext) getSunTimes() *astro.SunTimes {
	if ctx.sunTimes == nil {
		ctx.sunTimes = astro.CalculateSunTimesWithElevation(ctx.Date, ctx.Latitude, ctx.Longitude, ctx.Elevation, ctx.Timezone)
	}
	return ctx.sunTimes
}

// DayLength returns the day length in minutes
func (ctx *ExecutionContext) DayLength() float64 {
	st := ctx.getSunTimes()
	return st.DayLengthMinutes
}

// Month returns the month (1-12)
func (ctx *ExecutionContext) Month() int {
	return int(ctx.Date.Month())
}

// Day returns the day of month (1-31)
func (ctx *ExecutionContext) Day() int {
	return ctx.Date.Day()
}

// DayOfYear returns the day of year (1-366)
func (ctx *ExecutionContext) DayOfYear() int {
	return ctx.Date.YearDay()
}

// Season returns the season based on month and hemisphere
func (ctx *ExecutionContext) Season() string {
	month := ctx.Month()
	isNorthern := ctx.Latitude >= 0

	// Northern hemisphere seasons
	switch {
	case month >= 3 && month <= 5:
		if isNorthern {
			return "spring"
		}
		return "autumn"
	case month >= 6 && month <= 8:
		if isNorthern {
			return "summer"
		}
		return "winter"
	case month >= 9 && month <= 11:
		if isNorthern {
			return "autumn"
		}
		return "spring"
	default: // Dec, Jan, Feb
		if isNorthern {
			return "winter"
		}
		return "summer"
	}
}

// Executor executes DSL AST nodes
type Executor struct {
	ctx    *ExecutionContext
	errors ErrorList
}

// NewExecutor creates a new executor
func NewExecutor(ctx *ExecutionContext) *Executor {
	return &Executor{ctx: ctx}
}

// Execute executes a DSL formula and returns the calculated time
func Execute(node Node, ctx *ExecutionContext) (time.Time, error) {
	executor := NewExecutor(ctx)
	result := executor.executeNode(node)
	if executor.errors.HasErrors() {
		return time.Time{}, &executor.errors
	}
	return result.Time, nil
}

// ExecuteWithBreakdown executes a DSL formula and returns calculation breakdown
func ExecuteWithBreakdown(node Node, ctx *ExecutionContext) (time.Time, []CalculationStep, error) {
	executor := NewExecutor(ctx)
	// Only initialize cache if not already set (preserves pre-populated references)
	if executor.ctx.ZmanimCache == nil {
		executor.ctx.ZmanimCache = make(map[string]time.Time)
	}

	result := executor.executeNode(node)
	if executor.errors.HasErrors() {
		return time.Time{}, nil, &executor.errors
	}

	// Build breakdown from cache
	breakdown := make([]CalculationStep, 0, len(ctx.ZmanimCache))
	for key, val := range ctx.ZmanimCache {
		breakdown = append(breakdown, CalculationStep{
			Step:  key,
			Value: astro.FormatTime(val),
		})
	}

	return result.Time, breakdown, nil
}

// CalculationStep represents a step in the calculation breakdown
type CalculationStep struct {
	Step  string `json:"step"`
	Value string `json:"value"`
}

// Value represents a computed value (either Time or Duration)
type Value struct {
	Type     ValueType
	Time     time.Time
	Duration time.Duration
	Number   float64
	String   string
	Boolean  bool
}

// executeNode executes a single AST node
func (e *Executor) executeNode(node Node) Value {
	if node == nil {
		e.addError("nil node")
		return Value{}
	}

	switch n := node.(type) {
	case *PrimitiveNode:
		return e.executePrimitive(n)
	case *FunctionNode:
		return e.executeFunction(n)
	case *BinaryOpNode:
		return e.executeBinaryOp(n)
	case *DurationNode:
		return Value{Type: ValueTypeDuration, Duration: time.Duration(n.Minutes * float64(time.Minute))}
	case *NumberNode:
		return Value{Type: ValueTypeNumber, Number: n.Value}
	case *StringNode:
		return Value{Type: ValueTypeString, String: n.Value}
	case *ReferenceNode:
		return e.executeReference(n)
	case *ConditionalNode:
		return e.executeConditional(n)
	case *ConditionNode:
		return e.executeCondition(n)
	case *LogicalOpNode:
		return e.executeLogicalOp(n)
	case *NotOpNode:
		return e.executeNotOp(n)
	case *ConditionVarNode:
		return e.executeConditionVar(n)
	case *DateLiteralNode:
		return e.executeDateLiteral(n)
	case *DirectionNode:
		return Value{Type: ValueTypeString, String: n.Direction}
	case *BaseNode:
		// BaseNode is handled within executeFunction for proportional_hours
		return Value{Type: ValueTypeString, String: n.Base}
	default:
		e.addError("unknown node type: %T", node)
		return Value{}
	}
}

// executePrimitive evaluates a primitive time (visible_sunrise, visible_sunset, etc.)
func (e *Executor) executePrimitive(n *PrimitiveNode) Value {
	st := e.ctx.getSunTimes()

	var t time.Time
	switch n.Name {
	case "visible_sunrise":
		// Visible sunrise accounts for atmospheric refraction (~0.833°)
		t = st.Sunrise
	case "visible_sunset":
		// Visible sunset accounts for atmospheric refraction (~0.833°)
		t = st.Sunset
	case "sunrise":
		// Backward compatibility alias for visible_sunrise
		t = st.Sunrise
	case "sunset":
		// Backward compatibility alias for visible_sunset
		t = st.Sunset
	case "solar_noon":
		t = st.SolarNoon
	case "solar_midnight":
		// Solar midnight is 12 hours from solar noon
		t = st.SolarNoon.Add(-12 * time.Hour)
	case "geometric_sunrise":
		// True geometric sunrise - sun center at horizon (90°), no refraction
		t, _ = astro.SunTimeAtAngle(e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Timezone, 0)
	case "geometric_sunset":
		// True geometric sunset - sun center at horizon (90°), no refraction
		_, t = astro.SunTimeAtAngle(e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Timezone, 0)
	case "civil_dawn":
		// Sun at -6° below horizon (morning)
		t, _ = astro.SunTimeAtAngle(e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Timezone, 6)
	case "civil_dusk":
		// Sun at -6° below horizon (evening)
		_, t = astro.SunTimeAtAngle(e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Timezone, 6)
	case "nautical_dawn":
		// Sun at -12° below horizon (morning)
		t, _ = astro.SunTimeAtAngle(e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Timezone, 12)
	case "nautical_dusk":
		// Sun at -12° below horizon (evening)
		_, t = astro.SunTimeAtAngle(e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Timezone, 12)
	case "astronomical_dawn":
		// Sun at -18° below horizon (morning)
		t, _ = astro.SunTimeAtAngle(e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Timezone, 18)
	case "astronomical_dusk":
		// Sun at -18° below horizon (evening)
		_, t = astro.SunTimeAtAngle(e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Timezone, 18)
	default:
		e.addError("unknown primitive: %s", n.Name)
		return Value{}
	}

	if t.IsZero() {
		e.addError("could not calculate %s (polar region or invalid date)", n.Name)
		return Value{}
	}

	// Cache the primitive value
	e.ctx.ZmanimCache[n.Name] = t

	return Value{Type: ValueTypeTime, Time: t}
}

// executeFunction evaluates a function call (solar, seasonal_solar, proportional_hours, proportional_minutes, midpoint, first_valid, earlier_of, later_of)
func (e *Executor) executeFunction(n *FunctionNode) Value {
	switch n.Name {
	case "solar":
		return e.executeSolar(n)
	case "seasonal_solar":
		return e.executeSeasonalSolar(n)
	case "proportional_hours":
		return e.executeProportionalHours(n)
	case "proportional_minutes":
		return e.executeProportionalMinutes(n)
	case "midpoint":
		return e.executeMidpoint(n)
	case "first_valid":
		return e.executeFirstValid(n)
	case "earlier_of":
		return e.executeEarlierOf(n)
	case "later_of":
		return e.executeLaterOf(n)
	default:
		e.addError("unknown function: %s", n.Name)
		return Value{}
	}
}

// executeSolar evaluates solar(degrees, direction)
func (e *Executor) executeSolar(n *FunctionNode) Value {
	if len(n.Args) != 2 {
		e.addError("solar() requires 2 arguments")
		return Value{}
	}

	// Get degrees
	degreesVal := e.executeNode(n.Args[0])
	if degreesVal.Type != ValueTypeNumber {
		e.addError("solar() first argument must be a number (degrees)")
		return Value{}
	}
	degrees := degreesVal.Number

	// Get direction
	var direction string
	switch arg := n.Args[1].(type) {
	case *DirectionNode:
		direction = arg.Direction
	case *StringNode:
		direction = arg.Value
	default:
		dirVal := e.executeNode(n.Args[1])
		direction = dirVal.String
	}

	// Calculate sun time at angle
	dawn, dusk := astro.SunTimeAtAngle(e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Timezone, degrees)

	var t time.Time
	switch direction {
	// Backward compatibility aliases (default to visible sunrise/sunset)
	case "before_sunrise":
		t = dawn
	case "after_sunrise":
		t = dawn
	case "after_sunset":
		t = dusk

	// Visible sunrise/sunset directions (standard - includes atmospheric refraction)
	case "before_visible_sunrise":
		t = dawn
	case "after_visible_sunrise":
		t = dawn
	case "before_visible_sunset":
		t = dusk
	case "after_visible_sunset":
		t = dusk

	// Geometric sunrise/sunset directions (pure geometric - no refraction)
	case "before_geometric_sunrise":
		t = dawn
	case "after_geometric_sunrise":
		t = dawn
	case "before_geometric_sunset":
		t = dusk
	case "after_geometric_sunset":
		t = dusk

	// Solar noon directions
	case "before_noon":
		t = dawn
	case "after_noon":
		t = dusk

	default:
		e.addError("invalid direction: %s", direction)
		return Value{}
	}

	if t.IsZero() {
		e.addError("could not calculate solar(%g, %s) - polar region or invalid parameters", degrees, direction)
		return Value{}
	}

	// Cache the result
	stepName := fmt.Sprintf("solar(%.1f, %s)", degrees, direction)
	e.ctx.ZmanimCache[stepName] = t

	return Value{Type: ValueTypeTime, Time: t}
}

// executeSeasonalSolar evaluates seasonal_solar(degrees, direction)
// This uses the seasonal proportional method: calculates the offset from sunrise/sunset
// at the equinox for the given angle, then scales it by the current day's length ratio.
// This matches the ROY/Zemaneh-Yosef calculation methodology.
func (e *Executor) executeSeasonalSolar(n *FunctionNode) Value {
	if len(n.Args) != 2 {
		e.addError("seasonal_solar() requires 2 arguments")
		return Value{}
	}

	// Get degrees
	degreesVal := e.executeNode(n.Args[0])
	if degreesVal.Type != ValueTypeNumber {
		e.addError("seasonal_solar() first argument must be a number (degrees)")
		return Value{}
	}
	degrees := degreesVal.Number

	// Get direction
	var direction string
	switch arg := n.Args[1].(type) {
	case *DirectionNode:
		direction = arg.Direction
	case *StringNode:
		direction = arg.Value
	default:
		dirVal := e.executeNode(n.Args[1])
		direction = dirVal.String
	}

	// Calculate seasonal sun time at angle
	dawn, dusk := astro.SeasonalSunTimeAtAngle(e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Timezone, degrees)

	var t time.Time
	switch direction {
	case "before_visible_sunrise":
		t = dawn
	case "after_visible_sunset":
		t = dusk
	case "before_geometric_sunrise":
		t = dawn
	case "after_geometric_sunset":
		t = dusk
	default:
		e.addError("seasonal_solar() invalid direction: %s (must be before_visible_sunrise, after_visible_sunset, before_geometric_sunrise, or after_geometric_sunset)", direction)
		return Value{}
	}

	if t.IsZero() {
		e.addError("could not calculate seasonal_solar(%g, %s) - polar region or invalid parameters", degrees, direction)
		return Value{}
	}

	// Cache the result
	stepName := fmt.Sprintf("seasonal_solar(%.1f, %s)", degrees, direction)
	e.ctx.ZmanimCache[stepName] = t

	return Value{Type: ValueTypeTime, Time: t}
}

// executeProportionalHours evaluates proportional_hours(hours, base)
func (e *Executor) executeProportionalHours(n *FunctionNode) Value {
	if len(n.Args) != 2 {
		e.addError("proportional_hours() requires 2 arguments")
		return Value{}
	}

	// Get hours
	hoursVal := e.executeNode(n.Args[0])
	if hoursVal.Type != ValueTypeNumber {
		e.addError("proportional_hours() first argument must be a number (hours)")
		return Value{}
	}
	hours := hoursVal.Number

	// Get base
	baseNode, ok := n.Args[1].(*BaseNode)
	if !ok {
		e.addError("proportional_hours() second argument must be a base (gra, mga, etc.)")
		return Value{}
	}

	st := e.ctx.getSunTimes()
	var t time.Time

	switch baseNode.Base {
	case "gra":
		// GRA: sunrise to sunset
		t = astro.ShaosZmaniyosGRA(st.Sunrise, st.Sunset, hours)

	case "mga", "mga_72":
		// MGA: (sunrise - 72min) to (sunset + 72min)
		alos72 := astro.SubtractMinutes(st.Sunrise, 72)
		tzeis72 := astro.AddMinutes(st.Sunset, 72)
		t = astro.ShaosZmaniyosMGA(alos72, tzeis72, hours)

	case "mga_60":
		// MGA 60: (sunrise - 60min) to (sunset + 60min)
		alos60 := astro.SubtractMinutes(st.Sunrise, 60)
		tzeis60 := astro.AddMinutes(st.Sunset, 60)
		t = astro.ShaosZmaniyosCustom(alos60, tzeis60, hours)

	case "mga_90":
		// MGA 90: (sunrise - 90min) to (sunset + 90min)
		alos90 := astro.SubtractMinutes(st.Sunrise, 90)
		tzeis90 := astro.AddMinutes(st.Sunset, 90)
		t = astro.ShaosZmaniyosCustom(alos90, tzeis90, hours)

	case "mga_96":
		// MGA 96: (sunrise - 96min) to (sunset + 96min)
		alos96 := astro.SubtractMinutes(st.Sunrise, 96)
		tzeis96 := astro.AddMinutes(st.Sunset, 96)
		t = astro.ShaosZmaniyosCustom(alos96, tzeis96, hours)

	case "mga_120":
		// MGA 120: (sunrise - 120min) to (sunset + 120min)
		alos120 := astro.SubtractMinutes(st.Sunrise, 120)
		tzeis120 := astro.AddMinutes(st.Sunset, 120)
		t = astro.ShaosZmaniyosCustom(alos120, tzeis120, hours)

	case "mga_72_zmanis":
		// MGA 72 zmaniyos: 1/10th of day before sunrise to 1/10th after sunset
		// Proportional to day length (72 min = 1/10 of 12-hour equinox day)
		dayLength := st.Sunset.Sub(st.Sunrise)
		offset := time.Duration(float64(dayLength) / 10)
		alos72z := st.Sunrise.Add(-offset)
		tzeis72z := st.Sunset.Add(offset)
		t = astro.ShaosZmaniyosCustom(alos72z, tzeis72z, hours)

	case "mga_90_zmanis":
		// MGA 90 zmaniyos: 1/8th of day before sunrise to 1/8th after sunset
		// Proportional to day length (90 min = 1/8 of 12-hour equinox day)
		dayLength := st.Sunset.Sub(st.Sunrise)
		offset := time.Duration(float64(dayLength) / 8)
		alos90z := st.Sunrise.Add(-offset)
		tzeis90z := st.Sunset.Add(offset)
		t = astro.ShaosZmaniyosCustom(alos90z, tzeis90z, hours)

	case "mga_96_zmanis":
		// MGA 96 zmaniyos: 1/7.5th of day before sunrise to 1/7.5th after sunset
		// Proportional to day length (96 min = 1/7.5 of 12-hour equinox day)
		dayLength := st.Sunset.Sub(st.Sunrise)
		offset := time.Duration(float64(dayLength) / 7.5)
		alos96z := st.Sunrise.Add(-offset)
		tzeis96z := st.Sunset.Add(offset)
		t = astro.ShaosZmaniyosCustom(alos96z, tzeis96z, hours)

	case "mga_16_1":
		// MGA 16.1°: solar angle-based (16.1° alos to 16.1° tzais)
		// 16.1° is the standard dawn angle (72-minute equivalent at Jerusalem equinox)
		alos161, _ := astro.SunTimeAtAngleWithElevation(
			e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Elevation,
			e.ctx.Timezone, 16.1,
		)
		_, tzeis161 := astro.SunTimeAtAngleWithElevation(
			e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Elevation,
			e.ctx.Timezone, 16.1,
		)
		t = astro.ShaosZmaniyosCustom(alos161, tzeis161, hours)

	case "mga_18":
		// MGA 18°: solar angle-based (18° alos to 18° tzais)
		// 18° is astronomical twilight
		alos18, _ := astro.SunTimeAtAngleWithElevation(
			e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Elevation,
			e.ctx.Timezone, 18.0,
		)
		_, tzeis18 := astro.SunTimeAtAngleWithElevation(
			e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Elevation,
			e.ctx.Timezone, 18.0,
		)
		t = astro.ShaosZmaniyosCustom(alos18, tzeis18, hours)

	case "mga_19_8":
		// MGA 19.8°: solar angle-based (19.8° alos to 19.8° tzais)
		// 19.8° is the 90-minute equivalent at Jerusalem equinox
		alos198, _ := astro.SunTimeAtAngleWithElevation(
			e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Elevation,
			e.ctx.Timezone, 19.8,
		)
		_, tzeis198 := astro.SunTimeAtAngleWithElevation(
			e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Elevation,
			e.ctx.Timezone, 19.8,
		)
		t = astro.ShaosZmaniyosCustom(alos198, tzeis198, hours)

	case "mga_26":
		// MGA 26°: solar angle-based (26° alos to 26° tzais)
		// 26° is the 120-minute equivalent at Jerusalem equinox (very stringent)
		alos26, _ := astro.SunTimeAtAngleWithElevation(
			e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Elevation,
			e.ctx.Timezone, 26.0,
		)
		_, tzeis26 := astro.SunTimeAtAngleWithElevation(
			e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Elevation,
			e.ctx.Timezone, 26.0,
		)
		t = astro.ShaosZmaniyosCustom(alos26, tzeis26, hours)

	case "baal_hatanya":
		// Baal HaTanya: netz amiti (1.583° below horizon) to shkiah amiti (1.583° below horizon)
		// Based on Shulchan Aruch HaRav - when light disappears from mountaintops (Har HaCarmel at 546m)
		// Per Gemara Shabbos 35a and KosherJava implementation
		const baalHatanyaZenith = 1.583
		// Netz amiti is when sun is 1.583° below horizon in the morning (earlier than geometric sunrise)
		netzAmiti, _ := astro.SunTimeAtAngleWithElevation(
			e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Elevation,
			e.ctx.Timezone, baalHatanyaZenith,
		)
		// Shkiah amiti is when sun is 1.583° below horizon in the evening (later than geometric sunset)
		_, shkiahAmiti := astro.SunTimeAtAngleWithElevation(
			e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Elevation,
			e.ctx.Timezone, baalHatanyaZenith,
		)
		t = astro.ShaosZmaniyosCustom(netzAmiti, shkiahAmiti, hours)

	case "ateret_torah":
		// Ateret Torah (Yalkut Yosef / Rabbi Yitzhak Yosef): sunrise to tzais 40 minutes
		// This is the Sephardic/Yemenite calculation method
		// Day starts at sea-level sunrise and ends 40 minutes after sea-level sunset
		// Based on KosherJava implementation
		tzais40 := astro.AddMinutes(st.Sunset, 40)
		t = astro.ShaosZmaniyosCustom(st.Sunrise, tzais40, hours)

	case "custom":
		if len(baseNode.CustomArgs) != 2 {
			e.addError("custom() requires 2 arguments (start, end)")
			return Value{}
		}
		startVal := e.executeNode(baseNode.CustomArgs[0])
		endVal := e.executeNode(baseNode.CustomArgs[1])
		if startVal.Type != ValueTypeTime || endVal.Type != ValueTypeTime {
			e.addError("custom() arguments must be time values")
			return Value{}
		}
		t = astro.ShaosZmaniyosCustom(startVal.Time, endVal.Time, hours)
		// Check for zero time (indicates calculation failure)
		if t.IsZero() {
			e.addError("custom() calculation failed - invalid day duration")
			return Value{}
		}

	default:
		e.addError("unknown base: %s", baseNode.Base)
		return Value{}
	}

	// Cache the result
	stepName := fmt.Sprintf("proportional_hours(%.2f, %s)", hours, baseNode.Base)
	e.ctx.ZmanimCache[stepName] = t

	return Value{Type: ValueTypeTime, Time: t}
}

// executeMidpoint evaluates midpoint(time1, time2)
func (e *Executor) executeMidpoint(n *FunctionNode) Value {
	if len(n.Args) != 2 {
		e.addError("midpoint() requires 2 arguments")
		return Value{}
	}

	val1 := e.executeNode(n.Args[0])
	val2 := e.executeNode(n.Args[1])

	if val1.Type != ValueTypeTime || val2.Type != ValueTypeTime {
		e.addError("midpoint() arguments must be time values")
		return Value{}
	}

	t := astro.Midpoint(val1.Time, val2.Time)

	// Cache the result
	stepName := "midpoint"
	e.ctx.ZmanimCache[stepName] = t

	return Value{Type: ValueTypeTime, Time: t}
}

// executeProportionalMinutes evaluates proportional_minutes(minutes, direction)
// This calculates a zmaniyos (proportional) offset based on day length.
// The offset scales proportionally: longer days = longer proportional minutes.
//
// Formula: offset = (minutes / 720) × day_length
// Where 720 = 12 hours (equinox day in minutes)
//
// Examples:
//   - proportional_minutes(72, before_sunrise) = sunrise - (72/720 × day_length)
//   - proportional_minutes(120, after_sunset) = sunset + (120/720 × day_length)
//
// Common values: 72 (1/10 day), 90 (1/8 day), 96 (1/7.5 day), 120 (1/6 day)
func (e *Executor) executeProportionalMinutes(n *FunctionNode) Value {
	if len(n.Args) != 2 {
		e.addError("proportional_minutes() requires 2 arguments (minutes, direction)")
		return Value{}
	}

	// Get minutes (the reference value - e.g., 72, 90, 120)
	minutesVal := e.executeNode(n.Args[0])
	if minutesVal.Type != ValueTypeNumber {
		e.addError("proportional_minutes() first argument must be a number (minutes)")
		return Value{}
	}
	minutes := minutesVal.Number

	// Get direction
	var direction string
	switch arg := n.Args[1].(type) {
	case *DirectionNode:
		direction = arg.Direction
	case *StringNode:
		direction = arg.Value
	default:
		dirVal := e.executeNode(n.Args[1])
		direction = dirVal.String
	}

	// Calculate the proportional offset
	// The formula: minutes * (current_day_length / 720)
	// Where 720 = 12 hours (equinox day in minutes)
	// This scales the offset based on how much longer/shorter the current day is
	st := e.ctx.getSunTimes()
	dayLengthMinutes := st.DayLengthMinutes

	// Calculate proportional offset
	// For 72 minutes: fraction = 72/720 = 1/10 of day
	// For 90 minutes: fraction = 90/720 = 1/8 of day
	// For 96 minutes: fraction = 96/720 = 1/7.5 of day
	// For 120 minutes: fraction = 120/720 = 1/6 of day
	fraction := minutes / 720.0
	offsetMinutes := dayLengthMinutes * fraction

	var t time.Time
	switch direction {
	case "before_visible_sunrise":
		// Subtract proportional minutes from visible sunrise
		t = astro.SubtractMinutes(st.Sunrise, offsetMinutes)
	case "after_visible_sunset":
		// Add proportional minutes to visible sunset
		t = astro.AddMinutes(st.Sunset, offsetMinutes)
	case "before_geometric_sunrise":
		// Calculate geometric sunrise
		geometricSunrise, _ := astro.SunTimeAtAngle(e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Timezone, 0)
		t = astro.SubtractMinutes(geometricSunrise, offsetMinutes)
	case "after_geometric_sunset":
		// Calculate geometric sunset
		_, geometricSunset := astro.SunTimeAtAngle(e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Timezone, 0)
		t = astro.AddMinutes(geometricSunset, offsetMinutes)
	default:
		e.addError("proportional_minutes() direction must be before_visible_sunrise, after_visible_sunset, before_geometric_sunrise, or after_geometric_sunset, got: %s", direction)
		return Value{}
	}

	if t.IsZero() {
		e.addError("could not calculate proportional_minutes(%g, %s)", minutes, direction)
		return Value{}
	}

	// Cache the result
	stepName := fmt.Sprintf("proportional_minutes(%.0f, %s)", minutes, direction)
	e.ctx.ZmanimCache[stepName] = t

	return Value{Type: ValueTypeTime, Time: t}
}

// executeBinaryOp evaluates a binary operation (+, -, *, /)
func (e *Executor) executeBinaryOp(n *BinaryOpNode) Value {
	left := e.executeNode(n.Left)
	right := e.executeNode(n.Right)

	switch n.Op {
	case "+":
		return e.executeAdd(left, right)
	case "-":
		return e.executeSubtract(left, right)
	case "*":
		return e.executeMultiply(left, right)
	case "/":
		return e.executeDivide(left, right)
	default:
		e.addError("unknown operator: %s", n.Op)
		return Value{}
	}
}

// executeAdd handles addition
func (e *Executor) executeAdd(left, right Value) Value {
	// Time + Duration = Time
	if left.Type == ValueTypeTime && right.Type == ValueTypeDuration {
		return Value{Type: ValueTypeTime, Time: left.Time.Add(right.Duration)}
	}

	// Duration + Time = Time
	if left.Type == ValueTypeDuration && right.Type == ValueTypeTime {
		return Value{Type: ValueTypeTime, Time: right.Time.Add(left.Duration)}
	}

	// Duration + Duration = Duration
	if left.Type == ValueTypeDuration && right.Type == ValueTypeDuration {
		return Value{Type: ValueTypeDuration, Duration: left.Duration + right.Duration}
	}

	// Number + Number = Number
	if left.Type == ValueTypeNumber && right.Type == ValueTypeNumber {
		return Value{Type: ValueTypeNumber, Number: left.Number + right.Number}
	}

	e.addError("cannot add %s and %s", left.Type, right.Type)
	return Value{}
}

// executeSubtract handles subtraction
func (e *Executor) executeSubtract(left, right Value) Value {
	// Time - Duration = Time
	if left.Type == ValueTypeTime && right.Type == ValueTypeDuration {
		return Value{Type: ValueTypeTime, Time: left.Time.Add(-right.Duration)}
	}

	// Time - Time = Duration
	if left.Type == ValueTypeTime && right.Type == ValueTypeTime {
		return Value{Type: ValueTypeDuration, Duration: left.Time.Sub(right.Time)}
	}

	// Duration - Duration = Duration
	if left.Type == ValueTypeDuration && right.Type == ValueTypeDuration {
		return Value{Type: ValueTypeDuration, Duration: left.Duration - right.Duration}
	}

	// Number - Number = Number
	if left.Type == ValueTypeNumber && right.Type == ValueTypeNumber {
		return Value{Type: ValueTypeNumber, Number: left.Number - right.Number}
	}

	e.addError("cannot subtract %s from %s", right.Type, left.Type)
	return Value{}
}

// executeMultiply handles multiplication
func (e *Executor) executeMultiply(left, right Value) Value {
	// Duration * Number = Duration
	if left.Type == ValueTypeDuration && right.Type == ValueTypeNumber {
		result := float64(left.Duration) * right.Number
		if result > math.MaxInt64 || result < math.MinInt64 {
			e.addError("duration overflow: result exceeds maximum duration")
			return Value{}
		}
		return Value{Type: ValueTypeDuration, Duration: time.Duration(result)}
	}

	// Number * Duration = Duration
	if left.Type == ValueTypeNumber && right.Type == ValueTypeDuration {
		result := left.Number * float64(right.Duration)
		if result > math.MaxInt64 || result < math.MinInt64 {
			e.addError("duration overflow: result exceeds maximum duration")
			return Value{}
		}
		return Value{Type: ValueTypeDuration, Duration: time.Duration(result)}
	}

	// Number * Number = Number
	if left.Type == ValueTypeNumber && right.Type == ValueTypeNumber {
		return Value{Type: ValueTypeNumber, Number: left.Number * right.Number}
	}

	e.addError("cannot multiply %s and %s", left.Type, right.Type)
	return Value{}
}

// executeDivide handles division
func (e *Executor) executeDivide(left, right Value) Value {
	// Duration / Number = Duration
	if left.Type == ValueTypeDuration && right.Type == ValueTypeNumber {
		if right.Number == 0 {
			e.addError("division by zero")
			return Value{}
		}
		return Value{Type: ValueTypeDuration, Duration: time.Duration(float64(left.Duration) / right.Number)}
	}

	// Number / Number = Number
	if left.Type == ValueTypeNumber && right.Type == ValueTypeNumber {
		if right.Number == 0 {
			e.addError("division by zero")
			return Value{}
		}
		return Value{Type: ValueTypeNumber, Number: left.Number / right.Number}
	}

	e.addError("cannot divide %s by %s", left.Type, right.Type)
	return Value{}
}

// executeReference resolves a zman reference
func (e *Executor) executeReference(n *ReferenceNode) Value {
	// Check cache first
	if t, ok := e.ctx.ZmanimCache[n.ZmanKey]; ok {
		return Value{Type: ValueTypeTime, Time: t}
	}

	e.addError("undefined reference: @%s", n.ZmanKey)
	return Value{}
}

// executeConditional evaluates a conditional expression
func (e *Executor) executeConditional(n *ConditionalNode) Value {
	condVal := e.executeNode(n.Condition)

	if condVal.Type != ValueTypeBoolean {
		e.addError("condition must evaluate to boolean")
		return Value{}
	}

	if condVal.Boolean {
		return e.executeNode(n.TrueBranch)
	} else if n.FalseBranch != nil {
		return e.executeNode(n.FalseBranch)
	}

	// No false branch and condition is false
	e.addError("conditional has no else branch and condition is false")
	return Value{}
}

// executeCondition evaluates a boolean condition
func (e *Executor) executeCondition(n *ConditionNode) Value {
	left := e.executeNode(n.Left)
	right := e.executeNode(n.Right)

	var result bool

	// Numeric comparisons
	if left.Type == ValueTypeNumber && right.Type == ValueTypeNumber {
		switch n.Op {
		case ">":
			result = left.Number > right.Number
		case "<":
			result = left.Number < right.Number
		case ">=":
			result = left.Number >= right.Number
		case "<=":
			result = left.Number <= right.Number
		case "==":
			result = left.Number == right.Number
		case "!=":
			result = left.Number != right.Number
		default:
			e.addError("invalid comparison operator: %s", n.Op)
			return Value{}
		}
		return Value{Type: ValueTypeBoolean, Boolean: result}
	}

	// Duration comparisons
	if left.Type == ValueTypeDuration && right.Type == ValueTypeDuration {
		switch n.Op {
		case ">":
			result = left.Duration > right.Duration
		case "<":
			result = left.Duration < right.Duration
		case ">=":
			result = left.Duration >= right.Duration
		case "<=":
			result = left.Duration <= right.Duration
		case "==":
			result = left.Duration == right.Duration
		case "!=":
			result = left.Duration != right.Duration
		default:
			e.addError("invalid comparison operator: %s", n.Op)
			return Value{}
		}
		return Value{Type: ValueTypeBoolean, Boolean: result}
	}

	// String comparisons
	if left.Type == ValueTypeString && right.Type == ValueTypeString {
		switch n.Op {
		case "==":
			result = left.String == right.String
		case "!=":
			result = left.String != right.String
		default:
			e.addError("invalid string comparison operator: %s", n.Op)
			return Value{}
		}
		return Value{Type: ValueTypeBoolean, Boolean: result}
	}

	e.addError("cannot compare %s and %s", left.Type, right.Type)
	return Value{}
}

// executeLogicalOp evaluates a logical operation (&& or ||)
func (e *Executor) executeLogicalOp(n *LogicalOpNode) Value {
	left := e.executeNode(n.Left)

	if left.Type != ValueTypeBoolean {
		e.addError("left side of %s must be boolean, got %s", n.Op, left.Type)
		return Value{}
	}

	// Short-circuit evaluation
	switch n.Op {
	case "&&":
		// If left is false, return false without evaluating right
		if !left.Boolean {
			return Value{Type: ValueTypeBoolean, Boolean: false}
		}
		// Evaluate right side
		right := e.executeNode(n.Right)
		if right.Type != ValueTypeBoolean {
			e.addError("right side of && must be boolean, got %s", right.Type)
			return Value{}
		}
		return Value{Type: ValueTypeBoolean, Boolean: right.Boolean}

	case "||":
		// If left is true, return true without evaluating right
		if left.Boolean {
			return Value{Type: ValueTypeBoolean, Boolean: true}
		}
		// Evaluate right side
		right := e.executeNode(n.Right)
		if right.Type != ValueTypeBoolean {
			e.addError("right side of || must be boolean, got %s", right.Type)
			return Value{}
		}
		return Value{Type: ValueTypeBoolean, Boolean: right.Boolean}

	default:
		e.addError("unknown logical operator: %s", n.Op)
		return Value{}
	}
}

// executeNotOp evaluates a logical NOT operation
func (e *Executor) executeNotOp(n *NotOpNode) Value {
	operand := e.executeNode(n.Operand)

	if operand.Type != ValueTypeBoolean {
		e.addError("operand of ! must be boolean, got %s", operand.Type)
		return Value{}
	}

	return Value{Type: ValueTypeBoolean, Boolean: !operand.Boolean}
}

// executeConditionVar evaluates a condition variable
func (e *Executor) executeConditionVar(n *ConditionVarNode) Value {
	switch n.Name {
	case "latitude":
		return Value{Type: ValueTypeNumber, Number: e.ctx.Latitude}
	case "longitude":
		return Value{Type: ValueTypeNumber, Number: e.ctx.Longitude}
	case "elevation":
		return Value{Type: ValueTypeNumber, Number: e.ctx.Elevation}
	case "day_length":
		minutes := e.ctx.DayLength()
		return Value{Type: ValueTypeDuration, Duration: time.Duration(minutes * float64(time.Minute))}
	case "month":
		return Value{Type: ValueTypeNumber, Number: float64(e.ctx.Month())}
	case "day":
		return Value{Type: ValueTypeNumber, Number: float64(e.ctx.Day())}
	case "day_of_year":
		return Value{Type: ValueTypeNumber, Number: float64(e.ctx.DayOfYear())}
	case "date":
		// date returns day_of_year for comparison with date literals
		return Value{Type: ValueTypeNumber, Number: float64(e.ctx.DayOfYear())}
	case "season":
		return Value{Type: ValueTypeString, String: e.ctx.Season()}
	default:
		e.addError("unknown condition variable: %s", n.Name)
		return Value{}
	}
}

// executeDateLiteral converts a date literal (21-May) to day of year
func (e *Executor) executeDateLiteral(n *DateLiteralNode) Value {
	// Convert day-month to day of year using a reference year
	// We use the execution context's year to handle leap years correctly
	year := e.ctx.Date.Year()
	date := time.Date(year, time.Month(n.Month), n.Day, 0, 0, 0, 0, time.UTC)

	// Check if date was normalized (e.g., Feb 29 -> Mar 1 on non-leap year)
	if date.Month() != time.Month(n.Month) || date.Day() != n.Day {
		e.addError("date %d-%s does not exist in year %d", n.Day, time.Month(n.Month), year)
		return Value{}
	}

	dayOfYear := date.YearDay()
	return Value{Type: ValueTypeNumber, Number: float64(dayOfYear)}
}

// executeFirstValid evaluates first_valid(expr1, expr2, ...) - returns first non-null/non-error value
func (e *Executor) executeFirstValid(n *FunctionNode) Value {
	if len(n.Args) < 2 {
		e.addError("first_valid() requires at least 2 arguments")
		return Value{}
	}

	// Try each argument in order, returning the first successful one
	for i, arg := range n.Args {
		// Save current error count
		prevErrorCount := len(e.errors)

		result := e.executeNode(arg)

		// Check if this execution added errors
		if len(e.errors) > prevErrorCount {
			// Remove the errors from this attempt
			e.errors = e.errors[:prevErrorCount]

			// If this is the last argument, we need to report failure
			if i == len(n.Args)-1 {
				e.addError("first_valid(): all arguments failed")
				return Value{}
			}
			// Try next argument
			continue
		}

		// Check for zero time (indicates calculation failure like polar region)
		if result.Type == ValueTypeTime && result.Time.IsZero() {
			if i == len(n.Args)-1 {
				e.addError("first_valid(): all arguments returned null")
				return Value{}
			}
			continue
		}

		// Success! Return this value
		return result
	}

	e.addError("first_valid(): no valid value found")
	return Value{}
}

// executeEarlierOf evaluates earlier_of(time1, time2) - returns whichever time comes first
func (e *Executor) executeEarlierOf(n *FunctionNode) Value {
	if len(n.Args) != 2 {
		e.addError("earlier_of() requires exactly 2 arguments")
		return Value{}
	}

	// Evaluate both arguments
	val1 := e.executeNode(n.Args[0])
	val2 := e.executeNode(n.Args[1])

	// Handle nil/zero times
	if val1.Type == ValueTypeTime && val1.Time.IsZero() {
		// First is nil, return second
		if val2.Type == ValueTypeTime {
			return val2
		}
		e.addError("earlier_of(): both arguments are null")
		return Value{}
	}

	if val2.Type == ValueTypeTime && val2.Time.IsZero() {
		// Second is nil, return first
		return val1
	}

	// Both must be times
	if val1.Type != ValueTypeTime || val2.Type != ValueTypeTime {
		e.addError("earlier_of() arguments must be time values")
		return Value{}
	}

	// Return the earlier time
	if val1.Time.Before(val2.Time) {
		return val1
	}
	return val2
}

// executeLaterOf evaluates later_of(time1, time2) - returns whichever time comes last
func (e *Executor) executeLaterOf(n *FunctionNode) Value {
	if len(n.Args) != 2 {
		e.addError("later_of() requires exactly 2 arguments")
		return Value{}
	}

	// Evaluate both arguments
	val1 := e.executeNode(n.Args[0])
	val2 := e.executeNode(n.Args[1])

	// Handle nil/zero times
	if val1.Type == ValueTypeTime && val1.Time.IsZero() {
		// First is nil, return second
		if val2.Type == ValueTypeTime {
			return val2
		}
		e.addError("later_of(): both arguments are null")
		return Value{}
	}

	if val2.Type == ValueTypeTime && val2.Time.IsZero() {
		// Second is nil, return first
		return val1
	}

	// Both must be times
	if val1.Type != ValueTypeTime || val2.Type != ValueTypeTime {
		e.addError("later_of() arguments must be time values")
		return Value{}
	}

	// Return the later time
	if val1.Time.After(val2.Time) {
		return val1
	}
	return val2
}

// addError adds an execution error
func (e *Executor) addError(format string, args ...interface{}) {
	e.errors.Add(&DSLError{
		Type:    ErrorTypeRuntime,
		Message: fmt.Sprintf(format, args...),
	})
}

// ExecuteFormula parses and executes a formula string
func ExecuteFormula(formula string, ctx *ExecutionContext) (time.Time, error) {
	node, err := Parse(formula)
	if err != nil {
		return time.Time{}, err
	}
	return Execute(node, ctx)
}

// ExecuteFormulaWithBreakdown parses and executes a formula with breakdown
func ExecuteFormulaWithBreakdown(formula string, ctx *ExecutionContext) (time.Time, []CalculationStep, error) {
	node, err := Parse(formula)
	if err != nil {
		return time.Time{}, nil, err
	}
	return ExecuteWithBreakdown(node, ctx)
}

// ExecuteFormulaSetResult contains both successful results and any errors
type ExecuteFormulaSetResult struct {
	Results map[string]time.Time
	Errors  map[string]string // Key -> error message for failed formulas
}

// ExecuteFormulaSet executes a set of zman formulas in dependency order
// Returns partial results even if some formulas fail
func ExecuteFormulaSet(formulas map[string]string, ctx *ExecutionContext) (map[string]time.Time, error) {
	result, _ := ExecuteFormulaSetWithErrors(formulas, ctx)
	return result.Results, nil
}

// ExecuteFormulaSetWithErrors executes formulas and returns both results and per-formula errors
func ExecuteFormulaSetWithErrors(formulas map[string]string, ctx *ExecutionContext) (*ExecuteFormulaSetResult, error) {
	// Get calculation order (topological sort)
	order, err := GetCalculationOrder(formulas)
	if err != nil {
		return nil, err
	}

	result := &ExecuteFormulaSetResult{
		Results: make(map[string]time.Time),
		Errors:  make(map[string]string),
	}

	// Execute in order
	for _, key := range order {
		formula, ok := formulas[key]
		if !ok {
			continue
		}

		// Parse
		node, err := Parse(formula)
		if err != nil {
			slog.Warn("DSL parse error", "zman_key", key, "formula", formula, "error", err)
			result.Errors[key] = fmt.Sprintf("parse error: %v", err)
			continue
		}

		// Execute with current context (includes already calculated zmanim)
		t, err := Execute(node, ctx)
		if err != nil {
			slog.Warn("DSL execution error", "zman_key", key, "formula", formula, "error", err)
			result.Errors[key] = fmt.Sprintf("execution error: %v", err)
			continue
		}

		// Store result
		result.Results[key] = t
		ctx.ZmanimCache[key] = t
	}

	return result, nil
}
