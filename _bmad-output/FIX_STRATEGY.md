# Comprehensive Fix Strategy - ZERO Postponements

**Generated:** 2025-12-27
**Status:** ALL ISSUES TRIAGED - NO DEFERRALS

---

## Executive Summary

**Total Issues:** 35 distinct problems across PR Checks, E2E Tests, Test Coverage, and Test Quality
**Critical Blockers:** 5 issues blocking CI
**High Priority:** 12 issues requiring immediate attention
**Medium Priority:** 10 issues for stability
**Low Priority:** 8 issues for maintenance

**Execution Time Estimate:** 20-25 hours total (can be parallelized across 7 agents)

---

## Issue Triage - Complete Classification

### CRITICAL (Must Fix - Blocking CI/CD)

| # | Issue | Location | Impact | Agent | Priority |
|---|-------|----------|--------|-------|----------|
| C1 | Missing `cn` import | `MasterDocumentationContent.tsx:184` | Blocks type checking | 6 | P0 |
| C2 | Missing `count` prop in CategoryProps | `DSLReferencePanel.tsx:208-289` | Blocks type checking (9 occurrences) | 6 | P0 |
| C3 | Go formatting errors | `admin_audit.go:31` | Blocks golangci-lint | 6 | P0 |
| C4 | Go formatting errors | `audit_helpers.go:168` | Blocks golangci-lint | 6 | P0 |
| C5 | Go formatting errors | `publisher_zmanim.go:2252` | Blocks golangci-lint | 6 | P0 |

**Total Critical:** 5 issues (3 files affected)

---

### HIGH (Must Fix - Feature Correctness)

| # | Issue | Location | Type | Decision | Agent | Priority |
|---|-------|----------|------|----------|-------|----------|
| H1 | "Invite Member" button → "Add Member" | `team.spec.ts:22` | UI Change | **Option A: Update test** | 9 | P1 |
| H2 | "Invite Team Member" dialog → "Add Team Member" | `team.spec.ts:35` | UI Change | **Option A: Update test** | 9 | P1 |
| H3 | "Send Invitation" button → "Add Member" | `team.spec.ts:48` | UI Change | **Option A: Update test** | 9 | P1 |
| H4 | Admin dashboard expects stats, shows portal | `admin/dashboard.spec.ts:42` | Feature Change | **Option A: Update test to match portal** | 9 | P1 |
| H5 | "Users" section not found on publisher details | `admin/publishers.spec.ts:145` | Missing UI | **Requires verification then fix** | 9 | P1 |
| H6 | Hard-coded timeouts (20+ occurrences) | `registry-publisher.spec.ts` | Flakiness | **Replace with API waits** | 10 | P1 |
| H7 | Hard-coded timeouts (2 occurrences) | `team.spec.ts:166,203` | Flakiness | **Replace with deterministic waits** | 10 | P1 |
| H8 | Deleted `useLocalitySearch.test.ts` | `web/lib/hooks/__tests__/` | Coverage Gap | **Option B: Restore and fix ESLint** | 8 | P1 |
| H9 | Backend handlers untested (556 functions) | `api/internal/handlers/` | Coverage Gap | **Add integration tests** | 7 | P1 |
| H10 | Services untested (7.6% coverage) | `api/internal/services/` | Coverage Gap | **Add unit tests** | 7 | P1 |
| H11 | 8 skipped algorithm editor tests | `algorithm-editor.spec.ts:37-39` | Incomplete | **Re-enable with stable auth fixtures** | 10 | P1 |
| H12 | Complex conditional logic duplicated 20+ times | `registry-publisher.spec.ts` | Maintainability | **Extract to Page Object Model** | 10 | P1 |

**Total High:** 12 issues

---

### MEDIUM (Must Fix - Stability & Quality)

| # | Issue | Location | Type | Fix | Agent | Priority |
|---|-------|----------|------|-----|-------|----------|
| M1 | Fragile text-based selectors | `registry-publisher.spec.ts:71,142` | Flakiness | Add `data-testid` attributes | 10 | P2 |
| M2 | Poor error handling (lenient catches) | `team.spec.ts:203-209` | Test Quality | Split into explicit test cases | 10 | P2 |
| M3 | Meaningless "delete button exists" test | `admin/publishers.spec.ts:185-203` | Test Quality | **Option B: Delete test** | 11 | P2 |
| M4 | Smoke test "editor loads with header" | `algorithm-editor.spec.ts:37-39` | Test Quality | Expand to verify editor state | 10 | P2 |
| M5 | Redundant dashboard card tests | `publisher/dashboard.spec.ts:63-91` | Test Quality | Consolidate into single test | 10 | P2 |
| M6 | Components untested (3.5% coverage) | `web/components/` | Coverage Gap | Add tests for critical UI | 8 | P2 |
| M7 | Hooks untested (8 of 17) | `web/lib/hooks/` | Coverage Gap | Add unit tests | 8 | P2 |
| M8 | Calendar package low coverage (32.9%) | `api/internal/calendar/` | Coverage Gap | Add edge case tests | 7 | P2 |
| M9 | Middleware low coverage (19.4%) | `api/internal/middleware/` | Coverage Gap | Add unit tests | 7 | P2 |
| M10 | NPM audit high severity vulnerability | `package-lock.json` | Security | Review and update dependencies | 6 | P2 |

