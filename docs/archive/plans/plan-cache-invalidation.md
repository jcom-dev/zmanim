# Cache Invalidation Plan for Zmanim Lab

**Status: IMPLEMENTED** (2025-12-04)

## Problem Statement

The Live Preview in the Algorithm Editor shows stale data because cached zmanim calculations are not invalidated when:
1. A publisher edits their zman formulas
2. An admin updates the master registry (affecting all publishers using that zman)

Currently, cache is only invalidated in 2 places:
- When a publisher **publishes** their algorithm (`PublishAlgorithm`)
- When a zman's `formula_dsl` or `is_enabled` is **updated** (`UpdatePublisherZman`)

## Current Cache Architecture

### Cache Keys
| Type | Pattern | TTL | Purpose |
|------|---------|-----|---------|
| Zmanim | `zmanim:{publisherId}:{cityId}:{date}` | 24h | Calculated times |
| Filtered | `{publisherId}:{date}:lat:lon` | 24h | Publisher filtered times |
| Week | `week:{publisherId}:{startDate}:lat:lon` | 24h | 7-day batch |
| Algorithm | `algorithm:{publisherId}` | 1h | Algorithm config |
| City | `city:{cityId}` | 7d | City geodata |

### Cache Invalidation Methods
```go
InvalidateZmanim(ctx, publisherID)              // Pattern: zmanim:{publisherId}:*
InvalidateZmanimForCity(ctx, publisherId, cityID) // Pattern: zmanim:{publisherId}:{cityId}:*
InvalidateAlgorithm(ctx, publisherID)           // Direct key delete
FlushAllZmanim(ctx)                             // Pattern: zmanim:*
```

## Identified Gaps

### Gap 1: Missing invalidation on formula changes (CRITICAL)
These handlers modify data but do NOT invalidate cache:

| Handler | File | Issue |
|---------|------|-------|
| `CreatePublisherZman` | publisher_zmanim.go:1010 | New zman not reflected |
| `DeletePublisherZman` | publisher_zmanim.go:1189 | Deleted zman still appears |
| `ImportZmanim` | publisher_zmanim.go:1231 | Imported zmanim not visible |
| `CreateZmanFromPublisher` | publisher_zmanim.go:1640 | Linked zman not visible |
| `CreatePublisherZmanFromRegistry` | master_registry.go:1256 | New zman from registry not visible |

### Gap 2: Master registry updates affect ALL publishers (CRITICAL)
When admin updates `default_formula_dsl` in master registry, ALL publishers using that zman need cache cleared.

Handler: `AdminUpdateMasterZman` (master_registry.go:2624)

### Gap 3: Inconsistent cache key patterns
The `InvalidateZmanim` only clears `zmanim:{publisherId}:*` but doesn't clear:
- `{publisherId}:{date}:lat:lon` (filtered zmanim)
- `week:{publisherId}:{startDate}:lat:lon` (week batch)

## Proposed Solution

### Phase 1: Add InvalidatePublisherCache method (refactor)

Create a comprehensive method that clears ALL cache types for a publisher:

```go
// InvalidatePublisherCache clears all cached data for a publisher
// This includes: zmanim calculations, filtered results, week batches, and algorithm config
func (c *Cache) InvalidatePublisherCache(ctx context.Context, publisherID string) error {
    patterns := []string{
        fmt.Sprintf("zmanim:%s:*", publisherID),        // Standard zmanim cache
        fmt.Sprintf("%s:*", publisherID),               // Filtered zmanim cache
        fmt.Sprintf("week:%s:*", publisherID),          // Week batch cache
    }

    var errs []error
    for _, pattern := range patterns {
        if err := c.deleteByPattern(ctx, pattern); err != nil {
            errs = append(errs, err)
        }
    }

    // Also clear algorithm cache
    if err := c.InvalidateAlgorithm(ctx, publisherID); err != nil {
        errs = append(errs, err)
    }

    if len(errs) > 0 {
        return fmt.Errorf("cache invalidation errors: %v", errs)
    }
    return nil
}
```

### Phase 2: Add cache invalidation to missing handlers

**File: api/internal/handlers/publisher_zmanim.go**

