# Story 8-27: Multi-Publisher Switcher with Cookie Persistence - Technical Design

**Status:** Ready for Development
**Date:** 2025-12-14
**Priority:** Medium

---

## Executive Summary

Implement persistent publisher selection using httpOnly cookies, allowing users with multiple publisher access to maintain their last-selected publisher across sessions without re-selecting on every visit.

---

## Current State Analysis

### Existing Implementation

**File:** `web/providers/PublisherContext.tsx`

Current storage mechanism (line 119):
```typescript
if (typeof window !== 'undefined') {
    localStorage.setItem('selectedPublisherId', id);
}
```

**Problems:**
1. localStorage is browser-specific (no cross-device sync)
2. localStorage can't be read server-side (SSR hydration issues)
3. Not httpOnly (accessible to XSS attacks)
4. Admin impersonation uses sessionStorage (separate mechanism)

### Existing Publisher Switcher

**File:** `web/components/publisher/PublisherSwitcher.tsx`

- Basic dropdown using `usePublisherContext()`
- Shows logo initial + publisher name
- Hidden for single-publisher users
- No cookie integration

---

## Technical Design

### Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Browser       │     │   Next.js SSR    │     │   Go API        │
├─────────────────┤     ├──────────────────┤     ├─────────────────┤
│ PublisherCtx    │────→│ Read cookie in   │────→│ POST /select    │
│ (React)         │     │ layout.tsx       │     │ (set httpOnly   │
│                 │←────│                  │←────│  cookie)        │
│ Cookie:         │     │ Initial state    │     │                 │
│ zmanim_pub_id   │     │ from cookie      │     │ GET /current    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Backend Implementation

#### New Endpoints

**1. POST /api/v1/auth/publisher/select**

Sets httpOnly cookie with selected publisher ID.

```go
// File: api/internal/handlers/publishers.go

type SelectPublisherRequest struct {
    PublisherID string `json:"publisher_id"`
}

type SelectPublisherResponse struct {
    PublisherID string `json:"publisher_id"`
    Name        string `json:"name"`
    LogoURL     string `json:"logo_url,omitempty"`
}

func (h *Handlers) SelectPublisher(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Parse request
    var req SelectPublisherRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondBadRequest(w, r, "Invalid request body")
        return
    }

    // 2. Validate publisher ID against user's access list
    // DEPENDS ON STORY 8-26 BEING COMPLETE
    accessList := middleware.GetPublisherAccessList(ctx)
    isAdmin := middleware.HasRole(ctx, "admin")

    if !isAdmin && !contains(accessList, req.PublisherID) {
        RespondForbidden(w, r, "Access denied to publisher")
        return
    }

    // 3. Get publisher details
    publisherID, _ := strconv.ParseInt(req.PublisherID, 10, 32)
    publisher, err := h.db.Queries.GetPublisherBasic(ctx, int32(publisherID))
    if err != nil {
        RespondNotFound(w, r, "Publisher not found")
        return
    }

    // 4. Set httpOnly cookie
    http.SetCookie(w, &http.Cookie{
        Name:     "zmanim_publisher_id",
        Value:    req.PublisherID,
        Path:     "/",
        MaxAge:   30 * 24 * 60 * 60, // 30 days
        HttpOnly: true,
        Secure:   r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
        SameSite: http.SameSiteLaxMode,
    })

    // 5. Respond
    RespondJSON(w, r, http.StatusOK, SelectPublisherResponse{
        PublisherID: req.PublisherID,
        Name:        publisher.Name,
    })
}
```

**2. GET /api/v1/auth/publisher/current**

Reads cookie and returns current publisher details.

```go
func (h *Handlers) GetCurrentPublisher(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Read cookie
    cookie, err := r.Cookie("zmanim_publisher_id")
    if err != nil {
        // No cookie - return primary publisher
        primaryID := middleware.GetPrimaryPublisherID(ctx)
        if primaryID == "" {
            RespondJSON(w, r, http.StatusOK, map[string]interface{}{
                "publisher": nil,
            })
            return
        }
        // Get primary publisher details...
    }

    // 2. Validate access (cookie might be stale)
    accessList := middleware.GetPublisherAccessList(ctx)
    isAdmin := middleware.HasRole(ctx, "admin")

    if !isAdmin && !contains(accessList, cookie.Value) {
        // Cookie references inaccessible publisher - fall back to primary
        primaryID := middleware.GetPrimaryPublisherID(ctx)
        // Clear stale cookie
        http.SetCookie(w, &http.Cookie{
            Name:     "zmanim_publisher_id",
            Value:    "",
            Path:     "/",
            MaxAge:   -1,
            HttpOnly: true,
        })
        // Return primary...
    }

    // 3. Get publisher details and respond
    // ...
}
```

**3. GET /api/v1/auth/publishers/accessible (Enhanced)**

Add `is_selected` field based on cookie.

```go
type AccessiblePublisher struct {
    ID         string `json:"id"`
    Name       string `json:"name"`
    LogoURL    string `json:"logo_url,omitempty"`
    IsPrimary  bool   `json:"is_primary"`
    IsSelected bool   `json:"is_selected"`
}

type AccessiblePublishersResponse struct {
    Publishers          []AccessiblePublisher `json:"publishers"`
    SelectedPublisherID string                `json:"selected_publisher_id"`
}
```

#### Router Updates

```go
// File: api/cmd/api/main.go

// In auth routes group
r.Post("/publisher/select", h.SelectPublisher)
r.Get("/publisher/current", h.GetCurrentPublisher)
```

### Frontend Implementation

