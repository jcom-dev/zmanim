# Story 3.3: Coding Standards & Architecture Update

**Epic:** Epic 3 - Consolidation & Quality
**Status:** ready-for-dev
**Priority:** P3
**Story Points:** 3

---

## User Story

**As a** developer,
**I want** clear coding standards and updated architecture documentation,
**So that** I know exactly how to write code that matches the project's patterns.

---

## Background

The audit (Story 3.2) identifies what patterns exist in the codebase. This story formalizes the best patterns into standards and updates architecture documentation to reflect reality.

By creating clear, actionable standards based on proven patterns, we ensure that future development (whether by humans or AI agents) follows consistent approaches. This prevents drift and makes the codebase easier to maintain.

---

## Acceptance Criteria

### AC-1: Frontend Coding Standards
- [x] Component naming and file structure conventions
- [x] Client vs Server component usage guidelines (`'use client'` directive)
- [x] State management guidelines (Clerk hooks, TanStack Query, Context)
- [x] Form handling standard approach
- [x] Error handling and loading state patterns
- [x] Styling approach (Tailwind conventions, responsive breakpoints)
- [x] Icon usage (Lucide React patterns)
- [x] Import organization
- [x] TypeScript usage guidelines (types for Clerk metadata, etc.)

### AC-2: Backend Coding Standards
- [x] Handler structure and naming conventions (Chi router patterns)
- [x] Service layer guidelines (context passing, error wrapping)
- [x] Error handling and response formatting (Respond helpers)
- [x] Database access patterns (pgx Pool usage)
- [x] Logging conventions (slog structured logging)
- [x] Clerk integration patterns (SDK usage, metadata updates)
- [x] Testing approach for Go code

### AC-3: Testing Standards
- [x] E2E test file organization (test.describe, beforeAll, afterAll, beforeEach)
- [x] Test data conventions (TEST_ prefix, test-zmanim.example.com domain)
- [x] Auth injection patterns (Clerk testing library usage)
- [x] Fixture usage patterns (test data creation and cleanup)
- [x] Cleanup conventions (idempotent, comprehensive)
- [x] Test naming conventions
- [x] Assertion patterns

### AC-4: API Standards
- [x] Endpoint naming conventions
- [x] Request/response format standards
- [x] Error response structure
- [x] Authentication header requirements
- [x] Status code usage
- [x] Pagination approach (if applicable)

### AC-5: Architecture Document Update
- [x] Review current `docs/architecture.md`
- [x] Add Testing Infrastructure section based on Stories 3.0 & 3.1
- [x] Update patterns proven during Epic 1 & 2
- [x] Document Clerk integration patterns
- [x] Document error handling patterns
- [x] Ensure architecture matches actual implementation
- [x] Add diagrams for key flows if needed

