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
| main.go | Entry point, CLI (download/import/refresh/status/reset) |
| download.go | Download Overture Parquet from S3 |
| import.go | Main import orchestration |
| regions.go | Region hierarchy import |
| localities.go | Locality hierarchy import |
| boundaries.go | Country/region boundary import |
| names.go | Multi-language name import |
| refresh.go | Refresh materialized views (`geo_hierarchy_populations`, `geo_search_index`) |

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
8. **Refresh materialized views** (order matters):
   - `REFRESH MATERIALIZED VIEW geo_hierarchy_populations` — aggregated populations
   - `TRUNCATE geo_search_index` + repopulate — search index with keywords

### CLI Subcommands

```bash
import-overture download    # Download Overture Parquet files from S3
import-overture import      # Run full import (steps 1-8)
import-overture refresh     # Refresh materialized views only (step 8)
import-overture status      # Show import progress/stats
import-overture reset       # Drop and recreate geo tables (dangerous)
```

### Continent Mapping (Static)
Country code → continent code mapping file (JSON/CSV, ~250 entries)

---

## Phase 3: Search Index Design

**Key Design:** Single row per locality with ALL keywords from ALL languages combined. Separate display names lookup for localization.

### geo_search_index Table (not materialized view - for faster refresh)

```sql
CREATE TABLE geo_search_index (
    -- Composite primary key for multi-entity support
    entity_type VARCHAR(20) NOT NULL,  -- 'locality', 'region', 'country'
    entity_id INTEGER NOT NULL,
    PRIMARY KEY (entity_type, entity_id),

    -- Foreign key only for localities (optional - for cascade delete)
    locality_id INTEGER REFERENCES geo_localities(id) ON DELETE CASCADE,

    -- All keywords from ALL languages combined (entity + all ancestors)
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
    population BIGINT,  -- BIGINT to support aggregated populations (countries can exceed 1B)
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

-- Entity type filter (for searching only localities, or including regions/countries)
CREATE INDEX idx_geo_search_type ON geo_search_index(entity_type);

-- Hierarchy filters
CREATE INDEX idx_geo_search_country ON geo_search_index(country_id);
CREATE INDEX idx_geo_search_region ON geo_search_index(region_id);
```

### Search Query Pattern — Tiered Ranking

**Search Priority (in order):**
1. **Exact keyword match on locality name** (any language) → highest priority
2. **Exact keyword match on ancestor** (region/country in any language) → high priority
3. **Fuzzy trigram match** → lower priority
4. **Within each tier:** Sort by population DESC

**Query Strategy:**

```sql
-- Input: User searches "ברוקלין" or "brooklyn new york"
-- Step 1: Normalize input → lowercase, split into terms
-- Step 2: Execute tiered search

WITH search_terms AS (
    -- Normalize: lowercase, split by spaces
    SELECT unnest(string_to_array(lower(@query), ' ')) AS term
),
term_count AS (
    SELECT COUNT(*) AS total FROM search_terms
),

-- TIER 1: Exact keyword matches (GIN index - super fast)
exact_matches AS (
    SELECT
        s.*,
        -- Count how many search terms match keywords exactly
        (SELECT COUNT(*) FROM search_terms st
         WHERE st.term = ANY(s.keywords)) AS matched_terms,
        -- Bonus: Does the entity's own name match? (vs ancestor match)
        CASE WHEN EXISTS (
            SELECT 1 FROM geo_names n
            WHERE n.entity_type = s.entity_type
              AND n.entity_id = s.entity_id
              AND lower(n.name) = ANY(SELECT term FROM search_terms)
        ) THEN 1 ELSE 0 END AS name_match_bonus,
        1 AS tier
    FROM geo_search_index s
    WHERE s.keywords && (SELECT ARRAY_AGG(term) FROM search_terms)  -- At least one term matches
      AND (@entity_types::text[] IS NULL OR s.entity_type = ANY(@entity_types))  -- Optional type filter
),

-- TIER 2: Fuzzy trigram matches (only if exact matches < limit)
fuzzy_matches AS (
    SELECT
        s.*,
        -- Trigram similarity score (0-1)
        similarity(s.display_name, @query) AS sim_score,
        0 AS matched_terms,
        0 AS name_match_bonus,
        2 AS tier
    FROM geo_search_index s
    WHERE s.display_name % @query  -- Trigram similarity threshold (default 0.3)
      AND (s.entity_type, s.entity_id) NOT IN (SELECT entity_type, entity_id FROM exact_matches)
      AND (@entity_types::text[] IS NULL OR s.entity_type = ANY(@entity_types))
),

-- Combine results with proper ranking
ranked_results AS (
    SELECT *,
        ROW_NUMBER() OVER (
            ORDER BY
                tier ASC,                           -- Exact matches first
                name_match_bonus DESC,              -- Entity name match > ancestor match
                matched_terms DESC,                 -- More matching terms = better
                population DESC NULLS LAST          -- Larger populations first within tier
        ) AS rank
    FROM (
        SELECT entity_type, entity_id, locality_id, display_name, display_hierarchy, display_names,
               locality_type_id, parent_locality_id, region_id, country_id,
               continent_id, country_code, population, latitude, longitude,
               timezone, matched_terms, name_match_bonus, tier
        FROM exact_matches
        UNION ALL
        SELECT entity_type, entity_id, locality_id, display_name, display_hierarchy, display_names,
               locality_type_id, parent_locality_id, region_id, country_id,
               continent_id, country_code, population, latitude, longitude,
               timezone, matched_terms, name_match_bonus, tier
        FROM fuzzy_matches
    ) combined
)

SELECT * FROM ranked_results
WHERE rank <= @limit
ORDER BY rank;
```

**Ranking Tiers Explained:**

