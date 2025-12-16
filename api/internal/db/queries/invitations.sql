-- Additional invitation queries for secure user invitation flow
-- Story: 8.31 - Secure User Invitation Flow with Email Verification
-- Note: Core queries exist in admin.sql and publishers.sql

-- name: CreateInvitationWithStatus :one
INSERT INTO publisher_invitations (
    publisher_id,
    email,
    token,
    role_id,
    invited_by,
    expires_at,
    status
) VALUES (
    $1, $2, $3, $4, $5, $6, 'pending'
)
RETURNING *;

-- name: GetInvitationByIDWithStatus :one
SELECT pi.*, pr.key as role_key
FROM publisher_invitations pi
JOIN publisher_roles pr ON pr.id = pi.role_id
WHERE pi.id = $1;

-- name: ListAllInvitationsByPublisher :many
SELECT pi.*, pr.key as role_key,
       pr.display_name_english as role_display_english
FROM publisher_invitations pi
JOIN publisher_roles pr ON pr.id = pi.role_id
WHERE pi.publisher_id = $1
ORDER BY pi.created_at DESC;

-- name: UpdateInvitationStatus :one
UPDATE publisher_invitations
SET status = $2,
    updated_at = NOW(),
    accepted_at = CASE
        WHEN $2 = 'accepted' THEN NOW()
        ELSE accepted_at
    END
WHERE id = $1
RETURNING *;

-- name: CancelInvitation :exec
UPDATE publisher_invitations
SET status = 'cancelled',
    updated_at = NOW()
WHERE id = $1
  AND publisher_id = $2
  AND status = 'pending';

-- name: ResendInvitationUpdateToken :one
UPDATE publisher_invitations
SET token = $2,
    expires_at = $3,
    status = 'pending',
    updated_at = NOW()
WHERE id = $1
  AND publisher_id = $4
RETURNING *;

-- name: ExpireOldInvitations :exec
UPDATE publisher_invitations
SET status = 'expired',
    updated_at = NOW()
WHERE status = 'pending'
  AND expires_at < NOW();

-- name: GetInvitationByPublisherAndEmail :one
SELECT pi.*, pr.key as role_key
FROM publisher_invitations pi
JOIN publisher_roles pr ON pr.id = pi.role_id
WHERE pi.publisher_id = $1
  AND pi.email = $2
ORDER BY pi.created_at DESC
LIMIT 1;

-- name: CountRecentInvitationsByPublisher :one
SELECT COUNT(*) FROM publisher_invitations
WHERE publisher_id = $1
  AND created_at > $2;
