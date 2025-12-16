# ADR-003: PublisherResolver Pattern for Publisher Endpoints

**Status:** Accepted
**Date:** 2025-11-18
**Deciders:** Architecture Team
**Impact:** High (Required for publisher endpoints)

## Context

Publisher-scoped endpoints require both:
1. **User authentication** (Clerk token validation)
2. **Publisher context** (X-Publisher-Id header)

Before PublisherResolver, handlers manually extracted context:
```go
// Repeated in 20+ handlers
userID := middleware.GetUserID(ctx)
publisherIDStr := r.Header.Get("X-Publisher-Id")
if publisherIDStr == "" {
    RespondBadRequest(w, r, "X-Publisher-Id header required")
    return
}
publisherID, err := strconv.ParseInt(publisherIDStr, 10, 32)
if err != nil {
    RespondBadRequest(w, r, "Invalid publisher ID")
    return
}

// Verify user has access to publisher
hasAccess, err := h.db.Queries.CheckPublisherAccess(ctx, userID, publisherID)
if err != nil || !hasAccess {
    RespondForbidden(w, r, "Access denied")
    return
}
```

**Problems:**
- 15+ handlers with duplicated validation logic
- Inconsistent error messages
- Forgot access check in 3 handlers → security bug
- Hard to test (mock middleware + headers + DB query)
- 10+ lines before actual handler logic

## Decision

**ALL publisher-scoped endpoints MUST use PublisherResolver.**

**Service:** `api/internal/services/publisher_resolver.go`

```go
func (h *Handlers) HandlerName(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Step 1: Resolve publisher context (auto-validates everything)
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil {
        return // Error response already sent
    }

    // Step 2+: Use pc.PublisherID, pc.UserID
    zmanim, err := h.db.Queries.ListPublisherZmanim(ctx, pc.PublisherID)
    // ...
}
```

## Architecture

### PublisherContext Struct

```go
type PublisherContext struct {
    UserID         string // Clerk user ID
    PublisherID    int32  // Selected publisher ID
    IsAdmin        bool   // User has admin role
    IsImpersonating bool  // Admin impersonating publisher
}
```

### Resolver Methods

```go
type PublisherResolver interface {
    // MustResolve: Returns nil + sends error response if fails
    MustResolve(w http.ResponseWriter, r *http.Request) *PublisherContext

    // Resolve: Returns error for custom handling
    Resolve(ctx context.Context, r *http.Request) (*PublisherContext, error)

    // ResolveOptional: Returns nil (no error) if publisher context missing
    // For mixed endpoints (work with or without publisher context)
    ResolveOptional(ctx context.Context, r *http.Request) *PublisherContext
}
```

### Validation Steps

PublisherResolver automatically:
1. ✅ Validates user authentication (from middleware)
2. ✅ Extracts X-Publisher-Id header
3. ✅ Parses publisher ID (int32)
4. ✅ Queries database for publisher existence
5. ✅ Verifies user has access to publisher
6. ✅ Checks publisher status (not suspended)
7. ✅ Handles admin impersonation

## Consequences

### Positive
✅ **DRY:** 10 lines → 1 line per handler
✅ **Security:** Impossible to forget access check
✅ **Consistency:** Same validation logic everywhere
✅ **Testability:** Mock resolver, not middleware + DB
✅ **Error messages:** Consistent user-facing errors
✅ **Maintainability:** Change validation → update one file

### Negative
✗ **Coupling:** Handlers depend on resolver service
✗ **Magic:** Less explicit than manual validation
✗ **Overhead:** Extra DB query per request (mitigated by caching)

**Trade-off accepted:** Security and consistency worth coupling.

## Compliance Verification

**Detection:**
```bash
# Find handlers using manual header extraction
grep -rn "r.Header.Get(\"X-Publisher-Id\")" api/internal/handlers/ --include="*.go"
# Should return 0 results
```

**Current Status:** 24/28 publisher handlers use resolver (86%)
**Missing:** 4 handlers need migration

**Exemptions:**
- Public endpoints (zmanim.go, cities.go) - no publisher context
- Admin endpoints (admin.go) - admin auth only

## Examples

### ✓ Correct (PublisherResolver)

```go
func (h *Handlers) ListPublisherZmanim(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Step 1: Resolve publisher context
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil {
        return // Error already sent (401/403/400)
    }

    // Step 2: Use publisher ID
    zmanim, err := h.db.Queries.ListPublisherZmanim(ctx, pc.PublisherID)
    if err != nil {
        slog.Error("failed to list zmanim", "error", err, "publisher_id", pc.PublisherID)
        RespondInternalError(w, r, "Failed to retrieve zmanim")
        return
    }

    RespondJSON(w, r, http.StatusOK, zmanim)
}
```

### ✓ Custom Error Handling

