# Zmanim Service Consolidation Plan

## Executive Summary

This document provides a detailed implementation plan to consolidate all zmanim-related services, database queries, and API handlers into a single unified service. The goal is to eliminate fragmentation, reduce maintenance burden, and provide a single source of truth for all zmanim operations.

---

## Current State Analysis

### 1. Existing Services (4 separate files)

| Service | Location | Purpose | Status |
|---------|----------|---------|--------|
| `ZmanimService` | `api/internal/services/zmanim_service.go` | Legacy calculation service using algorithm package | **PARTIALLY DISABLED** - schema mismatch, cache methods disabled |
| `ZmanimCalculationService` | `api/internal/services/zmanim_calculation.go` | Primary calculation service using DSL executor | **ACTIVE** - main calculation engine |
| `ZmanimOrderingService` | `api/internal/services/zmanim_ordering.go` | Sorting zmanim by category/time | **ACTIVE** - standalone ordering utility |
| `ZmanimLinkingService` | `api/internal/services/zmanim_linking_service.go` | Link/copy zmanim between publishers | **ACTIVE** - specialized linking operations |

### 2. Related Services

| Service | Location | Purpose | Notes |
|---------|----------|---------|-------|
| `TimezoneService` | `api/internal/services/timezone_service.go` | Timezone lookup from coordinates | Singleton, used for UTC fallback |
| `AlgorithmService` | `api/internal/services/algorithm_service.go` | Algorithm CRUD operations | **PARTIALLY DISABLED** - schema mismatch |

### 3. Database Queries (Fragmented)

| Query | File | Purpose | Overlap |
|-------|------|---------|---------|
| `GetPublisherZmanim` | `zmanim.sql` | Full zmanim with tags, sources | **PRIMARY** - 112 lines, complex |
| `FetchPublisherZmanim` | `zmanim.sql` | Similar to above with `include_deleted` | **DUPLICATE** - 80% overlap |
| `GetPublisherZmanimSimplified` | `zmanim_simplified.sql` | Without tag aggregation | **SIMPLIFIED VERSION** |
| `GetPublisherZmanByKey` | `zmanim.sql` | Single zman by key | Single record version |
| `GetPublisherZmanByKeySimplified` | `zmanim_simplified.sql` | Simplified single zman | Simplified version |
| `GetPublisherZmanimForExternal` | `external_api.sql` | External API format | **DIFFERENT RESPONSE SHAPE** |
| `GetPublisherZmanimForLinking` | `zmanim.sql` | Published zmanim for linking | Filtering for linking UI |
| `GetLocalityDetailsForZmanim` | `zmanim.sql` | Locality with coordinates | Location resolution |
| `GetPublisherInfoForZmanim` | `zmanim.sql` | Publisher metadata | Publisher info |
| `GetAllMasterZmanimMetadata` | `zmanim.sql` | Master registry metadata | Enrichment data |
| `GetAllZmanimTags` | `zmanim.sql` | Tags for all zmanim | Tag enrichment |

### 4. Handlers That Fetch/Calculate Zmanim

| Handler | File | Method | Use Case |
|---------|------|--------|----------|
| `GetZmanimForLocality` | `zmanim.go` | GET /zmanim | Public zmanim with calculation |
| `GetZmanimByCoordinates` | `zmanim.go` | POST /zmanim | Legacy coordinate-based |
| `GetPublisherZmanim` | `publisher_zmanim.go` | GET /publisher/zmanim | Publisher dashboard view |
| `GetPublisherZmanimWeek` | `publisher_zmanim.go` | GET /publisher/zmanim/week | Week batch calculation |
| `GetExternalPublisherZmanim` | `external_api.go` | GET /external/publishers/{id}/zmanim | M2M API |
| `CalculateExternalBulkZmanim` | `external_api.go` | POST /external/zmanim/calculate | Bulk date range |
| `fetchPublisherZmanim` | `publisher_zmanim.go` | Internal helper | Converts SQLc to struct |
| `filterAndCalculateZmanim` | `publisher_zmanim.go` | Internal helper | Legacy lat/lon path |

---

## Problems Identified

### 1. Service Fragmentation
- **4 separate services** for zmanim operations
- `ZmanimService` is mostly disabled due to schema mismatch
- Logic duplicated between `ZmanimCalculationService` and handler-level code

### 2. Query Duplication
- `GetPublisherZmanim` vs `FetchPublisherZmanim` - 80% identical
- Simplified vs full versions - maintenance burden
- External API query duplicates filtering logic

