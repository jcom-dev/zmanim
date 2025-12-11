'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { usePublisherContext } from '@/providers/PublisherContext';
import { useApi } from '@/lib/api-client';
import { LocationSearch } from '@/components/shared/LocationSearch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ZmanGrid } from '@/components/publisher/ZmanCard';
import { AlgorithmPreview } from '@/components/publisher/AlgorithmPreview';
import { WeekPreview } from '@/components/publisher/WeekPreview';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import {
  useZmanimList,
  useImportZmanim,
  PublisherZman,
} from '@/lib/hooks/useZmanimList';
import { MasterZmanPicker } from '@/components/publisher/MasterZmanPicker';
import { PublisherZmanPicker } from '@/components/publisher/PublisherZmanPicker';
import { RequestZmanModal } from '@/components/publisher/RequestZmanModal';
import { SaveVersionDialog } from '@/components/publisher/SaveVersionDialog';
import { VersionHistoryDialog } from '@/components/publisher/VersionHistoryDialog';
import { ImportSnapshotDialog } from '@/components/publisher/ImportSnapshotDialog';
import { DeletedZmanimDialog } from '@/components/publisher/DeletedZmanimDialog';
import { useExportSnapshot } from '@/lib/hooks/usePublisherSnapshots';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { TagFilterDropdown } from '@/components/shared/tags';
import { useTags } from '@/components/shared/tags/hooks/useTags';

interface OnboardingState {
  completed_at?: string | null;
  skipped?: boolean;
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MapPin, Search, Plus, Download, Upload, Filter, AlertTriangle, ChevronLeft, ChevronRight, Calendar, Loader2, CalendarDays, Flame, Tag, ChevronDown, Library, Copy, Link2, FileQuestion, History, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { InfoTooltip, StatusTooltip } from '@/components/shared/InfoTooltip';
import { ALGORITHM_TOOLTIPS, STATUS_TOOLTIPS } from '@/lib/tooltip-content';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';


// Hebrew month names mapping
const hebrewMonthNames: Record<string, string> = {
  'Nisan': 'ניסן',
  'Iyyar': 'אייר',
  'Sivan': 'סיון',
  'Tamuz': 'תמוז',
  'Av': 'אב',
  'Elul': 'אלול',
  'Tishrei': 'תשרי',
  'Cheshvan': 'חשון',
  'Kislev': 'כסלו',
  'Tevet': 'טבת',
  'Shvat': 'שבט',
  'Adar': 'אדר',
  'Adar I': 'אדר א׳',
  'Adar II': 'אדר ב׳',
};

// Convert day number to Hebrew numerals (gematria)
function toHebrewNumerals(num: number): string {
  if (num === undefined || num === null) return '';
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל'];
  if (num === 15) return 'ט״ו';
  if (num === 16) return 'ט״ז';
  if (num === 30) return 'ל׳';
  if (num < 10) return ones[num] + '׳';
  if (num < 30) {
    const t = Math.floor(num / 10);
    const o = num % 10;
    if (o === 0) return tens[t] + '׳';
    return tens[t] + '״' + ones[o];
  }
  return num.toString();
}

// Convert year to Hebrew numerals
function toHebrewYear(year: number): string {
  if (year === undefined || year === null) return '';
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const lastThree = year % 1000;
  const h = Math.floor(lastThree / 100);
  const t = Math.floor((lastThree % 100) / 10);
  const o = lastThree % 10;
  let result = hundreds[h] || '';
  if (t === 1 && o === 5) {
    result += 'ט״ו';
  } else if (t === 1 && o === 6) {
    result += 'ט״ז';
  } else {
    result += tens[t] || '';
    if (o > 0) {
      result += '״' + ones[o];
    } else if (result.length > 0) {
      result += '׳';
    }
  }
  return result;
}

interface HebrewDateInfo {
  day: number;
  month: string;
  month_num: number;
  year: number;
}

// English month names
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Hebrew months in order (for dropdown) with month numbers matching hdate library
// Month numbers: 1=Nisan, 2=Iyyar, ..., 7=Tishrei, 8=Cheshvan, 9=Kislev, etc.
const hebrewMonthsWithNum = [
  { num: 7, eng: 'Tishrei', heb: 'תשרי' },
  { num: 8, eng: 'Cheshvan', heb: 'חשון' },
  { num: 9, eng: 'Kislev', heb: 'כסלו' },
  { num: 10, eng: 'Tevet', heb: 'טבת' },
  { num: 11, eng: 'Shvat', heb: 'שבט' },
  { num: 12, eng: 'Adar', heb: 'אדר' },
  { num: 1, eng: 'Nisan', heb: 'ניסן' },
  { num: 2, eng: 'Iyyar', heb: 'אייר' },
  { num: 3, eng: 'Sivan', heb: 'סיון' },
  { num: 4, eng: 'Tamuz', heb: 'תמוז' },
  { num: 5, eng: 'Av', heb: 'אב' },
  { num: 6, eng: 'Elul', heb: 'אלול' },
];

// Generate years for dropdown
const currentYear = new Date().getFullYear();
const englishYears = Array.from({ length: 10 }, (_, i) => currentYear - 3 + i);

// Hebrew years (5780-5790 range approximately)
const currentHebrewYear = currentYear + 3760; // Approximate conversion
const hebrewYears = Array.from({ length: 10 }, (_, i) => currentHebrewYear - 3 + i);

// Get days in a month
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Hebrew days (1-30)
const hebrewDays = Array.from({ length: 30 }, (_, i) => i + 1);

// Placeholder location when no coverage is defined (used for type safety but won't be displayed)
const NO_COVERAGE_PLACEHOLDER: PreviewLocation = {
  latitude: 0,
  longitude: 0,
  timezone: 'UTC',
  displayName: 'No Coverage',
};

// localStorage key prefix for preview location (per-publisher)
const PREVIEW_LOCATION_KEY_PREFIX = 'zmanim-preview-location-';

interface PreviewLocation {
  latitude: number;
  longitude: number;
  timezone: string;
  displayName: string;
}

interface CoverageCity {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country: string;
  country_code?: string;
  region?: string;
}

interface PublisherCoverage {
  id: string;
  coverage_level_key?: 'continent' | 'country' | 'region' | 'district' | 'city';
  continent_code?: string;
  continent_name?: string;
  country_code?: string;
  country_name?: string;
  region_code?: string;
  region_name?: string;
  district_code?: string;
  district_name?: string;
  city_id?: string;
  city_name?: string;
  city_latitude?: number;
  city_longitude?: number;
  city_timezone?: string;
}

type FilterType = 'all' | 'published' | 'draft' | 'essential' | 'optional' | 'hidden';

export default function AlgorithmEditorPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { selectedPublisher } = usePublisherContext();
  const api = useApi();

