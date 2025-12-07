# E2E Testing in GitHub Actions - Implementation Plan

## Overview

This document describes the architecture and implementation plan for running end-to-end (E2E) tests in GitHub Actions with a fully local stack, ensuring tests are isolated, reproducible, and don't depend on external production services (except Clerk authentication).

## Goals

1. **Full Local Stack** - Run PostgreSQL, Redis, API, and Web locally in GitHub Actions
2. **Reproducible Tests** - Same environment every time, no shared state between runs
3. **PostgreSQL 17** - Use the latest PostgreSQL from official `postgres` Docker image
4. **Parallel-Safe** - Tests can run in parallel without data conflicts
5. **Fast Feedback** - Run on every PR, not just main branch
6. **Comprehensive Coverage** - Test the full user journey including authentication

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      GitHub Actions Runner                           │
│                         (ubuntu-latest)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌────────────────────┐      ┌────────────────────┐                │
│   │ PostgreSQL 17      │      │    Redis 7         │                │
│   │ (postgis:17-3.5)   │      │  (redis:7-alpine)  │                │
│   │                    │      │                    │                │
│   │  • PostGIS ext     │      │  • Required cache  │                │
│   │  • pg_trgm ext     │      │  • 6379:6379       │                │
│   │  • 5432:5432       │      │                    │                │
│   └─────────┬──────────┘      └─────────┬──────────┘                │
│             │                           │                            │
│             └───────────┬───────────────┘                            │
│                         │                                            │
│                         ▼                                            │
│             ┌────────────────────┐                                   │
│             │     Go API         │                                   │
│             │   (localhost:8080) │                                   │
│             │                    │                                   │
│             │  • Chi router      │                                   │
│             │  • SQLc queries    │                                   │
│             │  • JWT validation  │                                   │
│             └─────────┬──────────┘                                   │
│                       │                                              │
│                       ▼                                              │
│             ┌────────────────────┐                                   │
│             │   Next.js Web      │                                   │
│             │   (localhost:3001) │                                   │
│             │                    │                                   │
│             │  • React 19        │                                   │
│             │  • Clerk auth      │                                   │
│             │  • API client      │                                   │
│             └─────────┬──────────┘                                   │
│                       │                                              │
│                       ▼                                              │
│             ┌────────────────────┐      ┌────────────────────┐      │
│             │   Playwright       │      │      Clerk         │      │
│             │   E2E Tests        │◄────►│   (External API)   │      │
│             │                    │      │                    │      │
│             │  • Chromium        │      │  • Test instance   │      │
│             │  • Mobile Chrome   │      │  • @clerk/testing  │      │
│             └────────────────────┘      └────────────────────┘      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Workflow Files

### 1. Main CI Workflow (`.github/workflows/ci.yml`)

Handles linting, type-checking, unit tests, and builds for both web and API.

**Jobs:**
- `web` - Frontend CI (TypeScript, ESLint, Vitest, Next.js build)
- `api` - Backend CI (Go build, tests, golangci-lint)

### 2. E2E Workflow (`.github/workflows/e2e.yml`)

Dedicated workflow for E2E tests with full service stack.

**Triggers:**
- Pull requests to `main`
- Pushes to `main`
- Manual dispatch (`workflow_dispatch`)

**Services:**
```yaml
services:
  postgres:
    image: postgis/postgis:17-3.5  # PostgreSQL 17 with PostGIS
    env:
      POSTGRES_USER: zmanim_test
      POSTGRES_PASSWORD: zmanim_test_password
      POSTGRES_DB: zmanim_test
    ports:
      - 5432:5432

  redis:
    image: redis:7-alpine  # Required for caching
    ports:
      - 6379:6379
```

## Required GitHub Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `CLERK_SECRET_KEY` | Yes | Clerk API secret key for backend |
| `CLERK_JWKS_URL` | Yes | Clerk JWKS URL for JWT verification |
| `CLERK_ISSUER` | Yes | Clerk issuer URL for JWT validation |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key for frontend |
| `MAILSLURP_API_KEY` | Yes | MailSlurp API key for email testing |

**Recommendation:** Create a dedicated Clerk "Test" application to isolate test users from production.

## Execution Steps

### Step 1: Setup Services
```yaml
services:
  postgres:
    image: postgres:17
    # Health check ensures DB is ready before tests
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

### Step 2: Install Extensions
```bash
# PostGIS for geographic queries
psql -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Trigram for fuzzy search
psql -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

### Step 3: Run Migrations
```bash
for migration in db/migrations/*.sql; do
  psql -f "$migration" || true  # Continue on error (idempotent)
done
```

### Step 4: Build & Start API
```bash
cd api
go build -o ../bin/api ./cmd/api
../bin/api &

# Wait for health check
timeout 30 bash -c 'until curl -sf http://localhost:8080/health; do sleep 1; done'
```

### Step 5: Build & Start Web
```bash
cd web
npm ci
npm run build
npm run start &

# Wait for server
timeout 60 bash -c 'until curl -sf http://localhost:3001; do sleep 1; done'
```

### Step 6: Run Tests
```bash
cd tests
npm ci
npx playwright install chromium --with-deps
npx playwright test --reporter=html,github
```

## Test Data Strategy

