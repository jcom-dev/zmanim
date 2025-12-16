-- name: ListZmanTags :many
-- List all available zman tags, optionally filtered by type
SELECT id, tag_key, name, display_name_hebrew, display_name_english, tag_type, description, color, sort_order, created_at
FROM zman_tags
WHERE (sqlc.narg('tag_type')::VARCHAR IS NULL OR tag_type = sqlc.narg('tag_type')::VARCHAR)
ORDER BY sort_order, tag_key;

-- name: GetZmanTagByKey :one
-- Get a single tag by its key
SELECT id, tag_key, name, display_name_hebrew, display_name_english, tag_type, description, color, sort_order, created_at
FROM zman_tags
WHERE tag_key = $1;

-- name: GetZmanTagByID :one
-- Get a single tag by ID
SELECT id, tag_key, name, display_name_hebrew, display_name_english, tag_type, description, color, sort_order, created_at
FROM zman_tags
WHERE id = $1;

-- name: CreateZmanTag :one
-- Create a new zman tag
INSERT INTO zman_tags (tag_key, name, display_name_hebrew, display_name_english, tag_type, description, sort_order)
VALUES ($1, $1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: UpdateZmanTag :one
-- Update an existing zman tag
UPDATE zman_tags
SET display_name_hebrew = $2,
    display_name_english = $3,
    tag_type = $4,
    description = $5,
    sort_order = $6
WHERE id = $1
RETURNING *;

-- name: DeleteZmanTag :exec
-- Delete a zman tag (will cascade delete from junction table)
DELETE FROM zman_tags WHERE id = $1;

-- name: GetTagsForMasterZman :many
-- Get all tags for a specific master zman
SELECT t.id, t.tag_key, t.name, t.display_name_hebrew, t.display_name_english, t.tag_type, t.description, t.color, t.sort_order, t.created_at
FROM zman_tags t
JOIN master_zman_tags mzt ON t.id = mzt.tag_id
WHERE mzt.master_zman_id = $1
ORDER BY t.sort_order, t.tag_key;

-- name: AddTagToMasterZman :exec
-- Add a tag to a master zman
INSERT INTO master_zman_tags (master_zman_id, tag_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: AddTagToMasterZmanByKey :exec
-- Add a tag to a master zman by tag key
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT $1, id FROM zman_tags WHERE tag_key = $2
ON CONFLICT DO NOTHING;

-- name: RemoveTagFromMasterZman :exec
-- Remove a tag from a master zman
DELETE FROM master_zman_tags
WHERE master_zman_id = $1 AND tag_id = $2;

-- name: ClearMasterZmanTags :exec
-- Remove all tags from a master zman (used before setting new tags)
DELETE FROM master_zman_tags WHERE master_zman_id = $1;

-- name: GetMasterZmanimByTags :many
-- Get master zmanim that have ALL specified tags (AND logic)
SELECT DISTINCT mz.*
FROM master_zmanim_registry mz
WHERE mz.id IN (
    SELECT mzt.master_zman_id
    FROM master_zman_tags mzt
    JOIN zman_tags t ON mzt.tag_id = t.id
    WHERE t.tag_key = ANY(sqlc.arg('tag_keys')::VARCHAR[])
    GROUP BY mzt.master_zman_id
    HAVING COUNT(DISTINCT t.tag_key) = array_length(sqlc.arg('tag_keys')::VARCHAR[], 1)
)
ORDER BY mz.sort_order, mz.zman_key;

-- name: GetMasterZmanimByAnyTag :many
-- Get master zmanim that have ANY of the specified tags (OR logic)
SELECT DISTINCT mz.*
FROM master_zmanim_registry mz
JOIN master_zman_tags mzt ON mz.id = mzt.master_zman_id
JOIN zman_tags t ON mzt.tag_id = t.id
WHERE t.tag_key = ANY(sqlc.arg('tag_keys')::VARCHAR[])
ORDER BY mz.sort_order, mz.zman_key;

-- name: GetMasterZmanimByTagType :many
-- Get master zmanim that have tags of a specific type
SELECT DISTINCT mz.*
FROM master_zmanim_registry mz
JOIN master_zman_tags mzt ON mz.id = mzt.master_zman_id
JOIN zman_tags t ON mzt.tag_id = t.id
WHERE t.tag_type = $1
ORDER BY mz.sort_order, mz.zman_key;

-- name: ListMasterZmanimWithTags :many
-- List all master zmanim with their tags as JSON array
SELECT
    mz.id,
    mz.zman_key,
    mz.canonical_hebrew_name,
    mz.canonical_english_name,
    mz.transliteration,
    mz.time_category,
    mz.default_formula_dsl,
    mz.is_core,
    mz.sort_order,
    mz.description,
    mz.created_at,
    mz.updated_at,
    COALESCE(
        (SELECT json_agg(json_build_object(
            'tag_key', t.tag_key,
            'display_name_hebrew', t.display_name_hebrew,
            'display_name_english', t.display_name_english,
            'tag_type', t.tag_type
        ) ORDER BY t.sort_order)
        FROM master_zman_tags mzt
        JOIN zman_tags t ON mzt.tag_id = t.id
        WHERE mzt.master_zman_id = mz.id),
        '[]'::json
    ) AS tags
FROM master_zmanim_registry mz
ORDER BY mz.sort_order, mz.zman_key;

-- name: GetMasterZmanWithTags :one
-- Get a single master zman with its tags
SELECT
    mz.id,
    mz.zman_key,
    mz.canonical_hebrew_name,
    mz.canonical_english_name,
    mz.transliteration,
    mz.time_category,
    mz.default_formula_dsl,
    mz.is_core,
    mz.sort_order,
    mz.description,
    mz.created_at,
    mz.updated_at,
    COALESCE(
        (SELECT json_agg(json_build_object(
            'tag_key', t.tag_key,
            'display_name_hebrew', t.display_name_hebrew,
            'display_name_english', t.display_name_english,
            'tag_type', t.tag_type
        ) ORDER BY t.sort_order)
        FROM master_zman_tags mzt
        JOIN zman_tags t ON mzt.tag_id = t.id
        WHERE mzt.master_zman_id = mz.id),
        '[]'::json
    ) AS tags
FROM master_zmanim_registry mz
WHERE mz.id = $1;

-- name: GetMasterZmanWithTagsByKey :one
-- Get a single master zman with its tags by zman_key
SELECT
    mz.id,
    mz.zman_key,
    mz.canonical_hebrew_name,
    mz.canonical_english_name,
    mz.transliteration,
    mz.time_category,
    mz.default_formula_dsl,
    mz.is_core,
    mz.sort_order,
    mz.description,
    mz.created_at,
    mz.updated_at,
    COALESCE(
        (SELECT json_agg(json_build_object(
            'tag_key', t.tag_key,
            'display_name_hebrew', t.display_name_hebrew,
            'display_name_english', t.display_name_english,
            'tag_type', t.tag_type
        ) ORDER BY t.sort_order)
        FROM master_zman_tags mzt
        JOIN zman_tags t ON mzt.tag_id = t.id
        WHERE mzt.master_zman_id = mz.id),
        '[]'::json
    ) AS tags
FROM master_zmanim_registry mz
WHERE mz.zman_key = $1;
