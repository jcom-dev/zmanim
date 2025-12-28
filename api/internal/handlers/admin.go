// File: admin.go
// Purpose: Admin-only endpoints - publisher/user management, metadata updates
// Pattern: 6-step-handler-admin
// Dependencies: Queries: admin.sql, publishers.sql | Services: ClerkService, EmailService
// Frequency: high - 1,416 lines
// Compliance: Check docs/adr/ for pattern rationale

package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/middleware"
	"github.com/jcom-dev/zmanim/internal/services"
)

// AdminGetPublisherUsers returns all users linked to a publisher
// GET /api/admin/publishers/{id}/users
func (h *Handlers) AdminGetPublisherUsers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	publisherID := chi.URLParam(r, "id")

	if publisherID == "" {
		RespondValidationError(w, r, "Publisher ID is required", nil)
		return
	}

	// Verify publisher exists
	publisherIDInt, err := parseIDParam(publisherID)
	if err != nil {
		RespondValidationError(w, r, "Invalid publisher ID", nil)
		return
	}

	exists, err := h.db.Queries.CheckPublisherExists(ctx, publisherIDInt)
	if err != nil {
		slog.Error("failed to check publisher existence", "error", err, "publisher_id", publisherID)
		RespondInternalError(w, r, "Failed to verify publisher")
		return
	}
	if !exists {
		RespondNotFound(w, r, "Publisher not found")
		return
	}

	if h.clerkService == nil {
		RespondInternalError(w, r, "Clerk service not available")
		return
	}

	// Get users with access to this publisher from Clerk
	users, err := h.clerkService.GetUsersWithPublisherAccess(ctx, publisherID)
	if err != nil {
		slog.Error("failed to get publisher users", "error", err, "publisher_id", publisherID)
		RespondInternalError(w, r, "Failed to retrieve users")
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"users": users,
		"total": len(users),
	})
}

// AdminListPublishers returns a list of all publishers with status
//
//	@Summary		List all publishers (admin)
//	@Description	Returns a list of all publishers with their status, regardless of verification
//	@Tags			Admin
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	APIResponse{data=object}	"List of publishers"
//	@Failure		401	{object}	APIResponse{error=APIError}	"Unauthorized"
//	@Failure		403	{object}	APIResponse{error=APIError}	"Forbidden - admin role required"
//	@Failure		500	{object}	APIResponse{error=APIError}	"Internal server error"
//	@Router			/admin/publishers [get]
func (h *Handlers) AdminListPublishers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Check if we should include deleted publishers
	includeDeleted := r.URL.Query().Get("include_deleted") == "true"

	rows, err := h.db.Queries.AdminListAllPublishers(ctx, includeDeleted)
	if err != nil {
		slog.Error("failed to query publishers", "error", err)
		RespondInternalError(w, r, "Failed to retrieve publishers")
		return
	}

	publishers := make([]map[string]interface{}, 0, len(rows))
	for _, row := range rows {
		publisher := map[string]interface{}{
			"id":           fmt.Sprintf("%d", row.ID),
			"name":         row.Name,
			"email":        row.ContactEmail,
			"status":       row.StatusKey,
			"is_certified": row.IsCertified,
			"created_at":   row.CreatedAt,
			"updated_at":   row.UpdatedAt,
		}

		if row.ClerkUserID != nil {
			publisher["clerk_user_id"] = *row.ClerkUserID
		}
		if row.Website != nil {
			publisher["website"] = *row.Website
		}
		if row.LogoUrl != nil {
			publisher["logo_url"] = *row.LogoUrl
		}
		if row.Description != nil {
			publisher["bio"] = *row.Description
		}
		if row.SuspensionReason != nil {
			publisher["suspension_reason"] = *row.SuspensionReason
		}
		if row.DeletedAt.Valid {
			publisher["deleted_at"] = row.DeletedAt.Time
		}
		if row.DeletedBy != nil {
			publisher["deleted_by"] = *row.DeletedBy
		}

		publishers = append(publishers, publisher)
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"publishers": publishers,
		"total":      len(publishers),
	})
}

