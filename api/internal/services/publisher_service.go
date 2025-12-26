// File: publisher_service.go
// Purpose: Publisher CRUD operations and location-based publisher resolution
// Pattern: service
// Dependencies: db/sqlcgen, models
// Frequency: high - used by publisher dashboard and public zmanim lookup
//
// PublisherService provides business logic for managing publishers including:
//   - Listing and retrieving publisher profiles
//   - Finding publishers for geographic locations
//   - Pagination and filtering support

package services

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jcom-dev/zmanim/internal/db"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/models"
)

// PublisherService handles publisher-related business logic including
// listing, retrieval, and geographic location matching.
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

	// Note: regionID filtering is not implemented in SQLc queries
	// The original implementation referenced non-existent coverage_areas table
	// Region filtering via publisher_coverage table tracked in backlog

	// Get all verified publishers
	rows, err := s.db.Queries.ListVerifiedPublishers(ctx, sqlcgen.ListVerifiedPublishersParams{
		Limit:  int32(pageSize),
		Offset: int32(offset),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query publishers: %w", err)
	}

	publishers := make([]models.Publisher, 0, len(rows))
	for _, row := range rows {
		publishers = append(publishers, models.Publisher{
			ID:              strconv.Itoa(int(row.ID)),
			Name:            row.Name,
			Description:     row.Description,
			Website:         row.Website,
			ContactEmail:    row.ContactEmail,
			LogoURL:         row.LogoUrl,
			IsVerified:      row.IsVerified,
			SubscriberCount: int(row.SubscriberCount),
			CreatedAt:       row.CreatedAt.Time,
			UpdatedAt:       row.UpdatedAt.Time,
		})
	}

	// Get total count
	totalCount, err := s.db.Queries.CountVerifiedPublishers(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to count publishers: %w", err)
	}

	return &models.PublisherListResponse{
		Publishers: publishers,
		Total:      int(totalCount),
		Page:       page,
		PageSize:   pageSize,
	}, nil
}

// GetPublisherByID returns a publisher by ID
func (s *PublisherService) GetPublisherByID(ctx context.Context, id string) (*models.Publisher, error) {
	publisherID, err := strconv.Atoi(id)
	if err != nil {
		return nil, fmt.Errorf("invalid publisher ID: %w", err)
	}

	row, err := s.db.Queries.GetPublisherByIDLegacy(ctx, int32(publisherID))
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("publisher not found")
		}
		return nil, fmt.Errorf("failed to get publisher: %w", err)
	}

	return &models.Publisher{
		ID:              strconv.Itoa(int(row.ID)),
		Name:            row.Name,
		Description:     row.Description,
		Website:         row.Website,
		ContactEmail:    row.ContactEmail,
		LogoURL:         row.LogoUrl,
		IsVerified:      row.IsVerified,
		SubscriberCount: int(row.SubscriberCount),
		CreatedAt:       row.CreatedAt.Time,
		UpdatedAt:       row.UpdatedAt.Time,
	}, nil
}

// GetPublisherForLocation finds the best publisher for a given location
// Note: This implementation expects a locality_id, not lat/long coordinates
// The original implementation used ST_Contains with coverage_areas which doesn't exist
// Lat/long to locality_id resolution tracked in backlog
func (s *PublisherService) GetPublisherForLocation(ctx context.Context, latitude, longitude float64) (*models.Publisher, *models.Algorithm, error) {
	// Note: The original query used ST_Contains with coverage_areas table which doesn't exist
	// This simplified version just returns the default publisher
	// A proper implementation would:
	// 1. Convert lat/long to locality_id using geo_localities
	// 2. Use GetPublisherForLocationWithAlgorithm with that locality_id
	return s.getDefaultPublisher(ctx)
}

// getDefaultPublisher returns the default publisher (first verified publisher with active algorithm)
func (s *PublisherService) getDefaultPublisher(ctx context.Context) (*models.Publisher, *models.Algorithm, error) {
	row, err := s.db.Queries.GetDefaultPublisherWithAlgorithm(ctx)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil, fmt.Errorf("no active publishers found")
		}
		return nil, nil, fmt.Errorf("failed to get default publisher: %w", err)
	}

	publisher := &models.Publisher{
		ID:              strconv.Itoa(int(row.PublisherID)),
		Name:            row.PublisherName,
		Description:     row.PublisherDescription,
		Website:         row.PublisherWebsite,
		ContactEmail:    row.PublisherEmail,
		LogoURL:         row.PublisherLogoUrl,
		IsVerified:      row.PublisherIsVerified,
		SubscriberCount: int(row.PublisherSubscriberCount),
		CreatedAt:       row.PublisherCreatedAt.Time,
		UpdatedAt:       row.PublisherUpdatedAt.Time,
	}

	algorithm := &models.Algorithm{
		ID:            strconv.Itoa(int(row.AlgorithmID)),
		PublisherID:   strconv.Itoa(int(row.PublisherID)),
		Name:          row.AlgorithmName,
		Description:   row.AlgorithmDescription,
		Version:       row.AlgorithmVersion,
		Configuration: pgtype.Map{},
		IsActive:      row.AlgorithmIsActive,
	}

	return publisher, algorithm, nil
}
