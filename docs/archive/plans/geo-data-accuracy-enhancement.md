# Geographic Data Accuracy Enhancement Plan

## Implementation Progress

> **Instructions for Agents**: When completing tasks, mark them with `[x]` and add a brief summary in the "Completed Work Log" section below. This ensures continuity across sessions.

### Completed Work Log

<!-- Add entries here as tasks are completed -->
<!-- Format: YYYY-MM-DD | Phase X Task Y | Brief description of what was done -->
2025-12-06 | Phase 2.3 | Added SimpleMaps import command to existing import-wof tool (instead of creating new geo/ structure). Command: `go run ./cmd/import-wof simplemaps`. Features: CSV parsing, city matching by name+country+proximity, upsert to geo_city_coordinates table, import audit logging.
2025-12-06 | Phase 2.3 | Enhanced SimpleMaps import with strict validation and detailed logging. Key changes: (1) Exact name match required (case-insensitive), (2) Same country required, (3) Closest match by distance selected, (4) All decisions logged to simplemaps-import.log with skip reasons breakdown, (5) 50km max distance (name is primary criterion).

---

## Implementation Checklist

### Phase 1: Database Schema Changes
- [ ] **1.1** Export existing WOF data from current database
  - [ ] Export geo_continents, geo_countries, geo_regions, geo_districts, geo_cities
  - [ ] Export geo_names, languages
  - [ ] Export geo_*_boundaries tables
  - [ ] Save to `data/exports/wof-data-export.sql`
- [ ] **1.2** Update migration `db/migrations/00000000000001_schema.sql`
  - [ ] Add `city_coordinates` table (multi-source coords)
  - [ ] Add `city_elevations` table (multi-source elevations)
  - [ ] Add `geo_data_imports` audit table
  - [ ] Add `effective_*` columns to `geo_cities` table
  - [ ] Add `get_effective_city_coordinates()` function
  - [ ] Add `get_effective_city_elevation()` function
  - [ ] Add `update_effective_city_data()` function
- [ ] **1.3** Drop and recreate database
  - [ ] Drop existing database
  - [ ] Create fresh database
  - [ ] Run migrations
- [ ] **1.4** Import WOF data back into new schema
  - [ ] Import from `data/exports/wof-data-export.sql`
  - [ ] Populate `city_coordinates` with WOF source data
  - [ ] Set initial `effective_*` values from WOF coordinates

### Phase 2: Reorganize Import Commands
- [ ] **2.1** Create new command structure `api/cmd/geo/`
  - [ ] Create `main.go` with subcommand routing
  - [ ] Implement `geo reset` - nuclear wipe all geo data
  - [ ] Implement `geo status` - show current data state
  - [ ] Implement `geo download` - download WOF + GLO-90 tiles
- [ ] **2.2** Implement `geo import-wof`
  - [ ] Import continents, countries, regions, districts
  - [ ] Import cities with WOF coordinates → `city_coordinates(source='wof')`
  - [ ] Import multi-language names (geo_names)
  - [ ] Import boundaries (geo_*_boundaries)
  - [ ] Record import in `geo_data_imports`
- [x] **2.3** Implement `geo import-simplemaps` (added as `import-wof simplemaps` instead)
  - [x] Parse worldcities.csv
  - [x] Match to existing cities (country + name + proximity)
  - [x] Insert into `city_coordinates(source='simplemaps')`
  - [x] Update `geo_cities.effective_*` columns (via database trigger)
  - [x] Record import in `geo_data_imports`
- [ ] **2.4** Implement `geo import-elevations`
  - [ ] Create GLO-90 tile manager
  - [ ] Download tiles on-demand from AWS S3
  - [ ] Lookup elevation for each city's effective coordinates
  - [ ] Insert into `city_elevations(source='glo90')`
  - [ ] Update `geo_cities.effective_elevation_m`
  - [ ] Record import in `geo_data_imports`
- [ ] **2.5** Implement `geo export`
  - [ ] Export all geo tables to single SQL file
  - [ ] Use COPY format for fast import
  - [ ] Include schema version metadata
  - [ ] Compress output (gzip)
- [ ] **2.6** Implement `geo import`
  - [ ] Import from SQL dump file
  - [ ] Validate schema version compatibility
  - [ ] Support both compressed and uncompressed
- [ ] **2.7** Remove old `api/cmd/import-wof/` directory

