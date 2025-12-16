// File: activity_service.go
// Purpose: Activity logging service for audit trail
// Pattern: service-layer
// Dependencies: Queries: actions.sql
// Frequency: high - used by all state-changing handlers

package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jcom-dev/zmanim/internal/db"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/middleware"
)

// Action type constants
const (
	ActionProfileUpdate    = "profile_update"
	ActionSettingsUpdate   = "settings_update"
	ActionAlgorithmSave    = "algorithm_save"
	ActionAlgorithmPublish = "algorithm_publish"
	ActionCoverageAdd      = "coverage_add"
	ActionCoverageRemove   = "coverage_remove"
	ActionZmanCreate       = "zman_create"
	ActionZmanUpdate       = "zman_update"
	ActionZmanDelete       = "zman_delete"
)

// Admin action type constants
const (
	ActionAdminPublisherVerify          = "admin_publisher_verify"
	ActionAdminPublisherSuspend         = "admin_publisher_suspend"
	ActionAdminPublisherReactivate      = "admin_publisher_reactivate"
	ActionAdminPublisherDelete          = "admin_publisher_delete"
	ActionAdminPublisherRestore         = "admin_publisher_restore"
	ActionAdminPublisherPermanentDelete = "admin_publisher_permanent_delete"
	ActionAdminPublisherCertified       = "admin_publisher_certified"
	ActionAdminPublisherCreate          = "admin_publisher_create"
	ActionAdminPublisherUpdate          = "admin_publisher_update"
	ActionAdminUserAdd                  = "admin_user_add"
	ActionAdminUserRemove               = "admin_user_remove"
	ActionAdminCorrectionApprove        = "admin_correction_approve"
	ActionAdminCorrectionReject         = "admin_correction_reject"
	ActionAdminPublisherExport          = "admin_publisher_export"
	ActionAdminPublisherImport          = "admin_publisher_import"
)

// Concept constants (for action reification pattern)
const (
	ConceptPublisher = "publisher"
	ConceptAlgorithm = "algorithm"
	ConceptCoverage  = "coverage"
	ConceptZman      = "zman"
	ConceptAdmin     = "admin"
)

// ActionDiff captures before/after state for auditing
type ActionDiff struct {
	Old map[string]interface{} `json:"old,omitempty"`
	New map[string]interface{} `json:"new,omitempty"`
}

// ActionContext captures HTTP request context for auditing
type ActionContext struct {
	IPAddress  string `json:"ip_address,omitempty"`
	UserAgent  string `json:"user_agent,omitempty"`
	ActorEmail string `json:"actor_email,omitempty"`
}

// ActivityService handles logging of user actions for audit trail
type ActivityService struct {
	db *db.DB
}

// NewActivityService creates a new ActivityService instance
func NewActivityService(database *db.DB) *ActivityService {
	return &ActivityService{
		db: database,
	}
}

// LogAction logs an action to the actions table
// publisherIDStr should be the string representation of the publisher ID
func (s *ActivityService) LogAction(
	ctx context.Context,
	actionType string,
	concept string,
	entityType string,
	entityID string,
	publisherIDStr string,
	metadata map[string]interface{},
) error {
	// Resolve actor from context
	userID, actorName := s.resolveActor(ctx)

	// Convert publisher ID to int32
	var publisherID *int32
	if publisherIDStr != "" {
		if pid, err := stringToInt32(publisherIDStr); err == nil {
			publisherID = &pid
		}
	}

	// Get request ID from context
	requestID := middleware.GetRequestID(ctx)
	if requestID == "" {
		requestID = uuid.New().String()
	}

	// Add actor name to metadata
	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	metadata["actor_name"] = actorName

	// Marshal metadata to JSON
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		slog.Error("failed to marshal action metadata", "error", err)
		metadataJSON = []byte("{}")
	}

	// Marshal payload (empty for now, can be enhanced later)
	payloadJSON := []byte("{}")

	// Record the action
	_, err = s.db.Queries.RecordAction(ctx, sqlcgen.RecordActionParams{
		ActionType:     actionType,
		Concept:        concept,
		UserID:         &userID,
		PublisherID:    publisherID,
		RequestID:      requestID,
		EntityType:     &entityType,
		EntityID:       &entityID,
		Payload:        payloadJSON,
		ParentActionID: pgtype.UUID{Valid: false}, // No parent action for now
		Metadata:       metadataJSON,
	})

	if err != nil {
		slog.Error("failed to record action",
			"error", err,
			"action_type", actionType,
			"entity_type", entityType,
			"entity_id", entityID,
		)
		return err
	}

	slog.Info("action logged",
		"action_type", actionType,
		"entity_type", entityType,
		"entity_id", entityID,
		"actor", actorName,
	)

	return nil
}

