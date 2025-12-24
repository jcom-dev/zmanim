-- Queries for time_categories and tag_types tables

-- ============================================================================
-- TIME CATEGORIES
-- ============================================================================

-- name: GetAllTimeCategories :many
-- Get all time categories ordered by sort_order
SELECT id, key, display_name_hebrew, display_name_english,
       description, icon_name, color, sort_order, is_everyday, created_at
FROM time_categories
ORDER BY sort_order;

-- name: GetTimeCategoryByKey :one
-- Get a time category by its key
SELECT id, key, display_name_hebrew, display_name_english,
       description, icon_name, color, sort_order, is_everyday, created_at
FROM time_categories
WHERE key = $1;

-- name: GetTimeCategoryByID :one
-- Get a time category by its ID
SELECT id, key, display_name_hebrew, display_name_english,
       description, icon_name, color, sort_order, is_everyday, created_at
FROM time_categories
WHERE id = $1;

-- ============================================================================
-- TAG TYPES
-- ============================================================================

-- name: GetAllTagTypes :many
-- Get all tag types ordered by sort_order
SELECT id, key, display_name_hebrew, display_name_english,
       color, sort_order, created_at
FROM tag_types
ORDER BY sort_order;

-- Removed: Duplicate of GetTagTypeByKey in lookups.sql

-- name: GetTagTypeByID :one
-- Get a tag type by its ID
SELECT id, key, display_name_hebrew, display_name_english,
       color, sort_order, created_at
FROM tag_types
WHERE id = $1;

-- ============================================================================
-- DISPLAY GROUPS
-- ============================================================================

-- name: GetAllDisplayGroups :many
-- Get all display groups ordered by sort_order
SELECT id, key, display_name_hebrew, display_name_english,
       description, icon_name, color, sort_order, time_categories, created_at
FROM display_groups
ORDER BY sort_order;

-- name: GetDisplayGroupByKey :one
-- Get a display group by its key
SELECT id, key, display_name_hebrew, display_name_english,
       description, icon_name, color, sort_order, time_categories, created_at
FROM display_groups
WHERE key = $1;

-- name: GetDisplayGroupByID :one
-- Get a display group by its ID
SELECT id, key, display_name_hebrew, display_name_english,
       description, icon_name, color, sort_order, time_categories, created_at
FROM display_groups
WHERE id = $1;
