# Database Normalization Fix Plan
**Status:** Ready for Implementation
**Created:** 2025-12-07
**Scope:** Fix all code incompatibilities after VARCHAR→Integer ID migration

---

## Executive Summary

The database schema has been successfully migrated from VARCHAR/TEXT lookups to normalized integer ID foreign keys with lookup tables. However, **all application code still references the old string fields**, causing complete incompatibility.

**Critical Issue:** The schema defines `status_id` (smallint), but SQLc queries still SELECT/INSERT `status` (string).

---

## Current State Analysis

### ✅ Schema Migration (COMPLETED)
- 21 lookup tables created with `id + key` pattern
- All entity tables updated with `_id` foreign key columns
- Foreign key constraints in place
- Indexes created

### ❌ Application Code (BROKEN)
- SQL queries reference old VARCHAR field names
- Generated models have wrong types (string instead of int)
- Handlers validate hardcoded strings
- Frontend expects string values

---

## Affected Lookup Tables (21 Total)

| Lookup Table | FK Column Name | Used By Tables | Priority |
|--------------|----------------|----------------|----------|
| `publisher_statuses` | `status_id` | publishers | **CRITICAL** |
| `algorithm_statuses` | `status_id` | algorithms | **CRITICAL** |
| `request_statuses` | `status_id` | publisher_requests, zman_registry_requests | **CRITICAL** |
| `coverage_levels` | `coverage_level_id` | publisher_coverage | **CRITICAL** |
| `zman_source_types` | `source_type_id` | publisher_zmanim | **HIGH** |
| `jewish_event_types` | `event_type_id` | jewish_events | **HIGH** |
| `fast_start_types` | `fast_start_type_id` | jewish_events | **HIGH** |
| `calculation_types` | `calculation_type_id` | astronomical_primitives | **MEDIUM** |
| `edge_types` | `edge_type_id` | astronomical_primitives | **MEDIUM** |
| `primitive_categories` | `category_id` | astronomical_primitives | **MEDIUM** |
| `ai_index_statuses` | `status_id` | ai_index_status | **LOW** |
| `publisher_roles` | `role_id` | publisher_invitations | **LOW** |
| `ai_content_sources` | `source_id` | embeddings, ai_index_status | **LOW** |
| `geo_levels` | Various | geo_names, geo_name_mappings, geo_boundary_imports | **LOW** |
| `data_types` | Various | geo tables | **LOW** |
| `explanation_sources` | `source_id` | explanation_cache | **LOW** |
| `day_types` | - | Existing (already normalized) | **N/A** |
| `event_categories` | - | Existing (already normalized) | **N/A** |
| `geo_data_sources` | - | Existing (already normalized) | **N/A** |
| `tag_types` | - | Existing (already normalized) | **N/A** |
| `time_categories` | - | Existing (already normalized) | **N/A** |

---

## Implementation Plan

### Phase 1: SQL Query Updates (Foundation)
**Goal:** Update all SQLc query files to use `_id` columns and JOIN to lookup tables for display names

#### 1.1 Critical Path Queries (Blocking)

**File:** `api/internal/db/queries/publishers.sql`
- [ ] **Line 6, 17, 22, 34, 40, 45:** Change `status` → `status_id`
- [ ] **Lines 97, 104:** Remove hardcoded `"verified"`, `"active"` strings
- [ ] Add JOINs to `publisher_statuses` for display names in SELECT queries
- [ ] Update all INSERT/UPDATE to use status_id (smallint)
- [ ] Example pattern:
  ```sql
  -- OLD
  SELECT id, name, status FROM publishers WHERE status = 'active'

  -- NEW
  SELECT p.id, p.name, p.status_id, ps.key as status_key,
         ps.display_name_english, ps.display_name_hebrew
  FROM publishers p
  JOIN publisher_statuses ps ON ps.id = p.status_id
  WHERE ps.key = 'active'
  ```

**File:** `api/internal/db/queries/algorithms.sql`
- [ ] **Lines 12, 22, 56, 78-79:** Change `status` → `status_id`
- [ ] Remove hardcoded `"draft"`, `"published"`, `"deprecated"` strings
- [ ] Add JOINs to `algorithm_statuses`
- [ ] Update WHERE clauses to filter by lookup key: `WHERE astatus.key = 'published'`

