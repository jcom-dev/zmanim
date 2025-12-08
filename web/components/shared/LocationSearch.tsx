/**
 * @file LocationSearch.tsx
 * @purpose Unified location search across all geographic levels (cities, regions, districts, countries, continents)
 * @pattern client-component
 * @dependencies useApi
 * @compliance useApi:✓ design-tokens:✓ IDs-only:✓
 */

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Search, X, Loader2, Globe, Globe2, Building2, Map as MapIcon, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApi } from '@/lib/api-client';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { LocationType, LocationSelection, LocationSearchResult } from '@/types/geography';

export interface LocationSearchProps {
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Callback when a location is selected */
  onSelect: (location: LocationSelection) => void;
  /** List of locations to exclude from results (already added locations) */
  excludeLocations?: LocationSelection[];
  /** Only show locations from these country codes (for publisher coverage filtering) */
  filterByCountryCodes?: string[];
  /** Custom class name for the container */
  className?: string;
  /** Whether to show the search input in a compact mode */
  compact?: boolean;
  /** Whether to auto-focus the input on mount */
  autoFocus?: boolean;
  /** Whether to show quick-select popular cities */
  showQuickSelect?: boolean;
  /** Mode: 'all' searches all types, 'cities' only searches cities */
  mode?: 'all' | 'cities';
}

// Quick select cities for common locations
const QUICK_SELECT_CITIES = [
  { id: '1626940', name: 'Jerusalem', country: 'Israel' },
  { id: '4337144', name: 'New York', country: 'USA' },
  { id: '3483797', name: 'Los Angeles', country: 'USA' },
  { id: '1553482', name: 'London', country: 'UK' },
  { id: '1627539', name: 'Tel Aviv', country: 'Israel' },
  { id: '3484030', name: 'Miami', country: 'USA' },
];

/**
 * Unified LocationSearch component for searching across all geographic levels.
 *
 * Features:
 * - Searches cities, regions, districts, countries, continents
 * - Debounced search with API calls
 * - Shows location details on hover (coordinates for cities, codes for countries)
 * - Excludes already-added locations
 * - Filters by publisher coverage (country codes)
 * - Fully accessible with keyboard navigation
 *
 * Usage examples:
 * - Coverage page: Add new coverage areas (exclude existing, all types)
 * - Algorithm page: Select preview location (filter by coverage, cities only)
 * - Public pages: General location search (no exclude, no filter)
 */
export function LocationSearch({
  placeholder = 'Search cities, regions, countries...',
  onSelect,
  excludeLocations = [],
  filterByCountryCodes = [],
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
    const searchKey = `${searchQuery}|${mode}|${filterByCountryCodes.sort().join(',')}`;

    // Skip if we already searched for these exact parameters
    if (searchKey === lastSearchParamsRef.current) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      setShowDropdown(true);
      lastSearchParamsRef.current = searchKey;

      try {
        let results: LocationSearchResult[] = [];

        if (mode === 'cities') {
          // City-only search using /cities endpoint
          let url = `/cities?search=${encodeURIComponent(searchQuery)}&limit=20`;

          // Add country code filter if we have coverage
          if (filterByCountryCodes.length === 1) {
            url += `&country_code=${encodeURIComponent(filterByCountryCodes[0])}`;
          }

          const data = await api.public.get<{ cities: any[] }>(url);
          let cities = data?.cities || [];

          // Client-side filtering for multiple country codes
          if (filterByCountryCodes.length > 1) {
            cities = cities.filter((city: any) =>
              city.country_code && filterByCountryCodes.includes(city.country_code)
            );
          }

          // Convert cities to LocationSearchResult format
          // Always show region/state information for precise location identification
          results = cities.map((city: any) => {
            // Build description with full hierarchy: region, country
            // Region is critical for disambiguating cities with same name
            const parts: string[] = [];
            if (city.region) {
              parts.push(city.region);
            }
            parts.push(city.country);

            return {
              type: 'city' as const,
              id: city.id,
              name: city.name,
              description: parts.join(', '),
              country_code: city.country_code,
              latitude: city.latitude,
              longitude: city.longitude,
              timezone: city.timezone,
              display_name: city.display_name,
              region: city.region,
            };
          });
        } else {
          // Multi-level search using /coverage/search endpoint
          const data = await api.public.get<{ results: LocationSearchResult[]; total: number }>(
            `/coverage/search?search=${encodeURIComponent(searchQuery)}&limit=20`
          );
          results = data?.results || [];

          // Filter by country codes if specified (for cities only)
          if (filterByCountryCodes.length > 0) {
            results = results.filter(result =>
              result.type !== 'city' || (result.country_code && filterByCountryCodes.includes(result.country_code))
            );
          }
        }

        // Store raw results - exclusion filtering happens in useMemo
        setRawResults(results);
        setHighlightedIndex(0);
      } catch (err) {
        console.error('Location search failed:', err);
        setRawResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, api, filterByCountryCodes, mode]);

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

  const handleQuickSelect = useCallback((city: typeof QUICK_SELECT_CITIES[0]) => {
    onSelect({
      type: 'city',
      id: city.id,
      name: `${city.name}, ${city.country}`,
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
                            {result.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {result.description}
                              </div>
                            )}
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <div className="space-y-1 text-xs">
                          <div className="font-semibold">{result.display_name || result.name}</div>
                          <div className="text-muted-foreground">
                            {result.type === 'city' && (
                              <>
                                <div className="font-medium mt-1">{result.description}</div>
                                <div className="mt-1">Coordinates: {result.latitude?.toFixed(4)}, {result.longitude?.toFixed(4)}</div>
                                <div>Timezone: {result.timezone}</div>
                                {result.country_code && <div>Country Code: {result.country_code}</div>}
                              </>
                            )}
                            {result.type !== 'city' && (
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
              {filterByCountryCodes.length > 0 && (
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

      {/* Quick select cities */}
      {showQuickSelect && (
        <div className="mt-3 space-y-2">
          <label className="text-sm font-medium">Quick add popular cities:</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {QUICK_SELECT_CITIES.map((city) => {
              const isExcluded = excludeLocations.some((loc) => loc.id === city.id && loc.type === 'city');

              return (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => !isExcluded && handleQuickSelect(city)}
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
                    {city.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {city.country}
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
    case 'district': return <Layers className="w-4 h-4" />;
    default: return <MapPin className="w-4 h-4" />;
  }
}

function getTypeTextColor(type: LocationType) {
  switch (type) {
    case 'continent': return 'text-purple-600 dark:text-purple-400';
    case 'country': return 'text-blue-600 dark:text-blue-400';
    case 'region': return 'text-green-600 dark:text-green-400';
    case 'district': return 'text-orange-600 dark:text-orange-400';
    default: return 'text-primary';
  }
}

function getTypeBadgeColor(type: LocationType) {
  switch (type) {
    case 'continent': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    case 'country': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'region': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case 'district': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    default: return 'bg-primary/10 text-primary';
  }
}

function getTypeLabel(type: LocationType) {
  switch (type) {
    case 'city': return 'City';
    case 'district': return 'District';
    case 'region': return 'Region';
    case 'country': return 'Country';
    case 'continent': return 'Continent';
  }
}

// Export helper functions for external use
export { getIcon as getLocationIcon, getTypeBadgeColor as getLocationTypeColor };
