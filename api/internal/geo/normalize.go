// Package geo provides geographic data utilities shared across import tools.
package geo

import (
	"regexp"
	"strings"

	"golang.org/x/text/unicode/norm"
)

// ToASCII converts a string to ASCII by:
// 1. Normalizing unicode (NFD) to decompose accented characters
// 2. Removing non-ASCII characters (diacritics, non-Latin scripts)
// 3. Cleaning up whitespace
func ToASCII(s string) string {
	// Normalize to NFD (decomposed form) - separates base chars from diacritics
	t := norm.NFD.String(s)

	// Build ASCII-only result
	var result strings.Builder
	result.Grow(len(t))

	for _, r := range t {
		if r <= 127 {
			// Keep ASCII characters
			result.WriteRune(r)
		}
		// Skip non-ASCII (diacritics, non-Latin scripts, etc.)
	}

	// Clean up multiple spaces and trim
	ascii := result.String()
	ascii = strings.Join(strings.Fields(ascii), " ")

	return ascii
}

// Pre-compiled regexes for name normalization
var (
	stPrefixRe           = regexp.MustCompile(`^st\.?\s+`)
	stWordRe             = regexp.MustCompile(`\bst\.?\s+`)
	mtPrefixRe           = regexp.MustCompile(`^mt\.?\s+`)
	mtWordRe             = regexp.MustCompile(`\bmt\.?\s+`)
	localitySuffixCityRe = regexp.MustCompile(`\s+city$`)
	localitySuffixTownRe = regexp.MustCompile(`\s+town$`)
	uponSuffixRe         = regexp.MustCompile(`\s+upon\s+\w+$`)
	underSuffixRe        = regexp.MustCompile(`\s+under\s+\w+$`)
	onSuffixRe           = regexp.MustCompile(`\s+on\s+\w+$`)
	deLosSuffixRe        = regexp.MustCompile(`\s+de\s+los\s+\w+$`)
	deLaSuffixRe         = regexp.MustCompile(`\s+de\s+la\s+\w+$`)
	delSuffixRe          = regexp.MustCompile(`\s+del\s+\w+$`)
)

// NormalizeLocalityName normalizes a locality name for fuzzy matching by:
// 1. Converting to lowercase
// 2. Expanding/normalizing common abbreviations (St. -> Saint, Mt. -> Mount)
// 3. Removing common suffixes (City, Town, upon X, under X)
// 4. Stripping diacritics
func NormalizeLocalityName(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))

	// Normalize Saint/St variations
	s = stPrefixRe.ReplaceAllString(s, "saint ")
	s = stWordRe.ReplaceAllString(s, "saint ")

	// Normalize Mount/Mt variations
	s = mtPrefixRe.ReplaceAllString(s, "mount ")
	s = mtWordRe.ReplaceAllString(s, "mount ")

	// Remove common locality suffixes (case-insensitive, already lowercase)
	s = localitySuffixCityRe.ReplaceAllString(s, "")

	// Remove "town" suffix
	s = localitySuffixTownRe.ReplaceAllString(s, "")

	// Remove "upon X" / "under X" / "on X" suffixes (e.g., "Newcastle upon Tyne" -> "Newcastle")
	s = uponSuffixRe.ReplaceAllString(s, "")
	s = underSuffixRe.ReplaceAllString(s, "")
	s = onSuffixRe.ReplaceAllString(s, "")

	// Remove "de los X" / "de la X" / "del X" suffixes (Spanish, e.g., "León de los Aldama" -> "León")
	s = deLosSuffixRe.ReplaceAllString(s, "")
	s = deLaSuffixRe.ReplaceAllString(s, "")
	s = delSuffixRe.ReplaceAllString(s, "")

	// Strip diacritics by converting to ASCII
	s = strings.ToLower(ToASCII(s))

	// Clean up whitespace
	s = strings.Join(strings.Fields(s), " ")

	return s
}

// GenerateNameVariants generates multiple search variants for a locality name
func GenerateNameVariants(name string) []string {
	variants := make(map[string]bool)

	// Original (lowercased, trimmed)
	original := strings.ToLower(strings.TrimSpace(name))
	variants[original] = true

	// ASCII version
	ascii := strings.ToLower(ToASCII(name))
	if ascii != "" {
		variants[ascii] = true
	}

	// Normalized version (handles St./Saint, removes suffixes)
	normalized := NormalizeLocalityName(name)
	if normalized != "" {
		variants[normalized] = true
	}

	// Convert to slice
	result := make([]string, 0, len(variants))
	for v := range variants {
		if v != "" {
			result = append(result, v)
		}
	}

	return result
}
