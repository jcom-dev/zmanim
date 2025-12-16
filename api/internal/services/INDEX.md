# Services Registry

> **Last Updated:** 2025-12-21
> **Total Services:** 13 files (~6,000 LOC)
> **Architecture:** Dependency-injection pattern with database and cache integration

## Critical Service: UnifiedZmanimService

**The SINGLE SOURCE OF TRUTH for all zmanim operations.**

```
Location: zmanim_service.go (~1,000 LOC)
```

### Consolidated Responsibilities

This service consolidates what was previously spread across 4 files:
- `zmanim_calculation.go` (merged) - DSL execution and caching
- `zmanim_ordering.go` (merged) - Category-based sorting
- `zmanim_linking_service.go` (merged) - Copy/link operations
- `timezone_service.go` (deleted) - Not needed, localities have timezone in database

### Key Methods

| Method | Purpose | Used By |
|--------|---------|---------|
| `CalculateZmanim(CalculateParams)` | Main entry point with locality lookup & formula execution | zmanim.go, publisher_zmanim.go |
| `CalculateFormula(FormulaParams)` | Single formula calculation with breakdown | dsl.go, publisher_algorithm.go |
| `CalculateRange(RangeParams)` | Batch date range calculations | publisher_zmanim.go (week preview) |
| `ExecuteFormulasWithCoordinates()` | Raw coordinate calculations | All calculation paths |
| `SortZmanim([]SortableZman)` | Category-based sorting (3-level priority) | All zmanim display |
| `LinkOrCopyZman()` | Cross-publisher zman propagation | publisher_zmanim.go |
| `ApplyRounding(time, mode)` | floor/ceil/math rounding modes | All calculation paths |
| `InvalidateCache(publisherID, localityID)` | Cache invalidation | After zman updates |

### Sorting Algorithm (3-Level Priority)

```
1. Time Category (database-driven sort_order from time_categories table)
   └── Categories: dawn, sunrise, morning, midday, afternoon, sunset, night
2. Calculated Time (chronological within category)
3. Hebrew Name (alphabetical tiebreaker)
```

### Cache Strategy

```
Key Format: zmanim:{publisherID}:{localityID}:{date}:{filterHash}
TTL: 24 hours
Invalidation: On zman create/update/delete, algorithm change
Filter-aware: Different cache entries for different tag filters
```

### Rounding Modes

| Mode | Behavior |
|------|----------|
| `floor` | Truncate seconds (5:23:45 → 5:23) |
| `ceil` | Round up if any seconds (5:23:01 → 5:24) |
| `math` (default) | Round at 30 seconds (5:23:29 → 5:23, 5:23:30 → 5:24) |

---

## Service Map

| File | Purpose | Dependencies |
|------|---------|--------------|
| **zmanim_service.go** | Unified zmanim operations | dsl, cache, db/sqlcgen |
| algorithm_service.go | Algorithm CRUD and configuration | db |
| activity_service.go | Activity logging and audit trail | db/sqlcgen, middleware |
| publisher_service.go | Publisher profile and configuration | db/sqlcgen |
| snapshot_service.go | Publisher snapshot creation and export | db/sqlcgen, complete_export |
| complete_export_service.go | Full publisher data export | db/sqlcgen |
| email_service.go | Email delivery and notifications | smtp, templates |
| clerk_service.go | Clerk authentication integration | clerk-sdk |
| recaptcha_service.go | reCAPTCHA validation | recaptcha-api |
| calculation_log_service.go | Calculation audit logging | db/sqlcgen |
| rate_limiter.go | Request rate limiting | memory |
| search_parser.go | Query parsing for full-text search | strings |

---

## Service Details

### [algorithm_service.go](algorithm_service.go)
Algorithm configuration validation and preview.

**Key Methods:**
- `ValidateAlgorithmConfig()` - Validate algorithm JSON structure
- `PreviewAlgorithm()` - Preview algorithm for single date/location

**Supported Methods:**
- `solar_angle` - Sun depression angle below horizon
- `fixed_minutes` - Fixed offset from sunrise/sunset
- `proportional` - Proportional hours (GRA/MGA)
- `midpoint` - Midpoint between two times
- `sunrise`, `sunset` - Base primitives

---

### [activity_service.go](activity_service.go)
Audit trail logging with action types.

**Key Types:**
```go
type ActionDiff struct {
    Before interface{} `json:"before"`
    After  interface{} `json:"after"`
}
```

**Action Context Fields:**
- IP address
- User agent
- Clerk user email
- Request ID
- Parent action ID (for nested operations)

**Concept Constants:**
- `publisher`, `algorithm`, `coverage`, `zman`, `admin`

---

### [publisher_service.go](publisher_service.go)
Publisher profile and configuration.

**Key Methods:**
- `GetPublishers()` - Paginated list with search
- `GetPublisherByID()` - Single publisher details
- `GetPublisherForLocation()` - Geo-based matching via coverage

---

### [snapshot_service.go](snapshot_service.go) (419 LOC)
Publisher snapshot creation and export.

**Key Types:**
```go
type PublisherSnapshot struct {
    Version     string                  `json:"version"`
    ExportedAt  time.Time               `json:"exported_at"`
    PublisherID int32                   `json:"publisher_id"`
    Zmanim      []PublisherZmanSnapshot `json:"zmanim"`
    Metadata    map[string]interface{}  `json:"metadata"`
}
```

**Key Methods:**
- `BuildSnapshot()` - Capture current zmanim state
- `ExportSnapshot()` - JSON export with metadata
- `ImportSnapshot()` - Restore from snapshot with validation
- `ListSnapshots()` - Snapshot history with pagination

---

### [complete_export_service.go](complete_export_service.go)
Full publisher data export for backup/migration.

