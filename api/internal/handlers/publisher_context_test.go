package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jcom-dev/zmanim/internal/middleware"
)

// mockDB implements a minimal interface for testing
// In real tests, you'd use a test database or more sophisticated mocking
type mockPublisherDB struct {
	publisherID string
	shouldError bool
}

func TestPublisherResolver_Resolve_FromHeader(t *testing.T) {
	resolver := &PublisherResolver{db: nil} // DB not needed for header resolution

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Publisher-Id", "pub-123")

	// Add user context with publisher access (for JWT validation)
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-456")
	ctx = context.WithValue(ctx, middleware.UserRoleKey, "publisher")
	ctx = context.WithValue(ctx, middleware.PrimaryPublisherIDKey, "pub-123") // JWT claim
	req = req.WithContext(ctx)

	pc, err := resolver.Resolve(req.Context(), req)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if pc.PublisherID != "pub-123" {
		t.Errorf("expected PublisherID 'pub-123', got '%s'", pc.PublisherID)
	}
	if pc.UserID != "user-456" {
		t.Errorf("expected UserID 'user-456', got '%s'", pc.UserID)
	}
	if pc.UserRole != "publisher" {
		t.Errorf("expected UserRole 'publisher', got '%s'", pc.UserRole)
	}
	if pc.IsAdmin {
		t.Error("expected IsAdmin to be false")
	}
}

func TestPublisherResolver_Resolve_FromQueryParam(t *testing.T) {
	resolver := &PublisherResolver{db: nil}

	req := httptest.NewRequest(http.MethodGet, "/test?publisher_id=pub-789", nil)

	// Add user context with publisher access (for JWT validation)
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-456")
	ctx = context.WithValue(ctx, middleware.UserRoleKey, "publisher")
	ctx = context.WithValue(ctx, middleware.PrimaryPublisherIDKey, "pub-789") // JWT claim
	req = req.WithContext(ctx)

	pc, err := resolver.Resolve(req.Context(), req)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if pc.PublisherID != "pub-789" {
		t.Errorf("expected PublisherID 'pub-789', got '%s'", pc.PublisherID)
	}
}

func TestPublisherResolver_Resolve_HeaderTakesPrecedence(t *testing.T) {
	resolver := &PublisherResolver{db: nil}

	req := httptest.NewRequest(http.MethodGet, "/test?publisher_id=query-pub", nil)
	req.Header.Set("X-Publisher-Id", "header-pub")

	// Add user context with publisher access (for JWT validation)
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-456")
	ctx = context.WithValue(ctx, middleware.UserRoleKey, "publisher")
	ctx = context.WithValue(ctx, middleware.PrimaryPublisherIDKey, "header-pub") // JWT claim
	req = req.WithContext(ctx)

	pc, err := resolver.Resolve(req.Context(), req)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Header should take precedence over query param
	if pc.PublisherID != "header-pub" {
		t.Errorf("expected PublisherID 'header-pub' (from header), got '%s'", pc.PublisherID)
	}
}

func TestPublisherResolver_Resolve_AdminRole(t *testing.T) {
	resolver := &PublisherResolver{db: nil}

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Publisher-Id", "pub-123")

	// Set admin role
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "admin-user")
	ctx = context.WithValue(ctx, middleware.UserRoleKey, "admin")
	req = req.WithContext(ctx)

	pc, err := resolver.Resolve(req.Context(), req)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !pc.IsAdmin {
		t.Error("expected IsAdmin to be true for admin role")
	}
	if pc.UserRole != "admin" {
		t.Errorf("expected UserRole 'admin', got '%s'", pc.UserRole)
	}
}

func TestPublisherResolver_Resolve_NoUserID(t *testing.T) {
	resolver := &PublisherResolver{db: nil}

	// Request without X-Publisher-Id header, query param, or user context
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	_, err := resolver.Resolve(req.Context(), req)

	if err == nil {
		t.Error("expected error when no publisher ID source available")
	}
}

func TestPublisherResolver_MustResolve_Success(t *testing.T) {
	resolver := &PublisherResolver{db: nil}

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Publisher-Id", "pub-123")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-456")
	ctx = context.WithValue(ctx, middleware.UserRoleKey, "publisher")
	ctx = context.WithValue(ctx, middleware.PrimaryPublisherIDKey, "pub-123") // JWT claim
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()

	pc := resolver.MustResolve(w, req)

	if pc == nil {
		t.Fatal("expected non-nil PublisherContext")
	}
	if pc.PublisherID != "pub-123" {
		t.Errorf("expected PublisherID 'pub-123', got '%s'", pc.PublisherID)
	}
	// Response should not have been written
	if w.Code != http.StatusOK {
		t.Errorf("expected no response written (status 200), got %d", w.Code)
	}
}

func TestPublisherResolver_MustResolve_NoAuth(t *testing.T) {
	resolver := &PublisherResolver{db: nil}

	// Request without user context
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Publisher-Id", "pub-123")

	w := httptest.NewRecorder()

	pc := resolver.MustResolve(w, req)

	if pc != nil {
		t.Error("expected nil PublisherContext when user not authenticated")
	}
	// Should have written unauthorized response
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", w.Code)
	}
}

func TestPublisherResolver_ResolveOptional_WithPublisher(t *testing.T) {
	resolver := &PublisherResolver{db: nil}

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Publisher-Id", "pub-123")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-456")
	ctx = context.WithValue(ctx, middleware.UserRoleKey, "publisher")
	ctx = context.WithValue(ctx, middleware.PrimaryPublisherIDKey, "pub-123") // JWT claim
	req = req.WithContext(ctx)

	pc := resolver.ResolveOptional(req.Context(), req)

	if pc.PublisherID != "pub-123" {
		t.Errorf("expected PublisherID 'pub-123', got '%s'", pc.PublisherID)
	}
}

func TestPublisherResolver_ResolveOptional_WithoutPublisher(t *testing.T) {
	resolver := &PublisherResolver{db: nil}

	// Request without publisher ID but with user context
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-456")
	ctx = context.WithValue(ctx, middleware.UserRoleKey, "user")
	req = req.WithContext(ctx)

	pc := resolver.ResolveOptional(req.Context(), req)

	// Should return partial context without publisher
	if pc.PublisherID != "" {
		t.Errorf("expected empty PublisherID, got '%s'", pc.PublisherID)
	}
	if pc.UserID != "user-456" {
		t.Errorf("expected UserID 'user-456', got '%s'", pc.UserID)
	}
}

// Benchmark tests
func BenchmarkPublisherResolver_Resolve_FromHeader(b *testing.B) {
	resolver := &PublisherResolver{db: nil}

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Publisher-Id", "pub-123")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-456")
	req = req.WithContext(ctx)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = resolver.Resolve(req.Context(), req)
	}
}
