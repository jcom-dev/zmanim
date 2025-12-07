-- Coverage SQL Queries (5-Level Hierarchy)
-- Supports: continent, country, region, district, city

-- name: GetPublisherCoverage :many
SELECT
    pc.id, pc.publisher_id, pc.coverage_level_id,
    cl.key as coverage_level_key,
    cl.display_name_hebrew as coverage_level_display_hebrew,
    cl.display_name_english as coverage_level_display_english,
    pc.continent_id, pc.country_id, pc.region_id, pc.district_id, pc.city_id,
    pc.priority, pc.is_active, pc.created_at, pc.updated_at,
    -- Resolved names
    ct.name as continent_name,
    co.code as country_code, co.name as country_name,
    r.code as region_code, r.name as region_name,
    d.code as district_code, d.name as district_name,
    c.name as city_name
FROM publisher_coverage pc
JOIN coverage_levels cl ON cl.id = pc.coverage_level_id
LEFT JOIN geo_continents ct ON pc.continent_id = ct.id
LEFT JOIN geo_countries co ON pc.country_id = co.id
LEFT JOIN geo_regions r ON pc.region_id = r.id
LEFT JOIN geo_districts d ON pc.district_id = d.id
LEFT JOIN geo_cities c ON pc.city_id = c.id
WHERE pc.publisher_id = $1 AND pc.is_active = true
ORDER BY cl.sort_order, pc.priority DESC, pc.created_at DESC;

-- name: GetPublisherCoverageByID :one
SELECT
    pc.id, pc.publisher_id, pc.coverage_level_id,
    cl.key as coverage_level_key,
    cl.display_name_hebrew as coverage_level_display_hebrew,
    cl.display_name_english as coverage_level_display_english,
    pc.continent_id, pc.country_id, pc.region_id, pc.district_id, pc.city_id,
    pc.priority, pc.is_active, pc.created_at, pc.updated_at
FROM publisher_coverage pc
JOIN coverage_levels cl ON cl.id = pc.coverage_level_id
WHERE pc.id = $1;

-- name: CreateCoverageContinent :one
INSERT INTO publisher_coverage (
    publisher_id, coverage_level_id, continent_id, priority, is_active
)
VALUES (
    $1,
    (SELECT id FROM coverage_levels WHERE key = 'continent'),
    $2, $3, $4
)
RETURNING id, publisher_id, coverage_level_id, continent_id, country_id, region_id, district_id, city_id, priority, is_active, created_at, updated_at;

-- name: CreateCoverageCountry :one
INSERT INTO publisher_coverage (
    publisher_id, coverage_level_id, country_id, priority, is_active
)
VALUES (
    $1,
    (SELECT id FROM coverage_levels WHERE key = 'country'),
    $2, $3, $4
)
RETURNING id, publisher_id, coverage_level_id, continent_id, country_id, region_id, district_id, city_id, priority, is_active, created_at, updated_at;

-- name: CreateCoverageRegion :one
INSERT INTO publisher_coverage (
    publisher_id, coverage_level_id, region_id, priority, is_active
)
VALUES (
    $1,
    (SELECT id FROM coverage_levels WHERE key = 'region'),
    $2, $3, $4
)
RETURNING id, publisher_id, coverage_level_id, continent_id, country_id, region_id, district_id, city_id, priority, is_active, created_at, updated_at;

-- name: CreateCoverageDistrict :one
INSERT INTO publisher_coverage (
    publisher_id, coverage_level_id, district_id, priority, is_active
)
VALUES (
    $1,
    (SELECT id FROM coverage_levels WHERE key = 'district'),
    $2, $3, $4
)
RETURNING id, publisher_id, coverage_level_id, continent_id, country_id, region_id, district_id, city_id, priority, is_active, created_at, updated_at;

-- name: CreateCoverageCity :one
INSERT INTO publisher_coverage (
    publisher_id, coverage_level_id, city_id, priority, is_active
)
VALUES (
    $1,
    (SELECT id FROM coverage_levels WHERE key = 'city'),
    $2, $3, $4
)
RETURNING id, publisher_id, coverage_level_id, continent_id, country_id, region_id, district_id, city_id, priority, is_active, created_at, updated_at;

-- name: UpdateCoveragePriority :one
UPDATE publisher_coverage
SET priority = $2, updated_at = NOW()
WHERE id = $1
RETURNING id, publisher_id, coverage_level_id, continent_id, country_id, region_id, district_id, city_id, priority, is_active, created_at, updated_at;

-- name: UpdateCoverageActive :one
UPDATE publisher_coverage
SET is_active = $2, updated_at = NOW()
WHERE id = $1
RETURNING id, publisher_id, coverage_level_id, continent_id, country_id, region_id, district_id, city_id, priority, is_active, created_at, updated_at;

-- name: DeleteCoverage :exec
DELETE FROM publisher_coverage
WHERE id = $1;

-- name: DeleteCoverageByPublisher :exec
DELETE FROM publisher_coverage
WHERE publisher_id = $1;

-- name: GetCoverageCountByPublisher :one
SELECT COUNT(*)
FROM publisher_coverage
WHERE publisher_id = $1 AND is_active = true;

