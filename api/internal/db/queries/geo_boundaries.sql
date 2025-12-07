-- Geo Boundaries SQL Queries (5-Level Hierarchy)
-- Supports boundaries for: countries, regions (ADM1), districts (ADM2)

-- ============================================================================
-- Country Boundaries (ADM0)
-- ============================================================================

-- name: GetAllCountryBoundaries :many
SELECT
    c.id,
    c.code,
    c.name,
    c.adm1_label,
    c.adm2_label,
    c.has_adm1,
    c.has_adm2,
    ct.code as continent_code,
    ct.name as continent_name,
    cb.area_km2,
    ST_AsGeoJSON(COALESCE(cb.boundary_simplified, cb.boundary))::text as boundary_geojson,
    ST_X(cb.centroid::geometry) as centroid_lng,
    ST_Y(cb.centroid::geometry) as centroid_lat
FROM geo_country_boundaries cb
JOIN geo_countries c ON cb.country_id = c.id
JOIN geo_continents ct ON c.continent_id = ct.id
ORDER BY c.name;

-- name: GetCountryBoundariesByContinent :many
SELECT
    c.id,
    c.code,
    c.name,
    c.adm1_label,
    c.adm2_label,
    c.has_adm1,
    c.has_adm2,
    ct.code as continent_code,
    ct.name as continent_name,
    cb.area_km2,
    ST_AsGeoJSON(COALESCE(cb.boundary_simplified, cb.boundary))::text as boundary_geojson,
    ST_X(cb.centroid::geometry) as centroid_lng,
    ST_Y(cb.centroid::geometry) as centroid_lat
FROM geo_country_boundaries cb
JOIN geo_countries c ON cb.country_id = c.id
JOIN geo_continents ct ON c.continent_id = ct.id
WHERE ct.code = $1
ORDER BY c.name;

-- name: GetCountryBoundaryByCode :one
SELECT
    c.id,
    c.code,
    c.name,
    c.adm1_label,
    c.adm2_label,
    c.has_adm1,
    c.has_adm2,
    ct.code as continent_code,
    ct.name as continent_name,
    cb.area_km2,
    ST_AsGeoJSON(cb.boundary)::text as boundary_geojson,
    ST_X(cb.centroid::geometry) as centroid_lng,
    ST_Y(cb.centroid::geometry) as centroid_lat
FROM geo_country_boundaries cb
JOIN geo_countries c ON cb.country_id = c.id
JOIN geo_continents ct ON c.continent_id = ct.id
WHERE c.code = $1;

-- name: GetCountryBoundaryByID :one
SELECT
    c.id,
    c.code,
    c.name,
    cb.area_km2,
    ST_AsGeoJSON(cb.boundary)::text as boundary_geojson,
    ST_X(cb.centroid::geometry) as centroid_lng,
    ST_Y(cb.centroid::geometry) as centroid_lat
FROM geo_country_boundaries cb
JOIN geo_countries c ON cb.country_id = c.id
WHERE c.id = $1;

-- ============================================================================
-- Region Boundaries (ADM1)
-- ============================================================================

-- name: GetRegionBoundariesByCountry :many
SELECT
    r.id,
    r.name,
    r.code,
    c.code as country_code,
    c.name as country_name,
    rb.area_km2,
    ST_AsGeoJSON(COALESCE(rb.boundary_simplified, rb.boundary))::text as boundary_geojson,
    ST_X(rb.centroid::geometry) as centroid_lng,
    ST_Y(rb.centroid::geometry) as centroid_lat
FROM geo_region_boundaries rb
JOIN geo_regions r ON rb.region_id = r.id
JOIN geo_countries c ON r.country_id = c.id
WHERE c.code = $1
ORDER BY r.name;

-- name: GetRegionBoundaryByID :one
SELECT
    r.id,
    r.name,
    r.code,
    c.code as country_code,
    c.name as country_name,
    rb.area_km2,
    ST_AsGeoJSON(rb.boundary)::text as boundary_geojson,
    ST_X(rb.centroid::geometry) as centroid_lng,
    ST_Y(rb.centroid::geometry) as centroid_lat
FROM geo_region_boundaries rb
JOIN geo_regions r ON rb.region_id = r.id
JOIN geo_countries c ON r.country_id = c.id
WHERE r.id = $1;

