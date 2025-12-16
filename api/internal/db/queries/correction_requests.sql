-- File: correction_requests.sql
-- Purpose: SQLc queries for locality correction requests
-- Story: 6.5 - Public Correction Requests

-- name: CreateCorrectionRequest :one
INSERT INTO location_correction_requests (
  locality_id,
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
-- Current coordinates/elevation resolved with priority: admin > default (for display)
-- Original coordinates/elevation from default source (excluding admin overrides, for revert)
-- Uses LATERAL joins to avoid materializing the full resolved_coords view for 4M+ localities
SELECT
  ccr.*,
  l.name as locality_name,
  COALESCE(bc.latitude, 0.0) as current_latitude,
  COALESCE(bc.longitude, 0.0) as current_longitude,
  COALESCE(be.elevation_m, 0) as current_elevation,
  oc.latitude as original_latitude,
  oc.longitude as original_longitude,
  oe.elevation_m as original_elevation,
  p.name as publisher_name
FROM location_correction_requests ccr
JOIN geo_localities l ON ccr.locality_id = l.id
LEFT JOIN LATERAL (
  SELECT ll.latitude, ll.longitude
  FROM geo_locality_locations ll
  JOIN geo_data_sources ds ON ds.id = ll.source_id AND ds.is_active = true
  WHERE ll.locality_id = l.id AND ll.publisher_id IS NULL
  ORDER BY CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END, ds.priority
  LIMIT 1
) bc ON true
LEFT JOIN LATERAL (
  SELECT le.elevation_m
  FROM geo_locality_elevations le
  JOIN geo_data_sources ds ON ds.id = le.source_id AND ds.is_active = true
  WHERE le.locality_id = l.id AND le.publisher_id IS NULL
  ORDER BY CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END, ds.priority
  LIMIT 1
) be ON true
LEFT JOIN LATERAL (
  SELECT ll.latitude, ll.longitude
  FROM geo_locality_locations ll
  JOIN geo_data_sources ds ON ds.id = ll.source_id AND ds.is_active = true
  WHERE ll.locality_id = l.id AND ll.publisher_id IS NULL AND ds.key != 'admin'
  ORDER BY ds.priority
  LIMIT 1
) oc ON true
LEFT JOIN LATERAL (
  SELECT le.elevation_m
  FROM geo_locality_elevations le
  JOIN geo_data_sources ds ON ds.id = le.source_id AND ds.is_active = true
  WHERE le.locality_id = l.id AND le.publisher_id IS NULL AND ds.key != 'admin'
  ORDER BY ds.priority
  LIMIT 1
) oe ON true
LEFT JOIN publishers p ON ccr.publisher_id = p.id
WHERE ccr.id = $1;

-- name: GetPublisherCorrectionRequests :many
-- Current coordinates/elevation resolved with priority: admin > default (for display)
-- Uses LATERAL joins to avoid materializing the full resolved_coords view for 4M+ localities
SELECT
  ccr.*,
  l.name as locality_name,
  COALESCE(bc.latitude, 0.0) as current_latitude,
  COALESCE(bc.longitude, 0.0) as current_longitude,
  COALESCE(be.elevation_m, 0) as current_elevation
FROM location_correction_requests ccr
JOIN geo_localities l ON ccr.locality_id = l.id
LEFT JOIN LATERAL (
  SELECT ll.latitude, ll.longitude
  FROM geo_locality_locations ll
  JOIN geo_data_sources ds ON ds.id = ll.source_id AND ds.is_active = true
  WHERE ll.locality_id = l.id AND ll.publisher_id IS NULL
  ORDER BY CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END, ds.priority
  LIMIT 1
) bc ON true
LEFT JOIN LATERAL (
  SELECT le.elevation_m
  FROM geo_locality_elevations le
  JOIN geo_data_sources ds ON ds.id = le.source_id AND ds.is_active = true
  WHERE le.locality_id = l.id AND le.publisher_id IS NULL
  ORDER BY CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END, ds.priority
  LIMIT 1
) be ON true
WHERE ccr.publisher_id = $1
ORDER BY ccr.created_at DESC;

-- name: GetAllCorrectionRequests :many
-- Current coordinates/elevation resolved with priority: admin > default (for display)
-- Uses LATERAL joins to avoid materializing the full resolved_coords view for 4M+ localities
SELECT
  ccr.*,
  l.name as locality_name,
  COALESCE(bc.latitude, 0.0) as current_latitude,
  COALESCE(bc.longitude, 0.0) as current_longitude,
  COALESCE(be.elevation_m, 0) as current_elevation,
  p.name as publisher_name
FROM location_correction_requests ccr
JOIN geo_localities l ON ccr.locality_id = l.id
LEFT JOIN LATERAL (
  SELECT ll.latitude, ll.longitude
  FROM geo_locality_locations ll
  JOIN geo_data_sources ds ON ds.id = ll.source_id AND ds.is_active = true
  WHERE ll.locality_id = l.id AND ll.publisher_id IS NULL
  ORDER BY CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END, ds.priority
  LIMIT 1
) bc ON true
LEFT JOIN LATERAL (
  SELECT le.elevation_m
  FROM geo_locality_elevations le
  JOIN geo_data_sources ds ON ds.id = le.source_id AND ds.is_active = true
  WHERE le.locality_id = l.id AND le.publisher_id IS NULL
  ORDER BY CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END, ds.priority
  LIMIT 1
) be ON true
LEFT JOIN publishers p ON ccr.publisher_id = p.id
WHERE (sqlc.narg('status')::text IS NULL OR ccr.status = sqlc.narg('status'))
ORDER BY ccr.created_at DESC;

-- name: UpdateCorrectionRequestStatus :exec
UPDATE location_correction_requests
SET
  status = $2,
  reviewed_by = $3,
  reviewed_at = now(),
  review_notes = $4,
  approved_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE NULL END,
  updated_at = now()
WHERE id = $1;

-- name: CreateAdminLocationOverride :one
-- Creates an admin override for locality coordinates (source='admin', publisher_id=NULL)
-- This is the highest priority system-wide coordinate source
INSERT INTO geo_locality_locations (
  locality_id,
  publisher_id,
  source_id,
  latitude,
  longitude,
  accuracy_m,
  reason,
  created_by
)
SELECT
  sqlc.arg('locality_id')::integer,
  NULL,  -- System-wide (not publisher-specific)
  ds.id,
  sqlc.arg('latitude')::double precision,
  sqlc.arg('longitude')::double precision,
  sqlc.narg('accuracy_m')::integer,
  sqlc.narg('reason')::text,
  sqlc.narg('created_by')::text
FROM geo_data_sources ds
WHERE ds.key = 'admin'
ON CONFLICT ON CONSTRAINT geo_locality_locations_unique
DO UPDATE SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  accuracy_m = COALESCE(EXCLUDED.accuracy_m, geo_locality_locations.accuracy_m),
  reason = COALESCE(EXCLUDED.reason, geo_locality_locations.reason),
  updated_at = now()
RETURNING id, locality_id, publisher_id, source_id, latitude, longitude, accuracy_m, reason, created_at, updated_at, created_by;

-- name: CreateAdminElevationOverride :one
-- Creates an admin override for locality elevation (source='admin', publisher_id=NULL)
-- This is the highest priority system-wide elevation source
INSERT INTO geo_locality_elevations (
  locality_id,
  publisher_id,
  source_id,
  elevation_m,
  accuracy_m,
  reason,
  created_by
)
SELECT
  sqlc.arg('locality_id')::integer,
  NULL,  -- System-wide (not publisher-specific)
  ds.id,
  sqlc.arg('elevation_m')::integer,
  sqlc.narg('accuracy_m')::integer,
  sqlc.narg('reason')::text,
  sqlc.narg('created_by')::text
FROM geo_data_sources ds
WHERE ds.key = 'admin'
ON CONFLICT ON CONSTRAINT geo_locality_elevations_unique
DO UPDATE SET
  elevation_m = EXCLUDED.elevation_m,
  accuracy_m = COALESCE(EXCLUDED.accuracy_m, geo_locality_elevations.accuracy_m),
  reason = COALESCE(EXCLUDED.reason, geo_locality_elevations.reason),
  updated_at = now()
RETURNING id, locality_id, publisher_id, source_id, elevation_m, accuracy_m, reason, created_at, updated_at, created_by;

-- name: CreatePublisherLocationOverride :one
-- Creates a publisher-specific override for locality coordinates
-- This is the highest priority for this publisher's zmanim calculations
INSERT INTO geo_locality_locations (
  locality_id,
  publisher_id,
  source_id,
  latitude,
  longitude,
  accuracy_m,
  reason,
  created_by
)
SELECT
  sqlc.arg('locality_id')::integer,
  sqlc.arg('publisher_id')::integer,
  ds.id,
  sqlc.arg('latitude')::double precision,
  sqlc.arg('longitude')::double precision,
  sqlc.narg('accuracy_m')::integer,
  sqlc.narg('reason')::text,
  sqlc.narg('created_by')::text
FROM geo_data_sources ds
WHERE ds.key = 'publisher'
ON CONFLICT ON CONSTRAINT geo_locality_locations_unique
DO UPDATE SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  accuracy_m = COALESCE(EXCLUDED.accuracy_m, geo_locality_locations.accuracy_m),
  reason = COALESCE(EXCLUDED.reason, geo_locality_locations.reason),
  updated_at = now()
RETURNING id, locality_id, publisher_id, source_id, latitude, longitude, accuracy_m, reason, created_at, updated_at, created_by;

-- name: CreatePublisherElevationOverride :one
-- Creates a publisher-specific override for locality elevation
-- This is the highest priority for this publisher's zmanim calculations
INSERT INTO geo_locality_elevations (
  locality_id,
  publisher_id,
  source_id,
  elevation_m,
  accuracy_m,
  reason,
  created_by
)
SELECT
  sqlc.arg('locality_id')::integer,
  sqlc.arg('publisher_id')::integer,
  ds.id,
  sqlc.arg('elevation_m')::integer,
  sqlc.narg('accuracy_m')::integer,
  sqlc.narg('reason')::text,
  sqlc.narg('created_by')::text
FROM geo_data_sources ds
WHERE ds.key = 'publisher'
ON CONFLICT ON CONSTRAINT geo_locality_elevations_unique
DO UPDATE SET
  elevation_m = EXCLUDED.elevation_m,
  accuracy_m = COALESCE(EXCLUDED.accuracy_m, geo_locality_elevations.accuracy_m),
  reason = COALESCE(EXCLUDED.reason, geo_locality_elevations.reason),
  updated_at = now()
RETURNING *;

-- name: DeleteLocalityLocationOverrideByLocality :exec
-- Removes a location override (admin or publisher) by locality_id and optional publisher_id
-- ONLY deletes admin or publisher overrides, never base data sources
DELETE FROM geo_locality_locations
WHERE locality_id = sqlc.arg('locality_id')::integer
  AND source_id IN (
    SELECT id FROM geo_data_sources
    WHERE key IN ('admin', 'publisher')
  )
  AND (
    (sqlc.narg('publisher_id')::integer IS NULL AND publisher_id IS NULL)
    OR publisher_id = sqlc.narg('publisher_id')::integer
  );

-- name: DeleteLocalityElevationOverrideByLocality :exec
-- Removes an elevation override (admin or publisher) by locality_id and optional publisher_id
-- ONLY deletes admin or publisher overrides, never base data sources
DELETE FROM geo_locality_elevations
WHERE locality_id = sqlc.arg('locality_id')::integer
  AND source_id IN (
    SELECT id FROM geo_data_sources
    WHERE key IN ('admin', 'publisher')
  )
  AND (
    (sqlc.narg('publisher_id')::integer IS NULL AND publisher_id IS NULL)
    OR publisher_id = sqlc.narg('publisher_id')::integer
  );

-- name: UpdateCorrectionRequest :one
-- Updates a pending correction request (publisher can only update their own pending requests)
UPDATE location_correction_requests
SET
  locality_id = $2,
  proposed_latitude = $3,
  proposed_longitude = $4,
  proposed_elevation = $5,
  correction_reason = $6,
  evidence_urls = $7,
  updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteCorrectionRequest :exec
-- Deletes a correction request by ID
DELETE FROM location_correction_requests
WHERE id = $1;

-- name: CheckDuplicateCorrectionRequests :many
SELECT
  ccr.id,
  ccr.locality_id,
  ccr.publisher_id,
  ccr.status,
  ccr.proposed_latitude,
  ccr.proposed_longitude,
  ccr.proposed_elevation,
  ccr.created_at,
  ccr.approved_at,
  p.name as publisher_name
FROM location_correction_requests ccr
LEFT JOIN publishers p ON ccr.publisher_id = p.id
WHERE ccr.locality_id = $1
  AND ccr.status IN ('pending', 'approved')
  AND (ccr.status = 'pending' OR ccr.approved_at > NOW() - INTERVAL '30 days')
ORDER BY
  CASE ccr.status WHEN 'pending' THEN 1 ELSE 2 END,
  ccr.created_at DESC;

-- name: InsertCorrectionHistory :one
INSERT INTO correction_request_history (
  correction_request_id, locality_id, action, performed_by,
  previous_latitude, previous_longitude, previous_elevation,
  new_latitude, new_longitude, new_elevation, notes
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: GetCorrectionRequestHistory :many
-- Get all approved/reverted correction requests for a locality (for History & Revert tab)
-- Uses LATERAL joins to get current coordinates (before the correction was applied)
SELECT
  ccr.id,
  ccr.locality_id,
  l.name as locality_name,
  c.name as country_name,
  ccr.publisher_id,
  p.name as publisher_name,
  ccr.requester_email,
  ccr.requester_name,
  COALESCE(bc.latitude, 0.0) as previous_latitude,
  COALESCE(bc.longitude, 0.0) as previous_longitude,
  COALESCE(be.elevation_m, 0) as previous_elevation,
  ccr.proposed_latitude,
  ccr.proposed_longitude,
  ccr.proposed_elevation,
  ccr.status,
  ccr.reviewed_at as approved_at,
  ccr.reverted_at,
  ccr.reverted_by,
  ccr.revert_reason,
  ccr.created_at
FROM location_correction_requests ccr
JOIN geo_localities l ON ccr.locality_id = l.id
JOIN geo_countries c ON l.country_id = c.id
LEFT JOIN publishers p ON ccr.publisher_id = p.id
LEFT JOIN LATERAL (
  SELECT ll.latitude, ll.longitude
  FROM geo_locality_locations ll
  JOIN geo_data_sources ds ON ds.id = ll.source_id AND ds.is_active = true
  WHERE ll.locality_id = l.id AND ll.publisher_id IS NULL
  ORDER BY CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END, ds.priority
  LIMIT 1
) bc ON true
LEFT JOIN LATERAL (
  SELECT le.elevation_m
  FROM geo_locality_elevations le
  JOIN geo_data_sources ds ON ds.id = le.source_id AND ds.is_active = true
  WHERE le.locality_id = l.id AND le.publisher_id IS NULL
  ORDER BY CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END, ds.priority
  LIMIT 1
) be ON true
WHERE ccr.locality_id = $1
  AND ccr.status IN ('approved', 'reverted')
ORDER BY
  CASE ccr.status
    WHEN 'approved' THEN 1
    WHEN 'reverted' THEN 2
  END,
  ccr.reviewed_at DESC NULLS LAST,
  ccr.created_at DESC;

-- name: GetRequestHistory :many
SELECT * FROM correction_request_history
WHERE correction_request_id = $1
ORDER BY performed_at DESC;

-- name: RevertCorrectionRequest :exec
UPDATE location_correction_requests
SET status = 'reverted',
    reverted_at = NOW(),
    reverted_by = $1,
    revert_reason = $2,
    updated_at = NOW()
WHERE id = $3 AND status = 'approved';
