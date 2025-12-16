-- ============================================
-- Localities Queries for Overture Geographic Data
-- Uses geo_search_index for denormalized hierarchy data
-- ============================================

-- name: SearchLocalities :many
-- Tiered search: exact keyword match -> fuzzy trigram -> population ranking
-- Uses geo_search_index which has resolved hierarchy via parent_overture_id
-- Generates search terms including individual words, consecutive pairs, and full phrase
-- e.g. "lakewood new jersey" -> ["lakewood", "new", "jersey", "lakewood new", "new jersey", "lakewood new jersey"]
WITH words AS (
    SELECT word, row_number() OVER () AS pos
    FROM unnest(string_to_array(lower(sqlc.arg(query)), ' ')) AS word
    WHERE word <> ''
),
search_terms AS (
    SELECT DISTINCT term FROM (
        -- Individual words
        SELECT word AS term FROM words
        UNION ALL
        -- Consecutive pairs (e.g., "new jersey" from "lakewood new jersey")
        SELECT w1.word || ' ' || w2.word AS term
        FROM words w1
        JOIN words w2 ON w2.pos = w1.pos + 1
        UNION ALL
        -- Full phrase
        SELECT lower(sqlc.arg(query)) AS term
    ) all_terms
    WHERE term IS NOT NULL AND term <> ''
),
individual_terms AS (
    SELECT unnest(string_to_array(lower(sqlc.arg(query)), ' ')) AS term
),
term_count AS (
    SELECT COUNT(*)::int AS total FROM individual_terms WHERE term <> ''
),
exact_matches AS (
    SELECT
        s.entity_type,
        s.entity_id,
        s.locality_id,
        s.display_name,
        s.display_hierarchy,
        s.display_names,
        s.locality_type_id,
        s.direct_parent_type,
        s.direct_parent_id,
        s.inherited_region_id,
        s.country_id,
        s.continent_id,
        s.country_code,
        s.population,
        s.latitude,
        s.longitude,
        s.timezone,
        (SELECT COUNT(*) FROM search_terms st WHERE st.term <> '' AND st.term = ANY(s.keywords))::int AS matched_terms,
        CASE WHEN lower(s.display_name) = ANY(SELECT term FROM search_terms WHERE term <> '') THEN 1 ELSE 0 END AS name_match_bonus,
        CASE WHEN lower(s.display_name) LIKE '%' || lower(sqlc.arg(query)) || '%' THEN 2 ELSE 0 END AS phrase_match_bonus,
        CASE
            WHEN lower(sqlc.arg(query)) = ANY(s.keywords) THEN 3
            WHEN (SELECT COUNT(*) FROM search_terms st WHERE st.term <> '' AND st.term = ANY(s.keywords)) = (SELECT COUNT(*) FROM search_terms WHERE term <> '') THEN 3
            ELSE 0
        END AS all_terms_bonus,
        1 AS tier,
        CASE s.locality_type_id
            WHEN 1 THEN 1  -- city
            WHEN 2 THEN 2  -- town
            WHEN 3 THEN 3  -- village
            WHEN 4 THEN 4  -- hamlet
            WHEN 5 THEN 5  -- neighborhood
            ELSE 10
        END AS type_priority
    FROM geo_search_index s
    WHERE s.keywords && (SELECT ARRAY_AGG(term) FROM search_terms WHERE term <> '')
      AND (sqlc.narg(entity_types)::text[] IS NULL OR COALESCE(cardinality(sqlc.narg(entity_types)::text[]), 0) = 0 OR s.entity_type = ANY(sqlc.narg(entity_types)))
      AND (sqlc.narg(country_id)::int IS NULL OR s.country_id = sqlc.narg(country_id))
      AND (sqlc.narg(inherited_region_id)::int IS NULL OR s.inherited_region_id = sqlc.narg(inherited_region_id))
),
fuzzy_matches AS (
    SELECT
        s.entity_type,
        s.entity_id,
        s.locality_id,
        s.display_name,
        s.display_hierarchy,
        s.display_names,
        s.locality_type_id,
        s.direct_parent_type,
        s.direct_parent_id,
        s.inherited_region_id,
        s.country_id,
        s.continent_id,
        s.country_code,
        s.population,
        s.latitude,
        s.longitude,
        s.timezone,
        0 AS matched_terms,
        0 AS name_match_bonus,
        0 AS phrase_match_bonus,
        0 AS all_terms_bonus,
        2 AS tier,
        CASE s.locality_type_id
            WHEN 1 THEN 1
            WHEN 2 THEN 2
            WHEN 3 THEN 3
            WHEN 4 THEN 4
            WHEN 5 THEN 5
            ELSE 10
        END AS type_priority
    FROM geo_search_index s
    WHERE s.display_name % sqlc.arg(query)
      AND (s.entity_type, s.entity_id) NOT IN (SELECT entity_type, entity_id FROM exact_matches)
      AND (sqlc.narg(entity_types)::text[] IS NULL OR COALESCE(cardinality(sqlc.narg(entity_types)::text[]), 0) = 0 OR s.entity_type = ANY(sqlc.narg(entity_types)))
      AND (sqlc.narg(country_id)::int IS NULL OR s.country_id = sqlc.narg(country_id))
    LIMIT 50
),
all_matches AS (
    SELECT * FROM exact_matches
    UNION ALL
    SELECT * FROM fuzzy_matches
),
deduplicated AS (
    SELECT DISTINCT ON (display_name, country_code)
        entity_type, entity_id, locality_id, display_name, display_hierarchy, display_names,
        locality_type_id, direct_parent_type, direct_parent_id, inherited_region_id, country_id, continent_id, country_code,
        population, latitude, longitude, timezone, matched_terms, name_match_bonus,
        phrase_match_bonus, all_terms_bonus, tier, type_priority
    FROM all_matches
    ORDER BY display_name, country_code,
             tier ASC,
             matched_terms DESC,
             all_terms_bonus DESC,
             population DESC NULLS LAST,
             type_priority ASC
)
SELECT entity_type, entity_id, locality_id, display_name, display_hierarchy, display_names,
       locality_type_id, direct_parent_type, direct_parent_id, inherited_region_id, country_id, continent_id, country_code,
       population, latitude, longitude, timezone, matched_terms, name_match_bonus, tier
