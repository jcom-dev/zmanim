// File: ast.go
// Purpose: Abstract Syntax Tree node definitions for DSL
// Pattern: ast
// Dependencies: none
// Frequency: critical - core data structure for formula representation
//
// Defines all AST node types for the zmanim DSL:
//   - PrimitiveNode: sunrise, sunset, solar_noon, etc.
//   - FunctionNode: solar(), proportional_hours(), midpoint()
//   - BinaryOpNode: +, -, *, /
//   - DurationNode: 72min, 1h 30min
//   - ReferenceNode: @zman_key
//   - ConditionalNode: if/else expressions
//   - ConditionNode: latitude > 60, season == "winter"

package dsl

import (
	"fmt"
	"strings"
)

// NodeType represents the type of an AST node
type NodeType string

const (
	NodeTypePrimitive   NodeType = "primitive"
	NodeTypeFunction    NodeType = "function"
	NodeTypeBinaryOp    NodeType = "binary_op"
	NodeTypeDuration    NodeType = "duration"
	NodeTypeNumber      NodeType = "number"
	NodeTypeReference   NodeType = "reference"
	NodeTypeConditional NodeType = "conditional"
	NodeTypeCondition   NodeType = "condition"
	NodeTypeLogicalOp   NodeType = "logical_op"
	NodeTypeNotOp       NodeType = "not_op"
	NodeTypeString      NodeType = "string"
)

// Node is the interface for all AST nodes
type Node interface {
	Type() NodeType
	Position() Position
	String() string
}

// PrimitiveNode represents a built-in astronomical time (sunrise, sunset, etc.)
type PrimitiveNode struct {
	Name string   // "visible_sunrise", "visible_sunset", etc.
	Pos  Position // Source position
}

func (n *PrimitiveNode) Type() NodeType     { return NodeTypePrimitive }
func (n *PrimitiveNode) Position() Position { return n.Pos }
func (n *PrimitiveNode) String() string     { return n.Name }

// FunctionNode represents a function call (solar, proportional_hours, midpoint)
type FunctionNode struct {
	Name string   // "solar", "proportional_hours", "midpoint"
	Args []Node   // Function arguments
	Pos  Position // Source position
}

