-- Calculation Logging Queries
-- Story 8.2: Implement Calculation Logging
--
-- Note: Batch inserts are handled via pgx COPY protocol in the service layer
-- These queries are for stats aggregation and analytics

-- ============================================================================
-- STATS AGGREGATION QUERIES (Using Pre-Aggregated Table)
-- ============================================================================

-- name: GetPublisherTotalCalculations :one
-- Returns total calculations for a publisher from pre-aggregated stats
SELECT COALESCE(SUM(total_calculations), 0)::bigint as total
FROM calculation_stats_daily
WHERE publisher_id = $1;

-- name: GetPublisherMonthlyCalculations :one
-- Returns calculations for current month from pre-aggregated stats
SELECT COALESCE(SUM(total_calculations), 0)::bigint as total
FROM calculation_stats_daily
WHERE publisher_id = $1
  AND date >= date_trunc('month', CURRENT_DATE)::date;

-- name: GetPublisherCacheHitRatio :one
-- Returns cache hit ratio for a publisher
SELECT
    COALESCE(SUM(total_calculations), 0)::bigint as total_calculations,
    COALESCE(SUM(cache_hits), 0)::bigint as cache_hits,
    CASE
        WHEN SUM(total_calculations) > 0
        THEN ROUND((SUM(cache_hits)::numeric / SUM(total_calculations)::numeric) * 100, 2)
        ELSE 0
    END as cache_hit_ratio
FROM calculation_stats_daily
WHERE publisher_id = $1;

-- name: GetPublisherAvgResponseTime :one
-- Returns average response time for a publisher
SELECT
    CASE
        WHEN SUM(total_calculations) > 0
        THEN ROUND(SUM(total_response_time_ms)::numeric / SUM(total_calculations)::numeric, 2)
        ELSE 0
    END as avg_response_ms
FROM calculation_stats_daily
WHERE publisher_id = $1;

-- name: GetPublisherStatsDetailed :one
-- Returns comprehensive stats for a publisher from pre-aggregated table
SELECT
    COALESCE(SUM(total_calculations), 0)::bigint as total_calculations,
    COALESCE(SUM(cache_hits), 0)::bigint as cache_hits,
    COALESCE(SUM(source_web), 0)::bigint as source_web,
    COALESCE(SUM(source_api), 0)::bigint as source_api,
    COALESCE(SUM(source_external), 0)::bigint as source_external,
    CASE
        WHEN SUM(total_calculations) > 0
        THEN ROUND((SUM(cache_hits)::numeric / SUM(total_calculations)::numeric) * 100, 2)
        ELSE 0
    END as cache_hit_ratio,
    CASE
        WHEN SUM(total_calculations) > 0
        THEN ROUND(SUM(total_response_time_ms)::numeric / SUM(total_calculations)::numeric, 2)
        ELSE 0
    END as avg_response_ms
FROM calculation_stats_daily
WHERE publisher_id = $1;

-- name: GetPublisherMonthlyStatsDetailed :one
-- Returns stats for current month
SELECT
    COALESCE(SUM(total_calculations), 0)::bigint as total_calculations,
    COALESCE(SUM(cache_hits), 0)::bigint as cache_hits,
    COALESCE(SUM(source_web), 0)::bigint as source_web,
    COALESCE(SUM(source_api), 0)::bigint as source_api,
    COALESCE(SUM(source_external), 0)::bigint as source_external,
    CASE
        WHEN SUM(total_calculations) > 0
        THEN ROUND((SUM(cache_hits)::numeric / SUM(total_calculations)::numeric) * 100, 2)
        ELSE 0
    END as cache_hit_ratio,
    CASE
        WHEN SUM(total_calculations) > 0
        THEN ROUND(SUM(total_response_time_ms)::numeric / SUM(total_calculations)::numeric, 2)
        ELSE 0
    END as avg_response_ms
FROM calculation_stats_daily
WHERE publisher_id = $1
  AND date >= date_trunc('month', CURRENT_DATE)::date;

-- ============================================================================
-- PLATFORM-WIDE STATS (Admin Dashboard)
-- ============================================================================

-- name: GetPlatformTotalCalculations :one
-- Returns total calculations across all publishers
SELECT COALESCE(SUM(total_calculations), 0)::bigint as total
FROM calculation_stats_daily;

