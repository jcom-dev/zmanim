# Story 2.12: User Profile Dropdown

**Epic:** Epic 2 - Publisher User Management & Dashboard
**Status:** Drafted
**Priority:** Medium
**Sprint Change:** Added 2025-11-26

---

## User Story

**As a** logged-in user,
**I want** to see my profile information in a dropdown menu,
**So that** I can view my account details and sign out.

---

## Acceptance Criteria

### AC1: Profile Icon Display
**Given** I am logged in
**When** I view any page
**Then** I see a profile icon/avatar in the top-right header
**And** the icon shows my initials or profile picture (if set)

### AC2: Dropdown Content
**Given** I click the profile icon
**When** the dropdown opens
**Then** I see:
  - My display name (from Clerk)
  - My email address
  - My role badge (Admin / Publisher / User)
  - Divider line
  - List of publishers I have access to (if any)
  - Divider line
  - "Change Password" link
  - "Sign Out" button

### AC3: Publisher List Display
**Given** I have access to one or more publishers
**When** I view the dropdown
**Then** I see all publisher names listed
**And** each publisher name is a link to `/publisher?p={id}`

**Given** I have no publisher access
**When** I view the dropdown
**Then** I don't see the publishers section

### AC4: Role Badge Styling
**Given** I am an admin
**When** I view the dropdown
**Then** I see a badge with "Admin" in primary color

**Given** I am a publisher (but not admin)
**When** I view the dropdown
**Then** I see a badge with "Publisher" in secondary color

**Given** I am a regular user
**When** I view the dropdown
**Then** I see a badge with "User" in muted color

### AC5: Change Password Flow
**Given** I click "Change Password"
**When** the action is triggered
**Then** I see a loading indicator
**And** a password reset email is sent to my email via Resend
**And** I see a success toast: "Password reset email sent! Check your inbox."
**And** the dropdown closes

### AC6: Sign Out Flow
**Given** I click "Sign Out"
**When** I confirm (or direct action)
**Then** I am logged out via Clerk
**And** I am redirected to the home page
**And** my session is cleared

### AC7: Unauthenticated State
**Given** I am not logged in
**When** I view the header
**Then** I see a "Sign In" button instead of profile dropdown
**And** clicking it navigates to `/sign-in`

### AC8: Responsive Design
**Given** I am on mobile
**When** I tap the profile icon
**Then** the dropdown appears correctly positioned
**And** touch targets are at least 44x44px

---

## Technical Notes

### New Files

```
web/components/shared/ProfileDropdown.tsx   # Main dropdown component
web/components/shared/UserAvatar.tsx        # Avatar with initials/image
```

### Component Implementation

```tsx
// web/components/shared/ProfileDropdown.tsx
"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, KeyRound, Building2 } from "lucide-react";

interface Publisher {
    id: string;
    name: string;
}

export function ProfileDropdown() {
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();
    const router = useRouter();
    const [publishers, setPublishers] = useState<Publisher[]>([]);
    const [isResettingPassword, setIsResettingPassword] = useState(false);

    const role = user?.publicMetadata?.role as string || "user";
    const publisherAccessList = user?.publicMetadata?.publisher_access_list as string[] || [];

    useEffect(() => {
        if (publisherAccessList.length > 0) {
            // Fetch publisher names from API
            fetchPublisherNames(publisherAccessList);
        }
    }, [publisherAccessList]);

    const handlePasswordReset = async () => {
        setIsResettingPassword(true);
        try {
            const response = await fetch("/api/user/request-password-reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: user?.primaryEmailAddress?.emailAddress }),
            });
            if (response.ok) {
                toast.success("Password reset email sent! Check your inbox.");
            }
        } catch (error) {
            toast.error("Failed to send password reset email");
        } finally {
            setIsResettingPassword(false);
        }
    };

    const handleSignOut = () => {
        signOut(() => router.push("/"));
    };

    if (!isLoaded) return null;

    if (!user) {
        return (
            <Button variant="outline" onClick={() => router.push("/sign-in")}>
                Sign In
            </Button>
        );
    }

    const initials = user.firstName && user.lastName
        ? `${user.firstName[0]}${user.lastName[0]}`
        : user.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() || "?";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={user.imageUrl} alt={user.fullName || ""} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end">
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{user.fullName || "User"}</p>
                        <p className="text-xs text-muted-foreground">
                            {user.primaryEmailAddress?.emailAddress}
                        </p>
                        <RoleBadge role={role} />
                    </div>
                </DropdownMenuLabel>

                {publishers.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                            Publishers
                        </DropdownMenuLabel>
                        {publishers.map((pub) => (
                            <DropdownMenuItem
                                key={pub.id}
                                onClick={() => router.push(`/publisher?p=${pub.id}`)}
                            >
                                <Building2 className="mr-2 h-4 w-4" />
                                {pub.name}
                            </DropdownMenuItem>
                        ))}
                    </>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    onClick={handlePasswordReset}
                    disabled={isResettingPassword}
                >
                    <KeyRound className="mr-2 h-4 w-4" />
                    {isResettingPassword ? "Sending..." : "Change Password"}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function RoleBadge({ role }: { role: string }) {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
        admin: "default",
        publisher: "secondary",
        user: "outline",
    };
    return (
        <Badge variant={variants[role] || "outline"} className="mt-1 w-fit">
            {role.charAt(0).toUpperCase() + role.slice(1)}
        </Badge>
    );
}
```

### Header Integration

Update the layout or header component to include the dropdown:

```tsx
// In header/navigation component
import { ProfileDropdown } from "@/components/shared/ProfileDropdown";

export function Header() {
    return (
        <header className="...">
            <nav>
                {/* ... other nav items */}
            </nav>
            <div className="flex items-center gap-4">
                <ProfileDropdown />
            </div>
        </header>
    );
}
```

### API Endpoint

```
POST /api/user/request-password-reset
Headers: Authorization: Bearer {clerk-token}
Body: { "email": "user@example.com" }
Response: { "success": true, "message": "Password reset email sent" }
```

### Password Reset Token Flow

1. User clicks "Change Password" in dropdown
2. Frontend calls `/api/user/request-password-reset`
3. Backend generates secure reset token with 1-hour expiry
4. Backend calls `emailService.SendPasswordReset(email, resetURL)`
5. User receives email with reset link
6. Reset link goes to Clerk's password reset flow or custom page

### Publisher Names Fetch

```tsx
async function fetchPublisherNames(ids: string[]): Promise<Publisher[]> {
    const response = await fetch(`/api/publishers/names?ids=${ids.join(",")}`);
    const data = await response.json();
    return data.publishers;
}
```

---

## Dependencies

- Story 2.11: Email Service Integration (for password reset)

## Dependent Stories

- None

---

## Definition of Done

- [ ] ProfileDropdown component implemented
- [ ] Shows user name, email, role
- [ ] Shows publisher list for publisher users
- [ ] Change Password triggers email via Resend
- [ ] Sign Out works correctly
- [ ] Shows Sign In button when not logged in
- [ ] Integrated into main layout/header
- [ ] Mobile responsive with proper touch targets
- [ ] Avatar shows initials or profile image

---

## FRs Covered

| FR | Description |
|----|-------------|
| FR63 | User can view profile info in header dropdown |
| FR64 | User can sign out from dropdown |
| FR65 | User can request password reset from dropdown |

---

_Sprint Change Addition: 2025-11-26_
