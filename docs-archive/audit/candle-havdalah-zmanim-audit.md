# Candle Lighting and Havdalah Zmanim Audit

**Date:** 2025-12-21
**Auditor:** System Audit
**Database:** master_zmanim_registry
**Purpose:** Verify DSL formulas, standard values, and correctness of candle lighting and havdalah times

---

## Executive Summary

This audit examined **12 zmanim** related to Shabbat candle lighting and havdalah in the `master_zmanim_registry` table. All formulas are **syntactically valid** according to the DSL parser specification. Standard halachic values are properly represented.

**Key Findings:**
- ✅ All DSL formulas are syntactically correct
- ✅ Candle lighting formulas correctly subtract from sunset
- ✅ Havdalah/Shabbos ends formulas correctly add to sunset or use solar degrees
- ⚠️ One potential issue: `havdalah` default uses 42min instead of the more common 8.5° degree-based calculation
- ✅ Standard offset values are properly represented (15, 18, 20, 22, 30, 40, 42, 50, 72 minutes)
- ✅ Solar degree calculation for tzais (8.5°) is properly implemented

---

## Detailed Audit Results

### 1. Candle Lighting Zmanim

These zmanim represent when to light Shabbat candles before sunset.

| ID | Zman Key | English Name | Formula | Offset | Validation | Notes |
|----|----------|--------------|---------|--------|------------|-------|
| 2 | `candle_lighting` | Candle Lighting | `sunset - 18min` | 18 min | **PASS** | Default/standard candle lighting time |
| 46 | `candle_lighting_15` | Candle Lighting (15 min) | `sunset - 15min` | 15 min | **PASS** | Earlier lighting custom |
| 47 | `candle_lighting_18` | Candle Lighting (18 min) | `sunset - 18min` | 18 min | **PASS** | Standard practice (duplicate of ID 2) |
| 48 | `candle_lighting_20` | Candle Lighting (20 min) | `sunset - 20min` | 20 min | **PASS** | Jerusalem practice |
| 49 | `candle_lighting_22` | Candle Lighting (22 min) | `sunset - 22min` | 22 min | **PASS** | Alternative custom |
| 50 | `candle_lighting_30` | Candle Lighting (30 min) | `sunset - 30min` | 30 min | **PASS** | Earlier custom |
| 51 | `candle_lighting_40` | Candle Lighting (40 min) | `sunset - 40min` | 40 min | **PASS** | Jerusalem strict (Plag HaMincha) |

#### Candle Lighting Analysis

**Formula Pattern:** All use `sunset - Xmin`
**Syntax Validation:** ✅ All formulas are valid DSL expressions
**Mathematical Correctness:** ✅ All correctly subtract time from sunset (candles lit BEFORE sunset)
**Standard Values:**
- **18 minutes** - Most common standard worldwide
- **20 minutes** - Jerusalem standard (Rabbanut HaRashit)
- **40 minutes** - Jerusalem strict observance (some communities)
- **15, 22, 30 minutes** - Regional customs

**Potential Issues:**
- None identified. All formulas are correct.

**Note:** There is duplication between `candle_lighting` (ID 2) and `candle_lighting_18` (ID 47). Both use the identical formula `sunset - 18min`. This is acceptable for clarity but could be considered redundant.

---

### 2. Havdalah / Shabbos Ends Zmanim

These zmanim represent when Shabbat ends.

| ID | Zman Key | English Name | Formula | Method | Standard Value | Validation | Notes |
|----|----------|--------------|---------|--------|----------------|------------|-------|
| 60 | `havdalah` | Havdalah | `sunset + 42min` | Fixed offset | 42 min | **NEEDS REVIEW** | Common but less precise than degree-based |
| 10 | `shabbos_ends` | Shabbos Ends | `solar(8.5, after_sunset)` | Solar degrees | 8.5° | **PASS** | Standard tzais (3 small stars) |
| 92 | `shabbos_ends_42` | Shabbos Ends (42 min) | `sunset + 42min` | Fixed offset | 42 min | **PASS** | Common practice |
| 93 | `shabbos_ends_50` | Shabbos Ends (50 min) | `sunset + 50min` | Fixed offset | 50 min | **PASS** | Stringent practice |
| 94 | `shabbos_ends_72` | Shabbos Ends (72 min) | `sunset + 72min` | Fixed offset | 72 min | **PASS** | Rabbeinu Tam |

