# Shtetl Zmanim Testing Guide

This guide covers how to run, write, and maintain tests for Shtetl Zmanim.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Playwright MCP Integration](#playwright-mcp-integration)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

---

## Overview

Shtetl Zmanim uses **Playwright** for end-to-end (E2E) testing. The test infrastructure supports:

- **Standard Playwright tests** - Run via CLI or VS Code extension
- **Playwright MCP** - AI-assisted testing via Model Context Protocol
- **Multiple browsers** - Chromium (default) + mobile viewports
- **Visual regression** - Screenshots on failure
- **Trace recording** - Debug failed tests with full trace

### Test Types

| Type | Location | Purpose |
|------|----------|---------|
| E2E Tests | `tests/e2e/*.spec.ts` | Full user flow testing |
| Legacy POC Tests | `web/tests/*.spec.ts` | Original POC tests (deprecated) |

---

## Quick Start

### Prerequisites

1. **Node.js 20+** installed
2. **Application running** on `http://localhost:3001` (web) and `http://localhost:8080` (API)

### Install Dependencies

```bash
cd tests
npm install

# Install Playwright browsers (first time only)
npx playwright install chromium
```

### Run All Tests (Desktop Only - Fastest ~2.5 min)

```bash
cd tests

# Clean previous auth state (recommended for fresh runs)
rm -rf test-results/.auth

# Run tests
npx playwright test
```

### Run All Tests Including Mobile (~7-9 min)

```bash
cd tests

# Clean previous auth state
rm -rf test-results/.auth

# Run with mobile viewports
INCLUDE_MOBILE=true npx playwright test
```

### Run Tests in UI Mode

```bash
npx playwright test --ui
```

### Fresh Start (If Tests Fail with Auth Errors)

If you see auth-related errors like "already signed in" or storage state issues:

```bash
cd tests

# Full clean - removes all test artifacts
rm -rf test-results/

# Run fresh
npx playwright test
```

---

## Test Execution Order

Tests run automatically in this order:

1. **Setup project** - Creates admin & publisher auth (signs in once)
2. **chromium-admin** - Admin tests (uses admin auth storage)
3. **chromium-publisher** - Publisher tests (uses publisher auth storage)
4. **chromium** - Public/unauthenticated tests
5. **mobile-*** - Mobile versions (only if `INCLUDE_MOBILE=true`)

### Services Required

Make sure these are running before tests:
- Web app: `http://localhost:3001`
- API: `http://localhost:8080`

Verify with:
```bash
curl http://localhost:3001  # Should return HTML
curl http://localhost:8080/health  # Should return OK
```

---

## Authentication Strategy (Avoiding Rate Limits)

Clerk enforces a rate limit of **5 sign-ins per 10 seconds per IP**. To avoid hitting this limit during parallel testing, we use **Playwright Storage State**:

### How It Works

1. **Setup Projects** - Sign in ONCE per role (admin, publisher) during global setup
2. **Storage State Files** - Save cookies, localStorage, sessionStorage to JSON files
3. **Project Dependencies** - Test projects depend on setup and reuse pre-authenticated state

```
┌──────────────────────┐
│    Setup Project     │  Signs in as admin and publisher ONCE
└──────────┬───────────┘
           │ Creates storage state files:
           │   • test-results/.auth/admin.json
           │   • test-results/.auth/publisher.json
           ▼
┌──────────────────────────────────────────────────┐
│        Test Projects (all run in parallel)        │
├──────────────────────────────────────────────────┤
│ chromium-admin         Uses admin.json           │
│ chromium-publisher     Uses publisher.json       │
│ chromium               No auth (public pages)    │
│ mobile-chrome-admin    Uses admin.json           │
│ mobile-chrome-publisher Uses publisher.json      │
│ mobile-chrome          No auth (public pages)    │
└──────────────────────────────────────────────────┘
```

### Test File Organization

| Directory | Project Used | Auth State |
|-----------|--------------|------------|
| `e2e/admin/*.spec.ts` | `chromium-admin`, `mobile-chrome-admin` | Pre-authenticated as admin |
| `e2e/publisher/*.spec.ts` | `chromium-publisher`, `mobile-chrome-publisher` | Pre-authenticated as publisher |
| Other `e2e/*.spec.ts` | `chromium`, `mobile-chrome` | No auth (public pages) |

### Benefits

- **No rate limiting** - Only 2 Clerk sign-ins per entire test run
- **Faster tests** - No authentication overhead per test
- **Parallel safe** - All workers share the same auth state files

### Writing Authenticated Tests

For **admin tests** in `e2e/admin/`:
```typescript
import { test, expect } from '@playwright/test';
import { getSharedPublisherAsync, BASE_URL } from '../utils';

// No need to call loginAsAdmin() - storage state handles it
test('admin can view publishers', async ({ page }) => {
  await page.goto(`${BASE_URL}/admin/publishers`);
  await expect(page).toHaveURL(/\/admin\/publishers/);
});
```

For **publisher tests** in `e2e/publisher/`:
```typescript
import { test, expect } from '@playwright/test';
import { BASE_URL } from '../utils';

// No need to call loginAsPublisher() - storage state handles it
test('publisher can view dashboard', async ({ page }) => {
  await page.goto(`${BASE_URL}/publisher/dashboard`);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
```

---

## Test Structure

```
tests/
├── playwright.config.ts      # Playwright configuration
├── package.json              # Test dependencies
├── e2e/                      # E2E test specs
│   ├── setup/                # Auth setup projects
│   │   ├── auth.setup.ts     # Creates storage state files
│   │   ├── global-setup.ts   # Database seeding
│   │   └── global-teardown.ts
│   ├── admin/                # Admin tests (use admin storage state)
│   │   └── impersonation.spec.ts
│   ├── publisher/            # Publisher tests (use publisher storage state)
│   │   ├── dashboard.spec.ts
│   │   ├── profile.spec.ts
│   │   └── algorithm.spec.ts
│   ├── public/               # Public page tests (no auth)
│   ├── utils/                # Test utilities
│   │   ├── shared-fixtures.ts # Pre-created publishers
│   │   ├── clerk-auth.ts     # Clerk auth helpers
│   │   └── index.ts          # Exports
│   └── helpers/              # MCP helpers
│       └── mcp-playwright.ts
└── test-results/             # Test output (gitignored)
    ├── .auth/                # Storage state files
    │   ├── admin.json
    │   └── publisher.json
    ├── html-report/          # HTML test report
    ├── results.json          # JSON results
    └── artifacts/            # Screenshots, videos, traces
```

---

## Running Tests

### Command Reference

| Command | Description |
|---------|-------------|
| `npx playwright test` | Run all tests |
| `npx playwright test home.spec.ts` | Run specific test file |
| `npx playwright test --grep "sign-in"` | Run tests matching pattern |
| `npx playwright test --ui` | Open interactive UI mode |
| `npx playwright test --headed` | Run with visible browser |
| `npx playwright test --debug` | Debug mode with inspector |
| `npx playwright test --project=chromium` | Run on specific browser |
| `npx playwright test --project=mobile-chrome` | Run mobile tests |
| `npx playwright show-report` | Open HTML report |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3001` | Application URL |
| `CI` | - | Set in CI environments |
| `INCLUDE_MOBILE` | - | Set to `true` to run mobile viewport tests |
| `PLAYWRIGHT_MCP` | - | Set when using MCP server |

### Running with Application

**Option 1: Start app manually (recommended for development)**

```bash
# Terminal 1: Start web app
cd web && npm run dev

# Terminal 2: Start API
cd api && go run ./cmd/api

# Terminal 3: Run tests
cd tests && npx playwright test
```

**Option 2: Let Playwright start the app**

```bash
cd tests
npx playwright test
# Playwright will automatically start the web server
```

**Option 3: Using Coder environment**

```bash
# Services already running via tmux
cd tests && npx playwright test
```

---

## Writing Tests

### Test File Structure

Create new test files in `tests/e2e/` with the `.spec.ts` extension:

```typescript
import { test, expect } from '@playwright/test';
import { pages, selectors, TIMEOUTS } from './helpers/mcp-playwright';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto(pages.home);
    await page.waitForLoadState('networkidle');
  });

  test('should do something', async ({ page }) => {
    // Test implementation
    await expect(page.locator('h1')).toBeVisible();
  });
});
```

### Using MCP Helpers

The `helpers/mcp-playwright.ts` module provides:

```typescript
import { pages, selectors, TIMEOUTS, testData } from './helpers/mcp-playwright';

