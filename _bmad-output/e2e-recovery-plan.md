# E2E Test Recovery Plan

**Date:** 2025-12-30
**Owner:** Daniel + Murat (Test Architect)
**Status:** APPROVED FOR IMPLEMENTATION

---

## Executive Summary

### Current State
- **Tests Remaining:** 68 tests across 9 files
- **Tests Removed:** ~200 tests across 33 files
- **Coverage Loss:** 75%
- **Critical Gap:** Publisher Portal (100% untested)

### Root Causes (Priority Order)
1. **Clerk User Quota** - Hit 100 user limit
2. **Hydration Timing** - CI production builds need longer waits
3. **Selector Brittleness** - UI changed, tests didn't follow
4. **Complex UI State** - Multi-step flows are inherently flaky

### Strategy
**Incremental Reconquest** - Add tests in phases, keeping CI green at each step.

---

## Phase Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 0: Infrastructure Audit (FOUNDATION - DO FIRST)          │
│ - Verify Clerk user count, clean up if needed                  │
│ - Audit data-testid coverage in UI components                  │
│ - Ensure hydration helpers are comprehensive                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Public Pages (NO AUTH - Quick Win)                    │
│ - Public zmanim display pages                                  │
│ - Error pages (404, 500)                                       │
│ - About/help pages                                             │
│ Target: +10-15 tests                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 2: Publisher Dashboard Smoke (HIGH VALUE)                │
│ - Dashboard loads successfully                                 │
│ - Navigation to all sub-pages works                            │
│ - Profile page displays                                        │
│ Target: +8-12 tests                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 3: Publisher Algorithm Core (HIGH VALUE)                 │
│ - Algorithm list loads                                         │
│ - Browse Registry button works                                 │
│ - Basic algorithm viewing                                      │
│ Target: +10-15 tests                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 4: Registry & Coverage (MEDIUM COMPLEXITY)               │
│ - Master registry browsing                                     │
│ - Publisher registry browsing                                  │
│ - Coverage area display                                        │
│ Target: +12-18 tests                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 5: Admin Expansion (MEDIUM VALUE)                        │
│ - Publisher creation flow                                      │
│ - Publisher status changes                                     │
│ - User management basics                                       │
│ Target: +10-15 tests                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 6: Complex Workflows (HIGH RISK)                         │
│ - Algorithm creation/editing                                   │
│ - Version history                                              │
│ - Team management                                              │
│ Target: +15-25 tests (if stable)                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Success Criteria Per Phase

### Green Checkmark Rules
1. **All existing 68 tests must pass** (no regression)
2. **New tests must pass 3 consecutive CI runs**
3. **No flaky tests** (if a test fails once in 3 runs, it's quarantined)
4. **PR must be merged before next phase starts**

### Test Quality Requirements
- Use `waitForClientReady()` before any UI interaction
- Use `data-testid` attributes for element selection (add to UI if missing)
- No arbitrary timeouts (`waitForTimeout`) without justification
- All tests must be independent (no shared state between tests)
- Use shared fixtures for test data (never create users/publishers in tests)

---

## Implementation Patterns

### Required Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { waitForClientReady } from '../utils/hydration-helpers';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/path');
    await waitForClientReady(page);
  });

  test('should do something specific', async ({ page }) => {
    // Arrange
    const element = page.getByTestId('specific-element');

    // Act
    await element.click();

    // Assert
    await expect(page.getByTestId('result')).toBeVisible();
  });
});
```

### Selector Priority (Best to Worst)
1. `data-testid` attributes (most stable)
2. ARIA roles with accessible names
3. Text content (for user-facing elements)
4. CSS classes (last resort, document why)

### Adding data-testid to UI
When tests need a `data-testid` that doesn't exist:
1. Add it to the UI component
2. Commit UI change first
3. Then add the test

---

## Risk Mitigation

### Clerk Quota Issue
- **Current:** ~100 users (at limit)
- **Solution:** Use shared user pool (admin, publisher, user)
- **Fallback:** Clean up old test users if needed:
  ```bash
  # List test users
  curl -X GET "https://api.clerk.com/v1/users" \
    -H "Authorization: Bearer $CLERK_SECRET_KEY" | jq '.[] | select(.email_addresses[0].email_address | contains("e2e"))'
  ```

### Hydration Timing
- Always use `waitForClientReady(page)` after navigation
- Increase CI timeouts for production builds
- Use `waitForElement()` for dynamically loaded content

### Selector Brittleness
- Require `data-testid` for all interacted elements
- Create UI PR first, then test PR
- Use structural selectors (parent > child) when needed

---

## Orchestrator Execution Model

Each phase will be executed by parallel sub-agents using the Sonnet model:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (Opus)                          │
│  - Manages phase transitions                                    │
│  - Validates green CI before next phase                         │
│  - Coordinates sub-agents                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ Agent: Tests  │   │ Agent: UI IDs │   │ Agent: Verify │
│ Write tests   │   │ Add data-     │   │ Run tests     │
│ for features  │   │ testid attrs  │   │ locally first │
└───────────────┘   └───────────────┘   └───────────────┘
```

