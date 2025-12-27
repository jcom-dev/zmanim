/**
 * @file useLocationSearch.ts
 * @purpose Shared hook for debounced location search with API calls
 * @pattern hook
 * @compliance useApi:✓ useDebounce:✓
 */

import { useState, useEffect, useRef } from 'react';
import { useDebounce } from './useDebounce';
import { useApi } from '../api-client';

/**
 * Options for configuring the location search hook
 */
export interface UseLocationSearchOptions {
  /** API endpoint to search (default: '/localities/search') */
  endpoint?: string;
  /** Debounce delay in milliseconds (default: 300ms) */
  debounceMs?: number;
  /** Additional query parameters for filtering results */
  filters?: Record<string, string | number | boolean>;
}

/**
 * Return value from useLocationSearch hook
 */
export interface UseLocationSearchReturn<T = Record<string, unknown>> {
  /** Current search query string */
  query: string;
  /** Function to update the search query */
  setQuery: (query: string) => void;
  /** Array of search results */
  results: T[];
  /** Loading state (true while API request is in flight) */
  loading: boolean;
  /** Error message if search failed, null otherwise */
  error: string | null;
}

/**
 * Hook for debounced location search with automatic API calls.
 *
 * Features:
 * - Debounces user input to prevent excessive API calls
 * - Automatically makes API requests when debounced query changes
 * - Cancels pending requests when query changes (prevents race conditions)
 * - Manages loading and error states
 * - Clears results when query is empty
 *
 * @param options - Configuration options for the search
 * @returns Object containing query state, results, loading state, and error
 *
 * @example Basic locality search (using unified /localities/search endpoint)
 * ```tsx
 * function LocalitySearch() {
 *   const { query, setQuery, results, loading, error } = useLocationSearch({
 *     debounceMs: 500,
 *     filters: { types: 'locality', limit: 10 },
 *   });
 *
 *   return (
 *     <div>
 *       <input value={query} onChange={(e) => setQuery(e.target.value)} />
 *       {loading && <p>Searching...</p>}
 *       {error && <p>Error: {error}</p>}
 *       {results.map(r => <div key={r.entity_id}>{r.name}, {r.country_name}</div>)}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Multi-type location search with filters
 * ```tsx
 * function LocationSearch() {
 *   const { query, setQuery, results, loading } = useLocationSearch({
 *     debounceMs: 300,
 *     filters: { types: 'locality,region', limit: 20 },
 *   });
 *
 *   return (
 *     <div>
 *       <input value={query} onChange={(e) => setQuery(e.target.value)} />
 *       {loading ? <Spinner /> : <ResultsList results={results} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useLocationSearch<T = Record<string, unknown>>(
  options: UseLocationSearchOptions = {}
): UseLocationSearchReturn<T> {
  const { endpoint = '/localities/search', debounceMs = 300, filters = {} } = options;
  const api = useApi();

  // State management
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce the query to prevent excessive API calls
  const debouncedQuery = useDebounce(query, debounceMs);

  // Track abort controller for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Effect to perform search when debounced query changes
  useEffect(() => {
    // Clear results if query is too short
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const performSearch = async () => {
      setLoading(true);
      setError(null);

      try {
        // Build query parameters
        const params = new URLSearchParams({
          q: debouncedQuery,
          search: debouncedQuery, // Support both 'q' and 'search' params
          ...filters,
        });

        // Make API request
        const data = await api.public.get<T[] | { localities?: T[]; results?: T[]; data?: T[] }>(`${endpoint}?${params}`, {
          signal: controller.signal,
        });

        // Handle different response formats
        // Some endpoints return { localities: [...] }, others { results: [...] }
        let searchResults: T[] = [];
        if (Array.isArray(data)) {
          searchResults = data;
        } else if (data.localities) {
          searchResults = data.localities;
        } else if (data.results) {
          searchResults = data.results;
        } else if (data.data) {
          searchResults = data.data;
        }

        setResults(searchResults);
      } catch (err: unknown) {
        // Don't set error if request was aborted (user changed query)
        const isAbortError = err instanceof Error && err.name === 'AbortError';
        if (!isAbortError && !controller.signal.aborted) {
          const errorMessage = err instanceof Error ? err.message : 'Search failed';
          setError(errorMessage);
          setResults([]);
        }
      } finally {
        // Only update loading state if this request wasn't aborted
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    performSearch();

    // Cleanup: abort request on unmount or query change
    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, endpoint, JSON.stringify(filters)]);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
  };
}
