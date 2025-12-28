// File: audit_helpers.go
// Purpose: Audit logging helpers for handler integration
// Pattern: service-layer helper
// Dependencies: services/activity_service.go
// Frequency: high - used by all mutation handlers

package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/jcom-dev/zmanim/internal/middleware"
	"github.com/jcom-dev/zmanim/internal/services"
)

// AuditEventParams contains parameters for logging an audit event
type AuditEventParams struct {
	// ActionType is the specific granular action constant (e.g., services.ActionTeamMemberAdded)
	// If provided, this takes precedence over EventCategory + EventAction pattern
	ActionType string
	// EventCategory is the high-level category (publisher, zman, coverage, algorithm, team)
	// DEPRECATED: Use ActionType instead for new code
	EventCategory string
	// EventAction is the specific action (create, update, delete, publish, etc.)
	// DEPRECATED: Use ActionType instead for new code
	EventAction string
	// ResourceType is the type of resource being modified (publisher, publisher_zman, coverage, etc.)
	ResourceType string
	// ResourceID is the unique identifier of the resource
	ResourceID string
	// ResourceName is a human-readable name for the resource (optional)
	ResourceName string
	// ChangesBefore is the state before the mutation (nil for create operations)
	ChangesBefore interface{}
	// ChangesAfter is the state after the mutation (nil for delete failures)
	ChangesAfter interface{}
	// Status is the outcome of the operation (success, failure)
	Status string
	// ErrorMessage contains error details if status is failure
	ErrorMessage string
	// AdditionalMetadata contains any extra context-specific data
	AdditionalMetadata map[string]interface{}
}

// LogAuditEvent logs an audit event from a handler
// This method is non-blocking and will not affect API response time
func (h *Handlers) LogAuditEvent(ctx context.Context, r *http.Request, pc *PublisherContext, params AuditEventParams) {
	if h.activityService == nil {
		slog.Warn("audit logging skipped: activity service not available")
		return
	}

	// Build metadata
	metadata := make(map[string]interface{})

	// Add request context
	if r != nil {
		metadata["ip_address"] = r.RemoteAddr
		metadata["user_agent"] = r.UserAgent()
		requestID := middleware.GetRequestID(ctx)
		if requestID != "" {
			metadata["request_id"] = requestID
		}
	}

	// Add before/after state as JSON for diffing
	if params.ChangesBefore != nil {
		if beforeJSON, err := toJSONMap(params.ChangesBefore); err == nil {
			metadata["before"] = beforeJSON
		}
	}
	if params.ChangesAfter != nil {
		if afterJSON, err := toJSONMap(params.ChangesAfter); err == nil {
			metadata["after"] = afterJSON
		}
	}

	// Add resource name if provided
	if params.ResourceName != "" {
		metadata["resource_name"] = params.ResourceName
	}

	// Add status
	metadata["status"] = params.Status

	// Add error message if present
	if params.ErrorMessage != "" {
		metadata["error_message"] = params.ErrorMessage
	}

	// Merge additional metadata
	for k, v := range params.AdditionalMetadata {
		metadata[k] = v
	}

	// Determine publisher ID
	publisherID := ""
	if pc != nil {
		publisherID = pc.PublisherID
	}

	// Determine action type: use specific ActionType if provided, otherwise fall back to category_action pattern
	var actionType string
	if params.ActionType != "" {
		// Use the specific granular action constant
		actionType = params.ActionType
	} else {
		// Fall back to legacy category_action pattern for backward compatibility
		actionType = params.EventCategory + "_" + params.EventAction
	}

	// Map to activity service concept
	// If using ActionType, infer concept from the action name; otherwise use category
	var concept string
	if params.ActionType != "" {
		concept = inferConceptFromActionType(params.ActionType)
	} else {
		concept = mapCategorytoConcept(params.EventCategory)
	}

	// Log asynchronously to avoid blocking the handler
	go func() {
		err := h.activityService.LogActionWithDiff(
			ctx,
			actionType,
			concept,
			params.ResourceType,
			params.ResourceID,
			publisherID,
			buildActionDiff(params.ChangesBefore, params.ChangesAfter),
			services.ExtractActionContext(r),
		)
		if err != nil {
			slog.Error("failed to log audit event",
				"error", err,
				"event_category", params.EventCategory,
				"event_action", params.EventAction,
				"resource_type", params.ResourceType,
				"resource_id", params.ResourceID,
			)
		}
	}()
}

// LogAuditEventSimple logs an audit event with minimal parameters
// Use this for simple operations that don't need before/after state
func (h *Handlers) LogAuditEventSimple(ctx context.Context, r *http.Request, pc *PublisherContext, category, action, resourceType, resourceID string) {
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		EventCategory: category,
		EventAction:   action,
		ResourceType:  resourceType,
		ResourceID:    resourceID,
		Status:        "success",
	})
}

