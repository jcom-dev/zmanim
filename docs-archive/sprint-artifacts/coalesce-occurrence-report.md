# Coalesce Occurrence Report

**Date Generated:** 2025-12-21
**Status:** Complete
**Total Occurrences:** 147

---

## Summary

Total occurrences of `coalesce` (case-insensitive): **147**
Files affected: **18**

**Breakdown by Category:**
- Backend (Go): 10 occurrences in 3 files
- Frontend (TypeScript): 26 occurrences in 7 files
- Database: 0 occurrences
- Documentation: 111 occurrences in 8 files

---

## Backend (Go)

### api/internal/dsl/token.go
- **Line 179:** `"coalesce": true,` - Function keyword definition in token map

### api/internal/dsl/validator.go
- **Line 141:** `case "coalesce":` - Validator switch case statement
- **Line 305:** `// validateCoalesceFunction validates a coalesce() function call` - Comment
- **Line 308:** `v.addError(n.Pos, "coalesce() requires at least 2 arguments, got %d", len(n.Args))` - Error message

### api/internal/dsl/executor.go
- **Line 266:** `// executeFunction evaluates a function call (solar, seasonal_solar, proportional_hours, proportional_minutes, midpoint, coalesce)` - Comment
- **Line 279:** `case "coalesce":` - Executor switch case statement
- **Line 1006:** `// executeCoalesce evaluates coalesce(expr1, expr2, ...) - returns first non-null/non-error value` - Function comment
- **Line 1009:** `e.addError("coalesce() requires at least 2 arguments")` - Error message
- **Line 1027:** `e.addError("coalesce(): all arguments failed")` - Error message
- **Line 1037:** `e.addError("coalesce(): all arguments returned null")` - Error message
- **Line 1047:** `e.addError("coalesce(): no valid value found")` - Error message

### api/internal/db/sqlcgen/version_history.sql.go
- **Line 60:** `var coalesce interface{}` - Variable declaration
- **Line 61:** `err := row.Scan(&coalesce)` - Variable reference in scan operation
- **Line 62:** `return coalesce, err` - Variable return

---

## Frontend (TypeScript)

### web/lib/codemirror/dsl-tokens.ts
- **Line 48:** `'coalesce',` - Token definition in function list

### web/lib/codemirror/dsl-language.ts
- **Line 19:** `'solar', 'seasonal_solar', 'proportional_hours', 'proportional_minutes', 'midpoint', 'coalesce', 'if',` - Function keyword list

### web/lib/error-humanizer.ts
- **Line 27:** `coalesce: 'coalesce(solar(16.1, before_sunrise), solar_midnight)',` - Example in error mapping
- **Line 37:** `coalesce: 'Two or more expressions - returns the first that produces a valid result',` - Description in mapping
- **Line 51:** `'solar', 'proportional_hours', 'midpoint', 'min', 'max', 'coalesce', 'if',` - Function list
- **Line 243:** `: 'Available functions: solar, proportional_hours, midpoint, min, max, coalesce',` - Error message

### web/lib/codemirror/dsl-completions.ts
- **Line 70:** `label: 'coalesce',` - Autocomplete label
- **Line 73:** `detail: 'coalesce(expr1, expr2, ...)',` - Autocomplete detail
- **Line 74:** `snippet: 'coalesce(${1:primary}, ${2:fallback})',` - Code snippet for autocomplete

### web/lib/dsl-context-helper.ts
- **Line 17:** `| { type: 'coalesce_param'; position: number; paramStart: number; paramEnd: number }` - Type definition
- **Line 192:** `// coalesce(expr1, expr2, ...)` - Comment
- **Line 193:** `if (funcName === 'coalesce') {` - Conditional check
- **Line 194:** `return { type: 'coalesce_param', position: cursorPos, paramStart, paramEnd };` - Return statement
- **Line 346:** `coalesce_param: {` - Context type mapping
- **Line 416:** `if (context.type === 'coalesce_param') {` - Conditional check
- **Line 417:** `return TOOLTIP_CONTENT.coalesce_param;` - Return statement

