// File: rate_limit_external_test.go
// Purpose: Integration tests for external API rate limiting middleware
// Pattern: test
// Dependencies: miniredis, rate limiter service
// Compliance: Story 8-7 - Rate Limiting for External API

package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

// mockRateLimiter is a simple in-memory rate limiter for testing
type mockRateLimiter struct {
	counts map[string]int
	mr     *miniredis.Miniredis
	client *redis.Client
}

func setupTestRateLimiter(t *testing.T) (*mockRateLimiter, *miniredis.Miniredis) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}

	client := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	return &mockRateLimiter{
		counts: make(map[string]int),
		mr:     mr,
		client: client,
	}, mr
}

func (m *mockRateLimiter) Check(ctx context.Context, clientID string) (*RateLimitResult, error) {
	// Simple increment and check logic
	key := "ratelimit:" + clientID + ":minute"

	count, err := m.client.Incr(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	if count == 1 {
		m.client.Expire(ctx, key, 60*time.Second)
	}

	ttl := m.client.TTL(ctx, key).Val()

	allowed := count <= int64(DefaultMinuteLimit)
	remaining := DefaultMinuteLimit - int(count)
	if remaining < 0 {
		remaining = 0
	}

	retryAfter := 0
	if !allowed {
		retryAfter = int(ttl.Seconds())
	}

	return &RateLimitResult{
		Allowed:         allowed,
		MinuteRemaining: remaining,
		HourRemaining:   DefaultHourLimit - int(count), // simplified
		MinuteReset:     time.Now().Add(ttl).Unix(),
		HourReset:       time.Now().Add(time.Hour).Unix(),
		RetryAfter:      retryAfter,
	}, nil
}

func TestExternalRateLimiter_AllowsRequestsWithinLimit(t *testing.T) {
	rl, mr := setupTestRateLimiter(t)
	defer mr.Close()

	middleware := NewExternalRateLimiter(rl)

	handler := middleware.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("success"))
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	// Add client ID to context (normally set by M2M auth middleware)
	ctx := context.WithValue(req.Context(), ClientIDKey, "test-client")
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	// Check rate limit headers are present
	if rec.Header().Get("X-RateLimit-Limit") == "" {
		t.Error("X-RateLimit-Limit header not set")
	}
	if rec.Header().Get("X-RateLimit-Remaining") == "" {
		t.Error("X-RateLimit-Remaining header not set")
	}
	if rec.Header().Get("X-RateLimit-Reset") == "" {
		t.Error("X-RateLimit-Reset header not set")
	}
}

func TestExternalRateLimiter_BlocksAfterMinuteLimit(t *testing.T) {
	rl, mr := setupTestRateLimiter(t)
	defer mr.Close()

	middleware := NewExternalRateLimiter(rl)

	handler := middleware.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("success"))
	}))

	clientID := "test-client-limit"

	// Make 10 requests (the limit)
	for i := 0; i < DefaultMinuteLimit; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		ctx := context.WithValue(req.Context(), ClientIDKey, clientID)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("request %d should succeed, got status %d", i+1, rec.Code)
		}
	}

	// 11th request should be blocked
	req := httptest.NewRequest("GET", "/test", nil)
	ctx := context.WithValue(req.Context(), ClientIDKey, clientID)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("expected status 429, got %d", rec.Code)
	}

	// Check Retry-After header
	if rec.Header().Get("Retry-After") == "" {
		t.Error("Retry-After header not set on 429 response")
	}

	// Check response body
	var response map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if response["error"] != "rate_limit_exceeded" {
		t.Errorf("expected error code 'rate_limit_exceeded', got %v", response["error"])
	}

	if _, ok := response["retry_after"]; !ok {
		t.Error("response should include retry_after field")
	}

	if _, ok := response["message"]; !ok {
		t.Error("response should include message field")
	}
}

func TestExternalRateLimiter_RejectsWithoutClientID(t *testing.T) {
	rl, mr := setupTestRateLimiter(t)
	defer mr.Close()

	middleware := NewExternalRateLimiter(rl)

	handler := middleware.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("success"))
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	// No client ID in context

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("expected status 429 when client ID missing, got %d", rec.Code)
	}
}

func TestExternalRateLimiter_IsolatesClients(t *testing.T) {
	rl, mr := setupTestRateLimiter(t)
	defer mr.Close()

	middleware := NewExternalRateLimiter(rl)

	handler := middleware.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("success"))
	}))

	// Client 1 makes requests
	client1 := "client-1"
	for i := 0; i < DefaultMinuteLimit; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		ctx := context.WithValue(req.Context(), ClientIDKey, client1)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("client 1 request %d should succeed", i+1)
		}
	}

	// Client 2 should still have full quota
	client2 := "client-2"
	req := httptest.NewRequest("GET", "/test", nil)
	ctx := context.WithValue(req.Context(), ClientIDKey, client2)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("client 2 should not be affected by client 1's quota, got status %d", rec.Code)
	}

	// Check remaining count is for fresh client
	remaining := rec.Header().Get("X-RateLimit-Remaining")
	expectedRemaining := "9" // DefaultMinuteLimit - 1
	if remaining != expectedRemaining {
		t.Errorf("expected remaining to be %s for fresh client, got %s", expectedRemaining, remaining)
	}
}

func TestExternalRateLimiter_HeadersDecrementCorrectly(t *testing.T) {
	rl, mr := setupTestRateLimiter(t)
	defer mr.Close()

	middleware := NewExternalRateLimiter(rl)

	handler := middleware.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	clientID := "test-client-headers"

	// Make 3 requests and check remaining decrements
	expectedRemaining := []string{"9", "8", "7"}
	for i, expected := range expectedRemaining {
		req := httptest.NewRequest("GET", "/test", nil)
		ctx := context.WithValue(req.Context(), ClientIDKey, clientID)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		remaining := rec.Header().Get("X-RateLimit-Remaining")
		if remaining != expected {
			t.Errorf("request %d: expected remaining %s, got %s", i+1, expected, remaining)
		}
	}
}

func TestExternalRateLimiter_ResetsAfterWindow(t *testing.T) {
	rl, mr := setupTestRateLimiter(t)
	defer mr.Close()

	middleware := NewExternalRateLimiter(rl)

	handler := middleware.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	clientID := "test-client-reset"

	// Exhaust minute limit
	for i := 0; i < DefaultMinuteLimit; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		ctx := context.WithValue(req.Context(), ClientIDKey, clientID)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
	}

	// Next request should be blocked
	req := httptest.NewRequest("GET", "/test", nil)
	ctx := context.WithValue(req.Context(), ClientIDKey, clientID)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Error("expected request to be blocked")
	}

	// Fast forward past minute window
	mr.FastForward(61 * time.Second)

	// Should be allowed again
	req = httptest.NewRequest("GET", "/test", nil)
	ctx = context.WithValue(req.Context(), ClientIDKey, clientID)
	req = req.WithContext(ctx)

	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected request to succeed after reset, got status %d", rec.Code)
	}
}
