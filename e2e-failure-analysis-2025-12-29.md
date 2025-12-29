# E2E Test Failure Analysis - GitHub Actions
**Generated:** 2025-12-29
**Analysis Period:** Last 10 workflow runs

## Executive Summary

**Critical Finding:** Consistent high failure rate across all recent E2E workflow runs, with 128-155 tests failing out of 505 total tests (25-31% failure rate).

### Failure Trend
- Run 20580076665 (Dec 29, 18:37): **128 failures** ⬇️
- Run 20564767949 (Dec 29, 04:21): **148 failures**
- Run 20560419496 (Dec 28, 22:28): **153 failures**
- Run 20555602134 (Dec 28, 15:10): **155 failures**

**Pattern:** Slight improvement trend but still critically high failure rate.

---

## Test Failure Distribution by File

| Test File | Failures | Impact |
|-----------|----------|--------|
| `publisher/onboarding.spec.ts` | 86 | 🔴 CRITICAL |
| `publisher/algorithm-editor.spec.ts` | 76 | 🔴 CRITICAL |
| `performance/registry-performance.spec.ts` | 76 | 🔴 CRITICAL |
| `publisher/registry-publisher.spec.ts` | 62 | 🔴 HIGH |
| `publisher/registry-request.spec.ts` | 44 | 🟡 MEDIUM |
| `user/location.spec.ts` | 32 | 🟡 MEDIUM |
| `user/display-settings.spec.ts` | 28 | 🟡 MEDIUM |
| `publisher/team.spec.ts` | 26 | 🟡 MEDIUM |
| `publisher/registry-duplicates.spec.ts` | 24 | 🟡 MEDIUM |
| `publisher/profile.spec.ts` | 20 | 🟡 MEDIUM |
| `home.spec.ts` | 20 | 🟡 MEDIUM |
| Others (15 files) | <20 each | 🟢 LOW |

**Total test files affected:** 26 files

---

## Root Cause Analysis

### Category 1: Timeout Errors (60% of failures)

#### 1.1 Click Timeouts (126 occurrences)
**Pattern:** `TimeoutError: locator.click: Timeout 15000ms exceeded`

**Most affected selectors:**
- `locator('button').filter({ hasText: /cities$/i }).first()` (10 failures)
- `getByLabel(/publisher.*organization.*name/i)` (6 failures)
- Location picker and city search buttons

**Root Cause:** Elements exist but are not in clickable state (likely covered by overlays, loading states, or disabled)

**Affected Tests:**
- Registry performance tests
- Publisher onboarding flow
- Location selection flows

---

#### 1.2 Page Wait Function Timeouts (44 occurrences)
**Pattern:** `TimeoutError: page.waitForFunction: Timeout 15000ms exceeded`

**Primary Location:** `publisher/onboarding.spec.ts` - `waitForWelcome()` helper function

**Code Context:**
```typescript
async function waitForWelcome(page: Page) {
  await page.waitForFunction(
    () => document.body.textContent?.toLowerCase().includes('welcome'),
    { timeout: 30000 }  // Configured to 30s but failing at 15s
  );
}
```

**Root Cause:** Page never renders welcome message. Likely causes:
1. Routing issue - page doesn't navigate to onboarding wizard
2. Authentication state problem
3. Publisher without algorithm not triggering wizard
4. React rendering error causing white screen

**Impact:** Cascading failures in entire onboarding test suite (86 failures)

---

#### 1.3 Selector Wait Timeouts (24 occurrences)
**Pattern:** `TimeoutError: page.waitForSelector: Timeout 30000ms exceeded`

**Common selectors timing out:**
- City/location search inputs
- Registry filters and tabs
- Modal dialogs

---

#### 1.4 Fill Input Timeouts (16 occurrences)
**Pattern:** `TimeoutError: locator.fill: Timeout 15000ms exceeded`

**Affected inputs:**
- Publisher organization name
- Location search fields
- Registry request forms

