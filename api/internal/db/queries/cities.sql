-- Cities SQL Queries (5-Level Hierarchy)
-- Continent -> Country -> Region (ADM1) -> District (ADM2) -> City

-- name: SearchCities :many
SELECT
    c.id, c.name, c.name_ascii,
    co.code as country_code, co.name as country,
    r.name as region, r.code as region_code,
    d.name as district, d.code as district_code,
    ct.code as continent_code, ct.name as continent,
    c.latitude, c.longitude, c.timezone,
    c.population, c.elevation_m, c.geonameid
FROM geo_cities c
JOIN geo_regions r ON c.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id
JOIN geo_continents ct ON co.continent_id = ct.id
LEFT JOIN geo_districts d ON c.district_id = d.id
WHERE 1=1
  AND (sqlc.narg('continent_code')::text IS NULL OR ct.code = sqlc.narg('continent_code'))
  AND (sqlc.narg('country_code')::text IS NULL OR co.code = sqlc.narg('country_code'))
  AND (sqlc.narg('region_code')::text IS NULL OR r.code = sqlc.narg('region_code'))
  AND (sqlc.narg('search_name')::text IS NULL OR c.name ILIKE '%' || sqlc.narg('search_name') || '%')
ORDER BY
  CASE WHEN COALESCE(sqlc.narg('order_by_country')::boolean, false) THEN co.name ELSE c.name END,
  CASE WHEN COALESCE(sqlc.narg('order_by_country')::boolean, false) THEN c.name ELSE co.name END,
  c.population DESC NULLS LAST
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountCities :one
SELECT COUNT(*)
FROM geo_cities c
JOIN geo_regions r ON c.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id
JOIN geo_continents ct ON co.continent_id = ct.id
WHERE 1=1
  AND (sqlc.narg('continent_code')::text IS NULL OR ct.code = sqlc.narg('continent_code'))
  AND (sqlc.narg('country_code')::text IS NULL OR co.code = sqlc.narg('country_code'))
  AND (sqlc.narg('region_code')::text IS NULL OR r.code = sqlc.narg('region_code'))
  AND (sqlc.narg('search_name')::text IS NULL OR c.name ILIKE '%' || sqlc.narg('search_name') || '%');

-- name: GetCityByID :one
SELECT
    c.id, c.name, c.name_ascii,
    co.id as country_id, c.region_id, c.district_id,
    co.code as country_code, co.name as country,
    r.name as region, r.code as region_code,
    d.name as district, d.code as district_code,
    ct.code as continent_code, ct.name as continent,
    c.latitude, c.longitude, c.timezone,
    c.population, c.elevation_m, c.geonameid
FROM geo_cities c
JOIN geo_regions r ON c.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id
JOIN geo_continents ct ON co.continent_id = ct.id
LEFT JOIN geo_districts d ON c.district_id = d.id
WHERE c.id = $1;

-- name: GetCityByName :one
SELECT
    c.id, c.name,
    co.code as country_code, co.name as country,
    r.name as region,
    ct.name as continent,
    c.latitude, c.longitude, c.timezone,
    c.population, c.elevation_m, c.geonameid
FROM geo_cities c
JOIN geo_regions r ON c.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id
JOIN geo_continents ct ON co.continent_id = ct.id
WHERE c.name = $1
LIMIT 1;

-- name: GetCityByGeonameID :one
SELECT
    c.id, c.name,
    co.code as country_code, co.name as country,
    r.name as region,
    ct.name as continent,
    c.latitude, c.longitude, c.timezone,
    c.population, c.elevation_m, c.geonameid
FROM geo_cities c
JOIN geo_regions r ON c.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id
JOIN geo_continents ct ON co.continent_id = ct.id
WHERE c.geonameid = $1
LIMIT 1;

-- name: ListCitiesByCountry :many
SELECT
    c.id, c.name,
    co.code as country_code, co.name as country,
    r.name as region,
    d.name as district,
    ct.name as continent,
    c.latitude, c.longitude, c.timezone,
    c.population, c.elevation_m, c.geonameid
