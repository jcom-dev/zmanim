-- Zmanim SQL Queries
-- SQLc will generate type-safe Go code from these queries

-- Publisher Zmanim --

-- name: GetPublisherZmanim :many
-- Orders by time_category (chronological) then hebrew_name
SELECT
    pz.id, pz.publisher_id, pz.zman_key, pz.hebrew_name, pz.english_name,
    pz.transliteration, pz.description,
    -- Resolve formula from linked source if applicable
    COALESCE(linked_pz.formula_dsl, pz.formula_dsl) AS formula_dsl,
    pz.ai_explanation, pz.publisher_comment,
    pz.is_enabled, pz.is_visible, pz.is_published, pz.is_beta, pz.is_custom,
    pz.display_status, pz.show_in_preview,
    pz.dependencies, pz.rounding_mode, pz.created_at, pz.updated_at,
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
    -- Check if this zman is an event zman (has any tag with tag_type = 'event')
    EXISTS (
        SELECT 1 FROM (
            -- Check master zman tags
            SELECT tt.key FROM master_zman_tags mzt
            JOIN zman_tags zt ON mzt.tag_id = zt.id
            JOIN tag_types tt ON zt.tag_type_id = tt.id
            WHERE mzt.master_zman_id = pz.master_zman_id
            UNION ALL
            -- Check publisher-specific tags
            SELECT tt.key FROM publisher_zman_tags pzt
            JOIN zman_tags zt ON pzt.tag_id = zt.id
            JOIN tag_types tt ON zt.tag_type_id = tt.id
            WHERE pzt.publisher_zman_id = pz.id
        ) all_tags
        WHERE all_tags.key = 'event'
    ) AS is_event_zman,
    -- Tags: Publisher tags take precedence over master tags (no duplicates)
    -- If publisher has customized tags, show ONLY publisher tags
    -- Otherwise, show master registry tags
    -- is_modified flag indicates if publisher tag differs from master (different negation or tag doesn't exist in master)
    COALESCE(
        (SELECT json_agg(json_build_object(
            'id', sub.id,
            'tag_key', sub.tag_key,
            'display_name_hebrew', sub.display_name_hebrew,
            'display_name_english_ashkenazi', sub.display_name_english_ashkenazi,
            'display_name_english_sephardi', sub.display_name_english_sephardi,
            'tag_type', sub.tag_type,
            'is_negated', sub.is_negated,
            'is_modified', sub.is_modified,
            'source_is_negated', sub.source_is_negated
        ) ORDER BY sub.tag_key)
        FROM (
            -- Publisher-specific tags (if any exist, these take full precedence)
            SELECT t.id, t.tag_key, t.display_name_hebrew,
                   t.display_name_english_ashkenazi, t.display_name_english_sephardi,
                   tt.key AS tag_type, pzt.is_negated,
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
              AND t.is_hidden = false  -- Exclude hidden tags from UI display
            UNION ALL
            -- Master tags (only if NO publisher tags exist for this zman)
            SELECT t.id, t.tag_key, t.display_name_hebrew,
                   t.display_name_english_ashkenazi, t.display_name_english_sephardi,
                   tt.key AS tag_type, mzt.is_negated,
                   false AS is_modified,  -- Not modified since using master tags
                   mzt.is_negated AS source_is_negated
            FROM master_zman_tags mzt
            JOIN zman_tags t ON mzt.tag_id = t.id
            JOIN tag_types tt ON t.tag_type_id = tt.id
            WHERE mzt.master_zman_id = pz.master_zman_id
              AND NOT EXISTS (SELECT 1 FROM publisher_zman_tags WHERE publisher_zman_id = pz.id)
              AND t.is_hidden = false  -- Exclude hidden tags from UI display
        ) sub),
        '[]'::json
    ) AS tags,
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
  AND pz.deleted_at IS NULL
ORDER BY
    COALESCE(mr_tc.sort_order, tc.sort_order, 99),
    pz.hebrew_name;

-- name: GetPublisherZmanByKey :one
SELECT
    pz.id, pz.publisher_id, pz.zman_key, pz.hebrew_name, pz.english_name,
    pz.transliteration, pz.description,
    COALESCE(linked_pz.formula_dsl, pz.formula_dsl) AS formula_dsl,
    pz.ai_explanation, pz.publisher_comment,
    pz.is_enabled, pz.is_visible, pz.is_published, pz.is_beta, pz.is_custom,
    pz.display_status,
    pz.dependencies, pz.rounding_mode, pz.created_at, pz.updated_at,
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

-- name: CreatePublisherZman :one
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name,
    formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_beta, is_custom, time_category_id,
    dependencies, master_zman_id, linked_publisher_zman_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
)
RETURNING id, publisher_id, zman_key, hebrew_name, english_name,
    formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_beta, is_custom, time_category_id,
    dependencies, master_zman_id, linked_publisher_zman_id,
    created_at, updated_at;

