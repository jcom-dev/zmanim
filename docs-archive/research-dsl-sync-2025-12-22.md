# DSL Synchronization Gap Analysis - Complete Audit
**Date:** 2025-12-22
**Author:** Mary (Business Analyst)
**Project:** Zmanim Platform
**Research Type:** Technical Analysis - Full Codebase Synchronization Audit

---

## Executive Summary

This audit reveals **significant synchronization gaps** between the backend DSL parser and the frontend UI reference panel. The most critical finding: **three entire categories of DSL features exist in the data file but are NOT rendered in the UI**.

**Key Finding:** Users cannot see or discover `if/else` conditionals, condition variables (latitude, month, season), or date literals in the right-hand reference panel because these arrays are defined but never imported into the rendering component.

**Overall Sync Rate:** ~70% (significant improvement possible with targeted fixes)

---

## 1. Critical Gap: UI Panel Missing Categories

### ROOT CAUSE IDENTIFIED

**File:** `web/components/editor/DSLReferencePanel.tsx`

The component imports only 6 of 9 available arrays from `dsl-reference-data.ts`:

```typescript
// CURRENT IMPORTS (lines 7-18)
import {
  DSL_PRIMITIVES,           // ✅ Rendered
  DSL_FUNCTIONS,            // ✅ Rendered
  DSL_PROPORTIONAL_BASES,   // ✅ Rendered (as "Day Boundaries")
  DSL_DIRECTIONS,           // ✅ Rendered (as "Solar Directions")
  DSL_OPERATORS,            // ✅ Rendered
  EXAMPLE_PATTERNS,         // ✅ Rendered (as "Common Patterns")
  // ❌ MISSING: DSL_CONDITIONALS
  // ❌ MISSING: DSL_CONDITION_VARIABLES
  // ❌ MISSING: DSL_DATE_LITERALS
} from '@/lib/dsl-reference-data';
```

### IMPACT

Users typing conditional formulas like:
```
if (latitude > 50) { sunrise - 90min } else { sunrise - 72min }
```

...get NO assistance from the reference panel for:
- `if...else` syntax
- `latitude`, `longitude`, `month`, `day`, `season`, `day_length`, `date`, `day_of_year`
- Date literal format (`21-May`, `1-Jan`)

---

## 2. Backend Parser Inventory (Authoritative Source)

**Source:** `api/internal/dsl/token.go`, `executor.go`

### 2.1 Primitives (14 total)

| Primitive | Description |
|-----------|-------------|
| `sunrise` | Alias for visible_sunrise |
| `sunset` | Alias for visible_sunset |
| `visible_sunrise` | Sunrise with atmospheric refraction |
| `visible_sunset` | Sunset with atmospheric refraction |
| `geometric_sunrise` | Pure geometric sunrise (no refraction) |
| `geometric_sunset` | Pure geometric sunset (no refraction) |
| `solar_noon` | Sun at highest point |
| `solar_midnight` | Sun at lowest point |
| `civil_dawn` | Sun at -6° (morning) |
| `civil_dusk` | Sun at -6° (evening) |
| `nautical_dawn` | Sun at -12° (morning) |
| `nautical_dusk` | Sun at -12° (evening) |
| `astronomical_dawn` | Sun at -18° (morning) |
| `astronomical_dusk` | Sun at -18° (evening) |

### 2.2 Functions (8 total)

| Function | Signature | Purpose |
|----------|-----------|---------|
| `solar` | `solar(degrees, direction)` | Time at specific sun angle |
| `seasonal_solar` | `seasonal_solar(degrees, direction)` | Proportional solar angle (ROY method) |
| `proportional_hours` | `proportional_hours(hours, base)` | Shaos zmaniyos |
| `proportional_minutes` | `proportional_minutes(minutes, direction)` | Zmaniyos minutes |
| `midpoint` | `midpoint(time1, time2)` | Average of two times |
| `first_valid` | `first_valid(expr1, expr2, ...)` | First non-null fallback |
| `earlier_of` | `earlier_of(time1, time2)` | Earlier of two times |
| `later_of` | `later_of(time1, time2)` | Later of two times |

