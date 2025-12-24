# Consolidate jewish_events into zman_tags - Parallel Agent Orchestrator

**CRITICAL: This prompt is for a DEV AGENT running in ORCHESTRATOR ROLE**

You will coordinate **parallel sub-agents (all using sonnet model)** to eliminate the `jewish_events` table by consolidating all functionality into the existing `zman_tags` system.

---

## MISSION CONTEXT

### The Problem
The codebase has two overlapping systems for Jewish calendar events:

| System | Records | Active Usage | HebCal Integration |
|--------|---------|--------------|-------------------|
| `jewish_events` | 23 | 1 API endpoint (metadata only) | None |
| `zman_tags` | 70+ | Core zmanim filtering & display | Yes, via `tag_event_mappings` |

Both contain the same events (shabbos, yom_kippur, chanukah, etc.) causing:
- Maintenance overhead
- Potential data inconsistency
- Confusing data model

### The Solution
Consolidate into `zman_tags` which is already the authoritative source for zmanim logic.

### Tables to Remove
- `jewish_events`
- `jewish_event_types`
- `fast_start_types`
- `event_categories`

---

## DEFINITION OF DONE (DoD)

- [ ] All unique `jewish_events` data migrated/mapped to `zman_tags`
- [ ] API endpoint `GET /api/v1/calendar/events` returns equivalent data from `zman_tags`
- [ ] All 4 tables dropped: `jewish_events`, `jewish_event_types`, `fast_start_types`, `event_categories`
- [ ] All SQL queries updated (no references to removed tables)
- [ ] All Go code updated (handlers, models)
- [ ] SQLc regenerated: `cd api && sqlc generate` ✓
- [ ] Go build passes: `cd api && go build ./cmd/api` ✓
- [ ] Type check passes: `cd web && npm run type-check` ✓
- [ ] API returns valid response: `curl http://localhost:8080/api/v1/calendar/events | jq '.'` ✓
- [ ] CI validation passes: `./scripts/validate-ci-checks.sh` ✓
- [ ] Migration has working DOWN (rollback tested)

---

## ORCHESTRATION PHASES

### Phase 1: Parallel Investigation (4 Sonnet Agents)

Launch these agents **IN PARALLEL**:

#### Agent 1: Schema Deep Analysis (sonnet)
```
TASK: Analyze all tables being removed and identify data gaps

READ these files:
- db/migrations/00000000000001_schema.sql
- db/migrations/00000000000002_seed_data.sql

EXTRACT:
1. Full CREATE TABLE for: jewish_events, jewish_event_types, fast_start_types, event_categories
2. Full CREATE TABLE for: zman_tags, tag_types
3. All INSERT statements for both systems
4. ALL foreign key constraints referencing these tables (search entire schema)

COMPARE columns:
- jewish_events columns NOT in zman_tags:
  - duration_days_israel
  - duration_days_diaspora
  - fast_start_type_id
  - parent_event_id
  - event_type_id

DETERMINE:
- Are these columns used ANYWHERE in queries or code?
- Can we drop them or must we migrate them?

DELIVERABLE:
- Table schemas (formatted)
- Column gap analysis table
- FK dependency list
- Recommendation: columns to add to zman_tags (if any)
```

#### Agent 2: Query & Code Audit (sonnet)
```
TASK: Find ALL code references to tables being removed

SEARCH entire codebase (api/, web/, db/) for:
- jewish_events
- jewish_event_types
- fast_start_types
- event_categories
- GetAllJewishEvents
- GetJewishEventsByType
- JewishEvent (Go struct)
- EventCategory
- FastStartType

CHECK specifically:
- api/internal/db/queries/calendar.sql
- api/internal/db/queries/*.sql (all query files)
- api/internal/handlers/calendar.go
- api/internal/db/sqlcgen/*.go
- web/lib/api-client.ts
- web/**/*.tsx (any frontend consuming events endpoint)

DELIVERABLE:
| File | Line(s) | Reference | Required Change |
|------|---------|-----------|-----------------|
| ...  | ...     | ...       | ...             |

Total files to modify: X
```

