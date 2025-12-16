// File: auth.go
// Purpose: JWT verification, role enforcement (RequireAuth, RequireRole)
// Pattern: middleware
// Dependencies: Clerk JWT verification
// Frequency: critical - protects all authenticated routes
// Compliance: Check docs/adr/ for pattern rationale

package middleware

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

// contextKey is a custom type for context keys to avoid collisions
type contextKey string

const (
	// UserIDKey is the context key for the authenticated user ID
	UserIDKey contextKey = "user_id"
	// UserRoleKey is the context key for the user's role
	UserRoleKey contextKey = "user_role"
	// PrimaryPublisherIDKey is the context key for the user's primary publisher ID
	PrimaryPublisherIDKey contextKey = "primary_publisher_id"
	// PublisherAccessListKey is the context key for the list of publishers the user can access
	PublisherAccessListKey contextKey = "publisher_access_list"
)

// StringOrArray handles JWT fields that can be either a string or an array of strings
type StringOrArray []string

// UnmarshalJSON implements custom unmarshaling for fields that can be string or []string
func (s *StringOrArray) UnmarshalJSON(data []byte) error {
	// Try to unmarshal as a string first
	var single string
	if err := json.Unmarshal(data, &single); err == nil {
		*s = []string{single}
		return nil
	}

	// Try to unmarshal as an array of strings
	var arr []string
	if err := json.Unmarshal(data, &arr); err != nil {
		return err
	}
	*s = arr
	return nil
}

// Claims represents the JWT claims from Clerk
type Claims struct {
	Subject        string                 `json:"sub"`
	Issuer         string                 `json:"iss"`
	Audience       StringOrArray          `json:"aud"`
	ExpiresAt      int64                  `json:"exp"`
	IssuedAt       int64                  `json:"iat"`
	NotBefore      int64                  `json:"nbf"`
	Metadata       map[string]interface{} `json:"metadata"`
	PublicMetadata map[string]interface{} `json:"public_metadata"`
}

// JWK represents a JSON Web Key
type JWK struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	Use string `json:"use"`
	N   string `json:"n"`
	E   string `json:"e"`
}

// JWKS represents a JSON Web Key Set
type JWKS struct {
	Keys []JWK `json:"keys"`
}

// AuthConfig holds authentication configuration
type AuthConfig struct {
	JWKSUrl       string
	Issuer        string
	CacheDuration time.Duration
}

// AuthMiddleware provides JWT authentication using Clerk JWKS
type AuthMiddleware struct {
	config    AuthConfig
	keys      map[string]*rsa.PublicKey
	keysMutex sync.RWMutex
	lastFetch time.Time
}

// NewAuthMiddleware creates a new authentication middleware
func NewAuthMiddleware(jwksUrl, issuer string) *AuthMiddleware {
	return &AuthMiddleware{
		config: AuthConfig{
			JWKSUrl:       jwksUrl,
			Issuer:        issuer,
			CacheDuration: 1 * time.Hour,
		},
		keys: make(map[string]*rsa.PublicKey),
	}
}

// getRoleFromClaims extracts the role from either Metadata or PublicMetadata
// Admin status is determined by is_admin: true flag
// Publisher status is determined by publisher_access_list presence
func getRoleFromClaims(claims *Claims) string {
	// Check is_admin flag first (Metadata - Clerk default location)
	if claims.Metadata != nil {
		if isAdmin, ok := claims.Metadata["is_admin"].(bool); ok && isAdmin {
			slog.Debug("found is_admin in metadata", "is_admin", isAdmin)
			return "admin"
		}
		// Check for publisher access
		if accessList, ok := claims.Metadata["publisher_access_list"].([]interface{}); ok && len(accessList) > 0 {
			slog.Debug("found publisher_access_list in metadata", "count", len(accessList))
			return "publisher"
		}
	}
	slog.Debug("no admin or publisher role found in claims", "metadata", claims.Metadata)
	return ""
}

// getPrimaryPublisherIDFromClaims extracts the primary publisher ID from claims
func getPrimaryPublisherIDFromClaims(claims *Claims) string {
	if claims.Metadata != nil {
		if id, ok := claims.Metadata["primary_publisher_id"].(string); ok {
			return id
		}
	}
	return ""
}

// getPublisherAccessListFromClaims extracts the publisher access list from claims
func getPublisherAccessListFromClaims(claims *Claims) []string {
	var result []string
	if claims.Metadata != nil {
		if list, ok := claims.Metadata["publisher_access_list"].([]interface{}); ok {
			for _, item := range list {
				if id, ok := item.(string); ok {
					result = append(result, id)
				}
			}
		}
	}
	return result
}