// Pre-defined page URLs
await page.goto(pages.home);        // http://localhost:3001/
await page.goto(pages.signIn);      // http://localhost:3001/sign-in
await page.goto(pages.publisher);   // http://localhost:3001/publisher/dashboard

// Common selectors
const heading = page.getByText(selectors.home.title);

// Timeouts
await expect(element).toBeVisible({ timeout: TIMEOUTS.MEDIUM });

// Test data generators
const email = testData.randomEmail(); // test-1234567890-abc@example.com
```

### Best Practices

1. **Use semantic locators**
   ```typescript
   // Good - resilient to UI changes
   page.getByRole('button', { name: 'Sign In' })
   page.getByLabel('Email')
   page.getByText('Welcome')

   // Avoid - brittle selectors
   page.locator('.btn-primary')
   page.locator('#submit-btn')
   ```

2. **Wait for network idle**
   ```typescript
   await page.waitForLoadState('networkidle');
   ```

3. **Use test isolation**
   ```typescript
   test.beforeEach(async ({ page }) => {
     await page.goto('/');
   });
   ```

4. **Add descriptive test names**
   ```typescript
   test('should redirect to sign-in when accessing protected route without auth', ...);
   ```

5. **Group related tests**
   ```typescript
   test.describe('Authentication', () => {
     test.describe('Sign In', () => { ... });
     test.describe('Sign Up', () => { ... });
   });
   ```

### Adding New Test Files

1. Create file in `tests/e2e/` with `.spec.ts` extension
2. Import test utilities:
   ```typescript
   import { test, expect } from '@playwright/test';
   import { pages, TIMEOUTS } from './helpers/mcp-playwright';
   ```
3. Write tests following the patterns above
4. Run to verify: `npx playwright test your-new-file.spec.ts`

---

## Playwright MCP Integration

Shtetl Zmanim supports AI-assisted testing via the Playwright MCP server.

### What is Playwright MCP?

The Model Context Protocol (MCP) allows AI assistants (like Claude) to interact with Playwright directly, enabling:

- AI-driven test exploration
- Automated test generation
- Visual debugging with snapshots
- Interactive test development

### MCP Helper Interface

The `mcp-playwright.ts` helper defines the MCP server interface:

```typescript
interface MCPPlaywrightServer {
  navigate: (url: string) => Promise<void>;
  snapshot: () => Promise<string>;
  click: (element: string, ref: string) => Promise<void>;
  type: (element: string, ref: string, text: string, submit?: boolean) => Promise<void>;
  screenshot: (options?: ScreenshotOptions) => Promise<string>;
  waitFor: (options: WaitForOptions) => Promise<void>;
  close: () => Promise<void>;
}
```

### Using with Claude Code

When using Claude Code with Playwright MCP server:

1. The MCP server manages browser instances
2. Use `PLAYWRIGHT_MCP=true` to skip webServer config
3. Claude can run tests and capture snapshots interactively

Example workflow:
```
User: "Test the sign-in flow"
Claude: [Uses MCP to navigate, fill forms, and verify results]
```

---

## CI/CD Integration

E2E tests run in GitHub Actions with a full local stack including:

- **PostgreSQL 17 + PostGIS** - Database with spatial extensions (`postgis/postgis:17-3.5`)
- **Redis 7** - Required for caching (`redis:7-alpine`)
- **Go API** - Backend server (port 8080)
- **Next.js Web** - Frontend application (port 3001)
- **Clerk** - Authentication via testing token (external service)

### Required GitHub Secrets

Configure these secrets in your repository settings:

| Secret | Description | How to Obtain |
|--------|-------------|---------------|
| `CLERK_SECRET_KEY` | Clerk API secret key | [Clerk Dashboard](https://dashboard.clerk.com) → API Keys |
| `CLERK_JWKS_URL` | Clerk JWKS URL for JWT verification | Clerk Dashboard → JWT Templates |
| `CLERK_ISSUER` | Clerk issuer URL | Clerk Dashboard → JWT Templates |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Clerk Dashboard → API Keys |
| `MAILSLURP_API_KEY` | MailSlurp API key for email testing | [MailSlurp](https://app.mailslurp.com) |

**Note:** Create a separate Clerk "Test" application for CI/CD to avoid polluting production data.

### Workflow Files

| Workflow | File | Description |
|----------|------|-------------|
| CI | `.github/workflows/ci.yml` | Linting, type-checking, unit tests, build |
| E2E | `.github/workflows/e2e.yml` | Full E2E tests with local services |

### E2E Workflow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions Runner                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐                        │
│  │ PostgreSQL  │    │   Redis     │                        │
│  │17 + PostGIS │    │   7-alpine  │                        │
│  │  :5432      │    │   :6379     │                        │
│  └─────────────┘    └─────────────┘                        │
│         │                  │                                │
│         └──────────┬───────┘                                │
│                    │                                        │
│              ┌─────┴─────┐                                  │
│              │  Go API   │                                  │
│              │   :8080   │                                  │
│              └─────┬─────┘                                  │
│                    │                                        │
│              ┌─────┴─────┐                                  │
│              │ Next.js   │                                  │
│              │   :3001   │                                  │
│              └─────┬─────┘                                  │
│                    │                                        │
│              ┌─────┴─────┐    ┌─────────────┐              │
│              │Playwright │────│   Clerk     │              │
│              │  Tests    │    │ (External)  │              │
│              └───────────┘    └─────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Running Tests Locally (Simulating CI)

To test the CI environment locally:

```bash
# Start PostgreSQL and Redis (Docker)
docker run -d --name pg-test -p 5432:5432 \
  -e POSTGRES_USER=zmanim_test \
  -e POSTGRES_PASSWORD=zmanim_test_password \
  -e POSTGRES_DB=zmanim_test \
  postgres:17

