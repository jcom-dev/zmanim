# Zmanim Ordering & API Response Consolidation Plan

**Created:** 2024-12-19
**Status:** Ready for Implementation
**Estimated Effort:** ~15 files, ~400 lines changed

---

## Executive Summary

Consolidate zmanim ordering logic from 8+ duplicated locations into a single source of truth. Clean up API response types with no backwards compatibility constraints. Add timestamp fields to calculation responses.

---

## Problem Statement

### Part A: Ordering Chaos
- SQL queries use hardcoded CASE statements for time_category ordering
- Go handlers use hardcoded `timeCategoryOrder` map
- Frontend has its own `categoryOrder` object and complex ref-based sorting
- **BUG:** Ordering breaks when UI buttons (rounding, settings) are clicked

### Part B: API Response Mess
- `ExternalPublisherZman` uses `name_english`/`name_hebrew` (everything else uses `english_name`/`hebrew_name`)
- 3 different location response structures
- `category` vs `display_status` confusion
- Legacy/deprecated types still in use
- Time nullability inconsistent (`string` vs `*string`)

---

## Current State: Where Ordering Logic Lives

### Backend SQL (5 duplicates with hardcoded CASE)

| File | Query | Lines | Tiebreaker |
|------|-------|-------|------------|
| `api/internal/db/queries/zmanim.sql` | GetPublisherZmanim | 109-121 | hebrew_name |
| `api/internal/db/queries/zmanim.sql` | GetPublisherZmanimForLinking | 293-305 | hebrew_name |
| `api/internal/db/queries/zmanim.sql` | FetchPublisherZmanim | 475-487 | hebrew_name |
| `api/internal/db/queries/external_api.sql` | GetPublisherZmanimForExternal | 46-58 | **english_name** (INCONSISTENT!) |
| `api/internal/db/queries/zmanim_simplified.sql` | GetPublisherZmanimSimplified | 47-59 | hebrew_name |

**Example of CASE statement to replace:**
```sql
ORDER BY
    CASE COALESCE(mr_tc.key, tc.key, 'uncategorized')
        WHEN 'dawn' THEN 1
        WHEN 'sunrise' THEN 2
        WHEN 'morning' THEN 3
        WHEN 'midday' THEN 4
        WHEN 'afternoon' THEN 5
        WHEN 'sunset' THEN 6
        WHEN 'nightfall' THEN 7
        WHEN 'midnight' THEN 8
        ELSE 9
    END,
    pz.hebrew_name;
```

### Backend Go (hardcoded map)

**File:** `api/internal/handlers/zmanim_sort.go`

```go
// Lines 58-67 - THIS NEEDS TO BE DELETED
var timeCategoryOrder = map[string]int{
    "dawn":      1,
    "sunrise":   2,
    "morning":   3,
    "midday":    4,
    "afternoon": 5,
    "sunset":    6,
    "nightfall": 7,
    "midnight":  8,
}
```

**Called from:**
- `api/internal/handlers/zmanim.go:360` - `sortZmanimByTime(response.Zmanim)`
- `api/internal/handlers/publisher_zmanim.go:908` - `sortPublisherZmanimByTime(result)`

### Frontend TypeScript (duplicated + buggy)

**File:** `web/app/publisher/algorithm/page.tsx` (lines 577-677)

```typescript
// Lines 580-581 - Complex refs for "stable" ordering
const sortOrderRef = useRef<Map<string, number>>(new Map());
const lastSortContextRef = useRef<string>('');

// Lines 593-596 - DUPLICATE of backend category order
const categoryOrder: Record<string, number> = {
  dawn: 1, sunrise: 2, morning: 3, midday: 4,
  afternoon: 5, sunset: 6, nightfall: 7, midnight: 8,
};

// Line 677 - BUG: Missing dependencies cause order instability
}, [everydayZmanim, eventZmanim, viewMode, deferredSearchQuery, filterType, tagFilter, sortContextKey]);
```

---

## Solution Architecture

### Single Source of Truth: `time_categories.sort_order`

The database already has a `sort_order` column in the `time_categories` table. ALL ordering should derive from this column.

### Ordering Algorithm (3-level priority)
1. **Primary:** `time_categories.sort_order` (from database)
2. **Secondary:** Calculated time (chronological within category)
3. **Tertiary:** `hebrew_name` (consistent tiebreaker everywhere)

---

## Implementation Tasks

### Task 1: Create ZmanimOrderingService

