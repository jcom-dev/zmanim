# Master Zmanim Registry Completion - Orchestration Prompt

**Use this prompt to give to another Claude Code agent to continue the implementation work.**

---

## Context

A comprehensive audit of all 172+ zmanim in the `master_zmanim_registry` has been completed. The audit reports are in `docs/audit/` and the implementation plan is in `docs/registry-completion-plan.md`.

## Audit Summary

**Total Zmanim Audited:** 169
- **PASS:** 135 (80%)
- **FAIL:** 20 (12%)
- **NEEDS REVIEW:** 14 (8%)

### Critical Failures Found

1. **Missing DSL Functions (10 zmanim)**
   - `proportional_minutes()` - NOT IMPLEMENTED - affects 8 zmanim (alos/tzais _zmanis variants)
   - `shaah_zmanis()` - NOT IMPLEMENTED - affects 2 zmanim

2. **Missing DSL Primitive (4 zmanim)**
   - `molad` - NOT DEFINED - affects 4 Kiddush Levana zmanim

3. **Missing Base Definition (10 zmanim)**
   - `ateret_torah` - NOT DEFINED - affects Shema, Tefila, Mincha, Plag formulas

4. **Invalid Base References (6 zmanim)**
   - Formula uses `alos_16_1` instead of `mga_16_1` - affects mincha/plag 16.1 variants

5. **Wrong Base in Formula (1 zman)**
   - `sof_zman_shma_mga_72` uses `mga_90` instead of `mga_72`

6. **Elevation Not Used (systemic)**
   - DSL executor ignores elevation for sunrise/sunset primitives and solar() function

---

## Your Task

Implement the fixes in priority order using sub-agents in parallel where possible:

### Phase 0: DSL Critical Fixes (MUST DO FIRST)

Use sub-agents in parallel to:

1. **Implement `proportional_minutes()` function**
   - Add to `api/internal/dsl/token.go` Functions map
   - Implement in `api/internal/dsl/executor.go`
   - Add validation in `api/internal/dsl/validator.go`
   - Algorithm: `offset = (minutes / 720) × day_length`

2. **Add `ateret_torah` base definition**
   - Add to `api/internal/dsl/token.go` Bases map
   - Implement in `api/internal/dsl/executor.go` executeProportionalHours()
   - Research: Check KosherJava for exact alos/tzais angles

3. **Fix elevation handling**
   - In `api/internal/dsl/executor.go` line 47
   - Change `CalculateSunTimes()` to `CalculateSunTimesWithElevation()`
   - Also fix `solar()` function to use elevation

### Phase 1: Formula Fixes (SQL Updates)

```sql
-- Fix wrong base references
UPDATE master_zmanim_registry SET default_formula_dsl = 'proportional_hours(6.5, mga_16_1)' WHERE zman_key = 'mincha_gedola_16_1';
UPDATE master_zmanim_registry SET default_formula_dsl = 'proportional_hours(9.5, mga_16_1)' WHERE zman_key = 'mincha_ketana_16_1';
UPDATE master_zmanim_registry SET default_formula_dsl = 'proportional_hours(10.75, mga_16_1)' WHERE zman_key = 'plag_hamincha_16_1';
UPDATE master_zmanim_registry SET default_formula_dsl = 'proportional_hours(3, mga_16_1)' WHERE zman_key = 'sof_zman_shma_16_1';

-- Fix wrong base (mga_90 -> mga_72)
UPDATE master_zmanim_registry SET default_formula_dsl = 'proportional_hours(3, mga)' WHERE zman_key = 'sof_zman_shma_mga_72';
```

### Phase 2: Add Missing Shita Tag

```sql
INSERT INTO zman_tags (tag_key, name, display_name_english_ashkenazi, tag_type_id, description, sort_order)
VALUES ('shita_machzikei_hadass', 'shita_machzikei_hadass', 'Machzikei Hadass (Manchester)', 173, 'Manchester calendar using asymmetric day', 130);
```

