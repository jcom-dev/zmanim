/**
 * @file AlgorithmPreview.tsx
 * @description Live preview of calculated zmanim for the publisher algorithm page
 * @module components/publisher
 *
 * Displays a real-time preview of zmanim calculations showing:
 * - Calculated times (with optional seconds display)
 * - Day context badges (Shabbos, Yom Tov, fast days)
 * - Hebrew/English/both name display modes
 * - Active/inactive zman filtering (e.g., candle lighting only on Fridays)
 * - Beta and disabled state indicators
 *
 * Used on the publisher algorithm configuration page to preview
 * how zmanim will appear for end users.
 */
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePreferences } from '@/lib/contexts/PreferencesContext';
import { formatTimeTo12Hour } from '@/lib/utils/time-format';
import { FlaskConical, Flame, Moon, Star } from 'lucide-react';
import type { DayContext } from '@/lib/hooks/useAlgorithmPageData';

/** Zman with calculated time from backend API */
interface ZmanWithTime {
  id: string;
  zman_key: string;
  hebrew_name: string;
  english_name: string;
  time?: string; // Exact time with seconds (HH:mm:ss)
  time_rounded?: string; // Rounded time per rounding_mode (HH:mm:ss with :00)
  time_display?: string; // Rounded time for display (HH:mm, no seconds)
  error?: string;
  is_beta: boolean;
  is_enabled: boolean;
  is_active_today?: boolean; // Whether this zman is active for the current day context (undefined = true, legacy compat)
  rounding_mode?: 'floor' | 'math' | 'ceil'; // Story 8-34: per-zman rounding mode
  tags?: Array<{ tag_type: string; tag_key: string }>; // Tags from zman
}

interface AlgorithmPreviewProps {
  zmanim: ZmanWithTime[] | null;
  dayContext: DayContext | null;
  displayLanguage?: 'hebrew' | 'english' | 'both';
  isLoading?: boolean;
  error?: string | null;
  hasCoverage?: boolean;
}

