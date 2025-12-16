'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApi } from '@/lib/api-client';
import { formatTimeTo12Hour } from '@/lib/utils/time-format';

interface ZmanConfig {
  method: string;
  params: Record<string, unknown>;
}

interface AlgorithmConfig {
  name: string;
  description?: string;
  zmanim: Record<string, ZmanConfig>;
}

interface DayZmanim {
  date: string;
  zmanim: Array<{
    key: string;
    name: string;
    time: string;
  }>;
}

export interface PreviewLocation {
  latitude: number;
  longitude: number;
  timezone: string;
  displayName: string;
}

interface MonthPreviewProps {
  configuration: AlgorithmConfig;
  location: PreviewLocation;
}

export function MonthPreview({ configuration, location }: MonthPreviewProps) {
  const api = useApi();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [monthData, setMonthData] = useState<DayZmanim[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayZmanim | null>(null);

  const loadMonth = useCallback(async () => {
    if (Object.keys(configuration.zmanim).length === 0) {
      setMonthData([]);
      return;
    }

    try {
      setLoading(true);
      const days: DayZmanim[] = [];

      // Get all days in the month
      const year = currentMonth.year;
      const month = currentMonth.month;
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      // Fetch zmanim for each day (we'll batch this in a real implementation)
      // For now, fetch a few key days to demonstrate
      const daysToFetch = [1, 7, 14, 21, daysInMonth];

      for (const day of daysToFetch) {
        const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        try {
          const data = await api.post<{ zmanim: Array<{ key: string; name: string; time: string }> }>('/publisher/algorithm/preview', {
            body: JSON.stringify({
              configuration,
              date,
              latitude: location.latitude,
              longitude: location.longitude,
              timezone: location.timezone,
            }),
          });

          days.push({
            date,
            zmanim: data?.zmanim || [],
          });
        } catch {
          // Skip failed days
        }
      }

      setMonthData(days);
    } catch (err) {
      console.error('Failed to load month data:', err);
    } finally {
      setLoading(false);
    }
  }, [api, currentMonth, configuration, location]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  const prevMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const nextMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i);

  // Generate calendar grid
  const firstDayOfMonth = new Date(currentMonth.year, currentMonth.month, 1).getDay();
  const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
  const calendarDays: (number | null)[] = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }

  // Add days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  return (
    <div data-testid="month-preview">
      {/* Month/Year Selector */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous month</TooltipContent>
          </Tooltip>

          {/* Month Selector */}
          <Select
            value={currentMonth.month.toString()}
            onValueChange={(value) => setCurrentMonth(prev => ({ ...prev, month: parseInt(value) }))}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, index) => (
                <SelectItem key={month} value={index.toString()}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Year Selector */}
          <Select
            value={currentMonth.year.toString()}
            onValueChange={(value) => setCurrentMonth(prev => ({ ...prev, year: parseInt(value) }))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next month</TooltipContent>
          </Tooltip>
        </div>

        <span className="text-xs text-muted-foreground">
          {location.displayName}
        </span>
      </div>

      <div>
        {loading && (
          <div className="text-center py-8 text-muted-foreground">
            Loading month data...
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs text-muted-foreground py-2">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="p-2" />;
              }

              const dateStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayData = monthData.find(d => d.date === dateStr);
              const hasData = !!dayData;

              return (
                <div
                  key={day}
                  className={`p-2 text-center rounded cursor-pointer transition-colors ${
                    hasData
                      ? 'bg-primary/20 hover:bg-primary/30 text-foreground'
                      : 'bg-card hover:bg-muted text-muted-foreground'
                  } ${selectedDay?.date === dateStr ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => dayData && setSelectedDay(dayData)}
                >
                  <span className="text-sm">{day}</span>
                  {hasData && (
                    <div className="text-xs text-primary mt-1">
                      {dayData.zmanim.length} zmanim
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Selected day details */}
        {selectedDay && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-medium text-foreground mb-3">
              {new Date(selectedDay.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </h4>
            <div className="space-y-2">
              {selectedDay.zmanim.map(zman => (
                <div key={zman.key} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{zman.name}</span>
                  <span className="font-mono text-primary">{formatTimeTo12Hour(zman.time, false)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4">
          Note: Preview shows sample days. Full month data available after save.
        </p>
      </div>
    </div>
  );
}
