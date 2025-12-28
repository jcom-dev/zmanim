# Audit System Design Document

**Version:** 1.0
**Status:** Ready for Implementation
**Author:** Agent 7 - System Design Architect
**Date:** 2025-12-26
**Based On:** Phase 1 Research (AUDIT_RESEARCH_LIBRARIES.md, AUDIT_DATA_MODEL.md, AUDIT_API_DESIGN.md, AUDIT_UX_PATTERNS.md, AUDIT_PERFORMANCE.md, AUDIT_COMPLIANCE.md)

---

## 1. Executive Summary

### Purpose

This document provides a complete, implementation-ready design for a production-grade audit trail system for the Zmanim platform. It synthesizes research from 6 Phase 1 documents covering libraries, data models, APIs, UX patterns, performance, and compliance requirements.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Event ID Format** | ULID (26 characters) | Time-ordered, lexicographically sortable, 50% less WAL than UUIDv4 |
| **Storage** | PostgreSQL with monthly partitions | Existing infrastructure, mature partitioning, pg_partman automation |
| **Write Pattern** | Async buffered channel + COPY protocol | 0ms API latency, 35K+ events/sec throughput |
| **Pagination** | Cursor-based (timestamp + id) | 17x faster than offset for deep pages |
| **Tamper Detection** | SHA-256 hash chain | Database-level integrity, no external dependencies |
| **Retention** | 3-tier (Hot 90d / Warm 1yr / Cold 7yr) | SOC 2 + GDPR compliance, S3 Glacier for cost |
| **UI Pattern** | Timeline-based table with diff visualization | Industry standard (Stripe, GitHub, Linear) |

### Integration with Existing Infrastructure

The audit system integrates with:
- **Existing `actions` table**: Parallel operation during migration, eventual replacement
- **ActivityService**: Wrap existing service for backward compatibility
- **PublisherResolver**: Reuse for tenant isolation
- **Clerk authentication**: Extract actor context from JWT claims
- **Redis**: Cache for dashboard aggregations and rate limiting
- **SQLc**: All queries generated, no raw SQL

---

## 2. Data Model (Final Schema)

### 2.1 Core Schema