### 3. Handler-Level Logic
- `fetchPublisherZmanim` in handler does complex conversion
- `filterAndCalculateZmanim` duplicates calculation logic
- Sorting logic in both service and handler level

### 4. Response Format Inconsistency
- `ZmanWithFormula` (public API)
- `PublisherZman` (publisher dashboard)
- `PublisherZmanWithTime` (calculated)
- `ExternalPublisherZman` (external API)
- Different tag representations across formats

### 5. Metadata Loading
- `loadZmanMetadata()` and `loadZmanTags()` called in handlers
- Not cached between requests
- Duplicate N+1 query patterns

---

## Consolidation Plan

### Phase 1: Unified Service Interface

Create a single `UnifiedZmanimService` that replaces all existing services.

#### Service Interface

```go
// File: api/internal/services/unified_zmanim_service.go

package services

type UnifiedZmanimService struct {
    db                *db.DB
    cache             *cache.Cache
    timezoneService   *TimezoneService
    categoryOrder     map[string]int // Loaded once at startup
}

// ZmanimRequest contains all optional parameters for fetching/calculating zmanim
type ZmanimRequest struct {
    // Required
    PublisherID int32

    // Location (one of these is required for calculation)
    LocalityID *int64   // Preferred - includes elevation, timezone
    Coordinates *struct { // Legacy fallback
        Latitude  float64
        Longitude float64
        Elevation float64
        Timezone  string
    }

    // Date (nil = today)
    Date *time.Time

    // Filters
    IncludeDisabled    bool // Default: false
    IncludeUnpublished bool // Default: false
    IncludeBeta        bool // Default: true
    IncludeDeleted     bool // Default: false (admin only)

    // Output options
    IncludeTags         bool // Default: true
    IncludeSourceInfo   bool // Default: false (for diff/revert UI)
    IncludeFormulas     bool // Default: false (for debugging)
    IncludeCalculations bool // Default: true when location provided

    // Pagination (for large lists)
    Limit  int32
    Offset int32
}

// ZmanimResponse is the unified response format
type ZmanimResponse struct {
    // Metadata
    Date        string        `json:"date"`
    Publisher   PublisherInfo `json:"publisher"`
    Location    *LocationInfo `json:"location,omitempty"`

    // Data
    Zmanim      []UnifiedZman `json:"zmanim"`

    // Cache info
    FromCache   bool       `json:"from_cache"`
    CachedAt    *time.Time `json:"cached_at,omitempty"`

    // Day context (when date + location provided)
    DayContext  *DayContext `json:"day_context,omitempty"`
}

// UnifiedZman is the single zman representation
type UnifiedZman struct {
    // Core fields
    ID           int32  `json:"id"`
    ZmanKey      string `json:"zman_key"`
    HebrewName   string `json:"hebrew_name"`
    EnglishName  string `json:"english_name"`

    // Status
    IsEnabled    bool   `json:"is_enabled"`
    IsPublished  bool   `json:"is_published"`
    IsBeta       bool   `json:"is_beta"`
    IsCustom     bool   `json:"is_custom"`
    IsEventZman  bool   `json:"is_event_zman"`

    // Calculation (only when location provided)
    Time         *string `json:"time,omitempty"`         // HH:MM:SS
    Timestamp    *int64  `json:"timestamp,omitempty"`    // Unix seconds
    RoundingMode string  `json:"rounding_mode"`

    // Category (for sorting)
    TimeCategory string  `json:"time_category"`
    CategoryOrder int    `json:"-"` // Internal for sorting

    // Formula (when requested)
    FormulaDSL   *string `json:"formula_dsl,omitempty"`

    // Tags (when requested)
    Tags         []ZmanTag `json:"tags,omitempty"`

    // Source info (when requested, for diff/revert)
    Source       *ZmanSource `json:"source,omitempty"`

    // Linking (when applicable)
    IsLinked                  bool    `json:"is_linked"`
    LinkedPublisherZmanID     *int32  `json:"linked_publisher_zman_id,omitempty"`
    LinkedSourcePublisherName *string `json:"linked_source_publisher_name,omitempty"`
}

// Primary method - handles all use cases
func (s *UnifiedZmanimService) GetZmanim(ctx context.Context, req ZmanimRequest) (*ZmanimResponse, error)

// Specialized methods (delegate to GetZmanim internally)
func (s *UnifiedZmanimService) CalculateForLocality(ctx context.Context, publisherID int32, localityID int64, date time.Time) (*ZmanimResponse, error)
func (s *UnifiedZmanimService) CalculateRange(ctx context.Context, publisherID int32, localityID int64, startDate, endDate time.Time) ([]ZmanimResponse, error)
func (s *UnifiedZmanimService) CalculateFormula(ctx context.Context, formula string, params FormulaParams) (*FormulaResult, error)

// Ordering (incorporated into service)
func (s *UnifiedZmanimService) SortZmanim(zmanim []UnifiedZman) []UnifiedZman

// Cache invalidation
func (s *UnifiedZmanimService) InvalidatePublisherCache(ctx context.Context, publisherID int32) error
func (s *UnifiedZmanimService) InvalidateLocalityCache(ctx context.Context, publisherID int32, localityID int64) error

// Linking operations (from ZmanimLinkingService)
func (s *UnifiedZmanimService) LinkOrCopyZman(ctx context.Context, req LinkOrCopyZmanRequest) (*LinkOrCopyZmanResult, error)
```

