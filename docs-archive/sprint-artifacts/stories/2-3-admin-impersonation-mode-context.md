# Story Context: 2.3 Admin Impersonation Mode

**Generated:** 2025-11-26
**Story:** Admin Impersonation Mode
**Epic:** Epic 2 - Publisher User Management & Dashboard

---

## Relevant Documentation

### From Tech Spec (docs/sprint-artifacts/tech-spec-epic-2.md)

**Impersonation Flow:**
```
Admin UI → Click "Impersonate Publisher"
    │
    └── POST /api/admin/impersonate/{publisherId}
        │
        ├── Validate admin role
        ├── Validate publisher exists
        ├── Set session: { impersonating_publisher_id: publisherId }
        │
        └── Return success + redirect to /publisher
            │
            └── Frontend shows impersonation banner
                │
                ├── All /api/publisher/* calls include context
                │
                └── Activity logs record actor_type: 'admin_impersonation'
```

**Session/Cookie Strategy:**
```
Cookie: zmanim_impersonation
Value: {
  publisher_id: string,
  admin_user_id: string,
  started_at: timestamp
}
Secure: true
HttpOnly: true
SameSite: Strict
MaxAge: 4 hours
```

### From Architecture (docs/architecture.md)

**Security Controls:**
- TLS: All traffic HTTPS (enforced by Fly.io/Vercel)
- Tenant Isolation: All publisher queries filtered by publisher_id

**Authorization Model:**
| Role | Capabilities |
|------|-------------|
| admin | All publisher + manage all publishers |

---

## Existing Code References

### Backend - Auth Middleware

**File:** `api/internal/middleware/auth.go`

Context keys (lines 20-27):
```go
const (
    UserIDKey contextKey = "user_id"
    UserRoleKey contextKey = "user_role"
)
```

Role checking pattern (lines 103-128):
```go
func (am *AuthMiddleware) RequireRole(role string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // ...
            userRole, _ := claims.Metadata["role"].(string)
            if userRole != role && userRole != "admin" { // admin has access to all roles
                respondAuthError(w, http.StatusForbidden, "FORBIDDEN", ...)
                return
            }
            // ...
        })
    }
}
```

Helper functions (lines 350-368):
```go
func GetUserID(ctx context.Context) string { ... }
func GetUserRole(ctx context.Context) string { ... }
func IsAuthenticated(ctx context.Context) bool { ... }
```

### Backend - Admin Handlers

**File:** `api/internal/handlers/admin.go`

Will need to add impersonation endpoints alongside existing admin handlers.

### Backend - Response Helpers

**File:** `api/internal/handlers/response.go`

Available response helpers:
- `RespondJSON()`
- `RespondBadRequest()`
- `RespondNotFound()`
- `RespondForbidden()` (may need to add)
- `RespondInternalError()`

### Frontend - Admin Publisher Detail

**File:** `web/app/admin/publishers/[id]/page.tsx` (to be created in Story 2.1)

Will add "Impersonate Publisher" button here.

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Story 2.1 (User Invitation) | Required | Publisher detail page exists |
| Story 2.2 (Publisher Switcher) | Required | Publisher context to inject |
| Story 2.8 (Activity Log) | Soft | For logging impersonation actions |
| Admin auth middleware | ✅ Done | `RequireRole("admin")` exists |

---

## Implementation Details

### New Context Keys

**File:** `api/internal/middleware/auth.go` (add)

```go
const (
    UserIDKey              contextKey = "user_id"
    UserRoleKey            contextKey = "user_role"
    ImpersonatingKey       contextKey = "is_impersonating"
    ImpersonatedPublisherKey contextKey = "impersonated_publisher_id"
    ImpersonatingAdminKey  contextKey = "impersonating_admin_id"
)
```

### Impersonation Middleware

**File to create:** `api/internal/middleware/impersonation.go`

