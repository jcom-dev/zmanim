# Epic 3: Consolidation & Quality

**Author:** BMad
**Date:** 2025-11-27
**Status:** Draft
**Depends On:** Epic 1 (Shtetl Zmanim MVP) - COMPLETED, Epic 2 (Publisher User Management) - COMPLETED

---

## Overview

Epic 3 is an internal engineering epic focused on hardening the foundation before building new features. It addresses quality gaps identified in the Epic 1 & 2 retrospective: inconsistent patterns, incomplete pages, no frontend testing for authenticated flows, and undocumented coding standards.

**Core Theme:** "Quality as a First-Class Citizen"

**Philosophy Shift:** From "ship features, fix later" to "design right, build once, test thoroughly"

---

## Epic Summary

| Metric | Value |
|--------|-------|
| Stories | 5 (3.0 - 3.4) |
| Focus | Testing, Documentation, Standards, Refactoring |
| New FRs | 0 (internal quality work) |
| User-Facing Changes | None (foundation strengthening) |

---

## Goals

1. **Enable Authenticated E2E Testing** - Use Clerk API to create test users and inject auth tokens, allowing comprehensive testing of admin and publisher flows

2. **Validate Epic 1 & 2 Retroactively** - Comprehensive test suite covering 50+ scenarios proves existing functionality works correctly

3. **Document What We Learned** - Audit codebase, capture patterns that emerged from ad hoc fixes, create institutional knowledge

4. **Establish Coding Standards** - Formalize patterns so future development follows proven approaches consistently

5. **Clean Up Technical Debt** - Refactor existing code to match documented standards, fix inconsistencies

---

## Success Criteria

**Epic 3 is complete when:**

- [ ] Any developer can run `loginAsAdmin()` or `loginAsPublisher()` in E2E tests
- [ ] 50+ E2E test scenarios pass covering all major flows
- [ ] Codebase audit document exists with patterns inventory
- [ ] `coding-standards.md` or equivalent exists with clear guidelines
- [ ] `architecture.md` updated with proven patterns from implementation
- [ ] Existing code refactored to follow documented standards
- [ ] No major inconsistencies remain in frontend patterns
- [ ] New Definition of Done includes mandatory E2E tests

---

## Updated Definition of Done (All Future Stories)

After Epic 3, every story must meet:

- [ ] All acceptance criteria met
- [ ] E2E tests written and passing (authenticated flows where applicable)
- [ ] Backend unit tests passing
- [ ] Code follows documented standards in `coding-standards.md`
- [ ] Code reviewed
- [ ] No console errors
- [ ] Mobile responsive verified
- [ ] Consistent with established patterns

**Key Change:** "Dev is also QA" - testing is part of implementation, not a separate phase.

---

## Story Dependency Chain

```
3.0 Testing Infrastructure (Foundation)
 └── 3.1 Comprehensive E2E Test Suite (Validates Epic 1 & 2)
      └── 3.2 Codebase Audit & Documentation (Study patterns)
           └── 3.3 Coding Standards & Architecture (Formalize patterns)
                └── 3.4 Refactor to Standards (Apply standards)
```

---

## Story 3.0: Testing Infrastructure

**As a** developer,
**I want** utilities to authenticate as different roles in E2E tests,
**So that** I can test admin and publisher flows without manual login.

### Background

Currently we cannot test authenticated flows (admin dashboard, publisher dashboard, impersonation, etc.) because Playwright tests have no way to authenticate. We have full Clerk API access which enables programmatic user creation and session token generation.

### Acceptance Criteria

**AC-1: Test User Creation**
- [x] `createTestAdmin()` function creates a Clerk user with admin role
- [x] `createTestPublisher(publisherId)` function creates a Clerk user linked to a publisher
- [x] `createTestUser()` function creates a regular user without special roles
- [x] Test users have predictable email format (e.g., `test-admin-{uuid}@test.zmanim.local`)

