'use client';

import { useUser } from '@clerk/nextjs';

// User roles interface matching the dual-role metadata structure
export interface UserRoles {
  isAdmin: boolean;
  hasPublisherAccess: boolean;
  publisherAccessList: string[];
  // Convenience: user has both admin and publisher access
  isDualRole: boolean;
  // Loading state
  isLoaded: boolean;
}

/**
 * Hook to get the current user's roles from Clerk metadata
 *
 * The metadata structure:
 * - is_admin: boolean - indicates admin role
 * - publisher_access_list: string[] - list of publisher IDs user has access to
 */
export function useUserRoles(): UserRoles {
  const { user, isLoaded } = useUser();

  if (!isLoaded || !user) {
    return {
      isAdmin: false,
      hasPublisherAccess: false,
      publisherAccessList: [],
      isDualRole: false,
      isLoaded,
    };
  }

  const metadata = user.publicMetadata || {};

  const isAdmin = (metadata as any).is_admin === true;
  const publisherAccessList: string[] =
    (metadata as any).publisher_access_list || [];
  const hasPublisherAccess = publisherAccessList.length > 0;

  return {
    isAdmin,
    hasPublisherAccess,
    publisherAccessList,
    isDualRole: isAdmin && hasPublisherAccess,
    isLoaded,
  };
}

/**
 * Check if user has access to a specific publisher
 */
export function useHasPublisherAccess(publisherId: string): boolean {
  const { isAdmin, publisherAccessList, isLoaded } = useUserRoles();

  if (!isLoaded) return false;

  // Admins have access to all publishers
  if (isAdmin) return true;

  return publisherAccessList.includes(publisherId);
}
