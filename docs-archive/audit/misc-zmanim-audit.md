# Miscellaneous Zmanim Audit Report

**Date:** 2025-12-21
**Auditor:** Claude Code
**Scope:** All zmanim in master_zmanim_registry NOT in categories: alos, tzais, shema, tefila, mincha, plag, candle, havdalah, sunrise, sunset, chatzos

## Executive Summary

Audited 33 miscellaneous zmanim entries. Found **6 CRITICAL FAILURES** due to invalid DSL syntax:
- 2 zmanim use non-existent `shaah_zmanis()` function
- 4 zmanim use undefined `molad` primitive

## DSL Reference

### Valid Functions
- `solar(degrees, direction)` - Solar angle calculation
- `seasonal_solar(degrees, direction)` - Seasonal proportional solar calculation
- `proportional_hours(hours, base)` - Proportional hour calculation
- `midpoint(time1, time2)` - Midpoint between two times
- `coalesce(expr1, expr2, ...)` - First non-null value

### Valid Primitives
- `sunrise`, `sunset`, `solar_noon`, `solar_midnight`
- `visible_sunrise`, `visible_sunset`
- `civil_dawn`, `civil_dusk`
- `nautical_dawn`, `nautical_dusk`
- `astronomical_dawn`, `astronomical_dusk`

### Valid Bases (for proportional_hours)
- `gra` - Sunrise to sunset
- `mga`, `mga_60`, `mga_72`, `mga_90`, `mga_96`, `mga_120` - Fixed minute MGA
- `mga_72_zmanis`, `mga_90_zmanis`, `mga_96_zmanis` - Proportional MGA
- `mga_16_1`, `mga_18`, `mga_19_8`, `mga_26` - Solar angle MGA
- `baal_hatanya` - Chabad method (1.583°)
- `custom(start, end)` - User-defined boundaries

## Audit Results by Category

### 1. FASTING TIMES (7 zmanim)

#### Fast Beginning Times (3 zmanim)

| ID | Zman Key | Formula | Status | Notes |
|----|----------|---------|--------|-------|
| 52 | `fast_begins` | `solar(16.1, before_sunrise)` | ✅ PASS | Valid solar calculation at 16.1° |
| 53 | `fast_begins_72` | `sunrise - 72min` | ✅ PASS | Valid primitive + duration |
| 54 | `fast_begins_90` | `sunrise - 90min` | ✅ PASS | Valid primitive + duration |

**Analysis:** All fast beginning formulas are syntactically correct. Use standard dawn angles or fixed offsets from sunrise.

#### Fast Ending Times (4 zmanim)

| ID | Zman Key | Formula | Status | Notes |
|----|----------|---------|--------|-------|
| 5 | `fast_ends` | `solar(8.5, after_sunset)` | ✅ PASS | Valid solar calculation at 8.5° |
| 56 | `fast_ends_20` | `sunset + 20min` | ✅ PASS | Valid primitive + duration |
| 57 | `fast_ends_42` | `sunset + 42min` | ✅ PASS | Valid primitive + duration |
| 58 | `fast_ends_50` | `sunset + 50min` | ✅ PASS | Valid primitive + duration |

**Analysis:** All fast ending formulas are syntactically correct. Use standard nightfall angles or fixed offsets from sunset.

### 2. MISHEYAKIR - Earliest Tallis/Tefillin (6 zmanim)

| ID | Zman Key | Formula | Status | Notes |
|----|----------|---------|--------|-------|
| 8 | `misheyakir` | `solar(11.5, before_sunrise)` | ✅ PASS | Valid solar calculation at 11.5° |
| 70 | `misheyakir_10_2` | `solar(10.2, before_sunrise)` | ✅ PASS | Valid solar calculation at 10.2° |
| 71 | `misheyakir_11` | `solar(11, before_sunrise)` | ✅ PASS | Valid solar calculation at 11° |
| 72 | `misheyakir_11_5` | `solar(11.5, before_sunrise)` | ✅ PASS | Valid solar calculation at 11.5° |
| 73 | `misheyakir_7_65` | `solar(7.65, before_sunrise)` | ✅ PASS | Valid solar calculation at 7.65° |
| 74 | `misheyakir_9_5` | `solar(9.5, before_sunrise)` | ✅ PASS | Valid solar calculation at 9.5° |

