package sanitize

import (
	"strings"
	"testing"
)

func TestSanitizeMarkdown(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "plain text unchanged",
			input:    "Hello world",
			expected: "Hello world",
		},
		{
			name:     "valid markdown preserved",
			input:    "## Heading\n\n**bold** and *italic*",
			expected: "## Heading\n\n**bold** and *italic*",
		},
		{
			name:     "hebrew text preserved",
			input:    "## מקור\n\nשולחן ערוך או\"ח סימן רל\"ג",
			expected: "## מקור\n\nשולחן ערוך או\"ח סימן רל\"ג",
		},
		{
			name:     "script tags removed",
			input:    "Hello <script>alert('xss')</script> world",
			expected: "Hello  world",
		},
		{
			name:     "style tags removed",
			input:    "Hello <style>body{display:none}</style> world",
			expected: "Hello  world",
		},
		{
			name:     "iframe removed",
			input:    "Hello <iframe src='evil.com'></iframe> world",
			expected: "Hello  world",
		},
		{
			name:     "onclick handler removed",
			input:    "<a href='#' onclick='alert(1)'>link</a>",
			expected: "<a href='#'>link</a>",
		},
		{
			name:     "onmouseover handler removed",
			input:    "<div onmouseover=\"evil()\">content</div>",
			expected: "<div>content</div>",
		},
		{
			name:     "javascript URL removed",
			input:    "<a href=\"javascript:alert(1)\">click</a>",
			expected: "<a href=\"alert(1)\">click</a>",
		},
		{
			name:     "data URL removed",
			input:    "<img src=\"data:text/html,<script>alert(1)</script>\">",
			expected: "<img src=\"\">",
		},
		{
			name:     "mixed content",
			input:    "## שולחן ערוך\n\n<script>bad</script>\n\nGood content **here**",
			expected: "## שולחן ערוך\n\n\n\nGood content **here**",
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "object tag removed",
			input:    "<object data='evil.swf'></object>",
			expected: "",
		},
		{
			name:     "embed tag removed",
			input:    "<embed src='evil.swf'>",
			expected: "",
		},
		{
			name:     "CSS expression removed",
			input:    "<div style=\"width:expression(alert(1))\">",
			expected: "<div style=\"width:alert(1))\">",
		},
		{
			name:     "link tag removed",
			input:    "<link rel='stylesheet' href='evil.css'>",
			expected: "",
		},
		{
			name:     "meta tag removed",
			input:    "<meta http-equiv='refresh' content='0;url=evil'>",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeMarkdown(tt.input)
			if result != tt.expected {
				t.Errorf("SanitizeMarkdown(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestSanitizeForDisplay(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		contains string
	}{
		{
			name:     "escapes HTML entities",
			input:    "<div>test</div>",
			contains: "&lt;div&gt;",
		},
		{
			name:     "removes scripts before escaping",
			input:    "<script>alert(1)</script>",
			contains: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeForDisplay(tt.input)
			if tt.contains != "" && !strings.Contains(result, tt.contains) {
				t.Errorf("SanitizeForDisplay(%q) = %q, want to contain %q", tt.input, result, tt.contains)
			}
		})
	}
}

func TestValidateMarkdownLength(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		maxLength int
		valid     bool
	}{
		{
			name:      "within limit",
			input:     "Hello",
			maxLength: 10,
			valid:     true,
		},
		{
			name:      "at limit",
			input:     "Hello",
			maxLength: 5,
			valid:     true,
		},
		{
			name:      "exceeds limit",
			input:     "Hello world",
			maxLength: 5,
			valid:     false,
		},
		{
			name:      "empty string",
			input:     "",
			maxLength: 5,
			valid:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateMarkdownLength(tt.input, tt.maxLength)
			if result != tt.valid {
				t.Errorf("ValidateMarkdownLength(%q, %d) = %v, want %v", tt.input, tt.maxLength, result, tt.valid)
			}
		})
	}
}

func TestTruncateMarkdown(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		maxLength int
		endsWith  string
	}{
		{
			name:      "no truncation needed",
			input:     "Hello",
			maxLength: 10,
			endsWith:  "Hello",
		},
		{
			name:      "truncates at space",
			input:     "Hello world this is a test",
			maxLength: 12,
			endsWith:  "...",
		},
		{
			name:      "preserves words",
			input:     "This is a long sentence that needs truncating",
			maxLength: 20,
			endsWith:  "...",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := TruncateMarkdown(tt.input, tt.maxLength)
			if !strings.HasSuffix(result, tt.endsWith) {
				t.Errorf("TruncateMarkdown(%q, %d) = %q, want to end with %q", tt.input, tt.maxLength, result, tt.endsWith)
			}
			// Ensure result is not longer than maxLength + 3 for ellipsis
			if len(tt.input) > tt.maxLength && len(result) > tt.maxLength+3 {
				t.Errorf("TruncateMarkdown(%q, %d) = %q, length %d exceeds expected max", tt.input, tt.maxLength, result, len(result))
			}
		})
	}
}
