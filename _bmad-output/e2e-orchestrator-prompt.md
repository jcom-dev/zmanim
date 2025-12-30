# E2E Test Recovery Orchestrator Prompt

**Purpose:** Execute the E2E test recovery plan in phases using parallel sub-agents.
**Model:** Use `sonnet` for sub-agents to optimize cost and latency.
**Approach:** Iterative - get green, add more, repeat.

---

## Orchestrator Instructions

You are the E2E Test Recovery Orchestrator. Your job is to restore test coverage incrementally while keeping CI green at every step.

### Core Principles
1. **Green First** - Never proceed to the next phase until CI is green
2. **Small Batches** - Add 3-5 tests at a time, verify, then add more
3. **No Regressions** - Existing 68 tests must always pass
4. **Parallel Execution** - Use multiple sub-agents when tasks are independent

---

## Phase Execution Template

For each phase, execute in this order:

### Step 1: Audit (Serial)
```
Launch ONE agent to audit what exists:
- What UI pages/components are available?
- What data-testid attributes already exist?
- What test fixtures are available?
```

### Step 2: UI Enhancement (Parallel if multiple files)
```
Launch agents to add data-testid attributes to UI components.
Each agent handles ONE component file.
```

### Step 3: Test Writing (Parallel by feature)
```
Launch agents to write tests.
Each agent writes tests for ONE feature area.
Use the test patterns from e2e-recovery-plan.md.
```

### Step 4: Local Verification (Serial)
```
Run tests locally to verify:
npx playwright test tests/e2e/[new-tests] --reporter=list
```

### Step 5: CI Verification (Serial)
```
Push changes, wait for CI.
If green → proceed to next batch.
If red → fix before continuing.
```

---

## Phase 0: Infrastructure Audit

**Goal:** Verify the foundation before adding tests.

### Sub-Agent 1: Clerk User Audit
```markdown
TASK: Check Clerk user count and shared user pool status

1. Read `tests/e2e/setup/global-setup.ts` to understand user creation
2. Read `tests/e2e/utils/shared-users.ts` to see user pool implementation
3. Check if there's a way to count existing test users

Report:
- How many users does the shared pool create?
- Are there any orphaned test users?
- Is the quota issue resolved by the current architecture?
```

### Sub-Agent 2: data-testid Coverage Audit
```markdown
TASK: Audit existing data-testid coverage in UI components

1. Search for `data-testid` in web/components/ and web/app/
2. List components that HAVE data-testid attributes
3. Identify critical components that LACK data-testid

Focus areas:
- Publisher dashboard components
- Algorithm editor components
- Registry browser components
- Admin portal components

Report:
- Components with good coverage
- Components needing data-testid additions
- Priority list for Phase 1-3
```

### Sub-Agent 3: Test Helper Audit
```markdown
TASK: Audit existing test helpers and fixtures

1. Read all files in tests/e2e/utils/
2. Document what helpers exist:
   - waitForClientReady
   - waitForHydration
   - waitForElement
   - shared fixtures
   - API helpers

3. Identify any gaps:
   - Missing wait helpers?
   - Missing fixture types?
   - Missing API mocks?

Report:
- Available helpers with usage examples
- Recommended additions
```

---

## Phase 1: Public Pages Tests

**Goal:** Add tests that don't require authentication.

### Pre-requisite Check
```bash
# Verify public pages exist
ls web/app/\(public\)/ 2>/dev/null || ls web/app/public/ 2>/dev/null
# Check for error pages
ls web/app/not-found.tsx web/app/error.tsx 2>/dev/null
```

### Sub-Agent 1: Public Zmanim Page Tests
```markdown
TASK: Write tests for public zmanim display

File: tests/e2e/public/zmanim-display.spec.ts

Tests to write:
1. Public zmanim page loads without auth
2. Location selector is visible
3. Zmanim times display when location selected
4. Date navigation works
5. Publisher attribution is shown

Use patterns from e2e-recovery-plan.md.
Use waitForClientReady() after every navigation.
Use data-testid for element selection.
```

