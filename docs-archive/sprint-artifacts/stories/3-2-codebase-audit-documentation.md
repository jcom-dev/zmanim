# Story 3.2: Codebase Audit & Documentation

**Epic:** Epic 3 - Consolidation & Quality
**Status:** ready-for-dev
**Priority:** P2
**Story Points:** 5

---

## User Story

**As a** developer,
**I want** documented patterns and learnings from Epic 1 & 2,
**So that** I understand the codebase and can follow established approaches.

---

## Background

During Epic 1 and 2, many decisions were made ad hoc. Patterns emerged but weren't documented. New developers (or AI agents) have to guess at "the right way" to do things. This story captures institutional knowledge by auditing the actual codebase.

With the comprehensive E2E test suite from Story 3.1 providing safety, we can now audit the codebase to identify patterns, inconsistencies, and technical debt that will inform Stories 3.3 and 3.4.

---

## Acceptance Criteria

### AC-1: Frontend Pattern Inventory
- [x] Document component patterns (Client vs Server components, use of `'use client'` directive)
- [x] Document state management patterns (Clerk hooks, TanStack Query, PublisherContext)
- [x] Document form patterns (validation, submission, error handling)
- [x] Document layout patterns (page structure, responsive approach with Tailwind)
- [x] Document API integration patterns (fetching, mutations, error handling)
- [x] Document icon usage (Lucide React)
- [x] Document navigation patterns (Next.js Link component)
- [x] Identify inconsistencies between components

### AC-2: Backend Pattern Inventory
- [x] Document handler patterns (Chi router, URL params, context passing)
- [x] Document service patterns (service injection, business logic organization)
- [x] Document middleware patterns (auth, CORS, logging)
- [x] Document error handling patterns (RespondJSON, RespondInternalError, etc.)
- [x] Document database access patterns (pgx Pool usage, query patterns)
- [x] Document logging patterns (slog usage)
- [x] Document Clerk integration patterns (SDK usage, metadata handling)
- [x] Identify inconsistencies between handlers

### AC-3: Testing Pattern Inventory (from Stories 3.0 & 3.1)
- [x] Document test utilities (`@clerk/testing/playwright`, test fixtures)
- [x] Document test data patterns (`TEST_` prefix, `test-zmanim.example.com` domain)
- [x] Document test organization (test.describe, beforeAll, afterAll, beforeEach)
- [x] Document cleanup patterns (idempotent cleanup, cache clearing)
- [x] Document auth injection patterns (setupClerkTestingToken, clerk.signIn)

### AC-4: Technical Debt Inventory
- [x] List incomplete pages/features
- [x] List inconsistent implementations across similar files
- [x] List missing error handling
- [x] List hardcoded values that should be configurable
- [x] List TODO/FIXME/HACK comments in codebase
- [x] Prioritize debt items by impact (High/Medium/Low)

### AC-5: Ad Hoc Fix Documentation
- [x] Review git history for bug fixes and workarounds
- [x] Document lessons learned from difficult implementations
- [x] Capture "gotchas" that future developers should know
- [x] Note successful approaches that should be repeated

### AC-6: Audit Document Created
- [x] Create `docs/codebase-audit.md` with all findings
- [x] Organize by category (frontend, backend, testing, debt, learnings)
- [x] Include specific file references with line numbers where applicable
- [x] Include code examples showing patterns
- [x] Include recommendations for Story 3.3 (standards)

---

## Technical Notes

### Files to Audit

**Frontend (web/):**
- Components: `web/components/**/*.tsx`
- Pages: `web/app/**/*.tsx`
- Hooks: `web/hooks/**/*.ts` (if exists)
- Contexts: Look for PublisherContext, etc.
- API integration: `web/lib/api.ts` or similar

**Backend (api/):**
- Handlers: `api/internal/handlers/*.go`
- Services: `api/internal/services/*.go`
- Middleware: `api/internal/middleware/*.go`
- Models: `api/internal/models/*.go`
- Database: `api/internal/db/*.go`