FROM deduplicated
ORDER BY tier, all_terms_bonus DESC, phrase_match_bonus DESC, matched_terms DESC, name_match_bonus DESC, population DESC NULLS LAST
LIMIT sqlc.arg(limit_val);

-- name: GetLocalityByID :one
-- Returns locality with resolved hierarchy from search index
-- Uses geo_locality_resolved_coords view for best system-wide coordinates
-- For publisher-specific resolution, use GetEffectiveLocalityLocation from locality_locations_manual.go
-- Also returns original (non-admin) coordinates for comparison
WITH original_coords AS (
    SELECT DISTINCT ON (ll.locality_id)
        ll.locality_id,
        ll.latitude as original_latitude,
        ll.longitude as original_longitude
    FROM geo_locality_locations ll
    JOIN geo_data_sources ds ON ds.id = ll.source_id AND ds.is_active = true
    WHERE ll.locality_id = sqlc.arg(id)
      AND ll.publisher_id IS NULL
      AND ds.key != 'admin'
    ORDER BY ll.locality_id, ds.priority
),
original_elevs AS (
    SELECT DISTINCT ON (le.locality_id)
        le.locality_id,
        le.elevation_m as original_elevation_m
    FROM geo_locality_elevations le
    JOIN geo_data_sources ds ON ds.id = le.source_id AND ds.is_active = true
    WHERE le.locality_id = sqlc.arg(id)
      AND le.publisher_id IS NULL
      AND ds.key != 'admin'
    ORDER BY le.locality_id, ds.priority
)
SELECT
    l.id,
    l.parent_overture_id,
    l.locality_type_id,
    l.name,
    l.name_ascii,
    l.timezone,
    l.population,
    l.continent_id,
    l.country_id,
    l.source_id,
    l.overture_id,
    l.created_at,
    l.updated_at,
    -- Coordinates from resolved view (priority: admin > default)
    rc.latitude,
    rc.longitude,
    rc.coordinate_source_id,
    rc.coordinate_source_key,
    rc.elevation_m,
    rc.elevation_source_id,
    rc.elevation_source_key,
    -- Original (non-admin) coordinates for "Default" view
    oc.original_latitude,
    oc.original_longitude,
    oe.original_elevation_m,
    lt.code as locality_type_code,
    lt.name as locality_type_name,
    s.display_hierarchy,
    s.inherited_region_id,
    s.direct_parent_type,
    s.direct_parent_id,
    c.name as country_name,
    c.code as country_code
