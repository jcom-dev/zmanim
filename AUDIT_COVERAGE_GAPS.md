# Audit Coverage Gaps - Implementation Mission

## Status: Ready for Execution

**Problem:** Current audit trail implementation is missing critical events:
- Publisher: Enable global coverage, set rounding mode, formula updates, tag assignments
- Admin: User management, system settings, impersonation actions, bulk operations

**Goal:** Achieve 100% audit coverage for ALL mutation operations across publisher and admin contexts.

---

## Orchestrator Role

**CRITICAL INSTRUCTIONS:**
1. **NEVER code directly** - delegate ALL work to sub-agents
2. **Launch parallel agents** via multiple Task tool calls in a single message
3. **Use**: `subagent_type='general-purpose'`, `model='sonnet'`
4. **Use**: `run_in_background=true` for long tasks, collect with TaskOutput
5. **Coordinate**: Wait for all agents to complete, validate results, identify gaps

---

## Phase 1: Discovery & Gap Analysis (Parallel)

### Agent 1 - Publisher Endpoints Audit
**Prompt:**
```
Analyze ALL publisher endpoints in api/internal/handlers/publisher_*.go files.

TASKS:
1. List every POST/PUT/PATCH/DELETE endpoint under /api/v1/publisher/*
2. For each endpoint, identify:
   - File name and function name
   - HTTP method and route
   - What data it mutates
   - Whether audit logging is present (search for audit_service.LogEvent calls)
3. Output a markdown table:
   | File | Function | Route | Method | Mutation | Has Audit | Missing Events |
4. Flag ALL endpoints WITHOUT audit logging
5. Identify specific missing events (e.g., "enable_global_coverage", "set_rounding_mode", "update_formula", "assign_tag")

DELIVERABLE: Save to _bmad-output/audit-gaps-publisher.md
```

### Agent 2 - Admin Endpoints Audit
**Prompt:**
```
Analyze ALL admin endpoints in api/internal/handlers/admin_*.go files.

TASKS:
1. List every POST/PUT/PATCH/DELETE endpoint under /api/v1/admin/*
2. For each endpoint, identify:
   - File name and function name
   - HTTP method and route
   - What data it mutates (users, system settings, impersonation, bulk ops)
   - Whether audit logging is present (search for audit_service.LogEvent calls)
3. Output a markdown table:
   | File | Function | Route | Method | Mutation | Has Audit | Missing Events |
4. Flag ALL endpoints WITHOUT audit logging
5. Identify specific missing events (e.g., "create_user", "grant_admin_role", "update_system_settings", "impersonate_publisher")

DELIVERABLE: Save to _bmad-output/audit-gaps-admin.md
```

### Agent 3 - Event Type Coverage Review
**Prompt:**
```
Review existing audit event types and identify gaps.

TASKS:
1. Read api/internal/services/audit_service.go to find all defined event types (constants)
2. Read api/internal/db/queries/audit.sql to see logged event types
3. Compare with the gaps identified in _bmad-output/audit-gaps-publisher.md and _bmad-output/audit-gaps-admin.md
4. Create a comprehensive list of NEW event types needed:
   - Publisher events (e.g., "publisher.coverage.global.enabled", "publisher.settings.rounding_mode.updated")
   - Admin events (e.g., "admin.user.created", "admin.system.settings.updated", "admin.impersonation.started")
5. Follow naming convention: {context}.{resource}.{action}

DELIVERABLE: Save to _bmad-output/audit-new-event-types.md
```

---

## Phase 2: Backend Implementation (Parallel)

### Agent 4 - Add Missing Publisher Audit Calls
**Prompt:**
```
Add comprehensive audit logging to ALL publisher mutation handlers.

CONTEXT:
- Read _bmad-output/audit-gaps-publisher.md for the complete list of gaps
- Read _bmad-output/audit-new-event-types.md for new event type names
- Follow the pattern in AUDIT_SYSTEM_DESIGN.md

TASKS:
For EACH missing endpoint:
1. Add audit_service.LogEvent call AFTER successful mutation
2. Capture before/after state using json.Marshal of the affected resource
3. Use correct event type from audit-new-event-types.md
4. Extract actor from context (publisher_id, user_id)
5. Include resource_type, resource_id, metadata (IP, user agent)

EXAMPLE PATTERN:
```go
// Before mutation
beforeState, _ := json.Marshal(existingResource)

