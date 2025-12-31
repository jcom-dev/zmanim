# Orchestrator Prompt: Elevation-Ignored Primitives Implementation

## Mission

Implement 8 new DSL primitives and 8 new directions that calculate sunrise/sunset times **always at sea level**, ignoring any elevation settings. Use parallel sub-agents to maximize efficiency.

---

## Context for All Agents

### What We're Adding

**6 New Primitives:**
- `visible_sunrise_elevation_ignored`
- `visible_sunset_elevation_ignored`
- `geometric_sunrise_elevation_ignored`
- `geometric_sunset_elevation_ignored`
- `solar_noon_elevation_ignored`
- `solar_midnight_elevation_ignored`

**8 New Directions:**
- `before_visible_sunrise_elevation_ignored`
- `after_visible_sunrise_elevation_ignored`
- `before_visible_sunset_elevation_ignored`
- `after_visible_sunset_elevation_ignored`
- `before_geometric_sunrise_elevation_ignored`
- `after_geometric_sunrise_elevation_ignored`
- `before_geometric_sunset_elevation_ignored`
- `after_geometric_sunset_elevation_ignored`

### Key Technical Concept

These primitives ALWAYS use `elevation = 0` in calculations, regardless of:
- The locality's actual elevation
- The publisher's `ignore_elevation` setting

This is different from the existing publisher setting - these give **per-formula control** over elevation handling.

---

## Parallel Sub-Agent Assignments

### AGENT 1: Backend DSL Core
**Files to modify:**
1. `api/internal/dsl/token.go`
   - Add 6 primitives to `Primitives` map (lines 157-170)
   - Add 8 directions to `Directions` map (lines 185-196)

2. `api/internal/dsl/executor.go`
   - Add 6 cases to `executePrimitive()` switch (after line 252)
   - Each case should call astro functions with `elevation = 0`
   - Add 8 direction cases in solar-related functions

3. `api/internal/dsl/validator.go`
   - Update direction validation in `validateSolar()`
   - Update direction validation in `validateProportionalMinutes()`
   - Update error messages to include new valid options

4. `api/internal/dsl/primitives_reference.go`
   - Add `PrimitiveDoc` for each new primitive
   - Include clear explanation that these ignore elevation

**Implementation Pattern for executor.go:**
```go
case "visible_sunrise_elevation_ignored":
    // Calculate at sea level (elevation = 0) regardless of context elevation
    seaLevelTimes := astro.CalculateSunTimesWithElevation(
        e.ctx.Date, e.ctx.Latitude, e.ctx.Longitude,
        0,  // Always sea level
        e.ctx.Timezone)
    t = seaLevelTimes.Sunrise
```

**Validation:** After changes, run:
```bash
cd api && go build ./cmd/api
cd api && go test ./internal/dsl/...
```

---

### AGENT 2: Backend Services & PDF
**Files to modify:**
1. `api/internal/services/pdf_report_service.go`
   - Add new primitives to syntax highlighting map (around line 713)

2. `api/internal/services/pdf_syntax_highlight.go`
   - Add new primitives to primitive highlighting (lines 32, 50-51)
   - Add new directions to direction highlighting

**Validation:** After changes, run:
```bash
cd api && go build ./cmd/api
```

---

### AGENT 3: Database Migration
**Files to create/modify:**
1. Create new migration: `db/migrations/YYYYMMDDHHMMSS_add_elevation_ignored_primitives.sql`