FROM geo_localities l
LEFT JOIN geo_locality_resolved_coords rc ON rc.locality_id = l.id
LEFT JOIN original_coords oc ON oc.locality_id = l.id
LEFT JOIN original_elevs oe ON oe.locality_id = l.id
LEFT JOIN geo_locality_types lt ON l.locality_type_id = lt.id
LEFT JOIN geo_search_index s ON s.entity_type = 'locality' AND s.entity_id = l.id
JOIN geo_countries c ON l.country_id = c.id
WHERE l.id = sqlc.arg(id);

-- name: ListLocalities :many
-- List localities with search index hierarchy data
-- Uses geo_locality_resolved_coords view for best system-wide coordinates
SELECT
    l.id,
    l.parent_overture_id,
    l.locality_type_id,
    l.name,
    l.name_ascii,
    l.timezone,
    l.population,
    l.continent_id,
    l.country_id,
    l.source_id,
    l.overture_id,
    l.created_at,
    l.updated_at,
    -- Coordinates from resolved view (priority: admin > default)
    rc.latitude,
    rc.longitude,
    rc.coordinate_source_id,
    rc.elevation_m,
    rc.elevation_source_id,
    lt.code as locality_type_code,
    c.code as country_code,
    c.name as country_name,
    s.inherited_region_id,
    s.direct_parent_type,
    s.direct_parent_id,
    -- Count children using search index
    (SELECT COUNT(*) FROM geo_search_index child
     WHERE child.direct_parent_type = 'locality' AND child.direct_parent_id = l.id)::int as children_count
FROM geo_localities l
LEFT JOIN geo_locality_resolved_coords rc ON rc.locality_id = l.id
LEFT JOIN geo_locality_types lt ON l.locality_type_id = lt.id
LEFT JOIN geo_search_index s ON s.entity_type = 'locality' AND s.entity_id = l.id
JOIN geo_countries c ON l.country_id = c.id
WHERE (sqlc.narg(country_id)::int IS NULL OR l.country_id = sqlc.narg(country_id))
  AND (sqlc.narg(locality_type_id)::smallint IS NULL OR l.locality_type_id = sqlc.narg(locality_type_id))
  AND (sqlc.narg(inherited_region_id)::int IS NULL OR s.inherited_region_id = sqlc.narg(inherited_region_id))
ORDER BY l.population DESC NULLS LAST, l.name
LIMIT sqlc.arg(limit_val) OFFSET sqlc.arg(offset_val);

