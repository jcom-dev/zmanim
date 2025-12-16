# Unified Zmanim Service Consolidation Plan

**Created:** 2024-12-20
**Status:** Ready for Implementation
**Objective:** Consolidate ALL zmanim service logic into a SINGLE file (`zmanim_service.go`) with NO zman-specific hardcoded logic.

---

## Executive Summary

The current codebase has **4 separate zmanim service files** plus duplicated logic in handlers. This plan consolidates everything into ONE service file and eliminates ALL hardcoded zman-specific logic (candle lighting, havdalah, fast days, etc.) - everything flows through **tags + DSL**.

---

## GUARANTEE: After Implementation

### Service Files State

| File | Current State | Target State |
|------|---------------|--------------|
| `zmanim_service.go` | Legacy, mostly disabled | **THE ONLY SERVICE** - all logic consolidated |
| `zmanim_calculation.go` | Active - 486 lines | **DELETED** - merged into zmanim_service.go |
| `zmanim_ordering.go` | Active - 89 lines | **DELETED** - merged into zmanim_service.go |
| `zmanim_linking_service.go` | Active - 244 lines | **DELETED** - merged into zmanim_service.go |

### Zero Zman-Specific Logic

After implementation, these patterns WILL NOT EXIST in handlers or services:

```go
// FORBIDDEN - No hardcoded zman checks
if isCandleLighting { ... }
if isHavdalah { ... }
if isFastStart { ... }
if isFastEnd { ... }
if zmanKey == "candle_lighting" { ... }
if zmanKey == "havdalah" { ... }

// FORBIDDEN - No hardcoded category mappings
case "category_candle_lighting":
    category = "candles"
case "category_havdalah":
    category = "havdalah"
```

### Allowed Patterns (Tag-Driven)

```go
// ALLOWED - Tag-based filtering using database values
if hasTag(z.Tags, dayCtx.ActiveEventCodes) { ... }
if z.matchesEventContext(dayCtx) { ... }

// ALLOWED - Generic tag checks
tags := getTagsByType(z.Tags, "behavior")
```

---

## Current State Analysis

### 1. Service File Inventory

| File | Lines | Purpose | Dependencies |
|------|-------|---------|--------------|
| `zmanim_service.go` | 170 | Legacy calculation wrapper | algorithm package |
| `zmanim_calculation.go` | 486 | DSL execution, caching, rounding | dsl, cache, db |
| `zmanim_ordering.go` | 89 | Category-based sorting | db (time_categories) |
| `zmanim_linking_service.go` | 244 | Link/copy between publishers | db, provenance |

**Total: 989 lines across 4 files**

### 2. Hardcoded Zman-Specific Logic Found

#### Location: `api/internal/handlers/publisher_zmanim.go`

```go
// Lines 1071-1086 - HARDCODED TAG CHECKS
isCandleLighting := hasTagKey(z.Tags, "is_candle_lighting")
isHavdalah := hasTagKey(z.Tags, "is_havdalah")
isFastStart := hasTagKey(z.Tags, "is_fast_start")
isFastEnd := hasTagKey(z.Tags, "is_fast_end")

if isCandleLighting && !dayCtx.ShowCandleLighting { return false }
if isHavdalah && !dayCtx.ShowHavdalah { return false }
if isFastStart && !dayCtx.ShowFastStart { return false }
if isFastEnd && !dayCtx.ShowFastEnd { return false }
```

#### Location: `api/internal/handlers/master_registry.go`

```go
// Lines 715-719 - HARDCODED CATEGORY MAPPING
case "category_candle_lighting":
    category = "candles"
case "category_havdalah":
    category = "havdalah"
case "category_fast_start", "category_fast_end":
    // ...
```

#### Location: `api/internal/handlers/publisher_zmanim.go`

```go
// Lines 120-123 - DayContext with specific Show* fields
ShowCandleLighting  bool  // Should show candle lighting zmanim
ShowHavdalah        bool  // Should show havdalah zmanim
ShowFastStart       bool  // Should show fast start zmanim
ShowFastEnd         bool  // Should show fast end zmanim
```

#### Location: `api/internal/calendar/events.go`

```go
// Lines 450-455 - ZmanimContext with specific Show* fields
ShowCandleLighting      bool
ShowCandleLightingSheni bool
ShowFastStarts          bool
ShowFastEnds            bool
```

---

## Target Architecture

### Single Unified Service

```go
// File: api/internal/services/zmanim_service.go
// Purpose: THE single source of truth for ALL zmanim operations
// Lines: ~600-700 (combined)

package services

type UnifiedZmanimService struct {
    db              *db.DB
    cache           *cache.Cache
    categoryOrder   map[string]int      // From time_categories.sort_order
    behaviorTags    map[string][]string // Tag behaviors for filtering
}

// === CALCULATION METHODS ===
func (s *UnifiedZmanimService) CalculateZmanim(ctx, params) (*CalculationResult, error)
func (s *UnifiedZmanimService) CalculateFormula(ctx, params) (*FormulaResult, error)
func (s *UnifiedZmanimService) CalculateRange(ctx, params) ([]DayResult, error)
func (s *UnifiedZmanimService) ExecuteFormulasWithCoordinates(...) (map[string]time.Time, error)

// === ORDERING METHODS ===
func (s *UnifiedZmanimService) SortZmanim(zmanim []SortableZman)
func (s *UnifiedZmanimService) GetCategoryOrder(category string) int

// === LINKING METHODS ===
func (s *UnifiedZmanimService) LinkOrCopyZman(ctx, req) (*LinkOrCopyZmanResult, error)

// === FILTERING METHODS (Tag-Driven) ===
func (s *UnifiedZmanimService) FilterZmanimForContext(zmanim []Zman, ctx EventContext) []Zman
func (s *UnifiedZmanimService) ShouldShowZman(z Zman, ctx EventContext) bool

// === CACHE METHODS ===
func (s *UnifiedZmanimService) InvalidatePublisherCache(ctx, publisherID) error
func (s *UnifiedZmanimService) InvalidateLocalityCache(ctx, publisherID, localityID) error

// === ROUNDING ===
func ApplyRounding(t time.Time, mode string) (exact, display string)
```

### Tag-Driven Event Filtering

Replace hardcoded `ShowCandleLighting`, `ShowHavdalah`, etc. with a **generic tag-based system**:

```go
// NEW: Generic EventContext (replaces DayContext specific fields)
type EventContext struct {
    Date              string
    ActiveEventCodes  []string           // From calendar service
    ActiveBehaviors   map[string]bool    // Behavior tags active today
}

// NEW: ZmanFilterConfig (loaded from database at startup)
type ZmanFilterConfig struct {
    BehaviorTag    string   // e.g., "is_candle_lighting"
    RequireEvents  []string // Event codes that trigger this behavior
}

// Example behavior configs in database:
// | behavior_tag        | require_events                              |
// |---------------------|---------------------------------------------|
// | is_candle_lighting  | erev_shabbos, erev_yom_tov                  |
// | is_havdalah         | motzei_shabbos, motzei_yom_tov              |
// | is_fast_start       | fast_day_start                              |
// | is_fast_end         | fast_day_end                                |

// Service method - GENERIC, not zman-specific
func (s *UnifiedZmanimService) ShouldShowZman(z Zman, ctx EventContext) bool {
    for _, tag := range z.Tags {
        if tag.TagType != "behavior" {
            continue
        }

        // Check if this behavior's required events are active
        requiredEvents := s.behaviorTags[tag.TagKey]
        if !hasAnyActiveEvent(ctx.ActiveEventCodes, requiredEvents) {
            return false // Behavior requires events that aren't active
        }
    }

    // Check tag negation (existing logic)
    for _, tag := range z.Tags {
        if tag.IsNegated && hasMatchingEvent(ctx.ActiveEventCodes, tag.TagKey) {
            return false
        }
    }

    return true
}
```

---

## Implementation Tasks

### Phase 1: Create Unified Service Structure

#### Task 1.1: Create New Unified Service File

**File:** `api/internal/services/zmanim_service.go` (replace existing)

