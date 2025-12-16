/**
 * Unified API Client for Shtetl Zmanim
 *
 * This is the SINGLE source of truth for all API requests.
 * All components MUST use this client for API calls.
 *
 * Features:
 * - Automatic authentication token injection
 * - Automatic X-Publisher-Id header for publisher routes
 * - Consistent error handling with ApiError class
 * - Type-safe request/response handling
 * - Support for public (unauthenticated) requests
 *
 * @example Hook usage (recommended for components):
 * ```tsx
 * const api = useApi();
 * const data = await api.get('/publisher/profile');
 * await api.post('/publisher/zmanim', { body: JSON.stringify(zman) });
 * ```
 *
 * @example Public requests (no auth required):
 * ```tsx
 * const api = useApi();
 * const countries = await api.public.get('/countries');
 * ```
 *
 * @example Non-hook usage (for contexts/utilities):
 * ```ts
 * import { createApiClient } from '@/lib/api-client';
 * const api = createApiClient(getToken, selectedPublisher);
 * ```
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { usePublisherContextOptional } from '@/providers/PublisherContext';

// =============================================================================
// Configuration
// =============================================================================

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// API prefix - always /api/v1
const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX || '/api/v1';

// JWT Template name for API Gateway auth (created in Clerk Dashboard)
// This template should have audience set to match API Gateway's expected audience
const JWT_TEMPLATE = process.env.NEXT_PUBLIC_CLERK_JWT_TEMPLATE || 'zmanim-api';

// =============================================================================
// Types
// =============================================================================

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'headers' | 'body'> {
  headers?: Record<string, string>;
  body?: string | FormData;
  /**
   * Skip adding X-Publisher-Id header (for admin routes or cross-publisher requests)
   */
  skipPublisherId?: boolean;
  /**
   * Skip authentication entirely (for public endpoints)
   */
  skipAuth?: boolean;
  /**
   * Custom timeout in milliseconds (default: 30000)
   */
  timeout?: number;
}

export interface Publisher {
  id: string;
  name: string;
  status?: string;
}

type GetTokenFn = () => Promise<string | null>;

// =============================================================================
// Core API Client Factory
// =============================================================================

/**
 * Creates an API client instance with the provided auth context.
 * Use this for non-hook scenarios (e.g., inside contexts or utility functions).
 */