### 2.3 Directions (13 total)

| Direction | Notes |
|-----------|-------|
| `before_sunrise` | Alias for before_visible_sunrise |
| `after_sunrise` | Alias for after_visible_sunrise |
| `after_sunset` | Alias for after_visible_sunset |
| `before_visible_sunrise` | Standard |
| `after_visible_sunrise` | Standard |
| `before_visible_sunset` | Standard |
| `after_visible_sunset` | Standard |
| `before_geometric_sunrise` | No refraction |
| `after_geometric_sunrise` | No refraction |
| `before_geometric_sunset` | No refraction |
| `after_geometric_sunset` | No refraction |
| `before_noon` | Solar noon reference |
| `after_noon` | Solar noon reference |

### 2.4 Bases (17 total)

| Base | Description |
|------|-------------|
| `gra` | GRA (Vilna Gaon): sunrise to sunset |
| `mga` | MGA default (alias for mga_72) |
| `mga_60` | MGA 60 minutes before/after |
| `mga_72` | MGA 72 minutes before/after |
| `mga_90` | MGA 90 minutes before/after |
| `mga_96` | MGA 96 minutes before/after |
| `mga_120` | MGA 120 minutes before/after |
| `mga_72_zmanis` | MGA 72 proportional minutes |
| `mga_90_zmanis` | MGA 90 proportional minutes |
| `mga_96_zmanis` | MGA 96 proportional minutes |
| `mga_16_1` | MGA 16.1° angle |
| `mga_18` | MGA 18° angle |
| `mga_19_8` | MGA 19.8° angle |
| `mga_26` | MGA 26° angle |
| `baal_hatanya` | Baal HaTanya (Chabad) |
| `ateret_torah` | Ateret Torah (Sephardic) |
| `custom` | User-defined: `custom(start, end)` |

### 2.5 Keywords (2)

| Keyword | Usage |
|---------|-------|
| `if` | Conditional: `if (condition) { expr }` |
| `else` | Alternative: `else { expr }` |

### 2.6 Condition Variables (8 total)

| Variable | Type | Description |
|----------|------|-------------|
| `latitude` | Number | Degrees (-90 to 90) |
| `longitude` | Number | Degrees (-180 to 180) |
| `day_length` | Duration | Minutes from sunrise to sunset |
| `month` | Number | 1-12 |
| `day` | Number | 1-31 |
| `day_of_year` | Number | 1-366 |
| `date` | Date | For comparison with literals |
| `season` | String | "spring", "summer", "autumn", "winter" |

### 2.7 Operators

**Arithmetic:** `+`, `-`, `*`, `/`
**Comparison:** `>`, `<`, `>=`, `<=`, `==`, `!=`
**Logical:** `&&`, `||`, `!`
**Special:** `@` (reference)

---

## 3. Frontend Reference Data Inventory

**Source:** `web/lib/dsl-reference-data.ts`

### 3.1 What's Defined (✅ Comprehensive)

| Array | Count | Description |
|-------|-------|-------------|
| `DSL_PRIMITIVES` | 12 | Core astronomical events |
| `DSL_FUNCTIONS` | 8 | All backend functions |
| `DSL_PROPORTIONAL_BASES` | 17 | All bases including custom |
| `DSL_DIRECTIONS` | 10 | All direction parameters |
| `DSL_OPERATORS` | 13 | All operators |
| `DSL_CONDITIONALS` | 1 | `if...else` syntax |
| `DSL_CONDITION_VARIABLES` | 8 | All condition variables |
| `DSL_DATE_LITERALS` | 1 | Date format explanation |
| `EXAMPLE_PATTERNS` | 10 | Common formula examples |

