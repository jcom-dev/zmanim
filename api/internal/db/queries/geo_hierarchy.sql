-- Cities SQL Queries (Geographic Hierarchy)
-- Continent -> Country -> Region -> Locality

-- ============================================================================
-- Continents
-- ============================================================================

-- name: GetContinents :many
-- Count only localities with COMPLETE hierarchy chain (locality -> country -> continent)
-- Filter out continents with 0 localities
SELECT ct.id, ct.code, ct.name, COUNT(l.id) as locality_count
FROM geo_continents ct
JOIN geo_countries co ON co.continent_id = ct.id
JOIN geo_localities l ON l.country_id = co.id
GROUP BY ct.id, ct.code, ct.name
HAVING COUNT(l.id) > 0
ORDER BY ct.name;

-- ============================================================================
-- Countries
-- ============================================================================

-- name: GetCountries :many
-- Returns English name if available, otherwise native name
-- Uses subquery to get only one English name per country (prevents duplicates from multiple name entries)
-- Prefers common/official names over primary (which may contain multi-script concatenation)
SELECT
    co.id, co.code as country_code, co.code_iso3,
    COALESCE(
        (SELECT n.name FROM geo_names n
         WHERE n.entity_type = 'country' AND n.entity_id = co.id AND n.language_code = 'en'
         ORDER BY CASE n.name_type WHEN 'common' THEN 1 WHEN 'official' THEN 2 WHEN 'alternate' THEN 3 ELSE 4 END, n.id
         LIMIT 1),
        co.name
    ) as country,
    co.adm1_label, co.adm2_label, co.has_adm1, co.has_adm2, co.is_city_state,
    ct.code as continent_code, ct.name as continent
FROM geo_countries co
JOIN geo_continents ct ON co.continent_id = ct.id
ORDER BY COALESCE(
    (SELECT n.name FROM geo_names n
     WHERE n.entity_type = 'country' AND n.entity_id = co.id AND n.language_code = 'en'
     ORDER BY CASE n.name_type WHEN 'common' THEN 1 WHEN 'official' THEN 2 WHEN 'alternate' THEN 3 ELSE 4 END, n.id
     LIMIT 1),
    co.name
);

-- name: GetCountriesByContinent :many
-- Count localities via geo_search_index (uses idx_geo_search_country for O(1) lookups)
-- Filter out countries with 0 localities
-- Returns English name if available, otherwise native name
-- Prefers common/official names over primary (which may contain multi-script concatenation)
SELECT
    co.id, co.code as country_code,
    COALESCE(
        (SELECT n.name FROM geo_names n
         WHERE n.entity_type = 'country' AND n.entity_id = co.id AND n.language_code = 'en'
         ORDER BY CASE n.name_type WHEN 'common' THEN 1 WHEN 'official' THEN 2 WHEN 'alternate' THEN 3 ELSE 4 END, n.id
         LIMIT 1),
        co.name
    ) as country,
    co.adm1_label, co.adm2_label, co.has_adm1, co.has_adm2,
    (SELECT COUNT(*) FROM geo_search_index s
     WHERE s.entity_type = 'locality' AND s.country_id = co.id)::bigint as locality_count
FROM geo_countries co
JOIN geo_continents ct ON co.continent_id = ct.id
WHERE ct.code = $1
  AND EXISTS (SELECT 1 FROM geo_search_index s WHERE s.entity_type = 'locality' AND s.country_id = co.id)
ORDER BY COALESCE(
    (SELECT n.name FROM geo_names n
     WHERE n.entity_type = 'country' AND n.entity_id = co.id AND n.language_code = 'en'
     ORDER BY CASE n.name_type WHEN 'common' THEN 1 WHEN 'official' THEN 2 WHEN 'alternate' THEN 3 ELSE 4 END, n.id
     LIMIT 1),
    co.name
);

-- name: GetCountryByCode :one
-- Returns English name if available, otherwise native name
-- Prefers common/official names over primary (which may contain multi-script concatenation)
SELECT
    co.id, co.code, co.code_iso3,
    COALESCE(
        (SELECT n.name FROM geo_names n
         WHERE n.entity_type = 'country' AND n.entity_id = co.id AND n.language_code = 'en'
         ORDER BY CASE n.name_type WHEN 'common' THEN 1 WHEN 'official' THEN 2 WHEN 'alternate' THEN 3 ELSE 4 END, n.id
         LIMIT 1),
        co.name
    ) as name,
    co.adm1_label, co.adm2_label, co.has_adm1, co.has_adm2, co.is_city_state,
    ct.id as continent_id, ct.code as continent_code, ct.name as continent
