# Zmanim Rounding Centralization Plan

**Created:** 2025-12-20
**Status:** Ready for Implementation
**Objective:** Centralize all time rounding logic in `unified_zmanim_service.go` and remove duplicate logic from client-side code and other services.

---

## Executive Summary

The audit revealed **duplicate rounding functions**, **inconsistent frontend handling**, and **zero test coverage** for rounding behavior. This plan consolidates all rounding logic into the UnifiedZmanimService, ensuring the API returns both exact and rounded times while eliminating client-side rounding decisions.

---

## GUARANTEE: Single Source of Truth

After implementing this plan, the following will be TRUE:

### Calculation Logic (Already Consolidated)
| Layer | Location | Responsibility |
|-------|----------|----------------|
| Primitives | `api/internal/astro/sun.go` | Sunrise, sunset, solar angles |
| Arithmetic | `api/internal/astro/times.go` | Add, subtract, midpoint, proportional hours |
| Execution | `api/internal/dsl/executor.go` | Parse and execute DSL formulas |
| Orchestration | `api/internal/services/unified_zmanim_service.go` | Entry point for all calculation |

**All paths lead through UnifiedZmanimService:**
- `GetZmanim()` → batch zmanim calculation
- `CalculateFormula()` → single formula preview
- `CalculateRange()` → multi-day calculation
- `CalculateForLocality()` → convenience wrapper

### Rounding Logic (To Be Consolidated)
| After | Location | Responsibility |
|-------|----------|----------------|
| ONLY | `api/internal/services/unified_zmanim_service.go` | `ApplyRounding()` - floor/math/ceil |
| NONE | `api/internal/handlers/*.go` | No rounding - use service |
| NONE | `web/lib/utils/*.ts` | No rounding - use API response |
| NONE | `web/components/**/*.tsx` | No rounding - display API values |

### Verification Commands (Post-Implementation)
```bash
# Should return ZERO results (except in unified_zmanim_service.go)
grep -rn "Truncate.*Minute\|\.Round(" api/internal/handlers/ --include="*.go"

# Should return ZERO results
grep -rn "startOf.*minute\|plus.*minutes.*1\|Math.round" web/lib/ --include="*.ts"

# Should return ONLY unified_zmanim_service.go
grep -rn "applyRounding" api/internal/ --include="*.go"
```

---

## CRITICAL BUG: Current Implementation Broken

**Symptoms observed in screenshots:**
1. **showSeconds=ON**: All times display with `:00` seconds (e.g., "6:54:00 AM" instead of "6:54:37 AM")
2. **showSeconds=OFF**: All times display "N/A"

**Root cause analysis needed:**
- Backend `ApplyRounding()` correctly returns exact time (HH:MM:SS) and rounded time (HH:MM)
- Handler copies these values to response
- Frontend `formatTimeTo12Hour()` expects HH:MM:SS format but receives HH:MM for `time_rounded`
- When parsing "06:54", `seconds` becomes `undefined`, causing display issues

**Priority:** Fix this bug BEFORE proceeding with consolidation work. The consolidation should fix this properly.

---

## Part 1: Audit Findings

### 1.1 Duplicate Backend Rounding Functions

| Function | Location | Lines | Status |
|----------|----------|-------|--------|
| `applyRounding()` | `api/internal/handlers/zmanim.go` | 438-459 | DUPLICATE - To be removed |
| `applyRoundingUnified()` | `api/internal/services/unified_zmanim_service.go` | 924-943 | PRIMARY - Keep & extend |

**Issue:** Two identical functions exist. Comment in unified service admits: "This is a copy of applyRounding from zmanim_calculation.go to avoid redeclaration"

### 1.2 Formula Preview API - Hardcoded Rounding

| Location | Issue |
|----------|-------|
| `api/internal/services/unified_zmanim_service.go:462` | Uses hardcoded `"math"` rounding mode |
| `FormulaResult` struct (line 252-257) | Only returns single `TimeFormatted` field |
| `ZmanTimePreview.tsx:97-113` | Performs client-side rounding on preview result |

**Issue:** The `CalculateFormula()` method (formula preview API) only returns one time format with hardcoded "math" rounding. Frontend then has to re-apply rounding based on user preferences. This should be consolidated so the API returns all formats.