### Phase 2: Unified Database Query

Create a single, parameterized query that handles all zmanim fetching scenarios.

#### Query Design

```sql
-- File: api/internal/db/queries/zmanim_unified.sql

-- name: GetUnifiedPublisherZmanim :many
-- Universal query for publisher zmanim - all filters are optional
-- Uses sqlc.narg() for nullable parameters
SELECT
    pz.id,
    pz.publisher_id,
    pz.zman_key,
    pz.hebrew_name,
    pz.english_name,
    pz.transliteration,
    pz.description,
    -- Resolve formula from linked source
    COALESCE(linked_pz.formula_dsl, pz.formula_dsl) AS formula_dsl,
    pz.ai_explanation,
    pz.publisher_comment,
    pz.is_enabled,
    pz.is_visible,
    pz.is_published,
    pz.is_beta,
    pz.is_custom,
    pz.display_status,
    pz.dependencies,
    pz.rounding_mode,
    pz.created_at,
    pz.updated_at,
    pz.deleted_at,
    pz.master_zman_id,
    pz.linked_publisher_zman_id,
    -- Time category
    pz.time_category_id,
    COALESCE(mr_tc.key, tc.key, 'uncategorized') AS time_category,
    COALESCE(mr_tc.sort_order, tc.sort_order, 99) AS category_sort_order,
    -- Is event zman check
    EXISTS (
        SELECT 1 FROM publisher_zman_tags pzt
        JOIN zman_tags zt ON pzt.tag_id = zt.id
        JOIN tag_types tt ON zt.tag_type_id = tt.id
        WHERE pzt.publisher_zman_id = pz.id
          AND (tt.key = 'event' OR zt.tag_key IN ('category_candle_lighting', 'category_havdalah'))
    ) AS is_event_zman,
    -- Linked info
    CASE WHEN pz.linked_publisher_zman_id IS NOT NULL THEN true ELSE false END AS is_linked,
    linked_pub.name AS linked_source_publisher_name,
    CASE WHEN linked_pz.deleted_at IS NOT NULL THEN true ELSE false END AS linked_source_is_deleted,
    -- Source info (for diff/revert)
    CASE WHEN sqlc.narg('include_source')::boolean = true THEN
        COALESCE(mr.canonical_hebrew_name, linked_pz.hebrew_name, '')
    ELSE '' END AS source_hebrew_name,
    CASE WHEN sqlc.narg('include_source')::boolean = true THEN
        COALESCE(mr.canonical_english_name, linked_pz.english_name, '')
    ELSE '' END AS source_english_name,
    CASE WHEN sqlc.narg('include_source')::boolean = true THEN
        COALESCE(mr.default_formula_dsl, linked_pz.formula_dsl, '')
    ELSE '' END AS source_formula_dsl
FROM publisher_zmanim pz
LEFT JOIN time_categories tc ON pz.time_category_id = tc.id
LEFT JOIN publisher_zmanim linked_pz ON pz.linked_publisher_zman_id = linked_pz.id
LEFT JOIN publishers linked_pub ON linked_pz.publisher_id = linked_pub.id
LEFT JOIN master_zmanim_registry mr ON pz.master_zman_id = mr.id
LEFT JOIN time_categories mr_tc ON mr.time_category_id = mr_tc.id
WHERE pz.publisher_id = $1
  -- Soft delete filter (default: exclude deleted)
  AND (sqlc.narg('include_deleted')::boolean = true OR pz.deleted_at IS NULL)
  -- Status filters
  AND (sqlc.narg('include_disabled')::boolean = true OR pz.is_enabled = true)
  AND (sqlc.narg('include_unpublished')::boolean = true OR pz.is_published = true)
  AND (sqlc.narg('include_beta')::boolean = true OR pz.is_beta = false)
ORDER BY
    COALESCE(mr_tc.sort_order, tc.sort_order, 99),
    pz.hebrew_name;

-- name: GetZmanTagsBatch :many
-- Fetch tags for multiple zmanim at once (avoids N+1)
SELECT
    pzt.publisher_zman_id,
    t.id,
    t.tag_key,
    t.name,
    t.display_name_hebrew,
    t.display_name_english,
    tt.key AS tag_type,
    t.color,
    t.sort_order,
    pzt.is_negated,
    -- Check if modified from master
    CASE
        WHEN mzt.tag_id IS NULL THEN true
        WHEN pzt.is_negated != mzt.is_negated THEN true
        ELSE false
    END AS is_modified,
    mzt.is_negated AS source_is_negated
FROM publisher_zman_tags pzt
JOIN zman_tags t ON pzt.tag_id = t.id
JOIN tag_types tt ON t.tag_type_id = tt.id
LEFT JOIN publisher_zmanim pz ON pzt.publisher_zman_id = pz.id
LEFT JOIN master_zman_tags mzt ON mzt.master_zman_id = pz.master_zman_id AND mzt.tag_id = pzt.tag_id
WHERE pzt.publisher_zman_id = ANY($1::int[])
ORDER BY pzt.publisher_zman_id, t.sort_order;
```

