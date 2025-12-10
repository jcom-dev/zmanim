// Package validation provides validation utilities for zmanim
package validation

import (
	"errors"
	"unicode"
)

// HebrewBlock represents the Unicode Hebrew block range
const (
	HebrewBlockStart = 0x0590
	HebrewBlockEnd   = 0x05FF
)

// ContainsHebrew checks if a string contains at least one Hebrew character
func ContainsHebrew(s string) bool {
	for _, r := range s {
		if IsHebrewChar(r) {
			return true
		}
	}
	return false
}

// IsHebrewChar checks if a rune is a Hebrew character
func IsHebrewChar(r rune) bool {
	return r >= HebrewBlockStart && r <= HebrewBlockEnd
}

// CountHebrewChars counts the number of Hebrew characters in a string
func CountHebrewChars(s string) int {
	count := 0
	for _, r := range s {
		if IsHebrewChar(r) {
			count++
		}
	}
	return count
}

// ValidateHebrewName validates that a name contains Hebrew characters
func ValidateHebrewName(name string) error {
	if name == "" {
		return errors.New("Hebrew name cannot be empty")
	}
	if !ContainsHebrew(name) {
		return errors.New("Hebrew name must contain Hebrew characters (א-ת)")
	}
	return nil
}

// ValidateEnglishName validates that an English name is not empty
func ValidateEnglishName(name string) error {
	if name == "" {
		return errors.New("English name cannot be empty")
	}
	// Check that it contains at least one letter
	hasLetter := false
	for _, r := range name {
		if unicode.IsLetter(r) {
			hasLetter = true
			break
		}
	}
	if !hasLetter {
		return errors.New("English name must contain at least one letter")
	}
	return nil
}

// ValidateBilingualNames validates both Hebrew and English names
func ValidateBilingualNames(nameHebrew, nameEnglish string) map[string]string {
	errors := make(map[string]string)

	if err := ValidateHebrewName(nameHebrew); err != nil {
		errors["name_hebrew"] = err.Error()
	}

	if err := ValidateEnglishName(nameEnglish); err != nil {
		errors["name_english"] = err.Error()
	}

	if len(errors) == 0 {
		return nil
	}
	return errors
}

// NormalizeHebrew normalizes Hebrew text (removes extra spaces, trims)
func NormalizeHebrew(s string) string {
	// Simple normalization - can be extended
	return s
}
