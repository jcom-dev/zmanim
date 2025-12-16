// File: utils.go
// Purpose: ID conversion helpers (int32 ↔ string, validation)
// Pattern: utility
// Dependencies: Used by all handlers for type safety
// Frequency: critical
// Compliance: Check docs/adr/ for pattern rationale

package handlers

import "strconv"

// Helper functions to convert between int32 and string IDs
func int32ToString(i int32) string {
	return strconv.FormatInt(int64(i), 10)
}

func stringToInt32(s string) (int32, error) {
	i, err := strconv.ParseInt(s, 10, 32)
	return int32(i), err
}

// Alias for consistency with other handlers
func stringFromInt32(i int32) string {
	return int32ToString(i)
}

// Helper to create int32 pointer
func int32Ptr(i int32) *int32 {
	return &i
}

// Helper to create bool pointer
func boolPtr(b bool) *bool {
	return &b
}

// Helper to create string pointer
func stringPtr(s string) *string {
	return &s
}

// Helper to get string from string pointer
func stringFromStringPtr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// Helper functions for calendar.go conversions
func intToString(i int32) string {
	return strconv.FormatInt(int64(i), 10)
}

func stringPtrToString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func int32PtrToInt(i *int32) int {
	if i == nil {
		return 0
	}
	return int(*i)
}

// Helper to get string from *string
func stringFromPtr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// Helper to get bool from *bool
func boolFromPtr(b *bool) bool {
	if b == nil {
		return false
	}
	return *b
}

// Helper to create *string if not empty
func stringPtrIfNotEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// countryKeywords maps common country names to ISO 3166-1 alpha-2 codes
// Used for smart country context detection in search queries
// Example: "london england" → extracts "england" → "GB"
var countryKeywords = map[string]string{
	"england": "GB", "uk": "GB", "britain": "GB", "united kingdom": "GB",
	"usa": "US", "us": "US", "united states": "US", "america": "US",
	"france": "FR", "germany": "DE", "spain": "ES", "italy": "IT",
	"israel": "IL", "canada": "CA", "australia": "AU", "japan": "JP",
	"china": "CN", "india": "IN", "brazil": "BR", "mexico": "MX",
	"netherlands": "NL", "belgium": "BE", "switzerland": "CH",
	"austria": "AT", "poland": "PL", "russia": "RU", "ukraine": "UA",
	"south africa": "ZA", "argentina": "AR", "chile": "CL",
}

// getCountryKeywords returns the shared country keyword map
func getCountryKeywords() map[string]string {
	return countryKeywords
}