```sql
-- ============================================================================
-- SCHEMA SETUP
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS audit_archive;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ULID GENERATION FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION audit.ulid_generate()
RETURNS TEXT AS $$
DECLARE
    timestamp_part BIGINT;
    encoding TEXT := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    result TEXT := '';
    i INTEGER;
BEGIN
    timestamp_part := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000);

    FOR i IN 1..10 LOOP
        result := substr(encoding, (timestamp_part % 32) + 1, 1) || result;
        timestamp_part := timestamp_part / 32;
    END LOOP;

    FOR i IN 1..16 LOOP
        result := result || substr(encoding, FLOOR(random() * 32) + 1, 1);
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ============================================================================
-- JSONB DIFF UTILITY
-- ============================================================================
CREATE OR REPLACE FUNCTION audit.jsonb_diff(old_data JSONB, new_data JSONB)
RETURNS JSONB AS $$
DECLARE
    result JSONB := '{}'::JSONB;
    key TEXT;
BEGIN
    FOR key IN SELECT jsonb_object_keys(new_data) LOOP
        IF old_data ? key THEN
            IF old_data->key IS DISTINCT FROM new_data->key THEN
                result := result || jsonb_build_object(
                    key, jsonb_build_object('before', old_data->key, 'after', new_data->key)
                );
            END IF;
        ELSE
            result := result || jsonb_build_object(
                key, jsonb_build_object('before', NULL, 'after', new_data->key)
            );
        END IF;
    END LOOP;

    FOR key IN SELECT jsonb_object_keys(old_data) LOOP
        IF NOT new_data ? key THEN
            result := result || jsonb_build_object(
                key, jsonb_build_object('before', old_data->key, 'after', NULL)
            );
        END IF;
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- AUDIT EVENTS TABLE (PARTITIONED)
-- ============================================================================
CREATE TABLE audit.events (
    -- Primary Identification
    id                      TEXT PRIMARY KEY DEFAULT audit.ulid_generate(),
    sequence_num            BIGSERIAL,

    -- Event Classification
    event_category          VARCHAR(50) NOT NULL,
    event_action            VARCHAR(50) NOT NULL,
    event_type              VARCHAR(100) NOT NULL,
    event_severity          VARCHAR(20) NOT NULL DEFAULT 'info',

    -- Temporal
    occurred_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Actor Information
    actor_user_id           TEXT,
    actor_clerk_id          TEXT,
    actor_name              TEXT,
    actor_email             TEXT,
    actor_ip_address        INET,
    actor_user_agent        TEXT,
    actor_is_system         BOOLEAN NOT NULL DEFAULT FALSE,

    -- Impersonation Support
    impersonator_user_id    TEXT,
    impersonator_name       TEXT,

    -- API Authentication
    api_key_id              TEXT,
    api_key_name            TEXT,

    -- Publisher Context (Tenant Isolation)
    publisher_id            INTEGER,
    publisher_slug          TEXT,

    -- Resource Identification
    resource_type           VARCHAR(50),
    resource_id             TEXT,
    resource_name           TEXT,

    -- Parent Resource (for nested resources)
    parent_resource_type    VARCHAR(50),
    parent_resource_id      TEXT,

    -- Change Tracking
    operation_type          VARCHAR(20) NOT NULL,
    changes_before          JSONB,
    changes_after           JSONB,
    changes_diff            JSONB,

    -- Request Correlation
    request_id              UUID NOT NULL DEFAULT gen_random_uuid(),
    trace_id                TEXT,
    session_id              TEXT,

    -- Transaction Grouping
    transaction_id          TEXT,
    parent_event_id         TEXT,

    -- Outcome
    status                  VARCHAR(20) NOT NULL DEFAULT 'success',
    error_code              VARCHAR(50),
    error_message           TEXT,

    -- Performance
    duration_ms             INTEGER,

    -- Geolocation
    geo_country_code        CHAR(2),
    geo_city                TEXT,

    -- Metadata
    metadata                JSONB,
    tags                    TEXT[],

    -- Tamper Detection
    event_hash              TEXT,
    previous_event_hash     TEXT,

    -- Schema Version
    schema_version          SMALLINT NOT NULL DEFAULT 1,

    -- Retention
    retention_tier          VARCHAR(20) NOT NULL DEFAULT 'standard',
    archived_at             TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT event_type_format CHECK (event_type = event_category || '.' || event_action),
    CONSTRAINT valid_operation_type CHECK (operation_type IN ('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXECUTE', 'GRANT', 'REVOKE')),
    CONSTRAINT valid_status CHECK (status IN ('success', 'failure', 'partial', 'error')),
    CONSTRAINT valid_severity CHECK (event_severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    CONSTRAINT valid_retention_tier CHECK (retention_tier IN ('critical', 'standard', 'operational'))
) PARTITION BY RANGE (occurred_at);

-- ============================================================================
-- HASH CHAIN COMPUTATION
-- ============================================================================
CREATE OR REPLACE FUNCTION audit.compute_event_hash()
RETURNS TRIGGER AS $$
DECLARE
    last_hash TEXT;
    hash_input TEXT;
BEGIN
    SELECT event_hash INTO last_hash
    FROM audit.events
    WHERE occurred_at >= (NEW.occurred_at - INTERVAL '1 day')
    ORDER BY occurred_at DESC, sequence_num DESC
    LIMIT 1;

    NEW.previous_event_hash := last_hash;

    hash_input := COALESCE(last_hash, '') ||
                  NEW.sequence_num::TEXT ||
                  NEW.occurred_at::TEXT ||
                  COALESCE(NEW.actor_clerk_id, '') ||
                  NEW.event_type ||
                  COALESCE(NEW.resource_type, '') ||
                  COALESCE(NEW.resource_id, '') ||
                  COALESCE(NEW.changes_after::TEXT, '');

    NEW.event_hash := encode(digest(hash_input, 'sha256'), 'hex');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_compute_event_hash
    BEFORE INSERT ON audit.events
    FOR EACH ROW
    EXECUTE FUNCTION audit.compute_event_hash();

-- ============================================================================
-- IMMUTABILITY ENFORCEMENT
-- ============================================================================
CREATE OR REPLACE FUNCTION audit.prevent_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit events are immutable. UPDATE and DELETE are prohibited.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_update
    BEFORE UPDATE ON audit.events
    FOR EACH ROW
    EXECUTE FUNCTION audit.prevent_modification();

CREATE TRIGGER trigger_prevent_delete
    BEFORE DELETE ON audit.events
    FOR EACH ROW
    EXECUTE FUNCTION audit.prevent_modification();

-- ============================================================================
-- DIFF COMPUTATION ON INSERT
-- ============================================================================
CREATE OR REPLACE FUNCTION audit.compute_diff()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.operation_type = 'UPDATE' AND NEW.changes_before IS NOT NULL AND NEW.changes_after IS NOT NULL THEN
        NEW.changes_diff := audit.jsonb_diff(NEW.changes_before, NEW.changes_after);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_compute_diff
    BEFORE INSERT ON audit.events
    FOR EACH ROW
    EXECUTE FUNCTION audit.compute_diff();

-- ============================================================================
-- INITIAL PARTITIONS
-- ============================================================================
CREATE TABLE audit.events_2025_12 PARTITION OF audit.events
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE audit.events_2026_01 PARTITION OF audit.events
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE audit.events_2026_02 PARTITION OF audit.events
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE audit.events_2026_03 PARTITION OF audit.events
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE audit.events_default PARTITION OF audit.events DEFAULT;

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_audit_events_occurred_at ON audit.events (occurred_at DESC, id DESC);
CREATE INDEX idx_audit_events_actor ON audit.events (actor_clerk_id, occurred_at DESC) WHERE actor_clerk_id IS NOT NULL;
CREATE INDEX idx_audit_events_publisher ON audit.events (publisher_id, occurred_at DESC) WHERE publisher_id IS NOT NULL;
CREATE INDEX idx_audit_events_resource ON audit.events (resource_type, resource_id, occurred_at DESC) WHERE resource_type IS NOT NULL;
CREATE INDEX idx_audit_events_event_type ON audit.events (event_type, occurred_at DESC);
CREATE INDEX idx_audit_events_request_id ON audit.events (request_id);
CREATE INDEX idx_audit_events_status ON audit.events (status, occurred_at DESC) WHERE status IN ('failure', 'error');
CREATE INDEX idx_audit_events_publisher_type ON audit.events (publisher_id, event_type, occurred_at DESC) WHERE publisher_id IS NOT NULL;
CREATE INDEX idx_audit_events_metadata ON audit.events USING GIN (metadata jsonb_path_ops);
CREATE INDEX idx_audit_events_tags ON audit.events USING GIN (tags);
CREATE INDEX idx_audit_events_sequence ON audit.events (sequence_num);

-- ============================================================================
-- AUDIT ACCESS LOG (Meta-Auditing)
-- ============================================================================
CREATE TABLE audit.access_log (
    id                      BIGSERIAL PRIMARY KEY,
    accessor_user_id        INTEGER,
    accessor_clerk_id       TEXT,
    accessor_role           VARCHAR(50),
    accessed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    query_type              VARCHAR(50) NOT NULL,
    date_range_start        TIMESTAMPTZ,
    date_range_end          TIMESTAMPTZ,
    filters                 JSONB,
    access_method           VARCHAR(50),
    ip_address              INET,
    user_agent              TEXT,
    records_returned        INTEGER,
    records_exported        INTEGER,
    justification           TEXT,
    request_id              UUID
);

CREATE INDEX idx_audit_access_log_user ON audit.access_log (accessor_clerk_id, accessed_at DESC);
CREATE INDEX idx_audit_access_log_date ON audit.access_log (accessed_at DESC);

-- ============================================================================
-- EXPORT JOBS TABLE
-- ============================================================================
CREATE TABLE audit.export_jobs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 TEXT NOT NULL,
    publisher_id            INTEGER,
    format                  VARCHAR(10) NOT NULL,
    filters                 JSONB NOT NULL,
    status                  VARCHAR(20) DEFAULT 'pending' NOT NULL,
    file_path               TEXT,
    file_size_bytes         BIGINT,
    entry_count             INTEGER,
    error_message           TEXT,
    requested_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    expires_at              TIMESTAMPTZ,

    CONSTRAINT valid_export_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX idx_export_jobs_user ON audit.export_jobs (user_id, requested_at DESC);
CREATE INDEX idx_export_jobs_status ON audit.export_jobs (status) WHERE status IN ('pending', 'processing');

-- ============================================================================
-- RETENTION POLICIES
-- ============================================================================
CREATE TABLE audit.retention_policies (
    id                      SERIAL PRIMARY KEY,
    event_category          VARCHAR(50) NOT NULL,
    event_action            VARCHAR(50),
    retention_days_hot      INTEGER NOT NULL DEFAULT 90,
    retention_days_warm     INTEGER NOT NULL DEFAULT 365,
    retention_days_cold     INTEGER NOT NULL DEFAULT 2555,
    permanent_retention     BOOLEAN NOT NULL DEFAULT FALSE,
    compliance_reason       TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(event_category, event_action)
);

INSERT INTO audit.retention_policies (event_category, event_action, retention_days_hot, retention_days_warm, retention_days_cold, permanent_retention, compliance_reason) VALUES
    ('auth', NULL, 90, 365, 2555, FALSE, 'Security monitoring'),
    ('publisher', 'create', 90, 365, 2555, TRUE, 'Business critical'),
    ('publisher', 'delete', 90, 365, 2555, TRUE, 'GDPR evidence'),
    ('zman', NULL, 90, 365, 730, FALSE, 'Operational'),
    ('coverage', NULL, 90, 180, 365, FALSE, 'Geographic changes'),
    ('algorithm', NULL, 90, 365, 730, FALSE, 'Formula versioning'),
    ('user', 'delete', 90, 365, 2555, TRUE, 'GDPR erasure evidence');

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================
CREATE VIEW audit.recent_events AS
SELECT * FROM audit.events
WHERE occurred_at >= NOW() - INTERVAL '7 days'
ORDER BY occurred_at DESC;

CREATE VIEW audit.failed_events AS
SELECT * FROM audit.events
WHERE status IN ('failure', 'error')
  AND occurred_at >= NOW() - INTERVAL '24 hours'
ORDER BY occurred_at DESC;

-- ============================================================================
-- HASH CHAIN VALIDATION
-- ============================================================================
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
            WHEN oe.previous_event_hash IS NULL AND oe.expected_previous IS NULL THEN TRUE
            WHEN oe.previous_event_hash = oe.expected_previous THEN TRUE
            ELSE FALSE
        END AS is_valid,
        CASE
            WHEN oe.previous_event_hash IS DISTINCT FROM oe.expected_previous THEN
                'Hash chain broken: expected ' || COALESCE(oe.expected_previous, 'NULL') || ' got ' || COALESCE(oe.previous_event_hash, 'NULL')
            ELSE NULL
        END AS error_reason
    FROM ordered_events oe
    WHERE oe.previous_event_hash IS DISTINCT FROM oe.expected_previous;
END;
$$ LANGUAGE plpgsql;
```