**Tests (tests/):**
- Test utilities: `tests/e2e/utils/*.ts`
- Test specs: `tests/e2e/**/*.spec.ts`
- Setup: `tests/e2e/setup/*.ts`

### Example Patterns to Document

**Frontend Example - Role-based Rendering:**
```tsx
// Pattern: Role checking with Clerk metadata
const { user, isLoaded } = useUser();
const metadata = user.publicMetadata as {
  role?: string;
  publisher_access_list?: string[];
};
const isAdmin = metadata.role === 'admin';

// Files: web/components/home/RoleNavigation.tsx
```

**Backend Example - Handler Structure:**
```go
// Pattern: Chi URL params, context passing, respond helpers
func (h *Handlers) HandlerName(w http.ResponseWriter, r *http.Request) {
  ctx := r.Context()
  id := chi.URLParam(r, "id")

  // Validation
  if id == "" {
    RespondValidationError(w, r, "ID is required", nil)
    return
  }

  // Business logic via service
  result, err := h.service.DoSomething(ctx, id)
  if err != nil {
    slog.Error("operation failed", "error", err)
    RespondInternalError(w, r, "Failed to process")
    return
  }

  RespondJSON(w, r, http.StatusOK, result)
}

// Files: api/internal/handlers/admin.go
```

**Test Example - Auth Injection:**
```typescript
// Pattern: Clerk testing library for auth
test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
});

test('can access protected route', async ({ page }) => {
  await page.goto(`${BASE_URL}/admin/publishers`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Publisher Management' })).toBeVisible();
});

// Files: tests/e2e/admin/publishers.spec.ts
```

### Search Commands

```bash
# Find TODO comments
grep -r "TODO" web/ api/ --exclude-dir=node_modules --exclude-dir=vendor

# Find FIXME comments
grep -r "FIXME" web/ api/ --exclude-dir=node_modules --exclude-dir=vendor

# Find HACK comments
grep -r "HACK" web/ api/ --exclude-dir=node_modules --exclude-dir=vendor

# Find console.log (should not be in production)
grep -r "console.log" web/ --exclude-dir=node_modules

# Find hardcoded URLs
grep -r "http://" web/ api/ --exclude-dir=node_modules --exclude-dir=vendor
grep -r "https://" web/ api/ --exclude-dir=node_modules --exclude-dir=vendor

# Review recent bug fixes
git log --grep="fix" --oneline --since="2025-10-01"

# Files changed most often (potential problem areas)
git log --format=format: --name-only | sort | uniq -c | sort -r | head -20
```

### Audit Document Template

```markdown
# Codebase Audit - Shtetl Zmanim

**Date:** 2025-11-27
**Author:** [Agent Name]
**Scope:** Epic 1 & 2 Implementation (24 stories, 66 FRs)
**Test Coverage:** Story 3.0 & 3.1 (130+ E2E tests)

## Executive Summary

- Total files reviewed: [number]
- Patterns documented: [number]
- Inconsistencies found: [number]
- Technical debt items: [number]
- Overall code quality: [assessment]

---

## Frontend Patterns

### Component Structure

**Standard Pattern:**
```tsx
'use client';

import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { Icon } from 'lucide-react';

