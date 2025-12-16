# Epic 9: API Restructuring & Endpoint Cleanup - Technical Specification

**Epic:** Epic 9 - API Restructuring
**Version:** 1.0
**Date:** 2025-12-15
**Total Story Points:** 47
**Status:** Ready for Implementation

---

## 1. Executive Summary

### Overview

Epic 9 consolidates deferred API restructuring work from Epic 8, focusing on infrastructure simplification, code quality, security hardening, and technical debt elimination. These stories require dedicated attention and were blocked or rescoped during the Epic 8 verification process.

### Key Deliverables

1. **Infrastructure Simplification** (Story 9.1)
   - AWS API Gateway: 50+ routes → 2 authentication patterns
   - CDK configuration complexity reduction by 95%
   - Zero infrastructure changes for new routes

2. **API Documentation & Cleanup** (Story 9.2)
   - Version history pattern documentation (algorithm vs zman)
   - Soft-delete pattern documentation
   - Epic 8 deprecated code removal

3. **Endpoint Consolidation** (Story 9.3)
   - Unified correction request handlers
   - Role-based filtering in single endpoints
   - RESTful status updates

4. **Security Hardening** (Story 9.4)
   - Comprehensive API security audit
   - Tenant isolation verification
   - IDOR vulnerability testing and fixes
   - Security test suite creation

5. **Code Quality Enforcement** (Story 9.5)
   - ZERO TOLERANCE clean code policy enforcement
   - 73+ raw fetch() calls → useApi() pattern
   - ~100 log.Printf → slog conversions
   - All TODO/FIXME/deprecated markers removed

### Story Points Breakdown

| Story | Title | Points | Risk |
|-------|-------|--------|------|
| 9.1 | API Gateway Path Configuration | 3 | Low |
| 9.2 | API Route Documentation & Cleanup | 5 | Low |
| 9.3 | Correction Request Endpoint Consolidation | 5 | Medium |
| 9.4 | API Security Audit & Authorization Hardening | 8 | High |
| 9.5 | Frontend API Audit & Deprecated Code Removal | 8 | Medium |
| 9.6 | Database & SQLc Audit - UI Sync Validation | 5 | Low |
| 9.7 | E2E Test Suite Refresh for New API Structure | 5 | Medium |
| 9.8 | Local Test Environment Parity | 3 | Low |
| 9.9 | GitHub Actions CI/CD Validation & Hardening | 5 | Medium |
| **Total** | | **47** | |

### Dependencies and Risks

**Dependencies:**
- Epic 8 completion (all stories verified)
- AWS CDK infrastructure access (Story 9.1)
- Clerk authentication working (Story 9.4)
- All services running via `./restart.sh`

**Risks:**
| Risk | Impact | Mitigation |
|------|--------|------------|
| Infrastructure deployment failure (9.1) | HIGH | Rollback plan, phased deployment |
| Security vulnerabilities discovered (9.4) | CRITICAL | Immediate fix priority, security test suite |
| Breaking changes in API consolidation (9.3) | MEDIUM | 301 redirects with 6-month sunset |
| Large-scale refactoring scope creep (9.5) | MEDIUM | Strict scope adherence, automated checks |

---

## 2. Architecture Overview

