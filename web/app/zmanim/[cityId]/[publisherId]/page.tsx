'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  MapPin, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Loader2, AlertCircle, ArrowLeft, Info, Search, X, Sun, Moon, Sunset, Clock,
  Star, FlaskConical, ShieldAlert, ShieldCheck, Map
} from 'lucide-react';
import Link from 'next/link';
import { DateTime } from 'luxon';
import { FormulaPanel, type Zman } from '@/components/zmanim/FormulaPanel';
import { DatePickerDropdown } from '@/components/zmanim/DatePickerDropdown';
import { useApi } from '@/lib/api-client';
import { useDisplayGroupMapping, type DisplayGroup } from '@/lib/hooks';
import { formatTimeShort } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { ColorBadge } from '@/components/ui/color-badge';
import { LocationMapView } from '@/components/shared/LocationMapView';

interface City {
  id: string;
  name: string;
  country: string;
  region: string | null;
  timezone: string;
  display_name?: string;
  latitude?: number;
  longitude?: number;
  elevation?: number;
}

interface SearchCity {
  id: string;
  name: string;
  country: string;
  region: string | null;
  display_name: string;
}

interface Publisher {
  id: string;
  name: string;
  logo: string | null; // Base64 data URL
  is_certified: boolean; // Whether this is a certified/authoritative source
}

interface ZmanimData {
  date: string;
  city: City;
  publisher?: Publisher;
  zmanim: Zman[];
  is_default: boolean;
}

