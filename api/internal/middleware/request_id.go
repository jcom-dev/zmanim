// File: request_id.go
// Purpose: Request ID tracking middleware for provenance and debugging
// Pattern: middleware
// Dependencies: context, http, uuid
// Frequency: critical - used by all routes
// Compliance: Provenance tracking (see docs/compliance/concept-independence-audit.md)

package middleware

import (
	"context"
	"net/http"

	"github.com/google/uuid"
)

// ContextKey is a custom type for context keys to avoid collisions
type ContextKey string

const (
	// RequestIDKey is the context key for storing request IDs
	RequestIDKey ContextKey = "request_id"
)

// RequestID middleware generates or extracts a unique request ID for each request
// and adds it to the context. This enables:
// - Provenance tracking (link actions to requests)
// - Distributed tracing
// - Log correlation
// - Debugging across services
//
// Usage:
//
//	r.Use(middleware.RequestID)
//
// Extracting in handlers:
//
//	requestID := middleware.GetRequestID(ctx)
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if request already has X-Request-ID header (from load balancer, proxy, etc.)
		requestID := r.Header.Get("X-Request-ID")

		// If not, generate a new UUID
		if requestID == "" {
			requestID = uuid.New().String()
		}

		// Add to response headers for client-side correlation
		w.Header().Set("X-Request-ID", requestID)

		// Add to context for handler access
		ctx := context.WithValue(r.Context(), RequestIDKey, requestID)

		// Call next handler with updated context
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetRequestID retrieves the request ID from the context
// Returns empty string if not found (shouldn't happen if middleware is installed)
func GetRequestID(ctx context.Context) string {
	if requestID, ok := ctx.Value(RequestIDKey).(string); ok {
		return requestID
	}
	return ""
}

// GetRequestIDOrGenerate retrieves the request ID from context, or generates a new one if not found
// This is a safety fallback for code paths that might not have the middleware
func GetRequestIDOrGenerate(ctx context.Context) string {
	requestID := GetRequestID(ctx)
	if requestID == "" {
		return uuid.New().String()
	}
	return requestID
}

// ParseRequestID parses a request ID string into a UUID
// Returns error if the string is not a valid UUID
func ParseRequestID(requestID string) (uuid.UUID, error) {
	return uuid.Parse(requestID)
}