### web/lib/dsl-reference-data.ts
- **Line 287:** `name: 'coalesce',` - Function name definition
- **Line 288:** `signature: 'coalesce(value1, value2, ...)',` - Function signature
- **Line 290:** `snippet: 'coalesce(value1, value2)',` - Code snippet
- **Line 291:** `realWorldExample: 'coalesce(solar(16.1, before_sunrise), sunrise - 72min)',` - Real world example
- **Line 308:** `{ value: 'coalesce(solar(16.1, before_sunrise), sunrise - 72min)', label: 'Fallback dawn', description: 'Use angle or fallback to fixed minutes' },` - Example in array

### web/lib/tooltip-content.ts
- **Line 79:** `coalesce:` - Tooltip content object key (no value shown in grep output)

---

## Database

No occurrences found in database migrations.

---

## Documentation

### docs/dsl-complete-guide.md
- **Line 25:** `9. [Fallbacks with Coalesce](#9-fallbacks-with-coalesce)` - Table of contents link
- **Line 716:** `The \`coalesce()\` function provides a simpler way to handle calculation failures.` - Function description
- **Line 721:** `coalesce(primary_formula, fallback_formula)` - Syntax example
- **Line 727:** `coalesce(first_try, second_try, third_try)` - Multiple fallbacks example
- **Line 741:** `At high latitudes in summer, the sun may not reach 16.1 degrees below the horizon. Instead of writing complex conditions, use coalesce:` - Documentation text
- **Line 744:** `coalesce(solar(16.1, before_sunrise), solar_midnight)` - Example formula
- **Line 754:** `coalesce(` - Multi-line example start
- **Line 775:** `**Use coalesce** when you want automatic fallback based on whether a calculation succeeds:` - Documentation text
- **Line 777:** `coalesce(solar(16.1, before_sunrise), civil_dawn)` - Example
- **Line 780:** `The coalesce approach is often cleaner because it automatically detects when a calculation fails` - Documentation text
- **Line 966:** `coalesce(solar(16.1, before_sunrise), solar_midnight)` - Example in registry
- **Line 974:** `misheyakir: coalesce(` - Example formula start
- **Line 1207:** `║  coalesce(expr1, expr2, ...)` - Function table entry
- **Line 1208:** `║    Example: coalesce(solar(16.1, before_sunrise), civil_dawn)` - Example in table
- **Line 1325:** `**Solution:** Use \`coalesce()\` or conditional fallbacks:` - Troubleshooting text
- **Line 1327:** `coalesce(solar(16.1, before_sunrise), civil_dawn)` - Solution example

### docs/registry-completion-plan.md
- **Line 52:** `"coalesce": true,` - Function keyword map entry

### docs/audit/alos-zmanim-audit.md
- **Line 19:** `- Valid functions are: \`solar\`, \`seasonal_solar\`, \`proportional_hours\`, \`midpoint\`, \`coalesce\`` - Function list
- **Line 52:** `5. **coalesce(...)** - Return first non-null value` - Function description

### docs/audit/dsl-functions-audit.md
- **Line 33:** `"coalesce": true,` - Function keyword map
- **Line 50:** `| \`coalesce()\` | 0 | IMPLEMENTED | executor.go:918-961 |` - Audit table entry
- **Line 190:** `#### \`coalesce(expr1, expr2, ...)\` - 0 uses` - Audit section header
- **Line 228:** `case "coalesce":` - Code example

### docs/audit/misc-zmanim-audit.md
- **Line 20:** `- \`coalesce(expr1, expr2, ...)\` - First non-null value` - Function documentation
- **Line 206:** `Valid functions: \`solar()\`, \`seasonal_solar()\`, \`proportional_hours()\`, \`midpoint()\`, \`coalesce()\`` - Function list

