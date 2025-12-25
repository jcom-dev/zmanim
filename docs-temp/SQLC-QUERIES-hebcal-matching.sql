-- SQLc Queries for HebCal 2-Column Matching System
-- Add these queries to: api/internal/db/queries/tag_events.sql
-- Reference: /home/daniel/repos/zmanim/DESIGN-hebcal-matching-system.md

-- ============================================================================
-- New Matching Queries (2-Step: Exact then Regex)
-- ============================================================================

-- name: GetTagByExactHebcalEvent :one
-- STEP 1: Try exact match first (fast path, ~90% of events)
-- Returns the highest priority exact match for a HebCal event name
SELECT
    t.id,
    t.tag_key,
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
    t.sort_order,
    m.priority,
    m.yom_tov_level,
    m.is_multi_day,
    m.duration_days_israel,
    m.duration_days_diaspora,
    m.fast_start_type
FROM tag_event_mappings m
JOIN zman_tags t ON t.id = m.tag_id
JOIN tag_types tt ON tt.id = t.tag_type_id
WHERE m.is_exact_hebcal_match = true
  AND m.hebcal_event_pattern = $1  -- Exact string equality
ORDER BY m.priority DESC, t.sort_order
LIMIT 1;

-- name: GetTagByRegexHebcalEvent :one
-- STEP 2: Try regex match if exact match failed (fallback path, ~10% of events)
-- Returns the highest priority regex match for a HebCal event name
SELECT
    t.id,
    t.tag_key,
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
    t.sort_order,
    m.priority,
    m.yom_tov_level,
    m.is_multi_day,
    m.duration_days_israel,
    m.duration_days_diaspora,
    m.fast_start_type
FROM tag_event_mappings m
JOIN zman_tags t ON t.id = m.tag_id
JOIN tag_types tt ON tt.id = t.tag_type_id
WHERE m.is_exact_hebcal_match = false
  AND m.hebcal_pattern_regex IS NOT NULL
  AND $1 ~ m.hebcal_pattern_regex  -- PostgreSQL regex match operator
ORDER BY m.priority DESC, t.sort_order
LIMIT 1;

-- name: GetTagByHebcalEventCombined :one
-- Combined query: Try exact first, fall back to regex
-- Note: This is a single-query alternative to calling GetTagByExactHebcalEvent + GetTagByRegexHebcalEvent
-- Performance: Slightly slower than 2-step approach, but fewer round trips
WITH exact_match AS (
    SELECT
        t.id,
        t.tag_key,
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
        t.sort_order,
        m.priority,
        m.yom_tov_level,
        m.is_multi_day,
        m.duration_days_israel,
        m.duration_days_diaspora,
        m.fast_start_type,
        1 AS match_rank  -- Exact match has priority
    FROM tag_event_mappings m
    JOIN zman_tags t ON t.id = m.tag_id
    JOIN tag_types tt ON tt.id = t.tag_type_id
    WHERE m.is_exact_hebcal_match = true
      AND m.hebcal_event_pattern = $1
    ORDER BY m.priority DESC, t.sort_order
    LIMIT 1
),
regex_match AS (
    SELECT
        t.id,
        t.tag_key,
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
        t.sort_order,
        m.priority,
        m.yom_tov_level,
        m.is_multi_day,
        m.duration_days_israel,
        m.duration_days_diaspora,
        m.fast_start_type,
        2 AS match_rank  -- Regex match is fallback
    FROM tag_event_mappings m
    JOIN zman_tags t ON t.id = m.tag_id
    JOIN tag_types tt ON tt.id = t.tag_type_id
    WHERE m.is_exact_hebcal_match = false
      AND m.hebcal_pattern_regex IS NOT NULL
      AND $1 ~ m.hebcal_pattern_regex
    ORDER BY m.priority DESC, t.sort_order
    LIMIT 1
)
SELECT
    id,
    tag_key,
    display_name_hebrew,
    display_name_english_ashkenazi,
    display_name_english_sephardi,
    hebcal_basename,
    tag_type_id,
    tag_type,
    tag_type_display_hebrew,
    tag_type_display_english,
    description,
    color,
    sort_order,
    priority,
    yom_tov_level,
    is_multi_day,
    duration_days_israel,
    duration_days_diaspora,
    fast_start_type
FROM (
    SELECT * FROM exact_match
    UNION ALL
    SELECT * FROM regex_match
) combined
ORDER BY match_rank, priority DESC, sort_order
LIMIT 1;

