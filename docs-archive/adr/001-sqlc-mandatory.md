# ADR-001: SQLc Mandatory for All Database Queries

**Status:** Accepted
**Date:** 2025-11-15
**Deciders:** Architecture Team
**Impact:** Critical (PR Blocker)

## Context

Between 2024-08 and 2024-11, raw SQL queries in handlers caused:
- 20+ runtime type errors (e.g., scanning JSONB into string)
- 5 SQL injection vulnerabilities in early prototypes
- Difficult refactoring (e.g., renaming `status` → `status_id` broke 30+ queries)
- No compile-time verification
- Inconsistent error handling across queries

Example problematic code:
```go
// Brittle, unsafe, no type checking
query := `SELECT id, name, status FROM publishers WHERE id = $1`
var p struct { ID int; Name string; Status string }
err := db.Pool.QueryRow(ctx, query, id).Scan(&p.ID, &p.Name, &p.Status)
// Runtime panic if column order changes or types mismatch
```

## Decision

**ALL database queries MUST use SQLc-generated code.**

- Write queries in `api/internal/db/queries/*.sql`
- Run `sqlc generate` to create type-safe Go functions
- Use generated `h.db.Queries.*` methods in handlers
- Zero tolerance for `db.Pool.Query()` or `db.Pool.Exec()` in handlers/services

**Workflow:**
1. Create SQL file: `api/internal/db/queries/feature.sql`
2. Add query with SQLc annotation:
   ```sql
   -- name: GetPublisher :one
   SELECT id, name, status_id FROM publishers WHERE id = $1;
   ```
3. Generate: `cd api && sqlc generate`
4. Use in handler: `publisher, err := h.db.Queries.GetPublisher(ctx, publisherID)`

## Consequences

### Positive
✅ **Type safety:** Compile errors catch schema mismatches
✅ **Refactoring confidence:** Rename columns, SQLc updates all call sites
✅ **SQL injection impossible:** Parameters handled by pgx
✅ **Code review easier:** Review SQL files separately from logic
✅ **Documentation:** Query intent clear from SQL file names
✅ **IDE support:** Auto-completion for generated types
✅ **Testing:** Can mock Querier interface easily

### Negative
✗ **Two-step workflow:** Write SQL → generate → use
✗ **Learning curve:** Developers must learn SQLc syntax
✗ **Complex queries:** Some dynamic queries require workarounds
✗ **Build step:** Must regenerate after schema changes

**Trade-off accepted:** Type safety and maintainability worth the extra step.

## Compliance Verification

**Detection:**
```bash
grep -rE "db\.Pool\.Query|db\.Pool\.Exec" api/internal/handlers/ --include="*.go"
# Should return 0 results
```

**Current Status:** 100% compliant in handlers (0 violations)
**Exemptions:** `api/cmd/` (CLI tools), `api/internal/db/sqlcgen/` (auto-generated)

## Examples

### ✓ Correct (SQLc)

**SQL File:** `api/internal/db/queries/publishers.sql`
```sql
-- GetPublisher retrieves a single publisher by ID
-- Used by: publisher_context.go, admin.go
-- Returns: Full publisher record with status
-- name: GetPublisher :one
SELECT
    id,
    name,
    status_id,
    logo_url,
    website,
    created_at,
    updated_at
FROM publishers
WHERE id = $1 AND deleted_at IS NULL;
```

**Handler:** `api/internal/handlers/publisher_context.go`
```go
publisher, err := h.db.Queries.GetPublisher(ctx, publisherID)
if err != nil {
    if errors.Is(err, pgx.ErrNoRows) {
        RespondNotFound(w, r, "Publisher not found")
        return
    }
    slog.Error("failed to get publisher", "error", err, "id", publisherID)
    RespondInternalError(w, r, "Failed to retrieve publisher")
    return
}

// Type: sqlcgen.Publisher with:
// - ID: int32
// - Name: string
// - StatusID: int16
// - LogoURL: pgtype.Text (nullable)
// - etc.
```

### ✗ Forbidden (Raw SQL)

```go
// FORBIDDEN - No type safety, SQL injection risk
query := `SELECT * FROM publishers WHERE id = $1`
rows, err := h.db.Pool.Query(ctx, query, id)
if err != nil {
    return err
}
defer rows.Close()

// Manual scanning - brittle, error-prone
var p Publisher
err = rows.Scan(&p.ID, &p.Name, &p.Status) // What if column order changes?
```

## Handling Complex Queries

### Dynamic Filters
Use sqlc.arg() for optional parameters:
```sql
-- name: ListPublishers :many
SELECT id, name, status_id
FROM publishers
WHERE
    deleted_at IS NULL
    AND (sqlc.arg('status_id')::smallint IS NULL OR status_id = sqlc.arg('status_id'))
    AND (sqlc.arg('name')::text IS NULL OR name ILIKE '%' || sqlc.arg('name') || '%')
ORDER BY created_at DESC
LIMIT sqlc.arg('limit')
OFFSET sqlc.arg('offset');
```

### Transactions
Use `pgx.Tx` with Queries interface:
```go
tx, err := h.db.Pool.Begin(ctx)
if err != nil {
    return err
}
defer tx.Rollback(ctx)

qtx := h.db.Queries.WithTx(tx)
publisher, err := qtx.CreatePublisher(ctx, params)
if err != nil {
    return err
}

// More queries...

return tx.Commit(ctx)
```

### Complex Business Logic
If query exceeds 40 lines, consider:
1. Database view + simple SQLc query
2. Application-layer composition (multiple queries)
3. Service layer logic

## Migration Path

For existing raw SQL:
1. Extract query to .sql file
2. Add SQLc annotation
3. Run `sqlc generate`
4. Replace raw SQL with generated function
5. Test thoroughly
6. Delete raw SQL code

## Related Standards

- Database Standards: All tables use `id` primary key
- Lookup Tables: Follow id + key pattern
- Foreign Keys: Must reference integer `id` columns
- Error Handling: Wrap errors with context

## Related ADRs

- ADR-004: Lookup Table Normalization (ensures consistent FK types)
- ADR-003: PublisherResolver Pattern (works with SQLc queries)

## Tools

- SQLc: https://sqlc.dev/
- Configuration: `api/sqlc.yaml`
- Generated code: `api/internal/db/sqlcgen/`

## Review Checklist

When reviewing PRs:
- [ ] No `db.Pool.Query()` or `db.Pool.Exec()` in handlers/services
- [ ] All queries defined in `api/internal/db/queries/*.sql`
- [ ] SQLc annotations present (`:one`, `:many`, `:exec`)
- [ ] Generated code committed (`sqlcgen/*.go`)
- [ ] Error handling uses type-safe checks (pgx.ErrNoRows)

## Last Audit

**Date:** 2025-12-07
**Result:** 100% compliance (0 violations in handlers/services)
**Next Review:** 2026-01-07
