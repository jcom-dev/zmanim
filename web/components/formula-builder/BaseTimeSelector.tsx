'use client';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { baseTimeOptions } from './types';
import { cn } from '@/lib/utils';

interface BaseTimeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function BaseTimeSelector({
  value,
  onChange,
  className,
}: BaseTimeSelectorProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="text-sm font-medium text-foreground">
        Base Time
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select base time..." />
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
      <p className="text-xs text-muted-foreground">
        Choose the reference point for your calculation
      </p>
    </div>
  );
}

export default BaseTimeSelector;
