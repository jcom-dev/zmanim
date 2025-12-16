# Version History Pattern

## Overview

The Version History pattern provides two distinct versioning strategies for tracking changes over time:

1. **Algorithm Version History** - Global versioning for entire algorithm configurations
2. **Zman Version History** - Per-resource versioning for individual zman formulas

## When to Use Each Pattern

### Algorithm Version History (Global)
Use when you need to:
- Version entire configuration snapshots (algorithm config, settings, etc.)
- Track major milestone changes
- Provide rollback capability for complex configurations
- Maintain a linear version number sequence for the entire publisher

**Typical Use Cases:**
- Publisher algorithm configuration changes
- Batch updates to multiple settings
- Major releases or milestones
- Testing/staging configurations before publishing

### Zman Version History (Per-Resource)
Use when you need to:
- Track changes to individual resources independently
- Version a single zman's formula changes
- Compare specific formula variations
- Maintain fine-grained audit trails per zman

**Typical Use Cases:**
- Individual zman formula edits
- A/B testing different formulas
- Tracking which publisher changed which formula when
- Per-zman rollback capability

## Database Schema Requirements

### Algorithm Version History

```sql
CREATE TABLE algorithm_version_snapshots (
    id SERIAL PRIMARY KEY,
    algorithm_id integer NOT NULL REFERENCES algorithms(id),
    version_number integer NOT NULL,
    status varchar(20) NOT NULL,  -- 'draft' | 'published'
    config_snapshot jsonb NOT NULL,  -- Full algorithm config
    description text,
    created_by text,  -- Clerk user ID
    created_at timestamptz DEFAULT now(),
    published_at timestamptz,

    UNIQUE(algorithm_id, version_number)
);

CREATE INDEX idx_algorithm_versions_algorithm
ON algorithm_version_snapshots(algorithm_id, version_number DESC);
```

### Zman Version History

```sql
CREATE TABLE publisher_zman_versions (
    id SERIAL PRIMARY KEY,
    publisher_zman_id integer NOT NULL REFERENCES publisher_zmanim(id),
    version_number integer NOT NULL,
    formula_dsl text NOT NULL,
    created_by text,  -- Clerk user ID
    created_at timestamptz DEFAULT now(),

    UNIQUE(publisher_zman_id, version_number)
);

CREATE INDEX idx_zman_versions_zman
ON publisher_zman_versions(publisher_zman_id, version_number DESC);
```

## SQLc Query Examples

### Algorithm Version History

```sql
-- name: ListVersionHistory :many
-- Get all version snapshots for an algorithm
SELECT
    id,
    version_number,
    status,
    description,
    created_by,
    created_at,
    published_at
FROM algorithm_version_snapshots
WHERE algorithm_id = $1
ORDER BY version_number DESC;

-- name: GetVersionDetail :one
-- Get full version details including config
SELECT
    id,
    version_number,
    status,
    description,
    config_snapshot,
    created_by,
    created_at
FROM algorithm_version_snapshots
WHERE algorithm_id = $1
  AND version_number = $2;

-- name: GetVersionConfig :one
-- Get just the config snapshot for diffing
SELECT config_snapshot
FROM algorithm_version_snapshots
WHERE algorithm_id = $1
  AND version_number = $2;

-- name: CreateVersionSnapshot :one
-- Create a new version snapshot
INSERT INTO algorithm_version_snapshots (
    algorithm_id,
    version_number,
    status,
    config_snapshot,
    description,
    created_by
) VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetCurrentVersionNumber :one
-- Get the current (highest) version number
SELECT COALESCE(MAX(version_number), 0) as version_number
FROM algorithm_version_snapshots
WHERE algorithm_id = $1;

-- name: GetNextVersionNumber :one
-- Get the next version number (current + 1)
SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
FROM algorithm_version_snapshots
WHERE algorithm_id = $1;
```

### Zman Version History