```go
// File: zmanim_service.go
// Purpose: THE single source of truth for ALL zmanim operations
// Pattern: unified-service
// Dependencies: dsl, cache, db/sqlcgen
// Frequency: critical - every zmanim endpoint uses this

package services

import (
    "context"
    "fmt"
    "sort"
    "time"

    "github.com/jcom-dev/zmanim/internal/cache"
    "github.com/jcom-dev/zmanim/internal/db"
    "github.com/jcom-dev/zmanim/internal/dsl"
)

// UnifiedZmanimService consolidates ALL zmanim operations
// This is THE SINGLE SOURCE OF TRUTH for:
// - Calculation (DSL execution)
// - Ordering (category-based sorting)
// - Linking (copy/link between publishers)
// - Filtering (tag-based event filtering)
// - Caching (per-publisher, per-locality)
type UnifiedZmanimService struct {
    db            *db.DB
    cache         *cache.Cache
    categoryOrder map[string]int        // Populated from time_categories.sort_order
    behaviorTags  map[string][]string   // Behavior tag -> required event codes
}

// NewUnifiedZmanimService creates the unified service
// Loads configuration from database at startup
func NewUnifiedZmanimService(ctx context.Context, db *db.DB, cache *cache.Cache) (*UnifiedZmanimService, error) {
    s := &UnifiedZmanimService{
        db:            db,
        cache:         cache,
        categoryOrder: make(map[string]int),
        behaviorTags:  make(map[string][]string),
    }

    // Load category order from time_categories table
    categories, err := db.Queries.GetAllTimeCategories(ctx)
    if err != nil {
        return nil, fmt.Errorf("failed to load time categories: %w", err)
    }
    for _, cat := range categories {
        s.categoryOrder[cat.Key] = int(cat.SortOrder)
    }
    s.categoryOrder["uncategorized"] = 99

    // Load behavior tag mappings from database
    // TODO: Add query to load behavior_tag_events table
    // For now, initialize with defaults (to be migrated to DB)
    s.behaviorTags = map[string][]string{
        "is_candle_lighting": {"erev_shabbos", "erev_yom_tov"},
        "is_havdalah":        {"motzei_shabbos", "motzei_yom_tov"},
        "is_fast_start":      {"fast_start"},
        "is_fast_end":        {"fast_end"},
    }

    return s, nil
}
```

**DoD:**
- [ ] New `UnifiedZmanimService` struct defined
- [ ] Constructor loads category order from DB
- [ ] Behavior tag mappings initialized (defaults, then DB migration)
- [ ] All methods from 3 other services merged in

#### Task 1.2: Merge Calculation Methods

Copy from `zmanim_calculation.go`:
- `CalculateZmanim()`
- `CalculateFormula()`
- `CalculateRange()`
- `ExecuteFormulasWithCoordinates()`
- `ApplyRounding()`
- Cache methods (`buildCacheKey`, `getCachedResult`, `setCachedResult`)
- `InvalidatePublisherCache()`, `InvalidateLocalityCache()`

**DoD:**
- [ ] All calculation methods in unified service
- [ ] No changes to method signatures
- [ ] All tests still pass

#### Task 1.3: Merge Ordering Methods

Copy from `zmanim_ordering.go`:
- `SortableZman` interface
- `GetCategoryOrder()`
- `SortZmanim()`

**DoD:**
- [ ] Ordering methods in unified service
- [ ] Uses `s.categoryOrder` map from struct
- [ ] All tests still pass

#### Task 1.4: Merge Linking Methods

Copy from `zmanim_linking_service.go`:
- `LinkOrCopyZmanRequest`, `LinkOrCopyZmanResult` structs
- `LinkOrCopyZman()`
- Error variables (`ErrSourceNotFound`, etc.)

**DoD:**
- [ ] Linking methods in unified service
- [ ] Provenance tracking preserved
- [ ] Transaction handling preserved
- [ ] All tests still pass

---

### Phase 2: Eliminate Hardcoded Zman Logic

#### Task 2.1: Create behavior_tag_events Database Table

**Migration:** `db/migrations/YYYYMMDDHHMMSS_add_behavior_tag_events.sql`

```sql
-- Behavior tag to event mapping
-- This replaces hardcoded ShowCandleLighting, ShowHavdalah, etc.
CREATE TABLE behavior_tag_events (
    id SERIAL PRIMARY KEY,
    behavior_tag_key VARCHAR(64) NOT NULL,   -- e.g., "is_candle_lighting"
    event_code VARCHAR(64) NOT NULL,         -- e.g., "erev_shabbos"
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique constraint
CREATE UNIQUE INDEX idx_behavior_tag_events_unique
ON behavior_tag_events(behavior_tag_key, event_code);

-- Seed data (replaces hardcoded logic)
INSERT INTO behavior_tag_events (behavior_tag_key, event_code) VALUES
    ('is_candle_lighting', 'erev_shabbos'),
    ('is_candle_lighting', 'erev_yom_tov'),
    ('is_candle_lighting_sheni', 'tzeis_before_yom_tov'),
    ('is_havdalah', 'motzei_shabbos'),
    ('is_havdalah', 'motzei_yom_tov'),
    ('is_fast_start', 'fast_start'),
    ('is_fast_end', 'fast_end'),
    ('is_fast_end', 'tisha_bav_end');

-- Comment explaining the pattern
COMMENT ON TABLE behavior_tag_events IS
'Maps behavior tags to event codes. Replaces hardcoded ShowCandleLighting, ShowHavdalah, etc.
When a zman has a behavior tag, it only shows if one of the mapped events is active.';
```

**DoD:**
- [ ] Migration creates table
- [ ] Seed data matches current hardcoded logic
- [ ] SQLc query added to load mappings

#### Task 2.2: Add SQLc Query for Behavior Tags

**File:** `api/internal/db/queries/zmanim.sql`

```sql
-- name: GetBehaviorTagEvents :many
-- Load behavior tag to event mappings for ShouldShowZman logic
SELECT behavior_tag_key, event_code
FROM behavior_tag_events
ORDER BY behavior_tag_key;
```

**DoD:**
- [ ] Query added
- [ ] `sqlc generate` succeeds
- [ ] Service loads from DB at startup

#### Task 2.3: Replace shouldShowZman with Tag-Based Logic

**File:** `api/internal/services/zmanim_service.go`

```go
// EventContext contains active events for a specific day
// This replaces DayContext.ShowCandleLighting, ShowHavdalah, etc.
type EventContext struct {
    Date             string
    ActiveEventCodes []string // From calendar service
}

// ShouldShowZman determines if a zman should be visible based on tags
// GENERIC - no hardcoded zman-specific logic
func (s *UnifiedZmanimService) ShouldShowZman(z ZmanWithTags, ctx EventContext) bool {
    // Check behavior tags
    for _, tag := range z.Tags {
        if tag.TagType != "behavior" {
            continue
        }

        // Get required events for this behavior tag
        requiredEvents, ok := s.behaviorTags[tag.TagKey]
        if !ok {
            continue // Unknown behavior tag, allow by default
        }

        // Check if any required event is active
        eventActive := false
        for _, requiredEvent := range requiredEvents {
            for _, activeEvent := range ctx.ActiveEventCodes {
                if requiredEvent == activeEvent {
                    eventActive = true
                    break
                }
            }
            if eventActive {
                break
            }
        }

        // If behavior tag present but no required event active, hide zman
        if !eventActive {
            return false
        }
    }

    // Check negation tags (existing logic)
    for _, tag := range z.Tags {
        if tag.IsNegated {
            for _, activeEvent := range ctx.ActiveEventCodes {
                if tag.TagKey == activeEvent || matchesEventPattern(tag.TagKey, activeEvent) {
                    return false
                }
            }
        }
    }

    return true
}
```

**File:** `api/internal/handlers/publisher_zmanim.go`

```go
// BEFORE - Lines 1071-1086 (HARDCODED):
isCandleLighting := hasTagKey(z.Tags, "is_candle_lighting")
isHavdalah := hasTagKey(z.Tags, "is_havdalah")
isFastStart := hasTagKey(z.Tags, "is_fast_start")
isFastEnd := hasTagKey(z.Tags, "is_fast_end")

if isCandleLighting && !dayCtx.ShowCandleLighting { return false }
if isHavdalah && !dayCtx.ShowHavdalah { return false }
// ...

// AFTER - GENERIC:
eventCtx := services.EventContext{
    Date:             dayCtx.Date,
    ActiveEventCodes: dayCtx.ActiveEventCodes,
}
return h.zmanimService.ShouldShowZman(z, eventCtx)
```

**DoD:**
- [ ] `ShouldShowZman` is generic (no zman-specific strings)
- [ ] Handler uses service method
- [ ] DayContext simplified (no ShowCandleLighting, etc.)
- [ ] Behavior filtering works correctly

#### Task 2.4: Replace Category Mapping with Tags

**File:** `api/internal/handlers/master_registry.go`

Replace hardcoded category mapping:

```go
// BEFORE - Lines 715-719 (HARDCODED):
case "category_candle_lighting":
    category = "candles"
case "category_havdalah":
    category = "havdalah"

// AFTER - TAG-DRIVEN:
// Categories come from the tag's tag_key directly
// Or from a new category_display_name column on zman_tags
for _, tag := range z.Tags {
    if tag.TagType == "category" {
        category = tag.DisplayCategory // New field
        break
    }
}
```

**Alternative:** Add `display_category` column to `zman_tags` table:

```sql
ALTER TABLE zman_tags ADD COLUMN display_category VARCHAR(64);

UPDATE zman_tags SET display_category = 'candles'
WHERE tag_key = 'category_candle_lighting';

UPDATE zman_tags SET display_category = 'havdalah'
WHERE tag_key = 'category_havdalah';

UPDATE zman_tags SET display_category = 'fast_day'
WHERE tag_key IN ('category_fast_start', 'category_fast_end');
```

**DoD:**
- [ ] No hardcoded category strings in Go code
- [ ] Category mapping comes from database
- [ ] GetEventZmanimGrouped works correctly

---

### Phase 3: Update Handlers

#### Task 3.1: Update handlers.go Service Wiring