**Content template:**
```sql
-- Add elevation-ignored primitives to master_zmanim_registry
-- These primitives always calculate at sea level, ignoring location elevation

INSERT INTO master_zmanim_registry (id, zman_key, display_name_english, display_name_hebrew, description, default_formula, category_id, sort_order)
VALUES
    (290, 'visible_sunrise_elevation_ignored', 'Visible Sunrise (Sea Level)', 'הנץ החמה (גובה פני הים)', 'Sunrise calculated at sea level, ignoring location elevation', 'visible_sunrise_elevation_ignored', 1, 290),
    (291, 'visible_sunset_elevation_ignored', 'Visible Sunset (Sea Level)', 'שקיעת החמה (גובה פני הים)', 'Sunset calculated at sea level, ignoring location elevation', 'visible_sunset_elevation_ignored', 1, 291),
    (292, 'geometric_sunrise_elevation_ignored', 'Geometric Sunrise (Sea Level)', 'הנץ גיאומטרי (גובה פני הים)', 'Geometric sunrise at sea level', 'geometric_sunrise_elevation_ignored', 1, 292),
    (293, 'geometric_sunset_elevation_ignored', 'Geometric Sunset (Sea Level)', 'שקיעה גיאומטרית (גובה פני הים)', 'Geometric sunset at sea level', 'geometric_sunset_elevation_ignored', 1, 293),
    (294, 'solar_noon_elevation_ignored', 'Solar Noon (Sea Level)', 'חצות היום (גובה פני הים)', 'Solar noon - elevation has no effect but included for consistency', 'solar_noon_elevation_ignored', 1, 294),
    (295, 'solar_midnight_elevation_ignored', 'Solar Midnight (Sea Level)', 'חצות הלילה (גובה פני הים)', 'Solar midnight - elevation has no effect but included for consistency', 'solar_midnight_elevation_ignored', 1, 295)
ON CONFLICT (id) DO NOTHING;
```

**Note:** Check existing max ID in master_zmanim_registry first and adjust IDs accordingly.

**Validation:** After changes, run:
```bash
cd api && sqlc generate
```

---

### AGENT 4: Frontend DSL Core
**Files to modify:**
1. `web/lib/dsl/dsl-tokens.ts`
   - Add 6 primitives to primitives array
   - Add 8 directions to directions array

2. `web/lib/dsl/dsl-language.ts`
   - Add primitives to language definition
   - Add directions to language definition

3. `web/lib/dsl/dsl-completions.ts`
   - Add autocomplete entries for all new primitives
   - Add autocomplete entries for all new directions
   - Include helpful descriptions explaining sea-level behavior

**Validation:** After changes, run:
```bash
cd web && npm run type-check
```

---

### AGENT 5: Frontend Documentation & UI Support
**Files to modify:**
1. `web/lib/dsl-reference-data.ts`
   - Add primitive snippets
   - Add to solar function examples
   - Add direction definitions

2. `web/lib/primitives-documentation.ts`
   - Add comprehensive documentation for each primitive
   - Include: name, Hebrew name, scientific explanation, halachic notes

3. `web/lib/dsl/error-humanizer.ts`
   - Add new primitives/directions to valid options lists

4. `web/lib/dsl/tooltip-content.ts`
   - Add tooltip text for each new primitive

5. `web/lib/dsl/dsl-context-helper.ts`
   - Add context-aware suggestions

**Validation:** After changes, run:
```bash
cd web && npm run type-check
```

---

### AGENT 6: Frontend Formula Builder Components
**Files to modify:**
1. `web/components/formula-builder/types.ts`
   - Add to `SolarDirection` type union
   - Update default values if needed
   - Update formula option arrays

2. `web/components/formula-builder/methods/SolarAngleForm.tsx`
   - Add UI toggle/buttons for elevation-ignored variants
   - Consider grouping (e.g., "Advanced" section)

3. `web/components/formula-builder/preview/FormulaPreview.tsx`
   - Add syntax highlighting for new tokens

4. `web/components/CodeMirrorDSLEditor.tsx`
   - Update any hardcoded examples

**Validation:** After changes, run:
```bash
cd web && npm run type-check
```

---

### AGENT 7: Documentation
**Files to modify:**
1. `docs/dsl-complete-guide.md`
   - Add to primitives table with full descriptions
   - Add to directions table
   - Add examples showing use cases
   - Update reference tables

2. `docs/USER_GUIDE.md`
   - Add usage examples

3. `docs/ARCHITECTURE.md`
   - Add to primitive definitions table

**Validation:** Review documentation for accuracy and completeness.

---

### AGENT 8: Tests
**Files to modify/create:**
1. `api/internal/dsl/dsl_test.go`
   - Add parse tests for each new primitive
   - Add execution tests verifying sea-level calculation
   - Add tests comparing elevation-ignored vs regular primitives

2. `api/internal/dsl/validation_test.go`
   - Add valid formula tests

