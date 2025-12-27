/**
 * Hook for managing publisher coverage areas
 *
 * Provides queries and mutations for coverage operations with automatic cache invalidation.
 */

import { usePublisherQuery, usePublisherMutation, useDynamicMutation } from './useApiQuery';

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

interface PublisherCoverageResponse {
  is_global: boolean;
  coverage: Coverage[];
  total: number;
}

interface AddCoverageRequest {
  coverage_level: 'continent' | 'country' | 'region' | 'locality';
  continent_code?: string;
  country_id?: number;
  region_id?: number;
  locality_id?: number;
}

/**
 * Hook for publisher coverage management
 *
 * @example
 * ```tsx
 * const { coverage, addCoverage, deleteCoverage, toggleActive } = usePublisherCoverage();
 *
 * // Add coverage
 * await addCoverage.mutateAsync({
 *   coverage_level: 'locality',
 *   locality_id: 123
 * });
 *
 * // Delete coverage
 * await deleteCoverage.mutateAsync('coverage-id');
 *
 * // Toggle active status
 * await toggleActive.mutateAsync({
 *   id: 'coverage-id',
 *   is_active: false
 * });
 * ```
 */
export function usePublisherCoverage() {
  // Query for coverage list
  const coverage = usePublisherQuery<PublisherCoverageResponse>(
    'publisher-coverage',
    '/publisher/coverage'
  );

  // Add coverage mutation
  const addCoverage = usePublisherMutation<Coverage, AddCoverageRequest>(
    '/publisher/coverage',
    'POST',
    { invalidateKeys: ['publisher-coverage', 'publisher-zmanim'] }
  );

  // Delete coverage mutation
  const deleteCoverage = useDynamicMutation<void, string>(
    (id) => `/publisher/coverage/${id}`,
    'DELETE',
    () => undefined,
    { invalidateKeys: ['publisher-coverage', 'publisher-zmanim'] }
  );

  // Toggle active status mutation
  const toggleActive = useDynamicMutation<Coverage, { id: string; is_active: boolean }>(
    (vars) => `/publisher/coverage/${vars.id}`,
    'PUT',
    (vars) => ({ is_active: vars.is_active }),
    { invalidateKeys: ['publisher-coverage'] }
  );

  return {
    coverage: coverage.data,
    isLoading: coverage.isLoading,
    error: coverage.error,
    refetch: coverage.refetch,
    addCoverage,
    deleteCoverage,
    toggleActive,
  };
}
