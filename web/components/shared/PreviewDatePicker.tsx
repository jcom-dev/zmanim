/**
 * @file PreviewDatePicker.tsx
 * @purpose Language-aware date picker that switches between Gregorian and Hebrew calendar formats
 * @pattern react-component
 * @dependencies useApi, shadcn Select, React Query
 * @frequency high - used in all preview toolbars
 * @compliance Story 11 Task 2.3 - Preview Toolbar Date Picker
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface PreviewDatePickerProps {
  /** Currently selected date in ISO format (YYYY-MM-DD) */
  value: string;
  /** Callback when date changes */
  onChange: (date: string) => void;
  /** Current language setting - 'en' = Gregorian, 'he' = Hebrew */
  language?: 'en' | 'he';
  /** Optional className */
  className?: string;
}

interface HebrewDateInfo {
  day: number;
  month: string;
  month_num: number;
  year: number;
}

// =============================================================================
// Hebrew Utilities (extracted from algorithm page)
// =============================================================================

/**
 * Convert day number to Hebrew numerals (gematria)
 */
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

/**
 * Convert year to Hebrew numerals
 */
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

// =============================================================================
// Constants
// =============================================================================

// English month names
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Abbreviated month names for compact display
const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

// Hebrew months with month numbers matching hdate library
// Month numbers: 1=Nisan, 2=Iyyar, ..., 7=Tishrei, 8=Cheshvan, 9=Kislev, etc.
const HEBREW_MONTHS_WITH_NUM = [
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
const getCurrentYearRange = () => {
  const currentYear = new Date().getFullYear();
  return {
    gregorian: Array.from({ length: 10 }, (_, i) => currentYear - 3 + i),
    hebrew: Array.from({ length: 10 }, (_, i) => currentYear + 3760 - 3 + i),
  };
};

// Hebrew days (1-30)
const HEBREW_DAYS = Array.from({ length: 30 }, (_, i) => i + 1);

/**
 * Get days in a month
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// =============================================================================
// Component
// =============================================================================

/**
 * PreviewDatePicker - Language-aware date picker component
 *
 * Displays Gregorian calendar when language='en'
 * Displays Hebrew calendar when language='he'
 * Internal storage is always Gregorian ISO format (YYYY-MM-DD)
 */
export function PreviewDatePicker({
  value,
  onChange,
  language = 'en',
  className = '',
}: PreviewDatePickerProps) {
  const api = useApi();

  // Parse ISO date string to Date object
  const currentDate = useMemo(() => {
    return new Date(value + 'T12:00:00');
  }, [value]);

  // Fetch Hebrew date when in Hebrew mode
  const { data: hebrewDate } = useQuery({
    queryKey: ['hebrew-date', value],
    queryFn: async () => {
      return api.public.get<HebrewDateInfo>(`/calendar/hebrew-date?date=${value}`);
    },
    enabled: language === 'he',
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Year ranges (memoized)
  const yearRanges = useMemo(() => getCurrentYearRange(), []);

  /**
   * Navigate to previous day
   */
  const goToPreviousDay = useCallback(() => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    onChange(newDate.toISOString().split('T')[0]);
  }, [currentDate, onChange]);

  /**
   * Navigate to next day
   */
  const goToNextDay = useCallback(() => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    onChange(newDate.toISOString().split('T')[0]);
  }, [currentDate, onChange]);

  /**
   * Convert Hebrew date to Gregorian and update
   */
  const handleHebrewDateChange = useCallback(async (year: number, monthNum: number, day: number) => {
    try {
      const data = await api.public.get<{ date: string }>(
        `/calendar/gregorian-date?year=${year}&month=${monthNum}&day=${day}`
      );
      if (data.date) {
        onChange(data.date);
      }
    } catch (err) {
      console.error('Failed to convert Hebrew date:', err);
    }
  }, [api, onChange]);

  /**
   * Handle Gregorian month change
   */
  const handleGregorianMonthChange = useCallback((newMonth: number) => {
    const newDate = new Date(currentDate);
    const maxDay = getDaysInMonth(newDate.getFullYear(), newMonth);
    if (newDate.getDate() > maxDay) {
      newDate.setDate(maxDay);
    }
    newDate.setMonth(newMonth);
    onChange(newDate.toISOString().split('T')[0]);
  }, [currentDate, onChange]);

  /**
   * Handle Gregorian day change
   */
  const handleGregorianDayChange = useCallback((newDay: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDay);
    onChange(newDate.toISOString().split('T')[0]);
  }, [currentDate, onChange]);

  /**
   * Handle Gregorian year change
   */
  const handleGregorianYearChange = useCallback((newYear: number) => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(newYear);
    const maxDay = getDaysInMonth(newYear, newDate.getMonth());
    if (newDate.getDate() > maxDay) {
      newDate.setDate(maxDay);
    }
    onChange(newDate.toISOString().split('T')[0]);
  }, [currentDate, onChange]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Previous Day Arrow */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPreviousDay}
            className="h-9 w-9 shrink-0"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Previous day</TooltipContent>
      </Tooltip>

      {/* Date Selectors - Gregorian or Hebrew based on language */}
      {language === 'en' ? (
        <>
          {/* Gregorian: Month, Day, Year */}
          <Select
            value={currentDate.getMonth().toString()}
            onValueChange={(value) => handleGregorianMonthChange(parseInt(value))}
          >
            <SelectTrigger className="h-9 w-[72px] px-3 text-sm font-medium border-input bg-background hover:bg-muted/50 gap-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES_SHORT.map((month, index) => (
                <SelectItem key={month} value={index.toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={currentDate.getDate().toString()}
            onValueChange={(value) => handleGregorianDayChange(parseInt(value))}
          >
            <SelectTrigger className="h-9 w-[64px] px-3 text-sm font-medium border-input bg-background hover:bg-muted/50 gap-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from(
                { length: getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth()) },
                (_, i) => i + 1
              ).map((day) => (
                <SelectItem key={day} value={day.toString()}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={currentDate.getFullYear().toString()}
            onValueChange={(value) => handleGregorianYearChange(parseInt(value))}
          >
            <SelectTrigger className="h-9 w-[80px] px-3 text-sm font-medium border-input bg-background hover:bg-muted/50 gap-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearRanges.gregorian.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : hebrewDate && hebrewDate.day && hebrewDate.month_num && hebrewDate.year ? (
        <>
          {/* Hebrew: Day, Month, Year (RTL order) */}
          <Select
            value={hebrewDate.day.toString()}
            onValueChange={(value) =>
              handleHebrewDateChange(hebrewDate.year, hebrewDate.month_num, parseInt(value))
            }
          >
            <SelectTrigger
              className="h-9 w-[72px] px-3 text-sm font-medium font-hebrew border-input bg-background hover:bg-muted/50 gap-1"
              dir="rtl"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HEBREW_DAYS.map((day) => (
                <SelectItem key={day} value={day.toString()} className="font-hebrew">
                  {toHebrewNumerals(day)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={hebrewDate.month_num.toString()}
            onValueChange={(value) =>
              handleHebrewDateChange(hebrewDate.year, parseInt(value), hebrewDate.day)
            }
          >
            <SelectTrigger
              className="h-9 w-auto px-3 text-sm font-medium font-hebrew border-input bg-background hover:bg-muted/50 gap-1"
              dir="rtl"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HEBREW_MONTHS_WITH_NUM.map((m) => (
                <SelectItem key={m.num} value={m.num.toString()} className="font-hebrew">
                  {m.heb}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={hebrewDate.year.toString()}
            onValueChange={(value) =>
              handleHebrewDateChange(parseInt(value), hebrewDate.month_num, hebrewDate.day)
            }
          >
            <SelectTrigger
              className="h-9 w-auto px-3 text-sm font-medium font-hebrew border-input bg-background hover:bg-muted/50 gap-1"
              dir="rtl"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearRanges.hebrew.map((year) => (
                <SelectItem key={year} value={year.toString()} className="font-hebrew">
                  {toHebrewYear(year)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : (
        // Loading state for Hebrew calendar
        <span className="text-sm text-muted-foreground">Loading...</span>
      )}

      {/* Next Day Arrow */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextDay}
            className="h-9 w-9 shrink-0"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Next day</TooltipContent>
      </Tooltip>
    </div>
  );
}
