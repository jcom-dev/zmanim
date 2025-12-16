-- ============================================================================
-- Publisher Registration Tokens - SQLc Queries
-- Story 8-37: Unified Publisher Onboarding Flow
-- ============================================================================

-- =============================================================================
-- BLOCKED EMAILS
-- =============================================================================

-- name: IsEmailBlocked :one
SELECT EXISTS(
    SELECT 1 FROM blocked_emails WHERE LOWER(email) = LOWER(@email::text)
) AS blocked;

-- name: BlockEmail :exec
INSERT INTO blocked_emails (email, blocked_by, reason)
VALUES (LOWER(@email::text), @blocked_by, @reason)
ON CONFLICT ((LOWER(email))) DO NOTHING;

-- name: GetBlockedEmails :many
SELECT * FROM blocked_emails
ORDER BY blocked_at DESC;

-- name: UnblockEmail :exec
DELETE FROM blocked_emails
WHERE LOWER(email) = LOWER(@email::text);

-- =============================================================================
-- REGISTRATION TOKEN CREATION
-- =============================================================================

-- name: CreateRegistrationToken :one
INSERT INTO publisher_registration_tokens (
    first_name,
    last_name,
    registrant_email,
    publisher_data,
    token,
    status,
    recaptcha_score,
    expires_at
) VALUES (
    @first_name,
    @last_name,
    LOWER(@registrant_email::text),
    @publisher_data,
    @token,
    'pending_verification',
    @recaptcha_score,
    NOW() + INTERVAL '7 days'
) RETURNING *;

-- name: CreateRegistrationTokenWithExpiry :one
-- For testing or custom expiry
INSERT INTO publisher_registration_tokens (
    first_name,
    last_name,
    registrant_email,
    publisher_data,
    token,
    status,
    recaptcha_score,
    expires_at
) VALUES (
    @first_name,
    @last_name,
    LOWER(@registrant_email::text),
    @publisher_data,
    @token,
    'pending_verification',
    @recaptcha_score,
    @expires_at
) RETURNING *;

-- =============================================================================
-- TOKEN LOOKUP
-- =============================================================================

-- name: GetRegistrationTokenByToken :one
SELECT * FROM publisher_registration_tokens
WHERE token = @token
LIMIT 1;

-- name: GetRegistrationTokenByID :one
SELECT * FROM publisher_registration_tokens
WHERE id = @id;

-- name: GetRegistrationByEmail :many
-- Get all registrations for an email (for duplicate detection)
SELECT * FROM publisher_registration_tokens
WHERE LOWER(registrant_email) = LOWER(@email::text)
ORDER BY created_at DESC;

-- =============================================================================
-- VERIFICATION FLOW
-- =============================================================================

-- name: MarkTokenVerified :exec
UPDATE publisher_registration_tokens
SET
    status = 'verified',
    verified_at = NOW(),
    user_exists = @user_exists,
    existing_clerk_user_id = @existing_clerk_user_id
WHERE token = @token
  AND status = 'pending_verification';

-- name: ConfirmExistingUser :exec
UPDATE publisher_registration_tokens
SET confirmed_existing_user = true
WHERE token = @token
  AND status = 'verified';

-- name: CancelRegistration :exec
UPDATE publisher_registration_tokens
SET status = 'cancelled'
WHERE token = @token;

-- =============================================================================
-- ADMIN REVIEW
-- =============================================================================

-- name: GetVerifiedRegistrations :many
-- Get all verified applications ready for admin review
SELECT * FROM publisher_registration_tokens
WHERE status = 'verified'
ORDER BY created_at DESC;

-- name: GetRegistrationsByStatus :many
SELECT * FROM publisher_registration_tokens
WHERE status = @status
ORDER BY created_at DESC;

-- name: ApproveRegistration :exec
UPDATE publisher_registration_tokens
SET
    status = 'approved',
    reviewed_by = @reviewed_by,
    reviewed_at = NOW()
WHERE id = @id;

-- name: RejectRegistration :exec
UPDATE publisher_registration_tokens
SET
    status = 'rejected',
    reviewed_by = @reviewed_by,
    reviewed_at = NOW(),
    rejection_message = @rejection_message
WHERE id = @id;

-- =============================================================================
-- STATUS UPDATES (Legacy compatibility + new statuses)
-- =============================================================================

-- name: UpdateRegistrationTokenStatus :exec
UPDATE publisher_registration_tokens
SET status = @status,
    user_exists = @user_exists,
    verified_at = CASE WHEN @status = 'verified' THEN NOW() ELSE verified_at END,
    completed_at = CASE WHEN @status = 'completed' OR @status = 'approved' THEN NOW() ELSE completed_at END
WHERE token = @token;

-- name: MarkTokenCompleted :exec
UPDATE publisher_registration_tokens
SET status = 'completed',
    completed_at = NOW()
WHERE token = @token;

-- =============================================================================
-- CLEANUP
-- =============================================================================

-- name: CleanupExpiredTokens :execrows
-- Mark pending tokens as expired
UPDATE publisher_registration_tokens
SET status = 'expired'
WHERE status = 'pending_verification'
  AND expires_at < NOW();

-- name: DeleteExpiredRegistrationTokens :exec
-- Hard delete very old expired/cancelled tokens (30 days)
DELETE FROM publisher_registration_tokens
WHERE status IN ('expired', 'cancelled')
  AND created_at < NOW() - INTERVAL '30 days';

-- name: DeleteOldCompletedTokens :exec
DELETE FROM publisher_registration_tokens
WHERE status IN ('completed', 'approved')
  AND completed_at < NOW() - INTERVAL '30 days';

-- =============================================================================
-- DUPLICATE DETECTION
-- =============================================================================

-- name: CheckPublisherNameExists :one
-- Check if a publisher with this name already exists (case-insensitive)
SELECT EXISTS(
    SELECT 1 FROM publishers WHERE LOWER(name) = LOWER(@name::text)
) AS exists;

-- name: CheckPublisherContactEmailExists :one
-- Check if a publisher with this contact email already exists (case-insensitive)
SELECT EXISTS(
    SELECT 1 FROM publishers WHERE LOWER(contact_email) = LOWER(@email::text)
) AS exists;

-- name: CheckPendingRegistrationByName :one
-- Check if there's a pending/verified registration with this publisher name
SELECT EXISTS(
    SELECT 1 FROM publisher_registration_tokens
    WHERE status IN ('pending_verification', 'verified')
      AND publisher_data->>'publisher_name' ILIKE @name::text
) AS exists;

-- name: CheckPendingRegistrationByContactEmail :one
-- Check if there's a pending/verified registration with this contact email
SELECT EXISTS(
    SELECT 1 FROM publisher_registration_tokens
    WHERE status IN ('pending_verification', 'verified')
      AND publisher_data->>'publisher_contact_email' ILIKE @email::text
) AS exists;

-- =============================================================================
-- STATISTICS
-- =============================================================================

-- name: GetRegistrationTokenStats :one
SELECT
    COUNT(*) FILTER (WHERE status = 'pending_verification') as pending_count,
    COUNT(*) FILTER (WHERE status = 'verified') as verified_count,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
    COUNT(*) FILTER (WHERE expires_at < NOW() AND status = 'pending_verification') as expired_count
FROM publisher_registration_tokens;
