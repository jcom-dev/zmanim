// File: publisher_registration.go
// Purpose: Unified publisher registration flow (Story 8-37)
// Pattern: handler (6-step pattern)
// Security: CRITICAL - Prevents user enumeration, bot protection
// Dependencies: ClerkService, EmailService, RecaptchaService, registration_tokens table
// Frequency: low - new publisher registration

package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

// StartPublisherRegistrationRequest represents the initial registration request
type StartPublisherRegistrationRequest struct {
	// User info (Step 2)
	FirstName       string `json:"first_name"`
	LastName        string `json:"last_name"`
	RegistrantEmail string `json:"registrant_email"` // User's email for login - can be shared across publishers

	// Publisher info (Step 1)
	PublisherName         string  `json:"publisher_name"`
	PublisherContactEmail string  `json:"publisher_contact_email"` // Must be unique per publisher
	PublisherDescription  string  `json:"publisher_description"`
	PublisherLogo         *string `json:"publisher_logo"` // Base64 data URL (optional)

	// Security
	RecaptchaToken string `json:"recaptcha_token"`
}

// StartPublisherRegistrationResponse is ALWAYS the same (prevents user enumeration)
type StartPublisherRegistrationResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// VerifyRegistrationTokenResponse reveals user status ONLY to token holder
type VerifyRegistrationTokenResponse struct {
	Valid         bool   `json:"valid"`
	UserStatus    string `json:"user_status,omitempty"`     // "existing" or "new"
	UserFirstName string `json:"user_first_name,omitempty"` // For existing users
	PublisherName string `json:"publisher_name,omitempty"`  // From stored data
	Expired       bool   `json:"expired,omitempty"`
	Message       string `json:"message,omitempty"`
}

// ConfirmExistingUserRequest for existing users to confirm identity
type ConfirmExistingUserRequest struct {
	Confirmed bool `json:"confirmed"` // true = "Yes, that's me", false = "No, different person"
}

// AdminRegistrationResponse for admin review queue
type AdminRegistrationResponse struct {
	ID                    string     `json:"id"`
	FirstName             *string    `json:"first_name"`
	LastName              *string    `json:"last_name"`
	RegistrantEmail       string     `json:"registrant_email"`
	PublisherName         string     `json:"publisher_name"`
	PublisherContactEmail string     `json:"publisher_contact_email"`
	PublisherDescription  string     `json:"publisher_description"`
	UserExists            *bool      `json:"user_exists"`
	ConfirmedExisting     *bool      `json:"confirmed_existing_user"`
	RecaptchaScore        *float64   `json:"recaptcha_score"`
	VerifiedAt            *time.Time `json:"verified_at"`
	CreatedAt             time.Time  `json:"created_at"`
	Status                string     `json:"status"`
}

