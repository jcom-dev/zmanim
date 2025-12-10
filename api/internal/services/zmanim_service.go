package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jcom-dev/zmanim/internal/algorithm"
	"github.com/jcom-dev/zmanim/internal/db"
	"github.com/jcom-dev/zmanim/internal/models"
)

// ZmanimService handles zmanim calculation business logic
type ZmanimService struct {
	db               *db.DB
	publisherService *PublisherService
}

// NewZmanimService creates a new zmanim service
func NewZmanimService(database *db.DB, publisherService *PublisherService) *ZmanimService {
	return &ZmanimService{
		db:               database,
		publisherService: publisherService,
	}
}

// CalculateZmanim calculates zmanim for a given request
func (s *ZmanimService) CalculateZmanim(ctx context.Context, req *models.ZmanimRequest) (*models.ZmanimResponse, error) {
	// Parse date
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return nil, fmt.Errorf("invalid date format: %w", err)
	}

	// Check cache first
	cached, err := s.getFromCache(ctx, date, req.Latitude, req.Longitude, req.PublisherID)
	if err == nil && cached != nil {
		return cached, nil
	}

	// Get publisher and algorithm
	var publisher *models.Publisher
	var algorithm *models.Algorithm

	if req.PublisherID != nil && *req.PublisherID != "" {
		publisher, err = s.publisherService.GetPublisherByID(ctx, *req.PublisherID)
		if err != nil {
			return nil, fmt.Errorf("failed to get publisher: %w", err)
		}
		// Get algorithm for this publisher
		algorithm, err = s.getAlgorithmForPublisher(ctx, publisher.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to get algorithm: %w", err)
		}
	} else {
		publisher, algorithm, err = s.publisherService.GetPublisherForLocation(ctx, req.Latitude, req.Longitude)
		if err != nil {
			return nil, fmt.Errorf("failed to get publisher for location: %w", err)
		}
	}

	// Get elevation from request or default to 0
	elevation := 0.0
	if req.Elevation != nil {
		elevation = float64(*req.Elevation)
	}

	// Calculate zmanim using the algorithm
	zmanim, err := s.calculateWithAlgorithm(ctx, date, req.Latitude, req.Longitude, elevation, req.Timezone, algorithm)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate zmanim: %w", err)
	}

	response := &models.ZmanimResponse{
		Date: req.Date,
		Location: models.Location{
			Name:      fmt.Sprintf("%.4f, %.4f", req.Latitude, req.Longitude),
			Latitude:  req.Latitude,
			Longitude: req.Longitude,
			Timezone:  req.Timezone,
			Elevation: req.Elevation,
		},
		Publisher:    publisher,
		Algorithm:    algorithm,
		Zmanim:       zmanim,
		CalculatedAt: time.Now(),
	}

	// Cache the result
	if err := s.cacheResult(ctx, date, req.Latitude, req.Longitude, algorithm.ID, zmanim); err != nil {
		// Log error but don't fail the request
		fmt.Printf("failed to cache result: %v\n", err)
	}

	return response, nil
}

