# Locality Terminology Remediation Plan

## Executive Summary

Complete migration from legacy "city/district" terminology to unified "locality" terminology across the entire Zmanim codebase. This is a **greenfield cleanup** - no backward compatibility, no legacy code, no technical debt.

**Target State:** Zero mentions of "city", "cities", "district", or "districts" in any:
- File names
- Variable names
- Function names
- API routes
- Database queries
- Type definitions
- Comments
- Test files

---

## Current State Analysis

### Already Migrated (No Changes Needed)
| Component | Status |
|-----------|--------|
| `api/internal/db/queries/localities.sql` | ✅ New file, locality-native |
| `api/internal/db/queries/coverage.sql` | ✅ Uses locality_id |
| `api/internal/db/queries/location_overrides.sql` | ✅ Uses locality_id |
| `web/components/shared/LocalityPicker.tsx` | ✅ New component |
| `web/lib/hooks/useLocalitySearch.ts` | ✅ New hook |
| `web/app/zmanim/[localityId]/` | ✅ New route structure |
| `web/types/geography.ts:LocationType` | ✅ Only valid values |

### Files Requiring Changes

#### Phase 1: Critical Runtime Fixes (Blocking)
These are compile/runtime errors that must be fixed first.

| File | Issue | Fix |
|------|-------|-----|
| None currently blocking | Previously identified issues resolved | N/A |

#### Phase 2: Backend Handlers (71 occurrences)

| File | Occurrences | Changes Required |
|------|-------------|------------------|
| [geo_boundaries.go](api/internal/handlers/geo_boundaries.go) | 12 | Remove legacy district/city boundary endpoints, update stats |
| [zmanim.go](api/internal/handlers/zmanim.go) | 3 | Rename `city_name` JSON tag to `locality_name` |
| [types.go](api/internal/handlers/types.go) | 4 | Rename `City` field → `Locality` in LocationInfo |
| [locations.go](api/internal/handlers/locations.go) | 3 | Audit locality references |
| [onboarding.go](api/internal/handlers/onboarding.go) | 3 | Audit for terminology |
| [dsl.go](api/internal/handlers/dsl.go) | 2 | Audit for terminology |
| [cache_invalidation_test.go](api/internal/handlers/cache_invalidation_test.go) | 30 | Rename test fixtures |
| [external_api_integration_test.go](api/internal/handlers/external_api_integration_test.go) | 9 | Rename test fixtures |
| [geo.go](api/internal/handlers/geo.go) | 2 | Audit |
| [MASTER_REGISTRY_CONVERSION_GUIDE.md](api/internal/handlers/MASTER_REGISTRY_CONVERSION_GUIDE.md) | 1 | Update documentation |

#### Phase 3: Database Queries

| File | Changes Required |
|------|------------------|
| [cities.sql](api/internal/db/queries/cities.sql) | Rename to `geo_hierarchy.sql` (queries are locality-native but filename is legacy) |

#### Phase 4: Frontend (319 occurrences across 69 files)

**High Priority Files:**

| File | Occurrences | Changes Required |
|------|-------------|------------------|
| [CoverageSearchPanel.tsx](web/components/shared/CoverageSearchPanel.tsx) | 6 | Audit terminology |
| [LocationSearch.tsx](web/components/shared/LocationSearch.tsx) | 4 | Remove district references |
| [LocalityPicker.tsx](web/components/shared/LocalityPicker.tsx) | 4 | Audit (new component, may be clean) |
| [page.tsx (coverage)](web/app/publisher/coverage/page.tsx) | 3 | Audit |
| [geography.ts](web/types/geography.ts) | 1 | Remove `City` type alias |
| [usePublisherCoverage.ts](web/lib/hooks/usePublisherCoverage.ts) | 3 | Audit |

**Note:** Many frontend occurrences are in shadcn/ui components (CSS variables, etc.) and are false positives (e.g., `opacity`, `specificity`).

#### Phase 5: Models & Services

| File | Changes Required |
|------|------------------|
| [models.go](api/internal/models/models.go) | Update `PublisherCoverageCreateRequest.CoverageLevel` comment |

