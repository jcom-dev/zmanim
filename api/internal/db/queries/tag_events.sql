-- Tag Events SQL Queries
-- SQLc will generate type-safe Go code from these queries

-- ============================================================================
-- Tag Event Mappings
-- ============================================================================

-- name: GetTagEventMappings :many
-- Get all HebCal event mappings for tag matching
SELECT
    t.tag_key,
    t.hebcal_basename,
    m.hebcal_event_pattern AS pattern,
    m.priority
FROM tag_event_mappings m
JOIN zman_tags t ON t.id = m.tag_id
WHERE m.hebcal_event_pattern IS NOT NULL
ORDER BY m.priority DESC;

-- name: GetTagByHebcalBasename :one
-- Direct lookup by Hebcal basename (e.g., "Shavuot" -> shavuos tag)
SELECT
    t.id,
    t.tag_key,
    t.name,
    t.display_name_hebrew,
    t.display_name_english_ashkenazi,
    t.display_name_english_sephardi,
    t.hebcal_basename,
    t.tag_type_id,
    tt.key AS tag_type,
    t.description,
    t.sort_order
FROM zman_tags t
JOIN tag_types tt ON tt.id = t.tag_type_id
WHERE t.hebcal_basename = $1;

-- name: GetTagsForHebCalEvent :many
-- Get tags that match a specific HebCal event name using pattern matching
-- The pattern supports SQL LIKE wildcards (%)
SELECT DISTINCT
    t.id,
    t.tag_key,
    t.name,
    t.display_name_hebrew,
    t.display_name_english_ashkenazi,
    t.display_name_english_sephardi,
    t.hebcal_basename,
    t.tag_type_id,
    tt.key AS tag_type,
    tt.display_name_hebrew AS tag_type_display_hebrew,
    tt.display_name_english AS tag_type_display_english,
    t.description,
    t.sort_order,
    m.priority
FROM zman_tags t
JOIN tag_types tt ON tt.id = t.tag_type_id
JOIN tag_event_mappings m ON m.tag_id = t.id
WHERE m.hebcal_event_pattern IS NOT NULL
  AND (
    $1 LIKE m.hebcal_event_pattern OR
    m.hebcal_event_pattern LIKE $1 OR
    -- Handle wildcards: convert % to pattern matching
    $1 LIKE REPLACE(m.hebcal_event_pattern, '%', '')::text || '%' OR
    $1 LIKE '%' || REPLACE(m.hebcal_event_pattern, '%', '')::text
  )
ORDER BY m.priority DESC, t.sort_order;

-- name: GetTagsForHebrewDate :many
-- Get tags that match a specific Hebrew date (month and day)
SELECT DISTINCT
    t.id,
    t.tag_key,
    t.name,
    t.display_name_hebrew,
    t.display_name_english_ashkenazi,
    t.display_name_english_sephardi,
    t.hebcal_basename,
    t.tag_type_id,
    tt.key AS tag_type,
    tt.display_name_hebrew AS tag_type_display_hebrew,
    tt.display_name_english AS tag_type_display_english,
    t.description,
    t.sort_order,
    m.priority
FROM zman_tags t
JOIN tag_types tt ON tt.id = t.tag_type_id
JOIN tag_event_mappings m ON m.tag_id = t.id
WHERE m.hebrew_month = $1
  AND $2 BETWEEN m.hebrew_day_start AND COALESCE(m.hebrew_day_end, m.hebrew_day_start)
ORDER BY m.priority DESC, t.sort_order;

-- ============================================================================
-- All Tags Queries (with tag_key - extends master_registry.sql queries)
-- ============================================================================

-- name: GetAllTagsWithKey :many
-- Get all tags ordered by type and sort order (includes tag_key and multilingual names)
SELECT
    t.id,
    t.tag_key,
    t.name,
    t.display_name_hebrew,
    t.display_name_english_ashkenazi,
    t.display_name_english_sephardi,
    t.hebcal_basename,
    t.tag_type_id,
    tt.key AS tag_type,
    tt.display_name_hebrew AS tag_type_display_hebrew,
    tt.display_name_english AS tag_type_display_english,
    t.description,
    t.color,
    t.sort_order
FROM zman_tags t
JOIN tag_types tt ON tt.id = t.tag_type_id
ORDER BY tt.sort_order, t.sort_order, t.display_name_english_ashkenazi;

