# Zmanim Calculation Consolidation Plan

## Executive Summary

Consolidate all zmanim calculation logic into a single server-side service with intelligent caching. Eliminate all client-side calculation code.

**Goals:**
1. Single source of truth for all zmanim calculations
2. Permanent caching (invalidate only on formula changes)
3. Zero client-side calculation logic
4. Unified API for all calculation needs

---

## Phase 1: Create Unified Calculation Service

### 1.1 Create `ZmanimCalculationService`

**File:** `api/internal/services/zmanim_calculation.go`

```go
type ZmanimCalculationService struct {
    db    *db.DB
    cache *cache.Cache
}

// Primary entry point - calculates zmanim with caching
func (s *ZmanimCalculationService) CalculateZmanim(ctx context.Context, params CalculateParams) (*CalculationResult, error)

// Calculate for a date range (batch)
func (s *ZmanimCalculationService) CalculateRange(ctx context.Context, params RangeParams) ([]DayResult, error)

// Calculate single formula (for preview)
func (s *ZmanimCalculationService) CalculateFormula(ctx context.Context, params FormulaParams) (*FormulaResult, error)
```

**Parameters Structure:**
```go
type CalculateParams struct {
    // Location (one required)
    LocalityID  *int64
    Coordinates *GeoPoint  // lat, lon, elevation, timezone

    // Date
    Date time.Time

    // What to calculate (one required)
    PublisherID string        // All publisher's zmanim
    ZmanIDs     []int64       // Specific zmanim only
    Formula     *string       // Raw DSL formula

    // Options
    IncludeDisabled    bool   // Default: false
    IncludeUnpublished bool   // Default: false
    IncludeBeta        bool   // Default: true
    IncludeBreakdown   bool   // Default: false (for debugging)
}

type CalculationResult struct {
    Date       string
    Location   LocationInfo
    Zmanim     []CalculatedZman
    FromCache  bool
    CachedAt   *time.Time
}

type CalculatedZman struct {
    ID           int64
    Key          string
    Time         time.Time
    TimeFormatted string  // Already rounded per rounding_mode
    Formula      string
    RoundingMode string
    Breakdown    []CalculationStep  // Only if IncludeBreakdown
}
```

### 1.2 Update Cache Structure

**File:** `api/internal/cache/cache.go`

Add new cache key format and permanent TTL:

```go
// New key format: uses publisher_zman_id (resolves linked zmanim)
func zmanCalculationKey(publisherZmanID int64, localityID int64, date string) string {
    return fmt.Sprintf("calc:%d:%d:%s", publisherZmanID, localityID, date)
}

// For formula preview (hash the formula)
func formulaCalculationKey(formulaHash string, lat, lon float64, date string) string {
    return fmt.Sprintf("formula:%s:%.4f:%.4f:%s", formulaHash, lat, lon, date)
}

// Set without TTL (permanent until invalidated)
func (c *Cache) SetZmanCalculation(ctx context.Context, key string, result *CalculatedZman) error {
    // No TTL - lives forever until InvalidateZmanFormula called
    return c.client.Set(ctx, key, data, 0).Err()
}

// Invalidate when formula changes
func (c *Cache) InvalidateZmanFormula(ctx context.Context, publisherZmanID int64) error {
    pattern := fmt.Sprintf("calc:%d:*", publisherZmanID)
    return c.deleteByPattern(ctx, pattern)
}
```

### 1.3 Implement Service Logic

The service will:
1. Check cache first (per-zman granularity)
2. Only calculate uncached zmanim
3. Use existing `dsl.ExecuteFormulaSet()` for batch execution
4. Cache results permanently
5. Handle linked zmanim (use linked_publisher_zman_id for cache key)

---

## Phase 2: Migrate Backend Handlers

### 2.1 Files to Modify

| File | Current Logic | New Logic |
|------|---------------|-----------|
| `handlers/zmanim.go` | Direct DSL execution | Call `CalculateZmanim()` |
| `handlers/dsl.go` | Direct DSL execution | Call `CalculateFormula()` |
| `handlers/publisher_zmanim.go` | Direct DSL execution | Call `CalculateRange()` |
| `handlers/external_api.go` | Direct DSL execution | Call `CalculateRange()` |

### 2.2 Handler Changes

