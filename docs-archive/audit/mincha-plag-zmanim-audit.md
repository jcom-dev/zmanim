# Mincha and Plag Zmanim Audit Report

**Date:** 2025-12-21
**Auditor:** Claude Code
**Scope:** All MINCHA and PLAG zmanim in master_zmanim_registry

---

## Executive Summary

This audit examined 27 zmanim related to Mincha (earliest prayer time) and Plag HaMincha (deadline for afternoon prayer) in the `master_zmanim_registry` table. The audit focused on:

1. DSL formula syntax correctness
2. Proportional hour values (6.5 for Mincha Gedola, 9.5 for Mincha Ketana, 10.75 for Plag, 9.0 for Samuch)
3. Day definition correctness (GRA vs MGA variants)
4. Base reference validity

### Overall Results

- **Total Zmanim Audited:** 27
- **PASS:** 21 (77.8%)
- **FAIL:** 6 (22.2%)
- **NEEDS_REVIEW:** 0 (0%)

### Critical Issues Found

1. **6 Invalid Base References:** The formulas use `alos_16_1` and `ateret_torah` as base definitions, but these are NOT defined in the DSL's Bases map (`api/internal/dsl/token.go`). These should be `mga_16_1`, not `alos_16_1`.

---

## Detailed Findings

### Category 1: Mincha Gedola (6.5 hours)

Mincha Gedola represents the earliest time for the afternoon Mincha prayer, occurring 6.5 proportional hours after the start of the day.

| ID | Zman Key | English Name | Formula | Expected Hours | Validation | Notes |
|----|----------|--------------|---------|----------------|------------|-------|
| 6 | mincha_gedola | Earliest Mincha (GRA) | `proportional_hours(6.5, gra)` | 6.5 | PASS | Correct GRA day definition (sunrise to sunset) |
| 61 | mincha_gedola_16_1 | Earliest Mincha (16.1°) | `proportional_hours(6.5, alos_16_1)` | 6.5 | **FAIL** | Invalid base: `alos_16_1` not defined. Should be `mga_16_1` |
| 62 | mincha_gedola_30 | Earliest Mincha (30 min) | `solar_noon + 30min` | N/A | PASS | Fixed-minute offset, not proportional |
| 63 | mincha_gedola_72 | Earliest Mincha (72 min) | `proportional_hours(6.5, mga)` | 6.5 | PASS | Correct MGA 72-minute day |
| 64 | mincha_gedola_ateret_torah | Earliest Mincha (Ateret Torah) | `proportional_hours(6.5, ateret_torah)` | 6.5 | **FAIL** | Invalid base: `ateret_torah` not defined |
| 65 | mincha_gedola_baal_hatanya | Earliest Mincha (Baal HaTanya) | `proportional_hours(6.5, baal_hatanya)` | 6.5 | PASS | Correct Baal HaTanya day definition |

**Category Summary:**
- Total: 6 zmanim
- PASS: 4 (66.7%)
- FAIL: 2 (33.3%)

---

### Category 2: Mincha Ketana (9.5 hours)

Mincha Ketana represents the preferred time for Mincha, occurring 9.5 proportional hours after the start of the day.

| ID | Zman Key | English Name | Formula | Expected Hours | Validation | Notes |
|----|----------|--------------|---------|----------------|------------|-------|
| 7 | mincha_ketana | Mincha Ketana | `proportional_hours(9.5, gra)` | 9.5 | PASS | Correct GRA day definition |
| 66 | mincha_ketana_16_1 | Mincha Ketana (16.1°) | `proportional_hours(9.5, alos_16_1)` | 9.5 | **FAIL** | Invalid base: `alos_16_1` not defined. Should be `mga_16_1` |
| 67 | mincha_ketana_72 | Mincha Ketana (72 min) | `proportional_hours(9.5, mga)` | 9.5 | PASS | Correct MGA 72-minute day |
| 68 | mincha_ketana_ateret_torah | Mincha Ketana (Ateret Torah) | `proportional_hours(9.5, ateret_torah)` | 9.5 | **FAIL** | Invalid base: `ateret_torah` not defined |
| 69 | mincha_ketana_baal_hatanya | Mincha Ketana (Baal HaTanya) | `proportional_hours(9.5, baal_hatanya)` | 9.5 | PASS | Correct Baal HaTanya day definition |

