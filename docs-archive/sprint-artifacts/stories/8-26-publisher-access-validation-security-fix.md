# Story 8.26: Publisher Access Validation Security Fix

Status: done

## Story

As a platform operator,
I want the X-Publisher-Id header to be validated against the user's authorized publisher list,
So that users cannot access or modify data belonging to other publishers.

## Context

**CRITICAL SECURITY VULNERABILITY**

The `PublisherResolver.Resolve()` method in `api/internal/handlers/publisher_context.go` accepts any publisher ID from the `X-Publisher-Id` HTTP header **without validating** that the authenticated user has access to that publisher.

**Current vulnerable code (lines 54-59):**
```go
// 1. Try X-Publisher-Id header first
publisherID := r.Header.Get("X-Publisher-Id")
if publisherID != "" {
    pc.PublisherID = publisherID
    return pc, nil  // Returns immediately WITHOUT validation
}
```

**Attack Scenario:**
1. User A authenticates and receives a valid JWT
2. User A sends a request with `X-Publisher-Id: <Publisher B's ID>`
3. The resolver returns Publisher B's ID without checking access
4. User A can now: read, modify, delete Publisher B's zmanim, algorithms, coverage, team, etc.

**Affected Routes:** All 50+ `/api/v1/auth/publisher/*` routes that use `MustResolve()`.

**Irony:** The middleware in `api/internal/middleware/auth.go` already has a `GetValidatedPublisherID()` function that properly validates access - but it's never called in the publisher resolver.

## Acceptance Criteria

1. X-Publisher-Id header is validated against user's `publisher_access_list` from JWT claims
2. Admin users can access any publisher via X-Publisher-Id (existing behavior preserved)
3. Non-admin users receive 403 Forbidden when requesting unauthorized publisher
4. Query parameter `publisher_id` follows same validation rules
5. Database fallback (lookup by clerk_user_id) remains unchanged (already secure)
6. All existing E2E tests pass
7. New tests verify unauthorized access is blocked

## Tasks / Subtasks

- [x] Task 1: Update PublisherResolver to validate access
  - [x] 1.1 Import middleware package in publisher_context.go
  - [x] 1.2 Extract publisher_access_list from context (set by RequireRole middleware)
  - [x] 1.3 For admin users: allow any publisher ID (no change)
  - [x] 1.4 For non-admin users: validate requested ID is in access list
  - [x] 1.5 Return error if validation fails
- [x] Task 2: Update middleware to populate access list
  - [x] 2.1 Ensure RequireRole middleware extracts `publisher_access_list` from JWT claims
  - [x] 2.2 Store access list in context using existing `PublisherAccessListKey`
  - [x] 2.3 Verify claims structure matches Clerk JWT format
- [x] Task 3: Update error responses
  - [x] 3.1 MustResolve returns 403 Forbidden (not 404) for unauthorized access
  - [x] 3.2 Error message: "Access denied to publisher {id}"
  - [x] 3.3 Log unauthorized attempts with user ID and requested publisher ID
- [x] Task 4: Testing
  - [x] 4.1 Unit test: user with access to publisher 1 can access publisher 1
  - [x] 4.2 Unit test: user with access to publisher 1 CANNOT access publisher 2
  - [x] 4.3 Unit test: admin can access any publisher
  - [x] 4.4 Unit test: user with multiple publishers can switch between them
  - [x] 4.5 Integration test: cross-publisher access attempt returns 403
  - [x] 4.6 All existing E2E tests pass

## Dev Notes

### Key Files
- `api/internal/handlers/publisher_context.go` - Main fix location
- `api/internal/middleware/auth.go` - Has GetValidatedPublisherID() to reference
- `api/internal/handlers/publisher_context_test.go` - New test file

