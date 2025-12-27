/**
 * Algorithm Page Data Hook
 *
 * Unified data fetching for the algorithm page that:
 * 1. Fetches zmanim with locality_id and date
 * 2. Provides date selection state management
 * 3. Supports selecting different preview localities
 * 4. Returns stable references to avoid unnecessary re-renders
 *
 * Note: Only locality_id is needed - backend resolves coordinates/timezone
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePublisherContext } from '@/providers/PublisherContext';
import { useApi } from '@/lib/api-client';
import type { PublisherZman } from './useZmanimList';
import Cookies from 'js-cookie';

// =============================================================================
// Types
// =============================================================================

/**
 * Day context information (from backend)
 */
export interface DayContext {
  date: string; // YYYY-MM-DD
  day_of_week: number; // 0=Sunday, 6=Saturday
  day_name: string; // "Sunday", "Friday", etc.
  hebrew_date: string; // "23 Kislev 5785"
  hebrew_date_formatted: string; // Hebrew letters format
  holidays: HolidayInfo[];
  active_event_codes: string[]; // Event codes active today (e.g., "erev_shabbos", "shabbos", "yom_tov")
  special_contexts: string[]; // Special contexts (e.g., "shabbos_to_yomtov")
}

export interface HolidayInfo {
  name: string;
  name_hebrew: string;
  category: string;
  yomtov: boolean;
}

/**
 * Zmanim with calculated time (from backend)
 */
interface PublisherZmanWithTime extends PublisherZman {
  time?: string; // Calculated time exact (HH:mm:ss format with seconds)
  time_rounded?: string; // Calculated time rounded per rounding_mode (HH:mm:ss format with :00)
  time_display?: string; // Calculated time rounded for display (HH:mm format without seconds)
  timestamp?: number; // Unix timestamp
  is_active_today: boolean; // Whether this zman is active for the current day context (e.g., candle lighting only on Fridays)
}

/**
 * Filtered zmanim response (from backend)
 */
interface FilteredZmanimResponse {
  day_context: DayContext;
  zmanim: PublisherZmanWithTime[];
}

/**
 * Hook return type
 */
export interface AlgorithmPageData {
  // Locality
  localityId: number | null;
  localityDisplayName: string | null;

  // From zmanim fetch
  dayContext: DayContext | null;
  zmanim: PublisherZman[] | null;

  // State
  isLoading: boolean;
  isInitialized: boolean; // True once we've checked for saved locality on mount
  error: Error | null;
  selectedDate: string;

  // Actions
  refetch: () => void;
  setPreviewDate: (date: string) => void;
  setPreviewLocality: (localityId: number, displayName: string) => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

// localStorage key for saving selected preview locality
const PREVIEW_LOCALITY_KEY_PREFIX = 'zmanim-preview-locality-';

/**
 * Unified data fetching hook for algorithm page
 *
 * Only uses locality_id - backend handles all coordinate/timezone resolution
 */
export function useAlgorithmPageData(): AlgorithmPageData {
  const api = useApi();
  const { selectedPublisher } = usePublisherContext();

  // Date selection state (YYYY-MM-DD format)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Selected locality state (ID and display name)
  const [selectedLocalityId, setSelectedLocalityId] = useState<number | null>(null);
  const [selectedLocalityDisplayName, setSelectedLocalityDisplayName] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Restore saved locality on mount - check cookies first (PreviewToolbar), then localStorage (legacy)
  useEffect(() => {
    if (!selectedPublisher?.id || typeof window === 'undefined') return;

    // Priority 1: Check cookies (used by PreviewToolbar)
    const cookieLocalityId = Cookies.get('zmanim_preview_algorithm_locality_id');
    const cookieLocalityName = Cookies.get('zmanim_preview_algorithm_locality_name');

    if (cookieLocalityId) {
      const parsedId = parseInt(cookieLocalityId, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        setSelectedLocalityId(parsedId);
        setSelectedLocalityDisplayName(cookieLocalityName || null);

        // Sync to localStorage for consistency
        const savedKey = PREVIEW_LOCALITY_KEY_PREFIX + selectedPublisher.id;
        localStorage.setItem(savedKey, JSON.stringify({
          id: parsedId,
          displayName: cookieLocalityName || null
        }));
        setIsInitialized(true);
        return;
      }
    }

    // Priority 2: Fallback to localStorage (legacy)
    const savedKey = PREVIEW_LOCALITY_KEY_PREFIX + selectedPublisher.id;
    const saved = localStorage.getItem(savedKey);

    if (saved) {
      try {
        // Try parsing as JSON object {id, displayName}
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.id === 'number' && parsed.id > 0) {
          setSelectedLocalityId(parsed.id);
          setSelectedLocalityDisplayName(parsed.displayName || null);

          // Sync to cookies so PreviewToolbar shows it
          Cookies.set('zmanim_preview_algorithm_locality_id', String(parsed.id), {
            expires: 90,
            sameSite: 'Lax',
            secure: process.env.NODE_ENV === 'production',
          });
          if (parsed.displayName) {
            Cookies.set('zmanim_preview_algorithm_locality_name', parsed.displayName, {
              expires: 90,
              sameSite: 'Lax',
              secure: process.env.NODE_ENV === 'production',
            });
          }
        } else {
          // Invalid or corrupted data - clear it
          localStorage.removeItem(savedKey);
        }
      } catch {
        // Fallback: old format was just the numeric ID as string
        const parsedId = parseInt(saved, 10);
        if (!isNaN(parsedId) && parsedId > 0) {
          setSelectedLocalityId(parsedId);
        } else {
          // Invalid ID - clear localStorage
          localStorage.removeItem(savedKey);
        }
      }
    }

    // Mark as initialized even if no saved locality found
    setIsInitialized(true);
  }, [selectedPublisher?.id]);