// LogAuditEventWithBefore logs an audit event for update/delete with before state
func (h *Handlers) LogAuditEventWithBefore(ctx context.Context, r *http.Request, pc *PublisherContext, category, action, resourceType, resourceID string, before interface{}) {
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		EventCategory: category,
		EventAction:   action,
		ResourceType:  resourceType,
		ResourceID:    resourceID,
		ChangesBefore: before,
		Status:        "success",
	})
}

// LogAuditEventFailure logs a failed audit event
func (h *Handlers) LogAuditEventFailure(ctx context.Context, r *http.Request, pc *PublisherContext, category, action, resourceType, resourceID, errorMsg string) {
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		EventCategory: category,
		EventAction:   action,
		ResourceType:  resourceType,
		ResourceID:    resourceID,
		Status:        "failure",
		ErrorMessage:  errorMsg,
	})
}

// AuditCategory constants for consistent event categorization
const (
	AuditCategoryPublisher        = "publisher"
	AuditCategoryZman             = "zman"
	AuditCategoryCoverage         = "coverage"
	AuditCategoryAlgorithm        = "algorithm"
	AuditCategoryTeam             = "team"
	AuditCategoryAlias            = "alias"
	AuditCategoryTag              = "tag"
	AuditCategoryUser             = "user"
	AuditCategoryAPIKey           = "api_key"
	AuditCategoryExport           = "export"
	AuditCategorySettings         = "settings"
	AuditCategoryLocationOverride = "location_override"
	AuditCategorySnapshot         = "snapshot"
	AuditCategoryVersion          = "version"
	AuditCategoryOnboarding       = "onboarding"
	AuditCategoryCorrection       = "correction"
)

// AuditAction constants for consistent action naming
const (
	AuditActionCreate    = "create"
	AuditActionUpdate    = "update"
	AuditActionDelete    = "delete"
	AuditActionPublish   = "publish"
	AuditActionUnpublish = "unpublish"
	AuditActionImport    = "import"
	AuditActionLink      = "link"
	AuditActionCopy      = "copy"
	AuditActionRevert    = "revert"
	AuditActionInvite    = "invite"
	AuditActionAccept    = "accept"
	AuditActionResend    = "resend"
	AuditActionCancel    = "cancel"
	AuditActionRemove    = "remove"
	AuditActionAdd       = "add"
	AuditActionRestore   = "restore"
	AuditActionEnable    = "enable"
	AuditActionDisable   = "disable"
	AuditActionComplete  = "complete"
	AuditActionReset     = "reset"
	AuditActionRollback  = "rollback"
	AuditActionViewed    = "viewed"
	AuditActionExported  = "exported"
)

// AuditStatus constants
const (
	AuditStatusSuccess = "success"
	AuditStatusFailure = "failure"
)

// mapCategorytoConcept maps audit categories to activity service concepts
func mapCategorytoConcept(category string) string {
	switch category {
	case AuditCategoryPublisher, AuditCategorySettings, AuditCategoryOnboarding, AuditCategorySnapshot:
		return services.ConceptPublisher
	case AuditCategoryZman, AuditCategoryAlias, AuditCategoryTag:
		return services.ConceptZman
	case AuditCategoryCoverage, AuditCategoryLocationOverride, AuditCategoryCorrection:
		return services.ConceptCoverage
	case AuditCategoryAlgorithm, AuditCategoryVersion:
		return services.ConceptAlgorithm
	case AuditCategoryTeam, AuditCategoryUser:
		return services.ConceptPublisher // Team operations are publisher-scoped
	default:
		return category
	}
}

