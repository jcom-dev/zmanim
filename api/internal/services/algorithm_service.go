// File: algorithm_service.go
// Purpose: Legacy algorithm management - preview and validation
// Pattern: service
// Status: DEPRECATED - Use ZmanimService for calculations
// Dependencies: db, models
//
// AlgorithmService provides backward-compatible algorithm operations.
// New code should use publisher_zmanim + DSL formulas instead of
// the legacy algorithm configuration approach.

package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jcom-dev/zmanim/internal/db"
	"github.com/jcom-dev/zmanim/internal/models"
)

// ErrAlgorithmNotFound indicates the requested algorithm does not exist.
var ErrAlgorithmNotFound = errors.New("algorithm not found")

// ErrInvalidAlgorithm indicates the algorithm configuration is malformed.
var ErrInvalidAlgorithm = errors.New("invalid algorithm configuration")

// AlgorithmService handles algorithm-related operations including
// validation, preview, and legacy algorithm management.
// DEPRECATED: New implementations should use ZmanimService.
type AlgorithmService struct {
	db *db.DB
}

// NewAlgorithmService creates a new algorithm service
func NewAlgorithmService(database *db.DB) *AlgorithmService {
	return &AlgorithmService{
		db: database,
	}
}

// GetPublisherAlgorithm retrieves the current algorithm for a publisher
// Returns the active (published) algorithm, or draft if no published version exists
// DISABLED: Schema mismatch - algorithms table doesn't have config, formula_definition, status, or is_active columns
// Current schema has: configuration (jsonb), status_id (smallint, FK to algorithm_statuses)
// Alternative: Use existing SQLc queries (GetPublisherActiveAlgorithm, GetPublisherDraftAlgorithm)
func (s *AlgorithmService) GetPublisherAlgorithm(ctx context.Context, publisherID string) (*models.AlgorithmResponse, error) {
	_ = publisherID
	return nil, fmt.Errorf("GetPublisherAlgorithm: not implemented - schema mismatch (config, status, is_active columns don't exist)")
}

// SaveAlgorithm creates or updates an algorithm as a draft
func (s *AlgorithmService) SaveAlgorithm(ctx context.Context, publisherID string, req *models.AlgorithmRequest) (*models.AlgorithmResponse, error) {
	// Validate config
	if err := s.validateAlgorithmConfig(req.Config); err != nil {
		return nil, err
	}

	// Marshal config to JSON
	configJSON, err := json.Marshal(req.Config)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	// Check if algorithm already exists
	existing, err := s.GetPublisherAlgorithm(ctx, publisherID)
	if err != nil && !errors.Is(err, ErrAlgorithmNotFound) {
		return nil, err
	}

	// DISABLED: Schema mismatch - algorithms table doesn't have config, status, or is_active columns
	// Current schema has: configuration (jsonb), status_id (smallint, FK to algorithm_statuses)
	// Alternative: Use existing SQLc queries (UpdateAlgorithmDraft, CreateAlgorithm)
	_ = existing
	_ = configJSON
	_ = publisherID
	_ = req
	return nil, fmt.Errorf("SaveAlgorithm: not implemented - schema mismatch (config, status, is_active columns don't exist)")
}

// PreviewAlgorithm calculates a preview of the algorithm without saving
func (s *AlgorithmService) PreviewAlgorithm(ctx context.Context, req *models.AlgorithmPreviewRequest) (map[string]interface{}, error) {
	// Validate config
	if err := s.validateAlgorithmConfig(req.Config); err != nil {
		return nil, err
	}

	// Return a mock preview
	preview := map[string]interface{}{
		"date": req.Date,
		"location": map[string]interface{}{
			"latitude":  req.Latitude,
			"longitude": req.Longitude,
			"timezone":  req.Timezone,
		},
		"zmanim": map[string]string{
			"alos":              "05:23:00",
			"misheyakir":        "05:47:00",
			"sunrise":           "06:18:00",
			"sof_zman_shma":     "09:18:00",
			"sof_zman_tefillah": "10:18:00",
			"chatzos":           "12:30:00",
			"mincha_gedola":     "13:00:00",
			"mincha_ketana":     "15:30:00",
			"plag_hamincha":     "16:45:00",
			"sunset":            "18:42:00",
			"tzeis":             "19:15:00",
			"tzeis_rt":          "19:54:00",
		},
		"note": "Preview calculation - actual engine implementation pending",
	}

	return preview, nil
}

// validateAlgorithmConfig validates the algorithm configuration
func (s *AlgorithmService) validateAlgorithmConfig(config map[string]interface{}) error {
	if config == nil {
		return ErrInvalidAlgorithm
	}

	// Check for zmanim configuration
	zmanim, ok := config["zmanim"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("%w: missing zmanim configuration", ErrInvalidAlgorithm)
	}

	// Validate that at least one zman is configured
	if len(zmanim) == 0 {
		return fmt.Errorf("%w: no zmanim configured", ErrInvalidAlgorithm)
	}

	// Validate each zman has a method
	for zmanName, zmanConfig := range zmanim {
		zmanMap, ok := zmanConfig.(map[string]interface{})
		if !ok {
			return fmt.Errorf("%w: invalid configuration for %s", ErrInvalidAlgorithm, zmanName)
		}

		method, ok := zmanMap["method"].(string)
		if !ok || method == "" {
			return fmt.Errorf("%w: missing method for %s", ErrInvalidAlgorithm, zmanName)
		}

		// Validate method is supported
		validMethods := map[string]bool{
			"solar_angle":   true,
			"fixed_minutes": true,
			"proportional":  true,
			"midpoint":      true,
			"sunrise":       true,
			"sunset":        true,
		}

		if !validMethods[method] {
			return fmt.Errorf("%w: unsupported method '%s' for %s", ErrInvalidAlgorithm, method, zmanName)
		}
	}

	return nil
}