```sql
-- name: GetZmanVersionHistory :many
-- Get all version snapshots for a zman
SELECT
    v.id,
    v.publisher_zman_id,
    v.version_number,
    v.formula_dsl,
    v.created_by,
    v.created_at
FROM publisher_zman_versions v
JOIN publisher_zmanim pz ON v.publisher_zman_id = pz.id
WHERE pz.publisher_id = $1
  AND pz.zman_key = $2
ORDER BY v.version_number DESC;

-- name: GetZmanVersion :one
-- Get a specific version of a zman
SELECT
    v.id,
    v.publisher_zman_id,
    v.version_number,
    v.formula_dsl,
    v.created_by,
    v.created_at
FROM publisher_zman_versions v
JOIN publisher_zmanim pz ON v.publisher_zman_id = pz.id
WHERE pz.publisher_id = $1
  AND pz.zman_key = $2
  AND v.version_number = $3;

-- name: GetVersionFormula :one
-- Get just the formula from a specific version
SELECT formula_dsl
FROM publisher_zman_versions v
JOIN publisher_zmanim pz ON v.publisher_zman_id = pz.id
WHERE pz.publisher_id = $1
  AND pz.zman_key = $2
  AND v.version_number = $3;

-- name: CreateVersionForRollback :exec
-- Create a new version after rollback
INSERT INTO publisher_zman_versions (
    publisher_zman_id,
    version_number,
    formula_dsl,
    created_by
)
SELECT
    pz.id,
    COALESCE(MAX(v.version_number), 0) + 1,
    $3,
    $4
FROM publisher_zmanim pz
LEFT JOIN publisher_zman_versions v ON v.publisher_zman_id = pz.id
WHERE pz.publisher_id = $1
  AND pz.zman_key = $2
GROUP BY pz.id;
```

## Handler Code Examples

### Algorithm Version History Handler

```go
// GetVersionHistory returns the version history for an algorithm
// GET /api/v1/publisher/algorithm/history
func (h *Handlers) GetVersionHistory(w http.ResponseWriter, r *http.Request) {
    // Step 1: Resolve publisher context
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil {
        return
    }

    ctx := r.Context()

    // Parse publisher ID
    publisherID, err := strconv.ParseInt(pc.PublisherID, 10, 32)
    if err != nil {
        RespondBadRequest(w, r, "Invalid publisher ID")
        return
    }

    // Get algorithm ID
    algorithmID, err := h.db.Queries.GetLatestAlgorithmByPublisher(ctx, int32(publisherID))
    if err != nil {
        RespondNotFound(w, r, "Algorithm not found")
        return
    }

    // Get current version number
    currentVersionRaw, err := h.db.Queries.GetCurrentVersionNumber(ctx, algorithmID)
    if err != nil {
        RespondInternalError(w, r, "Failed to get current version")
        return
    }

    currentVersion := int(currentVersionRaw.(int64))

    // Fetch version history
    versionRows, err := h.db.Queries.ListVersionHistory(ctx, algorithmID)
    if err != nil {
        RespondInternalError(w, r, "Failed to fetch version history")
        return
    }

    versions := make([]VersionHistoryEntry, 0, len(versionRows))
    for _, row := range versionRows {
        var publishedAt *time.Time
        if row.PublishedAt.Valid {
            t := row.PublishedAt.Time
            publishedAt = &t
        }

        versions = append(versions, VersionHistoryEntry{
            ID:            fmt.Sprintf("%d", row.ID),
            VersionNumber: int(row.VersionNumber),
            Status:        row.Status,
            Description:   row.Description,
            CreatedBy:     row.CreatedBy,
            CreatedAt:     row.CreatedAt.Time,
            IsCurrent:     int(row.VersionNumber) == currentVersion,
            PublishedAt:   publishedAt,
        })
    }

    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "versions":        versions,
        "current_version": currentVersion,
        "total":           len(versions),
    })
}
```

### Zman Version History Handler

