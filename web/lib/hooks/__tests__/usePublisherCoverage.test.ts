/**
 * @file usePublisherCoverage.test.ts
 * @purpose Unit tests for usePublisherCoverage hook
 * @priority P1 - Core publisher coverage management
 *
 * Tests cover:
 * - Coverage data fetching
 * - Add coverage mutation
 * - Delete coverage mutation
 * - Toggle active status mutation
 * - Return value structure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { usePublisherCoverage } from '../usePublisherCoverage';

// =============================================================================
// Types
// =============================================================================

/** Coverage type matching the hook's internal interface */
interface Coverage {
  id: string;
  publisher_id: string;
  coverage_level_id: number;
  coverage_level_key: 'continent' | 'country' | 'region' | 'locality';
  continent_id: number | null;
  country_id: number | null;
  region_id: number | null;
  locality_id: number | null;
  continent_name: string | null;
  country_code: string | null;
  country_name: string | null;
  region_code: string | null;
  region_name: string | null;
  locality_name: string | null;
  locality_count: number;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Mock Setup
// =============================================================================

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/lib/api-client', () => ({
  useApi: () => ({
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
  }),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status?: number) {
      super(message);
    }
  },
}));

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

function createMockCoverageResponse() {
  return {
    is_global: false,
    coverage: [
      {
        id: 'cov-1',
        publisher_id: 'pub-123',
        coverage_level_id: 4,
        coverage_level_key: 'locality' as const,
        continent_id: null,
        country_id: 1,
        region_id: 36,
        locality_id: 123,
        continent_name: null,
        country_code: 'US',
        country_name: 'United States',
        region_code: 'NY',
        region_name: 'New York',
        locality_name: 'New York City',
        locality_count: 1,
        priority: 1,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ],
    total: 1,
  };
}

// =============================================================================
// usePublisherCoverage Tests
// =============================================================================

describe('usePublisherCoverage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    mockPublisherContext.selectedPublisher = { id: 'pub-123', name: 'Test Publisher' };
    mockPublisherContext.isLoading = false;
  });

  it('[P1] should fetch coverage data', async () => {
    // GIVEN: API returns coverage
    const mockResponse = createMockCoverageResponse();
    mockGet.mockResolvedValueOnce(mockResponse);

    // WHEN: Hook is called
    const { result } = renderHook(() => usePublisherCoverage(), {
      wrapper: createWrapper(queryClient),
    });

    // THEN: Should fetch and return coverage
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.coverage).toEqual(mockResponse);
    expect(result.current.error).toBeNull();
  });

  it('[P1] should return correct structure', async () => {
    // GIVEN: API returns coverage
    mockGet.mockResolvedValueOnce(createMockCoverageResponse());

    // WHEN: Hook is called
    const { result } = renderHook(() => usePublisherCoverage(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // THEN: Should have correct return structure
    expect(result.current).toHaveProperty('coverage');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('refetch');
    expect(result.current).toHaveProperty('addCoverage');
    expect(result.current).toHaveProperty('deleteCoverage');
    expect(result.current).toHaveProperty('toggleActive');
  });

  it('[P1] should provide working addCoverage mutation', async () => {
    // GIVEN: API returns initial coverage
    mockGet.mockResolvedValueOnce(createMockCoverageResponse());

    // AND: Add coverage API succeeds
    const newCoverage = {
      id: 'cov-2',
      publisher_id: 'pub-123',
      coverage_level_id: 2,
      coverage_level_key: 'country' as const,
      continent_id: null,
      country_id: 2,
      region_id: null,
      locality_id: null,
      continent_name: null,
      country_code: 'IL',
      country_name: 'Israel',
      region_code: null,
      region_name: null,
      locality_name: null,
      locality_count: 0,
      priority: 2,
      is_active: true,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    };
    mockPost.mockResolvedValueOnce(newCoverage);

    // WHEN: Hook is called
    const { result } = renderHook(() => usePublisherCoverage(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // AND: Add coverage is called
    let addedCoverage: Coverage | undefined;
    await act(async () => {
      addedCoverage = await result.current.addCoverage.mutateAsync({
        coverage_level: 'country',
        country_id: 2,
      });
    });

    // THEN: Should call POST and return new coverage
    expect(mockPost).toHaveBeenCalledWith('/publisher/coverage', {
      body: JSON.stringify({
        coverage_level: 'country',
        country_id: 2,
      }),
    });
    expect(addedCoverage).toEqual(newCoverage);
  });

  it('[P1] should provide working deleteCoverage mutation', async () => {
    // GIVEN: API returns initial coverage
    mockGet.mockResolvedValueOnce(createMockCoverageResponse());

    // AND: Delete coverage API succeeds
    mockDelete.mockResolvedValueOnce(undefined);

    // WHEN: Hook is called
    const { result } = renderHook(() => usePublisherCoverage(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // AND: Delete coverage is called
    await act(async () => {
      await result.current.deleteCoverage.mutateAsync('cov-1');
    });

    // THEN: Should call DELETE with correct endpoint
    expect(mockDelete).toHaveBeenCalledWith('/publisher/coverage/cov-1', {
      body: undefined,
    });
  });

  it('[P1] should provide working toggleActive mutation', async () => {
    // GIVEN: API returns initial coverage
    mockGet.mockResolvedValueOnce(createMockCoverageResponse());

    // AND: Toggle API succeeds
    const updatedCoverage = {
      ...createMockCoverageResponse().coverage[0],
      is_active: false,
    };
    mockPut.mockResolvedValueOnce(updatedCoverage);

    // WHEN: Hook is called
    const { result } = renderHook(() => usePublisherCoverage(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // AND: Toggle is called
    let toggledCoverage: Coverage | undefined;
    await act(async () => {
      toggledCoverage = await result.current.toggleActive.mutateAsync({
        id: 'cov-1',
        is_active: false,
      });
    });

    // THEN: Should call PUT with correct endpoint and body
    expect(mockPut).toHaveBeenCalledWith('/publisher/coverage/cov-1', {
      body: JSON.stringify({ is_active: false }),
    });
    expect(toggledCoverage?.is_active).toBe(false);
  });

  it('[P2] should handle API error', async () => {
    // GIVEN: API returns error
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch coverage'));

    // WHEN: Hook is called
    const { result } = renderHook(() => usePublisherCoverage(), {
      wrapper: createWrapper(queryClient),
    });

    // THEN: Should return error state
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.coverage).toBeUndefined();
  });

  it('[P2] should support refetch', async () => {
    // GIVEN: API returns different data on each call
    mockGet
      .mockResolvedValueOnce({ is_global: false, coverage: [], total: 0 })
      .mockResolvedValueOnce(createMockCoverageResponse());

    // WHEN: Hook is called
    const { result } = renderHook(() => usePublisherCoverage(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.coverage?.total).toBe(0));

    // AND: Refetch is called
    await act(async () => {
      await result.current.refetch();
    });

    // THEN: Should have updated data
    await waitFor(() => expect(result.current.coverage?.total).toBe(1));
  });

  it('[P2] should handle add coverage with different levels', async () => {
    // GIVEN: API setup
    mockGet.mockResolvedValueOnce(createMockCoverageResponse());

    const localityCoverage = {
      id: 'cov-new',
      publisher_id: 'pub-123',
      coverage_level_id: 4,
      coverage_level_key: 'locality' as const,
      locality_id: 456,
      is_active: true,
    };
    mockPost.mockResolvedValueOnce(localityCoverage);

    // WHEN: Hook is called
    const { result } = renderHook(() => usePublisherCoverage(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // AND: Add locality coverage
    await act(async () => {
      await result.current.addCoverage.mutateAsync({
        coverage_level: 'locality',
        locality_id: 456,
      });
    });

    // THEN: Should send correct payload
    expect(mockPost).toHaveBeenCalledWith('/publisher/coverage', {
      body: JSON.stringify({
        coverage_level: 'locality',
        locality_id: 456,
      }),
    });
  });

  it('[P3] should handle global coverage', async () => {
    // GIVEN: API returns global coverage
    mockGet.mockResolvedValueOnce({
      is_global: true,
      coverage: [],
      total: 0,
    });

    // WHEN: Hook is called
    const { result } = renderHook(() => usePublisherCoverage(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // THEN: Should return is_global true
    expect(result.current.coverage?.is_global).toBe(true);
  });

  it('[P3] should handle mutation errors gracefully', async () => {
    // GIVEN: API returns initial coverage
    mockGet.mockResolvedValueOnce(createMockCoverageResponse());

    // AND: Mutation fails
    mockPost.mockRejectedValueOnce(new Error('Duplicate coverage'));

    // WHEN: Hook is called
    const { result } = renderHook(() => usePublisherCoverage(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // AND: Add coverage fails
    await act(async () => {
      try {
        await result.current.addCoverage.mutateAsync({
          coverage_level: 'country',
          country_id: 1,
        });
      } catch {
        // Expected to throw
      }
    });

    // THEN: Mutation should have error state (wait for state update)
    await waitFor(() => expect(result.current.addCoverage.isError).toBe(true));
  });
});