### Sub-Agent Responsibilities

**Test Writer Agent:**
- Write new test files following patterns
- Use existing fixtures and helpers
- Focus on ONE feature area at a time

**UI Enhancement Agent:**
- Add data-testid attributes to components
- Ensure selectors are stable
- Update INDEX files

**Verification Agent:**
- Run tests locally before PR
- Identify flaky tests
- Suggest fixes for failures

---

## File Locations

### Tests Directory Structure
```
tests/e2e/
├── admin/           # Admin portal tests
├── publisher/       # Publisher portal tests (PRIORITY)
├── public/          # Public pages tests (Phase 1)
├── registration/    # Auth flow tests
├── search/          # Search API tests
├── user/            # User-facing tests
├── setup/           # Global setup/teardown
└── utils/           # Helpers and fixtures
```

### Key Files to Know
- `playwright.config.ts` - Test configuration
- `setup/global-setup.ts` - Database seeding
- `setup/auth.setup.ts` - Clerk authentication
- `utils/hydration-helpers.ts` - Wait helpers
- `utils/shared-fixtures.ts` - Test data
- `utils/shared-users.ts` - User pool

---

## Estimated Timeline

| Phase | Tests | Effort | Cumulative Total |
|-------|-------|--------|------------------|
| 0: Infrastructure | 0 | Audit only | 68 |
| 1: Public Pages | +12 | Low | 80 |
| 2: Publisher Dashboard | +10 | Medium | 90 |
| 3: Algorithm Core | +12 | Medium | 102 |
| 4: Registry & Coverage | +15 | Medium | 117 |
| 5: Admin Expansion | +12 | Medium | 129 |
| 6: Complex Workflows | +20 | High | 149 |

**Target:** 149 tests (120% of current, 55% of original ~270)

---

## Definition of Done

### Per Test
- [ ] Uses `waitForClientReady()` after navigation
- [ ] Uses `data-testid` for element selection
- [ ] Independent (no shared state)
- [ ] Passes 3 consecutive local runs
- [ ] Passes CI

### Per Phase
- [ ] All tests in phase pass CI
- [ ] No regression in existing tests
- [ ] PR approved and merged
- [ ] Documentation updated

### Overall
- [ ] Test count >= 120 (minimum viable)
- [ ] All auth projects covered (admin, publisher, public)
- [ ] CI passes consistently (3+ green runs)
- [ ] Coverage gaps documented for manual testing

---

## Next Steps

1. **Run Phase 0 audit** (Infrastructure check)
2. **Create Phase 1 tests** (Public pages - no auth)
3. **Iterate**: Green CI → Next phase → Repeat

---

*Generated by Murat (Test Architect) for Daniel*
*BMAD Framework v6.0.0*