**File:** `api/internal/handlers/handlers.go`

```go
// BEFORE:
type Handlers struct {
    zmanimService            *services.ZmanimService
    zmanimCalculationService *services.ZmanimCalculationService
    zmanimOrderingService    *services.ZmanimOrderingService
    zmanimLinkingService     *services.ZmanimLinkingService
}

// AFTER:
type Handlers struct {
    zmanimService *services.UnifiedZmanimService // THE ONLY zmanim service
}
```

**DoD:**
- [ ] Single `zmanimService` field
- [ ] All references updated
- [ ] Service initialized in NewHandlers()

#### Task 3.2: Update All Handler Calls

Search and replace across all handlers:

```bash
# Find all usages
rg "zmanimCalculationService|zmanimOrderingService|zmanimLinkingService" api/internal/handlers/
```

Update each call to use `h.zmanimService`:

```go
// BEFORE:
result, err := h.zmanimCalculationService.CalculateZmanim(ctx, params)
h.zmanimOrderingService.SortZmanim(zmanim)
result, err := h.zmanimLinkingService.LinkOrCopyZman(ctx, req)

// AFTER:
result, err := h.zmanimService.CalculateZmanim(ctx, params)
h.zmanimService.SortZmanim(zmanim)
result, err := h.zmanimService.LinkOrCopyZman(ctx, req)
```

**DoD:**
- [ ] All handlers use unified service
- [ ] No references to old services
- [ ] All tests pass

---

### Phase 4: Delete Old Service Files

#### Task 4.1: Delete Old Files

```bash
rm api/internal/services/zmanim_calculation.go
rm api/internal/services/zmanim_ordering.go
rm api/internal/services/zmanim_linking_service.go
```

**DoD:**
- [ ] Only `zmanim_service.go` remains
- [ ] Build succeeds
- [ ] All tests pass

#### Task 4.2: Update INDEX.md

**File:** `api/internal/services/INDEX.md`

```markdown
## Zmanim Services

### zmanim_service.go
THE single source of truth for ALL zmanim operations:
- Calculation (DSL execution, caching)
- Ordering (category-based sorting)
- Linking (copy/link between publishers)
- Filtering (tag-based event filtering)
- Rounding (floor/math/ceil)

**DELETED FILES (merged into zmanim_service.go):**
- ~zmanim_calculation.go~
- ~zmanim_ordering.go~
- ~zmanim_linking_service.go~
```

---

### Phase 5: Testing & Verification

#### Task 5.1: Create Verification Script

**File:** `scripts/verify-unified-zmanim-service.sh`

```bash
#!/bin/bash
# Verify unified zmanim service consolidation

echo "=== VERIFICATION: Unified Zmanim Service ==="
echo ""

PASS=0
FAIL=0

# Test 1: Only one zmanim service file
echo "Test 1: Single zmanim service file..."
COUNT=$(ls api/internal/services/zmanim*.go 2>/dev/null | wc -l)
if [ "$COUNT" -eq 1 ]; then
  echo "  ✅ PASS: Only zmanim_service.go exists"
  ((PASS++))
else
  echo "  ❌ FAIL: Found $COUNT zmanim service files"
  ls api/internal/services/zmanim*.go
  ((FAIL++))
fi

# Test 2: No hardcoded candle_lighting checks
echo "Test 2: No hardcoded candle lighting checks..."
RESULT=$(rg "isCandleLighting|ShowCandleLighting" api/internal/handlers/*.go api/internal/services/*.go 2>/dev/null | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: No hardcoded candle lighting"
  ((PASS++))
else
  echo "  ❌ FAIL: Found hardcoded candle lighting:"
  rg "isCandleLighting|ShowCandleLighting" api/internal/handlers/*.go api/internal/services/*.go
  ((FAIL++))
fi

# Test 3: No hardcoded havdalah checks
echo "Test 3: No hardcoded havdalah checks..."
RESULT=$(rg "isHavdalah|ShowHavdalah" api/internal/handlers/*.go api/internal/services/*.go 2>/dev/null | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: No hardcoded havdalah"
  ((PASS++))
else
  echo "  ❌ FAIL: Found hardcoded havdalah:"
  rg "isHavdalah|ShowHavdalah" api/internal/handlers/*.go api/internal/services/*.go
  ((FAIL++))
fi

# Test 4: No hardcoded fast day checks
echo "Test 4: No hardcoded fast day checks..."
RESULT=$(rg "isFastStart|isFastEnd|ShowFastStart|ShowFastEnd" api/internal/handlers/*.go api/internal/services/*.go 2>/dev/null | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: No hardcoded fast day logic"
  ((PASS++))
else
  echo "  ❌ FAIL: Found hardcoded fast day logic:"
  rg "isFastStart|isFastEnd|ShowFastStart|ShowFastEnd" api/internal/handlers/*.go api/internal/services/*.go
  ((FAIL++))
fi

# Test 5: No references to old services
echo "Test 5: No references to deleted services..."
RESULT=$(rg "ZmanimCalculationService|ZmanimOrderingService|ZmanimLinkingService" api/internal/ 2>/dev/null | grep -v "_test.go" | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: No references to old services"
  ((PASS++))
else
  echo "  ❌ FAIL: Found references to old services:"
  rg "ZmanimCalculationService|ZmanimOrderingService|ZmanimLinkingService" api/internal/
  ((FAIL++))
fi

# Test 6: No hardcoded category mapping
echo "Test 6: No hardcoded category mapping..."
RESULT=$(rg '"candles"|"category_candle_lighting"' api/internal/handlers/*.go 2>/dev/null | grep -v "test" | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: No hardcoded category mapping"
  ((PASS++))
else
  echo "  ⚠️  WARNING: May have hardcoded categories"
  ((FAIL++))
fi

# Test 7: Build succeeds
echo "Test 7: Go build succeeds..."
cd api && go build ./cmd/api 2>/dev/null
if [ $? -eq 0 ]; then
  echo "  ✅ PASS: Build succeeds"
  ((PASS++))
else
  echo "  ❌ FAIL: Build failed"
  ((FAIL++))
fi

# Test 8: Tests pass
echo "Test 8: Go tests pass..."
cd api && go test ./internal/services/... 2>/dev/null
if [ $? -eq 0 ]; then
  echo "  ✅ PASS: Tests pass"
  ((PASS++))
else
  echo "  ❌ FAIL: Tests failed"
  ((FAIL++))
fi

echo ""
echo "=== RESULTS: $PASS passed, $FAIL failed ==="

if [ "$FAIL" -eq 0 ]; then
  echo "✅ ALL VERIFICATION TESTS PASSED"
  exit 0
else
  echo "❌ SOME TESTS FAILED - Review and fix"
  exit 1
fi
```

**DoD:**
- [ ] Script created and executable
- [ ] All 8 tests pass
- [ ] CI integration (optional)

---

## Files to Create/Modify/Delete

### Create

| File | Purpose |
|------|---------|
| `db/migrations/YYYYMMDDHHMMSS_add_behavior_tag_events.sql` | Behavior tag to event mapping |
| `scripts/verify-unified-zmanim-service.sh` | Verification script |

### Modify

| File | Changes |
|------|---------|
| `api/internal/services/zmanim_service.go` | Complete rewrite with all merged logic |
| `api/internal/handlers/handlers.go` | Single zmanimService field |
| `api/internal/handlers/publisher_zmanim.go` | Use unified service, remove hardcoded logic |
| `api/internal/handlers/master_registry.go` | Remove hardcoded category mapping |
| `api/internal/handlers/zmanim.go` | Use unified service |
| `api/internal/handlers/dsl.go` | Use unified service |
| `api/internal/handlers/external_api.go` | Use unified service |
| `api/internal/db/queries/zmanim.sql` | Add GetBehaviorTagEvents query |

### Delete

| File | Reason |
|------|--------|
| `api/internal/services/zmanim_calculation.go` | Merged into zmanim_service.go |
| `api/internal/services/zmanim_ordering.go` | Merged into zmanim_service.go |
| `api/internal/services/zmanim_linking_service.go` | Merged into zmanim_service.go |

---

## Definition of Done

### Code Consolidation
- [ ] Only `zmanim_service.go` exists in services directory (for zmanim)
- [ ] All calculation, ordering, linking methods in one file
- [ ] Single `UnifiedZmanimService` struct
- [ ] File is < 800 lines (manageable single file)

### Zero Hardcoded Logic
- [ ] No `isCandleLighting`, `isHavdalah`, `isFastStart`, `isFastEnd` strings
- [ ] No `ShowCandleLighting`, `ShowHavdalah`, etc. boolean fields
- [ ] No hardcoded category mapping (candles, havdalah, etc.)
- [ ] All behavior filtering driven by database tags

### Database-Driven Behavior
- [ ] `behavior_tag_events` table exists with mappings
- [ ] Service loads mappings at startup
- [ ] Adding new behavior = database insert only (no code change)

### Tests & Build
- [ ] `go build ./cmd/api` succeeds
- [ ] `go test ./internal/services/...` passes
- [ ] Verification script passes all checks
- [ ] E2E tests pass

