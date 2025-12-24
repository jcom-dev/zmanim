'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { HighlightedFormula } from '@/components/shared/HighlightedFormula';
import {
  ChevronDown,
  ChevronUp,
  Check,
  MapPin,
  Search,
  X,
  Loader2,
  CalendarDays,
  Flame,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApi } from '@/lib/api-client';
import {
  useMasterZmanimGrouped,
  useEventZmanimGrouped,
  MasterZman,
  GroupedMasterZmanim,
} from '@/lib/hooks/useZmanimList';
import { useTimeCategories } from '@/lib/hooks/useCategories';
import { getIcon } from '@/lib/icons';
import type { OnboardingState, SelectedZmanCustomization } from '../OnboardingWizard';

// Default preview location (Jerusalem)
const DEFAULT_PREVIEW_LOCATION = {
  latitude: 31.7683,
  longitude: 35.2137,
  timezone: 'Asia/Jerusalem',
  displayName: 'Jerusalem, Israel',
};

interface PreviewLocation {
  latitude: number;
  longitude: number;
  timezone: string;
  displayName: string;
}

interface Locality {
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

interface CustomizeZmanimStepProps {
  state: OnboardingState;
  onUpdate: (updates: Partial<OnboardingState['data']>) => void;
  onNext: () => void;
  onBack: () => void;
}

// Use the exported type from OnboardingWizard
type SelectedZman = SelectedZmanCustomization;

export function CustomizeZmanimStep({ state, onUpdate, onNext, onBack }: CustomizeZmanimStepProps) {
  const api = useApi();
  const [viewMode, setViewMode] = useState<'everyday' | 'events'>('everyday');
  const [selectedZmanim, setSelectedZmanim] = useState<Map<string, SelectedZman>>(
    () => {
      // Initialize from state if available
      if (state.data.customizations && Array.isArray(state.data.customizations)) {
        const map = new Map<string, SelectedZman>();
        (state.data.customizations as SelectedZman[]).forEach((z) => {
          map.set(z.zman_key, z);
        });
        return map;
      }
      return new Map();
    }
  );
  const [previewTimes, setPreviewTimes] = useState<Record<string, string | null>>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Location selector state
  const [previewLocation, setPreviewLocation] = useState<PreviewLocation>(DEFAULT_PREVIEW_LOCATION);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [localitySearch, setLocalitySearch] = useState('');
  const [localityResults, setLocalityResults] = useState<Locality[]>([]);
  const [localitySearchLoading, setLocalitySearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Track if initial selection has been done
  const initializedRef = useRef(false);

  // Fetch categories from database
  const { data: timeCategories, isLoading: loadingTimeCategories } = useTimeCategories();

  // Fetch zmanim from registry
  const { data: everydayZmanim, isLoading: loadingEveryday } = useMasterZmanimGrouped();
  const { data: eventZmanim, isLoading: loadingEvents } = useEventZmanimGrouped();

  // Build category config maps from database data
  const timeCategoryMap = useMemo(() => {
    if (!timeCategories) return {};
    return timeCategories.reduce((acc, tc) => {
      acc[tc.key] = {
        icon: getIcon(tc.icon_name),
        label: tc.display_name_english,
        description: tc.description || '',
      };
      return acc;
    }, {} as Record<string, { icon: React.ElementType; label: string; description: string }>);
  }, [timeCategories]);

  // For event zmanim, use zman_tags instead of event_categories
  // Event zmanim are grouped by purpose (candles, havdalah, etc.) via tags
  const eventCategoryMap = useMemo(() => {
    if (!eventZmanim) return {};
    // Build a map of event categories from the actual data
    const map: Record<string, { icon: React.ElementType; label: string; hebrewLabel: string; description: string }> = {};
    Object.keys(eventZmanim).forEach((key) => {
      // Use generic icon/label for event categories
      map[key] = {
        icon: getIcon('flame'),
        label: key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        hebrewLabel: '',
        description: '',
      };
    });
    return map;
  }, [eventZmanim]);

  // Category order from database (sorted by sort_order)
  const everydayCategoryOrder = useMemo(() => {
    return timeCategories?.map(tc => tc.key) || [];
  }, [timeCategories]);

  const eventCategoryOrder = useMemo(() => {
    return eventZmanim ? Object.keys(eventZmanim) : [];
  }, [eventZmanim]);

  const isLoading = viewMode === 'everyday'
    ? loadingEveryday || loadingTimeCategories
    : loadingEvents;
  const rawGroups = viewMode === 'everyday' ? everydayZmanim : eventZmanim;
  const categoryOrder = viewMode === 'everyday' ? everydayCategoryOrder : eventCategoryOrder;
  const categoryConfig = viewMode === 'everyday' ? timeCategoryMap : eventCategoryMap;

  // Initialize default selections when both data sources have loaded
  // Uses is_core flag from master registry instead of hardcoded list
  useEffect(() => {
    // Skip if already initialized or if we have state from wizard
    if (initializedRef.current) return;
    if (state.data.customizations && Array.isArray(state.data.customizations) && state.data.customizations.length > 0) {
      initializedRef.current = true;
      return;
    }

    // Wait for both data sources to load
    if (!everydayZmanim || !eventZmanim) return;

    initializedRef.current = true;
    const initialSelections = new Map<string, SelectedZman>();

    // Add core everyday zmanim
    Object.values(everydayZmanim).flat().forEach((zman) => {
      if (zman.is_core) {
        initialSelections.set(zman.zman_key, {
          master_zman_id: zman.id,
          zman_key: zman.zman_key,
          hebrew_name: zman.canonical_hebrew_name,
          english_name: zman.canonical_english_name,
          formula: zman.default_formula_dsl,
          category: 'everyday',
          time_category: zman.time_category,
          enabled: true,
          modified: false,
        });
      }
    });

    // Add core event zmanim
    Object.values(eventZmanim).flat().forEach((zman) => {
      if (zman.is_core) {
        initialSelections.set(zman.zman_key, {
          master_zman_id: zman.id,
          zman_key: zman.zman_key,
          hebrew_name: zman.canonical_hebrew_name,
          english_name: zman.canonical_english_name,
          formula: zman.default_formula_dsl,
          category: 'event',
          time_category: zman.time_category,
          enabled: true,
          modified: false,
        });
      }
    });

    setSelectedZmanim(initialSelections);
  }, [everydayZmanim, eventZmanim, state.data.customizations]);

  // Filter groups by search
  const filteredGroups = useMemo(() => {
    if (!rawGroups) return {};

    const result: Record<string, MasterZman[]> = {};
    const query = searchQuery.toLowerCase();

    for (const [category, zmanim] of Object.entries(rawGroups)) {
      const filtered = zmanim.filter((z) => {
        if (query) {
          return (
            z.canonical_hebrew_name.toLowerCase().includes(query) ||
            z.canonical_english_name.toLowerCase().includes(query) ||
            z.transliteration?.toLowerCase().includes(query) ||
            z.zman_key.toLowerCase().includes(query)
          );
        }
        return true;
      });

      if (filtered.length > 0) {
        result[category] = filtered;
      }
    }

    // Sort entries by category order
    const sortedResult: Record<string, MasterZman[]> = {};
    for (const cat of categoryOrder) {
      if (result[cat]) {
        sortedResult[cat] = result[cat];
      }
    }

    return sortedResult;
  }, [rawGroups, searchQuery, categoryOrder]);

  // Fetch preview times for selected zmanim
  const fetchPreviewTimes = useCallback(async () => {
    const enabledZmanim = Array.from(selectedZmanim.values()).filter((z) => z.enabled);

    if (enabledZmanim.length === 0) {
      setPreviewTimes({});
      return;
    }

    setPreviewLoading(true);
    const date = new Date().toISOString().split('T')[0];
    const times: Record<string, string | null> = {};

    try {
      const results = await Promise.allSettled(
        enabledZmanim.map(async (zman) => {
          const response = await api.post<{ result?: string; time?: string }>('/dsl/preview', {
            body: JSON.stringify({
              formula: zman.formula,
              date,
              latitude: previewLocation.latitude,
              longitude: previewLocation.longitude,
              timezone: previewLocation.timezone,
            }),
          });
          return { key: zman.zman_key, time: response.result || response.time || null };
        })
      );

      results.forEach((result, index) => {
        const key = enabledZmanim[index].zman_key;
        if (result.status === 'fulfilled') {
          times[key] = result.value.time;
        } else {
          times[key] = null;
        }
      });

      setPreviewTimes(times);
    } catch (err) {
      console.error('Failed to fetch preview times:', err);
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedZmanim, api, previewLocation]);

  // Fetch preview times on mount and when selections change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchPreviewTimes();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [fetchPreviewTimes]);

  // Save customizations when they change
  useEffect(() => {
    const customizations = Array.from(selectedZmanim.values());
    onUpdate({ customizations });
  }, [selectedZmanim]);

  // Locality search with debounce using unified /localities/search endpoint
  useEffect(() => {
    if (localitySearch.length < 2) {
      setLocalityResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLocalitySearchLoading(true);
      try {
        const data = await api.public.get<{ results: Array<{ entity_id: number; name: string; country_name: string; country_code: string; region_name: string | null; latitude: number; longitude: number; timezone: string }> }>(
          `/localities/search?q=${encodeURIComponent(localitySearch)}&types=locality&limit=10`
        );
        // Map /localities/search response to Locality format
        const localities: Locality[] = (data?.results || []).map(r => ({
          id: String(r.entity_id),
          name: r.name,
          country: r.country_name || '',
          country_code: r.country_code || '',
          region: r.region_name || null,
          latitude: r.latitude,
          longitude: r.longitude,
          timezone: r.timezone || 'UTC',
          display_name: r.region_name ? `${r.name}, ${r.region_name}, ${r.country_name}` : `${r.name}, ${r.country_name}`,
        }));
        setLocalityResults(localities);
      } catch (err) {
        console.error('[LocalitySearch] Error:', err);
        setLocalityResults([]);
      } finally {
        setLocalitySearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [localitySearch, api]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowLocationSearch(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (showLocationSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showLocationSearch]);

  const selectLocality = (locality: Locality) => {
    const displayName =
      locality.display_name || `${locality.name}${locality.region ? `, ${locality.region}` : ''}, ${locality.country}`;
    setPreviewLocation({
      latitude: locality.latitude,
      longitude: locality.longitude,
      timezone: locality.timezone,
      displayName,
    });
    setShowLocationSearch(false);
    setLocalitySearch('');
    setLocalityResults([]);
  };

  const toggleZman = (zman: MasterZman, category: 'everyday' | 'event') => {
    setSelectedZmanim((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(zman.zman_key)) {
        // Toggle enabled state or remove if disabling
        const existing = newMap.get(zman.zman_key)!;
        if (existing.enabled) {
          newMap.delete(zman.zman_key);
        } else {
          newMap.set(zman.zman_key, { ...existing, enabled: true });
        }
      } else {
        // Add new selection
        newMap.set(zman.zman_key, {
          master_zman_id: zman.id,
          zman_key: zman.zman_key,
          hebrew_name: zman.canonical_hebrew_name,
          english_name: zman.canonical_english_name,
          formula: zman.default_formula_dsl,
          category,
          time_category: zman.time_category,
          enabled: true,
          modified: false,
        });
      }
      return newMap;
    });
  };

  const isSelected = (zmanKey: string) => {
    const selection = selectedZmanim.get(zmanKey);
    return selection?.enabled ?? false;
  };

  const enabledCount = Array.from(selectedZmanim.values()).filter((z) => z.enabled).length;
  const everydayCount = Array.from(selectedZmanim.values()).filter(
    (z) => z.enabled && z.category === 'everyday'
  ).length;
  const eventCount = Array.from(selectedZmanim.values()).filter(
    (z) => z.enabled && z.category === 'event'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Select Your Zmanim</h2>
        <p className="text-muted-foreground">
          Choose which zmanim to include. You can customize formulas later in the Algorithm Editor.
        </p>
      </div>

      {/* Selection counter and preview location */}
      <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
        <Badge variant="secondary" className="text-sm">
          {enabledCount} zmanim selected ({everydayCount} everyday, {eventCount} events)
        </Badge>

        {/* Location selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLocationSearch(!showLocationSearch)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
          >
            <MapPin className="h-4 w-4 text-primary" />
            <span className="max-w-[200px] truncate">{previewLocation.displayName}</span>
            {previewLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>

          {/* Locality search dropdown */}
          {showLocationSearch && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 mt-1 w-80 bg-background border rounded-md shadow-lg z-50"
            >
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search any locality..."
                    value={localitySearch}
                    onChange={(e) => setLocalitySearch(e.target.value)}
                    className="pl-8 pr-8 h-9"
                  />
                  {localitySearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setLocalitySearch('');
                        setLocalityResults([]);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto">
                {localitySearchLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                    Searching...
                  </div>
                ) : localityResults.length > 0 ? (
                  <div className="py-1">
                    {localityResults.map((locality) => (
                      <button
                        key={locality.id}
                        type="button"
                        onClick={() => selectLocality(locality)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-start gap-2"
                      >
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium">{locality.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {locality.region ? `${locality.region}, ` : ''}
                            {locality.country}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : localitySearch.length >= 2 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No localities found for &quot;{localitySearch}&quot;
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Type at least 2 characters to search
                  </div>
                )}
              </div>

              {/* Quick select for common localities */}
              <div className="border-t p-2">
                <div className="text-xs text-muted-foreground mb-2">Quick select:</div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { name: 'Jerusalem', lat: 31.7683, lng: 35.2137, tz: 'Asia/Jerusalem', country: 'Israel' },
                    { name: 'New York', lat: 40.7128, lng: -74.006, tz: 'America/New_York', country: 'USA' },
                    { name: 'London', lat: 51.5074, lng: -0.1278, tz: 'Europe/London', country: 'UK' },
                    { name: 'Los Angeles', lat: 34.0522, lng: -118.2437, tz: 'America/Los_Angeles', country: 'USA' },
                  ].map((locality) => (
                    <button
                      key={locality.name}
                      type="button"
                      onClick={() => {
                        setPreviewLocation({
                          latitude: locality.lat,
                          longitude: locality.lng,
                          timezone: locality.tz,
                          displayName: `${locality.name}, ${locality.country}`,
                        });
                        setShowLocationSearch(false);
                      }}
                      className="px-2 py-1 text-xs border rounded hover:bg-accent"
                    >
                      {locality.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs for Everyday / Events */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'everyday' | 'events')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="everyday" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Everyday Zmanim
            {everydayCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {everydayCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2">
            <Flame className="h-4 w-4" />
            Event Zmanim
            {eventCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {eventCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Zmanim List */}
      <ScrollArea className="h-[350px]">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : Object.keys(filteredGroups).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? <p>No matching zmanim found</p> : <p>No zmanim available</p>}
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={[]} className="w-full">
            {Object.entries(filteredGroups).map(([category, zmanim]) => {
              const config = categoryConfig[category] || {
                icon: Clock,
                label: category,
                description: '',
              };
              const Icon = config.icon;
              const selectedInCategory = zmanim.filter((z) => isSelected(z.zman_key)).length;

              return (
                <AccordionItem key={category} value={category}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div className="text-left">
                        <span className="font-medium">{config.label}</span>
                        {'hebrewLabel' in config && (config as { hebrewLabel?: string }).hebrewLabel && (
                          <span className="text-muted-foreground ml-2 text-sm">
                            {(config as { hebrewLabel: string }).hebrewLabel}
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs ml-auto mr-2">
                        {selectedInCategory}/{zmanim.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {'description' in config && config.description && (
                      <p className="text-xs text-muted-foreground mb-2 pl-7">{config.description}</p>
                    )}
                    <div className="space-y-1 pl-7">
                      {zmanim.map((zman) => {
                        const selected = isSelected(zman.zman_key);
                        const previewTime = previewTimes[zman.zman_key];

                        return (
                          <button
                            key={zman.id}
                            onClick={() => toggleZman(zman, viewMode === 'everyday' ? 'everyday' : 'event')}
                            className={cn(
                              'w-full text-left p-3 rounded-lg border transition-colors flex items-start gap-3',
                              selected
                                ? 'border-primary/50 bg-primary/5'
                                : 'border-transparent hover:border-primary/30 hover:bg-primary/5'
                            )}
                          >
                            {/* Checkbox */}
                            <div
                              className={cn(
                                'mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0',
                                selected
                                  ? 'bg-primary border-primary text-primary-foreground'
                                  : 'border-muted-foreground/30'
                              )}
                            >
                              {selected && <Check className="h-3 w-3" />}
                            </div>

                            {/* Zman Info */}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">
                                {zman.canonical_hebrew_name}
                                <span className="text-muted-foreground mx-2">•</span>
                                {zman.canonical_english_name}
                              </div>
                              {zman.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {zman.description}
                                </p>
                              )}
                              <div className="mt-1">
                                <HighlightedFormula
                                  formula={zman.default_formula_dsl}
                                  inline
                                  className="text-xs"
                                />
                              </div>
                            </div>

                            {/* Preview Time */}
                            {selected && previewTime && (
                              <div className="text-right min-w-[60px]">
                                <span className="font-mono text-sm font-medium text-primary">
                                  {previewTime}
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </ScrollArea>

      {/* Link to advanced */}
      <div className="text-center pt-2">
        <p className="text-sm text-muted-foreground">
          Need more control? You can fine-tune every formula in the{' '}
          <span className="text-primary font-medium">Algorithm Editor</span> after completing setup.
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={enabledCount === 0}>
          Continue
        </Button>
      </div>
    </div>
  );
}
