package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim/internal/middleware"
)

// AdminListAllUsers returns all users with admin status or publisher access
// GET /api/v1/admin/users
func (h *Handlers) AdminListAllUsers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if h.clerkService == nil {
		RespondInternalError(w, r, "Clerk service not available")
		return
	}

	// Get all users with roles from Clerk
	users, err := h.clerkService.GetAllUsersWithRoles(ctx)
	if err != nil {
		slog.Error("failed to get users with roles", "error", err)
		RespondInternalError(w, r, "Failed to retrieve users")
		return
	}

	// Publisher info struct for enrichment
	type publisherBasic struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}

	// Enrich with publisher names
	type userWithPublisherNames struct {
		ClerkUserID         string           `json:"clerk_user_id"`
		Email               string           `json:"email"`
		Name                string           `json:"name"`
		ImageURL            string           `json:"image_url,omitempty"`
		IsAdmin             bool             `json:"is_admin"`
		PublisherAccessList []string         `json:"publisher_access_list"`
		Publishers          []publisherBasic `json:"publishers"`
		PrimaryPublisherID  string           `json:"primary_publisher_id,omitempty"`
		CreatedAt           int64            `json:"created_at"`
	}

	// Get all publishers for name lookup
	publisherMap := make(map[string]publisherBasic)
	publishers, err := h.db.Queries.GetAllPublishersBasicInfo(ctx)
	if err == nil {
		for _, pub := range publishers {
			pubIDStr := strconv.Itoa(int(pub.ID))
			publisherMap[pubIDStr] = publisherBasic{ID: pubIDStr, Name: pub.Name}
		}
	}

	// Build enriched response
	enrichedUsers := make([]userWithPublisherNames, 0, len(users))
	for _, user := range users {
		enriched := userWithPublisherNames{
			ClerkUserID:         user.ClerkUserID,
			Email:               user.Email,
			Name:                user.Name,
			ImageURL:            user.ImageURL,
			IsAdmin:             user.IsAdmin,
			PublisherAccessList: user.PublisherAccessList,
			PrimaryPublisherID:  user.PrimaryPublisherID,
			CreatedAt:           user.CreatedAt,
			Publishers:          make([]publisherBasic, 0),
		}

		// Add publisher details
		for _, pubID := range user.PublisherAccessList {
			if pub, ok := publisherMap[pubID]; ok {
				enriched.Publishers = append(enriched.Publishers, pub)
			}
		}

		enrichedUsers = append(enrichedUsers, enriched)
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"users": enrichedUsers,
		"total": len(enrichedUsers),
	})
}