// AdminReviewRequest for approve/reject actions
type AdminReviewRequest struct {
	Action           string  `json:"action"` // "approve" or "reject"
	RejectionMessage *string `json:"rejection_message,omitempty"`
	BlockEmail       bool    `json:"block_email,omitempty"` // Block email on rejection
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// generateRegistrationToken generates a cryptographically secure random token
func generateRegistrationToken() (string, error) {
	bytes := make([]byte, 32) // 256 bits
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// parsePublisherData extracts publisher info from JSONB
func parsePublisherData(data []byte) (name, contactEmail, description string) {
	var publisherData map[string]interface{}
	if err := json.Unmarshal(data, &publisherData); err != nil {
		return "", "", ""
	}
	name, _ = publisherData["publisher_name"].(string)
	contactEmail, _ = publisherData["publisher_contact_email"].(string)
	description, _ = publisherData["publisher_description"].(string)
	return
}

// parsePublisherDataFull extracts all publisher info from JSONB including logo
func parsePublisherDataFull(data []byte) (name, contactEmail, description, logo string) {
	var publisherData map[string]interface{}
	if err := json.Unmarshal(data, &publisherData); err != nil {
		return "", "", "", ""
	}
	name, _ = publisherData["publisher_name"].(string)
	contactEmail, _ = publisherData["publisher_contact_email"].(string)
	description, _ = publisherData["publisher_description"].(string)
	logo, _ = publisherData["publisher_logo"].(string)
	return
}

// getStringOrDefault returns the string value or default if nil
func getStringOrDefault(s *string, def string) string {
	if s == nil {
		return def
	}
	return *s
}

// =============================================================================
// DUPLICATE CHECK (GET /public/publishers/check-duplicate)
// =============================================================================

// CheckDuplicateRequest for checking publisher name or email duplicates
type CheckDuplicateRequest struct {
	PublisherName         string `json:"publisher_name,omitempty"`
	PublisherContactEmail string `json:"publisher_contact_email,omitempty"`
}

// CheckDuplicateResponse returns which fields have duplicates
type CheckDuplicateResponse struct {
	NameExists  bool   `json:"name_exists"`
	EmailExists bool   `json:"email_exists"`
	NameError   string `json:"name_error,omitempty"`
	EmailError  string `json:"email_error,omitempty"`
}

// CheckPublisherDuplicate checks if a publisher name or contact email already exists
//
//	@Summary		Check for duplicate publisher name or email
//	@Description	Checks if a publisher with the given name or contact email already exists
//	@Tags			Publishers
//	@Accept			json
//	@Produce		json
//	@Param			request	body		CheckDuplicateRequest		true	"Fields to check"
//	@Success		200		{object}	CheckDuplicateResponse		"Duplicate check result"
//	@Failure		400		{object}	APIResponse{error=APIError}	"Invalid request"
//	@Router			/public/publishers/check-duplicate [post]
func (h *Handlers) CheckPublisherDuplicate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req CheckDuplicateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	response := CheckDuplicateResponse{}

	// Check publisher name if provided
	if name := strings.TrimSpace(req.PublisherName); name != "" {
		// Check existing publishers
		existsInPublishers, err := h.db.Queries.CheckPublisherNameExists(ctx, name)
		if err != nil {
			slog.Error("failed to check publisher name", "error", err)
		}

		// Check pending registrations
		existsInPending, err := h.db.Queries.CheckPendingRegistrationByName(ctx, name)
		if err != nil {
			slog.Error("failed to check pending registration name", "error", err)
		}

		if existsInPublishers || existsInPending {
			response.NameExists = true
			response.NameError = "A publisher with this name already exists"
		}
	}

	// Check contact email if provided
	if email := strings.TrimSpace(req.PublisherContactEmail); email != "" {
		// Check existing publishers
		existsInPublishers, err := h.db.Queries.CheckPublisherContactEmailExists(ctx, email)
		if err != nil {
			slog.Error("failed to check publisher email", "error", err)
		}

		// Check pending registrations
		existsInPending, err := h.db.Queries.CheckPendingRegistrationByContactEmail(ctx, email)
		if err != nil {
			slog.Error("failed to check pending registration email", "error", err)
		}

		if existsInPublishers || existsInPending {
			response.EmailExists = true
			response.EmailError = "A publisher with this contact email already exists"
		}
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// =============================================================================
// STEP 1: START REGISTRATION (POST /public/publishers/register)
// =============================================================================

// StartPublisherRegistration initiates publisher registration with email verification
// SECURITY CRITICAL: Response MUST be identical whether user exists or not
//
//	@Summary		Start publisher registration
//	@Description	Initiates publisher registration process with email verification
//	@Tags			Publishers
//	@Accept			json
//	@Produce		json
//	@Param			request	body		StartPublisherRegistrationRequest	true	"Registration details"
//	@Success		200		{object}	StartPublisherRegistrationResponse	"Always returns success"
//	@Failure		400		{object}	APIResponse{error=APIError}			"Invalid request"
//	@Failure		500		{object}	APIResponse{error=APIError}			"Internal error"
//	@Router			/public/publishers/register [post]
func (h *Handlers) StartPublisherRegistration(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Step 2: Parse request body
	var req StartPublisherRegistrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Step 4: Validate input
	req.RegistrantEmail = strings.ToLower(strings.TrimSpace(req.RegistrantEmail))
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.PublisherName = strings.TrimSpace(req.PublisherName)
	req.PublisherContactEmail = strings.TrimSpace(req.PublisherContactEmail)

	if req.PublisherName == "" || req.RegistrantEmail == "" {
		RespondBadRequest(w, r, "Publisher name and email are required")
		return
	}

	if req.FirstName == "" || req.LastName == "" {
		RespondBadRequest(w, r, "First name and last name are required")
		return
	}

	// Verify reCAPTCHA token (bot protection)
	var recaptchaScore pgtype.Numeric
	if h.recaptchaService != nil && h.recaptchaService.IsEnabled() {
		score, valid, err := h.recaptchaService.VerifyAndValidate(req.RecaptchaToken, "publisher_registration")
		if err != nil {
			slog.Error("reCAPTCHA verification failed", "error", err)
			// Continue with empty score - don't block on reCAPTCHA errors
		} else if !valid {
			slog.Warn("reCAPTCHA validation failed - likely bot",
				"score", score,
				"email", req.RegistrantEmail)
			// Silent rejection - look like success (prevents bot detection)
			RespondJSON(w, r, http.StatusOK, StartPublisherRegistrationResponse{
				Success: true,
				Message: "Verification email sent. Please check your inbox.",
			})
			return
		} else {
			// Store score for admin review - use Scan() for pgtype.Numeric
			_ = recaptchaScore.Scan(score)
		}
	}

	// Check if email is blocked
	isBlocked, err := h.db.Queries.IsEmailBlocked(ctx, req.RegistrantEmail)
	if err != nil {
		slog.Error("failed to check blocked email", "error", err)
	}
	if isBlocked {
		// Silent rejection - look like success
		slog.Info("blocked email attempted registration", "email", req.RegistrantEmail)
		RespondJSON(w, r, http.StatusOK, StartPublisherRegistrationResponse{
			Success: true,
			Message: "Verification email sent. Please check your inbox.",
		})
		return
	}

	// Generate secure token
	token, err := generateRegistrationToken()
	if err != nil {
		slog.Error("failed to generate token", "error", err)
		RespondInternalError(w, r, "Failed to create registration")
		return
	}

	// Store publisher data as JSON (includes logo if provided)
	publisherData := map[string]interface{}{
		"publisher_name":          req.PublisherName,
		"publisher_contact_email": req.PublisherContactEmail,
		"publisher_description":   req.PublisherDescription,
	}
	if req.PublisherLogo != nil && *req.PublisherLogo != "" {
		publisherData["publisher_logo"] = *req.PublisherLogo
	}
	publisherDataJSON, err := json.Marshal(publisherData)
	if err != nil {
		slog.Error("failed to marshal publisher data", "error", err)
		RespondInternalError(w, r, "Failed to create registration")
		return
	}

	// Step 5: Create registration token
	_, err = h.db.Queries.CreateRegistrationToken(ctx, sqlcgen.CreateRegistrationTokenParams{
		FirstName:       &req.FirstName,
		LastName:        &req.LastName,
		RegistrantEmail: req.RegistrantEmail,
		PublisherData:   publisherDataJSON,
		Token:           token,
		RecaptchaScore:  recaptchaScore,
	})

	if err != nil {
		slog.Error("failed to create registration token", "error", err)
		RespondInternalError(w, r, "Failed to create registration")
		return
	}

	// Send verification email
	if h.emailService != nil && h.emailService.IsEnabled() {
		verificationURL := h.emailService.GetWebURL() + "/register/verify/" + token
		err = h.emailService.SendPublisherRegistrationVerification(req.RegistrantEmail, req.PublisherName, verificationURL)
		if err != nil {
			slog.Error("failed to send verification email", "error", err, "email", req.RegistrantEmail)
			// Don't return error - registration was created, email can be retried
		} else {
			slog.Info("verification email sent", "email", req.RegistrantEmail)
		}
	} else {
		slog.Warn("email service not configured, verification email not sent",
			"email", req.RegistrantEmail,
			"token", token[:8]+"...", // Only log first 8 chars for security
		)
	}

	slog.Info("registration token created",
		"registrant_email", req.RegistrantEmail,
		"publisher_name", req.PublisherName)

	// Step 6: ALWAYS return the same response (prevents user enumeration)
	RespondJSON(w, r, http.StatusOK, StartPublisherRegistrationResponse{
		Success: true,
		Message: "Verification email sent. Please check your inbox.",
	})
}

// =============================================================================
// STEP 2: VERIFY TOKEN (GET /public/publishers/register/verify/{token})
// =============================================================================

// VerifyRegistrationToken verifies a registration token and returns user status
//
//	@Summary		Verify registration token
//	@Description	Verifies registration token and returns user status
//	@Tags			Publishers
//	@Produce		json
//	@Param			token	path		string							true	"Registration token"
//	@Success		200		{object}	VerifyRegistrationTokenResponse	"Token verified"
//	@Failure		400		{object}	APIResponse{error=APIError}		"Invalid token"
//	@Failure		404		{object}	APIResponse{error=APIError}		"Token not found"
//	@Router			/public/publishers/register/verify/{token} [get]
func (h *Handlers) VerifyRegistrationToken(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Step 2: Get token from URL
	token := chi.URLParam(r, "token")
	if token == "" {
		RespondBadRequest(w, r, "Missing token")
		return
	}

	// Step 5: Get token from database
	regToken, err := h.db.Queries.GetRegistrationTokenByToken(ctx, token)
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Invalid or expired token")
			return
		}
		slog.Error("failed to get registration token", "error", err)
		RespondInternalError(w, r, "Failed to verify token")
		return
	}

	// Check if token has expired
	if regToken.ExpiresAt.Valid && time.Now().After(regToken.ExpiresAt.Time) {
		RespondJSON(w, r, http.StatusOK, VerifyRegistrationTokenResponse{
			Valid:   false,
			Expired: true,
			Message: "This verification link has expired. Please start a new registration.",
		})
		return
	}

	// Check status
	switch regToken.Status {
	case "approved":
		RespondJSON(w, r, http.StatusOK, VerifyRegistrationTokenResponse{
			Valid:   false,
			Message: "This registration has already been approved.",
		})
		return
	case "rejected":
		RespondJSON(w, r, http.StatusOK, VerifyRegistrationTokenResponse{
			Valid:   false,
			Message: "This registration request was not approved.",
		})
		return
	case "cancelled":
		RespondJSON(w, r, http.StatusOK, VerifyRegistrationTokenResponse{
			Valid:   false,
			Message: "This registration has been cancelled.",
		})
		return
	}

	// Parse publisher data
	publisherName, _, _ := parsePublisherData(regToken.PublisherData)

	// If already verified, return existing state
	if regToken.Status == "verified" {
		response := VerifyRegistrationTokenResponse{
			Valid:         true,
			PublisherName: publisherName,
		}

		if regToken.UserExists != nil && *regToken.UserExists {
			response.UserStatus = "existing"
			// Get user name from Clerk if available
			if h.clerkService != nil {
				if user, err := h.clerkService.GetUserByEmail(ctx, regToken.RegistrantEmail); err == nil && user != nil && user.FirstName != nil {
					response.UserFirstName = *user.FirstName
				}
			}
		} else {
			response.UserStatus = "new"
		}

		RespondJSON(w, r, http.StatusOK, response)
		return
	}

	// Check if user exists in Clerk (server-side check)
	var userExists bool
	var existingClerkUserID *string
	var userFirstName string

	if h.clerkService != nil {
		user, err := h.clerkService.GetUserByEmail(ctx, regToken.RegistrantEmail)
		if err != nil {
			slog.Error("failed to check user existence", "error", err, "email", regToken.RegistrantEmail)
			// Continue anyway - treat as new user on error
		} else if user != nil {
			userExists = true
			existingClerkUserID = &user.ID
			if user.FirstName != nil {
				userFirstName = *user.FirstName
			}
		}
	}

	// Update token status to 'verified' and store user info
	err = h.db.Queries.MarkTokenVerified(ctx, sqlcgen.MarkTokenVerifiedParams{
		Token:               token,
		UserExists:          &userExists,
		ExistingClerkUserID: existingClerkUserID,
	})
	if err != nil {
		slog.Error("failed to mark token verified", "error", err)
		// Non-critical - continue
	}

	// Step 6: Return user status (ONLY to the token holder)
	response := VerifyRegistrationTokenResponse{
		Valid:         true,
		PublisherName: publisherName,
	}

	if userExists {
		response.UserStatus = "existing"
		response.UserFirstName = userFirstName
	} else {
		response.UserStatus = "new"
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// =============================================================================
// STEP 3: CONFIRM REGISTRATION (POST /public/publishers/register/confirm/{token})
// =============================================================================

// ConfirmExistingUserRegistration handles registration confirmation for both new and existing users
// - For existing users: "Yes, that's me" / "No, not me"
// - For new users: Acknowledges email verification and proceeds to admin review
//
//	@Summary		Confirm registration
//	@Description	Confirms email verification and submits for admin review
//	@Tags			Publishers
//	@Accept			json
//	@Produce		json
//	@Param			token	path		string						true	"Registration token"
//	@Param			request	body		ConfirmExistingUserRequest	true	"Confirmation"
//	@Success		200		{object}	APIResponse{data=object}	"Confirmation processed"
//	@Failure		400		{object}	APIResponse{error=APIError}	"Invalid request"
//	@Failure		404		{object}	APIResponse{error=APIError}	"Token not found"
//	@Router			/public/publishers/register/confirm/{token} [post]
func (h *Handlers) ConfirmExistingUserRegistration(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	token := chi.URLParam(r, "token")
	if token == "" {
		RespondBadRequest(w, r, "Missing token")
		return
	}

	var req ConfirmExistingUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Get token
	regToken, err := h.db.Queries.GetRegistrationTokenByToken(ctx, token)
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Invalid or expired token")
			return
		}
		slog.Error("failed to get registration token", "error", err)
		RespondInternalError(w, r, "Failed to process confirmation")
		return
	}

	// Validate status
	if regToken.Status != "verified" {
		RespondBadRequest(w, r, "Token must be verified first")
		return
	}

	// Parse publisher data
	publisherName, _, _ := parsePublisherData(regToken.PublisherData)

	// Check if this is an existing user
	isExistingUser := regToken.UserExists != nil && *regToken.UserExists

	if !req.Confirmed {
		if isExistingUser {
			// Existing user said "No, not me" - cancel registration
			err = h.db.Queries.CancelRegistration(ctx, token)
			if err != nil {
				slog.Error("failed to cancel registration", "error", err)
			}

			RespondJSON(w, r, http.StatusOK, map[string]interface{}{
				"success": true,
				"message": "Registration cancelled. If you'd like to register as a new publisher, please use a different email address.",
			})
			return
		}
		// New user declining doesn't make sense, but handle gracefully
		RespondBadRequest(w, r, "New users must confirm to proceed with registration")
		return
	}

	// User confirmed
	if isExistingUser {
		// Mark as confirmed for existing user
		err = h.db.Queries.ConfirmExistingUser(ctx, token)
		if err != nil {
			slog.Error("failed to confirm existing user", "error", err)
			RespondInternalError(w, r, "Failed to confirm")
			return
		}

		slog.Info("existing user confirmed publisher registration",
			"email", regToken.RegistrantEmail,
			"publisher_name", publisherName,
			"clerk_user_id", regToken.ExistingClerkUserID)
	} else {
		// New user - just log confirmation (status already 'verified')
		slog.Info("new user confirmed publisher registration",
			"email", regToken.RegistrantEmail,
			"publisher_name", publisherName)
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Your publisher application has been submitted for admin review. You'll receive an email once it's been reviewed.",
	})
}

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

