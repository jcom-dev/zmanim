/**
 * @file CoverageSearchPanel.tsx
 * @purpose Search-first coverage selection with level filtering tabs
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓ IDs-only:✓
 */

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  MapPin, Search, X, Loader2, Globe, Globe2,
  Map as MapIcon, Layers, Check, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApi } from '@/lib/api-client';
import type { LocationType, LocationSelection, LocationSearchResult } from '@/types/geography';

type SearchResult = LocationSearchResult;

// Level filter configuration
const LEVEL_FILTERS: { key: LocationType | 'all'; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'All', icon: <Search className="w-3.5 h-3.5" /> },
  { key: 'city', label: 'Cities', icon: <MapPin className="w-3.5 h-3.5" /> },
  { key: 'district', label: 'Districts', icon: <Layers className="w-3.5 h-3.5" /> },
  { key: 'region', label: 'Regions', icon: <MapIcon className="w-3.5 h-3.5" /> },
  { key: 'country', label: 'Countries', icon: <Globe className="w-3.5 h-3.5" /> },
  { key: 'continent', label: 'Continents', icon: <Globe2 className="w-3.5 h-3.5" /> },
];

// Quick select cities with database IDs
const QUICK_SELECT_CITIES = [
  { id: '1626940', name: 'Jerusalem', country: 'Israel', countryCode: 'IL' },
  { id: '4337144', name: 'New York', country: 'USA', countryCode: 'US' },
  { id: '3483797', name: 'Los Angeles', country: 'USA', countryCode: 'US' },
  { id: '1553482', name: 'London', country: 'UK', countryCode: 'GB' },
  { id: '1627539', name: 'Tel Aviv', country: 'Israel', countryCode: 'IL' },
  { id: '3484030', name: 'Miami', country: 'USA', countryCode: 'US' },
];

export interface CoverageSearchPanelProps {
  /** Callback when locations are selected for addition */
  onAdd: (locations: LocationSelection[]) => void;
  /** Already existing coverage to exclude from results */
  existingCoverage?: LocationSelection[];
  /** Optional callback when a location is highlighted (for map preview) */
  onHighlight?: (location: LocationSelection | null) => void;
  /** Custom class name */
  className?: string;
  /** Whether to show the quick select section */
  showQuickSelect?: boolean;
}

/**
 * Search-first coverage selection panel with level filtering.
 *
 * Features:
 * - Tab-based level filtering (All, Cities, Regions, Countries, Continents)
 * - Fast search using materialized view with trigram indexes
 * - Multi-select with chips display
 * - Quick-select popular cities
 * - Keyboard navigation support
 * - Highlights on hover for map preview integration
 */
