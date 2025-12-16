// Package sanitize provides HTML/Markdown sanitization for user input
package sanitize

import (
	"html"
	"regexp"
	"strings"
)

// Common dangerous patterns
var (
	scriptPattern  = regexp.MustCompile(`(?i)<script[^>]*>.*?</script>`)
	eventPattern   = regexp.MustCompile(`(?i)\s+on\w+\s*=\s*["'][^"']*["']`)
	stylePattern   = regexp.MustCompile(`(?i)<style[^>]*>.*?</style>`)
	iframePattern  = regexp.MustCompile(`(?i)<iframe[^>]*>.*?</iframe>`)
	objectPattern  = regexp.MustCompile(`(?i)<object[^>]*>.*?</object>`)
	embedPattern   = regexp.MustCompile(`(?i)<embed[^>]*>`)
	linkPattern    = regexp.MustCompile(`(?i)<link[^>]*>`)
	metaPattern    = regexp.MustCompile(`(?i)<meta[^>]*>`)
	basePattern    = regexp.MustCompile(`(?i)<base[^>]*>`)
	dataURLPattern = regexp.MustCompile(`(?i)data:[^"'\s]*`)
	javascriptURL  = regexp.MustCompile(`(?i)javascript:`)
	vbscriptURL    = regexp.MustCompile(`(?i)vbscript:`)
	expressionCSS  = regexp.MustCompile(`(?i)expression\s*\(`)
)

// AllowedHTMLTags are tags permitted in Markdown output
var AllowedHTMLTags = map[string]bool{
	"p":          true,
	"br":         true,
	"h1":         true,
	"h2":         true,
	"h3":         true,
	"h4":         true,
	"h5":         true,
	"h6":         true,
	"strong":     true,
	"b":          true,
	"em":         true,
	"i":          true,
	"u":          true,
	"s":          true,
	"del":        true,
	"ins":        true,
	"code":       true,
	"pre":        true,
	"blockquote": true,
	"ul":         true,
	"ol":         true,
	"li":         true,
	"a":          true,
	"hr":         true,
	"span":       true,
	"div":        true,
	"table":      true,
	"thead":      true,
	"tbody":      true,
	"tr":         true,
	"th":         true,
	"td":         true,
}

// SanitizeMarkdown cleans user-provided Markdown/HTML content
// It removes dangerous scripts, event handlers, and other XSS vectors
// while preserving standard Markdown formatting
func SanitizeMarkdown(input string) string {
	if input == "" {
		return ""
	}

	result := input

	// Remove script tags and content
	result = scriptPattern.ReplaceAllString(result, "")

	// Remove style tags and content
	result = stylePattern.ReplaceAllString(result, "")

	// Remove iframe, object, embed tags
	result = iframePattern.ReplaceAllString(result, "")
	result = objectPattern.ReplaceAllString(result, "")
	result = embedPattern.ReplaceAllString(result, "")

	// Remove link, meta, base tags
	result = linkPattern.ReplaceAllString(result, "")
	result = metaPattern.ReplaceAllString(result, "")
	result = basePattern.ReplaceAllString(result, "")

	// Remove event handlers (onclick, onmouseover, etc.)
	result = eventPattern.ReplaceAllString(result, "")

	// Remove dangerous URL schemes
	result = javascriptURL.ReplaceAllString(result, "")
	result = vbscriptURL.ReplaceAllString(result, "")
	result = dataURLPattern.ReplaceAllString(result, "")

	// Remove CSS expressions
	result = expressionCSS.ReplaceAllString(result, "")

	return strings.TrimSpace(result)
}

// SanitizeForDisplay sanitizes content and escapes HTML entities
// for safe display in non-Markdown contexts
func SanitizeForDisplay(input string) string {
	// First sanitize
	sanitized := SanitizeMarkdown(input)
	// Then escape HTML entities
	return html.EscapeString(sanitized)
}

// ValidateMarkdownLength checks if the markdown content is within the allowed length
func ValidateMarkdownLength(input string, maxLength int) bool {
	return len(input) <= maxLength
}

// TruncateMarkdown truncates markdown to a maximum length while trying
// to preserve complete words and not break in the middle of formatting
func TruncateMarkdown(input string, maxLength int) string {
	if len(input) <= maxLength {
		return input
	}

	// Find a good break point
	truncated := input[:maxLength]

	// Try to end at a space or newline
	lastSpace := strings.LastIndexAny(truncated, " \n\r\t")
	if lastSpace > maxLength*3/4 {
		truncated = truncated[:lastSpace]
	}

	return strings.TrimSpace(truncated) + "..."
}