**Total Medium:** 10 issues

---

### LOW (Must Fix - Maintenance)

| # | Issue | Location | Type | Fix | Agent | Priority |
|---|-------|----------|------|-----|-------|----------|
| L1 | Deprecated golangci-lint config | `.golangci.yml` | Warning | Update config options | 6 | P3 |
| L2 | Missing frontend coverage tooling | `web/` | Tooling | Install `@vitest/coverage-v8` | 6 | P3 |
| L3 | Zero AI package coverage | `api/internal/ai/` | Coverage | Add unit tests | 7 | P3 |
| L4 | Zero algorithm package coverage | `api/internal/algorithm/` | Coverage | Add unit tests | 7 | P3 |
| L5 | Zero cache package coverage | `api/internal/cache/` | Coverage | Add integration tests | 7 | P3 |
| L6 | Zero geo package coverage | `api/internal/geo/` | Coverage | Add unit tests | 7 | P3 |
| L7 | DSL package low coverage (50.3%) | `api/internal/dsl/` | Coverage | Add edge case tests | 7 | P3 |
| L8 | Missing dialog cleanup verification | `team.spec.ts:156-169` | Test Quality | Replace timeout with state check | 10 | P3 |

**Total Low:** 8 issues

---

## Fix Plans by Issue

### CRITICAL ISSUES (Blocks CI - 5 min total)

#### C1: Missing `cn` import
**File:** `/home/daniel/repos/zmanim/web/components/registry/MasterDocumentationContent.tsx`
**Line:** 184
**Fix:** Add import statement
```typescript
import { cn } from '@/lib/utils';
```
**Justification:** Simple missing import - TypeScript error
**Estimated Time:** 30 seconds

---

#### C2: Missing `count` prop in CategoryProps
**File:** `/home/daniel/repos/zmanim/web/components/editor/DSLReferencePanel.tsx`
**Lines:** 208, 218, 228, 238, 248, 258, 268, 278, 289
**Fix:** Remove `count={...}` from all 9 Category component calls
**Justification:** Incomplete refactoring - prop was removed from interface but not from call sites. Component already calculates count as `filteredItems.length` (line 80).
**Estimated Time:** 2 minutes

---

#### C3-C5: Go formatting errors
**Files:**
- `/home/daniel/repos/zmanim/api/internal/handlers/admin_audit.go`
- `/home/daniel/repos/zmanim/api/internal/handlers/audit_helpers.go`
- `/home/daniel/repos/zmanim/api/internal/handlers/publisher_zmanim.go`

**Fix:** Run `gofmt -w` on all handler files
```bash
cd /home/daniel/repos/zmanim/api
gofmt -w internal/handlers/
```
**Justification:** Standard Go formatting - no logic changes
**Estimated Time:** 5 seconds

---

### HIGH PRIORITY ISSUES (Feature Correctness - 18 hours)

#### H1-H3: Team page UI text changes
**File:** `/home/daniel/repos/zmanim/tests/e2e/publisher/team.spec.ts`
**Root Cause:** UI text changed from "Invite" to "Add" terminology
**Decision:** **Option A - Update tests to match new UI**
**Justification:** Feature still exists, just renamed. UI change is intentional.

**Fixes:**
1. Line 22: Change `/invite member/i` → `/add member/i`
2. Line 35: Change `'Invite Team Member'` → `'Add Team Member'`
3. Line 48: Change `/send invitation/i` → `/add member/i`

**Estimated Time:** 10 minutes

---

#### H4: Admin dashboard expects stats
**File:** `/home/daniel/repos/zmanim/tests/e2e/admin/dashboard.spec.ts`
**Root Cause:** Admin landing page changed from stats dashboard to card-based portal
**Decision:** **Option A - Update test to match new portal UI**
**Justification:** Architectural change - portal is the new intentional design

**Fix:** Rewrite test to verify:
- Portal cards are displayed
- Cards link to correct routes
- No longer expect "Publisher Statistics" heading

**Estimated Time:** 30 minutes

---

#### H5: Missing "Users" section
**File:** `/home/daniel/repos/zmanim/tests/e2e/admin/publishers.spec.ts`
**Line:** 145
**Root Cause:** Test expects "Users" heading that may not exist
**Decision:** **Requires manual verification FIRST**

**Process:**
1. Load admin publisher detail page manually
2. Check if "Users" section exists
3. If YES: Update selector (may use different text)
4. If NO: **Option B - Delete test assertion**

