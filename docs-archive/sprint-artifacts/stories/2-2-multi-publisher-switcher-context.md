# Story Context: 2.2 Multi-Publisher Switcher

**Generated:** 2025-11-26
**Story:** Multi-Publisher Switcher
**Epic:** Epic 2 - Publisher User Management & Dashboard

---

## Relevant Documentation

### From Tech Spec (docs/sprint-artifacts/tech-spec-epic-2.md)

**FR46:** Publisher dashboard shows switcher for multi-publisher users

**Data Flow:**
```
User Login → Clerk provides publicMetadata
    │
    └── Extract publisher_access_list
        │
        └── Fetch publisher details for each ID
            │
            └── Populate PublisherContext
                │
                └── Switcher shows list
                    │
                    └── Selection stored in:
                        ├── URL param (?p=...)
                        └── localStorage (fallback)
```

### From Architecture (docs/architecture.md)

**Frontend State Management:**
- TanStack Query for server state
- React Context for client state (like selected publisher)

**Project Structure:**
```
web/
├── components/
│   ├── publisher/           # Publisher components
│   │   ├── AlgorithmEditor.tsx
│   │   └── CitySelector.tsx
├── hooks/                   # Custom React hooks
├── providers/               # React context providers
│   └── QueryProvider.tsx
```

---

## Existing Code References

### Frontend - Publisher Pages

**File:** `web/app/publisher/dashboard/page.tsx`
- Current publisher dashboard
- Will need to consume PublisherContext

**File:** `web/app/publisher/algorithm/page.tsx`
- Algorithm editor page
- Will need to use selected publisher from context

**File:** `web/app/publisher/profile/page.tsx`
- Publisher profile page
- Will need to use selected publisher from context

### Frontend - Layout

**File:** `web/app/layout.tsx`
- Root layout with providers
- QueryProvider already configured

**Pattern for adding providers:**
```typescript
// Current pattern in layout.tsx
export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html>
        <body>
          <QueryProvider>
            {children}
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

### Clerk User Hook

**Usage pattern:**
```typescript
import { useUser } from '@clerk/nextjs';

function Component() {
  const { user, isLoaded } = useUser();

  // Access metadata
  const metadata = user?.publicMetadata as {
    role?: string;
    publisher_access_list?: string[];
  };

  const publisherIds = metadata?.publisher_access_list || [];
}
```

### Existing UI Components

**File:** `web/components/ui/` (shadcn/ui)
- Select component available for dropdown
- Popover component for more complex selector

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Story 2.1 (User Invitation) | Required | Multi-publisher users must exist |
| Clerk useUser hook | ✅ Done | `@clerk/nextjs` configured |
| shadcn/ui components | ✅ Done | Select, Popover available |
| TanStack Query | ✅ Done | For fetching publisher details |

---

## Component Specifications

### PublisherContext

**File to create:** `web/providers/PublisherContext.tsx`

```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';

interface Publisher {
  id: string;
  name: string;
  organization: string;
  status: string;
}

interface PublisherContextType {
  selectedPublisherId: string | null;
  setSelectedPublisherId: (id: string) => void;
  publishers: Publisher[];
  selectedPublisher: Publisher | null;
  isLoading: boolean;
}

const PublisherContext = createContext<PublisherContextType | null>(null);

export function PublisherProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [selectedPublisherId, setSelectedPublisherId] = useState<string | null>(null);

  // Extract publisher IDs from Clerk metadata
  const publisherIds = (user?.publicMetadata as any)?.publisher_access_list || [];

  // Fetch publisher details
  useEffect(() => {
    if (publisherIds.length > 0) {
      fetchPublisherDetails(publisherIds).then(setPublishers);
    }
  }, [publisherIds.join(',')]);

  // Initialize selection from URL or localStorage
  useEffect(() => {
    const urlPublisherId = searchParams.get('p');
    const storedId = localStorage.getItem('selectedPublisherId');

    if (urlPublisherId && publisherIds.includes(urlPublisherId)) {
      setSelectedPublisherId(urlPublisherId);
    } else if (storedId && publisherIds.includes(storedId)) {
      setSelectedPublisherId(storedId);
    } else if (publisherIds.length > 0) {
      setSelectedPublisherId(publisherIds[0]);
    }
  }, [publisherIds, searchParams]);

  // Persist selection
  const handleSetPublisher = (id: string) => {
    setSelectedPublisherId(id);
    localStorage.setItem('selectedPublisherId', id);
    // Optionally update URL
    router.replace(`?p=${id}`);
  };

  const selectedPublisher = publishers.find(p => p.id === selectedPublisherId) || null;

  return (
    <PublisherContext.Provider value={{
      selectedPublisherId,
      setSelectedPublisherId: handleSetPublisher,
      publishers,
      selectedPublisher,
      isLoading: !isLoaded || (publisherIds.length > 0 && publishers.length === 0),
    }}>
      {children}
    </PublisherContext.Provider>
  );
}

