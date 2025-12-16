-- Coverage SQL Queries (Geographic Hierarchy)
-- Supports: continent, country, region, locality
-- Uses geo_search_index for resolved hierarchy lookups

-- name: GetPublisherCoverage :many
-- Returns coverage with full hierarchy resolved
-- Locality coordinates resolved with priority: admin > default (for display preview)
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
    pc.id, pc.publisher_id, pc.coverage_level_id,
    cl.key as coverage_level_key,
    cl.display_name_hebrew as coverage_level_display_hebrew,
    cl.display_name_english as coverage_level_display_english,
    pc.continent_id, pc.country_id, pc.region_id, pc.locality_id,
    pc.priority, pc.is_active, pc.created_at, pc.updated_at,
    -- Resolved names
    COALESCE(ct.name, country_continent.name, '') as continent_name,
    COALESCE(co.code, region_country.code, locality_country.code, '') as country_code,
    COALESCE(co.name, region_country.name, locality_country.name, '') as country_name,
    COALESCE(r.code, '') as region_code,
    COALESCE(r.name, '') as region_name,
    COALESCE(l.name, '') as locality_name,
    -- Locality coordinates for preview (from best system-wide data)
    bc.latitude as locality_latitude,
    bc.longitude as locality_longitude,
    l.timezone as locality_timezone,
    -- Locality count for this coverage area (uses pre-computed descendant_count for total descendants)
    CASE cl.key
        WHEN 'locality' THEN 1::bigint
        WHEN 'region' THEN COALESCE((
            SELECT s.descendant_count FROM geo_search_index s
            WHERE s.entity_type = 'region' AND s.entity_id = pc.region_id
        ), 0)::bigint
        WHEN 'country' THEN COALESCE((
            SELECT s.descendant_count FROM geo_search_index s
            WHERE s.entity_type = 'country' AND s.entity_id = pc.country_id
        ), 0)::bigint
        WHEN 'continent' THEN COALESCE((
            SELECT s.descendant_count FROM geo_search_index s
            WHERE s.entity_type = 'continent' AND s.entity_id = pc.continent_id
        ), 0)::bigint
        ELSE 0::bigint
    END as locality_count
FROM publisher_coverage pc
JOIN coverage_levels cl ON cl.id = pc.coverage_level_id
-- Direct joins for each level
LEFT JOIN geo_continents ct ON pc.continent_id = ct.id
LEFT JOIN geo_countries co ON pc.country_id = co.id
LEFT JOIN geo_regions r ON pc.region_id = r.id
LEFT JOIN geo_localities l ON pc.locality_id = l.id
LEFT JOIN best_coords bc ON bc.locality_id = l.id
-- Hierarchy traversal: country -> continent
LEFT JOIN geo_continents country_continent ON co.continent_id = country_continent.id
-- Hierarchy traversal: region -> country
LEFT JOIN geo_countries region_country ON r.country_id = region_country.id
-- Hierarchy traversal: locality -> country (via search index)
LEFT JOIN geo_search_index ls ON ls.entity_type = 'locality' AND ls.entity_id = l.id
LEFT JOIN geo_countries locality_country ON l.country_id = locality_country.id
WHERE pc.publisher_id = $1 AND pc.is_active = true
ORDER BY cl.sort_order, pc.priority DESC, pc.created_at DESC;

-- name: GetPublisherCoverageByID :one
SELECT
    pc.id, pc.publisher_id, pc.coverage_level_id,
    cl.key as coverage_level_key,
    cl.display_name_hebrew as coverage_level_display_hebrew,
    cl.display_name_english as coverage_level_display_english,
    pc.continent_id, pc.country_id, pc.region_id, pc.locality_id,
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
RETURNING id, publisher_id, coverage_level_id, continent_id, country_id, region_id, locality_id, priority, is_active, created_at, updated_at;

-- name: CreateCoverageCountry :one
INSERT INTO publisher_coverage (
    publisher_id, coverage_level_id, country_id, priority, is_active
)
VALUES (
    $1,
    (SELECT id FROM coverage_levels WHERE key = 'country'),
    $2, $3, $4
)
RETURNING id, publisher_id, coverage_level_id, continent_id, country_id, region_id, locality_id, priority, is_active, created_at, updated_at;

-- name: CreateCoverageRegion :one
INSERT INTO publisher_coverage (
    publisher_id, coverage_level_id, region_id, priority, is_active
)
VALUES (
    $1,
    (SELECT id FROM coverage_levels WHERE key = 'region'),
    $2, $3, $4
)
RETURNING id, publisher_id, coverage_level_id, continent_id, country_id, region_id, locality_id, priority, is_active, created_at, updated_at;

