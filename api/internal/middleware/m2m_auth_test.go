// File: m2m_auth_test.go
// Purpose: Unit tests for M2M authentication middleware
// Pattern: test
// Dependencies: testing, httptest

package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestGetClientID tests retrieving client ID from context
func TestGetClientID(t *testing.T) {
	tests := []struct {
		name     string
		ctx      context.Context
		expected string
	}{
		{
			name:     "client ID present",
			ctx:      context.WithValue(context.Background(), ClientIDKey, "client_123"),
			expected: "client_123",
		},
		{
			name:     "client ID not present",
			ctx:      context.Background(),
			expected: "",
		},
		{
			name:     "wrong type in context",
			ctx:      context.WithValue(context.Background(), ClientIDKey, 12345),
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetClientID(tt.ctx)
			if result != tt.expected {
				t.Errorf("GetClientID() = %v, want %v", result, tt.expected)
			}
		})
	}
}

// TestGetAzp tests retrieving azp claim from context
func TestGetAzp(t *testing.T) {
	tests := []struct {
		name     string
		ctx      context.Context
		expected string
	}{
		{
			name:     "azp present",
			ctx:      context.WithValue(context.Background(), AzpKey, "azp_123"),
			expected: "azp_123",
		},
		{
			name:     "azp not present",
			ctx:      context.Background(),
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetAzp(tt.ctx)
			if result != tt.expected {
				t.Errorf("GetAzp() = %v, want %v", result, tt.expected)
			}
		})
	}
}

// TestIsM2MToken tests M2M token detection logic
func TestIsM2MToken(t *testing.T) {
	tests := []struct {
		name     string
		claims   *Claims
		expected bool
	}{
		{
			name: "M2M token - no metadata",
			claims: &Claims{
				Subject:        "client_abc123",
				Issuer:         "https://clerk.example.com",
				Metadata:       nil,
				PublicMetadata: nil,
			},
			expected: true,
		},
		{
			name: "M2M token - empty metadata",
			claims: &Claims{
				Subject:        "m2m_client_xyz",
				Issuer:         "https://clerk.example.com",
				Metadata:       map[string]interface{}{},
				PublicMetadata: map[string]interface{}{},
			},
			expected: true,
		},
		{
			name: "User token - starts with user_",
			claims: &Claims{
				Subject:        "user_abc123",
				Issuer:         "https://clerk.example.com",
				Metadata:       nil,
				PublicMetadata: nil,
			},
			expected: false,
		},
		{
			name: "User token - has role metadata",
			claims: &Claims{
				Subject: "some_subject",
				Issuer:  "https://clerk.example.com",
				Metadata: map[string]interface{}{
					"role": "publisher",
				},
				PublicMetadata: nil,
			},
			expected: false,
		},
		{
			name: "User token - has publisher metadata",
			claims: &Claims{
				Subject: "some_subject",
				Issuer:  "https://clerk.example.com",
				Metadata: map[string]interface{}{
					"primary_publisher_id": "123",
				},
				PublicMetadata: nil,
			},
			expected: false,
		},
		{
			name: "M2M token - non-user subject with unrelated metadata",
			claims: &Claims{
				Subject: "client_service_123",
				Issuer:  "https://clerk.example.com",
				Metadata: map[string]interface{}{
					"custom_field": "value",
				},
				PublicMetadata: nil,
			},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isM2MToken(tt.claims)
			if result != tt.expected {
				t.Errorf("isM2MToken() = %v, want %v for claims: %+v", result, tt.expected, tt.claims)
			}
		})
	}
}

// TestExtractClientID tests client ID extraction from claims
func TestExtractClientID(t *testing.T) {
	tests := []struct {
		name     string
		claims   *Claims
		expected string
	}{
		{
			name: "standard M2M token",
			claims: &Claims{
				Subject: "client_abc123",
			},
			expected: "client_abc123",
		},
		{
			name: "empty subject",
			claims: &Claims{
				Subject: "",
			},
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractClientID(tt.claims)
			if result != tt.expected {
				t.Errorf("extractClientID() = %v, want %v", result, tt.expected)
			}
		})
	}
}

