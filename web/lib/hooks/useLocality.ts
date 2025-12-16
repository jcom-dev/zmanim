/**
 * @file useLocality.ts
 * @purpose Hook for fetching a single locality by ID
 * @pattern react-hook
 * @compliance useApi:✓ no-fetch:✓
 *
 * Provides a simple interface for fetching locality details from the API.
 * Used when you have a locality ID and need to retrieve its full details.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/lib/api-client';
import type { LocalitySearchResult } from '@/types/geography';

// ============================================================================
// HOOK OPTIONS
// ============================================================================

export interface UseLocalityOptions {
  /** Locality ID to fetch */
  id: string | number | null | undefined;
  /** Enable/disable the fetch (default: true) */
  enabled?: boolean;
}

// ============================================================================
// HOOK RETURN TYPE
// ============================================================================

export interface UseLocalityResult {
  /** Locality data (null if not loaded or error) */
  locality: LocalitySearchResult | null;
  /** Loading state */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Manually trigger refetch */
  refetch: () => void;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * API response type (matches /localities/{id} endpoint)
 * This is the raw structure returned by the backend
 */
interface ApiLocalityResponse {
  id: string;
  name: string;
  country: string;
  country_code: string;
  region: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  elevation: number | null;
  continent: string | null;
  display_name: string;
  parent_locality_id: string | null;
  children_count: number;
}

/**
 * Transform API response to LocalitySearchResult format
 */
function mapApiLocality(api: ApiLocalityResponse): LocalitySearchResult {
  return {
    type: 'locality',
    id: api.id,
    name: api.name,
    locality_type_code: 'locality',
    country_code: api.country_code,
    country_name: api.country,
    country: api.country, // Alias for backward compatibility
    region_name: api.region || undefined,
    latitude: api.latitude,
    longitude: api.longitude,
    timezone: api.timezone,
    elevation: api.elevation || undefined,
    display_name: api.display_name,
    description: api.display_name,
  };
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook for fetching a single locality by ID
 *
 * @example
 * ```tsx
 * const { locality, isLoading, error, refetch } = useLocality({ id: savedLocalityId });
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <div>Error: {error.message}</div>;
 * if (!locality) return <div>Locality not found</div>;
 *
 * return <div>{locality.name}, {locality.country_name}</div>;
 * ```
 */
export function useLocality(options: UseLocalityOptions): UseLocalityResult {
  const { id, enabled = true } = options;

  const api = useApi();
  const [locality, setLocality] = useState<LocalitySearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch locality by ID
  const fetchLocality = useCallback(async () => {
    // Skip if disabled or no ID
    if (!enabled || !id) {
      setLocality(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // API returns locality object directly (unwrapped by api-client)
      const response = await api.public.get<ApiLocalityResponse>(`/localities/${id}`);

      if (response) {
        const mappedLocality = mapApiLocality(response);
        setLocality(mappedLocality);
      } else {
        setLocality(null);
      }
    } catch (err) {
      console.error('Failed to fetch locality:', err);
      const errorObj = err instanceof Error ? err : new Error('Failed to fetch locality');
      setError(errorObj);
      setLocality(null);
    } finally {
      setIsLoading(false);
    }
  }, [api, id, enabled]);

  // Auto-fetch on mount or when id/enabled changes
  useEffect(() => {
    fetchLocality();
  }, [fetchLocality]);

  // Refetch function (useful for manual refresh)
  const refetch = useCallback(() => {
    fetchLocality();
  }, [fetchLocality]);

  return {
    locality,
    isLoading,
    error,
    refetch,
  };
}