**AC-2: Authentication Injection**
- [x] `loginAsAdmin(page)` injects admin auth into Playwright browser context
- [x] `loginAsPublisher(page, publisherId)` injects publisher auth into browser context
- [x] `loginAsUser(page)` injects regular user auth into browser context
- [x] Auth injection uses Clerk session tokens, not UI login flow

**AC-3: Test Data Fixtures**
- [x] `createTestPublisherEntity()` creates a publisher entity in database with test data
- [x] `createTestAlgorithm(publisherId)` creates a published algorithm for testing
- [x] `createTestCoverage(publisherId, cityId)` creates coverage area for testing
- [x] Fixtures return created entity IDs for use in tests

**AC-4: Cleanup Utilities**
- [x] `cleanupTestUsers()` removes all test users from Clerk after test run
- [x] `cleanupTestData()` removes test publishers, algorithms, coverage from database
- [x] `cleanupAllInboxes()` removes test email inboxes from MailSlurp
- [x] Cleanup runs in `globalTeardown` or via separate cleanup script
- [x] Cleanup is idempotent (safe to run multiple times)

**AC-5: Integration Verification**
- [x] Demo test: login as admin → navigate to /admin → verify admin content visible
- [x] Demo test: login as publisher → navigate to /publisher → verify dashboard loads
- [x] Demo test: without auth → navigate to /publisher → verify redirected to login

**AC-6: Email Testing (MailSlurp)**
- [x] `createTestInbox()` creates a real email inbox that can receive emails
- [x] `waitForEmail(inboxId)` waits for email to arrive with configurable timeout
- [x] `waitForInvitationEmail(inboxId)` waits for invitation and extracts accept link
- [x] `waitForPasswordResetEmail(inboxId)` waits for reset email and extracts link
- [x] `waitForApprovalEmail(inboxId)` waits for publisher approval email
- [x] `extractLinksFromEmail(body)` extracts URLs from email body
- [x] Email tests gracefully skip if MAILSLURP_API_KEY not configured

### Technical Notes

**File Structure:**
```
tests/
  e2e/
    utils/
      auth.ts           # Clerk auth helpers
      fixtures.ts       # Database test data creation
      cleanup.ts        # Test cleanup utilities
    setup/
      global-setup.ts   # Playwright global setup
      global-teardown.ts # Playwright global teardown
```

**Clerk API Methods Needed:**
- `clerkClient.users.createUser()` - Create test users
- `clerkClient.users.updateUserMetadata()` - Set role and publisher_access_list
- `clerkClient.users.deleteUser()` - Cleanup test users
- `clerkClient.sessions.getToken()` or sign-in token generation for auth injection

**Environment:**
- `CLERK_SECRET_KEY` - Already configured, needed for backend API
- Test users should be clearly identifiable (naming convention or metadata flag)

### Definition of Done

- [ ] All 5 acceptance criteria met
- [ ] Auth helpers documented with usage examples
- [ ] Demo tests passing in CI
- [ ] No test users left behind after test run

---

## Story 3.1: Comprehensive E2E Test Suite

**As a** developer,
**I want** comprehensive E2E tests covering all authenticated flows,
**So that** I can verify Epic 1 & 2 functionality works correctly and catch regressions.

### Background

Epic 1 and 2 delivered 24 stories with 66 FRs, but minimal E2E testing. This story creates comprehensive coverage that validates existing functionality and establishes patterns for future tests.

### Acceptance Criteria

**AC-1: Admin Flow Tests (15+ scenarios)**
- [ ] Admin login → see admin portal button on home
- [ ] Admin dashboard → view stats, publisher counts
- [ ] Create publisher → appears in list
- [ ] View publisher details → see users section
- [ ] Invite user to publisher → invitation created
- [ ] Verify publisher → status changes to verified
- [ ] Suspend publisher → status changes, access blocked
- [ ] Reactivate publisher → access restored
- [ ] Impersonate publisher → banner shows, can view as publisher
- [ ] Exit impersonation → returns to admin view
- [ ] View pending registration requests (if any exist)
- [ ] Approve registration request → publisher created
- [ ] Reject registration request → status updated
- [ ] View publisher activity log
- [ ] Admin system settings accessible