-- name: GetJewishDayTags :many
-- Get all event tags that represent Jewish days/holidays (for calendar filtering)
-- Note: Jewish day tags are now part of 'event' type after tag consolidation
SELECT
    t.id,
    t.tag_key,
    t.name,
    t.display_name_hebrew,
    t.display_name_english_ashkenazi,
    t.display_name_english_sephardi,
    t.hebcal_basename,
    t.tag_type_id,
    tt.key AS tag_type,
    tt.display_name_hebrew AS tag_type_display_hebrew,
    tt.display_name_english AS tag_type_display_english,
    t.description,
    t.color,
    t.sort_order
FROM zman_tags t
JOIN tag_types tt ON tt.id = t.tag_type_id
WHERE tt.key = 'event'
ORDER BY t.sort_order, t.display_name_english_ashkenazi;

-- name: GetTagByKey :one
-- Get a single tag by its key
SELECT
    t.id,
    t.tag_key,
    t.name,
    t.display_name_hebrew,
    t.display_name_english_ashkenazi,
    t.display_name_english_sephardi,
    t.hebcal_basename,
    t.tag_type_id,
    tt.key AS tag_type,
    tt.display_name_hebrew AS tag_type_display_hebrew,
    tt.display_name_english AS tag_type_display_english,
    t.description,
    t.color,
    t.sort_order
FROM zman_tags t
JOIN tag_types tt ON tt.id = t.tag_type_id
WHERE t.tag_key = $1;

-- name: GetTagsByKeys :many
-- Get multiple tags by their keys
SELECT
    t.id,
    t.tag_key,
    t.name,
    t.display_name_hebrew,
    t.display_name_english_ashkenazi,
    t.display_name_english_sephardi,
    t.hebcal_basename,
    t.tag_type_id,
    tt.key AS tag_type,
    tt.display_name_hebrew AS tag_type_display_hebrew,
    tt.display_name_english AS tag_type_display_english,
    t.description,
    t.color,
    t.sort_order
FROM zman_tags t
JOIN tag_types tt ON tt.id = t.tag_type_id
WHERE t.tag_key = ANY($1::text[])
ORDER BY t.sort_order, t.display_name_english_ashkenazi;

-- ============================================================================
-- Tag Types Metadata
-- ============================================================================

-- Removed: Duplicate of GetTagTypes in lookups.sql

-- ============================================================================
-- Publisher Zmanim by Active Tags
-- ============================================================================

-- name: GetZmanimByActiveTags :many
-- Get publisher zmanim that have any of the specified tags (for calendar day filtering)
SELECT DISTINCT
    pz.id,
    pz.publisher_id,
    pz.zman_key,
    pz.hebrew_name,
    pz.english_name,
    pz.formula_dsl,
    pz.is_enabled,
    pz.is_published,
    pz.time_category_id,
    tc.key AS category,
    tc.display_name_hebrew AS category_display_hebrew,
    tc.display_name_english AS category_display_english
FROM publisher_zmanim pz
JOIN time_categories tc ON tc.id = pz.time_category_id
JOIN publisher_zman_tags pzt ON pzt.publisher_zman_id = pz.id
JOIN zman_tags t ON t.id = pzt.tag_id
WHERE pz.publisher_id = $1
  AND t.tag_key = ANY($2::text[])
  AND pz.deleted_at IS NULL
  AND pz.is_enabled = true
ORDER BY pz.hebrew_name;

-- name: GetMasterZmanimByTags :many
-- Get master registry zmanim that have any of the specified tags
SELECT DISTINCT
    mr.id,
    mr.zman_key,
    mr.canonical_hebrew_name,
    mr.canonical_english_name,
    mr.default_formula_dsl,
    mr.time_category_id,
    tc.key AS time_category,
    tc.display_name_hebrew AS time_category_display_hebrew,
    tc.display_name_english AS time_category_display_english,
    mr.is_core
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON tc.id = mr.time_category_id
JOIN master_zman_tags mzt ON mzt.master_zman_id = mr.id
JOIN zman_tags t ON t.id = mzt.tag_id
WHERE t.tag_key = ANY($1::text[])
  AND mr.is_hidden = false
ORDER BY mr.canonical_hebrew_name;

-- name: CountTagsByType :many
-- Get count of tags per type (for UI display)
SELECT
    t.tag_type_id,
    tt.key AS tag_type,
    tt.display_name_hebrew AS tag_type_display_hebrew,
    tt.display_name_english AS tag_type_display_english,
    COUNT(*) AS count
FROM zman_tags t
JOIN tag_types tt ON tt.id = t.tag_type_id
GROUP BY t.tag_type_id, tt.key, tt.display_name_hebrew, tt.display_name_english
ORDER BY tt.sort_order;