-- name: UpdatePublisherZman :one
UPDATE publisher_zmanim
SET hebrew_name = COALESCE(sqlc.narg('hebrew_name'), hebrew_name),
    english_name = COALESCE(sqlc.narg('english_name'), english_name),
    transliteration = COALESCE(sqlc.narg('transliteration'), transliteration),
    description = COALESCE(sqlc.narg('description'), description),
    formula_dsl = COALESCE(sqlc.narg('formula_dsl'), formula_dsl),
    ai_explanation = COALESCE(sqlc.narg('ai_explanation'), ai_explanation),
    publisher_comment = COALESCE(sqlc.narg('publisher_comment'), publisher_comment),
    is_enabled = COALESCE(sqlc.narg('is_enabled'), is_enabled),
    is_visible = COALESCE(sqlc.narg('is_visible'), is_visible),
    is_published = COALESCE(sqlc.narg('is_published'), is_published),
    is_beta = COALESCE(sqlc.narg('is_beta'), is_beta),
    display_status = COALESCE(sqlc.narg('display_status')::display_status, display_status),
    certified_at = CASE
        WHEN sqlc.narg('is_beta')::boolean = false AND is_beta = true THEN NOW()
        ELSE certified_at
    END,
    time_category_id = COALESCE(sqlc.narg('time_category_id'), time_category_id),
    dependencies = COALESCE(sqlc.narg('dependencies'), dependencies),
    rounding_mode = COALESCE(sqlc.narg('rounding_mode'), rounding_mode),
    updated_at = NOW()
WHERE publisher_id = $1 AND zman_key = $2
RETURNING id, publisher_id, zman_key, hebrew_name, english_name,
    transliteration, description, formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_beta, is_custom, display_status, time_category_id,
    dependencies, rounding_mode, created_at, updated_at;

-- name: DeletePublisherZman :one
-- Hard delete for custom zmanim only
DELETE FROM publisher_zmanim
WHERE publisher_id = $1 AND zman_key = $2 AND is_custom = true
RETURNING id;

-- name: CountPublisherZmanim :one
SELECT COUNT(*) FROM publisher_zmanim WHERE publisher_id = $1;

-- Browse public zmanim --

-- name: BrowsePublicZmanim :many
SELECT
    z.id, z.publisher_id, z.zman_key, z.hebrew_name, z.english_name,
    z.formula_dsl,
    z.time_category_id,
    tc.key AS category,
    tc.display_name_hebrew AS category_display_hebrew,
    tc.display_name_english AS category_display_english,
    p.name as publisher_name,
    COUNT(*) OVER (PARTITION BY z.zman_key) as usage_count
FROM publisher_zmanim z
JOIN publishers p ON p.id = z.publisher_id
LEFT JOIN time_categories tc ON z.time_category_id = tc.id
WHERE z.is_visible = true
  AND z.is_published = true
  AND ($1::text IS NULL OR z.hebrew_name ILIKE '%' || $1 || '%' OR z.english_name ILIKE '%' || $1 || '%')
  AND ($2::integer IS NULL OR z.time_category_id = $2)
ORDER BY usage_count DESC, z.hebrew_name
LIMIT 50;

-- Bulk publish/unpublish zmanim --

-- name: PublishAllZmanim :exec
UPDATE publisher_zmanim
SET is_published = true, updated_at = NOW()
WHERE publisher_id = $1 AND is_enabled = true;

-- name: UnpublishAllZmanim :exec
UPDATE publisher_zmanim
SET is_published = false, updated_at = NOW()
WHERE publisher_id = $1;

-- name: PublishZmanimByKeys :exec
UPDATE publisher_zmanim
SET is_published = true, updated_at = NOW()
WHERE publisher_id = $1 AND zman_key = ANY($2::text[]);