export function ComponentName() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) return null;

  return (
    <div className="tailwind-classes">
      {/* Component content */}
    </div>
  );
}
```

**Files Following Pattern:**
- `web/components/home/RoleNavigation.tsx`
- [List other files]

**Files NOT Following Pattern:**
- [List files with variations]

**Recommendation:**
[Standardization approach for Story 3.3]

### State Management

**Clerk User State:**
- Pattern: `useUser()` hook from `@clerk/nextjs`
- Metadata access: Type casting `publicMetadata`
- Files: [List files using this pattern]

**TanStack Query:**
- Pattern: [Document if/how it's used]
- Files: [List files]

**PublisherContext:**
- Pattern: [Document context usage]
- Files: [List files]

**Inconsistencies:**
- [List any inconsistencies]

### API Integration

**Pattern Observed:**
[How API calls are made - fetch, axios, TanStack Query, etc.]

**Error Handling:**
[How errors are handled in UI]

**Loading States:**
[How loading states are shown]

### Styling

**Tailwind Usage:**
- Utility-first classes
- Responsive breakpoints: [Document usage]
- Color scheme: [Document theme]

**Icon Library:**
- Lucide React icons
- Usage pattern: [Document]

---

## Backend Patterns

### Handler Structure

**Standard Pattern:**
```go
// Chi router, context passing, validation, service call, respond
func (h *Handlers) HandlerName(w http.ResponseWriter, r *http.Request) {
  ctx := r.Context()
  id := chi.URLParam(r, "id")

  if id == "" {
    RespondValidationError(w, r, "message", nil)
    return
  }

  result, err := h.service.Method(ctx, id)
  if err != nil {
    slog.Error("error message", "error", err)
    RespondInternalError(w, r, "message")
    return
  }

  RespondJSON(w, r, http.StatusOK, result)
}
```

**Files Following:**
- `api/internal/handlers/admin.go`
- [List others]

**Files NOT Following:**
- [List deviations]

### Service Layer

**Pattern:**
- Service struct with dependencies
- Methods with context first parameter
- Error wrapping with `fmt.Errorf()`
- Structured logging with slog

**Files:**
- `api/internal/services/clerk_service.go`
- [List others]

### Database Access

**Pattern:**
- `h.db.Pool` for connection pool
- pgx for PostgreSQL driver
- Query patterns: [Document]
- Error handling: [Document]

### Logging

**Pattern:**
- `slog` from stdlib
- Structured logging: `slog.Error("msg", "key", value)`
- Log levels: Error, Info, [others]

### Error Handling

**Response Helpers:**
- `RespondJSON(w, r, status, data)`
- `RespondInternalError(w, r, message)`
- `RespondNotFound(w, r, message)`
- `RespondValidationError(w, r, message, errors)`

**Files:** `api/internal/handlers/response.go`

---

## Testing Patterns (Stories 3.0 & 3.1)

### Test Organization

**Pattern:**
```typescript
test.describe('Feature Name', () => {
  let testData: TestDataType;

  test.beforeAll(async () => {
    // Create shared test data
    testData = await createTestData();
  });

  test.afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  test.beforeEach(async ({ page }) => {
    // Login for each test
    await loginAsRole(page);
  });

  test('test description', async ({ page }) => {
    // Test implementation
  });
});
```

**Files:** All files in `tests/e2e/**/*.spec.ts`

### Test Utilities

**Auth Helpers:**
- `loginAsAdmin(page)` - Uses `@clerk/testing/playwright`
- `loginAsPublisher(page, publisherId)`
- `loginAsUser(page)`
- Pattern: `setupClerkTestingToken()` → `clerk.signIn()`

**Fixtures:**
- `createTestPublisherEntity()` - TEST_ prefix, Xata | Shared dev DBservice key
- `createTestAlgorithm(publisherId)`
- `createTestCoverage(publisherId, cityId)`
- `createFullTestPublisher()` - Complete setup

**Cleanup:**
- `cleanupTestUsers()` - Idempotent Clerk cleanup
- `cleanupTestData()` - Idempotent database cleanup
- Pattern: Test email domain filter, TEST_ prefix filter

**Test Data:**
- Email domain: `test-zmanim.example.com`
- Entity prefix: `TEST_`
- Caching: Map-based cache to avoid recreation

**Files:**
- `tests/e2e/utils/clerk-auth.ts`
- `tests/e2e/utils/test-fixtures.ts`
- `tests/e2e/utils/cleanup.ts`

---

## Technical Debt Inventory

| Priority | Item | Location | Impact | Effort | Notes |
|----------|------|----------|--------|--------|-------|
| High | [Description] | [File:Line] | [User/Dev impact] | [Est. hours] | [Context] |
| High | ... | ... | ... | ... | ... |
| Medium | ... | ... | ... | ... | ... |
| Low | ... | ... | ... | ... | ... |

### TODO/FIXME/HACK Comments

**Total Counts:**
- TODO: [number]
- FIXME: [number]
- HACK: [number]

**High Priority Items:**
1. [File:Line] - [Description]
2. [File:Line] - [Description]
3. ...

### Incomplete Features

- [List pages or features that are partially implemented]

### Hardcoded Values

- [List values that should be environment variables or configuration]

### Missing Error Handling

- [List areas lacking proper error handling]

---

## Lessons Learned

### Successful Approaches

**1. Clerk Testing Integration**
- **What:** Using `@clerk/testing/playwright` for auth injection
- **Why It Works:** Bypasses bot detection, programmatic sign-in, no UI coupling
- **Files:** `tests/e2e/utils/clerk-auth.ts`
- **Recommendation:** Continue this pattern for all auth testing

**2. [Another success]**
- **What:** [Description]
- **Why It Works:** [Explanation]
- **Files:** [References]
- **Recommendation:** [How to repeat]

### Difficult Implementations

**1. [Challenge]**
- **Problem:** [What was hard]
- **Root Cause:** [Why it was hard]
- **Solution:** [How it was solved]
- **Lesson:** [What we learned]
- **Prevention:** [How to avoid in future]

### Gotchas

1. **Clerk Metadata Access:** Must type-cast `publicMetadata` when accessing role/publisher_access_list
2. **Test Email Domain:** Clerk doesn't accept `.local` domains; use `example.com`
3. **[Another gotcha]:** [Description]

---

## Git History Analysis

### Bug Fixes

**Notable Fixes:**
1. [Commit] - [Description of fix]
   - Root cause: [Why bug occurred]
   - Lesson: [How to prevent]

### Most Changed Files

[List files changed most often - potential hotspots]

---

## Recommendations for Story 3.3

Based on this audit, the following should be formalized in coding standards:

### Frontend Standards Needed

1. **Client Component Pattern:** Document when to use `'use client'` directive
2. **Clerk Metadata Typing:** Create shared type for `publicMetadata`
3. **[Another pattern]:** [Description]

### Backend Standards Needed

1. **Handler Template:** Standardize handler structure (params → validate → service → respond)
2. **Error Logging:** Consistent slog usage with structured fields
3. **[Another pattern]:** [Description]

### Testing Standards Needed

1. **Test File Structure:** beforeAll → afterAll → beforeEach pattern
2. **Test Data Naming:** TEST_ prefix and test domain consistently
3. **[Another pattern]:** [Description]

### Architecture Updates Needed

1. **Testing Architecture:** Add testing infrastructure section to architecture.md
2. **[Another update]:** [Description]

---

## Files Reviewed

### Frontend
- Total TypeScript files: [number]
- Components: [number]
- Pages: [number]
- Hooks: [number]
- Contexts: [number]

### Backend
- Total Go files: [number]
- Handlers: [number]
- Services: [number]
- Middleware: [number]
- Models: [number]

### Tests
- Total test files: [number]
- Test utilities: [number]
- Test specs: [number]

---

## Next Steps

1. Review audit with team/stakeholders
2. Prioritize technical debt for Story 3.4
3. Create coding standards document (Story 3.3)
4. Update architecture.md with proven patterns (Story 3.3)
5. Plan refactoring work (Story 3.4)

---

_Generated: [Date]_
_Epic 1 & 2: 24 stories, 66 FRs_
_Epic 3: Stories 3.0 & 3.1, 130+ E2E tests_
```

