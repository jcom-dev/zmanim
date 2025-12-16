import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { DayColumn } from './DayColumn';
import { useApi } from '@/lib/api-client';

interface HebrewDate {
  day: number;
  month: string;
  month_num: number;
  year: number;
  hebrew: string;
  formatted: string;
}

interface Holiday {
  name: string;
  name_hebrew: string;
  category: string;
  candles: boolean;
  yomtov: boolean;
}

interface DayInfo {
  date: string;
  hebrew_date: HebrewDate;
  day_of_week: number;
  day_name_hebrew: string;
  day_name_eng: string;
  holidays: Holiday[];
  is_shabbat: boolean;
  is_yomtov: boolean;
}

interface WeekData {
  start_date: string;
  end_date: string;
  days: DayInfo[];
}

interface ZmanTime {
  key: string;
  name: string;
  name_hebrew?: string;
  time: string;
}

interface WeeklyPreviewProps {
  publisherId?: string;
  locationId?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  zmanim?: Record<string, ZmanTime[]>;
  className?: string;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getWeekStart(date: Date): Date {
  const day = date.getDay();
  return addDays(date, -day);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateRange(start: Date, end: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', options);
  const endStr = end.toLocaleDateString('en-US', { ...options, year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

function isToday(dateStr: string): boolean {
  return dateStr === formatDate(new Date());
}

export function WeeklyPreview({
  zmanim = {},
  className = '',
}: WeeklyPreviewProps) {
  const api = useApi();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch week data when weekStart changes
  const fetchWeekData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const dateStr = formatDate(weekStart);
      const data = await api.public.get<WeekData>(`/calendar/week?date=${dateStr}`);
      setWeekData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [api, weekStart]);

  // Fetch when weekStart changes
  useEffect(() => {
    fetchWeekData();
  }, [fetchWeekData]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const days = direction === 'prev' ? -7 : 7;
    setWeekStart(prev => addDays(prev, days));
  };

  const goToToday = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  const handlePrint = () => {
    window.print();
  };

  const weekEnd = addDays(weekStart, 6);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with navigation */}
      <div className="flex items-center justify-between print:hidden">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigateWeek('prev')}
          aria-label="Previous week"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-4">
          <h3 className="text-lg font-medium">
            {formatDateRange(weekStart, weekEnd)}
          </h3>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateWeek('next')}
            aria-label="Next week"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrint}
            aria-label="Print week"
          >
            <PrinterIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-8">
          <LoaderIcon className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="alert-error text-center">
          <p className="alert-error-text">{error}</p>
          <Button variant="link" onClick={fetchWeekData} className="mt-2">
            Retry
          </Button>
        </div>
      )}

      {/* Days grid */}
      {weekData && !loading && (
        <div className="weekly-preview grid grid-cols-7 gap-2 lg:grid-cols-7 md:grid-cols-5 sm:grid-cols-3 overflow-x-auto print:grid-cols-7 print:gap-1">
          {weekData.days.map((day) => (
            <DayColumn
              key={day.date}
              day={day}
              zmanim={zmanim[day.date] || []}
              isToday={isToday(day.date)}
            />
          ))}
        </div>
      )}

      {/* Print stylesheet is handled by global CSS */}
    </div>
  );
}

// Icon components
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6"/>
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}

function PrinterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"/>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
      <rect width="12" height="8" x="6" y="14"/>
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}