---

## Detailed Task Breakdown

### Phase 1: Backend Handler Cleanup

#### Task 1.1: Fix geo_boundaries.go
**File:** [api/internal/handlers/geo_boundaries.go](api/internal/handlers/geo_boundaries.go)

**Changes:**
1. Remove `GetDistrictBoundariesLegacy` handler entirely
2. Remove `GetCityBoundariesLegacy` handler entirely
3. Remove `GetCityBoundaryLegacy` handler entirely
4. Update `GetGeoStats` response - remove "districts" and "cities" keys
5. Update routes in main.go to remove these endpoints

**Before:**
```go
func (h *Handlers) GetDistrictBoundariesLegacy(w http.ResponseWriter, r *http.Request) {
    // Legacy stub
}
```

**After:**
```go
// DELETE ENTIRELY
```

#### Task 1.2: Fix zmanim.go
**File:** [api/internal/handlers/zmanim.go](api/internal/handlers/zmanim.go)

**Changes:**
1. Line 47: Rename JSON tag `city_name` → `locality_name`
2. Line 82: Update Swagger comment - "specific city" → "specific locality"
3. Update any remaining city references in comments

**Before:**
```go
type ZmanimLocationInfo struct {
    LocalityName  string  `json:"city_name,omitempty"`
    // ...
}
```

**After:**
```go
type ZmanimLocationInfo struct {
    LocalityName  string  `json:"locality_name,omitempty"`
    // ...
}
```

#### Task 1.3: Fix types.go
**File:** [api/internal/handlers/types.go](api/internal/handlers/types.go)

**Changes:**
1. Line 131: Rename `City` field → `Locality` in `LocationInfo` struct
2. Update associated JSON tag and comments

**Before:**
```go
type LocationInfo struct {
    // City name
    City string `json:"city,omitempty" example:"New York"`
    // ...
}
```

**After:**
```go
type LocationInfo struct {
    // Locality name
    Locality string `json:"locality,omitempty" example:"New York"`
    // ...
}
```

#### Task 1.4: Fix models.go
**File:** [api/internal/models/models.go](api/internal/models/models.go)

**Changes:**
1. Line 228: Update comment - remove "district, city" from CoverageLevel options

**Before:**
```go
type PublisherCoverageCreateRequest struct {
    CoverageLevel string  `json:"coverage_level"` // continent, country, region, district, city
    // ...
}
```

**After:**
```go
type PublisherCoverageCreateRequest struct {
    CoverageLevel string  `json:"coverage_level"` // continent, country, region, locality
    // ...
}
```

### Phase 2: Database Query File Rename

#### Task 2.1: Rename cities.sql
**Action:** Rename file `api/internal/db/queries/cities.sql` → `api/internal/db/queries/geo_hierarchy.sql`

**Rationale:** The file contains geographic hierarchy queries (continents, countries, regions, localities). The "cities" name is legacy.

**Post-action:** Run `cd api && sqlc generate` to regenerate Go code

### Phase 3: Frontend Cleanup

#### Task 3.1: Fix geography.ts
**File:** [web/types/geography.ts](web/types/geography.ts)

**Changes:**
1. Line 349: Remove `City` type alias entirely

**Before:**
```typescript
export type City = LocalitySearchResult;
```

**After:**
```typescript
// DELETE - no backward compatibility needed
```

#### Task 3.2: Audit LocationSearch.tsx
**File:** [web/components/shared/LocationSearch.tsx](web/components/shared/LocationSearch.tsx)

**Audit for:**
- Variable names containing "city" or "district"
- References to district in filtering logic
- Comments mentioning city/district

#### Task 3.3: Audit CoverageSearchPanel.tsx
**File:** [web/components/shared/CoverageSearchPanel.tsx](web/components/shared/CoverageSearchPanel.tsx)

**Audit for:**
- `district_name` references (9 reported)
- District filtering logic

### Phase 4: Test File Updates

#### Task 4.1: Fix cache_invalidation_test.go
**File:** [api/internal/handlers/cache_invalidation_test.go](api/internal/handlers/cache_invalidation_test.go)

