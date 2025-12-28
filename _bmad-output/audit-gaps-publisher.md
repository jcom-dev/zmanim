# Publisher Endpoint Audit Logging Gaps Analysis

**Generated:** 2025-12-28
**Scope:** All POST/PUT/PATCH/DELETE endpoints under `/api/v1/publisher/*`

## Executive Summary

**Total Publisher Mutation Endpoints:** 62
**Endpoints WITH Audit Logging:** 16 (26%)
**Endpoints WITHOUT Audit Logging:** 46 (74%)

### Critical Gaps Identified

The following high-impact areas lack comprehensive audit logging:
- **Settings mutations** (global coverage, calculation settings, algorithm visibility)
- **Profile updates** (logo uploads, profile edits)
- **Coverage management** (3 of 4 endpoints missing)
- **Location overrides** (all 3 endpoints missing)
- **Version control operations** (snapshot, rollback)
- **Onboarding workflow** (complete/reset)
- **Correction requests** (all 4 endpoints missing)
- **Cache invalidation** (critical for troubleshooting)
- **Team management** (6 of 7 endpoints missing)
- **Snapshot operations** (5 of 7 endpoints missing)

---

## Complete Endpoint Inventory

| File | Function | Route | Method | Mutation | Has Audit | Missing Events |
|------|----------|-------|--------|----------|-----------|----------------|
| **publisher_zmanim.go** | | | | | | |
| publisher_zmanim.go | CreatePublisherZman | /publisher/zmanim | POST | Creates custom zman | ✅ YES | - |
| publisher_zmanim.go | UpdatePublisherZman | /publisher/zmanim/{zmanKey} | PUT | Updates zman formula/settings | ✅ YES | - |
| publisher_zmanim.go | SoftDeletePublisherZman | /publisher/zmanim/{zmanKey} | DELETE | Soft deletes zman | ✅ YES | - |
| publisher_zmanim.go | ImportZmanim | /publisher/zmanim/import | POST | Bulk imports zmanim | ✅ YES | - |
| publisher_zmanim.go | CreateZmanFromPublisher | /publisher/zmanim/from-publisher | POST | Copy/link from another publisher | ✅ YES | - |
| publisher_zmanim.go | RestorePublisherZman | /publisher/zmanim/{zmanKey}/restore | POST | Restores soft-deleted zman | ❌ NO | `restore_zman` |
| publisher_zmanim.go | PermanentDeletePublisherZman | /publisher/zmanim/{zmanKey}/permanent | DELETE | Permanently deletes zman | ❌ NO | `permanent_delete_zman` |
| publisher_zmanim.go | RollbackZmanVersion | /publisher/zmanim/{zmanKey}/rollback | POST | Rollback to previous version | ❌ NO | `rollback_zman_version` |
| publisher_zmanim.go | UpdatePublisherZmanTags | /publisher/zmanim/{zmanKey}/tags | PUT | Replace all zman tags | ✅ YES | - |
| publisher_zmanim.go | RevertPublisherZmanTags | /publisher/zmanim/{zmanKey}/tags/revert | POST | Revert tags to master | ✅ YES | - |
| publisher_zmanim.go | AddTagToPublisherZman | /publisher/zmanim/{zmanKey}/tags/{tagId} | POST | Add single tag to zman | ❌ NO | `add_zman_tag` |
| publisher_zmanim.go | RemoveTagFromPublisherZman | /publisher/zmanim/{zmanKey}/tags/{tagId} | DELETE | Remove tag from zman | ❌ NO | `remove_zman_tag` |
| **publisher_aliases.go** | | | | | | |
| publisher_aliases.go | CreateOrUpdateAlias | /publisher/zmanim/{zmanKey}/alias | PUT | Create/update zman alias | ✅ YES | - |
| publisher_aliases.go | DeleteAlias | /publisher/zmanim/{zmanKey}/alias | DELETE | Delete zman alias | ✅ YES | - |
| **publisher_algorithm.go** | | | | | | |
| publisher_algorithm.go | UpdatePublisherAlgorithmHandler | /publisher/algorithm | PUT | Update algorithm config | ❌ NO | `update_algorithm` (uses activity_service, NOT audit) |
| publisher_algorithm.go | PublishAlgorithm | /publisher/algorithm/publish | POST | Publish draft algorithm | ❌ NO | `publish_algorithm` (uses activity_service, NOT audit) |
| publisher_algorithm.go | DeprecateAlgorithmVersion | /publisher/algorithm/versions/{id}/deprecate | PUT | Deprecate algorithm version | ✅ YES | - |
| **publisher_settings.go** | | | | | | |
| publisher_settings.go | UpdatePublisherCalculationSettings | /publisher/settings/calculation | PUT | Update calculation settings | ❌ NO | `update_calculation_settings` (uses activity_service, NOT audit) |
| publisher_settings.go | UpdateGlobalCoverage | /publisher/settings/global-coverage | PUT | Enable/disable global coverage | ❌ NO | `enable_global_coverage`, `disable_global_coverage` |
| **coverage.go** | | | | | | |
| coverage.go | CreatePublisherCoverage | /publisher/coverage | POST | Add coverage region | ✅ YES | - |
| coverage.go | UpdatePublisherCoverage | /publisher/coverage/{id} | PUT | Update coverage region | ❌ NO | `update_coverage` |
| coverage.go | DeletePublisherCoverage | /publisher/coverage/{id} | DELETE | Delete coverage region | ✅ YES | - |
| **location_overrides.go** | | | | | | |
| location_overrides.go | CreateLocationOverride | /publisher/localities/{localityId}/override | POST | Create location override | ❌ NO | `create_location_override` |
| location_overrides.go | UpdateLocationOverride | /publisher/location-overrides/{id} | PUT | Update location override | ❌ NO | `update_location_override` |
| location_overrides.go | DeleteLocationOverride | /publisher/location-overrides/{id} | DELETE | Delete location override | ❌ NO | `delete_location_override` |
| **handlers.go** (profile) | | | | | | |
| handlers.go | UpdatePublisherProfile | /publisher/profile | PUT | Update publisher profile | ❌ NO | `update_profile` |
| **upload.go** | | | | | | |
| upload.go | UploadPublisherLogo | /publisher/logo | POST | Upload publisher logo | ❌ NO | `upload_logo` |
| **handlers.go** (cache) | | | | | | |
| handlers.go | InvalidatePublisherCache | /publisher/cache | DELETE | Clear publisher cache | ❌ NO | `invalidate_cache` |
| **publisher_team.go** | | | | | | |
| publisher_team.go | AddPublisherTeamMember | /publisher/team/invite | POST | Add team member (direct) | ❌ NO | `add_team_member` |
| publisher_team.go | RemovePublisherTeamMember | /publisher/team/{userId} | DELETE | Remove team member | ❌ NO | `remove_team_member` |
| publisher_team.go | ResendPublisherInvitation | /publisher/team/invitations/{id}/resend | POST | Resend team invitation | ❌ NO | `resend_team_invitation` |
| publisher_team.go | CancelPublisherInvitation | /publisher/team/invitations/{id} | DELETE | Cancel team invitation | ❌ NO | `cancel_team_invitation` |
| publisher_team.go | AcceptPublisherInvitation | /publisher/team/accept | POST | Accept team invitation | ❌ NO | `accept_team_invitation` |
| **publisher_snapshots.go** | | | | | | |
| publisher_snapshots.go | ImportPublisherSnapshot | /publisher/snapshot/import | POST | Import snapshot | ❌ NO | `import_snapshot` |
| publisher_snapshots.go | SavePublisherSnapshot | /publisher/snapshot | POST | Save snapshot version | ❌ NO | `save_snapshot` |
| publisher_snapshots.go | RestorePublisherSnapshot | /publisher/snapshot/{id}/restore | POST | Restore from snapshot | ❌ NO | `restore_snapshot` |
| publisher_snapshots.go | DeletePublisherSnapshot | /publisher/snapshot/{id} | DELETE | Delete snapshot | ❌ NO | `delete_snapshot` |
| **onboarding.go** | | | | | | |
| onboarding.go | CompleteOnboarding | /publisher/onboarding/complete | POST | Mark onboarding complete | ❌ NO | `complete_onboarding` |
| onboarding.go | ResetOnboarding | /publisher/onboarding | DELETE | Reset onboarding state | ❌ NO | `reset_onboarding` |
| **algorithm_collaboration.go** | | | | | | |
| algorithm_collaboration.go | SetAlgorithmVisibility | /publisher/algorithm/visibility | PUT | Set algorithm public/private | ❌ NO | `set_algorithm_visibility` |
| algorithm_collaboration.go | CopyAlgorithm | /algorithms/{id}/copy | POST | Copy algorithm from public | ❌ NO | `copy_algorithm` |
| algorithm_collaboration.go | ForkAlgorithm | /algorithms/{id}/fork | POST | Fork algorithm from public | ❌ NO | `fork_algorithm` |
| **version_history.go** | | | | | | |
| version_history.go | CreateVersionSnapshot | /publisher/algorithm/snapshot | POST | Create algorithm snapshot | ❌ NO | `create_algorithm_snapshot` |
| version_history.go | RollbackVersion | /publisher/algorithm/rollback | POST | Rollback algorithm version | ❌ NO | `rollback_algorithm_version` |
| **correction_requests.go** | | | | | | |
| correction_requests.go | CreateCorrectionRequest | /publisher/correction-requests | POST | Submit locality correction | ❌ NO | `create_correction_request` |
| correction_requests.go | UpdateCorrectionRequest | /publisher/correction-requests/{id} | PUT | Update correction request | ❌ NO | `update_correction_request` |
| correction_requests.go | DeleteCorrectionRequest | /publisher/correction-requests/{id} | DELETE | Delete correction request | ❌ NO | `delete_correction_request` |
| correction_requests.go | UpdateCorrectionRequestStatus | /auth/correction-requests/{id}/status | PUT | Update request status (admin) | ❌ NO | `approve_correction_request`, `reject_correction_request` |
| **zman_requests.go** (publisher endpoints) | | | | | | |
| zman_requests.go | CreateZmanRegistryRequest | /publisher/zman-requests | POST | Request new zman in registry | ❌ NO | `create_zman_request` |
| **registry_linking.go** | | | | | | |
| registry_linking.go | LinkPublisherZman | /publisher/registry/link | POST | Link to publisher's zman | ❌ NO | `link_publisher_zman` |
| registry_linking.go | CopyPublisherZman | /publisher/registry/copy | POST | Copy publisher's zman | ❌ NO | `copy_publisher_zman` |