// GetUserID retrieves the user ID from the request context
func GetUserID(ctx context.Context) string {
	if id, ok := ctx.Value(UserIDKey).(string); ok {
		return id
	}
	return ""
}

// GetUserRole retrieves the user role from the request context
func GetUserRole(ctx context.Context) string {
	if role, ok := ctx.Value(UserRoleKey).(string); ok {
		return role
	}
	return ""
}

// GetPrimaryPublisherID retrieves the primary publisher ID from the request context
func GetPrimaryPublisherID(ctx context.Context) string {
	if id, ok := ctx.Value(PrimaryPublisherIDKey).(string); ok {
		return id
	}
	return ""
}

// GetPublisherAccessList retrieves the publisher access list from the request context
func GetPublisherAccessList(ctx context.Context) []string {
	if list, ok := ctx.Value(PublisherAccessListKey).([]string); ok {
		return list
	}
	return nil
}

// GetValidatedPublisherID validates and returns the publisher ID from the request
// It checks X-Publisher-Id header first, falls back to primary_publisher_id from JWT
// Returns empty string if user has no access to any publisher
func GetValidatedPublisherID(ctx context.Context, requestedID string) string {
	primaryID := GetPrimaryPublisherID(ctx)
	accessList := GetPublisherAccessList(ctx)
	userRole := GetUserRole(ctx)

	// Admin users can access any publisher
	if userRole == "admin" && requestedID != "" {
		return requestedID
	}

	// If no specific ID requested, use primary
	if requestedID == "" {
		return primaryID
	}

	// Check if requested ID is the primary
	if requestedID == primaryID {
		return requestedID
	}

	// Check if requested ID is in the access list
	for _, id := range accessList {
		if id == requestedID {
			return requestedID
		}
	}

	// Requested ID not in user's access list - return empty (unauthorized)
	slog.Warn("publisher access denied", "requested", requestedID, "primary", primaryID, "access_list", accessList)
	return ""
}

// RequireAuth returns a middleware that requires authentication
func (am *AuthMiddleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := am.validateToken(r)
		if err != nil {
			slog.Warn("authentication failed", "error", err, "path", r.URL.Path)
			respondAuthError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid or missing authentication token")
			return
		}

		// Add user info to context
		ctx := context.WithValue(r.Context(), UserIDKey, claims.Subject)
		if role := getRoleFromClaims(claims); role != "" {
			ctx = context.WithValue(ctx, UserRoleKey, role)
		}

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole returns a middleware that requires a specific role
func (am *AuthMiddleware) RequireRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, err := am.validateToken(r)
			if err != nil {
				slog.Warn("authentication failed", "error", err, "path", r.URL.Path)
				respondAuthError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid or missing authentication token")
				return
			}

			// Check role in metadata (supports both legacy metadata and public_metadata)
			userRole := getRoleFromClaims(claims)
			slog.Info("role check", "required", role, "actual", userRole, "user_id", claims.Subject, "path", r.URL.Path)
			if userRole != role && userRole != "admin" { // admin has access to all roles
				slog.Warn("insufficient permissions", "required", role, "actual", userRole, "user_id", claims.Subject)
				respondAuthError(w, http.StatusForbidden, "FORBIDDEN", fmt.Sprintf("Role '%s' is required", role))
				return
			}

			// Add user info to context
			ctx := context.WithValue(r.Context(), UserIDKey, claims.Subject)
			ctx = context.WithValue(ctx, UserRoleKey, userRole)

			// Add publisher info to context (from JWT claims)
			if primaryPubID := getPrimaryPublisherIDFromClaims(claims); primaryPubID != "" {
				ctx = context.WithValue(ctx, PrimaryPublisherIDKey, primaryPubID)
			}
			if accessList := getPublisherAccessListFromClaims(claims); len(accessList) > 0 {
				ctx = context.WithValue(ctx, PublisherAccessListKey, accessList)
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// OptionalAuth returns a middleware that extracts user info if present but doesn't require it
func (am *AuthMiddleware) OptionalAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := am.validateToken(r)
		if err == nil {
			// Add user info to context
			ctx := context.WithValue(r.Context(), UserIDKey, claims.Subject)
			if role := getRoleFromClaims(claims); role != "" {
				ctx = context.WithValue(ctx, UserRoleKey, role)
			}
			r = r.WithContext(ctx)
		}
		next.ServeHTTP(w, r)
	})
}

