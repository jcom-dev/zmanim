# Story 10.3: Search Index Implementation

**Story ID:** 10.3
**Epic:** Epic 10 - Overture Geographic Data Migration
**Points:** 8
**Priority:** HIGH - Core search functionality
**Risk:** Medium

---

## User Story

**As a** user searching for a location
**I want** fast, accurate search across all languages
**So that** I can find cities/neighborhoods by name in my preferred language

---

## Background

The search index enables:
- Exact keyword matching in ANY language (Hebrew, Arabic, Russian, etc.)
- Fuzzy matching for typos
- Ancestor matching (search "New York" finds Brooklyn too)
- Population-based ranking within each tier

---

## Acceptance Criteria

### AC1: Search Index Populated
- [ ] `geo_search_index` contains entries for all localities
- [ ] Each entry has `keywords` array with names in ALL languages
- [ ] Each entry has ancestor names (region, country) in keywords
- [ ] `display_hierarchy` shows full path (e.g., "Brooklyn → NYC → New York → USA")

**Verification:**
```sql
SELECT COUNT(*) FROM geo_search_index WHERE entity_type = 'locality';
-- Expected: ~500k+ rows

SELECT keywords FROM geo_search_index
WHERE entity_id = (SELECT id FROM geo_localities WHERE name = 'Jerusalem' LIMIT 1)
  AND entity_type = 'locality';
-- Expected: Array includes 'jerusalem', 'ירושלים', 'القدس', etc.
```

### AC2: Exact Keyword Search Works
- [ ] English search returns results: `SELECT * FROM geo_search_index WHERE keywords @> ARRAY['brooklyn']`
- [ ] Hebrew search returns results: `SELECT * FROM geo_search_index WHERE keywords @> ARRAY['ברוקלין']`
- [ ] Arabic search returns results: `SELECT * FROM geo_search_index WHERE keywords @> ARRAY['بروكلين']`
- [ ] Results ranked by population within tier

**Verification:**
```sql
-- English exact match
SELECT display_name, display_hierarchy, population
FROM geo_search_index
WHERE keywords @> ARRAY['brooklyn']
ORDER BY population DESC NULLS LAST
LIMIT 5;
-- Expected: Brooklyn, NYC first (highest population)

-- Hebrew exact match
SELECT display_name, display_hierarchy, population
FROM geo_search_index
WHERE keywords @> ARRAY['ירושלים']
ORDER BY population DESC NULLS LAST
LIMIT 5;
-- Expected: Jerusalem, Israel first
```

### AC3: Fuzzy Search Works
- [ ] Trigram similarity search catches typos
- [ ] `SELECT * FROM geo_search_index WHERE display_name % 'brookln'` returns Brooklyn
- [ ] Fuzzy results ranked lower than exact matches

**Verification:**
```sql
-- Set similarity threshold
SET pg_trgm.similarity_threshold = 0.3;

-- Fuzzy match
SELECT display_name, similarity(display_name, 'brookln') as sim
FROM geo_search_index
WHERE display_name % 'brookln'
ORDER BY sim DESC
LIMIT 5;
-- Expected: Brooklyn appears with similarity > 0.3
```

### AC4: Ancestor Search Works
- [ ] Searching "new york" returns both the city AND neighborhoods within
- [ ] City ranks higher than neighborhoods (name_match_bonus)
- [ ] Neighborhoods appear after cities in results

**Verification:**
```sql
SELECT display_name, display_hierarchy, population
FROM geo_search_index
WHERE keywords @> ARRAY['new york']
ORDER BY
    CASE WHEN display_name ILIKE '%new york%' THEN 0 ELSE 1 END,
    population DESC NULLS LAST
LIMIT 10;
-- Expected: New York City first, then Brooklyn, Manhattan, etc.
```

### AC5: Tiered Search Query Works
- [ ] SQLc query `SearchLocalities` implemented
- [ ] Query uses tiered ranking (exact → fuzzy → population)
- [ ] Query supports filters: `entity_types`, `country_id`, `region_id`
- [ ] Query returns all required fields for API response

