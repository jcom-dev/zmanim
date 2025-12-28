/**
 * @file locality-display.ts
 * @purpose Shared display utilities for geographic entities (localities, regions, countries)
 * @pattern utility
 * @compliance design-tokens:✓ no-hardcoded-colors:✓
 *
 * Centralized functions for:
 * - Entity icon rendering (Lucide icons)
 * - Badge color classes (design tokens only)
 * - Hierarchy display formatting
 * - Popular localities constant
 */

import { MapPin, Globe, Globe2, Map as MapIcon, Building, Home, Layers } from 'lucide-react';
import React from 'react';

// ============================================================================
// COUNTRY FLAG UTILITIES
// ============================================================================

/**
 * Converts a 2-letter ISO country code to a flag emoji
 * Uses regional indicator symbols (🇦-🇿) which combine to form flag emojis
 * @param countryCode - Two-letter ISO country code (e.g., 'US', 'GB', 'IL')
 * @returns Flag emoji string (e.g., '🇺🇸', '🇬🇧', '🇮🇱') or empty string if invalid
 */
export function countryCodeToFlag(countryCode?: string): string {
  if (!countryCode || countryCode.length !== 2) {
    return '';
  }

  const code = countryCode.toUpperCase();
  // Regional indicator symbols start at U+1F1E6 (🇦)
  // A = 65 in ASCII, so we subtract 65 and add the base code point
  const BASE = 0x1f1e6;
  const firstChar = code.charCodeAt(0) - 65 + BASE;
  const secondChar = code.charCodeAt(1) - 65 + BASE;

  return String.fromCodePoint(firstChar, secondChar);
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type LocalityTypeCode = 'locality' | 'town' | 'village' | 'hamlet' | 'neighborhood' | 'borough';
export type RegionTypeCode = 'region' | 'county' | 'localadmin' | 'state' | 'province' | 'prefecture';
export type GeoEntityType = 'continent' | 'country' | RegionTypeCode | LocalityTypeCode;

export interface LocalityForDisplay {
  name: string;
  locality_type_code?: LocalityTypeCode;
  parent_locality_name?: string;
  region_name?: string;
  country_name?: string;
  country_code?: string;
}

// ============================================================================
// ICON UTILITIES
// ============================================================================

/**
 * Returns the appropriate Lucide icon for a geographic entity type
 * @param type - Entity type (continent, country, region, locality, etc.)
 * @param className - CSS classes for icon sizing (default: 'w-4 h-4')
 */
export function getEntityIcon(type: GeoEntityType, className = 'w-4 h-4'): React.ReactElement {
  const iconProps = { className };

  switch (type) {
    case 'continent':
      return React.createElement(Globe2, iconProps);
    case 'country':
      return React.createElement(Globe, iconProps);
    case 'region':
    case 'state':
    case 'province':
    case 'prefecture':
      return React.createElement(MapIcon, iconProps);
    case 'county':
    case 'localadmin':
      return React.createElement(Layers, iconProps);
    case 'locality':
    case 'town':
      return React.createElement(Building, iconProps);
    case 'village':
    case 'hamlet':
      return React.createElement(Home, iconProps);
    case 'neighborhood':
    case 'borough':
      return React.createElement(MapPin, iconProps);
    default:
      return React.createElement(MapPin, iconProps);
  }
}

// ============================================================================
// COLOR/BADGE UTILITIES
// ============================================================================

/**
 * Returns Tailwind badge color classes for entity type badges
 * Uses design tokens only - no hardcoded hex colors
 */
export function getEntityBadgeColor(type: GeoEntityType): string {
  switch (type) {
    case 'continent':
      return 'bg-primary/10 text-primary dark:bg-primary/20';
    case 'country':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'region':
    case 'state':
    case 'province':
    case 'prefecture':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    case 'county':
    case 'localadmin':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
    case 'locality':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    case 'town':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
    case 'village':
    case 'hamlet':
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case 'neighborhood':
    case 'borough':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

/**
 * Returns text color classes for entity type
 * Uses design tokens only
 */
export function getEntityTextColor(type: GeoEntityType): string {
  switch (type) {
    case 'continent':
      return 'text-primary';
    case 'country':
      return 'text-blue-600 dark:text-blue-400';
    case 'region':
    case 'state':
    case 'province':
      return 'text-purple-600 dark:text-purple-400';
    case 'county':
    case 'localadmin':
      return 'text-indigo-600 dark:text-indigo-400';
    case 'locality':
      return 'text-amber-600 dark:text-amber-400';
    case 'town':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'village':
    case 'hamlet':
      return 'text-green-600 dark:text-green-400';
    case 'neighborhood':
    case 'borough':
      return 'text-rose-600 dark:text-rose-400';
    default:
      return 'text-foreground';
  }
}

/**
 * Returns human-readable label for entity type
 */
export function getEntityLabel(type: GeoEntityType): string {
  const labels: Record<GeoEntityType, string> = {
    continent: 'Continent',
    country: 'Country',
    region: 'Region',
    state: 'State',
    province: 'Province',
    prefecture: 'Prefecture',
    county: 'County',
    localadmin: 'Local Admin',
    locality: 'Locality',
    town: 'Town',
    village: 'Village',
    hamlet: 'Hamlet',
    neighborhood: 'Neighborhood',
    borough: 'Borough',
  };
  return labels[type] || 'Location';
}

// ============================================================================
// HIERARCHY DISPLAY UTILITIES
// ============================================================================

export interface HierarchyDisplayOptions {
  /** Include locality type label (e.g., "Brooklyn (Neighborhood)") */
  includeType?: boolean;
  /** Separator between hierarchy levels (default: ' → ') */
  separator?: string;
  /** Maximum number of hierarchy levels to show */
  maxLevels?: number;
}

/**
 * Builds a hierarchy display string for a locality
 * Example: "Brooklyn → New York City → NY → USA"
 * Example with type: "Brooklyn (Neighborhood) → NYC → NY → USA"
 */
export function buildHierarchyDisplay(
  locality: LocalityForDisplay,
  options: HierarchyDisplayOptions = {}
): string {
  const { includeType = false, separator = ' → ', maxLevels } = options;
  const parts: string[] = [];

  // Start with locality name (with optional type)
  if (includeType && locality.locality_type_code) {
    parts.push(`${locality.name} (${getEntityLabel(locality.locality_type_code)})`);
  } else {
    parts.push(locality.name);
  }

  // Add parent locality if exists
  if (locality.parent_locality_name) {
    parts.push(locality.parent_locality_name);
  }

  // Add region if exists
  if (locality.region_name) {
    parts.push(locality.region_name);
  }

  // Add country if exists
  if (locality.country_name) {
    parts.push(locality.country_name);
  } else if (locality.country_code) {
    // Fallback to country code if name not available
    parts.push(locality.country_code);
  }

  // Apply maxLevels if specified
  const finalParts = maxLevels ? parts.slice(0, maxLevels) : parts;
  return finalParts.join(separator);
}

export interface ResponsiveHierarchy {
  /** Full hierarchy for desktop (>1024px) */
  full: string;
  /** Medium hierarchy for tablet (640-1024px) */
  medium: string;
  /** Minimal hierarchy for mobile (<640px) */
  minimal: string;
}

/**
 * Builds responsive hierarchy display for different screen sizes
 * Returns object with full, medium, and minimal versions
 */
export function buildResponsiveHierarchy(locality: LocalityForDisplay): ResponsiveHierarchy {
  return {
    // Desktop: Full hierarchy with type labels
    full: buildHierarchyDisplay(locality, { includeType: true }),

    // Tablet: Full hierarchy without type labels
    medium: buildHierarchyDisplay(locality, { includeType: false }),

    // Mobile: Minimal (locality + country code only)
    minimal: locality.country_code
      ? `${locality.name}, ${locality.country_code}`
      : locality.name,
  };
}

// ============================================================================
// POPULAR LOCALITIES
// ============================================================================

/**
 * Popular localities for quick selection
 * Each entry should have the database ID for the locality
 */
export interface PopularLocality {
  id: number;
  name: string;
  country_code: string;
  display_name: string;
}

/**
 * Popular localities constant
 * Updated with correct IDs from geo_localities table (Overture data)
 */
export const POPULAR_LOCALITIES: PopularLocality[] = [
  {
    id: 2093434,
    name: 'Jerusalem',
    country_code: 'IL',
    display_name: 'Jerusalem, Israel',
  },
  {
    id: 846479,
    name: 'New York',
    country_code: 'US',
    display_name: 'New York City, NY, USA',
  },
  {
    id: 425927,
    name: 'Los Angeles',
    country_code: 'US',
    display_name: 'Los Angeles, CA, USA',
  },
  {
    id: 566005,
    name: 'London',
    country_code: 'GB',
    display_name: 'London, United Kingdom',
  },
  {
    id: 847259,
    name: 'Lakewood',
    country_code: 'US',
    display_name: 'Lakewood, NJ, USA',
  },
  {
    id: 542266,
    name: 'Manchester',
    country_code: 'GB',
    display_name: 'Manchester, United Kingdom',
  },
];