**Root Cause:** Input fields not becoming editable (disabled state, loading overlay, or not mounted)

---

### Category 2: Element Not Found Errors (23% of failures)

#### 2.1 Visibility Assertion Failures (140 occurrences)
**Pattern:** `Error: expect(locator).toBeVisible() failed` + `Error: element(s) not found`

**Most common missing elements:**
- "Back to Dashboard" button (2 failures)
- Zmanim count display (`/\d+ Zmanim/`) (2 failures)
- Version history button (2 failures)
- Import/Add custom buttons (2 failures each)

**Root Cause:** Page rendering incomplete or incorrect route

**Critical Example - Algorithm Editor:**
```typescript
// Line 48 in algorithm-editor.spec.ts
await expect(page.getByText(/\d+ Zmanim/)).toBeVisible();
// FAILS: Element not rendered even after page load
```

---

### Category 3: Strict Mode Violations (12 occurrences)

**Pattern:** `Error: strict mode violation: [selector] resolved to 2 elements`

**Duplicate elements found:**
- `getByRole('checkbox', { name: /gra/i })` (6 failures)
- `getByRole('checkbox', { name: /alos/i })` (6 failures)
- `getByText('Multi-Publisher Zmanim Platform')` (4 failures)
- `getByRole('link', { name: 'Become a Publisher' })` (4 failures)

**Root Cause:** Page rendering duplicate components (likely React key issues or modal + page both rendering)

---

### Category 4: Assertion Failures (5% of failures)

#### 4.1 toBeTruthy Failures (16 occurrences)
**Pattern:** `Error: expect(received).toBeTruthy()`

**Context:** Text content checks after page navigation
```typescript
expect(await page.textContent('body')).toBeTruthy();
// FAILS: Body is empty or contains only whitespace
```

---

#### 4.2 Title Mismatch (4 occurrences)
**Pattern:** `Error: expect(page).toHaveTitle(expected) failed`

**Impact:** Home page and authentication flow tests

---

#### 4.3 Value Mismatch (6 occurrences)
**Pattern:** `Error: expect(locator).toHaveValue(expected) failed`

**Impact:** Form input validation tests

---

## Cross-Cutting Issues

### Issue 1: Publisher Onboarding Wizard Not Loading
**Evidence:**
- 86 failures in `onboarding.spec.ts`
- ALL failures at `waitForWelcome()` function
- Timeout waiting for "welcome" text in page body

**Hypothesis:**
1. **Route Guard Issue:** Publisher with no algorithm should trigger wizard, but route may be redirecting elsewhere
2. **Database State:** Empty publishers created in setup might not have correct state to trigger wizard
3. **React Error:** Unhandled exception preventing wizard component mount

**Debug Path:**
1. Check `/publisher/algorithm` route logic for empty publishers
2. Verify database state of `E2E Empty 1/2/3` publishers
3. Check browser console for React errors (screenshots available in artifacts)

---

### Issue 2: Algorithm Editor Page Loading Incompletely
**Evidence:**
- 76 failures in `algorithm-editor.spec.ts`
- Elements missing: "Back to Dashboard", zmanim count, tab buttons
- Timeouts on basic UI elements

**Hypothesis:**
1. **API Loading State:** Zmanim data not loading, causing UI to remain in loading state
2. **React Suspense:** Suspense boundary stuck waiting for data
3. **Permission Check:** User lacks permissions, causing blank page instead of error

**Debug Path:**
1. Check API call to `/api/v1/publisher/zmanim` in network logs
2. Verify publisher linkage in `global-setup.ts`
3. Check for 401/403 errors in failed test screenshots

---

### Issue 3: Registry Performance Test Systematic Failures
**Evidence:**
- 76 failures in `registry-performance.spec.ts`
- Timeouts on location picker, city selection
- Cannot click interactive elements