export function createApiClient(
  getToken: GetTokenFn,
  selectedPublisher: Publisher | null
) {
  /**
   * Core fetch function that handles all API requests
   */
  async function request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      skipPublisherId = false,
      skipAuth = false,
      timeout = 30000,
      headers: customHeaders,
      ...fetchOptions
    } = options;

    // Build headers
    const headers: Record<string, string> = {};

    // Only set Content-Type for non-FormData requests
    if (!(fetchOptions.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Add auth token if required
    if (!skipAuth) {
      const token = await getToken();
      if (!token) {
        throw new ApiError(
          'Not authenticated - no token available',
          401,
          undefined,
          endpoint
        );
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add publisher ID for publisher routes
    if (!skipPublisherId && selectedPublisher?.id) {
      headers['X-Publisher-Id'] = selectedPublisher.id;
    }

    // Merge custom headers (allows overriding defaults)
    Object.assign(headers, customHeaders);

    // Normalize endpoint (ensure it starts with /api/v1)
    const normalizedEndpoint = normalizeEndpoint(endpoint);
    const url = `${API_BASE}${normalizedEndpoint}`;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: response.statusText,
        }));
        // API returns { error: { code, message } } format
        const errorMessage =
          errorData.error?.message ||
          errorData.message ||
          (typeof errorData.error === 'string' ? errorData.error : null) ||
          `API Error: ${response.status}`;
        throw new ApiError(
          errorMessage,
          response.status,
          errorData,
          endpoint
        );
      }

      // Handle empty responses (204 No Content, etc.)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return {} as T;
      }

      const json = await response.json();
      // Unwrap data field if present (API returns { data: ..., meta: ... })
      return json.data !== undefined ? json.data : json;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError(
            `Request timeout after ${timeout}ms`,
            408,
            undefined,
            endpoint
          );
        }
        // Preserve "Failed to fetch" for network errors so callers can handle it specifically
        throw new ApiError(error.message, 0, undefined, endpoint);
      }

      throw new ApiError('Unknown error occurred', 0, undefined, endpoint);
    }
  }

  /**
   * GET request
   */
  async function get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async function post<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'POST' });
  }

  /**
   * PUT request
   */
  async function put<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'PUT' });
  }

  /**
   * PATCH request
   */
  async function patch<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'PATCH' });
  }

  /**
   * DELETE request
   */
  async function del<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * GET request that returns the raw Response object (for file downloads, etc.)
   */
  async function getRaw(endpoint: string, options?: RequestOptions): Promise<Response> {
    const {
      skipPublisherId = false,
      skipAuth = false,
      timeout = 30000,
      headers: customHeaders,
      ...fetchOptions
    } = options || {};

    const headers: Record<string, string> = {};

    if (!skipAuth) {
      const token = await getToken();
      if (!token) {
        throw new ApiError('Not authenticated - no token available', 401, undefined, endpoint);
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!skipPublisherId && selectedPublisher?.id) {
      headers['X-Publisher-Id'] = selectedPublisher.id;
    }

    Object.assign(headers, customHeaders);

    const normalizedEndpoint = normalizeEndpoint(endpoint);
    const url = `${API_BASE}${normalizedEndpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        const errorMessage =
          errorData.error?.message ||
          errorData.message ||
          (typeof errorData.error === 'string' ? errorData.error : null) ||
          `API Error: ${response.status}`;
        throw new ApiError(errorMessage, response.status, errorData, endpoint);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError(`Request timeout after ${timeout}ms`, 408, undefined, endpoint);
        }
        throw new ApiError(error.message, 0, undefined, endpoint);
      }

      throw new ApiError('Unknown error occurred', 0, undefined, endpoint);
    }
  }

  /**
   * POST request that returns the raw Response object (for file downloads, binary responses, etc.)
   */
  async function postRaw(endpoint: string, options?: RequestOptions): Promise<Response> {
    const {
      skipPublisherId = false,
      skipAuth = false,
      timeout = 60000, // Longer timeout for binary responses (1 minute)
      headers: customHeaders,
      ...fetchOptions
    } = options || {};

    const headers: Record<string, string> = {};

    // Only set Content-Type for non-FormData requests
    if (!(fetchOptions.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (!skipAuth) {
      const token = await getToken();
      if (!token) {
        throw new ApiError('Not authenticated - no token available', 401, undefined, endpoint);
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!skipPublisherId && selectedPublisher?.id) {
      headers['X-Publisher-Id'] = selectedPublisher.id;
    }

    Object.assign(headers, customHeaders);

    const normalizedEndpoint = normalizeEndpoint(endpoint);
    const url = `${API_BASE}${normalizedEndpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        method: 'POST',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        const errorMessage =
          errorData.error?.message ||
          errorData.message ||
          (typeof errorData.error === 'string' ? errorData.error : null) ||
          `API Error: ${response.status}`;
        throw new ApiError(errorMessage, response.status, errorData, endpoint);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError(`Request timeout after ${timeout}ms`, 408, undefined, endpoint);
        }
        throw new ApiError(error.message, 0, undefined, endpoint);
      }

      throw new ApiError('Unknown error occurred', 0, undefined, endpoint);
    }
  }

  /**
   * Public API client (no authentication required)
   */
  const publicApi = {
    get: <T>(endpoint: string, options?: Omit<RequestOptions, 'skipAuth'>) =>
      get<T>(endpoint, { ...options, skipAuth: true }),
    post: <T>(endpoint: string, options?: Omit<RequestOptions, 'skipAuth'>) =>
      post<T>(endpoint, { ...options, skipAuth: true }),
    put: <T>(endpoint: string, options?: Omit<RequestOptions, 'skipAuth'>) =>
      put<T>(endpoint, { ...options, skipAuth: true }),
    patch: <T>(endpoint: string, options?: Omit<RequestOptions, 'skipAuth'>) =>
      patch<T>(endpoint, { ...options, skipAuth: true }),
    delete: <T>(endpoint: string, options?: Omit<RequestOptions, 'skipAuth'>) =>
      del<T>(endpoint, { ...options, skipAuth: true }),
  };

  /**
   * Admin API client (authenticated but no publisher ID)
   */
  const adminApi = {
    get: <T>(endpoint: string, options?: Omit<RequestOptions, 'skipPublisherId'>) =>
      get<T>(endpoint, { ...options, skipPublisherId: true }),
    getRaw: (endpoint: string, options?: Omit<RequestOptions, 'skipPublisherId'>) =>
      getRaw(endpoint, { ...options, skipPublisherId: true }),
    post: <T>(endpoint: string, options?: Omit<RequestOptions, 'skipPublisherId'>) =>
      post<T>(endpoint, { ...options, skipPublisherId: true }),
    postRaw: (endpoint: string, options?: Omit<RequestOptions, 'skipPublisherId'>) =>
      postRaw(endpoint, { ...options, skipPublisherId: true }),
    put: <T>(endpoint: string, options?: Omit<RequestOptions, 'skipPublisherId'>) =>
      put<T>(endpoint, { ...options, skipPublisherId: true }),
    patch: <T>(endpoint: string, options?: Omit<RequestOptions, 'skipPublisherId'>) =>
      patch<T>(endpoint, { ...options, skipPublisherId: true }),
    delete: <T>(endpoint: string, options?: Omit<RequestOptions, 'skipPublisherId'>) =>
      del<T>(endpoint, { ...options, skipPublisherId: true }),
  };

  return {
    request,
    get,
    getRaw,
    post,
    postRaw,
    put,
    patch,
    delete: del,
    public: publicApi,
    admin: adminApi,
  };
}

