'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useApi } from '@/lib/api-client';
import type { ClerkPublicMetadata } from '@/types/clerk';

interface Publisher {
  id: string;
  name: string;
}

export function ProfileDropdown() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const api = useApi();
  const router = useRouter();
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const metadata = user?.publicMetadata as ClerkPublicMetadata;
  const isAdmin = metadata?.is_admin === true;
  const publisherAccessList = metadata?.publisher_access_list || [];
  const hasPublisherAccess = publisherAccessList.length > 0;

  const fetchPublisherNames = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setPublishers([]);
      return;
    }

    try {
      const data = await api.public.get<{ publishers: Publisher[] }>(`/publishers/names?ids=${ids.join(',')}`);
      setPublishers(data?.publishers || []);
    } catch {
      // Silently fail - publisher names are optional UI enhancement
    }
  }, [api]);

  useEffect(() => {
    if (publisherAccessList.length > 0) {
      fetchPublisherNames(publisherAccessList);
    }
  }, [publisherAccessList, fetchPublisherNames]);

  const handlePasswordReset = async () => {
    if (!user?.primaryEmailAddress?.emailAddress) return;

    setIsResettingPassword(true);
    try {
      await api.post('/user/request-password-reset', {
        body: JSON.stringify({ email: user.primaryEmailAddress.emailAddress }),
      });
      alert('Password reset email sent! Check your inbox.');
    } catch {
      alert('Failed to send password reset email. Please try again.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSignOut = () => {
    signOut(() => router.push('/'));
  };

  if (!isLoaded) return null;

  if (!user) {
    return (
      <Button variant="outline" onClick={() => router.push('/sign-in')}>
        Sign In
      </Button>
    );
  }

  const initials =
    user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() || '?';

  const getRoleBadge = (): { label: string; variant: 'default' | 'secondary' | 'outline-solid' } => {
    if (isAdmin) return { label: 'Admin', variant: 'default' };
    if (hasPublisherAccess) return { label: 'Publisher', variant: 'secondary' };
    return { label: 'User', variant: 'outline-solid' };
  };

  const roleBadge = getRoleBadge();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.imageUrl} alt={user.fullName || ''} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.fullName || 'User'}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.primaryEmailAddress?.emailAddress}</p>
            <Badge variant={roleBadge.variant} className="mt-2 w-fit">
              {roleBadge.label}
            </Badge>
          </div>
        </DropdownMenuLabel>

        {publishers.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Publishers</DropdownMenuLabel>
            {publishers.map((pub) => (
              <DropdownMenuItem key={pub.id} onClick={() => router.push(`/publisher/dashboard?p=${pub.id}`)}>
                <svg
                  className="w-4 h-4 mr-2 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                {pub.name}
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handlePasswordReset} disabled={isResettingPassword}>
          <svg className="w-4 h-4 mr-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
          {isResettingPassword ? 'Sending...' : 'Change Password'}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleSignOut}>
          <svg className="w-4 h-4 mr-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
