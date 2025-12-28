-- Agent 1 Database Migration - Verification Queries
-- Run these to verify the migration was successful
-- Date: 2025-12-28

-- ============================================
-- 1. SCHEMA VERIFICATION
-- ============================================

-- Check calculation_logs has locality_id column (not city_id)
\d calculation_logs

-- Expected output should show:
-- locality_id      | bigint                   |           | not null |


-- ============================================
-- 2. INDEX VERIFICATION
-- ============================================

-- List all indexes on calculation_logs (should be 7 total)
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'calculation_logs' 
ORDER BY indexname;

-- Expected indexes:
-- 1. calculation_logs_pkey (PRIMARY KEY)
-- 2. idx_calculation_logs_created_at
-- 3. idx_calculation_logs_date_calculated
-- 4. idx_calculation_logs_locality_id
-- 5. idx_calculation_logs_publisher_date
-- 6. idx_calculation_logs_publisher_id
-- 7. idx_calculation_logs_rollup


-- ============================================
-- 3. DATA INTEGRITY TEST
-- ============================================

-- Test insert with locality_id column
INSERT INTO calculation_logs (
    publisher_id, locality_id, date_calculated, 
    cache_hit, response_time_ms, zman_count, source
)
VALUES (1, 4993250, CURRENT_DATE, false, 150, 10, 1);

-- Expected: INSERT 0 1 (Success)


-- Test query using locality_id
SELECT COUNT(*) as count_with_locality 
FROM calculation_logs 
WHERE locality_id IS NOT NULL;

-- Expected: count_with_locality = 1 (or more)


-- Clean up test data
DELETE FROM calculation_logs WHERE publisher_id = 1 AND locality_id = 4993250;


-- ============================================
-- 4. TABLE STATE VERIFICATION
-- ============================================

-- Check current row counts
SELECT 
    'calculation_logs' as table_name,
    COUNT(*) as row_count 
FROM calculation_logs
UNION ALL
SELECT 
    'calculation_stats_daily' as table_name,
    COUNT(*) as row_count 
FROM calculation_stats_daily;

-- Expected (initially):
-- calculation_logs: 0 rows
-- calculation_stats_daily: 0 rows


-- ============================================
-- 5. ROLLUP QUERY READINESS TEST
-- ============================================

-- Verify the RollupCalculationStatsDaily query will work
-- (This is a dry run - doesn't actually insert)
SELECT
    publisher_id,
    date_calculated,
    COUNT(*)::integer as total_calculations,
    COUNT(*) FILTER (WHERE cache_hit)::integer as cache_hits,
    COALESCE(SUM(response_time_ms), 0)::bigint as total_response_time_ms,
    COUNT(*) FILTER (WHERE source = 1)::integer as source_web,
    COUNT(*) FILTER (WHERE source = 2)::integer as source_api,
    COUNT(*) FILTER (WHERE source = 3)::integer as source_external
FROM calculation_logs
WHERE created_at >= CURRENT_DATE
  AND created_at < (CURRENT_DATE + interval '1 day')
GROUP BY publisher_id, date_calculated;

-- Expected: Empty result set (no data yet) - but query should execute without errors


-- ============================================
-- SUMMARY
-- ============================================

-- If all queries above execute without errors:
-- ✅ Migration successful
-- ✅ Schema correct
-- ✅ Indexes in place
-- ✅ Ready for rollup job implementation