// =============================================================================
// React Hook
// =============================================================================

/**
 * React hook for API requests with automatic auth handling.
 * This is the recommended way to make API calls in components.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const api = useApi();
 *
 *   const fetchData = async () => {
 *     // Authenticated request with publisher ID
 *     const profile = await api.get('/publisher/profile');
 *
 *     // Public request (no auth)
 *     const countries = await api.public.get('/countries');
 *
 *     // Admin request (auth but no publisher ID)
 *     const stats = await api.admin.get('/admin/stats');
 *   };
 * }
 * ```
 */
export function usePublisherApi() {
  const { getToken } = useAuth();
  const publisherContext = usePublisherContextOptional();

  // Wrap getToken to use JWT template for API Gateway auth
  const getApiToken = useCallback(
    () => getToken({ template: JWT_TEMPLATE }),
    [getToken]
  );

  const api = useMemo(
    () => createApiClient(getApiToken, publisherContext?.selectedPublisher ?? null),
    [getApiToken, publisherContext?.selectedPublisher]
  );

  return api;
}

export const useApi = usePublisherApi;

/**
 * Lightweight hook that only provides the API client factory.
 * Use this when you need to create an API client with custom auth.
 */
export function useApiFactory() {
  const { getToken } = useAuth();

  // Wrap getToken to use JWT template for API Gateway auth
  const getApiToken = useCallback(
    () => getToken({ template: JWT_TEMPLATE }),
    [getToken]
  );

  const createClient = useCallback(
    (selectedPublisher: Publisher | null) =>
      createApiClient(getApiToken, selectedPublisher),
    [getApiToken]
  );

  return { createClient, getToken: getApiToken };
}

/**
 * React hook for admin API requests that don't require publisher context.
 * Use this in admin pages that are outside the PublisherProvider.
 *
 * @example
 * ```tsx
 * function AdminPage() {
 *   const api = useAdminApi();
 *
 *   const fetchData = async () => {
 *     const zmanim = await api.get('/registry/zmanim?include_hidden=true');
 *     const categories = await api.get('/admin/registry/time-categories');
 *   };
 * }
 * ```
 */
export function useAdminApi() {
  const { getToken } = useAuth();

  // Wrap getToken to use JWT template for API Gateway auth
  const getApiToken = useCallback(
    () => getToken({ template: JWT_TEMPLATE }),
    [getToken]
  );

  const api = useMemo(
    () => createApiClient(getApiToken, null),
    [getApiToken]
  );

  // Return admin API methods that skip publisher ID
  return api.admin;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Normalizes an endpoint to ensure consistent formatting.
 * - Adds /api/v1 prefix if not present
 */
function normalizeEndpoint(endpoint: string): string {
  // Remove leading slash for consistency
  let normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Already has /api/v1 prefix - return as-is
  if (normalized.startsWith('/api/v1')) {
    return normalized;
  }

  // Convert /api/foo to /api/v1/foo
  if (normalized.startsWith('/api/')) {
    return normalized.replace('/api/', '/api/v1/');
  }

  // Check if it starts with a known route prefix that needs /api/v1
  const routePrefixes = [
    '/publisher',
    '/admin',
    '/auth',
    '/user',
    '/dsl',
    '/zmanim',
    '/registry',
    '/continents',
    '/countries',
    '/regions',
    '/localities',
    '/locations',
    '/coverage',
    '/algorithms',
    '/calendar',
    '/ai',
    '/health',
    '/categories',
    '/tag-types',
    '/geo',
    '/publishers',
  ];

  const needsPrefix = routePrefixes.some(
    (prefix) => normalized.startsWith(prefix) || normalized === prefix
  );

  if (needsPrefix) {
    normalized = `${API_PREFIX}${normalized}`;
  }

  return normalized;
}

export { API_BASE as API_BASE_URL };
