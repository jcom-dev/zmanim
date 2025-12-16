/**
 * WCAG AA Compliant Color Utilities
 *
 * All colors meet WCAG AA standards:
 * - Normal text: 4.5:1 contrast ratio
 * - Large text (18pt+): 3:1 contrast ratio
 * - UI components: 3:1 contrast ratio
 */

export const wcagColors = {
  // Continent - Orange (WCAG AA compliant)
  continent: {
    light: {
      bg: 'bg-orange-100',
      text: 'text-orange-900',
      border: 'border-orange-400',
      hover: 'hover:bg-orange-200',
    },
    dark: {
      bg: 'bg-orange-950',
      text: 'text-orange-200',
      border: 'border-orange-700',
      hover: 'hover:bg-orange-900',
    },
  },

  // Country - Blue (WCAG AA compliant)
  country: {
    light: {
      bg: 'bg-blue-100',
      text: 'text-blue-900',
      border: 'border-blue-400',
      hover: 'hover:bg-blue-200',
    },
    dark: {
      bg: 'bg-blue-950',
      text: 'text-blue-200',
      border: 'border-blue-700',
      hover: 'hover:bg-blue-900',
    },
  },

  // Region - Green (WCAG AA compliant)
  region: {
    light: {
      bg: 'bg-green-100',
      text: 'text-green-900',
      border: 'border-green-500',
      hover: 'hover:bg-green-200',
    },
    dark: {
      bg: 'bg-green-950',
      text: 'text-green-200',
      border: 'border-green-700',
      hover: 'hover:bg-green-900',
    },
  },

  // Locality - Purple (WCAG AA compliant)
  locality: {
    light: {
      bg: 'bg-purple-100',
      text: 'text-purple-900',
      border: 'border-purple-400',
      hover: 'hover:bg-purple-200',
    },
    dark: {
      bg: 'bg-purple-950',
      text: 'text-purple-200',
      border: 'border-purple-700',
      hover: 'hover:bg-purple-900',
    },
  },
} as const;

/**
 * Get WCAG-compliant badge classes for coverage levels
 * Returns Tailwind classes that work in both light and dark modes
 */
export function getCoverageBadgeClasses(level: string): string {
  const colorSchemes = {
    continent: 'bg-orange-100 text-orange-900 border-orange-400 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-700',
    country: 'bg-blue-100 text-blue-900 border-blue-400 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-700',
    region: 'bg-green-100 text-green-900 border-green-500 dark:bg-green-950 dark:text-green-200 dark:border-green-700',
    locality: 'bg-purple-100 text-purple-900 border-purple-400 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-700',
  };

  return colorSchemes[level as keyof typeof colorSchemes] ||
         'bg-gray-100 text-gray-900 border-gray-400 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600';
}
