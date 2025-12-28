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
	"strings"

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

// Team management action types
const (
	ActionTeamMemberAdded         = "team_member_added"
	ActionTeamMemberRemoved       = "team_member_removed"
	ActionTeamInvitationSent      = "team_invitation_sent"
	ActionTeamInvitationResent    = "team_invitation_resent"
	ActionTeamInvitationCancelled = "team_invitation_cancelled"
	ActionTeamInvitationAccepted  = "team_invitation_accepted"
)

// Settings action types (granular)
const (
	ActionSettingsCalculationUpdated     = "settings_calculation_updated"
	ActionSettingsTransliterationUpdated = "settings_transliteration_updated"
	ActionSettingsElevationUpdated       = "settings_elevation_updated"
)

// Coverage action types (granular)
const (
	ActionCoverageGlobalEnabled  = "coverage_global_enabled"
	ActionCoverageGlobalDisabled = "coverage_global_disabled"
	ActionCoverageRegionAdded    = "coverage_region_added"
	ActionCoverageRegionRemoved  = "coverage_region_removed"
)

// Version history action types
const (
	ActionVersionSnapshotCreated  = "version_snapshot_created"
	ActionVersionRollbackExecuted = "version_rollback_executed"
)

// Location override action types
const (
	ActionLocationOverrideCreated = "location_override_created"
	ActionLocationOverrideUpdated = "location_override_updated"
	ActionLocationOverrideDeleted = "location_override_deleted"
)

// Snapshot action types
const (
	ActionSnapshotCreated  = "snapshot_created"
	ActionSnapshotRestored = "snapshot_restored"
	ActionSnapshotDeleted  = "snapshot_deleted"
)

// Onboarding action types
const (
	ActionOnboardingCompleted = "onboarding_completed"
	ActionOnboardingReset     = "onboarding_reset"
)

// Correction request action types
const (
	ActionCorrectionRequestCreate = "correction_request_create"
	ActionCorrectionRequestUpdate = "correction_request_update"
	ActionCorrectionRequestDelete = "correction_request_delete"
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
	ActionAdminCacheFlush               = "admin_cache_flush"
	ActionAdminLocalityUpdate           = "admin_locality_update"
	ActionAdminGrantAccess              = "admin_grant_access"
	ActionAdminRevokeAccess             = "admin_revoke_access"
	ActionAdminSetRole                  = "admin_set_role"
	ActionAdminPasswordReset            = "admin_password_reset"
	ActionAdminImpersonate              = "admin_impersonate"
	ActionAdminSystemConfig             = "admin_system_config"

	// Publisher request approval workflow
	ActionAdminRequestApprove = "admin_request_approve"
	ActionAdminRequestReject  = "admin_request_reject"

	// Master registry management
	ActionAdminZmanRequestReview    = "admin_zman_request_review"
	ActionAdminTagApprove           = "admin_tag_approve"
	ActionAdminTagReject            = "admin_tag_reject"
	ActionAdminMasterZmanCreate     = "admin_master_zman_create"
	ActionAdminMasterZmanUpdate     = "admin_master_zman_update"
	ActionAdminMasterZmanDelete     = "admin_master_zman_delete"
	ActionAdminZmanVisibilityToggle = "admin_zman_visibility_toggle"
)

// Admin impersonation tracking (HIGH priority)
const (
	ActionAdminImpersonationStart = "admin_impersonation_start"
	ActionAdminImpersonationEnd   = "admin_impersonation_end"
)

// Admin audit tracking (HIGH priority)
const (
	ActionAdminAuditLogsViewed   = "admin_audit_logs_viewed"
	ActionAdminAuditLogsExported = "admin_audit_logs_exported"
)

// Admin user management (HIGH priority)
const (
	ActionAdminUserCreated     = "admin_user_created"
	ActionAdminUserRoleUpdated = "admin_user_role_updated"
	ActionAdminUserInvited     = "admin_user_invited"
)

// Event severity constants for critical admin events
const (
	SeverityInfo     = "info"
	SeverityWarning  = "warning"
	SeverityCritical = "critical"
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
	db           *db.DB
	clerkService *ClerkService
}