-- name: CreateCoverageLocality :one
INSERT INTO publisher_coverage (
    publisher_id, coverage_level_id, locality_id, priority, is_active
)
VALUES (
    $1,
    (SELECT id FROM coverage_levels WHERE key = 'locality'),
    $2, $3, $4
)
RETURNING id, publisher_id, coverage_level_id, continent_id, country_id, region_id, locality_id, priority, is_active, created_at, updated_at;

-- name: UpdateCoveragePriority :one
UPDATE publisher_coverage
SET priority = $2, updated_at = NOW()
WHERE id = $1
RETURNING id, publisher_id, coverage_level_id, continent_id, country_id, region_id, locality_id, priority, is_active, created_at, updated_at;

-- name: UpdateCoverageActive :one
UPDATE publisher_coverage
SET is_active = $2, updated_at = NOW()
WHERE id = $1
RETURNING id, publisher_id, coverage_level_id, continent_id, country_id, region_id, locality_id, priority, is_active, created_at, updated_at;

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

-- name: GetLocalitiesCoveredCount :one
-- Estimates the number of localities covered by a publisher's coverage areas
-- Uses pre-computed descendant_count for accurate totals
SELECT COALESCE(SUM(
    CASE cl.key
        WHEN 'locality' THEN 1
        WHEN 'region' THEN COALESCE((
            SELECT s.descendant_count FROM geo_search_index s
            WHERE s.entity_type = 'region' AND s.entity_id = pc.region_id
        ), 0)
        WHEN 'country' THEN COALESCE((
            SELECT s.descendant_count FROM geo_search_index s
            WHERE s.entity_type = 'country' AND s.entity_id = pc.country_id
        ), 0)
        WHEN 'continent' THEN COALESCE((
            SELECT s.descendant_count FROM geo_search_index s
            WHERE s.entity_type = 'continent' AND s.entity_id = pc.continent_id
        ), 0)
        ELSE 0
    END
), 0)::int
FROM publisher_coverage pc
JOIN coverage_levels cl ON cl.id = pc.coverage_level_id
WHERE pc.publisher_id = $1 AND pc.is_active = true;

-- ============================================================================
-- Publisher Lookup by Location
-- ============================================================================

