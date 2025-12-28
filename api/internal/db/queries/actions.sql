-- File: actions.sql
-- Purpose: Action reification queries for provenance tracking
-- Pattern: action-reification
-- Complexity: low (single concept - provenance)
-- Used by: All services that create/update state

-- name: RecordAction :one
-- Records a new action in the actions table (starts with 'pending' status)
-- Returns the action_id for tracking
INSERT INTO public.actions (
    action_type,
    concept,
    user_id,
    publisher_id,
    request_id,
    entity_type,
    entity_id,
    payload,
    parent_action_id,
    metadata
) VALUES (
    $1,  -- action_type
    $2,  -- concept
    $3,  -- user_id
    $4,  -- publisher_id
    $5,  -- request_id
    $6,  -- entity_type
    $7,  -- entity_id
    $8,  -- payload
    $9,  -- parent_action_id
    $10  -- metadata
) RETURNING id;

-- name: CompleteAction :exec
-- Marks an action as completed with result data
UPDATE public.actions
SET
    status = $2,           -- 'completed' or 'failed'
    result = $3,           -- result JSON
    error_message = $4,    -- error message if failed
    completed_at = now(),
    duration_ms = EXTRACT(EPOCH FROM (now() - started_at))::integer * 1000
WHERE id = $1;

-- name: GetActionsByRequest :many
-- Retrieves all actions for a given request ID (for debugging/audit)
SELECT
    id,
    action_type,
    concept,
    user_id,
    publisher_id,
    request_id,
    parent_action_id,
    entity_type,
    entity_id,
    payload,
    result,
    status,
    error_message,
    started_at,
    completed_at,
    duration_ms,
    metadata
FROM public.actions
WHERE request_id = $1
ORDER BY started_at ASC;

-- name: GetActionChain :many
-- Retrieves causal chain for an action (parent → child actions)
WITH RECURSIVE action_chain AS (
    -- Base case: starting action
    SELECT
        a.id,
        a.action_type,
        a.concept,
        a.parent_action_id,
        a.entity_type,
        a.entity_id,
        a.status,
        a.started_at,
        a.completed_at,
        1 AS depth
    FROM public.actions a
    WHERE a.id = $1

    UNION ALL

    -- Recursive case: child actions
    SELECT
        a.id,
        a.action_type,
        a.concept,
        a.parent_action_id,
        a.entity_type,
        a.entity_id,
        a.status,
        a.started_at,
        a.completed_at,
        ac.depth + 1
    FROM public.actions a
    INNER JOIN action_chain ac ON a.parent_action_id = ac.id AND ac.id != a.id
)
SELECT * FROM action_chain
ORDER BY depth ASC, started_at ASC;

