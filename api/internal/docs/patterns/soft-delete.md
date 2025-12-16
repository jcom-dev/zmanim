# Soft Delete Pattern

## Overview

The Soft Delete pattern provides a reversible deletion mechanism that marks records as deleted rather than permanently removing them from the database. This pattern maintains data integrity, enables audit trails, and allows for data restoration.

**Three Operations:**
1. **Soft Delete** - Mark record as deleted (`deleted_at = now()`)
2. **Restore** - Unmark record as deleted (`deleted_at = NULL`)
3. **Permanent Delete** - Physically remove record (admin-only, rare)

## When to Use Soft Delete vs Hard Delete

### Use Soft Delete When:
- Records have audit trail requirements (who deleted, when)
- Data may need to be restored by users
- Records have dependencies that need to remain queryable for historical purposes
- Compliance/regulatory requirements mandate data retention
- User-generated content that should be recoverable
- Business logic requires knowing "what was deleted"

**Examples in Shtetl Zmanim:**
- `publisher_zmanim` - User can restore deleted zmanim
- `publishers` - Admin can restore suspended publishers
- `publisher_snapshots` - Users can recover deleted versions

### Use Hard Delete When:
- Temporary/cache data (sessions, rate limit counters)
- Test/fixture data
- Purely technical records with no business value
- GDPR/privacy "right to be forgotten" requests (after audit window)
- Cascade deletions where parent soft-delete handles it
- Performance-critical tables with high churn

**Examples in Shtetl Zmanim:**
- Cache entries
- Temporary session data
- Test fixtures (E2E tests)

## Database Schema Requirements

### Required Columns

```sql
CREATE TABLE example_table (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    -- ... other columns ...

    -- Soft delete columns (REQUIRED)
    deleted_at timestamptz DEFAULT NULL,
    deleted_by text DEFAULT NULL,  -- Clerk user ID

    -- Audit columns (RECOMMENDED)
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

### Required Indexes (CRITICAL for Performance)

```sql
-- Partial index for active records (critical!)
-- Without this, WHERE deleted_at IS NULL becomes full table scan
CREATE INDEX idx_example_table_active
ON example_table(id)
WHERE deleted_at IS NULL;

-- For filtered queries, add covering indexes
CREATE INDEX idx_example_table_active_status
ON example_table(status_id, created_at)
WHERE deleted_at IS NULL;

