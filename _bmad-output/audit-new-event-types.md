# New Audit Event Types Needed

## Executive Summary

This document identifies missing audit event types by analyzing:
1. Existing event type constants in `api/internal/services/activity_service.go`
2. Current audit logging patterns in handlers
3. Handler operations that lack audit coverage

**Naming Convention**: `{context}.{resource}.{action}`

---

## Current State Analysis

### Existing Event Types (Activity Service)

**Publisher Actions:**
- `profile_update`
- `settings_update`
- `algorithm_save`
- `algorithm_publish`
- `coverage_add`
- `coverage_remove`
- `zman_create`
- `zman_update`
- `zman_delete`

**Admin Actions:**
- `admin_publisher_verify`
- `admin_publisher_suspend`
- `admin_publisher_reactivate`
- `admin_publisher_delete`
- `admin_publisher_restore`
- `admin_publisher_permanent_delete`
- `admin_publisher_certified`
- `admin_publisher_create`
- `admin_publisher_update`
- `admin_user_add`
- `admin_user_remove`
- `admin_correction_approve`
- `admin_correction_reject`
- `admin_publisher_export`
- `admin_publisher_import`
- `admin_cache_flush`
- `admin_locality_update`
- `admin_grant_access`
- `admin_revoke_access`
- `admin_set_role`
- `admin_password_reset`
- `admin_impersonate`
- `admin_system_config`

### Existing Categories (Audit Helpers)

- `publisher`
- `zman`
- `coverage`
- `algorithm`
- `team`
- `alias`
- `tag`
- `user`
- `api_key`
- `export`
- `settings`

---

## Gap Analysis: Missing Event Types

## 1. Publisher Events

### 1.1 Settings Events (MISSING AUDIT)
**Gap**: `publisher_settings.go` logs via `activity_service.LogAction` but not via `LogAuditEvent`

```
publisher.settings.calculation.updated
publisher.settings.transliteration.updated
publisher.settings.elevation.updated
publisher.settings.rounding_mode.updated (future)
```

### 1.2 Coverage Events (PARTIALLY COVERED)
**Current**: `coverage_add`, `coverage_remove`, `coverage_update` exist
**Missing**:

```
publisher.coverage.global.enabled
publisher.coverage.global.disabled
publisher.coverage.region.added
publisher.coverage.region.removed
publisher.coverage.locality.added
publisher.coverage.locality.removed
```

### 1.3 Team Management Events (MISSING AUDIT)
**Gap**: Team operations in `publisher_team.go` have NO audit logging

```
publisher.team.member.added
publisher.team.member.removed
publisher.team.member.invited (deprecated but still used)
publisher.team.invitation.resent
publisher.team.invitation.cancelled
publisher.team.invitation.accepted
publisher.team.invitation.expired
publisher.team.owner.transferred (future)
publisher.team.role.changed (future)
```

### 1.4 Algorithm Events (PARTIALLY COVERED)
**Current**: `algorithm_save`, `algorithm_publish`
**Missing**:

```
publisher.algorithm.version.created
publisher.algorithm.version.deprecated
publisher.algorithm.version.activated
publisher.algorithm.visibility.changed
publisher.algorithm.copied
publisher.algorithm.forked
```

### 1.5 Zman Events (MOSTLY COVERED)
**Current**: `zman_create`, `zman_update`, `zman_delete`
**Missing**:

```
publisher.zman.published
publisher.zman.unpublished
publisher.zman.restored
publisher.zman.bulk_imported
publisher.zman.linked_from_publisher
publisher.zman.copied_from_publisher
```

### 1.6 Zman Alias Events (PARTIALLY COVERED)
**Current**: Logged in handlers but not in service constants
**Standardize**:

```
publisher.alias.created
publisher.alias.updated
publisher.alias.deleted
```

### 1.7 Zman Tag Events (PARTIALLY COVERED)
**Current**: Logged in handlers but not in service constants
**Standardize**:

```
publisher.tag.assignment.updated
publisher.tag.assignment.reverted
publisher.tag.added
publisher.tag.removed
```

### 1.8 Version History Events (MISSING AUDIT)
**Gap**: `version_history.go` has NO audit logging

```
publisher.version.snapshot.created
publisher.version.rollback.executed
publisher.version.diff.viewed
```

### 1.9 Onboarding Events (MISSING AUDIT)
**Gap**: `onboarding.go` has NO audit logging

```
publisher.onboarding.completed
publisher.onboarding.reset
publisher.onboarding.step.completed
```

### 1.10 Profile Events (PARTIALLY COVERED)
**Current**: `profile_update`
**Missing detailed tracking**:

```
publisher.profile.name.updated
publisher.profile.slug.updated
publisher.profile.description.updated
publisher.profile.logo.updated
publisher.profile.contact.updated
```

### 1.11 Location Override Events (MISSING AUDIT)
**Gap**: `location_overrides.go` has NO audit logging

```
publisher.location_override.created
publisher.location_override.updated
publisher.location_override.deleted
```

