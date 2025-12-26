-- Migration: Add indexes for location override queries
-- Purpose: Optimize GetPublisherLocationOverridesNew and GetPublisherElevationOverrides queries
-- Issue: These queries were doing full table scans without indexes on publisher_id

-- Index for publisher location override lookups
CREATE INDEX IF NOT EXISTS idx_geo_locality_locations_publisher_id
ON geo_locality_locations(publisher_id)
WHERE publisher_id IS NOT NULL;

-- Index for publisher elevation override lookups
CREATE INDEX IF NOT EXISTS idx_geo_locality_elevations_publisher_id
ON geo_locality_elevations(publisher_id)
WHERE publisher_id IS NOT NULL;

-- Composite index for locality lookups (used in GetPublisherLocationOverrideByLocality)
CREATE INDEX IF NOT EXISTS idx_geo_locality_locations_publisher_locality
ON geo_locality_locations(publisher_id, locality_id)
WHERE publisher_id IS NOT NULL;

-- Composite index for elevation locality lookups (used in GetPublisherElevationOverrideByLocality)
CREATE INDEX IF NOT EXISTS idx_geo_locality_elevations_publisher_locality
ON geo_locality_elevations(publisher_id, locality_id)
WHERE publisher_id IS NOT NULL;

-- Index for locality_id foreign key lookups (helps with JOINs)
CREATE INDEX IF NOT EXISTS idx_geo_locality_locations_locality_id
ON geo_locality_locations(locality_id);

CREATE INDEX IF NOT EXISTS idx_geo_locality_elevations_locality_id
ON geo_locality_elevations(locality_id);
