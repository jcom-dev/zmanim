// File: rate_limit_external.go
// Purpose: Rate limiting middleware for external API with Redis-backed token bucket
// Pattern: middleware
// Dependencies: RateLimiter service, M2M authentication context
// Frequency: critical - protects external API endpoints
// Compliance: Story 8-7 - Rate Limiting for External API

package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
)

// RateLimiterService defines the interface for rate limiting
// This avoids import cycles while allowing the middleware to use the service
type RateLimiterService interface {
	Check(ctx context.Context, clientID string) (*RateLimitResult, error)
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

// ExternalRateLimiter provides rate limiting middleware for external API
type ExternalRateLimiter struct {
	rateLimiter RateLimiterService
}

// NewExternalRateLimiter creates a new external API rate limiter middleware
func NewExternalRateLimiter(rateLimiter RateLimiterService) *ExternalRateLimiter {
	return &ExternalRateLimiter{
		rateLimiter: rateLimiter,
	}
}

// Middleware returns the rate limiting middleware handler
// This middleware must run AFTER M2M authentication to access client ID
func (rl *ExternalRateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get client ID from context (set by M2M auth middleware)
		clientID := GetClientID(r.Context())
		if clientID == "" {
			slog.Warn("rate limiter: no client ID in context, rejecting request",
				"path", r.URL.Path,
				"method", r.Method)
			respondRateLimitError(w, "missing client ID", 0)
			return
		}

		// Check rate limits
		result, err := rl.rateLimiter.Check(r.Context(), clientID)
		if err != nil {
			slog.Error("rate limiter: check failed",
				"client_id", clientID,
				"error", err)
			// FAIL CLOSED: Reject request when rate limiter errors (security best practice)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			respondRateLimitError(w, fmt.Sprintf("Rate limiter temporarily unavailable: %s", err.Error()), 60)
			return
		}

		// Add rate limit headers to response
		// Use the most restrictive limit (minute limit is typically smaller)
		limit := DefaultMinuteLimit
		remaining := result.MinuteRemaining
		reset := result.MinuteReset

		// If hour remaining is more restrictive, use that
		if result.HourRemaining < result.MinuteRemaining {
			limit = DefaultHourLimit
			remaining = result.HourRemaining
			reset = result.HourReset
		}

		w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", limit))
		w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
		w.Header().Set("X-RateLimit-Reset", fmt.Sprintf("%d", reset))

		// If rate limit exceeded, return 429
		if !result.Allowed {
			w.Header().Set("Retry-After", fmt.Sprintf("%d", result.RetryAfter))
			respondRateLimitError(w, fmt.Sprintf("Too many requests. Please wait %d seconds.", result.RetryAfter), result.RetryAfter)
			return
		}

		// Request allowed, continue to next handler
		next.ServeHTTP(w, r)
	})
}

// respondRateLimitError sends a 429 Too Many Requests response
func respondRateLimitError(w http.ResponseWriter, message string, retryAfter int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusTooManyRequests)

	response := map[string]interface{}{
		"error":       "rate_limit_exceeded",
		"message":     message,
		"retry_after": retryAfter,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		slog.Error("failed to encode rate limit error response", "error", err)
	}
}