### Validation Logic (Proposed)
```go
func (pr *PublisherResolver) Resolve(ctx context.Context, r *http.Request) (*PublisherContext, error) {
    userID := middleware.GetUserID(ctx)
    userRole := middleware.GetUserRole(ctx)
    isAdmin := userRole == "admin"
    accessList := middleware.GetPublisherAccessList(ctx)

    pc := &PublisherContext{
        UserID:   userID,
        UserRole: userRole,
        IsAdmin:  isAdmin,
    }

    // 1. Try X-Publisher-Id header first
    publisherID := r.Header.Get("X-Publisher-Id")
    if publisherID != "" {
        // SECURITY FIX: Validate access
        if !isAdmin && !contains(accessList, publisherID) {
            slog.Warn("unauthorized publisher access attempt",
                "user_id", userID,
                "requested_publisher", publisherID,
                "allowed_publishers", accessList)
            return nil, fmt.Errorf("access denied to publisher %s", publisherID)
        }
        pc.PublisherID = publisherID
        return pc, nil
    }
    // ... rest unchanged
}
```

### JWT Claims Structure (Clerk)
```json
{
  "sub": "user_xxx",
  "metadata": {
    "role": "publisher",
    "primary_publisher_id": "1",
    "publisher_access_list": ["1", "3", "5"]
  }
}
```

## References

- **Coding Standards:** [docs/coding-standards.md](../../coding-standards.md) - MUST READ before implementation
- **Global Standards:** [docs/coding-standards-global.md](../../coding-standards-global.md)
- **Context File:** [8-26-publisher-access-validation-security-fix.context.xml](./8-26-publisher-access-validation-security-fix.context.xml)
- **Tech Design:** See "Validation Logic (Proposed)" section above

## Definition of Done (DoD)

**All items must be checked before marking story "Ready for Review":**

### Code Quality
- [x] X-Publisher-Id validated against user's access list
- [x] Unauthorized access returns 403 Forbidden (not 404)
- [x] Admin bypass works correctly (can access any publisher)
- [x] Security logging captures unauthorized attempts (user_id, requested_publisher)
- [x] PublisherResolver pattern followed (per coding standards)

### Testing
- [x] Unit tests created: `api/internal/handlers/publisher_context_test.go`
  - [x] Test: user with access to publisher 1 can access publisher 1
  - [x] Test: user with access to publisher 1 CANNOT access publisher 2 (403)
  - [x] Test: admin can access any publisher
  - [x] Test: user with multiple publishers can switch between them
- [x] Backend tests pass: `cd api && go test ./...`
- [x] E2E tests pass: `cd tests && npx playwright test` (112 passed, 18 skipped)
- [x] Security test: Verify cross-publisher access returns 403

### Verification Commands
```bash
# Backend tests (including new security tests)
cd api && go test ./internal/handlers/... -v -run Publisher

# Full backend test suite
cd api && go test ./...

# E2E tests
cd tests && npx playwright test

# Manual security test (with user JWT for publisher 1)
curl -H "Authorization: Bearer $USER_JWT" \
     -H "X-Publisher-Id: 999" \
     http://localhost:8080/api/v1/auth/publisher/profile
# Expected: 403 Forbidden

# Manual admin test (admin can access any publisher)
curl -H "Authorization: Bearer $ADMIN_JWT" \
     -H "X-Publisher-Id: 999" \
     http://localhost:8080/api/v1/auth/publisher/profile
# Expected: 200 OK (or 404 if publisher doesn't exist)
```

## Estimated Points

5 points (Security - Critical Priority)

## Implementation Summary

### Security Fix Completed

The critical security vulnerability has been **fully resolved**. All acceptance criteria met:

**1. Validation Implementation (`publisher_context.go`)**
- Lines 60-67: X-Publisher-Id header validation
- Lines 75-82: Query parameter `publisher_id` validation
- Both paths validate access list for non-admin users
- Admin users bypass validation (can access any publisher)
- Database fallback (lines 87-98) remains secure (already validated by Clerk user ID)

**2. Middleware Support (`auth.go`)**
- Lines 280-281: `RequireRole` middleware populates `PublisherAccessListKey` in context
- Lines 146-158: `getPublisherAccessListFromClaims` extracts list from JWT metadata
- Lines 189-195: `GetPublisherAccessList` helper retrieves list from context

**3. Error Handling (`publisher_context.go`)**
- Lines 127-134: `MustResolve` detects "access denied" errors and returns 403 Forbidden
- Lines 62-65, 77-80: Structured logging captures user_id, requested_publisher, allowed_publishers
- Error message format: "access denied to publisher {id}"

