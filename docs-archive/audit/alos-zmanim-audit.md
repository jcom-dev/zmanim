# ALOS/DAWN Category Zmanim Audit

**Audit Date:** 2025-12-21
**Database Query:** master_zmanim_registry
**Category:** dawn (time_categories.key = 'dawn')
**Total Zmanim Found:** 21

---

## Executive Summary

This audit reviewed all zmanim in the master_zmanim_registry that are classified as "dawn" category or have "alos" or "dawn" in their zman_key. The audit found **CRITICAL ISSUES** with four zmanim using an invalid DSL function `proportional_minutes` that does not exist in the DSL validator.

### Critical Findings
- **4 alos/dawn zmanim use invalid DSL function:** `proportional_minutes()`
- **8 total zmanim affected system-wide** (4 alos + 4 tzais)
- This function is NOT defined in the DSL token definitions or validator
- No implementation exists anywhere in the codebase (`/home/daniel/repos/zmanim/api`)
- Valid functions are: `solar`, `seasonal_solar`, `proportional_hours`, `midpoint`, `coalesce`

### Validation Summary (Dawn/Alos Only)
- **PASS:** 17 zmanim (81.0%)
- **FAIL:** 4 zmanim (19.0%) - Invalid function
- **NEEDS_REVIEW:** 0 zmanim (0%)

### Systemic Impact
The `proportional_minutes` function issue affects:
- `alos_72_zmanis`, `alos_90_zmanis`, `alos_96_zmanis`, `alos_120_zmanis` (dawn)
- `tzais_72_zmanis`, `tzais_90_zmanis`, `tzais_96_zmanis`, `tzais_120_zmanis` (nightfall)

---

## DSL Function Reference

Based on `/home/daniel/repos/zmanim/api/internal/dsl/token.go` and `/home/daniel/repos/zmanim/api/internal/dsl/validator.go`:

### Valid Functions
1. **solar(degrees, direction)** - Solar angle calculation
   - degrees: 0-90
   - direction: before_sunrise, after_sunset, before_noon, after_noon

2. **seasonal_solar(degrees, direction)** - Proportional/seasonal method (ROY/Zemaneh-Yosef)
   - degrees: 0-90
   - direction: before_sunrise, after_sunset only

3. **proportional_hours(hours, base)** - Proportional hours calculation
   - hours: 0.5-12
   - base: gra, mga, mga_*, baal_hatanya, custom(start, end)

4. **midpoint(time1, time2)** - Calculate midpoint between two times

5. **coalesce(...)** - Return first non-null value

### Invalid Functions Found in Database
- **proportional_minutes** - NOT DEFINED IN DSL

---

## Detailed Audit Results

### FAIL - Invalid DSL Function (4 zmanim)

#### 1. alos_120_zmanis (ID: 21)
- **Name:** Dawn (120 Zmaniyos)
- **Formula:** `proportional_minutes(120, before_sunrise)`
- **Category:** dawn
- **Tags:** None
- **Status:** ❌ FAIL
- **Issue:** Function `proportional_minutes` does not exist in DSL
- **Recommendation:** Replace with valid DSL syntax. Likely should use `proportional_hours` or a different formula structure

#### 2. alos_72_zmanis (ID: 29)
- **Name:** Dawn (72 Zmaniyos)
- **Formula:** `proportional_minutes(72, before_sunrise)`
- **Category:** dawn
- **Tags:** shita_mga
- **Status:** ❌ FAIL
- **Issue:** Function `proportional_minutes` does not exist in DSL
- **Recommendation:** Replace with valid DSL syntax. This is an MGA shita zman and should use proper DSL functions

#### 3. alos_90_zmanis (ID: 31)
- **Name:** Dawn (90 Zmaniyos)
- **Formula:** `proportional_minutes(90, before_sunrise)`
- **Category:** dawn
- **Tags:** None
- **Status:** ❌ FAIL
- **Issue:** Function `proportional_minutes` does not exist in DSL
- **Recommendation:** Replace with valid DSL syntax

---

---

### PASS - Solar Angle Formulas (12 zmanim)

#### 5. alos_12 (ID: 19)
- **Name:** Dawn (12°)
- **Formula:** `solar(12, before_sunrise)`
- **Category:** dawn
- **Tags:** None
- **Status:** ✅ PASS
- **Notes:** Valid solar angle formula

#### 6. alos_16_1 (ID: 22)
- **Name:** Dawn (16.1°)
- **Formula:** `solar(16.1, before_sunrise)`
- **Category:** dawn
- **Tags:** shita_mga
- **Status:** ✅ PASS
- **Notes:** Valid MGA shita formula. 16.1° is standard MGA dawn angle

#### 7. alos_18 (ID: 23)
- **Name:** Dawn (18°)
- **Formula:** `solar(18, before_sunrise)`
- **Category:** dawn
- **Tags:** None
- **Status:** ✅ PASS
- **Notes:** Valid solar angle formula. 18° is astronomical twilight