**Verification:**
```bash
cd api && sqlc generate
# Expected: No errors, SearchLocalities query generated

cd api && go test ./internal/db/... -run TestSearchLocalities -v
# Expected: Tests pass
```

### AC6: Hierarchy Populations Correct
- [ ] `geo_hierarchy_populations` contains aggregated populations
- [ ] Region total_population = sum of child localities + sub-regions
- [ ] Country total_population = sum of all localities

**Verification:**
```sql
SELECT entity_type, COUNT(*), SUM(total_population)
FROM geo_hierarchy_populations
GROUP BY entity_type;
-- Expected: Regions and countries with aggregated populations

-- Verify rollup is correct for a known region
SELECT r.name, hp.total_population,
       (SELECT SUM(population) FROM geo_localities WHERE region_id = r.id) as direct_sum
FROM geo_regions r
JOIN geo_hierarchy_populations hp ON hp.entity_type = 'region' AND hp.entity_id = r.id
WHERE r.name = 'California'
LIMIT 1;
-- Expected: total_population >= direct_sum (includes sub-regions)
```

### AC7: Search Index Refresh Function Works
- [ ] `SELECT refresh_geo_search_index()` executes without error
- [ ] Refresh completes in <5 minutes for 500k localities
- [ ] Row count reported after refresh

**Verification:**
```sql
SELECT refresh_geo_search_index();
-- Expected: "Search index refreshed: 500000 rows"

SELECT COUNT(*) FROM geo_search_index;
-- Expected: ~500k rows
```

### AC8: Performance Targets Met
- [ ] Exact keyword search: <5ms
- [ ] Fuzzy search: <30ms
- [ ] EXPLAIN ANALYZE shows index usage

**Verification:**
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM geo_search_index
WHERE keywords @> ARRAY['london']
ORDER BY population DESC NULLS LAST
LIMIT 20;
-- Expected: Index Scan using idx_geo_search_keywords
-- Expected: Execution Time < 5ms

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM geo_search_index
WHERE display_name % 'londn'
ORDER BY similarity(display_name, 'londn') DESC
LIMIT 20;
-- Expected: Index Scan using idx_geo_search_trgm
-- Expected: Execution Time < 30ms
```

### AC9: Display Names JSONB Populated
- [ ] `display_names` column contains localized names
- [ ] At least `en`, `he`, `ar` when available
- [ ] Frontend can use for localized display

**Verification:**
```sql
SELECT display_names
FROM geo_search_index
WHERE entity_id = (SELECT id FROM geo_localities WHERE name = 'Jerusalem' LIMIT 1)
  AND entity_type = 'locality';
