/**
 * API Query Factories for React Query Integration
 *
 * This module provides factory functions for creating type-safe React Query hooks
 * that automatically handle:
 * - Publisher context (X-Publisher-Id header)
 * - Authentication state
 * - Loading state coordination
 * - Cache key management
 * - Query invalidation
 *
 * @example Query usage:
 * ```tsx
 * // Simple query
 * const { data, isLoading } = usePublisherQuery<Profile>('profile', '/publisher/profile');
 *
 * // Query with parameters
 * const { data } = usePublisherQuery<Zman>(
 *   ['zman', zmanKey],
 *   `/publisher/zmanim/${zmanKey}`,
 *   { enabled: !!zmanKey }
 * );
 * ```
 *
 * @example Mutation usage:
 * ```tsx
 * const createZman = usePublisherMutation<Zman, CreateZmanRequest>(
 *   '/publisher/zmanim',
 *   'POST',
 *   { invalidateKeys: ['publisher-zmanim'] }
 * );
 *
 * // Use the mutation
 * await createZman.mutateAsync({ zman_key: 'alos', ... });
 * ```
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
  QueryKey,
} from '@tanstack/react-query';
import { useApi, ApiError } from '@/lib/api-client';
import { usePublisherContext } from '@/providers/PublisherContext';

// =============================================================================
// Types
// =============================================================================

export interface PublisherQueryOptions<TData>
  extends Omit<UseQueryOptions<TData, ApiError, TData, QueryKey>, 'queryKey' | 'queryFn'> {
  /**
   * Additional query parameters to append to the URL
   */
  params?: Record<string, string | number | boolean | undefined>;
}

export interface PublisherMutationOptions<TData, TVariables>
  extends Omit<UseMutationOptions<TData, ApiError, TVariables>, 'mutationFn' | 'onSuccess'> {
  /**
   * Query keys to invalidate on successful mutation
   */
  invalidateKeys?: string[];
  /**
   * Query keys to refetch immediately (not just invalidate)
   */
  refetchKeys?: string[];
  /**
   * Simplified onSuccess callback (without mutation context)
   */
  onSuccess?: (data: TData, variables: TVariables) => void;
}

// =============================================================================
// Query Factory
// =============================================================================

/**
 * Factory hook for creating publisher-scoped queries.
 *
 * Automatically:
 * - Adds publisher ID to query key for proper caching
 * - Waits for publisher context to be ready
 * - Handles authentication via useApi
 *
 * @param key - Query key (string or array)
 * @param endpoint - API endpoint (e.g., '/publisher/profile')
 * @param options - React Query options
 *
 * @example
 * ```tsx
 * // Simple usage
 * const { data, isLoading } = usePublisherQuery<Profile>('profile', '/publisher/profile');
 *
 * // With array key for parameterized queries
 * const { data } = usePublisherQuery<Zman>(
 *   ['zman', zmanKey],
 *   `/publisher/zmanim/${zmanKey}`,
 *   { enabled: !!zmanKey }
 * );
 *
 * // With query parameters
 * const { data } = usePublisherQuery<SearchResults>(
 *   ['search', query],
 *   '/publisher/search',
 *   { params: { q: query, limit: 10 } }
 * );
 * ```
 */
export function usePublisherQuery<TData>(
  key: string | (string | number | null | undefined)[],
  endpoint: string,
  options?: PublisherQueryOptions<TData>
) {
  const api = useApi();
  const { selectedPublisher, isLoading: publisherLoading } = usePublisherContext();

  const { params, enabled = true, ...queryOptions } = options ?? {};

  // Normalize key to array
  const normalizedKey = Array.isArray(key) ? key : [key];

  // Build URL with query parameters
  const buildUrl = () => {
    if (!params) return endpoint;

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, String(v));
      }
    });

    const queryString = searchParams.toString();
    return queryString ? `${endpoint}?${queryString}` : endpoint;
  };

  return useQuery<TData, ApiError>({
    queryKey: [...normalizedKey, selectedPublisher?.id],
    queryFn: () => api.get<TData>(buildUrl()),
    enabled: !publisherLoading && !!selectedPublisher?.id && enabled,
    ...queryOptions,
  });
}

