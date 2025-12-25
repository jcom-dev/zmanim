// Package calendar provides HebCal integration for Jewish calendar events
// All calendar functionality uses the hebcal-go library directly - no external API calls.
package calendar

import (
	"strings"
)

// TagEventMapping represents a mapping from database
type TagEventMapping struct {
	TagKey   string
	Pattern  string
	Priority int
}

// IsInIsrael determines if coordinates are within Israel
// Uses approximate bounding box for Israel
func IsInIsrael(lat, lng float64) bool {
	// Approximate Israel bounding box
	return lat >= 29.5 && lat <= 33.3 && lng >= 34.2 && lng <= 35.9
}

// MatchEventToTags matches holiday names against tag patterns
// Returns a list of matched tag keys
func MatchEventToTags(holidayNames []string, mappings []TagEventMapping) []string {
	matchedTags := make(map[string]bool)

	for _, name := range holidayNames {
		for _, mapping := range mappings {
			if matchPattern(name, mapping.Pattern) {
				matchedTags[mapping.TagKey] = true
			}
		}
	}

	// Convert to slice
	result := make([]string, 0, len(matchedTags))
	for tagKey := range matchedTags {
		result = append(result, tagKey)
	}

	return result
}

// matchPattern supports SQL LIKE-style patterns with % wildcard
func matchPattern(title, pattern string) bool {
	// Exact match
	if title == pattern {
		return true
	}

	// No wildcard - exact match only
	if !strings.Contains(pattern, "%") {
		return title == pattern
	}

	// Handle wildcard patterns
	parts := strings.Split(pattern, "%")

	switch len(parts) {
	case 2:
		// Single wildcard
		if parts[0] == "" {
			// Pattern starts with %: suffix match
			return strings.HasSuffix(title, parts[1])
		}
		if parts[1] == "" {
			// Pattern ends with %: prefix match
			return strings.HasPrefix(title, parts[0])
		}
		// Wildcard in middle: contains both parts in order
		idx := strings.Index(title, parts[0])
		if idx == -1 {
			return false
		}
		return strings.Contains(title[idx+len(parts[0]):], parts[1])
	case 3:
		// Two wildcards: %X% means contains X
		if parts[0] == "" && parts[2] == "" {
			return strings.Contains(title, parts[1])
		}
	}

	// Fallback: simple contains check for the non-wildcard parts
	for _, part := range parts {
		if part != "" && !strings.Contains(title, part) {
			return false
		}
	}
	return true
}
