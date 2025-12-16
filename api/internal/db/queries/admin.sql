-- Admin SQL Queries
-- SQLc will generate type-safe Go code from these queries

-- Admin Publisher Management --

-- name: AdminListPublishers :many
SELECT p.id, p.clerk_user_id, p.name, p.contact_email, p.status_id,
       ps.key as status_key,
       ps.display_name_hebrew as status_display_hebrew,
       ps.display_name_english as status_display_english,
       p.created_at, p.updated_at
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id
WHERE ($1::text IS NULL OR ps.key = $1)
ORDER BY p.created_at DESC
LIMIT $2 OFFSET $3;

-- name: AdminCountPublishers :one
SELECT COUNT(*)
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id
WHERE ($1::text IS NULL OR ps.key = $1);

-- name: AdminGetPublisher :one
SELECT p.id, p.clerk_user_id, p.name, p.contact_email, p.description, p.bio,
       p.website, p.logo_url, p.status_id,
       ps.key as status_key,
       ps.display_name_hebrew as status_display_hebrew,
       ps.display_name_english as status_display_english,
       p.created_at, p.updated_at
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id
WHERE p.id = $1;

-- name: AdminUpdatePublisherStatus :one
WITH updated AS (
    UPDATE publishers
    SET status_id = $2, updated_at = NOW()
    WHERE publishers.id = $1
    RETURNING id, status_id
)
SELECT u.id, u.status_id,
       ps.key as status_key,
       ps.display_name_hebrew as status_display_hebrew,
       ps.display_name_english as status_display_english
FROM updated u
JOIN publisher_statuses ps ON ps.id = u.status_id;

-- name: AdminDeletePublisher :exec
DELETE FROM publishers WHERE id = $1;

-- name: AdminHardDeletePublisher :one
SELECT hard_delete_publisher($1) as deletion_summary;

-- Admin Statistics --

-- name: AdminGetStatistics :one
SELECT
    (SELECT COUNT(*) FROM publishers) as total_publishers,
    (SELECT COUNT(*) FROM publishers p
     JOIN publisher_statuses ps ON ps.id = p.status_id
     WHERE ps.key = 'active') as active_publishers,
    (SELECT COUNT(*) FROM publishers p
     JOIN publisher_statuses ps ON ps.id = p.status_id
     WHERE ps.key = 'pending') as pending_publishers,
    (SELECT COUNT(*) FROM algorithms a
     JOIN algorithm_statuses astatus ON astatus.id = a.status_id
     WHERE astatus.key = 'active') as published_algorithms,
    (SELECT COUNT(*) FROM geo_localities) as total_localities,
    (SELECT COUNT(*) FROM publisher_coverage WHERE is_active = true) as active_coverage_areas;

-- Admin Algorithm Management --

-- name: AdminListAlgorithms :many
SELECT
    a.id, a.publisher_id, a.name, a.status_id,
    astatus.key as status_key,
    astatus.display_name_hebrew as status_display_hebrew,
    astatus.display_name_english as status_display_english,
    a.is_public,
    a.created_at, a.updated_at,
    p.name as publisher_name
FROM algorithms a
JOIN algorithm_statuses astatus ON astatus.id = a.status_id
JOIN publishers p ON a.publisher_id = p.id
WHERE ($1::text IS NULL OR astatus.key = $1)
ORDER BY a.updated_at DESC
LIMIT $2 OFFSET $3;

-- name: AdminCountAlgorithms :one
SELECT COUNT(*)
FROM algorithms a
JOIN algorithm_statuses astatus ON astatus.id = a.status_id
WHERE ($1::text IS NULL OR astatus.key = $1);

-- Publisher Invitations --
-- Schema: id, publisher_id, email, role_id, token, expires_at, created_at

-- name: GetPendingInvitations :many
SELECT pi.id, pi.email, pi.role_id,
       pr.key as role_key,
       pr.display_name_hebrew as role_display_hebrew,
       pr.display_name_english as role_display_english,
       pi.expires_at, pi.created_at
FROM publisher_invitations pi
JOIN publisher_roles pr ON pr.id = pi.role_id
WHERE pi.publisher_id = $1 AND pi.expires_at > NOW()
ORDER BY pi.created_at DESC;

-- name: GetExpiredInvitations :many
SELECT pi.id, pi.email, pi.role_id,
       pr.key as role_key,
       pr.display_name_hebrew as role_display_hebrew,
       pr.display_name_english as role_display_english,
       pi.expires_at, pi.created_at
FROM publisher_invitations pi
JOIN publisher_roles pr ON pr.id = pi.role_id
WHERE pi.publisher_id = $1 AND pi.expires_at <= NOW()
ORDER BY pi.created_at DESC;

-- name: GetInvitationByToken :one
SELECT pi.id, pi.publisher_id, pi.email, pi.role_id,
       pr.key as role_key,
       pr.display_name_hebrew as role_display_hebrew,
       pr.display_name_english as role_display_english,
       pi.expires_at, p.name as publisher_name
FROM publisher_invitations pi
JOIN publisher_roles pr ON pr.id = pi.role_id
JOIN publishers p ON pi.publisher_id = p.id
WHERE pi.token = $1 AND pi.expires_at > NOW();