-- name: UnpublishZmanimByKeys :exec
UPDATE publisher_zmanim
SET is_published = false, updated_at = NOW()
WHERE publisher_id = $1 AND zman_key = ANY($2::text[]);

-- Linked Zmanim Support --

-- name: GetVerifiedPublishersForLinking :many
-- Get verified publishers that current publisher can link to (excludes self)
SELECT
    p.id, p.name, p.logo_url,
    COUNT(pz.id) AS zmanim_count
FROM publishers p
JOIN publisher_zmanim pz ON pz.publisher_id = p.id
    AND pz.is_published = true
    AND pz.is_enabled = true
    AND pz.deleted_at IS NULL
WHERE p.is_verified = true
  AND p.status_id = (SELECT id FROM publisher_statuses WHERE key = 'active')
  AND p.id != $1  -- Exclude self
GROUP BY p.id, p.name, p.logo_url
HAVING COUNT(pz.id) > 0
ORDER BY p.name;

-- name: GetPublisherZmanimForLinking :many
-- Get published zmanim from a specific publisher for copying/linking
-- Orders by category chronologically then hebrew_name
SELECT
    pz.id, pz.publisher_id, pz.zman_key, pz.hebrew_name, pz.english_name,
    pz.formula_dsl,
    pz.time_category_id,
    tc.key AS category,
    tc.display_name_hebrew AS category_display_hebrew,
    tc.display_name_english AS category_display_english,
    p.name AS publisher_name
FROM publisher_zmanim pz
JOIN publishers p ON p.id = pz.publisher_id
LEFT JOIN time_categories tc ON pz.time_category_id = tc.id
WHERE pz.publisher_id = $1
  AND pz.is_published = true
  AND pz.is_enabled = true
  AND pz.deleted_at IS NULL
  AND ($2::integer IS NULL OR pz.zman_key NOT IN (
      SELECT zman_key FROM publisher_zmanim WHERE publisher_id = $2 AND deleted_at IS NULL
  ))
ORDER BY
    COALESCE(tc.sort_order, 99),
    pz.hebrew_name;

-- name: GetPublisherZmanByID :one
-- Get a specific zman by ID (for linking validation)
SELECT
    pz.id, pz.publisher_id, pz.zman_key, pz.hebrew_name, pz.english_name,
    pz.formula_dsl, pz.ai_explanation, pz.publisher_comment,
    pz.is_enabled, pz.is_visible, pz.is_published, pz.is_custom,
    pz.time_category_id,
    tc.key AS category,
    tc.display_name_hebrew AS category_display_hebrew,
    tc.display_name_english AS category_display_english,
    pz.dependencies, pz.master_zman_id, pz.linked_publisher_zman_id,
    pz.deleted_at, pz.created_at, pz.updated_at,
    p.name AS publisher_name,
    p.is_verified AS publisher_is_verified
FROM publisher_zmanim pz
JOIN publishers p ON p.id = pz.publisher_id
LEFT JOIN time_categories tc ON pz.time_category_id = tc.id
WHERE pz.id = $1;

-- ============================================================================
-- Publisher Zman Tags
-- ============================================================================

-- name: GetPublisherZmanTags :many
-- Get all tags for a specific publisher zman (including is_negated)
-- User-facing query - excludes hidden tags
SELECT
    t.id, t.tag_key, t.display_name_hebrew,
    t.display_name_english_ashkenazi, t.display_name_english_sephardi,
    t.tag_type_id,
    tt.key AS tag_type,
    tt.display_name_hebrew AS tag_type_display_hebrew,
    tt.display_name_english AS tag_type_display_english,
    t.description, pzt.is_negated
FROM publisher_zman_tags pzt
JOIN zman_tags t ON t.id = pzt.tag_id
LEFT JOIN tag_types tt ON t.tag_type_id = tt.id
WHERE pzt.publisher_zman_id = $1 AND t.is_hidden = false
ORDER BY tt.sort_order, t.tag_key, t.display_name_english_ashkenazi;

-- name: AddTagToPublisherZman :exec
-- Add a tag to a publisher zman (with optional is_negated)
INSERT INTO publisher_zman_tags (publisher_zman_id, tag_id, is_negated)
VALUES ($1, $2, $3)
ON CONFLICT (publisher_zman_id, tag_id) DO UPDATE SET is_negated = $3;