// AdminAddUser adds a new user or updates an existing user's roles
// POST /api/v1/admin/users
// Body: { email, name, is_admin: bool, publisher_ids: []string }
func (h *Handlers) AdminAddUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		Email        string   `json:"email"`
		Name         string   `json:"name"`
		IsAdmin      bool     `json:"is_admin"`
		PublisherIDs []string `json:"publisher_ids"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Validate required fields
	if req.Email == "" {
		RespondValidationError(w, r, "Email is required", map[string]string{"email": "Email is required"})
		return
	}

	if req.Name == "" {
		RespondValidationError(w, r, "Name is required", map[string]string{"name": "Name is required"})
		return
	}

	// Must have at least one role
	if !req.IsAdmin && len(req.PublisherIDs) == 0 {
		RespondValidationError(w, r, "User must have at least one role (admin or publisher)", nil)
		return
	}

	if h.clerkService == nil {
		RespondInternalError(w, r, "Clerk service not available")
		return
	}

	// Get current user's info for "added by" in emails
	currentUserID := middleware.GetUserID(ctx)
	addedByName := "An administrator"
	if currentUserID != "" && h.clerkService != nil {
		if currentUser, err := h.clerkService.GetUser(ctx, currentUserID); err == nil && currentUser.FirstName != nil {
			addedByName = *currentUser.FirstName
		}
	}

	// Check if user already exists
	existingUser, err := h.clerkService.GetUserByEmail(ctx, req.Email)
	if err != nil {
		slog.Error("failed to check for existing user", "error", err, "email", req.Email)
		RespondInternalError(w, r, "Failed to check for existing user")
		return
	}

	isNewUser := existingUser == nil
	var userID string

	if existingUser != nil {
		// User exists - update their roles
		userID = existingUser.ID

		// Set admin role if requested
		if req.IsAdmin {
			if err := h.clerkService.SetAdminRole(ctx, userID, true); err != nil {
				slog.Error("failed to set admin role", "error", err, "user_id", userID)
				RespondInternalError(w, r, "Failed to set admin role")
				return
			}
		}

		// Add publishers if requested
		for _, pubID := range req.PublisherIDs {
			if err := h.clerkService.AddPublisherToUser(ctx, userID, pubID); err != nil {
				slog.Error("failed to add publisher to user", "error", err, "user_id", userID, "publisher_id", pubID)
				// Continue with other publishers
			}
		}

		slog.Info("updated existing user roles",
			"email", req.Email,
			"user_id", userID,
			"is_admin", req.IsAdmin,
			"publisher_count", len(req.PublisherIDs))
	} else {
		// Create new user
		newUser, err := h.clerkService.CreateUserDirectly(ctx, req.Email, req.Name, req.IsAdmin, req.PublisherIDs)
		if err != nil {
			slog.Error("failed to create user", "error", err, "email", req.Email)
			RespondInternalError(w, r, "Failed to create user")
			return
		}
		userID = newUser.ID

		slog.Info("created new user",
			"email", req.Email,
			"user_id", userID,
			"is_admin", req.IsAdmin,
			"publisher_count", len(req.PublisherIDs))
	}

	// Send appropriate emails
	if h.emailService != nil {
		// Send admin notification if applicable
		if req.IsAdmin {
			go func() {
				if err := h.emailService.SendUserAddedToAdmin(req.Email, req.Name, isNewUser); err != nil {
					slog.Error("failed to send admin added email", "error", err, "email", req.Email)
				}
			}()
		}

		// Send publisher notifications for each publisher
		for _, pubID := range req.PublisherIDs {
			pubID := pubID // Capture for goroutine
			go func() {
				// Get publisher name
				pubName := "the publisher"
				if pubIDInt, err := strconv.Atoi(pubID); err == nil {
					if name, err := h.db.Queries.GetPublisherNameByID(context.Background(), int32(pubIDInt)); err == nil {
						pubName = name
					}
				}

				if err := h.emailService.SendUserAddedToPublisher(req.Email, req.Name, pubName, addedByName, isNewUser); err != nil {
					slog.Error("failed to send publisher added email", "error", err, "email", req.Email, "publisher_id", pubID)
				}
			}()
		}
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"status":        "success",
		"message":       "User roles updated successfully",
		"user_id":       userID,
		"email":         req.Email,
		"is_new_user":   isNewUser,
		"is_admin":      req.IsAdmin,
		"publisher_ids": req.PublisherIDs,
	})
}

// AdminDeleteUser removes all roles from a user and deletes them
// DELETE /api/v1/admin/users/{userId}
func (h *Handlers) AdminDeleteUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := chi.URLParam(r, "userId")

	if userID == "" {
		RespondValidationError(w, r, "User ID is required", nil)
		return
	}

	if h.clerkService == nil {
		RespondInternalError(w, r, "Clerk service not available")
		return
	}

	// Get user info before deletion for logging
	user, err := h.clerkService.GetUser(ctx, userID)
	if err != nil {
		slog.Error("failed to get user", "error", err, "user_id", userID)
		RespondNotFound(w, r, "User not found")
		return
	}

	email := ""
	if len(user.EmailAddresses) > 0 {
		email = user.EmailAddresses[0].EmailAddress
	}

	// Delete the user
	if err := h.clerkService.DeleteUser(ctx, userID); err != nil {
		slog.Error("failed to delete user", "error", err, "user_id", userID)
		RespondInternalError(w, r, "Failed to delete user")
		return
	}

	slog.Info("user deleted", "user_id", userID, "email", email)

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"message": "User deleted successfully",
		"user_id": userID,
		"email":   email,
	})
}

// AdminUpdateUser updates a user's basic information (name)
// PUT /api/v1/admin/users/{userId}
// Body: { name: string }
func (h *Handlers) AdminUpdateUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := chi.URLParam(r, "userId")

	if userID == "" {
		RespondValidationError(w, r, "User ID is required", nil)
		return
	}

	var req struct {
		Name string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	if req.Name == "" {
		RespondValidationError(w, r, "Name is required", map[string]string{"name": "Name is required"})
		return
	}

	if h.clerkService == nil {
		RespondInternalError(w, r, "Clerk service not available")
		return
	}

	// Get user info first to verify they exist
	user, err := h.clerkService.GetUser(ctx, userID)
	if err != nil {
		slog.Error("failed to get user", "error", err, "user_id", userID)
		RespondNotFound(w, r, "User not found")
		return
	}

	email := ""
	if len(user.EmailAddresses) > 0 {
		email = user.EmailAddresses[0].EmailAddress
	}

	// Update the user's name in Clerk
	if err := h.clerkService.UpdateUserName(ctx, userID, req.Name); err != nil {
		slog.Error("failed to update user name", "error", err, "user_id", userID)
		RespondInternalError(w, r, "Failed to update user")
		return
	}

	slog.Info("user updated", "user_id", userID, "email", email, "name", req.Name)

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"message": "User updated successfully",
		"user_id": userID,
		"name":    req.Name,
	})
}

// AdminSetAdminRole toggles admin status for a user
// PUT /api/v1/admin/users/{userId}/admin
// Body: { is_admin: bool }
func (h *Handlers) AdminSetAdminRole(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := chi.URLParam(r, "userId")

	if userID == "" {
		RespondValidationError(w, r, "User ID is required", nil)
		return
	}

	var req struct {
		IsAdmin bool `json:"is_admin"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	if h.clerkService == nil {
		RespondInternalError(w, r, "Clerk service not available")
		return
	}

	// Get user info for email
	user, err := h.clerkService.GetUser(ctx, userID)
	if err != nil {
		slog.Error("failed to get user", "error", err, "user_id", userID)
		RespondNotFound(w, r, "User not found")
		return
	}

	email := ""
	userName := ""
	if len(user.EmailAddresses) > 0 {
		email = user.EmailAddresses[0].EmailAddress
	}
	if user.FirstName != nil {
		userName = *user.FirstName
	}

	if req.IsAdmin {
		// Adding admin role
		if err := h.clerkService.SetAdminRole(ctx, userID, true); err != nil {
			slog.Error("failed to set admin role", "error", err, "user_id", userID)
			RespondInternalError(w, r, "Failed to set admin role")
			return
		}

		// Send email notification
		if h.emailService != nil && email != "" {
			go func() {
				if err := h.emailService.SendUserAddedToAdmin(email, userName, false); err != nil {
					slog.Error("failed to send admin added email", "error", err, "email", email)
				}
			}()
		}

		slog.Info("admin role granted", "user_id", userID, "email", email)

		RespondJSON(w, r, http.StatusOK, map[string]interface{}{
			"status":   "success",
			"message":  "Admin role granted",
			"user_id":  userID,
			"is_admin": true,
		})
	} else {
		// Removing admin role - check if this will leave user with no roles
		deleted, err := h.clerkService.RemoveAdminAndCleanup(ctx, userID)
		if err != nil {
			slog.Error("failed to remove admin role", "error", err, "user_id", userID)
			RespondInternalError(w, r, "Failed to remove admin role")
			return
		}

		if deleted {
			slog.Info("user deleted after removing last role (admin)", "user_id", userID, "email", email)
			RespondJSON(w, r, http.StatusOK, map[string]interface{}{
				"status":       "success",
				"message":      "Admin role removed and user deleted (no remaining roles)",
				"user_id":      userID,
				"user_deleted": true,
			})
		} else {
			slog.Info("admin role removed", "user_id", userID, "email", email)
			RespondJSON(w, r, http.StatusOK, map[string]interface{}{
				"status":       "success",
				"message":      "Admin role removed",
				"user_id":      userID,
				"is_admin":     false,
				"user_deleted": false,
			})
		}
	}
}

