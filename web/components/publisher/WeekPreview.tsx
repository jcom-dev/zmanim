/**
 * @file WeekPreview.tsx
 * @purpose 7-day zmanim preview - caching, date navigation
 * @pattern client-component
 * @dependencies usePublisherQuery, DatePicker, Table (shadcn)
 * @frequency high - 617 lines
 * @compliance Check docs/adr/ for pattern rationale
 */

'use client';

import { usePublisherQuery } from '@/lib/hooks/useApiQuery';
import { useApi } from '@/lib/api-client';
import { useState, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Eye, EyeOff, Moon, Sun, Star, FlaskConical, Printer } from 'lucide-react';
import { usePreferences } from '@/lib/contexts/PreferencesContext';
import { formatTimeTo12Hour } from '@/lib/utils/time-format';
import { WeeklyCalendarSelectionDialog } from './WeeklyCalendarSelectionDialog';

// ============================================================================
// Constants
// ============================================================================

const HEBREW_MONTHS = [
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

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const HEBREW_MONTH_MAP: Record<string, string> = {
  'Nisan': 'ניסן', 'Iyyar': 'אייר', 'Sivan': 'סיון', 'Tamuz': 'תמוז',
  'Av': 'אב', 'Elul': 'אלול', 'Tishrei': 'תשרי', 'Cheshvan': 'חשון',
  'Kislev': 'כסלו', 'Tevet': 'טבת', 'Shvat': 'שבט', 'Adar': 'אדר',
  'Adar I': 'אדר א׳', 'Adar II': 'אדר ב׳',
};

const HEBREW_DAY_MAP: Record<string, string> = {
  'Sunday': 'יום ראשון', 'Monday': 'יום שני', 'Tuesday': 'יום שלישי',
  'Wednesday': 'יום רביעי', 'Thursday': 'יום חמישי', 'Friday': 'יום שישי',
  'Saturday': 'שבת קודש',
};

const currentGregorianYear = new Date().getFullYear();
const currentHebrewYear = currentGregorianYear + 3760;
const HEBREW_YEARS = Array.from({ length: 10 }, (_, i) => currentHebrewYear - 3 + i);
const GREGORIAN_YEARS = Array.from({ length: 10 }, (_, i) => currentGregorianYear - 2 + i);

// ============================================================================
// Types
// ============================================================================

interface WeekPreviewProps {
  localityId: string;
  displayName: string;
  initialDate?: Date;
  /** Language for zman names: 'hebrew' or 'english'. Falls back to user preference if not provided. */
  displayLanguage?: 'hebrew' | 'english';
}

// API Response types
interface BatchHolidayInfo {
  name: string;
  name_hebrew: string;
  category: string;
  is_yom_tov: boolean;
}

interface BatchDayContext {
  date: string;
  hebrew_date: string;
  hebrew_date_formatted: string;
  is_yom_tov: boolean;
  is_fast_day: boolean;
  holidays: BatchHolidayInfo[];
  show_candle_lighting: boolean;
}

interface BatchZman {
  zman_key: string;
  english_name: string;
  hebrew_name: string;
  is_enabled: boolean;
  is_published: boolean;
  is_beta: boolean;
  is_event_zman?: boolean; // Whether this is an event zman (candle lighting, havdalah, etc.)
  time?: string | null; // Exact time with seconds (HH:mm:ss)
  time_rounded?: string | null; // Rounded time per rounding_mode (HH:mm:ss with :00)
  time_display?: string | null; // Rounded time for display (HH:mm, no seconds)
}

interface BatchWeekDay {
  day_context: BatchDayContext;
  zmanim: BatchZman[];
}

interface BatchWeekResponse {
  days: BatchWeekDay[];
}

// Internal display types
interface HebrewDate {
  day: number;
  month: string;
  year: number;
  hebrew: string;
}

interface Holiday {
  name: string;
  name_hebrew: string;
  category: string;
  yomtov: boolean;
}

interface DayZman {
  zman_key: string;
  english_name: string;
  hebrew_name: string;
  is_published: boolean;
  is_beta: boolean;
  is_enabled: boolean;
  is_event_zman: boolean; // Whether this is an event zman (candle lighting, havdalah, etc.)
  time: string | null; // Exact time with seconds
  time_rounded: string | null; // Rounded time per rounding_mode (HH:mm:ss with :00)
  time_display: string | null; // Rounded time for display (HH:mm, no seconds)
}

interface DayResult {
  date: string;
  dayName: string;
  dayNumber: number;
  month: string;
  year: number;
  hebrewDate?: HebrewDate;
  holidays: Holiday[];
  isYomTov: boolean;
  zmanim: DayZman[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function getHebrewMonthNum(englishMonth: string): number {
  return HEBREW_MONTHS.find(m => m.eng === englishMonth)?.num || 7;
}

function getHebrewMonthName(englishMonth: string): string {
  return HEBREW_MONTH_MAP[englishMonth] || englishMonth;
}

function getHebrewDayName(englishDay: string): string {
  return HEBREW_DAY_MAP[englishDay] || englishDay;
}

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
    return o === 0 ? tens[t] + '׳' : tens[t] + '״' + ones[o];
  }
  return num.toString();
}

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
    result += o > 0 ? '״' + ones[o] : (result.length > 0 ? '׳' : '');
  }
  return result;
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0];
}

