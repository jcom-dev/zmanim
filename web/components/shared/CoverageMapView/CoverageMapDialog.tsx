'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Map, X, Check, Search, Loader2, Globe, RotateCcw } from 'lucide-react';
import type { MapRef } from 'react-map-gl/maplibre';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApi } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { CoverageMapViewGL } from './CoverageMapViewGL';
import type { CoverageMapDialogProps, MapSelection } from './types';
import type { CoverageSelection, City } from '@/components/shared/CoverageSelector';

/**
 * Dialog wrapper for CoverageMapViewGL with search, selection summary, and confirmation.
 * Premium cartographic aesthetic with smooth animations and fly-to functionality.
 */
export function CoverageMapDialog({
  open,
  onOpenChange,
  existingCoverage = [],
  onConfirm,
}: CoverageMapDialogProps) {
  const api = useApi();
  const [selectedRegions, setSelectedRegions] = useState<MapSelection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<City[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedRegions([]);
      setSearchQuery('');
      setSearchResults([]);
      setShowResults(false);
    }
  }, [open]);

  // City search with debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      setShowResults(true);

      try {
        // Use unified coverage search (fast materialized view with GIN indexes)
        const data = await api.public.get<{ results: Array<{
          type: string;
          id: string;
          name: string;
          description: string;
          country_code: string;
        }> }>(
          `/coverage/search?search=${encodeURIComponent(searchQuery)}&limit=8`
        );
        console.log('Search results:', data);

        // Filter to cities only and convert to City format
        const cityResults = (data?.results || [])
          .filter(r => r.type === 'city')
          .map(r => ({
            id: r.id,
            name: r.name,
            country: r.description.split(', ').pop() || '', // Extract country from description
            country_code: r.country_code,
            region: r.description.split(', ')[0] || null, // Extract region from description
            latitude: 0, // Will be fetched on selection
            longitude: 0,
            timezone: '',
            display_name: `${r.name}, ${r.description}`,
          } as City));

        setSearchResults(cityResults);
      } catch (err) {
        console.error('City search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, api]);

  // Close results dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCitySelect = useCallback(
    async (city: City) => {
      // If coordinates are missing (from coverage search), fetch them
      if (city.latitude === 0 && city.longitude === 0) {
        try {
          const fullCity = await api.public.get<City>(`/cities/${city.id}`);
          city.latitude = fullCity.latitude;
          city.longitude = fullCity.longitude;
        } catch (err) {
          console.error('Failed to fetch city coordinates:', err);
          return;
        }
      }

      // Fly to the city on the map at city-level zoom
      mapRef.current?.flyTo({
        center: [city.longitude, city.latitude],
        zoom: 11, // City-level zoom to see the area clearly
        duration: 1500,
        essential: true,
      });

      // Just navigate - don't auto-select the country
      // User can click on the country if they want to add it
      setSearchQuery('');
      setSearchResults([]);
      setShowResults(false);
    },
    [api]
  );

  const handleRemoveSelection = useCallback((code: string) => {
    setSelectedRegions((prev) => prev.filter((r) => r.code !== code));
  }, []);

  const handleClearAll = useCallback(() => {
    setSelectedRegions([]);
  }, []);

  const handleConfirm = useCallback(() => {
    // Convert MapSelection to CoverageSelection format
    const selections: CoverageSelection[] = selectedRegions.map((r) => ({
      type: r.type,
      id: r.code,
      name: r.name,
    }));
    onConfirm(selections);
    onOpenChange(false);
  }, [selectedRegions, onConfirm, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0" hideCloseButton>
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0 bg-card/50 backdrop-blur-sm relative z-20">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-3 text-lg font-semibold">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Map className="w-5 h-5 text-primary" />
              </div>
              <div>
                <span className="tracking-tight">Select Coverage Regions</span>
                <p className="text-xs font-normal text-muted-foreground mt-0.5">
                  Click countries to select or search to navigate
                </p>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Interactive map to select coverage regions. Click countries at world view or cities when zoomed in.
            </DialogDescription>

            {/* Search Input and Close Button */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                  placeholder="Search city to navigate..."
                  className="pl-10 pr-8 h-10 w-72 text-sm bg-background/50 border-border/50 focus:bg-background transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setShowResults(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Search Results Dropdown */}
                {showResults && (
                  <div
                    ref={resultsRef}
                    className={cn(
                      'absolute top-full right-0 mt-2 w-96 bg-card border rounded-xl shadow-2xl',
                      'max-h-80 overflow-y-auto',
                      'animate-in fade-in-0 slide-in-from-top-2 duration-200'
                    )}
                    style={{ zIndex: 100 }}
                  >
                    {isSearching ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                        <span className="font-medium">Searching cities...</span>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="py-2">
                        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b mb-1">
                          Results
                        </div>
                        {searchResults.map((city) => (
                          <button
                            key={city.id}
                            type="button"
                            onClick={() => handleCitySelect(city)}
                            className={cn(
                              'w-full px-4 py-3 text-left text-sm hover:bg-accent/50 flex items-center gap-3',
                              'transition-colors group'
                            )}
                          >
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                              <Globe className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate">{city.name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {city.region ? `${city.region}, ` : ''}
                                {city.country}
                              </div>
                            </div>
                            <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded shrink-0">
                              {city.country_code}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : searchQuery.length >= 2 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                          <Search className="w-5 h-5" />
                        </div>
                        <span className="font-medium">No cities found</span>
                        <p className="text-xs mt-1">Try a different search term</p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Close button */}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg p-2 opacity-70 ring-offset-background transition-opacity hover:opacity-100 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Map Container */}
        <div className="flex-1 relative min-h-0">
          <CoverageMapViewGL
            ref={mapRef}
            selectedRegions={selectedRegions}
            onSelectionChange={setSelectedRegions}
            existingCoverage={existingCoverage}
            height="100%"
            initialZoom={1.8}
          />
        </div>

        {/* Footer with selection summary */}
        <div className="px-6 py-4 border-t flex-shrink-0 bg-card/80 backdrop-blur-md">
          <div className="flex items-center justify-between gap-6">
            {/* Selection Summary */}
            <div className="flex-1 min-w-0">
              {selectedRegions.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {selectedRegions.length} region
                      {selectedRegions.length !== 1 ? 's' : ''} selected
                    </span>
                    {existingCoverage.length > 0 && (
                      <span className="text-xs text-muted-foreground px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                        + {existingCoverage.length} existing
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedRegions.slice(0, 6).map((region) => (
                      <span
                        key={region.code}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                          region.type === 'city'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50'
                            : region.type === 'region'
                              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border border-violet-200 dark:border-violet-800/50'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800/50',
                          'shadow-sm'
                        )}
                      >
                        <span className="text-xs opacity-60 mr-0.5">
                          {region.type === 'city' ? '🏙️' : region.type === 'region' ? '🗺️' : '🌍'}
                        </span>
                        {region.name}
                        <button
                          type="button"
                          onClick={() => handleRemoveSelection(region.code)}
                          className="hover:opacity-70 transition-opacity"
                          aria-label={`Remove ${region.name}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                    {selectedRegions.length > 6 && (
                      <span className="text-sm text-muted-foreground self-center">
                        +{selectedRegions.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                    <Globe className="w-4 h-4" />
                  </div>
                  <span>Click to select: countries at world view, cities when zoomed in</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 flex-shrink-0">
              {selectedRegions.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-muted-foreground"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={selectedRegions.length === 0}
                className="min-w-[140px] shadow-lg"
              >
                <Check className="w-4 h-4 mr-2" />
                Add {selectedRegions.length > 0 ? selectedRegions.length : ''} Region
                {selectedRegions.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