1. `CreatePublisherZman` (line ~1090, before RespondJSON):
```go
// Invalidate cache - new zman affects calculations
if h.cache != nil {
    if err := h.cache.InvalidatePublisherCache(ctx, publisherID); err != nil {
        slog.Warn("failed to invalidate cache after creating zman", "error", err)
    }
}
```

2. `DeletePublisherZman` (line ~1218, before RespondJSON):
```go
// Invalidate cache - deleted zman affects calculations
if h.cache != nil {
    if err := h.cache.InvalidatePublisherCache(ctx, publisherID); err != nil {
        slog.Warn("failed to invalidate cache after deleting zman", "error", err)
    }
}
```

3. `ImportZmanim` (line ~1390, before RespondJSON):
```go
// Invalidate cache - imported zmanim affect calculations
if h.cache != nil {
    if err := h.cache.InvalidatePublisherCache(ctx, publisherID); err != nil {
        slog.Warn("failed to invalidate cache after import", "error", err)
    }
}
```

4. `CreateZmanFromPublisher` (line ~1790, before RespondJSON):
```go
// Invalidate cache - new linked zman affects calculations
if h.cache != nil {
    if err := h.cache.InvalidatePublisherCache(ctx, publisherID); err != nil {
        slog.Warn("failed to invalidate cache after creating linked zman", "error", err)
    }
}
```

**File: api/internal/handlers/master_registry.go**

5. `CreatePublisherZmanFromRegistry` (before RespondJSON):
```go
// Invalidate cache - new zman from registry affects calculations
if h.cache != nil {
    if err := h.cache.InvalidatePublisherCache(ctx, publisherID); err != nil {
        slog.Warn("failed to invalidate cache after creating zman from registry", "error", err)
    }
}
```

### Phase 3: Handle master registry updates (affects ALL publishers)

When `default_formula_dsl` is updated in master registry, we need to:
1. Find all publishers who use that zman
2. Invalidate cache for each publisher

**File: api/internal/handlers/master_registry.go**

Add after `AdminUpdateMasterZman` successfully updates:

```go
// If default_formula_dsl changed, invalidate ALL publisher caches
// (publishers using this master zman will have stale calculations)
if req.DefaultFormulaDSL != nil && h.cache != nil {
    // Get all publishers who have this zman in their publisher_zmanim
    publisherIDs, err := h.db.Queries.GetPublishersUsingMasterZman(ctx, id)
    if err != nil {
        slog.Error("failed to get publishers using master zman", "error", err, "zman_id", id)
    } else {
        for _, pubID := range publisherIDs {
            if err := h.cache.InvalidatePublisherCache(ctx, pubID); err != nil {
                slog.Warn("failed to invalidate publisher cache after registry update",
                    "error", err, "publisher_id", pubID, "zman_id", id)
            }
        }
        slog.Info("invalidated caches for publishers using updated master zman",
            "zman_id", id, "publisher_count", len(publisherIDs))
    }
}
```

**New SQLc Query (api/internal/db/queries/publisher_zmanim.sql)**:
```sql
-- name: GetPublishersUsingMasterZman :many
SELECT DISTINCT publisher_id
FROM publisher_zmanim
WHERE master_zman_id = $1
AND deleted_at IS NULL;
```

### Phase 4: Update existing invalidation calls

Replace `InvalidateZmanim` + `InvalidateAlgorithm` with single `InvalidatePublisherCache`:

**File: api/internal/handlers/publisher_algorithm.go** (line 621-631)
```go
// Before:
if h.cache != nil {
    if err := h.cache.InvalidateZmanim(ctx, publisherID); err != nil {
        slog.Error("cache invalidation error after publish", "error", err)
    }
    if err := h.cache.InvalidateAlgorithm(ctx, publisherID); err != nil {
        slog.Error("algorithm cache invalidation error", "error", err)
    }
}

// After:
if h.cache != nil {
    if err := h.cache.InvalidatePublisherCache(ctx, publisherID); err != nil {
        slog.Error("cache invalidation error after publish", "error", err)
    }
}
```

**File: api/internal/handlers/zmanim.go** (line 461-471) - same pattern

