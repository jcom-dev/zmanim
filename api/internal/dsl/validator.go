// File: validator.go
// Purpose: DSL formula validation - syntax checking, reference resolution
// Pattern: validation
// Dependencies: Queries: zmanim.sql for @reference validation
// Frequency: high - 507 lines
// Compliance: Check docs/adr/ for pattern rationale

package dsl

import (
	"fmt"
	"sort"
	"strings"
)

// Validator validates DSL AST nodes
type Validator struct {
	errors         ErrorList
	availableZmans map[string]bool
	currentZmanKey string // The zman being validated (for circular dependency detection)
}

// NewValidator creates a new Validator
func NewValidator() *Validator {
	return &Validator{
		availableZmans: make(map[string]bool),
	}
}

// SetAvailableZmans sets the available zman references
func (v *Validator) SetAvailableZmans(zmans []string) {
	for _, z := range zmans {
		v.availableZmans[z] = true
	}
}

// SetCurrentZman sets the current zman being validated (for circular dependency detection)
func (v *Validator) SetCurrentZman(key string) {
	v.currentZmanKey = key
}

// Validate validates an AST node and returns any errors
func Validate(node Node, availableZmans []string) ([]ValidationError, error) {
	v := NewValidator()
	v.SetAvailableZmans(availableZmans)
	v.validateNode(node)

	if v.errors.HasErrors() {
		return v.errors.ToValidationErrors(), &v.errors
	}
	return nil, nil
}

// ValidateFormula parses and validates a formula string
func ValidateFormula(formula string, availableZmans []string) (Node, []ValidationError, error) {
	// Parse the formula
	node, err := Parse(formula)
	if err != nil {
		if errList, ok := err.(*ErrorList); ok {
			return nil, errList.ToValidationErrors(), err
		}
		return nil, []ValidationError{{Message: err.Error(), Line: 1, Column: 1}}, err
	}

	// Validate the AST
	validationErrors, err := Validate(node, availableZmans)
	return node, validationErrors, err
}

// validateNode validates a single AST node
func (v *Validator) validateNode(node Node) {
	if node == nil {
		return
	}

	switch n := node.(type) {
	case *PrimitiveNode:
		// Primitives are always valid
		if !Primitives[n.Name] {
			v.addError(n.Pos, "unknown primitive: %s", n.Name)
		}

	case *FunctionNode:
		v.validateFunction(n)

	case *BinaryOpNode:
		v.validateBinaryOp(n)

	case *DurationNode:
		if n.Minutes < 0 {
			// Negative durations are allowed in expressions
		}

	case *NumberNode:
		// Numbers are always valid

	case *ReferenceNode:
		v.validateReference(n)

	case *ConditionalNode:
		v.validateConditional(n)

	case *ConditionNode:
		v.validateCondition(n)

	case *LogicalOpNode:
		v.validateLogicalOp(n)

	case *NotOpNode:
		v.validateNotOp(n)

	case *DirectionNode:
		if !Directions[n.Direction] {
			v.addError(n.Pos, "unknown direction: %s", n.Direction)
		}

	case *BaseNode:
		v.validateBase(n)

	case *StringNode:
		// Strings are valid

	case *ConditionVarNode:
		// Condition variables are valid
	}
}

// validateFunction validates a function call
func (v *Validator) validateFunction(n *FunctionNode) {
	switch n.Name {
	case "solar":
		v.validateSolarFunction(n)
	case "seasonal_solar":
		v.validateSeasonalSolarFunction(n)
	case "proportional_hours":
		v.validateProportionalHoursFunction(n)
	case "proportional_minutes":
		v.validateProportionalMinutesFunction(n)
	case "midpoint":
		v.validateMidpointFunction(n)
	case "first_valid":
		v.validateFirstValidFunction(n)
	case "earlier_of":
		v.validateEarlierOfFunction(n)
	case "later_of":
		v.validateLaterOfFunction(n)
	default:
		v.addError(n.Pos, "unknown function: %s", n.Name)
	}
}