#### Havdalah Analysis

**Formula Patterns:**
1. **Solar degree-based:** `solar(8.5, after_sunset)` - calculates exact time based on sun position
2. **Fixed offset:** `sunset + Xmin` - adds fixed minutes to sunset

**Syntax Validation:** ✅ All formulas are valid DSL expressions
**Mathematical Correctness:** ✅ All correctly add time to sunset (Shabbat ends AFTER sunset)

**Standard Values:**

| Method | Value | Usage | Halachic Basis |
|--------|-------|-------|----------------|
| Solar degrees | 8.5° | Most accurate | Sun 8.5° below horizon = צאת הכוכבים (emergence of stars) |
| Fixed 42 min | 42 min | Very common | Approximate equivalent to 8.5° in many locations |
| Fixed 50 min | 50 min | Stringent | Extra time for safety |
| Fixed 72 min | 72 min | Rabbeinu Tam | Based on walking distance = 4 mil |

**Degree-Based Calculations:**
- **8.5°** - Standard for tzais (צאת הכוכבים / three small stars visible)
  - Used by most modern poskim
  - More accurate than fixed minutes (adjusts for latitude and season)
- **7.083°** - Alternative calculation (not found in current registry for havdalah)
  - Used by some authorities
  - Approximately 30 minutes in many locations

**Fixed-Minute Calculations:**
- **42 minutes** - Most common worldwide practice
  - Approximate equivalent to 8.5° in middle latitudes
  - Does NOT adjust for location or season
- **50 minutes** - More stringent
- **72 minutes** - Rabbeinu Tam's opinion (4 mil = 72 minutes)

#### Issues Identified

**⚠️ NEEDS REVIEW:** `havdalah` (ID 60) uses `sunset + 42min`

**Issue:** The default `havdalah` zman uses a fixed 42-minute offset instead of the more precise degree-based calculation.

**Impact:**
- **Fixed minutes** do not adjust for:
  - Geographic latitude (42 min may be too early in northern latitudes, too late in southern)
  - Seasonal variations (day length affects twilight duration)
- **Degree-based** (`solar(8.5, after_sunset)`) is more halachically accurate as it represents the actual astronomical event (stars appearing)

**Recommendation:**
- Consider making `solar(8.5, after_sunset)` the default for `havdalah`
- Keep `havdalah_42` as an alternative for communities that follow fixed-minute customs
- **OR** Document why 42min was chosen as default (user preference for simplicity, regional dominance, etc.)

**Current Situation:**
- `shabbos_ends` (ID 10) correctly uses `solar(8.5, after_sunset)`
- `havdalah` (ID 60) uses fixed offset
- Both reference the same halachic event but use different calculation methods

**Suggested Action:**
1. Decide on primary calculation method for default havdalah
2. Ensure documentation clearly explains the difference between degree-based and fixed-offset methods
3. Consider renaming for clarity:
   - `havdalah` → `havdalah_8_5` using `solar(8.5, after_sunset)`
   - `havdalah_42` → keep as is for 42-minute custom

---

## DSL Syntax Validation

All formulas were validated against the DSL specification in `/home/daniel/repos/zmanim/api/internal/dsl/validator.go`.

### Valid Syntax Elements Used

1. **Primitives:** `sunset` (line 79: validated against `Primitives` map)
2. **Binary Operations:** `-` and `+` (line 294-333: type-checked)
3. **Duration Literals:** `15min`, `18min`, `20min`, `22min`, `30min`, `40min`, `42min`, `50min`, `72min` (line 89-92: validated)
4. **Function Calls:** `solar(8.5, after_sunset)` (line 144-181: validated)
   - Degrees: `8.5` (validated: must be between 0-90)
   - Direction: `after_sunset` (validated: must be valid direction)