**File: api/internal/handlers/publisher_zmanim.go** (line 1174-1180):
```go
// Before:
if h.cache != nil && (req.FormulaDSL != nil || req.IsEnabled != nil) {
    if err := h.cache.InvalidateZmanim(ctx, publisherID); err != nil {
        slog.Warn("failed to invalidate zmanim cache", "error", err)
    }
}

// After:
if h.cache != nil && (req.FormulaDSL != nil || req.IsEnabled != nil) {
    if err := h.cache.InvalidatePublisherCache(ctx, publisherID); err != nil {
        slog.Warn("failed to invalidate cache", "error", err)
    }
}
```

## Implementation Order

1. **Add `InvalidatePublisherCache` method** to `api/internal/cache/cache.go`
2. **Add SQLc query** `GetPublishersUsingMasterZman`
3. **Run `sqlc generate`**
4. **Update existing invalidation** in:
   - `publisher_algorithm.go` (PublishAlgorithm)
   - `zmanim.go` (manual cache flush endpoint)
   - `publisher_zmanim.go` (UpdatePublisherZman)
5. **Add new invalidation** to:
   - `publisher_zmanim.go` (CreatePublisherZman, DeletePublisherZman, ImportZmanim, CreateZmanFromPublisher)
   - `master_registry.go` (CreatePublisherZmanFromRegistry, AdminUpdateMasterZman)
6. **Test** each scenario manually

## Testing Checklist

- [x] Create new zman -> live preview updates
- [x] Update zman formula -> live preview updates
- [x] Delete zman -> live preview updates (zman disappears)
- [x] Import zmanim -> live preview shows imported
- [x] Create linked zman -> live preview updates
- [x] Create zman from registry -> live preview updates
- [x] Admin updates master registry default_formula_dsl -> ALL publishers using it get fresh data
- [x] Week view loads fresh data after changes
- [x] Filtered zmanim endpoint returns fresh data after changes

## Implementation Summary

The following changes were made:

### 1. New Cache Method (`api/internal/cache/cache.go`)
Added `InvalidatePublisherCache()` method that clears ALL cache types for a publisher:
- `zmanim:{publisherId}:*` - Standard zmanim cache
- `{publisherId}:*` - Filtered zmanim cache
- `week:{publisherId}:*` - Week batch cache
- `algorithm:{publisherId}` - Algorithm config

### 2. New SQLc Query (`api/internal/db/queries/zmanim.sql`)
Added `GetPublishersUsingMasterZman` query to find all publishers using a specific master registry zman.

### 3. Updated Handlers

| Handler | File | Change |
|---------|------|--------|
| `PublishAlgorithm` | publisher_algorithm.go | Use `InvalidatePublisherCache` |
| `FlushCache` | zmanim.go | Use `InvalidatePublisherCache` |
| `UpdatePublisherZman` | publisher_zmanim.go | Use `InvalidatePublisherCache` |
| `CreatePublisherZman` | publisher_zmanim.go | **NEW** - Added cache invalidation |
| `DeletePublisherZman` | publisher_zmanim.go | **NEW** - Added cache invalidation |
| `ImportZmanim` | publisher_zmanim.go | **NEW** - Added cache invalidation |
| `CreateZmanFromPublisher` | publisher_zmanim.go | **NEW** - Added cache invalidation |
| `CreatePublisherZmanFromRegistry` | master_registry.go | **NEW** - Added cache invalidation |
| `AdminUpdateMasterZman` | master_registry.go | **NEW** - Invalidates ALL affected publishers |

## Risk Assessment

**Low Risk:**
- Adding `InvalidatePublisherCache` is additive
- Adding SQLc query is additive
- Cache misses are handled gracefully (recalculated on demand)

**Medium Risk:**
- More aggressive invalidation may increase Redis load temporarily
- Pattern-based deletions (`SCAN` + `DEL`) are O(N) operations

**Mitigation:**
- The `deleteByPattern` already uses cursor-based scanning (batches of 100)
- Redis is designed for this; pattern deletions are expected use cases
- In worst case, all caches clear and recalculate on next request

## Alternative Considered: Event-Driven Invalidation

Could implement a pub/sub pattern where:
1. Data changes publish events to a Redis channel
2. Cache subscriber listens and invalidates

**Rejected because:**
- Adds complexity (new event system)
- Current approach is synchronous and simpler
- Cache invalidation is not high-frequency enough to warrant async
- Direct invalidation in handlers is easier to reason about and debug
