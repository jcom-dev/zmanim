package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

const (
	invitationExpiryDays  = 7
	maxInvitationsPerHour = 10
)

// InviteUserRequest represents a request to invite a user
type InviteUserRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"` // "owner", "admin", "member"
}

// InvitationResponse represents an invitation in API responses
type InvitationResponse struct {
	ID                 int32     `json:"id"`
	Email              string    `json:"email"`
	Role               string    `json:"role"`
	RoleDisplayEnglish string    `json:"role_display_english"`
	Status             string    `json:"status"`
	InvitedBy          string    `json:"invited_by"`
	ExpiresAt          time.Time `json:"expires_at"`
	CreatedAt          time.Time `json:"created_at"`
	PublisherName      *string   `json:"publisher_name,omitempty"`
}

// AcceptInvitationRequest represents a request to accept an invitation
type AcceptInvitationRequest struct {
	Token string `json:"token"`
}

// InviteUser creates a new publisher invitation
// POST /auth/publisher/invite
// Security: MUST NOT reveal if email exists
// Security: Only publisher owner or admin can invite users
func (h *Handlers) InviteUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID

	// 2. Get inviter user ID from claims
	var inviterUserID string
	if claims, ok := r.Context().Value("claims").(map[string]interface{}); ok {
		if sub, ok := claims["sub"].(string); ok {
			inviterUserID = sub
		}
	}
	if inviterUserID == "" {
		RespondUnauthorized(w, r, "User ID not found in claims")
		return
	}

	// 2b. Security: Verify inviter is publisher owner or admin
	// Only owners (clerk_user_id) or system admins can invite new users
	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	ownerID, err := h.db.Queries.GetPublisherOwnerID(ctx, publisherIDInt)
	if err != nil {
		slog.Error("failed to get publisher owner", "error", err, "publisher_id", publisherID)
		RespondInternalError(w, r, "Failed to verify permissions")
		return
	}

	isOwner := ownerID != nil && *ownerID == inviterUserID
	if !isOwner && !pc.IsAdmin {
		slog.Warn("unauthorized invitation attempt",
			"user_id", inviterUserID,
			"publisher_id", publisherID,
			"is_admin", pc.IsAdmin)
		RespondForbidden(w, r, "Only publisher owners or admins can invite team members")
		return
	}

	// 3. Parse request body
	var req InviteUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// 4. Validate input
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" {
		RespondBadRequest(w, r, "Email is required")
		return
	}
	if !isValidEmail(req.Email) {
		RespondBadRequest(w, r, "Invalid email format")
		return
	}

	// Default role to "member" if not specified
	if req.Role == "" {
		req.Role = "member"
	}

	// Validate role
	validRoles := map[string]bool{"owner": true, "admin": true, "member": true}
	if !validRoles[req.Role] {
		RespondBadRequest(w, r, "Invalid role. Must be: owner, admin, or member")
		return
	}

	// 5. Rate limiting check - max 10 invitations per hour per publisher
	oneHourAgo := pgtype.Timestamptz{Time: time.Now().Add(-1 * time.Hour), Valid: true}

	count, err := h.db.Queries.CountRecentInvitationsByPublisher(ctx, sqlcgen.CountRecentInvitationsByPublisherParams{
		PublisherID: publisherIDInt,
		CreatedAt:   oneHourAgo,
	})
	if err != nil {
		slog.Error("error checking invitation rate limit", "error", err)
		RespondInternalError(w, r, "Failed to check rate limit")
		return
	}

	if count >= maxInvitationsPerHour {
		w.WriteHeader(http.StatusTooManyRequests)
		RespondJSON(w, r, http.StatusTooManyRequests, map[string]interface{}{
			"error": "Rate limit exceeded. Maximum 10 invitations per hour.",
		})
		return
	}

	// 6. Check if invitation already exists for this email
	existing, err := h.db.Queries.GetInvitationByPublisherAndEmail(ctx, sqlcgen.GetInvitationByPublisherAndEmailParams{
		PublisherID: publisherIDInt,
		Email:       req.Email,
	})

	if err != nil && err != pgx.ErrNoRows {
		slog.Error("error checking existing invitation", "error", err)
		RespondInternalError(w, r, "Failed to check existing invitation")
		return
	}

	// If pending invitation exists, return error (admin should resend instead)
	if err == nil && existing.Status != nil && *existing.Status == "pending" {
		RespondBadRequest(w, r, "A pending invitation already exists for this email. Use resend to send it again.")
		return
	}

	// 7. Get role ID from role key
	roleID, err := h.getRoleIDByKey(ctx, req.Role)
	if err != nil {
		slog.Error("error getting role ID", "error", err, "role", req.Role)
		RespondInternalError(w, r, "Failed to get role ID")
		return
	}

	// 8. Generate secure token
	token, err := generateInvitationToken()
	if err != nil {
		slog.Error("error generating token", "error", err)
		RespondInternalError(w, r, "Failed to generate invitation token")
		return
	}

	// 9. Create invitation
	expiresAt := pgtype.Timestamptz{Time: time.Now().Add(invitationExpiryDays * 24 * time.Hour), Valid: true}
	_, err = h.db.Queries.CreateInvitation(ctx, sqlcgen.CreateInvitationParams{
		PublisherID: publisherIDInt,
		Email:       req.Email,
		RoleID:      roleID,
		Token:       token,
		ExpiresAt:   expiresAt,
	})

	if err != nil {
		slog.Error("error creating invitation", "error", err)
		RespondInternalError(w, r, "Failed to create invitation")
		return
	}

	go h.sendInvitationEmail(req.Email, token, publisherID)

	// 11. Respond with success (ALWAYS same message - no user enumeration)
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Invitation sent to " + req.Email,
	})
}

