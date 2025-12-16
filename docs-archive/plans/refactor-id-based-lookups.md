# Refactoring Plan: ID-Based Geographic Lookups

**Status:** Ready for Implementation
**Priority:** HIGH - Causes "No Coverage" bug in Algorithm Editor
**Estimated Scope:** 3 files changed, ~120 lines removed, ~30 lines added

---

## Problem Summary

The Algorithm Editor shows "No Coverage" even when a publisher has region-level coverage because the frontend uses **name-based searches** (e.g., `q=Manchester`) instead of **ID-based lookups** (e.g., `region_id=76891`).

**Root Cause:** [page.tsx:495-523](../web/app/publisher/algorithm/page.tsx#L495-L523) searches for localities using:
- `q: coverage.region_name` (name-based - WRONG)
- `types: 'locality'` (wrong param name - backend uses `entity_types`)
- `country_code: coverage.country_code` (not supported by backend)

When the coverage API already returns `region_id`, `country_id`, `continent_id` which should be used directly.

---

## Solution: Single Unified Query

Instead of 4 separate code paths (locality/region/country/continent) each doing name-based searches, create **one SQL query** that returns representative localities for ALL of a publisher's coverage areas using IDs.

### New SQL Query

```sql
-- name: GetRepresentativeLocalitiesForCoverage :many
-- Returns one representative locality per coverage area using ID-based joins
-- Used by Algorithm Editor to get preview locations
SELECT DISTINCT ON (pc.id)
    pc.id as coverage_id,
    cl.key as coverage_level_key,
    s.entity_id as locality_id,
    s.display_name as locality_name,
    s.display_hierarchy as locality_hierarchy,
    s.latitude,
    s.longitude,
    s.timezone,
    s.country_code
FROM publisher_coverage pc
JOIN coverage_levels cl ON cl.id = pc.coverage_level_id
JOIN geo_search_index s ON s.entity_type = 'locality' AND (
    -- Direct locality match (ID-based)
    (cl.key = 'locality' AND s.entity_id = pc.locality_id)
    -- Region match via inherited_region_id (ID-based)
    OR (cl.key = 'region' AND s.inherited_region_id = pc.region_id)
    -- Country match (ID-based)
    OR (cl.key = 'country' AND s.country_id = pc.country_id)
    -- Continent match (ID-based)
    OR (cl.key = 'continent' AND s.continent_id = pc.continent_id)
)
WHERE pc.publisher_id = $1 AND pc.is_active = true
ORDER BY pc.id, s.population DESC NULLS LAST
LIMIT 10;
```

**Why this works:**
- Uses `region_id`, `country_id`, `continent_id` directly (IDs, not names)
- `DISTINCT ON (pc.id)` ensures one locality per coverage area
- `ORDER BY population DESC` picks the most populous (best representative)
- Single query replaces 4 separate API calls with potential failures

---

## Implementation Steps

### Step 1: Add SQL Query
**File:** `api/internal/db/queries/coverage.sql`

Add the `GetRepresentativeLocalitiesForCoverage` query above.

### Step 2: Generate SQLc
```bash
cd api && sqlc generate
```

### Step 3: Add Handler Endpoint
**File:** `api/internal/handlers/coverage.go`

```go
// GetRepresentativeLocalities returns one locality per coverage area for preview
// GET /publisher/coverage/localities
func (h *Handlers) GetRepresentativeLocalities(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil { return }

    localities, err := h.db.Queries.GetRepresentativeLocalitiesForCoverage(ctx, pc.PublisherID)
    if err != nil {
        slog.Error("failed to get representative localities", "error", err)
        RespondInternalError(w, r, "Failed to get localities")
        return
    }

    RespondJSON(w, r, http.StatusOK, localities)
}
```

### Step 4: Add Route
**File:** `api/cmd/api/routes.go`

```go
r.Get("/publisher/coverage/localities", h.GetRepresentativeLocalities)
```

### Step 5: Simplify Frontend
**File:** `web/app/publisher/algorithm/page.tsx`

Replace lines 405-532 (~127 lines) with:

```typescript
const loadCoverage = useCallback(async () => {
  if (!selectedPublisher) return;

  try {
    // Single API call - returns localities for all coverage types using IDs
    const localities = await api.get<Array<{
      coverage_id: number;
      coverage_level_key: string;
      locality_id: number;
      locality_name: string;
      locality_hierarchy: string;
      latitude: number;
      longitude: number;
      timezone: string;
      country_code: string;
    }>>('/publisher/coverage/localities');

    const mapped: CoverageLocality[] = localities.map(l => ({
      id: String(l.locality_id),
      name: l.locality_name,
      latitude: l.latitude,
      longitude: l.longitude,
      timezone: l.timezone,
      country: '', // Extract from hierarchy if needed
      country_code: l.country_code,
    }));

    setCoverageLocalities(mapped);

    // Extract country codes for filtering
    const codes = [...new Set(localities.map(l => l.country_code).filter(Boolean))];
    setCoverageCountryCodes(codes);

    if (mapped.length === 0) {
      setPreviewLocation(NO_COVERAGE_PLACEHOLDER);
      return;
    }

    // Use first locality as default preview
    const first = mapped[0];
    setPreviewLocation({
      latitude: first.latitude,
      longitude: first.longitude,
      timezone: first.timezone,
      displayName: first.name,
    });
  } catch (err) {
    console.error('Failed to load coverage:', err);
    setPreviewLocation(NO_COVERAGE_PLACEHOLDER);
  }
}, [api, selectedPublisher]);
```

---

## Files Changed

| File | Change | Lines |
|------|--------|-------|
| `api/internal/db/queries/coverage.sql` | Add query | +20 |
| `api/internal/handlers/coverage.go` | Add handler | +15 |
| `api/cmd/api/routes.go` | Add route | +1 |
| `web/app/publisher/algorithm/page.tsx` | Simplify loadCoverage | -100, +30 |

**Net:** ~70 lines removed, cleaner code, bug fixed

---

## Violations Fixed

| Before (Name-based) | After (ID-based) |
|---------------------|------------------|
| `q: coverage.region_name` | `s.inherited_region_id = pc.region_id` |
| `q: coverage.country_name` | `s.country_id = pc.country_id` |
| `q: coverage.continent_name` | `s.continent_id = pc.continent_id` |
| `types: 'locality'` (wrong param) | Removed - query handles filtering |
| `country_code: 'GB'` (unsupported) | Removed - query uses `country_id` |

---

## Testing

1. **Unit test the SQL query:**
   ```sql
   -- Test with publisher that has region coverage
   SELECT * FROM GetRepresentativeLocalitiesForCoverage(2);
   -- Should return locality in Manchester region
   ```

2. **E2E test:**
   - Publisher with region coverage → Algorithm Editor → Should show location dropdown with localities
   - Publisher with country coverage → Should show representative localities
   - Publisher with no coverage → Should show "No Coverage"

---

## Future Refactoring (Out of Scope)

These violations were found but are lower priority:

1. **SearchRegions query** (`geo_hierarchy.sql:146`) - Uses `r.name ILIKE` for admin search
   - Acceptable for admin search functionality
   - Could add ID-based lookup option later

2. **SearchGeoIndexExactContextOnly** (`geo_names.sql`) - Converts user input names to IDs
   - By design - this IS the name→ID conversion layer
   - No change needed

---

## Coding Standards Compliance

This refactoring enforces **Rule #7: Entity References - ALWAYS Use IDs**:

> **FORBIDDEN:** Text-based lookups, name matching, or string identifiers in API calls/database queries.
> **REQUIRED:** Numeric IDs for ALL entity references.

The new query uses:
- `pc.locality_id` (not locality_name)
- `pc.region_id` (not region_name)
- `pc.country_id` (not country_code or country_name)
- `pc.continent_id` (not continent_code or continent_name)
