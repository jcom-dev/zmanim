# Raw SQL Violations Fixed in version_history.go

## Summary
All 22 raw SQL violations have been eliminated from `api/internal/handlers/version_history.go`.

## Before (22 violations)

### GetVersionHistory() - 5 violations
- Line 64-67: `SELECT id FROM publishers WHERE clerk_user_id = $1`
- Line 76-79: `SELECT id FROM algorithms WHERE publisher_id = $1 ORDER BY updated_at DESC LIMIT 1`
- Line 87-90: `SELECT COALESCE(MAX(version_number), 0) FROM algorithm_version_history WHERE algorithm_id = $1`
- Line 93-99: `SELECT id, version_number, status, COALESCE(description, ''), COALESCE(created_by, ''), created_at FROM algorithm_version_history WHERE algorithm_id = $1 ORDER BY version_number DESC`

### GetVersionDetail() - 4 violations
- Line 144-147: `SELECT id FROM publishers WHERE clerk_user_id = $1`
- Line 156-159: `SELECT id FROM algorithms WHERE publisher_id = $1 ORDER BY updated_at DESC LIMIT 1`
- Line 168-173: `SELECT id, version_number, status, COALESCE(description, ''), config_snapshot, COALESCE(created_by, ''), created_at FROM algorithm_version_history WHERE algorithm_id = $1 AND version_number = $2`

### GetVersionDiff() - 5 violations
- Line 213-216: `SELECT id FROM publishers WHERE clerk_user_id = $1`
- Line 225-228: `SELECT id FROM algorithms WHERE publisher_id = $1 ORDER BY updated_at DESC LIMIT 1`
- Line 236-239: `SELECT config_snapshot FROM algorithm_version_history WHERE algorithm_id = $1 AND version_number = $2` (v1)
- Line 245-248: `SELECT config_snapshot FROM algorithm_version_history WHERE algorithm_id = $1 AND version_number = $2` (v2)

### RollbackVersion() - 7 violations
- Line 300-303: `SELECT id FROM publishers WHERE clerk_user_id = $1`
- Line 312-315: `SELECT id FROM algorithms WHERE publisher_id = $1 ORDER BY updated_at DESC LIMIT 1`
- Line 323-326: `SELECT COALESCE(MAX(version_number), 0) FROM algorithm_version_history WHERE algorithm_id = $1`
- Line 334-337: `SELECT config_snapshot FROM algorithm_version_history WHERE algorithm_id = $1 AND version_number = $2`
- Line 351-356: `INSERT INTO algorithm_version_history (algorithm_id, version_number, status, config_snapshot, description, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`
- Line 363-367: `UPDATE algorithms SET configuration = $1, updated_at = NOW() WHERE id = $2`
- Line 374-378: `INSERT INTO algorithm_rollback_audit (algorithm_id, source_version, target_version, new_version, reason, rolled_back_by) VALUES ($1, $2, $3, $4, $5, $6)`

### CreateVersionSnapshot() - 4 violations
- Line 414-417: `SELECT id FROM publishers WHERE clerk_user_id = $1`
- Line 426-429: `SELECT id FROM algorithms WHERE publisher_id = $1 ORDER BY updated_at DESC LIMIT 1`
- Line 437-440: `SELECT get_next_algorithm_version($1)`
- Line 448-453: `INSERT INTO algorithm_version_history (algorithm_id, version_number, status, config_snapshot, description, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`

## After (0 violations)

All queries replaced with SQLc-generated methods:

### SQLc Queries Used
1. `h.db.Queries.GetPublisherIDByClerkUserID(ctx, &userID)` - replaces 5 instances
2. `h.db.Queries.GetLatestAlgorithmByPublisher(ctx, publisherID)` - replaces 5 instances
3. `h.db.Queries.GetCurrentVersionNumber(ctx, algorithmID)` - replaces 2 instances
4. `h.db.Queries.ListVersionHistory(ctx, algorithmID)` - replaces 1 instance
5. `h.db.Queries.GetVersionDetail(ctx, params)` - replaces 1 instance
6. `h.db.Queries.GetVersionConfig(ctx, params)` - replaces 4 instances (2×2 handlers)
7. `h.db.Queries.CreateVersionSnapshot(ctx, params)` - replaces 2 instances
8. `h.db.Queries.GetNextVersionNumber(ctx, algorithmID)` - replaces 1 instance
9. `h.db.Queries.UpdateAlgorithmConfiguration(ctx, params)` - replaces 1 instance
10. `h.db.Queries.LogRollback(ctx, params)` - replaces 1 instance

### New Files Created
- `/home/daniel/repos/zmanim/db/migrations/00000000000003_algorithm_version_history.sql` - Tables and function
- `/home/daniel/repos/zmanim/api/internal/db/queries/version_history.sql` - SQLc queries
- `/home/daniel/repos/zmanim/api/internal/db/sqlcgen/version_history.sql.go` - Generated code (auto)

### Files Modified
- `/home/daniel/repos/zmanim/api/internal/handlers/version_history.go` - Refactored all handlers
- `/home/daniel/repos/zmanim/api/internal/db/queries/publishers.sql` - Fixed cities→geo_cities

## Verification

Run the following to verify no raw SQL remains:
```bash
grep -n "h.db.Pool.Query" api/internal/handlers/version_history.go
grep -n "h.db.Pool.Exec" api/internal/handlers/version_history.go
```

Both should return no results.
