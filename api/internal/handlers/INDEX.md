# Handler Registry

> **Last Updated:** 2025-12-21
> **Total Handlers:** 44 files (28 domain handlers + 16 utility/support files)
> **Pattern Compliance:** 88% PublisherResolver, 100% SQLc, 100% Response Helpers

## Quick Reference

| Category | Files | Auth | Key Endpoints |
|----------|-------|------|---------------|
| **Publisher Zmanim** | publisher_zmanim.go, zmanim.go | Publisher/Public | CRUD zmanim, calculate times |
| **Publisher Mgmt** | publisher_*.go (8 files) | Publisher | Profile, team, aliases, settings |
| **Algorithm** | publisher_algorithm.go, algorithm_collaboration.go | Publisher | Draft/publish, collaboration |
| **Coverage** | coverage.go, geo.go, localities.go | Publisher/Public | Coverage areas, location search |
| **Admin** | admin*.go, master_registry.go | Admin | Publisher management, registry |
| **Public** | zmanim.go, calendar.go, categories.go, geo_boundaries.go | Public | Zmanim lookup, calendar |

---

## Core Domain Handlers

### Zmanim Calculation (Core Business Logic)

#### [zmanim.go](zmanim.go)
Public zmanim endpoints for end-users.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/zmanim` | GET | Public | Calculate zmanim for locality+date |
| `/api/v1/publishers/{id}/zmanim` | GET | Public | Get zmanim for specific publisher |

**Key Functions:**
- `GetZmanim()` - Main public endpoint with sorting by time category
- `GetPublisherZmanim()` - Publisher-specific zmanim with filters
- Returns both `time` (HH:MM:SS) and `time_rounded` (HH:MM) fields

**Dependencies:** UnifiedZmanimService, localities.sql, zmanim_unified.sql

---

#### [publisher_zmanim.go](publisher_zmanim.go) (1,901 LOC)
Publisher-specific zmanim management - the most comprehensive handler.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/publisher/zmanim` | GET | Publisher | List all publisher zmanim |
| `/api/v1/publisher/zmanim` | POST | Publisher | Create new zman |
| `/api/v1/publisher/zmanim/{key}` | GET | Publisher | Get single zman details |
| `/api/v1/publisher/zmanim/{key}` | PUT | Publisher | Update zman (formula, aliases, settings) |
| `/api/v1/publisher/zmanim/{key}` | DELETE | Publisher | Soft-delete zman |
| `/api/v1/publisher/zmanim/{key}/restore` | POST | Publisher | Restore soft-deleted zman |
| `/api/v1/publisher/zmanim/{key}/link` | POST | Publisher | Link to another publisher's zman |
| `/api/v1/publisher/zmanim/{key}/copy` | POST | Publisher | Copy from another publisher |
| `/api/v1/publisher/zmanim/{key}/tags` | GET/PUT | Publisher | Manage tags |
| `/api/v1/publisher/zmanim/preview` | POST | Publisher | Preview formula calculation |
| `/api/v1/publisher/zmanim/preview-week` | POST | Publisher | Preview week of calculations |

**Key Functions:**
- `CreatePublisherZman()` - Create with master_zman_id or linked_publisher_zman_id
- `UpdatePublisherZman()` - Update formula, aliases, is_enabled, is_published
- `LinkOrCopyZman()` - Cross-publisher zman propagation with audit trail
- `PreviewFormula()` - DSL formula validation and preview
- `GetDeletedZmanim()` / `RestoreZman()` - Soft delete management

**Dependencies:** UnifiedZmanimService, zmanim.sql, master_registry.sql, zman_tags.sql

---

### Publisher Management (8 Files)

#### [publisher_context.go](publisher_context.go)
Publisher resolver middleware and context management.

**Key Types:**
- `PublisherResolver` - Validates X-Publisher-Id header against JWT claims
- `PublisherContext` - Contains PublisherID, IsAdmin, UserID

**Critical:** ALL publisher endpoints MUST use `h.publisherResolver.MustResolve(w, r)`

---

#### [publisher_registration.go](publisher_registration.go)
Publisher onboarding and registration flow.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/register` | POST | Public | Start registration |
| `/api/v1/register/verify` | POST | Public | Verify registration token |

---

#### [publisher_settings.go](publisher_settings.go)
Publisher profile and settings management.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/publisher/profile` | GET/PUT | Publisher | Profile management |
| `/api/v1/publisher/settings` | GET/PUT | Publisher | Calculation settings |

---

#### [publisher_team.go](publisher_team.go)
Team member management.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/publisher/team` | GET | Publisher | List team members |
| `/api/v1/publisher/team` | POST | Publisher | Invite team member |
| `/api/v1/publisher/team/{id}` | DELETE | Publisher | Remove team member |

---

#### [publisher_aliases.go](publisher_aliases.go)
Publisher name alias management.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/publisher/aliases` | GET/POST/PUT/DELETE | Publisher | Manage aliases |