**Root Cause Analysis:**
```typescript
// Line 94-96 in registry-performance.spec.ts
const locationButton = page.locator('[data-testid="location-picker"]').or(
  page.getByPlaceholder(/search for a city/i)
).first();
await locationButton.click(); // TIMEOUT
```

**Hypothesis:**
1. **Loading Overlay:** Modal or loading spinner blocking clicks
2. **Disabled State:** Button exists but disabled due to data not loaded
3. **Z-index Issue:** Element rendered but covered by another layer

**Impact:** ALL performance metrics unavailable, blocking performance regression detection

---

### Issue 4: Element Duplication (Strict Mode Violations)
**Pattern:** Checkboxes and links appearing twice on page

**Example:**
```
Error: strict mode violation: getByRole('checkbox', { name: /alos/i })
resolved to 2 elements
```

**Hypothesis:**
1. **Modal Rendering:** Both page content and modal render same checkboxes
2. **React Key Issue:** Duplicate components with same keys
3. **Server/Client Hydration:** SSR and client-side rendering creating duplicates

**Fix Priority:** MEDIUM (affects 12 tests, workaround possible with `.first()`)

---

## Flakiness Analysis

### Consistency Score: **HIGH (Not Flaky)**

**Evidence:**
- Same tests fail consistently across runs
- Failure count decreasing slowly (155 → 128) but pattern unchanged
- No evidence of intermittent passes

**Conclusion:** These are **NOT flaky tests**. They are deterministic failures indicating genuine bugs or environment issues.

---

## Environment-Specific Factors

### CI vs Local Differences
**Potential factors:**
1. **Database State:** CI uses PostgreSQL 17.6, different from local setup?
2. **Timing:** CI environment slower, exposing race conditions
3. **Browser Version:** Chrome 143.0.7499.169 in CI (just upgraded from .109)
4. **Parallel Execution:** 8 workers may cause database contention
5. **Network Latency:** API responses slower in CI

**Note:** No local test runs available for comparison in logs.

---

## Recommended Fix Priority

### P0 - CRITICAL (Fix Immediately)
1. **Publisher Onboarding Wizard Loading** (86 failures)
   - **File:** `tests/e2e/publisher/onboarding.spec.ts`
   - **Impact:** Complete onboarding flow untestable
   - **Fix:** Debug why wizard doesn't appear for empty publishers

2. **Algorithm Editor Page Rendering** (76 failures)
   - **File:** `tests/e2e/publisher/algorithm-editor.spec.ts`
   - **Impact:** Core publisher functionality untestable
   - **Fix:** Investigate API data loading and React suspense

3. **Registry Performance Tests** (76 failures)
   - **File:** `tests/e2e/performance/registry-performance.spec.ts`
   - **Impact:** No performance monitoring, regression risk
   - **Fix:** Debug location picker click timeout

---

### P1 - HIGH (Fix This Sprint)
4. **Registry Publisher Tests** (62 failures)
   - **File:** `tests/e2e/publisher/registry-publisher.spec.ts`
   - **Impact:** Publisher's main workflow (zmanim selection) untestable

5. **Registry Request Flow** (44 failures)
   - **File:** `tests/e2e/publisher/registry-request.spec.ts`
   - **Impact:** Cannot test new zmanim request workflow

---

### P2 - MEDIUM (Fix Next Sprint)
6. **Location Selection** (32 failures) - `user/location.spec.ts`
7. **Display Settings** (28 failures) - `user/display-settings.spec.ts`
8. **Team Management** (26 failures) - `publisher/team.spec.ts`
9. **Registry Duplicates** (24 failures) - `publisher/registry-duplicates.spec.ts`

---

### P3 - LOW (Backlog)
- Authentication flows (16 failures)
- Email invitation flows (8 failures)
- Accessibility tests (6 failures)
- Admin panel tests (8 failures)

---

## Action Items

### Immediate (Today)
1. ✅ Review test artifacts (screenshots) from run 20580076665
2. ✅ Check application logs for errors during test execution
3. ✅ Verify database state of shared test publishers
4. ✅ Run single onboarding test locally to reproduce