// validateSolarFunction validates a solar() function call
func (v *Validator) validateSolarFunction(n *FunctionNode) {
	if len(n.Args) != 2 {
		v.addError(n.Pos, "solar() requires 2 arguments (degrees, direction), got %d", len(n.Args))
		return
	}

	// Validate degrees argument (0-90)
	degrees := n.Args[0]
	if numNode, ok := degrees.(*NumberNode); ok {
		if numNode.Value < 0 || numNode.Value > 90 {
			v.addErrorWithSuggestion(n.Pos,
				fmt.Sprintf("solar() degrees must be between 0 and 90, got %.1f", numNode.Value),
				"Common values: 8.5° (Tzais), 11.5° (Misheyakir), 16.1° (Alos/MGA)")
		}
	} else {
		v.validateNode(degrees)
	}

	// Validate direction argument
	direction := n.Args[1]
	if dirNode, ok := direction.(*DirectionNode); ok {
		if !Directions[dirNode.Direction] {
			v.addErrorWithSuggestion(n.Pos,
				fmt.Sprintf("invalid direction: %s", dirNode.Direction),
				"Valid directions: before_visible_sunrise, after_visible_sunrise, before_visible_sunset, after_visible_sunset, before_geometric_sunrise, after_geometric_sunrise, before_geometric_sunset, after_geometric_sunset, before_noon, after_noon")
		}
	} else {
		// Allow identifiers that might be directions
		if ident, ok := direction.(*PrimitiveNode); ok {
			if !Directions[ident.Name] {
				v.addError(n.Pos, "second argument to solar() must be a direction")
			}
		} else {
			v.addError(n.Pos, "second argument to solar() must be a direction")
		}
	}
}

// validateSeasonalSolarFunction validates a seasonal_solar() function call
// seasonal_solar uses the proportional/seasonal method matching ROY/Zemaneh-Yosef
func (v *Validator) validateSeasonalSolarFunction(n *FunctionNode) {
	if len(n.Args) != 2 {
		v.addError(n.Pos, "seasonal_solar() requires 2 arguments (degrees, direction), got %d", len(n.Args))
		return
	}

	// Validate degrees argument (0-90)
	degrees := n.Args[0]
	if numNode, ok := degrees.(*NumberNode); ok {
		if numNode.Value < 0 || numNode.Value > 90 {
			v.addErrorWithSuggestion(n.Pos,
				fmt.Sprintf("seasonal_solar() degrees must be between 0 and 90, got %.1f", numNode.Value),
				"Common values: 8.5° (Tzais), 11.5° (Misheyakir), 16.04° (Alos ROY)")
		}
	} else {
		v.validateNode(degrees)
	}

	// Validate direction argument (only visible/geometric sunrise and sunset for seasonal)
	direction := n.Args[1]
	if dirNode, ok := direction.(*DirectionNode); ok {
		validSeasonalDirections := []string{"before_visible_sunrise", "after_visible_sunset", "before_geometric_sunrise", "after_geometric_sunset"}
		isValid := false
		for _, d := range validSeasonalDirections {
			if dirNode.Direction == d {
				isValid = true
				break
			}
		}
		if !isValid {
			v.addErrorWithSuggestion(n.Pos,
				fmt.Sprintf("invalid direction for seasonal_solar: %s", dirNode.Direction),
				"Valid directions: before_visible_sunrise, after_visible_sunset, before_geometric_sunrise, after_geometric_sunset")
		}
	} else {
		// Allow identifiers that might be directions
		if ident, ok := direction.(*PrimitiveNode); ok {
			validSeasonalDirections := []string{"before_visible_sunrise", "after_visible_sunset", "before_geometric_sunrise", "after_geometric_sunset"}
			isValid := false
			for _, d := range validSeasonalDirections {
				if ident.Name == d {
					isValid = true
					break
				}
			}
			if !isValid {
				v.addError(n.Pos, "second argument to seasonal_solar() must be before_visible_sunrise, after_visible_sunset, before_geometric_sunrise, or after_geometric_sunset")
			}
		} else {
			v.addError(n.Pos, "second argument to seasonal_solar() must be a direction")
		}
	}
}

// validateProportionalHoursFunction validates a proportional_hours() function call
func (v *Validator) validateProportionalHoursFunction(n *FunctionNode) {
	if len(n.Args) != 2 {
		v.addError(n.Pos, "proportional_hours() requires 2 arguments (hours, base), got %d", len(n.Args))
		return
	}

	// Validate hours argument (0.5-12)
	hours := n.Args[0]
	if numNode, ok := hours.(*NumberNode); ok {
		if numNode.Value < 0.5 || numNode.Value > 12 {
			v.addErrorWithSuggestion(n.Pos,
				fmt.Sprintf("proportional_hours() hours must be between 0.5 and 12, got %.1f", numNode.Value),
				"Common values: 3 (Shma), 4 (Tefila), 9.5 (Mincha Ketana), 10.75 (Plag)")
		}
	} else {
		v.validateNode(hours)
	}

	// Validate base argument
	base := n.Args[1]
	if baseNode, ok := base.(*BaseNode); ok {
		v.validateBase(baseNode)
	} else {
		v.addError(n.Pos, "second argument to proportional_hours() must be a valid base (gra, mga, mga_*, baal_hatanya, or custom)")
	}
}

