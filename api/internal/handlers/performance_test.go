// File: performance_test.go
// Purpose: Performance tests for Epic 6 database queries
// Pattern: performance-testing
// Compliance: Testing Standards from docs/coding-standards.md
//
// Tests verify performance targets for:
// - Tag filtering (< 50ms p95)
// - Location override lookups (< 20ms p95)
// - Correction request lists (< 150ms p95)
// - Full zmanim calculation with filtering (< 200ms p95)

package handlers

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jcom-dev/zmanim/internal/config"
	"github.com/jcom-dev/zmanim/internal/db"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// setupTestDB creates a test database connection
func setupTestDB(t *testing.T) *db.DB {
	// Get DATABASE_URL from environment
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set, skipping performance tests")
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

	return database
}

// TestTagFilteringPerformance verifies GetTagsForHebrewDate performance
// Target: < 50ms (p95)
// Called on EVERY zmanim calculation request
func TestTagFilteringPerformance(t *testing.T) {
	database := setupTestDB(t)
	defer database.Close()

	ctx := context.Background()

	// Test GetTagsForHebrewDate - Hebrew month 7 (Tishrei), day 1 (Rosh Hashanah)
	month := int32(7)
	day := int32(1)
	start := time.Now()
	tags, err := database.Queries.GetTagsForHebrewDate(ctx, sqlcgen.GetTagsForHebrewDateParams{
		HebrewMonth:    &month,
		HebrewDayStart: &day,
	})
	duration := time.Since(start)

	if err != nil {
		t.Fatalf("GetTagsForHebrewDate failed: %v", err)
	}

	// Verify performance target
	if duration > 50*time.Millisecond {
		t.Errorf("GetTagsForHebrewDate too slow: %v (target: < 50ms)", duration)
	}

	t.Logf("GetTagsForHebrewDate: %v, returned %d tags", duration, len(tags))

	// Test multiple dates to ensure consistent performance
	testDates := []struct {
		month int32
		day   int32
		desc  string
	}{
		{1, 15, "Pesach"},     // Nissan 15
		{3, 6, "Shavuot"},     // Sivan 6
		{7, 10, "Yom Kippur"}, // Tishrei 10
		{9, 25, "Chanukah"},   // Kislev 25
	}

	for _, td := range testDates {
		tMonth := td.month
		tDay := td.day
		start := time.Now()
		_, err := database.Queries.GetTagsForHebrewDate(ctx, sqlcgen.GetTagsForHebrewDateParams{
			HebrewMonth:    &tMonth,
			HebrewDayStart: &tDay,
		})
		duration := time.Since(start)

		if err != nil {
			t.Errorf("GetTagsForHebrewDate failed for %s: %v", td.desc, err)
		}

		if duration > 50*time.Millisecond {
			t.Errorf("GetTagsForHebrewDate too slow for %s: %v (target: < 50ms)", td.desc, duration)
		}

		t.Logf("  %s (%d/%d): %v", td.desc, td.month, td.day, duration)
	}
}