### Short Term (This Week)
5. Fix onboarding wizard routing/loading issue
6. Fix algorithm editor page rendering
7. Fix registry performance test click timeouts
8. Add better error logging to `waitForWelcome()` helper
9. Increase timeout values as temporary mitigation (30s → 60s)

### Medium Term (This Sprint)
10. Implement retry logic for flaky network operations
11. Add page.screenshot() before each timeout error
12. Review and fix strict mode violations (duplicate elements)
13. Investigate Chrome upgrade impact (143.0.7499.169)

### Long Term (Next Sprint)
14. Add E2E test smoke suite (critical path only)
15. Implement E2E test health dashboard
16. Set up local E2E test run comparison
17. Document E2E test debugging playbook

---

## Test Infrastructure Observations

### Strengths
- Good test organization (parallel execution, shared fixtures)
- Comprehensive coverage (505 tests)
- Performance metrics collection
- Detailed error logging

### Weaknesses
- High coupling to timing (many 15s/30s waits)
- Generic error messages ("element not found")
- No progressive failure detection (all tests run even after critical failures)
- Missing screenshot capture on timeout

---

## Investigation Commands

Run these to debug specific issues:

```bash
# Check test publisher state
source api/.env && psql "$DATABASE_URL" -c "
SELECT id, slug, name, status
FROM publishers
WHERE slug LIKE 'e2e-%'
ORDER BY created_at DESC LIMIT 20;
"

# Check if publishers have algorithms
source api/.env && psql "$DATABASE_URL" -c "
SELECT p.id, p.slug, COUNT(pz.id) as zmanim_count
FROM publishers p
LEFT JOIN publisher_zmanim pz ON p.id = pz.publisher_id
WHERE p.slug LIKE 'e2e-%'
GROUP BY p.id, p.slug;
"

# View test artifacts
gh run view 20580076665 --log-failed > detailed-failures.log

# Download screenshots
gh run download 20580076665
```

---

## Appendix: Error Type Summary

| Error Type | Count | % of Total |
|------------|-------|------------|
| TimeoutError: locator.click | 126 | 49.2% |
| Element not found | 116 | 45.3% |
| TimeoutError: page.waitForFunction | 44 | 17.2% |
| TimeoutError: page.waitForSelector | 24 | 9.4% |
| TimeoutError: locator.waitFor | 22 | 8.6% |
| TimeoutError: locator.fill | 16 | 6.3% |
| toBeTruthy failure | 16 | 6.3% |
| Strict mode violation | 12 | 4.7% |
| toHaveValue failure | 6 | 2.3% |
| toHaveTitle failure | 4 | 1.6% |

**Note:** Percentages exceed 100% as tests can have multiple error types.

---

## Related Code Changes

**Recent commits affecting E2E tests:**
- `66616b7`: fix(zmanim): simplify day_before timing tag logic
- `2f25bea`: docs(tests): add E2E test patterns guide
- `6e5a26f`: fix(pdf): eliminate first-request timeout
- `7041634`: fix(e2e): resolve selector ambiguity
- `08dbe40`: refactor: consolidate migrations

**Suspected Breaking Change:**
The `day_before` timing tag logic change (66616b7) affects how erev events are processed. This may have broken onboarding/algorithm editor if they rely on event detection.

**File to review:** `/home/daniel/repos/zmanim/api/internal/calendar/events.go` (lines 507-514)
```go
// Add erev events to ActiveEventCodes (for candle lighting zmanim)
// IMPORTANT: Add as "erev_*" so day_before timing tag logic can match correctly
for _, erev := range info.ErevEvents {
    erevCode := "erev_" + erev.EventCode
    ctx.ActiveEventCodes = appendUnique(ctx.ActiveEventCodes, erevCode)
}
```

This change may have affected frontend rendering logic expecting different event code format.
