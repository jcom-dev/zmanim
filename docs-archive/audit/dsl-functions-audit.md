# DSL Functions Audit Report

**Date:** 2025-12-21
**Auditor:** Claude (via automated analysis)
**Purpose:** Verify DSL implementation supports all required functions for the zmanim registry

---

## Executive Summary

**Status:** CRITICAL GAPS IDENTIFIED

The DSL implementation has **2 missing functions** that are actively used in the master zmanim registry:
- `proportional_minutes()` - used in 8 formulas
- `shaah_zmanis()` - used in 2 formulas

These missing functions will cause **10 zmanim calculations to fail** (5.8% of all DSL formulas).

---

## 1. DSL Functions: Defined vs. Used

### 1.1 Functions Defined in DSL (token.go)

The `Functions` map in `/home/daniel/repos/zmanim/api/internal/dsl/token.go` (lines 173-179) defines:

```go
var Functions = map[string]bool{
    "solar":              true,
    "seasonal_solar":     true,
    "proportional_hours": true,
    "midpoint":           true,
    "coalesce":           true,
}
```

### 1.2 Functions Used in Master Zmanim Registry

Database query results show the following function usage across 172 DSL formulas:

| Function | Count | Status | Implementation |
|----------|-------|--------|----------------|
| `solar()` | 46 | IMPLEMENTED | executor.go:269-344 |
| `proportional_hours()` | 63 | IMPLEMENTED | executor.go:403-581 |
| `proportional_minutes()` | **8** | **MISSING** | Not implemented |
| `shaah_zmanis()` | **2** | **MISSING** | Not implemented |
| `custom()` (base arg) | 1 | IMPLEMENTED | executor.go:558-569 |
| `seasonal_solar()` | 0 | IMPLEMENTED | executor.go:346-400 |
| `midpoint()` | 0 | IMPLEMENTED | executor.go:584-605 |
| `coalesce()` | 0 | IMPLEMENTED | executor.go:918-961 |

---

## 2. Missing Functions Analysis

### 2.1 `proportional_minutes()` - CRITICAL GAP

**Used in 8 formulas:**

```sql
SELECT zman_key, default_formula_dsl
FROM master_zmanim_registry
WHERE default_formula_dsl LIKE '%proportional_minutes%'
```

**Results:**
| Zman Key | Formula |
|----------|---------|
| `alos_72_zmanis` | `proportional_minutes(72, before_sunrise)` |
| `alos_90_zmanis` | `proportional_minutes(90, before_sunrise)` |
| `alos_96_zmanis` | `proportional_minutes(96, before_sunrise)` |
| `alos_120_zmanis` | `proportional_minutes(120, before_sunrise)` |
| `tzais_72_zmanis` | `proportional_minutes(72, after_sunset)` |
| `tzais_90_zmanis` | `proportional_minutes(90, after_sunset)` |
| `tzais_96_zmanis` | `proportional_minutes(96, after_sunset)` |
| `tzais_120_zmanis` | `proportional_minutes(120, after_sunset)` |

**Expected Behavior:**

`proportional_minutes(minutes, direction)` should calculate a time offset as a fraction of the day length, similar to zmaniyos (proportional) minutes in halakhic calculations.

**Signature:**
```go
proportional_minutes(minutes: number, direction: "before_sunrise" | "after_sunset") -> Time
```

**Algorithm (inferred from KosherJava):**
1. Calculate day length (sunrise to sunset)
2. Determine the proportional offset: `(minutes / 720) * day_length`
   - 720 minutes = 12 hours (equinox day)
3. Apply offset before sunrise or after sunset based on direction

**Example:**
- Day length: 14 hours (840 minutes)
- `proportional_minutes(72, before_sunrise)`
- Offset = (72/720) × 840 = 84 minutes
- Result = sunrise - 84min

---

### 2.2 `shaah_zmanis()` - MODERATE GAP

**Used in 2 formulas:**

| Zman Key | Formula |
|----------|---------|
| `shaah_zmanis_gra` | `shaah_zmanis(gra)` |
| `shaah_zmanis_mga` | `shaah_zmanis(mga)` |

**Expected Behavior:**

`shaah_zmanis(base)` should return the duration of one proportional hour (1/12th of the defined day) as a **Duration value**, not a Time value.

**Signature:**
```go
shaah_zmanis(base: BaseNode) -> Duration
```

**Algorithm:**
1. Determine day boundaries based on `base` (same logic as `proportional_hours`)
2. Calculate day length = end - start
3. Return duration = day_length / 12