#### Agent 3: API Contract Analysis (sonnet)
```
TASK: Document current API response shape and design new query

1. READ api/internal/handlers/calendar.go - find GetJewishEvents handler
2. READ api/internal/db/queries/calendar.sql - find query definitions
3. READ api/internal/db/sqlcgen/calendar.sql.go - find generated response struct

DOCUMENT current response shape:
- Endpoint: GET /api/v1/calendar/events
- Query params accepted
- Response JSON structure (all fields)

DESIGN new query against zman_tags:
- Must return SAME fields (or document breaking changes)
- Filter: tag_type_id = 170 (event type)
- Include: Hebrew/English names, event type info

DELIVERABLE:
- Current response shape (JSON example)
- New SQL query (complete, tested mentally)
- Field mapping: old_field → new_source
- Breaking changes (if any)
```

#### Agent 4: Test & E2E Impact (sonnet)
```
TASK: Find all tests affected by this change

SEARCH for:
- api/internal/handlers/*_test.go referencing calendar or jewish
- web/e2e/**/*.spec.ts referencing calendar/events
- Any mock data for jewish_events

CHECK:
- Does /api/v1/calendar/events have test coverage?
- Are there integration tests?
- E2E tests hitting this endpoint?

DELIVERABLE:
- List of test files to update
- Specific test functions affected
- Recommendation: update vs remove each test
```

---

### Phase 2: Migration Creation (Sequential)

After Phase 1 completes, create migration:

#### Agent 5: Write Migration (sonnet)
```
TASK: Create complete migration file

Based on Phase 1 findings, create:
db/migrations/YYYYMMDDHHMMSS_consolidate_jewish_events.sql

Use current timestamp for filename (format: 20241224120000)

UP MIGRATION must:
1. Add any missing columns to zman_tags (ONLY if Phase 1 found they're used)
2. DO NOT migrate data if zman_tags already has equivalent records
3. Drop FKs first (in correct order)
4. Drop tables in order:
   - event_categories (no deps)
   - jewish_events (after removing FKs)
   - fast_start_types (after jewish_events)
   - jewish_event_types (after jewish_events)

DOWN MIGRATION must:
1. Recreate all 4 tables with exact original schema
2. Recreate all FKs
3. Insert original seed data
4. Remove any columns added to zman_tags

IMPORTANT: Copy exact CREATE TABLE and INSERT statements from original migration files.

DELIVERABLE:
- Complete migration file content
- Explanation of each step
```

---

### Phase 3: Parallel Code Updates (3 Sonnet Agents)

Launch **IN PARALLEL**:

#### Agent 6: Update SQL Queries (sonnet)
```
TASK: Rewrite calendar.sql queries

EDIT: api/internal/db/queries/calendar.sql

Replace GetAllJewishEvents:
- Query zman_tags WHERE tag_type_id = 170
- JOIN tag_types for type name
- Return fields matching current API contract (from Agent 3)

Replace GetJewishEventsByType (if it exists):
- Similar rewrite or remove if unused

DELETE any queries for:
- event_categories
- fast_start_types
- jewish_event_types

After edits, run:
cd api && sqlc generate

DELIVERABLE:
- Git diff of calendar.sql
- SQLc generate output (success/errors)
```

#### Agent 7: Update Go Handler (sonnet)
```
TASK: Update calendar handler and any affected code

EDIT: api/internal/handlers/calendar.go

Update GetJewishEvents():
- Use new query from Agent 6
- Map response to maintain API contract
- Update any type references

CHECK and update if needed:
- api/internal/handlers/handlers.go (if references removed types)
- Any other handlers referencing jewish events

After edits, run:
cd api && go build ./cmd/api

DELIVERABLE:
- Git diff of all Go files changed
- Build output (success/errors)
```

#### Agent 8: Update Frontend (if needed) (sonnet)
```
TASK: Check and update any frontend code

SEARCH web/ for:
- calendar/events
- JewishEvent
- jewish_events

If found:
- Update type definitions
- Update API calls
- Update component props

After edits, run:
cd web && npm run type-check

DELIVERABLE:
- Git diff of any frontend changes (or "No changes needed")
- Type check output
```

---

### Phase 4: Verification (Sequential)

Run these checks **IN ORDER**:

#### Step 4.1: Apply Migration Locally
```bash
# Get current migration count
ls -la db/migrations/

# Apply migration
source api/.env && psql "$DATABASE_URL" -f db/migrations/<new_migration>.sql

# Verify tables dropped
source api/.env && psql "$DATABASE_URL" -c "\dt jewish*"
source api/.env && psql "$DATABASE_URL" -c "\dt *event*"
```

#### Step 4.2: Regenerate and Build
```bash
cd api && sqlc generate
cd api && go build ./cmd/api
cd web && npm run type-check
```