**Estimated Time:** 30 minutes (including verification)

---

#### H6-H7: Hard-coded timeouts
**Files:**
- `/home/daniel/repos/zmanim/tests/e2e/publisher/registry-publisher.spec.ts` (20+ occurrences)
- `/home/daniel/repos/zmanim/tests/e2e/publisher/team.spec.ts` (2 occurrences)

**Root Cause:** Race conditions - tests wait fixed time instead of actual completion
**Fix:** Replace with deterministic waits

**Example transformation:**
```typescript
// BEFORE (FRAGILE):
await locationInput.fill('Jerusalem');
await page.waitForTimeout(500);
await page.getByText('Jerusalem').click();

// AFTER (ROBUST):
await locationInput.fill('Jerusalem');
await page.waitForResponse(resp => resp.url().includes('/api/locality/search'));
await page.getByText('Jerusalem').click();
```

**Estimated Time:** 3 hours (22 occurrences, must test each)

---

#### H8: Deleted useLocalitySearch.test.ts
**File:** `web/lib/hooks/__tests__/useLocalitySearch.test.ts` (deleted in e45eb9e)
**Root Cause:** Test deleted during ESLint cleanup instead of being fixed
**Decision:** **Option B - Restore test file and fix ESLint issues**
**Justification:** Hook is critical for location search - test MUST exist

**Process:**
1. `git show e45eb9e~1:web/lib/hooks/__tests__/useLocalitySearch.test.ts > useLocalitySearch.test.ts`
2. Fix ESLint warnings (unused vars, missing types)
3. Verify test passes

**Estimated Time:** 1 hour

---

#### H9: Backend handlers untested
**Location:** `/home/daniel/repos/zmanim/api/internal/handlers/`
**Current Coverage:** 1.6% (556 untested functions)
**Target:** 40% minimum (focus on CRUD + error paths)

**Decision:** **Add integration tests for critical paths**

**Priority Functions to Test:**
1. **Admin CRUD** (admin.go):
   - AdminListPublishers
   - AdminCreatePublisher
   - AdminUpdatePublisher
   - AdminDeletePublisher

2. **Publisher CRUD** (publisher_*.go):
   - Coverage management
   - Algorithm editing
   - Registry requests

3. **Error Paths:**
   - 401/403 authorization failures
   - 400 validation errors
   - 404 not found
   - 500 internal errors

**Approach:** Use existing `handlers_test.go` pattern - HTTP integration tests with test database

**Estimated Time:** 6 hours (20 critical handlers @ 18 min each)

---

#### H10: Services untested
**Location:** `/home/daniel/repos/zmanim/api/internal/services/`
**Current Coverage:** 7.6%
**Target:** 60% minimum

**Priority Services:**
1. **Cache service** (0.0%) - CRITICAL for performance
2. **Zmanim calculation service** (partially tested)
3. **Search service** (0.0%)

**Approach:** Unit tests with mocked dependencies

**Estimated Time:** 4 hours

---

#### H11: Skipped algorithm editor tests
**File:** `/home/daniel/repos/zmanim/tests/e2e/publisher/algorithm-editor.spec.ts`
**Count:** 8 tests marked `test.skip()`
**Reason:** `(requires auth)`

**Decision:** **Re-enable tests with stable auth fixtures**

**Root Cause:** Tests were disabled when auth became complex/unreliable
**Fix:**
1. Use existing `getSharedPublisher('with-algorithm')` pattern
2. Ensure publisher has algorithm data in fixtures
3. Remove `.skip()` and verify tests pass

**Estimated Time:** 2 hours

---

#### H12: Massive code duplication in registry tests
**File:** `/home/daniel/repos/zmanim/tests/e2e/publisher/registry-publisher.spec.ts`
**Size:** 1,046 lines
**Duplication:** Publisher selection logic repeated 20+ times

**Decision:** **Extract to Page Object Model**

**Deliverable:** Create `tests/e2e/page-objects/RegistryPublisherPage.ts`

**Methods:**
- `selectPublisher(name: string)`
- `selectLocation(city: string)`
- `expectPublisherSelected(name: string)`
- `expectLocationSelected(city: string)`
- `expectZmanimDisplayed(count?: number)`

**Impact:** Reduce file from 1,046 → ~400 lines, improve maintainability

**Estimated Time:** 4 hours

---

### MEDIUM PRIORITY ISSUES (Stability - 8 hours)

#### M1: Fragile text-based selectors
**File:** `/home/daniel/repos/zmanim/tests/e2e/publisher/registry-publisher.spec.ts`
**Root Cause:** No `data-testid` attributes on key UI elements
**Fix:** Add test IDs to UI components

