// File: recaptcha_service.go
// Purpose: Google reCAPTCHA v3 verification service (Story 8-37)
// Pattern: service
// Security: CRITICAL - Bot protection for public forms
// Dependencies: Google reCAPTCHA API
// Frequency: Every public form submission

package services

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"time"
)

// RecaptchaService handles Google reCAPTCHA v3 verification
type RecaptchaService struct {
	secretKey string
	client    *http.Client
	threshold float64
	enabled   bool
}

// RecaptchaResponse represents the response from Google's siteverify API
type RecaptchaResponse struct {
	Success     bool     `json:"success"`
	Score       float64  `json:"score"`
	Action      string   `json:"action"`
	ChallengeTS string   `json:"challenge_ts"`
	Hostname    string   `json:"hostname"`
	ErrorCodes  []string `json:"error-codes,omitempty"`
}

// NewRecaptchaService creates a new reCAPTCHA verification service
func NewRecaptchaService() *RecaptchaService {
	secretKey := os.Getenv("RECAPTCHA_SECRET_KEY")
	enabled := secretKey != ""

	if !enabled {
		slog.Warn("reCAPTCHA not configured - bot protection disabled",
			"hint", "Set RECAPTCHA_SECRET_KEY env var to enable")
	}

	return &RecaptchaService{
		secretKey: secretKey,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		threshold: 0.5, // Score threshold (0.0-1.0)
		enabled:   enabled,
	}
}

// IsEnabled returns whether reCAPTCHA is configured and enabled
func (s *RecaptchaService) IsEnabled() bool {
	return s.enabled
}

// Verify verifies a reCAPTCHA token with Google's API
// Returns the response and any error
func (s *RecaptchaService) Verify(token, expectedAction string) (*RecaptchaResponse, error) {
	// In development without reCAPTCHA configured, allow through with perfect score
	if !s.enabled {
		slog.Debug("reCAPTCHA disabled, allowing request")
		return &RecaptchaResponse{
			Success: true,
			Score:   1.0,
			Action:  expectedAction,
		}, nil
	}

	if token == "" {
		return nil, fmt.Errorf("empty reCAPTCHA token")
	}

	// Call Google's siteverify API
	resp, err := s.client.PostForm("https://www.google.com/recaptcha/api/siteverify",
		url.Values{
			"secret":   {s.secretKey},
			"response": {token},
		})
	if err != nil {
		return nil, fmt.Errorf("reCAPTCHA verification request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("reCAPTCHA API returned status %d", resp.StatusCode)
	}

	var result RecaptchaResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode reCAPTCHA response: %w", err)
	}

	// Log the verification result (helpful for debugging and monitoring)
	slog.Debug("reCAPTCHA verification result",
		"success", result.Success,
		"score", result.Score,
		"action", result.Action,
		"expected_action", expectedAction,
		"error_codes", result.ErrorCodes)

	return &result, nil
}

// IsValid checks if a reCAPTCHA response meets the threshold requirements
// - Success must be true
// - Score must be >= threshold (0.5 by default)
// - Action must match expected action (if provided)
func (s *RecaptchaService) IsValid(resp *RecaptchaResponse, expectedAction string) bool {
	if resp == nil {
		return false
	}

	// Basic success check
	if !resp.Success {
		slog.Warn("reCAPTCHA verification failed",
			"error_codes", resp.ErrorCodes)
		return false
	}

	// Score threshold check
	if resp.Score < s.threshold {
		slog.Warn("reCAPTCHA score below threshold",
			"score", resp.Score,
			"threshold", s.threshold)
		return false
	}

	// Action validation (if expected action provided)
	if expectedAction != "" && resp.Action != expectedAction {
		slog.Warn("reCAPTCHA action mismatch",
			"expected", expectedAction,
			"actual", resp.Action)
		return false
	}

	return true
}

// VerifyAndValidate is a convenience method that verifies and validates in one call
// Returns the score (for audit logging) and whether the token is valid
func (s *RecaptchaService) VerifyAndValidate(token, expectedAction string) (float64, bool, error) {
	resp, err := s.Verify(token, expectedAction)
	if err != nil {
		return 0, false, err
	}

	isValid := s.IsValid(resp, expectedAction)
	return resp.Score, isValid, nil
}

// GetThreshold returns the current score threshold
func (s *RecaptchaService) GetThreshold() float64 {
	return s.threshold
}

// SetThreshold allows adjusting the score threshold (for testing or tuning)
func (s *RecaptchaService) SetThreshold(threshold float64) {
	if threshold >= 0.0 && threshold <= 1.0 {
		s.threshold = threshold
	}
}
