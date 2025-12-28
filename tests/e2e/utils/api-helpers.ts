/**
 * API Helper Utilities for E2E Tests
 *
 * Utilities for working with the API structure:
 * - /api/v1/auth/publisher/* (publisher-scoped endpoints)
 * - /api/v1/auth/admin/* (admin-scoped endpoints)
 * - /api/v1/* (public endpoints - no /public/ prefix)
 *
 * Story: 9.7 - E2E Test Suite Refresh for New API Structure
 */

import { API_URL } from '../../config';

/**
 * API path prefixes for different endpoint types
 */
export const API_PATHS = {
  /** Publisher-scoped endpoints requiring authentication + X-Publisher-Id header */
  PUBLISHER: '/api/v1/auth/publisher',
  /** Admin-scoped endpoints requiring authentication + admin role */
  ADMIN: '/api/v1/auth/admin',
  /** Public endpoints (no authentication) - Note: routes are /api/v1/* not /api/v1/public/* */
  PUBLIC: '/api/v1',
} as const;

/**
 * Normalize an API path to use the correct structure
 *
 * Converts old API paths to new structure:
 * - /api/v1/publisher/* → /api/v1/auth/publisher/*
 * - /api/v1/admin/* → /api/v1/auth/admin/*
 * - Public routes remain as /api/v1/* (no /public/ prefix)
 *
 * @param path - API path to normalize
 * @returns Normalized API path
 *
 * @example
 * ```typescript
 * normalizeApiPath('/api/v1/publisher/profile')
 * // Returns: '/api/v1/auth/publisher/profile'
 *
 * normalizeApiPath('/api/v1/admin/publishers')
 * // Returns: '/api/v1/auth/admin/publishers'
 *
 * normalizeApiPath('/api/v1/cities')
 * // Returns: '/api/v1/cities'
 * ```
 */
export function normalizeApiPath(path: string): string {
  // Already normalized paths - return as is
  if (path.startsWith('/api/v1/auth/')) {
    return path;
  }

  // Convert old publisher paths to new auth/publisher structure
  if (path.startsWith('/api/v1/publisher/')) {
    return path.replace('/api/v1/publisher/', '/api/v1/auth/publisher/');
  }

  // Convert old admin paths to new auth/admin structure
  if (path.startsWith('/api/v1/admin/')) {
    return path.replace('/api/v1/admin/', '/api/v1/auth/admin/');
  }

  // Public routes remain as /api/v1/* - no conversion needed
  return path;
}

/**
 * Build a full API URL from a path
 *
 * @param path - API path (will be normalized)
 * @returns Full API URL
 *
 * @example
 * ```typescript
 * buildApiUrl('/publisher/profile')
 * // Returns: 'http://localhost:8080/api/v1/auth/publisher/profile'
 * ```
 */
export function buildApiUrl(path: string): string {
  const normalizedPath = normalizeApiPath(path);
  return `${API_URL}${normalizedPath}`;
}

/**
 * Get the appropriate API base path for an endpoint type
 *
 * @param type - Endpoint type ('publisher', 'admin', or 'public')
 * @returns Base path for that endpoint type
 *
 * @example
 * ```typescript
 * getApiBasePath('publisher')
 * // Returns: '/api/v1/auth/publisher'
 *
 * getApiBasePath('public')
 * // Returns: '/api/v1/public'
 * ```
 */
export function getApiBasePath(type: 'publisher' | 'admin' | 'public'): string {
  switch (type) {
    case 'publisher':
      return API_PATHS.PUBLISHER;
    case 'admin':
      return API_PATHS.ADMIN;
    case 'public':
      return API_PATHS.PUBLIC;
    default:
      throw new Error(`Unknown API type: ${type}`);
  }
}

/**
 * Build a publisher-scoped API URL
 *
 * @param endpoint - Endpoint path (without /publisher prefix)
 * @returns Full API URL for publisher endpoint
 *
 * @example
 * ```typescript
 * publisherApiUrl('profile')
 * // Returns: 'http://localhost:8080/api/v1/auth/publisher/profile'
 *
 * publisherApiUrl('/algorithm/history')
 * // Returns: 'http://localhost:8080/api/v1/auth/publisher/algorithm/history'
 * ```
 */
export function publisherApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_URL}${API_PATHS.PUBLISHER}${cleanEndpoint}`;
}

/**
 * Build an admin-scoped API URL
 *
 * @param endpoint - Endpoint path (without /admin prefix)
 * @returns Full API URL for admin endpoint
 *
 * @example
 * ```typescript
 * adminApiUrl('publishers')
 * // Returns: 'http://localhost:8080/api/v1/auth/admin/publishers'
 * ```
 */
export function adminApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_URL}${API_PATHS.ADMIN}${cleanEndpoint}`;
}

/**
 * Build a public API URL
 *
 * @param endpoint - Endpoint path (e.g., 'cities', 'publishers')
 * @returns Full API URL for public endpoint
 *
 * @example
 * ```typescript
 * publicApiUrl('cities')
 * // Returns: 'http://localhost:8080/api/v1/cities'
 *
 * publicApiUrl('/localities/search')
 * // Returns: 'http://localhost:8080/api/v1/localities/search'
 * ```
 */
export function publicApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_URL}${API_PATHS.PUBLIC}${cleanEndpoint}`;
}

/**
 * API URL builders object for convenient access
 */
export const apiUrl = {
  publisher: publisherApiUrl,
  admin: adminApiUrl,
  public: publicApiUrl,
} as const;
