# Story 5.15: API Response Standardization

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** backlog
**Priority:** P2
**Story Points:** 5
**Dependencies:** None (can start immediately)

---

## Story

As a **developer**,
I want **all API responses to follow the standard wrapper format**,
So that **frontend code can consistently access data without guessing the response structure**.

---

## Problem Statement

Currently **~80+ API responses** have inconsistent wrapping patterns. This causes:

1. **Frontend confusion** - Code like `data.data?.publishers || data.publishers || data.data || []`
2. **Maintenance burden** - Each endpoint requires custom response handling
3. **Bug-prone** - Easy to miss a case and get undefined errors
4. **Documentation mismatch** - API docs say one thing, code does another
5. **Type safety issues** - Hard to type responses when format varies

**Reference:** [docs/coding-standards.md](../../coding-standards.md#response-format---critical-consistency-rule)

---

## Standard Response Format

**All API responses MUST be wrapped by `RespondJSON()` with this structure:**

```json
{
  "data": <your_data>,
  "meta": {
    "timestamp": "2025-11-27T10:30:00Z",
    "request_id": "uuid"
  }
}
```

**Error responses:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Name is required",
    "details": { "name": "This field is required" }
  },
  "meta": {
    "timestamp": "2025-11-27T10:30:00Z",
    "request_id": "uuid"
  }
}
```

---

## Acceptance Criteria

### AC-5.15.1: No Double-Wrapping
- [ ] Zero instances of `map[string]interface{}{"key": data}` passed to RespondJSON
- [ ] All endpoints pass data directly to RespondJSON
- [ ] Grep check returns 0: `grep -rn 'RespondJSON.*map\[string\]interface{}' api/internal/handlers`

### AC-5.15.2: List Endpoints Return Arrays
- [ ] `/api/v1/publishers` returns `{ "data": [...] }`
- [ ] `/api/v1/publisher/zmanim` returns `{ "data": [...] }`
- [ ] `/api/v1/countries` returns `{ "data": [...] }`
- [ ] All list endpoints return arrays directly in `data`

### AC-5.15.3: Single Resource Endpoints Return Objects
- [ ] `/api/v1/publisher/profile` returns `{ "data": {...} }`
- [ ] `/api/v1/publisher/{id}` returns `{ "data": {...} }`
- [ ] All single-resource endpoints return objects directly in `data`

### AC-5.15.4: Frontend Can Access Data Consistently
- [ ] `api.get('/publishers')` returns array directly
- [ ] `api.get('/publisher/profile')` returns object directly
- [ ] No need for `data.data?.publishers || data.publishers` patterns

### AC-5.15.5: Error Responses Standardized
- [ ] All errors use RespondValidationError, RespondBadRequest, etc.
- [ ] Error responses include code, message, and optional details
- [ ] Frontend can access `error.code` and `error.message` consistently

---

## Technical Context

### Common Anti-Patterns to Fix

**WRONG - Double wrapping:**
```go
RespondJSON(w, r, http.StatusOK, map[string]interface{}{
    "publishers": publishers,
})
// Result: { "data": { "publishers": [...] }, "meta": {...} }
```

**CORRECT - Direct data:**
```go
RespondJSON(w, r, http.StatusOK, publishers)
// Result: { "data": [...], "meta": {...} }
```

**WRONG - Nested data key:**
```go
RespondJSON(w, r, http.StatusOK, map[string]interface{}{
    "data": profile,
    "extra": something,
})
// Result: { "data": { "data": {...}, "extra": {...} }, "meta": {...} }
```

**CORRECT - Return struct with fields:**
```go
type ProfileResponse struct {
    Profile Profile `json:"profile"`
    Extra   string  `json:"extra,omitempty"`
}
RespondJSON(w, r, http.StatusOK, ProfileResponse{Profile: profile, Extra: extra})
// Result: { "data": { "profile": {...}, "extra": "..." }, "meta": {...} }
```

### Files to Audit

Run this command to find potential double-wrapping:
```bash
grep -rn 'RespondJSON.*map\[string\]interface{}' api/internal/handlers/
grep -rn 'RespondJSON.*map\[string\]' api/internal/handlers/
```

**High-priority handlers:**
- `api/internal/handlers/admin.go`
- `api/internal/handlers/publisher_profile.go`
- `api/internal/handlers/publisher_zmanim.go`
- `api/internal/handlers/publisher_coverage.go`
- `api/internal/handlers/zmanim.go`

### Response Helper Review

**Verify `RespondJSON` in `response.go`:**
```go
func RespondJSON(w http.ResponseWriter, r *http.Request, status int, data interface{}) {
    response := map[string]interface{}{
        "data": data,  // This wraps the data
        "meta": map[string]interface{}{
            "timestamp":  time.Now().UTC().Format(time.RFC3339),
            "request_id": GetRequestID(r),
        },
    }
    // ... send response
}
```

The wrapper is already in `RespondJSON` - handlers should NOT add another wrapper.

---

## Tasks / Subtasks

- [ ] Task 1: Audit and Categorize
  - [ ] 1.1 Grep for double-wrapping patterns
  - [ ] 1.2 List all handlers with map[string]interface{} in RespondJSON
  - [ ] 1.3 Categorize by endpoint type (list vs single resource)
  - [ ] 1.4 Document current response format for each endpoint

- [ ] Task 2: Fix Admin Handlers
  - [ ] 2.1 Review `handlers/admin.go`
  - [ ] 2.2 Fix any double-wrapped responses
  - [ ] 2.3 Ensure list endpoints return arrays directly
  - [ ] 2.4 Test with curl to verify format

- [ ] Task 3: Fix Publisher Handlers
  - [ ] 3.1 Review `handlers/publisher_profile.go`
  - [ ] 3.2 Review `handlers/publisher_zmanim.go`
  - [ ] 3.3 Review `handlers/publisher_coverage.go`
  - [ ] 3.4 Review `handlers/publisher_algorithms.go`
  - [ ] 3.5 Fix all double-wrapped responses

- [ ] Task 4: Fix Public Handlers
  - [ ] 4.1 Review `handlers/zmanim.go`
  - [ ] 4.2 Review `handlers/locations.go`
  - [ ] 4.3 Review `handlers/health.go`
  - [ ] 4.4 Fix all double-wrapped responses

- [ ] Task 5: Fix Auth Handlers
  - [ ] 5.1 Review `handlers/auth.go`
  - [ ] 5.2 Review `handlers/registration.go`
  - [ ] 5.3 Fix all double-wrapped responses

- [ ] Task 6: Update Frontend if Needed
  - [ ] 6.1 Check if any frontend code relied on old format
  - [ ] 6.2 Update API client if needed
  - [ ] 6.3 Remove `data.data?.X || data.X` patterns

- [ ] Task 7: Verification
  - [ ] 7.1 Run grep check (should return 0)
  - [ ] 7.2 Run `go build ./...`
  - [ ] 7.3 Run `go test ./...`
  - [ ] 7.4 Test each endpoint with curl
  - [ ] 7.5 Run E2E tests
  - [ ] 7.6 Manual testing of key flows

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Zero double-wrapped responses in handlers
- [ ] All list endpoints return arrays in `data`
- [ ] All single-resource endpoints return objects in `data`
- [ ] Go build passes
- [ ] Go tests pass
- [ ] E2E tests pass
- [ ] Curl tests verify correct format

---

## Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/internal/handlers/admin.go` | Modify | Fix response format |
| `api/internal/handlers/publisher_profile.go` | Modify | Fix response format |
| `api/internal/handlers/publisher_zmanim.go` | Modify | Fix response format |
| `api/internal/handlers/publisher_coverage.go` | Modify | Fix response format |
| `api/internal/handlers/publisher_algorithms.go` | Modify | Fix response format |
| `api/internal/handlers/zmanim.go` | Modify | Fix response format |
| `api/internal/handlers/locations.go` | Modify | Fix response format |

---

## Testing Strategy

1. **Compile Check** - `go build ./...`
2. **Unit Tests** - `go test ./...`
3. **Curl Tests** - Manual curl for each endpoint
4. **E2E Tests** - Run full Playwright suite
5. **Format Verification** - Check JSON structure matches spec

### Curl Test Template

```bash
# List endpoint should return array
curl -s http://localhost:8080/api/v1/countries | jq '.data | type'
# Expected: "array"

# Single resource should return object
curl -s -H "Authorization: Bearer $TOKEN" -H "X-Publisher-Id: $PID" \
  http://localhost:8080/api/v1/publisher/profile | jq '.data | type'
# Expected: "object"
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking frontend | Run E2E tests after each change |
| Missing endpoint | Comprehensive grep audit first |
| API client assumptions | Review useApi hook unwrapping logic |
| Mobile app impact | N/A (web only currently) |

---

## Notes

- This story addresses MEDIUM priority technical debt
- Changes are backend-focused but may require frontend updates
- The `useApi()` hook already unwraps `data` - verify this works with changes
- Some endpoints may legitimately need structured responses (multiple fields)
  - In these cases, use named struct types, not map[string]interface{}
- Document any intentional deviations from the standard format
