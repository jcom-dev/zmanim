# Geographic Data System

This document describes Shtetl Zmanim's geographic data infrastructure, including data sources, import processes, search indexing, and location override capabilities.

## Overview

Shtetl Zmanim uses geographic data from the **Overture Maps Foundation** as the authoritative source for localities (cities, towns, villages, neighborhoods) and regions. This provides:

- Flexible geographic hierarchy (region → county → local admin)
- Multi-language name support (~80 languages)
- High-quality coordinates and boundaries
- Consistent global coverage

**Key Tables:**

| Table | Purpose | Count |
|-------|---------|-------|
| `geo_continents` | 7 continents (seeded) | 7 |
| `geo_countries` | Countries with boundaries | ~250 |
| `geo_regions` | States/provinces/counties/districts | ~100k |
| `geo_localities` | Cities, towns, villages, neighborhoods | ~4M |
| `geo_names` | Multi-language names for all entities | ~15M |
| `geo_search_index` | Denormalized search index | ~4M |

---

## Data Sources

### Primary: Overture Maps Foundation

- **Source:** `s3://overturemaps-us-west-2/release/2025-*/theme=divisions/*`
- **Format:** Parquet files
- **Coverage:** Global (~4 million localities)
- **License:** CDLA Permissive 2.0 (open data)

**Entity Types from Overture:**

| Overture Type | Shtetl Table | Example |
|---------------|--------------|---------|
| `country` | `geo_countries` | United States, Israel |
| `region` | `geo_regions` | New York (state), California |
| `county` | `geo_regions` | Los Angeles County |
| `localadmin` | `geo_regions` | City of Los Angeles (admin) |
| `locality` | `geo_localities` | New York City |
| `neighborhood` | `geo_localities` | Brooklyn, Manhattan |

### Elevation: Copernicus GLO-90

- **Source:** Copernicus Programme (European Space Agency)
- **Resolution:** 90-meter Digital Elevation Model
- **Accuracy:** 0.55 meters RMSE
- **License:** Free for commercial use with attribution

---

## Geographic Hierarchy

The system supports flexible hierarchies via self-referential foreign keys:

```
geo_continents (seeded)
    └── geo_countries (imported from Overture)
        ├── boundary (PostGIS polygon)
        └── names in all languages
            └── geo_regions (flexible hierarchy)
                ├── parent_region_id FK (self-reference)
                ├── region_type_id FK → geo_region_types
                └── boundary (PostGIS polygon)
                    └── geo_localities (point-based, no boundaries)
                        ├── parent_locality_id FK (self-reference)
                        ├── locality_type_id FK → geo_locality_types
                        └── lat, lng, population, elevation_m, timezone
```

### Region Types

| Code | Name | Example |
|------|------|---------|
| `region` | Region/State | California, England |
| `state` | State | New York State |
| `province` | Province | Ontario |
| `county` | County | Los Angeles County |
| `localadmin` | Local Admin | City of Los Angeles |
| `district` | District | Haifa District |
| `prefecture` | Prefecture | Tokyo Prefecture |

### Locality Types

| Code | Name | Example |
|------|------|---------|
| `city` | City | New York, London |
| `town` | Town | Greenwich |
| `village` | Village | Small rural settlement |
| `hamlet` | Hamlet | Tiny settlement |
| `neighborhood` | Neighborhood | Brooklyn, Harlem |
| `borough` | Borough | Manhattan |

---

## Import Tools

### import-overture (Python)

**Location:** `api/cmd/import-overture/import-overture.py`

Imports geographic data from Overture Maps Parquet files into the database.

**Usage:**
```bash
cd api/cmd/import-overture

# Download Overture data (divisions theme)
python import-overture.py download --release 2025-01-15-beta.0

# Import all entities
python import-overture.py import --data-dir ./data

# Import specific entity types
python import-overture.py import --data-dir ./data --types countries,regions

# Status check
python import-overture.py status
```

**Import Order:**
1. Countries (with boundaries)
2. Regions (top-level: states/provinces)
3. Sub-regions (counties, local admins with `parent_region_id`)
4. Localities (cities, towns, villages)
5. Sub-localities (neighborhoods with `parent_locality_id`)
6. Names (all languages into `geo_names`)

**Performance:**
- Full import: ~45-60 minutes
- ~4M localities, ~100k regions
- Batch size: 10,000 records
- Index recreation after bulk insert

### import-elevation (Go)

**Location:** `api/cmd/import-elevation/main.go`

Fetches elevation data for localities from the Open-Elevation API (backed by Copernicus GLO-90).

**Usage:**
```bash
cd api

# Import elevation for all localities
go run ./cmd/import-elevation/ import

# Import for specific country
go run ./cmd/import-elevation/ import --country IL

# Status check
go run ./cmd/import-elevation/ status
```

**Features:**
- Batch API queries (100 coordinates per request)
- Configurable concurrency
- Progress tracking
- Updates `geo_localities.elevation_m` and `elevation_source_id`

### geo-index (Go)

**Location:** `api/cmd/geo-index/main.go`

