/**
 * Icon Registry for Database-Driven Category Icons
 *
 * Maps icon names stored in the database to Lucide React icon components.
 * This provides a central place to manage icons referenced by the category APIs.
 *
 * @example
 * ```tsx
 * import { getIcon, getCategoryIcon } from '@/lib/icons';
 * import { useTimeCategories } from '@/lib/hooks';
 *
 * function CategoryIcon({ category }: { category: TimeCategory }) {
 *   const Icon = getIcon(category.icon_name);
 *   return <Icon className="w-5 h-5" />;
 * }
 *
 * // Or use the helper
 * function CategoryBadge({ categoryKey }: { categoryKey: string }) {
 *   const { timeCategories } = useTimeCategories();
 *   const Icon = getCategoryIcon(timeCategories, categoryKey);
 *   return <Icon className="w-4 h-4" />;
 * }
 * ```
 */

import {
  Sunrise,
  Sunset,
  Moon,
  Sun,
  Clock,
  Timer,
  Flame,
  CandlestickChart,
  Utensils,
  Star,
  Calendar,
  CircleDot,
  type LucideIcon,
} from 'lucide-react';

// =============================================================================
// Icon Map
// =============================================================================

/**
 * Map of icon names to Lucide React components.
 * Icon names must match what's stored in the database.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  // Solar/Time icons
  Sunrise,
  Sunset,
  Sun,
  Moon,
  Clock,
  Timer,
  Star,

  // Event icons
  Flame,
  CandlestickChart,
  Utensils,

  // Other icons
  Calendar,
  CircleDot,
};

/**
 * Default icon used when no match is found
 */
const DEFAULT_ICON: LucideIcon = Clock;

// =============================================================================
// Functions
// =============================================================================

/**
 * Get a Lucide icon component by its name.
 * Returns Clock as a fallback if the icon is not found.
 *
 * @param name - Icon name as stored in the database (e.g., "Sunrise", "Moon")
 * @returns Lucide icon component
 *
 * @example
 * ```tsx
 * const SunriseIcon = getIcon('Sunrise');
 * return <SunriseIcon className="w-5 h-5 text-amber-500" />;
 * ```
 */
export function getIcon(name: string | undefined | null): LucideIcon {
  if (!name) return DEFAULT_ICON;
  return ICON_MAP[name] ?? DEFAULT_ICON;
}

/**
 * Check if an icon name is valid (exists in the registry)
 */
export function isValidIconName(name: string): boolean {
  return name in ICON_MAP;
}

/**
 * Get all available icon names
 */
export function getAvailableIconNames(): string[] {
  return Object.keys(ICON_MAP);
}

/**
 * Get the icon for a category by its key, looking it up in the category array.
 * Useful for quick lookups when you have the categories data and a key.
 *
 * @example
 * ```tsx
 * import { getCategoryIcon } from '@/lib/icons';
 * import { useTimeCategories } from '@/lib/hooks';
 *
 * function ZmanSection({ categoryKey }: { categoryKey: string }) {
 *   const { data: timeCategories } = useTimeCategories();
 *   const Icon = getCategoryIcon(timeCategories, categoryKey);
 *
 *   return (
 *     <div className="flex items-center gap-2">
 *       <Icon className="w-5 h-5" />
 *       <span>{categoryKey}</span>
 *     </div>
 *   );
 * }
 * ```
 */
export function getCategoryIcon<T extends { key: string; icon_name?: string }>(
  categories: T[] | undefined,
  categoryKey: string
): LucideIcon {
  if (!categories) return DEFAULT_ICON;
  const category = categories.find(c => c.key === categoryKey);
  return getIcon(category?.icon_name);
}

// =============================================================================
// Type Exports
// =============================================================================

export type { LucideIcon };

// Re-export commonly used icons for direct import
export {
  Sunrise,
  Sunset,
  Moon,
  Sun,
  Clock,
  Timer,
  Flame,
  CandlestickChart,
  Utensils,
  Star,
  Calendar,
  CircleDot,
};
