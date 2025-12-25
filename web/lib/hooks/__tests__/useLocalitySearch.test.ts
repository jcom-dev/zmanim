/**
 * @file useLocalitySearch.test.ts
 * @purpose Unit tests for useLocalitySearch hook
 * @priority P1 - Core search functionality
 *
 * Tests cover:
 * - Debounced search behavior
 * - Query parameter building
 * - Stale response handling
 * - Error handling
 * - Clear functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLocalitySearch, type UseLocalitySearchOptions } from '../useLocalitySearch';

// =============================================================================
// Mock Setup
// =============================================================================

// Mock the api-client
const mockPublicGet = vi.fn();

vi.mock('@/lib/api-client', () => ({
  useApi: () => ({
    public: {
      get: mockPublicGet,
    },
  }),
}));

// Mock the locality mapper
vi.mock('@/lib/utils/locality-mapper', () => ({
  mapApiLocalityResults: vi.fn((results) =>
    results.map((r: { id: number; name: string }) => ({
      id: r.id,
      name: r.name,
      displayName: r.name,
    }))
  ),
}));

// =============================================================================
// Test Helpers
// =============================================================================

function createMockSearchResult(overrides: Partial<{ id: number; name: string }> = {}) {
  return {
    id: Math.floor(Math.random() * 10000),
    name: 'Test City',
    country: 'Test Country',
    region: 'Test Region',
    ...overrides,
  };
}

// =============================================================================
// useLocalitySearch Tests
// =============================================================================

describe('useLocalitySearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // Initialization Tests
  // ===========================================================================

  describe('initialization', () => {
    it('[P1] should initialize with empty state', () => {
      // WHEN: Hook is rendered
      const { result } = renderHook(() => useLocalitySearch());

      // THEN: Should have empty initial state
      expect(result.current.results).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.query).toBe('');
    });

    it('[P2] should use default options when none provided', () => {
      // WHEN: Hook is rendered without options
      const { result } = renderHook(() => useLocalitySearch());

      // THEN: Should have default values
      // Default behavior is verified by search behavior tests below
      expect(result.current.results).toEqual([]);
      expect(result.current.query).toBe('');
    });
  });

  // ===========================================================================
  // Search Behavior Tests
  // ===========================================================================

  describe('search behavior', () => {
    it('[P1] should not search when query is too short', async () => {
      // GIVEN: Hook with default minQueryLength (2)
      const { result } = renderHook(() => useLocalitySearch());

      // WHEN: Searching with short query
      act(() => {
        result.current.search('J');
      });

      // Advance timers past debounce
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // THEN: Should not call API
      expect(mockPublicGet).not.toHaveBeenCalled();
      expect(result.current.results).toEqual([]);
    });

    it('[P1] should search after debounce delay', async () => {
      // GIVEN: Hook with successful API response
      mockPublicGet.mockResolvedValue([createMockSearchResult({ name: 'Jerusalem' })]);

      const { result } = renderHook(() => useLocalitySearch({ debounce: 300 }));

      // WHEN: Searching
      act(() => {
        result.current.search('Jer');
      });

      // Before debounce - should be loading but no API call yet
      expect(result.current.isLoading).toBe(true);
      expect(mockPublicGet).not.toHaveBeenCalled();

      // After debounce
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // THEN: Should call API
      await waitFor(() => {
        expect(mockPublicGet).toHaveBeenCalled();
      });
    });

    it('[P1] should debounce rapid queries', async () => {
      // GIVEN: Hook
      mockPublicGet.mockResolvedValue([]);
      const { result } = renderHook(() => useLocalitySearch({ debounce: 300 }));

      // WHEN: Typing rapidly
      act(() => {
        result.current.search('J');
      });
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.search('Je');
      });
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.search('Jer');
      });
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // THEN: Should only call API once with final query
      await waitFor(() => {
        expect(mockPublicGet).toHaveBeenCalledTimes(1);
      });

      expect(mockPublicGet).toHaveBeenCalledWith(
        expect.stringContaining('q=Jer')
      );
    });

    it('[P1] should update results on successful search', async () => {
      // GIVEN: API returns results
      const mockResults = [
        createMockSearchResult({ id: 1, name: 'Jerusalem' }),
        createMockSearchResult({ id: 2, name: 'Jericho' }),
      ];
      mockPublicGet.mockResolvedValue(mockResults);

      const { result } = renderHook(() => useLocalitySearch({ debounce: 100 }));

      // WHEN: Searching
      act(() => {
        result.current.search('Jer');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // THEN: Should have results
      await waitFor(() => {
        expect(result.current.results).toHaveLength(2);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  // ===========================================================================
  // Query Parameter Tests
  // ===========================================================================

  describe('query parameters', () => {
    it('[P1] should include type filter in request', async () => {
      // GIVEN: Hook with type filter
      mockPublicGet.mockResolvedValue([]);
      const { result } = renderHook(() =>
        useLocalitySearch({
          types: ['locality', 'town'],
          debounce: 100,
        })
      );

      // WHEN: Searching
      act(() => {
        result.current.search('Test');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // THEN: Should include entity_types
      await waitFor(() => {
        expect(mockPublicGet).toHaveBeenCalledWith(
          expect.stringContaining('entity_types=locality%2Ctown')
        );
      });
    });

    it('[P1] should include country filter in request', async () => {
      // GIVEN: Hook with country filter
      mockPublicGet.mockResolvedValue([]);
      const { result } = renderHook(() =>
        useLocalitySearch({
          countryId: 840,
          debounce: 100,
        })
      );

      // WHEN: Searching
      act(() => {
        result.current.search('Test');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // THEN: Should include country_id
      await waitFor(() => {
        expect(mockPublicGet).toHaveBeenCalledWith(
          expect.stringContaining('country_id=840')
        );
      });
    });

    it('[P2] should include region filter in request', async () => {
      // GIVEN: Hook with region filter
      mockPublicGet.mockResolvedValue([]);
      const { result } = renderHook(() =>
        useLocalitySearch({
          regionId: 123,
          debounce: 100,
        })
      );

      // WHEN: Searching
      act(() => {
        result.current.search('Test');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // THEN: Should include region_id
      await waitFor(() => {
        expect(mockPublicGet).toHaveBeenCalledWith(
          expect.stringContaining('region_id=123')
        );
      });
    });

    it('[P2] should include publisher filter for coverage search', async () => {
      // GIVEN: Hook with publisher filter
      mockPublicGet.mockResolvedValue([]);
      const { result } = renderHook(() =>
        useLocalitySearch({
          publisherId: 'pub-123',
          debounce: 100,
        })
      );

      // WHEN: Searching
      act(() => {
        result.current.search('Test');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // THEN: Should include publisher_id
      await waitFor(() => {
        expect(mockPublicGet).toHaveBeenCalledWith(
          expect.stringContaining('publisher_id=pub-123')
        );
      });
    });

    it('[P2] should include exclude list in request', async () => {
      // GIVEN: Hook with exclude list
      mockPublicGet.mockResolvedValue([]);
      const { result } = renderHook(() =>
        useLocalitySearch({
          exclude: ['1', '2', '3'],
          debounce: 100,
        })
      );

      // WHEN: Searching
      act(() => {
        result.current.search('Test');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // THEN: Should include exclude
      await waitFor(() => {
        expect(mockPublicGet).toHaveBeenCalledWith(
          expect.stringContaining('exclude=1%2C2%2C3')
        );
      });
    });

    it('[P2] should respect custom limit', async () => {
      // GIVEN: Hook with custom limit
      mockPublicGet.mockResolvedValue([]);
      const { result } = renderHook(() =>
        useLocalitySearch({
          limit: 50,
          debounce: 100,
        })
      );

      // WHEN: Searching
      act(() => {
        result.current.search('Test');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // THEN: Should include limit
      await waitFor(() => {
        expect(mockPublicGet).toHaveBeenCalledWith(
          expect.stringContaining('limit=50')
        );
      });
    });
  });

  // ===========================================================================
  // Stale Response Handling Tests
  // ===========================================================================

  describe('stale response handling', () => {
    it('[P1] should ignore stale responses when query changes', async () => {
      // GIVEN: Slow first response, fast second response
      let resolveFirst: (value: unknown[]) => void;
      const firstPromise = new Promise<unknown[]>((resolve) => {
        resolveFirst = resolve;
      });

      mockPublicGet
        .mockImplementationOnce(() => firstPromise)
        .mockResolvedValueOnce([createMockSearchResult({ name: 'New York' })]);

      const { result } = renderHook(() => useLocalitySearch({ debounce: 100 }));

      // WHEN: First search
      act(() => {
        result.current.search('Old');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Second search while first is pending
      act(() => {
        result.current.search('New');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Now resolve the first (stale) response after second completes
      await act(async () => {
        // Wait for second response
        await waitFor(() => {
          expect(result.current.results).toHaveLength(1);
        });

        // Resolve stale first response
        resolveFirst!([createMockSearchResult({ name: 'Old Result' })]);
      });

      // THEN: Should have second result, not first
      expect(result.current.results[0].name).toBe('New York');
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('[P1] should set error state on API failure', async () => {
      // GIVEN: API fails
      mockPublicGet.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useLocalitySearch({ debounce: 100 }));

      // WHEN: Searching
      act(() => {
        result.current.search('Test');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // THEN: Should have error
      await waitFor(() => {
        expect(result.current.error).toBe('Search failed. Please try again.');
      });

      expect(result.current.results).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('[P2] should clear error on new successful search', async () => {
      // GIVEN: First search fails, second succeeds
      mockPublicGet
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([createMockSearchResult()]);

      const { result } = renderHook(() => useLocalitySearch({ debounce: 100 }));

      // First search (fails)
      act(() => {
        result.current.search('Test');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Search failed. Please try again.');
      });

      // Second search (succeeds)
      act(() => {
        result.current.search('Test2');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // THEN: Error should be cleared
      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(result.current.results).toHaveLength(1);
    });
  });

  // ===========================================================================
  // Clear Function Tests
  // ===========================================================================

  describe('clear function', () => {
    it('[P1] should reset all state', async () => {
      // GIVEN: Hook with results
      mockPublicGet.mockResolvedValue([createMockSearchResult()]);

      const { result } = renderHook(() => useLocalitySearch({ debounce: 100 }));

      act(() => {
        result.current.search('Test');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(result.current.results).toHaveLength(1);
      });

      // WHEN: Clearing
      act(() => {
        result.current.clear();
      });

      // THEN: All state should be reset
      expect(result.current.results).toEqual([]);
      expect(result.current.query).toBe('');
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('[P2] should prevent pending requests from updating state', async () => {
      // GIVEN: Slow API response
      let resolveRequest: (value: unknown[]) => void;
      const slowPromise = new Promise<unknown[]>((resolve) => {
        resolveRequest = resolve;
      });
      mockPublicGet.mockImplementationOnce(() => slowPromise);

      const { result } = renderHook(() => useLocalitySearch({ debounce: 100 }));

      // Start search
      act(() => {
        result.current.search('Test');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Clear before response
      act(() => {
        result.current.clear();
      });

      // Resolve the pending request
      await act(async () => {
        resolveRequest!([createMockSearchResult()]);
      });

      // THEN: Results should still be empty
      expect(result.current.results).toEqual([]);
      expect(result.current.query).toBe('');
    });
  });

  // ===========================================================================
  // Custom Options Tests
  // ===========================================================================

  describe('custom options', () => {
    it('[P2] should respect custom minQueryLength', async () => {
      // GIVEN: Hook with custom minQueryLength
      mockPublicGet.mockResolvedValue([]);
      const { result } = renderHook(() =>
        useLocalitySearch({
          minQueryLength: 4,
          debounce: 100,
        })
      );

      // WHEN: Searching with 3 characters
      act(() => {
        result.current.search('Jer');
      });

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // THEN: Should not search
      expect(mockPublicGet).not.toHaveBeenCalled();

      // WHEN: Searching with 4 characters
      act(() => {
        result.current.search('Jeru');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // THEN: Should search
      await waitFor(() => {
        expect(mockPublicGet).toHaveBeenCalled();
      });
    });

    it('[P2] should respect custom debounce delay', async () => {
      // GIVEN: Hook with custom debounce
      mockPublicGet.mockResolvedValue([]);
      const { result } = renderHook(() =>
        useLocalitySearch({
          debounce: 500,
        })
      );

      // WHEN: Searching
      act(() => {
        result.current.search('Test');
      });

      // After 300ms (less than debounce)
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(mockPublicGet).not.toHaveBeenCalled();

      // After 500ms (debounce complete)
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // THEN: Should have called API
      await waitFor(() => {
        expect(mockPublicGet).toHaveBeenCalled();
      });
    });
  });
});
