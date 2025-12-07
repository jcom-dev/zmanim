-- File: zmanim_tags.sql
-- Purpose: Separate tag fetching queries (extracted from complex GetPublisherZmanim)
-- Pattern: query-decomposition
-- Complexity: low (single concept with lookup tables)
-- Used by: publisher_zmanim.go handlers

-- name: GetZmanTags :many
-- Fetches all tags for a specific publisher zman
-- Combines master zman tags (if linked to master registry) with publisher-specific tags
SELECT
    t.id,
    t.tag_key,
    t.name,
    t.display_name_hebrew,
    t.display_name_english,
    tt.key AS tag_type,
    t.sort_order,
    COALESCE(mzt.is_negated, pzt.is_negated, false) AS is_negated,
    CASE
        WHEN mzt.tag_id IS NOT NULL THEN 'master'
        ELSE 'publisher'
    END AS tag_source
FROM (
    -- Master zman tags (if this zman is linked to master registry)
    SELECT mzt.tag_id, mzt.is_negated, 'master' AS source
    FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = (
        SELECT pz.master_zman_id FROM publisher_zmanim pz WHERE pz.id = $1
    )
    UNION ALL
    -- Publisher-specific tags
    SELECT pzt.tag_id, pzt.is_negated, 'publisher' AS source
    FROM publisher_zman_tags pzt
    WHERE pzt.publisher_zman_id = $1
) tag_refs
JOIN zman_tags t ON tag_refs.tag_id = t.id
JOIN tag_types tt ON t.tag_type_id = tt.id
LEFT JOIN master_zman_tags mzt ON mzt.tag_id = t.id
    AND mzt.master_zman_id = (SELECT pz.master_zman_id FROM publisher_zmanim pz WHERE pz.id = $1)
LEFT JOIN publisher_zman_tags pzt ON pzt.tag_id = t.id AND pzt.publisher_zman_id = $1
ORDER BY t.sort_order;

-- name: CheckIfEventZman :one
-- Checks if a zman has event or behavior tags (simpler than subquery in main query)
SELECT EXISTS (
    SELECT 1 FROM (
        -- Check master zman tags
        SELECT tt.key
        FROM master_zman_tags mzt
        JOIN zman_tags zt ON mzt.tag_id = zt.id
        JOIN tag_types tt ON zt.tag_type_id = tt.id
        WHERE mzt.master_zman_id = (SELECT pz.master_zman_id FROM publisher_zmanim pz WHERE pz.id = $1)
        UNION ALL
        -- Check publisher-specific tags
        SELECT tt.key
        FROM publisher_zman_tags pzt
        JOIN zman_tags zt ON pzt.tag_id = zt.id
        JOIN tag_types tt ON zt.tag_type_id = tt.id
        WHERE pzt.publisher_zman_id = $1
    ) all_tags
    WHERE all_tags.key IN ('event', 'behavior')
) AS is_event;
