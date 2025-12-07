# Plan: Geographic Hierarchy Redesign

**Status:** In Progress
**Last Updated:** 2025-12-05

---

## Implementation Progress

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Schema Migration | ✅ Complete |
| Phase 2 | Import Tool (WOF) | ✅ Complete (new single-source approach) |
| Phase 3 | API Endpoints | ✅ Complete |
| Phase 4 | Frontend Map Updates | ✅ Complete |
| Phase 5 | Data Import & Testing | 🔄 Ready to run |

---

## Problem Statement

The current geographic data model has inconsistencies:
- **UK issue**: England is treated as a region, but it's actually a constituent country. UK is a combination of 4 countries.
- **"Region" ambiguity**: In England, "region" should be "county" (e.g., Greater Manchester). In the US, ADM1="state", ADM2="county".
- **No boundaries working**: Map selection doesn't show boundaries reliably because of ID mismatches.
- **Missing county level**: UK users think in terms of counties (Greater Manchester, West Yorkshire) but we only have country/region/city.

### Previous Approach Failures (GeoNames + geoBoundaries)

The original approach used **multiple data sources**:
- GeoNames for countries, regions, cities
- geoBoundaries for polygon boundaries

**Why it failed:**
1. **Name matching is unreliable** - "Médéa" vs "Medea", "Boumerdès" vs "Boumerdes" (accent differences)
2. **No standardized IDs** - Each source uses different ID schemes with no cross-reference
3. **Cascade of failures** - A missed region match breaks all district→region assignments
4. **Fuzzy matching is dangerous** - Could link the wrong entities

---

## Solution: Who's On First (Single Source of Truth)

### Why Who's On First?

**Who's On First (WOF)** is a gazetteer from the team that built Mapzen. It provides:

1. **Stable 64-bit IDs** - Every place has a permanent ID that never changes
2. **Built-in hierarchy** via `wof:hierarchy` property - No matching needed!
3. **All levels included** - Countries, regions, counties, localities with boundaries
4. **Active maintenance** - Hosted by geocode.earth

### The `wof:hierarchy` Property

Every WOF record includes its complete hierarchy as direct ID references:

```json
{
  "wof:id": 101750223,
  "wof:name": "Los Angeles",
  "wof:placetype": "locality",
  "wof:hierarchy": [{
    "continent_id": 102191575,
    "country_id": 85633793,
    "region_id": 85688637,
    "county_id": 102086957,
    "locality_id": 101750223
  }]
}
```

**No name matching. No point-in-polygon. Just direct ID lookups.**

### 4-Level Hierarchy

```
Country → Region → County (District) → Locality (City)
   ↓         ↓           ↓                  ↓
  US      California  Los Angeles County  Los Angeles
  GB      England     Greater Manchester  Manchester
  IL      Tel Aviv    Tel Aviv-Yafo       Tel Aviv
```

### Data Sources

| Data | Source | Notes |
|------|--------|-------|
| All geo hierarchy + boundaries | Who's On First SQLite | Single source of truth |
| Elevation | SRTM (30m) | Separate lookup by lat/lng |

**Download URLs:**
- WOF Admin SQLite: `https://data.geocode.earth/wof/dist/sqlite/whosonfirst-data-admin-latest.db.bz2` (~8.6GB compressed)
- SRTM tiles: Auto-downloaded by `go-elevations` library as needed

---

## Schema Changes

### Migration: `00000000000017_add_wof_id.sql`

Added `wof_id` column to all geographic tables for reliable WOF matching:

```sql
ALTER TABLE geo_countries ADD COLUMN wof_id bigint UNIQUE;
ALTER TABLE geo_regions ADD COLUMN wof_id bigint UNIQUE;
ALTER TABLE geo_districts ADD COLUMN wof_id bigint UNIQUE;
ALTER TABLE cities ADD COLUMN wof_id bigint UNIQUE;
```

**Benefits:**
- Reliable sync with WOF data updates
- Data provenance tracking
- Incremental imports (upsert by wof_id)

---

## New Import Tool: `import-wof`

**Location:** `api/cmd/import-wof/main.go`

### Architecture

```
WOF SQLite DB ─────────────────────────────────────────────────────┐
  │                                                                 │
  ├─► Countries (placetype=country) ──► geo_countries (with wof_id)│
  │                                                                 │
  ├─► Regions (placetype=region) ─────► geo_regions (with wof_id)  │
  │      │                                                          │
  │      └─► Parent: wof:hierarchy.country_id ───► FK lookup       │
  │                                                                 │
  ├─► Counties (placetype=county) ────► geo_districts (with wof_id)│
  │      │                                                          │
  │      └─► Parent: wof:hierarchy.region_id ────► FK lookup       │
  │                                                                 │
  └─► Localities (placetype=locality) ─► cities (with wof_id)      │
         │                                                          │
         ├─► Parent: wof:hierarchy.country_id ──► FK lookup        │
         ├─► Parent: wof:hierarchy.region_id ───► FK lookup        │
         └─► Parent: wof:hierarchy.county_id ───► FK lookup        │
                                                                    │
SRTM Tiles ──► Elevation lookup by (latitude, longitude) ──────────┘
```