**File:** `api/internal/db/queries/coverage.sql`
- [ ] **Lines 23-29, 42, 46, 51, 56, 61:** Change `coverage_level` → `coverage_level_id`
- [ ] **Lines 94-114:** Rewrite CASE statement to use coverage_level_id (numeric comparison)
- [ ] Remove all hardcoded level strings: `"continent"`, `"country"`, `"region"`, `"district"`, `"city"`
- [ ] Add JOINs to `coverage_levels`
- [ ] Example CASE rewrite:
  ```sql
  -- OLD
  CASE WHEN coverage_level = 'city' THEN 1
       WHEN coverage_level = 'district' THEN 2 END

  -- NEW (with variable declarations for level IDs)
  DECLARE
    v_level_city smallint := (SELECT id FROM coverage_levels WHERE key = 'city');
  ...
  CASE WHEN coverage_level_id = v_level_city THEN 1
       WHEN coverage_level_id = v_level_district THEN 2 END
  ```

**File:** `api/internal/db/queries/zmanim.sql`
- [ ] **Lines 16, 101:** Change `source_type` → `source_type_id`
- [ ] Remove hardcoded `"event"`, `"behavior"` strings (lines 36, 489)
- [ ] Add JOINs to `zman_source_types`
- [ ] Update linked zman queries to use source_type_id

#### 1.2 Medium Priority Queries

**File:** `api/internal/db/queries/zman_requests.sql`
- [ ] Change `status` → `status_id`
- [ ] JOIN to `request_statuses`

**File:** `api/internal/db/queries/master_registry.sql`
- [ ] Review time_category usage
- [ ] Add JOINs to `time_categories` if needed

**File:** `api/internal/db/queries/admin.sql`
- [ ] Update all status filtering to use `_id` fields
- [ ] JOIN to appropriate status lookup tables

#### 1.3 Low Priority Queries

**File:** `api/internal/db/queries/ai_*.sql` (if exists)
- [ ] Update ai_index_status queries
- [ ] Update embeddings source references

---

### Phase 2: Regenerate SQLc Models
**Goal:** Get correct Go types (int16/int32 instead of string)

```bash
cd api
sqlc generate
```

**Verification:**
```bash
# Should show status_id/coverage_level_id as int types
grep -A2 "type Publisher struct" api/internal/db/sqlcgen/models.go
grep -A2 "type Algorithm struct" api/internal/db/sqlcgen/models.go
grep -A2 "type PublisherCoverage struct" api/internal/db/sqlcgen/models.go
```

**Expected output:**
```go
type Publisher struct {
    ID       int32  `json:"id"`
    Name     string `json:"name"`
    StatusID int16  `json:"status_id"`  // ← Should be int16, not string
}
```

---

### Phase 3: Backend Handler Updates
**Goal:** Replace string validation with lookup ID resolution

#### 3.1 Coverage Handler
**File:** `api/internal/handlers/coverage.go`

**Lines 87-90 - Validation Logic:**
```go
// OLD (REMOVE)
validLevels := map[string]bool{
    "continent": true, "country": true, "region": true,
    "district": true, "city": true,
}
if !validLevels[req.CoverageLevel] {
    RespondValidationError(w, r, "Invalid coverage level", nil)
    return
}

// NEW (ADD)
// Lookup coverage level ID from key
levelID, err := h.db.Queries.GetCoverageLevelIDByKey(ctx, req.CoverageLevel)
if err != nil {
    RespondValidationError(w, r, "Invalid coverage level",
        map[string]string{"coverage_level": "Invalid level"})
    return
}
```

**Add new SQLc query:**
```sql
-- name: GetCoverageLevelIDByKey :one
SELECT id FROM coverage_levels WHERE key = $1;
```

#### 3.2 Publisher Zmanim Handler
**File:** `api/internal/handlers/publisher_zmanim.go`

**Lines 704-850 - Source Type Conversion:**
```go
// OLD (REMOVE)
if req.SourceType == "copied" { ... }
if req.SourceType == "linked" { ... }

// NEW (ADD)
sourceTypeID, err := h.db.Queries.GetZmanSourceTypeIDByKey(ctx, req.SourceType)
if err != nil {
    RespondValidationError(w, r, "Invalid source type", nil)
    return
}
```

**Lines 1707, 1711 - Hardcoded strings:**
```go
// OLD
sourceType := "copied"  // or "linked"

// NEW
sourceTypeID := GetSourceTypeID(ctx, h.db, "copied")
```

#### 3.3 Publisher Algorithm Handler
**File:** `api/internal/handlers/publisher_algorithm.go`

**Status validation:**
```go
// OLD
if req.Status != "draft" && req.Status != "published" { ... }

// NEW
statusID, err := h.db.Queries.GetAlgorithmStatusIDByKey(ctx, req.Status)
```

#### 3.4 Admin Handler
**File:** `api/internal/handlers/admin.go`

