# Plan: geo_search_index Improvements

## Overview

Two issues to fix:
1. **Hierarchical Region Matching** - Publisher coverage for a parent region (e.g., England) should include all localities in child regions (e.g., Salford borough)
2. **Region Population Bug** - All sub-regions incorrectly have their country's total population instead of their own

## Current State Analysis

### Issue 1: Hierarchical Region Matching

**Problem:** When searching localities within publisher coverage, the query only checks `inherited_region_id` for direct matches:
```sql
s.inherited_region_id IN (SELECT region_id FROM publisher_coverage_areas WHERE region_id IS NOT NULL)
```

This fails when:
- Publisher covers "England" (region_id 64271)
- Locality "Salford" has `inherited_region_id = 76888` (Salford borough)
- Salford borough's parent is England (64271)
- Query doesn't find the match because it doesn't traverse the hierarchy

**Current hierarchy storage:**
- `inherited_region_id` - Only immediate region parent (single value)
- `hierarchy_path` (JSONB) - Full chain but not indexed for efficient overlap queries
- `keywords[]` - Contains ancestor names but not IDs

### Issue 2: Region Population Bug

**Problem:** In `api/cmd/geo-index/main.go` line 1034:
```sql
LEFT JOIN country_populations cp ON cp.country_id = r.country_id
...
cp.total_pop as population
```

This assigns the **country's total population** to ALL regions in that country.

