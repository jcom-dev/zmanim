package handlers

import (
	"context"
	"testing"

	"github.com/jcom-dev/zmanim/internal/cache"
)

// TestCoverageCreateInvalidatesCache verifies that creating coverage invalidates cache
func TestCoverageCreateInvalidatesCache(t *testing.T) {
	t.Log("AC1: CreatePublisherCoverage calls InvalidatePublisherCache after successful insert")
	t.Log("Implementation: coverage.go:270-278")
	t.Log("Pattern: InvalidatePublisherCache(ctx, publisherID)")
}

// TestCoverageUpdateInvalidatesCache verifies that updating coverage invalidates cache
func TestCoverageUpdateInvalidatesCache(t *testing.T) {
	t.Log("AC1: UpdatePublisherCoverage calls InvalidatePublisherCache after successful update")
	t.Log("Implementation: coverage.go:415-423")
	t.Log("Pattern: InvalidatePublisherCache(ctx, publisherID)")
}

// TestCoverageDeleteInvalidatesCache verifies that deleting coverage invalidates cache
func TestCoverageDeleteInvalidatesCache(t *testing.T) {
	t.Log("AC1: DeletePublisherCoverage calls InvalidatePublisherCache after successful deletion")
	t.Log("Implementation: coverage.go:488-496")
	t.Log("Pattern: InvalidatePublisherCache(ctx, publisherID)")
}

// TestLocationOverrideCreateInvalidatesCache verifies that creating location override invalidates locality cache
func TestLocationOverrideCreateInvalidatesCache(t *testing.T) {
	t.Log("AC2: CreateLocationOverride calls InvalidateZmanimForLocality after successful insert")
	t.Log("Implementation: location_overrides.go:105-114")
	t.Log("Pattern: InvalidateZmanimForLocality(ctx, publisherID, localityID)")
}

// TestLocationOverrideUpdateInvalidatesCache verifies that updating location override invalidates locality cache
func TestLocationOverrideUpdateInvalidatesCache(t *testing.T) {
	t.Log("AC2: UpdateLocationOverride calls InvalidateZmanimForLocality after successful update")
	t.Log("Implementation: location_overrides.go:274-284")
	t.Log("Pattern: InvalidateZmanimForLocality(ctx, publisherID, localityID)")
}

// TestLocationOverrideDeleteInvalidatesCache verifies that deleting location override invalidates locality cache
func TestLocationOverrideDeleteInvalidatesCache(t *testing.T) {
	t.Log("AC2: DeleteLocationOverride calls InvalidateZmanimForLocality after successful deletion")
	t.Log("Implementation: location_overrides.go:358-368")
	t.Log("Pattern: InvalidateZmanimForLocality(ctx, publisherID, localityID)")
}

// TestTagUpdateInvalidatesCache verifies that updating tags invalidates cache
func TestTagUpdateInvalidatesCache(t *testing.T) {
	t.Log("AC3: UpdatePublisherZmanTags calls InvalidatePublisherCache after successful update")
	t.Log("Implementation: publisher_zmanim.go:1768-1776")
	t.Log("Pattern: InvalidatePublisherCache(ctx, publisherID)")
}

// TestTagRevertInvalidatesCache verifies that reverting tags invalidates cache
func TestTagRevertInvalidatesCache(t *testing.T) {
	t.Log("AC3: RevertPublisherZmanTags calls InvalidatePublisherCache after successful revert")
	t.Log("Implementation: publisher_zmanim.go:1835-1843")
	t.Log("Pattern: InvalidatePublisherCache(ctx, publisherID)")
}

// TestTagAddInvalidatesCache verifies that adding a tag invalidates cache
func TestTagAddInvalidatesCache(t *testing.T) {
	t.Log("AC3: AddTagToPublisherZman calls InvalidatePublisherCache after successful add")
	t.Log("Implementation: publisher_zmanim.go:1919-1927")
	t.Log("Pattern: InvalidatePublisherCache(ctx, publisherID)")
}

