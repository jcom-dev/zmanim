# Story Context: 2.4 Dynamic Home Navigation

**Generated:** 2025-11-26
**Story:** Dynamic Home Navigation
**Epic:** Epic 2 - Publisher User Management & Dashboard

---

## Relevant Documentation

### From Tech Spec (docs/sprint-artifacts/tech-spec-epic-2.md)

**FR49:** Home page shows dynamic navigation based on user role

**Role-Based Visibility:**
| User State | Buttons Shown |
|------------|---------------|
| Unauthenticated | None (just Sign In) |
| Regular user (no publisher access) | None |
| Publisher user | "Publisher Dashboard" |
| Admin user | "Admin Portal" |
| Admin + Publisher | Both buttons |

---

## Existing Code References

### Frontend - Home Page

**File:** `web/app/page.tsx`

Current structure (simplified):
```typescript
export default function Home() {
  // State for location selection
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  // ...

  return (
    <main className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold text-white mb-3">
              Shtetl Zmanim
            </h1>
            <p className="text-lg text-slate-400">
              Multi-Publisher Zmanim Platform
            </p>
            {/* ADD ROLE NAVIGATION HERE */}
          </div>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      {/* ... */}

      {/* Main Content - Location Selection */}
      {/* ... */}

      {/* Footer */}
      {/* ... */}
    </main>
  );
}
```

### Clerk Components

**Available from `@clerk/nextjs`:**
```typescript
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
  useUser
} from '@clerk/nextjs';
```

### Existing Sign-In Pages

**File:** `web/app/sign-in/[[...sign-in]]/page.tsx`
- Clerk sign-in page already configured

**File:** `web/app/sign-out/page.tsx`
- Sign-out handling

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Story 2.1 (User Invitation) | Soft | For publisher_access_list to exist |
| Clerk configured | ✅ Done | `@clerk/nextjs` working |
| Admin role exists | ✅ Done | Set in Clerk metadata |

---

## Component Implementation

### RoleNavigation Component

**File to create:** `web/components/home/RoleNavigation.tsx`

```typescript
'use client';

import { useUser, SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { Settings, Building2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UserMetadata {
  role?: 'user' | 'publisher' | 'admin';
  publisher_access_list?: string[];
}

export function RoleNavigation() {
  const { user, isLoaded } = useUser();

  // Skeleton while loading
  if (!isLoaded) {
    return (
      <div className="flex items-center gap-4">
        <div className="w-24 h-10 bg-slate-700 animate-pulse rounded" />
      </div>
    );
  }

  const metadata = (user?.publicMetadata || {}) as UserMetadata;
  const isAdmin = metadata.role === 'admin';
  const hasPublisherAccess = (metadata.publisher_access_list?.length || 0) > 0;

  return (
    <div className="flex items-center gap-4">
      {/* Role-based navigation buttons */}
      <SignedIn>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Admin Portal
              </Link>
            </Button>
          )}

          {hasPublisherAccess && (
            <Button asChild variant="default" size="sm">
              <Link href="/publisher" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Publisher Dashboard
              </Link>
            </Button>
          )}

          <UserButton afterSignOutUrl="/" />
        </div>
      </SignedIn>

      {/* Sign in button for unauthenticated users */}
      <SignedOut>
        <SignInButton mode="modal">
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <LogIn className="w-4 h-4" />
            Sign In
          </Button>
        </SignInButton>
      </SignedOut>
    </div>
  );
}
```

### Updated Home Page Header

**File:** `web/app/page.tsx` (modify header section)

```typescript
import { RoleNavigation } from '@/components/home/RoleNavigation';

export default function Home() {
  // ... existing state ...

  return (
    <main className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="container mx-auto px-4 py-6">
          {/* Top bar with navigation */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">Shtetl Zmanim</h1>
            <RoleNavigation />
          </div>

          {/* Hero section */}
          <div className="text-center max-w-3xl mx-auto py-6">
            <p className="text-lg text-slate-400">
              Multi-Publisher Zmanim Platform
            </p>
            <p className="text-slate-500 mt-2">
              Select your location to view prayer times from local authorities
            </p>
          </div>
        </div>
      </div>

      {/* Rest of page... */}
    </main>
  );
}
```

---

## Layout Visualization

### Desktop Layout
```
┌─────────────────────────────────────────────────────────────┐
│  Shtetl Zmanim              [Admin Portal] [Publisher] [User]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              Multi-Publisher Zmanim Platform                │
│     Select your location to view prayer times...            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Mobile Layout (Responsive)
```
┌─────────────────────────────┐
│  Shtetl Zmanim         [User]  │
├─────────────────────────────┤
│  [Admin] [Publisher]        │
├─────────────────────────────┤
│                             │
│   Multi-Publisher Zmanim    │
│   Platform                  │
│                             │
└─────────────────────────────┘
```

---

## Testing Scenarios

| Scenario | User State | Expected |
|----------|------------|----------|
| 1 | Not logged in | "Sign In" button only |
| 2 | Logged in, no special roles | UserButton only (no nav buttons) |
| 3 | Logged in, publisher_access_list has items | "Publisher Dashboard" + UserButton |
| 4 | Logged in, role = 'admin' | "Admin Portal" + UserButton |
| 5 | Logged in, admin + publisher_access_list | Both buttons + UserButton |

---

## Implementation Checklist

### Frontend Tasks
- [ ] Create `RoleNavigation` component
- [ ] Update home page to include `RoleNavigation`
- [ ] Add responsive styles for mobile
- [ ] Ensure loading state doesn't flash

### Testing
- [ ] Unit test: RoleNavigation renders correctly for each user state
- [ ] E2E test: Unauthenticated user flow
- [ ] E2E test: Publisher user sees correct button
- [ ] E2E test: Admin user sees correct button
- [ ] E2E test: Admin+Publisher sees both buttons