export function CoverageSearchPanel({
  onAdd,
  existingCoverage = [],
  onHighlight,
  className,
  showQuickSelect = true,
}: CoverageSearchPanelProps) {
  const api = useApi();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLevel, setActiveLevel] = useState<LocationType | 'all'>('all');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedItems, setSelectedItems] = useState<LocationSelection[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Filter out already selected and existing coverage
  const filteredResults = useMemo(() => {
    return searchResults.filter(result => {
      // Check if already selected in this session
      const isSelected = selectedItems.some(
        item => item.type === result.type && item.id === result.id
      );
      // Check if already in existing coverage
      const isExisting = existingCoverage.some(
        item => item.type === result.type && item.id === result.id
      );
      return !isSelected && !isExisting;
    });
  }, [searchResults, selectedItems, existingCoverage]);

  // Search with debounce and level filtering
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);

      try {
        // Build levels parameter
        const levelsParam = activeLevel === 'all' ? '' : activeLevel;

        const data = await api.public.get<{ results: SearchResult[]; total: number }>(
          `/coverage/search?search=${encodeURIComponent(searchQuery)}&levels=${levelsParam}&limit=30`
        );

        setSearchResults(data?.results || []);
        setHighlightedIndex(0);
      } catch (err) {
        console.error('Coverage search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeLevel, api]);

  const handleSelectResult = useCallback((result: SearchResult) => {
    const selection: LocationSelection = {
      type: result.type,
      id: result.id,
      name: result.name,
      description: result.description,
      country_code: result.country_code,
    };
    setSelectedItems(prev => [...prev, selection]);
    // Don't clear search - allow adding more from same results
  }, []);

  const handleRemoveSelected = useCallback((item: LocationSelection) => {
    setSelectedItems(prev =>
      prev.filter(i => !(i.type === item.type && i.id === item.id))
    );
  }, []);

  const handleQuickSelect = useCallback((city: typeof QUICK_SELECT_CITIES[0]) => {
    const isExisting = existingCoverage.some(
      item => item.type === 'city' && item.id === city.id
    );
    const isSelected = selectedItems.some(
      item => item.type === 'city' && item.id === city.id
    );

    if (!isExisting && !isSelected) {
      setSelectedItems(prev => [...prev, {
        type: 'city',
        id: city.id,
        name: city.name,
        description: city.country,
        country_code: city.countryCode,
      }]);
    }
  }, [existingCoverage, selectedItems]);

  const handleAddAll = useCallback(() => {
    if (selectedItems.length > 0) {
      onAdd(selectedItems);
      setSelectedItems([]);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [selectedItems, onAdd]);

  const handleClearAll = useCallback(() => {
    setSelectedItems([]);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (filteredResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredResults[highlightedIndex]) {
          handleSelectResult(filteredResults[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setSearchQuery('');
        setSearchResults([]);
        break;
    }
  }, [filteredResults, highlightedIndex, handleSelectResult]);

  // Notify parent of highlighted item for map preview
  useEffect(() => {
    if (onHighlight && filteredResults[highlightedIndex]) {
      const result = filteredResults[highlightedIndex];
      onHighlight({
        type: result.type,
        id: result.id,
        name: result.name,
        country_code: result.country_code,
      });
    } else if (onHighlight) {
      onHighlight(null);
    }
  }, [highlightedIndex, filteredResults, onHighlight]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Level Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-muted/50 rounded-lg">
        {LEVEL_FILTERS.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveLevel(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
              activeLevel === key
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Search ${activeLevel === 'all' ? 'all locations' : activeLevel + 's'}...`}
          className="pl-10 pr-10 h-11"
          aria-label="Search locations"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSearchResults([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Results */}
      {searchQuery.length >= 2 && (
        <div
          ref={resultsRef}
          className="border rounded-lg bg-card max-h-64 overflow-y-auto"
        >
          {isSearching ? (
            <div className="p-6 text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
              <span className="text-sm text-muted-foreground">Searching...</span>
            </div>
          ) : filteredResults.length > 0 ? (
            <div className="divide-y">
              {filteredResults.map((result, index) => {
                const isHighlighted = index === highlightedIndex;
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    type="button"
                    onClick={() => handleSelectResult(result)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "w-full px-4 py-3 text-left flex items-center gap-3 transition-colors",
                      isHighlighted ? "bg-accent" : "hover:bg-accent/50"
                    )}
                  >
                    <span className={cn("shrink-0", getTypeColor(result.type))}>
                      {getTypeIcon(result.type)}
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
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No {activeLevel === 'all' ? 'locations' : activeLevel + 's'} found for &ldquo;{searchQuery}&rdquo;
            </div>
          )}
        </div>
      )}

      {/* Quick Select Cities */}
      {showQuickSelect && searchQuery.length < 2 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Quick add popular cities:</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {QUICK_SELECT_CITIES.map((city) => {
              const isExisting = existingCoverage.some(
                item => item.type === 'city' && item.id === city.id
              );
              const isSelected = selectedItems.some(
                item => item.type === 'city' && item.id === city.id
              );
              const isDisabled = isExisting || isSelected;

              return (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => handleQuickSelect(city)}
                  disabled={isDisabled}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-all group",
                    isDisabled
                      ? "bg-primary/5 border-primary/20 cursor-default"
                      : "hover:border-primary hover:bg-accent"
                  )}
                >
                  <div className="font-medium flex items-center gap-1.5 text-sm">
                    <MapPin className={cn(
                      "h-3.5 w-3.5",
                      isDisabled ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                    )} />
                    {city.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {city.country}
                    {isExisting && <span className="text-primary ml-1">(existing)</span>}
                    {isSelected && !isExisting && <span className="text-primary ml-1">(selected)</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Items */}
      {selectedItems.length > 0 && (
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Selected ({selectedItems.length}):
            </label>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedItems.map((item) => (
              <span
                key={`${item.type}-${item.id}`}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
                  getTypeBadgeColor(item.type)
                )}
              >
                {getTypeIcon(item.type)}
                {item.name}
                <button
                  type="button"
                  onClick={() => handleRemoveSelected(item)}
                  className="hover:opacity-70 transition-opacity ml-0.5"
                  aria-label={`Remove ${item.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>

          {/* Add Button */}
          <Button
            onClick={handleAddAll}
            className="w-full"
            size="lg"
          >
            <Check className="w-4 h-4 mr-2" />
            Add {selectedItems.length} Coverage Area{selectedItems.length !== 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  );
}

// Helper functions
function getTypeIcon(type: LocationType) {
  switch (type) {
    case 'continent': return <Globe2 className="w-4 h-4" />;
    case 'country': return <Globe className="w-4 h-4" />;
    case 'region': return <MapIcon className="w-4 h-4" />;
    case 'district': return <Layers className="w-4 h-4" />;
    default: return <MapPin className="w-4 h-4" />;
  }
}

function getTypeColor(type: LocationType) {
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