**Analysis:** All misheyakir formulas are syntactically correct. All use `solar()` function with degrees between 7.65° and 11.5°, which is within the valid 0-90° range.

**Halachic Context:** Misheyakir is when there is enough light to recognize an acquaintance at 4 cubits (~6 feet). Different opinions range from 7.65° to 11.5° below horizon.

### 3. SHAAH ZMANIS - Proportional Hour Length (2 zmanim)

| ID | Zman Key | Formula | Status | Notes |
|----|----------|---------|--------|-------|
| 90 | `shaah_zmanis_gra` | `shaah_zmanis(gra)` | ❌ FAIL | **Function `shaah_zmanis()` does not exist** |
| 91 | `shaah_zmanis_mga` | `shaah_zmanis(mga)` | ❌ FAIL | **Function `shaah_zmanis()` does not exist** |

**Critical Issue:** The DSL does NOT have a `shaah_zmanis()` function. These formulas will fail parsing.

**Recommended Fix:** These zmanim represent the LENGTH of a proportional hour, not a TIME. They should either:
1. Be calculated in application code (not DSL formulas) as: `(day_end - day_start) / 12`
2. Use a different approach - but DSL is designed for TIME calculations, not DURATION calculations
3. Remove from master_zmanim_registry if they are metadata/derived values

**Alternative:** If these need to stay, the DSL would need to be extended to support duration-returning formulas, which is currently not supported (all formulas must return a Time value).

### 4. SHABBOS END TIMES (4 zmanim)

| ID | Zman Key | Formula | Status | Notes |
|----|----------|---------|--------|-------|
| 10 | `shabbos_ends` | `solar(8.5, after_sunset)` | ✅ PASS | Valid solar calculation at 8.5° |
| 92 | `shabbos_ends_42` | `sunset + 42min` | ✅ PASS | Valid primitive + duration |
| 93 | `shabbos_ends_50` | `sunset + 50min` | ✅ PASS | Valid primitive + duration |
| 94 | `shabbos_ends_72` | `sunset + 72min` | ✅ PASS | Valid primitive + duration |

**Analysis:** All Shabbos ending formulas are syntactically correct. Identical in structure to fast ending times, as expected.

### 5. CHAMETZ TIMES - Passover Only (10 zmanim)

#### Eating Chametz (5 zmanim)

| ID | Zman Key | Formula | Status | Notes |
|----|----------|---------|--------|-------|
| 96 | `sof_zman_achilas_chametz_baal_hatanya` | `proportional_hours(4, baal_hatanya)` | ✅ PASS | 4 hours into Baal HaTanya day |
| 97 | `sof_zman_achilas_chametz_gra` | `proportional_hours(4, gra)` | ✅ PASS | 4 hours into GRA day |
| 98 | `sof_zman_achilas_chametz_mga` | `proportional_hours(4, mga)` | ✅ PASS | 4 hours into MGA day |
| 99 | `sof_zman_achilas_chametz_mga_16_1` | `proportional_hours(4, mga_16_1)` | ✅ PASS | 4 hours into MGA 16.1° day |
| 100 | `sof_zman_achilas_chametz_mga_72_zmanis` | `proportional_hours(4, mga_72_zmanis)` | ✅ PASS | 4 hours into MGA 72 zmaniyos day |

**Analysis:** All eating chametz formulas are syntactically correct. Use `proportional_hours(4, base)` - 4 hours into the halachic day, per Shulchan Aruch.

#### Burning Chametz (5 zmanim)

| ID | Zman Key | Formula | Status | Notes |
|----|----------|---------|--------|-------|
| 101 | `sof_zman_biur_chametz_baal_hatanya` | `proportional_hours(5, baal_hatanya)` | ✅ PASS | 5 hours into Baal HaTanya day |
| 102 | `sof_zman_biur_chametz_gra` | `proportional_hours(5, gra)` | ✅ PASS | 5 hours into GRA day |
| 103 | `sof_zman_biur_chametz_mga` | `proportional_hours(5, mga)` | ✅ PASS | 5 hours into MGA day |
| 104 | `sof_zman_biur_chametz_mga_16_1` | `proportional_hours(5, mga_16_1)` | ✅ PASS | 5 hours into MGA 16.1° day |
| 105 | `sof_zman_biur_chametz_mga_72_zmanis` | `proportional_hours(5, mga_72_zmanis)` | ✅ PASS | 5 hours into MGA 72 zmaniyos day |

