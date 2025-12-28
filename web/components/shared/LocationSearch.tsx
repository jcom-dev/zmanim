/**
 * @file LocationSearch.tsx
 * @purpose Unified location search across all geographic levels (localities, regions, countries, continents)
 * @pattern client-component
 * @dependencies useApi
 * @compliance useApi:✓ design-tokens:✓ IDs-only:✓
 */

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Search, X, Loader2, Globe, Globe2, Map as MapIcon, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApi } from '@/lib/api-client';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { POPULAR_LOCALITIES } from '@/lib/locality-display';
import type { LocationType, LocationSelection, LocationSearchResult } from '@/types/geography';

// API response type (snake_case from backend)
interface ApiSearchResult {
  entity_type: LocationType;
  entity_id: number;
  name: string;
  name_type: string;
  population?: number;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  country_code?: string;
  country_name?: string;
  region_name?: string | null;
  locality_name?: string | null;
}

// Transform API response to frontend type
function mapApiResultToSearchResult(api: ApiSearchResult): LocationSearchResult {
  const hierarchy = buildApiHierarchyDescription(api);
  return {
    type: api.entity_type,
    id: String(api.entity_id),
    name: api.name,
    description: hierarchy,
    country_code: api.country_code || '',
    latitude: api.latitude,
    longitude: api.longitude,
    timezone: api.timezone,
    // Build display_name as "Locality, Hierarchy"
    display_name: hierarchy ? `${api.name}, ${hierarchy}` : api.name,
    country_name: api.country_name,
    region_name: api.region_name ?? undefined,
    locality_name: api.locality_name ?? undefined,
  };
}

// Build hierarchy description for API response
function buildApiHierarchyDescription(api: ApiSearchResult): string {
  const parts: string[] = [];

  switch (api.entity_type) {
    case 'locality':
      if (api.locality_name) parts.push(api.locality_name);
      if (api.region_name) parts.push(api.region_name);
      if (api.country_name) parts.push(api.country_name);
      break;
    case 'region':
      if (api.country_name) parts.push(api.country_name);
      break;
    case 'country':
    case 'continent':
      break;
  }

  return parts.join(', ');
}

export interface LocationSearchProps {
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Callback when a location is selected */
  onSelect: (location: LocationSelection) => void;
  /** List of locations to exclude from results (already added locations) */
  excludeLocations?: LocationSelection[];
  /** Only show locations from these country codes (for publisher coverage filtering) */
  filterByCountryCodes?: string[];
  /** Filter to locations within this publisher's coverage areas (hierarchy-aware) */
  publisherId?: string;
  /** Custom class name for the container */
  className?: string;
  /** Whether to show the search input in a compact mode */
  compact?: boolean;
  /** Whether to auto-focus the input on mount */
  autoFocus?: boolean;
  /** Whether to show quick-select popular localities */
  showQuickSelect?: boolean;
  /** Mode: 'all' searches all types, 'localities' only searches localities */
  mode?: 'all' | 'localities';
}

/**
 * Unified LocationSearch component for searching across all geographic levels.
 *
 * Features:
 * - Searches localities, regions, countries, continents
 * - Debounced search with API calls
 * - Shows location details on hover (coordinates for localities, codes for countries)
 * - Excludes already-added locations
 * - Filters by publisher coverage (country codes)
 * - Fully accessible with keyboard navigation
 *
 * Usage examples:
 * - Coverage page: Add new coverage areas (exclude existing, all types)
 * - Algorithm page: Select preview location (filter by coverage, localities only)
 * - Public pages: General location search (no exclude, no filter)
 */
