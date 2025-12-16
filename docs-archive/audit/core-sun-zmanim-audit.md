# Core Sun Zmanim Audit Report

**Date:** 2025-12-21
**Scope:** SUNRISE, SUNSET, and CHATZOS zmanim in master_zmanim_registry
**Auditor:** Claude Code

---

## Executive Summary

This audit reviewed all sunrise, sunset, and chatzos-related zmanim in the master_zmanim_registry to verify:
1. DSL formula syntax correctness
2. Proper use of primitive keywords vs. calculations
3. Distinction between sea-level and elevation-adjusted variants
4. Overall validation status

**Critical Finding:** The DSL executor currently does NOT use elevation when calculating the basic `sunrise`, `sunset`, and `solar_noon` primitives. All times are calculated at sea level (elevation=0), even though the ExecutionContext contains elevation data.

---

## Zmanim Inventory

### Database Query Results

```sql
SELECT mz.id, mz.zman_key, mz.canonical_english_name, mz.default_formula_dsl, tc.key as category
FROM master_zmanim_registry mz
LEFT JOIN time_categories tc ON mz.time_category_id = tc.id
WHERE mz.zman_key LIKE '%sunrise%' OR mz.zman_key LIKE '%netz%'
   OR mz.zman_key LIKE '%sunset%' OR mz.zman_key LIKE '%shkia%' OR mz.zman_key LIKE '%shekia%'
   OR mz.zman_key LIKE '%chatzos%' OR mz.zman_key LIKE '%noon%' OR mz.zman_key LIKE '%midday%'
ORDER BY mz.zman_key;
```

**Total Count:** 9 zmanim found

---

## Individual Zman Analysis

### 1. `chatzos` - Midday (Chatzos)
- **ID:** 3
- **Formula:** `solar_noon`
- **Category:** midday
- **Type:** Sea-level (elevation does NOT affect solar noon)
- **Formula Analysis:**
  - Uses primitive: `solar_noon`
  - Syntactically correct: YES
  - Semantically correct: YES
- **Elevation Handling:**
  - Sea-level: YES (solar noon is unaffected by elevation)
  - Elevation-adjusted: N/A (not applicable - solar noon is geometrically the same regardless of elevation)
- **Validation Status:** **PASS**
- **Notes:** Solar noon is the moment when the sun crosses the meridian. This is independent of elevation.

---

### 2. `chatzos_layla` - Midnight (Chatzos Layla)
- **ID:** 4
- **Formula:** `solar_noon + 12hr`
- **Category:** midnight
- **Type:** Sea-level (inherits from solar_noon)
- **Formula Analysis:**
  - Uses primitive: `solar_noon`
  - Arithmetic operation: `+ 12hr`
  - Syntactically correct: YES
  - Semantically correct: YES
- **Elevation Handling:**
  - Sea-level: YES (solar noon is unaffected by elevation)
  - Elevation-adjusted: N/A (not applicable)
- **Validation Status:** **PASS**
- **Notes:** Solar midnight is 12 hours after solar noon. Also independent of elevation.

---

### 3. `fast_begins_sunset` - Fast Begins (Sunset)
- **ID:** 55
- **Formula:** `sunset`
- **Category:** sunset
- **Type:** Currently sea-level ONLY (BUG)
- **Formula Analysis:**
  - Uses primitive: `sunset`
  - Syntactically correct: YES
  - Semantically correct: YES (but see elevation issue)
- **Elevation Handling:**
  - Sea-level: YES (but ALWAYS, even when elevation is provided)
  - Elevation-adjusted: NO - **CRITICAL ISSUE**
- **Validation Status:** **NEEDS_REVIEW**
- **Issues Found:**
  1. **CRITICAL:** The DSL executor's `getSunTimes()` method calls `astro.CalculateSunTimes()` which defaults elevation to 0
  2. Even when ExecutionContext contains elevation data, it is ignored for primitives
  3. Should use `astro.CalculateSunTimesWithElevation()` instead
- **Recommended Fix:**
  - Update `dsl/executor.go` line 47 to use elevation from context:
    ```go
    ctx.sunTimes = astro.CalculateSunTimesWithElevation(ctx.Date, ctx.Latitude, ctx.Longitude, ctx.Elevation, ctx.Timezone)
    ```