### Current State (Before Epic 9)

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS API Gateway (Complex)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  50+ Individual Route Definitions                     │   │
│  │  - Health: GET /api/v1/health                         │   │
│  │  - Public: GET /api/v1/zmanim (20+ prefixes)         │   │
│  │  - Publisher: ANY /api/v1/publisher/{proxy+}         │   │
│  │  - Admin: ANY /api/v1/admin/{proxy+}                 │   │
│  │  - Catch-all: ANY /api/v1/{proxy+}                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Go API (Fly.io)                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Backend Routes (Restructured in 8.17)               │   │
│  │  /api/v1/public/*  - Public routes                   │   │
│  │  /api/v1/auth/*    - Authenticated routes            │   │
│  │    ├─ /publisher/*                                    │   │
│  │    ├─ /admin/*                                        │   │
│  │    └─ /external/*                                     │   │
│  │                                                        │   │
│  │  Legacy Routes: 301 Redirects                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Correction Request Endpoints (Duplicated)           │   │
│  │  - GET /publisher/correction-requests                │   │
│  │  - GET /admin/correction-requests                    │   │
│  │  - POST /admin/correction-requests/{id}/approve      │   │
│  │  - POST /admin/correction-requests/{id}/reject       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (Vercel)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Technical Debt                                       │   │
│  │  - 73+ raw fetch() calls (should use useApi)         │   │
│  │  - 102 TODO comments                                  │   │
│  │  - 3 FIXME comments                                   │   │
│  │  - 6388 deprecated markers (mostly auto-generated)   │   │
│  │  - Fallback logic for old API formats                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Target State (After Epic 9)

```
┌─────────────────────────────────────────────────────────────┐
│                AWS API Gateway (Simplified)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  2 Authentication Patterns (95% reduction)           │   │
│  │  1. GET /api/v1/health (no auth)                     │   │
│  │  2. ANY /api/v1/public/{proxy+} (no auth)            │   │
│  │  3. ANY /api/v1/auth/{proxy+} (JWT validation)       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Go API (Fly.io)                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Backend Routes (Consolidated)                       │   │
│  │  /api/v1/public/*  - Public routes                   │   │
│  │  /api/v1/auth/*    - Authenticated routes            │   │
│  │                                                        │   │
│  │  Unified Correction Requests (Role-aware)            │   │
│  │  - GET /correction-requests (admin + publisher)      │   │
│  │  - PUT /correction-requests/{id}/status (admin)      │   │
│  │                                                        │   │
│  │  Security Hardened                                    │   │
│  │  - Tenant isolation verified                          │   │
│  │  - IDOR prevention tested                             │   │
│  │  - Admin role enforcement audited                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Documentation                                        │   │
│  │  - Version history patterns documented                │   │
│  │  - Soft-delete pattern documented                     │   │
│  │  - Security patterns documented                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (Vercel)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Clean Codebase (ZERO TOLERANCE)                     │   │
│  │  - 0 raw fetch() calls (all use useApi)              │   │
│  │  - 0 TODO comments                                    │   │
│  │  - 0 FIXME comments                                   │   │
│  │  - 0 deprecated markers in source code               │   │
│  │  - No fallback logic                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Interactions

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Components                       │
│                                                              │
│  useApi() Hook                                               │
│    ├─ api.get()        → Authorization + X-Publisher-Id     │
│    ├─ api.public.get() → No auth                            │
│    └─ api.admin.get()  → Authorization only                 │
│                                                              │
│  normalizeEndpoint()                                         │
│    ├─ /publishers      → /api/v1/public/publishers          │
│    ├─ /publisher/*     → /api/v1/auth/publisher/*           │
│    └─ /admin/*         → /api/v1/auth/admin/*               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
│                                                              │
│  Route Matching                                              │
│    ├─ /api/v1/public/* → No JWT validation                  │
│    └─ /api/v1/auth/*   → Clerk JWT authorizer              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend Handlers                        │
│                                                              │
│  Security Layers                                             │
│    1. Middleware       → JWT validation, role enforcement    │
│    2. PublisherResolver → X-Publisher-Id validation          │
│    3. Handlers         → Publisher context extraction        │
│    4. Database         → SQLc queries with publisher_id      │
│                                                              │
│  Unified Endpoints                                           │
│    GetCorrectionRequests                                     │
│      ├─ if role == "admin"     → GetAllCorrectionRequests   │
│      └─ if role == "publisher" → GetPublisherCorrections    │
│                                                              │
│    UpdateCorrectionRequestStatus                             │
│      ├─ Check admin role (403 if not)                       │
│      ├─ if status == "approved" → ApplyCityCorrection       │
│      └─ UpdateRequestStatus + SendEmail                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Story-by-Story Technical Details

### Story 9.1: API Gateway Path Configuration (3 pts)

#### Current CDK Configuration

**File:** `/home/coder/workspace/zmanim/infrastructure/lib/stacks/zmanim-prod.ts`

**Lines 664-883:** Complex route definitions

```typescript
// Health endpoint
new Apigatewayv2Route(this, "route-health", {
  apiId: httpApi.id,
  routeKey: "GET /api/v1/health",
  target: `integrations/${healthIntegration.id}`,
});

// Public GET routes (20+ individual prefixes)
const publicPrefixes = [
  "zmanim", "publishers", "cities", "countries",
  "regions", "continents", "registry", ...
];

publicPrefixes.forEach((prefix) => {
  const integration = new Apigatewayv2Integration(...);
  new Apigatewayv2Route(this, `route-public-${prefix}`, {
    apiId: httpApi.id,
    routeKey: `GET /api/v1/${prefix}/{proxy+}`,
    target: `integrations/${integration.id}`,
  });
});

// Base endpoints (list routes)
const baseEndpoints = ["publishers", "countries", ...];
baseEndpoints.forEach((endpoint) => {
  new Apigatewayv2Route(this, `route-public-${endpoint}-base`, {
    apiId: httpApi.id,
    routeKey: `GET /api/v1/${endpoint}`,
    ...
  });
});

// Protected routes
new Apigatewayv2Route(this, "route-protected-publisher", {
  apiId: httpApi.id,
  routeKey: "ANY /api/v1/publisher/{proxy+}",
  authorizationType: "JWT",
  authorizerId: clerkAuthorizer.id,
});

new Apigatewayv2Route(this, "route-protected-admin", {
  apiId: httpApi.id,
  routeKey: "ANY /api/v1/admin/{proxy+}",
  authorizationType: "JWT",
  authorizerId: clerkAuthorizer.id,
});

// Catch-all
new Apigatewayv2Route(this, "route-api-catchall", {
  apiId: httpApi.id,
  routeKey: "ANY /api/v1/{proxy+}",
  authorizationType: "JWT",
  authorizerId: clerkAuthorizer.id,
});
```

**Total:** 50+ route resources, 50+ integration resources

#### Target CDK Configuration (Simplified)

```typescript
// Health endpoint (unchanged)
new Apigatewayv2Route(this, "route-health", {
  apiId: httpApi.id,
  routeKey: "GET /api/v1/health",
  target: `integrations/${healthIntegration.id}`,
});

// Public routes integration
const publicIntegration = new Apigatewayv2Integration(this, "ec2-public-integration", {
  apiId: httpApi.id,
  integrationType: "HTTP_PROXY",
  integrationUri: `http://${elasticIp.publicIp}:8080/api/v1/public/{proxy}`,
  integrationMethod: "ANY",
  timeoutMilliseconds: 29000,
  requestParameters: {
    "overwrite:header.X-Origin-Verify": ssmOriginVerifyKey.value,
  },
});

new Apigatewayv2Route(this, "route-public", {
  apiId: httpApi.id,
  routeKey: "ANY /api/v1/public/{proxy+}",
  target: `integrations/${publicIntegration.id}`,
  // No authorizationType - public access
});

// Authenticated routes integration
const authIntegration = new Apigatewayv2Integration(this, "ec2-auth-integration", {
  apiId: httpApi.id,
  integrationType: "HTTP_PROXY",
  integrationUri: `http://${elasticIp.publicIp}:8080/api/v1/auth/{proxy}`,
  integrationMethod: "ANY",
  timeoutMilliseconds: 29000,
  requestParameters: {
    "overwrite:header.X-Origin-Verify": ssmOriginVerifyKey.value,
  },
});

new Apigatewayv2Route(this, "route-auth", {
  apiId: httpApi.id,
  routeKey: "ANY /api/v1/auth/{proxy+}",
  target: `integrations/${authIntegration.id}`,
  authorizationType: "JWT",
  authorizerId: clerkAuthorizer.id,
});
```

**Total:** 3 route resources, 3 integration resources (95% reduction)

#### Infrastructure Changes Required

1. **Remove** lines 754-883 (old route definitions)
2. **Add** simplified 2-path configuration after line 752
3. **Verify** X-Origin-Verify header injection on both integrations
4. **Test** health endpoint remains accessible

#### Deployment Steps

```bash
# 1. Preview changes
cd /home/coder/workspace/zmanim/infrastructure
npx cdktf diff zmanim-prod

# 2. Deploy
npx cdktf deploy zmanim-prod

# 3. Verify
curl https://zmanim.shtetl.io/api/v1/public/publishers  # Should work
curl https://zmanim.shtetl.io/api/v1/auth/publisher/profile  # Should 401
```

#### Rollback Plan

```bash
# Revert CDK code
git checkout HEAD~1 lib/stacks/zmanim-prod.ts

# Redeploy previous configuration
npx cdktf deploy zmanim-prod
```

**Risk:** Low (no code changes, only infrastructure routing)

---

### Story 9.2: API Route Documentation & Cleanup (5 pts)

#### Version History Patterns

**Document:** `/home/coder/workspace/zmanim/api/internal/docs/patterns/version-history.md`

##### Algorithm Version History (Global)

**Pattern:** All algorithm changes create a new version

```go
// Endpoint: POST /publisher/algorithm/snapshot
func (h *Handlers) CreateVersionSnapshot(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    pc := h.publisherResolver.MustResolve(w, r)

    nextVersion, err := h.db.Queries.GetNextVersionNumber(ctx, algorithmID)

    result, err := h.db.Queries.CreateVersionSnapshot(ctx, sqlcgen.CreateVersionSnapshotParams{
        AlgorithmID:    algorithmID,
        VersionNumber:  nextVersion,
        Status:         "draft",
        ConfigSnapshot: configJSON,
        Description:    &description,
        CreatedBy:      &userID,
    })

    RespondJSON(w, r, http.StatusCreated, result)
}
```

**API Routes:**
- `GET /publisher/algorithm/history` → List all versions
- `GET /publisher/algorithm/history/{version}` → Get version detail
- `GET /publisher/algorithm/diff?v1=X&v2=Y` → Compare versions
- `POST /publisher/algorithm/rollback` → Rollback (creates new version)
- `POST /publisher/algorithm/snapshot` → Create snapshot

**Database Schema:**
```sql
CREATE TABLE algorithm_versions (
    id SERIAL PRIMARY KEY,
    algorithm_id integer REFERENCES algorithms(id),
    version_number integer NOT NULL,
    status varchar(20) NOT NULL,  -- draft, published
    config_snapshot jsonb NOT NULL,
    description text,
    created_by text,
    created_at timestamptz DEFAULT now(),
    published_at timestamptz
);
```

##### Zman Version History (Per-Resource)

**Pattern:** Each zman has independent version history

```go
// Endpoint: POST /publisher/zmanim/{zmanKey}/rollback
func (h *Handlers) RollbackZmanVersion(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    pc := h.publisherResolver.MustResolve(w, r)
    zmanKey := chi.URLParam(r, "zmanKey")

    // Get target formula
    targetFormula, err := h.db.Queries.GetVersionFormula(ctx, db.GetVersionFormulaParams{
        PublisherID:   publisherID,
        ZmanKey:       zmanKey,
        VersionNumber: int32(req.VersionNumber),
    })

    // Update current zman (triggers new version)
    row, err := h.db.Queries.RollbackPublisherZmanFormula(ctx, db.RollbackPublisherZmanFormulaParams{
        FormulaDsl:  targetFormula,
        PublisherID: publisherID,
        ZmanKey:     zmanKey,
    })

    RespondJSON(w, r, http.StatusOK, row)
}
```

**API Routes:**
- `GET /publisher/zmanim/{zmanKey}/history` → List zman versions
- `GET /publisher/zmanim/{zmanKey}/history/{version}` → Get version detail
- `POST /publisher/zmanim/{zmanKey}/rollback` → Rollback zman

**Database Schema:**
```sql
CREATE TABLE publisher_zmanim_versions (
    id SERIAL PRIMARY KEY,
    publisher_zman_id integer REFERENCES publisher_zmanim(id),
    version_number integer NOT NULL,
    formula_dsl text NOT NULL,
    created_by text,
    created_at timestamptz DEFAULT now(),
    comment text
);
```

#### Soft-Delete Pattern

**Document:** `/home/coder/workspace/zmanim/api/internal/docs/patterns/soft-delete.md`

**Required Columns:**
```sql
CREATE TABLE example_table (
    id SERIAL PRIMARY KEY,
    -- ... other columns ...
    deleted_at timestamptz DEFAULT NULL,
    deleted_by text DEFAULT NULL,  -- Clerk user ID
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- CRITICAL: Index for performance
CREATE INDEX idx_example_table_active ON example_table(id) WHERE deleted_at IS NULL;
```

**Query Patterns:**
```sql
-- REQUIRED - All SELECT queries MUST filter out soft-deleted
SELECT * FROM example_table WHERE deleted_at IS NULL;

-- Soft delete
UPDATE example_table
SET deleted_at = now(), deleted_by = $1
WHERE id = $2 AND deleted_at IS NULL;

-- Restore
UPDATE example_table
SET deleted_at = NULL, deleted_by = NULL, updated_at = now()
WHERE id = $1 AND deleted_at IS NOT NULL;

-- Permanent delete (admin only)
DELETE FROM example_table
WHERE id = $1 AND deleted_at IS NOT NULL;
```

**Handler Pattern:**
```go
func (h *Handlers) SoftDeleteEntity(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil { return }

    id := chi.URLParam(r, "id")

    err = h.db.Queries.SoftDeleteEntity(ctx, sqlcgen.SoftDeleteEntityParams{
        DeletedBy: sql.NullString{String: pc.UserID, Valid: true},
        ID:        int32(id),
    })

    // Cache invalidation
    if h.cache != nil {
        h.cache.InvalidatePublisherCache(ctx, pc.PublisherID)
    }

    RespondJSON(w, r, http.StatusOK, map[string]string{"status": "deleted"})
}
```

**Resources Using Pattern:**
- `publisher_zmanim`
- `publisher_snapshots`
- `publishers`
- `correction_requests` (status-based, not soft-delete)

#### Epic 8 Cleanup Targets

**Search patterns:**
```bash
# TODO markers
grep -r "TODO.*Epic 8" api/
grep -r "TODO.*Remove after" api/

# Commented-out code
grep -r "^[[:space:]]*//.*Deprecated" api/internal/handlers/
grep -r "^[[:space:]]*//.*LEGACY" api/internal/handlers/

