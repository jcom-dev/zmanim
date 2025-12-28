package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/middleware"
	"github.com/jcom-dev/zmanim/internal/services"
)

// PublisherRequest represents a publisher registration request
type PublisherRequest struct {
	ID              string     `json:"id"`
	Name            string     `json:"name"`
	Email           string     `json:"email"`
	Website         *string    `json:"website,omitempty"`
	Description     string     `json:"description"`
	Status          string     `json:"status"`
	RejectionReason *string    `json:"rejection_reason,omitempty"`
	ReviewedBy      *string    `json:"reviewed_by,omitempty"`
	ReviewedAt      *time.Time `json:"reviewed_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

// SubmitPublisherRequest handles public publisher registration requests
// POST /api/publisher-requests
func (h *Handlers) SubmitPublisherRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		Name        string  `json:"name"`
		Email       string  `json:"email"`
		Website     *string `json:"website"`
		Description string  `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Validate required fields
	validationErrors := make(map[string]string)
	if strings.TrimSpace(req.Name) == "" {
		validationErrors["name"] = "Name is required"
	}
	if strings.TrimSpace(req.Email) == "" {
		validationErrors["email"] = "Email is required"
	} else if !isValidEmail(req.Email) {
		validationErrors["email"] = "Invalid email format"
	}
	// Description is optional

	if len(validationErrors) > 0 {
		RespondValidationError(w, r, "Invalid request parameters", validationErrors)
		return
	}

	// Check for duplicate pending/approved requests
	existingCount, err := h.db.Queries.CheckExistingPublisherRequest(ctx, req.Email)
	if err != nil {
		slog.Error("failed to check for existing requests", "error", err)
		RespondInternalError(w, r, "Failed to process request")
		return
	}

	if existingCount > 0 {
		RespondConflict(w, r, "A request for this email is already pending or has been processed")
		return
	}

	// Insert the request
	var organization *string
	var message *string
	if req.Website != nil {
		organization = req.Website
	}
	if req.Description != "" {
		message = &req.Description
	}

	result, err := h.db.Queries.CreatePublisherRequest(ctx, sqlcgen.CreatePublisherRequestParams{
		Name:         strings.TrimSpace(req.Name),
		Email:        strings.ToLower(strings.TrimSpace(req.Email)),
		Organization: organization,
		Message:      message,
	})

	if err != nil {
		slog.Error("failed to create publisher request", "error", err)
		RespondInternalError(w, r, "Failed to submit request")
		return
	}

	slog.Info("publisher request submitted",
		"id", result.ID,
		"email", req.Email,
		"name", req.Name)

	// Send confirmation email to applicant (non-blocking)
	if h.emailService != nil {
		go func() {
			_ = h.emailService.SendPublisherRequestReceived(
				req.Email,
				strings.TrimSpace(req.Name),
				strings.TrimSpace(req.Name), // Publisher name IS the organization
			)
		}()

		// Send notification to admin (if ADMIN_EMAIL is configured)
		adminEmail := os.Getenv("ADMIN_EMAIL")
		if adminEmail != "" {
			webURL := os.Getenv("WEB_URL")
			if webURL == "" {
				webURL = "http://localhost:3001"
			}
			adminURL := fmt.Sprintf("%s/admin/publishers", webURL)
			go func() {
				_ = h.emailService.SendAdminNewPublisherRequest(
					adminEmail,
					strings.TrimSpace(req.Name),
					strings.TrimSpace(req.Name), // Publisher name IS the organization
					req.Email,
					strings.TrimSpace(req.Description),
					adminURL,
				)
			}()
		}
	}

	RespondJSON(w, r, http.StatusCreated, map[string]interface{}{
		"success": true,
		"message": "Thank you! Your request has been submitted. We'll review it and get back to you soon.",
		"id":      result.ID,
	})
}