---

### 4. `fixed_local_chatzos` - Fixed Local Chatzos
- **ID:** 59
- **Formula:** `12:00`
- **Category:** midday
- **Type:** Fixed time (not astronomical)
- **Formula Analysis:**
  - Uses fixed time literal: `12:00`
  - Syntactically correct: YES
  - Semantically correct: YES
- **Elevation Handling:**
  - Sea-level: N/A (fixed time, not astronomical)
  - Elevation-adjusted: N/A
- **Validation Status:** **PASS**
- **Notes:** This is a fixed clock time (12:00 noon local time), not an astronomical calculation. Used in some opinions as a simplified chatzos.

---

### 5. `shkia_amitis` - True Sunset
- **ID:** 95
- **Formula:** `sunset`
- **Category:** sunset
- **Type:** Currently sea-level ONLY (BUG)
- **Formula Analysis:**
  - Uses primitive: `sunset`
  - Syntactically correct: YES
  - Semantically correct: YES (but see elevation issue)
- **Elevation Handling:**
  - Sea-level: YES (but ALWAYS, even when elevation is provided)
  - Elevation-adjusted: NO - **CRITICAL ISSUE**
- **Validation Status:** **NEEDS_REVIEW**
- **Issues Found:**
  1. **CRITICAL:** Same as `fast_begins_sunset` - elevation is ignored
  2. The name "True Sunset" (shkia amitis) suggests this should be precise
  3. Without elevation adjustment, this is NOT truly accurate for elevated locations
- **Recommended Fix:** Same as #3 above

---

### 6. `sunrise` - Sunrise
- **ID:** 15
- **Formula:** `sunrise`
- **Category:** sunrise
- **Type:** Currently sea-level ONLY (BUG)
- **Formula Analysis:**
  - Uses primitive: `sunrise`
  - Syntactically correct: YES
  - Semantically correct: YES (but see elevation issue)
- **Elevation Handling:**
  - Sea-level: YES (but ALWAYS, even when elevation is provided)
  - Elevation-adjusted: NO - **CRITICAL ISSUE**
- **Validation Status:** **NEEDS_REVIEW**
- **Issues Found:**
  1. **CRITICAL:** The basic sunrise primitive ignores elevation
  2. This affects all zmanim that depend on sunrise
  3. Higher elevations should see sunrise earlier than sea level
- **Recommended Fix:** Same as #3 above
- **Impact:** This is a foundational zman - fixing it will improve accuracy for many dependent zmanim (e.g., sof zman shma GRA, sof zman tefila, etc.)

---

### 7. `sunset` - Sunset
- **ID:** 16
- **Formula:** `sunset`
- **Category:** sunset
- **Type:** Currently sea-level ONLY (BUG)
- **Formula Analysis:**
  - Uses primitive: `sunset`
  - Syntactically correct: YES
  - Semantically correct: YES (but see elevation issue)
- **Elevation Handling:**
  - Sea-level: YES (but ALWAYS, even when elevation is provided)
  - Elevation-adjusted: NO - **CRITICAL ISSUE**
- **Validation Status:** **NEEDS_REVIEW**
- **Issues Found:**
  1. **CRITICAL:** The basic sunset primitive ignores elevation
  2. This affects all zmanim that depend on sunset
  3. Higher elevations should see sunset later than sea level
- **Recommended Fix:** Same as #3 above
- **Impact:** This is a foundational zman - fixing it will improve accuracy for many dependent zmanim

---

### 8. `visible_sunrise` - Visible Sunrise
- **ID:** 171
- **Formula:** `visible_sunrise`
- **Category:** sunrise
- **Type:** Currently sea-level ONLY (BUG)
- **Formula Analysis:**
  - Uses primitive: `visible_sunrise`
  - Syntactically correct: YES
  - Semantically correct: YES (but see elevation issue)
- **Elevation Handling:**
  - Sea-level: YES (but ALWAYS, even when elevation is provided)
  - Elevation-adjusted: NO - **CRITICAL ISSUE**