### Phase 3: Go Implementation Files
- [ ] **3.1** Create `api/internal/geo/glo90.go`
  - [ ] GLO90Lookup struct with tile cache
  - [ ] GetElevation(lat, lng) method
  - [ ] Tile ID calculation
  - [ ] AWS S3 tile download
- [ ] **3.2** Create `api/internal/geo/simplemaps.go`
  - [ ] SimpleMapsCity struct
  - [ ] CSV parser
  - [ ] City matching algorithm
  - [ ] Scoring function (name + region + population + proximity)
- [ ] **3.3** Create `api/internal/geo/priority.go`
  - [ ] Priority resolution logic
  - [ ] Effective coordinate calculation
  - [ ] Data quality tier computation

### Phase 4: SQLc Queries
- [ ] **4.1** Create `api/internal/db/queries/city_coordinates.sql`
  - [ ] InsertCityCoordinate
  - [ ] GetCityCoordinates
  - [ ] GetEffectiveCityCoordinates
  - [ ] UpdateCityCoordinate
  - [ ] DeleteCityCoordinate
- [ ] **4.2** Create `api/internal/db/queries/city_elevations.sql`
  - [ ] InsertCityElevation
  - [ ] GetCityElevations
  - [ ] GetEffectiveCityElevation
  - [ ] UpdateCityElevation
  - [ ] DeleteCityElevation
- [ ] **4.3** Create `api/internal/db/queries/geo_imports.sql`
  - [ ] InsertGeoDataImport
  - [ ] UpdateGeoDataImport
  - [ ] ListGeoDataImports
- [ ] **4.4** Update `api/internal/db/queries/cities.sql`
  - [ ] Add queries for effective coordinate columns
  - [ ] Update GetCity to include source info
- [ ] **4.5** Run `sqlc generate`

### Phase 5: API Endpoints
- [ ] **5.1** Create `api/internal/handlers/admin_geo.go`
  - [ ] GET /admin/cities/:id/coordinates
  - [ ] POST /admin/cities/:id/coordinates
  - [ ] PUT /admin/cities/:id/coordinates/:cid
  - [ ] DELETE /admin/cities/:id/coordinates/:cid
  - [ ] GET /admin/cities/:id/elevations
  - [ ] POST /admin/cities/:id/elevations
  - [ ] GET /admin/geo/imports
  - [ ] GET /admin/geo/status
- [ ] **5.2** Add publisher override endpoints
  - [ ] POST /publisher/cities/:id/override
  - [ ] PUT /publisher/cities/:id/override
  - [ ] DELETE /publisher/cities/:id/override
- [ ] **5.3** Update zmanim calculation
  - [ ] Modify to use effective coordinates
  - [ ] Support publisher-specific overrides
- [ ] **5.4** Register routes in `api/cmd/api/main.go`

### Phase 6: Frontend - Coordinate Override UI

#### 6.1 Admin: City Geo Lookup Page (`/admin/geo/cities`)
- [ ] City search (by name, with country filter)
- [ ] City detail view showing:
  - Current effective coordinates + elevation
  - Source breakdown (which source provided current data)
  - All coordinate sources with priority indicator
  - All elevation sources with priority indicator
  - Map showing coordinate pins from each source
- [ ] Add override form:
  - Latitude/Longitude inputs
  - Elevation input
  - Notes field
  - Source marked as 'community'
- [ ] Delete override button
- [ ] Override history list (created_at, who, what changed)

#### 6.2 Publisher: Coverage City Override (`/publisher/coverage`)
- [ ] On existing coverage page, add "View/Edit Coordinates" action per city
- [ ] Override dialog showing:
  - Current effective coordinates for this publisher
  - Source of current data (e.g., "SimpleMaps" or "Your override")
  - Override form (lat/lng/elevation/notes)
  - Clear override button (revert to default)
- [ ] Override history for this publisher's overrides

#### 6.3 Shared Components
- [ ] `CityCoordinateCard` - displays coordinate with source badge
- [ ] `CoordinateSourceList` - table of all sources with priority
- [ ] `CoordinateOverrideForm` - lat/lng/elevation/notes inputs
- [ ] `CoordinateMap` - small map showing pins for each source
- [ ] `OverrideHistoryList` - list of changes with timestamps

### Phase 7: Standardize City Display Across UI

