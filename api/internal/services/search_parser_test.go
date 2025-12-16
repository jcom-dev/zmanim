package services

import (
	"testing"
)

func TestParseSearchQuery(t *testing.T) {
	tests := []struct {
		name        string
		query       string
		wantCity    string
		wantContext string
		wantSingle  bool
	}{
		{
			name:        "empty query",
			query:       "",
			wantCity:    "",
			wantContext: "",
			wantSingle:  true,
		},
		{
			name:        "single word",
			query:       "London",
			wantCity:    "london",
			wantContext: "",
			wantSingle:  true,
		},
		{
			name:        "two words - city and country",
			query:       "London England",
			wantCity:    "london",
			wantContext: "england",
			wantSingle:  false,
		},
		{
			name:        "two words - city and region",
			query:       "London Ontario",
			wantCity:    "london",
			wantContext: "ontario",
			wantSingle:  false,
		},
		{
			name:        "multi-word city - New York",
			query:       "New York",
			wantCity:    "new york",
			wantContext: "",
			wantSingle:  true,
		},
		{
			name:        "multi-word city with context - New York USA",
			query:       "New York USA",
			wantCity:    "new york",
			wantContext: "usa",
			wantSingle:  false,
		},
		{
			name:        "multi-word city - Los Angeles",
			query:       "Los Angeles",
			wantCity:    "los angeles",
			wantContext: "",
			wantSingle:  true,
		},
		{
			name:        "multi-word city with context - Los Angeles California",
			query:       "Los Angeles California",
			wantCity:    "los angeles",
			wantContext: "california",
			wantSingle:  false,
		},
		{
			name:        "three word city - Salt Lake City",
			query:       "Salt Lake City",
			wantCity:    "salt lake city",
			wantContext: "",
			wantSingle:  true,
		},
		{
			name:        "three word city with context - Salt Lake City USA",
			query:       "Salt Lake City USA",
			wantCity:    "salt lake city",
			wantContext: "usa",
			wantSingle:  false,
		},
		{
			name:        "city with multi-word context",
			query:       "Salford Manchester",
			wantCity:    "salford",
			wantContext: "manchester",
			wantSingle:  false,
		},
		{
			name:        "case insensitive",
			query:       "LONDON ENGLAND",
			wantCity:    "london",
			wantContext: "england",
			wantSingle:  false,
		},
		{
			name:        "extra whitespace",
			query:       "  London   England  ",
			wantCity:    "london",
			wantContext: "england",
			wantSingle:  false,
		},
		{
			name:        "tel aviv",
			query:       "Tel Aviv",
			wantCity:    "tel aviv",
			wantContext: "",
			wantSingle:  true,
		},
		{
			name:        "tel aviv with context",
			query:       "Tel Aviv Israel",
			wantCity:    "tel aviv",
			wantContext: "israel",
			wantSingle:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ParseSearchQuery(tt.query)

			if result.CityTerm != tt.wantCity {
				t.Errorf("CityTerm = %q, want %q", result.CityTerm, tt.wantCity)
			}
			if result.ContextTerm != tt.wantContext {
				t.Errorf("ContextTerm = %q, want %q", result.ContextTerm, tt.wantContext)
			}
			if result.IsSingleWord != tt.wantSingle {
				t.Errorf("IsSingleWord = %v, want %v", result.IsSingleWord, tt.wantSingle)
			}
		})
	}
}

func TestMultiWordCities(t *testing.T) {
	// Test that all multi-word cities are handled correctly
	cities := []struct {
		name  string
		parts int // number of words in city name
	}{
		{"new york", 2},
		{"los angeles", 2},
		{"san francisco", 2},
		{"san diego", 2},
		{"san jose", 2},
		{"las vegas", 2},
		{"new orleans", 2},
		{"salt lake city", 3},
		{"kansas city", 2},
		{"saint louis", 2},
		{"st louis", 2},
		{"tel aviv", 2},
		{"buenos aires", 2},
		{"rio de janeiro", 3},
		{"sao paulo", 2},
		{"cape town", 2},
		{"hong kong", 2},
		{"kuala lumpur", 2},
	}

	for _, city := range cities {
		t.Run(city.name, func(t *testing.T) {
			// Test city name alone
			result := ParseSearchQuery(city.name)
			if result.CityTerm != city.name {
				t.Errorf("City %q not recognized as multi-word. Got city=%q, want=%q",
					city.name, result.CityTerm, city.name)
			}
			if !result.IsSingleWord {
				t.Errorf("City %q should be treated as single entity", city.name)
			}

			// Test city name with context
			queryWithContext := city.name + " USA"
			result = ParseSearchQuery(queryWithContext)
			if result.CityTerm != city.name {
				t.Errorf("City %q with context not recognized. Got city=%q, want=%q",
					city.name, result.CityTerm, city.name)
			}
			if result.ContextTerm != "usa" {
				t.Errorf("Context not extracted correctly. Got=%q, want=usa", result.ContextTerm)
			}
			if result.IsSingleWord {
				t.Errorf("Query %q should not be single word", queryWithContext)
			}
		})
	}
}