### Validation Rules Applied

From `validator.go`:

```go
// validateSolarFunction (lines 144-181)
// - Requires exactly 2 arguments
// - Degrees must be 0-90
// - Direction must be valid: before_sunrise, after_sunset, before_noon, after_noon
// - Common values suggested: 8.5° (Tzais), 11.5° (Misheyakir), 16.1° (Alos/MGA)

// validateBinaryOp (lines 294-334)
// - Time + Duration = Time ✓
// - Time - Duration = Time ✓
// - Validates type compatibility
```

**Result:** All 12 formulas pass DSL validation.

---

## Standard Values Reference

### Candle Lighting (Before Sunset)

| Minutes | Communities/Regions | Halachic Source |
|---------|---------------------|-----------------|
| 15 | Some Sephardic communities | Local custom |
| **18** | **Most of world (standard)** | **Common practice** |
| 20 | Jerusalem (Rabbanut), Israel | Rabbanut HaRashit ruling |
| 22 | Some communities | Local stringency |
| 30 | Some communities | Earlier preparation |
| 40 | Jerusalem (strict), Based on Plag | Plag HaMincha approximation |

### Havdalah / Shabbos Ends (After Sunset)

| Method | Value | Communities | Halachic Source |
|--------|-------|-------------|-----------------|
| **Solar** | **8.5°** | **Most modern poskim** | **Sun 8.5° below horizon** |
| Solar | 7.083° | Some authorities | Alternative calculation |
| Fixed | 42 min | Very common worldwide | Approximate to 8.5° |
| Fixed | 50 min | Stringent communities | Extra stringency |
| Fixed | 72 min | Rabbeinu Tam followers | 4 mil = 72 minutes |

---

## Summary of Findings

### ✅ PASS - No Issues (10 zmanim)

1. `candle_lighting` (ID 2)
2. `candle_lighting_15` (ID 46)
3. `candle_lighting_18` (ID 47)
4. `candle_lighting_20` (ID 48)
5. `candle_lighting_22` (ID 49)
6. `candle_lighting_30` (ID 50)
7. `candle_lighting_40` (ID 51)
8. `shabbos_ends` (ID 10)
9. `shabbos_ends_42` (ID 92)
10. `shabbos_ends_50` (ID 93)
11. `shabbos_ends_72` (ID 94)

### ⚠️ NEEDS REVIEW (1 zman)

1. **`havdalah` (ID 60)** - Uses fixed `sunset + 42min` instead of more accurate degree-based calculation
   - Formula is syntactically correct
   - Question: Should default havdalah use degree-based calculation for accuracy?
   - Current: `sunset + 42min`
   - Alternative: `solar(8.5, after_sunset)` (same as `shabbos_ends`)

### ❌ FAIL (0 zmanim)

No failures detected.

---

## Recommendations

### 1. Clarify Default Havdalah Method

**Issue:** `havdalah` and `shabbos_ends` represent the same halachic event but use different calculation methods.

**Options:**

**A. Change to degree-based (recommended for accuracy):**
```sql
UPDATE master_zmanim_registry
SET default_formula_dsl = 'solar(8.5, after_sunset)',
    description = 'End of Shabbos/Yom Tov - sun 8.5° below horizon (standard tzais)'
WHERE zman_key = 'havdalah';
```

**B. Keep fixed offset but document reasoning:**
- Add note explaining why 42min is default (user simplicity, common practice)
- Ensure publishers can easily override with degree-based if needed

**C. Rename for clarity:**
- `havdalah_8_5` → `solar(8.5, after_sunset)` (primary, degree-based)
- `havdalah_42` → `sunset + 42min` (alternative, fixed offset)
- Mark one as "recommended"