### 1.2 Frontend Rounding Logic (Should NOT Exist)

| File | Function | Lines | Issue |
|------|----------|-------|-------|
| `web/lib/utils/time-format.ts` | `formatZmanTime()` | 31-73 | Performs client-side rounding |
| `web/lib/utils/time-format.ts` | `formatTimeString()` | 88-152 | Performs client-side rounding |
| `web/lib/utils.ts` | `formatTimeShort()` | 29-34 | Strips seconds WITHOUT rounding |

**Issue:** Frontend duplicates rounding logic that should come from API.

### 1.3 Components Correctly Using Backend-Rounded Times

| Component | Behavior | Status |
|-----------|----------|--------|
| `WeekPreview.tsx` | Uses `zman.time_rounded` when `!showSeconds` | CORRECT |
| `AlgorithmPreview.tsx` | Uses `zman.time_rounded` when `!showSeconds` | CORRECT |
| `publisher/algorithm/page.tsx` | Uses `zman.time_rounded` when `!showSeconds` | CORRECT |

### 1.4 Components With Issues

| Component | Issue | Fix Required |
|-----------|-------|--------------|
| `MonthPreview.tsx:256` | Displays `zman.time` directly without formatting | Use `formatTimeTo12Hour()` |
| `zmanim/[publisherId]/page.tsx:465` | Uses `formatTimeShort()` which strips seconds without rounding | Use `time_rounded` from API |
| `ZmanTimePreview.tsx:97-113` | Performs client-side rounding via `formatZmanTime()` | Use `time_rounded` from API |

### 1.5 Test Coverage Gaps

| Area | Coverage | Priority |
|------|----------|----------|
| `applyRounding()` / `applyRoundingUnified()` | NO TESTS | CRITICAL |
| `formatZmanTime()` / `formatTimeString()` | NO TESTS | HIGH |
| E2E rounding verification | NO TESTS | HIGH |
| Per-zman rounding mode persistence | NO TESTS | MEDIUM |

---

## Part 2: Target Architecture

### 2.1 Single Source of Truth

