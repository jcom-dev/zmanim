# Story 10.1: Database Schema Migration for Overture Geographic Data

**Story ID:** 10.1
**Epic:** Epic 10 - Overture Geographic Data Migration
**Points:** 8
**Priority:** HIGH - Blocks all other Epic 10 stories
**Risk:** Medium

---

## User Story

**As a** developer
**I want** the database schema restructured to support Overture geographic data
**So that** we can import flexible locality hierarchies with multi-language names

---

## Background

The current schema uses `geo_cities` with a flat structure. We need:
- Flexible region hierarchy (region → county → localadmin)
- Flexible locality hierarchy (city → neighborhood)
- Type lookup tables for granularity preservation
- Support for 500k+ localities with proper indexing

---

## Acceptance Criteria

### AC1: Lookup Tables Created
- [ ] `geo_region_types` table exists with columns: `id`, `code`, `name`, `overture_subtype`, `sort_order`
- [ ] `geo_locality_types` table exists with columns: `id`, `code`, `name`, `overture_subtype`, `sort_order`
- [ ] Region types seeded: `region`, `state`, `province`, `county`, `localadmin`, `district`, `prefecture`
- [ ] Locality types seeded: `city`, `town`, `village`, `hamlet`, `neighborhood`, `borough`

**Verification:**
```sql
SELECT * FROM geo_region_types ORDER BY sort_order;
-- Expected: 7 rows

SELECT * FROM geo_locality_types ORDER BY sort_order;
-- Expected: 6 rows
```

### AC2: geo_regions Altered
- [ ] Column `parent_region_id` added (INTEGER, FK to geo_regions, nullable)
- [ ] Column `region_type_id` added (SMALLINT, FK to geo_region_types)
- [ ] Column `population` added (BIGINT)
- [ ] Column `overture_id` added (TEXT)
- [ ] Index `idx_geo_regions_parent` created on `parent_region_id`
- [ ] Index `idx_geo_regions_type` created on `region_type_id`
- [ ] Index `idx_geo_regions_overture` created on `overture_id`

**Verification:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'geo_regions'
  AND column_name IN ('parent_region_id', 'region_type_id', 'population', 'overture_id');
-- Expected: 4 rows with correct types

SELECT indexname FROM pg_indexes WHERE tablename = 'geo_regions' AND indexname LIKE 'idx_geo_regions_%';
-- Expected: idx_geo_regions_parent, idx_geo_regions_type, idx_geo_regions_overture
```

### AC3: geo_localities Table Created
- [ ] Table `geo_localities` exists with all required columns:
  - `id` (INTEGER, PRIMARY KEY, GENERATED ALWAYS AS IDENTITY)
  - `region_id` (INTEGER, FK to geo_regions)
  - `parent_locality_id` (INTEGER, FK to geo_localities, nullable)
  - `locality_type_id` (SMALLINT, FK to geo_locality_types)
  - `name`, `name_ascii` (TEXT)
  - `latitude`, `longitude` (DOUBLE PRECISION, NOT NULL)
  - `location` (GEOGRAPHY, GENERATED)
  - `timezone` (TEXT, NOT NULL)
  - `elevation_m` (INTEGER, DEFAULT 0)
  - `population` (INTEGER)
  - `continent_id`, `country_id` (FKs)
  - `coordinate_source_id`, `elevation_source_id`, `source_id` (FKs to geo_data_sources)
  - `overture_id` (TEXT)
  - `created_at`, `updated_at` (TIMESTAMPTZ)

**Verification:**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'geo_localities'
ORDER BY ordinal_position;
-- Expected: 18+ columns
```

### AC4: geo_localities Indexes Created
- [ ] `idx_geo_localities_region` on `region_id`
- [ ] `idx_geo_localities_parent` on `parent_locality_id`
- [ ] `idx_geo_localities_type` on `locality_type_id`
- [ ] `idx_geo_localities_country` on `country_id`
- [ ] `idx_geo_localities_location` GIST index on `location`
- [ ] `idx_geo_localities_name` on `name`
- [ ] `idx_geo_localities_overture` on `overture_id`
- [ ] `idx_geo_localities_population` on `population DESC NULLS LAST`