#### 8. alos_19 (ID: 24)
- **Name:** Dawn (19°)
- **Formula:** `solar(19, before_sunrise)`
- **Category:** dawn
- **Tags:** None
- **Status:** ✅ PASS
- **Notes:** Valid solar angle formula

#### 9. alos_19_8 (ID: 25)
- **Name:** Dawn (19.8°)
- **Formula:** `solar(19.8, before_sunrise)`
- **Category:** dawn
- **Tags:** None
- **Status:** ✅ PASS
- **Notes:** Valid solar angle formula. 19.8° is 90-min equivalent at Jerusalem equinox

#### 10. alos_26 (ID: 26)
- **Name:** Dawn (26°)
- **Formula:** `solar(26, before_sunrise)`
- **Category:** dawn
- **Tags:** None
- **Status:** ✅ PASS
- **Notes:** Valid solar angle formula. 26° is 120-min equivalent at Jerusalem equinox

#### 11. alos_baal_hatanya (ID: 34)
- **Name:** Dawn (Baal HaTanya)
- **Formula:** `solar(16.9, before_sunrise)`
- **Category:** dawn
- **Tags:** shita_baal_hatanya
- **Status:** ✅ PASS
- **Notes:** Valid Chabad/Baal HaTanya formula with appropriate tag

#### 12. alos_hashachar (ID: 1)
- **Name:** Dawn (Alos Hashachar)
- **Formula:** `solar(16.1, before_sunrise)`
- **Category:** dawn
- **Tags:** None
- **Status:** ✅ PASS
- **Notes:** Valid formula. This is the primary/canonical dawn time

#### 13. fast_begins (ID: 52)
- **Name:** Fast Begins
- **Formula:** `solar(16.1, before_sunrise)`
- **Category:** dawn
- **Tags:** category_fast_start, fast_day
- **Status:** ✅ PASS
- **Notes:** Valid formula with appropriate fast day tags

---

---

### PASS - Fixed Minute Formulas (7 zmanim)

#### 14. alos_120 (ID: 20)
- **Name:** Dawn (120 minutes)
- **Formula:** `sunrise - 120min`
- **Category:** dawn
- **Tags:** None
- **Status:** ✅ PASS
- **Notes:** Valid fixed-minute formula

#### 15. alos_60 (ID: 27)
- **Name:** Dawn (60 minutes)
- **Formula:** `sunrise - 60min`
- **Category:** dawn
- **Tags:** None
- **Status:** ✅ PASS
- **Notes:** Valid fixed-minute formula

#### 16. alos_72 (ID: 28)
- **Name:** Dawn (72 minutes)
- **Formula:** `sunrise - 72min`
- **Category:** dawn
- **Tags:** shita_mga
- **Status:** ✅ PASS
- **Notes:** Valid MGA formula with appropriate tag. 72 minutes is standard MGA

#### 17. alos_90 (ID: 30)
- **Name:** Dawn (90 minutes)
- **Formula:** `sunrise - 90min`
- **Category:** dawn
- **Tags:** None
- **Status:** ✅ PASS
- **Notes:** Valid fixed-minute formula

#### 18. alos_96 (ID: 32)
- **Name:** Dawn (96 minutes)
- **Formula:** `sunrise - 96min`
- **Category:** dawn
- **Tags:** None
- **Status:** ✅ PASS
- **Notes:** Valid fixed-minute formula

#### 19. alos_shemini_atzeres (ID: 35)
- **Name:** Dawn for Aravos (Shemini Atzeres)
- **Formula:** `sunrise - 24min`
- **Category:** dawn
- **Tags:** None
- **Status:** ✅ PASS
- **Notes:** Valid formula for specific holiday observance

#### 20. fast_begins_72 (ID: 53)
- **Name:** Fast Begins (72 min)
- **Formula:** `sunrise - 72min`
- **Category:** dawn
- **Tags:** category_fast_start, fast_day
- **Status:** ✅ PASS
- **Notes:** Valid formula with appropriate fast day tags

#### 21. fast_begins_90 (ID: 54)
- **Name:** Fast Begins (90 min)
- **Formula:** `sunrise - 90min`
- **Category:** dawn
- **Tags:** category_fast_start, fast_day
- **Status:** ✅ PASS
- **Notes:** Valid formula with appropriate fast day tags

#### 4. alos_96_zmanis (ID: 33)
- **Name:** Dawn (96 Zmaniyos)
- **Formula:** `proportional_minutes(96, before_sunrise)`
- **Category:** dawn
- **Tags:** None
- **Status:** ❌ FAIL
- **Issue:** Function `proportional_minutes` does not exist in DSL
- **Recommendation:** Replace with valid DSL syntax. Consider adding MGA-related shita tag

---

## Shita Tag Analysis

### Tagged Zmanim by Shita
- **shita_mga:** 3 zmanim (alos_16_1, alos_72, alos_72_zmanis)
- **shita_baal_hatanya:** 1 zman (alos_baal_hatanya)
- **category_fast_start + fast_day:** 3 zmanim (fast_begins variants)
- **No tags:** 14 zmanim

