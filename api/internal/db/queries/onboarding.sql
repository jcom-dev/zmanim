-- Onboarding SQL Queries
-- SQLc will generate type-safe Go code from these queries

-- IMPORTANT NOTE: The handler code expects columns that don't exist in the current schema:
-- - current_step, completed_steps, wizard_data, started_at, last_updated_at, completed_at, skipped
-- The schema only has: profile_complete, algorithm_selected, zmanim_configured, coverage_set
-- These queries use the ACTUAL schema columns. Handler needs to be updated OR schema migrated.

-- Onboarding State Management --

-- name: GetOnboardingState :one
SELECT id, publisher_id, profile_complete, algorithm_selected,
       zmanim_configured, coverage_set, created_at, updated_at
FROM publisher_onboarding
WHERE publisher_id = $1;

-- name: UpsertOnboardingComplete :exec
INSERT INTO publisher_onboarding (
    publisher_id, profile_complete, algorithm_selected,
    zmanim_configured, coverage_set, updated_at
) VALUES ($1, $2, $3, $4, $5, NOW())
ON CONFLICT (publisher_id)
DO UPDATE SET
    profile_complete = EXCLUDED.profile_complete,
    algorithm_selected = EXCLUDED.algorithm_selected,
    zmanim_configured = EXCLUDED.zmanim_configured,
    coverage_set = EXCLUDED.coverage_set,
    updated_at = NOW();

-- name: MarkZmanimConfigured :exec
UPDATE publisher_onboarding
SET zmanim_configured = true, updated_at = NOW()
WHERE publisher_id = $1;

-- name: MarkCoverageSet :exec
UPDATE publisher_onboarding
SET coverage_set = true, updated_at = NOW()
WHERE publisher_id = $1;

-- name: DeleteOnboardingState :exec
DELETE FROM publisher_onboarding
WHERE publisher_id = $1;

-- Publisher Zmanim Upserts for Onboarding --

-- name: UpsertPublisherZmanWithMaster :exec
INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, time_category_id,
    master_zman_id, source_type_id
) VALUES ($1, $2, $3, $4, $5, true, true, false, false, $6, $7, 1)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name,
    formula_dsl = EXCLUDED.formula_dsl,
    is_enabled = EXCLUDED.is_enabled,
    time_category_id = EXCLUDED.time_category_id,
    master_zman_id = EXCLUDED.master_zman_id,
    updated_at = NOW();

-- name: UpsertPublisherZmanLegacy :exec
INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, time_category_id,
    source_type_id
) VALUES ($1, $2, $3, $4, $5, true, true, false, false, $6, 1)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name,
    formula_dsl = EXCLUDED.formula_dsl,
    is_enabled = EXCLUDED.is_enabled,
    time_category_id = EXCLUDED.time_category_id,
    updated_at = NOW();

-- Cleanup Operations --

-- name: DeleteAllPublisherZmanim :exec
DELETE FROM publisher_zmanim WHERE publisher_id = $1;

-- name: DeleteAllPublisherCoverage :exec
DELETE FROM publisher_coverage WHERE publisher_id = $1;
