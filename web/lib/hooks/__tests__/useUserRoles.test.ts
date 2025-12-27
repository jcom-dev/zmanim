/**
 * @file useUserRoles.test.ts
 * @purpose Unit tests for useUserRoles and useHasPublisherAccess hooks
 * @priority P1 - Core authentication/authorization logic
 *
 * Tests cover:
 * - useUserRoles role detection
 * - Admin role detection
 * - Publisher access list handling
 * - Dual-role detection
 * - Loading state handling
 * - useHasPublisherAccess access checks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUserRoles, useHasPublisherAccess } from '../useUserRoles';

// =============================================================================
// Mock Setup
// =============================================================================

const mockUseUser = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
}));

// =============================================================================
// Test Utilities
// =============================================================================

function createMockUser(overrides: {
  publicMetadata?: Record<string, unknown>;
  isLoaded?: boolean;
} = {}) {
  return {
    user: {
      id: 'user-123',
      publicMetadata: overrides.publicMetadata || {},
    },
    isLoaded: overrides.isLoaded ?? true,
  };
}

// =============================================================================
// useUserRoles Tests
// =============================================================================

describe('useUserRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[P1] should return default values when not loaded', () => {
    // GIVEN: User is not loaded
    mockUseUser.mockReturnValue({
      user: null,
      isLoaded: false,
    });

    // WHEN: Hook is called
    const { result } = renderHook(() => useUserRoles());

    // THEN: Should return default non-authenticated values
    expect(result.current).toEqual({
      isAdmin: false,
      hasPublisherAccess: false,
      publisherAccessList: [],
      isDualRole: false,
      isLoaded: false,
    });
  });

  it('[P1] should return default values when user is null', () => {
    // GIVEN: User is loaded but null
    mockUseUser.mockReturnValue({
      user: null,
      isLoaded: true,
    });

    // WHEN: Hook is called
    const { result } = renderHook(() => useUserRoles());

    // THEN: Should return default values with isLoaded true
    expect(result.current).toEqual({
      isAdmin: false,
      hasPublisherAccess: false,
      publisherAccessList: [],
      isDualRole: false,
      isLoaded: true,
    });
  });

  it('[P1] should detect admin role from metadata', () => {
    // GIVEN: User has admin role
    mockUseUser.mockReturnValue(createMockUser({
      publicMetadata: { is_admin: true },
    }));

    // WHEN: Hook is called
    const { result } = renderHook(() => useUserRoles());

    // THEN: Should return admin: true
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isLoaded).toBe(true);
  });

  it('[P1] should detect non-admin role', () => {
    // GIVEN: User is not admin
    mockUseUser.mockReturnValue(createMockUser({
      publicMetadata: { is_admin: false },
    }));

    // WHEN: Hook is called
    const { result } = renderHook(() => useUserRoles());

    // THEN: Should return admin: false
    expect(result.current.isAdmin).toBe(false);
  });

  it('[P1] should handle missing is_admin metadata', () => {
    // GIVEN: No is_admin in metadata
    mockUseUser.mockReturnValue(createMockUser({
      publicMetadata: {},
    }));

    // WHEN: Hook is called
    const { result } = renderHook(() => useUserRoles());

    // THEN: Should return admin: false
    expect(result.current.isAdmin).toBe(false);
  });

  it('[P1] should detect publisher access from list', () => {
    // GIVEN: User has publisher access
    mockUseUser.mockReturnValue(createMockUser({
      publicMetadata: {
        publisher_access_list: ['pub-123', 'pub-456'],
      },
    }));

    // WHEN: Hook is called
    const { result } = renderHook(() => useUserRoles());

    // THEN: Should return publisher access
    expect(result.current.hasPublisherAccess).toBe(true);
    expect(result.current.publisherAccessList).toEqual(['pub-123', 'pub-456']);
  });

  it('[P1] should handle empty publisher access list', () => {
    // GIVEN: Empty publisher list
    mockUseUser.mockReturnValue(createMockUser({
      publicMetadata: {
        publisher_access_list: [],
      },
    }));

    // WHEN: Hook is called
    const { result } = renderHook(() => useUserRoles());

    // THEN: Should return no publisher access
    expect(result.current.hasPublisherAccess).toBe(false);
    expect(result.current.publisherAccessList).toEqual([]);
  });

  it('[P1] should handle missing publisher_access_list metadata', () => {
    // GIVEN: No publisher_access_list in metadata
    mockUseUser.mockReturnValue(createMockUser({
      publicMetadata: {},
    }));

    // WHEN: Hook is called
    const { result } = renderHook(() => useUserRoles());

    // THEN: Should return empty list
    expect(result.current.hasPublisherAccess).toBe(false);
    expect(result.current.publisherAccessList).toEqual([]);
  });

  it('[P1] should detect dual-role users', () => {
    // GIVEN: User is both admin and has publisher access
    mockUseUser.mockReturnValue(createMockUser({
      publicMetadata: {
        is_admin: true,
        publisher_access_list: ['pub-123'],
      },
    }));

    // WHEN: Hook is called
    const { result } = renderHook(() => useUserRoles());

    // THEN: Should return dual role
    expect(result.current.isDualRole).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.hasPublisherAccess).toBe(true);
  });

  it('[P2] should not be dual-role if only admin', () => {
    // GIVEN: User is admin only
    mockUseUser.mockReturnValue(createMockUser({
      publicMetadata: {
        is_admin: true,
        publisher_access_list: [],
      },
    }));

    // WHEN: Hook is called
    const { result } = renderHook(() => useUserRoles());

    // THEN: Should not be dual role
    expect(result.current.isDualRole).toBe(false);
    expect(result.current.isAdmin).toBe(true);
  });

  it('[P2] should not be dual-role if only publisher', () => {
    // GIVEN: User has only publisher access
    mockUseUser.mockReturnValue(createMockUser({
      publicMetadata: {
        is_admin: false,
        publisher_access_list: ['pub-123'],
      },
    }));

    // WHEN: Hook is called
    const { result } = renderHook(() => useUserRoles());

    // THEN: Should not be dual role
    expect(result.current.isDualRole).toBe(false);
    expect(result.current.hasPublisherAccess).toBe(true);
  });

  it('[P2] should handle null publicMetadata', () => {
    // GIVEN: User with null metadata
    mockUseUser.mockReturnValue({
      user: { id: 'user-123', publicMetadata: null },
      isLoaded: true,
    });

    // WHEN: Hook is called
    const { result } = renderHook(() => useUserRoles());

    // THEN: Should return defaults
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.hasPublisherAccess).toBe(false);
  });

  it('[P3] should handle non-boolean is_admin value', () => {
    // GIVEN: is_admin is not exactly true
    mockUseUser.mockReturnValue(createMockUser({
      publicMetadata: { is_admin: 'yes' },
    }));

    // WHEN: Hook is called
    const { result } = renderHook(() => useUserRoles());

    // THEN: Should return false (strict comparison)
    expect(result.current.isAdmin).toBe(false);
  });
});

// =============================================================================
// useHasPublisherAccess Tests
// =============================================================================

describe('useHasPublisherAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[P1] should return false when not loaded', () => {
    // GIVEN: User not loaded
    mockUseUser.mockReturnValue({
      user: null,
      isLoaded: false,
    });

    // WHEN: Checking access
    const { result } = renderHook(() => useHasPublisherAccess('pub-123'));

    // THEN: Should return false
    expect(result.current).toBe(false);
  });

  it('[P1] should return true for admin (global access)', () => {
    // GIVEN: User is admin
    mockUseUser.mockReturnValue(createMockUser({
      publicMetadata: {
        is_admin: true,
        publisher_access_list: [],
      },
    }));

    // WHEN: Checking access to any publisher
    const { result } = renderHook(() => useHasPublisherAccess('any-publisher'));

    // THEN: Should have access
    expect(result.current).toBe(true);
  });

  it('[P1] should return true for listed publisher', () => {
    // GIVEN: User has access to specific publisher
    mockUseUser.mockReturnValue(createMockUser({
      publicMetadata: {
        is_admin: false,
        publisher_access_list: ['pub-123', 'pub-456'],
      },
    }));

    // WHEN: Checking access to listed publisher
    const { result } = renderHook(() => useHasPublisherAccess('pub-123'));

    // THEN: Should have access
    expect(result.current).toBe(true);
  });

  it('[P1] should return false for non-listed publisher', () => {
    // GIVEN: User has access to specific publishers
    mockUseUser.mockReturnValue(createMockUser({
      publicMetadata: {
        is_admin: false,
        publisher_access_list: ['pub-123', 'pub-456'],
      },
    }));

    // WHEN: Checking access to unlisted publisher
    const { result } = renderHook(() => useHasPublisherAccess('pub-789'));

    // THEN: Should not have access
    expect(result.current).toBe(false);
  });

  it('[P2] should return false for user with no access', () => {
    // GIVEN: User has no publisher access
    mockUseUser.mockReturnValue(createMockUser({
      publicMetadata: {
        is_admin: false,
        publisher_access_list: [],
      },
    }));

    // WHEN: Checking access
    const { result } = renderHook(() => useHasPublisherAccess('pub-123'));

    // THEN: Should not have access
    expect(result.current).toBe(false);
  });

  it('[P2] should handle ID with different formats', () => {
    // GIVEN: User has access with UUID
    mockUseUser.mockReturnValue(createMockUser({
      publicMetadata: {
        is_admin: false,
        publisher_access_list: ['550e8400-e29b-41d4-a716-446655440000'],
      },
    }));

    // WHEN: Checking access with exact ID
    const { result } = renderHook(() =>
      useHasPublisherAccess('550e8400-e29b-41d4-a716-446655440000')
    );

    // THEN: Should have access
    expect(result.current).toBe(true);
  });

  it('[P3] should update when publisher ID changes', () => {
    // GIVEN: User has access to one publisher
    mockUseUser.mockReturnValue(createMockUser({
      publicMetadata: {
        is_admin: false,
        publisher_access_list: ['pub-123'],
      },
    }));

    // WHEN: Initially checking accessible publisher
    const { result, rerender } = renderHook(
      ({ publisherId }) => useHasPublisherAccess(publisherId),
      { initialProps: { publisherId: 'pub-123' } }
    );

    expect(result.current).toBe(true);

    // WHEN: Checking different publisher
    rerender({ publisherId: 'pub-456' });

    // THEN: Should update to false
    expect(result.current).toBe(false);
  });
});
