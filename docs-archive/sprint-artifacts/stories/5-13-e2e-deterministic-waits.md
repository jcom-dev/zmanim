# Story 5.13: E2E Deterministic Waits

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** backlog
**Priority:** P1
**Story Points:** 5
**Dependencies:** None (can start immediately)

---

## Story

As a **developer**,
I want **all waitForTimeout calls replaced with deterministic wait conditions**,
So that **E2E tests are reliable, faster, and don't have false failures due to timing issues**.

---

## Problem Statement

The current test suite has **52 instances** of `waitForTimeout()` in E2E tests. This causes:

1. **Flaky tests** - Fixed timeouts may be too short (failures) or too long (slow)
2. **CI instability** - Different machine speeds cause random failures
3. **Slow test runs** - Arbitrary waits (500ms, 1000ms) add up across 52 instances
4. **Hard to debug** - When tests fail, unclear if it's timing or real bug
5. **False confidence** - Tests pass locally, fail in CI (or vice versa)

**Reference:** [docs/coding-standards.md](../../coding-standards.md#assertions) and [tests/TESTING.md](../../tests/TESTING.md)

---

## Acceptance Criteria

### AC-5.13.1: Zero waitForTimeout Calls
- [ ] `grep -r "waitForTimeout" tests/e2e --include="*.ts" | wc -l` returns 0
- [ ] All waits use Playwright's built-in deterministic methods
- [ ] No arbitrary `page.waitForTimeout(N)` calls

### AC-5.13.2: Network State Waits
- [ ] Page load waits use `await page.waitForLoadState('networkidle')`
- [ ] API calls wait for specific network responses when needed
- [ ] Form submissions wait for success indicators

### AC-5.13.3: Element State Waits
- [ ] Element visibility: `await expect(element).toBeVisible()`
- [ ] Element enabled: `await expect(element).toBeEnabled()`
- [ ] Element text: `await expect(element).toHaveText('...')`
- [ ] Element count: `await expect(elements).toHaveCount(N)`

### AC-5.13.4: URL/Navigation Waits
- [ ] URL changes: `await page.waitForURL('**/path')`
- [ ] Navigation: `await page.waitForNavigation()`
- [ ] Redirect handling: `await page.waitForURL('**/expected-path')`

### AC-5.13.5: Custom Wait Conditions
- [ ] Complex waits use `page.waitForFunction()`
- [ ] API response waits use `page.waitForResponse()`
- [ ] Animation waits use element state checks

### AC-5.13.6: Wait Helpers Created
- [ ] `tests/e2e/utils/wait-helpers.ts` updated with reusable patterns
- [ ] Common patterns extracted to helper functions
- [ ] Documentation for each helper

---

## Technical Context

### Current Violation Locations

Run this command to find all violations:
```bash
grep -rn "waitForTimeout" tests/e2e --include="*.ts"
```

### Migration Patterns

**Before (WRONG - Fixed timeout):**
```typescript
await page.click('button[type="submit"]');
await page.waitForTimeout(2000); // Hope 2s is enough
await expect(page.getByText('Success')).toBeVisible();
```

**After (CORRECT - Network idle):**
```typescript
await page.click('button[type="submit"]');
await page.waitForLoadState('networkidle');
await expect(page.getByText('Success')).toBeVisible();
```

**After (CORRECT - Wait for response):**
```typescript
await Promise.all([
  page.waitForResponse(resp => resp.url().includes('/api/v1/publisher')),
  page.click('button[type="submit"]'),
]);
await expect(page.getByText('Success')).toBeVisible();
```

**After (CORRECT - Element state):**
```typescript
await page.click('button[type="submit"]');
// Playwright auto-waits for element, but we can be explicit:
await expect(page.getByText('Success')).toBeVisible({ timeout: 10000 });
```

### Common Replacement Patterns

| Pattern | Instead of waitForTimeout | Use |
|---------|---------------------------|-----|
| Page load | `waitForTimeout(2000)` | `waitForLoadState('networkidle')` |
| Form submit | `waitForTimeout(1000)` | `waitForResponse('/api/...')` |
| Modal open | `waitForTimeout(500)` | `expect(modal).toBeVisible()` |
| Modal close | `waitForTimeout(300)` | `expect(modal).not.toBeVisible()` |
| Navigation | `waitForTimeout(1500)` | `waitForURL('**/new-path')` |
| Animation | `waitForTimeout(500)` | `waitForFunction()` or skip |
| Data fetch | `waitForTimeout(2000)` | `waitForResponse()` or `toBeVisible()` |
| Debounce | `waitForTimeout(300)` | `waitForResponse()` after debounce |

### Wait Helper Functions

**File: `tests/e2e/utils/wait-helpers.ts`**
```typescript
import { Page, expect } from '@playwright/test';

/**
 * Wait for page to be fully loaded (all network requests complete)
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for API response and return the response data
 */
export async function waitForApiResponse<T>(
  page: Page,
  urlPattern: string | RegExp,
  action: () => Promise<void>
): Promise<T> {
  const [response] = await Promise.all([
    page.waitForResponse(resp => {
      const url = resp.url();
      return typeof urlPattern === 'string'
        ? url.includes(urlPattern)
        : urlPattern.test(url);
    }),
    action(),
  ]);
  return response.json();
}

/**
 * Wait for navigation to complete
 */
export async function waitForNavigation(page: Page, urlPattern: string) {
  await page.waitForURL(`**${urlPattern}`);
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for element to appear and be stable
 */
export async function waitForElement(page: Page, selector: string) {
  const element = page.locator(selector);
  await expect(element).toBeVisible();
  return element;
}

/**
 * Wait for toast notification to appear
 */
export async function waitForToast(page: Page, text: string) {
  const toast = page.getByText(text);
  await expect(toast).toBeVisible({ timeout: 5000 });
}

/**
 * Wait for loading spinner to disappear
 */
export async function waitForLoadingComplete(page: Page) {
  const spinner = page.locator('[data-testid="loading-spinner"], .animate-spin');
  await expect(spinner).not.toBeVisible({ timeout: 10000 });
}

/**
 * Wait for table/list data to load
 */
export async function waitForDataLoad(page: Page, tableSelector: string, minRows = 1) {
  const rows = page.locator(`${tableSelector} tbody tr`);
  await expect(rows).toHaveCount(minRows, { timeout: 10000 });
}
```

---

## Tasks / Subtasks

- [ ] Task 1: Audit and Categorize
  - [ ] 1.1 Run grep to list all waitForTimeout instances
  - [ ] 1.2 Categorize by wait reason (network, element, animation)
  - [ ] 1.3 Identify patterns that can use shared helpers
  - [ ] 1.4 Flag complex cases needing custom solutions

- [ ] Task 2: Update Wait Helpers
  - [ ] 2.1 Review existing `wait-helpers.ts`
  - [ ] 2.2 Add new helper functions as needed
  - [ ] 2.3 Add JSDoc comments for each helper
  - [ ] 2.4 Export helpers from `utils/index.ts`

- [ ] Task 3: Migrate Authentication Tests
  - [ ] 3.1 Update `auth/authentication.spec.ts`
  - [ ] 3.2 Replace login flow waits
  - [ ] 3.3 Replace redirect waits

- [ ] Task 4: Migrate Publisher Tests
  - [ ] 4.1 Update `publisher/dashboard.spec.ts`
  - [ ] 4.2 Update `publisher/algorithm-editor.spec.ts`
  - [ ] 4.3 Update `publisher/coverage.spec.ts`
  - [ ] 4.4 Update `publisher/team.spec.ts`
  - [ ] 4.5 Update `publisher/onboarding.spec.ts`

- [ ] Task 5: Migrate Admin Tests
  - [ ] 5.1 Update `admin/dashboard.spec.ts`
  - [ ] 5.2 Update `admin/publishers.spec.ts`
  - [ ] 5.3 Update `admin/impersonation.spec.ts`

- [ ] Task 6: Migrate Public Page Tests
  - [ ] 6.1 Update `public/public-pages.spec.ts`
  - [ ] 6.2 Update homepage tests
  - [ ] 6.3 Update zmanim display tests

- [ ] Task 7: Verification
  - [ ] 7.1 Run violation check (should return 0)
  - [ ] 7.2 Run full test suite: `npx playwright test`
  - [ ] 7.3 Run tests 3x to check for flakiness
  - [ ] 7.4 Compare test run times before/after
  - [ ] 7.5 Run tests in CI environment

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Zero waitForTimeout calls in tests/e2e
- [ ] All tests pass locally
- [ ] Tests pass 3 consecutive runs (no flakiness)
- [ ] CI tests pass
- [ ] Test run time not significantly increased

---

## Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `tests/e2e/utils/wait-helpers.ts` | Modify | Add helper functions |
| `tests/e2e/utils/index.ts` | Modify | Export helpers |
| `tests/e2e/auth/*.spec.ts` | Modify | Replace waits |
| `tests/e2e/publisher/*.spec.ts` | Modify | Replace waits |
| `tests/e2e/admin/*.spec.ts` | Modify | Replace waits |
| `tests/e2e/public/*.spec.ts` | Modify | Replace waits |

---

## Testing Strategy

1. **Lint Check** - Grep returns 0 violations
2. **Local Run** - All tests pass locally
3. **Flakiness Check** - Run 3x in a row, all pass
4. **CI Run** - Tests pass in CI environment
5. **Performance** - Test run time comparison

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Tests become slower | Use `networkidle` wisely, prefer element waits |
| New flakiness | Add explicit timeouts to expect() calls |
| Complex scenarios | Use waitForFunction() for edge cases |
| CI differences | Test in CI early, adjust timeouts if needed |

---

## Notes

- This story addresses HIGH priority technical debt per test standards
- Focus on correctness over speed (reliable tests > fast tests)
- Some waits may need larger explicit timeouts than Playwright default (5s)
- Consider adding `timeout` option to expect() for slow operations
- Document any cases where waitForTimeout is truly unavoidable (should be ~0)
