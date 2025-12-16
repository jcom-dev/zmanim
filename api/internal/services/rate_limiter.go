// File: rate_limiter.go
// Purpose: Redis-backed token bucket rate limiter for external API
// Pattern: service
// Dependencies: Redis, context
// Frequency: critical - protects external API from abuse
// Compliance: Story 8-7 - Rate Limiting for External API

package services

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

// RateLimiter provides distributed rate limiting using Redis
type RateLimiter struct {
	redis *redis.Client
}

// Limit represents a rate limit configuration
type Limit struct {
	Requests int
	Window   time.Duration
}

// RateLimitResult contains the result of a rate limit check
type RateLimitResult struct {
	Allowed         bool
	MinuteRemaining int
	HourRemaining   int
	MinuteReset     int64 // Unix timestamp
	HourReset       int64 // Unix timestamp
	RetryAfter      int   // Seconds to wait before retrying
}

// Default limits for external API (Story 8-7)
const (
	DefaultMinuteLimit = 10
	DefaultHourLimit   = 100
)

// NewRateLimiter creates a new Redis-backed rate limiter
func NewRateLimiter(redisClient *redis.Client) *RateLimiter {
	return &RateLimiter{
		redis: redisClient,
	}
}

// Check performs a rate limit check for the given client ID
// Returns whether the request is allowed and remaining quota information
func (r *RateLimiter) Check(ctx context.Context, clientID string) (*RateLimitResult, error) {
	return r.CheckWithLimits(ctx, clientID, DefaultMinuteLimit, DefaultHourLimit)
}

// CheckWithLimits performs a rate limit check with custom limits
// Useful for per-client limit overrides (AC 6 - stretch goal)
func (r *RateLimiter) CheckWithLimits(ctx context.Context, clientID string, minuteLimit, hourLimit int) (*RateLimitResult, error) {
	minuteKey := fmt.Sprintf("ratelimit:%s:minute", clientID)
	hourKey := fmt.Sprintf("ratelimit:%s:hour", clientID)

	now := time.Now()

	// Check minute limit
	minuteCount, minuteTTL, err := r.incrementAndGetTTL(ctx, minuteKey, time.Minute)
	if err != nil {
		// Graceful degradation: if Redis fails, allow the request
		slog.Warn("rate limiter: redis error on minute check, allowing request",
			"client_id", clientID,
			"error", err)
		return &RateLimitResult{
			Allowed:         true,
			MinuteRemaining: minuteLimit,
			HourRemaining:   hourLimit,
			MinuteReset:     now.Add(time.Minute).Unix(),
			HourReset:       now.Add(time.Hour).Unix(),
			RetryAfter:      0,
		}, nil
	}

	// Check hour limit
	hourCount, hourTTL, err := r.incrementAndGetTTL(ctx, hourKey, time.Hour)
	if err != nil {
		// Graceful degradation: if Redis fails, allow the request
		slog.Warn("rate limiter: redis error on hour check, allowing request",
			"client_id", clientID,
			"error", err)
		return &RateLimitResult{
			Allowed:         true,
			MinuteRemaining: minuteLimit,
			HourRemaining:   hourLimit,
			MinuteReset:     now.Add(time.Minute).Unix(),
			HourReset:       now.Add(time.Hour).Unix(),
			RetryAfter:      0,
		}, nil
	}

	// Calculate remaining requests
	minuteRemaining := minuteLimit - int(minuteCount)
	if minuteRemaining < 0 {
		minuteRemaining = 0
	}

	hourRemaining := hourLimit - int(hourCount)
	if hourRemaining < 0 {
		hourRemaining = 0
	}

	// Calculate reset times
	minuteReset := now.Add(minuteTTL).Unix()
	hourReset := now.Add(hourTTL).Unix()

	// Determine if request is allowed (both limits must pass)
	allowed := minuteCount <= int64(minuteLimit) && hourCount <= int64(hourLimit)

	// Calculate retry_after (time until next allowed request)
	retryAfter := 0
	if !allowed {
		if minuteCount > int64(minuteLimit) {
			retryAfter = int(minuteTTL.Seconds())
		} else {
			retryAfter = int(hourTTL.Seconds())
		}
	}

	result := &RateLimitResult{
		Allowed:         allowed,
		MinuteRemaining: minuteRemaining,
		HourRemaining:   hourRemaining,
		MinuteReset:     minuteReset,
		HourReset:       hourReset,
		RetryAfter:      retryAfter,
	}

	if !allowed {
		slog.Info("rate limit exceeded",
			"client_id", clientID,
			"minute_count", minuteCount,
			"minute_limit", minuteLimit,
			"hour_count", hourCount,
			"hour_limit", hourLimit,
			"retry_after", retryAfter)
	}

	return result, nil
}