### 2. Consider Additional Havdalah Options

Some communities use other degree values not currently in registry:
- `7.083°` - Alternative degree calculation (~30 min in many locations)
- `6.0°` - Some Sephardic customs
- `8.0°` - Variation of standard

**Suggested additions:**
```sql
-- Example (verify values with halachic sources)
INSERT INTO master_zmanim_registry (zman_key, canonical_english_name, default_formula_dsl, time_category_id, description)
VALUES ('havdalah_7_083', 'Havdalah (7.083°)', 'solar(7.083, after_sunset)',
        (SELECT id FROM time_categories WHERE key = 'nightfall'),
        'End of Shabbos - sun 7.083° below horizon');
```

### 3. Documentation

Ensure publisher-facing documentation clearly explains:
- **Difference** between degree-based and fixed-offset calculations
- **Accuracy** implications (degree-based adjusts for location/season)
- **When to use** each type
- **Common practices** by region

### 4. Duplicate Review

IDs 2 and 47 are identical (`candle_lighting` and `candle_lighting_18` both use `sunset - 18min`).

**Options:**
- Keep both for clarity (explicit naming)
- Remove one as duplicate
- Make ID 2 (`candle_lighting`) reference ID 47: `@candle_lighting_18`

---

## Validation Methodology

1. **Database Query:** Extracted all candle/havdalah zmanim from `master_zmanim_registry`
2. **DSL Review:** Read `/home/daniel/repos/zmanim/api/internal/dsl/validator.go` to understand validation rules
3. **Syntax Check:** Verified all formulas against DSL grammar
   - Primitives: `sunset`
   - Operations: `+`, `-`
   - Durations: `Xmin` format
   - Functions: `solar(degrees, direction)`
4. **Semantic Analysis:** Verified formulas produce correct time relationships
   - Candle lighting: BEFORE sunset (subtract)
   - Havdalah: AFTER sunset (add or solar after_sunset)
5. **Standard Values:** Cross-referenced against common halachic practices
6. **Category Assignment:** Verified category alignment
   - Candle lighting → `sunset` category ✓
   - Havdalah → `nightfall` category ✓

---

## Appendix A: DSL Grammar Reference

### Primitives
- `sunrise`, `sunset`, `solar_noon`

### Operations
- `+` : Add duration to time
- `-` : Subtract duration from time or calculate difference between times
- `*` : Multiply duration by number
- `/` : Divide duration by number

### Duration Literals
- Format: `Xmin`, `Xhr`, `Xh Ymin`
- Examples: `18min`, `1hr`, `1h 30min`, `72min`

### Solar Function
```
solar(degrees, direction)
  degrees: 0-90 (float)
  direction: before_sunrise | after_sunset | before_noon | after_noon
```

### References
```
@zman_key  // Reference another zman's calculated time
```

---

## Appendix B: Raw Database Results

```sql
SELECT mz.id, mz.zman_key, mz.canonical_english_name, mz.default_formula_dsl,
       mz.description, tc.key as category
FROM master_zmanim_registry mz
LEFT JOIN time_categories tc ON mz.time_category_id = tc.id
WHERE mz.zman_key LIKE '%candle%'
   OR mz.zman_key LIKE '%havdalah%'
   OR mz.zman_key LIKE '%shabbos_ends%'
ORDER BY mz.zman_key;
```