**4. Comprehensive Tests (`publisher_context_test.go`)**
- 20 test cases covering all security scenarios
- Tests 215-242: Admin can access any publisher
- Tests 244-271: User can access authorized publisher
- Tests 273-298: User CANNOT access unauthorized publisher (CRITICAL)
- Tests 300-349: Query parameter validation
- Tests 351-381: Multi-publisher switching
- Tests 383-427: Edge cases (empty/nil access lists)
- Tests 429-452: MustResolve returns 403
- Tests 454-501: ResolveOptional behavior
- All tests PASS ✓

**5. Security Logging**
Sample log output from tests:
```
WARN unauthorized publisher access attempt user_id=user_123 requested_publisher=2 allowed_publishers="[1 3]"
```

### Test Results
```bash
$ cd api && go test ./internal/handlers/... -v -run TestPublisherResolver
=== RUN   TestPublisherResolver_Resolve_WithHeader_UserCannotAccessUnauthorized
2025/12/14 15:30:35 WARN unauthorized publisher access attempt user_id=user_123 requested_publisher=2 allowed_publishers="[1 3]"
--- PASS: TestPublisherResolver_Resolve_WithHeader_UserCannotAccessUnauthorized (0.00s)
...
PASS
ok  	github.com/jcom-dev/zmanim/internal/handlers	0.005s

$ cd api && go test ./...
ok  	github.com/jcom-dev/zmanim/internal/handlers	(cached)
ok  	github.com/jcom-dev/zmanim/internal/middleware	(cached)
...
All tests PASS
```

### Impact
- **Before Fix:** Users could access ANY publisher by manipulating X-Publisher-Id header
- **After Fix:** Users can only access publishers in their JWT `publisher_access_list`
- **Admin Behavior:** Unchanged - admins can still access any publisher
- **Attack Surface:** Reduced from 50+ vulnerable endpoints to ZERO
- **Breaking Changes:** NONE - legitimate usage patterns unchanged

## Dev Agent Record

### Context Reference

This story was created from Epic 8 security audit findings identifying a critical IDOR vulnerability in the PublisherResolver pattern. The vulnerability allowed any authenticated user to access any publisher's data by manipulating the X-Publisher-Id header.

### Agent Model Used

Claude Opus 4.5

### Debug Log References

No debug logs required - implementation was straightforward following existing security patterns in the codebase.

### Completion Notes List

1. **Security vulnerability identified**: The PublisherResolver.Resolve() method accepted any X-Publisher-Id header value without validating against the user's authorized publisher list from JWT claims.

2. **Fix implemented**: Modified PublisherResolver to validate header/query parameter publisher IDs against the publisher_access_list claim. Admin users bypass validation (can access any publisher), non-admin users receive 403 Forbidden for unauthorized access.

3. **Comprehensive test coverage**: Created 20 unit tests in publisher_context_test.go covering all security scenarios including authorized access, unauthorized access (returns 403), admin bypass, multi-publisher switching, and edge cases.

4. **Security logging added**: All unauthorized access attempts are logged with structured logging including user_id, requested_publisher, and allowed_publishers for security auditing.

5. **E2E validation**: All 112 E2E tests pass, confirming no regressions and proper security enforcement across the application.

6. **Attack surface eliminated**: Fixed 50+ vulnerable endpoints that use MustResolve(), completely eliminating the IDOR vulnerability.

### File List

**Backend (Go)**
- `api/internal/handlers/publisher_context.go` - Added access validation logic (lines 60-82, 127-134)
- `api/internal/handlers/publisher_context_test.go` - Created comprehensive test suite with 20 test cases
- `api/internal/middleware/auth.go` - Enhanced to populate PublisherAccessListKey in context

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-14 | Story drafted from security audit findings | Claude Opus 4.5 |
| 2025-12-14 | Security fix implemented with comprehensive tests - ALL PASS | Claude Opus 4.5 |
| 2025-12-15 | E2E tests validated, Dev Agent Record added, status updated to done | Claude Sonnet 4.5 |
