# DSL Function Rename Project Plan

**Date:** 2025-12-21
**Project:** Rename `coalesce` → `first_valid` and add `earlier_of`, `later_of` functions
**Principle:** Clean implementation, NO backward compatibility, NO technical debt

---

## Approved Changes

### Functions to Rename
- ✅ `coalesce(a, b, ...)` → `first_valid(a, b, ...)` (rename existing)

### New Functions to Implement
- ✅ `earlier_of(a, b)` - returns whichever time comes first chronologically
- ✅ `later_of(a, b)` - returns whichever time comes last chronologically

### Rejected Changes
- ❌ NO primitive renaming (civil_dawn, nautical_dawn, etc. stay as-is)
- ❌ NO proportional → seasonal rename
- ❌ NO solar → sun_angle rename
- ❌ NO backward compatibility/aliases
- ❌ NO deprecation notices or old code in comments

---

## Quality Requirements

### Zero Technical Debt
- Clean rename everywhere - no aliases, no "also known as"
- Delete old naming completely - no commented-out code
- No deprecation notices or migration guides
- Code should look like these were always the names

### Validation Strategy - Jerusalem Testing

**Test 3 dates representing different solar conditions:**

1. **Winter Solstice** - Dec 21, 2025 (shortest day)
2. **Spring Equinox** - Mar 20, 2025 (equal day/night)
3. **Summer Solstice** - Jun 21, 2025 (longest day)

**Location:** Jerusalem (31.7683° N, 35.2137° E, elevation ~800m)

**Process:**
1. **PRE-CHANGE:** Capture baseline outputs for all formulas using these functions
2. **MAKE CHANGES:** Implement renames and new functions
3. **POST-CHANGE:** Run identical tests with new function names
4. **VALIDATE:** Outputs must be identical (proving logic unchanged, only names changed)

---

## Components to Update

### Backend (Go)
- `api/internal/dsl/token.go` - function name mappings
- `api/internal/dsl/executor.go` - function implementations
- `api/internal/dsl/validator.go` - validation logic
- `api/internal/dsl/dsl_test.go` - all test cases
- Any other test files using these functions

### Frontend (TypeScript)
- `web/lib/dsl-reference-data.ts` - function definitions and examples
- `web/lib/codemirror/dsl-tokens.ts` - syntax highlighting tokens
- `web/lib/codemirror/dsl-language.ts` - language grammar
- `web/lib/codemirror/dsl-completions.ts` - autocomplete suggestions
- `web/lib/dsl-context-helper.ts` - context-aware help
- `web/lib/tooltip-content.ts` - tooltip definitions
- `web/components/formula-builder/types.ts` - type definitions

### Database
- `db/migrations/00000000000002_seed_data.sql` - any formulas using `coalesce`
- Check for any zmanim formulas in seed data that need updating

### Documentation
- `docs/dsl-complete-guide.md` - complete reference documentation
- `docs/ux-dsl-editor-inline-guidance.md` - UI guidance
- Any other docs mentioning `coalesce`

---

## Implementation Steps

### Phase 1: Pre-Change Validation (CRITICAL)

1. **Create test suite** for 3 Jerusalem dates
   - Winter solstice: 2025-12-21
   - Spring equinox: 2025-03-20
   - Summer solstice: 2025-06-21

2. **Find all formulas** using `coalesce` in:
   - Seed data
   - Test files
   - Documentation examples

3. **Capture baseline outputs** - run each formula through executor and save results

4. **Create validation script** that can be re-run post-change

### Phase 2: Backend Changes

5. **Update token.go**
   - Rename `coalesce` → `first_valid` in Functions map
   - Add `earlier_of` to Functions map
   - Add `later_of` to Functions map

6. **Update executor.go**
   - Rename coalesce implementation → first_valid
   - Implement earlier_of (return min of two times)
   - Implement later_of (return max of two times)

