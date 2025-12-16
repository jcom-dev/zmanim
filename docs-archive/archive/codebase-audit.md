# Codebase Audit - Shtetl Zmanim

**Date:** 2025-11-27
**Author:** AI Development Agent (Story 3.2)
**Scope:** Epic 1 & 2 Implementation (24 stories, 66 FRs) + Stories 3.0 & 3.1 (Testing Infrastructure)
**Test Coverage:** 130+ E2E test scenarios

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Frontend Files (app/) | 26 TypeScript files |
| Total Components | 30 component files |
| Total Backend Files | 29 Go files |
| Total Test Files | 33 E2E test files |
| TODO Comments | 8 |
| FIXME Comments | 0 |
| HACK Comments | 0 |
| Console.log Statements | 4 (2 in middleware.ts, 2 in components) |
| Overall Code Quality | Good - established patterns, some inconsistencies |

---

## Frontend Patterns

### Component Structure

**Standard Pattern:**
```tsx
'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useState, useEffect, useCallback } from 'react';
import { ComponentName } from 'lucide-react';
import { usePublisherContext } from '@/providers/PublisherContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface LocalType {
  // Type definition
}

export function ComponentName() {
  // 1. Hooks first (Clerk, state, context)
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { selectedPublisher } = usePublisherContext();
  const [data, setData] = useState<Type | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 2. useCallback for async operations
  const fetchData = useCallback(async () => {
    const token = await getToken();
    const response = await fetch(`${API_BASE}/api/v1/endpoint`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Publisher-Id': selectedPublisher?.id,
      },
    });
    const data = await response.json();
    setData(data.data || data);
  }, [getToken, selectedPublisher]);

  // 3. useEffect for data fetching
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 4. Loading state
  if (!isLoaded || isLoading) return <LoadingComponent />;

  // 5. Error state
  if (error) return <ErrorComponent error={error} />;

  // 6. Render
  return (
    <div className="tailwind-classes">
      {/* Content */}
    </div>
  );
}
```

**Files Following Pattern:**
- `web/components/home/RoleNavigation.tsx` - Clean role-based rendering
- `web/components/publisher/PublisherSwitcher.tsx` - Good context usage
- `web/app/publisher/dashboard/page.tsx` - Full pattern implementation
- `web/components/shared/ProfileDropdown.tsx` - Complete with all patterns
- `web/providers/PublisherContext.tsx` - Exemplary context implementation

**Files With Variations:**
- `web/components/admin/ImpersonationBanner.tsx` - Uses inline SVG instead of Lucide icons
- `web/components/shared/PublisherCard.tsx` - Some inline SVG icons mixed with Lucide

**Recommendation:**
Standardize icon usage - prefer Lucide React icons over inline SVGs for consistency.

### State Management

**Clerk User State:**
- Pattern: `useUser()` and `useAuth()` hooks from `@clerk/nextjs`
- Metadata access: Type-casting `publicMetadata`

```tsx
const metadata = user.publicMetadata as {
  role?: string;
  publisher_access_list?: string[];
};
```

**Files Using Pattern:**
- `web/components/home/RoleNavigation.tsx:12-15`
- `web/components/shared/ProfileDropdown.tsx:33-34`
- `web/providers/PublisherContext.tsx:50-56`

**PublisherContext:**
- Pattern: React Context with Suspense boundary
- Provides: `selectedPublisherId`, `publishers`, `selectedPublisher`, impersonation state
- Used across all publisher-related pages
- File: `web/providers/PublisherContext.tsx`

**TanStack Query:**
- Pattern: `useQuery` for data fetching with caching
- File: `web/providers/QueryProvider.tsx`
- **Note:** Most pages use direct `fetch` with `useCallback` + `useEffect` instead of TanStack Query

**Inconsistencies:**
- Some pages use TanStack Query, others use raw fetch with useState
- API response handling varies: `data.data || data` fallback pattern used inconsistently

### Form Patterns

**Standard Pattern:**
```tsx
const [formData, setFormData] = useState({ field1: '', field2: '' });
const [isSubmitting, setIsSubmitting] = useState(false);
const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsSubmitting(true);
  // Validation, API call, error handling
};
```