-- name: GetEntityActionHistory :many
-- Retrieves all actions for a specific entity (e.g., all actions on publisher_zman #123)
SELECT
    id,
    action_type,
    concept,
    user_id,
    publisher_id,
    request_id,
    entity_type,
    entity_id,
    payload,
    result,
    status,
    started_at,
    completed_at,
    duration_ms
FROM public.actions
WHERE entity_type = $1 AND entity_id = $2
ORDER BY started_at DESC;

-- name: GetPublisherActivities :many
-- Retrieves all activities for a publisher (for activity log display)
SELECT
    id,
    action_type,
    concept,
    user_id,
    publisher_id,
    request_id,
    entity_type,
    entity_id,
    payload,
    result,
    status,
    error_message,
    started_at,
    completed_at,
    duration_ms,
    metadata
FROM public.actions
WHERE publisher_id = $1
ORDER BY started_at DESC
LIMIT $2 OFFSET $3;

-- name: GetAuditLogs :many
-- Returns all audit logs with extended filtering for admin (includes all events, not just admin_*)
SELECT
    a.id,
    a.action_type AS event_action,
    a.concept AS event_category,
    a.user_id AS actor_id,
    a.publisher_id,
    a.request_id,
    a.entity_type AS resource_type,
    a.entity_id AS resource_id,
    a.payload,
    a.result,
    a.status,
    a.error_message,
    a.started_at,
    a.completed_at,
    a.duration_ms,
    a.metadata,
    COALESCE(p.name, '') as publisher_name
FROM public.actions a
LEFT JOIN public.publishers p ON a.publisher_id = p.id
WHERE
    (sqlc.narg('event_action')::text IS NULL OR a.action_type = sqlc.narg('event_action'))
    AND (sqlc.narg('event_category')::text IS NULL OR a.concept = sqlc.narg('event_category'))
    AND (sqlc.narg('publisher_id_filter')::integer IS NULL OR a.publisher_id = sqlc.narg('publisher_id_filter'))
    AND (sqlc.narg('actor_id')::text IS NULL OR a.user_id = sqlc.narg('actor_id'))
    AND (sqlc.narg('status_filter')::text IS NULL OR a.status = sqlc.narg('status_filter'))
    AND (sqlc.narg('from_date')::timestamptz IS NULL OR a.started_at >= sqlc.narg('from_date'))
    AND (sqlc.narg('to_date')::timestamptz IS NULL OR a.started_at <= sqlc.narg('to_date'))
ORDER BY a.started_at DESC
LIMIT sqlc.arg('limit_count') OFFSET sqlc.arg('offset_count');

-- name: CountAuditLogs :one
-- Returns count for extended admin audit logs
SELECT COUNT(*)::bigint
FROM public.actions a
WHERE
    (sqlc.narg('event_action')::text IS NULL OR a.action_type = sqlc.narg('event_action'))
    AND (sqlc.narg('event_category')::text IS NULL OR a.concept = sqlc.narg('event_category'))
    AND (sqlc.narg('publisher_id_filter')::integer IS NULL OR a.publisher_id = sqlc.narg('publisher_id_filter'))
    AND (sqlc.narg('actor_id')::text IS NULL OR a.user_id = sqlc.narg('actor_id'))
    AND (sqlc.narg('status_filter')::text IS NULL OR a.status = sqlc.narg('status_filter'))
    AND (sqlc.narg('from_date')::timestamptz IS NULL OR a.started_at >= sqlc.narg('from_date'))
    AND (sqlc.narg('to_date')::timestamptz IS NULL OR a.started_at <= sqlc.narg('to_date'));

-- name: GetAuditLogByID :one
-- Returns a single audit log entry by ID
SELECT
    a.id,
    a.action_type,
    a.concept,
    a.user_id,
    a.publisher_id,
    a.request_id,
    a.entity_type,
    a.entity_id,
    a.payload,
    a.result,
    a.status,
    a.error_message,
    a.started_at,
    a.completed_at,
    a.duration_ms,
    a.metadata,
    a.parent_action_id,
    COALESCE(p.name, '') as publisher_name
FROM public.actions a
LEFT JOIN public.publishers p ON a.publisher_id = p.id
WHERE a.id = $1;

-- name: GetAuditStats24h :one
-- Returns audit statistics for the last 24 hours
SELECT COUNT(*)::bigint as total_events
FROM public.actions
WHERE started_at >= NOW() - INTERVAL '24 hours';

-- name: GetAuditStats7d :one
-- Returns audit statistics for the last 7 days
SELECT COUNT(*)::bigint as total_events
FROM public.actions
WHERE started_at >= NOW() - INTERVAL '7 days';

-- name: GetAuditStatsByCategory :many
-- Returns event counts grouped by category (concept)
SELECT
    COALESCE(concept, 'unknown') as category,
    COUNT(*)::bigint as event_count
FROM public.actions
WHERE started_at >= NOW() - INTERVAL '7 days'
GROUP BY concept
ORDER BY event_count DESC;

-- name: GetAuditStatsByAction :many
-- Returns event counts grouped by action type
SELECT
    CASE
        WHEN action_type LIKE '%_create' OR action_type LIKE 'create_%' THEN 'create'
        WHEN action_type LIKE '%_update' OR action_type LIKE 'update_%' THEN 'update'
        WHEN action_type LIKE '%_delete' OR action_type LIKE 'delete_%' THEN 'delete'
        ELSE 'other'
    END as action,
    COUNT(*)::bigint as event_count
FROM public.actions
WHERE started_at >= NOW() - INTERVAL '7 days'
GROUP BY action
ORDER BY event_count DESC;

-- name: GetAuditStatsByStatus :many
-- Returns event counts grouped by status
SELECT
    COALESCE(status, 'unknown') as status,
    COUNT(*)::bigint as event_count
FROM public.actions
WHERE started_at >= NOW() - INTERVAL '7 days'
GROUP BY status
ORDER BY event_count DESC;

-- name: GetTopActors :many
-- Returns top actors by event count
SELECT
    user_id,
    COUNT(*)::bigint as event_count
FROM public.actions
WHERE
    user_id IS NOT NULL
    AND started_at >= NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY event_count DESC
LIMIT $1;

-- name: GetTopPublishers :many
-- Returns top publishers by event count
SELECT
    a.publisher_id,
    p.name as publisher_name,
    COUNT(*)::bigint as event_count
FROM public.actions a
INNER JOIN public.publishers p ON a.publisher_id = p.id
WHERE
    a.publisher_id IS NOT NULL
    AND a.started_at >= NOW() - INTERVAL '7 days'
GROUP BY a.publisher_id, p.name
ORDER BY event_count DESC
LIMIT $1;

-- name: GetRecentCriticalEvents :many
-- Returns recent events with error or failed status (simulating critical severity)
SELECT
    a.id,
    a.action_type,
    a.concept,
    a.user_id,
    a.publisher_id,
    a.entity_type,
    a.entity_id,
    a.status,
    a.error_message,
    a.started_at,
    a.metadata,
    COALESCE(p.name, '') as publisher_name
FROM public.actions a
LEFT JOIN public.publishers p ON a.publisher_id = p.id
WHERE
    a.status IN ('failed', 'error')
    AND a.started_at >= NOW() - INTERVAL '7 days'
ORDER BY a.started_at DESC
LIMIT $1;