**Example:**
- `shaah_zmanis(gra)` with day length 12h 30min (750 min)
- Result = 750/12 = 62.5 minutes (Duration)

**Key Difference from `proportional_hours`:**
- `proportional_hours(3, gra)` returns a **Time** (3 hours into the day)
- `shaah_zmanis(gra)` returns a **Duration** (length of 1/12th of the day)

---

## 3. Implemented Functions Status

### 3.1 Actively Used Functions

#### `solar(degrees, direction)` - 46 uses
**Implementation:** executor.go:269-344
**Status:** WORKING
**Test Coverage:** Extensive

**Common Use Cases:**
- `solar(16.1, before_sunrise)` - Alos Hashachar (MGA)
- `solar(8.5, after_sunset)` - Tzais Hakochavim
- `solar(11.5, before_sunrise)` - Misheyakir

---

#### `proportional_hours(hours, base)` - 63 uses
**Implementation:** executor.go:403-581
**Status:** WORKING
**Test Coverage:** Extensive

**Supported Bases:** (lines 191-217 in token.go)
- Fixed-minute MGA variants: `mga`, `mga_60`, `mga_72`, `mga_90`, `mga_96`, `mga_120`
- Zmaniyos (proportional) MGA: `mga_72_zmanis`, `mga_90_zmanis`, `mga_96_zmanis`
- Solar angle MGA: `mga_16_1`, `mga_18`, `mga_19_8`, `mga_26`
- `gra` - GRA (sunrise to sunset)
- `baal_hatanya` - Baal HaTanya (1.583° zenith)
- `custom(start, end)` - user-defined boundaries

**Common Use Cases:**
- `proportional_hours(3, gra)` - Shma GRA
- `proportional_hours(4, mga)` - Tefila MGA
- `proportional_hours(10.75, gra)` - Plag Hamincha

---

### 3.2 Implemented But Unused Functions

#### `seasonal_solar(degrees, direction)` - 0 uses
**Implementation:** executor.go:346-400
**Status:** IMPLEMENTED (ROY/Zemaneh-Yosef method)
**Purpose:** Proportional solar angle calculation (scales by day length ratio)

**Note:** This function is ready for use but not yet referenced in the registry. It provides an alternative solar angle calculation method used by Rabbi Ovadia Yosef's calculations.

---

#### `midpoint(time1, time2)` - 0 uses
**Implementation:** executor.go:584-605
**Status:** IMPLEMENTED
**Purpose:** Calculate the midpoint between two times

**Note:** Ready for use but not currently needed in registry formulas.

---

#### `coalesce(expr1, expr2, ...)` - 0 uses
**Implementation:** executor.go:918-961
**Status:** IMPLEMENTED
**Purpose:** Fallback mechanism - returns first non-null/non-error value

**Note:** Useful for polar regions where some calculations may fail. Not yet used but available.

---

## 4. Validation and Executor Alignment

### 4.1 Validator Coverage (validator.go)

The validator has specific validation functions for:
- `solar()` - validateSolarFunction (lines 144-181)
- `seasonal_solar()` - validateSeasonalSolarFunction (lines 183-221)
- `proportional_hours()` - validateProportionalHoursFunction (lines 223-249)
- `midpoint()` - validateMidpointFunction (lines 251-266)

**Missing validators:**
- `proportional_minutes()` - NOT VALIDATED
- `shaah_zmanis()` - NOT VALIDATED

---

### 4.2 Executor Function Dispatch (executor.go:266-283)

```go
func (e *Executor) executeFunction(n *FunctionNode) Value {
    switch n.Name {
    case "solar":
        return e.executeSolar(n)
    case "seasonal_solar":
        return e.executeSeasonalSolar(n)
    case "proportional_hours":
        return e.executeProportionalHours(n)
    case "midpoint":
        return e.executeMidpoint(n)
    case "coalesce":
        return e.executeCoalesce(n)
    default:
        e.addError("unknown function: %s", n.Name)
        return Value{}
    }
}
```

**Missing cases:**
- `proportional_minutes` - will trigger "unknown function" error
- `shaah_zmanis` - will trigger "unknown function" error

---

## 5. Impact Assessment

### 5.1 Broken Zmanim

**Total DSL formulas:** 172
**Broken formulas:** 10 (5.8%)

**Broken zmanim list:**
1. `alos_72_zmanis`
2. `alos_90_zmanis`
3. `alos_96_zmanis`
4. `alos_120_zmanis`
5. `tzais_72_zmanis`
6. `tzais_90_zmanis`
7. `tzais_96_zmanis`
8. `tzais_120_zmanis`
9. `shaah_zmanis_gra`
10. `shaah_zmanis_mga`