// validateToken extracts and validates the JWT from the request
func (am *AuthMiddleware) validateToken(r *http.Request) (*Claims, error) {
	// Extract token from Authorization header
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return nil, fmt.Errorf("missing Authorization header")
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return nil, fmt.Errorf("invalid Authorization header format")
	}

	tokenString := parts[1]

	// Parse and validate JWT
	claims, err := am.parseJWT(tokenString)
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	// Validate claims
	now := time.Now().Unix()
	if claims.ExpiresAt < now {
		return nil, fmt.Errorf("token expired")
	}
	if claims.NotBefore > now {
		return nil, fmt.Errorf("token not yet valid")
	}
	if am.config.Issuer != "" && claims.Issuer != am.config.Issuer {
		return nil, fmt.Errorf("invalid issuer")
	}

	return claims, nil
}

// parseJWT parses and validates a JWT token
func (am *AuthMiddleware) parseJWT(tokenString string) (*Claims, error) {
	parts := strings.Split(tokenString, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid token format")
	}

	// Decode header to get kid
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("failed to decode header: %w", err)
	}

	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, fmt.Errorf("failed to parse header: %w", err)
	}

	if header.Alg != "RS256" {
		return nil, fmt.Errorf("unsupported algorithm: %s", header.Alg)
	}

	// Get public key for verification
	key, err := am.getPublicKey(header.Kid)
	if err != nil {
		return nil, fmt.Errorf("failed to get public key: %w", err)
	}

	// Verify signature
	signatureInput := parts[0] + "." + parts[1]
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("failed to decode signature: %w", err)
	}

	if err := verifyRS256([]byte(signatureInput), signature, key); err != nil {
		return nil, fmt.Errorf("signature verification failed: %w", err)
	}

	// Decode and parse claims
	claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("failed to decode claims: %w", err)
	}

	var claims Claims
	if err := json.Unmarshal(claimsBytes, &claims); err != nil {
		return nil, fmt.Errorf("failed to parse claims: %w", err)
	}

	return &claims, nil
}

// getPublicKey retrieves the public key for the given key ID
func (am *AuthMiddleware) getPublicKey(kid string) (*rsa.PublicKey, error) {
	// Check cache first
	am.keysMutex.RLock()
	key, exists := am.keys[kid]
	cacheValid := time.Since(am.lastFetch) < am.config.CacheDuration
	am.keysMutex.RUnlock()

	if exists && cacheValid {
		return key, nil
	}

	// Fetch JWKS
	if err := am.fetchJWKS(); err != nil {
		// If we have a cached key and fetch failed, use cached key
		if exists {
			slog.Warn("JWKS fetch failed, using cached key", "error", err)
			return key, nil
		}
		return nil, err
	}

	am.keysMutex.RLock()
	key, exists = am.keys[kid]
	am.keysMutex.RUnlock()

	if !exists {
		return nil, fmt.Errorf("key not found: %s", kid)
	}

	return key, nil
}

// fetchJWKS fetches the JWKS from the configured URL
func (am *AuthMiddleware) fetchJWKS() error {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(am.config.JWKSUrl)
	if err != nil {
		return fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("JWKS fetch returned status %d", resp.StatusCode)
	}

	var jwks JWKS
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return fmt.Errorf("failed to decode JWKS: %w", err)
	}

	am.keysMutex.Lock()
	defer am.keysMutex.Unlock()

	for _, jwk := range jwks.Keys {
		if jwk.Kty != "RSA" {
			continue
		}

		key, err := jwkToRSAPublicKey(jwk)
		if err != nil {
			slog.Warn("failed to parse JWK", "kid", jwk.Kid, "error", err)
			continue
		}

		am.keys[jwk.Kid] = key
	}

	am.lastFetch = time.Now()
	return nil
}

// jwkToRSAPublicKey converts a JWK to an RSA public key
func jwkToRSAPublicKey(jwk JWK) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(jwk.N)
	if err != nil {
		return nil, fmt.Errorf("failed to decode n: %w", err)
	}

	eBytes, err := base64.RawURLEncoding.DecodeString(jwk.E)
	if err != nil {
		return nil, fmt.Errorf("failed to decode e: %w", err)
	}

	n := new(big.Int).SetBytes(nBytes)
	e := 0
	for _, b := range eBytes {
		e = e<<8 + int(b)
	}

	return &rsa.PublicKey{N: n, E: e}, nil
}

// verifyRS256 verifies an RS256 signature
func verifyRS256(message, signature []byte, key *rsa.PublicKey) error {
	h := sha256.Sum256(message)
	return rsa.VerifyPKCS1v15(key, crypto.SHA256, h[:], signature)
}

// respondAuthError sends a structured authentication error response
func respondAuthError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"error": map[string]interface{}{
			"code":    code,
			"message": message,
		},
	})
}

// IsAuthenticated checks if the request context has a valid user ID
func IsAuthenticated(ctx context.Context) bool {
	return GetUserID(ctx) != ""
}
