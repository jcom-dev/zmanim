# Geographic Data Import

Comprehensive guide for importing and managing geographic data, elevation, search indexing, and location overrides.

---

## Overview

The Shtetl Zmanim platform uses geographic data from multiple sources:

### Primary Data: Overture Maps Foundation

- **Source:** Overture Maps Foundation
- **Format:** Parquet files on AWS S3
- **Location:** `s3://overturemaps-us-west-2/release/*/theme=divisions/`
- **Update Frequency:** Monthly releases
- **Coverage:** Continents, countries, regions, ~500,000+ localities worldwide
- **Import Tool:** `import-overture` CLI (Python/Go)

### Elevation Data: Copernicus GLO-90

- **Source:** Copernicus Programme (European Space Agency)
- **Resolution:** 90-meter Digital Elevation Model
- **Accuracy:** 0.55 meters RMSE
- **Coverage:** Global elevation data via Open-Elevation API
- **Import Tool:** `import-elevation` CLI (Go)

### Search Index: geo_search_index

- **Purpose:** Ultra-fast multi-language locality search
- **Technology:** PostgreSQL GIN indexes (keyword arrays + trigrams)
- **Performance:** <5ms single-word, <15ms multi-word queries
- **Build Tool:** `geo-index` CLI (Go)

### Location Overrides

- **Publisher Overrides:** Publisher-specific coordinates/elevation
- **Admin Overrides:** System-wide corrections via correction requests
- **Resolution:** `get_effective_locality_location()` PostgreSQL function
- **Priority:** Publisher > Admin > Default (Overture/GLO-90)

---

## Geographic Data Schema

### Hierarchy Structure

```
geo_continents (7 continents)
    ├── boundary (PostGIS geometry)
    └── names in all languages
         │
         ▼
geo_countries (~200 countries)
    ├── boundary (PostGIS geometry)
    ├── continent_id FK
    └── names in all languages
         │
         ▼
geo_regions (flexible hierarchy)
    ├── country_id FK
    ├── parent_region_id FK (nullable, self-reference for sub-regions)
    ├── region_type_id FK → geo_region_types (region/state/county/localadmin)
    ├── boundary (PostGIS geometry)
    └── names in all languages
         │
         ▼
geo_localities (replaces old geo_cities, ~500k+ records)
    ├── region_id FK (lowest-level containing region)
    ├── parent_locality_id FK (nullable, for neighborhoods)
    ├── locality_type_id FK → geo_locality_types (city/town/village/hamlet/neighborhood)
    ├── lat, lng, population, elevation_m, timezone
    ├── NO boundary (localities are point-only)
    └── names in all languages via geo_names table
```

### Lookup Tables

| Table | Values |
|-------|--------|
| `geo_region_types` | region, state, province, county, localadmin, prefecture |
| `geo_locality_types` | city, town, village, hamlet, neighborhood, borough |

---

## import-overture CLI Command

Located at `/api/cmd/import-overture/`

### Installation

```bash
cd api
go build -o ../bin/import-overture ./cmd/import-overture
```

### Commands

| Command | Purpose |
|---------|---------|
| `import-overture download` | Download Overture Parquet files from S3 |
| `import-overture import` | Run full import process |
| `import-overture refresh` | Refresh materialized views only |
| `import-overture status` | Show import statistics |
| `import-overture reset` | Truncate all geo tables (requires `--confirm`) |

---

## Full Import Process

### Step 1: Download Data

```bash
# Download specific release
./bin/import-overture download --release 2025-01 --output ./data/overture/

# Download latest release
./bin/import-overture download --output ./data/overture/
```

**What it does:**
- Downloads Parquet files from S3
- Stores locally in `./data/overture/`
- Skips already-downloaded files (unless `--force`)
- Shows progress

### Step 2: Run Import

```bash
./bin/import-overture import --data-dir ./data/overture/
```

