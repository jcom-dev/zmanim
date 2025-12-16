# Epic 9: API Restructuring & Endpoint Cleanup

**Epic:** Epic 9 - API Restructuring
**Author:** BMad
**Date:** 2025-12-15
**Status:** In Progress
**Estimated Stories:** 15
**Dependencies:** Epic 8 (Finalize Features)

---

## Executive Summary

Epic 9 consolidates deferred API restructuring work from Epic 8. These stories require dedicated attention and were blocked or rescoped during the Epic 8 verification process.

### What We're Building

**Story 9.1: API Path Restructuring for Gateway Authentication** (from 8.17)
- Move public endpoints under `/api/v1/public/*`
- Move authenticated endpoints under `/api/v1/auth/*`
- Add 301 redirects for legacy routes with deprecation headers
- Update API Gateway to use 2 path patterns only

**Story 9.2: API Route Cleanup Phase 2** (from 8.20)
- Was rescoped into 4 separate stories during Epic 8
- Needs analysis to determine final scope
- May involve removing deprecated endpoints
- May involve consolidating similar endpoints

**Story 9.3: Correction Request Endpoint Consolidation** (from 8.23)
- Create unified `GetCorrectionRequests` handler (role-aware)
- Create unified `UpdateCorrectionRequestStatus` handler
- Delete separate admin/publisher handlers
- Update frontend to use consolidated endpoints