// AdminGetPublisherRequests returns pending publisher requests
// GET /api/admin/publisher-requests
func (h *Handlers) AdminGetPublisherRequests(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	status := r.URL.Query().Get("status")
	if status == "" {
		status = "pending"
	}

	rows, err := h.db.Queries.GetPublisherRequestsByStatus(ctx, status)
	if err != nil {
		slog.Error("failed to query publisher requests", "error", err)
		RespondInternalError(w, r, "Failed to retrieve requests")
		return
	}

	requests := make([]PublisherRequest, 0, len(rows))
	for _, row := range rows {
		var req PublisherRequest
		req.ID = fmt.Sprintf("%d", row.ID)
		req.Name = row.Name
		req.Email = row.Email
		req.Website = row.Organization
		if row.Message != nil {
			req.Description = *row.Message
		}
		req.Status = row.Status
		req.ReviewedBy = row.ReviewedBy
		if row.ReviewedAt.Valid {
			t := row.ReviewedAt.Time
			req.ReviewedAt = &t
		}
		if row.CreatedAt.Valid {
			req.CreatedAt = row.CreatedAt.Time
		}
		requests = append(requests, req)
	}

	// Get counts for all statuses
	pendingCount, _ := h.db.Queries.CountPublisherRequestsByStatus(ctx, "pending")
	approvedCount, _ := h.db.Queries.CountPublisherRequestsByStatus(ctx, "approved")
	rejectedCount, _ := h.db.Queries.CountPublisherRequestsByStatus(ctx, "rejected")

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"data": requests,
		"meta": map[string]int64{
			"total":    int64(len(requests)),
			"pending":  pendingCount,
			"approved": approvedCount,
			"rejected": rejectedCount,
		},
	})
}

// AdminApprovePublisherRequest approves a publisher request
// POST /api/admin/publisher-requests/{id}/approve
func (h *Handlers) AdminApprovePublisherRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	requestID := chi.URLParam(r, "id")

	if requestID == "" {
		RespondValidationError(w, r, "Request ID is required", nil)
		return
	}

	// Get admin user ID from context
	adminUserID := middleware.GetUserID(ctx)

	// Convert requestID string to int32
	var requestIDInt int32
	_, err := fmt.Sscanf(requestID, "%d", &requestIDInt)
	if err != nil {
		RespondBadRequest(w, r, "Invalid request ID format")
		return
	}

	// Get the request details
	row, err := h.db.Queries.GetPublisherRequestByID(ctx, requestIDInt)
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Request not found")
			return
		}
		slog.Error("failed to get publisher request", "error", err)
		RespondInternalError(w, r, "Failed to retrieve request")
		return
	}

	if row.Status != "pending" {
		RespondBadRequest(w, r, fmt.Sprintf("Request is already %s", row.Status))
		return
	}

	// Start transaction
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		slog.Error("failed to start transaction", "error", err)
		RespondInternalError(w, r, "Failed to process request")
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Create transaction-aware queries
	qtx := h.db.Queries.WithTx(tx)

	// Create the publisher
	slug := generateSlug(row.Name) // Publisher name IS the organization
	var description *string
	if row.Message != nil {
		description = row.Message
	}

	publisher, err := qtx.CreatePublisherFromRequest(ctx, sqlcgen.CreatePublisherFromRequestParams{
		Name:         row.Name,
		Slug:         &slug,
		ContactEmail: row.Email,
		Description:  description,
	})

	if err != nil {
		slog.Error("failed to create publisher", "error", err)
		RespondInternalError(w, r, "Failed to create publisher")
		return
	}

	// Update request status
	err = qtx.ApprovePublisherRequest(ctx, sqlcgen.ApprovePublisherRequestParams{
		ID:         requestIDInt,
		ReviewedBy: &adminUserID,
	})

	if err != nil {
		slog.Error("failed to update request status", "error", err)
		RespondInternalError(w, r, "Failed to update request")
		return
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		slog.Error("failed to commit transaction", "error", err)
		RespondInternalError(w, r, "Failed to process request")
		return
	}

	publisherID := fmt.Sprintf("%d", publisher.ID)

	// Log admin action
	_ = h.activityService.LogAdminAction(ctx, r, services.AdminAuditParams{
		ActionType:        services.ActionAdminRequestApprove,
		ResourceType:      "publisher_request",
		ResourceID:        requestID,
		ResourceName:      row.Name,
		TargetPublisherID: publisherID,
		ChangesBefore: map[string]interface{}{
			"status": "pending",
		},
		ChangesAfter: map[string]interface{}{
			"status":       "approved",
			"publisher_id": publisherID,
		},
		Severity: services.SeverityInfo,
		Status:   "success",
	})

	// Send approval email (non-blocking)
	if h.emailService != nil {
		webURL := os.Getenv("WEB_URL")
		if webURL == "" {
			webURL = "http://localhost:3001"
		}
		dashboardURL := fmt.Sprintf("%s/publisher", webURL)
		go func() { _ = h.emailService.SendPublisherApproved(row.Email, row.Name, dashboardURL) }()
	}

	slog.Info("publisher request approved",
		"request_id", requestID,
		"publisher_id", publisherID,
		"admin", adminUserID)

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success":      true,
		"publisher_id": publisherID,
		"message":      "Publisher account created and welcome email sent",
	})
}

