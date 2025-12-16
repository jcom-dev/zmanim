# Story 9.13: External API Caching Implementation

**Epic:** Epic 9 - API Restructuring & Endpoint Cleanup
**Status:** Ready for Dev
**Priority:** Medium (Performance optimization)
**Story Points:** 5

---

## User Story

**As a** system administrator,
**I want** external API calculation results to be cached in Redis,
**So that** repeated requests for the same zmanim return instantly without recalculation.

---

## Context

The external API endpoint calculates zmanim for third-party integrations. Currently, every request triggers a full calculation even for identical parameters. The response includes `Cached: false` as a TODO placeholder.

**Source TODOs:**
- `api/internal/handlers/external_api.go:370` - "TODO: implement caching"
- `api/internal/handlers/external_api.go:384` - "TODO: implement caching"

**Current State:**
```go
Cached: false, // TODO: implement caching
```

**Target State:**
- Redis-based caching for external API results
- Configurable TTL per endpoint/query type
- Cache hit/miss metrics for monitoring
- Cache invalidation when publisher zmanim change

---

## Acceptance Criteria

### AC1: Cache Key Generation
**Given** an external API request
**When** generating a cache key
**Then** the key includes all relevant parameters:
- Publisher ID
- Location (lat/lon or city ID)
- Date range
- Requested zmanim

### AC2: Cache Storage
**Given** a successful calculation
**When** the response is generated
**Then** the result is stored in Redis with appropriate TTL

### AC3: Cache Retrieval
**Given** a request for previously calculated data
**When** the cache is checked
**Then** cached data is returned with `Cached: true`
**And** response time is significantly faster

### AC4: Cache TTL Configuration
**Given** the caching system
**When** configuring TTL
**Then** different TTLs can be set for:
- Single day queries (24 hours)
- Multi-day ranges (12 hours)
- Bulk requests (6 hours)

### AC5: Cache Invalidation
**Given** a publisher updates their zmanim
**When** the update is saved
**Then** relevant cache entries are invalidated

### AC6: Cache Metrics
**Given** the caching system
**When** requests are processed
**Then** metrics are available for:
- Cache hit rate
- Cache miss rate
- Average response time (cached vs uncached)

---

## Technical Notes

### Cache Key Format

```
external_api:{publisher_id}:{city_id}:{date_start}:{date_end}:{zmanim_hash}
```

**Example:**
```
external_api:550e8400-e29b-41d4-a716-446655440000:12345:2024-01-01:2024-01-07:abc123
```

### Redis Configuration

```go
// Cache configuration
type ExternalAPICacheConfig struct {
    SingleDayTTL   time.Duration // 24h for single day
    MultiDayTTL    time.Duration // 12h for date ranges
    BulkRequestTTL time.Duration // 6h for bulk
    MaxCacheSize   int64         // Max bytes per entry
}

var DefaultCacheConfig = ExternalAPICacheConfig{
    SingleDayTTL:   24 * time.Hour,
    MultiDayTTL:    12 * time.Hour,
    BulkRequestTTL: 6 * time.Hour,
    MaxCacheSize:   1024 * 1024, // 1MB
}
```

### Implementation