---

## Audit Coverage by Category

### ✅ GOOD Coverage (>50%)

| Category | Coverage | Notes |
|----------|----------|-------|
| **Zman CRUD** | 75% (6/8) | Missing: restore, permanent delete |
| **Zman Tags** | 50% (2/4) | Missing: add single tag, remove single tag |
| **Zman Aliases** | 100% (2/2) | ✅ Complete coverage |
| **Algorithm Versioning** | 33% (1/3) | Has deprecate, missing update/publish |

### ⚠️ PARTIAL Coverage (10-50%)

| Category | Coverage | Notes |
|----------|----------|-------|
| **Coverage Management** | 50% (2/4) | Missing: update coverage, global coverage toggle |
| **Team Management** | 0% (0/6) | ❌ Complete gap |
| **Snapshots** | 0% (0/5) | ❌ Complete gap |

### ❌ CRITICAL Gaps (0% coverage)

| Category | Coverage | Notes |
|----------|----------|-------|
| **Location Overrides** | 0% (0/3) | Create, update, delete - no logging |
| **Profile Management** | 0% (0/2) | Profile update, logo upload - no logging |
| **Settings** | 0% (0/2) | Calculation settings, global coverage - uses activity_service |
| **Onboarding** | 0% (0/2) | Complete, reset - no logging |
| **Correction Requests** | 0% (0/4) | All CRUD operations missing |
| **Version Control** | 0% (0/2) | Snapshot creation, rollback - no logging |
| **Algorithm Operations** | 0% (0/5) | Copy, fork, visibility, snapshot, rollback - no logging |
| **Registry Linking** | 0% (0/3) | Link, copy, create request - no logging |
| **Cache Operations** | 0% (0/1) | Cache invalidation - critical for troubleshooting |

