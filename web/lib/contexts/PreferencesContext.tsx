/**
 * @file PreferencesContext.tsx
 * @purpose Unified user preferences with cookie persistence and SSR support
 * @pattern react-context
 * @dependencies js-cookie, next-themes
 * @frequency critical - manages locality, theme, and other user preferences
 * @compliance Story 8-29 - Unified User Preferences with Cookie Persistence
 */

'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import Cookies from 'js-cookie';

// Cookie names and TTLs (in days)
const COOKIE_LOCALITY_ID = 'zmanim_locality_id';
const COOKIE_THEME = 'zmanim_theme';
const COOKIE_SHOW_SECONDS = 'zmanim_show_seconds';
const COOKIE_ROUNDING_MODE = 'zmanim_rounding_mode';
const COOKIE_LANGUAGE = 'zmanim_language';
const COOKIE_FILTERS = 'zmanim_filters';
const COOKIE_PUBLISHER_ID = 'zmanim_publisher_id';
const COOKIE_REGISTRY_PREVIEW = 'zmanim_registry_preview'; // Registry browser preview locality & date
const TTL_LOCALITY = 90; // 90 days
const TTL_THEME = 365; // 1 year
const TTL_DISPLAY_PREFS = 365; // 1 year for display preferences
const TTL_LANGUAGE = 365; // 1 year
const TTL_FILTERS = 90; // 90 days
const TTL_PUBLISHER = 90; // 90 days
const TTL_REGISTRY_PREVIEW = 30; // 30 days

export type RoundingMode = 'floor' | 'math' | 'ceil';
export type Language = 'en' | 'he';

export interface FilterPreferences {
  /** Which time categories to show (empty = all) */
  categories: string[];

  /** Tag filters */
  tags: string[];

  /** Show optional zmanim */
  showOptional: boolean;

  /** Publisher-only: show disabled zmanim */
  showDisabled: boolean;
}

export interface RegistryPreviewPreferences {
  localityId: number | null;
  localityName: string | null;
  date: string | null; // ISO date string YYYY-MM-DD, null means today
}

export const DEFAULT_LANGUAGE: Language = 'en';
export const DEFAULT_REGISTRY_PREVIEW: RegistryPreviewPreferences = {
  localityId: null,
  localityName: null,
  date: null,
};
export const DEFAULT_FILTERS: FilterPreferences = {
  categories: ['dawn', 'morning', 'afternoon', 'evening', 'night'], // All categories
  tags: [],
  showOptional: true,
  showDisabled: false,
};

export interface UserPreferences {
  // Location preferences
  localityId: number | null;
  continentId: number | null; // For breadcrumb restoration
  countryId: number | null;
  regionId: number | null;

  // Theme
  theme: 'light' | 'dark' | 'system';

  // Display preferences (Story 8-34)
  showSeconds: boolean | null;
  roundingMode: RoundingMode;

  // Language preference (Story 8-36)
  language: Language;

  // Filter preferences (Story 8-36)
  filters: FilterPreferences;

  // Publisher preference - selected publisher ID for multi-publisher users
  publisherId: string | null;

  // Registry browser preview preferences
  registryPreview: RegistryPreviewPreferences;
}

export interface LocationHierarchy {
  continentId?: number;
  countryId?: number;
  regionId?: number;
}

// Compact JSON serialization for filters
function serializeFilters(filters: FilterPreferences): string {
  return JSON.stringify({
    c: filters.categories,
    t: filters.tags,
    o: filters.showOptional ? 1 : 0,
    d: filters.showDisabled ? 1 : 0,
  });
}

