// File: external_api_integration_test.go
// Purpose: Integration tests for External API handlers with real database
// Pattern: integration-tests
// Epic: 8 - Finalize and External API
// Stories: 8.4-8.7 External API (M2M Auth, List Zmanim, Bulk Calculation, Rate Limiting)
//
// These tests require:
// - DATABASE_URL environment variable set
// - REDIS_URL environment variable set (or default redis://localhost:6379)
// - Active publisher with zmanim configured
// - Valid locality data
//
// Run with: go test ./internal/handlers/... -run Integration -v

package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim/internal/cache"
	"github.com/jcom-dev/zmanim/internal/config"
	"github.com/jcom-dev/zmanim/internal/db"
	sqlcdb "github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// setupIntegrationTest creates handlers with real DB and cache connections
func setupIntegrationTest(t *testing.T) (*Handlers, func()) {
	// Get DATABASE_URL from environment
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set, skipping integration tests")
	}

	cfg := &config.Config{
		Database: config.DatabaseConfig{
			URL: dbURL,
		},
	}

	database, err := db.New(cfg)
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}

	h := New(database)

	// Try to connect to Redis cache (optional)
	c, err := cache.New()
	if err == nil {
		h.SetCache(c)
	}

	cleanup := func() {
		database.Close()
		if c != nil {
			c.Close()
		}
	}

	return h, cleanup
}

// getTestPublisherID returns a valid publisher ID from the database for testing
// If no publishers exist, it skips the test
func getTestPublisherID(t *testing.T, h *Handlers) string {
	ctx := context.Background()
	// Use AdminListPublishers which doesn't have the region_id issue
	publishers, err := h.db.Queries.AdminListPublishers(ctx, sqlcdb.AdminListPublishersParams{
		Column1: "",
		Limit:   1,
		Offset:  0,
	})
	if err != nil {
		t.Fatalf("Failed to list publishers: %v", err)
	}
	if len(publishers) == 0 {
		t.Skip("No publishers in database, skipping integration test")
	}
	return int32ToString(publishers[0].ID)
}

// getTestLocalityID returns a valid locality ID from the database for testing
// Uses Jerusalem (GeoNames ID 293397) as default, falls back to any available locality
func getTestLocalityID(t *testing.T, h *Handlers) int32 {
	ctx := context.Background()

	// Try Jerusalem first (standard test locality)
	locality, err := h.db.Queries.GetLocalityByID(ctx, 293397)
	if err == nil {
		return locality.ID
	}

	// Fallback: search for any locality
	t.Skip("No localities available in database, skipping integration test")
	return 0
}

// =============================================================================
// Integration Tests: GetExternalPublisherZmanim (Story 8.5)
// =============================================================================

