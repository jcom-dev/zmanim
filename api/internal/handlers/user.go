package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// RequestPasswordReset sends a password reset email
// POST /api/user/request-password-reset
func (h *Handlers) RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		Email string `json:"email"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	if req.Email == "" || !isValidEmail(req.Email) {
		RespondValidationError(w, r, "Valid email is required", nil)
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))

	// Generate a reset token
	token, err := generateSecureToken()
	if err != nil {
		slog.Error("failed to generate password reset token", "error", err)
		RespondInternalError(w, r, "Failed to process request")
		return
	}

	// Store the token (expires in 1 hour)
	expiresAt := time.Now().Add(1 * time.Hour)
	err = h.db.Queries.StorePasswordResetToken(ctx, sqlcgen.StorePasswordResetTokenParams{
		Email:     email,
		Token:     token,
		ExpiresAt: pgtype.Timestamptz{Time: expiresAt, Valid: true},
	})

	if err != nil {
		slog.Error("failed to store password reset token", "error", err)
		// Don't expose database errors - continue with success response
	}

	// Send the email (non-blocking)
	if h.emailService != nil {
		webURL := os.Getenv("WEB_URL")
		if webURL == "" {
			webURL = "http://localhost:3001"
		}
		resetURL := webURL + "/reset-password?token=" + token
		go func() { _ = h.emailService.SendPasswordReset(email, resetURL, "1 hour") }()
	}

	slog.Info("password reset requested", "email", email)

	// Always return success to prevent email enumeration
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "If an account exists with this email, a password reset link has been sent",
	})
}

// GetPublisherNames returns publisher names for a list of IDs
// GET /api/publishers/names?ids=id1,id2,id3
func (h *Handlers) GetPublisherNames(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	idsParam := r.URL.Query().Get("ids")
	if idsParam == "" {
		RespondJSON(w, r, http.StatusOK, map[string]interface{}{
			"publishers": []interface{}{},
		})
		return
	}

	ids := strings.Split(idsParam, ",")
	if len(ids) == 0 {
		RespondJSON(w, r, http.StatusOK, map[string]interface{}{
			"publishers": []interface{}{},
		})
		return
	}

	// Query publishers
	results, err := h.db.Queries.GetPublisherNamesByIDs(ctx, ids)
	if err != nil {
		slog.Error("failed to get publisher names", "error", err)
		RespondInternalError(w, r, "Failed to retrieve publishers")
		return
	}

	publishers := make([]map[string]interface{}, 0)
	for _, result := range results {
		publishers = append(publishers, map[string]interface{}{
			"id":   result.ID,
			"name": result.Name,
		})
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"publishers": publishers,
	})
}