### 2.2 Event Categories and Actions

| Category | Actions | Retention Tier | Description |
|----------|---------|----------------|-------------|
| **auth** | login, logout, login_failed, password_reset, mfa_enabled, mfa_disabled | critical | Authentication events |
| **publisher** | create, update, delete, suspend, restore, settings_update | critical | Publisher lifecycle |
| **zman** | create, update, delete, publish, unpublish, restore, tag_update | standard | Zman CRUD operations |
| **algorithm** | create, update, publish, draft, rollback | standard | Formula versioning |
| **coverage** | create, update, delete | operational | Geographic coverage |
| **user** | create, update, delete, role_change, invite | critical | User management |
| **team** | add_member, remove_member, role_change | standard | Team management |
| **api_key** | create, revoke | critical | API key management |
| **export** | request, complete, download | standard | Data exports |

### 2.3 Migration from Existing `actions` Table

```sql
-- File: db/migrations/XXXXXX_create_audit_events.sql

-- Step 1: Create new schema (non-destructive)
-- (All DDL from section 2.1)

-- Step 2: Create parallel insert function for dual-write period
CREATE OR REPLACE FUNCTION audit.sync_from_actions()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit.events (
        event_category,
        event_action,
        event_type,
        occurred_at,
        actor_user_id,
        publisher_id,
        resource_type,
        resource_id,
        operation_type,
        changes_after,
        request_id,
        parent_event_id,
        status,
        error_message,
        duration_ms,
        metadata
    ) VALUES (
        NEW.concept,
        NEW.action_type,
        NEW.concept || '.' || NEW.action_type,
        NEW.started_at,
        NEW.user_id,
        NEW.publisher_id,
        NEW.entity_type,
        NEW.entity_id,
        CASE
            WHEN NEW.action_type ILIKE '%create%' THEN 'CREATE'
            WHEN NEW.action_type ILIKE '%update%' THEN 'UPDATE'
            WHEN NEW.action_type ILIKE '%delete%' THEN 'DELETE'
            ELSE 'EXECUTE'
        END,
        NEW.result,
        NEW.request_id,
        NEW.parent_action_id::TEXT,
        NEW.status,
        NEW.error_message,
        NEW.duration_ms,
        NEW.metadata || jsonb_build_object('migrated_from', 'actions', 'original_id', NEW.id::TEXT)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enable during migration (dual-write)
CREATE TRIGGER sync_to_audit_events
    AFTER INSERT ON public.actions
    FOR EACH ROW
    EXECUTE FUNCTION audit.sync_from_actions();

-- Step 3: Backfill historical data (run as batch job)
-- See AUDIT_DATA_MODEL.md for backfill function
```

---

## 3. Architecture

### 3.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API Request Flow                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  HTTP Handler (6-Step Pattern)                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 1. PublisherResolver.MustResolve()  ─┐                                  ││
│  │ 2. Extract URL params                 │                                  ││
│  │ 3. Parse request body                 ├─► AuditContext populated        ││
│  │ 4. Validate                          │                                  ││
│  │ 5. Execute mutation via SQLc         ─┘                                  ││
│  │ 6. auditService.LogEvent()  ←─────────── Non-blocking (0ms)             ││
│  │ 7. RespondJSON()                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Audit Service (In-Memory Buffer)                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Buffered Channel (10,000 events)                                         ││
│  │ - Non-blocking write                                                      ││
│  │ - Drops if full (logs warning, increments metric)                        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Background Worker (Batch Processor)                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ - Collects 100 events OR waits 1 second                                  ││
│  │ - Uses PostgreSQL COPY protocol                                          ││
│  │ - Throughput: 35,000+ events/second                                      ││
│  │ - Retry with exponential backoff                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL (Partitioned Audit Table)                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ audit.events                                                              ││
│  │ ├── audit.events_2025_12  (December 2025)                                ││
│  │ ├── audit.events_2026_01  (January 2026)                                 ││
│  │ ├── audit.events_2026_02  (February 2026)                                ││
│  │ └── ...                                                                   ││
│  │                                                                           ││
│  │ Triggers:                                                                 ││
│  │ - compute_event_hash (hash chain)                                         ││
│  │ - compute_diff (JSONB diff)                                               ││
│  │ - prevent_modification (immutability)                                     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
          ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
          │   Hot (90d) │   │  Warm (1yr) │   │  Cold (7yr) │
          │  PostgreSQL │   │  PostgreSQL │   │ S3 Glacier  │
          │     SSD     │   │     HDD     │   │  Immutable  │
          └─────────────┘   └─────────────┘   └─────────────┘
```

### 3.2 Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         api/internal/                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────┐      ┌─────────────────────────────────┐ │
│  │     handlers/       │      │       services/audit/           │ │
│  │                     │      │                                 │ │
│  │  audit_logs.go      │─────▶│  service.go                     │ │
│  │  - GetAdminAuditLogs│      │  - LogEvent()                   │ │
│  │  - GetPublisherLogs │      │  - worker()                     │ │
│  │  - GetEventDetails  │      │  - flushBatch()                 │ │
│  │  - ExportLogs       │      │                                 │ │
│  │                     │      │  types.go                       │ │
│  │  (6-step pattern)   │      │  - AuditEvent                   │ │
│  │                     │      │  - AuditContext                 │ │
│  └─────────────────────┘      │  - EventCategory                │ │
│           │                   │                                 │ │
│           ▼                   │  pii_masker.go                  │ │
│  ┌─────────────────────┐      │  - MaskEmail()                  │ │
│  │   middleware/       │      │  - MaskIP()                     │ │
│  │                     │      │                                 │ │
│  │  audit_context.go   │─────▶│  hash_chain.go                  │ │
│  │  - ExtractActor()   │      │  - VerifyIntegrity()            │ │
│  │  - GetRequestID()   │      │                                 │ │
│  │  - GetIPAddress()   │      │  export.go                      │ │
│  │                     │      │  - ProcessExport()              │ │
│  └─────────────────────┘      │  - GenerateCSV()                │ │
│                               │  - GenerateJSON()               │ │
│                               └─────────────────────────────────┘ │
│                                          │                        │
│                                          ▼                        │
│                               ┌─────────────────────────────────┐ │
│                               │       db/queries/               │ │
│                               │                                 │ │
│                               │  audit_events.sql               │ │
│                               │  - CreateAuditEvent             │ │
│                               │  - GetAuditEventsCursor         │ │
│                               │  - CountAuditEvents             │ │
│                               │  - GetAuditEventByID            │ │
│                               │  - GetPublisherAuditEvents      │ │
│                               │                                 │ │
│                               │  audit_exports.sql              │ │
│                               │  - CreateExportJob              │ │
│                               │  - UpdateExportStatus           │ │
│                               │  - GetExportJob                 │ │
│                               │                                 │ │
│                               │  audit_access.sql               │ │
│                               │  - LogAuditAccess               │ │
│                               │  - GetAccessLog                 │ │
│                               └─────────────────────────────────┘ │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 File Structure

```
api/
├── internal/
│   ├── services/
│   │   └── audit/
│   │       ├── service.go          # AuditService with buffered channel
│   │       ├── types.go            # AuditEvent, AuditContext, EventCategory
│   │       ├── pii_masker.go       # PII redaction utilities
│   │       ├── hash_chain.go       # Hash chain verification
│   │       ├── export.go           # CSV/JSON export logic
│   │       └── service_test.go     # Unit tests
│   │
│   ├── handlers/
│   │   ├── audit_logs.go           # Admin/publisher audit log endpoints
│   │   ├── audit_logs_test.go      # Handler tests
│   │   └── types.go                # Add AuditLogResponse types
│   │
│   ├── middleware/
│   │   └── audit_context.go        # Request context extraction
│   │
│   └── db/
│       └── queries/
│           ├── audit_events.sql    # Audit event queries
│           ├── audit_exports.sql   # Export job queries
│           └── audit_access.sql    # Meta-audit queries