**Changes:**
- Rename all test fixtures and assertions using "city" terminology
- Update test data to use "locality" naming

#### Task 4.2: Fix external_api_integration_test.go
**File:** [api/internal/handlers/external_api_integration_test.go](api/internal/handlers/external_api_integration_test.go)

**Changes:**
- Rename test fixtures and assertions
- Update test data

### Phase 5: Route Cleanup

#### Task 5.1: Remove legacy geo boundary routes
**File:** `api/cmd/api/main.go`

Remove routes:
- `GET /geo/boundaries/districts`
- `GET /geo/boundaries/cities`
- `GET /geo/boundaries/cities/{id}`

### Phase 6: Swagger/OpenAPI Updates

After all code changes, regenerate Swagger documentation:
```bash
cd api && swag init -g cmd/api/main.go
```

---

## Execution Order

```
1. Backend Handlers (non-breaking changes)
   ├── geo_boundaries.go - Remove legacy handlers
   ├── zmanim.go - Fix JSON tags
   ├── types.go - Rename fields
   └── models.go - Update comments

2. Database Queries
   └── Rename cities.sql → geo_hierarchy.sql
   └── Run sqlc generate

3. Frontend Types
   └── geography.ts - Remove City alias

4. Frontend Components (audit & fix)
   ├── LocationSearch.tsx
   ├── CoverageSearchPanel.tsx
   └── Other files as needed

5. Test Files
   ├── cache_invalidation_test.go
   └── external_api_integration_test.go

6. Route Cleanup
   └── main.go - Remove legacy routes

7. Regenerate & Validate
   ├── sqlc generate
   ├── swag init
   ├── go build ./...
   ├── npm run type-check
   └── npm run build
```

---

## Validation Checklist

### After Each Phase

```bash
# Backend validation
cd api && go build -v ./...
cd api && go test ./...

# Frontend validation
cd web && npm run type-check
cd web && npm run build
```

### Final Validation

```bash
# Zero legacy terminology check
grep -rE "city|City|district|District" api/internal --include="*.go" | grep -v "_test.go" | grep -v "// " | wc -l
# Should output: 0

grep -rE "cityId|city_id|districtId|district_id" web --include="*.ts" --include="*.tsx" | wc -l
# Should output: 0

# File name check
find api web -type f \( -name "*city*" -o -name "*cities*" -o -name "*district*" \) | wc -l
# Should output: 0

# Full CI validation
./scripts/validate-ci-checks.sh
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking API contracts | Medium | High | Update frontend simultaneously, coordinate JSON tag changes |
| Test failures | High | Low | Update test fixtures in same PR |
| Missing occurrences | Medium | Low | Use comprehensive grep patterns, automated validation |

---

## Rollback Strategy

Not applicable - this is a greenfield cleanup with no production traffic on these endpoints yet. If issues arise:
1. Revert PR
2. Fix issues
3. Re-submit

---

## Estimated Scope

| Phase | Files | Estimated Changes |
|-------|-------|-------------------|
| 1. Backend Handlers | 5 | ~50 line changes |
| 2. Database Queries | 1 | File rename + regenerate |
| 3. Frontend Types | 1 | ~5 line deletions |
| 4. Frontend Components | 3-5 | ~30 line changes |
| 5. Test Files | 2 | ~40 line changes |
| 6. Routes | 1 | ~10 line deletions |
| **Total** | **15-20 files** | **~135 line changes** |

---

## Success Criteria

1. ✅ Zero occurrences of "city", "cities", "district", "districts" in:
   - Source code (excluding vendor/node_modules)
   - File names
   - Variable/function names
   - API routes
   - JSON field names

2. ✅ All tests pass:
   ```bash
   cd api && go test ./...
   cd web && npm test
   ```

3. ✅ CI pipeline passes:
   ```bash
   ./scripts/validate-ci-checks.sh
   ```

4. ✅ Type checking passes:
   ```bash
   cd web && npm run type-check
   ```

5. ✅ Build succeeds:
   ```bash
   cd api && go build -v ./...
   cd web && npm run build
   ```