docker run -d --name redis-test -p 6379:6379 redis:7-alpine

# Run migrations
for f in db/migrations/*.sql; do
  psql postgresql://zmanim_test:zmanim_test_password@localhost:5432/zmanim_test -f "$f"
done

# Start services
cd api && go run ./cmd/api &
cd web && npm run build && npm start &

# Run tests
cd tests && npx playwright test
```

### Viewing Test Results

After CI runs, download artifacts:

1. Go to the GitHub Actions run
2. Scroll to "Artifacts"
3. Download `playwright-report` for full HTML report
4. Download `test-screenshots` for failure screenshots (if any)

---

## Troubleshooting

### Common Issues

**Tests timeout waiting for server**

```bash
# Ensure app is running first
curl http://localhost:3001  # Should return HTML
curl http://localhost:8080/health  # Should return OK
```

**Browser not found**

```bash
cd tests
npx playwright install chromium
```

**Tests pass locally but fail in CI**

- Check `CI=true` environment variable
- Verify all services are fully started before tests run
- Increase timeouts if needed

**Clerk Rate Limiting (429 Too Many Requests)**

If you see `Too Many Requests` errors:
1. Tests in `e2e/admin/` and `e2e/publisher/` should NOT call `loginAsAdmin()` or `loginAsPublisher()`
2. These tests use pre-authenticated storage state from the setup project
3. Only tests in other directories should manually authenticate
4. Check that tests are running with correct project (`chromium-admin`, `chromium-publisher`)

**Element not found**

```typescript
// Add explicit wait
await page.waitForSelector('button:has-text("Submit")');

// Or use Playwright's auto-waiting with expect
await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
```

### Debug Mode

```bash
# Run with debugger
npx playwright test --debug

# Run headed (visible browser)
npx playwright test --headed

# Generate trace for all tests
npx playwright test --trace on
```

### View Test Report

```bash
npx playwright show-report test-results/html-report
```

---

## Test Coverage by Feature

| Feature | Test File | Status |
|---------|-----------|--------|
| Home Page | `home.spec.ts` | ✅ Complete |
| Authentication | `auth.spec.ts`, `auth/authentication.spec.ts` | ✅ Complete |
| Publisher Dashboard | `publisher/dashboard.spec.ts` | ✅ Complete |
| Publisher Profile | `publisher/profile.spec.ts` | ✅ Complete |
| Publisher Onboarding | `publisher/onboarding.spec.ts` | ✅ Complete |
| Algorithm Editor | `publisher/algorithm.spec.ts`, `algorithm-editor.spec.ts` | ✅ Complete |
| Coverage Management | `publisher/coverage.spec.ts` | ✅ Complete |
| Team Management | `publisher/team.spec.ts` | ✅ Complete |
| Admin Dashboard | `admin.spec.ts` | ✅ Complete |
| Admin Impersonation | `admin/impersonation.spec.ts` | ✅ Complete |
| Error Handling | `errors/*.spec.ts` | ✅ Complete |
| Public Pages | `public/public-pages.spec.ts` | ✅ Complete |
| Registration Flow | `registration/*.spec.ts` | ✅ Complete |
| Email Flows | `email/invitation-flows.spec.ts` | ✅ Complete |

---

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright MCP](https://github.com/anthropics/anthropic-mcp/tree/main/playwright)
- [Locator API](https://playwright.dev/docs/locators)
- [Assertions](https://playwright.dev/docs/test-assertions)