### Shared Fixtures
Pre-created publishers in global setup that tests can use:

```typescript
// Available shared publishers
getSharedPublisher('verified-1')   // Active, verified publisher
getSharedPublisher('verified-2')   // Another verified publisher
getSharedPublisher('with-algorithm-1')  // Has algorithm configured
getSharedPublisher('with-coverage')     // Has geographic coverage
getSharedPublisher('pending')      // Pending verification
getSharedPublisher('suspended')    // Suspended account
getEmptyPublisher(1)               // No algorithm (for onboarding tests)
```

### Parallel Safety
- Tests use `test.describe.configure({ mode: 'parallel' })`
- Each test uses different shared fixtures to avoid conflicts
- Tests that create data use unique identifiers (timestamp + random)
- Cleanup happens in `afterAll` hooks, scoped to created data

## Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `DATABASE_URL` | `postgresql://zmanim_test:...@localhost:5432/zmanim_test` | Test database |
| `REDIS_URL` | `redis://localhost:6379` | Cache (required) |
| `PORT` | `8080` | API port |
| `BASE_URL` | `http://localhost:3001` | Web app URL |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | API URL for frontend |
| `ENVIRONMENT` | `test` | Environment mode |

## Artifacts

### On Success
- `playwright-report` - HTML report with test results (14 day retention)

### On Failure
- `playwright-report` - HTML report with failure details
- `test-screenshots` - Screenshots of failed tests (7 day retention)
- Error context files with DOM snapshots

## Concurrency

```yaml
concurrency:
  group: e2e-${{ github.ref }}
  cancel-in-progress: true
```

This ensures:
- Only one E2E run per branch at a time
- New commits cancel in-progress runs
- Saves CI resources and provides faster feedback

## Clerk Authentication in Tests

### How It Works
1. `@clerk/testing/playwright` provides test utilities
2. `clerkSetup()` initializes a testing token in global setup
3. `loginAsPublisher(page, publisherId)` handles authentication flow
4. Test users are created/managed via Clerk API

### Test Authentication Flow
```typescript
// In test file
import { loginAsPublisher, getSharedPublisher } from '../utils';

test('publisher can view dashboard', async ({ page }) => {
  const publisher = getSharedPublisher('verified-1');
  await loginAsPublisher(page, publisher.id);

  await page.goto('/publisher/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
```

## Impersonation Testing

Admin impersonation is a key feature that allows admins to view the platform as a specific publisher.

### How Impersonation Works
1. Admin navigates to `/admin/publishers/{id}`
2. Clicks "Impersonate Publisher" button
3. State stored in `sessionStorage.setItem('impersonating', JSON.stringify({...}))`
4. Redirected to `/publisher/dashboard`
5. Yellow `ImpersonationBanner` displayed with Exit button
6. `PublisherContext` uses impersonated publisher's ID for API calls

### Testing Impersonation
```typescript
test('admin can impersonate publisher', async ({ page }) => {
  await loginAsAdmin(page);
  const publisher = getSharedPublisher('verified-1');

  await page.goto(`/admin/publishers/${publisher.id}`);
  await page.getByRole('button', { name: /impersonate publisher/i }).click();

  // Verify impersonation is active
  await expect(page.getByText(/impersonating/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /exit/i })).toBeVisible();
});
```

## Local Development

To run the same setup locally:

```bash
# Start services
docker run -d --name pg-test -p 5432:5432 \
  -e POSTGRES_USER=zmanim_test \
  -e POSTGRES_PASSWORD=zmanim_test_password \
  -e POSTGRES_DB=zmanim_test \
  postgres:17

docker run -d --name redis-test -p 6379:6379 redis:7-alpine

# Install extensions
docker exec pg-test psql -U zmanim_test -d zmanim_test \
  -c "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_trgm;"

# Run migrations
export DATABASE_URL="postgresql://zmanim_test:zmanim_test_password@localhost:5432/zmanim_test"
for f in db/migrations/*.sql; do psql $DATABASE_URL -f "$f"; done

# Start API
cd api && DATABASE_URL=$DATABASE_URL go run ./cmd/api &

# Start Web
cd web && npm run build && npm start &

# Run tests
cd tests && npx playwright test
```

## Troubleshooting

### Database Connection Errors
- Check PostgreSQL service is healthy
- Verify `DATABASE_URL` includes `?sslmode=disable` for local connections
- Ensure migrations ran successfully

### Clerk Authentication Failures
- Verify all Clerk secrets are configured
- Check Clerk test instance is active
- Ensure `@clerk/testing` is properly initialized

### Timeout Errors
- Increase `timeout-minutes` in workflow
- Check service health before starting tests
- Use `networkidle` wait state for page loads

### Flaky Tests
- Use `page.waitForLoadState('networkidle')` consistently
- Avoid `page.waitForTimeout()` - use explicit waits instead
- Ensure tests use separate shared fixtures

## Future Improvements

1. **Parallel Workers** - Increase Playwright workers for faster execution
2. **Test Sharding** - Split tests across multiple CI jobs
3. **Visual Regression** - Add screenshot comparison tests
4. **Performance Metrics** - Track page load times
5. **Accessibility Testing** - Integrate axe-core for a11y checks