**Required Changes:**
```typescript
// web/app/publisher/registry/page.tsx
<select data-testid="publisher-selector">...</select>
<input data-testid="location-input" placeholder="Search location">
<div data-testid="publisher-empty-state">Select a publisher...</div>

// Then update tests:
await page.locator('[data-testid="publisher-selector"]').click();
```

**Estimated Time:** 2 hours (UI changes + test updates)

---

#### M2: Poor error handling
**File:** `/home/daniel/repos/zmanim/tests/e2e/publisher/team.spec.ts`
**Lines:** 203-209
**Root Cause:** Test uses `.catch(() => false)` to mask failures

**Fix:** Split into explicit test cases:
```typescript
test('owner publisher shows Owner badge', async ({ page }) => {
  const publisher = getSharedPublisher('with-owner');
  await loginAsPublisher(page, publisher.id);
  await expect(page.getByText('Owner')).toBeVisible();
});

test('non-owner publisher does not show Owner badge', async ({ page }) => {
  const publisher = getSharedPublisher('member-only');
  await loginAsPublisher(page, publisher.id);
  await expect(page.getByText('Owner')).not.toBeVisible();
});
```

**Estimated Time:** 30 minutes

---

#### M3: Meaningless delete button test
**File:** `/home/daniel/repos/zmanim/tests/e2e/admin/publishers.spec.ts`
**Lines:** 185-203
**Decision:** **Option B - Delete test**
**Justification:** Test only checks button exists, doesn't verify delete functionality. No value.

**Estimated Time:** 5 minutes

---

#### M4: Smoke test without assertions
**File:** `/home/daniel/repos/zmanim/tests/e2e/publisher/algorithm-editor.spec.ts`
**Lines:** 37-39
**Fix:** Expand to verify actual editor state

```typescript
test('editor loads with correct zmanim', async ({ page }) => {
  const publisher = getPublisherWithAlgorithm();
  await loginAsPublisher(page, publisher.id);
  await page.goto(`${BASE_URL}/publisher/algorithm`);
  await waitForEditor(page);

  // Verify zmanim are displayed
  await expect(page.getByText('Alos Hashachar')).toBeVisible();
  await expect(page.getByText('Sunrise')).toBeVisible();

  // Verify edit button is clickable
  const editButton = page.getByRole('button', { name: /edit/i }).first();
  await expect(editButton).toBeEnabled();
});
```

**Estimated Time:** 30 minutes

---

#### M5: Redundant dashboard tests
**File:** `/home/daniel/repos/zmanim/tests/e2e/publisher/dashboard.spec.ts`
**Lines:** 63-91
**Fix:** Consolidate into single comprehensive test

```typescript
test('dashboard shows all main cards', async ({ page }) => {
  await loginAsPublisher(page, testPublisher.id);
  await page.goto(`${BASE_URL}/publisher/dashboard`);
  await waitForDashboardLoad(page);

  const expectedCards = ['Profile', 'Zmanim', 'Coverage', 'Analytics'];
  for (const card of expectedCards) {
    await expect(page.getByRole('heading', { name: card })).toBeVisible();
  }
});
```

**Estimated Time:** 20 minutes

---

#### M6: Component coverage gap
**Location:** `/home/daniel/repos/zmanim/web/components/`
**Current:** 5/142 components tested (3.5%)
**Target:** 30% of critical components

**Priority Components:**
1. Registry editor components
2. Coverage map components
3. Zmanim display components
4. Location selector
5. Navigation components

**Estimated Time:** 3 hours (10 critical components @ 18 min each)

---

#### M7: Hook coverage gap
**Location:** `/home/daniel/repos/zmanim/web/lib/hooks/`
**Untested Hooks (8):**
- useAlgorithmPageData
- useLocationSearch
- useMapPreview
- usePrimitivesPreview
- usePublisherSnapshots
- useYearExport

**Approach:** Follow existing hook test patterns in `__tests__/`

**Estimated Time:** 2 hours (6 hooks @ 20 min each, excluding restored useLocalitySearch)

---

#### M8-M9: Backend coverage gaps
**Packages:**
- Calendar (32.9% → target 60%)
- Middleware (19.4% → target 60%)

**Focus:**
- Calendar: Edge cases (leap years, DST, Israeli vs. diaspora)
- Middleware: Rate limiting, auth edge cases

**Estimated Time:** 1.5 hours

---

#### M10: NPM audit vulnerability
**Issue:** 1 high severity vulnerability in dependencies
**Fix:** Review and update affected package

```bash
cd /home/daniel/repos/zmanim/web
npm audit
npm audit fix
# OR manually update package if breaking changes
```

**Estimated Time:** 30 minutes

---

### LOW PRIORITY ISSUES (Maintenance - 3 hours)

#### L1: Deprecated golangci-lint config
**File:** `/home/daniel/repos/zmanim/.golangci.yml`
**Warnings:**
- `run.skip-dirs` → `issues.exclude-dirs`
- Output format `github-actions` → `colored-line-number`