// validateMidpointFunction validates a midpoint() function call
func (v *Validator) validateMidpointFunction(n *FunctionNode) {
	if len(n.Args) != 2 {
		v.addError(n.Pos, "midpoint() requires 2 arguments, got %d", len(n.Args))
		return
	}

	// Both arguments should produce Time values
	for i, arg := range n.Args {
		v.validateNode(arg)
		valType := GetValueType(arg)
		if valType != ValueTypeTime {
			v.addError(n.Pos, "midpoint() argument %d must produce a Time value, got %s", i+1, valType)
		}
	}
}

// validateProportionalMinutesFunction validates a proportional_minutes() function call
// proportional_minutes(minutes, direction) calculates zmaniyos (proportional) offset
func (v *Validator) validateProportionalMinutesFunction(n *FunctionNode) {
	if len(n.Args) != 2 {
		v.addError(n.Pos, "proportional_minutes() requires 2 arguments (minutes, direction), got %d", len(n.Args))
		return
	}

	// First argument must be a positive number (minutes)
	minutes := n.Args[0]
	if numNode, ok := minutes.(*NumberNode); ok {
		if numNode.Value <= 0 || numNode.Value > 200 {
			v.addErrorWithSuggestion(n.Pos,
				fmt.Sprintf("proportional_minutes() minutes must be between 1 and 200, got %.1f", numNode.Value),
				"Common values: 72, 90, 96, 120")
		}
	} else {
		v.validateNode(minutes)
	}

	// Second argument must be a direction (visible/geometric sunrise or sunset only)
	direction := n.Args[1]
	if dirNode, ok := direction.(*DirectionNode); ok {
		validProportionalDirections := []string{"before_visible_sunrise", "after_visible_sunset", "before_geometric_sunrise", "after_geometric_sunset"}
		isValid := false
		for _, d := range validProportionalDirections {
			if dirNode.Direction == d {
				isValid = true
				break
			}
		}
		if !isValid {
			v.addErrorWithSuggestion(n.Pos,
				fmt.Sprintf("invalid direction for proportional_minutes: %s", dirNode.Direction),
				"Valid directions: before_visible_sunrise, after_visible_sunset, before_geometric_sunrise, after_geometric_sunset")
		}
	} else {
		v.addError(n.Pos, "second argument to proportional_minutes() must be a direction (before_visible_sunrise, after_visible_sunset, before_geometric_sunrise, or after_geometric_sunset)")
	}
}

// validateFirstValidFunction validates a first_valid() function call
func (v *Validator) validateFirstValidFunction(n *FunctionNode) {
	if len(n.Args) < 2 {
		v.addError(n.Pos, "first_valid() requires at least 2 arguments, got %d", len(n.Args))
		return
	}

	// Validate all arguments
	for _, arg := range n.Args {
		v.validateNode(arg)
	}
}

// validateEarlierOfFunction validates an earlier_of() function call
func (v *Validator) validateEarlierOfFunction(n *FunctionNode) {
	if len(n.Args) != 2 {
		v.addError(n.Pos, "earlier_of() requires exactly 2 arguments, got %d", len(n.Args))
		return
	}

	// Both arguments should produce Time values
	for i, arg := range n.Args {
		v.validateNode(arg)
		valType := GetValueType(arg)
		if valType != ValueTypeTime {
			v.addError(n.Pos, "earlier_of() argument %d must produce a Time value, got %s", i+1, valType)
		}
	}
}

// validateLaterOfFunction validates a later_of() function call
func (v *Validator) validateLaterOfFunction(n *FunctionNode) {
	if len(n.Args) != 2 {
		v.addError(n.Pos, "later_of() requires exactly 2 arguments, got %d", len(n.Args))
		return
	}

	// Both arguments should produce Time values
	for i, arg := range n.Args {
		v.validateNode(arg)
		valType := GetValueType(arg)
		if valType != ValueTypeTime {
			v.addError(n.Pos, "later_of() argument %d must produce a Time value, got %s", i+1, valType)
		}
	}
}