export function usePublisherContext() {
  const context = useContext(PublisherContext);
  if (!context) {
    throw new Error('usePublisherContext must be used within PublisherProvider');
  }
  return context;
}
```

### PublisherSwitcher Component

**File to create:** `web/components/publisher/PublisherSwitcher.tsx`

```typescript
'use client';

import { usePublisherContext } from '@/providers/PublisherContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2 } from 'lucide-react';

export function PublisherSwitcher() {
  const { publishers, selectedPublisherId, setSelectedPublisherId, isLoading } = usePublisherContext();

  // Don't show switcher for single publisher
  if (publishers.length <= 1) {
    return selectedPublisher ? (
      <div className="flex items-center gap-2 text-sm">
        <Building2 className="w-4 h-4" />
        <span>{selectedPublisher.name}</span>
      </div>
    ) : null;
  }

  return (
    <Select value={selectedPublisherId || ''} onValueChange={setSelectedPublisherId}>
      <SelectTrigger className="w-[250px]">
        <Building2 className="w-4 h-4 mr-2" />
        <SelectValue placeholder="Select publisher" />
      </SelectTrigger>
      <SelectContent>
        {publishers.map((pub) => (
          <SelectItem key={pub.id} value={pub.id}>
            <div>
              <div className="font-medium">{pub.name}</div>
              <div className="text-xs text-muted-foreground">{pub.organization}</div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

---

## API Endpoint Needed

### GET /api/publisher/accessible

Returns publishers the current user has access to.

**Response:**
```json
{
  "publishers": [
    {
      "id": "uuid-1",
      "name": "Rabbi Cohen",
      "organization": "Brooklyn Torah Center",
      "status": "verified"
    },
    {
      "id": "uuid-2",
      "name": "Rabbi Levy",
      "organization": "Queens Jewish Community",
      "status": "verified"
    }
  ]
}
```

**Backend implementation:**
```go
func (h *Handlers) GetAccessiblePublishers(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    userID := middleware.GetUserID(ctx)

    // Get user's publisher_access_list from Clerk
    user, err := h.clerkService.GetUser(ctx, userID)
    if err != nil {
        RespondInternalError(w, r, "Failed to get user")
        return
    }

    publisherIDs := user.PublicMetadata["publisher_access_list"].([]string)

    // Fetch publisher details
    publishers, err := h.publisherService.GetPublishersByIDs(ctx, publisherIDs)
    if err != nil {
        RespondInternalError(w, r, "Failed to get publishers")
        return
    }

    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "publishers": publishers,
    })
}
```

---

## Implementation Checklist

### Frontend Tasks
- [ ] Create `PublisherContext` provider
- [ ] Create `usePublisherContext` hook
- [ ] Create `PublisherSwitcher` component
- [ ] Wrap `/publisher` layout with `PublisherProvider`
- [ ] Add switcher to publisher dashboard header
- [ ] Update all publisher pages to use context for publisher ID

### Backend Tasks
- [ ] Add `GetUser` method to ClerkService
- [ ] Create `GetAccessiblePublishers` handler
- [ ] Add route: GET /api/publisher/accessible

### Testing
- [ ] Unit test: PublisherContext state management
- [ ] E2E test: Multi-publisher user can switch between publishers
- [ ] E2E test: Single-publisher user doesn't see switcher