```go
// GetZmanVersionHistory returns version history for a specific zman
// GET /api/v1/publisher/zmanim/{zmanKey}/history
func (h *Handlers) GetZmanVersionHistory(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    zmanKey := chi.URLParam(r, "zmanKey")

    // Resolve publisher context
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil {
        return
    }
    publisherID := pc.PublisherID

    publisherIDInt, err := stringToInt32(publisherID)
    if err != nil {
        RespondBadRequest(w, r, "Invalid publisher ID")
        return
    }

    rows, err := h.db.Queries.GetZmanVersionHistory(ctx, db.GetZmanVersionHistoryParams{
        PublisherID: publisherIDInt,
        ZmanKey:     zmanKey,
    })
    if err != nil {
        slog.Error("error getting zman version history", "error", err)
        RespondInternalError(w, r, "Failed to get version history")
        return
    }

    versions := make([]ZmanVersion, 0, len(rows))
    for _, row := range rows {
        var formulaDSL string
        if row.FormulaDsl != nil {
            formulaDSL = *row.FormulaDsl
        }
        versions = append(versions, ZmanVersion{
            ID:              fmt.Sprintf("%d", row.ID),
            PublisherZmanID: int32ToString(row.PublisherZmanID),
            VersionNumber:   int(row.VersionNumber),
            FormulaDSL:      formulaDSL,
            CreatedBy:       row.CreatedBy,
            CreatedAt:       row.CreatedAt.Time,
        })
    }

    RespondJSON(w, r, http.StatusOK, versions)
}
```

### Rollback Handler

```go
// RollbackZmanVersion rolls back a zman to a previous version
// POST /api/v1/publisher/zmanim/{zmanKey}/rollback
func (h *Handlers) RollbackZmanVersion(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    zmanKey := chi.URLParam(r, "zmanKey")

    // Resolve publisher context
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil {
        return
    }
    publisherID := pc.PublisherID

    var req RollbackZmanRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondBadRequest(w, r, "Invalid request body")
        return
    }

    publisherIDInt, err := stringToInt32(publisherID)
    if err != nil {
        RespondBadRequest(w, r, "Invalid publisher ID")
        return
    }

    // Get the target version's formula
    targetFormula, err := h.db.Queries.GetVersionFormula(ctx, db.GetVersionFormulaParams{
        PublisherID:   publisherIDInt,
        ZmanKey:       zmanKey,
        VersionNumber: int32(req.VersionNumber),
    })

    if err == pgx.ErrNoRows {
        RespondNotFound(w, r, "Version not found")
        return
    }
    if err != nil {
        slog.Error("error getting target version", "error", err)
        RespondInternalError(w, r, "Failed to get target version")
        return
    }

    var formulaToUse string
    if targetFormula != nil {
        formulaToUse = *targetFormula
    }

    // Update the zman with the target formula
    row, err := h.db.Queries.RollbackPublisherZmanFormula(ctx, db.RollbackPublisherZmanFormulaParams{
        PublisherID: publisherIDInt,
        ZmanKey:     zmanKey,
        FormulaDsl:  formulaToUse,
    })

    if err == pgx.ErrNoRows {
        RespondNotFound(w, r, "Zman not found")
        return
    }
    if err != nil {
        slog.Error("error rolling back zman", "error", err)
        RespondInternalError(w, r, "Failed to rollback zman")
        return
    }

    // Create a new version for the rollback
    err = h.db.Queries.CreateVersionForRollback(ctx, db.CreateVersionForRollbackParams{
        PublisherID: publisherIDInt,
        ZmanKey:     zmanKey,
        FormulaDsl:  &formulaToUse,
        CreatedBy:   &pc.UserID,
    })
    if err != nil {
        slog.Error("error creating version for rollback", "error", err)
        // Don't fail the request, the rollback itself succeeded
    }

    RespondJSON(w, r, http.StatusOK, row)
}
```

## Route Registration Examples

### Algorithm Version History Routes

```go
// In routes.go
r.Route("/algorithm", func(r chi.Router) {
    r.Get("/history", h.GetVersionHistory)
    r.Get("/history/{version}", h.GetVersionDetail)
    r.Get("/diff", h.GetVersionDiff)
    r.Post("/rollback", h.RollbackVersion)
    r.Post("/snapshot", h.CreateVersionSnapshot)
})
```

### Zman Version History Routes

```go
// In routes.go
r.Route("/zmanim/{zmanKey}", func(r chi.Router) {
    r.Get("/history", h.GetZmanVersionHistory)
    r.Get("/history/{version}", h.GetZmanVersionDetail)
    r.Post("/rollback", h.RollbackZmanVersion)
})
```

## Key Files Reference

### Algorithm Version History
- **Handler:** `/api/internal/handlers/version_history.go`
- **Queries:** `/api/internal/db/queries/algorithm_versions.sql`
- **Table:** `algorithm_version_snapshots`
- **Routes:** `/api/v1/publisher/algorithm/history*`

