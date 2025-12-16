package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// Cache provides Redis-based caching for zmanim calculations
type Cache struct {
	client   *redis.Client
	redisURL string // For logging purposes
}

// ZmanimCacheEntry represents a cached zmanim calculation result
type ZmanimCacheEntry struct {
	Data      json.RawMessage `json:"data"`
	CachedAt  time.Time       `json:"cached_at"`
	ExpiresAt time.Time       `json:"expires_at"`
}

// ZmanCalculationEntry represents a cached individual zman calculation
type ZmanCalculationEntry struct {
	Time         string    `json:"time"`         // HH:mm:ss format
	TimeRounded  string    `json:"time_rounded"` // After rounding applied
	RoundingMode string    `json:"rounding_mode"`
	CachedAt     time.Time `json:"cached_at"`
}

// FormulaCalculationEntry represents a cached formula preview calculation
type FormulaCalculationEntry struct {
	Time     string    `json:"time"` // HH:mm:ss format
	CachedAt time.Time `json:"cached_at"`
}

// Default TTLs
const (
	// ZmanimTTL is the TTL for cached zmanim calculations (24 hours)
	ZmanimTTL = 24 * time.Hour
	// AlgorithmTTL is the TTL for algorithm configurations (1 hour)
	AlgorithmTTL = 1 * time.Hour
	// LocalityTTL is the TTL for locality data (7 days - rarely changes)
	LocalityTTL = 7 * 24 * time.Hour
)

// New creates a new Redis cache client
func New() (*Cache, error) {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse REDIS_URL: %w", err)
	}

	client := redis.NewClient(opt)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	isUpstash := strings.Contains(redisURL, "upstash.io")
	provider := "Redis"
	if isUpstash {
		provider = "Upstash Redis"
	}
	slog.Info("cache connection established",
		"provider", provider,
		"host", opt.Addr,
	)

	return &Cache{client: client, redisURL: redisURL}, nil
}

// Close closes the Redis connection
func (c *Cache) Close() error {
	return c.client.Close()
}

// Client returns the underlying Redis client for direct access
func (c *Cache) Client() *redis.Client {
	return c.client
}

// zmanimKey generates a cache key for zmanim calculations
// Format: zmanim:{publisherId}:{localityId}:{date}
func zmanimKey(publisherID, localityID, date string) string {
	return fmt.Sprintf("zmanim:%s:%s:%s", publisherID, localityID, date)
}

// algorithmKey generates a cache key for algorithm configurations
// Format: algorithm:{publisherId}
func algorithmKey(publisherID string) string {
	return fmt.Sprintf("algorithm:%s", publisherID)
}

// localityKey generates a cache key for locality data
// Format: locality:{localityId}
func localityKey(localityID string) string {
	return fmt.Sprintf("locality:%s", localityID)
}

// zmanCalculationKey generates a cache key for individual zman calculation
func zmanCalculationKey(publisherZmanID int64, localityID int64, date string) string {
	return fmt.Sprintf("calc:%d:%d:%s", publisherZmanID, localityID, date)
}

// formulaCalculationKey generates a cache key for formula preview
func formulaCalculationKey(formulaHash string, lat, lon float64, date string) string {
	return fmt.Sprintf("formula:%s:%.4f:%.4f:%s", formulaHash, lat, lon, date)
}

// hashFormula computes a hash of the formula string for cache key generation
func hashFormula(formula string) string {
	h := sha256.Sum256([]byte(formula))
	return hex.EncodeToString(h[:8]) // First 8 bytes = 16 hex chars
}

// GetZmanim retrieves cached zmanim calculations
func (c *Cache) GetZmanim(ctx context.Context, publisherID, localityID, date string) (*ZmanimCacheEntry, error) {
	key := zmanimKey(publisherID, localityID, date)
	data, err := c.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		slog.Debug("cache miss", "key", key)
		return nil, nil
	}
	if err != nil {
		slog.Error("cache get error", "key", key, "error", err)
		return nil, fmt.Errorf("failed to get cached zmanim: %w", err)
	}

	var entry ZmanimCacheEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		return nil, fmt.Errorf("failed to unmarshal cached zmanim: %w", err)
	}

	slog.Debug("cache hit", "key", key, "cached_at", entry.CachedAt.Format(time.RFC3339))
	return &entry, nil
}

// SetZmanim caches zmanim calculation results
func (c *Cache) SetZmanim(ctx context.Context, publisherID, localityID, date string, data interface{}) error {
	key := zmanimKey(publisherID, localityID, date)

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal zmanim data: %w", err)
	}

	entry := ZmanimCacheEntry{
		Data:      jsonData,
		CachedAt:  time.Now(),
		ExpiresAt: time.Now().Add(ZmanimTTL),
	}

	entryJSON, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("failed to marshal cache entry: %w", err)
	}

	if err := c.client.Set(ctx, key, entryJSON, ZmanimTTL).Err(); err != nil {
		slog.Error("cache set error", "key", key, "error", err)
		return err
	}
	slog.Debug("cache set", "key", key, "ttl", ZmanimTTL, "size_bytes", len(entryJSON))
	return nil
}

