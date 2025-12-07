-- Master Zmanim Registry SQL Queries
-- SQLc will generate type-safe Go code from these queries

-- ============================================
-- MASTER REGISTRY QUERIES
-- ============================================

-- name: GetAllMasterZmanim :many
-- Orders by time_category (chronological) then hebrew_name
SELECT
    mr.id, mr.zman_key, mr.canonical_hebrew_name, mr.canonical_english_name,
    mr.transliteration, mr.description, mr.halachic_notes, mr.halachic_source,
    tc.key as time_category, mr.default_formula_dsl, mr.is_core,
    mr.created_at, mr.updated_at
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
ORDER BY
    tc.sort_order,
    mr.canonical_hebrew_name;

-- name: GetMasterZmanimByCategory :many
SELECT
    mr.id, mr.zman_key, mr.canonical_hebrew_name, mr.canonical_english_name,
    mr.transliteration, mr.description, mr.halachic_notes, mr.halachic_source,
    tc.key as time_category, mr.default_formula_dsl, mr.is_core,
    mr.created_at, mr.updated_at
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
WHERE tc.key = $1
ORDER BY mr.canonical_hebrew_name;

-- name: GetMasterZmanByKey :one
SELECT
    mr.id, mr.zman_key, mr.canonical_hebrew_name, mr.canonical_english_name,
    mr.transliteration, mr.description, mr.halachic_notes, mr.halachic_source,
    tc.key as time_category, mr.default_formula_dsl, mr.is_core,
    mr.created_at, mr.updated_at
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
WHERE mr.zman_key = $1;

-- name: GetMasterZmanByID :one
SELECT
    mr.id, mr.zman_key, mr.canonical_hebrew_name, mr.canonical_english_name,
    mr.transliteration, mr.description, mr.halachic_notes, mr.halachic_source,
    tc.key as time_category, mr.default_formula_dsl, mr.is_core,
    mr.created_at, mr.updated_at
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
WHERE mr.id = $1;

-- name: SearchMasterZmanim :many
SELECT
    mr.id, mr.zman_key, mr.canonical_hebrew_name, mr.canonical_english_name,
    mr.transliteration, mr.description, mr.halachic_notes, mr.halachic_source,
    tc.key as time_category, mr.default_formula_dsl, mr.is_core,
    mr.created_at, mr.updated_at
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
WHERE
    mr.canonical_hebrew_name ILIKE '%' || $1 || '%'
    OR mr.canonical_english_name ILIKE '%' || $1 || '%'
    OR mr.transliteration ILIKE '%' || $1 || '%'
    OR mr.zman_key ILIKE '%' || $1 || '%'
ORDER BY
    CASE
        WHEN mr.canonical_english_name ILIKE $1 || '%' THEN 1
        WHEN mr.canonical_hebrew_name ILIKE $1 || '%' THEN 2
        ELSE 3
    END,
    tc.sort_order
LIMIT 50;

-- name: GetMasterZmanimGroupedByCategory :many
SELECT
    tc.key as time_category,
    json_agg(
        json_build_object(
            'id', mr.id,
            'zman_key', mr.zman_key,
            'canonical_hebrew_name', mr.canonical_hebrew_name,
            'canonical_english_name', mr.canonical_english_name,
            'transliteration', mr.transliteration,
            'default_formula_dsl', mr.default_formula_dsl,
            'is_core', mr.is_core
        ) ORDER BY mr.canonical_hebrew_name
    ) as zmanim
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
GROUP BY tc.key, tc.sort_order
ORDER BY tc.sort_order;

-- ============================================
-- TAG QUERIES
-- ============================================

-- name: GetAllTags :many
SELECT
    zt.id, zt.name, zt.display_name_hebrew, zt.display_name_english,
    tt.key as tag_type, zt.description, zt.color, zt.sort_order, zt.created_at
FROM zman_tags zt
LEFT JOIN tag_types tt ON zt.tag_type_id = tt.id
ORDER BY tt.sort_order, zt.sort_order, zt.name;

-- name: GetTagsByType :many
SELECT
    zt.id, zt.name, zt.display_name_hebrew, zt.display_name_english,
    tt.key as tag_type, zt.description, zt.color, zt.sort_order, zt.created_at
FROM zman_tags zt
LEFT JOIN tag_types tt ON zt.tag_type_id = tt.id
WHERE tt.key = $1
ORDER BY zt.sort_order, zt.name;

-- name: GetTagByName :one
SELECT
    zt.id, zt.name, zt.display_name_hebrew, zt.display_name_english,
    tt.key as tag_type, zt.description, zt.color, zt.sort_order, zt.created_at
FROM zman_tags zt
LEFT JOIN tag_types tt ON zt.tag_type_id = tt.id
WHERE zt.name = $1;

-- name: GetTagsForMasterZman :many
SELECT
    zt.id, zt.name, zt.display_name_hebrew, zt.display_name_english,
    tt.key as tag_type, zt.description, zt.color, zt.sort_order, zt.created_at
FROM zman_tags zt
LEFT JOIN tag_types tt ON zt.tag_type_id = tt.id
JOIN master_zman_tags mzt ON zt.id = mzt.tag_id
WHERE mzt.master_zman_id = $1
ORDER BY tt.sort_order, zt.sort_order;