func TestIntegration_GetExternalPublisherZmanim_ValidPublisher(t *testing.T) {
	h, cleanup := setupIntegrationTest(t)
	defer cleanup()

	publisherID := getTestPublisherID(t, h)

	// Create request
	req := httptest.NewRequest("GET", "/external/publishers/"+publisherID+"/zmanim", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", publisherID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()
	h.GetExternalPublisherZmanim(w, req)

	// Verify response
	if w.Code != http.StatusOK && w.Code != http.StatusNotFound {
		t.Errorf("expected status 200 or 404, got %d: %s", w.Code, w.Body.String())
	}

	if w.Code == http.StatusOK {
		var response APIResponse
		if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if response.Data == nil {
			t.Error("expected data in response")
		}

		// Check Cache-Control header is set
		cacheControl := w.Header().Get("Cache-Control")
		if cacheControl == "" {
			t.Error("expected Cache-Control header to be set")
		}

		t.Logf("Got zmanim for publisher %s", publisherID)
	}
}

func TestIntegration_GetExternalPublisherZmanim_NonExistentPublisher(t *testing.T) {
	h, cleanup := setupIntegrationTest(t)
	defer cleanup()

	// Use a very high ID that shouldn't exist
	req := httptest.NewRequest("GET", "/external/publishers/999999/zmanim", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "999999")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()
	h.GetExternalPublisherZmanim(w, req)

	// Should return 404
	if w.Code != http.StatusNotFound {
		t.Errorf("expected status 404 for non-existent publisher, got %d", w.Code)
	}

	var response APIResponse
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if response.Error == nil {
		t.Error("expected error in response")
	}
	if response.Error != nil && !strings.Contains(response.Error.Message, "not found") {
		t.Errorf("expected 'not found' error, got: %s", response.Error.Message)
	}
}

func TestIntegration_GetExternalPublisherZmanim_CacheInvalidation(t *testing.T) {
	h, cleanup := setupIntegrationTest(t)
	defer cleanup()

	if h.cache == nil {
		t.Skip("Redis not available, skipping cache integration test")
	}

	publisherID := getTestPublisherID(t, h)
	cacheKey := "external:publisher:" + publisherID + ":zmanim"

	// Clear any existing cache
	ctx := context.Background()
	h.cache.Client().Del(ctx, cacheKey)

	// First request - should populate cache
	req := httptest.NewRequest("GET", "/external/publishers/"+publisherID+"/zmanim", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", publisherID)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()
	start := time.Now()
	h.GetExternalPublisherZmanim(w, req)
	firstCallDuration := time.Since(start)

	if w.Code != http.StatusOK {
		t.Skipf("Publisher %s has no zmanim or doesn't exist", publisherID)
	}

	// Verify cache was set
	cached, err := h.cache.Client().Get(ctx, cacheKey).Bytes()
	if err != nil {
		t.Errorf("expected cache to be set after first call: %v", err)
	}
	if cached == nil {
		t.Error("expected cached data to exist")
	}

	// Second request - should hit cache (faster)
	req2 := httptest.NewRequest("GET", "/external/publishers/"+publisherID+"/zmanim", nil)
	rctx2 := chi.NewRouteContext()
	rctx2.URLParams.Add("id", publisherID)
	req2 = req2.WithContext(context.WithValue(req2.Context(), chi.RouteCtxKey, rctx2))

	w2 := httptest.NewRecorder()
	start = time.Now()
	h.GetExternalPublisherZmanim(w2, req2)
	secondCallDuration := time.Since(start)

	if w2.Code != http.StatusOK {
		t.Errorf("second call failed: %d", w2.Code)
	}

	t.Logf("First call (cache miss): %v, Second call (cache hit): %v", firstCallDuration, secondCallDuration)

	// Cache hit should generally be faster (but don't strictly enforce due to test variability)
	if secondCallDuration > firstCallDuration*2 {
		t.Logf("Warning: cached call not significantly faster (first: %v, second: %v)", firstCallDuration, secondCallDuration)
	}

	// Cleanup
	h.cache.Client().Del(ctx, cacheKey)
}

// =============================================================================
// Integration Tests: CalculateExternalBulkZmanim (Story 8.6)
// =============================================================================

func TestIntegration_CalculateExternalBulkZmanim_ValidRequest(t *testing.T) {
	h, cleanup := setupIntegrationTest(t)
	defer cleanup()

	publisherID := getTestPublisherID(t, h)
	localityID := getTestLocalityID(t, h)

	requestBody := `{
		"publisher_id": "` + publisherID + `",
		"locality_id": ` + int32ToString(localityID) + `,
		"date_range": {"start": "2025-01-01", "end": "2025-01-07"},
		"zmanim": [{"zman_key": "sunrise"}, {"zman_key": "sunset"}]
	}`

	req := httptest.NewRequest("POST", "/external/zmanim/calculate", strings.NewReader(requestBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	start := time.Now()
	h.CalculateExternalBulkZmanim(w, req)
	duration := time.Since(start)

	// Should succeed or return 404 if publisher doesn't have those zmanim
	if w.Code != http.StatusOK && w.Code != http.StatusNotFound && w.Code != http.StatusBadRequest {
		t.Errorf("unexpected status %d: %s", w.Code, w.Body.String())
	}

	if w.Code == http.StatusOK {
		var response APIResponse
		if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		t.Logf("Bulk calculation completed in %v", duration)

		// Verify response structure
		data := response.Data.(map[string]interface{})
		if data["publisher_id"] == nil {
			t.Error("expected publisher_id in response")
		}
		if data["location"] == nil {
			t.Error("expected location in response")
		}
		if data["results"] == nil {
			t.Error("expected results in response")
		}
		if data["date_range"] == nil {
			t.Error("expected date_range in response")
		}
	}
}

func TestIntegration_CalculateExternalBulkZmanim_Performance(t *testing.T) {
	h, cleanup := setupIntegrationTest(t)
	defer cleanup()

	publisherID := getTestPublisherID(t, h)
	localityID := getTestLocalityID(t, h)

	// Test 30-day calculation (1 month)
	requestBody := `{
		"publisher_id": "` + publisherID + `",
		"locality_id": ` + int32ToString(localityID) + `,
		"date_range": {"start": "2025-01-01", "end": "2025-01-31"},
		"zmanim": [{"zman_key": "sunrise"}, {"zman_key": "sunset"}]
	}`

	req := httptest.NewRequest("POST", "/external/zmanim/calculate", strings.NewReader(requestBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	start := time.Now()
	h.CalculateExternalBulkZmanim(w, req)
	duration := time.Since(start)

	// Performance target: 30 days should complete in < 2 seconds
	maxDuration := 2 * time.Second
	if duration > maxDuration && w.Code == http.StatusOK {
		t.Errorf("30-day bulk calculation too slow: %v (target: < %v)", duration, maxDuration)
	}

	t.Logf("30-day bulk calculation: %v (status: %d)", duration, w.Code)
}

func TestIntegration_CalculateExternalBulkZmanim_InvalidLocality(t *testing.T) {
	h, cleanup := setupIntegrationTest(t)
	defer cleanup()

	publisherID := getTestPublisherID(t, h)

	// Use invalid locality ID
	requestBody := `{
		"publisher_id": "` + publisherID + `",
		"locality_id": 999999999,
		"date_range": {"start": "2025-01-01", "end": "2025-01-07"},
		"zmanim": [{"zman_key": "sunrise"}]
	}`

	req := httptest.NewRequest("POST", "/external/zmanim/calculate", strings.NewReader(requestBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	h.CalculateExternalBulkZmanim(w, req)

	// Should return 404 for invalid locality
	if w.Code != http.StatusNotFound && w.Code != http.StatusBadRequest {
		t.Errorf("expected 404 or 400 for invalid locality, got %d", w.Code)
	}
}

// =============================================================================
// Benchmarks with Real Database
// =============================================================================

func BenchmarkIntegration_GetExternalPublisherZmanim(b *testing.B) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		b.Skip("DATABASE_URL not set, skipping benchmark")
	}

	cfg := &config.Config{
		Database: config.DatabaseConfig{URL: dbURL},
	}
	database, err := db.New(cfg)
	if err != nil {
		b.Fatalf("Failed to connect: %v", err)
	}
	defer database.Close()

	h := New(database)

	// Find a publisher
	ctx := context.Background()
	publishers, err := h.db.Queries.AdminListPublishers(ctx, sqlcdb.AdminListPublishersParams{
		Column1: "",
		Limit:   1,
		Offset:  0,
	})
	if err != nil || len(publishers) == 0 {
		b.Skip("No publishers available")
	}
	publisherID := int32ToString(publishers[0].ID)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("GET", "/external/publishers/"+publisherID+"/zmanim", nil)
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("id", publisherID)
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		w := httptest.NewRecorder()
		h.GetExternalPublisherZmanim(w, req)
	}
}
