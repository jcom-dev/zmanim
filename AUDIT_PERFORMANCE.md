# Audit Log Performance & Scale Strategy

## Executive Summary

This document outlines performance optimization strategies for a high-scale audit trail system based on industry best practices, benchmarks, and the existing zmanim platform infrastructure (Go + PostgreSQL + Redis).

**Key Recommendations:**
- Redis-backed async queue for write performance (non-blocking, 0ms latency impact)
- PostgreSQL monthly partitioning for efficient data lifecycle management
- Materialized views for dashboard aggregations (9000x faster queries)
- Three-tier retention: Hot (90 days) → Warm (1 year) → Cold/Archive (7+ years)
- COPY protocol for bulk inserts (35,000+ events/second)

---

## 1. Write Performance: Async Logging Architecture

### 1.1 Current Infrastructure Analysis

The zmanim platform already implements an excellent async logging pattern in `/home/daniel/repos/zmanim/api/internal/services/calculation_log_service.go`:

```go
type CalculationLogService struct {
    db            *pgxpool.Pool
    buffer        chan CalculationLogEntry
    batchSize     int           // 100 records
    flushInterval time.Duration // 1 second
    stopChan      chan struct{}
    wg            sync.WaitGroup
}
```

**Key Features:**
- Buffered channel (10,000 entries) for zero-latency writes
- Background worker with batch processing
- PostgreSQL COPY protocol for maximum throughput
- Graceful shutdown with buffer draining