### 1.12 Snapshot Events (MISSING AUDIT)
**Gap**: `publisher_snapshots.go` has NO audit logging

```
publisher.snapshot.created
publisher.snapshot.restored
publisher.snapshot.deleted
```

---

## 2. Admin Events

### 2.1 Correction Request Events (MISSING AUDIT)
**Gap**: Admin correction handlers have NO audit logging

```
admin.correction.approved
admin.correction.rejected
admin.correction.locality.updated
```

### 2.2 System Events (PARTIALLY COVERED)
**Current**: `admin_cache_flush`, `admin_system_config`
**Missing**:

```
admin.system.cache.flushed
admin.system.config.updated
admin.system.reindex.triggered
admin.system.stats.accessed
```

### 2.3 Publisher Management Events (MOSTLY COVERED)
**Current**: Good coverage for publisher lifecycle
**Missing granular events**:

```
admin.publisher.verified.revoked
admin.publisher.certified.granted
admin.publisher.certified.revoked
admin.publisher.data.exported
admin.publisher.data.imported
```

### 2.4 User Management Events (PARTIALLY COVERED)
**Current**: `admin_user_add`, `admin_user_remove`
**Missing**:

```
admin.user.created
admin.user.role.updated
admin.user.access.granted
admin.user.access.revoked
admin.user.password.reset
admin.user.invited
```

### 2.5 Impersonation Events (DEFINED BUT NOT IMPLEMENTED)
**Current**: Constant exists but no usage found
**Need to implement**:

```
admin.impersonation.started
admin.impersonation.ended
admin.impersonation.action.performed
```

### 2.6 Audit Events (MISSING)
**Gap**: Audit log access should be audited

```
admin.audit.logs.viewed
admin.audit.logs.filtered
admin.audit.logs.exported
admin.audit.stats.viewed
```

---

## 3. User/Public Events

### 3.1 Correction Request Events (MISSING AUDIT)
**Gap**: User-initiated correction requests not audited

```
user.correction.submitted
user.correction.updated
user.correction.deleted
user.correction.cancelled
```

### 3.2 External API Events (MISSING AUDIT)
**Gap**: External API usage not audited

```
api.external.zmanim.requested
api.external.bulk.requested
api.external.rate_limit.exceeded
api.external.authentication.failed
```

### 3.3 AI Events (PARTIALLY COVERED)
**Gap**: AI operations logged separately but not in unified audit

```
ai.formula.generated
ai.formula.explained
ai.search.executed
ai.context.assembled
ai.reindex.triggered
```

---

## 4. System/Integration Events

### 4.1 Cache Events (PARTIALLY COVERED)
**Current**: `admin_cache_flush`
**Missing**:

```
cache.publisher.invalidated
cache.zmanim.invalidated
cache.hit
cache.miss (for monitoring)
```

### 4.2 Email Events (MISSING AUDIT)
**Gap**: Email sending not audited

```
email.invitation.sent
email.team_member_added.sent
email.welcome.sent
email.password_reset.sent
email.failed.logged
```

### 4.3 Authentication Events (MISSING AUDIT)
**Gap**: Auth events not audited

```
auth.login.succeeded
auth.login.failed
auth.logout
auth.token.refreshed
auth.session.expired
```

---

## Recommended Event Types to Add (Priority Order)

### HIGH PRIORITY (Security & Compliance)

#### Admin Events
```go
// Impersonation tracking
ActionAdminImpersonationStart = "admin_impersonation_start"
ActionAdminImpersonationEnd   = "admin_impersonation_end"

// Audit access tracking
ActionAdminAuditLogsViewed   = "admin_audit_logs_viewed"
ActionAdminAuditLogsExported = "admin_audit_logs_exported"

// User management
ActionAdminUserCreated      = "admin_user_created"
ActionAdminUserRoleUpdated  = "admin_user_role_updated"
ActionAdminUserInvited      = "admin_user_invited"
```

#### Publisher Team Events
```go
ActionTeamMemberAdded     = "team_member_added"
ActionTeamMemberRemoved   = "team_member_removed"
ActionTeamInvitationSent  = "team_invitation_sent"
ActionTeamInvitationResent = "team_invitation_resent"
ActionTeamInvitationCancelled = "team_invitation_cancelled"
ActionTeamInvitationAccepted  = "team_invitation_accepted"
```

### MEDIUM PRIORITY (Operations & Compliance)

#### Publisher Settings Events
```go
ActionSettingsCalculationUpdated     = "settings_calculation_updated"
ActionSettingsTransliterationUpdated = "settings_transliteration_updated"
ActionSettingsElevationUpdated       = "settings_elevation_updated"
```

#### Coverage Events (Granular)
```go
ActionCoverageGlobalEnabled  = "coverage_global_enabled"
ActionCoverageGlobalDisabled = "coverage_global_disabled"
ActionCoverageRegionAdded    = "coverage_region_added"
ActionCoverageRegionRemoved  = "coverage_region_removed"
```

