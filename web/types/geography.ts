/**
 * @file geography.ts
 * @purpose Centralized TypeScript type definitions for all geographic/location data
 * @pattern types
 * @compliance coding-standards:✓
 *
 * SINGLE SOURCE OF TRUTH for all geography types across the frontend.
 * All components should import from this file instead of defining their own types.
 */

// ============================================================================
// CORE GEOGRAPHIC TYPES
// ============================================================================

/**
 * Geographic hierarchy levels supported by the system.
 * Maps to the 5-level PostGIS hierarchy in the database.
 */
export type LocationType = 'continent' | 'country' | 'region' | 'district' | 'city';

/**
 * Legacy coverage level type (used by CitySelector).
 * Consider migrating to LocationType for consistency.
 */
export type CoverageLevel = 'country' | 'region' | 'city';

/**
 * Base coordinates interface
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Timezone data
 */
export interface TimezoneInfo {
  timezone: string;
  /** Optional timezone offset in hours (e.g., -5 for EST) */
  offset?: number;
}

// ============================================================================
// LOCATION ENTITIES
// ============================================================================

/**
 * City entity with full geographic details.
 * Returned by /cities API endpoint.
 */
export interface City extends Coordinates {
  id: string;
  name: string;
  country: string;
  country_code: string;
  region: string | null;
  region_type: string | null;
  timezone: string;
  display_name: string;
  /** Optional elevation in meters */
  elevation?: number;
}

/**
 * Country entity.
 * Returned by /countries API endpoint.
 */
export interface Country {
  /** Two-letter ISO country code (e.g., 'US', 'IL') */
  code: string;
  name: string;
  /** Optional country ID (when using integer-based schema) */
  id?: number;
}

/**
 * Region entity (state, province, etc.).
 * Returned by /regions API endpoint.
 */
export interface Region {
  name: string;
  /** Region type (e.g., 'State', 'Province', 'Territory') */
  type: string | null;
  /** Optional region ID (when using integer-based schema) */
  id?: number;
  /** Country code this region belongs to */
  country_code?: string;
}

/**
 * District entity (county, municipality, etc.).
 */
export interface District {
  name: string;
  type: string | null;
  id?: number;
  country_code?: string;
  region?: string;
}

/**
 * Continent entity.
 */
export interface Continent {
  id: number;
  name: string;
  code: string;
}

// ============================================================================
// LOCATION SELECTION & SEARCH
// ============================================================================

/**
 * Unified location selection used across coverage, search, and preview components.
 * Flexible structure that can represent any level of geographic hierarchy.
 */
export interface LocationSelection {
  /** Geographic level */
  type: LocationType;
  /** Unique identifier (database ID) */
  id: string;
  /** Display name */
  name: string;
  /** Optional description for search results */
  description?: string;
  /** Country code (ISO 2-letter) */
  country_code?: string;

  // City-specific fields (populated for type='city')
  latitude?: number;
  longitude?: number;
  timezone?: string;
  display_name?: string;
  region?: string | null;
  elevation?: number;
}

/**
 * Search result from universal location search API.
 * Used by LocationSearch and CoverageSearchPanel components.
 */
export interface LocationSearchResult {
  type: LocationType;
  id: string;
  name: string;
  description: string;
  country_code: string;

  // City-specific fields
  latitude?: number;
  longitude?: number;
  timezone?: string;
  display_name?: string;
  region?: string | null;
}

/**
 * Legacy coverage selection format (used by CitySelector).
 * Consider migrating to LocationSelection for consistency.
 */
export interface CoverageSelection {
  level: CoverageLevel;
  countryCode?: string;
  countryName?: string;
  region?: string;
  cityId?: string;
  cityName?: string;
  displayName: string;
}

// ============================================================================
// COVERAGE MANAGEMENT
// ============================================================================

/**
 * Coverage item for map visualization.
 * Lightweight representation used by CoveragePreviewMap.
 */
export interface CoverageItem {
  type: LocationType;
  id: string;
  name: string;
  country_code?: string;
}

/**
 * Publisher coverage entity (from database).
 * Full coverage record with all database fields.
 */
export interface Coverage {
  id: string;
  publisher_id: string;
  coverage_level_id: number;
  coverage_level_key: LocationType;

  // ID-based fields (integer FKs per coding standards)
  continent_id: number | null;
  country_id: number | null;
  region_id: number | null;
  district_id: number | null;
  city_id: number | null;

  // Display fields (joined from geo tables)
  name: string;
  country_code?: string;
  display_name?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}

// ============================================================================
// MAP & GEOJSON
// ============================================================================

/**
 * GeoJSON Feature properties for coverage display
 */
export interface CoverageFeatureProperties {
  id: string;
  name: string;
  type: LocationType;
  country_code?: string;
  /** 'existing' (green) or 'selected' (blue) */
  coverage_type?: 'existing' | 'selected';
}

/**
 * Bounding box coordinates [minLng, minLat, maxLng, maxLat]
 */
export type BoundingBox = [number, number, number, number];

// ============================================================================
// LOCATION OVERRIDES (Epic 6)
// ============================================================================

/**
 * Publisher-specific location data override.
 * Allows publishers to correct city coordinates, elevation, or timezone.
 */
export interface PublisherLocationOverride {
  id: number;
  publisher_id: number;
  city_id: number;
  city_name?: string;
  country_name?: string;

  // Override fields (null = use original)
  override_latitude?: number | null;
  override_longitude?: number | null;
  override_elevation?: number | null;

  reason?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Request to create a location override
 */
export interface LocationOverrideCreateRequest {
  override_latitude?: number | null;
  override_longitude?: number | null;
  override_elevation?: number | null;
  reason?: string;
}

/**
 * Response for list of location overrides
 */
export interface LocationOverridesListResponse {
  overrides: PublisherLocationOverride[];
  total: number;
}

/**
 * Public correction request for city data.
 * Requires admin approval to affect all users.
 */
export interface CityDataCorrectionRequest {
  id: string;
  city_id: string;
  requester_id: string;

  // Proposed corrections (null = no change)
  proposed_latitude: number | null;
  proposed_longitude: number | null;
  proposed_elevation: number | null;

  reason: string;
  comment: string;
  evidence_urls: string[] | null;

  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;

  created_at: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Helper type to extract city-specific fields from LocationSelection
 */
export type CityLocation = Required<Pick<LocationSelection, 'latitude' | 'longitude' | 'timezone'>> & LocationSelection;

/**
 * Type guard to check if location is a city with coordinates
 */
export function isCityLocation(location: LocationSelection): location is CityLocation {
  return location.type === 'city'
    && location.latitude !== undefined
    && location.longitude !== undefined
    && location.timezone !== undefined;
}

/**
 * Convert LocationSelection to CoverageItem (for map display)
 */
export function toCoverageItem(location: LocationSelection): CoverageItem {
  return {
    type: location.type,
    id: location.id,
    name: location.name,
    country_code: location.country_code,
  };
}

/**
 * Convert City to LocationSelection
 */
export function cityToLocationSelection(city: City): LocationSelection {
  return {
    type: 'city',
    id: city.id,
    name: city.name,
    description: city.display_name,
    country_code: city.country_code,
    latitude: city.latitude,
    longitude: city.longitude,
    timezone: city.timezone,
    display_name: city.display_name,
    region: city.region,
    elevation: city.elevation,
  };
}
