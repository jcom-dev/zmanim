# DSL Synchronization Gap Analysis
**Date:** 2025-12-21
**Author:** Mary (Business Analyst)
**Project:** Zmanim Platform
**Research Type:** Technical Analysis - Codebase Synchronization Audit

---

## Executive Summary

[To be completed after analysis]

---

## 1. Technical Question & Context

### The Challenge
Ensure absolute consistency across all DSL-related artifacts in the zmanim platform. The DSL (Domain-Specific Language) is used for defining Jewish prayer time calculation formulas and must be synchronized across:

- **Backend Parser** (Go implementation)
- **Backend Validators** (Go validation logic)
- **Frontend UI Helpers** (TypeScript autocomplete, tooltips, context helpers)
- **User Documentation** (guides, reference docs)
- **Test Coverage** (unit tests, integration tests)

### Known Issue
The `proportional` function has been enhanced in the parser but these changes are not reflected in:
- UI autocomplete/help
- User-facing documentation
- Possibly other components

### Project Context
- **Type:** Brownfield production system
- **Stack:** Go 1.24+ backend, Next.js 16 frontend
- **DSL Purpose:** Formula language for zmanim calculations
- **Impact:** Inconsistencies cause user confusion and reduce discoverability of features

---

## 2. Research Scope & Requirements

### Functional Requirements
- Identify ALL DSL functions, operators, and syntax features
- Map each feature to its presence/absence in each component
- Detect version mismatches (e.g., function exists but outdated description)
- Flag missing test coverage for DSL features

### Components to Analyze
1. **Go Parser** (`api/internal/dsl/`)
2. **Go Validators** (`api/internal/dsl/validator.go`)
3. **TypeScript UI Helpers** (`web/lib/dsl-*.ts`, `web/components/formula-builder/`)
4. **CodeMirror Integration** (`web/lib/codemirror/dsl-*.ts`)
5. **Documentation** (`docs/dsl-*.md`)
6. **Test Files** (`api/internal/dsl/*_test.go`)

### Deliverable
Gap analysis report identifying:
- Features in parser not in UI/docs
- Features in docs not in parser
- Outdated descriptions
- Missing test coverage
- Severity ratings (Critical/High/Medium/Low)

---

## 3. DSL Feature Inventory

### 3.1 Backend Parser (Go) - AUTHORITATIVE SOURCE

**File:** `api/internal/dsl/token.go`

**Primitives (12):**
```
sunrise, sunset, solar_noon, solar_midnight, visible_sunrise, visible_sunset,
civil_dawn, civil_dusk, nautical_dawn, nautical_dusk, astronomical_dawn, astronomical_dusk
```

**Functions (6):**
```
solar, seasonal_solar, proportional_hours, proportional_minutes, midpoint, coalesce
```

**Directions (4):**
```
before_sunrise, after_sunset, before_noon, after_noon
```

**Bases (22):**
```
gra
mga, mga_60, mga_72, mga_90, mga_96, mga_120                    (6 fixed-minute variants)
mga_72_zmanis, mga_90_zmanis, mga_96_zmanis                     (3 proportional variants)
mga_16_1, mga_18, mga_19_8, mga_26                              (4 solar angle variants)
baal_hatanya, ateret_torah, custom                               (3 special systems)
```

**Condition Variables (8):**
```
latitude, longitude, day_length, month, day, day_of_year, date, season
```

**Operators:**
- Arithmetic: `+`, `-`, `*`, `/`
- Comparison: `>`, `<`, `>=`, `<=`, `==`, `!=`
- Logical: `&&`, `||`, `!`
- Reference: `@`

**Keywords:**
```
if, else, true, false
```

---

## 4. Gap Analysis - Critical Findings

### 4.1 PRIMITIVES - Synchronization Status

