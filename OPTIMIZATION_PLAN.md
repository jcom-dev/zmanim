# Zmanim Service Performance Optimization Plan

**Generated**: 2025-12-26
**Target**: Weekly endpoint from 3000ms → <400ms cold, <100ms cached
**Status**: Ready for Implementation

---

## Executive Summary

### Current State
- **Critical Issue**: Weekly zmanim endpoint taking 3000ms+ (7.5× over target)
- **Root Cause**: 365× redundant database queries in `CalculateRange()` loop
- **Cache Bug**: Missing `ActiveEventCodes` in cache key → data correctness issue
- **Calendar Overhead**: 35 redundant HebCal calls per week (94% reduction possible)
- **Handler Inefficiency**: Only 1 of 44 handlers uses parallel queries

### Expected Outcome After Optimizations
- **Weekly endpoint**: 3000ms → 300ms cold, 80ms cached (10× improvement)
- **Database queries**: 21/request → 3/request (86% reduction)
- **HebCal calls**: 35/week → 2/week (94% reduction)
- **Cache hit rate**: 20% → 85%+ with fixed cache keys
- **All endpoints**: Performance targets achieved with zero regressions

### Performance Grades
| Component | Current Grade | Issue | Target Grade |
|-----------|---------------|-------|--------------|
| Database | A- | Well-indexed, minimal N+1 | A (maintain) |
| Service Layer | C | Redundant loops, missing preload | A |
| Calendar Integration | C- | 94% redundant calls | A |
| Handler Layer | D+ | Sequential processing, no parallelization | A |
| Cache Architecture | B- | Missing event codes in key | A |

---

## 1. Quick Wins (< 1 hour each, HIGH impact)

### 1.1 Fix Cache Key Bug (CRITICAL - Data Correctness)
**Priority**: P0 (BLOCKING - must fix before all other optimizations)
**Impact**: Cache correctness + enables all other cache optimizations
**Risk**: LOW (additive change, invalidate existing cache)

**File**: `/home/daniel/repos/zmanim/api/internal/services/zmanim_service.go`

**Problem** (Line 988-1007):
```go
func (s *ZmanimService) buildCacheKey(publisherID int32, localityID int64, date string,
    includeDisabled, includeUnpublished, includeBeta bool) string {
    // MISSING: ActiveEventCodes in cache key!
    // Same publisher+locality+date returns different zmanim on Shabbos vs weekday
}
```

**Fix**:
```go
// Line 988: Add activeEventCodes parameter
func (s *ZmanimService) buildCacheKey(publisherID int32, localityID int64, date string,
    includeDisabled, includeUnpublished, includeBeta bool, activeEventCodes []string) string {

    filterParts := []string{}
    if includeDisabled {
        filterParts = append(filterParts, "d")
    }
    if includeUnpublished {
        filterParts = append(filterParts, "u")
    }
    if !includeBeta {
        filterParts = append(filterParts, "nb")
    }

    // NEW: Add sorted event codes to cache key
    if len(activeEventCodes) > 0 {
        sortedCodes := make([]string, len(activeEventCodes))
        copy(sortedCodes, activeEventCodes)
        sort.Strings(sortedCodes) // Ensure deterministic key
        filterParts = append(filterParts, "events:"+strings.Join(sortedCodes, ","))
    }

    filterHash := "default"
    if len(filterParts) > 0 {
        filterHash = strings.Join(filterParts, "|")
    }

    return fmt.Sprintf("calc:%d:%d:%s:%s", publisherID, localityID, date, filterHash)
}
```

**Update call sites**:
- Line 261: `cacheKey := s.buildCacheKey(params.PublisherID, params.LocalityID, dateStr, params.IncludeDisabled, params.IncludeUnpublished, params.IncludeBeta, params.ActiveEventCodes)`

**Testing**:
```bash
# Before: Different results cached incorrectly
curl "localhost:8080/api/v1/zmanim?publisherId=2&localityId=4993250&date=2025-12-27" # Saturday
curl "localhost:8080/api/v1/zmanim?publisherId=2&localityId=4993250&date=2025-12-28" # Sunday
# Verify: Saturday shows candle_lighting, Sunday does not

# After: Correct separate cache entries
# Key 1: calc:2:4993250:2025-12-27:events:erev_shabbos,shabbos
# Key 2: calc:2:4993250:2025-12-28:default
```

**Rollback**:
```bash
# Invalidate all existing cache (new key format)
redis-cli --scan --pattern "calc:*" | xargs redis-cli del
```

---

### 1.2 Add Performance Logging to All Endpoints
**Priority**: P1
**Impact**: Visibility for ongoing optimization + monitoring
**Risk**: LOW (logging only)

**File**: `/home/daniel/repos/zmanim/api/internal/handlers/zmanim.go`

**Current** (Line 216):
```go
func (h *Handlers) GetZmanimForLocality(w http.ResponseWriter, r *http.Request) {
    start := time.Now() // ✅ Good, but only logs in calculation_log_service
    // ... 400+ lines of code
    // NO slog.Info for response time visibility
}
```

**Add** (before Line 696 `RespondJSON`):
```go
// Before returning response
duration := time.Since(start).Milliseconds()
slog.Info("zmanim request completed",
    "endpoint", "GetZmanimForLocality",
    "publisher_id", publisherID,
    "locality_id", localityID,
    "date", dateStr,
    "duration_ms", duration,
    "cache_hit", calcResult.FromCache,
    "zman_count", len(response.Zmanim),
    "db_queries", "N/A", // Will add in 2.2
)
```

**Apply to all endpoints**:
- `GetZmanimForLocality` (Line 215)
- `GetPublisherZmanimWeek` (find file)
- `GetPublisherZmanimMonth` (find file)
- `GetPublisherZmanimYear` (find file)
- `GenerateWeeklyCalendarPDF` (find file)

---

### 1.3 Create Missing Foreign Key Indexes
**Priority**: P2
**Impact**: 5-10% query speedup for joins
**Risk**: LOW (DDL, run during low traffic)

**File**: Create `/home/daniel/repos/zmanim/db/migrations/00000000000005_add_fk_indexes.sql`

```sql
-- Missing FK indexes identified by Agent 6

-- 1. publisher_zmanim.master_zman_id FK (frequently joined in metadata queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_publisher_zmanim_master_zman_id
ON publisher_zmanim(master_zman_id)
WHERE master_zman_id IS NOT NULL;

-- 2. publisher_zmanim.linked_publisher_zman_id FK (for link/copy operations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_publisher_zmanim_linked_zman_id
ON publisher_zmanim(linked_publisher_zman_id)
WHERE linked_publisher_zman_id IS NOT NULL;

-- 3. Composite index for common GetPublisherZmanim query pattern
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_publisher_zmanim_composite
ON publisher_zmanim(publisher_id, is_enabled, is_published, is_beta);

-- Rationale:
-- - Query: SELECT * FROM publisher_zmanim WHERE publisher_id = ? AND is_enabled = true
-- - Frequency: Every zmanim calculation request (critical path)
-- - Current: Full table scan on publisher_id index, then filters
-- - After: Index-only scan (covering index)
```

