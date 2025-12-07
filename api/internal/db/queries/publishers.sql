-- Publishers SQL Queries
-- SQLc will generate type-safe Go code from these queries

-- name: GetPublisherByID :one
SELECT p.id, p.clerk_user_id, p.name, p.email, p.description, p.bio,
       p.website, p.logo_url, p.logo_data, p.status_id,
       ps.key as status_key,
       ps.display_name_hebrew as status_display_hebrew,
       ps.display_name_english as status_display_english,
       p.created_at, p.updated_at
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id
WHERE p.id = $1;

-- name: GetPublisherByClerkUserID :one
SELECT id
FROM publishers
WHERE clerk_user_id = $1;

-- name: GetPublisherFullByClerkUserID :one
SELECT p.id, p.clerk_user_id, p.name, p.email, p.description, p.bio,
       p.website, p.logo_url, p.logo_data, p.status_id,
       ps.key as status_key,
       ps.display_name_hebrew as status_display_hebrew,
       ps.display_name_english as status_display_english,
       p.created_at, p.updated_at
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id
WHERE p.clerk_user_id = $1;

-- name: ListPublishers :many
SELECT p.id, p.name, p.status_id,
       ps.key as status_key,
       ps.display_name_hebrew as status_display_hebrew,
       ps.display_name_english as status_display_english,
       p.created_at
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id
WHERE ($1::text IS NULL OR p.region_id = $1)
ORDER BY p.name
LIMIT $2 OFFSET $3;

-- name: CountPublishers :one
SELECT COUNT(*)
FROM publishers
WHERE ($1::text IS NULL OR region_id = $1);

-- name: ListPublishersByIDs :many
SELECT p.id, p.name, p.status_id,
       ps.key as status_key,
       ps.display_name_hebrew as status_display_hebrew,
       ps.display_name_english as status_display_english
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id
WHERE p.id = ANY($1::text[])
ORDER BY p.name;

-- name: GetPublisherBasic :one
SELECT p.id, p.name, p.status_id,
       ps.key as status_key,
       ps.display_name_hebrew as status_display_hebrew,
       ps.display_name_english as status_display_english
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id
WHERE p.id = $1;

-- name: GetPublisherBasicByClerkUserID :one
SELECT p.id, p.name, p.status_id,
       ps.key as status_key,
       ps.display_name_hebrew as status_display_hebrew,
       ps.display_name_english as status_display_english
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id
WHERE p.clerk_user_id = $1;

-- name: UpdatePublisherProfile :one
UPDATE publishers
SET name = COALESCE(sqlc.narg('update_name'), name),
    email = COALESCE(sqlc.narg('update_email'), email),
    website = COALESCE(sqlc.narg('update_website'), website),
    bio = COALESCE(sqlc.narg('update_bio'), bio),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING id, clerk_user_id, name, email, description, bio,
          website, logo_url, logo_data, status_id, created_at, updated_at;

-- name: UpdatePublisherProfileByClerkUserID :one
UPDATE publishers
SET name = COALESCE(sqlc.narg('update_name'), name),
    email = COALESCE(sqlc.narg('update_email'), email),
    website = COALESCE(sqlc.narg('update_website'), website),
    bio = COALESCE(sqlc.narg('update_bio'), bio),
    updated_at = NOW()
WHERE clerk_user_id = sqlc.arg('clerk_user_id')
RETURNING id, clerk_user_id, name, email, description, bio,
          website, logo_url, logo_data, status_id, created_at, updated_at;

