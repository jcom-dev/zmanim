# Story 6.6: Database Query Optimization & Indexing

**Epic:** Epic 6 - Code Cleanup, Consolidation & Publisher Data Overrides
**Status:** ready-for-dev
**Priority:** P1
**Story Points:** 5
**Dependencies:** 6.3, 6.4, 6.5 (New queries from those stories)

---

## Story

As a **developer**,
I want **all new queries from Epic 6 optimized with proper indexes and performance monitoring**,
So that **the application performs well under load and doesn't degrade as data grows**.

---

## Background

Stories 6.3, 6.4, and 6.5 introduce several new queries and tables:
- **Story 6.3:** Tag filtering queries (Hebrew date lookups), tag correction requests
- **Story 6.4:** Location override queries
- **Story 6.5:** City correction request queries

**Without proper indexes, these queries could cause performance degradation**, especially:
- Tag filtering happens on EVERY zmanim calculation request
- Location override lookup happens on EVERY calculation for publishers with overrides
- Admin dashboards need fast queries for pending requests

**Performance Targets:**
- Tag filtering (GetTagsForDate): < 50ms (p95)
- Location override lookup: < 20ms (p95)
- Correction request lists: < 150ms (p95)
- Full zmanim calculation with filtering: < 200ms (p95)

---

## Acceptance Criteria

### AC-6.6.1: Analyze All New Queries with EXPLAIN ANALYZE
- [ ] Run EXPLAIN ANALYZE on all new queries from Stories 6.3-6.5
- [ ] Document query plans in `/docs/database-indexes.md`
- [ ] Identify missing indexes
- [ ] Check for sequential scans on large tables
- [ ] Verify estimated rows match actual rows

### AC-6.6.2: Create Required Indexes
- [ ] Create migration `00000000000028_epic6_performance_indexes.sql`
- [ ] Add indexes for tag_event_mappings (hebrew_month, hebrew_day_start, hebrew_day_end)
- [ ] Add indexes for master_zman_tags (master_zman_id, tag_id)
- [ ] Add indexes for publisher_zman_tags (publisher_zman_id, tag_id)
- [ ] Add indexes for tag correction requests (status, created_at)
- [ ] Add indexes for publisher_location_overrides (publisher_id, city_id)
- [ ] Add covering index for location overrides with INCLUDE clause
- [ ] Add indexes for city correction requests (status, city_id, publisher_id)
- [ ] Run VACUUM ANALYZE after index creation

### AC-6.6.3: Add Query Performance Tests
- [ ] Create `api/internal/handlers/performance_test.go`
- [ ] Add test: TestTagFilteringPerformance (< 50ms)
- [ ] Add test: TestLocationOverrideLookupPerformance (< 20ms)
- [ ] Add test: TestCorrectionRequestListPerformance (< 150ms)
- [ ] Add benchmark: BenchmarkZmanimCalculationWithFiltering

### AC-6.6.4: Document Index Strategy
- [ ] Create or update `/docs/database-indexes.md`
- [ ] Document all new indexes with rationale
- [ ] Document query patterns each index supports
- [ ] Document performance targets
- [ ] Document monitoring strategy

### AC-6.6.5: Verify Performance Targets
- [ ] All queries meet performance targets
- [ ] No sequential scans on large tables
- [ ] Query plans show index usage
- [ ] Benchmark tests pass

---

## Tasks / Subtasks

- [ ] Task 1: Query Analysis (AC: 6.6.1)
  - [ ] 1.1 List all new queries from Stories 6.3-6.5
  - [ ] 1.2 Run EXPLAIN ANALYZE on GetTagsForDate
  - [ ] 1.3 Run EXPLAIN ANALYZE on GetZmanTags with source tracking
  - [ ] 1.4 Run EXPLAIN ANALYZE on GetLocationOverrideForCalculation
  - [ ] 1.5 Run EXPLAIN ANALYZE on GetPendingCorrectionRequests
  - [ ] 1.6 Document findings in spreadsheet
  - [ ] 1.7 Identify missing indexes

- [ ] Task 2: Create Indexes (AC: 6.6.2)
  - [ ] 2.1 Create migration file
  - [ ] 2.2 Add tag_event_mappings indexes
  - [ ] 2.3 Add master_zman_tags indexes
  - [ ] 2.4 Add publisher_zman_tags indexes
  - [ ] 2.5 Add tag correction request indexes (partial indexes)
  - [ ] 2.6 Add location override indexes (including covering index)
  - [ ] 2.7 Add city correction request indexes
  - [ ] 2.8 Add VACUUM ANALYZE commands
  - [ ] 2.9 Run migration
  - [ ] 2.10 Re-run EXPLAIN ANALYZE to verify

- [ ] Task 3: Performance Tests (AC: 6.6.3)
  - [ ] 3.1 Create performance_test.go
  - [ ] 3.2 Add TestTagFilteringPerformance
  - [ ] 3.3 Add TestLocationOverrideLookupPerformance
  - [ ] 3.4 Add TestCorrectionRequestListPerformance
  - [ ] 3.5 Add BenchmarkZmanimCalculationWithFiltering
  - [ ] 3.6 Run tests and verify targets met