// validateBase validates a base node
func (v *Validator) validateBase(n *BaseNode) {
	if !Bases[n.Base] {
		v.addErrorWithSuggestion(n.Pos,
			fmt.Sprintf("unknown base: %s", n.Base),
			"Valid bases: gra, mga, mga_60, mga_72, mga_90, mga_96, mga_120, mga_72_zmanis, mga_90_zmanis, mga_96_zmanis, mga_16_1, mga_18, mga_19_8, mga_26, baal_hatanya, ateret_torah, custom(start, end)")
		return
	}

	if n.Base == "custom" {
		if len(n.CustomArgs) != 2 {
			v.addError(n.Pos, "custom() requires 2 arguments (start, end), got %d", len(n.CustomArgs))
			return
		}
		// Validate custom args produce Time values
		for i, arg := range n.CustomArgs {
			v.validateNode(arg)
			valType := GetValueType(arg)
			if valType != ValueTypeTime {
				v.addError(n.Pos, "custom() argument %d must produce a Time value, got %s", i+1, valType)
			}
		}
	}
}

// validateBinaryOp validates a binary operation
func (v *Validator) validateBinaryOp(n *BinaryOpNode) {
	v.validateNode(n.Left)
	v.validateNode(n.Right)

	leftType := GetValueType(n.Left)
	rightType := GetValueType(n.Right)

	// Type checking rules
	switch n.Op {
	case "+":
		// Time + Duration = Time
		// Duration + Duration = Duration
		// Number + Number = Number
		if leftType == ValueTypeTime && rightType == ValueTypeTime {
			v.addErrorWithSuggestion(n.Pos,
				"cannot add two times",
				"Did you mean to calculate duration? Try: time2 - time1")
		}
	case "-":
		// Time - Time = Duration
		// Time - Duration = Time
		// Duration - Duration = Duration
		// All valid
	case "*":
		// Duration * Number = Duration
		// Number * Duration = Duration
		// Number * Number = Number
		if leftType == ValueTypeTime || rightType == ValueTypeTime {
			v.addError(n.Pos, "cannot multiply time values")
		}
	case "/":
		// Duration / Number = Duration
		// Number / Number = Number
		if rightType == ValueTypeTime {
			v.addError(n.Pos, "cannot divide by a time value")
		}
		if leftType == ValueTypeTime {
			v.addError(n.Pos, "cannot divide a time value")
		}
	}
}

// validateReference validates a zman reference
func (v *Validator) validateReference(n *ReferenceNode) {
	// Check for self-reference (circular dependency)
	if v.currentZmanKey != "" && n.ZmanKey == v.currentZmanKey {
		v.addErrorWithSuggestion(n.Pos,
			fmt.Sprintf("circular reference: @%s references itself", n.ZmanKey),
			"Use a primitive or different reference instead")
		return
	}

	// Check if reference exists
	if len(v.availableZmans) > 0 && !v.availableZmans[n.ZmanKey] {
		var available []string
		for z := range v.availableZmans {
			available = append(available, z)
		}
		sort.Strings(available)

		suggestion := ""
		if len(available) > 0 {
			suggestion = fmt.Sprintf("Available zmanim: %s", strings.Join(available[:min(5, len(available))], ", "))
			if len(available) > 5 {
				suggestion += "..."
			}
		}
		v.addErrorWithSuggestion(n.Pos,
			fmt.Sprintf("undefined reference: @%s", n.ZmanKey),
			suggestion)
	}
}

// validateConditional validates a conditional expression
func (v *Validator) validateConditional(n *ConditionalNode) {
	v.validateNode(n.Condition)
	v.validateNode(n.TrueBranch)
	if n.FalseBranch != nil {
		v.validateNode(n.FalseBranch)
	}

	// Check that both branches produce the same type
	trueType := GetValueType(n.TrueBranch)
	if n.FalseBranch != nil {
		falseType := GetValueType(n.FalseBranch)
		if trueType != falseType {
			v.addError(n.Pos, "conditional branches must produce same type: true branch produces %s, false branch produces %s",
				trueType, falseType)
		}
	}
}

// validateCondition validates a condition expression
func (v *Validator) validateCondition(n *ConditionNode) {
	v.validateNode(n.Left)
	v.validateNode(n.Right)

	// Type checking for conditions
	_ = GetValueType(n.Left) // leftType used implicitly in validation
	rightType := GetValueType(n.Right)

	// latitude/longitude/elevation comparisons should be with numbers
	if condVar, ok := n.Left.(*ConditionVarNode); ok {
		switch condVar.Name {
		case "latitude", "longitude", "elevation":
			if rightType != ValueTypeNumber {
				v.addError(n.Pos, "%s comparison requires a number, got %s", condVar.Name, rightType)
			}
		case "day_length":
			if rightType != ValueTypeDuration {
				v.addError(n.Pos, "day_length comparison requires a duration, got %s", rightType)
			}
		case "month":
			if rightType != ValueTypeNumber {
				v.addError(n.Pos, "month comparison requires a number, got %s", rightType)
			}
		case "season":
			if rightType != ValueTypeString {
				v.addError(n.Pos, "season comparison requires a string, got %s", rightType)
			}
		}
	}
}

