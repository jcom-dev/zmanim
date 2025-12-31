'use client';

import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { ShaosBase } from '../types';
import { useZmanimList, useAstronomicalPrimitivesGrouped } from '@/lib/hooks/useZmanimList';
import { Loader2, Clock, Star, ChevronDown, ChevronRight, EyeOff } from 'lucide-react';

interface ProportionalHoursFormProps {
  hours: number;
  base: ShaosBase;
  customStart?: string;
  customEnd?: string;
  onHoursChange: (value: number) => void;
  onBaseChange: (base: ShaosBase) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  localityId?: number | null;
}

const hourMarks = [
  { value: 1, label: '1' },
  { value: 3, label: '3' },
  { value: 6, label: '6' },
  { value: 9, label: '9' },
  { value: 12, label: '12' },
];

export function ProportionalHoursForm({
  hours,
  base,
  customStart,
  customEnd,
  onHoursChange,
  onBaseChange,
  onCustomStartChange,
  onCustomEndChange,
  localityId,
}: ProportionalHoursFormProps) {
  // State for collapsible "Your Zmanim" sections
  const [startZmanimExpanded, setStartZmanimExpanded] = useState(false);
  const [endZmanimExpanded, setEndZmanimExpanded] = useState(false);

  // Fetch publisher's zmanim (requires localityId)
  const { data: zmanimData, isLoading: zmanimLoading } = useZmanimList(
    localityId ? { localityId } : undefined
  );
  const { data: primitivesGrouped = [], isLoading: primitivesLoading } = useAstronomicalPrimitivesGrouped();

  // Ensure zmanim is always an array (API may return error object)
  const zmanim = Array.isArray(zmanimData) ? zmanimData : [];

  const isLoading = zmanimLoading || primitivesLoading;

  // Filter daily zmanim (not event-specific)
  const dailyZmanim = zmanim.filter((z) => !z.is_event_zman);

  // Find selected items for display
  const selectedStartZman = zmanim.find((z) => z.zman_key === customStart);
  const selectedStartPrimitive = primitivesGrouped
    .flatMap((cat) => cat.primitives)
    .find((p) => p.variable_name === customStart);

  const selectedEndZman = zmanim.find((z) => z.zman_key === customEnd);
  const selectedEndPrimitive = primitivesGrouped
    .flatMap((cat) => cat.primitives)
    .find((p) => p.variable_name === customEnd);

  return (
    <div className="space-y-4">
      {/* Hours slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Proportional Hours</label>
          <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
            {hours} hours
          </span>
        </div>
        <Slider
          value={hours}
          onChange={onHoursChange}
          min={0.5}
          max={12}
          step={0.25}
          marks={hourMarks}
        />
      </div>

      {/* Common hour presets */}
      <div className="flex flex-wrap gap-2">
        {[3, 4, 9, 9.5, 10, 10.75].map((h) => (
          <Button
            key={h}
            variant={hours === h ? 'default' : 'outline-solid'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onHoursChange(h);
            }}
          >
            {h}h
          </Button>
        ))}
      </div>

      {/* Base system selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Calculation System</label>
        <Select value={base} onValueChange={(v) => onBaseChange(v as ShaosBase)}>
          <SelectTrigger onClick={(e) => e.stopPropagation()}>
            <SelectValue placeholder="Select calculation system..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gra">GRA (Sunrise to Sunset)</SelectItem>
            <SelectItem value="mga">MGA 72 min</SelectItem>
            <SelectItem value="mga_90">MGA 90 min</SelectItem>
            <SelectItem value="baal_hatanya">Baal HaTanya</SelectItem>
            <SelectItem value="custom">Custom (Define start/end)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {base === 'gra' && 'Vilna Gaon: Sunrise to sunset'}
          {base === 'mga' && 'Magen Avraham: 72 min before sunrise to 72 min after sunset'}
          {base === 'mga_90' && 'MGA with 90 minute offset'}
          {base === 'baal_hatanya' && 'Shulchan Aruch HaRav: 1.583° below horizon'}
          {base === 'custom' && 'Define your own day start and end times'}
        </p>
      </div>

      {/* Custom start/end selectors */}
      {base === 'custom' && (
        <div className="space-y-3 p-3 bg-muted/50 rounded-lg" onClick={(e) => e.stopPropagation()}>
          {/* Day Start Reference */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Day Start Reference</label>
            <Select value={customStart || ''} onValueChange={onCustomStartChange}>
              <SelectTrigger className="h-12">
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading...</span>
                  </div>
                ) : (
                  <SelectValue placeholder="Select start time...">
                    {selectedStartZman ? (
                      <div className="flex items-center gap-2">
                        <span className="font-hebrew">{selectedStartZman.hebrew_name}</span>
                        <span className="text-muted-foreground">•</span>
                        <span>{selectedStartZman.english_name}</span>
                      </div>
                    ) : selectedStartPrimitive ? (
                      <span className="font-medium">{selectedStartPrimitive.display_name}</span>
                    ) : customStart ? (
                      <span className="font-mono text-sm">{customStart}</span>
                    ) : (
                      'Select start time...'
                    )}
                  </SelectValue>
                )}
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {/* Astronomical Primitives */}
                {primitivesGrouped.map((category) => (
                  <SelectGroup key={category.category}>
                    <SelectLabel className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2 mt-2 first:mt-0">
                      <Clock className="h-3 w-3" />
                      {category.display_name}
                    </SelectLabel>
                    {category.primitives.map((primitive) => (
                      <SelectItem key={primitive.variable_name} value={primitive.variable_name}>
                        <div className="flex flex-col">
                          <span className="font-medium">{primitive.display_name}</span>
                          <span className="text-xs text-muted-foreground">{primitive.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                {/* Publisher's Zmanim - conditional render prevents Radix Select infinite loop */}
                {dailyZmanim.length > 0 && (
                  <SelectGroup>
                    <div
                      className="flex items-center gap-2 px-2 py-2 mt-2 cursor-pointer hover:bg-muted/50 rounded-md transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setStartZmanimExpanded(!startZmanimExpanded);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      {startZmanimExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <Star className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                        Your Zmanim ({dailyZmanim.length})
                      </span>
                    </div>
                    {startZmanimExpanded && dailyZmanim.map((zman) => (
                      <SelectItem
                        key={zman.zman_key}
                        value={zman.zman_key}
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-hebrew">{zman.hebrew_name}</span>
                            <span className="text-muted-foreground">•</span>
                            <span>{zman.english_name}</span>
                            {!zman.is_enabled && <EyeOff className="h-3 w-3 text-muted-foreground" />}
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">{zman.formula_dsl}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Day End Reference */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Day End Reference</label>
            <Select value={customEnd || ''} onValueChange={onCustomEndChange}>
              <SelectTrigger className="h-12">
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading...</span>
                  </div>
                ) : (
                  <SelectValue placeholder="Select end time...">
                    {selectedEndZman ? (
                      <div className="flex items-center gap-2">
                        <span className="font-hebrew">{selectedEndZman.hebrew_name}</span>
                        <span className="text-muted-foreground">•</span>
                        <span>{selectedEndZman.english_name}</span>
                      </div>
                    ) : selectedEndPrimitive ? (
                      <span className="font-medium">{selectedEndPrimitive.display_name}</span>
                    ) : customEnd ? (
                      <span className="font-mono text-sm">{customEnd}</span>
                    ) : (
                      'Select end time...'
                    )}
                  </SelectValue>
                )}
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {/* Astronomical Primitives */}
                {primitivesGrouped.map((category) => (
                  <SelectGroup key={category.category}>
                    <SelectLabel className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2 mt-2 first:mt-0">
                      <Clock className="h-3 w-3" />
                      {category.display_name}
                    </SelectLabel>
                    {category.primitives.map((primitive) => (
                      <SelectItem key={primitive.variable_name} value={primitive.variable_name}>
                        <div className="flex flex-col">
                          <span className="font-medium">{primitive.display_name}</span>
                          <span className="text-xs text-muted-foreground">{primitive.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                {/* Publisher's Zmanim - conditional render prevents Radix Select infinite loop */}
                {dailyZmanim.length > 0 && (
                  <SelectGroup>
                    <div
                      className="flex items-center gap-2 px-2 py-2 mt-2 cursor-pointer hover:bg-muted/50 rounded-md transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEndZmanimExpanded(!endZmanimExpanded);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      {endZmanimExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <Star className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                        Your Zmanim ({dailyZmanim.length})
                      </span>
                    </div>
                    {endZmanimExpanded && dailyZmanim.map((zman) => (
                      <SelectItem
                        key={zman.zman_key}
                        value={zman.zman_key}
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-hebrew">{zman.hebrew_name}</span>
                            <span className="text-muted-foreground">•</span>
                            <span>{zman.english_name}</span>
                            {!zman.is_enabled && <EyeOff className="h-3 w-3 text-muted-foreground" />}
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">{zman.formula_dsl}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProportionalHoursForm;