// resolveActor determines the actor ID and name from context
func (s *ActivityService) resolveActor(ctx context.Context) (actorID, actorName string) {
	// Check for impersonation context
	if impersonatorID := ctx.Value("impersonator_id"); impersonatorID != nil {
		return impersonatorID.(string), "Admin (Support)"
	}

	// Get user ID from middleware context
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		return "system", "System"
	}

	// Try to get user name from Clerk or database
	// For now, return user ID as name (can be enhanced with user lookup)
	return userID, userID
}

// LogActionWithDiff logs an action with before/after state capture
func (s *ActivityService) LogActionWithDiff(
	ctx context.Context,
	actionType string,
	concept string,
	entityType string,
	entityID string,
	publisherIDStr string,
	diff *ActionDiff,
	actx *ActionContext,
) error {
	userID, actorName := s.resolveActor(ctx)

	var publisherID *int32
	if publisherIDStr != "" {
		if pid, err := stringToInt32(publisherIDStr); err == nil {
			publisherID = &pid
		}
	}

	requestID := middleware.GetRequestID(ctx)
	if requestID == "" {
		requestID = uuid.New().String()
	}

	// Build enhanced metadata
	metadata := map[string]interface{}{
		"actor_name": actorName,
	}
	if actx != nil {
		if actx.IPAddress != "" {
			metadata["ip_address"] = actx.IPAddress
		}
		if actx.UserAgent != "" {
			metadata["user_agent"] = actx.UserAgent
		}
		if actx.ActorEmail != "" {
			metadata["actor_email"] = actx.ActorEmail
		}
	}

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		metadataJSON = []byte("{}")
	}

	// Build payload with diff
	var payloadJSON []byte
	if diff != nil {
		payloadJSON, err = json.Marshal(diff)
		if err != nil {
			payloadJSON = []byte("{}")
		}
	} else {
		payloadJSON = []byte("{}")
	}

	_, err = s.db.Queries.RecordAction(ctx, sqlcgen.RecordActionParams{
		ActionType:     actionType,
		Concept:        concept,
		UserID:         &userID,
		PublisherID:    publisherID,
		RequestID:      requestID,
		EntityType:     &entityType,
		EntityID:       &entityID,
		Payload:        payloadJSON,
		ParentActionID: pgtype.UUID{Valid: false},
		Metadata:       metadataJSON,
	})

	if err != nil {
		slog.Error("failed to record action with diff",
			"error", err,
			"action_type", actionType,
		)
		return err
	}

	slog.Info("action logged with diff",
		"action_type", actionType,
		"entity_type", entityType,
		"entity_id", entityID,
	)

	return nil
}

// ExtractActionContext extracts audit context from HTTP request
func ExtractActionContext(r *http.Request) *ActionContext {
	return &ActionContext{
		IPAddress:  r.RemoteAddr,
		UserAgent:  r.UserAgent(),
		ActorEmail: r.Header.Get("X-User-Email"),
	}
}

// Helper function to convert string to int32 (copied from handlers for independence)
func stringToInt32(s string) (int32, error) {
	var result int32
	_, err := fmt.Sscanf(s, "%d", &result)
	return result, err
}
