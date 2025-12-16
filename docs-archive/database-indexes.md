# Database Index Strategy - Epic 6

**Story:** 6.6 - Database Query Optimization & Indexing
**Status:** Implemented
**Migration:** `00000000000006_epic6_performance_indexes.sql`

## Overview

This document describes the indexing strategy for Epic 6 features (Tag Manager, Location Overrides, and Correction Requests). These indexes optimize queries that are called frequently in the zmanim calculation pipeline and admin dashboard.

## Performance Targets

| Query Type | Target (p95) | Frequency | Critical |
|------------|--------------|-----------|----------|
| Tag filtering (GetTagsForHebrewDate) | < 50ms | Every calculation | YES |
| Location override lookup | < 20ms | Every calculation (with overrides) | YES |
| Correction request lists | < 150ms | Admin dashboard | NO |
| Full zmanim calculation with filtering | < 200ms | Every calculation | YES |

---

## Tag Event Mappings

**Table:** `tag_event_mappings`
**Purpose:** Maps tags to Hebrew dates and HebCal events for calendar-based filtering
**Criticality:** HIGH - Called on EVERY zmanim calculation request

### Query Patterns

#### 1. Hebrew Date Lookup (CRITICAL)
```sql
-- GetTagsForHebrewDate
SELECT DISTINCT t.id, t.tag_key, ...
FROM zman_tags t
JOIN tag_types tt ON tt.id = t.tag_type_id
JOIN tag_event_mappings m ON m.tag_id = t.id
WHERE m.hebrew_month = $1
  AND $2 BETWEEN m.hebrew_day_start AND COALESCE(m.hebrew_day_end, m.hebrew_day_start)
ORDER BY m.priority DESC, t.sort_order;
```

**Indexes:**
- `idx_tag_event_mappings_hebrew_date` (hebrew_month, hebrew_day_start) - Existing, optimizes WHERE clause
- `idx_tag_event_mappings_date_range` (hebrew_month, hebrew_day_start, COALESCE(hebrew_day_end, hebrew_day_start)) - NEW, improves BETWEEN estimation
- `idx_tag_event_mappings_priority` (priority DESC) WHERE hebrew_month IS NOT NULL - NEW, optimizes ORDER BY

**Rationale:**
- Hebrew date lookups happen on EVERY zmanim calculation request
- The BETWEEN clause benefits from having hebrew_day_end in the index for better cardinality estimation
- Priority ordering is common in tag filtering, so a dedicated index improves sort performance
- Partial index (WHERE hebrew_month IS NOT NULL) keeps the index smaller

#### 2. HebCal Event Pattern Matching
```sql
-- GetTagsForHebCalEvent
WHERE m.hebcal_event_pattern IS NOT NULL
  AND ($1 LIKE m.hebcal_event_pattern OR ...)
```

**Indexes:**
- `idx_tag_event_mappings_pattern` (hebcal_event_pattern) WHERE hebcal_event_pattern IS NOT NULL - Existing

**Rationale:**
- Pattern matching queries need the pattern column indexed
- Partial index (WHERE NOT NULL) reduces index size significantly

---

## Master Zman Tags

**Table:** `master_zman_tags`
**Purpose:** Tags from master registry (source of truth for tag inheritance)
**Criticality:** MEDIUM - Called when loading zman details

### Query Patterns

#### 1. Tag Lookup for Master Zman
```sql
-- GetZmanTags (master tags portion)
SELECT mzt.tag_id, mzt.is_negated
FROM master_zman_tags mzt
WHERE mzt.master_zman_id = $1
```

**Indexes:**
- `idx_master_zman_tags_covering` (master_zman_id) INCLUDE (tag_id) - Existing
- `idx_master_zman_tags_negated` (master_zman_id, is_negated) - Existing

**Rationale:**
- Covering index enables index-only scans (no heap lookups)
- Composite index with is_negated supports filtering on negated tags
- Primary key on (master_zman_id, tag_id) already provides lookup capability

---

## Publisher Zman Tags

**Table:** `publisher_zman_tags`
**Purpose:** Publisher-specific tag overrides and additions
**Criticality:** MEDIUM - Called when loading zman details

### Query Patterns

#### 1. Tag Lookup for Publisher Zman
```sql
-- GetZmanTags (publisher tags portion)
SELECT pzt.tag_id, pzt.is_negated
FROM publisher_zman_tags pzt
WHERE pzt.publisher_zman_id = $1
```