// TestExtractBearerToken tests bearer token extraction from request
func TestExtractBearerToken(t *testing.T) {
	tests := []struct {
		name     string
		header   string
		expected string
	}{
		{
			name:     "valid bearer token",
			header:   "Bearer abc123xyz",
			expected: "abc123xyz",
		},
		{
			name:     "lowercase bearer",
			header:   "bearer abc123xyz",
			expected: "abc123xyz",
		},
		{
			name:     "missing token",
			header:   "",
			expected: "",
		},
		{
			name:     "invalid format - no space",
			header:   "Bearerabc123xyz",
			expected: "",
		},
		{
			name:     "invalid format - wrong prefix",
			header:   "Basic abc123xyz",
			expected: "",
		},
		{
			name:     "bearer with spaces in token",
			header:   "Bearer abc 123 xyz",
			expected: "abc 123 xyz",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			if tt.header != "" {
				req.Header.Set("Authorization", tt.header)
			}

			result := extractBearerToken(req)
			if result != tt.expected {
				t.Errorf("extractBearerToken() = %v, want %v", result, tt.expected)
			}
		})
	}
}

// TestM2MAuthMiddleware_MissingToken tests middleware with missing token
func TestM2MAuthMiddleware_MissingToken(t *testing.T) {
	m2m := NewM2MAuthMiddleware("https://example.com/.well-known/jwks.json", "https://example.com")

	handler := m2m.RequireM2M(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/external/test", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusUnauthorized)
	}
}

// TestM2MAuthMiddleware_InvalidToken tests middleware with invalid token format
func TestM2MAuthMiddleware_InvalidToken(t *testing.T) {
	m2m := NewM2MAuthMiddleware("https://example.com/.well-known/jwks.json", "https://example.com")

	handler := m2m.RequireM2M(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/external/test", nil)
	req.Header.Set("Authorization", "Bearer invalid.token.format")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusUnauthorized)
	}
}

// TestM2MAuthMiddleware_OptionalM2M tests optional M2M middleware
func TestM2MAuthMiddleware_OptionalM2M(t *testing.T) {
	m2m := NewM2MAuthMiddleware("https://example.com/.well-known/jwks.json", "https://example.com")

	handler := m2m.OptionalM2M(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clientID := GetClientID(r.Context())
		if clientID != "" {
			w.Header().Set("X-Client-ID", clientID)
		}
		w.WriteHeader(http.StatusOK)
	}))

	// Test without token - should succeed
	req := httptest.NewRequest("GET", "/test", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	if clientID := rr.Header().Get("X-Client-ID"); clientID != "" {
		t.Errorf("expected no client ID, got %v", clientID)
	}
}

// TestM2MAuthMiddleware_LoggingMiddleware tests logging middleware
func TestM2MAuthMiddleware_LoggingMiddleware(t *testing.T) {
	m2m := NewM2MAuthMiddleware("https://example.com/.well-known/jwks.json", "https://example.com")

	handler := m2m.LoggingMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Test with client ID in context
	req := httptest.NewRequest("GET", "/test", nil)
	ctx := context.WithValue(req.Context(), ClientIDKey, "test_client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}
}

// BenchmarkIsM2MToken benchmarks the M2M token detection
func BenchmarkIsM2MToken(b *testing.B) {
	claims := &Claims{
		Subject: "client_abc123",
		Issuer:  "https://clerk.example.com",
		Metadata: map[string]interface{}{
			"custom": "value",
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = isM2MToken(claims)
	}
}

// BenchmarkExtractBearerToken benchmarks bearer token extraction
func BenchmarkExtractBearerToken(b *testing.B) {
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbGllbnRfMTIzIn0.signature")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = extractBearerToken(req)
	}
}