// AdminCreatePublisher creates a new publisher entity (no Clerk user)
//
//	@Summary		Create publisher (admin)
//	@Description	Creates a new publisher entity. Admin-created publishers are auto-approved.
//	@Tags			Admin
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			request	body		object						true	"Publisher data (name required, email/website/bio optional)"
//	@Success		201		{object}	APIResponse{data=object}	"Created publisher"
//	@Failure		400		{object}	APIResponse{error=APIError}	"Invalid request"
//	@Failure		401		{object}	APIResponse{error=APIError}	"Unauthorized"
//	@Failure		403		{object}	APIResponse{error=APIError}	"Forbidden"
//	@Failure		409		{object}	APIResponse{error=APIError}	"Conflict - publisher name already exists"
//	@Failure		500		{object}	APIResponse{error=APIError}	"Internal server error"
//	@Router			/admin/publishers [post]
func (h *Handlers) AdminCreatePublisher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		Name    string  `json:"name"`
		Email   *string `json:"email"` // Optional contact email for the publisher
		Website *string `json:"website"`
		Bio     *string `json:"bio"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Validate required fields
	validationErrors := make(map[string]string)
	if req.Name == "" {
		validationErrors["name"] = "Name is required"
	}
	if len(validationErrors) > 0 {
		RespondValidationError(w, r, "Invalid request parameters", validationErrors)
		return
	}

	// Generate slug from publisher name
	slug := generateSlug(req.Name)

	// Insert new publisher as active (admin-created publishers are auto-approved)
	row, err := h.db.Queries.AdminCreatePublisher(ctx, sqlcgen.AdminCreatePublisherParams{
		Name:         req.Name,
		Slug:         &slug,
		ContactEmail: *req.Email,
		Website:      req.Website,
		Description:  req.Bio,
	})

	if err != nil {
		slog.Error("failed to create publisher", "error", err)

		// Check for unique constraint violation
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique constraint") {
			RespondConflict(w, r, "Publisher with this name already exists")
			return
		}
		RespondInternalError(w, r, "Failed to create publisher")
		return
	}

	publisher := map[string]interface{}{
		"id":         row.ID,
		"name":       row.Name,
		"slug":       row.Slug,
		"status":     "active",
		"created_at": row.CreatedAt,
		"updated_at": row.UpdatedAt,
	}

	if row.ContactEmail != "" {
		publisher["email"] = row.ContactEmail
	}
	if row.Website != nil {
		publisher["website"] = *row.Website
	}
	if row.Description != nil {
		publisher["bio"] = *row.Description
	}

	slog.Info("publisher created", "id", row.ID, "name", row.Name, "status", "active")

	// Log admin audit event
	publisherIDStr := fmt.Sprintf("%d", row.ID)
	_ = h.activityService.LogAdminAction(ctx, r, services.AdminAuditParams{
		ActionType:        services.ActionAdminPublisherCreate,
		ResourceType:      "publisher",
		ResourceID:        publisherIDStr,
		ResourceName:      row.Name,
		TargetPublisherID: publisherIDStr,
		ChangesAfter: map[string]interface{}{
			"id":     row.ID,
			"name":   row.Name,
			"slug":   row.Slug,
			"status": "active",
		},
		Severity: services.SeverityInfo,
		Status:   "success",
	})

	// Get publisher email for invite
	publisherEmail := row.ContactEmail

	// Send approval email and invite (non-blocking)
	if publisherEmail != "" {
		webURL := os.Getenv("WEB_URL")
		if webURL == "" {
			webURL = "http://localhost:3001"
		}
		dashboardURL := fmt.Sprintf("%s/publisher/dashboard", webURL)

		// Send approval/welcome email
		if h.emailService != nil {
			go func() {
				publisherIDStr := fmt.Sprintf("%d", row.ID)
				err := h.emailService.SendPublisherApproved(publisherEmail, row.Name, dashboardURL)
				if err != nil {
					slog.Error("failed to send publisher welcome email",
						"error", err,
						"publisher_id", publisherIDStr,
						"email", publisherEmail)
				} else {
					slog.Info("publisher welcome email sent",
						"publisher_id", publisherIDStr,
						"email", publisherEmail)
				}
			}()
		}

		// Create Clerk user or add publisher to existing user
		if h.clerkService != nil {
			go func() {
				publisherIDStr := fmt.Sprintf("%d", row.ID)
				// Check if user already exists in Clerk
				existingUser, err := h.clerkService.GetUserByEmail(context.Background(), publisherEmail)
				if err != nil {
					slog.Error("failed to check for existing user",
						"error", err,
						"email", publisherEmail)
					return
				}

				if existingUser != nil {
					// User exists - add publisher to their access list
					if err := h.clerkService.AddPublisherToUser(context.Background(), existingUser.ID, publisherIDStr); err != nil {
						slog.Error("failed to add publisher to existing user",
							"error", err,
							"user_id", existingUser.ID,
							"publisher_id", publisherIDStr)
					} else {
						slog.Info("publisher access granted to existing user",
							"email", publisherEmail,
							"user_id", existingUser.ID,
							"publisher_id", publisherIDStr)
					}
				} else {
					// User doesn't exist - create them directly (works with Restricted mode)
					newUser, err := h.clerkService.CreatePublisherUserDirectly(context.Background(), publisherEmail, row.Name, publisherIDStr)
					if err != nil {
						slog.Error("failed to create publisher user",
							"error", err,
							"email", publisherEmail,
							"publisher_id", publisherIDStr)
					} else {
						slog.Info("publisher user created",
							"email", publisherEmail,
							"user_id", newUser.ID,
							"publisher_id", publisherIDStr)
					}
				}
			}()
		}
	}

	RespondJSON(w, r, http.StatusCreated, publisher)
}

// AdminAddUserToPublisher adds a user to manage a publisher (direct creation, no invitation)
// POST /api/admin/publishers/{id}/users/invite
// If user exists in Clerk, adds publisher to their access list
// If user doesn't exist, creates user directly and sends welcome email
func (h *Handlers) AdminAddUserToPublisher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	publisherID := chi.URLParam(r, "id")

	if publisherID == "" {
		RespondValidationError(w, r, "Publisher ID is required", nil)
		return
	}

	var req struct {
		Email string `json:"email"`
		Name  string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	if req.Email == "" {
		RespondValidationError(w, r, "Email is required", map[string]string{"email": "Email is required"})
		return
	}

	// Verify publisher exists and get its name
	publisherIDInt, err := parseIDParam(publisherID)
	if err != nil {
		RespondValidationError(w, r, "Invalid publisher ID", nil)
		return
	}

	publisherName, err := h.db.Queries.GetPublisherNameByID(ctx, publisherIDInt)
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Publisher not found")
			return
		}
		slog.Error("failed to get publisher", "error", err, "publisher_id", publisherID)
		RespondInternalError(w, r, "Failed to retrieve publisher")
		return
	}

	if h.clerkService == nil {
		RespondInternalError(w, r, "Clerk service not available")
		return
	}

	// Get current user's name for "added by" in email
	currentUserID := middleware.GetUserID(ctx)
	addedByName := "An administrator"
	if currentUserID != "" {
		if currentUser, err := h.clerkService.GetUser(ctx, currentUserID); err == nil && currentUser.FirstName != nil {
			addedByName = *currentUser.FirstName
		}
	}

	// Check if user already exists in Clerk
	existingUser, err := h.clerkService.GetUserByEmail(ctx, req.Email)
	if err != nil {
		slog.Error("failed to search for existing user", "error", err, "email", req.Email)
		RespondInternalError(w, r, "Failed to check for existing user")
		return
	}

	isNewUser := existingUser == nil
	var userID string
	userName := req.Name
	if userName == "" {
		userName = req.Email // Fallback to email if no name provided
	}

	if existingUser != nil {
		// User exists - add publisher to their access list
		userID = existingUser.ID
		if err := h.clerkService.AddPublisherToUser(ctx, userID, publisherID); err != nil {
			slog.Error("failed to add publisher to user", "error", err, "user_id", userID, "publisher_id", publisherID)
			RespondInternalError(w, r, "Failed to add publisher access")
			return
		}

		// Get existing user's name for email
		if existingUser.FirstName != nil {
			userName = *existingUser.FirstName
		}

		slog.Info("publisher access added to existing user",
			"email", req.Email,
			"user_id", userID,
			"publisher_id", publisherID)
	} else {
		// User doesn't exist - create directly (no invitation)
		newUser, err := h.clerkService.CreatePublisherUserDirectly(ctx, req.Email, userName, publisherID)
		if err != nil {
			slog.Error("failed to create user", "error", err, "email", req.Email, "publisher_id", publisherID)
			RespondInternalError(w, r, "Failed to create user")
			return
		}
		userID = newUser.ID

		slog.Info("user created and added to publisher",
			"email", req.Email,
			"user_id", userID,
			"publisher_id", publisherID)
	}

	// Log admin audit event - granting access
	_ = h.activityService.LogAdminAction(ctx, r, services.AdminAuditParams{
		ActionType:        services.ActionAdminGrantAccess,
		ResourceType:      "user",
		ResourceID:        userID,
		ResourceName:      userName,
		TargetPublisherID: publisherID,
		ChangesAfter: map[string]interface{}{
			"user_id":        userID,
			"user_email":     req.Email,
			"publisher_id":   publisherID,
			"publisher_name": publisherName,
			"is_new_user":    isNewUser,
		},
		Severity: services.SeverityInfo,
		Status:   "success",
	})

	// Send email notification
	if h.emailService != nil {
		go func() {
			if err := h.emailService.SendUserAddedToPublisher(req.Email, userName, publisherName, addedByName, isNewUser); err != nil {
				slog.Error("failed to send publisher added email",
					"error", err,
					"email", req.Email,
					"publisher_id", publisherID)
			}
		}()
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"status":       "user_added",
		"message":      "User added to publisher successfully",
		"email":        req.Email,
		"publisher_id": publisherID,
		"user_id":      userID,
		"is_new_user":  isNewUser,
	})
}

// AdminInviteUserToPublisher is an alias for AdminAddUserToPublisher for backward compatibility
// POST /api/admin/publishers/{id}/users/invite
// Deprecated: Use AdminAddUserToPublisher instead
func (h *Handlers) AdminInviteUserToPublisher(w http.ResponseWriter, r *http.Request) {
	h.AdminAddUserToPublisher(w, r)
}

// AdminRemoveUserFromPublisher removes a user's access to a publisher
// DELETE /api/admin/publishers/{id}/users/{userId}
// If this is the user's last role (no admin, no other publishers), the user is deleted
func (h *Handlers) AdminRemoveUserFromPublisher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	publisherID := chi.URLParam(r, "id")
	userID := chi.URLParam(r, "userId")

	if publisherID == "" {
		RespondValidationError(w, r, "Publisher ID is required", nil)
		return
	}
	if userID == "" {
		RespondValidationError(w, r, "User ID is required", nil)
		return
	}

	// Verify publisher exists
	publisherIDInt, err := parseIDParam(publisherID)
	if err != nil {
		RespondValidationError(w, r, "Invalid publisher ID", nil)
		return
	}

	exists, err := h.db.Queries.CheckPublisherExists(ctx, publisherIDInt)
	if err != nil {
		slog.Error("failed to check publisher existence", "error", err, "publisher_id", publisherID)
		RespondInternalError(w, r, "Failed to verify publisher")
		return
	}
	if !exists {
		RespondNotFound(w, r, "Publisher not found")
		return
	}

	if h.clerkService == nil {
		RespondInternalError(w, r, "Clerk service not available")
		return
	}

	// Get user email before potential deletion (for logging)
	var email string
	if user, err := h.clerkService.GetUser(ctx, userID); err == nil && len(user.EmailAddresses) > 0 {
		email = user.EmailAddresses[0].EmailAddress
	}

	// Remove publisher from user's access list and check if user should be deleted
	userDeleted, err := h.clerkService.RemovePublisherFromUserAndCleanup(ctx, userID, publisherID)
	if err != nil {
		slog.Error("failed to remove publisher from user", "error", err, "user_id", userID, "publisher_id", publisherID)
		RespondInternalError(w, r, "Failed to remove publisher access")
		return
	}

	// Log admin audit event - revoking access (critical event)
	_ = h.activityService.LogAdminAction(ctx, r, services.AdminAuditParams{
		ActionType:        services.ActionAdminRevokeAccess,
		ResourceType:      "user",
		ResourceID:        userID,
		TargetPublisherID: publisherID,
		ChangesBefore: map[string]interface{}{
			"user_id":      userID,
			"user_email":   email,
			"publisher_id": publisherID,
			"had_access":   true,
		},
		ChangesAfter: map[string]interface{}{
			"user_id":      userID,
			"publisher_id": publisherID,
			"had_access":   false,
			"user_deleted": userDeleted,
		},
		Severity: services.SeverityCritical,
		Status:   "success",
	})

	if userDeleted {
		slog.Info("user deleted after removing last publisher access",
			"user_id", userID,
			"publisher_id", publisherID,
			"email", email)

		RespondJSON(w, r, http.StatusOK, map[string]interface{}{
			"status":       "user_deleted",
			"message":      "Publisher access removed and user deleted (no remaining roles)",
			"user_id":      userID,
			"publisher_id": publisherID,
			"user_deleted": true,
		})
	} else {
		slog.Info("publisher access removed from user",
			"user_id", userID,
			"publisher_id", publisherID,
			"email", email)

		RespondJSON(w, r, http.StatusOK, map[string]interface{}{
			"status":       "access_removed",
			"message":      "Publisher access removed from user",
			"user_id":      userID,
			"publisher_id": publisherID,
			"user_deleted": false,
		})
	}
}

// AdminVerifyPublisher verifies a pending publisher
//
//	@Summary		Verify publisher (admin)
//	@Description	Verifies a pending publisher, sends approval email, and creates/updates Clerk user
//	@Tags			Admin
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string						true	"Publisher ID"
//	@Success		200	{object}	APIResponse{data=object}	"Verified publisher"
//	@Failure		400	{object}	APIResponse{error=APIError}	"Invalid request"
//	@Failure		401	{object}	APIResponse{error=APIError}	"Unauthorized"
//	@Failure		403	{object}	APIResponse{error=APIError}	"Forbidden"
//	@Failure		404	{object}	APIResponse{error=APIError}	"Publisher not found"
//	@Failure		500	{object}	APIResponse{error=APIError}	"Internal server error"
//	@Router			/admin/publishers/{id}/verify [put]
func (h *Handlers) AdminVerifyPublisher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	if id == "" {
		RespondValidationError(w, r, "Publisher ID is required", nil)
		return
	}

	// Get publisher details before updating status (for email)
	idInt, err := parseIDParam(id)
	if err != nil {
		RespondValidationError(w, r, "Invalid publisher ID", nil)
		return
	}

	publisherInfo, err := h.db.Queries.GetPublisherEmailAndName(ctx, idInt)
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Publisher not found")
			return
		}
		slog.Error("failed to get publisher for verification", "error", err, "id", id)
		RespondInternalError(w, r, "Failed to retrieve publisher")
		return
	}
	publisherEmail := publisherInfo.ContactEmail
	publisherName := publisherInfo.Name

	result := h.updatePublisherStatus(ctx, id, "active")
	if result.err != nil {
		handlePublisherStatusError(w, r, result)
		return
	}

	slog.Info("publisher verified", "id", id)

	// Log admin audit event
	_ = h.activityService.LogAdminAction(ctx, r, services.AdminAuditParams{
		ActionType:        services.ActionAdminPublisherVerify,
		ResourceType:      "publisher",
		ResourceID:        id,
		ResourceName:      publisherName,
		TargetPublisherID: id,
		ChangesBefore: map[string]interface{}{
			"status": "pending",
		},
		ChangesAfter: map[string]interface{}{
			"status": "active",
		},
		Severity: services.SeverityInfo,
		Status:   "success",
	})

	// Send approval email and invite user (non-blocking)
	if publisherEmail != "" {
		webURL := os.Getenv("WEB_URL")
		if webURL == "" {
			webURL = "http://localhost:3001"
		}
		dashboardURL := fmt.Sprintf("%s/publisher/dashboard", webURL)

		// Send approval email
		if h.emailService != nil {
			go func() {
				err := h.emailService.SendPublisherApproved(publisherEmail, publisherName, dashboardURL)
				if err != nil {
					slog.Error("failed to send publisher approval email",
						"error", err,
						"publisher_id", id,
						"email", publisherEmail)
				} else {
					slog.Info("publisher approval email sent",
						"publisher_id", id,
						"email", publisherEmail)
				}
			}()
		}

		// Automatically create user or add publisher to existing user
		if h.clerkService != nil {
			go func() {
				// Check if user already exists in Clerk
				existingUser, err := h.clerkService.GetUserByEmail(context.Background(), publisherEmail)
				if err != nil {
					slog.Error("failed to check for existing user during verification",
						"error", err,
						"email", publisherEmail)
					return
				}

				if existingUser != nil {
					// User exists - add publisher to their access list
					if err := h.clerkService.AddPublisherToUser(context.Background(), existingUser.ID, id); err != nil {
						slog.Error("failed to add publisher to existing user",
							"error", err,
							"user_id", existingUser.ID,
							"publisher_id", id)
					} else {
						slog.Info("publisher access granted to existing user",
							"email", publisherEmail,
							"user_id", existingUser.ID,
							"publisher_id", id)
					}
				} else {
					// User doesn't exist - create them directly (works with Restricted mode)
					newUser, err := h.clerkService.CreatePublisherUserDirectly(context.Background(), publisherEmail, publisherName, id)
					if err != nil {
						slog.Error("failed to create publisher user",
							"error", err,
							"email", publisherEmail,
							"publisher_id", id)
					} else {
						slog.Info("publisher user created",
							"email", publisherEmail,
							"user_id", newUser.ID,
							"publisher_id", id)
					}
				}
			}()
		}
	}

	RespondJSON(w, r, http.StatusOK, result.publisher)
}

// AdminSuspendPublisher suspends a verified publisher
// PUT /api/admin/publishers/{id}/suspend
func (h *Handlers) AdminSuspendPublisher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	if id == "" {
		RespondValidationError(w, r, "Publisher ID is required", nil)
		return
	}

	// Parse optional reason from request body
	var req struct {
		Reason string `json:"reason"`
	}
	// Ignore decode errors - reason is optional
	_ = json.NewDecoder(r.Body).Decode(&req)

	// Update status and suspension reason
	idInt, err := parseIDParam(id)
	if err != nil {
		RespondValidationError(w, r, "Invalid publisher ID", nil)
		return
	}

	var reason *string
	if req.Reason != "" {
		reason = &req.Reason
	}

	row, err := h.db.Queries.AdminSuspendPublisher(ctx, sqlcgen.AdminSuspendPublisherParams{
		SuspensionReason: reason,
		ID:               idInt,
	})

	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Publisher not found")
			return
		}
		slog.Error("failed to suspend publisher", "error", err, "id", id)
		RespondInternalError(w, r, "Failed to suspend publisher")
		return
	}

	slog.Info("publisher suspended", "id", id, "reason", req.Reason)

	// Log admin audit event - suspension is a warning-level event
	_ = h.activityService.LogAdminAction(ctx, r, services.AdminAuditParams{
		ActionType:        services.ActionAdminPublisherSuspend,
		ResourceType:      "publisher",
		ResourceID:        id,
		ResourceName:      row.Name,
		TargetPublisherID: id,
		ChangesBefore: map[string]interface{}{
			"status": "active",
		},
		ChangesAfter: map[string]interface{}{
			"status": "suspended",
			"reason": req.Reason,
		},
		Severity: services.SeverityWarning,
		Reason:   req.Reason,
		Status:   "success",
	})

	publisher := map[string]interface{}{
		"id":         row.ID,
		"name":       row.Name,
		"email":      row.ContactEmail,
		"status":     "suspended",
		"created_at": row.CreatedAt,
		"updated_at": row.UpdatedAt,
	}
	if row.SuspensionReason != nil {
		publisher["suspension_reason"] = *row.SuspensionReason
	}

	RespondJSON(w, r, http.StatusOK, publisher)
}

// AdminReactivatePublisher reactivates a suspended publisher
// PUT /api/admin/publishers/{id}/reactivate
func (h *Handlers) AdminReactivatePublisher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	if id == "" {
		RespondValidationError(w, r, "Publisher ID is required", nil)
		return
	}

	// Clear suspension reason when reactivating
	idInt, err := parseIDParam(id)
	if err != nil {
		RespondValidationError(w, r, "Invalid publisher ID", nil)
		return
	}

	row, err := h.db.Queries.AdminReactivatePublisher(ctx, idInt)
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Publisher not found")
			return
		}
		slog.Error("failed to reactivate publisher", "error", err, "id", id)
		RespondInternalError(w, r, "Failed to reactivate publisher")
		return
	}

	slog.Info("publisher reactivated", "id", id)

	// Log admin audit event
	_ = h.activityService.LogAdminAction(ctx, r, services.AdminAuditParams{
		ActionType:        services.ActionAdminPublisherReactivate,
		ResourceType:      "publisher",
		ResourceID:        id,
		ResourceName:      row.Name,
		TargetPublisherID: id,
		ChangesBefore: map[string]interface{}{
			"status": "suspended",
		},
		ChangesAfter: map[string]interface{}{
			"status": "active",
		},
		Severity: services.SeverityInfo,
		Status:   "success",
	})

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"id":         row.ID,
		"name":       row.Name,
		"email":      row.ContactEmail,
		"status":     "active",
		"created_at": row.CreatedAt,
		"updated_at": row.UpdatedAt,
	})
}

// AdminUpdatePublisher updates a publisher's details
// PUT /api/admin/publishers/{id}
func (h *Handlers) AdminUpdatePublisher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	if id == "" {
		RespondValidationError(w, r, "Publisher ID is required", nil)
		return
	}

	var req struct {
		Name    *string `json:"name"`
		Email   *string `json:"email"`
		Website *string `json:"website"`
		Bio     *string `json:"bio"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	idInt, err := parseIDParam(id)
	if err != nil {
		RespondValidationError(w, r, "Invalid publisher ID", nil)
		return
	}

	// Prepare nullable parameters for SQLc
	var slug *string
	if req.Name != nil {
		slugVal := generateSlug(*req.Name)
		slug = &slugVal
	}

	row, err := h.db.Queries.AdminUpdatePublisherFields(ctx, sqlcgen.AdminUpdatePublisherFieldsParams{
		ID:          idInt,
		Name:        req.Name,
		Slug:        slug,
		Email:       req.Email,
		Website:     req.Website,
		Description: req.Bio,
	})

	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Publisher not found")
			return
		}
		slog.Error("failed to update publisher", "error", err, "id", id)
		RespondInternalError(w, r, "Failed to update publisher")
		return
	}

	publisher := map[string]interface{}{
		"id":         row.ID,
		"name":       row.Name,
		"slug":       *row.Slug,
		"status":     "active",
		"created_at": row.CreatedAt,
		"updated_at": row.UpdatedAt,
	}

	if row.ContactEmail != "" {
		publisher["email"] = row.ContactEmail
	}
	if row.Website != nil {
		publisher["website"] = *row.Website
	}
	if row.Description != nil {
		publisher["bio"] = *row.Description
	}

	slog.Info("publisher updated", "id", id)

	// Log admin audit event with changes
	changesAfter := map[string]interface{}{}
	if req.Name != nil {
		changesAfter["name"] = *req.Name
	}
	if req.Email != nil {
		changesAfter["email"] = *req.Email
	}
	if req.Website != nil {
		changesAfter["website"] = *req.Website
	}
	if req.Bio != nil {
		changesAfter["bio"] = *req.Bio
	}
	_ = h.activityService.LogAdminAction(ctx, r, services.AdminAuditParams{
		ActionType:        services.ActionAdminPublisherUpdate,
		ResourceType:      "publisher",
		ResourceID:        id,
		ResourceName:      row.Name,
		TargetPublisherID: id,
		ChangesAfter:      changesAfter,
		Severity:          services.SeverityInfo,
		Status:            "success",
	})

	RespondJSON(w, r, http.StatusOK, publisher)
}