| Tier | Match Type | Example Query | Matches | Priority |
|------|------------|---------------|---------|----------|
| 1A | Exact entity name (any lang) | `london` | London, England (city name match) | Highest |
| 1B | Exact entity name (any lang) | `ירושלים` | Jerusalem (Hebrew name exact match) | Highest |
| 1C | Exact ancestor keyword | `london` | Cities IN London (ancestor match) | Medium |
| 1D | Exact ancestor keyword | `new york` | All localities in New York state/city | Medium |
| 2 | Fuzzy trigram | `jeruslem` (typo) | Jerusalem (similarity > 0.3) | Lowest |

**Key Insight:** When searching "London", the city named London ranks BEFORE neighborhoods/boroughs within London because:
- `name_match_bonus = 1` for London city (entity's own name matches)
- `name_match_bonus = 0` for Camden, Westminster, etc. (only ancestor matches)

**Example: Search for "London"**

| Result | name_match_bonus | population | Final Rank |
|--------|------------------|------------|------------|
| London, England (City) | 1 | 8,982,000 | **1st** |
| London, Ontario, Canada (City) | 1 | 422,000 | **2nd** |
| Camden, London, England (Borough) | 0 | 270,000 | 3rd |
| Westminster, London, England (Borough) | 0 | 261,000 | 4th |
| Tower Hamlets, London, England (Borough) | 0 | 310,000 | 5th |

The ranking ensures:
1. Cities/towns NAMED "London" appear first (sorted by population)
2. Neighborhoods/boroughs WITHIN London appear after (sorted by population)

**Multi-Language Exact Match Examples:**

| Query | Language | Matches (Tier 1A) |
|-------|----------|-------------------|
| `jerusalem` | English | Jerusalem, Israel |
| `ירושלים` | Hebrew | Jerusalem, Israel |
| `القدس` | Arabic | Jerusalem, Israel |
| `иерусалим` | Russian | Jerusalem, Israel |

**Performance Optimizations:**

1. **GIN index on keywords[]** — O(log n) for exact array containment
2. **Trigram GIN index** — Only activated for fuzzy tier (when exact fails)
3. **Population B-tree index** — Fast sorting within tiers
4. **Early termination** — If exact matches >= limit, skip fuzzy entirely

**Index Configuration:**

```sql
-- Exact keyword matching (primary)
CREATE INDEX idx_geo_search_keywords ON geo_search_index USING GIN(keywords);

-- Fuzzy matching (fallback)
CREATE INDEX idx_geo_search_trgm ON geo_search_index USING GIN(display_name gin_trgm_ops);

-- Population ranking (all tiers)
CREATE INDEX idx_geo_search_pop ON geo_search_index(population DESC NULLS LAST);

-- Composite for filtered searches
CREATE INDEX idx_geo_search_country_pop ON geo_search_index(country_id, population DESC NULLS LAST);
CREATE INDEX idx_geo_search_region_pop ON geo_search_index(region_id, population DESC NULLS LAST);

-- Set trigram similarity threshold (default 0.3, can tune)
SET pg_trgm.similarity_threshold = 0.3;
```

**Expected Performance:**

| Scenario | Expected Time | Index Used |
|----------|---------------|------------|
| Exact keyword (1 term) | < 5ms | GIN keywords |
| Exact keyword (3 terms) | < 10ms | GIN keywords |
| Fuzzy fallback | < 30ms | GIN trigram |
| Filtered by country + exact | < 5ms | Composite + GIN |

---

### Aggregated Population for Hierarchy Ranking

**Problem:** Regions and countries may not have their own `population` field, making ranking unreliable when searching for areas (not just localities).

**Solution:** Calculate and store aggregated population from descendant localities at each hierarchy level.

#### Design Decision: Materialized View vs Stored Columns

| Approach | Pros | Cons |
|----------|------|------|
| **Stored columns** | Fast reads, simple queries | Stale data, manual refresh, schema pollution |
| **Regular views** | Always accurate | Slow (recursive CTE on every query) |
| **Materialized view** | Fast reads, computed from source, explicit refresh | Refresh required, but intentional |

**Decision:** Use **materialized view** for aggregated populations. This keeps source tables clean while providing fast reads. The view is refreshed after Overture import and can be refreshed on-demand.

#### Materialized View: geo_hierarchy_populations

```sql
-- Materialized view for aggregated populations (computed, not stored in source tables)
CREATE MATERIALIZED VIEW geo_hierarchy_populations AS
WITH RECURSIVE
-- Step 1: Aggregate localities to their direct regions
locality_to_region AS (
    SELECT region_id, SUM(COALESCE(population, 0)) AS direct_population
    FROM geo_localities
    WHERE region_id IS NOT NULL
    GROUP BY region_id
),

-- Step 2: Build region tree with recursive population rollup
region_tree AS (
    -- Leaf regions (no children): start with direct population
    SELECT
        r.id AS region_id,
        r.parent_region_id,
        r.country_id,
        COALESCE(ltr.direct_population, 0) AS direct_population,
        COALESCE(ltr.direct_population, 0) AS total_population,
        1 AS depth
    FROM geo_regions r
    LEFT JOIN locality_to_region ltr ON ltr.region_id = r.id
    WHERE r.id NOT IN (
        SELECT DISTINCT parent_region_id FROM geo_regions WHERE parent_region_id IS NOT NULL
    )

    UNION ALL

    -- Parent regions: add children's totals
    SELECT
        r.id,
        r.parent_region_id,
        r.country_id,
        COALESCE(ltr.direct_population, 0),
        COALESCE(ltr.direct_population, 0) + COALESCE(child_totals.sum_total, 0),
        rt.depth + 1
    FROM geo_regions r
    LEFT JOIN locality_to_region ltr ON ltr.region_id = r.id
    JOIN (
        SELECT parent_region_id, SUM(total_population) AS sum_total
        FROM region_tree
        WHERE parent_region_id IS NOT NULL
        GROUP BY parent_region_id
    ) child_totals ON r.id = child_totals.parent_region_id
    JOIN region_tree rt ON rt.parent_region_id = r.id
),

-- Step 3: Final region populations (deduplicated)
region_populations AS (
    SELECT DISTINCT ON (region_id)
        'region' AS entity_type,
        region_id AS entity_id,
        direct_population,
        total_population
    FROM region_tree
    ORDER BY region_id, depth DESC
),

-- Step 4: Country populations from top-level regions + direct localities
country_populations AS (
    SELECT
        'country' AS entity_type,
        c.id AS entity_id,
        -- Direct: localities without region assignment
        COALESCE((
            SELECT SUM(COALESCE(population, 0))
            FROM geo_localities l
            WHERE l.country_id = c.id AND l.region_id IS NULL
        ), 0) AS direct_population,
        -- Total: direct + all top-level regions
        COALESCE((
            SELECT SUM(COALESCE(population, 0))
            FROM geo_localities l
            WHERE l.country_id = c.id AND l.region_id IS NULL
        ), 0) + COALESCE((
            SELECT SUM(rp.total_population)
            FROM region_populations rp
            JOIN geo_regions r ON r.id = rp.entity_id
            WHERE r.country_id = c.id AND r.parent_region_id IS NULL
        ), 0) AS total_population
    FROM geo_countries c
)

-- Combine all hierarchy populations
SELECT * FROM region_populations
UNION ALL
SELECT * FROM country_populations;

-- Index for fast lookups
CREATE UNIQUE INDEX idx_geo_hierarchy_pop_pk ON geo_hierarchy_populations(entity_type, entity_id);
CREATE INDEX idx_geo_hierarchy_pop_total ON geo_hierarchy_populations(total_population DESC NULLS LAST);
```

#### Refresh Function

```sql
-- Simple refresh (use CONCURRENTLY in production for zero-downtime)
CREATE OR REPLACE FUNCTION refresh_hierarchy_populations() RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY geo_hierarchy_populations;
    RAISE NOTICE 'Hierarchy populations refreshed: % rows',
        (SELECT COUNT(*) FROM geo_hierarchy_populations);
END;
$$ LANGUAGE plpgsql;
```

#### Usage in Search Index

The search index refresh function joins with this materialized view:

```sql
-- When populating geo_search_index for regions/countries, use the materialized view
SELECT
    r.id,
    hp.total_population AS population  -- From materialized view, not stored column
FROM geo_regions r
JOIN geo_hierarchy_populations hp
    ON hp.entity_type = 'region' AND hp.entity_id = r.id;
```

#### Example Hierarchy with Populations

```
USA (total_population: 331M)
├── New York State (total_population: 19.5M)
│   ├── New York City (population: 8.3M)  ← locality
│   │   ├── Brooklyn (population: 2.7M)   ← neighborhood locality
│   │   ├── Manhattan (population: 1.6M)  ← neighborhood locality
│   │   └── Queens (population: 2.3M)     ← neighborhood locality
│   ├── Buffalo (population: 278K)        ← locality
│   └── Rochester (population: 211K)      ← locality
└── California (total_population: 39.5M)
    ├── Los Angeles (population: 3.9M)    ← locality
    └── San Francisco (population: 874K)  ← locality
```

#### Updated Search Index for Hierarchy Entities

To enable searching for regions/countries (not just localities), extend the search index using the materialized view:

```sql
-- Add region/country search entries with aggregated population from materialized view
INSERT INTO geo_search_index (
    entity_type, entity_id, keywords, display_name, display_hierarchy,
    locality_type_id, region_id, country_id, continent_id, country_code,
    population, latitude, longitude
)
-- Regions (use total_population from materialized view for ranking)
SELECT
    'region' AS entity_type,
    r.id AS entity_id,
    array_agg(DISTINCT lower(n.name)) AS keywords,
    r.name AS display_name,
    r.name || ', ' || c.name AS display_hierarchy,
    NULL AS locality_type_id,
    r.id AS region_id,
    r.country_id,
    c.continent_id,
    c.code AS country_code,
    hp.total_population AS population,  -- From materialized view
    ST_Y(ST_Centroid(r.boundary::geometry)) AS latitude,
    ST_X(ST_Centroid(r.boundary::geometry)) AS longitude
FROM geo_regions r
JOIN geo_countries c ON r.country_id = c.id
JOIN geo_hierarchy_populations hp ON hp.entity_type = 'region' AND hp.entity_id = r.id
LEFT JOIN geo_names n ON n.entity_type = 'region' AND n.entity_id = r.id
GROUP BY r.id, c.id, hp.total_population

UNION ALL

-- Countries (use total_population from materialized view for ranking)
SELECT
    'country' AS entity_type,
    c.id AS entity_id,
    array_agg(DISTINCT lower(n.name)) AS keywords,
    c.name AS display_name,
    c.name AS display_hierarchy,
    NULL,
    NULL,
    c.id,
    c.continent_id,
    c.code,
    hp.total_population AS population,  -- From materialized view
    ST_Y(ST_Centroid(c.boundary::geometry)),
    ST_X(ST_Centroid(c.boundary::geometry))
FROM geo_countries c
JOIN geo_hierarchy_populations hp ON hp.entity_type = 'country' AND hp.entity_id = c.id
LEFT JOIN geo_names n ON n.entity_type = 'country' AND n.entity_id = c.id
GROUP BY c.id, hp.total_population;
```

#### Use Cases

| Search Query | Tier 1 Matches | Ranking Factor |
|--------------|----------------|----------------|
| `new york` | New York City (8.3M), New York State (19.5M total) | State ranks higher due to total_population |
| `california` | California (39.5M total) | Uses aggregated population |
| `brooklyn` | Brooklyn, NYC (2.7M) | Uses locality population |
| `israel` | Israel (9.2M total) | Uses country total_population |

#### Refresh Schedule

Refresh the materialized view after:
1. Initial Overture import completes
2. Any bulk locality data update
3. Scheduled nightly maintenance (optional)

```sql
-- After Overture import (order matters: populations first, then search index)
SELECT refresh_hierarchy_populations();  -- Materialized view
SELECT refresh_geo_search_index();       -- Uses the refreshed populations
```

**Note:** `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires a unique index and allows reads during refresh. For initial import, use non-concurrent refresh for faster execution.

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

---

## Phase 6: UI Unification — Unified LocalityPicker Component

### Problem Statement

Currently, locality/city search is fragmented across **3 separate components** with significant code duplication:

| Component | Lines | Purpose | Duplicated Code |
|-----------|-------|---------|-----------------|
| `LocationSearch.tsx` | 604 | General search, single-select | Icons, badges, colors, hierarchy builder, debounce, keyboard nav |
| `CoverageSearchPanel.tsx` | 538 | Coverage multi-select + filters | Same as above |
| `CitySelector.tsx` | 404 | Step-by-step Country → Region → City | Different pattern, duplicates search logic |

**Duplications identified:**
- `getTypeIcon()` — defined 3x identically
- `getTypeBadgeColor()` — defined 3x identically
- `getTypeLabel()` — defined 3x identically
- `buildHierarchyDescription()` — defined 2x
- `ApiSearchResult` interface — defined 2x
- `mapApiResultToSearchResult()` — defined 2x
- `QUICK_SELECT_CITIES` — defined 2x
- Debounce + keyboard navigation logic — duplicated

Additionally, the **home page** (`app/page.tsx`, 812 lines) has its own inline search implementation that should use the unified component.

### Solution: Unified `LocalityPicker` Component

Create a single, configurable component that handles all locality selection use cases.

---

### 6.1 Shared Utilities — `web/lib/locality-display.ts`

Extract all display logic into a single utility file:

```typescript
/**
 * @file locality-display.ts
 * @purpose Centralized locality display utilities (icons, badges, colors, labels)
 * @pattern utility
 */

import { MapPin, Globe, Globe2, Map as MapIcon, Layers, Home, Building, TreeDeciduous } from 'lucide-react';
import type { LocalityType, RegionType } from '@/types/geography';

// ============================================================================
// LOCALITY TYPE DISPLAY
// ============================================================================

/** Locality types from geo_locality_types table */
export type LocalityTypeCode = 'city' | 'town' | 'village' | 'hamlet' | 'neighborhood' | 'borough';

/** Region types from geo_region_types table */
export type RegionTypeCode = 'region' | 'county' | 'localadmin' | 'state' | 'province' | 'prefecture';

/** All geographic entity types */
export type GeoEntityType = 'continent' | 'country' | RegionTypeCode | LocalityTypeCode;

/** Icon mapping for each entity type */
export function getEntityIcon(type: GeoEntityType, className = 'w-4 h-4') {
  const icons: Record<GeoEntityType, React.ReactNode> = {
    // Hierarchy levels
    continent: <Globe2 className={className} />,
    country: <Globe className={className} />,
    // Region types
    region: <MapIcon className={className} />,
    state: <MapIcon className={className} />,
    province: <MapIcon className={className} />,
    prefecture: <MapIcon className={className} />,
    county: <Layers className={className} />,
    localadmin: <Layers className={className} />,
    // Locality types
    city: <Building className={className} />,
    town: <Building className={className} />,
    village: <Home className={className} />,
    hamlet: <TreeDeciduous className={className} />,
    neighborhood: <MapPin className={className} />,
    borough: <MapPin className={className} />,
  };
  return icons[type] || <MapPin className={className} />;
}

/** Badge color classes for each entity type */
export function getEntityBadgeColor(type: GeoEntityType): string {
  const colors: Record<string, string> = {
    // Hierarchy levels
    continent: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    country: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    // Region types (green family)
    region: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    state: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    province: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    prefecture: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    county: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    localadmin: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    // Locality types (warm family)
    city: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    town: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    village: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    hamlet: 'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300',
    neighborhood: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    borough: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  };
  return colors[type] || 'bg-primary/10 text-primary';
}

/** Text color for icons */
export function getEntityTextColor(type: GeoEntityType): string {
  const colors: Record<string, string> = {
    continent: 'text-purple-600 dark:text-purple-400',
    country: 'text-blue-600 dark:text-blue-400',
    region: 'text-green-600 dark:text-green-400',
    state: 'text-green-600 dark:text-green-400',
    province: 'text-green-600 dark:text-green-400',
    county: 'text-emerald-600 dark:text-emerald-400',
    localadmin: 'text-teal-600 dark:text-teal-400',
    city: 'text-amber-600 dark:text-amber-400',
    town: 'text-orange-600 dark:text-orange-400',
    village: 'text-yellow-600 dark:text-yellow-400',
    hamlet: 'text-lime-600 dark:text-lime-400',
    neighborhood: 'text-rose-600 dark:text-rose-400',
    borough: 'text-pink-600 dark:text-pink-400',
  };
  return colors[type] || 'text-primary';
}

/** Human-readable label for entity type */
export function getEntityLabel(type: GeoEntityType): string {
  const labels: Record<GeoEntityType, string> = {
    continent: 'Continent',
    country: 'Country',
    region: 'Region',
    state: 'State',
    province: 'Province',
    prefecture: 'Prefecture',
    county: 'County',
    localadmin: 'Local Admin',
    city: 'City',
    town: 'Town',
    village: 'Village',
    hamlet: 'Hamlet',
    neighborhood: 'Neighborhood',
    borough: 'Borough',
  };
  return labels[type] || type;
}

// ============================================================================
// HIERARCHY DISPLAY
// ============================================================================

export interface HierarchyDisplayOptions {
  /** Maximum width in characters before truncation */
  maxWidth?: 'sm' | 'md' | 'lg' | 'full';
  /** Show locality type badge */
  showTypeBadge?: boolean;
  /** Separator between hierarchy levels */
  separator?: string;
  /** Show full hierarchy or abbreviated */
  format?: 'full' | 'abbreviated' | 'minimal';
}

/**
 * Build hierarchy breadcrumb for display.
 *
 * Examples (full format):
 * - "Brooklyn (Neighborhood) → New York City → New York → USA"
 * - "Manchester (City) → Greater Manchester → England → UK"
 *
 * Examples (abbreviated format):
 * - "Brooklyn → NYC → NY → USA"
 *
 * Examples (minimal format):
 * - "Brooklyn, NYC, USA"
 */
export function buildHierarchyDisplay(
  locality: {
    name: string;
    locality_type?: string;
    parent_locality_name?: string;
    region_name?: string;
    country_name?: string;
    country_code?: string;
  },
  options: HierarchyDisplayOptions = {}
): string {
  const {
    format = 'full',
    separator = format === 'minimal' ? ', ' : ' → ',
  } = options;

  const parts: string[] = [];

  // Locality name (with type for full format)
  if (format === 'full' && locality.locality_type && locality.locality_type !== 'city') {
    parts.push(`${locality.name} (${getEntityLabel(locality.locality_type as GeoEntityType)})`);
  } else {
    parts.push(locality.name);
  }

  // Parent locality (neighborhood → city)
  if (locality.parent_locality_name) {
    parts.push(locality.parent_locality_name);
  }

  // Region
  if (locality.region_name) {
    parts.push(locality.region_name);
  }

  // Country (use code for abbreviated/minimal)
  if (format === 'full' && locality.country_name) {
    parts.push(locality.country_name);
  } else if (locality.country_code) {
    parts.push(locality.country_code);
  }

  return parts.join(separator);
}

/**
 * Build responsive hierarchy that adapts to container width.
 * Returns array of parts that can be conditionally rendered.
 */
export function buildResponsiveHierarchy(
  locality: {
    name: string;
    locality_type?: string;
    parent_locality_name?: string;
    region_name?: string;
    country_name?: string;
    country_code?: string;
  }
): {
  full: string[];      // All parts for wide screens
  medium: string[];    // Key parts for medium screens
  minimal: string[];   // Essential parts for narrow screens
} {
  const full: string[] = [locality.name];
  const medium: string[] = [locality.name];
  const minimal: string[] = [locality.name];

  if (locality.parent_locality_name) {
    full.push(locality.parent_locality_name);
    medium.push(locality.parent_locality_name);
  }

  if (locality.region_name) {
    full.push(locality.region_name);
  }

  if (locality.country_name) {
    full.push(locality.country_name);
    medium.push(locality.country_code || locality.country_name);
    minimal.push(locality.country_code || locality.country_name);
  }

  return { full, medium, minimal };
}

// ============================================================================
// QUICK SELECT LOCALITIES
// ============================================================================

/** Popular localities for quick selection */
export const POPULAR_LOCALITIES = [
  { id: '1626940', name: 'Jerusalem', country: 'Israel', countryCode: 'IL' },
  { id: '4337144', name: 'New York', country: 'USA', countryCode: 'US' },
  { id: '3483797', name: 'Los Angeles', country: 'USA', countryCode: 'US' },
  { id: '1553482', name: 'London', country: 'UK', countryCode: 'GB' },
  { id: '1627539', name: 'Tel Aviv', country: 'Israel', countryCode: 'IL' },
  { id: '3484030', name: 'Miami', country: 'USA', countryCode: 'US' },
] as const;
```

---

### 6.2 Search Hook — `web/lib/hooks/useLocalitySearch.ts`

Unified search hook with debounce, cancellation, and filtering:

```typescript
/**
 * @file useLocalitySearch.ts
 * @purpose Unified locality search hook with debounce and filtering
 * @pattern custom-hook
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApi } from '@/lib/api-client';
import type { LocalitySearchResult, GeoEntityType } from '@/types/geography';

/** API response shape */
interface ApiSearchResult {
  entity_type: GeoEntityType;
  entity_id: number;
  name: string;
  name_type: string;
  locality_type_code?: string;
  population?: number;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  country_code?: string;
  country_name?: string;
  region_name?: string | null;
  parent_locality_name?: string | null;
}

export interface UseLocalitySearchOptions {
  /** Debounce delay in ms (default: 300) */
  debounce?: number;
  /** Minimum query length (default: 2) */
  minLength?: number;
  /** Filter by entity types */
  types?: GeoEntityType[];
  /** Filter by country ID */
  countryId?: number;
  /** Filter by region ID */
  regionId?: number;
  /** Filter by publisher coverage */
  publisherId?: string;
  /** Maximum results (default: 20) */
  limit?: number;
  /** Locations to exclude from results */
  exclude?: Array<{ type: string; id: string }>;
}

export interface UseLocalitySearchReturn {
  results: LocalitySearchResult[];
  isLoading: boolean;
  error: string | null;
  search: (query: string) => void;
  clear: () => void;
}

export function useLocalitySearch(options: UseLocalitySearchOptions = {}): UseLocalitySearchReturn {
  const {
    debounce = 300,
    minLength = 2,
    types,
    countryId,
    regionId,
    publisherId,
    limit = 20,
    exclude = [],
  } = options;

  const api = useApi();
  const [query, setQuery] = useState('');
  const [rawResults, setRawResults] = useState<LocalitySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSearchRef = useRef<string>('');

  // Filter out excluded items
  const results = useMemo(() => {
    if (exclude.length === 0) return rawResults;
    return rawResults.filter(r =>
      !exclude.some(e => e.type === r.type && e.id === r.id)
    );
  }, [rawResults, exclude]);

  // Perform search
  useEffect(() => {
    if (query.length < minLength) {
      setRawResults([]);
      setError(null);
      lastSearchRef.current = '';
      return;
    }

    // Build search key for deduplication
    const searchKey = `${query}|${types?.join(',')}|${countryId}|${regionId}|${publisherId}`;
    if (searchKey === lastSearchRef.current) return;

    const timeoutId = setTimeout(async () => {
      // Cancel previous request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      setError(null);
      lastSearchRef.current = searchKey;

      try {
        const params = new URLSearchParams({ q: query, limit: String(limit) });
        if (types?.length) params.append('types', types.join(','));
        if (countryId) params.append('country_id', String(countryId));
        if (regionId) params.append('region_id', String(regionId));
        if (publisherId) params.append('publisher_id', publisherId);

        const data = await api.public.get<{ results: ApiSearchResult[]; total: number }>(
          `/localities/search?${params.toString()}`
        );

        const mapped: LocalitySearchResult[] = (data?.results || []).map(r => ({
          type: r.entity_type,
          id: String(r.entity_id),
          name: r.name,
          locality_type_code: r.locality_type_code,
          country_code: r.country_code || '',
          country_name: r.country_name,
          region_name: r.region_name ?? undefined,
          parent_locality_name: r.parent_locality_name ?? undefined,
          latitude: r.latitude,
          longitude: r.longitude,
          timezone: r.timezone,
          population: r.population,
        }));

        setRawResults(mapped);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Locality search failed:', err);
          setError('Search failed');
          setRawResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, debounce);

    return () => {
      clearTimeout(timeoutId);
      abortControllerRef.current?.abort();
    };
  }, [query, types, countryId, regionId, publisherId, limit, minLength, debounce, api]);

  const search = useCallback((q: string) => setQuery(q), []);
  const clear = useCallback(() => {
    setQuery('');
    setRawResults([]);
    setError(null);
    lastSearchRef.current = '';
  }, []);

  return { results, isLoading, error, search, clear };
}
```

---

### 6.3 Unified Component — `web/components/shared/LocalityPicker.tsx`

```typescript
/**
 * @file LocalityPicker.tsx
 * @purpose Unified locality selection component for all use cases
 * @pattern client-component
 * @replaces LocationSearch.tsx, CoverageSearchPanel.tsx, CitySelector.tsx
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Loader2, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocalitySearch } from '@/lib/hooks/useLocalitySearch';
import {
  getEntityIcon,
  getEntityBadgeColor,
  getEntityTextColor,
  getEntityLabel,
  buildHierarchyDisplay,
  buildResponsiveHierarchy,
  POPULAR_LOCALITIES,
  type GeoEntityType,
} from '@/lib/locality-display';
import type { LocalitySelection } from '@/types/geography';

// ============================================================================
// TYPES
// ============================================================================

export type LocalityPickerMode = 'single' | 'multi';
export type LocalityPickerVariant = 'inline' | 'dropdown' | 'compact';

export interface LocalityPickerProps {
  /** Selection mode */
  mode?: LocalityPickerMode;
  /** Visual variant */
  variant?: LocalityPickerVariant;
  /** Placeholder text */
  placeholder?: string;
  /** Callback when selection changes */
  onSelect: (selection: LocalitySelection | LocalitySelection[]) => void;
  /** Callback when item is highlighted (for map preview) */
  onHighlight?: (item: LocalitySelection | null) => void;
  /** Already selected/existing items to exclude */
  exclude?: LocalitySelection[];
  /** Filter by entity types (e.g., ['city', 'town', 'village']) */
  types?: GeoEntityType[];
  /** Filter by country ID */
  countryId?: number;
  /** Filter by region ID */
  regionId?: number;
  /** Filter by publisher coverage */
  publisherId?: string;
  /** Show quick-select popular localities */
  showQuickSelect?: boolean;
  /** Show type filter tabs */
  showTypeFilters?: boolean;
  /** Auto-focus input */
  autoFocus?: boolean;
  /** Custom class name */
  className?: string;
}

// Type filter configuration
const TYPE_FILTERS: { key: GeoEntityType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'city', label: 'Cities' },
  { key: 'town', label: 'Towns' },
  { key: 'village', label: 'Villages' },
  { key: 'neighborhood', label: 'Neighborhoods' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function LocalityPicker({
  mode = 'single',
  variant = 'inline',
  placeholder = 'Search localities...',
  onSelect,
  onHighlight,
  exclude = [],
  types,
  countryId,
  regionId,
  publisherId,
  showQuickSelect = false,
  showTypeFilters = false,
  autoFocus = false,
  className,
}: LocalityPickerProps) {
  const [query, setQuery] = useState('');
  const [activeTypeFilter, setActiveTypeFilter] = useState<GeoEntityType | 'all'>('all');
  const [selectedItems, setSelectedItems] = useState<LocalitySelection[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Compute effective types filter
  const effectiveTypes = activeTypeFilter === 'all' ? types : [activeTypeFilter];

  // Use unified search hook
  const { results, isLoading, search, clear } = useLocalitySearch({
    types: effectiveTypes,
    countryId,
    regionId,
    publisherId,
    exclude: [...exclude, ...selectedItems],
  });

  // Search when query changes
  useEffect(() => {
    search(query);
    if (query.length >= 2) {
      setShowResults(true);
      setHighlightedIndex(0);
    } else {
      setShowResults(false);
    }
  }, [query, search]);

  // Handle selection
  const handleSelect = useCallback((item: LocalitySelection) => {
    if (mode === 'single') {
      onSelect(item);
      setQuery('');
      clear();
      setShowResults(false);
    } else {
      setSelectedItems(prev => [...prev, item]);
    }
  }, [mode, onSelect, clear]);

  // Handle multi-select confirm
  const handleConfirmMulti = useCallback(() => {
    if (selectedItems.length > 0) {
      onSelect(selectedItems);
      setSelectedItems([]);
      setQuery('');
      clear();
    }
  }, [selectedItems, onSelect, clear]);

  // Remove from multi-select
  const handleRemove = useCallback((item: LocalitySelection) => {
    setSelectedItems(prev => prev.filter(i => !(i.type === item.type && i.id === item.id)));
  }, []);

  // Quick select handler
  const handleQuickSelect = useCallback((locality: typeof POPULAR_LOCALITIES[number]) => {
    const item: LocalitySelection = {
      type: 'city',
      id: locality.id,
      name: locality.name,
      country_code: locality.countryCode,
    };
    handleSelect(item);
  }, [handleSelect]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[highlightedIndex]) {
          handleSelect({
            type: results[highlightedIndex].type,
            id: results[highlightedIndex].id,
            name: results[highlightedIndex].name,
            country_code: results[highlightedIndex].country_code,
            latitude: results[highlightedIndex].latitude,
            longitude: results[highlightedIndex].longitude,
            timezone: results[highlightedIndex].timezone,
          });
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowResults(false);
        break;
    }
  }, [showResults, results, highlightedIndex, handleSelect]);

  // Notify parent of highlighted item
  useEffect(() => {
    if (onHighlight && showResults && results[highlightedIndex]) {
      const r = results[highlightedIndex];
      onHighlight({
        type: r.type,
        id: r.id,
        name: r.name,
        country_code: r.country_code,
        latitude: r.latitude,
        longitude: r.longitude,
      });
    } else if (onHighlight) {
      onHighlight(null);
    }
  }, [highlightedIndex, results, showResults, onHighlight]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        resultsRef.current && !resultsRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Type Filter Tabs */}
      {showTypeFilters && (
        <div className="flex flex-wrap gap-1.5 p-1 bg-muted/50 rounded-lg">
          {TYPE_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTypeFilter(key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                activeTypeFilter === key
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              {key !== 'all' && getEntityIcon(key, 'w-3.5 h-3.5')}
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className={cn(
          'absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground',
          variant === 'compact' ? 'h-3 w-3' : 'h-4 w-4'
        )} />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn('pl-10 pr-10', variant === 'compact' && 'h-8 text-sm')}
          autoFocus={autoFocus}
          aria-label="Search localities"
          aria-expanded={showResults}
          role="combobox"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); clear(); setShowResults(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className={cn(variant === 'compact' ? 'h-3 w-3' : 'h-4 w-4')} />
          </button>
        )}
        {isLoading && (
          <Loader2 className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground',
            variant === 'compact' ? 'h-3 w-3' : 'h-4 w-4'
          )} />
        )}
      </div>

      {/* Search Results */}
      {showResults && (
        <div
          ref={resultsRef}
          className="border rounded-lg bg-card max-h-64 overflow-y-auto shadow-lg"
          role="listbox"
        >
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
              Searching...
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y">
              {results.map((result, index) => {
                const isHighlighted = index === highlightedIndex;
                const hierarchy = buildResponsiveHierarchy({
                  name: result.name,
                  locality_type: result.locality_type_code,
                  parent_locality_name: result.parent_locality_name,
                  region_name: result.region_name,
                  country_name: result.country_name,
                  country_code: result.country_code,
                });

                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    type="button"
                    onClick={() => handleSelect({
                      type: result.type,
                      id: result.id,
                      name: result.name,
                      country_code: result.country_code,
                      latitude: result.latitude,
                      longitude: result.longitude,
                      timezone: result.timezone,
                    })}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      'w-full px-3 py-2.5 text-left flex items-center gap-2 transition-colors',
                      isHighlighted ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                    role="option"
                    aria-selected={isHighlighted}
                  >
                    <span className={cn('shrink-0', getEntityTextColor(result.locality_type_code || result.type))}>
                      {getEntityIcon(result.locality_type_code || result.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        {result.name}
                        {result.locality_type_code && result.locality_type_code !== 'city' && (
                          <span className={cn('text-xs px-1.5 py-0.5 rounded', getEntityBadgeColor(result.locality_type_code))}>
                            {getEntityLabel(result.locality_type_code)}
                          </span>
                        )}
                      </div>
                      {/* Responsive hierarchy: show medium on mobile, full on larger screens */}
                      <div className="text-xs text-muted-foreground truncate">
                        <span className="hidden sm:inline">{hierarchy.full.slice(1).join(' → ')}</span>
                        <span className="sm:hidden">{hierarchy.minimal.slice(1).join(', ')}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          ) : query.length >= 2 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No localities found for "{query}"
            </div>
          ) : null}
        </div>
      )}

      {/* Quick Select */}
      {showQuickSelect && !showResults && query.length < 2 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Popular cities:</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {POPULAR_LOCALITIES.map((locality) => {
              const isExcluded = [...exclude, ...selectedItems].some(
                i => i.type === 'city' && i.id === locality.id
              );
              return (
                <button
                  key={locality.id}
                  type="button"
                  onClick={() => !isExcluded && handleQuickSelect(locality)}
                  disabled={isExcluded}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    isExcluded
                      ? 'bg-primary/5 border-primary/20 cursor-default opacity-60'
                      : 'hover:border-primary hover:bg-accent'
                  )}
                >
                  <div className="font-medium text-sm flex items-center gap-1.5">
                    {getEntityIcon('city', 'h-3.5 w-3.5')}
                    {locality.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {locality.country}
                    {isExcluded && <span className="text-primary ml-1">(added)</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Multi-select: Selected Items */}
      {mode === 'multi' && selectedItems.length > 0 && (
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Selected ({selectedItems.length}):</label>
            <button
              type="button"
              onClick={() => setSelectedItems([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedItems.map((item) => (
              <span
                key={`${item.type}-${item.id}`}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
                  getEntityBadgeColor(item.type)
                )}
              >
                {getEntityIcon(item.type, 'w-3.5 h-3.5')}
                {item.name}
                <button
                  type="button"
                  onClick={() => handleRemove(item)}
                  className="hover:opacity-70 ml-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
          <Button onClick={handleConfirmMulti} className="w-full" size="lg">
            <Check className="w-4 h-4 mr-2" />
            Add {selectedItems.length} {selectedItems.length === 1 ? 'Locality' : 'Localities'}
          </Button>
        </div>
      )}
    </div>
  );
}

// Export sub-components for composition
export { getEntityIcon, getEntityBadgeColor, getEntityLabel, buildHierarchyDisplay };
```

---

### 6.4 Backend API Unification

Update the `/localities/search` endpoint to return all necessary fields for the unified component:

**Response Schema Update:**

```json
{
  "results": [
    {
      "entity_type": "city",
      "entity_id": 12345,
      "name": "Brooklyn",
      "locality_type_code": "neighborhood",
      "locality_type_name": "Neighborhood",
      "parent_locality_id": 67890,
      "parent_locality_name": "New York City",
      "region_id": 111,
      "region_name": "New York",
      "region_type_code": "state",
      "country_id": 222,
      "country_name": "United States",
      "country_code": "US",
      "continent_id": 1,
      "latitude": 40.6782,
      "longitude": -73.9442,
      "timezone": "America/New_York",
      "population": 2736074,
      "display_hierarchy": "Brooklyn → New York City → New York → USA",
      "display_names": {
        "en": "Brooklyn",
        "he": "ברוקלין",
        "ar": "بروكلين"
      }
    }
  ],
  "total": 150
}
```

**SQLc Query Changes (`localities.sql`):**

```sql
-- name: SearchLocalities :many
SELECT
    'locality' as entity_type,
    l.id as entity_id,
    l.name,
    lt.code as locality_type_code,
    lt.name as locality_type_name,
    l.parent_locality_id,
    pl.name as parent_locality_name,
    l.region_id,
    r.name as region_name,
    rt.code as region_type_code,
    l.country_id,
    c.name as country_name,
    c.code as country_code,
    l.continent_id,
    l.latitude,
    l.longitude,
    l.timezone,
    l.population,
    s.display_hierarchy,
    s.display_names
FROM geo_localities l
JOIN geo_search_index s ON s.locality_id = l.id
JOIN geo_countries c ON l.country_id = c.id
LEFT JOIN geo_regions r ON l.region_id = r.id
LEFT JOIN geo_region_types rt ON r.region_type_id = rt.id
LEFT JOIN geo_locality_types lt ON l.locality_type_id = lt.id
LEFT JOIN geo_localities pl ON l.parent_locality_id = pl.id
WHERE s.keywords @> ARRAY[@query::text]
  AND (@types::text[] IS NULL OR lt.code = ANY(@types))
  AND (@country_id::int IS NULL OR l.country_id = @country_id)
  AND (@region_id::int IS NULL OR l.region_id = @region_id)
ORDER BY
    l.population DESC NULLS LAST,
    l.name
LIMIT @limit_val;
```

---

### 6.5 Type Updates (`web/types/geography.ts`)

```typescript
// Add to existing types

/** Locality type codes from geo_locality_types */
export type LocalityTypeCode = 'city' | 'town' | 'village' | 'hamlet' | 'neighborhood' | 'borough';

/** Region type codes from geo_region_types */
export type RegionTypeCode = 'region' | 'county' | 'localadmin' | 'state' | 'province' | 'prefecture';

/** Extended locality search result with hierarchy info */
export interface LocalitySearchResult {
  type: GeoEntityType;
  id: string;
  name: string;

  // Type information
  locality_type_code?: LocalityTypeCode;
  locality_type_name?: string;

  // Hierarchy
  parent_locality_id?: number;
  parent_locality_name?: string;
  region_id?: number;
  region_name?: string;
  region_type_code?: RegionTypeCode;
  country_id?: number;
  country_name?: string;
  country_code: string;
  continent_id?: number;

  // Location data
  latitude?: number;
  longitude?: number;
  timezone?: string;
  population?: number;

  // Pre-built display strings
  display_hierarchy?: string;
  display_names?: Record<string, string>;
}
```

---

### 6.6 Migration Path

| Current Component | Replacement | Changes |
|-------------------|-------------|---------|
| `LocationSearch.tsx` | `<LocalityPicker mode="single" />` | Direct replacement |
| `CoverageSearchPanel.tsx` | `<LocalityPicker mode="multi" showTypeFilters showQuickSelect />` | Add onHighlight prop |
| `CitySelector.tsx` | `<LocalityPicker mode="single" />` | Remove step-by-step flow |
| Home page inline search | `<LocalityPicker mode="single" variant="inline" />` | Extract from page |

**Files to Delete After Migration:**
- `web/components/shared/LocationSearch.tsx`
- `web/components/shared/CoverageSearchPanel.tsx`
- `web/components/publisher/CitySelector.tsx`

**Files to Create:**
- `web/lib/locality-display.ts`
- `web/lib/hooks/useLocalitySearch.ts`
- `web/components/shared/LocalityPicker.tsx`

---

### 6.7 Responsive Hierarchy Display Behavior

| Screen Width | Display Format | Example |
|--------------|----------------|---------|
| **< 640px (mobile)** | Minimal | `Brooklyn, NYC, US` |
| **640px-1024px (tablet)** | Medium | `Brooklyn → New York City → US` |
| **> 1024px (desktop)** | Full | `Brooklyn (Neighborhood) → New York City → New York → USA` |

Implementation uses Tailwind responsive classes:
```tsx
<div className="text-xs text-muted-foreground truncate">
  <span className="hidden lg:inline">{hierarchy.full.join(' → ')}</span>
  <span className="hidden sm:inline lg:hidden">{hierarchy.medium.join(' → ')}</span>
  <span className="sm:hidden">{hierarchy.minimal.join(', ')}</span>
</div>
```

---

### 6.8 Acceptance Criteria

1. **Unified Component:** Single `LocalityPicker` replaces all 3 existing components
2. **All Use Cases Covered:**
   - Single-select (home page, algorithm preview)
   - Multi-select (coverage management)
   - Filtered search (by type, country, region, publisher)
3. **Locality Types Displayed:** Badge shows City/Town/Village/Hamlet/Neighborhood/Borough
4. **Responsive Hierarchy:** Adapts to screen width without overflow
5. **No Code Duplication:** Shared utilities extracted
6. **Backend Support:** API returns `locality_type_code` and hierarchy fields
7. **Performance:** Search latency < 50ms, no unnecessary re-renders
8. **Accessibility:** Full keyboard navigation, ARIA attributes