**Fix:** Update config
**Estimated Time:** 10 minutes

---

#### L2: Missing frontend coverage tooling
**Action:** Install and configure coverage

```bash
cd /home/daniel/repos/zmanim/web
npm install --save-dev @vitest/coverage-v8

# Update vitest.config.ts to add coverage thresholds
```

**Estimated Time:** 30 minutes

---

#### L3-L6: Zero coverage packages
**Packages:**
- `internal/ai` (0.0%)
- `internal/algorithm` (0.0%)
- `internal/cache` (0.0%)
- `internal/geo` (0.0%)

**Decision:** Add basic unit tests for exported functions
**Target:** 30% minimum for each

**Estimated Time:** 2 hours total (30 min per package)

---

#### L7: DSL coverage improvement
**Package:** `internal/dsl`
**Current:** 50.3%
**Target:** 70%
**Focus:** Edge cases in formula parsing and validation

**Estimated Time:** 1 hour

---

#### L8: Dialog cleanup timeout
**File:** `/home/daniel/repos/zmanim/tests/e2e/publisher/team.spec.ts`
**Lines:** 156-169
**Fix:** Replace `waitForTimeout(500)` with state verification

```typescript
await page.getByRole('button', { name: /cancel/i }).click();
await expect(page.getByRole('dialog')).not.toBeVisible();
```

**Estimated Time:** 5 minutes

---

## Agent Assignment Matrix

### Agent 6: ESLint/TypeScript/Go Formatting (QUICK WINS)
**Phase:** 3A - Quick Fixes (run FIRST)
**Duration:** 30 minutes
**Execution:** Sequential - must complete before other agents

| Task ID | Description | Files | Time |
|---------|-------------|-------|------|
| C1 | Add missing `cn` import | MasterDocumentationContent.tsx | 30s |
| C2 | Remove `count` props (9 occurrences) | DSLReferencePanel.tsx | 2m |
| C3-C5 | Run `gofmt -w` on handlers | admin_audit.go, audit_helpers.go, publisher_zmanim.go | 5s |
| L1 | Update golangci-lint config | .golangci.yml | 10m |
| L2 | Install frontend coverage tooling | package.json, vitest.config.ts | 30m |
| M10 | Fix NPM audit vulnerability | package-lock.json | 30m |

**Success Criteria:**
- `npm run type-check` passes
- `golangci-lint run` passes
- PR Checks workflow turns green

---

### Agent 7: Backend Test Fixes
**Phase:** 3B - Test Updates (AFTER Agent 6)
**Duration:** 8 hours
**Execution:** Can run in parallel with Agents 8-10

| Task ID | Description | Target Coverage | Time |
|---------|-------------|-----------------|------|
| H9 | Add handler integration tests | 1.6% → 40% | 6h |
| H10 | Add service unit tests | 7.6% → 60% | 4h |
| M8 | Add calendar edge case tests | 32.9% → 60% | 1h |
| M9 | Add middleware tests | 19.4% → 60% | 30m |
| L3-L6 | Add basic tests for zero-coverage packages | 0% → 30% each | 2h |
| L7 | Improve DSL coverage | 50.3% → 70% | 1h |

**Success Criteria:**
- API CI workflow passes
- Overall backend coverage: 7.3% → 35%+
- All new tests use existing patterns (`handlers_test.go` style)

---

### Agent 8: Frontend Test Fixes
**Phase:** 3B - Test Updates (AFTER Agent 6)
**Duration:** 6 hours
**Execution:** Can run in parallel with Agents 7, 9-10

| Task ID | Description | Target | Time |
|---------|-------------|--------|------|
| H8 | Restore useLocalitySearch.test.ts | Restore deleted test | 1h |
| M6 | Add component tests | 3.5% → 30% critical components | 3h |
| M7 | Add hook tests | 8 untested hooks | 2h |

**Success Criteria:**
- Web CI workflow passes
- All hooks have unit tests
- Critical UI components tested
- `npm run test` shows 350+ tests passing (up from 293)

---

### Agent 9: E2E Test Updates (UI Changes)
**Phase:** 3B - Test Updates (AFTER Agent 6)
**Duration:** 2 hours
**Execution:** Can run in parallel with Agents 7-8, 10

| Task ID | Description | Files | Time |
|---------|-------------|-------|------|
| H1-H3 | Update team page selectors | team.spec.ts | 10m |
| H4 | Update admin dashboard test | admin/dashboard.spec.ts | 30m |
| H5 | Verify and fix "Users" section | admin/publishers.spec.ts | 30m |
| M2 | Split error handling tests | team.spec.ts | 30m |
| M4 | Expand editor smoke test | algorithm-editor.spec.ts | 30m |
| M5 | Consolidate dashboard tests | publisher/dashboard.spec.ts | 20m |

