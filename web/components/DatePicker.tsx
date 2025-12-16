/**
 * @file DatePicker.tsx
 * @description Date selection component for zmanim calculations
 * @module components
 *
 * Provides a date input with:
 * - Native date picker
 * - "Today" quick action button
 * - Formatted display of selected date (weekday, month, day, year)
 *
 * @example
 * ```tsx
 * <DatePicker onDateChange={(date) => setSelectedDate(date)} />
 * ```
 */
'use client';

import { useState } from 'react';
import { DateTime } from 'luxon';

/**
 * Props for the DatePicker component
 */
interface DatePickerProps {
  /** Callback fired when the date changes */
  onDateChange: (date: DateTime) => void;
}

export default function DatePicker({ onDateChange }: DatePickerProps) {
  const [selectedDate, setSelectedDate] = useState(
    DateTime.now().toISODate() || ''
  );

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = e.target.value;
    setSelectedDate(dateString);

    const date = DateTime.fromISO(dateString);
    if (date.isValid) {
      onDateChange(date);
    }
  };

  const handleToday = () => {
    const today = DateTime.now();
    setSelectedDate(today.toISODate() || '');
    onDateChange(today);
  };

  const formatDisplayDate = (): string => {
    const date = DateTime.fromISO(selectedDate);
    if (!date.isValid) return '';

    return date.toLocaleString({
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-card rounded-2xl shadow-apple p-6 md:p-8 border border-border">
      <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center">
        <svg
          className="w-5 h-5 mr-2 text-apple-blue"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        Date
      </h2>

      <div className="space-y-4">
        {/* Date Input */}
        <div>
          <label
            htmlFor="date"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Select Date
          </label>
          <input
            id="date"
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="
              w-full px-4 py-2.5 rounded-xl
              border border-border
              focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20
              transition-all duration-200 outline-hidden
              text-foreground font-normal text-[15px]
              bg-card
            "
          />
        </div>

        {/* Display formatted date */}
        <div className="bg-muted rounded-xl p-4 border border-border">
          <p className="text-xs text-muted-foreground mb-1 font-medium">Selected Date</p>
          <p className="text-base font-medium text-foreground">
            {formatDisplayDate()}
          </p>
        </div>

        {/* Quick action button */}
        <button
          type="button"
          onClick={handleToday}
          className="
            w-full bg-apple-blue hover:bg-apple-blue/90
            text-white font-medium py-2.5 px-5 rounded-xl
            transition-all duration-200
            shadow-xs hover:shadow-md
            flex items-center justify-center
          "
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Today
        </button>
      </div>
    </div>
  );
}
