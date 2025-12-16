-- User SQL Queries
-- SQLc will generate type-safe Go code from these queries

-- name: StorePasswordResetToken :exec
INSERT INTO password_reset_tokens (email, token, expires_at)
VALUES ($1, $2, $3)
ON CONFLICT (email) DO UPDATE
SET token = $2, expires_at = $3, created_at = NOW();

-- name: GetPublisherNamesByIDs :many
SELECT id, name FROM publishers WHERE id = ANY($1::text[]);
