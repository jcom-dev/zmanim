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
export type LocationType = 'continent' | 'country' | 'region' | 'locality';

/**
 * Coverage level type (used by LocalityPicker).
 */
export type CoverageLevel = 'country' | 'region' | 'locality';

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

  // Locality-specific fields (populated for type='locality')
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

  // Locality-specific fields
  latitude?: number;
  longitude?: number;
  timezone?: string;
  display_name?: string;
  region?: string | null;

  // Hierarchy fields (for building breadcrumb display)
  country_name?: string;
  region_name?: string;
  locality_name?: string;
}

/**
 * Coverage selection format (used by LocalityPicker).
 */
export interface CoverageSelection {
  level: CoverageLevel;
  countryCode?: string;
  countryName?: string;
  region?: string;
  localityId?: string;
  localityName?: string;
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
  locality_id: number | null;

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
 * Allows publishers to correct locality coordinates, elevation, or timezone.
 */
export interface PublisherLocationOverride {
  id: number;
  publisher_id: number;
  locality_id: number;
  locality_name?: string;
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
 * Public correction request for locality data.
 * Requires admin approval to affect all users.
 */
export interface LocalityDataCorrectionRequest {
  id: string;
  locality_id: string;
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

// ============================================================================
// OVERTURE GEOGRAPHIC DATA (Epic 10)
// ============================================================================

/**
 * Locality type codes from Overture Maps (geo_locality_types table)
 */
export type LocalityTypeCode = 'locality' | 'town' | 'village' | 'hamlet' | 'neighborhood' | 'borough';

/**
 * Region type codes from Overture Maps (geo_region_types table)
 */
export type RegionTypeCode = 'region' | 'county' | 'localadmin' | 'state' | 'province' | 'prefecture';

/**
 * All geographic entity types (unified hierarchy)
 */
export type GeoEntityType = 'continent' | 'country' | RegionTypeCode | LocalityTypeCode;

/**
 * Locality search result from /localities/search API
 * Used by LocalityPicker component (Story 10.5)
 */
export interface LocalitySearchResult {
  type: GeoEntityType;
  id: string;
  name: string;
  locality_type_code?: LocalityTypeCode;
  country_code: string;
  country_name?: string;
  country?: string;  // Alias for country_name for backward compatibility
  region_name?: string;
  parent_locality_name?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  population?: number;
  elevation?: number;
  display_hierarchy?: string;
  display_names?: Record<string, string>;
  description?: string;
  display_name?: string;
  /** Data source for coordinates (e.g., 'overture', 'admin') */
  coordinate_source?: string;
  /** Data source for elevation (e.g., 'glo90', 'admin') */
  elevation_source?: string;
  /** Original (non-admin) latitude from database */
  original_latitude?: number;
  /** Original (non-admin) longitude from database */
  original_longitude?: number;
  /** Original (non-admin) elevation from database */
  original_elevation_m?: number;
}

/**
 * Locality selection (unified format for LocalityPicker)
 * Replaces LocationSelection for new Overture-based components
 */
export interface LocalitySelection {
  type: GeoEntityType;
  id: string;
  name: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  description?: string;
  region?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Helper type to extract locality-specific fields from LocationSelection
 */
export type LocalityLocation = Required<Pick<LocationSelection, 'latitude' | 'longitude' | 'timezone'>> & LocationSelection;

/**
 * Type guard to check if location is a locality with coordinates
 */
export function isLocalityLocation(location: LocationSelection): location is LocalityLocation {
  return location.type === 'locality'
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