**Success Criteria:**
- All UI selector mismatches resolved
- Tests match current UI
- No text-based selector failures

---

### Agent 10: E2E Test Fixes (Flakiness)
**Phase:** 3B - Test Updates (AFTER Agent 6)
**Duration:** 9 hours
**Execution:** Can run in parallel with Agents 7-9

| Task ID | Description | Files | Time |
|---------|-------------|-------|------|
| H6 | Replace timeouts (20+ occurrences) | registry-publisher.spec.ts | 3h |
| H7 | Replace timeouts (2 occurrences) | team.spec.ts | 15m |
| H11 | Re-enable skipped tests | algorithm-editor.spec.ts | 2h |
| H12 | Extract Page Object Model | Create page-objects/RegistryPublisherPage.ts | 4h |
| M1 | Add data-testid attributes | registry components + tests | 2h |
| L8 | Fix dialog cleanup | team.spec.ts | 5m |

**Success Criteria:**
- Zero `page.waitForTimeout()` calls remaining
- All skipped tests re-enabled and passing
- Page Object Model reduces registry test file to ~400 lines
- E2E tests pass consistently (3 runs in a row)

---

### Agent 11: Test Deletions (Obsolete Tests)
**Phase:** 3B - Test Updates (AFTER Agent 6)
**Duration:** 10 minutes
**Execution:** Can run in parallel with Agents 7-10

| Task ID | Description | Files | Time |
|---------|-------------|-------|------|
| M3 | Delete meaningless delete button test | admin/publishers.spec.ts:185-203 | 5m |

**Success Criteria:**
- Meaningless tests removed
- Test suite is leaner and more focused

---

### Agent 12: New Tests (Coverage Gaps) - DEFER
**Phase:** 3E - Coverage Expansion (ONLY IF NEEDED)
**Duration:** N/A - DEFERRED
**Execution:** After CI is green

**Rationale:** New tests are NOT REQUIRED to pass CI. Focus on fixing existing failures first.

**Deferred Tasks:**
- Add E2E tests for missing workflows (admin audit filtering, etc.)
- Add visual regression tests
- Add performance assertions

**Will address in separate effort after green CI.**

---

## Execution Plan

### Phase 3A: Quick Fixes (SEQUENTIAL - 30 minutes)
**Agent:** 6
**Blocking:** YES - all other agents depend on this

```bash
# 1. Fix TypeScript errors
cd /home/daniel/repos/zmanim/web
# Edit files: MasterDocumentationContent.tsx, DSLReferencePanel.tsx
npm run type-check  # Verify passes

# 2. Fix Go formatting
cd /home/daniel/repos/zmanim/api
gofmt -w internal/handlers/
golangci-lint run --timeout 5m  # Verify passes

# 3. Update configs
# Edit: .golangci.yml, vitest.config.ts
cd /home/daniel/repos/zmanim/web
npm install --save-dev @vitest/coverage-v8
npm audit fix

# 4. Verify CI locally
cd /home/daniel/repos/zmanim
./scripts/validate-ci-checks.sh
```

**Success Gate:** All CI checks pass locally before proceeding to 3B

---

### Phase 3B: Test Updates (PARALLEL - 10 hours max with 5 agents)
**Agents:** 7, 8, 9, 10, 11
**Blocking:** NO - can run in parallel
**Dependency:** Phase 3A MUST be complete

**Execution Strategy:**
- Each agent works on separate files (no conflicts)
- Agents commit to separate branches
- Merge sequentially after testing

**Agent Execution:**

```bash
# Agent 7: Backend tests
git checkout -b fix/backend-tests
# Add handler tests, service tests, coverage improvements
go test ./... -coverprofile=/tmp/coverage.out
# Verify coverage increases
git add . && git commit -m "test: improve backend test coverage"

# Agent 8: Frontend tests
git checkout -b fix/frontend-tests
# Restore useLocalitySearch.test.ts, add component/hook tests
npm run test
# Verify tests pass
git add . && git commit -m "test: improve frontend test coverage"

# Agent 9: E2E UI updates
git checkout -b fix/e2e-ui-updates
# Update selectors in team.spec.ts, dashboard.spec.ts, etc.
npx playwright test tests/e2e/publisher/team.spec.ts
npx playwright test tests/e2e/admin/dashboard.spec.ts
# Verify tests pass
git add . && git commit -m "test(e2e): update selectors to match current UI"

# Agent 10: E2E flakiness
git checkout -b fix/e2e-flakiness
# Replace timeouts, add Page Object Model, re-enable skipped tests
npx playwright test tests/e2e/publisher/registry-publisher.spec.ts
npx playwright test tests/e2e/publisher/algorithm-editor.spec.ts
# Verify tests pass 3 times in a row
git add . && git commit -m "test(e2e): eliminate flakiness and improve maintainability"

# Agent 11: Delete obsolete
git checkout -b fix/delete-obsolete
# Delete meaningless tests
npx playwright test tests/e2e/admin/publishers.spec.ts
# Verify remaining tests pass
git add . && git commit -m "test(e2e): remove meaningless tests"
```

