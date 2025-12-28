# MISSION: ACHIEVE 100% GREEN GITHUB CI/CD - NO EXCUSES

## MISSION OBJECTIVE
Get ALL GitHub workflows to 100% GREEN status. No failures. No excuses about "unrelated issues" or "pre-existing problems". Fix EVERYTHING.

---

## SUCCESS CRITERIA (ABSOLUTE REQUIREMENTS)

### ✅ PR Checks Workflow
- **Status**: MUST BE 100% GREEN
- All 6 jobs passing:
  - Security Scan (Gitleaks)
  - Code Quality Check
  - Type Sync Validation
  - SQLc Validation
  - Web CI (ESLint, tests, build)
  - API CI (Go tests, linting)
- Zero errors
- Zero blocking warnings

### ✅ E2E Tests Workflow
- **Status**: MUST BE 100% PASS RATE (or 95%+ with documented flakiness)
- Zero rate limit errors (this was already achieved)
- Zero infrastructure failures
- Zero database errors
- Zero authentication failures
- Zero "Invalid publisher ID" errors
- ALL UI test failures must be investigated and fixed

### ✅ Test Quality Requirements
- Tests MUST actually test the system
- Tests MUST be up-to-date with current UI/features
- Tests MUST NOT be disabled/excluded without very good reason
- Tests MUST be reliable (not flaky)
- Tests MUST fail when bugs exist (no false positives)

---

## ORCHESTRATOR EXECUTION RULES

### YOU ARE THE ORCHESTRATOR
- **You delegate ALL work to sub-agents**
- **You do NOT perform any coding, research, or fixes yourself**
- **You use bmad:bmm:agents:dev with model=sonnet for ALL agents**
- **You launch agents in parallel when possible**
- **You synthesize results and make decisions**

### ZERO EXCUSES POLICY
- ❌ NO "this is unrelated to our changes"
- ❌ NO "this is pre-existing"
- ❌ NO "this can be fixed later"
- ❌ NO "this is just UI flakiness"
- ❌ NO "this is technical debt"
- ✅ YES "I will fix it NOW"

### DECISION-MAKING AUTHORITY
- **You MUST make common-sense decisions**
- If a test fails because a button was renamed: UPDATE THE TEST
- If a test fails because a feature changed: UPDATE THE TEST
- If a test fails because of flaky selectors: FIX THE SELECTORS
- If a test is testing something that no longer exists: DELETE THE TEST
- **Only ask the user if you genuinely cannot determine the right fix**

### QUALITY STANDARDS
- Tests must be COMPREHENSIVE
- Tests must be CURRENT (matching the actual UI/API)
- Tests must be RELIABLE (no random failures)
- Tests must be MEANINGFUL (actually testing real functionality)

---

## PHASE 1: COMPREHENSIVE ANALYSIS (PARALLEL)

Launch these agents simultaneously to analyze ALL failures:

### Agent 1: PR Checks Analyzer
**Model**: sonnet
**Type**: bmad:bmm:agents:dev

**Task**:
```
Analyze the latest PR Checks workflow run on the dev branch.

1. Get the exact status:
   cd /home/daniel/repos/zmanim
   gh run list --workflow="PR Checks" --branch dev --limit 1
   gh run view --workflow="PR Checks" --branch dev

2. For EACH job (Security Scan, Code Quality, Type Sync, SQLc, Web CI, API CI):
   - Status: pass/fail
   - If FAIL: Get detailed logs
   - Identify root cause
   - Categorize: ESLint error, TypeScript error, test failure, build error, etc.

3. For ESLint warnings (even non-blocking):
   - List ALL warnings
   - Identify files with issues
   - Determine if they should be fixed or suppressed

4. For TypeScript errors:
   - List ALL type errors
   - Identify root cause (missing types, wrong types, etc.)

5. For test failures:
   - Identify which tests failed
   - Get error messages
   - Determine root cause

Deliverable: PR_CHECKS_ANALYSIS.md with:
- Complete status of all 6 jobs
- Full list of ALL issues (errors + warnings)
- Root cause analysis for each
- Categorization by severity
- Recommended fixes
```

### Agent 2: E2E Test Failures Analyzer
**Model**: sonnet
**Type**: bmad:bmm:agents:dev