---

#### [publisher_requests.go](publisher_requests.go)
Publisher requests and invitations.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/publisher/requests` | GET/POST | Publisher | Feature/zman requests |
| `/api/v1/publisher/requests/{id}` | PUT | Publisher | Update request status |

---

#### [publisher_snapshots.go](publisher_snapshots.go)
Snapshot export/import for version control.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/publisher/snapshots` | GET | Publisher | List snapshots |
| `/api/v1/publisher/snapshots` | POST | Publisher | Create snapshot |
| `/api/v1/publisher/snapshots/{id}/export` | GET | Publisher | Export snapshot JSON |
| `/api/v1/publisher/snapshots/import` | POST | Publisher | Import snapshot |

**Dependencies:** SnapshotService

---

### Algorithm Management

#### [publisher_algorithm.go](publisher_algorithm.go)
Algorithm draft/publish/versioning workflows.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/publisher/algorithm/{zman_key}` | GET | Publisher | Get algorithm for zman |
| `/api/v1/publisher/algorithm/{zman_key}` | PUT | Publisher | Update algorithm |
| `/api/v1/publisher/algorithm/{zman_key}/preview` | POST | Publisher | Preview algorithm |

---

#### [algorithm_collaboration.go](algorithm_collaboration.go)
Algorithm collaboration features.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/publisher/collaboration` | GET/POST | Publisher | Collaboration settings |

---

### Geographic Features

#### [geo.go](geo.go)
Locality search and provider lookup.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/localities/search` | GET | Public | Search localities |
| `/api/v1/localities/{id}` | GET | Public | Get locality details |
| `/api/v1/localities/{id}/publishers` | GET | Public | Get publishers for locality |

**Dependencies:** localities.sql, coverage.sql

---

#### [geo_boundaries.go](geo_boundaries.go)
Geographic boundary management.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/geo/boundaries` | GET | Public | Get boundary GeoJSON |

---

#### [coverage.go](coverage.go)
Publisher coverage area management.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/publisher/coverage` | GET | Publisher | List coverage areas |
| `/api/v1/publisher/coverage` | POST | Publisher | Add coverage |
| `/api/v1/publisher/coverage/{id}` | PUT | Publisher | Update coverage |
| `/api/v1/publisher/coverage/{id}` | DELETE | Publisher | Remove coverage |

**Coverage Levels:** continent, country, region, locality

---

#### [localities.go](localities.go)
Locality database access.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/localities` | GET | Public | List/search localities |

---

### Admin Endpoints

#### [admin.go](admin.go)
Admin dashboard and statistics.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/admin/stats` | GET | Admin | Platform statistics |
| `/api/v1/admin/publishers` | GET | Admin | List all publishers |
| `/api/v1/admin/publishers/{id}` | PUT | Admin | Update publisher status |

---

#### [admin_corrections.go](admin_corrections.go)
Community correction requests management.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/admin/corrections` | GET | Admin | List correction requests |
| `/api/v1/admin/corrections/{id}` | PUT | Admin | Approve/reject correction |

---

#### [admin_users.go](admin_users.go)
User management.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/admin/users` | GET | Admin | List users |
| `/api/v1/admin/users/{id}` | PUT/DELETE | Admin | Manage users |

---

#### [master_registry.go](master_registry.go)
Master zmanim registry queries.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/master-registry` | GET | Public | List master zmanim |
| `/api/v1/master-registry/{key}` | GET | Public | Get single master zman |
| `/api/v1/master-registry` | POST | Admin | Create master zman |
| `/api/v1/master-registry/{key}` | PUT | Admin | Update master zman |
| `/api/v1/master-registry/grouped` | GET | Public | Get grouped by category |

---

### DSL & Formula

#### [dsl.go](dsl.go)
DSL formula validation and preview.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/dsl/validate` | POST | Publisher | Validate DSL formula |
| `/api/v1/dsl/preview` | POST | Publisher | Preview formula calculation |

**Dependencies:** dsl package (lexer, parser, executor)

---

### Calendar & Categories

#### [calendar.go](calendar.go)
Hebrew calendar integration.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/calendar/{locality_id}/{date}` | GET | Public | Get calendar events |

---

#### [categories.go](categories.go)
Time category management.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/categories` | GET | Public | List all categories |
| `/api/v1/categories/time` | GET | Public | Time categories |
| `/api/v1/categories/event` | GET | Public | Event categories |
| `/api/v1/categories/tags` | GET | Public | Tag types |

---

### Advanced Features

#### [ai.go](ai.go) & [ai_formula.go](ai_formula.go)
AI-powered formula explanation generation.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/ai/explain` | POST | Publisher | Explain formula |
| `/api/v1/ai/suggest-formula` | POST | Publisher | AI formula suggestions |