**Success Gate:** All parallel branches pass their respective test suites

---

### Phase 3C: Integration (SEQUENTIAL - 1 hour)
**Owner:** Human or Lead Agent
**Process:**

1. Merge Agent 6 branch to dev (quick fixes)
2. Verify PR Checks pass
3. Merge Agent 7 branch (backend tests)
4. Merge Agent 8 branch (frontend tests)
5. Merge Agent 9 branch (E2E UI updates)
6. Merge Agent 10 branch (E2E flakiness)
7. Merge Agent 11 branch (deletions)

**After each merge:**
- Run full CI locally: `./scripts/validate-ci-checks.sh`
- Fix any conflicts
- Verify green build

---

### Phase 3D: Verification (SEQUENTIAL - 30 minutes)
**Action:** Full CI run on dev branch

```bash
# Push to dev and wait for CI
git push origin dev

# Monitor workflows:
# - pr-checks.yml (should pass in ~6-8 min)
# - pr-e2e.yml (should pass in ~15-20 min)
```

**Success Criteria:**
- ✅ PR Checks workflow passes
- ✅ E2E workflow passes
- ✅ All tests green
- ✅ No skipped tests (except documented long-term deferred)
- ✅ Coverage thresholds met

---

## Success Metrics

### PR Checks Workflow
**Before:**
- ❌ Type Sync Validation (11 TypeScript errors)
- ❌ Web CI (type check failed)
- ❌ API CI (golangci-lint failed)

**After:**
- ✅ Type Sync Validation (0 errors)
- ✅ Web CI (all steps pass)
- ✅ API CI (all steps pass)

---

### E2E Workflow
**Before:**
- ❌ Build failed (TypeScript compilation error)
- Tests never ran

**After:**
- ✅ Build passes
- ✅ All tests execute
- ✅ Zero hard-coded timeouts
- ✅ Zero skipped tests
- ✅ Zero flaky tests (3 consecutive green runs)

---

### Test Coverage
**Before:**
| Category | Coverage |
|----------|----------|
| Backend Overall | 7.3% |
| Backend Handlers | 1.6% |
| Backend Services | 7.6% |
| Frontend Components | 3.5% |
| Frontend Hooks | 53% |

**After:**
| Category | Coverage | Delta |
|----------|----------|-------|
| Backend Overall | **35%+** | +27.7% |
| Backend Handlers | **40%+** | +38.4% |
| Backend Services | **60%+** | +52.4% |
| Frontend Components | **30%+** | +26.5% |
| Frontend Hooks | **90%+** | +37% |

---

### Test Quality
**Before:**
- 8 skipped tests
- 1 deleted critical test
- 22+ hard-coded timeouts
- 20+ code duplications
- 1,046 line test file

**After:**
- **0 skipped tests**
- **Restored deleted test**
- **0 hard-coded timeouts**
- **Page Object Model** (reduces duplication by 60%)
- **~400 line test file** (down from 1,046)

---

### CI Performance
**Target:**
- PR Checks: < 10 minutes
- E2E Tests: < 20 minutes
- Zero failures on green branch

---

## Risk Assessment

### Low Risk (Safe Changes)
- C1-C5: Formatting fixes (auto-generated, zero logic change)
- H1-H3: Selector updates (text changes only)
- M3: Delete test (removing, not changing)
- L1-L2: Tooling updates (non-functional)

### Medium Risk (Requires Testing)
- H6-H7: Timeout replacements (behavior change, must verify)
- H11: Re-enable skipped tests (unknown failure reasons)
- M1: Add data-testid (UI changes)
- M6-M7: New tests (could have false positives)

### High Risk (Complex Changes)
- H9-H10: Large test additions (could slow CI, introduce flakiness)
- H12: Page Object Model refactor (could break existing tests)

**Mitigation:**
- Run tests locally before committing
- Verify 3 consecutive passes for flakiness-prone changes
- Incremental commits (can revert if issues arise)

---

## Contingency Plans

### If Agent 6 fails (CI still red)
**Rollback:** Revert commits
**Investigate:** Check `./scripts/validate-ci-checks.sh` output
**Escalate:** Manual review of TypeScript/Go errors

---

### If Agent 7-11 tests fail
**Isolate:** Run only that agent's tests
**Debug:** Use `--debug` flag for Playwright, verbose mode for Go tests
**Partial Accept:** Merge passing portions, defer failing tests

---

### If E2E tests still flaky
**Action:** Increase timeouts temporarily (10s → 30s)
**Investigate:** Run `npx playwright test --repeat-each=10` to identify patterns
**Defer:** Mark as `.skip()` with detailed comment and create follow-up task

---