-- Expected: {"en": "Jerusalem", "he": "ירושלים", "ar": "القدس"}
```

### AC10: Entity Type Filter Works
- [ ] Can filter to only localities: `WHERE entity_type = 'locality'`
- [ ] Can include regions/countries for hierarchy search
- [ ] Index `idx_geo_search_type` used for filtering

**Verification:**
```sql
EXPLAIN (ANALYZE)
SELECT * FROM geo_search_index
WHERE entity_type = 'locality' AND keywords @> ARRAY['london']
LIMIT 20;
-- Expected: Uses idx_geo_search_type in filter
```

---

## Technical Implementation

### SQLc Query (localities.sql)

```sql
-- name: SearchLocalities :many
WITH search_terms AS (
    SELECT unnest(string_to_array(lower(sqlc.arg(query)), ' ')) AS term
),
exact_matches AS (
    SELECT
        s.entity_type,
        s.entity_id,
        s.locality_id,
        s.display_name,
        s.display_hierarchy,
        s.display_names,
        s.locality_type_id,
        s.parent_locality_id,
        s.region_id,
        s.country_id,
        s.continent_id,
        s.country_code,
        s.population,
        s.latitude,
        s.longitude,
        s.timezone,
        (SELECT COUNT(*) FROM search_terms st WHERE st.term = ANY(s.keywords))::int AS matched_terms,
        CASE WHEN lower(s.display_name) = ANY(SELECT term FROM search_terms) THEN 1 ELSE 0 END AS name_match_bonus,
        1 AS tier
    FROM geo_search_index s
    WHERE s.keywords && (SELECT ARRAY_AGG(term) FROM search_terms)
      AND (sqlc.narg(entity_types)::text[] IS NULL OR s.entity_type = ANY(sqlc.narg(entity_types)))
      AND (sqlc.narg(country_id)::int IS NULL OR s.country_id = sqlc.narg(country_id))
      AND (sqlc.narg(region_id)::int IS NULL OR s.region_id = sqlc.narg(region_id))
),
fuzzy_matches AS (
    SELECT
        s.entity_type,
        s.entity_id,
        s.locality_id,
        s.display_name,
        s.display_hierarchy,
        s.display_names,
        s.locality_type_id,
        s.parent_locality_id,
        s.region_id,
        s.country_id,
        s.continent_id,
        s.country_code,
        s.population,
        s.latitude,
        s.longitude,
        s.timezone,
        0 AS matched_terms,
        0 AS name_match_bonus,
        2 AS tier
    FROM geo_search_index s
    WHERE s.display_name % sqlc.arg(query)
      AND (s.entity_type, s.entity_id) NOT IN (SELECT entity_type, entity_id FROM exact_matches)
      AND (sqlc.narg(entity_types)::text[] IS NULL OR s.entity_type = ANY(sqlc.narg(entity_types)))
      AND (sqlc.narg(country_id)::int IS NULL OR s.country_id = sqlc.narg(country_id))
    LIMIT 50
)
SELECT * FROM (
    SELECT * FROM exact_matches
    UNION ALL
    SELECT * FROM fuzzy_matches
) combined
ORDER BY tier, name_match_bonus DESC, matched_terms DESC, population DESC NULLS LAST
LIMIT sqlc.arg(limit_val);
```

### Refresh Function (in migration)

The refresh function is created in Story 10.1's migration. This story verifies it works correctly.

---

## Definition of Done

### Code Complete
- [ ] SQLc query `SearchLocalities` added to `localities.sql`
- [ ] `cd api && sqlc generate` succeeds
- [ ] Handler uses new search query

### Tests Pass
- [ ] Unit tests for search query pass
- [ ] Integration tests with real data pass
- [ ] Performance benchmarks met

### Data Verified
- [ ] 500k+ rows in geo_search_index
- [ ] Multi-language keywords present
- [ ] Hierarchy populations calculated

### Performance Verified
- [ ] Exact search <5ms (EXPLAIN ANALYZE)
- [ ] Fuzzy search <30ms (EXPLAIN ANALYZE)
- [ ] Index refresh <5 minutes

### Commit Requirements
- [ ] Commit message: `feat(search): implement tiered locality search with multi-language support`
- [ ] Push to remote after commit

---

## Out of Scope

- API endpoint changes (done in Story 10.4)
- Frontend changes (done in Story 10.5)
- Custom ranking algorithms beyond population

---

## Dependencies

- Story 10.1 (Database Schema Migration) - MUST be complete
- Story 10.2 (import-overture) - Data must be imported

## Blocks

- Story 10.4 (Backend Code Updates - needs working search)

---

## Estimated Effort

| Task | Hours |
|------|-------|
| SQLc query implementation | 3 |
| Verify refresh function | 1 |
| Test exact matching | 2 |
| Test fuzzy matching | 2 |
| Test ancestor matching | 2 |
| Performance tuning | 2 |
| Documentation | 1 |
| **Total** | **13** |

---

## Notes

- Trigram threshold 0.3 is a good default; can be tuned later
- Consider adding `SET pg_trgm.similarity_threshold` to session if needed
- Monitor slow query log after deployment