---

## Appendix: Current vs Target Architecture

### Current (Fragmented)

```
api/internal/services/
├── zmanim_service.go           # Legacy, mostly disabled
├── zmanim_calculation.go       # DSL execution, caching
├── zmanim_ordering.go          # Category sorting
└── zmanim_linking_service.go   # Copy/link operations

api/internal/handlers/
├── publisher_zmanim.go         # Contains shouldShowZman with hardcoded logic
└── master_registry.go          # Contains hardcoded category mapping
```

### Target (Unified)

```
api/internal/services/
└── zmanim_service.go           # EVERYTHING - calc, order, link, filter

api/internal/handlers/
├── publisher_zmanim.go         # Calls zmanimService.ShouldShowZman (generic)
└── master_registry.go          # Uses tag.DisplayCategory from DB

db/
└── behavior_tag_events         # Maps behavior tags to event codes
```

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing filtering | Medium | High | Comprehensive E2E tests before/after |
| Missing behavior mappings | Low | High | Seed data matches current logic exactly |
| Service file too large | Low | Medium | Well-organized sections, ~700 lines is fine |
| Handler update missed | Medium | Medium | Verification script catches this |

---

## Success Metrics

1. **File count:** 1 zmanim service file (down from 4)
2. **Hardcoded strings:** 0 zman-specific strings in handlers/services
3. **Behavior extensibility:** Add new event type = 1 DB insert
4. **Build time:** No change (fewer files might improve)
5. **Test coverage:** Maintain or improve current coverage

---

## Phase 6: Comprehensive API & Client Testing

### CRITICAL: Every API Must Return Valid Zmanim

This section defines the **complete test matrix** for all zmanim-consuming endpoints and frontend clients. Every single API must be tested to ensure it returns valid zmanim after the consolidation.

---

### 6.1 Complete API Inventory

#### Public Zmanim APIs (No Auth Required)

| Endpoint | Method | Handler | Purpose | Test Priority |
|----------|--------|---------|---------|---------------|
| `/api/v1/zmanim` | GET | `GetZmanimForLocality` | Public zmanim by locality | CRITICAL |
| `/api/v1/zmanim` | POST | `CalculateZmanimByCoordinates` | Legacy coordinate-based | HIGH |

#### Publisher APIs (JWT + X-Publisher-Id Required)

| Endpoint | Method | Handler | Purpose | Test Priority |
|----------|--------|---------|---------|---------------|
| `/api/v1/publisher/zmanim` | GET | `GetPublisherZmanim` | List publisher's zmanim | CRITICAL |
| `/api/v1/publisher/zmanim` | POST | `CreatePublisherZman` | Create new zman | HIGH |
| `/api/v1/publisher/zmanim/{zmanKey}` | GET | `GetPublisherZmanByKey` | Get single zman | HIGH |
| `/api/v1/publisher/zmanim/{zmanKey}` | PUT | `UpdatePublisherZman` | Update zman formula/config | CRITICAL |
| `/api/v1/publisher/zmanim/{zmanKey}` | DELETE | `SoftDeletePublisherZman` | Soft delete | MEDIUM |
| `/api/v1/publisher/zmanim/week` | GET | `GetPublisherZmanimWeek` | Week batch calculation | CRITICAL |
| `/api/v1/publisher/zmanim/year` | GET | `GetPublisherZmanimYear` | Year calculation | HIGH |
| `/api/v1/publisher/zmanim/deleted` | GET | `GetDeletedPublisherZmanim` | List soft-deleted | LOW |
| `/api/v1/publisher/zmanim/{zmanKey}/restore` | POST | `RestorePublisherZman` | Restore deleted | LOW |
| `/api/v1/publisher/zmanim/{zmanKey}/permanent` | DELETE | `PermanentDeletePublisherZman` | Hard delete | LOW |
| `/api/v1/publisher/zmanim/{zmanKey}/history` | GET | `GetZmanVersionHistory` | Version history | MEDIUM |
| `/api/v1/publisher/zmanim/{zmanKey}/history/{version}` | GET | `GetZmanVersion` | Specific version | MEDIUM |
| `/api/v1/publisher/zmanim/{zmanKey}/rollback` | POST | `RollbackZmanVersion` | Rollback to version | MEDIUM |
| `/api/v1/publisher/zmanim/{zmanKey}/tags` | GET | `GetPublisherZmanTags` | Get zman tags | HIGH |
| `/api/v1/publisher/zmanim/{zmanKey}/tags` | PUT | `UpdatePublisherZmanTags` | Update tags | HIGH |
| `/api/v1/publisher/zmanim/{zmanKey}/tags/revert` | POST | `RevertPublisherZmanTags` | Revert to master | MEDIUM |
| `/api/v1/publisher/zmanim/{zmanKey}/alias` | GET/PUT/DELETE | Alias handlers | Alias management | LOW |
| `/api/v1/publisher/zmanim/aliases` | GET | `ListAliases` | List all aliases | LOW |
| `/api/v1/publisher/zmanim/from-publisher` | POST | `CreateZmanFromPublisher` | Link/copy from publisher | HIGH |

#### DSL APIs (Preview & Validation)

| Endpoint | Method | Handler | Purpose | Test Priority |
|----------|--------|---------|---------|---------------|
| `/api/v1/dsl/validate` | POST | `ValidateDSLFormula` | Validate formula syntax | HIGH |
| `/api/v1/dsl/preview` | POST | `PreviewDSLFormula` | Calculate single formula | CRITICAL |
| `/api/v1/dsl/preview-week` | POST | `PreviewDSLFormulaWeek` | 7-day preview | HIGH |

#### External M2M APIs (API Key Required)

| Endpoint | Method | Handler | Purpose | Test Priority |
|----------|--------|---------|---------|---------------|
| `/api/v1/external/publishers/{id}/zmanim` | GET | `GetExternalPublisherZmanim` | List zmanim for external | CRITICAL |
| `/api/v1/external/zmanim/calculate` | POST | `CalculateExternalBulkZmanim` | Bulk calculation | CRITICAL |

#### Registry APIs (Public Read, Admin Write)

| Endpoint | Method | Handler | Purpose | Test Priority |
|----------|--------|---------|---------|---------------|
| `/api/v1/registry/zmanim` | GET | `GetMasterZmanim` | List master registry | HIGH |
| `/api/v1/registry/zmanim/grouped` | GET | `GetMasterZmanimGrouped` | Grouped by category | MEDIUM |
| `/api/v1/registry/zmanim/events` | GET | `GetEventZmanimGrouped` | Event zmanim | HIGH |
| `/api/v1/registry/zmanim/{zmanKey}` | GET | `GetMasterZmanByKey` | Single master zman | MEDIUM |
| `/api/v1/registry/zmanim/validate-key` | GET | `ValidateZmanKey` | Check key availability | LOW |

---

### 6.2 Frontend Client Inventory

#### Algorithm Page (Most Complex Consumer)

**File:** `web/app/publisher/algorithm/page.tsx`

**APIs Used:**
- `GET /api/v1/publisher/zmanim` - Load publisher's zmanim
- `POST /api/v1/dsl/preview` - Real-time formula preview
- `PUT /api/v1/publisher/zmanim/{key}` - Save formula changes
- `GET /api/v1/publisher/zmanim/week` - Week preview modal

**Test Cases:**
| Test | Expected Result | Priority |
|------|-----------------|----------|
| Load page with valid publisher | All zmanim display with times | CRITICAL |
| Change preview location | Times recalculate correctly | CRITICAL |
| Toggle showSeconds | Display switches exact/rounded | HIGH |
| Click rounding button | Time updates, order stable | HIGH |
| Edit formula and save | Formula saves, preview updates | CRITICAL |
| Open week preview modal | 7 days of times display | HIGH |
| Filter by event/everyday | Correct zmanim filter | MEDIUM |
| Search zmanim | Matches filter correctly | LOW |

#### Public Zmanim Page

**File:** `web/app/zmanim/[localityId]/[publisherId]/page.tsx`

**APIs Used:**
- `GET /api/v1/zmanim` - Public zmanim calculation

**Test Cases:**
| Test | Expected Result | Priority |
|------|-----------------|----------|
| Load page with valid locality | All published zmanim display | CRITICAL |
| Different dates | Times vary appropriately | HIGH |
| Event days (Shabbos, Yom Tov) | Event zmanim appear | CRITICAL |
| Regular weekday | No event zmanim | HIGH |

#### Week/Month Preview Components

**Files:**
- `web/components/publisher/WeekPreview.tsx`
- `web/components/publisher/MonthPreview.tsx`

**APIs Used:**
- `GET /api/v1/publisher/zmanim/week`
- Multiple date calculations

**Test Cases:**
| Test | Expected Result | Priority |
|------|-----------------|----------|
| Open week preview | 7 days of times | HIGH |
| Different locations | Times vary by location | HIGH |
| Times ordering | Chronological within day | MEDIUM |

#### Formula Builder Preview

**File:** `web/components/formula-builder/preview/CalculationPreview.tsx`

**APIs Used:**
- `POST /api/v1/dsl/preview`

