-- File: correction_requests.sql
-- Purpose: SQLc queries for city correction requests
-- Story: 6.5 - Public Correction Requests

-- name: CreateCorrectionRequest :one
INSERT INTO city_correction_requests (
  city_id,
  publisher_id,
  requester_email,
  requester_name,
  proposed_latitude,
  proposed_longitude,
  proposed_elevation,
  correction_reason,
  evidence_urls
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING *;

-- name: GetCorrectionRequestByID :one
SELECT
  ccr.*,
  c.name as city_name,
  c.latitude as current_latitude,
  c.longitude as current_longitude,
  c.elevation_m as current_elevation,
  p.name as publisher_name
FROM city_correction_requests ccr
JOIN geo_cities c ON ccr.city_id = c.id
LEFT JOIN publishers p ON ccr.publisher_id = p.id
WHERE ccr.id = $1;

-- name: GetPublisherCorrectionRequests :many
SELECT
  ccr.*,
  c.name as city_name,
  c.latitude as current_latitude,
  c.longitude as current_longitude,
  c.elevation_m as current_elevation
FROM city_correction_requests ccr
JOIN geo_cities c ON ccr.city_id = c.id
WHERE ccr.publisher_id = $1
ORDER BY ccr.created_at DESC;

-- name: GetAllCorrectionRequests :many
SELECT
  ccr.*,
  c.name as city_name,
  c.latitude as current_latitude,
  c.longitude as current_longitude,
  c.elevation_m as current_elevation,
  p.name as publisher_name
FROM city_correction_requests ccr
JOIN geo_cities c ON ccr.city_id = c.id
LEFT JOIN publishers p ON ccr.publisher_id = p.id
WHERE (sqlc.narg('status')::text IS NULL OR ccr.status = sqlc.narg('status'))
ORDER BY ccr.created_at DESC;

-- name: UpdateCorrectionRequestStatus :exec
UPDATE city_correction_requests
SET
  status = $2,
  reviewed_by = $3,
  reviewed_at = now(),
  review_notes = $4,
  updated_at = now()
WHERE id = $1;

-- name: ApplyCityCorrection :exec
UPDATE geo_cities
SET
  latitude = COALESCE(sqlc.narg('proposed_latitude')::double precision, latitude),
  longitude = COALESCE(sqlc.narg('proposed_longitude')::double precision, longitude),
  elevation_m = COALESCE(sqlc.narg('proposed_elevation')::integer, elevation_m),
  updated_at = now()
WHERE id = sqlc.arg('id')::bigint;

-- name: AdminUpdateCity :exec
UPDATE geo_cities
SET
  latitude = COALESCE(sqlc.narg('latitude')::double precision, latitude),
  longitude = COALESCE(sqlc.narg('longitude')::double precision, longitude),
  elevation_m = COALESCE(sqlc.narg('elevation')::integer, elevation_m),
  updated_at = now()
WHERE id = sqlc.arg('id')::bigint;
