# Orchestrator Prompt: Eliminate ALL Hardcoded Event Logic

## Mission

Eliminate ALL hardcoded event logic from the zmanim codebase and implement a pure tag-driven architecture where:
1. HebCal library determines which events are active
2. Database tags drive ALL filtering decisions
3. ZERO hardcoded event type checking exists anywhere in the code
4. Hidden tags system added for internal-only tags that don't show to users

## Non-Negotiable Requirements

1. **NO HARDCODED LOGIC** - Zero tolerance for hardcoded event checking
2. **Tag-driven only** - All event knowledge lives in database tags
3. **Hidden tags** - Support tags that don't show to users but affect filtering
4. **100% test coverage** - All changes validated with automated tests
5. **No regressions** - Dec 24 (regular day) and Jan 10 (fast day) must work correctly

## Parallel Work Streams (Use Sonnet Sub-Agents)

Launch ALL agents in parallel in a single message. Each agent has a specific domain of responsibility.

### Agent 1: Database Schema Enhancements
**Model:** sonnet
**Task:** Enhance database schema to support hidden tags and eliminate need for hardcoded logic

**Deliverables:**
1. Add `is_hidden` boolean column to `zman_tags` table
2. Add `yom_tov_level` integer column (0=regular, 1=yom_tov, 2=chol_hamoed)
3. Add `fast_start_type` varchar column ('dawn' | 'sunset' | null)
4. Add `day_number` and `total_days` integers for multi-day events
5. Migration SQL: `db/migrations/20251224220000_add_tag_metadata.sql`
6. Update seed data with metadata for ALL existing tags
7. Mark internal-only tags as hidden (yom_tov, fast_day, generic categories)

**Validation:**
- Schema changes apply cleanly
- All constraints valid
- Seed data populates correctly
- Query to list all hidden tags works

---

### Agent 2: Eliminate mapHolidayToEventCode() Function
**Model:** sonnet
**Task:** Replace hardcoded event mapping with database-driven pattern matching

**Current State:**
- File: `api/internal/calendar/events.go:310-412`
- Function: `mapHolidayToEventCode()` - 102 lines of hardcoded switch statement
- Must be completely deleted

**Deliverables:**
1. Create `GetEventCodeFromHebcal()` function that:
   - Takes HebCal event name string
   - Queries `tag_event_mappings` table for pattern match
   - Returns matching tag_key(s)
   - Uses SQL LIKE for wildcard patterns (e.g., "Rosh Hashana%" matches "Rosh Hashana I")
   - Returns multiple tags if multiple patterns match (specific + generic)

2. Update `holidayToActiveEvent()` function:
   - Replace `mapHolidayToEventCode()` call with `GetEventCodeFromHebcal()`
   - Read metadata from database tags (yom_tov_level, fast_start_type, day_number)
   - No hardcoded event knowledge

3. Delete these hardcoded functions:
   - `mapHolidayToEventCode()` (lines 310-412)
   - `getFastStartType()` (lines 414-424)
   - `isYomTovEvent()` (lines 426-438)

**Validation:**
- All hardcoded functions deleted
- No switch statements on event codes remain
- Test: Rosh Hashana I/II both map to "rosh_hashanah" tag
- Test: Fast days return correct fast_start_type from DB
- Test: Yom Tov events have yom_tov_level=1

---

### Agent 3: Eliminate detectSpecialContexts() Logic
**Model:** sonnet
**Task:** Replace hardcoded special context detection with tag queries

**Current State:**
- File: `api/internal/calendar/events.go:207-249`
- Function: `detectSpecialContexts()` hardcodes Yom Tov knowledge
- Uses `isYomTovEvent()` helper function

**Deliverables:**
1. Create `GetEventMetadata()` database query:
   - Input: event_code
   - Returns: yom_tov_level, is_multi_day, day_number, total_days
   - SQL query against zman_tags table

2. Replace `detectSpecialContexts()` logic:
   - Query database for event metadata instead of hardcoded checks
   - Use `yom_tov_level > 0` instead of `isYomTovEvent()`
   - Use `day_number` and `total_days` from DB for multi-day detection

3. Simplify or eliminate the function entirely if possible

