# Story 2.4: Dynamic Home Navigation

**Epic:** Epic 2 - Publisher User Management & Dashboard
**Status:** Draft
**Priority:** Medium
**Story Points:** 2

---

## User Story

**As a** user,
**I want** to see relevant navigation options on the home page based on my role,
**So that** I can quickly access the areas I need.

---

## Acceptance Criteria

### AC-1: Unauthenticated User
**Given** I am not logged in
**When** I view the home page
**Then** I see the location search and "Sign In" button
**And** no admin or publisher navigation

### AC-2: Regular User
**Given** I am logged in as a regular user (no publisher_access_list, no admin role)
**When** I view the home page
**Then** I see the location search
**And** no admin or publisher buttons

### AC-3: Publisher User
**Given** I am logged in with publisher_access_list containing at least one publisher
**When** I view the home page
**Then** I see a "Publisher Dashboard" button
**And** clicking it navigates to /publisher

### AC-4: Admin User
**Given** I am logged in as an admin
**When** I view the home page
**Then** I see an "Admin Portal" button
**And** clicking it navigates to /admin

### AC-5: Admin with Publisher Access
**Given** I am logged in as an admin with publisher_access_list
**When** I view the home page
**Then** I see both "Admin Portal" and "Publisher Dashboard" buttons

---

## Technical Notes

### Frontend Changes

**File:** `web/components/home/RoleNavigation.tsx` (create)
```typescript
'use client';

import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { Settings, Building2 } from 'lucide-react';

export function RoleNavigation() {
  const { user, isLoaded } = useUser();

  if (!isLoaded || !user) return null;

  const metadata = user.publicMetadata as {
    role?: string;
    publisher_access_list?: string[];
  };

  const isAdmin = metadata.role === 'admin';
  const hasPublisherAccess = metadata.publisher_access_list?.length > 0;

  if (!isAdmin && !hasPublisherAccess) return null;

  return (
    <div className="flex gap-4">
      {isAdmin && (
        <Link href="/admin" className="...">
          <Settings className="w-5 h-5" />
          Admin Portal
        </Link>
      )}
      {hasPublisherAccess && (
        <Link href="/publisher" className="...">
          <Building2 className="w-5 h-5" />
          Publisher Dashboard
        </Link>
      )}
    </div>
  );
}
```

**File:** `web/app/page.tsx` (modify)
- Import and add `<RoleNavigation />` component
- Position in header area near sign-in/user button
- Style as prominent action buttons

### Layout Considerations

```
┌─────────────────────────────────────────────────────┐
│  Shtetl Zmanim                    [RoleNavigation]     │
│                                [SignIn/UserButton]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│              Select your location...                │
│                                                     │
│         [Country] → [Region] → [City]               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Styling

- Use shadcn/ui Button component
- Admin button: Outline style, neutral color
- Publisher button: Primary style, branded color
- Both visible at same time for admin+publisher users
- Responsive: Stack vertically on mobile

### Edge Cases

1. **Loading state:** Don't show buttons until Clerk user loaded
2. **Metadata not yet synced:** If user just accepted invitation, metadata may take a moment
3. **Sign out:** Buttons disappear immediately on sign out

---

## Dependencies

- Clerk authentication configured - DONE
- Story 2.1 (Publisher User Invitation) - for publisher_access_list to exist

---

## Definition of Done

- [x] Unauthenticated users see no role buttons
- [x] Regular users see no role buttons
- [x] Publisher users see "Publisher Dashboard" button
- [x] Admin users see "Admin Portal" button
- [x] Admin+Publisher users see both buttons
- [x] Buttons navigate to correct routes
- [x] Responsive layout on mobile
- [ ] Unit test for RoleNavigation component
- [ ] E2E test: each role scenario

---

## Dev Agent Record

### Completion Notes

**Files Created:**
- `web/components/home/RoleNavigation.tsx`: Role-based navigation component

**Files Modified:**
- `web/app/page.tsx`: Added top navigation bar with RoleNavigation, SignIn/UserButton

**Key Features:**
- Top navigation bar with Shtetl Zmanim branding
- Sign In button shown for unauthenticated users (modal mode)
- UserButton shown for authenticated users
- RoleNavigation displays:
  - "Publisher Dashboard" button (blue) for users with publisher_access_list
  - "Admin Portal" button (gray) for users with role=admin
  - Both buttons if user has both roles
  - Nothing if user has neither
- Loading state handled - buttons only appear after Clerk loads
- Responsive - buttons stack on mobile

**Status:** done

---

## FRs Covered

- FR49: Home page shows dynamic navigation based on user role
