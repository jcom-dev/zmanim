import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format time string to 12-hour AM/PM format with seconds
 * @param time - Time string in HH:MM:SS or HH:MM format
 * @returns Formatted time like "2:30:36 PM"
 */
export function formatTime(time: string): string {
  if (!time || !time.includes(':')) return '--:--';
  const [hours, minutes, seconds] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return '--:--';
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;

  if (seconds !== undefined && !isNaN(seconds)) {
    return `${hour12}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${period}`;
  }
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format time string to 12-hour AM/PM format without seconds
 *
 * Note: This function strips seconds without rounding.
 * For properly rounded display times, prefer the API-provided
 * `time_display` field which applies the publisher's rounding mode.
 *
 * Backend centralization: All rounding logic is in
 * api/internal/services/unified_zmanim_service.go
 *
 * @param time - Time string in HH:MM:SS or HH:MM format
 * @returns Formatted time like "2:30 PM"
 */
export function formatTimeShort(time: string): string {
  if (!time || !time.includes(':')) return '--:--';
  const [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return '--:--';
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Check if text contains significant Hebrew characters
 * Returns true if more than 30% of alphabetic chars are Hebrew
 */
export function isHebrewText(text: string): boolean {
  if (!text) return false;
  const hebrewChars = text.match(/[\u0590-\u05FF]/g)?.length || 0;
  const latinChars = text.match(/[a-zA-Z]/g)?.length || 0;
  const totalAlpha = hebrewChars + latinChars;
  if (totalAlpha === 0) return false;
  return hebrewChars / totalAlpha > 0.3;
}