---

#### [external_api.go](external_api.go)
External API authentication and webhooks.

---

#### [complete_export.go](complete_export.go)
Full publisher data export.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/publisher/export` | GET | Publisher | Full data export |

---

#### [correction_requests.go](correction_requests.go)
Community correction requests.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/publisher/correction-requests` | POST | Publisher | Create correction request |
| `/api/v1/publisher/correction-requests` | GET | Publisher | List correction requests |
| `/api/v1/publisher/correction-requests/{id}` | GET | Publisher | Get single correction request |
| `/api/v1/publisher/correction-requests/{id}` | PUT | Publisher | Update pending correction request |
| `/api/v1/publisher/correction-requests/{id}` | DELETE | Publisher | Delete pending correction request |
| `/api/v1/auth/correction-requests` | GET | Role-based | List correction requests (role-filtered) |
| `/api/v1/auth/correction-requests/{id}/status` | PUT | Admin | Update correction request status |

---

#### [location_overrides.go](location_overrides.go)
Publisher-specific location coordinate overrides.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/publisher/location-overrides` | GET/POST/PUT/DELETE | Publisher | Manage overrides |

---

#### [version_history.go](version_history.go)
Algorithm version history tracking.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/version-history/{entity}/{id}` | GET | Mixed | Get version history |
| `/api/v1/version-history/{id}/rollback` | POST | Publisher | Rollback to version |

---

## Utility Files

| File | Purpose |
|------|---------|
| [handlers.go](handlers.go) | Main handler struct, service initialization, router setup |
| [response.go](response.go) | Response helpers: RespondJSON, RespondError, RespondValidationError, RespondNotFound, RespondUnauthorized, RespondForbidden, RespondInternalError, RespondBadRequest |
| [types.go](types.go) | ~100 OpenAPI-annotated request/response types |
| [utils.go](utils.go) | Utility functions: string/int conversions, URL parsing |

---

## 6-Step Handler Pattern (REQUIRED)

```go
func (h *Handlers) HandlerName(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Resolve publisher context (SECURITY CRITICAL)
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil { return }

    // 2. Extract URL params
    id := chi.URLParam(r, "id")

    // 3. Parse body
    var req RequestType
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondBadRequest(w, r, "Invalid request body")
        return
    }

    // 4. Validate
    if req.Name == "" {
        RespondValidationError(w, r, "Name is required", nil)
        return
    }

    // 5. SQLc query (NO RAW SQL)
    result, err := h.db.Queries.GetSomething(ctx, sqlcgen.GetSomethingParams{
        ID:          id,
        PublisherID: pc.PublisherID,
    })
    if err != nil {
        slog.Error("operation failed", "error", err, "id", id)
        RespondInternalError(w, r)
        return
    }

    // 6. Respond
    RespondJSON(w, r, http.StatusOK, result)
}
```

---

## Auth Patterns Summary

| Auth Type | Middleware | Header | Files |
|-----------|------------|--------|-------|
| **Publisher** | RequireAuth + PublisherResolver | X-Publisher-Id (validated against JWT) | publisher_*.go, ai*.go, coverage.go |
| **Admin** | RequireRole("admin") | - | admin*.go, master_registry.go (POST/PUT) |
| **User** | RequireAuth | - | user.go |
| **Public** | None | - | zmanim.go, calendar.go, categories.go, localities.go |
| **Optional** | OptionalAuth | - | version_history.go |

---

## Dependency Graph

```
Handlers
├── UnifiedZmanimService (calculation, ordering, linking)
│   ├── DSL package (lexer, parser, executor)
│   ├── Astro package (sun calculations)
│   └── Cache (Redis)
├── SnapshotService (export/import)
├── ActivityService (audit trail)
├── EmailService (notifications)
├── ClerkService (auth)
└── db.Queries (SQLc)
    ├── zmanim_unified.sql
    ├── master_registry.sql
    ├── publishers.sql
    ├── coverage.sql
    ├── localities.sql
    └── actions.sql (audit)
```

---

## Recent Changes (2025-12)

- **2025-12-20:** Removed `zmanim_sort.go` - sorting unified in `UnifiedZmanimService.SortZmanim()`
- **2025-12-20:** Consolidated zmanim services - all handlers now use `UnifiedZmanimService`
- **2025-12-20:** Simplified publisher zmanim API - removed redundant endpoints
- **2025-12-19:** Added audit trail for all zman changes via `actions.sql`
- **2025-12-19:** Enhanced tag management with negation support

---

## Known Issues

- `handlers.go:45`: Uses fmt.Printf instead of slog (initialization warning)

---

## Testing

```bash
cd api && go test ./internal/handlers/...
```

Handler tests located in `api/internal/handlers/*_test.go`