-- name: GetLocalitiesNearPoint :many
-- Returns localities near a point with inherited region from search index
-- Uses GIST index on geo_locality_locations.location for fast spatial filtering
-- Priority resolution via LATERAL join AFTER spatial filter for efficiency
WITH nearby_locations AS (
    -- First: use GIST index to find locations within radius (fast spatial filter)
    SELECT ll.locality_id, ll.latitude, ll.longitude, ll.location, ll.source_id
    FROM geo_locality_locations ll
    WHERE ll.publisher_id IS NULL  -- System-wide records only
      AND ST_DWithin(ll.location, ST_SetSRID(ST_MakePoint(sqlc.arg(lng), sqlc.arg(lat)), 4326)::geography, sqlc.arg(radius_m))
),
best_coords AS (
    -- Then: resolve priority only for nearby localities (much smaller set)
    SELECT DISTINCT ON (nl.locality_id)
        nl.locality_id,
        nl.latitude,
        nl.longitude,
        nl.location,
        nl.source_id as coordinate_source_id
    FROM nearby_locations nl
    JOIN geo_data_sources ds ON ds.id = nl.source_id AND ds.is_active = true
    ORDER BY nl.locality_id,
             CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END,
             ds.priority
),
best_elevs AS (
    SELECT DISTINCT ON (le.locality_id)
        le.locality_id,
        le.elevation_m,
        le.source_id as elevation_source_id
    FROM geo_locality_elevations le
    JOIN geo_data_sources ds ON ds.id = le.source_id AND ds.is_active = true
    WHERE le.publisher_id IS NULL
      AND le.locality_id IN (SELECT locality_id FROM best_coords)
    ORDER BY le.locality_id,
             CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END,
             ds.priority
)
SELECT
    l.id,
    l.parent_overture_id,
    l.locality_type_id,
    l.name,
    l.name_ascii,
    l.timezone,
    l.population,
    l.continent_id,
    l.country_id,
    l.source_id,
    l.overture_id,
    l.created_at,
    l.updated_at,
    bc.latitude,
    bc.longitude,
    bc.coordinate_source_id,
    be.elevation_m,
    be.elevation_source_id,
    lt.code as locality_type_code,
    c.code as country_code,
    s.inherited_region_id,
    ST_Distance(bc.location, ST_SetSRID(ST_MakePoint(sqlc.arg(lng), sqlc.arg(lat)), 4326)::geography) as distance_m
FROM geo_localities l
JOIN best_coords bc ON bc.locality_id = l.id
LEFT JOIN best_elevs be ON be.locality_id = l.id
LEFT JOIN geo_locality_types lt ON l.locality_type_id = lt.id
JOIN geo_countries c ON l.country_id = c.id
LEFT JOIN geo_search_index s ON s.entity_type = 'locality' AND s.entity_id = l.id
ORDER BY distance_m
LIMIT sqlc.arg(limit_val);

-- name: UpdateLocalityTimezone :exec
UPDATE geo_localities
SET timezone = sqlc.arg(timezone),
    updated_at = now()
WHERE id = sqlc.arg(id);

-- name: GetLocalityTypes :many
SELECT * FROM geo_locality_types ORDER BY sort_order, name;

-- name: GetRegionTypes :many
SELECT * FROM geo_region_types ORDER BY sort_order, name;

-- name: GetSearchIndexStats :one
SELECT
    COUNT(*) as total_entries,
    COUNT(*) FILTER (WHERE entity_type = 'locality') as localities_count,
    COUNT(*) FILTER (WHERE entity_type = 'region') as regions_count,
    COUNT(*) FILTER (WHERE entity_type = 'country') as countries_count,
    SUM(population) FILTER (WHERE population IS NOT NULL) as total_population
FROM geo_search_index;

-- name: GetLocalityWithHierarchy :one
-- Returns locality with full hierarchy from search index
-- Uses geo_locality_resolved_coords view for best system-wide coordinates
SELECT
    l.id,
    l.parent_overture_id,
    l.locality_type_id,
    l.name,
    l.name_ascii,
    l.timezone,
    l.population,
    l.continent_id,
    l.country_id,
    l.source_id,
    l.overture_id,
    l.created_at,
    l.updated_at,
    l.boundary,
    -- Coordinates from resolved view (priority: admin > default)
    rc.latitude,
    rc.longitude,
    rc.coordinate_source_id,
    rc.elevation_m,
    rc.elevation_source_id,
    lt.code as locality_type_code,
    lt.name as locality_type_name,
    s.display_hierarchy,
    s.hierarchy_path,
    s.inherited_region_id,
    s.direct_parent_type,
    s.direct_parent_id,
    c.name as country_name,
    c.code as country_code
