-- Migration: Create audit trail system
-- Purpose: Production-grade audit logging with hash chain tamper detection,
--          monthly partitioning, and comprehensive event tracking
-- Based on: AUDIT_SYSTEM_DESIGN.md and AUDIT_DATA_MODEL.md
--
-- Features:
--   - ULID-based event IDs (time-ordered, lexicographically sortable)
--   - Monthly partitioning for fast queries and easy archival
--   - Hash chain for tamper detection
--   - Immutability triggers (prevent UPDATE/DELETE)
--   - JSONB diff computation for UPDATE operations
--   - Meta-auditing (audit access log)
--   - Export job tracking
--   - Retention policy management

-- ============================================================================
-- SCHEMA SETUP
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS audit_archive;

-- Enable required extensions (pgcrypto needed for SHA-256 hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ULID GENERATION FUNCTION
-- ============================================================================
-- ULID: Universally Unique Lexicographically Sortable Identifier
-- Format: 10-char timestamp (48-bit ms) + 16-char random (80-bit) = 26 chars
-- Benefits: Time-ordered, 50% less WAL than UUIDv4, better index performance

CREATE OR REPLACE FUNCTION audit.ulid_generate()
RETURNS TEXT AS $$
DECLARE
    timestamp_part BIGINT;
    encoding TEXT := '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; -- Crockford's Base32
    result TEXT := '';
    random_bytes BYTEA;
    i INTEGER;
BEGIN
    -- Get millisecond timestamp (48 bits)
    timestamp_part := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000);

    -- Encode timestamp (10 characters)
    FOR i IN 1..10 LOOP
        result := substr(encoding, (timestamp_part % 32) + 1, 1) || result;
        timestamp_part := timestamp_part / 32;
    END LOOP;

    -- Generate random part using pgcrypto (80 bits = 16 characters)
    -- Use gen_random_bytes for cryptographically secure randomness
    random_bytes := gen_random_bytes(10); -- 10 bytes = 80 bits
    FOR i IN 0..15 LOOP
        -- Extract 5 bits at a time for base32 encoding
        IF i < 10 THEN
            result := result || substr(encoding, (get_byte(random_bytes, i / 2) >> (4 - (i % 2) * 4) & 31) + 1, 1);
        ELSE
            result := result || substr(encoding, (get_byte(random_bytes, (i - 6) / 2) >> ((i % 2) * 4) & 31) + 1, 1);
        END IF;
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION audit.ulid_generate() IS
'Generates a ULID (Universally Unique Lexicographically Sortable Identifier).
Format: 10-char timestamp + 16-char random = 26 chars total.
Uses pgcrypto for cryptographically secure random component.';

-- ============================================================================
-- JSONB DIFF UTILITY FUNCTION
-- ============================================================================
-- Computes the difference between two JSONB objects
-- Returns only changed fields with before/after values

CREATE OR REPLACE FUNCTION audit.jsonb_diff(old_data JSONB, new_data JSONB)
RETURNS JSONB AS $$
DECLARE
    result JSONB := '{}'::JSONB;
    key TEXT;
BEGIN
    -- Handle NULL inputs
    IF old_data IS NULL AND new_data IS NULL THEN
        RETURN NULL;
    END IF;
    IF old_data IS NULL THEN
        old_data := '{}'::JSONB;
    END IF;
    IF new_data IS NULL THEN
        new_data := '{}'::JSONB;
    END IF;

    -- Find changed and new keys
    FOR key IN SELECT jsonb_object_keys(new_data) LOOP
        IF old_data ? key THEN
            IF old_data->key IS DISTINCT FROM new_data->key THEN
                result := result || jsonb_build_object(
                    key,
                    jsonb_build_object(
                        'before', old_data->key,
                        'after', new_data->key
                    )
                );
            END IF;
        ELSE
            -- New key added
            result := result || jsonb_build_object(
                key,
                jsonb_build_object(
                    'before', NULL,
                    'after', new_data->key
                )
            );
        END IF;
    END LOOP;

    -- Find deleted keys
    FOR key IN SELECT jsonb_object_keys(old_data) LOOP
        IF NOT new_data ? key THEN
            result := result || jsonb_build_object(
                key,
                jsonb_build_object(
                    'before', old_data->key,
                    'after', NULL
                )
            );
        END IF;
    END LOOP;

    -- Return NULL if no differences
    IF result = '{}'::JSONB THEN
        RETURN NULL;
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION audit.jsonb_diff(JSONB, JSONB) IS
'Computes diff between two JSONB objects. Returns only changed fields with before/after values.
Used for audit.events.changes_diff column to track exactly what changed in UPDATE operations.';

