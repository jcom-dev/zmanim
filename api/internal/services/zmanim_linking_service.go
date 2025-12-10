// File: zmanim_linking_service.go
// Purpose: Service layer for multi-concept zmanim linking/copying operations
// Pattern: service-synchronization
// Dependencies: db/sqlcgen, models
// Frequency: high - used by CreateZmanFromPublisher handler
// Compliance: Synchronization boundary pattern (see docs/compliance/concept-independence-audit.md)

package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jcom-dev/zmanim/internal/db"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

var (
	// ErrSourceNotFound indicates the source zman does not exist
	ErrSourceNotFound = errors.New("source zman not found")

	// ErrPublisherNotVerified indicates source publisher is not verified (required for linking)
	ErrPublisherNotVerified = errors.New("source publisher not verified - can only link from verified publishers")

	// ErrZmanKeyExists indicates the zman key already exists for this publisher
	ErrZmanKeyExists = errors.New("zman key already exists for this publisher")

	// ErrInvalidMode indicates the mode is not 'copy' or 'link'
	ErrInvalidMode = errors.New("mode must be 'copy' or 'link'")
)

// ZmanimLinkingService handles multi-concept operations for linking/copying zmanim
// This service encapsulates the coordination between Publisher and Zman concepts
type ZmanimLinkingService struct {
	db *db.DB
}

// NewZmanimLinkingService creates a new ZmanimLinkingService
func NewZmanimLinkingService(database *db.DB) *ZmanimLinkingService {
	return &ZmanimLinkingService{
		db: database,
	}
}

// LinkOrCopyZmanRequest contains parameters for linking or copying a zman
type LinkOrCopyZmanRequest struct {
	TargetPublisherID int32
	SourceZmanID      int32
	Mode              string // "copy" or "link"
	UserID            string // Clerk user ID (for provenance)
	RequestID         string // Request ID as string (for provenance)
}

// LinkOrCopyZmanResult contains the created zman details
type LinkOrCopyZmanResult struct {
	ID                    int32
	ZmanKey               string
	HebrewName            string
	EnglishName           string
	FormulaDSL            string
	Dependencies          []string
	MasterZmanID          *int32
	LinkedPublisherZmanID *int32
	CreatedAt             pgtype.Timestamptz
	UpdatedAt             pgtype.Timestamptz
	IsLinked              bool
	SourceIsVerified      bool
}