// Perform mutation
result, err := h.db.Queries.UpdateXYZ(ctx, params)
if err != nil {
    return err
}

// After mutation
afterState, _ := json.Marshal(result)

// Log audit event
h.auditService.LogEvent(ctx, audit.Event{
    EventType:    "publisher.xyz.updated",
    ActorType:    "publisher",
    ActorID:      pc.PublisherID,
    ResourceType: "xyz",
    ResourceID:   result.ID,
    BeforeState:  beforeState,
    AfterState:   afterState,
    Metadata: map[string]interface{}{
        "ip_address": r.RemoteAddr,
        "user_agent": r.UserAgent(),
    },
})
```

FILES TO UPDATE:
- List all files from audit-gaps-publisher.md with missing audit calls

DELIVERABLE: Update all handler files, create summary in _bmad-output/audit-publisher-implementation.md
```

### Agent 5 - Add Missing Admin Audit Calls
**Prompt:**
```
Add comprehensive audit logging to ALL admin mutation handlers.

CONTEXT:
- Read _bmad-output/audit-gaps-admin.md for the complete list of gaps
- Read _bmad-output/audit-new-event-types.md for new event type names
- Follow the pattern in AUDIT_SYSTEM_DESIGN.md
- CRITICAL: Admin actions must include impersonation context if present

TASKS:
For EACH missing endpoint:
1. Add audit_service.LogEvent call AFTER successful mutation
2. Capture before/after state using json.Marshal of the affected resource
3. Use correct event type from audit-new-event-types.md
4. Extract actor from context (admin_user_id)
5. Check for impersonation context (X-Impersonating-Publisher-Id header)
6. Include resource_type, resource_id, metadata (IP, user agent, impersonation_context)

EXAMPLE PATTERN WITH IMPERSONATION:
```go
// Extract admin and impersonation context
adminUserID := GetAdminUserID(r)
impersonatingPublisherID := r.Header.Get("X-Impersonating-Publisher-Id")

// Before mutation
beforeState, _ := json.Marshal(existingResource)

// Perform mutation
result, err := h.db.Queries.UpdateXYZ(ctx, params)
if err != nil {
    return err
}

// After mutation
afterState, _ := json.Marshal(result)

// Build metadata
metadata := map[string]interface{}{
    "ip_address": r.RemoteAddr,
    "user_agent": r.UserAgent(),
}
if impersonatingPublisherID != "" {
    metadata["impersonating_publisher_id"] = impersonatingPublisherID
}

// Log audit event
h.auditService.LogEvent(ctx, audit.Event{
    EventType:    "admin.xyz.updated",
    ActorType:    "admin",
    ActorID:      adminUserID,
    ResourceType: "xyz",
    ResourceID:   result.ID,
    BeforeState:  beforeState,
    AfterState:   afterState,
    Metadata:     metadata,
})
```

FILES TO UPDATE:
- List all files from audit-gaps-admin.md with missing audit calls

DELIVERABLE: Update all handler files, create summary in _bmad-output/audit-admin-implementation.md
```

### Agent 6 - Update Event Type Constants
**Prompt:**
```
Add new event type constants to the audit service.

CONTEXT:
- Read _bmad-output/audit-new-event-types.md for complete list

TASKS:
1. Read api/internal/services/audit_service.go
2. Add const definitions for ALL new event types following existing pattern:
```go
const (
    // Existing events...

    // Publisher Coverage Events
    EventPublisherCoverageGlobalEnabled  = "publisher.coverage.global.enabled"
    EventPublisherCoverageGlobalDisabled = "publisher.coverage.global.disabled"

    // Publisher Settings Events
    EventPublisherRoundingModeUpdated = "publisher.settings.rounding_mode.updated"

    // Admin User Events
    EventAdminUserCreated = "admin.user.created"
    EventAdminRoleGranted = "admin.user.role.granted"

    // etc...
)
```
3. Ensure ALL events from audit-new-event-types.md are defined
4. Group by category (publisher.coverage, publisher.settings, admin.user, etc.)

DELIVERABLE: Update api/internal/services/audit_service.go
```

---

## Phase 3: Testing & Validation (Parallel)