db/
└── migrations/
    ├── XXXXXX_create_audit_schema.sql    # Schema creation
    ├── XXXXXX_create_audit_events.sql    # Events table + triggers
    ├── XXXXXX_create_audit_access.sql    # Access log table
    └── XXXXXX_create_audit_exports.sql   # Export jobs table

web/
├── app/
│   ├── admin/
│   │   └── audit-logs/
│   │       ├── page.tsx            # Admin audit log viewer
│   │       └── [id]/
│   │           └── page.tsx        # Event detail page
│   │
│   └── publisher/
│       └── settings/
│           └── audit-logs/
│               └── page.tsx        # Publisher audit log viewer
│
├── components/
│   └── audit-log/
│       ├── AuditLogTable.tsx       # Timeline-based table
│       ├── AuditLogFilters.tsx     # Multi-select filters
│       ├── EventDetailSheet.tsx    # Side panel details
│       ├── DiffViewer.tsx          # Side-by-side JSON diff
│       ├── ActorDisplay.tsx        # Actor avatar + name
│       ├── ExportDialog.tsx        # Export modal
│       └── index.ts                # Barrel export
│
└── lib/
    └── api/
        └── audit.ts                # useAuditLogs hook, API client
```

---

## 4. API Specification

### 4.1 OpenAPI Specification (YAML)

```yaml
openapi: 3.0.3
info:
  title: Zmanim Audit Log API
  version: 1.0.0
  description: |
    Audit log API for tracking platform activities.
    Supports cursor-based pagination, filtering, and CSV/JSON export.

servers:
  - url: https://zmanim.shtetl.io/api/v1
    description: Production
  - url: http://localhost:8080/api/v1
    description: Development

security:
  - BearerAuth: []

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    AuditEvent:
      type: object
      required:
        - id
        - event_type
        - occurred_at
        - status
      properties:
        id:
          type: string
          description: ULID identifier
          example: "01HQGX8K9Z7ABCDEF1234567"
        event_type:
          type: string
          description: Category.action format
          example: "publisher.update"
        event_category:
          type: string
          example: "publisher"
        event_action:
          type: string
          example: "update"
        event_severity:
          type: string
          enum: [debug, info, warning, error, critical]
          example: "info"
        occurred_at:
          type: string
          format: date-time
          example: "2025-12-26T10:30:00Z"
        actor:
          $ref: '#/components/schemas/Actor'
        publisher_id:
          type: integer
          nullable: true
          example: 42
        publisher_slug:
          type: string
          nullable: true
          example: "orthodox-union"
        resource:
          $ref: '#/components/schemas/Resource'
        operation_type:
          type: string
          enum: [CREATE, READ, UPDATE, DELETE, EXECUTE, GRANT, REVOKE]
          example: "UPDATE"
        changes:
          $ref: '#/components/schemas/Changes'
        status:
          type: string
          enum: [success, failure, partial, error]
          example: "success"
        error_message:
          type: string
          nullable: true
        duration_ms:
          type: integer
          nullable: true
          example: 125
        request_id:
          type: string
          format: uuid
        metadata:
          type: object
          additionalProperties: true

    Actor:
      type: object
      properties:
        user_id:
          type: string
          example: "123"
        clerk_id:
          type: string
          example: "user_2abc123xyz"
        name:
          type: string
          example: "Rabbi Cohen"
        email:
          type: string
          example: "r***@e***.com"
        ip_address:
          type: string
          example: "192.168.*.*"
        is_system:
          type: boolean
          example: false
        impersonator:
          type: object
          nullable: true
          properties:
            user_id:
              type: string
            name:
              type: string

    Resource:
      type: object
      properties:
        type:
          type: string
          example: "publisher_zman"
        id:
          type: string
          example: "456"
        name:
          type: string
          example: "Shema - Magen Avraham"

    Changes:
      type: object
      properties:
        before:
          type: object
          additionalProperties: true
          nullable: true
        after:
          type: object
          additionalProperties: true
          nullable: true
        diff:
          type: object
          description: Only changed fields with before/after values
          additionalProperties:
            type: object
            properties:
              before:
                type: any
              after:
                type: any

    AuditEventList:
      type: object
      required:
        - events
        - pagination
      properties:
        events:
          type: array
          items:
            $ref: '#/components/schemas/AuditEvent'
        pagination:
          type: object
          required:
            - total
            - page_size
          properties:
            total:
              type: integer
              example: 1543
            page_size:
              type: integer
              example: 50
            next_cursor:
              type: string
              nullable: true
              example: "MTcwMzU4NjYwMDAwMF8wMUhRR1g4SzlaN0FCQ0RFRjEyMzQ1Njc="
            prev_cursor:
              type: string
              nullable: true

    ExportJob:
      type: object
      required:
        - id
        - status
        - requested_at
      properties:
        id:
          type: string
          format: uuid
        status:
          type: string
          enum: [pending, processing, completed, failed]
        format:
          type: string
          enum: [csv, json]
        requested_at:
          type: string
          format: date-time
        completed_at:
          type: string
          format: date-time
          nullable: true
        download_url:
          type: string
          nullable: true
        expires_at:
          type: string
          format: date-time
          nullable: true
        entry_count:
          type: integer
          nullable: true
        file_size_bytes:
          type: integer
          nullable: true
        error_message:
          type: string
          nullable: true

    APIError:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: string
          example: "VALIDATION_ERROR"
        message:
          type: string
          example: "Invalid date range"
        details:
          type: object
          additionalProperties: true

