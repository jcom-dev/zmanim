-- File: external_api.sql
-- Purpose: External API queries for M2M authentication endpoints
-- Epic: 8 - Finalize and External API
-- Story: 8.5 - List Publisher Zmanim for External API

-- name: GetPublisherZmanimForExternal :many
-- Returns all enabled zmanim for a publisher for external API consumers
-- Includes formula metadata (type and summary) for transparency
SELECT
    pz.id,
    pz.publisher_id,
    pz.zman_key,
    pz.english_name,
    pz.hebrew_name,
    -- Resolve formula from linked source if applicable
    COALESCE(linked_pz.formula_dsl, pz.formula_dsl) AS formula_dsl,
    pz.is_enabled,
    'v1' as version_id,
    -- Extract formula type from DSL (using resolved formula)
    CASE
        WHEN COALESCE(linked_pz.formula_dsl, pz.formula_dsl) LIKE 'solar(%' THEN 'solar_angle'
        WHEN COALESCE(linked_pz.formula_dsl, pz.formula_dsl) LIKE 'proportional_hours(%' THEN 'proportional_hours'
        WHEN COALESCE(linked_pz.formula_dsl, pz.formula_dsl) LIKE 'midpoint(%' THEN 'midpoint'
        WHEN COALESCE(linked_pz.formula_dsl, pz.formula_dsl) IN ('sunrise', 'sunset', 'noon', 'midnight', 'chatzos') THEN 'primitive'
        WHEN COALESCE(linked_pz.formula_dsl, pz.formula_dsl) LIKE '%+%' OR COALESCE(linked_pz.formula_dsl, pz.formula_dsl) LIKE '%-%' THEN 'offset'
        ELSE 'complex'
    END as formula_type,
    -- Extract formula summary (using resolved formula)
    CASE
        WHEN COALESCE(linked_pz.formula_dsl, pz.formula_dsl) LIKE 'solar(%' THEN
            CONCAT(SUBSTRING(COALESCE(linked_pz.formula_dsl, pz.formula_dsl) FROM 'solar\(([-0-9.]+)\)'), '° below horizon')
        WHEN COALESCE(linked_pz.formula_dsl, pz.formula_dsl) LIKE 'proportional_hours(%' THEN
            CONCAT('Proportional hour ', SUBSTRING(COALESCE(linked_pz.formula_dsl, pz.formula_dsl) FROM 'proportional_hours\(([0-9.]+)\)'))
        WHEN COALESCE(linked_pz.formula_dsl, pz.formula_dsl) IN ('sunrise', 'sunset', 'noon', 'midnight', 'chatzos') THEN
            UPPER(SUBSTRING(COALESCE(linked_pz.formula_dsl, pz.formula_dsl) FROM 1 FOR 1)) || SUBSTRING(COALESCE(linked_pz.formula_dsl, pz.formula_dsl) FROM 2)
        ELSE COALESCE(linked_pz.formula_dsl, pz.formula_dsl)
    END as formula_summary,
    -- Time category for ordering
    tc.key AS time_category
FROM publisher_zmanim pz
LEFT JOIN publisher_zmanim linked_pz ON pz.linked_publisher_zman_id = linked_pz.id
LEFT JOIN time_categories tc ON pz.time_category_id = tc.id
WHERE pz.publisher_id = $1
    AND pz.is_enabled = true
    AND pz.deleted_at IS NULL
ORDER BY
    COALESCE(tc.sort_order, 99),
    pz.hebrew_name;