// AdminResetUserPassword triggers a password reset email for a user
// POST /api/v1/admin/users/{userId}/reset-password
func (h *Handlers) AdminResetUserPassword(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := chi.URLParam(r, "userId")

	if userID == "" {
		RespondValidationError(w, r, "User ID is required", nil)
		return
	}

	if h.clerkService == nil {
		RespondInternalError(w, r, "Clerk service not available")
		return
	}

	// Get user info
	user, err := h.clerkService.GetUser(ctx, userID)
	if err != nil {
		slog.Error("failed to get user", "error", err, "user_id", userID)
		RespondNotFound(w, r, "User not found")
		return
	}

	email := ""
	userName := ""
	if len(user.EmailAddresses) > 0 {
		email = user.EmailAddresses[0].EmailAddress
	}
	if user.FirstName != nil {
		userName = *user.FirstName
	}

	if email == "" {
		RespondBadRequest(w, r, "User has no email address")
		return
	}

	// Note: Clerk doesn't have a direct "trigger password reset" API for admins.
	// The user would typically use the "Forgot Password" flow themselves.
	// We'll send our custom email with instructions to use the forgot password link.

	// For now, we'll send our custom password reset request email
	if h.emailService != nil {
		// Build the sign-in URL with forgot password hint
		webURL := "http://localhost:3001"
		if envURL := r.Header.Get("X-Forwarded-Host"); envURL != "" {
			webURL = "https://" + envURL
		}
		resetURL := webURL + "/sign-in?forgot=true"

		go func() {
			if err := h.emailService.SendPasswordResetRequest(email, userName, resetURL, "24 hours"); err != nil {
				slog.Error("failed to send password reset email", "error", err, "email", email)
			}
		}()
	}

	slog.Info("password reset requested", "user_id", userID, "email", email)

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"message": "Password reset email sent",
		"user_id": userID,
		"email":   email,
	})
}