// ListInvitations returns all invitations for a publisher
// GET /auth/publisher/invitations
func (h *Handlers) ListInvitations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID

	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// 2. Get all invitations
	invitations, err := h.db.Queries.ListAllInvitationsByPublisher(ctx, publisherIDInt)
	if err != nil {
		slog.Error("error listing invitations", "error", err)
		RespondInternalError(w, r, "Failed to list invitations")
		return
	}

	// 3. Map to response
	responses := make([]InvitationResponse, 0, len(invitations))
	for _, inv := range invitations {
		// Determine status based on expiry and status field
		status := "pending"
		if inv.Status != nil {
			status = *inv.Status
		}
		if status == "pending" && inv.ExpiresAt.Valid && inv.ExpiresAt.Time.Before(time.Now()) {
			status = "expired"
		}

		var createdAt time.Time
		if inv.CreatedAt.Valid {
			createdAt = inv.CreatedAt.Time
		}

		responses = append(responses, InvitationResponse{
			ID:                 inv.ID,
			Email:              inv.Email,
			Role:               inv.RoleKey,
			RoleDisplayEnglish: inv.RoleDisplayEnglish,
			Status:             status,
			InvitedBy:          inv.InvitedBy,
			ExpiresAt:          inv.ExpiresAt.Time,
			CreatedAt:          createdAt,
		})
	}

	RespondJSON(w, r, http.StatusOK, responses)
}

// CancelInvitation cancels a pending invitation
// DELETE /auth/publisher/invitations/{id}
func (h *Handlers) CancelInvitation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID

	// 2. Get invitation ID from URL
	idStr := chi.URLParam(r, "id")
	invitationID, err := stringToInt32(idStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid invitation ID")
		return
	}

	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// 3. Cancel invitation (sets status to 'cancelled')
	err = h.db.Queries.CancelInvitation(ctx, sqlcgen.CancelInvitationParams{
		ID:          invitationID,
		PublisherID: publisherIDInt,
	})

	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Invitation not found or already cancelled")
		return
	}

	if err != nil {
		slog.Error("error cancelling invitation", "error", err)
		RespondInternalError(w, r, "Failed to cancel invitation")
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Invitation cancelled successfully",
	})
}