**Task**:
```
Analyze ALL E2E test failures in detail.

1. Get the latest E2E test run:
   cd /home/daniel/repos/zmanim
   gh run list --workflow="PR E2E Tests" --branch dev --limit 1
   gh run view --workflow="PR E2E Tests" --branch dev
   gh run view --workflow="PR E2E Tests" --log-failed > /tmp/e2e-failures.log

2. Categorize EVERY failure:
   - UI element not found (missing button, heading, etc.)
   - Feature changed (test expects old behavior)
   - Timing issue (race condition, timeout)
   - Data issue (missing test data)
   - Auth issue (login failed)
   - Infrastructure issue (database, Redis, API)

3. For EACH unique failure pattern:
   - Count how many tests fail with this pattern
   - Example test that fails
   - Error message
   - Root cause hypothesis
   - Recommended fix

4. Identify patterns:
   - Are multiple tests failing for the same reason?
   - Is this a systemic issue (e.g., all "Browse Registry" tests fail)?
   - Is this a single component breaking multiple tests?

5. Priority analysis:
   - CRITICAL: Infrastructure/auth failures (breaks many tests)
   - HIGH: Feature removed/changed (tests are obsolete)
   - MEDIUM: UI element renamed/moved (tests need updates)
   - LOW: Flaky timing issues (rare, intermittent)

Deliverable: E2E_FAILURES_ANALYSIS.md with:
- Total failures by category
- Top 10 failure patterns (with counts)
- Detailed analysis of each pattern
- Recommended fixes with priority
- Estimated effort per fix
```

### Agent 3: Test Coverage Analyzer
**Model**: sonnet
**Type**: bmad:bmm:agents:dev

**Task**:
```
Analyze whether our tests actually test the system comprehensively.

1. Backend test coverage:
   cd /home/daniel/repos/zmanim/api
   go test ./... -coverprofile=/tmp/coverage.out
   go tool cover -func=/tmp/coverage.out > /tmp/coverage-report.txt

   Analyze:
   - Overall coverage percentage
   - Packages with low coverage (<80%)
   - Critical services with low coverage
   - Untested error paths

2. Frontend test coverage:
   cd /home/daniel/repos/zmanim/web
   npm run test -- --coverage > /tmp/web-coverage.txt

   Analyze:
   - Overall coverage percentage
   - Components with low coverage
   - Critical hooks/services untested

3. E2E test coverage:
   Read all test specs in tests/e2e/
   Map tests to features/pages

   Identify:
   - Features with no E2E tests
   - Critical user flows not tested
   - Pages without any tests

4. Excluded/disabled tests:
   - Were useCategories.test.ts, useLocality.test.ts actually fixed or just deleted?
   - Are there skipped tests (.skip() in code)?
   - Are there disabled E2E tests?
   - Should these be re-enabled?

Deliverable: TEST_COVERAGE_ANALYSIS.md with:
- Coverage metrics (backend, frontend, E2E)
- Gaps in test coverage
- Excluded/disabled tests with reason
- Recommendations for new tests
```

### Agent 4: Test Quality Analyzer
**Model**: sonnet
**Type**: bmad:bmm:agents:dev

**Task**:
```
Analyze whether our tests are HIGH QUALITY and UP-TO-DATE.

1. Test currency check:
   - Read latest E2E test specs
   - Read actual UI pages (web/app/publisher/*, web/app/admin/*)
   - Compare: Do test expectations match actual UI?

   Examples to check:
   - Tests expecting "Browse Registry" button - does it exist in the code?
   - Tests expecting "Users" section - is that still in the UI?
   - Tests expecting old dashboard layout - has it changed?

2. Test reliability check:
   - Identify tests using fragile selectors (e.g., getByText('Submit'))
   - Identify tests with hard-coded timeouts
   - Identify tests without proper wait conditions
   - Identify tests that don't clean up after themselves

3. Test meaningfulness check:
   - Are tests testing real functionality or just "does page load"?
   - Are tests checking actual business logic?
   - Are tests checking error states?
   - Are tests redundant (multiple tests doing same thing)?

4. Test maintainability check:
   - Are tests using helper functions or copy-paste?
   - Are test fixtures shared or duplicated?
   - Are tests well-organized by feature?
   - Are test names descriptive?

Deliverable: TEST_QUALITY_ANALYSIS.md with:
- Tests that are OUTDATED (expecting old UI)
- Tests that are FRAGILE (flaky selectors, timeouts)
- Tests that are MEANINGLESS (not testing real functionality)
- Tests that need REFACTORING
- Recommendations for improvement
```

