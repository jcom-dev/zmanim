/**
 * @file RoundingModeToggle.tsx
 * @purpose 3-way toggle for publisher to set per-zman rounding mode
 * @pattern client-component
 * @dependencies shadcn/ui (ToggleGroup, Tooltip), lucide-react
 * @frequency medium - used in ZmanCard for rounding control
 * @compliance Story 8-34 - Seconds Display Toggle with Rounding
 */

'use client';

import React from 'react';
import { ArrowDown, ArrowUp, Equal } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type RoundingMode = 'floor' | 'math' | 'ceil';

interface RoundingModeToggleProps {
  value: RoundingMode;
  onChange: (mode: RoundingMode) => void;
  disabled?: boolean;
}

/**
 * 3-way toggle for publisher to set rounding mode per-zman
 *
 * Color scheme (using design tokens):
 * - Floor (down): Blue - safe for start times (earlier)
 * - Math (middle): Gray - standard mathematical rounding
 * - Ceil (up): Red - safe for end times (later)
 *
 * This controls how times are DISPLAYED when user hides seconds.
 * The actual calculated time remains precise.
 */
export function RoundingModeToggle({
  value,
  onChange,
  disabled,
}: RoundingModeToggleProps) {
  // Use individual buttons instead of ToggleGroup to avoid Radix event conflicts with TooltipTrigger
  const modes: { mode: RoundingMode; icon: typeof ArrowDown; label: string; tooltip: React.ReactNode }[] = [
    {
      mode: 'floor',
      icon: ArrowDown,
      label: 'Round down',
      tooltip: (
        <div className="text-xs">
          <p className="font-medium text-blue-600 dark:text-blue-400">Round Down (Floor)</p>
          <p>06:42:30 → 06:42</p>
          <p className="text-muted-foreground">Safe for start times</p>
        </div>
      ),
    },
    {
      mode: 'math',
      icon: Equal,
      label: 'Mathematical rounding',
      tooltip: (
        <div className="text-xs">
          <p className="font-medium">Mathematical Rounding</p>
          <p>06:42:30 → 06:43 (≥30 rounds up)</p>
          <p>06:42:29 → 06:42 (&lt;30 rounds down)</p>
        </div>
      ),
    },
    {
      mode: 'ceil',
      icon: ArrowUp,
      label: 'Round up',
      tooltip: (
        <div className="text-xs">
          <p className="font-medium text-red-600 dark:text-red-400">Round Up (Ceil)</p>
          <p>06:42:01 → 06:43</p>
          <p className="text-muted-foreground">Safe for end times</p>
        </div>
      ),
    },
  ];

  const getButtonStyles = (mode: RoundingMode, isSelected: boolean, position: 'left' | 'middle' | 'right') => {
    const roundedClasses = {
      left: 'rounded-l-md rounded-r-none border-r border-border',
      middle: 'rounded-none border-r border-border',
      right: 'rounded-r-md rounded-l-none',
    };

    // Strong, distinct colors for each mode - visible in both light and dark modes
    const colorClasses = {
      floor: isSelected
        ? 'bg-blue-500 text-white dark:bg-blue-600'
        : 'text-muted-foreground hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-300',
      math: isSelected
        ? 'bg-gray-500 text-white dark:bg-gray-600'
        : 'text-muted-foreground hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300',
      ceil: isSelected
        ? 'bg-red-500 text-white dark:bg-red-600'
        : 'text-muted-foreground hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300',
    };

    return `h-7 w-7 p-0 inline-flex items-center justify-center transition-colors ${roundedClasses[position]} ${colorClasses[mode]}`;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-7 border rounded-md">
        {modes.map((item, index) => {
          const Icon = item.icon;
          const isSelected = value === item.mode;
          const position = index === 0 ? 'left' : index === modes.length - 1 ? 'right' : 'middle';

          return (
            <Tooltip key={item.mode}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={item.label}
                  aria-pressed={isSelected}
                  disabled={disabled}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (item.mode !== value) {
                      onChange(item.mode);
                    }
                  }}
                  className={getButtonStyles(item.mode, isSelected, position as 'left' | 'middle' | 'right')}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{item.tooltip}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