-- ============================================================================
-- Diagnostic Queries (for debugging and validation)
-- ============================================================================

-- name: GetAllExactHebcalMappings :many
-- Get all exact HebCal event mappings (for caching or diagnostics)
SELECT
    m.id AS mapping_id,
    t.tag_key,
    m.hebcal_event_pattern,
    m.priority,
    t.display_name_hebrew,
    t.display_name_english_ashkenazi
FROM tag_event_mappings m
JOIN zman_tags t ON t.id = m.tag_id
WHERE m.is_exact_hebcal_match = true
  AND m.hebcal_event_pattern IS NOT NULL
ORDER BY m.priority DESC, t.tag_key;

-- name: GetAllRegexHebcalMappings :many
-- Get all regex HebCal event mappings (for caching or diagnostics)
SELECT
    m.id AS mapping_id,
    t.tag_key,
    m.hebcal_pattern_regex,
    m.priority,
    t.display_name_hebrew,
    t.display_name_english_ashkenazi
FROM tag_event_mappings m
JOIN zman_tags t ON t.id = m.tag_id
WHERE m.is_exact_hebcal_match = false
  AND m.hebcal_pattern_regex IS NOT NULL
ORDER BY m.priority DESC, t.tag_key;

-- name: TestRegexPattern :many
-- Test a regex pattern against a list of event names
-- Usage: SELECT * FROM TestRegexPattern('^Chanukah: [1-8] Candles?$', ARRAY['Chanukah: 1 Candle', 'Chanukah: 8 Candles', 'Purim'])
-- Returns: List of test event names that match the pattern
-- Note: This is a diagnostic query, not for production use
-- SQLc note: This query requires PostgreSQL functions and may need custom implementation
SELECT
    event_name,
    event_name ~ $1 AS matches
FROM unnest($2::text[]) AS event_name;

-- name: CountHebcalMappingsByType :many
-- Get statistics on mapping types (exact vs regex)
SELECT
    CASE
        WHEN is_exact_hebcal_match THEN 'exact'
        ELSE 'regex'
    END AS mapping_type,
    COUNT(*) AS count
FROM tag_event_mappings
WHERE hebcal_event_pattern IS NOT NULL OR hebcal_pattern_regex IS NOT NULL
GROUP BY is_exact_hebcal_match
ORDER BY mapping_type;

-- ============================================================================
-- Migration Helper Queries (for manual data entry)
-- ============================================================================

-- name: AddExactHebcalMapping :exec
-- Add a new exact HebCal event mapping
INSERT INTO tag_event_mappings (
    tag_id,
    hebcal_event_pattern,
    is_exact_hebcal_match,
    priority,
    yom_tov_level,
    is_multi_day,
    duration_days_israel,
    duration_days_diaspora,
    fast_start_type
)
VALUES (
    $1,  -- tag_id
    $2,  -- hebcal_event_pattern
    true,  -- is_exact_hebcal_match
    $3,  -- priority
    $4,  -- yom_tov_level
    $5,  -- is_multi_day
    $6,  -- duration_days_israel
    $7,  -- duration_days_diaspora
    $8   -- fast_start_type
);

-- name: AddRegexHebcalMapping :exec
-- Add a new regex-based HebCal event mapping
INSERT INTO tag_event_mappings (
    tag_id,
    hebcal_pattern_regex,
    is_exact_hebcal_match,
    priority,
    yom_tov_level,
    is_multi_day,
    duration_days_israel,
    duration_days_diaspora,
    fast_start_type
)
VALUES (
    $1,  -- tag_id
    $2,  -- hebcal_pattern_regex
    false,  -- is_exact_hebcal_match
    $3,  -- priority
    $4,  -- yom_tov_level
    $5,  -- is_multi_day
    $6,  -- duration_days_israel
    $7,  -- duration_days_diaspora
    $8   -- fast_start_type
);

-- name: UpdateHebcalMappingToExact :exec
-- Convert a regex mapping to exact matching
UPDATE tag_event_mappings
SET
    is_exact_hebcal_match = true,
    hebcal_event_pattern = $2,
    hebcal_pattern_regex = NULL
WHERE id = $1;

-- name: UpdateHebcalMappingToRegex :exec
-- Convert an exact mapping to regex matching
UPDATE tag_event_mappings
SET
    is_exact_hebcal_match = false,
    hebcal_event_pattern = NULL,
    hebcal_pattern_regex = $2
WHERE id = $1;
