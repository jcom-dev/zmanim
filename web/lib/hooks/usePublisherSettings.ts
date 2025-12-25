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

/**
 * Hook that provides a function to get the correct tag display name based on publisher settings.
 * Uses the publisher's transliteration_style preference.
 *
 * @example
 * ```tsx
 * const getTagName = useTagDisplayName();
 * // In render:
 * <span>{getTagName(tag)}</span>
 * ```
 */
export function useTagDisplayName() {
  const { data: settings } = usePublisherCalculationSettings();
  const style = settings?.transliteration_style || 'ashkenazi';

  return function getTagName(
    tag: {
      display_name_english_ashkenazi?: string;
      display_name_english_sephardi?: string | null;
      display_name_english?: string;
    }
  ): string {
    if (style === 'sephardi' && tag.display_name_english_sephardi) {
      return tag.display_name_english_sephardi;
    }
    // For ashkenazi: prefer backend-resolved display_name_english (may already be set
    // based on publisher preference), then fall back to explicit ashkenazi field
    return tag.display_name_english || tag.display_name_english_ashkenazi || '';
  };
}