// validateLogicalOp validates a logical operation (&& or ||)
func (v *Validator) validateLogicalOp(n *LogicalOpNode) {
	v.validateNode(n.Left)
	v.validateNode(n.Right)

	// Both sides should produce boolean values
	leftType := GetValueType(n.Left)
	rightType := GetValueType(n.Right)

	if leftType != ValueTypeBoolean {
		v.addError(n.Pos, "left side of %s must be a boolean expression, got %s", n.Op, leftType)
	}
	if rightType != ValueTypeBoolean {
		v.addError(n.Pos, "right side of %s must be a boolean expression, got %s", n.Op, rightType)
	}
}

// validateNotOp validates a logical NOT operation
func (v *Validator) validateNotOp(n *NotOpNode) {
	v.validateNode(n.Operand)

	// Operand should produce a boolean value
	operandType := GetValueType(n.Operand)
	if operandType != ValueTypeBoolean {
		v.addError(n.Pos, "operand of ! must be a boolean expression, got %s", operandType)
	}
}

// addError adds a validation error
func (v *Validator) addError(pos Position, format string, args ...interface{}) {
	v.errors.Add(&DSLError{
		Type:    ErrorTypeSemantic,
		Message: fmt.Sprintf(format, args...),
		Line:    pos.Line,
		Column:  pos.Column,
	})
}

// addErrorWithSuggestion adds a validation error with a suggestion
func (v *Validator) addErrorWithSuggestion(pos Position, message, suggestion string) {
	v.errors.Add(&DSLError{
		Type:       ErrorTypeSemantic,
		Message:    message,
		Line:       pos.Line,
		Column:     pos.Column,
		Suggestion: suggestion,
	})
}

// Errors returns validation errors
func (v *Validator) Errors() ErrorList {
	return v.errors
}

// HasErrors returns true if there are validation errors
func (v *Validator) HasErrors() bool {
	return v.errors.HasErrors()
}

// DetectCircularDependencies detects circular dependencies in a set of zman formulas
func DetectCircularDependencies(formulas map[string]string) ([]string, error) {
	// Build dependency graph: deps[key] = list of zmanim that key depends on
	deps := make(map[string][]string)
	for key, formula := range formulas {
		node, err := Parse(formula)
		if err != nil {
			continue
		}
		refs := ExtractReferences(node)
		deps[key] = refs
	}

	// Build reverse graph: dependents[key] = list of zmanim that depend on key
	dependents := make(map[string][]string)
	for key := range formulas {
		dependents[key] = []string{}
	}
	for key, keyDeps := range deps {
		for _, dep := range keyDeps {
			dependents[dep] = append(dependents[dep], key)
		}
	}

	// Topological sort using Kahn's algorithm
	// Calculate in-degrees: how many dependencies does each key have
	inDegree := make(map[string]int)
	for key := range formulas {
		inDegree[key] = len(deps[key])
	}

	// Find nodes with no dependencies (inDegree == 0)
	var queue []string
	for key := range formulas {
		if inDegree[key] == 0 {
			queue = append(queue, key)
		}
	}

	var order []string
	for len(queue) > 0 {
		// Remove from queue
		node := queue[0]
		queue = queue[1:]
		order = append(order, node)

		// Decrease in-degree of nodes that depend on this one
		for _, dependent := range dependents[node] {
			inDegree[dependent]--
			if inDegree[dependent] == 0 {
				queue = append(queue, dependent)
			}
		}
	}

	// If we couldn't process all nodes, there's a cycle
	if len(order) < len(formulas) {
		// Find the cycle
		visited := make(map[string]bool)
		for _, key := range order {
			visited[key] = true
		}

		var cycle []string
		for key := range formulas {
			if !visited[key] {
				cycle = append(cycle, key)
			}
		}
		return cycle, &CircularDependencyError{Chain: cycle}
	}

	return order, nil
}

// GetCalculationOrder returns the order in which zmanim should be calculated
func GetCalculationOrder(formulas map[string]string) ([]string, error) {
	return DetectCircularDependencies(formulas)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