**Test Cases:**
| Test | Expected Result | Priority |
|------|-----------------|----------|
| Enter valid formula | Time displays | CRITICAL |
| Enter invalid formula | Error message | HIGH |
| Reference other zmanim | Dependencies resolve | HIGH |

---

### 6.3 Test Data Requirements

#### Required Test Localities

```sql
-- Test localities covering different scenarios
SELECT id, name, latitude, longitude, timezone FROM geo_localities
WHERE id IN (
  4993250,  -- Ann Arbor, MI (USA - common test)
  5128581,  -- New York City (major city)
  2643743,  -- London, UK (different timezone)
  281184,   -- Jerusalem (Israel - primary use case)
  745044    -- Istanbul (edge case timezone)
);
```

#### Required Test Dates

| Date | Scenario | Event Context |
|------|----------|---------------|
| 2025-01-03 | Regular Friday | Erev Shabbos - candle lighting |
| 2025-01-04 | Saturday | Shabbos - havdalah |
| 2025-01-05 | Regular Sunday | No events |
| 2025-03-14 | Fast of Esther | Fast day - start/end |
| 2025-04-12 | Erev Pesach | Yom Tov eve |
| 2025-04-13 | Pesach Day 1 | Yom Tov |
| 2025-08-03 | Tisha B'Av | Unique fast timing |

#### Required Test Publishers

| Publisher ID | Name | Status | Purpose |
|--------------|------|--------|---------|
| 1 | Admin Test Publisher | Active | Full zmanim set |
| 2 | Verified Publisher | Verified | Linking source |
| 3 | Unverified Publisher | Active | Cannot be linked from |

---

### 6.4 API Test Scripts

#### Task 6.4.1: Create API Test Suite

**File:** `scripts/test-all-zmanim-apis.sh`

```bash
#!/bin/bash
# Comprehensive API test for zmanim consolidation
# Run BEFORE and AFTER consolidation to compare results

set -e

API_BASE="http://localhost:8080/api/v1"
PUBLISHER_ID=2
LOCALITY_ID=4993250
DATE="2025-01-03"  # Friday (Erev Shabbos)

# Get auth token
source api/.env
TOKEN=$(node scripts/get-test-token.js 2>/dev/null | tail -1)

echo "=== ZMANIM API TEST SUITE ==="
echo "Date: $DATE"
echo "Locality: $LOCALITY_ID"
echo "Publisher: $PUBLISHER_ID"
echo ""

PASS=0
FAIL=0
RESULTS_FILE="/tmp/zmanim-api-test-results-$(date +%s).json"
echo "[]" > $RESULTS_FILE

# Helper function to test an endpoint
test_endpoint() {
  local name="$1"
  local method="$2"
  local url="$3"
  local body="$4"
  local auth="$5"

  echo -n "Testing $name... "

  # Build curl command
  if [ "$auth" == "publisher" ]; then
    AUTH_HEADERS="-H 'Authorization: Bearer $TOKEN' -H 'X-Publisher-Id: $PUBLISHER_ID'"
  elif [ "$auth" == "admin" ]; then
    AUTH_HEADERS="-H 'Authorization: Bearer $TOKEN'"
  else
    AUTH_HEADERS=""
  fi

  if [ "$method" == "POST" ] && [ -n "$body" ]; then
    RESPONSE=$(eval curl -s -X POST "$url" $AUTH_HEADERS -H 'Content-Type: application/json' -d "'$body'" 2>/dev/null)
  else
    RESPONSE=$(eval curl -s -X $method "$url" $AUTH_HEADERS 2>/dev/null)
  fi

  # Check for valid response
  if echo "$RESPONSE" | jq -e '.zmanim' > /dev/null 2>&1; then
    ZMANIM_COUNT=$(echo "$RESPONSE" | jq '.zmanim | length')
    echo "✅ PASS ($ZMANIM_COUNT zmanim)"
    ((PASS++))

    # Save result for comparison
    echo "$RESPONSE" | jq "{name: \"$name\", zmanim_count: $ZMANIM_COUNT, first_zman: .zmanim[0]}" >> $RESULTS_FILE
  elif echo "$RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
    DATA_COUNT=$(echo "$RESPONSE" | jq '.data | length')
    echo "✅ PASS ($DATA_COUNT items)"
    ((PASS++))
  elif echo "$RESPONSE" | jq -e '.time' > /dev/null 2>&1; then
    TIME=$(echo "$RESPONSE" | jq -r '.time')
    echo "✅ PASS (time: $TIME)"
    ((PASS++))
  elif echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    echo "❌ FAIL (error: $ERROR)"
    ((FAIL++))
  else
    echo "⚠️  UNKNOWN RESPONSE"
    echo "$RESPONSE" | head -c 200
    ((FAIL++))
  fi
}

# === PUBLIC APIS ===
echo ""
echo "=== PUBLIC APIS ==="

test_endpoint "GET /zmanim (public)" \
  "GET" \
  "$API_BASE/zmanim?locality_id=$LOCALITY_ID&publisher_id=$PUBLISHER_ID&date=$DATE" \
  "" \
  "none"

# === PUBLISHER APIS ===
echo ""
echo "=== PUBLISHER APIS ==="

test_endpoint "GET /publisher/zmanim (list)" \
  "GET" \
  "$API_BASE/publisher/zmanim?locality_id=$LOCALITY_ID&date=$DATE" \
  "" \
  "publisher"

test_endpoint "GET /publisher/zmanim/week" \
  "GET" \
  "$API_BASE/publisher/zmanim/week?start_date=$DATE&locality_id=$LOCALITY_ID" \
  "" \
  "publisher"

test_endpoint "GET /publisher/zmanim/{key}" \
  "GET" \
  "$API_BASE/publisher/zmanim/alos_hashachar" \
  "" \
  "publisher"

# === DSL APIS ===
echo ""
echo "=== DSL APIS ==="

test_endpoint "POST /dsl/validate" \
  "POST" \
  "$API_BASE/dsl/validate" \
  '{"formula": "sunrise + 30min"}' \
  "publisher"

test_endpoint "POST /dsl/preview" \
  "POST" \
  "$API_BASE/dsl/preview" \
  "{\"formula\": \"sunrise\", \"date\": \"$DATE\", \"latitude\": 42.28, \"longitude\": -83.74, \"timezone\": \"America/Detroit\"}" \
  "publisher"

test_endpoint "POST /dsl/preview-week" \
  "POST" \
  "$API_BASE/dsl/preview-week" \
  "{\"formula\": \"sunrise\", \"start_date\": \"$DATE\", \"latitude\": 42.28, \"longitude\": -83.74, \"timezone\": \"America/Detroit\"}" \
  "publisher"

# === REGISTRY APIS ===
echo ""
echo "=== REGISTRY APIS ==="

test_endpoint "GET /registry/zmanim" \
  "GET" \
  "$API_BASE/registry/zmanim" \
  "" \
  "none"

test_endpoint "GET /registry/zmanim/grouped" \
  "GET" \
  "$API_BASE/registry/zmanim/grouped" \
  "" \
  "none"

test_endpoint "GET /registry/zmanim/events" \
  "GET" \
  "$API_BASE/registry/zmanim/events" \
  "" \
  "none"

# === EVENT DAY TESTS ===
echo ""
echo "=== EVENT DAY SPECIFIC TESTS ==="

# Friday - should have candle lighting
test_endpoint "Friday (candle lighting)" \
  "GET" \
  "$API_BASE/publisher/zmanim?locality_id=$LOCALITY_ID&date=2025-01-03" \
  "" \
  "publisher"

# Saturday - should have havdalah
test_endpoint "Saturday (havdalah)" \
  "GET" \
  "$API_BASE/publisher/zmanim?locality_id=$LOCALITY_ID&date=2025-01-04" \
  "" \
  "publisher"

# Regular weekday - no event zmanim
test_endpoint "Sunday (no events)" \
  "GET" \
  "$API_BASE/publisher/zmanim?locality_id=$LOCALITY_ID&date=2025-01-05" \
  "" \
  "publisher"

# === RESULTS ===
echo ""
echo "=== RESULTS ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo "Results saved to: $RESULTS_FILE"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "❌ SOME TESTS FAILED"
  exit 1
else
  echo ""
  echo "✅ ALL TESTS PASSED"
  exit 0
fi
```

#### Task 6.4.2: Create Before/After Comparison Script

**File:** `scripts/compare-zmanim-outputs.sh`