**Validation:**
- No calls to `isYomTovEvent()` remain
- Special contexts detected correctly for Rosh Hashana, Pesach, Sukkot
- Test: Friday before Yom Tov correctly detected
- Test: Yom Tov day 2 correctly detected

---

### Agent 4: Eliminate DisplayContexts Logic
**Model:** sonnet
**Task:** Remove hardcoded DisplayContexts population and use category tags only

**Current State:**
- File: `api/internal/calendar/events.go:473-507`
- Hardcoded checks for "shabbos" and Yom Tov events
- Mixes event codes with display logic

**Deliverables:**
1. Simplify `GetZmanimContext()`:
   - Remove `DisplayContexts` array entirely (or populate from category tags only)
   - Keep ONLY `ActiveEventCodes []string`
   - No hardcoded event type checking

2. Update handlers to use category tags for grouping:
   - Category tags: `category_candle_lighting`, `category_havdalah`, `category_fast_start`, etc.
   - Frontend groups by category tag, not by event codes

3. Fix motzei events bug:
   - Add motzei events to `ActiveEventCodes` (not just DisplayContexts)
   - Ensures havdalah zmanim show on Saturday

**Validation:**
- No hardcoded "shabbos" string checks
- No hardcoded Yom Tov checks in GetZmanimContext()
- Test: Saturday havdalah shows (motzei_shabbos in ActiveEventCodes)
- Test: Friday candle lighting shows (erev_shabbos in ActiveEventCodes)

---

### Agent 5: Implement Hidden Tags System
**Model:** sonnet
**Task:** Add hidden tags functionality to prevent internal tags from showing to users

**Requirements:**
Hidden tags should:
- Not appear in tag lists shown to users
- Not appear in tag chips/badges in UI
- Still participate in event matching and filtering
- Be queryable for admin/debugging purposes

**Examples of Hidden Tags:**
- `yom_tov` - generic category, not specific event
- `fast_day` - generic category
- `category_*` - internal categorization tags
- Any tag with `is_hidden=true` in database

**Deliverables:**
1. Update SQL queries to filter hidden tags:
   - File: `api/internal/db/queries/zmanim_tags.sql`
   - Add `WHERE is_hidden = false` to user-facing queries
   - Create separate queries for admin views (include hidden)

2. Update API responses:
   - Filter hidden tags from `response.Tags[]` arrays
   - Keep hidden tags in internal filtering logic
   - Document which endpoints show/hide tags

3. Update frontend components:
   - TagChip, TagSelector, TagManager should not show hidden tags
   - Add admin view to see all tags including hidden

4. Add database query: `GetHiddenTags()` for debugging

**Validation:**
- User-facing endpoints don't return hidden tags
- Admin endpoints DO return hidden tags
- Filtering still works with hidden tags
- Test: "fast_day" tag filters correctly but doesn't show in UI

---

### Agent 6: Eliminate Tisha B'Av Special Case
**Model:** sonnet
**Task:** Remove hardcoded Tisha B'Av logic in master registry handler

**Current State:**
- File: `api/internal/handlers/master_registry.go:734-742`
- Hardcoded check for `tag.TagKey == "tisha_bav"`
- Special category assignment

**Deliverables:**
1. Add specific category tags to database:
   - `category_tisha_bav_fast_start` for Tisha B'Av fast beginning zmanim
   - `category_tisha_bav_fast_end` for Tisha B'Av fast ending zmanim

2. Update master zmanim seed data:
   - Tag Tisha B'Av specific zmanim with new category tags
   - Remove generic `category_fast_start`/`end` from Tisha B'Av zmanim

3. Remove hardcoded special case logic:
   - Delete lines 734-742 in master_registry.go
   - Category is determined purely by category tags

**Validation:**
- No string literals "tisha_bav" in handlers
- Tisha B'Av zmanim grouped separately from other fasts
- Other fast days not affected

---

### Agent 7: Comprehensive Testing Suite
**Model:** sonnet
**Task:** Create comprehensive tests to validate zero hardcoded logic

**Deliverables:**

1. **File:** `api/internal/calendar/events_tag_driven_test.go`
   - `TestNoHardcodedEventChecks()` - greps codebase for hardcoded event strings
   - `TestDatabaseDrivenMapping()` - validates all events map via database
   - `TestHiddenTagsFiltering()` - validates hidden tags don't show to users
   - `TestMetadataFromDatabase()` - yom_tov_level, fast_start_type read from DB