Manages the `geo_search_index` table for fast locality search.

**Usage:**
```bash
cd api

# Rebuild search index
go run ./cmd/geo-index/ rebuild

# Fast rebuild (simplified hierarchy)
go run ./cmd/geo-index/ rebuild --fast

# Status check
go run ./cmd/geo-index/ status
```

**What It Does:**
1. Truncates `geo_search_index`
2. Indexes all localities with:
   - Keywords from all languages (entity + ancestors)
   - Display hierarchy string
   - Denormalized hierarchy IDs
   - Coordinates, population, timezone
3. Indexes regions for hierarchical search

---

## Search Index

The `geo_search_index` table enables ultra-fast locality search across all languages.

### Schema

```sql
CREATE TABLE geo_search_index (
    entity_type VARCHAR(20) NOT NULL,     -- 'locality', 'region'
    entity_id INTEGER NOT NULL,
    PRIMARY KEY (entity_type, entity_id),

    locality_id INTEGER,                   -- FK for localities
    keywords TEXT[] NOT NULL,              -- All names in ALL languages

    display_name TEXT NOT NULL,            -- "Brooklyn"
    display_hierarchy TEXT NOT NULL,       -- "Brooklyn, New York, USA"
    display_names JSONB,                   -- {"en": "Brooklyn", "he": "ברוקלין"}

    -- Hierarchy navigation
    locality_type_id SMALLINT,
    direct_parent_type VARCHAR(20),        -- 'locality', 'region', 'country'
    direct_parent_id INTEGER,
    inherited_region_id INTEGER,
    hierarchy_path JSONB,                  -- Full path array

    -- Geographic data
    country_id SMALLINT,
    continent_id SMALLINT,
    country_code VARCHAR(2),
    population BIGINT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    timezone TEXT
);
```

### Indexes

```sql
-- GIN index for keyword array search (exact match)
CREATE INDEX idx_geo_search_keywords ON geo_search_index USING GIN(keywords);

-- Trigram index for fuzzy search
CREATE INDEX idx_geo_search_trgm ON geo_search_index USING GIN(display_name gin_trgm_ops);

-- Population for ranking
CREATE INDEX idx_geo_search_pop ON geo_search_index(population DESC NULLS LAST);

-- Entity type filter
CREATE INDEX idx_geo_search_type ON geo_search_index(entity_type);

-- Hierarchy filters
CREATE INDEX idx_geo_search_country ON geo_search_index(country_id);
```

### Search Query Strategy

**Search Term Generation:**

Multi-word queries are expanded to include individual words, consecutive pairs, and the full phrase. This enables matching against keyword phrases stored in the index (e.g., "new jersey" as a single keyword).

| Query | Generated Search Terms |
|-------|------------------------|
| `lakewood` | `["lakewood"]` |
| `new york` | `["new", "york", "new york"]` |
| `lakewood new jersey` | `["lakewood", "new", "jersey", "lakewood new", "new jersey", "lakewood new jersey"]` |

**Tiered Ranking:**

1. **Tier 1: Exact keyword match** - Uses GIN index with `&&` (overlaps) operator
   - Matches any search term against keywords array
   - Scores by `matched_terms` count (more matches = higher rank)

2. **Tier 2: Fuzzy trigram match** - Falls back for typos/partial matches
   - Uses trigram similarity (`%` operator)
   - Lower priority than exact matches

**Within each tier, results are ranked by:**
1. `matched_terms` DESC - More keyword matches rank higher
2. `all_terms_bonus` DESC - Full phrase match in keywords
3. `phrase_match_bonus` DESC - Display name contains query
4. `name_match_bonus` DESC - Display name equals a search term
5. `population` DESC - Larger cities rank higher

**Example:** Search for "lakewood new jersey"
1. Lakewood, Ocean County, New Jersey (2 matches: "lakewood" + "new jersey") - **1st**
2. Lakewood, Colorado (1 match: "lakewood", pop 140k) - 2nd
3. Newark, New Jersey (1 match: "new jersey", pop 311k) - 3rd
4. Jersey City, New Jersey (1 match: "jersey", pop 292k) - 4th

**Deduplication:**

Results are deduplicated by `(display_name, country_code)` to avoid showing multiple entries with the same name in the same country. When deduplicating, the entry with the highest `matched_terms` is kept (not just highest population).

**Trailing Space Handling:**

Empty strings from trailing spaces are filtered out (`WHERE term <> ''`) to prevent unexpected results.

**Multi-Language Search:**
| Query | Language | Matches |
|-------|----------|---------|
| `jerusalem` | English | Jerusalem, Israel |
| `ירושלים` | Hebrew | Jerusalem, Israel |
| `القدس` | Arabic | Jerusalem, Israel |

### Performance Targets

| Query Type | Target | Index Used |
|------------|--------|------------|
| Single word | <5ms | GIN keywords |
| Multi-word (3 terms) | <15ms | GIN keywords |
| Fuzzy fallback | <30ms | GIN trigram |
| Filtered by country | <5ms | Composite + GIN |
| Index rebuild | <5min | N/A |