**CREATE:** `api/internal/services/zmanim_ordering.go`

```go
package services

import (
    "context"
    "sort"
    "time"
)

// ZmanimOrderingService provides consistent zmanim ordering
// Single source of truth - loads category order from database
type ZmanimOrderingService struct {
    categoryOrder map[string]int // populated from time_categories.sort_order
}

// NewZmanimOrderingService creates the service and loads category order from DB
func NewZmanimOrderingService(ctx context.Context, queries *db.Queries) (*ZmanimOrderingService, error) {
    s := &ZmanimOrderingService{
        categoryOrder: make(map[string]int),
    }

    // Load from database - time_categories table has sort_order column
    categories, err := queries.GetAllTimeCategories(ctx)
    if err != nil {
        return nil, err
    }

    for _, cat := range categories {
        s.categoryOrder[cat.Key] = int(cat.SortOrder)
    }
    s.categoryOrder["uncategorized"] = 99

    return s, nil
}

// GetCategoryOrder returns sort order for a category key
func (s *ZmanimOrderingService) GetCategoryOrder(category string) int {
    if order, ok := s.categoryOrder[category]; ok {
        return order
    }
    return 99
}

// SortableZman interface for any zman type that can be sorted
type SortableZman interface {
    GetTimeCategory() string
    GetCalculatedTime() *string // HH:MM:SS format
    GetHebrewName() string
}

// SortZmanim sorts any slice of zmanim using 3-level priority
func (s *ZmanimOrderingService) SortZmanim(zmanim []SortableZman) {
    sort.SliceStable(zmanim, func(i, j int) bool {
        // 1. Category order (from DB)
        catI := s.GetCategoryOrder(zmanim[i].GetTimeCategory())
        catJ := s.GetCategoryOrder(zmanim[j].GetTimeCategory())
        if catI != catJ {
            return catI < catJ
        }

        // 2. Calculated time
        timeI := zmanim[i].GetCalculatedTime()
        timeJ := zmanim[j].GetCalculatedTime()
        if timeI != nil && timeJ != nil {
            if *timeI != *timeJ {
                return *timeI < *timeJ // String comparison works for HH:MM:SS
            }
        } else if timeI != nil {
            return true
        } else if timeJ != nil {
            return false
        }

        // 3. Hebrew name (consistent tiebreaker)
        return zmanim[i].GetHebrewName() < zmanim[j].GetHebrewName()
    })
}
```

**Note:** You may need to add a SQL query `GetAllTimeCategories` if it doesn't exist:
```sql
-- name: GetAllTimeCategories :many
SELECT id, key, sort_order, is_everyday FROM time_categories ORDER BY sort_order;
```

---

### Task 2: Update SQL Queries

Replace ALL hardcoded CASE statements with `tc.sort_order`:

**MODIFY:** `api/internal/db/queries/zmanim.sql`

Find and replace (4 locations):
```sql
-- BEFORE:
ORDER BY
    CASE COALESCE(mr_tc.key, tc.key, 'uncategorized')
        WHEN 'dawn' THEN 1
        WHEN 'sunrise' THEN 2
        ...
    END,
    pz.hebrew_name;

-- AFTER:
ORDER BY
    COALESCE(mr_tc.sort_order, tc.sort_order, 99),
    pz.hebrew_name;
```

**MODIFY:** `api/internal/db/queries/external_api.sql`
- Replace CASE with `tc.sort_order`
- **FIX:** Change tiebreaker from `english_name` to `hebrew_name`

**MODIFY:** `api/internal/db/queries/zmanim_simplified.sql`
- Replace CASE with `tc.sort_order`

**After SQL changes:** Run `cd api && sqlc generate`

---

### Task 3: Delete Deprecated Types

**MODIFY:** `api/internal/handlers/types.go`

**DELETE these types (find usages first and update them):**

```go
// DELETE - replaced by ZmanWithFormula
type ZmanResponse struct { ... }

// DELETE - replaced by ZmanimWithFormulaResponse
type ZmanimListResponse struct { ... }
```

---

### Task 4: Consolidate Location Types

**MODIFY:** `api/internal/handlers/types.go`

**CREATE single LocationInfo struct:**
```go
// LocationInfo is THE location type - used everywhere
type LocationInfo struct {
    LocalityID       string  `json:"locality_id"`
    LocalityName     string  `json:"locality_name"`
    Country          string  `json:"country"`
    CountryCode      string  `json:"country_code"`
    Region           *string `json:"region,omitempty"`
    DisplayHierarchy string  `json:"display_hierarchy"`
    Latitude         float64 `json:"latitude"`
    Longitude        float64 `json:"longitude"`
    Elevation        float64 `json:"elevation"`
    Timezone         string  `json:"timezone"`
}
```

