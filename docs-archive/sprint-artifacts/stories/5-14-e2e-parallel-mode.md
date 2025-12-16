# Story 5.14: E2E Parallel Mode

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** backlog
**Priority:** P2
**Story Points:** 3
**Dependencies:** Story 5.13 (deterministic waits should be done first)

---

## Story

As a **developer**,
I want **all E2E test files configured for parallel execution**,
So that **CI test runs are fast and the test suite scales well as more tests are added**.

---

## Problem Statement

Currently **23 out of 29 test files** are missing the parallel mode configuration. This causes:

1. **Slow CI runs** - Tests run sequentially when they could run in parallel
2. **Poor scalability** - Adding more tests linearly increases CI time
3. **Resource waste** - CI machines have multiple cores that go unused
4. **Developer friction** - Long waits for test results

**Reference:** [docs/coding-standards.md](../../coding-standards.md#critical-parallel-test-execution)

---

## Acceptance Criteria

### AC-5.14.1: All Test Files Have Parallel Mode
- [ ] Every `.spec.ts` file has `test.describe.configure({ mode: 'parallel' })`
- [ ] Configuration appears at top of first `test.describe` block
- [ ] No test files are running in serial mode by default

### AC-5.14.2: Shared Fixtures Usage
- [ ] Tests use `getSharedPublisher()` instead of creating publishers
- [ ] No `beforeEach` hooks that create test data
- [ ] No `afterEach` hooks that delete test data
- [ ] Data isolation through fixture pool, not cleanup

### AC-5.14.3: Test Independence
- [ ] Each test can run in any order
- [ ] No test depends on another test's side effects
- [ ] Tests use unique identifiers where needed (timestamps, UUIDs)

### AC-5.14.4: CI Configuration
- [ ] Playwright config has appropriate `workers` setting
- [ ] CI workflow configured for parallel execution
- [ ] Test sharding considered for large suites

---

## Technical Context

### Current Status

Run this command to check parallel mode configuration:
```bash
grep -rL "mode: 'parallel'" tests/e2e --include="*.spec.ts" | wc -l
```

**Files missing parallel mode:** ~23 files

### Required Configuration

**At top of each spec file:**
```typescript
import { test, expect } from '@playwright/test';
import { getSharedPublisher, loginAsPublisher, BASE_URL } from '../utils';

// REQUIRED: Enable parallel mode
test.describe.configure({ mode: 'parallel' });

test.describe('Feature Name', () => {
  test('test case 1', async ({ page }) => {
    // Use shared fixtures, no data creation
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    // Test logic...
  });

  test('test case 2', async ({ page }) => {
    // Each test is independent
    const publisher = getSharedPublisher('verified-2');
    await loginAsPublisher(page, publisher.id);
    // Test logic...
  });
});
```

### Shared Publisher Types Available

| Key | Type | Use Case |
|-----|------|----------|
| `verified-1` through `verified-5` | verified | General tests needing auth |
| `pending` | pending | Testing pending status flows |
| `suspended` | suspended | Testing suspended status flows |
| `with-algorithm-1`, `with-algorithm-2` | verified + algorithm | Algorithm editor tests |
| `with-coverage` | verified + coverage | Coverage page tests |
| `empty-1` through `empty-3` | verified (no data) | Onboarding/empty state tests |

### Anti-Patterns to Fix

**WRONG - Creates data per test (breaks parallelism):**
```typescript
let testPublisher: Publisher;

test.beforeEach(async () => {
  testPublisher = await createTestPublisherEntity({ name: 'Test' });
});

test.afterEach(async () => {
  await cleanupTestData();
});

test('should do something', async ({ page }) => {
  await loginAsPublisher(page, testPublisher.id);
  // ...
});
```

**CORRECT - Uses shared fixtures:**
```typescript
test.describe.configure({ mode: 'parallel' });

test('should do something', async ({ page }) => {
  const publisher = getSharedPublisher('verified-1');
  await loginAsPublisher(page, publisher.id);
  // ...
});
```

### Files to Update

| Priority | File | Current Status |
|----------|------|----------------|
| P1 | `tests/e2e/publisher/dashboard.spec.ts` | Missing parallel |
| P1 | `tests/e2e/publisher/algorithm-editor.spec.ts` | Missing parallel |
| P1 | `tests/e2e/publisher/coverage.spec.ts` | Missing parallel |
| P1 | `tests/e2e/publisher/team.spec.ts` | Has parallel (reference) |
| P2 | `tests/e2e/admin/dashboard.spec.ts` | Missing parallel |
| P2 | `tests/e2e/admin/publishers.spec.ts` | Missing parallel |
| P3 | `tests/e2e/public/public-pages.spec.ts` | Missing parallel |
| P3 | All other spec files | Check each |

---

## Tasks / Subtasks

- [ ] Task 1: Audit Test Files
  - [ ] 1.1 List all spec files
  - [ ] 1.2 Identify files missing `mode: 'parallel'`
  - [ ] 1.3 Identify files with beforeEach/afterEach data creation
  - [ ] 1.4 Document inter-test dependencies

- [ ] Task 2: Update Publisher Tests
  - [ ] 2.1 Add parallel mode to `publisher/dashboard.spec.ts`
  - [ ] 2.2 Add parallel mode to `publisher/algorithm-editor.spec.ts`
  - [ ] 2.3 Add parallel mode to `publisher/coverage.spec.ts`
  - [ ] 2.4 Add parallel mode to `publisher/profile.spec.ts`
  - [ ] 2.5 Migrate to shared fixtures if using data creation

- [ ] Task 3: Update Admin Tests
  - [ ] 3.1 Add parallel mode to `admin/dashboard.spec.ts`
  - [ ] 3.2 Add parallel mode to `admin/publishers.spec.ts`
  - [ ] 3.3 Add parallel mode to `admin/impersonation.spec.ts`
  - [ ] 3.4 Migrate to shared fixtures if needed

- [ ] Task 4: Update Auth Tests
  - [ ] 4.1 Add parallel mode to `auth/authentication.spec.ts`
  - [ ] 4.2 Ensure auth tests don't conflict in parallel

- [ ] Task 5: Update Public Tests
  - [ ] 5.1 Add parallel mode to `public/public-pages.spec.ts`
  - [ ] 5.2 Add parallel mode to homepage tests

- [ ] Task 6: Update Remaining Files
  - [ ] 6.1 Check all other spec files
  - [ ] 6.2 Add parallel mode to any missing files

- [ ] Task 7: Update Playwright Config
  - [ ] 7.1 Set appropriate `workers` count
  - [ ] 7.2 Configure retry strategy for parallel
  - [ ] 7.3 Consider test sharding for CI

- [ ] Task 8: Verification
  - [ ] 8.1 Run tests locally in parallel
  - [ ] 8.2 Run tests 3x to check for flakiness
  - [ ] 8.3 Compare run time before/after
  - [ ] 8.4 Run in CI environment
  - [ ] 8.5 Verify no data conflicts

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] All spec files have `mode: 'parallel'` configured
- [ ] No test files use beforeEach/afterEach for data creation
- [ ] All tests pass locally in parallel
- [ ] Tests pass 3 consecutive runs (no data conflicts)
- [ ] CI tests pass in parallel mode
- [ ] Test run time improved (measured)