| id | zman_key | canonical_english_name | default_formula_dsl | description | category |
|----|----------|------------------------|---------------------|-------------|----------|
| 2 | candle_lighting | Candle Lighting | sunset - 18min | Shabbat candle lighting - 18 minutes before sunset | sunset |
| 46 | candle_lighting_15 | Candle Lighting (15 min) | sunset - 15min | Candle lighting 15 minutes before sunset | sunset |
| 47 | candle_lighting_18 | Candle Lighting (18 min) | sunset - 18min | Candle lighting 18 minutes before sunset (standard) | sunset |
| 48 | candle_lighting_20 | Candle Lighting (20 min) | sunset - 20min | Candle lighting 20 minutes before sunset (Jerusalem) | sunset |
| 49 | candle_lighting_22 | Candle Lighting (22 min) | sunset - 22min | Candle lighting 22 minutes before sunset | sunset |
| 50 | candle_lighting_30 | Candle Lighting (30 min) | sunset - 30min | Candle lighting 30 minutes before sunset | sunset |
| 51 | candle_lighting_40 | Candle Lighting (40 min) | sunset - 40min | Candle lighting 40 minutes before sunset (Jerusalem strict) | sunset |
| 60 | havdalah | Havdalah | sunset + 42min | End of Shabbos/Yom Tov - default 42 minutes after sunset | nightfall |
| 10 | shabbos_ends | Shabbos Ends | solar(8.5, after_sunset) | End of Shabbos - standard tzais | nightfall |
| 92 | shabbos_ends_42 | Shabbos Ends (42 min) | sunset + 42min | End of Shabbos - 42 minutes | nightfall |
| 93 | shabbos_ends_50 | Shabbos Ends (50 min) | sunset + 50min | End of Shabbos - 50 minutes | nightfall |
| 94 | shabbos_ends_72 | Shabbos Ends (72 min) | sunset + 72min | End of Shabbos - Rabbeinu Tam | nightfall |

---

## Appendix C: Validator Code References

Key validation functions from `/home/daniel/repos/zmanim/api/internal/dsl/validator.go`:

### Solar Function Validation (Lines 144-181)
```go
func (v *Validator) validateSolarFunction(n *FunctionNode) {
    if len(n.Args) != 2 {
        v.addError(n.Pos, "solar() requires 2 arguments (degrees, direction), got %d", len(n.Args))
        return
    }

    // Validate degrees argument (0-90)
    degrees := n.Args[0]
    if numNode, ok := degrees.(*NumberNode); ok {
        if numNode.Value < 0 || numNode.Value > 90 {
            v.addErrorWithSuggestion(n.Pos,
                fmt.Sprintf("solar() degrees must be between 0 and 90, got %.1f", numNode.Value),
                "Common values: 8.5° (Tzais), 11.5° (Misheyakir), 16.1° (Alos/MGA)")
        }
    }

    // Validate direction argument
    direction := n.Args[1]
    if dirNode, ok := direction.(*DirectionNode); ok {
        if !Directions[dirNode.Direction] {
            v.addErrorWithSuggestion(n.Pos,
                fmt.Sprintf("invalid direction: %s", dirNode.Direction),
                "Valid directions: before_sunrise, after_sunset, before_noon, after_noon")
        }
    }
}
```

### Binary Operation Validation (Lines 294-334)
```go
func (v *Validator) validateBinaryOp(n *BinaryOpNode) {
    v.validateNode(n.Left)
    v.validateNode(n.Right)

    leftType := GetValueType(n.Left)
    rightType := GetValueType(n.Right)

    switch n.Op {
    case "+":
        // Time + Duration = Time ✓
        // Duration + Duration = Duration ✓
        if leftType == ValueTypeTime && rightType == ValueTypeTime {
            v.addError(n.Pos, "cannot add two times")
        }
    case "-":
        // Time - Time = Duration ✓
        // Time - Duration = Time ✓
        // Duration - Duration = Duration ✓
        // All valid
    }
}
```

---

## Conclusion

The candle lighting and havdalah zmanim in the `master_zmanim_registry` are well-structured and syntactically correct. All DSL formulas are valid and represent standard halachic practices.

**Main finding:** The default `havdalah` zman uses a fixed 42-minute offset, which is common but less astronomically precise than the degree-based `solar(8.5, after_sunset)` calculation used by `shabbos_ends`. This should be reviewed for consistency and accuracy.

All other zmanim pass validation with no issues.

---

**Audit completed:** 2025-12-21
**Total zmanim audited:** 12
**Pass:** 11
**Needs Review:** 1
**Fail:** 0