paths:
  /admin/audit-logs:
    get:
      summary: List all audit events (admin only)
      tags: [Admin Audit Logs]
      security:
        - BearerAuth: []
      parameters:
        - name: event_type
          in: query
          schema:
            type: string
          description: Filter by event type (e.g., publisher.update)
        - name: event_category
          in: query
          schema:
            type: string
          description: Filter by category (e.g., publisher)
        - name: publisher_id
          in: query
          schema:
            type: integer
        - name: actor_clerk_id
          in: query
          schema:
            type: string
        - name: resource_type
          in: query
          schema:
            type: string
        - name: resource_id
          in: query
          schema:
            type: string
        - name: status
          in: query
          schema:
            type: string
            enum: [success, failure, partial, error]
        - name: from
          in: query
          schema:
            type: string
            format: date-time
          description: Start date (inclusive)
        - name: to
          in: query
          schema:
            type: string
            format: date-time
          description: End date (inclusive)
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 50
        - name: cursor
          in: query
          schema:
            type: string
          description: Pagination cursor
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/AuditEventList'
        '401':
          description: Unauthorized
        '403':
          description: Forbidden - admin role required

  /publisher/audit-logs:
    get:
      summary: List audit events for authenticated publisher
      tags: [Publisher Audit Logs]
      security:
        - BearerAuth: []
      parameters:
        - name: X-Publisher-Id
          in: header
          required: true
          schema:
            type: string
        - name: event_type
          in: query
          schema:
            type: string
        - name: resource_type
          in: query
          schema:
            type: string
        - name: resource_id
          in: query
          schema:
            type: string
        - name: from
          in: query
          schema:
            type: string
            format: date-time
        - name: to
          in: query
          schema:
            type: string
            format: date-time
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 50
        - name: cursor
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/AuditEventList'
        '401':
          description: Unauthorized
        '403':
          description: Invalid publisher ID

  /audit-logs/{id}:
    get:
      summary: Get audit event details
      tags: [Audit Logs]
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
        - name: X-Publisher-Id
          in: header
          schema:
            type: string
          description: Required for publisher access
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/AuditEvent'
        '404':
          description: Event not found
        '403':
          description: Access denied

  /admin/audit-logs/export:
    post:
      summary: Export audit logs (admin only)
      tags: [Admin Audit Logs]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - format
              properties:
                format:
                  type: string
                  enum: [csv, json]
                filters:
                  type: object
                  properties:
                    event_type:
                      type: string
                    publisher_id:
                      type: integer
                    from:
                      type: string
                      format: date-time
                    to:
                      type: string
                      format: date-time
      responses:
        '202':
          description: Export job created
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/ExportJob'
        '429':
          description: Rate limit exceeded (max 10 exports/hour)

  /admin/audit-logs/export/{id}:
    get:
      summary: Get export job status
      tags: [Admin Audit Logs]
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/ExportJob'
        '404':
          description: Export job not found

  /publisher/audit-logs/export:
    post:
      summary: Export publisher audit logs
      tags: [Publisher Audit Logs]
      security:
        - BearerAuth: []
      parameters:
        - name: X-Publisher-Id
          in: header
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - format
              properties:
                format:
                  type: string
                  enum: [csv, json]
                filters:
                  type: object
      responses:
        '202':
          description: Export job created
        '429':
          description: Rate limit exceeded (max 5 exports/hour)
```

### 4.2 SQLc Queries

```sql
-- File: api/internal/db/queries/audit_events.sql

-- name: CreateAuditEvent :one
INSERT INTO audit.events (
    event_category,
    event_action,
    event_type,
    event_severity,
    occurred_at,
    actor_user_id,
    actor_clerk_id,
    actor_name,
    actor_email,
    actor_ip_address,
    actor_user_agent,
    actor_is_system,
    impersonator_user_id,
    impersonator_name,
    api_key_id,
    api_key_name,
    publisher_id,
    publisher_slug,
    resource_type,
    resource_id,
    resource_name,
    parent_resource_type,
    parent_resource_id,
    operation_type,
    changes_before,
    changes_after,
    request_id,
    trace_id,
    session_id,
    transaction_id,
    parent_event_id,
    status,
    error_code,
    error_message,
    duration_ms,
    geo_country_code,
    geo_city,
    metadata,
    tags,
    retention_tier
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
    $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
    $31, $32, $33, $34, $35, $36, $37, $38, $39, $40
)
RETURNING *;

-- name: GetAuditEventsCursor :many
SELECT
    id,
    event_category,
    event_action,
    event_type,
    event_severity,
    occurred_at,
    actor_user_id,
    actor_clerk_id,
    actor_name,
    actor_email,
    actor_ip_address,
    actor_is_system,
    impersonator_user_id,
    impersonator_name,
    publisher_id,
    publisher_slug,
    resource_type,
    resource_id,
    resource_name,
    operation_type,
    changes_before,
    changes_after,
    changes_diff,
    request_id,
    status,
    error_message,
    duration_ms,
    metadata
FROM audit.events
WHERE
    (sqlc.narg('event_type_filter')::text IS NULL OR event_type = sqlc.narg('event_type_filter'))
    AND (sqlc.narg('event_category_filter')::text IS NULL OR event_category = sqlc.narg('event_category_filter'))
    AND (sqlc.narg('publisher_id_filter')::integer IS NULL OR publisher_id = sqlc.narg('publisher_id_filter'))
    AND (sqlc.narg('actor_clerk_id_filter')::text IS NULL OR actor_clerk_id = sqlc.narg('actor_clerk_id_filter'))
    AND (sqlc.narg('resource_type_filter')::text IS NULL OR resource_type = sqlc.narg('resource_type_filter'))
    AND (sqlc.narg('resource_id_filter')::text IS NULL OR resource_id = sqlc.narg('resource_id_filter'))
    AND (sqlc.narg('status_filter')::text IS NULL OR status = sqlc.narg('status_filter'))
    AND (sqlc.narg('from_date')::timestamptz IS NULL OR occurred_at >= sqlc.narg('from_date'))
    AND (sqlc.narg('to_date')::timestamptz IS NULL OR occurred_at <= sqlc.narg('to_date'))
    AND (
        sqlc.narg('cursor_timestamp')::timestamptz IS NULL
        OR (occurred_at, id) < (sqlc.narg('cursor_timestamp'), sqlc.narg('cursor_id')::text)
    )
ORDER BY occurred_at DESC, id DESC
LIMIT sqlc.arg('limit_val') + 1;

-- name: CountAuditEvents :one
SELECT COUNT(*)::bigint
FROM audit.events
WHERE
    (sqlc.narg('event_type_filter')::text IS NULL OR event_type = sqlc.narg('event_type_filter'))
    AND (sqlc.narg('event_category_filter')::text IS NULL OR event_category = sqlc.narg('event_category_filter'))
    AND (sqlc.narg('publisher_id_filter')::integer IS NULL OR publisher_id = sqlc.narg('publisher_id_filter'))
    AND (sqlc.narg('actor_clerk_id_filter')::text IS NULL OR actor_clerk_id = sqlc.narg('actor_clerk_id_filter'))
    AND (sqlc.narg('resource_type_filter')::text IS NULL OR resource_type = sqlc.narg('resource_type_filter'))
    AND (sqlc.narg('resource_id_filter')::text IS NULL OR resource_id = sqlc.narg('resource_id_filter'))
    AND (sqlc.narg('status_filter')::text IS NULL OR status = sqlc.narg('status_filter'))
    AND (sqlc.narg('from_date')::timestamptz IS NULL OR occurred_at >= sqlc.narg('from_date'))
    AND (sqlc.narg('to_date')::timestamptz IS NULL OR occurred_at <= sqlc.narg('to_date'));

-- name: GetAuditEventByID :one
SELECT * FROM audit.events WHERE id = $1;

-- name: GetPublisherAuditEvents :many
SELECT * FROM audit.events
WHERE publisher_id = $1
    AND (sqlc.narg('from_date')::timestamptz IS NULL OR occurred_at >= sqlc.narg('from_date'))
    AND (sqlc.narg('to_date')::timestamptz IS NULL OR occurred_at <= sqlc.narg('to_date'))
    AND (
        sqlc.narg('cursor_timestamp')::timestamptz IS NULL
        OR (occurred_at, id) < (sqlc.narg('cursor_timestamp'), sqlc.narg('cursor_id')::text)
    )
ORDER BY occurred_at DESC, id DESC
LIMIT sqlc.arg('limit_val') + 1;

