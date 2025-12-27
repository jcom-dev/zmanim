/**
 * @file usePreviewToolbar.ts
 * @purpose Custom hook for managing preview toolbar state with per-page cookie storage
 * @pattern react-hook
 * @dependencies js-cookie, PreferencesContext
 * @frequency high - used by all preview toolbar instances
 * @compliance Preview Toolbar Requirements R2 - Storage Strategy
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';
import { usePreferences } from '@/lib/contexts/PreferencesContext';

// Cookie TTL for preview settings
const TTL_PREVIEW = 90; // 90 days

/**
 * Options for configuring preview toolbar behavior
 */
export interface UsePreviewToolbarOptions {
  /** Unique storage key for this page's preview state (e.g., 'algorithm', 'publisher_registry') */
  storageKey: string;

  /** Restrict locality search to publisher's coverage areas */
  restrictToCoverage?: boolean;

  /** Publisher ID (required if restrictToCoverage is true) */
  publisherId?: number;

  /** Whether publisher has global coverage (disables restriction) */
  isGlobalPublisher?: boolean;
}

/**
 * Preview toolbar state and actions
 */
export interface PreviewToolbarState {
  // Locality (per-page cookie)
  localityId: number | null;
  localityName: string | null;
  setLocality: (id: number | null, name: string | null) => void;

  // Date (per-page cookie, always stored as Gregorian ISO)
  date: string; // ISO YYYY-MM-DD
  setDate: (date: string) => void;

  // Language (global - from PreferencesContext)
  language: 'en' | 'he';
  setLanguage: (lang: 'en' | 'he') => void;

  // Convenience flags
  hasLocation: boolean;
  isGlobal: boolean;
  isHebrew: boolean; // Shorthand for language === 'he'
}

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 */
function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get cookie names for this preview instance
 */
function getCookieNames(storageKey: string) {
  return {
    localityId: `zmanim_preview_${storageKey}_locality_id`,
    localityName: `zmanim_preview_${storageKey}_locality_name`,
    date: `zmanim_preview_${storageKey}_date`,
  };
}

/**
 * Custom hook for managing preview toolbar state
 *
 * Manages locality and date in per-page cookies, while language is managed
 * globally via PreferencesContext.
 *
 * @example
 * ```tsx
 * const {
 *   localityId, localityName, setLocality,
 *   date, setDate,
 *   language, setLanguage,
 *   hasLocation, isHebrew
 * } = usePreviewToolbar({ storageKey: 'algorithm' });
 * ```
 */
export function usePreviewToolbar(options: UsePreviewToolbarOptions): PreviewToolbarState {
  const { storageKey, isGlobalPublisher = false } = options;
  const cookieNames = getCookieNames(storageKey);

  // Get global language from PreferencesContext
  const { preferences, setLanguage: setGlobalLanguage } = usePreferences();

  // Local state for locality and date
  const [localityId, setLocalityIdState] = useState<number | null>(null);
  const [localityName, setLocalityNameState] = useState<string | null>(null);
  const [date, setDateState] = useState<string>(getTodayISO());
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from cookies on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const localityIdCookie = Cookies.get(cookieNames.localityId);
    const localityNameCookie = Cookies.get(cookieNames.localityName);
    const dateCookie = Cookies.get(cookieNames.date);

    setLocalityIdState(localityIdCookie ? parseInt(localityIdCookie, 10) : null);
    setLocalityNameState(localityNameCookie || null);
    setDateState(dateCookie || getTodayISO());
    setIsInitialized(true);
  }, [cookieNames.localityId, cookieNames.localityName, cookieNames.date]);

  // Cross-tab sync - listen for cookie changes from other tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleCookieChange = (e: CustomEvent) => {
      const { key, value } = e.detail;

      if (key === cookieNames.localityId) {
        setLocalityIdState(value ? parseInt(value, 10) : null);
      } else if (key === cookieNames.localityName) {
        setLocalityNameState(value || null);
      } else if (key === cookieNames.date) {
        setDateState(value || getTodayISO());
      }
    };

    window.addEventListener('preview-toolbar-cookie-change' as keyof WindowEventMap, handleCookieChange as EventListener);

    return () => {
      window.removeEventListener(
        'preview-toolbar-cookie-change' as keyof WindowEventMap,
        handleCookieChange as EventListener
      );
    };
  }, [cookieNames.localityId, cookieNames.localityName, cookieNames.date]);

  // Set locality and persist to cookie
  const setLocality = useCallback(
    (id: number | null, name: string | null) => {
      if (!isInitialized) return;

      // Update cookies
      if (id !== null) {
        Cookies.set(cookieNames.localityId, String(id), {
          expires: TTL_PREVIEW,
          sameSite: 'Lax',
          secure: process.env.NODE_ENV === 'production',
        });
      } else {
        Cookies.remove(cookieNames.localityId);
      }

      if (name !== null) {
        Cookies.set(cookieNames.localityName, name, {
          expires: TTL_PREVIEW,
          sameSite: 'Lax',
          secure: process.env.NODE_ENV === 'production',
        });
      } else {
        Cookies.remove(cookieNames.localityName);
      }

      // Update state
      setLocalityIdState(id);
      setLocalityNameState(name);

      // Broadcast to other tabs
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('preview-toolbar-cookie-change', {
            detail: { key: cookieNames.localityId, value: id ? String(id) : null },
          })
        );
        window.dispatchEvent(
          new CustomEvent('preview-toolbar-cookie-change', {
            detail: { key: cookieNames.localityName, value: name },
          })
        );
      }
    },
    [cookieNames.localityId, cookieNames.localityName, isInitialized]
  );

  // Set date and persist to cookie
  const setDate = useCallback(
    (newDate: string) => {
      if (!isInitialized) return;

      // Update cookie
      Cookies.set(cookieNames.date, newDate, {
        expires: TTL_PREVIEW,
        sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production',
      });

      // Update state
      setDateState(newDate);

      // Broadcast to other tabs
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('preview-toolbar-cookie-change', {
            detail: { key: cookieNames.date, value: newDate },
          })
        );
      }
    },
    [cookieNames.date, isInitialized]
  );

  // Set language (delegates to PreferencesContext)
  const setLanguage = useCallback(
    (lang: 'en' | 'he') => {
      setGlobalLanguage(lang);
    },
    [setGlobalLanguage]
  );

  // Derived values
  const hasLocation = localityId !== null;
  const isGlobal = isGlobalPublisher;
  const isHebrew = preferences.language === 'he';

  return {
    localityId,
    localityName,
    setLocality,
    date,
    setDate,
    language: preferences.language,
    setLanguage,
    hasLocation,
    isGlobal,
    isHebrew,
  };
}