// AdminDeletePublisher soft-deletes a publisher (can be restored later)
// DELETE /api/admin/publishers/{id}
func (h *Handlers) AdminDeletePublisher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	if id == "" {
		RespondValidationError(w, r, "Publisher ID is required", nil)
		return
	}

	// Get admin user ID for audit trail
	adminUserID := middleware.GetUserID(ctx)

	idInt, err := parseIDParam(id)
	if err != nil {
		RespondValidationError(w, r, "Invalid publisher ID", nil)
		return
	}

	// Get publisher name and check if already deleted
	publisherInfo, err := h.db.Queries.GetPublisherNameAndDeletedAt(ctx, idInt)
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Publisher not found")
			return
		}
		slog.Error("failed to get publisher", "error", err, "id", id)
		RespondInternalError(w, r, "Failed to get publisher")
		return
	}

	if publisherInfo.DeletedAt.Valid {
		RespondBadRequest(w, r, "Publisher is already deleted")
		return
	}

	// Soft delete the publisher
	deletedAt, err := h.db.Queries.AdminSoftDeletePublisher(ctx, sqlcgen.AdminSoftDeletePublisherParams{
		DeletedBy: &adminUserID,
		ID:        idInt,
	})
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Publisher not found or already deleted")
			return
		}
		slog.Error("failed to soft delete publisher", "error", err, "id", id)
		RespondInternalError(w, r, "Failed to delete publisher")
		return
	}

	slog.Info("publisher soft-deleted", "id", id, "name", publisherInfo.Name, "deleted_by", adminUserID)

	// Log admin audit event - deletion is critical
	_ = h.activityService.LogAdminAction(ctx, r, services.AdminAuditParams{
		ActionType:        services.ActionAdminPublisherDelete,
		ResourceType:      "publisher",
		ResourceID:        id,
		ResourceName:      publisherInfo.Name,
		TargetPublisherID: id,
		ChangesBefore: map[string]interface{}{
			"id":     id,
			"name":   publisherInfo.Name,
			"status": "active",
		},
		ChangesAfter: map[string]interface{}{
			"status":     "deleted",
			"deleted_at": deletedAt,
			"deleted_by": adminUserID,
		},
		Severity: services.SeverityCritical,
		Status:   "success",
	})

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"message":    "Publisher deleted successfully",
		"id":         id,
		"name":       publisherInfo.Name,
		"deleted_at": deletedAt,
		"deleted_by": adminUserID,
	})
}