**Analysis:** All burning chametz formulas are syntactically correct. Use `proportional_hours(5, base)` - 5 hours into the halachic day, one hour after eating deadline.

**Halachic Context:** On Erev Pesach, one must stop eating chametz by the end of the 4th hour, and destroy all chametz by the end of the 5th hour of the halachic day.

### 6. KIDDUSH LEVANA - Sanctifying the Moon (4 zmanim)

#### Latest Time (2 zmanim)

| ID | Zman Key | Formula | Status | Notes |
|----|----------|---------|--------|-------|
| 106 | `sof_zman_kiddush_levana_15` | `molad + 15days` | ❌ FAIL | **Primitive `molad` does not exist** |
| 107 | `sof_zman_kiddush_levana_between_moldos` | `molad + 14days + 18hr` | ❌ FAIL | **Primitive `molad` does not exist** |

#### Earliest Time (2 zmanim)

| ID | Zman Key | Formula | Status | Notes |
|----|----------|---------|--------|-------|
| 133 | `tchillas_zman_kiddush_levana_3` | `molad + 3days` | ❌ FAIL | **Primitive `molad` does not exist** |
| 134 | `tchillas_zman_kiddush_levana_7` | `molad + 7days` | ❌ FAIL | **Primitive `molad` does not exist** |

**Critical Issue:** All Kiddush Levana formulas fail because `molad` is not a defined primitive in the DSL.

**Halachic Context:** Kiddush Levana can be recited from when the new moon becomes visible (3 or 7 days after molad) until the moon reaches its fullness (15 days or halfway between molads).

**Recommended Fix:** The `molad` (astronomical new moon) is a DATE-TIME value that requires astronomical calculation beyond daily zmanim. Options:
1. Add `molad` as a primitive (requires implementing lunar calculations in `api/internal/astro/`)
2. Calculate Kiddush Levana times outside the DSL system (in application code)
3. Use a reference to a pre-calculated molad value (e.g., `@molad + 15days`)

**Note:** KosherJava's implementation calculates molad based on the average lunar month (29 days, 12 hours, 793 chalakim), tracking from a known historical molad (Molad Tohu or Molad BaHaRaD).

## Summary Statistics

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ PASS | 27 | 81.8% |
| ❌ FAIL | 6 | 18.2% |
| **TOTAL** | **33** | **100%** |

### Failures by Type

| Issue | Count | Zmanim |
|-------|-------|--------|
| Non-existent `shaah_zmanis()` function | 2 | `shaah_zmanis_gra`, `shaah_zmanis_mga` |
| Undefined `molad` primitive | 4 | All Kiddush Levana zmanim |

## Recommendations

### HIGH PRIORITY

1. **Shaah Zmanis Zmanim (IDs 90-91)**
   - **Action:** Remove from master_zmanim_registry OR change approach
   - **Reason:** These represent durations, not times. DSL is designed for time calculations.
   - **Alternative:** Calculate in application code as metadata/derived values

2. **Kiddush Levana Zmanim (IDs 106-107, 133-134)**
   - **Action:** Implement `molad` primitive in DSL OR move to separate calculation system
   - **Reason:** Requires lunar calculations not currently in the system
   - **Effort:** High - requires implementing lunar cycle calculations

### MEDIUM PRIORITY

3. **Validate Semantic Correctness**
   - All formulas pass syntax validation
   - Recommend testing actual time calculations for edge cases (polar regions, etc.)
   - Verify degrees used for misheyakir align with publisher expectations

4. **Shita Tags**
   - Review if fasting/Shabbos/Chametz times need specific shita associations
   - Misheyakir: Different degree values represent different rabbinical opinions

## Appendix: Formula Validation Method

All formulas were validated against:
- **Validator:** `/home/daniel/repos/zmanim/api/internal/dsl/validator.go`
- **Executor:** `/home/daniel/repos/zmanim/api/internal/dsl/executor.go`
- **Token Definitions:** `/home/daniel/repos/zmanim/api/internal/dsl/token.go`

Valid functions: `solar()`, `seasonal_solar()`, `proportional_hours()`, `midpoint()`, `coalesce()`
Valid primitives: `sunrise`, `sunset`, `solar_noon`, `solar_midnight`, visibility/civil/nautical/astronomical variants
Invalid formulas: Any using undefined functions or primitives
