# Task: Orchestrate Correction Requests Enhancement Using Parallel Sub-Agents

You are an orchestrator agent responsible for coordinating the implementation of correction requests enhancements across multiple sub-agents working in parallel. **You MUST NOT write any code yourself.** Your role is to delegate, coordinate, and verify completion.

## Your Mission

Coordinate the implementation of duplicate warnings, history tracking, and revert functionality for the correction requests system by delegating work to specialized sub-agents in parallel.

---

## Critical Files to Read First

**READ THESE FILES BEFORE DELEGATING:**

1. **`/home/daniel/.claude/plans/reflective-noodling-duckling.md`** - THE COMPLETE IMPLEMENTATION PLAN - This is your orchestration blueprint.

2. **`api/internal/db/queries/correction_requests.sql`** - Current SQL queries, understand the existing structure.

3. **`api/internal/handlers/correction_requests.go`** - Current backend handlers to enhance.

4. **`web/components/publisher/CorrectionRequestDialog.tsx`** - Publisher UI to add warnings.

5. **`web/app/admin/correction-requests/page.tsx`** - Admin UI to enhance.

6. **`api/internal/services/zmanim_service.go`** - Critical: Zmanim calculation flow that must use corrected locality data.

---

## Implementation Phases (Parallel Delegation)

### Phase 1: Database Foundation (Agent 1 - "db-agent")

**Delegate to a specialized database agent:**

**Agent Task:**
1. Create migration file: `db/migrations/20251223000000_correction_request_enhancements.sql`
2. Add new columns to `city_correction_requests` table:
   - `approved_at TIMESTAMP WITH TIME ZONE`
   - `reverted_at TIMESTAMP WITH TIME ZONE`
   - `reverted_by TEXT`
   - `revert_reason TEXT`
3. Create `correction_request_history` table with all fields from the plan
4. Create indexes:
   - `idx_correction_history_request`
   - `idx_correction_history_locality`
   - `idx_correction_history_performed_at`
   - `idx_correction_requests_locality_status`
   - `idx_correction_requests_approved`
5. Test migration locally: `source api/.env && psql "$DATABASE_URL" -f db/migrations/20251223000000_correction_request_enhancements.sql`
6. Verify tables created: `\d city_correction_requests` and `\d correction_request_history`

**Success Criteria:**
- Migration file created and tested
- No SQL errors
- All indexes created
- Ready for `sqlc generate`

---

### Phase 2A: Backend SQL Queries (Agent 2 - "sql-agent")

**Delegate to a specialized SQL query agent:**

**Agent Task:**
1. **Read:** `api/internal/db/queries/correction_requests.sql` to understand existing patterns
2. **Add new queries** (see plan for full SQL):
   - `CheckDuplicateCorrectionRequests` - Find all pending/recent approved requests for a locality
   - `InsertCorrectionHistory` - Record approval/revert actions
   - `GetCorrectionRequestHistory` - Get history by locality_id
   - `GetRequestHistory` - Get history by request_id
   - `RevertCorrectionRequest` - Update request to reverted status
3. **Modify existing query:**
   - `UpdateCorrectionRequestStatus` - Add `approved_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE NULL END`
4. Run `cd api && sqlc generate`
5. Verify generated Go code in `api/internal/db/sqlcgen/correction_requests.sql.go`

**Success Criteria:**
- All queries added to SQL file
- `sqlc generate` succeeds
- Generated Go functions available

---

### Phase 2B: Backend Handlers (Agent 3 - "backend-agent")

**DEPENDS ON:** Phase 2A completion (needs generated queries)

**Delegate to a specialized backend agent:**

**Agent Task:**
1. **Read:** `api/internal/handlers/correction_requests.go` to understand current handler patterns
2. **Add new handler:** `CheckCorrectionDuplicates`
   - Route: `GET /api/v1/publisher/correction-requests/check-duplicates?locality_id={id}`
   - Parses locality_id, calls `CheckDuplicateCorrectionRequests` query
   - Returns JSON array of duplicate requests
3. **Enhance handler:** `UpdateCorrectionRequestStatus`
   - Before approval: fetch current locality values (from GetCorrectionRequestByID)
   - On approval: insert history record with before/after values
   - After approval: check for conflicting pending requests
   - Return enhanced response with `conflicting_request_ids` and `warning`
4. **Add new handler:** `RevertCorrectionRequest`
   - Route: `POST /api/v1/admin/correction-requests/{id}/revert`
   - Parse revert_reason from body (required)
   - Get history to find previous values
   - Restore previous admin override OR delete if none existed
   - Update request to reverted status
   - Insert revert history record