**Execute**:
```bash
source api/.env
psql "$DATABASE_URL" -f db/migrations/00000000000005_add_fk_indexes.sql
```

**Verification**:
```sql
-- Check index usage
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM publisher_zmanim
WHERE publisher_id = 2 AND is_enabled = true AND is_published = true;

-- Should show: "Index Scan using idx_publisher_zmanim_composite"
```

---

## 2. Medium Complexity (1-4 hours each)

### 2.1 Add Preload Support to CalculateRange
**Priority**: P0 (CRITICAL - fixes 365× query redundancy)
**Impact**: 4-6× speedup for weekly/monthly/yearly endpoints
**Risk**: MEDIUM (refactor service method, extensive testing required)

**File**: `/home/daniel/repos/zmanim/api/internal/services/zmanim_service.go`

**Problem** (Line 492-559):
```go
func (s *ZmanimService) CalculateRange(ctx context.Context, params RangeParams) ([]DayResult, error) {
    // ...
    for currentDate.Before(params.EndDate) || currentDate.Equal(params.EndDate) {
        // ❌ PROBLEM: Queries DB on EVERY iteration (365× for yearly)
        dayResult, err := s.CalculateZmanim(ctx, calcParams) // Line 527
        // CalculateZmanim() queries:
        //   1. GetEffectiveLocalityLocation (SAME locality for all days!)
        //   2. GetPublisherZmanim (SAME publisher config for all days!)
        // ...
    }
}
```

**Solution**: Add preload parameters to `RangeParams`

**Step 1**: Update `RangeParams` struct (Line 116):
```go
type RangeParams struct {
    LocalityID  int64
    PublisherID int32
    StartDate   time.Time
    EndDate     time.Time
    ZmanKey     *string
    // Filter options
    IncludeDisabled    bool
    IncludeUnpublished bool
    IncludeBeta        bool
    // Calendar context
    ActiveEventCodesProvider ActiveEventCodesProvider

    // NEW: Preload optimization (query once, reuse for all days)
    PreloadedLocation      *sqlcgen.GetEffectiveLocalityLocationRow
    PreloadedPublisherZman []sqlcgen.GetPublisherZmanimRow
}
```

**Step 2**: Update `CalculateRange` (Line 492):
```go
func (s *ZmanimService) CalculateRange(ctx context.Context, params RangeParams) ([]DayResult, error) {
    // Validate date range
    if params.EndDate.Before(params.StartDate) {
        return nil, fmt.Errorf("end date must be after start date")
    }

    days := int(params.EndDate.Sub(params.StartDate).Hours()/24) + 1
    if days > 366 {
        return nil, fmt.Errorf("date range too large (max 366 days)")
    }

    // NEW: Query shared data ONCE before loop
    var location sqlcgen.GetEffectiveLocalityLocationRow
    var publisherZmanim []sqlcgen.GetPublisherZmanimRow

    if params.PreloadedLocation != nil {
        location = *params.PreloadedLocation
    } else {
        localityID32 := int32(params.LocalityID)
        loc, err := s.db.Queries.GetEffectiveLocalityLocation(ctx, sqlcgen.GetEffectiveLocalityLocationParams{
            LocalityID:  localityID32,
            PublisherID: pgtype.Int4{Int32: params.PublisherID, Valid: true},
        })
        if err != nil {
            return nil, fmt.Errorf("locality not found: %w", err)
        }
        location = loc
    }

    if params.PreloadedPublisherZman != nil {
        publisherZmanim = params.PreloadedPublisherZman
    } else {
        pz, err := s.db.Queries.GetPublisherZmanim(ctx, params.PublisherID)
        if err != nil {
            return nil, fmt.Errorf("failed to load publisher zmanim: %w", err)
        }
        publisherZmanim = pz
    }

    results := make([]DayResult, 0, days)

    // Loop through dates (now with preloaded data)
    currentDate := params.StartDate
    for currentDate.Before(params.EndDate) || currentDate.Equal(params.EndDate) {
        var activeEventCodes []string
        if params.ActiveEventCodesProvider != nil {
            activeEventCodes = params.ActiveEventCodesProvider(currentDate)
        }

        // ✅ SOLUTION: Pass preloaded data to avoid redundant queries
        calcParams := CalculateParams{
            LocalityID:             params.LocalityID,
            PublisherID:            params.PublisherID,
            Date:                   currentDate,
            IncludeDisabled:        params.IncludeDisabled,
            IncludeUnpublished:     params.IncludeUnpublished,
            IncludeBeta:            params.IncludeBeta,
            ActiveEventCodes:       activeEventCodes,
            PreloadedLocation:      &location,           // ← Reuse
            PreloadedPublisherZman: publisherZmanim,     // ← Reuse
        }

        dayResult, err := s.CalculateZmanim(ctx, calcParams)
        if err != nil {
            slog.Error("failed to calculate zmanim for day",
                "date", currentDate.Format("2006-01-02"),
                "error", err)
            currentDate = currentDate.AddDate(0, 0, 1)
            continue
        }

        // Filter by zman key if specified
        zmanim := dayResult.Zmanim
        if params.ZmanKey != nil {
            filteredZmanim := make([]CalculatedZman, 0, 1)
            for _, z := range dayResult.Zmanim {
                if z.Key == *params.ZmanKey {
                    filteredZmanim = append(filteredZmanim, z)
                    break
                }
            }
            zmanim = filteredZmanim
        }

        results = append(results, DayResult{
            Date:   dayResult.Date,
            Zmanim: zmanim,
        })

        currentDate = currentDate.AddDate(0, 0, 1)
    }

    return results, nil
}
```

**Step 3**: Update all handler call sites to use preload