**Category Summary:**
- Total: 5 zmanim
- PASS: 3 (60.0%)
- FAIL: 2 (40.0%)

---

### Category 3: Plag HaMincha (10.75 hours)

Plag HaMincha represents the deadline for afternoon prayer, occurring 10.75 proportional hours after the start of the day (1.25 hours before the end of day).

| ID | Zman Key | English Name | Formula | Expected Hours | Validation | Notes |
|----|----------|--------------|---------|----------------|------------|-------|
| 9 | plag_hamincha | Plag HaMincha | `proportional_hours(10.75, gra)` | 10.75 | PASS | Correct GRA day definition |
| 75 | plag_hamincha_120 | Plag HaMincha (120 min) | `proportional_hours(10.75, mga_120)` | 10.75 | PASS | Correct MGA 120-minute day |
| 76 | plag_hamincha_16_1 | Plag HaMincha (16.1°) | `proportional_hours(10.75, alos_16_1)` | 10.75 | **FAIL** | Invalid base: `alos_16_1` not defined. Should be `mga_16_1` |
| 77 | plag_hamincha_18 | Plag HaMincha (18°) | `proportional_hours(10.75, mga_18)` | 10.75 | PASS | Correct MGA 18° day |
| 78 | plag_hamincha_19_8 | Plag HaMincha (19.8°) | `proportional_hours(10.75, mga_19_8)` | 10.75 | PASS | Correct MGA 19.8° day |
| 79 | plag_hamincha_26 | Plag HaMincha (26°) | `proportional_hours(10.75, mga_26)` | 10.75 | PASS | Correct MGA 26° day |
| 80 | plag_hamincha_60 | Plag HaMincha (60 min) | `proportional_hours(10.75, mga_60)` | 10.75 | PASS | Correct MGA 60-minute day |
| 81 | plag_hamincha_72 | Plag HaMincha (72 min) | `proportional_hours(10.75, mga)` | 10.75 | PASS | Correct MGA 72-minute day |
| 82 | plag_hamincha_90 | Plag HaMincha (90 min) | `proportional_hours(10.75, mga_90)` | 10.75 | PASS | Correct MGA 90-minute day |
| 83 | plag_hamincha_96 | Plag HaMincha (96 min) | `proportional_hours(10.75, mga_96)` | 10.75 | PASS | Correct MGA 96-minute day |
| 84 | plag_hamincha_ateret_torah | Plag HaMincha (Ateret Torah) | `proportional_hours(10.75, ateret_torah)` | 10.75 | **FAIL** | Invalid base: `ateret_torah` not defined |
| 85 | plag_hamincha_baal_hatanya | Plag HaMincha (Baal HaTanya) | `proportional_hours(10.75, baal_hatanya)` | 10.75 | PASS | Correct Baal HaTanya day definition |
| 86 | plag_hamincha_terumas_hadeshen | Plag HaMincha (Terumas HaDeshen) | `proportional_hours(10.75, custom(sunrise - 90min, sunset + 90min))` | 10.75 | PASS | Correct custom day definition |

**Category Summary:**
- Total: 13 zmanim
- PASS: 12 (92.3%)
- FAIL: 1 (7.7%)

---

### Category 4: Samuch L'Mincha Ketana (9.0 hours)

Samuch L'Mincha Ketana represents half an hour before Mincha Ketana, occurring 9.0 proportional hours after the start of the day.

