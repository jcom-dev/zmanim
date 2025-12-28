-- Migration: Fix calculation_logs table - Rename city_id to locality_id
-- Date: 2025-12-28
-- Purpose: Align database schema with application code expectations for analytics feature
--
-- Background: The calculation_logs table was created with 'city_id' column but the
-- application code (calculation_log_service.go and handlers) use 'locality_id' to match
-- the geo_localities table naming convention used throughout the application.
--
-- This migration renames the column and adds performance indexes for analytics queries.

-- ============================================
-- RENAME COLUMN
-- ============================================

-- Rename city_id to locality_id for consistency with application code
ALTER TABLE calculation_logs
  RENAME COLUMN city_id TO locality_id;

-- ============================================
-- ADD PERFORMANCE INDEXES
-- ============================================

-- Index for filtering by publisher (used in analytics queries)
CREATE INDEX IF NOT EXISTS idx_calculation_logs_publisher_id
  ON calculation_logs(publisher_id);

-- Index for filtering by date (used in daily rollup queries)
CREATE INDEX IF NOT EXISTS idx_calculation_logs_date_calculated
  ON calculation_logs(date_calculated);

-- Index for filtering by created_at (used in rollup window queries)
CREATE INDEX IF NOT EXISTS idx_calculation_logs_created_at
  ON calculation_logs(created_at);

-- Composite index for publisher + date queries (most common analytics pattern)
CREATE INDEX IF NOT EXISTS idx_calculation_logs_publisher_date
  ON calculation_logs(publisher_id, date_calculated);

-- Index for locality-based analytics (future feature)
CREATE INDEX IF NOT EXISTS idx_calculation_logs_locality_id
  ON calculation_logs(locality_id);

-- Composite index for rollup queries (publisher + created_at range)
CREATE INDEX IF NOT EXISTS idx_calculation_logs_rollup
  ON calculation_logs(publisher_id, created_at, date_calculated);

-- ============================================
-- VERIFICATION COMMENTS
-- ============================================

-- After applying this migration, the following should succeed:
-- INSERT INTO calculation_logs (publisher_id, locality_id, date_calculated, cache_hit, response_time_ms, zman_count, source)
-- VALUES (1, 4993250, CURRENT_DATE, false, 150, 10, 1);
--
-- SELECT COUNT(*) FROM calculation_logs WHERE locality_id IS NOT NULL;