**AC-2: Publisher Flow Tests (20+ scenarios)**
- [ ] Publisher login → see publisher dashboard button on home
- [ ] Dashboard hub → all cards render with data
- [ ] Profile view → shows current info
- [ ] Profile edit → save → changes persist
- [ ] Algorithm editor → load page successfully
- [ ] Algorithm → select template → applies defaults
- [ ] Algorithm → configure zman → preview updates
- [ ] Algorithm → save draft → status shows draft
- [ ] Algorithm → publish → status shows published
- [ ] Algorithm → view versions (if implemented)
- [ ] Coverage → view current areas
- [ ] Coverage → add country level
- [ ] Coverage → add region level
- [ ] Coverage → add city level
- [ ] Coverage → set priority
- [ ] Coverage → toggle active/inactive
- [ ] Coverage → delete with confirmation
- [ ] Analytics page → renders stats
- [ ] Activity log → shows recent entries
- [ ] Team page → view members
- [ ] Team → invite member (if implemented)
- [ ] Multi-publisher switcher → switch context (if user has multiple)

**AC-3: End User Flow Tests (10+ scenarios)**
- [ ] Home page → location search renders
- [ ] Location search → autocomplete works
- [ ] Geolocation → use my location (mock geolocation)
- [ ] Select city → publisher list appears
- [ ] No coverage → warning message shown
- [ ] Select publisher → zmanim page loads
- [ ] Zmanim → date navigation arrows work
- [ ] Zmanim → date picker opens
- [ ] Formula reveal → click info icon → panel opens
- [ ] Formula panel → shows method, params
- [ ] Formula panel → close via X or click outside

**AC-4: Registration & Profile Flow Tests (5+ scenarios)**
- [ ] Become publisher page → form renders
- [ ] Registration form → validation errors on empty submit
- [ ] Registration form → success on valid submit
- [ ] Profile dropdown → shows user info when logged in
- [ ] Profile dropdown → sign out works

**AC-5: Email Flow Tests (MailSlurp - 5+ scenarios)**
- [ ] Admin invites user → invitation email received → accept link works
- [ ] Publisher registration → admin approves → approval email received
- [ ] Publisher registration → admin rejects → rejection email received
- [ ] Publisher invites team member → invitation email received
- [ ] User requests password reset → reset email received → link works

**AC-6: Error & Edge Case Tests (10+ scenarios)**
- [ ] Unauthorized access to /admin → redirected or 403
- [ ] Unauthorized access to /publisher → redirected or 403
- [ ] Invalid API request → graceful error message
- [ ] Non-existent publisher → 404 or appropriate error
- [ ] Non-existent city → handled gracefully
- [ ] Expired/invalid session → redirected to login
- [ ] Network error simulation → error state shown
- [ ] Empty states render correctly (no coverage, no activity, etc.)
- [ ] Mobile viewport → responsive layout works
- [ ] Slow network → loading states appear

### Technical Notes

**Test Organization:**
```
tests/e2e/
  admin/
    dashboard.spec.ts
    publishers.spec.ts
    impersonation.spec.ts
    requests.spec.ts
  publisher/
    dashboard.spec.ts
    profile.spec.ts
    algorithm.spec.ts
    coverage.spec.ts
    team.spec.ts
  user/
    location.spec.ts
    zmanim.spec.ts
    formula-reveal.spec.ts
  registration/
    become-publisher.spec.ts
    profile-dropdown.spec.ts
  errors/
    unauthorized.spec.ts
    not-found.spec.ts
    edge-cases.spec.ts
```

**Test Patterns:**
- Use `test.describe` for grouping related tests
- Use `test.beforeEach` for common setup per file
- Use auth helpers from Story 3.0
- Use fixtures for test data
- Clean up after each test file

### Definition of Done

- [ ] 50+ test scenarios implemented
- [ ] All tests passing in CI
- [ ] Test coverage documented
- [ ] Flaky tests identified and fixed
- [ ] Test run time under 10 minutes

