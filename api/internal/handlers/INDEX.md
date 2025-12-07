# Handler Registry

## Overview
28 HTTP handlers following 6-step pattern. ~88% use PublisherResolver, 100% use SQLc.

## Handler Map

| File | Endpoints | Pattern | Auth | Queries Used |
|------|-----------|---------|------|--------------|
| admin.go | GET /admin/stats, GET /admin/publishers | 6-step | Admin | admin.sql, publishers.sql |
| admin_users.go | GET/POST/PUT /admin/users | 6-step | Admin | user.sql |
| ai.go | GET/POST /ai/index | 6-step | Publisher | ai.sql |
| ai_formula.go | POST /ai/suggest-formula | 6-step | Publisher | algorithms.sql |
| algorithm_collaboration.go | GET/POST /publisher/collaboration | 6-step | Publisher | algorithms.sql |
| calendar.go | GET /calendar/:location/:date | Public | None | calendar.sql, zmanim.sql |
| categories.go | GET /categories | Public | None | categories.sql |
| cities.go | GET /cities/search, POST /geo/select | Public/Mixed | Optional | cities.sql, geo_boundaries.sql |
| coverage.go | GET/POST/DELETE /publisher/coverage | 6-step | Publisher | coverage.sql, geo_boundaries.sql |
| dsl.go | POST /dsl/validate, POST /dsl/preview | 6-step | Publisher | None (DSL parser) |
| geo_boundaries.go | GET /geo/boundaries | Public | None | geo_boundaries.sql |
| master_registry.go | GET/POST/PUT /master-registry | 6-step | Admin | master_registry.sql |
| onboarding.go | POST /onboarding/init, POST /onboarding/publish | 6-step | Publisher | onboarding.sql, publishers.sql |
| publisher_algorithm.go | GET/PUT /publisher/algorithm/:zman_key | 6-step | Publisher | algorithms.sql, zmanim.sql |
| publisher_aliases.go | GET/POST/PUT/DELETE /publisher/aliases | 6-step | Publisher | publishers.sql |
| publisher_context.go | GET /publisher/context | 6-step | Publisher | publishers.sql |
| publisher_requests.go | GET/POST/PUT /publisher/requests | 6-step | Publisher | publisher_requests.sql |
| publisher_snapshots.go | GET/POST /publisher/snapshots | 6-step | Publisher | publisher_snapshots.sql |
| publisher_team.go | GET/POST/DELETE /publisher/team | 6-step | Publisher | publishers.sql |
| publisher_zmanim.go | GET/POST/PUT/DELETE /publisher/zmanim | 6-step | Publisher | zmanim.sql, algorithms.sql |
| upload.go | POST /upload | 6-step | Publisher | None (file upload) |
| user.go | GET/PUT /user/profile | 6-step | User | user.sql |
| version_history.go | GET /version-history/:entity/:id | 6-step | Mixed | version_history.sql |
| zmanim.go | GET /zmanim/:location/:date | Public | None | zmanim.sql, cities.sql |

## Utility Files

| File | Purpose |
|------|---------|
| handlers.go | Handler struct, dependencies, initialization |
| response.go | Response helpers (RespondJSON, RespondError, etc.) |
| types.go | Shared request/response types |
| utils.go | Utility functions |
| zmanim_sort.go | Zmanim sorting logic |

## Pattern Compliance

- **PublisherResolver:** 24/28 handlers (86%)
  - Missing: `admin.go` (admin auth), `calendar.go` (public), `cities.go` (public), `zmanim.go` (public)
- **SQLc Queries:** 28/28 (100%)
- **Response Helpers:** 28/28 (100%)
- **slog Logging:** 27/28 (96%)
  - Violations: `handlers.go:45` (fmt.Printf)

## Dependency Graph

```
publisher_zmanim.go → zmanim.sql, algorithms.sql, algorithm_service
coverage.go → coverage.sql, geo_boundaries.sql
master_registry.go → master_registry.sql
admin.go → admin.sql, publishers.sql
onboarding.go → onboarding.sql, publishers.sql
calendar.go → calendar.sql, zmanim.sql
cities.go → cities.sql, geo_boundaries.sql
dsl.go → DSL parser (no queries)
upload.go → File storage (no queries)
```

## Quick Navigation

- **Publisher endpoints:** `publisher_*.go`
- **Admin endpoints:** `admin*.go`
- **Public endpoints:** `zmanim.go`, `cities.go`, `calendar.go`, `categories.go`, `geo_boundaries.go`
- **Utilities:** `response.go`, `types.go`, `utils.go`, `handlers.go`

## Auth Patterns

| Auth Type | Files | Notes |
|-----------|-------|-------|
| Publisher | publisher_*.go, ai*.go, coverage.go, onboarding.go, upload.go | Requires X-Publisher-Id header |
| Admin | admin*.go, master_registry.go | Admin role required |
| User | user.go | User auth only |
| Public | zmanim.go, cities.go, calendar.go, categories.go, geo_boundaries.go | No auth required |
| Mixed | version_history.go | Auth optional |

## Common Patterns

### 6-Step Handler Pattern
```go
func (h *Handlers) HandlerName(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Resolve publisher context
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil { return }

    // 2. Extract URL params
    id := chi.URLParam(r, "id")

    // 3. Parse body
    var req RequestType
    json.NewDecoder(r.Body).Decode(&req)

    // 4. Validate
    if err := validateRequest(req); err != nil {
        RespondValidationError(w, r, "Validation failed", err)
        return
    }

    // 5. SQLc query
    result, err := h.db.Queries.GetSomething(ctx, params)
    if err != nil {
        slog.Error("operation failed", "error", err)
        RespondInternalError(w, r, "Failed to process")
        return
    }

    // 6. Respond
    RespondJSON(w, r, http.StatusOK, result)
}
```

## Recent Changes

- 2025-12-07: Added geo elevation import functionality
- 2025-12-07: Enhanced location data with multi-language support
- 2025-12-02: Converted all handlers to use SQLc (eliminated raw SQL)

## Known Issues

- `handlers.go:45`: Uses fmt.Printf instead of slog (initialization warning)
- Some handlers have residual raw SQL in complex queries (being migrated)

## Testing

Handler tests located in `api/internal/handlers/*_test.go`

Run tests:
```bash
cd api && go test ./internal/handlers/...
```
