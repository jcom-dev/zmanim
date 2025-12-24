// File: m2m_auth.go
// Purpose: Clerk M2M token validation for external API access
// Pattern: middleware
// Dependencies: Clerk JWT verification, context management
// Frequency: critical - protects all /external/* routes
// Compliance: Check docs/adr/ for pattern rationale

package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
)

// M2M-specific context keys
const (
	// ClientIDKey is the context key for the M2M client ID
	ClientIDKey contextKey = "client_id"
	// AzpKey is the context key for the authorized party (azp) claim
	AzpKey contextKey = "azp"
)

// M2MAuthMiddleware provides M2M JWT authentication using Clerk
type M2MAuthMiddleware struct {
	authMiddleware *AuthMiddleware
}

// NewM2MAuthMiddleware creates a new M2M authentication middleware
func NewM2MAuthMiddleware(jwksUrl, issuer, audience string) *M2MAuthMiddleware {
	return &M2MAuthMiddleware{
		authMiddleware: NewAuthMiddleware(jwksUrl, issuer, audience),
	}
}

// GetClientID retrieves the client ID from the request context
func GetClientID(ctx context.Context) string {
	if id, ok := ctx.Value(ClientIDKey).(string); ok {
		return id
	}
	return ""
}

// GetAzp retrieves the authorized party (azp) claim from the request context
func GetAzp(ctx context.Context) string {
	if azp, ok := ctx.Value(AzpKey).(string); ok {
		return azp
	}
	return ""
}

// isM2MToken checks if the token is an M2M token (not a user token)
// M2M tokens have:
// - No user ID in subject (or subject contains client ID format)
// - azp claim (authorized party) present
// - No user metadata/public_metadata
func isM2MToken(claims *Claims) bool {
	// M2M tokens typically have azp claim
	// User tokens typically have user metadata

	// Check if subject looks like a user ID (starts with "user_")
	if strings.HasPrefix(claims.Subject, "user_") {
		slog.Debug("token rejected: user token (subject starts with user_)", "subject", claims.Subject)
		return false
	}

	// M2M tokens should not have user-specific metadata
	if claims.Metadata != nil && len(claims.Metadata) > 0 {
		// Check if metadata contains user-specific fields
		if _, hasRole := claims.Metadata["role"]; hasRole {
			slog.Debug("token rejected: contains user role metadata")
			return false
		}
		if _, hasPubID := claims.Metadata["primary_publisher_id"]; hasPubID {
			slog.Debug("token rejected: contains publisher metadata")
			return false
		}
	}

	// M2M tokens in Clerk typically have a subject that's a client ID
	// and may have an azp (authorized party) claim
	slog.Debug("token accepted as M2M token", "subject", claims.Subject)
	return true
}

// extractClientID extracts the client ID from M2M token claims
func extractClientID(claims *Claims) string {
	// The subject (sub) claim contains the client ID for M2M tokens
	return claims.Subject
}

// extractAzp extracts the authorized party (azp) claim if present
func extractAzp(claims *Claims) string {
	// Some M2M tokens may have an azp claim
	// This is typically the client ID that requested the token
	// For now, we'll use the subject as the client ID
	// Future: Parse additional claims if needed
	return claims.Subject
}

// RequireM2M returns a middleware that requires M2M authentication
func (m *M2MAuthMiddleware) RequireM2M(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Validate the token using the standard auth middleware
		claims, err := m.authMiddleware.validateToken(r)
		if err != nil {
			slog.Warn("M2M authentication failed", "error", err, "path", r.URL.Path)
			respondAuthError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid or missing M2M token")
			return
		}

		// Verify this is an M2M token (not a user JWT)
		if !isM2MToken(claims) {
			slog.Warn("user token rejected for M2M endpoint",
				"subject", claims.Subject,
				"path", r.URL.Path,
				"has_metadata", claims.Metadata != nil)
			respondAuthError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User tokens are not accepted for external API. Please use M2M tokens.")
			return
		}

		// Extract client ID from token
		clientID := extractClientID(claims)
		if clientID == "" {
			slog.Warn("M2M token missing client ID", "subject", claims.Subject)
			respondAuthError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid M2M token: missing client ID")
			return
		}

		// Add client info to context for downstream use (logging, rate limiting)
		ctx := context.WithValue(r.Context(), ClientIDKey, clientID)

		// Add azp if present
		if azp := extractAzp(claims); azp != "" {
			ctx = context.WithValue(ctx, AzpKey, azp)
		}

		slog.Info("M2M authentication successful",
			"client_id", clientID,
			"path", r.URL.Path,
			"method", r.Method)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// OptionalM2M returns a middleware that extracts M2M info if present but doesn't require it
func (m *M2MAuthMiddleware) OptionalM2M(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := m.authMiddleware.validateToken(r)
		if err == nil && isM2MToken(claims) {
			// Add client info to context
			ctx := r.Context()
			if clientID := extractClientID(claims); clientID != "" {
				ctx = context.WithValue(ctx, ClientIDKey, clientID)
			}
			if azp := extractAzp(claims); azp != "" {
				ctx = context.WithValue(ctx, AzpKey, azp)
			}
			r = r.WithContext(ctx)
		}
		next.ServeHTTP(w, r)
	})
}

// LoggingMiddleware logs all M2M requests with client ID
func (m *M2MAuthMiddleware) LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clientID := GetClientID(r.Context())
		if clientID != "" {
			slog.Info("M2M API request",
				"client_id", clientID,
				"method", r.Method,
				"path", r.URL.Path,
				"user_agent", r.UserAgent(),
			)
		}
		next.ServeHTTP(w, r)
	})
}

// extractBearerToken extracts the bearer token from the Authorization header
func extractBearerToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return ""
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return ""
	}

	return parts[1]
}

// DebugM2MToken is a development helper to debug M2M token claims
// DO NOT use in production - logs sensitive token information
func (m *M2MAuthMiddleware) DebugM2MToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := extractBearerToken(r)
		if token != "" {
			claims, err := m.authMiddleware.validateToken(r)
			if err != nil {
				slog.Debug("debug: token validation failed", "error", err)
			} else {
				slog.Debug("debug: token claims",
					"subject", claims.Subject,
					"issuer", claims.Issuer,
					"audience", claims.Audience,
					"metadata", claims.Metadata,
					"public_metadata", claims.PublicMetadata,
					"is_m2m", isM2MToken(claims),
				)
			}
		}
		next.ServeHTTP(w, r)
	})
}

// Example usage in main.go:
//
// // Initialize M2M auth middleware
// m2mAuth := custommw.NewM2MAuthMiddleware(cfg.JWT.JWKSUrl, cfg.JWT.Issuer)
//
// // External API routes (M2M only)
// r.Route("/api/v1/external", func(r chi.Router) {
//     r.Use(m2mAuth.RequireM2M)
//     r.Use(m2mAuth.LoggingMiddleware)
//     r.Use(rateLimiter.M2MMiddleware) // M2M-specific rate limiting
//
//     r.Get("/zmanim/publishers", h.ListPublishersExternal)
//     r.Post("/zmanim/calculate", h.CalculateZmanimBulk)
// })