**Import order:**
1. **Continents** (~7 records) - Mapped to existing continents
2. **Countries** (~200 records) - With boundaries and continent mapping
3. **Regions** (thousands) - Top-level regions (states/provinces)
4. **Sub-regions** - Counties, local admin areas (with `parent_region_id`)
5. **Localities** (500,000+) - Cities, towns, villages, hamlets
6. **Sub-localities** - Neighborhoods, boroughs (with `parent_locality_id`)
7. **Boundaries** - PostGIS geometries for countries and regions (NOT localities)
8. **Names** - All language names into `geo_names` table
9. **Refresh views** - Materialized views and search index

**Performance:**
- Batch size: 10,000 records per insert
- Progress reports every 100,000 records
- Expected duration: <60 minutes for full dataset
- Indexes disabled during bulk insert, re-enabled after

### Step 3: Verify Import

```bash
./bin/import-overture status
```

**Expected output:**
```
Geographic Data Import Status
=============================

Entity Counts:
- Continents:      7
- Countries:       196
- Regions:         3,842
- Localities:      542,103
- Names:           2,458,921

Search Index:
- geo_search_index:    542,103 rows
- geo_hierarchy_populations:    4,045 rows

Last Import:     2025-01-15 10:30:00 UTC
Indexes:         ENABLED
```

---

## Materialized Views

### geo_hierarchy_populations

Aggregates population from localities up through regions to countries.

```sql
-- Refresh manually if needed
REFRESH MATERIALIZED VIEW CONCURRENTLY geo_hierarchy_populations;
```

**Purpose:** Provides aggregated population for ranking search results.

**Example:**
- New York City (locality): 8.3M population
- New York State (region): 19.5M total_population (aggregated from all localities)
- USA (country): 331M total_population (aggregated)

### geo_search_index

Multi-language search index with keyword arrays.

```sql
-- Refresh via command
./bin/import-overture refresh

-- Or manually
TRUNCATE geo_search_index;
SELECT refresh_geo_search_index();
```

**Structure:**
| Field | Description |
|-------|-------------|
| `entity_type` | 'locality', 'region', or 'country' |
| `entity_id` | ID in the respective table |
| `keywords` | Array of all names in ALL languages (entity + ancestors) |
| `display_name` | Primary name (English fallback) |
| `display_hierarchy` | "Brooklyn → NYC → New York → USA" |
| `display_names` | JSONB with localized names |
| `population` | For ranking results |

**Example keywords array:**
```
['brooklyn', 'ברוקלין', 'new york', 'ניו יורק', 'usa', 'ארה״ב', 'america', 'אמריקה']
```

---

## Search Implementation

### Tiered Ranking

Search uses a 3-tier ranking system:

| Tier | Match Type | Priority |
|------|------------|----------|
| 1A | Exact entity name (any language) | Highest |
| 1B | Exact ancestor keyword (region/country in any language) | High |
| 2 | Fuzzy trigram match | Medium |