---

## PHASE 2: DECISION SYNTHESIS (SEQUENTIAL)

### Agent 5: Fix Strategy Designer
**Model**: sonnet
**Type**: bmad:bmm:agents:dev

**Task**:
```
Input: All 4 analysis reports from Phase 1

Create a comprehensive fix strategy with ZERO postponements.

1. Triage ALL issues:
   - CRITICAL (must fix): Blocking failures, infrastructure issues
   - HIGH (must fix): Feature changes, obsolete tests
   - MEDIUM (must fix): UI updates, selector fixes
   - LOW (must fix): Warnings, optimizations

2. Create fix plan:
   For EACH issue, decide:

   **If test expects UI that doesn't exist:**
   - Option A: Update test to match new UI (if feature still exists)
   - Option B: Delete test (if feature was removed)
   - Decision: [Choose A or B with justification]

   **If test is flaky:**
   - Root cause: [timing, race condition, etc.]
   - Fix: [better waits, data-testid, etc.]

   **If test has ESLint warning:**
   - Fix: [remove unused var, add proper type, etc.]

   **If test has TypeScript error:**
   - Fix: [add type, fix type mismatch, etc.]

3. Group fixes by agent:
   - Agent 6: ESLint/TypeScript fixes
   - Agent 7: Backend test fixes
   - Agent 8: Frontend test fixes
   - Agent 9: E2E test updates (UI changes)
   - Agent 10: E2E test fixes (flakiness)
   - Agent 11: Test deletions (obsolete tests)
   - Agent 12: New tests (coverage gaps)

4. Execution order:
   - Phase 2A: Quick fixes (ESLint, TypeScript) - parallel
   - Phase 2B: Test updates - parallel
   - Phase 2C: New tests - parallel
   - Phase 2D: Verification - sequential

Deliverable: FIX_STRATEGY.md with:
- Complete triage of all issues
- Specific fix for EVERY issue (no "will address later")
- Agent assignments
- Execution plan
- Success metrics
```

---

## PHASE 3: EXECUTION (PARALLEL BY PHASE)

### Phase 3A: Code Quality Fixes (PARALLEL)

#### Agent 6: ESLint & TypeScript Fixer
**Model**: sonnet
**Type**: bmad:bmm:agents:dev

**Task**:
```
Fix ALL ESLint warnings and TypeScript errors based on FIX_STRATEGY.md.

1. ESLint fixes:
   - Remove ALL unused imports/variables
   - Fix ALL `any` types with proper types
   - Fix ALL React hooks warnings
   - Fix ALL other ESLint issues

2. TypeScript fixes:
   - Add missing types
   - Fix type mismatches
   - Fix interface issues
   - Ensure strict mode compliance

3. Test locally:
   cd /home/daniel/repos/zmanim/web
   npm run lint
   npm run type-check

   Both MUST pass with zero errors, zero warnings.

4. Commit and push:
   git add .
   git commit -m "fix(ci): resolve all ESLint and TypeScript issues"
   git push origin dev

Deliverable:
- All files fixed
- Commit SHA
- Confirmation that lint and type-check pass locally
```

---

### Phase 3B: Test Fixes (PARALLEL)

#### Agent 7: Backend Test Fixer
**Model**: sonnet
**Type**: bmad:bmm:agents:dev

**Task**:
```
Fix ALL backend test failures based on FIX_STRATEGY.md.

1. Run tests and identify failures:
   cd /home/daniel/repos/zmanim/api
   go test ./... -v > /tmp/go-test-output.txt

2. Fix each failure:
   - Update test expectations if feature changed
   - Fix test data if database schema changed
   - Fix mocks if interfaces changed
   - Add missing test cases

3. Verify coverage:
   go test ./... -cover
   Target: >80% for all packages

4. Commit and push:
   git add .
   git commit -m "fix(tests): resolve all backend test failures"
   git push origin dev

Deliverable:
- All backend tests passing
- Coverage report
- Commit SHA
```

#### Agent 8: Frontend Unit Test Fixer
**Model**: sonnet
**Type**: bmad:bmm:agents:dev