/**
 * Factory hook for queries that don't require publisher context.
 * Useful for global data like templates, countries, etc.
 *
 * @example
 * ```tsx
 * const { data } = useGlobalQuery<Template[]>('templates', '/zmanim/templates', {
 *   staleTime: 1000 * 60 * 60, // 1 hour
 * });
 * ```
 */
export function useGlobalQuery<TData>(
  key: string | (string | number | null | undefined)[],
  endpoint: string,
  options?: Omit<PublisherQueryOptions<TData>, 'enabled'> & { enabled?: boolean }
) {
  const api = useApi();

  const { params, enabled = true, ...queryOptions } = options ?? {};

  const normalizedKey = Array.isArray(key) ? key : [key];

  const buildUrl = () => {
    if (!params) return endpoint;

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, String(v));
      }
    });

    const queryString = searchParams.toString();
    return queryString ? `${endpoint}?${queryString}` : endpoint;
  };

  return useQuery<TData, ApiError>({
    queryKey: normalizedKey,
    queryFn: () => api.get<TData>(buildUrl()),
    enabled,
    ...queryOptions,
  });
}

// =============================================================================
// Mutation Factory
// =============================================================================

/**
 * Factory hook for creating publisher-scoped mutations.
 *
 * Automatically:
 * - Uses the correct HTTP method
 * - Invalidates specified query keys on success
 * - Handles authentication via useApi
 *
 * @param endpoint - API endpoint
 * @param method - HTTP method (POST, PUT, PATCH, DELETE)
 * @param options - Mutation options including invalidateKeys
 *
 * @example
 * ```tsx
 * // Create mutation
 * const createZman = usePublisherMutation<Zman, CreateZmanRequest>(
 *   '/publisher/zmanim',
 *   'POST',
 *   { invalidateKeys: ['publisher-zmanim'] }
 * );
 *
 * // Update mutation with dynamic endpoint
 * const updateZman = usePublisherMutation<Zman, UpdateZmanRequest>(
 *   `/publisher/zmanim/${zmanKey}`,
 *   'PUT',
 *   { invalidateKeys: ['publisher-zmanim', `publisher-zman-${zmanKey}`] }
 * );
 *
 * // Delete mutation
 * const deleteZman = usePublisherMutation<void, string>(
 *   '/publisher/zmanim',
 *   'DELETE',
 *   {
 *     invalidateKeys: ['publisher-zmanim'],
 *     // Custom endpoint builder for DELETE with ID in URL
 *     // Use mutateAsync(zmanKey) and handle in mutationFn override
 *   }
 * );
 * ```
 */
export function usePublisherMutation<TData, TVariables>(
  endpoint: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  options?: PublisherMutationOptions<TData, TVariables>
) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { selectedPublisher } = usePublisherContext();

  const { invalidateKeys = [], refetchKeys = [], onSuccess, ...mutationOptions } = options ?? {};

  return useMutation<TData, ApiError, TVariables>({
    mutationFn: async (variables) => {
      const body = variables !== undefined ? JSON.stringify(variables) : undefined;

      switch (method) {
        case 'POST':
          return api.post<TData>(endpoint, { body });
        case 'PUT':
          return api.put<TData>(endpoint, { body });
        case 'PATCH':
          return api.patch<TData>(endpoint, { body });
        case 'DELETE':
          return api.delete<TData>(endpoint, { body });
      }
    },
    onSuccess: (data, variables, context) => {
      // Invalidate specified keys (with publisher ID appended)
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({
          queryKey: [key, selectedPublisher?.id],
        });
        // Also invalidate without publisher ID for global queries
        queryClient.invalidateQueries({
          queryKey: [key],
        });
      });

      // Refetch specified keys immediately
      refetchKeys.forEach((key) => {
        queryClient.refetchQueries({
          queryKey: [key, selectedPublisher?.id],
        });
      });

      // Call user's simplified onSuccess callback
      onSuccess?.(data, variables);
    },
    ...mutationOptions,
  });
}

/**
 * Factory hook for mutations with dynamic endpoints.
 * Useful when the endpoint depends on the mutation variables (e.g., update/delete by ID).
 *
 * @example
 * ```tsx
 * const updateZman = useDynamicMutation<Zman, { key: string; data: UpdateZmanRequest }>(
 *   (vars) => `/publisher/zmanim/${vars.key}`,
 *   'PUT',
 *   (vars) => vars.data,
 *   { invalidateKeys: ['publisher-zmanim'] }
 * );
 *
 * // Usage
 * await updateZman.mutateAsync({ key: 'alos', data: { hebrew_name: 'עלות' } });
 * ```
 */