- **Validation Status:** **NEEDS_REVIEW**
- **Issues Found:**
  1. **CRITICAL:** Same elevation issue as basic `sunrise`
  2. The executor code (line 226-228) notes that visible_sunrise accounts for atmospheric refraction (~0.833°)
  3. The comment states "This is already included in the standard sunrise calculation"
  4. Currently implemented as an alias to `sunrise`: `t = st.Sunrise`
- **Notes:**
  - The standard sunrise calculation DOES include atmospheric refraction (90.833° zenith angle)
  - However, elevation is still not being applied
  - The distinction between `sunrise` and `visible_sunrise` is unclear in the current implementation

---

### 9. `visible_sunset` - Visible Sunset
- **ID:** 172
- **Formula:** `visible_sunset`
- **Category:** sunset
- **Type:** Currently sea-level ONLY (BUG)
- **Formula Analysis:**
  - Uses primitive: `visible_sunset`
  - Syntactically correct: YES
  - Semantically correct: YES (but see elevation issue)
- **Elevation Handling:**
  - Sea-level: YES (but ALWAYS, even when elevation is provided)
  - Elevation-adjusted: NO - **CRITICAL ISSUE**
- **Validation Status:** **NEEDS_REVIEW**
- **Issues Found:**
  1. **CRITICAL:** Same elevation issue as basic `sunset`
  2. Currently implemented as an alias to `sunset`: `t = st.Sunset`
- **Notes:**
  - Same considerations as `visible_sunrise`
  - The distinction between `sunset` and `visible_sunset` is unclear

---

## DSL Implementation Analysis

### Primitives Support
From `/home/daniel/repos/zmanim/api/internal/dsl/token.go`:

```go
var Primitives = map[string]bool{
    "sunrise":           true,
    "sunset":            true,
    "solar_noon":        true,
    "solar_midnight":    true,
    "visible_sunrise":   true,
    "visible_sunset":    true,
    "civil_dawn":        true,
    "civil_dusk":        true,
    "nautical_dawn":     true,
    "nautical_dusk":     true,
    "astronomical_dawn": true,
    "astronomical_dusk": true,
}
```

**Finding:** All primitives are correctly defined and recognized by the validator.

### Executor Implementation

#### Current Code (BUGGY)
`/home/daniel/repos/zmanim/api/internal/dsl/executor.go` line 44-50:

```go
// getSunTimes lazily computes and caches sun times
func (ctx *ExecutionContext) getSunTimes() *astro.SunTimes {
    if ctx.sunTimes == nil {
        ctx.sunTimes = astro.CalculateSunTimes(ctx.Date, ctx.Latitude, ctx.Longitude, ctx.Timezone)
    }
    return ctx.sunTimes
}
```

**Problem:** Line 47 calls `CalculateSunTimes()` which defaults elevation to 0.

#### Available Function
`/home/daniel/repos/zmanim/api/internal/astro/sun.go` line 54:

```go
func CalculateSunTimesWithElevation(date time.Time, latitude, longitude, elevation float64, tz *time.Location) *SunTimes
```

**This function exists and properly handles elevation!**

### Solar Angle Functions

The executor DOES correctly use elevation for solar angle calculations:

#### `solar()` function (lines 285-344)
- Calls `astro.SunTimeAtAngle()` which defaults to elevation=0
- **Issue:** Should call `SunTimeAtAngleWithElevation()` instead

#### `proportional_hours()` with angle-based variants (e.g., mga_16_1, mga_18)
- Lines 492-540: **CORRECTLY** uses `SunTimeAtAngleWithElevation()` with `e.ctx.Elevation`
- **Good:** These calculations ARE elevation-adjusted

---

## Critical Findings Summary

### 1. CRITICAL: Primitives Ignore Elevation

**Affected Zmanim:**
- `sunrise` (ID 15)
- `sunset` (ID 16)
- `visible_sunrise` (ID 171)
- `visible_sunset` (ID 172)
- `fast_begins_sunset` (ID 55)
- `shkia_amitis` (ID 95)

**Root Cause:**
`dsl/executor.go` line 47 uses `astro.CalculateSunTimes()` instead of `astro.CalculateSunTimesWithElevation()`

**Impact:**
- High - affects all basic sunrise/sunset times
- Cascading - affects all dependent zmanim (GRA-based calculations, time-based offsets, etc.)
- Accuracy - elevations can cause 1-4 minutes difference (varies by elevation and latitude)

