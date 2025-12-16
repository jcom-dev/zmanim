/**
 * Clerk Public Metadata Types
 *
 * Shared type definitions for Clerk user metadata used across the application.
 * Use these instead of inline type assertions.
 *
 * @example
 * const metadata = user.publicMetadata as ClerkPublicMetadata;
 * if (metadata.is_admin) { ... }
 */

/**
 * Public metadata structure stored in Clerk user profiles
 */
export interface ClerkPublicMetadata {
  /** Whether user has admin privileges */
  is_admin?: boolean;
  /** List of publisher IDs this user has access to */
  publisher_access_list?: string[];
  /** Primary publisher ID for users with multiple publishers */
  primary_publisher_id?: string;
}

/**
 * Type guard to check if user has admin role
 */
export function isAdmin(metadata: ClerkPublicMetadata): boolean {
  return metadata.is_admin === true;
}

/**
 * Type guard to check if user has publisher access
 */
export function hasPublisherAccess(metadata: ClerkPublicMetadata): boolean {
  return (metadata.publisher_access_list?.length || 0) > 0;
}