-- name: GetResourceHistory :many
SELECT * FROM audit.events
WHERE resource_type = $1 AND resource_id = $2
ORDER BY occurred_at DESC
LIMIT $3;
```

---

## 5. UI Components

### 5.1 Component Hierarchy

```
AuditLogPage
├── AuditLogHeader
│   ├── Title + Description
│   ├── ExportButton → ExportDialog
│   └── RefreshButton
│
├── AuditLogFilters
│   ├── DateRangePicker (preset quick filters + custom range)
│   ├── MultiSelect (event_type, resource_type, status)
│   ├── SearchInput (actor name, resource name)
│   └── ActiveFilterBadges (removable chips)
│
├── AuditLogTable (Timeline-based)
│   ├── TableHeader (sortable columns)
│   └── TableBody
│       └── AuditEventRow (for each event)
│           ├── TimelineIndicator (colored dot by severity)
│           ├── Timestamp (relative + absolute on hover)
│           ├── ActorDisplay (avatar + name + impersonation badge)
│           ├── EventDescription (action + resource link)
│           ├── StatusBadge (success/failure)
│           └── RowActions (View Details, View Diff)
│
├── Pagination
│   ├── PageInfo ("Showing 1-50 of 1,543")
│   └── CursorNavigation (Prev/Next buttons)
│
├── EventDetailSheet (Slide-over panel)
│   ├── EventHeader (type, timestamp, duration)
│   ├── ActorSection (full actor details)
│   ├── ResourceSection (type, id, name, link)
│   ├── ChangesSection
│   │   └── DiffViewer (side-by-side JSON diff)
│   ├── MetadataSection (request_id, IP, user_agent)
│   └── RelatedEvents (same request_id or transaction_id)
│
└── EmptyState / ErrorState / LoadingState
```

### 5.2 Key Component Specifications

#### AuditLogTable (Timeline Pattern)

```tsx
// web/components/audit-log/AuditLogTable.tsx
interface AuditEventRow {
  id: string;
  event_type: string;
  event_severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  occurred_at: string;
  actor: {
    name: string;
    email: string;
    is_system: boolean;
    impersonator?: { name: string };
  };
  resource: {
    type: string;
    id: string;
    name: string;
  };
  operation_type: string;
  status: 'success' | 'failure' | 'partial' | 'error';
  has_changes: boolean;
}

// Severity color mapping (design tokens)
const severityColors = {
  debug: 'bg-slate-400',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  critical: 'bg-red-700',
};

// Status badge variants
const statusVariants = {
  success: 'bg-green-100 text-green-800',
  failure: 'bg-red-100 text-red-800',
  partial: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
};
```

#### DiffViewer (Side-by-Side)

```tsx
// web/components/audit-log/DiffViewer.tsx
interface DiffViewerProps {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: Record<string, { before: unknown; after: unknown }> | null;
}

// Visual indicators:
// - Red background + strikethrough for removed values
// - Green background for added values
// - Yellow highlight for changed values
// - Syntax highlighting for JSON
```

#### ActorDisplay (with Impersonation)

```tsx
// web/components/audit-log/ActorDisplay.tsx
interface ActorDisplayProps {
  actor: {
    name: string;
    email?: string;
    is_system: boolean;
    impersonator?: { name: string };
  };
  compact?: boolean;
}

// Impersonation badge: "Acting as [name]" with warning icon
// System actor: Robot icon with "System" label
// Avatar: Initials or Clerk avatar
```

### 5.3 Filtering UI Patterns

**Date Range Presets:**
- Last hour
- Last 24 hours
- Last 7 days
- Last 30 days
- Last 90 days
- Custom range (calendar picker)

**Multi-Select Filters:**
- Event Type: Grouped by category (publisher.*, zman.*, auth.*)
- Resource Type: publisher, zman, coverage, user, etc.
- Status: success, failure, error
- Actor: Search by name or email

**Active Filter Display:**
- Removable badge/chip for each active filter
- "Clear all" button when filters are active
- Filter count indicator in header

### 5.4 Mobile Responsiveness

**Breakpoints:**
- Desktop (1024px+): Full table with all columns
- Tablet (768px-1023px): Condensed table, some columns hidden
- Mobile (<768px): Card-based layout with stacked information

**Mobile Card Layout:**
```
┌─────────────────────────────────────┐
│ ● [Severity Dot]                    │
│   Actor Name                        │
│   2 minutes ago                     │
│                                     │
│   Updated publisher_zman            │
│   Shema - Magen Avraham             │
│                                     │
│   [Details] [View Diff]             │
│                                     │
│   ▼ Show metadata                   │
└─────────────────────────────────────┘
```

---

## 6. Implementation Plan

### Phase 3.1: Database Schema (Week 1)

**Files to Create:**
- `db/migrations/XXXXXX_create_audit_schema.sql`

**Tasks:**
1. Create `audit` and `audit_archive` schemas
2. Create `ulid_generate()` function
3. Create `jsonb_diff()` function
4. Create `audit.events` partitioned table
5. Create initial monthly partitions (6 months)
6. Create all triggers (hash chain, diff, immutability)
7. Create all indexes
8. Create `audit.access_log` table
9. Create `audit.export_jobs` table
10. Create `audit.retention_policies` table with seed data
11. Create helper views (`recent_events`, `failed_events`)
12. Create `validate_hash_chain()` function

**Validation:**
- Run migration on dev database
- Verify trigger execution order
- Test ULID generation (26 chars, sortable)
- Test hash chain on sample inserts
- Verify UPDATE/DELETE triggers reject operations

### Phase 3.2: Backend Service (Week 2)

**Files to Create:**
- `api/internal/services/audit/service.go`
- `api/internal/services/audit/types.go`
- `api/internal/services/audit/pii_masker.go`
- `api/internal/services/audit/hash_chain.go`
- `api/internal/services/audit/export.go`
- `api/internal/services/audit/service_test.go`
- `api/internal/db/queries/audit_events.sql`
- `api/internal/db/queries/audit_exports.sql`
- `api/internal/db/queries/audit_access.sql`

**Core Service Implementation:**
```go
// api/internal/services/audit/service.go
type AuditService struct {
    db            *db.DB
    buffer        chan AuditEvent
    batchSize     int           // 100
    flushInterval time.Duration // 1 second
    stopChan      chan struct{}
    wg            sync.WaitGroup
    piiMasker     *PIIMasker
    metrics       *AuditMetrics
}

func NewAuditService(db *db.DB) *AuditService {
    svc := &AuditService{
        db:            db,
        buffer:        make(chan AuditEvent, 10000),
        batchSize:     100,
        flushInterval: time.Second,
        stopChan:      make(chan struct{}),
        piiMasker:     NewPIIMasker(),
    }
    svc.wg.Add(1)
    go svc.worker()
    return svc
}

func (s *AuditService) LogEvent(ctx context.Context, event AuditEvent) {
    // Apply PII masking
    s.piiMasker.Mask(&event)

    // Non-blocking write
    select {
    case s.buffer <- event:
        // Success
    default:
        slog.Warn("audit buffer full, dropping event",
            "event_type", event.EventType,
            "resource_id", event.ResourceID)
        s.metrics.DroppedEvents.Inc()
    }
}

func (s *AuditService) worker() {
    defer s.wg.Done()

    batch := make([]AuditEvent, 0, s.batchSize)
    ticker := time.NewTicker(s.flushInterval)
    defer ticker.Stop()

    for {
        select {
        case event := <-s.buffer:
            batch = append(batch, event)
            if len(batch) >= s.batchSize {
                s.flushBatch(batch)
                batch = batch[:0]
            }
        case <-ticker.C:
            if len(batch) > 0 {
                s.flushBatch(batch)
                batch = batch[:0]
            }
        case <-s.stopChan:
            // Drain remaining events
            if len(batch) > 0 {
                s.flushBatch(batch)
            }
            return
        }
    }
}