---

## Story 3.2: Codebase Audit & Documentation

**As a** developer,
**I want** documented patterns and learnings from Epic 1 & 2,
**So that** I understand the codebase and can follow established approaches.

### Background

During Epic 1 and 2, many decisions were made ad hoc. Patterns emerged but weren't documented. New developers (or AI agents) have to guess at "the right way" to do things. This story captures institutional knowledge.

### Acceptance Criteria

**AC-1: Frontend Pattern Inventory**
- [ ] Document component patterns (how components are structured)
- [ ] Document state management patterns (contexts, hooks, TanStack Query usage)
- [ ] Document form patterns (validation, submission, error handling)
- [ ] Document layout patterns (page structure, responsive approach)
- [ ] Document API integration patterns (fetching, mutations, error handling)
- [ ] Identify inconsistencies between files

**AC-2: Backend Pattern Inventory**
- [ ] Document handler patterns (request parsing, response formatting)
- [ ] Document service patterns (business logic organization)
- [ ] Document middleware patterns (auth, CORS, logging)
- [ ] Document error handling patterns
- [ ] Document database access patterns
- [ ] Identify inconsistencies between files

**AC-3: Technical Debt Inventory**
- [ ] List incomplete pages/features
- [ ] List inconsistent implementations
- [ ] List missing error handling
- [ ] List hardcoded values that should be configurable
- [ ] List TODO/FIXME comments in codebase
- [ ] Prioritize debt items by impact

**AC-4: Ad Hoc Fix Documentation**
- [ ] Review git history for bug fixes and workarounds
- [ ] Document lessons learned from difficult implementations
- [ ] Capture "gotchas" that future developers should know
- [ ] Note successful approaches that should be repeated

**AC-5: Audit Document Created**
- [ ] Create `docs/codebase-audit.md` with all findings
- [ ] Organize by category (frontend, backend, debt, learnings)
- [ ] Include specific file references
- [ ] Include recommendations for standardization

### Technical Notes

**Audit Approach:**
1. Review all files in `web/` for frontend patterns
2. Review all files in `api/` for backend patterns
3. Run grep for TODO, FIXME, HACK comments
4. Review recent commits for bug fixes
5. Compare similar files for inconsistencies

**Output Format:**
```markdown
# Codebase Audit - Shtetl Zmanim

## Frontend Patterns
### Component Structure
- Pattern observed: ...
- Files following: ...
- Files not following: ...

### State Management
...

## Backend Patterns
...

## Technical Debt
| Item | Location | Priority | Impact |
|------|----------|----------|--------|
| ... | ... | High/Med/Low | ... |

## Lessons Learned
...
```

### Definition of Done

- [ ] Audit document created with all 5 sections
- [ ] Specific file references included
- [ ] Inconsistencies clearly identified
- [ ] Prioritized debt list ready for Story 3.4

---

## Story 3.3: Coding Standards & Architecture Update

**As a** developer,
**I want** clear coding standards and updated architecture documentation,
**So that** I know exactly how to write code that matches the project's patterns.

### Background

The audit (Story 3.2) identifies what patterns exist. This story formalizes the best patterns into standards and updates architecture documentation to reflect reality.

### Acceptance Criteria

**AC-1: Frontend Coding Standards**
- [ ] Component naming and file structure conventions
- [ ] State management guidelines (when to use context vs. local state vs. TanStack Query)
- [ ] Form handling standard approach
- [ ] Error handling and loading state patterns
- [ ] Styling approach (Tailwind conventions, shadcn/ui usage)
- [ ] Import organization
- [ ] TypeScript usage guidelines

**AC-2: Backend Coding Standards**
- [ ] Handler structure and naming conventions
- [ ] Service layer guidelines
- [ ] Error handling and response formatting
- [ ] Database access patterns
- [ ] Logging conventions
- [ ] Testing approach for Go code

**AC-3: API Standards**
- [ ] Endpoint naming conventions
- [ ] Request/response format standards
- [ ] Error response structure
- [ ] Authentication header requirements
- [ ] Pagination approach