-- name: CreateInvitation :one
INSERT INTO publisher_invitations (publisher_id, email, role_id, token, expires_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING id;

-- name: UpdateInvitationToken :exec
UPDATE publisher_invitations
SET token = $1, expires_at = $2
WHERE id = $3;

-- name: DeleteInvitation :exec
DELETE FROM publisher_invitations
WHERE id = $1;

-- name: DeleteExpiredInvitations :exec
DELETE FROM publisher_invitations
WHERE publisher_id = $1 AND expires_at <= NOW();

-- name: CountPendingInvitationsForEmail :one
SELECT COUNT(*)
FROM publisher_invitations
WHERE publisher_id = $1 AND LOWER(email) = LOWER($2) AND expires_at > NOW();

-- Team Management --

-- name: GetPublisherOwner :one
SELECT clerk_user_id FROM publishers WHERE id = $1;

-- Publisher Existence and Basic Info --

-- name: CheckPublisherExists :one
SELECT EXISTS(SELECT 1 FROM publishers WHERE id = $1);

-- name: GetPublisherNameByID :one
SELECT name FROM publishers WHERE id = $1;

-- name: GetAllPublishersBasicInfo :many
SELECT id, name FROM publishers ORDER BY name;

-- name: GetPublisherEmailAndName :one
SELECT contact_email, name FROM publishers WHERE id = $1;

-- name: GetPublisherNameAndDeletedAt :one
SELECT name, deleted_at FROM publishers WHERE id = $1;

-- Extended Admin Publisher Listing (with all fields, including soft-deleted) --

-- name: AdminListAllPublishers :many
SELECT p.id, p.clerk_user_id, p.name, p.contact_email, p.website,
       p.logo_url, p.description, p.status_id,
       ps.key as status_key,
       ps.display_name_hebrew as status_display_hebrew,
       ps.display_name_english as status_display_english,
       p.is_certified, p.suspension_reason,
       p.deleted_at, p.deleted_by, p.created_at, p.updated_at
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id
WHERE ($1::boolean = true OR p.deleted_at IS NULL)
ORDER BY
    CASE WHEN $1::boolean = true THEN p.deleted_at END DESC NULLS FIRST,
    p.created_at DESC;

-- Publisher Creation --

-- name: AdminCreatePublisher :one
INSERT INTO publishers (name, slug, contact_email, website, description, status_id)
VALUES ($1, $2, $3, $4, $5, (SELECT id FROM publisher_statuses WHERE key = 'active'))
RETURNING id, name, slug, contact_email, website, description,
          status_id, created_at, updated_at;

-- Publisher Updates --

-- name: AdminSuspendPublisher :one
UPDATE publishers
SET status_id = (SELECT ps.id FROM publisher_statuses ps WHERE ps.key = 'suspended'),
    suspension_reason = $1,
    updated_at = NOW()
WHERE publishers.id = $2
RETURNING publishers.id, publishers.name, publishers.contact_email, publishers.status_id, publishers.suspension_reason, publishers.created_at, publishers.updated_at;

-- name: AdminReactivatePublisher :one
UPDATE publishers
SET status_id = (SELECT ps.id FROM publisher_statuses ps WHERE ps.key = 'active'),
    suspension_reason = NULL,
    updated_at = NOW()
WHERE publishers.id = $1
RETURNING publishers.id, publishers.name, publishers.contact_email, publishers.status_id, publishers.created_at, publishers.updated_at;

-- name: AdminUpdatePublisherFields :one
UPDATE publishers
SET name = COALESCE(sqlc.narg('name'), name),
    slug = CASE WHEN sqlc.narg('name') IS NOT NULL THEN sqlc.narg('slug') ELSE slug END,
    contact_email = COALESCE(sqlc.narg('email'), contact_email),
    website = COALESCE(sqlc.narg('website'), website),
    description = COALESCE(sqlc.narg('description'), description),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING id, name, slug, contact_email, website, description, status_id, created_at, updated_at;

-- name: AdminSetPublisherCertified :one
UPDATE publishers
SET is_certified = $1, updated_at = NOW()
WHERE id = $2
RETURNING id, name, is_certified, updated_at;

-- Soft Delete and Restore --

-- name: AdminSoftDeletePublisher :one
UPDATE publishers
SET deleted_at = NOW(), deleted_by = $1, updated_at = NOW()
WHERE id = $2 AND deleted_at IS NULL
RETURNING deleted_at;

-- name: AdminRestorePublisher :one
UPDATE publishers
SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW()
WHERE id = $1 AND deleted_at IS NOT NULL
RETURNING id, name, status_id, updated_at;

-- Permanent Delete --

-- name: AdminPermanentDeletePublisher :exec
DELETE FROM publishers WHERE id = $1;

-- Admin Statistics (legacy query for backward compatibility) --

-- name: AdminGetPublisherStats :one
SELECT
    COUNT(*) FILTER (WHERE ps.key IN ('active', 'pending', 'suspended')) as total,
    COUNT(*) FILTER (WHERE ps.key = 'active') as active,
    COUNT(*) FILTER (WHERE ps.key IN ('pending')) as pending,
    COUNT(*) FILTER (WHERE ps.key = 'suspended') as suspended
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id;

-- System Config Management --
-- NOTE: system_config table not yet created - queries commented out

-- name: CheckSystemConfigTableExists :one
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'system_config'
);

-- Commented out until system_config table is created:
-- -- name: GetAllSystemConfig :many
-- SELECT key, value, description, updated_at
-- FROM system_config
-- ORDER BY key;

-- -- name: UpdateSystemConfig :one
-- UPDATE system_config
-- SET value = $1, updated_at = NOW()
-- WHERE key = $2
-- RETURNING key, value, description, updated_at;