**Fix Required:**
```go
// Current (WRONG)
ctx.sunTimes = astro.CalculateSunTimes(ctx.Date, ctx.Latitude, ctx.Longitude, ctx.Timezone)

// Should be
ctx.sunTimes = astro.CalculateSunTimesWithElevation(ctx.Date, ctx.Latitude, ctx.Longitude, ctx.Elevation, ctx.Timezone)
```

### 2. CRITICAL: solar() Function Ignores Elevation

**Root Cause:**
`dsl/executor.go` line 313 uses `astro.SunTimeAtAngle()` instead of `astro.SunTimeAtAngleWithElevation()`

**Impact:**
- Medium-High - affects all custom solar angle calculations
- All zmanim using `solar(degrees, direction)` in their formulas

**Fix Required:**
```go
// Current (WRONG)
dawn, dusk := astro.SunTimeAtAngle(e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Timezone, degrees)

// Should be
dawn, dusk := astro.SunTimeAtAngleWithElevation(e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Elevation, e.ctx.Timezone, degrees)
```

### 3. MEDIUM: seasonal_solar() Function Ignores Elevation

**Root Cause:**
`dsl/executor.go` line 377 uses `astro.SeasonalSunTimeAtAngle()` instead of `astro.SeasonalSunTimeAtAngleWithElevation()`

**Impact:**
- Medium - affects seasonal/proportional calculations (ROY method)
- Less commonly used than basic solar()

**Fix Required:**
```go
// Current (WRONG)
dawn, dusk := astro.SeasonalSunTimeAtAngle(e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Timezone, degrees)

// Should be
dawn, dusk := astro.SeasonalSunTimeAtAngleWithElevation(e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Elevation, e.ctx.Timezone, degrees)
```

### 4. INFO: civil_dawn/dusk, nautical_dawn/dusk, astronomical_dawn/dusk

**Current Implementation:**
These primitives are implemented in `executePrimitive()` (lines 232-249) using:
```go
case "civil_dawn":
    // Sun at -6° below horizon (morning)
    t, _ = astro.SunTimeAtAngle(e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Timezone, 6)
```

**Issue:** Same as solar() function - elevation not used

**Impact:** Low-Medium - these are standard twilight times, less commonly used in Jewish zmanim

---

## Validation Status Summary

| Zman Key | ID | Formula | Syntax | Semantics | Elevation | Status |
|----------|----|---------|---------|-----------|-----------|----|
| chatzos | 3 | `solar_noon` | PASS | PASS | N/A | **PASS** |
| chatzos_layla | 4 | `solar_noon + 12hr` | PASS | PASS | N/A | **PASS** |
| fast_begins_sunset | 55 | `sunset` | PASS | PASS | BUG | **NEEDS_REVIEW** |
| fixed_local_chatzos | 59 | `12:00` | PASS | PASS | N/A | **PASS** |
| shkia_amitis | 95 | `sunset` | PASS | PASS | BUG | **NEEDS_REVIEW** |
| sunrise | 15 | `sunrise` | PASS | PASS | BUG | **NEEDS_REVIEW** |
| sunset | 16 | `sunset` | PASS | PASS | BUG | **NEEDS_REVIEW** |
| visible_sunrise | 171 | `visible_sunrise` | PASS | PASS | BUG | **NEEDS_REVIEW** |
| visible_sunset | 172 | `visible_sunset` | PASS | PASS | BUG | **NEEDS_REVIEW** |

**Overall:**
- 2/9 PASS (22%)
- 7/9 NEEDS_REVIEW (78%) - all due to elevation handling bug

---

## Recommendations

### Immediate Actions Required

1. **Fix Primitive Elevation Handling** (CRITICAL)
   - File: `/home/daniel/repos/zmanim/api/internal/dsl/executor.go`
   - Line: 47
   - Change: Use `CalculateSunTimesWithElevation()` instead of `CalculateSunTimes()`

2. **Fix solar() Function Elevation** (CRITICAL)
   - File: `/home/daniel/repos/zmanim/api/internal/dsl/executor.go`
   - Line: 313
   - Change: Use `SunTimeAtAngleWithElevation()` instead of `SunTimeAtAngle()`