// AdminRestorePublisher restores a soft-deleted publisher
// PUT /api/admin/publishers/{id}/restore
func (h *Handlers) AdminRestorePublisher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	if id == "" {
		RespondValidationError(w, r, "Publisher ID is required", nil)
		return
	}

	idInt, err := parseIDParam(id)
	if err != nil {
		RespondValidationError(w, r, "Invalid publisher ID", nil)
		return
	}

	// Get publisher name and check if actually deleted
	publisherInfo, err := h.db.Queries.GetPublisherNameAndDeletedAt(ctx, idInt)
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Publisher not found")
			return
		}
		slog.Error("failed to get publisher", "error", err, "id", id)
		RespondInternalError(w, r, "Failed to get publisher")
		return
	}

	if !publisherInfo.DeletedAt.Valid {
		RespondBadRequest(w, r, "Publisher is not deleted")
		return
	}

	// Restore the publisher
	row, err := h.db.Queries.AdminRestorePublisher(ctx, idInt)
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Publisher not found or not deleted")
			return
		}
		slog.Error("failed to restore publisher", "error", err, "id", id)
		RespondInternalError(w, r, "Failed to restore publisher")
		return
	}

	adminUserID := middleware.GetUserID(ctx)
	slog.Info("publisher restored", "id", id, "name", row.Name, "restored_by", adminUserID)

	// Log admin audit event
	_ = h.activityService.LogAdminAction(ctx, r, services.AdminAuditParams{
		ActionType:        services.ActionAdminPublisherRestore,
		ResourceType:      "publisher",
		ResourceID:        id,
		ResourceName:      row.Name,
		TargetPublisherID: id,
		ChangesBefore: map[string]interface{}{
			"status":     "deleted",
			"deleted_at": publisherInfo.DeletedAt.Time,
		},
		ChangesAfter: map[string]interface{}{
			"status":      "active",
			"restored_by": adminUserID,
		},
		Severity: services.SeverityInfo,
		Status:   "success",
	})

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"message":    "Publisher restored successfully",
		"id":         row.ID,
		"name":       row.Name,
		"status":     "active",
		"updated_at": row.UpdatedAt,
	})
}

