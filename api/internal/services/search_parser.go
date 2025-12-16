// File: search_parser.go
// Purpose: Intelligent locality search query parsing with context extraction
// Pattern: utility
// Dependencies: db/sqlcgen for context matching
// Frequency: high - every locality search
//
// This parser handles complex multi-word queries like "London England" or
// "New York USA" by splitting them into city and context terms. It knows
// about special multi-word city names (New York, Los Angeles, Tel Aviv, etc.)
// that should stay together.
//
// # Query Parsing Strategy
//
//   - Single word: Search by population rank
//   - Multi-word known city: "New York USA" → city="new york", context="usa"
//   - Multi-word generic: "London England" → city="london", context="england"
//
// # Context Matching
//
// Context terms are resolved to country/region IDs using the geo_search_index
// table, which includes aliases like "UK" → Great Britain, "England" → GB.

package services

import (
	"context"
	"strings"

	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// ParsedQuery represents a parsed search query with city and context terms.
// IsSingleWord indicates whether the query should use population-based ranking.
type ParsedQuery struct {
	CityTerm     string
	ContextTerm  string
	IsSingleWord bool
}

// ContextMatches represents geographic context matches for filtering
type ContextMatches struct {
	CountryIDs []int16 // SMALLINT in database (geo_countries.id)
	RegionIDs  []int32 // INTEGER in database (geo_regions.id)
}

// MultiWordCities are city names that should stay together during parsing
var multiWordCities = map[string]bool{
	"new york":       true,
	"los angeles":    true,
	"san francisco":  true,
	"san diego":      true,
	"san jose":       true,
	"las vegas":      true,
	"new orleans":    true,
	"salt lake city": true,
	"kansas city":    true,
	"saint louis":    true,
	"st louis":       true,
	"saint paul":     true,
	"st paul":        true,
	"new delhi":      true,
	"tel aviv":       true,
	"buenos aires":   true,
	"rio de janeiro": true,
	"sao paulo":      true,
	"cape town":      true,
	"hong kong":      true,
	"kuala lumpur":   true,
}

// ParseSearchQuery parses a search query into city and context terms
// Single word: IsSingleWord=true, search by population
// Multi-word: Split into city + context
// Handle special cases: "New York" stays together
func ParseSearchQuery(query string) *ParsedQuery {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return &ParsedQuery{IsSingleWord: true}
	}

	lower := strings.ToLower(trimmed)
	terms := strings.Fields(lower)

	// Single word query
	if len(terms) == 1 {
		return &ParsedQuery{
			CityTerm:     terms[0],
			IsSingleWord: true,
		}
	}

	// Check for multi-word cities (e.g., "New York")
	// Try 3-word combinations first, then 2-word
	if len(terms) >= 3 {
		threeWord := strings.Join(terms[:3], " ")
		if multiWordCities[threeWord] {
			// "New York USA" → city="new york", context="usa"
			if len(terms) > 3 {
				return &ParsedQuery{
					CityTerm:     threeWord,
					ContextTerm:  strings.Join(terms[3:], " "),
					IsSingleWord: false,
				}
			}
			// "New York City" with no context
			return &ParsedQuery{
				CityTerm:     threeWord,
				IsSingleWord: true,
			}
		}
	}

	if len(terms) >= 2 {
		twoWord := strings.Join(terms[:2], " ")
		if multiWordCities[twoWord] {
			// "New York USA" → city="new york", context="usa"
			if len(terms) > 2 {
				return &ParsedQuery{
					CityTerm:     twoWord,
					ContextTerm:  strings.Join(terms[2:], " "),
					IsSingleWord: false,
				}
			}
			// "New York" with no context
			return &ParsedQuery{
				CityTerm:     twoWord,
				IsSingleWord: true,
			}
		}
	}

	// Standard multi-word: first word is city, rest is context
	// "London England" → city="london", context="england"
	return &ParsedQuery{
		CityTerm:     terms[0],
		ContextTerm:  strings.Join(terms[1:], " "),
		IsSingleWord: false,
	}
}

// FindContextMatches looks up country/region IDs by name or alias
// Supports: "England" → GB, "UK" → GB, "USA" → US, "Ontario" → region
func FindContextMatches(ctx context.Context, queries *sqlcgen.Queries, term string) (*ContextMatches, error) {
	if term == "" {
		return &ContextMatches{}, nil
	}

	result := &ContextMatches{
		CountryIDs: []int16{},
		RegionIDs:  []int32{},
	}

	lower := strings.ToLower(strings.TrimSpace(term))

	// Try exact country/region name/alias match in geo_search_index
	// This catches: "england", "uk", "united kingdom", "usa", "us", "california", etc.
	// Uses the context-only query that only returns country/region entries
	contextMatches, err := queries.SearchGeoIndexExactContextOnly(ctx, sqlcgen.SearchGeoIndexExactContextOnlyParams{
		Lower: lower,
		Limit: 50, // Get all exact matches
	})
	if err != nil {
		return nil, err
	}

	// Extract unique country and region IDs
	seenCountries := make(map[int16]bool)
	seenRegions := make(map[int32]bool)

	for _, match := range contextMatches {
		// If it's a country entity, add the country_id
		if match.EntityType == "country" && match.CountryID != nil {
			if !seenCountries[*match.CountryID] {
				result.CountryIDs = append(result.CountryIDs, *match.CountryID)
				seenCountries[*match.CountryID] = true
			}
		}
		// If it's a region entity, add the inherited_region_id (which is the region itself for region entities)
		if match.EntityType == "region" && match.InheritedRegionID != nil {
			if !seenRegions[*match.InheritedRegionID] {
				result.RegionIDs = append(result.RegionIDs, *match.InheritedRegionID)
				seenRegions[*match.InheritedRegionID] = true
			}
		}
	}

	return result, nil
}
