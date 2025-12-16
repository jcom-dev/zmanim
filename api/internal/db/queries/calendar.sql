-- Calendar and Jewish Events SQL Queries
-- SQLc will generate type-safe Go code from these queries

-- ============================================
-- JEWISH EVENTS QUERIES
-- ============================================

-- name: GetAllJewishEvents :many
-- Get all Jewish events with their type information
SELECT
    je.id,
    je.code,
    je.name_hebrew,
    je.name_english,
    jet.key as event_type,
    je.duration_days_israel,
    je.duration_days_diaspora,
    fst.key as fast_start_type,
    parent_je.code as parent_event_code,
    je.sort_order
FROM jewish_events je
LEFT JOIN jewish_event_types jet ON je.event_type_id = jet.id
LEFT JOIN fast_start_types fst ON je.fast_start_type_id = fst.id
LEFT JOIN jewish_events parent_je ON je.parent_event_id = parent_je.id
ORDER BY je.sort_order, je.name_english;

-- name: GetJewishEventsByType :many
-- Get Jewish events filtered by event type
SELECT
    je.id,
    je.code,
    je.name_hebrew,
    je.name_english,
    jet.key as event_type,
    je.duration_days_israel,
    je.duration_days_diaspora,
    fst.key as fast_start_type,
    parent_je.code as parent_event_code,
    je.sort_order
FROM jewish_events je
LEFT JOIN jewish_event_types jet ON je.event_type_id = jet.id
LEFT JOIN fast_start_types fst ON je.fast_start_type_id = fst.id
LEFT JOIN jewish_events parent_je ON je.parent_event_id = parent_je.id
WHERE jet.key = $1
ORDER BY je.sort_order, je.name_english;

-- ============================================
-- NOTE: Queries using master_zman_events and master_zman_day_types tables
-- have been removed because these tables are DEPRECATED (empty, tag-driven instead).
-- See scripts/dump-seed.sh:46
--
-- Removed queries:
-- - GetMasterZmanimByEvent
-- - GetMasterZmanimByEventAndDay
-- - GetZmanApplicableEvents
--
-- The system now uses a tag-driven approach via master_zman_tags instead.
-- ============================================