// AdminPermanentDeletePublisher permanently deletes a publisher and cleans up associated Clerk users
// DELETE /api/admin/publishers/{id}/permanent
func (h *Handlers) AdminPermanentDeletePublisher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	if id == "" {
		RespondValidationError(w, r, "Publisher ID is required", nil)
		return
	}

	// First, get all Clerk users with access to this publisher
	var usersToCleanup []struct {
		ClerkUserID    string
		PublisherCount int
	}

	if h.clerkService != nil {
		users, err := h.clerkService.GetUsersWithPublisherAccess(ctx, id)
		if err != nil {
			slog.Warn("failed to get users with publisher access", "error", err, "publisher_id", id)
		} else {
			// For each user, check if this is their only publisher
			for _, user := range users {
				metadata, err := h.clerkService.GetUserPublicMetadata(ctx, user.ClerkUserID)
				if err != nil {
					slog.Warn("failed to get user metadata", "error", err, "user_id", user.ClerkUserID)
					continue
				}

				accessList, ok := metadata["publisher_access_list"].([]interface{})
				publisherCount := 0
				if ok {
					publisherCount = len(accessList)
				}

				usersToCleanup = append(usersToCleanup, struct {
					ClerkUserID    string
					PublisherCount int
				}{
					ClerkUserID:    user.ClerkUserID,
					PublisherCount: publisherCount,
				})
			}
		}
	}

	idInt, err := parseIDParam(id)
	if err != nil {
		RespondValidationError(w, r, "Invalid publisher ID", nil)
		return
	}

	// Get publisher name for logging
	publisherName, err := h.db.Queries.GetPublisherNameByID(ctx, idInt)
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Publisher not found")
			return
		}
		slog.Error("failed to get publisher", "error", err, "id", id)
		RespondInternalError(w, r, "Failed to get publisher")
		return
	}

	// Log admin action with diff (before deletion)
	_ = h.activityService.LogActionWithDiff(
		ctx,
		services.ActionAdminPublisherPermanentDelete,
		services.ConceptAdmin,
		"publisher",
		id,
		"",
		&services.ActionDiff{
			Old: map[string]interface{}{
				"id":   id,
				"name": publisherName,
			},
		},
		services.ExtractActionContext(r),
	)

	// Permanently delete the publisher using hard delete function (deletes all related data)
	deletionSummaryJSON, err := h.db.Queries.AdminHardDeletePublisher(ctx, idInt)
	if err != nil {
		slog.Error("failed to permanently delete publisher", "error", err, "id", id)
		RespondInternalError(w, r, "Failed to delete publisher")
		return
	}

	// Parse the deletion summary JSON
	var deletionSummary map[string]interface{}
	if err := json.Unmarshal(deletionSummaryJSON, &deletionSummary); err != nil {
		slog.Warn("failed to parse deletion summary", "error", err, "raw", string(deletionSummaryJSON))
		deletionSummary = map[string]interface{}{"raw": string(deletionSummaryJSON)}
	}

	slog.Info("publisher permanently deleted",
		"id", id,
		"name", publisherName,
		"deletion_summary", deletionSummary)

	// Clean up Clerk users in background
	if h.clerkService != nil {
		if len(usersToCleanup) > 0 {
			go func() {
				for _, user := range usersToCleanup {
					if user.PublisherCount <= 1 {
						// This was their only publisher - delete the Clerk user
						if err := h.clerkService.DeleteUser(context.Background(), user.ClerkUserID); err != nil {
							slog.Error("failed to delete Clerk user",
								"error", err,
								"user_id", user.ClerkUserID,
								"publisher_id", id)
						} else {
							slog.Info("deleted Clerk user who only had access to deleted publisher",
								"user_id", user.ClerkUserID,
								"publisher_id", id)
						}
					} else {
						// User has other publishers - just remove this one from their list
						if err := h.clerkService.RemovePublisherFromUser(context.Background(), user.ClerkUserID, id); err != nil {
							slog.Error("failed to remove publisher from user",
								"error", err,
								"user_id", user.ClerkUserID,
								"publisher_id", id)
						} else {
							slog.Info("removed publisher from user access list",
								"user_id", user.ClerkUserID,
								"publisher_id", id)
						}
					}
				}
			}()
		}
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"message":          "Publisher permanently deleted",
		"id":               id,
		"name":             publisherName,
		"users_affected":   len(usersToCleanup),
		"deletion_summary": deletionSummary,
	})
}