### Phase 3: Migration Steps

#### Step 1: Create the Unified Service (New File)
- Create `api/internal/services/unified_zmanim_service.go`
- Implement `UnifiedZmanimService` with all methods
- Incorporate ordering logic from `ZmanimOrderingService`
- Incorporate linking logic from `ZmanimLinkingService`

#### Step 2: Create Unified Query
- Create `api/internal/db/queries/zmanim_unified.sql`
- Run `sqlc generate`

#### Step 3: Update Handlers (Incremental)
For each handler, in order of priority:

1. **`GetZmanimForLocality`** (zmanim.go)
   - Replace `zmanimCalculationService.CalculateZmanim()` with `unifiedService.GetZmanim()`
   - Remove calls to `loadZmanMetadata()`, `loadZmanTags()` (now in service)
   - Remove `sortZmanimByTime()` (now in service)

2. **`GetPublisherZmanim`** (publisher_zmanim.go)
   - Replace `fetchPublisherZmanim()` with `unifiedService.GetZmanim()`
   - Remove `filterAndCalculateZmanim()` (now in service)

3. **`GetExternalPublisherZmanim`** (external_api.go)
   - Use `unifiedService.GetZmanim()` with external format transformation

4. **`CalculateExternalBulkZmanim`** (external_api.go)
   - Use `unifiedService.CalculateRange()`

5. **Handler Helpers to Remove**:
   - `fetchPublisherZmanim()` - Move to service
   - `filterAndCalculateZmanim()` - Move to service
   - `loadZmanMetadata()` - Move to service (cache at startup)
   - `loadZmanTags()` - Move to service (batch query)
   - `shouldShowZman()` - Move to service

#### Step 4: Deprecate Old Services
- Mark `ZmanimService` as deprecated (already mostly disabled)
- Mark `ZmanimOrderingService` as deprecated (incorporated)
- Mark `ZmanimLinkingService` as deprecated (incorporated)
- Keep `ZmanimCalculationService` temporarily for DSL execution (incorporate later)

#### Step 5: Remove Old Queries
- Remove duplicate queries from `zmanim.sql`:
  - `GetPublisherZmanim` (replaced by `GetUnifiedPublisherZmanim`)
  - `FetchPublisherZmanim` (replaced by `GetUnifiedPublisherZmanim`)
- Keep `zmanim_simplified.sql` for migration period, then remove
- Update query INDEX.md

#### Step 6: Update Handlers Struct
```go
// In handlers.go
type Handlers struct {
    // ... existing fields ...

    // Remove these:
    // zmanimService            *services.ZmanimService
    // zmanimCalculationService *services.ZmanimCalculationService
    // zmanimOrderingService    *services.ZmanimOrderingService

    // Add this:
    zmanimService *services.UnifiedZmanimService
}
```

---

## Phase 4: Verification Criteria