5. **Add new handler:** `GetCorrectionRequestHistory`
   - Route: `GET /api/v1/admin/correction-requests/history?locality_id={id}`
   - Returns all approved/reverted requests with history
6. **Register routes** in `api/cmd/api/main.go`:
   - Publisher: `/correction-requests/check-duplicates`
   - Admin: `/correction-requests/{id}/revert`, `/correction-requests/history`
7. **Test:** Build with `cd api && go build ./cmd/api`

**Success Criteria:**
- All handlers implemented
- Routes registered
- `go build` succeeds
- Handlers follow existing 6-step pattern

---

### Phase 3A: Publisher Warning UI (Agent 4 - "publisher-ui-agent")

**DEPENDS ON:** Phase 2B completion (needs backend endpoint)

**Delegate to a specialized frontend agent:**

**Agent Task:**
1. **Read:** `web/components/publisher/CorrectionRequestDialog.tsx` to understand current implementation
2. **Add state for duplicates:**
   ```tsx
   const [duplicates, setDuplicates] = useState<DuplicateRequest[]>([]);
   ```
3. **Add duplicate check on dialog open:**
   - Call `/api/v1/publisher/correction-requests/check-duplicates?locality_id={id}`
   - Store results in state
4. **Add warning banner** (see plan for full JSX):
   - Show if duplicates exist
   - Display count of pending requests
   - Show latest approved correction date if any
   - Use `Alert` component with `variant="warning"`
   - Include `AlertTriangle` icon
5. **Don't block submission** - just inform user
6. **Test:** Start dev server and verify warning displays

**Success Criteria:**
- Warning banner displays when duplicates exist
- Publishers can still submit despite warning
- Clear messaging about existing requests
- No blocking behavior

---

### Phase 3B: Admin Conflict Warning UI (Agent 5 - "admin-ui-agent")

**DEPENDS ON:** Phase 2B completion (needs backend endpoint)

**Delegate to a specialized frontend agent:**

**Agent Task:**
1. **Read:** `web/app/admin/correction-requests/page.tsx` to understand approval flow
2. **Enhance approval dialog:**
   - Before showing confirmation, fetch duplicates via duplicate check endpoint
   - Display warning in approval dialog if conflicts exist
   - List conflicting request IDs and publisher names
3. **Handle approval response:**
   - Check for `conflicting_request_ids` in response
   - Show toast notification if conflicts exist after approval
4. **Test:** Verify warnings display correctly in admin approval flow

**Success Criteria:**
- Admin sees warning before approving
- Conflicting requests listed clearly
- Toast notification on conflicts
- Approval still proceeds (not blocked)

---

### Phase 4: History & Revert UI (Agent 6 - "history-ui-agent")

**DEPENDS ON:** Phase 2B completion (needs backend endpoints)

**Delegate to a specialized frontend agent:**

**Agent Task:**
1. **Create new component:** `web/components/admin/CorrectionRequestHistory.tsx`
   - Locality search input
   - History table with columns:
     - Request ID
     - Locality name
     - Publisher name
     - Before → After values
     - Approved At
     - Status (approved/reverted)
     - Actions (Revert button)
   - Revert dialog with reason input
2. **Revert dialog features:**
   - Show before/after values clearly
   - Require revert reason (min 20 chars)
   - Destructive button styling
   - Call `POST /api/v1/admin/correction-requests/{id}/revert`
3. **Add API client methods** in `web/lib/api-client.ts`:
   - `getCorrectionsHistory(localityId)`
   - `revertCorrection(requestId, revertReason)`
4. **Integrate into admin page:**
   - Add Tabs component with "Pending" and "History & Revert"
   - Import and render `CorrectionRequestHistory` in history tab
5. **Test:** Verify history displays and revert works end-to-end

**Success Criteria:**
- History table displays all approved/reverted corrections
- Revert dialog works correctly
- Admin can search by locality
- Revert updates the database and UI

---

### Phase 5: Zmanim Calculation Verification (Agent 7 - "zmanim-verification-agent")

**CRITICAL TASK - DEPENDS ON:** Phase 1 and 2A completion

**Delegate to a specialized verification agent:**

**Agent Task:**
1. **Read:** `api/internal/services/zmanim_service.go` - Understand how localities are resolved
2. **Read:** `api/internal/db/queries/location_overrides.sql` - Understand override hierarchy
3. **Verify locality resolution logic:**
   - Confirm priority: admin override > publisher override > default source
   - Ensure `approved_at` timestamp doesn't affect resolution (latest admin override wins via UPDATE)
   - Check that `GetEffectiveLocalityLocation` uses correct priority
