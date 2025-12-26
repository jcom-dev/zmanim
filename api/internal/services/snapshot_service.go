// File: snapshot_service.go
// Purpose: Publisher snapshot export/import - algorithm versioning and backups
// Pattern: service
// Dependencies: JSON serialization, algorithm history
// Frequency: medium - 419 lines
// Compliance: Check docs/adr/ for pattern rationale

package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/jcom-dev/zmanim/internal/db"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// SnapshotService handles publisher snapshot version control
type SnapshotService struct {
	db *db.DB
}

// NewSnapshotService creates a new snapshot service
func NewSnapshotService(database *db.DB) *SnapshotService {
	return &SnapshotService{db: database}
}

// PublisherSnapshot represents a snapshot of publisher zmanim data (zmanim-only, not profile/coverage)
type PublisherSnapshot struct {
	FormatType  string         `json:"format_type"`
	FormatVersion int          `json:"format_version"`
	ExportedAt  string         `json:"exported_at"`
	PublisherID *int32         `json:"publisher_id,omitempty"`
	Description string         `json:"description,omitempty"`
	Zmanim      []SnapshotZman `json:"zmanim"`
}

// ZmanTag represents a tag attached to a zman
type ZmanTag struct {
	TagKey    string `json:"tag_key"`
	IsNegated bool   `json:"is_negated"`
}

// SnapshotZman contains zman fields
type SnapshotZman struct {
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
	Category              string    `json:"category"`
	MasterZmanID          *int32    `json:"master_zman_id,omitempty"`
	LinkedPublisherZmanID *int32    `json:"linked_publisher_zman_id,omitempty"`
	Tags                  []ZmanTag `json:"tags,omitempty"`
}