export function LocationSearch({
  placeholder = 'Search localities, regions, countries...',
  onSelect,
  excludeLocations = [],
  filterByCountryCodes = [],
  publisherId,
  className,
  compact = false,
  autoFocus = false,
  showQuickSelect = false,
  mode = 'all',
}: LocationSearchProps) {
  const api = useApi();
  const [searchQuery, setSearchQuery] = useState('');
  const [rawResults, setRawResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Store the last search parameters to prevent duplicate searches
  const lastSearchParamsRef = useRef<string>('');

  // Memoize filterByCountryCodes to prevent infinite loops from array reference changes
  const stableFilterByCountryCodes = useMemo(
    () => filterByCountryCodes,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterByCountryCodes.join(',')]
  );

  // Filter results whenever raw results or exclusions change
  // This prevents re-searching when only the exclusion list changes
  const searchResults = useMemo(() => {
    if (rawResults.length === 0 || excludeLocations.length === 0) {
      return rawResults;
    }

    return rawResults.filter(result =>
      !excludeLocations.some(excluded =>
        excluded.type === result.type && excluded.id === result.id
      )
    );
  }, [rawResults, excludeLocations]);

  // Search with debounce - unified search across all types
  useEffect(() => {
    if (searchQuery.length < 2) {
      setRawResults([]);
      setShowDropdown(false);
      lastSearchParamsRef.current = '';
      return;
    }

    // Create a stable search key from all search parameters
    const searchKey = `${searchQuery}|${mode}|${publisherId || ''}|${[...stableFilterByCountryCodes].sort().join(',')}`;

    // Skip if we already searched for these exact parameters
    if (searchKey === lastSearchParamsRef.current) {
      return;
    }

    // AbortController to cancel in-flight requests
    const abortController = new AbortController();

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      setShowDropdown(true);
      lastSearchParamsRef.current = searchKey;

      try {
        // Build unified /localities/search URL
        const params = new URLSearchParams({
          q: searchQuery,
          limit: '20',
        });

        // Add types filter based on mode
        if (mode === 'localities') {
          params.append('types', 'locality');
        }

        // Publisher coverage filtering (hierarchy-aware - preferred over country codes)
        if (publisherId) {
          params.append('publisher_id', publisherId);
        } else if (stableFilterByCountryCodes.length > 0) {
          // Fallback to country code filtering if no publisher_id
          params.append('country_codes', stableFilterByCountryCodes.join(','));
        }

        const data = await api.public.get<{ results: ApiSearchResult[]; total: number }>(
          `/localities/search?${params.toString()}`,
          { signal: abortController.signal }
        );

        // Only update state if request wasn't aborted
        if (!abortController.signal.aborted) {
          // Transform API results to frontend format
          const results = (data?.results || []).map(mapApiResultToSearchResult);

          // Store raw results - exclusion filtering happens in useMemo
          setRawResults(results);
          setHighlightedIndex(0);
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Location search failed:', err);
        if (!abortController.signal.aborted) {
          setRawResults([]);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [searchQuery, api, stableFilterByCountryCodes, publisherId, mode]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback((location: LocationSearchResult) => {
    onSelect({
      type: location.type,
      id: location.id,
      name: location.name,
      description: location.description,
      country_code: location.country_code,
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone,
      display_name: location.display_name,
      region: location.region,
    });
    setSearchQuery('');
    setRawResults([]);
    setShowDropdown(false);
    lastSearchParamsRef.current = '';
  }, [onSelect]);

  const handleQuickSelect = useCallback((locality: typeof POPULAR_LOCALITIES[0]) => {
    onSelect({
      type: 'locality',
      id: String(locality.id),
      name: locality.display_name,
    });
  }, [onSelect]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setRawResults([]);
    setShowDropdown(false);
    lastSearchParamsRef.current = '';
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown || searchResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (searchResults[highlightedIndex]) {
          handleSelect(searchResults[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        break;
    }
  }, [showDropdown, searchResults, highlightedIndex, handleSelect]);

  return (
    <div className={cn("relative", className)}>
      {/* Search input */}
      <div className="relative">
        <Search className={cn(
          "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground",
          compact ? "h-3 w-3" : "h-4 w-4"
        )} />
        <Input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery.length >= 2 && setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          dir="auto"
          className={cn(
            "pl-10 pr-10",
            compact && "h-8 text-sm"
          )}
          autoFocus={autoFocus}
          aria-label="Search for a location"
          aria-expanded={showDropdown}
          aria-controls="location-search-results"
          role="combobox"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
          </button>
        )}
        {isSearching && (
          <Loader2 className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin",
            compact ? "h-3 w-3" : "h-4 w-4"
          )} />
        )}
      </div>

      {/* Search results dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          id="location-search-results"
          className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto"
          role="listbox"
        >
          {isSearching ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
              Searching...
            </div>
          ) : searchResults.length > 0 ? (
            <TooltipProvider delayDuration={300}>
              <div className="py-1">
                {searchResults.map((result, index) => {
                  const isHighlighted = index === highlightedIndex;
                  return (
                    <Tooltip key={`${result.type}-${result.id}`}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleSelect(result)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          className={cn(
                            "w-full px-3 py-2 text-left text-sm flex items-start gap-2 transition-colors",
                            isHighlighted ? "bg-accent" : "hover:bg-accent"
                          )}
                          role="option"
                          aria-selected={isHighlighted}
                        >
                          <span className={cn(
                            "shrink-0 mt-0.5",
                            getTypeTextColor(result.type)
                          )}>
                            {getIcon(result.type)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate flex items-center gap-2">
                              {result.name}
                              <span className={cn(
                                "text-xs px-1.5 py-0.5 rounded",
                                getTypeBadgeColor(result.type)
                              )}>
                                {getTypeLabel(result.type)}
                              </span>
                            </div>
                            {(() => {
                              const hierarchy = buildHierarchyBreadcrumb(result);
                              return hierarchy && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {hierarchy}
                                </div>
                              );
                            })()}
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-1 text-xs">
                          <div className="font-semibold">{result.display_name || result.name}</div>
                          <div className="text-muted-foreground">
                            {result.type === 'locality' && (
                              <>
                                <div className="font-medium mt-1">{result.description}</div>
                                <div className="mt-1">Coordinates: {result.latitude?.toFixed(4)}, {result.longitude?.toFixed(4)}</div>
                                <div>Timezone: {result.timezone}</div>
                                {result.country_code && <div>Country Code: {result.country_code}</div>}
                              </>
                            )}
                            {result.type !== 'locality' && (
                              <>
                                {result.country_code && <div>Country Code: {result.country_code}</div>}
                                {result.description && <div>{result.description}</div>}
                              </>
                            )}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          ) : searchQuery.length >= 2 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No locations found for &quot;{searchQuery}&quot;
              {(publisherId || filterByCountryCodes.length > 0) && (
                <div className="mt-1 text-xs">
                  (Filtered to publisher coverage areas)
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      )}

      {/* Quick select localities */}
      {showQuickSelect && (
        <div className="mt-3 space-y-2">
          <label className="text-sm font-medium">Quick add popular localities:</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {POPULAR_LOCALITIES.map((locality) => {
              const isExcluded = excludeLocations.some((loc) => loc.id === String(locality.id) && loc.type === 'locality');

              return (
                <button
                  key={locality.id}
                  type="button"
                  onClick={() => !isExcluded && handleQuickSelect(locality)}
                  disabled={isExcluded}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-colors",
                    isExcluded
                      ? "bg-primary/10 border-primary cursor-default opacity-60"
                      : "hover:border-primary hover:bg-muted"
                  )}
                >
                  <div className="font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {locality.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {locality.country_code}
                    {isExcluded && ' (Added)'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
function getIcon(type: LocationType) {
  switch (type) {
    case 'continent': return <Globe2 className="w-4 h-4" />;
    case 'country': return <Globe className="w-4 h-4" />;
    case 'region': return <MapIcon className="w-4 h-4" />;
    case 'locality': return <Layers className="w-4 h-4" />;
    default: return <MapPin className="w-4 h-4" />;
  }
}

/**
 * Builds a geographic hierarchy breadcrumb for a search result.
 * Examples:
 * - Locality: "London, Greater London, England, United Kingdom"
 * - Locality: "Manchester, England, United Kingdom"
 * - Region: "Greater London, England, United Kingdom"
 * - Region: "England, United Kingdom"
 * - Country: "United Kingdom, Europe"
 */
function buildHierarchyBreadcrumb(result: LocationSearchResult): string {
  const parts: string[] = [];

  switch (result.type) {
    case 'locality':
      // Locality: add region (if exists), region, country
      if (result.locality_name) {
        parts.push(result.locality_name);
      }
      if (result.region_name) {
        parts.push(result.region_name);
      }
      if (result.country_name) {
        parts.push(result.country_name);
      }
      break;

    case 'locality':
      // Region: add region, country
      if (result.region_name) {
        parts.push(result.region_name);
      }
      if (result.country_name) {
        parts.push(result.country_name);
      }
      break;

    case 'region':
      // Region: add country
      if (result.country_name) {
        parts.push(result.country_name);
      }
      break;

    case 'country':
      // Country: could add continent in future (not in DB yet)
      break;

    case 'continent':
      // Continent: no parent level
      break;
  }

  return parts.join(', ');
}

function getTypeTextColor(type: LocationType) {
  switch (type) {
    case 'continent': return 'text-purple-600 dark:text-purple-400';
    case 'country': return 'text-blue-600 dark:text-blue-400';
    case 'region': return 'text-green-600 dark:text-green-400';
    case 'locality': return 'text-orange-600 dark:text-orange-400';
    default: return 'text-primary';
  }
}

function getTypeBadgeColor(type: LocationType) {
  switch (type) {
    case 'continent': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    case 'country': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'region': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case 'locality': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    default: return 'bg-primary/10 text-primary';
  }
}

function getTypeLabel(type: LocationType) {
  switch (type) {
    case 'locality': return 'Locality';
    case 'region': return 'Region';
    case 'country': return 'Country';
    case 'continent': return 'Continent';
  }
}

// Export helper functions for external use
export { getIcon as getLocationIcon, getTypeBadgeColor as getLocationTypeColor };