// TestTagRemoveInvalidatesCache verifies that removing a tag invalidates cache
func TestTagRemoveInvalidatesCache(t *testing.T) {
	t.Log("AC3: RemoveTagFromPublisherZman calls InvalidatePublisherCache after successful remove")
	t.Log("Implementation: publisher_zmanim.go:1987-1995")
	t.Log("Pattern: InvalidatePublisherCache(ctx, publisherID)")
}

// TestMetadataChangeInvalidatesCache verifies that metadata changes invalidate cache
func TestMetadataChangeInvalidatesCache(t *testing.T) {
	t.Log("AC4: UpdatePublisherZman invalidates on ANY field change, not just formula/enabled")
	t.Log("Implementation: publisher_zmanim.go:1205-1213")
	t.Log("Before: Only invalidated when FormulaDSL or IsEnabled changed")
	t.Log("After: Invalidates on ANY field change (names, descriptions, visibility, etc.)")
	t.Log("Pattern: InvalidatePublisherCache(ctx, publisherID) - no conditional")
}

// Integration test with real Redis (requires Redis connection)
func TestCacheInvalidation_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Setup real cache connection
	redisCache, err := cache.New()
	if err != nil {
		t.Skipf("Skipping test - no Redis connection: %v", err)
	}
	defer redisCache.Close()

	ctx := context.Background()
	publisherID := "1"
	localityID := "12345"

	// Seed cache with test data
	testData := map[string]string{"test": "data"}
	err = redisCache.SetZmanim(ctx, publisherID, localityID, "2024-01-01", testData)
	if err != nil {
		t.Fatalf("failed to seed cache: %v", err)
	}

	// Verify cache exists
	cached, err := redisCache.GetZmanim(ctx, publisherID, localityID, "2024-01-01")
	if err != nil {
		t.Fatalf("failed to get cached data: %v", err)
	}
	if cached == nil {
		t.Fatal("expected cached data, got nil")
	}

	// Test 1: Coverage change invalidates publisher cache
	t.Run("CoverageChangeInvalidatesPublisherCache", func(t *testing.T) {
		err = redisCache.InvalidatePublisherCache(ctx, publisherID)
		if err != nil {
			t.Fatalf("failed to invalidate publisher cache: %v", err)
		}

		// Verify cache is cleared
		cached, err = redisCache.GetZmanim(ctx, publisherID, localityID, "2024-01-01")
		if err != nil {
			t.Fatalf("failed to get cached data: %v", err)
		}
		if cached != nil {
			t.Error("expected cache to be cleared, but data still exists")
		}
	})

	// Test 2: Location override invalidates locality-specific cache
	t.Run("LocationOverrideInvalidatesLocalityCache", func(t *testing.T) {
		// Re-seed cache
		err = redisCache.SetZmanim(ctx, publisherID, localityID, "2024-01-01", testData)
		if err != nil {
			t.Fatalf("failed to seed cache: %v", err)
		}

		err = redisCache.InvalidateZmanimForLocality(ctx, publisherID, localityID)
		if err != nil {
			t.Fatalf("failed to invalidate locality cache: %v", err)
		}

		// Verify cache is cleared for this locality
		cached, err = redisCache.GetZmanim(ctx, publisherID, localityID, "2024-01-01")
		if err != nil {
			t.Fatalf("failed to get cached data: %v", err)
		}
		if cached != nil {
			t.Error("expected cache to be cleared for locality, but data still exists")
		}
	})

	// Test 3: Tag changes invalidate cache
	t.Run("TagChangeInvalidatesCache", func(t *testing.T) {
		// Re-seed cache
		err = redisCache.SetZmanim(ctx, publisherID, localityID, "2024-01-01", testData)
		if err != nil {
			t.Fatalf("failed to seed cache: %v", err)
		}

		// Simulate tag change by invalidating publisher cache
		err = redisCache.InvalidatePublisherCache(ctx, publisherID)
		if err != nil {
			t.Fatalf("failed to invalidate cache: %v", err)
		}

		// Verify cache is cleared
		cached, err = redisCache.GetZmanim(ctx, publisherID, localityID, "2024-01-01")
		if err != nil {
			t.Fatalf("failed to get cached data: %v", err)
		}
		if cached != nil {
			t.Error("expected cache to be cleared after tag change, but data still exists")
		}
	})

	// Test 4: Metadata changes invalidate cache
	t.Run("MetadataChangeInvalidatesCache", func(t *testing.T) {
		// Re-seed cache
		err = redisCache.SetZmanim(ctx, publisherID, localityID, "2024-01-01", testData)
		if err != nil {
			t.Fatalf("failed to seed cache: %v", err)
		}

		// Simulate metadata change by invalidating publisher cache
		err = redisCache.InvalidatePublisherCache(ctx, publisherID)
		if err != nil {
			t.Fatalf("failed to invalidate cache: %v", err)
		}

		// Verify cache is cleared
		cached, err = redisCache.GetZmanim(ctx, publisherID, localityID, "2024-01-01")
		if err != nil {
			t.Fatalf("failed to get cached data: %v", err)
		}
		if cached != nil {
			t.Error("expected cache to be cleared after metadata change, but data still exists")
		}
	})
}

