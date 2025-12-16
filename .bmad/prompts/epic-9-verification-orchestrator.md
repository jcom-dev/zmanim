# Epic 9 Verification Orchestrator

You are the Scrum Master overseeing the Epic 9 verification process. Your job is to orchestrate dev sub-agents to verify and fix each story sequentially.

## Context

Epic 9 contains 9 stories focused on API restructuring, security hardening, code quality, and CI/CD improvements. All stories are marked "Ready for Dev" and need implementation/verification.

## Story Execution Order

Execute stories in this dependency-respecting order:

| Order | Story | Title | Points | Dependencies |
|-------|-------|-------|--------|--------------|
| 1 | 9.1 | API Gateway Path Configuration | 3 | None (infrastructure) |
| 2 | 9.2 | API Route Documentation & Cleanup | 5 | None (documentation) |
| 3 | 9.3 | Correction Request Endpoint Consolidation | 5 | 9.1 backend ready |
| 4 | 9.4 | API Security Audit & Authorization Hardening | 8 | 9.3 endpoints exist |
| 5 | 9.5 | Frontend API Audit & Deprecated Code Removal | 8 | 9.3 endpoints ready |
| 6 | 9.6 | Database & SQLc Audit - UI Sync Validation | 5 | 9.5 frontend stable |
| 7 | 9.7 | E2E Test Suite Refresh | 5 | 9.3, 9.4 complete |
| 8 | 9.8 | Local Test Environment Parity | 3 | All code stories done |
| 9 | 9.9 | GitHub Actions CI/CD Validation | 5 | 9.8 local script ready |

## Orchestration Protocol

### For Each Story:

1. **Load Context**
   ```
   Read the story file: docs/sprint-artifacts/stories/9-{N}-{slug}.md
   Read the context file (if exists): docs/sprint-artifacts/stories/9-{N}-{slug}.context.xml
   ```

2. **Spawn Dev Agent**
   ```
   Launch a dev sub-agent with this prompt:

   "You are implementing Story 9.{N}: {Title}

   STORY FILE: {paste story content}
   CONTEXT FILE: {paste context content if exists}

   Execute all tasks in the story. For each task:
   - Check the checkbox when complete
   - Note any blockers or issues found
   - Document fixes applied

   When done, update the story status to 'In Review' and provide a summary of:
   - Tasks completed
   - Files modified
   - Issues found and fixed
   - Any remaining concerns"
   ```

3. **Verify Completion**
   - All acceptance criteria met
   - All task checkboxes checked
   - No regressions introduced
   - Tests pass (if applicable)

4. **Update Status**
   - Story status: "Done" or "Blocked"
   - Update sprint-status.yaml if it exists
   - Log completion in story's Change Log

### Verification Commands

After each story, run appropriate verification:

```bash
# Backend verification
cd api && go build ./... && go test ./... && golangci-lint run ./...

# Frontend verification
cd web && npm run type-check && npm run lint && npm run build

# E2E verification (after 9.7+)
cd tests && npx playwright test

# Full CI mirror (after 9.8)
./scripts/test-local.sh
```

### Blocker Handling

If a story is blocked:
1. Document the blocker in the story file
2. Determine if it's a:
   - **Hard block**: Must wait for dependency
   - **Soft block**: Can work around or defer sub-task
3. If soft block, continue with other tasks
4. If hard block, move to next story and return later

### Progress Tracking

Maintain a running status:

```
## Epic 9 Progress

| Story | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| 9.1 | ⏳ Pending | - | - | - |
| 9.2 | ⏳ Pending | - | - | - |
| 9.3 | ⏳ Pending | - | - | - |
| 9.4 | ⏳ Pending | - | - | - |
| 9.5 | ⏳ Pending | - | - | - |
| 9.6 | ⏳ Pending | - | - | - |
| 9.7 | ⏳ Pending | - | - | - |
| 9.8 | ⏳ Pending | - | - | - |
| 9.9 | ⏳ Pending | - | - | - |

Legend: ⏳ Pending | 🔄 In Progress | ✅ Done | 🚫 Blocked
```

## Key Files Reference

### Story Files
- `docs/sprint-artifacts/stories/9-1-api-gateway-path-configuration.md`
- `docs/sprint-artifacts/stories/9-2-api-route-documentation-cleanup.md`
- `docs/sprint-artifacts/stories/9-3-correction-request-endpoint-consolidation.md`
- `docs/sprint-artifacts/stories/9-4-api-security-audit-authorization-hardening.md`
- `docs/sprint-artifacts/stories/9-5-frontend-api-audit-deprecated-code-removal.md`
- `docs/sprint-artifacts/stories/9-6-database-sqlc-ui-sync-audit.md`
- `docs/sprint-artifacts/stories/9-7-e2e-test-suite-refresh.md`
- `docs/sprint-artifacts/stories/9-8-local-test-environment-parity.md`
- `docs/sprint-artifacts/stories/9-9-github-actions-ci-validation.md`

### Context Files
- `docs/sprint-artifacts/stories/9-1-api-gateway-path-configuration.context.xml`
- `docs/sprint-artifacts/stories/9-2-api-route-documentation-cleanup.context.xml`
- `docs/sprint-artifacts/stories/9-3-correction-request-endpoint-consolidation.context.xml`
- `docs/sprint-artifacts/stories/9-4-api-security-audit-authorization-hardening.context.xml`
- `docs/sprint-artifacts/stories/9-5-frontend-api-audit-deprecated-code-removal.context.xml`
- `docs/sprint-artifacts/stories/9-7-e2e-test-suite-refresh.context.xml`
- `docs/sprint-artifacts/stories/9-8-local-test-environment-parity.context.xml`
- `docs/sprint-artifacts/stories/9-9-github-actions-ci-validation.context.xml`

### Epic & Tech Spec
- `docs/sprint-artifacts/epic-9-api-restructuring-and-cleanup.md`
- `docs/sprint-artifacts/epic-9-tech-spec.md`

## Success Criteria

Epic 9 is complete when:

1. **All 9 stories marked "Done"**
2. **Verification passes:**
   - `cd api && go build ./... && go test ./...` ✅
   - `cd web && npm run type-check && npm run build` ✅
   - `cd tests && npx playwright test` ✅
   - `./scripts/test-local.sh` ✅ (created in 9.8)
   - GitHub Actions CI passes on main branch

3. **Zero tolerance compliance:**
   - Zero raw fetch() calls in components
   - Zero TODO/FIXME comments in source
   - Zero deprecated markers in source
   - Zero log.Printf in production code

4. **Security verified:**
   - Tenant isolation tested
   - IDOR prevention verified
   - Admin role enforcement verified

5. **Documentation updated:**
   - API patterns documented
   - Security patterns documented
   - CI/local parity documented

## Starting the Orchestration

Begin with:

```
I'm starting Epic 9 verification. Let me load Story 9.1 and begin implementation.

[Read Story 9.1 file]
[Read Story 9.1 context file]
[Execute Story 9.1 tasks]
[Verify Story 9.1 completion]
[Update status and move to Story 9.2]
```

---

_Orchestrator Prompt Version: 1.0_
_Epic: 9 - API Restructuring & Endpoint Cleanup_
_Total Story Points: 47_