### Phase 3: Add High Priority Zmanim (2)

```sql
-- Tzais 16.1 degrees
INSERT INTO master_zmanim_registry (zman_key, canonical_hebrew_name, canonical_english_name, description, time_category_id, default_formula_dsl, is_core)
VALUES ('tzais_16_1', 'צאת 16.1°', 'Tzais (16.1°)', 'Nightfall at 16.1 degrees', (SELECT id FROM time_categories WHERE key = 'tzais'), 'solar(16.1, after_sunset)', false);

-- Sunrise Baal HaTanya
INSERT INTO master_zmanim_registry (zman_key, canonical_hebrew_name, canonical_english_name, description, time_category_id, default_formula_dsl, is_core)
VALUES ('sunrise_baal_hatanya', 'נץ אמיתי', 'Sunrise (Baal HaTanya)', 'True sunrise at 1.583° below horizon', (SELECT id FROM time_categories WHERE key = 'sunrise'), 'solar(1.583, before_sunrise)', false);
```

### Phase 4: Validation

```bash
cd api && go test ./internal/dsl/... -v
cd api && go build ./cmd/api
./scripts/validate-ci-checks.sh
```

---

## How to Use This Prompt

Copy and paste the following to the new agent:

```
I need you to complete the master zmanim registry by implementing critical fixes identified in a comprehensive audit.

**Read these files first:**
1. /home/daniel/repos/zmanim/docs/registry-completion-plan.md - Full implementation plan
2. /home/daniel/repos/zmanim/docs/audit/dsl-functions-audit.md - DSL gaps analysis
3. /home/daniel/repos/zmanim/docs/audit/orchestration-prompt.md - This prompt with summary

**Your task:** Use sub-agents in parallel to:

1. **Implement `proportional_minutes()` DSL function** (CRITICAL - blocks 8 zmanim)
   - Files: api/internal/dsl/token.go, executor.go, validator.go

2. **Add `ateret_torah` base definition** (blocks 10 zmanim)
   - Files: api/internal/dsl/token.go, executor.go

3. **Fix elevation handling** (systemic fix)
   - File: api/internal/dsl/executor.go line 47

4. **Run SQL fixes** for wrong base references (5 UPDATE statements)

5. **Add missing shita tag and 2 new zmanim** (SQL INSERTs)

6. **Run validation** to ensure everything works

After each phase, run `cd api && go test ./internal/dsl/... -v` to verify.

Track progress using TodoWrite. This is a multi-step implementation task - break it into specific todos.
```

---

## Detailed Audit Reports

All audit reports with detailed findings per category:
- `docs/audit/alos-zmanim-audit.md` - 22 dawn zmanim
- `docs/audit/tzais-zmanim-audit.md` - 38 nightfall zmanim
- `docs/audit/shema-tefila-zmanim-audit.md` - 28 deadline zmanim
- `docs/audit/mincha-plag-zmanim-audit.md` - 27 mincha/plag zmanim
- `docs/audit/candle-havdalah-zmanim-audit.md` - 12 Shabbat zmanim
- `docs/audit/core-sun-zmanim-audit.md` - 9 sunrise/sunset/chatzos
- `docs/audit/misc-zmanim-audit.md` - 33 other zmanim
- `docs/audit/dsl-functions-audit.md` - DSL function analysis

---

## Success Criteria

After implementation:
- [ ] All 172+ zmanim formulas parse without errors
- [ ] All DSL tests pass: `go test ./internal/dsl/... -v`
- [ ] API builds: `go build ./cmd/api`
- [ ] CI checks pass: `./scripts/validate-ci-checks.sh`
- [ ] 2 new zmanim (tzais_16_1, sunrise_baal_hatanya) added
- [ ] 5 formula fixes applied
- [ ] 1 shita tag added

---

**End of Orchestration Prompt**