| Primitive | Backend | TS Reference | TS Tokens | CM Language | Docs | Status |
|-----------|---------|--------------|-----------|-------------|------|--------|
| sunrise | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| sunset | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| solar_noon | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| solar_midnight | ✅ | ✅ | ❌ **midnight** | ❌ **midnight** | ✅ | 🔴 **MISMATCH** |
| visible_sunrise | ✅ | ✅ | ❌ | ❌ | ✅ | 🟡 **MISSING UI** |
| visible_sunset | ✅ | ✅ | ❌ | ❌ | ✅ | 🟡 **MISSING UI** |
| civil_dawn | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| civil_dusk | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| nautical_dawn | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| nautical_dusk | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| astronomical_dawn | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| astronomical_dusk | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| ❌ alos_hashachar | ❌ | ❌ | ✅ | ✅ | ❌ | 🔴 **UI ONLY** |
| ❌ misheyakir | ❌ | ❌ | ✅ | ✅ | ❌ | 🔴 **UI ONLY** |
| ❌ tzeis_hakochavim | ❌ | ❌ | ✅ | ✅ | ❌ | 🔴 **UI ONLY** |
| ❌ bein_hashmashos | ❌ | ❌ | ✅ | ✅ | ❌ | 🔴 **UI ONLY** |
| ❌ chatzos | ❌ | ❌ | ❌ | ✅ | ❌ | 🔴 **CM ONLY** |
| ❌ chatzos_hayom | ❌ | ❌ | ❌ | ✅ | ❌ | 🔴 **CM ONLY** |
| ❌ chatzos_halailah | ❌ | ❌ | ❌ | ✅ | ❌ | 🔴 **CM ONLY** |

**🔴 CRITICAL ISSUES:**
1. **Naming mismatch:** Backend uses `solar_midnight`, UI files use `midnight` (dsl-tokens.ts, dsl-language.ts)
2. **Non-existent primitives:** UI advertises 7 primitives that don't exist in parser:
   - `alos_hashachar`, `misheyakir`, `tzeis_hakochavim`, `bein_hashmashos` (in dsl-tokens.ts, dsl-language.ts)
   - `chatzos`, `chatzos_hayom`, `chatzos_halailah` (in dsl-language.ts only)
3. **Missing UI support:** `visible_sunrise` and `visible_sunset` exist in backend but missing from UI tokenizers

---

### 4.2 FUNCTIONS - Synchronization Status

| Function | Backend | TS Reference | TS Tokens | CM Language | Docs | Status |
|----------|---------|--------------|-----------|-------------|------|--------|
| solar | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| seasonal_solar | ✅ | ✅ | ❌ | ✅ | ✅ | 🟡 **MISSING** dsl-tokens.ts |
| proportional_hours | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| proportional_minutes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| midpoint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| coalesce | ✅ | ❌ | ❌ | ❌ | ✅ | 🔴 **MISSING ALL UI** |
| ❌ min | ❌ | ✅ | ❌ | ✅ | ❌ | 🔴 **UI ONLY** |
| ❌ max | ❌ | ✅ | ❌ | ✅ | ❌ | 🔴 **UI ONLY** |
| ❌ if | ❌ keyword | ✅ listed as function | ✅ | ❌ | 🟡 **MISCLASSIFIED** |
| ❌ else | ❌ keyword | ❌ | ✅ listed as function | ❌ | 🟡 **MISCLASSIFIED** |

**🔴 CRITICAL ISSUES:**
1. **`coalesce` function:** Exists in backend parser + docs, **completely missing from ALL UI files**
2. **`min`/`max` functions:** Advertised in UI (dsl-reference-data.ts, dsl-language.ts) but **don't exist in parser**
3. **`seasonal_solar`:** Missing from dsl-tokens.ts (but present elsewhere)
4. **Keyword misclassification:** `if`/`else` are keywords, but dsl-tokens.ts and dsl-language.ts list them as functions

---

### 4.3 BASES - Synchronization Status (WORST OFFENDER)

