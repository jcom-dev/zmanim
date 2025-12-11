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
        <div className="flex gap-2">
          <Button
            variant={base === 'gra' ? 'default' : 'outline-solid'}
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onBaseChange('gra');
            }}
          >
            GRA
          </Button>
          <Button
            variant={base === 'mga' ? 'default' : 'outline-solid'}
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onBaseChange('mga');
            }}
          >
            MGA
          </Button>
          <Button
            variant={base === 'custom' ? 'default' : 'outline-solid'}
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onBaseChange('custom');
            }}
          >
            Custom
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {base === 'gra' && 'GRA: Sunrise to sunset (Vilna Gaon)'}
          {base === 'mga' && 'MGA: Dawn (72 min) to nightfall (72 min)'}
          {base === 'custom' && 'Custom: Define your own start and end times'}
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
