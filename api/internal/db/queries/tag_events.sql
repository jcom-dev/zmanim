-- Tag Events SQL Queries
-- SQLc will generate type-safe Go code from these queries

-- ============================================================================
-- Tag Event Mappings
-- ============================================================================

-- name: GetTagEventMappings :many
-- Get all HebCal event mappings for tag matching
-- Uses new schema where match data is stored directly in zman_tags
SELECT
    tag_key,
    hebcal_match_type,
    COALESCE(hebcal_match_string, hebcal_match_pattern, hebcal_match_category) AS match_value
FROM zman_tags
WHERE hebcal_match_type IS NOT NULL
ORDER BY
    CASE hebcal_match_type
        WHEN 'category' THEN 1
        WHEN 'exact' THEN 2
        WHEN 'group' THEN 3
    END,
    tag_key;

-- REMOVED: GetTagByHebcalBasename
-- The hebcal_basename column has been removed in the new schema
-- Use match_hebcal_event() function instead for HebCal event matching

-- REMOVED: GetTagsForHebCalEvent
-- This query used the old tag_event_mappings table
-- Use the match_hebcal_event() PostgreSQL function instead

-- REMOVED: GetTagsForHebrewDate
-- This query used the old tag_event_mappings table with Hebrew date matching
-- Hebrew date matching is now handled via HebCal API integration and match_hebcal_event()

-- ============================================================================
-- All Tags Queries (with tag_key - extends master_registry.sql queries)
-- ============================================================================

-- name: GetAllTagsWithKey :many
-- Get all tags ordered by type and sort order (includes tag_key and multilingual names)
-- User-facing query - excludes hidden tags
SELECT
    t.id,
    t.tag_key,
    t.display_name_hebrew,
    t.display_name_english_ashkenazi,
    t.display_name_english_sephardi,
    t.tag_type_id,
    tt.key AS tag_type,
    tt.display_name_hebrew AS tag_type_display_hebrew,
    tt.display_name_english AS tag_type_display_english,
    t.description,
    t.color
FROM zman_tags t
JOIN tag_types tt ON tt.id = t.tag_type_id
WHERE t.is_hidden = false
ORDER BY tt.sort_order, t.tag_key, t.display_name_english_ashkenazi;

-- name: GetJewishDayTags :many
-- Get all event tags that represent Jewish days/holidays (for calendar filtering)
-- Note: Jewish day tags are now part of 'event' type after tag consolidation
-- User-facing query - excludes hidden tags
SELECT
    t.id,
    t.tag_key,
    t.display_name_hebrew,
    t.display_name_english_ashkenazi,
    t.display_name_english_sephardi,
    t.tag_type_id,
    tt.key AS tag_type,
    tt.display_name_hebrew AS tag_type_display_hebrew,
    tt.display_name_english AS tag_type_display_english,
    t.description,
    t.color
FROM zman_tags t
JOIN tag_types tt ON tt.id = t.tag_type_id
WHERE tt.key = 'event' AND t.is_hidden = false
ORDER BY t.tag_key, t.display_name_english_ashkenazi;

-- name: GetTagByKey :one
-- Get a single tag by its key
SELECT
    t.id,
    t.tag_key,
    t.display_name_hebrew,
    t.display_name_english_ashkenazi,
    t.display_name_english_sephardi,
    t.tag_type_id,
    tt.key AS tag_type,
    tt.display_name_hebrew AS tag_type_display_hebrew,
    tt.display_name_english AS tag_type_display_english,
    t.description,
    t.color
FROM zman_tags t
JOIN tag_types tt ON tt.id = t.tag_type_id
WHERE t.tag_key = $1;

-- name: GetTagsByKeys :many
-- Get multiple tags by their keys
SELECT
    t.id,
    t.tag_key,
    t.display_name_hebrew,
    t.display_name_english_ashkenazi,
    t.display_name_english_sephardi,
    t.tag_type_id,
    tt.key AS tag_type,
    tt.display_name_hebrew AS tag_type_display_hebrew,
    tt.display_name_english AS tag_type_display_english,
    t.description,
    t.color
FROM zman_tags t
JOIN tag_types tt ON tt.id = t.tag_type_id
WHERE t.tag_key = ANY($1::text[])
ORDER BY t.tag_key, t.display_name_english_ashkenazi;

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

-- ============================================================================
-- Event Mapping Queries
-- ============================================================================

-- name: MatchHebcalEvent :many
-- Get the best matching tag for a HebCal event using the PostgreSQL function
-- This wraps the match_hebcal_event() function for use with SQLc
-- Returns tag details including display names for matched events
SELECT
    t.id,
    t.tag_key,
    t.display_name_hebrew,
    t.display_name_english_ashkenazi,
    t.display_name_english_sephardi,
    t.tag_type_id,
    tt.key AS tag_type,
    tt.display_name_hebrew AS tag_type_display_hebrew,
    tt.display_name_english AS tag_type_display_english,
    t.description,
    t.color,
    t.hebcal_match_type AS match_type
FROM match_hebcal_event($1, $2) m
JOIN zman_tags t ON t.id = m.tag_id
JOIN tag_types tt ON tt.id = t.tag_type_id;