// inferConceptFromActionType infers the concept from a specific action type constant
// This maps granular action types to their high-level concepts
func inferConceptFromActionType(actionType string) string {
	// Team-related actions
	if actionType == services.ActionTeamMemberAdded ||
		actionType == services.ActionTeamMemberRemoved ||
		actionType == services.ActionTeamInvitationSent ||
		actionType == services.ActionTeamInvitationResent ||
		actionType == services.ActionTeamInvitationCancelled ||
		actionType == services.ActionTeamInvitationAccepted {
		return services.ConceptPublisher // Team operations are publisher-scoped
	}

	// Settings-related actions
	if actionType == services.ActionSettingsCalculationUpdated ||
		actionType == services.ActionSettingsTransliterationUpdated ||
		actionType == services.ActionSettingsElevationUpdated ||
		actionType == services.ActionSettingsUpdate {
		return services.ConceptPublisher
	}

	// Coverage-related actions
	if actionType == services.ActionCoverageGlobalEnabled ||
		actionType == services.ActionCoverageGlobalDisabled ||
		actionType == services.ActionCoverageRegionAdded ||
		actionType == services.ActionCoverageRegionRemoved ||
		actionType == services.ActionCoverageAdd ||
		actionType == services.ActionCoverageRemove {
		return services.ConceptCoverage
	}

	// Zman-related actions
	if actionType == services.ActionZmanCreate ||
		actionType == services.ActionZmanUpdate ||
		actionType == services.ActionZmanDelete {
		return services.ConceptZman
	}

	// Algorithm-related actions
	if actionType == services.ActionAlgorithmSave ||
		actionType == services.ActionAlgorithmPublish {
		return services.ConceptAlgorithm
	}

	// Version-related actions
	if actionType == services.ActionVersionSnapshotCreated ||
		actionType == services.ActionVersionRollbackExecuted ||
		actionType == services.ActionSnapshotCreated ||
		actionType == services.ActionSnapshotRestored ||
		actionType == services.ActionSnapshotDeleted {
		return services.ConceptPublisher
	}

	// Location override actions
	if actionType == services.ActionLocationOverrideCreated ||
		actionType == services.ActionLocationOverrideUpdated ||
		actionType == services.ActionLocationOverrideDeleted {
		return services.ConceptCoverage
	}

	// Onboarding actions
	if actionType == services.ActionOnboardingCompleted ||
		actionType == services.ActionOnboardingReset {
		return services.ConceptPublisher
	}

	// Admin actions
	if actionType == services.ActionAdminPublisherVerify ||
		actionType == services.ActionAdminPublisherSuspend ||
		actionType == services.ActionAdminPublisherReactivate ||
		actionType == services.ActionAdminPublisherDelete ||
		actionType == services.ActionAdminPublisherRestore ||
		actionType == services.ActionAdminPublisherPermanentDelete ||
		actionType == services.ActionAdminPublisherCertified ||
		actionType == services.ActionAdminPublisherCreate ||
		actionType == services.ActionAdminPublisherUpdate ||
		actionType == services.ActionAdminUserAdd ||
		actionType == services.ActionAdminUserRemove ||
		actionType == services.ActionAdminCorrectionApprove ||
		actionType == services.ActionAdminCorrectionReject ||
		actionType == services.ActionAdminPublisherExport ||
		actionType == services.ActionAdminPublisherImport ||
		actionType == services.ActionAdminCacheFlush ||
		actionType == services.ActionAdminLocalityUpdate ||
		actionType == services.ActionAdminGrantAccess ||
		actionType == services.ActionAdminRevokeAccess ||
		actionType == services.ActionAdminSetRole ||
		actionType == services.ActionAdminPasswordReset ||
		actionType == services.ActionAdminImpersonate ||
		actionType == services.ActionAdminSystemConfig ||
		actionType == services.ActionAdminRequestApprove ||
		actionType == services.ActionAdminRequestReject ||
		actionType == services.ActionAdminZmanRequestReview ||
		actionType == services.ActionAdminTagApprove ||
		actionType == services.ActionAdminTagReject ||
		actionType == services.ActionAdminMasterZmanCreate ||
		actionType == services.ActionAdminMasterZmanUpdate ||
		actionType == services.ActionAdminMasterZmanDelete ||
		actionType == services.ActionAdminZmanVisibilityToggle ||
		actionType == services.ActionAdminImpersonationStart ||
		actionType == services.ActionAdminImpersonationEnd ||
		actionType == services.ActionAdminAuditLogsViewed ||
		actionType == services.ActionAdminAuditLogsExported ||
		actionType == services.ActionAdminUserCreated ||
		actionType == services.ActionAdminUserRoleUpdated ||
		actionType == services.ActionAdminUserInvited {
		return services.ConceptAdmin
	}

	// Default fallback
	if actionType == services.ActionProfileUpdate {
		return services.ConceptPublisher
	}

	// If unknown, return the action type itself as the concept
	return actionType
}

// toJSONMap converts an interface to a map[string]interface{} for JSON serialization
func toJSONMap(v interface{}) (map[string]interface{}, error) {
	if v == nil {
		return nil, nil
	}

	// If already a map, return it
	if m, ok := v.(map[string]interface{}); ok {
		return m, nil
	}

	// Otherwise, marshal and unmarshal to get a map
	data, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	return result, nil
}

// buildActionDiff builds an ActionDiff from before/after states
func buildActionDiff(before, after interface{}) *services.ActionDiff {
	if before == nil && after == nil {
		return nil
	}

	diff := &services.ActionDiff{}

	if before != nil {
		if m, err := toJSONMap(before); err == nil {
			diff.Old = m
		}
	}

	if after != nil {
		if m, err := toJSONMap(after); err == nil {
			diff.New = m
		}
	}

	return diff
}

// BeforeStateCapture is a helper struct to capture before state for updates
type BeforeStateCapture struct {
	ResourceType string
	ResourceID   string
	Data         interface{}
}

// NewBeforeStateCapture creates a new before state capture
func NewBeforeStateCapture(resourceType, resourceID string, data interface{}) *BeforeStateCapture {
	return &BeforeStateCapture{
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Data:         data,
	}
}