FROM geo_countries co
JOIN geo_continents ct ON co.continent_id = ct.id
WHERE co.code = $1;

-- name: GetCountryByID :one
-- Returns English name if available, otherwise native name
-- Prefers common/official names over primary (which may contain multi-script concatenation)
SELECT
    co.id, co.code, co.code_iso3,
    COALESCE(
        (SELECT n.name FROM geo_names n
         WHERE n.entity_type = 'country' AND n.entity_id = co.id AND n.language_code = 'en'
         ORDER BY CASE n.name_type WHEN 'common' THEN 1 WHEN 'official' THEN 2 WHEN 'alternate' THEN 3 ELSE 4 END, n.id
         LIMIT 1),
        co.name
    ) as name,
    co.adm1_label, co.adm2_label, co.has_adm1, co.has_adm2, co.is_city_state,
    ct.id as continent_id, ct.code as continent_code, ct.name as continent
FROM geo_countries co
JOIN geo_continents ct ON co.continent_id = ct.id
WHERE co.id = $1;

-- ============================================================================
-- Regions (ADM1)
-- ============================================================================

-- name: GetRegionsByCountry :many
-- Returns all regions for a country with their locality counts
-- Uses geo_search_index.inherited_region_id for accurate locality counts
SELECT r.id, r.code, r.name,
       (SELECT COUNT(*) FROM geo_search_index s
        WHERE s.entity_type = 'locality' AND s.inherited_region_id = r.id)::bigint as locality_count
FROM geo_regions r
JOIN geo_countries co ON r.country_id = co.id
WHERE co.code = $1
ORDER BY r.name;

-- name: GetRegionByID :one
SELECT
    r.id, r.code, r.name,
    co.id as country_id, co.code as country_code, co.name as country
FROM geo_regions r
JOIN geo_countries co ON r.country_id = co.id
WHERE r.id = $1;

-- name: SearchRegions :many
-- Search regions by name with locality counts
-- Uses geo_search_index.inherited_region_id for accurate locality counts
SELECT
    r.id, r.code, r.name,
    co.id as country_id, co.code as country_code, co.name as country,
    (SELECT COUNT(*) FROM geo_search_index s
     WHERE s.entity_type = 'locality' AND s.inherited_region_id = r.id)::bigint as locality_count
FROM geo_regions r
JOIN geo_countries co ON r.country_id = co.id
WHERE r.name ILIKE '%' || $1 || '%'
ORDER BY r.name
LIMIT $2;

-- ============================================================================
-- Insert/Update Operations
-- ============================================================================

-- name: InsertCountry :one
INSERT INTO geo_countries (code, code_iso3, name, continent_id, adm1_label, adm2_label, has_adm1, has_adm2, is_city_state)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id;

-- name: InsertRegion :one
INSERT INTO geo_regions (country_id, continent_id, code, name)
VALUES ($1, $2, $3, $4)
RETURNING id;

-- name: DeleteAllRegions :exec
DELETE FROM geo_regions;

-- name: DeleteAllCountries :exec
DELETE FROM geo_countries;

-- ============================================================================
-- Geolocation
-- ============================================================================

-- name: GetNearestLocality :one
-- Find the nearest locality to given coordinates using PostGIS
-- Returns English names if available, otherwise native names
-- Uses geo_search_index.inherited_region_id for region resolution
-- Coordinates resolved with priority: admin > default (system-wide only, no publisher context)
WITH best_coords AS (
    SELECT DISTINCT ON (ll.locality_id)
        ll.locality_id,
        ll.latitude,
        ll.longitude,
        ll.location
    FROM geo_locality_locations ll
    JOIN geo_data_sources ds ON ds.id = ll.source_id AND ds.is_active = true
    WHERE ll.publisher_id IS NULL  -- System-wide records only
    ORDER BY ll.locality_id,
             CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END,  -- admin > default
             ds.priority
),
best_elevs AS (
    SELECT DISTINCT ON (le.locality_id)
        le.locality_id,
        le.elevation_m
    FROM geo_locality_elevations le
    JOIN geo_data_sources ds ON ds.id = le.source_id AND ds.is_active = true
    WHERE le.publisher_id IS NULL  -- System-wide records only
    ORDER BY le.locality_id,
             CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END,  -- admin > default
             ds.priority
)
SELECT
    l.id, l.name,
    co.code as country_code, COALESCE(co_en.name, co.name) as country,
    s.inherited_region_id as region_id, r.code as region_code, CASE WHEN r.id IS NOT NULL THEN COALESCE(r_en.name, r.name) END as region,
    ct.code as continent_code, ct.name as continent,
    bc.latitude, bc.longitude, l.timezone,
    l.population, be.elevation_m,
    ST_Distance(bc.location, ST_SetSRID(ST_MakePoint(sqlc.arg('longitude')::float8, sqlc.arg('latitude')::float8), 4326)::geography)::float8 as distance_meters