**Assessment:** The reference data file is COMPREHENSIVE and matches the backend!

### 3.2 What's Rendered in UI (❌ Incomplete)

| Category | Rendered? | Notes |
|----------|-----------|-------|
| Primitives | ✅ Yes | 12 items shown |
| Functions | ✅ Yes | 8 items shown |
| Day Boundaries | ✅ Yes | 17 items (collapsed) |
| Solar Directions | ✅ Yes | 10 items (collapsed) |
| Operators | ✅ Yes | 13 items shown |
| **Conditionals** | ❌ **NO** | Array exists but NOT imported/rendered! |
| **Condition Variables** | ❌ **NO** | Array exists but NOT imported/rendered! |
| **Date Literals** | ❌ **NO** | Array exists but NOT imported/rendered! |
| Common Patterns | ✅ Yes | 10 examples shown |

---

## 4. Gap Analysis Matrix

### 4.1 CRITICAL: UI Categories Not Rendered

| Category | Backend | Data File | UI Panel | Status |
|----------|---------|-----------|----------|--------|
| Conditionals | ✅ | ✅ | ❌ | 🔴 **NOT RENDERED** |
| Condition Variables | ✅ | ✅ | ❌ | 🔴 **NOT RENDERED** |
| Date Literals | ✅ | ✅ | ❌ | 🔴 **NOT RENDERED** |

### 4.2 Primitives Comparison

| Primitive | Backend | Data File | UI Panel | Status |
|-----------|---------|-----------|----------|--------|
| sunrise | ✅ alias | ❌ | ❌ | 🟡 Alias not exposed |
| sunset | ✅ alias | ❌ | ❌ | 🟡 Alias not exposed |
| visible_sunrise | ✅ | ✅ | ✅ | ✅ SYNCED |
| visible_sunset | ✅ | ✅ | ✅ | ✅ SYNCED |
| geometric_sunrise | ✅ | ✅ | ✅ | ✅ SYNCED |
| geometric_sunset | ✅ | ✅ | ✅ | ✅ SYNCED |
| solar_noon | ✅ | ✅ | ✅ | ✅ SYNCED |
| solar_midnight | ✅ | ✅ | ✅ | ✅ SYNCED |
| civil_dawn | ✅ | ✅ | ✅ | ✅ SYNCED |
| civil_dusk | ✅ | ✅ | ✅ | ✅ SYNCED |
| nautical_dawn | ✅ | ✅ | ✅ | ✅ SYNCED |
| nautical_dusk | ✅ | ✅ | ✅ | ✅ SYNCED |
| astronomical_dawn | ✅ | ✅ | ✅ | ✅ SYNCED |
| astronomical_dusk | ✅ | ✅ | ✅ | ✅ SYNCED |

**Note:** Backend accepts `sunrise`/`sunset` as aliases for `visible_sunrise`/`visible_sunset`. Consider adding these aliases to UI for user convenience.

### 4.3 Functions Comparison

| Function | Backend | Data File | UI Panel | Status |
|----------|---------|-----------|----------|--------|
| solar | ✅ | ✅ | ✅ | ✅ SYNCED |
| seasonal_solar | ✅ | ✅ | ✅ | ✅ SYNCED |
| proportional_hours | ✅ | ✅ | ✅ | ✅ SYNCED |
| proportional_minutes | ✅ | ✅ | ✅ | ✅ SYNCED |
| midpoint | ✅ | ✅ | ✅ | ✅ SYNCED |
| first_valid | ✅ | ✅ | ✅ | ✅ SYNCED |
| earlier_of | ✅ | ✅ | ✅ | ✅ SYNCED |
| later_of | ✅ | ✅ | ✅ | ✅ SYNCED |

**Assessment:** All functions are properly synchronized!

### 4.4 Directions Comparison