**Cache wrapper: `api/internal/cache/external_api.go`**
```go
package cache

import (
    "context"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "fmt"
    "time"

    "github.com/redis/go-redis/v9"
)

type ExternalAPICache struct {
    redis  *redis.Client
    config ExternalAPICacheConfig
}

func NewExternalAPICache(redis *redis.Client, config ExternalAPICacheConfig) *ExternalAPICache {
    return &ExternalAPICache{redis: redis, config: config}
}

// GenerateKey creates a cache key for the request
func (c *ExternalAPICache) GenerateKey(publisherID, cityID string, startDate, endDate time.Time, zmanim []string) string {
    // Hash zmanim list for consistent key
    zmanimHash := hashZmanim(zmanim)
    return fmt.Sprintf("external_api:%s:%s:%s:%s:%s",
        publisherID,
        cityID,
        startDate.Format("2006-01-02"),
        endDate.Format("2006-01-02"),
        zmanimHash,
    )
}

func hashZmanim(zmanim []string) string {
    h := sha256.New()
    for _, z := range zmanim {
        h.Write([]byte(z))
    }
    return hex.EncodeToString(h.Sum(nil))[:12]
}

// Get retrieves cached response
func (c *ExternalAPICache) Get(ctx context.Context, key string) ([]byte, bool, error) {
    data, err := c.redis.Get(ctx, key).Bytes()
    if err == redis.Nil {
        return nil, false, nil // Cache miss
    }
    if err != nil {
        return nil, false, err
    }
    return data, true, nil // Cache hit
}

// Set stores response in cache
func (c *ExternalAPICache) Set(ctx context.Context, key string, data []byte, ttl time.Duration) error {
    if int64(len(data)) > c.config.MaxCacheSize {
        return fmt.Errorf("response too large to cache: %d bytes", len(data))
    }
    return c.redis.Set(ctx, key, data, ttl).Err()
}

// Invalidate removes cached entries for a publisher
func (c *ExternalAPICache) Invalidate(ctx context.Context, publisherID string) error {
    pattern := fmt.Sprintf("external_api:%s:*", publisherID)
    iter := c.redis.Scan(ctx, 0, pattern, 100).Iterator()
    for iter.Next(ctx) {
        c.redis.Del(ctx, iter.Val())
    }
    return iter.Err()
}

// GetTTL determines TTL based on request type
func (c *ExternalAPICache) GetTTL(startDate, endDate time.Time) time.Duration {
    days := int(endDate.Sub(startDate).Hours() / 24)
    switch {
    case days <= 1:
        return c.config.SingleDayTTL
    case days <= 7:
        return c.config.MultiDayTTL
    default:
        return c.config.BulkRequestTTL
    }
}
```

### Handler Integration

**Update external_api.go:**
```go
func (h *Handlers) GetExternalZmanim(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Parse request
    req, err := parseExternalRequest(r)
    if err != nil {
        RespondError(w, r, http.StatusBadRequest, err.Error())
        return
    }

    // 2. Generate cache key
    cacheKey := h.externalCache.GenerateKey(
        req.PublisherID,
        req.CityID,
        req.StartDate,
        req.EndDate,
        req.Zmanim,
    )

    // 3. Check cache
    if cached, hit, err := h.externalCache.Get(ctx, cacheKey); err == nil && hit {
        // Cache hit - return cached response
        w.Header().Set("X-Cache", "HIT")
        w.Header().Set("Content-Type", "application/json")
        w.Write(cached)
        h.recordCacheMetrics("hit", time.Since(startTime))
        return
    }

    // 4. Cache miss - calculate
    startTime := time.Now()
    result, err := h.calculateZmanim(ctx, req)
    if err != nil {
        RespondError(w, r, http.StatusInternalServerError, err.Error())
        return
    }
    calculationTime := time.Since(startTime).Milliseconds()

    // 5. Build response with Cached: false (first calculation)
    response := ExternalAPIResponse{
        // ... existing fields
        Cached:            false,
        CalculationTimeMS: calculationTime,
    }

    // 6. Serialize response
    responseJSON, err := json.Marshal(response)
    if err != nil {
        RespondError(w, r, http.StatusInternalServerError, "failed to serialize response")
        return
    }

    // 7. Store in cache
    ttl := h.externalCache.GetTTL(req.StartDate, req.EndDate)
    if err := h.externalCache.Set(ctx, cacheKey, responseJSON, ttl); err != nil {
        slog.Warn("failed to cache response", "error", err, "key", cacheKey)
    }

    // 8. Return response
    w.Header().Set("X-Cache", "MISS")
    w.Header().Set("Content-Type", "application/json")
    w.Write(responseJSON)
    h.recordCacheMetrics("miss", time.Since(startTime))
}
```

### Cache Invalidation on Publisher Update

**Add to publisher_zmanim.go:**
```go
func (h *Handlers) UpdatePublisherZman(w http.ResponseWriter, r *http.Request) {
    // ... existing update logic ...

    // Invalidate cache for this publisher
    if err := h.externalCache.Invalidate(ctx, pc.PublisherID.String()); err != nil {
        slog.Warn("failed to invalidate cache", "error", err, "publisher", pc.PublisherID)
    }

    // ... respond ...
}
```

### Metrics

**Cache metrics structure:**
```go
type CacheMetrics struct {
    Hits         int64
    Misses       int64
    HitRate      float64
    AvgHitTime   time.Duration
    AvgMissTime  time.Duration
    Invalidations int64
}

func (h *Handlers) recordCacheMetrics(result string, duration time.Duration) {
    // Prometheus metrics or structured logging
    slog.Info("external_api_cache",
        "result", result,
        "duration_ms", duration.Milliseconds(),
    )
}
```

---

