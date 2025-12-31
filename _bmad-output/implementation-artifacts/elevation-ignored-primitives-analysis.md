# Elevation-Ignored Primitives: Comprehensive Analysis

## Executive Summary

This document provides a complete analysis for adding 8 new DSL primitives that calculate sunrise/sunset times **ignoring publisher elevation settings**. These primitives will always use sea-level (elevation=0) calculations regardless of the publisher's `ignore_elevation` setting or the locality's actual elevation.

## Proposed New Primitives

### 8 New Primitives to Add

| Primitive | Base Behavior | Description |
|-----------|---------------|-------------|
| `visible_sunrise_elevation_ignored` | `visible_sunrise` | Sunrise at sea level (zenith 90.833°, no elevation adjustment) |
| `visible_sunset_elevation_ignored` | `visible_sunset` | Sunset at sea level (zenith 90.833°, no elevation adjustment) |
| `geometric_sunrise_elevation_ignored` | `geometric_sunrise` | Geometric sunrise at sea level (zenith 90°, no refraction, no elevation) |
| `geometric_sunset_elevation_ignored` | `geometric_sunset` | Geometric sunset at sea level |
| `solar_noon_elevation_ignored` | `solar_noon` | Solar noon (elevation doesn't affect this, but for consistency) |
| `solar_midnight_elevation_ignored` | `solar_midnight` | Solar midnight (elevation doesn't affect this, but for consistency) |

### 8 New Directions to Add

| Direction | Base Direction | Description |
|-----------|----------------|-------------|
| `before_visible_sunrise_elevation_ignored` | `before_visible_sunrise` | Solar angle calculations before sea-level sunrise |
| `after_visible_sunrise_elevation_ignored` | `after_visible_sunrise` | Solar angle calculations after sea-level sunrise |
| `before_visible_sunset_elevation_ignored` | `before_visible_sunset` | Solar angle calculations before sea-level sunset |
| `after_visible_sunset_elevation_ignored` | `after_visible_sunset` | Solar angle calculations after sea-level sunset |
| `before_geometric_sunrise_elevation_ignored` | `before_geometric_sunrise` | Geometric solar angle before sea-level geometric sunrise |
| `after_geometric_sunrise_elevation_ignored` | `after_geometric_sunrise` | Geometric solar angle after sea-level geometric sunrise |
| `before_geometric_sunset_elevation_ignored` | `before_geometric_sunset` | Geometric solar angle before sea-level geometric sunset |
| `after_geometric_sunset_elevation_ignored` | `after_geometric_sunset` | Geometric solar angle after sea-level geometric sunset |

---

## Complete File Inventory: All Locations Requiring Changes

### CATEGORY 1: Go Backend - DSL Core (CRITICAL)

#### 1.1 Token Registration
**File:** `api/internal/dsl/token.go`
- **Lines 157-170:** Add to `Primitives` map (6 new entries)
- **Lines 185-196:** Add to `Directions` map (8 new entries)

#### 1.2 Executor Implementation
**File:** `api/internal/dsl/executor.go`
- **Lines 217-256:** Add `case` statements in `executePrimitive()` switch
- **Lines 320-340:** Add direction handling in `executeSolar()`
- **Lines 400-420:** Add direction handling for solar calculations
- **Lines 700-720:** Add direction handling in `executeProportionalMinutes()`

#### 1.3 Validator
**File:** `api/internal/dsl/validator.go`
- **Line 177:** Update valid directions list in error messages
- **Lines 214-240:** Add validation for new directions in `solar()` function
- **Lines 310-330:** Add validation for new directions in `proportional_minutes()`

#### 1.4 Primitives Reference Documentation
**File:** `api/internal/dsl/primitives_reference.go`
- **Lines 13-98:** Add `PrimitiveDoc` entries for all 6 new primitives

### CATEGORY 2: Go Backend - Services

#### 2.1 PDF Report Service
**File:** `api/internal/services/pdf_report_service.go`
- **Line 713:** Add new primitives to syntax highlighting map

#### 2.2 PDF Syntax Highlighter
**File:** `api/internal/services/pdf_syntax_highlight.go`
- **Lines 32, 50-51:** Add new primitives and directions to syntax highlighting

### CATEGORY 3: Database - SQL Migrations

#### 3.1 Seed Data Migration
**File:** `db/migrations/00000000000002_seed_data.sql`
- **Lines 67-74:** Add new primitive entries to `master_zmanim_registry` table
- Need to assign unique IDs (check existing max ID)

### CATEGORY 4: Frontend - TypeScript/React

#### 4.1 DSL Token Definitions
**File:** `web/lib/dsl/dsl-tokens.ts`
- **Lines 26-27:** Add new primitives to token list
- **Lines 56-59:** Add new directions to token list

#### 4.2 DSL Language Definition
**File:** `web/lib/dsl/dsl-language.ts`
- **Line 12:** Add primitives to language definition
- **Line 24:** Add directions to language definition

#### 4.3 DSL Completions (Autocomplete)
**File:** `web/lib/dsl/dsl-completions.ts`
- **Lines 12-13:** Add primitive autocomplete entries
- **Lines 32-66:** Add direction autocomplete entries with descriptions
- **Lines 92-93:** Update examples

#### 4.4 DSL Reference Data
**File:** `web/lib/dsl-reference-data.ts`
- **Lines 49-57:** Add primitive snippets
- **Lines 130-164:** Add to solar function examples
- **Lines 536-556:** Add direction definitions

#### 4.5 Primitives Documentation
**File:** `web/lib/primitives-documentation.ts`
- **Lines 179-290:** Add comprehensive documentation for all 6 new primitives
- Include Hebrew names, scientific explanation, halachic significance

#### 4.6 Error Humanizer
**File:** `web/lib/dsl/error-humanizer.ts`
- **Lines 22-61:** Add new primitives/directions to valid options lists
- **Line 218:** Update error suggestions

#### 4.7 Tooltip Content
**File:** `web/lib/dsl/tooltip-content.ts`
- **Lines 104-105:** Add tooltip explanations for new primitives

#### 4.8 DSL Context Helper
**File:** `web/lib/dsl/dsl-context-helper.ts`
- Add context-aware suggestions for new primitives/directions

#### 4.9 Formula Builder Types
**File:** `web/components/formula-builder/types.ts`
- **Lines 4, 56-108:** Add to `SolarDirection` type definition
- **Line 176:** Update default state values
- **Line 261:** Update formula option arrays

#### 4.10 Formula Builder Solar Form
**File:** `web/components/formula-builder/methods/SolarAngleForm.tsx`
- **Lines 67-81:** Add UI buttons for new direction options

#### 4.11 Formula Preview
**File:** `web/components/formula-builder/preview/FormulaPreview.tsx`
- **Lines 19-21:** Add syntax highlighting tokens

#### 4.12 CodeMirror DSL Editor
**File:** `web/components/CodeMirrorDSLEditor.tsx`
- **Lines 181-196:** Update default examples and hints

### CATEGORY 5: Documentation

#### 5.1 Complete DSL Guide
**File:** `docs/dsl-complete-guide.md`
- **Lines 99-114:** Add to primitives table
- **Lines 210-220:** Add to directions definitions
- **Lines 1296-1351:** Add to complete reference tables
- Add examples throughout document

#### 5.2 User Guide
**File:** `docs/USER_GUIDE.md`
- Add usage examples for new primitives

#### 5.3 Architecture Documentation
**File:** `docs/ARCHITECTURE.md`
- **Lines 410-423:** Add to primitive definitions table
- **Line 441:** Add alias definitions if needed

### CATEGORY 6: Tests

#### 6.1 DSL Unit Tests
**File:** `api/internal/dsl/dsl_test.go`
- Add parse tests for new primitives
- Add validation tests
- Add execution tests
- Add arithmetic operation tests

#### 6.2 Validation Tests
**File:** `api/internal/dsl/validation_test.go`
- Add valid formula tests for new primitives

#### 6.3 Frontend Tests
**File:** `web/components/formula-builder/__tests__/types.test.ts`
- Add parsing tests for new primitives/directions

#### 6.4 Formula Builder Tests
**File:** `web/components/formula-builder/__tests__/FormulaBuilder.test.tsx`
- Add component tests with new directions

### CATEGORY 7: Scripts & Examples

#### 7.1 Publisher JSON Fix Script
**File:** `scripts/fix-publisher-json.js`
- **Lines 16-19:** Add alias mappings if needed

---

## Implementation Order (Dependencies)

### Phase 1: Core Backend (Must be first)
1. `api/internal/dsl/token.go` - Register primitives and directions
2. `api/internal/dsl/executor.go` - Implement calculation logic
3. `api/internal/dsl/validator.go` - Add validation rules

### Phase 2: Backend Support
4. `api/internal/dsl/primitives_reference.go` - Backend documentation
5. `api/internal/services/pdf_report_service.go` - PDF support
6. `api/internal/services/pdf_syntax_highlight.go` - Syntax highlighting

### Phase 3: Database
7. `db/migrations/` - New migration file for seed data

### Phase 4: Frontend Core
8. `web/lib/dsl/dsl-tokens.ts` - Token definitions
9. `web/lib/dsl/dsl-language.ts` - Language support
10. `web/lib/dsl/dsl-completions.ts` - Autocomplete

### Phase 5: Frontend UI
11. `web/lib/dsl-reference-data.ts` - Reference data
12. `web/lib/primitives-documentation.ts` - Documentation
13. `web/lib/dsl/error-humanizer.ts` - Error messages
14. `web/lib/dsl/tooltip-content.ts` - Tooltips
15. `web/lib/dsl/dsl-context-helper.ts` - Context help
16. `web/components/formula-builder/` - UI components

### Phase 6: Documentation
17. `docs/dsl-complete-guide.md`
18. `docs/USER_GUIDE.md`
19. `docs/ARCHITECTURE.md`

### Phase 7: Tests
20. All test files

---

## Technical Details: How Elevation-Ignored Works

### Current Behavior
```go
// In executor.go - visible_sunrise uses cached sun times
case "visible_sunrise":
    t = st.Sunrise  // Uses e.ctx.Elevation which may be > 0

// In astro/sun.go - elevation affects zenith angle
func calcSunriseOrSunsetWithElevation(..., elevation float64, ...) {
    zenith := 90.833
    elevationAdj := calcElevationAdjustment(elevation)
    adjustedZenith := zenith + elevationAdj  // Larger zenith = earlier sunrise
}
```

### New Behavior (Elevation Ignored)
```go
// New cases in executor.go
case "visible_sunrise_elevation_ignored":
    // Always use sea level - force elevation to 0
    t = astro.CalculateSunTimesWithElevation(
        e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude,
        0,  // <-- ALWAYS ZERO regardless of e.ctx.Elevation
        e.ctx.Timezone).Sunrise

case "visible_sunset_elevation_ignored":
    t = astro.CalculateSunTimesWithElevation(
        e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude,
        0,  // <-- ALWAYS ZERO
        e.ctx.Timezone).Sunset
```

### Key Difference from Publisher `ignore_elevation` Setting

| Feature | Publisher Setting | New Primitives |
|---------|-------------------|----------------|
| **Scope** | Affects ALL zmanim for that publisher | Affects only formulas using `*_elevation_ignored` |
| **Control** | Publisher-wide toggle | Per-formula choice |
| **Use Case** | Publisher policy decision | Specific halachic requirements |
| **Flexibility** | All or nothing | Can mix elevated and sea-level in same formula |

---

## Example Formulas Using New Primitives

```dsl
# Sea-level sunrise regardless of location elevation
visible_sunrise_elevation_ignored

# Alos using sea-level sunrise as reference
solar(16.1, before_visible_sunrise_elevation_ignored)

# Mix: elevated sunset but sea-level sunrise for proportional calculation
proportional_hours(gra, 10.5)  # Uses standard elevation-aware times

# Compare elevated vs sea-level
later_of(visible_sunrise, visible_sunrise_elevation_ignored)
```

---

## Validation Requirements

1. All 6 new primitives must be recognized by lexer
2. All 8 new directions must be valid in `solar()` function
3. All 8 new directions must be valid in `seasonal_solar()` function
4. All 8 new directions must be valid in `proportional_minutes()` function
5. Frontend autocomplete must suggest new options
6. PDF reports must syntax-highlight new primitives
7. Error messages must list new primitives as valid options
8. Tests must cover all new primitives and directions

---

## File Count Summary

| Category | Files to Modify |
|----------|-----------------|
| Go Backend (DSL Core) | 4 files |
| Go Backend (Services) | 2 files |
| Database | 1 file (new migration) |
| Frontend (Core) | 3 files |
| Frontend (UI) | 7 files |
| Documentation | 3 files |
| Tests | 4+ files |
| **TOTAL** | **24+ files** |

---

## Risk Assessment

### High Risk
- `executor.go` - Core calculation logic, must be precise
- `token.go` - If primitives not registered, nothing works

### Medium Risk
- `validator.go` - Incomplete validation = runtime errors
- Frontend completions - Poor UX if autocomplete broken

### Low Risk
- Documentation files - Doesn't affect functionality
- Test files - Testing coverage, not production code

---

## Notes for Implementation

1. **Naming Convention:** Use `_elevation_ignored` suffix consistently
2. **Cache Considerations:** Elevation-ignored primitives need separate cache keys
3. **Performance:** Calculate elevation-ignored times lazily (don't compute if not used)
4. **Backwards Compatibility:** These are NEW primitives, no existing code affected
5. **Hebrew Names:** Work with Daniel on Hebrew terminology for documentation