### AC-6: Standards Document Created
- [x] Create `docs/coding-standards.md`
- [x] Include code examples for each standard (copy from audit)
- [x] Reference specific files as examples
- [x] Make standards actionable (DO this, DON'T that)
- [x] Organize by category (Frontend, Backend, Testing, API)

---

## Technical Notes

### Standards Document Structure

```markdown
# Coding Standards - Shtetl Zmanim

**Purpose:** Ensure consistent code quality and patterns across the codebase
**Audience:** Developers (human and AI agents)
**Status:** Living document (update as patterns evolve)

---

## General Principles

1. **Consistency over cleverness** - Follow established patterns
2. **Explicit over implicit** - Be clear and obvious
3. **Tested over untested** - E2E tests are mandatory for user-facing changes
4. **Documented over undocumented** - Capture decisions and patterns

---

## Frontend Standards

### File Organization

```
web/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth routes (grouped)
│   ├── admin/             # Admin pages
│   ├── publisher/         # Publisher pages
│   └── zmanim/            # User-facing pages
├── components/
│   ├── ui/                # shadcn/ui components (don't modify directly)
│   ├── admin/             # Admin-specific components
│   ├── publisher/         # Publisher-specific components
│   ├── shared/            # Shared components
│   ├── home/              # Home page components
│   └── zmanim/            # Zmanim display components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and helpers
├── types/                 # TypeScript type definitions
└── providers/             # React context providers
```

### Component Structure

**DO: Use this pattern for client components**
```tsx
'use client';

import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { Icon } from 'lucide-react';

export function ComponentName() {
  const { user, isLoaded } = useUser();

  // Early return for loading states
  if (!isLoaded) return null;

  // Extract and type metadata
  const metadata = user.publicMetadata as {
    role?: string;
    publisher_access_list?: string[];
  };

  return (
    <div className="flex gap-3">
      {/* Component content */}
    </div>
  );
}
```

**Reference:** `web/components/home/RoleNavigation.tsx`

**DON'T: Don't use `'use client'` unless necessary**
- Only use for components that need hooks, event handlers, or browser APIs
- Server components are default in Next.js App Router

### Client vs Server Components

**Use Client Components (`'use client'`) when:**
- Using React hooks (useState, useEffect, useUser, etc.)
- Adding event listeners (onClick, onChange, etc.)
- Accessing browser APIs (localStorage, window, etc.)
- Using Clerk hooks (useUser, useAuth, etc.)

**Use Server Components (default) when:**
- Rendering static content
- Fetching data on the server
- No interactivity needed

### State Management

**Clerk User State:**
```tsx
import { useUser } from '@clerk/nextjs';

const { user, isLoaded } = useUser();

// ALWAYS check isLoaded before accessing user
if (!isLoaded) return <LoadingSpinner />;
if (!user) return <SignInPrompt />;

// Type-cast metadata for type safety
const metadata = user.publicMetadata as {
  role?: string;
  publisher_access_list?: string[];
};
```

**TanStack Query (if used):**
[Document usage pattern]

**Context API:**
[Document PublisherContext and other contexts]

### Styling

**Tailwind CSS:**
```tsx
// DO: Use utility classes
<div className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">

// DO: Use responsive prefixes
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

// DON'T: Don't use inline styles (except for dynamic values)
<div style={{ color: 'blue' }}>  // Bad
<div className="text-blue-600">  // Good
```

**Color Palette:**
- Admin: `slate-600`, `slate-500`
- Publisher: `blue-600`, `blue-700`
- User actions: `green-600`, `green-700`
- Danger: `red-600`, `red-700`

### Icons

```tsx
// DO: Use Lucide React
import { Settings, Building2, UserPlus } from 'lucide-react';

<Settings className="w-4 h-4" />

// Standard sizes:
// - Small: w-4 h-4
// - Medium: w-5 h-5
// - Large: w-6 h-6
```

### Error Handling

```tsx
// DO: Show user-friendly error messages
try {
  await apiCall();
} catch (error) {
  toast.error('Failed to save. Please try again.');
  console.error('API error:', error); // Keep detailed error in console
}

// DO: Show loading states
const [isLoading, setIsLoading] = useState(false);
```

### Import Organization

```tsx
// 1. React and framework imports
import { useState } from 'react';
import Link from 'next/link';

// 2. Third-party libraries
import { useUser } from '@clerk/nextjs';
import { Icon } from 'lucide-react';

// 3. Internal components and utilities
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

// 4. Types
import type { Publisher } from '@/types/publisher';
```

---

## Backend Standards

### Handler Structure

**DO: Follow this template**
```go
package handlers

import (
  "context"
  "log/slog"
  "net/http"

  "github.com/go-chi/chi/v5"
)

// HandlerName handles [description]
// METHOD /api/path/{param}
func (h *Handlers) HandlerName(w http.ResponseWriter, r *http.Request) {
  ctx := r.Context()
  param := chi.URLParam(r, "param")

  // 1. Extract and validate input
  if param == "" {
    RespondValidationError(w, r, "Param is required", nil)
    return
  }

  // 2. Call service layer
  result, err := h.service.DoSomething(ctx, param)
  if err != nil {
    slog.Error("operation failed", "error", err, "param", param)
    RespondInternalError(w, r, "Failed to process request")
    return
  }

  // 3. Respond with result
  RespondJSON(w, r, http.StatusOK, result)
}
```

**Reference:** `api/internal/handlers/admin.go`

**DON'T: Don't put business logic in handlers**
- Handlers should: extract params, validate, call services, respond
- Services should: contain business logic

### Service Layer

**DO: Follow this pattern**
```go
package services

import (
  "context"
  "fmt"
  "log/slog"
)

type ServiceName struct {
  dependency *SomeDependency
}

func NewServiceName(dep *SomeDependency) *ServiceName {
  return &ServiceName{dependency: dep}
}

// MethodName does [description]
func (s *ServiceName) MethodName(ctx context.Context, param string) (*Result, error) {
  // Business logic here

  if err != nil {
    return nil, fmt.Errorf("failed to do something: %w", err)
  }

  slog.Info("operation successful", "param", param)
  return result, nil
}
```

**Reference:** `api/internal/services/clerk_service.go`

### Error Handling

**Response Helpers (use these):**
```go
// 200 OK with JSON body
RespondJSON(w, r, http.StatusOK, data)

// 400 Bad Request
RespondValidationError(w, r, "message", validationErrors)

// 404 Not Found
RespondNotFound(w, r, "Resource not found")

// 500 Internal Server Error
RespondInternalError(w, r, "Failed to process")
```

**Reference:** `api/internal/handlers/response.go`

### Logging

**DO: Use structured logging with slog**
```go
import "log/slog"

// Error with context
slog.Error("operation failed", "error", err, "user_id", userId)

// Info with context
slog.Info("operation successful", "publisher_id", id)

// DON'T: Don't use fmt.Println or log.Println
fmt.Println("This is bad")  // Bad
slog.Info("This is good")    // Good
```

### Database Access

**DO: Use pgx Pool**
```go
// Query single row
var result Type
err := h.db.Pool.QueryRow(ctx, query, params...).Scan(&field1, &field2)
if err == pgx.ErrNoRows {
  return nil, ErrNotFound
}

// Query multiple rows
rows, err := h.db.Pool.Query(ctx, query, params...)
if err != nil {
  return nil, err
}
defer rows.Close()

for rows.Next() {
  // Scan rows
}
```

### Clerk Integration

**DO: Use Clerk SDK**
```go
import (
  "github.com/clerk/clerk-sdk-go/v2"
  clerkUser "github.com/clerk/clerk-sdk-go/v2/user"
)

// Set key once at service initialization
clerk.SetKey(secretKey)

// Use typed parameters
params := &clerkUser.UpdateParams{
  PublicMetadata: clerk.JSONRawMessage(metadataJSON),
}
```

**Reference:** `api/internal/services/clerk_service.go`

---

## Testing Standards

### Test File Organization

**DO: Use this pattern**
```typescript
import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  createTestPublisherEntity,
  cleanupTestData,
  BASE_URL,
} from '../utils';