```bash
#!/bin/bash
# Compare zmanim outputs before and after consolidation

BEFORE_FILE="$1"
AFTER_FILE="$2"

if [ -z "$BEFORE_FILE" ] || [ -z "$AFTER_FILE" ]; then
  echo "Usage: $0 <before.json> <after.json>"
  exit 1
fi

echo "=== COMPARING ZMANIM OUTPUTS ==="
echo "Before: $BEFORE_FILE"
echo "After: $AFTER_FILE"
echo ""

# Compare zmanim counts
echo "=== ZMANIM COUNT COMPARISON ==="
BEFORE_COUNT=$(jq '[.[].zmanim_count] | add' $BEFORE_FILE)
AFTER_COUNT=$(jq '[.[].zmanim_count] | add' $AFTER_FILE)

echo "Before total: $BEFORE_COUNT"
echo "After total: $AFTER_COUNT"

if [ "$BEFORE_COUNT" == "$AFTER_COUNT" ]; then
  echo "✅ Counts match"
else
  echo "⚠️  Counts differ!"
fi

# Compare specific zman times
echo ""
echo "=== TIME COMPARISON (sunrise) ==="
BEFORE_SUNRISE=$(jq -r '.[0].first_zman | select(.key == "sunrise") | .time' $BEFORE_FILE 2>/dev/null)
AFTER_SUNRISE=$(jq -r '.[0].first_zman | select(.key == "sunrise") | .time' $AFTER_FILE 2>/dev/null)

echo "Before: $BEFORE_SUNRISE"
echo "After: $AFTER_SUNRISE"

if [ "$BEFORE_SUNRISE" == "$AFTER_SUNRISE" ]; then
  echo "✅ Times match"
else
  echo "⚠️  Times differ!"
fi

# Detailed diff
echo ""
echo "=== DETAILED DIFF ==="
diff <(jq -S . $BEFORE_FILE) <(jq -S . $AFTER_FILE) || echo "(Files differ)"
```

---

### 6.5 E2E Test Suite Updates

#### Task 6.5.1: Update E2E Tests

**File:** `tests/e2e/zmanim-consolidation.spec.ts` (NEW)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Zmanim Consolidation Validation', () => {

  test.describe('Algorithm Page', () => {
    test('loads and displays zmanim correctly', async ({ page }) => {
      await page.goto('/publisher/algorithm');

      // Wait for zmanim to load
      await expect(page.locator('[data-testid="zman-card"]').first()).toBeVisible();

      // Verify times are displayed (not N/A)
      const firstTime = await page.locator('[data-testid="zman-time"]').first().textContent();
      expect(firstTime).not.toBe('N/A');
      expect(firstTime).toMatch(/\d{1,2}:\d{2}/); // HH:MM format
    });

    test('preview updates when location changes', async ({ page }) => {
      await page.goto('/publisher/algorithm');

      // Get initial time
      const initialTime = await page.locator('[data-testid="zman-time"]').first().textContent();

      // Change location
      await page.locator('[data-testid="location-select"]').click();
      await page.locator('[data-testid="location-option-london"]').click();

      // Wait for update
      await page.waitForTimeout(1000);

      // Verify time changed
      const newTime = await page.locator('[data-testid="zman-time"]').first().textContent();
      expect(newTime).not.toBe(initialTime);
    });

    test('rounding buttons work without reordering', async ({ page }) => {
      await page.goto('/publisher/algorithm');

      // Get initial order
      const initialOrder = await page.locator('[data-testid="zman-key"]').allTextContents();

      // Click rounding button
      await page.locator('[data-testid="rounding-button"]').first().click();
      await page.waitForTimeout(500);

      // Verify order unchanged
      const newOrder = await page.locator('[data-testid="zman-key"]').allTextContents();
      expect(newOrder).toEqual(initialOrder);
    });

    test('event zmanim appear on Shabbos', async ({ page }) => {
      // Navigate to algorithm page with Saturday date
      await page.goto('/publisher/algorithm?date=2025-01-04');

      // Wait for load
      await page.waitForTimeout(1000);

      // Check for havdalah (should appear on Saturday)
      const hasHavdalah = await page.locator('[data-testid="zman-key"]:has-text("havdalah")').count();
      expect(hasHavdalah).toBeGreaterThan(0);
    });

    test('event zmanim hidden on weekday', async ({ page }) => {
      // Navigate with Sunday date
      await page.goto('/publisher/algorithm?date=2025-01-05');

      await page.waitForTimeout(1000);

      // Havdalah should NOT appear on Sunday
      const hasHavdalah = await page.locator('[data-testid="zman-key"]:has-text("havdalah")').count();
      expect(hasHavdalah).toBe(0);
    });
  });

  test.describe('Public Zmanim Page', () => {
    test('displays zmanim for locality', async ({ page }) => {
      await page.goto('/zmanim/4993250/2'); // Ann Arbor, Publisher 2

      // Should show zmanim
      await expect(page.locator('.zman-row').first()).toBeVisible();

      // All times should be valid
      const times = await page.locator('.zman-time').allTextContents();
      for (const time of times) {
        expect(time).toMatch(/\d{1,2}:\d{2}/);
      }
    });
  });

  test.describe('Week Preview', () => {
    test('shows 7 days of times', async ({ page }) => {
      await page.goto('/publisher/algorithm');

      // Open week preview
      await page.locator('[data-testid="week-preview-button"]').click();

      // Should show 7 days
      await expect(page.locator('[data-testid="week-day"]')).toHaveCount(7);

      // Each day should have times
      const dayTimes = await page.locator('[data-testid="week-day-time"]').allTextContents();
      expect(dayTimes.length).toBeGreaterThan(0);

      for (const time of dayTimes) {
        if (time !== '-') { // Some days may not have all zmanim
          expect(time).toMatch(/\d{1,2}:\d{2}/);
        }
      }
    });
  });

  test.describe('DSL Preview', () => {
    test('calculates formula correctly', async ({ page }) => {
      await page.goto('/publisher/algorithm/edit/alos_hashachar');

      // Enter formula
      await page.locator('[data-testid="formula-input"]').fill('sunrise - 72min');

      // Wait for preview
      await page.waitForTimeout(500);

      // Should show calculated time
      const preview = await page.locator('[data-testid="formula-preview-time"]').textContent();
      expect(preview).toMatch(/\d{1,2}:\d{2}/);
    });
  });
});
```

---

### 6.6 Regression Test Checklist

#### Pre-Consolidation Snapshot

Before starting consolidation, run these commands and save outputs:

```bash
# 1. Capture API responses
./scripts/test-all-zmanim-apis.sh > /tmp/before-consolidation.log 2>&1

# 2. Capture specific zmanim calculations for comparison
curl -s "http://localhost:8080/api/v1/zmanim?locality_id=4993250&publisher_id=2&date=2025-01-03" \
  | jq '.zmanim | sort_by(.key)' > /tmp/before-zmanim-friday.json

curl -s "http://localhost:8080/api/v1/zmanim?locality_id=4993250&publisher_id=2&date=2025-01-04" \
  | jq '.zmanim | sort_by(.key)' > /tmp/before-zmanim-saturday.json

# 3. Capture event filtering behavior
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-01-03" \
  -H "Authorization: Bearer $TOKEN" -H "X-Publisher-Id: 2" \
  | jq '[.zmanim[].zman_key] | sort' > /tmp/before-friday-keys.json

curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-01-04" \
  -H "Authorization: Bearer $TOKEN" -H "X-Publisher-Id: 2" \
  | jq '[.zmanim[].zman_key] | sort' > /tmp/before-saturday-keys.json
```

#### Post-Consolidation Validation

After consolidation, run the same commands and compare:

```bash
# 1. Run test suite again
./scripts/test-all-zmanim-apis.sh > /tmp/after-consolidation.log 2>&1

# 2. Compare outputs
diff /tmp/before-zmanim-friday.json /tmp/after-zmanim-friday.json
diff /tmp/before-zmanim-saturday.json /tmp/after-zmanim-saturday.json
diff /tmp/before-friday-keys.json /tmp/after-friday-keys.json
diff /tmp/before-saturday-keys.json /tmp/after-saturday-keys.json

# 3. Verify no regressions
if [ -z "$(diff /tmp/before-zmanim-friday.json /tmp/after-zmanim-friday.json)" ]; then
  echo "✅ Friday zmanim match"
else
  echo "❌ Friday zmanim differ!"