func (n *FunctionNode) Type() NodeType     { return NodeTypeFunction }
func (n *FunctionNode) Position() Position { return n.Pos }
func (n *FunctionNode) String() string {
	args := make([]string, len(n.Args))
	for i, arg := range n.Args {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", n.Name, strings.Join(args, ", "))
}

// BinaryOpNode represents a binary operation (+, -, *, /)
type BinaryOpNode struct {
	Op    string   // "+", "-", "*", "/"
	Left  Node     // Left operand
	Right Node     // Right operand
	Pos   Position // Source position (operator position)
}

func (n *BinaryOpNode) Type() NodeType     { return NodeTypeBinaryOp }
func (n *BinaryOpNode) Position() Position { return n.Pos }
func (n *BinaryOpNode) String() string {
	return fmt.Sprintf("(%s %s %s)", n.Left.String(), n.Op, n.Right.String())
}

// DurationNode represents a time duration (72min, 1hr, 1h 30min)
type DurationNode struct {
	Minutes float64  // Duration in minutes
	Raw     string   // Original string representation
	Pos     Position // Source position
}

func (n *DurationNode) Type() NodeType     { return NodeTypeDuration }
func (n *DurationNode) Position() Position { return n.Pos }
func (n *DurationNode) String() string {
	if n.Raw != "" {
		return n.Raw
	}
	return fmt.Sprintf("%.0fmin", n.Minutes)
}

// NumberNode represents a numeric literal
type NumberNode struct {
	Value float64  // The numeric value
	Pos   Position // Source position
}

func (n *NumberNode) Type() NodeType     { return NodeTypeNumber }
func (n *NumberNode) Position() Position { return n.Pos }
func (n *NumberNode) String() string     { return fmt.Sprintf("%g", n.Value) }

// ReferenceNode represents a reference to another zman (@zman_key)
type ReferenceNode struct {
	ZmanKey string   // The zman key without @ prefix
	Pos     Position // Source position
}

func (n *ReferenceNode) Type() NodeType     { return NodeTypeReference }
func (n *ReferenceNode) Position() Position { return n.Pos }
func (n *ReferenceNode) String() string     { return "@" + n.ZmanKey }

// StringNode represents a string literal
type StringNode struct {
	Value string   // The string value without quotes
	Pos   Position // Source position
}

func (n *StringNode) Type() NodeType     { return NodeTypeString }
func (n *StringNode) Position() Position { return n.Pos }
func (n *StringNode) String() string     { return fmt.Sprintf("%q", n.Value) }

// DirectionNode represents a direction keyword for solar function
type DirectionNode struct {
	Direction string   // "before_sunrise", "after_sunset", etc.
	Pos       Position // Source position
}

func (n *DirectionNode) Type() NodeType     { return NodeTypeString }
func (n *DirectionNode) Position() Position { return n.Pos }
func (n *DirectionNode) String() string     { return n.Direction }

// BaseNode represents a base keyword for proportional_hours function
type BaseNode struct {
	Base       string   // "gra", "mga", etc.
	CustomArgs []Node   // For custom(start, end)
	Pos        Position // Source position
}

func (n *BaseNode) Type() NodeType     { return NodeTypeString }
func (n *BaseNode) Position() Position { return n.Pos }
func (n *BaseNode) String() string {
	if n.Base == "custom" && len(n.CustomArgs) == 2 {
		return fmt.Sprintf("custom(%s, %s)", n.CustomArgs[0].String(), n.CustomArgs[1].String())
	}
	return n.Base
}

// ConditionalNode represents a conditional expression (if/else)
type ConditionalNode struct {
	Condition   Node     // The condition to evaluate
	TrueBranch  Node     // Expression if condition is true
	FalseBranch Node     // Expression if condition is false (optional)
	Pos         Position // Source position
}

func (n *ConditionalNode) Type() NodeType     { return NodeTypeConditional }
func (n *ConditionalNode) Position() Position { return n.Pos }
func (n *ConditionalNode) String() string {
	if n.FalseBranch == nil {
		return fmt.Sprintf("if (%s) { %s }", n.Condition.String(), n.TrueBranch.String())
	}
	return fmt.Sprintf("if (%s) { %s } else { %s }", n.Condition.String(), n.TrueBranch.String(), n.FalseBranch.String())
}

// ConditionNode represents a boolean condition
type ConditionNode struct {
	Left  Node     // Left side (e.g., "latitude")
	Op    string   // Comparison operator (>, <, >=, <=, ==, !=)
	Right Node     // Right side (e.g., 60)
	Pos   Position // Source position
}

func (n *ConditionNode) Type() NodeType     { return NodeTypeCondition }
func (n *ConditionNode) Position() Position { return n.Pos }
func (n *ConditionNode) String() string {
	return fmt.Sprintf("%s %s %s", n.Left.String(), n.Op, n.Right.String())
}

// ConditionVarNode represents a condition variable (latitude, day_length, etc.)
type ConditionVarNode struct {
	Name string   // "latitude", "longitude", "elevation", "day_length", "month", "day", "day_of_year", "date", "season"
	Pos  Position // Source position
}

func (n *ConditionVarNode) Type() NodeType     { return NodeTypeCondition }
func (n *ConditionVarNode) Position() Position { return n.Pos }
func (n *ConditionVarNode) String() string     { return n.Name }

// DateLiteralNode represents a date literal like 21-May, 1-Jan
type DateLiteralNode struct {
	Day   int      // Day of month (1-31)
	Month int      // Month (1-12)
	Raw   string   // Original string e.g. "21-May"
	Pos   Position // Source position
}

func (n *DateLiteralNode) Type() NodeType     { return NodeTypeNumber } // Compares as day_of_year
func (n *DateLiteralNode) Position() Position { return n.Pos }
func (n *DateLiteralNode) String() string     { return n.Raw }

// LogicalOpNode represents a logical operation (&& or ||)
type LogicalOpNode struct {
	Op    string   // "&&" or "||"
	Left  Node     // Left operand (boolean expression)
	Right Node     // Right operand (boolean expression)
	Pos   Position // Source position
}

func (n *LogicalOpNode) Type() NodeType     { return NodeTypeLogicalOp }
func (n *LogicalOpNode) Position() Position { return n.Pos }
func (n *LogicalOpNode) String() string {
	return fmt.Sprintf("(%s %s %s)", n.Left.String(), n.Op, n.Right.String())
}

// NotOpNode represents a logical NOT operation (!)
type NotOpNode struct {
	Operand Node     // The operand to negate
	Pos     Position // Source position
}

func (n *NotOpNode) Type() NodeType     { return NodeTypeNotOp }
func (n *NotOpNode) Position() Position { return n.Pos }
func (n *NotOpNode) String() string     { return fmt.Sprintf("!(%s)", n.Operand.String()) }

// ValueType represents the type of a computed value
type ValueType string

const (
	ValueTypeTime     ValueType = "Time"
	ValueTypeDuration ValueType = "Duration"
	ValueTypeNumber   ValueType = "Number"
	ValueTypeBoolean  ValueType = "Boolean"
	ValueTypeString   ValueType = "String"
)

// GetValueType determines the value type produced by an AST node
func GetValueType(n Node) ValueType {
	switch node := n.(type) {
	case *PrimitiveNode:
		return ValueTypeTime
	case *ReferenceNode:
		return ValueTypeTime
	case *FunctionNode:
		// solar, proportional_hours return Time; midpoint returns Time
		return ValueTypeTime
	case *DurationNode:
		return ValueTypeDuration
	case *NumberNode:
		return ValueTypeNumber
	case *StringNode:
		return ValueTypeString
	case *BinaryOpNode:
		leftType := GetValueType(node.Left)
		rightType := GetValueType(node.Right)
		// Time - Time = Duration
		if leftType == ValueTypeTime && rightType == ValueTypeTime && node.Op == "-" {
			return ValueTypeDuration
		}
		// Time +/- Duration = Time
		if leftType == ValueTypeTime && rightType == ValueTypeDuration {
			return ValueTypeTime
		}
		// Duration +/- Duration = Duration
		if leftType == ValueTypeDuration && rightType == ValueTypeDuration {
			return ValueTypeDuration
		}
		// Duration * Number = Duration
		if leftType == ValueTypeDuration && rightType == ValueTypeNumber {
			return ValueTypeDuration
		}
		// Number * Duration = Duration
		if leftType == ValueTypeNumber && rightType == ValueTypeDuration {
			return ValueTypeDuration
		}
		// Duration / Number = Duration
		if leftType == ValueTypeDuration && rightType == ValueTypeNumber && node.Op == "/" {
			return ValueTypeDuration
		}
		// Number / Number = Number
		if leftType == ValueTypeNumber && rightType == ValueTypeNumber {
			return ValueTypeNumber
		}
		return leftType // Fallback
	case *ConditionalNode:
		return GetValueType(node.TrueBranch)
	case *ConditionNode:
		return ValueTypeBoolean
	case *LogicalOpNode:
		return ValueTypeBoolean
	case *NotOpNode:
		return ValueTypeBoolean
	case *ConditionVarNode:
		if node.Name == "month" {
			return ValueTypeNumber
		}
		if node.Name == "season" {
			return ValueTypeString
		}
		if node.Name == "day_length" {
			return ValueTypeDuration
		}
		return ValueTypeNumber // latitude, longitude
	default:
		return ValueTypeNumber
	}
}

// ExtractReferences extracts all zman references from an AST node
func ExtractReferences(n Node) []string {
	var refs []string
	extractRefsRecursive(n, &refs)
	return refs
}

func extractRefsRecursive(n Node, refs *[]string) {
	switch node := n.(type) {
	case *ReferenceNode:
		*refs = append(*refs, node.ZmanKey)
	case *BinaryOpNode:
		extractRefsRecursive(node.Left, refs)
		extractRefsRecursive(node.Right, refs)
	case *FunctionNode:
		for _, arg := range node.Args {
			extractRefsRecursive(arg, refs)
		}
	case *ConditionalNode:
		extractRefsRecursive(node.Condition, refs)
		extractRefsRecursive(node.TrueBranch, refs)
		if node.FalseBranch != nil {
			extractRefsRecursive(node.FalseBranch, refs)
		}
	case *BaseNode:
		for _, arg := range node.CustomArgs {
			extractRefsRecursive(arg, refs)
		}
	case *ConditionNode:
		extractRefsRecursive(node.Left, refs)
		extractRefsRecursive(node.Right, refs)
	case *LogicalOpNode:
		extractRefsRecursive(node.Left, refs)
		extractRefsRecursive(node.Right, refs)
	case *NotOpNode:
		extractRefsRecursive(node.Operand, refs)
	}
}