-- name: CreatePublisher :one
WITH inserted AS (
    INSERT INTO publishers (name, email, status_id, clerk_user_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id, clerk_user_id, name, email, description, bio,
              website, logo_url, logo_data, status_id, created_at, updated_at
)
SELECT i.id, i.clerk_user_id, i.name, i.email, i.description, i.bio,
       i.website, i.logo_url, i.logo_data, i.status_id,
       ps.key as status_key,
       ps.display_name_hebrew as status_display_hebrew,
       ps.display_name_english as status_display_english,
       i.created_at, i.updated_at
FROM inserted i
JOIN publisher_statuses ps ON ps.id = i.status_id;

-- name: UpdatePublisherStatus :one
WITH updated AS (
    UPDATE publishers
    SET status_id = $2, updated_at = NOW()
    WHERE publishers.id = $1
    RETURNING id, clerk_user_id, name, email, description, bio,
              website, logo_url, logo_data, status_id, created_at, updated_at
)
SELECT u.id, u.clerk_user_id, u.name, u.email, u.description, u.bio,
       u.website, u.logo_url, u.logo_data, u.status_id,
       ps.key as status_key,
       ps.display_name_hebrew as status_display_hebrew,
       ps.display_name_english as status_display_english,
       u.created_at, u.updated_at
FROM updated u
JOIN publisher_statuses ps ON ps.id = u.status_id;

-- name: UpdatePublisherLogo :one
UPDATE publishers
SET logo_data = $2, updated_at = NOW()
WHERE id = $1
RETURNING id, logo_data;

-- name: DeletePublisher :exec
DELETE FROM publishers
WHERE id = $1;

-- name: GetPublisherDashboardSummary :one
SELECT
    p.name,
    p.is_verified,
    ps.key as status_key,
    ps.display_name_hebrew as status_display_hebrew,
    ps.display_name_english as status_display_english
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id
WHERE p.id = $1;

-- name: GetPublisherAlgorithmSummary :one
SELECT
    astatus.key as status_key,
    a.name,
    TO_CHAR(a.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
FROM algorithms a
JOIN algorithm_statuses astatus ON astatus.id = a.status_id
WHERE a.publisher_id = $1
ORDER BY a.updated_at DESC
LIMIT 1;

-- name: GetPublisherCoverageCount :one
SELECT COUNT(*)
FROM publisher_coverage
WHERE publisher_id = $1 AND is_active = true;

-- Team/Invitation Queries

-- name: GetPublisherOwnerID :one
SELECT clerk_user_id
FROM publishers
WHERE id = $1;

-- name: GetPublisherNameForTeam :one
SELECT name
FROM publishers
WHERE id = $1;

-- name: ListPendingInvitationsByPublisher :many
SELECT id, email, expires_at, created_at
FROM publisher_invitations
WHERE publisher_id = $1
ORDER BY created_at DESC;

-- name: GetInvitationForResend :one
SELECT pi.publisher_id, pi.email, pi.token
FROM publisher_invitations pi
JOIN publishers p ON pi.publisher_id = p.id
WHERE pi.id = $1;

-- name: DeletePendingInvitation :execresult
DELETE FROM publisher_invitations
WHERE id = $1;

-- name: SearchPublishersWithAlgorithm :many
SELECT DISTINCT
    p.id::text as id, p.name, p.description, p.logo_url,
    (p.status_id = (SELECT id FROM publisher_statuses WHERE key = 'verified') OR
     p.status_id = (SELECT id FROM publisher_statuses WHERE key = 'active')) as is_verified,
    COUNT(DISTINCT pz.id) as zmanim_count
FROM publishers p
JOIN publisher_zmanim pz ON pz.publisher_id = p.id
    AND pz.is_published = true
    AND pz.is_enabled = true
    AND pz.deleted_at IS NULL
WHERE (p.status_id = (SELECT id FROM publisher_statuses WHERE key = 'verified') OR
       p.status_id = (SELECT id FROM publisher_statuses WHERE key = 'active'))
  AND (p.name ILIKE $1 OR p.description ILIKE $1)
GROUP BY p.id, p.name, p.description, p.logo_url, p.status_id
HAVING COUNT(DISTINCT pz.id) > 0
ORDER BY p.name
LIMIT $2 OFFSET $3;

-- name: SearchPublishersAll :many
SELECT
    p.id::text as id, p.name, p.description, p.logo_url,
    (p.status_id = (SELECT id FROM publisher_statuses WHERE key = 'verified') OR
     p.status_id = (SELECT id FROM publisher_statuses WHERE key = 'active')) as is_verified,
    0 as zmanim_count
FROM publishers p
WHERE (p.status_id = (SELECT id FROM publisher_statuses WHERE key = 'verified') OR
       p.status_id = (SELECT id FROM publisher_statuses WHERE key = 'active'))
  AND (p.name ILIKE $1 OR p.description ILIKE $1)
ORDER BY p.name
LIMIT $2 OFFSET $3;

-- name: GetPublisherProfileByID :one
SELECT id, clerk_user_id, name, email,
       COALESCE(description, '') as description, COALESCE(bio, '') as bio,
       website, logo_url, logo_data, status_id, is_verified, created_at, updated_at
FROM publishers
WHERE id = $1;

-- name: GetPublisherProfileByClerkUserID :one
SELECT id, clerk_user_id, name, email,
       COALESCE(description, '') as description, COALESCE(bio, '') as bio,
       website, logo_url, logo_data, status_id, is_verified, created_at, updated_at
FROM publishers
WHERE clerk_user_id = $1;

-- name: GetAccessiblePublishersByClerkUserID :one
SELECT id::text as id, name,
       (SELECT key FROM publisher_statuses WHERE id = p.status_id) as status_key
FROM publishers p
WHERE clerk_user_id = $1;

-- name: GetAccessiblePublishersByIDs :many
SELECT id::text as id, name,
       (SELECT key FROM publisher_statuses WHERE id = p.status_id) as status_key
FROM publishers p
WHERE id = ANY($1::text[])
ORDER BY name;

-- name: GetPublisherCitiesCovered :one
SELECT COALESCE(SUM(
    CASE coverage_level
        WHEN 'city' THEN 1
        WHEN 'region' THEN (
            SELECT COUNT(*) FROM geo_cities c
            JOIN geo_regions r ON c.region_id = r.id
            JOIN geo_countries co ON r.country_id = co.id
            WHERE co.code = pc.country_code AND r.name = pc.region
        )
        WHEN 'country' THEN (
            SELECT COUNT(*) FROM geo_cities c
            JOIN geo_regions r ON c.region_id = r.id
            JOIN geo_countries co ON r.country_id = co.id
            WHERE co.code = pc.country_code
        )
        ELSE 0
    END
), 0)::bigint as cities_covered
FROM publisher_coverage pc
WHERE publisher_id = $1 AND is_active = true;

-- name: GetPublisherFullProfileByID :one
SELECT p.id, p.clerk_user_id, p.name, p.email,
       COALESCE(p.description, '') as description,
       COALESCE(p.bio, '') as bio,
       p.website, p.logo_url, p.logo_data, p.status_id, p.is_verified,
       ps.key as status_key,
       p.created_at, p.updated_at
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id
WHERE p.id = $1;

-- name: GetPublisherFullProfileByClerkUserID :one
SELECT p.id, p.clerk_user_id, p.name, p.email,
       COALESCE(p.description, '') as description,
       COALESCE(p.bio, '') as bio,
       p.website, p.logo_url, p.logo_data, p.status_id, p.is_verified,
       ps.key as status_key,
       p.created_at, p.updated_at
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id
WHERE p.clerk_user_id = $1;