// Format zman key to human-readable name (used as fallback when API doesn't provide name)
const formatZmanKey = (key: string): string => {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

// Get icon component for a display group based on icon_name from database
const getIconComponent = (iconName?: string) => {
  switch (iconName) {
    case 'Moon':
      return <Moon className="w-4 h-4" />;
    case 'Sun':
      return <Sun className="w-4 h-4" />;
    case 'Clock':
      return <Clock className="w-4 h-4" />;
    case 'Sunset':
      return <Sunset className="w-4 h-4" />;
    default:
      return <Star className="w-4 h-4" />;
  }
};

export default function ZmanimPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useApi();
  const { theme, setTheme } = useTheme();

  // Database-driven display groups for UI section rendering
  const { timeCategoryToDisplayGroup, displayGroupsMap, displayGroups, isLoading: displayGroupsLoading } = useDisplayGroupMapping();

  const cityId = params.cityId as string;
  const publisherId = params.publisherId as string;
  const isDefault = publisherId === 'default';

  // Date state
  const dateParam = searchParams.get('date');
  const [selectedDate, setSelectedDate] = useState<DateTime>(() => {
    if (dateParam) {
      const parsed = DateTime.fromISO(dateParam);
      return parsed.isValid ? parsed : DateTime.now();
    }
    return DateTime.now();
  });

  const [data, setData] = useState<ZmanimData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZman, setSelectedZman] = useState<Zman | null>(null);
  const [formulaPanelOpen, setFormulaPanelOpen] = useState(false);
  const [showHebrew, setShowHebrew] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  // Location search state
  const [locationSearchOpen, setLocationSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchCity[]>([]);
  const [searching, setSearching] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  // Group zmanim by display group using database-driven mapping
  const groupedZmanim = useMemo(() => {
    const result: Record<string, Zman[]> = {};

    // Initialize all display groups with empty arrays
    for (const group of displayGroups || []) {
      result[group.key] = [];
    }

    // Group zmanim by their display group, filtering by is_core if needed
    for (const zman of data?.zmanim || []) {
      // Show if: showOptional is true (show all), OR zman is core (always show core)
      // This means: hide only if showOptional is false AND zman is not core
      if (showOptional || zman.is_core) {
        const displayGroupKey = timeCategoryToDisplayGroup[zman.time_category || ''] || 'evening';
        if (!result[displayGroupKey]) {
          result[displayGroupKey] = [];
        }
        result[displayGroupKey].push(zman);
      }
    }

    return result;
  }, [data?.zmanim, displayGroups, timeCategoryToDisplayGroup, showOptional]);

  const loadZmanim = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let url = `/zmanim?cityId=${cityId}&date=${selectedDate.toISODate()}`;
      if (!isDefault) {
        url += `&publisherId=${publisherId}`;
      }

      const zmanimData = await api.public.get<{
        date: string;
        location?: { city_id: string; city_name: string; country: string; region: string | null; timezone: string; latitude?: number; longitude?: number; elevation?: number };
        city?: City;
        publisher?: Publisher;
        zmanim: Zman[];
      }>(url);

      // Map location response to City interface
      const location = zmanimData?.location;
      const city: City = location ? {
        id: location.city_id || cityId,
        name: location.city_name || 'Unknown',
        country: location.country || '',
        region: location.region || null,
        timezone: location.timezone || 'UTC',
        latitude: location.latitude,
        longitude: location.longitude,
        elevation: location.elevation,
      } : zmanimData?.city as City;

      setData({
        date: zmanimData?.date || '',
        city: city,
        publisher: zmanimData?.publisher,
        zmanim: zmanimData?.zmanim || [],
        is_default: isDefault || !zmanimData?.publisher,
      });
    } catch (err) {
      console.error('Failed to load zmanim:', err);
      setError(err instanceof Error ? err.message : 'Failed to load zmanim');
    } finally {
      setLoading(false);
    }
  }, [api, cityId, publisherId, isDefault, selectedDate]);

  useEffect(() => {
    if (cityId) {
      loadZmanim();
    }
  }, [cityId, loadZmanim]);

  const handlePrevDay = () => {
    const newDate = selectedDate.minus({ days: 1 });
    setSelectedDate(newDate);
    router.replace(`/zmanim/${cityId}/${publisherId}?date=${newDate.toISODate()}`);
  };

  const handleNextDay = () => {
    const newDate = selectedDate.plus({ days: 1 });
    setSelectedDate(newDate);
    router.replace(`/zmanim/${cityId}/${publisherId}?date=${newDate.toISODate()}`);
  };

  const handleToday = () => {
    const today = DateTime.now();
    setSelectedDate(today);
    router.replace(`/zmanim/${cityId}/${publisherId}`);
  };

  // Search for cities
  const searchCities = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const result = await api.public.get<{ cities: SearchCity[] }>(`/cities?search=${encodeURIComponent(query)}&limit=10`);
      setSearchResults(result?.cities || []);
    } catch (err) {
      console.error('Failed to search cities:', err);
    } finally {
      setSearching(false);
    }
  }, [api]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchCities(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectCity = (newCityId: string) => {
    setLocationSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    router.push(`/zmanim/${newCityId}/${publisherId}${selectedDate ? `?date=${selectedDate.toISODate()}` : ''}`);
  };

  if (loading || displayGroupsLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading zmanim...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto bg-destructive/10 border border-destructive/20 rounded-xl p-8 text-center backdrop-blur-sm">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Error Loading Zmanim</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Link
              href={`/zmanim/${cityId}`}
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to publisher selection
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const city = data?.city;
  const publisher = data?.publisher;
  const zmanim = data?.zmanim || [];

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Header Card */}
          <div className="bg-card/80 backdrop-blur-xl rounded-2xl shadow-lg border border-border/50 transition-all hover:shadow-xl overflow-visible">
            {/* Publisher Info Bar */}
            <div className="bg-gradient-to-r from-primary via-primary to-blue-600 dark:from-primary dark:via-primary dark:to-blue-700 text-primary-foreground px-4 py-3.5 md:px-5 md:py-4 rounded-t-2xl">
              <div className="flex items-center justify-between gap-2 md:gap-3">
                {/* Back button + Publisher */}
                <div className="flex items-center gap-2.5 md:gap-3 min-w-0 flex-1">
                  <Link
                    href={`/zmanim/${cityId}`}
                    className="p-1.5 md:p-2 hover:bg-white/20 rounded-lg transition-all hover:scale-105 active:scale-95 flex-shrink-0 -ml-1"
                    aria-label="Back to publisher selection"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Link>

                  {/* Publisher Logo or Fallback */}
                  {!isDefault && (
                    <div className="relative w-9 h-9 md:w-10 md:h-10 rounded-lg overflow-hidden bg-white/15 backdrop-blur-sm border border-white/25 flex-shrink-0 flex items-center justify-center">
                      {publisher?.logo ? (
                        <Image
                          src={publisher.logo}
                          alt={publisher.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="text-white/90 font-bold text-[10px] md:text-xs tracking-tight">
                          {(publisher?.name || 'P').split(/\s+/).slice(0, 3).map(w => w.charAt(0).toUpperCase()).join('')}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h1 className="font-bold text-sm md:text-lg tracking-tight truncate leading-tight">
                        {isDefault ? 'Default Zmanim' : publisher?.name || 'Zmanim'}
                      </h1>
                      {/* Certified/Community Badge */}
                      {!isDefault && publisher && (
                        publisher.is_certified ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/30 text-emerald-100 rounded border border-emerald-400/40 flex-shrink-0">
                            <ShieldCheck className="w-3 h-3" />
                            <span className="hidden sm:inline">Certified</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-amber-500/30 text-amber-100 rounded border border-amber-400/40 flex-shrink-0">
                            <ShieldAlert className="w-3 h-3" />
                            <span className="hidden sm:inline">Community</span>
                          </span>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <button
                        onClick={() => setLocationSearchOpen(true)}
                        className="flex items-center gap-1 md:gap-1.5 text-primary-foreground/90 text-xs hover:text-white transition-all group"
                      >
                        <MapPin className="w-3 h-3 md:w-3.5 md:h-3.5 flex-shrink-0" />
                        <span className="group-hover:underline underline-offset-2 truncate">
                          {city?.name}, {city?.region ? `${city.region}, ` : ''}{city?.country}
                        </span>
                        <Search className="w-2.5 h-2.5 md:w-3 md:h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </button>
                      {city?.latitude && city?.longitude && (
                        <button
                          onClick={() => setMapExpanded(!mapExpanded)}
                          className="flex items-center gap-1 text-primary-foreground/70 text-[10px] hover:text-white transition-all"
                          title={`${mapExpanded ? 'Hide' : 'Show'} map (${city.latitude.toFixed(4)}, ${city.longitude.toFixed(4)})`}
                        >
                          <Map className="w-3 h-3" />
                          <span className="hidden sm:inline">{mapExpanded ? 'Hide' : 'Map'}</span>
                          {mapExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Language toggle + Theme toggle */}
                <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                  <button
                    onClick={() => setShowHebrew(!showHebrew)}
                    className="px-2.5 md:px-4 py-1.5 md:py-2 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-lg transition-all hover:scale-105 active:scale-95 backdrop-blur-sm border border-white/20"
                  >
                    {showHebrew ? 'English' : 'עברית'}
                  </button>
                  <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="relative p-1.5 md:p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all hover:scale-105 active:scale-95 backdrop-blur-sm border border-white/20"
                    aria-label="Toggle theme"
                  >
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute top-1.5 left-1.5 md:top-2 md:left-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  </button>
                </div>
              </div>
            </div>

            {/* Date Navigation */}
            <div className={`px-5 py-4 flex items-center justify-between gap-4 ${isDefault ? 'border-b border-border/50' : ''}`}>
              <button
                onClick={handlePrevDay}
                className="p-2.5 hover:bg-accent rounded-xl transition-all hover:scale-110 active:scale-95"
                aria-label="Previous day"
              >
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>

              <DatePickerDropdown
                selectedDate={selectedDate}
                onDateChange={(newDate) => {
                  setSelectedDate(newDate);
                  router.replace(`/zmanim/${cityId}/${publisherId}?date=${newDate.toISODate()}`);
                }}
                showHebrew={showHebrew}
              />

              <button
                onClick={handleNextDay}
                className="p-2.5 hover:bg-accent rounded-xl transition-all hover:scale-110 active:scale-95"
                aria-label="Next day"
              >
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Collapsible Map */}
            {mapExpanded && city?.latitude && city?.longitude && (
              <div className="px-4 pb-4">
                <LocationMapView
                  location={{
                    type: 'city',
                    id: city.id,
                    name: city.name,
                    latitude: city.latitude,
                    longitude: city.longitude,
                    elevation: city.elevation,
                    timezone: city.timezone,
                  }}
                  height={250}
                  className="rounded-xl"
                />
              </div>
            )}

            {/* Optional Zmanim Toggle */}
            <div className="px-5 py-3 border-b border-border/50 flex items-center justify-center">
              <button
                onClick={() => setShowOptional(!showOptional)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-muted hover:bg-muted/80 rounded-lg transition-all hover:scale-105 active:scale-95"
              >
                <FlaskConical className="w-4 h-4" />
                {showOptional ? 'Hide Optional Zmanim' : 'Show Optional Zmanim'}
              </button>
            </div>

            {/* Default Warning */}
            {isDefault && (
              <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200/50 dark:border-amber-800/50 rounded-b-2xl">
                <p className="text-amber-800 dark:text-amber-200 text-xs md:text-sm text-center">
                  These are default calculations using standard algorithms. They are not endorsed by a local halachic authority.
                </p>
              </div>
            )}

            {/* Community Publisher Warning */}
            {!isDefault && publisher && !publisher.is_certified && (
              <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200/50 dark:border-amber-800/50 rounded-b-2xl">
                <div className="flex items-center justify-center gap-2 text-amber-800 dark:text-amber-200">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <p className="text-xs md:text-sm text-center">
                    This is a community-contributed source. These times have not been verified by the publisher organization.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Zmanim Content */}
          {zmanim.length === 0 ? (
            <div className="bg-card/80 backdrop-blur-xl rounded-2xl shadow-lg border border-border/50 p-12 text-center">
              <Clock className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">No zmanim available for this date.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Render sections using database-driven display groups */}
              {(displayGroups || []).map((displayGroup) => {
                const sectionZmanim = groupedZmanim[displayGroup.key];
                if (!sectionZmanim || sectionZmanim.length === 0) return null;

                return (
                  <div
                    key={displayGroup.key}
                    className="bg-card/80 backdrop-blur-xl rounded-2xl shadow-lg border border-border/50 overflow-hidden transition-all hover:shadow-xl"
                  >
                    {/* Section Header */}
                    <div className="px-5 py-3 bg-muted/50 border-b border-border/50" dir={showHebrew ? 'rtl' : 'ltr'}>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                          {getIconComponent(displayGroup.icon_name ?? undefined)}
                        </div>
                        <h2 className={`text-sm font-semibold text-foreground tracking-wide uppercase ${showHebrew ? 'font-hebrew' : ''}`}>
                          {showHebrew ? displayGroup.display_name_hebrew : displayGroup.display_name_english}
                        </h2>
                      </div>
                    </div>

                    {/* Zmanim List */}
                    <div className={`divide-y divide-border/50 ${showHebrew ? 'text-right' : ''}`} dir={showHebrew ? 'rtl' : 'ltr'}>
                      {sectionZmanim.map((zman, idx) => {
                        // Use API-provided names - no hardcoded fallbacks
                        const englishName = zman.name || formatZmanKey(zman.key);
                        const hebrewName = zman.hebrew_name || englishName;
                        const displayName = showHebrew ? hebrewName : englishName;
                        const zmanWithName = {
                          ...zman,
                          name: englishName,
                        };

                        return (
                          <div
                            key={zman.key}
                            className="px-5 py-4 hover:bg-accent/50 transition-all group"
                            style={{
                              animation: `fadeSlideIn 0.3s ease-out ${idx * 0.05}s both`
                            }}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className={`text-foreground font-medium text-base md:text-lg ${showHebrew ? 'font-hebrew' : ''}`}>
                                  {displayName}
                                </span>
                                {zman.is_beta && (
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded flex-shrink-0">
                                    Beta
                                  </span>
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedZman(zmanWithName);
                                    setFormulaPanelOpen(true);
                                  }}
                                  className="p-1 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 rounded-md transition-all opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 flex-shrink-0"
                                  aria-label={`Show formula details for ${englishName}`}
                                >
                                  <Info className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div
                                className="text-xl md:text-2xl font-bold bg-gradient-to-br from-primary via-primary to-blue-600 dark:from-primary dark:via-primary dark:to-blue-400 bg-clip-text text-transparent tabular-nums tracking-tight flex-shrink-0"
                                dir="ltr"
                              >
                                {formatTimeShort(zman.time)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer Info */}
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">
              Timezone: {city?.timezone || 'Unknown'}
            </p>
          </div>
        </div>
      </div>

      {/* Formula Panel */}
      <FormulaPanel
        zman={selectedZman}
        open={formulaPanelOpen}
        onClose={() => {
          setFormulaPanelOpen(false);
          setSelectedZman(null);
        }}
      />

      {/* Location Search Modal */}
      {locationSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-md"
            onClick={() => {
              setLocationSearchOpen(false);
              setSearchQuery('');
              setSearchResults([]);
            }}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg bg-card rounded-2xl shadow-2xl overflow-hidden border border-border/50 animate-in slide-in-from-top-4 duration-300">
            {/* Search Header */}
            <div className="p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search for a city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-foreground placeholder-muted-foreground outline-none text-base"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setLocationSearchOpen(false);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="p-2 hover:bg-accent rounded-lg transition-all hover:scale-110 active:scale-95 flex-shrink-0"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              {!isDefault && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 ml-8">
                  Note: This publisher may not cover all locations. If your city is not covered, try Default Zmanim.
                </p>
              )}
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {searching && (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">Searching...</p>
                </div>
              )}

              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="p-8 text-center">
                  <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">No cities found for &quot;{searchQuery}&quot;</p>
                </div>
              )}

              {!searching && searchResults.map((result, idx) => (
                <button
                  key={result.id}
                  onClick={() => handleSelectCity(result.id)}
                  className="w-full px-5 py-4 text-left hover:bg-accent/50 transition-all flex items-center gap-3 border-b border-border/50 last:border-0 group"
                  style={{
                    animation: `fadeSlideIn 0.2s ease-out ${idx * 0.03}s both`
                  }}
                >
                  <div className="p-2 bg-primary/10 text-primary rounded-lg group-hover:scale-110 transition-transform flex-shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {result.name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {result.region ? `${result.region}, ` : ''}{result.country}
                    </p>
                  </div>
                </button>
              ))}

              {!searching && searchQuery.length < 2 && (
                <div className="p-8 text-center">
                  <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    Type at least 2 characters to search
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Styles for Animations */}
      <style jsx global>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