-- ============================================================================
-- PII MASKING FUNCTION
-- ============================================================================
-- Masks personally identifiable information for privacy compliance

CREATE OR REPLACE FUNCTION audit.mask_email(email TEXT)
RETURNS TEXT AS $$
BEGIN
    IF email IS NULL OR email = '' THEN
        RETURN email;
    END IF;

    -- Mask format: first char + *** @ first char + ***.domain
    -- Example: john.doe@example.com -> j***@e***.com
    RETURN
        LEFT(SPLIT_PART(email, '@', 1), 1) || '***@' ||
        LEFT(SPLIT_PART(SPLIT_PART(email, '@', 2), '.', 1), 1) || '***.' ||
        (SELECT string_agg(part, '.') FROM (
            SELECT part FROM unnest(
                string_to_array(SPLIT_PART(email, '@', 2), '.')
            ) WITH ORDINALITY AS t(part, ord)
            WHERE ord > 1
        ) s);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION audit.mask_ip(ip INET)
RETURNS TEXT AS $$
BEGIN
    IF ip IS NULL THEN
        RETURN NULL;
    END IF;

    -- Mask last two octets for IPv4, last 4 groups for IPv6
    IF family(ip) = 4 THEN
        RETURN split_part(host(ip), '.', 1) || '.' ||
               split_part(host(ip), '.', 2) || '.*.*';
    ELSE
        -- IPv6: show first 4 groups
        RETURN split_part(host(ip), ':', 1) || ':' ||
               split_part(host(ip), ':', 2) || ':' ||
               split_part(host(ip), ':', 3) || ':' ||
               split_part(host(ip), ':', 4) || ':****:****:****:****';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION audit.mask_email(TEXT) IS
'Masks email addresses for privacy. Example: john@example.com -> j***@e***.com';

COMMENT ON FUNCTION audit.mask_ip(INET) IS
'Masks IP addresses for privacy. Example: 192.168.1.100 -> 192.168.*.*';

-- ============================================================================
-- AUDIT EVENTS TABLE (PARTITIONED BY MONTH)
-- ============================================================================