  // Fetch zmanim with locality_id
  const {
    data: zmanimData,
    isLoading: zmanimLoading,
    error: zmanimError,
    refetch: refetchZmanim,
  } = useQuery({
    queryKey: ['publisher-zmanim-with-locality', selectedPublisher?.id, selectedLocalityId, selectedDate],
    queryFn: async () => {
      if (!selectedLocalityId) return null;

      try {
        // includeInactive=true to get all zmanim (including event-specific ones) for the algorithm editor
        // includeUnpublished=true to get draft zmanim that publishers are working on
        // Each zman has is_active_today field to indicate if it should be shown in preview
        const response = await api.get<FilteredZmanimResponse>(
          `/publisher/zmanim?locality_id=${selectedLocalityId}&date=${selectedDate}&includeInactive=true&includeUnpublished=true`
        );

        return response;
      } catch (error: unknown) {
        // If locality not found, clear invalid locality from state, cookies, and localStorage
        const errorMessage = error instanceof Error ? error.message : '';
        if (errorMessage.includes('locality not found') || errorMessage.includes('no rows in result set')) {
          console.warn('Invalid locality_id detected, clearing saved locality');
          setSelectedLocalityId(null);
          setSelectedLocalityDisplayName(null);
          if (typeof window !== 'undefined') {
            // Clear cookies
            Cookies.remove('zmanim_preview_algorithm_locality_id');
            Cookies.remove('zmanim_preview_algorithm_locality_name');
            // Clear localStorage
            if (selectedPublisher?.id) {
              const savedKey = PREVIEW_LOCALITY_KEY_PREFIX + selectedPublisher.id;
              localStorage.removeItem(savedKey);
            }
          }
        }
        throw error;
      }
    },
    enabled: !!selectedPublisher?.id && !!selectedLocalityId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false, // Don't retry on locality not found errors
  });

  // Refetch function
  const refetch = useCallback(() => {
    refetchZmanim();
  }, [refetchZmanim]);

  // Date setter function
  const setPreviewDate = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  // Locality setter function - stores both ID and display name in BOTH cookies and localStorage
  const setPreviewLocality = useCallback((localityId: number, displayName: string) => {
    setSelectedLocalityId(localityId);
    setSelectedLocalityDisplayName(displayName);

    if (typeof window !== 'undefined') {
      // Persist to cookies (used by PreviewToolbar)
      Cookies.set('zmanim_preview_algorithm_locality_id', String(localityId), {
        expires: 90,
        sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production',
      });
      Cookies.set('zmanim_preview_algorithm_locality_name', displayName, {
        expires: 90,
        sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production',
      });

      // Also persist to localStorage for consistency
      if (selectedPublisher?.id) {
        const savedKey = PREVIEW_LOCALITY_KEY_PREFIX + selectedPublisher.id;
        localStorage.setItem(savedKey, JSON.stringify({ id: localityId, displayName }));
      }
    }
  }, [selectedPublisher?.id]);

  // Compute stable return values
  const result: AlgorithmPageData = useMemo(() => {
    return {
      // Locality
      localityId: selectedLocalityId,
      localityDisplayName: selectedLocalityDisplayName,

      // Zmanim data
      dayContext: zmanimData?.day_context || null,
      zmanim: zmanimData?.zmanim || null,

      // State
      isLoading: zmanimLoading,
      isInitialized,
      error: zmanimError as Error | null,
      selectedDate,

      // Actions
      refetch,
      setPreviewDate,
      setPreviewLocality,
    };
  }, [
    selectedLocalityId,
    selectedLocalityDisplayName,
    zmanimData,
    zmanimLoading,
    isInitialized,
    zmanimError,
    selectedDate,
    refetch,
    setPreviewDate,
    setPreviewLocality,
  ]);

  return result;
}