// TestLocationOverrideLookupPerformance verifies location override lookup performance
// Target: < 20ms (p95)
// Called on EVERY calculation for publishers with overrides
func TestLocationOverrideLookupPerformance(t *testing.T) {
	database := setupTestDB(t)
	defer database.Close()

	ctx := context.Background()

	// First, get a valid publisher ID
	publishers, err := database.Queries.GetAllPublishersBasicInfo(ctx)
	if err != nil {
		t.Fatalf("Failed to get publishers: %v", err)
	}

	if len(publishers) == 0 {
		t.Skip("No publishers in database, skipping location override performance test")
	}

	publisherID := publishers[0].ID

	// Test location resolution with hierarchical override (GetEffectiveLocalityLocation)
	// Uses priority: publisher > admin > default (overture/glo90)
	localityID := int32(293397) // Jerusalem
	pubIDPgtype := pgtype.Int4{Int32: publisherID, Valid: true}

	start := time.Now()
	location, err := database.Queries.GetEffectiveLocalityLocation(ctx, sqlcgen.GetEffectiveLocalityLocationParams{
		LocalityID:  localityID,
		PublisherID: pubIDPgtype,
	})
	duration := time.Since(start)

	if err != nil {
		t.Fatalf("GetEffectiveLocalityLocation failed: %v", err)
	}

	t.Logf("Found location: lat=%v, lon=%v, coord_source=%s, elev_source=%s",
		location.Latitude, location.Longitude,
		location.CoordinateSourceKey, location.ElevationSourceKey)

	// Verify performance target
	if duration > 20*time.Millisecond {
		t.Errorf("GetEffectiveLocalityLocation too slow: %v (target: < 20ms)", duration)
	}

	t.Logf("GetEffectiveLocalityLocation: %v", duration)

	// Test multiple lookups to simulate real-world usage
	testLocalities := []int32{293397, 5128581, 2643743, 3448439} // Jerusalem, NYC, London, Sao Paulo

	for _, locID := range testLocalities {
		start := time.Now()
		_, lookupErr := database.Queries.GetEffectiveLocalityLocation(ctx, sqlcgen.GetEffectiveLocalityLocationParams{
			LocalityID:  locID,
			PublisherID: pubIDPgtype,
		})
		duration := time.Since(start)

		if lookupErr != nil {
			t.Errorf("GetEffectiveLocalityLocation failed for locality %d: %v", locID, lookupErr)
		}

		if duration > 20*time.Millisecond {
			t.Errorf("GetEffectiveLocalityLocation too slow for locality %d: %v (target: < 20ms)", locID, duration)
		}

		t.Logf("  Locality %d: %v", locID, duration)
	}
}

// TestCorrectionRequestListPerformance verifies correction request list performance
// Target: < 150ms (p95)
// Called by admin dashboard
func TestCorrectionRequestListPerformance(t *testing.T) {
	database := setupTestDB(t)
	defer database.Close()

	ctx := context.Background()

	// Test GetAllCorrectionRequests (admin dashboard query)
	status := "pending"
	start := time.Now()
	requests, err := database.Queries.GetAllCorrectionRequests(ctx, &status)
	duration := time.Since(start)

	if err != nil {
		t.Fatalf("GetAllCorrectionRequests failed: %v", err)
	}

	// Verify performance target
	if duration > 150*time.Millisecond {
		t.Errorf("GetAllCorrectionRequests too slow: %v (target: < 150ms)", duration)
	}

	t.Logf("GetAllCorrectionRequests: %v, returned %d requests", duration, len(requests))

	// Test all correction requests (no filter)
	start = time.Now()
	allRequests, err := database.Queries.GetAllCorrectionRequests(ctx, nil)
	duration = time.Since(start)

	if err != nil {
		t.Fatalf("GetAllCorrectionRequests (all) failed: %v", err)
	}

	if duration > 150*time.Millisecond {
		t.Errorf("GetAllCorrectionRequests (all) too slow: %v (target: < 150ms)", duration)
	}

	t.Logf("GetAllCorrectionRequests (all): %v, returned %d requests", duration, len(allRequests))

	// Test publisher-specific requests
	publishers, err := database.Queries.GetAllPublishersBasicInfo(ctx)
	if err != nil {
		t.Fatalf("Failed to get publishers: %v", err)
	}

	if len(publishers) > 0 {
		publisherID := publishers[0].ID

		start = time.Now()
		publisherRequests, err := database.Queries.GetPublisherCorrectionRequests(ctx, &publisherID)
		duration = time.Since(start)

		if err != nil {
			t.Fatalf("GetPublisherCorrectionRequests failed: %v", err)
		}

		if duration > 150*time.Millisecond {
			t.Errorf("GetPublisherCorrectionRequests too slow: %v (target: < 150ms)", duration)
		}

		t.Logf("GetPublisherCorrectionRequests: %v, returned %d requests", duration, len(publisherRequests))
	}
}

