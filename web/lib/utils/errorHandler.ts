/**
 * @file errorHandler.ts
 * @purpose Standardized error handling utility for API errors
 * @pattern utility
 * @compliance logging:✓ toast:✓
 */

import { toast } from 'sonner';
import { ApiError } from '@/lib/api-client';

/**
 * Standardized API error handler.
 *
 * Handles errors consistently across the application by:
 * - Logging errors to console in development
 * - Extracting user-friendly error messages from various error formats
 * - Displaying toast notifications with error messages
 * - Handling network errors gracefully
 *
 * @param error - The error object from a catch block (can be any type)
 * @param userMessage - Optional custom message to show to the user (overrides extracted message)
 *
 * @example
 * ```tsx
 * try {
 *   await api.post('/publisher/profile', { body: JSON.stringify(data) });
 * } catch (err) {
 *   handleApiError(err, 'Failed to save profile');
 * }
 * ```
 *
 * @example With default message extraction
 * ```tsx
 * try {
 *   const data = await api.get('/localities');
 * } catch (err) {
 *   // Will extract and display the API error message automatically
 *   handleApiError(err);
 * }
 * ```
 */
export function handleApiError(error: unknown, userMessage?: string): void {
  // Log to console in development mode only
  if (process.env.NODE_ENV === 'development') {
    console.error('API Error:', error);
  }

  // Extract error message from various formats
  let message = userMessage || 'An error occurred';

  if (error instanceof ApiError) {
    // Use ApiError's message (already extracted from API response)
    message = userMessage || error.message;
  } else if (error instanceof Error) {
    // Standard JavaScript Error
    message = userMessage || error.message;
  } else if (typeof error === 'object' && error !== null) {
    // Generic object with possible message property
    const errorObj = error as any;
    if (errorObj.message) {
      message = userMessage || errorObj.message;
    } else if (errorObj.error?.message) {
      // Nested error format: { error: { message: 'x' } }
      message = userMessage || errorObj.error.message;
    }
  }

  // Handle network errors specifically
  if (error instanceof Error && error.message.includes('fetch')) {
    message = userMessage || 'Network error - please check your connection';
  }

  // Show toast notification
  toast.error(message);
}
