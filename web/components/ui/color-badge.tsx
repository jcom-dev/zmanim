'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * ColorBadge - A vibrant, themed badge component for tags and labels
 *
 * Designed for high visibility in BOTH light and dark modes.
 * Uses saturated colors with proper contrast ratios for accessibility.
 *
 * Available color variants (semantic and decorative):
 * - amber: Calculation types, warnings (e.g., "Solar Angle", "Horizon")
 * - blue: Angles, numeric values (e.g., "6°", "72 min")
 * - cyan: Shita/methodology (e.g., "GRA", "MGA")
 * - violet: Methods (e.g., "Proportional Hours", "Fixed Minutes")
 * - pink: Relative timing (e.g., "before sunset", "after sunrise")
 * - green: Status positive, timing (e.g., "Stable", timing tags)
 * - red: Fast days, destructive
 * - purple: Behavior tags, categories
 * - orange: Transit, afternoon
 * - rose: Sunset, evening
 * - indigo: Nightfall
 * - slate: Midnight, neutral
 *
 * Size variants:
 * - xs: Tiny inline tags (10px font)
 * - sm: Standard tags (12px font) - default
 * - md: Medium tags (14px font)
 */

export type ColorBadgeColor =
  | 'amber'
  | 'blue'
  | 'cyan'
  | 'violet'
  | 'pink'
  | 'green'
  | 'red'
  | 'purple'
  | 'orange'
  | 'rose'
  | 'indigo'
  | 'slate'
  | 'yellow'
  | 'teal';

export type ColorBadgeSize = 'xs' | 'sm' | 'md';

interface ColorBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  color?: ColorBadgeColor;
  size?: ColorBadgeSize;
}

/**
 * Color definitions for both light and dark modes
 *
 * Light mode: Uses vibrant, saturated backgrounds with dark text
 * Dark mode: Uses semi-transparent backgrounds with bright text
 *
 * Border colors complement the background for visual definition
 */
const colorClasses: Record<ColorBadgeColor, string> = {
  // Amber - Calculation types, warnings
  amber:
    'bg-amber-500 text-white border-amber-600 dark:bg-amber-600 dark:text-amber-50 dark:border-amber-500',

  // Blue - Angles, numeric values, registry
  blue: 'bg-blue-500 text-white border-blue-600 dark:bg-blue-600 dark:text-blue-50 dark:border-blue-500',

  // Cyan - Shita/methodology (GRA, MGA)
  cyan: 'bg-cyan-500 text-white border-cyan-600 dark:bg-cyan-600 dark:text-cyan-50 dark:border-cyan-500',

  // Violet - Methods (Proportional Hours, etc.)
  violet:
    'bg-violet-500 text-white border-violet-600 dark:bg-violet-600 dark:text-violet-50 dark:border-violet-500',

  // Pink - Relative timing
  pink: 'bg-pink-500 text-white border-pink-600 dark:bg-pink-600 dark:text-pink-50 dark:border-pink-500',

  // Green - Positive status, timing
  green:
    'bg-green-500 text-white border-green-600 dark:bg-green-600 dark:text-green-50 dark:border-green-500',

  // Red - Fast days, destructive
  red: 'bg-red-500 text-white border-red-600 dark:bg-red-600 dark:text-red-50 dark:border-red-500',

  // Purple - Behavior, categories, dawn
  purple:
    'bg-purple-500 text-white border-purple-600 dark:bg-purple-600 dark:text-purple-50 dark:border-purple-500',

  // Orange - Midday, transit
  orange:
    'bg-orange-500 text-white border-orange-600 dark:bg-orange-600 dark:text-orange-50 dark:border-orange-500',

  // Rose - Sunset, evening
  rose: 'bg-rose-500 text-white border-rose-600 dark:bg-rose-600 dark:text-rose-50 dark:border-rose-500',

  // Indigo - Nightfall
  indigo:
    'bg-indigo-500 text-white border-indigo-600 dark:bg-indigo-600 dark:text-indigo-50 dark:border-indigo-500',

  // Slate - Midnight, neutral
  slate:
    'bg-slate-500 text-white border-slate-600 dark:bg-slate-600 dark:text-slate-50 dark:border-slate-500',

  // Yellow - Morning, sunrise
  yellow:
    'bg-yellow-500 text-white border-yellow-600 dark:bg-yellow-600 dark:text-yellow-50 dark:border-yellow-500',

  // Teal - Alternative for variety
  teal: 'bg-teal-500 text-white border-teal-600 dark:bg-teal-600 dark:text-teal-50 dark:border-teal-500',
};

const sizeClasses: Record<ColorBadgeSize, string> = {
  xs: 'text-[10px] px-1.5 py-0 h-4',
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
};

export function ColorBadge({
  children,
  color = 'slate',
  size = 'sm',
  className,
  ...props
}: ColorBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium border',
        colorClasses[color],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * Preset color mappings for common tag types
 * Use these helpers to ensure consistent coloring across the app
 */
export const TAG_COLOR_MAP = {
  // Calculation types
  horizon: 'amber' as ColorBadgeColor,
  solar_angle: 'amber' as ColorBadgeColor,
  transit: 'orange' as ColorBadgeColor,

  // Shita (methodology)
  gra: 'cyan' as ColorBadgeColor,
  mga: 'cyan' as ColorBadgeColor,
  '16.1°': 'cyan' as ColorBadgeColor,

  // Methods
  proportional_hours: 'violet' as ColorBadgeColor,
  fixed_minutes: 'violet' as ColorBadgeColor,
  solar: 'violet' as ColorBadgeColor,

  // Time categories
  dawn: 'purple' as ColorBadgeColor,
  sunrise: 'amber' as ColorBadgeColor,
  morning: 'yellow' as ColorBadgeColor,
  midday: 'orange' as ColorBadgeColor,
  afternoon: 'rose' as ColorBadgeColor,
  sunset: 'rose' as ColorBadgeColor,
  nightfall: 'indigo' as ColorBadgeColor,
  midnight: 'slate' as ColorBadgeColor,

  // Tag types (from database)
  event: 'blue' as ColorBadgeColor,
  timing: 'green' as ColorBadgeColor,
  category: 'amber' as ColorBadgeColor,

  // Status
  core: 'green' as ColorBadgeColor,
  hidden: 'slate' as ColorBadgeColor,
};

/**
 * Get the color for a calculation type
 */
export function getCalculationTypeColor(type: string): ColorBadgeColor {
  switch (type) {
    case 'horizon':
      return 'amber';
    case 'solar_angle':
      return 'amber';
    case 'transit':
      return 'orange';
    default:
      return 'slate';
  }
}

/**
 * Get the color for a tag type (from database)
 */
export function getTagTypeColor(tagType: string): ColorBadgeColor {
  switch (tagType) {
    case 'event':
      return 'blue';
    case 'timing':
      return 'green';
    case 'shita':
      return 'cyan';
    case 'category':
      return 'amber';
    default:
      return 'slate';
  }
}

/**
 * Get the color for a time category
 */
export function getTimeCategoryColor(category: string): ColorBadgeColor {
  return TAG_COLOR_MAP[category as keyof typeof TAG_COLOR_MAP] || 'slate';
}