test.describe('Feature Name', () => {
  let testData: TestDataType;

  test.beforeAll(async () => {
    // Create shared test data once
    testData = await createTestPublisherEntity({
      name: 'TEST_E2E_Feature_Name',
      status: 'verified',
    });
  });

  test.afterAll(async () => {
    // Clean up after all tests
    await cleanupTestData();
  });

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginAsAdmin(page);
  });

  test('test description', async ({ page }) => {
    await page.goto(`${BASE_URL}/path`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Expected' })).toBeVisible();
  });
});
```

**Reference:** `tests/e2e/admin/publishers.spec.ts`

### Test Data Conventions

**DO: Use TEST_ prefix and test domain**
```typescript
// Test entities
const publisher = await createTestPublisherEntity({
  name: 'TEST_E2E_Publisher_Name',  // TEST_ prefix
  organization: 'TEST_E2E_Org',
});

// Test emails
const email = `test-user-${Date.now()}@test-zmanim.example.com`;
```

**DON'T: Don't use .local domains**
```typescript
// Bad - Clerk doesn't accept .local
const email = 'test@test.zmanim.local';

// Good - Use example.com
const email = 'test@test-zmanim.example.com';
```

### Auth Injection

**DO: Use Clerk testing library**
```typescript
import { loginAsAdmin, loginAsPublisher } from '../utils';

