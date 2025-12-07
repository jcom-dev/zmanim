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