// NewActivityService creates a new ActivityService instance
func NewActivityService(database *db.DB, clerkService *ClerkService) *ActivityService {
	return &ActivityService{
		db:           database,
		clerkService: clerkService,
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

	// Add actor name and email to metadata
	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	metadata["actor_name"] = actorName
	// If actor name looks like an email, also store it separately
	if strings.Contains(actorName, "@") {
		metadata["actor_email"] = actorName
	}

	// Marshal metadata to JSON
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		slog.Error("failed to marshal action metadata", "error", err)
		metadataJSON = []byte("{}")
	}

	// Marshal payload (empty for now, can be enhanced later)
	payloadJSON := []byte("{}")

	// Record the action
	actionID, err := s.db.Queries.RecordAction(ctx, sqlcgen.RecordActionParams{
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

	// Immediately complete the action (these are synchronous operations)
	status := "completed"
	resultJSON, _ := json.Marshal(map[string]interface{}{
		"entity_type": entityType,
		"entity_id":   entityID,
	})

	if err := s.db.Queries.CompleteAction(ctx, sqlcgen.CompleteActionParams{
		ID:           actionID,
		Status:       &status,
		Result:       resultJSON,
		ErrorMessage: nil,
	}); err != nil {
		slog.Error("failed to complete action",
			"error", err,
			"action_id", actionID,
		)
		// Don't return error - the action was recorded
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

	// Try to get email from JWT context first
	email := middleware.GetUserEmail(ctx)
	if email != "" {
		return userID, email
	}

	// Fallback: Try to fetch from Clerk API if we have clerk service
	// Note: This adds a small overhead, but ensures we always get email if available
	if s.clerkService != nil {
		if user, err := s.clerkService.GetUser(ctx, userID); err == nil {
			if user.EmailAddresses != nil && len(user.EmailAddresses) > 0 {
				email = user.EmailAddresses[0].EmailAddress
				if email != "" {
					return userID, email
				}
			}
		}
	}

	// Final fallback to user ID if email not available
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
	// If actor name looks like an email, also store it separately
	if strings.Contains(actorName, "@") {
		metadata["actor_email"] = actorName
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

	actionID, err := s.db.Queries.RecordAction(ctx, sqlcgen.RecordActionParams{
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

	// Immediately complete the action (these are synchronous operations)
	status := "completed"
	var resultJSON []byte
	if diff != nil && diff.New != nil {
		resultJSON, _ = json.Marshal(diff.New)
	} else {
		resultJSON, _ = json.Marshal(map[string]interface{}{
			"entity_type": entityType,
			"entity_id":   entityID,
		})
	}

	if err := s.db.Queries.CompleteAction(ctx, sqlcgen.CompleteActionParams{
		ID:           actionID,
		Status:       &status,
		Result:       resultJSON,
		ErrorMessage: nil,
	}); err != nil {
		slog.Error("failed to complete action",
			"error", err,
			"action_id", actionID,
		)
		// Don't return error - the action was recorded
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

// AdminAuditParams contains parameters for admin audit logging
type AdminAuditParams struct {
	ActionType         string                 // e.g., admin_publisher_create
	ResourceType       string                 // e.g., publisher, user
	ResourceID         string                 // ID of the affected resource
	ResourceName       string                 // Optional: human-readable name
	TargetPublisherID  string                 // Publisher being acted on (if applicable)
	ImpersonatorUserID string                 // Admin user ID when impersonating
	ChangesBefore      map[string]interface{} // State before change
	ChangesAfter       map[string]interface{} // State after change
	Severity           string                 // info, warning, critical
	Reason             string                 // Optional reason for the action
	Status             string                 // success, failure
	ErrorMessage       string                 // Error message if failed
}

// LogAdminAction logs an admin action with enhanced audit context
// This method captures admin-specific context including impersonation
func (s *ActivityService) LogAdminAction(
	ctx context.Context,
	r *http.Request,
	params AdminAuditParams,
) error {
	userID, actorName := s.resolveActor(ctx)

	// Handle impersonation context
	if params.ImpersonatorUserID != "" {
		actorName = fmt.Sprintf("Admin (via %s)", params.ImpersonatorUserID)
	}

	requestID := middleware.GetRequestID(ctx)
	if requestID == "" {
		requestID = uuid.New().String()
	}

	// Build enhanced metadata
	metadata := map[string]interface{}{
		"actor_name": actorName,
		"actor_id":   userID,
		"is_admin":   true,
	}

	// Add request context
	if r != nil {
		metadata["ip_address"] = r.RemoteAddr
		metadata["user_agent"] = r.UserAgent()
		if email := r.Header.Get("X-User-Email"); email != "" {
			metadata["actor_email"] = email
		}
	}

	// Add impersonation context
	if params.ImpersonatorUserID != "" {
		metadata["impersonator_user_id"] = params.ImpersonatorUserID
		metadata["is_impersonation"] = true
	}

	// Add severity
	severity := params.Severity
	if severity == "" {
		severity = SeverityInfo
	}
	metadata["severity"] = severity

	// Add optional fields
	if params.ResourceName != "" {
		metadata["resource_name"] = params.ResourceName
	}
	if params.Reason != "" {
		metadata["reason"] = params.Reason
	}
	if params.Status != "" {
		metadata["status"] = params.Status
	}
	if params.ErrorMessage != "" {
		metadata["error_message"] = params.ErrorMessage
	}

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		metadataJSON = []byte("{}")
	}

	// Build payload with diff
	var payloadJSON []byte
	if params.ChangesBefore != nil || params.ChangesAfter != nil {
		diff := ActionDiff{
			Old: params.ChangesBefore,
			New: params.ChangesAfter,
		}
		payloadJSON, err = json.Marshal(diff)
		if err != nil {
			payloadJSON = []byte("{}")
		}
	} else {
		payloadJSON = []byte("{}")
	}

	// Convert target publisher ID
	var publisherID *int32
	if params.TargetPublisherID != "" {
		if pid, err := stringToInt32(params.TargetPublisherID); err == nil {
			publisherID = &pid
		}
	}

	actionID, err := s.db.Queries.RecordAction(ctx, sqlcgen.RecordActionParams{
		ActionType:     params.ActionType,
		Concept:        ConceptAdmin,
		UserID:         &userID,
		PublisherID:    publisherID,
		RequestID:      requestID,
		EntityType:     &params.ResourceType,
		EntityID:       &params.ResourceID,
		Payload:        payloadJSON,
		ParentActionID: pgtype.UUID{Valid: false},
		Metadata:       metadataJSON,
	})

	if err != nil {
		// Log error but don't fail the request
		slog.Error("failed to record admin audit event",
			"error", err,
			"action_type", params.ActionType,
			"resource_type", params.ResourceType,
			"resource_id", params.ResourceID,
		)
		return err
	}

	// Immediately complete the action
	status := params.Status
	if status == "" {
		status = "completed"
	}
	var resultJSON []byte
	if params.ChangesAfter != nil {
		resultJSON, _ = json.Marshal(params.ChangesAfter)
	} else {
		resultJSON, _ = json.Marshal(map[string]interface{}{
			"resource_type": params.ResourceType,
			"resource_id":   params.ResourceID,
		})
	}

	var errorMessage *string
	if params.ErrorMessage != "" {
		errorMessage = &params.ErrorMessage
	}

	if err := s.db.Queries.CompleteAction(ctx, sqlcgen.CompleteActionParams{
		ID:           actionID,
		Status:       &status,
		Result:       resultJSON,
		ErrorMessage: errorMessage,
	}); err != nil {
		slog.Error("failed to complete admin action",
			"error", err,
			"action_id", actionID,
		)
		// Don't return error - the action was recorded
	}

	// Log at appropriate level based on severity
	logFields := []any{
		"action_type", params.ActionType,
		"resource_type", params.ResourceType,
		"resource_id", params.ResourceID,
		"actor", actorName,
	}

	switch severity {
	case SeverityCritical:
		slog.Warn("CRITICAL admin action logged", logFields...)
	case SeverityWarning:
		slog.Warn("admin action logged", logFields...)
	default:
		slog.Info("admin action logged", logFields...)
	}

	return nil
}

// IsCriticalAdminAction returns true if the action type is considered critical
func IsCriticalAdminAction(actionType string) bool {
	criticalActions := map[string]bool{
		ActionAdminPublisherDelete:          true,
		ActionAdminPublisherPermanentDelete: true,
		ActionAdminRevokeAccess:             true,
		ActionAdminUserRemove:               true,
		ActionAdminSystemConfig:             true,
	}
	return criticalActions[actionType]
}

// GetSeverityForAction returns the appropriate severity for an action type
func GetSeverityForAction(actionType string) string {
	if IsCriticalAdminAction(actionType) {
		return SeverityCritical
	}
	// Warning level for suspensions and access changes
	warningActions := map[string]bool{
		ActionAdminPublisherSuspend: true,
		ActionAdminSetRole:          true,
	}
	if warningActions[actionType] {
		return SeverityWarning
	}
	return SeverityInfo
}

// Helper function to convert string to int32 (copied from handlers for independence)
func stringToInt32(s string) (int32, error) {
	var result int32
	_, err := fmt.Sscanf(s, "%d", &result)
	return result, err
}