| Direction | Backend | Data File | UI Panel | Status |
|-----------|---------|-----------|----------|--------|
| before_visible_sunrise | ✅ | ✅ | ✅ | ✅ SYNCED |
| after_visible_sunrise | ✅ | ✅ | ✅ | ✅ SYNCED |
| before_visible_sunset | ✅ | ✅ | ✅ | ✅ SYNCED |
| after_visible_sunset | ✅ | ✅ | ✅ | ✅ SYNCED |
| before_geometric_sunrise | ✅ | ✅ | ✅ | ✅ SYNCED |
| after_geometric_sunrise | ✅ | ✅ | ✅ | ✅ SYNCED |
| before_geometric_sunset | ✅ | ✅ | ✅ | ✅ SYNCED |
| after_geometric_sunset | ✅ | ✅ | ✅ | ✅ SYNCED |
| before_noon | ✅ | ✅ | ✅ | ✅ SYNCED |
| after_noon | ✅ | ✅ | ✅ | ✅ SYNCED |
| before_sunrise | ✅ alias | ❌ | ❌ | 🟡 Alias not exposed |
| after_sunrise | ✅ alias | ❌ | ❌ | 🟡 Alias not exposed |
| after_sunset | ✅ alias | ❌ | ❌ | 🟡 Alias not exposed |

**Note:** Backend accepts short aliases. Consider adding for user convenience.

### 4.5 Bases Comparison

| Base | Backend | Data File | UI Panel | Status |
|------|---------|-----------|----------|--------|
| gra | ✅ | ✅ | ✅ | ✅ SYNCED |
| mga | ✅ | ✅ | ✅ | ✅ SYNCED |
| mga_60 | ✅ | ✅ | ✅ | ✅ SYNCED |
| mga_72 | ✅ | ✅ | ✅ | ✅ SYNCED |
| mga_90 | ✅ | ✅ | ✅ | ✅ SYNCED |
| mga_96 | ✅ | ✅ | ✅ | ✅ SYNCED |
| mga_120 | ✅ | ✅ | ✅ | ✅ SYNCED |
| mga_72_zmanis | ✅ | ✅ | ✅ | ✅ SYNCED |
| mga_90_zmanis | ✅ | ✅ | ✅ | ✅ SYNCED |
| mga_96_zmanis | ✅ | ✅ | ✅ | ✅ SYNCED |
| mga_16_1 | ✅ | ✅ | ✅ | ✅ SYNCED |
| mga_18 | ✅ | ✅ | ✅ | ✅ SYNCED |
| mga_19_8 | ✅ | ✅ | ✅ | ✅ SYNCED |
| mga_26 | ✅ | ✅ | ✅ | ✅ SYNCED |
| baal_hatanya | ✅ | ✅ | ✅ | ✅ SYNCED |
| ateret_torah | ✅ | ✅ | ✅ | ✅ SYNCED |
| custom | ✅ | ✅ | ✅ | ✅ SYNCED |

**Assessment:** All bases are properly synchronized!

---

## 5. Summary of Issues by Severity

### 🔴 CRITICAL (Blocks Feature Discovery)

**Issue #1: Three DSL categories not rendered in UI**

| Issue | Impact | Fix |
|-------|--------|-----|
| `DSL_CONDITIONALS` not imported/rendered | Users can't discover `if/else` syntax | Add import + Category component |
| `DSL_CONDITION_VARIABLES` not imported/rendered | Users can't discover `latitude`, `month`, etc. | Add import + Category component |
| `DSL_DATE_LITERALS` not imported/rendered | Users can't discover date format | Add import + Category component |

**Estimated Fix Time:** 15-30 minutes

### 🟡 MEDIUM (Usability Enhancement)

**Issue #2: Primitive/Direction aliases not exposed**

