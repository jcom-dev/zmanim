// Package dsl implements a domain-specific language for zmanim (Jewish prayer time) calculations.
// It provides lexing, parsing, validation, and execution of DSL expressions.
package dsl

import "fmt"

// TokenType represents the type of a token in the DSL
type TokenType int

const (
	// Literals and identifiers
	TOKEN_ILLEGAL TokenType = iota
	TOKEN_EOF
	TOKEN_IDENT

	// Primitives (built-in astronomical calculations)
	TOKEN_PRIMITIVE // sunrise, sunset, solar_noon, etc.

	// Functions
	TOKEN_FUNCTION // solar, proportional_hours, midpoint

	// Keywords
	TOKEN_IF
	TOKEN_ELSE

	// Direction keywords for solar function
	TOKEN_DIRECTION // before_sunrise, after_sunset, before_noon, after_noon

	// Base keywords for proportional_hours function
	TOKEN_BASE // gra, mga, mga_90, mga_120, custom

	// Condition keywords
	TOKEN_LATITUDE
	TOKEN_LONGITUDE
	TOKEN_DAY_LENGTH
	TOKEN_MONTH
	TOKEN_SEASON

	// Operators
	TOKEN_PLUS     // +
	TOKEN_MINUS    // -
	TOKEN_MULTIPLY // *
	TOKEN_DIVIDE   // /
	TOKEN_LPAREN   // (
	TOKEN_RPAREN   // )
	TOKEN_LBRACE   // {
	TOKEN_RBRACE   // }
	TOKEN_COMMA    // ,
	TOKEN_AT       // @

	// Comparison operators
	TOKEN_GT  // >
	TOKEN_LT  // <
	TOKEN_GTE // >=
	TOKEN_LTE // <=
	TOKEN_EQ  // ==
	TOKEN_NEQ // !=

	// Logical operators
	TOKEN_AND // &&
	TOKEN_OR  // ||
	TOKEN_NOT // !

	// Literals
	TOKEN_NUMBER   // 16.1, 72, etc.
	TOKEN_DURATION // 72min, 1hr, 1h 30min
	TOKEN_STRING   // "summer", etc.

	// Comments (stripped during lexing but noted for completeness)
	TOKEN_COMMENT
)

var tokenTypeNames = map[TokenType]string{
	TOKEN_ILLEGAL:    "ILLEGAL",
	TOKEN_EOF:        "EOF",
	TOKEN_IDENT:      "IDENT",
	TOKEN_PRIMITIVE:  "PRIMITIVE",
	TOKEN_FUNCTION:   "FUNCTION",
	TOKEN_IF:         "IF",
	TOKEN_ELSE:       "ELSE",
	TOKEN_DIRECTION:  "DIRECTION",
	TOKEN_BASE:       "BASE",
	TOKEN_LATITUDE:   "LATITUDE",
	TOKEN_LONGITUDE:  "LONGITUDE",
	TOKEN_DAY_LENGTH: "DAY_LENGTH",
	TOKEN_MONTH:      "MONTH",
	TOKEN_SEASON:     "SEASON",
	TOKEN_PLUS:       "PLUS",
	TOKEN_MINUS:      "MINUS",
	TOKEN_MULTIPLY:   "MULTIPLY",
	TOKEN_DIVIDE:     "DIVIDE",
	TOKEN_LPAREN:     "LPAREN",
	TOKEN_RPAREN:     "RPAREN",
	TOKEN_LBRACE:     "LBRACE",
	TOKEN_RBRACE:     "RBRACE",
	TOKEN_COMMA:      "COMMA",
	TOKEN_AT:         "AT",
	TOKEN_GT:         "GT",
	TOKEN_LT:         "LT",
	TOKEN_GTE:        "GTE",
	TOKEN_LTE:        "LTE",
	TOKEN_EQ:         "EQ",
	TOKEN_NEQ:        "NEQ",
	TOKEN_AND:        "AND",
	TOKEN_OR:         "OR",
	TOKEN_NOT:        "NOT",
	TOKEN_NUMBER:     "NUMBER",
	TOKEN_DURATION:   "DURATION",
	TOKEN_STRING:     "STRING",
	TOKEN_COMMENT:    "COMMENT",
}

func (t TokenType) String() string {
	if name, ok := tokenTypeNames[t]; ok {
		return name
	}
	return fmt.Sprintf("UNKNOWN(%d)", t)
}

// Token represents a lexical token in the DSL
type Token struct {
	Type    TokenType
	Literal string
	Line    int
	Column  int
}

func (t Token) String() string {
	return fmt.Sprintf("Token{%s, %q, %d:%d}", t.Type, t.Literal, t.Line, t.Column)
}

// Position represents a location in the source code
type Position struct {
	Line   int
	Column int
}

func (p Position) String() string {
	return fmt.Sprintf("%d:%d", p.Line, p.Column)
}

// Keywords maps keyword strings to their token types
var Keywords = map[string]TokenType{
	"if":   TOKEN_IF,
	"else": TOKEN_ELSE,
}

// Primitives are built-in astronomical time calculations
var Primitives = map[string]bool{
	"sunrise":           true,
	"sunset":            true,
	"solar_noon":        true,
	"solar_midnight":    true,
	"visible_sunrise":   true,
	"visible_sunset":    true,
	"civil_dawn":        true,
	"civil_dusk":        true,
	"nautical_dawn":     true,
	"nautical_dusk":     true,
	"astronomical_dawn": true,
	"astronomical_dusk": true,
}

// Functions are built-in DSL functions
var Functions = map[string]bool{
	"solar":              true,
	"seasonal_solar":     true,
	"proportional_hours": true,
	"midpoint":           true,
}

// Directions are valid direction parameters for the solar function
var Directions = map[string]bool{
	"before_sunrise": true,
	"after_sunset":   true,
	"before_noon":    true,
	"after_noon":     true,
}

// Bases are valid base parameters for the proportional_hours function
var Bases = map[string]bool{
	"gra":     true,
	"mga":     true,
	"mga_90":  true,
	"mga_120": true,
	"custom":  true,
}

// ConditionKeywords are keywords used in conditional expressions
var ConditionKeywords = map[string]TokenType{
	"latitude":   TOKEN_LATITUDE,
	"longitude":  TOKEN_LONGITUDE,
	"day_length": TOKEN_DAY_LENGTH,
	"month":      TOKEN_MONTH,
	"season":     TOKEN_SEASON,
}

// LookupIdent returns the token type for an identifier
func LookupIdent(ident string) TokenType {
	if tok, ok := Keywords[ident]; ok {
		return tok
	}
	if Primitives[ident] {
		return TOKEN_PRIMITIVE
	}
	if Functions[ident] {
		return TOKEN_FUNCTION
	}
	if Directions[ident] {
		return TOKEN_DIRECTION
	}
	if Bases[ident] {
		return TOKEN_BASE
	}
	if tok, ok := ConditionKeywords[ident]; ok {
		return tok
	}
	return TOKEN_IDENT
}