---

## Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `tests/e2e/publisher/*.spec.ts` | Modify | Add parallel mode |
| `tests/e2e/admin/*.spec.ts` | Modify | Add parallel mode |
| `tests/e2e/auth/*.spec.ts` | Modify | Add parallel mode |
| `tests/e2e/public/*.spec.ts` | Modify | Add parallel mode |
| `tests/playwright.config.ts` | Modify | Configure workers |

---

## Testing Strategy

1. **Config Check** - Grep for missing parallel mode
2. **Local Parallel Run** - `npx playwright test --workers=4`
3. **Flakiness Check** - Run 3x in a row
4. **CI Run** - Verify parallel execution in CI
5. **Performance** - Measure run time improvement

---

## Expected Performance Improvement

| Metric | Before | After (Target) |
|--------|--------|----------------|
| Local test time | ~5 min | ~2 min |
| CI test time | ~8 min | ~3 min |
| Flakiness rate | ~5% | <1% |
| Worker utilization | 1 core | 4 cores |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Data conflicts | Use shared fixture pool with unique publishers |
| Resource contention | Configure appropriate worker count |
| Test ordering bugs | Each test must be fully independent |
| CI environment limits | Configure workers based on CI resources |

---

## Notes

- This story should be done AFTER Story 5.13 (deterministic waits)
- Parallel mode requires test independence - no shared state
- The shared fixture pool (`getSharedPublisher()`) enables safe parallelism
- If a test truly needs unique data, use timestamp/UUID in TEST_ prefix names
- Consider test sharding for very large test suites in CI