export function AlgorithmPreview({
  zmanim,
  dayContext,
  displayLanguage = 'both',
  isLoading = false,
  error = null,
  hasCoverage = true
}: AlgorithmPreviewProps) {
  const { preferences } = usePreferences();

  // Filter to only show active zmanim in preview using backend-computed is_active_today
  // Backend determines this by checking zman tags against active event codes
  const preview = useMemo(() => {
    return (zmanim ?? []).filter(z => z.is_active_today !== false);
  }, [zmanim]);

  // Story 8-34: Format time for display
  // Publisher algorithm page defaults to seconds ON
  // Backend returns `time` (exact with seconds), `time_rounded` (HH:mm:ss with :00), and `time_display` (HH:mm)
  const showSeconds = preferences.showSeconds ?? true;

  // Helper to get the right time field and format it for display
  const formatTime = (item: ZmanWithTime): string => {
    // When showSeconds is off, use time_display (HH:mm format, no :00 suffix)
    const timeToDisplay = showSeconds ? item.time : (item.time_display || item.time_rounded);
    if (!timeToDisplay) return 'N/A';
    return formatTimeTo12Hour(timeToDisplay, showSeconds);
  };

  // Get Omer day from active event codes
  const omerDay = useMemo(() => {
    if (!dayContext?.active_event_codes) return null;
    for (const code of dayContext.active_event_codes) {
      if (code.startsWith('omer_')) {
        const match = code.match(/omer_(\d+)/);
        if (match) return parseInt(match[1], 10);
      }
    }
    return null;
  }, [dayContext?.active_event_codes]);

  // Filter out Chanukah and Omer from holidays display (shown separately)
  // Return the appropriate name based on displayLanguage
  const displayHolidays = useMemo(() => {
    if (!dayContext?.holidays || !Array.isArray(dayContext.holidays)) return [];
    return dayContext.holidays
      .filter(h => h.name && !h.name.includes('Chanukah') && !h.name.includes('Omer'))
      .map(h => displayLanguage === 'hebrew' ? (h.name_hebrew || h.name) : h.name);
  }, [dayContext?.holidays, displayLanguage]);

  // Get Chanukah info with both English and Hebrew names
  const chanukahInfo = useMemo(() => {
    if (!dayContext?.holidays || !Array.isArray(dayContext.holidays)) return null;
    for (const h of dayContext.holidays) {
      if (h.name?.includes('Chanukah')) {
        const dayMatch = h.name.match(/Day\s*(\d+)/i);
        if (dayMatch) {
          return {
            day: parseInt(dayMatch[1], 10),
            nameHebrew: h.name_hebrew || h.name
          };
        }
      }
    }
    return null;
  }, [dayContext?.holidays]);

  // Determine if we should use RTL layout
  const isRTL = displayLanguage === 'hebrew';

  return (
    <Card data-testid="algorithm-preview">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Live Preview</CardTitle>
            <span className="text-sm text-muted-foreground">{dayContext?.day_name || ''}</span>
          </div>
          <div className="text-xs text-muted-foreground">{dayContext?.hebrew_date || ''}</div>
          {dayContext && (dayContext.active_event_codes?.includes('erev_shabbos') || dayContext.active_event_codes?.includes('shabbos') || displayHolidays.length > 0 || chanukahInfo || omerDay) && (
            <div className={`flex gap-1.5 flex-wrap ${isRTL ? 'flex-row-reverse justify-end' : 'justify-start'}`} dir={isRTL ? 'rtl' : 'ltr'}>
              {dayContext.active_event_codes?.includes('erev_shabbos') && (
                <Badge variant="solid" className="text-xs gap-1 shrink-0 bg-orange-500 text-white border-orange-600 whitespace-nowrap">
                  <Flame className="h-3 w-3" />
                  {isRTL ? 'ערב שבת' : 'Erev Shabbos'}
                </Badge>
              )}
              {dayContext.active_event_codes?.includes('shabbos') && (
                <Badge variant="solid" className="text-xs gap-1 shrink-0 bg-purple-500 text-white border-purple-600 whitespace-nowrap">
                  <Moon className="h-3 w-3" />
                  {isRTL ? 'שבת' : 'Shabbos'}
                </Badge>
              )}
              {displayHolidays.map((holiday, i) => (
                <Badge key={i} variant="solid" className={`text-xs shrink-0 bg-blue-600 text-white border-blue-700 dark:bg-blue-600 dark:text-blue-50 dark:border-blue-500 whitespace-nowrap ${isRTL ? 'font-hebrew' : ''}`}>
                  {holiday}
                </Badge>
              ))}
              {chanukahInfo && (
                <Badge variant="solid" className={`text-xs gap-1 shrink-0 bg-amber-500 text-black border-amber-600 whitespace-nowrap ${isRTL ? 'font-hebrew' : ''}`}>
                  <Star className="h-3 w-3" />
                  {isRTL ? chanukahInfo.nameHebrew : `Chanukah Day ${chanukahInfo.day}`}
                </Badge>
              )}
              {omerDay && (
                <Badge variant="solid" className="text-xs shrink-0 bg-green-600 text-white border-green-700 dark:bg-green-600 dark:text-green-50 dark:border-green-500 whitespace-nowrap">
                  {isRTL ? `עומר ${omerDay}` : `Omer ${omerDay}`}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasCoverage && (
          <div className="text-center py-6 text-muted-foreground">
            <div className="text-amber-500 mb-2">
              <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium">No Coverage Areas</p>
            <p className="text-xs mt-1">Add coverage to see live preview</p>
          </div>
        )}

        {hasCoverage && isLoading && (
          <div className="text-center py-4 text-muted-foreground">
            Calculating...
          </div>
        )}

        {hasCoverage && error && (
          <div className="text-center py-4 text-destructive">
            {error}
          </div>
        )}

        {hasCoverage && !isLoading && !error && preview.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            No enabled zmanim to preview
          </div>
        )}

        {hasCoverage && !isLoading && !error && preview.length > 0 && (
          <table className="w-full">
            <tbody>
              {preview.map((item) => (
                <tr
                  key={item.zman_key}
                  className="border-b border-border last:border-0"
                  data-testid={`preview-${item.zman_key}`}
                >
                  <td className={`py-2 pr-2 font-medium text-foreground text-sm ${displayLanguage === 'hebrew' ? 'font-hebrew text-right' : ''}`}>
                    <span className="flex items-center gap-1.5">
                      <span className="truncate max-w-[150px]" title={displayLanguage === 'hebrew' ? item.hebrew_name : item.english_name}>
                        {displayLanguage === 'hebrew' ? item.hebrew_name : item.english_name}
                      </span>
                      {item.is_beta && <FlaskConical className="h-3 w-3 text-amber-500 shrink-0" />}
                    </span>
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {(item.time || item.time_rounded) && !item.error ? (
                      <span className={`font-mono text-primary ${showSeconds ? 'text-sm' : 'text-base'}`}>
                        {formatTime(item)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