**Lines 83-147 - Status filtering:**
```go
// OLD
WHERE status = 'active'

// NEW (already in SQL)
WHERE ps.key = 'active'
```

#### 3.5 Response Types
**File:** `api/internal/handlers/types.go`

**Update response structs:**
```go
// OLD
type PublisherResponse struct {
    ID     int32  `json:"id"`
    Name   string `json:"name"`
    Status string `json:"status"`  // ← Example: "active"
}

// NEW - Option 1: Return full lookup data
type PublisherResponse struct {
    ID                  int32  `json:"id"`
    Name                string `json:"name"`
    StatusID            int16  `json:"status_id"`
    StatusKey           string `json:"status_key"`            // "active"
    StatusDisplayHebrew string `json:"status_display_hebrew"` // "פעיל"
    StatusDisplayEnglish string `json:"status_display_english"` // "Active"
}

// NEW - Option 2: Nested object (PREFERRED)
type PublisherResponse struct {
    ID     int32          `json:"id"`
    Name   string         `json:"name"`
    Status StatusResponse `json:"status"`
}

type StatusResponse struct {
    ID            int16  `json:"id"`
    Key           string `json:"key"`
    DisplayHebrew string `json:"display_hebrew"`
    DisplayEnglish string `json:"display_english"`
}
```

**⚠️ CRITICAL DECISION NEEDED:** Choose response format (affects frontend)
- **Option 1:** Flat structure with separate fields
- **Option 2:** Nested objects (cleaner, matches lookup table structure)

---

### Phase 4: Backend Service Updates
**Goal:** Update business logic for status transitions

#### 4.1 Algorithm Service
**File:** `api/internal/services/algorithm_service.go`

```go
// Update status transition logic
func (s *AlgorithmService) PublishAlgorithm(ctx context.Context, id int32) error {
    // OLD
    return s.db.UpdateAlgorithmStatus(ctx, id, "published")

    // NEW
    publishedStatusID := GetStatusID(ctx, s.db, "algorithm_statuses", "published")
    return s.db.UpdateAlgorithmStatus(ctx, id, publishedStatusID)
}
```

**Helper function to add:**
```go
// GetLookupID is a generic helper for resolving lookup IDs by key
func GetLookupID(ctx context.Context, db *sqlcgen.Queries, table, key string) (int16, error) {
    // Implementation varies by lookup table
    // Consider code generation or reflection
}
```

---

### Phase 5: Frontend Updates
**Goal:** Update TypeScript types and component logic

#### 5.1 API Client Types
**File:** `web/lib/api-client.ts`

```typescript
// OLD
interface Publisher {
  id: number;
  name: string;
  status?: string;  // "active" | "pending" | "suspended"
}

// NEW - Match backend response format
interface Publisher {
  id: number;
  name: string;
  status: {
    id: number;
    key: string;
    display_hebrew: string;
    display_english: string;
  };
}
```

#### 5.2 Coverage Components
**File:** `web/components/publisher/CitySelector.tsx`

```typescript
// OLD
const coverageLevel: string = "city";

// NEW
const coverageLevel: CoverageLevel = {
  id: 5,
  key: "city",
  display_hebrew: "עיר",
  display_english: "City"
};

// Or just send key, backend resolves to ID
const coverageLevelKey = "city";
```

#### 5.3 Status Display Components

**Create reusable status badge component:**
```typescript
// web/components/shared/StatusBadge.tsx
interface StatusBadgeProps {
  status: {
    key: string;
    display_hebrew: string;
    display_english: string;
    color?: string;
  };
  language?: 'en' | 'he';
}

export function StatusBadge({ status, language = 'en' }: StatusBadgeProps) {
  const display = language === 'he'
    ? status.display_hebrew
    : status.display_english;

  return (
    <Badge variant={getVariantFromKey(status.key)}>
      {display}
    </Badge>
  );
}
```

#### 5.4 Dropdown/Select Components

**Fetch lookup data from API:**
```typescript
// web/lib/hooks/useLookupData.ts
export function useCoverageLevels() {
  return useQuery({
    queryKey: ['lookup', 'coverage-levels'],
    queryFn: () => api.public.get('/lookups/coverage-levels'),
  });
}

// In component
const { data: coverageLevels } = useCoverageLevels();

<Select>
  {coverageLevels?.map(level => (
    <SelectItem key={level.id} value={level.key}>
      {level.display_english}
    </SelectItem>
  ))}
</Select>
```

---

### Phase 6: Add Lookup API Endpoints
**Goal:** Provide frontend access to lookup table data