// InvalidateZmanim removes cached zmanim for a publisher
// Used when algorithm is updated
func (c *Cache) InvalidateZmanim(ctx context.Context, publisherID string) error {
	pattern := fmt.Sprintf("zmanim:%s:*", publisherID)
	slog.Info("invalidating zmanim cache", "publisher_id", publisherID)
	return c.deleteByPattern(ctx, pattern)
}

// InvalidatePublisherCache clears ALL cached data for a publisher
// This includes: zmanim calculations, filtered results, week batches, and algorithm config
// Use this for comprehensive cache clearing when publisher data changes
func (c *Cache) InvalidatePublisherCache(ctx context.Context, publisherID string) error {
	patterns := []string{
		fmt.Sprintf("calc:%s:*", publisherID),   // Unified calculation cache (new format)
		fmt.Sprintf("zmanim:%s:*", publisherID), // Legacy zmanim cache
		fmt.Sprintf("%s:*", publisherID),        // Filtered zmanim cache (publisherId:date:lat:lon)
		fmt.Sprintf("week:%s:*", publisherID),   // Week batch cache
	}

	var totalDeleted int64
	for _, pattern := range patterns {
		if err := c.deleteByPattern(ctx, pattern); err != nil {
			slog.Error("cache delete pattern error", "pattern", pattern, "error", err)
		} else {
			totalDeleted++ // Count successful pattern deletions
		}
	}

	if err := c.InvalidateAlgorithm(ctx, publisherID); err != nil {
		slog.Error("cache invalidate algorithm error", "publisher_id", publisherID, "error", err)
	}

	slog.Info("invalidated cache for publisher", "publisher_id", publisherID, "patterns_checked", len(patterns))
	return nil
}

// InvalidateZmanimForLocality removes cached zmanim for a specific locality
func (c *Cache) InvalidateZmanimForLocality(ctx context.Context, publisherID, localityID string) error {
	pattern := fmt.Sprintf("zmanim:%s:%s:*", publisherID, localityID)
	return c.deleteByPattern(ctx, pattern)
}

// FlushAllZmanim removes all cached zmanim calculations
func (c *Cache) FlushAllZmanim(ctx context.Context) error {
	pattern := "zmanim:*"
	return c.deleteByPattern(ctx, pattern)
}

// GetAlgorithm retrieves cached algorithm configuration
func (c *Cache) GetAlgorithm(ctx context.Context, publisherID string) ([]byte, error) {
	key := algorithmKey(publisherID)
	data, err := c.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return data, nil
}

// SetAlgorithm caches algorithm configuration
func (c *Cache) SetAlgorithm(ctx context.Context, publisherID string, config []byte) error {
	key := algorithmKey(publisherID)
	return c.client.Set(ctx, key, config, AlgorithmTTL).Err()
}

// InvalidateAlgorithm removes cached algorithm for a publisher
func (c *Cache) InvalidateAlgorithm(ctx context.Context, publisherID string) error {
	key := algorithmKey(publisherID)
	return c.client.Del(ctx, key).Err()
}

// GetLocality retrieves cached locality data
func (c *Cache) GetLocality(ctx context.Context, localityID string) ([]byte, error) {
	key := localityKey(localityID)
	data, err := c.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return data, nil
}

// SetLocality caches locality data
func (c *Cache) SetLocality(ctx context.Context, localityID string, data []byte) error {
	key := localityKey(localityID)
	return c.client.Set(ctx, key, data, LocalityTTL).Err()
}

// DeleteByPattern deletes all keys matching a pattern (public method)
func (c *Cache) DeleteByPattern(ctx context.Context, pattern string) error {
	return c.deleteByPattern(ctx, pattern)
}

