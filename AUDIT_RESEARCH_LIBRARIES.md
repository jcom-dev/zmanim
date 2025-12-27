# Audit Trail Libraries & Frameworks Research

**Research Date:** December 26, 2025
**Researcher:** Agent 1 - Audit Library Researcher

## Executive Summary

This document provides comprehensive research on audit trail libraries, frameworks, and design patterns across multiple technology stacks with a focus on Go/PostgreSQL implementations. The research covers data models, performance characteristics, UI/UX patterns, compliance features, and anti-patterns to avoid.

---

## Table of Contents

1. [Go Libraries for Audit Logging](#go-libraries-for-audit-logging)
2. [PostgreSQL-Specific Solutions](#postgresql-specific-solutions)
3. [Event Sourcing vs Audit Logging](#event-sourcing-vs-audit-logging)
4. [Enterprise Audit Systems](#enterprise-audit-systems)
5. [Database CDC Solutions](#database-cdc-solutions)
6. [Data Model & Core Fields](#data-model--core-fields)
7. [UI/UX Patterns](#uiux-patterns)
8. [Performance & Scalability](#performance--scalability)
9. [Compliance & Retention](#compliance--retention)
10. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
11. [Recommended Patterns](#recommended-patterns)
12. [Comparison Matrix](#comparison-matrix)

---

## Go Libraries for Audit Logging

### 1. github.com/gmhafiz/audit

**Type:** Application-level Go library with SQL interceptor

**Key Features:**
- Automatic audit table creation
- Transparent auditing using SQL interceptors (ngrok/sqlmw)
- Captures INSERT, UPDATE, DELETE operations
- Context-aware (user ID, organization/tenant ID)
- Multi-database support (MySQL, PostgreSQL)

**Data Model:**
- Automatic creation of `audits` table
- Captures user and organization context from Go context
- Row-level change tracking

**Performance:**
- Uses SQL interceptors for transparent operation
- Minimal application code changes required
- Per-transaction overhead due to interceptor pattern

**Best Use Case:** Go applications requiring transparent, application-level audit logging with minimal code changes.

**Sources:**
- [github.com/gmhafiz/audit - Go Packages](https://pkg.go.dev/github.com/gmhafiz/audit)
- [What Is Audit Logging in PostgreSQL](https://www.tigerdata.com/learn/what-is-audit-logging-and-how-to-enable-it-in-postgresql)

---

### 2. goskive/pg_audit_log

**Type:** Database-level PostgreSQL audit tool in Go

**Key Features:**
- Transparent stored procedures and triggers
- Captures all SQL INSERTs, UPDATEs, DELETEs
- Generates reverse SQL to undo changes
- PostgreSQL-specific

**Data Model:**
- Database-level tracking using triggers
- Stores before/after state
- Includes specs for generating rollback SQL

**Performance:**
- Database-level overhead for all DML operations
- Trigger-based implementation

**Best Use Case:** PostgreSQL-only deployments requiring database-level audit trails with undo capability.

**Sources:**
- [goskive/pg_audit_log - GitHub](https://github.com/goskive/pg_audit_log)

---

## PostgreSQL-Specific Solutions

### 1. pgAudit Extension

**Type:** Official PostgreSQL extension

**Key Features:**
- Session and object audit logging
- Integrates with standard PostgreSQL logging facility
- Supports PostgreSQL 13-18
- Multiple logging modes:
  - Session mode: Activity within a connection
  - User mode: Activity by specific database user
  - Global mode: Activity across entire database
  - Object mode: Events for specific database objects
- Automatic redaction of sensitive data (cleartext passwords)

**Data Model:**
- Logs to PostgreSQL log files
- Uses standard PostgreSQL log format
- Can be parsed and ingested into external systems

**Performance:**
- Logs to PostgreSQL's standard logging infrastructure
- Performance impact depends on logging level and configuration
- Advanced event selectors reduce overhead

**Limitations:**
- Cannot reliably audit superusers
- Logs to PostgreSQL log files (not dedicated audit table)
- Requires log parsing for structured querying

**Configuration:**
```sql
-- Enable extension
CREATE EXTENSION pgaudit;

-- Configure logging
ALTER SYSTEM SET pgaudit.log = 'write, ddl';
ALTER SYSTEM SET pgaudit.log_catalog = off;
```

**Best Use Case:** Database-level audit logging for compliance, security monitoring, and forensic analysis.

**Sources:**
- [PostgreSQL Auditing Extension | PGAudit](https://www.pgaudit.org/)
- [GitHub - pgaudit/pgaudit](https://github.com/pgaudit/pgaudit)
- [PGAudit: Postgres Auditing | Supabase Docs](https://supabase.com/docs/guides/database/extensions/pgaudit)
- [Using pgAudit - Amazon RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.pgaudit.html)

---

### 2. pgAuditLogToFile

**Type:** Extension addon to pgAudit

**Key Features:**
- Redirects pgAudit logs to independent file
- Automatic file rotation based on time
- Prevents pollution of server logs
- Cluster-wide extension (install once)

**Data Model:**
- Separate audit log files
- Rotatable without affecting server logs

**Performance:**
- File-based logging (faster than database writes)
- Configurable rotation to manage disk usage

**Best Use Case:** Organizations using pgAudit who need separate audit log files with automatic rotation.

**Sources:**
- [GitHub - fmbiete/pgauditlogtofile](https://github.com/fmbiete/pgauditlogtofile)
- [pgAuditLogToFile Documentation](https://docs.tantorlabs.ru/tdb/en/15_14/se1c/pgauditlogtofile.html)

---

### 3. Supabase supa_audit

**Type:** Table-level audit extension

**Key Features:**
- Generic solution for tracking table data changes over time
- Stores audit records in `audit.record_version` table
- Uses primary key values to generate stable `record_id::uuid`
- Enables efficient history queries
- SQL-based implementation (~150 lines)

**Data Model:**
```sql
-- Core audit table structure
audit.record_version (
  record_id uuid,         -- Stable identifier from primary key
  table_name text,
  operation text,         -- INSERT, UPDATE, DELETE
  old_record jsonb,
  new_record jsonb,
  ts timestamptz
)
```

**Performance:**
- Performance impact: NOT recommended for tables with >3k ops/second peak write throughput
- Reduces throughput of inserts, updates, and deletes
- JSONB storage for efficient querying

**Limitations:**
- Throughput ceiling (~3,000 writes/second per table)
- Storage grows with data volume

**Best Use Case:** Applications needing table-level change tracking with acceptable throughput (<3k writes/sec).

**Sources:**
- [GitHub - supabase/supa_audit](https://github.com/supabase/supa_audit)
- [Postgres Auditing in 150 lines of SQL](https://supabase.com/blog/postgres-audit)
- [Auth Audit Logs | Supabase Docs](https://supabase.com/docs/guides/auth/audit-logs)

---

### 4. 2ndQuadrant Audit Trigger Toolbox

**Type:** Trigger-based auditing framework

**Key Features:**
- Simple, customizable trigger-based auditing
- Records user information from application context
- JSONB storage for row data
- Customizable for specific needs

**Data Model:**
- Central audit table with JSONB columns
- Stores complete before/after state
- Captures timestamp, user, operation type

**Performance:**
- Trigger overhead on every DML operation
- JSONB storage trades space for query flexibility

**Best Use Case:** Custom audit requirements with need for full row history.

**Sources:**
- [PostgreSQL Audit Trigger - Wiki](https://wiki.postgresql.org/wiki/Audit_trigger)
- [GitHub - 2ndQuadrant/audit-trigger](https://github.com/2ndQuadrant/audit-trigger)

---

### 5. Temporal Tables Extension

**Type:** System versioning extension

**Key Features:**
- Implements SQL:2011 temporal table standard
- Application period (valid-time/business-time)
- System period (transaction-time)
- Automatic history table maintenance

**Data Model:**
- Main table + history table pattern
- Trigger-based automatic archiving on UPDATE/DELETE
- Temporal columns for tracking validity periods

**Configuration:**
```sql
CREATE TRIGGER versioning_trigger
BEFORE INSERT OR UPDATE OR DELETE ON your_table
FOR EACH ROW EXECUTE PROCEDURE versioning(
  'sys_period',      -- system period column
  'your_table_history', -- history table
  true               -- adjust
);
```

**Performance:**
- Trigger overhead on modifications
- History table grows over time
- Partitioning recommended for large datasets

**Best Use Case:** Applications requiring SQL standard temporal table behavior for time-travel queries.

**Sources:**
- [temporal_tables - PostgreSQL Extension Network](https://pgxn.org/dist/temporal_tables/)
- [GitHub - arkhipov/temporal_tables](https://github.com/arkhipov/temporal_tables)
- [Implementing System-Versioned Tables in Postgres](https://hypirion.com/musings/implementing-system-versioned-tables-in-postgres)

---

### 6. pgMemento

**Type:** Audit trail with schema versioning

**Key Features:**
- Transaction-based logging
- Schema versioning support
- Central data log (`pgmemento.row_log`)
- Unique `pgmemento_audit_id` per table row
- Tracks schema changes in `audit_table_log` and `audit_column_log`

**Data Model:**
- Row-level audit IDs
- Central log tables
- Schema change tracking
- Transaction context

**Performance:**
- More complex than simple trigger-based solutions
- Schema versioning adds overhead
- Better for environments with evolving schemas

**Best Use Case:** Applications with frequently changing schemas requiring full audit history.

**Sources:**
- [GitHub - pgMemento/pgMemento](https://github.com/pgMemento/pgMemento)
- [Temporal Extensions - PostgreSQL wiki](https://wiki.postgresql.org/wiki/Temporal_Extensions)

---

## Event Sourcing vs Audit Logging

### Key Differences

| Aspect | Event Sourcing | Audit Logging |
|--------|---------------|---------------|
| **Purpose** | Record state changes as events; current state computed by replay | Record what was attempted (success or failure) |
| **Granularity** | Every state change captured | End results or significant changes |
| **Role** | Events are source of truth; used for business operations | Monitoring and forensics; doesn't affect state |
| **Completeness** | State changes only | All attempts (including failures) |
| **Correctness** | Strictly enforced (business depends on it) | Best effort; monitoring focus |
| **Query Pattern** | Replay events to reconstruct state | Search/filter historical activities |
| **Complexity** | High (event handlers, projections, consistency) | Low to medium |

### When to Use Each

**Event Sourcing:**
- Need to reconstruct state from history
- Complex domain with state transitions
- Temporal queries ("what was state at time X?")
- Strong consistency requirements
- Advanced querying over historical state

**Audit Logging:**
- Compliance requirements
- Security monitoring
- Post-mortem analysis
- User activity tracking
- Debugging

**Key Insight:** Event sourcing provides audit logging as a side benefit (100% accurate audit trail), but audit logging doesn't require event sourcing. Event sourcing is overkill if only audit requirements exist.

**Sources:**
- [Event Sourcing vs Audit Log - Kurrent.io](https://www.kurrent.io/blog/event-sourcing-audit)
- [Event Sourcing, Audit Logs, and Event Logs - Medium](https://medium.com/sundaytech/event-sourcing-audit-logs-and-event-logs-deb8f3c54663)
- [Is audit log a proper driver for Event Sourcing? - Event-Driven.io](https://event-driven.io/en/audit_log_event_sourcing/)
- [Audit log with event sourcing - Arkency Blog](https://blog.arkency.com/audit-log-with-event-sourcing/)

---

### Event Sourcing Libraries for Go

#### 1. looplab/eventhorizon

**Key Features:**
- CQRS/ES toolkit for Go
- Multiple storage backends (Memory, MongoDB, Redis, AWS, Kafka, Google Cloud, NATS)
- Event store interface for loading/saving events
- Aggregate store using event sourcing
- 1.6k+ GitHub stars

**Data Model:**
- Events as first-class citizens
- Aggregates built from event replay
- Event handlers for side effects

**Best Use Case:** Complex domains requiring CQRS and event sourcing patterns.

**Sources:**
- [GitHub - looplab/eventhorizon](https://github.com/looplab/eventhorizon)
- [eventhorizon - Event Sourcing for Go](http://looplab.se/eventhorizon/)

---

#### 2. modernice/goes

**Key Features:**
- Event-sourcing framework for Go
- Collection of interfaces, tools, and backend implementations
- Distributed operation support
- Example applications included

**Best Use Case:** Event-sourced applications requiring distributed operation.

**Sources:**
- [GitHub - modernice/goes](https://github.com/modernice/goes)

---

## Enterprise Audit Systems

### 1. Supabase Audit System

**Architecture:** Multi-layered approach

**Components:**

1. **Auth Audit Logs (Built-in)**
   - Automatically captures authentication events
   - Stored in `auth.audit_log_entries` table (database storage)
   - Also stored in external log storage (cost-efficient)
   - Dashboard accessible
   - SQL searchable

2. **pgAudit Extension (Database-level)**
   - Selectively track database activities
   - Logs to PostgreSQL log files
   - Configurable retention

3. **supa_audit Extension (Table-level)**
   - Generic table change tracking
   - `audit.record_version` table
   - Stable `record_id::uuid` from primary keys
   - NOT recommended for >3k ops/second

4. **Custom Triggers (Application-specific)**
   - Fields: `table_name`, `operation`, `timestamp`, `old_values`, `new_values`, `performed_by`
   - SQL Editor for trigger creation

5. **Platform Audit Logs (Team/Enterprise)**
   - Organization-level audit tracking

**Best Practices:**
- Use Auth Audit Logs for authentication tracking
- Use pgAudit for database-level compliance
- Use supa_audit for specific table tracking (low-throughput)
- Use custom triggers for application-specific needs

**Sources:**
- [Auth Audit Logs | Supabase Docs](https://supabase.com/docs/guides/auth/audit-logs)
- [PGAudit: Postgres Auditing | Supabase Docs](https://supabase.com/docs/guides/database/extensions/pgaudit)
- [Platform Audit Logs | Supabase Docs](https://supabase.com/docs/guides/security/platform-audit-logs)

---

### 2. AWS CloudTrail

**Architecture:** Centralized, multi-region audit trail

**Core Features:**
- Management events (Console/API configuration changes)
- Data events (S3 and Lambda runtime operations)
- CloudTrail Insights (anomaly detection)
- Organization trails (multi-account)
- Advanced event selectors
- Log file validation (SHA-256 hashing + RSA signing)

**Best Practices:**

1. **Enable Multi-Region Logging** - Complete record across all regions
2. **Create Organization Trails** - Centralized logging for all accounts
3. **Use Advanced Event Selectors** - Filter high-volume events
4. **Dedicated S3 Bucket** - Separate bucket for trail events
5. **Enable Encryption** - SSE-KMS for log files
6. **Log File Validation** - Cryptographic integrity
7. **CloudTrail Insights** - Unusual API activity detection
8. **Centralized Logging** - "If CloudTrail isn't capturing it, it didn't happen"
9. **Separate Trails** - Different teams (security, dev) → separate buckets

**Architecture Pattern:**
- Multi-account setup with organization trails
- CloudTrail → S3 (immutable storage) → Athena (querying) / Splunk (analysis)
- Separate trails for compliance vs operational monitoring

**Security Layers:**
- Restrictive IAM policies
- Comprehensive logging
- Queryable audit trails
- Immutable storage

**Sources:**
- [AWS CloudTrail Best Practices](https://aws.amazon.com/blogs/mt/aws-cloudtrail-best-practices/)
- [12 Best Practices for CloudTrail](https://cloudviz.io/blog/12-best-practices-for-using-aws-cloudtrail)
- [CloudTrail Best Practices - Cybr](https://cybr.com/cloud-security/aws-cloudtrail-best-practices-checklist-and-cheat-sheet/)

---

### 3. Stripe Audit & Logging System

**Architecture:** Canonical log lines + request logging

**Key Features:**

1. **API Request Logging**
   - Every API request logged
   - Viewable in Developers Dashboard
   - Filterable by parameters
   - Shows calls and responses

2. **Canonical Log Lines**
   - Single line per request with complete context
   - Middleware-based implementation
   - Post-request step generates log line
   - Modules decorate request environment during lifecycle
   - Hardened for reliability:
     - Ruby `ensure` block (logs even during exceptions)
     - Logging wrapped in `begin/rescue` block
   - Focus: Maximizing chance of log emission for every request

3. **Audit Logs for Security**
   - Sensitive account activity (logins, bank account changes)
   - Exportable historical information
   - Monitored for intrusions and suspicious activity

4. **Reports API**
   - Financial reports in CSV format
   - Scheduled automatic runs
   - On-demand execution

**Design Philosophy:**
- Every request must be logged
- Single canonical log line per request
- Fault-tolerant logging (never skip logs)
- Dashboard visibility + programmatic access

**Sources:**
- [View API request logs | Stripe Documentation](https://docs.stripe.com/development/dashboard/request-logs)
- [Canonical log lines - Stripe Blog](https://stripe.com/blog/canonical-log-lines)
- [How the Reports API works - Stripe](https://docs.stripe.com/reports/api)

---

### 4. GitHub Audit Log System

**Architecture:** REST API + Streaming

**Key Features:**

1. **REST API**
   - Enterprise and organization audit logs
   - Read:audit_log scope (no admin required)
   - 180-day retention (Git events: 7 days)
   - Default: 3 months displayed

2. **Authentication & Authorization**
   - Scoped tokens (read:audit_log)
   - No full admin privileges required

3. **Query Capabilities**
   - Timestamps: UTC epoch milliseconds
   - Cursor-based pagination
   - Parameters: `created`, `actor`, `action`
   - Git events: `include=git` or `include=all`

4. **Rate Limiting**
   - 1,750 queries/hour per user+IP combination

5. **Audit Log Streaming (GA)**
   - Stream to external systems
   - Programmatic configuration via REST API
   - Multi-endpoint streaming (2 endpoints)
   - Same type or different providers
   - API requests to private assets tracked

**Advanced Features:**
- Streaming of API requests (visibility into API activity)
- Multi-endpoint streaming
- Programmatic configuration
- Git events and REST API events

**Sources:**
- [Using the audit log API - GitHub Docs](https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/using-the-audit-log-api-for-your-enterprise)
- [Audit log streaming - GitHub Changelog](https://github.blog/changelog/2025-01-13-audit-log-streaming-of-api-requests-is-generally-available/)
- [Access Audit Log with scoped tokens - GitHub](https://github.blog/changelog/2022-12-19-access-the-audit-log-rest-api-using-scoped-tokens/)

---

### 5. Auth0 Audit Logs

**Key Features:**

1. **Log Streaming**
   - Export to preferred analysis tools
   - Multiple integration services
   - Custom log streams via webhooks

2. **FGA Logging API (Fine-Grained Authorization)**
   - Logs for all Auth0 FGA APIs
   - Relationship tuple changes
   - Access checks
   - Authorization model updates
   - Powerful filtering:
     - Time range
     - User
     - IP address
     - API operation
     - Status code

3. **Security & Reliability**
   - High availability
   - Encrypted in transit and at rest

4. **Extensibility Modifications**
   - Rules/Hooks/Actions updates generate 'sapi' log
   - Includes admin details in 'details.auth' object

5. **Integration**
   - Custom webhooks
   - Configurable payload URLs
   - Authorization tokens
   - Content format configuration

**Best Use Case:** Authentication/authorization systems requiring comprehensive audit trails with streaming capabilities.

**Sources:**
- [Auth0 Logs](https://auth0.com/docs/deploy-monitor/logs)
- [Auth0 FGA Logging API](https://auth0.com/blog/auth0-fga-logging-api-a-complete-audit-trail-for-authorization/)
- [Add Audit Log Streaming to Auth0](https://pangea.cloud/blog/add-audit-log-streaming-to-auth0-in-2-mins/)

---

### 6. Hasura Event Triggers

**Architecture:** Database triggers + GraphQL event system

**Key Features:**

1. **Event Capture**
   - Database triggers on INSERT/UPDATE/DELETE
   - Per-row changes captured
   - Written to Hasura Events table
   - Events table acts as queue

2. **Event Configuration**
   - Activate on INSERT, UPDATE, or DELETE
   - Asynchronous logic automation
   - User context from Hasura GraphQL engine
   - Access via `current_setting('hasura.user')`

3. **Audit Pattern Implementation**
   - Dedicated audit trigger pattern
   - JSONB storage for row data
   - Logs user information

4. **Monitoring**
   - pg_get_event_logs for fetching event logs
   - Every 10 minutes: count of events fetched per source
   - Number of fetches in 10-minute window

5. **Observability**
   - Event and invocation logs
   - Performance tuning capabilities
   - API methods for retrieving logs

**Best Use Case:** GraphQL-based applications requiring database change tracking with webhook automation.

**Sources:**
- [Event Triggers Overview - Hasura Docs](https://hasura.io/docs/2.0/event-triggers/overview/)
- [Comprehensive Hasura Event Triggers Guide - Medium](https://medium.com/@pilsy/hasura-event-triggers-82781575d325)
- [audit-trigger-pg96 for Hasura - GitHub](https://github.com/hynra/audit-trigger-pg96)

---

## Database CDC Solutions

### Change Data Capture (CDC) Overview

**Definition:** Design pattern that tracks database tables, capturing every row-level insert, update, and delete as it happens.

**Key Use Cases:**
- Updating/invalidating cache
- Enriching data/logs from entity identifiers
- Real-time data loading into data warehouses and search engines
- Synchronizing data (on-premises to cloud)
- Microservices data exchange (outbox pattern)

---

### Debezium for PostgreSQL

**Architecture:** Kafka connector using PostgreSQL logical decoding

**Key Features:**
- Reads all change events from PostgreSQL
- Publishes to Kafka topics
- Snapshot of existing data + ongoing monitoring
- Row-level change tracking

**Patterns:**

1. **Outbox Pattern**
   - Additional outbox table alongside original tables
   - Consolidates information
   - Update both tables within transaction
   - Consistent view propagation

2. **Logical Decoding (No Outbox)**
   - Write directly to WAL log
   - Consistent view to Kafka
   - No extra tables needed

**Implementation Approaches:**

1. **With Kafka**
   - Debezium → Kafka → Kafka Connect → Target
   - Near real-time replication
   - Scalable for high throughput

2. **Without Kafka (Debezium Server)**
   - Lighter weight for smaller systems
   - Direct integration with targets
   - Example: Django + PostgreSQL + MongoDB

**Best Use Case:** Applications requiring real-time data replication, cache invalidation, or microservices data exchange.

**Sources:**
- [Enabling CDC with Debezium PostgreSQL Connector](https://www.confluent.io/blog/cdc-and-data-streaming-capture-database-changes-in-real-time-with-debezium/)
- [PostgreSQL CDC with Logical Decoding & Debezium](https://aiven.io/developer/cdc-multiple-postgresql-tables-logical-decoding)
- [CDC with Debezium Server (No Kafka) - DEV](https://dev.to/maqboolthoufeeq/change-data-capture-cdc-with-debezium-server-no-kafka-django-postgres-mongodb-example-m0h)
- [GitHub - postgresql-change-data-capture-using-debezium](https://github.com/canertosuner/postgresql-change-data-capture-using-debezium)

---

## Data Model & Core Fields

### Essential Audit Log Fields

Based on industry standards from Stripe, GitHub, AWS, and enterprise systems:

#### Core Fields (Required)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| **event_id** | UUID | Unique identifier for audit event | `550e8400-e29b-41d4-a716-446655440000` |
| **timestamp** | timestamptz | When event occurred (NTP synced, UTC, millisecond precision) | `2025-12-26T10:30:45.123Z` |
| **actor** | text/jsonb | Who performed action (user ID, API key, service account) | `user:123`, `api_key:pk_live_...` |
| **action** | text | What happened (verb) | `created`, `updated`, `deleted`, `accessed` |
| **resource_type** | text | Type of object changed | `publisher_zmanim`, `user`, `api_key` |
| **resource_id** | text | Identifier of affected resource | `zmn_123` |
| **status** | text | Success/failure | `success`, `failure`, `partial` |

#### Contextual Fields (Recommended)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| **event_name** | text | Human-readable event type | `publisher.zmanim.created` |
| **description** | text | Human-readable summary | `Created new zman definition for Shabbos` |
| **ip_address** | inet | Source IP address | `192.168.1.100` |
| **user_agent** | text | Client information | `Mozilla/5.0 ...` |
| **country** | text | Geolocation | `US`, `IL` |
| **device_id** | text | Device identifier | `dev_abc123` |
| **session_id** | text | Session identifier | `sess_xyz789` |

#### Change Details (For Data Changes)

| Field | Type | Description |
|-------|------|-------------|
| **old_values** | jsonb | State before change |
| **new_values** | jsonb | State after change |
| **changed_fields** | text[] | Array of changed field names |
| **operation** | text | CRUD category: `CREATE`, `READ`, `UPDATE`, `DELETE` |

#### Metadata (Optional)

| Field | Type | Description |
|-------|------|-------------|
| **publisher_id** | integer | Tenant/organization context |
| **request_id** | text | Correlation ID for request tracing |
| **api_version** | text | API version used |
| **source** | text | Origin of action: `web`, `api`, `system`, `scheduled_job` |
| **tags** | text[] | Categorization tags |
| **error_code** | text | Error code if failed |
| **error_message** | text | Error details if failed |

### Recommended Table Schema (PostgreSQL)

```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- When & Who
  ts timestamptz NOT NULL DEFAULT now(),
  actor_type text NOT NULL, -- 'user', 'api_key', 'service', 'system'
  actor_id text NOT NULL,
  actor_name text,

  -- What & Where
  event_name text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  status text NOT NULL DEFAULT 'success',

  -- Context
  ip_address inet,
  user_agent text,
  country text,
  session_id text,
  request_id text,

  -- Changes (nullable for non-data operations)
  operation text, -- 'CREATE', 'READ', 'UPDATE', 'DELETE'
  old_values jsonb,
  new_values jsonb,
  changed_fields text[],

  -- Metadata
  publisher_id integer, -- tenant context
  source text, -- 'web', 'api', 'system'
  api_version text,
  description text,
  tags text[],

  -- Error tracking
  error_code text,
  error_message text,

  -- Compliance
  retention_policy text, -- 'standard', 'extended', 'permanent'

  -- Indexes
  CONSTRAINT valid_actor_type CHECK (actor_type IN ('user', 'api_key', 'service', 'system')),
  CONSTRAINT valid_status CHECK (status IN ('success', 'failure', 'partial'))
);

-- Indexes for common queries
CREATE INDEX idx_audit_logs_ts ON audit_logs (ts DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_type, actor_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs (resource_type, resource_id);
CREATE INDEX idx_audit_logs_event ON audit_logs (event_name);
CREATE INDEX idx_audit_logs_publisher ON audit_logs (publisher_id) WHERE publisher_id IS NOT NULL;
CREATE INDEX idx_audit_logs_session ON audit_logs (session_id) WHERE session_id IS NOT NULL;

-- GIN index for JSONB querying
CREATE INDEX idx_audit_logs_old_values ON audit_logs USING gin (old_values);
CREATE INDEX idx_audit_logs_new_values ON audit_logs USING gin (new_values);
```

### Best Practices

1. **NTP Synced Timestamps:** Use server time synced with NTP, stored in UTC with millisecond precision
2. **Individual Log Combination:** Design for aggregation with other audit logs (accurate timestamps essential)
3. **Immutability:** Audit logs should be append-only (no updates or deletes)
4. **Structured Data:** Use JSONB for old_values/new_values to enable querying
5. **Actor Identification:** Store multiple actor identifiers (user ID + name) for resilience
6. **Request Correlation:** Use request_id to trace actions across multiple audit events

**Sources:**
- [Audit Logs: A Comprehensive Guide - Middleware.io](https://middleware.io/blog/audit-logs/)
- [Enterprise Ready SaaS App Guide to Audit Logging](https://www.enterpriseready.io/features/audit-log/)
- [Audit Log Pattern - Martin Fowler](https://martinfowler.com/eaaDev/AuditLog.html)

---

## UI/UX Patterns

### Core Design Principles

Based on patterns from Stripe, GitHub, AWS, and enterprise SaaS applications:

#### 1. Data Presentation

**Table View:**
- Paginated table as primary view
- Time-stamps formatted clearly
- Only relevant metadata (nothing excess)
- Newest first (reverse chronological)
- Row expansion for details

**Key Columns:**
- Timestamp (relative + absolute on hover)
- Actor (user/service name + icon)
- Action (verb + resource type)
- Status (success/failure badge)
- Quick actions (view details, export)

#### 2. Filtering Capabilities

**Multi-Filter Support:**
- Combine filters together (AND logic)
- Common filters:
  - Event type
  - User/actor
  - Source (web, API, system)
  - Date/time range
  - Resource type
  - Status (success/failure)
  - IP address
  - Country

**Filter UX:**
- Display applied filters clearly
- "Clear all" button (essential)
- Filter chips/badges that are removable
- Filter count indicator
- Save filter presets (optional)

**Time Window Filtering:**
- Users rarely sort by anything other than date
- Provide quick presets: "Last hour", "Last 24h", "Last 7d", "Last 30d", "Custom range"
- Date range picker with time selection

#### 3. Search Functionality

**Search Implementation:**
- Search box within filter panel
- Search across:
  - Event names
  - Actor names
  - Resource IDs
  - Descriptions
  - IP addresses
- Incremental/typeahead search
- Search fragments (partial matching)

**Search UX:**
- Highlight matched terms in results
- Show search context (which field matched)
- Clear search button

#### 4. Export Capabilities

**Export Formats:**
- CSV (most common)
- JSON (for programmatic use)
- PDF (for compliance documentation)

**Export Options:**
- Export current filtered view
- Export date range
- Export all (with warnings for large datasets)
- Schedule periodic exports

**Streaming/Webhooks:**
- Real-time streaming to external systems (Splunk, AWS, SIEM)
- Webhook notifications for specific events
- Event-driven integrations

#### 5. Detail Views

**Expandable Rows:**
- Click row to expand full details
- Show complete context:
  - All metadata fields
  - Before/after values (diff view)
  - Related events (same request_id)
  - Full request/response (for API calls)

**Diff Visualization:**
- Side-by-side comparison for updates
- Color-coded changes (red for removed, green for added)
- Field-level highlighting

#### 6. Advanced Features

**Shareable URLs:**
- Encode filter parameters in URL
- Copy link to current filtered view
- Permalink to specific audit event

**Real-time Updates:**
- WebSocket/SSE for live log streaming
- Auto-refresh option
- "New events available" notification

**Visualization:**
- Timeline view (chronological visualization)
- Activity heatmap (time-based patterns)
- Actor activity chart
- Event type distribution

### Reference Implementations

**GitHub Audit Log UI:**
- Time range selector
- Multi-select filters (action, actor)
- Export to CSV
- API access with same filters

**AWS CloudTrail Console:**
- Event history with filters
- Lookup attributes (resource, user, event name)
- Download events (CSV/JSON)
- Create Insights for anomaly detection

**Stripe Dashboard:**
- Request logs with detailed metadata
- Filter by status, method, resource
- View request/response bodies
- Copy as cURL

### Accessibility Considerations

- Keyboard navigation
- Screen reader support
- High contrast mode
- Responsive design (mobile-friendly)

**Sources:**
- [Guide to Building Audit Logs - Medium](https://medium.com/@tony.infisical/guide-to-building-audit-logs-for-application-software-b0083bb58604)
- [Complexities of Building Audit Logs - Harness IO](https://www.harness.io/blog/complexities-of-building-audit-logs)
- [Filtering UX/UI design patterns - LogRocket](https://blog.logrocket.com/ux-design/filtering-ux-ui-design-patterns-best-practices/)
- [Filter UX Best Practices - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering)

---

## Performance & Scalability

### PostgreSQL Performance Characteristics

#### Benchmarks

**PostgreSQL vs MySQL (1M records):**
- PostgreSQL: 0.6-0.8 ms execution time
- MySQL: 9-12 ms execution time
- **PostgreSQL is ~13x faster**

**Concurrent Operations:**
- PostgreSQL: Stable performance (0.7-0.9 ms during concurrent inserts)
- MySQL: Significant performance degradation

**Scalability:**
- Distributed PostgreSQL: TPCC benchmark with 100,000 warehouses across 59 instances

**Sources:**
- [A Performance Benchmark for PostgreSQL and MySQL](https://www.mdpi.com/1999-5903/16/10/382)
- [How We Test Distributed PostgreSQL - Yugabyte](https://www.yugabyte.com/blog/testing-distributed-postgresql/)

---

### Audit Logging Performance Impact

#### Trigger-Based Audit Trails

**Performance Overhead:**
- Triggers utilize resources equal to user operation
- Significant impact on OLTP environments
- Heavy data volume environments struggle
- Indexes on audit tables slow writes
- Can degrade query performance by 20-30%

**Throughput Limits:**
- Supabase supa_audit: NOT recommended for >3k writes/second per table
- Reduces INSERT/UPDATE/DELETE throughput

**Sources:**
- [Pros and cons of SQL Server audit triggers - TechTarget](https://www.techtarget.com/searchdatamanagement/tip/Pros-and-cons-of-using-SQL-Server-audit-triggers-for-DBAs)
- [PGAudit: Postgres Auditing - Supabase](https://supabase.com/docs/guides/database/extensions/pgaudit)

---

### Optimization Strategies

#### 1. Async Logging

**Pattern:** Queue audit events for async processing
- Application writes to in-memory queue
- Background worker processes queue → writes to database
- Reduces user-facing latency
- Risk: Potential log loss on crash (mitigate with persistent queue)

#### 2. Bulk Logging

**Pattern:** Batch multiple audit events
- Collect events in memory
- Flush in batches (e.g., every 100 events or 1 second)
- Reduces database round trips
- Instant logging for bulk changes

**Sources:**
- [Postgres Performance Best Practices - Tiger Data](https://www.tigerdata.com/learn/postgres-performance-best-practices)

#### 3. Partitioning

**Pattern:** Partition audit_logs by timestamp

**Benefits:**
- Query performance (partition pruning skips irrelevant partitions)
- Efficient archival (detach old partitions)
- Fast deletion (drop partition vs delete millions of rows)

**Implementation:**
```sql
-- Create partitioned table (PostgreSQL 10+)
CREATE TABLE audit_logs (
  id uuid DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL,
  -- ... other fields
) PARTITION BY RANGE (ts);

-- Create monthly partitions
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE audit_logs_2025_02 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Auto-create partitions with pg_partman
```

**Archival Strategy:**
```sql
-- Detach partition (PostgreSQL 14+, non-blocking)
ALTER TABLE audit_logs DETACH PARTITION audit_logs_2023_01 CONCURRENTLY;

-- Move to cheaper storage
ALTER TABLE audit_logs_2023_01 SET TABLESPACE cold_storage;

-- Or export and drop
COPY audit_logs_2023_01 TO '/archive/audit_logs_2023_01.csv' CSV HEADER;
DROP TABLE audit_logs_2023_01;
```

**Automation:**
- Use pg_partman for automatic partition creation and archival
- Configure retention policies (e.g., archive after 90 days)

**Sources:**
- [Audit logging with Postgres partitioning - Elephas](https://elephas.io/audit-logging-with-postgres-partitioning/)
- [Data archiving and retention in PostgreSQL - Data Egret](https://dataegret.com/2025/05/data-archiving-and-retention-in-postgresql-best-practices-for-large-datasets/)
- [Auto-archiving with pg_partman - Crunchy Data](https://www.crunchydata.com/blog/auto-archiving-and-data-retention-management-in-postgres-with-pg_partman)
- [Partitioning API request logs - Medium](https://medium.com/engineering-semantics3/partitioning-in-postgresql-161e52c367ba)

#### 4. Selective Auditing

**Pattern:** Only audit what's necessary
- Use event selectors (pgAudit advanced event selectors)
- Exclude high-volume, low-value operations (e.g., SELECT queries)
- Focus on security-critical events

#### 5. Separate Database/Tablespace

**Pattern:** Isolate audit logs
- Dedicated database for audit logs
- Separate tablespace on different disk
- Prevents audit logging from impacting application database performance

#### 6. Index Strategy

**Balance:**
- Too many indexes: Slow writes
- Too few indexes: Slow queries

**Recommended Indexes:**
- Timestamp (range queries)
- Actor (user activity queries)
- Resource type + ID (object history)
- Event name (filtering)
- Partial indexes for common WHERE clauses

**Avoid:**
- Indexing every column
- Indexing JSONB old_values/new_values (use GIN indexes sparingly)

---

### Benchmarking Tools

**pgbench:** PostgreSQL's built-in benchmarking tool
- Simulates concurrent clients
- Measures transaction throughput

**sysbench:** More flexible for custom workloads

**Sources:**
- [How to Benchmark PostgreSQL - Severalnines](https://severalnines.com/blog/benchmarking-postgresql-performance/)
- [Benchmark PostgreSQL for Optimal Performance - DZone](https://dzone.com/articles/how-to-benchmark-postgresql-for-optimal-performance)

---

### Immutable & Tamper-Proof Design

For highest security requirements:

**Blockchain-Based Audit Logs:**
- Cryptographic hashing of each entry
- Chained hashes (each entry includes hash of previous)
- Immutable append-only structure
- Tamper detection (hash chain breaks if modified)

**Hybrid On-Chain/Off-Chain:**
- Store full audit data off-chain (encrypted)
- Store hashes on blockchain (public or private)
- Periodic anchoring to public blockchain (e.g., Ethereum)

**Oracle Blockchain Tables:**
- Tamper-proof audit logs within PostgreSQL
- Cryptographic signatures
- Prevents unauthorized modifications

**Best Use Cases:**
- High-value transactions (financial, healthcare)
- Regulatory compliance (SOC2, GDPR)
- Privileged access monitoring

**Sources:**
- [Blockchain and Immutable Logging - Logzilla](https://www.logzilla.net/blogs/blockchain-log-management-immutable-logging)
- [Immutable Audit Log Architecture - EmergentMind](https://www.emergentmind.com/topics/immutable-audit-log)
- [Tamper-Proof Audit Logs with Oracle Blockchain - Medium](https://medium.com/oracledevs/achieving-tamper-proof-audit-logs-with-oracle-blockchain-tables-87cae027986e)
- [What Are Immutable Logs? - HubiFi](https://www.hubifi.com/blog/immutable-audit-log-guide)

---

## Compliance & Retention

### GDPR Requirements

**Key Principles:**
- No concrete retention period guidelines
- Balance security needs with data minimization
- Right to be forgotten (RTBF) vs audit trail mandates

**Valid Reasons for Retention:**
- Genuine business purposes
- Audit requirements
- Legal obligations
- These override erasure requests

**Implementation:**
- Can maintain audit logs despite RTBF requests
- Document legitimate compliance needs
- Pseudonymize personal data where possible
- Separate PII from audit events

**Sources:**
- [Security log retention best practices - AuditBoard](https://auditboard.com/blog/security-log-retention-best-practices-guide)
- [Right To Be Forgotten vs Audit Trail - Axiom](https://axiom.co/blog/the-right-to-be-forgotten-vs-audit-trail-mandates)

---

### SOC 2 Requirements

**Approach:** Risk-based, flexible

**Requirements:**
- Processes for classifying data
- Retention policies for confidential/personal information
- Secure deletion mechanisms
- Documentation of log management practices

**Best Practices:**
1. **Classify Data:** Identify personal information in audit logs
2. **Define Retention Periods:** Map to legal obligations and operational needs
3. **Document Policies:** Readily available for audits
4. **Implement Secure Deletion:** Prevent recovery after retention period

**Retention Period Guidance:**
- Varies by industry
- Typical: 6 months to 2 years
- Balance security investigation needs with data minimization

**Sources:**
- [Data Retention Policy & SOC 2 - LinfordCo](https://linfordco.com/blog/data-retention-policy-soc-2/)
- [Log Management for HIPAA, SOC 2, and GDPR - MEV](https://mev.com/blog/log-management-for-compliance-faqs-best-practices)
- [SOC 2 Data Security and Retention - Bytebase](https://www.bytebase.com/blog/soc2-data-security-and-retention-requirements/)

---

### Recommended Retention Strategy

**Tier-Based Retention:**

| Tier | Events | Retention | Storage |
|------|--------|-----------|---------|
| **Critical** | Auth changes, privilege escalation, financial transactions | 7 years | Hot database |
| **High** | Data modifications, configuration changes | 2 years | Hot → Warm (1 year) |
| **Medium** | API access, read operations | 1 year | Warm storage |
| **Low** | System events, health checks | 90 days | Cold storage |

**Storage Tiers:**
- **Hot:** PostgreSQL (fast queries)
- **Warm:** Partitioned PostgreSQL or separate archive database
- **Cold:** S3/Blob Storage (CSV/Parquet), compressed

**Automated Lifecycle:**
```sql
-- Example: pg_partman configuration
SELECT partman.create_parent(
  'public.audit_logs',
  'ts',
  'native',
  'monthly'
);

UPDATE partman.part_config
SET retention = '365 days',
    retention_keep_table = false
WHERE parent_table = 'public.audit_logs';
```

---

### GDPR + SOC 2 Compliance Strategy

1. **Document Retention Policy**
   - Map event types to retention periods
   - Justify each period (legal, compliance, operational)
   - Review annually

2. **Implement Data Classification**
   - Tag events with retention tier
   - Identify PII in audit logs
   - Pseudonymize where possible

3. **Automate Lifecycle Management**
   - Partition by time
   - Auto-archive to cold storage
   - Auto-delete after retention period
   - Secure deletion (unrecoverable)

4. **Handle RTBF Requests**
   - Pseudonymize user identifier in audit logs
   - Retain pseudonymized audit trail for compliance
   - Document legitimate interest justification

5. **Audit the Audit Logs**
   - Log access to audit logs
   - Monitor for tampering
   - Regular integrity checks (hash verification)

---

## Anti-Patterns to Avoid

### 1. Trigger-Based Audit Trails (High-Throughput Environments)

**Problem:**
- Triggers add processing overhead equal to user operation
- Performance degradation (20-30% in complex scenarios)
- Struggles with high OLTP volumes
- Can't overload audit table with indexes without killing write performance

**When Acceptable:**
- Low-throughput tables (<1,000 writes/second)
- Tables with infrequent changes
- When database-level enforcement is required

**Alternatives:**
- Application-level logging
- Async queue-based logging
- CDC with Debezium

**Sources:**
- [Audit Trail Anti-Patterns - Complete Developer Podcast](https://completedeveloperpodcast.com/audit-trail-anti-patterns/)
- [Pros and cons of SQL audit triggers - TechTarget](https://www.techtarget.com/searchdatamanagement/tip/Pros-and-cons-of-using-SQL-Server-audit-triggers-for-DBAs)
- [Database Anti-patterns: Performance Killers - RustProof Labs](https://blog.rustprooflabs.com/2018/01/db-anti-pattern)

---

### 2. Triggers Without Schema Change Auditing

**Problem:**
- If not logging DDL changes, someone can:
  1. Remove trigger
  2. Make changes
  3. Restore trigger
- Hard to detect
- Security vulnerability

**Solution:**
- Use pgAudit for DDL logging
- Monitor schema changes
- Restrict DDL permissions
- Alert on trigger modifications

**Sources:**
- [Audit Trail Anti-Patterns Podcast](https://completedeveloperpodcast.com/audit-trail-anti-patterns/)

---

### 3. Hidden Triggers (Maintainability Issue)

**Problem:**
- Triggers are not very visible
- Don't reside in application code
- Reside in database (out of sight)
- Easy to forget or lose during migrations
- Debugging is difficult

**Solution:**
- Document all triggers
- Include trigger definitions in version control
- Migration scripts to create triggers
- Use application-level logging where possible

**Sources:**
- [Are SQL Triggers An Anti Pattern? - Full Stack Consulting](https://fullstackconsulting.co.uk/articles/are-sql-triggers-an-anti-pattern-in-application-integration-projects)

---

### 4. Unbounded Audit Table Growth

**Problem:**
- Audit trails dwarf main application tables over time
- Queries get slower as table grows
- Disk space exhaustion
- Expensive cloud storage costs

**Solution:**
- Implement partitioning (by month)
- Define retention policies
- Archive to cold storage
- Auto-delete after retention period
- Use table partitioning from day one

**Sources:**
- [Audit Trail Anti-Patterns Podcast](https://completedeveloperpodcast.com/audit-trail-anti-patterns/)

---

### 5. Synchronous Logging in Critical Path

**Problem:**
- Audit log write failure blocks user operation
- Latency added to every request
- Poor user experience
- Audit logging becomes availability bottleneck

**Solution:**
- Async logging (queue-based)
- Fire-and-forget pattern
- Persistent queue (Redis, RabbitMQ) to prevent loss
- Graceful degradation (log locally if remote logging fails)

---

### 6. Logging Everything Without Filtering

**Problem:**
- Overwhelming volume of logs
- High storage costs
- Slow queries due to volume
- Signal-to-noise ratio too low
- Compliance risk (logging sensitive data unnecessarily)

**Solution:**
- Define what needs auditing (risk-based approach)
- Use event selectors (pgAudit advanced selectors)
- Exclude low-value, high-volume events
- Separate operational logs from audit logs

---

### 7. No Audit Log Integrity Protection

**Problem:**
- Audit logs can be tampered with
- No detection of modifications
- Compliance violation
- Useless for forensics if not trustworthy

**Solution:**
- Append-only tables (revoke UPDATE/DELETE)
- Cryptographic hashing (hash chains)
- Separate database with restricted access
- Immutable storage (WORM storage, blockchain)
- Stream to external SIEM (off-site copy)

---

### 8. Poor Indexing Strategy

**Problem:**
- Too many indexes: Slow writes, bloat
- Too few indexes: Slow queries

**Solution:**
- Index only columns used in WHERE/JOIN clauses
- Use partial indexes for common filters
- Analyze query patterns before adding indexes
- Monitor index usage (pg_stat_user_indexes)

---

### 9. Storing Sensitive Data in Logs

**Problem:**
- Passwords, tokens, PII in audit logs
- GDPR/privacy violations
- Security risk if audit logs compromised

**Solution:**
- Redact sensitive fields before logging
- Hash/mask PII
- Use pgAudit's automatic password redaction
- Encrypt audit logs at rest

---

### 10. No Monitoring of Audit System Itself

**Problem:**
- Audit system fails silently
- Gap in audit trail
- Compliance violation
- No alerting on failures

**Solution:**
- Monitor audit log ingestion rate
- Alert on dropped events
- Health checks for audit pipeline
- Audit the audit logs (meta-audit)

**Sources:**
- [Complexities of Building Audit Logs - Harness IO](https://www.harness.io/blog/complexities-of-building-audit-logs)

---

## Recommended Patterns

### 1. Hybrid Application + Database Auditing

**Pattern:**
- Application-level logging for business events (what user intended)
- Database-level logging (pgAudit) for DDL and privileged operations
- Best of both worlds

**Implementation:**
```go
// Application layer
func (s *Service) UpdateZman(ctx context.Context, params UpdateZmanParams) error {
    // Business logic
    err := s.db.UpdateZman(ctx, params)
    if err != nil {
        return err
    }

    // Application audit log (what user intended)
    s.auditLogger.Log(ctx, AuditEvent{
        Actor: getCurrentUser(ctx),
        Action: "updated",
        Resource: "publisher_zmanim",
        ResourceID: params.ID,
        Description: "Updated zman formula",
        OldValues: params.OldFormula,
        NewValues: params.NewFormula,
    })

    return nil
}

// Database layer (pgAudit)
-- Automatically logs DDL: CREATE TABLE, ALTER TABLE, DROP TABLE
-- Automatically logs privileged DML: INSERT/UPDATE/DELETE by admin users
```

**Benefits:**
- Capture intent (application layer)
- Capture what actually happened (database layer)
- Detect discrepancies
- DDL changes captured

---

### 2. Async Queue-Based Logging

**Pattern:**
- Application writes to in-memory queue
- Background worker processes queue
- Persistent queue (Redis Streams, PostgreSQL, RabbitMQ)

**Implementation:**
```go
type AuditLogger struct {
    queue chan AuditEvent
    db    *sql.DB
}

func NewAuditLogger(db *sql.DB) *AuditLogger {
    al := &AuditLogger{
        queue: make(chan AuditEvent, 1000), // Buffered channel
        db:    db,
    }
    go al.worker() // Background worker
    return al
}

func (al *AuditLogger) Log(ctx context.Context, event AuditEvent) {
    select {
    case al.queue <- event:
        // Success
    default:
        // Queue full - fallback to sync logging or drop with alert
        log.Error("Audit queue full, logging synchronously")
        al.logSync(ctx, event)
    }
}

func (al *AuditLogger) worker() {
    batch := make([]AuditEvent, 0, 100)
    ticker := time.NewTicker(1 * time.Second)

    for {
        select {
        case event := <-al.queue:
            batch = append(batch, event)
            if len(batch) >= 100 {
                al.flushBatch(batch)
                batch = batch[:0]
            }
        case <-ticker.C:
            if len(batch) > 0 {
                al.flushBatch(batch)
                batch = batch[:0]
            }
        }
    }
}

func (al *AuditLogger) flushBatch(events []AuditEvent) {
    // Bulk INSERT (COPY or multi-value INSERT)
    // Use pgx.Batch for efficient bulk inserts
}
```

**Benefits:**
- No user-facing latency
- Batch writes (efficient)
- Resilient (buffered queue)

**Trade-offs:**
- Potential log loss on crash (mitigate with persistent queue)
- Slight complexity

---

### 3. Partitioning from Day One

**Pattern:**
- Create audit_logs as partitioned table immediately
- Monthly partitions (or weekly for high volume)
- Automate with pg_partman

**Implementation:**
```sql
-- Create partitioned table
CREATE TABLE audit_logs (
    id uuid DEFAULT gen_random_uuid(),
    ts timestamptz NOT NULL,
    -- ... other fields
) PARTITION BY RANGE (ts);

-- Initial partitions (past, current, future)
CREATE TABLE audit_logs_2025_12 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Install and configure pg_partman
CREATE EXTENSION pg_partman;

SELECT partman.create_parent(
    p_parent_table := 'public.audit_logs',
    p_control := 'ts',
    p_type := 'native',
    p_interval := 'monthly',
    p_premake := 3  -- Create 3 months ahead
);

-- Configure retention (auto-archive after 1 year)
UPDATE partman.part_config
SET
    retention = '365 days',
    retention_keep_table = false,  -- Drop old partitions
    retention_schema = 'audit_archive'  -- Or move to archive schema
WHERE parent_table = 'public.audit_logs';

-- Schedule partition maintenance
SELECT cron.schedule(
    'partition-maintenance',
    '0 3 * * *',  -- Daily at 3 AM
    $$SELECT partman.run_maintenance_proc()$$
);
```

**Benefits:**
- Fast queries (partition pruning)
- Efficient archival (detach partition)
- Easy retention enforcement
- Scalable from start

---

### 4. Tiered Retention with Lifecycle Management

**Pattern:**
- Tag events with retention tier
- Automate lifecycle transitions (hot → warm → cold → delete)
- Different storage for different tiers

**Implementation:**
```sql
-- Add retention_policy to audit_logs
ALTER TABLE audit_logs ADD COLUMN retention_policy text
    DEFAULT 'standard'
    CHECK (retention_policy IN ('critical', 'high', 'standard', 'low'));

-- Retention policies
CREATE TABLE audit_retention_policies (
    policy_name text PRIMARY KEY,
    retention_days integer NOT NULL,
    archive_after_days integer,
    description text
);

INSERT INTO audit_retention_policies VALUES
    ('critical', 2555, 365, '7 years - auth, privilege escalation, financial'),
    ('high', 730, 365, '2 years - data modifications, config changes'),
    ('standard', 365, 90, '1 year - API access, read operations'),
    ('low', 90, 30, '90 days - system events, health checks');

-- Archive job (moves old partitions to cold storage)
CREATE OR REPLACE FUNCTION archive_old_partitions() RETURNS void AS $$
DECLARE
    partition_name text;
BEGIN
    FOR partition_name IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename LIKE 'audit_logs_%'
        AND -- Partition older than 90 days
    LOOP
        -- Export to CSV
        EXECUTE format('COPY %I TO ''/archive/%I.csv'' CSV HEADER',
            partition_name, partition_name);

        -- Upload to S3 (using aws_s3 extension or external script)

        -- Detach partition
        EXECUTE format('ALTER TABLE audit_logs DETACH PARTITION %I CONCURRENTLY',
            partition_name);

        -- Drop partition
        EXECUTE format('DROP TABLE %I', partition_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

**Benefits:**
- Cost optimization (cold storage cheaper)
- Compliance (meet retention requirements)
- Performance (smaller hot dataset)

---

### 5. Canonical Log Lines (Stripe Pattern)

**Pattern:**
- Single log line per request with complete context
- Middleware decorates context throughout request lifecycle
- Fault-tolerant logging (always emit log)

**Implementation:**
```go
func AuditMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Start timer
        start := time.Now()

        // Create audit context
        auditCtx := &AuditContext{
            RequestID: r.Header.Get("X-Request-ID"),
            Actor: extractActor(r),
            IPAddress: extractIP(r),
            UserAgent: r.UserAgent(),
        }

        // Attach to request context
        ctx := context.WithValue(r.Context(), auditContextKey, auditCtx)
        r = r.WithContext(ctx)

        // Wrap response writer to capture status
        rw := &responseWriter{ResponseWriter: w}

        // Ensure log emission (defer + recover)
        defer func() {
            if err := recover(); err != nil {
                auditCtx.Status = "panic"
                auditCtx.Error = fmt.Sprintf("%v", err)
            }

            auditCtx.Duration = time.Since(start)

            // Emit canonical log line (never fails)
            emitCanonicalLogLine(auditCtx)
        }()

        // Call next handler
        next.ServeHTTP(rw, r)

        auditCtx.Status = rw.status
        auditCtx.ResponseSize = rw.size
    })
}

func emitCanonicalLogLine(ctx *AuditContext) {
    defer func() {
        // Never let logging crash
        if r := recover(); r != nil {
            log.Error("Failed to emit audit log", "error", r)
        }
    }()

    // Single structured log line with all context
    log.Info("request",
        "request_id", ctx.RequestID,
        "actor", ctx.Actor,
        "action", ctx.Action,
        "resource", ctx.Resource,
        "status", ctx.Status,
        "duration_ms", ctx.Duration.Milliseconds(),
        "ip", ctx.IPAddress,
        "user_agent", ctx.UserAgent,
    )
}
```

**Benefits:**
- One log line per request (easy to parse)
- Complete context in single line
- Fault-tolerant (always emits)
- Observability friendly

---

### 6. Streaming to External SIEM

**Pattern:**
- Stream audit logs to external system (Splunk, Datadog, AWS CloudWatch)
- Immutable off-site copy
- Advanced analytics and alerting

**Implementation:**
```go
// Example: Stream to AWS Kinesis
type KinesisAuditStreamer struct {
    client *kinesis.Client
    stream string
}

func (k *KinesisAuditStreamer) Stream(event AuditEvent) error {
    data, err := json.Marshal(event)
    if err != nil {
        return err
    }

    _, err = k.client.PutRecord(context.Background(), &kinesis.PutRecordInput{
        StreamName:   &k.stream,
        Data:         data,
        PartitionKey: &event.ActorID, // Partition by actor
    })

    return err
}

// Or use webhook streaming (GitHub pattern)
func (s *WebhookAuditStreamer) Stream(event AuditEvent) error {
    data, _ := json.Marshal(event)

    req, _ := http.NewRequest("POST", s.webhookURL, bytes.NewReader(data))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("X-Signature", s.sign(data))

    resp, err := s.client.Do(req)
    // Handle response...

    return err
}
```

**Benefits:**
- Off-site backup (tamper-proof)
- Advanced SIEM analytics
- Correlation with other security logs
- Compliance (centralized logging)

---

### 7. Immutable Append-Only Tables

**Pattern:**
- Revoke UPDATE/DELETE permissions on audit_logs
- Application can only INSERT
- Database enforces immutability

**Implementation:**
```sql
-- Create audit_logs table
CREATE TABLE audit_logs (...);

-- Create dedicated audit_writer role
CREATE ROLE audit_writer;

-- Grant only INSERT (no UPDATE or DELETE)
GRANT INSERT ON audit_logs TO audit_writer;
GRANT SELECT ON audit_logs TO audit_reader;

-- Application uses audit_writer role for logging

-- Additional: Trigger to prevent updates/deletes
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_update_delete
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();
```

**Benefits:**
- Database-enforced immutability
- Tamper-proof
- Compliance (SOC2, GDPR)

---

### 8. Hash Chain for Integrity

**Pattern:**
- Each audit event includes hash of previous event
- Tamper detection (chain breaks if modified)
- Cryptographic integrity

**Implementation:**
```sql
-- Add hash columns
ALTER TABLE audit_logs ADD COLUMN event_hash text;
ALTER TABLE audit_logs ADD COLUMN previous_hash text;

-- Function to calculate event hash
CREATE OR REPLACE FUNCTION calculate_event_hash(event audit_logs)
RETURNS text AS $$
    SELECT encode(sha256(
        (event.ts || event.actor_id || event.action ||
         event.resource_type || event.resource_id ||
         COALESCE(event.previous_hash, ''))::bytea
    ), 'hex');
$$ LANGUAGE sql IMMUTABLE;

-- Trigger to set hashes
CREATE OR REPLACE FUNCTION set_audit_hash()
RETURNS TRIGGER AS $$
DECLARE
    last_hash text;
BEGIN
    -- Get hash of previous event
    SELECT event_hash INTO last_hash
    FROM audit_logs
    ORDER BY ts DESC, id DESC
    LIMIT 1;

    NEW.previous_hash := COALESCE(last_hash, '');
    NEW.event_hash := calculate_event_hash(NEW);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_audit_hash_trigger
    BEFORE INSERT ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION set_audit_hash();

-- Verification function
CREATE OR REPLACE FUNCTION verify_audit_chain()
RETURNS TABLE(valid boolean, broken_at timestamptz) AS $$
BEGIN
    RETURN QUERY
    WITH chain AS (
        SELECT
            id, ts, event_hash, previous_hash,
            LAG(event_hash) OVER (ORDER BY ts, id) as expected_previous
        FROM audit_logs
    )
    SELECT
        bool_and(previous_hash = COALESCE(expected_previous, '')) as valid,
        MIN(ts) FILTER (WHERE previous_hash != COALESCE(expected_previous, '')) as broken_at
    FROM chain;
END;
$$ LANGUAGE plpgsql;
```

**Benefits:**
- Cryptographic integrity
- Tamper detection
- No external dependencies
- Lightweight (hash calculation overhead minimal)

---

## Comparison Matrix

### Go Libraries

| Library | Type | Databases | Transparency | Undo Support | Complexity | Best For |
|---------|------|-----------|--------------|--------------|------------|----------|
| **gmhafiz/audit** | Application-level | PostgreSQL, MySQL | High (SQL interceptor) | No | Low | Transparent app-level auditing |
| **goskive/pg_audit_log** | Database-level | PostgreSQL | High (triggers) | Yes | Medium | PostgreSQL with undo capability |

---

### PostgreSQL Solutions

| Solution | Type | Performance Impact | Granularity | Setup Complexity | Schema Versioning | Best For |
|----------|------|-------------------|-------------|------------------|-------------------|----------|
| **pgAudit** | Extension | Low (logs to files) | Configurable (session/object/user) | Low | No | Compliance, DDL auditing |
| **pgAuditLogToFile** | Extension addon | Low | Same as pgAudit | Low | No | Separate audit log files |
| **supa_audit** | Extension | Medium (<3k writes/sec) | Table-level | Low | No | Table change tracking |
| **2ndQuadrant Audit Trigger** | Triggers | Medium-High | Row-level | Medium | No | Custom audit requirements |
| **temporal_tables** | Extension | Medium | Row-level | Medium | No | SQL standard temporal tables |
| **pgMemento** | Extension | High | Row + schema | High | Yes | Evolving schemas |

---

### Enterprise Systems

| System | Approach | Retention | Streaming | API | UI | Best For |
|--------|----------|-----------|-----------|-----|----|---------|
| **Supabase** | Multi-layered (auth + pgAudit + supa_audit) | Configurable | No | Yes (SQL) | Dashboard | SaaS apps with auth |
| **AWS CloudTrail** | Centralized service | Configurable (S3 lifecycle) | Yes (Kinesis) | Yes (REST) | Console + Athena | AWS infrastructure |
| **Stripe** | Canonical log lines | 30 days (request logs) | No | Yes (REST) | Dashboard | API-first SaaS |
| **GitHub** | REST API + streaming | 180 days (7 for Git) | Yes (webhooks) | Yes (REST) | Web UI | Git hosting, DevOps |
| **Auth0** | Log streaming | Varies by plan | Yes (webhooks) | Yes (FGA API) | Dashboard | Auth/IAM systems |
| **Hasura** | Event triggers | Database-dependent | Yes (webhooks) | Yes (GraphQL) | Console | GraphQL APIs |

---

### Event Sourcing Libraries

| Library | Backend Support | Maturity | Complexity | Best For |
|---------|----------------|----------|------------|----------|
| **looplab/eventhorizon** | MongoDB, Redis, AWS, Kafka, NATS | High (1.6k stars) | High | CQRS/ES applications |
| **modernice/goes** | Configurable | Medium | High | Distributed event-sourced apps |

**Note:** Event sourcing is overkill if only audit logging is needed. Use dedicated audit solutions unless event sourcing is required for business logic.

---

### CDC Solutions

| Solution | Approach | Complexity | Kafka Required | Best For |
|----------|----------|------------|----------------|----------|
| **Debezium (with Kafka)** | Logical decoding | High | Yes | High-throughput CDC, microservices |
| **Debezium Server** | Logical decoding | Medium | No | Lighter CDC without Kafka |
| **Outbox Pattern** | Application table + CDC | Medium | Optional | Transactional messaging |

---

## Summary & Decision Matrix

### Choose Application-Level Logging When:
- Need to capture user intent (not just database changes)
- Want minimal database performance impact
- Require flexible data model
- Async logging acceptable
- Application has full context (user, session, etc.)

**Recommended:** gmhafiz/audit or custom implementation with async queue

---

### Choose Database-Level Logging When:
- Need to audit DDL changes
- Require database-enforced auditing (no application bypass)
- Audit privileged operations (DBA activities)
- Compliance mandates database-level audit trail

**Recommended:** pgAudit + pgAuditLogToFile

---

### Choose Hybrid Approach When:
- Need both intent (application) and actual changes (database)
- High compliance requirements
- Want defense in depth

**Recommended:** Application-level + pgAudit

---

### Choose Event Sourcing When:
- Business logic requires event replay
- Need temporal queries ("what was state at time X?")
- Complex domain with state transitions
- Already using CQRS

**Recommended:** looplab/eventhorizon

**Don't choose:** If only audit logging is needed (overkill)

---

### Choose CDC When:
- Real-time data replication needed
- Cache invalidation from database changes
- Microservices data exchange (outbox pattern)
- Data warehouse loading

**Recommended:** Debezium (with Kafka for high throughput, without for simpler use cases)

---

## Implementation Recommendations for Zmanim Project

Based on the project architecture (Go API, PostgreSQL, Next.js, Clerk auth):

### Recommended Architecture

**1. Application-Level Audit Logging**
- Custom implementation with async queue
- Log business events (zmanim created, formulas updated, publisher settings changed)
- Capture Clerk user context
- Store in PostgreSQL `audit_logs` table (partitioned by month)

**2. Database-Level Auditing (pgAudit)**
- Enable for DDL operations (schema changes)
- Enable for privileged operations (admin actions)
- Log to separate file (pgAuditLogToFile)

**3. Clerk Integration**
- Leverage Clerk's built-in audit logs for authentication events
- Stream Clerk webhooks to audit_logs table for centralized view

### Data Model

```sql
CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ts timestamptz NOT NULL DEFAULT now(),

    -- Actor (from Clerk)
    clerk_user_id text,
    clerk_session_id text,
    actor_name text,
    actor_email text,

    -- Context
    publisher_id integer REFERENCES publishers(id),
    ip_address inet,
    user_agent text,
    request_id text,

    -- Event
    event_name text NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    status text NOT NULL DEFAULT 'success',

    -- Changes
    operation text,
    old_values jsonb,
    new_values jsonb,
    changed_fields text[],

    -- Metadata
    source text, -- 'web', 'api', 'system'
    description text,
    error_code text,
    error_message text

) PARTITION BY RANGE (ts);

-- Indexes
CREATE INDEX idx_audit_logs_ts ON audit_logs (ts DESC);
CREATE INDEX idx_audit_logs_clerk_user ON audit_logs (clerk_user_id) WHERE clerk_user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_publisher ON audit_logs (publisher_id) WHERE publisher_id IS NOT NULL;
CREATE INDEX idx_audit_logs_event ON audit_logs (event_name);
CREATE INDEX idx_audit_logs_resource ON audit_logs (resource_type, resource_id);
```

### Go Implementation

```go
// api/internal/audit/logger.go
package audit

import (
    "context"
    "database/sql"
    "time"
)

type Logger struct {
    queue chan Event
    db    *sql.DB
}

type Event struct {
    ClerkUserID   string
    ClerkSessionID string
    ActorName     string
    ActorEmail    string
    PublisherID   *int
    IPAddress     string
    UserAgent     string
    RequestID     string
    EventName     string
    Action        string
    ResourceType  string
    ResourceID    string
    Status        string
    Operation     string
    OldValues     map[string]interface{}
    NewValues     map[string]interface{}
    Source        string
    Description   string
}

func NewLogger(db *sql.DB) *Logger {
    l := &Logger{
        queue: make(chan Event, 1000),
        db:    db,
    }
    go l.worker()
    return l
}

func (l *Logger) Log(ctx context.Context, event Event) {
    select {
    case l.queue <- event:
    default:
        // Queue full - log synchronously as fallback
        l.logSync(ctx, event)
    }
}

func (l *Logger) worker() {
    batch := make([]Event, 0, 100)
    ticker := time.NewTicker(1 * time.Second)

    for {
        select {
        case event := <-l.queue:
            batch = append(batch, event)
            if len(batch) >= 100 {
                l.flushBatch(batch)
                batch = batch[:0]
            }
        case <-ticker.C:
            if len(batch) > 0 {
                l.flushBatch(batch)
                batch = batch[:0]
            }
        }
    }
}

func (l *Logger) flushBatch(events []Event) {
    // Use pgx.Batch for efficient bulk INSERT
    // Implementation details...
}
```

### Retention Policy

| Event Type | Retention | Storage Tier |
|------------|-----------|--------------|
| Auth events (Clerk) | 2 years | Hot (1 year) → Cold |
| Zmanim modifications | 1 year | Hot (90 days) → Cold |
| API access | 90 days | Hot (30 days) → Cold |
| System events | 30 days | Hot |

### Partitioning Strategy

- Monthly partitions
- Use pg_partman for automation
- Archive to S3 after 90 days
- Delete after retention period

---

## Additional Resources

### Documentation
- [PostgreSQL Auditing Extension (pgAudit)](https://www.pgaudit.org/)
- [Supabase Audit Documentation](https://supabase.com/docs/guides/auth/audit-logs)
- [AWS CloudTrail Best Practices](https://aws.amazon.com/blogs/mt/aws-cloudtrail-best-practices/)
- [GitHub Audit Log API](https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/using-the-audit-log-api-for-your-enterprise)

### Performance & Optimization
- [PostgreSQL Performance Tuning - Tiger Data](https://www.tigerdata.com/learn/postgres-performance-best-practices)
- [Audit logging with Postgres partitioning - Elephas](https://elephas.io/audit-logging-with-postgres-partitioning/)
- [Auto-archiving with pg_partman - Crunchy Data](https://www.crunchydata.com/blog/auto-archiving-and-data-retention-management-in-postgres-with-pg_partman)

### Compliance
- [Security log retention best practices - AuditBoard](https://auditboard.com/blog/security-log-retention-best-practices-guide)
- [Log Management for HIPAA, SOC 2, and GDPR - MEV](https://mev.com/blog/log-management-for-compliance-faqs-best-practices)

### Design Patterns
- [Guide to Building Audit Logs - Medium](https://medium.com/@tony.infisical/guide-to-building-audit-logs-for-application-software-b0083bb58604)
- [Complexities of Building Audit Logs - Harness IO](https://www.harness.io/blog/complexities-of-building-audit-logs)
- [Event Sourcing vs Audit Log - Kurrent.io](https://www.kurrent.io/blog/event-sourcing-audit)

---

**End of Research Document**