**Files Using Pattern:**
- `web/app/admin/publishers/new/page.tsx`
- `web/app/become-publisher/page.tsx`
- `web/app/publisher/profile/page.tsx`

**Inconsistency:** No shared form utilities or validation library.

### API Integration Patterns

**Standard Fetch Pattern:**
```tsx
const token = await getToken();
const response = await fetch(`${API_BASE}/api/v1/endpoint`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Publisher-Id': publisherId,  // When context-specific
  },
  body: JSON.stringify(data),
});

if (!response.ok) {
  throw new Error('Operation failed');
}

const result = await response.json();
// Handle: result.data || result (fallback for wrapper)
```

**API Base Constant:**
```tsx
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
```

**Repeated in:**
- `web/app/publisher/dashboard/page.tsx:9`
- `web/app/publisher/profile/page.tsx`
- `web/app/admin/dashboard/page.tsx`
- `web/providers/PublisherContext.tsx:7`
- `web/components/shared/ProfileDropdown.tsx:18`

**Recommendation:** Create shared `web/lib/api.ts` with API client and centralize `API_BASE`.

### Layout Patterns

**Page Structure:**
```tsx
return (
  <div className="p-8">
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Page Title</h1>
        <p className="text-gray-400 mt-1">Subtitle</p>
      </div>

      {/* Content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Cards */}
      </div>
    </div>
  </div>
);
```

**Dark Mode Support:**
- Uses Tailwind's dark variants
- Slate color palette for backgrounds (`bg-slate-800`, `border-slate-700`)
- Gray variants for text (`text-gray-400`, `text-gray-500`)

**Responsive Design:**
- Grid layouts with `md:` breakpoints
- `max-w-6xl` or `max-w-7xl` container widths

### Icon Usage

**Standard Pattern:**
```tsx
import { IconName } from 'lucide-react';

<IconName className="w-4 h-4" />  // Small icons
<IconName className="w-8 h-8" />  // Large icons
```

**Commonly Used Icons:**
- Navigation: `Settings`, `Building2`, `UserPlus`, `User`, `MapPin`
- Actions: `Plus`, `Loader2`, `CheckCircle`, `AlertTriangle`
- UI: `Clock`, `Code`, `BarChart3`

**Files:** All under `web/components/` and `web/app/`

### Navigation Patterns

**Link Component:**
```tsx
import Link from 'next/link';

<Link
  href="/path"
  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
>
  <Icon className="w-4 h-4" />
  Link Text
</Link>
```

**Router Navigation:**
```tsx
import { useRouter } from 'next/navigation';
const router = useRouter();
router.push('/path');
router.replace('/path', { scroll: false });
```

---

## Backend Patterns

### Handler Structure

**Standard Pattern:**
```go
// HandlerName does X
// METHOD /api/v1/endpoint
func (h *Handlers) HandlerName(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Parse URL params
    id := chi.URLParam(r, "id")

    // 2. Validate required params
    if id == "" {
        RespondValidationError(w, r, "ID is required", nil)
        return
    }

    // 3. Parse request body (if POST/PUT)
    var req struct {
        Field1 string `json:"field1"`
        Field2 string `json:"field2"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondBadRequest(w, r, "Invalid request body")
        return
    }

    // 4. Validate request fields
    validationErrors := make(map[string]string)
    if req.Field1 == "" {
        validationErrors["field1"] = "Field1 is required"
    }
    if len(validationErrors) > 0 {
        RespondValidationError(w, r, "Validation failed", validationErrors)
        return
    }

    // 5. Database/Service operations
    result, err := h.db.Pool.Query(ctx, query, args...)
    if err != nil {
        slog.Error("operation failed", "error", err, "id", id)
        RespondInternalError(w, r, "Failed to process request")
        return
    }

    // 6. Success response
    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "result": result,
    })
}
```

**Files Following Pattern:**
- `api/internal/handlers/admin.go:17-59` - `AdminGetPublisherUsers`
- `api/internal/handlers/admin.go:63-124` - `AdminListPublishers`
- `api/internal/handlers/admin.go:129+` - `AdminCreatePublisher`
- `api/internal/handlers/coverage.go`
- `api/internal/handlers/publisher_algorithm.go`

### Response Helpers

**Location:** `api/internal/handlers/response.go`

**Available Functions:**
```go
RespondJSON(w, r, status, data)          // Success with data wrapper
RespondError(w, r, status, code, msg, details)
RespondValidationError(w, r, msg, details)  // 400
RespondNotFound(w, r, msg)                  // 404
RespondUnauthorized(w, r, msg)              // 401
RespondForbidden(w, r, msg)                 // 403
RespondRateLimited(w, r, retryAfter)        // 429
RespondInternalError(w, r, msg)             // 500
RespondBadRequest(w, r, msg)                // 400
RespondConflict(w, r, msg)                  // 409
RespondServiceUnavailable(w, r, msg)        // 503
```

**API Response Structure:**
```go
type APIResponse struct {
    Data  interface{}   `json:"data,omitempty"`
    Error *APIError     `json:"error,omitempty"`
    Meta  *ResponseMeta `json:"meta,omitempty"`
}
```

### Service Layer

**Standard Pattern:**
```go
type ServiceName struct {
    initialized bool
    // dependencies
}