**Task**:
```
Fix ALL frontend unit test failures based on FIX_STRATEGY.md.

1. Check if previously excluded tests can be restored:
   - Were useCategories.test.ts, useLocality.test.ts, useLocalitySearch.test.ts deleted?
   - If deleted, are the hooks still broken or were they fixed?
   - If fixed, recreate minimal tests for these hooks

2. Fix all failing tests:
   cd /home/daniel/repos/zmanim/web
   npm test

   For each failure:
   - Update test expectations
   - Fix mock data
   - Fix component rendering

3. Ensure NO tests are excluded in package.json

4. Verify all pass:
   npm test (must show 100% pass rate)

5. Commit and push:
   git add .
   git commit -m "fix(tests): resolve all frontend unit test failures"
   git push origin dev

Deliverable:
- All frontend tests passing
- No excluded tests
- Commit SHA
```

#### Agent 9: E2E UI Update Fixer
**Model**: sonnet
**Type**: bmad:bmm:agents:dev

**Task**:
```
Update ALL E2E tests to match current UI based on FIX_STRATEGY.md.

This is the BIG ONE - the 181 E2E failures.

1. For EACH failing test:
   Read the error message
   Read the test code
   Read the actual UI page code

   DECISION TREE:

   A. If test expects UI element that exists but has different selector:
      → Update selector (use data-testid, getByRole, etc.)

   B. If test expects UI element that was renamed:
      → Update test to use new name

   C. If test expects feature that was redesigned:
      → Update test to match new design

   D. If test expects feature that was removed:
      → DELETE THE TEST

   E. If test is flaky (timing issue):
      → Add proper waits, use page.waitForLoadState(), etc.

2. Common fixes needed (based on analysis):
   - "Browse Registry" button: Check if it exists, update selector, or remove test
   - "Users" section: Check if it exists, update selector, or remove test
   - Dashboard elements: Update to match current dashboard
   - Algorithm page: Update to match current onboarding
   - Coverage page: Update to match current UI

3. Test each fix locally:
   cd /home/daniel/repos/zmanim/tests
   npx playwright test [spec-file]

   Ensure test passes before moving to next.

4. Commit incrementally (every 10-20 tests fixed):
   git add tests/e2e/
   git commit -m "fix(e2e): update tests for [feature area]"
   git push origin dev

Deliverable:
- ALL 181 E2E failures addressed (fixed or deleted)
- Tests updated to match current UI
- Obsolete tests removed
- All commits pushed
```

#### Agent 10: E2E Flakiness Fixer
**Model**: sonnet
**Type**: bmad:bmm:agents:dev

**Task**:
```
Fix ANY remaining flaky E2E tests based on FIX_STRATEGY.md.

1. Identify flaky patterns:
   - Tests that sometimes pass, sometimes fail
   - Tests with timeout errors
   - Tests with race conditions

2. Apply reliability fixes:
   - Replace hard-coded waits with smart waits
   - Add data-testid to flaky selectors
   - Use page.waitForLoadState('networkidle')
   - Use page.waitForFunction() for dynamic content
   - Increase timeouts ONLY as last resort

3. Add retry logic for known flaky operations:
   - Network requests
   - Dynamic content loading
   - Third-party integrations (Clerk)

4. Test each fix 10 times locally to verify stability:
   for i in {1..10}; do npx playwright test [spec-file]; done

5. Commit and push:
   git add tests/e2e/
   git commit -m "fix(e2e): improve test reliability and reduce flakiness"
   git push origin dev

Deliverable:
- Flaky tests stabilized
- Smart waits implemented
- Commit SHA
```

#### Agent 11: Obsolete Test Remover
**Model**: sonnet
**Type**: bmad:bmm:agents:dev

**Task**:
```
Delete ALL obsolete tests based on FIX_STRATEGY.md.

ONLY delete tests when:
1. Feature was completely removed from the app
2. Test is duplicated by another test
3. Test is testing implementation details, not behavior

For each deletion:
1. Verify feature is truly gone (check UI code)
2. Verify no other test covers this functionality
3. Document why test was removed in commit message

Commit and push:
git add tests/
git commit -m "test(cleanup): remove obsolete tests for removed features

Removed tests:
- [test name]: [reason for removal]
- [test name]: [reason for removal]
..."
git push origin dev

Deliverable:
- Obsolete tests removed
- Justification for each deletion
- Commit SHA
```

---

### Phase 3C: Coverage Gaps (PARALLEL)

#### Agent 12: New Test Creator
**Model**: sonnet
**Type**: bmad:bmm:agents:dev

