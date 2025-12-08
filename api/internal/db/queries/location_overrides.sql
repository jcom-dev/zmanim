-- name: CreateLocationOverride :one
INSERT INTO publisher_location_overrides (
  publisher_id,
  city_id,
  override_latitude,
  override_longitude,
  override_elevation,
  reason
) VALUES (
  $1, $2, $3, $4, $5, $6
)
RETURNING *;

-- name: GetPublisherLocationOverrides :many
SELECT
  plo.id,
  plo.publisher_id,
  plo.city_id,
  plo.override_latitude,
  plo.override_longitude,
  plo.override_elevation,
  plo.reason,
  plo.created_at,
  plo.updated_at,
  c.name AS city_name,
  co.name AS country_name
FROM publisher_location_overrides plo
JOIN geo_cities c ON plo.city_id = c.id
JOIN geo_countries co ON c.country_id = co.id
WHERE plo.publisher_id = $1
ORDER BY plo.updated_at DESC;

-- name: GetLocationOverrideForCalculation :one
SELECT
  override_latitude,
  override_longitude,
  override_elevation
FROM publisher_location_overrides
WHERE publisher_id = $1 AND city_id = $2
LIMIT 1;

-- name: GetLocationOverrideByID :one
SELECT * FROM publisher_location_overrides
WHERE id = $1
LIMIT 1;

-- name: UpdateLocationOverride :one
UPDATE publisher_location_overrides
SET
  override_latitude = $2,
  override_longitude = $3,
  override_elevation = $4,
  reason = $5,
  updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteLocationOverride :exec
DELETE FROM publisher_location_overrides
WHERE id = $1;

-- name: GetLocationOverrideByCityID :one
SELECT * FROM publisher_location_overrides
WHERE publisher_id = $1 AND city_id = $2
LIMIT 1;
