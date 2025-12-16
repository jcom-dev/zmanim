/**
 * WCAG AA Compliant Badge Color Utilities
 *
 * All color combinations meet WCAG AA standards:
 * - Light mode: 4.5:1+ contrast ratio
 * - Dark mode: 4.5:1+ contrast ratio
 *
 * Usage:
 * ```tsx
 * import { getStatusBadgeClasses } from '@/lib/badge-colors';
 *
 * <span className={getStatusBadgeClasses('verified')}>Verified</span>
 * ```
 */

/**
 * Get WCAG-compliant badge classes for status values
 * @param status - The status value (verified, pending, suspended, active, etc.)
 * @returns Tailwind classes that work in both light and dark modes
 */
export function getStatusBadgeClasses(status: string): string {
  const statusMap: Record<string, string> = {
    // Green - Success states
    verified: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700',
    active: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700',

    // Yellow - Warning/Pending states
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700',
    pending_verification: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700',

    // Red - Error/Suspended states
    suspended: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700',
    inactive: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700',
  };

  return statusMap[status] || 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600';
}

/**
 * Get WCAG-compliant classes for alert/message boxes
 * @param type - The alert type (success, warning, error, info)
 * @returns Tailwind classes for alert containers
 */
export function getAlertClasses(type: 'success' | 'warning' | 'error' | 'info'): string {
  const alertMap = {
    success: 'bg-green-50 border-green-300 text-green-700 dark:bg-green-950 dark:border-green-700 dark:text-green-300',
    warning: 'bg-yellow-50 border-yellow-300 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-700 dark:text-yellow-300',
    error: 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950 dark:border-red-700 dark:text-red-300',
    info: 'bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-300',
  };

  return alertMap[type];
}
