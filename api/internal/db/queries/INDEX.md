# SQLc Query Registry

## Overview
20 SQL query files defining type-safe database operations. All handlers MUST use SQLc-generated code (100% compliance).

## Query Files

| File | Tables | Used By | Query Count | Purpose |
|------|--------|---------|-------------|---------|
| admin.sql | publishers, publisher_statuses, users | admin.go | ~10 | Admin dashboard statistics and publisher management |
| ai.sql | ai_index, ai_content_sources | ai.go | ~8 | AI formula suggestion index management |
| algorithms.sql | publisher_zmanim, algorithm_statuses | publisher_zmanim.go, ai_formula.go, algorithm_collaboration.go | ~15 | Algorithm/formula CRUD operations |
| aliases.sql | publisher_aliases | publisher_aliases.go | ~6 | Publisher name alias management |
| calendar.sql | jewish_events, fast_start_types, event_categories | calendar.go | ~5 | Jewish calendar events lookup |
| categories.sql | time_categories, day_types | categories.go | ~4 | Zman category metadata |
| cities.sql | cities, geo_names, geo_data_sources | cities.go, zmanim.go | ~12 | City search, location selection |
| coverage.sql | publisher_coverage, geo_city_boundaries | coverage.go | ~8 | Publisher geographic coverage management |
| geo_boundaries.sql | geo_city_boundaries, geo_country_boundaries, geo_admin1_boundaries | geo_boundaries.go, cities.go | ~6 | Geographic boundary queries (PostGIS) |
| lookups.sql | Various *_statuses, *_types, *_levels tables | Multiple | ~25 | Lookup table data retrieval |
| master_registry.sql | master_zmanim_registry, zman_tags, master_zman_tags | master_registry.go | ~12 | Master zman registry CRUD |
| onboarding.sql | publishers, publisher_zmanim, master_zmanim_registry | onboarding.go | ~10 | New publisher onboarding flow |
| publisher_requests.sql | publisher_requests, request_statuses | publisher_requests.go | ~8 | Publisher collaboration requests |
| publisher_snapshots.sql | publisher_snapshots | publisher_snapshots.go | ~6 | Publisher snapshot versioning |
| publishers.sql | publishers, publisher_statuses, publisher_roles | publisher_context.go, admin.go, onboarding.go | ~15 | Publisher profile management |
| tag_events.sql | tag_events, tag_types | version_history.go | ~5 | Event tagging for version history |
| user.sql | users, clerk metadata | user.go, admin_users.go | ~8 | User profile management |
| version_history.sql | publisher_snapshots, tag_events | version_history.go | ~10 | Version history and change tracking |
| zman_requests.sql | zman_calculation_requests | (future use) | ~4 | Zman calculation request logging |
| zmanim.sql | publisher_zmanim, master_zmanim_registry, cities | publisher_zmanim.go, zmanim.go, calendar.go | ~20 | Primary zmanim CRUD and calculation |

## Query Pattern Conventions

### Naming Convention
```sql
-- name: GetPublisher :one          -- Retrieve single record
-- name: ListPublishers :many        -- Retrieve multiple records
-- name: CreatePublisher :one        -- Insert and return record
-- name: UpdatePublisher :exec       -- Update without return
-- name: DeletePublisher :exec       -- Delete (usually soft-delete)
-- name: CountPublishers :one        -- Count records
```

### Common Patterns

#### Soft Delete (Preferred)
```sql
-- name: DeletePublisherZman :exec
UPDATE publisher_zmanim
SET deleted_at = now()
WHERE id = $1 AND publisher_id = $2 AND deleted_at IS NULL;
```

#### List with Filters
```sql
-- name: ListPublisherZmanim :many
SELECT id, publisher_id, master_zman_id, formula_dsl, hebrew_name, english_name
FROM publisher_zmanim
WHERE publisher_id = $1
  AND deleted_at IS NULL
ORDER BY sort_order ASC;
```

#### Geographic Query (PostGIS)
```sql
-- name: FindPublishersCoveringCity :many
SELECT DISTINCT pc.publisher_id
FROM publisher_coverage pc
JOIN geo_city_boundaries gcb ON gcb.city_id = $1
WHERE ST_Contains(pc.boundary, gcb.boundary::geometry);
```

#### Lookup Table Join
```sql
-- name: GetPublisherWithStatus :one
SELECT p.id, p.name, ps.key as status_key, ps.display_name_english
FROM publishers p
JOIN publisher_statuses ps ON p.status_id = ps.id
WHERE p.id = $1;
```