// getFromCache retrieves cached zmanim calculations
func (s *ZmanimService) getFromCache(ctx context.Context, date time.Time, latitude, longitude float64, publisherID *string) (*models.ZmanimResponse, error) {
	query := `
		SELECT cc.results, cc.created_at, cc.algorithm_id,
		       p.id, p.name, p.description, p.website, p.contact_email, p.logo_url,
		       p.is_verified, p.subscriber_count, p.created_at, p.updated_at,
		       a.id, a.name, a.description, a.version, a.configuration, a.is_active
		FROM calculation_cache cc
		INNER JOIN algorithms a ON cc.algorithm_id = a.id
		INNER JOIN publishers p ON a.publisher_id = p.id
		WHERE cc.date = $1
		  AND ABS(cc.latitude - $2) < 0.001
		  AND ABS(cc.longitude - $3) < 0.001
		  AND cc.expires_at > NOW()
	`
	args := []interface{}{date, latitude, longitude}

	if publisherID != nil && *publisherID != "" {
		query += " AND p.id = $4"
		args = append(args, *publisherID)
	}

	query += " ORDER BY cc.created_at DESC LIMIT 1"

	var resultsJSON []byte
	var cachedAt time.Time
	var algorithmID string
	var p models.Publisher
	var a models.Algorithm

	err := s.db.Pool.QueryRow(ctx, query, args...).Scan(
		&resultsJSON, &cachedAt, &algorithmID,
		&p.ID, &p.Name, &p.Description, &p.Website, &p.ContactEmail, &p.LogoURL,
		&p.IsVerified, &p.SubscriberCount, &p.CreatedAt, &p.UpdatedAt,
		&a.ID, &a.Name, &a.Description, &a.Version, &a.Configuration, &a.IsActive,
	)
	if err != nil {
		return nil, err
	}

	var zmanim map[string]string
	if err := json.Unmarshal(resultsJSON, &zmanim); err != nil {
		return nil, err
	}

	a.PublisherID = p.ID

	return &models.ZmanimResponse{
		Date: date.Format("2006-01-02"),
		Location: models.Location{
			Name:      fmt.Sprintf("%.4f, %.4f", latitude, longitude),
			Latitude:  latitude,
			Longitude: longitude,
		},
		Publisher:    &p,
		Algorithm:    &a,
		Zmanim:       zmanim,
		CachedAt:     &cachedAt,
		CalculatedAt: cachedAt,
	}, nil
}

// cacheResult stores calculation results in cache
func (s *ZmanimService) cacheResult(ctx context.Context, date time.Time, latitude, longitude float64, algorithmID string, zmanim map[string]string) error {
	resultsJSON, err := json.Marshal(zmanim)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO calculation_cache (date, latitude, longitude, algorithm_id, results, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (date, latitude, longitude, algorithm_id)
		DO UPDATE SET results = EXCLUDED.results, expires_at = EXCLUDED.expires_at, created_at = NOW()
	`

	expiresAt := time.Now().Add(24 * time.Hour)
	_, err = s.db.Pool.Exec(ctx, query, date, latitude, longitude, algorithmID, resultsJSON, expiresAt)
	return err
}

// calculateWithAlgorithm performs the actual zmanim calculation
func (s *ZmanimService) calculateWithAlgorithm(ctx context.Context, date time.Time, latitude, longitude, elevation float64, timezone string, alg *models.Algorithm) (map[string]string, error) {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}

	// Parse algorithm configuration or use default
	var algorithmConfig *algorithm.AlgorithmConfig
	if alg != nil {
		// Try to marshal the configuration if it's not empty
		configBytes, err := json.Marshal(alg.Configuration)
		if err == nil && len(configBytes) > 2 { // More than just "{}"
			algorithmConfig, _ = algorithm.ParseAlgorithm(configBytes)
		}
	}

	// Use default algorithm if parsing failed or no algorithm provided
	if algorithmConfig == nil {
		algorithmConfig = algorithm.DefaultAlgorithm()
	}

	// Create executor with elevation and run calculations
	executor := algorithm.NewExecutorWithElevation(date, latitude, longitude, elevation, loc)
	results, err := executor.Execute(algorithmConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to execute algorithm: %w", err)
	}

	// Convert to simple map for backward compatibility
	zmanim := make(map[string]string)
	for _, zman := range results.Zmanim {
		zmanim[zman.Key] = zman.TimeString
	}

	return zmanim, nil
}

// getAlgorithmForPublisher gets the active algorithm for a publisher
func (s *ZmanimService) getAlgorithmForPublisher(ctx context.Context, publisherID string) (*models.Algorithm, error) {
	query := `
		SELECT id, publisher_id, name, description, version, configuration, is_active, created_at, updated_at
		FROM algorithms
		WHERE publisher_id = $1 AND is_active = true
		ORDER BY created_at DESC
		LIMIT 1
	`

	var a models.Algorithm
	err := s.db.Pool.QueryRow(ctx, query, publisherID).Scan(
		&a.ID, &a.PublisherID, &a.Name, &a.Description, &a.Version,
		&a.Configuration, &a.IsActive, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get algorithm: %w", err)
	}

	return &a, nil
}