4. **Create verification test:**
   - Submit correction request for test locality
   - Approve it (creates admin override)
   - Call zmanim calculation endpoint
   - Verify coordinates used match approved correction
5. **Document findings:**
   - Confirm current implementation already handles "latest approved wins"
   - Note any issues with resolution hierarchy
   - Verify cache invalidation if needed

**Success Criteria:**
- Zmanim calculations use latest approved corrections
- Resolution hierarchy documented and verified
- No cache invalidation issues
- Test passes for approved corrections

---

### Phase 6: Integration Testing (Agent 8 - "test-agent")

**DEPENDS ON:** ALL previous phases

**Delegate to a specialized testing agent:**

**Agent Task:**
1. **End-to-end test scenarios:**
   - Publisher submits correction → sees warning if duplicate exists
   - Admin approves correction → sees warning if conflicts exist
   - Approved correction appears in history tab
   - Admin reverts correction → locality data restored
   - Zmanim calculation uses corrected data
2. **Test multiple publishers:**
   - Two publishers submit corrections for same locality
   - Both see warnings about each other's requests
   - Admin sees both requests
   - Admin approves one → sees warning about the other
3. **Test revert flow:**
   - Approve correction
   - Verify zmanim uses new data
   - Revert correction
   - Verify zmanim uses original data
4. **Run CI checks:**
   ```bash
   ./scripts/validate-ci-checks.sh
   ```
5. **Document test results**

**Success Criteria:**
- All test scenarios pass
- No regressions in existing functionality
- CI checks pass
- Documentation updated

---

## Orchestrator Responsibilities

### 1. Delegation Strategy

**Launch agents in parallel groups:**

**Group 1 (Start immediately):**
- Agent 1 (db-agent) - Database migration

**Group 2 (After Group 1 completes):**
- Agent 2 (sql-agent) - SQL queries
- Agent 7 (zmanim-verification-agent) - Verify resolution hierarchy

**Group 3 (After Agent 2 completes):**
- Agent 3 (backend-agent) - Backend handlers

**Group 4 (After Agent 3 completes):**
- Agent 4 (publisher-ui-agent) - Publisher warnings
- Agent 5 (admin-ui-agent) - Admin warnings
- Agent 6 (history-ui-agent) - History & revert UI

**Group 5 (After all agents complete):**
- Agent 8 (test-agent) - Integration testing

### 2. Coordination Checkpoints

After each group completes:
1. **Verify artifacts created** (files, migrations, code)
2. **Check for conflicts** between agents
3. **Run build verification:** `cd api && go build ./cmd/api`
4. **Proceed to next group** only if all clear

### 3. Communication Protocol

For each agent delegation:
1. **Provide context:** Share relevant files and plan sections
2. **Define success criteria:** Clear acceptance criteria
3. **Specify dependencies:** What must complete first
4. **Request status updates:** Ask for completion confirmation
5. **Verify output:** Check files and run tests

### 4. Issue Resolution

If any agent reports issues:
1. **Pause dependent agents**
2. **Investigate root cause**
3. **Re-delegate with clarifications**
4. **Verify fix before proceeding**

---

## Success Criteria for Orchestrator

Your orchestration is complete when:

- [ ] All 8 agents have completed their tasks
- [ ] Database migration applied successfully
- [ ] All SQL queries generated
- [ ] All backend handlers implemented and tested
- [ ] All frontend components working
- [ ] Zmanim calculations verified to use corrected data
- [ ] Integration tests passing
- [ ] `go build ./cmd/api` succeeds
- [ ] `npm run type-check` succeeds in web/
- [ ] No TODO or FIXME comments in new code
- [ ] All files follow project coding standards

---

## Critical Reminders

1. **DO NOT WRITE CODE YOURSELF** - Only delegate to agents
2. **Enforce dependencies** - Don't start Phase 3 before Phase 2B completes
3. **Verify zmanim resolution** - Agent 7's task is critical for correctness
4. **Parallel when possible** - Maximize efficiency with parallel agents
5. **Read the plan first** - `/home/daniel/.claude/plans/reflective-noodling-duckling.md` is the source of truth

---

## Getting Started

```bash
# Step 1: Read the complete plan
cat /home/daniel/.claude/plans/reflective-noodling-duckling.md

# Step 2: Verify current state
cd /home/daniel/repos/zmanim
git status

# Step 3: Start orchestration
# Delegate to Agent 1 (db-agent) immediately

# Step 4: Monitor progress
# Track agent completions and proceed to next group

# Step 5: Final verification
cd api && go build ./cmd/api
cd ../web && npm run type-check
./scripts/validate-ci-checks.sh
```

Good luck orchestrating! Remember: your job is to coordinate, not code.