```go
package middleware

import (
    "context"
    "encoding/json"
    "net/http"
    "time"
)

type ImpersonationData struct {
    PublisherID string    `json:"publisher_id"`
    AdminUserID string    `json:"admin_user_id"`
    StartedAt   time.Time `json:"started_at"`
}

const ImpersonationCookieName = "zmanim_impersonation"

type ImpersonationMiddleware struct {
    cookieSecret []byte
}

func NewImpersonationMiddleware(secret string) *ImpersonationMiddleware {
    return &ImpersonationMiddleware{
        cookieSecret: []byte(secret),
    }
}

func (im *ImpersonationMiddleware) Handler(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        ctx := r.Context()

        // Check for impersonation cookie
        cookie, err := r.Cookie(ImpersonationCookieName)
        if err == nil && cookie.Value != "" {
            // Decode and validate impersonation data
            data, err := im.decodeImpersonation(cookie.Value)
            if err == nil {
                // Verify the current user is still an admin
                currentRole := GetUserRole(ctx)
                if currentRole == "admin" {
                    // Inject impersonation context
                    ctx = context.WithValue(ctx, ImpersonatingKey, true)
                    ctx = context.WithValue(ctx, ImpersonatedPublisherKey, data.PublisherID)
                    ctx = context.WithValue(ctx, ImpersonatingAdminKey, data.AdminUserID)
                }
            }
        }

        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func (im *ImpersonationMiddleware) SetImpersonation(w http.ResponseWriter, data ImpersonationData) error {
    encoded, err := im.encodeImpersonation(data)
    if err != nil {
        return err
    }

    http.SetCookie(w, &http.Cookie{
        Name:     ImpersonationCookieName,
        Value:    encoded,
        Path:     "/",
        MaxAge:   4 * 60 * 60, // 4 hours
        HttpOnly: true,
        Secure:   true,
        SameSite: http.SameSiteStrictMode,
    })
    return nil
}

func (im *ImpersonationMiddleware) ClearImpersonation(w http.ResponseWriter) {
    http.SetCookie(w, &http.Cookie{
        Name:     ImpersonationCookieName,
        Value:    "",
        Path:     "/",
        MaxAge:   -1,
        HttpOnly: true,
        Secure:   true,
        SameSite: http.SameSiteStrictMode,
    })
}

// Helper functions
func IsImpersonating(ctx context.Context) bool {
    if v, ok := ctx.Value(ImpersonatingKey).(bool); ok {
        return v
    }
    return false
}

func GetImpersonatedPublisherID(ctx context.Context) string {
    if id, ok := ctx.Value(ImpersonatedPublisherKey).(string); ok {
        return id
    }
    return ""
}

func GetImpersonatingAdminID(ctx context.Context) string {
    if id, ok := ctx.Value(ImpersonatingAdminKey).(string); ok {
        return id
    }
    return ""
}
```

### Admin Impersonation Handlers

**File:** `api/internal/handlers/admin.go` (add)

```go
// POST /api/admin/impersonate/{publisherId}
func (h *Handlers) AdminStartImpersonation(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    publisherID := chi.URLParam(r, "publisherId")
    adminUserID := middleware.GetUserID(ctx)

    // Validate publisher exists
    publisher, err := h.publisherService.GetPublisherByID(ctx, publisherID)
    if err != nil {
        RespondNotFound(w, r, "Publisher not found")
        return
    }

    // Set impersonation cookie
    data := middleware.ImpersonationData{
        PublisherID: publisherID,
        AdminUserID: adminUserID,
        StartedAt:   time.Now(),
    }

    if err := h.impersonationMiddleware.SetImpersonation(w, data); err != nil {
        RespondInternalError(w, r, "Failed to start impersonation")
        return
    }

    slog.Info("impersonation_started",
        "admin_id", adminUserID,
        "publisher_id", publisherID,
    )

    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "success": true,
        "publisher": publisher,
    })
}

// POST /api/admin/impersonate/exit
func (h *Handlers) AdminExitImpersonation(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    if !middleware.IsImpersonating(ctx) {
        RespondBadRequest(w, r, "Not currently impersonating")
        return
    }

    publisherID := middleware.GetImpersonatedPublisherID(ctx)
    adminUserID := middleware.GetImpersonatingAdminID(ctx)

    h.impersonationMiddleware.ClearImpersonation(w)

    slog.Info("impersonation_ended",
        "admin_id", adminUserID,
        "publisher_id", publisherID,
    )

    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "success": true,
    })
}

// GET /api/admin/impersonate/status
func (h *Handlers) AdminGetImpersonationStatus(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    if !middleware.IsImpersonating(ctx) {
        RespondJSON(w, r, http.StatusOK, map[string]interface{}{
            "is_impersonating": false,
        })
        return
    }

    publisherID := middleware.GetImpersonatedPublisherID(ctx)
    publisher, _ := h.publisherService.GetPublisherByID(ctx, publisherID)

    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "is_impersonating": true,
        "publisher":        publisher,
    })
}
```