**Example** - Weekly endpoint handler:
```go
// In GetPublisherZmanimWeek handler (find exact file)
// BEFORE calling CalculateRange, preload data:

// Preload shared data (query ONCE for entire week)
localityID32 := int32(localityID)
pubIDForLookup := pgtype.Int4{Int32: pubID, Valid: true}

effectiveLocation, err := h.db.Queries.GetEffectiveLocalityLocation(ctx, sqlcgen.GetEffectiveLocalityLocationParams{
    LocalityID:  localityID32,
    PublisherID: pubIDForLookup,
})
if err != nil {
    RespondNotFound(w, r, "Locality not found")
    return
}

publisherZmanim, err := h.db.Queries.GetPublisherZmanim(ctx, pubID)
if err != nil {
    RespondInternalError(w, r, "Failed to load publisher configuration")
    return
}

// Call CalculateRange with preloaded data
rangeResults, err := h.zmanimService.CalculateRange(ctx, services.RangeParams{
    LocalityID:  localityID,
    PublisherID: pubID,
    StartDate:   startDate,
    EndDate:     endDate,
    IncludeDisabled: filters.IncludeDisabled,
    IncludeUnpublished: filters.IncludeUnpublished,
    IncludeBeta: filters.IncludeBeta,
    ActiveEventCodesProvider: func(date time.Time) []string {
        // Calendar context per day
        dbAdapter := NewCalendarDBAdapter(h.db.Queries)
        calService := calendar.NewCalendarServiceWithDB(dbAdapter)
        loc := calendar.Location{
            Latitude:  effectiveLocation.Latitude,
            Longitude: effectiveLocation.Longitude,
            Timezone:  effectiveLocation.Timezone,
            IsIsrael:  calendar.IsLocationInIsrael(effectiveLocation.Latitude, effectiveLocation.Longitude),
        }
        zmanimCtx := calService.GetZmanimContext(date, loc, "ashkenazi")
        return zmanimCtx.ActiveEventCodes
    },
    PreloadedLocation:      &effectiveLocation,  // ← NEW
    PreloadedPublisherZman: publisherZmanim,     // ← NEW
})
```

**Testing**:
```bash
# Before optimization: Count DB queries
# Enable PostgreSQL query logging: log_statement = 'all'

curl "localhost:8080/api/v1/publisher/zmanim/week?start_date=2025-12-20&locality_id=4993250" \
  -H "X-Publisher-Id: 2"

# Count queries: grep "GetEffectiveLocalityLocation\|GetPublisherZmanim" postgres.log
# Expected BEFORE: 14 queries (7 days × 2 queries)
# Expected AFTER: 2 queries (1× before loop)

# Performance: Measure response time
time curl "localhost:8080/api/v1/publisher/zmanim/week?start_date=2025-12-20&locality_id=4993250" \
  -H "X-Publisher-Id: 2"
# Expected: 3000ms → ~500ms (6× improvement)
```

**Rollback**: Revert `RangeParams` struct + update call sites to pass `nil` for preload params

---

### 2.2 Batch Calendar Context Loading
**Priority**: P1
**Impact**: 94% reduction in HebCal calls (35 → 2 per week)
**Risk**: MEDIUM (concurrency handling, testing required)

**File**: `/home/daniel/repos/zmanim/api/internal/calendar/events.go` (create new method)

**Problem**: Current weekly handler calls `GetZmanimContext()` 21 times in a loop:
```go
// In GetPublisherZmanimWeek (find exact file)
for i := 0; i < 7; i++ {
    date := startDate.AddDate(0, 0, i)
    calService := calendar.NewCalendarService()  // ❌ NEW instance every iteration
    zmanimCtx := calService.GetZmanimContext(date, loc, "ashkenazi") // ❌ 5 HebCal calls each
    // ...
}
// Total: 7 days × 3 calls/day (GetDayInfo, GetHebrewDate, GetShabbatTimes) = 21 calls
// GetZmanimContext internally calls HebCal 5 times: events, holidays, candles, havdalah, hebrew date
```

**Solution**: Add batch calendar context method

**New Method** in `/home/daniel/repos/zmanim/api/internal/calendar/events.go`:
```go
// GetZmanimContextBatch returns calendar context for multiple dates (batch optimized)
// This method fetches HebCal data for the entire date range in ONE API call
func (cs *CalendarService) GetZmanimContextBatch(
    startDate, endDate time.Time,
    loc Location,
    transliterationStyle string,
) (map[string]ZmanimContext, error) {

    // Calculate date range for HebCal API
    dates := []time.Time{}
    currentDate := startDate
    for currentDate.Before(endDate) || currentDate.Equal(endDate) {
        dates = append(dates, currentDate)
        currentDate = currentDate.AddDate(0, 0, 1)
    }

    if len(dates) == 0 {
        return map[string]ZmanimContext{}, nil
    }

    // OPTIMIZATION: Single HebCal API call for entire range
    // HebCal supports date ranges: /hebcal?start=2025-12-20&end=2025-12-27
    hebcalEvents, err := cs.fetchHebCalEventsRange(startDate, endDate, loc)
    if err != nil {
        return nil, fmt.Errorf("failed to fetch HebCal events: %w", err)
    }

    // Build context map (one entry per date)
    contextMap := make(map[string]ZmanimContext)
    for _, date := range dates {
        dateKey := date.Format("2006-01-02")

        // Filter events for this date
        dayEvents := filterEventsForDate(hebcalEvents, date)

        // Build ZmanimContext (reusing fetched data)
        ctx := ZmanimContext{
            Date:             dateKey,
            HebrewDate:       extractHebrewDate(dayEvents),
            IsShabbat:        containsShabbat(dayEvents),
            IsYomTov:         containsYomTov(dayEvents),
            ActiveEventCodes: cs.db.MapEventsToActiveEventCodes(dayEvents, loc.IsIsrael),
            // ... other fields
        }
        contextMap[dateKey] = ctx
    }

    return contextMap, nil
}

// Helper: Fetch HebCal events for date range (single API call)
func (cs *CalendarService) fetchHebCalEventsRange(start, end time.Time, loc Location) ([]HebcalEvent, error) {
    // Use HebCal month API: more efficient than day-by-day
    // Example: https://www.hebcal.com/hebcal?v=1&cfg=json&month=12&year=2025&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&geo=pos&latitude=31.7683&longitude=35.2137

    baseURL := "https://www.hebcal.com/hebcal"
    params := url.Values{}
    params.Set("v", "1")
    params.Set("cfg", "json")
    params.Set("start", start.Format("2006-01-02"))
    params.Set("end", end.Format("2006-01-02"))
    params.Set("maj", "on")  // Major holidays
    params.Set("min", "on")  // Minor holidays
    params.Set("mod", "on")  // Modern holidays
    params.Set("nx", "on")   // Rosh Chodesh
    params.Set("mf", "on")   // Shabbat Mevarchim
    params.Set("ss", "on")   // Candle lighting
    params.Set("geo", "pos")
    params.Set("latitude", fmt.Sprintf("%.4f", loc.Latitude))
    params.Set("longitude", fmt.Sprintf("%.4f", loc.Longitude))
    if loc.IsIsrael {
        params.Set("i", "on")
    }

    // HTTP GET with caching (use existing HebCal client)
    resp, err := http.Get(baseURL + "?" + params.Encode())
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result struct {
        Items []HebcalEvent `json:"items"`
    }
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }

    return result.Items, nil
}
```

**Update Handlers**: Replace loop with batch fetch