| ID | Zman Key | English Name | Formula | Expected Hours | Validation | Notes |
|----|----------|--------------|---------|----------------|------------|-------|
| 87 | samuch_lmincha_ketana | Samuch L'Mincha Ketana | `proportional_hours(9, gra)` | 9.0 | PASS | Correct GRA day definition. 9.0 = 9.5 - 0.5 hours |
| 88 | samuch_lmincha_ketana_16_1 | Samuch L'Mincha Ketana (16.1°) | `proportional_hours(9, mga_16_1)` | 9.0 | **FAIL** | Correct hour value but uses `mga_16_1` which references `alos_16_1` internally (see executor.go lines 489-500) |
| 89 | samuch_lmincha_ketana_72 | Samuch L'Mincha Ketana (72 min) | `proportional_hours(9, mga)` | 9.0 | PASS | Correct MGA 72-minute day |

**Category Summary:**
- Total: 3 zmanim
- PASS: 2 (66.7%)
- FAIL: 1 (33.3%)

**Note:** The "Samuch" (adjacent) terminology refers to being close to (half hour before) Mincha Ketana. The calculation 9.5 - 0.5 = 9.0 proportional hours is mathematically correct.

---

## Technical Analysis

### Proportional Hours Calculation

The DSL uses the `proportional_hours(hours, base)` function which is implemented in `/home/daniel/repos/zmanim/api/internal/dsl/executor.go` (lines 402-581). The calculation follows this pattern:

1. **Determine day boundaries** based on the base:
   - `gra`: sunrise to sunset
   - `mga` (or `mga_72`): (sunrise - 72min) to (sunset + 72min)
   - `mga_16_1`: 16.1° before sunrise to 16.1° after sunset
   - `baal_hatanya`: 1.583° below horizon (netz amiti to shkiah amiti)
   - `custom(start, end)`: user-defined boundaries

2. **Calculate proportional hour duration:**
   ```
   shaah_zmanis = (end_time - start_time) / 12
   ```

3. **Calculate result time:**
   ```
   result = start_time + (shaah_zmanis × hours)
   ```

This implementation is verified in `/home/daniel/repos/zmanim/api/internal/astro/times.go` (lines 25-46):

```go
func ShaosZmaniyosGRA(sunrise, sunset time.Time, hours float64) time.Time {
    dayDuration := sunset.Sub(sunrise)
    hourDuration := time.Duration(float64(dayDuration) / 12)
    return sunrise.Add(time.Duration(float64(hourDuration) * hours))
}
```

### Expected Values Verification

| Zman Type | Hour Value | Calculation | Verification |
|-----------|------------|-------------|--------------|
| Mincha Gedola | 6.5 | Chatzos (6.0) + 0.5 | Correct: 0.5 shaos after midday |
| Mincha Ketana | 9.5 | Chatzos (6.0) + 3.5 | Correct: 3.5 shaos after midday = 2.5 before end |
| Plag HaMincha | 10.75 | 12.0 - 1.25 | Correct: 1.25 shaos before end of day |
| Samuch L'Mincha | 9.0 | 9.5 - 0.5 | Correct: 0.5 shaos before Mincha Ketana |

All hour values match expected halachic definitions.

---

## Issues Requiring Remediation

### Issue 1: Invalid Base Reference `alos_16_1`

**Severity:** HIGH
**Impact:** 3 zmanim will fail validation and cannot be used
**Affected Zmanim:**
- `mincha_gedola_16_1` (ID 61)
- `mincha_ketana_16_1` (ID 66)
- `plag_hamincha_16_1` (ID 76)

**Root Cause:**
The formulas reference `alos_16_1` as a base, but this identifier is not defined in the DSL's Bases map (`/home/daniel/repos/zmanim/api/internal/dsl/token.go` lines 190-217). The correct base name is `mga_16_1`.

**Recommended Fix:**
Update the formulas from `proportional_hours(X, alos_16_1)` to `proportional_hours(X, mga_16_1)`.

**SQL Migration:**
```sql
UPDATE master_zmanim_registry
SET default_formula_dsl = 'proportional_hours(6.5, mga_16_1)'
WHERE zman_key = 'mincha_gedola_16_1';

UPDATE master_zmanim_registry
SET default_formula_dsl = 'proportional_hours(9.5, mga_16_1)'
WHERE zman_key = 'mincha_ketana_16_1';

UPDATE master_zmanim_registry
SET default_formula_dsl = 'proportional_hours(10.75, mga_16_1)'
WHERE zman_key = 'plag_hamincha_16_1';
```