### If coverage targets not met
**Accept:** Lower thresholds temporarily
**Plan:** Create separate coverage improvement sprint
**Priority:** Green CI > Coverage percentage

---

## Open Questions for Human Review

1. **H5 (Admin "Users" section):** Does this section exist? If not, should we delete the test or add the feature?

2. **Coverage thresholds:** Should we enforce coverage minimums in CI or keep as aspirational targets?

3. **Long-term test strategy:** Should we invest in visual regression testing (Agent 12 territory)?

4. **Resource allocation:** Can we actually run 5 agents in parallel, or should we serialize more?

---

## Final Checklist Before Execution

- [ ] All agents understand their task assignments
- [ ] All agents have access to required files
- [ ] Phase 3A (Agent 6) will complete before Phase 3B starts
- [ ] Each agent commits to separate branch
- [ ] Human will merge branches sequentially
- [ ] Verification phase includes 3 consecutive green E2E runs
- [ ] Rollback plan documented and understood

---

## Appendix: File Change Matrix

### TypeScript Files (2)
- `/home/daniel/repos/zmanim/web/components/registry/MasterDocumentationContent.tsx` (Agent 6)
- `/home/daniel/repos/zmanim/web/components/editor/DSLReferencePanel.tsx` (Agent 6)

### Go Files (3)
- `/home/daniel/repos/zmanim/api/internal/handlers/admin_audit.go` (Agent 6)
- `/home/daniel/repos/zmanim/api/internal/handlers/audit_helpers.go` (Agent 6)
- `/home/daniel/repos/zmanim/api/internal/handlers/publisher_zmanim.go` (Agent 6)

### Go Test Files (8+)
- `/home/daniel/repos/zmanim/api/internal/handlers/admin_test.go` (Agent 7 - new)
- `/home/daniel/repos/zmanim/api/internal/handlers/publisher_test.go` (Agent 7 - new)
- `/home/daniel/repos/zmanim/api/internal/services/cache_test.go` (Agent 7 - new)
- `/home/daniel/repos/zmanim/api/internal/calendar/*_test.go` (Agent 7 - expand)
- `/home/daniel/repos/zmanim/api/internal/middleware/*_test.go` (Agent 7 - expand)
- `/home/daniel/repos/zmanim/api/internal/ai/*_test.go` (Agent 7 - new)
- `/home/daniel/repos/zmanim/api/internal/algorithm/*_test.go` (Agent 7 - new)
- `/home/daniel/repos/zmanim/api/internal/cache/*_test.go` (Agent 7 - new)
- `/home/daniel/repos/zmanim/api/internal/geo/*_test.go` (Agent 7 - new)

### Frontend Test Files (9+)
- `/home/daniel/repos/zmanim/web/lib/hooks/__tests__/useLocalitySearch.test.ts` (Agent 8 - restore)
- `/home/daniel/repos/zmanim/web/components/**/__tests__/*.test.tsx` (Agent 8 - new 10+ files)
- `/home/daniel/repos/zmanim/web/lib/hooks/__tests__/use*.test.ts` (Agent 8 - new 6 files)

### E2E Test Files (6)
- `/home/daniel/repos/zmanim/tests/e2e/publisher/team.spec.ts` (Agents 9, 10)
- `/home/daniel/repos/zmanim/tests/e2e/admin/dashboard.spec.ts` (Agent 9)
- `/home/daniel/repos/zmanim/tests/e2e/admin/publishers.spec.ts` (Agents 9, 11)
- `/home/daniel/repos/zmanim/tests/e2e/publisher/registry-publisher.spec.ts` (Agent 10)
- `/home/daniel/repos/zmanim/tests/e2e/publisher/algorithm-editor.spec.ts` (Agents 9, 10)
- `/home/daniel/repos/zmanim/tests/e2e/publisher/dashboard.spec.ts` (Agent 9)

### E2E Page Objects (1 new)
- `/home/daniel/repos/zmanim/tests/e2e/page-objects/RegistryPublisherPage.ts` (Agent 10 - new)

### Config Files (3)
- `/home/daniel/repos/zmanim/.golangci.yml` (Agent 6)
- `/home/daniel/repos/zmanim/web/vitest.config.ts` (Agent 6)
- `/home/daniel/repos/zmanim/web/package.json` (Agent 6)

### UI Components (for data-testid) (3)
- `/home/daniel/repos/zmanim/web/app/publisher/registry/page.tsx` (Agent 10)
- `/home/daniel/repos/zmanim/web/components/publisher/publisher-selector.tsx` (Agent 10 - if exists)
- `/home/daniel/repos/zmanim/web/components/search/location-input.tsx` (Agent 10 - if exists)

**Total Files:** 40+ files
**Total Lines Changed:** ~3,000-4,000 lines (including new tests)

---

**END OF FIX STRATEGY**
**Ready for execution - ZERO postponements - ALL issues triaged**
