# E2E Testing Plan for Shtetl Zmanim Frontend

## Objective
Create comprehensive E2E tests covering all frontend features with proper authentication, impersonation, and full UX flows to catch bugs and ensure quality.

## Current State

### Existing Infrastructure
- **Playwright** is already configured in `tests/playwright.config.ts`
- **Clerk auth helpers** exist in `tests/e2e/utils/clerk-auth.ts`
- **Database fixtures** exist in `tests/e2e/utils/test-fixtures.ts`
- **Global setup/teardown** in `tests/e2e/setup/`
- Some basic algorithm tests exist in `tests/e2e/publisher/algorithm.spec.ts`

### Key Files
| File | Purpose |
|------|---------|
| `tests/playwright.config.ts` | Playwright config with 120s timeout, HTML/JSON reporters |
| `tests/e2e/utils/clerk-auth.ts` | `loginAsAdmin()`, `loginAsPublisher()`, `loginAsUser()` helpers |
| `tests/e2e/utils/test-fixtures.ts` | DB fixtures: `createTestPublisherEntity()`, `createTestAlgorithm()`, etc. |
| `tests/e2e/setup/global-setup.ts` | Seeds 3 test publishers (verified, pending, suspended) |

---

## Pages to Test (24 total)

### Admin Pages (4)
- `/admin` - Admin home/redirect
- `/admin/dashboard` - Admin dashboard
- `/admin/publishers` - Publisher management, impersonation
- `/admin/settings` - Admin settings

### Publisher Pages (8)
- `/publisher` - Publisher home/redirect
- `/publisher/dashboard` - Main dashboard
- `/publisher/profile` - Profile editing
- `/publisher/algorithm` - Algorithm editor (DSL formulas)
- `/publisher/coverage` - Geographic coverage management
- `/publisher/team` - Team member management
- `/publisher/analytics` - Analytics dashboard
- `/publisher/activity` - Activity log

### Public Pages (6)
- `/` - Homepage
- `/zmanim/[cityId]` - Zmanim display for city
- `/become-publisher` - Publisher signup flow
- `/accept-invitation` - Team invitation acceptance

### Auth Pages (4)
- `/sign-in` - Sign in
- `/sign-up` - Sign up
- `/sign-out` - Sign out

---

## Test Suites to Create

### 1. Authentication & Authorization Tests
**File:** `tests/e2e/auth/authentication.spec.ts`
- [ ] Sign up flow (new user)
- [ ] Sign in flow (existing user)
- [ ] Sign out flow
- [ ] Protected route access (redirect to sign-in)
- [ ] Role-based access (admin vs publisher vs user)
- [ ] Session persistence across page navigation

### 2. Admin Impersonation Tests
**File:** `tests/e2e/admin/impersonation.spec.ts`
- [ ] Admin can view publisher list
- [ ] Admin can impersonate a publisher
- [ ] Impersonated session shows correct publisher context
- [ ] Admin can exit impersonation
- [ ] Impersonation persists across navigation
- [ ] Cannot impersonate without admin role

### 3. Onboarding Wizard Tests (5 steps)
**File:** `tests/e2e/publisher/onboarding.spec.ts`
- [ ] Step 0: Welcome - displays correctly, can proceed
- [ ] Step 1: Template Selection - can select template, validation
- [ ] Step 2: Customize Zmanim - can modify formulas, preview works
- [ ] Step 3: Coverage Setup - can add cities/regions
- [ ] Step 4: Review & Publish - shows summary, can complete
- [ ] Skip onboarding flow
- [ ] State persistence (refresh retains step)
- [ ] Navigation between steps (back/next)
- [ ] Completed steps indicator

### 4. Publisher Dashboard Tests
**File:** `tests/e2e/publisher/dashboard.spec.ts`
- [ ] Dashboard loads with correct publisher data
- [ ] Quick stats display correctly
- [ ] Navigation to sub-pages works
- [ ] Empty state handling
- [ ] Error state handling

### 5. Algorithm Editor Tests
**File:** `tests/e2e/publisher/algorithm-editor.spec.ts`
- [ ] Editor loads with existing zmanim
- [ ] Can add new custom zman
- [ ] Can edit existing zman formula
- [ ] DSL validation (valid/invalid formulas)
- [ ] Preview panel shows calculated times
- [ ] Save changes persists
- [ ] Can delete custom zman
- [ ] Import from template
- [ ] Undo/redo functionality (if exists)

### 6. Coverage Management Tests
**File:** `tests/e2e/publisher/coverage.spec.ts`
- [ ] Coverage list loads
- [ ] Can search for cities
- [ ] Can add city coverage
- [ ] Can add region coverage
- [ ] Can remove coverage
- [ ] Priority adjustment
- [ ] Map display (if exists)

### 7. Team Management Tests
**File:** `tests/e2e/publisher/team.spec.ts`
- [ ] Team member list loads
- [ ] Can invite new member
- [ ] Invitation email sent (use MailSlurp)
- [ ] Can accept invitation (via `/accept-invitation`)
- [ ] Can remove team member
- [ ] Role permissions

### 8. Profile Management Tests
**File:** `tests/e2e/publisher/profile.spec.ts`
- [ ] Profile form loads with data
- [ ] Can update name/organization
- [ ] Can update email
- [ ] Can upload logo
- [ ] Can update website/bio
- [ ] Validation errors display
- [ ] Changes persist after save

### 9. Public Pages Tests
**File:** `tests/e2e/public/public-pages.spec.ts`
- [ ] Homepage loads
- [ ] Zmanim page loads for valid city
- [ ] Zmanim page 404 for invalid city
- [ ] Become publisher page loads
- [ ] Become publisher form submission

---

## Testing Approach

### Authentication Strategy
1. Use `@clerk/testing/playwright` for programmatic sign-in
2. Create test users with specific roles in global setup
3. Use fixtures to log in as different user types per test

### Test Data Strategy
1. Global setup seeds baseline test data (publishers, algorithms)
2. Each test suite can create additional data via fixtures
3. Global teardown cleans up test users from Clerk

### Recommended Test Structure
```typescript
// Example test file structure
import { test, expect } from '@playwright/test';
import { loginAsPublisher, loginAsAdmin } from '../utils/clerk-auth';
import { createTestPublisherEntity } from '../utils/test-fixtures';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: login, navigate, etc.
  });

  test('should do something', async ({ page }) => {
    // Test implementation
  });
});
```

---

## Priority Order

1. **High Priority** (Critical flows with bugs)
   - Onboarding wizard (full 5-step flow)
   - Algorithm editor (DSL validation, preview)
   - Authentication flows

2. **Medium Priority** (Core features)
   - Publisher dashboard
   - Coverage management
   - Profile management

3. **Lower Priority** (Admin features)
   - Admin impersonation
   - Team management
   - Analytics

---

## Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/publisher/onboarding.spec.ts

# Run with UI mode for debugging
npx playwright test --ui

# Run headed (see browser)
npx playwright test --headed

# Generate test report
npx playwright show-report
```

---

## Environment Requirements

- API server running on `http://localhost:8080`
- Web app running on `http://localhost:3000`
- PostgreSQL database with test data
- Clerk test environment configured
- MailSlurp API key for email testing (optional)

---

## Notes

- Playwright is already the correct choice - it's the industry standard for E2E testing in 2024/2025
- The existing auth helpers are well-structured, just need more comprehensive test coverage
- Focus on catching the bugs user mentioned - especially in onboarding wizard and algorithm editor