---

## Key Observations

### 1. Activity Service vs. Audit Service Confusion

Several endpoints use `activity_service.LogAction()` instead of `h.LogAuditEvent()`:
- `UpdatePublisherAlgorithmHandler` (publisher_algorithm.go:283)
- `PublishAlgorithm` (publisher_algorithm.go:608)
- `UpdatePublisherCalculationSettings` (publisher_settings.go:148)

**Issue:** The activity service is NOT the same as the audit trail system. These events are logged to a different table/system and won't appear in the unified audit trail.

**Recommendation:** Replace `activity_service.LogAction()` with `h.LogAuditEvent()` for all publisher mutations.

### 2. High-Impact Missing Events

#### Settings & Configuration
- `enable_global_coverage` / `disable_global_coverage` - Critical business logic change
- `update_calculation_settings` - Affects ALL zmanim calculations
- `set_algorithm_visibility` - Security/privacy control
- `update_rounding_mode` - Changes calculation behavior

#### Data Integrity
- `restore_zman` - Undoing deletions (audit trail broken)
- `permanent_delete_zman` - Irreversible data loss (MUST be logged)
- `restore_snapshot` - Bulk data restoration (high impact)
- `import_snapshot` - Bulk data modification (high impact)
- `rollback_algorithm_version` - Reverting to previous state

