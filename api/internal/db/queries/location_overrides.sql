-- ============================================
-- Location Override Queries
-- Hierarchical location/elevation management
-- ============================================

-- ============================================
-- Resolution Function Query
-- ============================================
-- NOTE: get_effective_locality_location() is implemented in locality_locations_manual.go
-- SQLc cannot introspect PostgreSQL functions that return TABLE(...)

-- ============================================
-- Location Override CRUD
-- ============================================

-- name: CreateLocalityLocationOverride :one
INSERT INTO geo_locality_locations (
    locality_id, publisher_id, source_id, latitude, longitude,
    accuracy_m, reason, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
) RETURNING id, locality_id, publisher_id, source_id, latitude, longitude, accuracy_m, reason, created_at, updated_at, created_by;

-- name: UpdateLocalityLocationOverride :one
UPDATE geo_locality_locations
SET
    latitude = $2,
    longitude = $3,
    accuracy_m = $4,
    reason = $5,
    updated_at = now()
WHERE id = $1
RETURNING id, locality_id, publisher_id, source_id, latitude, longitude, accuracy_m, reason, created_at, updated_at, created_by;

-- name: DeleteLocalityLocationOverride :exec
DELETE FROM geo_locality_locations WHERE id = $1;

-- name: GetLocalityLocationOverrideByID :one
SELECT id, locality_id, publisher_id, source_id, latitude, longitude, accuracy_m, reason, created_at, updated_at, created_by FROM geo_locality_locations WHERE id = $1;

-- ============================================
-- Elevation Override CRUD
-- ============================================

