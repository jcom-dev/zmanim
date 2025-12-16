# Story 8.4: External API - Clerk M2M Authentication

Status: done

## Story

As a developer integrating with Shtetl Zmanim,
I want API key authentication via Clerk M2M tokens,
So that my backend can securely access zmanim data.

## Acceptance Criteria

1. Clerk M2M token validation middleware created
2. `/external/*` routes protected by M2M auth middleware
3. Tokens can be created in Clerk dashboard (documented)
4. Token validation returns client_id for logging
5. Rate limiting headers returned on all external API responses
6. Documentation for obtaining and using M2M tokens

## Tasks / Subtasks

- [x] Task 1: Create M2M auth middleware (AC: 1, 4)
  - [x] 1.1 Create `api/internal/middleware/m2m_auth.go`
  - [x] 1.2 Implement Clerk M2M token verification
  - [x] 1.3 Extract and validate M2M-specific claims
  - [x] 1.4 Set client_id in context for downstream use
  - [x] 1.5 Return 401 for invalid tokens
- [x] Task 2: Register middleware for external routes (AC: 2)
  - [x] 2.1 Create `/external/*` route group in main.go
  - [x] 2.2 Apply M2M auth middleware to group
  - [x] 2.3 Add placeholder endpoints for testing
- [x] Task 3: Create rate limiting middleware (AC: 5)
  - [x] 3.1 Enhanced existing `api/internal/middleware/ratelimit.go`
  - [x] 3.2 Token bucket algorithm already implemented
  - [x] 3.3 Rate limit headers already in responses
  - [x] 3.4 In-memory counters used (Redis not needed for rate limiting)
- [x] Task 4: Add rate limit headers (AC: 5)
  - [x] 4.1 Add X-RateLimit-Limit header
  - [x] 4.2 Add X-RateLimit-Remaining header
  - [x] 4.3 Add X-RateLimit-Reset header
- [x] Task 5: Create documentation (AC: 3, 6)
  - [x] 5.1 Document M2M token creation in Clerk
  - [x] 5.2 Document API authentication flow
  - [x] 5.3 Add example requests with Bearer token
  - [x] 5.4 Document rate limits
- [x] Task 6: Testing (AC: 1-5)
  - [x] 6.1 Test valid M2M token acceptance
  - [x] 6.2 Test invalid token rejection
  - [x] 6.3 Test client_id extraction
  - [x] 6.4 Test rate limit headers presence

## Dev Notes

### M2M Auth Middleware Pattern
```go
func (h *Handlers) M2MAuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := extractBearerToken(r)
        if token == "" {
            RespondUnauthorized(w, r, "Missing M2M token")
            return
        }

        claims, err := clerk.VerifyToken(token)
        if err != nil {
            RespondUnauthorized(w, r, "Invalid M2M token")
            return
        }

        // Verify this is an M2M token (not a user JWT)
        if !isM2MToken(claims) {
            RespondUnauthorized(w, r, "User tokens not accepted for external API")
            return
        }

        ctx := context.WithValue(r.Context(), "client_id", claims.Subject)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

### Rate Limit Headers
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1702200000  (Unix timestamp)
```

### Project Structure Notes
- Middleware: `api/internal/middleware/m2m_auth.go`, `rate_limit.go`
- Routes: Add `/external/*` group in `api/cmd/api/main.go`
- Documentation: `docs/external-api.md`

### Dependencies
- Clerk Go SDK for M2M token verification
- Redis for rate limit counters (existing Upstash connection)

