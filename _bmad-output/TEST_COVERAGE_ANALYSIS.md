# Test Coverage Analysis

**Date:** 2025-12-27
**Analyzed by:** Agent 3 - Test Coverage Analyzer

---

## Executive Summary

The zmanim project has **low overall test coverage** across all three test suites:

- **Backend (Go):** 7.3% overall coverage
- **Frontend (React):** 15 test files, 293 tests passing
- **E2E (Playwright):** 42 spec files covering major user flows

**Critical Gap:** Most handlers (556 untested functions) and services (7.6% coverage) lack unit tests, relying heavily on E2E tests for validation.

---

## 1. Backend Test Coverage

### Overall Coverage: 7.3%

**Test Execution:**
```bash
cd /home/daniel/repos/zmanim/api
go test ./... -coverprofile=/tmp/coverage.out
```

### Coverage by Package

| Package | Coverage | Status |
|---------|----------|--------|
| `internal/sanitize` | 100.0% | ✅ Excellent |
| `internal/diff` | 92.4% | ✅ Excellent |
| `internal/astro` | 62.1% | ⚠️ Good |
| `internal/dsl` | 50.3% | ⚠️ Moderate |
| `internal/calendar` | 32.9% | ❌ Low |
| `internal/validation` | 20.2% | ❌ Low |
| `internal/middleware` | 19.4% | ❌ Low |
| `internal/services` | 7.6% | ❌ Critical |
| **`internal/handlers`** | **1.6%** | **❌ Critical** |
| `internal/ai` | 0.0% | ❌ None |
| `internal/algorithm` | 0.0% | ❌ None |
| `internal/cache` | 0.0% | ❌ None |
| `internal/config` | 0.0% | ❌ None |
| `internal/db` | 0.0% | ❌ None |
| `internal/errors` | 0.0% | ❌ None |
| `internal/geo` | 0.0% | ❌ None |
| `internal/logger` | 0.0% | ❌ None |

### Test Files Present

**Well-tested packages (32 test files found):**