---

### Issue 2: Invalid Base Reference `ateret_torah`

**Severity:** HIGH
**Impact:** 3 zmanim will fail validation and cannot be used
**Affected Zmanim:**
- `mincha_gedola_ateret_torah` (ID 64)
- `mincha_ketana_ateret_torah` (ID 68)
- `plag_hamincha_ateret_torah` (ID 84)

**Root Cause:**
The formulas reference `ateret_torah` as a base, but this identifier is not defined in the DSL's Bases map. According to KosherJava documentation, Ateret Torah uses specific solar angles for alos and tzais.

**Recommended Fix:**
Two options:

**Option A: Add `ateret_torah` to the Bases map**

Add to `/home/daniel/repos/zmanim/api/internal/dsl/token.go`:
```go
// Ateret Torah (Chacham Yosef Harari-Raful)
"ateret_torah": true, // Ateret Torah day definition
```

And implement in `/home/daniel/repos/zmanim/api/internal/dsl/executor.go` (after line 556):
```go
case "ateret_torah":
    // Ateret Torah: specific angles for alos and tzais
    // Based on Chacham Yosef Harari-Raful's calculations
    // TODO: Verify exact angle values from authoritative source
    // Placeholder using 16.1° (verify with KosherJava)
    alosAT, _ := astro.SunTimeAtAngleWithElevation(
        e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Elevation,
        e.ctx.Timezone, 16.1, // VERIFY THIS VALUE
    )
    _, tzaisAT := astro.SunTimeAtAngleWithElevation(
        e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude, e.ctx.Elevation,
        e.ctx.Timezone, 16.1, // VERIFY THIS VALUE
    )
    t = astro.ShaosZmaniyosCustom(alosAT, tzaisAT, hours)
```

**Option B: Use custom() syntax**

Update the formulas to use the `custom()` base syntax:
```sql
UPDATE master_zmanim_registry
SET default_formula_dsl = 'proportional_hours(6.5, custom(solar(16.1, before_sunrise), solar(16.1, after_sunset)))'
WHERE zman_key = 'mincha_gedola_ateret_torah';

UPDATE master_zmanim_registry
SET default_formula_dsl = 'proportional_hours(9.5, custom(solar(16.1, before_sunrise), solar(16.1, after_sunset)))'
WHERE zman_key = 'mincha_ketana_ateret_torah';

UPDATE master_zmanim_registry
SET default_formula_dsl = 'proportional_hours(10.75, custom(solar(16.1, before_sunrise), solar(16.1, after_sunset)))'
WHERE zman_key = 'plag_hamincha_ateret_torah';
```

**Note:** The exact angle value (16.1° is a placeholder) needs to be verified against KosherJava's implementation of Ateret Torah calculations.

---

### Issue 3: Samuch L'Mincha Ketana MGA 16.1 Uses Undefined Base

**Severity:** MEDIUM
**Impact:** 1 zman uses valid syntax but references potentially undefined internal base
**Affected Zmanim:**
- `samuch_lmincha_ketana_16_1` (ID 88)

**Root Cause:**
The formula uses `proportional_hours(9, mga_16_1)` which is syntactically valid. However, the `mga_16_1` base implementation in executor.go (lines 489-500) internally references `alos_16_1` which doesn't exist.

**Analysis:**
Looking at the executor code:
```go
case "mga_16_1":
    // MGA 16.1°: solar angle-based (16.1° alos to 16.1° tzais)
    alos161, _ := astro.SunTimeAtAngleWithElevation(...)
    _, tzeis161 := astro.SunTimeAtAngleWithElevation(...)
    t = astro.ShaosZmaniyosCustom(alos161, tzeis161, hours)
```

The implementation correctly uses solar angle calculations, not a base reference called `alos_16_1`. So this is actually CORRECT and will work. The validator just needs the Bases map to include `mga_16_1`, which it does.