**DELETE from `zmanim.go`:**
```go
// DELETE - use types.LocationInfo instead
type ZmanimLocationInfo struct { ... }
```

**DELETE from `external_api.go`:**
```go
// DELETE - use types.LocationInfo instead
type BulkLocationInfo struct { ... }
```

**Update all usages to use `types.LocationInfo`**

---

### Task 5: Fix External API Naming

**MODIFY:** `api/internal/handlers/external_api.go`

```go
// BEFORE:
type ExternalPublisherZman struct {
    ZmanKey       string  `json:"zman_key"`
    MasterZmanID  *string `json:"master_zman_id"`
    NameEnglish   string  `json:"name_english"`   // WRONG
    NameHebrew    string  `json:"name_hebrew"`    // WRONG
    // ...
}

// AFTER:
type ExternalPublisherZman struct {
    ZmanKey      string  `json:"zman_key"`
    MasterZmanID *string `json:"master_zman_id"`
    EnglishName  string  `json:"english_name"`   // CORRECT
    HebrewName   string  `json:"hebrew_name"`    // CORRECT
    // ...
}
```

**Update field assignments where this struct is populated.**

---

### Task 6: Remove Deprecated `category` Field

**MODIFY:** `api/internal/handlers/publisher_zmanim.go`

In `PublisherZman` struct:
```go
// DELETE this line:
Category     string `json:"category"` // deprecated, use display_status

// KEEP these:
TimeCategory  string `json:"time_category"`  // For ordering (dawn, sunrise, etc.)
DisplayStatus string `json:"display_status"` // For visibility (core, optional, hidden)
```

**Search for any code setting `Category` field and remove it.**

---

### Task 7: Add Timestamp Field to Responses

**MODIFY:** `api/internal/handlers/zmanim.go`

In `ZmanWithFormula` struct:
```go
type ZmanWithFormula struct {
    Name         string   `json:"name"`
    HebrewName   string   `json:"hebrew_name"`
    Key          string   `json:"key"`
    Time         string   `json:"time"`
    Timestamp    *int64   `json:"timestamp"`    // NEW - Unix seconds
    // ... rest of fields
}
```

**MODIFY:** `api/internal/handlers/publisher_zmanim.go`

In `PublisherZmanWithTime` struct:
```go
type PublisherZmanWithTime struct {
    PublisherZman
    Time      *string `json:"time"`
    Timestamp *int64  `json:"timestamp"`  // NEW - Unix seconds
    Error     *string `json:"error"`
}
```

**MODIFY:** `api/internal/services/zmanim_calculation.go`

Add timestamp population when calculating times:
```go
// When setting the time result:
if calculatedTime != nil {
    ts := calculatedTime.Unix()
    result.Timestamp = &ts
    formatted := calculatedTime.Format("15:04:05")
    result.Time = &formatted
}
```

---

### Task 8: Wire Ordering Service into Handlers

**MODIFY:** `api/internal/handlers/handlers.go`

```go
type Handlers struct {
    // ... existing fields
    orderingService *services.ZmanimOrderingService  // ADD
}

func NewHandlers(/* params */) *Handlers {
    // Initialize ordering service
    orderingService, err := services.NewZmanimOrderingService(ctx, queries)
    if err != nil {
        // handle error
    }

    return &Handlers{
        // ... existing
        orderingService: orderingService,
    }
}
```

**MODIFY:** `api/internal/handlers/zmanim_sort.go`

```go
// DELETE the hardcoded map:
// var timeCategoryOrder = map[string]int{ ... }

// DELETE or simplify getCategoryOrder - delegate to service

// UPDATE sortZmanimByTime to use service (or delete if service handles it)
```

---

### Task 9: Update Frontend Types and Remove Client-Side Ordering

**MODIFY:** `web/lib/hooks/useZmanimList.ts`

In `PublisherZman` interface:
```typescript
// DELETE this line:
category: string; // time_category key (dawn, sunrise, etc.) - for ordering

// KEEP:
time_category?: string;  // For ordering (dawn, sunrise, etc.)
display_status: DisplayStatus; // For visibility (core, optional, hidden)
```

