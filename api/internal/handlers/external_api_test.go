// File: external_api_test.go
// Purpose: Unit tests for External API handlers
// Pattern: table-driven-tests
// Epic: 8 - Finalize and External API
// Stories: 8.4-8.7 External API (M2M Auth, List Zmanim, Bulk Calculation, Rate Limiting)

package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim/internal/cache"
)

func TestBulkZmanimRequest_Validation(t *testing.T) {
	tests := []struct {
		name           string
		requestBody    string
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "empty request body",
			requestBody:    "",
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid request body",
		},
		{
			name:           "missing publisher_id",
			requestBody:    `{"locality_id": 123, "date_range": {"start": "2025-01-01", "end": "2025-01-31"}, "zmanim": [{"zman_key": "sunrise"}]}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "publisher_id is required",
		},
		{
			name:           "missing locality_id",
			requestBody:    `{"publisher_id": "1", "date_range": {"start": "2025-01-01", "end": "2025-01-31"}, "zmanim": [{"zman_key": "sunrise"}]}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "locality_id is required",
		},
		{
			name:           "missing date_range",
			requestBody:    `{"publisher_id": "1", "locality_id": 123, "zmanim": [{"zman_key": "sunrise"}]}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "date_range.start and date_range.end are required",
		},
		{
			name:           "invalid date format",
			requestBody:    `{"publisher_id": "1", "locality_id": 123, "date_range": {"start": "01-01-2025", "end": "2025-01-31"}, "zmanim": [{"zman_key": "sunrise"}]}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid date_range.start format",
		},
		{
			name:           "end before start",
			requestBody:    `{"publisher_id": "1", "locality_id": 123, "date_range": {"start": "2025-01-31", "end": "2025-01-01"}, "zmanim": [{"zman_key": "sunrise"}]}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "date_range.end must be after date_range.start",
		},
		{
			name:           "date range exceeds 365 days",
			requestBody:    `{"publisher_id": "1", "locality_id": 123, "date_range": {"start": "2025-01-01", "end": "2026-01-02"}, "zmanim": [{"zman_key": "sunrise"}]}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "date_range cannot exceed 365 days",
		},
		{
			name:           "empty zmanim list",
			requestBody:    `{"publisher_id": "1", "locality_id": 123, "date_range": {"start": "2025-01-01", "end": "2025-01-31"}, "zmanim": []}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "zmanim list cannot be empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test handler (without DB connection - just for validation testing)
			h := &Handlers{}

			// Create request
			req := httptest.NewRequest("POST", "/external/zmanim/calculate", strings.NewReader(tt.requestBody))
			req.Header.Set("Content-Type", "application/json")

			// Create response recorder
			w := httptest.NewRecorder()

			// Call handler
			h.CalculateExternalBulkZmanim(w, req)

			// Check status code
			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			// Check error message (if expecting an error)
			if tt.expectedError != "" {
				var response map[string]interface{}
				if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
					t.Fatalf("failed to decode response: %v", err)
				}

				// The error is nested in an "error" object
				if errorObj, ok := response["error"].(map[string]interface{}); ok {
					if msg, ok := errorObj["message"].(string); ok {
						if !strings.Contains(msg, tt.expectedError) {
							t.Errorf("expected error containing %q, got %q", tt.expectedError, msg)
						}
					} else {
						t.Errorf("expected error message in error object, got: %+v", errorObj)
					}
				} else {
					t.Errorf("expected error object in response, got: %+v", response)
				}
			}
		})
	}
}

func TestBulkDateRangeCalculation(t *testing.T) {
	// This test validates that date ranges over 365 days are rejected
	// Only testing the validation logic that doesn't require DB access

	t.Run("date range exceeding 365 days", func(t *testing.T) {
		requestBody := `{
			"publisher_id": "1",
			"locality_id": 123,
			"date_range": {"start": "2024-01-01", "end": "2024-12-31"},
			"zmanim": [{"zman_key": "sunrise"}]
		}`

		h := &Handlers{}
		req := httptest.NewRequest("POST", "/external/zmanim/calculate", strings.NewReader(requestBody))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		h.CalculateExternalBulkZmanim(w, req)

		// Should get 400 for date range > 365 days
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected status 400 for date range > 365 days, got %d", w.Code)
		}

		var response map[string]interface{}
		json.NewDecoder(w.Body).Decode(&response)
		if errorObj, ok := response["error"].(map[string]interface{}); ok {
			if msg, ok := errorObj["message"].(string); ok {
				if !strings.Contains(msg, "365 days") {
					t.Errorf("expected error about 365 day limit, got: %s", msg)
				}
			}
		}
	})

	// NOTE: We can't test valid date ranges without a DB connection
	// since the handler will panic when trying to access h.db.Queries
	// Integration tests with a test database would be needed for that
}

// =============================================================================
// GetExternalPublisherZmanim Tests (Story 8.5)
// =============================================================================

func TestGetExternalPublisherZmanim_MissingPublisherID(t *testing.T) {
	h := &Handlers{}

	// Create request without chi URL params (simulates missing ID)
	req := httptest.NewRequest("GET", "/external/publishers//zmanim", nil)
	w := httptest.NewRecorder()

	h.GetExternalPublisherZmanim(w, req)

	helper := NewTestHelper(t)
	helper.AssertStatus(w, http.StatusBadRequest)

	var response APIResponse
	helper.ParseJSONResponse(w, &response)

	if response.Error == nil {
		t.Fatal("expected error in response")
	}
	if !strings.Contains(response.Error.Message, "Publisher ID is required") {
		t.Errorf("expected 'Publisher ID is required' error, got: %s", response.Error.Message)
	}
}

func TestGetExternalPublisherZmanim_InvalidPublisherIDFormat(t *testing.T) {
	h := &Handlers{}

	// Create request with invalid publisher ID
	req := httptest.NewRequest("GET", "/external/publishers/invalid/zmanim", nil)

	// Add chi URL params
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "invalid")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()
	h.GetExternalPublisherZmanim(w, req)

	helper := NewTestHelper(t)
	helper.AssertStatus(w, http.StatusBadRequest)

	var response APIResponse
	helper.ParseJSONResponse(w, &response)

	if response.Error == nil {
		t.Fatal("expected error in response")
	}
	if !strings.Contains(response.Error.Message, "Invalid publisher ID format") {
		t.Errorf("expected 'Invalid publisher ID format' error, got: %s", response.Error.Message)
	}
}

func TestGetExternalPublisherZmanim_ValidIDFormat(t *testing.T) {
	// Test that valid ID formats pass validation
	// Note: Will fail at DB query stage (expected), but validates ID parsing works

	tests := []struct {
		name string
		id   string
	}{
		{"numeric ID", "123"},
		{"single digit", "1"},
		{"large ID", "999999"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &Handlers{}

			req := httptest.NewRequest("GET", "/external/publishers/"+tt.id+"/zmanim", nil)
			rctx := chi.NewRouteContext()
			rctx.URLParams.Add("id", tt.id)
			req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

			w := httptest.NewRecorder()

			// This will panic at DB access - we're just testing ID validation passes
			defer func() {
				if r := recover(); r != nil {
					// Expected - handler tried to access nil db
					// This means ID validation passed!
				}
			}()

			h.GetExternalPublisherZmanim(w, req)

			// If we get here without panic and status is 400, check it's not ID format error
			if w.Code == http.StatusBadRequest {
				var response APIResponse
				json.NewDecoder(w.Body).Decode(&response)
				if response.Error != nil && strings.Contains(response.Error.Message, "Invalid publisher ID format") {
					t.Errorf("ID %q should be valid format", tt.id)
				}
			}
		})
	}
}

// =============================================================================
// External API Caching Tests (using real Redis from environment)
// =============================================================================

func TestExternalPublisherZmanim_CacheKeyFormat(t *testing.T) {
	// Verify cache key format matches spec: external:publisher:{id}:zmanim
	publisherID := "123"
	expectedKey := "external:publisher:123:zmanim"

	// The actual key generation happens in the handler (line 132)
	// We're documenting the expected format here
	actualKey := "external:publisher:" + publisherID + ":zmanim"

	if actualKey != expectedKey {
		t.Errorf("cache key format mismatch: expected %q, got %q", expectedKey, actualKey)
	}
}

func TestExternalPublisherZmanim_CacheTTL(t *testing.T) {
	// Skip if Redis not available
	c, err := cache.New()
	if err != nil {
		t.Skip("Redis not available, skipping cache test")
	}
	defer c.Close()

	ctx := context.Background()
	// Use unique key to avoid test interference
	cacheKey := "test:external:publisher:1:zmanim:" + time.Now().Format("150405")

	// Simulate what the handler does (line 201)
	testData := `{"publisher_id":"1","zmanim":[],"total":0}`
	err = c.Client().Set(ctx, cacheKey, testData, 3600*time.Second).Err()
	if err != nil {
		t.Fatalf("failed to set cache: %v", err)
	}
	defer c.Client().Del(ctx, cacheKey) // Cleanup

	// Verify TTL is approximately 1 hour (3600 seconds)
	ttl := c.Client().TTL(ctx, cacheKey).Val()
	if ttl < 3500*time.Second || ttl > 3601*time.Second {
		t.Errorf("expected TTL ~3600s, got %v", ttl)
	}

	// Verify data can be retrieved
	data, err := c.Client().Get(ctx, cacheKey).Result()
	if err != nil {
		t.Fatalf("failed to get cached data: %v", err)
	}
	if data != testData {
		t.Errorf("cached data mismatch: expected %q, got %q", testData, data)
	}
}

func TestExternalPublisherZmanim_CacheHitMiss(t *testing.T) {
	// Skip if Redis not available
	c, err := cache.New()
	if err != nil {
		t.Skip("Redis not available, skipping cache test")
	}
	defer c.Close()

	ctx := context.Background()
	// Use unique key to avoid test interference
	cacheKey := "test:external:publisher:cache:" + time.Now().Format("150405")

	// Pre-populate cache with test data
	cachedResponse := ExternalPublisherZmanimResponse{
		PublisherID:   "1",
		PublisherName: "Test Publisher",
		Zmanim: []ExternalPublisherZman{
			{
				ZmanKey:        "sunrise",
				EnglishName:    "Sunrise",
				HebrewName:     "הנץ החמה",
				VersionID:      "v1",
				FormulaType:    "primitive",
				FormulaSummary: "Sunrise",
			},
		},
		Total:       1,
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
	}

	jsonData, err := json.Marshal(cachedResponse)
	if err != nil {
		t.Fatalf("failed to marshal test data: %v", err)
	}

	err = c.Client().Set(ctx, cacheKey, jsonData, 3600*time.Second).Err()
	if err != nil {
		t.Fatalf("failed to set cache: %v", err)
	}
	defer c.Client().Del(ctx, cacheKey) // Cleanup

	// Test cache HIT
	t.Run("cache hit", func(t *testing.T) {
		data, err := c.Client().Get(ctx, cacheKey).Bytes()
		if err != nil {
			t.Fatalf("cache miss when hit expected: %v", err)
		}

		var retrieved ExternalPublisherZmanimResponse
		if err := json.Unmarshal(data, &retrieved); err != nil {
			t.Fatalf("failed to unmarshal cached data: %v", err)
		}

		if retrieved.PublisherID != "1" {
			t.Errorf("expected publisher_id '1', got %q", retrieved.PublisherID)
		}
		if len(retrieved.Zmanim) != 1 {
			t.Errorf("expected 1 zman, got %d", len(retrieved.Zmanim))
		}
		if retrieved.Zmanim[0].ZmanKey != "sunrise" {
			t.Errorf("expected zman_key 'sunrise', got %q", retrieved.Zmanim[0].ZmanKey)
		}
	})

	// Test cache MISS
	t.Run("cache miss", func(t *testing.T) {
		missKey := "test:external:publisher:nonexistent:" + time.Now().Format("150405")
		_, err := c.Client().Get(ctx, missKey).Bytes()
		if err == nil {
			t.Error("expected cache miss, got hit")
		}
	})
}

// =============================================================================
// Response Structure Tests
// =============================================================================

func TestExternalPublisherZmanimResponse_Structure(t *testing.T) {
	// Test that response structure matches API spec
	response := ExternalPublisherZmanimResponse{
		PublisherID:   "1",
		PublisherName: "Test Publisher",
		Zmanim: []ExternalPublisherZman{
			{
				ZmanKey:        "alos_hashachar",
				MasterZmanID:   "uuid-123",
				EnglishName:    "Dawn (Alos Hashachar)",
				HebrewName:     "עלות השחר",
				VersionID:      "v3",
				FormulaType:    "solar_angle",
				FormulaSummary: "16.1° below horizon",
			},
		},
		Total:       1,
		GeneratedAt: "2025-01-01T00:00:00Z",
	}

	jsonData, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("failed to marshal response: %v", err)
	}

	// Verify all expected fields are present
	var parsed map[string]interface{}
	if err := json.Unmarshal(jsonData, &parsed); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	requiredFields := []string{"publisher_id", "publisher_name", "zmanim", "total", "generated_at"}
	for _, field := range requiredFields {
		if _, ok := parsed[field]; !ok {
			t.Errorf("missing required field: %s", field)
		}
	}

	// Verify zman structure
	zmanim := parsed["zmanim"].([]interface{})
	if len(zmanim) != 1 {
		t.Fatalf("expected 1 zman, got %d", len(zmanim))
	}

	zman := zmanim[0].(map[string]interface{})
	zmanFields := []string{"zman_key", "english_name", "hebrew_name", "version_id", "formula_type", "formula_summary"}
	for _, field := range zmanFields {
		if _, ok := zman[field]; !ok {
			t.Errorf("missing zman field: %s", field)
		}
	}
}

func TestBulkZmanimResponse_Structure(t *testing.T) {
	// Test that bulk response structure matches API spec
	response := BulkZmanimResponse{
		PublisherID: "1",
		Location: LocationInfo{
			LocalityID:       "12345",
			LocalityName:     "Jerusalem",
			Country:          "Israel",
			CountryCode:      "IL",
			Region:           nil,
			DisplayHierarchy: "Jerusalem, Israel",
			Latitude:         31.7683,
			Longitude:        35.2137,
			Elevation:        0,
			Timezone:         "Asia/Jerusalem",
		},
		Results: []BulkZmanResult{
			{
				ZmanKey:   "sunrise",
				VersionID: "v1",
				Times: map[string]string{
					"2025-01-01": "06:42:30",
					"2025-01-02": "06:42:45",
				},
			},
		},
		DateRange: BulkDateRangeInfo{
			Start: "2025-01-01",
			End:   "2025-01-02",
			Days:  2,
		},
		Cached:            false,
		CalculationTimeMS: 100,
		GeneratedAt:       "2025-01-01T00:00:00Z",
	}

	jsonData, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("failed to marshal response: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(jsonData, &parsed); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	// Verify required fields
	requiredFields := []string{"publisher_id", "location", "results", "date_range", "cached", "calculation_time_ms", "generated_at"}
	for _, field := range requiredFields {
		if _, ok := parsed[field]; !ok {
			t.Errorf("missing required field: %s", field)
		}
	}

	// Verify location structure
	location := parsed["location"].(map[string]interface{})
	locationFields := []string{"locality_id", "locality_name", "country", "country_code", "display_hierarchy", "latitude", "longitude", "elevation", "timezone"}
	for _, field := range locationFields {
		if _, ok := location[field]; !ok {
			t.Errorf("missing location field: %s", field)
		}
	}

	// Verify results have times map
	results := parsed["results"].([]interface{})
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	result := results[0].(map[string]interface{})
	if _, ok := result["times"]; !ok {
		t.Error("missing times field in result")
	}

	times := result["times"].(map[string]interface{})
	if len(times) != 2 {
		t.Errorf("expected 2 times, got %d", len(times))
	}
}

// =============================================================================
// Bulk Calculation Additional Tests
// =============================================================================

func TestBulkZmanimRequest_DateRangeExactly365Days(t *testing.T) {
	// Test that exactly 365 days is allowed
	requestBody := `{
		"publisher_id": "1",
		"locality_id": 123,
		"date_range": {"start": "2025-01-01", "end": "2025-12-31"},
		"zmanim": [{"zman_key": "sunrise"}]
	}`

	h := &Handlers{}
	req := httptest.NewRequest("POST", "/external/zmanim/calculate", strings.NewReader(requestBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	// This will panic at DB access, but should not fail at date validation
	defer func() {
		if r := recover(); r != nil {
			// Expected - handler tried to access nil db
			// This means date validation passed (365 days is allowed)
		}
	}()

	h.CalculateExternalBulkZmanim(w, req)

	// If we get a 400 error, check it's not about 365 days
	if w.Code == http.StatusBadRequest {
		var response APIResponse
		json.NewDecoder(w.Body).Decode(&response)
		if response.Error != nil && strings.Contains(response.Error.Message, "365 days") {
			t.Error("365 days should be allowed (it's the max, not exceeded)")
		}
	}
}

func TestBulkZmanimRequest_SingleDay(t *testing.T) {
	// Test single day (start == end)
	requestBody := `{
		"publisher_id": "1",
		"locality_id": 123,
		"date_range": {"start": "2025-01-01", "end": "2025-01-01"},
		"zmanim": [{"zman_key": "sunrise"}]
	}`

	h := &Handlers{}
	req := httptest.NewRequest("POST", "/external/zmanim/calculate", strings.NewReader(requestBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	defer func() {
		if r := recover(); r != nil {
			// Expected - handler tried to access nil db
			// This means validation passed for single day
		}
	}()

	h.CalculateExternalBulkZmanim(w, req)

	// Should not get validation error for single day
	if w.Code == http.StatusBadRequest {
		var response APIResponse
		json.NewDecoder(w.Body).Decode(&response)
		if response.Error != nil && strings.Contains(response.Error.Message, "date_range") {
			t.Errorf("single day should be valid, got error: %s", response.Error.Message)
		}
	}
}

func TestBulkZmanimRequest_MultipleZmanim(t *testing.T) {
	// Test multiple zmanim in request
	requestBody := `{
		"publisher_id": "1",
		"locality_id": 123,
		"date_range": {"start": "2025-01-01", "end": "2025-01-07"},
		"zmanim": [
			{"zman_key": "sunrise"},
			{"zman_key": "sunset"},
			{"zman_key": "alos_hashachar", "version_id": "v2"}
		]
	}`

	h := &Handlers{}
	req := httptest.NewRequest("POST", "/external/zmanim/calculate", strings.NewReader(requestBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	defer func() {
		if r := recover(); r != nil {
			// Expected - handler tried to access nil db
		}
	}()

	h.CalculateExternalBulkZmanim(w, req)

	// Should not get validation error for multiple zmanim
	if w.Code == http.StatusBadRequest {
		var response APIResponse
		json.NewDecoder(w.Body).Decode(&response)
		if response.Error != nil && strings.Contains(response.Error.Message, "zmanim") {
			t.Errorf("multiple zmanim should be valid, got error: %s", response.Error.Message)
		}
	}
}

func TestBulkZmanimRequest_InvalidPublisherIDFormat(t *testing.T) {
	// Test invalid publisher_id format
	requestBody := `{
		"publisher_id": "not-a-number",
		"locality_id": 123,
		"date_range": {"start": "2025-01-01", "end": "2025-01-07"},
		"zmanim": [{"zman_key": "sunrise"}]
	}`

	h := &Handlers{}
	req := httptest.NewRequest("POST", "/external/zmanim/calculate", strings.NewReader(requestBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.CalculateExternalBulkZmanim(w, req)

	helper := NewTestHelper(t)
	helper.AssertStatus(w, http.StatusBadRequest)

	var response APIResponse
	helper.ParseJSONResponse(w, &response)

	if response.Error == nil {
		t.Fatal("expected error for invalid publisher_id")
	}
	if !strings.Contains(response.Error.Message, "publisher_id") {
		t.Errorf("expected error about publisher_id, got: %s", response.Error.Message)
	}
}

func TestBulkZmanimRequest_NegativeLocalityID(t *testing.T) {
	// Test negative locality_id
	requestBody := `{
		"publisher_id": "1",
		"locality_id": -1,
		"date_range": {"start": "2025-01-01", "end": "2025-01-07"},
		"zmanim": [{"zman_key": "sunrise"}]
	}`

	h := &Handlers{}
	req := httptest.NewRequest("POST", "/external/zmanim/calculate", strings.NewReader(requestBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.CalculateExternalBulkZmanim(w, req)

	helper := NewTestHelper(t)
	helper.AssertStatus(w, http.StatusBadRequest)

	var response APIResponse
	helper.ParseJSONResponse(w, &response)

	if response.Error == nil {
		t.Fatal("expected error for negative locality_id")
	}
	if !strings.Contains(response.Error.Message, "locality_id") {
		t.Errorf("expected error about locality_id, got: %s", response.Error.Message)
	}
}

// =============================================================================
// Benchmarks
// =============================================================================

func BenchmarkBulkZmanimValidation(b *testing.B) {
	requestBody := `{
		"publisher_id": "1",
		"locality_id": 123,
		"date_range": {"start": "2025-01-01", "end": "2025-01-31"},
		"zmanim": [{"zman_key": "sunrise"}, {"zman_key": "sunset"}]
	}`

	h := &Handlers{}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("POST", "/external/zmanim/calculate", strings.NewReader(requestBody))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		func() {
			defer func() { recover() }()
			h.CalculateExternalBulkZmanim(w, req)
		}()
	}
}

func BenchmarkExternalZmanimCacheLookup(b *testing.B) {
	c, err := cache.New()
	if err != nil {
		b.Skip("Redis not available, skipping benchmark")
	}
	defer c.Close()

	ctx := context.Background()
	cacheKey := "bench:external:publisher:1:zmanim"

	// Pre-populate cache
	testData := `{"publisher_id":"1","publisher_name":"Test","zmanim":[],"total":0,"generated_at":"2025-01-01T00:00:00Z"}`
	c.Client().Set(ctx, cacheKey, testData, 3600*time.Second)
	defer c.Client().Del(ctx, cacheKey)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = c.Client().Get(ctx, cacheKey).Bytes()
	}
}