-- name: RemoveTagFromPublisherZman :exec
-- Remove a tag from a publisher zman
DELETE FROM publisher_zman_tags
WHERE publisher_zman_id = $1 AND tag_id = $2;

-- name: SetPublisherZmanTags :exec
-- Replace all tags for a publisher zman (delete existing, insert new)
-- First delete all existing tags for the zman
DELETE FROM publisher_zman_tags WHERE publisher_zman_id = $1;

-- name: BulkAddTagsToPublisherZman :copyfrom
-- Bulk insert tags for a publisher zman (with is_negated)
INSERT INTO publisher_zman_tags (publisher_zman_id, tag_id, is_negated) VALUES ($1, $2, $3);

-- name: GetPublishersUsingMasterZman :many
-- Get all publisher IDs that have a zman referencing this master registry entry
-- Used for cache invalidation when master zman formula changes
SELECT DISTINCT publisher_id
FROM publisher_zmanim
WHERE master_zman_id = $1
  AND deleted_at IS NULL;

-- ============================================================================
-- Queries for fetchPublisherZmanim (complex join with tags and source info)
-- ============================================================================

-- name: FetchPublisherZmanim :many
-- Get all zmanim for a publisher with full tag and source information
-- This replaces the raw SQL query in fetchPublisherZmanim function
-- @param transliteration_style: 'ashkenazi' (default) or 'sephardi' - controls tag display names
SELECT
    pz.id, pz.publisher_id, pz.zman_key, pz.hebrew_name, pz.english_name,
    pz.transliteration, pz.description,
    COALESCE(linked_pz.formula_dsl, pz.formula_dsl) AS formula_dsl,
    pz.ai_explanation, pz.publisher_comment,
    pz.is_enabled, pz.is_visible, pz.is_published, pz.is_beta, pz.is_custom,
    pz.display_status,
    pz.time_category_id,
    tc.key AS category,
    pz.dependencies, pz.rounding_mode, pz.created_at, pz.updated_at, pz.deleted_at,
    pz.master_zman_id, pz.linked_publisher_zman_id,
    -- Source/original values from registry or linked publisher (for diff/revert UI)
    COALESCE(mr.canonical_hebrew_name, linked_pz.hebrew_name, '') AS source_hebrew_name,
    COALESCE(mr.canonical_english_name, linked_pz.english_name, '') AS source_english_name,
    COALESCE(mr.transliteration, linked_pz.transliteration) AS source_transliteration,
    COALESCE(mr.description, linked_pz.description) AS source_description,
    COALESCE(mr.default_formula_dsl, linked_pz.formula_dsl, '') AS source_formula_dsl,
    -- Check if this zman is an event zman (has any tag with tag_type = 'event')
    EXISTS (
        SELECT 1 FROM (
            -- Check master zman tags
            SELECT tt.key FROM master_zman_tags mzt
            JOIN zman_tags zt ON mzt.tag_id = zt.id
            JOIN tag_types tt ON zt.tag_type_id = tt.id
            WHERE mzt.master_zman_id = pz.master_zman_id
            UNION ALL
            -- Check publisher-specific tags
            SELECT tt.key FROM publisher_zman_tags pzt
            JOIN zman_tags zt ON pzt.tag_id = zt.id
            JOIN tag_types tt ON zt.tag_type_id = tt.id
            WHERE pzt.publisher_zman_id = pz.id
        ) all_tags
        WHERE all_tags.key = 'event'
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
            'display_name_hebrew', sub.display_name_hebrew,
            'display_name_english_ashkenazi', sub.display_name_english_ashkenazi,
            'display_name_english_sephardi', sub.display_name_english_sephardi,
            'tag_type', sub.tag_type,
            'is_negated', sub.is_negated,
            'is_modified', sub.is_modified,
            'source_is_negated', sub.source_is_negated
        ) ORDER BY sub.tag_key)
        FROM (
            -- Publisher-specific tags (if any exist, these take full precedence)
            SELECT t.id, t.tag_key, t.display_name_hebrew,
                   t.display_name_english_ashkenazi, t.display_name_english_sephardi,
                   tt.key AS tag_type, pzt.is_negated,
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
              AND t.is_hidden = false  -- Exclude hidden tags from UI display
            UNION ALL
            -- Master tags (only if NO publisher tags exist for this zman)
            SELECT t.id, t.tag_key, t.display_name_hebrew,
                   t.display_name_english_ashkenazi, t.display_name_english_sephardi,
                   tt.key AS tag_type, mzt.is_negated,
                   false AS is_modified,  -- Not modified since using master tags
                   mzt.is_negated AS source_is_negated
            FROM master_zman_tags mzt
            JOIN zman_tags t ON mzt.tag_id = t.id
            JOIN tag_types tt ON t.tag_type_id = tt.id
            WHERE mzt.master_zman_id = pz.master_zman_id
              AND NOT EXISTS (SELECT 1 FROM publisher_zman_tags WHERE publisher_zman_id = pz.id)
              AND t.is_hidden = false  -- Exclude hidden tags from UI display
        ) sub),
        '[]'::json
    ) AS tags,
    CASE WHEN pz.linked_publisher_zman_id IS NOT NULL THEN true ELSE false END AS is_linked,
    linked_pub.name AS linked_source_publisher_name,
    CASE WHEN pz.linked_publisher_zman_id IS NOT NULL AND linked_pz.deleted_at IS NOT NULL
         THEN true ELSE false END AS linked_source_is_deleted,
    COALESCE(mr_tc.key, tc.key, 'uncategorized') AS time_category