**Task**:
```
Add new tests for coverage gaps based on TEST_COVERAGE_ANALYSIS.md.

1. Create tests for untested critical paths:
   - Backend services with <80% coverage
   - Frontend components with <80% coverage
   - E2E user flows not covered

2. Prioritize:
   - Critical business logic (zmanim calculations, algorithm publishing)
   - Payment/auth flows (if applicable)
   - Data integrity (publishers, coverage, etc.)

3. Write high-quality tests:
   - Test behavior, not implementation
   - Test happy path AND error cases
   - Use proper test fixtures
   - Follow existing test patterns

4. Verify all new tests pass:
   - Backend: go test ./...
   - Frontend: npm test
   - E2E: npx playwright test

5. Commit and push:
   git add .
   git commit -m "test(coverage): add tests for critical untested paths"
   git push origin dev

Deliverable:
- New tests created
- Coverage improvement metrics
- Commit SHA
```

---

## PHASE 4: VERIFICATION (SEQUENTIAL)

### Agent 13: CI/CD Verifier
**Model**: sonnet
**Type**: bmad:bmm:agents:dev

**Task**:
```
Verify that GitHub CI/CD is 100% GREEN.

1. Wait for all PR Checks to complete:
   cd /home/daniel/repos/zmanim
   gh run watch --workflow="PR Checks" --branch dev

2. Verify PR Checks result:
   gh run view --workflow="PR Checks" --branch dev

   Required: ALL jobs passing
   - Security Scan: PASS
   - Code Quality Check: PASS
   - Type Sync Validation: PASS
   - SQLc Validation: PASS
   - Web CI: PASS
   - API CI: PASS

3. Wait for E2E Tests to complete:
   gh run watch --workflow="PR E2E Tests" --branch dev

4. Verify E2E Tests result:
   gh run view --workflow="PR E2E Tests" --branch dev

   Required: 95%+ pass rate (or 100%)
   - Zero rate limit errors
   - Zero infrastructure failures
   - Only acceptable failures: documented flaky tests

5. If ANY job fails:
   - Get failure details
   - Identify root cause
   - GO BACK to Phase 3 and fix the issue
   - DO NOT PROCEED until 100% green

6. Run local validation:
   cd /home/daniel/repos/zmanim
   ./scripts/validate-ci-checks.sh

   Must pass locally.

Deliverable: CI_VERIFICATION_REPORT.md with:
- Screenshot/output of all jobs passing
- Pass/fail counts for E2E tests
- Any remaining known issues (must be documented flakiness only)
- GitHub Actions URLs for green runs
```

---

## PHASE 5: FINAL REPORT (SEQUENTIAL)

### Agent 14: Mission Completion Reporter
**Model**: sonnet
**Type**: bmad:bmm:agents:dev

**Task**:
```
Create comprehensive mission completion report.

1. Summary statistics:
   - Total issues fixed
   - Commits created
   - Lines of code changed
   - Tests updated/created/deleted
   - Time elapsed

2. Before/after comparison:
   - PR Checks: [before status] → [after status]
   - E2E Tests: [before pass rate] → [after pass rate]
   - Test coverage: [before %] → [after %]

3. What was fixed:
   Complete list organized by category:
   - ESLint/TypeScript issues
   - Backend test failures
   - Frontend test failures
   - E2E UI updates
   - E2E flakiness fixes
   - Obsolete test removals
   - New tests added

4. Test quality improvements:
   - Tests now up-to-date with current UI
   - Tests now reliable (not flaky)
   - Tests now comprehensive (coverage gaps filled)
   - Tests now meaningful (testing real functionality)

5. Production readiness:
   - All CI checks passing: YES/NO
   - E2E tests passing: [percentage]
   - Known issues: [list any remaining, if absolutely unavoidable]
   - Deployment ready: YES/NO

6. Lessons learned:
   - What patterns caused the most failures?
   - What can we do to prevent this in the future?
   - Recommendations for ongoing test maintenance

Deliverable: MISSION_COMPLETE_REPORT.md with:
- Executive summary
- Detailed statistics
- Before/after comparison
- Complete fix list
- Production readiness assessment
- Recommendations
```

---

## ORCHESTRATOR EXECUTION CHECKLIST

