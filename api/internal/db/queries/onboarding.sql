-- Onboarding SQL Queries
-- Wizard trigger simplified: shows when zmanim count = 0

-- Publisher Zmanim Upserts for Wizard --

-- name: UpsertPublisherZmanWithMaster :exec
INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, time_category_id,
    master_zman_id
) VALUES ($1, $2, $3, $4, $5, true, true, false, false, $6, $7)
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
    is_enabled, is_visible, is_published, is_custom, time_category_id
) VALUES ($1, $2, $3, $4, $5, true, true, false, false, $6)
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