| Alias | Maps To | Benefit |
|-------|---------|---------|
| `sunrise` | `visible_sunrise` | Shorter, more familiar |
| `sunset` | `visible_sunset` | Shorter, more familiar |
| `before_sunrise` | `before_visible_sunrise` | Shorter |
| `after_sunrise` | `after_visible_sunrise` | Shorter |
| `after_sunset` | `after_visible_sunset` | Shorter |

**Recommendation:** Add these as separate items or note in descriptions.

### 🟢 LOW (Nice to Have)

- Add more example patterns for conditionals
- Consider adding `elevation` condition variable (found in executor.go)

---

## 6. Recommended Actions

### Priority 1: Fix Missing UI Categories (CRITICAL)

**File:** `web/components/editor/DSLReferencePanel.tsx`

**Step 1:** Update imports (line 7-18):
```typescript
import {
  DSL_PRIMITIVES,
  DSL_FUNCTIONS,
  DSL_PROPORTIONAL_BASES,
  DSL_DIRECTIONS,
  DSL_OPERATORS,
  DSL_CONDITIONALS,           // ADD
  DSL_CONDITION_VARIABLES,    // ADD
  DSL_DATE_LITERALS,          // ADD
  EXAMPLE_PATTERNS,
  createZmanimReferences,
  isTermInFormula,
  type ReferenceItem,
  type ExamplePattern,
} from '@/lib/dsl-reference-data';
```

**Step 2:** Add Category components (around line 254):
```tsx
{/* Conditionals */}
<Category
  title="Conditionals"
  count={DSL_CONDITIONALS.length}
  items={DSL_CONDITIONALS}
  currentFormula={currentFormula}
  onInsert={onInsert}
  defaultOpen={false}
  searchQuery={searchQuery}
/>

{/* Condition Variables */}
<Category
  title="Condition Variables"
  count={DSL_CONDITION_VARIABLES.length}
  items={DSL_CONDITION_VARIABLES}
  currentFormula={currentFormula}
  onInsert={onInsert}
  defaultOpen={false}
  searchQuery={searchQuery}
/>

{/* Date Literals */}
<Category
  title="Date Literals"
  count={DSL_DATE_LITERALS.length}
  items={DSL_DATE_LITERALS}
  currentFormula={currentFormula}
  onInsert={onInsert}
  defaultOpen={false}
  searchQuery={searchQuery}
/>
```

### Priority 2: Add Primitive/Direction Aliases

**File:** `web/lib/dsl-reference-data.ts`

Add to `DSL_PRIMITIVES`:
```typescript
{
  name: 'sunrise',
  description: 'Shorthand for visible_sunrise (backward compatible)',
  snippet: 'sunrise',
  category: 'primitive',
},
{
  name: 'sunset',
  description: 'Shorthand for visible_sunset (backward compatible)',
  snippet: 'sunset',
  category: 'primitive',
},
```

Add to `DSL_DIRECTIONS`:
```typescript
{
  name: 'before_sunrise',
  description: 'Shorthand for before_visible_sunrise',
  snippet: 'before_sunrise',
  category: 'function',
},
// ... etc for other aliases
```

---

## 7. Verification Checklist

After implementing fixes, verify:

- [ ] UI panel shows "Conditionals" section with `if...else`
- [ ] UI panel shows "Condition Variables" section with all 8 variables
- [ ] UI panel shows "Date Literals" section
- [ ] Searching for "latitude" finds it in the panel
- [ ] Searching for "if" finds the conditional syntax
- [ ] Clicking items inserts correct snippet
- [ ] All existing functionality still works

---

## 8. Conclusion

**Good News:** The `dsl-reference-data.ts` file is already comprehensive and synchronized with the backend! The previous analysis work was excellent.

**The Problem:** The UI component simply doesn't render all the available data. This is a straightforward fix requiring:
1. Adding 3 imports
2. Adding 3 Category components

**Impact:** Once fixed, users will be able to discover and use ALL DSL features including the powerful conditional logic for location/date-dependent calculations.

---

**End of Gap Analysis Report**