CREATE TABLE audit.events (
    -- Primary Identification
    id                      TEXT NOT NULL DEFAULT audit.ulid_generate(),
    sequence_num            BIGSERIAL,

    -- Event Classification
    event_category          VARCHAR(50) NOT NULL,           -- 'publisher', 'zman', 'auth', etc.
    event_action            VARCHAR(50) NOT NULL,           -- 'create', 'update', 'delete', etc.
    event_type              VARCHAR(100) NOT NULL,          -- Computed: '{category}.{action}'
    event_severity          VARCHAR(20) NOT NULL DEFAULT 'info',

    -- Temporal
    occurred_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Actor Information
    actor_user_id           TEXT,                           -- Internal user ID
    actor_clerk_id          TEXT,                           -- Clerk auth provider ID
    actor_name              TEXT,                           -- Display name
    actor_email             TEXT,                           -- Email (may be masked)
    actor_ip_address        INET,                           -- Source IP
    actor_user_agent        TEXT,                           -- Browser/API client info
    actor_is_system         BOOLEAN NOT NULL DEFAULT FALSE, -- Automated action flag

    -- Impersonation Support (for admin acting-as-user)
    impersonator_user_id    TEXT,
    impersonator_name       TEXT,

    -- API Authentication (for M2M requests)
    api_key_id              TEXT,
    api_key_name            TEXT,

    -- Publisher Context (Tenant Isolation)
    publisher_id            INTEGER,                        -- FK to publishers
    publisher_slug          TEXT,                           -- For easier querying

    -- Resource Identification
    resource_type           VARCHAR(50),                    -- 'publisher', 'zman', 'coverage', etc.
    resource_id             TEXT,                           -- Primary key of affected resource
    resource_name           TEXT,                           -- Human-readable name

    -- Parent Resource (for nested resources)
    parent_resource_type    VARCHAR(50),
    parent_resource_id      TEXT,

    -- Change Tracking
    operation_type          VARCHAR(20) NOT NULL,           -- 'CREATE', 'UPDATE', 'DELETE', etc.
    changes_before          JSONB,                          -- State before change
    changes_after           JSONB,                          -- State after change
    changes_diff            JSONB,                          -- Computed diff (UPDATE only)

    -- Request Correlation
    request_id              UUID NOT NULL DEFAULT gen_random_uuid(),
    trace_id                TEXT,                           -- Distributed tracing
    session_id              TEXT,                           -- User session

    -- Transaction Grouping
    transaction_id          TEXT,                           -- Group related events
    parent_event_id         TEXT,                           -- Parent event reference

    -- Outcome
    status                  VARCHAR(20) NOT NULL DEFAULT 'success',
    error_code              VARCHAR(50),
    error_message           TEXT,

    -- Performance
    duration_ms             INTEGER,

    -- Geolocation (for security analysis)
    geo_country_code        CHAR(2),
    geo_city                TEXT,

    -- Metadata
    metadata                JSONB,                          -- Flexible additional data
    tags                    TEXT[],                         -- Searchable tags

    -- Tamper Detection (Hash Chain)
    event_hash              TEXT,                           -- SHA-256 hash of this event
    previous_event_hash     TEXT,                           -- Hash of previous event

    -- Schema Version (for forward compatibility)
    schema_version          SMALLINT NOT NULL DEFAULT 1,

    -- Retention Management
    retention_tier          VARCHAR(20) NOT NULL DEFAULT 'standard',
    archived_at             TIMESTAMPTZ,

    -- Constraints
    PRIMARY KEY (occurred_at, id),
    CONSTRAINT event_type_format CHECK (event_type = event_category || '.' || event_action),
    CONSTRAINT valid_operation_type CHECK (operation_type IN ('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXECUTE', 'GRANT', 'REVOKE')),
    CONSTRAINT valid_status CHECK (status IN ('success', 'failure', 'partial', 'error')),
    CONSTRAINT valid_severity CHECK (event_severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    CONSTRAINT valid_retention_tier CHECK (retention_tier IN ('critical', 'standard', 'operational'))
) PARTITION BY RANGE (occurred_at);

COMMENT ON TABLE audit.events IS
'Comprehensive audit trail for all system events. Partitioned by month for performance and retention management.
Uses ULID for time-ordered event IDs. Hash chain provides tamper detection.';

-- ============================================================================
-- INITIAL PARTITIONS (6 months forward)
-- ============================================================================
-- Create partitions for current and upcoming months

CREATE TABLE audit.events_2025_12 PARTITION OF audit.events
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE audit.events_2026_01 PARTITION OF audit.events
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE audit.events_2026_02 PARTITION OF audit.events
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE audit.events_2026_03 PARTITION OF audit.events
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE audit.events_2026_04 PARTITION OF audit.events
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE audit.events_2026_05 PARTITION OF audit.events
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Default partition for dates outside defined ranges
CREATE TABLE audit.events_default PARTITION OF audit.events DEFAULT;

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Optimized for common query patterns

-- Time-range queries (most common pattern)
CREATE INDEX idx_audit_events_occurred_at ON audit.events (occurred_at DESC, id DESC);

-- Actor lookups - find all events by a user
CREATE INDEX idx_audit_events_actor ON audit.events (actor_clerk_id, occurred_at DESC)
    WHERE actor_clerk_id IS NOT NULL;

-- Publisher-scoped queries (tenant isolation)
CREATE INDEX idx_audit_events_publisher ON audit.events (publisher_id, occurred_at DESC)
    WHERE publisher_id IS NOT NULL;

-- Resource lookups - find all events for a specific resource
CREATE INDEX idx_audit_events_resource ON audit.events (resource_type, resource_id, occurred_at DESC)
    WHERE resource_type IS NOT NULL;

-- Event type filtering
CREATE INDEX idx_audit_events_event_type ON audit.events (event_type, occurred_at DESC);

-- Request correlation - link audit events to application logs
CREATE INDEX idx_audit_events_request_id ON audit.events (request_id);

-- Failed events (monitoring/alerting)
CREATE INDEX idx_audit_events_status ON audit.events (status, occurred_at DESC)
    WHERE status IN ('failure', 'error');

-- Composite: Publisher + Event Type (common filter combination)
CREATE INDEX idx_audit_events_publisher_type ON audit.events (publisher_id, event_type, occurred_at DESC)
    WHERE publisher_id IS NOT NULL;

-- GIN indexes for JSONB and array searching
CREATE INDEX idx_audit_events_metadata ON audit.events USING GIN (metadata jsonb_path_ops);
CREATE INDEX idx_audit_events_tags ON audit.events USING GIN (tags);

-- Sequence number for hash chain validation
CREATE INDEX idx_audit_events_sequence ON audit.events (sequence_num);

-- ============================================================================
-- HASH CHAIN COMPUTATION TRIGGER
-- ============================================================================
-- Creates a tamper-evident chain by including previous event's hash

CREATE OR REPLACE FUNCTION audit.compute_event_hash()
RETURNS TRIGGER AS $$
DECLARE
    last_hash TEXT;
    hash_input TEXT;
BEGIN
    -- Get the most recent event hash (within recent timeframe for performance)
    SELECT event_hash INTO last_hash
    FROM audit.events
    WHERE occurred_at >= (NEW.occurred_at - INTERVAL '1 day')
    ORDER BY occurred_at DESC, sequence_num DESC
    LIMIT 1;

    NEW.previous_event_hash := last_hash;

    -- Build hash input from key event fields
    hash_input := COALESCE(last_hash, '') ||
                  NEW.sequence_num::TEXT ||
                  NEW.occurred_at::TEXT ||
                  COALESCE(NEW.actor_clerk_id, '') ||
                  NEW.event_type ||
                  COALESCE(NEW.resource_type, '') ||
                  COALESCE(NEW.resource_id, '') ||
                  COALESCE(NEW.changes_after::TEXT, '');

    -- Compute SHA-256 hash
    NEW.event_hash := encode(digest(hash_input, 'sha256'), 'hex');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION audit.compute_event_hash() IS
'Trigger function that computes SHA-256 hash chain for tamper detection.
Each event hash includes the previous event hash, creating an immutable chain.';

CREATE TRIGGER trigger_compute_event_hash
    BEFORE INSERT ON audit.events
    FOR EACH ROW
    EXECUTE FUNCTION audit.compute_event_hash();

-- ============================================================================
-- DIFF COMPUTATION TRIGGER
-- ============================================================================
-- Automatically computes changes_diff for UPDATE operations

CREATE OR REPLACE FUNCTION audit.compute_diff()
RETURNS TRIGGER AS $$
BEGIN
    -- Only compute diff for UPDATE operations with both before and after states
    IF NEW.operation_type = 'UPDATE'
       AND NEW.changes_before IS NOT NULL
       AND NEW.changes_after IS NOT NULL THEN
        NEW.changes_diff := audit.jsonb_diff(NEW.changes_before, NEW.changes_after);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION audit.compute_diff() IS
'Trigger function that automatically computes changes_diff from before/after states.';

CREATE TRIGGER trigger_compute_diff
    BEFORE INSERT ON audit.events
    FOR EACH ROW
    EXECUTE FUNCTION audit.compute_diff();

-- ============================================================================
-- IMMUTABILITY ENFORCEMENT TRIGGER
-- ============================================================================
-- Audit events MUST be immutable - prevent UPDATE and DELETE

CREATE OR REPLACE FUNCTION audit.prevent_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit events are immutable. UPDATE and DELETE operations are prohibited. Event ID: %',
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.id ELSE OLD.id END;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION audit.prevent_modification() IS
'Enforces immutability of audit events. Prevents all UPDATE and DELETE operations.';

CREATE TRIGGER trigger_prevent_update
    BEFORE UPDATE ON audit.events
    FOR EACH ROW
    EXECUTE FUNCTION audit.prevent_modification();

CREATE TRIGGER trigger_prevent_delete
    BEFORE DELETE ON audit.events
    FOR EACH ROW
    EXECUTE FUNCTION audit.prevent_modification();

-- ============================================================================
-- AUDIT ACCESS LOG (Meta-Auditing)
-- ============================================================================
-- Tracks who accesses audit data and when (auditing the audit)

CREATE TABLE audit.access_log (
    id                      BIGSERIAL PRIMARY KEY,
    accessor_user_id        INTEGER,                        -- Internal user ID
    accessor_clerk_id       TEXT,                           -- Clerk auth ID
    accessor_role           VARCHAR(50),                    -- admin, publisher, etc.
    accessed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    query_type              VARCHAR(50) NOT NULL,           -- list, get, export, search
    date_range_start        TIMESTAMPTZ,                    -- Query filter start
    date_range_end          TIMESTAMPTZ,                    -- Query filter end
    filters                 JSONB,                          -- Applied filters
    access_method           VARCHAR(50),                    -- api, ui, export
    ip_address              INET,
    user_agent              TEXT,
    records_returned        INTEGER,                        -- Result count
    records_exported        INTEGER,                        -- Export count
    justification           TEXT,                           -- Why access was needed
    request_id              UUID                            -- Correlation ID
);

CREATE INDEX idx_audit_access_log_user ON audit.access_log (accessor_clerk_id, accessed_at DESC);
CREATE INDEX idx_audit_access_log_date ON audit.access_log (accessed_at DESC);

COMMENT ON TABLE audit.access_log IS
'Meta-audit table: tracks who accesses the audit log, when, and what they queried.
Required for SOC 2 compliance and security monitoring.';

-- ============================================================================
-- EXPORT JOBS TABLE
-- ============================================================================
-- Tracks audit log export requests and their status

CREATE TABLE audit.export_jobs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 TEXT NOT NULL,                  -- Requestor
    publisher_id            INTEGER,                        -- Scope (NULL = admin)
    format                  VARCHAR(10) NOT NULL,           -- csv, json
    filters                 JSONB NOT NULL,                 -- Applied filters
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending',
    file_path               TEXT,                           -- Output file location
    file_size_bytes         BIGINT,
    entry_count             INTEGER,
    error_message           TEXT,
    requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    expires_at              TIMESTAMPTZ,                    -- Download link expiry

    CONSTRAINT valid_export_format CHECK (format IN ('csv', 'json')),
    CONSTRAINT valid_export_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX idx_export_jobs_user ON audit.export_jobs (user_id, requested_at DESC);
CREATE INDEX idx_export_jobs_status ON audit.export_jobs (status) WHERE status IN ('pending', 'processing');

COMMENT ON TABLE audit.export_jobs IS
'Tracks audit log export jobs. Supports async export for large datasets.
Exports expire after a configurable period for security.';

-- ============================================================================
-- RETENTION POLICIES TABLE
-- ============================================================================
-- Defines how long events are retained based on type

CREATE TABLE audit.retention_policies (
    id                      SERIAL PRIMARY KEY,
    event_category          VARCHAR(50) NOT NULL,
    event_action            VARCHAR(50),                    -- NULL = all actions in category
    retention_days_hot      INTEGER NOT NULL DEFAULT 90,    -- Active partitions (SSD)
    retention_days_warm     INTEGER NOT NULL DEFAULT 365,   -- Queryable archive
    retention_days_cold     INTEGER NOT NULL DEFAULT 2555,  -- Deep archive (7 years)
    permanent_retention     BOOLEAN NOT NULL DEFAULT FALSE, -- Never delete
    compliance_reason       TEXT,                           -- GDPR, SOC 2, etc.
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(event_category, event_action)
);

COMMENT ON TABLE audit.retention_policies IS
'Defines retention policies per event type. Hot = active queries, Warm = occasional access, Cold = archive.
permanent_retention=true means never delete (required for some compliance scenarios).';

-- Seed default retention policies based on compliance requirements
INSERT INTO audit.retention_policies (event_category, event_action, retention_days_hot, retention_days_warm, retention_days_cold, permanent_retention, compliance_reason) VALUES
    -- Authentication events - security monitoring
    ('auth', NULL, 90, 365, 2555, FALSE, 'Security monitoring, SOC 2 requirement'),
    -- Publisher lifecycle - business critical
    ('publisher', 'create', 90, 365, 2555, TRUE, 'Business critical event, permanent retention'),
    ('publisher', 'delete', 90, 365, 2555, TRUE, 'GDPR erasure evidence, must retain proof'),
    ('publisher', 'update', 90, 365, 730, FALSE, 'Standard business record'),
    -- Zman operations - operational
    ('zman', NULL, 90, 365, 730, FALSE, 'Operational data'),
    -- Coverage changes - geographic
    ('coverage', NULL, 90, 180, 365, FALSE, 'Geographic coverage changes'),
    -- Algorithm/formula versioning
    ('algorithm', NULL, 90, 365, 730, FALSE, 'Formula versioning for audit'),
    -- User management - compliance
    ('user', 'delete', 90, 365, 2555, TRUE, 'GDPR right to erasure evidence'),
    ('user', 'create', 90, 365, 1095, FALSE, 'User onboarding record'),
    -- API key management - security
    ('api_key', NULL, 90, 365, 2555, TRUE, 'Security-critical, track all API key events'),
    -- Export tracking
    ('export', NULL, 90, 180, 365, FALSE, 'Data export audit');

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- Recent events (performance-optimized for dashboards)
CREATE VIEW audit.recent_events AS
SELECT * FROM audit.events
WHERE occurred_at >= NOW() - INTERVAL '7 days'
ORDER BY occurred_at DESC;

COMMENT ON VIEW audit.recent_events IS
'Performance-optimized view for recent audit events (last 7 days). Used for dashboards.';

-- Failed events (monitoring/alerting)
CREATE VIEW audit.failed_events AS
SELECT * FROM audit.events
WHERE status IN ('failure', 'error')
  AND occurred_at >= NOW() - INTERVAL '24 hours'
ORDER BY occurred_at DESC;

COMMENT ON VIEW audit.failed_events IS
'Failed/error events in the last 24 hours for alerting and monitoring.';

-- ============================================================================
-- HASH CHAIN VALIDATION FUNCTION
-- ============================================================================
-- Validates the integrity of the audit event hash chain

CREATE OR REPLACE FUNCTION audit.validate_hash_chain(
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
    event_id TEXT,
    occurred_at TIMESTAMPTZ,
    is_valid BOOLEAN,
    error_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH ordered_events AS (
        SELECT
            e.id,
            e.occurred_at,
            e.event_hash,
            e.previous_event_hash,
            LAG(e.event_hash) OVER (ORDER BY e.occurred_at, e.sequence_num) AS expected_previous
        FROM audit.events e
        WHERE e.occurred_at BETWEEN p_start_date AND p_end_date
        ORDER BY e.occurred_at, e.sequence_num
    )
    SELECT
        oe.id,
        oe.occurred_at,
        CASE
            -- First event in range may have NULL or external previous hash
            WHEN oe.previous_event_hash IS NULL AND oe.expected_previous IS NULL THEN TRUE
            WHEN oe.previous_event_hash = oe.expected_previous THEN TRUE
            ELSE FALSE
        END AS is_valid,
        CASE
            WHEN oe.previous_event_hash IS DISTINCT FROM oe.expected_previous THEN
                format('Hash chain broken: expected %s, got %s',
                    COALESCE(oe.expected_previous, 'NULL'),
                    COALESCE(oe.previous_event_hash, 'NULL'))
            ELSE NULL
        END AS error_reason
    FROM ordered_events oe
    WHERE oe.previous_event_hash IS DISTINCT FROM oe.expected_previous;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION audit.validate_hash_chain(TIMESTAMPTZ, TIMESTAMPTZ) IS
'Validates the integrity of the audit event hash chain for a given time period.
Returns only events with broken chains (empty result = chain is valid).
Use for compliance audits and tamper detection.';

-- ============================================================================
-- PARTITION MANAGEMENT HELPER
-- ============================================================================
-- Function to create new monthly partitions (call via pg_cron or manually)

CREATE OR REPLACE FUNCTION audit.create_monthly_partition(
    p_year INTEGER,
    p_month INTEGER
)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := format('events_%s_%s', p_year, LPAD(p_month::TEXT, 2, '0'));
    start_date := make_date(p_year, p_month, 1);
    end_date := start_date + INTERVAL '1 month';

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS audit.%I PARTITION OF audit.events
         FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        start_date,
        end_date
    );

    RAISE NOTICE 'Created partition audit.% for % to %', partition_name, start_date, end_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION audit.create_monthly_partition(INTEGER, INTEGER) IS
'Creates a new monthly partition for audit.events. Call with year and month.
Example: SELECT audit.create_monthly_partition(2026, 6);';

-- ============================================================================
-- DOWN MIGRATION (ROLLBACK)
-- ============================================================================
-- To rollback: Run the following in a separate migration or manually
--
-- DROP SCHEMA IF EXISTS audit CASCADE;
-- DROP SCHEMA IF EXISTS audit_archive CASCADE;
--
-- Note: CASCADE will drop all tables, functions, and views in the schemas