### Missing Tags Recommendations
Several zmanim reference specific opinions but lack shita tags:
1. **alos_19_8** - 90-minute equivalent, potentially MGA-related
2. **alos_26** - 120-minute equivalent, potentially MGA-related
3. **alos_96_zmanis** - Should likely have shita tag (once DSL is fixed)
4. **alos_90_zmanis** - Should likely have shita tag (once DSL is fixed)
5. **alos_120_zmanis** - Should likely have shita tag (once DSL is fixed)

---

## Semantic Validation

### Formula Semantic Correctness

All formulas are semantically appropriate for dawn/alos times:
- ✅ All solar angles use `before_sunrise` direction (correct)
- ✅ All fixed-minute formulas subtract from sunrise (correct)
- ✅ All use primitives or functions that should produce times before sunrise
- ❌ Three formulas use undefined function `proportional_minutes`

### Degree Range Analysis
Solar angle formulas use degrees in range 12° - 26°:
- 12°, 16.1°, 16.9°, 18°, 19°, 19.8°, 26°
- All within valid range (0-90°) per validator
- All appropriate for dawn calculations (< 90°)

### Fixed Minute Range Analysis
Fixed-minute formulas use: 24min, 60min, 72min, 90min, 96min, 120min
- All reasonable for dawn calculations
- Range: 24-120 minutes before sunrise

---

## Critical Action Items

### Priority 1: Fix Invalid DSL Functions
The following zmanim MUST be corrected before they can be used:

1. **alos_120_zmanis** (ID: 21) - Replace `proportional_minutes(120, before_sunrise)`
2. **alos_72_zmanis** (ID: 29) - Replace `proportional_minutes(72, before_sunrise)`
3. **alos_90_zmanis** (ID: 31) - Replace `proportional_minutes(90, before_sunrise)`
4. **alos_96_zmanis** (ID: 33) - Replace `proportional_minutes(96, before_sunrise)`

**Possible Solutions:**
- Option A: Implement `proportional_minutes` function in DSL
- Option B: Use existing DSL to express the same calculation (e.g., using proportional_hours with custom base)
- Option C: Use conditional logic with day_length comparisons

### Priority 2: Add Missing Shita Tags
Consider adding appropriate shita tags to:
- alos_19_8, alos_26
- alos_90_zmanis, alos_96_zmanis, alos_120_zmanis (after fixing DSL)

### Priority 3: Validate Against KosherJava
Cross-reference all formulas against KosherJava library implementation to ensure accuracy of angles and minute values.

---

## Appendix: DSL Validation Rules

Based on `/home/daniel/repos/zmanim/api/internal/dsl/validator.go`:

### Solar Function Validation
- **Parameters:** 2 required (degrees, direction)
- **Degrees:** Must be 0-90
- **Direction:** Must be valid direction keyword
- **Valid Directions:** before_sunrise, after_sunset, before_noon, after_noon

### Seasonal Solar Function Validation
- **Parameters:** 2 required (degrees, direction)
- **Degrees:** Must be 0-90
- **Direction:** Only before_sunrise or after_sunset (stricter than solar)

### Proportional Hours Function Validation
- **Parameters:** 2 required (hours, base)
- **Hours:** Must be 0.5-12
- **Base:** Must be valid base keyword or custom(start, end)
- **Valid Bases:** gra, mga, mga_60, mga_72, mga_90, mga_96, mga_120, mga_72_zmanis, mga_90_zmanis, mga_96_zmanis, mga_16_1, mga_18, mga_19_8, mga_26, baal_hatanya, custom

### Binary Operations
- Time + Duration = Time ✅
- Time - Time = Duration ✅
- Time - Duration = Time ✅
- Duration + Duration = Duration ✅
- Duration - Duration = Duration ✅
- Duration * Number = Duration ✅

---

## Test Query

To verify these zmanim in the database:

```sql
SELECT
    mz.id,
    mz.zman_key,
    mz.canonical_english_name,
    mz.default_formula_dsl,
    tc.key as category,
    ARRAY_AGG(DISTINCT zt.tag_key ORDER BY zt.tag_key) FILTER (WHERE zt.tag_key IS NOT NULL) as tags
FROM master_zmanim_registry mz
LEFT JOIN time_categories tc ON mz.time_category_id = tc.id
LEFT JOIN master_zman_tags mzt ON mz.id = mzt.master_zman_id
LEFT JOIN zman_tags zt ON mzt.tag_id = zt.id
WHERE mz.zman_key LIKE '%alos%' OR mz.zman_key LIKE '%dawn%' OR tc.key = 'dawn'
GROUP BY mz.id, mz.zman_key, mz.canonical_english_name, mz.default_formula_dsl, tc.key
ORDER BY mz.zman_key;
```

---

**Audit Completed By:** Claude Code
**Next Steps:** Address Priority 1 critical issues before using affected zmanim in production