#### Step 4.3: Start Services and Test
```bash
./restart.sh

# Wait for services
sleep 10

# Test endpoint
curl -s http://localhost:8080/api/v1/calendar/events | jq '.'

# Verify response has data
curl -s http://localhost:8080/api/v1/calendar/events | jq 'length'
```

#### Step 4.4: Test Rollback
```bash
# Apply DOWN migration
source api/.env && psql "$DATABASE_URL" -c "-- Run DOWN section of migration"

# Verify tables restored
source api/.env && psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM jewish_events;"

# Re-apply UP migration
source api/.env && psql "$DATABASE_URL" -f db/migrations/<new_migration>.sql
```

---

### Phase 5: CI Validation & Commit

#### Step 5.1: Run Full CI Checks
```bash
./scripts/validate-ci-checks.sh
```

#### Step 5.2: Update Tests (if needed)
Based on Agent 4 findings, update or remove affected tests.

#### Step 5.3: Commit
```bash
git add -A
git status

git commit -m "refactor(db): consolidate jewish_events into zman_tags

Remove redundant jewish_events infrastructure by leveraging the existing
zman_tags system which is already integrated with HebCal and actively
used for zmanim filtering.

Changes:
- Removed tables: jewish_events, jewish_event_types, fast_start_types, event_categories
- Updated GET /api/v1/calendar/events to query zman_tags (tag_type=event)
- API response shape maintained for backwards compatibility

Motivation:
- Eliminate duplicate event definitions (23 in jewish_events vs 70+ in zman_tags)
- Single source of truth for Jewish calendar events
- Simplify data model and reduce maintenance overhead

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## EXECUTION CHECKLIST

### Phase 1: Investigation ⬜
- [ ] Agent 1: Schema analysis complete
- [ ] Agent 2: Code audit complete
- [ ] Agent 3: API contract documented
- [ ] Agent 4: Test impact assessed

### Phase 2: Migration ⬜
- [ ] Agent 5: Migration file created

### Phase 3: Code Updates ⬜
- [ ] Agent 6: SQL queries updated, sqlc generated
- [ ] Agent 7: Go handler updated, builds
- [ ] Agent 8: Frontend updated (if needed), type-check passes

### Phase 4: Verification ⬜
- [ ] Migration applied successfully
- [ ] All builds pass
- [ ] API endpoint returns valid data
- [ ] Rollback tested and works

### Phase 5: Finalization ⬜
- [ ] CI validation passes
- [ ] Tests updated
- [ ] Changes committed

---

## SUCCESS CRITERIA

**Task is complete when ALL pass:**

1. ✅ `SELECT * FROM jewish_events` → ERROR (table doesn't exist)
2. ✅ `SELECT * FROM zman_tags WHERE tag_type_id = 170` → Returns event data
3. ✅ `curl http://localhost:8080/api/v1/calendar/events` → 200 + JSON array
4. ✅ `cd api && go build ./cmd/api` → Success
5. ✅ `cd api && sqlc generate` → Success (no errors)
6. ✅ `cd web && npm run type-check` → Success
7. ✅ `./scripts/validate-ci-checks.sh` → All checks pass
8. ✅ DOWN migration restores all tables with data

---

## FAILURE HANDLING

If any phase fails:
1. **STOP** further execution
2. **REPORT** exact failure with full error output
3. **DO NOT** commit broken code
4. If migration was applied, run DOWN migration to restore

Common failure points:
- FK constraint violations (drop order wrong)
- Missing columns in new query
- API response shape mismatch
- sqlc generation errors

---

## KEY FILE REFERENCES

```
Schema & Seed:
- db/migrations/00000000000001_schema.sql
- db/migrations/00000000000002_seed_data.sql

Queries:
- api/internal/db/queries/calendar.sql
- api/internal/db/queries/INDEX.md

Handlers:
- api/internal/handlers/calendar.go
- api/internal/handlers/INDEX.md

Generated:
- api/internal/db/sqlcgen/calendar.sql.go
- api/internal/db/sqlcgen/models.go
- api/internal/db/sqlcgen/querier.go
```

---

## BEGIN ORCHESTRATION

**START NOW:**

1. Launch Phase 1 agents (4 agents in parallel)
2. Wait for all Phase 1 agents to complete
3. Synthesize findings and identify any blockers
4. Proceed to Phase 2 (migration creation)
5. Report progress after each phase

Use `Task` tool with `model: "sonnet"` for all sub-agents.

**GO!**