---

## Implementation Approach

### Phase 1: Automated Analysis
1. Run grep commands to find TODOs, FIXMEs, hardcoded values
2. Generate file counts and statistics
3. Review git log for bug fixes and patterns

### Phase 2: Manual Pattern Review
1. Review 3-5 example files from each category
2. Document the patterns observed
3. Identify inconsistencies
4. Note successful and problematic approaches

### Phase 3: Documentation
1. Create `docs/codebase-audit.md`
2. Fill in all sections with findings
3. Add code examples
4. Provide specific file references
5. Prioritize technical debt

### Phase 4: Recommendations
1. List patterns to standardize for Story 3.3
2. List debt items to address in Story 3.4
3. Note architecture updates needed

---

## Definition of Done

- [x] All 6 acceptance criteria met
- [x] `docs/codebase-audit.md` created and complete
- [x] Frontend patterns documented with examples and file references
- [x] Backend patterns documented with examples and file references
- [x] Testing patterns documented with examples
- [x] Technical debt inventory complete with priorities
- [x] Lessons learned captured
- [x] Git history analyzed for insights
- [x] Recommendations provided for Stories 3.3 & 3.4
- [x] Document reviewed for completeness and accuracy

---

## Dependencies

- Story 3.1: Comprehensive E2E Test Suite (completed) - Provides testing patterns to document and safety net for future refactoring