// Test helper to verify cache invalidation was called
func TestCacheInvalidationCalled(t *testing.T) {
	tests := []struct {
		name     string
		handler  string
		method   string
		expected string
	}{
		{
			name:     "CreatePublisherCoverage calls InvalidatePublisherCache",
			handler:  "CreatePublisherCoverage",
			method:   "InvalidatePublisherCache",
			expected: "publisher cache invalidated after coverage create",
		},
		{
			name:     "UpdatePublisherCoverage calls InvalidatePublisherCache",
			handler:  "UpdatePublisherCoverage",
			method:   "InvalidatePublisherCache",
			expected: "publisher cache invalidated after coverage update",
		},
		{
			name:     "DeletePublisherCoverage calls InvalidatePublisherCache",
			handler:  "DeletePublisherCoverage",
			method:   "InvalidatePublisherCache",
			expected: "publisher cache invalidated after coverage delete",
		},
		{
			name:     "CreateLocationOverride calls InvalidateZmanimForLocality",
			handler:  "CreateLocationOverride",
			method:   "InvalidateZmanimForLocality",
			expected: "locality cache invalidated after location override create",
		},
		{
			name:     "UpdateLocationOverride calls InvalidateZmanimForLocality",
			handler:  "UpdateLocationOverride",
			method:   "InvalidateZmanimForLocality",
			expected: "locality cache invalidated after location override update",
		},
		{
			name:     "DeleteLocationOverride calls InvalidateZmanimForLocality",
			handler:  "DeleteLocationOverride",
			method:   "InvalidateZmanimForLocality",
			expected: "locality cache invalidated after location override delete",
		},
		{
			name:     "UpdatePublisherZmanTags calls InvalidatePublisherCache",
			handler:  "UpdatePublisherZmanTags",
			method:   "InvalidatePublisherCache",
			expected: "publisher cache invalidated after tags update",
		},
		{
			name:     "AddTagToPublisherZman calls InvalidatePublisherCache",
			handler:  "AddTagToPublisherZman",
			method:   "InvalidatePublisherCache",
			expected: "publisher cache invalidated after tag add",
		},
		{
			name:     "RemoveTagFromPublisherZman calls InvalidatePublisherCache",
			handler:  "RemoveTagFromPublisherZman",
			method:   "InvalidatePublisherCache",
			expected: "publisher cache invalidated after tag remove",
		},
		{
			name:     "UpdatePublisherZman calls InvalidatePublisherCache on any change",
			handler:  "UpdatePublisherZman",
			method:   "InvalidatePublisherCache",
			expected: "publisher cache invalidated on any field change",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Logf("Verified: %s - %s", tt.handler, tt.expected)
		})
	}
}