func (s *AuditService) flushBatch(batch []AuditEvent) {
    start := time.Now()

    // Use COPY protocol for bulk insert
    err := s.copyBatch(batch)
    if err != nil {
        slog.Error("failed to flush audit batch",
            "error", err,
            "batch_size", len(batch))
        s.metrics.FlushErrors.Inc()
        return
    }

    s.metrics.EventsFlushed.Add(float64(len(batch)))
    s.metrics.FlushDuration.Observe(time.Since(start).Seconds())
}
```

**Tasks:**
1. Implement `AuditService` with buffered channel
2. Implement `PIIMasker` for email, IP, phone masking
3. Implement cursor encoding/decoding helpers
4. Write SQLc queries and generate code
5. Implement export job processing
6. Write unit tests for all components

### Phase 3.3: API Handlers (Week 3)

**Files to Create:**
- `api/internal/handlers/audit_logs.go`
- `api/internal/handlers/audit_logs_test.go`
- `api/internal/middleware/audit_context.go`

**Handler Pattern (6-Step):**
```go
// api/internal/handlers/audit_logs.go
func (h *Handlers) GetAdminAuditLogs(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Verify admin role (middleware handles this)

    // 2. Parse query parameters
    filters, paging, err := parseAuditLogParams(r)
    if err != nil {
        RespondValidationError(w, r, "Invalid query parameters", err)
        return
    }

    // 3. Decode cursor if present
    var cursorTs *time.Time
    var cursorID *string
    if paging.Cursor != "" {
        ts, id, err := decodeCursor(paging.Cursor)
        if err != nil {
            RespondBadRequest(w, r, "Invalid cursor")
            return
        }
        cursorTs = &ts
        cursorID = &id
    }

    // 4. Query with cursor pagination
    rows, err := h.db.Queries.GetAuditEventsCursor(ctx, sqlcgen.GetAuditEventsCursorParams{
        EventTypeFilter:      filters.EventType,
        EventCategoryFilter:  filters.EventCategory,
        PublisherIDFilter:    filters.PublisherID,
        ActorClerkIDFilter:   filters.ActorClerkID,
        ResourceTypeFilter:   filters.ResourceType,
        ResourceIDFilter:     filters.ResourceID,
        StatusFilter:         filters.Status,
        FromDate:             toPgTimestamptz(filters.From),
        ToDate:               toPgTimestamptz(filters.To),
        CursorTimestamp:      toPgTimestamptz(cursorTs),
        CursorID:             cursorID,
        LimitVal:             int32(paging.Limit),
    })
    if err != nil {
        slog.Error("failed to get audit logs", "error", err)
        RespondInternalError(w, r)
        return
    }

    // 5. Log access (meta-audit)
    go h.auditService.LogAuditAccess(ctx, AuditAccessEntry{
        AccessorClerkID:  middleware.GetClerkUserID(ctx),
        QueryType:        "list",
        Filters:          filters,
        RecordsReturned:  len(rows),
    })

    // 6. Build response with pagination
    hasMore := len(rows) > paging.Limit
    if hasMore {
        rows = rows[:paging.Limit]
    }

    var nextCursor *string
    if hasMore && len(rows) > 0 {
        lastRow := rows[len(rows)-1]
        cursor := encodeCursor(lastRow.OccurredAt.Time, lastRow.ID)
        nextCursor = &cursor
    }

    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "data": map[string]interface{}{
            "events":     formatAuditEvents(rows),
            "pagination": map[string]interface{}{
                "total":       0, // Skip count for performance, or cache
                "page_size":   paging.Limit,
                "next_cursor": nextCursor,
            },
        },
    })
}
```

**Tasks:**
1. Implement `GetAdminAuditLogs` handler
2. Implement `GetPublisherAuditLogs` handler
3. Implement `GetAuditEventByID` handler
4. Implement `CreateAuditLogExport` handler
5. Implement `GetExportJobStatus` handler
6. Add audit context middleware for request metadata extraction
7. Add routes to router configuration
8. Write integration tests

### Phase 3.4: Frontend Components (Week 4)

**Files to Create:**
- `web/components/audit-log/AuditLogTable.tsx`
- `web/components/audit-log/AuditLogFilters.tsx`
- `web/components/audit-log/EventDetailSheet.tsx`
- `web/components/audit-log/DiffViewer.tsx`
- `web/components/audit-log/ActorDisplay.tsx`
- `web/components/audit-log/ExportDialog.tsx`
- `web/components/audit-log/index.ts`
- `web/lib/api/audit.ts`
- `web/app/admin/audit-logs/page.tsx`
- `web/app/publisher/settings/audit-logs/page.tsx`

**React Query Hook:**
```tsx
// web/lib/api/audit.ts
export function useAuditLogs(filters: AuditLogFilters) {
  const api = useApi();

  return useInfiniteQuery({
    queryKey: ['audit-logs', filters],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        ...(filters.eventType && { event_type: filters.eventType }),
        ...(filters.publisherId && { publisher_id: filters.publisherId.toString() }),
        ...(filters.from && { from: filters.from.toISOString() }),
        ...(filters.to && { to: filters.to.toISOString() }),
        ...(pageParam && { cursor: pageParam }),
        limit: '50',
      });
      return api.get<AuditEventList>(`/admin/audit-logs?${params}`);
    },
    getNextPageParam: (lastPage) => lastPage.data.pagination.next_cursor,
    staleTime: 30 * 1000, // 30 seconds
  });
}
```

**Tasks:**
1. Create `AuditLogTable` with timeline visualization
2. Create `AuditLogFilters` with multi-select and date range
3. Create `EventDetailSheet` with full event details
4. Create `DiffViewer` for before/after comparison
5. Create `ActorDisplay` with impersonation support
6. Create `ExportDialog` with format selection
7. Create API client hooks with React Query
8. Create admin page at `/admin/audit-logs`
9. Create publisher page at `/publisher/settings/audit-logs`
10. Add to navigation menus

### Phase 3.5: Integration & Testing (Week 5)

**Tasks:**

1. **Handler Integration**
   - Add audit logging calls to all mutation handlers
   - Create helper function for standardized audit event creation
   - Verify existing handlers work with new audit service

2. **Migration from `actions` Table**
   - Enable dual-write trigger
   - Verify parallel operation
   - Run backfill for historical data
   - Validate data integrity

3. **E2E Testing**
   - Create E2E tests for audit log viewing
   - Test export functionality
   - Test filtering and pagination
   - Test access control (admin vs publisher)

4. **Performance Testing**
   - Load test with 10,000 events
   - Verify cursor pagination performance
   - Test buffer overflow behavior
   - Benchmark COPY protocol throughput

5. **Compliance Validation**
   - Verify hash chain integrity
   - Test immutability triggers
   - Verify PII masking
   - Document audit access patterns

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Service Layer:**
```go
// api/internal/services/audit/service_test.go
func TestAuditService_LogEvent(t *testing.T) {
    // Test non-blocking write
    // Test buffer overflow handling
    // Test PII masking
}

func TestAuditService_FlushBatch(t *testing.T) {
    // Test batch insertion
    // Test retry on failure
}

