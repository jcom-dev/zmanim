# Plan: Replace import-wof with import-overture + Schema Restructure

## Summary

Replace WOF (Who's On First) geographic data with Overture Maps Foundation data, restructuring the schema to support:
- Flexible region hierarchy (region → county → localadmin via `parent_region_id`)
- Flexible locality hierarchy (city → neighborhood via `parent_locality_id`)
- Type lookups for granularity preservation
- Enhanced search with ancestor names in ALL languages in keywords array
- Drop city boundaries (localities are point-only)

## Key Decisions

1. **API endpoints**: Rename to `/localities/*` (not `/cities/*`)
2. **Parquet access**: Pure Go parquet reader (no CGO/DuckDB)
3. **Languages**: Simple codes only (`en`, `he`, `ar`) - map complex BCP 47 during import
4. **Continents/Countries**: Fully replace from Overture (not seeded)
5. **Migration**: Clean slate - no backward compatibility, drop old tables directly

---

## New Schema Design

```
geo_continents (seeded)
    ├── boundary (PostGIS)
    └── names in all languages
         │
         ▼
geo_countries (seeded, mapped to continent)
    ├── boundary (PostGIS)
    └── names in all languages
         │
         ▼
geo_regions (flexible hierarchy)
    ├── country_id FK
    ├── parent_region_id FK (nullable, self-reference)
    ├── region_type_id FK → geo_region_types
    ├── boundary (PostGIS)
    └── names in all languages
         │
         ▼
geo_localities (replaces geo_cities)
    ├── region_id FK (lowest-level region)
    ├── parent_locality_id FK (nullable, self-reference)
    ├── locality_type_id FK → geo_locality_types
    ├── lat, lng, population, elevation_m, timezone
    ├── NO boundary
    └── names in all languages
```

**Lookup Tables:**
- `geo_region_types`: region, county, localadmin, district, prefecture, state, province
- `geo_locality_types`: city, town, village, hamlet, neighborhood, borough

---

## Phase 1: Database Migration

### New Tables

```sql
-- Region type lookup
CREATE TABLE geo_region_types (
    id SMALLINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    overture_subtype VARCHAR(30),
    sort_order SMALLINT DEFAULT 0
);

-- Locality type lookup
CREATE TABLE geo_locality_types (
    id SMALLINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    overture_subtype VARCHAR(30),
    sort_order SMALLINT DEFAULT 0
);

-- Seed data for region types
INSERT INTO geo_region_types (code, name, overture_subtype, sort_order) VALUES
('region', 'Region/State', 'region', 1),
('county', 'County', 'county', 2),
('localadmin', 'Local Admin', 'localadmin', 3);

-- Seed data for locality types
INSERT INTO geo_locality_types (code, name, overture_subtype, sort_order) VALUES
('city', 'City', 'city', 1),
('town', 'Town', 'town', 2),
('village', 'Village', 'village', 3),
('hamlet', 'Hamlet', 'hamlet', 4),
('neighborhood', 'Neighborhood', 'neighborhood', 5);
```

### Alter geo_regions

```sql
ALTER TABLE geo_regions
    ADD COLUMN parent_region_id INTEGER REFERENCES geo_regions(id),
    ADD COLUMN region_type_id SMALLINT REFERENCES geo_region_types(id),
    ADD COLUMN population BIGINT,
    ADD COLUMN overture_id TEXT;

CREATE INDEX idx_geo_regions_parent ON geo_regions(parent_region_id);
CREATE INDEX idx_geo_regions_type ON geo_regions(region_type_id);
```

### Create geo_localities (parallel to geo_cities)

```sql
CREATE TABLE geo_localities (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    region_id INTEGER REFERENCES geo_regions(id),
    parent_locality_id INTEGER REFERENCES geo_localities(id),
    locality_type_id SMALLINT REFERENCES geo_locality_types(id),
    name TEXT NOT NULL,
    name_ascii TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    ) STORED,
    timezone TEXT NOT NULL,
    elevation_m INTEGER DEFAULT 0,
    population INTEGER,
    continent_id SMALLINT REFERENCES geo_continents(id),
    country_id SMALLINT REFERENCES geo_countries(id),
    coordinate_source_id INTEGER REFERENCES geo_data_sources(id),
    elevation_source_id INTEGER REFERENCES geo_data_sources(id),
    source_id INTEGER REFERENCES geo_data_sources(id),
    overture_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Enhance geo_names for ancestor search

Add names for ALL entity types (continent, country, region, locality) in ALL languages.

---

## Phase 2: import-overture Command

### Location
`api/cmd/import-overture/`

### Files to Create

| File | Purpose |
|------|---------|
| main.go | Entry point, CLI (download/import/seed/status/reset) |
| download.go | Download Overture Parquet from S3 |
| import.go | Main import orchestration |
| regions.go | Region hierarchy import |
| localities.go | Locality hierarchy import |
| boundaries.go | Country/region boundary import |
| names.go | Multi-language name import |

### Data Source
- AWS S3: `s3://overturemaps-us-west-2/release/2025-*/theme=divisions/*`
- Format: Parquet (use DuckDB for efficient querying)

### Import Order
1. Countries (match to seeded continents)
2. Regions (top-level: region subtype)
3. Sub-regions (county, localadmin with parent_region_id)
4. Localities (city/town/village/hamlet)
5. Sub-localities (neighborhood, borough with parent_locality_id)
6. Boundaries (country, region only - NOT locality)
7. Names (all languages into geo_names)
8. Refresh materialized view

### Continent Mapping (Static)
Country code → continent code mapping file (JSON/CSV, ~250 entries)

---

## Phase 3: Search Index Design

**Key Design:** Single row per locality with ALL keywords from ALL languages combined. Separate display names lookup for localization.

### geo_search_index Table (not materialized view - for faster refresh)

```sql
CREATE TABLE geo_search_index (
    locality_id INTEGER PRIMARY KEY REFERENCES geo_localities(id) ON DELETE CASCADE,

    -- All keywords from ALL languages combined (locality + all ancestors)
    -- Example: ['brooklyn', 'ברוקלין', 'new york', 'ניו יורק', 'usa', 'ארה״ב', 'america', 'אמריקה']
    keywords TEXT[] NOT NULL,

    -- Primary display (English fallback)
    display_name TEXT NOT NULL,           -- "Brooklyn"
    display_hierarchy TEXT NOT NULL,      -- "Brooklyn, New York, USA"

    -- Localized display names (for UI without extra join)
    display_names JSONB,  -- {"en": "Brooklyn", "he": "ברוקלין", "ar": "بروكلين"}

    -- Denormalized for response (no joins needed)
    locality_type_id SMALLINT,
    parent_locality_id INTEGER,
    region_id INTEGER,
    country_id SMALLINT,
    continent_id SMALLINT,
    country_code VARCHAR(2),
    population INTEGER,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    timezone TEXT
);

-- GIN index for keyword array search (exact match)
CREATE INDEX idx_geo_search_keywords ON geo_search_index USING GIN(keywords);

-- Trigram index for fuzzy search on display name
CREATE INDEX idx_geo_search_trgm ON geo_search_index USING GIN(display_name gin_trgm_ops);

-- Population for ranking results
CREATE INDEX idx_geo_search_pop ON geo_search_index(population DESC NULLS LAST);

-- Hierarchy filters
CREATE INDEX idx_geo_search_country ON geo_search_index(country_id);
CREATE INDEX idx_geo_search_region ON geo_search_index(region_id);
```

### Search Query Pattern

```sql
-- User searches: "ברוקלין ניו יורק" → split into ['ברוקלין', 'ניו', 'יורק']
SELECT * FROM geo_search_index
WHERE keywords @> ARRAY['ברוקלין']  -- GIN exact match on any keyword
ORDER BY
    -- Rank by how many search terms match
    (SELECT COUNT(*) FROM unnest(keywords) k WHERE k = ANY($search_terms)) DESC,
    population DESC NULLS LAST
LIMIT 20;
```

### Refresh Function

```sql
CREATE OR REPLACE FUNCTION refresh_geo_search_index() RETURNS void AS $$
BEGIN
    TRUNCATE geo_search_index;

    INSERT INTO geo_search_index (
        locality_id, keywords, display_name, display_hierarchy, display_names,
        locality_type_id, parent_locality_id, region_id, country_id, continent_id,
        country_code, population, latitude, longitude, timezone
    )
    WITH RECURSIVE
    -- Build region hierarchy for each locality
    region_chain AS (
        SELECT l.id as locality_id, r.id as region_id, r.parent_region_id, 1 as depth
        FROM geo_localities l
        JOIN geo_regions r ON l.region_id = r.id
        UNION ALL
        SELECT rc.locality_id, r.id, r.parent_region_id, rc.depth + 1
        FROM region_chain rc
        JOIN geo_regions r ON rc.parent_region_id = r.id
    ),
    -- Collect all names for each entity in all languages
    locality_keywords AS (
        SELECT l.id, array_agg(DISTINCT lower(n.name)) as names
        FROM geo_localities l
        LEFT JOIN geo_names n ON n.entity_type = 'locality' AND n.entity_id = l.id
        GROUP BY l.id
    ),
    region_keywords AS (
        SELECT rc.locality_id, array_agg(DISTINCT lower(n.name)) as names
        FROM region_chain rc
        JOIN geo_names n ON n.entity_type = 'region' AND n.entity_id = rc.region_id
        GROUP BY rc.locality_id
    ),
    country_keywords AS (
        SELECT l.id as locality_id, array_agg(DISTINCT lower(n.name)) as names
        FROM geo_localities l
        JOIN geo_names n ON n.entity_type = 'country' AND n.entity_id = l.country_id
        GROUP BY l.id
    )
    SELECT
        l.id,
        -- Combine all keywords
        array_remove(
            COALESCE(lk.names, ARRAY[]::text[]) ||
            COALESCE(rk.names, ARRAY[]::text[]) ||
            COALESCE(ck.names, ARRAY[]::text[]) ||
            ARRAY[lower(l.name), lower(l.name_ascii), lower(co.code)],
            NULL
        ),
        l.name,
        l.name || ', ' || COALESCE(r.name, '') || ', ' || co.name,
        (SELECT jsonb_object_agg(n.language_code, n.name)
         FROM geo_names n WHERE n.entity_type = 'locality' AND n.entity_id = l.id),
        l.locality_type_id, l.parent_locality_id, l.region_id, l.country_id, l.continent_id,
        co.code, l.population, l.latitude, l.longitude, l.timezone
    FROM geo_localities l
    JOIN geo_countries co ON l.country_id = co.id
    LEFT JOIN geo_regions r ON l.region_id = r.id
    LEFT JOIN locality_keywords lk ON lk.id = l.id
    LEFT JOIN region_keywords rk ON rk.locality_id = l.id
    LEFT JOIN country_keywords ck ON ck.locality_id = l.id;
END;
$$ LANGUAGE plpgsql;
```

---

## Phase 4: Code Updates

### SQLc Queries to Update

| File | Changes |
|------|---------|
| cities.sql → localities.sql | Table references, add type joins |
| geo_boundaries.sql | Remove city boundary queries |
| coverage.sql | city_id → locality_id |
| geo_names.sql | Enhanced materialized view |

### Handlers to Update

| File | Changes |
|------|---------|
| cities.go | Use geo_localities, maintain API paths |
| geo_boundaries.go | Remove city boundary endpoints |
| coverage.go | city_id → locality_id |

### Commands to Update

| Command | Changes |
|---------|---------|
| import-wof/ | DELETE entirely |
| import-elevation/ | geo_cities → geo_localities |
| geo-hierarchy/ | New flexible hierarchy model |
| seed-geodata/ | New schema |

---

## Phase 5: Tables to Drop

After migration verification:
- `geo_districts` (merged into geo_regions)
- `geo_district_boundaries` (merged into geo_region_boundaries)
- `geo_city_boundaries` (localities are point-only)
- `geo_cities` (replaced by geo_localities)

Rename:
- `geo_city_coordinates` → `geo_locality_coordinates`
- `geo_city_elevations` → `geo_locality_elevations`

---

## Critical Files

**Database:**
- db/migrations/00000000000001_schema.sql

**Import Commands:**
- api/cmd/import-wof/ (DELETE)
- api/cmd/import-overture/ (CREATE)
- api/cmd/import-elevation/main.go (UPDATE)

**SQLc Queries:**
- api/internal/db/queries/cities.sql → localities.sql
- api/internal/db/queries/geo_boundaries.sql
- api/internal/db/queries/coverage.sql
- api/internal/db/queries/geo_names.sql

**Handlers:**
- api/internal/handlers/cities.go
- api/internal/handlers/geo_boundaries.go
- api/internal/handlers/coverage.go

---

## Implementation Order (Clean Slate)

Since this is not in production, we can implement cleanly:

### Step 1: Database Schema Migration
1. Drop old tables: `geo_districts`, `geo_district_boundaries`, `geo_city_boundaries`, `geo_cities`
2. Drop related: `geo_city_coordinates`, `geo_city_elevations`
3. Drop old views: `geo_search_index`, `geo_locations_resolved`
4. Create new lookup tables: `geo_region_types`, `geo_locality_types`
5. Alter `geo_regions`: add `parent_region_id`, `region_type_id`, `population`, `overture_id`
6. Create `geo_localities` with new structure
7. Create `geo_locality_coordinates`, `geo_locality_elevations`
8. Update `publisher_coverage`: drop `city_id`, `district_id`, add `locality_id`
9. Create new `geo_search_index` with ancestor names in all languages

### Step 2: Delete Old Code
1. Delete `api/cmd/import-wof/` entirely
2. Delete old SQLc queries referencing dropped tables
3. Delete handlers: cities.go references

### Step 3: Create import-overture Command
1. `main.go` - CLI with download/import/seed/status/reset
2. `parquet.go` - Pure Go parquet reader
3. `continents.go` - Import continents from Overture
4. `countries.go` - Import countries, map to continents
5. `regions.go` - Import regions with hierarchy
6. `localities.go` - Import localities with hierarchy
7. `boundaries.go` - Import boundaries (continent, country, region only)
8. `names.go` - Import all language names

### Step 4: Create New SQLc Queries
1. `localities.sql` - All locality CRUD operations
2. Update `geo_boundaries.sql` - Remove city boundary queries
3. Update `coverage.sql` - Use locality_id
4. Update `geo_names.sql` - New materialized view with ancestor keywords

### Step 5: Create New Handlers
1. `localities.go` - `/localities/*` endpoints
2. Update `geo_boundaries.go` - Remove city boundary endpoints
3. Update `coverage.go` - Use locality_id

### Step 6: Update Related Commands
1. `import-elevation/main.go` - Use `geo_localities`
2. `geo-hierarchy/main.go` - New flexible hierarchy
3. `seed-geodata/main.go` - Update for new schema:
   - Update `geoTables` list: remove `geo_cities`, `geo_districts`, `geo_city_*`, add `geo_localities`, `geo_locality_*`
   - Add index drop/recreate logic for faster bulk import:
     ```go
     // Drop GIN/GiST indexes before restore (very slow to maintain during bulk insert)
     dropGeoIndexes(ctx, pool)  // Drops idx_geo_search_keywords, idx_geo_localities_*, etc.
     defer recreateGeoIndexes(ctx, pool)  // Recreate after restore
     ```
   - Update FK constraint queries to find new table references

### Step 7: Frontend Updates
1. Rename city references to locality
2. Update API client types
3. Update location search components

### Step 8: Performance Optimization (DoD)
1. Enable slow query logging in PostgreSQL
2. Run import-overture with full dataset
3. Execute common search queries and identify slow ones (>100ms)
4. Use EXPLAIN ANALYZE on slow queries
5. Add missing indexes or optimize query patterns
6. Document query performance benchmarks

**Slow Query Logging Setup:**
```sql
-- Enable in postgresql.conf or via ALTER SYSTEM
ALTER SYSTEM SET log_min_duration_statement = 100;  -- Log queries >100ms
ALTER SYSTEM SET log_statement = 'none';  -- Don't log all statements
SELECT pg_reload_conf();

-- Check slow queries in pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

**Target Performance:**
- Search query: <50ms for keyword match
- Locality lookup by ID: <5ms
- Search index refresh: <5min for 500k localities