-- name: GetMasterZmanimByTag :many
SELECT
    mr.id, mr.zman_key, mr.canonical_hebrew_name, mr.canonical_english_name,
    mr.transliteration, mr.description, mr.halachic_notes, mr.halachic_source,
    tc.key as time_category, mr.default_formula_dsl, mr.is_core,
    mr.created_at, mr.updated_at
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
JOIN master_zman_tags mzt ON mr.id = mzt.master_zman_id
JOIN zman_tags zt ON zt.id = mzt.tag_id
WHERE zt.name = $1
ORDER BY tc.sort_order, mr.canonical_hebrew_name;

-- ============================================
-- PUBLISHER ZMANIM WITH REGISTRY (new model)
-- ============================================

-- name: GetPublisherZmanimWithRegistry :many
SELECT
    pz.id,
    pz.publisher_id,
    pz.zman_key,
    COALESCE(mr.canonical_hebrew_name, pz.hebrew_name) AS hebrew_name,
    COALESCE(mr.canonical_english_name, pz.english_name) AS english_name,
    mr.transliteration,
    pz.formula_dsl,
    mr.default_formula_dsl,
    pz.ai_explanation,
    pz.publisher_comment,
    pz.is_enabled,
    pz.is_visible,
    pz.is_published,
    COALESCE(pz.is_custom, false) AS is_custom,
    tc.key AS time_category,
    pz.dependencies,
    pz.current_version,
    pz.created_at,
    pz.updated_at,
    pz.master_zman_id,
    mr.description AS zman_description,
    mr.halachic_notes,
    mr.is_core
FROM publisher_zmanim pz
LEFT JOIN master_zmanim_registry mr ON pz.master_zman_id = mr.id
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
WHERE pz.publisher_id = $1
  AND pz.deleted_at IS NULL
ORDER BY
    tc.sort_order,
    pz.hebrew_name;

-- name: GetPublisherZmanWithRegistry :one
SELECT
    pz.id,
    pz.publisher_id,
    pz.zman_key,
    COALESCE(mr.canonical_hebrew_name, pz.hebrew_name) AS hebrew_name,
    COALESCE(mr.canonical_english_name, pz.english_name) AS english_name,
    mr.transliteration,
    pz.formula_dsl,
    mr.default_formula_dsl,
    pz.ai_explanation,
    pz.publisher_comment,
    pz.is_enabled,
    pz.is_visible,
    pz.is_published,
    COALESCE(pz.is_custom, false) AS is_custom,
    tc.key AS time_category,
    pz.dependencies,
    pz.current_version,
    pz.created_at,
    pz.updated_at,
    pz.master_zman_id,
    mr.description AS zman_description,
    mr.halachic_notes,
    mr.is_core
FROM publisher_zmanim pz
LEFT JOIN master_zmanim_registry mr ON pz.master_zman_id = mr.id
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
WHERE pz.publisher_id = $1
  AND pz.zman_key = $2
  AND pz.deleted_at IS NULL;

-- name: CreatePublisherZmanFromRegistry :one
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name,
    transliteration, description,
    formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_custom, time_category_id,
    dependencies, master_zman_id, current_version
)
SELECT
    gen_random_uuid() AS id,
    $1 AS publisher_id,
    mr.zman_key AS zman_key,
    mr.canonical_hebrew_name AS hebrew_name,
    mr.canonical_english_name AS english_name,
    mr.transliteration AS transliteration,
    mr.description AS description,
    COALESCE(sqlc.narg('formula_dsl'), mr.default_formula_dsl) AS formula_dsl,
    NULL AS ai_explanation,
    NULL AS publisher_comment,
    true AS is_enabled,
    true AS is_visible,
    false AS is_published,
    false AS is_custom,
    tc.id AS time_category_id,
    '{}'::text[] AS dependencies,
    mr.id AS master_zman_id,
    1 AS current_version
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
WHERE mr.id = $2
RETURNING id, publisher_id, zman_key, hebrew_name, english_name,
    transliteration, description, formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_custom, time_category_id,
    dependencies, created_at, updated_at, master_zman_id, current_version;

-- name: ImportZmanimFromRegistryByKeys :many
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name,
    transliteration, description,
    formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_custom, time_category_id,
    dependencies, master_zman_id, current_version
)
SELECT
    gen_random_uuid(),
    $1,
    mr.zman_key,
    mr.canonical_hebrew_name,
    mr.canonical_english_name,
    mr.transliteration,
    mr.description,
    mr.default_formula_dsl,
    NULL,
    NULL,
    true,
    true,
    false,
    false,
    tc.id,
    '{}',
    mr.id,
    1
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
WHERE mr.zman_key = ANY($2::text[])
ON CONFLICT (publisher_id, zman_key) DO NOTHING
RETURNING id, publisher_id, zman_key, hebrew_name, english_name,
    transliteration, description, formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_custom, time_category_id,
    dependencies, created_at, updated_at, master_zman_id, current_version;

-- ============================================
-- SOFT DELETE QUERIES
-- ============================================

-- name: SoftDeletePublisherZman :one
UPDATE publisher_zmanim
SET deleted_at = NOW(), deleted_by = $3, updated_at = NOW()
WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NULL
RETURNING id, publisher_id, zman_key, deleted_at, deleted_by;

-- name: RestorePublisherZman :one
UPDATE publisher_zmanim
SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW()
WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NOT NULL
RETURNING id, publisher_id, zman_key, hebrew_name, english_name,
    formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_custom, time_category_id,
    dependencies, created_at, updated_at, master_zman_id, current_version;

