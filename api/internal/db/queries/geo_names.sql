-- Geo Names SQL Queries
-- Unified location search using geo_search_index table

-- ============================================================================
-- GEO_SEARCH_INDEX QUERIES (Denormalized Table - Ultra-Fast Search)
-- Target: <10ms response time via pre-computed denormalized data
-- ============================================================================

-- name: SearchGeoIndexExactContextOnly :many
-- Exact search for context matching (countries/regions only)
-- Used by FindContextMatches to lookup country/region IDs by name/alias
SELECT
    entity_type,
    entity_id,
    inherited_region_id,
    country_id
FROM geo_search_index
WHERE LOWER(display_name) = LOWER($1)
  AND entity_type IN ('country', 'region')
ORDER BY
    entity_type -- Countries before regions
LIMIT $2;

-- name: RefreshGeoSearchIndex :exec
-- Refresh the materialized view (call after updating geo data)
SELECT refresh_geo_search_index();