-- Index for deleted records (for admin views)
CREATE INDEX idx_example_table_deleted
ON example_table(publisher_id, deleted_at)
WHERE deleted_at IS NOT NULL;
```

### Real-World Examples

#### publisher_zmanim Table
```sql
CREATE TABLE publisher_zmanim (
    id SERIAL PRIMARY KEY,
    publisher_id integer NOT NULL,
    zman_key text NOT NULL,
    formula_dsl text NOT NULL,
    -- ... other columns ...
    deleted_at timestamptz DEFAULT NULL,
    deleted_by text DEFAULT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_publisher_zmanim_active
ON publisher_zmanim(publisher_id)
WHERE deleted_at IS NULL;

CREATE INDEX idx_publisher_zmanim_active_enabled
ON publisher_zmanim(publisher_id, is_enabled)
WHERE deleted_at IS NULL;

CREATE INDEX idx_publisher_zmanim_key_lookup
ON publisher_zmanim(publisher_id, zman_key)
WHERE deleted_at IS NULL;

CREATE INDEX idx_publisher_zmanim_deleted
ON publisher_zmanim(publisher_id, deleted_at)
WHERE deleted_at IS NOT NULL;
```

#### publishers Table
```sql
CREATE TABLE publishers (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    status_id smallint NOT NULL,
    -- ... other columns ...
    deleted_at timestamptz DEFAULT NULL,
    deleted_by text DEFAULT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Performance index
CREATE INDEX idx_publishers_deleted_at
ON publishers(deleted_at)
WHERE deleted_at IS NULL;
```

## SQLc Query Examples

### Basic CRUD Operations

```sql
-- name: GetActivePublisher :one
-- Get a single active publisher (soft-delete aware)
SELECT * FROM publishers
WHERE id = $1
  AND deleted_at IS NULL;

-- name: ListActivePublishers :many
-- List all active publishers
SELECT * FROM publishers
WHERE deleted_at IS NULL
ORDER BY created_at DESC;

-- name: GetPublisherZmanByKey :one
-- Get active zman by key
SELECT * FROM publisher_zmanim
WHERE publisher_id = $1
  AND zman_key = $2
  AND deleted_at IS NULL;

-- name: ListActivePublisherZmanim :many
-- List all active zmanim for a publisher
SELECT * FROM publisher_zmanim
WHERE publisher_id = $1
  AND deleted_at IS NULL
ORDER BY sort_order;

-- name: CountActiveZmanim :one
-- Count active zmanim
SELECT COUNT(*)
FROM publisher_zmanim
WHERE publisher_id = $1
  AND deleted_at IS NULL;
```

### Soft Delete Operations

```sql
-- name: SoftDeletePublisher :exec
-- Soft delete a publisher
UPDATE publishers
SET deleted_at = now(),
    deleted_by = $1,  -- Clerk user ID
    updated_at = now()
WHERE id = $2
  AND deleted_at IS NULL;  -- Prevent double-delete

-- name: SoftDeletePublisherZman :exec
-- Soft delete a zman
UPDATE publisher_zmanim
SET deleted_at = now(),
    deleted_by = $1,
    updated_at = now()
WHERE publisher_id = $2
  AND zman_key = $3
  AND deleted_at IS NULL;

-- name: SoftDeletePublisherSnapshot :exec
-- Soft delete a snapshot
UPDATE publisher_snapshots
SET deleted_at = now(),
    deleted_by = $1,
    updated_at = now()
WHERE id = $2
  AND publisher_id = $3
  AND deleted_at IS NULL;
```

### Restore Operations

```sql
-- name: RestorePublisher :exec
-- Restore a soft-deleted publisher
UPDATE publishers
SET deleted_at = NULL,
    deleted_by = NULL,
    updated_at = now()
WHERE id = $1
  AND deleted_at IS NOT NULL;  -- Only restore if actually deleted

-- name: RestorePublisherZman :exec
-- Restore a soft-deleted zman
UPDATE publisher_zmanim
SET deleted_at = NULL,
    deleted_by = NULL,
    updated_at = now()
WHERE publisher_id = $1
  AND zman_key = $2
  AND deleted_at IS NOT NULL;

-- name: RestorePublisherSnapshot :exec
-- Restore a soft-deleted snapshot
UPDATE publisher_snapshots
SET deleted_at = NULL,
    deleted_by = NULL,
    updated_at = now()
WHERE id = $1
  AND publisher_id = $2
  AND deleted_at IS NOT NULL;
```

### Admin Queries (View Deleted Records)

```sql
-- name: ListDeletedPublishers :many
-- List soft-deleted publishers (admin only)
SELECT
    id,
    name,
    deleted_at,
    deleted_by,
    created_at
FROM publishers
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;

-- name: ListDeletedZmanim :many
-- List soft-deleted zmanim for a publisher
SELECT * FROM publisher_zmanim
WHERE publisher_id = $1
  AND deleted_at IS NOT NULL
ORDER BY deleted_at DESC;

-- name: GetPublisherIncludingDeleted :one
-- Get publisher regardless of deleted status (admin)
SELECT * FROM publishers
WHERE id = $1;
```

### Permanent Delete (Rare, Admin-Only)

```sql
-- name: PermanentDeletePublisher :exec
-- Physically delete a publisher (admin only, use with caution)
DELETE FROM publishers
WHERE id = $1
  AND deleted_at IS NOT NULL;  -- Require soft-delete first

-- name: PermanentDeletePublisherZman :exec
-- Physically delete a zman (admin only)
DELETE FROM publisher_zmanim
WHERE id = $1
  AND deleted_at IS NOT NULL;
```

## Handler Code Examples

### Soft Delete Handler

```go
// SoftDeletePublisherZman soft-deletes a zman (reversible)
// DELETE /api/v1/publisher/zmanim/{zmanKey}
func (h *Handlers) SoftDeletePublisherZman(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Step 1: Resolve publisher context
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil {
        return
    }

    // Step 2: Extract URL params
    zmanKey := chi.URLParam(r, "zmanKey")

    // Step 3: No body for DELETE

    // Step 4: Validate
    publisherID, err := stringToInt32(pc.PublisherID)
    if err != nil {
        RespondBadRequest(w, r, "Invalid publisher ID")
        return
    }

    // Step 5: SQLc query - soft delete
    err = h.db.Queries.SoftDeletePublisherZman(ctx, sqlcgen.SoftDeletePublisherZmanParams{
        DeletedBy:   pc.UserID,  // Clerk user ID for audit
        PublisherID: publisherID,
        ZmanKey:     zmanKey,
    })

    if err == pgx.ErrNoRows {
        RespondNotFound(w, r, "Zman not found or already deleted")
        return
    }
    if err != nil {
        slog.Error("soft delete failed", "error", err, "zman_key", zmanKey)
        RespondInternalError(w, r, "Failed to delete zman")
        return
    }

    // Invalidate cache
    if h.cache != nil {
        if err := h.cache.InvalidatePublisherCache(ctx, pc.PublisherID); err != nil {
            slog.Warn("failed to invalidate cache", "error", err)
        }
    }

    // Step 6: Respond
    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "success": true,
        "message": "Zman deleted successfully (can be restored)",
    })
}
```

### Restore Handler

```go
// RestorePublisherZman restores a soft-deleted zman
// POST /api/v1/publisher/zmanim/{zmanKey}/restore
func (h *Handlers) RestorePublisherZman(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Step 1: Resolve publisher context
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil {
        return
    }

    // Step 2: Extract URL params
    zmanKey := chi.URLParam(r, "zmanKey")

    // Step 3: No body for restore

    // Step 4: Validate
    publisherID, err := stringToInt32(pc.PublisherID)
    if err != nil {
        RespondBadRequest(w, r, "Invalid publisher ID")
        return
    }

    // Step 5: SQLc query - restore
    err = h.db.Queries.RestorePublisherZman(ctx, sqlcgen.RestorePublisherZmanParams{
        PublisherID: publisherID,
        ZmanKey:     zmanKey,
    })

    if err == pgx.ErrNoRows {
        RespondNotFound(w, r, "Zman not found or not deleted")
        return
    }
    if err != nil {
        slog.Error("restore failed", "error", err, "zman_key", zmanKey)
        RespondInternalError(w, r, "Failed to restore zman")
        return
    }

    // Invalidate cache
    if h.cache != nil {
        if err := h.cache.InvalidatePublisherCache(ctx, pc.PublisherID); err != nil {
            slog.Warn("failed to invalidate cache", "error", err)
        }
    }

    // Step 6: Respond
    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "success": true,
        "message": "Zman restored successfully",
    })
}
```

### Permanent Delete Handler (Admin-Only)

```go
// PermanentDeletePublisher permanently deletes a publisher (admin only)
// DELETE /api/v1/admin/publishers/{id}/permanent
func (h *Handlers) PermanentDeletePublisher(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Step 1: Admin auth check
    claims := r.Context().Value("claims").(map[string]interface{})
    role, ok := claims["role"].(string)
    if !ok || role != "admin" {
        RespondForbidden(w, r, "Admin access required")
        return
    }

    // Step 2: Extract URL params
    idStr := chi.URLParam(r, "id")
    id, err := stringToInt32(idStr)
    if err != nil {
        RespondBadRequest(w, r, "Invalid publisher ID")
        return
    }

    // Step 3: No body

    // Step 4: Validate - ensure soft-deleted first
    publisher, err := h.db.Queries.GetPublisherIncludingDeleted(ctx, id)
    if err == pgx.ErrNoRows {
        RespondNotFound(w, r, "Publisher not found")
        return
    }
    if !publisher.DeletedAt.Valid {
        RespondBadRequest(w, r, "Publisher must be soft-deleted first")
        return
    }

    // Step 5: Permanent delete (cascade will handle dependencies)
    err = h.db.Queries.PermanentDeletePublisher(ctx, id)
    if err != nil {
        slog.Error("permanent delete failed", "error", err, "id", id)
        RespondInternalError(w, r, "Failed to permanently delete publisher")
        return
    }

    // Log admin action
    slog.Warn("permanent delete executed",
        "publisher_id", id,
        "admin_user", claims["sub"].(string),
        "deleted_by", publisher.DeletedBy,
    )

    // Step 6: Respond
    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "success": true,
        "message": "Publisher permanently deleted (irreversible)",
    })
}
```

## Route Registration Examples

```go
// In routes.go - Publisher endpoints
r.Route("/zmanim/{zmanKey}", func(r chi.Router) {
    r.Get("/", h.GetPublisherZman)
    r.Put("/", h.UpdatePublisherZman)
    r.Delete("/", h.SoftDeletePublisherZman)  // Soft delete
    r.Post("/restore", h.RestorePublisherZman)  // Restore
})