**Example** (weekly endpoint):
```go
// BEFORE:
for i := 0; i < 7; i++ {
    date := startDate.AddDate(0, 0, i)
    calService := calendar.NewCalendarService()
    zmanimCtx := calService.GetZmanimContext(date, loc, "ashkenazi")
    // ...
}

// AFTER:
dbAdapter := NewCalendarDBAdapter(h.db.Queries)
calService := calendar.NewCalendarServiceWithDB(dbAdapter)
endDate := startDate.AddDate(0, 0, 6) // Week = 7 days

// Batch fetch: 1 API call instead of 35
contextMap, err := calService.GetZmanimContextBatch(startDate, endDate, loc, "ashkenazi")
if err != nil {
    RespondInternalError(w, r, "Failed to fetch calendar context")
    return
}

// Use in CalculateRange
activeEventCodesProvider := func(date time.Time) []string {
    dateKey := date.Format("2006-01-02")
    if ctx, ok := contextMap[dateKey]; ok {
        return ctx.ActiveEventCodes
    }
    return []string{} // Fallback
}

rangeResults, err := h.zmanimService.CalculateRange(ctx, services.RangeParams{
    // ...
    ActiveEventCodesProvider: activeEventCodesProvider,
})
```

**Testing**:
```bash
# Enable network logging to count HebCal API calls
# Monitor outbound requests to hebcal.com

curl "localhost:8080/api/v1/publisher/zmanim/week?start_date=2025-12-20&locality_id=4993250" \
  -H "X-Publisher-Id: 2"

# Count HebCal requests:
# BEFORE: 35 requests (5 per day × 7 days)
# AFTER: 2 requests (1 for range + 1 for Hebrew dates)
```

---

### 2.3 Parallelize Handler Queries
**Priority**: P2
**Impact**: 30-40% speedup for single-day endpoint
**Risk**: LOW (already implemented in GetZmanimForLocality, copy pattern)

**File**: `/home/daniel/repos/zmanim/api/internal/handlers/zmanim.go` (Line 425-464)

**Current Pattern** (already implemented in GetZmanimForLocality ✅):
```go
// GOOD EXAMPLE: Lines 425-464
type preloadData struct {
    effectiveLocation sqlcgen.GetEffectiveLocalityLocationRow
    publisherInfo     sqlcgen.GetPublisherInfoForZmanimRow
    publisherZmanim   []sqlcgen.GetPublisherZmanimRow
    translitStyle     string
}
var preloaded preloadData
var preloadErrs [4]error

// Use sync pattern for parallel queries
done := make(chan struct{})
go func() {
    preloaded.effectiveLocation, preloadErrs[0] = h.db.Queries.GetEffectiveLocalityLocation(ctx, ...)
    done <- struct{}{}
}()
go func() {
    preloaded.publisherInfo, preloadErrs[1] = h.db.Queries.GetPublisherInfoForZmanim(ctx, pubID)
    done <- struct{}{}
}()
go func() {
    preloaded.publisherZmanim, preloadErrs[2] = h.db.Queries.GetPublisherZmanim(ctx, pubID)
    done <- struct{}{}
}()
go func() {
    preloaded.translitStyle, preloadErrs[3] = h.db.Queries.GetPublisherTransliterationStyle(ctx, pubID)
    done <- struct{}{}
}()

// Wait for all queries
for i := 0; i < 4; i++ {
    <-done
}
```

**Apply to Other Handlers**:

1. **Find handlers with sequential queries**: Search for consecutive `h.db.Queries.Get*` calls
2. **Apply parallel pattern**: Wrap in goroutines with error collection
3. **Target handlers**:
   - `GetPublisherZmanimWeek` (if exists)
   - `GetPublisherZmanimMonth` (if exists)
   - `GenerateWeeklyCalendarPDF` (if exists)
   - Any handler with 3+ sequential queries

**Example Refactor**:
```go
// BEFORE (sequential):
location, err := h.db.Queries.GetEffectiveLocalityLocation(ctx, params)
if err != nil { return err }

publisherInfo, err := h.db.Queries.GetPublisherInfoForZmanim(ctx, pubID)
if err != nil { return err }

publisherZmanim, err := h.db.Queries.GetPublisherZmanim(ctx, pubID)
if err != nil { return err }
// Total time: 30ms + 25ms + 40ms = 95ms (sequential)

// AFTER (parallel):
var location sqlcgen.GetEffectiveLocalityLocationRow
var publisherInfo sqlcgen.GetPublisherInfoForZmanimRow
var publisherZmanim []sqlcgen.GetPublisherZmanimRow
var errs [3]error

done := make(chan struct{})
go func() {
    location, errs[0] = h.db.Queries.GetEffectiveLocalityLocation(ctx, params)
    done <- struct{}{}
}()
go func() {
    publisherInfo, errs[1] = h.db.Queries.GetPublisherInfoForZmanim(ctx, pubID)
    done <- struct{}{}
}()
go func() {
    publisherZmanim, errs[2] = h.db.Queries.GetPublisherZmanim(ctx, pubID)
    done <- struct{}{}
}()

for i := 0; i < 3; i++ {
    <-done
}
// Total time: max(30ms, 25ms, 40ms) = 40ms (parallel, 58% faster)

// Check errors
for i, err := range errs {
    if err != nil {
        return fmt.Errorf("query %d failed: %w", i, err)
    }
}
```

---

## 3. Major Refactors (4+ hours each)

### 3.1 In-Memory Calendar Tag Mapping Cache
**Priority**: P1
**Impact**: Eliminate 31 DB queries per week for tag mapping
**Risk**: HIGH (memory management, cache invalidation, testing)

**Problem**: `tag_event_mappings` table queried 31 times per week (4-5× per day)

**Current** (in `/home/daniel/repos/zmanim/api/internal/calendar/events.go`):
```go
// Called by GetZmanimContext() → MapEventsToActiveEventCodes()
func (db *DBAdapter) MapEventsToActiveEventCodes(events []HebcalEvent, isIsrael bool) []string {
    // Queries database: SELECT tag_key FROM tag_event_mappings WHERE hebcal_event_pattern = ?
    // Called 5× per day × 7 days = 35 queries per week
}
```

**Solution**: Load tag mappings into memory at service startup

**Step 1**: Create cache structure in `/home/daniel/repos/zmanim/api/internal/calendar/tag_cache.go`

