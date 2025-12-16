/**
 * @file time-format.ts
 * @purpose Time formatting utilities for zmanim display with seconds toggle and rounding options
 * @pattern utility-functions
 * @dependencies luxon
 * @frequency critical - used across all time displays
 * @compliance Story 8-34 - Seconds Display Toggle with Rounding Options
 */

import { DateTime } from 'luxon';
import type { RoundingMode } from '@/lib/contexts/PreferencesContext';

/**
 * Format a zman time with optional seconds display
 *
 * DEPRECATED: Use API-provided time_display field instead of client-side formatting.
 * Rounding logic has been centralized in the backend (unified_zmanim_service.go).
 *
 * @param time - DateTime object from luxon
 * @param showSeconds - Whether to show seconds (default: false)
 * @param roundingMode - DEPRECATED: Rounding is now done by the backend
 * @returns Formatted time string in 12-hour format (h:mm:ss AM/PM or h:mm AM/PM)
 *
 * @example
 * const time = DateTime.fromISO('2024-01-01T10:15:45');
 * formatZmanTime(time, true)   // "10:15:45 AM"
 * formatZmanTime(time, false)  // "10:15 AM"
 */
export function formatZmanTime(
  time: DateTime,
  showSeconds: boolean = false,
  roundingMode: RoundingMode = 'math' // eslint-disable-line @typescript-eslint/no-unused-vars
): string {
  // If showing seconds, return time with seconds in 12-hour format
  if (showSeconds) {
    return time.toFormat('h:mm:ss a');
  }

  // Format without seconds - NO ROUNDING (backend handles this)
  return time.toFormat('h:mm a');
}

/**
 * Format a time string (HH:mm:ss) from API with optional seconds display
 *
 * DEPRECATED: Use API-provided time_display field instead of client-side formatting.
 * Rounding logic has been centralized in the backend (unified_zmanim_service.go).
 *
 * @param timeStr - Time string in HH:mm:ss or HH:mm format
 * @param showSeconds - Whether to show seconds
 * @param roundingMode - DEPRECATED: Rounding is now done by the backend
 * @returns Formatted time string in 12-hour format with AM/PM
 *
 * @example
 * formatTimeString('10:15:45', true)  // "10:15:45 AM"
 * formatTimeString('10:15:45', false) // "10:15 AM"
 * formatTimeString('13:15:00', false) // "1:15 PM"
 */
export function formatTimeString(
  timeStr: string,
  showSeconds: boolean = false,
  roundingMode: RoundingMode = 'math' // eslint-disable-line @typescript-eslint/no-unused-vars
): string {
  try {
    // Parse HH:mm:ss format
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);

    // If showing seconds, return 12-hour format with seconds
    if (showSeconds) {
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${period}`;
    }

    // Convert to 12-hour format with AM/PM - NO ROUNDING (backend handles this)
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  } catch {
    // If parsing fails, return original
    return timeStr;
  }
}

/**
 * Format a time string (HH:mm:ss) to 12-hour format, with optional seconds display
 * Does NOT apply any rounding - just format conversion
 *
 * @param timeStr - Time string in HH:mm:ss format
 * @param showSeconds - Whether to show seconds in output
 * @returns Formatted time string in 12-hour format with AM/PM
 *
 * @example
 * formatTimeTo12Hour('10:15:45', true)  // "10:15:45 AM"
 * formatTimeTo12Hour('10:15:45', false) // "10:15 AM"
 * formatTimeTo12Hour('13:30:00', false) // "1:30 PM"
 */
export function formatTimeTo12Hour(timeStr: string, showSeconds: boolean = false): string {
  try {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    if (showSeconds) {
      return `${displayHours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${period}`;
    }

    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  } catch {
    return timeStr;
  }
}

/**
 * Apply rounding to a time string based on rounding mode
 * Used when updating rounding mode client-side without refetching from API
 *
 * @param exactTime - Exact time string with seconds (HH:mm:ss)
 * @param roundingMode - Rounding mode: 'floor', 'math', or 'ceil'
 * @returns Rounded time string in HH:mm:ss format (with :00 seconds)
 *
 * @example
 * applyTimeRounding('10:15:45', 'floor') // "10:15:00"
 * applyTimeRounding('10:15:45', 'math')  // "10:16:00" (>=30 rounds up)
 * applyTimeRounding('10:15:29', 'math')  // "10:15:00" (<30 rounds down)
 * applyTimeRounding('10:15:01', 'ceil')  // "10:16:00"
 */
export function applyTimeRounding(exactTime: string, roundingMode: RoundingMode): string {
  try {
    const [hours, minutes, seconds] = exactTime.split(':').map(Number);

    let roundedMinutes = minutes;

    switch (roundingMode) {
      case 'floor':
        // Always round down - keep current minute
        roundedMinutes = minutes;
        break;
      case 'ceil':
        // Round up if any seconds
        if (seconds > 0) {
          roundedMinutes = minutes + 1;
        }
        break;
      case 'math':
      default:
        // Standard rounding: >=30 rounds up, <30 rounds down
        if (seconds >= 30) {
          roundedMinutes = minutes + 1;
        }
        break;
    }

    // Handle minute overflow
    let finalHours = hours;
    if (roundedMinutes >= 60) {
      roundedMinutes = 0;
      finalHours = (hours + 1) % 24;
    }

    return `${String(finalHours).padStart(2, '0')}:${String(roundedMinutes).padStart(2, '0')}:00`;
  } catch {
    return exactTime;
  }
}

