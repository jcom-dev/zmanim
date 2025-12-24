/**
 * @file DatePickerDropdown.tsx
 * @purpose Date range picker - Hebrew calendar integration
 * @pattern client-component
 * @dependencies Calendar (shadcn), date-fns, Hebrew date conversion
 * @frequency medium - 489 lines
 * @compliance Check docs/adr/ for pattern rationale
 */

'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { DateTime } from 'luxon';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  toHebrewDate,
  getHebrewMonthsForYear,
  generateHebrewYearRange,
  getHebrewMonthStartDate,
} from '@/lib/hebrew-date';

interface DatePickerDropdownProps {
  selectedDate: DateTime;
  onDateChange: (date: DateTime) => void;
  showHebrew: boolean;
  className?: string;
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NAMES_HEBREW = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Generate years range (current year -10 to +10)
const generateYears = () => {
  const currentYear = DateTime.now().year;
  const years: number[] = [];
  for (let i = currentYear - 10; i <= currentYear + 10; i++) {
    years.push(i);
  }
  return years;
};

export function DatePickerDropdown({
  selectedDate,
  onDateChange,
  showHebrew,
  className,
}: DatePickerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(selectedDate);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [showMonthSelect, setShowMonthSelect] = useState(false);
  const [showYearSelect, setShowYearSelect] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const yearListRef = useRef<HTMLDivElement>(null);

  const gregorianYears = generateYears();

  // Get Hebrew date info for the view date
  const viewHebrewDate = useMemo(() => toHebrewDate(viewDate.toJSDate()), [viewDate]);

  // Get Hebrew months for the current Hebrew year
  const hebrewMonths = useMemo(
    () => getHebrewMonthsForYear(viewHebrewDate.year),
    [viewHebrewDate.year]
  );

  // Get Hebrew years range
  const hebrewYears = useMemo(
    () => generateHebrewYearRange(viewHebrewDate.year, 10),
    [viewHebrewDate.year]
  );

  // Calculate dropdown position based on trigger button
  const updateDropdownPosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8, // 8px gap
        left: rect.left + rect.width / 2, // Center aligned
      });
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
        setShowMonthSelect(false);
        setShowYearSelect(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update position when opening or on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    updateDropdownPosition();

    // Store the function reference to ensure proper cleanup
    const scrollHandler = updateDropdownPosition;
    const resizeHandler = updateDropdownPosition;

    window.addEventListener('scroll', scrollHandler, true);
    window.addEventListener('resize', resizeHandler);

    return () => {
      window.removeEventListener('scroll', scrollHandler, true);
      window.removeEventListener('resize', resizeHandler);
    };
  }, [isOpen, updateDropdownPosition]);

  // Scroll to current year when year select opens
  useEffect(() => {
    if (showYearSelect && yearListRef.current) {
      const currentYearElement = yearListRef.current.querySelector('[data-current="true"]');
      if (currentYearElement) {
        currentYearElement.scrollIntoView({ block: 'center' });
      }
    }
  }, [showYearSelect]);

  // Update view date when selected date changes
  useEffect(() => {
    setViewDate(selectedDate);
  }, [selectedDate]);

  const hebrewDate = toHebrewDate(selectedDate.toJSDate());

  // Get calendar days for the current view month
  const getCalendarDays = () => {
    const firstDayOfMonth = viewDate.startOf('month');
    const lastDayOfMonth = viewDate.endOf('month');
    const startDay = firstDayOfMonth.weekday % 7; // 0 = Sunday
    const daysInMonth = lastDayOfMonth.day;

    const days: (DateTime | null)[] = [];

    // Add empty slots for days before the first of the month
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // Add the days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(viewDate.set({ day: i }));
    }

    return days;
  };

  const handlePrevMonth = () => {
    setViewDate(viewDate.minus({ months: 1 }));
  };

  const handleNextMonth = () => {
    setViewDate(viewDate.plus({ months: 1 }));
  };

  const handleSelectDate = (date: DateTime) => {
    onDateChange(date);
    setIsOpen(false);
  };

  // Gregorian month selection
  const handleSelectMonth = (monthIndex: number) => {
    setViewDate(viewDate.set({ month: monthIndex + 1 }));
    setShowMonthSelect(false);
  };

  // Gregorian year selection
  const handleSelectYear = (year: number) => {
    setViewDate(viewDate.set({ year }));
    setShowYearSelect(false);
  };

  // Hebrew month selection - navigate to the first day of that Hebrew month
  const handleSelectHebrewMonth = (hebrewMonth: number) => {
    const gregDate = getHebrewMonthStartDate(viewHebrewDate.year, hebrewMonth);
    setViewDate(DateTime.fromJSDate(gregDate));
    setShowMonthSelect(false);
  };

  // Hebrew year selection - navigate to same Hebrew month in new year
  const handleSelectHebrewYear = (hebrewYear: number) => {
    // Try to keep the same Hebrew month, fallback to Tishrei if month doesn't exist
    const monthsInNewYear = getHebrewMonthsForYear(hebrewYear);
    const targetMonth = monthsInNewYear.find(m => m.month === viewHebrewDate.month)
      ? viewHebrewDate.month
      : monthsInNewYear[0].month;

    const gregDate = getHebrewMonthStartDate(hebrewYear, targetMonth);
    setViewDate(DateTime.fromJSDate(gregDate));
    setShowYearSelect(false);
  };

  const handleToday = () => {
    const today = DateTime.now();
    onDateChange(today);
    setViewDate(today);
    setIsOpen(false);
  };

  const calendarDays = getCalendarDays();
  const weekdays = showHebrew ? WEEKDAY_NAMES_HEBREW : WEEKDAY_NAMES;

  const dropdownContent = isOpen ? (
    <div
      ref={dropdownRef}
      className="fixed w-[320px] bg-card rounded-xl shadow-2xl border border-border overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        transform: 'translateX(-50%)',
        zIndex: 9999,
      }}
    >
      {/* Month Navigation */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-accent rounded-full transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className={cn("flex items-center gap-1", showHebrew && "flex-row-reverse")}>
          {/* Month Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowMonthSelect(!showMonthSelect);
                setShowYearSelect(false);
              }}
              className="px-2 py-1 hover:bg-accent rounded-lg transition-colors flex items-center gap-1"
              dir={showHebrew ? 'rtl' : 'ltr'}
            >
              <span className={cn(
                "font-semibold text-foreground",
                showHebrew && "font-hebrew"
              )}>
                {showHebrew ? viewHebrewDate.monthHebrew : viewDate.toFormat('MMMM')}
              </span>
              <ChevronDown className={cn(
                'w-3 h-3 text-muted-foreground transition-transform',
                showMonthSelect && 'rotate-180'
              )} />
            </button>

            {/* Month Dropdown */}
            {showMonthSelect && (
              <div
                className="absolute top-full left-0 mt-1 w-36 max-h-48 overflow-y-auto bg-popover rounded-lg shadow-lg border border-border z-10"
                dir={showHebrew ? 'rtl' : 'ltr'}
              >
                {showHebrew ? (
                  // Hebrew months
                  hebrewMonths.map(({ month, name }) => (
                    <button
                      key={month}
                      onClick={() => handleSelectHebrewMonth(month)}
                      className={cn(
                        'w-full px-3 py-2 text-right text-sm hover:bg-accent transition-colors font-hebrew',
                        viewHebrewDate.month === month && 'bg-primary/10 text-primary font-medium'
                      )}
                    >
                      {name}
                    </button>
                  ))
                ) : (
                  // Gregorian months
                  MONTHS.map((month, idx) => (
                    <button
                      key={month}
                      onClick={() => handleSelectMonth(idx)}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors',
                        viewDate.month === idx + 1 && 'bg-primary/10 text-primary font-medium'
                      )}
                    >
                      {month}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Year Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowYearSelect(!showYearSelect);
                setShowMonthSelect(false);
              }}
              className="px-2 py-1 hover:bg-accent rounded-lg transition-colors flex items-center gap-1"
              dir={showHebrew ? 'rtl' : 'ltr'}
            >
              <span className={cn(
                "font-semibold text-foreground",
                showHebrew && "font-hebrew"
              )}>
                {showHebrew ? viewHebrewDate.yearHebrew : viewDate.toFormat('yyyy')}
              </span>
              <ChevronDown className={cn(
                'w-3 h-3 text-muted-foreground transition-transform',
                showYearSelect && 'rotate-180'
              )} />
            </button>

            {/* Year Dropdown */}
            {showYearSelect && (
              <div
                ref={yearListRef}
                className={cn(
                  "absolute top-full mt-1 max-h-48 overflow-y-auto bg-popover rounded-lg shadow-lg border border-border z-10",
                  showHebrew ? "right-0 w-28" : "right-0 w-24"
                )}
                dir={showHebrew ? 'rtl' : 'ltr'}
              >
                {showHebrew ? (
                  // Hebrew years
                  hebrewYears.map(({ year, display }) => (
                    <button
                      key={year}
                      data-current={viewHebrewDate.year === year}
                      onClick={() => handleSelectHebrewYear(year)}
                      className={cn(
                        'w-full px-3 py-2 text-right text-sm hover:bg-accent transition-colors font-hebrew',
                        viewHebrewDate.year === year && 'bg-primary/10 text-primary font-medium'
                      )}
                    >
                      {display}
                    </button>
                  ))
                ) : (
                  // Gregorian years
                  gregorianYears.map((year) => (
                    <button
                      key={year}
                      data-current={viewDate.year === year}
                      onClick={() => handleSelectYear(year)}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors',
                        viewDate.year === year && 'bg-primary/10 text-primary font-medium'
                      )}
                    >
                      {year}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-accent rounded-full transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Secondary date display (Gregorian when Hebrew mode, Hebrew when Gregorian mode) */}
      <div className="px-3 py-1.5 text-center border-b border-border bg-muted/50">
        {showHebrew ? (
          <span className="text-xs text-muted-foreground">
            {viewDate.toFormat('MMMM yyyy')}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground font-hebrew" dir="rtl">
            {viewHebrewDate.monthHebrew} {viewHebrewDate.yearHebrew}
          </span>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="p-3">
        {/* Weekday Headers */}
        <div className={cn(
          'grid grid-cols-7 mb-2',
          showHebrew && 'direction-rtl'
        )} dir={showHebrew ? 'rtl' : 'ltr'}>
          {weekdays.map((day, i) => (
            <div
              key={i}
              className="text-center text-xs font-medium text-muted-foreground py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className={cn(
          'grid grid-cols-7 gap-1',
          showHebrew && 'direction-rtl'
        )} dir={showHebrew ? 'rtl' : 'ltr'}>
          {calendarDays.map((day, i) => {
            if (!day) {
              return <div key={`empty-${i}`} className="h-9" />;
            }

            const isSelected = day.hasSame(selectedDate, 'day');
            const isToday = day.hasSame(DateTime.now(), 'day');
            const dayHebrewInfo = showHebrew ? toHebrewDate(day.toJSDate()) : null;

            return (
              <button
                key={day.toISODate()}
                onClick={() => handleSelectDate(day)}
                className={cn(
                  'h-9 flex flex-col items-center justify-center rounded-lg text-sm transition-all',
                  'hover:bg-primary/10',
                  isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                  isToday && !isSelected && 'ring-2 ring-primary ring-inset',
                  !isSelected && 'text-foreground'
                )}
              >
                {showHebrew ? (
                  <>
                    <span className="text-[10px] leading-none opacity-60">{day.day}</span>
                    <span className="text-xs font-hebrew leading-none">{dayHebrewInfo?.dayHebrew}</span>
                  </>
                ) : (
                  <span>{day.day}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer with Today button */}
      <div className="p-2 border-t border-border bg-muted flex justify-center">
        <button
          onClick={handleToday}
          className="px-4 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
        >
          {showHebrew ? 'היום' : 'Today'}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors group"
      >
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <div className="text-center">
          {showHebrew ? (
            <span className="text-base sm:text-lg font-semibold text-foreground font-hebrew" dir="rtl">
              {hebrewDate.formatted}
            </span>
          ) : (
            <span className="text-base sm:text-lg font-semibold text-foreground">
              {selectedDate.toFormat('EEEE, MMMM d, yyyy')}
            </span>
          )}
        </div>
        <ChevronDown className={cn(
          'w-4 h-4 text-muted-foreground transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Portal the dropdown to body to escape stacking context */}
      {typeof document !== 'undefined' && createPortal(dropdownContent, document.body)}
    </div>
  );
}

export default DatePickerDropdown;