func NewServiceName() (*ServiceName, error) {
    // Initialize dependencies
    return &ServiceName{initialized: true}, nil
}

func (s *ServiceName) MethodName(ctx context.Context, params...) (Result, error) {
    // Business logic
    if err != nil {
        return nil, fmt.Errorf("failed to do X: %w", err)
    }

    slog.Info("operation completed", "key", value)
    return result, nil
}
```

**Files Following Pattern:**
- `api/internal/services/clerk_service.go`
- `api/internal/services/email_service.go`
- `api/internal/services/publisher_service.go`
- `api/internal/services/algorithm_service.go`

### Database Access Patterns

**Connection Pool:**
```go
h.db.Pool.QueryRow(ctx, query, args...).Scan(&vars...)
h.db.Pool.Query(ctx, query, args...)
h.db.Pool.Exec(ctx, query, args...)
```

**Row Scanning Pattern:**
```go
rows, err := h.db.Pool.Query(ctx, query)
if err != nil {
    slog.Error("failed to query", "error", err)
    RespondInternalError(w, r, "Failed to retrieve data")
    return
}
defer rows.Close()

results := make([]map[string]interface{}, 0)
for rows.Next() {
    var field1, field2 string
    var optionalField *string

    err := rows.Scan(&field1, &field2, &optionalField)
    if err != nil {
        slog.Error("failed to scan row", "error", err)
        continue
    }

    result := map[string]interface{}{
        "field1": field1,
        "field2": field2,
    }
    if optionalField != nil {
        result["optional_field"] = *optionalField
    }
    results = append(results, result)
}
```

### Logging Patterns

**Standard slog Usage:**
```go
import "log/slog"

// Info level - normal operations
slog.Info("operation completed", "key1", value1, "key2", value2)

// Error level - failures
slog.Error("operation failed", "error", err, "context_key", contextValue)

// Warn level - recoverable issues
slog.Warn("unexpected state", "state", state)
```

**Structured Fields:**
- Always include `error` for errors
- Include relevant context: `user_id`, `publisher_id`, `email`
- Use snake_case for field names

### Clerk Integration Patterns

**Location:** `api/internal/services/clerk_service.go`

**User Creation:**
```go
params := &clerkUser.CreateParams{
    EmailAddresses:          &[]string{email},
    FirstName:               clerk.String(name),
    PublicMetadata:          clerk.JSONRawMessage(metadataJSON),
    SkipPasswordRequirement: clerk.Bool(true),
}
user, err := clerkUser.Create(ctx, params)
```

**Metadata Updates:**
```go
params := &clerkUser.UpdateMetadataParams{
    PublicMetadata: clerk.JSONRawMessage(metadataJSON),
}
_, err = clerkUser.UpdateMetadata(ctx, clerkUserID, params)
```

### Middleware Patterns

**Location:** `api/internal/middleware/`

**Auth Middleware:** Validates Clerk JWT and sets user context
**CORS Middleware:** Configures allowed origins from environment
**Logging Middleware:** Uses Chi's built-in request logging

---

## Testing Patterns (Stories 3.0 & 3.1)

### Test Organization

**Directory Structure:**
```
tests/
  e2e/
    admin/           # Admin flow tests
      publishers.spec.ts
      dashboard.spec.ts
      impersonation.spec.ts
    publisher/       # Publisher flow tests
      dashboard.spec.ts
      algorithm.spec.ts
      coverage.spec.ts
    user/            # End user tests
      location.spec.ts
      zmanim.spec.ts
    registration/    # Registration flows
    errors/          # Error handling tests
    setup/           # Global setup/teardown
    utils/           # Shared utilities
      clerk-auth.ts
      test-fixtures.ts
      email-testing.ts
      cleanup.ts