#### Update PublisherContext.tsx

```typescript
// File: web/providers/PublisherContext.tsx

interface PublisherContextType {
  // ... existing fields
  selectPublisher: (id: string) => Promise<void>;  // New: calls API
}

function PublisherProviderInner({ children }: { children: ReactNode }) {
  // ... existing code

  // New: Select publisher via API (sets cookie)
  const selectPublisher = useCallback(async (id: string) => {
    try {
      const getApiToken = () => getToken({ template: JWT_TEMPLATE });
      const api = createApiClient(getApiToken, null);

      const data = await api.post<SelectPublisherResponse>('/publisher/select', {
        body: JSON.stringify({ publisher_id: id }),
      });

      // Update local state
      setSelectedPublisherIdState(id);
      selectedPublisherIdRef.current = id;

      // Invalidate React Query cache
      queryClient.invalidateQueries();

    } catch (err) {
      console.error('Failed to select publisher:', err);
      throw err;
    }
  }, [getToken]);

  // Replace setSelectedPublisherId with selectPublisher
  // Keep localStorage as fallback for SSR hydration
}
```

#### Update Layout for SSR Hydration

```typescript
// File: web/app/layout.tsx

import { cookies } from 'next/headers';

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const publisherIdCookie = cookieStore.get('zmanim_publisher_id');

  return (
    <html>
      <body>
        <PublisherProvider initialPublisherId={publisherIdCookie?.value}>
          {children}
        </PublisherProvider>
      </body>
    </html>
  );
}
```

#### Update PublisherSwitcher Component

```typescript
// File: web/components/publisher/PublisherSwitcher.tsx

export function PublisherSwitcher() {
  const {
    publishers,
    selectedPublisher,
    selectPublisher,  // Use new async method
    isLoading
  } = usePublisherContext();

  const [isSelecting, setIsSelecting] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIsSelecting(true);
    try {
      await selectPublisher(e.target.value);
    } finally {
      setIsSelecting(false);
    }
  };

  // ... rest of component with loading state
}
```

---

## Cookie Specification

| Attribute | Value |
|-----------|-------|
| Name | `zmanim_publisher_id` |
| Value | Publisher ID (string) |
| Path | `/` |
| Max-Age | 2592000 (30 days) |
| HttpOnly | `true` |
| Secure | `true` (production) |
| SameSite | `Lax` |

---

## Implementation Steps

### Phase 1: Backend (2 hours)

1. Add `SelectPublisher` handler
2. Add `GetCurrentPublisher` handler
3. Enhance `GetAccessiblePublishers` response
4. Register new routes
5. Add unit tests

### Phase 2: Frontend Context (1.5 hours)

1. Update `PublisherContext.tsx`:
   - Add `selectPublisher` async method
   - Accept `initialPublisherId` prop
   - Keep localStorage as fallback
2. Update `layout.tsx` for SSR cookie reading
3. Add loading states

### Phase 3: UI Updates (1 hour)

1. Update `PublisherSwitcher.tsx`:
   - Use new async selection method
   - Add loading indicator during selection
   - Handle errors gracefully

### Phase 4: Integration & Testing (1.5 hours)

1. Test cookie persistence across sessions
2. Test SSR hydration (no flash)
3. Test admin impersonation override
4. Test single-publisher user (no switcher)
5. Test invalid cookie fallback

---

## Test Plan

### Unit Tests (Backend)

```go
func TestSelectPublisher_SetsCookie(t *testing.T)
func TestSelectPublisher_ValidatesAccess(t *testing.T)
func TestGetCurrentPublisher_ReadsCookie(t *testing.T)
func TestGetCurrentPublisher_FallsBackToPrimary(t *testing.T)
```

### E2E Tests

```typescript
test('cookie persists across page reloads', async ({ page }) => {
  await page.goto('/publisher/dashboard');
  await page.selectOption('#publisher-switcher', 'pub-2');
  await page.reload();
  expect(await page.locator('#publisher-switcher').inputValue()).toBe('pub-2');
});

test('invalid cookie falls back to primary', async ({ page, context }) => {
  await context.addCookies([{
    name: 'zmanim_publisher_id',
    value: '99999',
    domain: 'localhost'
  }]);
  await page.goto('/publisher/dashboard');
  // Should show primary publisher, not 99999
});
```

---

## Migration Strategy

1. Deploy backend changes (new endpoints)
2. Deploy frontend changes (new context logic)
3. Old localStorage values continue to work (fallback)
4. New selections use cookie + API
5. After 30 days, all users will have cookie-based persistence

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `api/internal/handlers/publishers.go` | Add SelectPublisher, GetCurrentPublisher |
| `api/cmd/api/main.go` | Register new routes |
| `web/providers/PublisherContext.tsx` | Add selectPublisher, initialPublisherId |
| `web/app/layout.tsx` | Read cookie for SSR |
| `web/components/publisher/PublisherSwitcher.tsx` | Use async selection |

---

## Dependencies

- **Story 8-26** (Publisher Access Validation) - REQUIRED
  - Must validate access before setting cookie

---

## Estimated Effort

| Task | Points |
|------|--------|
| Backend endpoints | 2 |
| Frontend context update | 2 |
| SSR integration | 1 |
| Testing | 1 |
| Total | **5 points** |

---

## Security Considerations

1. **httpOnly cookie** - Not accessible to JavaScript (XSS protection)
2. **Validation on set** - Can't set cookie for unauthorized publisher
3. **Validation on read** - Stale cookies rejected gracefully
4. **Admin impersonation** - sessionStorage takes precedence