function isShabbat(dateStr: string): boolean {
  return new Date(dateStr).getDay() === 6;
}

function isFriday(dateStr: string): boolean {
  return new Date(dateStr).getDay() === 5;
}

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

// ============================================================================
// Component
// ============================================================================

export function WeekPreview({ localityId, displayName, initialDate, displayLanguage }: WeekPreviewProps) {
  const api = useApi();
  const { preferences } = usePreferences();
  // Publisher algorithm page defaults to seconds ON (true) when no preference is set
  // Backend returns both `time` (exact with seconds) and `time_rounded` (rounded per rounding_mode)
  const showSeconds = preferences.showSeconds ?? true;
  // Use prop if provided, otherwise fall back to user's language preference
  const useHebrew = displayLanguage ? displayLanguage === 'hebrew' : preferences.language === 'he';
  const [selectedDate, setSelectedDate] = useState(() => initialDate ?? new Date());
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const dayRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);

  const weekStartStr = useMemo(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  }, [selectedDate]);

  // Use React Query for week data with caching
  const {
    data: batchData,
    isLoading,
    error: queryError,
  } = usePublisherQuery<BatchWeekResponse>(
    ['publisher-zmanim-week', localityId, weekStartStr],
    '/publisher/zmanim/week',
    {
      params: {
        start_date: weekStartStr,
        locality_id: localityId,
      },
      enabled: !!localityId,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Convert Hebrew date to Gregorian
  const handleHebrewDateChange = useCallback(async (year: number, monthNum: number, day: number) => {
    try {
      const data = await api.public.get<{ date: string }>(`/calendar/gregorian-date?year=${year}&month=${monthNum}&day=${day}`);
      if (data.date) {
        setSelectedDate(new Date(data.date + 'T12:00:00'));
      }
    } catch (err) {
      console.error('Failed to convert Hebrew date:', err);
    }
  }, [api]);

  // Process batch data into DayResult format
  const weekData = useMemo(() => {
    const startDate = new Date(weekStartStr + 'T00:00:00');

    // Initialize days structure
    const days: DayResult[] = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      return {
        date: date.toISOString().split('T')[0],
        dayName: DAY_NAMES[date.getDay()],
        dayNumber: date.getDate(),
        month: MONTH_NAMES[date.getMonth()],
        year: date.getFullYear(),
        holidays: [],
        isYomTov: false,
        zmanim: [],
      };
    });

    if (batchData?.days?.length) {
      batchData.days.forEach((batchDay, index) => {
        if (index >= days.length) return;

        const ctx = batchDay.day_context;
        days[index].isYomTov = ctx.is_yom_tov;

        // Map holiday objects from API response (handle null/undefined from Go nil slice)
        days[index].holidays = (ctx.holidays || []).map(h => ({
          name: h.name,
          name_hebrew: h.name_hebrew,
          category: h.category,
          yomtov: h.is_yom_tov,
        }));

        // Parse hebrew_date string "23 Kislev 5785"
        const hebrewParts = ctx.hebrew_date.split(' ');
        if (hebrewParts.length >= 3) {
          days[index].hebrewDate = {
            day: parseInt(hebrewParts[0], 10) || 1,
            month: hebrewParts[1] || 'Tishrei',
            year: parseInt(hebrewParts[2], 10) || 5785,
            hebrew: ctx.hebrew_date_formatted,
          };
        }

        // Map zmanim
        days[index].zmanim = batchDay.zmanim.map(z => ({
          zman_key: z.zman_key,
          english_name: z.english_name,
          hebrew_name: z.hebrew_name,
          is_published: z.is_published,
          is_beta: z.is_beta,
          is_enabled: z.is_enabled,
          is_event_zman: z.is_event_zman || false,
          time: z.time || null,
          time_rounded: z.time_rounded || null,
          time_display: z.time_display || null,
        }));
      });
    }

    return days;
  }, [batchData, weekStartStr]);

  // Calculate zmanim counts by status for weekly calendar dialog
  // Must gather unique zmanim across ALL 7 days since event zmanim (candle lighting, havdalah)
  // only appear on specific days (Friday, Saturday)
  const zmanimCounts = useMemo(() => {
    if (weekData.length === 0) {
      return { published: 0, draft: 0, optional: 0, hidden: 0, events: 0 };
    }

    // Gather unique zmanim across all 7 days by zman_key
    const seenZmanim = new Map<string, DayZman>();
    weekData.forEach(day => {
      day.zmanim.forEach(zman => {
        if (!seenZmanim.has(zman.zman_key)) {
          seenZmanim.set(zman.zman_key, zman);
        }
      });
    });

    const counts = {
      published: 0,
      draft: 0,
      optional: 0,
      hidden: 0,
      events: 0,
    };

    seenZmanim.forEach((zman) => {
      // Count event zmanim separately (candle lighting, havdalah, etc.)
      if (zman.is_event_zman) {
        counts.events++;
        return; // Don't double-count event zmanim in other categories
      }

      // Count by publication status
      if (!zman.is_enabled) {
        counts.hidden++;
      } else if (zman.is_published) {
        counts.published++;
      } else if (zman.is_beta) {
        counts.draft++;
      } else {
        // Non-published, non-beta, enabled - could be optional
        counts.optional++;
      }
    });

    return counts;
  }, [weekData]);

  // Navigation handlers
  const prevWeek = () => setSelectedDate(d => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; });
  const nextWeek = () => setSelectedDate(d => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; });
  const goToToday = () => setSelectedDate(new Date());
  const handleMonthChange = (month: number) => setSelectedDate(d => { const n = new Date(d); n.setMonth(month); return n; });
  const handleYearChange = (year: number) => setSelectedDate(d => { const n = new Date(d); n.setFullYear(year); return n; });

  // Scroll navigation
  const scrollToDay = (index: number) => {
    if (index >= 0 && index < weekData.length && dayRefs.current[index]) {
      dayRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentDayIndex(index);
    }
  };

  // Hebrew week range for header
  const hebrewWeekRange = useMemo(() => {
    if (weekData.length === 0 || !weekData[0].hebrewDate || !weekData[6]?.hebrewDate) return null;
    const start = weekData[0].hebrewDate;
    const end = weekData[6].hebrewDate;
    const startDay = toHebrewNumerals(start.day);
    const endDay = toHebrewNumerals(end.day);

    if (start.month === end.month && start.year === end.year) {
      return `${startDay}-${endDay} ${getHebrewMonthName(start.month)} ${toHebrewYear(start.year)}`;
    }
    return `${startDay} ${getHebrewMonthName(start.month)} - ${endDay} ${getHebrewMonthName(end.month)} ${toHebrewYear(end.year)}`;
  }, [weekData]);

  const error = queryError ? 'Failed to load week data' : null;

  return (
    <div data-testid="week-preview" className="space-y-4">
      {/* Location display */}
      <div className="text-sm text-muted-foreground">{displayName}</div>

      {/* Date Navigation Header */}
      <div className="flex flex-col gap-3">
        {/* Date Pickers Row */}
        <div className="grid grid-cols-3 items-center">
          {/* English Year/Month pickers */}
          <div className="flex items-center gap-2 justify-start">
            <Select
              value={selectedDate.getFullYear().toString()}
              onValueChange={(value) => handleYearChange(parseInt(value))}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GREGORIAN_YEARS.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select
              value={selectedDate.getMonth().toString()}
              onValueChange={(value) => handleMonthChange(parseInt(value))}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((month, i) => <SelectItem key={month} value={i.toString()}>{month}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Navigation arrows */}
          <div className="flex items-center justify-center gap-2">
            <button onClick={prevWeek} disabled={isLoading} className="p-2 rounded-md border border-input bg-background hover:bg-muted disabled:opacity-50 transition-colors">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button onClick={nextWeek} disabled={isLoading} className="p-2 rounded-md border border-input bg-background hover:bg-muted disabled:opacity-50 transition-colors">
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          {/* Hebrew Year/Month pickers */}
          <div className="flex items-center gap-2 justify-end">
            {weekData[0]?.hebrewDate && (
              <>
                <Select
                  value={getHebrewMonthNum(weekData[0].hebrewDate.month).toString()}
                  onValueChange={(value) => handleHebrewDateChange(weekData[0].hebrewDate!.year, parseInt(value), 1)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-[100px] font-hebrew" dir="rtl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="font-hebrew" dir="rtl">
                    {HEBREW_MONTHS.map(m => <SelectItem key={m.num} value={m.num.toString()}>{m.heb}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select
                  value={weekData[0].hebrewDate.year.toString()}
                  onValueChange={(value) => handleHebrewDateChange(parseInt(value), getHebrewMonthNum(weekData[0].hebrewDate!.month), 1)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-[100px] font-hebrew" dir="rtl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="font-hebrew" dir="rtl">
                    {HEBREW_YEARS.map(year => <SelectItem key={year} value={year.toString()}>{toHebrewYear(year)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>

        {/* Date Range Display */}
        <div className="grid grid-cols-3 items-center px-1">
          <div className="text-sm font-medium text-foreground">
            {weekData.length > 0
              ? `${weekData[0].month} ${weekData[0].dayNumber} - ${weekData[6]?.month} ${weekData[6]?.dayNumber}, ${weekData[0].year}`
              : `${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`}
          </div>
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday} disabled={isLoading}>Today</Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCalendarDialogOpen(true)}
              disabled={isLoading || weekData.length === 0}
              title="Export printable weekly calendar as PDF"
            >
              <Printer className="h-4 w-4 mr-1" />
              Print Calendar
            </Button>
          </div>
          <div className="text-right font-hebrew" dir="rtl">
            {hebrewWeekRange && <div className="text-sm font-medium text-foreground">{hebrewWeekRange}</div>}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground py-2 px-3 bg-muted/20 rounded-md border border-border/50">
          <div className="flex items-center gap-1"><Eye className="h-3 w-3 text-green-400" /><span>Published</span></div>
          <div className="flex items-center gap-1"><EyeOff className="h-3 w-3" /><span>Draft</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded border border-primary bg-primary/20" /><span>Today</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded border border-purple-500 bg-purple-500/20" /><span>Yom Tov</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded border border-amber-500 bg-amber-500/20" /><span>Shabbat</span></div>
          <div className="flex items-center gap-1"><FlaskConical className="h-3 w-3 text-amber-500" /><span>Beta</span></div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8 text-muted-foreground">
          <div>Calculating zmanim for the week...</div>
        </div>
      )}

      {/* Error State */}
      {error && <div className="text-center py-8 text-destructive">{error}</div>}

      {/* Empty State */}
      {!isLoading && !error && weekData.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">Loading week data...</div>
      )}

      {/* Day Cards */}
      {!isLoading && !error && weekData.length > 0 && (
        <div className="space-y-4 relative">
          {weekData.map((day, index) => (
            <div
              key={day.date}
              ref={(el) => { dayRefs.current[index] = el; }}
              className={`rounded-lg border overflow-hidden ${
                isToday(day.date) ? 'border-primary'
                  : day.isYomTov ? 'border-purple-500/50'
                  : isShabbat(day.date) ? 'border-amber-500/50'
                  : isFriday(day.date) ? 'border-orange-500/30'
                  : 'border-border'
              }`}
            >
              {/* Day Header */}
              <div className={`px-4 py-3 ${
                isToday(day.date) ? 'bg-primary/10'
                  : day.isYomTov ? 'bg-purple-500/10'
                  : isShabbat(day.date) ? 'bg-amber-500/10'
                  : isFriday(day.date) ? 'bg-orange-500/10'
                  : 'bg-muted/50'
              }`}>
                <div className="flex items-center justify-between">
                  {/* English Date */}
                  <div className="flex items-center gap-3">
                    <div className={`text-3xl font-bold ${
                      isToday(day.date) ? 'text-primary'
                        : day.isYomTov ? 'text-purple-400'
                        : isShabbat(day.date) ? 'text-amber-400'
                        : 'text-foreground'
                    }`}>{day.dayNumber}</div>
                    <div>
                      <div className={`font-semibold ${
                        isToday(day.date) ? 'text-primary'
                          : day.isYomTov ? 'text-purple-400'
                          : isShabbat(day.date) ? 'text-amber-400'
                          : 'text-foreground'
                      }`}>{day.dayName}</div>
                      <div className="text-sm text-muted-foreground">{day.month} {day.year}</div>
                    </div>
                  </div>

                  {/* Hebrew Date */}
                  {day.hebrewDate && (
                    <div className="flex items-center gap-3" dir="rtl">
                      <div className={`text-3xl font-bold font-hebrew ${
                        isToday(day.date) ? 'text-primary'
                          : day.isYomTov ? 'text-purple-400'
                          : isShabbat(day.date) ? 'text-amber-400'
                          : 'text-foreground'
                      }`}>{toHebrewNumerals(day.hebrewDate.day)}</div>
                      <div className="text-right">
                        <div className={`font-semibold font-hebrew ${
                          isToday(day.date) ? 'text-primary'
                            : day.isYomTov ? 'text-purple-400'
                            : isShabbat(day.date) ? 'text-amber-400'
                            : 'text-foreground'
                        }`}>{getHebrewDayName(day.dayName)}</div>
                        <div className="text-sm text-muted-foreground font-hebrew">
                          {getHebrewMonthName(day.hebrewDate.month)} {toHebrewYear(day.hebrewDate.year)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Badges */}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {isToday(day.date) && <Badge variant="default" className="text-xs">Today</Badge>}
                    {isShabbat(day.date) && <Badge variant="solid" className="text-xs bg-orange-500 text-white border-orange-600"><Moon className="h-3 w-3 mr-1" />Shabbat</Badge>}
                    {isFriday(day.date) && !day.isYomTov && <Badge variant="solid" className="text-xs bg-orange-400 text-black border-orange-500"><Sun className="h-3 w-3 mr-1" />Erev Shabbat</Badge>}
                    {day.holidays.map((holiday, idx) => (
                      <Badge key={idx} variant="solid" className={`text-xs ${getHolidayBadgeClass(holiday.category)}`}>
                        {holiday.yomtov && <Star className="h-3 w-3 mr-1" />}{holiday.name}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-row-reverse flex-wrap items-center gap-2 justify-start">
                    {isToday(day.date) && <Badge variant="default" className="text-xs font-hebrew">היום</Badge>}
                    {isShabbat(day.date) && <Badge variant="solid" className="text-xs font-hebrew bg-orange-500 text-white border-orange-600">שבת</Badge>}
                    {isFriday(day.date) && !day.isYomTov && <Badge variant="solid" className="text-xs font-hebrew bg-orange-400 text-black border-orange-500">ערב שבת</Badge>}
                    {day.holidays.map((holiday, idx) => (
                      <Badge key={idx} variant="solid" className={`text-xs font-hebrew ${getHolidayBadgeClass(holiday.category)}`}>
                        {holiday.yomtov && <Star className="h-3 w-3 ml-1" />}{holiday.name_hebrew || holiday.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Zmanim List */}
              {day.zmanim.length > 0 ? (
                <div className="divide-y divide-border">
                  {day.zmanim.map((zman) => (
                    <div key={zman.zman_key} className="flex items-center justify-between px-4 py-2 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2">
                        {zman.is_published
                          ? <Eye className="h-3.5 w-3.5 text-green-400 shrink-0" />
                          : <EyeOff className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                        <span
                          className={`text-sm truncate max-w-[200px] ${useHebrew ? 'font-hebrew' : ''} ${zman.is_published ? 'text-foreground' : 'text-muted-foreground italic'}`}
                          title={useHebrew ? zman.hebrew_name : zman.english_name}
                        >
                          {(useHebrew ? zman.hebrew_name : zman.english_name) || zman.zman_key || '(unnamed)'}
                        </span>
                        {zman.is_beta && <FlaskConical className="h-3 w-3 text-amber-500 shrink-0" />}
                        {!zman.is_published && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-yellow-600 border-yellow-600/50 bg-yellow-500/10">Draft</Badge>}
                      </div>
                      <div className={`font-mono text-sm font-medium ${zman.time ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {(showSeconds ? zman.time : (zman.time_display || zman.time_rounded))
                          ? formatTimeTo12Hour(showSeconds ? zman.time! : (zman.time_display || zman.time_rounded)!, showSeconds)
                          : '--:--'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 text-sm text-muted-foreground">No zmanim to display for this day</div>
              )}
            </div>
          ))}

          {/* Scroll Navigation */}
          <div className="sticky bottom-0 left-0 right-0 flex justify-center gap-2 py-3 bg-linear-to-t from-background via-background to-transparent">
            <Button variant="outline" size="sm" onClick={() => scrollToDay(0)} disabled={currentDayIndex === 0} className="shadow-md">
              <ChevronUp className="h-4 w-4 mr-1" />Top
            </Button>
            <Button variant="outline" size="sm" onClick={() => scrollToDay(Math.max(0, currentDayIndex - 1))} disabled={currentDayIndex === 0} className="shadow-md">
              <ChevronUp className="h-4 w-4" />Prev
            </Button>
            <div className="flex items-center px-3 text-sm text-muted-foreground">
              {weekData[currentDayIndex]?.dayName.slice(0, 3)} ({currentDayIndex + 1}/7)
            </div>
            <Button variant="outline" size="sm" onClick={() => scrollToDay(Math.min(6, currentDayIndex + 1))} disabled={currentDayIndex >= 6} className="shadow-md">
              Next<ChevronDown className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => scrollToDay(6)} disabled={currentDayIndex >= 6} className="shadow-md">
              Bottom<ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Weekly Calendar Selection Dialog */}
      <WeeklyCalendarSelectionDialog
        open={calendarDialogOpen}
        onOpenChange={setCalendarDialogOpen}
        startDate={weekStartStr}
        localityId={parseInt(localityId, 10)}
        localityName={displayName}
        zmanimCounts={zmanimCounts}
      />
    </div>
  );
}
