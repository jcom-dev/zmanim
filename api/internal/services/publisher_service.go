package services

import (
	"context"
	"fmt"

	"github.com/jcom-dev/zmanim/internal/db"
	"github.com/jcom-dev/zmanim/internal/models"
)

// PublisherService handles publisher-related business logic
type PublisherService struct {
	db *db.DB
}

// NewPublisherService creates a new publisher service
func NewPublisherService(database *db.DB) *PublisherService {
	return &PublisherService{db: database}
}

// GetPublishers returns a list of publishers with pagination
func (s *PublisherService) GetPublishers(ctx context.Context, page, pageSize int, regionID *string) (*models.PublisherListResponse, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize

	var query string
	var args []interface{}

	if regionID != nil && *regionID != "" {
		// Get publishers that cover the specified region
		query = `
			SELECT DISTINCT p.id, p.name, COALESCE(p.description, ''), p.website, p.email,
			       p.logo_url, (p.status = 'verified' OR p.status = 'active') as is_verified,
			       0 as subscriber_count,
			       p.created_at, p.updated_at
			FROM publishers p
			INNER JOIN coverage_areas ca ON p.id = ca.publisher_id
			WHERE (p.status = 'verified' OR p.status = 'active') AND ca.is_active = true
			ORDER BY subscriber_count DESC, p.name
			LIMIT $2 OFFSET $3
		`
		args = []interface{}{*regionID, pageSize, offset}
	} else {
		// Get all verified publishers
		query = `
			SELECT id, name, COALESCE(description, ''), website, email, logo_url,
			       (status = 'verified' OR status = 'active') as is_verified,
			       0 as subscriber_count,
			       created_at, updated_at
			FROM publishers
			WHERE status = 'verified' OR status = 'active'
			ORDER BY subscriber_count DESC, name
			LIMIT $1 OFFSET $2
		`
		args = []interface{}{pageSize, offset}
	}

	rows, err := s.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query publishers: %w", err)
	}
	defer rows.Close()

	var publishers []models.Publisher
	for rows.Next() {
		var p models.Publisher
		err := rows.Scan(
			&p.ID, &p.Name, &p.Description, &p.Website, &p.ContactEmail,
			&p.LogoURL, &p.IsVerified, &p.SubscriberCount, &p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan publisher: %w", err)
		}
		publishers = append(publishers, p)
	}

	// Get total count
	var countQuery string
	var countArgs []interface{}
	var total int

	if regionID != nil && *regionID != "" {
		countQuery = `
			SELECT COUNT(DISTINCT p.id)
			FROM publishers p
			INNER JOIN coverage_areas ca ON p.id = ca.publisher_id
			WHERE (p.status = 'verified' OR p.status = 'active') AND ca.is_active = true
		`
		countArgs = []interface{}{*regionID}
	} else {
		countQuery = `SELECT COUNT(*) FROM publishers WHERE status = 'verified' OR status = 'active'`
		countArgs = []interface{}{}
	}

	err = s.db.Pool.QueryRow(ctx, countQuery, countArgs...).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to count publishers: %w", err)
	}

	return &models.PublisherListResponse{
		Publishers: publishers,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
	}, nil
}

// GetPublisherByID returns a publisher by ID
func (s *PublisherService) GetPublisherByID(ctx context.Context, id string) (*models.Publisher, error) {
	query := `
		SELECT id, name, COALESCE(description, ''), website, email, logo_url,
		       (status = 'verified' OR status = 'active') as is_verified,
		       0 as subscriber_count,
		       created_at, updated_at
		FROM publishers
		WHERE id = $1
	`

	var p models.Publisher
	err := s.db.Pool.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.Name, &p.Description, &p.Website, &p.ContactEmail,
		&p.LogoURL, &p.IsVerified, &p.SubscriberCount, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get publisher: %w", err)
	}

	return &p, nil
}

// GetPublisherForLocation finds the best publisher for a given location
func (s *PublisherService) GetPublisherForLocation(ctx context.Context, latitude, longitude float64) (*models.Publisher, *models.Algorithm, error) {
	// Find coverage area that contains the point with highest priority
	query := `
		SELECT p.id, p.name, COALESCE(p.description, ''), p.website, p.email, p.logo_url,
		       (p.status = 'verified' OR p.status = 'active') as is_verified,
		       0 as subscriber_count,
		       p.created_at, p.updated_at,
		       a.id, a.name, a.description, a.version, a.formula_definition, a.is_active
		FROM publishers p
		INNER JOIN coverage_areas ca ON p.id = ca.publisher_id
		INNER JOIN algorithms a ON p.id = a.publisher_id
		WHERE (p.status = 'verified' OR p.status = 'active')
		  AND ca.is_active = true
		  AND a.is_active = true
		  AND ST_Contains(ca.boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
		ORDER BY ca.priority DESC
		LIMIT 1
	`

	var p models.Publisher
	var a models.Algorithm

	err := s.db.Pool.QueryRow(ctx, query, longitude, latitude).Scan(
		&p.ID, &p.Name, &p.Description, &p.Website, &p.ContactEmail, &p.LogoURL,
		&p.IsVerified, &p.SubscriberCount, &p.CreatedAt, &p.UpdatedAt,
		&a.ID, &a.Name, &a.Description, &a.Version, &a.Configuration, &a.IsActive,
	)
	if err != nil {
		// If no specific coverage found, return default publisher
		return s.getDefaultPublisher(ctx)
	}

	a.PublisherID = p.ID
	return &p, &a, nil
}

// getDefaultPublisher returns the default publisher (highest subscriber count)
func (s *PublisherService) getDefaultPublisher(ctx context.Context) (*models.Publisher, *models.Algorithm, error) {
	query := `
		SELECT p.id, p.name, COALESCE(p.description, ''), p.website, p.email, p.logo_url,
		       (p.status = 'verified' OR p.status = 'active') as is_verified,
		       0 as subscriber_count,
		       p.created_at, p.updated_at,
		       a.id, a.name, a.description, a.version, a.formula_definition, a.is_active
		FROM publishers p
		INNER JOIN algorithms a ON p.id = a.publisher_id
		WHERE (p.status = 'verified' OR p.status = 'active') AND a.is_active = true
		ORDER BY subscriber_count DESC
		LIMIT 1
	`

	var p models.Publisher
	var a models.Algorithm

	err := s.db.Pool.QueryRow(ctx, query).Scan(
		&p.ID, &p.Name, &p.Description, &p.Website, &p.ContactEmail, &p.LogoURL,
		&p.IsVerified, &p.SubscriberCount, &p.CreatedAt, &p.UpdatedAt,
		&a.ID, &a.Name, &a.Description, &a.Version, &a.Configuration, &a.IsActive,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get default publisher: %w", err)
	}

	a.PublisherID = p.ID
	return &p, &a, nil
}