#### Version History Events
```go
ActionVersionSnapshotCreated = "version_snapshot_created"
ActionVersionRollbackExecuted = "version_rollback_executed"
```

#### Location Override Events
```go
ActionLocationOverrideCreated = "location_override_created"
ActionLocationOverrideUpdated = "location_override_updated"
ActionLocationOverrideDeleted = "location_override_deleted"
```

### LOW PRIORITY (Enhancement)

#### Algorithm Events
```go
ActionAlgorithmVersionDeprecated = "algorithm_version_deprecated"
ActionAlgorithmVisibilityChanged = "algorithm_visibility_changed"
ActionAlgorithmCopied            = "algorithm_copied"
ActionAlgorithmForked            = "algorithm_forked"
```

#### Onboarding Events
```go
ActionOnboardingCompleted = "onboarding_completed"
ActionOnboardingReset     = "onboarding_reset"
```

#### Correction Events (User)
```go
ActionCorrectionSubmitted = "correction_submitted"
ActionCorrectionUpdated   = "correction_updated"
ActionCorrectionCancelled = "correction_cancelled"
```

---

## Implementation Strategy

### Phase 1: Security & Compliance (Week 1)
1. Add admin impersonation tracking
2. Add admin audit log access tracking
3. Add team management events
4. Add user management events

### Phase 2: Publisher Operations (Week 2)
1. Add publisher settings events
2. Add granular coverage events
3. Add version history events
4. Add location override events

### Phase 3: Enhancement (Week 3)
1. Add algorithm collaboration events
2. Add onboarding tracking
3. Add user correction events
4. Add external API usage tracking

---

## Code Changes Required

### 1. Update `activity_service.go` Constants

Add new constants to the service file:

```go
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

// Onboarding action types
const (
    ActionOnboardingCompleted = "onboarding_completed"
    ActionOnboardingReset     = "onboarding_reset"
)

// Admin impersonation tracking
const (
    ActionAdminImpersonationStart = "admin_impersonation_start"
    ActionAdminImpersonationEnd   = "admin_impersonation_end"
)

// Admin audit tracking
const (
    ActionAdminAuditLogsViewed   = "admin_audit_logs_viewed"
    ActionAdminAuditLogsExported = "admin_audit_logs_exported"
)
```

### 2. Update Handler Files

#### Files Needing Audit Integration:

1. **publisher_team.go** - Add audit logging to:
   - `AddPublisherTeamMember()`
   - `RemovePublisherTeamMember()`
   - `ResendPublisherInvitation()`
   - `CancelPublisherInvitation()`
   - `AcceptPublisherInvitation()`

2. **publisher_settings.go** - Replace `activity_service.LogAction` with `LogAuditEvent`:
   - `UpdatePublisherCalculationSettings()`

3. **version_history.go** - Add audit logging to:
   - `CreateVersionSnapshot()`
   - `RollbackVersion()`

4. **location_overrides.go** - Add audit logging to:
   - `CreateLocationOverride()`
   - `UpdateLocationOverride()`
   - `DeleteLocationOverride()`

5. **onboarding.go** - Add audit logging to:
   - `CompleteOnboarding()`
   - `ResetOnboarding()`

6. **admin_audit.go** - Add self-audit logging to:
   - `GetAdminAuditLogs()`
   - `ExportAdminAuditLogs()`

---

## Summary Statistics

### Current Coverage
- **Publisher events**: ~40% covered (zman, coverage basics)
- **Admin events**: ~60% covered (lifecycle management)
- **Team events**: 0% covered
- **Settings events**: 0% covered (uses old LogAction pattern)
- **Version history**: 0% covered
- **Location overrides**: 0% covered

### Total New Event Types Recommended
- **High Priority**: 15 event types
- **Medium Priority**: 12 event types
- **Low Priority**: 8 event types
- **Total**: 35 new event types

### Files Requiring Changes
- `activity_service.go`: Add ~35 new constants
- Handler files: Add audit logging to ~15 handler functions
- Estimated LOC: ~500-800 lines

---

## Compliance & Security Notes

### Critical for Compliance
1. **Team member changes** - Required for access control auditing
2. **Admin impersonation** - Required for admin activity tracking
3. **Settings changes** - Required for calculation transparency
4. **Version rollbacks** - Required for change tracking

### Best Practices
1. Always capture before/after state for updates
2. Include user context (email, IP, user agent)
3. Log failures as well as successes
4. Use consistent naming convention
5. Include duration for performance tracking

---

## Next Steps

1. **Review and Approve**: Stakeholder review of proposed event types
2. **Prioritize**: Confirm implementation priority
3. **Implement Phase 1**: Add high-priority security events
4. **Test**: Verify audit trail completeness
5. **Document**: Update API documentation with new events
6. **Monitor**: Track audit log volume and performance impact

---

**Generated**: 2025-12-28
**Author**: Claude Code Audit Analysis
**Status**: Proposal - Awaiting Review