-- name: GetDeletedPublisherZmanim :many
SELECT
    pz.id,
    pz.publisher_id,
    pz.zman_key,
    COALESCE(mr.canonical_hebrew_name, pz.hebrew_name) AS hebrew_name,
    COALESCE(mr.canonical_english_name, pz.english_name) AS english_name,
    pz.formula_dsl,
    pz.deleted_at,
    pz.deleted_by,
    tc.key AS time_category,
    pz.master_zman_id
FROM publisher_zmanim pz
LEFT JOIN master_zmanim_registry mr ON pz.master_zman_id = mr.id
LEFT JOIN time_categories tc ON pz.time_category_id = tc.id
WHERE pz.publisher_id = $1
  AND pz.deleted_at IS NOT NULL
ORDER BY pz.deleted_at DESC;

-- name: PermanentDeletePublisherZman :exec
DELETE FROM publisher_zmanim
WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NOT NULL;

-- ============================================
-- VERSION HISTORY QUERIES
-- ============================================

-- name: GetZmanVersionHistory :many
SELECT
    pzv.id,
    pzv.publisher_zman_id,
    pzv.version_number,
    pzv.formula_dsl,
    pzv.created_by,
    pzv.created_at
FROM publisher_zman_versions pzv
JOIN publisher_zmanim pz ON pz.id = pzv.publisher_zman_id
WHERE pz.publisher_id = $1 AND pz.zman_key = $2
ORDER BY pzv.version_number DESC
LIMIT 7;

-- name: GetZmanVersion :one
SELECT
    pzv.id,
    pzv.publisher_zman_id,
    pzv.version_number,
    pzv.formula_dsl,
    pzv.created_by,
    pzv.created_at
FROM publisher_zman_versions pzv
JOIN publisher_zmanim pz ON pz.id = pzv.publisher_zman_id
WHERE pz.publisher_id = $1 AND pz.zman_key = $2 AND pzv.version_number = $3;

-- name: CreateZmanVersion :one
INSERT INTO publisher_zman_versions (
    publisher_zman_id,
    version_number,
    formula_dsl,
    created_by
)
SELECT
    pz.id,
    COALESCE((SELECT MAX(version_number) FROM publisher_zman_versions WHERE publisher_zman_id = pz.id), 0) + 1,
    $3,
    $4
FROM publisher_zmanim pz
WHERE pz.publisher_id = $1 AND pz.zman_key = $2
RETURNING id, publisher_zman_id, version_number, formula_dsl, created_by, created_at;

-- name: UpdateZmanCurrentVersion :exec
UPDATE publisher_zmanim
SET current_version = $3, updated_at = NOW()
WHERE publisher_id = $1 AND zman_key = $2;

-- name: RollbackZmanToVersion :one
UPDATE publisher_zmanim pz
SET
    formula_dsl = pzv.formula_dsl,
    current_version = (SELECT COALESCE(MAX(version_number), 0) + 1 FROM publisher_zman_versions WHERE publisher_zman_id = pz.id),
    updated_at = NOW()
FROM publisher_zman_versions pzv
WHERE pz.publisher_id = $1
  AND pz.zman_key = $2
  AND pzv.publisher_zman_id = pz.id
  AND pzv.version_number = $3
RETURNING pz.id, pz.publisher_id, pz.zman_key, pz.formula_dsl, pz.current_version;

-- ============================================
-- ZMAN REGISTRY REQUESTS
-- ============================================

-- name: CreateZmanRegistryRequest :one
INSERT INTO zman_registry_requests (
    publisher_id,
    requested_key,
    requested_hebrew_name,
    requested_english_name,
    requested_formula_dsl,
    time_category_id,
    description,
    status_id
) VALUES (
    $1, $2, $3, $4, $5,
    (SELECT tc.id FROM time_categories tc WHERE tc.key = $6),
    $7,
    (SELECT rs.id FROM request_statuses rs WHERE rs.key = 'pending')
)
RETURNING id, publisher_id, requested_key, requested_hebrew_name, requested_english_name,
    requested_formula_dsl, time_category_id, description, status_id, created_at;

-- name: GetZmanRegistryRequests :many
SELECT
    zrr.id, zrr.publisher_id, zrr.requested_key, zrr.requested_hebrew_name, zrr.requested_english_name,
    zrr.requested_formula_dsl, tc.key as time_category, zrr.description, rs.key as status,
    zrr.reviewed_by, zrr.reviewed_at, zrr.reviewer_notes, zrr.created_at
FROM zman_registry_requests zrr
LEFT JOIN time_categories tc ON zrr.time_category_id = tc.id
LEFT JOIN request_statuses rs ON zrr.status_id = rs.id
WHERE rs.key = COALESCE(sqlc.narg('status'), rs.key)
ORDER BY zrr.created_at DESC;

-- name: GetZmanRegistryRequestByID :one
SELECT
    zrr.id, zrr.publisher_id, zrr.requested_key, zrr.requested_hebrew_name, zrr.requested_english_name,
    zrr.requested_formula_dsl, tc.key as time_category, zrr.description, rs.key as status,
    zrr.reviewed_by, zrr.reviewed_at, zrr.reviewer_notes, zrr.created_at
FROM zman_registry_requests zrr
LEFT JOIN time_categories tc ON zrr.time_category_id = tc.id
LEFT JOIN request_statuses rs ON zrr.status_id = rs.id
WHERE zrr.id = $1;

-- name: UpdateZmanRegistryRequestStatus :one
UPDATE zman_registry_requests
SET
    status_id = (SELECT rs.id FROM request_statuses rs WHERE rs.key = $2),
    reviewed_by = $3,
    reviewed_at = NOW(),
    reviewer_notes = $4
