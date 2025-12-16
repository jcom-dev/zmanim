-- Publisher Request Queries
-- These queries handle publisher registration requests (public submissions and admin review)

-- name: CheckExistingPublisherRequest :one
-- Check if there's already a pending or approved request for this email
SELECT COUNT(*) as count
FROM publisher_requests pr
JOIN request_statuses rs ON pr.status_id = rs.id
WHERE LOWER(pr.email) = LOWER($1)
  AND rs.key IN ('pending', 'approved');

-- name: CreatePublisherRequest :one
-- Insert a new publisher registration request
INSERT INTO publisher_requests (name, email, organization, message, status_id)
VALUES (
    $1,
    $2,
    $3,
    $4,
    (SELECT id FROM request_statuses WHERE key = 'pending')
)
RETURNING id, name, email, organization, message, status_id, created_at;

-- name: GetPublisherRequestsByStatus :many
-- Get publisher requests filtered by status
SELECT
    pr.id,
    pr.name,
    pr.email,
    pr.organization,
    pr.message,
    pr.status_id,
    rs.key as status,
    pr.reviewed_by,
    pr.reviewed_at,
    pr.created_at
FROM publisher_requests pr
JOIN request_statuses rs ON pr.status_id = rs.id
WHERE rs.key = $1
ORDER BY pr.created_at DESC;

-- name: CountPublisherRequestsByStatus :one
-- Count publisher requests by status
SELECT COUNT(*) as count
FROM publisher_requests pr
JOIN request_statuses rs ON pr.status_id = rs.id
WHERE rs.key = $1;

-- name: GetPublisherRequestByID :one
-- Get a specific publisher request by ID
SELECT
    pr.id,
    pr.name,
    pr.email,
    pr.organization,
    pr.message,
    pr.status_id,
    rs.key as status,
    pr.reviewed_by,
    pr.reviewed_at,
    pr.created_at
FROM publisher_requests pr
JOIN request_statuses rs ON pr.status_id = rs.id
WHERE pr.id = $1;

-- name: CreatePublisherFromRequest :one
-- Create a new publisher from an approved request
INSERT INTO publishers (name, slug, contact_email, description, status_id)
VALUES (
    $1,
    $2,
    $3,
    $4,
    (SELECT id FROM publisher_statuses WHERE key = 'pending')
)
RETURNING id, name, slug, contact_email, description, status_id, created_at;

-- name: ApprovePublisherRequest :exec
-- Mark a publisher request as approved
UPDATE publisher_requests
SET
    status_id = (SELECT id FROM request_statuses WHERE key = 'approved'),
    reviewed_by = $2,
    reviewed_at = NOW()
WHERE publisher_requests.id = $1;

-- name: RejectPublisherRequest :exec
-- Mark a publisher request as rejected
UPDATE publisher_requests
SET
    status_id = (SELECT id FROM request_statuses WHERE key = 'rejected'),
    reviewed_by = $2,
    reviewed_at = NOW()
WHERE publisher_requests.id = $1;