// GetVerifiedRegistrations returns all verified registrations for admin review
//
//	@Summary		Get verified registrations for review
//	@Description	Returns all verified publisher registrations awaiting admin approval
//	@Tags			Admin
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	APIResponse{data=[]AdminRegistrationResponse}	"Registrations"
//	@Failure		401	{object}	APIResponse{error=APIError}						"Unauthorized"
//	@Failure		500	{object}	APIResponse{error=APIError}						"Internal error"
//	@Router			/admin/publishers/registrations [get]
func (h *Handlers) GetVerifiedRegistrations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	status := r.URL.Query().Get("status")
	if status == "" {
		status = "verified"
	}

	var registrations []sqlcgen.PublisherRegistrationToken
	var err error

	if status == "all" {
		// Get all statuses
		registrations, err = h.db.Queries.GetRegistrationsByStatus(ctx, "verified")
		if err == nil {
			approved, _ := h.db.Queries.GetRegistrationsByStatus(ctx, "approved")
			rejected, _ := h.db.Queries.GetRegistrationsByStatus(ctx, "rejected")
			registrations = append(registrations, approved...)
			registrations = append(registrations, rejected...)
		}
	} else {
		registrations, err = h.db.Queries.GetRegistrationsByStatus(ctx, status)
	}

	if err != nil {
		slog.Error("failed to get registrations", "error", err)
		RespondInternalError(w, r, "Failed to get registrations")
		return
	}

	// Map to response format
	response := make([]AdminRegistrationResponse, 0, len(registrations))
	for _, reg := range registrations {
		pubName, pubEmail, pubDesc := parsePublisherData(reg.PublisherData)

		var recaptchaScore *float64
		if reg.RecaptchaScore.Valid {
			// Convert pgtype.Numeric back to float64
			floatVal, _ := reg.RecaptchaScore.Float64Value()
			if floatVal.Valid {
				recaptchaScore = &floatVal.Float64
			}
		}

		var verifiedAt *time.Time
		if reg.VerifiedAt.Valid {
			verifiedAt = &reg.VerifiedAt.Time
		}

		var createdAt time.Time
		if reg.CreatedAt.Valid {
			createdAt = reg.CreatedAt.Time
		}

		response = append(response, AdminRegistrationResponse{
			ID:                    reg.ID,
			FirstName:             reg.FirstName,
			LastName:              reg.LastName,
			RegistrantEmail:       reg.RegistrantEmail,
			PublisherName:         pubName,
			PublisherContactEmail: pubEmail,
			PublisherDescription:  pubDesc,
			UserExists:            reg.UserExists,
			ConfirmedExisting:     reg.ConfirmedExistingUser,
			RecaptchaScore:        recaptchaScore,
			VerifiedAt:            verifiedAt,
			CreatedAt:             createdAt,
			Status:                reg.Status,
		})
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// ReviewPublisherRegistration approves or rejects a publisher registration
//
//	@Summary		Review publisher registration
//	@Description	Approve or reject a verified publisher registration
//	@Tags			Admin
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string						true	"Registration ID"
//	@Param			request	body		AdminReviewRequest			true	"Review action"
//	@Success		200		{object}	APIResponse{data=object}	"Review processed"
//	@Failure		400		{object}	APIResponse{error=APIError}	"Invalid request"
//	@Failure		404		{object}	APIResponse{error=APIError}	"Registration not found"
//	@Router			/admin/publishers/registrations/{id}/review [post]
func (h *Handlers) ReviewPublisherRegistration(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	id := chi.URLParam(r, "id")
	if id == "" {
		RespondBadRequest(w, r, "Missing registration ID")
		return
	}

	var req AdminReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	if req.Action != "approve" && req.Action != "reject" {
		RespondBadRequest(w, r, "Action must be 'approve' or 'reject'")
		return
	}

	// Get registration
	regToken, err := h.db.Queries.GetRegistrationTokenByID(ctx, id)
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Registration not found")
			return
		}
		slog.Error("failed to get registration", "error", err)
		RespondInternalError(w, r, "Failed to get registration")
		return
	}

	if regToken.Status != "verified" {
		RespondBadRequest(w, r, "Can only review verified registrations")
		return
	}

	// Get admin user ID
	adminUserID := r.Header.Get("X-User-Id")
	if adminUserID == "" {
		adminUserID = "unknown"
	}

	pubName, pubContactEmail, pubDescription, pubLogo := parsePublisherDataFull(regToken.PublisherData)

	if req.Action == "reject" {
		// Reject registration
		err = h.db.Queries.RejectRegistration(ctx, sqlcgen.RejectRegistrationParams{
			ID:               id,
			ReviewedBy:       &adminUserID,
			RejectionMessage: req.RejectionMessage,
		})
		if err != nil {
			slog.Error("failed to reject registration", "error", err)
			RespondInternalError(w, r, "Failed to reject registration")
			return
		}

		// Optionally block email
		if req.BlockEmail {
			reason := "Rejected during publisher registration review"
			if req.RejectionMessage != nil {
				reason = *req.RejectionMessage
			}
			_ = h.db.Queries.BlockEmail(ctx, sqlcgen.BlockEmailParams{
				Email:     regToken.RegistrantEmail,
				BlockedBy: adminUserID,
				Reason:    &reason,
			})
		}

		// Send rejection email
		if h.emailService != nil && h.emailService.IsEnabled() {
			firstName := getStringOrDefault(regToken.FirstName, "")
			rejectionReason := ""
			if req.RejectionMessage != nil {
				rejectionReason = *req.RejectionMessage
			}
			err := h.emailService.SendPublisherRegistrationRejected(regToken.RegistrantEmail, firstName, pubName, rejectionReason)
			if err != nil {
				slog.Error("failed to send rejection email", "error", err, "email", regToken.RegistrantEmail)
			}
		}

		slog.Info("publisher registration rejected",
			"registration_id", id,
			"email", regToken.RegistrantEmail,
			"admin", adminUserID)

		RespondJSON(w, r, http.StatusOK, map[string]interface{}{
			"success": true,
			"message": "Registration rejected",
		})
		return
	}

	// APPROVE registration
	err = h.db.Queries.ApproveRegistration(ctx, sqlcgen.ApproveRegistrationParams{
		ID:         id,
		ReviewedBy: &adminUserID,
	})
	if err != nil {
		slog.Error("failed to approve registration", "error", err)
		RespondInternalError(w, r, "Failed to approve registration")
		return
	}

	// Create or link Clerk user
	var clerkUserID string

	if regToken.UserExists != nil && *regToken.UserExists && regToken.ExistingClerkUserID != nil {
		// Existing user - use their Clerk ID
		clerkUserID = *regToken.ExistingClerkUserID
	} else {
		// New user - create Clerk account with magic link
		if h.clerkService != nil {
			name := getStringOrDefault(regToken.FirstName, "") + " " + getStringOrDefault(regToken.LastName, "")
			user, err := h.clerkService.CreateUserDirectly(ctx, regToken.RegistrantEmail, name, false, []string{})
			if err != nil {
				slog.Error("failed to create Clerk user", "error", err)
				RespondInternalError(w, r, "Failed to create user account")
				return
			}
			clerkUserID = user.ID
		}
	}

	// Create publisher directly in database (already admin-approved)
	// Status ID 2 = 'active' (bypassing pending since admin already reviewed)
	var clerkUserIDPtr *string
	if clerkUserID != "" {
		clerkUserIDPtr = &clerkUserID
	}

	// Use contact email from publisher data, fallback to registrant email
	contactEmail := pubContactEmail
	if contactEmail == "" {
		contactEmail = regToken.RegistrantEmail
	}

	// Note: Description and LogoData are not available in CreatePublisherParams
	// They would need to be added via a separate UPDATE query if needed
	_ = pubDescription // Unused for now
	_ = pubLogo        // Unused for now

	_, err = h.db.Queries.CreatePublisher(ctx, sqlcgen.CreatePublisherParams{
		Name:         pubName,
		ContactEmail: contactEmail,
		StatusID:     2, // active status
		ClerkUserID:  clerkUserIDPtr,
	})
	if err != nil {
		slog.Error("failed to create publisher", "error", err)
		RespondInternalError(w, r, "Failed to create publisher")
		return
	}

	// Send approval email
	if h.emailService != nil && h.emailService.IsEnabled() {
		firstName := getStringOrDefault(regToken.FirstName, "")
		signInURL := h.emailService.GetWebURL() + "/sign-in"
		err := h.emailService.SendPublisherRegistrationApproved(regToken.RegistrantEmail, firstName, pubName, signInURL)
		if err != nil {
			slog.Error("failed to send approval email", "error", err, "email", regToken.RegistrantEmail)
		}
	}

	slog.Info("publisher registration approved",
		"registration_id", id,
		"email", regToken.RegistrantEmail,
		"publisher_name", pubName,
		"clerk_user_id", clerkUserID,
		"admin", adminUserID)

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success":        true,
		"message":        "Registration approved. Publisher account created.",
		"publisher_name": pubName,
		"clerk_user_id":  clerkUserID,
	})
}