3. **Fix seasonal_solar() Function Elevation** (MEDIUM)
   - File: `/home/daniel/repos/zmanim/api/internal/dsl/executor.go`
   - Line: 377
   - Change: Use `SeasonalSunTimeAtAngleWithElevation()` instead of `SeasonalSunTimeAtAngle()`

4. **Fix twilight primitives** (MEDIUM)
   - File: `/home/daniel/repos/zmanim/api/internal/dsl/executor.go`
   - Lines: 232-249
   - Change: Use `SunTimeAtAngleWithElevation()` for all twilight calculations

### Documentation Improvements

1. **Clarify visible_sunrise vs sunrise**
   - Current implementation treats them identically
   - Consider if distinction is needed (e.g., different refraction models)
   - Document the rationale

2. **Add Elevation Test Cases**
   - Create test cases that verify elevation adjustments
   - Test at various elevations (0m, 100m, 500m, 1000m, 2000m)
   - Compare against known reference values

3. **Update Master Registry Descriptions**
   - Once elevation is properly implemented, verify all descriptions
   - Ensure they clearly state whether elevation-adjusted or sea-level

### Future Enhancements

1. **Consider Separate Sea-Level Variants**
   - Some halachic opinions may prefer sea-level calculations
   - Could create explicit `sunrise_sea_level` vs `sunrise` (elevation-adjusted)
   - Would allow publishers to choose

2. **Validation Enhancement**
   - Add validator warning for formulas that might need elevation consideration
   - Flag potential inconsistencies (e.g., mixing elevation-adjusted and sea-level times)

---

## Test Plan

Once fixes are implemented, verify with:

1. **Unit Tests**
   - Test `getSunTimes()` with various elevations
   - Verify sunrise/sunset times differ appropriately by elevation
   - Example: Jerusalem at 800m elevation should have sunrise ~2 min earlier than sea level

2. **Integration Tests**
   - Test full zmanim calculation with elevation
   - Compare against KosherJava reference implementation
   - Verify dependent zmanim (e.g., sof zman shma) adjust correctly

3. **Regression Tests**
   - Ensure sea-level calculations (elevation=0) produce same results as before
   - Verify backward compatibility

---

## Conclusion

**Syntax Validation:** All 9 zmanim have syntactically correct DSL formulas.

**Semantic Validation:** All 9 zmanim are semantically correct in their DSL usage.

**Critical Issue:** The DSL executor has a systemic bug where elevation is ignored for:
- Basic primitives (sunrise, sunset, solar_noon - though solar_noon is unaffected by elevation anyway)
- The `solar()` DSL function
- The `seasonal_solar()` DSL function
- Twilight primitives (civil, nautical, astronomical)

**Impact:** This affects accuracy for all locations with significant elevation. The magnitude depends on elevation - at 1000m, sunrise can be ~3 minutes earlier than sea level.

**Fix Complexity:** LOW - The fix is straightforward (4 lines of code changed). The infrastructure (`CalculateSunTimesWithElevation`, etc.) already exists and is working correctly.

**Priority:** CRITICAL - This affects core foundational zmanim and has cascading effects on dependent calculations.

---

## Appendix A: Code Locations

### Files Analyzed
- `/home/daniel/repos/zmanim/api/internal/dsl/validator.go` - DSL validation logic
- `/home/daniel/repos/zmanim/api/internal/dsl/executor.go` - DSL execution engine
- `/home/daniel/repos/zmanim/api/internal/dsl/token.go` - Primitive definitions
- `/home/daniel/repos/zmanim/api/internal/astro/sun.go` - Astronomical calculations

### Key Functions
- `dsl.getSunTimes()` - Line 44 (executor.go)
- `dsl.executePrimitive()` - Line 210 (executor.go)
- `dsl.executeSolar()` - Line 285 (executor.go)
- `dsl.executeSeasonalSolar()` - Line 350 (executor.go)
- `astro.CalculateSunTimes()` - Line 47 (sun.go)
- `astro.CalculateSunTimesWithElevation()` - Line 54 (sun.go)
- `astro.SunTimeAtAngle()` - Line 90 (sun.go)
- `astro.SunTimeAtAngleWithElevation()` - Line 96 (sun.go)

---

**Report End**