// In routes.go - Admin endpoints (permanent delete)
r.Route("/admin", func(r chi.Router) {
    r.Use(h.AdminOnly)  // Middleware to check admin role

    r.Route("/publishers/{id}", func(r chi.Router) {
        r.Delete("/permanent", h.PermanentDeletePublisher)
    })
})
```

## Key Files Reference

### Handlers with Soft Delete
- `/api/internal/handlers/publisher_zmanim.go` - Zman soft-delete
- `/api/internal/handlers/publisher_snapshots.go` - Snapshot soft-delete (via service)
- `/api/internal/handlers/admin.go` - Admin permanent delete

### Services
- `/api/internal/services/snapshot_service.go` - Snapshot soft-delete/restore logic

### Queries
- `/api/internal/db/queries/zmanim.sql` - Zman soft-delete queries
- `/api/internal/db/queries/publishers.sql` - Publisher soft-delete queries

### Schema
- `/db/migrations/00000000000001_schema.sql` - Soft-delete columns and indexes

## Common Pitfalls

### 1. Missing `deleted_at IS NULL` Filter
**Problem:** Queries return deleted records.

```sql
-- ✗ FORBIDDEN - Returns deleted records
SELECT * FROM publishers WHERE id = $1;

-- ✓ REQUIRED - Filters out deleted
SELECT * FROM publishers
WHERE id = $1 AND deleted_at IS NULL;
```

### 2. Missing Partial Index
**Problem:** Full table scan on every query.

```sql
-- ✗ FORBIDDEN - No index for active records
-- Every query becomes a full table scan!

