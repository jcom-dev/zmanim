-- File: zmanim_simplified.sql
-- Purpose: Simplified publisher zmanim queries (tags fetched separately)
-- Pattern: query-decomposition
-- Complexity: medium (5 concepts: publisher_zmanim, publishers, master_registry, lookup tables)
-- Used by: publisher_zmanim.go handlers
-- Note: This is a cleaner alternative to the complex GetPublisherZmanim query

-- name: GetPublisherZmanimSimplified :many
-- Simplified version without tag aggregation (tags fetched separately via GetZmanTags)
-- Still includes linked source resolution and master registry fallbacks
SELECT
    pz.id, pz.publisher_id, pz.zman_key, pz.hebrew_name, pz.english_name,
    pz.transliteration, pz.description,
    -- Resolve formula from linked source if applicable
    COALESCE(linked_pz.formula_dsl, pz.formula_dsl) AS formula_dsl,
    pz.ai_explanation, pz.publisher_comment,
    pz.is_enabled, pz.is_visible, pz.is_published, pz.is_beta, pz.is_custom,
    pz.display_status,
    pz.dependencies, pz.created_at, pz.updated_at, pz.deleted_at,
    pz.master_zman_id, pz.linked_publisher_zman_id,
    -- Time category ID and display values
    pz.time_category_id,
    tc.key AS category,
    tc.display_name_hebrew AS category_display_hebrew,
    tc.display_name_english AS category_display_english,
    -- Source/original values from registry or linked publisher (for diff/revert UI)
    COALESCE(mr.canonical_hebrew_name, linked_pz.hebrew_name, '') AS source_hebrew_name,
    COALESCE(mr.canonical_english_name, linked_pz.english_name, '') AS source_english_name,
    COALESCE(mr.transliteration, linked_pz.transliteration) AS source_transliteration,
    COALESCE(mr.description, linked_pz.description) AS source_description,
    COALESCE(mr.default_formula_dsl, linked_pz.formula_dsl, '') AS source_formula_dsl,
    -- Linked source info
    CASE WHEN pz.linked_publisher_zman_id IS NOT NULL THEN true ELSE false END AS is_linked,
    linked_pub.name AS linked_source_publisher_name,
    CASE WHEN pz.linked_publisher_zman_id IS NOT NULL AND linked_pz.deleted_at IS NOT NULL
         THEN true ELSE false END AS linked_source_is_deleted,
    -- Time category key for ordering (from registry or current)
    COALESCE(mr_tc.key, tc.key, 'uncategorized') AS time_category
FROM publisher_zmanim pz
LEFT JOIN time_categories tc ON pz.time_category_id = tc.id
LEFT JOIN publisher_zmanim linked_pz ON pz.linked_publisher_zman_id = linked_pz.id
LEFT JOIN publishers linked_pub ON linked_pz.publisher_id = linked_pub.id
LEFT JOIN master_zmanim_registry mr ON pz.master_zman_id = mr.id
LEFT JOIN time_categories mr_tc ON mr.time_category_id = mr_tc.id
WHERE pz.publisher_id = $1
  AND (sqlc.narg('include_deleted')::boolean = true OR pz.deleted_at IS NULL)
ORDER BY
    COALESCE(mr_tc.sort_order, tc.sort_order, 99),
    pz.hebrew_name;

-- name: GetPublisherZmanByKeySimplified :one
-- Simplified version of GetPublisherZmanByKey without tag aggregation
SELECT
    pz.id, pz.publisher_id, pz.zman_key, pz.hebrew_name, pz.english_name,
    pz.transliteration, pz.description,
    COALESCE(linked_pz.formula_dsl, pz.formula_dsl) AS formula_dsl,
    pz.ai_explanation, pz.publisher_comment,
    pz.is_enabled, pz.is_visible, pz.is_published, pz.is_beta, pz.is_custom,
    pz.display_status,
    pz.dependencies, pz.created_at, pz.updated_at,
    pz.master_zman_id, pz.linked_publisher_zman_id,
    -- Time category ID and display values
    pz.time_category_id,
    tc.key AS category,
    tc.display_name_hebrew AS category_display_hebrew,
    tc.display_name_english AS category_display_english,
    -- Source/original values from registry or linked publisher (for diff/revert UI)
    COALESCE(mr.canonical_hebrew_name, linked_pz.hebrew_name, '') AS source_hebrew_name,
    COALESCE(mr.canonical_english_name, linked_pz.english_name, '') AS source_english_name,
    COALESCE(mr.transliteration, linked_pz.transliteration) AS source_transliteration,
    COALESCE(mr.description, linked_pz.description) AS source_description,
    COALESCE(mr.default_formula_dsl, linked_pz.formula_dsl, '') AS source_formula_dsl,
    -- Linked source info
    CASE WHEN pz.linked_publisher_zman_id IS NOT NULL THEN true ELSE false END AS is_linked,
    linked_pub.name AS linked_source_publisher_name,
    -- Time category key for consistency
    COALESCE(mr_tc.key, tc.key, 'uncategorized') AS time_category
FROM publisher_zmanim pz
LEFT JOIN time_categories tc ON pz.time_category_id = tc.id
LEFT JOIN publisher_zmanim linked_pz ON pz.linked_publisher_zman_id = linked_pz.id
LEFT JOIN publishers linked_pub ON linked_pz.publisher_id = linked_pub.id
LEFT JOIN master_zmanim_registry mr ON pz.master_zman_id = mr.id
LEFT JOIN time_categories mr_tc ON mr.time_category_id = mr_tc.id
WHERE pz.publisher_id = $1 AND pz.zman_key = $2 AND pz.deleted_at IS NULL;