// AdminRejectPublisherRequest rejects a publisher request
// POST /api/admin/publisher-requests/{id}/reject
func (h *Handlers) AdminRejectPublisherRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	requestID := chi.URLParam(r, "id")

	if requestID == "" {
		RespondValidationError(w, r, "Request ID is required", nil)
		return
	}

	var reqBody struct {
		Reason string `json:"reason"`
	}
	_ = json.NewDecoder(r.Body).Decode(&reqBody)

	// Get admin user ID from context
	adminUserID := middleware.GetUserID(ctx)

	// Convert requestID string to int32
	var requestIDInt int32
	_, err := fmt.Sscanf(requestID, "%d", &requestIDInt)
	if err != nil {
		RespondBadRequest(w, r, "Invalid request ID format")
		return
	}

	// Get the request details first
	row, err := h.db.Queries.GetPublisherRequestByID(ctx, requestIDInt)
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Request not found")
			return
		}
		slog.Error("failed to get publisher request", "error", err)
		RespondInternalError(w, r, "Failed to retrieve request")
		return
	}

	if row.Status != "pending" {
		RespondBadRequest(w, r, fmt.Sprintf("Request is already %s", row.Status))
		return
	}

	// Update request status
	err = h.db.Queries.RejectPublisherRequest(ctx, sqlcgen.RejectPublisherRequestParams{
		ID:         requestIDInt,
		ReviewedBy: &adminUserID,
	})

	if err != nil {
		slog.Error("failed to reject publisher request", "error", err)
		RespondInternalError(w, r, "Failed to reject request")
		return
	}

	// Log admin action
	_ = h.activityService.LogAdminAction(ctx, r, services.AdminAuditParams{
		ActionType:   services.ActionAdminRequestReject,
		ResourceType: "publisher_request",
		ResourceID:   requestID,
		ResourceName: row.Name,
		ChangesBefore: map[string]interface{}{
			"status": "pending",
		},
		ChangesAfter: map[string]interface{}{
			"status": "rejected",
		},
		Reason:   reqBody.Reason,
		Severity: services.SeverityInfo,
		Status:   "success",
	})

	// Send rejection email (non-blocking)
	if h.emailService != nil {
		reason := "Your application did not meet our current requirements."
		if reqBody.Reason != "" {
			reason = reqBody.Reason
		}
		go func() { _ = h.emailService.SendPublisherRejected(row.Email, row.Name, reason) }()
	}

	slog.Info("publisher request rejected",
		"request_id", requestID,
		"reason", reqBody.Reason,
		"admin", adminUserID)

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Request rejected",
	})
}

// Helper function to validate email format
func isValidEmail(email string) bool {
	// Basic validation - contains @ and at least one dot after @
	atIndex := strings.Index(email, "@")
	if atIndex < 1 {
		return false
	}
	dotIndex := strings.LastIndex(email[atIndex:], ".")
	return dotIndex > 1 && dotIndex < len(email[atIndex:])-1
}

// generateSecureToken generates a cryptographically secure random token
func generateSecureToken() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}