-- name: GetRegionBoundaryByCode :one
SELECT
    r.id,
    r.name,
    r.code,
    c.code as country_code,
    c.name as country_name,
    rb.area_km2,
    ST_AsGeoJSON(rb.boundary)::text as boundary_geojson,
    ST_X(rb.centroid::geometry) as centroid_lng,
    ST_Y(rb.centroid::geometry) as centroid_lat
FROM geo_region_boundaries rb
JOIN geo_regions r ON rb.region_id = r.id
JOIN geo_countries c ON r.country_id = c.id
WHERE c.code = $1 AND r.code = $2;

-- ============================================================================
-- District Boundaries (ADM2)
-- ============================================================================

-- name: GetDistrictBoundariesByCountry :many
SELECT
    d.id,
    d.name,
    d.code,
    r.id as region_id,
    r.code as region_code,
    r.name as region_name,
    c.code as country_code,
    db.area_km2,
    ST_AsGeoJSON(COALESCE(db.boundary_simplified, db.boundary))::text as boundary_geojson,
    ST_X(db.centroid::geometry) as centroid_lng,
    ST_Y(db.centroid::geometry) as centroid_lat
FROM geo_district_boundaries db
JOIN geo_districts d ON db.district_id = d.id
JOIN geo_regions r ON d.region_id = r.id
JOIN geo_countries c ON r.country_id = c.id
WHERE c.code = $1
ORDER BY r.name, d.name;

-- name: GetDistrictBoundariesByRegion :many
SELECT
    d.id,
    d.name,
    d.code,
    r.code as region_code,
    r.name as region_name,
    db.area_km2,
    ST_AsGeoJSON(COALESCE(db.boundary_simplified, db.boundary))::text as boundary_geojson,
    ST_X(db.centroid::geometry) as centroid_lng,
    ST_Y(db.centroid::geometry) as centroid_lat
FROM geo_district_boundaries db
JOIN geo_districts d ON db.district_id = d.id
JOIN geo_regions r ON d.region_id = r.id
WHERE r.id = $1
ORDER BY d.name;

-- name: GetDistrictBoundaryByID :one
SELECT
    d.id,
    d.name,
    d.code,
    r.id as region_id,
    r.code as region_code,
    r.name as region_name,
    c.code as country_code,
    c.name as country_name,
    db.area_km2,
    ST_AsGeoJSON(db.boundary)::text as boundary_geojson,
    ST_X(db.centroid::geometry) as centroid_lng,
    ST_Y(db.centroid::geometry) as centroid_lat
FROM geo_district_boundaries db
JOIN geo_districts d ON db.district_id = d.id
JOIN geo_regions r ON d.region_id = r.id
JOIN geo_countries c ON r.country_id = c.id
WHERE d.id = $1;

-- ============================================================================
-- Point-in-Polygon Lookups
-- ============================================================================

-- name: LookupCountryByPoint :one
SELECT
    c.id,
    c.code,
    c.name,
    c.adm1_label,
    c.adm2_label,
    c.has_adm1,
    c.has_adm2