**ADD timestamp to types that have time:**
```typescript
interface PublisherZmanWithTime extends PublisherZman {
  time: string | null;
  timestamp: number | null;  // ADD - Unix seconds
  error?: string;
}
```

**MODIFY:** `web/app/publisher/algorithm/page.tsx`

**DELETE lines 580-622** (the complex ref-based sorting):
```typescript
// DELETE ALL OF THIS:
const sortOrderRef = useRef<Map<string, number>>(new Map());
const lastSortContextRef = useRef<string>('');
const zmanimKeys = useMemo(() => ...);
const sortContextKey = `${previewLocation.latitude}-...`;
if (sortContextKey !== lastSortContextRef.current && ...) {
  const categoryOrder: Record<string, number> = { ... };
  // ... all the sorting logic
}
```

**REPLACE with simple stable-order preservation:**
```typescript
// Simple stable order from API response
const stableOrderMap = useMemo(() => {
  const order = new Map<string, number>();
  zmanim.forEach((z, i) => order.set(z.zman_key, i));
  return order;
}, [zmanim]); // Only recalculates when zmanim list changes from API
```

**UPDATE filteredZmanim memo** to use `stableOrderMap`:
```typescript
const filteredZmanim = useMemo(() => {
  let result = viewMode === 'everyday' ? [...everydayZmanim] : [...eventZmanim];

  // Apply filters (search, type, tag)...

  // Maintain stable order from API response
  result.sort((a, b) => {
    const orderA = stableOrderMap.get(a.zman_key) ?? Number.MAX_SAFE_INTEGER;
    const orderB = stableOrderMap.get(b.zman_key) ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });

  return result;
}, [everydayZmanim, eventZmanim, viewMode, deferredSearchQuery, filterType, tagFilter, stableOrderMap]);
```

**UPDATE any `z.category` references to `z.time_category`**

---

### Task 10: Create Frontend Ordering Utility (Optional)

**CREATE:** `web/lib/utils/zmanim-ordering.ts`

```typescript
/**
 * Zmanim Ordering Utilities
 *
 * NOTE: Primary ordering should come from the API.
 * This utility is only for edge cases (offline mode, optimistic updates).
 */

// Category order - MUST match database time_categories.sort_order
export const TIME_CATEGORY_ORDER: Record<string, number> = {
  dawn: 1,
  sunrise: 2,
  morning: 3,
  midday: 4,
  afternoon: 5,
  sunset: 6,
  nightfall: 7,
  midnight: 8,
  uncategorized: 99,
};

export interface SortableZman {
  zman_key: string;
  time_category?: string;
  hebrew_name?: string;
}

/**
 * Create a stable order map from an array (preserves received order)
 */
export function createStableOrderMap(zmanim: SortableZman[]): Map<string, number> {
  const map = new Map<string, number>();
  zmanim.forEach((z, i) => map.set(z.zman_key, i));
  return map;
}

/**
 * Sort zmanim by category order, then by name
 * Use this ONLY when API ordering isn't available
 */
export function sortZmanimByCategory<T extends SortableZman>(zmanim: T[]): T[] {
  return [...zmanim].sort((a, b) => {
    const catA = a.time_category || 'uncategorized';
    const catB = b.time_category || 'uncategorized';

    const orderA = TIME_CATEGORY_ORDER[catA] ?? 99;
    const orderB = TIME_CATEGORY_ORDER[catB] ?? 99;

    if (orderA !== orderB) return orderA - orderB;

    return (a.hebrew_name || '').localeCompare(b.hebrew_name || '');
  });
}
```

---

## Definition of Done Checklist

### DoD 1: Single Source of Truth for Ordering
- [ ] `ZmanimOrderingService` exists at `api/internal/services/zmanim_ordering.go`
- [ ] Service loads category order from `time_categories.sort_order` column
- [ ] NO hardcoded category order maps anywhere else in Go codebase
- [ ] ALL zmanim API responses return data pre-sorted by the service

### DoD 2: No Client-Side Ordering Logic
- [ ] Frontend does NOT sort zmanim by category/time
- [ ] Frontend only preserves API response order (stable-order pattern)
- [ ] No `categoryOrder` objects in TypeScript code (except utility file)
- [ ] `sortOrderRef` and `lastSortContextRef` deleted from algorithm/page.tsx

### DoD 3: Consistent API Response Types
- [ ] All zmanim use `english_name`/`hebrew_name` (not `name_english`/`name_hebrew`)
- [ ] Single `LocationInfo` type used everywhere
- [ ] No `category` field in responses (only `time_category` and `display_status`)
- [ ] All calculated times include both `time` (string) and `timestamp` (int64)