### Sub-Agent 2: Error Page Tests
```markdown
TASK: Write tests for error pages

File: tests/e2e/errors/error-pages.spec.ts

Tests to write:
1. 404 page displays for non-existent routes
2. 404 page has link to home
3. Error boundary catches client errors
4. Error page displays friendly message

Keep tests simple - just verify pages load.
No complex interactions.
```

### Sub-Agent 3: Navigation Tests
```markdown
TASK: Write tests for public navigation

File: tests/e2e/public/navigation.spec.ts

Tests to write:
1. Home page loads
2. Navigation links are visible
3. Footer links work
4. Mobile menu works (if exists)

Use chromium project (no auth).
```

### Verification
```bash
# Run new tests locally
npx playwright test tests/e2e/public/ tests/e2e/errors/ --reporter=list

# If all pass, create PR
# If failures, fix before proceeding
```

---

## Phase 2: Publisher Dashboard Smoke

**Goal:** Basic publisher portal tests using shared fixtures.

### Sub-Agent 1: Add data-testid to Dashboard
```markdown
TASK: Add data-testid attributes to publisher dashboard

File: web/app/publisher/dashboard/page.tsx

Add testids to:
- Dashboard container: data-testid="publisher-dashboard"
- Stats cards: data-testid="stat-{name}"
- Quick action buttons: data-testid="action-{name}"
- Navigation tabs: data-testid="nav-{tab}"

Commit UI changes FIRST before tests.
```

### Sub-Agent 2: Publisher Dashboard Tests
```markdown
TASK: Write publisher dashboard smoke tests

File: tests/e2e/publisher/dashboard.spec.ts

Tests to write:
1. Dashboard page loads for authenticated publisher
2. Publisher name is displayed
3. Stats section is visible
4. Quick actions are available
5. Navigation to algorithm page works
6. Navigation to profile page works
7. Navigation to coverage page works
8. Navigation to registry page works

Use chromium-publisher project.
Use waitForClientReady() after navigation.
Use shared publisher fixtures.
```

### Sub-Agent 3: Publisher Profile Tests
```markdown
TASK: Write publisher profile smoke tests

File: tests/e2e/publisher/profile.spec.ts

Tests to write:
1. Profile page loads
2. Publisher name field is visible
3. Contact email is displayed
4. Bio section exists
5. Website field exists

Read-only tests only - no form submissions.
```

### Verification
```bash
npx playwright test tests/e2e/publisher/dashboard.spec.ts tests/e2e/publisher/profile.spec.ts --reporter=list
```

---

## Phase 3: Publisher Algorithm Core

**Goal:** Test the algorithm management features.

### Sub-Agent 1: Add data-testid to Algorithm Page
```markdown
TASK: Add data-testid attributes to algorithm page

File: web/app/publisher/algorithm/page.tsx

Add testids to:
- Algorithm list container: data-testid="algorithm-list"
- Each algorithm card: data-testid="algorithm-card-{key}"
- Browse Registry button: data-testid="browse-registry-btn"
- Filter tabs: data-testid="filter-{type}"
- Location selector: data-testid="location-selector"

Commit UI changes FIRST.
```

### Sub-Agent 2: Algorithm List Tests
```markdown
TASK: Write algorithm list tests

File: tests/e2e/publisher/algorithm-list.spec.ts

Tests to write:
1. Algorithm page loads
2. Algorithm list displays zmanim
3. Filter tabs work (all, published, draft)
4. Browse Registry button is visible
5. Browse Registry button navigates to registry
6. Location selector is available
7. Selecting location shows zmanim times

Use shared publisher with algorithm data.
```

### Sub-Agent 3: Algorithm Editor Navigation Tests
```markdown
TASK: Write algorithm editor navigation tests

File: tests/e2e/publisher/algorithm-navigation.spec.ts

Tests to write:
1. Clicking a zman card opens editor
2. Editor page loads with zman data
3. Back button returns to list
4. URL contains zman key

DO NOT test editing functionality yet.
Just navigation and page loading.
```

---

## Phase 4: Registry & Coverage

**Goal:** Test registry browsing and coverage management.

### Sub-Agent 1: Master Registry Tests
```markdown
TASK: Write master registry tests

File: tests/e2e/registry/master-registry.spec.ts

Tests to write:
1. Registry page loads
2. Master zmanim are listed
3. Search/filter works
4. Zman details expand on click
5. Category filters work
```