FROM geo_countries c
JOIN geo_country_boundaries cb ON c.id = cb.country_id
WHERE ST_Contains(cb.boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
LIMIT 1;

-- name: LookupRegionByPoint :one
SELECT
    r.id,
    r.name,
    r.code,
    c.id as country_id,
    c.code as country_code
FROM geo_regions r
JOIN geo_region_boundaries rb ON r.id = rb.region_id
JOIN geo_countries c ON r.country_id = c.id
WHERE ST_Contains(rb.boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
LIMIT 1;

-- name: LookupDistrictByPoint :one
SELECT
    d.id,
    d.name,
    d.code,
    r.id as region_id,
    r.code as region_code,
    r.name as region_name,
    c.id as country_id,
    c.code as country_code
FROM geo_districts d
JOIN geo_district_boundaries db ON d.id = db.district_id
JOIN geo_regions r ON d.region_id = r.id
JOIN geo_countries c ON r.country_id = c.id
WHERE ST_Contains(db.boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
LIMIT 1;

-- name: LookupAllLevelsByPoint :one
-- Returns all geographic levels for a point (country, region, district)
SELECT
    c.id as country_id,
    c.code as country_code,
    c.name as country_name,
    c.adm1_label,
    c.adm2_label,
    r.id as region_id,
    r.code as region_code,
    r.name as region_name,
    d.id as district_id,
    d.code as district_code,
    d.name as district_name
FROM geo_countries c
JOIN geo_country_boundaries cb ON c.id = cb.country_id
LEFT JOIN geo_region_boundaries rb ON ST_Contains(rb.boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
LEFT JOIN geo_regions r ON rb.region_id = r.id AND r.country_id = c.id
LEFT JOIN geo_district_boundaries db ON ST_Contains(db.boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
LEFT JOIN geo_districts d ON db.district_id = d.id AND d.region_id = r.id
WHERE ST_Contains(cb.boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
LIMIT 1;

-- name: LookupAllLevelsByPointWithArea :one
-- Returns all geographic levels for a point with area information for zoom-based selection
SELECT
    -- Country
    c.id as country_id,
    c.code as country_code,
    c.name as country_name,
    c.adm1_label,
    c.adm2_label,
    c.has_adm1,
    c.has_adm2,
    c.is_city_state,
    cb.area_km2 as country_area_km2,
    -- Region
    r.id as region_id,
    r.code as region_code,
    r.name as region_name,
    rb.area_km2 as region_area_km2,
    -- District
    d.id as district_id,
    d.code as district_code,
    d.name as district_name,
    db.area_km2 as district_area_km2
FROM geo_countries c
JOIN geo_country_boundaries cb ON c.id = cb.country_id
LEFT JOIN geo_region_boundaries rb ON ST_Contains(rb.boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
LEFT JOIN geo_regions r ON rb.region_id = r.id AND r.country_id = c.id
LEFT JOIN geo_district_boundaries db ON ST_Contains(db.boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
LEFT JOIN geo_districts d ON db.district_id = d.id AND d.region_id = r.id
WHERE ST_Contains(cb.boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
LIMIT 1;

-- name: LookupNearestCities :many
SELECT
    c.id,
    c.name,
    co.code as country_code,
    r.name as region_name,
    d.name as district_name,
    ST_Distance(c.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 as distance_km
FROM geo_cities c
JOIN geo_regions r ON c.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id
LEFT JOIN geo_districts d ON c.district_id = d.id
WHERE ST_DWithin(c.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
ORDER BY c.location <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
LIMIT $4;

-- ============================================================================
-- Boundary Management (for import scripts)
-- ============================================================================

-- name: UpsertCountryBoundary :exec
INSERT INTO geo_country_boundaries (country_id, boundary, boundary_simplified, area_km2, centroid)
VALUES (
    $1,
    ST_GeomFromGeoJSON($2)::geography,
    CASE WHEN $3::text IS NOT NULL THEN ST_GeomFromGeoJSON($3)::geography ELSE NULL END,
    $4,
    ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography
)
ON CONFLICT (country_id) DO UPDATE SET
    boundary = ST_GeomFromGeoJSON($2)::geography,
    boundary_simplified = CASE WHEN $3::text IS NOT NULL THEN ST_GeomFromGeoJSON($3)::geography ELSE geo_country_boundaries.boundary_simplified END,
    area_km2 = $4,
    centroid = ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
    updated_at = now();

-- name: UpsertRegionBoundary :exec
INSERT INTO geo_region_boundaries (region_id, boundary, boundary_simplified, area_km2, centroid)
VALUES (
    $1,
    ST_GeomFromGeoJSON($2)::geography,
    CASE WHEN $3::text IS NOT NULL THEN ST_GeomFromGeoJSON($3)::geography ELSE NULL END,
    $4,
    ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography
)
ON CONFLICT (region_id) DO UPDATE SET
    boundary = ST_GeomFromGeoJSON($2)::geography,
    boundary_simplified = CASE WHEN $3::text IS NOT NULL THEN ST_GeomFromGeoJSON($3)::geography ELSE geo_region_boundaries.boundary_simplified END,
    area_km2 = $4,
    centroid = ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
    updated_at = now();

-- name: UpsertDistrictBoundary :exec
INSERT INTO geo_district_boundaries (district_id, boundary, boundary_simplified, area_km2, centroid)
VALUES (
    $1,
    ST_GeomFromGeoJSON($2)::geography,
    CASE WHEN $3::text IS NOT NULL THEN ST_GeomFromGeoJSON($3)::geography ELSE NULL END,
    $4,
    ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography
)
ON CONFLICT (district_id) DO UPDATE SET
    boundary = ST_GeomFromGeoJSON($2)::geography,
    boundary_simplified = CASE WHEN $3::text IS NOT NULL THEN ST_GeomFromGeoJSON($3)::geography ELSE geo_district_boundaries.boundary_simplified END,
    area_km2 = $4,
    centroid = ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
    updated_at = now();

-- name: DeleteCountryBoundary :exec
DELETE FROM geo_country_boundaries WHERE country_id = $1;

-- name: DeleteRegionBoundary :exec
DELETE FROM geo_region_boundaries WHERE region_id = $1;

-- name: DeleteDistrictBoundary :exec
DELETE FROM geo_district_boundaries WHERE district_id = $1;

-- name: DeleteAllCountryBoundaries :exec
DELETE FROM geo_country_boundaries;

-- name: DeleteAllRegionBoundaries :exec
DELETE FROM geo_region_boundaries;

-- name: DeleteAllDistrictBoundaries :exec
DELETE FROM geo_district_boundaries;

-- name: DeleteAllCityBoundaries :exec
DELETE FROM geo_city_boundaries;

-- ============================================================================
-- City Boundaries (Localities)
-- ============================================================================

-- name: UpsertCityBoundary :exec
INSERT INTO geo_city_boundaries (city_id, boundary, boundary_simplified, area_km2)
VALUES (
    $1,
    ST_GeomFromGeoJSON($2)::geography,
    CASE WHEN $3::text IS NOT NULL THEN ST_GeomFromGeoJSON($3)::geography ELSE NULL END,
    $4
)
ON CONFLICT (city_id) DO UPDATE SET
    boundary = ST_GeomFromGeoJSON($2)::geography,
    boundary_simplified = CASE WHEN $3::text IS NOT NULL THEN ST_GeomFromGeoJSON($3)::geography ELSE geo_city_boundaries.boundary_simplified END,
    area_km2 = $4,
    updated_at = now();

-- name: GetCityBoundaryByID :one
SELECT
    c.id,
    c.name,
    co.code as country_code,
    r.name as region_name,
    d.name as district_name,
    cb.area_km2,
    ST_AsGeoJSON(cb.boundary)::text as boundary_geojson
FROM geo_city_boundaries cb
JOIN geo_cities c ON cb.city_id = c.id
JOIN geo_countries co ON c.country_id = co.id
LEFT JOIN geo_regions r ON c.region_id = r.id
LEFT JOIN geo_districts d ON c.district_id = d.id
WHERE c.id = $1;

-- name: CountCityBoundaries :one
SELECT COUNT(*) FROM geo_city_boundaries;

-- ============================================================================
-- Import Tracking
-- ============================================================================

-- name: CreateBoundaryImport :one
INSERT INTO geo_boundary_imports (source_id, level_id, country_code, version, records_imported, records_matched, records_unmatched, notes)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id;

-- name: GetLatestBoundaryImport :one
SELECT
    bi.id,
    ds.key as source,
    lv.key as level,
    bi.country_code,
    bi.version,
    bi.imported_at,
    bi.records_imported,
    bi.records_matched,
    bi.records_unmatched,
    bi.notes
FROM geo_boundary_imports bi
JOIN geo_data_sources ds ON bi.source_id = ds.id
JOIN geo_levels lv ON bi.level_id = lv.id
ORDER BY bi.imported_at DESC
LIMIT 1;

-- name: GetBoundaryImportsByLevel :many
SELECT
    bi.id,
    ds.key as source,
    lv.key as level,
    bi.country_code,
    bi.version,
    bi.imported_at,
    bi.records_imported,
    bi.records_matched,
    bi.records_unmatched,
    bi.notes
FROM geo_boundary_imports bi
JOIN geo_data_sources ds ON bi.source_id = ds.id
JOIN geo_levels lv ON bi.level_id = lv.id
WHERE bi.level_id = $1
ORDER BY bi.imported_at DESC;

-- ============================================================================
-- Name Mappings
-- ============================================================================

-- name: GetNameMapping :one
SELECT
    nm.id,
    lv.key as level,
    ds.key as source,
    nm.source_name,
    nm.source_country_code,
    nm.target_id,
    nm.notes
FROM geo_name_mappings nm
JOIN geo_levels lv ON nm.level_id = lv.id
JOIN geo_data_sources ds ON nm.source_id = ds.id
WHERE nm.level_id = $1 AND nm.source_id = $2 AND nm.source_name = $3
  AND (nm.source_country_code = $4 OR (nm.source_country_code IS NULL AND $4 IS NULL));

-- name: UpsertNameMapping :exec
INSERT INTO geo_name_mappings (level_id, source_id, source_name, source_country_code, target_id, notes)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (level_id, source_id, source_name, source_country_code) DO UPDATE SET
    target_id = $5,
    notes = $6;

-- name: GetNameMappingsByLevel :many
SELECT
    nm.id,
    lv.key as level,
    ds.key as source,
    nm.source_name,
    nm.source_country_code,
    nm.target_id,
    nm.notes
FROM geo_name_mappings nm
JOIN geo_levels lv ON nm.level_id = lv.id
JOIN geo_data_sources ds ON nm.source_id = ds.id
WHERE nm.level_id = $1
ORDER BY nm.source_name;

-- ============================================================================
-- Statistics
-- ============================================================================

-- name: CountCountryBoundaries :one
SELECT COUNT(*) FROM geo_country_boundaries;

-- name: CountRegionBoundaries :one
SELECT COUNT(*) FROM geo_region_boundaries;

-- name: CountDistrictBoundaries :one
SELECT COUNT(*) FROM geo_district_boundaries;

-- name: GetCountriesWithoutBoundaries :many
SELECT c.id, c.code, c.name
FROM geo_countries c
LEFT JOIN geo_country_boundaries cb ON c.id = cb.country_id
WHERE cb.country_id IS NULL
ORDER BY c.name;

-- name: GetRegionsWithoutBoundaries :many
SELECT r.id, r.code, r.name, c.code as country_code
FROM geo_regions r
JOIN geo_countries c ON r.country_id = c.id
LEFT JOIN geo_region_boundaries rb ON r.id = rb.region_id
WHERE rb.region_id IS NULL AND c.code = $1
ORDER BY r.name;

-- name: GetDistrictsWithoutBoundaries :many
SELECT d.id, d.code, d.name, r.code as region_code, c.code as country_code
FROM geo_districts d
JOIN geo_regions r ON d.region_id = r.id
JOIN geo_countries c ON r.country_id = c.id
LEFT JOIN geo_district_boundaries db ON d.id = db.district_id
WHERE db.district_id IS NULL AND c.code = $1
ORDER BY r.name, d.name;

-- name: GetBoundaryStats :one
SELECT
    (SELECT COUNT(*) FROM geo_countries) as total_countries,
    (SELECT COUNT(*) FROM geo_country_boundaries) as countries_with_boundaries,
    (SELECT COUNT(*) FROM geo_regions) as total_regions,
    (SELECT COUNT(*) FROM geo_region_boundaries) as regions_with_boundaries,
    (SELECT COUNT(*) FROM geo_districts) as total_districts,
    (SELECT COUNT(*) FROM geo_district_boundaries) as districts_with_boundaries;

-- ============================================================================
-- Hierarchy Assignment (Point-in-Polygon)
-- ============================================================================

-- name: AssignAllCityHierarchy :many
-- Assigns cities to countries/regions/districts based on point-in-polygon
SELECT * FROM assign_all_city_hierarchy();

-- name: AssignCitiesToCountries :one
SELECT * FROM assign_cities_to_countries();

-- name: AssignCitiesToRegions :one
SELECT * FROM assign_cities_to_regions();

-- name: AssignCitiesToDistricts :one
SELECT * FROM assign_cities_to_districts();

-- name: ValidateAllCityHierarchy :many
-- Returns any cities with hierarchy issues
SELECT * FROM validate_all_city_hierarchy();

-- name: GetCityHierarchyStats :one
-- Get statistics on city hierarchy assignments
-- Note: country derived via city.region_id → region.country_id (region_id is NOT NULL)
SELECT
    (SELECT COUNT(*) FROM geo_cities) as total_cities,
    (SELECT COUNT(*) FROM geo_cities) as cities_with_country,  -- All cities have country via region
    (SELECT COUNT(*) FROM geo_cities WHERE region_id IS NOT NULL) as cities_with_region,
    (SELECT COUNT(*) FROM geo_cities WHERE district_id IS NOT NULL) as cities_with_district,
    (SELECT COUNT(*) FROM geo_cities c
     JOIN geo_regions r ON c.region_id = r.id
     JOIN geo_countries co ON r.country_id = co.id
     WHERE co.has_adm1 = true AND c.region_id IS NULL) as missing_region,
    (SELECT COUNT(*) FROM geo_cities c
     JOIN geo_regions r ON c.region_id = r.id
     JOIN geo_countries co ON r.country_id = co.id
     WHERE co.has_adm2 = true AND c.district_id IS NULL) as missing_district;
