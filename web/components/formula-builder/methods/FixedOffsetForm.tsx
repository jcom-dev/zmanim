'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useZmanimList, useAstronomicalPrimitivesGrouped } from '@/lib/hooks/useZmanimList';
import { Loader2, EyeOff, Star, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import type { OffsetDirection } from '../types';

interface FixedOffsetFormProps {
  minutes: number;
  direction: OffsetDirection;
  base: string;
  onMinutesChange: (value: number) => void;
  onDirectionChange: (direction: OffsetDirection) => void;
  onBaseChange: (base: string) => void;
}

export function FixedOffsetForm({
  minutes,
  direction,
  base,
  onMinutesChange,
  onDirectionChange,
  onBaseChange,
}: FixedOffsetFormProps) {
  // State for collapsible "Your Zmanim" section
  const [yourZmanimExpanded, setYourZmanimExpanded] = useState(false);

  // Fetch publisher's zmanim
  const { data: zmanim = [], isLoading: zmanimLoading } = useZmanimList();
  // Fetch astronomical primitives from API
  const { data: primitivesGrouped = [], isLoading: primitivesLoading } = useAstronomicalPrimitivesGrouped();

  const isLoading = zmanimLoading || primitivesLoading;

  // Filter daily zmanim (not event-specific) - already sorted by time_category from API
  // Server determines event status via is_event_zman field (based on event-type tags)
  const dailyZmanim = zmanim.filter((z) => !z.is_event_zman);

  // Find selected zman info for display
  const selectedZman = zmanim.find((z) => z.zman_key === base);
  // Search within primitives for the selected one
  const selectedPrimitive = primitivesGrouped
    .flatMap((cat) => cat.primitives)
    .find((p) => p.variable_name === base);

  // Generate preview formula - use @ prefix for zman references
  const isZmanReference = zmanim.some((z) => z.zman_key === base);
  const previewFormula = isZmanReference
    ? `@${base} ${direction === 'before' ? '-' : '+'} ${minutes}min`
    : `${base} ${direction === 'before' ? '-' : '+'} ${minutes}min`;

  return (
    <div className="space-y-5">
      {/* Live Formula Preview */}
      <div className="rounded-lg bg-muted/50 border border-border p-3">
        <div className="text-xs text-muted-foreground mb-1">Formula Preview</div>
        <code className="text-sm font-mono text-primary">{previewFormula}</code>
      </div>

      {/* Step 1: Base Time Selection */}
      <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
        <label className="text-sm font-semibold">1. Reference Time</label>
        <Select value={base} onValueChange={onBaseChange}>
          <SelectTrigger className="h-14">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading zmanim...</span>
              </div>
            ) : (
              <SelectValue placeholder="Select reference time...">
                {selectedZman ? (
                  <div className="flex items-center gap-3">
                    <span className="font-hebrew text-base">{selectedZman.hebrew_name}</span>
                    <span className="text-muted-foreground">•</span>
                    <span>{selectedZman.english_name}</span>
                    {!selectedZman.is_enabled && (
                      <EyeOff className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                ) : selectedPrimitive ? (
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{selectedPrimitive.display_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {selectedPrimitive.description}
                    </span>
                  </div>
                ) : (
                  'Select reference time...'
                )}
              </SelectValue>
            )}
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            {/* Core Astronomical Primitives - organized by category from API */}
            {primitivesGrouped.map((category) => (
              <SelectGroup key={category.category}>
                <SelectLabel className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2 mt-2 first:mt-0">
                  <Clock className="h-3 w-3" />
                  {category.display_name}
                </SelectLabel>
                {category.primitives.map((primitive) => (
                  <SelectItem
                    key={primitive.variable_name}
                    value={primitive.variable_name}
                    className="py-3"
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{primitive.display_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {primitive.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}

            {/* Publisher's Daily Zmanim - collapsible section */}
            {dailyZmanim.length > 0 && (
              <SelectGroup>
                {/* Collapsible header - clickable to expand/collapse */}
                <div
                  className="flex items-center gap-2 px-2 py-2 mt-2 cursor-pointer hover:bg-muted/50 rounded-md transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setYourZmanimExpanded(!yourZmanimExpanded);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setYourZmanimExpanded(!yourZmanimExpanded);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={yourZmanimExpanded}
                >
                  {yourZmanimExpanded ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                  <Star className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                    Your Zmanim ({dailyZmanim.length})
                  </span>
                </div>
                {/* Expanded content */}
                {yourZmanimExpanded && dailyZmanim.map((zman) => (
                    <SelectItem
                      key={zman.zman_key}
                      value={zman.zman_key}
                      className="py-3"
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-3">
                          <span className="font-hebrew font-medium">{zman.hebrew_name}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="font-medium">{zman.english_name}</span>
                          {!zman.is_enabled && (
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">disabled</span>
                          )}
                          {!zman.is_visible && (
                            <EyeOff className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          {zman.formula_dsl}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>

        {/* Show selected zman info */}
        {selectedZman && (
          <div className="text-xs bg-primary/5 rounded-md px-3 py-2 border border-primary/10 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-primary">Using:</span>
              <code className="font-mono">@{selectedZman.zman_key}</code>
            </div>
            {selectedZman.formula_dsl && (
              <div className="text-muted-foreground">
                Formula: <code className="font-mono">{selectedZman.formula_dsl}</code>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Minutes Input */}
      <div className="space-y-3">
        <label className="text-sm font-semibold">2. Offset (minutes)</label>

        {/* Quick presets with visible context */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { min: 18, label: '18 min', note: 'Misheyakir' },
            { min: 40, label: '40 min', note: 'Candle lighting' },
            { min: 50, label: '50 min', note: 'R\' Moshe Feinstein' },
            { min: 72, label: '72 min', note: 'Rabbeinu Tam' },
            { min: 90, label: '90 min', note: 'Some communities' },
            { min: 120, label: '120 min', note: 'Stringent R\' Tam' },
          ].map(({ min, label, note }) => (
            <button
              key={min}
              type="button"
              className={cn(
                'flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left',
                minutes === min
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/50'
              )}
              onClick={(e) => {
                e.stopPropagation();
                onMinutesChange(min);
              }}
            >
              <span className="font-semibold text-base">{label}</span>
              <span className="text-xs text-muted-foreground">{note}</span>
            </button>
          ))}
        </div>

        {/* Custom input */}
        <div className="flex items-center gap-3 pt-2">
          <span className="text-sm text-muted-foreground">Or enter custom:</span>
          <Input
            type="number"
            min={0}
            max={180}
            value={minutes}
            onChange={(e) => onMinutesChange(parseInt(e.target.value) || 0)}
            onClick={(e) => e.stopPropagation()}
            className="h-10 text-base font-mono w-20 text-center"
          />
          <span className="text-sm text-muted-foreground">minutes</span>
        </div>
      </div>

      {/* Step 3: Direction */}
      <div className="space-y-3">
        <label className="text-sm font-semibold">3. Direction</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className={cn(
              'flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all',
              direction === 'before'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card hover:border-primary/50'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onDirectionChange('before');
            }}
          >
            <span className="text-2xl mb-1">←</span>
            <span className="font-semibold">Before</span>
            <span className="text-xs text-muted-foreground">Earlier in the day</span>
          </button>
          <button
            type="button"
            className={cn(
              'flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all',
              direction === 'after'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card hover:border-primary/50'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onDirectionChange('after');
            }}
          >
            <span className="text-2xl mb-1">→</span>
            <span className="font-semibold">After</span>
            <span className="text-xs text-muted-foreground">Later in the day</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default FixedOffsetForm;