// =============================================================================
// CLEANUP ENDPOINTS
// =============================================================================

// CleanupExpiredRegistrationTokens removes expired registration tokens
//
//	@Summary		Cleanup expired registration tokens
//	@Description	Removes expired and old completed registration tokens
//	@Tags			System
//	@Produce		json
//	@Success		200	{object}	APIResponse{data=object}	"Cleanup completed"
//	@Failure		500	{object}	APIResponse{error=APIError}	"Internal error"
//	@Router			/internal/cleanup/registration-tokens [post]
func (h *Handlers) CleanupExpiredRegistrationTokens(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Mark expired tokens
	expiredCount, err := h.db.Queries.CleanupExpiredTokens(ctx)
	if err != nil {
		slog.Error("failed to mark expired tokens", "error", err)
		RespondInternalError(w, r, "Cleanup failed")
		return
	}

	// Delete old expired/cancelled tokens
	err = h.db.Queries.DeleteExpiredRegistrationTokens(ctx)
	if err != nil {
		slog.Error("failed to delete expired tokens", "error", err)
		RespondInternalError(w, r, "Cleanup failed")
		return
	}

	// Delete old completed tokens
	err = h.db.Queries.DeleteOldCompletedTokens(ctx)
	if err != nil {
		slog.Error("failed to delete old completed tokens", "error", err)
		RespondInternalError(w, r, "Cleanup failed")
		return
	}

	// Get cleanup stats
	stats, err := h.db.Queries.GetRegistrationTokenStats(ctx)
	if err != nil {
		slog.Error("failed to get token stats", "error", err)
	}

	slog.Info("registration tokens cleaned up",
		"newly_expired", expiredCount,
		"remaining_pending", stats.PendingCount,
		"remaining_verified", stats.VerifiedCount,
		"remaining_approved", stats.ApprovedCount,
		"remaining_rejected", stats.RejectedCount)

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Cleanup completed",
		"stats": map[string]interface{}{
			"newly_expired": expiredCount,
			"pending":       stats.PendingCount,
			"verified":      stats.VerifiedCount,
			"approved":      stats.ApprovedCount,
			"rejected":      stats.RejectedCount,
		},
	})
}

