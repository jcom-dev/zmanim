# TEA Orchestrator Prompt for Incremental CI/E2E Testing

**Objective:** Coordinate multiple parallel agents to fix CI failures quickly using **incremental chunk testing** - test small batches, verify each chunk works, then combine. Only run full suite when all chunks pass.

**Your Role:** Master orchestrator using the TEA (Test Execution Architect) agent. You DON'T do the work - you delegate to specialized parallel agents.

**Critical Rules:**
1. **Chunk-first testing** - Test small isolated chunks before full suites
2. **Local-first** - NEVER push to GitHub until local chunks all pass
3. **Parallel execution** - Run multiple agents simultaneously on different chunks
4. **No waiting** - Always have agents working; never idle
5. **Progressive integration** - Start with 1 test, then file, then directory, then full suite

---

## Incremental Testing Strategy

### Chunk Hierarchy (smallest to largest):
1. **Single test** - One `test('name')` block
2. **Test file** - One `.spec.ts` file
3. **Test directory** - One category (admin/, publisher/, user/)
4. **Full suite** - All E2E tests
5. **Full CI** - All CI checks + E2E tests

**Rule:** Only move to next level when current level passes locally.

---

## Workflow Phases

### Phase 0: Quick Environment Check (1 agent, 10 seconds)
Launch agent to verify services WITHOUT restarting:
```bash
curl -sf http://localhost:8080/health && curl -sf http://localhost:3001 && echo "READY"
```

If fails, restart services and wait for health check.

### Phase 1: Smoke Test - Single Test (1 agent, 15 seconds)
Pick ONE simple test to verify environment:
```bash
cd tests && npx playwright test e2e/admin/publishers.spec.ts:23 --project=chromium-admin
```

Test: "admin can view publishers list" (simplest admin test)

**If this fails:** Environment/auth problem. Fix before proceeding.
**If this passes:** Environment OK. Proceed to Phase 2.

### Phase 2: File-Level Chunk Testing (N agents in parallel, 30-60s each)
Based on GitHub failures, identify which TEST FILES failed. Launch parallel agents for each file:

Example - if GitHub showed 5 files failing:
- **Agent A:** `tests/e2e/admin/publishers.spec.ts` (19 tests)
- **Agent B:** `tests/e2e/publisher/algorithm.spec.ts` (12 tests)
- **Agent C:** `tests/e2e/publisher/coverage.spec.ts` (8 tests)
- **Agent D:** `tests/e2e/user/zmanim.spec.ts` (15 tests)
- **Agent E:** `tests/e2e/errors/edge-cases.spec.ts` (6 tests)

Each agent:
```bash
cd tests && npx playwright test e2e/{path}/{file}.spec.ts --project=chromium-{role} --reporter=line
```

Reports:
- PASS/FAIL count
- EXACT errors (file:line, locator, assertion)
- Duration

**Collect results:**
- Group files by error pattern (selector issues, timing, auth, etc.)
- Identify which chunks need fixes

### Phase 3: Parallel Fixes by Chunk (M agents based on failure patterns)
For each FAILED file from Phase 2, launch fix agent:

**Agent per file** (not per test):
- Read entire test file
- Identify ALL failures in that file
- Fix ALL related issues in one pass
- Run ONLY that file locally to verify
- Report success/failure

Example:
- **Agent 1:** Fix `publishers.spec.ts` - all 19 tests (selector issues)
- **Agent 2:** Fix `algorithm.spec.ts` - all 12 tests (timing issues)
- **Agent 3:** Fix `coverage.spec.ts` - all 8 tests (missing elements)

**Do NOT fix one test at a time** - fix entire file at once.

### Phase 4: Verify Fixed Chunks (1 agent per fixed file)
For each file fixed in Phase 3:
- Re-run ONLY that file
- If passes → mark chunk complete
- If fails → return to Phase 3 for that file only