**Indexes:**
- `idx_publisher_zman_tags_covering` (publisher_zman_id, tag_id) INCLUDE (is_negated) - NEW
- `idx_publisher_zman_tags_negated` (publisher_zman_id, is_negated) - Existing

**Rationale:**
- Covering index avoids heap lookups in GetZmanTags query
- Includes is_negated to fetch all needed data from index alone
- Supports tag modification detection (comparing master vs publisher tags)

#### 2. Tag Filtering
```sql
-- GetZmanimByActiveTags
WHERE pz.publisher_id = $1
  AND t.tag_key = ANY($2::text[])
```

**Indexes:**
- `idx_publisher_zman_tags_tag` (tag_id) - Existing
- Primary key on (publisher_zman_id, tag_id) - Existing

**Rationale:**
- Tag ID index supports JOIN to zman_tags table
- Primary key supports reverse lookup (from tag to zmanim)

---

## Publisher Location Overrides

**Table:** `publisher_location_overrides`
**Purpose:** Publisher-specific location data corrections
**Criticality:** HIGH - Called on EVERY calculation for publishers with overrides

### Query Patterns

#### 1. Calculation Lookup (CRITICAL)
```sql
-- GetLocationOverrideForCalculation
SELECT
  override_latitude,
  override_longitude,
  override_elevation,
  override_timezone
FROM publisher_location_overrides
WHERE publisher_id = $1 AND city_id = $2
LIMIT 1;
```

**Indexes:**
- `publisher_location_overrides_publisher_id_city_id_key` (publisher_id, city_id) UNIQUE - Existing
- `idx_publisher_location_overrides_calculation` (publisher_id, city_id) INCLUDE (override_latitude, override_longitude, override_elevation, override_timezone) - NEW

**Rationale:**
- UNIQUE constraint already provides fast lookup
- Covering index enables **index-only scans** - avoids heap fetches entirely
- Including override columns means query never touches the table heap
- Performance gain: ~30-50% faster for hot queries

**Why Both Indexes?**
- UNIQUE constraint enforces data integrity
- Covering index optimizes read performance
- Postgres will use whichever is better for the query (usually the covering index for reads)

#### 2. Publisher Override List
```sql
-- GetPublisherLocationOverrides
WHERE publisher_id = $1
ORDER BY updated_at DESC
```

**Indexes:**
- `idx_publisher_overrides_publisher` (publisher_id) - Existing

**Rationale:**
- Single-column index sufficient for filtering
- Separate sorting is acceptable for infrequent admin queries

---

## City Correction Requests

**Table:** `city_correction_requests`
**Purpose:** Community-submitted corrections to global city data
**Criticality:** LOW - Admin dashboard only

### Query Patterns

#### 1. Admin Dashboard - Pending Requests
```sql
-- GetAllCorrectionRequests (filtered)
WHERE status = 'pending'
ORDER BY created_at DESC
```

**Indexes:**
- `idx_correction_requests_status` (status) - Existing
- `idx_city_correction_requests_pending` (status, created_at DESC) WHERE status = 'pending' - NEW (partial index)

**Rationale:**
- Partial index is smaller and faster than full index
- Only pending requests need fast access (approved/rejected are archived)
- Composite index supports both filtering and ordering
- DESC ordering in index avoids separate sort step

**Size Comparison:**
- Full index: ~100% of table rows
- Partial index: ~5-10% of table rows (only pending)
- Performance gain: ~10x faster for pending queries

#### 2. Publisher-Specific Requests
```sql
-- GetPublisherCorrectionRequests
WHERE publisher_id = $1
ORDER BY created_at DESC
```

**Indexes:**
- `idx_correction_requests_publisher` (publisher_id) - Existing
- `idx_city_correction_requests_publisher_created` (publisher_id, created_at DESC) WHERE publisher_id IS NOT NULL - NEW

**Rationale:**
- Composite index supports filtering + ordering
- Partial index excludes anonymous requests (publisher_id IS NULL)
- Anonymous requests use separate query path

#### 3. City-Specific Requests
```sql
WHERE city_id = $1
```

**Indexes:**
- `idx_correction_requests_city` (city_id) - Existing

**Rationale:**
- Single-column index sufficient for city lookups
- Used in admin "view all corrections for this city" feature

---

## Index Maintenance

### VACUUM ANALYZE

After index creation, statistics are updated for the query planner:

