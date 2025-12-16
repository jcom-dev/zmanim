-- Algorithms SQL Queries
-- SQLc will generate type-safe Go code from these queries

-- Get algorithm for publisher --

-- name: GetPublisherDraftAlgorithm :one
SELECT a.id, a.name, COALESCE(a.description, '') as description,
       COALESCE(a.configuration::text, '{}')::jsonb as configuration,
       a.status_id,
       astatus.key as status_key,
       astatus.display_name_hebrew as status_display_hebrew,
       astatus.display_name_english as status_display_english,
       a.is_public,
       a.created_at, a.updated_at
FROM algorithms a
JOIN algorithm_statuses astatus ON astatus.id = a.status_id
WHERE a.publisher_id = $1 AND astatus.key = 'draft'
ORDER BY a.created_at DESC
LIMIT 1;

-- name: GetPublisherActiveAlgorithm :one
SELECT a.id, a.name, COALESCE(a.description, '') as description,
       COALESCE(a.configuration::text, '{}')::jsonb as configuration,
       a.status_id,
       astatus.key as status_key,
       astatus.display_name_hebrew as status_display_hebrew,
       astatus.display_name_english as status_display_english,
       a.is_public,
       a.created_at, a.updated_at
FROM algorithms a
JOIN algorithm_statuses astatus ON astatus.id = a.status_id
WHERE a.publisher_id = $1 AND astatus.key = 'active'
ORDER BY a.created_at DESC
LIMIT 1;

-- name: GetAlgorithmByID :one
SELECT a.id, a.name, COALESCE(a.description, '') as description,
       COALESCE(a.configuration::text, '{}')::jsonb as configuration,
       a.status_id,
       astatus.key as status_key,
       astatus.display_name_hebrew as status_display_hebrew,
       astatus.display_name_english as status_display_english,
       a.is_public,
       a.created_at, a.updated_at
FROM algorithms a
JOIN algorithm_statuses astatus ON astatus.id = a.status_id
WHERE a.id = $1 AND a.publisher_id = $2;

-- Create or update algorithm --

-- name: CreateAlgorithm :one
INSERT INTO algorithms (
    publisher_id, name, description, configuration, status_id, is_public
)
VALUES ($1, $2, $3, $4, (SELECT astatus.id FROM algorithm_statuses astatus WHERE astatus.key = 'draft'), false)
RETURNING id, created_at, updated_at;

-- name: UpdateAlgorithmDraft :one
UPDATE algorithms
SET configuration = $1,
    name = COALESCE(NULLIF($2, ''), name),
    description = COALESCE(NULLIF($3, ''), description),
    updated_at = NOW()
WHERE id = $4
RETURNING id, created_at, updated_at;

-- Publish algorithm --

-- name: ArchiveActiveAlgorithms :exec
UPDATE algorithms
SET status_id = (SELECT astatus.id FROM algorithm_statuses astatus WHERE astatus.key = 'archived'),
    updated_at = NOW()
WHERE publisher_id = $1
  AND status_id = (SELECT astatus.id FROM algorithm_statuses astatus WHERE astatus.key = 'active');

-- name: PublishAlgorithm :one
UPDATE algorithms
SET status_id = (SELECT astatus.id FROM algorithm_statuses astatus WHERE astatus.key = 'active'),
    updated_at = NOW()
WHERE algorithms.id = $1
RETURNING updated_at;

-- Algorithm versions --

-- name: GetAlgorithmVersions :many
SELECT a.id, a.name,
       a.status_id,
       astatus.key as status_key,
       astatus.display_name_hebrew as status_display_hebrew,
       astatus.display_name_english as status_display_english,
       a.is_public,
       a.created_at
FROM algorithms a
JOIN algorithm_statuses astatus ON astatus.id = a.status_id
WHERE a.publisher_id = $1
ORDER BY a.created_at DESC;

-- name: DeprecateAlgorithmVersion :execrows
UPDATE algorithms
SET status_id = (SELECT astatus.id FROM algorithm_statuses astatus WHERE astatus.key = 'archived'),
    updated_at = NOW()
WHERE algorithms.id = $1 AND algorithms.publisher_id = $2;

-- Note: Onboarding queries moved to onboarding.sql

-- Algorithm Collaboration Queries --

-- name: BrowsePublicAlgorithms :many
SELECT
    a.id, a.name, COALESCE(a.description, '') as description,
    a.publisher_id, p.name as publisher_name,
    COALESCE(p.logo_url, '') as publisher_logo,
    COALESCE(a.fork_count, 0) as fork_count,
    a.created_at
FROM algorithms a
JOIN publishers p ON p.id = a.publisher_id
WHERE a.is_public = true AND a.is_active = true
    AND ($1::text = '' OR a.name ILIKE '%' || $1 || '%' OR p.name ILIKE '%' || $1 || '%')