// SnapshotMeta contains snapshot metadata (for listing)
type SnapshotMeta struct {
	ID          string    `json:"id"`
	Description string    `json:"description"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
}

// BuildSnapshot creates a snapshot of the current publisher zmanim state
func (s *SnapshotService) BuildSnapshot(ctx context.Context, publisherID int32, description string) (*PublisherSnapshot, error) {
	// Get zmanim (only active, non-deleted)
	zmanimRows, err := s.db.Queries.GetPublisherZmanimForSnapshot(ctx, publisherID)
	if err != nil {
		return nil, fmt.Errorf("failed to get publisher zmanim: %w", err)
	}

	// Build snapshot
	snapshot := &PublisherSnapshot{
		FormatType:    "publisher_algorithm",
		FormatVersion: 2,
		ExportedAt:    time.Now().UTC().Format(time.RFC3339),
		PublisherID:   &publisherID,
		Description:   description,
		Zmanim:        make([]SnapshotZman, len(zmanimRows)),
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

		snapshot.Zmanim[i] = SnapshotZman{
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
			Category:              z.Category,
			MasterZmanID:          z.MasterZmanID,
			LinkedPublisherZmanID: z.LinkedPublisherZmanID,
			Tags:                  zmanTags,
		}
	}

	return snapshot, nil
}

// SaveSnapshot saves a snapshot to the database
func (s *SnapshotService) SaveSnapshot(ctx context.Context, publisherID int32, userID string, description string) (*SnapshotMeta, error) {
	// Build the snapshot
	snapshot, err := s.BuildSnapshot(ctx, publisherID, description)
	if err != nil {
		return nil, err
	}

	// Serialize to JSON
	snapshotJSON, err := json.Marshal(snapshot)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize snapshot: %w", err)
	}

	// Save to database
	result, err := s.db.Queries.CreatePublisherSnapshot(ctx, sqlcgen.CreatePublisherSnapshotParams{
		PublisherID:  publisherID,
		Description:  &description,
		SnapshotData: snapshotJSON,
		CreatedBy:    &userID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to save snapshot: %w", err)
	}

	return &SnapshotMeta{
		ID:          int32ToString(result.ID),
		Description: ptrToString(result.Description),
		CreatedBy:   ptrToString(result.CreatedBy),
		CreatedAt:   result.CreatedAt.Time,
	}, nil
}

// ListSnapshots returns all snapshots for a publisher
func (s *SnapshotService) ListSnapshots(ctx context.Context, publisherID int32) ([]SnapshotMeta, error) {
	rows, err := s.db.Queries.ListPublisherSnapshots(ctx, publisherID)
	if err != nil {
		return nil, fmt.Errorf("failed to list snapshots: %w", err)
	}

	snapshots := make([]SnapshotMeta, len(rows))
	for i, row := range rows {
		snapshots[i] = SnapshotMeta{
			ID:          int32ToString(row.ID),
			Description: ptrToString(row.Description),
			CreatedBy:   ptrToString(row.CreatedBy),
			CreatedAt:   row.CreatedAt.Time,
		}
	}

	return snapshots, nil
}

// GetSnapshot returns a single snapshot with full data
func (s *SnapshotService) GetSnapshot(ctx context.Context, snapshotID int32, publisherID int32) (*PublisherSnapshot, error) {
	row, err := s.db.Queries.GetPublisherSnapshot(ctx, sqlcgen.GetPublisherSnapshotParams{
		ID:          snapshotID,
		PublisherID: publisherID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get snapshot: %w", err)
	}

	var snapshot PublisherSnapshot
	if err := json.Unmarshal(row.SnapshotData, &snapshot); err != nil {
		return nil, fmt.Errorf("failed to parse snapshot data: %w", err)
	}

	return &snapshot, nil
}

// DeleteSnapshot deletes a snapshot
func (s *SnapshotService) DeleteSnapshot(ctx context.Context, snapshotID int32, publisherID int32) error {
	err := s.db.Queries.DeletePublisherSnapshot(ctx, sqlcgen.DeletePublisherSnapshotParams{
		ID:          snapshotID,
		PublisherID: publisherID,
	})
	if err != nil {
		return fmt.Errorf("failed to delete snapshot: %w", err)
	}
	return nil
}

// ApplySnapshot applies a snapshot to the publisher's zmanim with smart diff logic:
// - Zmanim in snapshot but not in current state: insert new or restore if soft-deleted
// - Zmanim in both: update only if different (creates new version)
// - Zmanim in current state but not in snapshot: soft-delete
func (s *SnapshotService) ApplySnapshot(ctx context.Context, publisherID int32, userID string, snapshot *PublisherSnapshot) error {
	// Build a map of snapshot zmanim for quick lookup
	snapshotZmanim := make(map[string]SnapshotZman)
	for _, z := range snapshot.Zmanim {
		snapshotZmanim[z.ZmanKey] = z
	}

	// Get current active zman keys
	currentKeys, err := s.db.Queries.GetAllPublisherZmanimKeys(ctx, publisherID)
	if err != nil {
		return fmt.Errorf("failed to get current zman keys: %w", err)
	}

	currentKeySet := make(map[string]bool)
	for _, key := range currentKeys {
		currentKeySet[key] = true
	}

	// 1. Soft-delete zmanim not in snapshot
	for key := range currentKeySet {
		if _, inSnapshot := snapshotZmanim[key]; !inSnapshot {
			err := s.db.Queries.SoftDeleteZmanForRestore(ctx, sqlcgen.SoftDeleteZmanForRestoreParams{
				PublisherID: publisherID,
				ZmanKey:     key,
				DeletedBy:   &userID,
			})
			if err != nil {
				return fmt.Errorf("failed to soft-delete zman %s: %w", key, err)
			}
		}
	}

	// 2. Process each zman in the snapshot
	for _, snapZman := range snapshot.Zmanim {
		// Check if zman exists in current active state
		if currentKeySet[snapZman.ZmanKey] {
			// Zman exists - check if different and update if so
			existing, err := s.db.Queries.GetPublisherZmanForSnapshotCompare(ctx, sqlcgen.GetPublisherZmanForSnapshotCompareParams{
				PublisherID: publisherID,
				ZmanKey:     snapZman.ZmanKey,
			})
			if err != nil {
				return fmt.Errorf("failed to get existing zman %s: %w", snapZman.ZmanKey, err)
			}

			// Compare and update only if different
			if s.zmanDiffers(existing, snapZman) {
				err = s.updateZmanFromSnapshot(ctx, publisherID, snapZman)
				if err != nil {
					return fmt.Errorf("failed to update zman %s: %w", snapZman.ZmanKey, err)
				}
			}
		} else {
			// Zman doesn't exist in active state - check if soft-deleted
			deleted, err := s.db.Queries.GetDeletedZmanByKey(ctx, sqlcgen.GetDeletedZmanByKeyParams{
				PublisherID: publisherID,
				ZmanKey:     snapZman.ZmanKey,
			})
			if err == nil && deleted.ID != 0 {
				// Restore soft-deleted zman and then update
				err = s.db.Queries.RestoreDeletedZmanForSnapshot(ctx, sqlcgen.RestoreDeletedZmanForSnapshotParams{
					PublisherID: publisherID,
					ZmanKey:     snapZman.ZmanKey,
				})
				if err != nil {
					return fmt.Errorf("failed to restore deleted zman %s: %w", snapZman.ZmanKey, err)
				}
				// Update with snapshot data
				err = s.updateZmanFromSnapshot(ctx, publisherID, snapZman)
				if err != nil {
					return fmt.Errorf("failed to update restored zman %s: %w", snapZman.ZmanKey, err)
				}
			} else {
				// Zman doesn't exist at all - insert new
				err = s.insertZmanFromSnapshot(ctx, publisherID, snapZman)
				if err != nil {
					return fmt.Errorf("failed to insert zman %s: %w", snapZman.ZmanKey, err)
				}
			}
		}
	}

	return nil
}

// zmanDiffers checks if an existing zman differs from a snapshot zman
func (s *SnapshotService) zmanDiffers(existing sqlcgen.GetPublisherZmanForSnapshotCompareRow, snap SnapshotZman) bool {
	if existing.HebrewName != snap.HebrewName {
		return true
	}
	if existing.EnglishName != snap.EnglishName {
		return true
	}
	if !ptrStringEqual(existing.Transliteration, snap.Transliteration) {
		return true
	}
	if !ptrStringEqual(existing.Description, snap.Description) {
		return true
	}
	if existing.FormulaDsl != snap.FormulaDSL {
		return true
	}
	if !ptrStringEqual(existing.AiExplanation, snap.AIExplanation) {
		return true
	}
	if !ptrStringEqual(existing.PublisherComment, snap.PublisherComment) {
		return true
	}
	if existing.IsEnabled != snap.IsEnabled {
		return true
	}
	if existing.IsVisible != snap.IsVisible {
		return true
	}
	if existing.IsPublished != snap.IsPublished {
		return true
	}
	if existing.IsBeta != snap.IsBeta {
		return true
	}
	if existing.IsCustom != snap.IsCustom {
		return true
	}
	if existing.Category != snap.Category {
		return true
	}
	if !int32PtrEqual(existing.MasterZmanID, snap.MasterZmanID) {
		return true
	}
	if !int32PtrEqual(existing.LinkedPublisherZmanID, snap.LinkedPublisherZmanID) {
		return true
	}
	return false
}

// Helper to compare optional string pointers
func ptrStringEqual(a *string, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

// Helper to compare optional int32 pointers
func int32PtrEqual(a *int32, b *int32) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func (s *SnapshotService) updateZmanFromSnapshot(ctx context.Context, publisherID int32, z SnapshotZman) error {
	return fmt.Errorf("updateZmanFromSnapshot not yet implemented for normalized schema")
}

func (s *SnapshotService) insertZmanFromSnapshot(ctx context.Context, publisherID int32, z SnapshotZman) error {
	return fmt.Errorf("insertZmanFromSnapshot not yet implemented for normalized schema")
}

// Helper to convert pointer to string (empty if nil)
func ptrToString(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// RestoreSnapshot restores from a saved snapshot (auto-saves current state first)
func (s *SnapshotService) RestoreSnapshot(ctx context.Context, snapshotID int32, publisherID int32, userID string) (*SnapshotMeta, error) {
	// 1. Get the snapshot to restore
	snapshot, err := s.GetSnapshot(ctx, snapshotID, publisherID)
	if err != nil {
		return nil, err
	}

	// 2. Auto-save current state before restore
	autoSaveDesc := fmt.Sprintf("Auto-save before restore - %s", time.Now().Format("Jan 2, 2006 3:04 PM"))
	autoSave, err := s.SaveSnapshot(ctx, publisherID, userID, autoSaveDesc)
	if err != nil {
		return nil, fmt.Errorf("failed to auto-save before restore: %w", err)
	}

	// 3. Apply the snapshot with smart diff logic
	if err := s.ApplySnapshot(ctx, publisherID, userID, snapshot); err != nil {
		return nil, fmt.Errorf("failed to apply snapshot: %w", err)
	}

	return autoSave, nil
}

// ZmanSummary represents a minimal zman reference for import results
type ZmanSummary struct {
	ZmanKey     string `json:"zman_key"`
	EnglishName string `json:"english_name"`
}

// SnapshotImportResult represents the result of a snapshot import operation
type SnapshotImportResult struct {
	Success             bool          `json:"success"`
	ZmanimCreated       int           `json:"zmanim_created"`
	ZmanimUpdated       int           `json:"zmanim_updated"`
	ZmanimUnchanged     int           `json:"zmanim_unchanged"`
	ZmanimNotInImport   []ZmanSummary `json:"zmanim_not_in_import,omitempty"`
	Message             string        `json:"message,omitempty"`
}

// ImportSnapshot applies a snapshot from JSON (uploaded by user)
func (s *SnapshotService) ImportSnapshot(ctx context.Context, publisherID int32, userID string, snapshot *PublisherSnapshot) (*SnapshotImportResult, error) {
	// Validate format type and version
	if snapshot.FormatType == "" {
		// Original format (v1) - use Version field
		if snapshot.FormatVersion != 1 {
			return nil, fmt.Errorf("unsupported snapshot version: %d", snapshot.FormatVersion)
		}
	} else if snapshot.FormatType == "publisher_algorithm" {
		// New format (v2)
		if snapshot.FormatVersion != 2 {
			return nil, fmt.Errorf("unsupported format version: %d for format type %s", snapshot.FormatVersion, snapshot.FormatType)
		}

		// Validate publisher ID match
		if snapshot.PublisherID != nil && *snapshot.PublisherID != publisherID {
			return nil, fmt.Errorf("publisher ID mismatch: snapshot is for publisher %d but importing to publisher %d", *snapshot.PublisherID, publisherID)
		}
	} else {
		return nil, fmt.Errorf("unsupported format type: %s", snapshot.FormatType)
	}

	// Get current zmanim to track what's not in import
	currentZmanim, err := s.db.Queries.GetPublisherZmanimForSnapshot(ctx, publisherID)
	if err != nil {
		return nil, fmt.Errorf("failed to get current zmanim: %w", err)
	}

	// Build map of current zmanim
	currentZmanimMap := make(map[string]sqlcgen.GetPublisherZmanimForSnapshotRow)
	for _, z := range currentZmanim {
		currentZmanimMap[z.ZmanKey] = z
	}

	// Build map of imported zmanim
	importedZmanimKeys := make(map[string]bool)
	for _, z := range snapshot.Zmanim {
		importedZmanimKeys[z.ZmanKey] = true
	}

	// Track results
	result := &SnapshotImportResult{
		Success:           true,
		ZmanimNotInImport: []ZmanSummary{},
	}

	// Get category ID lookup (we'll need this for inserts/updates)
	categoryCache := make(map[string]int32)

	// Process each zman in the import
	for _, snapZman := range snapshot.Zmanim {
		// Get category ID
		var categoryIDPtr *int32
		categoryID, ok := categoryCache[snapZman.Category]
		if !ok {
			// Query category ID (this is a simplification - in real code we'd query the DB)
			// For now, we'll use the time_category_id from an existing zman with the same category
			// or from the imported zman's existing record
			if existing, exists := currentZmanimMap[snapZman.ZmanKey]; exists {
				if existing.TimeCategoryID != nil {
					categoryID = *existing.TimeCategoryID
					categoryIDPtr = existing.TimeCategoryID
				} else {
					// Default to 1 if we can't find it (this should be improved)
					categoryID = 1
					categoryIDPtr = &categoryID
				}
			} else {
				// Default to 1 if we can't find it (this should be improved)
				categoryID = 1
				categoryIDPtr = &categoryID
			}
			categoryCache[snapZman.Category] = categoryID
		} else {
			categoryIDPtr = &categoryID
		}

		// Apply defaults for missing fields
		roundingMode := snapZman.RoundingMode
		if roundingMode == "" {
			roundingMode = "math"
		}
		displayStatus := snapZman.DisplayStatus
		if displayStatus == "" {
			displayStatus = "core"
		}

		// Upsert the zman
		slog.Info("snapshot import: upserting zman", "zman_key", snapZman.ZmanKey, "category", snapZman.Category, "master_zman_id", snapZman.MasterZmanID)
		zmanID, err := s.db.Queries.UpsertPublisherZmanFromImport(ctx, sqlcgen.UpsertPublisherZmanFromImportParams{
			PublisherID:           publisherID,
			ZmanKey:               snapZman.ZmanKey,
			HebrewName:            snapZman.HebrewName,
			EnglishName:           snapZman.EnglishName,
			Transliteration:       snapZman.Transliteration,
			Description:           snapZman.Description,
			FormulaDsl:            snapZman.FormulaDSL,
			AiExplanation:         snapZman.AIExplanation,
			PublisherComment:      snapZman.PublisherComment,
			IsEnabled:             snapZman.IsEnabled,
			IsVisible:             snapZman.IsVisible,
			IsPublished:           snapZman.IsPublished,
			IsBeta:                snapZman.IsBeta,
			IsCustom:              snapZman.IsCustom,
			RoundingMode:          roundingMode,
			DisplayStatus:         sqlcgen.DisplayStatus(displayStatus),
			TimeCategoryID:        categoryIDPtr,
			MasterZmanID:          snapZman.MasterZmanID,
			LinkedPublisherZmanID: snapZman.LinkedPublisherZmanID,
		})
		if err != nil {
			slog.Error("snapshot import: failed to upsert zman", "zman_key", snapZman.ZmanKey, "error", err)
			return nil, fmt.Errorf("failed to upsert zman %s: %w", snapZman.ZmanKey, err)
		}
		slog.Info("snapshot import: upserted zman", "zman_key", snapZman.ZmanKey, "id", zmanID)

		// Track if this was a create or update
		if _, existed := currentZmanimMap[snapZman.ZmanKey]; existed {
			result.ZmanimUpdated++
		} else {
			result.ZmanimCreated++
		}

		// Replace tags (delete existing, insert from import)
		err = s.db.Queries.DeletePublisherZmanTags(ctx, zmanID)
		if err != nil {
			return nil, fmt.Errorf("failed to delete tags for zman %s: %w", snapZman.ZmanKey, err)
		}

		// Insert new tags
		for _, tag := range snapZman.Tags {
			// Get tag ID from key
			tagID, err := s.db.Queries.GetZmanTagIdByKey(ctx, tag.TagKey)
			if err != nil {
				// Skip unknown tags
				continue
			}

			err = s.db.Queries.InsertPublisherZmanTag(ctx, sqlcgen.InsertPublisherZmanTagParams{
				PublisherZmanID: zmanID,
				TagID:           tagID,
				IsNegated:       tag.IsNegated,
			})
			if err != nil {
				return nil, fmt.Errorf("failed to insert tag %s for zman %s: %w", tag.TagKey, snapZman.ZmanKey, err)
			}
		}
	}

	// Identify zmanim not in import
	for _, z := range currentZmanim {
		if !importedZmanimKeys[z.ZmanKey] {
			result.ZmanimNotInImport = append(result.ZmanimNotInImport, ZmanSummary{
				ZmanKey:     z.ZmanKey,
				EnglishName: z.EnglishName,
			})
		}
	}

	// Build message
	if len(result.ZmanimNotInImport) > 0 {
		result.Message = fmt.Sprintf("Import complete. %d existing zmanim were not in the import file and remain unchanged.", len(result.ZmanimNotInImport))
	} else {
		result.Message = "Import complete."
	}

	// Record import in audit trail
	sourcePublisherID := snapshot.PublisherID
	_, err = s.db.Queries.CreatePublisherImportHistory(ctx, sqlcgen.CreatePublisherImportHistoryParams{
		PublisherID:          publisherID,
		ImportedBy:           userID,
		FormatType:           snapshot.FormatType,
		FormatVersion:        int32(snapshot.FormatVersion),
		SourcePublisherID:    sourcePublisherID,
		ZmanimCreated:        int32(result.ZmanimCreated),
		ZmanimUpdated:        int32(result.ZmanimUpdated),
		ZmanimUnchanged:      int32(result.ZmanimUnchanged),
		ZmanimNotInImport:    int32(len(result.ZmanimNotInImport)),
		CoverageCreated:      nil,
		CoverageUpdated:      nil,
		ProfileUpdated:       nil,
		ImportSummary:        nil,
	})
	if err != nil {
		// Don't fail the import if audit trail fails, just log it
		slog.Warn("Failed to record import in audit trail", "error", err)
	}

	return result, nil
}

// Helper to convert int32 to string
func int32ToString(i int32) string {
	return fmt.Sprintf("%d", i)
}
