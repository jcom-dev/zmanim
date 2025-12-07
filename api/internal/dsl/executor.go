// File: executor.go
// Purpose: DSL formula execution engine - primitives, solar angles, time arithmetic
// Pattern: calculation-engine
// Dependencies: astro/sun.go for solar calculations
// Frequency: critical - used by all zmanim calculations
// Compliance: Check docs/adr/ for pattern rationale

package dsl

import (
	"fmt"
	"time"

	"github.com/jcom-dev/zmanim-lab/internal/astro"
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

// getSunTimes lazily computes and caches sun times
func (ctx *ExecutionContext) getSunTimes() *astro.SunTimes {
	if ctx.sunTimes == nil {
		ctx.sunTimes = astro.CalculateSunTimes(ctx.Date, ctx.Latitude, ctx.Longitude, ctx.Timezone)
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
	executor.ctx.ZmanimCache = make(map[string]time.Time)

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

// executePrimitive evaluates a primitive time (sunrise, sunset, etc.)
func (e *Executor) executePrimitive(n *PrimitiveNode) Value {
	st := e.ctx.getSunTimes()

	var t time.Time
	switch n.Name {
	case "sunrise":
		t = st.Sunrise
	case "sunset":
		t = st.Sunset
	case "solar_noon":
		t = st.SolarNoon
	case "solar_midnight":
		// Solar midnight is 12 hours from solar noon
		t = st.SolarNoon.Add(-12 * time.Hour)
	case "visible_sunrise":
		// Visible sunrise accounts for atmospheric refraction (~0.833°)
		// This is already included in the standard sunrise calculation
		t = st.Sunrise
	case "visible_sunset":
		// Visible sunset accounts for atmospheric refraction
		t = st.Sunset
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

// executeFunction evaluates a function call (solar, seasonal_solar, proportional_hours, midpoint)
func (e *Executor) executeFunction(n *FunctionNode) Value {
	switch n.Name {
	case "solar":
		return e.executeSolar(n)
	case "seasonal_solar":
		return e.executeSeasonalSolar(n)
	case "proportional_hours":
		return e.executeProportionalHours(n)
	case "midpoint":
		return e.executeMidpoint(n)
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
	case "before_sunrise":
		t = dawn
	case "after_sunset":
		t = dusk
	case "before_noon":
		// Sun at angle before solar noon (ascending)
		// This is the dawn time for the angle
		t = dawn
	case "after_noon":
		// Sun at angle after solar noon (descending)
		// This is the dusk time for the angle
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
	case "before_sunrise":
		t = dawn
	case "after_sunset":
		t = dusk
	default:
		e.addError("seasonal_solar() invalid direction: %s (must be before_sunrise or after_sunset)", direction)
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

	case "mga":
		// MGA: (sunrise - 72min) to (sunset + 72min)
		alos72 := astro.SubtractMinutes(st.Sunrise, 72)
		tzeis72 := astro.AddMinutes(st.Sunset, 72)
		t = astro.ShaosZmaniyosMGA(alos72, tzeis72, hours)

	case "mga_90":
		// MGA 90: (sunrise - 90min) to (sunset + 90min)
		alos90 := astro.SubtractMinutes(st.Sunrise, 90)
		tzeis90 := astro.AddMinutes(st.Sunset, 90)
		t = astro.ShaosZmaniyosCustom(alos90, tzeis90, hours)

	case "mga_120":
		// MGA 120: (sunrise - 120min) to (sunset + 120min)
		alos120 := astro.SubtractMinutes(st.Sunrise, 120)
		tzeis120 := astro.AddMinutes(st.Sunset, 120)
		t = astro.ShaosZmaniyosCustom(alos120, tzeis120, hours)

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
		return Value{Type: ValueTypeDuration, Duration: time.Duration(float64(left.Duration) * right.Number)}
	}

	// Number * Duration = Duration
	if left.Type == ValueTypeNumber && right.Type == ValueTypeDuration {
		return Value{Type: ValueTypeDuration, Duration: time.Duration(left.Number * float64(right.Duration))}
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
	case "season":
		return Value{Type: ValueTypeString, String: e.ctx.Season()}
	default:
		e.addError("unknown condition variable: %s", n.Name)
		return Value{}
	}
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

// ExecuteFormulaSet executes a set of zman formulas in dependency order
func ExecuteFormulaSet(formulas map[string]string, ctx *ExecutionContext) (map[string]time.Time, error) {
	// Get calculation order (topological sort)
	order, err := GetCalculationOrder(formulas)
	if err != nil {
		return nil, err
	}

	results := make(map[string]time.Time)

	// Execute in order
	for _, key := range order {
		formula, ok := formulas[key]
		if !ok {
			continue
		}

		// Parse
		node, err := Parse(formula)
		if err != nil {
			return nil, fmt.Errorf("error parsing %s: %w", key, err)
		}

		// Execute with current context (includes already calculated zmanim)
		t, err := Execute(node, ctx)
		if err != nil {
			return nil, fmt.Errorf("error executing %s: %w", key, err)
		}

		// Store result
		results[key] = t
		ctx.ZmanimCache[key] = t
	}

	return results, nil
}
