# Story 9.15: Publisher Coverage DB-Level Filtering

**Epic:** Epic 9 - API Restructuring & Endpoint Cleanup
**Status:** Ready for Dev
**Priority:** Low (Performance optimization)
**Story Points:** 3

---

## User Story

**As a** system administrator,
**I want** publisher coverage filtering to happen at the database level,
**So that** location queries are more efficient and scalable.

---

## Context

The location handler currently filters publisher coverage in application code after fetching all results. This is inefficient as it transfers more data than needed from the database.

**Source TODO:**
- `api/internal/handlers/locations.go:374` - "TODO: Implement publisher coverage filtering at DB level"

**Current State:**
```go
// This is a simplified in-memory filter - for production, consider DB-level filtering
// TODO: Implement publisher coverage filtering at DB level
_ = publisherID // Placeholder - publisher filtering not yet implemented
```

**Target State:**
- SQLc query with publisher coverage JOIN
- Filtering happens in PostgreSQL, not Go
- Reduced data transfer
- Better performance for large result sets

---

## Acceptance Criteria

### AC1: DB-Level Filtering Query
**Given** a location search with publisher ID
**When** the query executes
**Then** filtering happens in the SQL query, not in Go code

### AC2: Correct Results
**Given** a publisher with specific coverage
**When** searching for cities
**Then** only cities within the publisher's coverage are returned

### AC3: Coverage Types Supported
**Given** different coverage granularities
**When** filtering
**Then** all coverage types are handled:
- City-level (city_id match)
- Region-level (region match)
- Country-level (country_code match)

### AC4: Performance Improvement
**Given** a publisher with limited coverage
**When** querying a large city table (163k cities)
**Then** query returns faster than fetching all + filtering

### AC5: API Compatibility
**Given** the updated implementation
**When** calling the location search endpoint
**Then** API response format remains unchanged

---

## Technical Notes

### Current Implementation

**locations.go:374:**
```go
func (h *Handlers) SearchLocations(w http.ResponseWriter, r *http.Request) {
    // ... existing code ...

    // For publisher filtering, we need to check coverage
    // This is a simplified in-memory filter - for production, consider DB-level filtering
    // TODO: Implement publisher coverage filtering at DB level
    _ = publisherID // Placeholder - publisher filtering not yet implemented

    // Currently returns ALL matching cities, then would filter in Go
}
```

### Database Schema

**publisher_coverage table:**
```sql
CREATE TABLE publisher_coverage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID NOT NULL REFERENCES publishers(id),
    city_id INTEGER REFERENCES cities(id),        -- Specific city
    region TEXT,                                   -- Region/state coverage
    country_code CHAR(2),                          -- Country-wide coverage
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_coverage CHECK (
        city_id IS NOT NULL OR region IS NOT NULL OR country_code IS NOT NULL
    )
);
```

### New SQLc Query

**api/internal/db/queries/locations.sql:**
```sql
-- name: SearchCitiesWithPublisherCoverage :many
SELECT DISTINCT
    c.id,
    c.name,
    c.ascii_name,
    c.country_code,
    c.admin1_code as region,
    c.latitude,
    c.longitude,
    c.population,
    c.timezone
FROM cities c
JOIN publisher_coverage pc ON (
    -- City-level match
    pc.city_id = c.id
    OR
    -- Region-level match
    (pc.region IS NOT NULL AND pc.region = c.admin1_code AND pc.country_code = c.country_code)
    OR
    -- Country-level match
    (pc.country_code IS NOT NULL AND pc.region IS NULL AND pc.city_id IS NULL AND pc.country_code = c.country_code)
)
WHERE pc.publisher_id = $1
  AND (
    c.name ILIKE $2
    OR c.ascii_name ILIKE $2
  )
ORDER BY c.population DESC
LIMIT $3;
```

**Alternative with PostGIS (if using geographic search):**
```sql
-- name: SearchCitiesWithPublisherCoverageGeo :many
SELECT DISTINCT
    c.id,
    c.name,
    c.ascii_name,
    c.country_code,
    c.admin1_code as region,
    c.latitude,
    c.longitude,
    c.population,
    c.timezone,
    ST_Distance(c.geom, ST_MakePoint($2, $3)::geography) as distance_meters
FROM cities c
JOIN publisher_coverage pc ON (
    pc.city_id = c.id
    OR (pc.region IS NOT NULL AND pc.region = c.admin1_code AND pc.country_code = c.country_code)
    OR (pc.country_code IS NOT NULL AND pc.region IS NULL AND pc.city_id IS NULL AND pc.country_code = c.country_code)
)
WHERE pc.publisher_id = $1
  AND ST_DWithin(c.geom, ST_MakePoint($2, $3)::geography, $4)  -- $4 = radius in meters
ORDER BY distance_meters
LIMIT $5;
```

### Handler Update