FROM publisher_zmanim pz
LEFT JOIN publisher_zmanim linked_pz ON pz.linked_publisher_zman_id = linked_pz.id
LEFT JOIN publishers linked_pub ON linked_pz.publisher_id = linked_pub.id
LEFT JOIN master_zmanim_registry mr ON pz.master_zman_id = mr.id
LEFT JOIN time_categories tc ON pz.time_category_id = tc.id
LEFT JOIN time_categories mr_tc ON mr.time_category_id = mr_tc.id
WHERE pz.publisher_id = sqlc.arg('publisher_id')
  AND (sqlc.narg('include_deleted')::boolean = true OR pz.deleted_at IS NULL)
ORDER BY
    COALESCE(mr_tc.sort_order, tc.sort_order, 99),
    pz.hebrew_name;

-- ============================================================================
-- Queries for GetVerifiedPublishers
-- ============================================================================

-- name: GetVerifiedPublishers :many
-- Get verified publishers with zmanim count, excluding specified publisher
SELECT
    p.id, p.name, p.logo_url,
    COUNT(pz.id) AS zmanim_count
FROM publishers p
JOIN publisher_zmanim pz ON pz.publisher_id = p.id
    AND pz.is_published = true
    AND pz.is_enabled = true
    AND pz.deleted_at IS NULL
WHERE p.is_verified = true
  AND p.status_id = (SELECT id FROM publisher_statuses WHERE key = 'active')
  AND p.id != $1
GROUP BY p.id, p.name, p.logo_url
HAVING COUNT(pz.id) > 0
ORDER BY p.name;

-- ============================================================================
-- Queries for Publisher Zman Linking/Copying
-- ============================================================================

-- name: CheckPublisherVerified :one
-- Verify a publisher is active and verified
SELECT p.is_verified FROM publishers p WHERE p.id = $1 AND p.status_id = (SELECT ps.id FROM publisher_statuses ps WHERE ps.key = 'active');

-- name: GetSourceZmanForLinking :one
-- Get source zman for copying/linking with publisher verification
SELECT
    pz.id, pz.publisher_id, pz.zman_key, pz.hebrew_name, pz.english_name,
    pz.formula_dsl,
    tc.key AS category,
    pz.dependencies, pz.master_zman_id,
    p.is_verified
FROM publisher_zmanim pz
JOIN publishers p ON p.id = pz.publisher_id
LEFT JOIN time_categories tc ON pz.time_category_id = tc.id
WHERE pz.id = $1
  AND pz.is_published = true
  AND pz.is_enabled = true
  AND pz.deleted_at IS NULL;

-- name: CheckZmanKeyExists :one
-- Check if a zman_key already exists for a publisher
SELECT EXISTS(
    SELECT 1 FROM publisher_zmanim
    WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NULL
) AS exists;

-- name: CreateLinkedOrCopiedZman :one
-- Create a new zman from another publisher (linked or copied)
INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name,
    formula_dsl, is_enabled, is_visible, is_published, is_custom, time_category_id,
    dependencies, master_zman_id, linked_publisher_zman_id
) VALUES (
    $1, $2, $3, $4, $5, true, true, false, false, $6, $7, $8, $9
)
RETURNING id, created_at, updated_at;

