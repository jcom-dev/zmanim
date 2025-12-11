'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  marks?: { value: number; label: string }[];
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className,
  marks,
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  return (
    <div className={cn('relative w-full', className)}>
      <div className="relative h-2">
        {/* Track background */}
        <div className="absolute inset-0 rounded-full bg-secondary" />
        {/* Track fill */}
        <div
          className="absolute h-full rounded-full bg-primary"
          style={{ width: `${percentage}%` }}
        />
        {/* Input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            'absolute inset-0 w-full h-full opacity-0 cursor-pointer',
            disabled && 'cursor-not-allowed'
          )}
        />
        {/* Thumb */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-primary border-2 border-background shadow-xs pointer-events-none transition-transform',
            disabled && 'opacity-50'
          )}
          style={{ left: `calc(${percentage}% - 10px)` }}
        />
      </div>
      {/* Marks */}
      {marks && marks.length > 0 && (
        <div className="relative mt-2">
          {marks.map((mark) => {
            const markPercent = ((mark.value - min) / (max - min)) * 100;
            return (
              <button
                key={mark.value}
                type="button"
                onClick={() => !disabled && onChange(mark.value)}
                className={cn(
                  'absolute -translate-x-1/2 text-xs text-muted-foreground hover:text-foreground transition-colors',
                  mark.value === value && 'text-primary font-medium',
                  disabled && 'pointer-events-none'
                )}
                style={{ left: `${markPercent}%` }}
              >
                {mark.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Slider;