**locations.go:**
```go
func (h *Handlers) SearchLocations(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    query := r.URL.Query().Get("q")
    publisherID := r.URL.Query().Get("publisher_id")
    limit := parseLimit(r.URL.Query().Get("limit"), 20)

    var cities []db.City
    var err error

    if publisherID != "" {
        // Use publisher-filtered query
        pubID, err := uuid.Parse(publisherID)
        if err != nil {
            RespondError(w, r, http.StatusBadRequest, "invalid publisher_id")
            return
        }

        cities, err = h.db.Queries.SearchCitiesWithPublisherCoverage(ctx, db.SearchCitiesWithPublisherCoverageParams{
            PublisherID: pubID,
            Query:       "%" + query + "%",
            Limit:       int32(limit),
        })
    } else {
        // Use existing unfiltered query
        cities, err = h.db.Queries.SearchCities(ctx, db.SearchCitiesParams{
            Query: "%" + query + "%",
            Limit: int32(limit),
        })
    }

    if err != nil {
        RespondError(w, r, http.StatusInternalServerError, "failed to search cities")
        return
    }

    RespondJSON(w, r, http.StatusOK, cities)
}
```

### Index Considerations

Ensure proper indexes exist for efficient filtering:
```sql
-- Index for publisher coverage lookups
CREATE INDEX idx_publisher_coverage_publisher_id ON publisher_coverage(publisher_id);
CREATE INDEX idx_publisher_coverage_city_id ON publisher_coverage(city_id);
CREATE INDEX idx_publisher_coverage_country ON publisher_coverage(country_code);
CREATE INDEX idx_publisher_coverage_region ON publisher_coverage(country_code, region);

-- Composite index for common query pattern
CREATE INDEX idx_publisher_coverage_full ON publisher_coverage(publisher_id, city_id, country_code, region);
```

---

## Tasks / Subtasks

- [ ] Task 1: Create SQLc query
  - [ ] 1.1 Add SearchCitiesWithPublisherCoverage query to locations.sql
  - [ ] 1.2 Test query in psql with sample data
  - [ ] 1.3 Verify JOIN logic handles all coverage types
  - [ ] 1.4 Run `sqlc generate`

- [ ] Task 2: Update locations handler
  - [ ] 2.1 Modify SearchLocations to accept publisher_id param
  - [ ] 2.2 Call appropriate query based on presence of publisher_id
  - [ ] 2.3 Remove TODO comment and placeholder code
  - [ ] 2.4 Ensure API response format unchanged

- [ ] Task 3: Add database indexes
  - [ ] 3.1 Create migration for publisher_coverage indexes
  - [ ] 3.2 Test query performance with indexes
  - [ ] 3.3 Run migration in dev environment

- [ ] Task 4: Testing
  - [ ] 4.1 Create test publisher with city-level coverage
  - [ ] 4.2 Create test publisher with country-level coverage
  - [ ] 4.3 Create test publisher with region-level coverage
  - [ ] 4.4 Verify correct filtering for each type
  - [ ] 4.5 Benchmark performance vs old approach

- [ ] Task 5: Cleanup
  - [ ] 5.1 Remove in-memory filtering code
  - [ ] 5.2 Remove TODO comment
  - [ ] 5.3 Update API documentation if needed

---

## Dependencies

**Depends On:**
- publisher_coverage table exists (already exists)
- cities table exists (already exists)

**Dependent Stories:**
- None

---

## Definition of Done

- [ ] SQLc query created with publisher coverage JOIN
- [ ] Handler uses DB-level filtering when publisher_id provided
- [ ] All coverage types (city, region, country) filter correctly
- [ ] Database indexes added for performance
- [ ] No change to API response format
- [ ] Performance benchmark shows improvement
- [ ] TODO comment removed
- [ ] Unit tests pass
- [ ] No regressions in location search

---

## Performance Expectations

| Scenario | Current (est.) | With DB Filter (target) |
|----------|----------------|-------------------------|
| 163k cities, no filter | ~50ms | ~50ms (unchanged) |
| 163k cities, publisher with 100 cities | ~50ms + filter | ~5ms |
| 163k cities, publisher with 1 country | ~50ms + filter | ~10ms |

**Target:** >80% reduction in response time for publisher-filtered queries

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Complex JOIN performance | LOW | MEDIUM | Add proper indexes |
| Coverage type edge cases | MEDIUM | LOW | Thorough testing of all types |
| Missing coverage data | LOW | LOW | Handle gracefully, return empty |

---

## Dev Notes

### Testing Coverage Logic

```sql
-- Test city-level coverage
INSERT INTO publisher_coverage (publisher_id, city_id) VALUES ('pub-uuid', 12345);

-- Test region-level coverage
INSERT INTO publisher_coverage (publisher_id, country_code, region) VALUES ('pub-uuid', 'US', 'CA');

-- Test country-level coverage
INSERT INTO publisher_coverage (publisher_id, country_code) VALUES ('pub-uuid', 'IL');

-- Verify search returns correct results
SELECT * FROM cities c
JOIN publisher_coverage pc ON (
    pc.city_id = c.id
    OR (pc.region = c.admin1_code AND pc.country_code = c.country_code)
    OR (pc.country_code = c.country_code AND pc.region IS NULL AND pc.city_id IS NULL)
)
WHERE pc.publisher_id = 'pub-uuid'
  AND c.name ILIKE '%new york%';
```

### EXPLAIN ANALYZE

Before deploying, run EXPLAIN ANALYZE on the query:
```sql
EXPLAIN ANALYZE
SELECT DISTINCT c.id, c.name ...
-- full query here
```

Look for:
- Index scans (good) vs Sequential scans (bad for large tables)
- Nested loop joins (fine for small result sets)
- Hash joins (fine for larger joins)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-15 | Story created for Epic 9 | Claude Opus 4.5 |

---

_Sprint: Epic 9_
_Created: 2025-12-15_
_Story Points: 3_