export function useDynamicMutation<TData, TVariables>(
  endpointFn: (variables: TVariables) => string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  bodyFn: (variables: TVariables) => unknown,
  options?: PublisherMutationOptions<TData, TVariables>
) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { selectedPublisher } = usePublisherContext();

  const { invalidateKeys = [], refetchKeys = [], onSuccess, ...mutationOptions } = options ?? {};

  return useMutation<TData, ApiError, TVariables>({
    mutationFn: async (variables) => {
      const endpoint = endpointFn(variables);
      const bodyData = bodyFn(variables);
      const body = bodyData !== undefined ? JSON.stringify(bodyData) : undefined;

      switch (method) {
        case 'POST':
          return api.post<TData>(endpoint, { body });
        case 'PUT':
          return api.put<TData>(endpoint, { body });
        case 'PATCH':
          return api.patch<TData>(endpoint, { body });
        case 'DELETE':
          return api.delete<TData>(endpoint, { body });
      }
    },
    onSuccess: (data, variables, context) => {
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({
          queryKey: [key, selectedPublisher?.id],
        });
        queryClient.invalidateQueries({
          queryKey: [key],
        });
      });

      refetchKeys.forEach((key) => {
        queryClient.refetchQueries({
          queryKey: [key, selectedPublisher?.id],
        });
      });

      // Call user's simplified onSuccess callback
      onSuccess?.(data, variables);
    },
    ...mutationOptions,
  });
}

/**
 * Factory hook for delete mutations where the ID is passed as the variable.
 *
 * @example
 * ```tsx
 * const deleteZman = useDeleteMutation<void>(
 *   '/publisher/zmanim',
 *   { invalidateKeys: ['publisher-zmanim'] }
 * );
 *
 * // Usage
 * await deleteZman.mutateAsync('zman-key-to-delete');
 * ```
 */
export function useDeleteMutation<TData = void>(
  baseEndpoint: string,
  options?: PublisherMutationOptions<TData, string>
) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { selectedPublisher } = usePublisherContext();

  const { invalidateKeys = [], refetchKeys = [], onSuccess, ...mutationOptions } = options ?? {};

  return useMutation<TData, ApiError, string>({
    mutationFn: async (id) => {
      const endpoint = `${baseEndpoint}/${id}`;
      return api.delete<TData>(endpoint);
    },
    onSuccess: (data, variables, context) => {
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({
          queryKey: [key, selectedPublisher?.id],
        });
        queryClient.invalidateQueries({
          queryKey: [key],
        });
      });

      refetchKeys.forEach((key) => {
        queryClient.refetchQueries({
          queryKey: [key, selectedPublisher?.id],
        });
      });

      // Call user's simplified onSuccess callback
      onSuccess?.(data, variables);
    },
    ...mutationOptions,
  });
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Hook to manually invalidate queries for a publisher.
 * Useful for imperative cache invalidation outside of mutations.
 *
 * @example
 * ```tsx
 * const invalidate = useInvalidatePublisherQueries();
 *
 * // After some external action
 * invalidate(['publisher-zmanim', 'publisher-profile']);
 * ```
 */
export function useInvalidatePublisherQueries() {
  const queryClient = useQueryClient();
  const { selectedPublisher } = usePublisherContext();

  return (keys: string[]) => {
    keys.forEach((key) => {
      queryClient.invalidateQueries({
        queryKey: [key, selectedPublisher?.id],
      });
    });
  };
}

/**
 * Hook to prefetch publisher queries.
 * Useful for preloading data on hover or in anticipation of navigation.
 *
 * @example
 * ```tsx
 * const prefetch = usePrefetchPublisherQuery();
 *
 * // On hover
 * prefetch<Zman>(['zman', 'alos'], '/publisher/zmanim/alos');
 * ```
 */
export function usePrefetchPublisherQuery() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { selectedPublisher } = usePublisherContext();

  return <TData>(key: string | string[], endpoint: string) => {
    const normalizedKey = Array.isArray(key) ? key : [key];

    return queryClient.prefetchQuery({
      queryKey: [...normalizedKey, selectedPublisher?.id],
      queryFn: () => api.get<TData>(endpoint),
    });
  };
}