// AdminAddPublisherToUser adds a publisher to a user's access list
// POST /api/v1/admin/users/{userId}/publishers
// Body: { publisher_id: string }
func (h *Handlers) AdminAddPublisherToUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := chi.URLParam(r, "userId")

	if userID == "" {
		RespondValidationError(w, r, "User ID is required", nil)
		return
	}

	var req struct {
		PublisherID string `json:"publisher_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	if req.PublisherID == "" {
		RespondValidationError(w, r, "Publisher ID is required", map[string]string{"publisher_id": "Publisher ID is required"})
		return
	}

	if h.clerkService == nil {
		RespondInternalError(w, r, "Clerk service not available")
		return
	}

	// Verify publisher exists and get name
	pubIDInt, err := strconv.Atoi(req.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	publisherName, err := h.db.Queries.GetPublisherNameByID(ctx, int32(pubIDInt))
	if err != nil {
		RespondNotFound(w, r, "Publisher not found")
		return
	}

	// Get user info
	user, err := h.clerkService.GetUser(ctx, userID)
	if err != nil {
		slog.Error("failed to get user", "error", err, "user_id", userID)
		RespondNotFound(w, r, "User not found")
		return
	}

	email := ""
	userName := ""
	if len(user.EmailAddresses) > 0 {
		email = user.EmailAddresses[0].EmailAddress
	}
	if user.FirstName != nil {
		userName = *user.FirstName
	}

	// Get current user's info for "added by" in email
	currentUserID := middleware.GetUserID(ctx)
	addedByName := "An administrator"
	if currentUserID != "" {
		if currentUser, err := h.clerkService.GetUser(ctx, currentUserID); err == nil && currentUser.FirstName != nil {
			addedByName = *currentUser.FirstName
		}
	}

	// Add publisher to user
	if err := h.clerkService.AddPublisherToUser(ctx, userID, req.PublisherID); err != nil {
		slog.Error("failed to add publisher to user", "error", err, "user_id", userID, "publisher_id", req.PublisherID)
		RespondInternalError(w, r, "Failed to add publisher access")
		return
	}

	// Send email notification
	if h.emailService != nil && email != "" {
		go func() {
			if err := h.emailService.SendUserAddedToPublisher(email, userName, publisherName, addedByName, false); err != nil {
				slog.Error("failed to send publisher added email", "error", err, "email", email)
			}
		}()
	}

	slog.Info("publisher added to user",
		"user_id", userID,
		"publisher_id", req.PublisherID,
		"email", email)

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"status":       "success",
		"message":      "Publisher access granted",
		"user_id":      userID,
		"publisher_id": req.PublisherID,
	})
}

// AdminRemovePublisherFromUser removes a publisher from a user's access list
// DELETE /api/v1/admin/users/{userId}/publishers/{publisherId}
func (h *Handlers) AdminRemovePublisherFromUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := chi.URLParam(r, "userId")
	publisherID := chi.URLParam(r, "publisherId")

	if userID == "" {
		RespondValidationError(w, r, "User ID is required", nil)
		return
	}
	if publisherID == "" {
		RespondValidationError(w, r, "Publisher ID is required", nil)
		return
	}

	if h.clerkService == nil {
		RespondInternalError(w, r, "Clerk service not available")
		return
	}

	// Get user info before potential deletion
	user, err := h.clerkService.GetUser(ctx, userID)
	if err != nil {
		slog.Error("failed to get user", "error", err, "user_id", userID)
		RespondNotFound(w, r, "User not found")
		return
	}

	email := ""
	if len(user.EmailAddresses) > 0 {
		email = user.EmailAddresses[0].EmailAddress
	}

	// Remove publisher and check if user should be deleted
	deleted, err := h.clerkService.RemovePublisherFromUserAndCleanup(ctx, userID, publisherID)
	if err != nil {
		slog.Error("failed to remove publisher from user", "error", err, "user_id", userID, "publisher_id", publisherID)
		RespondInternalError(w, r, "Failed to remove publisher access")
		return
	}

	if deleted {
		slog.Info("user deleted after removing last publisher",
			"user_id", userID,
			"publisher_id", publisherID,
			"email", email)

		RespondJSON(w, r, http.StatusOK, map[string]interface{}{
			"status":       "success",
			"message":      "Publisher access removed and user deleted (no remaining roles)",
			"user_id":      userID,
			"publisher_id": publisherID,
			"user_deleted": true,
		})
	} else {
		slog.Info("publisher removed from user",
			"user_id", userID,
			"publisher_id", publisherID,
			"email", email)

		RespondJSON(w, r, http.StatusOK, map[string]interface{}{
			"status":       "success",
			"message":      "Publisher access removed",
			"user_id":      userID,
			"publisher_id": publisherID,
			"user_deleted": false,
		})
	}
}