WHERE zman_registry_requests.id = $1
RETURNING id, publisher_id, requested_key, requested_hebrew_name, requested_english_name,
    requested_formula_dsl, time_category_id, description, status_id,
    reviewed_by, reviewed_at, reviewer_notes, created_at;

-- name: AddMasterZmanFromRequest :one
INSERT INTO master_zmanim_registry (
    zman_key,
    canonical_hebrew_name,
    canonical_english_name,
    time_category_id,
    default_formula_dsl,
    is_core,
    description
)
SELECT
    zrr.requested_key,
    zrr.requested_hebrew_name,
    zrr.requested_english_name,
    zrr.time_category_id,
    zrr.requested_formula_dsl,
    false,
    'Added from publisher request'
FROM zman_registry_requests zrr
WHERE zrr.id = $1
RETURNING id, zman_key, canonical_hebrew_name, canonical_english_name, time_category_id,
    default_formula_dsl, is_core, created_at, updated_at;

-- ============================================
-- ASTRONOMICAL PRIMITIVES QUERIES
-- ============================================

-- name: GetAllAstronomicalPrimitives :many
SELECT
    ap.id, ap.variable_name, ap.display_name, ap.description, ap.formula_dsl,
    pc.key as category, ct.key as calculation_type, ap.solar_angle, ap.is_dawn, et.key as edge_type,
    ap.sort_order, ap.created_at, ap.updated_at
FROM astronomical_primitives ap
LEFT JOIN primitive_categories pc ON ap.category_id = pc.id
LEFT JOIN calculation_types ct ON ap.calculation_type_id = ct.id
LEFT JOIN edge_types et ON ap.edge_type_id = et.id
ORDER BY ap.sort_order, ap.variable_name;

-- name: GetAstronomicalPrimitivesByCategory :many
SELECT
    ap.id, ap.variable_name, ap.display_name, ap.description, ap.formula_dsl,
    pc.key as category, ct.key as calculation_type, ap.solar_angle, ap.is_dawn, et.key as edge_type,
    ap.sort_order, ap.created_at, ap.updated_at
FROM astronomical_primitives ap
LEFT JOIN primitive_categories pc ON ap.category_id = pc.id
LEFT JOIN calculation_types ct ON ap.calculation_type_id = ct.id
LEFT JOIN edge_types et ON ap.edge_type_id = et.id
WHERE pc.key = $1
ORDER BY ap.sort_order, ap.variable_name;

-- name: GetAstronomicalPrimitiveByName :one
SELECT
    ap.id, ap.variable_name, ap.display_name, ap.description, ap.formula_dsl,
    pc.key as category, ct.key as calculation_type, ap.solar_angle, ap.is_dawn, et.key as edge_type,
    ap.sort_order, ap.created_at, ap.updated_at
FROM astronomical_primitives ap
LEFT JOIN primitive_categories pc ON ap.category_id = pc.id
LEFT JOIN calculation_types ct ON ap.calculation_type_id = ct.id
LEFT JOIN edge_types et ON ap.edge_type_id = et.id
WHERE ap.variable_name = $1;

-- name: GetAstronomicalPrimitivesGrouped :many
-- Returns primitives with category for grouping in UI
SELECT
    ap.id, ap.variable_name, ap.display_name, ap.description, ap.formula_dsl,
    pc.key as category, ct.key as calculation_type, ap.solar_angle, ap.is_dawn, et.key as edge_type,
    ap.sort_order, ap.created_at, ap.updated_at
FROM astronomical_primitives ap
LEFT JOIN primitive_categories pc ON ap.category_id = pc.id
LEFT JOIN calculation_types ct ON ap.calculation_type_id = ct.id
LEFT JOIN edge_types et ON ap.edge_type_id = et.id
ORDER BY
    CASE pc.key
        WHEN 'horizon' THEN 1
        WHEN 'civil_twilight' THEN 2
        WHEN 'nautical_twilight' THEN 3
        WHEN 'astronomical_twilight' THEN 4
        WHEN 'solar_position' THEN 5
        ELSE 6
    END,
    ap.sort_order,
    ap.variable_name;

-- ============================================
-- ADDITIONAL MASTER REGISTRY QUERIES
-- ============================================

-- name: GetMasterZmanimByDayTypes :many
-- Get distinct master zmanim filtered by multiple day types
SELECT DISTINCT mr.id, mr.zman_key, mr.canonical_hebrew_name, mr.canonical_english_name,
    mr.transliteration, mr.description, mr.halachic_notes, mr.halachic_source,
    tc.key as time_category, mr.default_formula_dsl, mr.is_core,
    mr.created_at, mr.updated_at
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
JOIN master_zman_day_types mzdt ON mr.id = mzdt.master_zman_id
JOIN day_types dt ON dt.id = mzdt.day_type_id
WHERE dt.key = ANY($1::text[])
ORDER BY tc.sort_order, mr.canonical_hebrew_name;

-- name: GetEventZmanim :many
-- Get all event zmanim with their behavior tags (zmanim with behavior tag type)
SELECT mz.id, mz.zman_key, mz.canonical_hebrew_name, mz.canonical_english_name,
    mz.transliteration, mz.description, mz.halachic_notes, mz.halachic_source,
    tc.key as time_category, mz.default_formula_dsl, mz.is_core,
    mz.created_at, mz.updated_at,
    COALESCE(
        (SELECT json_agg(json_build_object(
            'id', t.id,
            'name', t.tag_key,
            'display_name_hebrew', t.display_name_hebrew,
            'display_name_english', t.display_name_english,
            'tag_type', tt.key
        ) ORDER BY t.sort_order)
        FROM master_zman_tags mt
        JOIN zman_tags t ON mt.tag_id = t.id
        JOIN tag_types tt ON t.tag_type_id = tt.id
        WHERE mt.master_zman_id = mz.id),
        '[]'::json
    ) AS tags
