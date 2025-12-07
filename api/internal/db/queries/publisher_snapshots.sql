-- ============================================
-- PUBLISHER SNAPSHOT (ZMANIM-ONLY) QUERIES
-- ============================================
-- Snapshots store only zmanim data (not profile/coverage)
-- Used for version control of publisher algorithms

-- name: CreatePublisherSnapshot :one
INSERT INTO publisher_snapshots (
    publisher_id,
    description,
    snapshot_data,
    created_by
) VALUES (
    $1, $2, $3, $4
)
RETURNING *;

-- name: ListPublisherSnapshots :many
SELECT
    id,
    publisher_id,
    description,
    created_by,
    created_at
FROM publisher_snapshots
WHERE publisher_id = $1
ORDER BY created_at DESC
LIMIT 20;

-- name: GetPublisherSnapshot :one
SELECT *
FROM publisher_snapshots
WHERE id = $1 AND publisher_id = $2;

-- name: DeletePublisherSnapshot :exec
DELETE FROM publisher_snapshots
WHERE id = $1 AND publisher_id = $2;

-- name: GetLatestPublisherSnapshot :one
SELECT *
FROM publisher_snapshots
WHERE publisher_id = $1
ORDER BY created_at DESC
LIMIT 1;

-- ============================================
-- ZMANIM SNAPSHOT DATA QUERIES
-- ============================================

-- name: GetPublisherZmanimForSnapshot :many
-- Get all active (non-deleted) zmanim for snapshot export
SELECT
    pz.zman_key,
    pz.hebrew_name,
    pz.english_name,
    pz.transliteration,
    pz.description,
    pz.formula_dsl,
    pz.ai_explanation,
    pz.publisher_comment,
    pz.is_enabled,
    pz.is_visible,
    pz.is_published,
    pz.is_beta,
    pz.is_custom,
    pz.time_category_id,
    tc.key AS category,
    tc.display_name_hebrew AS category_display_hebrew,
    tc.display_name_english AS category_display_english,
    pz.master_zman_id,
    pz.linked_publisher_zman_id,
    pz.source_type_id,
    zst.key AS source_type
FROM publisher_zmanim pz
JOIN time_categories tc ON tc.id = pz.time_category_id
LEFT JOIN zman_source_types zst ON pz.source_type_id = zst.id
WHERE pz.publisher_id = $1 AND pz.deleted_at IS NULL;

-- name: GetAllPublisherZmanimKeys :many
-- Get all active zman keys for a publisher (for diff comparison)
SELECT zman_key
FROM publisher_zmanim
WHERE publisher_id = $1 AND deleted_at IS NULL;

-- name: GetPublisherZmanForSnapshotCompare :one
-- Get a specific zman by key for comparison during restore
SELECT
    pz.id,
    pz.zman_key,
    pz.hebrew_name,
    pz.english_name,
    pz.transliteration,
    pz.description,
    pz.formula_dsl,
    pz.ai_explanation,
    pz.publisher_comment,
    pz.is_enabled,
    pz.is_visible,
    pz.is_published,
    pz.is_beta,
    pz.is_custom,
    pz.time_category_id,
    tc.key AS category,
    tc.display_name_hebrew AS category_display_hebrew,
    tc.display_name_english AS category_display_english,
    pz.master_zman_id,
    pz.linked_publisher_zman_id,
    pz.source_type_id,
    zst.key AS source_type,
    pz.current_version
FROM publisher_zmanim pz
JOIN time_categories tc ON tc.id = pz.time_category_id
LEFT JOIN zman_source_types zst ON pz.source_type_id = zst.id
WHERE pz.publisher_id = $1 AND pz.zman_key = $2 AND pz.deleted_at IS NULL;

-- ============================================
-- SNAPSHOT RESTORE QUERIES
-- ============================================

-- name: SoftDeleteZmanForRestore :exec
-- Soft delete a zman that exists in current state but not in snapshot being restored
UPDATE publisher_zmanim
SET deleted_at = NOW(), deleted_by = $3, updated_at = NOW()
WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NULL;

-- name: RestoreDeletedZmanForSnapshot :exec
-- Restore a soft-deleted zman that exists in snapshot being restored
UPDATE publisher_zmanim
SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW()
WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NOT NULL;

-- name: UpdateZmanFromSnapshot :exec
-- Update an existing zman with data from snapshot (creates new version via trigger)
UPDATE publisher_zmanim
SET
    hebrew_name = $3,
    english_name = $4,
    transliteration = $5,
    description = $6,
    formula_dsl = $7,
    ai_explanation = $8,
    publisher_comment = $9,
    is_enabled = $10,
    is_visible = $11,
    is_published = $12,
    is_beta = $13,
    is_custom = $14,
    time_category_id = $15,
    master_zman_id = $16,
    linked_publisher_zman_id = $17,
    source_type_id = $18,
    updated_at = NOW()
WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NULL;

-- name: InsertZmanFromSnapshot :exec
-- Insert a new zman from snapshot (zman doesn't exist at all)
INSERT INTO publisher_zmanim (
    publisher_id,
    zman_key,
    hebrew_name,
    english_name,
    transliteration,
    description,
    formula_dsl,
    ai_explanation,
    publisher_comment,
    is_enabled,
    is_visible,
    is_published,
    is_beta,
    is_custom,
    time_category_id,
    master_zman_id,
    linked_publisher_zman_id,
    source_type_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
);

-- name: GetDeletedZmanByKey :one
-- Check if a zman exists in deleted state (for restore decision)
SELECT id, zman_key
FROM publisher_zmanim
WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NOT NULL;