- [ ] Task 4: Documentation (AC: 6.6.4)
  - [ ] 4.1 Create/update database-indexes.md
  - [ ] 4.2 Document tag event mapping indexes
  - [ ] 4.3 Document tag tracking indexes
  - [ ] 4.4 Document location override indexes
  - [ ] 4.5 Document correction request indexes
  - [ ] 4.6 Document monitoring strategy
  - [ ] 4.7 Add query optimization guidelines

- [ ] Task 5: Verification (AC: 6.6.5)
  - [ ] 5.1 Run all performance tests
  - [ ] 5.2 Verify all tests pass
  - [ ] 5.3 Check query plans show index usage
  - [ ] 5.4 No sequential scans on large tables
  - [ ] 5.5 Document results

---

## Dev Notes

### Performance Index Migration

**File:** `db/migrations/00000000000028_epic6_performance_indexes.sql`

```sql
-- ============================================================================
-- Epic 6: Performance Indexes
-- ============================================================================

-- Tag Event Mappings (Story 6.3)
-- Used for: Hebrew date → tag lookups in zmanim calculations
CREATE INDEX IF NOT EXISTS idx_tag_event_mappings_hebrew_date
  ON tag_event_mappings(hebrew_month, hebrew_day_start, hebrew_day_end);

CREATE INDEX IF NOT EXISTS idx_tag_event_mappings_priority
  ON tag_event_mappings(priority);

-- Tag event pattern matching (for HebCal events)
CREATE INDEX IF NOT EXISTS idx_tag_event_mappings_pattern
  ON tag_event_mappings(hebcal_event_pattern)
  WHERE hebcal_event_pattern IS NOT NULL;

-- Master Zman Tags (Story 6.3)
-- Used for: Source tag comparison
CREATE INDEX IF NOT EXISTS idx_master_zman_tags_lookup
  ON master_zman_tags(master_zman_id, tag_id);

-- Publisher Zman Tags (Story 6.3)
-- Used for: Tag modification detection
CREATE INDEX IF NOT EXISTS idx_publisher_zman_tags_lookup
  ON publisher_zman_tags(publisher_zman_id, tag_id);

-- Tag Correction Requests (Story 6.3)
-- Used for: Admin dashboard filtering
CREATE INDEX IF NOT EXISTS idx_tag_correction_requests_status_created
  ON master_zman_tag_correction_requests(status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_tag_correction_requests_master_zman
  ON master_zman_tag_correction_requests(master_zman_id);

CREATE INDEX IF NOT EXISTS idx_tag_correction_requests_tag
  ON master_zman_tag_correction_requests(tag_id);

-- Publisher Location Overrides (Story 6.4)
-- Used for: Fast lookup during zmanim calculation
CREATE INDEX IF NOT EXISTS idx_publisher_location_overrides_lookup
  ON publisher_location_overrides(publisher_id, city_id);

-- Covering index for calculation queries (includes all needed columns)
CREATE INDEX IF NOT EXISTS idx_publisher_location_overrides_calculation
  ON publisher_location_overrides(publisher_id, city_id)
  INCLUDE (override_latitude, override_longitude, override_elevation, override_timezone);

-- City Correction Requests (Story 6.5)
-- Used for: Admin dashboard filtering and publisher list
CREATE INDEX IF NOT EXISTS idx_city_correction_requests_status_created
  ON city_correction_requests(status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_city_correction_requests_city
  ON city_correction_requests(city_id);

-- Composite index for publisher requests
CREATE INDEX IF NOT EXISTS idx_city_correction_requests_publisher_created
  ON city_correction_requests(publisher_id, created_at DESC)
  WHERE publisher_id IS NOT NULL;

-- ============================================================================
-- Vacuum and Analyze
-- ============================================================================

-- Update statistics for query planner
VACUUM ANALYZE tag_event_mappings;
VACUUM ANALYZE master_zman_tags;
VACUUM ANALYZE publisher_zman_tags;
VACUUM ANALYZE master_zman_tag_correction_requests;
VACUUM ANALYZE publisher_location_overrides;
VACUUM ANALYZE city_correction_requests;
```

### Performance Test Examples

**File:** `api/internal/handlers/performance_test.go`

