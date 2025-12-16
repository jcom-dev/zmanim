'use client';

import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import type { SolarDirection } from '../types';
import { solarAnglePresets } from '../types';

interface SolarAngleFormProps {
  degrees: number;
  direction: SolarDirection;
  onDegreesChange: (value: number) => void;
  onDirectionChange: (direction: SolarDirection) => void;
}

export function SolarAngleForm({
  degrees,
  direction,
  onDegreesChange,
  onDirectionChange,
}: SolarAngleFormProps) {
  return (
    <div className="space-y-4">
      {/* Degrees slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Solar Depression Angle</label>
          <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
            {degrees.toFixed(1)}°
          </span>
        </div>
        <Slider
          value={degrees}
          onChange={onDegreesChange}
          min={0.5}
          max={26}
          step={0.1}
          marks={solarAnglePresets.map((p) => ({ value: p.value, label: p.label }))}
        />
      </div>

      {/* Preset buttons */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Quick presets</label>
        <div className="flex flex-wrap gap-2">
          {solarAnglePresets.map((preset) => (
            <Button
              key={preset.value}
              variant={degrees === preset.value ? 'default' : 'outline-solid'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDegreesChange(preset.value);
              }}
              title={preset.description}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Direction toggle */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Direction</label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={direction === 'before_visible_sunrise' ? 'default' : 'outline-solid'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDirectionChange('before_visible_sunrise');
            }}
          >
            Before Sunrise
          </Button>
          <Button
            variant={direction === 'after_visible_sunset' ? 'default' : 'outline-solid'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDirectionChange('after_visible_sunset');
            }}
          >
            After Sunset
          </Button>
          <Button
            variant={direction === 'before_noon' ? 'default' : 'outline-solid'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDirectionChange('before_noon');
            }}
          >
            Before Noon
          </Button>
          <Button
            variant={direction === 'after_noon' ? 'default' : 'outline-solid'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDirectionChange('after_noon');
            }}
          >
            After Noon
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SolarAngleForm;
