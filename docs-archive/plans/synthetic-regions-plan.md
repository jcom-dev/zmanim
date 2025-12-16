# Plan: Synthetic Regions for 100% Hierarchy Coverage

## Problem Statement

Our geographic hierarchy is: `Country → Region → Locality`

However, **2,209 localities (0.07%)** have no region in their Overture ancestry chain:
- They belong to small island nations, dependencies, or disputed territories
- Their parent chain goes: `locality → county/localadmin → country` (skipping region)

This breaks queries that rely on `inherited_region_id` being populated.

## Analysis Results

| Category | Count | Orphan Localities |
|----------|-------|-------------------|
| Disputed territories (X* codes) | ~20 | ~1,200 |
| Dependencies without regions | ~30 | ~600 |
| Countries with partial coverage | ~26 | ~400 |
| **TOTAL** | **76** | **2,209** |

### Top Offenders
- `XW` (West Bank - already remapped to IL): 943 orphans
- `ST` (São Tomé & Príncipe): 352 orphans
- `RE` (Réunion): 240 orphans
- `NU` (Niue): 101 orphans
- `AQ` (Antarctica): 42 orphans

## Solution: Synthetic Regions (Assigned During Import)

For each country/dependency with orphan localities, create a **synthetic region** and assign localities to it during import - not deferred to the search index.

### Synthetic Region Properties
- **Name**: Same as country name (e.g., "Antarctica", "Réunion")
- **Code**: `{CC}-GEN` (e.g., `AQ-GEN`, `RE-GEN`)
- **Type**: Standard region (region_type_id = 1)
- **Parent**: The country itself (stored as `parent_overture_id` referencing the country's `overture_id`)
- **Source**: Marked as synthetic (source_id for 'Synthetic' source)

### Implementation Steps

#### Step 1: Add synthetic source to geo_sources (in seed data)
```sql
INSERT INTO geo_sources (name, description, url)
VALUES ('Synthetic', 'Auto-generated geographic entities', NULL);
```

#### Step 2: Update import-overture.py

Add new step `create_synthetic_regions()` AFTER importing localities:

```python
def create_synthetic_regions(conn, country_cache):
    """
    Create synthetic regions for countries with orphan localities.

    1. Find all localities that have no region in their ancestry chain
    2. Group by country_id
    3. For each country with orphans:
       a. Create a synthetic region (code: {CC}-GEN)
       b. Update orphan localities to point to the synthetic region
    """

    # Query to find orphan localities (no region in ancestry)
    # Walk parent_overture_id chain and check if any parent is a region

    # For each country with orphans:
    # 1. Create synthetic region with parent_overture_id = country.overture_id
    # 2. UPDATE geo_localities SET parent_overture_id = synthetic_region.overture_id
    #    WHERE id IN (orphan_locality_ids)
```

#### Step 3: Synthetic Region Assignment

The key change: **localities are updated during import** to point to the synthetic region as their `parent_overture_id`. This means:
- The data is clean at the source
- `refresh_geo_search_index()` doesn't need special logic
- The hierarchy is complete and consistent

## Execution Order

1. **During import (import-overture.py):**
   ```
   reset_tables()
   disable_constraints()
   import_countries()           # Load countries
   import_regions()             # Load natural regions
   import_localities()          # Load localities with parent_overture_id
   remap_disputed_territories() # Fix West Bank, etc.
   create_synthetic_regions()   # NEW: Create synthetic regions + assign orphans
   import_boundaries()          # Load geographic boundaries
   import_names()               # Load multi-language names
   enable_constraints()
   refresh_geo_search_index()   # Rebuild search index (no special orphan logic needed)
   ```

2. **create_synthetic_regions() logic:**
   ```
   FOR each country:
     Find localities with no region ancestor (walk parent_overture_id chain)
     IF any orphans exist:
       Create synthetic region ({CC}-GEN)
       Update orphan localities: parent_overture_id = synthetic_region.overture_id
   ```

## Validation

After implementation, verify:
```sql
-- Should return 0
SELECT COUNT(*)
FROM geo_search_index
WHERE entity_type = 'locality'
  AND inherited_region_id IS NULL;

-- Should show synthetic regions
SELECT r.code, r.name, COUNT(s.entity_id) as locality_count
FROM geo_regions r
JOIN geo_search_index s ON s.inherited_region_id = r.id
WHERE r.code LIKE '%-GEN'
GROUP BY r.code, r.name
ORDER BY locality_count DESC;
```

## Files to Modify

1. `db/migrations/00000000000002_seed_data.sql`
   - Add 'Synthetic' source to `geo_sources` table

2. `api/cmd/import-overture/import-overture.py`
   - Add `create_synthetic_regions()` function
   - Call it after `remap_disputed_territories()` and before `import_names()`
   - Function creates synthetic regions AND updates orphan localities' `parent_overture_id`

## Rollback Plan

If needed, synthetic regions can be removed:
```sql
DELETE FROM geo_regions WHERE code LIKE '%-GEN';
-- Then re-run search index refresh
SELECT refresh_geo_search_index();
```
