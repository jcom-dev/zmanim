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

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLocalitySearch } from '../useLocalitySearch';
import type { LocalitySearchResult } from '@/types/geography';

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

// Mock the locality mapper - properly typed
vi.mock('@/lib/utils/locality-mapper', () => ({
  mapApiLocalityResults: vi.fn((results) => {
    if (!Array.isArray(results)) return [];
    return results.map((r: { id: number; name: string; country?: string }) => ({
      id: String(r.id),
      name: r.name,
      display_name: r.name,
      country_name: r.country || 'Test Country',
      country_code: 'US',
      type: 'locality' as const,
      locality_type_code: 'locality' as const,
    })) as LocalitySearchResult[];
  }),
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
      result.current.search('J');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 350));

      // THEN: Should not call API
      expect(mockPublicGet).not.toHaveBeenCalled();
      expect(result.current.results).toEqual([]);
    });

    it('[P1] should search after debounce delay', async () => {
      // GIVEN: Hook with successful API response
      mockPublicGet.mockResolvedValue([createMockSearchResult({ name: 'Jerusalem' })]);

      const { result } = renderHook(() => useLocalitySearch({ debounce: 100 }));

      // WHEN: Searching
      result.current.search('Jer');

      // Wait for loading state to become true
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // THEN: Should call API after debounce
      await waitFor(
        () => {
          expect(mockPublicGet).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
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
      result.current.search('Jer');

      // THEN: Should have results after API call
      await waitFor(
        () => {
          expect(result.current.results).toHaveLength(2);
        },
        { timeout: 500 }
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('[P1] should debounce rapid queries', async () => {
      // GIVEN: Hook
      mockPublicGet.mockResolvedValue([]);
      const { result } = renderHook(() => useLocalitySearch({ debounce: 200 }));

      // WHEN: Typing rapidly
      result.current.search('J');
      await new Promise((resolve) => setTimeout(resolve, 50));

      result.current.search('Je');
      await new Promise((resolve) => setTimeout(resolve, 50));

      result.current.search('Jer');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 250));

      // THEN: Should only call API once with final query
      await waitFor(() => {
        expect(mockPublicGet).toHaveBeenCalledTimes(1);
      });

      expect(mockPublicGet).toHaveBeenCalledWith(expect.stringContaining('q=Jer'));
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
      result.current.search('Test');

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
      result.current.search('Test');

      // THEN: Should include country_id
      await waitFor(() => {
        expect(mockPublicGet).toHaveBeenCalledWith(expect.stringContaining('country_id=840'));
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
      result.current.search('Test');

      // THEN: Should include region_id
      await waitFor(() => {
        expect(mockPublicGet).toHaveBeenCalledWith(expect.stringContaining('region_id=123'));
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
      result.current.search('Test');

      // THEN: Should include publisher_id
      await waitFor(() => {
        expect(mockPublicGet).toHaveBeenCalledWith(expect.stringContaining('publisher_id=pub-123'));
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
      result.current.search('Test');

      // THEN: Should include exclude
      await waitFor(() => {
        expect(mockPublicGet).toHaveBeenCalledWith(expect.stringContaining('exclude=1%2C2%2C3'));
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
      result.current.search('Test');

      // THEN: Should include limit
      await waitFor(() => {
        expect(mockPublicGet).toHaveBeenCalledWith(expect.stringContaining('limit=50'));
      });
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
      result.current.search('Test');

      // THEN: Should have error
      await waitFor(
        () => {
          expect(result.current.error).toBe('Search failed. Please try again.');
        },
        { timeout: 500 }
      );

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
      result.current.search('Test');

      await waitFor(() => {
        expect(result.current.error).toBe('Search failed. Please try again.');
      });

      // Second search (succeeds)
      result.current.search('Test2');

      // THEN: Error should be cleared and results populated
      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      await waitFor(() => {
        expect(result.current.results).toHaveLength(1);
      });
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

      result.current.search('Test');

      await waitFor(() => {
        expect(result.current.results).toHaveLength(1);
      });

      // WHEN: Clearing
      result.current.clear();

      // THEN: All state should be reset immediately
      await waitFor(() => {
        expect(result.current.results).toEqual([]);
      });
      expect(result.current.query).toBe('');
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
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
      result.current.search('Jer');

      await new Promise((resolve) => setTimeout(resolve, 200));

      // THEN: Should not search
      expect(mockPublicGet).not.toHaveBeenCalled();

      // WHEN: Searching with 4 characters
      result.current.search('Jeru');

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
      result.current.search('Test');

      // After 300ms (less than debounce)
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(mockPublicGet).not.toHaveBeenCalled();

      // After 500ms (debounce complete)
      await new Promise((resolve) => setTimeout(resolve, 250));

      // THEN: Should have called API
      await waitFor(() => {
        expect(mockPublicGet).toHaveBeenCalled();
      });
    });
  });
});
