/**
 * @file ZmanTimePreview.tsx
 * @purpose Live time preview for zman formula on selected date/location
 * @pattern client-component
 * @dependencies useDebounce, usePreviewFormula, PreferencesContext, luxon
 * @frequency high - shown on every zman card
 * @compliance Story 8-35 - Zman Card Time Preview
 */

'use client';

import { useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, Loader2, MapPin, AlertCircle } from 'lucide-react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { usePreviewFormula } from '@/lib/hooks/useZmanimList';
import { formatTimeTo12Hour } from '@/lib/utils/time-format';
import { usePreferences } from '@/lib/contexts/PreferencesContext';
import { cn } from '@/lib/utils';

interface ZmanTimePreviewProps {
  /** DSL formula to calculate */
  formula: string;
  /** Date for calculation (JS Date object) */
  date: Date;
  /** City ID for location (null if no location selected) */
  localityId?: number | null;
  /** City name for display */
  localityName?: string;
  /** Latitude for calculation */
  latitude?: number;
  /** Longitude for calculation */
  longitude?: number;
  /** IANA timezone string */
  timezone?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ZmanTimePreview - Shows calculated time for a formula on a specific date/location
 *
 * Features:
 * - API-based calculation for all formulas
 * - Debounced formula changes (300ms)
 * - Loading states
 * - Error states (no location, invalid formula)
 * - Respects showSeconds and roundingMode from PreferencesContext
 */
export function ZmanTimePreview({
  formula,
  date,
  localityId, // eslint-disable-line @typescript-eslint/no-unused-vars
  localityName,
  latitude,
  longitude,
  timezone,
  className,
}: ZmanTimePreviewProps) {
  const { preferences } = usePreferences();
  const { mutate: previewFormula, data: previewResult, isPending, error: mutationError } = usePreviewFormula();

  // Debounce formula changes to avoid excessive API calls
  const debouncedFormula = useDebounce(formula, 300);

  // Convert Date to ISO date string for API
  const dateString = useMemo(() => {
    return date.toISOString().split('T')[0];
  }, [date]);

  // Calculate time when inputs change
  useEffect(() => {
    // Validate inputs
    if (!debouncedFormula.trim()) {
      return;
    }

    if (!latitude || !longitude || !timezone) {
      return;
    }

    // Call API to preview formula
    previewFormula({
      formula: debouncedFormula,
      date: dateString,
      location: {
        latitude,
        longitude,
        timezone,
        displayName: localityName || 'Selected Location',
      },
    });
  }, [debouncedFormula, dateString, latitude, longitude, timezone, localityName, previewFormula]);

  // Format time for display - use API-provided time fields
  const formattedTime = useMemo(() => {
    if (!previewResult) return null;

    const showSeconds = preferences.showSeconds ?? false;

    // Use API-provided time fields (backend handles rounding)
    let timeStr: string;
    if (showSeconds) {
      // Use exact time with seconds
      timeStr = previewResult.time_exact || previewResult.result;
    } else {
      // Use display-ready time (already rounded, no seconds)
      timeStr = previewResult.time_display || previewResult.result;
    }

    // Convert to 12-hour format (no rounding needed - backend did it)
    return formatTimeTo12Hour(timeStr, showSeconds);
  }, [previewResult, preferences.showSeconds]);

  // Render loading state
  if (isPending) {
    return (
      <Badge variant="outline" className={cn('gap-1.5 text-xs', className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-muted-foreground">Calculating...</span>
      </Badge>
    );
  }

  // Render error states
  if (!formula.trim()) {
    return null;
  }

  if (!latitude || !longitude || !timezone) {
    return (
      <Badge variant="outline" className={cn('gap-1.5 text-xs border-amber-300 bg-amber-50 dark:bg-amber-950/20', className)}>
        <MapPin className="h-3 w-3 text-amber-600 dark:text-amber-400" />
        <span className="text-amber-600 dark:text-amber-400">Select location</span>
      </Badge>
    );
  }

  if (mutationError) {
    return (
      <Badge variant="outline" className={cn('gap-1.5 text-xs border-destructive/50 bg-destructive/10', className)}>
        <AlertCircle className="h-3 w-3 text-destructive" />
        <span className="text-destructive text-xs">Invalid formula</span>
      </Badge>
    );
  }

  // Render calculated time
  if (formattedTime) {
    return (
      <Badge variant="default" className={cn('gap-1.5 text-xs font-mono', className)}>
        <Clock className="h-3 w-3" />
        <span>{formattedTime}</span>
      </Badge>
    );
  }

  return null;
}