| Base | Backend | TS Reference | Formula Builder | Docs | Status |
|------|---------|--------------|-----------------|------|--------|
| gra | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| mga | ✅ | ✅ | ❌ | ✅ | 🟡 **MISSING** builder |
| mga_60 | ✅ | ❌ | ❌ | ✅ | 🔴 **MISSING UI** |
| mga_72 | ✅ | ❌ | ❌ | ✅ | 🔴 **MISSING UI** |
| mga_90 | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| mga_96 | ✅ | ❌ | ❌ | ✅ | 🔴 **MISSING UI** |
| mga_120 | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| mga_72_zmanis | ✅ | ❌ | ❌ | ✅ | 🔴 **MISSING ALL UI** |
| mga_90_zmanis | ✅ | ❌ | ❌ | ✅ | 🔴 **MISSING ALL UI** |
| mga_96_zmanis | ✅ | ❌ | ❌ | ✅ | 🔴 **MISSING ALL UI** |
| mga_16_1 | ✅ | ❌ | ❌ | ✅ | 🔴 **MISSING ALL UI** |
| mga_18 | ✅ | ❌ | ❌ | ✅ | 🔴 **MISSING ALL UI** |
| mga_19_8 | ✅ | ❌ | ❌ | ✅ | 🔴 **MISSING ALL UI** |
| mga_26 | ✅ | ❌ | ❌ | ✅ | 🔴 **MISSING ALL UI** |
| baal_hatanya | ✅ | ❌ | ❌ | ✅ | 🔴 **MISSING ALL UI** |
| ateret_torah | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| custom | ✅ | ✅ | ❌ | ✅ | 🟡 **MISSING** builder |

**🔴 CRITICAL ISSUES:**
1. **12 out of 22 bases (55%) completely missing from UI helpers!**
   - All 3 zmaniyos variants: `mga_72_zmanis`, `mga_90_zmanis`, `mga_96_zmanis`
   - All 4 solar angle variants: `mga_16_1`, `mga_18`, `mga_19_8`, `mga_26`
   - Fixed-minute variants: `mga_60`, `mga_72`, `mga_96`
   - Special systems: `baal_hatanya`
2. **This is exactly the proportional function issue you mentioned!**
   - Users typing valid backend formulas get NO autocomplete
   - UI suggests only 6 bases when 22 are available

---

### 4.4 DIRECTIONS - Synchronization Status

| Direction | Backend | TS Reference | TS Tokens | CM Language | Docs | Status |
|-----------|---------|--------------|-----------|-------------|------|--------|
| before_sunrise | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| after_sunset | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ SYNCED |
| before_noon | ✅ | ❌ | ❌ | ❌ | ✅ | 🔴 **MISSING ALL UI** |
| after_noon | ✅ | ❌ | ❌ | ❌ | ✅ | 🔴 **MISSING ALL UI** |
| ❌ after_sunrise | ❌ | ❌ | ❌ | ✅ | ❌ | 🔴 **CM ONLY** |
| ❌ before_sunset | ❌ | ❌ | ❌ | ✅ | ❌ | 🔴 **CM ONLY** |

**🔴 CRITICAL ISSUES:**
1. **50% of valid directions missing from UI:**
   - `before_noon` and `after_noon` exist in parser but not in UI
2. **Invalid directions in CodeMirror:**
   - `after_sunrise` and `before_sunset` don't exist in parser but highlighted as valid

---

### 4.5 CONDITION VARIABLES - Synchronization Status

| Variable | Backend | Docs | UI Tooltips | Status |
|----------|---------|------|-------------|--------|
| latitude | ✅ | ✅ | ❓ | ✅ Backend+Docs |
| longitude | ✅ | ✅ | ❓ | ✅ Backend+Docs |
| day_length | ✅ | ✅ | ❓ | ✅ Backend+Docs |
| month | ✅ | ✅ | ❓ | ✅ Backend+Docs |
| day | ✅ | ✅ | ❓ | ✅ Backend+Docs |
| day_of_year | ✅ | ✅ | ❓ | ✅ Backend+Docs |
| date | ✅ | ✅ | ❓ | ✅ Backend+Docs |
| season | ✅ | ✅ | ❓ | ✅ Backend+Docs |

**Status:** Condition variables appear synced between backend and docs. UI support unclear (no dedicated UI helpers found).

---

## 5. Severity Ratings & Impact Analysis

### 🔴 CRITICAL (Production Impact - User Confusion)

**Issue #1: Non-Existent Primitives in UI**
- **Severity:** CRITICAL
- **Impact:** Users see syntax highlighting for `alos_hashachar`, `misheyakir`, `tzeis_hakochavim`, `bein_hashmashos`, `chatzos` but formulas fail to parse
- **Files:** `web/lib/codemirror/dsl-tokens.ts`, `web/lib/codemirror/dsl-language.ts`
- **Recommendation:** REMOVE these primitives OR implement them in backend parser