FROM geo_localities l
JOIN best_coords bc ON bc.locality_id = l.id
LEFT JOIN best_elevs be ON be.locality_id = l.id
JOIN geo_countries co ON l.country_id = co.id
LEFT JOIN geo_names co_en ON co_en.entity_type = 'country' AND co_en.entity_id = co.id AND co_en.language_code = 'en'
JOIN geo_continents ct ON co.continent_id = ct.id
LEFT JOIN geo_search_index s ON s.entity_type = 'locality' AND s.entity_id = l.id
LEFT JOIN geo_regions r ON s.inherited_region_id = r.id
LEFT JOIN geo_names r_en ON r_en.entity_type = 'region' AND r_en.entity_id = r.id AND r_en.language_code = 'en'
ORDER BY bc.location <-> ST_SetSRID(ST_MakePoint(sqlc.arg('longitude')::float8, sqlc.arg('latitude')::float8), 4326)::geography
LIMIT 1;

-- ============================================================================
-- Location Picker
-- ============================================================================

-- name: GetTopLocalitiesAsLocations :many
-- Get top localities ordered by population for location picker
-- Coordinates resolved with priority: admin > default (system-wide only)
WITH best_coords AS (
    SELECT DISTINCT ON (ll.locality_id)
        ll.locality_id,
        ll.latitude,
        ll.longitude
    FROM geo_locality_locations ll
    JOIN geo_data_sources ds ON ds.id = ll.source_id AND ds.is_active = true
    WHERE ll.publisher_id IS NULL  -- System-wide records only
    ORDER BY ll.locality_id,
             CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END,  -- admin > default
             ds.priority
)
SELECT
    l.id, l.name,
    bc.latitude, bc.longitude, l.timezone
FROM geo_localities l
JOIN best_coords bc ON bc.locality_id = l.id
ORDER BY l.population DESC NULLS LAST, l.name
LIMIT $1;

-- ============================================================================
-- Boundary GeoJSON Queries (for map display)
-- ============================================================================

-- name: GetCountryBoundaryGeoJSON :one
-- Returns country boundary as GeoJSON geometry string
-- Returns empty string if no boundary exists
SELECT
    co.id, co.code, co.name,
    COALESCE(ST_AsGeoJSON(co.boundary)::text, '') as boundary_geojson,
    (co.boundary IS NOT NULL) as has_boundary
FROM geo_countries co
WHERE co.code = $1;

-- name: GetRegionBoundaryGeoJSON :one
-- Returns region boundary as GeoJSON geometry string
-- Returns empty string if no boundary exists
SELECT
    r.id, r.code, r.name,
    co.code as country_code, co.name as country_name,
    COALESCE(ST_AsGeoJSON(r.boundary)::text, '') as boundary_geojson,
    (r.boundary IS NOT NULL) as has_boundary
FROM geo_regions r
JOIN geo_countries co ON r.country_id = co.id
WHERE r.id = $1;

-- name: GetLocalityBoundaryGeoJSON :one
-- Returns locality boundary as GeoJSON geometry string (if exists)
-- Also returns point geometry as fallback
-- Coordinates resolved with priority: admin > default (system-wide only)
WITH best_coords AS (
    SELECT DISTINCT ON (ll.locality_id)
        ll.locality_id,
        ll.latitude,
        ll.longitude
    FROM geo_locality_locations ll
    JOIN geo_data_sources ds ON ds.id = ll.source_id AND ds.is_active = true
    WHERE ll.publisher_id IS NULL AND ll.locality_id = $1
    ORDER BY ll.locality_id,
             CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END,
             ds.priority
)
SELECT
    l.id, l.name,
    co.code as country_code, co.name as country_name,
    COALESCE(
        ST_AsGeoJSON(l.boundary)::text,
        CASE WHEN bc.latitude IS NOT NULL THEN
            '{"type":"Point","coordinates":[' || bc.longitude || ',' || bc.latitude || ']}'
        END
    ) as boundary_geojson,
    (l.boundary IS NOT NULL) as has_boundary,
    bc.latitude, bc.longitude, l.timezone
FROM geo_localities l
LEFT JOIN best_coords bc ON bc.locality_id = l.id
JOIN geo_countries co ON l.country_id = co.id
WHERE l.id = $1;