FROM geo_cities c
JOIN geo_regions r ON c.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id
JOIN geo_continents ct ON co.continent_id = ct.id
LEFT JOIN geo_districts d ON c.district_id = d.id
WHERE co.code = $1
ORDER BY
  CASE WHEN COALESCE(sqlc.narg('order_by_region')::boolean, false) THEN r.name ELSE c.name END,
  CASE WHEN COALESCE(sqlc.narg('order_by_region')::boolean, false) THEN c.name ELSE r.name END,
  c.population DESC NULLS LAST
LIMIT $2;

-- name: ListCitiesByRegion :many
SELECT
    c.id, c.name,
    co.code as country_code, co.name as country,
    r.name as region, r.code as region_code,
    d.name as district,
    ct.name as continent,
    c.latitude, c.longitude, c.timezone,
    c.population, c.elevation_m, c.geonameid
FROM geo_cities c
JOIN geo_regions r ON c.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id
JOIN geo_continents ct ON co.continent_id = ct.id
LEFT JOIN geo_districts d ON c.district_id = d.id
WHERE r.id = $1
ORDER BY
  CASE WHEN COALESCE(sqlc.narg('order_by_district')::boolean, false) THEN COALESCE(d.name, '') ELSE c.name END,
  CASE WHEN COALESCE(sqlc.narg('order_by_district')::boolean, false) THEN c.name ELSE COALESCE(d.name, '') END,
  c.population DESC NULLS LAST
LIMIT $2;

-- name: ListCitiesByDistrict :many
SELECT
    c.id, c.name,
    co.code as country_code, co.name as country,
    r.name as region,
    d.name as district, d.code as district_code,
    ct.name as continent,
    c.latitude, c.longitude, c.timezone,
    c.population, c.elevation_m, c.geonameid
FROM geo_cities c
JOIN geo_regions r ON c.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id
JOIN geo_continents ct ON co.continent_id = ct.id
JOIN geo_districts d ON c.district_id = d.id
WHERE d.id = $1
ORDER BY c.name, c.population DESC NULLS LAST
LIMIT $2;

-- name: ListCitiesByContinent :many
SELECT
    c.id, c.name,
    co.code as country_code, co.name as country,
    r.name as region,
    ct.name as continent,
    c.latitude, c.longitude, c.timezone,
    c.population, c.elevation_m, c.geonameid
FROM geo_cities c
JOIN geo_regions r ON c.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id
JOIN geo_continents ct ON co.continent_id = ct.id
WHERE ct.code = $1
ORDER BY
  CASE WHEN COALESCE(sqlc.narg('order_by_country')::boolean, false) THEN co.name ELSE c.name END,
  CASE WHEN COALESCE(sqlc.narg('order_by_country')::boolean, false) THEN c.name ELSE co.name END,
  c.population DESC NULLS LAST
LIMIT $2 OFFSET $3;

-- ============================================================================
-- Continents
-- ============================================================================

-- name: GetContinents :many
SELECT ct.id, ct.code, ct.name, COUNT(c.id) as city_count
FROM geo_continents ct
LEFT JOIN geo_countries co ON co.continent_id = ct.id
LEFT JOIN geo_regions r ON r.country_id = co.id
LEFT JOIN geo_cities c ON c.region_id = r.id
GROUP BY ct.id, ct.code, ct.name
ORDER BY ct.name;

-- ============================================================================
-- Countries
-- ============================================================================

-- name: GetCountries :many
SELECT
    co.id, co.code as country_code, co.code_iso3, co.name as country,
    co.adm1_label, co.adm2_label, co.has_adm1, co.has_adm2, co.is_city_state,
    ct.code as continent_code, ct.name as continent
FROM geo_countries co
JOIN geo_continents ct ON co.continent_id = ct.id
ORDER BY co.name;

-- name: GetCountriesByContinent :many
SELECT
    co.id, co.code as country_code, co.name as country,
    co.adm1_label, co.adm2_label, co.has_adm1, co.has_adm2,
    COUNT(c.id) as city_count
FROM geo_countries co
JOIN geo_continents ct ON co.continent_id = ct.id
LEFT JOIN geo_regions r ON r.country_id = co.id
LEFT JOIN geo_cities c ON c.region_id = r.id
WHERE ct.code = $1
GROUP BY co.id, co.code, co.name, co.adm1_label, co.adm2_label, co.has_adm1, co.has_adm2
ORDER BY co.name;