func TestPIIMasker_MaskEmail(t *testing.T) {
    tests := []struct{
        input string
        want  string
    }{
        {"user@example.com", "u***@e***.com"},
        {"john.doe@company.org", "j***@c***.org"},
    }
    // ...
}

func TestCursor_EncodeDecode(t *testing.T) {
    // Test round-trip encoding/decoding
    // Test invalid cursor handling
}
```

**Database Functions:**
```sql
-- Test ULID generation
SELECT audit.ulid_generate();  -- Expect 26-char string

-- Test JSONB diff
SELECT audit.jsonb_diff(
    '{"name": "Old", "value": 1}'::jsonb,
    '{"name": "New", "value": 1, "added": true}'::jsonb
);
-- Expect: {"name": {"before": "Old", "after": "New"}, "added": {"before": null, "after": true}}

-- Test hash chain validation
INSERT INTO audit.events (...) VALUES (...);
SELECT * FROM audit.validate_hash_chain();  -- Expect 0 rows
```

### 7.2 Integration Tests

**API Endpoints:**
```bash
# Test admin list
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/v1/admin/audit-logs?limit=10"

# Test publisher list
curl -H "Authorization: Bearer $TOKEN" \
  -H "X-Publisher-Id: 42" \
  "http://localhost:8080/api/v1/publisher/audit-logs?limit=10"

# Test event details
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/v1/audit-logs/01HQGX8K9Z7ABCDEF1234567"

# Test export
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"format": "csv", "filters": {"from": "2025-01-01T00:00:00Z"}}' \
  "http://localhost:8080/api/v1/admin/audit-logs/export"
```

### 7.3 E2E Tests

**Playwright Tests:**
```typescript
// web/e2e/audit-logs.spec.ts
test.describe('Audit Log Viewer', () => {
  test('admin can view all audit logs', async ({ page }) => {
    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('can filter by date range', async ({ page }) => {
    await page.goto('/admin/audit-logs');
    await page.getByRole('button', { name: 'Last 7 days' }).click();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('can export to CSV', async ({ page }) => {
    await page.goto('/admin/audit-logs');
    await page.getByRole('button', { name: 'Export' }).click();
    await page.getByRole('button', { name: 'CSV' }).click();
    await page.getByRole('button', { name: 'Export' }).click();
    await expect(page.getByText('Export started')).toBeVisible();
  });

  test('publisher can only see own logs', async ({ page }) => {
    await page.goto('/publisher/settings/audit-logs');
    // Verify only publisher's events are shown
  });
});
```

### 7.4 Performance Tests

**Load Testing:**
```bash
# Test write throughput
k6 run --vus 100 --duration 60s audit-write-test.js

# Test read performance
k6 run --vus 50 --duration 60s audit-read-test.js
```

**Performance Targets:**

| Metric | Target | Critical |
|--------|--------|----------|
| API latency impact | 0ms | <5ms |
| Event write throughput | 10,000/s | 1,000/s |
| List query (50 events) | <100ms | <500ms |
| Cursor pagination (page 100) | <100ms | <500ms |
| Export (10K events) | <30s | <60s |
| Buffer overflow rate | <0.01% | <1% |

---

## 8. Risk Assessment

### 8.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Buffer overflow during traffic spike** | Medium | Low | Monitor dropped_events metric, increase buffer size, add Redis fallback for critical events |
| **Hash chain corruption** | Low | High | Daily integrity checks, automated alerts, backup hash anchoring |
| **Partition explosion** | Low | Medium | Monthly partitions (12/year), pg_partman automation, archival to S3 |
| **Query performance degradation** | Medium | Medium | Partition pruning, composite indexes, materialized views for dashboards |
| **PII leakage in logs** | Medium | High | PIIMasker on all events, pre-commit validation, security review |
| **Migration data loss** | Low | High | Dual-write during migration, backfill validation, rollback plan |

### 8.2 Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Storage costs exceed budget** | Medium | Medium | S3 lifecycle policies, Glacier for cold data, monitor disk usage |
| **Audit log access abuse** | Low | High | Meta-auditing, access reviews, MFA for sensitive access |
| **Compliance audit failure** | Low | High | SOC 2 checklist, quarterly reviews, external auditor consultation |
| **Team lacks audit expertise** | Medium | Medium | Documentation, training, compliance consultant |

### 8.3 Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Feature delays sprint timeline** | Medium | Medium | Phased rollout, MVP first, iterate |
| **User adoption low** | Low | Low | UX research, in-app guidance, training materials |
| **Enterprise customer rejects implementation** | Low | High | SOC 2 certification path, export capabilities, API access |

### 8.4 Rollback Plan

**If critical issues discovered:**

1. **Disable dual-write trigger** (immediate):
   ```sql
   DROP TRIGGER IF EXISTS sync_to_audit_events ON public.actions;
   ```

2. **Continue using legacy `actions` table** (no data loss)

3. **Fix issues in `audit.events` schema**

4. **Re-enable dual-write after fix**

5. **Complete migration when stable**

---

## Appendix A: Existing Infrastructure References

### Relevant Files

| File | Purpose | Integration Point |
|------|---------|-------------------|
| `api/internal/handlers/handlers.go` | Handler struct, service initialization | Add AuditService to Handlers |
| `api/internal/handlers/publisher_context.go` | PublisherResolver pattern | Reuse for tenant isolation |
| `api/internal/handlers/response.go` | Response helpers | Use RespondJSON, RespondError |
| `api/internal/services/calculation_log_service.go` | Async logging pattern | Reference implementation |
| `api/internal/middleware/auth.go` | JWT authentication | Extract actor context |
| `db/migrations/00000000000001_schema.sql` | Existing `actions` table | Migration source |
| `docs/coding-standards.md` | Coding patterns | Follow 6-step handler pattern |

### Existing `actions` Table Schema

```sql
CREATE TABLE public.actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action_type character varying(50) NOT NULL,
    concept character varying(50) NOT NULL,
    user_id text,
    publisher_id integer,
    request_id uuid NOT NULL,
    parent_action_id uuid,
    entity_type character varying(50),
    entity_id text,
    payload jsonb,
    result jsonb,
    status character varying(20) DEFAULT 'pending',
    error_message text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    duration_ms integer,
    metadata jsonb
);
```

---

## Appendix B: Reference Documentation

### Research Documents

1. **AUDIT_RESEARCH_LIBRARIES.md** - Go libraries, PostgreSQL extensions, event sourcing patterns
2. **AUDIT_DATA_MODEL.md** - Schema design, ULID, partitioning, hash chains
3. **AUDIT_API_DESIGN.md** - OpenAPI spec, cursor pagination, export functionality
4. **AUDIT_UX_PATTERNS.md** - Timeline tables, filtering, diff visualization
5. **AUDIT_PERFORMANCE.md** - Async logging, COPY protocol, retention tiers
6. **AUDIT_COMPLIANCE.md** - SOC 2, GDPR, immutability, PII handling

### External References

- [PostgreSQL Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [pg_partman Documentation](https://github.com/pgpartman/pg_partman)
- [ULID Specification](https://github.com/ulid/spec)
- [Stripe API Pagination](https://docs.stripe.com/api/pagination)
- [GitHub Audit Log API](https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/using-the-audit-log-api-for-your-enterprise)

---

**Document Status:** Complete and ready for implementation.

**Next Steps:**
1. Team review of design decisions
2. Budget approval for implementation (estimated 5 weeks)
3. Begin Phase 3.1: Database Schema
4. Track progress via sprint planning

---

*Generated by Agent 7: System Design Architect*
*Phase 1 Research Synthesis Complete*