---

## Dependent Stories

- Story 3.3: Coding Standards & Architecture Update (uses audit findings to create standards)
- Story 3.4: Refactor to Standards (implements audit recommendations)

---

## Notes

This audit transforms implicit knowledge into explicit documentation. It should be:
- **Honest:** Identify both good and bad patterns
- **Specific:** Include file references, line numbers, code examples
- **Actionable:** Clear recommendations for improvements
- **Non-judgmental:** Focus on patterns, not blame

The audit is critical for ensuring Story 3.3 (standards) is based on reality, not theory, and Story 3.4 (refactor) addresses actual technical debt.

---

## Status

**Status:** Review

---

## Dev Agent Record

### Debug Log

**2025-11-27 - Story Implementation:**
1. Loaded sprint-status.yaml to find ready story
2. Found 3-2-codebase-audit-documentation as first ready-for-dev story
3. Loaded story file and context.xml
4. Executed automated analysis:
   - grep for TODO/FIXME/HACK comments (8/0/0 found)
   - git log analysis for bug fixes (28 fix commits since Oct 2025)
   - file statistics (26 app files, 30 components, 29 Go files, 33 test files)
   - most frequently changed files identified
5. Manual pattern review:
   - Frontend: 'use client' directive in 46 files, component patterns, state management
   - Backend: handler patterns, response helpers, service layer, Clerk integration
   - Testing: @clerk/testing approach, test.describe pattern, fixtures
6. Created comprehensive docs/codebase-audit.md with all findings
7. Updated story file with acceptance criteria completion

### Completion Notes

✅ **Story 3.2 Complete** - Comprehensive codebase audit created

**Key Deliverables:**
- Created `docs/codebase-audit.md` (750+ lines of documentation)
- Documented 10+ frontend patterns with code examples
- Documented 8+ backend patterns with code examples
- Documented 5+ testing patterns from Stories 3.0/3.1
- Created prioritized technical debt inventory (10 items)
- Captured 5 "gotchas" and 4 successful approaches
- Analyzed 28 bug fix commits for lessons learned
- Provided actionable recommendations for Stories 3.3 & 3.4

**File Statistics:**
- Frontend: 56 TypeScript files (26 app, 30 components, 2 providers)
- Backend: 29 Go files (11 handlers, 5 services, 3 middleware)
- Tests: 33 test files (29 specs, 4 utilities)

**Technical Debt Found:**
- 8 TODO comments (medium priority)
- 4 console.log statements to remove
- API_BASE repeated in 5+ files
- No shared form validation utilities
- Missing web/hooks/ directory

**Recommendations Summary:**
1. Create shared Clerk metadata type
2. Centralize API client
3. Standardize icon usage on Lucide React
4. Document handler 6-step pattern
5. Add testing section to architecture.md

---

## File List

**Created:**
- `docs/codebase-audit.md` - Comprehensive codebase audit document

**Modified:**
- `docs/sprint-artifacts/stories/3-2-codebase-audit-documentation.md` - This story file
- `docs/sprint-artifacts/sprint-status.yaml` - Status updated to review

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-27 | Story implementation complete - created codebase-audit.md | AI Dev Agent |
