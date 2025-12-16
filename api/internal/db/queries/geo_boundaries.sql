-- Geo Boundaries SQL Queries
-- NOTE: Boundary tables (geo_country_boundaries, geo_region_boundaries) were removed
-- as part of the Overture migration. Localities are point-only.
-- This file contains placeholder queries to maintain handler compatibility.

-- ============================================================================
-- Boundary Functionality Status: DISABLED
-- ============================================================================
-- The old WOF boundary tables have been removed. The Overture schema uses
-- point-based localities without boundary polygons. If boundary functionality
-- is needed in the future, new boundary tables would need to be added.
--
-- Removed tables:
-- - geo_country_boundaries
-- - geo_region_boundaries
-- - geo_district_boundaries
-- - geo_city_boundaries
-- - geo_locality_boundaries
-- - geo_boundary_imports
-- - geo_name_mappings
-- ============================================================================

-- name: GetBoundaryStats :one
-- Returns placeholder stats since boundaries are disabled
SELECT
    0::bigint as country_boundaries,
    0::bigint as region_boundaries,
    0::bigint as district_boundaries,
    0::bigint as city_boundaries;