### Frontend - Impersonation Banner

**File to create:** `web/components/admin/ImpersonationBanner.tsx`

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function ImpersonationBanner() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ['impersonation-status'],
    queryFn: async () => {
      const res = await fetch('/api/admin/impersonate/status');
      return res.json();
    },
  });

  const exitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/impersonate/exit', { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impersonation-status'] });
      router.push('/admin');
    },
  });

  if (!status?.is_impersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-950 px-4 py-2">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">
            Impersonating: {status.publisher?.name}
          </span>
          <span className="text-yellow-800">
            ({status.publisher?.organization})
          </span>
        </div>
        <button
          onClick={() => exitMutation.mutate()}
          className="flex items-center gap-1 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-sm font-medium"
        >
          <X className="w-4 h-4" />
          Exit Impersonation
        </button>
      </div>
    </div>
  );
}
```

### Frontend - Impersonation Hook

**File to create:** `web/hooks/useImpersonation.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

export function useImpersonation() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ['impersonation-status'],
    queryFn: async () => {
      const res = await fetch('/api/admin/impersonate/status');
      return res.json();
    },
  });

  const startMutation = useMutation({
    mutationFn: async (publisherId: string) => {
      const res = await fetch(`/api/admin/impersonate/${publisherId}`, {
        method: 'POST',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impersonation-status'] });
      router.push('/publisher');
    },
  });

  const exitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/impersonate/exit', { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impersonation-status'] });
      router.push('/admin');
    },
  });

  return {
    isImpersonating: status?.is_impersonating ?? false,
    impersonatedPublisher: status?.publisher ?? null,
    isLoading,
    startImpersonation: startMutation.mutate,
    exitImpersonation: exitMutation.mutate,
  };
}
```

---

## API Endpoints

### POST /api/admin/impersonate/{publisherId}

**Response:**
```json
{
  "success": true,
  "publisher": {
    "id": "uuid",
    "name": "Rabbi Cohen",
    "organization": "Brooklyn Torah Center"
  }
}
```

### POST /api/admin/impersonate/exit

**Response:**
```json
{
  "success": true
}
```

### GET /api/admin/impersonate/status

**Response (not impersonating):**
```json
{
  "is_impersonating": false
}
```

**Response (impersonating):**
```json
{
  "is_impersonating": true,
  "publisher": {
    "id": "uuid",
    "name": "Rabbi Cohen",
    "organization": "Brooklyn Torah Center"
  }
}
```

---

## Implementation Checklist

### Backend Tasks
- [ ] Add new context keys to auth.go
- [ ] Create impersonation middleware
- [ ] Add `AdminStartImpersonation` handler
- [ ] Add `AdminExitImpersonation` handler
- [ ] Add `AdminGetImpersonationStatus` handler
- [ ] Add routes to router
- [ ] Integrate middleware into chain

### Frontend Tasks
- [ ] Create `ImpersonationBanner` component
- [ ] Create `useImpersonation` hook
- [ ] Add banner to root layout
- [ ] Add "Impersonate" button to admin publisher detail page

### Testing
- [ ] Unit test: Impersonation middleware
- [ ] Integration test: Start/exit impersonation
- [ ] E2E test: Full impersonation cycle
- [ ] Security test: Non-admin cannot impersonate
