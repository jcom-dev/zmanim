/**
 * @file usePublisherSettings.ts
 * @purpose Hook for fetching publisher calculation settings including transliteration style
 * @pattern react-query
 * @dependencies usePublisherQuery
 */

import { usePublisherQuery } from './useApiQuery';

export interface CalculationSettings {
  ignore_elevation: boolean;
  transliteration_style: 'ashkenazi' | 'sephardi';
}

/**
 * Hook to fetch publisher calculation settings.
 * Includes transliteration_style which determines "Shabbos" vs "Shabbat" display.
 *
 * @example
 * ```tsx
 * const { data: settings } = usePublisherCalculationSettings();
 * const shabbatLabel = settings?.transliteration_style === 'ashkenazi' ? 'Shabbos' : 'Shabbat';
 * ```
 */
export function usePublisherCalculationSettings() {
  return usePublisherQuery<CalculationSettings>(
    'publisher-calculation-settings',
    '/publisher/settings/calculation',
    {
      staleTime: 5 * 60 * 1000, // 5 minutes - settings don't change often
    }
  );
}

/**
 * Returns the appropriate Shabbat/Shabbos label based on transliteration style.
 * Defaults to 'Shabbat' (Sephardi) if settings haven't loaded yet.
 */
export function getShabbatLabel(transliterationStyle?: 'ashkenazi' | 'sephardi'): string {
  return transliterationStyle === 'ashkenazi' ? 'Shabbos' : 'Shabbat';
}

/**
 * Returns the appropriate Erev Shabbat/Erev Shabbos label based on transliteration style.
 * Defaults to 'Erev Shabbat' (Sephardi) if settings haven't loaded yet.
 */
export function getErevShabbatLabel(transliterationStyle?: 'ashkenazi' | 'sephardi'): string {
  return transliterationStyle === 'ashkenazi' ? 'Erev Shabbos' : 'Erev Shabbat';
}
