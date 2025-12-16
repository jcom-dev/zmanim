# Architecture

System architecture and technical design for Shtetl Zmanim.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CloudFront                                  │
│                         (CDN + Edge Caching)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                  │                                       │
│         ┌────────────────────────┼────────────────────────┐             │
│         │                        │                        │             │
│         ▼                        ▼                        ▼             │
│    S3 Static              Next.js Lambda           API Gateway          │
│  (/_next/static/*)           (SSR/*)            (/backend/*)           │
│                                  │                        │             │
│                                  │                        ▼             │
│                                  │              ┌─────────────────┐     │
│                                  │              │   EC2 Instance  │     │
│                                  │              │   (m7g.medium)  │     │
│                                  │              │                 │     │
│                                  │              │  ┌───────────┐  │     │
│                                  │              │  │  Go API   │  │     │
│                                  │              │  │  (:8080)  │  │     │
│                                  │              │  └─────┬─────┘  │     │
│                                  │              │        │        │     │
│                                  │              │  ┌─────┴─────┐  │     │
│                                  │              │  │PostgreSQL │  │     │
│                                  │              │  │+ PostGIS  │  │     │
│                                  │              │  │           │  │     │
│                                  │              │  │  Redis 7  │  │     │
│                                  │              │  └───────────┘  │     │
│                                  │              └─────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| CDN | CloudFront | Edge caching, SSL termination |
| Frontend | Next.js 16, React 19 | Server-side rendering, UI |
| UI Framework | Tailwind CSS, shadcn/ui | Styling, components |
| Backend | Go 1.24+, Chi router | HTTP API |
| Database Driver | pgx | PostgreSQL connection |
| Database | PostgreSQL 17 + PostGIS | Primary storage, geo queries |
| Cache | Redis 7 (Upstash REST) | Response caching |
| Auth | Clerk | JWT authentication |
| Infrastructure | AWS CDK | Infrastructure as code |
| E2E Testing | Playwright | Browser automation |

---

## Core Services

### UnifiedZmanimService

**Single source of truth for all zmanim calculations.**

```
┌─────────────────────────────────────────────────────────────────┐
│                    UnifiedZmanimService                         │
├─────────────────────────────────────────────────────────────────┤
│  CalculateZmanim()     - Main calculation entry point           │
│  CalculateFormula()    - Execute single DSL formula             │
│  SortZmanim()          - 3-level priority sorting               │
│  LinkOrCopyZman()      - Cross-publisher propagation            │
│  ApplyRounding()       - floor/ceil/math rounding modes         │
│  InvalidateCache()     - Cache management                       │
├─────────────────────────────────────────────────────────────────┤
│  Dependencies:                                                   │
│  - DSL Executor        - Formula parsing and execution          │
│  - Astro Calculator    - Astronomical calculations              │
│  - Redis Cache         - 24-hour TTL caching                    │
│  - SQLc Queries        - Database access                        │
└─────────────────────────────────────────────────────────────────┘
```

**Key behaviors:**
- All zmanim calculations flow through this service
- Handles formula execution, caching, and sorting
- Manages cross-publisher zman linking
- Filter-aware cache keys

### DSL Package

**Formula parsing and execution engine.**

```
Formula Input              Lexer                Parser               Executor
     │                       │                     │                     │
     │   "sunset - 18min"    │                     │                     │
     ▼                       ▼                     ▼                     ▼
┌─────────┐           ┌───────────┐         ┌───────────┐         ┌───────────┐
│  Text   │──────────▶│  Tokens   │────────▶│    AST    │────────▶│   Time    │
│         │           │           │         │           │         │           │
│sunset - │           │PRIMITIVE, │         │ BinaryOp  │         │ 18:42:00  │
│18min    │           │MINUS,     │         │   (-)     │         │           │
│         │           │DURATION   │         │  /    \   │         │           │
└─────────┘           └───────────┘         │ Prim  Dur │         └───────────┘
                                            └───────────┘
```

**Components:**
- `lexer.go` - Tokenizes formula text
- `parser.go` - Builds abstract syntax tree
- `executor.go` - Evaluates AST with primitives
- `functions_reference.go` - Built-in function documentation

### Astro Package

**Astronomical calculations for sun position.**

```go
// Core function
CalculateSunTimesWithElevation(date, lat, lon, elevation) {
    - Solar position algorithms
    - Atmospheric refraction correction
    - Elevation adjustment
    - Returns: sunrise, sunset, solar noon, angles
}
```

---

## Request Flow

### Public Zmanim Request

```
1. Client Request
   GET /api/v1/zmanim?publisher_id=1&locality_id=123&date=2025-01-15
                                    │
                                    ▼
2. API Gateway ─────────────────▶ Go API
                                    │
                                    ▼
3. Handler Validation
   - Parse query params
   - Validate locality exists
   - Check publisher coverage
                                    │
                                    ▼
4. Cache Check ─────────────────▶ Redis
   Key: zmanim:1:123:2025-01-15     │
                                    │ Miss?
                                    ▼
5. Load Publisher Zmanim ───────▶ PostgreSQL
   - Get enabled, published zmanim
   - Get formulas and metadata
                                    │
                                    ▼
6. Calculate Each Zman
   For each zman:
   ├── Parse DSL formula
   ├── Load primitives (sunrise, sunset, etc.)
   ├── Execute formula
   ├── Apply rounding
   └── Format result
                                    │
                                    ▼
7. Sort Results
   - Category order
   - Sort order within category
   - Alphabetical fallback
                                    │
                                    ▼
8. Cache Result ────────────────▶ Redis (24hr TTL)
                                    │
                                    ▼
9. Return Response
   { data: [...zmanim], meta: { timestamp, request_id } }
```

### Publisher Edit Request

```
1. Client Request
   PUT /api/v1/publisher/zmanim/42
   Headers: Authorization: Bearer <jwt>, X-Publisher-Id: 1
   Body: { hebrew_name: "Updated", formula_dsl: "sunset - 18min" }
                                    │
                                    ▼
2. Authentication Middleware
   - Validate JWT with Clerk
   - Extract user claims
                                    │
                                    ▼
3. PublisherResolver ◄──────────── SECURITY CRITICAL
   - Extract X-Publisher-Id header
   - Verify user has access to publisher (from JWT claims)
   - Return PublisherContext or 401/403
                                    │
                                    ▼
4. Handler
   - Extract URL param (id=42)
   - Parse request body
   - Validate formula syntax
                                    │
                                    ▼
5. SQLc Query ──────────────────▶ PostgreSQL
   UPDATE publisher_zmanim
   SET hebrew_name = $1, formula_dsl = $2
   WHERE id = $3 AND publisher_id = $4
                                    │
                                    ▼
6. Audit Logging
   INSERT INTO actions (publisher_id, action, entity_type, ...)
                                    │
                                    ▼
7. Cache Invalidation ──────────▶ Redis
   DELETE keys matching publisher pattern
                                    │
                                    ▼
8. Return Response
   { data: { id: 42, ... }, meta: { timestamp } }
```

---

## Data Model

### Core Entities

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   publishers    │     │   publisher_zmanim   │     │ master_zmanim_      │
│                 │     │                      │     │ registry            │
├─────────────────┤     ├──────────────────────┤     ├─────────────────────┤
│ id              │◄────│ publisher_id         │     │ id                  │
│ name            │     │ id                   │     │ key                 │
│ slug            │     │ master_zman_id       │────▶│ hebrew_name         │
│ status_id       │     │ linked_publisher_    │     │ english_name        │
│ is_global       │     │   zman_id            │     │ category            │
│ created_at      │     │ key                  │     │ default_formula     │
│ deleted_at      │     │ hebrew_name          │     │ documentation       │
└─────────────────┘     │ formula_dsl          │     │ sort_order          │
        │               │ is_enabled           │     └─────────────────────┘
        │               │ is_published         │              ▲
        │               │ sort_order           │              │
        │               │ deleted_at           │              │
        │               └──────────────────────┘              │
        │                        │                            │
        │                        │                            │
        ▼                        ▼                            │
┌─────────────────┐     ┌──────────────────────┐              │
│ publisher_      │     │ publisher_zman_      │              │
│ coverage        │     │ linked               │              │
├─────────────────┤     └──────────────────────┘              │
│ publisher_id    │                                           │
│ coverage_level  │     Every publisher_zman MUST have:       │
│ coverage_id     │     - master_zman_id (from registry)      │
│ boundary (geo)  │       OR                                  │
└─────────────────┘     - linked_publisher_zman_id            │
                                                              │
                        ──────────────────────────────────────┘
```

### Geographic Data

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│     cities      │     │   geo_regions    │     │  geo_countries  │
│   (~4M rows)    │     │                  │     │                 │
├─────────────────┤     ├──────────────────┤     ├─────────────────┤
│ id              │     │ id               │     │ id              │
│ name            │     │ name             │     │ name            │
│ ascii_name      │     │ country_id       │◄────│ iso_code        │
│ region_id       │────▶│ admin1_code      │     │ continent       │
│ country_id      │     │ boundary (geo)   │     │ boundary (geo)  │
│ latitude        │     └──────────────────┘     └─────────────────┘
│ longitude       │
│ population      │
│ timezone        │
│ boundary (geo)  │
└─────────────────┘
         │
         ▼
┌─────────────────────┐
│  geo_search_index   │
│  (full-text search) │
├─────────────────────┤
│ locality_id         │
│ search_text         │
│ search_vector       │
└─────────────────────┘
```

### Lookup Tables (21 total)

All reference data follows this pattern:

```sql
CREATE TABLE {entity}_statuses (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) NOT NULL UNIQUE,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    created_at timestamptz DEFAULT now()
);
```

Tables: `publisher_statuses`, `algorithm_statuses`, `request_statuses`, `publisher_roles`, `coverage_levels`, `jewish_event_types`, `fast_start_types`, `calculation_types`, `edge_types`, `primitive_categories`, `zman_source_types`, `ai_content_sources`, `geo_levels`, `data_types`, `explanation_sources`, `day_types`, `event_categories`, `geo_data_sources`, `tag_types`, `time_categories`, `ai_index_statuses`

---

## Authentication & Authorization

### Clerk Integration

```
┌────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Client     │     │  Clerk Service  │     │    Go API       │
└───────┬────────┘     └────────┬────────┘     └────────┬────────┘
        │                       │                       │
        │  1. Sign in           │                       │
        │──────────────────────▶│                       │
        │                       │                       │
        │  2. JWT token         │                       │
        │◀──────────────────────│                       │
        │                       │                       │
        │  3. API request       │                       │
        │  Authorization: Bearer <jwt>                  │
        │  X-Publisher-Id: 1    │                       │
        │──────────────────────────────────────────────▶│
        │                       │                       │
        │                       │  4. Verify JWT        │
        │                       │◀──────────────────────│
        │                       │                       │
        │                       │  5. Valid + claims    │
        │                       │──────────────────────▶│
        │                       │                       │
        │                       │     6. Check X-Publisher-Id
        │                       │        against claims │
        │                       │                       │
        │  7. Response          │                       │
        │◀──────────────────────────────────────────────│
```

### Authorization Levels

| Level | Middleware | Headers | Use Case |
|-------|------------|---------|----------|
| Public | None | None | Public zmanim, publishers list |
| Optional | `OptionalAuth()` | Optional Bearer | Enhanced public endpoints |
| Authenticated | `RequireAuth()` | Bearer required | Any signed-in user |
| Publisher | `RequireAuth()` + `PublisherResolver` | Bearer + X-Publisher-Id | Publisher portal |
| Admin | `RequireRole("admin")` | Bearer (admin role) | Admin dashboard |

### PublisherResolver

**SECURITY CRITICAL** - Prevents tenant isolation attacks.

```go
// FORBIDDEN - User can access ANY publisher by changing header
publisherID := r.Header.Get("X-Publisher-Id")  // VULNERABLE

// REQUIRED - Validated against JWT claims
pc := h.publisherResolver.MustResolve(w, r)
if pc == nil { return }  // Already sent 401/403
publisherID := pc.PublisherID  // SAFE
```

---

## Caching Strategy

### Redis Cache Keys

```
zmanim:{publisher_id}:{locality_id}:{date}:{filters_hash}
         │               │           │        │
         │               │           │        └── Hash of filter params
         │               │           └── ISO date (2025-01-15)
         │               └── Locality ID
         └── Publisher ID
```

### Cache Behavior

- **TTL:** 24 hours
- **Invalidation:** On any publisher zman change
- **Filter-aware:** Different filter combinations = different cache keys
- **Implementation:** Upstash Redis (REST API, no connection pooling needed)

### Cache Invalidation

```go
// On zman update/create/delete
h.zmanimService.InvalidateCache(ctx, publisherID)

// Deletes all keys matching pattern:
// zmanim:{publisher_id}:*
```

---

## DSL Formula System

### Available Primitives (14)

| Primitive | Description |
|-----------|-------------|
| `visible_sunrise` | Sun appears (with refraction) |
| `visible_sunset` | Sun disappears (with refraction) |
| `geometric_sunrise` | Pure geometric calculation |
| `geometric_sunset` | Pure geometric calculation |
| `solar_noon` | Sun at highest point |
| `solar_midnight` | Sun at lowest point |
| `civil_dawn` | 6 degrees below horizon |
| `civil_dusk` | 6 degrees below horizon |
| `nautical_dawn` | 12 degrees below horizon |
| `nautical_dusk` | 12 degrees below horizon |
| `astronomical_dawn` | 18 degrees below horizon |
| `astronomical_dusk` | 18 degrees below horizon |
| `sunrise` | Alias for visible_sunrise |
| `sunset` | Alias for visible_sunset |

### Available Functions (8)

| Function | Syntax | Description |
|----------|--------|-------------|
| `solar()` | `solar(degrees, direction)` | Time at specific sun angle |
| `seasonal_solar()` | `seasonal_solar(degrees, direction)` | Proportional to equinox |
| `proportional_hours()` | `proportional_hours(hours, base)` | Shaos zmaniyos |
| `proportional_minutes()` | `proportional_minutes(min, direction)` | Scaled minutes |
| `midpoint()` | `midpoint(time1, time2)` | Middle between two times |
| `first_valid()` | `first_valid(expr1, expr2, ...)` | First successful calculation |
| `earlier_of()` | `earlier_of(time1, time2)` | Earlier of two times |
| `later_of()` | `later_of(time1, time2)` | Later of two times |

### Formula Examples

```
visible_sunset - 18min                           # Fixed offset
solar(16.1, before_sunrise)                      # Solar angle
proportional_hours(3, gra)                       # GRA shaos zmaniyos
proportional_hours(3, custom(@alos, @tzeis))     # Custom day definition
@alos_hashachar + 30min                          # Reference another zman
if (latitude > 60) { civil_dawn } else { solar(16.1, before_sunrise) }
```

---

## Security Patterns

### Input Validation

```go
// 1. Type validation
id, err := strconv.Atoi(chi.URLParam(r, "id"))

// 2. Range validation
if hours < 0.5 || hours > 12 {
    RespondValidationError(w, r, "Hours must be 0.5-12", nil)
}

// 3. DSL validation (prevents injection)
if err := dsl.Validate(formula); err != nil {
    RespondValidationError(w, r, "Invalid formula", nil)
}
```

### Tenant Isolation

```go
// ALL queries MUST filter by publisher_id
result, err := h.db.Queries.GetZman(ctx, sqlcgen.GetZmanParams{
    ID:          zmanID,
    PublisherID: pc.PublisherID,  // From validated PublisherResolver
})
```

### Audit Trail

```go
// All state changes logged
h.db.Queries.CreateAction(ctx, sqlcgen.CreateActionParams{
    PublisherID: pc.PublisherID,
    UserID:      userID,
    Action:      "update",
    EntityType:  "publisher_zman",
    EntityID:    zmanID,
    BeforeState: beforeJSON,
    AfterState:  afterJSON,
})
```

---

## Performance Considerations

### Database Indexes

Key indexes for query performance:

```sql
-- Soft delete (partial index)
CREATE INDEX idx_{table}_active ON {table}(id) WHERE deleted_at IS NULL;

-- Geographic queries
CREATE INDEX idx_cities_geom ON cities USING GIST(boundary);
CREATE INDEX idx_publisher_coverage_geom ON publisher_coverage USING GIST(boundary);

-- Full-text search
CREATE INDEX idx_geo_search_vector ON geo_search_index USING GIN(search_vector);

-- Common query patterns
CREATE INDEX idx_publisher_zmanim_publisher ON publisher_zmanim(publisher_id) WHERE deleted_at IS NULL;
```

### Query Optimization

- SQLc generates type-safe, prepared statements
- PostGIS spatial indexes for geographic queries
- pg_trgm for fuzzy text search
- Redis caching for computed zmanim (24hr TTL)

### API Response Size

- Paginated list endpoints
- Field selection where appropriate
- Gzipped responses via CloudFront

---

## Error Handling

### Response Format

```json
// Success
{
  "data": { ... },
  "meta": {
    "timestamp": "2025-01-15T10:30:00Z",
    "request_id": "abc123"
  }
}

// Error
{
  "error": {
    "message": "Validation failed",
    "details": { "field": "reason" }
  },
  "meta": {
    "timestamp": "2025-01-15T10:30:00Z",
    "request_id": "abc123"
  }
}
```

### Error Codes

| Code | Usage |
|------|-------|
| 400 | Validation errors, bad input |
| 401 | Not authenticated |
| 403 | Not authorized for resource |
| 404 | Resource not found |
| 500 | Internal error (generic message only) |

### Logging

```go
// All errors logged with context
slog.Error("operation failed",
    "error", err,
    "request_id", requestID,
    "publisher_id", publisherID,
    "user_id", userID,
)
```

---

## Scalability

### Current Architecture

Single EC2 instance handles:
- ~100 concurrent users
- ~1000 requests/minute
- ~4M locality lookups

### Scaling Path

1. **Vertical:** Upgrade EC2 instance type
2. **Read replicas:** PostgreSQL read replicas for queries
3. **Horizontal:** Multiple API instances behind load balancer
4. **Cache:** Increase Redis capacity
5. **CDN:** CloudFront handles static content, edge caching

### Stateless Design

- No session state in API servers
- All state in PostgreSQL/Redis
- Any API instance can handle any request
