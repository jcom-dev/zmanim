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

	"github.com/jcom-dev/zmanim/internal/services"
)

// AuditEventParams contains parameters for logging an audit event
type AuditEventParams struct {
	ActionType         string
	ResourceType       string
	ResourceID         string
	ResourceName       string
	ChangesBefore      interface{}
	ChangesAfter       interface{}
	Status             string
	ErrorMessage       string
	AdditionalMetadata map[string]interface{}
}

// LogAuditEvent logs an audit event from a handler
func (h *Handlers) LogAuditEvent(ctx context.Context, r *http.Request, pc *PublisherContext, params AuditEventParams) {
	if h.activityService == nil {
		slog.Warn("audit logging skipped: activity service not available")
		return
	}

	publisherID := ""
	if pc != nil {
		publisherID = pc.PublisherID
	}

	go func() {
		err := h.activityService.LogActionWithDiff(
			ctx,
			params.ActionType,
			inferConceptFromActionType(params.ActionType),
			params.ResourceType,
			params.ResourceID,
			publisherID,
			buildActionDiff(params.ChangesBefore, params.ChangesAfter),
			services.ExtractActionContext(r),
		)
		if err != nil {
			slog.Error("failed to log audit event",
				"error", err,
				"action_type", params.ActionType,
				"resource_type", params.ResourceType,
				"resource_id", params.ResourceID,
			)
		}
	}()
}

// AuditStatus constants
const (
	AuditStatusSuccess = "success"
	AuditStatusFailure = "failure"
)

// inferConceptFromActionType infers the concept from a specific action type constant
func inferConceptFromActionType(actionType string) string {
	// Team-related actions
	if actionType == services.ActionTeamMemberAdded ||
		actionType == services.ActionTeamMemberRemoved ||
		actionType == services.ActionTeamInvitationSent ||
		actionType == services.ActionTeamInvitationResent ||
		actionType == services.ActionTeamInvitationCancelled ||
		actionType == services.ActionTeamInvitationAccepted {
		return services.ConceptPublisher
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

	// Correction request actions
	if actionType == services.ActionCorrectionRequestCreate ||
		actionType == services.ActionCorrectionRequestUpdate ||
		actionType == services.ActionCorrectionRequestDelete {
		return services.ConceptCoverage
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

	if actionType == services.ActionProfileUpdate {
		return services.ConceptPublisher
	}

	return actionType
}

// toJSONMap converts an interface to a map[string]interface{} for JSON serialization
func toJSONMap(v interface{}) (map[string]interface{}, error) {
	if v == nil {
		return nil, nil
	}

	if m, ok := v.(map[string]interface{}); ok {
		return m, nil
	}

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