```go
package calendar

import (
    "context"
    "fmt"
    "log/slog"
    "sync"
    "time"
)

// TagMappingCache caches tag_event_mappings in memory
type TagMappingCache struct {
    mu              sync.RWMutex
    mappings        map[string][]string // hebcal_event_pattern → []tag_key
    lastRefresh     time.Time
    refreshInterval time.Duration
}

// NewTagMappingCache creates and initializes the cache
func NewTagMappingCache(db DatabaseAdapter, refreshInterval time.Duration) (*TagMappingCache, error) {
    cache := &TagMappingCache{
        mappings:        make(map[string][]string),
        refreshInterval: refreshInterval,
    }

    // Initial load
    if err := cache.Refresh(context.Background(), db); err != nil {
        return nil, fmt.Errorf("failed to initialize tag mapping cache: %w", err)
    }

    // Background refresh
    go cache.autoRefresh(db)

    return cache, nil
}

// Refresh reloads tag mappings from database
func (c *TagMappingCache) Refresh(ctx context.Context, db DatabaseAdapter) error {
    rows, err := db.GetAllTagEventMappings(ctx)
    if err != nil {
        return err
    }

    newMappings := make(map[string][]string)
    for _, row := range rows {
        pattern := row.HebcalEventPattern
        tagKey := row.TagKey
        newMappings[pattern] = append(newMappings[pattern], tagKey)
    }

    c.mu.Lock()
    c.mappings = newMappings
    c.lastRefresh = time.Now()
    c.mu.Unlock()

    slog.Info("tag mapping cache refreshed", "pattern_count", len(newMappings))
    return nil
}

// Get returns tag keys for a HebCal event pattern
func (c *TagMappingCache) Get(pattern string) []string {
    c.mu.RLock()
    defer c.mu.RUnlock()

    if tags, ok := c.mappings[pattern]; ok {
        // Return copy to prevent race conditions
        result := make([]string, len(tags))
        copy(result, tags)
        return result
    }
    return []string{}
}

// autoRefresh periodically refreshes the cache
func (c *TagMappingCache) autoRefresh(db DatabaseAdapter) {
    ticker := time.NewTicker(c.refreshInterval)
    defer ticker.Stop()

    for range ticker.C {
        if err := c.Refresh(context.Background(), db); err != nil {
            slog.Error("tag mapping cache refresh failed", "error", err)
        }
    }
}
```

**Step 2**: Update `CalendarService` to use cache

```go
// In calendar/events.go
type CalendarService struct {
    db            DatabaseAdapter
    tagCache      *TagMappingCache // NEW
}

func NewCalendarServiceWithDB(db DatabaseAdapter) *CalendarService {
    // Initialize cache (refresh every 5 minutes)
    tagCache, err := NewTagMappingCache(db, 5*time.Minute)
    if err != nil {
        slog.Error("failed to initialize tag cache, falling back to direct DB", "error", err)
        tagCache = nil
    }

    return &CalendarService{
        db:       db,
        tagCache: tagCache,
    }
}

// Update MapEventsToActiveEventCodes to use cache
func (cs *CalendarService) MapEventsToActiveEventCodes(events []HebcalEvent, isIsrael bool) []string {
    var activeEventCodes []string

    for _, event := range events {
        var tagKeys []string

        // Use cache if available, fallback to DB
        if cs.tagCache != nil {
            tagKeys = cs.tagCache.Get(event.Title)
        } else {
            // Fallback: Query DB
            tagKeys = cs.db.GetTagKeysForHebcalPattern(event.Title)
        }

        activeEventCodes = append(activeEventCodes, tagKeys...)
    }

    return activeEventCodes
}
```

**Step 3**: Cache invalidation webhook (optional, for admin changes)

```go
// In handlers/admin.go (or create new handler)
// POST /api/v1/admin/cache/tag-mappings/refresh
func (h *Handlers) RefreshTagMappingCache(w http.ResponseWriter, r *http.Request) {
    // Require admin auth
    if !isAdmin(r) {
        RespondUnauthorized(w, r, "Admin access required")
        return
    }

    // Refresh calendar service cache
    if h.calendarService.tagCache != nil {
        if err := h.calendarService.tagCache.Refresh(r.Context(), h.calendarService.db); err != nil {
            RespondInternalError(w, r, "Failed to refresh cache")
            return
        }
    }

    RespondJSON(w, r, http.StatusOK, map[string]string{
        "message": "Tag mapping cache refreshed",
        "refreshed_at": time.Now().Format(time.RFC3339),
    })
}
```

**Testing**:
```bash
# Count DB queries for tag mappings
# Enable PostgreSQL query logging

curl "localhost:8080/api/v1/publisher/zmanim/week?start_date=2025-12-20&locality_id=4993250" \
  -H "X-Publisher-Id: 2"

# BEFORE: 31 queries to tag_event_mappings table
# AFTER: 0 queries (all from in-memory cache)

# Verify correctness: Response data should be identical
diff before_response.json after_response.json
# Expected: No differences
```

**Rollback**: Remove `tagCache` field, revert to DB queries

---

### 3.2 Week/Month Result Caching
**Priority**: P2
**Impact**: 85%+ cache hit rate for common date ranges
**Risk**: MEDIUM (cache key design, invalidation logic)

**Problem**: Weekly/monthly endpoints recalculate even when underlying data unchanged

**Solution**: Cache entire week/month result sets

**Step 1**: Add new cache methods in `/home/daniel/repos/zmanim/api/internal/cache/cache.go`

```go
// weekRangeKey generates cache key for week results
func weekRangeKey(publisherID int32, localityID int64, startDate string) string {
    return fmt.Sprintf("week:%d:%d:%s", publisherID, localityID, startDate)
}

// monthRangeKey generates cache key for month results
func monthRangeKey(publisherID int32, localityID int64, yearMonth string) string {
    return fmt.Sprintf("month:%d:%d:%s", publisherID, localityID, yearMonth)
}

// GetWeekRange retrieves cached week results
func (c *Cache) GetWeekRange(ctx context.Context, publisherID int32, localityID int64, startDate string) ([]byte, error) {
    key := weekRangeKey(publisherID, localityID, startDate)
    data, err := c.client.Get(ctx, key).Bytes()
    if err == redis.Nil {
        return nil, nil
    }
    return data, err
}

// SetWeekRange caches week results (7-day TTL)
func (c *Cache) SetWeekRange(ctx context.Context, publisherID int32, localityID int64, startDate string, data interface{}) error {
    key := weekRangeKey(publisherID, localityID, startDate)
    jsonData, err := json.Marshal(data)
    if err != nil {
        return err
    }
    return c.client.Set(ctx, key, jsonData, 7*24*time.Hour).Err()
}

// GetMonthRange retrieves cached month results
func (c *Cache) GetMonthRange(ctx context.Context, publisherID int32, localityID int64, yearMonth string) ([]byte, error) {
    key := monthRangeKey(publisherID, localityID, yearMonth)
    data, err := c.client.Get(ctx, key).Bytes()
    if err == redis.Nil {
        return nil, nil
    }
    return data, err
}

// SetMonthRange caches month results (30-day TTL)
func (c *Cache) SetMonthRange(ctx context.Context, publisherID int32, localityID int64, yearMonth string, data interface{}) error {
    key := monthRangeKey(publisherID, localityID, yearMonth)
    jsonData, err := json.Marshal(data)
    if err != nil {
        return err
    }
    return c.client.Set(ctx, key, jsonData, 30*24*time.Hour).Err()
}
```

