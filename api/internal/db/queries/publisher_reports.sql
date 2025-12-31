-- Publisher Reports Queries
-- Used for generating PDF reports of zmanim calculations

-- name: GetPublisherForReport :one
-- Fetches publisher details needed for PDF report header
SELECT
    p.id,
    p.name,
    p.logo_url,
    p.logo_data,
    p.description,
    ps.key as status_key,
    p.is_verified,
    p.is_certified,
    p.is_global
FROM publishers p
JOIN publisher_statuses ps ON ps.id = p.status_id
WHERE p.id = $1;

-- name: GetLocalityForReport :one
-- Fetches locality details with timezone for report location section
-- NOTE: Coordinates/elevation are resolved separately via GetEffectiveLocalityLocation for publisher-aware overrides
SELECT
    l.id,
    l.name,
    l.timezone,
    l.population,
    r.name as region_name,
    c.name as country_name,
    c.code as country_code,
    s.display_hierarchy
FROM geo_localities l
JOIN geo_countries c ON l.country_id = c.id
LEFT JOIN geo_search_index s ON s.entity_type = 'locality' AND s.entity_id = l.id
LEFT JOIN geo_regions r ON s.inherited_region_id = r.id
WHERE l.id = $1;

-- name: ListPublisherZmanimForReport :many
-- Fetches all published zmanim with master registry metadata and tags for report
-- @param publisher_id: The publisher ID
-- @param transliteration_style: 'ashkenazi' (default) or 'sephardi' - controls tag display names
SELECT
    pz.id,
    pz.zman_key,
    pz.hebrew_name,
    pz.english_name,
    pz.description,
    COALESCE(linked_pz.formula_dsl, pz.formula_dsl) AS formula_dsl,
    pz.is_enabled,
    pz.rounding_mode,
    mzr.id as master_zman_id,
    mzr.formula_explanation,
    mzr.canonical_hebrew_name as master_hebrew_name,
    mzr.canonical_english_name as master_english_name,
    COALESCE(mr_tc.key, tc.key, 'uncategorized') AS time_category,
    COALESCE(mr_tc.sort_order, tc.sort_order, 99) AS sort_order,
    -- Is this an event zman (has any tag with tag_type = 'event')?
    EXISTS (
        SELECT 1
        FROM (
            -- Publisher tags
            SELECT tt.key
            FROM publisher_zman_tags pzt
            JOIN zman_tags zt ON pzt.tag_id = zt.id
            JOIN tag_types tt ON zt.tag_type_id = tt.id
            WHERE pzt.publisher_zman_id = pz.id
            UNION ALL
            -- Master tags (fallback)
            SELECT tt.key
            FROM master_zman_tags mzt
            JOIN zman_tags zt ON mzt.tag_id = zt.id
            JOIN tag_types tt ON zt.tag_type_id = tt.id
            WHERE mzt.master_zman_id = pz.master_zman_id
        ) all_tags
        WHERE all_tags.key = 'event'
    ) AS is_event_zman,
    -- Tags: Publisher tags take precedence over master tags
    -- Display name respects publisher's transliteration_style preference (ashkenazi/sephardi)
    COALESCE(
        (SELECT json_agg(json_build_object(
            'id', sub.id,
            'tag_key', sub.tag_key,
            'display_name_hebrew', sub.display_name_hebrew,
            'display_name_english', CASE
                WHEN $2::text = 'sephardi' AND sub.display_name_english_sephardi IS NOT NULL AND sub.display_name_english_sephardi != ''
                THEN sub.display_name_english_sephardi
                ELSE sub.display_name_english_ashkenazi
            END,
            'tag_type', sub.tag_type,
            'description', sub.description,
            'color', sub.color,
            'sort_order', sub.sort_order,
            'is_negated', sub.is_negated,
            'is_modified', sub.is_modified,
            'source_is_negated', sub.source_is_negated
        ) ORDER BY sub.sort_order)
        FROM (
            -- Publisher-specific tags (if any exist, these take full precedence)
            SELECT t.id, t.tag_key, t.display_name_hebrew,
                   t.display_name_english_ashkenazi, t.display_name_english_sephardi,
                   tt.key AS tag_type, t.description, t.color, tt.sort_order, pzt.is_negated,
                   CASE
                       WHEN mzt.tag_id IS NULL THEN true
                       WHEN pzt.is_negated != mzt.is_negated THEN true
                       ELSE false
                   END AS is_modified,
                   mzt.is_negated AS source_is_negated
            FROM publisher_zman_tags pzt
            JOIN zman_tags t ON pzt.tag_id = t.id
            JOIN tag_types tt ON t.tag_type_id = tt.id
            LEFT JOIN master_zman_tags mzt ON mzt.master_zman_id = pz.master_zman_id
                                            AND mzt.tag_id = pzt.tag_id
            WHERE pzt.publisher_zman_id = pz.id
            UNION ALL
            -- Master tags (only if NO publisher tags exist for this zman)
            SELECT t.id, t.tag_key, t.display_name_hebrew,
                   t.display_name_english_ashkenazi, t.display_name_english_sephardi,
                   tt.key AS tag_type, t.description, t.color, tt.sort_order, mzt.is_negated,
                   false AS is_modified,
                   mzt.is_negated AS source_is_negated
            FROM master_zman_tags mzt
            JOIN zman_tags t ON mzt.tag_id = t.id
            JOIN tag_types tt ON t.tag_type_id = tt.id
            WHERE mzt.master_zman_id = pz.master_zman_id
              AND NOT EXISTS (SELECT 1 FROM publisher_zman_tags WHERE publisher_zman_id = pz.id)
        ) sub),
        '[]'::json
    ) AS tags
FROM publisher_zmanim pz
LEFT JOIN time_categories tc ON pz.time_category_id = tc.id
LEFT JOIN publisher_zmanim linked_pz ON pz.linked_publisher_zman_id = linked_pz.id
LEFT JOIN master_zmanim_registry mzr ON pz.master_zman_id = mzr.id
LEFT JOIN time_categories mr_tc ON mzr.time_category_id = mr_tc.id
WHERE pz.publisher_id = $1
  AND pz.deleted_at IS NULL
  AND pz.is_enabled = true
ORDER BY COALESCE(mr_tc.sort_order, tc.sort_order, 99), pz.hebrew_name;

-- name: PublisherHasCoverageForLocality :one
-- Checks if publisher has coverage for a specific locality
SELECT EXISTS(
    SELECT 1
    FROM publisher_coverage pc
    WHERE pc.publisher_id = $1
      AND pc.locality_id = $2
      AND pc.deleted_at IS NULL
) AS has_coverage;