-- ============================================================================
-- Helper Queries for Publisher Zman Operations
-- ============================================================================

-- name: GetPublisherZmanIDByKey :one
-- Get publisher zman ID by publisher ID and zman key
SELECT id FROM publisher_zmanim
WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NULL;

-- name: DeletePublisherZmanTags :exec
-- Delete all tags for a publisher zman
DELETE FROM publisher_zman_tags WHERE publisher_zman_id = $1;

-- name: InsertPublisherZmanTag :exec
-- Insert a tag for a publisher zman with is_negated
INSERT INTO publisher_zman_tags (publisher_zman_id, tag_id, is_negated)
VALUES ($1, $2, $3)
ON CONFLICT (publisher_zman_id, tag_id) DO UPDATE SET is_negated = $3;

-- ============================================================================
-- Queries for GetZmanimForCity handler
-- ============================================================================

-- name: GetLocalityDetailsForZmanim :one
-- Get locality details with country, region, and display hierarchy for zmanim calculation
-- display_hierarchy contains the full location chain (e.g., "Prestwich, Bury, England, United Kingdom")
-- Elevation defaults to 0 if NULL (sea level) - required for accurate zmanim
-- Region is resolved from geo_search_index.inherited_region_id (pre-computed during import)
-- Coordinates/elevation resolved with priority: admin > default (system-wide only, no publisher context)
SELECT l.name, co.name as country, co.code as country_code, r.name as region,
       l.timezone, rc.latitude, rc.longitude, COALESCE(rc.elevation_m, 0) as elevation,
       s.display_hierarchy
FROM geo_localities l
JOIN geo_countries co ON l.country_id = co.id
LEFT JOIN geo_locality_resolved_coords rc ON rc.locality_id = l.id
LEFT JOIN geo_search_index s ON s.entity_type = 'locality' AND s.entity_id = l.id
LEFT JOIN geo_regions r ON s.inherited_region_id = r.id
WHERE l.id = $1;

-- name: GetPublisherInfoForZmanim :one
-- Get publisher info (logo_data is the base64 embedded logo)
SELECT name, logo_data, is_certified FROM publishers WHERE id = $1;

-- name: GetPublisherAlgorithm :one
-- Get publisher's published algorithm configuration
SELECT configuration
FROM algorithms
WHERE publisher_id = $1 AND status = 'published'
LIMIT 1;

-- name: GetPublisherBetaZmanim :many
-- Get beta status for zmanim for a publisher
SELECT zman_key, is_beta
FROM publisher_zmanim
WHERE publisher_id = $1 AND deleted_at IS NULL AND is_beta = true;

-- name: GetPublisherZmanimSettings :many
-- Get per-zman settings (rounding_mode, is_beta) for all zmanim for a publisher
-- Used by public zmanim API to apply publisher settings when displaying times
SELECT zman_key, rounding_mode, is_beta
FROM publisher_zmanim
WHERE publisher_id = $1 AND deleted_at IS NULL;

-- name: GetAllMasterZmanimMetadata :many
-- Get metadata for all zmanim from master registry with time category key
SELECT
    mr.zman_key,
    COALESCE(tc.key, '') as time_category,
    COALESCE(mr.canonical_hebrew_name, '') as canonical_hebrew_name,
    COALESCE(mr.canonical_english_name, '') as canonical_english_name,
    COALESCE(mr.default_formula_dsl, '') as default_formula_dsl,
    mr.is_core,
    COALESCE(mr.halachic_source, '') as halachic_source
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id;

-- name: GetAllZmanimTags :many
-- Get all tags for all zmanim with tag type key, sort order, and negation status
-- Returns both Ashkenazi and Sephardi display names for Go code to select based on context
-- User-facing query - excludes hidden tags
SELECT
    mr.zman_key,
    t.id,
    t.tag_key,
    t.display_name_english_ashkenazi,
    t.display_name_english_sephardi,
    t.display_name_hebrew,
    tt.key AS tag_type,
    t.color,
    COALESCE(mzt.is_negated, false) AS is_negated,
    t.created_at
