-- File: zmanim_unified.sql
-- Purpose: Unified publisher zmanim queries - consolidates GetPublisherZmanim and FetchPublisherZmanim
-- Pattern: query-consolidation
-- Compliance: DRY - single query with optional parameters (sqlc.narg)
-- Replaces: GetPublisherZmanim, FetchPublisherZmanim (80% duplicate logic)
-- Used by: UnifiedZmanimService (future), publisher_zmanim.go handlers

-- name: GetUnifiedPublisherZmanim :many
-- Universal query for publisher zmanim - all filters are optional
-- Uses sqlc.narg() for nullable parameters to handle multiple use cases:
-- 1. Publisher dashboard (active only)
-- 2. Admin views (include deleted)
-- 3. Algorithm page (include disabled, unpublished)
-- 4. Diff/revert UI (include source info)
SELECT
    pz.id,
    pz.publisher_id,
    pz.zman_key,
    pz.hebrew_name,
    pz.english_name,
    pz.transliteration,
    pz.description,
    -- Resolve formula from linked source if applicable
    COALESCE(linked_pz.formula_dsl, pz.formula_dsl) AS formula_dsl,
    pz.ai_explanation,
    pz.publisher_comment,
    pz.is_enabled,
    pz.is_visible,
    pz.is_published,
    pz.is_beta,
    pz.is_custom,
    pz.display_status,
    pz.dependencies,
    pz.rounding_mode,
    pz.created_at,
    pz.updated_at,
    pz.deleted_at,
    pz.master_zman_id,
    pz.linked_publisher_zman_id,
    -- Time category ID and display values
    pz.time_category_id,
    tc.key AS category,
    tc.display_name_hebrew AS category_display_hebrew,
    tc.display_name_english AS category_display_english,
    -- Time category key for ordering (from registry or current)
    COALESCE(mr_tc.key, tc.key, 'uncategorized') AS time_category,
    -- Category sort order for ordering
    COALESCE(mr_tc.sort_order, tc.sort_order, 99) AS category_sort_order,
    -- Check if this zman is an event zman (has event tags or special category tags)
    EXISTS (
        SELECT 1 FROM (
            -- Check master zman tags
            SELECT tt.key, zt.tag_key FROM master_zman_tags mzt
            JOIN zman_tags zt ON mzt.tag_id = zt.id
            JOIN tag_types tt ON zt.tag_type_id = tt.id
            WHERE mzt.master_zman_id = pz.master_zman_id
            UNION ALL
            -- Check publisher-specific tags
            SELECT tt.key, zt.tag_key FROM publisher_zman_tags pzt
            JOIN zman_tags zt ON pzt.tag_id = zt.id
            JOIN tag_types tt ON zt.tag_type_id = tt.id
            WHERE pzt.publisher_zman_id = pz.id
        ) all_tags
        WHERE all_tags.key = 'event'
           OR all_tags.tag_key IN ('category_candle_lighting', 'category_havdalah', 'category_fast_start', 'category_fast_end')
    ) AS is_event_zman,
    -- Tags: Publisher tags take precedence over master tags (no duplicates)
    -- If publisher has customized tags, show ONLY publisher tags
    -- Otherwise, show master registry tags
    -- is_modified flag indicates if publisher tag differs from master (different negation or tag doesn't exist in master)
    -- Display name respects publisher's transliteration_style preference
    COALESCE(
        (SELECT json_agg(json_build_object(
            'id', sub.id,
            'tag_key', sub.tag_key,
            'name', sub.name,
            'display_name_hebrew', sub.display_name_hebrew,
            'display_name_english', CASE
                WHEN COALESCE(sqlc.narg('transliteration_style')::text, 'ashkenazi') = 'sephardi'
                THEN COALESCE(sub.display_name_english_sephardi, sub.display_name_english_ashkenazi)
                ELSE sub.display_name_english_ashkenazi
            END,
            'tag_type', sub.tag_type,
            'is_negated', sub.is_negated,
            'is_modified', sub.is_modified,
            'source_is_negated', sub.source_is_negated
        ) ORDER BY sub.sort_order)
        FROM (
            -- Publisher-specific tags (if any exist, these take full precedence)
            SELECT t.id, t.tag_key, t.name, t.display_name_hebrew,
                   t.display_name_english_ashkenazi, t.display_name_english_sephardi,
                   tt.key AS tag_type, t.sort_order, pzt.is_negated,
                   -- Check if this tag is modified from master registry
                   CASE
                       WHEN mzt.tag_id IS NULL THEN true  -- Tag added by publisher (not in master)
                       WHEN pzt.is_negated != mzt.is_negated THEN true  -- Negation changed
                       ELSE false
                   END AS is_modified,
                   mzt.is_negated AS source_is_negated
            FROM publisher_zman_tags pzt
            JOIN zman_tags t ON pzt.tag_id = t.id
            JOIN tag_types tt ON t.tag_type_id = tt.id
            LEFT JOIN master_zman_tags mzt ON mzt.master_zman_id = pz.master_zman_id
                                            AND mzt.tag_id = pzt.tag_id
            WHERE pzt.publisher_zman_id = pz.id
            UNION ALL
            -- Master tags (only if NO publisher tags exist for this zman)
            SELECT t.id, t.tag_key, t.name, t.display_name_hebrew,
                   t.display_name_english_ashkenazi, t.display_name_english_sephardi,
                   tt.key AS tag_type, t.sort_order, mzt.is_negated,
                   false AS is_modified,  -- Not modified since using master tags
                   mzt.is_negated AS source_is_negated
            FROM master_zman_tags mzt
            JOIN zman_tags t ON mzt.tag_id = t.id
            JOIN tag_types tt ON t.tag_type_id = tt.id
            WHERE mzt.master_zman_id = pz.master_zman_id
              AND NOT EXISTS (SELECT 1 FROM publisher_zman_tags WHERE publisher_zman_id = pz.id)
        ) sub),
        '[]'::json
    ) AS tags,
    -- Linked source info
    CASE WHEN pz.linked_publisher_zman_id IS NOT NULL THEN true ELSE false END AS is_linked,
    linked_pub.name AS linked_source_publisher_name,
    CASE WHEN pz.linked_publisher_zman_id IS NOT NULL AND linked_pz.deleted_at IS NOT NULL
         THEN true ELSE false END AS linked_source_is_deleted,
    -- Source/original values from registry or linked publisher (for diff/revert UI)
    -- Only include when explicitly requested (avoid unnecessary data in normal queries)
    CASE WHEN COALESCE(sqlc.narg('include_source')::boolean, false) = true THEN
        COALESCE(mr.canonical_hebrew_name, linked_pz.hebrew_name, '')
    ELSE '' END AS source_hebrew_name,
    CASE WHEN COALESCE(sqlc.narg('include_source')::boolean, false) = true THEN
        COALESCE(mr.canonical_english_name, linked_pz.english_name, '')
    ELSE '' END AS source_english_name,
    CASE WHEN COALESCE(sqlc.narg('include_source')::boolean, false) = true THEN
        COALESCE(mr.transliteration, linked_pz.transliteration, '')
    ELSE '' END AS source_transliteration,
    CASE WHEN COALESCE(sqlc.narg('include_source')::boolean, false) = true THEN
        COALESCE(mr.description, linked_pz.description, '')
    ELSE '' END AS source_description,
    CASE WHEN COALESCE(sqlc.narg('include_source')::boolean, false) = true THEN
        COALESCE(mr.default_formula_dsl, linked_pz.formula_dsl, '')
    ELSE '' END AS source_formula_dsl
FROM publisher_zmanim pz
LEFT JOIN time_categories tc ON pz.time_category_id = tc.id
LEFT JOIN publisher_zmanim linked_pz ON pz.linked_publisher_zman_id = linked_pz.id
LEFT JOIN publishers linked_pub ON linked_pz.publisher_id = linked_pub.id
LEFT JOIN master_zmanim_registry mr ON pz.master_zman_id = mr.id
LEFT JOIN time_categories mr_tc ON mr.time_category_id = mr_tc.id
WHERE pz.publisher_id = $1
  -- Soft delete filter (default: exclude deleted)
  AND (COALESCE(sqlc.narg('include_deleted')::boolean, false) = true OR pz.deleted_at IS NULL)
  -- Status filters (all default to false = exclude)
  AND (COALESCE(sqlc.narg('include_disabled')::boolean, false) = true OR pz.is_enabled = true)
  AND (COALESCE(sqlc.narg('include_unpublished')::boolean, false) = true OR pz.is_published = true)
  -- Beta filter (default: true = include beta)
  AND (COALESCE(sqlc.narg('include_beta')::boolean, true) = true OR pz.is_beta = false)
ORDER BY
    COALESCE(mr_tc.sort_order, tc.sort_order, 99),
    pz.hebrew_name;

-- name: GetZmanTagsBatch :many
-- Fetch tags for multiple zmanim at once (avoids N+1 queries)
-- Used when tags are needed separately from main query (e.g., simplified queries)
-- Returns tags with is_modified flag to show which tags differ from master registry
SELECT
    pzt.publisher_zman_id,
    t.id,
    t.tag_key,
    t.name,
    t.display_name_hebrew,
    t.display_name_english_ashkenazi,
    tt.key AS tag_type,
    t.color,
    t.sort_order,
    pzt.is_negated,
    -- Check if modified from master
    CASE
        WHEN mzt.tag_id IS NULL THEN true  -- Tag added by publisher (not in master)
        WHEN pzt.is_negated != mzt.is_negated THEN true  -- Negation changed
        ELSE false
    END AS is_modified,
    mzt.is_negated AS source_is_negated
FROM publisher_zman_tags pzt
JOIN zman_tags t ON pzt.tag_id = t.id
JOIN tag_types tt ON t.tag_type_id = tt.id
LEFT JOIN publisher_zmanim pz ON pzt.publisher_zman_id = pz.id
LEFT JOIN master_zman_tags mzt ON mzt.master_zman_id = pz.master_zman_id AND mzt.tag_id = pzt.tag_id
WHERE pzt.publisher_zman_id = ANY($1::int[])
ORDER BY pzt.publisher_zman_id, t.sort_order;
