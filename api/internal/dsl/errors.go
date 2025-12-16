// File: errors.go
// Purpose: DSL error types and formatting
// Pattern: error-handling
// Dependencies: none
// Frequency: moderate - used for formula validation feedback
//
// Provides structured error types for DSL processing:
//   - Syntax errors: illegal characters, unexpected tokens
//   - Semantic errors: type mismatches, undefined references
//   - Runtime errors: division by zero, polar region issues
//
// Includes user-friendly error formatting with suggestions.

package dsl

import (
	"fmt"
	"strings"
)

// ErrorType categorizes DSL errors
type ErrorType string

const (
	ErrorTypeSyntax   ErrorType = "syntax"
	ErrorTypeSemantic ErrorType = "semantic"
	ErrorTypeRuntime  ErrorType = "runtime"
)

// DSLError represents an error in DSL processing
type DSLError struct {
	Type       ErrorType
	Message    string
	Line       int
	Column     int
	Context    string // The relevant portion of the formula
	Suggestion string // Helpful suggestion for fixing the error
}

func (e *DSLError) Error() string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("%s error", e.Type))
	if e.Line > 0 {
		sb.WriteString(fmt.Sprintf(" on line %d", e.Line))
		if e.Column > 0 {
			sb.WriteString(fmt.Sprintf(", column %d", e.Column))
		}
	}
	sb.WriteString(": ")
	sb.WriteString(e.Message)
	return sb.String()
}

// FormatError returns a detailed, user-friendly error message
func (e *DSLError) FormatError() string {
	var sb strings.Builder

	// Error header
	sb.WriteString(fmt.Sprintf("❌ %s error", strings.Title(string(e.Type))))
	if e.Line > 0 {
		sb.WriteString(fmt.Sprintf(" on line %d", e.Line))
		if e.Column > 0 {
			sb.WriteString(fmt.Sprintf(", column %d", e.Column))
		}
	}
	sb.WriteString(":\n")
	sb.WriteString("   ")
	sb.WriteString(e.Message)
	sb.WriteString("\n")

	// Context if available
	if e.Context != "" {
		sb.WriteString("\n   Formula: ")
		sb.WriteString(e.Context)
		sb.WriteString("\n")
		if e.Column > 0 && e.Column <= len(e.Context)+10 {
			sb.WriteString("            ")
			for i := 0; i < e.Column-1; i++ {
				sb.WriteString(" ")
			}
			sb.WriteString("^\n")
		}
	}

	// Suggestion if available
	if e.Suggestion != "" {
		sb.WriteString("\n💡 ")
		sb.WriteString(e.Suggestion)
		sb.WriteString("\n")
	}

	return sb.String()
}

// ValidationError represents a validation error with position info
type ValidationError struct {
	Message    string `json:"message"`
	Line       int    `json:"line"`
	Column     int    `json:"column"`
	Suggestion string `json:"suggestion,omitempty"`
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("line %d, column %d: %s", e.Line, e.Column, e.Message)
}

// NewSyntaxError creates a syntax error
func NewSyntaxError(line, column int, message string) *DSLError {
	return &DSLError{
		Type:    ErrorTypeSyntax,
		Message: message,
		Line:    line,
		Column:  column,
	}
}

// NewSyntaxErrorWithContext creates a syntax error with context
func NewSyntaxErrorWithContext(line, column int, message, context, suggestion string) *DSLError {
	return &DSLError{
		Type:       ErrorTypeSyntax,
		Message:    message,
		Line:       line,
		Column:     column,
		Context:    context,
		Suggestion: suggestion,
	}
}

// NewSemanticError creates a semantic error
func NewSemanticError(line, column int, message string) *DSLError {
	return &DSLError{
		Type:    ErrorTypeSemantic,
		Message: message,
		Line:    line,
		Column:  column,
	}
}