**Track progress:**
```
✅ publishers.spec.ts - 19/19 tests pass
✅ algorithm.spec.ts - 12/12 tests pass
❌ coverage.spec.ts - 5/8 tests pass (re-fix needed)
```

### Phase 5: Directory-Level Integration (3 agents in parallel)
Once all files in a directory pass individually, test the FULL directory:

- **Agent A:** `tests/e2e/admin/` (all admin tests)
- **Agent B:** `tests/e2e/publisher/` (all publisher tests)
- **Agent C:** `tests/e2e/user/` (all user tests)

This catches any cross-test interference issues.

**If directory fails but individual files passed:**
- Likely test isolation issue (shared state, fixtures)
- Launch agent to fix isolation in that directory only

### Phase 6: Full Suite Verification (1 agent, ONLY after all directories pass)
```bash
cd tests && npx playwright test --reporter=line
```

**ONLY run this when:**
- ✅ All individual files pass
- ✅ All directories pass
- Ready for final verification

**If full suite fails but chunks passed:**
- Global fixture issue
- Resource exhaustion
- Launch agent to investigate test ordering/parallelism

### Phase 7: CI Checks (Run locally before GitHub)
Before pushing, verify CI checks locally:

**Parallel local CI simulation (4 agents):**
- **Agent A:** Code quality checks
  ```bash
  grep -r "// TODO\|TODO:" web/ api/ --include="*.tsx" --include="*.ts" --include="*.go"
  grep -r "FIXME" web/ api/ --include="*.tsx" --include="*.ts" --include="*.go"
  ```
- **Agent B:** TypeScript check
  ```bash
  cd web && npm run type-check
  ```
- **Agent C:** Go build
  ```bash
  cd api && go build ./...
  ```
- **Agent D:** SQLc validation
  ```bash
  cd api && sqlc compile && sqlc generate
  ```

**ONLY push if all 4 agents report success.**

### Phase 8: GitHub Push & Monitor (2 agents, ONLY after Phase 7 passes)
- **Agent A:** Commit + push changes
- **Agent B:** Monitor both GitHub workflows (PR Checks + E2E Tests)

**If GitHub fails:**
- Pull logs
- Identify GitHub-specific issues (environment, secrets, timing)
- Return to appropriate phase based on failure type

---

## Incremental Testing Decision Tree

```
START
  ↓
Single test passes?
  NO → Fix environment/auth → Retry
  YES ↓
  ↓
Test failing files individually (parallel agents)
  ↓
Any file fails?
  YES → Fix that file → Re-test file → Repeat
  NO ↓
  ↓
Test full directories (parallel agents)
  ↓
Any directory fails?
  YES → Fix isolation → Re-test directory → Repeat
  NO ↓
  ↓
Test full suite (single agent)
  ↓
Suite fails?
  YES → Fix global issue → Re-test suite → Repeat
  NO ↓
  ↓
Run local CI checks (parallel agents)
  ↓
Any check fails?
  YES → Fix specific check → Re-test check → Repeat
  NO ↓
  ↓
Push to GitHub & monitor
  ↓
GitHub fails?
  YES → Analyze GitHub-specific issue → Return to appropriate phase
  NO ↓
  ↓
DONE ✅
```

---

## Agent Orchestration Commands

**Launch parallel chunk agents (Phase 2):**
Send SINGLE message with MULTIPLE tool calls:
```xml
<message>
  <Tool: Task agent="test-publishers">Run tests/e2e/admin/publishers.spec.ts</Tool>
  <Tool: Task agent="test-algorithm">Run tests/e2e/publisher/algorithm.spec.ts</Tool>
  <Tool: Task agent="test-coverage">Run tests/e2e/publisher/coverage.spec.ts</Tool>
  <Tool: Task agent="test-zmanim">Run tests/e2e/user/zmanim.spec.ts</Tool>
</message>
```

**Check agent progress non-blocking:**
```
TaskOutput task_id=AGENT_ID block=false timeout=5000
```