#### 6.1 New SQL Queries

**File:** `api/internal/db/queries/lookups.sql` (CREATE NEW)
```sql
-- name: GetCoverageLevels :many
SELECT id, key, display_name_hebrew, display_name_english, sort_order
FROM coverage_levels
ORDER BY sort_order;

-- name: GetPublisherStatuses :many
SELECT id, key, display_name_hebrew, display_name_english, color, sort_order
FROM publisher_statuses
WHERE is_active = true
ORDER BY sort_order;

-- name: GetAlgorithmStatuses :many
SELECT id, key, display_name_hebrew, display_name_english, color, sort_order
FROM algorithm_statuses
ORDER BY sort_order;

-- name: GetZmanSourceTypes :many
SELECT id, key, display_name_hebrew, display_name_english
FROM zman_source_types
ORDER BY id;

-- Generic lookup by key
-- name: GetCoverageLevelIDByKey :one
SELECT id FROM coverage_levels WHERE key = $1;

-- name: GetPublisherStatusIDByKey :one
SELECT id FROM publisher_statuses WHERE key = $1;

-- name: GetAlgorithmStatusIDByKey :one
SELECT id FROM algorithm_statuses WHERE key = $1;

-- name: GetZmanSourceTypeIDByKey :one
SELECT id FROM zman_source_types WHERE key = $1;
```

#### 6.2 New Handler

**File:** `api/internal/handlers/lookups.go` (CREATE NEW)
```go
package handlers

import (
	"net/http"
	"github.com/go-chi/chi/v5"
)

func (h *Handlers) RegisterLookupRoutes(r chi.Router) {
	r.Get("/lookups/coverage-levels", h.GetCoverageLevels)
	r.Get("/lookups/publisher-statuses", h.GetPublisherStatuses)
	r.Get("/lookups/algorithm-statuses", h.GetAlgorithmStatuses)
	r.Get("/lookups/zman-source-types", h.GetZmanSourceTypes)
}

func (h *Handlers) GetCoverageLevels(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	levels, err := h.db.Queries.GetCoverageLevels(ctx)
	if err != nil {
		RespondInternalError(w, r, "Failed to fetch coverage levels")
		return
	}
	RespondJSON(w, r, http.StatusOK, levels)
}

// Similar handlers for other lookups...
```

---

### Phase 7: Testing & Validation

#### 7.1 Unit Tests
```bash
cd api
go test ./internal/handlers/... -v
go test ./internal/services/... -v
```

#### 7.2 Integration Tests
- [ ] Test publisher creation with status_id
- [ ] Test coverage creation with coverage_level_id
- [ ] Test algorithm status transitions
- [ ] Test zman source type filtering

#### 7.3 E2E Tests
- [ ] Test onboarding flow (publisher status: pending → active)
- [ ] Test algorithm publishing flow (status: draft → published)
- [ ] Test coverage editor (level selection dropdown)

#### 7.4 Manual Testing Checklist
- [ ] Publisher dashboard loads without errors
- [ ] Algorithm editor shows correct status
- [ ] Coverage page displays levels correctly
- [ ] Admin panel filters by status
- [ ] All dropdowns populated from lookup tables
- [ ] Hebrew/English display names switch correctly

---

## Implementation Order (Dependency Chain)

### Week 1: Foundation (Backend Only)
1. ✅ Create lookup API SQL queries (`lookups.sql`)
2. ✅ Regenerate SQLc: `cd api && sqlc generate`
3. ✅ Create lookup handler (`lookups.go`)
4. ✅ Register lookup routes in main
5. ✅ Test lookup endpoints with curl

### Week 2: Critical Path (Publishers & Coverage)
1. ✅ Update `publishers.sql` (status → status_id)
2. ✅ Update `coverage.sql` (coverage_level → coverage_level_id)
3. ✅ Regenerate SQLc
4. ✅ Update `coverage.go` handler validation
5. ✅ Update `types.go` response structs (choose format)
6. ✅ Test publisher & coverage endpoints

### Week 3: Algorithms & Zmanim
1. ✅ Update `algorithms.sql`
2. ✅ Update `zmanim.sql`
3. ✅ Regenerate SQLc
4. ✅ Update handlers: `publisher_algorithm.go`, `publisher_zmanim.go`
5. ✅ Update `algorithm_service.go`
6. ✅ Test algorithm & zman endpoints

### Week 4: Frontend Updates
1. ✅ Update TypeScript types (`api-client.ts`)
2. ✅ Create `useLookupData.ts` hook
3. ✅ Create `StatusBadge.tsx` component
4. ✅ Update coverage components (CitySelector)
5. ✅ Update algorithm components
6. ✅ Update onboarding components