**Problem**: Same city name can exist in multiple locations (e.g., "Springfield" in many US states). Current display is inconsistent - sometimes shows region, sometimes not, never shows district.

#### 7.1 Backend: Enhance City Response
- [ ] Update `buildDisplayName()` in `api/internal/handlers/cities.go` to include district
- [ ] Format: `City, District (if exists), Region (if exists), Country`
- [ ] Add `district` and `district_id` to City API response
- [ ] Ensure all city endpoints return consistent structure

#### 7.2 Frontend: Audit & Fix City Display Components
Files that display cities:
- [ ] `web/components/shared/LocationPicker.tsx` - uses display_name, shows region/country manually
- [ ] `web/components/publisher/CitySelector.tsx` - shows region/country manually
- [ ] `web/app/page.tsx` - homepage city search results
- [ ] `web/app/zmanim/[cityId]/page.tsx` - zmanim display page header
- [ ] `web/app/zmanim/[cityId]/[publisherId]/page.tsx` - publisher zmanim page
- [ ] `web/components/onboarding/steps/CustomizeZmanimStep.tsx`
- [ ] `web/components/shared/CoverageMapView/CoverageMapDialog.tsx`

#### 7.3 Create Shared City Display Component
- [ ] Create `web/components/shared/CityDisplay.tsx`
  - Props: `city`, `showCountry`, `showRegion`, `showDistrict`, `showCoordinates`
  - Consistent formatting: "City, District, Region, Country"
  - Optional: show coordinates and elevation
- [ ] Replace manual city formatting across all components with `<CityDisplay />`

### Phase 8: Testing & Cleanup
- [ ] **8.1** Test full import pipeline
  - [ ] geo reset
  - [ ] geo import-wof
  - [ ] geo import-simplemaps
  - [ ] geo import-elevations
  - [ ] geo export / geo import roundtrip
- [ ] **8.2** Update `docs/location-data-process.md`
- [ ] **8.3** Verify geo_cities has correct effective_* values
- [ ] **8.4** Clean up any dead code

---

## Overview

This plan implements a multi-source geographic data system to provide the most accurate latitude, longitude, and elevation data for zmanim calculations. The system allows multiple data sources with configurable priority, enabling community and publisher overrides of baseline data.

## Problem Statement

For accurate zmanim calculations, we need:
1. **City coordinates (lat/lng)** - Must be as accurate as possible; 0.01° error = ~1km = ~40 seconds sunrise/sunset error
2. **Elevation** - Every 10m error = ~40 seconds sunrise/sunset error
3. **Hierarchy + Names + Boundaries** - For geographic organization and search

Current approach uses WOF for everything, but:
- WOF coordinates are polygon centroids, not surveyed city centers
- Current elevation data has limited accuracy

## Solution Architecture

### Multi-Source Priority System

```
Coordinate Priority (highest to lowest):
1. Publisher - Publisher-specific overrides for their coverage areas
2. Community - User-submitted corrections (verified)
3. SimpleMaps - Government-surveyed coordinates (NGIA, USGS, Census)
4. WOF - Polygon centroids (baseline/fallback)

Elevation Priority:
1. Publisher - Publisher-verified elevation
2. Community - User-submitted corrections (verified)
3. GLO-90 - Copernicus 90m DEM (0.55m RMSE)
```

### Command Structure

```
api/cmd/geo/main.go

Commands:
  geo reset              Nuclear wipe - delete ALL geographic data
  geo status             Show current data state (counts, sources, quality)
  geo download           Download WOF SQLite + GLO-90 tiles
  geo import-wof         Import WOF hierarchy, boundaries, baseline coords
  geo import-simplemaps  Import SimpleMaps enhanced coordinates
  geo import-elevations  Lookup GLO-90 elevations for all cities
  geo export             Export all geo data to SQL dump (for fast import)
  geo import             Import from SQL dump file

Prerequisites:
  - WOF database: Auto-downloaded (~8.6GB compressed → ~40GB)
  - SimpleMaps:   REQUIRED at data/simplemaps/worldcities.csv
  - GLO-90:       Auto-downloaded from AWS S3 on demand
```

---

## Database Schema Changes

### New Tables

#### 1. `city_coordinates` - Multiple coordinate sources per city

