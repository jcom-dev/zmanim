package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
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

// Default TTLs
const (
	// ZmanimTTL is the TTL for cached zmanim calculations (24 hours)
	ZmanimTTL = 24 * time.Hour
	// AlgorithmTTL is the TTL for algorithm configurations (1 hour)
	AlgorithmTTL = 1 * time.Hour
	// CityTTL is the TTL for city data (7 days - rarely changes)
	CityTTL = 7 * 24 * time.Hour
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

	// Log connection details (mask password for security)
	isUpstash := strings.Contains(redisURL, "upstash.io")
	provider := "Redis"
	if isUpstash {
		provider = "Upstash Redis"
	}
	log.Printf("[CACHE] %s connection established (host: %s, provider: %s)", provider, opt.Addr, provider)

	return &Cache{client: client, redisURL: redisURL}, nil
}

// Close closes the Redis connection
func (c *Cache) Close() error {
	return c.client.Close()
}

// zmanimKey generates a cache key for zmanim calculations
// Format: zmanim:{publisherId}:{cityId}:{date}
func zmanimKey(publisherID, cityID, date string) string {
	return fmt.Sprintf("zmanim:%s:%s:%s", publisherID, cityID, date)
}

// algorithmKey generates a cache key for algorithm configurations
// Format: algorithm:{publisherId}
func algorithmKey(publisherID string) string {
	return fmt.Sprintf("algorithm:%s", publisherID)
}

// cityKey generates a cache key for city data
// Format: city:{cityId}
func cityKey(cityID string) string {
	return fmt.Sprintf("city:%s", cityID)
}

// GetZmanim retrieves cached zmanim calculations
func (c *Cache) GetZmanim(ctx context.Context, publisherID, cityID, date string) (*ZmanimCacheEntry, error) {
	key := zmanimKey(publisherID, cityID, date)
	data, err := c.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		log.Printf("[CACHE] GET miss: %s", key)
		return nil, nil // Cache miss
	}
	if err != nil {
		log.Printf("[CACHE] GET error: %s - %v", key, err)
		return nil, fmt.Errorf("failed to get cached zmanim: %w", err)
	}

	var entry ZmanimCacheEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		return nil, fmt.Errorf("failed to unmarshal cached zmanim: %w", err)
	}

	log.Printf("[CACHE] GET hit: %s (cached at %s)", key, entry.CachedAt.Format(time.RFC3339))
	return &entry, nil
}

// SetZmanim caches zmanim calculation results
func (c *Cache) SetZmanim(ctx context.Context, publisherID, cityID, date string, data interface{}) error {
	key := zmanimKey(publisherID, cityID, date)

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
		log.Printf("[CACHE] SET error: %s - %v", key, err)
		return err
	}
	log.Printf("[CACHE] SET: %s (TTL: %v, size: %d bytes)", key, ZmanimTTL, len(entryJSON))
	return nil
}

// InvalidateZmanim removes cached zmanim for a publisher
// Used when algorithm is updated
func (c *Cache) InvalidateZmanim(ctx context.Context, publisherID string) error {
	pattern := fmt.Sprintf("zmanim:%s:*", publisherID)
	log.Printf("[CACHE] Invalidating zmanim for publisher: %s", publisherID)
	return c.deleteByPattern(ctx, pattern)
}

// InvalidatePublisherCache clears ALL cached data for a publisher
// This includes: zmanim calculations, filtered results, week batches, and algorithm config
// Use this for comprehensive cache clearing when publisher data changes
func (c *Cache) InvalidatePublisherCache(ctx context.Context, publisherID string) error {
	patterns := []string{
		fmt.Sprintf("zmanim:%s:*", publisherID), // Standard zmanim cache
		fmt.Sprintf("%s:*", publisherID),        // Filtered zmanim cache (publisherId:date:lat:lon)
		fmt.Sprintf("week:%s:*", publisherID),   // Week batch cache
	}

	var totalDeleted int64
	for _, pattern := range patterns {
		if err := c.deleteByPattern(ctx, pattern); err != nil {
			log.Printf("Cache: error deleting pattern %s: %v", pattern, err)
		}
	}

	// Also clear algorithm cache
	if err := c.InvalidateAlgorithm(ctx, publisherID); err != nil {
		log.Printf("Cache: error invalidating algorithm for %s: %v", publisherID, err)
	}

	if totalDeleted > 0 {
		log.Printf("Cache: invalidated all cache for publisher %s", publisherID)
	}
	return nil
}

// InvalidateZmanimForCity removes cached zmanim for a specific city
func (c *Cache) InvalidateZmanimForCity(ctx context.Context, publisherID, cityID string) error {
	pattern := fmt.Sprintf("zmanim:%s:%s:*", publisherID, cityID)
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

// GetCity retrieves cached city data
func (c *Cache) GetCity(ctx context.Context, cityID string) ([]byte, error) {
	key := cityKey(cityID)
	data, err := c.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return data, nil
}

// SetCity caches city data
func (c *Cache) SetCity(ctx context.Context, cityID string, data []byte) error {
	key := cityKey(cityID)
	return c.client.Set(ctx, key, data, CityTTL).Err()
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
		log.Printf("Cache: deleted %d keys matching pattern %s", deleted, pattern)
	}
	return nil
}

// Prefetch warms the cache for common requests
// Called for upcoming dates (today + next 7 days) for popular cities
func (c *Cache) Prefetch(ctx context.Context, fn func(publisherID, cityID, date string) (interface{}, error), publisherID string, cityIDs []string) error {
	now := time.Now()
	dates := make([]string, 8)
	for i := 0; i < 8; i++ {
		dates[i] = now.AddDate(0, 0, i).Format("2006-01-02")
	}

	for _, cityID := range cityIDs {
		for _, date := range dates {
			// Check if already cached
			cached, err := c.GetZmanim(ctx, publisherID, cityID, date)
			if err != nil {
				log.Printf("Prefetch: error checking cache for %s/%s/%s: %v", publisherID, cityID, date, err)
				continue
			}
			if cached != nil {
				continue // Already cached
			}

			// Calculate and cache
			data, err := fn(publisherID, cityID, date)
			if err != nil {
				log.Printf("Prefetch: error calculating zmanim for %s/%s/%s: %v", publisherID, cityID, date, err)
				continue
			}

			if err := c.SetZmanim(ctx, publisherID, cityID, date, data); err != nil {
				log.Printf("Prefetch: error caching zmanim for %s/%s/%s: %v", publisherID, cityID, date, err)
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
	cityCount, _ := c.countKeys(ctx, "city:*")

	return map[string]interface{}{
		"redis_info":        info,
		"zmanim_entries":    zmanimCount,
		"algorithm_entries": algorithmCount,
		"city_entries":      cityCount,
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
