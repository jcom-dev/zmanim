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
-- MASTER ZMANIM BY EVENT QUERIES
-- ============================================

-- name: GetMasterZmanimByEvent :many
-- Get all master zmanim associated with a specific Jewish event
SELECT DISTINCT
    mr.id,
    mr.zman_key,
    mr.canonical_hebrew_name,
    mr.canonical_english_name,
    mr.transliteration,
    mr.description,
    mr.halachic_notes,
    mr.halachic_source,
    tc.key as time_category,
    mr.default_formula_dsl,
    mr.is_core,
    mr.created_at,
    mr.updated_at
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
JOIN master_zman_events mze ON mr.id = mze.master_zman_id
JOIN jewish_events je ON je.id = mze.jewish_event_id
WHERE je.code = $1 AND mze.is_primary = true
ORDER BY tc.sort_order, mr.canonical_hebrew_name;

-- name: GetMasterZmanimByEventAndDay :many
-- Get master zmanim for a specific event (all days, no day filtering in DB)
-- Note: The original code had applies_to_day column which doesn't exist in schema
-- This query returns all zmanim for the event; day filtering should be done in application layer
SELECT DISTINCT
    mr.id,
    mr.zman_key,
    mr.canonical_hebrew_name,
    mr.canonical_english_name,
    mr.transliteration,
    mr.description,
    mr.halachic_notes,
    mr.halachic_source,
    tc.key as time_category,
    mr.default_formula_dsl,
    mr.is_core,
    mr.created_at,
    mr.updated_at
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
JOIN master_zman_events mze ON mr.id = mze.master_zman_id
JOIN jewish_events je ON je.id = mze.jewish_event_id
WHERE je.code = $1 AND mze.is_primary = true
ORDER BY tc.sort_order, mr.canonical_hebrew_name;

-- ============================================
-- ZMAN DISPLAY CONTEXTS QUERIES
-- ============================================

-- name: GetZmanDisplayContextsByKey :many
-- Get display contexts for a specific zman by zman_key
SELECT
    zdc.id,
    zdc.context_code,
    zdc.display_name_hebrew,
    zdc.display_name_english,
    zdc.sort_order
FROM zman_display_contexts zdc
JOIN master_zmanim_registry mr ON mr.id = zdc.master_zman_id
WHERE mr.zman_key = $1
ORDER BY zdc.sort_order;

-- ============================================
-- ZMAN APPLICABLE EVENTS QUERIES
-- ============================================

-- name: GetZmanApplicableEvents :many
-- Get all Jewish events that a specific zman applies to
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
    je.sort_order,
    mze.is_primary,
    mze.override_hebrew_name,
    mze.override_english_name
FROM jewish_events je
LEFT JOIN jewish_event_types jet ON je.event_type_id = jet.id
LEFT JOIN fast_start_types fst ON je.fast_start_type_id = fst.id
LEFT JOIN jewish_events parent_je ON je.parent_event_id = parent_je.id
JOIN master_zman_events mze ON je.id = mze.jewish_event_id
JOIN master_zmanim_registry mr ON mr.id = mze.master_zman_id
WHERE mr.zman_key = $1
ORDER BY je.sort_order;