### Agent 7 - Publisher Audit Integration Tests
**Prompt:**
```
Create integration tests for ALL new publisher audit logging.

CONTEXT:
- Read _bmad-output/audit-publisher-implementation.md for implemented events
- Follow patterns in existing test files

TASKS:
1. Create api/internal/handlers/publisher_audit_integration_test.go
2. For EACH new audit event:
   - Test mutation triggers audit log
   - Verify event_type, actor_id, resource_id correct
   - Verify before_state and after_state captured
   - Verify metadata includes IP, user agent
3. Test edge cases (failed mutations should NOT log success events)

DELIVERABLE: Create test file with >80% coverage of new audit calls
```

### Agent 8 - Admin Audit Integration Tests
**Prompt:**
```
Create integration tests for ALL new admin audit logging.

CONTEXT:
- Read _bmad-output/audit-admin-implementation.md for implemented events
- Follow patterns in existing test files

TASKS:
1. Create api/internal/handlers/admin_audit_integration_test.go
2. For EACH new audit event:
   - Test mutation triggers audit log
   - Verify event_type, actor_id, resource_id correct
   - Verify before_state and after_state captured
   - Verify metadata includes IP, user agent, impersonation context
3. Test impersonation scenarios (admin acting as publisher)
4. Test edge cases (failed mutations should NOT log success events)

DELIVERABLE: Create test file with >80% coverage of new audit calls
```

### Agent 9 - E2E Audit Coverage Tests
**Prompt:**
```
Create E2E tests validating end-to-end audit trail for critical workflows.

TASKS:
1. Create tests/e2e/audit/publisher-coverage.spec.ts
   - Enable global coverage → verify audit log appears in UI
   - Change rounding mode → verify audit log appears in UI
   - Update formula → verify before/after diff shown correctly
2. Create tests/e2e/audit/admin-actions.spec.ts
   - Admin creates user → verify audit log appears
   - Admin impersonates publisher → verify metadata captured
   - Admin updates system settings → verify audit log appears

DELIVERABLE: Create E2E test files with critical workflow coverage
```

---

## Phase 4: Documentation (Parallel)

### Agent 10 - Update Audit Documentation
**Prompt:**
```
Update audit documentation with complete event catalog.

TASKS:
1. Update docs/features/audit-trail.md:
   - Add "Complete Event Catalog" section
   - Table of ALL event types with descriptions
   - Examples of before/after state for each event
2. Update docs/architecture/audit-system.md:
   - Document event naming convention
   - Explain impersonation context handling
   - Add coverage metrics (% of endpoints with audit logging)

DELIVERABLE: Update documentation files
```

### Agent 11 - Update Handler INDEX Files
**Prompt:**
```
Update INDEX.md files to reflect audit logging additions.

TASKS:
1. Update api/internal/handlers/INDEX.md:
   - Mark ALL handlers as "Has Audit Logging"
   - Add notes about event types logged by each handler
2. Ensure consistency with implementation

DELIVERABLE: Update INDEX.md
```

---

## Phase 5: Validation & Reporting (Sequential)

### Agent 12 - Final Coverage Report
**Prompt:**
```
Generate comprehensive audit coverage report.

TASKS:
1. Re-scan ALL publisher and admin handlers
2. Verify EVERY POST/PUT/PATCH/DELETE endpoint has audit logging
3. Generate final report:
   - Total endpoints: X
   - Endpoints with audit: X (100%)
   - Total event types: X
   - Coverage by category (publisher.coverage: X events, admin.user: X events, etc.)
4. List any remaining gaps (should be ZERO)

DELIVERABLE: Save to _bmad-output/AUDIT_COVERAGE_FINAL_REPORT.md
```

---

## Success Criteria

- ✅ 100% of publisher mutation endpoints have audit logging
- ✅ 100% of admin mutation endpoints have audit logging
- ✅ All event types follow naming convention: {context}.{resource}.{action}
- ✅ Before/after state captured for all mutations
- ✅ Impersonation context captured for admin actions
- ✅ Integration tests cover all new audit calls (>80%)
- ✅ E2E tests validate critical workflows
- ✅ Documentation updated with complete event catalog
- ✅ All CI checks pass

---

## Orchestrator Execution Template

```
I'm launching 12 sub-agents in parallel to achieve 100% audit coverage:

Phase 1 (Parallel): Agents 1-3 - Discovery & Gap Analysis
Phase 2 (Parallel): Agents 4-6 - Backend Implementation
Phase 3 (Parallel): Agents 7-9 - Testing & Validation
Phase 4 (Parallel): Agents 10-11 - Documentation
Phase 5 (Sequential): Agent 12 - Final Validation

[Launch Task tool calls in batches, collect results, validate, proceed to next phase]
```
