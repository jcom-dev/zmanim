/**
 * @file locality-mapper.ts
 * @purpose Shared utility for mapping API locality search results to frontend types
 * @pattern utility
 * @compliance coding-standards:✓
 *
 * Eliminates duplicate mapping logic across the codebase by providing
 * centralized transformation functions for API search results.
 */

import type { LocalitySearchResult, LocalityTypeCode } from '@/types/geography';

// ============================================================================
// API TYPES (from backend search endpoints)
// ============================================================================

/**
 * API search result shape from /localities/search endpoint
 */
export interface ApiSearchResult {
  entity_id: number;
  entity_type?: string;
  name: string;
  display_name: string;
  display_hierarchy?: string;
  country_code?: string;
  country_name?: string;
  region_name?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  locality_type_id?: number;
  parent_locality_id?: number;
  children_count?: number;
  population?: number;
  display_names?: Record<string, string>;
}

// ============================================================================
// MAPPING FUNCTIONS
// ============================================================================

/**
 * Map locality_type_id to LocalityTypeCode
 */
function mapLocalityType(typeId?: number): LocalityTypeCode | undefined {
  if (!typeId) return undefined;
  const typeMap: Record<number, LocalityTypeCode> = {
    1: 'locality',
    2: 'town',
    3: 'village',
    4: 'hamlet',
    5: 'neighborhood',
    6: 'borough',
  };
  return typeMap[typeId];
}

/**
 * Parse hierarchy string to extract country and region names
 * Format: "London, England, United Kingdom" or "London, United Kingdom"
 */
function parseHierarchy(hierarchy: string): { country_name?: string; region_name?: string } {
  const parts = hierarchy.split(', ');
  if (parts.length >= 2) {
    return {
      country_name: parts[parts.length - 1],
      region_name: parts.length > 2 ? parts[parts.length - 2] : undefined,
    };
  }
  return {};
}

/**
 * Transform a single API search result to LocalitySearchResult
 *
 * @param api - Raw API search result
 * @returns Mapped LocalitySearchResult for frontend consumption
 */
export function mapApiLocalityResult(api: ApiSearchResult): LocalitySearchResult {
  const parsed = parseHierarchy(api.display_hierarchy || '');
  const localityType = mapLocalityType(api.locality_type_id);

  return {
    type: localityType || (api.entity_type as LocalityTypeCode) || 'locality',
    id: String(api.entity_id),
    name: api.display_name,
    locality_type_code: localityType,
    description: api.display_hierarchy,
    country_code: api.country_code || '',
    latitude: api.latitude,
    longitude: api.longitude,
    timezone: api.timezone,
    display_hierarchy: api.display_hierarchy,
    display_names: api.display_names,
    country_name: parsed.country_name || api.country_name,
    country: parsed.country_name || api.country_name, // Alias for backward compatibility
    region_name: parsed.region_name || api.region_name,
    population: api.population,
  };
}

/**
 * Transform an array of API search results to LocalitySearchResult[]
 *
 * @param results - Array of raw API search results
 * @returns Mapped array of LocalitySearchResult for frontend consumption
 */
export function mapApiLocalityResults(results: ApiSearchResult[]): LocalitySearchResult[] {
  return results.map(mapApiLocalityResult);
}