```sql
CREATE TABLE public.city_coordinates (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    city_id uuid NOT NULL REFERENCES geo_cities(id) ON DELETE CASCADE,
    source VARCHAR(20) NOT NULL CHECK (source IN ('wof', 'simplemaps', 'community', 'publisher')),
    source_id TEXT, -- External ID from source (e.g., simplemaps id, wof_id)
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy_m INTEGER, -- Estimated accuracy in meters (NULL = unknown)

    -- For publisher/community sources
    submitted_by TEXT, -- clerk_user_id or publisher_id
    publisher_id UUID REFERENCES publishers(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    verified_by TEXT,

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE (city_id, source, COALESCE(publisher_id, '00000000-0000-0000-0000-000000000000'))
);

COMMENT ON TABLE public.city_coordinates IS 'Multiple coordinate sources per city with priority system';
COMMENT ON COLUMN public.city_coordinates.source IS 'wof=WOF centroid, simplemaps=NGIA/USGS surveyed, community=user submitted, publisher=publisher override';
COMMENT ON COLUMN public.city_coordinates.accuracy_m IS 'Estimated accuracy: simplemaps ~50m, wof ~1000m+, community/publisher varies';

CREATE INDEX idx_city_coordinates_city ON city_coordinates(city_id);
CREATE INDEX idx_city_coordinates_source ON city_coordinates(source);
CREATE INDEX idx_city_coordinates_publisher ON city_coordinates(publisher_id) WHERE publisher_id IS NOT NULL;
```

#### 2. `city_elevations` - Multiple elevation sources per coordinate

```sql
CREATE TABLE public.city_elevations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    city_id uuid NOT NULL REFERENCES geo_cities(id) ON DELETE CASCADE,
    coordinate_source VARCHAR(20) NOT NULL, -- Which coordinate set this elevation is for
    source VARCHAR(20) NOT NULL CHECK (source IN ('glo90', 'community', 'publisher')),

    elevation_m INTEGER NOT NULL,
    accuracy_m INTEGER, -- Estimated accuracy (GLO-90 ~1m)

    -- For publisher/community sources
    submitted_by TEXT,
    publisher_id UUID REFERENCES publishers(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    verified_by TEXT,

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE (city_id, coordinate_source, source, COALESCE(publisher_id, '00000000-0000-0000-0000-000000000000'))
);

COMMENT ON TABLE public.city_elevations IS 'Elevation data from multiple sources linked to coordinate sources';
COMMENT ON COLUMN public.city_elevations.coordinate_source IS 'Which coordinate source this elevation was looked up for';
COMMENT ON COLUMN public.city_elevations.source IS 'glo90=Copernicus GLO-90, community=user, publisher=publisher';

CREATE INDEX idx_city_elevations_city ON city_elevations(city_id);
CREATE INDEX idx_city_elevations_source ON city_elevations(source);
CREATE INDEX idx_city_elevations_publisher ON city_elevations(publisher_id) WHERE publisher_id IS NOT NULL;
```

#### 3. `geo_data_imports` - Track import runs

```sql
CREATE TABLE public.geo_data_imports (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source VARCHAR(20) NOT NULL, -- 'wof', 'simplemaps', 'glo90'
    import_type VARCHAR(20) NOT NULL, -- 'coordinates', 'elevation', 'hierarchy', 'full'
    version TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    records_processed INTEGER DEFAULT 0,
    records_imported INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    errors TEXT[],
    notes TEXT
);

COMMENT ON TABLE public.geo_data_imports IS 'Audit log of geographic data imports';
```

### Modified Tables

#### Update `geo_cities` table

```sql
-- Add effective coordinate/elevation columns (computed from priority system)
ALTER TABLE geo_cities ADD COLUMN effective_latitude DOUBLE PRECISION;
ALTER TABLE geo_cities ADD COLUMN effective_longitude DOUBLE PRECISION;
ALTER TABLE geo_cities ADD COLUMN effective_elevation_m INTEGER;
ALTER TABLE geo_cities ADD COLUMN coordinate_source VARCHAR(20) DEFAULT 'wof';
ALTER TABLE geo_cities ADD COLUMN elevation_source VARCHAR(20);
ALTER TABLE geo_cities ADD COLUMN data_quality_tier SMALLINT DEFAULT 4;

COMMENT ON COLUMN geo_cities.effective_latitude IS 'Best available latitude based on source priority';
COMMENT ON COLUMN geo_cities.effective_longitude IS 'Best available longitude based on source priority';
COMMENT ON COLUMN geo_cities.effective_elevation_m IS 'Best available elevation based on source priority';
COMMENT ON COLUMN geo_cities.coordinate_source IS 'Source of effective coordinates: publisher, community, simplemaps, wof';
COMMENT ON COLUMN geo_cities.elevation_source IS 'Source of effective elevation: publisher, community, glo90';
COMMENT ON COLUMN geo_cities.data_quality_tier IS '1=verified, 2=authoritative, 3=aggregated, 4=centroid';
```

