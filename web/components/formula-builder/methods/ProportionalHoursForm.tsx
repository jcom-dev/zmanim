'use client';

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
import { baseTimeOptions } from '../types';

interface ProportionalHoursFormProps {
  hours: number;
  base: ShaosBase;
  customStart?: string;
  customEnd?: string;
  onHoursChange: (value: number) => void;
  onBaseChange: (base: ShaosBase) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
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
}: ProportionalHoursFormProps) {
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
          <div className="space-y-2">
            <label className="text-sm font-medium">Day Start Reference</label>
            <Select value={customStart || ''} onValueChange={onCustomStartChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select start time..." />
              </SelectTrigger>
              <SelectContent>
                {baseTimeOptions.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Day End Reference</label>
            <Select value={customEnd || ''} onValueChange={onCustomEndChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select end time..." />
              </SelectTrigger>
              <SelectContent>
                {baseTimeOptions.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProportionalHoursForm;