-- name: GetPublishersForLocality :many
-- Find publishers that cover a specific locality through all coverage levels
-- Uses search index to resolve inherited_region_id
-- DISTINCT ON ensures each publisher appears only once, with most specific coverage
SELECT DISTINCT ON (p.id)
    p.id::int AS publisher_id,
    p.name::text AS publisher_name,
    cl.key::text AS coverage_level,
    pc.priority::int AS priority,
    CASE
        WHEN pc.locality_id = sqlc.arg('locality_id')::int THEN 'exact_locality'
        WHEN pc.region_id IS NOT NULL THEN 'region_match'
        WHEN pc.country_id IS NOT NULL THEN 'country_match'
        WHEN pc.continent_id IS NOT NULL THEN 'continent_match'
        ELSE 'unknown'
    END::text AS match_type,
    CASE
        WHEN pc.locality_id = sqlc.arg('locality_id')::int THEN 1
        WHEN pc.region_id IS NOT NULL THEN 2
        WHEN pc.country_id IS NOT NULL THEN 3
        WHEN pc.continent_id IS NOT NULL THEN 4
        ELSE 5
    END::int AS specificity_rank
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id
JOIN publisher_coverage pc ON p.id = pc.publisher_id
JOIN coverage_levels cl ON cl.id = pc.coverage_level_id
LEFT JOIN geo_localities l ON l.id = sqlc.arg('locality_id')::int
LEFT JOIN geo_search_index ls ON ls.entity_type = 'locality' AND ls.entity_id = l.id
WHERE ps.key = 'active'
  AND pc.is_active = true
  AND (
    -- Exact locality match
    pc.locality_id = sqlc.arg('locality_id')::int
    -- Region match (locality's inherited region)
    OR (pc.region_id IS NOT NULL AND ls.ancestor_region_ids @> ARRAY[pc.region_id])
    -- Country match (locality's country)
    OR (pc.country_id IS NOT NULL AND l.country_id = pc.country_id)
    -- Continent match (locality's country's continent)
    OR (pc.continent_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM geo_countries co
        WHERE co.id = l.country_id AND co.continent_id = pc.continent_id
    ))
  )
ORDER BY p.id, specificity_rank, priority DESC;

-- name: GetPublishersByCountry :many
-- Find publishers with coverage in a specific country
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
LEFT JOIN geo_localities l ON pc.locality_id = l.id
WHERE ps.key = 'active'
  AND pc.is_active = true
  AND (
    pc.country_id = $1
    OR r.country_id = $1
    OR l.country_id = $1
  )
ORDER BY pc.priority DESC, p.name;

-- name: GetPublishersByRegion :many
-- Find publishers with coverage in a specific region
-- Uses inherited_region_id from search index
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
LEFT JOIN geo_search_index ls ON ls.entity_type = 'locality' AND ls.entity_id = pc.locality_id
WHERE ps.key = 'active'
  AND pc.is_active = true
  AND (
    pc.region_id = $1
    OR ls.inherited_region_id = $1
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

-- name: CheckDuplicateCoverageLocality :one
SELECT EXISTS(
    SELECT 1 FROM publisher_coverage pc
    JOIN coverage_levels cl ON cl.id = pc.coverage_level_id
    WHERE pc.publisher_id = $1 AND cl.key = 'locality' AND pc.locality_id = $2
) as exists;

-- name: GetRepresentativeLocalitiesForCoverage :many
-- Returns one representative locality per coverage area using ID-based joins
-- Used by Algorithm Editor to get preview locations for zmanim calculation
-- Uses separate LATERAL joins per coverage level for optimal index usage (~6ms vs 5s)
SELECT
    pc.id as coverage_id,
    cl.key as coverage_level_key,
    COALESCE(loc_locality.locality_id, loc_region.locality_id, loc_country.locality_id, loc_continent.locality_id) as locality_id,
    COALESCE(loc_locality.locality_name, loc_region.locality_name, loc_country.locality_name, loc_continent.locality_name) as locality_name,
    COALESCE(loc_locality.locality_hierarchy, loc_region.locality_hierarchy, loc_country.locality_hierarchy, loc_continent.locality_hierarchy) as locality_hierarchy,
    COALESCE(loc_locality.latitude, loc_region.latitude, loc_country.latitude, loc_continent.latitude) as latitude,
    COALESCE(loc_locality.longitude, loc_region.longitude, loc_country.longitude, loc_continent.longitude) as longitude,
    COALESCE(loc_locality.timezone, loc_region.timezone, loc_country.timezone, loc_continent.timezone) as timezone,
    COALESCE(loc_locality.country_code, loc_region.country_code, loc_country.country_code, loc_continent.country_code) as country_code
FROM publisher_coverage pc
JOIN coverage_levels cl ON cl.id = pc.coverage_level_id
-- Locality lookup (direct entity match)
LEFT JOIN LATERAL (
    SELECT s.entity_id as locality_id, s.display_name as locality_name, s.display_hierarchy as locality_hierarchy,
           s.latitude, s.longitude, s.timezone, s.country_code
    FROM geo_search_index s
    WHERE cl.key = 'locality' AND s.entity_type = 'locality' AND s.entity_id = pc.locality_id
    LIMIT 1
) loc_locality ON true
-- Region lookup (top locality by population in region)
LEFT JOIN LATERAL (
    SELECT s.entity_id as locality_id, s.display_name as locality_name, s.display_hierarchy as locality_hierarchy,
           s.latitude, s.longitude, s.timezone, s.country_code
    FROM geo_search_index s
    WHERE cl.key = 'region' AND s.entity_type = 'locality' AND s.ancestor_region_ids @> ARRAY[pc.region_id]
    ORDER BY s.population DESC NULLS LAST
    LIMIT 1
) loc_region ON true
-- Country lookup (top locality by population in country)
LEFT JOIN LATERAL (
    SELECT s.entity_id as locality_id, s.display_name as locality_name, s.display_hierarchy as locality_hierarchy,
           s.latitude, s.longitude, s.timezone, s.country_code
    FROM geo_search_index s
    WHERE cl.key = 'country' AND s.entity_type = 'locality' AND s.country_id = pc.country_id
    ORDER BY s.population DESC NULLS LAST
    LIMIT 1
) loc_country ON true
-- Continent lookup (top locality by population in continent)
LEFT JOIN LATERAL (
    SELECT s.entity_id as locality_id, s.display_name as locality_name, s.display_hierarchy as locality_hierarchy,
           s.latitude, s.longitude, s.timezone, s.country_code
    FROM geo_search_index s
    WHERE cl.key = 'continent' AND s.entity_type = 'locality' AND s.continent_id = pc.continent_id
    ORDER BY s.population DESC NULLS LAST
    LIMIT 1
) loc_continent ON true
WHERE pc.publisher_id = $1 AND pc.is_active = true
LIMIT 10;