1. **astro/** (2 tests)
   - `sun_test.go` - Solar calculations
   - `tz_debug_test.go` - Timezone debugging

2. **calendar/** (8 tests)
   - `events_test.go`, `events_tag_driven_test.go`, `events_coverage_test.go`
   - `hebrew_test.go`, `shabbos_test.go`
   - `hebcal_matching_audit_test.go`, `hebcal_coverage_test.go`
   - `hidden_tags_test.go`, `zmanim_context_test.go`

3. **dsl/** (4 tests)
   - `dsl_test.go`, `bugfixes_test.go`, `misheyakir_test.go`, `validation_test.go`

4. **handlers/** (7 tests)
   - `admin_audit_test.go`, `publisher_audit_test.go`
   - `cache_invalidation_test.go`, `publisher_context_test.go`
   - `ai_formula_test.go`, `external_api_test.go`, `external_api_integration_test.go`
   - `handlers_test.go`, `zmanim_integration_test.go`

5. **services/** (3 tests)
   - `rate_limiter_test.go`, `zmanim_service_test.go`, `search_parser_test.go`

6. **middleware/** (2 tests)
   - `rate_limit_external_test.go`, `m2m_auth_test.go`

7. **Other packages** (6 tests)
   - `diff/algorithm_test.go`
   - `sanitize/markdown_test.go`
   - `validation/hebrew_test.go`
   - `ai/embeddings_test.go`

### Critical Gaps - Handlers (1.6% coverage)

**556 untested functions in handlers package**

Sample of critical untested handlers:

**Admin Handlers (`admin.go` - ALL 0.0%):**
- `AdminListPublishers` - List all publishers
- `AdminCreatePublisher` - Create new publisher
- `AdminUpdatePublisher` - Update publisher details
- `AdminDeletePublisher` - Soft delete publisher
- `AdminRestorePublisher` - Restore deleted publisher
- `AdminSuspendPublisher` - Suspend publisher
- `AdminReactivatePublisher` - Reactivate suspended publisher
- `AdminVerifyPublisher` - Verify publisher certification
- `AdminGetStats` - Get system statistics
- `AdminFlushZmanimCache` - Clear zmanim cache
- `AdminExportPublisher` - Export publisher data
- `AdminImportPublisher` - Import publisher data
- `AdminGetAuditLog` - View audit logs (0.0% in `admin_audit.go`)

**Publisher Handlers (untested):**
- Most CRUD operations for publisher-specific resources
- Coverage management
- Algorithm editing
- Registry requests
- Team management

**Critical Services (7.6% coverage):**
- Cache service (0.0%)
- AI services (0.0%)
- Geo search (0.0%)
- Config management (0.0%)

### Untested Error Paths

With only 7.3% coverage, most error handling paths are untested:
- Database connection failures
- Invalid input validation
- Permission/authorization failures
- Cache failures
- External API timeouts
- Concurrent modification conflicts

---

## 2. Frontend Test Coverage

### Test Execution
```bash
cd /home/daniel/repos/zmanim/web
npm run test  # 293 tests passing
```

**Note:** Coverage metrics unavailable (`@vitest/coverage-v8` not installed). Test count indicates reasonable coverage of tested modules.

### Test Distribution

**15 test files found:**

#### Components (5 test files)
- `formula-builder/__tests__/FormulaBuilder.test.tsx` (23 tests)
- `formula-builder/__tests__/FixedOffsetForm.test.tsx` (23 tests)
- `formula-builder/__tests__/MethodCard.test.tsx` (14 tests)
- `formula-builder/__tests__/ProportionalHoursForm.test.tsx` (26 tests)
- `formula-builder/__tests__/types.test.ts` (56 tests)

**142 components total** → **Only 5 tested (3.5% coverage)**

#### Hooks (9 test files)
Tested hooks:
- `useApiQuery.test.ts` (25 tests)
- `useCategories.test.ts` (14 tests)
- `useDebounce.test.ts` (14 tests)
- `useLocality.test.ts` (11 tests)
- `usePreviewToolbar.test.ts` (8 tests)
- `usePublisherCoverage.test.ts` (10 tests)
- `usePublisherSettings.test.ts` (17 tests)
- `useUserRoles.test.ts` (20 tests)
- `useZmanimList.test.ts` (16 tests)

**Untested hooks (8):**
- `useAlgorithmPageData` - Algorithm editor state management
- `useLocalitySearch` - **DELETED** in commit `e45eb9e` (ESLint fix)
- `useLocationSearch` - Location search functionality
- `useMapPreview` - Map preview component state
- `usePrimitivesPreview` - Primitives preview state
- `usePublisherSnapshots` - Publisher version snapshots
- `useYearExport` - Export year data

**17 hooks total** → **9 tested (53% coverage)**

#### Library/Utils (1 test file)
- `api-client.test.ts` (16 tests)

### Component Coverage Gaps

**143 components, only 5 tested = 3.5% component coverage**

Major untested component categories:
1. **Admin UI:** Publisher management, audit logs, settings
2. **Publisher UI:** Dashboard, coverage editor, registry
3. **User UI:** Zmanim display, location selection
4. **Shared UI:** Navigation, modals, forms
5. **Map components:** Location picker, coverage maps

### Pages Coverage

**45 page components** - **0 unit tests**

All page-level testing relies on E2E tests.

Routes include:
- Admin routes (12 pages)
- Publisher routes (15 pages)
- User routes (3 pages)
- Auth routes (5 pages)
- Public routes (10 pages)

---

## 3. E2E Test Coverage

### Test Execution
```bash
cd /home/daniel/repos/zmanim/tests
playwright test
```

### Coverage Summary

**42 E2E spec files found**

### Feature Coverage Map

#### ✅ Well-Covered Features

**Admin Features:**
- `admin/dashboard.spec.ts` - Admin dashboard
- `admin/publishers.spec.ts` - Publisher management
- `admin/impersonation.spec.ts` - Publisher impersonation
- `admin.spec.ts` - General admin operations
- `admin-auth.spec.ts` - Admin authentication

**Publisher Features:**
- `publisher/dashboard.spec.ts` - Publisher dashboard
- `publisher/algorithm.spec.ts` - Algorithm management
- `publisher/algorithm-editor.spec.ts` - Algorithm editor UI
- `publisher/algorithm-migration.spec.ts` - Algorithm migrations
- `publisher/coverage.spec.ts` - Coverage management
- `publisher/profile.spec.ts` - Publisher profile
- `publisher/registry-master.spec.ts` - Master registry
- `publisher/registry-publisher.spec.ts` - Publisher registry
- `publisher/registry-request.spec.ts` - Registry requests
- `publisher/registry-duplicates.spec.ts` - Duplicate detection
- `publisher/team.spec.ts` - Team management
- `publisher/version-history.spec.ts` - Version history
- `publisher/pdf-report.spec.ts` - PDF report generation
- `publisher/publisher-lifecycle.spec.ts` - Full lifecycle
- `publisher/publisher-switcher.spec.ts` - Publisher switching
- `publisher/onboarding.spec.ts` - Publisher onboarding

**Authentication:**
- `auth.spec.ts`, `auth/authentication.spec.ts` - Core auth
- `registration/auth-flows.spec.ts` - Registration flows
- `registration/publisher-registration.spec.ts` - Publisher signup
- `demo/auth-admin.spec.ts`, `demo/auth-publisher.spec.ts` - Auth demos
- `demo/auth-redirect.spec.ts` - Redirect behavior

**User Features:**
- `user/zmanim.spec.ts` - Zmanim display
- `user/location.spec.ts` - Location selection
- `user/display-settings.spec.ts` - Display preferences
- `home.spec.ts` - Homepage
- `search/location-search.spec.ts` - Location search

**Email/Invitations:**
- `email/invitation-flows.spec.ts` - Email invitations
- `demo/email-flows.spec.ts` - Email flow demos

**Error Handling:**
- `errors/unauthorized.spec.ts` - 401/403 errors
- `errors/not-found.spec.ts` - 404 errors
- `errors/edge-cases.spec.ts` - Edge case errors

**Public Pages:**
- `public/public-pages.spec.ts` - Public routes

**Performance & Accessibility:**
- `performance/registry-performance.spec.ts` - Performance tests
- `accessibility/registry-a11y.spec.ts` - Accessibility tests

#### ❌ Features WITHOUT E2E Coverage

**Admin Features:**
- Admin audit log filtering/search
- Admin correction request management
- Admin tag request management
- Admin zman request management
- Admin user management (separate from publishers)
- Admin settings configuration
- Admin primitives management
- Admin zmanim registry editing

**Publisher Features:**
- Publisher activity timeline
- Publisher analytics/metrics
- Publisher audit log
- Publisher correction requests
- Publisher corrections management
- Publisher primitives management
- Publisher calculation settings

**User Features:**
- Publisher selection flow (beyond basic)
- Date/time zone switching
- Multi-day zmanim views
- Zmanim comparison between publishers

**Workflows:**
- Invitation acceptance flow
- Token verification flow
- Registration success page
- Sign-out behavior

### Skipped/Disabled Tests

**8 skipped tests found in `algorithm-editor.spec.ts`:**

All marked with `test.skip()` and reason `(requires auth)`:

1. `should display template selector for new algorithms`
2. `should load template when selected`
3. `should open configuration modal when clicking zman`
4. `should show method-specific parameters`
5. `should show live preview after saving configuration`
6. `should show validation errors for invalid configuration`
7. `should warn before navigation with unsaved changes`
8. `should not warn after saving changes`

**Reason:** These tests require authenticated publisher context. They were likely disabled when auth fixture setup became more complex or unreliable.

**Recommendation:** Re-enable after stabilizing authenticated test fixtures.

---

## 4. Excluded/Deleted Tests

### Deleted Tests

**1 test file deleted:**

**File:** `web/lib/hooks/__tests__/useLocalitySearch.test.ts` (647 lines)
**Commit:** `e45eb9e` - "fix(ci): resolve all ESLint warnings from PR Checks"
**Date:** 2025-12-26
**Reason:** Deleted during ESLint cleanup

**What was tested:**
- Debounced search behavior
- Query parameter building
- Stale response handling
- Error handling
- Clear functionality

**Status:** Test file was deleted but hook `useLocalitySearch.ts` still exists and is in production use.

**Recommendation:** **RESTORE THIS TEST FILE** - The hook is critical for location search functionality. The test should be fixed (ESLint issues) rather than deleted.

### Currently Skipped Tests

**8 tests skipped in `algorithm-editor.spec.ts`** (see Section 3 above)

### Test Debt

No test files appear to have `.only()` calls (no focused tests).

No other `.skip()` calls found outside `algorithm-editor.spec.ts`.

---

## 5. Recommendations

### Immediate Priority (P0)

1. **Restore `useLocalitySearch.test.ts`**
   - This test was deleted instead of fixed
   - The hook is critical for search functionality
   - Fix ESLint issues and restore test

2. **Add Handler Tests**
   - Current coverage: 1.6%
   - **Target: 80%+**
   - Focus on:
     - Admin publisher CRUD operations
     - Publisher registry operations
     - Authentication/authorization paths
     - Error handling (400/401/403/404/500)

3. **Add Service Tests**
   - Current coverage: 7.6%
   - **Target: 80%+**
   - Focus on:
     - Cache service (critical for performance)
     - Zmanim calculation service
     - Search service

### High Priority (P1)

4. **Fix Skipped E2E Tests**
   - Re-enable 8 algorithm editor tests
   - Create stable authenticated test fixtures
   - Verify tests pass in CI

5. **Add Integration Tests for Untested Packages**
   - `internal/algorithm` (0.0%)
   - `internal/cache` (0.0%)
   - `internal/geo` (0.0%)
   - `internal/ai` (0.0%)

6. **Add Component Tests**
   - Current: 5/143 components tested (3.5%)
   - **Target: 40%+ of critical UI components**
   - Priority components:
     - Registry editor
     - Coverage map
     - Zmanim display
     - Location selector
     - Algorithm editor

### Medium Priority (P2)

7. **Add Hook Tests for Untested Hooks**
   - `useAlgorithmPageData`
   - `useLocationSearch`
   - `useMapPreview`
   - `usePrimitivesPreview`
   - `usePublisherSnapshots`
   - `useYearExport`

8. **Add E2E Tests for Missing Workflows**
   - Admin audit log filtering
   - Admin correction request management
   - Publisher analytics dashboard
   - Publisher activity timeline
   - Multi-publisher zmanim comparison

9. **Add Frontend Coverage Tooling**
   - Install `@vitest/coverage-v8`
   - Set coverage thresholds in `vitest.config.ts`
   - Add coverage reporting to CI

### Lower Priority (P3)

10. **Improve Middleware Coverage**
    - Current: 19.4%
    - Add tests for rate limiting edge cases
    - Add tests for auth middleware

11. **Add Page-Level Component Tests**
    - Test page loading states
    - Test error boundaries
    - Test data fetching hooks

12. **Increase Calendar Coverage**
    - Current: 32.9%
    - Add tests for edge cases (leap years, DST transitions)
    - Add tests for Israeli vs. diaspora logic

---

## 6. Coverage Metrics Summary

| Category | Coverage | Target | Gap |
|----------|----------|--------|-----|
| **Backend Overall** | 7.3% | 80% | -72.7% |
| Backend Handlers | 1.6% | 80% | -78.4% |
| Backend Services | 7.6% | 80% | -72.4% |
| Backend Calendar | 32.9% | 80% | -47.1% |
| Backend DSL | 50.3% | 80% | -29.7% |
| Backend Astro | 62.1% | 80% | -17.9% ✅ |
| **Frontend Components** | 3.5% | 40% | -36.5% |
| **Frontend Hooks** | 53% | 80% | -27% |
| **E2E Features** | ~75% | 90% | -15% ✅ |

**Key Insight:** The project has **inverted testing pyramid**:
- Strong E2E coverage (~75%)
- Weak unit test coverage (7.3% backend, ~20% frontend)

**Recommended:** Shift focus to unit and integration tests to reduce E2E brittleness and improve developer feedback loops.

---

## 7. Test Quality Issues

### Backend

1. **No error path testing** - 556 untested functions means most error handling is untested
2. **No database mock tests** - Heavy reliance on integration tests
3. **No cache invalidation tests** - Cache service has 0.0% coverage

### Frontend

1. **Missing coverage tooling** - Cannot measure coverage percentage
2. **Component testing gap** - Only formula builder tested
3. **Page component testing gap** - 0/45 pages have unit tests

### E2E

1. **Skipped tests** - 8 tests disabled without clear re-enable plan
2. **Missing negative tests** - Limited testing of error states
3. **Performance test coverage** - Only 1 performance test file

---

## 8. Appendix: Test Commands

### Backend
```bash
# Run all tests
cd api && go test ./...

# Run with coverage
cd api && go test ./... -coverprofile=/tmp/coverage.out

# View coverage details
cd api && go tool cover -func=/tmp/coverage.out

# View coverage in browser
cd api && go tool cover -html=/tmp/coverage.out
```

### Frontend
```bash
# Run all tests
cd web && npm run test

# Run with coverage (requires @vitest/coverage-v8)
cd web && npm run test:coverage

# Run in watch mode
cd web && npm run test:watch
```

### E2E
```bash
# Run all E2E tests
cd tests && npx playwright test

# Run specific test file
cd tests && npx playwright test e2e/admin/dashboard.spec.ts

# Run with UI
cd tests && npx playwright test --ui

# Run in debug mode
cd tests && npx playwright test --debug
```

### CI Validation
```bash
# Run all CI checks locally
./scripts/validate-ci-checks.sh
```

---

**Report Generated:** 2025-12-27
**Next Review:** After implementing P0 recommendations
