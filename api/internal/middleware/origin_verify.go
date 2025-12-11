// Package middleware provides HTTP middleware for the Zmanim API.
package middleware

import (
	"net/http"
	"os"
	"strings"
)

// OriginVerifyHeader is the header name used for origin verification.
const OriginVerifyHeader = "X-Origin-Verify"

// OriginVerify creates middleware that validates the X-Origin-Verify header.
// This ensures that requests only come through API Gateway (which injects this header)
// and not directly to the EC2 instance.
//
// The expected key is read from ORIGIN_VERIFY_KEY environment variable.
// If the env var is not set, the middleware is disabled (allows all requests).
//
// Paths that bypass verification:
// - /health (for AWS health checks that may come directly)
// - /swagger/* (for local development)
func OriginVerify(next http.Handler) http.Handler {
	expectedKey := os.Getenv("ORIGIN_VERIFY_KEY")

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip verification if no key is configured (local dev, testing)
		if expectedKey == "" {
			next.ServeHTTP(w, r)
			return
		}

		// Allow health check endpoint without verification (for AWS health checks)
		if r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

		// Allow swagger endpoints without verification (local dev)
		if strings.HasPrefix(r.URL.Path, "/swagger") {
			next.ServeHTTP(w, r)
			return
		}

		// Validate the origin verify header
		providedKey := r.Header.Get(OriginVerifyHeader)
		if providedKey != expectedKey {
			// Log the attempt (but don't expose the expected key)
			// Use a generic 403 to not reveal that the header is the issue
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		// Header is valid, continue to next handler
		next.ServeHTTP(w, r)
	})
}