## Handler → Query Dependencies

| Handler | Primary Queries | Secondary Queries |
|---------|----------------|-------------------|
| publisher_zmanim.go | zmanim.sql | algorithms.sql, lookups.sql |
| coverage.go | coverage.sql | geo_boundaries.sql, cities.sql |
| admin.go | admin.sql | publishers.sql, user.sql |
| onboarding.go | onboarding.sql | publishers.sql, zmanim.sql, master_registry.sql |
| cities.go | cities.sql | geo_boundaries.sql |
| calendar.go | calendar.sql | zmanim.sql |
| master_registry.go | master_registry.sql | lookups.sql |

## Table Coverage

### Core Tables (covered)
- ✅ publishers, publisher_zmanim, publisher_coverage
- ✅ master_zmanim_registry, zman_tags
- ✅ cities, geo_city_boundaries, geo_country_boundaries
- ✅ users, publisher_snapshots
- ✅ ai_index, jewish_events

### Lookup Tables (covered)
- ✅ All 21 lookup tables via lookups.sql
- ✅ publisher_statuses, algorithm_statuses, request_statuses
- ✅ time_categories, day_types, tag_types

### Meta Tables (system)
- schema_migrations (managed by migration tool)
- tag_events (version history)

## SQLc Configuration

Located in: `api/sqlc.yaml`

```yaml
version: "2"
sql:
  - engine: "postgresql"
    queries: "internal/db/queries"
    schema: "../../db/migrations"
    gen:
      go:
        package: "sqlcgen"
        out: "internal/db/sqlcgen"
        emit_json_tags: true
        emit_prepared_queries: false
        emit_interface: true
        emit_exact_table_names: false
```

## Code Generation

After modifying SQL files:
```bash
cd api && sqlc generate
```

Generated files location: `api/internal/db/sqlcgen/*.sql.go`

## Query Complexity Guidelines

| Complexity | Lines | When to Use | Example |
|------------|-------|-------------|---------|
| Simple | 1-5 | Single table, basic WHERE | GetPublisher |
| Medium | 6-15 | Joins, aggregates | ListPublisherZmanimWithStatus |
| Complex | 16-30 | PostGIS, CTEs, subqueries | FindPublishersCoveringCity |
| Very Complex | 31+ | Multiple CTEs, complex business logic | CalculateZmanimForWeek |

**Rule:** If query exceeds 40 lines, consider moving logic to application layer or creating a database view.

## Common Query Fragments

### Soft Delete Filter
```sql
WHERE deleted_at IS NULL
```

### Publisher Context Filter
```sql
WHERE publisher_id = $1 AND deleted_at IS NULL
```

### Date Range
```sql
WHERE created_at >= $1 AND created_at < $2
```

### PostGIS Contains
```sql
WHERE ST_Contains(boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326))
```

### Status Filter (via Lookup)
```sql
JOIN publisher_statuses ps ON p.status_id = ps.id
WHERE ps.key = 'verified'
```

## Testing

Query tests use pgx connection to test database:
```bash
cd api && go test ./internal/db/... -v
```

## Migration Workflow

1. Create migration: `db/migrations/YYYYMMDD_description.sql`
2. Run migration: `./scripts/migrate.sh`
3. Update queries: Edit files in `api/internal/db/queries/`
4. Generate code: `cd api && sqlc generate`
5. Update handlers: Use new generated functions
6. Test: `go test ./...`

## Performance Notes

- **Indexes:** All FK columns indexed, PostGIS columns have GIST indexes
- **Query Plans:** Use `EXPLAIN ANALYZE` for slow queries
- **N+1 Prevention:** Prefer JOINs over multiple queries
- **Pagination:** Always use LIMIT/OFFSET for list queries

## Compliance

- **Raw SQL:** FORBIDDEN in handlers (use SQLc)
- **String Concatenation:** FORBIDDEN (SQL injection risk)
- **Dynamic Queries:** Use sqlc.arg() for optional parameters
- **Transactions:** Handled at service layer, not in queries

## Recent Changes

- 2025-12-07: Added geo_boundaries.sql for elevation data
- 2025-12-07: Enhanced cities.sql with multi-language support
- 2025-12-02: Migrated all raw SQL to SQLc files

## Documentation

Each query file should include comments explaining:
- Purpose of the query
- Expected use case
- Parameters and their meaning
- Return type structure
- Performance considerations (if complex)