```go
func (h *Handlers) SpecialHandler(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    pc, err := h.publisherResolver.Resolve(ctx, r)
    if err != nil {
        // Custom error handling
        slog.Warn("publisher resolution failed", "error", err)
        RespondJSON(w, r, http.StatusOK, defaultResponse)
        return
    }

    // Use pc.PublisherID
}
```

### ✓ Optional Publisher Context

```go
func (h *Handlers) MixedEndpoint(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Works with or without publisher context
    pc := h.publisherResolver.ResolveOptional(ctx, r)

    if pc != nil {
        // Publisher-specific logic
        data := getPublisherData(pc.PublisherID)
    } else {
        // Public logic
        data := getPublicData()
    }

    RespondJSON(w, r, http.StatusOK, data)
}
```

### ✗ Forbidden (Manual Extraction)

```go
// FORBIDDEN - Manual header extraction
func (h *Handlers) BadHandler(w http.ResponseWriter, r *http.Request) {
    publisherIDStr := r.Header.Get("X-Publisher-Id")
    if publisherIDStr == "" {
        RespondBadRequest(w, r, "Missing header")
        return
    }

    publisherID, _ := strconv.Atoi(publisherIDStr)
    // SECURITY BUG: No access check!
    // SECURITY BUG: No publisher existence check!
    // SECURITY BUG: No status validation!
}
```

## Access Control Logic

### Publisher Member
User can access publisher if:
- User's `publisher_access_list` (Clerk metadata) contains publisher ID
- OR publisher's `primary_publisher_id` matches publisher ID

### Admin Impersonation
Admins can access any publisher:
- User has `role: 'admin'` in Clerk metadata
- Sets `IsImpersonating: true` in context

### Status Validation
Publisher must be active:
- Status is NOT 'suspended' or 'deleted'
- Future: Check subscription status

## Caching Strategy

To reduce DB queries, resolver can cache:
- Publisher access list (5-minute TTL)
- Publisher status (1-minute TTL)

```go
// Future optimization
type cachedPublisherContext struct {
    PublisherID int32
    IsValid     bool
    CachedAt    time.Time
}
```

## Error Responses

| Scenario | Status | Message |
|----------|--------|---------|
| Missing X-Publisher-Id | 400 | "X-Publisher-Id header required" |
| Invalid publisher ID | 400 | "Invalid publisher ID format" |
| Publisher not found | 404 | "Publisher not found" |
| Access denied | 403 | "You do not have access to this publisher" |
| Publisher suspended | 403 | "Publisher account is suspended" |
| No authentication | 401 | "Authentication required" |

## Integration with Middleware

PublisherResolver works with auth middleware:

```go
// In main.go
r.Route("/publisher", func(r chi.Router) {
    r.Use(middleware.RequireAuth)  // Step 1: Validate Clerk token
    r.Get("/zmanim", handlers.ListZmanim)  // Step 2: Resolver validates publisher
})
```

## Testing

Mock resolver for unit tests:

```go
type MockPublisherResolver struct {
    ResolveFunc func(ctx context.Context, r *http.Request) (*PublisherContext, error)
}

func TestHandler(t *testing.T) {
    resolver := &MockPublisherResolver{
        ResolveFunc: func(ctx, r) (*PublisherContext, error) {
            return &PublisherContext{
                PublisherID: 123,
                UserID: "user_123",
            }, nil
        },
    }

    h := &Handlers{publisherResolver: resolver}
    // Test handler
}
```

## Migration Path

For handlers with manual validation:
1. Remove header extraction code
2. Remove access check query
3. Add `pc := h.publisherResolver.MustResolve(w, r)`
4. Replace manual `publisherID` with `pc.PublisherID`
5. Delete old validation code
6. Test with valid/invalid publisher IDs

**Lines saved per handler:** ~10-15 lines

## Related Standards

- Backend Standards: 6-step handler pattern
- API Standards: X-Publisher-Id header required
- Security: All publisher endpoints must validate access

## Related ADRs

- ADR-001: SQLc Mandatory (resolver queries use SQLc)
- ADR-002: useApi Pattern (frontend sends X-Publisher-Id)

## Review Checklist

When reviewing PRs:
- [ ] Publisher endpoints use `publisherResolver.MustResolve()`
- [ ] No manual `r.Header.Get("X-Publisher-Id")`
- [ ] No manual access check queries
- [ ] Uses `pc.PublisherID`, not extracted variable
- [ ] Public endpoints do NOT use resolver

## Future Enhancements

- [ ] Add caching layer (Redis)
- [ ] Support multiple publishers per request (bulk operations)
- [ ] Add rate limiting per publisher
- [ ] Track publisher API usage metrics

## Last Audit

**Date:** 2025-12-07
**Result:** 24/28 publisher handlers compliant (86%)
**Target:** 100% by 2025-12-15
**Next Review:** 2026-01-07