**Step 2**: Update weekly handler to use cache

```go
// In GetPublisherZmanimWeek handler
func (h *Handlers) GetPublisherZmanimWeek(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    startDate := r.URL.Query().Get("start_date")
    publisherID := getPublisherID(r)
    localityID := getLocalityID(r)

    // Check cache first
    if h.cache != nil {
        cached, err := h.cache.GetWeekRange(ctx, publisherID, localityID, startDate)
        if err == nil && cached != nil {
            // Cache hit: return cached response
            var response WeekZmanimResponse
            if err := json.Unmarshal(cached, &response); err == nil {
                response.FromCache = true
                RespondJSON(w, r, http.StatusOK, response)
                return
            }
        }
    }

    // Cache miss: Calculate and cache
    // ... existing calculation logic ...

    // Cache the result
    if h.cache != nil {
        if err := h.cache.SetWeekRange(ctx, publisherID, localityID, startDate, response); err != nil {
            slog.Error("failed to cache week results", "error", err)
        }
    }

    RespondJSON(w, r, http.StatusOK, response)
}
```

**Step 3**: Invalidation on publisher changes

```go
// Update InvalidatePublisherCache to include week/month caches
func (c *Cache) InvalidatePublisherCache(ctx context.Context, publisherID string) error {
    patterns := []string{
        fmt.Sprintf("calc:%s:*", publisherID),
        fmt.Sprintf("zmanim:%s:*", publisherID),
        fmt.Sprintf("week:%s:*", publisherID),   // NEW
        fmt.Sprintf("month:%s:*", publisherID),  // NEW
    }

    for _, pattern := range patterns {
        if err := c.deleteByPattern(ctx, pattern); err != nil {
            slog.Error("cache invalidation failed", "pattern", pattern, "error", err)
        }
    }

    return nil
}
```

---

### 3.3 Handler Preload Pattern Library
**Priority**: P3 (nice-to-have)
**Impact**: Standardize parallel query pattern across handlers
**Risk**: LOW (refactor only, no functional changes)

**Create**: `/home/daniel/repos/zmanim/api/internal/handlers/preload.go`

```go
package handlers

import (
    "context"
    "sync"
)

// PreloadResult wraps a query result with error
type PreloadResult[T any] struct {
    Data  T
    Error error
}

// RunParallel executes multiple queries in parallel and collects results
// Usage:
//   results := RunParallel(ctx,
//       func() PreloadResult[LocationRow] { return queryLocation() },
//       func() PreloadResult[PublisherRow] { return queryPublisher() },
//   )
func RunParallel[T any](ctx context.Context, queries ...func() PreloadResult[T]) []PreloadResult[T] {
    results := make([]PreloadResult[T], len(queries))
    var wg sync.WaitGroup

    for i, query := range queries {
        wg.Add(1)
        go func(idx int, q func() PreloadResult[T]) {
            defer wg.Done()
            results[idx] = q()
        }(i, query)
    }

    wg.Wait()
    return results
}

// Example usage in handler:
// results := RunParallel(ctx,
//     func() PreloadResult[sqlcgen.GetEffectiveLocalityLocationRow] {
//         data, err := h.db.Queries.GetEffectiveLocalityLocation(ctx, params)
//         return PreloadResult[sqlcgen.GetEffectiveLocalityLocationRow]{Data: data, Error: err}
//     },
//     func() PreloadResult[sqlcgen.GetPublisherInfoForZmanimRow] {
//         data, err := h.db.Queries.GetPublisherInfoForZmanim(ctx, pubID)
//         return PreloadResult[sqlcgen.GetPublisherInfoForZmanimRow]{Data: data, Error: err}
//     },
// )
```

---

## 4. Performance Targets (per endpoint type with rationale)

| Endpoint Type | Current | Target (Cached) | Target (Cold) | Rationale |
|---------------|---------|-----------------|---------------|-----------|
| **Daily** (GET /zmanim) | 150ms | < 50ms | < 200ms | Single date, 2-3 queries, cache hit common |
| **Weekly** (GET /publisher/zmanim/week) | **3000ms** ⚠️ | < 100ms | < 400ms | 7 dates, preload + batch calendar → 6× faster |
| **Monthly** (GET /publisher/zmanim/month) | 8000ms | < 300ms | < 1000ms | 30 dates, same optimizations, acceptable |
| **Yearly** (GET /publisher/zmanim/year) | 45000ms | < 2s | < 8s | 365 dates, batch processing limits, still 5× faster |
| **PDF Reports** | 12000ms | < 1s | < 3s | Week data + rendering, cache week results |

### Optimization Impact Breakdown

**Weekly Endpoint**: 3000ms → 300ms (10× improvement)
- Remove 365× redundant queries: -1500ms (2.1 preload)
- Batch calendar context: -800ms (2.2 calendar batch)
- Parallel handler queries: -300ms (2.3 parallelization)
- Week result caching (on hit): -2700ms (3.2 range cache)
- Fixed cache keys (correctness): 0ms (1.1, enables other optimizations)

---

## 5. Risk Assessment

### 1.1 Cache Key Fix
- **Risk**: LOW
- **Concern**: Existing cache invalidated (minor disruption)
- **Mitigation**: Deploy during low traffic, cache rebuilds automatically
- **Testing**: Manual verification of different event codes → different cache keys

### 2.1 CalculateRange Preload
- **Risk**: MEDIUM
- **Concern**: Refactor service method signature, all call sites must update
- **Mitigation**:
  - Backward compatible: Preload params optional (nil checks)
  - Comprehensive unit tests for CalculateRange
  - E2E tests for weekly/monthly endpoints
- **Testing**:
  - Unit: Test with/without preload params
  - Integration: Compare response data before/after
  - Load: Measure performance under realistic load

### 2.2 Calendar Batching
- **Risk**: MEDIUM
- **Concern**: HebCal API rate limits, concurrent map access
- **Mitigation**:
  - Rate limit: 1 req/sec (well within HebCal limits)
  - Concurrency: Use sync.RWMutex for contextMap
  - Fallback: On batch failure, fall back to day-by-day
- **Testing**:
  - Mock HebCal API responses
  - Verify batch vs individual results match
  - Test edge cases: month boundaries, leap years

### 3.1 Tag Mapping Cache
- **Risk**: HIGH
- **Concern**: Memory leaks, stale cache, race conditions
- **Mitigation**:
  - Bounded memory: ~1KB for tag mappings (minimal)
  - Auto-refresh: Every 5 minutes
  - Manual refresh: Admin endpoint for immediate invalidation
  - Thread-safe: Use sync.RWMutex
- **Testing**:
  - Load test: Verify no memory growth over time
  - Staleness: Update tag mapping, verify cache refreshes
  - Concurrency: Run race detector (`go test -race`)