2. **File:** `api/internal/handlers/zmanim_integration_test.go`
   - `TestRegularDay()` - Dec 24, 2025 (no events, no zmanim with event tags)
   - `TestFastDay()` - Jan 10, 2025 (Asara B'Teves, fast zmanim show)
   - `TestFridayErevShabbos()` - candle lighting shows
   - `TestSaturdayMotzeiShabbos()` - havdalah shows
   - `TestYomTov()` - Rosh Hashana, Yom Kippur
   - `TestMultiDayEvent()` - Chanukah day 5, Pesach day 3

3. **File:** `scripts/validate-no-hardcoded-logic.sh`
   - Bash script that searches for forbidden patterns:
     - `"shabbos"` (as string literal in event logic)
     - `"yom_kippur"`, `"rosh_hashanah"`, etc. (event code strings)
     - `isYomTovEvent()` function calls
     - `getFastStartType()` function calls
     - `mapHolidayToEventCode()` function calls
   - Exit code 1 if any hardcoded logic found
   - Exit code 0 if clean

4. **Integration test data:**
   - Test database with sample events
   - Test fixtures for HebCal responses
   - Expected zmanim output for each test date

**Validation:**
- All tests pass
- Validation script returns exit code 0
- Coverage report shows >90% coverage for modified files

---

### Agent 8: Documentation & Migration Guide
**Model:** sonnet
**Task:** Document the new tag-driven architecture and migration path

**Deliverables:**

1. **File:** `docs/architecture/tag-driven-events.md`
   - Complete architecture documentation
   - How event matching works
   - Hidden tags system explanation
   - Database schema reference
   - Query examples

2. **File:** `docs/migration/eliminate-hardcoded-logic.md`
   - Migration checklist
   - Before/after code examples
   - Breaking changes (if any)
   - Rollback procedure

3. **File:** `CHANGELOG-tag-driven.md`
   - What changed in this release
   - What was deleted (hardcoded functions)
   - What was added (database metadata)
   - How to adapt custom code (if any)

4. **Update:** `CLAUDE.md`
   - Add section on tag-driven architecture
   - Reference new query files
   - Update coding standards

**Validation:**
- All documentation renders correctly
- Code examples compile and run
- No broken links

---

## Definition of Done (DoD)

### Code Quality
- [ ] Zero hardcoded event type checking (validated by grep script)
- [ ] All event logic driven by database tags
- [ ] No switch statements on event codes
- [ ] No helper functions like `isYomTovEvent()`, `getFastStartType()`
- [ ] Functions `mapHolidayToEventCode()`, `getFastStartType()`, `isYomTovEvent()` deleted
- [ ] Hardcoded special case in `master_registry.go` deleted

### Database
- [ ] Schema migration applies cleanly
- [ ] `is_hidden` column added to `zman_tags`
- [ ] `yom_tov_level`, `fast_start_type`, `day_number`, `total_days` columns added
- [ ] All existing tags populated with metadata
- [ ] Hidden tags marked (`yom_tov`, `fast_day`, `category_*`)

### Functionality
- [ ] Dec 24, 2025 returns empty events, no fast zmanim show
- [ ] Jan 10, 2025 returns Asara B'Teves, fast zmanim show
- [ ] Friday returns erev_shabbos, candle lighting shows
- [ ] Saturday returns motzei_shabbos, havdalah shows
- [ ] Rosh Hashana I and II both map to "rosh_hashanah" tag
- [ ] Fast days return correct `fast_start_type` from database
- [ ] Yom Tov events have `yom_tov_level=1`

### Hidden Tags
- [ ] User-facing API endpoints don't return hidden tags
- [ ] Admin endpoints DO return hidden tags
- [ ] Hidden tags still participate in filtering
- [ ] Frontend components don't display hidden tags

### Testing
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] `validate-no-hardcoded-logic.sh` returns exit code 0
- [ ] Coverage >90% for modified files
- [ ] Manual testing completed for 6 test scenarios

