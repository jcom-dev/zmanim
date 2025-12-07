-- Version History SQL Queries
-- SQLc will generate type-safe Go code from these queries

-- Get publisher ID by clerk user ID --

-- name: GetPublisherIDByClerkUserID :one
SELECT id FROM publishers WHERE clerk_user_id = $1;

-- Get algorithm ID for publisher --

-- name: GetLatestAlgorithmByPublisher :one
SELECT id FROM algorithms
WHERE publisher_id = $1
ORDER BY updated_at DESC
LIMIT 1;

-- Version history queries --

-- name: GetCurrentVersionNumber :one
SELECT COALESCE(MAX(version_number), 0)
FROM algorithm_version_history
WHERE algorithm_id = $1;

-- name: ListVersionHistory :many
SELECT id, version_number, status,
       COALESCE(description, '') as description,
       COALESCE(created_by, '') as created_by,
       created_at,
       published_at
FROM algorithm_version_history
WHERE algorithm_id = $1
ORDER BY version_number DESC;

-- name: GetVersionDetail :one
SELECT id, version_number, status,
       COALESCE(description, '') as description,
       config_snapshot,
       COALESCE(created_by, '') as created_by,
       created_at
FROM algorithm_version_history
WHERE algorithm_id = $1 AND version_number = $2;

-- name: GetVersionConfig :one
SELECT config_snapshot
FROM algorithm_version_history
WHERE algorithm_id = $1 AND version_number = $2;

-- name: CreateVersionSnapshot :one
INSERT INTO algorithm_version_history (
    algorithm_id, version_number, status, config_snapshot, description, created_by
) VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, version_number, status;

-- name: GetNextVersionNumber :one
SELECT get_next_algorithm_version($1);

-- Update algorithm configuration --

-- name: UpdateAlgorithmConfiguration :exec
UPDATE algorithms
SET configuration = $1, updated_at = NOW()
WHERE id = $2;

-- Rollback audit --

-- name: LogRollback :exec
INSERT INTO algorithm_rollback_audit (
    algorithm_id, source_version, target_version, new_version, reason, rolled_back_by
) VALUES ($1, $2, $3, $4, $5, $6);
