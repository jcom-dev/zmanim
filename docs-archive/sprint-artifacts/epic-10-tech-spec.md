# Epic 10: Overture Geographic Data Migration - Technical Specification

**Epic:** Epic 10 - Overture Geographic Migration
**Version:** 1.0
**Date:** 2025-12-16
**Total Story Points:** 55
**Status:** Ready for Implementation

---

## 1. Database Schema Changes

### 1.1 New Lookup Tables

```sql
-- Region type lookup (seed data)
CREATE TABLE geo_region_types (
    id SMALLINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    overture_subtype VARCHAR(30),
    sort_order SMALLINT DEFAULT 0
);

INSERT INTO geo_region_types (code, name, overture_subtype, sort_order) VALUES
('region', 'Region/State', 'region', 1),
('state', 'State', 'region', 1),
('province', 'Province', 'region', 1),
('county', 'County', 'county', 2),
('localadmin', 'Local Admin', 'localadmin', 3),
('district', 'District', 'district', 4),
('prefecture', 'Prefecture', 'region', 1);

-- Locality type lookup (seed data)
CREATE TABLE geo_locality_types (
    id SMALLINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    overture_subtype VARCHAR(30),
    sort_order SMALLINT DEFAULT 0
);

INSERT INTO geo_locality_types (code, name, overture_subtype, sort_order) VALUES
('city', 'City', 'city', 1),
('town', 'Town', 'town', 2),
('village', 'Village', 'village', 3),
('hamlet', 'Hamlet', 'hamlet', 4),
('neighborhood', 'Neighborhood', 'neighborhood', 5),
('borough', 'Borough', 'borough', 6);
```

### 1.2 Alter geo_regions

```sql
ALTER TABLE geo_regions
    ADD COLUMN parent_region_id INTEGER REFERENCES geo_regions(id),
    ADD COLUMN region_type_id SMALLINT REFERENCES geo_region_types(id),
    ADD COLUMN population BIGINT,
    ADD COLUMN overture_id TEXT;

CREATE INDEX idx_geo_regions_parent ON geo_regions(parent_region_id);
CREATE INDEX idx_geo_regions_type ON geo_regions(region_type_id);
CREATE INDEX idx_geo_regions_overture ON geo_regions(overture_id);
```

### 1.3 Create geo_localities

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

-- Indexes for common queries
CREATE INDEX idx_geo_localities_region ON geo_localities(region_id);
CREATE INDEX idx_geo_localities_parent ON geo_localities(parent_locality_id);
CREATE INDEX idx_geo_localities_type ON geo_localities(locality_type_id);
CREATE INDEX idx_geo_localities_country ON geo_localities(country_id);
CREATE INDEX idx_geo_localities_location ON geo_localities USING GIST(location);
CREATE INDEX idx_geo_localities_name ON geo_localities(name);
CREATE INDEX idx_geo_localities_overture ON geo_localities(overture_id);
CREATE INDEX idx_geo_localities_population ON geo_localities(population DESC NULLS LAST);
```

### 1.4 Search Index Table

```sql
CREATE TABLE geo_search_index (
    -- Composite primary key for multi-entity support
    entity_type VARCHAR(20) NOT NULL,  -- 'locality', 'region', 'country'
    entity_id INTEGER NOT NULL,
    PRIMARY KEY (entity_type, entity_id),

    -- Foreign key for localities (cascade delete)
    locality_id INTEGER REFERENCES geo_localities(id) ON DELETE CASCADE,

    -- All keywords from ALL languages (entity + ancestors)
    keywords TEXT[] NOT NULL,

    -- Display fields
    display_name TEXT NOT NULL,
    display_hierarchy TEXT NOT NULL,
    display_names JSONB,  -- {"en": "Brooklyn", "he": "ברוקלין"}

    -- Denormalized for response
    locality_type_id SMALLINT,
    parent_locality_id INTEGER,
    region_id INTEGER,
    country_id SMALLINT,
    continent_id SMALLINT,
    country_code VARCHAR(2),
    population BIGINT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    timezone TEXT
);

-- GIN index for keyword array search
CREATE INDEX idx_geo_search_keywords ON geo_search_index USING GIN(keywords);

