/**
 * @file LocalityPicker.tsx
 * @purpose Unified locality picker component - replaces LocationSearch, CoverageSearchPanel, CitySelector
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓ no-hardcoded-colors:✓
 *
 * Features:
 * - Single-select and multi-select modes
 * - Type filtering (localities, towns, neighborhoods, etc.)
 * - Quick select for popular localities
 * - Full keyboard navigation
 * - Responsive hierarchy display
 * - Highlight callback for map preview
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocalitySearch } from '@/lib/hooks/useLocalitySearch';
import {
  getEntityIcon,
  getEntityBadgeColor,
  getEntityLabel,
  countryCodeToFlag,
  POPULAR_LOCALITIES,
  type GeoEntityType,
} from '@/lib/locality-display';
import type { LocalitySearchResult } from '@/types/geography';
import type { LocalitySelection } from '@/types/geography';

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export type LocalityPickerMode = 'single' | 'multi';
export type LocalityPickerVariant = 'inline' | 'dropdown' | 'compact';
/** Filter preset determines which type filter tabs are shown */
export type LocalityPickerFilterPreset = 'localities' | 'coverage';

export interface LocalityPickerProps {
  /** Selection mode: single or multi */
  mode?: LocalityPickerMode;
  /** Visual variant */
  variant?: LocalityPickerVariant;
  /** Placeholder text */
  placeholder?: string;
  /** Callback when selection changes */
  onSelect: (selection: LocalitySelection | LocalitySelection[]) => void;
  /** Callback when result is highlighted (for map preview) */
  onHighlight?: (item: LocalitySelection | null) => void;
  /** Excluded locality IDs (already selected) */
  exclude?: LocalitySelection[];
  /** Filter by entity types */
  types?: GeoEntityType[];
  /** Filter by country ID */
  countryId?: number;
  /** Filter by region ID */
  regionId?: number;
  /** Filter to localities within this publisher's coverage areas (hierarchy-aware) */
  publisherId?: string;
  /** Show quick select grid for popular localities */
  showQuickSelect?: boolean;
  /** Show type filter tabs */
  showTypeFilters?: boolean;
  /** Filter preset: 'localities' for locality types, 'coverage' for geographic levels */
  filterPreset?: LocalityPickerFilterPreset;
  /** Auto-focus input on mount */
  autoFocus?: boolean;
  /** Use inline results instead of dropdown (for use inside dialogs/modals) */
  inlineResults?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// TYPE FILTER CONFIGURATION
// ============================================================================

interface TypeFilter {
  key: string;
  label: string;
  types: GeoEntityType[];
}

/** Default filter tabs for locality-focused search (home page, etc.) */
const LOCALITY_FILTERS: TypeFilter[] = [
  { key: 'all', label: 'All', types: [] },
  { key: 'localities', label: 'Cities', types: ['locality'] },
  { key: 'towns', label: 'Towns', types: ['town', 'village', 'hamlet'] },
  { key: 'neighborhoods', label: 'Neighborhoods', types: ['neighborhood', 'borough'] },
  { key: 'regions', label: 'Regions', types: ['region', 'state', 'province', 'county'] },
];

/** Coverage filter tabs for geographic hierarchy (publisher coverage) */
const COVERAGE_FILTERS: TypeFilter[] = [
  { key: 'all', label: 'All', types: [] },
  { key: 'locality', label: 'Localities', types: ['locality', 'town', 'village', 'hamlet', 'neighborhood', 'borough'] },
  { key: 'region', label: 'Regions', types: ['region', 'state', 'province', 'county', 'localadmin', 'prefecture'] },
  { key: 'country', label: 'Countries', types: ['country'] },
  { key: 'continent', label: 'Continents', types: ['continent'] },
];

/** Get filter configuration based on preset */
function getFiltersForPreset(preset: LocalityPickerFilterPreset): TypeFilter[] {
  return preset === 'coverage' ? COVERAGE_FILTERS : LOCALITY_FILTERS;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function LocalityPicker({
  mode = 'single',
  variant = 'inline',
  placeholder = 'Search for a locality...',
  onSelect,
  onHighlight,
  exclude = [],
  types: propTypes,
  countryId,
  regionId,
  publisherId,
  showQuickSelect = false,
  showTypeFilters = false,
  filterPreset = 'localities',
  autoFocus = false,
  inlineResults = false,
  className,
}: LocalityPickerProps) {
  // ========== State ==========
  const [inputValue, setInputValue] = useState('');
  const [selectedItems, setSelectedItems] = useState<LocalitySelection[]>([]);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>('all');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [showResults, setShowResults] = useState(false);

  // ========== Refs ==========
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // ========== Filter Configuration ==========
  const typeFilters = getFiltersForPreset(filterPreset);

  // ========== Search Hook ==========
  const excludeIds = exclude.map((loc) => loc.id);
  const activeTypes = propTypes || (activeTypeFilter === 'all' ? undefined : typeFilters.find((f) => f.key === activeTypeFilter)?.types);

  const { results, isLoading, search, clear, query } = useLocalitySearch({
    types: activeTypes,
    countryId,
    regionId,
    publisherId,
    exclude: excludeIds,
    debounce: 300,
    limit: 20,
  });

  // ========== Effects ==========

  // Auto-focus input
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Show/hide results dropdown
  useEffect(() => {
    setShowResults(query.length >= 2 && (results.length > 0 || isLoading));
  }, [query, results, isLoading]);

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  // ========== Handlers ==========

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);
      search(value);
      setShowResults(true);
    },
    [search]
  );

  const handleSelectItem = useCallback(
    (result: LocalitySelection) => {
      if (mode === 'single') {
        // Single-select: call onSelect immediately and clear input
        onSelect(result);
        setInputValue('');
        clear();
        setShowResults(false);
      } else {
        // Multi-select: add to selected items
        if (!selectedItems.find((item) => item.id === result.id)) {
          const newSelection = [...selectedItems, result];
          setSelectedItems(newSelection);
        }
        setInputValue('');
        clear();
        setShowResults(false);
      }
    },
    [mode, onSelect, selectedItems, clear]
  );

  const handleRemoveItem = useCallback(
    (id: string) => {
      const newSelection = selectedItems.filter((item) => item.id !== id);
      setSelectedItems(newSelection);
    },
    [selectedItems]
  );

  const handleConfirmMultiSelect = useCallback(() => {
    onSelect(selectedItems);
    setSelectedItems([]);
  }, [onSelect, selectedItems]);

  const handleClearAll = useCallback(() => {
    setSelectedItems([]);
  }, []);

  const handleQuickSelect = useCallback(
    (locality: typeof POPULAR_LOCALITIES[0]) => {
      const selection: LocalitySelection = {
        type: 'locality',
        id: String(locality.id),
        name: locality.name,
        country_code: locality.country_code,
        description: locality.display_name,
      };
      handleSelectItem(selection);
    },
    [handleSelectItem]
  );

  const handleHighlight = useCallback(
    (result: LocalitySelection | null) => {
      if (onHighlight) {
        onHighlight(result);
      }
    },
    [onHighlight]
  );

  // ========== Keyboard Navigation ==========

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showResults || results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => {
            const next = prev < results.length - 1 ? prev + 1 : prev;
            if (results[next]) {
              handleHighlight(results[next] as LocalitySelection);
            }
            return next;
          });
          break;

        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => {
            const next = prev > 0 ? prev - 1 : 0;
            if (results[next]) {
              handleHighlight(results[next] as LocalitySelection);
            }
            return next;
          });
          break;

        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && results[highlightedIndex]) {
            handleSelectItem(results[highlightedIndex] as LocalitySelection);
          }
          break;

        case 'Escape':
          e.preventDefault();
          setShowResults(false);
          setInputValue('');
          clear();
          handleHighlight(null);
          break;
      }
    },
    [showResults, results, highlightedIndex, handleSelectItem, clear, handleHighlight]
  );

  // ========== Render Helpers ==========

  const renderResultItem = (result: LocalitySearchResult, index: number) => {
    const isHighlighted = index === highlightedIndex;
    const isSelected = selectedItems.find((item) => item.id === result.id);
    const flag = countryCodeToFlag(result.country_code);

    // Use display_hierarchy from API, but remove the locality name (first part)
    // e.g., "London, England, United Kingdom" -> "England, United Kingdom"
    let hierarchyText = '';
    if (result.display_hierarchy) {
      const parts = result.display_hierarchy.split(', ');
      if (parts.length > 1) {
        // Remove the first part (locality name) and join the rest
        hierarchyText = parts.slice(1).join(', ');
      }
    }
    // Fallback to parsed hierarchy if display_hierarchy doesn't have enough info
    if (!hierarchyText) {
      const fallbackParts: string[] = [];
      if (result.parent_locality_name) fallbackParts.push(result.parent_locality_name);
      if (result.region_name) fallbackParts.push(result.region_name);
      if (result.country_name) fallbackParts.push(result.country_name);
      hierarchyText = fallbackParts.join(', ');
    }

    return (
      <button
        key={result.id}
        type="button"
        className={cn(
          'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
          'hover:bg-accent focus:bg-accent focus:outline-none',
          isHighlighted && 'bg-accent'
        )}
        onClick={() => handleSelectItem(result as LocalitySelection)}
        onMouseEnter={() => {
          setHighlightedIndex(index);
          handleHighlight(result as LocalitySelection);
        }}
        onMouseLeave={() => {
          if (isHighlighted) {
            setHighlightedIndex(-1);
            handleHighlight(null);
          }
        }}
        role="option"
        aria-selected={isHighlighted}
      >
        {/* Flag emoji */}
        <div className="mt-0.5 shrink-0 w-8 text-center" style={{ fontSize: '1.5rem' }}>
          {flag ? flag : '🌍'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Entity type icon */}
            <span className="text-muted-foreground">
              {getEntityIcon(result.type as GeoEntityType, 'w-4 h-4')}
            </span>
            <span className="font-medium text-foreground">{result.name}</span>
            <Badge className={cn('text-xs', getEntityBadgeColor(result.type as GeoEntityType))}>
              {getEntityLabel(result.type as GeoEntityType)}
            </Badge>
          </div>

          {/* Hierarchy chain and population */}
          <div className="text-sm text-muted-foreground mt-1">
            {hierarchyText}
            {result.population && result.population > 0 && (
              <span className="ml-2 text-xs opacity-70">
                (pop. {result.population.toLocaleString()})
              </span>
            )}
          </div>
        </div>

        {/* Selected checkmark */}
        {mode === 'multi' && isSelected && (
          <Check className="w-5 h-5 text-primary mt-1" />
        )}
      </button>
    );
  };

  const renderQuickSelect = () => {
    if (!showQuickSelect || query.length > 0) return null;

    const availableLocalities = POPULAR_LOCALITIES.filter(
      (loc) => !exclude.find((ex) => ex.id === String(loc.id))
    );

    if (availableLocalities.length === 0) return null;

    return (
      <div className="p-4 border-t border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">Popular Locations</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {availableLocalities.map((locality) => (
            <Button
              key={locality.id}
              type="button"
              variant="outline"
              size="sm"
              className="justify-start text-left h-auto py-2"
              onClick={() => handleQuickSelect(locality)}
            >
              <div className="flex items-center gap-2">
                {getEntityIcon('locality', 'w-4 h-4')}
                <div className="truncate">
                  <div className="font-medium text-xs">{locality.name}</div>
                  <div className="text-xs text-muted-foreground">{locality.country_code}</div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </div>
    );
  };

  const renderTypeFilters = () => {
    if (!showTypeFilters) return null;

    return (
      <div className="flex gap-2 p-3 border-b border-border overflow-x-auto">
        {typeFilters.map((filter) => (
          <Button
            key={filter.key}
            type="button"
            variant={activeTypeFilter === filter.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTypeFilter(filter.key)}
            className="flex-shrink-0"
          >
            {filter.label}
          </Button>
        ))}
      </div>
    );
  };

  // ========== Main Render ==========

  return (
    <div className={cn('relative', className)}>
      {/* Type Filters */}
      {renderTypeFilters()}

      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>

        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          dir="auto"
          className="pl-10 pr-10"
          role="combobox"
          aria-expanded={showResults}
          aria-autocomplete="list"
          aria-controls="locality-results"
        />

        {inputValue && (
          <button
            type="button"
            onClick={() => {
              setInputValue('');
              clear();
              setShowResults(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results Dropdown/Inline */}
      {(showResults || (inlineResults && query.length >= 2)) && (
        <div
          ref={resultsRef}
          id="locality-results"
          className={cn(
            "w-full mt-2 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-y-auto",
            !inlineResults && "absolute z-50"
          )}
          role="listbox"
        >
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}

          {!isLoading && results.length === 0 && query.length >= 2 && (
            <div className="px-4 py-8 text-center text-muted-foreground">
              No {filterPreset === 'coverage' ? 'locations' : 'localities'} found for &ldquo;{query}&rdquo;
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="py-2">
              {results.map((result, index) => renderResultItem(result, index))}
            </div>
          )}
        </div>
      )}

      {/* Quick Select */}
      {renderQuickSelect()}

      {/* Multi-Select: Selected Items */}
      {mode === 'multi' && selectedItems.length > 0 && (
        <div className="mt-4 space-y-3">
          {/* Selected items list */}
          <div className="flex flex-wrap gap-2">
            {selectedItems.map((item) => (
              <Badge
                key={item.id}
                variant="secondary"
                className="gap-2 py-1.5 px-3"
              >
                {getEntityIcon(item.type as GeoEntityType, 'w-3 h-3')}
                <span>{item.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  className="hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleConfirmMultiSelect}
              className="flex-1"
            >
              Add {selectedItems.length} {filterPreset === 'coverage'
                ? (selectedItems.length === 1 ? 'Coverage Area' : 'Coverage Areas')
                : (selectedItems.length === 1 ? 'Locality' : 'Localities')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClearAll}
            >
              Clear All
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