// Admin test
test('admin can view dashboard', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/admin`);
  // ...
});

// Publisher test
test('publisher can view dashboard', async ({ page }) => {
  await loginAsPublisher(page, publisherId);
  await page.goto(`${BASE_URL}/publisher/dashboard`);
  // ...
});
```

**Reference:** `tests/e2e/utils/clerk-auth.ts`

### Cleanup

**DO: Always cleanup test data**
```typescript
test.afterAll(async () => {
  await cleanupTestData();  // Idempotent, comprehensive
});

// Or for specific cleanup
test.afterAll(async () => {
  await cleanupTestUsers();
  await cleanupTestData();
});
```

---

## API Standards

### Endpoint Naming

**Pattern:**
```
GET    /api/resource              - List
GET    /api/resource/{id}         - Get one
POST   /api/resource              - Create
PUT    /api/resource/{id}         - Update
DELETE /api/resource/{id}         - Delete

GET    /api/resource/{id}/nested  - Get nested resource
```

### Status Codes

- `200 OK` - Successful GET, PUT
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not authorized
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

---

## Code Review Checklist

Before submitting code, verify:

### Frontend
- [ ] Client components use `'use client'` only when needed
- [ ] Clerk `isLoaded` check before accessing user
- [ ] Proper error handling and loading states
- [ ] Tailwind classes used consistently
- [ ] Lucide icons imported correctly
- [ ] Imports organized properly

### Backend
- [ ] Handler follows template (params → validate → service → respond)
- [ ] Business logic in service layer
- [ ] Structured logging with slog
- [ ] Response helpers used
- [ ] Errors wrapped with context

### Testing
- [ ] E2E test for user-facing changes
- [ ] Test data uses TEST_ prefix
- [ ] Cleanup in afterAll
- [ ] Auth injection uses Clerk testing library

---

## When to Deviate

These standards are guidelines, not laws. Deviate when:
1. There's a good reason (document it in comments)
2. The pattern doesn't fit the use case
3. A better pattern emerges (update this document)

---

_Last Updated: [Date]_
_Based on: Epic 1 & 2 implementation, Story 3.2 audit_
```

### Architecture Update

Add to `docs/architecture.md`:

**New Section: Testing Infrastructure**
```markdown
## Testing Infrastructure

### E2E Testing with Playwright

**Test Organization:**
- Location: `tests/e2e/`
- Framework: Playwright with TypeScript
- Pattern: Domain-based organization (admin/, publisher/, user/, etc.)

**Authentication:**
- Library: `@clerk/testing/playwright`
- Utilities: `tests/e2e/utils/clerk-auth.ts`
- Pattern: Programmatic sign-in via `clerk.signIn()`

**Test Data:**
- Fixtures: `tests/e2e/utils/test-fixtures.ts`
- Naming: TEST_ prefix, test-zmanim.example.com domain
- Cleanup: Idempotent, comprehensive

**Coverage:**
- Story 3.0: Testing infrastructure (auth, fixtures, cleanup)
- Story 3.1: 130+ test scenarios (admin, publisher, user, errors)

**Reference:** Stories 3.0 & 3.1 implementation
```

---

## Definition of Done

- [x] All 6 acceptance criteria met
- [x] `docs/coding-standards.md` created with all sections
- [x] Code examples included for each standard
- [x] File references provided for all patterns
- [x] Standards are actionable (DO/DON'T format)
- [x] `docs/architecture.md` updated with testing section
- [x] Architecture reflects actual implementation
- [x] Document reviewed against Story 3.2 audit findings

---

## Dependencies

- Story 3.2: Codebase Audit & Documentation (uses findings to create standards)

---

## Dependent Stories

- Story 3.4: Refactor to Standards (implements these standards)

---

## Notes

This story is about **codifying reality**, not inventing new patterns. The standards should reflect what's actually working in the codebase (identified in Story 3.2), not what we wish we had.

The goal is to make implicit patterns explicit, so that:
1. New developers can quickly understand "the way we do things"
2. AI agents have clear guidelines to follow
3. Code reviews are faster (objective checklist)
4. Codebase consistency improves over time

Standards should be:
- **Clear:** No ambiguity about what to do
- **Practical:** Based on real code in the project
- **Actionable:** Specific "do this" / "don't do that"
- **Living:** Updated as better patterns emerge

---

## Status

**Status:** Done

---

## Dev Agent Record

### Completion Notes

**2025-11-27 - Story Implementation (YOLO Mode):**

✅ **Story 3.3 Complete** - Coding Standards & Architecture Update

**Deliverables:**

1. **`docs/coding-standards.md`** - Comprehensive coding standards document (~600 lines)
   - Frontend Standards: Component structure, state management, Clerk patterns, Tailwind styling, Lucide icons, form handling
   - Backend Standards: 6-step handler pattern, service layer, response helpers, slog logging, pgx database access, Clerk SDK
   - Testing Standards: Playwright patterns, auth injection, test data conventions, cleanup
   - API Standards: Endpoint naming, status codes, request/response format
   - Code Review Checklist: Frontend, backend, testing checklists

2. **`docs/architecture.md`** - Updated with Testing Infrastructure section (~190 lines added)
   - Test organization structure
   - Authentication pattern with @clerk/testing
   - Test data patterns and naming conventions
   - Cleanup patterns
   - Email testing with MailSlurp
   - Coverage summary (130+ scenarios)

**Key Standards Documented:**

| Category | Standards | Examples |
|----------|-----------|----------|
| Frontend | 8 patterns | Component structure, Clerk metadata, API integration |
| Backend | 6 patterns | Handler 6-step, response helpers, slog logging |
| Testing | 6 patterns | Auth injection, TEST_ prefix, cleanup |
| API | 5 patterns | Endpoint naming, status codes, headers |

---

## File List

**Created:**
- `docs/coding-standards.md` - Comprehensive coding standards

**Modified:**
- `docs/architecture.md` - Added Testing Infrastructure section
- `docs/sprint-artifacts/stories/3-3-coding-standards-architecture.md` - This file
- `docs/sprint-artifacts/sprint-status.yaml` - Status updated

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-27 | Story 3.3 complete - created coding-standards.md, updated architecture.md | AI Dev Agent |