**Exports:**
- Publisher profile
- All zmanim with formulas
- Coverage areas
- Team members
- Settings

---

### [email_service.go](email_service.go)
Email notifications via SMTP/Resend.

**Event Types:**
- Publisher registration
- Team invitation
- Correction request notification

---

### [clerk_service.go](clerk_service.go)
Clerk authentication provider integration.

**Key Methods:**
- `GetUserMetadata()` - Retrieve public metadata
- `UpdateUserMetadata()` - Update publisher access list
- `SyncUserRoles()` - Sync roles from database

---

### [recaptcha_service.go](recaptcha_service.go)
reCAPTCHA v3 validation for public forms.

---

### [calculation_log_service.go](calculation_log_service.go)
Calculation statistics and logging for analytics.

**Tracked Metrics:**
- Calculation count per publisher
- Cache hit/miss ratio
- Average calculation time
- Error rates

---

### [rate_limiter.go](rate_limiter.go)
In-memory rate limiting (for development).

**Note:** Production uses Redis-based rate limiting in middleware.

---

### [search_parser.go](search_parser.go)
Advanced search query parsing for locality search.

**Supports:**
- Quoted phrases: `"new york"`
- Boolean operators: `AND`, `OR`
- Negation: `-excluded`
- Fuzzy matching via tsquery

---

## Deleted/Merged Files

| Former File | Merged Into | Reason |
|-------------|-------------|--------|
| zmanim_calculation.go | zmanim_service.go | DSL execution consolidated |
| zmanim_ordering.go | zmanim_service.go | Sorting logic consolidated |
| zmanim_linking_service.go | zmanim_service.go | Copy/link operations consolidated |
| timezone_service.go | (deleted) | Localities store timezone in database |

---

## Service Initialization

Services are initialized in `handlers.go`:

```go
type Handlers struct {
    zmanimService      *services.UnifiedZmanimService
    algorithmService   *services.AlgorithmService
    activityService    *services.ActivityService
    publisherService   *services.PublisherService
    snapshotService    *services.SnapshotService
    emailService       *services.EmailService
    clerkService       *services.ClerkService
    completeExport     *services.CompleteExportService
    recaptchaService   *services.RecaptchaService
    calcLogService     *services.CalculationLogService
    rateLimiter        *services.RateLimiter
    searchParser       *services.SearchParser
}
```

---

## Dependency Graph

```
Handlers
└── Services
    ├── UnifiedZmanimService
    │   ├── dsl.Executor (formula parsing/execution)
    │   ├── astro.Calculator (sun calculations)
    │   ├── cache.Client (Redis)
    │   └── db.Queries (SQLc)
    │       ├── zmanim_unified.sql
    │       ├── master_registry.sql
    │       └── localities.sql
    ├── ActivityService
    │   └── db.Queries → actions.sql
    ├── SnapshotService
    │   ├── db.Queries → publisher_snapshots.sql
    │   └── CompleteExportService
    ├── PublisherService
    │   └── db.Queries → publishers.sql, coverage.sql
    ├── ClerkService
    │   └── Clerk SDK
    └── EmailService
        └── SMTP/Resend
```

---

## Integration Points

### Used By Handlers

| Handler | Service(s) Used |
|---------|-----------------|
| zmanim.go | UnifiedZmanimService |
| publisher_zmanim.go | UnifiedZmanimService, ActivityService |
| publisher_algorithm.go | AlgorithmService, UnifiedZmanimService |
| publisher_snapshots.go | SnapshotService |
| upload.go | ActivityService |
| admin.go | PublisherService |
| correction_requests.go | EmailService |
| external_api.go | RateLimiter |

### Database Queries Used

| Service | SQL Files |
|---------|-----------|
| UnifiedZmanimService | zmanim_unified.sql, master_registry.sql, localities.sql |
| ActivityService | actions.sql |
| PublisherService | publishers.sql, coverage.sql |
| SnapshotService | publisher_snapshots.sql |
| CalculationLogService | calculation_logs.sql |

---

## Recent Changes (2025-12)

- **2025-12-20:** Removed timezone_service.go (localities have timezone in database)
- **2025-12-20:** Consolidated zmanim_calculation.go, zmanim_ordering.go, zmanim_linking_service.go into unified zmanim_service.go
- **2025-12-19:** Added audit trail via CalculationLogService
- **2025-12-19:** Enhanced activity logging with structured context
- **2025-12-18:** Added filter-aware caching (different tag filters = different cache entries)

---

## Patterns

### Transaction-Aware Operations

Multi-step operations (like LinkOrCopyZman) use database transactions:

```go
tx, err := h.db.Begin(ctx)
if err != nil {
    return err
}
defer tx.Rollback(ctx)

// Perform operations...

if err := tx.Commit(ctx); err != nil {
    return err
}
```

### Activity Logging Pattern

```go
actionID, err := h.activityService.RecordAction(ctx, ActivityParams{
    Concept:     "zman",
    Action:      "update",
    PublisherID: pc.PublisherID,
    EntityID:    zmanID,
    Before:      beforeState,
})

// Perform operation...

h.activityService.CompleteAction(ctx, actionID, ActivityResult{
    Success: true,
    After:   afterState,
})
```

---

## Testing

```bash
cd api && go test ./internal/services/...
```

### High Coverage

- `rate_limiter_test.go` - Rate limiting logic
- `search_parser_test.go` - Query parsing

### TODO: Add Tests

- zmanim_service.go (tests removed during consolidation)
- algorithm_service.go
- activity_service.go
- publisher_service.go

---

## Notes

- All services use context for cancellation support
- Database operations use SQLc (zero raw SQL)
- Error handling follows consistent patterns (custom errors, wrapping)
- Logging uses structured slog