### 1.2 Recommended Architecture for Audit Events

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Request Flow                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Handler (mutation: POST/PUT/DELETE)                             │
│  1. Fetch "before" state from database                           │
│  2. Execute mutation                                             │
│  3. auditService.LogEvent() ← non-blocking channel write         │
│  4. Respond to client (0ms audit overhead)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Redis Queue (Optional High-Availability Layer)                  │
│  - Use Redis Streams for durability                              │
│  - Consumer groups for multiple workers                          │
│  - DLQ for failed events                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Buffered Channel (In-Memory Queue)                              │
│  - 10,000 entry buffer                                           │
│  - Drops entries if full (don't block API)                       │
│  - Non-blocking select statement                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Background Worker (Batch Processor)                             │
│  - Batches 100 events OR 1 second interval                       │
│  - Uses PostgreSQL COPY protocol                                 │
│  - 35,000+ events/second throughput                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL (Partitioned Audit Table)                            │
│  - Monthly range partitions                                      │
│  - Automatic partition pruning                                   │
│  - Indexes per partition                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Redis vs In-Memory Queue Comparison

| Aspect | Redis Queue (Asynq) | In-Memory Channel |
|--------|---------------------|-------------------|
| **Throughput** | 21,000 jobs/s (gocraft/work) | 35,000+ events/s (COPY) |
| **Durability** | Persisted to Redis | Lost on restart |
| **Complexity** | Higher (Redis dependency) | Lower (native Go) |
| **Failure Handling** | DLQ, retry, exponential backoff | Drop on buffer full |
| **Best For** | Critical financial logs | Analytics/observability |
| **Monitoring** | Prometheus, Web UI (asynqmon) | Custom metrics |

**Recommendation for Audit Logs:**

Use **in-memory buffered channel** (like existing `calculation_log_service.go`) for audit events because:

1. **Zero External Dependencies**: No Redis failure risk
2. **Simpler Operations**: Fewer moving parts
3. **Higher Throughput**: Direct to PostgreSQL COPY
4. **Acceptable Trade-off**: Audit logs are important but not financial transactions
5. **Existing Pattern**: Proven in production for calculation logs

For **critical compliance events** (e.g., payment mutations, data exports), add a Redis-backed DLQ as a fallback.

### 1.4 Failure Handling Strategy

```go
// Pattern 1: Non-blocking write (primary)
func (s *AuditService) Log(entry AuditEvent) {
    select {
    case s.buffer <- entry:
        // Successfully queued
    default:
        // Buffer full - log warning, increment dropped_events metric
        slog.Warn("audit buffer full", "event_type", entry.Action)
        s.metrics.DroppedEvents.Inc()
    }
}

// Pattern 2: Redis fallback for critical events
func (s *AuditService) LogCritical(entry AuditEvent) {
    // Try in-memory first
    select {
    case s.buffer <- entry:
        return
    default:
        // Fallback to Redis for durability
        if err := s.redisQueue.Enqueue(entry); err != nil {
            slog.Error("failed to enqueue critical event", "error", err)
            // Final fallback: write directly to DB (synchronous)
            s.writeDirectToDB(entry)
        }
    }
}

// Pattern 3: Batch flush with retry
func (s *AuditService) flush(batch []AuditEvent) {
    maxRetries := 3
    for attempt := 0; attempt < maxRetries; attempt++ {
        err := s.copyToPostgres(batch)
        if err == nil {
            return
        }
        slog.Error("batch flush failed", "attempt", attempt, "error", err)
        time.Sleep(time.Duration(attempt) * time.Second) // Exponential backoff
    }
    // Final fallback: write to DLQ
    s.writeToDLQ(batch)
}
```

### 1.5 Performance Benchmarks: Expected Write Volume

Based on [PostgreSQL COPY benchmarks](https://www.tigerdata.com/learn/testing-postgres-ingest-insert-vs-batch-insert-vs-copy):

| Method | Throughput | Use Case |
|--------|-----------|----------|
| Single INSERT | 100-500 ops/s | N/A (too slow) |
| Batch INSERT | 7,000 ops/s | Small batches |
| COPY Protocol | 35,000+ ops/s | Bulk logging |

**Zmanim Platform Estimates:**

Assuming 100 publishers × 10 mutations/day = 1,000 events/day:
- **Low Traffic**: 1,000 events/day ≈ 0.01 events/sec
- **Medium Traffic**: 10,000 events/day ≈ 0.12 events/sec
- **High Traffic**: 100,000 events/day ≈ 1.15 events/sec
- **Spike Handling**: 1,000 events/second (35x headroom with COPY)

**Conclusion:** COPY protocol provides 30,000x headroom for current scale.

---

## 2. Read Performance: Query Optimization

### 2.1 Partitioning Strategy

Based on [PostgreSQL partitioning best practices](https://elephas.io/audit-logging-with-postgres-partitioning/), implement **monthly range partitioning**:

```sql
-- Parent table (partitioned)
CREATE TABLE audit_events (
    id BIGSERIAL,
    event_id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id TEXT NOT NULL,
    actor_type TEXT NOT NULL, -- 'user', 'admin', 'system', 'api_key'
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'publish'
    resource_type TEXT NOT NULL, -- 'publisher_zman', 'algorithm', 'coverage'
    resource_id TEXT NOT NULL,
    publisher_id INT REFERENCES publishers(id),
    before_state JSONB,
    after_state JSONB,
    metadata JSONB, -- ip_address, user_agent, request_id
    status TEXT NOT NULL DEFAULT 'success', -- 'success', 'failure'
    error_message TEXT,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Monthly partitions (auto-created by pg_partman)
CREATE TABLE audit_events_2025_01 PARTITION OF audit_events
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE audit_events_2025_02 PARTITION OF audit_events
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Indexes per partition (automatically inherited)
CREATE INDEX idx_audit_actor ON audit_events (actor_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_events (resource_type, resource_id, created_at DESC);
CREATE INDEX idx_audit_publisher ON audit_events (publisher_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_events (action, created_at DESC);
```

**Why Monthly Partitions?**
- **Fast Cleanup**: Drop entire partition instead of DELETE query ([4x faster than hourly](https://nestcode.co/en/blog/using-table-partition-technique-to-improve-maintainability-of-audit-log))
- **Partition Pruning**: Queries with date filters only scan relevant partitions
- **Manageable Size**: Balance between too many partitions (planner overhead) and too few (large tables)
- **Maintenance**: VACUUM/ANALYZE per partition without locking entire table

**Automation with pg_partman:**

```sql
-- Install extension
CREATE EXTENSION pg_partman;

-- Configure automatic partition creation (3 months ahead)
SELECT partman.create_parent(
    'public.audit_events',
    'created_at',
    'native',
    'monthly',
    p_premake := 3
);

-- Schedule partition maintenance (run daily)
-- Uses pg_cron or external scheduler
SELECT partman.run_maintenance('public.audit_events');
```

### 2.2 Materialized Views for Aggregations

Based on [recent 2025 case studies](https://sngeth.com/rails/performance/postgresql/2025/10/03/materialized-views-performance-case-study/), materialized views provide **9000x performance improvement** for dashboard queries.

**Example: Publisher Activity Dashboard**

```sql
-- Materialized view for daily activity counts
CREATE MATERIALIZED VIEW audit_publisher_daily_stats AS
SELECT
    publisher_id,
    DATE(created_at) AS activity_date,
    action,
    resource_type,
    COUNT(*) AS event_count,
    COUNT(*) FILTER (WHERE status = 'failure') AS failure_count,
    AVG(EXTRACT(EPOCH FROM (metadata->>'response_time_ms')::INT)) AS avg_response_ms
FROM audit_events
WHERE created_at >= NOW() - INTERVAL '90 days' -- Hot data only
GROUP BY publisher_id, DATE(created_at), action, resource_type;

-- Index for fast dashboard queries
CREATE INDEX idx_mv_publisher_stats ON audit_publisher_daily_stats (publisher_id, activity_date DESC);

-- Refresh every 15 minutes (pg_cron)
SELECT cron.schedule('refresh-audit-stats', '*/15 * * * *',
    'REFRESH MATERIALIZED VIEW CONCURRENTLY audit_publisher_daily_stats');
```

**Performance Comparison:**

| Query Type | Without MV | With MV (15min refresh) | Speedup |
|-----------|-----------|-------------------------|---------|
| Dashboard stats | 3-7 seconds | 50-100ms | 30-70x |
| Weekly activity chart | 5+ seconds | <100ms | 50x+ |
| Top actions | 2+ seconds | <50ms | 40x+ |

### 2.3 Caching Strategy

Use existing Redis infrastructure for hot queries:

```go
// Cache publisher's recent activity (15 min TTL)
func (s *AuditService) GetPublisherRecentActivity(ctx context.Context, publisherID int) ([]AuditEvent, error) {
    cacheKey := fmt.Sprintf("audit:recent:%d", publisherID)

    // Try cache first
    cached, err := s.cache.Get(ctx, cacheKey)
    if err == nil && cached != nil {
        return unmarshalEvents(cached), nil
    }

    // Query database (last 24 hours, limited to 100 events)
    events, err := s.db.GetRecentAuditEvents(ctx, publisherID, 24*time.Hour, 100)
    if err != nil {
        return nil, err
    }

    // Cache result (15 min TTL)
    s.cache.Set(ctx, cacheKey, events, 15*time.Minute)
    return events, nil
}
```

**Cache Invalidation:**
- Invalidate on new audit event for publisher
- Use Redis pub/sub to notify web UI of new events (real-time updates)

### 2.4 Query Performance Targets

Based on [PostgreSQL partitioning performance](https://stormatics.tech/blogs/improving-postgresql-performance-with-partitioning):

| Query Type | Target | Implementation |
|-----------|--------|----------------|
| Recent events (30 days) | < 100ms | Single partition + index |
| Filtered search (90 days) | < 500ms | 3 partitions + partition pruning |
| Full-text search | < 1s | GIN index on metadata JSONB |
| Export (10k events) | < 5s | Streaming query with COPY |
| Dashboard stats | < 100ms | Materialized view |

---

## 3. Data Retention & Archival

### 3.1 Three-Tier Retention Strategy

Based on [2025 archival best practices](https://dataegret.com/2025/05/data-archiving-and-retention-in-postgresql-best-practices-for-large-datasets/):

```
┌─────────────────────────────────────────────────────────────────┐
│  HOT Storage (PostgreSQL Primary)                                │
│  - Age: 0-90 days                                                │
│  - Purpose: Active queries, real-time dashboards                 │
│  - Storage: SSD (fast)                                           │
│  - Partitions: 3 monthly tables                                  │
│  - Access: Sub-100ms queries                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                    (Monthly pg_cron job)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  WARM Storage (PostgreSQL Tablespace on HDD/NFS)                 │
│  - Age: 91 days - 1 year                                         │
│  - Purpose: Compliance reports, investigations                   │
│  - Storage: HDD or networked storage (cheaper)                   │
│  - Partitions: Detached from main table                          │
│  - Access: 500ms-2s queries (acceptable for historical)          │
└─────────────────────────────────────────────────────────────────┘
                              │
                    (Quarterly archive job)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  COLD Storage (AWS S3 / Glacier)                                 │
│  - Age: 1-7 years                                                │
│  - Purpose: Legal compliance (SOX, GDPR)                         │
│  - Storage: S3 → Glacier Deep Archive (95% cost reduction)       │
│  - Format: Parquet or compressed JSONL                           │
│  - Access: Minutes to hours (rare access)                        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Implementation: Hot → Warm Migration

```sql
-- Monthly job: Move 90-day-old partition to warm storage
CREATE OR REPLACE FUNCTION archive_old_audit_partition()
RETURNS void AS $$
DECLARE
    old_partition TEXT;
    archive_tablespace TEXT := 'warm_storage'; -- HDD/NFS tablespace
BEGIN
    -- Get partition name for 90 days ago
    old_partition := 'audit_events_' || TO_CHAR(NOW() - INTERVAL '90 days', 'YYYY_MM');

    -- Detach partition from parent table
    EXECUTE format('ALTER TABLE audit_events DETACH PARTITION %I', old_partition);

    -- Move to warm storage tablespace
    EXECUTE format('ALTER TABLE %I SET TABLESPACE %I', old_partition, archive_tablespace);

    -- Keep indexes for searchability
    EXECUTE format('REINDEX TABLE %I', old_partition);

    RAISE NOTICE 'Archived partition % to warm storage', old_partition;
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly (pg_cron)
SELECT cron.schedule('archive-audit-logs', '0 2 1 * *', -- 2 AM on 1st of month
    'SELECT archive_old_audit_partition()');
```

### 3.3 Implementation: Warm → Cold (S3 Archive)

Based on [AWS RDS archival patterns](https://aws.amazon.com/blogs/database/archive-and-purge-data-for-amazon-rds-for-postgresql-and-amazon-aurora-with-postgresql-compatibility-using-pg_partman-and-amazon-s3/):

```sql
-- Quarterly job: Export 1-year-old data to S3
CREATE OR REPLACE FUNCTION export_to_s3_and_drop(partition_name TEXT)
RETURNS void AS $$
BEGIN
    -- Export partition to S3 using aws_s3 extension (RDS) or COPY to file
    EXECUTE format(
        'COPY %I TO PROGRAM ''aws s3 cp - s3://zmanim-audit-archive/%I.parquet'' WITH (FORMAT parquet)',
        partition_name, partition_name
    );

    -- Verify export success (check S3 file exists)
    -- ... add verification logic ...

    -- Drop partition to free disk space
    EXECUTE format('DROP TABLE %I', partition_name);

    RAISE NOTICE 'Exported and dropped partition %', partition_name;
END;
$$ LANGUAGE plpgsql;
```

**S3 Lifecycle Policy:**

```json
{
  "Rules": [
    {
      "Id": "AuditLogGlacierTransition",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        },
        {
          "Days": 365,
          "StorageClass": "DEEP_ARCHIVE"
        }
      ],
      "Expiration": {
        "Days": 2555
      }
    }
  ]
}
```

**Storage Cost Comparison ([AWS S3 pricing](https://aws.amazon.com/s3/pricing/)):**

| Storage Tier | Cost per GB/month | 1TB/month | Use Case |
|--------------|-------------------|-----------|----------|
| PostgreSQL SSD | ~$0.20 | $200 | Hot (0-90 days) |
| PostgreSQL HDD | ~$0.10 | $100 | Warm (90 days - 1 year) |
| S3 Standard | $0.023 | $23 | Initial archive |
| S3 Glacier | $0.004 | $4 | 1-3 years |
| Glacier Deep Archive | $0.00099 | $0.99 | 3-7 years |

**Cost Reduction:** 99.5% savings (PostgreSQL → Glacier Deep Archive)

### 3.4 Retention Policy Summary

Based on [compliance requirements](https://last9.io/blog/log-retention/):

| Compliance Standard | Minimum Retention | Our Policy |
|---------------------|-------------------|------------|
| SOX (Financial) | 7 years | 7 years (cold) |
| GDPR (EU) | User-deletable | Support right to deletion |
| HIPAA (Healthcare) | 6 years | N/A (not healthcare) |
| General SaaS | 90 days - 1 year | 90 days hot + 1 year warm |

**Automated Cleanup Schedule:**

```sql
-- pg_cron schedule
SELECT cron.schedule('hot-to-warm', '0 2 1 * *', 'SELECT archive_old_audit_partition()');      -- Monthly
SELECT cron.schedule('warm-to-cold', '0 3 1 */3 *', 'SELECT export_to_s3_and_drop(...)');     -- Quarterly
SELECT cron.schedule('delete-expired', '0 4 1 1 *', 'SELECT delete_expired_s3_archives()');   -- Yearly
```

---

## 4. Disk Space Projections

### 4.1 Event Size Estimation

```
Typical Audit Event:
- Metadata: 500 bytes (actor, action, resource, timestamp)
- Before state (JSONB): 2KB (publisher_zman with formula)
- After state (JSONB): 2KB
- Total per event: ~4.5KB
```

### 4.2 Volume Projections

| Scenario | Events/Day | Storage/Day | Storage/Month | Storage/Year |
|----------|-----------|-------------|---------------|--------------|
| **Low** (100 publishers × 10 mutations) | 1,000 | 4.5 MB | 135 MB | 1.6 GB |
| **Medium** (500 publishers × 20 mutations) | 10,000 | 45 MB | 1.35 GB | 16 GB |
| **High** (2,000 publishers × 50 mutations) | 100,000 | 450 MB | 13.5 GB | 162 GB |
| **Very High** (10,000 publishers × 100 mutations) | 1,000,000 | 4.5 GB | 135 GB | 1.62 TB |

### 4.3 Storage Requirements by Tier

**Medium Traffic Scenario (10K events/day):**

```
Year 1:
- Hot (90 days): 1.35 GB × 3 = 4 GB (PostgreSQL SSD)
- Warm (9 months): 1.35 GB × 9 = 12 GB (PostgreSQL HDD)
- Cold (0 months): 0 GB

Year 2:
- Hot: 4 GB (PostgreSQL SSD)
- Warm: 12 GB (PostgreSQL HDD)
- Cold: 16 GB → S3 Glacier ($0.06/month)

Year 7:
- Hot: 4 GB (PostgreSQL SSD) = $0.80/month
- Warm: 12 GB (PostgreSQL HDD) = $1.20/month
- Cold: 96 GB → Glacier Deep Archive = $0.09/month
- Total: $2.09/month for 7 years of audit logs
```

**High Traffic Scenario (100K events/day):**

```
Year 7:
- Hot: 40 GB (PostgreSQL SSD) = $8/month
- Warm: 120 GB (PostgreSQL HDD) = $12/month
- Cold: 960 GB → Glacier Deep Archive = $0.95/month
- Total: $20.95/month for 7 years of audit logs
```

**Conclusion:** Even at high scale, audit log storage is negligible (<$25/month).

---

## 5. Queue Design: Redis vs PostgreSQL NOTIFY

### 5.1 Comparison Matrix

| Aspect | Redis Streams (Asynq) | PostgreSQL LISTEN/NOTIFY | In-Memory Channel |
|--------|----------------------|--------------------------|-------------------|
| **Throughput** | 21,000 jobs/s | Limited (global lock issue) | 35,000+ events/s |
| **Durability** | Persisted | Not persisted | Not persisted |
| **Scalability** | Excellent | Poor (global lock) | Excellent |
| **Complexity** | Medium | Low | Very Low |
| **Monitoring** | Excellent (Prometheus, UI) | Basic | Custom metrics |
| **Best For** | Critical background jobs | Low-volume events | High-throughput logs |

### 5.2 PostgreSQL LISTEN/NOTIFY Issues

Based on [2025 production incidents](https://www.recall.ai/blog/postgres-listen-notify-does-not-scale):

> "Between March 19-22, 2025, our production database experienced three periods of downtime related to LISTEN/NOTIFY. Transactions with pending notifications take out a **global lock** against the entire PostgreSQL instance to ensure queue entries appear in commit order."

**Critical Issue:** Under high write loads, LISTEN/NOTIFY creates contention and can degrade entire database performance.

**Recommendation:** Avoid LISTEN/NOTIFY for audit logging. Use in-memory channels for speed or Redis for durability.

### 5.3 Recommended Architecture: Hybrid Approach

```
┌─────────────────────────────────────────────────────────────────┐
│  Primary Path: In-Memory Buffered Channel                        │
│  - 99.9% of events                                               │
│  - Zero latency, 35K+ events/sec                                 │
│  - Acceptable data loss (restart clears buffer)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    [Background Worker]
                              │
                              ▼
                    [PostgreSQL COPY Protocol]

┌─────────────────────────────────────────────────────────────────┐
│  Fallback Path: Redis Streams (Critical Events Only)             │
│  - 0.1% of events (payment changes, data exports)                │
│  - Durable, retry with exponential backoff                       │
│  - Dead Letter Queue for failures                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    [Redis Consumer Worker]
                              │
                              ▼
                    [PostgreSQL Direct INSERT]
```

**Implementation:**

```go
type AuditService struct {
    // Primary path
    buffer chan AuditEvent
    batchSize int
    db *pgxpool.Pool

    // Fallback path (optional)
    redisQueue *asynq.Client
    criticalEventTypes map[string]bool
}

func (s *AuditService) Log(event AuditEvent) {
    // Critical events use Redis for durability
    if s.criticalEventTypes[event.Action] {
        s.LogCritical(event)
        return
    }

    // Standard events use in-memory buffer
    select {
    case s.buffer <- event:
        // Success
    default:
        // Buffer full - drop event, log warning
        slog.Warn("audit buffer full", "event_id", event.ID)
        s.metrics.DroppedEvents.Inc()
    }
}

func (s *AuditService) LogCritical(event AuditEvent) {
    task := asynq.NewTask("audit:critical", event.ToJSON())
    _, err := s.redisQueue.Enqueue(task,
        asynq.MaxRetry(5),
        asynq.Timeout(30*time.Second),
    )
    if err != nil {
        // Final fallback: synchronous DB write
        s.db.WriteAuditEvent(context.Background(), event)
    }
}
```

---

## 6. Scalability Limits & Mitigation

### 6.1 Bottleneck Analysis

| Component | Current Limit | Mitigation Strategy |
|-----------|--------------|---------------------|
| **In-Memory Buffer** | 10,000 events | Increase buffer size to 100,000 |
| **COPY Protocol** | 35,000 events/s | Horizontal scaling (multiple workers) |
| **Partition Count** | 1,000 partitions | Archive old partitions to S3 |
| **Query Performance** | 10M+ events | Materialized views, aggressive archival |
| **Disk Space** | TB-scale | S3 cold storage (99% cost reduction) |

### 6.2 Horizontal Scaling Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│  API Servers (Multiple Instances)                                │
│  Each with own in-memory buffer + worker                         │
└─────────────────────────────────────────────────────────────────┘
        │               │               │
        ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL (Primary)                                             │
│  - Handles 100K+ inserts/sec with COPY                           │
│  - Partitioned by month                                          │
│  - Read replicas for query scaling                               │
└─────────────────────────────────────────────────────────────────┘
```

**Key Insight:** Each API server independently writes to PostgreSQL. No coordination needed.

### 6.3 Performance Degradation Scenarios

| Scenario | Impact | Mitigation |
|----------|--------|------------|
| **Buffer Overflow** | Events dropped | Increase buffer size, add Redis fallback |
| **Partition Scan** | Slow queries | Use partition pruning (WHERE created_at) |
| **Large JSONB** | Disk bloat | TOAST compression, archive old data |
| **Many Indexes** | Write slowdown | Remove unused indexes, partition-local indexes |
| **Hot Partition** | Lock contention | Use UNLOGGED tables for very hot data |

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Create partitioned `audit_events` table with monthly partitions
- [ ] Implement `AuditService` with buffered channel + COPY protocol
- [ ] Add audit logging to 5 critical handlers (as POC)
- [ ] Set up pg_partman for automatic partition creation

### Phase 2: Query Optimization (Week 2)
- [ ] Create indexes for common query patterns
- [ ] Implement materialized views for dashboards
- [ ] Add Redis caching for recent events
- [ ] Performance testing (100K events, measure query times)

### Phase 3: Retention & Archival (Week 3)
- [ ] Implement hot → warm migration (pg_cron job)
- [ ] Set up S3 bucket with lifecycle policies
- [ ] Implement warm → cold export job
- [ ] Test full retention cycle (mock 90-day-old data)

### Phase 4: Monitoring & Reliability (Week 4)
- [ ] Add Prometheus metrics (events/sec, buffer depth, flush duration)
- [ ] Implement Redis fallback for critical events
- [ ] Create admin dashboard for audit log health
- [ ] Load testing (simulate 10K events/sec spike)

---

## 8. Performance Benchmarks & Targets

### 8.1 Write Performance Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| API Latency Impact | 0ms (non-blocking) | Measure before/after audit logging |
| Buffer Write | < 1µs | Go benchmark test |
| Batch Flush | < 100ms for 100 events | Log flush duration |
| Throughput | 10,000+ events/sec | Load test with k6 |
| Buffer Overflow Rate | < 0.01% | Monitor dropped_events metric |

### 8.2 Read Performance Targets

| Query Type | Target | Measurement Method |
|-----------|--------|-------------------|
| Recent events (30 days) | < 100ms | Explain Analyze on production-like data |
| Filtered search (90 days) | < 500ms | Benchmark with 1M events |
| Full-text search | < 1s | GIN index performance test |
| Export 10K events | < 5s | Streaming COPY benchmark |
| Dashboard stats | < 100ms | Materialized view query time |

### 8.3 Storage Targets

| Metric | Target | Monitoring |
|--------|--------|------------|
| Hot storage | < 50 GB | PostgreSQL disk usage |
| Warm storage | < 200 GB | Tablespace monitoring |
| Cold storage cost | < $10/month | AWS Cost Explorer |
| Partition count | < 100 active | Count partitions query |

---

## 9. Sources & References

### PostgreSQL Partitioning
- [Audit logging with Postgres partitioning – Elephas](https://elephas.io/audit-logging-with-postgres-partitioning/)
- [Using Table Partition Technique to Improve Maintainability of Audit Log](https://nestcode.co/en/blog/using-table-partition-technique-to-improve-maintainability-of-audit-log)
- [Improving PostgreSQL Performance with Partitioning | Stormatics](https://stormatics.tech/blogs/improving-postgresql-performance-with-partitioning)
- [PostgreSQL: Documentation: Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)

### Performance Benchmarks
- [Testing Postgres Ingest: INSERT vs. Batch INSERT vs. COPY | Tiger Data](https://www.tigerdata.com/learn/testing-postgres-ingest-insert-vs-batch-insert-vs-copy)
- [Optimizing bulk loads in Postgres with COPY](https://pganalyze.com/blog/5mins-postgres-optimizing-bulk-loads-copy-vs-insert)
- [Materialized views made my dashboard 9000x faster](https://sngeth.com/rails/performance/postgresql/2025/10/03/materialized-views-performance-case-study/)

### Async Queue Patterns
- [Supercharging Go with Asynq: Scalable Background Jobs](https://dev.to/lovestaco/supercharging-go-with-asynq-scalable-background-jobs-made-easy-32do)
- [Task Queues in Go: Asynq vs Machinery vs Work](https://medium.com/@geisonfgfg/task-queues-in-go-asynq-vs-machinery-vs-work-powering-background-jobs-in-high-throughput-systems-45066a207aa7)
- [Implementing Dead Letter Queues in Golang and Redis](https://dev.to/faranmustafa/implementing-a-reliable-event-driven-system-with-dead-letter-queues-in-golang-and-redis-43pb)

### Data Retention & Archival
- [Data archiving and retention in PostgreSQL - Data Egret](https://dataegret.com/2025/05/data-archiving-and-retention-in-postgresql-best-practices-for-large-datasets/)
- [Archive and Purge Data for Amazon RDS with pg_partman and S3](https://aws.amazon.com/blogs/database/archive-and-purge-data-for-amazon-rds-for-postgresql-and-amazon-aurora-with-postgresql-compatibility-using-pg_partman-and-amazon-s3/)
- [Log Retention Policies Explained](https://www.groundcover.com/logging/log-retention-policies)

### PostgreSQL LISTEN/NOTIFY Limitations
- [Postgres LISTEN/NOTIFY does not scale - Recall.ai](https://www.recall.ai/blog/postgres-listen-notify-does-not-scale)
- [Go and Postgres Listen/Notify](https://brojonat.com/posts/go-postgres-listen-notify/)

---

## 10. Conclusion

The zmanim platform already has an excellent foundation for high-performance audit logging through the existing `calculation_log_service.go` pattern. By applying this same architecture to audit events and combining it with PostgreSQL partitioning, materialized views, and three-tier retention, the system can:

1. **Write Performance**: Handle 10,000+ events/second with 0ms API latency impact
2. **Read Performance**: Deliver sub-100ms dashboard queries via materialized views
3. **Storage Efficiency**: Reduce costs by 99% through S3 Glacier archival
4. **Scalability**: Scale horizontally across API servers without coordination
5. **Reliability**: Use Redis fallback for critical events requiring durability

**Key Trade-offs:**
- **Simplicity over Durability**: In-memory buffer is simpler than Redis but loses events on restart (acceptable for audit analytics)
- **Cost over Speed**: Archive to S3 Glacier for 99% savings, accept minutes-to-hours retrieval time
- **Partition Overhead**: Monthly partitions add planner overhead but enable instant cleanup

**Next Steps:**
1. Review this document with team
2. Approve architecture and trade-offs
3. Begin Phase 1 implementation (partitioned table + audit service)
4. Performance test with production-like data volumes
5. Iterate based on real-world metrics
