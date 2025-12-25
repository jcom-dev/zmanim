/**
 * @file useApiQuery.test.ts
 * @purpose Unit tests for useApiQuery hook factory functions
 * @priority P1 - Core API integration logic
 *
 * Tests cover:
 * - usePublisherQuery factory behavior
 * - useGlobalQuery factory behavior
 * - usePublisherMutation factory behavior
 * - useDynamicMutation factory behavior
 * - useDeleteMutation factory behavior
 * - Query key normalization
 * - URL building with params
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  usePublisherQuery,
  useGlobalQuery,
  usePublisherMutation,
  useDynamicMutation,
  useDeleteMutation,
  useInvalidatePublisherQueries,
  usePrefetchPublisherQuery,
} from '../useApiQuery';

// =============================================================================
// Mock Setup
// =============================================================================

// Mock useApi
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/lib/api-client', () => ({
  useApi: () => ({
    get: mockGet,
    post: mockPost,
    put: mockPut,
    patch: mockPatch,
    delete: mockDelete,
  }),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status?: number) {
      super(message);
    }
  },
}));

// Mock usePublisherContext
const mockPublisherContext = {
  selectedPublisher: { id: 'pub-123', name: 'Test Publisher' },
  isLoading: false,
};

vi.mock('@/providers/PublisherContext', () => ({
  usePublisherContext: () => mockPublisherContext,
}));

// =============================================================================
// Test Utilities
// =============================================================================

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

// =============================================================================
// usePublisherQuery Tests
// =============================================================================

describe('usePublisherQuery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    mockPublisherContext.selectedPublisher = { id: 'pub-123', name: 'Test Publisher' };
    mockPublisherContext.isLoading = false;
  });

  it('[P1] should fetch data with publisher context', async () => {
    // GIVEN: API returns data
    const mockData = { id: 1, name: 'Test' };
    mockGet.mockResolvedValueOnce(mockData);

    // WHEN: Using the hook
    const { result } = renderHook(
      () => usePublisherQuery<typeof mockData>('test-key', '/test-endpoint'),
      { wrapper: createWrapper(queryClient) }
    );

    // THEN: Should fetch and return data
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(mockGet).toHaveBeenCalledWith('/test-endpoint');
  });

  it('[P1] should include publisher ID in query key', async () => {
    // GIVEN: API returns data
    mockGet.mockResolvedValueOnce({ data: 'test' });

    // WHEN: Using the hook
    const { result } = renderHook(
      () => usePublisherQuery('test-key', '/test-endpoint'),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // THEN: Query should be cached with publisher ID
    const queryState = queryClient.getQueryState(['test-key', 'pub-123']);
    expect(queryState).toBeDefined();
  });

  it('[P1] should not fetch when publisher is loading', () => {
    // GIVEN: Publisher context is loading
    mockPublisherContext.isLoading = true;

    // WHEN: Using the hook
    const { result } = renderHook(
      () => usePublisherQuery('test-key', '/test-endpoint'),
      { wrapper: createWrapper(queryClient) }
    );

    // THEN: Should not fetch
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('[P1] should not fetch when publisher is null', () => {
    // GIVEN: No selected publisher
    mockPublisherContext.selectedPublisher = null as any;

    // WHEN: Using the hook
    const { result } = renderHook(
      () => usePublisherQuery('test-key', '/test-endpoint'),
      { wrapper: createWrapper(queryClient) }
    );

    // THEN: Should not fetch
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('[P1] should respect enabled option', () => {
    // GIVEN: Hook disabled via option
    mockGet.mockResolvedValueOnce({ data: 'test' });

    // WHEN: Using the hook with enabled: false
    const { result } = renderHook(
      () => usePublisherQuery('test-key', '/test-endpoint', { enabled: false }),
      { wrapper: createWrapper(queryClient) }
    );

    // THEN: Should not fetch
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('[P2] should handle array keys', async () => {
    // GIVEN: API returns data
    mockGet.mockResolvedValueOnce({ id: 123 });

    // WHEN: Using array key
    const { result } = renderHook(
      () => usePublisherQuery(['zman', 'alos'], '/publisher/zmanim/alos'),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // THEN: Query should be cached with full array key
    const queryState = queryClient.getQueryState(['zman', 'alos', 'pub-123']);
    expect(queryState).toBeDefined();
  });

  it('[P2] should build URL with query parameters', async () => {
    // GIVEN: API returns data
    mockGet.mockResolvedValueOnce({ results: [] });

    // WHEN: Using params option
    const { result } = renderHook(
      () => usePublisherQuery('search', '/search', {
        params: { q: 'test', limit: 10, empty: undefined },
      }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // THEN: Should call with query string (undefined params excluded)
    expect(mockGet).toHaveBeenCalledWith('/search?q=test&limit=10');
  });

  it('[P2] should handle empty params object', async () => {
    // GIVEN: API returns data
    mockGet.mockResolvedValueOnce({ data: 'test' });

    // WHEN: Using empty params
    const { result } = renderHook(
      () => usePublisherQuery('test', '/endpoint', { params: {} }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // THEN: Should call without query string
    expect(mockGet).toHaveBeenCalledWith('/endpoint');
  });
});

// =============================================================================
// useGlobalQuery Tests
// =============================================================================

describe('useGlobalQuery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    mockGet.mockReset();
  });

  it('[P1] should fetch data without publisher context', async () => {
    // GIVEN: API returns data
    const mockData = [{ id: 1, name: 'Template 1' }];
    mockGet.mockResolvedValueOnce(mockData);

    // WHEN: Using the hook
    const { result } = renderHook(
      () => useGlobalQuery<typeof mockData>('templates', '/templates'),
      { wrapper: createWrapper(queryClient) }
    );

    // THEN: Should fetch and return data
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it('[P1] should not include publisher ID in query key', async () => {
    // GIVEN: API returns data
    mockGet.mockResolvedValueOnce([]);

    // WHEN: Using the hook
    const { result } = renderHook(
      () => useGlobalQuery('countries', '/countries'),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // THEN: Query should be cached without publisher ID
    const queryState = queryClient.getQueryState(['countries']);
    expect(queryState).toBeDefined();
  });

  it('[P2] should support array keys', async () => {
    // GIVEN: API returns data
    mockGet.mockResolvedValueOnce({ name: 'USA' });

    // WHEN: Using array key
    const { result } = renderHook(
      () => useGlobalQuery(['country', 'US'], '/countries/US'),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // THEN: Query should be cached with array key
    const queryState = queryClient.getQueryState(['country', 'US']);
    expect(queryState).toBeDefined();
  });
});

// =============================================================================
// usePublisherMutation Tests
// =============================================================================

describe('usePublisherMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    mockPublisherContext.selectedPublisher = { id: 'pub-123', name: 'Test Publisher' };
  });

  it('[P1] should execute POST mutation', async () => {
    // GIVEN: API returns created data
    const newData = { id: 'new-123', name: 'New Item' };
    mockPost.mockResolvedValueOnce(newData);

    // WHEN: Using the mutation
    const { result } = renderHook(
      () => usePublisherMutation<typeof newData, { name: string }>(
        '/publisher/items',
        'POST'
      ),
      { wrapper: createWrapper(queryClient) }
    );

    // Execute mutation
    let response: typeof newData | undefined;
    await act(async () => {
      response = await result.current.mutateAsync({ name: 'New Item' });
    });

    // THEN: Should call POST with body
    expect(mockPost).toHaveBeenCalledWith('/publisher/items', {
      body: JSON.stringify({ name: 'New Item' }),
    });
    expect(response).toEqual(newData);
  });

  it('[P1] should execute PUT mutation', async () => {
    // GIVEN: API returns updated data
    mockPut.mockResolvedValueOnce({ id: '123', name: 'Updated' });

    // WHEN: Using the mutation
    const { result } = renderHook(
      () => usePublisherMutation('/publisher/items/123', 'PUT'),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current.mutateAsync({ name: 'Updated' });
    });

    // THEN: Should call PUT
    expect(mockPut).toHaveBeenCalledWith('/publisher/items/123', {
      body: JSON.stringify({ name: 'Updated' }),
    });
  });

  it('[P1] should execute PATCH mutation', async () => {
    // GIVEN: API returns patched data
    mockPatch.mockResolvedValueOnce({ id: '123', is_active: false });

    // WHEN: Using the mutation
    const { result } = renderHook(
      () => usePublisherMutation('/publisher/items/123', 'PATCH'),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current.mutateAsync({ is_active: false });
    });

    // THEN: Should call PATCH
    expect(mockPatch).toHaveBeenCalledWith('/publisher/items/123', {
      body: JSON.stringify({ is_active: false }),
    });
  });

  it('[P1] should execute DELETE mutation', async () => {
    // GIVEN: API returns success
    mockDelete.mockResolvedValueOnce(undefined);

    // WHEN: Using the mutation
    const { result } = renderHook(
      () => usePublisherMutation<void, undefined>('/publisher/items/123', 'DELETE'),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current.mutateAsync(undefined);
    });

    // THEN: Should call DELETE
    expect(mockDelete).toHaveBeenCalledWith('/publisher/items/123', {
      body: undefined,
    });
  });

  it('[P1] should invalidate queries on success', async () => {
    // GIVEN: Pre-populated cache
    queryClient.setQueryData(['items', 'pub-123'], [{ id: 1 }]);
    queryClient.setQueryData(['items'], [{ id: 1 }]);
    mockPost.mockResolvedValueOnce({ id: 2 });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // WHEN: Mutation succeeds with invalidateKeys
    const { result } = renderHook(
      () => usePublisherMutation('/publisher/items', 'POST', {
        invalidateKeys: ['items'],
      }),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current.mutateAsync({ name: 'New' });
    });

    // THEN: Should invalidate both publisher-scoped and global queries
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['items', 'pub-123'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['items'],
    });
  });

  it('[P2] should call onSuccess callback', async () => {
    // GIVEN: API returns data
    const createdData = { id: 'created-123' };
    mockPost.mockResolvedValueOnce(createdData);
    const onSuccessMock = vi.fn();

    // WHEN: Using mutation with onSuccess
    const { result } = renderHook(
      () => usePublisherMutation<typeof createdData, { name: string }>(
        '/publisher/items',
        'POST',
        { onSuccess: onSuccessMock }
      ),
      { wrapper: createWrapper(queryClient) }
    );

    const variables = { name: 'Test' };
    await act(async () => {
      await result.current.mutateAsync(variables);
    });

    // THEN: onSuccess should be called with data and variables
    expect(onSuccessMock).toHaveBeenCalledWith(createdData, variables);
  });

  it('[P2] should refetch queries when refetchKeys provided', async () => {
    // GIVEN: Pre-populated cache
    queryClient.setQueryData(['items', 'pub-123'], [{ id: 1 }]);
    mockPost.mockResolvedValueOnce({ id: 2 });

    const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

    // WHEN: Mutation succeeds with refetchKeys
    const { result } = renderHook(
      () => usePublisherMutation('/publisher/items', 'POST', {
        refetchKeys: ['items'],
      }),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current.mutateAsync({ name: 'New' });
    });

    // THEN: Should refetch with publisher ID
    expect(refetchSpy).toHaveBeenCalledWith({
      queryKey: ['items', 'pub-123'],
    });
  });
});

// =============================================================================
// useDynamicMutation Tests
// =============================================================================

describe('useDynamicMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    mockPublisherContext.selectedPublisher = { id: 'pub-123', name: 'Test Publisher' };
  });

  it('[P1] should build endpoint from variables', async () => {
    // GIVEN: API returns updated data
    mockPut.mockResolvedValueOnce({ key: 'alos', name: 'Updated' });

    // WHEN: Using dynamic mutation
    const { result } = renderHook(
      () => useDynamicMutation<
        { key: string; name: string },
        { key: string; data: { name: string } }
      >(
        (vars) => `/publisher/zmanim/${vars.key}`,
        'PUT',
        (vars) => vars.data,
        { invalidateKeys: ['publisher-zmanim'] }
      ),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current.mutateAsync({
        key: 'alos',
        data: { name: 'Alos Hashachar' },
      });
    });

    // THEN: Should call correct endpoint with body
    expect(mockPut).toHaveBeenCalledWith('/publisher/zmanim/alos', {
      body: JSON.stringify({ name: 'Alos Hashachar' }),
    });
  });

  it('[P2] should handle DELETE with dynamic endpoint', async () => {
    // GIVEN: API returns success
    mockDelete.mockResolvedValueOnce(undefined);

    // WHEN: Using dynamic delete
    const { result } = renderHook(
      () => useDynamicMutation<void, string>(
        (id) => `/publisher/coverage/${id}`,
        'DELETE',
        () => undefined
      ),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current.mutateAsync('coverage-123');
    });

    // THEN: Should call correct endpoint
    expect(mockDelete).toHaveBeenCalledWith('/publisher/coverage/coverage-123', {
      body: undefined,
    });
  });
});

// =============================================================================
// useDeleteMutation Tests
// =============================================================================

describe('useDeleteMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    mockPublisherContext.selectedPublisher = { id: 'pub-123', name: 'Test Publisher' };
  });

  it('[P1] should append ID to base endpoint', async () => {
    // GIVEN: API returns success
    mockDelete.mockResolvedValueOnce(undefined);

    // WHEN: Using delete mutation
    const { result } = renderHook(
      () => useDeleteMutation('/publisher/zmanim', {
        invalidateKeys: ['publisher-zmanim'],
      }),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current.mutateAsync('alos_hashachar');
    });

    // THEN: Should call DELETE with ID in path
    expect(mockDelete).toHaveBeenCalledWith('/publisher/zmanim/alos_hashachar');
  });

  it('[P1] should invalidate queries on success', async () => {
    // GIVEN: Pre-populated cache
    queryClient.setQueryData(['publisher-zmanim', 'pub-123'], [{ key: 'alos' }]);
    mockDelete.mockResolvedValueOnce(undefined);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // WHEN: Delete succeeds
    const { result } = renderHook(
      () => useDeleteMutation('/publisher/zmanim', {
        invalidateKeys: ['publisher-zmanim'],
      }),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current.mutateAsync('alos');
    });

    // THEN: Should invalidate cache
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['publisher-zmanim', 'pub-123'],
    });
  });
});

// =============================================================================
// useInvalidatePublisherQueries Tests
// =============================================================================

describe('useInvalidatePublisherQueries', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    mockPublisherContext.selectedPublisher = { id: 'pub-123', name: 'Test Publisher' };
  });

  it('[P2] should invalidate multiple query keys', () => {
    // GIVEN: Pre-populated cache
    queryClient.setQueryData(['zmanim', 'pub-123'], []);
    queryClient.setQueryData(['profile', 'pub-123'], {});

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // WHEN: Using invalidate hook
    const { result } = renderHook(
      () => useInvalidatePublisherQueries(),
      { wrapper: createWrapper(queryClient) }
    );

    act(() => {
      result.current(['zmanim', 'profile']);
    });

    // THEN: Should invalidate both keys
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['zmanim', 'pub-123'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['profile', 'pub-123'],
    });
  });
});

// =============================================================================
// usePrefetchPublisherQuery Tests
// =============================================================================

describe('usePrefetchPublisherQuery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    mockPublisherContext.selectedPublisher = { id: 'pub-123', name: 'Test Publisher' };
  });

  it('[P2] should prefetch query with publisher ID', async () => {
    // GIVEN: API returns data
    mockGet.mockResolvedValueOnce({ id: 'alos' });

    const prefetchSpy = vi.spyOn(queryClient, 'prefetchQuery');

    // WHEN: Using prefetch hook
    const { result } = renderHook(
      () => usePrefetchPublisherQuery(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current(['zman', 'alos'], '/publisher/zmanim/alos');
    });

    // THEN: Should prefetch with publisher ID in key
    expect(prefetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['zman', 'alos', 'pub-123'],
      })
    );
  });

  it('[P2] should handle string key', async () => {
    // GIVEN: API returns data
    mockGet.mockResolvedValueOnce({ profile: 'data' });

    const prefetchSpy = vi.spyOn(queryClient, 'prefetchQuery');

    // WHEN: Using prefetch with string key
    const { result } = renderHook(
      () => usePrefetchPublisherQuery(),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current('profile', '/publisher/profile');
    });

    // THEN: Should prefetch with normalized key
    expect(prefetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['profile', 'pub-123'],
      })
    );
  });
});
