// File: rate_limiter_test.go
// Purpose: Unit tests for Redis-backed rate limiter
// Pattern: test
// Dependencies: miniredis for testing
// Compliance: Story 8-7 - Rate Limiting for External API

package services

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

// setupTestRedis creates a test Redis client using miniredis
func setupTestRedis(t *testing.T) (*redis.Client, *miniredis.Miniredis) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}

	client := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	return client, mr
}

func TestRateLimiter_Check_AllowsWithinLimits(t *testing.T) {
	client, mr := setupTestRedis(t)
	defer mr.Close()
	defer client.Close()

	rl := NewRateLimiter(client)
	ctx := context.Background()
	clientID := "test-client-1"

	// First request should be allowed
	result, err := rl.Check(ctx, clientID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Allowed {
		t.Error("expected first request to be allowed")
	}

	if result.MinuteRemaining != DefaultMinuteLimit-1 {
		t.Errorf("expected minute remaining to be %d, got %d", DefaultMinuteLimit-1, result.MinuteRemaining)
	}

	if result.HourRemaining != DefaultHourLimit-1 {
		t.Errorf("expected hour remaining to be %d, got %d", DefaultHourLimit-1, result.HourRemaining)
	}

	if result.RetryAfter != 0 {
		t.Errorf("expected retry_after to be 0, got %d", result.RetryAfter)
	}
}

func TestRateLimiter_Check_MinuteLimitExceeded(t *testing.T) {
	client, mr := setupTestRedis(t)
	defer mr.Close()
	defer client.Close()

	rl := NewRateLimiter(client)
	ctx := context.Background()
	clientID := "test-client-2"

	// Make 10 requests (the limit)
	for i := 0; i < DefaultMinuteLimit; i++ {
		result, err := rl.Check(ctx, clientID)
		if err != nil {
			t.Fatalf("unexpected error on request %d: %v", i+1, err)
		}
		if !result.Allowed {
			t.Errorf("request %d should be allowed", i+1)
		}
	}

	// 11th request should be blocked
	result, err := rl.Check(ctx, clientID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Error("expected 11th request to be blocked (minute limit)")
	}

	if result.MinuteRemaining != 0 {
		t.Errorf("expected minute remaining to be 0, got %d", result.MinuteRemaining)
	}

	if result.RetryAfter == 0 {
		t.Error("expected retry_after to be set")
	}

	if result.RetryAfter > 60 {
		t.Errorf("retry_after should be <= 60 seconds, got %d", result.RetryAfter)
	}
}

func TestRateLimiter_Check_HourLimitExceeded(t *testing.T) {
	client, mr := setupTestRedis(t)
	defer mr.Close()
	defer client.Close()

	rl := NewRateLimiter(client)
	ctx := context.Background()
	clientID := "test-client-3"

	// Fast-forward through minute windows to test hour limit
	// We'll simulate 100 requests across multiple minutes
	for i := 0; i < DefaultHourLimit; i++ {
		// Fast forward 1 minute every 10 requests to avoid minute limit
		if i > 0 && i%10 == 0 {
			mr.FastForward(61 * time.Second)
		}

		result, err := rl.Check(ctx, clientID)
		if err != nil {
			t.Fatalf("unexpected error on request %d: %v", i+1, err)
		}
		if !result.Allowed {
			t.Errorf("request %d should be allowed (count=%d, limit=%d)", i+1, i+1, DefaultHourLimit)
		}
	}

	// Fast forward 1 minute to avoid minute limit
	mr.FastForward(61 * time.Second)

	// 101st request should be blocked by hour limit
	result, err := rl.Check(ctx, clientID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Error("expected 101st request to be blocked (hour limit)")
	}

	if result.HourRemaining != 0 {
		t.Errorf("expected hour remaining to be 0, got %d", result.HourRemaining)
	}
}

func TestRateLimiter_Check_ResetAfterMinute(t *testing.T) {
	client, mr := setupTestRedis(t)
	defer mr.Close()
	defer client.Close()

	rl := NewRateLimiter(client)
	ctx := context.Background()
	clientID := "test-client-4"

	// Exhaust minute limit
	for i := 0; i < DefaultMinuteLimit; i++ {
		_, _ = rl.Check(ctx, clientID)
	}

	// Next request should be blocked
	result, err := rl.Check(ctx, clientID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Allowed {
		t.Error("expected request to be blocked")
	}

	// Fast forward past minute window
	mr.FastForward(61 * time.Second)

	// Should be allowed again
	result, err = rl.Check(ctx, clientID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Allowed {
		t.Error("expected request to be allowed after minute reset")
	}
}

func TestRateLimiter_CheckWithLimits_CustomLimits(t *testing.T) {
	client, mr := setupTestRedis(t)
	defer mr.Close()
	defer client.Close()

	rl := NewRateLimiter(client)
	ctx := context.Background()
	clientID := "test-client-5"

	customMinuteLimit := 5
	customHourLimit := 50

	// Make requests up to custom limit
	for i := 0; i < customMinuteLimit; i++ {
		result, err := rl.CheckWithLimits(ctx, clientID, customMinuteLimit, customHourLimit)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !result.Allowed {
			t.Errorf("request %d should be allowed", i+1)
		}
	}

	// Next request should be blocked
	result, err := rl.CheckWithLimits(ctx, clientID, customMinuteLimit, customHourLimit)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Allowed {
		t.Error("expected request to be blocked with custom limit")
	}
}

func TestRateLimiter_Reset(t *testing.T) {
	client, mr := setupTestRedis(t)
	defer mr.Close()
	defer client.Close()

	rl := NewRateLimiter(client)
	ctx := context.Background()
	clientID := "test-client-6"

	// Make some requests
	for i := 0; i < 5; i++ {
		_, _ = rl.Check(ctx, clientID)
	}

	// Reset counters
	err := rl.Reset(ctx, clientID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Check should show full limits again
	result, err := rl.Check(ctx, clientID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.MinuteRemaining != DefaultMinuteLimit-1 {
		t.Errorf("expected minute remaining to be %d after reset, got %d", DefaultMinuteLimit-1, result.MinuteRemaining)
	}
}

func TestRateLimiter_GetStats(t *testing.T) {
	client, mr := setupTestRedis(t)
	defer mr.Close()
	defer client.Close()

	rl := NewRateLimiter(client)
	ctx := context.Background()
	clientID := "test-client-7"

	// Make some requests
	requestCount := 3
	for i := 0; i < requestCount; i++ {
		_, _ = rl.Check(ctx, clientID)
	}

	// Get stats
	stats, err := rl.GetStats(ctx, clientID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	minuteCount, ok := stats["minute_count"].(int64)
	if !ok {
		t.Fatal("minute_count not found or wrong type")
	}

	if minuteCount != int64(requestCount) {
		t.Errorf("expected minute_count to be %d, got %d", requestCount, minuteCount)
	}

	minuteRemain, ok := stats["minute_remain"].(int)
	if !ok {
		t.Fatal("minute_remain not found or wrong type")
	}

	expectedRemain := DefaultMinuteLimit - requestCount
	if minuteRemain != expectedRemain {
		t.Errorf("expected minute_remain to be %d, got %d", expectedRemain, minuteRemain)
	}
}

func TestRateLimiter_Check_GracefulDegradation(t *testing.T) {
	client, mr := setupTestRedis(t)
	defer mr.Close()

	rl := NewRateLimiter(client)
	ctx := context.Background()
	clientID := "test-client-8"

	// Make a successful request
	result, err := rl.Check(ctx, clientID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Allowed {
		t.Error("expected request to be allowed")
	}

	// Close Redis to simulate failure
	client.Close()

	// Request should still be allowed (graceful degradation)
	result, err = rl.Check(ctx, clientID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Allowed {
		t.Error("expected request to be allowed on Redis failure (graceful degradation)")
	}
}

func TestRateLimiter_Check_HeaderValues(t *testing.T) {
	client, mr := setupTestRedis(t)
	defer mr.Close()
	defer client.Close()

	rl := NewRateLimiter(client)
	ctx := context.Background()
	clientID := "test-client-9"

	// Make a request
	result, err := rl.Check(ctx, clientID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify reset timestamps are in the future
	now := time.Now().Unix()
	if result.MinuteReset <= now {
		t.Error("minute reset should be in the future")
	}
	if result.HourReset <= now {
		t.Error("hour reset should be in the future")
	}

	// Verify reset times are reasonable
	if result.MinuteReset > now+61 {
		t.Errorf("minute reset too far in future: %d", result.MinuteReset-now)
	}
	if result.HourReset > now+3601 {
		t.Errorf("hour reset too far in future: %d", result.HourReset-now)
	}
}
