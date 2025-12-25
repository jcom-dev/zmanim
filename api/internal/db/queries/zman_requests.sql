-- Zman Request Queries
-- Epic 5, Story 5.0: Enhanced Zman Registry Requests

-- name: CreateZmanRequest :one
-- Create a new zman request from a publisher
INSERT INTO zman_registry_requests (
    publisher_id,
    requested_key,
    requested_hebrew_name,
    requested_english_name,
    transliteration,
    requested_formula_dsl,
    time_category_id,
    description,
    halachic_notes,
    halachic_source,
    publisher_email,
    publisher_name,
    auto_add_on_approval,
    status_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
    (SELECT rs.id FROM request_statuses rs WHERE rs.key = 'pending')
)
RETURNING
    id, publisher_id, requested_key, requested_hebrew_name, requested_english_name,
    transliteration, requested_formula_dsl, time_category_id, description,
    halachic_notes, halachic_source, publisher_email, publisher_name, auto_add_on_approval,
    status_id, created_at;

-- name: GetZmanRequest :one
-- Get a specific zman request by ID
SELECT
    zrr.id,
    zrr.publisher_id,
    zrr.requested_key,
    zrr.requested_hebrew_name,
    zrr.requested_english_name,
    zrr.transliteration,
    zrr.requested_formula_dsl,
    zrr.time_category_id,
    tc.key as time_category,
    zrr.description,
    zrr.halachic_notes,
    zrr.halachic_source,
    zrr.publisher_email,
    zrr.publisher_name,
    zrr.auto_add_on_approval,
    zrr.status_id,
    rs.key as status,
    zrr.reviewed_by,
    zrr.reviewed_at,
    zrr.reviewer_notes,
    zrr.created_at,
    p.name as submitter_name
FROM zman_registry_requests zrr
JOIN publishers p ON zrr.publisher_id = p.id
JOIN request_statuses rs ON zrr.status_id = rs.id
JOIN time_categories tc ON zrr.time_category_id = tc.id
WHERE zrr.id = $1;

-- name: GetPublisherZmanRequests :many
-- Get all zman requests for a specific publisher
SELECT
    zrr.id,
    zrr.publisher_id,
    zrr.requested_key,
    zrr.requested_hebrew_name,
    zrr.requested_english_name,
    zrr.transliteration,
    zrr.time_category_id,
    tc.key as time_category,
    zrr.status_id,
    rs.key as status,
    zrr.reviewed_at,
    zrr.reviewer_notes,
    zrr.created_at
FROM zman_registry_requests zrr
JOIN request_statuses rs ON zrr.status_id = rs.id
JOIN time_categories tc ON zrr.time_category_id = tc.id
WHERE zrr.publisher_id = $1
ORDER BY zrr.created_at DESC;

-- name: GetAllZmanRequests :many
-- Get all zman requests (for admin) with optional status filter
SELECT
    zrr.id,
    zrr.publisher_id,
    zrr.requested_key,
    zrr.requested_hebrew_name,
    zrr.requested_english_name,
    zrr.transliteration,
    zrr.time_category_id,
    tc.key as time_category,
    zrr.status_id,
    rs.key as status,
    zrr.reviewed_by,
    zrr.reviewed_at,
    zrr.created_at,
    p.name as publisher_name
FROM zman_registry_requests zrr
JOIN publishers p ON zrr.publisher_id = p.id
JOIN request_statuses rs ON zrr.status_id = rs.id
JOIN time_categories tc ON zrr.time_category_id = tc.id
WHERE ($1::text IS NULL OR rs.key = $1)
ORDER BY
    CASE WHEN rs.key = 'pending' THEN 0 ELSE 1 END,
    zrr.created_at DESC;

-- name: ApproveZmanRequest :one
-- Approve a zman request
UPDATE zman_registry_requests
SET
    status_id = (SELECT rs.id FROM request_statuses rs WHERE rs.key = 'approved'),
    reviewed_by = $2,
    reviewed_at = NOW(),
    reviewer_notes = $3
WHERE zman_registry_requests.id = $1
RETURNING
    id, status_id, reviewed_by, reviewed_at, reviewer_notes,
    auto_add_on_approval, publisher_id;

-- name: RejectZmanRequest :one
-- Reject a zman request
UPDATE zman_registry_requests
SET
    status_id = (SELECT rs.id FROM request_statuses rs WHERE rs.key = 'rejected'),
    reviewed_by = $2,
    reviewed_at = NOW(),
    reviewer_notes = $3
WHERE zman_registry_requests.id = $1
RETURNING id, status_id, reviewed_by, reviewed_at, reviewer_notes;

-- name: AddZmanRequestTag :one
-- Add an existing tag to a zman request
INSERT INTO zman_request_tags (
    request_id,
    tag_id,
    is_new_tag_request
) VALUES ($1, $2, false)
RETURNING id, request_id, tag_id, is_new_tag_request, created_at;

-- name: AddZmanRequestNewTag :one
-- Request a new tag for a zman request
INSERT INTO zman_request_tags (
    request_id,
    requested_tag_name,
    requested_tag_type,
    is_new_tag_request
) VALUES ($1, $2, $3, true)
RETURNING id, request_id, requested_tag_name, requested_tag_type, is_new_tag_request, created_at;