```

### Test File Pattern

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
    // Create shared test data
    testData = await createTestPublisherEntity();
  });

  test.afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  test.beforeEach(async ({ page }) => {
    // Login for each test
    await loginAsAdmin(page);
  });

  test('test description', async ({ page }) => {
    await page.goto(`${BASE_URL}/path`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Title' })).toBeVisible();
  });
});
```

**Files Following Pattern:**
- `tests/e2e/admin/publishers.spec.ts:1-150`
- `tests/e2e/publisher/dashboard.spec.ts`
- All files under `tests/e2e/`

### Auth Injection Pattern

**Location:** `tests/e2e/utils/clerk-auth.ts`

```typescript
import { setupClerkTestingToken, clerk } from '@clerk/testing/playwright';

async function performClerkSignIn(page: Page, email: string): Promise<void> {
  await page.goto(baseUrl);
  await page.waitForLoadState('domcontentloaded');

  await setupClerkTestingToken({ page });

  await page.waitForFunction(() => {
    return (window as any).Clerk?.loaded === true;
  }, { timeout: 30000 });

  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'password',
      identifier: email,
      password: TEST_PASSWORD,
    },
  });
}
```

**Login Helpers:**
- `loginAsAdmin(page)` - Signs in as admin role
- `loginAsPublisher(page, publisherId)` - Signs in linked to publisher
- `loginAsUser(page)` - Signs in as regular user

### Test Data Patterns

**Location:** `tests/e2e/utils/test-fixtures.ts`

**Naming Convention:**
- Entity prefix: `TEST_`
- Email domain: `test-zmanim.example.com`

**Fixture Functions:**
```typescript
createTestPublisherEntity(overrides?)  // Creates publisher in DB
createTestAlgorithm(publisherId)       // Creates algorithm
createTestCoverage(publisherId, cityId) // Creates coverage
cleanupTestData()                      // Idempotent cleanup
```

**Caching Pattern:**
```typescript
const testEntityCache = new Map<string, any>();

export async function createTestPublisherEntity(...) {
  const cacheKey = 'publisher-entity';
  if (testEntityCache.has(cacheKey)) {
    return testEntityCache.get(cacheKey);
  }
  // Create and cache
}
```

### Cleanup Patterns

**Idempotent Cleanup:**
- Can be run multiple times safely
- Uses `TEST_` prefix to identify test data
- Uses `test-zmanim.example.com` domain filter

**Global Teardown:**
- Runs after all tests complete
- Removes all test users from Clerk
- Removes all test data from database

---

## Technical Debt Inventory