// incrementAndGetTTL atomically increments a counter and returns the count and TTL
// Uses Redis INCR + EXPIRE with Lua script for atomicity
func (r *RateLimiter) incrementAndGetTTL(ctx context.Context, key string, window time.Duration) (int64, time.Duration, error) {
	// Lua script for atomic increment with TTL
	// If key doesn't exist or has no TTL, set it
	// Returns: [count, ttl_seconds]
	script := redis.NewScript(`
		local count = redis.call('INCR', KEYS[1])
		local ttl = redis.call('TTL', KEYS[1])

		-- If this is the first request or TTL expired, set new TTL
		if count == 1 or ttl == -1 then
			redis.call('EXPIRE', KEYS[1], ARGV[1])
			ttl = tonumber(ARGV[1])
		end

		return {count, ttl}
	`)

	windowSeconds := int(window.Seconds())
	result, err := script.Run(ctx, r.redis, []string{key}, windowSeconds).Result()
	if err != nil {
		return 0, 0, fmt.Errorf("failed to run increment script: %w", err)
	}

	// Parse result
	resultSlice, ok := result.([]interface{})
	if !ok || len(resultSlice) != 2 {
		return 0, 0, fmt.Errorf("unexpected script result format: %v", result)
	}

	count, ok := resultSlice[0].(int64)
	if !ok {
		return 0, 0, fmt.Errorf("unexpected count type: %v", resultSlice[0])
	}

	ttlSeconds, ok := resultSlice[1].(int64)
	if !ok {
		return 0, 0, fmt.Errorf("unexpected ttl type: %v", resultSlice[1])
	}

	ttl := time.Duration(ttlSeconds) * time.Second

	return count, ttl, nil
}

// Reset clears rate limit counters for a client (admin function)
func (r *RateLimiter) Reset(ctx context.Context, clientID string) error {
	minuteKey := fmt.Sprintf("ratelimit:%s:minute", clientID)
	hourKey := fmt.Sprintf("ratelimit:%s:hour", clientID)

	pipe := r.redis.Pipeline()
	pipe.Del(ctx, minuteKey)
	pipe.Del(ctx, hourKey)
	_, err := pipe.Exec(ctx)

	if err != nil {
		return fmt.Errorf("failed to reset rate limits: %w", err)
	}

	slog.Info("rate limits reset", "client_id", clientID)
	return nil
}

// GetStats returns current rate limit stats for a client (admin function)
func (r *RateLimiter) GetStats(ctx context.Context, clientID string) (map[string]interface{}, error) {
	minuteKey := fmt.Sprintf("ratelimit:%s:minute", clientID)
	hourKey := fmt.Sprintf("ratelimit:%s:hour", clientID)

	pipe := r.redis.Pipeline()
	minuteCmd := pipe.Get(ctx, minuteKey)
	minuteTTLCmd := pipe.TTL(ctx, minuteKey)
	hourCmd := pipe.Get(ctx, hourKey)
	hourTTLCmd := pipe.TTL(ctx, hourKey)
	_, err := pipe.Exec(ctx)

	if err != nil && err != redis.Nil {
		return nil, fmt.Errorf("failed to get stats: %w", err)
	}

	minuteCount := int64(0)
	if minuteCmd.Err() == nil {
		minuteCount, _ = minuteCmd.Int64()
	}

	minuteTTL := time.Duration(0)
	if minuteTTLCmd.Err() == nil {
		minuteTTL = minuteTTLCmd.Val()
	}

	hourCount := int64(0)
	if hourCmd.Err() == nil {
		hourCount, _ = hourCmd.Int64()
	}

	hourTTL := time.Duration(0)
	if hourTTLCmd.Err() == nil {
		hourTTL = hourTTLCmd.Val()
	}

	return map[string]interface{}{
		"client_id":     clientID,
		"minute_count":  minuteCount,
		"minute_limit":  DefaultMinuteLimit,
		"minute_ttl":    minuteTTL.Seconds(),
		"hour_count":    hourCount,
		"hour_limit":    DefaultHourLimit,
		"hour_ttl":      hourTTL.Seconds(),
		"minute_remain": max(0, DefaultMinuteLimit-int(minuteCount)),
		"hour_remain":   max(0, DefaultHourLimit-int(hourCount)),
	}, nil
}

// max returns the maximum of two integers
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