function deserializeFilters(json: string | undefined): FilterPreferences {
  if (!json) return DEFAULT_FILTERS;

  try {
    const data = JSON.parse(json);
    return {
      categories: Array.isArray(data.c) ? data.c : DEFAULT_FILTERS.categories,
      tags: Array.isArray(data.t) ? data.t : [],
      showOptional: data.o === 1,
      showDisabled: data.d === 1,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

// Compact JSON serialization for registry preview
function serializeRegistryPreview(preview: RegistryPreviewPreferences): string {
  return JSON.stringify({
    l: preview.localityId,
    n: preview.localityName,
    d: preview.date,
  });
}

function deserializeRegistryPreview(json: string | undefined): RegistryPreviewPreferences {
  if (!json) return DEFAULT_REGISTRY_PREVIEW;

  try {
    const data = JSON.parse(json);
    return {
      localityId: typeof data.l === 'number' ? data.l : null,
      localityName: typeof data.n === 'string' ? data.n : null,
      date: typeof data.d === 'string' ? data.d : null,
    };
  } catch {
    return DEFAULT_REGISTRY_PREVIEW;
  }
}

interface PreferencesContextValue {
  preferences: UserPreferences;
  setLocality: (localityId: number, hierarchy?: LocationHierarchy) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  clearLocality: () => void;
  setShowSeconds: (showSeconds: boolean) => void;
  setRoundingMode: (mode: RoundingMode) => void;
  setLanguage: (language: Language) => void;
  setFilters: (filters: FilterPreferences) => void;
  updateFilter: <K extends keyof FilterPreferences>(key: K, value: FilterPreferences[K]) => void;
  setPublisherId: (publisherId: string) => void;
  clearPublisherId: () => void;
  setRegistryPreview: (preview: RegistryPreviewPreferences) => void;
  resetToDefaults: () => void;
  isLoading: boolean;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

interface PreferencesProviderProps {
  children: ReactNode;
  // SSR initial values from cookies
  initialLocalityId?: number | null;
  initialTheme?: 'light' | 'dark' | 'system';
  initialShowSeconds?: boolean | null;
  initialRoundingMode?: RoundingMode;
  initialLanguage?: Language;
  initialFilters?: FilterPreferences;
  initialPublisherId?: string | null;
  initialRegistryPreview?: RegistryPreviewPreferences;
}

export function PreferencesProvider({
  children,
  initialLocalityId = null,
  initialTheme = 'system',
  initialShowSeconds = null,
  initialRoundingMode = 'math',
  initialLanguage = DEFAULT_LANGUAGE,
  initialFilters = DEFAULT_FILTERS,
  initialPublisherId = null,
  initialRegistryPreview = DEFAULT_REGISTRY_PREVIEW,
}: PreferencesProviderProps) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    localityId: initialLocalityId,
    continentId: null,
    countryId: null,
    regionId: null,
    theme: initialTheme,
    showSeconds: initialShowSeconds,
    roundingMode: initialRoundingMode,
    language: initialLanguage,
    filters: initialFilters,
    publisherId: initialPublisherId,
    registryPreview: initialRegistryPreview,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Initialize preferences from cookies on mount (client-side hydration)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Migration: Move localStorage values to cookies (one-time)
    const migrateLocalStorageToCookies = () => {
      const legacyKeys = [
        'zmanim_selected_city',
        'zmanim_selected_continent',
        'zmanim_selected_country',
        'zmanim_selected_region',
        'selectedPublisherId',
        'zmanim_selected_publisher',
      ];

      // Migrate locality selection if exists (from legacy localStorage)
      try {
        const legacyLocality = localStorage.getItem('zmanim_selected_city');
        if (legacyLocality && !Cookies.get(COOKIE_LOCALITY_ID)) {
          const locality = JSON.parse(legacyLocality);
          if (locality && locality.id) {
            Cookies.set(COOKIE_LOCALITY_ID, String(locality.id), {
              expires: TTL_LOCALITY,
              sameSite: 'Lax',
              secure: process.env.NODE_ENV === 'production',
            });
          }
        }
      } catch (err) {
        console.warn('Failed to migrate locality from localStorage:', err);
      }

      // Clean up legacy localStorage keys
      legacyKeys.forEach((key) => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
        }
      });
    };

    // Run migration first
    migrateLocalStorageToCookies();

    // Read from cookies (if not already set via SSR)
    const localityIdCookie = Cookies.get(COOKIE_LOCALITY_ID);
    const themeCookie = Cookies.get(COOKIE_THEME) as 'light' | 'dark' | 'system' | undefined;
    const showSecondsCookie = Cookies.get(COOKIE_SHOW_SECONDS);
    const roundingModeCookie = Cookies.get(COOKIE_ROUNDING_MODE) as RoundingMode | undefined;
    const languageCookie = Cookies.get(COOKIE_LANGUAGE) as Language | undefined;
    const filtersCookie = Cookies.get(COOKIE_FILTERS);
    const publisherIdCookie = Cookies.get(COOKIE_PUBLISHER_ID);
    const registryPreviewCookie = Cookies.get(COOKIE_REGISTRY_PREVIEW);

    setPreferences((prev) => ({
      ...prev,
      localityId: localityIdCookie ? parseInt(localityIdCookie, 10) : prev.localityId,
      theme: themeCookie || prev.theme,
      showSeconds: showSecondsCookie !== undefined ? showSecondsCookie === 'true' : prev.showSeconds,
      roundingMode: roundingModeCookie || prev.roundingMode,
      language: languageCookie || prev.language,
      filters: filtersCookie ? deserializeFilters(filtersCookie) : prev.filters,
      publisherId: publisherIdCookie || prev.publisherId,
      registryPreview: registryPreviewCookie ? deserializeRegistryPreview(registryPreviewCookie) : prev.registryPreview,
    }));

    setIsLoading(false);
  }, []);

  // Cross-tab sync - listen for cookie changes from other tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Custom event for cookie changes from other tabs
    const handleCookieChange = (e: CustomEvent) => {
      const { key, value } = e.detail;
      if (key === COOKIE_LOCALITY_ID && value) {
        const localityId = parseInt(value, 10);
        if (!isNaN(localityId)) {
          setPreferences((prev) => ({
            ...prev,
            localityId,
          }));
        }
      } else if (key === COOKIE_THEME && value) {
        setPreferences((prev) => ({
          ...prev,
          theme: value as 'light' | 'dark' | 'system',
        }));
      } else if (key === COOKIE_SHOW_SECONDS) {
        setPreferences((prev) => ({
          ...prev,
          showSeconds: value === 'true',
        }));
      } else if (key === COOKIE_ROUNDING_MODE && value) {
        setPreferences((prev) => ({
          ...prev,
          roundingMode: value as RoundingMode,
        }));
      } else if (key === COOKIE_LANGUAGE && value) {
        setPreferences((prev) => ({
          ...prev,
          language: value as Language,
        }));
      } else if (key === COOKIE_FILTERS && value) {
        setPreferences((prev) => ({
          ...prev,
          filters: deserializeFilters(value),
        }));
      } else if (key === COOKIE_PUBLISHER_ID) {
        setPreferences((prev) => ({
          ...prev,
          publisherId: value || null,
        }));
      } else if (key === COOKIE_REGISTRY_PREVIEW && value) {
        setPreferences((prev) => ({
          ...prev,
          registryPreview: deserializeRegistryPreview(value),
        }));
      }
    };

    window.addEventListener('preferences-cookie-change' as any, handleCookieChange as any);

    return () => {
      window.removeEventListener('preferences-cookie-change' as any, handleCookieChange as any);
    };
  }, []);

  // Set locality preference
  const setLocality = useCallback((localityId: number, hierarchy?: LocationHierarchy) => {
    // Update cookie
    Cookies.set(COOKIE_LOCALITY_ID, String(localityId), {
      expires: TTL_LOCALITY,
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    });

    // Update state
    setPreferences((prev) => ({
      ...prev,
      localityId,
      continentId: hierarchy?.continentId ?? prev.continentId,
      countryId: hierarchy?.countryId ?? prev.countryId,
      regionId: hierarchy?.regionId ?? prev.regionId,
    }));

    // Broadcast to other tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('preferences-cookie-change', {
          detail: { key: COOKIE_LOCALITY_ID, value: String(localityId) },
        })
      );
    }
  }, []);

  // Set theme preference
  const setTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    // Update cookie
    Cookies.set(COOKIE_THEME, theme, {
      expires: TTL_THEME,
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    });

    // Update state
    setPreferences((prev) => ({
      ...prev,
      theme,
    }));

    // Broadcast to other tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('preferences-cookie-change', {
          detail: { key: COOKIE_THEME, value: theme },
        })
      );
    }
  }, []);

  // Clear locality preference
  const clearLocality = useCallback(() => {
    // Remove cookie
    Cookies.remove(COOKIE_LOCALITY_ID);

    // Clear state
    setPreferences((prev) => ({
      ...prev,
      localityId: null,
      continentId: null,
      countryId: null,
      regionId: null,
    }));

    // Broadcast to other tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('preferences-cookie-change', {
          detail: { key: COOKIE_LOCALITY_ID, value: null },
        })
      );
    }
  }, []);

  // Set showSeconds preference
  const setShowSeconds = useCallback((showSeconds: boolean) => {
    // Update cookie
    Cookies.set(COOKIE_SHOW_SECONDS, String(showSeconds), {
      expires: TTL_DISPLAY_PREFS,
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    });

    // Update state
    setPreferences((prev) => ({
      ...prev,
      showSeconds,
    }));

    // Broadcast to other tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('preferences-cookie-change', {
          detail: { key: COOKIE_SHOW_SECONDS, value: String(showSeconds) },
        })
      );
    }
  }, []);

  // Set roundingMode preference
  const setRoundingMode = useCallback((mode: RoundingMode) => {
    // Update cookie
    Cookies.set(COOKIE_ROUNDING_MODE, mode, {
      expires: TTL_DISPLAY_PREFS,
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    });

    // Update state
    setPreferences((prev) => ({
      ...prev,
      roundingMode: mode,
    }));

    // Broadcast to other tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('preferences-cookie-change', {
          detail: { key: COOKIE_ROUNDING_MODE, value: mode },
        })
      );
    }
  }, []);

  // Set language preference
  const setLanguage = useCallback((language: Language) => {
    // Update cookie
    Cookies.set(COOKIE_LANGUAGE, language, {
      expires: TTL_LANGUAGE,
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    });

    // Update state
    setPreferences((prev) => ({
      ...prev,
      language,
    }));

    // Broadcast to other tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('preferences-cookie-change', {
          detail: { key: COOKIE_LANGUAGE, value: language },
        })
      );
    }
  }, []);

  // Set filters preference
  const setFilters = useCallback((filters: FilterPreferences) => {
    // Update cookie
    Cookies.set(COOKIE_FILTERS, serializeFilters(filters), {
      expires: TTL_FILTERS,
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    });

    // Update state
    setPreferences((prev) => ({
      ...prev,
      filters,
    }));

    // Broadcast to other tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('preferences-cookie-change', {
          detail: { key: COOKIE_FILTERS, value: serializeFilters(filters) },
        })
      );
    }
  }, []);

  // Update a single filter property
  const updateFilter = useCallback(<K extends keyof FilterPreferences>(
    key: K,
    value: FilterPreferences[K]
  ) => {
    setPreferences((prev) => {
      const newFilters = { ...prev.filters, [key]: value };

      // Update cookie
      Cookies.set(COOKIE_FILTERS, serializeFilters(newFilters), {
        expires: TTL_FILTERS,
        sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production',
      });

      // Broadcast to other tabs
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('preferences-cookie-change', {
            detail: { key: COOKIE_FILTERS, value: serializeFilters(newFilters) },
          })
        );
      }

      return {
        ...prev,
        filters: newFilters,
      };
    });
  }, []);

  // Set publisher preference
  const setPublisherId = useCallback((publisherId: string) => {
    // Update cookie
    Cookies.set(COOKIE_PUBLISHER_ID, publisherId, {
      expires: TTL_PUBLISHER,
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    });

    // Update state
    setPreferences((prev) => ({
      ...prev,
      publisherId,
    }));

    // Broadcast to other tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('preferences-cookie-change', {
          detail: { key: COOKIE_PUBLISHER_ID, value: publisherId },
        })
      );
    }
  }, []);

  // Clear publisher preference
  const clearPublisherId = useCallback(() => {
    // Remove cookie
    Cookies.remove(COOKIE_PUBLISHER_ID);

    // Clear state
    setPreferences((prev) => ({
      ...prev,
      publisherId: null,
    }));

    // Broadcast to other tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('preferences-cookie-change', {
          detail: { key: COOKIE_PUBLISHER_ID, value: null },
        })
      );
    }
  }, []);

  // Set registry preview preference
  const setRegistryPreview = useCallback((preview: RegistryPreviewPreferences) => {
    // Update cookie
    Cookies.set(COOKIE_REGISTRY_PREVIEW, serializeRegistryPreview(preview), {
      expires: TTL_REGISTRY_PREVIEW,
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    });

    // Update state
    setPreferences((prev) => ({
      ...prev,
      registryPreview: preview,
    }));

    // Broadcast to other tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('preferences-cookie-change', {
          detail: { key: COOKIE_REGISTRY_PREVIEW, value: serializeRegistryPreview(preview) },
        })
      );
    }
  }, []);

  // Reset all preferences to defaults
  const resetToDefaults = useCallback(() => {
    // Remove display preference cookies
    Cookies.remove(COOKIE_SHOW_SECONDS);
    Cookies.remove(COOKIE_ROUNDING_MODE);
    Cookies.remove(COOKIE_LANGUAGE);
    Cookies.remove(COOKIE_FILTERS);

    // Reset to defaults
    setPreferences((prev) => ({
      ...prev,
      showSeconds: null,
      roundingMode: 'math',
      language: DEFAULT_LANGUAGE,
      filters: DEFAULT_FILTERS,
    }));

    // Broadcast
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('preferences-cookie-change', {
          detail: { reset: true },
        })
      );
    }
  }, []);

  const contextValue: PreferencesContextValue = {
    preferences,
    setLocality,
    setTheme,
    clearLocality,
    setShowSeconds,
    setRoundingMode,
    setLanguage,
    setFilters,
    updateFilter,
    setPublisherId,
    clearPublisherId,
    setRegistryPreview,
    resetToDefaults,
    isLoading,
  };

  return (
    <PreferencesContext.Provider value={contextValue}>
      {children}
    </PreferencesContext.Provider>
  );
}

/**
 * Hook to access user preferences
 */
export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
}

/**
 * Utility: Read cookie value server-side (for SSR)
 */
export function getCookieValue(cookieString: string | undefined, name: string): string | undefined {
  if (!cookieString) return undefined;

  const cookies = cookieString.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  return cookies[name];
}
