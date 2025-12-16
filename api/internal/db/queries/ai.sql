-- name: GetCachedExplanation :one
SELECT explanation
FROM explanation_cache
WHERE formula_hash = $1 AND language = $2 AND expires_at > NOW();

-- name: UpsertExplanationCache :exec
INSERT INTO explanation_cache (formula_hash, language, explanation, expires_at, source_id)
VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', 1)
ON CONFLICT (formula_hash, language)
DO UPDATE SET
    explanation = EXCLUDED.explanation,
    expires_at = NOW() + INTERVAL '7 days',
    source_id = EXCLUDED.source_id;

-- name: InsertAIAuditLog :exec
INSERT INTO ai_audit_logs (
    publisher_id, user_id, request_type, input_text, output_text,
    tokens_used, model, confidence, success, error_message,
    duration_ms, rag_context_used
) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9, $10, $11, $12
);

-- name: GetAIAuditLogs :many
SELECT id, publisher_id, user_id, request_type, input_text, output_text,
       tokens_used, model, confidence, success, error_message,
       duration_ms, rag_context_used, created_at
FROM ai_audit_logs
WHERE ($1 = '' OR request_type = $1)
ORDER BY created_at DESC
LIMIT $2;