### Unit Tests
- [ ] `GetZmanim` returns correct data for all filter combinations
- [ ] `GetZmanim` with locality calculates times correctly
- [ ] `GetZmanim` with coordinates (legacy) works
- [ ] Sorting by category then time works correctly
- [ ] Tags are loaded in batch (no N+1)
- [ ] Cache hit/miss works correctly
- [ ] Linking operations work correctly

### Integration Tests
- [ ] Public API `/zmanim` returns same response shape
- [ ] Publisher API `/publisher/zmanim` returns same response shape
- [ ] External API `/external/publishers/{id}/zmanim` returns same response shape
- [ ] Bulk calculation `/external/zmanim/calculate` returns same results
- [ ] Cache invalidation works after zman updates

### Performance Tests
- [ ] Single query execution < 50ms for 50 zmanim
- [ ] Batch tag query < 20ms for 50 zmanim
- [ ] Cache hit returns in < 5ms
- [ ] No N+1 queries detected

---

## Definition of Done (DoD)

### Functional Requirements
- [ ] All existing API endpoints return identical responses (or documented improvements)
- [ ] All zmanim calculations produce identical times
- [ ] All filtering options work (disabled, unpublished, beta, deleted)
- [ ] All sorting is consistent (category order, time, hebrew name)
- [ ] All tag loading is efficient (batch, not N+1)
- [ ] Cache invalidation works for all update paths
- [ ] Linking/copying between publishers works

### Code Quality
- [ ] Single service file < 500 lines (or split by concern)
- [ ] Single primary query (with optional params)
- [ ] All handlers use unified service (no direct DB calls for zmanim)
- [ ] No duplicate response structs (single `UnifiedZman` type)
- [ ] Comprehensive error handling with specific error types

### Documentation
- [ ] Service API documented with examples
- [ ] Query parameters documented
- [ ] Migration guide for handler updates
- [ ] INDEX.md files updated

### Testing
- [ ] Unit test coverage > 80% for service
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Performance benchmarks documented

---

## Critical Files for Implementation

| File | Action |
|------|--------|
| `api/internal/services/unified_zmanim_service.go` | CREATE - new unified service |
| `api/internal/db/queries/zmanim_unified.sql` | CREATE - new unified query |
| `api/internal/services/zmanim_calculation.go` | DEPRECATE - merge into unified |
| `api/internal/services/zmanim_service.go` | DELETE - already disabled |
| `api/internal/services/zmanim_ordering.go` | DEPRECATE - merge into unified |
| `api/internal/services/zmanim_linking_service.go` | DEPRECATE - merge into unified |
| `api/internal/services/timezone_service.go` | KEEP - but use internally only |
| `api/internal/handlers/publisher_zmanim.go` | UPDATE - use unified service |
| `api/internal/handlers/zmanim.go` | UPDATE - use unified service |
| `api/internal/handlers/external_api.go` | UPDATE - use unified service |
| `api/internal/handlers/handlers.go` | UPDATE - handler struct |
| `api/internal/db/queries/zmanim.sql` | CLEANUP - remove duplicates |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Response shape changes break clients | HIGH | Compare responses side-by-side before switching |
| Calculation differences | HIGH | Run parallel calculations and compare |
| Performance regression | MEDIUM | Benchmark before/after, optimize queries |
| Cache invalidation gaps | MEDIUM | Test all update paths |
| Tag loading regression | LOW | Verify batch query performance |

---

## Coding Standards Addition

Add the following to `docs/coding-standards.md`:

### Service Consolidation Principle (MANDATORY)

**ONE Service, ONE Query, ONE Response Type**

**FORBIDDEN patterns:**
- Multiple services for the same domain (e.g., `ZmanimService`, `ZmanimCalculationService`, `ZmanimOrderingService`)
- Duplicate queries with minor variations (e.g., `GetPublisherZmanim`, `FetchPublisherZmanim`)
- Handler-level data transformation that should be in service layer
- Multiple response structs for the same entity

**REQUIRED patterns:**
```go
// REQUIRED - Single unified service
type UnifiedZmanimService struct { ... }

// REQUIRED - Single request struct with optional params
type ZmanimRequest struct {
    PublisherID int32           // Required
    LocalityID  *int64          // Optional
    Date        *time.Time      // Optional, default today
    IncludeX    bool            // Optional filter
    // ... all options in one struct
}

// REQUIRED - Single response type
type UnifiedZman struct { ... }
```

**Why:**
- Reduces maintenance burden (one place to fix bugs)
- Ensures consistent behavior across all endpoints
- Simplifies testing (one service to test)
- Prevents "which query should I use?" confusion
- Aligns with DRY principle