-- name: CreateLocalityElevationOverride :one
INSERT INTO geo_locality_elevations (
    locality_id, publisher_id, source_id, elevation_m,
    accuracy_m, reason, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING *;

-- name: UpdateLocalityElevationOverride :one
UPDATE geo_locality_elevations
SET
    elevation_m = $2,
    accuracy_m = $3,
    reason = $4,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteLocalityElevationOverride :exec
DELETE FROM geo_locality_elevations WHERE id = $1;

-- name: GetLocalityElevationOverrideByID :one
SELECT * FROM geo_locality_elevations WHERE id = $1;

-- ============================================
-- List Overrides by Locality (Admin View)
-- ============================================

-- name: GetLocalityLocationOverrides :many
-- Returns all location overrides for a locality (shows all sources)
SELECT
    ll.id,
    ll.locality_id,
    ll.publisher_id,
    ll.source_id,
    s.key as source_key,
    s.name as source_name,
    ll.latitude,
    ll.longitude,
    ll.accuracy_m,
    ll.reason,
    ll.created_at,
    ll.updated_at,
    ll.created_by,
    p.name as publisher_name
FROM geo_locality_locations ll
JOIN geo_data_sources s ON s.id = ll.source_id
LEFT JOIN publishers p ON p.id = ll.publisher_id
WHERE ll.locality_id = $1
ORDER BY
    CASE WHEN ll.publisher_id IS NOT NULL THEN 0 ELSE 1 END,
    s.priority;

-- name: GetLocalityElevationOverrides :many
-- Returns all elevation overrides for a locality
SELECT
    le.id,
    le.locality_id,
    le.publisher_id,
    le.source_id,
    s.key as source_key,
    s.name as source_name,
    le.elevation_m,
    le.accuracy_m,
    le.reason,
    le.created_at,
    le.updated_at,
    le.created_by,
    p.name as publisher_name
FROM geo_locality_elevations le
JOIN geo_data_sources s ON s.id = le.source_id
LEFT JOIN publishers p ON p.id = le.publisher_id
WHERE le.locality_id = $1
ORDER BY
    CASE WHEN le.publisher_id IS NOT NULL THEN 0 ELSE 1 END,
    s.priority;

-- ============================================
-- Publisher-specific Override Queries
-- ============================================

-- name: GetPublisherLocationOverridesNew :many
-- Returns all location overrides for a specific publisher
SELECT
    ll.id,
    ll.locality_id,
    l.name as locality_name,
    c.name as country_name,
    ll.latitude,
    ll.longitude,
    ll.reason,
    ll.created_at,
    ll.updated_at
FROM geo_locality_locations ll
JOIN geo_localities l ON l.id = ll.locality_id
JOIN geo_countries c ON c.id = l.country_id
WHERE ll.publisher_id = $1
ORDER BY ll.updated_at DESC;

-- name: GetPublisherElevationOverrides :many
-- Returns all elevation overrides for a specific publisher
SELECT
    le.id,
    le.locality_id,
    l.name as locality_name,
    c.name as country_name,
    le.elevation_m,
    le.reason,
    le.created_at,
    le.updated_at
FROM geo_locality_elevations le
JOIN geo_localities l ON l.id = le.locality_id
JOIN geo_countries c ON c.id = l.country_id
WHERE le.publisher_id = $1
ORDER BY le.updated_at DESC;

-- name: GetPublisherLocationOverrideByLocality :one
-- Get a publisher's specific override for a locality
SELECT
    ll.id,
    ll.locality_id,
    ll.latitude,
    ll.longitude,
    ll.reason,
    ll.created_at,
    ll.updated_at
FROM geo_locality_locations ll
WHERE ll.publisher_id = $1 AND ll.locality_id = $2
LIMIT 1;

-- name: GetPublisherElevationOverrideByLocality :one
-- Get a publisher's specific elevation override for a locality
SELECT
    le.id,
    le.locality_id,
    le.elevation_m,
    le.reason,
    le.created_at,
    le.updated_at
FROM geo_locality_elevations le
WHERE le.publisher_id = $1 AND le.locality_id = $2
LIMIT 1;

-- ============================================
-- Admin Override Queries
-- ============================================

-- name: GetAdminLocationOverrides :many
-- Returns all system-wide admin location overrides
SELECT
    ll.id,
    ll.locality_id,
    l.name as locality_name,
    c.name as country_name,
    ll.latitude,
    ll.longitude,
    ll.reason,
    ll.created_by,
    ll.created_at,
    ll.updated_at
FROM geo_locality_locations ll
JOIN geo_localities l ON l.id = ll.locality_id
JOIN geo_countries c ON c.id = l.country_id
JOIN geo_data_sources s ON s.id = ll.source_id
WHERE ll.publisher_id IS NULL AND s.key = 'admin'
ORDER BY ll.updated_at DESC;

-- name: GetAdminElevationOverrides :many
-- Returns all system-wide admin elevation overrides
SELECT
    le.id,
    le.locality_id,
    l.name as locality_name,
    c.name as country_name,
    le.elevation_m,
    le.reason,
    le.created_by,
    le.created_at,
    le.updated_at
FROM geo_locality_elevations le
JOIN geo_localities l ON l.id = le.locality_id
JOIN geo_countries c ON c.id = l.country_id
JOIN geo_data_sources s ON s.id = le.source_id
WHERE le.publisher_id IS NULL AND s.key = 'admin'
ORDER BY le.updated_at DESC;

-- ============================================
-- Existence Checks
-- ============================================

-- name: CheckLocalityLocationOverrideExists :one
SELECT EXISTS(
    SELECT 1 FROM geo_locality_locations
    WHERE locality_id = sqlc.arg(locality_id)::int
      AND (
        (sqlc.narg(publisher_id)::int IS NULL AND publisher_id IS NULL) OR
        (publisher_id = sqlc.narg(publisher_id)::int)
      )
      AND source_id = sqlc.arg(source_id)::int
) AS exists;

-- name: CheckLocalityElevationOverrideExists :one
SELECT EXISTS(
    SELECT 1 FROM geo_locality_elevations
    WHERE locality_id = sqlc.arg(locality_id)::int
      AND (
        (sqlc.narg(publisher_id)::int IS NULL AND publisher_id IS NULL) OR
        (publisher_id = sqlc.narg(publisher_id)::int)
      )
      AND source_id = sqlc.arg(source_id)::int
) AS exists;