## Tasks / Subtasks

- [ ] Task 1: Create cache module
  - [ ] 1.1 Create `api/internal/cache/external_api.go`
  - [ ] 1.2 Implement cache key generation
  - [ ] 1.3 Implement Get/Set methods
  - [ ] 1.4 Implement TTL selection logic
  - [ ] 1.5 Implement cache invalidation

- [ ] Task 2: Configure Redis connection
  - [ ] 2.1 Add cache config to application config
  - [ ] 2.2 Initialize ExternalAPICache in main.go
  - [ ] 2.3 Add cache to Handlers struct
  - [ ] 2.4 Configure TTL values

- [ ] Task 3: Integrate with external API handler
  - [ ] 3.1 Update GetExternalZmanim to check cache
  - [ ] 3.2 Update response to return cached data
  - [ ] 3.3 Set `Cached: true` for cache hits
  - [ ] 3.4 Add X-Cache header (HIT/MISS)
  - [ ] 3.5 Store results in cache on miss

- [ ] Task 4: Implement cache invalidation
  - [ ] 4.1 Invalidate on publisher zman update
  - [ ] 4.2 Invalidate on publisher zman delete
  - [ ] 4.3 Invalidate on publisher zman create
  - [ ] 4.4 Add manual invalidation endpoint (admin)

- [ ] Task 5: Add metrics and monitoring
  - [ ] 5.1 Add cache hit/miss logging
  - [ ] 5.2 Track average response times
  - [ ] 5.3 Calculate hit rate
  - [ ] 5.4 Add health check for cache connection

- [ ] Task 6: Testing
  - [ ] 6.1 Unit tests for cache key generation
  - [ ] 6.2 Unit tests for TTL selection
  - [ ] 6.3 Integration tests for cache flow
  - [ ] 6.4 Test cache invalidation
  - [ ] 6.5 Load test to verify performance improvement
  - [ ] 6.6 Test cache expiry behavior

- [ ] Task 7: Documentation
  - [ ] 7.1 Document cache configuration
  - [ ] 7.2 Document TTL strategies
  - [ ] 7.3 Document cache invalidation triggers
  - [ ] 7.4 Update API documentation with Cached field

---

## Dependencies

**Depends On:**
- Redis available (already configured)

**Dependent Stories:**
- None

---

## Definition of Done

- [ ] Cache key generation implemented
- [ ] Redis caching integrated with external API
- [ ] Cached responses return with `Cached: true`
- [ ] Configurable TTL by request type
- [ ] Cache invalidation on publisher updates
- [ ] X-Cache header indicates hit/miss
- [ ] Cache metrics logged
- [ ] Unit tests for cache module
- [ ] Integration tests for cache flow
- [ ] Performance improvement measurable (>90% reduction for cache hits)
- [ ] No regressions in external API functionality

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Cache stampede | LOW | MEDIUM | Implement mutex/lock on cache miss |
| Stale data returned | MEDIUM | MEDIUM | Conservative TTLs, invalidation on updates |
| Redis unavailable | LOW | LOW | Graceful fallback to uncached |
| Large response caching | LOW | MEDIUM | Size limits, skip oversized responses |

---

## Performance Expectations

| Metric | Uncached | Cached | Improvement |
|--------|----------|--------|-------------|
| Single day request | ~200ms | ~5ms | 97.5% |
| 7-day request | ~800ms | ~5ms | 99.4% |
| 30-day request | ~3000ms | ~5ms | 99.8% |

**Target cache hit rate:** >80% for repeat requests

---

## Dev Notes

### Cache Stampede Prevention

If many requests arrive for the same uncached data, all will miss and trigger calculations. Consider implementing a "singleflight" pattern:

```go
import "golang.org/x/sync/singleflight"

var sf singleflight.Group

result, err, shared := sf.Do(cacheKey, func() (interface{}, error) {
    return h.calculateZmanim(ctx, req)
})
if shared {
    slog.Info("singleflight: shared calculation result")
}
```

### Cache Warmup (Optional Enhancement)

For popular publishers, pre-warm cache during off-peak hours:
```go
func (h *Handlers) WarmCache(ctx context.Context, publisherID string) error {
    // Get publisher's most common cities
    // Pre-calculate next 7 days of zmanim
    // Store in cache
}
```

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-15 | Story created for Epic 9 | Claude Opus 4.5 |

---

_Sprint: Epic 9_
_Created: 2025-12-15_
_Story Points: 5_
