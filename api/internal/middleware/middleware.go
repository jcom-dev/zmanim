package middleware

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// SlowQueryThreshold defines when a request is considered slow
const SlowQueryThreshold = 100 * time.Millisecond

func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)

		duration := time.Since(start)

		// Log slow queries with WARN level for easy filtering
		if duration > SlowQueryThreshold {
			slog.Warn("SLOW REQUEST",
				"method", r.Method,
				"path", r.URL.Path,
				"query", r.URL.RawQuery,
				"status", ww.Status(),
				"duration_ms", duration.Milliseconds(),
				"remote_addr", r.RemoteAddr,
			)
		} else {
			slog.Info("http request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", ww.Status(),
				"duration", duration,
				"remote_addr", r.RemoteAddr,
			)
		}
	})
}

// RequestIDChi wraps chi's RequestID middleware
// Note: We also have a custom RequestID in request_id.go with provenance tracking support
func RequestIDChi(next http.Handler) http.Handler {
	return middleware.RequestID(next)
}

// Recoverer recovers from panics and returns a 500 error
func Recoverer(next http.Handler) http.Handler {
	return middleware.Recoverer(next)
}

// RealIP sets the RemoteAddr to the real client IP
func RealIP(next http.Handler) http.Handler {
	return middleware.RealIP(next)
}

// Timeout sets a timeout for requests
func Timeout(timeout time.Duration) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), timeout)
			defer cancel()

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ContentType sets the Content-Type header
func ContentType(contentType string) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", contentType)
			next.ServeHTTP(w, r)
		})
	}
}

// SecurityHeaders adds security-related headers
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		next.ServeHTTP(w, r)
	})
}

// LogFailedRequestBodies logs request bodies for failed requests (4xx, 5xx)
func LogFailedRequestBodies(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only log for methods that have bodies
		if r.Method != "POST" && r.Method != "PUT" && r.Method != "PATCH" {
			next.ServeHTTP(w, r)
			return
		}

		// Read and buffer the request body
		var bodyBytes []byte
		if r.Body != nil {
			bodyBytes, _ = io.ReadAll(r.Body)
			r.Body.Close()
			// Restore the body so handlers can read it
			r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		}

		// Wrap response writer to capture status
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)

		// Log body if request failed (4xx or 5xx)
		status := ww.Status()
		if status >= 400 {
			bodyStr := string(bodyBytes)
			if len(bodyStr) > 1000 {
				bodyStr = bodyStr[:1000] + "... (truncated)"
			}
			slog.Error("failed request body",
				"method", r.Method,
				"path", r.URL.Path,
				"status", status,
				"body", bodyStr,
				"content_type", r.Header.Get("Content-Type"),
			)
		}
	})
}