FROM master_zmanim_registry mr
JOIN master_zman_tags mzt ON mr.id = mzt.master_zman_id
JOIN zman_tags t ON mzt.tag_id = t.id
JOIN tag_types tt ON t.tag_type_id = tt.id
WHERE t.is_hidden = false
ORDER BY mr.zman_key, tt.key, t.tag_key;

-- name: GetMasterZmanimMetadataForKeys :many
-- Get metadata for specific zmanim from master registry (performance optimized)
SELECT
    mr.zman_key,
    COALESCE(tc.key, '') as time_category,
    COALESCE(mr.canonical_hebrew_name, '') as canonical_hebrew_name,
    COALESCE(mr.canonical_english_name, '') as canonical_english_name,
    COALESCE(mr.default_formula_dsl, '') as default_formula_dsl,
    mr.is_core,
    COALESCE(mr.halachic_source, '') as halachic_source
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
WHERE mr.zman_key = ANY($1::text[]);

-- name: GetZmanimTagsForKeys :many
-- Get tags for specific zmanim only (performance optimized)
SELECT
    mr.zman_key,
    t.id,
    t.tag_key,
    t.display_name_english_ashkenazi,
    t.display_name_english_sephardi,
    t.display_name_hebrew,
    tt.key AS tag_type,
    t.color,
    COALESCE(mzt.is_negated, false) AS is_negated,
    t.created_at
FROM master_zmanim_registry mr
JOIN master_zman_tags mzt ON mr.id = mzt.master_zman_id
JOIN zman_tags t ON mzt.tag_id = t.id
JOIN tag_types tt ON t.tag_type_id = tt.id
WHERE t.is_hidden = false
  AND mr.zman_key = ANY($1::text[])
ORDER BY mr.zman_key, tt.key, t.tag_key;

-- ============================================================================
-- Import/Export Queries
-- ============================================================================

-- name: UpdatePublisherZmanFromImport :exec
-- Update an existing publisher zman from import data
UPDATE publisher_zmanim SET
    hebrew_name = $2,
    english_name = $3,
    transliteration = $4,
    description = $5,
    formula_dsl = $6,
    ai_explanation = $7,
    publisher_comment = $8,
    is_enabled = $9,
    is_visible = $10,
    is_published = $11,
    is_beta = $12,
    updated_at = NOW()
WHERE id = $1;

-- name: InsertPublisherZmanFromImport :exec
-- Insert a new publisher zman from import data
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
    master_zman_id,
    time_category_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
    -- Get time_category_id from master_zmanim_registry if master_zman_id is provided
    COALESCE(
        (SELECT time_category_id FROM master_zmanim_registry WHERE id = $15),
        (SELECT id FROM time_categories WHERE key = 'other')
    )
);

-- ============================================================================
-- Calculation Cache Queries (for ZmanimService)
-- ============================================================================
-- DISABLED: calculation_cache table does not exist in current schema

-- name: GetCachedZmanim :one
-- Get cached zmanim calculation with publisher and algorithm info
-- Dynamic filter by publisher_id if provided
-- SELECT cc.results, cc.created_at, cc.algorithm_id,
--        p.id as publisher_id, p.name as publisher_name, p.description as publisher_description,
--        p.website, p.contact_email, p.logo_url,
--        p.is_verified, p.subscriber_count, p.created_at as publisher_created_at,
--        p.updated_at as publisher_updated_at,
--        a.id as algorithm_id_2, a.name as algorithm_name, a.description as algorithm_description,
--        a.version, a.configuration, a.is_active
-- FROM calculation_cache cc
-- INNER JOIN algorithms a ON cc.algorithm_id = a.id
-- INNER JOIN publishers p ON a.publisher_id = p.id
-- WHERE cc.date = $1
--   AND ABS(cc.latitude - $2) < 0.001
--   AND ABS(cc.longitude - $3) < 0.001
--   AND cc.expires_at > NOW()
--   AND ($4::text IS NULL OR p.id = $4)
-- ORDER BY cc.created_at DESC
-- LIMIT 1;

-- name: UpsertCalculationCache :exec
-- Insert or update calculation cache entry
-- INSERT INTO calculation_cache (date, latitude, longitude, algorithm_id, results, expires_at)
-- VALUES ($1, $2, $3, $4, $5, $6)
-- ON CONFLICT (date, latitude, longitude, algorithm_id)
-- DO UPDATE SET results = EXCLUDED.results, expires_at = EXCLUDED.expires_at, created_at = NOW();