### docs/research-dsl-sync-2025-12-21.md
- **Line 80:** `solar, seasonal_solar, proportional_hours, proportional_minutes, midpoint, coalesce` - Function list
- **Line 159:** `| coalesce | ✅ | ❌ | ❌ | ❌ | ✅ | 🔴 **MISSING ALL UI** |` - Status table row
- **Line 166:** `1. **\`coalesce\` function:** Exists in backend parser + docs, **completely missing from ALL UI files**` - Issue description
- **Line 253:** `**Issue #2: Missing \`coalesce\` Function in UI**` - Issue heading
- **Line 255:** `- **Impact:** Backend supports fallback logic via \`coalesce()\`, but UI provides ZERO assistance` - Impact statement
- **Line 257:** `- **Recommendation:** ADD full UI support for \`coalesce\`` - Recommendation
- **Line 326:** `- ADD \`coalesce\` function with full details` - Task item
- **Line 344:** `- ADD \`coalesce\` to DSL_FUNCTIONS` - Task item
- **Line 353:** `- Verify \`coalesce\` is documented (appears to be present)` - Task item
- **Line 384:** `2. **Add \`coalesce\` function to UI** - critical missing functionality` - Task summary
- **Line 412:** `- \`coalesce\` function` - Feature list item
- **Line 422:** `coalesce(solar(16.1, before_sunrise), sunrise - 72min)` - Example formula

### docs/research-dsl-redesign-2025-12-21.md
- **Line 37:** `- **Anxious** when seeing code-like syntax (\`coalesce\`, operators, parentheses)` - User personas
- **Line 58:** `- "I don't know what 'coalesce' means - I need the earlier time!"` - User quote
- **Line 80:** `3. **Plain English keywords**: "earlier of" instead of "coalesce"` - Recommendation
- **Line 102:** `**What they WRITE:** \`coalesce(@alos, sunrise - 30min)\`` - Example
- **Line 118:** `coalesce(@alos, sunrise - 30min)` - Formula example
- **Line 120:** `*"What does coalesce mean? What's happening here?"*` - User question
- **Line 251:** `- No \`coalesce\` found (earlier/later logic not in registry defaults)` - Analysis
- **Line 269:** `- The gap analysis mentioned \`coalesce\` as missing from UI` - Reference
- **Line 379:** `| \`coalesce(@x, @y)\` | \`earlier of [x] or [y]\` | Plain English conditional |` - Proposal table
- **Line 496:** `Current: coalesce(@alos, sunrise - 30min)  [if it existed]` - Example
- **Line 566:** `| \`example_conditional\` | \`coalesce(@alos, sunrise - 30min)\` | \`earlier of {alos} or (sunrise minus 30 minutes)\` |` - Mapping example
- **Line 946:** `coalesce(@x, @y) earlier of {x} or {y}` - Translation mapping

### docs/ux-dsl-editor-inline-guidance.md
- **Line 582:** `| \`coalesce() requires at least 2 arguments\` | \`coalesce()\` needs at least two options. | coalesce(solar(...), fallback) |` - Error guidance
- **Line 583:** `| \`coalesce(): all arguments failed\` | None of the options could calculate. | Check your fallback values. |` - Error guidance
- **Line 613:** `### After \`coalesce(\`` - Section header
- **Line 615:** `🔄 coalesce(primary, fallback, ...)` - Tooltip content
- **Line 620:** `• coalesce(solar(16.1, before_sunrise), solar_midnight)` - Example