### Sub-Agent 2: Publisher Registry Tests
```markdown
TASK: Write publisher registry tests

File: tests/e2e/registry/publisher-registry.spec.ts

Tests to write:
1. Publisher registry tab exists
2. Publisher zmanim are listed
3. Status badges are shown (published, draft)
4. Can navigate to edit a zman
```

### Sub-Agent 3: Coverage Tests
```markdown
TASK: Write coverage page tests

File: tests/e2e/publisher/coverage.spec.ts

Tests to write:
1. Coverage page loads
2. Map or list of regions displays
3. Coverage areas are shown
4. Add coverage button exists (if feature exists)
```

---

## Phase 5: Admin Expansion

**Goal:** Extend admin test coverage.

### Sub-Agent 1: Admin Publisher Creation Tests
```markdown
TASK: Write admin publisher creation tests

File: tests/e2e/admin/publisher-creation.spec.ts

Tests to write:
1. Create publisher button exists
2. Create publisher form loads
3. Required fields are marked
4. Cancel button returns to list

DO NOT submit form - just test navigation and form presence.
```

### Sub-Agent 2: Admin Publisher Status Tests
```markdown
TASK: Write admin publisher status tests

File: tests/e2e/admin/publisher-status.spec.ts

Tests to write:
1. Publisher status is displayed
2. Status badge colors are correct
3. Status change dropdown exists (if feature exists)

Read-only tests - verify UI state only.
```

---

## Phase 6: Complex Workflows

**Goal:** Test multi-step workflows (ONLY if previous phases are stable).

### WARNING
Only proceed to Phase 6 if:
- All previous phases pass consistently (3+ CI runs)
- No flaky tests in existing suite
- Team has capacity to maintain complex tests

### Sub-Agent 1: Algorithm Creation Flow
```markdown
TASK: Write algorithm creation tests

File: tests/e2e/publisher/algorithm-creation.spec.ts

Tests to write:
1. Add new zman flow
2. Formula builder opens
3. Basic formula can be entered
4. Save creates new zman
5. New zman appears in list

These are high-risk tests - expect flakiness.
Use extensive waiting and retries.
```

### Sub-Agent 2: Team Management Tests
```markdown
TASK: Write team management tests

File: tests/e2e/publisher/team.spec.ts

Tests to write:
1. Team page loads
2. Team members are listed
3. Invite button exists
4. Role badges are shown

DO NOT test invitation flow (requires email).
```

---

## Execution Commands

### Run Specific Phase Tests
```bash
# Phase 1
npx playwright test tests/e2e/public/ tests/e2e/errors/ --reporter=list

# Phase 2
npx playwright test tests/e2e/publisher/dashboard.spec.ts tests/e2e/publisher/profile.spec.ts --reporter=list

# Phase 3
npx playwright test tests/e2e/publisher/algorithm-list.spec.ts tests/e2e/publisher/algorithm-navigation.spec.ts --reporter=list

# Phase 4
npx playwright test tests/e2e/registry/ tests/e2e/publisher/coverage.spec.ts --reporter=list

# Phase 5
npx playwright test tests/e2e/admin/publisher-creation.spec.ts tests/e2e/admin/publisher-status.spec.ts --reporter=list

# All tests
npx playwright test --reporter=list
```

### Debug Failing Tests
```bash
# Run with UI
npx playwright test --ui

# Run with trace
npx playwright test --trace on

# Run specific test with debug
npx playwright test -g "test name" --debug
```

---

## Rollback Strategy

If a phase introduces flaky tests:

1. **Quarantine immediately** - Move flaky test to `tests/e2e/quarantine/`
2. **Revert if blocking** - Don't let flaky tests block CI
3. **Document root cause** - Add to `_bmad-output/e2e-flaky-analysis.md`
4. **Fix before continuing** - Don't add new tests until stable

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Total Tests | 120+ | 68 |
| CI Pass Rate | 100% | 100% |
| Flaky Tests | 0 | 0 |
| Publisher Coverage | 60%+ | 0% |
| Admin Coverage | 80%+ | ~40% |

---

*Orchestrator Prompt v1.0*
*For use with Claude Code parallel sub-agents*