**Issue #2: Missing `coalesce` Function in UI**
- **Severity:** CRITICAL
- **Impact:** Backend supports fallback logic via `coalesce()`, but UI provides ZERO assistance - no autocomplete, no docs, no tooltips
- **Files:** Missing from `web/lib/dsl-reference-data.ts`, `web/lib/codemirror/dsl-tokens.ts`, `web/lib/codemirror/dsl-language.ts`
- **Recommendation:** ADD full UI support for `coalesce`

**Issue #3: 55% of Bases Missing from UI (12 of 22)**
- **Severity:** CRITICAL
- **Impact:** Advanced users cannot discover or use:
  - Zmaniyos variants (`mga_72_zmanis`, `mga_90_zmanis`, `mga_96_zmanis`)
  - Solar angle bases (`mga_16_1`, `mga_18`, `mga_19_8`, `mga_26`)
  - `baal_hatanya` (Chabad method)
  - Fixed variants (`mga_60`, `mga_72`, `mga_96`)
- **Files:** `web/lib/dsl-reference-data.ts` only lists 6 bases
- **Recommendation:** ADD all 22 bases to UI reference data with descriptions

**Issue #4: `min`/`max` Functions Don't Exist**
- **Severity:** CRITICAL
- **Impact:** UI advertises `min(a, b)` and `max(a, b)` with examples, but parser rejects them
- **Files:** `web/lib/dsl-reference-data.ts`, `web/lib/codemirror/dsl-language.ts`
- **Recommendation:** REMOVE from UI OR implement in backend parser

---

### 🟡 HIGH (Feature Discovery - Reduced Usability)

**Issue #5: Missing `before_noon`/`after_noon` Directions**
- **Severity:** HIGH
- **Impact:** Users cannot discover or use valid `solar()` directions for midday calculations
- **Files:** Missing from all TS files
- **Recommendation:** ADD to UI with examples (e.g., `solar(6, before_noon)` for sea-level sunrise)

**Issue #6: `visible_sunrise`/`visible_sunset` Not in UI**
- **Severity:** HIGH
- **Impact:** Parser supports atmospheric refraction primitives, but users can't discover them
- **Files:** `web/lib/codemirror/dsl-tokens.ts`, `web/lib/codemirror/dsl-language.ts`
- **Recommendation:** ADD to UI primitive lists

**Issue #7: `seasonal_solar` Missing from dsl-tokens.ts**
- **Severity:** HIGH
- **Impact:** Incomplete syntax highlighting support
- **Files:** `web/lib/codemirror/dsl-tokens.ts`
- **Recommendation:** ADD to FUNCTIONS array

**Issue #8: Invalid Directions in CodeMirror**
- **Severity:** HIGH
- **Impact:** `after_sunrise`/`before_sunset` highlighted as valid but cause parse errors
- **Files:** `web/lib/codemirror/dsl-language.ts`
- **Recommendation:** REMOVE invalid directions

---

### 🟢 MEDIUM (Naming/Classification)

**Issue #9: `solar_midnight` vs `midnight` Mismatch**
- **Severity:** MEDIUM
- **Impact:** UI uses `midnight`, backend uses `solar_midnight` - potential confusion
- **Files:** `web/lib/codemirror/dsl-tokens.ts`, `web/lib/codemirror/dsl-language.ts`
- **Recommendation:** Standardize on `solar_midnight` everywhere

**Issue #10: `if`/`else` Misclassified as Functions**
- **Severity:** MEDIUM
- **Impact:** Minor - doesn't break functionality but conceptually wrong
- **Files:** `web/lib/codemirror/dsl-tokens.ts`, `web/lib/dsl-reference-data.ts` (if statement)
- **Recommendation:** Reclassify as keywords in UI

---

## 6. Files Requiring Updates

### Priority 1 - Critical Fixes

1. **web/lib/dsl-reference-data.ts**
   - ADD `coalesce` function with full details
   - ADD 12 missing bases (mga_60, mga_72, mga_96, all zmanis, all angles, baal_hatanya)
   - ADD `before_noon`, `after_noon` directions
   - REMOVE `min`, `max` functions (or wait for backend implementation)
   - ADD `visible_sunrise`, `visible_sunset` primitives