### Week 5: Remaining Tables & Polish
1. ✅ Update AI/embeddings queries (low priority)
2. ✅ Update geo tables queries (low priority)
3. ✅ Update request status tables
4. ✅ Full E2E testing
5. ✅ Performance testing
6. ✅ Documentation updates

---

## Rollback Plan

If critical issues arise:

1. **Immediate Rollback (< 1 hour):**
   ```bash
   git revert <commit-hash>
   ./scripts/migrate.sh rollback
   ./restart.sh
   ```

2. **Partial Rollback:**
   - Keep schema changes
   - Restore old SQL queries
   - Add temporary views for backward compatibility:
     ```sql
     CREATE VIEW publishers_legacy AS
     SELECT p.id, p.name, ps.key as status
     FROM publishers p
     JOIN publisher_statuses ps ON ps.id = p.status_id;
     ```

---

## Success Criteria

- [ ] All SQLc queries compile without errors
- [ ] All Go tests pass (`go test ./...`)
- [ ] All E2E tests pass
- [ ] No hardcoded status/type/level strings in code
- [ ] All API responses include lookup display names
- [ ] All frontend dropdowns populated from lookup endpoints
- [ ] Zero database constraint violations
- [ ] Hebrew/English switching works correctly
- [ ] Performance: No N+1 queries (verified with EXPLAIN ANALYZE)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Type mismatch errors | HIGH | HIGH | Comprehensive testing at each phase |
| Missing JOIN causes NULL | MEDIUM | HIGH | Add NOT NULL constraints, verify in tests |
| Frontend breaks from API changes | HIGH | MEDIUM | Version API or use feature flags |
| Performance regression | LOW | MEDIUM | Add indexes, review EXPLAIN plans |
| Data migration issues | LOW | CRITICAL | Schema already migrated, verify integrity |

---

## Quick Reference: File Change Checklist

### SQLc Query Files (6 files)
- [ ] `api/internal/db/queries/publishers.sql`
- [ ] `api/internal/db/queries/algorithms.sql`
- [ ] `api/internal/db/queries/coverage.sql`
- [ ] `api/internal/db/queries/zmanim.sql`
- [ ] `api/internal/db/queries/admin.sql`
- [ ] `api/internal/db/queries/lookups.sql` (NEW)

### Go Handlers (5+ files)
- [ ] `api/internal/handlers/coverage.go`
- [ ] `api/internal/handlers/publisher_zmanim.go`
- [ ] `api/internal/handlers/publisher_algorithm.go`
- [ ] `api/internal/handlers/admin.go`
- [ ] `api/internal/handlers/types.go`
- [ ] `api/internal/handlers/lookups.go` (NEW)

### Go Services (2+ files)
- [ ] `api/internal/services/algorithm_service.go`
- [ ] `api/internal/services/publisher_service.go`

### Frontend Hooks (3+ files)
- [ ] `web/lib/api-client.ts`
- [ ] `web/lib/hooks/useLookupData.ts` (NEW)
- [ ] `web/lib/hooks/useZmanimList.ts`

### Frontend Components (5+ files)
- [ ] `web/components/shared/StatusBadge.tsx` (NEW)
- [ ] `web/components/publisher/CitySelector.tsx`
- [ ] `web/components/algorithm/*.tsx`
- [ ] `web/components/onboarding/*.tsx`

---

## Estimated Effort

| Phase | Files | Lines Changed | Estimated Hours |
|-------|-------|---------------|-----------------|
| Phase 1: SQL Queries | 6 | ~500 | 16h |
| Phase 2: SQLc Regen | Auto | Auto | 1h |
| Phase 3: Handlers | 6 | ~400 | 12h |
| Phase 4: Services | 2 | ~200 | 6h |
| Phase 5: Frontend | 10 | ~600 | 16h |
| Phase 6: Lookup API | 2 | ~200 | 4h |
| Phase 7: Testing | All | N/A | 20h |
| **TOTAL** | **~26 files** | **~1,900 lines** | **~75 hours** |

**Timeline:** 3-5 weeks (1 developer, 15-20h/week)

---

## Notes & Considerations

1. **Backward Compatibility:** Not maintained (clean break)
2. **API Versioning:** Not needed (pre-production)
3. **Database Migration:** Already complete (verified in schema)
4. **Seed Data:** Already includes lookup table data (verified)
5. **Cache Invalidation:** Redis cache may have old string values - flush after deployment

---

**END OF PLAN**