| Priority | Item | Location | Impact | Notes |
|----------|------|----------|--------|-------|
| Medium | TODO: Calculation engine not implemented | `api/internal/services/algorithm_service.go:164` | Deferred functionality | Returns stub data |
| Medium | TODO: Calculation tracking deferred | `api/internal/handlers/admin.go:835` | Analytics incomplete | Part of Epic 4 |
| Medium | TODO: Cache stats retrieval deferred | `api/internal/handlers/admin.go:839` | Analytics incomplete | Part of Epic 4 |
| Low | TODO: Test admin user setup | `tests/e2e/admin.spec.ts:26` | Legacy comment | Tests now use Clerk auth |
| Low | TODO: Pass config through handlers | `api/internal/handlers/upload.go:128` | Testability improvement | Minor refactor |
| Medium | Console.log in middleware | `web/middleware.ts:26,42` | Should use proper logging | Remove or convert to server-side logging |
| Medium | Console.error scattered | `web/components/shared/ProfileDropdown.tsx:49,80` | Inconsistent error handling | Use error boundary or toast |
| Low | No shared form validation | Multiple pages | Code duplication | Consider react-hook-form |
| Medium | API_BASE repeated | 5+ files | Violates DRY | Centralize in lib/api.ts |
| Low | Mixed icon patterns | Some components | Inconsistency | Standardize on Lucide React |
| Low | No web/hooks/ directory | Missing pattern | Architecture gap | Create custom hooks |

### TODO/FIXME/HACK Comments

**Total Counts:**
- TODO: 8
- FIXME: 0
- HACK: 0

**TODO Details:**

1. `api/internal/services/algorithm_service.go:164`
   - `// TODO: Implement actual calculation engine`
   - Context: Calculation engine returns stub data
   - Priority: Medium (functionality works, but incomplete)

2. `api/internal/handlers/admin.go:835`
   - `// TODO: Implement calculation tracking in Task 5`
   - Context: Analytics feature deferred

3. `api/internal/handlers/admin.go:839`
   - `// TODO: Implement cache stats retrieval in Task 5`
   - Context: Analytics feature deferred

4. `api/internal/handlers/upload.go:128`
   - `// TODO: Pass config through handlers struct for better testability`
   - Context: Minor architecture improvement

5-8. `tests/e2e/admin.spec.ts:26,42,182` and `tests/e2e/algorithm-editor.spec.ts:22`
   - Legacy TODO comments in older test files
   - Context: Tests now use proper Clerk auth from Story 3.0

### Incomplete Features

- **Calculation Analytics:** Stats cards show "Coming soon" placeholder
- **Cache Statistics:** Admin dashboard shows 0 for cache stats
- **Activity Logging:** Backend ready, UI shows "Coming soon in a future update"

### Hardcoded Values

| Value | Location | Recommendation |
|-------|----------|----------------|
| `'http://localhost:8080'` | Multiple frontend files | Move to env variable |
| `'http://localhost:3001'` | Backend WEB_URL fallback | Already env variable |
| `TestPassword123!` | Test fixtures | Fine for tests |
| `test-zmanim.example.com` | Test fixtures | Fine for tests |

---

## Lessons Learned

### Successful Approaches

**1. Clerk Testing Integration**
- **What:** Using `@clerk/testing/playwright` for auth injection
- **Why It Works:** Bypasses bot detection, provides programmatic sign-in
- **Files:** `tests/e2e/utils/clerk-auth.ts`
- **Recommendation:** Continue this pattern for all auth testing

**2. PublisherContext Pattern**
- **What:** React Context with Suspense for multi-publisher state
- **Why It Works:** Clean state management, handles impersonation elegantly
- **Files:** `web/providers/PublisherContext.tsx`
- **Recommendation:** Use as template for future contexts

**3. Response Helper Pattern**
- **What:** Standardized API response helpers in Go
- **Why It Works:** Consistent error codes, automatic metadata
- **Files:** `api/internal/handlers/response.go`
- **Recommendation:** All handlers should use these helpers

**4. Test Data Caching**
- **What:** Map-based cache for test entities
- **Why It Works:** Avoids recreation, faster tests
- **Files:** `tests/e2e/utils/test-fixtures.ts`
- **Recommendation:** Continue caching pattern

### Gotchas

1. **Clerk Metadata Access:** Must type-cast `publicMetadata`:
   ```tsx
   const metadata = user.publicMetadata as { role?: string; ... };
   ```

2. **Test Email Domain:** Clerk doesn't accept `.local` domains. Use `example.com`:
   ```typescript
   const TEST_EMAIL_DOMAIN = 'test-zmanim.example.com';
   ```