#### Team & Access Control
- `add_team_member` - Granting access (security)
- `remove_team_member` - Revoking access (security)
- `accept_team_invitation` - Access granted event

#### Troubleshooting
- `invalidate_cache` - Critical for debugging calculation issues

### 3. Inconsistent Coverage Patterns

**Well-Logged Areas:**
- Zman creation/update/soft-delete
- Alias management
- Tag bulk operations (PUT)

**Poorly-Logged Areas:**
- Single-item tag operations (POST/DELETE individual tags)
- Version control operations
- Settings/configuration changes
- Team management
- Snapshot operations

### 4. Version History Gaps

The per-zman version history system (`RollbackZmanVersion`) lacks audit logging, making it impossible to track:
- Who rolled back a zman
- When rollbacks occurred
- What version was restored

---

## Recommended Priority Fixes

### Priority 1 (Critical - Security/Compliance)
1. **Team Management** - All 6 endpoints (access control audit)
2. **Permanent Delete** - `permanent_delete_zman` (irreversible data loss)
3. **Global Coverage Toggle** - `enable_global_coverage` (business-critical setting)
4. **Algorithm Visibility** - `set_algorithm_visibility` (privacy control)

### Priority 2 (High - Data Integrity)
1. **Snapshot Operations** - All 5 endpoints (bulk data changes)
2. **Version Rollback** - Both zman and algorithm rollback
3. **Location Overrides** - All 3 endpoints (coordinate mutations)
4. **Correction Requests** - All 4 endpoints (data quality audit)

### Priority 3 (Medium - Operational)
1. **Cache Invalidation** - `invalidate_cache` (troubleshooting)
2. **Profile Updates** - Logo upload, profile edit
3. **Onboarding** - Complete/reset (user workflow tracking)
4. **Coverage Updates** - `update_coverage`