fi
```

---

### 6.7 Test DoD (Definition of Done)

#### API Tests
- [ ] All 25+ API endpoints return valid responses
- [ ] Public zmanim endpoint returns times for all localities
- [ ] Publisher zmanim endpoint returns filtered results
- [ ] Week/year endpoints return multi-day results
- [ ] DSL preview calculates formulas correctly
- [ ] External M2M API returns expected format

#### Event Filtering Tests
- [ ] Friday returns candle lighting zmanim
- [ ] Saturday returns havdalah zmanim
- [ ] Weekdays do NOT return event zmanim
- [ ] Fast days return fast start/end zmanim
- [ ] Yom Tov returns appropriate event zmanim

#### Time Calculation Tests
- [ ] Sunrise times are accurate (within 1 minute of reference)
- [ ] Sunset times are accurate (within 1 minute of reference)
- [ ] Rounding modes (floor/math/ceil) work correctly
- [ ] Different locations produce different times
- [ ] Different dates produce different times

#### Frontend Tests
- [ ] Algorithm page loads and displays zmanim
- [ ] Location change updates times
- [ ] Date change updates times
- [ ] Rounding button works without reorder
- [ ] Week preview shows 7 days
- [ ] Formula editor preview works

#### Comparison Tests
- [ ] Before/after zmanim counts match
- [ ] Before/after zmanim times match (within 1 second)
- [ ] Before/after event filtering matches
- [ ] No new N/A or null values appear

---

## Phase 7: Technical Debt Removal & Complete Consolidation

### GOAL: One File to Rule Them All

After this phase, the ONLY zmanim-related service file will be:

```
api/internal/services/zmanim_service.go  (~700 lines)
```

**Everything else gets DELETED or MERGED.**

---

### 7.1 Complete File Inventory to Remove

#### Zmanim Service Files (DELETE ALL EXCEPT zmanim_service.go)

| File | Lines | Current Purpose | Action |
|------|-------|-----------------|--------|
| `zmanim_service.go` | 170 | Legacy (mostly disabled) | **REWRITE** - becomes unified service |
| `zmanim_calculation.go` | 486 | DSL execution, caching | **DELETE** - merge into zmanim_service.go |
| `zmanim_ordering.go` | 89 | Category sorting | **DELETE** - merge into zmanim_service.go |
| `zmanim_linking_service.go` | 244 | Copy/link operations | **DELETE** - merge into zmanim_service.go |

**Total lines being consolidated: 989 → ~700**

#### Timezone Service (MERGE INTO zmanim_service.go)

| File | Lines | Current Purpose | Action |
|------|-------|-----------------|--------|
| `timezone_service.go` | ~100 | Timezone lookup | **DELETE** - inline into zmanim_service.go |

The `TimezoneService` is only used for coordinate-to-timezone lookup. This can be a private function inside the unified service:

```go
// BEFORE (separate service):
type TimezoneService struct { ... }
func (s *TimezoneService) GetTimezoneForCoordinates(lat, lon float64) string