```go
package handlers

import (
    "context"
    "testing"
    "time"
)

func TestTagFilteringPerformance(t *testing.T) {
    ctx := context.Background()

    // Test GetTagsForDate
    start := time.Now()
    tags, err := db.Queries.GetTagsForDate(ctx, sqlcgen.GetTagsForDateParams{
        HebrewMonth: 7,
        HebrewDay:   1,
    })
    duration := time.Since(start)

    if err != nil {
        t.Fatalf("Query failed: %v", err)
    }

    if duration > 50*time.Millisecond {
        t.Errorf("GetTagsForDate too slow: %v (target: < 50ms)", duration)
    }

    t.Logf("GetTagsForDate: %v, returned %d tags", duration, len(tags))
}

func TestLocationOverrideLookupPerformance(t *testing.T) {
    ctx := context.Background()

    start := time.Now()
    override, err := db.Queries.GetLocationOverrideForCalculation(ctx, sqlcgen.GetLocationOverrideForCalculationParams{
        PublisherID: testPublisherID,
        CityID:      testCityID,
    })
    duration := time.Since(start)

    if err != nil && err != sql.ErrNoRows {
        t.Fatalf("Query failed: %v", err)
    }

    if duration > 20*time.Millisecond {
        t.Errorf("GetLocationOverrideForCalculation too slow: %v (target: < 20ms)", duration)
    }

    t.Logf("GetLocationOverrideForCalculation: %v", duration)
}

func TestCorrectionRequestListPerformance(t *testing.T) {
    ctx := context.Background()

    // Admin dashboard query
    start := time.Now()
    requests, err := db.Queries.GetPendingCityCorrectionRequests(ctx, sqlcgen.GetPendingCityCorrectionRequestsParams{
        Limit: 20,
    })
    duration := time.Since(start)

    if err != nil {
        t.Fatalf("Query failed: %v", err)
    }

    if duration > 150*time.Millisecond {
        t.Errorf("GetPendingCityCorrectionRequests too slow: %v (target: < 150ms)", duration)
    }

    t.Logf("GetPendingCityCorrectionRequests: %v, returned %d requests", duration, len(requests))
}

func BenchmarkZmanimCalculationWithFiltering(b *testing.B) {
    ctx := context.Background()

    for i := 0; i < b.N; i++ {
        // Full zmanim calculation flow with tag filtering
        _, err := handlers.GetZmanimForCity(ctx, testCityID, testDate, testPublisherID)
        if err != nil {
            b.Fatalf("Calculation failed: %v", err)
        }
    }
}
```

### Index Strategy Documentation

**File:** `/docs/database-indexes.md`

```markdown
# Database Index Strategy - Epic 6

## Tag Event Mappings

**Table:** `tag_event_mappings` (maps tags to Hebrew dates/events)

**Query Pattern:** Lookup tags for a specific Hebrew date
```sql
WHERE hebrew_month = X AND Y BETWEEN hebrew_day_start AND hebrew_day_end
```

**Indexes:**
- `idx_tag_event_mappings_hebrew_date` (hebrew_month, hebrew_day_start, hebrew_day_end)
- `idx_tag_event_mappings_priority` (priority) - for ordering
- `idx_tag_event_mappings_pattern` (hebcal_event_pattern) - partial index

**Rationale:** Hebrew date lookups happen on EVERY zmanim calculation request.

---

## Publisher Location Overrides

**Table:** `publisher_location_overrides`

**Query Pattern:** Lookup override for publisher + city during calculation
```sql
WHERE publisher_id = X AND city_id = Y
```

**Indexes:**
- `idx_publisher_location_overrides_lookup` (publisher_id, city_id) - composite
- `idx_publisher_location_overrides_calculation` - covering index with INCLUDE

**Rationale:**
- Composite index covers the WHERE clause exactly
- Covering index avoids table lookup (index-only scan)
- Called during every zmanim calculation for publishers with overrides

---

## Correction Requests

**Tables:** `city_correction_requests`, `master_zman_tag_correction_requests`

**Query Patterns:**
1. Admin dashboard: `WHERE status = 'pending' ORDER BY created_at DESC`
2. Publisher list: `WHERE publisher_id = X ORDER BY created_at DESC`

**Indexes:**
- Partial index on `(status, created_at DESC)` WHERE status = 'pending'
- Regular index on `(publisher_id, created_at DESC)`

**Rationale:**
- Partial index is smaller and faster for pending-only queries
- Sorted index avoids separate sort operation
```

### Coding Standards (MUST FOLLOW)

**CRITICAL:** All implementation MUST strictly follow [docs/coding-standards.md](../../coding-standards.md).

**Database:**
- All indexes in migration files
- Use partial indexes for filtered queries
- Use covering indexes for read-heavy queries
- Run VACUUM ANALYZE after index creation

### References

- [db/migrations/](../../../../db/migrations/)
- [api/internal/db/queries/](../../../../api/internal/db/queries/)
- [docs/coding-standards.md](../../coding-standards.md)

---

## Testing Requirements

### Performance Tests
- [ ] All performance tests pass (< target times)
- [ ] Benchmarks show acceptable performance

### Query Plan Verification
- [ ] All queries use indexes (no sequential scans)
- [ ] Estimated rows match actual rows
- [ ] Query costs are within acceptable range

### Regression Tests
- [ ] All existing E2E tests still pass
- [ ] No performance degradation in existing queries

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/6-6-database-query-optimization-context.md (to be generated)

### Agent Model Used
TBD

### Completion Notes
TBD

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-08 | Story created from Epic 6 | Bob (Scrum Master) |