### Key Design Decisions

1. **No name matching** - All parent references use WOF IDs from `wof:hierarchy`
2. **WOF ID stored** - Every imported record stores its `wof_id` for future syncs
3. **Boundaries included** - WOF GeoJSON geometry stored directly
4. **Elevation from SRTM** - WOF doesn't have elevation, so we use SRTM 30m tiles

### Commands

```bash
# Check WOF status
cd api && go run ./cmd/import-wof status

# Download WOF SQLite (~8.6GB compressed, ~35GB uncompressed)
cd api && go run ./cmd/import-wof download

# Import from downloaded WOF database
cd api && go run ./cmd/import-wof import

# Full seed (download + import)
cd api && go run ./cmd/import-wof seed
```

### Import Process

1. **Download** - Fetch WOF admin SQLite from geocode.earth
2. **Extract** - Decompress bz2 file
3. **Import Countries** - Query `placetype='country'`, store with wof_id
4. **Import Regions** - Query `placetype='region'`, link via `wof:hierarchy.country_id`
5. **Import Counties** - Query `placetype='county'`, link via `wof:hierarchy.region_id`
6. **Import Localities** - Query `placetype='locality'`, link all three parent levels
7. **Elevation** - For each locality, lookup SRTM elevation by coordinates

### Dependencies

```go
import (
    _ "github.com/mattn/go-sqlite3"           // WOF SQLite reading
    "github.com/tkrajina/go-elevations/geoelevations"  // SRTM lookup
)
```

---

## Referential Integrity

### Foreign Key Chain (via WOF IDs)

```
cities.district_id → geo_districts.id (looked up by wof_id)
cities.region_id → geo_regions.id (looked up by wof_id)
cities.country_id → geo_countries.id (looked up by wof_id)
geo_districts.region_id → geo_regions.id (looked up by wof_id)
geo_regions.country_id → geo_countries.id (looked up by wof_id)
```

### Enforcement Mechanisms

| Guarantee | How Enforced |
|-----------|--------------|
| No orphan cities | FK constraint to `geo_countries` (NOT NULL) |
| Consistent hierarchy | WOF `wof:hierarchy` provides direct parent IDs |
| Geographic accuracy | WOF coordinates + SRTM elevation |
| Future sync capability | `wof_id` column enables incremental updates |

---

## File Structure

```
db/migrations/
├── 00000000000016_geo_nuclear_rebuild.sql  ✅ Base schema
└── 00000000000017_add_wof_id.sql           ✅ WOF ID columns

api/cmd/import-wof/
└── main.go                 ✅ New single-source WOF import tool

api/internal/
├── handlers/geo_boundaries.go   ✅ (unchanged)
└── db/queries/geo_boundaries.sql  ✅ (unchanged)

api/data/wof/               (auto-created by download, not in source control)
├── whosonfirst-data-admin-latest.db.bz2  (~8.6GB)
└── whosonfirst-data-admin-latest.db      (~35GB)

api/data/srtm/              (auto-created by go-elevations, not in source control)
└── *.hgt                   (SRTM tiles, downloaded on demand)
```

---

## Running the Import

### Prerequisites

1. Ensure PostgreSQL is running with PostGIS extension
2. Run migrations: `./scripts/migrate.sh`
3. Set `DATABASE_URL` environment variable

### Full Seed (Recommended)

```bash
# Set DATABASE_URL
export DATABASE_URL="postgres://..."

# Run complete seed from WOF
cd api && go run ./cmd/import-wof seed

# Optional: add --verbose for detailed progress
cd api && go run ./cmd/import-wof seed --verbose
```

### Disk Space Requirements

| Data | Size |
|------|------|
| WOF SQLite compressed | ~8.6 GB |
| WOF SQLite uncompressed | ~35 GB |
| SRTM tiles (all) | ~30 GB |
| SRTM tiles (on demand) | ~100 MB per region accessed |

---

## Success Criteria

1. All geographic entities have `wof_id` populated
2. Parent references use WOF hierarchy (no name matching)
3. UK boroughs selectable with boundaries
4. US counties selectable with boundaries
5. All cities have elevation data from SRTM
6. Incremental updates possible via `wof_id` matching

---

## References

- [Who's On First](https://whosonfirst.org/) - Primary data source
- [WOF Data Downloads](https://data.geocode.earth/wof/dist/) - SQLite distributions
- [WOF Hierarchy](https://github.com/whosonfirst/whosonfirst-data#hierarchies) - wof:hierarchy documentation
- [go-elevations](https://github.com/tkrajina/go-elevations) - SRTM elevation library
- [SRTM Data](https://www2.jpl.nasa.gov/srtm/) - NASA Shuttle Radar Topography Mission