-- ✓ REQUIRED - Partial index critical for performance
CREATE INDEX idx_table_active
ON table_name(id)
WHERE deleted_at IS NULL;
```

### 3. Double-Delete Without Check
**Problem:** Overwrites audit trail (deleted_by gets updated).

```sql
-- ✗ FORBIDDEN - Can delete twice, lose original deleted_by
UPDATE table SET deleted_at = now(), deleted_by = $1 WHERE id = $2;

-- ✓ REQUIRED - Prevent double-delete
UPDATE table
SET deleted_at = now(), deleted_by = $1
WHERE id = $2 AND deleted_at IS NULL;
```

### 4. Using Boolean `is_deleted`
**Problem:** Wastes space, harder to query audit trail.

```sql
-- ✗ FORBIDDEN - Boolean pattern
is_deleted boolean DEFAULT false
deleted_by text

-- ✓ REQUIRED - Timestamp pattern
deleted_at timestamptz DEFAULT NULL
deleted_by text
```

**Why timestamp is better:**
- Stores when deleted (audit trail)
- NULL = active (no boolean needed)
- Easier to query "deleted in last 30 days"
- Index-friendly (`WHERE deleted_at IS NULL`)

### 5. Unique Constraints Conflict
**Problem:** Can't create record with same key after soft-delete.

```sql
-- ✗ FORBIDDEN - Conflicts with soft-deleted records
CREATE UNIQUE INDEX idx_publishers_slug
ON publishers(slug);

-- ✓ REQUIRED - Partial unique constraint
CREATE UNIQUE INDEX idx_publishers_slug_active
ON publishers(slug)
WHERE deleted_at IS NULL;
```

### 6. Hard Delete Instead of Soft
**Problem:** Audit trail lost, data unrecoverable.

```sql
-- ✗ FORBIDDEN - Permanent deletion
DELETE FROM publishers WHERE id = $1;