**Verification:**
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'geo_localities';
-- Expected: 8 indexes
```

### AC5: geo_search_index Table Created
- [ ] Table exists with composite PK `(entity_type, entity_id)`
- [ ] Column `keywords` (TEXT[], NOT NULL)
- [ ] Column `display_name`, `display_hierarchy` (TEXT, NOT NULL)
- [ ] Column `display_names` (JSONB)
- [ ] Denormalized columns for response (locality_type_id, region_id, country_id, etc.)
- [ ] GIN index `idx_geo_search_keywords` on `keywords`
- [ ] GIN trigram index `idx_geo_search_trgm` on `display_name`
- [ ] B-tree index `idx_geo_search_pop` on `population DESC NULLS LAST`

**Verification:**
```sql
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'geo_search_index';
-- Expected: 3+ indexes including GIN indexes
```

### AC6: geo_hierarchy_populations Materialized View Created
- [ ] Materialized view exists
- [ ] Unique index `idx_geo_hierarchy_pop_pk` on `(entity_type, entity_id)`
- [ ] Index `idx_geo_hierarchy_pop_total` on `total_population DESC`
- [ ] View can be refreshed without error

**Verification:**
```sql
SELECT schemaname, matviewname FROM pg_matviews WHERE matviewname = 'geo_hierarchy_populations';
-- Expected: 1 row

REFRESH MATERIALIZED VIEW geo_hierarchy_populations;
-- Expected: No error (may return 0 rows before data import)
```

### AC7: Old Tables Preserved for Transition
- [ ] `geo_cities` still exists (will be dropped after import verification)
- [ ] `geo_districts` still exists (will be dropped after import verification)
- [ ] `publisher_coverage.city_id` FK still works

**Verification:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('geo_cities', 'geo_districts');
-- Expected: 2 rows (tables still exist)
```

### AC8: publisher_coverage Updated
- [ ] Column `locality_id` added (INTEGER, FK to geo_localities, nullable)

**Verification:**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'publisher_coverage' AND column_name = 'locality_id';
-- Expected: 1 row
```

### AC9: Migration File Follows Standards
- [ ] Migration file named `00000000000003_overture_schema.sql` (or next sequence)
- [ ] All SQL statements are idempotent (can be run multiple times safely)
- [ ] No raw SQL outside migration file
- [ ] Migration runs successfully via `./scripts/migrate.sh`

**Verification:**
```bash
./scripts/migrate.sh
# Expected: Migration completes without error
```

### AC10: SQLc Generates Successfully
- [ ] `cd api && sqlc generate` completes without error
- [ ] Generated Go types include new tables

**Verification:**
```bash
cd api && sqlc generate
# Expected: No errors

ls api/internal/db/sqlcgen/ | grep -i localit
# Expected: Files referencing localities
```

---

## Technical Implementation

### Migration File Location
`db/migrations/00000000000003_overture_schema.sql`

### SQL to Execute (in order)

1. Create lookup tables with seed data
2. Alter geo_regions (add columns, indexes)
3. Create geo_localities with indexes
4. Create geo_search_index with indexes
5. Create geo_hierarchy_populations materialized view
6. Add locality_id to publisher_coverage

### Key Constraints

- All FKs use INTEGER references (per coding-standards.md)
- Lookup tables use SMALLINT GENERATED ALWAYS AS IDENTITY
- GEOGRAPHY column is GENERATED (computed from lat/lng)
- pg_trgm extension required for fuzzy search

---

## Definition of Done

### Code Complete
- [ ] Migration file created at correct path
- [ ] Migration is idempotent (IF NOT EXISTS, etc.)
- [ ] All 8 indexes on geo_localities created
- [ ] GIN and trigram indexes on geo_search_index created
- [ ] Materialized view refreshable

### Tests Pass
- [ ] `./scripts/migrate.sh` runs without error
- [ ] `cd api && sqlc generate` succeeds
- [ ] `cd api && go build ./...` succeeds
- [ ] Verification queries return expected results (see each AC)

### Documentation
- [ ] Migration file has header comments explaining purpose
- [ ] Any non-obvious SQL has inline comments

### Commit Requirements
- [ ] Single commit with message: `feat(db): add Overture geographic schema migration`
- [ ] Commit includes only migration file and any required SQLc updates
- [ ] Push to remote after commit

---

## Out of Scope

- Dropping old tables (done in Story 10.6 after verification)
- Populating data (done in Story 10.2)
- Creating SQLc queries (done in Story 10.4)
- Frontend changes (done in Story 10.5)

---

## Dependencies

- None (first story in epic)

## Blocks

- Story 10.2 (import-overture CLI)
- Story 10.3 (Search index implementation)
- Story 10.4 (Backend code updates)

---

## Estimated Effort

| Task | Hours |
|------|-------|
| Write migration SQL | 2 |
| Test migration locally | 1 |
| Verify all ACs | 1 |
| Fix issues | 1 |
| Documentation | 0.5 |
| **Total** | **5.5** |

---

## Notes

- This is a clean slate migration - no backward compatibility gymnastics needed
- Old tables preserved temporarily to allow comparison during import
- Index creation may be slow on production data; consider CONCURRENTLY if needed later
