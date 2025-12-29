# Multi-Agent Orchestrator: Remove show_in_preview Database Column

## Mission
Remove the `show_in_preview` database column from `publisher_zmanim` table and refactor the codebase to use purely tag-based filtering with the computed `is_active_today` field.

## Context Summary
- **Problem**: `show_in_preview` was incorrectly implemented as a database flag instead of computed logic
- **Solution**: Remove the column; rely on `ShouldShowZman(tags, activeEventCodes)` for filtering
- **Two Modes**:
  - **Normal mode** (`includeInactive=false`): Filter zmanim by `ShouldShowZman` result
  - **Algorithm Editor mode** (`includeInactive=true`): Return ALL zmanim with `is_active_today` computed

---

## Agent Assignments (Run in Parallel)

### 🔵 AGENT 1: Database Migration Agent
**Focus**: Database schema changes

**Tasks**:
1. Create a new migration file in `api/internal/db/migrations/` to drop `show_in_preview` column from `publisher_zmanim` table
2. Follow existing migration naming conventions (check latest migration number)
3. Include both UP and DOWN migrations
4. Verify no foreign keys or indexes depend on this column

**Files to examine**:
- `api/internal/db/migrations/` - existing migrations for patterns
- `api/internal/db/schema.sql` - current schema

**Deliverable**: Migration file ready to apply

---

### 🟢 AGENT 2: SQLc Queries Agent
**Focus**: SQL query updates

**Tasks**:
1. Find ALL SQLc query files that reference `show_in_preview`
2. Remove `show_in_preview` from SELECT statements
3. Remove any WHERE clauses filtering on `show_in_preview`
4. Update `api/internal/db/queries/INDEX.md` if needed
5. Run `cd api && sqlc generate` to regenerate Go code

**Files to examine**:
- `api/internal/db/queries/*.sql` - all query files
- `api/internal/db/queries/INDEX.md` - query index

**Search patterns**:
```bash
grep -r "show_in_preview" api/internal/db/queries/
```

**Deliverable**: Updated SQL files, regenerated SQLc code

---

### 🟡 AGENT 3: Go Backend Agent
**Focus**: Go service/handler code updates

**Tasks**:
1. Find ALL Go files referencing `ShowInPreview` field
2. Remove `ShowInPreview` from struct definitions
3. Update filtering logic in zmanim service:
   - Change from checking `!pz.ShowInPreview` to pure `ShouldShowZman` filtering
   - Ensure `!params.IncludeInactive` controls whether filtering happens
4. Verify `is_active_today` is properly computed and returned
5. Run `cd api && go build ./cmd/api` to verify compilation

**Files to examine**:
- `api/internal/services/zmanim*.go` - zmanim service
- `api/internal/handlers/` - handlers
- `api/internal/models/` - model definitions

**Search patterns**:
```bash
grep -r "ShowInPreview" api/
grep -r "show_in_preview" api/
```

**Deliverable**: Updated Go code that compiles cleanly

---

### 🟣 AGENT 4: Frontend Agent
**Focus**: Next.js frontend updates

**Tasks**:
1. Find ALL TypeScript/React files referencing `show_in_preview` or `showInPreview`
2. Remove these references from:
   - Type definitions
   - API response handling
   - Component props
   - UI rendering logic
3. Ensure components use `is_active_today` or `isActiveToday` instead
4. Run `cd web && npm run type-check` to verify

**Files to examine**:
- `web/app/` - page components
- `web/components/` - shared components
- `web/lib/` - utilities and API client
- `web/types/` - TypeScript definitions

**Search patterns**:
```bash
grep -r "show_in_preview\|showInPreview" web/
```

**Deliverable**: Updated frontend code that passes type-check

---

## Orchestration Rules

### Execution Order
1. **Phase 1 (Parallel)**: Run ALL 4 agents simultaneously
2. **Phase 2 (Sequential)**: After all agents complete:
   - Apply database migration
   - Run `sqlc generate`
   - Run `go build`
   - Run `npm run type-check`
   - Run `./scripts/validate-ci-checks.sh`

### Coordination Points
- Agent 2 (SQLc) must complete before Agent 3 (Go) can verify compilation
- Agent 1 (Migration) is independent - can merge anytime
- Agent 4 (Frontend) is independent of backend changes

### Success Criteria
- [ ] Migration file created and syntactically correct
- [ ] No references to `show_in_preview` in `api/internal/db/queries/`
- [ ] No references to `ShowInPreview` in Go code
- [ ] No references to `showInPreview` in frontend code
- [ ] `go build ./cmd/api` succeeds
- [ ] `npm run type-check` succeeds
- [ ] Algorithm Editor mode (`includeInactive=true`) returns all zmanim
- [ ] Normal mode filters correctly via `ShouldShowZman`

---

## Prompt for Each Agent

### Common Preamble (include for all agents):
```
You are working on the zmanim project. Your task is part of a larger refactoring effort to remove the `show_in_preview` database column from `publisher_zmanim`.

CONTEXT:
- `show_in_preview` was a mistaken database flag
- Filtering should be based purely on tag matching via `ShouldShowZman(tags, activeEventCodes)`
- The computed field `is_active_today` indicates if a zman is relevant for the current day
- `params.IncludeInactive` controls whether filtering is applied (false = filter, true = return all)

DO NOT:
- Add new features or refactor unrelated code
- Create TODO/FIXME comments
- Modify files outside your assigned scope

DO:
- Make minimal, surgical changes
- Verify your changes compile/type-check
- Report what files you modified
```

---

## Post-Completion Verification

After all agents complete, run:
```bash
# Apply migration (if using migrate tool)
# cd api && migrate -path ./internal/db/migrations -database "$DATABASE_URL" up

# Regenerate and build
cd api && sqlc generate && go build ./cmd/api

# Frontend check
cd web && npm run type-check

# Full CI validation
./scripts/validate-ci-checks.sh
```

### Manual Testing Checklist
1. **Algorithm Editor** (`/publisher/algorithm`):
   - Should show ALL zmanim regardless of today's date
   - Inactive zmanim should display (possibly greyed out)

2. **Daily/Weekly Preview**:
   - Should only show zmanim relevant to each day
   - Event zmanim appear only on relevant days
   - Everyday zmanim always appear

3. **PDF Generation**:
   - Same filtering as daily/weekly preview