ORDER BY a.fork_count DESC, a.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountPublicAlgorithms :one
SELECT COUNT(*)
FROM algorithms
WHERE is_public = true AND is_active = true;

-- name: GetPublicAlgorithmByID :one
SELECT
    a.id, a.name, COALESCE(a.description, '') as description,
    a.publisher_id, p.name as publisher_name,
    COALESCE(p.logo_url, '') as publisher_logo,
    COALESCE(a.fork_count, 0) as fork_count,
    a.created_at, COALESCE(a.configuration::text, '{}')::jsonb as configuration
FROM algorithms a
JOIN publishers p ON p.id = a.publisher_id
WHERE a.id = $1 AND a.is_public = true AND a.is_active = true;

-- name: GetPublicAlgorithmConfig :one
SELECT name, COALESCE(description, '') as description, COALESCE(configuration::text, '{}')::jsonb as configuration
FROM algorithms
WHERE id = $1 AND is_public = true AND is_active = true;

-- name: CopyPublicAlgorithm :one
INSERT INTO algorithms (
    publisher_id, name, description, configuration, version,
    formula_definition, calculation_type,
    is_active, is_public, created_at, updated_at
) VALUES (
    $1, $2 || ' (Copy)', $3, $4, '1.0',
    '{}', 'custom',
    false, false, NOW(), NOW()
)
RETURNING id;

-- name: ForkPublicAlgorithm :one
INSERT INTO algorithms (
    publisher_id, name, description, configuration, version,
    formula_definition, calculation_type,
    is_active, is_public, forked_from, attribution_text,
    created_at, updated_at
) VALUES (
    $1, $2 || ' (Fork)', $3, $4, '1.0',
    '{}', 'custom',
    false, false, $5, $6, NOW(), NOW()
)
RETURNING id;

-- name: GetPublicAlgorithmWithPublisher :one
SELECT a.name, COALESCE(a.description, '') as description,
       COALESCE(a.configuration::text, '{}')::jsonb as configuration,
       p.name as publisher_name
FROM algorithms a
JOIN publishers p ON p.id = a.publisher_id
WHERE a.id = $1 AND a.is_public = true AND a.is_active = true;

-- name: IncrementAlgorithmForkCount :exec
UPDATE algorithms
SET fork_count = COALESCE(fork_count, 0) + 1
WHERE id = $1;

-- name: SetAlgorithmVisibility :exec
UPDATE algorithms
SET is_public = $1, updated_at = NOW()
WHERE publisher_id = $2;

-- name: GetPublisherForks :many
SELECT
    a.id, a.name, a.attribution_text,
    source.id as source_id, source.name as source_name,
    p.name as source_publisher
FROM algorithms a
JOIN algorithms source ON source.id = a.forked_from
JOIN publishers p ON p.id = source.publisher_id
WHERE a.publisher_id = $1 AND a.forked_from IS NOT NULL
ORDER BY a.created_at DESC;

-- ============================================================================
-- Queries for AlgorithmService (replacing raw SQL)
-- ============================================================================

-- DISABLED: Legacy queries with invalid column names (config, version, formula_definition)
-- These need to be updated to match current schema or removed
-- name: GetPublisherAlgorithmWithPriority :one
-- Get current algorithm for a publisher (published takes priority, then draft)
-- SELECT id, publisher_id, name, description,
--        COALESCE(config, formula_definition) as config,
--        COALESCE(status, 'draft') as status,
--        is_active, created_at, updated_at
-- FROM algorithms
-- WHERE publisher_id = $1
-- ORDER BY
--     CASE status
--         WHEN 'published' THEN 1
--         WHEN 'draft' THEN 2
--         ELSE 3
--     END,
--     created_at DESC
-- LIMIT 1;

-- name: UpdateAlgorithmDraftLegacy :one
-- Update existing draft algorithm
-- UPDATE algorithms
-- SET name = $1, description = $2, config = $3, updated_at = $4
-- WHERE id = $5 AND publisher_id = $6
-- RETURNING id, publisher_id, name, description, config::text as config_str, status, is_active, created_at, updated_at;

-- name: CreateAlgorithmDraft :one
-- Create new draft algorithm
-- INSERT INTO algorithms (publisher_id, name, description, config, status, is_active, created_at, updated_at)
-- VALUES ($1, $2, $3, $4, 'draft', false, $5, $6)
-- RETURNING id, publisher_id, name, description, config::text as config_str, status, is_active, created_at, updated_at;

-- name: GetActiveAlgorithmForPublisher :one
-- Get active algorithm for a publisher (for zmanim calculation)
-- SELECT id, publisher_id, name, description, version, configuration, is_active, created_at, updated_at
-- FROM algorithms
-- WHERE publisher_id = $1 AND is_active = true
-- ORDER BY created_at DESC
-- LIMIT 1;
