'use client';

import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { Settings, Building2, UserPlus } from 'lucide-react';
import type { ClerkPublicMetadata } from '@/types/clerk';
import { isAdmin as checkIsAdmin, hasPublisherAccess as checkHasPublisherAccess } from '@/types/clerk';

export function RoleNavigation() {
  const { user, isLoaded } = useUser();

  if (!isLoaded || !user) return null;

  const metadata = user.publicMetadata as ClerkPublicMetadata;
  const isAdmin = checkIsAdmin(metadata);
  const hasPublisherAccess = checkHasPublisherAccess(metadata);

  // Show "Become a Publisher" for signed-in users without publisher access
  const showBecomePublisher = !isAdmin && !hasPublisherAccess;

  return (
    <div className="flex gap-3">
      {showBecomePublisher && (
        <Link
          href="/register"
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-primary-foreground rounded-lg font-medium transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Become a Publisher
        </Link>
      )}
      {hasPublisherAccess && (
        <Link
          href="/publisher/dashboard"
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
        >
          <Building2 className="w-4 h-4" />
          Publisher Dashboard
        </Link>
      )}
      {isAdmin && (
        <Link
          href="/admin"
          className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-primary-foreground rounded-lg font-medium transition-colors"
        >
          <Settings className="w-4 h-4" />
          Admin Portal
        </Link>
      )}
    </div>
  );
}