```
┌─────────────────────────────────────────────────────────────────┐
│                    UnifiedZmanimService                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ApplyRounding(t time.Time, mode string) (exact, rounded)│    │
│  │  - Returns BOTH exact time AND rounded time              │    │
│  │  - Respects per-zman rounding_mode from database         │    │
│  │  - Modes: floor, math (default), ceil                    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Response                                │
│  {                                                               │
│    "time": "06:42:37",           // Exact with seconds          │
│    "time_rounded": "06:43:00",   // Rounded per rounding_mode   │
│    "time_display": "06:43",      // NEW: Display-ready (no :00) │
│    "timestamp": 1703084557,      // Exact Unix seconds          │
│    "rounding_mode": "math"       // Applied mode                │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend                                    │
│  - NO rounding logic                                            │
│  - If showSeconds: display `time`                               │
│  - If !showSeconds: display `time_display`                      │
│  - Only format conversion (24h → 12h AM/PM)                     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 New API Response Fields

```go
type UnifiedZman struct {
    // Existing fields...
    Time        *string `json:"time,omitempty"`         // HH:MM:SS exact
    TimeRounded *string `json:"time_rounded,omitempty"` // HH:MM:SS rounded (keeps :00)
    TimeDisplay *string `json:"time_display,omitempty"` // HH:MM rounded (no seconds) - NEW
    Timestamp   *int64  `json:"timestamp,omitempty"`    // Unix exact
    RoundingMode string `json:"rounding_mode"`
}
```

---

## Part 3: Implementation Tasks

### Phase 1: Backend Consolidation

#### Task 1.1: Consolidate Rounding Function
**File:** `api/internal/services/unified_zmanim_service.go`
**Action:** Keep and enhance `applyRoundingUnified()`

```go
// ApplyRounding applies the specified rounding mode and returns both formats
// Returns: (exactHHMMSS, roundedHHMMSS, displayHHMM)
func ApplyRounding(t time.Time, mode string) (string, string, string) {
    exact := t.Format("15:04:05")

    var rounded time.Time
    switch mode {
    case "floor":
        rounded = t.Truncate(time.Minute)
    case "ceil":
        if t.Second() > 0 || t.Nanosecond() > 0 {
            rounded = t.Truncate(time.Minute).Add(time.Minute)
        } else {
            rounded = t
        }
    case "math":
        fallthrough
    default:
        if t.Second() >= 30 {
            rounded = t.Truncate(time.Minute).Add(time.Minute)
        } else {
            rounded = t.Truncate(time.Minute)
        }
    }

    roundedStr := rounded.Format("15:04:05")  // HH:MM:SS with :00
    displayStr := rounded.Format("15:04")      // HH:MM (no seconds)

    return exact, roundedStr, displayStr
}
```

**DoD:**
- [ ] Function returns 3 values: exact, rounded with :00, display without seconds
- [ ] All 3 rounding modes work correctly (floor, ceil, math)
- [ ] Nanosecond edge cases handled consistently
- [ ] Unit tests pass for all modes and edge cases

#### Task 1.2: Update UnifiedZman Struct
**File:** `api/internal/services/unified_zmanim_service.go`
**Lines:** 119-158

**DoD:**
- [ ] Add `TimeDisplay *string` field with JSON tag `time_display`
- [ ] Update struct documentation

#### Task 1.2b: Update FormulaResult Struct
**File:** `api/internal/services/unified_zmanim_service.go`
**Lines:** 252-257

**Current:**
```go
type FormulaResult struct {
    Time          time.Time
    TimeFormatted string    // Only returns one format with hardcoded "math"
    FromCache     bool
    Breakdown     []dsl.CalculationStep
}
```

**Change to:**
```go
type FormulaResult struct {
    Time        time.Time               // Exact time object
    TimeExact   string                  // HH:MM:SS exact (with seconds)
    TimeRounded string                  // HH:MM:SS rounded per rounding_mode
    TimeDisplay string                  // HH:MM rounded (no seconds, for display)
    FromCache   bool
    Breakdown   []dsl.CalculationStep
}
```

**DoD:**
- [ ] FormulaResult returns exact + rounded (per the zman's rounding_mode)
- [ ] Frontend picks `TimeExact` when showing seconds, `TimeDisplay` when hiding
- [ ] No client-side rounding needed for formula preview

#### Task 1.2c: Update CalculateFormula Method
**File:** `api/internal/services/unified_zmanim_service.go`
**Lines:** 438-470

**Change:** Accept `rounding_mode` parameter (from the zman being previewed), apply that mode.

**New signature:**
```go
func (s *UnifiedZmanimService) CalculateFormula(ctx context.Context, params FormulaParams) (*FormulaResult, error)

