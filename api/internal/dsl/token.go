// Package dsl implements a domain-specific language for zmanim calculations.
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
	TOKEN_DAY
	TOKEN_DAY_OF_YEAR
	TOKEN_DATE
	TOKEN_SEASON
	TOKEN_DATE_LITERAL // 21-May, 1-Jan, etc.

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
	TOKEN_LATITUDE:     "LATITUDE",
	TOKEN_LONGITUDE:    "LONGITUDE",
	TOKEN_DAY_LENGTH:   "DAY_LENGTH",
	TOKEN_MONTH:        "MONTH",
	TOKEN_DAY:          "DAY",
	TOKEN_DAY_OF_YEAR:  "DAY_OF_YEAR",
	TOKEN_DATE:         "DATE",
	TOKEN_SEASON:       "SEASON",
	TOKEN_DATE_LITERAL: "DATE_LITERAL",
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
	"visible_sunrise":   true,
	"visible_sunset":    true,
	"geometric_sunrise": true,
	"geometric_sunset":  true,
	"solar_noon":        true,
	"solar_midnight":    true,
	"civil_dawn":        true,
	"civil_dusk":        true,
	"nautical_dawn":     true,
	"nautical_dusk":     true,
	"astronomical_dawn": true,
	"astronomical_dusk": true,
}

// Functions are built-in DSL functions
var Functions = map[string]bool{
	"solar":                true,
	"seasonal_solar":       true,
	"proportional_hours":   true,
	"proportional_minutes": true, // Zmaniyos (proportional) minutes before/after sunrise/sunset
	"midpoint":             true,
	"first_valid":          true,
	"earlier_of":           true,
	"later_of":             true,
}

// Directions are valid direction parameters for the solar function
var Directions = map[string]bool{
	// Visible sunrise/sunset directions (standard - includes atmospheric refraction)
	"before_visible_sunrise": true,
	"after_visible_sunrise":  true,
	"before_visible_sunset":  true,
	"after_visible_sunset":   true,

	// Geometric sunrise/sunset directions (pure geometric - no refraction)
	"before_geometric_sunrise": true,
	"after_geometric_sunrise":  true,
	"before_geometric_sunset":  true,
	"after_geometric_sunset":   true,

	// Solar noon directions
	"before_noon": true,
	"after_noon":  true,
}

// Bases are valid base parameters for the proportional_hours function
var Bases = map[string]bool{
	"gra": true, // GRA: sunrise to sunset

	// Fixed-minute MGA variants
	"mga":     true, // MGA: 72 minutes before sunrise to 72 minutes after sunset (default)
	"mga_60":  true, // MGA 60: 60 minutes before sunrise to 60 minutes after sunset
	"mga_72":  true, // MGA 72: explicit 72 minutes (same as "mga")
	"mga_90":  true, // MGA 90: 90 minutes before sunrise to 90 minutes after sunset
	"mga_96":  true, // MGA 96: 96 minutes before sunrise to 96 minutes after sunset
	"mga_120": true, // MGA 120: 120 minutes before sunrise to 120 minutes after sunset

	// Zmaniyos (proportional) minute MGA variants - adjusts based on day length
	"mga_72_zmanis": true, // MGA 72 zmaniyos: 1/10th of day before sunrise to 1/10th after sunset
	"mga_90_zmanis": true, // MGA 90 zmaniyos: 1/8th of day before sunrise to 1/8th after sunset
	"mga_96_zmanis": true, // MGA 96 zmaniyos: 1/7.5th of day before sunrise to 1/7.5th after sunset

	// Solar angle-based MGA variants
	"mga_16_1": true, // MGA 16.1°: 16.1° alos to 16.1° tzais (72-min equivalent at Jerusalem equinox)
	"mga_18":   true, // MGA 18°: 18° alos to 18° tzais (astronomical twilight)
	"mga_19_8": true, // MGA 19.8°: 19.8° alos to 19.8° tzais (90-min equivalent at Jerusalem equinox)
	"mga_26":   true, // MGA 26°: 26° alos to 26° tzais (120-min equivalent at Jerusalem equinox)

	// Baal HaTanya (Shulchan Aruch HaRav / Chabad)
	"baal_hatanya": true, // 1.583° below horizon for netz amiti/shkiah amiti

	// Ateret Torah (Rabbi Yitzhak Yosef / Yalkut Yosef)
	"ateret_torah": true, // Sunrise to tzais 40 minutes (Sephardic/Yemenite custom)

	// Custom user-defined base
	"custom": true, // custom(start, end): user-defined day boundaries
}

// ConditionKeywords are keywords used in conditional expressions
var ConditionKeywords = map[string]TokenType{
	"latitude":    TOKEN_LATITUDE,
	"longitude":   TOKEN_LONGITUDE,
	"day_length":  TOKEN_DAY_LENGTH,
	"month":       TOKEN_MONTH,
	"day":         TOKEN_DAY,
	"day_of_year": TOKEN_DAY_OF_YEAR,
	"date":        TOKEN_DATE,
	"season":      TOKEN_SEASON,
}

// MonthNames maps month abbreviations to month numbers (1-12)
var MonthNames = map[string]int{
	"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
	"Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
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