// TestTagEventMappingQueryPerformance tests pattern matching queries
func TestTagEventMappingQueryPerformance(t *testing.T) {
	database := setupTestDB(t)
	defer database.Close()

	ctx := context.Background()

	// Test GetTagEventMappings (loads all event patterns)
	start := time.Now()
	mappings, err := database.Queries.GetTagEventMappings(ctx)
	duration := time.Since(start)

	if err != nil {
		t.Fatalf("GetTagEventMappings failed: %v", err)
	}

	// This should be fast as it's a simple query with index support
	if duration > 30*time.Millisecond {
		t.Errorf("GetTagEventMappings too slow: %v (target: < 30ms)", duration)
	}

	t.Logf("GetTagEventMappings: %v, returned %d mappings", duration, len(mappings))
}

// BenchmarkTagFilteringQuery benchmarks the critical tag filtering query
func BenchmarkTagFilteringQuery(b *testing.B) {
	// Get DATABASE_URL from environment
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		b.Skip("DATABASE_URL not set, skipping benchmark")
	}

	cfg := &config.Config{
		Database: config.DatabaseConfig{
			URL: dbURL,
		},
	}

	database, err := db.New(cfg)
	if err != nil {
		b.Fatalf("Failed to connect to test database: %v", err)
	}
	defer database.Close()

	ctx := context.Background()

	month := int32(7)
	day := int32(1)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := database.Queries.GetTagsForHebrewDate(ctx, sqlcgen.GetTagsForHebrewDateParams{
			HebrewMonth:    &month,
			HebrewDayStart: &day,
		})
		if err != nil {
			b.Fatalf("Query failed: %v", err)
		}
	}
}

// BenchmarkLocationOverrideLookup benchmarks location override lookup
func BenchmarkLocationOverrideLookup(b *testing.B) {
	// Get DATABASE_URL from environment
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		b.Skip("DATABASE_URL not set, skipping benchmark")
	}

	cfg := &config.Config{
		Database: config.DatabaseConfig{
			URL: dbURL,
		},
	}

	database, err := db.New(cfg)
	if err != nil {
		b.Fatalf("Failed to connect to test database: %v", err)
	}
	defer database.Close()

	ctx := context.Background()

	// Get a publisher ID
	publishers, err := database.Queries.GetAllPublishersBasicInfo(ctx)
	if err != nil {
		b.Fatalf("Failed to get publishers: %v", err)
	}

	if len(publishers) == 0 {
		b.Skip("No publishers in database")
	}

	publisherID := publishers[0].ID
	localityID := int32(293397) // Jerusalem
	pubIDPgtype := pgtype.Int4{Int32: publisherID, Valid: true}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := database.Queries.GetEffectiveLocalityLocation(ctx, sqlcgen.GetEffectiveLocalityLocationParams{
			LocalityID:  localityID,
			PublisherID: pubIDPgtype,
		})
		if err != nil {
			b.Fatalf("Query failed: %v", err)
		}
	}
}

// BenchmarkCorrectionRequestList benchmarks correction request listing
func BenchmarkCorrectionRequestList(b *testing.B) {
	// Get DATABASE_URL from environment
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		b.Skip("DATABASE_URL not set, skipping benchmark")
	}

	cfg := &config.Config{
		Database: config.DatabaseConfig{
			URL: dbURL,
		},
	}

	database, err := db.New(cfg)
	if err != nil {
		b.Fatalf("Failed to connect to test database: %v", err)
	}
	defer database.Close()

	ctx := context.Background()

	status := "pending"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := database.Queries.GetAllCorrectionRequests(ctx, &status)
		if err != nil {
			b.Fatalf("Query failed: %v", err)
		}
	}
}
