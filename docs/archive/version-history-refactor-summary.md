# Version History Refactor Summary

## Overview
Fixed all 22 raw SQL violations in `api/internal/handlers/version_history.go` by creating SQLc queries and implementing proper database access patterns following the 6-step handler pattern.

## Problem Statement
The `version_history.go` file contained 22 instances of raw SQL queries using direct `h.db.Pool.QueryRow()` and `h.db.Pool.Query()` calls, violating the project's coding standards which require all database access to use SQLc-generated type-safe methods via `h.db.Queries.*`.

Additionally, the tables referenced (`algorithm_version_history` and `algorithm_rollback_audit`) did not exist in the database schema.

## Files Created

### 1. Migration File
**Path:** `/home/daniel/repos/zmanim/db/migrations/00000000000003_algorithm_version_history.sql`

Created two new tables and a helper function:

- **`algorithm_version_history`** - Stores version snapshots of algorithm configurations
  - Fields: id, algorithm_id, version_number, status, description, config_snapshot, created_by, created_at, published_at
  - Unique constraint on (algorithm_id, version_number)
  - Foreign key to algorithms table with CASCADE delete

- **`algorithm_rollback_audit`** - Audit log for rollback operations
  - Fields: id, algorithm_id, source_version, target_version, new_version, reason, rolled_back_by, created_at
  - Foreign key to algorithms table with CASCADE delete

- **`get_next_algorithm_version()`** - PL/pgSQL function to get next version number for an algorithm

### 2. SQLc Queries File
**Path:** `/home/daniel/repos/zmanim/api/internal/db/queries/version_history.sql`

Created 10 SQLc queries:

1. `GetPublisherIDByClerkUserID` - Get publisher ID from clerk user ID
2. `GetLatestAlgorithmByPublisher` - Get most recent algorithm for a publisher
3. `GetCurrentVersionNumber` - Get current/max version number for an algorithm
4. `ListVersionHistory` - List all versions for an algorithm
5. `GetVersionDetail` - Get full details of a specific version
6. `GetVersionConfig` - Get config snapshot for a specific version
7. `CreateVersionSnapshot` - Create a new version snapshot
8. `GetNextVersionNumber` - Call the helper function to get next version
9. `UpdateAlgorithmConfiguration` - Update algorithm's configuration field
10. `LogRollback` - Insert audit record for rollback operations

### 3. Generated SQLc Code
**Path:** `/home/daniel/repos/zmanim/api/internal/db/sqlcgen/version_history.sql.go`

SQLc automatically generated type-safe Go methods for all queries with proper struct types and parameter handling.

### 4. Refactored Handler File
**Path:** `/home/daniel/repos/zmanim/api/internal/handlers/version_history.go`

Completely refactored all 4 handler functions to use SQLc queries:

- `GetVersionHistory()` - Uses `ListVersionHistory` and `GetCurrentVersionNumber`
- `GetVersionDetail()` - Uses `GetVersionDetail`
- `GetVersionDiff()` - Uses `GetVersionConfig` (twice)
- `RollbackVersion()` - Uses multiple queries including `CreateVersionSnapshot`, `UpdateAlgorithmConfiguration`, and `LogRollback`
- `CreateVersionSnapshot()` - Uses `GetNextVersionNumber` and `CreateVersionSnapshot`

## Additional Fix

Fixed unrelated bug in `api/internal/db/queries/publishers.sql`:
- Changed table reference from `cities` to `geo_cities` (correct table name)
- This was blocking SQLc generation

## Raw SQL Violations Fixed

### Before: 22 Raw SQL Queries
1. Line 64-67: `SELECT id FROM publishers WHERE clerk_user_id = $1` (×5 occurrences)
2. Line 76-79: `SELECT id FROM algorithms WHERE publisher_id = $1...` (×5 occurrences)
3. Line 87-90: `SELECT COALESCE(MAX(version_number), 0)...` (×2 occurrences)
4. Line 93-99: `SELECT id, version_number, status...` (×1 occurrence)
5. Line 168-173: `SELECT id, version_number, status...config_snapshot...` (×1 occurrence)
6. Line 236-239: `SELECT config_snapshot FROM algorithm_version_history...` (×2 occurrences)
7. Line 351-356: `INSERT INTO algorithm_version_history...` (×2 occurrences)
8. Line 363-367: `UPDATE algorithms SET configuration...` (×1 occurrence)
9. Line 374-378: `INSERT INTO algorithm_rollback_audit...` (×1 occurrence)
10. Line 437-440: `SELECT get_next_algorithm_version($1)` (×1 occurrence)

### After: 0 Raw SQL Queries
All database access now uses `h.db.Queries.*` methods with type-safe parameters.

## Handler Pattern Compliance

All handlers now follow the 6-step pattern:

1. ✅ **Resolve context** - Get userID from middleware
2. ✅ **URL params** - Extract and validate path/query parameters
3. ✅ **Parse body** - Decode JSON requests
4. ✅ **Validate** - Check business rules
5. ✅ **SQLc query** - Use `h.db.Queries.*` methods (no raw SQL)
6. ✅ **Respond** - Return JSON response

## Type Safety Improvements

- All database queries now use strongly-typed parameters (sqlcgen structs)
- Compiler catches query parameter mismatches
- No risk of SQL injection
- Consistent error handling patterns
- Proper handling of nullable fields (e.g., `*string` for optional fields)

## Migration Status

The migration has been successfully applied to the database:
```
[APPLY] 00000000000003_algorithm_version_history.sql
```

## Testing Recommendations

Before deploying, test the following scenarios:

1. **Create version snapshot** - POST to `/api/v1/publisher/algorithm/snapshot`
2. **List version history** - GET `/api/v1/publisher/algorithm/history`
3. **Get version detail** - GET `/api/v1/publisher/algorithm/history/{version}`
4. **Compare versions** - GET `/api/v1/publisher/algorithm/diff?v1=1&v2=2`
5. **Rollback version** - POST `/api/v1/publisher/algorithm/rollback`

## Notes

- The `GetCurrentVersionNumber` query returns `interface{}` which needs type assertion in handler code
- All version numbers are stored as `int32` in database but converted to `int` in API responses for JSON compatibility
- Publisher ID can come from header (`X-Publisher-Id`) or be resolved from clerk user ID
- Rollback creates a new version (doesn't delete history) - proper audit trail
