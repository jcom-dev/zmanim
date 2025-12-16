'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar,
  Loader2,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Star,
} from 'lucide-react';
import { cn, formatTime, formatTimeShort } from '@/lib/utils';
import { usePreviewWeek, type DayPreview, type PreviewLocation } from '@/lib/hooks/useZmanimList';

interface WeeklyPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formula: string;
  location: PreviewLocation;
  zmanName?: string;
}

// Helper to format date nicely
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Helper to get day of week
function getDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

// Month names for dropdown
const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Generate years for dropdown (current year -2 to +5)
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 8 }, (_, i) => currentYear - 2 + i);

// Get days in a month
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function WeeklyPreviewDialog({
  open,
  onOpenChange,
  formula,
  location,
  zmanName,
}: WeeklyPreviewDialogProps) {
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  );
  const [days, setDays] = useState<DayPreview[]>([]);

  const previewWeek = usePreviewWeek();

  // Fetch weekly preview when dialog opens or date changes
  const fetchPreview = useCallback(async () => {
    if (!formula.trim()) return;

    try {
      const result = await previewWeek.mutateAsync({
        formula,
        start_date: startDate,
        location,
      });
      setDays(result.days);
    } catch (err) {
      console.error('Failed to fetch weekly preview:', err);
      setDays([]);
    }
  }, [formula, startDate, location, previewWeek]);

  useEffect(() => {
    if (open && formula.trim()) {
      fetchPreview();
    }
  }, [open, startDate]);

  // Navigation helpers
  const goToPreviousWeek = () => {
    const date = new Date(startDate);
    date.setDate(date.getDate() - 7);
    setStartDate(date.toISOString().split('T')[0]);
  };

  const goToNextWeek = () => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + 7);
    setStartDate(date.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setStartDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Preview
            {zmanName && (
              <Badge variant="outline" className="ml-2">
                {zmanName}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Preview calculated times for the next 7 days at {location.displayName}
          </DialogDescription>
        </DialogHeader>

        {/* Date Navigation */}
        <div className="flex flex-col gap-3">
          {/* Navigation buttons row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Year / Month / Day Selectors */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
            {/* Year Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground font-medium">Year:</label>
              <Select
                value={new Date(startDate).getFullYear().toString()}
                onValueChange={(value) => {
                  const date = new Date(startDate);
                  date.setFullYear(parseInt(value));
                  // Adjust day if needed (e.g., Feb 29 -> Feb 28)
                  const maxDay = getDaysInMonth(parseInt(value), date.getMonth());
                  if (date.getDate() > maxDay) date.setDate(maxDay);
                  setStartDate(date.toISOString().split('T')[0]);
                }}
              >
                <SelectTrigger className="min-w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground font-medium">Month:</label>
              <Select
                value={new Date(startDate).getMonth().toString()}
                onValueChange={(value) => {
                  const date = new Date(startDate);
                  const newMonth = parseInt(value);
                  // Adjust day if needed
                  const maxDay = getDaysInMonth(date.getFullYear(), newMonth);
                  if (date.getDate() > maxDay) date.setDate(maxDay);
                  date.setMonth(newMonth);
                  setStartDate(date.toISOString().split('T')[0]);
                }}
              >
                <SelectTrigger className="min-w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, index) => (
                    <SelectItem key={month} value={index.toString()}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Day Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground font-medium">Day:</label>
              <Select
                value={new Date(startDate).getDate().toString()}
                onValueChange={(value) => {
                  const date = new Date(startDate);
                  date.setDate(parseInt(value));
                  setStartDate(date.toISOString().split('T')[0]);
                }}
              >
                <SelectTrigger className="min-w-[60px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(
                    { length: getDaysInMonth(new Date(startDate).getFullYear(), new Date(startDate).getMonth()) },
                    (_, i) => i + 1
                  ).map((day) => (
                    <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Legend - Always visible at top */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground py-2 border-b">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border border-primary/50 bg-primary/10" />
            <span>Shabbat</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border border-amber-500/50 bg-amber-50 dark:bg-amber-950" />
            <span>Yom Tov</span>
          </div>
          <div className="flex items-center gap-1">
            <Sun className="h-3 w-3 text-amber-500" />
            <span>Sunrise</span>
          </div>
          <div className="flex items-center gap-1">
            <Moon className="h-3 w-3 text-blue-500" />
            <span>Sunset</span>
          </div>
        </div>

        {/* Weekly Grid with Scroll */}
        <div className="flex-1 h-[400px] overflow-y-auto">
          {previewWeek.isPending ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : days.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {formula.trim()
                ? 'Failed to calculate preview. Check the formula for errors.'
                : 'Enter a formula to see the weekly preview.'}
            </div>
          ) : (
            <div className="space-y-3">
              {days.map((day, i) => (
                <Card
                  key={i}
                  className={cn(
                    'transition-colors',
                    day.is_shabbat && 'border-primary/50 bg-primary/5',
                    day.is_yom_tov && 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20'
                  )}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      {/* Left: Date Info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{getDayOfWeek(day.date)}</span>
                          <span className="text-muted-foreground">{formatDate(day.date)}</span>
                        </div>
                        <div className="text-sm font-hebrew text-muted-foreground">
                          {day.hebrew_date}
                        </div>
                        {day.events.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {day.events.map((event, j) => (
                              <Badge
                                key={j}
                                variant={day.is_yom_tov ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {day.is_yom_tov && <Star className="h-3 w-3 mr-1" />}
                                {event}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Calculated Time */}
                      <div className="text-right">
                        <div className="text-3xl font-bold font-mono">
                          {formatTime(day.result)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Sun className="h-3 w-3 text-amber-500" />
                            {formatTimeShort(day.sunrise)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Moon className="h-3 w-3 text-blue-500" />
                            {formatTimeShort(day.sunset)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WeeklyPreviewDialog;