### References
- [Source: docs/sprint-artifacts/epic-8-finalize-and-external-api.md#Story 8.4]
- [Source: docs/architecture.md#Authentication] - Clerk integration
- [Source: api/internal/middleware/auth.go] - Existing auth patterns

## Definition of Done (DoD)

**All items must be checked before marking story "Ready for Review":**

- [x] **Code Complete:**
  - [x] M2M auth middleware created (`m2m_auth.go`)
  - [x] `/external/*` route group registered with middleware
  - [x] Rate limit middleware enhanced (`ratelimit.go`)
  - [x] Rate limit headers added to responses
- [x] **Unit Tests Pass:**
  - [x] `cd api && go test ./internal/middleware/... -run M2M` passes
  - [x] `cd api && go test ./internal/middleware/... -run RateLimit` passes
- [x] **Integration Tests Written & Pass:**
  - [x] Test valid M2M token acceptance
  - [x] Test invalid token rejection (401)
  - [x] Test user JWT rejection on M2M endpoints (401)
  - [x] Test client_id extracted from token
  - [x] Test rate limit headers present
- [x] **Manual Verification:**
  - [x] Clerk M2M token validation implemented in `api/internal/middleware/m2m_auth.go`
  - [x] M2M middleware applied to `/external/*` routes in `api/cmd/api/main.go`
  - [x] Rate limiting per client_id implemented (10,000 req/hr default)
  - [x] Error responses follow spec (401 for invalid/missing tokens, structured error format)
  - [x] API usage logging implemented via `LoggingMiddleware` (logs client_id, method, path, user_agent)
  - [x] Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset) implemented
- [x] **Documentation:** API docs for M2M setup created/updated
- [x] **No Regressions:** `cd api && go test ./...` passes
- [x] **Type Check:** N/A - no frontend changes (backend only)

**CRITICAL: Agent must run ALL tests and verify they pass before marking story ready for review.**

## Dev Agent Record

### Context Reference

- [8-4-external-api-clerk-m2m-authentication.context.xml](./8-4-external-api-clerk-m2m-authentication.context.xml)

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

No critical issues encountered. All tests passed on first run after fixing unused import.

### Completion Notes List

**Remediation (2025-12-15):**
- Completed manual verification of all DoD items
- Verified M2M token validation middleware implementation
- Verified rate limiting per API key (client_id based)
- Verified error response format follows spec (structured JSON with error code/message)
- Verified API usage logging (client_id, method, path, user_agent)
- All tests pass successfully (middleware and full API test suite)
- Updated story status from "review" to "done"

1. **M2M Authentication Implementation:**
   - Created comprehensive M2M auth middleware in `api/internal/middleware/m2m_auth.go`
   - Implemented token validation using existing Clerk JWT verification infrastructure
   - Distinguished M2M tokens from user JWTs by checking for user-specific metadata
   - Extracted and stored `client_id` in request context for logging and rate limiting

2. **Route Group Registration:**
   - Added `/api/v1/external/*` route group in `api/cmd/api/main.go`
   - Applied M2M auth middleware, logging middleware, and rate limiting
   - Created placeholder `/external/health` endpoint for testing

3. **Rate Limiting Enhancement:**
   - Enhanced existing `ratelimit.go` to support M2M-specific rate limits
   - Added `M2MRequestsPerHour` config field (default: 10,000 req/hr)
   - Updated `getClientKey()` to use `m2m:<client_id>` prefix
   - Updated `getLimit()` to return M2M-specific limits for M2M clients

4. **Documentation:**
   - Created comprehensive `docs/external-api.md` with:
     - M2M token creation guide
     - Authentication examples
     - Rate limiting documentation
     - Error handling best practices
     - Code examples for token refresh and rate limit handling

5. **Testing:**
   - Created `m2m_auth_test.go` with 10+ test cases
   - All tests pass successfully
   - Tests cover: token validation, client ID extraction, M2M detection, error cases

6. **Design Decisions:**
   - Used in-memory rate limiting (existing pattern) instead of Redis
   - M2M token detection based on absence of user metadata (role, publisher_id)
   - Client ID extracted from JWT subject claim
   - Rate limit headers already implemented in existing middleware

### File List

**New Files:**
- `api/internal/middleware/m2m_auth.go` - M2M authentication middleware (195 lines)
- `api/internal/middleware/m2m_auth_test.go` - Comprehensive test suite (246 lines)
- `docs/external-api.md` - External API documentation (325 lines)

**Modified Files:**
- `api/cmd/api/main.go` - Added `/external` route group with M2M middleware
- `api/internal/middleware/ratelimit.go` - Enhanced to support M2M rate limiting

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-13 | Story drafted from Epic 8 | SM Agent |
| 2025-12-13 | Story completed - M2M auth implemented and tested | Dev Agent (Claude Sonnet 4.5) |
| 2025-12-15 | Manual verification completed - all DoD items verified and checked | Dev Agent (Claude Sonnet 4.5) |
| 2025-12-15 | Status updated from "review" to "done" | Dev Agent (Claude Sonnet 4.5) |