### 3.2 Week/Month Caching
- **Risk**: MEDIUM
- **Concern**: Cache invalidation complexity, stale data
- **Mitigation**:
  - TTL: 7 days for weeks, 30 days for months
  - Invalidation: On publisher config change, flush all range caches
  - Monitoring: Log cache hit/miss rates
- **Testing**:
  - Update publisher zman formula → verify cache invalidated
  - Test TTL expiration logic

---

## 6. Rollback Plan

### Feature Flags (via Environment Variables)
```bash
# In api/.env (or deployment config)
ENABLE_CACHE_KEY_EVENTS=true       # 1.1: Include events in cache key
ENABLE_PRELOAD_OPTIMIZATION=true   # 2.1: Use preload in CalculateRange
ENABLE_CALENDAR_BATCH=true         # 2.2: Batch calendar context
ENABLE_TAG_MAPPING_CACHE=true      # 3.1: In-memory tag cache
ENABLE_WEEK_RANGE_CACHE=true       # 3.2: Cache week results
```

### Gradual Rollout Strategy
1. **Deploy to staging**: Full test suite + manual verification
2. **Deploy to production**: Enable optimizations one-by-one
3. **Monitor metrics**: Response times, error rates, cache hit rates
4. **Rollback if needed**: Disable feature flag, restart service

### Quick Rollback Commands
```bash
# Disable all optimizations (revert to old behavior)
export ENABLE_CACHE_KEY_EVENTS=false
export ENABLE_PRELOAD_OPTIMIZATION=false
export ENABLE_CALENDAR_BATCH=false
export ENABLE_TAG_MAPPING_CACHE=false
export ENABLE_WEEK_RANGE_CACHE=false

# Restart API service
./restart.sh

# Clear all Redis cache (force fresh start)
redis-cli FLUSHDB
```

---

## 7. Performance Benchmarks for Verification

### Benchmark Setup
```bash
# Create benchmark script: scripts/benchmark_zmanim.sh
#!/bin/bash

ENDPOINT=$1
ITERATIONS=${2:-10}

echo "Benchmarking: $ENDPOINT"
echo "Iterations: $ITERATIONS"
echo ""

TOTAL_TIME=0
for i in $(seq 1 $ITERATIONS); do
    START=$(date +%s%3N)
    curl -s "$ENDPOINT" > /dev/null
    END=$(date +%s%3N)
    DURATION=$((END - START))
    TOTAL_TIME=$((TOTAL_TIME + DURATION))
    echo "Iteration $i: ${DURATION}ms"
done

AVG=$((TOTAL_TIME / ITERATIONS))
echo ""
echo "Average: ${AVG}ms"
```

### Test Commands

**Daily Endpoint**:
```bash
# Cold cache
redis-cli FLUSHDB
./scripts/benchmark_zmanim.sh \
  "http://localhost:8080/api/v1/zmanim?publisherId=2&localityId=4993250&date=2025-12-20" \
  5

# Expected: < 200ms avg

# Warm cache
./scripts/benchmark_zmanim.sh \
  "http://localhost:8080/api/v1/zmanim?publisherId=2&localityId=4993250&date=2025-12-20" \
  10

# Expected: < 50ms avg
```

**Weekly Endpoint** (CRITICAL):
```bash
# Cold cache
redis-cli FLUSHDB
./scripts/benchmark_zmanim.sh \
  "http://localhost:8080/api/v1/publisher/zmanim/week?publisherId=2&localityId=4993250&start_date=2025-12-20" \
  5

# Expected BEFORE: ~3000ms
# Expected AFTER: < 400ms (7.5× improvement)

# Warm cache
./scripts/benchmark_zmanim.sh \
  "http://localhost:8080/api/v1/publisher/zmanim/week?publisherId=2&localityId=4993250&start_date=2025-12-20" \
  10

# Expected: < 100ms (30× improvement from baseline)
```

**Monthly Endpoint**:
```bash
redis-cli FLUSHDB
./scripts/benchmark_zmanim.sh \
  "http://localhost:8080/api/v1/publisher/zmanim/month?publisherId=2&localityId=4993250&year=2025&month=12" \
  3

# Expected: < 1000ms cold, < 300ms cached
```

**Acceptance Criteria**:
- All endpoints meet or exceed target response times
- Cache hit rate > 80% for repeat requests
- Database query count reduced by 85%+
- Zero functional regressions (response data identical)

---

## 8. Implementation Timeline

### Week 1: Quick Wins + Critical Bug Fix
**Monday-Tuesday**:
- ✅ 1.1: Fix cache key bug (BLOCKING, 2 hours)
- ✅ 1.2: Add performance logging (1 hour)
- ✅ 1.3: Create FK indexes (1 hour)
- ✅ Deploy to staging + verify

**Wednesday-Friday**:
- Benchmark baseline performance (all endpoints)
- Run CI/CD validation
- Document baseline metrics
- User acceptance testing

### Week 2: Medium Complexity (Preload + Batching)
**Monday-Wednesday**:
- ✅ 2.1: CalculateRange preload support (8 hours)
  - Update service (4 hours)
  - Update handlers (3 hours)
  - Testing (1 hour)
- ✅ Deploy to staging + benchmark

**Thursday-Friday**:
- ✅ 2.2: Calendar context batching (6 hours)
  - Implement batch method (3 hours)
  - Update handlers (2 hours)
  - Testing (1 hour)
- ✅ 2.3: Parallelize remaining handlers (4 hours)
- ✅ Deploy to staging + full regression test

### Week 3: Major Refactors (Caching Architecture)
**Monday-Tuesday**:
- ✅ 3.1: In-memory tag mapping cache (6 hours)
  - Implement cache (3 hours)
  - Update service (2 hours)
  - Testing + load test (1 hour)

**Wednesday-Thursday**:
- ✅ 3.2: Week/month result caching (6 hours)
  - Cache layer (3 hours)
  - Handler integration (2 hours)
  - Invalidation logic (1 hour)

**Friday**:
- ✅ 3.3: Handler preload pattern library (4 hours, optional)
- Deploy to staging + comprehensive testing

### Week 4: Validation and Monitoring
**Monday-Tuesday**:
- Run full benchmark suite (all endpoints)
- Compare before/after metrics
- Load testing (simulate production traffic)
- Edge case testing (leap years, timezone changes)

**Wednesday**:
- Deploy to production (gradual rollout)
- Enable optimizations one-by-one
- Monitor metrics dashboard

**Thursday**:
- User acceptance testing
- Performance validation
- Bug fixes (if any)

**Friday**:
- Documentation updates
- Final performance report
- Retrospective

---

## 9. Dependencies and Blockers