FROM master_zmanim_registry mz
LEFT JOIN time_categories tc ON mz.time_category_id = tc.id
WHERE EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    JOIN zman_tags t ON mzt.tag_id = t.id
    JOIN tag_types tt ON t.tag_type_id = tt.id
    WHERE mzt.master_zman_id = mz.id
    AND tt.key = 'behavior'
)
AND COALESCE(mz.is_hidden, false) = false
ORDER BY tc.sort_order, mz.canonical_hebrew_name;

-- name: ValidateMasterZmanKeyExists :one
-- Check if a zman key exists in the master registry
SELECT EXISTS(SELECT 1 FROM master_zmanim_registry WHERE zman_key = $1);

-- name: ValidatePendingRequestKeyExists :one
-- Check if a key has a pending request
SELECT EXISTS(
    SELECT 1 FROM zman_registry_requests zrr
    JOIN request_statuses rs ON zrr.status_id = rs.id
    WHERE zrr.requested_key = $1 AND rs.key = 'pending'
);

-- ============================================
-- TAG QUERIES (ADDITIONAL)
-- ============================================

-- name: GetAllTagsOrdered :many
-- Get all tags with custom sorting by tag type
SELECT zt.id, zt.tag_key, zt.name, zt.display_name_hebrew, zt.display_name_english,
    tt.key as tag_type, zt.description, zt.color, zt.sort_order, zt.created_at
FROM zman_tags zt
LEFT JOIN tag_types tt ON zt.tag_type_id = tt.id
ORDER BY
    CASE tt.key
        WHEN 'behavior' THEN 1
        WHEN 'event' THEN 2
        WHEN 'jewish_day' THEN 3
        WHEN 'timing' THEN 4
        WHEN 'shita' THEN 5
        WHEN 'calculation' THEN 6
        WHEN 'category' THEN 7
        ELSE 8
    END,
    zt.sort_order, zt.name;

-- ============================================
-- DAY TYPE QUERIES
-- ============================================

-- name: GetAllDayTypes :many
SELECT id, key, display_name_hebrew, display_name_english,
    description, parent_id, sort_order
FROM day_types
ORDER BY sort_order, key;

-- name: GetDayTypesByParent :many
SELECT id, key, display_name_hebrew, display_name_english,
    description, parent_id, sort_order
FROM day_types
WHERE parent_id = $1
ORDER BY sort_order, key;

-- name: GetZmanDayTypes :many
-- Get applicable day types for a specific zman by zman_key
SELECT dt.id, dt.key, dt.display_name_hebrew, dt.display_name_english,
    dt.description, dt.parent_id, dt.sort_order
FROM day_types dt
JOIN master_zman_day_types mzdt ON dt.id = mzdt.day_type_id
JOIN master_zmanim_registry mr ON mr.id = mzdt.master_zman_id
WHERE mr.zman_key = $1
ORDER BY dt.sort_order;

-- ============================================
-- SOFT DELETE QUERIES (ADDITIONAL)
-- ============================================

-- name: SoftDeleteZman :exec
UPDATE publisher_zmanim
SET deleted_at = NOW(), deleted_by = $3, updated_at = NOW()
WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NULL;

-- name: RestoreZman :one
UPDATE publisher_zmanim
SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW()
WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NOT NULL
RETURNING id, publisher_id, zman_key, hebrew_name, english_name,
    formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_custom, time_category_id,
    dependencies, created_at, updated_at, master_zman_id, current_version;

-- name: PermanentDeleteZman :exec
DELETE FROM publisher_zmanim
WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NOT NULL;

-- ============================================
-- ADMIN QUERIES
-- ============================================

-- name: AdminGetAllMasterZmanim :many
-- Get all master zmanim for admin with optional include_hidden filter
SELECT mr.id, mr.zman_key, mr.canonical_hebrew_name, mr.canonical_english_name,
    mr.transliteration, mr.description, mr.halachic_notes, mr.halachic_source,
    tc.key as time_category, mr.default_formula_dsl, mr.is_core,
    COALESCE(mr.is_hidden, false) as is_hidden,
    mr.created_at, mr.updated_at
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
WHERE ($1 = true OR COALESCE(mr.is_hidden, false) = false)
ORDER BY tc.sort_order, mr.canonical_hebrew_name;

-- name: AdminGetMasterZmanimByCategory :many
-- Get master zmanim by category for admin with optional include_hidden filter
SELECT mr.id, mr.zman_key, mr.canonical_hebrew_name, mr.canonical_english_name,
    mr.transliteration, mr.description, mr.halachic_notes, mr.halachic_source,
    tc.key as time_category, mr.default_formula_dsl, mr.is_core,
    COALESCE(mr.is_hidden, false) as is_hidden,
    mr.created_at, mr.updated_at
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
WHERE tc.key = $1 AND ($2 = true OR COALESCE(mr.is_hidden, false) = false)
ORDER BY mr.canonical_hebrew_name;

-- name: AdminGetMasterZmanByID :one
SELECT mr.id, mr.zman_key, mr.canonical_hebrew_name, mr.canonical_english_name,
    mr.transliteration, mr.description, mr.halachic_notes, mr.halachic_source,
    tc.key as time_category, mr.default_formula_dsl, mr.is_core,
    COALESCE(mr.is_hidden, false) as is_hidden,
    mr.created_at, mr.updated_at
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
WHERE mr.id = $1;