-- name: GetPlatformMonthlyCalculations :one
-- Returns calculations for current month across all publishers
SELECT COALESCE(SUM(total_calculations), 0)::bigint as total
FROM calculation_stats_daily
WHERE date >= date_trunc('month', CURRENT_DATE)::date;

-- name: GetPlatformStatsDetailed :one
-- Returns comprehensive platform-wide stats
SELECT
    COALESCE(SUM(total_calculations), 0)::bigint as total_calculations,
    COALESCE(SUM(cache_hits), 0)::bigint as cache_hits,
    COALESCE(SUM(source_web), 0)::bigint as source_web,
    COALESCE(SUM(source_api), 0)::bigint as source_api,
    COALESCE(SUM(source_external), 0)::bigint as source_external,
    CASE
        WHEN SUM(total_calculations) > 0
        THEN ROUND((SUM(cache_hits)::numeric / SUM(total_calculations)::numeric) * 100, 2)
        ELSE 0
    END as cache_hit_ratio,
    CASE
        WHEN SUM(total_calculations) > 0
        THEN ROUND(SUM(total_response_time_ms)::numeric / SUM(total_calculations)::numeric, 2)
        ELSE 0
    END as avg_response_ms
FROM calculation_stats_daily;

-- name: GetPlatformStatsPerPublisher :many
-- Returns calculation stats grouped by publisher for admin dashboard
SELECT
    p.id as publisher_id,
    p.name as publisher_name,
    COALESCE(SUM(csd.total_calculations), 0)::bigint as total_calculations,
    COALESCE(SUM(csd.cache_hits), 0)::bigint as cache_hits,
    CASE
        WHEN SUM(csd.total_calculations) > 0
        THEN ROUND((SUM(csd.cache_hits)::numeric / SUM(csd.total_calculations)::numeric) * 100, 2)
        ELSE 0
    END as cache_hit_ratio
FROM publishers p
LEFT JOIN calculation_stats_daily csd ON csd.publisher_id = p.id
GROUP BY p.id, p.name
HAVING SUM(csd.total_calculations) > 0
ORDER BY total_calculations DESC
LIMIT $1;

-- ============================================================================
-- DAILY ROLLUP QUERIES
-- These are used by background jobs to maintain the pre-aggregated table
-- ============================================================================

-- name: RollupCalculationStatsDaily :exec
-- Aggregates raw logs into daily stats
-- Should be run daily via cron/scheduler
INSERT INTO calculation_stats_daily (
    publisher_id, date, total_calculations, cache_hits,
    total_response_time_ms, source_web, source_api, source_external
)
SELECT
    publisher_id,
    date_calculated,
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE cache_hit)::integer,
    COALESCE(SUM(response_time_ms), 0)::bigint,
    COUNT(*) FILTER (WHERE source = 1)::integer,
    COUNT(*) FILTER (WHERE source = 2)::integer,
    COUNT(*) FILTER (WHERE source = 3)::integer
FROM calculation_logs
WHERE created_at >= $1::date
  AND created_at < ($1::date + interval '1 day')
GROUP BY publisher_id, date_calculated
ON CONFLICT (publisher_id, date)
DO UPDATE SET
    total_calculations = calculation_stats_daily.total_calculations + EXCLUDED.total_calculations,
    cache_hits = calculation_stats_daily.cache_hits + EXCLUDED.cache_hits,
    total_response_time_ms = calculation_stats_daily.total_response_time_ms + EXCLUDED.total_response_time_ms,
    source_web = calculation_stats_daily.source_web + EXCLUDED.source_web,
    source_api = calculation_stats_daily.source_api + EXCLUDED.source_api,
    source_external = calculation_stats_daily.source_external + EXCLUDED.source_external;

-- name: GetLatestRollupDate :one
-- Returns the latest date that has been rolled up
SELECT MAX(date) as latest_date
FROM calculation_stats_daily;

-- ============================================================================
-- MAINTENANCE QUERIES
-- ============================================================================

-- name: DeleteOldCalculationLogs :exec
-- Deletes calculation logs older than specified days
-- Use this to keep the raw logs table manageable
DELETE FROM calculation_logs
WHERE created_at < CURRENT_DATE - $1::integer * interval '1 day';

-- name: GetCalculationLogsCount :one
-- Returns total count of calculation logs
SELECT COUNT(*) as total
FROM calculation_logs;

-- name: GetCalculationLogsDiskSize :one
-- Returns disk size of calculation_logs table
SELECT pg_size_pretty(pg_total_relation_size('calculation_logs')) as size;