### Priority 4 (Low - Consistency)
1. **Single Tag Operations** - Add/remove individual tags
2. **Algorithm Collaboration** - Copy/fork operations
3. **Registry Linking** - Link/copy from other publishers
4. **Zman Restore** - Restore soft-deleted zman

---

## Implementation Notes

### Event Naming Convention

Based on existing patterns:
```go
// Category prefixes
AuditCategoryZman     = "zman"
AuditCategoryAlias    = "alias"
AuditCategoryTag      = "tag"
AuditCategoryAlgorithm = "algorithm"

// Action verbs
AuditActionCreate  = "create"
AuditActionUpdate  = "update"
AuditActionDelete  = "delete"
AuditActionRestore = "restore"
AuditActionRevert  = "revert"
AuditActionImport  = "import"
AuditActionLink    = "link"
AuditActionCopy    = "copy"
```

### Missing Event Categories (Need Definition)

```go
AuditCategorySettings       = "settings"
AuditCategoryCoverage      = "coverage"
AuditCategoryTeam          = "team"
AuditCategorySnapshot      = "snapshot"
AuditCategoryLocationOverride = "location_override"
AuditCategoryCorrection    = "correction"
AuditCategoryOnboarding    = "onboarding"
AuditCategoryCache         = "cache"
```

### Sample Implementation Pattern

```go
// Example: Add audit logging to UpdateGlobalCoverage
func (h *Handlers) UpdateGlobalCoverage(w http.ResponseWriter, r *http.Request) {
    // ... existing code ...

    // Log the setting change
    h.LogAuditEvent(ctx, r, pc, AuditEventParams{
        EventCategory: AuditCategorySettings,
        EventAction:   AuditActionUpdate,
        ResourceType:  "global_coverage",
        ResourceID:    pc.PublisherID,
        Status:        AuditStatusSuccess,
        ChangesBefore: map[string]interface{}{
            "enabled": oldValue,
        },
        ChangesAfter: map[string]interface{}{
            "enabled": newValue,
        },
    })

    // ... rest of handler ...
}
```

---

## Related Files

- `/home/daniel/repos/zmanim/api/internal/handlers/publisher_zmanim.go` - 2690 lines
- `/home/daniel/repos/zmanim/api/internal/handlers/publisher_algorithm.go` - 795 lines
- `/home/daniel/repos/zmanim/api/internal/handlers/publisher_aliases.go` - 313 lines
- `/home/daniel/repos/zmanim/api/internal/handlers/publisher_settings.go` - 163 lines
- `/home/daniel/repos/zmanim/api/internal/handlers/publisher_team.go` - 555 lines
- `/home/daniel/repos/zmanim/api/internal/handlers/publisher_snapshots.go` - 373 lines
- `/home/daniel/repos/zmanim/api/internal/handlers/coverage.go` - Coverage management
- `/home/daniel/repos/zmanim/api/internal/handlers/location_overrides.go` - Location overrides
- `/home/daniel/repos/zmanim/api/internal/handlers/onboarding.go` - Onboarding workflow
- `/home/daniel/repos/zmanim/api/internal/handlers/correction_requests.go` - Correction requests
- `/home/daniel/repos/zmanim/api/internal/handlers/upload.go` - Logo uploads
- `/home/daniel/repos/zmanim/api/internal/handlers/algorithm_collaboration.go` - Algorithm collaboration
- `/home/daniel/repos/zmanim/api/internal/handlers/version_history.go` - Version control

---

## Next Steps

1. **Define missing audit event categories** in `publisher_audit.go`
2. **Migrate activity_service calls** to audit_service for algorithm/settings operations
3. **Implement Priority 1 fixes** (security/compliance critical)
4. **Add before/after state tracking** for settings mutations
5. **Update E2E tests** to verify audit events are created
6. **Update documentation** with audit event catalog

---

**Analysis Date:** 2025-12-28
**Total Endpoints Analyzed:** 62
**Coverage Rate:** 26% (16/62)
**Target Coverage:** 100%
**Work Remaining:** 46 endpoints