### 5.2 User Impact

**Severity:** HIGH

These are commonly used zmanim in Orthodox Jewish practice:
- `alos_72_zmanis` / `tzais_72_zmanis` - MGA zmaniyos minutes (widely used)
- `shaah_zmanis_gra` / `shaah_zmanis_mga` - Fundamental for calculating all proportional times

**Current Behavior:**
- Parser may accept the formula (if function name is recognized)
- Executor will fail with "unknown function" error
- API will return HTTP 500 or null time for these zmanim

---

## 6. Recommendations

### 6.1 CRITICAL: Implement Missing Functions

**Priority 1: `proportional_minutes()`**

Add to token.go:
```go
var Functions = map[string]bool{
    // ... existing ...
    "proportional_minutes": true,
}
```

Add validator function in validator.go:
```go
func (v *Validator) validateProportionalMinutesFunction(n *FunctionNode) {
    if len(n.Args) != 2 {
        v.addError(n.Pos, "proportional_minutes() requires 2 arguments (minutes, direction), got %d", len(n.Args))
        return
    }
    // Validate minutes (positive number)
    // Validate direction (before_sunrise or after_sunset)
}
```

Add executor function in executor.go:
```go
func (e *Executor) executeProportionalMinutes(n *FunctionNode) Value {
    // 1. Get minutes argument
    // 2. Get direction argument
    // 3. Calculate day length
    // 4. Calculate proportional offset: (minutes / 720) * day_length
    // 5. Apply offset before sunrise or after sunset
    // 6. Return Time value
}
```

**Priority 2: `shaah_zmanis()`**

Similar implementation but returns **Duration** instead of **Time**.

---

### 6.2 Testing Requirements

**Unit Tests Needed:**
1. Test `proportional_minutes()` with various day lengths
2. Test `shaah_zmanis()` returns correct Duration
3. Test edge cases (polar regions, equinox, solstices)
4. Validate against KosherJava reference implementation

**Integration Tests:**
1. Verify all 10 broken zmanim calculate correctly
2. Test dependency chains (other zmanim may reference these)

---

### 6.3 Documentation Updates

1. Update DSL documentation to include new functions
2. Add function examples to API docs
3. Update Swagger annotations if zmanim endpoints expose these

---

## 7. Technical Notes

### 7.1 Proportional Minutes Algorithm

Based on KosherJava `getZmanisBasedOffset()`:

```
offset_minutes = (requested_minutes / 720) × day_length_minutes

where:
- 720 = 12 hours (standard equinox day)
- day_length = sunset - sunrise
```

**Key Implementation Details:**
- Must handle day lengths > 12h and < 12h
- Offset scales proportionally with day length
- Common values: 72, 90, 96, 120 minutes

---

### 7.2 Shaah Zmanis Algorithm

```
shaah_zmanis = (day_end - day_start) / 12

where:
- day_start/day_end determined by base (gra, mga, etc.)
- Returns Duration, not Time
```

**Key Implementation Details:**
- Reuse existing base resolution logic from `proportional_hours()`
- Return type must be Duration (not Time)
- Used as building block for other calculations

---

## 8. Related Files

### DSL Core
- `/home/daniel/repos/zmanim/api/internal/dsl/token.go` - Function registry
- `/home/daniel/repos/zmanim/api/internal/dsl/executor.go` - Function execution
- `/home/daniel/repos/zmanim/api/internal/dsl/validator.go` - Function validation
- `/home/daniel/repos/zmanim/api/internal/dsl/ast.go` - AST node definitions

### Database
- `master_zmanim_registry` table - Stores DSL formulas

### Tests
- `/home/daniel/repos/zmanim/api/internal/dsl/*_test.go` - Unit tests

---

## 9. Conclusion

The DSL implementation is **95% complete** but has **2 critical gaps** affecting 10 zmanim calculations. Implementing `proportional_minutes()` and `shaah_zmanis()` will bring the DSL to 100% coverage of the master zmanim registry.

**Estimated Implementation Effort:**
- `proportional_minutes()`: 2-3 hours (similar to existing proportional logic)
- `shaah_zmanis()`: 1-2 hours (simpler, reuses existing base logic)
- Testing: 2-3 hours
- **Total:** 5-8 hours

**Risk:** HIGH - These zmanim are commonly used. Users may encounter errors when requesting these specific times.

**Next Steps:**
1. Implement `proportional_minutes()` function
2. Implement `shaah_zmanis()` function
3. Add comprehensive tests
4. Verify against KosherJava reference implementation
5. Deploy and validate in production

---

**End of Audit Report**