// NewSemanticErrorWithSuggestion creates a semantic error with suggestion
func NewSemanticErrorWithSuggestion(line, column int, message, suggestion string) *DSLError {
	return &DSLError{
		Type:       ErrorTypeSemantic,
		Message:    message,
		Line:       line,
		Column:     column,
		Suggestion: suggestion,
	}
}

// NewRuntimeError creates a runtime error
func NewRuntimeError(message string) *DSLError {
	return &DSLError{
		Type:    ErrorTypeRuntime,
		Message: message,
	}
}

// CircularDependencyError represents a circular dependency in zman references
type CircularDependencyError struct {
	Chain []string // The chain of dependencies that form the cycle
}

func (e *CircularDependencyError) Error() string {
	return fmt.Sprintf("circular dependency detected: %s", strings.Join(e.Chain, " → "))
}

// FormatCircularDependency formats a circular dependency error for display
func FormatCircularDependency(chain []string) string {
	var sb strings.Builder
	sb.WriteString("⚠️ Circular dependency detected!\n\n")
	sb.WriteString("   Dependency chain:\n")
	sb.WriteString("   ")
	sb.WriteString(strings.Join(chain, " → "))
	sb.WriteString(" (circular!)\n")
	sb.WriteString("\n💡 Break the cycle by using a primitive or different reference\n")
	return sb.String()
}

// UndefinedReferenceError represents a reference to an undefined zman
type UndefinedReferenceError struct {
	Reference      string
	Line           int
	Column         int
	AvailableZmans []string
}

func (e *UndefinedReferenceError) Error() string {
	return fmt.Sprintf("undefined reference: @%s", e.Reference)
}

// FormatUndefinedReference formats an undefined reference error for display
func FormatUndefinedReference(ref string, line, column int, available []string) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("❌ Error on line %d, column %d:\n", line, column))
	sb.WriteString(fmt.Sprintf("   Undefined reference: @%s\n", ref))
	if len(available) > 0 {
		sb.WriteString("\n💡 Available zmanim: ")
		for i, zman := range available {
			if i > 0 {
				sb.WriteString(", ")
			}
			sb.WriteString("@" + zman)
		}
		sb.WriteString("\n")
	}
	return sb.String()
}

// TypeMismatchError represents a type compatibility error
type TypeMismatchError struct {
	Operation string
	LeftType  string
	RightType string
	Line      int
	Column    int
}

func (e *TypeMismatchError) Error() string {
	return fmt.Sprintf("cannot %s %s and %s", e.Operation, e.LeftType, e.RightType)
}

// ParameterRangeError represents a parameter out of valid range
type ParameterRangeError struct {
	Parameter string
	Value     float64
	Min       float64
	Max       float64
	Line      int
	Column    int
}

func (e *ParameterRangeError) Error() string {
	return fmt.Sprintf("parameter '%s' must be between %.1f and %.1f, got %.1f",
		e.Parameter, e.Min, e.Max, e.Value)
}

// ErrorList represents a collection of errors
type ErrorList []*DSLError

func (el ErrorList) Error() string {
	if len(el) == 0 {
		return "no errors"
	}
	var sb strings.Builder
	for i, err := range el {
		if i > 0 {
			sb.WriteString("\n")
		}
		sb.WriteString(err.Error())
	}
	return sb.String()
}

// Add appends an error to the list
func (el *ErrorList) Add(err *DSLError) {
	*el = append(*el, err)
}

// HasErrors returns true if there are any errors
func (el ErrorList) HasErrors() bool {
	return len(el) > 0
}

// ToValidationErrors converts ErrorList to ValidationError slice
func (el ErrorList) ToValidationErrors() []ValidationError {
	result := make([]ValidationError, len(el))
	for i, err := range el {
		result[i] = ValidationError{
			Message:    err.Message,
			Line:       err.Line,
			Column:     err.Column,
			Suggestion: err.Suggestion,
		}
	}
	return result
}