### Zman Version History
- **Handler:** `/api/internal/handlers/master_registry.go` (lines 1128-1353)
- **Queries:** `/api/internal/db/queries/zmanim.sql`
- **Table:** `publisher_zman_versions`
- **Routes:** `/api/v1/publisher/zmanim/{zmanKey}/history*`

## Common Pitfalls

### 1. Version Number Gaps
**Problem:** Concurrent requests can create version number gaps.

**Solution:** Use database-generated sequence or SELECT FOR UPDATE:
```sql
SELECT COALESCE(MAX(version_number), 0) + 1
FROM versions
WHERE entity_id = $1
FOR UPDATE;
```

### 2. Missing Audit Trail
**Problem:** Not recording who created the version.

**Solution:** Always populate `created_by` from Clerk user ID:
```go
CreatedBy: &pc.UserID,  // From PublisherContext
```

### 3. Config Snapshot Size
**Problem:** Large config snapshots bloat the database.

**Solution:**
- Use JSONB compression
- Only snapshot changed fields (diff-based)
- Archive old versions to cold storage

### 4. Rollback Without New Version
**Problem:** Rolling back doesn't create a new version entry.

**Solution:** Always create a new version when rolling back:
```go
// After rollback, create version
err = h.db.Queries.CreateVersionForRollback(ctx, params)
```

### 5. Comparing Across Publishers
**Problem:** Trying to compare versions from different publishers.

**Solution:** Version numbers are scoped to `(algorithm_id, version_number)` or `(publisher_zman_id, version_number)`. Never compare across entities.

### 6. Status Field Confusion
**Problem:** Mixing version status with entity status.

**Solution:**
- Algorithm versions: `status` = 'draft' | 'published'
- Zman versions: No status field (version is immutable)
- Entity status is separate from version history

## Testing Considerations

### Unit Tests
```go
func TestCreateVersionSnapshot(t *testing.T) {
    // Test version number increments
    // Test config snapshot is stored correctly
    // Test created_by is recorded
    // Test unique constraint (algorithm_id, version_number)
}

func TestRollback(t *testing.T) {
    // Test rollback retrieves correct version
    // Test rollback creates new version entry
    // Test rollback fails for non-existent version
}
```

### Integration Tests
```go
func TestVersionHistoryFlow(t *testing.T) {
    // 1. Create initial version
    // 2. Modify config, create v2
    // 3. List versions, verify order
    // 4. Get v1 detail, compare config
    // 5. Rollback to v1
    // 6. Verify v3 created with v1 config
}
```

### E2E Tests
```typescript
test('algorithm version history', async ({ page }) => {
    // 1. Save initial config
    // 2. Modify and save again
    // 3. Open version history
    // 4. Compare v1 and v2
    // 5. Rollback to v1
    // 6. Verify config restored
});
```

## Diff Functionality

### Comparing Versions

```go
// GetVersionDiff compares two versions
func (h *Handlers) GetVersionDiff(w http.ResponseWriter, r *http.Request) {
    v1 := r.URL.Query().Get("v1")
    v2 := r.URL.Query().Get("v2")

    // Get both configs
    v1Config, _ := h.db.Queries.GetVersionConfig(ctx, algorithmID, v1)
    v2Config, _ := h.db.Queries.GetVersionConfig(ctx, algorithmID, v2)

    // Compute diff using diff library
    algorithmDiff, err := diff.CompareAlgorithms(v1Config, v2Config)

    RespondJSON(w, r, http.StatusOK, DiffResponse{
        V1: v1,
        V2: v2,
        Diff: algorithmDiff,
    })
}
```

## Best Practices

1. **Always increment version numbers** - Never reuse or skip version numbers
2. **Record user attribution** - Always populate `created_by` field
3. **Immutable versions** - Never update existing version records
4. **Descriptive messages** - Require or encourage version descriptions
5. **Auto-save on rollback** - Create a new version when rolling back
6. **Index for performance** - Index on `(entity_id, version_number DESC)`
7. **Archive old versions** - Move old versions to archival storage after N days
8. **Test rollback flows** - Ensure rollback creates proper audit trail

## Related Patterns

- **Soft Delete Pattern** - Complement versioning with deletion tracking
- **Action Reification** - Link versions to action table for full provenance
- **Snapshot Pattern** - Export/import full publisher state (see `publisher_snapshots.go`)