**zmanim.go - GetZmanimForLocality:**
```go
// Before (lines 296-342):
dslCtx := dsl.NewExecutionContext(date, latitude, longitude, float64(elevation), loc)
calculatedTimes, err := dsl.ExecuteFormulaSet(formulas, dslCtx)

// After:
result, err := h.zmanimService.CalculateZmanim(ctx, services.CalculateParams{
    LocalityID:  &localityID,
    PublisherID: publisherID,
    Date:        date,
    IncludeDisabled: filters.IncludeDisabled,
    IncludeUnpublished: filters.IncludeUnpublished,
    IncludeBeta: filters.IncludeBeta,
})
```

**dsl.go - PreviewDSLFormula:**
```go
// Before: Creates ExecutionContext, calls dsl.ExecuteFormula
// After:
result, err := h.zmanimService.CalculateFormula(ctx, services.FormulaParams{
    Formula:   req.Formula,
    Date:      date,
    Latitude:  req.Latitude,
    Longitude: req.Longitude,
    Timezone:  req.Timezone,
    IncludeBreakdown: true,
})
```

**dsl.go - PreviewDSLFormulaWeek:**
```go
// Before: Loop calling ExecuteFormula 7 times
// After:
results, err := h.zmanimService.CalculateRange(ctx, services.RangeParams{
    Formula:   req.Formula,
    StartDate: startDate,
    EndDate:   startDate.AddDate(0, 0, 6),
    Latitude:  req.Latitude,
    Longitude: req.Longitude,
    Timezone:  req.Timezone,
})
```

**external_api.go - CalculateExternalBulkZmanim:**
```go
// Before: Worker pool creating ExecutionContext per day
// After:
results, err := h.zmanimService.CalculateRange(ctx, services.RangeParams{
    LocalityID:  &req.LocalityID,
    PublisherID: req.PublisherID,
    StartDate:   req.StartDate,
    EndDate:     req.EndDate,
    ZmanKeys:    req.ZmanKeys,
})
```

### 2.3 Remove Direct DSL/Astro Calls

After migration, these patterns should NOT appear in handlers:
- `dsl.NewExecutionContext`
- `dsl.ExecuteFormula`
- `dsl.ExecuteFormulaSet`
- `astro.CalculateSunTimes`
- `astro.AddMinutes` / `astro.SubtractMinutes`

---

## Phase 3: Eliminate Client-Side Calculations

### 3.1 Files to Delete

| File | Lines | Reason |
|------|-------|--------|
| `web/lib/utils/dsl-calculator.ts` | 220 | Duplicate DSL calculation |
| `web/lib/zmanim.ts` | 186 | Client kosher-zmanim usage |
| `web/components/ZmanimDisplay.tsx` | 663 | Full client calculator |

### 3.2 Files to Refactor

**`web/lib/location.ts`** - Remove kosher-zmanim dependency:
```typescript
// Before: imports GeoLocation from kosher-zmanim
// After: Simple interface, no calculation library
export interface LocationData {
  latitude: number;
  longitude: number;
  timezone: string;
  elevation?: number;
  name?: string;
}
// Remove createGeoLocation, getDefaultGeoLocation functions
```

**`web/components/publisher/ZmanTimePreview.tsx`** - Use API instead of client calc:
```typescript
// Before:
import { calculateDslFormula, canCalculateClientSide } from '@/lib/utils/dsl-calculator';
const result = calculateDslFormula(formula, date, lat, lon, tz);

// After:
const { data, isLoading } = usePreviewFormula({
  formula,
  date: date.toISODate(),
  latitude: lat,
  longitude: lon,
  timezone: tz,
});
```

### 3.3 Remove kosher-zmanim Dependency

```bash
cd web && npm uninstall kosher-zmanim
```

Update `package.json` to remove the dependency entirely.

---

## Phase 4: Cache Invalidation Updates

### 4.1 Selective Invalidation

Only invalidate cache when formula actually changes:

**`handlers/publisher_zmanim.go` - UpdatePublisherZman:**
```go
// Before: Always calls InvalidatePublisherCache
// After: Only invalidate if formula changed
if req.FormulaDsl != nil && *req.FormulaDsl != existingZman.FormulaDsl {
    h.cache.InvalidateZmanFormula(ctx, zmanID)
}
if req.LinkedPublisherZmanID != nil {
    h.cache.InvalidateZmanFormula(ctx, zmanID)
}
// Don't invalidate for: name changes, tag changes, visibility changes
```

### 4.2 Update Invalidation Triggers