// ResendInvitation resends an invitation with a new token
// POST /auth/publisher/invitations/{id}/resend
func (h *Handlers) ResendInvitation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID

	// 2. Get invitation ID from URL
	idStr := chi.URLParam(r, "id")
	invitationID, err := stringToInt32(idStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid invitation ID")
		return
	}

	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// 3. Get existing invitation
	existing, err := h.db.Queries.GetInvitationByIDWithStatus(ctx, invitationID)
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Invitation not found")
		return
	}
	if err != nil {
		slog.Error("error getting invitation", "error", err)
		RespondInternalError(w, r, "Failed to get invitation")
		return
	}

	// Verify it belongs to this publisher
	if existing.PublisherID != publisherIDInt {
		RespondForbidden(w, r, "Invitation does not belong to this publisher")
		return
	}

	// Can only resend pending or expired invitations
	existingStatus := "pending"
	if existing.Status != nil {
		existingStatus = *existing.Status
	}
	if existingStatus != "pending" && existingStatus != "expired" {
		RespondBadRequest(w, r, "Can only resend pending or expired invitations")
		return
	}

	// 4. Generate new token
	newToken, err := generateInvitationToken()
	if err != nil {
		slog.Error("error generating token", "error", err)
		RespondInternalError(w, r, "Failed to generate token")
		return
	}

	// 5. Update invitation with new token and expiry
	newExpiresAt := pgtype.Timestamptz{Time: time.Now().Add(invitationExpiryDays * 24 * time.Hour), Valid: true}
	_, err = h.db.Queries.ResendInvitationUpdateToken(ctx, sqlcgen.ResendInvitationUpdateTokenParams{
		ID:          invitationID,
		PublisherID: publisherIDInt,
		Token:       newToken,
		ExpiresAt:   newExpiresAt,
	})

	if err != nil {
		slog.Error("error updating invitation token", "error", err)
		RespondInternalError(w, r, "Failed to update invitation")
		return
	}

	// 6. Resend email
	go h.sendInvitationEmail(existing.Email, newToken, publisherID)

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Invitation resent to " + existing.Email,
	})
}

// AcceptInvitation accepts a publisher invitation (PUBLIC endpoint)
// POST /public/invitations/{token}/accept
func (h *Handlers) AcceptInvitation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Get token from URL
	token := chi.URLParam(r, "token")
	if token == "" {
		RespondBadRequest(w, r, "Token is required")
		return
	}

	// 2. Get invitation by token
	invitation, err := h.db.Queries.GetInvitationByToken(ctx, token)
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Invitation not found or expired")
		return
	}
	if err != nil {
		slog.Error("error getting invitation by token", "error", err)
		RespondInternalError(w, r, "Failed to get invitation")
		return
	}

	// 3. Check if invitation is valid (check expiry since GetInvitationByToken already filters active invitations)
	if invitation.ExpiresAt.Valid && invitation.ExpiresAt.Time.Before(time.Now()) {
		w.WriteHeader(http.StatusGone)
		RespondJSON(w, r, http.StatusGone, map[string]interface{}{
			"error": "Invitation has expired",
		})
		return
	}

	// 4. Get user ID from claims (if authenticated)
	var userID *string
	if claims, ok := r.Context().Value("claims").(map[string]interface{}); ok {
		if sub, ok := claims["sub"].(string); ok {
			userID = &sub
		}
	}

	// If not authenticated, return error (user must be authenticated to accept)
	if userID == nil {
		RespondUnauthorized(w, r, "You must be logged in to accept an invitation")
		return
	}

	// Mark invitation as accepted
	acceptedStatus := "accepted"
	_, err = h.db.Queries.UpdateInvitationStatus(ctx, sqlcgen.UpdateInvitationStatusParams{
		ID:     invitation.ID,
		Status: &acceptedStatus,
	})

	if err != nil {
		slog.Error("error updating invitation status", "error", err)
		RespondInternalError(w, r, "Failed to accept invitation")
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success":        true,
		"message":        "Invitation accepted successfully",
		"publisher_id":   invitation.PublisherID,
		"publisher_name": invitation.PublisherName,
	})
}