// LinkOrCopyZman creates a zman by copying or linking from another publisher
//
// This method encapsulates the multi-concept workflow:
// 1. Record action (provenance tracking)
// 2. Verify source zman exists (Zman concept)
// 3. Verify source publisher status (Publisher concept)
// 4. Check for duplicate zman_key (Zman concept)
// 5. Create linked or copied zman (Zman concept)
// 6. Complete action with result
//
// Transaction boundaries are explicit - this operation uses a transaction to ensure atomicity.
func (s *ZmanimLinkingService) LinkOrCopyZman(ctx context.Context, req LinkOrCopyZmanRequest) (*LinkOrCopyZmanResult, error) {
	// Validate mode
	if req.Mode != "copy" && req.Mode != "link" {
		return nil, ErrInvalidMode
	}

	// BEGIN TRANSACTION
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	// Always rollback (no-op if committed)
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	// Create queries with transaction
	qtx := s.db.Queries.WithTx(tx)

	// STEP 0: Record action (provenance tracking)
	actionType := "copy_zman"
	if req.Mode == "link" {
		actionType = "link_zman"
	}

	payloadJSON, _ := json.Marshal(map[string]interface{}{
		"source_zman_id":      req.SourceZmanID,
		"target_publisher_id": req.TargetPublisherID,
		"mode":                req.Mode,
	})

	// Convert to pointer types for SQLc
	var userIDPtr *string
	if req.UserID != "" {
		userIDPtr = &req.UserID
	}
	publisherIDPtr := &req.TargetPublisherID
	entityType := "publisher_zman"

	actionID, err := qtx.RecordAction(ctx, sqlcgen.RecordActionParams{
		ActionType:     actionType,
		Concept:        "zman",
		UserID:         userIDPtr,
		PublisherID:    publisherIDPtr,
		RequestID:      req.RequestID,
		EntityType:     &entityType,
		EntityID:       nil, // Will be set after creation
		Payload:        payloadJSON,
		ParentActionID: pgtype.UUID{Valid: false},
		Metadata:       nil,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to record action: %w", err)
	}

	// STEP 1: Fetch source zman (concept: Zman + Publisher)
	sourceZman, err := qtx.GetSourceZmanForLinking(ctx, req.SourceZmanID)
	if err == pgx.ErrNoRows {
		return nil, ErrSourceNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to fetch source zman: %w", err)
	}

	// STEP 2: Verify publisher status (concept: Publisher)
	// For linking mode, source publisher must be verified
	if req.Mode == "link" && !sourceZman.IsVerified {
		return nil, ErrPublisherNotVerified
	}

	// STEP 3: Check duplicate zman_key (concept: Zman)
	exists, err := qtx.CheckZmanKeyExists(ctx, sqlcgen.CheckZmanKeyExistsParams{
		PublisherID: req.TargetPublisherID,
		ZmanKey:     sourceZman.ZmanKey,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to check zman key existence: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("%w: %s", ErrZmanKeyExists, sourceZman.ZmanKey)
	}

	// STEP 4: Prepare parameters based on mode
	var linkedID *int32
	var formulaDSL string
	if req.Mode == "copy" {
		linkedID = nil
		formulaDSL = sourceZman.FormulaDsl
	} else {
		// Mode is "link"
		linkedID = &req.SourceZmanID
		formulaDSL = "" // For linked zmanim, formula is resolved at query time
	}

	// STEP 5: Create linked or copied zman (concept: Zman)
	result, err := qtx.CreateLinkedOrCopiedZman(ctx, sqlcgen.CreateLinkedOrCopiedZmanParams{
		PublisherID:           req.TargetPublisherID,
		ZmanKey:               sourceZman.ZmanKey,
		HebrewName:            sourceZman.HebrewName,
		EnglishName:           sourceZman.EnglishName,
		FormulaDsl:            formulaDSL,
		TimeCategoryID:        nil, // Will be inherited from source if needed
		Dependencies:          sourceZman.Dependencies,
		MasterZmanID:          sourceZman.MasterZmanID,
		LinkedPublisherZmanID: linkedID,
	})
	if err != nil {
		// Mark action as failed
		resultJSON, _ := json.Marshal(map[string]interface{}{"error": err.Error()})
		failedStatus := "failed"
		errMsg := err.Error()
		_ = qtx.CompleteAction(ctx, sqlcgen.CompleteActionParams{
			ID:           actionID,
			Status:       &failedStatus,
			Result:       resultJSON,
			ErrorMessage: &errMsg,
		})
		return nil, fmt.Errorf("failed to create linked/copied zman: %w", err)
	}

	// STEP 6: Complete action with result
	resultJSON, _ := json.Marshal(map[string]interface{}{
		"zman_id":    result.ID,
		"zman_key":   sourceZman.ZmanKey,
		"mode":       req.Mode,
		"created_at": result.CreatedAt,
	})
	completedStatus := "completed"
	err = qtx.CompleteAction(ctx, sqlcgen.CompleteActionParams{
		ID:           actionID,
		Status:       &completedStatus,
		Result:       resultJSON,
		ErrorMessage: nil,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to complete action: %w", err)
	}

	// COMMIT TRANSACTION
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Return result
	return &LinkOrCopyZmanResult{
		ID:                    result.ID,
		ZmanKey:               sourceZman.ZmanKey,
		HebrewName:            sourceZman.HebrewName,
		EnglishName:           sourceZman.EnglishName,
		FormulaDSL:            sourceZman.FormulaDsl,
		Dependencies:          sourceZman.Dependencies,
		MasterZmanID:          sourceZman.MasterZmanID,
		LinkedPublisherZmanID: linkedID,
		CreatedAt:             result.CreatedAt,
		UpdatedAt:             result.UpdatedAt,
		IsLinked:              req.Mode == "link",
		SourceIsVerified:      sourceZman.IsVerified,
	}, nil
}
