'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  MapPin, ChevronLeft, ChevronRight,
  Loader2, AlertCircle, ArrowLeft, Info, Search, X,
  Sunrise, Moon, Sun, Clock, Building2, ShieldCheck, Map, EyeOff, Eye, Star
} from 'lucide-react';
import Link from 'next/link';
import { DateTime } from 'luxon';
import { FormulaPanel, type Zman } from '@/components/zmanim/FormulaPanel';
import { DatePickerDropdown } from '@/components/zmanim/DatePickerDropdown';
import { useApi } from '@/lib/api-client';
import { formatTimeTo12Hour } from '@/lib/utils/time-format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { type ColorBadgeColor } from '@/components/ui/color-badge';
import { LocationMapView } from '@/components/shared/LocationMapView';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { LocalitySearchResult } from '@/types/geography';

// Extend LocalitySearchResult with optional fields specific to this page
interface Locality extends Omit<LocalitySearchResult, 'country_name'> {
  country: string;  // API returns 'country' field for backward compatibility
  region?: string | null;  // Alias for region_name for backward compatibility
}

// Use LocalitySearchResult for search results
type SearchLocality = LocalitySearchResult;

interface Publisher {
  id: string;
  name: string;
  organization: string | null;
  logo?: string | null;
  is_certified?: boolean;
}

// Holiday/Event info from the API
interface HolidayInfo {
  name: string;
  name_hebrew: string;
  category: string; // "major", "minor", "shabbat", "roshchodesh", "fast"
  is_yom_tov: boolean;
}

// Day context from the API
interface DayContext {
  hebrew_date: string;        // e.g., "1 Tevet 5785"
  hebrew_date_hebrew: string; // e.g., "א׳ טבת תשפ״ה"
  day_of_week: number;        // 0=Sunday, 6=Saturday
  day_name_eng: string;       // e.g., "Sunday"
  day_name_hebrew: string;    // e.g., "יום ראשון"
  is_shabbat: boolean;
  is_yom_tov: boolean;
  holidays: HolidayInfo[];
}

interface ZmanimData {
  date: string;
  day_context?: DayContext;
  locality: Locality;
  publisher?: Publisher;
  zmanim: Zman[];
  is_default: boolean;
}

// Holiday badge styling
function getHolidayBadgeClass(category: string): string {
  switch (category) {
    case 'major': return 'bg-purple-600 text-white border-purple-700';
    case 'fast': return 'bg-red-600 text-white border-red-700';
    case 'roshchodesh': return 'bg-blue-600 text-white border-blue-700';
    case 'shabbat': return 'bg-amber-500 text-black border-amber-600';
    case 'minor': return 'bg-teal-600 text-white border-teal-700';
    default: return 'bg-slate-600 text-white border-slate-700';
  }
}

// Time category icons, colors, and names
const categoryConfig: Record<string, { icon: React.ReactNode; color: ColorBadgeColor; borderColor: string; nameEn: string; nameHe: string }> = {
  dawn: { icon: <Moon className="w-4 h-4" />, color: 'purple', borderColor: 'border-l-purple-500', nameEn: 'Dawn', nameHe: 'עלות השחר' },
  sunrise: { icon: <Sunrise className="w-4 h-4" />, color: 'amber', borderColor: 'border-l-amber-500', nameEn: 'Sunrise', nameHe: 'הנץ החמה' },
  morning: { icon: <Sun className="w-4 h-4" />, color: 'yellow', borderColor: 'border-l-yellow-500', nameEn: 'Morning', nameHe: 'בוקר' },
  midday: { icon: <Sun className="w-4 h-4" />, color: 'orange', borderColor: 'border-l-orange-500', nameEn: 'Midday', nameHe: 'צהריים' },
  afternoon: { icon: <Sun className="w-4 h-4 opacity-70" />, color: 'rose', borderColor: 'border-l-rose-500', nameEn: 'Afternoon', nameHe: 'אחר הצהריים' },
  sunset: { icon: <Sunrise className="w-4 h-4 rotate-180" />, color: 'rose', borderColor: 'border-l-rose-500', nameEn: 'Sunset', nameHe: 'שקיעה' },
  nightfall: { icon: <Moon className="w-4 h-4" />, color: 'indigo', borderColor: 'border-l-indigo-500', nameEn: 'Nightfall', nameHe: 'צאת הכוכבים' },
  midnight: { icon: <Moon className="w-4 h-4" />, color: 'slate', borderColor: 'border-l-slate-500', nameEn: 'Midnight', nameHe: 'חצות הלילה' },
  other: { icon: <Clock className="w-4 h-4" />, color: 'slate', borderColor: 'border-l-slate-500', nameEn: 'Other Times', nameHe: 'זמנים נוספים' },
};

