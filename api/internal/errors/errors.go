// Package errors provides structured error types and utilities for the Shtetl Zmanim API.
// All errors implement the standard error interface and provide additional context.
package errors

import (
	"fmt"
	"net/http"
)

// ErrorCode represents a machine-readable error code
type ErrorCode string

// Standard error codes
const (
	// Client errors (4xx)
	ErrCodeBadRequest      ErrorCode = "BAD_REQUEST"
	ErrCodeUnauthorized    ErrorCode = "UNAUTHORIZED"
	ErrCodeForbidden       ErrorCode = "FORBIDDEN"
	ErrCodeNotFound        ErrorCode = "NOT_FOUND"
	ErrCodeConflict        ErrorCode = "CONFLICT"
	ErrCodeValidation      ErrorCode = "VALIDATION_ERROR"
	ErrCodeRateLimited     ErrorCode = "RATE_LIMITED"
	ErrCodeRequestTooLarge ErrorCode = "REQUEST_TOO_LARGE"

	// Server errors (5xx)
	ErrCodeInternal        ErrorCode = "INTERNAL_ERROR"
	ErrCodeDatabaseError   ErrorCode = "DATABASE_ERROR"
	ErrCodeExternalService ErrorCode = "EXTERNAL_SERVICE_ERROR"
	ErrCodeTimeout         ErrorCode = "TIMEOUT"
)

// APIError represents a structured API error with HTTP status and code
type APIError struct {
	// HTTP status code
	Status int `json:"-"`
	// Machine-readable error code
	Code ErrorCode `json:"code"`
	// Human-readable error message
	Message string `json:"error"`
	// Optional field-level validation errors
	Details map[string]string `json:"details,omitempty"`
	// Original error (not exposed in JSON)
	Cause error `json:"-"`
}

// Error implements the error interface
func (e *APIError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s (caused by: %v)", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Unwrap returns the underlying cause for errors.Is/As support
func (e *APIError) Unwrap() error {
	return e.Cause
}

// WithCause attaches an underlying error as the cause
func (e *APIError) WithCause(err error) *APIError {
	e.Cause = err
	return e
}

// WithDetails attaches field-level validation details
func (e *APIError) WithDetails(details map[string]string) *APIError {
	e.Details = details
	return e
}

// =============================================================================
// Error Constructors
// =============================================================================

// BadRequest creates a 400 Bad Request error
func BadRequest(message string) *APIError {
	return &APIError{
		Status:  http.StatusBadRequest,
		Code:    ErrCodeBadRequest,
		Message: message,
	}
}

// Unauthorized creates a 401 Unauthorized error
func Unauthorized(message string) *APIError {
	if message == "" {
		message = "Authentication required"
	}
	return &APIError{
		Status:  http.StatusUnauthorized,
		Code:    ErrCodeUnauthorized,
		Message: message,
	}
}

// Forbidden creates a 403 Forbidden error
func Forbidden(message string) *APIError {
	if message == "" {
		message = "You don't have permission to access this resource"
	}
	return &APIError{
		Status:  http.StatusForbidden,
		Code:    ErrCodeForbidden,
		Message: message,
	}
}

// NotFound creates a 404 Not Found error
func NotFound(resource string) *APIError {
	message := "Resource not found"
	if resource != "" {
		message = fmt.Sprintf("%s not found", resource)
	}
	return &APIError{
		Status:  http.StatusNotFound,
		Code:    ErrCodeNotFound,
		Message: message,
	}
}

// Conflict creates a 409 Conflict error
func Conflict(message string) *APIError {
	return &APIError{
		Status:  http.StatusConflict,
		Code:    ErrCodeConflict,
		Message: message,
	}
}

// Validation creates a 422 Unprocessable Entity error with field details
func Validation(message string, details map[string]string) *APIError {
	return &APIError{
		Status:  http.StatusUnprocessableEntity,
		Code:    ErrCodeValidation,
		Message: message,
		Details: details,
	}
}

// RateLimited creates a 429 Too Many Requests error
func RateLimited(message string) *APIError {
	if message == "" {
		message = "Too many requests, please try again later"
	}
	return &APIError{
		Status:  http.StatusTooManyRequests,
		Code:    ErrCodeRateLimited,
		Message: message,
	}
}

// Internal creates a 500 Internal Server Error
func Internal(message string) *APIError {
	if message == "" {
		message = "An unexpected error occurred"
	}
	return &APIError{
		Status:  http.StatusInternalServerError,
		Code:    ErrCodeInternal,
		Message: message,
	}
}

// DatabaseError creates a 500 error for database issues
func DatabaseError(message string, cause error) *APIError {
	if message == "" {
		message = "A database error occurred"
	}
	return &APIError{
		Status:  http.StatusInternalServerError,
		Code:    ErrCodeDatabaseError,
		Message: message,
		Cause:   cause,
	}
}

// ExternalServiceError creates a 502 Bad Gateway error
func ExternalServiceError(service string, cause error) *APIError {
	message := fmt.Sprintf("External service error: %s", service)
	return &APIError{
		Status:  http.StatusBadGateway,
		Code:    ErrCodeExternalService,
		Message: message,
		Cause:   cause,
	}
}

// Timeout creates a 504 Gateway Timeout error
func Timeout(message string) *APIError {
	if message == "" {
		message = "Request timed out"
	}
	return &APIError{
		Status:  http.StatusGatewayTimeout,
		Code:    ErrCodeTimeout,
		Message: message,
	}
}

// =============================================================================
// Error Checking Utilities
// =============================================================================

// IsAPIError checks if an error is an APIError and returns it
func IsAPIError(err error) (*APIError, bool) {
	if apiErr, ok := err.(*APIError); ok {
		return apiErr, true
	}
	return nil, false
}

// IsNotFound checks if an error is a 404 Not Found error
func IsNotFound(err error) bool {
	if apiErr, ok := IsAPIError(err); ok {
		return apiErr.Status == http.StatusNotFound
	}
	return false
}

// IsUnauthorized checks if an error is a 401 Unauthorized error
func IsUnauthorized(err error) bool {
	if apiErr, ok := IsAPIError(err); ok {
		return apiErr.Status == http.StatusUnauthorized
	}
	return false
}

// IsForbidden checks if an error is a 403 Forbidden error
func IsForbidden(err error) bool {
	if apiErr, ok := IsAPIError(err); ok {
		return apiErr.Status == http.StatusForbidden
	}
	return false
}

// StatusCode returns the HTTP status code for an error
// Returns 500 for non-APIError types
func StatusCode(err error) int {
	if apiErr, ok := IsAPIError(err); ok {
		return apiErr.Status
	}
	return http.StatusInternalServerError
}