### docs/sprint-artifacts/dsl-function-rename-plan.md
- **Line 4:** `**Project:** Rename \`coalesce\` → \`first_valid\` and add \`earlier_of\`, \`later_of\` functions` - Project title
- **Line 12:** `- ✅ \`coalesce(a, b, ...)\` → \`first_valid(a, b, ...)\` (rename existing)` - Task
- **Line 72:** `- \`db/migrations/00000000000002_seed_data.sql\` - any formulas using \`coalesce\`` - File to check
- **Line 78:** `- Any other docs mentioning \`coalesce\`` - File to check
- **Line 91:** `2. **Find all formulas** using \`coalesce\` in:` - Task description
- **Line 103:** `- Rename \`coalesce\` → \`first_valid\` in Functions map` - Task
- **Line 108:** `- Rename coalesce implementation → first_valid` - Task
- **Line 113:** `- Update any coalesce validation → first_valid` - Task
- **Line 118:** `- Replace \`coalesce\` with \`first_valid\` in test cases` - Task
- **Line 125:** `- Rename coalesce → first_valid with new examples` - Task
- **Line 130:** `- Change FUNCTIONS array: coalesce → first_valid, add earlier_of, later_of` - Task
- **Line 133:** `- Update DSL_FUNCTIONS: coalesce → first_valid, add earlier_of, later_of` - Task
- **Line 145:** `- Find and replace coalesce → first_valid in migration files` - Task
- **Line 163:** `- \`grep -r "coalesce" --exclude-dir=node_modules --exclude-dir=.git\`` - Command reference
- **Line 179:** `✅ All occurrences of \`coalesce\` renamed to \`first_valid\`` - Success criteria

### docs/sprint-artifacts/dsl-function-rename-orchestrator-prompt.md
- **Line 16:** `**Summary:** Rename \`coalesce\` → \`first_valid\` and implement \`earlier_of\`, \`later_of\` functions` - Summary
- **Line 65:** `- Task: Find ALL occurrences of \`coalesce\` in codebase` - Task 1
- **Line 83:** `- Rename coalesce → first_valid` - Subtask
- **Line 89:** `- Implement first_valid (rename from coalesce)` - Subtask
- **Line 134:** `- Find and replace coalesce → first_valid` - Subtask
- **Line 139:** `- Replace coalesce → first_valid` - Subtask
- **Line 172:** `- Task: Search for any remaining \`coalesce\` references` - Final verification task
- **Line 244:** `✅/❌ coalesce renamed to first_valid everywhere` - Success criteria
- **Line 269:** `1. Rename \`coalesce\` → \`first_valid\`` - Phase 1

### docs/dsl-naming-review-2025-12-21.md
- **Line 14:** `1. **Technical users** (programmers, power users) who understand terms like "coalesce" and "proportional"` - User persona
- **Line 43:** `### 1.1 Function: \`coalesce\`` - Section header
- **Line 45:** `**Current Name:** \`coalesce\`` - Current naming
- **Line 60:** `BEFORE: coalesce(solar(16.1, before_sunrise), civil_dawn)` - Example
- **Line 66:** `- Migration: Support both names, deprecate \`coalesce\` over 6-12 months` - Migration strategy
- **Line 71:** `- Keep \`coalesce\` as legacy alias` - Strategy
- **Line 72:** `- UI shows \`first_valid\` in autocomplete (with note that \`coalesce\` also works)` - UI strategy
- **Line 513:** `**1. Function: \`coalesce\` → \`first_valid\`** ` - Implementation strategy section
- **Line 516:** `- **Migration:** Add \`first_valid\` as primary, keep \`coalesce\` as alias` - Migration approach
- **Line 586:** `- Example: Type "first" → suggests \`first_valid (or coalesce)\`` - Autocomplete example
- **Line 587:** `- Tooltips explain: "Also known as: coalesce"` - Tooltip content
- **Line 606:** `"coalesce": true,` - Function map entry
- **Line 607:** `"first_valid": true,  // Alias for coalesce` - Comment
- **Line 614:** `// Works for both "coalesce" and "first_valid"` - Code comment
- **Line 623:** `aliases: ['coalesce'],` - Aliases definition
- **Line 636:** `└─ Alias: coalesce` - Diagram element
- **Line 658:** `COUNT(*) FILTER (WHERE formula LIKE '%coalesce%') as uses_coalesce,` - SQL query
- **Line 668:** `- **coalesce:** 0-5 (missing from UI, rarely used)` - Analysis
- **Line 686:** `coalesce(solar(16.1, before_sunrise), civil_dawn)` - Example
- **Line 692:** `- "What does coalesce mean?"` - User confusion
- **Line 712:** `first_valid(...)  OR  coalesce(...)` - Dual syntax example
- **Line 751:** `{"coalesce(sunrise, sunset)", true},` - Test case
- **Line 774:** `- [ ] Add \`first_valid\` as alias for \`coalesce\`` - Checklist item
- **Line 827:** `| \`coalesce\` | \`first_valid\` | Function | Alias (Phase 1) |` - Mapping table