// AdminGetStats returns usage statistics
//
//	@Summary		Get system statistics (admin)
//	@Description	Returns usage statistics including publisher counts and calculation metrics
//	@Tags			Admin
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	APIResponse{data=object}	"System statistics"
//	@Failure		401	{object}	APIResponse{error=APIError}	"Unauthorized"
//	@Failure		403	{object}	APIResponse{error=APIError}	"Forbidden"
//	@Failure		500	{object}	APIResponse{error=APIError}	"Internal server error"
//	@Router			/admin/stats [get]
func (h *Handlers) AdminGetStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get publisher counts
	publisherStats, err := h.db.Queries.AdminGetPublisherStats(ctx)
	if err != nil {
		slog.Error("failed to get publisher stats", "error", err)
		RespondInternalError(w, r, "Failed to retrieve statistics")
		return
	}

	totalPublishers := int(publisherStats.Total)
	activePublishers := int(publisherStats.Active)
	pendingPublishers := int(publisherStats.Pending)
	suspendedPublishers := int(publisherStats.Suspended)

	// Get platform-wide calculation stats from database
	platformStats, err := h.db.Queries.GetPlatformStatsDetailed(ctx)
	if err != nil {
		slog.Error("failed to get platform calculation stats", "error", err)
		// Continue with defaults if stats query fails
		platformStats.TotalCalculations = 0
		platformStats.CacheHitRatio = 0
	}

	// Get per-publisher breakdown (top 10)
	publisherBreakdown, err := h.db.Queries.GetPlatformStatsPerPublisher(ctx, 10)
	if err != nil {
		slog.Error("failed to get publisher breakdown", "error", err)
		publisherBreakdown = []sqlcgen.GetPlatformStatsPerPublisherRow{}
	}

	stats := map[string]interface{}{
		"publishers": map[string]int{
			"total":     totalPublishers,
			"active":    activePublishers,
			"pending":   pendingPublishers,
			"suspended": suspendedPublishers,
		},
		"calculations": map[string]interface{}{
			"total":           platformStats.TotalCalculations,
			"cache_hits":      platformStats.CacheHits,
			"cache_hit_ratio": platformStats.CacheHitRatio,
			"avg_response_ms": platformStats.AvgResponseMs,
			"source_web":      platformStats.SourceWeb,
			"source_api":      platformStats.SourceApi,
			"source_external": platformStats.SourceExternal,
			"top_publishers":  publisherBreakdown,
		},
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	RespondJSON(w, r, http.StatusOK, stats)
}

// AdminGetConfig returns system configuration
// GET /api/admin/config
func (h *Handlers) AdminGetConfig(w http.ResponseWriter, r *http.Request) {
	// NOTE: system_config table not yet created - returning defaults
	defaultConfig := map[string]interface{}{
		"rate_limit_anonymous": map[string]interface{}{
			"value":       map[string]interface{}{"requests_per_hour": 100},
			"description": "Rate limit for anonymous API requests",
		},
		"rate_limit_authenticated": map[string]interface{}{
			"value":       map[string]interface{}{"requests_per_hour": 1000},
			"description": "Rate limit for authenticated API requests",
		},
		"cache_ttl_hours": map[string]interface{}{
			"value":       map[string]interface{}{"hours": 24},
			"description": "Cache TTL in hours for zmanim calculations",
		},
	}
	RespondJSON(w, r, http.StatusOK, defaultConfig)
}

// AdminUpdateConfig updates system configuration
// PUT /api/admin/config
func (h *Handlers) AdminUpdateConfig(w http.ResponseWriter, r *http.Request) {
	// NOTE: system_config table not yet created - returning not implemented
	RespondJSON(w, r, http.StatusNotImplemented, map[string]interface{}{
		"error":   "System configuration updates not yet implemented",
		"message": "The system_config table needs to be created first",
	})
}

// AdminFlushZmanimCache clears all cached zmanim calculations
// DELETE /api/admin/cache/zmanim
func (h *Handlers) AdminFlushZmanimCache(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if h.cache == nil {
		RespondJSON(w, r, http.StatusOK, map[string]interface{}{
			"message": "Cache not configured",
			"flushed": false,
		})
		return
	}

	if err := h.cache.FlushAllZmanim(ctx); err != nil {
		slog.Error("failed to flush zmanim cache", "error", err)
		RespondInternalError(w, r, "Failed to flush cache")
		return
	}

	slog.Info("zmanim cache flushed by admin")

	// Log admin audit event
	_ = h.activityService.LogAdminAction(ctx, r, services.AdminAuditParams{
		ActionType:   services.ActionAdminCacheFlush,
		ResourceType: "cache",
		ResourceID:   "zmanim",
		ChangesAfter: map[string]interface{}{
			"flushed": true,
		},
		Severity: services.SeverityInfo,
		Status:   "success",
	})

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"message": "Zmanim cache flushed successfully",
		"flushed": true,
	})
}

