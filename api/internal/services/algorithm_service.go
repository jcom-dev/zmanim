package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jcom-dev/zmanim/internal/db"
	"github.com/jcom-dev/zmanim/internal/models"
)

var (
	ErrAlgorithmNotFound = errors.New("algorithm not found")
	ErrInvalidAlgorithm  = errors.New("invalid algorithm configuration")
)

// AlgorithmService handles algorithm-related operations
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
func (s *AlgorithmService) GetPublisherAlgorithm(ctx context.Context, publisherID string) (*models.AlgorithmResponse, error) {
	query := `
		SELECT id, publisher_id, name, description,
		       COALESCE(config, formula_definition) as config,
		       COALESCE(status, 'draft') as status,
		       is_active, created_at, updated_at
		FROM algorithms
		WHERE publisher_id = $1
		ORDER BY
			CASE status
				WHEN 'published' THEN 1
				WHEN 'draft' THEN 2
				ELSE 3
			END,
			created_at DESC
		LIMIT 1
	`

	var algo models.AlgorithmResponse
	var configJSON []byte

	err := s.db.Pool.QueryRow(ctx, query, publisherID).Scan(
		&algo.ID,
		&algo.PublisherID,
		&algo.Name,
		&algo.Description,
		&configJSON,
		&algo.Status,
		&algo.IsActive,
		&algo.CreatedAt,
		&algo.UpdatedAt,
	)

	if err != nil {
		if err.Error() == "no rows in result set" {
			return nil, ErrAlgorithmNotFound
		}
		return nil, fmt.Errorf("failed to get algorithm: %w", err)
	}

	// Parse config JSON
	if err := json.Unmarshal(configJSON, &algo.Config); err != nil {
		return nil, fmt.Errorf("failed to parse algorithm config: %w", err)
	}

	// Set version (placeholder - can be enhanced)
	algo.Version = 1

	return &algo, nil
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

	var algo models.AlgorithmResponse
	now := time.Now()

	if existing != nil && existing.Status == "draft" {
		// Update existing draft
		query := `
			UPDATE algorithms
			SET name = $1, description = $2, config = $3, updated_at = $4
			WHERE id = $5 AND publisher_id = $6
			RETURNING id, publisher_id, name, description, config::text, status, is_active, created_at, updated_at
		`

		var configStr string
		err = s.db.Pool.QueryRow(ctx, query,
			req.Name, req.Description, configJSON, now, existing.ID, publisherID,
		).Scan(
			&algo.ID, &algo.PublisherID, &algo.Name, &algo.Description,
			&configStr, &algo.Status, &algo.IsActive, &algo.CreatedAt, &algo.UpdatedAt,
		)

		if err != nil {
			return nil, fmt.Errorf("failed to update algorithm: %w", err)
		}

		_ = json.Unmarshal([]byte(configStr), &algo.Config)
	} else {
		// Create new draft
		query := `
			INSERT INTO algorithms (publisher_id, name, description, config, status, is_active, created_at, updated_at)
			VALUES ($1, $2, $3, $4, 'draft', false, $5, $6)
			RETURNING id, publisher_id, name, description, config::text, status, is_active, created_at, updated_at
		`

		var configStr string
		err = s.db.Pool.QueryRow(ctx, query,
			publisherID, req.Name, req.Description, configJSON, now, now,
		).Scan(
			&algo.ID, &algo.PublisherID, &algo.Name, &algo.Description,
			&configStr, &algo.Status, &algo.IsActive, &algo.CreatedAt, &algo.UpdatedAt,
		)

		if err != nil {
			return nil, fmt.Errorf("failed to create algorithm: %w", err)
		}

		_ = json.Unmarshal([]byte(configStr), &algo.Config)
	}

	algo.Version = 1
	return &algo, nil
}

// PreviewAlgorithm calculates a preview of the algorithm without saving
func (s *AlgorithmService) PreviewAlgorithm(ctx context.Context, req *models.AlgorithmPreviewRequest) (map[string]interface{}, error) {
	// Validate config
	if err := s.validateAlgorithmConfig(req.Config); err != nil {
		return nil, err
	}

	// TODO: Implement actual calculation engine
	// For now, return a mock preview
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