FROM geo_localities l
LEFT JOIN geo_locality_resolved_coords rc ON rc.locality_id = l.id
LEFT JOIN geo_locality_types lt ON l.locality_type_id = lt.id
LEFT JOIN geo_search_index s ON s.entity_type = 'locality' AND s.entity_id = l.id
JOIN geo_countries c ON l.country_id = c.id
WHERE l.id = sqlc.arg(id);

-- name: BrowseHierarchy :many
-- Returns children of ANY entity (continent, country, region, or locality) for unified hierarchical browsing
-- When parent_type is NULL, returns all continents (top-level entities)
-- Uses pre-computed descendant_count for recursive totals
SELECT
    s.entity_type,
    s.entity_id,
    s.entity_subtype,
    s.locality_id,
    s.display_name,
    s.display_hierarchy,
    s.locality_type_id,
    s.population,
    s.latitude,
    s.longitude,
    s.timezone,
    s.direct_child_count,
    s.descendant_count,
    s.has_children
FROM geo_search_index s
WHERE
    (sqlc.narg(parent_type)::varchar IS NULL AND s.direct_parent_type IS NULL)
    OR (s.direct_parent_type = sqlc.narg(parent_type) AND s.direct_parent_id = sqlc.arg(parent_id))
ORDER BY
    s.population DESC NULLS LAST,
    s.display_name
LIMIT sqlc.arg(limit_val);

-- name: GetDirectChildrenOfRegion :many
-- Get direct children of a region (both sub-regions and localities)
SELECT
    s.entity_type,
    s.entity_id,
    s.locality_id,
    s.display_name,
    s.display_hierarchy,
    s.locality_type_id,
    s.country_id,
    s.country_code,
    s.population,
    s.latitude,
    s.longitude
FROM geo_search_index s
WHERE s.direct_parent_type = 'region'
  AND s.direct_parent_id = sqlc.arg(region_id)
ORDER BY
    CASE s.entity_type WHEN 'region' THEN 1 WHEN 'locality' THEN 2 ELSE 3 END,
    s.population DESC NULLS LAST,
    s.display_name
LIMIT sqlc.arg(limit_val);

-- name: GetDirectChildrenOfLocality :many
-- Get direct children of a locality (sub-localities like neighborhoods)
SELECT
    s.entity_type,
    s.entity_id,
    s.locality_id,
    s.display_name,
    s.display_hierarchy,
    s.locality_type_id,
    s.country_id,
    s.country_code,
    s.population,
    s.latitude,
    s.longitude
FROM geo_search_index s
WHERE s.direct_parent_type = 'locality'
  AND s.direct_parent_id = sqlc.arg(locality_id)
ORDER BY s.population DESC NULLS LAST, s.display_name
LIMIT sqlc.arg(limit_val);

