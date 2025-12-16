# Plan: Fix Overture Import

## Current State Analysis

### Problems Identified

1. **Region Import Only Gets 1,307 vs Expected 63k+**
   - Root cause: Unique constraint `(country_id, code)`
   - All California counties share code "CA" → only 1 inserted per state
   - `ON CONFLICT DO NOTHING` silently drops 62k+ records

2. **Python/Go Code Mess**
   - 3 Python files for boundary imports (`import_boundaries.py`, `import_boundaries_spatial.py`, `import_admin_boundaries.py`)
   - Go `parquet-go` library can't read `division_area.parquet` (complex nested schema)
   - Workaround using Python with pyarrow

3. **Data Mismatch**
   - `division.parquet` (point data) has different `id` values than `division_area.parquet` (polygon data)
   - Must match via `division_id` field in `division_area.parquet` → `id` in `division.parquet`

### Current Record Counts
- Continents: 8
- Countries: 211
- Regions: 1,307 (expected: 63,848)
- Localities: 10,632,669 ✓
- Search Index: 10,632,669 ✓

## Plan

### Phase 1: Fix Region Import (Go)

**Change unique constraint strategy:**

```sql
-- Current (broken for sub-regions):
UNIQUE (country_id, code)

-- Option A: Use overture_id as unique key for regions
ALTER TABLE geo_regions DROP CONSTRAINT geo_regions_country_id_code_key;
ALTER TABLE geo_regions ADD CONSTRAINT geo_regions_overture_id_key UNIQUE (overture_id);

-- Option B: Make code nullable and use composite with overture_id
-- Keep (country_id, code) for top-level regions that have ISO codes
-- Use overture_id for sub-regions
```

**Update regions.go:**
- Top-level regions (subtype=region): Keep `(country_id, code)` upsert for ISO codes
- Sub-regions (county, localadmin): Use `overture_id` as unique key, don't extract code

### Phase 2: Remove Python Dependencies

**Option A: Accept Python for boundary import**
- Boundary import is one-time operation
- PyArrow handles complex parquet schemas better
- Keep single clean Python script

**Option B: Use DuckDB CLI**
- DuckDB can read complex parquet natively
- Go calls DuckDB CLI to extract boundary data
- Output to temp file, read in Go

**Recommendation: Option A** - Python is acceptable for one-time imports

### Phase 3: Clean Up Python Files

Delete:
- `import_boundaries.py` (old)
- `import_boundaries_spatial.py` (old)

Keep (cleaned up):
- `import_admin_boundaries.py` → rename to `boundaries.py`

### Phase 4: Simplify Boundary Import

Only import boundaries for:
- ✅ Continents (if available)
- ✅ Countries
- ✅ Regions (all 63k+)
- ❌ Localities (point data only - no boundaries needed)

### Phase 5: Update Import Order

```
1. Go: Import continents from division.parquet
2. Go: Import countries from division.parquet
3. Go: Import regions (ALL - fix unique constraint)
4. Go: Import localities
5. Go: Import names
6. Python: Import boundaries (continents, countries, regions)
7. Go: Refresh materialized views
```

## Implementation Steps

### Step 1: Fix geo_regions Schema
```sql
-- Drop existing constraint that breaks sub-region imports
ALTER TABLE geo_regions DROP CONSTRAINT IF EXISTS geo_regions_country_id_code_key;

-- Add unique constraint on overture_id (the natural key from Overture)
CREATE UNIQUE INDEX IF NOT EXISTS idx_geo_regions_overture_unique ON geo_regions(overture_id) WHERE overture_id IS NOT NULL;

-- Keep an index on (country_id, code) for queries but not as constraint
CREATE INDEX IF NOT EXISTS idx_geo_regions_country_code ON geo_regions(country_id, code);
```

### Step 2: Update regions.go
- Use `ON CONFLICT (overture_id) DO UPDATE` instead of `(country_id, code)`
- Store original region code in `code` field without uniqueness requirement

### Step 3: Clean up Python files
- Delete `import_boundaries.py`, `import_boundaries_spatial.py`
- Keep `import_admin_boundaries.py` for boundary import

### Step 4: Re-run full import
```bash
# Reset tables
cd api && go run ./cmd/import-overture reset

# Run full import
cd api && go run ./cmd/import-overture import

# Import boundaries (Python)
cd api/cmd/import-overture && python3 import_admin_boundaries.py --data-dir ../../data/overture
```

## Success Criteria

- [ ] 63,848+ regions imported (vs current 1,307)
- [ ] All regions have boundaries
- [ ] All countries have boundaries
- [ ] No Python dependencies for point data import
- [ ] Single Python script for boundary import
- [ ] Clean, simple codebase