-- name: AdminCreateMasterZman :one
INSERT INTO master_zmanim_registry (
    zman_key, canonical_hebrew_name, canonical_english_name,
    transliteration, description, halachic_notes, halachic_source,
    time_category_id, default_formula_dsl, is_core,
    is_hidden
) VALUES (
    $1, $2, $3, $4, $5, $6, $7,
    (SELECT id FROM time_categories WHERE key = $8),
    $9, $10, $11
)
RETURNING id, zman_key, canonical_hebrew_name, canonical_english_name,
    transliteration, description, halachic_notes, halachic_source,
    time_category_id, default_formula_dsl, is_core,
    COALESCE(is_hidden, false), created_at, updated_at;

-- name: AdminUpdateMasterZman :one
UPDATE master_zmanim_registry mr
SET
    canonical_hebrew_name = COALESCE(sqlc.narg('canonical_hebrew_name'), mr.canonical_hebrew_name),
    canonical_english_name = COALESCE(sqlc.narg('canonical_english_name'), mr.canonical_english_name),
    transliteration = COALESCE(sqlc.narg('transliteration'), mr.transliteration),
    description = COALESCE(sqlc.narg('description'), mr.description),
    halachic_notes = COALESCE(sqlc.narg('halachic_notes'), mr.halachic_notes),
    halachic_source = COALESCE(sqlc.narg('halachic_source'), mr.halachic_source),
    time_category_id = COALESCE((SELECT tc.id FROM time_categories tc WHERE tc.key = sqlc.narg('time_category')), mr.time_category_id),
    default_formula_dsl = COALESCE(sqlc.narg('default_formula_dsl'), mr.default_formula_dsl),
    is_core = COALESCE(sqlc.narg('is_core'), mr.is_core),
    is_hidden = COALESCE(sqlc.narg('is_hidden'), mr.is_hidden),
    updated_at = NOW()
WHERE mr.id = $1
RETURNING mr.id, mr.zman_key, mr.canonical_hebrew_name, mr.canonical_english_name,
    mr.transliteration, mr.description, mr.halachic_notes, mr.halachic_source,
    mr.time_category_id, mr.default_formula_dsl, mr.is_core,
    COALESCE(mr.is_hidden, false), mr.created_at, mr.updated_at;

-- name: AdminDeleteMasterZman :exec
DELETE FROM master_zmanim_registry WHERE id = $1;

-- name: CheckMasterZmanInUse :one
SELECT EXISTS(SELECT 1 FROM publisher_zmanim WHERE master_zman_id = $1 AND deleted_at IS NULL);

-- name: AdminToggleZmanVisibility :one
UPDATE master_zmanim_registry
SET is_hidden = NOT COALESCE(is_hidden, false), updated_at = NOW()
WHERE id = $1
RETURNING id, is_hidden;

-- ============================================
-- TAG MANAGEMENT QUERIES
-- ============================================

-- name: DeleteMasterZmanTags :exec
DELETE FROM master_zman_tags WHERE master_zman_id = $1;

-- name: InsertMasterZmanTag :exec
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated)
VALUES ($1, $2, $3)
ON CONFLICT (master_zman_id, tag_id) DO UPDATE SET is_negated = EXCLUDED.is_negated;

-- name: GetMasterZmanTagsWithDetails :many
-- Get tags for multiple zmanim with full tag details
SELECT mzt.master_zman_id, t.id, t.tag_key, t.display_name_hebrew, t.display_name_english,
    tt.key as tag_type, t.description, t.color, t.sort_order, t.created_at
FROM master_zman_tags mzt
JOIN zman_tags t ON t.id = mzt.tag_id
LEFT JOIN tag_types tt ON t.tag_type_id = tt.id
WHERE mzt.master_zman_id = ANY($1::uuid[])
ORDER BY t.sort_order;

-- name: GetMasterZmanDayTypesWithDetails :many
-- Get day types for a specific master zman with full details
SELECT dt.id, dt.key, dt.display_name_hebrew, dt.display_name_english,
    dt.description, dt.parent_id, dt.sort_order
FROM day_types dt
JOIN master_zman_day_types mzdt ON dt.id = mzdt.day_type_id
WHERE mzdt.master_zman_id = $1
ORDER BY dt.sort_order;

-- ============================================
-- ADDITIONAL QUERIES FOR MASTER_REGISTRY HANDLER
-- ============================================

-- name: GetZmanApplicableDayTypesByKey :many
-- Get applicable day types for a specific zman by zman_key with is_default filter
SELECT dt.id, dt.key, dt.display_name_hebrew, dt.display_name_english,
    dt.description, dt.parent_id, dt.sort_order
FROM day_types dt
JOIN master_zman_day_types mzdt ON dt.id = mzdt.day_type_id
JOIN master_zmanim_registry mr ON mr.id = mzdt.master_zman_id
WHERE mr.zman_key = $1 AND mzdt.is_default = true
ORDER BY dt.sort_order;

-- name: GetVersionFormula :one
-- Get formula from a specific version for rollback
SELECT pzv.formula_dsl
FROM publisher_zman_versions pzv
JOIN publisher_zmanim pz ON pz.id = pzv.publisher_zman_id
WHERE pz.publisher_id = $1 AND pz.zman_key = $2 AND pzv.version_number = $3;