| Event | Current Action | New Action |
|-------|---------------|------------|
| Formula DSL changed | Invalidate all publisher cache | Invalidate specific zman only |
| Linked zman changed | Invalidate all publisher cache | Invalidate specific zman only |
| Name/tags changed | Invalidate all publisher cache | **No invalidation** (metadata only) |
| Visibility changed | Invalidate all publisher cache | **No invalidation** (filter at query time) |
| Coordinate override changed | Invalidate locality cache | Invalidate locality + publisher combo |

---

## Phase 5: Add Quick Preview Endpoint

### 5.1 New Endpoint for Editor

**`GET /api/v1/dsl/preview-quick`**

Optimized for real-time editor preview:
- Minimal response (just time string)
- Aggressive caching
- Debounce-friendly

```go
type QuickPreviewResponse struct {
    Time   string `json:"time"`   // "14:32:15"
    Cached bool   `json:"cached"`
}
```

### 5.2 Frontend Hook

```typescript
// web/lib/hooks/useQuickPreview.ts
export function useQuickPreview(formula: string, location: Location, date: string) {
  return useQuery({
    queryKey: ['quick-preview', formula, location.id, date],
    queryFn: () => api.get('/dsl/preview-quick', {
      params: { formula, lat: location.lat, lon: location.lon, tz: location.tz, date }
    }),
    staleTime: Infinity, // Never stale - cache permanently
    enabled: formula.length > 0,
  });
}
```

---

## Implementation Order

### Step 1: Create Service (Day 1)
1. Create `api/internal/services/zmanim_calculation.go`
2. Implement `CalculateZmanim()`, `CalculateFormula()`, `CalculateRange()`
3. Add tests
4. Wire into handlers struct

### Step 2: Migrate Main Endpoint (Day 1)
1. Update `handlers/zmanim.go` to use service
2. Verify all tests pass
3. Test manually

### Step 3: Migrate Preview Endpoints (Day 2)
1. Update `handlers/dsl.go` (PreviewDSLFormula, PreviewDSLFormulaWeek)
2. Update `handlers/publisher_zmanim.go` (GetPublisherZmanimWeek)
3. Verify all tests pass

### Step 4: Migrate External API (Day 2)
1. Update `handlers/external_api.go`
2. Verify bulk calculation still works

### Step 5: Eliminate Client Code (Day 3)
1. Delete `dsl-calculator.ts`, `zmanim.ts`, `ZmanimDisplay.tsx`
2. Refactor `location.ts`
3. Update `ZmanTimePreview.tsx` to use API
4. Remove kosher-zmanim from package.json
5. Verify frontend builds

### Step 6: Update Cache Invalidation (Day 3)
1. Add `InvalidateZmanFormula()` to cache
2. Update handlers to use selective invalidation
3. Test invalidation scenarios

### Step 7: Run Verification Suite (Day 3)
1. Run `scripts/verify-single-calculation-source.sh`
2. All tests must pass

---

## Verification Checklist

After refactor, run these checks:

```bash
# 1. No direct DSL calls in handlers
rg "dsl\.Execute" api/internal/handlers/ -l
# Expected: 0 matches

# 2. No ExecutionContext in handlers
rg "dsl\.NewExecutionContext" api/internal/handlers/ -l
# Expected: 0 matches

# 3. No kosher-zmanim in frontend
rg "kosher-zmanim" web/ -l
# Expected: 0 matches

# 4. No client calculation functions
rg "calculateDslFormula|canCalculateClientSide" web/ -l
# Expected: 0 matches

# 5. No getSunrise/getSunset in frontend
rg "getSunrise|getSunset|getChatzos" web/ -l
# Expected: 0 matches

# 6. Service is the only DSL caller
rg "dsl\.Execute" api/internal/services/ -l
# Expected: 1 match (zmanim_calculation.go)
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Preview latency increases | Add quick-preview endpoint, aggressive caching |
| Cache key migration | Run both old and new keys during transition |
| Breaking changes | Feature flag for new service, gradual rollout |
| Missing edge cases | Comprehensive test coverage before migration |

---

## Success Metrics

1. **Code reduction:** ~1,175 lines of client code deleted
2. **Cache hit rate:** >95% (up from ~60%)
3. **Handler complexity:** Each handler reduced to <50 lines
4. **Single source:** Only 1 file contains DSL execution logic
5. **Response time:** Cached responses <10ms