// =============================================================================
// BLOCKED EMAILS ADMIN
// =============================================================================

// GetBlockedEmails returns all blocked emails
//
//	@Summary		Get blocked emails
//	@Description	Returns list of all blocked email addresses
//	@Tags			Admin
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	APIResponse{data=[]object}	"Blocked emails"
//	@Router			/admin/blocked-emails [get]
func (h *Handlers) GetBlockedEmails(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	blocked, err := h.db.Queries.GetBlockedEmails(ctx)
	if err != nil {
		slog.Error("failed to get blocked emails", "error", err)
		RespondInternalError(w, r, "Failed to get blocked emails")
		return
	}

	RespondJSON(w, r, http.StatusOK, blocked)
}

// BlockEmail adds an email to the block list
//
//	@Summary		Block email
//	@Description	Block an email address from future registrations
//	@Tags			Admin
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			request	body		object{email=string,reason=string}	true	"Email to block"
//	@Success		200		{object}	APIResponse{data=object}			"Email blocked"
//	@Router			/admin/blocked-emails [post]
func (h *Handlers) BlockEmail(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		Email  string  `json:"email"`
		Reason *string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	if req.Email == "" {
		RespondBadRequest(w, r, "Email is required")
		return
	}

	adminUserID := r.Header.Get("X-User-Id")
	if adminUserID == "" {
		adminUserID = "unknown"
	}

	err := h.db.Queries.BlockEmail(ctx, sqlcgen.BlockEmailParams{
		Email:     req.Email,
		BlockedBy: adminUserID,
		Reason:    req.Reason,
	})
	if err != nil {
		slog.Error("failed to block email", "error", err)
		RespondInternalError(w, r, "Failed to block email")
		return
	}

	slog.Info("email blocked", "email", req.Email, "admin", adminUserID)

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Email blocked",
	})
}

// UnblockEmail removes an email from the block list
//
//	@Summary		Unblock email
//	@Description	Remove an email address from the block list
//	@Tags			Admin
//	@Produce		json
//	@Security		BearerAuth
//	@Param			email	path		string						true	"Email to unblock"
//	@Success		200		{object}	APIResponse{data=object}	"Email unblocked"
//	@Router			/admin/blocked-emails/{email} [delete]
func (h *Handlers) UnblockEmail(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	email := chi.URLParam(r, "email")
	if email == "" {
		RespondBadRequest(w, r, "Email is required")
		return
	}

	err := h.db.Queries.UnblockEmail(ctx, email)
	if err != nil {
		slog.Error("failed to unblock email", "error", err)
		RespondInternalError(w, r, "Failed to unblock email")
		return
	}

	adminUserID := r.Header.Get("X-User-Id")
	slog.Info("email unblocked", "email", email, "admin", adminUserID)

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Email unblocked",
	})
}
