# E2E Testing Instructions - Shtetl Zmanim

**Purpose:** Complete guide to running E2E tests without "faffing around with environment variables"
**Status:** Production-ready
**Last Updated:** 2025-11-29

---

## Quick Start (TL;DR)

```bash
# From project root - just run this
cd tests && npx playwright test
```

That's it. Environment variables are auto-loaded from `.env` files.

---

## Prerequisites

### 1. Required Services Running

```bash
# Check if services are running
tmux ls

# If not running, start them:
# Terminal 1: API Server
cd api && go run cmd/api/main.go

# Terminal 2: Web App
cd web && npm run dev
```

### 2. Required Environment Variables

These are already configured in `tests/.env` and `web/.env.local`:

| Variable | Location | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | `tests/.env` | PostgreSQL connection |
| `CLERK_SECRET_KEY` | `tests/.env` | Clerk backend auth |
| `MAILSLURP_API_KEY` | `tests/.env` | Email testing (optional) |
| `BASE_URL` | `tests/.env` | Web app URL (default: localhost:3001) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `web/.env.local` | Clerk frontend auth |

**No manual setup needed** - the test runner loads these automatically via `dotenvx`.

---

## Running Tests

### Run All Tests
```bash
cd tests
npx playwright test
```

### Run Specific Test File
```bash
npx playwright test e2e/publisher/team.spec.ts
```

### Run Tests by Pattern
```bash
# All publisher tests
npx playwright test e2e/publisher/

# All admin tests
npx playwright test e2e/admin/

# Tests matching a name
npx playwright test -g "can access dashboard"
```

### Run Single Test (Debug)
```bash
npx playwright test e2e/publisher/team.spec.ts -g "can access team page"
```

### Run with UI (Interactive)
```bash
npx playwright test --ui
```

### Run Headed (See Browser)
```bash
npx playwright test --headed
```

### Debug Mode
```bash
npx playwright test --debug
```

---

## Test Output

### Default Reporters
- **List**: Console output showing pass/fail
- **HTML Report**: `tests/test-results/html-report/`
- **JSON Report**: `tests/test-results/results.json`

### View HTML Report
```bash
npx playwright show-report test-results/html-report
```

### View Traces (for failed tests)
```bash
npx playwright show-trace test-results/artifacts/<test-name>/trace.zip
```

---

## Test Architecture

### Parallel Execution
All tests run in parallel by default. The configuration:
- **CI**: 4 workers
- **Local**: 50% of CPU cores

### Shared Fixtures
Tests use pre-created publishers from `shared-fixtures.ts`:

| Key | Status | Has Data |
|-----|--------|----------|
| `verified-1` to `verified-5` | verified | No |
| `pending` | pending | No |
| `suspended` | suspended | No |
| `with-algorithm-1`, `with-algorithm-2` | verified | Algorithm |
| `with-coverage` | verified | Coverage |
| `empty-1` to `empty-3` | verified | No (for onboarding) |

### Using Shared Publishers in Tests
```typescript
import { getSharedPublisher, loginAsPublisher } from '../utils';

test('example test', async ({ page }) => {
  const publisher = getSharedPublisher('verified-1');
  await loginAsPublisher(page, publisher.id);
  // Test logic...
});
```

---

## Troubleshooting

### "Cannot find module" Errors
```bash
cd tests && npm install
```

### "CLERK_SECRET_KEY not set" Error
```bash
# Check .env files exist
ls -la tests/.env
ls -la web/.env.local

# Verify keys are set (should show ***set***)
cd tests && npx dotenvx run -- node -e "console.log(process.env.CLERK_SECRET_KEY ? '***set***' : 'MISSING')"
```

### Tests Timing Out
1. Check if web app is running on correct port:
   ```bash
   curl http://localhost:3001
   ```
2. Check if API is running:
   ```bash
   curl http://localhost:8080/api/v1/health
   ```

### Auth Failures
1. Ensure Clerk keys match (same Clerk app for frontend + backend)
2. Check if test users exist:
   ```bash
   cd tests && npx playwright test e2e/admin/dashboard.spec.ts -g "admin can access"
   ```

### Database Errors
```bash
# Check database connection
cd api && go run cmd/api/main.go
# Should connect without errors

# Reset test data if needed
# (Global setup will recreate shared publishers)
```

---

## CI/CD Integration

### GitHub Actions
The CI workflow is configured in `.github/workflows/ci.yml`:

```yaml
- name: Run E2E Tests
  run: |
    cd tests
    npx playwright install --with-deps
    npx playwright test
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
    BASE_URL: http://localhost:3001
```

### Required CI Secrets
- `DATABASE_URL`
- `CLERK_SECRET_KEY`
- `MAILSLURP_API_KEY` (optional)

---

## Writing New Tests

### Template
```typescript
/**
 * E2E Tests: Feature Name
 *
 * Optimized for parallel execution using shared fixtures.
 */
import { test, expect } from '@playwright/test';
import {
  loginAsPublisher,
  getSharedPublisher,
  BASE_URL,
} from '../utils';

// REQUIRED: Enable parallel mode
test.describe.configure({ mode: 'parallel' });

test.describe('Feature Name - Section', () => {
  test('describes what the test verifies', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
```

### Key Rules
1. **Always use `test.describe.configure({ mode: 'parallel' })`**
2. **Use shared fixtures** - never create/delete publishers in tests
3. **Each test must be independent** - no shared state between tests
4. **Use semantic selectors** - `getByRole`, `getByText`, not CSS classes

---

## Test Categories

| Directory | Purpose | Auth Level |
|-----------|---------|------------|
| `e2e/admin/` | Admin dashboard, publisher management | Admin |
| `e2e/publisher/` | Publisher features (algorithm, coverage, team) | Publisher |
| `e2e/auth/` | Authentication flows, route protection | Mixed |
| `e2e/public/` | Public pages (homepage, sign-in, etc.) | None |

---

## Performance Tips

### Speed Up Local Development
```bash
# Run only one browser
npx playwright test --project=chromium

# Skip mobile tests
npx playwright test --project=chromium

# Run specific file
npx playwright test e2e/publisher/team.spec.ts
```

### Debugging Slow Tests
```bash
# Run with trace always
npx playwright test --trace on

# Run headed to see what's happening
npx playwright test --headed
```

---

## File Reference

| File | Purpose |
|------|---------|
| `tests/playwright.config.ts` | Main Playwright config |
| `tests/e2e/setup/global-setup.ts` | Seeds test data, initializes auth |
| `tests/e2e/setup/global-teardown.ts` | Cleanup after all tests |
| `tests/e2e/utils/shared-fixtures.ts` | Shared publisher pool |
| `tests/e2e/utils/clerk-auth.ts` | Auth helpers (loginAsAdmin, etc.) |
| `tests/e2e/utils/index.ts` | Unified exports |

---

## Common Commands Cheat Sheet

```bash
# Run all tests
npx playwright test

# Run specific file
npx playwright test e2e/publisher/team.spec.ts

# Run by name pattern
npx playwright test -g "can access"

# Interactive UI
npx playwright test --ui

# Debug mode
npx playwright test --debug

# Show report
npx playwright show-report test-results/html-report

# Update snapshots
npx playwright test --update-snapshots

# List all tests without running
npx playwright test --list
```