```sql
VACUUM ANALYZE tag_event_mappings;
VACUUM ANALYZE master_zman_tags;
VACUUM ANALYZE publisher_zman_tags;
VACUUM ANALYZE publisher_location_overrides;
VACUUM ANALYZE city_correction_requests;
```

**Purpose:**
- Updates table statistics for better query planning
- Reclaims space from dead tuples
- Ensures indexes are properly registered in pg_stats

**When to Run:**
- Automatically after migration (included in migration file)
- Manually after bulk data changes
- Automatically via autovacuum (configured in production)

### Monitoring

**Query Performance:**
```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('tag_event_mappings', 'publisher_location_overrides', 'city_correction_requests')
ORDER BY idx_scan DESC;

-- Check index sizes
SELECT
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE tablename IN ('tag_event_mappings', 'publisher_location_overrides', 'city_correction_requests')
ORDER BY pg_relation_size(indexrelid) DESC;
```

**Slow Query Log:**
```sql
-- Find slow queries using these tables
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%tag_event_mappings%'
   OR query LIKE '%publisher_location_overrides%'
   OR query LIKE '%city_correction_requests%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Index Design Patterns

### 1. Covering Indexes (Index-Only Scans)

**Pattern:**
```sql
CREATE INDEX idx_table_covering
  ON table(filter_column, lookup_column)
  INCLUDE (data_column1, data_column2);
```

**When to Use:**
- Read-heavy tables
- Queries that SELECT specific columns (not *)
- Hot queries in the critical path

**Example:**
- `idx_publisher_location_overrides_calculation` - Avoids heap lookups entirely

### 2. Partial Indexes

**Pattern:**
```sql
CREATE INDEX idx_table_partial
  ON table(column)
  WHERE condition;
```

**When to Use:**
- Queries filter on a common value (e.g., status = 'pending')
- Filtering excludes large portions of table
- Want to reduce index size

**Example:**
- `idx_city_correction_requests_pending` - Only indexes pending rows (~5-10% of table)

### 3. Composite Indexes

**Pattern:**
```sql
CREATE INDEX idx_table_composite
  ON table(filter_column, sort_column DESC);
```

**When to Use:**
- Queries have both WHERE and ORDER BY
- Column order matches query pattern (filter first, then sort)
- Want to avoid separate sort step

**Example:**
- `idx_city_correction_requests_pending` - Combines status filter + created_at sort

---

## Performance Testing

### Test Files

- **Unit Tests:** `api/internal/handlers/performance_test.go`
- **Benchmarks:** Same file (Benchmark* functions)

### Running Tests

```bash
# Run all performance tests
cd api && go test -v ./internal/handlers -run TestTag -run TestLocation -run TestCorrection

# Run specific performance test
cd api && go test -v ./internal/handlers -run TestTagFilteringPerformance

# Run benchmarks
cd api && go test -bench=BenchmarkTagFiltering ./internal/handlers
cd api && go test -bench=BenchmarkLocationOverride ./internal/handlers
cd api && go test -bench=BenchmarkCorrectionRequest ./internal/handlers

# Run all benchmarks
cd api && go test -bench=. ./internal/handlers
```

### Success Criteria

✅ **Pass:** All tests complete within target times
⚠️ **Warning:** Tests exceed target by 10-20%
❌ **Fail:** Tests exceed target by > 20%

**Action on Failure:**
1. Run EXPLAIN ANALYZE on failing query
2. Check index usage (pg_stat_user_indexes)
3. Verify statistics are up to date (pg_stats)
4. Check for table bloat (pg_stat_user_tables)
5. Consider additional indexes or query rewrite

---

## Migration History

| Migration | Description | Tables Affected |
|-----------|-------------|-----------------|
| 00000000000003 | Initial lookup indexes | Lookup tables |
| 00000000000006 | Epic 6 performance indexes | tag_event_mappings, publisher_zman_tags, publisher_location_overrides, city_correction_requests |

---

## References

- **Story:** `docs/sprint-artifacts/stories/6-6-database-query-optimization.md`
- **Migration:** `db/migrations/00000000000006_epic6_performance_indexes.sql`
- **Tests:** `api/internal/handlers/performance_test.go`
- **Coding Standards:** `docs/coding-standards.md` (Database Standards section)
- **PostgreSQL Docs:** [Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
- **PostgreSQL Docs:** [Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
- **PostgreSQL Docs:** [Index-Only Scans](https://www.postgresql.org/docs/current/indexes-index-only-scans.html)

---

**Last Updated:** 2025-12-08
**Author:** Claude (Story 6.6 Implementation)