3. **API Response Wrapper:** Frontend must handle both wrapped and unwrapped responses:
   ```tsx
   setData(data.data || data);
   ```

4. **X-Publisher-Id Header:** Publisher-specific endpoints require this header:
   ```tsx
   headers: { 'X-Publisher-Id': publisherId }
   ```

5. **networkidle Wait:** E2E tests should wait for `networkidle` after navigation:
   ```typescript
   await page.waitForLoadState('networkidle');
   ```

### Git History Insights

**Most Changed Files (Potential Hotspots):**
1. `docs/sprint-artifacts/sprint-status.yaml` (16 changes) - Status tracking
2. `.coder/startup.sh` (15 changes) - Dev environment setup
3. `api/internal/handlers/admin.go` (11 changes) - Admin functionality
4. `web/app/admin/publishers/page.tsx` (7 changes) - Publisher management UI
5. `api/internal/services/clerk_service.go` (4 changes) - Auth integration

**Notable Bug Fixes:**
1. `fix(auth): use typed context keys for user_id retrieval` - Context key collision
2. `fix(admin): unwrap API response for stats endpoint` - Response wrapper issue
3. `fix(auth): read role from public_metadata in JWT` - Clerk metadata access
4. `fix: create Clerk users directly instead of invitations` - Clerk workflow change
5. `fix(email): show both sign-in options for all users` - UX improvement

---

## Recommendations for Story 3.3

### Frontend Standards Needed

1. **Client Component Pattern:**
   - When to use `'use client'` directive
   - All pages with hooks need it (currently 46 files use it correctly)

2. **Clerk Metadata Type:**
   - Create shared type for `publicMetadata` to avoid inline type casts
   - Location: `web/types/clerk.ts`

3. **API Client:**
   - Centralize `API_BASE` and fetch helpers
   - Location: `web/lib/api.ts`

4. **Icon Usage:**
   - Standardize on Lucide React
   - Document icon size conventions: `w-4 h-4` (small), `w-8 h-8` (large)

5. **Form Handling:**
   - Consider adopting react-hook-form for validation
   - Create shared form patterns

### Backend Standards Needed

1. **Handler Template:**
   - Document the 6-step handler pattern
   - Validation → Service → Response

2. **Error Logging:**
   - Always include `"error", err` as first slog field
   - Include context identifiers (user_id, publisher_id)

3. **Service Pattern:**
   - Document constructor pattern with initialization flag
   - Context-first parameter convention

### Testing Standards Needed

1. **Test File Structure:**
   - `test.describe` for grouping
   - `beforeAll` for shared data
   - `afterAll` for cleanup
   - `beforeEach` for auth

2. **Test Data Naming:**
   - `TEST_` prefix for all test entities
   - `test-zmanim.example.com` for test emails

3. **Assertion Patterns:**
   - Prefer `getByRole` and `getByText` over `locator`
   - Always wait for `networkidle`

### Architecture Updates Needed

1. **Testing Architecture:**
   - Add testing infrastructure section to architecture.md
   - Document Clerk testing approach

2. **Context Patterns:**
   - Document PublisherContext as reference implementation
   - Show impersonation pattern

---

## Files Reviewed

### Frontend
- Total TypeScript files: 56
- Components: 30
- Pages: 23
- Contexts/Providers: 2
- Hooks: 0 (no dedicated hooks directory)

### Backend
- Total Go files: 29
- Handlers: 11
- Services: 5
- Middleware: 3
- Models: 4
- Other: 6

### Tests
- Total test files: 33
- Test utilities: 4
- Test specs: 29

---

## Next Steps

1. **Story 3.3:** Use this audit to create `docs/coding-standards.md`
2. **Story 3.3:** Update `docs/architecture.md` with proven patterns
3. **Story 3.4:** Address high/medium priority debt items
4. **Story 3.4:** Create `web/lib/api.ts` and centralize API calls
5. **Story 3.4:** Create `web/types/clerk.ts` with shared types

---

_Generated: 2025-11-27_
_Epic 1 & 2: 24 stories, 66 FRs_
_Epic 3: Stories 3.0 & 3.1, 130+ E2E tests_