### Database Functions

#### Priority Resolution Functions

```sql
CREATE OR REPLACE FUNCTION get_effective_city_coordinates(p_city_id UUID, p_publisher_id UUID DEFAULT NULL)
RETURNS TABLE (
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    source VARCHAR(20),
    accuracy_m INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT cc.latitude, cc.longitude, cc.source, cc.accuracy_m
    FROM city_coordinates cc
    WHERE cc.city_id = p_city_id
      AND (
          (cc.source = 'publisher' AND cc.publisher_id = p_publisher_id)
          OR (cc.source != 'publisher')
      )
    ORDER BY
        CASE cc.source
            WHEN 'publisher' THEN 1
            WHEN 'community' THEN 2
            WHEN 'simplemaps' THEN 3
            WHEN 'wof' THEN 4
            ELSE 5
        END,
        cc.verified_at DESC NULLS LAST
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_effective_city_elevation(
    p_city_id UUID,
    p_coordinate_source VARCHAR(20) DEFAULT NULL,
    p_publisher_id UUID DEFAULT NULL
)
RETURNS TABLE (
    elevation_m INTEGER,
    source VARCHAR(20),
    accuracy_m INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT ce.elevation_m, ce.source, ce.accuracy_m
    FROM city_elevations ce
    WHERE ce.city_id = p_city_id
      AND (p_coordinate_source IS NULL OR ce.coordinate_source = p_coordinate_source)
      AND (
          (ce.source = 'publisher' AND ce.publisher_id = p_publisher_id)
          OR (ce.source != 'publisher')
      )
    ORDER BY
        CASE ce.source
            WHEN 'publisher' THEN 1
            WHEN 'community' THEN 2
            WHEN 'glo90' THEN 3
            ELSE 4
        END,
        ce.verified_at DESC NULLS LAST
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## Import Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    GEOGRAPHIC DATA IMPORT PIPELINE                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  STEP 1: geo reset (optional - for fresh import)                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  • Truncate all geo_* tables                                 │   │
│  │  • Truncate city_coordinates, city_elevations                │   │
│  │  • Truncate publisher_coverage                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  STEP 2: geo import-wof                                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  • Auto-download WOF database if missing                     │   │
│  │  • Import continents, countries, regions, districts          │   │
│  │  • Import cities → geo_cities                                │   │
│  │  • Insert WOF coords → city_coordinates(source='wof')        │   │
│  │  • Import boundaries → geo_*_boundaries                      │   │
│  │  • Import names → geo_names                                  │   │
│  │  • Set effective_* = WOF values initially                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  STEP 3: geo import-simplemaps                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  • Load data/simplemaps/worldcities.csv                      │   │
│  │  • Match to existing cities by:                              │   │
│  │    - Country (iso2) + city name (fuzzy match)                │   │
│  │    - Admin region if available                               │   │
│  │    - Geographic proximity to WOF centroid                    │   │
│  │  • Insert into city_coordinates(source='simplemaps')         │   │
│  │  • Update geo_cities.effective_* where simplemaps is best    │   │
│  │  • Update geo_cities.coordinate_source = 'simplemaps'        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  STEP 4: geo import-elevations                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  • For each city, get effective coordinates                  │   │
│  │  • Download required GLO-90 tiles from AWS S3                │   │
│  │  • Query local GLO-90 tiles for elevation                    │   │
│  │  • Insert into city_elevations(source='glo90')               │   │
│  │  • Update geo_cities.effective_elevation_m                   │   │
│  │  • Update geo_cities.elevation_source = 'glo90'              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  STEP 5: Compute data quality tiers (automatic)                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Tier 1: Has publisher OR verified community override        │   │
│  │  Tier 2: Has SimpleMaps coordinates + GLO-90 elevation       │   │
│  │  Tier 3: Has SimpleMaps OR GLO-90 (not both)                 │   │
│  │  Tier 4: WOF centroid only                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  OPTIONAL: geo export                                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  • Export all geo tables to SQL dump                         │   │
│  │  • Use COPY format for fast import                           │   │
│  │  • Compress with gzip                                        │   │
│  │  • Output: data/geo-export-YYYYMMDD.sql.gz                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
api/
├── cmd/
│   └── geo/
│       ├── main.go              # Command router
│       ├── reset.go             # geo reset
│       ├── status.go            # geo status
│       ├── download.go          # geo download
│       ├── import_wof.go        # geo import-wof
│       ├── import_simplemaps.go # geo import-simplemaps
│       ├── import_elevations.go # geo import-elevations
│       ├── export.go            # geo export
│       └── import.go            # geo import (from dump)
├── internal/
│   ├── geo/
│   │   ├── glo90.go             # GLO-90 elevation lookup
│   │   ├── simplemaps.go        # SimpleMaps CSV import
│   │   └── priority.go          # Priority resolution logic
│   ├── db/
│   │   └── queries/
│   │       ├── city_coordinates.sql
│   │       ├── city_elevations.sql
│   │       └── geo_imports.sql
│   └── handlers/
│       └── admin_geo.go         # Admin geo data handlers
├── data/
│   ├── wof/                     # WOF SQLite database
│   ├── simplemaps/
│   │   └── worldcities.csv      # REQUIRED: SimpleMaps data
│   └── glo90/                   # GLO-90 GeoTIFF tiles
│       └── Copernicus_DSM_COG_.../

db/
└── migrations/
    └── 00000000000003_geo_sources.sql

docs/
├── plans/
│   └── geo-data-accuracy-enhancement.md  # This document
└── location-data-process.md              # Public documentation
```