### Documentation
- [ ] Architecture documentation complete
- [ ] Migration guide complete
- [ ] CHANGELOG updated
- [ ] CLAUDE.md updated

### Performance
- [ ] No performance regressions (compare query times before/after)
- [ ] Database queries optimized with indexes
- [ ] No N+1 query issues

---

## Validation Commands

```bash
# 1. Apply migrations
cd api
source .env
psql "$DATABASE_URL" -f ../db/migrations/20251224220000_add_tag_metadata.sql

# 2. Rebuild with new code
cd api
go build ./cmd/api

# 3. Run all tests
go test -v ./internal/calendar/...
go test -v ./internal/handlers/...
go test -v ./internal/services/...

# 4. Run validation script
cd ..
./scripts/validate-no-hardcoded-logic.sh

# 5. Manual integration tests
./restart.sh
# Test each scenario in browser/curl

# 6. Check for forbidden patterns
grep -r "isYomTovEvent\|getFastStartType\|mapHolidayToEventCode" api/internal/ && echo "FAIL: Hardcoded logic found" || echo "PASS: No hardcoded logic"
```

---

## Test Scenarios (Manual Validation)

### Scenario 1: Regular Day (No Events)
```bash
DATE=2025-12-24
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=542028&date=$DATE" | jq '.day_context.active_event_codes'
# Expected: []

curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=542028&date=$DATE" | jq '.zmanim[] | select(.tags[]? | .tag_key == "fast_day")'
# Expected: (empty - no fast zmanim)
```

### Scenario 2: Fast Day
```bash
DATE=2025-01-10
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=542028&date=$DATE" | jq '.day_context.active_event_codes'
# Expected: ["asarah_bteves"]

curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=542028&date=$DATE" | jq '.zmanim[] | select(.master_zman_key == "fast_begins") | .hebrew_name'
# Expected: "תחילת הצום" (fast begins zman appears)
```

### Scenario 3: Friday (Erev Shabbos)
```bash
DATE=2025-12-26
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=542028&date=$DATE" | jq '.day_context.active_event_codes'
# Expected: ["shabbos"] or ["erev_shabbos"]

curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=542028&date=$DATE" | jq '.zmanim[] | select(.tags[]? | .tag_key == "category_candle_lighting")'
# Expected: (candle lighting zmanim appear)
```

### Scenario 4: Saturday (Motzei Shabbos)
```bash
DATE=2025-12-27
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=542028&date=$DATE" | jq '.day_context.active_event_codes'
# Expected: ["shabbos"] or ["motzei_shabbos"]

curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=542028&date=$DATE" | jq '.zmanim[] | select(.tags[]? | .tag_key == "category_havdalah")'
# Expected: (havdalah zmanim appear)
```

### Scenario 5: Rosh Hashana
```bash
DATE=2025-09-23
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=542028&date=$DATE" | jq '.day_context.active_event_codes'
# Expected: ["rosh_hashanah"]

# Verify metadata from database
psql "$DATABASE_URL" -c "SELECT tag_key, yom_tov_level FROM zman_tags WHERE tag_key = 'rosh_hashanah';"
# Expected: yom_tov_level = 1
```

### Scenario 6: Hidden Tags Don't Show
```bash
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=542028&date=2025-01-10" | jq '.zmanim[0].tags[] | select(.tag_key == "yom_tov" or .tag_key == "fast_day")'
# Expected: (empty - hidden tags filtered out)

# But admin endpoint shows them
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:8080/api/v1/admin/tags?include_hidden=true" | jq '.[] | select(.is_hidden == true)'
# Expected: (list of hidden tags)
```

---

## Orchestration Instructions

**CRITICAL: The orchestrator MUST NOT do any work itself. Only coordinate agents.**

### Phase 1: Launch All Agents in Parallel

**Step 1:** Launch ALL 8 agents in parallel using a SINGLE message with 8 Task tool calls.

```
Send ONE message containing:
- Task tool call for Agent 1 (Database Schema)
- Task tool call for Agent 2 (Eliminate mapHolidayToEventCode)
- Task tool call for Agent 3 (Eliminate detectSpecialContexts)
- Task tool call for Agent 4 (Eliminate DisplayContexts)
- Task tool call for Agent 5 (Hidden Tags System)
- Task tool call for Agent 6 (Tisha B'Av Special Case)
- Task tool call for Agent 7 (Testing Suite)
- Task tool call for Agent 8 (Documentation)
```