-- name: GetCitiesCoveredCount :one
-- Estimates the number of cities covered by a publisher's coverage areas
-- Note: country derived via city.region_id → region.country_id
SELECT COALESCE(SUM(
    CASE cl.key
        WHEN 'city' THEN 1
        WHEN 'district' THEN (
            SELECT COUNT(*) FROM geo_cities c WHERE c.district_id = pc.district_id
        )
        WHEN 'region' THEN (
            SELECT COUNT(*) FROM geo_cities c WHERE c.region_id = pc.region_id
        )
        WHEN 'country' THEN (
            SELECT COUNT(*) FROM geo_cities c
            JOIN geo_regions r ON c.region_id = r.id
            WHERE r.country_id = pc.country_id
        )
        WHEN 'continent' THEN (
            SELECT COUNT(*) FROM geo_cities c
            JOIN geo_regions r ON c.region_id = r.id
            JOIN geo_countries co ON r.country_id = co.id
            JOIN geo_continents ct ON co.continent_id = ct.id
            WHERE ct.id = pc.continent_id
        )
        ELSE 0
    END
), 0)::int
FROM publisher_coverage pc
JOIN coverage_levels cl ON cl.id = pc.coverage_level_id
WHERE pc.publisher_id = $1 AND pc.is_active = true;

-- ============================================================================
-- Publisher Lookup by Location
-- ============================================================================

-- name: GetPublishersForCity :many
-- Find publishers that cover a specific city (using the get_publishers_for_city function)
SELECT
    publisher_id::int AS publisher_id,
    publisher_name::text AS publisher_name,
    coverage_level::text AS coverage_level,
    priority::int AS priority,
    match_type::text AS match_type
FROM get_publishers_for_city($1);

-- name: GetPublishersByCountry :many
-- Find publishers with coverage in a specific country
-- Note: city country derived via city.region_id → region.country_id
SELECT DISTINCT
    p.id, p.name, p.slug, p.is_verified,
    cl.key as coverage_level_key,
    cl.display_name_hebrew as coverage_level_display_hebrew,
    cl.display_name_english as coverage_level_display_english,
    pc.priority
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id
JOIN publisher_coverage pc ON p.id = pc.publisher_id
JOIN coverage_levels cl ON cl.id = pc.coverage_level_id
LEFT JOIN geo_countries co ON pc.country_id = co.id
LEFT JOIN geo_regions r ON pc.region_id = r.id
LEFT JOIN geo_districts d ON pc.district_id = d.id
LEFT JOIN geo_cities c ON pc.city_id = c.id
LEFT JOIN geo_regions cr ON c.region_id = cr.id
WHERE ps.key = 'active'
  AND pc.is_active = true
  AND (
    pc.country_id = $1
    OR r.country_id = $1
    OR (d.region_id IN (SELECT id FROM geo_regions WHERE country_id = $1))
    OR (cr.country_id = $1)
  )
ORDER BY pc.priority DESC, p.name;

-- name: GetPublishersByRegion :many
-- Find publishers with coverage in a specific region
SELECT DISTINCT
    p.id, p.name, p.slug, p.is_verified,
    cl.key as coverage_level_key,
    cl.display_name_hebrew as coverage_level_display_hebrew,
    cl.display_name_english as coverage_level_display_english,
    pc.priority
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id
JOIN publisher_coverage pc ON p.id = pc.publisher_id
JOIN coverage_levels cl ON cl.id = pc.coverage_level_id
LEFT JOIN geo_districts d ON pc.district_id = d.id
LEFT JOIN geo_cities c ON pc.city_id = c.id
WHERE ps.key = 'active'
  AND pc.is_active = true
  AND (
    pc.region_id = $1
    OR d.region_id = $1
    OR c.region_id = $1
  )
ORDER BY pc.priority DESC, p.name;

-- ============================================================================
-- Coverage Validation
-- ============================================================================

-- name: CheckDuplicateCoverageContinent :one
SELECT EXISTS(
    SELECT 1 FROM publisher_coverage pc
    JOIN coverage_levels cl ON cl.id = pc.coverage_level_id
    WHERE pc.publisher_id = $1 AND cl.key = 'continent' AND pc.continent_id = $2
) as exists;

-- name: CheckDuplicateCoverageCountry :one
SELECT EXISTS(
    SELECT 1 FROM publisher_coverage pc
    JOIN coverage_levels cl ON cl.id = pc.coverage_level_id
    WHERE pc.publisher_id = $1 AND cl.key = 'country' AND pc.country_id = $2
) as exists;

-- name: CheckDuplicateCoverageRegion :one
SELECT EXISTS(
    SELECT 1 FROM publisher_coverage pc
    JOIN coverage_levels cl ON cl.id = pc.coverage_level_id
    WHERE pc.publisher_id = $1 AND cl.key = 'region' AND pc.region_id = $2
) as exists;

-- name: CheckDuplicateCoverageDistrict :one
SELECT EXISTS(
    SELECT 1 FROM publisher_coverage pc
    JOIN coverage_levels cl ON cl.id = pc.coverage_level_id
    WHERE pc.publisher_id = $1 AND cl.key = 'district' AND pc.district_id = $2
) as exists;

-- name: CheckDuplicateCoverageCity :one
SELECT EXISTS(
    SELECT 1 FROM publisher_coverage pc
    JOIN coverage_levels cl ON cl.id = pc.coverage_level_id
    WHERE pc.publisher_id = $1 AND cl.key = 'city' AND pc.city_id = $2
) as exists;