-- name: RollbackPublisherZmanFormula :one
-- Update zman formula during rollback
UPDATE publisher_zmanim
SET formula_dsl = $3, updated_at = NOW()
WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NULL
RETURNING id, publisher_id, zman_key, hebrew_name, english_name,
    transliteration, description, formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_custom, time_category_id,
    dependencies, created_at, updated_at, master_zman_id, current_version;

-- name: CreateVersionForRollback :exec
-- Create a new version entry for rollback
INSERT INTO publisher_zman_versions (publisher_zman_id, version_number, formula_dsl, created_by)
SELECT
    pz.id,
    COALESCE((SELECT MAX(version_number) FROM publisher_zman_versions WHERE publisher_zman_id = pz.id), 0) + 1,
    $3,
    $4
FROM publisher_zmanim pz
WHERE pz.publisher_id = $1 AND pz.zman_key = $2;

-- name: SoftDeletePublisherZmanExec :exec
-- Soft delete a publisher zman (exec version)
UPDATE publisher_zmanim
SET deleted_at = NOW(), deleted_by = $3, updated_at = NOW()
WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NULL;

-- name: GetMasterZmanDefaultFormula :one
-- Get default formula from master registry
SELECT default_formula_dsl FROM master_zmanim_registry WHERE id = $1;

-- name: CreatePublisherZmanFromMasterWithFormula :one
-- Create publisher zman from master registry with custom formula
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name,
    transliteration, description,
    formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_custom, time_category_id,
    dependencies, master_zman_id, current_version
)
SELECT
    gen_random_uuid(),
    $1,
    mr.zman_key,
    mr.canonical_hebrew_name,
    mr.canonical_english_name,
    mr.transliteration,
    mr.description,
    $3,
    NULL,
    NULL,
    true,
    true,
    false,
    false,
    mr.time_category_id,
    '{}',
    mr.id,
    1
FROM master_zmanim_registry mr
WHERE mr.id = $2
RETURNING id, publisher_id, zman_key, hebrew_name, english_name,
    transliteration, description, formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_custom, time_category_id,
    dependencies, created_at, updated_at, master_zman_id, current_version;

-- name: CreateInitialZmanVersion :exec
-- Create initial version for a new publisher zman
INSERT INTO publisher_zman_versions (publisher_zman_id, version_number, formula_dsl)
VALUES ($1, 1, $2);

-- name: CreateZmanRegistryRequestFull :one
-- Create a new zman registry request with all fields
INSERT INTO zman_registry_requests (
    publisher_id, requested_key, requested_hebrew_name, requested_english_name,
    transliteration, requested_formula_dsl, time_category_id, description,
    halachic_notes, halachic_source, auto_add_on_approval, status_id
) VALUES (
    $1, $2, $3, $4, $5, $6,
    (SELECT tc.id FROM time_categories tc WHERE tc.key = $7),
    $8, $9, $10, $11,
    (SELECT rs.id FROM request_statuses rs WHERE rs.key = 'pending')
)
RETURNING id, publisher_id, requested_key, requested_hebrew_name, requested_english_name,
    requested_formula_dsl, time_category_id, description, status_id, created_at;

-- name: InsertZmanRequestExistingTag :exec
-- Insert reference to existing tag for a request
INSERT INTO zman_request_tags (request_id, tag_id, is_new_tag_request)
VALUES ($1, $2, false);

-- name: InsertZmanRequestNewTag :exec
-- Insert new tag request for a zman request
INSERT INTO zman_request_tags (request_id, requested_tag_name, requested_tag_type, is_new_tag_request)
VALUES ($1, $2, $3, true);

-- name: AdminGetZmanRequestsByStatus :many
-- Get registry requests filtered by status
SELECT
    zrr.id, zrr.publisher_id, zrr.requested_key, zrr.requested_hebrew_name, zrr.requested_english_name,
    zrr.requested_formula_dsl, tc.key as time_category, zrr.description, rs.key as status,
    zrr.reviewed_by, zrr.reviewed_at, zrr.reviewer_notes, zrr.created_at,
    zrr.publisher_name, zrr.publisher_email, p.name as submitter_name
FROM zman_registry_requests zrr
LEFT JOIN publishers p ON zrr.publisher_id = p.id
LEFT JOIN time_categories tc ON zrr.time_category_id = tc.id
LEFT JOIN request_statuses rs ON zrr.status_id = rs.id
WHERE rs.key = $1
ORDER BY zrr.created_at DESC;

-- name: AdminGetAllZmanRequests :many
-- Get all registry requests without status filter
SELECT
    zrr.id, zrr.publisher_id, zrr.requested_key, zrr.requested_hebrew_name, zrr.requested_english_name,
    zrr.requested_formula_dsl, tc.key as time_category, zrr.description, rs.key as status,
    zrr.reviewed_by, zrr.reviewed_at, zrr.reviewer_notes, zrr.created_at,
    zrr.publisher_name, zrr.publisher_email, p.name as submitter_name
FROM zman_registry_requests zrr
LEFT JOIN publishers p ON zrr.publisher_id = p.id
LEFT JOIN time_categories tc ON zrr.time_category_id = tc.id
LEFT JOIN request_statuses rs ON zrr.status_id = rs.id
ORDER BY zrr.created_at DESC;

-- name: ReviewZmanRegistryRequest :one
-- Update request status during review
UPDATE zman_registry_requests
SET status_id = (SELECT rs.id FROM request_statuses rs WHERE rs.key = $2),
    reviewed_by = $3,
    reviewed_at = NOW(),
    reviewer_notes = $4