// Helper types and functions

type statusUpdateResult struct {
	publisher map[string]interface{}
	err       error
	notFound  bool
}

func (h *Handlers) updatePublisherStatus(ctx context.Context, id, status string) statusUpdateResult {
	// This helper is used to set publisher to "active" status during verification
	// We'll use the AdminReactivatePublisher query which sets status to active
	idInt, err := parseIDParam(id)
	if err != nil {
		return statusUpdateResult{err: err, notFound: true}
	}

	row, err := h.db.Queries.AdminReactivatePublisher(ctx, idInt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return statusUpdateResult{err: err, notFound: true}
		}
		slog.Error("failed to update publisher status", "error", err, "id", id)
		return statusUpdateResult{err: err}
	}

	publisher := map[string]interface{}{
		"id":         row.ID,
		"name":       row.Name,
		"email":      row.ContactEmail,
		"status":     status,
		"created_at": row.CreatedAt,
		"updated_at": row.UpdatedAt,
	}

	return statusUpdateResult{publisher: publisher}
}

func handlePublisherStatusError(w http.ResponseWriter, r *http.Request, result statusUpdateResult) {
	if result.notFound {
		RespondNotFound(w, r, "Publisher not found")
		return
	}
	RespondInternalError(w, r, "Failed to update publisher status")
}