-- name: SearchLocalitiesWithPublisherCoverage :many
-- Search localities filtered to a publisher's coverage areas (hierarchy-aware)
-- Returns only localities that fall within the publisher's coverage:
-- - Direct locality coverage match
-- - Within a covered region (via ancestor_region_ids)
-- - Within a covered country
-- - Within a covered continent
-- Uses MATERIALIZED CTEs to force GIN index usage before coverage filtering
WITH publisher_coverage_areas AS (
    SELECT
        pc.continent_id,
        pc.country_id,
        pc.region_id,
        pc.locality_id
    FROM publisher_coverage pc
    WHERE pc.publisher_id = sqlc.arg(publisher_id)::int
      AND pc.is_active = true
),
words AS (
    SELECT word, row_number() OVER () AS pos
    FROM unnest(string_to_array(lower(sqlc.arg(query)), ' ')) AS word
    WHERE word <> ''
),
search_terms AS (
    SELECT DISTINCT term FROM (
        -- Individual words
        SELECT word AS term FROM words
        UNION ALL
        -- Consecutive pairs (e.g., "new jersey" from "lakewood new jersey")
        SELECT w1.word || ' ' || w2.word AS term
        FROM words w1
        JOIN words w2 ON w2.pos = w1.pos + 1
        UNION ALL
        -- Full phrase
        SELECT lower(sqlc.arg(query)) AS term
    ) all_terms
    WHERE term IS NOT NULL AND term <> ''
),
individual_terms AS (
    SELECT unnest(string_to_array(lower(sqlc.arg(query)), ' ')) AS term
),
term_count AS (
    SELECT COUNT(*)::int AS total FROM individual_terms
),
-- MATERIALIZED forces GIN index usage before coverage filter (critical for performance)
keyword_matches AS MATERIALIZED (
    SELECT
        s.entity_type,
        s.entity_id,
        s.locality_id,
        s.display_name,
        s.display_hierarchy,
        s.display_names,
        s.locality_type_id,
        s.direct_parent_type,
        s.direct_parent_id,
        s.inherited_region_id,
        s.country_id,
        s.continent_id,
        s.country_code,
        s.population,
        s.latitude,
        s.longitude,
        s.timezone,
        s.keywords,
        s.ancestor_region_ids
    FROM geo_search_index s
    WHERE s.keywords && (SELECT ARRAY_AGG(term) FROM search_terms WHERE term <> '')
      AND s.entity_type = 'locality'
),
exact_matches AS (
    SELECT
        s.entity_type,
        s.entity_id,
        s.locality_id,
        s.display_name,
        s.display_hierarchy,
        s.display_names,
        s.locality_type_id,
        s.direct_parent_type,
        s.direct_parent_id,
        s.inherited_region_id,
        s.country_id,
        s.continent_id,
        s.country_code,
        s.population,
        s.latitude,
        s.longitude,
        s.timezone,
        (SELECT COUNT(*) FROM search_terms st WHERE st.term <> '' AND st.term = ANY(s.keywords))::int AS matched_terms,
        CASE WHEN lower(s.display_name) = ANY(SELECT term FROM search_terms WHERE term <> '') THEN 1 ELSE 0 END AS name_match_bonus,
        CASE WHEN lower(s.display_name) LIKE '%' || lower(sqlc.arg(query)) || '%' THEN 2 ELSE 0 END AS phrase_match_bonus,
        CASE
            WHEN lower(sqlc.arg(query)) = ANY(s.keywords) THEN 3
            WHEN (SELECT COUNT(*) FROM search_terms st WHERE st.term <> '' AND st.term = ANY(s.keywords)) = (SELECT COUNT(*) FROM search_terms WHERE term <> '') THEN 3
            ELSE 0
        END AS all_terms_bonus,
        1 AS tier,
        CASE s.locality_type_id
            WHEN 1 THEN 1  -- city
            WHEN 2 THEN 2  -- town
            WHEN 3 THEN 3  -- village
            WHEN 4 THEN 4  -- hamlet
            WHEN 5 THEN 5  -- neighborhood
            ELSE 10
        END AS type_priority
    FROM keyword_matches s
    WHERE (
        -- Direct locality match
        s.entity_id IN (SELECT locality_id FROM publisher_coverage_areas WHERE locality_id IS NOT NULL)
        -- Region match (locality's ancestor regions)
        OR s.ancestor_region_ids && (SELECT ARRAY_AGG(region_id) FROM publisher_coverage_areas WHERE region_id IS NOT NULL)
        -- Country match
        OR s.country_id IN (SELECT country_id FROM publisher_coverage_areas WHERE country_id IS NOT NULL)
        -- Continent match
        OR s.continent_id IN (SELECT continent_id FROM publisher_coverage_areas WHERE continent_id IS NOT NULL)
    )
),
-- MATERIALIZED forces trigram index usage before coverage filter
fuzzy_candidates AS MATERIALIZED (
    SELECT
        s.entity_type,
        s.entity_id,
        s.locality_id,
        s.display_name,
        s.display_hierarchy,
        s.display_names,
        s.locality_type_id,
        s.direct_parent_type,
        s.direct_parent_id,
        s.inherited_region_id,
        s.country_id,
        s.continent_id,
        s.country_code,
        s.population,
        s.latitude,
        s.longitude,
        s.timezone,
        s.ancestor_region_ids
    FROM geo_search_index s
    WHERE s.display_name % sqlc.arg(query)
      AND s.entity_type = 'locality'
    LIMIT 200
),
fuzzy_matches AS (
    SELECT
        s.entity_type,
        s.entity_id,
        s.locality_id,
        s.display_name,
        s.display_hierarchy,
        s.display_names,
        s.locality_type_id,
        s.direct_parent_type,
        s.direct_parent_id,
        s.inherited_region_id,
        s.country_id,
        s.continent_id,
        s.country_code,
        s.population,
        s.latitude,
        s.longitude,
        s.timezone,
        0 AS matched_terms,
        0 AS name_match_bonus,
        0 AS phrase_match_bonus,
        0 AS all_terms_bonus,
        2 AS tier,
        CASE s.locality_type_id
            WHEN 1 THEN 1
            WHEN 2 THEN 2
            WHEN 3 THEN 3
            WHEN 4 THEN 4
            WHEN 5 THEN 5
            ELSE 10
        END AS type_priority
    FROM fuzzy_candidates s
    WHERE (s.entity_type, s.entity_id) NOT IN (SELECT entity_type, entity_id FROM exact_matches)
      AND (
          s.entity_id IN (SELECT locality_id FROM publisher_coverage_areas WHERE locality_id IS NOT NULL)
          OR s.ancestor_region_ids && (SELECT ARRAY_AGG(region_id) FROM publisher_coverage_areas WHERE region_id IS NOT NULL)
          OR s.country_id IN (SELECT country_id FROM publisher_coverage_areas WHERE country_id IS NOT NULL)
          OR s.continent_id IN (SELECT continent_id FROM publisher_coverage_areas WHERE continent_id IS NOT NULL)
      )
    LIMIT 50
),
all_matches AS (
    SELECT * FROM exact_matches
    UNION ALL
    SELECT * FROM fuzzy_matches
),
deduplicated AS (
    SELECT DISTINCT ON (display_name, country_code)
        entity_type, entity_id, locality_id, display_name, display_hierarchy, display_names,
        locality_type_id, direct_parent_type, direct_parent_id, inherited_region_id, country_id, continent_id, country_code,
        population, latitude, longitude, timezone, matched_terms, name_match_bonus,
        phrase_match_bonus, all_terms_bonus, tier, type_priority
    FROM all_matches
    ORDER BY display_name, country_code,
             tier ASC,
             matched_terms DESC,
             all_terms_bonus DESC,
             population DESC NULLS LAST,
             type_priority ASC
)
SELECT entity_type, entity_id, locality_id, display_name, display_hierarchy, display_names,
       locality_type_id, direct_parent_type, direct_parent_id, inherited_region_id, country_id, continent_id, country_code,
       population, latitude, longitude, timezone, matched_terms, name_match_bonus, tier
FROM deduplicated
ORDER BY tier, all_terms_bonus DESC, phrase_match_bonus DESC, matched_terms DESC, name_match_bonus DESC, population DESC NULLS LAST
LIMIT sqlc.arg(limit_val);