**Story 9.4: API Security Audit & Authorization Hardening** (new)
- Comprehensive security audit of all API endpoints
- Verify public routes are read-only
- Ensure publisher tenant isolation (cannot access other publishers' data)
- Verify admin API protection
- Test and fix IDOR vulnerabilities
- Document security patterns and create test suite

**Story 9.5: Frontend API Audit & Deprecated Code Removal** (new)
- Audit every frontend API call for new path compliance
- Convert all 73+ raw fetch() calls to useApi() pattern
- Remove ALL deprecated comments (TODO, FIXME, Legacy, @deprecated)
- Remove ALL fallback/dual-format code patterns
- Remove ALL "compatibility" re-exports
- Enforce ZERO TOLERANCE clean code policy

**Story 9.6: Database & SQLc Audit - UI Sync Validation** (new)
- Verify SQLc queries match current UI requirements
- Ensure type definitions stay in sync across stack
- Clean up unused queries
- Document type mappings

**Story 9.7: E2E Test Suite Refresh for New API Structure** (new)
- Update tests for /public/* and /auth/* paths
- Add tests for consolidated correction request endpoints
- Add security tests for tenant isolation/IDOR prevention
- Add tests for legacy redirect behavior

**Story 9.8: Local Test Environment Parity** (new)
- Create `./scripts/test-local.sh` mirroring CI pipeline
- Create `./scripts/pre-commit-check.sh` for fast iteration
- Document tool version requirements
- Fix any discrepancies between local and CI environments

**Story 9.9: GitHub Actions CI/CD Validation & Hardening** (new)
- Add SQLc validation job
- Add zero deprecated code enforcement
- Add security scanning (govulncheck, npm audit)
- Add type sync validation
- Optimize caching and parallelization

---

## Goals & Success Criteria

### Primary Goals

1. **Clean API Structure** - Clear separation between public and authenticated routes
2. **Reduced Duplication** - Single handlers serving multiple roles
3. **Gateway Simplicity** - Only 2 path patterns needed for auth config

### Success Criteria

- [ ] All public endpoints accessible at `/api/v1/public/*`
- [ ] All authenticated endpoints accessible at `/api/v1/auth/*`
- [ ] Zero duplicate handlers for same functionality
- [ ] API Gateway config uses only 2 path patterns
- [ ] All legacy routes return 301 with deprecation header

---

## Stories

### Story 9.1: API Path Restructuring for Gateway Authentication

**Original:** Story 8.17
**Reason Deferred:** Major restructuring requiring dedicated sprint

**Scope:**
- Restructure all routes in `main.go` under `/public` and `/auth` prefixes
- Add `redirectTo` helper function for 301 redirects
- Update frontend `normalizeEndpoint` to auto-route to new paths
- Update API Gateway CDK configuration

**Acceptance Criteria:**
1. All public endpoints moved under `/api/v1/public/*`
2. All authenticated endpoints moved under `/api/v1/auth/*`
3. External API endpoints under `/api/v1/auth/external/*`
4. `/api/v1/auth/publisher/*` for publisher-specific routes
5. `/api/v1/auth/admin/*` for admin-specific routes
6. Old routes return 301 redirect with deprecation header (6-month sunset)
7. API Gateway config uses only 2 path patterns
8. Swagger documentation updated
9. Frontend API client updated to use new paths

---

### Story 9.2: API Route Cleanup Phase 2

**Original:** Story 8.20
**Reason Deferred:** Rescoped into 4 separate stories during analysis

**Scope:**
- Review the rescoping analysis from Epic 8
- Determine which sub-stories are still needed
- Implement route cleanup as appropriate
- Remove deprecated endpoints

**Tasks:**
1. Review 8.20 story file for rescoping details
2. Identify specific cleanup work needed
3. Implement changes
4. Update documentation

---

### Story 9.3: Correction Request Endpoint Consolidation

**Original:** Story 8.23
**Reason Deferred:** False completion - handlers never created

**Current State:**
- Separate endpoints exist: `/publisher/correction-requests/*` and `/admin/correction-requests/*`
- These work correctly but violate DRY principle
- Story was marked complete but code was never written

**Scope:**
- Create `GetCorrectionRequests` handler with role-based filtering
- Create `UpdateCorrectionRequestStatus` handler for approve/reject
- Add deprecation redirects for old endpoints
- Update frontend to use new unified endpoints

**Acceptance Criteria:**
1. `GET /api/v1/correction-requests` returns filtered list based on user role
2. `PUT /api/v1/correction-requests/{id}/status` handles approve/reject
3. Admin sees all requests, publishers see only their own
4. Old endpoints return 301 redirect
5. Frontend updated to use new endpoints

---

### Story 9.4: API Security Audit & Authorization Hardening

**Type:** New security-focused story
**Priority:** High (security)

**Motivation:**
- Ensure multi-tenant security across entire API
- Prevent cross-tenant data access
- Verify admin/publisher role separation
- Prevent IDOR and privilege escalation attacks
- Document security patterns for future development

**Scope:**
- Audit all public routes (verify read-only)
- Audit publisher routes (verify tenant isolation)
- Audit admin routes (verify role enforcement)
- Test IDOR vulnerabilities
- Verify SQL injection prevention (SQLc usage)
- Audit error handling (no information disclosure)
- Create security test suite
- Document security patterns

**Key Security Checks:**
1. **Public API Read-Only** - No mutations without auth
2. **Tenant Isolation** - Publishers cannot access other publishers' data
3. **Admin Protection** - Publishers cannot access admin endpoints
4. **IDOR Prevention** - Direct object references validated
5. **SQL Injection** - All queries parameterized via SQLc
6. **Error Handling** - No sensitive data leakage

**Acceptance Criteria:**
1. All public routes verified as GET-only
2. Publisher isolation tested - cannot access another publisher's data
3. Admin API role enforcement verified
4. No IDOR vulnerabilities found
5. Security audit checklist completed and documented
6. Any vulnerabilities found are fixed

---

### Story 9.5: Frontend API Audit & Deprecated Code Removal

**Type:** New code quality story
**Priority:** High (technical debt)

**Motivation:**
- Enforce ZERO TOLERANCE clean code policy from coding-standards.md
- Complete migration to new API path structure
- Eliminate all technical debt markers (TODO, FIXME, etc.)
- Remove all backward compatibility code
- Ensure consistent API patterns across entire frontend

**Scope:**
- Audit every API call in web/ directory
- Convert raw fetch() to useApi() pattern
- Remove deprecated comments in frontend and backend
- Remove fallback/dual-format code patterns
- Remove "for compatibility" re-exports
- Verify 301 redirects work correctly

**Key Cleanup Areas:**
1. **Raw fetch() Calls** - 73+ violations → 0
2. **TODO/FIXME Comments** - All removed
3. **Legacy/Deprecated Comments** - All removed
4. **Dual-Format Code** - All removed
5. **Compatibility Re-exports** - All removed

**Acceptance Criteria:**
1. Every frontend API call uses useApi() pattern
2. Zero raw fetch() calls in components
3. Zero TODO/FIXME/Legacy/DEPRECATED comments
4. Zero fallback/dual-format code patterns
5. Zero "compatibility" re-exports
6. Frontend type-check passes
7. Backend build passes
8. E2E tests pass

---

### Story 9.6: Database & SQLc Audit - UI Sync Validation

**Type:** New technical audit story
**Priority:** Medium
**Source:** Also includes TODOs from snapshot_service.go:355-365

**Motivation:**
- Ensure SQLc queries match current UI requirements
- Verify type definitions stay in sync across Go/TypeScript
- Identify and clean up unused queries
- Prevent type drift between frontend and backend
- Fix broken snapshot restore functions (need Category→TimeCategoryID lookup)

**Scope:**
- Audit all SQLc queries for UI alignment
- Document type mappings (Go → TypeScript)
- Remove unused queries
- Add type sync validation script
- Implement Category/SourceType string → ID resolution for snapshots
- Complete `updateZmanFromSnapshot` implementation
- Complete `insertZmanFromSnapshot` implementation

**Acceptance Criteria:**
1. All SQLc queries verified against UI usage
2. Type mappings documented
3. Unused queries removed
4. SQLc generate produces no changes on clean checkout
5. Type sync validation script passes
6. `updateZmanFromSnapshot` working (not returning "not yet implemented")
7. `insertZmanFromSnapshot` working (not returning "not yet implemented")
8. Snapshot restore flow functional end-to-end

---

### Story 9.7: E2E Test Suite Refresh for New API Structure

**Type:** New testing story
**Priority:** High

**Motivation:**
- E2E tests must reflect new /public/* and /auth/* API paths
- Need coverage for consolidated correction request endpoints
- Security controls need E2E verification (tenant isolation, IDOR)
- Legacy redirect behavior needs test coverage

**Scope:**
- Update all existing tests for new API paths
- Add tests for consolidated correction request endpoints
- Add security tests for tenant isolation
- Add tests for 301 redirect + deprecation headers
- Add role-based filtering tests

**Acceptance Criteria:**
1. All tests use new API path structure
2. Consolidated correction request endpoints tested
3. Tenant isolation tested (Publisher B cannot access Publisher A data)
4. Legacy redirects tested (301 + deprecation headers)
5. Role-based filtering tested (admin vs publisher views)
6. All E2E tests pass

---

### Story 9.8: Local Test Environment Parity

**Type:** New DevOps story
**Priority:** Medium

**Motivation:**
- Developers run inconsistent test commands locally
- CI failures surprise developers after push
- Need single script that mirrors exact CI pipeline
- Pre-commit quick check for fast feedback

**Scope:**
- Create `./scripts/test-local.sh` mirroring full CI
- Create `./scripts/pre-commit-check.sh` for fast iteration
- Document tool version requirements
- Fix any local/CI environment discrepancies
- Add troubleshooting guide

**Acceptance Criteria:**
1. `./scripts/test-local.sh` runs all CI checks in order
2. `./scripts/test-local.sh --skip-e2e` completes in <3 minutes
3. `./scripts/pre-commit-check.sh` completes in <30 seconds
4. Tool versions documented (Go 1.24+, Node 20, etc.)
5. Same checks pass locally and in CI
6. README "Running CI Locally" section added

---

### Story 9.9: GitHub Actions CI/CD Validation & Hardening

**Type:** New CI/CD story
**Priority:** High

**Motivation:**
- CI lacks SQLc validation (can merge with broken queries)
- CI lacks zero tolerance enforcement (can merge TODOs)
- CI lacks security scanning (govulncheck, npm audit)
- CI performance can be improved with better caching

**Scope:**
- Add SQLc compile + generate check job
- Add zero deprecated code enforcement job
- Add security scanning (govulncheck, npm audit, gitleaks)
- Add type sync validation
- Optimize caching strategy
- Improve error messages

**Acceptance Criteria:**
1. SQLc validation runs on every PR
2. Zero deprecated code check runs on every PR
3. Security scanning runs on every PR
4. Type sync validation runs on every PR
5. CI checks complete in <10 minutes
6. Clear error messages for failures
7. CI-local parity with Story 9.8

---

### Story 9.10: Email Service Integration for Invitations

**Type:** Feature implementation
**Priority:** Medium
**Source:** TODO in invitations.go:201, 453

**Motivation:**
- Invitation system needs email notifications
- User-publisher linking workflow incomplete

**Scope:**
- Implement email sending service (SendGrid, SES, or similar)
- Send invitation emails when publishers invite team members
- Send confirmation emails on acceptance
- Link users to publishers via user_publishers table

**Acceptance Criteria:**
1. Email service configured and working
2. Invitation emails sent automatically
3. User-publisher linking implemented
4. Email templates created for invitation flow

---

### Story 9.11: Clerk API Integration for User Verification

**Type:** Feature implementation
**Priority:** Medium
**Source:** TODO in invitations.go:621

**Motivation:**
- Need to verify user existence in Clerk before invitation acceptance
- Current implementation skips Clerk validation

**Scope:**
- Integrate Clerk SDK for user lookup
- Verify user exists before processing invitation acceptance
- Handle edge cases (user deleted, user suspended)

**Acceptance Criteria:**
1. Clerk SDK integrated
2. User verification before invitation acceptance
3. Proper error handling for missing users
4. Tests for Clerk integration

---

### Story 9.12: Hebrew Calendar/Yom Tov Integration

**Type:** Feature implementation
**Priority:** Low
**Source:** TODO in dsl.go:353, 390

**Motivation:**
- DSL formulas need Yom Tov detection for accurate zmanim calculations
- Hebrew calendar conversion needed for date handling

**Scope:**
- Integrate hebcal-go library
- Implement IsYomTov detection in DSL executor
- Add Hebrew date conversion utilities
- Support Yom Tov-specific formula conditions

**Acceptance Criteria:**
1. hebcal-go library integrated
2. IsYomTov detection working in DSL
3. Hebrew date conversion utilities available
4. Tests for Hebrew calendar functions

---

### Story 9.13: External API Caching Implementation

**Type:** Performance optimization
**Priority:** Medium
**Source:** TODO in external_api.go:370, 384

**Motivation:**
- External API calls should be cached to reduce load
- Current implementation always sets Cached: false

**Scope:**
- Implement Redis-based caching for external API results
- Configure TTL for different query types
- Add cache hit/miss metrics
- Add cache invalidation endpoints

**Acceptance Criteria:**
1. External API results cached in Redis
2. Configurable TTL per endpoint
3. Cache hit/miss tracking
4. Cache invalidation working
5. Performance improvement measurable

---

### Story 9.14: Status Lookup Table Integration

**Type:** Bug fix / Data integrity
**Priority:** Low
**Source:** TODO in admin.go:809, 944

**Motivation:**
- Admin handlers hardcode "active" status instead of using lookup table
- Should derive status from actual database state

**Scope:**
- Update admin handlers to fetch actual status from lookup
- Ensure status reflects real publisher state
- Remove hardcoded "active" values

**Acceptance Criteria:**
1. Status derived from database lookup
2. No hardcoded status values
3. Admin views show accurate status

---

### Story 9.15: Publisher Coverage DB-Level Filtering

**Type:** Performance optimization
**Priority:** Low
**Source:** TODO in locations.go:374

**Motivation:**
- Publisher coverage filtering currently done in application code
- Should be pushed to database level for better performance

**Scope:**
- Create SQLc query with publisher coverage join
- Move filtering logic from Go to SQL
- Benchmark performance improvement

**Acceptance Criteria:**
1. Coverage filtering in SQL query
2. Performance benchmark shows improvement
3. No change to API response format
4. Tests verify correct filtering

---

## Technical Notes

### API Gateway Configuration

After Story 9.1, gateway config should be:
```
/api/v1/public/* → No auth required
/api/v1/auth/*   → JWT validation required
```

### Deprecation Strategy

All legacy routes should:
1. Return 301 redirect to new path
2. Include `Deprecation` header with sunset date
3. Log usage for monitoring
4. Be removed after 6-month sunset period

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Backend builds: `go build ./...`
- [ ] Frontend builds: `npm run type-check`
- [ ] E2E tests pass
- [ ] Security tests pass (Story 9.4)
- [ ] No coding standards violations
- [ ] Zero raw fetch() calls (Story 9.5)
- [ ] Zero deprecated comments (Story 9.5)
- [ ] Documentation updated
- [ ] No security vulnerabilities (Story 9.4)

---

## Story Summary

| Story | Title | Points | Focus |
|-------|-------|--------|-------|
| 9.1 | API Gateway Path Configuration | 3 | Infrastructure |
| 9.2 | API Route Documentation & Cleanup | 5 | Documentation |
| 9.3 | Correction Request Endpoint Consolidation | 5 | Backend refactor |
| 9.4 | API Security Audit & Authorization Hardening | 8 | Security |
| 9.5 | Frontend API Audit & Deprecated Code Removal | 8 | Code quality |
| 9.6 | Database & SQLc Audit - UI Sync Validation | 5 | Database/Types |
| 9.7 | E2E Test Suite Refresh for New API Structure | 5 | Testing |
| 9.8 | Local Test Environment Parity | 3 | DevOps |
| 9.9 | GitHub Actions CI/CD Validation & Hardening | 5 | CI/CD |
| 9.10 | Email Service Integration for Invitations | 3 | Feature |
| 9.11 | Clerk API Integration for User Verification | 3 | Feature |
| 9.12 | Hebrew Calendar/Yom Tov Integration | 5 | Feature |
| 9.13 | External API Caching Implementation | 5 | Performance |
| 9.14 | Status Lookup Table Integration | 2 | Bug Fix |
| 9.15 | Publisher Coverage DB-Level Filtering | 3 | Performance |
| **Total** | | **68** | |