3. `web/components/formula-builder/__tests__/types.test.ts`
   - Add parsing tests

4. `web/components/formula-builder/__tests__/FormulaBuilder.test.tsx`
   - Add component tests

**Test pattern for execution:**
```go
func TestElevationIgnoredPrimitives(t *testing.T) {
    // Setup: Location with significant elevation (e.g., Jerusalem ~800m)
    ctx := &ExecutionContext{
        Date:      time.Date(2025, 6, 21, 0, 0, 0, 0, time.UTC),
        Latitude:  31.7683,
        Longitude: 35.2137,
        Elevation: 800,  // 800 meters
        Timezone:  time.UTC,
    }

    // Test: elevation_ignored should differ from regular
    regular := Execute("visible_sunrise", ctx)
    ignored := Execute("visible_sunrise_elevation_ignored", ctx)

    // Elevation-ignored should be LATER (sun rises later at sea level for elevated observer)
    assert.True(t, ignored.Time.After(regular.Time))
}
```

**Validation:** After changes, run:
```bash
cd api && go test ./internal/dsl/... -v
cd web && npm test
```

---

## Execution Order & Dependencies

```
Phase 1 (Can run in parallel):
├── AGENT 1: Backend DSL Core ──────────────┐
├── AGENT 3: Database Migration ────────────┼── Must complete before Phase 2
└── AGENT 4: Frontend DSL Core ─────────────┘

Phase 2 (Can run in parallel after Phase 1):
├── AGENT 2: Backend Services & PDF
├── AGENT 5: Frontend Documentation
├── AGENT 6: Frontend Formula Builder
└── AGENT 7: Documentation

Phase 3 (After all implementation):
└── AGENT 8: Tests
```

---

## Coordination Points

### After AGENT 1 completes:
- Run `go build ./cmd/api` to verify compilation
- If any issues, AGENT 1 must fix before others proceed

### After AGENT 3 completes:
- Run `sqlc generate` to regenerate Go code
- Verify no SQL errors

### After AGENT 4 completes:
- Run `npm run type-check` to verify TypeScript
- Other frontend agents can then proceed

### Final Integration:
- Run full test suite
- Run `./scripts/validate-ci-checks.sh`
- Manual testing in browser

---

## Definition Reference (Copy to Each Agent)

### Primitives Map Addition (token.go):
```go
// Elevation-ignored variants (always use sea level)
"visible_sunrise_elevation_ignored":   true,
"visible_sunset_elevation_ignored":    true,
"geometric_sunrise_elevation_ignored": true,
"geometric_sunset_elevation_ignored":  true,
"solar_noon_elevation_ignored":        true,
"solar_midnight_elevation_ignored":    true,
```

### Directions Map Addition (token.go):
```go
// Elevation-ignored directions (always use sea level for reference point)
"before_visible_sunrise_elevation_ignored":   true,
"after_visible_sunrise_elevation_ignored":    true,
"before_visible_sunset_elevation_ignored":    true,
"after_visible_sunset_elevation_ignored":     true,
"before_geometric_sunrise_elevation_ignored": true,
"after_geometric_sunrise_elevation_ignored":  true,
"before_geometric_sunset_elevation_ignored":  true,
"after_geometric_sunset_elevation_ignored":   true,
```

---

## Success Criteria

1. ✅ All 6 primitives parse without error
2. ✅ All 8 directions work in `solar()`, `seasonal_solar()`, `proportional_minutes()`
3. ✅ Elevation-ignored primitives return DIFFERENT times than regular primitives when elevation > 0
4. ✅ Elevation-ignored primitives return SAME times as regular when elevation = 0
5. ✅ Frontend autocomplete suggests all new options
6. ✅ PDF reports syntax-highlight new primitives
7. ✅ All tests pass
8. ✅ CI checks pass
9. ✅ Documentation is complete and accurate

---

## Notes for Orchestrator

1. **Launch agents in parallel** where dependencies allow
2. **Monitor agent progress** - if one fails, others may be blocked
3. **Integration testing** is critical after all agents complete
4. **Hebrew translations** may need review by Daniel
5. **Consider feature flag** if phased rollout is desired
