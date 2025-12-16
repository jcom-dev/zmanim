import { cn } from '@/lib/utils';
import { ColorBadge, type ColorBadgeColor } from '@/components/ui/color-badge';

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

interface ZmanTime {
  key: string;
  name: string;
  name_hebrew?: string;
  time: string;
}

interface DayColumnProps {
  day: DayInfo;
  zmanim: ZmanTime[];
  isToday: boolean;
}

function formatDayOfMonth(date: string): string {
  return new Date(date + 'T12:00:00').getDate().toString();
}

function formatDayOfWeek(date: string): string {
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function getBadgeColor(category: string): ColorBadgeColor {
  switch (category) {
    case 'major':
      return 'amber';
    case 'fast':
      return 'slate';
    case 'roshchodesh':
      return 'blue';
    case 'shabbat':
      return 'purple';
    default:
      return 'slate';
  }
}

export function DayColumn({ day, zmanim, isToday }: DayColumnProps) {
  return (
    <div
      className={cn(
        'day-column border rounded-lg p-3 min-w-[140px] transition-colors',
        isToday && 'ring-2 ring-primary ring-offset-2',
        day.is_shabbat && 'bg-amber-50/50 dark:bg-amber-900/10',
        day.is_yomtov && 'bg-purple-50/50 dark:bg-purple-900/10'
      )}
    >
      {/* Date header */}
      <div className="text-center mb-3 space-y-1">
        {/* English day */}
        <div className="text-xs text-muted-foreground uppercase tracking-wide">
          {formatDayOfWeek(day.date)}
        </div>

        {/* Day number */}
        <div className={cn(
          'text-2xl font-semibold',
          isToday && 'text-primary'
        )}>
          {formatDayOfMonth(day.date)}
        </div>

        {/* Hebrew date */}
        <div
          className="text-sm font-medium text-muted-foreground"
          dir="rtl"
        >
          {day.hebrew_date.hebrew}
        </div>

        {/* Hebrew day name */}
        <div
          className="text-xs text-muted-foreground"
          dir="rtl"
        >
          {day.day_name_hebrew}
        </div>
      </div>

      {/* Holiday badges */}
      {day.holidays.length > 0 && (
        <div className="space-y-1 mb-3">
          {day.holidays.slice(0, 3).map((holiday, idx) => (
            <ColorBadge
              key={`${holiday.name}-${idx}`}
              color={getBadgeColor(holiday.category)}
              size="xs"
              className="w-full justify-center truncate"
              title={`${holiday.name} - ${holiday.name_hebrew}`}
            >
              <span dir="rtl">{holiday.name_hebrew}</span>
            </ColorBadge>
          ))}
          {day.holidays.length > 3 && (
            <div className="text-xs text-center text-muted-foreground">
              +{day.holidays.length - 3} more
            </div>
          )}
        </div>
      )}

      {/* Zmanim list */}
      {zmanim.length > 0 && (
        <div className="space-y-1 pt-2 border-t">
          {zmanim.map((zman) => (
            <div
              key={zman.key}
              className="flex justify-between items-center text-xs gap-2"
            >
              <span className="truncate text-muted-foreground">
                {zman.name}
              </span>
              <span className="font-mono text-foreground shrink-0">
                {zman.time}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Special indicators */}
      {day.is_shabbat && (
        <div className="mt-2 pt-2 border-t text-center">
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Shabbat
          </span>
        </div>
      )}
    </div>
  );
}
