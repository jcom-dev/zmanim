/**
 * @file MethodCard.tsx
 * @description Expandable card displaying a halachic calculation method
 * @module components
 *
 * Displays zman calculation method details including:
 * - Method name and category badge (fixed/zmaniyos/angle)
 * - Calculated time
 * - Formula used
 * - Expandable section with description and source
 * - Minutes before sunrise (when expanded)
 *
 * @example
 * ```tsx
 * <MethodCard
 *   method={{ name: 'Alos 72', category: 'fixed', minutes: 72, ... }}
 *   time={alosTime}
 *   sunrise={sunriseTime}
 * />
 * ```
 */
'use client';

import { DateTime } from 'luxon';
import { CATEGORY_COLORS } from '@/lib/constants';
import { useState } from 'react';

/**
 * Represents a halachic calculation method for Alos (dawn)
 */
interface AlosMethod {
  /** Display name of the method */
  name: string;
  /** Calculation category: fixed minutes, proportional, or solar angle */
  category: 'fixed' | 'zmaniyos' | 'angle';
  /** Minutes offset (for fixed/zmaniyos) */
  minutes?: number;
  /** Solar angle degrees (for angle-based) */
  degrees?: number;
  /** Explanation of the method */
  description: string;
  /** Halachic source reference */
  source: string;
}

/**
 * Props for the MethodCard component
 */
interface MethodCardProps {
  /** The calculation method to display */
  method: AlosMethod;
  /** Calculated time for this method */
  time: DateTime | null;
  /** Sunrise time for computing offset */
  sunrise?: DateTime | null;
}

export default function MethodCard({ method, time, sunrise }: MethodCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const categoryColor = CATEGORY_COLORS[method.category];

  const formatTime = (dt: DateTime | null): string => {
    if (!dt) return 'N/A';
    return dt.toLocaleString(DateTime.TIME_24_WITH_SECONDS);
  };

  const getFormula = (): string => {
    if (method.category === 'fixed') {
      return `Sunrise − ${method.minutes} min`;
    } else if (method.category === 'zmaniyos') {
      return `Sunrise − ${method.minutes} seasonal min`;
    } else if (method.category === 'angle') {
      return `Sun ${method.degrees}° below horizon`;
    }
    return '';
  };

  return (
    <div
      className="
        bg-card rounded-2xl shadow-apple border border-border
        card-hover cursor-pointer overflow-hidden
        transition-all duration-300
      "
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Color accent bar */}
      <div
        className="h-1"
        style={{ backgroundColor: categoryColor.bg }}
      ></div>

      <div className="p-5">
        {/* Method name and category badge */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-base font-semibold text-foreground flex-1 pr-2">
            {method.name}
          </h3>
          <span
            className={`
              text-xs font-medium px-2.5 py-1 rounded-lg
              ${categoryColor.accent}
              ${categoryColor.text}
            `}
          >
            {method.category}
          </span>
        </div>

        {/* Time display */}
        <div className="mb-3">
          <div className="text-3xl font-semibold text-foreground tracking-tight">
            {formatTime(time)}
          </div>
        </div>

        {/* Formula */}
        <div className="text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2 mb-3 font-mono">
          {getFormula()}
        </div>

        {/* Expandable section */}
        <div
          className={`
            transition-all duration-300 overflow-hidden
            ${isExpanded ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'}
          `}
        >
          <div className="pt-4 border-t border-border">
            {/* Description */}
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-foreground mb-1">
                Description
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{method.description}</p>
            </div>

            {/* Source */}
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-foreground mb-1">
                Source
              </h4>
              <p className="text-sm text-muted-foreground italic">{method.source}</p>
            </div>

            {/* Additional details */}
            {time && sunrise && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground font-medium">
                  {Math.round(sunrise.diff(time, 'minutes').minutes)} minutes before sunrise
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Expand indicator */}
        <div className="flex justify-center mt-3 pt-2">
          <svg
            className={`
              w-5 h-5 text-muted-foreground transition-transform duration-300
              ${isExpanded ? 'rotate-180' : ''}
            `}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