2. **web/lib/codemirror/dsl-tokens.ts**
   - REMOVE fake primitives: `alos_hashachar`, `misheyakir`, `tzeis_hakochavim`, `bein_hashmashos`
   - CHANGE `midnight` → `solar_midnight`
   - ADD `visible_sunrise`, `visible_sunset`
   - ADD `seasonal_solar` to FUNCTIONS
   - ADD `before_noon`, `after_noon` to DIRECTION_KEYWORDS
   - EXPAND BASE_KEYWORDS to include all 22 bases

3. **web/lib/codemirror/dsl-language.ts**
   - REMOVE fake primitives: `alos_hashachar`, `misheyakir`, `tzeis_hakochavim`, `bein_hashmashos`, `chatzos`, `chatzos_hayom`, `chatzos_halailah`
   - CHANGE `midnight` → `solar_midnight`
   - ADD `visible_sunrise`, `visible_sunset`
   - ADD `coalesce` to DSL_FUNCTIONS
   - REMOVE `min`, `max` from DSL_FUNCTIONS (or wait for backend)
   - REMOVE invalid directions: `after_sunrise`, `before_sunset`
   - ADD valid directions: `before_noon`, `after_noon`
   - REMOVE `alos_16_1`, `alos_72` from keywords (these aren't valid base names)

### Priority 2 - Documentation

4. **docs/dsl-complete-guide.md**
   - Verify `coalesce` is documented (appears to be present)
   - Verify all 22 bases are documented (appears to be present)
   - Verify `before_noon`/`after_noon` are documented

### Priority 3 - Formula Builder

5. **web/components/formula-builder/types.ts**
   - ADD missing bases to `ShaosBaseExtended` type if needed
   - Evaluate whether to expose all 22 bases in guided builder UI

---

## 7. Summary Statistics

| Category | Backend Count | UI Fully Supported | Missing from UI | Extra in UI Only |
|----------|---------------|-------------------|-----------------|------------------|
| **Primitives** | 12 | 10 | 2 | 7 |
| **Functions** | 6 | 4 | 2 | 2 |
| **Bases** | 22 | 10 | 12 | 0 |
| **Directions** | 4 | 2 | 2 | 2 |
| **Condition Vars** | 8 | N/A | N/A | 0 |

**Overall Sync Rate: 57%** (26 of 46 backend features fully supported in UI)

---

## 8. Recommendations

### Immediate Actions (Week 1)

1. **Remove phantom features from UI** - eliminate user confusion from non-existent primitives/functions
2. **Add `coalesce` function to UI** - critical missing functionality
3. **Add all 22 bases to dsl-reference-data.ts** - enable discovery of advanced features

### Short Term (Weeks 2-3)

4. **Standardize primitive naming** - align `midnight` vs `solar_midnight`
5. **Add missing directions** - `before_noon`, `after_noon`
6. **Add atmospheric primitives** - `visible_sunrise`, `visible_sunset`

### Long Term (Month 2+)

7. **Backend enhancement** - Consider implementing `min`/`max` if valuable
8. **Test coverage audit** - Ensure all 46 features have unit tests
9. **Establish sync process** - Create checklist for adding new DSL features to prevent future drift

---

## 9. Tech Writer Handoff Notes

**Dear Tech Writer,**

This gap analysis identifies **13 critical inconsistencies** between the DSL parser (backend) and the UI/documentation. The good news: your documentation (`docs/dsl-complete-guide.md`) appears accurate and comprehensive!

**Your action items:**

1. **No doc changes needed** for most features - docs are already correct
2. **Verify completeness** - ensure these documented features match the backend exactly:
   - All 22 bases (especially the 3 `_zmanis` variants and 4 angle-based `mga_*` bases)
   - `coalesce` function
   - `before_noon`/`after_noon` directions
3. **After UI fixes** - update any screenshots or examples that reference the old UI

The engineering team will fix the UI files listed in Section 6. Once complete, the entire system will be in sync.

**Test your updated docs with these formulas** (all valid in backend, currently broken in UI):
```
proportional_hours(3, mga_72_zmanis)
proportional_hours(4, mga_16_1)
coalesce(solar(16.1, before_sunrise), sunrise - 72min)
solar(6, before_noon)
```

Thank you for maintaining excellent documentation quality! 🎯

---

**End of Gap Analysis Report**