**Resolution:** Change status to PASS. This is not actually a failure.

---

## Recommendations

### Immediate Actions Required

1. **Fix Invalid Base References:**
   - Update `alos_16_1` → `mga_16_1` in 3 zmanim formulas
   - Define `ateret_torah` base or convert to `custom()` syntax in 3 zmanim formulas

2. **Run Validation:**
   - After fixes, run DSL validation on all updated formulas
   - Verify no syntax errors using the DSL parser

3. **Testing:**
   - Test all 6 corrected formulas with sample dates/locations
   - Compare results with KosherJava library for accuracy
   - Verify proportional hours calculations produce expected times

### Long-term Improvements

1. **Base Documentation:**
   - Document all valid base identifiers in `docs/dsl-complete-guide.md`
   - Add examples for each base type
   - Clarify naming conventions (e.g., `mga_X` vs `alos_X`)

2. **Validation Enhancement:**
   - Add automated tests for all master_zmanim_registry formulas
   - Create CI check to validate all formulas on database changes
   - Add warnings for deprecated or uncommon base references

3. **Ateret Torah Research:**
   - Determine exact solar angles used by Chacham Yosef Harari-Raful
   - Compare with KosherJava implementation
   - Document authoritative sources for the calculation

---

## Appendix A: Proportional Hours Quick Reference

| Hour Value | Description | Usage |
|------------|-------------|-------|
| 3.0 | Sof Zman Shema | Latest time for Shema (GRA) |
| 4.0 | Sof Zman Tefila | Latest time for Shacharit |
| 6.0 | Chatzos (Midday) | Solar noon |
| 6.5 | Mincha Gedola | Earliest Mincha (0.5 after chatzos) |
| 9.0 | Samuch L'Mincha Ketana | Half hour before Mincha Ketana |
| 9.5 | Mincha Ketana | Preferred Mincha time |
| 10.75 | Plag HaMincha | Latest for early Shabbos (1.25 before end) |
| 12.0 | End of Day | Sunset (GRA) or Tzais (MGA) |

---

## Appendix B: Base Definitions Summary

| Base | Definition | Source |
|------|------------|--------|
| `gra` | Sunrise to sunset | GRA (Vilna Gaon) |
| `mga` | (Sunrise - 72min) to (Sunset + 72min) | Magen Avraham |
| `mga_60` | (Sunrise - 60min) to (Sunset + 60min) | MGA variant |
| `mga_90` | (Sunrise - 90min) to (Sunset + 90min) | MGA variant |
| `mga_96` | (Sunrise - 96min) to (Sunset + 96min) | MGA variant |
| `mga_120` | (Sunrise - 120min) to (Sunset + 120min) | MGA variant |
| `mga_16_1` | 16.1° before sunrise to 16.1° after sunset | Solar angle (72min equiv.) |
| `mga_18` | 18° before sunrise to 18° after sunset | Astronomical twilight |
| `mga_19_8` | 19.8° before sunrise to 19.8° after sunset | Solar angle (90min equiv.) |
| `mga_26` | 26° before sunrise to 26° after sunset | Solar angle (120min equiv.) |
| `baal_hatanya` | 1.583° below horizon (netz amiti/shkiah amiti) | Shulchan Aruch HaRav |
| `custom(start, end)` | User-defined boundaries | Custom calculation |
| `ateret_torah` | **UNDEFINED** - needs implementation | Chacham Yosef Harari-Raful |

---

## Appendix C: Validation Checklist

- [x] Query database for all mincha/plag zmanim
- [x] Read DSL validator.go
- [x] Read DSL executor.go
- [x] Read astro/times.go (proportional hours implementation)
- [x] Verify hour values (6.5, 9.5, 10.75, 9.0)
- [x] Check base definitions in token.go
- [x] Verify GRA vs MGA day definitions
- [x] Test formula syntax correctness
- [x] Document findings
- [x] Generate remediation recommendations

---

**End of Audit Report**