-- name: GetCountryByCode :one
SELECT
    co.id, co.code, co.code_iso3, co.name,
    co.adm1_label, co.adm2_label, co.has_adm1, co.has_adm2, co.is_city_state,
    ct.id as continent_id, ct.code as continent_code, ct.name as continent
FROM geo_countries co
JOIN geo_continents ct ON co.continent_id = ct.id
WHERE co.code = $1;

-- name: GetCountryByID :one
SELECT
    co.id, co.code, co.code_iso3, co.name,
    co.adm1_label, co.adm2_label, co.has_adm1, co.has_adm2, co.is_city_state,
    ct.id as continent_id, ct.code as continent_code, ct.name as continent
FROM geo_countries co
JOIN geo_continents ct ON co.continent_id = ct.id
WHERE co.id = $1;

-- ============================================================================
-- Regions (ADM1)
-- ============================================================================

-- name: GetRegionsByCountry :many
SELECT r.id, r.code, r.name
FROM geo_regions r
JOIN geo_countries co ON r.country_id = co.id
WHERE co.code = $1
ORDER BY r.name;

-- name: GetRegionsByCountryID :many
SELECT r.id, r.code, r.name
FROM geo_regions r
WHERE r.country_id = $1
ORDER BY r.name;

-- name: GetRegionByID :one
SELECT
    r.id, r.code, r.name,
    co.id as country_id, co.code as country_code, co.name as country
FROM geo_regions r
JOIN geo_countries co ON r.country_id = co.id
WHERE r.id = $1;

-- name: GetRegionByCountryAndCode :one
SELECT r.id, r.country_id, r.code, r.name
FROM geo_regions r
JOIN geo_countries co ON r.country_id = co.id
WHERE co.code = $1 AND r.code = $2;

-- name: SearchRegions :many
SELECT
    r.id, r.code, r.name,
    co.id as country_id, co.code as country_code, co.name as country,
    COUNT(c.id) as city_count
FROM geo_regions r
JOIN geo_countries co ON r.country_id = co.id
LEFT JOIN geo_cities c ON c.region_id = r.id
WHERE r.name ILIKE '%' || $1 || '%'
GROUP BY r.id, r.code, r.name, co.id, co.code, co.name
ORDER BY r.name
LIMIT $2;

-- ============================================================================
-- Districts (ADM2)
-- ============================================================================

-- name: GetDistrictsByRegion :many
SELECT d.id, d.code, d.name
FROM geo_districts d
WHERE d.region_id = sqlc.arg('region_id')::int
ORDER BY d.name;

-- name: GetDistrictsByCountry :many
SELECT
    d.id, d.code, d.name,
    r.id as region_id, r.code as region_code, r.name as region
FROM geo_districts d
JOIN geo_regions r ON d.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id
WHERE co.code = $1
ORDER BY r.name, d.name;

-- name: GetDistrictByID :one
SELECT
    d.id, d.code, d.name,
    r.id as region_id, r.code as region_code, r.name as region,
    co.id as country_id, co.code as country_code, co.name as country
FROM geo_districts d
JOIN geo_regions r ON d.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id
WHERE d.id = $1;

-- name: GetDistrictByRegionAndCode :one
SELECT d.id, d.region_id, d.code, d.name
FROM geo_districts d
WHERE d.region_id = $1 AND d.code = $2;

-- name: SearchDistricts :many
SELECT
    d.id, d.code, d.name,
    r.id as region_id, r.code as region_code, r.name as region,
    co.id as country_id, co.code as country_code, co.name as country,
    COUNT(c.id) as city_count
FROM geo_districts d
JOIN geo_regions r ON d.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id
LEFT JOIN geo_cities c ON c.district_id = d.id
WHERE d.name ILIKE '%' || $1 || '%'
GROUP BY d.id, d.code, d.name, r.id, r.code, r.name, co.id, co.code, co.name
ORDER BY d.name
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

-- name: InsertDistrict :one
INSERT INTO geo_districts (region_id, continent_id, country_id, code, name)
VALUES ($1, $2, $3, $4, $5)
RETURNING id;

-- name: InsertCity :one
INSERT INTO geo_cities (region_id, district_id, name, name_ascii, latitude, longitude, timezone, elevation_m, population, geonameid)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING id;