// AdminSetPublisherCertified sets or clears the is_certified flag for a publisher
// PUT /api/admin/publishers/{id}/certified
func (h *Handlers) AdminSetPublisherCertified(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	if id == "" {
		RespondValidationError(w, r, "Publisher ID is required", nil)
		return
	}

	var req struct {
		IsCertified bool `json:"is_certified"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	idInt, err := parseIDParam(id)
	if err != nil {
		RespondValidationError(w, r, "Invalid publisher ID", nil)
		return
	}

	row, err := h.db.Queries.AdminSetPublisherCertified(ctx, sqlcgen.AdminSetPublisherCertifiedParams{
		IsCertified: req.IsCertified,
		ID:          idInt,
	})

	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Publisher not found")
			return
		}
		slog.Error("failed to update publisher certified status", "error", err, "id", id)
		RespondInternalError(w, r, "Failed to update publisher")
		return
	}

	slog.Info("publisher certified status updated", "id", id, "name", row.Name, "is_certified", row.IsCertified)

	// Log admin action
	_ = h.activityService.LogAdminAction(ctx, r, services.AdminAuditParams{
		ActionType:        services.ActionAdminPublisherCertified,
		ResourceType:      "publisher",
		ResourceID:        id,
		ResourceName:      row.Name,
		TargetPublisherID: id,
		ChangesBefore:     map[string]interface{}{"is_certified": !row.IsCertified},
		ChangesAfter:      map[string]interface{}{"is_certified": row.IsCertified},
		Severity:          services.SeverityWarning,
		Status:            "success",
	})

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"id":           row.ID,
		"name":         row.Name,
		"is_certified": row.IsCertified,
		"updated_at":   row.UpdatedAt,
	})
}

// parseIDParam converts a string ID parameter to int32
func parseIDParam(id string) (int32, error) {
	var result int32
	_, err := fmt.Sscanf(id, "%d", &result)
	return result, err
}

// generateSlug creates a URL-friendly slug from text
func generateSlug(text string) string {
	// Convert to lowercase
	slug := strings.ToLower(text)

	// Replace spaces and special characters with hyphens
	slug = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			return r
		}
		return '-'
	}, slug)

	// Remove consecutive hyphens using regex replacement
	re := regexp.MustCompile(`-+`)
	slug = re.ReplaceAllString(slug, "-")

	// Trim hyphens from start and end
	slug = strings.Trim(slug, "-")

	// Limit length to 100 characters
	if len(slug) > 100 {
		slug = slug[:100]
		slug = strings.TrimRight(slug, "-")
	}

	return slug
}

// AdminExportPublisher exports complete publisher data (profile, coverage, zmanim)
// GET /api/v1/admin/publishers/{id}/export
func (h *Handlers) AdminExportPublisher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	if id == "" {
		RespondValidationError(w, r, "Publisher ID is required", nil)
		return
	}

	publisherID, err := parseIDParam(id)
	if err != nil {
		RespondValidationError(w, r, "Invalid publisher ID", nil)
		return
	}

	// Get publisher name for filename
	publisher, err := h.db.Queries.GetPublisherByID(ctx, publisherID)
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Publisher not found")
			return
		}
		slog.Error("failed to get publisher", "error", err, "id", id)
		RespondInternalError(w, r, "Failed to retrieve publisher")
		return
	}

	description := fmt.Sprintf("Admin Export - %s - %s", publisher.Name, time.Now().Format("Jan 2, 2006 3:04 PM"))
	exportJSON, err := h.completeExportService.ExportToJSON(ctx, publisherID, description)
	if err != nil {
		slog.Error("failed to build complete export", "error", err, "publisher_id", id)
		RespondInternalError(w, r, "Failed to export publisher data")
		return
	}

	// Generate safe filename from publisher name
	safeName := generateSlug(publisher.Name)
	filename := fmt.Sprintf("publisher-%s-%s.json", safeName, time.Now().Format("2006-01-02"))

	// Log admin action
	_ = h.activityService.LogAdminAction(ctx, r, services.AdminAuditParams{
		ActionType:        services.ActionAdminPublisherExport,
		ResourceType:      "publisher",
		ResourceID:        id,
		ResourceName:      publisher.Name,
		TargetPublisherID: id,
		ChangesAfter: map[string]interface{}{
			"export_format": "json",
			"filename":      filename,
		},
		Severity: services.SeverityCritical,
		Status:   "success",
	})

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.WriteHeader(http.StatusOK)
	_, err = w.Write(exportJSON)
	if err != nil {
		slog.Error("failed to write export response", "error", err)
	}
}

// AdminImportPublisher imports publisher data from a JSON file
// POST /api/v1/admin/publishers/{id}/import - imports into existing publisher
// POST /api/v1/admin/publishers/{id}/import?create_new=true - creates new publisher from export file
func (h *Handlers) AdminImportPublisher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	createNew := r.URL.Query().Get("create_new") == "true"

	var publisherID int32

	// If not creating new, require and validate publisher ID
	if !createNew {
		if id == "" {
			RespondValidationError(w, r, "Publisher ID is required", nil)
			return
		}

		var err error
		publisherID, err = parseIDParam(id)
		if err != nil {
			RespondValidationError(w, r, "Invalid publisher ID", nil)
			return
		}

		// Verify publisher exists
		_, err = h.db.Queries.GetPublisherByID(ctx, publisherID)
		if err != nil {
			if err == pgx.ErrNoRows {
				RespondNotFound(w, r, "Publisher not found")
				return
			}
			slog.Error("failed to get publisher", "error", err, "id", id)
			RespondInternalError(w, r, "Failed to retrieve publisher")
			return
		}
	}

	// Parse multipart form for file upload
	err := r.ParseMultipartForm(10 << 20) // 10 MB max
	if err != nil {
		RespondBadRequest(w, r, "Failed to parse form data")
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		RespondBadRequest(w, r, "No file uploaded")
		return
	}
	defer file.Close()

	// Read file content
	var importData json.RawMessage
	if err := json.NewDecoder(file).Decode(&importData); err != nil {
		RespondBadRequest(w, r, "Invalid JSON file")
		return
	}

	// Import using the complete export service
	result, err := h.completeExportService.ImportFromJSON(ctx, publisherID, createNew, importData)
	if err != nil {
		slog.Error("failed to import publisher data", "error", err, "publisher_id", id, "create_new", createNew)
		RespondBadRequest(w, r, fmt.Sprintf("Import failed: %v", err))
		return
	}

	// Get publisher name for audit log
	publisherName := result.PublisherName
	if publisherName == "" {
		publisherName = fmt.Sprintf("Publisher %d", result.PublisherID)
	}

	// Log admin action
	_ = h.activityService.LogAdminAction(ctx, r, services.AdminAuditParams{
		ActionType:        services.ActionAdminPublisherImport,
		ResourceType:      "publisher",
		ResourceID:        fmt.Sprintf("%d", result.PublisherID),
		ResourceName:      publisherName,
		TargetPublisherID: fmt.Sprintf("%d", result.PublisherID),
		ChangesAfter: map[string]interface{}{
			"zmanim_created":   result.ZmanimCreated,
			"zmanim_updated":   result.ZmanimUpdated,
			"zmanim_unchanged": result.ZmanimUnchanged,
			"coverage_created": result.CoverageCreated,
			"created_new":      createNew,
		},
		Severity: services.SeverityCritical,
		Status:   "success",
	})

	// Log appropriately based on operation
	if createNew {
		slog.Info("publisher created from import", "publisher_id", result.PublisherID, "name", result.PublisherName)
		RespondJSON(w, r, http.StatusCreated, result)
	} else {
		slog.Info("publisher data imported", "publisher_id", id, "result", result)
		RespondJSON(w, r, http.StatusOK, result)
	}
}

// AdminGetAuditLog returns the admin audit log with filtering
// GET /api/v1/admin/audit-log
func (h *Handlers) AdminGetAuditLog(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse query parameters
	actionType := r.URL.Query().Get("action_type")
	userID := r.URL.Query().Get("user_id")
	startDateStr := r.URL.Query().Get("start_date")
	endDateStr := r.URL.Query().Get("end_date")

	page, _ := parseIntFromQuery(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := parseIntFromQuery(r.URL.Query().Get("page_size"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}

	offset := (page - 1) * pageSize

	// Parse dates
	var startDate, endDate pgtype.Timestamptz
	if startDateStr != "" {
		if t, err := time.Parse(time.RFC3339, startDateStr); err == nil {
			startDate = pgtype.Timestamptz{Time: t, Valid: true}
		}
	}
	if endDateStr != "" {
		if t, err := time.Parse(time.RFC3339, endDateStr); err == nil {
			endDate = pgtype.Timestamptz{Time: t, Valid: true}
		}
	}

	// Query
	rows, err := h.db.Queries.GetAuditLogs(ctx, sqlcgen.GetAuditLogsParams{
		EventAction: nilIfEmpty(actionType),
		ActorID:     nilIfEmpty(userID),
		FromDate:    startDate,
		ToDate:      endDate,
		LimitCount:  int32(pageSize),
		OffsetCount: int32(offset),
	})
	if err != nil {
		slog.Error("failed to get admin audit log", "error", err)
		RespondInternalError(w, r, "Failed to retrieve audit log")
		return
	}

	// Get total count
	total, err := h.db.Queries.CountAuditLogs(ctx, sqlcgen.CountAuditLogsParams{
		EventAction: nilIfEmpty(actionType),
		ActorID:     nilIfEmpty(userID),
		FromDate:    startDate,
		ToDate:      endDate,
	})
	if err != nil {
		total = 0
	}

	// Format response
	entries := make([]map[string]interface{}, 0, len(rows))
	for _, row := range rows {
		entry := map[string]interface{}{
			"id":          row.ID,
			"action_type": row.EventAction,
			"concept":     row.EventCategory,
		}

		if row.ActorID != nil {
			entry["user_id"] = *row.ActorID
		}
		if row.ResourceType != nil {
			entry["entity_type"] = *row.ResourceType
		}
		if row.ResourceID != nil {
			entry["entity_id"] = *row.ResourceID
		}
		if row.Status != nil {
			entry["status"] = *row.Status
		}
		if row.StartedAt.Valid {
			entry["started_at"] = row.StartedAt.Time
		}

		// Generate description from action type
		entry["description"] = formatAdminActionDescription(row.EventAction, row.ResourceType)

		// Parse payload for diff
		if len(row.Payload) > 2 { // Not empty "{}"
			var payload map[string]interface{}
			if json.Unmarshal(row.Payload, &payload) == nil {
				entry["payload"] = payload
			}
		}

		// Parse metadata
		if len(row.Metadata) > 2 {
			var metadata map[string]interface{}
			if json.Unmarshal(row.Metadata, &metadata) == nil {
				entry["metadata"] = metadata
				if actorName, ok := metadata["actor_name"]; ok {
					entry["actor_name"] = actorName
				}
			}
		}

		entries = append(entries, entry)
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"entries":   entries,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// formatAdminActionDescription converts action_type to human-readable description
func formatAdminActionDescription(actionType string, entityType *string) string {
	switch actionType {
	case "admin_publisher_verify":
		return "Publisher Verified"
	case "admin_publisher_suspend":
		return "Publisher Suspended"
	case "admin_publisher_reactivate":
		return "Publisher Reactivated"
	case "admin_publisher_delete":
		return "Publisher Deleted"
	case "admin_publisher_restore":
		return "Publisher Restored"
	case "admin_publisher_permanent_delete":
		return "Publisher Permanently Deleted"
	case "admin_publisher_certified":
		return "Publisher Certified Status Changed"
	case "admin_publisher_create":
		return "Publisher Created"
	case "admin_publisher_update":
		return "Publisher Updated"
	case "admin_user_add":
		return "User Added to Publisher"
	case "admin_user_remove":
		return "User Removed from Publisher"
	case "admin_correction_approve":
		return "Correction Request Approved"
	case "admin_correction_reject":
		return "Correction Request Rejected"
	case "admin_publisher_export":
		return "Publisher Data Exported"
	case "admin_publisher_import":
		return "Publisher Data Imported"
	case "admin_cache_flush":
		return "Cache Flushed"
	default:
		// Fallback: capitalize and replace underscores
		desc := strings.ReplaceAll(actionType, "_", " ")
		return strings.Title(desc)
	}
}

// parseIntFromQuery converts a query parameter string to int
func parseIntFromQuery(s string) (int, error) {
	if s == "" {
		return 0, fmt.Errorf("empty string")
	}
	var result int
	_, err := fmt.Sscanf(s, "%d", &result)
	return result, err
}

// nilIfEmpty returns nil if the string is empty, otherwise returns a pointer to the string
func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