  // Fetch zmanim using React Query
  const { data: zmanimData, isLoading, error: zmanimError, refetch } = useZmanimList();
  // Memoize to prevent unnecessary re-renders of child components
  const zmanim = useMemo(() => Array.isArray(zmanimData) ? zmanimData : [], [zmanimData]);
  const importZmanim = useImportZmanim();

  // Fetch all tags for the filter dropdown
  const { data: allTags = [] } = useTags();

  // Check onboarding status
  const { data: onboardingState, isLoading: onboardingLoading, refetch: refetchOnboarding } = useQuery({
    queryKey: ['onboarding-state', selectedPublisher?.id],
    queryFn: () => api.get<OnboardingState | null>('/publisher/onboarding'),
    enabled: !!selectedPublisher?.id,
    staleTime: 0, // Always refetch
  });
  const hasCompletedOnboarding = onboardingState?.completed_at != null || onboardingState?.skipped === true;

  // Version control / snapshots
  const exportSnapshot = useExportSnapshot();

  const [showMonthView, setShowMonthView] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showZmanPicker, setShowZmanPicker] = useState(false);
  const [showAddZmanModeDialog, setShowAddZmanModeDialog] = useState(false);
  const [showPublisherZmanPicker, setShowPublisherZmanPicker] = useState(false);
  const [publisherZmanMode, setPublisherZmanMode] = useState<'copy' | 'link'>('copy');
  const [showRequestZmanModal, setShowRequestZmanModal] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [forceShowWizard, setForceShowWizard] = useState(false);
  const [showSaveVersionDialog, setShowSaveVersionDialog] = useState(false);
  const [showVersionHistoryDialog, setShowVersionHistoryDialog] = useState(false);
  const [showImportSnapshotDialog, setShowImportSnapshotDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<'everyday' | 'events'>('everyday');
  const [tagFilter, setTagFilter] = useState<string>('all');

  // Location state - initialized with placeholder, will be updated when publisher coverage loads
  const [previewLocation, setPreviewLocation] = useState<PreviewLocation>(NO_COVERAGE_PLACEHOLDER);
  const [coverageCities, setCoverageCities] = useState<CoverageCity[]>([]);
  const [coverageCountryCodes, setCoverageCountryCodes] = useState<string[]>([]);

  // Preview date state (shared with AlgorithmPreview and edit page)
  const [previewDate, setPreviewDate] = useState(() => new Date());
  const [hebrewDate, setHebrewDate] = useState<HebrewDateInfo | null>(null);
  const [calendarMode, setCalendarMode] = useState<'gregorian' | 'hebrew'>('gregorian');

  // Display language for zman names: 'both' shows Hebrew • English, 'hebrew' shows only Hebrew, 'english' shows only English
  // This is linked to calendarMode: 'gregorian' = english names, 'hebrew' = hebrew names
  const displayLanguage = calendarMode === 'hebrew' ? 'hebrew' : 'english';

  // Format date as YYYY-MM-DD
  const dateStr = useMemo(() => previewDate.toISOString().split('T')[0], [previewDate]);

  // Save date to localStorage for sharing with edit page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('zmanim-preview-date', dateStr);
    }
  }, [dateStr]);

  // Fetch Hebrew date when date changes - using public API (no auth required)
  useEffect(() => {
    const fetchHebrewDate = async () => {
      try {
        // Use api.public for unauthenticated calendar endpoint
        const data = await api.public.get<HebrewDateInfo>(`/calendar/hebrew-date?date=${dateStr}`);
        setHebrewDate(data);
      } catch (err) {
        console.error('Failed to fetch Hebrew date:', err);
      }
    };
    fetchHebrewDate();
  }, [api, dateStr]);

  // Date navigation
  const goToPreviousDay = () => {
    const newDate = new Date(previewDate);
    newDate.setDate(newDate.getDate() - 1);
    setPreviewDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(previewDate);
    newDate.setDate(newDate.getDate() + 1);
    setPreviewDate(newDate);
  };

  const goToToday = () => {
    setPreviewDate(new Date());
  };

  const isToday = useMemo(() => {
    const today = new Date();
    return previewDate.toDateString() === today.toDateString();
  }, [previewDate]);

  // Convert Hebrew date to Gregorian and update previewDate
  const handleHebrewDateChange = useCallback(async (year: number, monthNum: number, day: number) => {
    try {
      const data = await api.public.get<{ date: string }>(`/calendar/gregorian-date?year=${year}&month=${monthNum}&day=${day}`);
      if (data.date) {
        setPreviewDate(new Date(data.date + 'T12:00:00')); // Add time to avoid timezone issues
      }
    } catch (err) {
      console.error('Failed to convert Hebrew date:', err);
    }
  }, [api]);

  // Save location to localStorage when it changes (per-publisher)
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedPublisher?.id) {
      localStorage.setItem(PREVIEW_LOCATION_KEY_PREFIX + selectedPublisher.id, JSON.stringify(previewLocation));
    }
  }, [previewLocation, selectedPublisher?.id]);

  // Load publisher coverage and restore/set preview location
  const loadCoverage = useCallback(async () => {
    if (!selectedPublisher) return;

    try {
      // Fetch coverage areas (not cities directly)
      const coverageData = await api.get<{ coverage: PublisherCoverage[], total: number }>('/publisher/coverage');
      const coverageAreas = coverageData.coverage || [];

      // Extract unique country codes from coverage for filtering city search
      const countryCodes = [...new Set(
        coverageAreas
          .map(c => c.country_code)
          .filter((code): code is string => !!code)
      )];
      setCoverageCountryCodes(countryCodes);

      // For each coverage area, we need to get a representative city for preview
      const cities: CoverageCity[] = [];

      for (const coverage of coverageAreas) {
        if (coverage.coverage_level_key === 'city' && coverage.city_latitude && coverage.city_longitude && coverage.city_timezone && coverage.city_name) {
          // For city-level coverage, use the data directly from the API response
          cities.push({
            id: coverage.city_id || '',
            name: coverage.city_name,
            latitude: coverage.city_latitude,
            longitude: coverage.city_longitude,
            timezone: coverage.city_timezone,
            country: coverage.country_name || '',
            country_code: coverage.country_code,
            region: coverage.region_name,
          });
        } else if (coverage.coverage_level_key === 'continent' && coverage.continent_code) {
          // For continent-level coverage, get a representative city from that continent
          try {
            const cityData = await api.public.get<{ cities: CoverageCity[] }>(`/cities?continent_code=${encodeURIComponent(coverage.continent_code)}&limit=5`);
            if (cityData.cities && cityData.cities.length > 0) {
              // Add a few major cities from the continent
              cities.push(...cityData.cities);
            }
          } catch {
            // Ignore errors fetching continent cities
          }
        } else if (coverage.coverage_level_key === 'country' && coverage.country_code) {
          // For country-level coverage, get the most populous city in that country
          try {
            const cityData = await api.public.get<{ cities: CoverageCity[] }>(`/cities?country_code=${encodeURIComponent(coverage.country_code)}&limit=1`);
            if (cityData.cities && cityData.cities.length > 0) {
              cities.push(cityData.cities[0]);
            }
          } catch {
            // Ignore errors fetching country cities
          }
        } else if (coverage.coverage_level_key === 'region' && coverage.region_name && coverage.country_code) {
          // For region-level coverage, get a city in that region
          try {
            const cityData = await api.public.get<{ cities: CoverageCity[] }>(`/cities?search=${encodeURIComponent(coverage.region_name)}&country_code=${encodeURIComponent(coverage.country_code)}&limit=1`);
            if (cityData.cities && cityData.cities.length > 0) {
              cities.push(cityData.cities[0]);
            }
          } catch {
            // Ignore errors fetching region cities
          }
        }
      }

      setCoverageCities(cities);

      // If no coverage, reset to placeholder
      if (cities.length === 0 && countryCodes.length === 0) {
        setPreviewLocation(NO_COVERAGE_PLACEHOLDER);
        return;
      }

      // Helper to check if a location is valid (matches a coverage city)
      const isLocationValid = (loc: PreviewLocation) => {
        return cities.some(city =>
          Math.abs(city.latitude - loc.latitude) < 0.01 &&
          Math.abs(city.longitude - loc.longitude) < 0.01
        );
      };

      // Try to restore saved location for this publisher
      const savedKey = PREVIEW_LOCATION_KEY_PREFIX + selectedPublisher.id;
      const saved = typeof window !== 'undefined' ? localStorage.getItem(savedKey) : null;

      if (saved && cities.length > 0) {
        try {
          const parsed = JSON.parse(saved) as PreviewLocation;
          // Only use saved location if it's still valid (in coverage)
          if (isLocationValid(parsed)) {
            setPreviewLocation(parsed);
            return;
          }
          // Saved location is no longer valid, fall through to use first coverage city
        } catch {
          // ignore parse errors, fall through to use coverage
        }
      }

      // No valid saved location - use first coverage city if available
      if (cities.length > 0) {
        const firstCity = cities[0];
        const newLocation = {
          latitude: firstCity.latitude,
          longitude: firstCity.longitude,
          timezone: firstCity.timezone,
          displayName: `${firstCity.name}${firstCity.region ? `, ${firstCity.region}` : ''}, ${firstCity.country}`,
        };
        setPreviewLocation(newLocation);
      } else {
        // No cities available, use placeholder
        setPreviewLocation(NO_COVERAGE_PLACEHOLDER);
      }
    } catch (err) {
      console.error('Failed to load coverage:', err);
    }
  }, [api, selectedPublisher]);

  useEffect(() => {
    if (selectedPublisher) {
      loadCoverage();
    }
  }, [selectedPublisher, loadCoverage]);

  const handleLocationSelect = useCallback((location: {
    type: string;
    id: string;
    name: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    display_name?: string;
  }) => {
    // Only handle city selections for preview
    if (location.type === 'city' && location.latitude && location.longitude && location.timezone) {
      const newLocation = {
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone,
        displayName: location.display_name || location.name,
      };
      setPreviewLocation(newLocation);
    }
  }, []);

  // Separate zmanim into everyday and event categories using API field
  const { everydayZmanim, eventZmanim } = useMemo(() => {
    const everyday: PublisherZman[] = [];
    const events: PublisherZman[] = [];

    zmanim.forEach(z => {
      if (z.is_event_zman) {
        events.push(z);
      } else {
        everyday.push(z);
      }
    });

    return { everydayZmanim: everyday, eventZmanim: events };
  }, [zmanim]);

  // Compute available tags from current view zmanim (tags that are actually used)
  const availableTagKeys = useMemo(() => {
    const currentViewZmanim = viewMode === 'everyday' ? everydayZmanim : eventZmanim;
    const tagKeySet = new Set<string>();
    currentViewZmanim.forEach(z => {
      // Check if zman has tags array (from API response)
      if (z.tags && Array.isArray(z.tags)) {
        z.tags.forEach((tag: { tag_key: string }) => {
          if (tag.tag_key) tagKeySet.add(tag.tag_key);
        });
      }
    });
    return tagKeySet;
  }, [everydayZmanim, eventZmanim, viewMode]);

  // Filter allTags to only show tags that are actually used in current view
  const availableTags = useMemo(() => {
    return allTags.filter(tag => availableTagKeys.has(tag.tag_key));
  }, [allTags, availableTagKeys]);

  // Reset tag filter when switching view modes (available tags may differ)
  useEffect(() => {
    setTagFilter('all');
  }, [viewMode]);

  // Filter zmanim based on viewMode and other filters
  const filteredZmanim = useMemo(() => {
    // Start with zmanim based on view mode
    let result = viewMode === 'everyday' ? [...everydayZmanim] : [...eventZmanim];

    // Apply search filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(z =>
        z.hebrew_name.toLowerCase().includes(query) ||
        z.english_name.toLowerCase().includes(query) ||
        z.zman_key.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    switch (filterType) {
      case 'published':
        result = result.filter(z => z.is_published);
        break;
      case 'draft':
        result = result.filter(z => !z.is_published);
        break;
      case 'essential':
        result = result.filter(z => z.category === 'essential');
        break;
      case 'optional':
        result = result.filter(z => z.category === 'optional');
        break;
      case 'hidden':
        result = result.filter(z => !z.is_visible);
        break;
    }

    // Apply tag filter - use actual zman tags from API
    if (tagFilter !== 'all') {
      result = result.filter(z => {
        if (!z.tags || !Array.isArray(z.tags)) return false;
        return z.tags.some((tag: { tag_key: string }) => tag.tag_key === tagFilter);
      });
    }

    // Results are already sorted by time_category from the API

    return result;
  }, [everydayZmanim, eventZmanim, viewMode, searchQuery, filterType, tagFilter]);

  // Navigate to editor
  const handleEditZman = (zmanKey: string) => {
    router.push(`/publisher/algorithm/edit/${zmanKey}`);
  };

  // Existing zman keys to filter out in picker
  const existingZmanKeys = useMemo(() => zmanim.map(z => z.zman_key), [zmanim]);

  // Import handlers
  const handleImportDefaults = async () => {
    try {
      await importZmanim.mutateAsync({ source: 'defaults' });
      setShowImportDialog(false);
    } catch (err) {
      console.error('Failed to import defaults:', err);
    }
  };

  // Calculate counts for current view
  const everydayCount = everydayZmanim.length;
  const eventCount = eventZmanim.length;
  const currentViewCount = viewMode === 'everyday' ? everydayCount : eventCount;
  const currentViewZmanim = viewMode === 'everyday' ? everydayZmanim : eventZmanim;
  const currentViewPublishedCount = currentViewZmanim.filter(z => z.is_published).length;
  const currentViewDraftCount = currentViewZmanim.filter(z => !z.is_published).length;
  const currentViewEssentialCount = currentViewZmanim.filter(z => z.category === 'essential').length;
  const currentViewOptionalCount = currentViewZmanim.filter(z => z.category === 'optional').length;
  const currentViewHiddenCount = currentViewZmanim.filter(z => !z.is_visible).length;

  // Auto-launch wizard for new publishers with 0 zmanim, or when "Restart Wizard" is clicked
  const shouldShowWizard = forceShowWizard || (zmanim.length === 0 && !hasCompletedOnboarding);

  if (!isLoading && !onboardingLoading && shouldShowWizard) {
    return (
      <div className="min-h-screen bg-background">
        <OnboardingWizard
          onComplete={() => {
            refetch();
            refetchOnboarding();
            setForceShowWizard(false);
          }}
          onSkip={() => {
            refetchOnboarding();
            setForceShowWizard(false);
            // Stay on page but show empty state with import option
            setShowImportDialog(true);
          }}
        />
      </div>
    );
  }

  if (isLoading || onboardingLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="text-foreground">Loading zmanim...</div>
          </div>
        </div>
      </div>
    );
  }

  // Reset onboarding to restart wizard
  const handleRestartWizard = async () => {
    setShowRestartConfirm(false);
    try {
      await api.delete('/publisher/onboarding');
      // Set forceShowWizard first to trigger immediate re-render
      setForceShowWizard(true);
      // Then refetch in background
      refetchOnboarding();
      refetch(); // Refetch zmanim list to show empty state
    } catch (err) {
      console.error('Failed to reset onboarding:', err);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-foreground">Algorithm Editor</h1>
              <Badge variant="outline" className="text-sm">
                {zmanim.length} Zmanim
              </Badge>
              <Badge variant="secondary" className="text-sm">
                {currentViewPublishedCount} Published
              </Badge>
            </div>
            <p className="text-muted-foreground">Configure your zmanim calculation formulas</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              onClick={() => setShowRestartConfirm(true)}
            >
              Restart Wizard
            </Button>

            {/* Version Control Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <History className="h-4 w-4 mr-2" />
                  Versions
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    exportSnapshot.mutate(undefined, {
                      onSuccess: () => {
                        // Toast handled in the hook
                      },
                      onError: () => {
                        // Toast handled in the hook
                      },
                    });
                  }}
                  disabled={exportSnapshot.isPending}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exportSnapshot.isPending ? 'Exporting...' : 'Export to JSON'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowImportSnapshotDialog(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import from JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowSaveVersionDialog(true)}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Version
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowVersionHistoryDialog(true)}>
                  <History className="h-4 w-4 mr-2" />
                  Version History
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              onClick={() => setShowMonthView(true)}
            >
              View Week
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/publisher/dashboard')}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Error message */}
        {zmanimError && (
          <div className="mb-6 bg-destructive/10 border border-destructive/50 rounded-md p-4">
            <p className="text-destructive text-sm">Failed to load zmanim. Please refresh the page.</p>
          </div>
        )}

        {/* Two-column layout: Controls on left, Live Preview on right */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Left Column: All controls and zmanim list */}
          <div className="space-y-6">
            {/* Location & Date Header - Single Line on Desktop, Stacked on Mobile */}
            <Card className="overflow-visible">
              <CardContent className="py-3 px-4 overflow-visible">
                {/* Desktop: Location left, date right | Mobile: Stacked */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 min-w-0">
                  {/* Row 1 on mobile: Location + Today | Desktop: Just location */}
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    {/* Location Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background hover:bg-muted/50 transition-colors text-left">
                          <MapPin className={`h-4 w-4 shrink-0 ${coverageCities.length === 0 && coverageCountryCodes.length === 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                          <span className={`text-sm font-medium truncate max-w-[140px] sm:max-w-[200px] ${coverageCities.length === 0 && coverageCountryCodes.length === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                            {coverageCities.length === 0 && coverageCountryCodes.length === 0 ? 'No Coverage' : previewLocation.displayName}
                          </span>
                          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                        </button>
                      </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-80 p-0">
                      {/* No coverage - show warning */}
                      {coverageCities.length === 0 && coverageCountryCodes.length === 0 ? (
                        <div className="p-4 text-center">
                          <MapPin className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                          <p className="text-sm font-medium text-foreground mb-1">No Coverage Areas</p>
                          <p className="text-xs text-muted-foreground mb-3">
                            Add coverage areas first to preview zmanim for specific cities.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push('/publisher/coverage')}
                            className="text-xs"
                          >
                            Add Coverage
                          </Button>
                        </div>
                      ) : (
                        <div className="p-3">
                          <LocationSearch
                            placeholder="Search for a city..."
                            onSelect={handleLocationSelect}
                            filterByCountryCodes={coverageCountryCodes}
                            mode="cities"
                            compact
                            autoFocus
                          />
                          {coverageCities.length > 0 && (
                            <>
                              <div className="mt-3 mb-1 px-1 text-xs text-muted-foreground font-medium">Coverage Cities</div>
                              <div className="space-y-0.5">
                                {coverageCities.slice(0, 5).map((city) => (
                                  <button
                                    key={city.id}
                                    onClick={() => handleLocationSelect({
                                      type: 'city',
                                      id: city.id,
                                      name: city.name,
                                      latitude: city.latitude,
                                      longitude: city.longitude,
                                      timezone: city.timezone,
                                      display_name: `${city.name}${city.region ? `, ${city.region}` : ''}, ${city.country}`,
                                    })}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent transition-colors text-sm"
                                  >
                                    <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="truncate">
                                      {city.name}
                                      {city.region && <span className="text-muted-foreground">, {city.region}</span>}
                                      <span className="text-muted-foreground">, {city.country}</span>
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </DropdownMenuContent>
                    </DropdownMenu>
                    {/* Today Button - Mobile only in this row */}
                    <Button
                      variant={isToday ? "default" : "outline-solid"}
                      size="sm"
                      onClick={goToToday}
                      className="sm:hidden shrink-0 h-7 px-2 text-xs"
                    >
                      Today
                    </Button>
                  </div>

                  {/* Date Controls - Row 2 on mobile */}
                  <div className="flex items-center justify-between sm:justify-end gap-1 w-full sm:w-auto min-w-0">
                    {/* Calendar Mode Toggle - EN/עב */}
                    <div className="flex rounded-md border border-input overflow-hidden shrink-0">
                      <button
                        onClick={() => setCalendarMode('gregorian')}
                        className={`px-1.5 py-1 text-xs font-medium transition-colors ${
                          calendarMode === 'gregorian'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        EN
                      </button>
                      <button
                        onClick={() => setCalendarMode('hebrew')}
                        className={`px-1.5 py-1 text-xs font-medium font-hebrew transition-colors ${
                          calendarMode === 'hebrew'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        עב
                      </button>
                    </div>

                    {/* Previous Day Arrow */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={goToPreviousDay}
                      className="h-5 w-5 sm:h-7 sm:w-7 shrink-0"
                    >
                      <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>

                    {/* Date Picker - Gregorian or Hebrew based on mode */}
                    {calendarMode === 'gregorian' ? (
                      <>
                        <Select
                          value={previewDate.getMonth().toString()}
                          onValueChange={(value) => {
                            const newDate = new Date(previewDate);
                            const newMonth = parseInt(value);
                            const maxDay = getDaysInMonth(newDate.getFullYear(), newMonth);
                            if (newDate.getDate() > maxDay) newDate.setDate(maxDay);
                            newDate.setMonth(newMonth);
                            setPreviewDate(newDate);
                          }}
                        >
                          <SelectTrigger className="h-6 sm:h-7 w-auto px-1 sm:px-2 text-xs font-medium border-input bg-background hover:bg-muted/50 gap-0.5 sm:gap-1 [&>svg]:h-2.5 [&>svg]:w-2.5 sm:[&>svg]:h-3 sm:[&>svg]:w-3">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {monthNames.map((month, index) => (
                              <SelectItem key={month} value={index.toString()} className="text-xs">{month.slice(0, 3)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={previewDate.getDate().toString()}
                          onValueChange={(value) => {
                            const newDate = new Date(previewDate);
                            newDate.setDate(parseInt(value));
                            setPreviewDate(newDate);
                          }}
                        >
                          <SelectTrigger className="h-6 sm:h-7 w-[42px] sm:w-[52px] px-1 sm:px-2 text-xs font-medium border-input bg-background hover:bg-muted/50 gap-0.5 sm:gap-1 [&>svg]:h-2.5 [&>svg]:w-2.5 sm:[&>svg]:h-3 sm:[&>svg]:w-3">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from(
                              { length: getDaysInMonth(previewDate.getFullYear(), previewDate.getMonth()) },
                              (_, i) => i + 1
                            ).map((day) => (
                              <SelectItem key={day} value={day.toString()} className="text-xs">{day}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={previewDate.getFullYear().toString()}
                          onValueChange={(value) => {
                            const newDate = new Date(previewDate);
                            newDate.setFullYear(parseInt(value));
                            const maxDay = getDaysInMonth(parseInt(value), newDate.getMonth());
                            if (newDate.getDate() > maxDay) newDate.setDate(maxDay);
                            setPreviewDate(newDate);
                          }}
                        >
                          <SelectTrigger className="h-6 sm:h-7 w-auto px-1 sm:px-2 text-xs font-medium border-input bg-background hover:bg-muted/50 gap-0.5 sm:gap-1 [&>svg]:h-2.5 [&>svg]:w-2.5 sm:[&>svg]:h-3 sm:[&>svg]:w-3">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {englishYears.map((year) => (
                              <SelectItem key={year} value={year.toString()} className="text-xs">{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    ) : hebrewDate && hebrewDate.day && hebrewDate.month_num && hebrewDate.year ? (
                      <>
                        <Select
                          value={hebrewDate.day.toString()}
                          onValueChange={(value) => handleHebrewDateChange(hebrewDate.year, hebrewDate.month_num, parseInt(value))}
                        >
                          <SelectTrigger className="h-6 sm:h-7 w-[42px] sm:w-[52px] px-1 sm:px-2 text-xs font-medium font-hebrew border-input bg-background hover:bg-muted/50 gap-0.5 sm:gap-1 [&>svg]:h-2.5 [&>svg]:w-2.5 sm:[&>svg]:h-3 sm:[&>svg]:w-3" dir="rtl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {hebrewDays.map((day) => (
                              <SelectItem key={day} value={day.toString()} className="text-xs font-hebrew">{toHebrewNumerals(day)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={hebrewDate.month_num.toString()}
                          onValueChange={(value) => handleHebrewDateChange(hebrewDate.year, parseInt(value), hebrewDate.day)}
                        >
                          <SelectTrigger className="h-6 sm:h-7 w-auto px-1 sm:px-2 text-xs font-medium font-hebrew border-input bg-background hover:bg-muted/50 gap-0.5 sm:gap-1 [&>svg]:h-2.5 [&>svg]:w-2.5 sm:[&>svg]:h-3 sm:[&>svg]:w-3" dir="rtl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {hebrewMonthsWithNum.map((m) => (
                              <SelectItem key={m.num} value={m.num.toString()} className="text-xs font-hebrew">{m.heb}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={hebrewDate.year.toString()}
                          onValueChange={(value) => handleHebrewDateChange(parseInt(value), hebrewDate.month_num, hebrewDate.day)}
                        >
                          <SelectTrigger className="h-6 sm:h-7 w-auto px-1 sm:px-2 text-xs font-medium font-hebrew border-input bg-background hover:bg-muted/50 gap-0.5 sm:gap-1 [&>svg]:h-2.5 [&>svg]:w-2.5 sm:[&>svg]:h-3 sm:[&>svg]:w-3" dir="rtl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {hebrewYears.map((year) => (
                              <SelectItem key={year} value={year.toString()} className="text-xs font-hebrew">{toHebrewYear(year)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Loading...</span>
                    )}

                    {/* Next Day Arrow */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={goToNextDay}
                      className="h-5 w-5 sm:h-7 sm:w-7 shrink-0"
                    >
                      <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>

                    {/* Today Button - Desktop only (mobile version is in row 1) */}
                    <Button
                      variant={isToday ? "default" : "outline-solid"}
                      size="sm"
                      onClick={goToToday}
                      className="hidden sm:inline-flex shrink-0 h-7 px-2 text-xs"
                    >
                      Today
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Everyday / Events Tabs */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'everyday' | 'events')}>
              <TabsList className="grid w-full grid-cols-2">
                <StatusTooltip status="everyday" tooltip={ALGORITHM_TOOLTIPS.everyday_tab}>
                  <TabsTrigger value="everyday" className="gap-1 sm:gap-2 w-full">
                    <CalendarDays className="h-4 w-4 hidden sm:block" />
                    <span className="text-xs sm:text-sm">Everyday</span>
                    <Badge variant="secondary" className="ml-0.5 sm:ml-1 text-xs">
                      {everydayCount}
                    </Badge>
                  </TabsTrigger>
                </StatusTooltip>
                <StatusTooltip status="events" tooltip={ALGORITHM_TOOLTIPS.events_tab}>
                  <TabsTrigger value="events" className="gap-1 sm:gap-2 w-full">
                    <Flame className="h-4 w-4 hidden sm:block" />
                    <span className="text-xs sm:text-sm">Events</span>
                    <Badge variant="secondary" className="ml-0.5 sm:ml-1 text-xs">
                      {eventCount}
                    </Badge>
                  </TabsTrigger>
                </StatusTooltip>
              </TabsList>
            </Tabs>

            {/* Search, Filter, and Actions Bar */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 w-full">
                  <div className="relative w-full sm:flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search zmanim by name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-full"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto sm:justify-start">
                    {/* Tag Filter Dropdown - show all tags or filter to available */}
                    {allTags.length > 0 && (
                      <TagFilterDropdown
                        value={tagFilter}
                        onChange={setTagFilter}
                        tags={availableTags.length > 0 ? availableTags : allTags}
                        placeholder="All Tags"
                      />
                    )}

                    <DeletedZmanimDialog />

                    <Button
                      variant="default"
                      onClick={() => setShowAddZmanModeDialog(true)}
                      className="flex items-center gap-2 whitespace-nowrap"
                    >
                      <Plus className="h-4 w-4" />
                      Add Zman
                    </Button>
                  </div>
                </div>

                {/* Filter Tabs */}
                <Tabs value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
                  <div className="overflow-x-auto -mx-4 px-4 sm:overflow-visible sm:mx-0 sm:px-0 scrollbar-hide">
                  <TabsList className="w-max sm:w-full h-auto justify-start gap-1">
                    <TabsTrigger value="all">
                      All ({currentViewCount})
                    </TabsTrigger>
                    <StatusTooltip status="published" tooltip={STATUS_TOOLTIPS.published}>
                      <TabsTrigger value="published">
                        Published ({currentViewPublishedCount})
                      </TabsTrigger>
                    </StatusTooltip>
                    <StatusTooltip status="draft" tooltip={STATUS_TOOLTIPS.draft}>
                      <TabsTrigger value="draft">
                        Draft ({currentViewDraftCount})
                      </TabsTrigger>
                    </StatusTooltip>
                    <StatusTooltip status="core" tooltip={ALGORITHM_TOOLTIPS.core_zman}>
                      <TabsTrigger value="essential">
                        Core ({currentViewEssentialCount})
                      </TabsTrigger>
                    </StatusTooltip>
                    <StatusTooltip status="optional" tooltip={ALGORITHM_TOOLTIPS.optional_zman}>
                      <TabsTrigger value="optional">
                        Optional ({currentViewOptionalCount})
                      </TabsTrigger>
                    </StatusTooltip>
                    {currentViewHiddenCount > 0 && (
                      <TabsTrigger value="hidden" className="text-muted-foreground">
                        Hidden ({currentViewHiddenCount})
                      </TabsTrigger>
                    )}
                  </TabsList>
                  </div>
                </Tabs>
              </CardContent>
            </Card>

            {/* Zmanim List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {viewMode === 'everyday' ? 'Everyday Zmanim' : 'Event Zmanim'}
                    </CardTitle>
                    <CardDescription>
                      {viewMode === 'everyday'
                        ? `${filteredZmanim.length} daily solar calculation times ${filterType !== 'all' || tagFilter !== 'all' ? '(filtered)' : ''}`
                        : `${filteredZmanim.length} Shabbos, holiday, and fast day times ${filterType !== 'all' || tagFilter !== 'all' ? '(filtered)' : ''}`}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ZmanGrid
                  zmanim={filteredZmanim}
                  category="optional" // This is just for styling, actual category comes from zman
                  onEdit={handleEditZman}
                  displayLanguage={displayLanguage}
                  allZmanim={zmanim}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Live Preview (sticky) */}
          <div className="hidden lg:block">
            <div className="sticky top-6">
              <AlgorithmPreview
                location={previewLocation}
                selectedDate={previewDate}
                displayLanguage={displayLanguage}
                hasCoverage={coverageCities.length > 0 || coverageCountryCodes.length > 0}
              />
            </div>
          </div>
        </div>

        {/* Mobile Live Preview (shown below content on small screens) */}
        <div className="lg:hidden mt-6">
          <AlgorithmPreview
            location={previewLocation}
            selectedDate={previewDate}
            displayLanguage={displayLanguage}
            hasCoverage={coverageCities.length > 0 || coverageCountryCodes.length > 0}
          />
        </div>

        {/* Week View Dialog - Shows all zmanim (event zmanim filtered by day) */}
        <Dialog open={showMonthView} onOpenChange={setShowMonthView}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Week Preview</DialogTitle>
              <DialogDescription>
                Preview calculated zmanim times for the upcoming week
              </DialogDescription>
            </DialogHeader>
            <WeekPreview location={previewLocation} />
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Zmanim</DialogTitle>
              <DialogDescription>
                Choose how to add zmanim to your algorithm
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={handleImportDefaults}
                disabled={importZmanim.isPending}
              >
                <div className="text-left">
                  <div className="font-medium">Import Default Templates</div>
                  <div className="text-sm text-muted-foreground">
                    Add all 18 standard zmanim based on common halachic methods
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => {
                  setShowImportDialog(false);
                  // TODO: Open browse publishers dialog
                }}
              >
                <div className="text-left">
                  <div className="font-medium">Copy from Another Publisher</div>
                  <div className="text-sm text-muted-foreground">
                    Browse and copy algorithms from other publishers
                  </div>
                </div>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Zman Mode Selection Dialog */}
        <Dialog open={showAddZmanModeDialog} onOpenChange={setShowAddZmanModeDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>How do you want to add a zman?</DialogTitle>
              <DialogDescription>
                Choose a source for your new zman calculation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <button
                className="w-full p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left group"
                onClick={() => {
                  setShowAddZmanModeDialog(false);
                  setShowZmanPicker(true);
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <Library className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">From Registry</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Browse the master zmanim catalog with standard definitions
                    </p>
                  </div>
                </div>
              </button>

              <button
                className="w-full p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left group"
                onClick={() => {
                  setShowAddZmanModeDialog(false);
                  setPublisherZmanMode('copy');
                  setShowPublisherZmanPicker(true);
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors">
                    <Copy className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Copy from Publisher</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Get a snapshot copy of another publisher&apos;s formula
                    </p>
                  </div>
                </div>
              </button>

              <button
                className="w-full p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left group"
                onClick={() => {
                  setShowAddZmanModeDialog(false);
                  setPublisherZmanMode('link');
                  setShowPublisherZmanPicker(true);
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                    <Link2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Link to Publisher</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Always use their latest formula (verified publishers only)
                    </p>
                  </div>
                </div>
              </button>

              {/* Request New Zman - opens RequestZmanModal */}
              <button
                className="w-full p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left group"
                onClick={() => {
                  setShowAddZmanModeDialog(false);
                  setShowRequestZmanModal(true);
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                    <FileQuestion className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Request New Zman</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Can&apos;t find what you need? Request a new zman to be added
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Master Zman Picker */}
        <MasterZmanPicker
          open={showZmanPicker}
          onOpenChange={setShowZmanPicker}
          existingZmanKeys={existingZmanKeys}
          onSuccess={() => refetch()}
        />

        {/* Publisher Zman Picker (Copy or Link) */}
        <PublisherZmanPicker
          open={showPublisherZmanPicker}
          onOpenChange={setShowPublisherZmanPicker}
          mode={publisherZmanMode}
          existingZmanKeys={existingZmanKeys}
          onSuccess={() => refetch()}
        />

        {/* Request New Zman Modal - outside parent dialog to avoid unmount */}
        <RequestZmanModal
          open={showRequestZmanModal}
          onOpenChange={setShowRequestZmanModal}
          onSuccess={() => refetch()}
        />

        {/* Version Control Dialogs */}
        <SaveVersionDialog
          open={showSaveVersionDialog}
          onOpenChange={setShowSaveVersionDialog}
        />
        <VersionHistoryDialog
          open={showVersionHistoryDialog}
          onOpenChange={setShowVersionHistoryDialog}
          onRestore={() => refetch()}
        />
        <ImportSnapshotDialog
          open={showImportSnapshotDialog}
          onOpenChange={setShowImportSnapshotDialog}
          onSuccess={() => refetch()}
        />

        {/* Restart Wizard Confirmation Dialog */}
        <AlertDialog open={showRestartConfirm} onOpenChange={setShowRestartConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Restart Setup Wizard?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  This will <strong>permanently delete</strong> all your current zmanim and coverage areas.
                  You will start fresh with the setup wizard.
                </p>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-amber-800 dark:text-amber-200 text-sm">
                  <strong>Warning:</strong> This action cannot be undone. All zmanim and coverage areas will be permanently deleted.
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRestartWizard}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete & Restart
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