-- name: UpsertCity :one
INSERT INTO geo_cities (region_id, district_id, name, name_ascii, latitude, longitude, timezone, elevation_m, population, geonameid)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (geonameid) DO UPDATE SET
    region_id = EXCLUDED.region_id,
    district_id = EXCLUDED.district_id,
    name = EXCLUDED.name,
    name_ascii = EXCLUDED.name_ascii,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    timezone = EXCLUDED.timezone,
    elevation_m = EXCLUDED.elevation_m,
    population = EXCLUDED.population,
    updated_at = now()
RETURNING id;

-- name: UpdateCityHierarchy :exec
UPDATE geo_cities
SET region_id = $2, district_id = $3, updated_at = now()
WHERE id = $1;

-- name: DeleteAllCities :exec
DELETE FROM geo_cities;

-- name: DeleteAllDistricts :exec
DELETE FROM geo_districts;

-- name: DeleteAllRegions :exec
DELETE FROM geo_regions;

-- name: DeleteAllCountries :exec
DELETE FROM geo_countries;

-- ============================================================================
-- Coverage Helpers
-- ============================================================================

-- name: GetCitiesForCoverage :many
SELECT
    c.id, c.name,
    co.code as country_code, co.name as country,
    r.name as region,
    d.name as district,
    c.latitude, c.longitude, c.timezone, c.elevation_m
FROM geo_cities c
JOIN geo_regions r ON c.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id
LEFT JOIN geo_districts d ON c.district_id = d.id
WHERE co.code = $1
  AND ($2::integer IS NULL OR r.id = $2)
  AND ($3::integer IS NULL OR d.id = $3)
ORDER BY c.name;

-- name: GetNearestCity :one
-- Find the nearest city to given coordinates using PostGIS
SELECT
    c.id, c.name, c.name_ascii,
    co.code as country_code, co.name as country,
    r.id as region_id, r.code as region_code, r.name as region,
    d.id as district_id, d.code as district_code, d.name as district,
    ct.code as continent_code, ct.name as continent,
    c.latitude, c.longitude, c.timezone,
    c.population, c.elevation_m,
    ST_Distance(c.location, ST_SetSRID(ST_MakePoint(sqlc.arg('longitude')::float8, sqlc.arg('latitude')::float8), 4326)::geography)::float8 as distance_meters
FROM geo_cities c
JOIN geo_regions r ON c.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id
JOIN geo_continents ct ON co.continent_id = ct.id
LEFT JOIN geo_districts d ON c.district_id = d.id
ORDER BY c.location <-> ST_SetSRID(ST_MakePoint(sqlc.arg('longitude')::float8, sqlc.arg('latitude')::float8), 4326)::geography
LIMIT 1;

-- name: SearchCitiesFuzzy :many
-- Search cities with fuzzy matching using pg_trgm
SELECT
    c.id, c.name, c.name_ascii,
    co.code as country_code, co.name as country,
    r.id as region_id, r.code as region_code, r.name as region,
    d.id as district_id, d.code as district_code, d.name as district,
    ct.code as continent_code, ct.name as continent,
    c.latitude, c.longitude, c.timezone,
    c.population, c.elevation_m
FROM geo_cities c
JOIN geo_regions r ON c.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id
JOIN geo_continents ct ON co.continent_id = ct.id
LEFT JOIN geo_districts d ON c.district_id = d.id
WHERE
    (sqlc.narg('continent_code')::text IS NULL OR ct.code = sqlc.narg('continent_code'))
    AND (sqlc.narg('country_code')::text IS NULL OR co.code = sqlc.narg('country_code'))
    AND (sqlc.narg('region_code')::text IS NULL OR r.code = sqlc.narg('region_code'))
    AND (
        c.name_ascii ILIKE sqlc.arg('search') || '%'
        OR c.name ILIKE sqlc.arg('search') || '%'
        OR c.name_ascii % sqlc.arg('search')
        OR c.name % sqlc.arg('search')
    )
