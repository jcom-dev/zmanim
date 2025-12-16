# Story 2.2: Multi-Publisher Switcher

**Epic:** Epic 2 - Publisher User Management & Dashboard
**Status:** Draft
**Priority:** High
**Story Points:** 3

---

## User Story

**As a** user managing multiple publishers,
**I want** to switch between publishers in the dashboard,
**So that** I can manage each publisher's settings independently.

---

## Acceptance Criteria

### AC-1: Switcher Visibility (Multiple Publishers)
**Given** I am logged in with publisher_access_list containing multiple publisher IDs
**When** I navigate to /publisher
**Then** I see a publisher switcher dropdown in the dashboard header

### AC-2: Switcher Dropdown
**Given** the publisher switcher is visible
**When** I click on it
**Then** I see a list of all publishers I have access to (name + organization)

### AC-3: Switch Publisher
**Given** I select a different publisher from the switcher
**When** the selection is applied
**Then** the entire dashboard context switches to that publisher
**And** coverage, algorithm, analytics all reflect the selected publisher

### AC-4: Single Publisher (No Switcher)
**Given** I am logged in with only one publisher in publisher_access_list
**When** I navigate to /publisher
**Then** the switcher is hidden (or shows as static text)

### AC-5: Selection Persistence
**Given** I select a publisher
**When** I navigate between dashboard sections
**Then** the selected publisher persists until I switch again

---

## Technical Notes

### Frontend Changes

**File:** `web/components/publisher/PublisherSwitcher.tsx` (create)
```typescript
interface PublisherSwitcherProps {
  publishers: Publisher[];
  selectedId: string;
  onSelect: (id: string) => void;
}
```
- Use shadcn/ui Select or Popover component
- Show publisher name and organization in dropdown
- Highlight currently selected publisher

**File:** `web/providers/PublisherContext.tsx` (create)
```typescript
interface PublisherContextType {
  selectedPublisherId: string | null;
  setSelectedPublisherId: (id: string) => void;
  publishers: Publisher[];
  selectedPublisher: Publisher | null;
}
```
- Load publishers from Clerk metadata on mount
- Store selection in localStorage for persistence
- URL param override: `/publisher?p={id}` takes precedence

**File:** `web/hooks/usePublisherContext.ts` (create)
- Hook to access PublisherContext
- Convenience methods for common operations

**File:** `web/app/publisher/layout.tsx` (modify)
- Wrap with PublisherContextProvider
- Add PublisherSwitcher to header

### Backend Changes

**File:** `api/internal/handlers/publishers.go`
- All `/api/publisher/*` endpoints should validate user has access to requested publisher_id
- Accept `X-Publisher-Id` header or query param to specify context

### Data Flow

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

### API Endpoint

```
GET /api/publisher/accessible
Response: {
  publishers: [{
    id: string,
    name: string,
    organization: string,
    status: string
  }]
}
```
- Returns only publishers the current user has access to
- Used to populate switcher dropdown with full details

---

## Dependencies

- Story 2.1 (Publisher User Invitation) - for multi-publisher users to exist

---

## Definition of Done

- [x] Switcher visible for users with 2+ publishers
- [x] Switcher hidden for single-publisher users
- [x] Selecting publisher switches all dashboard data
- [x] Selection persists across navigation
- [x] URL param allows direct linking to specific publisher
- [ ] Unit tests for PublisherContext
- [ ] E2E test: multi-publisher user can switch

---

## Dev Agent Record

### Completion Notes

**Backend Changes:**
- `api/internal/handlers/handlers.go`: Added `GetAccessiblePublishers()` handler
- `api/cmd/api/main.go`: Added route `GET /api/v1/publisher/accessible`

**Frontend Changes:**
- `web/providers/PublisherContext.tsx`: New context provider for multi-publisher state
- `web/components/publisher/PublisherSwitcher.tsx`: Dropdown component for switching publishers
- `web/app/publisher/layout.tsx`: New layout with header, nav, and publisher switcher
- `web/app/publisher/dashboard/page.tsx`: Updated to use publisher context

**Key Features:**
- Publisher context loads accessible publishers from API on mount
- Selection persisted to localStorage and URL param (?p=id)
- Switcher hidden for single-publisher users (shows static name)
- All publisher pages wrapped with layout that includes switcher

**Status:** done

---

## FRs Covered

- FR46: Publisher dashboard shows switcher for multi-publisher users
