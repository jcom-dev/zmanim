-- Migration: Drop Unused Tables
-- Date: 2025-12-26
-- Description: Remove 8 verified unused tables identified in database audit
-- Context: These tables were created but never referenced in application code
-- Evidence: See database audit report from 2025-12-26

-- AI/ML tables that were never integrated
DROP TABLE IF EXISTS public.ai_indexes CASCADE;
DROP TABLE IF EXISTS public.ai_index_statuses CASCADE;
DROP TABLE IF EXISTS public.explanation_sources CASCADE;

-- Over-engineered lookup tables that were never used
DROP TABLE IF EXISTS public.calculation_types CASCADE;
DROP TABLE IF EXISTS public.data_types CASCADE;
DROP TABLE IF EXISTS public.edge_types CASCADE;

-- Event system tables replaced by tag-driven architecture
DROP TABLE IF EXISTS public.master_zman_events CASCADE;
DROP TABLE IF EXISTS public.publisher_zman_events CASCADE;

-- Verification queries (run these BEFORE applying migration to confirm zero impact)
-- SELECT COUNT(*) FROM ai_indexes;                    -- Expected: 0
-- SELECT COUNT(*) FROM ai_index_statuses;             -- Expected: 0
-- SELECT COUNT(*) FROM explanation_sources;           -- Expected: 3 (unused)
-- SELECT COUNT(*) FROM calculation_types;             -- Expected: 5 (unused)
-- SELECT COUNT(*) FROM data_types;                    -- Expected: 3 (unused)
-- SELECT COUNT(*) FROM edge_types;                    -- Expected: 4 (unused)
-- SELECT COUNT(*) FROM master_zman_events;            -- Expected: 0
-- SELECT COUNT(*) FROM publisher_zman_events;         -- Expected: 0

-- Rollback (if needed - recreate tables from schema backup)
-- Use: pg_dump --schema-only --table=table_name to backup individual table schemas before dropping