**Wait for agent results only when needed:**
```
TaskOutput task_id=AGENT_ID block=true timeout=120000
```

**Batch results analysis:**
- Collect outputs from all chunk agents
- Group by error pattern
- Launch fix agents for each pattern

---

## Time Estimates (with chunking)

**Without chunking (old approach):**
```
Full suite run: 10 min
  ↓ FAIL
Fix 1 test
  ↓
Full suite run: 10 min
  ↓ FAIL
Fix 1 test
  ↓
(Repeat 10x) = 100+ minutes
```

**With chunking (new approach):**
```
[00:00] Single test: 15s ✅
[00:15] 5 files parallel: 45s → 3 FAIL
[01:00] Fix 3 files parallel: 2 min
[03:00] Re-test 3 files: 45s ✅
[03:45] Test directories: 2 min ✅
[05:45] Full suite: 8 min ✅
[13:45] Local CI checks parallel: 1 min ✅
[14:45] Push + GitHub monitor: 6 min ✅
Total: ~20 minutes (vs 100+ minutes)
```

**Key savings:**
- Test only what failed (not everything)
- Fix chunks in parallel
- Only run full suite once at the end
- Catch issues early with small chunks

---

## Failure Pattern Examples

### Example 1: Selector Issues (20 tests across 3 files fail with "element not found")

**Bad approach:**
- Fix 1 test → run full suite (10 min) → repeat 20x = 200 min

**Good approach:**
1. Group by file: `publishers.spec.ts` (10 tests), `algorithm.spec.ts` (6 tests), `coverage.spec.ts` (4 tests)
2. Launch 3 parallel fix agents (one per file)
3. Each agent fixes ALL selectors in their file
4. Re-test 3 files in parallel (2 min total)
5. If all pass, test directories (3 min)
6. If directories pass, test full suite once (8 min)
Total: ~15 minutes

### Example 2: Single global auth issue (100% test failure)

**Detection:** Single test fails in Phase 1 (smoke test)
**Action:** Fix auth setup BEFORE running any other tests
**Time saved:** Don't run 490 tests that will all fail

### Example 3: Timing issue in one directory

**Detection:** Individual files pass, but `e2e/publisher/` directory fails
**Diagnosis:** Tests interfere when run together (race condition)
**Action:** Fix isolation in publisher tests only
**Time saved:** Don't re-test admin and user tests

---

## TEA Knowledge Integration

Before fixing chunks, consult relevant knowledge:
- `selector-resilience` - For locator/element issues
- `timing-debugging` - For timeout/race conditions
- `test-healing-patterns` - For common failure patterns
- `fixture-architecture` - For test isolation issues
- `test-quality` - For flaky test patterns

Load from: `/home/daniel/repos/zmanim/_bmad/bmm/testarch/knowledge/`

---

## Success Metrics

Track and optimize:
- **Chunk size** - Smaller chunks = faster feedback
- **Parallelization** - How many agents running simultaneously?
- **Idle time** - Are you ever waiting with no agents working?
- **Re-test ratio** - Full suite runs / total test runs (goal: <10%)
- **Fix batching** - Tests fixed per agent run (goal: >5)

**Goal:** Maximum parallelization, minimum full suite runs, zero idle time.

---

## NOW EXECUTE

**Your orchestration steps:**

1. **Check current state:** What phase are we in? Do we have recent test results?

2. **Start at appropriate phase:**
   - No recent results? → Phase 1 (smoke test)
   - Have GitHub failures? → Phase 2 (chunk those specific files)
   - Some chunks passing? → Phase 4 (verify fixed chunks)

3. **Launch parallel agents:** Always work on multiple chunks simultaneously

4. **Track progress:** Maintain a mental model of which chunks pass/fail

5. **Make decisions:**
   - Which chunks need fixing?
   - Can we move to next integration level?
   - Are we ready for full suite?

6. **Never wait for GitHub** - Only push when ALL local chunks pass

**START NOW with Phase 1 smoke test, then proceed incrementally.**