---

## Key Findings

### Implementation Status
- **Backend:** Fully implemented with parser, validator, executor, and error handling
- **Frontend:** Full UI support added (autocomplete, tokens, language definition, context helpers, tooltips, error humanization)
- **Database:** No direct `coalesce` usage in migrations (no hardcoded formulas)
- **Documentation:** Extensive documentation covering function purpose, examples, and error messages

### Related Items
- **Planned Rename:** Multiple documents reference renaming `coalesce` to `first_valid` with aliases for backward compatibility
- **Planned New Functions:** `earlier_of`, `later_of` functions discussed as planned additions
- **UX Concerns:** Research documents indicate user confusion with the term "coalesce" - suggests need for more intuitive naming

### File Categories

**Backend Implementation (3 files, 10 core occurrences):**
- `api/internal/dsl/token.go` - Function keyword definition
- `api/internal/dsl/validator.go` - Semantic validation rules
- `api/internal/dsl/executor.go` - Function execution logic

**Frontend UI Support (7 files, 26 occurrences):**
- `web/lib/codemirror/dsl-tokens.ts` - Syntax tokens
- `web/lib/codemirror/dsl-language.ts` - Language keywords
- `web/lib/error-humanizer.ts` - Error message handling
- `web/lib/codemirror/dsl-completions.ts` - Autocomplete support
- `web/lib/dsl-context-helper.ts` - Context awareness
- `web/lib/dsl-reference-data.ts` - Reference documentation
- `web/lib/tooltip-content.ts` - Inline tooltips

**Documentation & Planning (8 files, 111 occurrences):**
- `docs/dsl-complete-guide.md` - Main DSL documentation
- `docs/registry-completion-plan.md` - Registry planning
- `docs/audit/alos-zmanim-audit.md` - Function audit
- `docs/audit/dsl-functions-audit.md` - DSL audit
- `docs/audit/misc-zmanim-audit.md` - Miscellaneous audit
- `docs/research-dsl-sync-2025-12-21.md` - Sync research
- `docs/research-dsl-redesign-2025-12-21.md` - UX redesign research
- `docs/ux-dsl-editor-inline-guidance.md` - Editor guidance
- `docs/sprint-artifacts/dsl-function-rename-plan.md` - Rename implementation plan
- `docs/sprint-artifacts/dsl-function-rename-orchestrator-prompt.md` - Orchestrator prompt
- `docs/dsl-naming-review-2025-12-21.md` - Naming review and strategy

**Generated Code (1 file, 3 occurrences):**
- `api/internal/db/sqlcgen/version_history.sql.go` - Auto-generated sqlc code (variable name collision - unrelated to DSL function)

---

## Notes

1. **Variable Name Collision:** The occurrence in `version_history.sql.go` is a variable named `coalesce` (SQL function reference), not the DSL function.

2. **Comprehensive UI Support:** Unlike the earlier research indicating missing UI support, current codebase shows complete frontend implementation with:
   - Autocomplete suggestions
   - Syntax highlighting
   - Context-aware tooltips
   - Error handling and humanization
   - Reference documentation

3. **Planned Evolution:** Project plans include renaming `coalesce` to `first_valid` while maintaining backward compatibility through aliases.

4. **No Test Cases:** No dedicated test cases for `coalesce` function found in `dsl_test.go`, despite other functions being tested. This may be an oversight.

---

## Report Generation Details

- **Search Method:** Grep pattern matching (case-insensitive)
- **Excluded:** `.git/`, `node_modules/`, `build/`, `dist/`
- **Search Paths:** `api/`, `web/`, `db/`, `docs/`
- **Report Created:** 2025-12-21