ORDER BY
    CASE WHEN c.name_ascii ILIKE sqlc.arg('search') || '%' THEN 0
         WHEN c.name ILIKE sqlc.arg('search') || '%' THEN 1
         ELSE 2 END,
    CASE WHEN COALESCE(sqlc.narg('order_by_country')::boolean, false) THEN co.name ELSE c.name END,
    CASE WHEN COALESCE(sqlc.narg('order_by_country')::boolean, false) THEN c.name ELSE co.name END,
    similarity(c.name_ascii, sqlc.arg('search')) DESC,
    c.population DESC NULLS LAST
LIMIT sqlc.arg('limit');

-- name: GetTopCitiesAsLocations :many
-- Get top cities ordered by population for location picker
SELECT
    c.id, c.name,
    c.latitude, c.longitude, c.timezone
FROM geo_cities c
ORDER BY c.population DESC NULLS LAST, c.name
LIMIT $1;

-- ============================================================================
-- Unified Coverage Search
-- ============================================================================

-- name: SearchCoverageUnified :many
-- Ultra-fast coverage search using pre-computed materialized view
-- Uses GIN trigram indexes for instant fuzzy matching
-- Performance: Single table scan with indexed lookups, no JOINs at query time
SELECT
    coverage_type,
    id,
    name,
    description,
    country_code
FROM coverage_search_mv
WHERE
    -- Primary: Prefix match (fastest, uses text_pattern_ops index)
    lower(name_ascii) LIKE lower(sqlc.arg('search')::text) || '%'
    -- Secondary: High-similarity fuzzy match (uses trigram GIN index)
    OR (similarity(name_ascii, sqlc.arg('search')::text) > 0.3 AND name_ascii % sqlc.arg('search')::text)
ORDER BY
    -- Prefix matches first (exact starts-with)
    CASE
        WHEN lower(name_ascii) LIKE lower(sqlc.arg('search')::text) || '%' THEN 0
        ELSE 1
    END,
    -- Then by type priority (city, district, region, country, continent)
    type_priority,
    -- Then by similarity score (higher = better match)
    similarity(name_ascii, sqlc.arg('search')::text) DESC,
    -- Then by population (for cities)
    sort_population DESC,
    -- Finally alphabetically
    name
LIMIT sqlc.arg('limit');

-- name: SearchCoverageByLevels :many
-- Coverage search with level filtering for search-first UI
-- Pass levels as comma-separated string (e.g., 'city,region,country')
-- Empty levels string returns all types
SELECT
    coverage_type,
    id,
    name,
    description,
    country_code
FROM coverage_search_mv
WHERE
    -- Level filter: if levels is empty/null, include all; otherwise filter
    (
        sqlc.arg('levels')::text = ''
        OR coverage_type = ANY(string_to_array(sqlc.arg('levels')::text, ','))
    )
    AND (
        -- Primary: Prefix match (fastest, uses text_pattern_ops index)
        lower(name_ascii) LIKE lower(sqlc.arg('search')::text) || '%'
        -- Secondary: Substring match (contains search term anywhere)
        OR lower(name_ascii) LIKE '%' || lower(sqlc.arg('search')::text) || '%'
        -- Tertiary: High-similarity fuzzy match (uses trigram GIN index)
        OR (similarity(name_ascii, sqlc.arg('search')::text) > 0.3 AND name_ascii % sqlc.arg('search')::text)
    )
ORDER BY
    -- Match quality: Exact > Prefix > Substring > Fuzzy
    CASE
        WHEN lower(name_ascii) = lower(sqlc.arg('search')::text) THEN 0
        WHEN lower(name_ascii) LIKE lower(sqlc.arg('search')::text) || '%' THEN 1
        WHEN lower(name_ascii) LIKE '%' || lower(sqlc.arg('search')::text) || '%' THEN 2
        ELSE 3
    END,
    -- Similarity score (higher = better match)
    similarity(name_ascii, sqlc.arg('search')::text) DESC,
    -- Interleaved ranking: for high-similarity matches, mix types together
    -- This ensures users see regions/districts alongside cities for same name
    -- Formula: (type_priority * 0.5) - (population_boost)
    -- Result: High-pop regions can rank between cities of similar names
    (type_priority::float * 0.5) - (LEAST(sort_population, 10000000)::float / 20000000.0),
    -- Alphabetically for final ties
    name
LIMIT sqlc.arg('limit');
