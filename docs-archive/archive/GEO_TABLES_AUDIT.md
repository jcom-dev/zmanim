# Geographic Tables Usage Audit

## Summary

Audit of all `geo_*` tables in the database to identify unused tables.

**Date**: 2025-12-07
**Database**: PostgreSQL with PostGIS
**Migration File**: `db/migrations/00000000000001_schema.sql`

## Audit Methodology

Searched all Go, SQL, TypeScript files for references to each geo table:
```bash
grep -r "table_name" /home/daniel/repos/zmanim/api --include="*.go" --include="*.sql"
```

Excluded schema definition lines (CREATE TABLE, comments, constraints).

## Results

| Table | References | Status | Notes |
|-------|------------|--------|-------|
| `geo_cities` | 125 | ✅ **USED** | Core city data - heavily used |
| `geo_countries` | 123 | ✅ **USED** | Country data - heavily used |
| `geo_regions` | 112 | ✅ **USED** | Administrative level 1 - heavily used |
| `geo_districts` | 69 | ✅ **USED** | Administrative level 2 - used |
| `geo_continents` | 50 | ✅ **USED** | Continent hierarchy - used |
| `geo_country_boundaries` | 33 | ✅ **USED** | Country polygons for point-in-polygon |
| `geo_district_boundaries` | 32 | ✅ **USED** | District polygons for point-in-polygon |
| `geo_region_boundaries` | 32 | ✅ **USED** | Region polygons for point-in-polygon |
| `geo_data_sources` | 26 | ✅ **USED** | Source tracking (WOF, SimpleMaps, GLO-90) |
| `geo_city_coordinates` | 19 | ✅ **USED** | Coordinate history/sources |
| `geo_names` | 17 | ✅ **USED** | Multi-language names |
| `geo_city_boundaries` | 16 | ✅ **USED** | City polygons |
| `geo_city_elevations` | 12 | ✅ **USED** | Elevation data history |
| `geo_boundary_imports` | 10 | ✅ **USED** | Boundary import tracking |
| `geo_name_mappings` | 10 | ✅ **USED** | Name normalization mappings |
| **`geo_data_imports`** | **0** | ⚠️ **UNUSED** | No references found |

## Unused Table Details

### `geo_data_imports`

**Schema** (lines 1523-1536 in schema.sql):
```sql
CREATE TABLE public.geo_data_imports (
    id integer NOT NULL,
    source_id integer NOT NULL,
    import_type character varying(20) NOT NULL,
    version text,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    records_processed integer DEFAULT 0,
    records_imported integer DEFAULT 0,
    records_updated integer DEFAULT 0,
    records_skipped integer DEFAULT 0,
    errors text[],
    notes text
);
```

**Purpose**: Appears designed to track import runs (WOF, SimpleMaps, GLO-90)

**Foreign Keys**:
- `source_id` → `geo_data_sources(id)`

**Indexes**:
- `idx_geo_data_imports_source_started` on `(source_id, started_at DESC)`

**Why Unused**:
- Import tools (`import-wof`, `import-simplemaps`, `import-elevation`) log directly to stdout
- No database tracking of import history currently implemented
- Statistics are calculated in-memory and displayed at completion

## Recommendations

### Option 1: Remove Unused Table ✅ Recommended

**Pros**:
- Simplifies schema
- Reduces maintenance burden
- No impact on existing functionality

**Cons**:
- Loses potential future feature

**Migration**:
```sql
DROP TABLE IF EXISTS geo_data_imports CASCADE;
```

### Option 2: Implement Import Tracking

**Pros**:
- Better audit trail of data imports
- Historical tracking of import statistics
- Could help debug data quality issues

**Cons**:
- Requires modifying all import tools
- Additional development/testing effort
- May not be needed for current use case

**Implementation** (if desired):
1. Add `recordImport()` function to each import tool
2. Insert record at start of import (capture started_at)
3. Update record at completion with statistics
4. Add `--skip-tracking` flag for testing

### Option 3: Keep For Future Use

**Pros**:
- Table already exists
- No work required now

**Cons**:
- Dead code in schema
- May confuse developers

## Similar Tables That ARE Used

For comparison, these similar audit/tracking tables **are** actively used:

| Table | Purpose | References |
|-------|---------|------------|
| `geo_boundary_imports` | Track boundary import runs | 10 |
| `geo_data_sources` | Define data sources (WOF, SimpleMaps, etc.) | 26 |

This suggests the schema was designed with import tracking in mind, but `geo_data_imports` was never implemented.

## Decision Required

**Question**: Should we:
1. **Remove** `geo_data_imports` table (clean up unused code)
2. **Implement** import tracking feature (use the table)
3. **Keep** table for potential future use

## Impact Analysis

**If removed**:
- ✅ No code changes required (no current references)
- ✅ Schema becomes cleaner
- ✅ Foreign key from `geo_data_sources` unaffected (no FK to geo_data_imports)

**If implemented**:
- ⚠️ Requires changes to 3 import tools
- ⚠️ Additional testing needed
- ✅ Better audit trail for data operations

## Verification Commands

```bash
# Verify no usage (should return nothing):
grep -r "geo_data_imports" /home/daniel/repos/zmanim --include="*.go" --include="*.sql" --include="*.ts" | grep -v "migrations/00000000000001_schema.sql"

# Check database for existing data:
psql -d zmanim_lab -c "SELECT COUNT(*) FROM geo_data_imports;"
```