**AC-4: Architecture Document Update**
- [ ] Review current `architecture.md`
- [ ] Update with patterns proven during Epic 1 & 2
- [ ] Add sequence diagrams for key flows if missing
- [ ] Document Clerk integration patterns
- [ ] Document caching patterns
- [ ] Ensure architecture matches actual implementation

**AC-5: Standards Document Created**
- [ ] Create `docs/coding-standards.md` (or `CONTRIBUTING.md`)
- [ ] Include code examples for each standard
- [ ] Reference specific files as examples
- [ ] Make standards actionable (do this, not that)

### Technical Notes

**Standards Format:**
```markdown
# Coding Standards - Shtetl Zmanim

## Frontend

### Components
**DO:**
```tsx
// Good example
```

**DON'T:**
```tsx
// Bad example
```

**Reference:** See `web/components/publisher/DashboardCard.tsx`
```

### Definition of Done

- [ ] `docs/coding-standards.md` created
- [ ] `docs/architecture.md` updated
- [ ] Code examples included for all standards
- [ ] Standards reviewed against codebase audit findings

---

## Story 3.4: Refactor to Standards

**As a** developer,
**I want** existing code refactored to match documented standards,
**So that** the codebase is consistent and maintainable.

### Background

With standards documented (Story 3.3) and technical debt identified (Story 3.2), this story applies the standards to existing code. This is the cleanup phase.

### Acceptance Criteria

**AC-1: Frontend Consistency**
- [ ] All components follow documented structure
- [ ] State management consistent across pages
- [ ] Form handling consistent
- [ ] Error/loading states consistent
- [ ] Import organization consistent

**AC-2: Backend Consistency**
- [ ] All handlers follow documented structure
- [ ] Error responses consistent
- [ ] Logging consistent
- [ ] Database access patterns consistent

**AC-3: Technical Debt Reduction**
- [ ] High-priority debt items from audit addressed
- [ ] TODO/FIXME comments resolved or converted to GitHub issues
- [ ] Incomplete features either completed or clearly marked as future work
- [ ] Hardcoded values moved to configuration where appropriate

**AC-4: Code Quality**
- [ ] No TypeScript `any` types without justification
- [ ] No console.log statements in production code
- [ ] No commented-out code blocks
- [ ] Consistent formatting (Prettier)

**AC-5: Verification**
- [ ] All E2E tests still passing after refactor
- [ ] No regressions in functionality
- [ ] Code review completed

### Technical Notes

**Refactor Approach:**
1. Work file-by-file or pattern-by-pattern
2. Run tests after each change
3. Commit frequently with clear messages
4. Don't change behavior, only structure

**Priority Order:**
1. High-impact inconsistencies (used everywhere)
2. Bug-prone patterns
3. Readability improvements
4. Nice-to-have cleanups

### Definition of Done

- [ ] All high-priority debt items addressed
- [ ] Codebase follows documented standards
- [ ] All E2E tests passing
- [ ] Code review approved
- [ ] No regressions

---

## Epic 3 Completion Checklist

- [ ] Story 3.0: Testing Infrastructure - DONE
- [ ] Story 3.1: Comprehensive E2E Test Suite - DONE
- [ ] Story 3.2: Codebase Audit & Documentation - DONE
- [ ] Story 3.3: Coding Standards & Architecture Update - DONE
- [ ] Story 3.4: Refactor to Standards - DONE
- [ ] All 50+ E2E tests passing
- [ ] `coding-standards.md` exists and is complete
- [ ] `architecture.md` updated
- [ ] Technical debt significantly reduced
- [ ] Team confident in foundation for Epic 4

---

## Next Epic Preview

**Epic 4: Algorithms** (Future)
- Enhanced algorithm editor
- Additional calculation methods
- Algorithm comparison tools
- Built on solid, tested, documented foundation from Epic 3

---

_Generated from Epic 1 & 2 Retrospective_
_Date: 2025-11-27_