-- Trigram index for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_geo_search_trgm ON geo_search_index USING GIN(display_name gin_trgm_ops);

-- Population for ranking
CREATE INDEX idx_geo_search_pop ON geo_search_index(population DESC NULLS LAST);

-- Entity type filter
CREATE INDEX idx_geo_search_type ON geo_search_index(entity_type);

-- Hierarchy filters
CREATE INDEX idx_geo_search_country ON geo_search_index(country_id);
CREATE INDEX idx_geo_search_region ON geo_search_index(region_id);
```

### 1.5 Hierarchy Populations Materialized View

```sql
CREATE MATERIALIZED VIEW geo_hierarchy_populations AS
WITH RECURSIVE
-- Aggregate localities to regions
locality_to_region AS (
    SELECT region_id, SUM(COALESCE(population, 0)) AS direct_population
    FROM geo_localities
    WHERE region_id IS NOT NULL
    GROUP BY region_id
),
-- Build region tree with recursive rollup
region_tree AS (
    -- Leaf regions
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
    -- Parent regions
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
-- Final region populations
region_populations AS (
    SELECT DISTINCT ON (region_id)
        'region' AS entity_type,
        region_id AS entity_id,
        direct_population,
        total_population
    FROM region_tree
    ORDER BY region_id, depth DESC
),
-- Country populations
country_populations AS (
    SELECT
        'country' AS entity_type,
        c.id AS entity_id,
        COALESCE((
            SELECT SUM(COALESCE(population, 0))
            FROM geo_localities l
            WHERE l.country_id = c.id AND l.region_id IS NULL
        ), 0) AS direct_population,
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
SELECT * FROM region_populations
UNION ALL
SELECT * FROM country_populations;

CREATE UNIQUE INDEX idx_geo_hierarchy_pop_pk ON geo_hierarchy_populations(entity_type, entity_id);
CREATE INDEX idx_geo_hierarchy_pop_total ON geo_hierarchy_populations(total_population DESC NULLS LAST);
```

### 1.6 Tables to Drop

```sql
-- Drop after migration verification
DROP TABLE IF EXISTS geo_city_boundaries CASCADE;
DROP TABLE IF EXISTS geo_district_boundaries CASCADE;
DROP TABLE IF EXISTS geo_districts CASCADE;
DROP TABLE IF EXISTS geo_cities CASCADE;

-- Rename auxiliary tables
ALTER TABLE geo_city_coordinates RENAME TO geo_locality_coordinates;
ALTER TABLE geo_city_elevations RENAME TO geo_locality_elevations;
```

### 1.7 Update publisher_coverage

```sql
-- Add locality_id, keep city_id during transition
ALTER TABLE publisher_coverage
    ADD COLUMN locality_id INTEGER REFERENCES geo_localities(id);

-- After migration: DROP city_id, district_id columns
-- ALTER TABLE publisher_coverage DROP COLUMN city_id;
-- ALTER TABLE publisher_coverage DROP COLUMN district_id;
```

---

## 2. import-overture CLI Command

### 2.1 Command Structure

```
api/cmd/import-overture/
├── main.go           # Entry point, CLI (cobra)
├── download.go       # Download Overture Parquet from S3
├── import.go         # Main import orchestration
├── continents.go     # Import continents
├── countries.go      # Import countries
├── regions.go        # Import region hierarchy
├── localities.go     # Import locality hierarchy
├── boundaries.go     # Import country/region boundaries
├── names.go          # Import multi-language names
├── parquet.go        # Pure Go parquet reader
└── refresh.go        # Refresh materialized views
```

### 2.2 CLI Subcommands

```bash
import-overture download    # Download Overture Parquet files from S3
import-overture import      # Run full import (steps 1-8)
import-overture refresh     # Refresh materialized views only
import-overture status      # Show import progress/stats
import-overture reset       # Drop and recreate geo tables (DANGEROUS)
```

### 2.3 Import Order

1. **Continents** - Import from Overture divisions
2. **Countries** - Import, map to continents
3. **Regions (top-level)** - region subtype
4. **Sub-regions** - county, localadmin with parent_region_id
5. **Localities** - city/town/village/hamlet
6. **Sub-localities** - neighborhood, borough with parent_locality_id
7. **Boundaries** - country, region only (NOT locality)
8. **Names** - all languages into geo_names
9. **Refresh views** - geo_hierarchy_populations, then geo_search_index

### 2.4 Data Source

```
AWS S3: s3://overturemaps-us-west-2/release/2025-*/theme=divisions/*
Format: Parquet
Reader: github.com/parquet-go/parquet-go (pure Go, no CGO)
```

### 2.5 Batch Processing

```go
const (
    batchSize     = 10000  // Records per batch insert
    reportEvery   = 100000 // Progress report interval
)

// Disable indexes during import for performance
func DisableGeoIndexes(ctx context.Context, pool *pgxpool.Pool) error {
    indexes := []string{
        "idx_geo_localities_region",
        "idx_geo_localities_parent",
        "idx_geo_localities_location",
        "idx_geo_search_keywords",
        "idx_geo_search_trgm",
    }
    for _, idx := range indexes {
        _, err := pool.Exec(ctx, fmt.Sprintf("DROP INDEX IF EXISTS %s", idx))
        if err != nil {
            return err
        }
    }
    return nil
}

func RecreateGeoIndexes(ctx context.Context, pool *pgxpool.Pool) error {
    // Recreate all indexes after import
    // ...
}
```

---

## 3. Search Implementation

### 3.1 Search Query (Tiered Ranking)

```sql
-- name: SearchLocalities :many
WITH search_terms AS (
    SELECT unnest(string_to_array(lower(@query), ' ')) AS term
),
term_count AS (
    SELECT COUNT(*) AS total FROM search_terms
),

-- TIER 1: Exact keyword matches
exact_matches AS (
    SELECT
        s.*,
        (SELECT COUNT(*) FROM search_terms st WHERE st.term = ANY(s.keywords)) AS matched_terms,
        CASE WHEN EXISTS (
            SELECT 1 FROM geo_names n
            WHERE n.entity_type = s.entity_type
              AND n.entity_id = s.entity_id
              AND lower(n.name) = ANY(SELECT term FROM search_terms)
        ) THEN 1 ELSE 0 END AS name_match_bonus,
        1 AS tier
    FROM geo_search_index s
    WHERE s.keywords && (SELECT ARRAY_AGG(term) FROM search_terms)
      AND (@entity_types::text[] IS NULL OR s.entity_type = ANY(@entity_types))
      AND (@country_id::int IS NULL OR s.country_id = @country_id)
),

-- TIER 2: Fuzzy trigram matches
fuzzy_matches AS (
    SELECT
        s.*,
        similarity(s.display_name, @query) AS sim_score,
        0 AS matched_terms,
        0 AS name_match_bonus,
        2 AS tier
    FROM geo_search_index s
    WHERE s.display_name % @query
      AND (s.entity_type, s.entity_id) NOT IN (SELECT entity_type, entity_id FROM exact_matches)
      AND (@entity_types::text[] IS NULL OR s.entity_type = ANY(@entity_types))
),

-- Combined ranking
ranked_results AS (
    SELECT *,
        ROW_NUMBER() OVER (
            ORDER BY
                tier ASC,
                name_match_bonus DESC,
                matched_terms DESC,
                population DESC NULLS LAST
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
WHERE rank <= @limit_val
ORDER BY rank;
```

### 3.2 Refresh Function

```sql
CREATE OR REPLACE FUNCTION refresh_geo_search_index() RETURNS void AS $$
BEGIN
    TRUNCATE geo_search_index;

    INSERT INTO geo_search_index (
        entity_type, entity_id, locality_id, keywords, display_name, display_hierarchy, display_names,
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
    -- Collect all names for each entity
    locality_keywords AS (
        SELECT l.id, array_agg(DISTINCT lower(n.name)) FILTER (WHERE n.name IS NOT NULL) as names
        FROM geo_localities l
        LEFT JOIN geo_names n ON n.entity_type = 'locality' AND n.entity_id = l.id
        GROUP BY l.id
    ),
    region_keywords AS (
        SELECT rc.locality_id, array_agg(DISTINCT lower(n.name)) FILTER (WHERE n.name IS NOT NULL) as names
        FROM region_chain rc
        JOIN geo_names n ON n.entity_type = 'region' AND n.entity_id = rc.region_id
        GROUP BY rc.locality_id
    ),
    country_keywords AS (
        SELECT l.id as locality_id, array_agg(DISTINCT lower(n.name)) FILTER (WHERE n.name IS NOT NULL) as names
        FROM geo_localities l
        JOIN geo_names n ON n.entity_type = 'country' AND n.entity_id = l.country_id
        GROUP BY l.id
    )
    SELECT
        'locality'::varchar(20),
        l.id,
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
        l.name || COALESCE(', ' || r.name, '') || ', ' || co.name,
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

    RAISE NOTICE 'Search index refreshed: % rows', (SELECT COUNT(*) FROM geo_search_index);
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Backend Code Changes

### 4.1 SQLc Queries (localities.sql)

```sql
-- name: GetLocalityByID :one
SELECT
    l.*,
    lt.code as locality_type_code,
    lt.name as locality_type_name,
    r.name as region_name,
    c.name as country_name,
    c.code as country_code
FROM geo_localities l
LEFT JOIN geo_locality_types lt ON l.locality_type_id = lt.id
LEFT JOIN geo_regions r ON l.region_id = r.id
JOIN geo_countries c ON l.country_id = c.id
WHERE l.id = @id;

-- name: ListLocalities :many
SELECT
    l.*,
    lt.code as locality_type_code,
    c.code as country_code
FROM geo_localities l
LEFT JOIN geo_locality_types lt ON l.locality_type_id = lt.id
JOIN geo_countries c ON l.country_id = c.id
WHERE (@country_id::int IS NULL OR l.country_id = @country_id)
  AND (@region_id::int IS NULL OR l.region_id = @region_id)
  AND (@locality_type_id::smallint IS NULL OR l.locality_type_id = @locality_type_id)
ORDER BY l.population DESC NULLS LAST, l.name
LIMIT @limit_val OFFSET @offset_val;

-- name: GetLocalitiesNearPoint :many
SELECT
    l.*,
    lt.code as locality_type_code,
    c.code as country_code,
    ST_Distance(l.location, ST_SetSRID(ST_MakePoint(@lng, @lat), 4326)::geography) as distance_m
FROM geo_localities l
LEFT JOIN geo_locality_types lt ON l.locality_type_id = lt.id
JOIN geo_countries c ON l.country_id = c.id
WHERE ST_DWithin(l.location, ST_SetSRID(ST_MakePoint(@lng, @lat), 4326)::geography, @radius_m)
ORDER BY distance_m
LIMIT @limit_val;

-- name: UpdateLocalityElevation :exec
UPDATE geo_localities
SET elevation_m = @elevation_m,
    elevation_source_id = @elevation_source_id,
    updated_at = now()
WHERE id = @id;
```

### 4.2 Handler Updates

```go
// cities.go -> Use geo_localities internally, keep API compatible
func (h *Handlers) GetCity(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    idStr := chi.URLParam(r, "id")
    id, err := strconv.ParseInt(idStr, 10, 32)
    if err != nil {
        RespondBadRequest(w, r, "Invalid city ID")
        return
    }

    // Use new query internally
    locality, err := h.db.Queries.GetLocalityByID(ctx, int32(id))
    if err != nil {
        RespondNotFound(w, r, "City not found")
        return
    }

    // Map to API response (backward compatible)
    RespondJSON(w, r, http.StatusOK, mapLocalityToCity(locality))
}
```

### 4.3 import-elevation Updates

```go
// import-elevation/main.go - Use geo_localities
func updateElevations(ctx context.Context, db *database.DB, localities []sqlcgen.GeoLocality) error {
    for _, loc := range localities {
        elevation, err := getElevation(loc.Latitude, loc.Longitude)
        if err != nil {
            slog.Warn("failed to get elevation", "locality_id", loc.ID, "error", err)
            continue
        }

        err = db.Queries.UpdateLocalityElevation(ctx, sqlcgen.UpdateLocalityElevationParams{
            ID:                int32(loc.ID),
            ElevationM:        sql.NullInt32{Int32: int32(elevation), Valid: true},
            ElevationSourceID: sql.NullInt32{Int32: glo90SourceID, Valid: true},
        })
        if err != nil {
            return fmt.Errorf("update elevation for %d: %w", loc.ID, err)
        }
    }
    return nil
}
```

---

## 5. Frontend Changes

### 5.1 Shared Utilities (locality-display.ts)

```typescript
// web/lib/locality-display.ts
import { MapPin, Globe, Globe2, Map as MapIcon, Building, Home } from 'lucide-react';

export type LocalityTypeCode = 'city' | 'town' | 'village' | 'hamlet' | 'neighborhood' | 'borough';
export type RegionTypeCode = 'region' | 'county' | 'localadmin' | 'state' | 'province';
export type GeoEntityType = 'continent' | 'country' | RegionTypeCode | LocalityTypeCode;

export function getEntityIcon(type: GeoEntityType, className = 'w-4 h-4') {
  const icons: Record<string, React.ReactNode> = {
    continent: <Globe2 className={className} />,
    country: <Globe className={className} />,
    region: <MapIcon className={className} />,
    city: <Building className={className} />,
    neighborhood: <MapPin className={className} />,
    // ... etc
  };
  return icons[type] || <MapPin className={className} />;
}

export function getEntityBadgeColor(type: GeoEntityType): string {
  const colors: Record<string, string> = {
    city: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    neighborhood: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    // ... etc
  };
  return colors[type] || 'bg-primary/10 text-primary';
}

export function buildHierarchyDisplay(locality: {
  name: string;
  locality_type?: string;
  parent_locality_name?: string;
  region_name?: string;
  country_name?: string;
}): string {
  const parts = [locality.name];
  if (locality.parent_locality_name) parts.push(locality.parent_locality_name);
  if (locality.region_name) parts.push(locality.region_name);
  if (locality.country_name) parts.push(locality.country_name);
  return parts.join(' → ');
}
```

### 5.2 Search Hook (useLocalitySearch.ts)

```typescript
// web/lib/hooks/useLocalitySearch.ts
export function useLocalitySearch(options: UseLocalitySearchOptions = {}) {
  const { debounce = 300, types, countryId, limit = 20 } = options;
  const api = useApi();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocalitySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ q: query, limit: String(limit) });
        if (types?.length) params.append('types', types.join(','));
        if (countryId) params.append('country_id', String(countryId));

        const data = await api.public.get<SearchResponse>(`/localities/search?${params}`);
        setResults(data?.results || []);
      } catch (err) {
        console.error('Search failed:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, debounce);

    return () => clearTimeout(timeoutId);
  }, [query, types, countryId, limit, debounce, api]);

  return { results, isLoading, search: setQuery, clear: () => { setQuery(''); setResults([]); } };
}
```

### 5.3 LocalityPicker Component

```typescript
// web/components/shared/LocalityPicker.tsx
'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X, Loader2 } from 'lucide-react';
import { useLocalitySearch } from '@/lib/hooks/useLocalitySearch';
import { getEntityIcon, getEntityBadgeColor, buildHierarchyDisplay } from '@/lib/locality-display';

export type LocalityPickerMode = 'single' | 'multi';

export interface LocalityPickerProps {
  mode?: LocalityPickerMode;
  placeholder?: string;
  onSelect: (selection: LocalitySelection | LocalitySelection[]) => void;
  types?: GeoEntityType[];
  countryId?: number;
  showQuickSelect?: boolean;
  className?: string;
}

export function LocalityPicker({
  mode = 'single',
  placeholder = 'Search localities...',
  onSelect,
  types,
  countryId,
  showQuickSelect = false,
  className,
}: LocalityPickerProps) {
  const [query, setQuery] = useState('');
  const { results, isLoading, search } = useLocalitySearch({ types, countryId });

  // ... full implementation per docs/refactoring/import-from-overture.md Phase 6
}
```

### 5.4 Components to Delete After Migration

- `web/components/shared/LocationSearch.tsx` (604 lines)
- `web/components/shared/CoverageSearchPanel.tsx` (538 lines)
- `web/components/publisher/CitySelector.tsx` (404 lines)

---

## 6. Testing Strategy

### 6.1 Unit Tests

```go
// api/cmd/import-overture/import_test.go
func TestParseOvertureRegion(t *testing.T) {
    // Test parsing Overture Parquet records
}

func TestBuildRegionHierarchy(t *testing.T) {
    // Test parent_region_id assignment
}

func TestLanguageCodeNormalization(t *testing.T) {
    // Test BCP 47 → simple code mapping
}
```

### 6.2 Integration Tests

```go
// api/internal/handlers/localities_test.go
func TestSearchLocalities_ExactMatch(t *testing.T) {
    // Test "brooklyn" returns Brooklyn, NYC first
}

func TestSearchLocalities_HebrewMatch(t *testing.T) {
    // Test "ברוקלין" returns Brooklyn
}

func TestSearchLocalities_FuzzyMatch(t *testing.T) {
    // Test "brookln" (typo) returns Brooklyn
}

func TestSearchLocalities_AncestorMatch(t *testing.T) {
    // Test "new york" returns both city and neighborhoods within
}
```

### 6.3 E2E Tests

```typescript
// tests/e2e/locality-search.spec.ts
test('search for city by English name', async ({ page }) => {
  await page.goto('/');
  await page.fill('[data-testid="location-search"]', 'Jerusalem');
  await expect(page.getByText('Jerusalem, Israel')).toBeVisible();
});

test('search for city by Hebrew name', async ({ page }) => {
  await page.goto('/');
  await page.fill('[data-testid="location-search"]', 'ירושלים');
  await expect(page.getByText('Jerusalem, Israel')).toBeVisible();
});

test('search shows neighborhood with parent hierarchy', async ({ page }) => {
  await page.goto('/');
  await page.fill('[data-testid="location-search"]', 'Brooklyn');
  await expect(page.getByText('Brooklyn → New York City')).toBeVisible();
});
```

---

## 7. Performance Benchmarks

### 7.1 Target Metrics

| Query Type | Target | Index Used |
|------------|--------|------------|
| Exact keyword (1 term) | <5ms | GIN keywords |
| Exact keyword (3 terms) | <10ms | GIN keywords |
| Fuzzy fallback | <30ms | GIN trigram |
| Filtered by country | <5ms | Composite + GIN |
| Search index refresh | <5min | N/A |

### 7.2 Slow Query Logging

```sql
-- Enable in PostgreSQL
ALTER SYSTEM SET log_min_duration_statement = 100;
SELECT pg_reload_conf();

-- Check slow queries
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### 7.3 EXPLAIN ANALYZE Template

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM geo_search_index
WHERE keywords @> ARRAY['brooklyn']
ORDER BY population DESC NULLS LAST
LIMIT 20;
```

---

## 8. Deployment Plan

### 8.1 Story Execution Order

1. **Story 10.1** - Run migration, verify tables created
2. **Story 10.2** - Build CLI, run import (may take 30-60 min)
3. **Story 10.3** - Verify search index populated, test queries
4. **Story 10.4** - Update backend code, run tests
5. **Story 10.5** - Deploy frontend changes
6. **Story 10.6** - Performance testing, documentation

### 8.2 Rollback Plan

```bash
# If import fails: Reset to clean state
import-overture reset

# If schema migration fails: Restore from backup
./scripts/restore-backup.sh <backup-file>

# If frontend breaks: Revert to old components
git revert <commit-hash>
```

---

## Appendix: Key Files

| File | Purpose |
|------|---------|
| `db/migrations/00000000000003_overture_schema.sql` | Schema migration |
| `api/cmd/import-overture/` | CLI command |
| `api/internal/db/queries/localities.sql` | SQLc queries |
| `api/internal/handlers/localities.go` | API handlers |
| `web/lib/locality-display.ts` | Shared display utilities |
| `web/lib/hooks/useLocalitySearch.ts` | Search hook |
| `web/components/shared/LocalityPicker.tsx` | Unified component |

---

_Generated: 2025-12-16_
_Version: 1.0_