---

## API Endpoints

### Admin Endpoints

```
GET    /admin/cities/:id/coordinates      # List all coordinate sources
POST   /admin/cities/:id/coordinates      # Add community coordinate
PUT    /admin/cities/:id/coordinates/:cid # Update/verify coordinate
DELETE /admin/cities/:id/coordinates/:cid # Remove coordinate source

GET    /admin/cities/:id/elevations       # List all elevation sources
POST   /admin/cities/:id/elevations       # Add community elevation
PUT    /admin/cities/:id/elevations/:eid  # Update/verify elevation
DELETE /admin/cities/:id/elevations/:eid  # Remove elevation source

GET    /admin/geo/imports                 # List import history
GET    /admin/geo/status                  # Current data status
```

### Publisher Endpoints

```
POST   /publisher/cities/:id/override     # Add publisher coordinate + elevation
PUT    /publisher/cities/:id/override     # Update publisher override
DELETE /publisher/cities/:id/override     # Remove publisher override
```

---

## Data Sources

### SimpleMaps World Cities

- **URL**: https://simplemaps.com/data/world-cities
- **Basic (free)**: ~5,000 major cities, requires attribution
- **Pro ($499)**: ~4,000,000 cities, government-surveyed (NGIA, USGS, Census Bureau)
- **File**: `data/simplemaps/worldcities.csv`

### Copernicus GLO-90

- **URL**: https://copernicus-dem-90m.s3.amazonaws.com/
- **Resolution**: 90m
- **Accuracy**: 0.55m RMSE
- **License**: Free commercial use
- **Tiles**: Downloaded on-demand, cached locally

### Who's On First

- **URL**: https://whosonfirst.org/
- **Data**: Hierarchy, boundaries, multilingual names
- **License**: CC-BY
- **File**: Auto-downloaded to `data/wof/`

---

## Attribution Requirements

### SimpleMaps (Basic/Free)
> Data provided by [SimpleMaps](https://simplemaps.com/data/world-cities)

### Copernicus GLO-90
> © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018
> provided under COPERNICUS by the European Union and ESA; all rights reserved

### Who's On First
> Data from [Who's On First](https://whosonfirst.org/), a gazetteer of places

---

## Success Criteria

1. [ ] All cities have coordinate source tracking
2. [ ] All cities have elevation source tracking
3. [ ] SimpleMaps matching > 90% for pro database
4. [ ] GLO-90 elevation for all cities with valid coordinates
5. [ ] Publishers can override coordinates for their coverage
6. [ ] Community can submit corrections
7. [ ] Admin can verify and manage data quality
8. [ ] Zmanim calculations use best available data
9. [ ] geo export/import roundtrip works correctly
10. [ ] Old import-wof directory removed