**Step 2:** Wait for all agents to complete. Collect agent IDs for each.

### Phase 2: Validation Coordination

Once all agents complete, the orchestrator should:

1. **Ask a validation sub-agent** to run all validation commands
2. **Ask an integration sub-agent** to apply migrations and test
3. **Ask a review sub-agent** to verify DoD checklist
4. **Report results** to user with pass/fail status

**DO NOT:**
- Write any code yourself
- Apply any migrations yourself
- Run any tests yourself
- Modify any files yourself

**DO:**
- Coordinate agent execution
- Collect agent outputs
- Report status to user
- Launch follow-up agents if needed

**Timeline:** 4-5 hours total (agents work in parallel)

---

## Files to Monitor

**Will be modified:**
- `api/internal/calendar/events.go` - delete 3 functions, replace with DB queries
- `api/internal/calendar/events_test.go` - add tag-driven tests
- `api/internal/handlers/master_registry.go` - remove Tisha B'Av special case
- `api/internal/handlers/publisher_zmanim.go` - simplify filtering
- `api/internal/db/queries/zmanim_tags.sql` - add hidden tag filtering
- `db/migrations/00000000000001_schema.sql` - add columns
- `db/migrations/00000000000002_seed_data.sql` - add metadata

**Will be created:**
- `db/migrations/20251224220000_add_tag_metadata.sql`
- `api/internal/calendar/events_tag_driven_test.go`
- `api/internal/handlers/zmanim_integration_test.go`
- `scripts/validate-no-hardcoded-logic.sh`
- `docs/architecture/tag-driven-events.md`
- `docs/migration/eliminate-hardcoded-logic.md`
- `CHANGELOG-tag-driven.md`

**Will be deleted:**
- Lines from `events.go`: 310-438 (3 hardcoded functions)
- Lines from `master_registry.go`: 734-742 (Tisha B'Av special case)

---

## Success Metrics

1. **Zero Hardcoded Logic:** `grep -r "\"yom_kippur\"|\"rosh_hashanah\"|isYomTovEvent" api/internal/` returns nothing
2. **All Tests Pass:** Exit code 0 from test suite
3. **Functional Tests Pass:** All 6 manual scenarios work correctly
4. **Hidden Tags Work:** Generic tags hidden from users but still filter correctly
5. **Performance:** Query times ≤ previous baseline
6. **Documentation:** Complete architecture docs with examples

---

## Emergency Rollback

If critical issues found:

```bash
# Revert migrations
psql "$DATABASE_URL" -c "DROP TABLE IF EXISTS zman_tags_backup; ALTER TABLE zman_tags DROP COLUMN IF EXISTS is_hidden, DROP COLUMN IF EXISTS yom_tov_level, DROP COLUMN IF EXISTS fast_start_type;"

# Revert code
git revert <commit-hash>

# Restart services
./restart.sh
```

Keep backup of current working code before starting.

---

## Orchestrator Workflow

### Step 1: Launch Phase (1 message, 8 agent calls)
```
ORCHESTRATOR → Launch agents 1-8 in parallel
ORCHESTRATOR → Wait for all completions
ORCHESTRATOR → Collect outputs and agent IDs
```

### Step 2: Integration Phase (sequential sub-agents)
```
ORCHESTRATOR → Launch validation agent to run scripts
ORCHESTRATOR → Launch integration agent to apply migrations
ORCHESTRATOR → Launch test agent to run test suite
```

### Step 3: Verification Phase (sub-agent)
```
ORCHESTRATOR → Launch review agent to verify DoD
ORCHESTRATOR → Collect final status report
```

### Step 4: Report to User
```
ORCHESTRATOR → Present summary:
  - Which agents completed successfully
  - Validation results (pass/fail)
  - DoD checklist status
  - Any issues found
  - Next steps if failures
```

---

**ORCHESTRATOR: You are a coordinator only. Launch all 8 agents in parallel using Task tool. Do not write code, apply migrations, or run tests yourself. Only coordinate sub-agents and report results.**

**BEGIN ORCHESTRATION NOW.**