---

## Location Overrides

Publishers and administrators can override locality coordinates and elevation for specific use cases.

### Override Hierarchy

When calculating zmanim, the system resolves location data in this order:

```
1. Publisher Override (highest priority)
   └── Publisher-specific coordinates for this locality

2. Admin Override
   └── System-wide admin correction

3. Overture Default (lowest priority)
   └── Original coordinates from Overture import
```

### Data Sources Table

```sql
CREATE TABLE geo_data_sources (
    id INTEGER PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    priority INTEGER NOT NULL,  -- Lower = higher priority
    description TEXT
);

-- Seed data
INSERT INTO geo_data_sources VALUES
(1, 'publisher', 'Publisher Override', 1, 'Publisher-specific location'),
(2, 'admin', 'Admin Override', 2, 'System-wide correction'),
(3, 'overture', 'Overture Maps', 10, 'Original import data'),
(4, 'copernicus', 'Copernicus GLO-90', 10, 'Elevation data');
```

### Override Tables

**Location Overrides:**
```sql
CREATE TABLE geo_locality_locations (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    locality_id INTEGER NOT NULL REFERENCES geo_localities(id),
    publisher_id INTEGER REFERENCES publishers(id),  -- NULL = admin override
    source_id INTEGER NOT NULL REFERENCES geo_data_sources(id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy_m INTEGER,
    reason TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Elevation Overrides:**
```sql
CREATE TABLE geo_locality_elevations (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    locality_id INTEGER NOT NULL REFERENCES geo_localities(id),
    publisher_id INTEGER REFERENCES publishers(id),  -- NULL = admin override
    source_id INTEGER NOT NULL REFERENCES geo_data_sources(id),
    elevation_m INTEGER NOT NULL,
    accuracy_m INTEGER,
    reason TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Resolution Function

The `get_effective_locality_location()` function resolves the best available location for a locality + publisher combination:

```sql
-- Returns: latitude, longitude, elevation_m, source
SELECT * FROM get_effective_locality_location(
    locality_id := 12345,
    publisher_id := 1  -- or NULL for default
);
```

**Resolution Logic:**
1. If `publisher_id` provided: Check for publisher-specific override
2. Check for admin override (`publisher_id IS NULL, source = 'admin'`)
3. Fall back to locality's default coordinates from Overture

### Publisher Override API

**Create Override:**
```
POST /publisher/locations/{localityId}/override
X-Publisher-Id: {publisherId}
{
    "override_latitude": 40.7128,
    "override_longitude": -74.0060,
    "reason": "Synagogue location for community"
}
```

**List Publisher Overrides:**
```
GET /publisher/location-overrides
X-Publisher-Id: {publisherId}
```

**Update Override:**
```
PUT /publisher/location-overrides/{id}
X-Publisher-Id: {publisherId}
{
    "override_latitude": 40.7130,
    "override_longitude": -74.0058,
    "reason": "Updated coordinates"
}
```

**Delete Override:**
```
DELETE /publisher/location-overrides/{id}
X-Publisher-Id: {publisherId}
```

### Admin Override API

Administrators can create system-wide overrides that apply to all publishers:

```
POST /admin/locations/{localityId}/override
{
    "override_latitude": 31.7683,
    "override_longitude": 35.2137,
    "override_elevation": 800,
    "reason": "Corrected coordinates for Old City"
}
```

### Cache Invalidation

When location overrides are created, updated, or deleted:
1. Redis cache is invalidated for affected locality + publisher
2. Cached zmanim calculations are cleared
3. Next request recalculates with new coordinates

---

## Why Accuracy Matters

Zmanim (Jewish prayer times) are calculated based on solar position relative to a specific location. Even small errors in geographic data can affect calculations:

| Error Type | Magnitude | Zmanim Impact |
|------------|-----------|---------------|
| Latitude/Longitude | 0.01 (~1.1 km) | ~40 seconds |
| Elevation | 10 meters | ~40 seconds |

For observances like candle lighting (typically 18 minutes before sunset), a 1-2 minute error can be significant for halachic compliance.

---

## Commands Reference

```bash
# From api/ directory

# Import geographic data from Overture
cd cmd/import-overture && python import-overture.py import --data-dir ./data

# Import elevation data
go run ./cmd/import-elevation/ import

# Rebuild search index
go run ./cmd/geo-index/ rebuild

# Check status
go run ./cmd/geo-index/ status
go run ./cmd/import-elevation/ status
```

---

## Attribution

This platform uses data from:

- **Overture Maps Foundation** - Geographic hierarchy, boundaries, localities
- **Copernicus Programme** - GLO-90 elevation data ( DLR e.V. 2010-2014 and Airbus Defence and Space GmbH 2014-2018)

---

## Related Documentation

- [Epic 10 Tech Spec](sprint-artifacts/epic-10-tech-spec.md) - Detailed implementation spec
- [Import from Overture](refactoring/import-from-overture.md) - Migration planning document
- [Coding Standards](coding-standards.md) - General development guidelines