Within each tier, results sorted by:
1. Entity name match bonus (entity's own name > ancestor name)
2. Number of matched terms
3. Population (descending)

### Query Pattern

```sql
-- Exact keyword match (GIN index)
SELECT * FROM geo_search_index
WHERE keywords @> ARRAY['jerusalem']
ORDER BY population DESC NULLS LAST
LIMIT 20;

-- Fuzzy trigram match (fallback)
SELECT * FROM geo_search_index
WHERE display_name % 'jeruslem'  -- Typo
ORDER BY similarity(display_name, 'jeruslem') DESC
LIMIT 20;
```

### Performance

| Scenario | Expected Time | Index Used |
|----------|---------------|------------|
| Exact keyword (1 term) | <5ms | GIN keywords |
| Exact keyword (3 terms) | <10ms | GIN keywords |
| Fuzzy fallback | <30ms | GIN trigram |
| Filtered by country + exact | <5ms | Composite + GIN |

---

## Multi-Language Support

### Language Code Normalization

Overture uses BCP 47 codes (`en-US`, `he-IL`). We normalize to simple codes (`en`, `he`):

```go
"en-US" → "en"
"en-GB" → "en"
"he-IL" → "he"
"ar-SA" → "ar"
"ru-RU" → "ru"
```

### geo_names Table

```sql
CREATE TABLE geo_names (
    entity_type text NOT NULL,  -- 'continent', 'country', 'region', 'locality'
    entity_id integer NOT NULL,
    language_code varchar(10) NOT NULL,
    name text NOT NULL,
    name_type text,  -- 'common', 'official', 'alt', etc.
    PRIMARY KEY (entity_type, entity_id, language_code, name)
);
```

**Example for Jerusalem:**
```sql
SELECT language_code, name FROM geo_names
WHERE entity_type = 'locality' AND entity_id = 293397;

-- Results:
-- en    Jerusalem
-- he    ירושלים
-- ar    القدس
-- ru    Иерусалим
```

---

## Common Operations

### Add New Locality Manually

```sql
-- Insert into geo_localities
INSERT INTO geo_localities (
    name, name_ascii, latitude, longitude, timezone,
    region_id, country_id, locality_type_id,
    population, overture_id
) VALUES (
    'New City', 'New City', 40.7128, -74.0060, 'America/New_York',
    (SELECT id FROM geo_regions WHERE name = 'New York' LIMIT 1),
    (SELECT id FROM geo_countries WHERE code = 'US'),
    (SELECT id FROM geo_locality_types WHERE code = 'city'),
    100000, NULL
) RETURNING id;

-- Add English name
INSERT INTO geo_names (entity_type, entity_id, language_code, name, name_type)
VALUES ('locality', <returned_id>, 'en', 'New City', 'common');

-- Refresh search index
SELECT refresh_geo_search_index();
```

### Update Locality Population

```sql
UPDATE geo_localities
SET population = 250000, updated_at = now()
WHERE id = 12345;

-- Refresh hierarchy populations (if region/country aggregates needed)
REFRESH MATERIALIZED VIEW geo_hierarchy_populations;
```

### Find Localities in Region

```sql
SELECT l.id, l.name, l.population
FROM geo_localities l
JOIN geo_regions r ON l.region_id = r.id
WHERE r.name = 'California'
ORDER BY l.population DESC NULLS LAST
LIMIT 20;
```

### Find Localities by Country

```sql
SELECT l.id, l.name, l.population
FROM geo_localities l
JOIN geo_countries c ON l.country_id = c.id
WHERE c.code = 'IL'  -- Israel
ORDER BY l.population DESC NULLS LAST
LIMIT 20;
```

---

## Troubleshooting

### Import Fails with Memory Error

Reduce batch size:

```go
// In localities.go, change:
const batchSize = 10000
// to:
const batchSize = 5000
```

### Search Returns No Results

Check search index populated:

```sql
SELECT COUNT(*) FROM geo_search_index;
-- Expected: >500,000
```

If empty, refresh:

```bash
./bin/import-overture refresh
```

### Slow Queries

Check indexes exist:

```sql
\d geo_search_index

-- Expected indexes:
-- idx_geo_search_keywords (GIN on keywords)
-- idx_geo_search_trgm (GIN on display_name)
-- idx_geo_search_pop (B-tree on population DESC)
```

If missing, recreate:

```sql
CREATE INDEX idx_geo_search_keywords ON geo_search_index USING GIN(keywords);
CREATE INDEX idx_geo_search_trgm ON geo_search_index USING GIN(display_name gin_trgm_ops);
CREATE INDEX idx_geo_search_pop ON geo_search_index(population DESC NULLS LAST);
```

### Import Errors Logged

Check error table:

```sql
SELECT error_type, COUNT(*) FROM geo_import_errors GROUP BY error_type;
SELECT * FROM geo_import_errors ORDER BY created_at DESC LIMIT 10;
```

Most errors are non-critical (malformed individual records).

---

## Elevation Data Import (GLO-90)

### Overview

After importing Overture locality data, elevation data is fetched from the **Copernicus GLO-90** Digital Elevation Model via the Open-Elevation API.

- **Source:** Copernicus Programme (European Space Agency)
- **Resolution:** 90 meters
- **Accuracy:** 0.55 meters RMSE (Root Mean Square Error)
- **License:** Free for commercial use with attribution
- **Why It Matters:** Elevation affects zmanim calculations by ~40 seconds per 10 meters

### import-elevation CLI Command

**Location:** `api/cmd/import-elevation/main.go`

**Commands:**

| Command | Purpose |
|---------|---------|
| `import-elevation import` | Import elevation for all localities |
| `import-elevation import --country IL` | Import for specific country only |
| `import-elevation status` | Show import statistics |

### Usage

```bash
cd api

# Build the tool
go build -o ../bin/import-elevation ./cmd/import-elevation

# Import elevation for all localities (~500k+ records)
./bin/import-elevation import

# Import for specific country (faster)
./bin/import-elevation import --country IL

# Check status
./bin/import-elevation status
```

### How It Works

1. **Batch Processing:** Queries 100 coordinates per API request
2. **Concurrent Requests:** Configurable concurrency (default: 10)
3. **Progress Tracking:** Reports every 10,000 records
4. **Updates:** Sets `geo_localities.elevation_m` and `elevation_source_id`
5. **Idempotent:** Skips localities that already have elevation data

### Performance

| Operation | Expected Duration |
|-----------|-------------------|
| Full import (~500k localities) | 60-90 minutes |
| Single country (e.g., Israel) | 5-10 minutes |
| Batch API request (100 coords) | 1-2 seconds |

### Verification

```bash
# Check elevation data coverage
source api/.env
psql "$DATABASE_URL" -c "
SELECT
  COUNT(*) FILTER (WHERE elevation_m IS NOT NULL) as with_elevation,
  COUNT(*) FILTER (WHERE elevation_m IS NULL) as without_elevation,
  ROUND(100.0 * COUNT(*) FILTER (WHERE elevation_m IS NOT NULL) / COUNT(*), 1) as coverage_pct
FROM geo_localities;
"
```

**Expected:** >95% coverage (some remote locations may fail)

---

## Search Index Rebuild

### Overview

The `geo_search_index` table enables ultra-fast locality search across all languages. It's a denormalized index built from `geo_localities`, `geo_regions`, `geo_countries`, and `geo_names`.

**Why It's Needed:**
- Multi-language search without complex JOINs
- Keyword array enables exact + fuzzy matching
- Supports tiered ranking (exact → ancestor → fuzzy)
- Performance target: <5ms for single-word, <15ms for multi-word

### geo-index CLI Command

**Location:** `api/cmd/geo-index/main.go`

**Commands:**

| Command | Purpose |
|---------|---------|
| `geo-index rebuild` | Full rebuild of search index |
| `geo-index rebuild --fast` | Fast rebuild (simplified hierarchy) |
| `geo-index status` | Show index statistics |

### Usage

```bash
cd api

# Build the tool
go build -o ../bin/geo-index ./cmd/geo-index

# Full rebuild
./bin/geo-index rebuild

# Fast rebuild (for development)
./bin/geo-index rebuild --fast

# Check status
./bin/geo-index status
```

### What It Does

1. **Truncates** `geo_search_index` table
2. **Indexes localities** with:
   - Keywords from all languages (entity + all ancestors)
   - Display hierarchy: "Brooklyn → New York → USA"
   - Denormalized hierarchy IDs (country_id, region_id, etc.)
   - Geographic data (lat, lng, population, timezone)
3. **Indexes regions** for hierarchical search
4. **Creates GIN indexes** on keywords array and display_name trigrams

### Index Structure

```sql
CREATE TABLE geo_search_index (
    entity_type VARCHAR(20) NOT NULL,     -- 'locality', 'region'
    entity_id INTEGER NOT NULL,
    PRIMARY KEY (entity_type, entity_id),

    -- Search data
    keywords TEXT[] NOT NULL,              -- ['brooklyn', 'ברוקלין', 'new york', 'usa']
    display_name TEXT NOT NULL,            -- "Brooklyn"
    display_hierarchy TEXT NOT NULL,       -- "Brooklyn → New York → USA"
    display_names JSONB,                   -- {"en": "Brooklyn", "he": "ברוקלין"}

    -- Denormalized hierarchy
    locality_type_id SMALLINT,
    country_id SMALLINT,
    continent_id SMALLINT,
    country_code VARCHAR(2),

    -- Geographic data
    population BIGINT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    timezone TEXT
);

-- Critical indexes
CREATE INDEX idx_geo_search_keywords ON geo_search_index USING GIN(keywords);
CREATE INDEX idx_geo_search_trgm ON geo_search_index USING GIN(display_name gin_trgm_ops);
CREATE INDEX idx_geo_search_pop ON geo_search_index(population DESC NULLS LAST);
```

### Performance

| Operation | Expected Duration |
|-----------|-------------------|
| Full rebuild | <5 minutes |
| Fast rebuild | <2 minutes |
| Index size | ~500 MB |

### When to Rebuild

Rebuild the search index after:
- Importing new Overture data
- Adding/updating geo_names (multi-language names)
- Schema changes to geo_localities or geo_regions
- Search results seem stale or incorrect

---

## Location Override System

### Overview

The platform supports a **3-tier hierarchy** for location data (coordinates, elevation, timezone):

```
1. Publisher Override (highest priority)
   └── Publisher-specific coordinates for a locality

2. Admin Override
   └── System-wide correction applied to all publishers

3. Default Source (lowest priority)
   └── Original data from Overture/GLO-90
```

**Why Overrides Matter:**
- Overture data may point to city center instead of specific community location
- Elevation may be averaged instead of precise
- Publishers may need to use synagogue coordinates instead of municipality center
- Admins can correct inaccurate data for all publishers

### Data Sources Table

```sql
CREATE TABLE geo_data_sources (
    id INTEGER PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    priority INTEGER NOT NULL,  -- Lower = higher priority
    is_active BOOLEAN DEFAULT true
);

-- Seed data
INSERT INTO geo_data_sources VALUES
(1, 'publisher', 'Publisher Override', 1),
(2, 'admin', 'Admin Override', 2),
(3, 'overture', 'Overture Maps', 10),
(4, 'glo90', 'Copernicus GLO-90', 10);
```

### Publisher Overrides

Publishers can create location-specific overrides for localities in their coverage area.

**Tables:**
- `geo_locality_locations` - Coordinate overrides (lat/lng)
- `geo_locality_elevations` - Elevation overrides

**Create Override (Publisher):**

```bash
# Via API
curl -X POST "http://localhost:8080/api/v1/publisher/location-overrides" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Publisher-Id: 2" \
  -H "Content-Type: application/json" \
  -d '{
    "locality_id": 4993250,
    "latitude": 40.7589,
    "longitude": -73.9851,
    "elevation": 33,
    "reason": "Using One World Trade Center location for community"
  }'
```

**List Publisher Overrides:**

```bash
curl -s "http://localhost:8080/api/v1/publisher/location-overrides" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Publisher-Id: 2" | jq '.'
```

**Delete Override:**

```bash
curl -X DELETE "http://localhost:8080/api/v1/publisher/location-overrides/{id}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Publisher-Id: 2"
```

### Admin Overrides (Correction Requests)

Users and publishers can submit **correction requests** for inaccurate locality data. When approved by an admin, these create **admin overrides** that apply to all publishers.

**Correction Request Flow:**

1. **Publisher submits correction request:**

```bash
curl -X POST "http://localhost:8080/api/v1/publisher/correction-requests" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Publisher-Id: 2" \
  -H "Content-Type: application/json" \
  -d '{
    "locality_id": 4993250,
    "proposed_latitude": 40.7200,
    "proposed_longitude": -74.0100,
    "proposed_elevation": 15,
    "correction_reason": "Updated coordinates based on official municipal records",
    "evidence_urls": ["https://example.com/evidence"]
  }'
```

2. **Admin reviews and approves:**

```bash
curl -X PUT "http://localhost:8080/api/v1/auth/correction-requests/{id}/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "review_notes": "Verified with official records"
  }'
```

3. **Admin override created automatically:**
   - `geo_locality_locations` entry with `publisher_id = NULL, source_id = admin`
   - `geo_locality_elevations` entry if elevation provided
   - Cache invalidated for all publishers using this locality

4. **Latest approved wins:**
   - Constraint: `UNIQUE(locality_id, publisher_id, source_id)`
   - `ON CONFLICT DO UPDATE` replaces previous admin override
   - No timestamp comparison needed

### Resolution Function

The `get_effective_locality_location()` PostgreSQL function resolves the best available location:

```sql
-- Get effective location for a publisher + locality
SELECT * FROM get_effective_locality_location(
    locality_id := 4993250,
    publisher_id := 2  -- or NULL for default
);

-- Returns: latitude, longitude, elevation_m, source
```

**Resolution Logic:**

1. If `publisher_id` provided: Check for publisher override
2. Check for admin override (`publisher_id IS NULL, source = 'admin'`)
3. Fall back to default source (Overture/GLO-90)

**Used By:** `UnifiedZmanimService` for all zmanim calculations

### Cache Invalidation

When overrides are created/updated/deleted:

```go
// Invalidate zmanim cache for affected locality
if err := h.cache.InvalidateZmanimForLocality(ctx, publisherID, localityID); err != nil {
    slog.Error("cache invalidation failed", "error", err)
}

// Pattern: calc:{publisherId}:{localityId}:*
```

**CRITICAL:** Admin override approval must invalidate cache for ALL publishers:

```go
// After admin approval, invalidate pattern: calc:*:{localityId}:*
pattern := fmt.Sprintf("calc:*:%s:*", localityIDStr)
```

### Verification

```bash
# Check effective location for locality + publisher
source api/.env
psql "$DATABASE_URL" -c "
SELECT * FROM get_effective_locality_location(4993250, 2);
"

# List all overrides for a locality
psql "$DATABASE_URL" -c "
SELECT
  ll.locality_id,
  ds.key as source,
  ll.publisher_id,
  ll.latitude,
  ll.longitude,
  le.elevation_m,
  ll.updated_at
FROM geo_locality_locations ll
JOIN geo_data_sources ds ON ds.id = ll.source_id
LEFT JOIN geo_locality_elevations le
  ON le.locality_id = ll.locality_id
  AND le.source_id = ll.source_id
  AND le.publisher_id IS NOT DISTINCT FROM ll.publisher_id
WHERE ll.locality_id = 4993250
ORDER BY ds.priority;
"
```

---

## Incremental Updates

Currently, the importer performs **full reimport only**.

For incremental updates:
1. Note the current release: `./bin/import-overture status`
2. Download new release: `./bin/import-overture download --release 2025-02`
3. Reset current data: `./bin/import-overture reset --confirm`
4. Reimport: `./bin/import-overture import --data-dir ./data/overture/`

**Future enhancement:** Differential sync to update only changed records.

---

## API Integration

### Frontend Search

```tsx
import { useLocalitySearch } from '@/lib/hooks/useLocalitySearch';

function LocationPicker() {
  const { results, isLoading, search } = useLocalitySearch({
    types: ['city', 'town'],
    countryId: 123,
    limit: 20
  });

  return (
    <input onChange={(e) => search(e.target.value)} />
    {results.map(r => (
      <div key={r.id}>{r.name} - {r.country_name}</div>
    ))}
  );
}
```

### Backend Endpoint

```
GET /api/v1/localities/search?q=jerusalem&limit=20
```

Returns:
```json
{
  "results": [
    {
      "entity_type": "locality",
      "entity_id": 293397,
      "name": "Jerusalem",
      "locality_type_code": "city",
      "country_code": "IL",
      "country_name": "Israel",
      "latitude": 31.7683,
      "longitude": 35.2137,
      "timezone": "Asia/Jerusalem",
      "population": 936425
    }
  ],
  "total": 1
}
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `api/cmd/import-overture/main.go` | CLI entry point |
| `api/cmd/import-overture/download.go` | S3 download logic |
| `api/cmd/import-overture/import.go` | Main orchestration |
| `api/cmd/import-overture/continents.go` | Continent import |
| `api/cmd/import-overture/countries.go` | Country import |
| `api/cmd/import-overture/regions.go` | Region hierarchy |
| `api/cmd/import-overture/localities.go` | Locality import |
| `api/cmd/import-overture/names.go` | Multi-language names |
| `api/cmd/import-overture/refresh.go` | View refresh |
| `api/cmd/import-overture/status.go` | Status reporting |
| `api/internal/db/queries/localities.sql` | SQLc queries |
| `db/migrations/00000000000001_schema.sql` | Full schema |

---

## Production Deployment

### One-Time Setup

```bash
# On production EC2
cd /opt/zmanim
./bin/import-overture download --release 2025-01
./bin/import-overture import --data-dir ./data/overture/
```

### Monthly Updates

```bash
# Download new release
./bin/import-overture download --release 2025-02

# Reset and reimport (during low-traffic window)
./bin/import-overture reset --confirm
./bin/import-overture import --data-dir ./data/overture/

# Verify
./bin/import-overture status
```

**Estimated downtime:** ~60 minutes during reimport.

For zero-downtime updates, consider:
1. Import to staging database
2. Take production snapshot
3. Swap databases
4. Rollback if issues

---

## Quick Reference

```bash
# Full import workflow
./bin/import-overture download --release 2025-01
./bin/import-overture import --data-dir ./data/overture/
./bin/import-overture status

# Import elevation data (GLO-90)
./bin/import-elevation import
./bin/import-elevation status

# Rebuild search index
./bin/geo-index rebuild
./bin/geo-index status

# Check data
psql -c "SELECT COUNT(*) FROM geo_localities;"
psql -c "SELECT COUNT(*) FROM geo_search_index;"
psql -c "SELECT COUNT(*) FILTER (WHERE elevation_m IS NOT NULL) as with_elevation FROM geo_localities;"

# Test search
psql -c "SELECT * FROM geo_search_index WHERE 'jerusalem' = ANY(keywords) LIMIT 5;"

# Check location overrides
psql -c "SELECT COUNT(*) FROM geo_locality_locations WHERE publisher_id IS NOT NULL;" # Publisher overrides
psql -c "SELECT COUNT(*) FROM geo_locality_locations WHERE publisher_id IS NULL AND source_id = (SELECT id FROM geo_data_sources WHERE key = 'admin');" # Admin overrides
```

### Complete Import Workflow

```bash
# From api/ directory

# 1. Download Overture data
cd cmd/import-overture && python import-overture.py download --release 2025-01

# 2. Import geographic data
python import-overture.py import --data-dir ./data
cd ../..

# 3. Import elevation data
go run ./cmd/import-elevation/ import

# 4. Rebuild search index
go run ./cmd/geo-index/ rebuild

# 5. Verify everything
./bin/import-overture status
./bin/import-elevation status
./bin/geo-index status
```