// Group zmanim by time category
function groupZmanimByCategory(zmanim: Zman[]): Record<string, Zman[]> {
  const groups: Record<string, Zman[]> = {};
  for (const zman of zmanim) {
    const category = zman.time_category || 'other';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(zman);
  }
  return groups;
}

// Category display order
const categoryOrder = ['dawn', 'sunrise', 'morning', 'midday', 'afternoon', 'sunset', 'nightfall', 'midnight', 'other'];

export default function ZmanimPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useApi();

  const localityId = params.localityId as string;
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
  const [showMap, setShowMap] = useState(false);
  const [displayLanguage, setDisplayLanguage] = useState<'english' | 'hebrew'>('english');
  const [showOptional, setShowOptional] = useState(true);

  // Location search state
  const [locationSearchOpen, setLocationSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchLocality[]>([]);
  const [searching, setSearching] = useState(false);

  const loadZmanim = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params for the zmanim endpoint
      const queryParams = new URLSearchParams({
        localityId: localityId,
        date: selectedDate.toISODate() || '',
      });

      if (!isDefault) {
        queryParams.set('publisherId', publisherId);
      }

      const response = await api.public.get<{
        date: string;
        day_context?: DayContext;
        location: {
          locality_id: number;
          locality_name: string;
          country: string;
          country_code?: string;
          region: string | null;
          display_hierarchy?: string;
          timezone: string;
          latitude: number;
          longitude: number;
          elevation?: number;
        };
        publisher?: {
          id: string;
          name: string;
          organization?: string | null;
          logo?: string;
          is_certified: boolean;
        };
        zmanim: Zman[];
      }>(`/zmanim?${queryParams.toString()}`);

      if (!response) {
        throw new Error('Failed to load zmanim');
      }

      // Map location response to Locality interface
      const location = response.location;
      const locality: Locality = {
        type: 'locality',
        id: String(location.locality_id),
        name: location.locality_name,
        // Use display_hierarchy from API if available, fallback to building manually
        description: location.display_hierarchy || (location.region ? `${location.locality_name}, ${location.region}, ${location.country}` : `${location.locality_name}, ${location.country}`),
        display_hierarchy: location.display_hierarchy,
        country: location.country,
        country_code: location.country_code || '',
        region: location.region || undefined,
        region_name: location.region || undefined,
        timezone: location.timezone,
        latitude: location.latitude,
        longitude: location.longitude,
        elevation: location.elevation,
      };

      // Map publisher response to include organization field
      const publisher = response.publisher ? {
        ...response.publisher,
        organization: response.publisher.organization || null,
      } : undefined;

      setData({
        date: response.date,
        day_context: response.day_context,
        locality: locality,
        publisher: publisher,
        zmanim: response.zmanim || [],
        is_default: isDefault || !response.publisher,
      });
    } catch (err) {
      console.error('Failed to load zmanim:', err);
      setError(err instanceof Error ? err.message : 'Failed to load zmanim');
    } finally {
      setLoading(false);
    }
  }, [api, localityId, publisherId, selectedDate, isDefault]);

  useEffect(() => {
    if (localityId) {
      loadZmanim();
    }
  }, [localityId, loadZmanim]);

  const handlePrevDay = () => {
    const newDate = selectedDate.minus({ days: 1 });
    setSelectedDate(newDate);
    router.replace(`/zmanim/${localityId}/${publisherId}?date=${newDate.toISODate()}`);
  };

  const handleNextDay = () => {
    const newDate = selectedDate.plus({ days: 1 });
    setSelectedDate(newDate);
    router.replace(`/zmanim/${localityId}/${publisherId}?date=${newDate.toISODate()}`);
  };

  // Search for localities
  const searchLocalities = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await api.public.get<{
        localities: SearchLocality[];
      }>(`/localities/search?q=${encodeURIComponent(query)}&limit=10`);
      setSearchResults(response?.localities || []);
    } catch (err) {
      console.error('Failed to search localities:', err);
    } finally {
      setSearching(false);
    }
  }, [api]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchLocalities(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchLocalities]);

  const handleSelectLocality = (newLocalityId: string) => {
    setLocationSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    router.push(`/zmanim/${newLocalityId}/${publisherId}${selectedDate ? `?date=${selectedDate.toISODate()}` : ''}`);
  };

  // Extract data (must be before useMemo to satisfy hooks rules)
  const locality = data?.locality;
  const publisher = data?.publisher;
  const zmanim = data?.zmanim || [];
  const dayContext = data?.day_context;

  // Filter zmanim by core/optional and count (must be called unconditionally)
  const { filteredZmanim, coreCount, optionalCount } = useMemo(() => {
    const core = zmanim.filter(z => z.is_core);
    const optional = zmanim.filter(z => !z.is_core);
    const filtered = showOptional ? zmanim : core;
    return { filteredZmanim: filtered, coreCount: core.length, optionalCount: optional.length };
  }, [zmanim, showOptional]);

  const groupedZmanim = useMemo(() => groupZmanimByCategory(filteredZmanim), [filteredZmanim]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Error</h2>
            <p className="text-destructive mb-4">{error}</p>
            <Link
              href={`/zmanim/${localityId}`}
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to publisher selection
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-4">
        {/* Top Bar: Back button, Location, Map toggle, Language toggle */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={`/zmanim/${localityId}`}
                  className="p-2 hover:bg-accent rounded-full transition-colors shrink-0"
                  aria-label="Back to publisher selection"
                >
                  <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>Back to publisher selection</TooltipContent>
            </Tooltip>
            <button
              onClick={() => setLocationSearchOpen(true)}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group min-w-0"
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="group-hover:underline truncate text-sm">
                {locality?.display_hierarchy || `${locality?.name}${locality?.region_name ? `, ${locality.region_name}` : ''}, ${locality?.country}`}
              </span>
              <Search className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* View Map button */}
            {locality?.latitude && locality?.longitude && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMap(!showMap)}
                    className="hidden sm:flex"
                  >
                    {showMap ? <EyeOff className="w-4 h-4 mr-1" /> : <Map className="w-4 h-4 mr-1" />}
                    {showMap ? 'Hide' : 'Map'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{showMap ? 'Hide location map' : 'Show location map'}</TooltipContent>
              </Tooltip>
            )}
            {/* Language Toggle - EN/עב */}
            <div className="flex rounded-md border border-input overflow-hidden h-8">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setDisplayLanguage('english')}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                      displayLanguage === 'english'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    EN
                  </button>
                </TooltipTrigger>
                <TooltipContent>Display times in English</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setDisplayLanguage('hebrew')}
                    className={`px-2.5 py-1 text-xs font-medium font-hebrew transition-colors ${
                      displayLanguage === 'hebrew'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    עב
                  </button>
                </TooltipTrigger>
                <TooltipContent>Display times in Hebrew</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Date Header Card - Shows Day of Week, Date, Hebrew Date, Events */}
        <Card className={`overflow-hidden ${
          dayContext?.is_yom_tov ? 'border-purple-500/50' :
          dayContext?.is_shabbat ? 'border-amber-500/50' : ''
        }`}>
          <div className={`px-4 py-4 ${
            dayContext?.is_yom_tov ? 'bg-purple-500/10' :
            dayContext?.is_shabbat ? 'bg-amber-500/10' : 'bg-muted/30'
          }`}>
            {/* Date Navigation Row */}
            <div className="flex items-center justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePrevDay}
                    aria-label="Previous day"
                    className="shrink-0"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View previous day</TooltipContent>
              </Tooltip>

              {/* Center: Day Info */}
              <div className="flex-1 text-center px-2">
                {displayLanguage === 'hebrew' ? (
                  // Hebrew layout
                  <div dir="rtl">
                    <div className={`text-2xl font-bold font-hebrew ${
                      dayContext?.is_yom_tov ? 'text-purple-400' :
                      dayContext?.is_shabbat ? 'text-amber-400' : 'text-foreground'
                    }`}>
                      {dayContext?.day_name_hebrew || selectedDate.toFormat('EEEE')}
                    </div>
                    <div className="text-lg font-hebrew text-muted-foreground">
                      {dayContext?.hebrew_date_hebrew || dayContext?.hebrew_date || ''}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {selectedDate.toFormat('d MMMM yyyy')}
                    </div>
                  </div>
                ) : (
                  // English layout
                  <div>
                    <div className={`text-2xl font-bold ${
                      dayContext?.is_yom_tov ? 'text-purple-400' :
                      dayContext?.is_shabbat ? 'text-amber-400' : 'text-foreground'
                    }`}>
                      {dayContext?.day_name_eng || selectedDate.toFormat('EEEE')}
                    </div>
                    <div className="text-lg text-muted-foreground">
                      {selectedDate.toFormat('MMMM d, yyyy')}
                    </div>
                    <div className="text-xs text-muted-foreground font-hebrew mt-0.5" dir="rtl">
                      {dayContext?.hebrew_date_hebrew || dayContext?.hebrew_date || ''}
                    </div>
                  </div>
                )}
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNextDay}
                    aria-label="Next day"
                    className="shrink-0"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View next day</TooltipContent>
              </Tooltip>
            </div>

            {/* Event Badges Row */}
            {((dayContext?.holidays && dayContext.holidays.length > 0) || dayContext?.is_shabbat) && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                {dayContext?.is_shabbat && !dayContext.holidays?.some(h => h.category === 'shabbat') && (
                  <Badge variant="solid" className="text-xs bg-amber-500 text-black border-amber-600">
                    <Moon className="h-3 w-3 mr-1" />
                    {displayLanguage === 'hebrew' ? 'שבת קודש' : 'Shabbat'}
                  </Badge>
                )}
                {dayContext?.holidays?.map((holiday, idx) => (
                  <Badge key={idx} variant="solid" className={`text-xs ${getHolidayBadgeClass(holiday.category)}`}>
                    {holiday.is_yom_tov && <Star className="h-3 w-3 mr-1" />}
                    {displayLanguage === 'hebrew' ? holiday.name_hebrew : holiday.name}
                  </Badge>
                ))}
              </div>
            )}

            {/* Date Picker Button */}
            <div className="flex justify-center mt-3">
              <DatePickerDropdown
                selectedDate={selectedDate}
                onDateChange={(newDate) => {
                  setSelectedDate(newDate);
                  router.replace(`/zmanim/${localityId}/${publisherId}?date=${newDate.toISODate()}`);
                }}
                showHebrew={displayLanguage === 'hebrew'}
              />
            </div>
          </div>

          {/* Publisher Info & Controls */}
          <CardContent className="py-3">
            <div className="flex items-center justify-between gap-3">
              {/* Publisher Info */}
              <div className="flex items-center gap-3 min-w-0">
                {!isDefault && publisher?.logo ? (
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-border shrink-0">
                    <Image
                      src={publisher.logo}
                      alt={publisher.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {isDefault ? (
                      <Clock className="w-5 h-5 text-primary" />
                    ) : (
                      <Building2 className="w-5 h-5 text-primary" />
                    )}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground truncate">
                      {isDefault ? 'Default Zmanim' : publisher?.name || 'Zmanim'}
                    </span>
                    {publisher?.is_certified && (
                      <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
                    )}
                  </div>
                  {isDefault && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Standard algorithms • Not endorsed
                    </p>
                  )}
                </div>
              </div>

              {/* Optional Zmanim Toggle */}
              {optionalCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showOptional ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setShowOptional(!showOptional)}
                      className="gap-1.5 shrink-0"
                    >
                      {showOptional ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{showOptional ? 'All' : 'Core'}</span>
                      <Badge variant="secondary" className="text-xs">
                        {showOptional ? filteredZmanim.length : coreCount}
                      </Badge>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{showOptional ? 'Show core times only' : 'Show all zmanim'}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Inline Map View */}
        {showMap && locality?.latitude && locality?.longitude && locality?.timezone && (
          <LocationMapView
            location={{
              type: 'locality',
              id: locality.id,
              name: locality.name,
              latitude: locality.latitude,
              longitude: locality.longitude,
              timezone: locality.timezone,
              elevation: locality.elevation,
            }}
            height={300}
          />
        )}

        {/* Zmanim by Category */}
        {categoryOrder.filter(cat => groupedZmanim[cat]?.length > 0).map((category) => {
          const categoryZmanim = groupedZmanim[category] || [];
          const config = categoryConfig[category] || categoryConfig.other;
          const categoryName = displayLanguage === 'hebrew' ? config.nameHe : config.nameEn;

          return (
            <Card key={category}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-${config.color}-500/10`}>
                    {config.icon}
                  </div>
                  <div>
                    <CardTitle className={displayLanguage === 'hebrew' ? 'font-hebrew' : ''} dir={displayLanguage === 'hebrew' ? 'rtl' : 'ltr'}>
                      {categoryName}
                    </CardTitle>
                    <CardDescription>
                      {categoryZmanim.length} {displayLanguage === 'hebrew' ? 'זמנים' : `zman${categoryZmanim.length !== 1 ? 'im' : ''}`}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y divide-border">
                  {categoryZmanim.map((zman) => (
                    <div
                      key={zman.key}
                      className="flex items-center justify-between py-3 hover:bg-accent/50 -mx-6 px-6 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedZman(zman);
                        setFormulaPanelOpen(true);
                      }}
                    >
                      <span className={`text-foreground font-medium ${displayLanguage === 'hebrew' ? 'font-hebrew' : ''}`} dir={displayLanguage === 'hebrew' ? 'rtl' : 'ltr'}>
                        {displayLanguage === 'hebrew' ? (zman.hebrew_name || zman.name) : zman.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-primary tabular-nums font-mono">
                          {formatTimeTo12Hour(zman.time_display || zman.time, false)}
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Info className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Show formula and calculation details</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {zmanim.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No zmanim available for this date.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            Timezone: {locality?.timezone || 'Unknown'}
          </p>
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
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setLocationSearchOpen(false);
              setSearchQuery('');
              setSearchResults([]);
            }}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md bg-card rounded-xl shadow-2xl overflow-hidden border border-border">
            {/* Search Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <Search className="w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search for a location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-foreground placeholder-muted-foreground outline-none text-lg"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setLocationSearchOpen(false);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="p-1 hover:bg-accent rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              {!isDefault && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  Note: This publisher may not cover all locations. If your location isn&apos;t covered, try Default Zmanim.
                </p>
              )}
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {searching && (
                <div className="p-4 text-center">
                  <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
                </div>
              )}

              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="p-4 text-center text-muted-foreground">
                  No locations found for &quot;{searchQuery}&quot;
                </div>
              )}

              {!searching && searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelectLocality(result.id)}
                  className="w-full px-4 py-3 text-left hover:bg-accent transition-colors flex items-center gap-3 border-b border-border last:border-0"
                >
                  <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">
                      {result.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {result.region_name ? `${result.region_name}, ` : ''}{result.country_name || result.country}
                    </p>
                  </div>
                </button>
              ))}

              {!searching && searchQuery.length < 2 && (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Type at least 2 characters to search
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