-- name: GetZmanRequestTags :many
-- Get all tags (existing and requested) for a zman request
SELECT
    zrt.id,
    zrt.request_id,
    zrt.tag_id,
    zrt.requested_tag_name,
    zrt.requested_tag_type,
    zrt.is_new_tag_request,
    zrt.created_at,
    zt.tag_key as existing_tag_key,
    zt.display_name_english_ashkenazi as existing_tag_name_ashkenazi,
    zt.display_name_english_sephardi as existing_tag_name_sephardi,
    zt.tag_type_id as existing_tag_type_id,
    tt.key as existing_tag_type
FROM zman_request_tags zrt
LEFT JOIN zman_tags zt ON zrt.tag_id = zt.id
LEFT JOIN tag_types tt ON zt.tag_type_id = tt.id
WHERE zrt.request_id = $1;

-- name: DeleteZmanRequestTags :exec
-- Delete all tags for a zman request (used when updating request)
DELETE FROM zman_request_tags WHERE request_id = $1;

-- name: GetPendingZmanRequestCount :one
-- Get count of pending zman requests (for admin dashboard)
SELECT COUNT(*) as count
FROM zman_registry_requests zrr
JOIN request_statuses rs ON zrr.status_id = rs.id
WHERE rs.key = 'pending';

-- name: GetZmanRequestTag :one
-- Get a specific tag request by ID
SELECT
    zrt.id,
    zrt.request_id,
    zrt.tag_id,
    zrt.requested_tag_name,
    zrt.requested_tag_type,
    zrt.is_new_tag_request,
    zrt.created_at
FROM zman_request_tags zrt
WHERE zrt.id = $1;

-- name: ApproveTagRequest :one
-- Approve a new tag request - creates the tag and updates the request
-- Step 1: Create the new tag in zman_tags table
-- This query only creates the tag, the caller must update the request separately
INSERT INTO zman_tags (
    tag_key,
    display_name_hebrew,
    display_name_english_ashkenazi,
    display_name_english_sephardi,
    tag_type_id
) VALUES (
    $1, -- tag_key (generated from requested_tag_name)
    $2, -- display_name_hebrew
    $3, -- display_name_english_ashkenazi
    $4, -- display_name_english_sephardi (same as ashkenazi if not specified)
    (SELECT tt.id FROM tag_types tt WHERE tt.key = $5)  -- tag_type_id (from requested_tag_type key)
)
RETURNING id, tag_key, display_name_hebrew, display_name_english_ashkenazi, display_name_english_sephardi, tag_type_id, created_at;

-- name: LinkTagToRequest :exec
-- Update the tag request to link the newly created tag
-- Must also clear requested_tag_name to satisfy tag_reference_check constraint
UPDATE zman_request_tags
SET
    tag_id = $2,
    is_new_tag_request = false,
    requested_tag_name = NULL,
    requested_tag_type = NULL
WHERE id = $1;

-- name: FindTagByTagKey :one
-- Find an existing tag by tag_key (case-insensitive match)
SELECT
    zt.id,
    zt.tag_key,
    zt.display_name_hebrew,
    zt.display_name_english_ashkenazi,
    zt.display_name_english_sephardi,
    zt.tag_type_id,
    tt.key as tag_type,
    zt.created_at
FROM zman_tags zt
JOIN tag_types tt ON zt.tag_type_id = tt.id
WHERE LOWER(zt.tag_key) = LOWER($1)
LIMIT 1;

-- name: RejectTagRequest :exec
-- Reject a new tag request by deleting it from zman_request_tags
DELETE FROM zman_request_tags
WHERE id = $1 AND is_new_tag_request = true;

-- name: CreatePublisherZmanFromRequest :one
-- Create a publisher_zman entry from an approved zman request
-- This is used when auto_add_on_approval is true
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name,
    transliteration, description,
    formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_custom, time_category_id,
    dependencies, current_version
)
SELECT
    gen_random_uuid() AS id,
    zrr.publisher_id AS publisher_id,
    zrr.requested_key AS zman_key,
    zrr.requested_hebrew_name AS hebrew_name,
    zrr.requested_english_name AS english_name,
    zrr.transliteration AS transliteration,
    zrr.description AS description,
    zrr.requested_formula_dsl AS formula_dsl,
    NULL AS ai_explanation,
    NULL AS publisher_comment,
    true AS is_enabled,
    true AS is_visible,
    false AS is_published,
    true AS is_custom,
    tc.id AS time_category_id,
    '{}'::text[] AS dependencies,
    1 AS current_version
FROM zman_registry_requests zrr
JOIN time_categories tc ON zrr.time_category_id = tc.id
WHERE zrr.id = $1
ON CONFLICT (publisher_id, zman_key) DO NOTHING
RETURNING id, publisher_id, zman_key, hebrew_name, english_name,
    transliteration, description, formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_custom, time_category_id,
    dependencies, created_at, updated_at, current_version;