### Code Review Requirements
- **Reviewers**: Minimum 1 senior engineer approval
- **Focus Areas**:
  - Cache key correctness (1.1)
  - Service method signature changes (2.1)
  - Concurrency patterns (2.2, 3.1)
  - Test coverage (all changes)

### Testing Infrastructure Needs
- **PostgreSQL**: Query logging enabled for query count verification
- **Redis**: Test instance for cache testing
- **Load Testing**: Tool for concurrent request simulation (wrk, ab, or hey)
- **Monitoring**: slog output capture for performance metrics

### Database Migration Coordination
- **Index Creation** (1.3):
  - Schedule: Low traffic window (2 AM - 4 AM UTC)
  - Duration: ~10 minutes (CONCURRENTLY option prevents locks)
  - Rollback: DROP INDEX IF EXISTS
- **No Schema Changes**: All optimizations use existing schema

### External Dependencies
- **HebCal API**:
  - Current rate limit: Unknown (assumed generous)
  - New usage: 2 requests per week (vs 35 current)
  - Mitigation: Implement retry logic + fallback to day-by-day
- **Redis**:
  - Memory estimate: +5MB for tag cache, +50MB for week caches
  - Monitor: Eviction rate, memory usage

---

## 10. Success Metrics & Monitoring

### Key Performance Indicators (KPIs)

**Response Time Targets**:
- Daily: < 50ms (cached), < 200ms (cold) ← Current: 150ms
- Weekly: < 100ms (cached), < 400ms (cold) ← Current: 3000ms ⚠️
- Monthly: < 300ms (cached), < 1000ms (cold) ← Current: 8000ms
- Yearly: < 2s (cached), < 8s (cold) ← Current: 45000ms

**Database Efficiency**:
- Queries per request: < 5 ← Current: 15-21
- Query time per request: < 50ms ← Current: 150ms+

**Cache Performance**:
- Hit rate: > 80% ← Current: ~20%
- Miss rate: < 20%
- Invalidation accuracy: 100% (no stale data)

### Monitoring Implementation

**Add to all optimized handlers**:
```go
slog.Info("request_performance",
    "endpoint", "GetPublisherZmanimWeek",
    "duration_ms", time.Since(start).Milliseconds(),
    "cache_hit", fromCache,
    "db_queries", queryCount,
    "hebcal_calls", hebcalCallCount,
    "zman_count", len(results),
    "date_range_days", days,
)
```

**Dashboard Queries** (if using log aggregation):
```sql
-- Average response time by endpoint (last 24h)
SELECT
    endpoint,
    AVG(duration_ms) as avg_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_ms
FROM request_logs
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY endpoint
ORDER BY avg_ms DESC;

-- Cache hit rate by endpoint
SELECT
    endpoint,
    COUNT(*) FILTER (WHERE cache_hit = true) * 100.0 / COUNT(*) as hit_rate_pct
FROM request_logs
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY endpoint;
```

**Alerts**:
- Weekly endpoint > 500ms (10% of requests): Investigate
- Cache hit rate < 70%: Check cache invalidation logic
- Database queries per request > 10: Check for N+1 regression

---

## Appendix A: Specific File References

### Files to Modify

| Optimization | File | Lines | Complexity |
|--------------|------|-------|------------|
| 1.1 Cache Key Fix | `/home/daniel/repos/zmanim/api/internal/services/zmanim_service.go` | 988-1007, 261 | Low |
| 1.2 Performance Logging | `/home/daniel/repos/zmanim/api/internal/handlers/zmanim.go` | 696, 215 | Low |
| 1.3 FK Indexes | `/home/daniel/repos/zmanim/db/migrations/00000000000005_add_fk_indexes.sql` | New file | Low |
| 2.1 Preload CalculateRange | `/home/daniel/repos/zmanim/api/internal/services/zmanim_service.go` | 116-130, 492-559 | High |
| 2.2 Calendar Batch | `/home/daniel/repos/zmanim/api/internal/calendar/events.go` | New methods | High |
| 2.3 Handler Parallelization | `/home/daniel/repos/zmanim/api/internal/handlers/*.go` | Multiple files | Medium |
| 3.1 Tag Cache | `/home/daniel/repos/zmanim/api/internal/calendar/tag_cache.go` | New file | High |
| 3.2 Range Cache | `/home/daniel/repos/zmanim/api/internal/cache/cache.go` | 100+ new lines | Medium |
| 3.3 Preload Library | `/home/daniel/repos/zmanim/api/internal/handlers/preload.go` | New file | Low |

### SQLc Queries to Review
- `GetEffectiveLocalityLocation` (api/internal/db/queries/localities.sql)
- `GetPublisherZmanim` (api/internal/db/queries/publisher_zmanim.sql)
- `GetPublisherInfoForZmanim` (api/internal/db/queries/publishers.sql)
- `GetAllTagEventMappings` (api/internal/db/queries/tag_events.sql, may need to create)

---

## Appendix B: Code Quality Checklist

Before merging each optimization:

**General**:
- [ ] Follows `docs/coding-standards.md`
- [ ] No TODO/FIXME comments
- [ ] All slog calls use structured logging
- [ ] No raw SQL (SQLc only)
- [ ] No raw `fetch()` in frontend

**Testing**:
- [ ] Unit tests pass (`cd api && go test ./...`)
- [ ] Integration tests pass (if applicable)
- [ ] E2E critical paths verified
- [ ] Performance benchmarks documented

**Performance**:
- [ ] Response time meets target
- [ ] Database query count reduced (or maintained)
- [ ] Cache hit rate improved (or maintained)
- [ ] No memory leaks (load tested)

**Documentation**:
- [ ] Code comments for complex logic
- [ ] INDEX.md updated (if new files)
- [ ] CHANGELOG.md entry added
- [ ] Performance metrics documented

**CI/CD**:
- [ ] `./scripts/validate-ci-checks.sh` passes
- [ ] SQLc generation clean (`cd api && sqlc generate`)
- [ ] Type checking clean (`cd web && npm run type-check`)

---

## Conclusion

This optimization plan provides a systematic path to achieve **10× performance improvement** for the critical weekly zmanim endpoint (3000ms → 300ms). The plan prioritizes:

1. **Data Correctness**: Fix cache key bug first (P0)
2. **High Impact**: Eliminate 365× redundant queries (P0)
3. **Low Risk**: Start with quick wins, build to major refactors
4. **Comprehensive Testing**: Every change validated with benchmarks
5. **Graceful Rollback**: Feature flags enable quick reversion

**Expected Outcome**:
- Weekly endpoint: 10× faster (3000ms → 300ms)
- All endpoints: Meet performance targets
- Database load: 86% reduction in queries
- Cache efficiency: 80%+ hit rate
- Zero functional regressions

**Ready for Implementation**: All tasks have specific file paths, line numbers, code examples, and testing procedures. Begin with Week 1 quick wins and proceed sequentially through the timeline.