```markdown
## Phase 1: Analysis (PARALLEL - SINGLE MESSAGE)
- [ ] Launch Agents 1-4 simultaneously in ONE message
- [ ] Agent 1: PR Checks Analyzer
- [ ] Agent 2: E2E Failures Analyzer
- [ ] Agent 3: Test Coverage Analyzer
- [ ] Agent 4: Test Quality Analyzer
- [ ] Wait for ALL to complete
- [ ] Review all analysis reports

## Phase 2: Strategy (SEQUENTIAL)
- [ ] Launch Agent 5: Fix Strategy Designer
- [ ] Review FIX_STRATEGY.md
- [ ] Verify every issue has a fix (no postponements)
- [ ] Proceed to execution

## Phase 3A: Code Quality (PARALLEL)
- [ ] Launch Agent 6: ESLint & TypeScript Fixer
- [ ] Wait for completion
- [ ] Verify commit pushed

## Phase 3B: Test Fixes (PARALLEL - SINGLE MESSAGE)
- [ ] Launch Agents 7-11 simultaneously
- [ ] Agent 7: Backend Test Fixer
- [ ] Agent 8: Frontend Unit Test Fixer
- [ ] Agent 9: E2E UI Update Fixer (THE BIG ONE)
- [ ] Agent 10: E2E Flakiness Fixer
- [ ] Agent 11: Obsolete Test Remover
- [ ] Wait for ALL to complete
- [ ] Verify all commits pushed

## Phase 3C: Coverage (PARALLEL)
- [ ] Launch Agent 12: New Test Creator
- [ ] Wait for completion
- [ ] Verify commit pushed

## Phase 4: Verification (SEQUENTIAL)
- [ ] Launch Agent 13: CI/CD Verifier
- [ ] Review verification report
- [ ] If NOT 100% green: LOOP BACK to Phase 3
- [ ] If 100% green: Proceed to Phase 5

## Phase 5: Final Report (SEQUENTIAL)
- [ ] Launch Agent 14: Mission Completion Reporter
- [ ] Review final report
- [ ] Confirm: GitHub is 100% GREEN
- [ ] Mission complete ✅
```

---

## CRITICAL SUCCESS FACTORS

### 1. ZERO EXCUSES
Every issue must be fixed. No "we'll do this later" or "this is unrelated".

### 2. COMMON SENSE DECISIONS
If a test expects a "Submit" button but the button is now "Save", UPDATE THE TEST. Don't ask the user for obvious fixes.

### 3. ACTUAL TESTING
Tests must test real functionality, not just "does page load". Ensure tests are meaningful.

### 4. UP-TO-DATE TESTS
Tests must match the current state of the application, not some old version.

### 5. RELIABLE TESTS
Tests must pass consistently. No flaky tests allowed.

### 6. 100% GREEN
The ONLY acceptable end state is all GitHub workflows showing green checkmarks.

---

## FINAL DELIVERABLE

At the end of this mission, the orchestrator MUST provide:

1. **GitHub Status**: Both PR Checks and E2E Tests workflows showing 100% green (or 95%+ with documented acceptable failures)

2. **Complete Fix List**: Every single issue that was fixed, organized by category

3. **Test Quality Report**: Confirmation that tests are comprehensive, current, reliable, and meaningful

4. **Commit History**: List of all commits created during this mission

5. **Production Readiness**: Clear statement that the system is ready to deploy

---

## IF YOU CANNOT ACHIEVE 100% GREEN

If, after exhaustive effort, some tests still fail:

1. **Document WHY**: What is the root cause that cannot be resolved?

2. **Show EFFORT**: What fixes were attempted? What didn't work?

3. **Escalate INTELLIGENTLY**: Present specific blocker with context, not "it's too hard"

4. **Propose WORKAROUND**: Is there an alternative approach?

But the expectation is: **YOU WILL ACHIEVE 100% GREEN**. Use your intelligence, use common sense, make decisions, and GET IT DONE.

---

## MISSION START COMMAND

When ready to execute, the orchestrator should state:

```
I am the CI/CD Fix Orchestrator. My mission is to achieve 100% GREEN on GitHub CI/CD with ZERO excuses.

I will NOT perform any work myself. I will delegate ALL tasks to specialized bmad:bmm:agents:dev sub-agents using the sonnet model.

I will NOT accept any "this is unrelated" or "we'll fix this later" responses. EVERY issue will be fixed NOW.

Starting Phase 1: Launching 4 analysis agents in parallel to comprehensively analyze all failures...
```

---

**MISSION OBJECTIVE**: GitHub 100% GREEN. No excuses. Get it done.