// FormulaParams should include:
type FormulaParams struct {
    // ... existing fields ...
    RoundingMode string  // The zman's rounding mode (floor/math/ceil)
}
```

**DoD:**
- [ ] `CalculateFormula()` accepts `RoundingMode` in params
- [ ] Applies the specified rounding mode (defaults to "math" if empty)
- [ ] Returns exact, rounded, and display versions
- [ ] Handler passes the zman's rounding_mode from the form/database

#### Task 1.3: Update Time Population Logic
**File:** `api/internal/services/unified_zmanim_service.go`
**Lines:** 783-801

**DoD:**
- [ ] Call new `ApplyRounding()` and populate all 3 time fields
- [ ] Per-zman `rounding_mode` correctly applied
- [ ] Default to "math" when mode is empty

#### Task 1.4: Remove Duplicate from Handlers
**File:** `api/internal/handlers/zmanim.go`
**Lines:** 438-459

**DoD:**
- [ ] Delete `applyRounding()` function
- [ ] Update candle lighting logic (line 511) to use service
- [ ] Update havdalah logic (line 543) to use service
- [ ] All handler tests pass

#### Task 1.5: Update publisher_zmanim.go
**File:** `api/internal/handlers/publisher_zmanim.go`
**Line:** 1057

**DoD:**
- [ ] Remove local `applyRounding()` call
- [ ] Use `TimeRounded` and `TimeDisplay` from service response
- [ ] Handler returns correct response structure

---

### Phase 2: Frontend Simplification

#### Task 2.1: Simplify time-format.ts
**File:** `web/lib/utils/time-format.ts`

**Changes:**
- Remove rounding logic from `formatZmanTime()` - should only format, not round
- Remove rounding logic from `formatTimeString()` - should only format, not round
- Keep `formatTimeTo12Hour()` as-is (format only)

**DoD:**
- [ ] `formatZmanTime()` only converts to 12-hour format
- [ ] `formatTimeString()` only converts to 12-hour format
- [ ] No rounding logic in any frontend function
- [ ] All components still work correctly

#### Task 2.2: Fix formatTimeShort
**File:** `web/lib/utils.ts`
**Lines:** 29-34

**Change:** Deprecate or remove. Components should use `time_display` from API.

**DoD:**
- [ ] Function deprecated with comment pointing to API field
- [ ] All usages replaced with API field

#### Task 2.3: Update ZmanTimePreview
**File:** `web/components/publisher/ZmanTimePreview.tsx`
**Lines:** 97-113

**Change:** Use `time_display` from API instead of client-side rounding.

**DoD:**
- [ ] Component uses API-provided `time_display` when hiding seconds
- [ ] Component uses API-provided `time` when showing seconds
- [ ] No client-side rounding logic

#### Task 2.4: Update MonthPreview
**File:** `web/components/publisher/MonthPreview.tsx`
**Line:** 256

**Change:** Use `formatTimeTo12Hour()` instead of raw time display.

**DoD:**
- [ ] Time displays in 12-hour format
- [ ] Respects `showSeconds` preference
- [ ] Uses correct API field (`time` or `time_display`)

#### Task 2.5: Update Public Zmanim Page
**File:** `web/app/zmanim/[localityId]/[publisherId]/page.tsx`
**Line:** 465

**Change:** Use `time_display` from API instead of `formatTimeShort()`.

**DoD:**
- [ ] Uses `zman.time_display` directly
- [ ] Only applies 12-hour conversion
- [ ] No seconds stripping logic

#### Task 2.6: Update TypeScript Types
**File:** Create or update `web/lib/types/zmanim.ts`

**DoD:**
- [ ] `ZmanWithTime` interface includes `time_display` field
- [ ] All API response types updated
- [ ] TypeScript compilation passes

---

### Phase 3: Testing - First Validation Phase

#### Task 3.1: Backend Unit Tests for Rounding
**File:** Create `api/internal/services/unified_zmanim_service_test.go`

**Test Cases:**
```go
func TestApplyRounding(t *testing.T) {
    tests := []struct {
        name     string
        time     time.Time
        mode     string
        wantExact string
        wantRounded string
        wantDisplay string
    }{
        // Floor mode tests
        {"floor_at_30", time.Date(2024, 1, 1, 6, 42, 30, 0, time.UTC), "floor", "06:42:30", "06:42:00", "06:42"},
        {"floor_at_59", time.Date(2024, 1, 1, 6, 42, 59, 0, time.UTC), "floor", "06:42:59", "06:42:00", "06:42"},

        // Ceil mode tests
        {"ceil_at_01", time.Date(2024, 1, 1, 6, 42, 1, 0, time.UTC), "ceil", "06:42:01", "06:43:00", "06:43"},
        {"ceil_at_00", time.Date(2024, 1, 1, 6, 42, 0, 0, time.UTC), "ceil", "06:42:00", "06:42:00", "06:42"},
        {"ceil_with_nanos", time.Date(2024, 1, 1, 6, 42, 0, 1, time.UTC), "ceil", "06:42:00", "06:43:00", "06:43"},

        // Math mode tests
        {"math_at_29", time.Date(2024, 1, 1, 6, 42, 29, 0, time.UTC), "math", "06:42:29", "06:42:00", "06:42"},
        {"math_at_30", time.Date(2024, 1, 1, 6, 42, 30, 0, time.UTC), "math", "06:42:30", "06:43:00", "06:43"},

        // Edge cases
        {"midnight", time.Date(2024, 1, 1, 0, 0, 30, 0, time.UTC), "math", "00:00:30", "00:01:00", "00:01"},
        {"end_of_day", time.Date(2024, 1, 1, 23, 59, 30, 0, time.UTC), "math", "23:59:30", "00:00:00", "00:00"},
        {"noon", time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC), "math", "12:00:00", "12:00:00", "12:00"},

        // Default mode
        {"empty_mode_defaults_to_math", time.Date(2024, 1, 1, 6, 42, 30, 0, time.UTC), "", "06:42:30", "06:43:00", "06:43"},
    }
    // ... test implementation
}
```

**DoD:**
- [ ] All floor mode tests pass
- [ ] All ceil mode tests pass
- [ ] All math mode tests pass
- [ ] Edge cases (midnight, noon, end of day) pass
- [ ] Nanosecond precision tests pass
- [ ] Default mode behavior tested

#### Task 3.2: API Integration Tests
**File:** `api/internal/handlers/zmanim_test.go` (create or update)

**Test Cases:**
- [ ] API returns all 3 time fields (`time`, `time_rounded`, `time_display`)
- [ ] Per-zman rounding mode correctly applied
- [ ] Different zmanim on same response have different rounding
- [ ] Cache returns correct pre-rounded values

**DoD:**
- [ ] Integration test verifies response structure
- [ ] Test with multiple rounding modes in same request
- [ ] Test cache behavior preserves rounding

#### Task 3.3: Frontend Unit Tests
**File:** Create `web/lib/utils/__tests__/time-format.test.ts`

**Test Cases:**
```typescript
describe('formatTimeTo12Hour', () => {
    // With seconds
    test('converts 06:42:30 to 6:42:30 AM', () => {});
    test('converts 18:42:30 to 6:42:30 PM', () => {});
    test('converts 00:00:00 to 12:00:00 AM', () => {});
    test('converts 12:00:00 to 12:00:00 PM', () => {});

    // Without seconds
    test('converts 06:42 to 6:42 AM', () => {});
    test('converts 18:42 to 6:42 PM', () => {});
});
```

**DoD:**
- [ ] All 12-hour conversion tests pass
- [ ] Midnight/noon edge cases pass
- [ ] AM/PM correctly assigned

---

### Phase 4: Testing - Second Validation Phase (E2E)

#### Task 4.1: E2E Rounding Verification
**File:** Create `tests/e2e/time-rounding.spec.ts`

**Test Scenarios:**
```typescript
test.describe('Time Rounding', () => {
    test('publisher floor rounding shows earlier time', async ({ page }) => {
        // Setup: Create zman with floor rounding
        // Action: View zman with seconds hidden
        // Assert: Time is rounded down
    });

    test('publisher ceil rounding shows later time', async ({ page }) => {
        // Setup: Create zman with ceil rounding
        // Action: View zman with seconds hidden
        // Assert: Time is rounded up
    });

    test('seconds toggle switches between exact and rounded', async ({ page }) => {
        // Action: Toggle seconds preference
        // Assert: Display updates correctly
    });

    test('different zmanim show different rounding modes', async ({ page }) => {
        // Setup: Page with floor and ceil zmanim
        // Assert: Each shows correct rounding
    });
});
```

**DoD:**
- [ ] Floor rounding E2E test passes
- [ ] Ceil rounding E2E test passes
- [ ] Math rounding E2E test passes
- [ ] Seconds toggle E2E test passes
- [ ] Mixed rounding modes on same page test passes

#### Task 4.2: Visual Regression Tests
**File:** Update existing E2E tests

**DoD:**
- [ ] Algorithm preview page shows correct times
- [ ] Week preview shows correct times
- [ ] Public zmanim page shows correct times
- [ ] No visual regressions in time display

#### Task 4.3: Cross-Browser Verification
**DoD:**
- [ ] Tests pass in Chrome
- [ ] Tests pass in Firefox
- [ ] Tests pass in Safari (if available)

---

## Part 4: Definition of Done (Complete Feature)

### Code Quality
- [ ] No duplicate rounding functions exist in codebase
- [ ] All rounding logic centralized in `unified_zmanim_service.go`
- [ ] Frontend performs NO rounding - only format conversion
- [ ] TypeScript types match API response structure
- [ ] No TODO/FIXME comments related to rounding

### Test Coverage
- [ ] Backend unit tests: 100% coverage for `ApplyRounding()`
- [ ] Backend integration tests: API response structure verified
- [ ] Frontend unit tests: Format conversion functions tested
- [ ] E2E tests: All rounding scenarios verified
- [ ] All tests pass in CI

### Documentation
- [ ] API response documentation updated with new `time_display` field
- [ ] Rounding behavior documented in code comments
- [ ] Story 8-34 marked as enhanced/completed

### Verification Checklist
- [ ] `grep -r "applyRounding" api/internal/handlers` returns NO results
- [ ] `grep -r "Truncate.*Minute\|Round.*Minute" web/` returns NO results (except test files)
- [ ] API returns all 3 time fields for every zman
- [ ] Seconds toggle works correctly in all views
- [ ] Per-zman rounding respects database `rounding_mode`

---

## Part 5: Files to Modify

### Backend (Go)

| File | Action | Priority |
|------|--------|----------|
| `api/internal/services/unified_zmanim_service.go` | Enhance rounding, add `TimeDisplay` | HIGH |
| `api/internal/handlers/zmanim.go` | Remove `applyRounding()`, update usage | HIGH |
| `api/internal/handlers/publisher_zmanim.go` | Update to use service response | HIGH |
| `api/internal/services/unified_zmanim_service_test.go` | Create with rounding tests | HIGH |

### Frontend (TypeScript)

| File | Action | Priority |
|------|--------|----------|
| `web/lib/utils/time-format.ts` | Remove rounding logic | HIGH |
| `web/lib/utils.ts` | Deprecate `formatTimeShort()` | MEDIUM |
| `web/components/publisher/ZmanTimePreview.tsx` | Use API `time_display` | HIGH |
| `web/components/publisher/MonthPreview.tsx` | Add proper formatting | MEDIUM |
| `web/app/zmanim/[localityId]/[publisherId]/page.tsx` | Use `time_display` | HIGH |
| `web/lib/types/zmanim.ts` | Add `time_display` to types | HIGH |
| `web/lib/utils/__tests__/time-format.test.ts` | Create unit tests | HIGH |

### Tests

| File | Action | Priority |
|------|--------|----------|
| `api/internal/services/unified_zmanim_service_test.go` | Create | HIGH |
| `api/internal/handlers/zmanim_test.go` | Add integration tests | HIGH |
| `tests/e2e/time-rounding.spec.ts` | Create E2E tests | HIGH |

---

## Part 6: Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing time displays | Medium | High | Comprehensive E2E tests before deploy |
| Cache invalidation needed | High | Low | Document cache clear requirement |
| Frontend/backend version mismatch | Medium | Medium | Deploy backend first, then frontend |
| Performance regression | Low | Medium | Benchmark rounding function |

---

## Part 7: Rollout Plan

1. **Phase 1 Complete:** Backend changes merged, API returns new field
2. **Canary Deploy:** Deploy to staging, verify all times correct
3. **Phase 2 Complete:** Frontend changes merged
4. **E2E Validation:** Run full E2E suite on staging
5. **Production Deploy:** Backend then frontend
6. **Monitor:** Watch for user reports of incorrect times

---

## Appendix: Current Rounding Implementation Reference

### Backend (Keep This Logic)
```go
switch mode {
case "floor":
    return t.Truncate(time.Minute).Format("15:04:05")
case "ceil":
    if t.Second() > 0 || t.Nanosecond() > 0 {
        return t.Truncate(time.Minute).Add(time.Minute).Format("15:04:05")
    }
    return t.Format("15:04:05")
case "math":
    fallthrough
default:
    if t.Second() >= 30 {
        return t.Truncate(time.Minute).Add(time.Minute).Format("15:04:05")
    }
    return t.Truncate(time.Minute).Format("15:04:05")
}
```

### Frontend (To Be Removed)
```typescript
// web/lib/utils/time-format.ts - Lines 51-71
// THIS LOGIC SHOULD BE REMOVED - Backend handles rounding
if (!showSeconds) {
    const seconds = time.second;
    switch (roundingMode) {
        case 'floor':
            // Already at minute, no change needed
            break;
        case 'ceil':
            if (seconds > 0) {
                time = time.plus({ minutes: 1 }).startOf('minute');
            }
            break;
        case 'math':
        default:
            if (seconds >= 30) {
                time = time.plus({ minutes: 1 }).startOf('minute');
            }
            break;
    }
}
```
