package services

import (
	"html"
	"regexp"
	"strings"
)

// DSL token colors matching UX design
const (
	colorPrimitive = "#3B82F6" // Blue - primitives like sunrise, sunset, solar_noon
	colorFunction  = "#10B981" // Green - functions like solar(), proportional_hours()
	colorNumber    = "#F59E0B" // Orange - numbers, durations (72min, 16.1)
	colorOperator  = "#6B7280" // Gray - operators (+, -, *, /)
	colorReference = "#8B5CF6" // Purple - references (@alos_12, @tzais)
	colorKeyword   = "#EC4899" // Pink - keywords (if, else, custom)
)

// HighlightDSLFormula takes a DSL formula string and returns HTML with syntax highlighting
// using inline styles for PDF rendering. The output uses JetBrains Mono font family.
func HighlightDSLFormula(formula string) string {
	if formula == "" {
		return ""
	}

	// HTML escape the input first to prevent injection
	escaped := html.EscapeString(formula)

	// Define DSL primitives (14 total)
	primitives := []string{
		"sunrise", "sunset", "solar_noon", "solar_midnight",
		"visible_sunrise", "visible_sunset",
		"geometric_sunrise", "geometric_sunset",
		"civil_dawn", "civil_dusk",
		"nautical_dawn", "nautical_dusk",
		"astronomical_dawn", "astronomical_dusk",
	}

	// Define DSL functions (8 total)
	functions := []string{
		"solar", "seasonal_solar",
		"proportional_hours", "proportional_minutes",
		"midpoint", "first_valid", "earlier_of", "later_of",
	}

	// Define DSL keywords
	keywords := []string{
		"if", "else", "custom",
		"before_sunrise", "after_sunrise", "before_sunset", "after_sunset",
		"before_visible_sunrise", "after_visible_sunrise",
		"before_visible_sunset", "after_visible_sunset",
		"before_geometric_sunrise", "after_geometric_sunrise",
		"before_geometric_sunset", "after_geometric_sunset",
		"before_noon", "after_noon",
		"gra", "mga", "mga_60", "mga_72", "mga_90", "mga_96", "mga_120",
		"mga_72_zmanis", "mga_90_zmanis", "mga_96_zmanis",
		"mga_16_1", "mga_18", "mga_19_8", "mga_26",
		"baal_hatanya", "ateret_torah",
	}

	// Build a single pass regex that captures all token types
	// Order matters: longer patterns first, more specific before generic

	// References: @identifier
	refPattern := `@[a-zA-Z_][a-zA-Z0-9_]*`

	// Numbers with units: 72min, 16.1, 1hr, 1h, 90min, etc.
	numberPattern := `\b\d+\.?\d*(min|hr|h)?\b`

	// Build combined identifier pattern (functions, primitives, keywords)
	allIdentifiers := make([]string, 0, len(functions)+len(primitives)+len(keywords))
	allIdentifiers = append(allIdentifiers, functions...)
	allIdentifiers = append(allIdentifiers, primitives...)
	allIdentifiers = append(allIdentifiers, keywords...)
	identifierPattern := `\b(` + strings.Join(allIdentifiers, "|") + `)\b`

	// Operators: +, -, *, /, ==, !=, >=, <=, >, <, &&, ||, !
	opPattern := `(\+|-|\*|/|==|!=|>=|<=|>|<|&&|\|\||!)`

	// Combine patterns - references first, then identifiers, numbers, operators
	combined := regexp.MustCompile(
		`(` + refPattern + `)` + // Group 1: references
			`|(` + identifierPattern + `)` + // Group 2-3: functions/primitives/keywords (we'll disambiguate)
			`|(` + numberPattern + `)` + // Group 4: numbers
			`|(` + opPattern + `)`, // Group 5: operators
	)

	// Track position for reconstruction
	result := strings.Builder{}
	lastEnd := 0

	// Create helper sets for quick lookups
	funcSet := make(map[string]bool)
	for _, f := range functions {
		funcSet[f] = true
	}
	primSet := make(map[string]bool)
	for _, p := range primitives {
		primSet[p] = true
	}
	keywordSet := make(map[string]bool)
	for _, k := range keywords {
		keywordSet[k] = true
	}

	matches := combined.FindAllStringSubmatchIndex(escaped, -1)
	for _, match := range matches {
		// Add text before this match
		if match[0] > lastEnd {
			result.WriteString(escaped[lastEnd:match[0]])
		}

		matchText := escaped[match[0]:match[1]]
		var color string

		// Determine which group matched
		switch {
		case match[2] != -1: // Reference (@...)
			color = colorReference
		case match[4] != -1: // Identifier (could be function, keyword, or primitive)
			// Check if next non-whitespace char is '(' to identify functions
			nextIdx := match[1]
			for nextIdx < len(escaped) && (escaped[nextIdx] == ' ' || escaped[nextIdx] == '\t') {
				nextIdx++
			}
			isFunction := nextIdx < len(escaped) && escaped[nextIdx] == '('

			if isFunction && funcSet[matchText] {
				color = colorFunction
			} else if keywordSet[matchText] {
				color = colorKeyword
			} else if primSet[matchText] {
				color = colorPrimitive
			} else {
				// Default to primitive color for unknown identifiers
				color = colorPrimitive
			}
		case match[6] != -1: // Number
			color = colorNumber
		case match[8] != -1: // Operator
			color = colorOperator
		default:
			// No match (shouldn't happen, but just in case)
			result.WriteString(matchText)
			lastEnd = match[1]
			continue
		}

		// Wrap in span with inline style
		result.WriteString(`<span style="color:`)
		result.WriteString(color)
		result.WriteString(`">`)
		result.WriteString(matchText)
		result.WriteString(`</span>`)

		lastEnd = match[1]
	}

	// Add remaining text
	if lastEnd < len(escaped) {
		result.WriteString(escaped[lastEnd:])
	}

	return result.String()
}