7. **Update validator.go**
   - Update any coalesce validation → first_valid
   - Add validation for earlier_of (requires exactly 2 args)
   - Add validation for later_of (requires exactly 2 args)

8. **Update all backend tests**
   - Replace `coalesce` with `first_valid` in test cases
   - Add tests for `earlier_of`
   - Add tests for `later_of`

### Phase 3: Frontend Changes

9. **Update dsl-reference-data.ts**
   - Rename coalesce → first_valid with new examples
   - Add earlier_of with examples
   - Add later_of with examples

10. **Update dsl-tokens.ts**
    - Change FUNCTIONS array: coalesce → first_valid, add earlier_of, later_of

11. **Update dsl-language.ts**
    - Update DSL_FUNCTIONS: coalesce → first_valid, add earlier_of, later_of

12. **Update dsl-completions.ts**
    - Update autocomplete suggestions

13. **Update context helpers and tooltips**
    - dsl-context-helper.ts
    - tooltip-content.ts

### Phase 4: Database & Documentation

14. **Update seed data**
    - Find and replace coalesce → first_valid in migration files

15. **Update all documentation**
    - dsl-complete-guide.md
    - ux-dsl-editor-inline-guidance.md
    - Any other docs

### Phase 5: Post-Change Validation (CRITICAL)

16. **Run validation tests** with new function names on 3 Jerusalem dates

17. **Compare outputs** - pre-change vs post-change must be IDENTICAL

18. **Manual smoke test** - load formula builder, verify autocomplete works

### Phase 6: Final Checks

19. **Search codebase** for any remaining references to old names:
    - `grep -r "coalesce" --exclude-dir=node_modules --exclude-dir=.git`
    - Should only find this plan document and git history

20. **Run full test suite**
    - `cd api && go test ./...`
    - `cd web && npm run type-check`

21. **Build and test locally**
    - `./restart.sh`
    - Test formula builder UI
    - Test actual zmanim calculations

---

## Success Criteria

✅ All occurrences of `coalesce` renamed to `first_valid`
✅ `earlier_of` function implemented and tested
✅ `later_of` function implemented and tested
✅ Validation tests pass for 3 Jerusalem dates with IDENTICAL outputs
✅ No backward compatibility code, aliases, or deprecation notices
✅ All tests passing (backend + frontend)
✅ UI autocomplete works for new function names
✅ Documentation updated and accurate

---

## Files Requiring Updates (Summary)

**Backend (Go):**
- api/internal/dsl/token.go
- api/internal/dsl/executor.go
- api/internal/dsl/validator.go
- api/internal/dsl/dsl_test.go

**Frontend (TypeScript):**
- web/lib/dsl-reference-data.ts
- web/lib/codemirror/dsl-tokens.ts
- web/lib/codemirror/dsl-language.ts
- web/lib/codemirror/dsl-completions.ts
- web/lib/dsl-context-helper.ts
- web/lib/tooltip-content.ts
- web/components/formula-builder/types.ts

**Database:**
- db/migrations/00000000000002_seed_data.sql

**Documentation:**
- docs/dsl-complete-guide.md
- docs/ux-dsl-editor-inline-guidance.md

---

## Jerusalem Test Configuration

```javascript
const JERUSALEM_TEST_CONFIG = {
  location: {
    latitude: 31.7683,
    longitude: 35.2137,
    elevation: 800,
    timezone: 'Asia/Jerusalem'
  },
  test_dates: [
    { name: 'Winter Solstice', date: '2025-12-21' },
    { name: 'Spring Equinox', date: '2025-03-20' },
    { name: 'Summer Solstice', date: '2025-06-21' }
  ]
}
```

---

## Notes

- This is a CLEAN rename - treat it as if these were always the names
- No migration path needed since DSL formulas are stored in database (one-time update)
- Validation is CRITICAL - we must prove calculations unchanged
- Three test dates ensure we cover short/medium/long day scenarios
