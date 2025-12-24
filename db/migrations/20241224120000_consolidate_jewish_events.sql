-- +migrate Up
-- ============================================================================
-- Consolidate jewish_events into zman_tags
-- ============================================================================
-- All event data is now managed via zman_tags (tag_type_id = 170 for events)
-- This is a one-way migration - no rollback supported
-- ============================================================================

-- Drop tables (CASCADE handles any remaining references)
DROP TABLE IF EXISTS jewish_events CASCADE;
DROP TABLE IF EXISTS jewish_event_types CASCADE;
DROP TABLE IF EXISTS fast_start_types CASCADE;
DROP TABLE IF EXISTS event_categories CASCADE;

-- Drop sequences
DROP SEQUENCE IF EXISTS jewish_events_id_seq CASCADE;
DROP SEQUENCE IF EXISTS jewish_event_types_id_seq CASCADE;
DROP SEQUENCE IF EXISTS event_categories_id_seq CASCADE;

-- +migrate Down
-- No rollback - system is fully tag-driven now
-- To restore, use db/migrations/00000000000001_schema.sql and 00000000000002_seed_data.sql
SELECT 1; -- placeholder to satisfy migration tool
