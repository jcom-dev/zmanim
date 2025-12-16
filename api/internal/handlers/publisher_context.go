// File: publisher_context.go
// Purpose: Publisher resolver - extracts publisher ID from X-Publisher-Id header with auth
// Pattern: publisher-resolver
// Dependencies: middleware.GetUserID, Clerk metadata
// Frequency: high - used by 11 handler files
// Compliance: Check docs/adr/ for pattern rationale

package handlers

import (
	"context"
	"fmt"
	"net/http"

	"github.com/jcom-dev/zmanim/internal/db"
	"github.com/jcom-dev/zmanim/internal/middleware"
)

// PublisherContext contains resolved publisher information for a request
type PublisherContext struct {
	PublisherID string
	UserID      string
	UserRole    string
	IsAdmin     bool
}

// PublisherResolver resolves publisher context from HTTP requests
// It consolidates the repeated pattern of:
// 1. Check X-Publisher-Id header
// 2. Check publisher_id query param
// 3. Query database by clerk_user_id
type PublisherResolver struct {
	db *db.DB
}

// NewPublisherResolver creates a new PublisherResolver
func NewPublisherResolver(database *db.DB) *PublisherResolver {
	return &PublisherResolver{db: database}
}

// Resolve extracts and resolves publisher context from a request
// Returns PublisherContext if successful, or an error if publisher cannot be resolved
// SECURITY: Validates X-Publisher-Id against JWT claims to prevent tenant isolation attacks
func (pr *PublisherResolver) Resolve(ctx context.Context, r *http.Request) (*PublisherContext, error) {
	userID := middleware.GetUserID(ctx)
	userRole := middleware.GetUserRole(ctx)
	isAdmin := userRole == "admin"

	pc := &PublisherContext{
		UserID:   userID,
		UserRole: userRole,
		IsAdmin:  isAdmin,
	}

	// 1. Try X-Publisher-Id header first
	requestedID := r.Header.Get("X-Publisher-Id")
	if requestedID == "" {
		// 2. Try publisher_id query parameter
		requestedID = r.URL.Query().Get("publisher_id")
	}

	// SECURITY CRITICAL: Validate requested ID against JWT claims
	if requestedID != "" {
		validatedID := middleware.GetValidatedPublisherID(ctx, requestedID)
		if validatedID == "" {
			// User requested a publisher they don't have access to
			return nil, fmt.Errorf("access denied to publisher %s", requestedID)
		}
		pc.PublisherID = validatedID
		return pc, nil
	}

	// 3. No requested ID - fall back to database lookup by clerk_user_id
	if userID == "" {
		return nil, fmt.Errorf("no user ID in context")
	}

	publisherIDInt, err := pr.db.Queries.GetPublisherByClerkUserID(ctx, &userID)
	if err != nil {
		return nil, fmt.Errorf("publisher not found for user %s: %w", userID, err)
	}

	pc.PublisherID = int32ToString(publisherIDInt)
	return pc, nil
}

// MustResolve resolves publisher context and writes error response if resolution fails
// Returns nil if an error response was written (caller should return early)
// Returns PublisherContext if successful
func (pr *PublisherResolver) MustResolve(w http.ResponseWriter, r *http.Request) *PublisherContext {
	ctx := r.Context()

	// First check if user is authenticated
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		RespondUnauthorized(w, r, "User ID not found in context")
		return nil
	}

	pc, err := pr.Resolve(ctx, r)
	if err != nil {
		RespondNotFound(w, r, "Publisher not found")
		return nil
	}

	return pc
}

// MustResolveWithUserCheck resolves publisher context with a user authentication check
// This is the most common pattern - check auth first, then resolve publisher
func (pr *PublisherResolver) MustResolveWithUserCheck(w http.ResponseWriter, r *http.Request) *PublisherContext {
	return pr.MustResolve(w, r)
}

// ResolveOptional attempts to resolve publisher context but doesn't fail if not found
// Useful for endpoints that can work with or without a publisher context
// SECURITY: Validates X-Publisher-Id against JWT claims even in optional mode
func (pr *PublisherResolver) ResolveOptional(ctx context.Context, r *http.Request) *PublisherContext {
	userID := middleware.GetUserID(ctx)
	userRole := middleware.GetUserRole(ctx)

	pc := &PublisherContext{
		UserID:   userID,
		UserRole: userRole,
		IsAdmin:  userRole == "admin",
	}

	// 1. Try X-Publisher-Id header first
	requestedID := r.Header.Get("X-Publisher-Id")
	if requestedID == "" {
		// 2. Try publisher_id query parameter
		requestedID = r.URL.Query().Get("publisher_id")
	}

	// SECURITY CRITICAL: Validate requested ID against JWT claims
	if requestedID != "" {
		validatedID := middleware.GetValidatedPublisherID(ctx, requestedID)
		if validatedID != "" {
			pc.PublisherID = validatedID
			return pc
		}
		// Invalid access - return context without publisher ID (will fail authorization later)
		return pc
	}

	// 3. Try database lookup if we have DB connection and user ID
	if pr != nil && pr.db != nil && userID != "" {
		publisherIDInt, err := pr.db.Queries.GetPublisherByClerkUserID(ctx, &userID)
		if err == nil {
			pc.PublisherID = int32ToString(publisherIDInt)
		}
	}

	return pc
}

// GetPublisherIDFromRequest is a helper that just returns the publisher ID string
// This is useful for simple cases where you don't need the full context
func (pr *PublisherResolver) GetPublisherIDFromRequest(ctx context.Context, r *http.Request) (string, error) {
	pc, err := pr.Resolve(ctx, r)
	if err != nil {
		return "", err
	}
	return pc.PublisherID, nil
}