WHERE zman_registry_requests.id = $1
RETURNING id, publisher_id, requested_key, requested_hebrew_name, requested_english_name,
    requested_formula_dsl, time_category_id, description, status_id,
    reviewed_by, reviewed_at, reviewer_notes, created_at;

-- name: AutoAddApprovedZman :exec
-- Auto-add approved zman to publisher's collection
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name,
    transliteration, description,
    formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_custom, time_category_id,
    dependencies, current_version
)
VALUES (
    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
    NULL, NULL, true, true, false, true,
    (SELECT id FROM time_categories WHERE key = $8),
    '{}', 1
)
ON CONFLICT (publisher_id, zman_key) DO NOTHING;

-- name: GetMasterZmanTagsForDetail :many
-- Get tags for master zman detail view (different order than GetTagsForMasterZman)
SELECT t.id, t.tag_key as name, t.display_name_hebrew, t.display_name_english,
    tt.key as tag_type, t.description, t.color, t.sort_order, t.created_at
FROM zman_tags t
LEFT JOIN tag_types tt ON t.tag_type_id = tt.id
JOIN master_zman_tags mzt ON t.id = mzt.tag_id
WHERE mzt.master_zman_id = $1
ORDER BY tt.sort_order, t.sort_order;

-- name: GetMasterZmanDayTypesForDetail :many
-- Get day types for master zman with is_default filter
SELECT dt.id, dt.key as name, dt.display_name_hebrew, dt.display_name_english,
    dt.description, dt.parent_id as parent_type, dt.sort_order
FROM day_types dt
JOIN master_zman_day_types mzdt ON dt.id = mzdt.day_type_id
WHERE mzdt.master_zman_id = $1 AND mzdt.is_default = true
ORDER BY dt.sort_order;

-- name: AdminCreateMasterZmanWithAudit :one
-- Create master zman with audit fields
INSERT INTO master_zmanim_registry (
    zman_key, canonical_hebrew_name, canonical_english_name,
    transliteration, description, halachic_notes, halachic_source,
    time_category_id, default_formula_dsl, is_core,
    is_hidden
) VALUES (
    $1, $2, $3, $4, $5, $6, $7,
    (SELECT tc.id FROM time_categories tc WHERE tc.key = $8),
    $9, $10, $11
)
RETURNING id, zman_key, canonical_hebrew_name, canonical_english_name,
    transliteration, description, halachic_notes, halachic_source,
    time_category_id, default_formula_dsl, is_core,
    COALESCE(is_hidden, false) as is_hidden, created_at, updated_at;

-- name: AdminUpdateMasterZmanSimple :one
-- Update master zman with all fields (non-dynamic version)
UPDATE master_zmanim_registry mr
SET
    canonical_hebrew_name = COALESCE(sqlc.narg('canonical_hebrew_name'), mr.canonical_hebrew_name),
    canonical_english_name = COALESCE(sqlc.narg('canonical_english_name'), mr.canonical_english_name),
    transliteration = COALESCE(sqlc.narg('transliteration'), mr.transliteration),
    description = COALESCE(sqlc.narg('description'), mr.description),
    halachic_notes = COALESCE(sqlc.narg('halachic_notes'), mr.halachic_notes),
    halachic_source = COALESCE(sqlc.narg('halachic_source'), mr.halachic_source),
    time_category_id = COALESCE(
        (SELECT tc.id FROM time_categories tc WHERE tc.key = sqlc.narg('time_category')),
        mr.time_category_id
    ),
    default_formula_dsl = COALESCE(sqlc.narg('default_formula_dsl'), mr.default_formula_dsl),
    is_core = COALESCE(sqlc.narg('is_core'), mr.is_core),
    is_hidden = COALESCE(sqlc.narg('is_hidden'), mr.is_hidden),
    updated_at = NOW()
WHERE mr.id = $1
RETURNING mr.id, mr.zman_key, mr.canonical_hebrew_name, mr.canonical_english_name,
    mr.transliteration, mr.description, mr.halachic_notes, mr.halachic_source,
    mr.time_category_id, mr.default_formula_dsl, mr.is_core,
    COALESCE(mr.is_hidden, false) as is_hidden, mr.created_at, mr.updated_at;

-- name: AdminToggleZmanVisibilityWithAudit :one
-- Toggle zman visibility with audit
UPDATE master_zmanim_registry mr
SET is_hidden = NOT COALESCE(mr.is_hidden, false), updated_at = NOW()
WHERE mr.id = $1
RETURNING mr.id, mr.zman_key, mr.canonical_hebrew_name, mr.canonical_english_name,
    mr.transliteration, mr.description, mr.halachic_notes, mr.halachic_source,
    mr.time_category_id, mr.default_formula_dsl, mr.is_core,
    COALESCE(mr.is_hidden, false) as is_hidden, mr.created_at, mr.updated_at;

-- name: GetAllTagsAdmin :many
-- Get all zman tags for admin (simple version)
SELECT zt.id, zt.tag_key as name, zt.display_name_hebrew, zt.display_name_english,
    tt.key as tag_type, zt.description, zt.color, zt.sort_order, zt.created_at
FROM zman_tags zt
LEFT JOIN tag_types tt ON zt.tag_type_id = tt.id
ORDER BY tt.sort_order, zt.sort_order, zt.tag_key;

-- name: GetAllDayTypesAdmin :many
-- Get all day types for admin
SELECT id, key as name, display_name_hebrew, display_name_english,
    description, parent_id as parent_type, sort_order
FROM day_types
ORDER BY sort_order, name;