**Result:** Manchester, Salford, Bury all show 51,233,249 (England's population)

---

## Solution Design

### New Column: `ancestor_region_ids int[]`

Add a new array column that stores ALL region IDs in the ancestry chain, enabling efficient GIN index queries:

```sql
-- Efficient hierarchical matching with GIN index
s.ancestor_region_ids && ARRAY[64271, 76891]::int[]
```

**Example values:**
| Locality | inherited_region_id | ancestor_region_ids |
|----------|---------------------|---------------------|
| Salford (Greater Manchester) | 76888 | {76888, 64271} |
| Prestwich (in Bury) | 76889 | {76889, 64271} |
| Westminster | 78374 | {78374, 64271} |

### Region Population Fix

Calculate actual region population by summing child localities:

```sql
WITH region_populations AS (
    SELECT
        s.inherited_region_id as region_id,
        SUM(l.population) as total_pop
    FROM geo_search_index s
    JOIN geo_localities l ON s.entity_id = l.id
    WHERE s.entity_type = 'locality'
      AND s.inherited_region_id IS NOT NULL
      AND l.population IS NOT NULL
    GROUP BY s.inherited_region_id
)
```

---

## Files to Modify

### 1. Database Schema Migration

**File:** `db/migrations/00000000000004_geo_search_ancestors.sql` (NEW)

```sql
-- Add ancestor_region_ids array column
ALTER TABLE geo_search_index ADD COLUMN ancestor_region_ids integer[];

-- GIN index for efficient array overlap queries
CREATE INDEX idx_geo_search_ancestor_regions ON geo_search_index USING GIN(ancestor_region_ids);

-- Comment
COMMENT ON COLUMN geo_search_index.ancestor_region_ids IS
    'Array of all region IDs in ancestry chain (immediate parent to root). Enables efficient hierarchical coverage matching.';
```

### 2. Shared Index Definitions

**File:** `api/internal/geo/search_index.go`

Add new index to `SearchIndexes()`:
```go
{"idx_geo_search_ancestor_regions", "CREATE INDEX idx_geo_search_ancestor_regions ON geo_search_index USING GIN(ancestor_region_ids)", "~30 sec"},
```

### 3. geo-index Command (Full Rebuild)

**File:** `api/cmd/geo-index/main.go`

#### Changes:
1. Add `ancestor_region_ids` to COPY columns (line ~1010, ~1200)
2. Populate `ancestor_region_ids` for regions (use self + ancestors from `regionAncestry`)
3. Populate `ancestor_region_ids` for localities (get from `inherited_region_id` + its ancestors)
4. Fix region population calculation (sum of child localities, not country total)

#### Region Population Fix (lines 1018-1041):

**Challenge:** Region populations need to be calculated from descendant localities, but:
- Localities reference regions via `ancestor_region_ids` (set during locality indexing)
- Regions are currently indexed BEFORE localities

**Solution: Two-phase approach**

**Phase A:** Index regions with NULL population initially (remove the broken country_populations join)
**Phase B:** After localities are indexed, UPDATE region populations using `ancestor_region_ids`:

```sql
-- Calculate region populations from ALL descendant localities (recursive)
-- A locality contributes to a region's population if that region is in its ancestor chain
UPDATE geo_search_index g
SET population = sub.total_pop
FROM (
    SELECT
        r.entity_id as region_id,
        SUM(COALESCE(l.population, 0)) as total_pop
    FROM geo_search_index r
    JOIN geo_search_index l ON l.entity_type = 'locality'
                            AND l.ancestor_region_ids @> ARRAY[r.entity_id]
    WHERE r.entity_type = 'region'
    GROUP BY r.entity_id
) sub
WHERE g.entity_type = 'region'
  AND g.entity_id = sub.region_id;
```

This ensures:
- England shows ~51M (sum of all localities in England + all sub-regions)
- Manchester borough shows ~500k (sum of localities in Manchester)
- Regions with no descendant localities show NULL (displayed as `-`)

#### Locality ancestor_region_ids Population:
```go
// In populateLocalityIndex(), after determining inheritedRegionID:
var ancestorRegionIDs []int32
if inheritedRegionID != nil {
    // Start with immediate region parent
    ancestorRegionIDs = append(ancestorRegionIDs, *inheritedRegionID)
    // Add all ancestor regions from the pre-loaded map
    if ancestors := regionAncestry[*inheritedRegionID]; ancestors != nil {
        ancestorRegionIDs = append(ancestorRegionIDs, ancestors...)
    }
}
```

### 4. seed-geodata Command (Restore from Dump)

**File:** `api/cmd/seed-geodata/main.go`

No changes needed - it restores from pg_dump which will include the new column after migration runs.

### 5. export-geodata Command (Create Dump)

**File:** `api/cmd/export-geodata/main.go`

No changes needed - pg_dump will automatically include the new column.

### 6. SQLc Generated Code

**File:** `api/internal/db/sqlcgen/models.go` (auto-generated)

After running `sqlc generate`, the `GeoSearchIndex` struct will include:
```go
AncestorRegionIDs []int32 `json:"ancestor_region_ids"`
```

### 7. SQL Queries Using Coverage Filter

Multiple SQL files need updates to use `ancestor_region_ids` instead of direct `inherited_region_id` matching.

#### File: `api/internal/db/queries/localities.sql`

**Lines 488 and 535** - `SearchLocalitiesWithPublisherCoverage` query (both exact and fuzzy match sections):

**Before:**
```sql
OR s.inherited_region_id IN (SELECT region_id FROM publisher_coverage_areas WHERE region_id IS NOT NULL)
```

**After:**
```sql
OR s.ancestor_region_ids && (SELECT ARRAY_AGG(region_id) FROM publisher_coverage_areas WHERE region_id IS NOT NULL)
```

#### File: `api/internal/db/queries/coverage.sql`

**Line 217** - `GetPublishersForLocality` query:

**Before:**
```sql
OR (pc.region_id IS NOT NULL AND ls.inherited_region_id = pc.region_id)
```

**After:**
```sql
OR (pc.region_id IS NOT NULL AND ls.ancestor_region_ids @> ARRAY[pc.region_id])
```

Note: Using `@>` (contains) since we're checking if the locality's ancestors contain the single coverage region ID.

### 8. TypeScript Types (Optional)

**File:** `web/types/geography.ts`

Add to relevant interfaces if exposed to frontend:
```typescript
ancestor_region_ids?: number[];
```

---

## Implementation Order

### Phase 1: Schema Migration
1. Create migration file `00000000000004_geo_search_ancestors.sql`
2. Run migration: `./scripts/migrate.sh`

### Phase 2: Update geo-index Command
1. Add `ancestor_region_ids` to COPY columns for both regions and localities
2. Populate the array using existing `regionAncestry` map
3. Fix region population calculation (two-pass: localities first, then regions)
4. Test locally: `go run ./cmd/geo-index`

### Phase 3: Update Index Definitions
1. Add new GIN index to `api/internal/geo/search_index.go`

### Phase 4: Update SQL Queries
1. Modify `SearchLocalitiesWithPublisherCoverage` to use `ancestor_region_ids &&`
2. Run `sqlc generate`
3. Test the query

### Phase 5: Rebuild Geodata
1. Run geo-index to rebuild with new column populated
2. Export new dump: `go run ./cmd/export-geodata`

### Phase 6: Verification
1. Test Salford search within Manchester publisher coverage
2. Verify region populations are correct
3. Run E2E tests

---

## Verification Queries

### Test Hierarchical Matching:
```sql
-- Should find Salford when publisher covers England (64271)
SELECT display_name, ancestor_region_ids
FROM geo_search_index
WHERE entity_type = 'locality'
  AND display_name = 'Salford'
  AND country_code = 'GB'
  AND ancestor_region_ids && ARRAY[64271]::int[];
```

### Test Region Population:
```sql
-- Manchester region should show ~500k, not 51M
SELECT display_name, population
FROM geo_search_index
WHERE entity_type = 'region'
  AND display_name IN ('Manchester', 'Salford', 'England')
  AND country_code = 'GB';
```

---

## Rollback Plan

If issues occur:
1. Drop the new column: `ALTER TABLE geo_search_index DROP COLUMN ancestor_region_ids;`
2. Drop the index: `DROP INDEX idx_geo_search_ancestor_regions;`
3. Revert SQL query changes
4. Run `sqlc generate`

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| Migration file | 5 min |
| geo-index changes | 30 min |
| search_index.go update | 5 min |
| SQL query update | 15 min |
| SQLc regenerate | 2 min |
| Testing & verification | 20 min |
| **Total** | ~1.5 hours |
