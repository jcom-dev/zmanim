# E2E Test Historical Failures (Before Build Break)

**Analysis Date:** 2025-12-27
**Previous Run:** [#20521786926](https://github.com/jcom-dev/zmanim/actions/runs/20521786926)
**Commit:** eca9916 - "fix(e2e): prevent deletion of shared test publishers"
**Status:** FAILED (Test Execution)
**Duration:** 16m16s

---

## Summary

The run immediately before the build-breaking commit (29d099a) shows **181 test failures**, all during actual test execution. This indicates there were systemic E2E test issues that existed BEFORE the TypeScript compilation error was introduced.

---

## Failure Pattern Analysis

### Primary Failure Type: UI Element Not Found

**Count:** ~80 occurrences
**Pattern:** `expect(locator).toBeVisible() failed`

#### Error Details

```
Error: expect(locator).toBeVisible() failed
Timeout: 10000ms
Error: element(s) not found
  - Expect "toBeVisible" with timeout 10000ms
```

#### Common Timeout Values
- **10000ms (10 seconds):** 60 occurrences (most common)
- **15000ms (15 seconds):** 4 occurrences
- **5000ms (5 seconds):** 2 occurrences

#### Root Causes (Hypothesis)

1. **UI Element Renamed/Removed**
   - Tests expect specific buttons/elements that no longer exist
   - Example: "Browse Registry" button mentioned in multiple failures

2. **Async Loading Issues**
   - Elements take longer than expected timeout to appear
   - Network/API latency in CI environment
   - Missing loading state handling in tests

3. **Test Data Issues**
   - Required test data not seeded
   - Publisher/user accounts not properly set up
   - Database state inconsistent between tests

---

## Specific Failure Examples

### 1. Admin Publishers Page - Users Section

**Test:** `admin-publishers > Admin Publishers details shows Users section`
**Status:** Failed (2 retries)

```
Error: expect(locator).toBeVisible() failed
Timeout: 10000ms
Error: element(s) not found
```

**Hypothesis:** Users section UI component missing or renamed

---

### 2. Publisher Algorithm Migration - Browse Registry Button

**Test:** `publisher-algorithm-migration > Browse Registry button exists`
**Status:** Failed (2 retries)

```
Error: expect(locator).toBeVisible() failed
Timeout: 15000ms
Error: element(s) not found

> 41 |     await expect(browseRegistryButton).toBeVisible({ timeout: Timeouts.MEDIUM });
```

**Hypothesis:**
- "Browse Registry" button removed or renamed in recent refactoring
- Multiple tests depend on this button (migration flow, publisher registry)
- Affects both algorithm migration and registry navigation flows

---

### 3. Publisher Algorithm Migration - Nonexistent Focus Param

**Test:** `publisher-algorithm-migration > handles nonexistent focus param`
**Status:** Failed

```
Error: expect(received).toBeFalsy()
  208 |     const hasError = pageContent?.toLowerCase().includes('error') ||
> 210 |     expect(hasError).toBeFalsy();
```

**Hypothesis:**
- Page displays error message when it shouldn't
- Invalid URL parameter handling
- Error boundary triggered incorrectly

---

## Failure Categories

### Category 1: Missing UI Elements (HIGH)
- **Count:** ~80 failures
- **Pattern:** `toBeVisible()` timeout
- **Impact:** Tests cannot interact with UI
- **Priority:** HIGH

**Affected Areas:**
- Admin publishers page (Users section)
- Publisher algorithm migration (Browse Registry button)
- Publisher registry navigation
- Dashboard components

### Category 2: Invalid Form States (MEDIUM)
- **Count:** ~9 failures
- **Pattern:** `toHaveValue()` timeout
- **Impact:** Form validation tests fail
- **Priority:** MEDIUM

**Hypothesis:**
- Input fields not populated correctly
- Form data not persisting
- Async state updates not awaited

### Category 3: Error Handling (LOW)
- **Count:** 2 failures
- **Pattern:** `toBeFalsy()` assertion failure
- **Impact:** Error boundary tests fail
- **Priority:** LOW

**Hypothesis:**
- Unexpected error messages displayed
- Error states not properly cleared
- URL parameter validation issues

---

## Test Stability Issues

### Retry Behavior

Many failures show retry attempts (e.g., `retry1` in artifact paths), indicating:
1. Tests are flaky (pass/fail inconsistently)
2. Playwright retry mechanism is engaged
3. Timing/race conditions likely involved

**Example artifacts:**
```
test-results/artifacts/.../chromium-admin/test-failed-1.png
test-results/artifacts/.../chromium-admin-retry1/test-failed-1.png
```

---

## Timeline Correlation

### Recent E2E-Related Commits

```
eca9916 (Dec 26) fix(e2e): prevent deletion of shared test publishers
94c4a49 (Dec 26) debug(e2e): add detailed logging for slug resolution
7c40272 (Dec 26) fix(e2e): add fallback name-based publisher resolution
b56b0ac (Dec 26) fix(e2e): convert publisherId string to integer for SQL query
```

**Observation:** 4 consecutive commits on Dec 26 attempted to fix E2E issues:
1. Publisher ID type handling (string vs integer)
2. Publisher resolution fallback mechanisms
3. Debug logging for troubleshooting
4. Preventing test data deletion

This suggests the team was **actively debugging E2E failures** before the build break occurred.

---

## Root Cause Hypothesis: "Browse Registry" Button

### Evidence

Multiple tests fail looking for "Browse Registry" button:
- `publisher-algorithm-migration > Browse Registry button exists` (line 41)
- `publisher-algorithm-migration > navigates to publisher registry` (line 114)

### Likely Scenario

1. Recent UI refactoring removed or renamed "Browse Registry" button
2. Tests were not updated to reflect new UI structure
3. Multiple test suites depend on this navigation element
4. Cascading failures as tests cannot navigate to required pages

### Impact Analysis

If "Browse Registry" button is missing:
- Algorithm editor tests cannot navigate to registry
- Publisher migration flow tests fail
- Registry-related tests cannot execute
- Estimated ~20-40 tests affected

---

## Recommendations for Historical Failures

### Immediate Actions

1. **Verify "Browse Registry" Button**
   ```bash
   cd web
   grep -r "Browse Registry" app/ components/
   ```
   - Check if button still exists
   - Find new text/selector if renamed
   - Update test selectors accordingly

2. **Audit UI Element Selectors**
   - Review recent UI component changes
   - Cross-reference with test failures
   - Update test locators for renamed elements

3. **Stabilize Test Data**
   - Ensure publisher test accounts exist
   - Verify database seeding in CI
   - Add assertions for required test data

### Short-term Actions

4. **Add Loading State Handlers**
   ```typescript
   // Wait for page to fully load
   await page.waitForLoadState('networkidle');

   // Wait for specific API calls
   await page.waitForResponse(resp => resp.url().includes('/api/publishers'));
   ```

5. **Increase Timeout for Slow Operations**
   - Review timeout values (10s may be too short in CI)
   - Consider environment-specific timeouts
   - Add retry logic for flaky operations

6. **Investigate Error Boundary Triggers**
   - Review error handling in algorithm migration
   - Check URL parameter validation
   - Add proper error recovery

### Long-term Actions

7. **Implement Page Object Pattern**
   - Centralize UI element selectors
   - Single source of truth for locators
   - Easier to update when UI changes

8. **Add Visual Regression Testing**
   - Catch UI changes automatically
   - Prevent unnoticed button removals
   - Generate diff reports

9. **Improve Test Isolation**
   - Each test should set up own data
   - Don't rely on shared test fixtures
   - Clean up after each test

10. **Add E2E Test Health Monitoring**
    - Track test pass/fail rates over time
    - Alert on sudden spikes in failures
    - Identify flaky tests automatically

---

## Comparison: Build Break vs Historical Failures

| Aspect | Current (29d099a) | Previous (eca9916) |
|--------|-------------------|-------------------|
| **Status** | Build Failed | Tests Failed |
| **Phase** | TypeScript Compilation | Test Execution |
| **Duration** | 2m10s | 16m16s |
| **Tests Run** | 0 | 100+ |
| **Failures** | 1 (Build) | 181 (Tests) |
| **Root Cause** | Incomplete Refactoring | Multiple UI/Logic Issues |
| **Fix Complexity** | Trivial (5min) | Complex (hours-days) |
| **Deployment Impact** | Total Block | Would Deploy (but broken) |

**Key Insight:** The build break (current) is actually **easier to fix** than the underlying test failures (historical). However, the build break **blocks visibility** into the test failures, making it a higher priority to fix first.

---

## Action Priority

### Priority 1: CRITICAL (Immediate)
Fix build break to restore visibility into test failures
- **Task:** Remove `count` props from DSLReferencePanel
- **Time:** 5 minutes
- **Blocker:** Prevents all E2E testing

### Priority 2: HIGH (Same Day)
Fix "Browse Registry" button issue
- **Task:** Find and update button selector in tests
- **Time:** 1-2 hours
- **Impact:** ~20-40 tests

### Priority 3: MEDIUM (This Week)
Stabilize form value assertions
- **Task:** Fix `toHaveValue()` timeout failures
- **Time:** 2-4 hours
- **Impact:** ~9 tests

### Priority 4: LOW (Next Sprint)
Fix error boundary handling
- **Task:** Review error display logic
- **Time:** 1-2 hours
- **Impact:** 2 tests

---

## Summary Statistics (Historical Run)

| Metric | Value |
|--------|-------|
| **Total Test Failures** | 181 |
| **Primary Failure Type** | `toBeVisible()` timeout |
| **Most Common Timeout** | 10000ms (10 seconds) |
| **UI Element Failures** | ~80 |
| **Form Value Failures** | ~9 |
| **Error Handling Failures** | 2 |
| **Test Duration** | 16m16s |
| **Affected Test Files** | 30+ (estimated) |

---

**Report Generated:** 2025-12-27
**Data Source:** GitHub Actions Run #20521786926
**Confidence Level:** 85% (based on log patterns, not full test output)
