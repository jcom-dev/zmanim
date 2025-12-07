/**
 * @file CoverageSelector.tsx
 * @purpose Multi-level geographic selection with unified search
 * @pattern client-component-complex
 * @dependencies useApi, unified /coverage/search endpoint
 * @compliance Check docs/adr/ for pattern rationale
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Search, X, Loader2, Globe, Globe2, Building2, Map as MapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApi } from '@/lib/api-client';

export type CoverageType = 'city' | 'district' | 'region' | 'country' | 'continent';

export interface CoverageSelection {
  type: CoverageType;
  id: string;
  name: string;
}

// City interface for search results (used by CoverageMapDialog)
export interface City {
  id: string;
  name: string;
  country: string;
  country_code: string;
  region: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  display_name: string;
}

interface CoverageSearchResult {
  type: CoverageType;
  id: string;
  name: string;
  description: string;
  country_code: string;
}

// Quick select cities for common locations
// Hardcoded database IDs for performance (avoids lookup on every load)
const QUICK_SELECT_CITIES = [
  { id: '1626940', name: 'Jerusalem', country: 'Israel' },
  { id: '4337144', name: 'New York', country: 'USA' },
  { id: '3483797', name: 'Los Angeles', country: 'USA' },
  { id: '1553482', name: 'London', country: 'UK' },
  { id: '1627539', name: 'Tel Aviv', country: 'Israel' },
  { id: '3484030', name: 'Miami', country: 'USA' },
];

export interface CoverageSelectorProps {
  /** Currently selected coverage items */
  selectedItems: CoverageSelection[];
  /** Callback when items change */
  onChange: (items: CoverageSelection[]) => void;
  /** Whether to show the quick select cities section */
  showQuickSelect?: boolean;
  /** Custom class name for the container */
  className?: string;
  /** Whether to show the selected items badge section */
  showSelectedBadges?: boolean;
  /** Header title (optional) */
  headerTitle?: string;
  /** Header description (optional) */
  headerDescription?: string;
}

/**
 * Shared CoverageSelector component for selecting geographic coverage areas.
 * Uses a unified search that searches across all geographic levels at once.
 */
export function CoverageSelector({
  selectedItems,
  onChange,
  showQuickSelect = true,
  className,
  showSelectedBadges = true,
  headerTitle,
  headerDescription,
}: CoverageSelectorProps) {
  const api = useApi();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CoverageSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Quick select cities now have hardcoded IDs, no lookup needed

  // Search with debounce - unified search across all types
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      setShowDropdown(true);

      try {
        const data = await api.public.get<{ results: CoverageSearchResult[]; total: number }>(
          `/coverage/search?search=${encodeURIComponent(searchQuery)}&limit=20`
        );
        setSearchResults(data?.results || []);
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, api]);

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

  const addItem = useCallback((item: CoverageSelection) => {
    if (!selectedItems.find((i) => i.id === item.id && i.type === item.type)) {
      const updated = [...selectedItems, item];
      onChange(updated);
    }
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  }, [selectedItems, onChange]);

  const addSearchResult = useCallback((result: CoverageSearchResult) => {
    const displayName = result.description
      ? `${result.name}, ${result.description}`
      : result.name;
    addItem({
      type: result.type,
      id: result.id,
      name: displayName,
    });
  }, [addItem]);

  const addQuickCity = useCallback((city: typeof QUICK_SELECT_CITIES[0]) => {
    addItem({
      type: 'city',
      id: city.id, // Use hardcoded database ID
      name: `${city.name}, ${city.country}`,
    });
  }, [addItem]);

  const removeItem = useCallback((itemId: string, itemType: CoverageType) => {
    const updated = selectedItems.filter((i) => !(i.id === itemId && i.type === itemType));
    onChange(updated);
  }, [selectedItems, onChange]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  }, []);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Optional Header */}
      {(headerTitle || headerDescription) && (
        <div className="text-center space-y-2">
          {headerTitle && <h2 className="text-2xl font-bold">{headerTitle}</h2>}
          {headerDescription && (
            <p className="text-muted-foreground">{headerDescription}</p>
          )}
        </div>
      )}

      {/* Selected items badges */}
      {showSelectedBadges && selectedItems.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Selected Coverage ({selectedItems.length}):</label>
          <div className="flex flex-wrap gap-2">
            {selectedItems.map((item) => (
              <span
                key={`${item.type}-${item.id}`}
                className={cn(
                  "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm",
                  getTypeColor(item.type)
                )}
              >
                {getIcon(item.type)}
                {item.name}
                <button
                  type="button"
                  onClick={() => removeItem(item.id, item.type)}
                  className="ml-1 hover:opacity-70 transition-opacity"
                  aria-label={`Remove ${item.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Unified search input */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Search coverage areas:</label>
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.length >= 2 && setShowDropdown(true)}
              placeholder="Search cities, regions, countries, continents..."
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto"
            >
              {isSearching ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                  Searching...
                </div>
              ) : searchResults.length > 0 ? (
                <div className="py-1">
                  {searchResults.map((result) => {
                    const isSelected = selectedItems.some(
                      (i) => i.id === result.id && i.type === result.type
                    );
                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        type="button"
                        onClick={() => !isSelected && addSearchResult(result)}
                        disabled={isSelected}
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm flex items-start gap-2",
                          isSelected ? "bg-muted text-muted-foreground" : "hover:bg-accent"
                        )}
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
                        {isSelected && <span className="text-xs text-primary shrink-0">Added</span>}
                      </button>
                    );
                  })}
                </div>
              ) : searchQuery.length >= 2 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No results found for &quot;{searchQuery}&quot;
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Quick select cities */}
      {showQuickSelect && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Quick add popular cities:</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {QUICK_SELECT_CITIES.map((city) => {
              const isSelected = selectedItems.some((i) => i.id === city.id && i.type === 'city');

              return (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => addQuickCity(city)}
                  disabled={isSelected}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-colors",
                    isSelected
                      ? "bg-primary/10 border-primary cursor-default"
                      : "hover:border-primary hover:bg-muted"
                  )}
                >
                  <div className="font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {city.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {city.country}
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
function getIcon(type: CoverageType) {
  switch (type) {
    case 'continent': return <Globe2 className="w-4 h-4" />;
    case 'country': return <Globe className="w-4 h-4" />;
    case 'region': return <MapIcon className="w-4 h-4" />;
    case 'district': return <Building2 className="w-4 h-4" />;
    default: return <MapPin className="w-4 h-4" />;
  }
}

function getTypeColor(type: CoverageType) {
  switch (type) {
    case 'continent': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'country': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'region': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'district': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    default: return 'bg-primary/10 text-primary';
  }
}

function getTypeTextColor(type: CoverageType) {
  switch (type) {
    case 'continent': return 'text-purple-600 dark:text-purple-400';
    case 'country': return 'text-blue-600 dark:text-blue-400';
    case 'region': return 'text-green-600 dark:text-green-400';
    case 'district': return 'text-orange-600 dark:text-orange-400';
    default: return 'text-primary';
  }
}

function getTypeBadgeColor(type: CoverageType) {
  switch (type) {
    case 'continent': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    case 'country': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'region': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case 'district': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    default: return 'bg-primary/10 text-primary';
  }
}

function getTypeLabel(type: CoverageType) {
  switch (type) {
    case 'city': return 'City';
    case 'district': return 'District';
    case 'region': return 'Region';
    case 'country': return 'Country';
    case 'continent': return 'Continent';
  }
}

// Export helper functions for external use
export { getIcon as getCoverageIcon, getTypeColor as getCoverageTypeColor };