-- ✓ REQUIRED - Soft delete first
UPDATE publishers
SET deleted_at = now(), deleted_by = $1
WHERE id = $2 AND deleted_at IS NULL;
```

### 7. Cascade Deletes Without Soft-Delete
**Problem:** Child records hard-deleted when parent soft-deleted.

**Solution:** Either:
- Soft-delete children too (trigger or application logic)
- Use `ON DELETE SET NULL` for FKs
- Don't use `ON DELETE CASCADE` with soft-delete tables

## Migration Pattern

### Adding Soft Delete to Existing Table

```sql
-- Add soft delete columns
ALTER TABLE example_table
    ADD COLUMN deleted_at timestamptz DEFAULT NULL,
    ADD COLUMN deleted_by text DEFAULT NULL;

-- Create performance index immediately (prevents degradation)
CREATE INDEX idx_example_table_active
ON example_table(id)
WHERE deleted_at IS NULL;

-- Create index for deleted records (admin views)
CREATE INDEX idx_example_table_deleted
ON example_table(deleted_at)
WHERE deleted_at IS NOT NULL;

-- If table has unique constraints, update them
DROP INDEX IF EXISTS idx_example_table_slug;
CREATE UNIQUE INDEX idx_example_table_slug_active
ON example_table(slug)
WHERE deleted_at IS NULL;

-- Update existing SQLc queries to filter deleted_at IS NULL
-- (Handled in query files, not migration)
```

## Testing Considerations

### Unit Tests

```go
func TestSoftDelete(t *testing.T) {
    // 1. Create record
    // 2. Soft delete
    // 3. Verify deleted_at is set
    // 4. Verify deleted_by is recorded
    // 5. Verify record not returned by normal query
    // 6. Verify record returned by admin query
}

func TestRestore(t *testing.T) {
    // 1. Create record
    // 2. Soft delete
    // 3. Restore
    // 4. Verify deleted_at is NULL
    // 5. Verify deleted_by is NULL
    // 6. Verify record returned by normal query
}

func TestDoubleDelete(t *testing.T) {
    // 1. Create record
    // 2. Soft delete (user A)
    // 3. Try soft delete again (user B)
    // 4. Verify no rows affected
    // 5. Verify deleted_by still user A
}
```

### Integration Tests

```go
func TestSoftDeleteFlow(t *testing.T) {
    // 1. Create publisher zman
    // 2. Soft delete via API
    // 3. List zmanim - verify not in list
    // 4. Get by key - verify 404
    // 5. Admin list deleted - verify in list
    // 6. Restore via API
    // 7. List zmanim - verify back in list
}
```

### E2E Tests

```typescript
test('soft delete and restore flow', async ({ page }) => {
    // 1. Create zman
    // 2. Delete zman
    // 3. Verify removed from list
    // 4. Open "Deleted Zmanim" view
    // 5. Find deleted zman
    // 6. Click "Restore"
    // 7. Verify back in active list
});
```

## Best Practices

1. **Always filter `deleted_at IS NULL`** - Every SELECT query for active records
2. **Create partial indexes** - Critical for performance with soft-delete
3. **Record deleted_by** - Always populate with Clerk user ID
4. **Prevent double-delete** - Use `WHERE deleted_at IS NULL` in UPDATE
5. **Unique constraints** - Use `WHERE deleted_at IS NULL` in unique indexes
6. **Admin views** - Provide interface to view/restore deleted records
7. **Cascade strategy** - Decide: soft-delete children or SET NULL
8. **Permanent delete** - Require soft-delete first, admin-only, logged
9. **Cache invalidation** - Invalidate cache on delete and restore
10. **Update `updated_at`** - Set on both delete and restore

## Related Patterns

- **Version History Pattern** - Complement soft-delete with versioning
- **Action Reification** - Link deletes to action table for full provenance
- **Audit Trail** - Use actions table to log all state changes

## Security Considerations

1. **Authorization:** Verify user owns record before soft-delete
2. **Admin-only permanent delete:** Require admin role for irreversible operations
3. **Audit logging:** Log all permanent deletes with user ID and timestamp
4. **Rate limiting:** Prevent abuse of restore functionality
5. **GDPR compliance:** Permanent delete after retention period expires
