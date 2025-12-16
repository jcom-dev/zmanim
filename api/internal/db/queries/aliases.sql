-- Alias CRUD Queries
-- Epic 5, Story 5.0: Publisher Zman Aliases
-- Schema: id, publisher_zman_id, publisher_id, alias_hebrew, alias_english, alias_transliteration, context, is_primary, sort_order, created_at

-- name: GetPublisherZmanAlias :one
-- Get a specific alias for a publisher's zman by zman_key
SELECT
    pza.id,
    pza.publisher_id,
    pza.publisher_zman_id,
    pza.alias_hebrew,
    pza.alias_english,
    pza.alias_transliteration,
    pza.context,
    pza.is_primary,
    pza.sort_order,
    pza.created_at,
    pz.zman_key,
    mzr.canonical_hebrew_name,
    mzr.canonical_english_name
FROM publisher_zman_aliases pza
JOIN publisher_zmanim pz ON pza.publisher_zman_id = pz.id
JOIN master_zmanim_registry mzr ON pz.zman_key = mzr.zman_key
WHERE pza.publisher_id = $1 AND pz.zman_key = $2 AND pza.is_primary = true;

-- name: CreatePublisherZmanAlias :one
-- Create an alias for a publisher's zman
INSERT INTO publisher_zman_aliases (
    publisher_id,
    publisher_zman_id,
    alias_hebrew,
    alias_english,
    alias_transliteration,
    context,
    is_primary,
    sort_order
)
SELECT $1, pz.id, $3, $4, $5, $6, $7, $8
FROM publisher_zmanim pz
WHERE pz.publisher_id = $1 AND pz.zman_key = $2
RETURNING id, publisher_id, publisher_zman_id, alias_hebrew, alias_english, alias_transliteration, context, is_primary, sort_order, created_at;

-- name: UpdatePublisherZmanAlias :one
-- Update an alias
UPDATE publisher_zman_aliases
SET alias_hebrew = $2,
    alias_english = $3,
    alias_transliteration = $4,
    context = $5,
    is_primary = $6,
    sort_order = $7
WHERE id = $1
RETURNING id, publisher_id, publisher_zman_id, alias_hebrew, alias_english, alias_transliteration, context, is_primary, sort_order, created_at;

-- name: DeletePublisherZmanAlias :exec
-- Delete an alias by ID
DELETE FROM publisher_zman_aliases WHERE id = $1;

-- name: DeletePublisherZmanAliasByZmanKey :exec
-- Delete all aliases for a specific zman_key
DELETE FROM publisher_zman_aliases pza
USING publisher_zmanim pz
WHERE pza.publisher_zman_id = pz.id
  AND pza.publisher_id = $1
  AND pz.zman_key = $2;

-- name: GetAllPublisherZmanAliases :many
-- Get all aliases for a publisher with canonical names included
-- Orders by time_category (chronological) then hebrew_name
SELECT
    pza.id,
    pza.publisher_id,
    pza.publisher_zman_id,
    pza.alias_hebrew,
    pza.alias_english,
    pza.alias_transliteration,
    pza.context,
    pza.is_primary,
    pza.sort_order,
    pza.created_at,
    pz.zman_key,
    mzr.canonical_hebrew_name,
    mzr.canonical_english_name
FROM publisher_zman_aliases pza
JOIN publisher_zmanim pz ON pza.publisher_zman_id = pz.id
JOIN master_zmanim_registry mzr ON pz.zman_key = mzr.zman_key
WHERE pza.publisher_id = $1
ORDER BY
    CASE mzr.time_category
        WHEN 'dawn' THEN 1
        WHEN 'sunrise' THEN 2
        WHEN 'morning' THEN 3
        WHEN 'midday' THEN 4
        WHEN 'afternoon' THEN 5
        WHEN 'sunset' THEN 6
        WHEN 'nightfall' THEN 7
        WHEN 'midnight' THEN 8
        ELSE 9
    END,
    pza.sort_order,
    mzr.canonical_hebrew_name;

-- name: GetZmanimWithAliases :many
-- Get all of a publisher's zmanim with their primary alias (if any)
-- Orders by time_category (chronological) then hebrew_name
SELECT
    pz.id as publisher_zman_id,
    pz.zman_key,
    pz.formula_dsl,
    pz.is_enabled,
    mzr.canonical_hebrew_name,
    mzr.canonical_english_name,
    pza.id as alias_id,
    pza.alias_hebrew,
    pza.alias_english,
    pza.alias_transliteration
FROM publisher_zmanim pz
JOIN master_zmanim_registry mzr ON pz.zman_key = mzr.zman_key
LEFT JOIN publisher_zman_aliases pza ON pza.publisher_zman_id = pz.id AND pza.is_primary = true
WHERE pz.publisher_id = $1 AND pz.is_enabled = true
ORDER BY
    CASE mzr.time_category
        WHEN 'dawn' THEN 1
        WHEN 'sunrise' THEN 2
        WHEN 'morning' THEN 3
        WHEN 'midday' THEN 4
        WHEN 'afternoon' THEN 5
        WHEN 'sunset' THEN 6
        WHEN 'nightfall' THEN 7
        WHEN 'midnight' THEN 8
        ELSE 9
    END,
    mzr.canonical_hebrew_name;