// deleteByPattern deletes all keys matching a pattern
func (c *Cache) deleteByPattern(ctx context.Context, pattern string) error {
	var cursor uint64
	var deleted int64

	for {
		keys, nextCursor, err := c.client.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return fmt.Errorf("failed to scan keys: %w", err)
		}

		if len(keys) > 0 {
			result, err := c.client.Del(ctx, keys...).Result()
			if err != nil {
				return fmt.Errorf("failed to delete keys: %w", err)
			}
			deleted += result
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	if deleted > 0 {
		slog.Debug("cache keys deleted", "count", deleted, "pattern", pattern)
	}
	return nil
}

// Prefetch warms the cache for common requests
// Called for upcoming dates (today + next 7 days) for popular localities
func (c *Cache) Prefetch(ctx context.Context, fn func(publisherID, localityID, date string) (interface{}, error), publisherID string, localityIDs []string) error {
	now := time.Now()
	dates := make([]string, 8)
	for i := 0; i < 8; i++ {
		dates[i] = now.AddDate(0, 0, i).Format("2006-01-02")
	}

	for _, localityID := range localityIDs {
		for _, date := range dates {
			cached, err := c.GetZmanim(ctx, publisherID, localityID, date)
			if err != nil {
				slog.Error("prefetch cache check error", "publisher_id", publisherID, "locality_id", localityID, "date", date, "error", err)
				continue
			}
			if cached != nil {
				continue
			}

			data, err := fn(publisherID, localityID, date)
			if err != nil {
				slog.Error("prefetch calculation error", "publisher_id", publisherID, "locality_id", localityID, "date", date, "error", err)
				continue
			}

			if err := c.SetZmanim(ctx, publisherID, localityID, date, data); err != nil {
				slog.Error("prefetch caching error", "publisher_id", publisherID, "locality_id", localityID, "date", date, "error", err)
			}
		}
	}

	return nil
}

// Stats returns cache statistics
func (c *Cache) Stats(ctx context.Context) (map[string]interface{}, error) {
	info, err := c.client.Info(ctx, "stats", "memory", "keyspace").Result()
	if err != nil {
		return nil, err
	}

	// Count keys by pattern
	zmanimCount, _ := c.countKeys(ctx, "zmanim:*")
	algorithmCount, _ := c.countKeys(ctx, "algorithm:*")
	localityCount, _ := c.countKeys(ctx, "locality:*")

	return map[string]interface{}{
		"redis_info":        info,
		"zmanim_entries":    zmanimCount,
		"algorithm_entries": algorithmCount,
		"locality_entries":  localityCount,
	}, nil
}

// countKeys counts keys matching a pattern
func (c *Cache) countKeys(ctx context.Context, pattern string) (int64, error) {
	var count int64
	var cursor uint64

	for {
		keys, nextCursor, err := c.client.Scan(ctx, cursor, pattern, 1000).Result()
		if err != nil {
			return 0, err
		}
		count += int64(len(keys))
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	return count, nil
}

// GetZmanCalculation retrieves a cached zman calculation
func (c *Cache) GetZmanCalculation(ctx context.Context, publisherZmanID int64, localityID int64, date string) (*ZmanCalculationEntry, error) {
	key := zmanCalculationKey(publisherZmanID, localityID, date)
	data, err := c.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		slog.Debug("cache miss", "key", key)
		return nil, nil
	}
	if err != nil {
		slog.Error("cache get error", "key", key, "error", err)
		return nil, fmt.Errorf("failed to get cached zman calculation: %w", err)
	}

	var entry ZmanCalculationEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		return nil, fmt.Errorf("failed to unmarshal cached zman calculation: %w", err)
	}

	slog.Debug("cache hit", "key", key, "cached_at", entry.CachedAt.Format(time.RFC3339))
	return &entry, nil
}

// SetZmanCalculation caches a zman calculation with NO TTL (permanent until invalidated)
func (c *Cache) SetZmanCalculation(ctx context.Context, publisherZmanID int64, localityID int64, date string, data *ZmanCalculationEntry) error {
	key := zmanCalculationKey(publisherZmanID, localityID, date)

	entryJSON, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal zman calculation entry: %w", err)
	}

	// No TTL (0) - cache persists until explicitly invalidated
	if err := c.client.Set(ctx, key, entryJSON, 0).Err(); err != nil {
		slog.Error("cache set error", "key", key, "error", err)
		return err
	}
	slog.Debug("cache set permanent", "key", key, "size_bytes", len(entryJSON))
	return nil
}

// InvalidateZmanFormula invalidates cache for a specific publisher zman
func (c *Cache) InvalidateZmanFormula(ctx context.Context, publisherZmanID int64) error {
	pattern := fmt.Sprintf("calc:%d:*", publisherZmanID)
	slog.Info("invalidating zman formula cache", "publisher_zman_id", publisherZmanID)
	return c.deleteByPattern(ctx, pattern)
}

// GetFormulaCalculation retrieves a cached formula calculation (for preview)
func (c *Cache) GetFormulaCalculation(ctx context.Context, formula string, lat, lon float64, date string) (*FormulaCalculationEntry, error) {
	fHash := hashFormula(formula)
	key := formulaCalculationKey(fHash, lat, lon, date)
	data, err := c.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		slog.Debug("cache miss", "key", key)
		return nil, nil
	}
	if err != nil {
		slog.Error("cache get error", "key", key, "error", err)
		return nil, fmt.Errorf("failed to get cached formula calculation: %w", err)
	}

	var entry FormulaCalculationEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		return nil, fmt.Errorf("failed to unmarshal cached formula calculation: %w", err)
	}

	slog.Debug("cache hit", "key", key, "cached_at", entry.CachedAt.Format(time.RFC3339))
	return &entry, nil
}

// SetFormulaCalculation caches a formula calculation with standard TTL
func (c *Cache) SetFormulaCalculation(ctx context.Context, formula string, lat, lon float64, date string, data *FormulaCalculationEntry) error {
	fHash := hashFormula(formula)
	key := formulaCalculationKey(fHash, lat, lon, date)

	entryJSON, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal formula calculation entry: %w", err)
	}

	if err := c.client.Set(ctx, key, entryJSON, ZmanimTTL).Err(); err != nil {
		slog.Error("cache set error", "key", key, "error", err)
		return err
	}
	slog.Debug("cache set", "key", key, "ttl", ZmanimTTL, "size_bytes", len(entryJSON))
	return nil
}
