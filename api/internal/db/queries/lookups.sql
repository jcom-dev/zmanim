-- Lookup Tables SQL Queries
-- Provides access to all lookup/reference tables for frontend dropdowns and validation

-- Publisher Statuses --

-- name: GetPublisherStatuses :many
SELECT id, key, display_name_hebrew, display_name_english, description, color, sort_order
FROM publisher_statuses
WHERE is_active = true
ORDER BY sort_order;

-- name: GetPublisherStatusByKey :one
SELECT id, key, display_name_hebrew, display_name_english, description, color
FROM publisher_statuses
WHERE key = $1;

-- name: GetPublisherStatusByID :one
SELECT id, key, display_name_hebrew, display_name_english, description, color
FROM publisher_statuses
WHERE id = $1;

-- Algorithm Statuses --

-- name: GetAlgorithmStatuses :many
SELECT id, key, display_name_hebrew, display_name_english, description, color, sort_order
FROM algorithm_statuses
ORDER BY sort_order;

-- name: GetAlgorithmStatusByKey :one
SELECT id, key, display_name_hebrew, display_name_english, description, color
FROM algorithm_statuses
WHERE key = $1;

-- name: GetAlgorithmStatusByID :one
SELECT id, key, display_name_hebrew, display_name_english, description, color
FROM algorithm_statuses
WHERE id = $1;

-- Coverage Levels --

-- name: GetCoverageLevels :many
SELECT id, key, display_name_hebrew, display_name_english, description, sort_order
FROM coverage_levels
ORDER BY sort_order;

-- name: GetCoverageLevelByKey :one
SELECT id, key, display_name_hebrew, display_name_english, description
FROM coverage_levels
WHERE key = $1;

-- name: GetCoverageLevelByID :one
SELECT id, key, display_name_hebrew, display_name_english, description
FROM coverage_levels
WHERE id = $1;

-- Publisher Roles --

-- name: GetPublisherRoles :many
SELECT id, key, display_name_hebrew, display_name_english, description, sort_order
FROM publisher_roles
ORDER BY sort_order;

-- name: GetPublisherRoleByKey :one
SELECT id, key, display_name_hebrew, display_name_english, description, permissions
FROM publisher_roles
WHERE key = $1;

-- name: GetPublisherRoleByID :one
SELECT id, key, display_name_hebrew, display_name_english, description, permissions
FROM publisher_roles
WHERE id = $1;

-- Request Statuses --

-- name: GetRequestStatuses :many
SELECT id, key, display_name_hebrew, display_name_english, description, color, sort_order
FROM request_statuses
ORDER BY sort_order;

-- name: GetRequestStatusByKey :one
SELECT id, key, display_name_hebrew, display_name_english, description, color
FROM request_statuses
WHERE key = $1;

-- Jewish Event Types --

-- name: GetJewishEventTypes :many
SELECT id, key, display_name_hebrew, display_name_english, description, sort_order
FROM jewish_event_types
ORDER BY sort_order;

-- name: GetJewishEventTypeByKey :one
SELECT id, key, display_name_hebrew, display_name_english, description
FROM jewish_event_types
WHERE key = $1;

-- Tag Types --

-- name: GetTagTypes :many
SELECT id, key, display_name_hebrew, display_name_english, description, color, sort_order
FROM tag_types
ORDER BY sort_order;

-- name: GetTagTypeByKey :one
SELECT id, key, display_name_hebrew, display_name_english, description, color
FROM tag_types
WHERE key = $1;

-- Geo Lookups --

-- name: GetContinentByCode :one
SELECT id, code, name
FROM geo_continents
WHERE code = $1;

-- name: GetCountryByCodeOrID :one
SELECT id, code, name
FROM geo_countries
WHERE code = $1 OR id::text = $1;

-- Note: GetRegionByID, GetCityByID, GetCityByName are defined in cities.sql
-- Note: GetTimeCategoryByKey is defined in categories.sql
