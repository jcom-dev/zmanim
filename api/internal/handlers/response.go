// File: response.go
// Purpose: Standard API response format (RespondJSON, APIResponse, error helpers)
// Pattern: response-helpers
// Dependencies: Used by all 32 handler files
// Frequency: critical
// Compliance: Check docs/adr/ for pattern rationale

package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// Standard error codes
const (
	ErrCodeValidation     = "VALIDATION_ERROR"
	ErrCodeNotFound       = "NOT_FOUND"
	ErrCodeUnauthorized   = "UNAUTHORIZED"
	ErrCodeForbidden      = "FORBIDDEN"
	ErrCodeRateLimited    = "RATE_LIMITED"
	ErrCodeInternal       = "INTERNAL_ERROR"
	ErrCodeBadRequest     = "BAD_REQUEST"
	ErrCodeConflict       = "CONFLICT"
	ErrCodeServiceUnavail = "SERVICE_UNAVAILABLE"
)

// APIResponse is the standard response wrapper
type APIResponse struct {
	Data  interface{}   `json:"data,omitempty"`
	Error *APIError     `json:"error,omitempty"`
	Meta  *ResponseMeta `json:"meta,omitempty"`
}

// APIError represents a structured error response
type APIError struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// ResponseMeta contains metadata about the response
type ResponseMeta struct {
	Timestamp string `json:"timestamp"`
	RequestID string `json:"request_id,omitempty"`
}

// RespondJSON sends a successful JSON response with data
func RespondJSON(w http.ResponseWriter, r *http.Request, status int, data interface{}) {
	response := APIResponse{
		Data: data,
		Meta: &ResponseMeta{
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			RequestID: middleware.GetReqID(r.Context()),
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(response)
}

// RespondError sends a structured error response
func RespondError(w http.ResponseWriter, r *http.Request, status int, code, message string, details interface{}) {
	response := APIResponse{
		Error: &APIError{
			Code:    code,
			Message: message,
			Details: details,
		},
		Meta: &ResponseMeta{
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			RequestID: middleware.GetReqID(r.Context()),
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(response)
}

// Helper functions for common error types

// RespondValidationError sends a 400 validation error
func RespondValidationError(w http.ResponseWriter, r *http.Request, message string, details interface{}) {
	RespondError(w, r, http.StatusBadRequest, ErrCodeValidation, message, details)
}

// RespondNotFound sends a 404 not found error
func RespondNotFound(w http.ResponseWriter, r *http.Request, message string) {
	RespondError(w, r, http.StatusNotFound, ErrCodeNotFound, message, nil)
}

// RespondUnauthorized sends a 401 unauthorized error
func RespondUnauthorized(w http.ResponseWriter, r *http.Request, message string) {
	RespondError(w, r, http.StatusUnauthorized, ErrCodeUnauthorized, message, nil)
}

// RespondForbidden sends a 403 forbidden error
func RespondForbidden(w http.ResponseWriter, r *http.Request, message string) {
	RespondError(w, r, http.StatusForbidden, ErrCodeForbidden, message, nil)
}

// RespondRateLimited sends a 429 rate limited error with Retry-After header
func RespondRateLimited(w http.ResponseWriter, r *http.Request, retryAfter int) {
	w.Header().Set("Retry-After", fmt.Sprintf("%d", retryAfter))
	RespondError(w, r, http.StatusTooManyRequests, ErrCodeRateLimited, "Rate limit exceeded", map[string]int{
		"retry_after_seconds": retryAfter,
	})
}

// RespondInternalError sends a 500 internal server error
func RespondInternalError(w http.ResponseWriter, r *http.Request, message string) {
	RespondError(w, r, http.StatusInternalServerError, ErrCodeInternal, message, nil)
}

// RespondBadRequest sends a 400 bad request error
func RespondBadRequest(w http.ResponseWriter, r *http.Request, message string) {
	RespondError(w, r, http.StatusBadRequest, ErrCodeBadRequest, message, nil)
}

// RespondConflict sends a 409 conflict error
func RespondConflict(w http.ResponseWriter, r *http.Request, message string) {
	RespondError(w, r, http.StatusConflict, ErrCodeConflict, message, nil)
}

// RespondServiceUnavailable sends a 503 service unavailable error
func RespondServiceUnavailable(w http.ResponseWriter, r *http.Request, message string) {
	RespondError(w, r, http.StatusServiceUnavailable, ErrCodeServiceUnavail, message, nil)
}