// AFTER (internal function):
func (s *UnifiedZmanimService) getTimezoneForCoordinates(lat, lon float64) string
```

#### Algorithm Package (EVALUATE FOR REMOVAL)

| File | Lines | Current Purpose | Action |
|------|-------|-----------------|--------|
| `internal/algorithm/*.go` | ~800 | Legacy algorithm execution | **DEPRECATE** - DSL replaces this |

**Note:** The `algorithm` package was the OLD way of calculating zmanim before DSL. If it's still used anywhere:
1. Find all usages
2. Migrate to DSL
3. Delete the package

```bash
# Check if algorithm package is still used
rg "internal/algorithm" api/ --type go
```

---

### 7.2 Handler Sorting Files (DELETE)

| File | Lines | Current Purpose | Action |
|------|-------|-----------------|--------|
| `zmanim_sort.go` | 114 | Handler-level sorting | **DELETE** - use service sorting |
| `zmanim_sort_test.go` | ~50 | Sort tests | **DELETE** - move tests to service |

The sorting logic should ONLY exist in `zmanim_service.go`. Handlers call `s.SortZmanim()`.

---

### 7.3 Migration Tasks

#### Task 7.3.1: Merge TimezoneService

```go
// Add to zmanim_service.go:

// getTimezoneForCoordinates returns the IANA timezone for a lat/lon
// Uses geo_localities lookup or Google Timezone API fallback
func (s *UnifiedZmanimService) getTimezoneForCoordinates(ctx context.Context, lat, lon float64) (string, error) {
    // First, try to find nearest locality
    locality, err := s.db.Queries.FindNearestLocality(ctx, lat, lon)
    if err == nil && locality.Timezone != "" {
        return locality.Timezone, nil
    }

    // Fallback to default (should not happen in production)
    return "UTC", nil
}
```

**DoD:**
- [ ] Function moved to zmanim_service.go
- [ ] All callers updated
- [ ] timezone_service.go deleted

#### Task 7.3.2: Delete Algorithm Package (If Unused)

```bash
# Step 1: Find all usages
rg "internal/algorithm" api/ --type go -l

# Step 2: If usages exist, check if they can be replaced with DSL
# Step 3: If no usages or all migrated:
rm -rf api/internal/algorithm/
```

**DoD:**
- [ ] No imports of `internal/algorithm` remain
- [ ] Package deleted
- [ ] Build succeeds

#### Task 7.3.3: Delete Handler Sorting

```bash
rm api/internal/handlers/zmanim_sort.go
rm api/internal/handlers/zmanim_sort_test.go
```

Update handlers to use service:

```go
// BEFORE (in handler):
h.sortZmanimByTime(zmanim)

// AFTER (using service):
h.zmanimService.SortZmanim(zmanim)
```

**DoD:**
- [ ] zmanim_sort.go deleted
- [ ] All handlers use service.SortZmanim()
- [ ] Tests moved to service test file

---

### 7.4 Final File Structure

After complete consolidation:

```
api/internal/services/
├── zmanim_service.go           # THE ONLY zmanim file (~700 lines)
├── publisher_service.go        # Publisher operations
├── locality_service.go         # Locality operations
└── ... other non-zmanim services

api/internal/handlers/
├── zmanim.go                   # Public zmanim endpoints (uses zmanimService)
├── publisher_zmanim.go         # Publisher zmanim endpoints (uses zmanimService)
├── external_api.go             # External API (uses zmanimService)
├── dsl.go                      # DSL preview/validate (uses zmanimService)
├── master_registry.go          # Registry endpoints
├── ... other handlers

# DELETED FILES (no longer exist):
❌ api/internal/services/zmanim_calculation.go
❌ api/internal/services/zmanim_ordering.go
❌ api/internal/services/zmanim_linking_service.go
❌ api/internal/services/timezone_service.go
❌ api/internal/handlers/zmanim_sort.go
❌ api/internal/handlers/zmanim_sort_test.go
❌ api/internal/algorithm/  (entire directory)
```

---

### 7.5 Unified Service Structure

**File:** `api/internal/services/zmanim_service.go` (~700 lines)

```go
// File: zmanim_service.go
// Purpose: THE SINGLE SOURCE OF TRUTH for all zmanim operations
// This file handles: calculation, ordering, linking, filtering, caching, rounding

package services

import (
    // ... imports
)

// ===========================================================================
// SECTION 1: TYPES & STRUCTS (~100 lines)
// ===========================================================================

type UnifiedZmanimService struct { ... }

type CalculateParams struct { ... }
type FormulaParams struct { ... }
type RangeParams struct { ... }
type CalculationResult struct { ... }
type CalculatedZman struct { ... }
type FormulaResult struct { ... }
type DayResult struct { ... }
type LinkOrCopyZmanRequest struct { ... }
type LinkOrCopyZmanResult struct { ... }
type EventContext struct { ... }
type SortableZman interface { ... }

// ===========================================================================
// SECTION 2: CONSTRUCTOR & INITIALIZATION (~50 lines)
// ===========================================================================

func NewUnifiedZmanimService(ctx context.Context, db *db.DB, cache *cache.Cache) (*UnifiedZmanimService, error)

// ===========================================================================
// SECTION 3: CALCULATION METHODS (~200 lines)
// ===========================================================================

func (s *UnifiedZmanimService) CalculateZmanim(ctx context.Context, params CalculateParams) (*CalculationResult, error)
func (s *UnifiedZmanimService) CalculateFormula(ctx context.Context, params FormulaParams) (*FormulaResult, error)
func (s *UnifiedZmanimService) CalculateRange(ctx context.Context, params RangeParams) ([]DayResult, error)
func (s *UnifiedZmanimService) ExecuteFormulasWithCoordinates(...) (map[string]time.Time, error)

// ===========================================================================
// SECTION 4: ORDERING METHODS (~50 lines)
// ===========================================================================

func (s *UnifiedZmanimService) GetCategoryOrder(category string) int
func (s *UnifiedZmanimService) SortZmanim(zmanim []SortableZman)

// ===========================================================================
// SECTION 5: LINKING METHODS (~100 lines)
// ===========================================================================

func (s *UnifiedZmanimService) LinkOrCopyZman(ctx context.Context, req LinkOrCopyZmanRequest) (*LinkOrCopyZmanResult, error)

// ===========================================================================
// SECTION 6: FILTERING METHODS (~50 lines)
// ===========================================================================

func (s *UnifiedZmanimService) ShouldShowZman(z ZmanWithTags, ctx EventContext) bool
func (s *UnifiedZmanimService) FilterZmanimForContext(zmanim []Zman, ctx EventContext) []Zman

// ===========================================================================
// SECTION 7: CACHE METHODS (~50 lines)
// ===========================================================================

func (s *UnifiedZmanimService) buildCacheKey(...) string
func (s *UnifiedZmanimService) getCachedResult(...) (*CalculationResult, error)
func (s *UnifiedZmanimService) setCachedResult(...) error
func (s *UnifiedZmanimService) InvalidatePublisherCache(ctx context.Context, publisherID int32) error
func (s *UnifiedZmanimService) InvalidateLocalityCache(ctx context.Context, publisherID int32, localityID int64) error

// ===========================================================================
// SECTION 8: ROUNDING (~30 lines)
// ===========================================================================

func ApplyRounding(t time.Time, mode string) (string, string)

// ===========================================================================
// SECTION 9: INTERNAL HELPERS (~70 lines)
// ===========================================================================

func (s *UnifiedZmanimService) getTimezoneForCoordinates(ctx context.Context, lat, lon float64) (string, error)
func hasMatchingEvent(events []string, tagKey string) bool
func matchesEventPattern(tagKey string, event string) bool
```

---

### 7.6 Technical Debt Items to Remove

#### Dead Code in Handlers

| Location | Issue | Action |
|----------|-------|--------|
| `publisher_zmanim.go:1067-1086` | Hardcoded `isCandleLighting`, `isHavdalah` | REPLACE with service call |
| `master_registry.go:715-719` | Hardcoded category mapping | REPLACE with tag field |
| `zmanim.go` | Direct DSL calls | REPLACE with service call |

#### Deprecated Response Types

| Type | Location | Action |
|------|----------|--------|
| `ZmanResponse` | types.go | DELETE |
| `ZmanimListResponse` | types.go | DELETE |
| `ZmanimLocationInfo` | zmanim.go | DELETE - use `types.LocationInfo` |
| `BulkLocationInfo` | external_api.go | DELETE - use `types.LocationInfo` |

#### Duplicate Functions

| Function | Locations | Action |
|----------|-----------|--------|
| `applyRounding` | zmanim.go, zmanim_calculation.go | KEEP only in zmanim_service.go |
| `sortZmanimByTime` | zmanim_sort.go | DELETE - use service |
| `sortPublisherZmanimByTime` | zmanim_sort.go | DELETE - use service |
| `getCategoryOrder` | zmanim_sort.go | DELETE - use service |

---

### 7.7 Verification: Zero Technical Debt

#### Final Verification Script

**File:** `scripts/verify-complete-consolidation.sh`

```bash
#!/bin/bash
# Verify complete consolidation - zero technical debt

echo "=== COMPLETE CONSOLIDATION VERIFICATION ==="
echo ""

PASS=0
FAIL=0

# Test 1: Only one zmanim service file
echo "Test 1: Single zmanim_service.go file..."
ZMANIM_FILES=$(ls api/internal/services/zmanim*.go 2>/dev/null | wc -l)
if [ "$ZMANIM_FILES" -eq 1 ]; then
  FILENAME=$(ls api/internal/services/zmanim*.go)
  if [ "$FILENAME" == "api/internal/services/zmanim_service.go" ]; then
    echo "  ✅ PASS: Only zmanim_service.go exists"
    ((PASS++))
  else
    echo "  ❌ FAIL: Wrong file: $FILENAME"
    ((FAIL++))
  fi
else
  echo "  ❌ FAIL: Found $ZMANIM_FILES zmanim files:"
  ls api/internal/services/zmanim*.go
  ((FAIL++))
fi

# Test 2: No timezone service
echo "Test 2: No separate timezone_service.go..."
if [ ! -f "api/internal/services/timezone_service.go" ]; then
  echo "  ✅ PASS: timezone_service.go deleted"
  ((PASS++))
else
  echo "  ❌ FAIL: timezone_service.go still exists"
  ((FAIL++))
fi

# Test 3: No algorithm package
echo "Test 3: No algorithm package..."
if [ ! -d "api/internal/algorithm" ]; then
  echo "  ✅ PASS: algorithm package deleted"
  ((PASS++))
else
  echo "  ❌ FAIL: algorithm package still exists"
  ((FAIL++))
fi

# Test 4: No zmanim_sort.go
echo "Test 4: No handler-level sorting..."
if [ ! -f "api/internal/handlers/zmanim_sort.go" ]; then
  echo "  ✅ PASS: zmanim_sort.go deleted"
  ((PASS++))
else
  echo "  ❌ FAIL: zmanim_sort.go still exists"
  ((FAIL++))
fi

# Test 5: No hardcoded event zman checks
echo "Test 5: No hardcoded isCandleLighting/isHavdalah..."
HARDCODED=$(rg "isCandleLighting|isHavdalah|isFastStart|isFastEnd" api/internal/handlers/*.go api/internal/services/*.go 2>/dev/null | wc -l)
if [ "$HARDCODED" -eq 0 ]; then
  echo "  ✅ PASS: No hardcoded event checks"
  ((PASS++))
else
  echo "  ❌ FAIL: Found $HARDCODED hardcoded checks"
  ((FAIL++))
fi

# Test 6: No hardcoded ShowCandleLighting fields
echo "Test 6: No ShowCandleLighting/ShowHavdalah fields..."
SHOW_FIELDS=$(rg "ShowCandleLighting|ShowHavdalah|ShowFastStart|ShowFastEnd" api/internal/handlers/*.go 2>/dev/null | grep -v "// " | wc -l)
if [ "$SHOW_FIELDS" -eq 0 ]; then
  echo "  ✅ PASS: No Show* fields in handlers"
  ((PASS++))
else
  echo "  ⚠️  WARNING: Found Show* fields (may be in DayContext - acceptable)"
  # This might be acceptable if DayContext still has these for API response
fi

# Test 7: No duplicate applyRounding
echo "Test 7: Single ApplyRounding function..."
ROUNDING_COUNT=$(rg "func.*[aA]pplyRounding" api/internal/ --type go -l 2>/dev/null | wc -l)
if [ "$ROUNDING_COUNT" -eq 1 ]; then
  echo "  ✅ PASS: Single ApplyRounding in zmanim_service.go"
  ((PASS++))
else
  echo "  ❌ FAIL: Found $ROUNDING_COUNT ApplyRounding functions"
  rg "func.*[aA]pplyRounding" api/internal/ --type go -l
  ((FAIL++))
fi

# Test 8: No references to deleted services
echo "Test 8: No references to deleted services..."
REFS=$(rg "ZmanimCalculationService|ZmanimOrderingService|ZmanimLinkingService|TimezoneService" api/internal/ --type go 2>/dev/null | grep -v "_test.go" | wc -l)
if [ "$REFS" -eq 0 ]; then
  echo "  ✅ PASS: No references to old services"
  ((PASS++))
else
  echo "  ❌ FAIL: Found $REFS references"
  rg "ZmanimCalculationService|ZmanimOrderingService|ZmanimLinkingService|TimezoneService" api/internal/ --type go | grep -v "_test.go"
  ((FAIL++))
fi

# Test 9: Service file size check
echo "Test 9: Unified service file size..."
if [ -f "api/internal/services/zmanim_service.go" ]; then
  LINES=$(wc -l < api/internal/services/zmanim_service.go)
  if [ "$LINES" -lt 1000 ]; then
    echo "  ✅ PASS: Service is $LINES lines (under 1000)"
    ((PASS++))
  else
    echo "  ⚠️  WARNING: Service is $LINES lines (consider splitting sections)"
  fi
else
  echo "  ❌ FAIL: zmanim_service.go not found"
  ((FAIL++))
fi

# Test 10: Build succeeds
echo "Test 10: Go build succeeds..."
cd api && go build ./cmd/api 2>/dev/null
if [ $? -eq 0 ]; then
  echo "  ✅ PASS: Build succeeds"
  ((PASS++))
else
  echo "  ❌ FAIL: Build failed"
  ((FAIL++))
fi

echo ""
echo "=== RESULTS: $PASS passed, $FAIL failed ==="

if [ "$FAIL" -eq 0 ]; then
  echo ""
  echo "🎉 COMPLETE CONSOLIDATION VERIFIED"
  echo "   - Single zmanim_service.go file"
  echo "   - No timezone_service.go"
  echo "   - No algorithm package"
  echo "   - No handler-level sorting"
  echo "   - No hardcoded zman logic"
  echo "   - Zero technical debt"
  exit 0
else
  echo ""
  echo "❌ CONSOLIDATION INCOMPLETE - Fix the failures above"
  exit 1
fi
```

---

### 7.8 Complete DoD for Technical Debt Removal

#### Files Deleted
- [ ] `api/internal/services/zmanim_calculation.go` - DELETED
- [ ] `api/internal/services/zmanim_ordering.go` - DELETED
- [ ] `api/internal/services/zmanim_linking_service.go` - DELETED
- [ ] `api/internal/services/timezone_service.go` - DELETED
- [ ] `api/internal/handlers/zmanim_sort.go` - DELETED
- [ ] `api/internal/handlers/zmanim_sort_test.go` - DELETED
- [ ] `api/internal/algorithm/` directory - DELETED (if unused)

#### Single Source of Truth
- [ ] `api/internal/services/zmanim_service.go` contains ALL zmanim logic
- [ ] File is < 1000 lines (well-organized sections)
- [ ] All methods documented with clear comments

#### No Hardcoded Logic
- [ ] Zero `isCandleLighting`, `isHavdalah`, etc. strings
- [ ] Zero `ShowCandleLighting`, `ShowHavdalah` boolean fields
- [ ] Zero hardcoded category mappings
- [ ] All behavior driven by database tags

#### Clean Imports
- [ ] No handler imports deprecated services
- [ ] No circular dependencies
- [ ] `UnifiedZmanimService` is the only zmanim service type

#### Tests Updated
- [ ] All service tests in `zmanim_service_test.go`
- [ ] Sorting tests moved from handler tests
- [ ] Linking tests included
- [ ] All tests pass