### DoD 4: No Deprecated/Legacy Types
- [ ] `ZmanResponse` deleted from types.go
- [ ] `ZmanimListResponse` deleted from types.go
- [ ] `ZmanimLocationInfo` deleted (use `LocationInfo`)
- [ ] `BulkLocationInfo` deleted (use `LocationInfo`)

### DoD 5: UI Stability
- [ ] Clicking rounding buttons does NOT reorder zmanim
- [ ] Toggling showSeconds does NOT reorder zmanim
- [ ] Changing location/date DOES trigger re-fetch with new order from API

---

## Validation Script

**CREATE:** `scripts/validate-ordering-consolidation.sh`

```bash
#!/bin/bash
# Run this after implementation to verify consolidation is complete

echo "=== VALIDATION: Zmanim Ordering Consolidation ==="
echo ""

PASS=0
FAIL=0

# Test 1: No hardcoded category order maps in Go handlers
echo "Test 1: No hardcoded timeCategoryOrder maps in handlers..."
RESULT=$(rg "timeCategoryOrder\s*=" api/internal/handlers/ -l 2>/dev/null | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: No hardcoded category maps in handlers"
  ((PASS++))
else
  echo "  ❌ FAIL: Found hardcoded category maps:"
  rg "timeCategoryOrder\s*=" api/internal/handlers/ -l
  ((FAIL++))
fi

# Test 2: No CASE statements for category ordering in SQL
echo "Test 2: No CASE statements for time category ordering..."
RESULT=$(rg "WHEN 'dawn' THEN 1" api/internal/db/queries/ -l 2>/dev/null | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: No hardcoded CASE ordering in SQL"
  ((PASS++))
else
  echo "  ❌ FAIL: Found CASE ordering:"
  rg "WHEN 'dawn' THEN 1" api/internal/db/queries/ -l
  ((FAIL++))
fi

# Test 3: SQL uses sort_order column
echo "Test 3: SQL queries use tc.sort_order..."
RESULT=$(rg "tc\.sort_order|mr_tc\.sort_order" api/internal/db/queries/zmanim*.sql -l 2>/dev/null | wc -l)
if [ "$RESULT" -ge 2 ]; then
  echo "  ✅ PASS: SQL uses sort_order column"
  ((PASS++))
else
  echo "  ⚠️  WARNING: May not be using sort_order in all queries"
  ((FAIL++))
fi

# Test 4: No categoryOrder in frontend (except utility)
echo "Test 4: No categoryOrder objects in frontend app/components..."
RESULT=$(rg "categoryOrder\s*[:=]" web/app/ web/components/ -l 2>/dev/null | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: No categoryOrder in frontend"
  ((PASS++))
else
  echo "  ❌ FAIL: Found categoryOrder:"
  rg "categoryOrder\s*[:=]" web/app/ web/components/ -l
  ((FAIL++))
fi

# Test 5: No sortOrderRef in frontend
echo "Test 5: No complex sorting refs in frontend..."
RESULT=$(rg "sortOrderRef|lastSortContextRef" web/ -l 2>/dev/null | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: No complex sorting refs"
  ((PASS++))
else
  echo "  ❌ FAIL: Found sorting refs:"
  rg "sortOrderRef|lastSortContextRef" web/ -l
  ((FAIL++))
fi

# Test 6: No name_english/name_hebrew
echo "Test 6: Consistent field naming (english_name not name_english)..."
RESULT=$(rg '"name_english"|"name_hebrew"' api/internal/handlers/ -l 2>/dev/null | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: Consistent naming"
  ((PASS++))
else
  echo "  ❌ FAIL: Found inconsistent naming:"
  rg '"name_english"|"name_hebrew"' api/internal/handlers/ -l
  ((FAIL++))
fi

# Test 7: No deprecated category field
echo "Test 7: No deprecated 'category' field in API responses..."
RESULT=$(rg 'json:"category"' api/internal/handlers/publisher_zmanim.go 2>/dev/null | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: No deprecated category field"
  ((PASS++))
else
  echo "  ❌ FAIL: Found deprecated category field"
  ((FAIL++))
fi

# Test 8: ZmanimOrderingService exists
echo "Test 8: ZmanimOrderingService exists..."
if [ -f "api/internal/services/zmanim_ordering.go" ]; then
  echo "  ✅ PASS: Ordering service exists"
  ((PASS++))
else
  echo "  ❌ FAIL: Ordering service not found"
  ((FAIL++))
fi

# Test 9: Timestamp field in responses
echo "Test 9: Timestamp field in zman responses..."
RESULT=$(rg 'Timestamp.*int64.*json:"timestamp"' api/internal/handlers/ -l 2>/dev/null | wc -l)
if [ "$RESULT" -ge 1 ]; then
  echo "  ✅ PASS: Timestamp field present"
  ((PASS++))
else
  echo "  ❌ FAIL: Timestamp field not found"
  ((FAIL++))
fi

# Test 10: Deprecated types deleted
echo "Test 10: Deprecated types removed..."
RESULT=$(rg "type ZmanResponse struct|type ZmanimListResponse struct" api/internal/handlers/types.go 2>/dev/null | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: Deprecated types removed"
  ((PASS++))
else
  echo "  ❌ FAIL: Deprecated types still exist"
  ((FAIL++))
fi

echo ""
echo "=== RESULTS: $PASS passed, $FAIL failed ==="

if [ "$FAIL" -eq 0 ]; then
  echo "✅ ALL VALIDATION TESTS PASSED"
  exit 0
else
  echo "❌ SOME TESTS FAILED - Review and fix before completing"
  exit 1
fi
```

