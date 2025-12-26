// File: complete_export_service.go
// Purpose: Complete publisher export - includes profile, logo, coverage, zmanim
// Pattern: service
// Dependencies: JSON serialization, publisher data, coverage
// Compliance: Check docs/adr/ for pattern rationale

package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jcom-dev/zmanim/internal/db"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// CompleteExportService handles complete publisher export operations
type CompleteExportService struct {
	db *db.DB
}

// NewCompleteExportService creates a new complete export service
func NewCompleteExportService(database *db.DB) *CompleteExportService {
	return &CompleteExportService{db: database}
}

// CompletePublisherExport represents a complete publisher export (admin/backup format)
// This format is INCOMPATIBLE with publisher snapshot imports (version control)
type CompletePublisherExport struct {
	FormatType    string           `json:"format_type"`    // Always "admin_complete_backup"
	FormatVersion int              `json:"format_version"` // Version 2000 for new format
	ExportedAt    string           `json:"exported_at"`
	PublisherID   int32            `json:"publisher_id"`
	Description   string           `json:"description,omitempty"`
	Publisher     PublisherProfile `json:"publisher"`
	Coverage      []CoverageArea   `json:"coverage"`
	Zmanim        []ZmanData       `json:"zmanim"`
}

// PublisherProfile contains complete publisher profile data
type PublisherProfile struct {
	ID                   int32     `json:"id"`
	Name                 string    `json:"name"`
	Email                string    `json:"email"`
	Phone                *string   `json:"phone,omitempty"`
	Website              *string   `json:"website,omitempty"`
	Description          string    `json:"description"`
	Bio                  string    `json:"bio"`
	LogoURL              *string   `json:"logo_url,omitempty"`
	LogoData             *string   `json:"logo_data,omitempty"`
	Latitude             *float64  `json:"latitude,omitempty"`
	Longitude            *float64  `json:"longitude,omitempty"`
	Timezone             *string   `json:"timezone,omitempty"`
	IgnoreElevation      bool      `json:"ignore_elevation"`
	IsPublished          bool      `json:"is_published"`
	IsVerified           bool      `json:"is_verified"`
	IsCertified          bool      `json:"is_certified"`
	StatusKey            string    `json:"status_key"`
	StatusDisplayHebrew  string    `json:"status_display_hebrew"`
	StatusDisplayEnglish string    `json:"status_display_english"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

// CoverageArea contains coverage information
type CoverageArea struct {
	ID                          int32     `json:"id"`
	CoverageLevelKey            string    `json:"coverage_level_key"`
	CoverageLevelDisplayHebrew  string    `json:"coverage_level_display_hebrew"`
	CoverageLevelDisplayEnglish string    `json:"coverage_level_display_english"`
	ContinentID                 *int16    `json:"continent_id,omitempty"`
	ContinentName               *string   `json:"continent_name,omitempty"`
	CountryID                   *int16    `json:"country_id,omitempty"`
	CountryCode                 *string   `json:"country_code,omitempty"`
	CountryName                 *string   `json:"country_name,omitempty"`
	RegionID                    *int32    `json:"region_id,omitempty"`
	RegionCode                  *string   `json:"region_code,omitempty"`
	RegionName                  *string   `json:"region_name,omitempty"`
	LocalityID                  *int32    `json:"locality_id,omitempty"`
	LocalityName                *string   `json:"locality_name,omitempty"`
	LocalityLatitude            *float64  `json:"locality_latitude,omitempty"`
	LocalityLongitude           *float64  `json:"locality_longitude,omitempty"`
	Priority                    *int32    `json:"priority,omitempty"`
	IsActive                    bool      `json:"is_active"`
	CreatedAt                   time.Time `json:"created_at"`
}

// ZmanData contains zman data for export
type ZmanData struct {
	ID                    int32     `json:"id"`
	ZmanKey               string    `json:"zman_key"`
	HebrewName            string    `json:"hebrew_name"`
	EnglishName           string    `json:"english_name"`
	Transliteration       *string   `json:"transliteration,omitempty"`
	Description           *string   `json:"description,omitempty"`
	FormulaDSL            string    `json:"formula_dsl"`
	AIExplanation         *string   `json:"ai_explanation,omitempty"`
	PublisherComment      *string   `json:"publisher_comment,omitempty"`
	IsEnabled             bool      `json:"is_enabled"`
	IsVisible             bool      `json:"is_visible"`
	IsPublished           bool      `json:"is_published"`
	IsBeta                bool      `json:"is_beta"`
	IsCustom              bool      `json:"is_custom"`
	RoundingMode          string    `json:"rounding_mode"`
	DisplayStatus         string    `json:"display_status"`
	MasterZmanID          *int32    `json:"master_zman_id,omitempty"`
	LinkedPublisherZmanID *int32    `json:"linked_publisher_zman_id,omitempty"`
	Tags                  []ZmanTag `json:"tags,omitempty"`
	CurrentVersion        *int32    `json:"current_version,omitempty"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

// BuildCompleteExport creates a complete publisher export
func (s *CompleteExportService) BuildCompleteExport(ctx context.Context, publisherID int32, description string) (*CompletePublisherExport, error) {
	// Get publisher profile
	publisherRow, err := s.db.Queries.GetCompletePublisherExport(ctx, publisherID)
	if err != nil {
		return nil, fmt.Errorf("failed to get publisher profile: %w", err)
	}

	// Get coverage areas
	coverageRows, err := s.db.Queries.GetPublisherCoverageForExport(ctx, publisherID)
	if err != nil {
		return nil, fmt.Errorf("failed to get publisher coverage: %w", err)
	}

	// Get zmanim
	zmanimRows, err := s.db.Queries.GetPublisherZmanimForCompleteExport(ctx, publisherID)
	if err != nil {
		return nil, fmt.Errorf("failed to get publisher zmanim: %w", err)
	}

	// Build export
	export := &CompletePublisherExport{
		FormatType:    "admin_complete_backup",
		FormatVersion: 2000,
		ExportedAt:    time.Now().UTC().Format(time.RFC3339),
		PublisherID:   publisherID,
		Description:   description,
		Publisher: PublisherProfile{
			ID:                   publisherRow.ID,
			Name:                 publisherRow.Name,
			Email:                publisherRow.ContactEmail,
			Phone:                publisherRow.Phone,
			Website:              publisherRow.Website,
			Description:          publisherRow.Description,
			Bio:                  publisherRow.Bio,
			LogoURL:              publisherRow.LogoUrl,
			LogoData:             publisherRow.LogoData,
			Latitude:             publisherRow.Latitude,
			Longitude:            publisherRow.Longitude,
			Timezone:             publisherRow.Timezone,
			IgnoreElevation:      publisherRow.IgnoreElevation,
			IsPublished:          publisherRow.IsPublished,
			IsVerified:           publisherRow.IsVerified,
			IsCertified:          publisherRow.IsCertified,
			StatusKey:            publisherRow.StatusKey,
			StatusDisplayHebrew:  publisherRow.StatusDisplayHebrew,
			StatusDisplayEnglish: publisherRow.StatusDisplayEnglish,
			CreatedAt:            publisherRow.CreatedAt.Time,
			UpdatedAt:            publisherRow.UpdatedAt.Time,
		},
		Coverage: make([]CoverageArea, len(coverageRows)),
		Zmanim:   make([]ZmanData, len(zmanimRows)),
	}

	// Map coverage areas
	for i, c := range coverageRows {
		export.Coverage[i] = CoverageArea{
			ID:                          c.ID,
			CoverageLevelKey:            c.CoverageLevelKey,
			CoverageLevelDisplayHebrew:  c.CoverageLevelDisplayHebrew,
			CoverageLevelDisplayEnglish: c.CoverageLevelDisplayEnglish,
			ContinentID:                 c.ContinentID,
			ContinentName:               c.ContinentName,
			CountryID:                   c.CountryID,
			CountryCode:                 c.CountryCode,
			CountryName:                 c.CountryName,
			RegionID:                    c.RegionID,
			RegionCode:                  c.RegionCode,
			RegionName:                  c.RegionName,
			LocalityID:                  c.LocalityID,
			LocalityName:                c.LocalityName,
			LocalityLatitude:            c.LocalityLatitude,
			LocalityLongitude:           c.LocalityLongitude,
			Priority:                    c.Priority,
			IsActive:                    c.IsActive,
			CreatedAt:                   c.CreatedAt.Time,
		}
	}

	// Map zmanim
	for i, z := range zmanimRows {
		// Fetch tags for this zman
		tags, err := s.db.Queries.GetPublisherZmanTagsForExport(ctx, z.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to get tags for zman %s: %w", z.ZmanKey, err)
		}

		// Map tags to ZmanTag structs
		zmanTags := make([]ZmanTag, len(tags))
		for j, tag := range tags {
			zmanTags[j] = ZmanTag{
				TagKey:    tag.TagKey,
				IsNegated: tag.IsNegated,
			}
		}

		export.Zmanim[i] = ZmanData{
			ID:                    z.ID,
			ZmanKey:               z.ZmanKey,
			HebrewName:            z.HebrewName,
			EnglishName:           z.EnglishName,
			Transliteration:       z.Transliteration,
			Description:           z.Description,
			FormulaDSL:            z.FormulaDsl,
			AIExplanation:         z.AiExplanation,
			PublisherComment:      z.PublisherComment,
			IsEnabled:             z.IsEnabled,
			IsVisible:             z.IsVisible,
			IsPublished:           z.IsPublished,
			IsBeta:                z.IsBeta,
			IsCustom:              z.IsCustom,
			RoundingMode:          z.RoundingMode,
			DisplayStatus:         string(z.DisplayStatus),
			MasterZmanID:          z.MasterZmanID,
			LinkedPublisherZmanID: z.LinkedPublisherZmanID,
			Tags:                  zmanTags,
			CurrentVersion:        z.CurrentVersion,
			CreatedAt:             z.CreatedAt.Time,
			UpdatedAt:             z.UpdatedAt.Time,
		}
	}

	return export, nil
}

// stringPtrToString converts a *string to string, returning empty string if nil
func stringPtrToString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// ExportToJSON serializes the complete export to JSON
func (s *CompleteExportService) ExportToJSON(ctx context.Context, publisherID int32, description string) ([]byte, error) {
	export, err := s.BuildCompleteExport(ctx, publisherID, description)
	if err != nil {
		return nil, err
	}

	jsonData, err := json.MarshalIndent(export, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal export to JSON: %w", err)
	}

	return jsonData, nil
}

// ImportResult contains the results of an import operation
type ImportResult struct {
	PublisherID      int32  `json:"publisher_id,omitempty"`      // Set when creating new publisher
	PublisherName    string `json:"publisher_name,omitempty"`    // Set when creating new publisher
	PublisherCreated bool   `json:"publisher_created,omitempty"` // True if new publisher was created
	ZmanimCreated    int    `json:"zmanim_created"`
	ZmanimUpdated    int    `json:"zmanim_updated"`
	ZmanimUnchanged  int    `json:"zmanim_unchanged"`
	CoverageCreated  int    `json:"coverage_created"`
	ProfileUpdated   bool   `json:"profile_updated"`
	Message          string `json:"message"`
}

// ImportFromJSON imports publisher data from JSON
// If publisherID is 0 and createNew is true, creates a new publisher from the import data
// Otherwise imports zmanim into the existing publisher
func (s *CompleteExportService) ImportFromJSON(ctx context.Context, publisherID int32, createNew bool, data json.RawMessage) (*ImportResult, error) {
	// First, determine the format type
	var formatCheck struct {
		FormatType    string `json:"format_type"`
		FormatVersion int    `json:"format_version"`
		Version       int    `json:"version"` // For snapshot format
	}
	if err := json.Unmarshal(data, &formatCheck); err != nil {
		return nil, fmt.Errorf("failed to parse import format: %w", err)
	}

	// If creating a new publisher, use the complete backup data
	if createNew {
		if formatCheck.FormatType != "admin_complete_backup" || formatCheck.FormatVersion < 1000 {
			return nil, fmt.Errorf("creating new publisher requires admin_complete_backup format (version >= 1000)")
		}
		return s.createPublisherFromBackup(ctx, data)
	}

	// Check if this is a complete backup format
	if formatCheck.FormatType == "admin_complete_backup" && formatCheck.FormatVersion >= 1000 {
		return s.importCompleteBackup(ctx, publisherID, data)
	}

	// Check if this is a snapshot format (version 1-999)
	if formatCheck.Version > 0 && formatCheck.Version < 1000 {
		return s.importSnapshot(ctx, publisherID, data)
	}

	return nil, fmt.Errorf("unknown import format: format_type=%s, format_version=%d", formatCheck.FormatType, formatCheck.FormatVersion)
}

// importCompleteBackup imports a complete backup format
func (s *CompleteExportService) importCompleteBackup(ctx context.Context, publisherID int32, data json.RawMessage) (*ImportResult, error) {
	var backup CompletePublisherExport
	if err := json.Unmarshal(data, &backup); err != nil {
		return nil, fmt.Errorf("failed to parse complete backup: %w", err)
	}

	result := &ImportResult{}

	// 1. Update publisher profile
	if backup.Publisher.Name != "" {
		// Convert strings to pointers for nullable fields
		desc := backup.Publisher.Description
		bio := backup.Publisher.Bio

		err := s.db.Queries.UpdatePublisherProfileFromImport(ctx, sqlcgen.UpdatePublisherProfileFromImportParams{
			ID:              publisherID,
			Name:            backup.Publisher.Name,
			ContactEmail:    backup.Publisher.Email,
			Description:     &desc,
			Bio:             &bio,
			LogoUrl:         backup.Publisher.LogoURL,
			LogoData:        backup.Publisher.LogoData,
			Phone:           backup.Publisher.Phone,
			Website:         backup.Publisher.Website,
			Timezone:        backup.Publisher.Timezone,
			Latitude:        backup.Publisher.Latitude,
			Longitude:       backup.Publisher.Longitude,
			IgnoreElevation: backup.Publisher.IgnoreElevation,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to update publisher profile: %w", err)
		}
		result.ProfileUpdated = true
	}

	// 2. Replace coverage areas (delete all, then insert from backup)
	if len(backup.Coverage) > 0 {
		// Delete existing coverage
		err := s.db.Queries.DeletePublisherCoverageForImport(ctx, publisherID)
		if err != nil {
			return nil, fmt.Errorf("failed to delete existing coverage: %w", err)
		}

		// Insert coverage from backup
		for _, c := range backup.Coverage {
			// Get coverage level ID
			levelID, err := s.db.Queries.GetCoverageLevelIdByKey(ctx, c.CoverageLevelKey)
			if err != nil {
				slog.Warn("failed to get coverage level ID", "key", c.CoverageLevelKey, "error", err)
				continue
			}

			_, err = s.db.Queries.InsertPublisherCoverageFromImport(ctx, sqlcgen.InsertPublisherCoverageFromImportParams{
				PublisherID:     publisherID,
				CoverageLevelID: levelID,
				ContinentID:     c.ContinentID,
				CountryID:       c.CountryID,
				RegionID:        c.RegionID,
				LocalityID:      c.LocalityID,
				Priority:        c.Priority,
				IsActive:        c.IsActive,
			})
			if err != nil {
				slog.Warn("failed to insert coverage", "error", err)
				continue
			}
			result.CoverageCreated++
		}
	}

	// 3. Import zmanim with tags (using UpsertPublisherZmanFromImport)
	for _, z := range backup.Zmanim {
		// Get time category ID from master registry (if not custom)
		var timeCategoryID *int32
		if !z.IsCustom && z.MasterZmanID != nil {
			masterZman, err := s.db.Queries.GetMasterZmanByID(ctx, *z.MasterZmanID)
			if err == nil && masterZman.TimeCategory != nil {
				// Convert category key to ID
				catID, err := s.db.Queries.GetTimeCategoryIDByKey(ctx, *masterZman.TimeCategory)
				if err == nil {
					timeCategoryID = &catID
				}
			}
		}

		// Upsert the zman (inserts or updates based on publisher_id + zman_key)
		zmanID, err := s.db.Queries.UpsertPublisherZmanFromImport(ctx, sqlcgen.UpsertPublisherZmanFromImportParams{
			PublisherID:           publisherID,
			ZmanKey:               z.ZmanKey,
			HebrewName:            z.HebrewName,
			EnglishName:           z.EnglishName,
			Transliteration:       z.Transliteration,
			Description:           z.Description,
			FormulaDsl:            z.FormulaDSL,
			AiExplanation:         z.AIExplanation,
			PublisherComment:      z.PublisherComment,
			IsEnabled:             z.IsEnabled,
			IsVisible:             z.IsVisible,
			IsPublished:           z.IsPublished,
			IsBeta:                z.IsBeta,
			IsCustom:              z.IsCustom,
			RoundingMode:          z.RoundingMode,
			DisplayStatus:         sqlcgen.DisplayStatus(z.DisplayStatus),
			TimeCategoryID:        timeCategoryID,
			MasterZmanID:          z.MasterZmanID,
			LinkedPublisherZmanID: z.LinkedPublisherZmanID,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to upsert zman %s: %w", z.ZmanKey, err)
		}

		// Track whether this was a create or update
		// For now, we'll just count all as "created" since we don't have a simple way to tell
		result.ZmanimCreated++

		// Replace tags (delete all, then insert from backup)
		if len(z.Tags) > 0 {
			// Delete existing tags
			err = s.db.Queries.DeletePublisherZmanTags(ctx, zmanID)
			if err != nil {
				slog.Warn("failed to delete zman tags", "zman_key", z.ZmanKey, "error", err)
			}

			// Insert tags from backup
			for _, tag := range z.Tags {
				// Lookup tag ID from tag key
				tagID, err := s.db.Queries.GetZmanTagIdByKey(ctx, tag.TagKey)
				if err != nil {
					slog.Warn("failed to lookup tag ID", "zman_key", z.ZmanKey, "tag_key", tag.TagKey, "error", err)
					continue
				}

				err = s.db.Queries.InsertPublisherZmanTag(ctx, sqlcgen.InsertPublisherZmanTagParams{
					PublisherZmanID: zmanID,
					TagID:           tagID,
					IsNegated:       tag.IsNegated,
				})
				if err != nil {
					slog.Warn("failed to insert zman tag", "zman_key", z.ZmanKey, "tag_key", tag.TagKey, "error", err)
				}
			}
		}
	}

	result.Message = fmt.Sprintf("Successfully imported %d zmanim, %d coverage areas, and updated profile",
		result.ZmanimCreated, result.CoverageCreated)

	return result, nil
}

// importSnapshot imports a snapshot format (zmanim only)
// Note: Snapshots are version-control focused and don't include profile/coverage
func (s *CompleteExportService) importSnapshot(ctx context.Context, publisherID int32, data json.RawMessage) (*ImportResult, error) {
	// Snapshot format structure
	var snapshot struct {
		Version     int    `json:"version"`
		ExportedAt  string `json:"exported_at"`
		Description string `json:"description"`
		Zmanim      []struct {
			ZmanKey          string    `json:"zman_key"`
			HebrewName       string    `json:"hebrew_name"`
			EnglishName      string    `json:"english_name"`
			Transliteration  *string   `json:"transliteration,omitempty"`
			Description      *string   `json:"description,omitempty"`
			FormulaDSL       string    `json:"formula_dsl"`
			AIExplanation    *string   `json:"ai_explanation,omitempty"`
			PublisherComment *string   `json:"publisher_comment,omitempty"`
			IsEnabled        bool      `json:"is_enabled"`
			IsVisible        bool      `json:"is_visible"`
			IsPublished      bool      `json:"is_published"`
			IsBeta           bool      `json:"is_beta"`
			IsCustom         bool      `json:"is_custom"`
			MasterZmanID     *int32    `json:"master_zman_id,omitempty"`
			Tags             []ZmanTag `json:"tags,omitempty"`
		} `json:"zmanim"`
	}

	if err := json.Unmarshal(data, &snapshot); err != nil {
		return nil, fmt.Errorf("failed to parse snapshot: %w", err)
	}

	result := &ImportResult{}

	for _, z := range snapshot.Zmanim {
		// Check if zman with this key already exists
		existing, err := s.db.Queries.GetPublisherZmanByKey(ctx, sqlcgen.GetPublisherZmanByKeyParams{
			PublisherID: publisherID,
			ZmanKey:     z.ZmanKey,
		})

		var zmanID int32
		if err == nil && existing.ID > 0 {
			// Update existing zman
			err = s.db.Queries.UpdatePublisherZmanFromImport(ctx, sqlcgen.UpdatePublisherZmanFromImportParams{
				ID:               existing.ID,
				HebrewName:       z.HebrewName,
				EnglishName:      z.EnglishName,
				Transliteration:  z.Transliteration,
				Description:      z.Description,
				FormulaDsl:       z.FormulaDSL,
				AiExplanation:    z.AIExplanation,
				PublisherComment: z.PublisherComment,
				IsEnabled:        z.IsEnabled,
				IsVisible:        z.IsVisible,
				IsPublished:      z.IsPublished,
				IsBeta:           z.IsBeta,
			})
			if err != nil {
				return nil, fmt.Errorf("failed to update zman %s: %w", z.ZmanKey, err)
			}
			zmanID = existing.ID
			result.ZmanimUpdated++
		} else {
			// Insert new zman
			err = s.db.Queries.InsertPublisherZmanFromImport(ctx, sqlcgen.InsertPublisherZmanFromImportParams{
				PublisherID:      publisherID,
				ZmanKey:          z.ZmanKey,
				HebrewName:       z.HebrewName,
				EnglishName:      z.EnglishName,
				Transliteration:  z.Transliteration,
				Description:      z.Description,
				FormulaDsl:       z.FormulaDSL,
				AiExplanation:    z.AIExplanation,
				PublisherComment: z.PublisherComment,
				IsEnabled:        z.IsEnabled,
				IsVisible:        z.IsVisible,
				IsPublished:      z.IsPublished,
				IsBeta:           z.IsBeta,
				IsCustom:         z.IsCustom,
				MasterZmanID:     z.MasterZmanID,
			})
			if err != nil {
				return nil, fmt.Errorf("failed to insert zman %s: %w", z.ZmanKey, err)
			}
			// Get the ID of the zman we just inserted
			zmanID, err = s.db.Queries.GetPublisherZmanIDByKey(ctx, sqlcgen.GetPublisherZmanIDByKeyParams{
				PublisherID: publisherID,
				ZmanKey:     z.ZmanKey,
			})
			if err != nil {
				return nil, fmt.Errorf("failed to get zman ID after insert for %s: %w", z.ZmanKey, err)
			}
			result.ZmanimCreated++
		}

		// Import tags (delete existing, insert from snapshot)
		if len(z.Tags) > 0 {
			// Delete existing tags
			err = s.db.Queries.DeletePublisherZmanTags(ctx, zmanID)
			if err != nil {
				slog.Warn("failed to delete zman tags", "zman_key", z.ZmanKey, "error", err)
			}

			// Insert tags from snapshot
			for _, tag := range z.Tags {
				// Lookup tag ID from tag key
				tagID, err := s.db.Queries.GetZmanTagIdByKey(ctx, tag.TagKey)
				if err != nil {
					slog.Warn("failed to lookup tag ID", "zman_key", z.ZmanKey, "tag_key", tag.TagKey, "error", err)
					continue
				}

				err = s.db.Queries.InsertPublisherZmanTag(ctx, sqlcgen.InsertPublisherZmanTagParams{
					PublisherZmanID: zmanID,
					TagID:           tagID,
					IsNegated:       tag.IsNegated,
				})
				if err != nil {
					slog.Warn("failed to insert zman tag", "zman_key", z.ZmanKey, "tag_key", tag.TagKey, "error", err)
				}
			}
		}
	}

	result.Message = fmt.Sprintf("Successfully imported %d zmanim (%d new, %d updated)",
		result.ZmanimCreated+result.ZmanimUpdated, result.ZmanimCreated, result.ZmanimUpdated)

	return result, nil
}

// createPublisherFromBackup creates a new publisher from a complete backup
func (s *CompleteExportService) createPublisherFromBackup(ctx context.Context, data json.RawMessage) (*ImportResult, error) {
	var backup CompletePublisherExport
	if err := json.Unmarshal(data, &backup); err != nil {
		return nil, fmt.Errorf("failed to parse import data: %w", err)
	}

	// Validate publisher data
	if backup.Publisher.Name == "" {
		return nil, fmt.Errorf("publisher name is required")
	}

	// Create the publisher
	publisherRow, err := s.db.Queries.CreatePublisherFromImport(ctx, sqlcgen.CreatePublisherFromImportParams{
		Name:            backup.Publisher.Name,
		ContactEmail:    backup.Publisher.Email,
		Website:         backup.Publisher.Website,
		Description:     &backup.Publisher.Description,
		Bio:             &backup.Publisher.Bio,
		LogoUrl:         backup.Publisher.LogoURL,
		LogoData:        backup.Publisher.LogoData,
		Latitude:        backup.Publisher.Latitude,
		Longitude:       backup.Publisher.Longitude,
		Timezone:        backup.Publisher.Timezone,
		IgnoreElevation: backup.Publisher.IgnoreElevation,
	})
	if err != nil {
		// Check for duplicate email constraint violation
		if strings.Contains(err.Error(), "publishers_email_key") {
			return nil, fmt.Errorf("a publisher with email '%s' already exists", backup.Publisher.Email)
		}
		// Check for duplicate name constraint violation
		if strings.Contains(err.Error(), "publishers_name_key") {
			return nil, fmt.Errorf("a publisher with name '%s' already exists", backup.Publisher.Name)
		}
		return nil, fmt.Errorf("failed to create publisher: %w", err)
	}

	result := &ImportResult{
		PublisherID:      publisherRow.ID,
		PublisherName:    publisherRow.Name,
		PublisherCreated: true,
	}

	// Import coverage areas
	if len(backup.Coverage) > 0 {
		for _, c := range backup.Coverage {
			// Get coverage level ID
			levelID, err := s.db.Queries.GetCoverageLevelIdByKey(ctx, c.CoverageLevelKey)
			if err != nil {
				slog.Warn("failed to get coverage level ID", "key", c.CoverageLevelKey, "error", err)
				continue
			}

			_, err = s.db.Queries.InsertPublisherCoverageFromImport(ctx, sqlcgen.InsertPublisherCoverageFromImportParams{
				PublisherID:     publisherRow.ID,
				CoverageLevelID: levelID,
				ContinentID:     c.ContinentID,
				CountryID:       c.CountryID,
				RegionID:        c.RegionID,
				LocalityID:      c.LocalityID,
				Priority:        c.Priority,
				IsActive:        c.IsActive,
			})
			if err != nil {
				slog.Warn("failed to insert coverage", "error", err)
				continue
			}
			result.CoverageCreated++
		}
	}

	// Import zmanim into the new publisher
	for _, z := range backup.Zmanim {
		err = s.db.Queries.InsertPublisherZmanFromImport(ctx, sqlcgen.InsertPublisherZmanFromImportParams{
			PublisherID:      publisherRow.ID,
			ZmanKey:          z.ZmanKey,
			HebrewName:       z.HebrewName,
			EnglishName:      z.EnglishName,
			Transliteration:  z.Transliteration,
			Description:      z.Description,
			FormulaDsl:       z.FormulaDSL,
			AiExplanation:    z.AIExplanation,
			PublisherComment: z.PublisherComment,
			IsEnabled:        z.IsEnabled,
			IsVisible:        z.IsVisible,
			IsPublished:      z.IsPublished,
			IsBeta:           z.IsBeta,
			IsCustom:         z.IsCustom,
			MasterZmanID:     z.MasterZmanID,
		})
		if err != nil {
			slog.Warn("failed to import zman", "zman_key", z.ZmanKey, "error", err)
			continue
		}
		result.ZmanimCreated++

		// Import tags for this zman
		if len(z.Tags) > 0 {
			// Get the ID of the zman we just inserted
			zmanID, err := s.db.Queries.GetPublisherZmanIDByKey(ctx, sqlcgen.GetPublisherZmanIDByKeyParams{
				PublisherID: publisherRow.ID,
				ZmanKey:     z.ZmanKey,
			})
			if err != nil {
				slog.Warn("failed to get zman ID after insert", "zman_key", z.ZmanKey, "error", err)
				continue
			}

			for _, tag := range z.Tags {
				// Lookup tag ID from tag key
				tagID, err := s.db.Queries.GetZmanTagIdByKey(ctx, tag.TagKey)
				if err != nil {
					slog.Warn("failed to lookup tag ID", "zman_key", z.ZmanKey, "tag_key", tag.TagKey, "error", err)
					continue
				}

				err = s.db.Queries.InsertPublisherZmanTag(ctx, sqlcgen.InsertPublisherZmanTagParams{
					PublisherZmanID: zmanID,
					TagID:           tagID,
					IsNegated:       tag.IsNegated,
				})
				if err != nil {
					slog.Warn("failed to insert zman tag", "zman_key", z.ZmanKey, "tag_key", tag.TagKey, "error", err)
				}
			}
		}
	}

	result.Message = fmt.Sprintf("Successfully created publisher '%s' (ID: %d) with %d zmanim and %d coverage areas",
		result.PublisherName, result.PublisherID, result.ZmanimCreated, result.CoverageCreated)

	return result, nil
}