# Debug logging
grep -r "slog.Debug.*Epic 8" api/
```

**Files to clean:**
- `api/internal/handlers/master_registry.go`
- `api/internal/handlers/publisher_zmanim.go`
- `api/internal/handlers/version_history.go`
- `api/cmd/api/main.go` (old route comments)

#### Files to Create

1. `/api/internal/docs/patterns/README.md` - Pattern index
2. `/api/internal/docs/patterns/version-history.md` - Version history documentation
3. `/api/internal/docs/patterns/soft-delete.md` - Soft-delete pattern documentation

#### Verification Commands

```bash
# Tests pass
cd api && go test ./...

# Build succeeds
cd api && go build ./cmd/api

# Type check passes
cd web && npm run type-check

# No broken documentation links
grep -r "\[.*\](.*)" api/internal/docs/patterns/ | grep -v "^Binary"
```

---

### Story 9.3: Correction Request Endpoint Consolidation (5 pts)

#### Current Endpoint Structure

**Publisher Endpoints:**
- `GET /publisher/correction-requests` → `GetPublisherCorrectionRequests`
- `POST /publisher/correction-requests` → `CreateCorrectionRequest`
- `GET /publisher/correction-requests/{id}` → `GetCorrectionRequestByID`

**Admin Endpoints:**
- `GET /admin/correction-requests` → `AdminGetAllCorrectionRequests`
- `POST /admin/correction-requests/{id}/approve` → `AdminApproveCorrectionRequest`
- `POST /admin/correction-requests/{id}/reject` → `AdminRejectCorrectionRequest`

#### Target Unified Endpoints

**Consolidated Endpoints:**
- `GET /correction-requests` → `GetCorrectionRequests` (role-aware)
- `POST /correction-requests` → `CreateCorrectionRequest` (unchanged)
- `PUT /correction-requests/{id}/status` → `UpdateCorrectionRequestStatus` (admin only)

#### Handler Implementation

##### GetCorrectionRequests (Unified GET)

```go
func (h *Handlers) GetCorrectionRequests(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    role := middleware.GetUserRole(ctx)

    if role == "admin" {
        // Admin: get all with optional filters
        statusFilter := r.URL.Query().Get("status")
        var statusPtr *string
        if statusFilter != "" {
            statusPtr = &statusFilter
        }

        requests, err := h.db.Queries.GetAllCorrectionRequests(ctx, statusPtr)
        if err != nil {
            RespondInternalError(w, r, "Failed to retrieve correction requests")
            return
        }

        RespondJSON(w, r, http.StatusOK, map[string]interface{}{
            "requests": requests,
            "total":    len(requests),
        })
    } else if role == "publisher" {
        // Publisher: get only their own
        pc, err := h.publisherResolver.Resolve(ctx, r)
        if err != nil {
            RespondNotFound(w, r, "Publisher not found")
            return
        }

        publisherID, err := strconv.ParseInt(pc.PublisherID, 10, 32)
        if err != nil {
            RespondInternalError(w, r, "Invalid publisher ID")
            return
        }
        publisherIDInt32 := int32(publisherID)

        requests, err := h.db.Queries.GetPublisherCorrectionRequests(ctx, &publisherIDInt32)
        if err != nil {
            RespondInternalError(w, r, "Failed to retrieve correction requests")
            return
        }

        RespondJSON(w, r, http.StatusOK, map[string]interface{}{
            "requests": requests,
            "total":    len(requests),
        })
    } else {
        RespondUnauthorized(w, r, "Authentication required")
    }
}
```

##### UpdateCorrectionRequestStatus (Unified PUT)

```go
func (h *Handlers) UpdateCorrectionRequestStatus(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Require admin role
    if middleware.GetUserRole(ctx) != "admin" {
        RespondForbidden(w, r, "Admin role required")
        return
    }

    // 2. Parse ID from URL
    idStr := chi.URLParam(r, "id")
    id, err := strconv.ParseInt(idStr, 10, 32)
    if err != nil {
        RespondBadRequest(w, r, "Invalid request ID")
        return
    }

    // 3. Parse body
    var req struct {
        Status      string `json:"status"`
        ReviewNotes string `json:"review_notes"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondBadRequest(w, r, "Invalid request body")
        return
    }

    // 4. Validate status
    if req.Status != "approved" && req.Status != "rejected" {
        RespondValidationError(w, r, "Invalid status", map[string]string{
            "status": "Status must be 'approved' or 'rejected'",
        })
        return
    }

    // Validate rejection requires notes
    if req.Status == "rejected" && req.ReviewNotes == "" {
        RespondValidationError(w, r, "Review notes required for rejection", map[string]string{
            "review_notes": "Please provide a reason for rejection",
        })
        return
    }

    // 5. Get correction request
    correctionReq, err := h.db.Queries.GetCorrectionRequestByID(ctx, int32(id))
    if err != nil {
        RespondNotFound(w, r, "Correction request not found")
        return
    }

    if correctionReq.Status != "pending" {
        RespondValidationError(w, r, "Request already processed", map[string]string{
            "status": "This request has already been " + correctionReq.Status,
        })
        return
    }

    // 6. Apply correction if approved
    if req.Status == "approved" {
        err = h.db.Queries.ApplyCityCorrection(ctx, sqlcgen.ApplyCityCorrectionParams{
            ID:                correctionReq.CityID,
            ProposedLatitude:  correctionReq.ProposedLatitude,
            ProposedLongitude: correctionReq.ProposedLongitude,
            ProposedElevation: correctionReq.ProposedElevation,
        })
        if err != nil {
            RespondInternalError(w, r, "Failed to apply correction")
            return
        }
    }

    // 7. Update status
    adminUserID := middleware.GetUserID(ctx)
    err = h.db.Queries.UpdateCorrectionRequestStatus(ctx, sqlcgen.UpdateCorrectionRequestStatusParams{
        ID:          int32(id),
        Status:      req.Status,
        ReviewedBy:  &adminUserID,
        ReviewNotes: &req.ReviewNotes,
    })
    if err != nil {
        RespondInternalError(w, r, "Failed to update request status")
        return
    }

    // 8. Send email notification in background
    if h.emailService != nil && h.emailService.IsEnabled() {
        go func() {
            city, err := h.db.Queries.GetCityByID(ctx, int32(correctionReq.CityID))
            if err != nil {
                slog.Error("failed to get city for email", "error", err, "city_id", correctionReq.CityID)
                return
            }

            if req.Status == "approved" {
                err = h.emailService.SendCorrectionApproved(
                    correctionReq.RequesterEmail,
                    city.Name,
                    req.ReviewNotes,
                )
            } else {
                err = h.emailService.SendCorrectionRejected(
                    correctionReq.RequesterEmail,
                    city.Name,
                    req.ReviewNotes,
                )
            }

            if err != nil {
                slog.Error("failed to send notification email", "error", err, "to", correctionReq.RequesterEmail)
            }
        }()
    }

    // 9. Respond
    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "status":  req.Status,
        "message": "Correction request " + req.Status,
    })
}
```

#### Role-Based Filtering Logic

```go
// GetCorrectionRequests - Role detection
role := middleware.GetUserRole(ctx)

if role == "admin" {
    // Return all requests, optional status filter
    requests, err := h.db.Queries.GetAllCorrectionRequests(ctx, statusFilter)
} else if role == "publisher" {
    // Return only publisher's requests
    requests, err := h.db.Queries.GetPublisherCorrectionRequests(ctx, publisherID)
} else {
    // No valid role - 401 Unauthorized
    RespondUnauthorized(w, r, "Authentication required")
}
```

#### Frontend Migration Steps

**Publisher Page:** `web/app/publisher/correction-requests/page.tsx`
```typescript
// BEFORE
const data = await api.get<CorrectionRequestsResponse>('/publisher/correction-requests');

// AFTER
const data = await api.get<CorrectionRequestsResponse>('/correction-requests');
```

**Admin Page:** `web/app/admin/correction-requests/page.tsx`
```typescript
// BEFORE
const data = await api.get<CorrectionRequestsResponse>('/admin/correction-requests?status=pending');
await api.post(`/admin/correction-requests/${id}/approve`, { review_notes: notes });
await api.post(`/admin/correction-requests/${id}/reject`, { review_notes: notes });

// AFTER
const data = await api.get<CorrectionRequestsResponse>('/correction-requests?status=pending');
await api.put(`/correction-requests/${id}/status`, {
    status: 'approved',  // or 'rejected'
    review_notes: notes
});
```

#### Deprecation Redirect Implementation

```go
func (h *Handlers) DeprecatedGetPublisherCorrectionRequests(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Deprecation", "true")
    w.Header().Set("Sunset", "Sun, 15 Jun 2025 00:00:00 GMT")
    w.Header().Set("Link", "</correction-requests>; rel=\"successor-version\"")

    newURL := "/correction-requests"
    if r.URL.RawQuery != "" {
        newURL += "?" + r.URL.RawQuery
    }

    http.Redirect(w, r, newURL, http.StatusMovedPermanently)
}

func (h *Handlers) DeprecatedAdminApproveCorrectionRequest(w http.ResponseWriter, r *http.Request) {
    id := chi.URLParam(r, "id")

    w.Header().Set("Deprecation", "true")
    w.Header().Set("Sunset", "Sun, 15 Jun 2025 00:00:00 GMT")
    w.Header().Set("Link", "</correction-requests/" + id + "/status>; rel=\"successor-version\"")

    http.Redirect(w, r, "/correction-requests/" + id + "/status", http.StatusMovedPermanently)
}
```

---

### Story 9.4: API Security Audit & Authorization Hardening (8 pts)

#### Security Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: API Gateway                                        │
│  - JWT validation via Clerk authorizer                       │
│  - Routes: /public/* (no auth), /auth/* (JWT required)       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Middleware                                         │
│  - RequireAuth: Validates JWT, adds user_id to context       │
│  - RequireRole: Enforces role (admin/publisher)              │
│  - GetValidatedPublisherID: Validates X-Publisher-Id         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: PublisherResolver                                  │
│  - MustResolve: Extracts publisher ID from header/DB         │
│  - Validates against JWT claims (primary_publisher_id)       │
│  - Admin bypass for cross-tenant access                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Handlers                                           │
│  - 6-step handler pattern                                    │
│  - Publisher context from MustResolve                        │
│  - SQLc queries with publisher_id filter                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 5: Database                                           │
│  - Foreign key relationships enforce ownership               │
│  - Queries filter by publisher_id from context               │
│  - Prevent IDOR via composite filters                        │
└─────────────────────────────────────────────────────────────┘
```

#### Audit Checklist by Route Type

##### Public API Routes (Read-Only)

**File:** `api/cmd/api/main.go` lines 228-320

**Checklist:**
- [ ] All routes are GET-only (except calculation endpoints)
- [ ] No POST/PUT/DELETE operations without authentication
- [ ] Rate limiting applied via `rateLimiter.Middleware`
- [ ] Public routes return 401 for mutation attempts without auth
- [ ] No sensitive data in public responses

**Test Scenarios:**
```bash
# Should succeed (read)
curl https://api.com/api/v1/public/publishers

# Should fail 401 or 405 (mutation without auth)
curl -X POST https://api.com/api/v1/public/publishers \
  -d '{"name": "Malicious"}'
```

##### Publisher Routes (Tenant Isolation)

**File:** `api/cmd/api/main.go` lines 337-439

**Checklist:**
- [ ] All routes use `RequireRole("publisher")` middleware
- [ ] All handlers call `MustResolve()` for publisher context
- [ ] Database queries filter by `publisher_id` from context
- [ ] X-Publisher-Id validated against JWT claims
- [ ] Unauthorized publisher access returns 403 Forbidden
- [ ] Admin users can access any publisher (authorized exception)

**Test Scenarios:**
```bash
# Setup: Create Publisher A (ID: 1), add zman (ID: 123)
#        Create Publisher B (ID: 2)

# Test: Publisher B attempts to access Publisher A's data
curl -H "Authorization: Bearer $PUBLISHER_B_JWT" \
     -H "X-Publisher-Id: 1" \
     https://api.com/api/v1/auth/publisher/zmanim/123

# Expected: 403 Forbidden (Publisher B cannot access Publisher A's context)
```

##### Admin Routes (Role Enforcement)

**File:** `api/cmd/api/main.go` lines 447-531

**Checklist:**
- [ ] All routes use `RequireRole("admin")` middleware
- [ ] Publishers cannot access admin endpoints (403 Forbidden)
- [ ] Role check in middleware line 261: `userRole != "admin"`
- [ ] No handler-level role checks bypassing middleware
- [ ] Admin users can access any publisher (bypass tenant isolation)

**Test Scenarios:**
```bash
# Test: Publisher attempts to access admin endpoint
curl -H "Authorization: Bearer $PUBLISHER_JWT" \
     https://api.com/api/v1/auth/admin/publishers

# Expected: 403 Forbidden (publisher cannot access admin routes)
```

#### IDOR Testing Scenarios

##### Test 1: Cross-Tenant Data Access

```bash
# Setup
# 1. Create Publisher A (ID: 1), add zman (ID: 123)
# 2. Create Publisher B (ID: 2)

# Test
curl -H "Authorization: Bearer $PUBLISHER_B_JWT" \
     -H "X-Publisher-Id: 1" \
     https://api.com/api/v1/auth/publisher/zmanim/123

# Expected
# 403 Forbidden (Publisher B cannot access Publisher A's context)

# Reason
# GetValidatedPublisherID() validates X-Publisher-Id against JWT claims
# Publisher B's JWT does not authorize access to Publisher A's data
```

##### Test 2: IDOR via Resource ID

```bash
# Setup
# 1. Login as Publisher A, create coverage (ID: 456)
# 2. Note coverage ID from response
# 3. Login as Publisher B

# Test
curl -H "Authorization: Bearer $PUBLISHER_B_JWT" \
     -H "X-Publisher-Id: 2" \
     https://api.com/api/v1/auth/publisher/coverage/456

# Expected
# 404 Not Found (don't reveal existence) or 403 Forbidden

# Reason
# Database query filters by BOTH publisher_id AND coverage ID
# WHERE publisher_id = $1 AND id = $2
# Publisher B's publisher_id = 2, coverage 456 belongs to Publisher A
```

##### Test 3: Admin Cross-Tenant Access (Authorized)

```bash
# Test
curl -H "Authorization: Bearer $ADMIN_JWT" \
     -H "X-Publisher-Id: 1" \
     https://api.com/api/v1/auth/publisher/zmanim/123

# Expected
# 200 OK (admin can access any publisher's data)

# Reason
# GetValidatedPublisherID() bypasses validation for admin role
# if userRole == "admin" && requestedID != "" { return requestedID }
```

#### Tenant Isolation Verification

**Key Function:** `middleware.GetValidatedPublisherID()`

```go
func GetValidatedPublisherID(ctx context.Context, requestedID string) string {
    primaryID := GetPrimaryPublisherID(ctx)
    accessList := GetPublisherAccessList(ctx)
    userRole := GetUserRole(ctx)

    // Admin users can access any publisher (BYPASS)
    if userRole == "admin" && requestedID != "" {
        return requestedID
    }

    // If no specific ID requested, use primary
    if requestedID == "" {
        return primaryID
    }

    // Check if requested ID is the primary
    if requestedID == primaryID {
        return requestedID
    }

    // Check if requested ID is in the access list
    for _, id := range accessList {
        if id == requestedID {
            return requestedID
        }
    }

    // Requested ID not in user's access list - return empty (UNAUTHORIZED)
    slog.Warn("publisher access denied", "requested", requestedID, "primary", primaryID, "access_list", accessList)
    return ""
}
```

**Verification Tests:**
```bash
# 1. Publisher with single publisher access
# JWT: { primary_publisher_id: "1", publisher_access_list: ["1"] }
# Request: X-Publisher-Id: 2
# Expected: 403 Forbidden

# 2. Publisher with multi-publisher access
# JWT: { primary_publisher_id: "1", publisher_access_list: ["1", "2"] }
# Request: X-Publisher-Id: 2
# Expected: 200 OK (authorized)

# 3. Admin with any publisher
# JWT: { role: "admin" }
# Request: X-Publisher-Id: 999
# Expected: 200 OK (admin bypass)
```

#### Security Test Suite Design

**Test File:** `api/internal/handlers/security_test.go`

```go
func TestPublisherTenantIsolation(t *testing.T) {
    tests := []struct {
        name           string
        publisherAID   string
        publisherBID   string
        resourceID     string
        expectedStatus int
    }{
        {
            name:           "Publisher B cannot access Publisher A's zman",
            publisherAID:   "1",
            publisherBID:   "2",
            resourceID:     "123",
            expectedStatus: 403,
        },
        {
            name:           "Publisher A can access own zman",
            publisherAID:   "1",
            publisherBID:   "1",
            resourceID:     "123",
            expectedStatus: 200,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Setup: Create zman for Publisher A
            // Test: Attempt access as Publisher B
            // Assert: Status code matches expected
        })
    }
}

func TestAdminCrossTenantAccess(t *testing.T) {
    // Test admin can access any publisher's data
}

func TestIDORVulnerabilities(t *testing.T) {
    // Test direct object reference attacks
}
```

#### Vulnerability Fixes Required

**CRITICAL:** PublisherResolver May Not Validate X-Publisher-Id

**File:** `api/internal/handlers/publisher_context.go`

**Issue:**
```go
// CURRENT - Trusts X-Publisher-Id without validation
func (pr *PublisherResolver) Resolve(ctx context.Context, r *http.Request) (*PublisherContext, error) {
    // 1. Try X-Publisher-Id header first
    publisherID := r.Header.Get("X-Publisher-Id")
    if publisherID != "" {
        pc.PublisherID = publisherID  // ⚠️ No validation!
        return pc, nil
    }
    // ...
}
```

**FIX:**
```go
// FIXED - Validate X-Publisher-Id against JWT claims
func (pr *PublisherResolver) Resolve(ctx context.Context, r *http.Request) (*PublisherContext, error) {
    userID := middleware.GetUserID(ctx)
    userRole := middleware.GetUserRole(ctx)
    isAdmin := userRole == "admin"

    pc := &PublisherContext{
        UserID:   userID,
        UserRole: userRole,
        IsAdmin:  isAdmin,
    }

    // 1. Try X-Publisher-Id header first
    requestedID := r.Header.Get("X-Publisher-Id")
    if requestedID != "" {
        // VALIDATE against JWT claims
        validatedID := middleware.GetValidatedPublisherID(ctx, requestedID)
        if validatedID == "" {
            return nil, fmt.Errorf("publisher access denied")
        }
        pc.PublisherID = validatedID
        return pc, nil
    }

    // 2. Fall back to primary publisher from JWT
    primaryID := middleware.GetPrimaryPublisherID(ctx)
    if primaryID != "" {
        pc.PublisherID = primaryID
        return pc, nil
    }

    // 3. Fall back to database lookup by clerk_user_id
    // ...
}
```

---

### Story 9.5: Frontend API Audit & Deprecated Code Removal (8 pts)

#### Technical Debt Baseline Metrics

| Metric | Count | Severity | Files |
|--------|-------|----------|-------|
| Raw `fetch()` calls | 6 | CRITICAL | `web/components/publisher/LogoUpload.tsx`, `web/lib/api-client.ts` |
| TODO comments | 102 | HIGH | `web/`, `api/` (frontend + backend) |
| FIXME comments | 3 | HIGH | Various |
| Deprecated markers | 6388 | MEDIUM | Mostly auto-generated Swagger docs |
| `log.Printf/fmt.Printf` | 26 | HIGH | `api/internal/` (excluding tests) |

**Notes:**
- Most `fetch()` calls (6) are either in `api-client.ts` (implementation itself) or data URL conversions (acceptable)
- Deprecated markers (6388) mostly in auto-generated docs - focus on source code
- `log.Printf` count (26) excludes test files (`_test.go`)

#### Verification Commands

```bash
# Raw fetch() violations (exclude api-client.ts and data URLs)
grep -rn "await fetch\(" web/app web/components --include="*.tsx" --include="*.ts" | \
  grep -v "api-client.ts" | \
  grep -v "data URL"

# TODO comments
grep -rn "// TODO\|TODO:" web/ api/ --include="*.tsx" --include="*.ts" --include="*.go" | \
  grep -v "node_modules" | \
  grep -v "_test.go" | \
  grep -v "swagger/"

# FIXME comments
grep -rn "// FIXME\|FIXME:" web/ api/ --include="*.tsx" --include="*.ts" --include="*.go" | \
  grep -v "node_modules"

# Deprecated markers
grep -rn "@deprecated\|DEPRECATED\|Legacy" web/ api/ --include="*.tsx" --include="*.ts" --include="*.go" | \
  grep -v "node_modules" | \
  grep -v "swagger/"

# log.Printf in production code (exclude tests)
grep -rn "log\.Printf\|fmt\.Printf" api/internal --include="*.go" | \
  grep -v "_test.go"
```

#### Zero Tolerance Enforcement

**Verification Script:** `./scripts/check-compliance.sh`

```bash
#!/bin/bash

echo "Checking ZERO TOLERANCE compliance..."

# 1. Raw fetch() in components
FETCH_COUNT=$(grep -r "await fetch\(" web/app web/components --include="*.tsx" --include="*.ts" 2>/dev/null | \
  grep -v "api-client.ts" | wc -l)

if [ $FETCH_COUNT -gt 0 ]; then
  echo "❌ FAILED: $FETCH_COUNT raw fetch() calls in components"
  exit 1
fi

# 2. TODO comments
TODO_COUNT=$(grep -r "TODO" web/ api/ --include="*.tsx" --include="*.ts" --include="*.go" 2>/dev/null | \
  grep -v "node_modules" | \
  grep -v "_test.go" | \
  grep -v "swagger/" | wc -l)

if [ $TODO_COUNT -gt 0 ]; then
  echo "❌ FAILED: $TODO_COUNT TODO comments found"
  exit 1
fi

# 3. FIXME comments
FIXME_COUNT=$(grep -r "FIXME" web/ api/ --include="*.tsx" --include="*.ts" --include="*.go" 2>/dev/null | \
  grep -v "node_modules" | wc -l)

if [ $FIXME_COUNT -gt 0 ]; then
  echo "❌ FAILED: $FIXME_COUNT FIXME comments found"
  exit 1
fi

# 4. Deprecated markers
DEPRECATED_COUNT=$(grep -r "@deprecated\|DEPRECATED\|Legacy" web/ api/ --include="*.tsx" --include="*.ts" --include="*.go" 2>/dev/null | \
  grep -v "node_modules" | \
  grep -v "swagger/" | wc -l)

if [ $DEPRECATED_COUNT -gt 0 ]; then
  echo "❌ FAILED: $DEPRECATED_COUNT deprecated markers found"
  exit 1
fi

# 5. log.Printf in production code
LOGPRINTF_COUNT=$(grep -r "log\.Printf\|fmt\.Printf" api/internal --include="*.go" 2>/dev/null | \
  grep -v "_test.go" | wc -l)

if [ $LOGPRINTF_COUNT -gt 0 ]; then
  echo "❌ FAILED: $LOGPRINTF_COUNT log.Printf/fmt.Printf calls in production code"
  exit 1
fi

echo "✅ PASSED: ZERO TOLERANCE compliance verified"
exit 0
```

#### Conversion Patterns

##### fetch() to useApi() - GET Request

**BEFORE (FORBIDDEN):**
```tsx
const response = await fetch(`${API_BASE}/api/v1/publisher/profile`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-Publisher-Id': publisherId,
  },
});
const data = await response.json();
if (!response.ok) {
  throw new Error(data.message);
}
```

**AFTER (REQUIRED):**
```tsx
const api = useApi();
try {
  const data = await api.get<ProfileData>('/publisher/profile');
  // Success - data is already unwrapped
} catch (err) {
  if (err instanceof ApiError) {
    console.error(err.message, err.status);
  }
}
```

##### log.Printf to slog - Error Level

**BEFORE (FORBIDDEN):**
```go
log.Printf("Error fetching data: %v", err)
fmt.Printf("Database query failed: %v\n", err)
```

**AFTER (REQUIRED):**
```go
slog.Error("failed to fetch data", "error", err, "publisher_id", publisherID)
slog.Error("database query failed", "error", err, "query", queryName)
```

##### Dual-Format to Single Format

**BEFORE (FORBIDDEN):**
```tsx
// Dual format support
const status = data.status || data.status_key;
const name = data.display_name || data.name;
if (publisher.status === 'verified' || publisher.status === 'active') {
  // ...
}
```

**AFTER (REQUIRED):**
```tsx
// One format only
const status = data.status_key;  // Canonical format (lookup table key)
const name = data.display_name;  // Canonical format
if (publisher.status_key === 'verified') {
  // ...
}
// Migrate data to new format, delete old format support
```

---

## 4. Database Changes

### Story 9.2: Soft-Delete Pattern (Documentation Only)

**No migrations required** - pattern documentation for existing tables

### Story 9.3: Correction Requests (No Changes)

**Tables already exist:**
- `city_correction_requests`
- Foreign keys to `publishers`, `geo_cities`

**Queries already exist:**
- `GetAllCorrectionRequests`
- `GetPublisherCorrectionRequests`
- `UpdateCorrectionRequestStatus`
- `ApplyCityCorrection`

### Story 9.4: Security Audit (No Schema Changes)

**Verification only** - no database changes required

### Story 9.5: Code Cleanup (No Database Changes)

**Code quality only** - no database changes required

---

## 5. API Changes

### New Endpoints

**Story 9.3:**
- `GET /correction-requests` - Unified list (role-aware)
- `PUT /correction-requests/{id}/status` - Unified status update (admin only)

### Modified Endpoints

**None** - All changes are consolidations

### Deprecated Endpoints (with Sunset Dates)

**Story 9.3:**
- `GET /publisher/correction-requests` → 301 to `/correction-requests` (Sunset: 2025-06-15)
- `GET /admin/correction-requests` → 301 to `/correction-requests` (Sunset: 2025-06-15)
- `POST /admin/correction-requests/{id}/approve` → 301 to `/correction-requests/{id}/status` (Sunset: 2025-06-15)
- `POST /admin/correction-requests/{id}/reject` → 301 to `/correction-requests/{id}/status` (Sunset: 2025-06-15)

### Breaking Changes

**None** - All deprecated endpoints return 301 redirects with 6-month sunset period

---

## 6. Testing Strategy

### Unit Test Requirements

**Story 9.3:**
```go
// api/internal/handlers/correction_requests_test.go

func TestGetCorrectionRequests_Admin(t *testing.T) {
    // Test admin sees all requests
}

func TestGetCorrectionRequests_Publisher(t *testing.T) {
    // Test publisher sees only own requests
}

func TestUpdateCorrectionRequestStatus_AdminOnly(t *testing.T) {
    // Test 403 for non-admin
}

func TestUpdateCorrectionRequestStatus_Approved(t *testing.T) {
    // Test city correction applied + status updated
}

func TestUpdateCorrectionRequestStatus_Rejected(t *testing.T) {
    // Test status updated without city change
}
```

**Story 9.4:**
```go
// api/internal/handlers/security_test.go

func TestPublisherTenantIsolation(t *testing.T) {
    // Test Publisher B cannot access Publisher A's data
}

func TestIDORVulnerabilities(t *testing.T) {
    // Test direct object reference attacks
}

func TestAdminCrossTenantAccess(t *testing.T) {
    // Test admin can access any publisher (authorized)
}
```

### Integration Test Requirements

**Story 9.1:**
```bash
# Manual verification after CDK deployment
curl https://zmanim.shtetl.io/api/v1/public/publishers  # Should work
curl https://zmanim.shtetl.io/api/v1/auth/publisher/profile  # Should 401
curl -H "Authorization: Bearer $JWT" https://zmanim.shtetl.io/api/v1/auth/publisher/profile  # Should work
```

### E2E Test Requirements

**Story 9.3:**
```typescript
// tests/e2e/correction-requests.spec.ts

test('Publisher creates request, admin approves', async ({ page }) => {
  // 1. Login as publisher
  await loginAsPublisher(page, publisherId);

  // 2. Create correction request
  await page.goto(`${BASE_URL}/publisher/correction-requests`);
  await page.click('text=New Request');
  // ... fill form ...
  await page.click('text=Submit');

  // 3. Login as admin
  await loginAsAdmin(page);

  // 4. Approve request
  await page.goto(`${BASE_URL}/admin/correction-requests`);
  await page.click('text=Approve');

  // 5. Verify city updated
  // 6. Verify email sent
  // 7. Verify status changed
});
```

### Security Test Requirements

**Story 9.4:**
```bash
# Test 1: Cross-tenant data access
# Setup: Create Publisher A (ID: 1), add zman (ID: 123)
#        Create Publisher B (ID: 2)
curl -H "Authorization: Bearer $PUBLISHER_B_JWT" \
     -H "X-Publisher-Id: 1" \
     https://api.com/api/v1/auth/publisher/zmanim/123
# Expected: 403 Forbidden

# Test 2: IDOR vulnerability
curl -H "Authorization: Bearer $PUBLISHER_B_JWT" \
     -H "X-Publisher-Id: 2" \
     https://api.com/api/v1/auth/publisher/coverage/456
# Expected: 404 Not Found (Publisher A's resource)

# Test 3: Privilege escalation
curl -H "Authorization: Bearer $PUBLISHER_JWT" \
     https://api.com/api/v1/auth/admin/publishers
# Expected: 403 Forbidden

# Test 4: SQL injection
curl "https://api.com/api/v1/public/cities?search='; DROP TABLE cities; --"
# Expected: Safe handling, no database modification
```

---

## 7. Deployment Plan

### Story Execution Order (Recommended)

1. **Story 9.2** (Documentation & Cleanup) - Low risk, no user impact
   - Create pattern documentation
   - Clean up Epic 8 deprecated code
   - No deployment required (documentation only)

2. **Story 9.5** (Frontend API Audit) - Medium risk, no user impact if done correctly
   - Convert fetch() to useApi()
   - Remove TODO/FIXME comments
   - Convert log.Printf to slog
   - Test locally before deployment
   - Deploy frontend to Vercel

3. **Story 9.3** (Correction Request Consolidation) - Medium risk, 301 redirects protect against breakage
   - Create unified handlers
   - Add deprecation redirects
   - Update frontend to use new endpoints
   - Deploy backend to Fly.io
   - Deploy frontend to Vercel
   - Monitor for 301 redirects in logs

4. **Story 9.4** (Security Audit) - High risk, may discover critical vulnerabilities
   - Audit all endpoints
   - Test IDOR vulnerabilities
   - Fix any discovered vulnerabilities
   - Create security test suite
   - Deploy fixes to Fly.io

5. **Story 9.1** (API Gateway Configuration) - Low risk but infrastructure change
   - Update CDK configuration
   - Deploy to AWS via `npx cdktf deploy`
   - Monitor CloudWatch logs
   - Rollback plan ready

### Dependencies Between Stories

```
9.2 (Documentation)
  └─> No dependencies

9.5 (Frontend Cleanup)
  └─> Depends on 9.2 (coding standards reference)

9.3 (Endpoint Consolidation)
  └─> Depends on 9.5 (frontend uses unified API client)

9.4 (Security Audit)
  └─> Depends on 9.3 (audit unified endpoints)

9.1 (Gateway Config)
  └─> Depends on 9.3 (backend routes complete)
  └─> Depends on 9.4 (security verified)
```

### Rollback Procedures

**Story 9.1 (Infrastructure):**
```bash
# Revert CDK code
cd /home/coder/workspace/zmanim/infrastructure
git checkout HEAD~1 lib/stacks/zmanim-prod.ts

# Redeploy previous configuration
npx cdktf deploy zmanim-prod
```

**Story 9.3 (Endpoint Consolidation):**
```bash
# Keep old endpoints active alongside new ones
# Frontend automatically uses new endpoints via normalizeEndpoint
# 301 redirects ensure backward compatibility
# No rollback needed - both work simultaneously
```

**Story 9.4 (Security Fixes):**
```bash
# Revert security fix commits
git revert <commit-hash>

# Redeploy backend
fly deploy

# CRITICAL: Only rollback if fix causes breakage
# Security fixes should NOT be rolled back unless absolutely necessary
```

**Story 9.5 (Code Cleanup):**
```bash
# Revert cleanup commits
git revert <commit-hash>

# Redeploy frontend
vercel --prod

# Redeploy backend
fly deploy
```

---

## 8. Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Story | Mitigation |
|------|-------------|--------|-------|------------|
| Infrastructure deployment failure | LOW | HIGH | 9.1 | Phased deployment, rollback plan ready |
| Security vulnerabilities discovered | MEDIUM | CRITICAL | 9.4 | Immediate fix priority, security test suite |
| Breaking changes in consolidation | LOW | MEDIUM | 9.3 | 301 redirects, 6-month sunset |
| Refactoring introduces bugs | MEDIUM | MEDIUM | 9.5 | Comprehensive testing, type-check, build verification |
| X-Publisher-Id validation bypass | MEDIUM | CRITICAL | 9.4 | Fix in PublisherResolver, test suite |

### Mitigation Strategies

1. **Infrastructure Deployment (9.1)**
   - **Risk:** CDK deployment fails or breaks routing
   - **Mitigation:**
     - Test with `npx cdktf diff` before deployment
     - Deploy during low-traffic period
     - Monitor CloudWatch logs immediately
     - Keep rollback commands ready
     - Test all route types post-deployment

2. **Security Vulnerabilities (9.4)**
   - **Risk:** Discover critical IDOR or tenant isolation bugs
   - **Mitigation:**
     - Prioritize fixes immediately (don't defer)
     - Create comprehensive test scenarios
     - Test with real publisher accounts
     - Add security test suite to CI/CD
     - Document all security patterns

3. **API Consolidation (9.3)**
   - **Risk:** Frontend breaks when switching to unified endpoints
   - **Mitigation:**
     - 301 redirects ensure backward compatibility
     - Test both old and new endpoints
     - Monitor 301 redirect logs
     - 6-month sunset period for migration

4. **Large-Scale Refactoring (9.5)**
   - **Risk:** Converting 73+ fetch() calls introduces bugs
   - **Mitigation:**
     - Test locally BEFORE pushing (don't rely on CI)
     - Run `npm run type-check` after every change
     - Test all pages in browser
     - Use automated compliance checks
     - Incremental commits (not one giant commit)

---

## 9. Success Metrics

### How to Measure Completion

**Story 9.1:**
- [ ] CDK diff shows expected changes (50+ routes removed, 2 added)
- [ ] Deployment completes without errors
- [ ] Public endpoint works without auth: `curl https://zmanim.shtetl.io/api/v1/public/publishers`
- [ ] Auth endpoint rejects without JWT: `curl https://zmanim.shtetl.io/api/v1/auth/publisher/profile` → 401
- [ ] Auth endpoint works with JWT: `curl -H "Authorization: Bearer $JWT" ...` → 200
- [ ] No CloudWatch errors in API Gateway logs

**Story 9.2:**
- [ ] Documentation files created: `version-history.md`, `soft-delete.md`, `README.md`
- [ ] All Epic 8 TODO/FIXME markers removed
- [ ] `cd api && go test ./...` passes
- [ ] `cd web && npm run type-check` passes
- [ ] No broken documentation links

**Story 9.3:**
- [ ] Unified GET endpoint works for admin (returns all requests)
- [ ] Unified GET endpoint works for publisher (returns only own requests)
- [ ] Unified PUT endpoint requires admin role (403 for publisher)
- [ ] Approval flow applies city correction + updates status + sends email
- [ ] Rejection flow updates status without city change + sends email
- [ ] Old endpoints return 301 redirect with deprecation headers
- [ ] Frontend updated to use new endpoints
- [ ] `cd api && go test ./internal/handlers/...` passes
- [ ] `cd tests && npx playwright test correction-requests` passes

**Story 9.4:**
- [ ] All public routes verified as GET-only (except calculation endpoints)
- [ ] Cross-tenant isolation tested: Publisher B cannot access Publisher A's data → 403
- [ ] IDOR vulnerability tested: Publisher B cannot access Publisher A's resource by ID → 404/403
- [ ] Privilege escalation tested: Publisher cannot access admin endpoint → 403
- [ ] Admin cross-tenant access verified: Admin can access any publisher → 200
- [ ] PublisherResolver validates X-Publisher-Id against JWT claims
- [ ] Security test suite created: `api/internal/handlers/security_test.go`
- [ ] All security tests pass
- [ ] Security audit checklist completed and documented

**Story 9.5:**
- [ ] Zero raw fetch() calls in components: `grep -r "await fetch\(" web/app web/components` → 0 results
- [ ] Zero TODO comments: `grep -r "TODO" web/ api/ --include="*.tsx" --include="*.ts" --include="*.go"` → 0 results
- [ ] Zero FIXME comments: `grep -r "FIXME" web/ api/` → 0 results
- [ ] Zero deprecated markers in source: `grep -r "@deprecated\|DEPRECATED" web/ api/` → 0 results (excluding swagger)
- [ ] Zero log.Printf in production: `grep -r "log\.Printf\|fmt\.Printf" api/internal --include="*.go"` → 0 results (excluding tests)
- [ ] `cd web && npm run type-check` passes
- [ ] `cd api && go build -v ./cmd/api ./internal/...` passes
- [ ] `cd api && golangci-lint run ./...` passes
- [ ] `cd tests && npx playwright test` passes
- [ ] `./scripts/check-compliance.sh` passes

### Verification Commands

```bash
# Story 9.1 - Infrastructure
cd infrastructure && npx cdktf diff zmanim-prod
curl https://zmanim.shtetl.io/api/v1/public/publishers
curl https://zmanim.shtetl.io/api/v1/auth/publisher/profile  # Should 401
curl -H "Authorization: Bearer $JWT" https://zmanim.shtetl.io/api/v1/auth/publisher/profile

# Story 9.2 - Documentation
ls -la api/internal/docs/patterns/
cd api && go test ./...
cd web && npm run type-check

# Story 9.3 - Consolidation
curl http://localhost:8080/api/v1/correction-requests  # Test locally
cd api && go test ./internal/handlers/correction_requests_test.go -v
cd tests && npx playwright test correction-requests

# Story 9.4 - Security
cd api && go test ./internal/handlers/security_test.go -v
# Manual security testing with Publisher A/B accounts

# Story 9.5 - Cleanup
./scripts/check-compliance.sh
cd web && npm run type-check
cd api && go build -v ./cmd/api ./internal/...
cd api && golangci-lint run ./...
cd tests && npx playwright test
```

---

## Appendix A: Key Files Index

### Infrastructure

| File | Purpose | Stories |
|------|---------|---------|
| `/home/coder/workspace/zmanim/infrastructure/lib/stacks/zmanim-prod.ts` | API Gateway CDK config | 9.1 |
| `/home/coder/workspace/zmanim/infrastructure/lib/config.ts` | Infrastructure config | 9.1 |

### Backend

| File | Purpose | Stories |
|------|---------|---------|
| `/home/coder/workspace/zmanim/api/cmd/api/main.go` | Route definitions | 9.1, 9.3 |
| `/home/coder/workspace/zmanim/api/internal/handlers/correction_requests.go` | Correction request handlers | 9.3 |
| `/home/coder/workspace/zmanim/api/internal/handlers/admin_corrections.go` | Admin correction handlers | 9.3 |
| `/home/coder/workspace/zmanim/api/internal/handlers/publisher_context.go` | Publisher resolver | 9.4 |
| `/home/coder/workspace/zmanim/api/internal/middleware/auth.go` | JWT validation, role enforcement | 9.4 |
| `/home/coder/workspace/zmanim/api/internal/handlers/version_history.go` | Algorithm version history | 9.2 |
| `/home/coder/workspace/zmanim/api/internal/handlers/master_registry.go` | Zman version history | 9.2 |
| `/home/coder/workspace/zmanim/api/internal/handlers/publisher_zmanim.go` | Zman soft-delete | 9.2 |
| `/home/coder/workspace/zmanim/api/internal/handlers/publisher_snapshots.go` | Snapshot soft-delete | 9.2 |

### Frontend

| File | Purpose | Stories |
|------|---------|---------|
| `/home/coder/workspace/zmanim/web/lib/api-client.ts` | Unified API client | 9.5 |
| `/home/coder/workspace/zmanim/web/app/publisher/correction-requests/page.tsx` | Publisher correction requests | 9.3 |
| `/home/coder/workspace/zmanim/web/app/admin/correction-requests/page.tsx` | Admin correction requests | 9.3 |

### Documentation

| File | Purpose | Stories |
|------|---------|---------|
| `/home/coder/workspace/zmanim/api/internal/docs/patterns/README.md` | Pattern index | 9.2 |
| `/home/coder/workspace/zmanim/api/internal/docs/patterns/version-history.md` | Version history patterns | 9.2 |
| `/home/coder/workspace/zmanim/api/internal/docs/patterns/soft-delete.md` | Soft-delete pattern | 9.2 |
| `/home/coder/workspace/zmanim/docs/architecture.md` | Architecture reference | All |
| `/home/coder/workspace/zmanim/docs/coding-standards.md` | Coding standards | All |

### Scripts

| File | Purpose | Stories |
|------|---------|---------|
| `/home/coder/workspace/zmanim/scripts/check-compliance.sh` | Zero tolerance enforcement | 9.5 |
| `/home/coder/workspace/zmanim/restart.sh` | Service restart | All |

---

## Appendix B: Context File References

| Story | Context File |
|-------|--------------|
| 9.1 | `/home/coder/workspace/zmanim/docs/sprint-artifacts/stories/9-1-api-gateway-path-configuration.context.xml` |
| 9.2 | `/home/coder/workspace/zmanim/docs/sprint-artifacts/stories/9-2-api-route-documentation-cleanup.context.xml` |
| 9.3 | `/home/coder/workspace/zmanim/docs/sprint-artifacts/stories/9-3-correction-request-endpoint-consolidation.context.xml` |
| 9.4 | `/home/coder/workspace/zmanim/docs/sprint-artifacts/stories/9-4-api-security-audit-authorization-hardening.context.xml` |
| 9.5 | `/home/coder/workspace/zmanim/docs/sprint-artifacts/stories/9-5-frontend-api-audit-deprecated-code-removal.context.xml` |
| 9.6 | `/home/coder/workspace/zmanim/docs/sprint-artifacts/stories/9-6-database-sqlc-ui-sync-audit.md` (no context XML) |
| 9.7 | `/home/coder/workspace/zmanim/docs/sprint-artifacts/stories/9-7-e2e-test-suite-refresh.context.xml` |
| 9.8 | `/home/coder/workspace/zmanim/docs/sprint-artifacts/stories/9-8-local-test-environment-parity.context.xml` |
| 9.9 | `/home/coder/workspace/zmanim/docs/sprint-artifacts/stories/9-9-github-actions-ci-validation.context.xml` |

---

_Generated: 2025-12-15_
_Version: 1.0_
_Total Story Points: 29_
_Estimated Duration: 2-3 sprints (depending on security findings)_