// GetInvitationInfo returns invitation details by token (PUBLIC endpoint)
// GET /public/invitations/{token}
func (h *Handlers) GetInvitationInfo(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Get token from URL
	token := chi.URLParam(r, "token")
	if token == "" {
		RespondBadRequest(w, r, "Token is required")
		return
	}

	// 2. Get invitation by token
	invitation, err := h.db.Queries.GetInvitationByToken(ctx, token)
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Invitation not found")
		return
	}
	if err != nil {
		slog.Error("error getting invitation by token", "error", err)
		RespondInternalError(w, r, "Failed to get invitation")
		return
	}

	// 3. Determine status (GetInvitationByToken already filters for active invitations)
	status := "pending"
	if invitation.ExpiresAt.Valid && invitation.ExpiresAt.Time.Before(time.Now()) {
		status = "expired"
	}

	// 4. Return invitation info (safe for public)
	RespondJSON(w, r, http.StatusOK, InvitationResponse{
		ID:                 invitation.ID,
		Email:              invitation.Email,
		Role:               invitation.RoleKey,
		RoleDisplayEnglish: invitation.RoleDisplayEnglish,
		Status:             status,
		ExpiresAt:          invitation.ExpiresAt.Time,
		PublisherName:      &invitation.PublisherName,
	})
}

// Helper functions

// generateInvitationToken generates a cryptographically secure random token
func generateInvitationToken() (string, error) {
	bytes := make([]byte, 32) // 32 bytes = 256 bits
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// getRoleIDByKey gets the role ID from the publisher_roles lookup table
func (h *Handlers) getRoleIDByKey(ctx context.Context, roleKey string) (int16, error) {
	// Query the publisher_roles table for the role ID
	// For now, use a simple mapping (this should query the database)
	roleMap := map[string]int16{
		"owner":  1,
		"admin":  2,
		"member": 3,
	}

	if id, ok := roleMap[roleKey]; ok {
		return id, nil
	}

	return 0, fmt.Errorf("invalid role key: %s", roleKey)
}

// sendInvitationEmail sends the invitation email
// Story 8.31 - Secure User Invitation Flow
// Security: Checks if user exists in Clerk (server-side only) and sends appropriate template
// Never reveals to admin whether user exists
func (h *Handlers) sendInvitationEmail(email, token, publisherID string) {
	ctx := context.Background()

	// Check if email service is available
	if h.emailService == nil || !h.emailService.IsEnabled() {
		slog.Warn("email service not configured, invitation email not sent",
			"email", email,
			"publisher_id", publisherID,
			"token", token[:8]+"...",
		)
		return
	}

	// Get publisher name for email
	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		slog.Error("invalid publisher ID for invitation email", "error", err, "publisher_id", publisherID)
		return
	}

	publisherName := "the publisher"
	nameRow, err := h.db.Queries.GetPublisherNameByID(ctx, publisherIDInt)
	if err == nil {
		publisherName = nameRow
	}

	// Check if user exists in Clerk (server-side only - NEVER expose to admin)
	userExists := false
	var userName string
	if h.clerkService != nil {
		user, err := h.clerkService.GetUserByEmail(ctx, email)
		if err == nil && user != nil {
			userExists = true
			if user.FirstName != nil {
				userName = *user.FirstName
			}
		}
	}

	// Build accept URL
	acceptURL := h.emailService.GetWebURL() + "/invite/" + token

	// Get inviter name (use "A team member" as fallback)
	inviterName := "A team member"

	// Send appropriate email based on user existence
	if userExists {
		// Existing user - personalized email
		err = h.emailService.SendInvitationExistingUser(email, userName, inviterName, publisherName, "member", acceptURL)
	} else {
		// New user - generic invitation
		err = h.emailService.SendInvitationNewUser(email, inviterName, publisherName, "member", acceptURL)
	}

	if err != nil {
		slog.Error("failed to send invitation email", "error", err, "email", email)
	} else {
		slog.Info("invitation email sent",
			"email", email,
			"publisher_id", publisherID,
			"user_exists", userExists,
		)
	}
}

func (h *Handlers) checkUserExistsInClerk(ctx context.Context, email string) bool {
	slog.Info("checking if user exists in Clerk (stub implementation)",
		"email", email,
		"exists", false,
	)
	return false
}
