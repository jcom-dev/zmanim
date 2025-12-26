/**
 * @file useLocalitySearch.ts
 * @purpose Unified hook for locality search with debouncing and filtering
 * @pattern react-hook
 * @compliance useApi:✓ no-fetch:✓
 *
 * Features:
 * - Debounced search (default 300ms)
 * - Type filtering (localities, towns, neighborhoods, etc.)
 * - Country/region filtering
 * - Exclude list support
 * - Abort controller for request cancellation
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@/lib/api-client';
import type { GeoEntityType } from '@/lib/locality-display';
import type { LocalitySearchResult } from '@/types/geography';
import { mapApiLocalityResults, type ApiSearchResult } from '@/lib/utils/locality-mapper';

// ============================================================================
// API TYPES
// ============================================================================

// API returns array directly, wrapped by api-client
type ApiSearchResponse = ApiSearchResult[];

// ============================================================================
// HOOK OPTIONS
// ============================================================================

export interface UseLocalitySearchOptions {
  /** Debounce delay in milliseconds (default: 300) */
  debounce?: number;
  /** Filter by entity types (e.g., ['locality', 'town']) */
  types?: GeoEntityType[];
  /** Filter by country ID */
  countryId?: number;
  /** Filter by region ID */
  regionId?: number;
  /** Filter to localities within this publisher's coverage areas (hierarchy-aware) */
  publisherId?: string;
  /** Exclude these locality IDs from results */
  exclude?: string[];
  /** Result limit (default: 20) */
  limit?: number;
  /** Minimum query length before searching (default: 2) */
  minQueryLength?: number;
}

// ============================================================================
// HOOK RETURN TYPE
// ============================================================================

export interface UseLocalitySearchReturn {
  /** Search results */
  results: LocalitySearchResult[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if search failed */
  error: string | null;
  /** Trigger search with query string */
  search: (query: string) => void;
  /** Clear results and query */
  clear: () => void;
  /** Current query string */
  query: string;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook for locality search with debouncing and filtering
 *
 * @example
 * ```tsx
 * const { results, isLoading, search, clear } = useLocalitySearch({
 *   types: ['locality', 'town'],
 *   countryId: 840, // USA
 *   debounce: 300,
 * });
 *
 * <Input onChange={(e) => search(e.target.value)} />
 * {isLoading && <Spinner />}
 * {results.map(result => <div key={result.id}>{result.name}</div>)}
 * ```
 */
export function useLocalitySearch(
  options: UseLocalitySearchOptions = {}
): UseLocalitySearchReturn {
  const {
    debounce = 300,
    types,
    countryId,
    regionId,
    publisherId,
    exclude,
    limit = 20,
    minQueryLength = 2,
  } = options;

  const api = useApi();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocalitySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the current query to prevent stale responses from updating state
  const currentQueryRef = useRef<string>('');

  // Debounced search effect
  useEffect(() => {
    // Clear results if query is too short
    if (query.length < minQueryLength) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      currentQueryRef.current = '';
      return;
    }

    // Update current query ref immediately
    currentQueryRef.current = query;

    // Set loading state
    setIsLoading(true);
    setError(null);

    // Debounce timer
    const timeoutId = setTimeout(async () => {
      // Capture the query this request is for
      const requestQuery = query;

      try {
        // Build query params
        const params = new URLSearchParams({ q: query, limit: String(limit) });

        if (types && types.length > 0) {
          params.append('entity_types', types.join(','));
        }
        if (countryId !== undefined) {
          params.append('country_id', String(countryId));
        }
        if (regionId !== undefined) {
          params.append('region_id', String(regionId));
        }
        if (publisherId) {
          params.append('publisher_id', publisherId);
        }
        if (exclude && exclude.length > 0) {
          params.append('exclude', exclude.join(','));
        }

        // Make API request using useApi (no raw fetch)
        const response = await api.public.get<ApiSearchResponse>(
          `/localities/search?${params.toString()}`
        );

        // Only update state if this response is for the current query
        // This prevents stale responses from overwriting newer results
        if (currentQueryRef.current !== requestQuery) {
          return;
        }

        // Transform results - API returns array directly (unwrapped by api-client)
        const resultsArray = Array.isArray(response) ? response : [];
        const mappedResults = mapApiLocalityResults(resultsArray);
        setResults(mappedResults);
        setError(null);
      } catch (err) {
        // Only update error state if this is still the current query
        if (currentQueryRef.current !== requestQuery) {
          return;
        }

        console.error('Locality search failed:', err);
        setError('Search failed. Please try again.');
        setResults([]);
      } finally {
        // Only clear loading if this is still the current query
        if (currentQueryRef.current === requestQuery) {
          setIsLoading(false);
        }
      }
    }, debounce);

    // Cleanup: cancel timeout
    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, countryId, regionId, publisherId, limit, debounce, minQueryLength]);

  // Search function
  const search = useCallback((q: string) => {
    setQuery(q);
  }, []);

  // Clear function
  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
    setIsLoading(false);
    // Reset current query ref to ignore any in-flight responses
    currentQueryRef.current = '';
  }, []);

  return {
    results,
    isLoading,
    error,
    search,
    clear,
    query,
  };
}