---

## Manual Testing Checklist

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Rounding stability | 1. Load `/publisher/algorithm`<br>2. Note zmanim order<br>3. Click rounding button on any zman<br>4. Check order | Order unchanged |
| Settings stability | 1. Load `/publisher/algorithm`<br>2. Toggle "Show Seconds"<br>3. Check order | Order unchanged |
| Location change | 1. Load `/publisher/algorithm`<br>2. Change preview location<br>3. Check order | Order updates from API (time-based) |
| Week preview | 1. Open WeekPreview modal<br>2. Check zmanim order per day | Chronological: dawn → sunset → midnight |
| Build passes | `cd api && go build ./cmd/api` | No errors |
| Type check passes | `cd web && npm run type-check` | No errors |
| SQLc generates | `cd api && sqlc generate` | No errors |

---

## Files to Modify Summary

### Backend - Create
| File | Purpose |
|------|---------|
| `api/internal/services/zmanim_ordering.go` | Single source of truth ordering service |

### Backend - Modify
| File | Changes |
|------|---------|
| `api/internal/handlers/handlers.go` | Add orderingService field |
| `api/internal/handlers/zmanim_sort.go` | Delete hardcoded map, delegate to service |
| `api/internal/handlers/types.go` | Delete deprecated types, consolidate LocationInfo |
| `api/internal/handlers/zmanim.go` | Add Timestamp field, use LocationInfo |
| `api/internal/handlers/publisher_zmanim.go` | Remove category field, add Timestamp |
| `api/internal/handlers/external_api.go` | Fix naming, use LocationInfo |
| `api/internal/services/zmanim_calculation.go` | Add ordering + timestamp |
| `api/internal/db/queries/zmanim.sql` | Replace 4 CASE blocks with sort_order |
| `api/internal/db/queries/zmanim_simplified.sql` | Replace CASE with sort_order |
| `api/internal/db/queries/external_api.sql` | Replace CASE, fix tiebreaker |

### Frontend - Create
| File | Purpose |
|------|---------|
| `web/lib/utils/zmanim-ordering.ts` | Optional utility for edge cases |
| `scripts/validate-ordering-consolidation.sh` | Validation script |

### Frontend - Modify
| File | Changes |
|------|---------|
| `web/lib/hooks/useZmanimList.ts` | Remove category, add timestamp types |
| `web/app/publisher/algorithm/page.tsx` | Delete complex sorting, use stable order |

---

## Breaking Changes (No Backwards Compatibility)

| Change | Impact |
|--------|--------|
| `name_english` → `english_name` | External API consumers must update |
| `name_hebrew` → `hebrew_name` | External API consumers must update |
| Remove `category` field | Code using `z.category` must use `z.time_category` |
| Consolidate location types | Response structure slightly different |
| Add `timestamp` field | New field in responses (additive, non-breaking) |

---

## Commands Reference

```bash
# Build backend
cd api && go build ./cmd/api

# Run backend tests
cd api && go test ./...

# Generate SQLc
cd api && sqlc generate

# Type check frontend
cd web && npm run type-check

# Run validation script
./scripts/validate-ordering-consolidation.sh

# Start services
./restart.sh
```
