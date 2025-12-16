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
import { useAstronomicalPrimitivesGrouped } from '@/lib/hooks/useZmanimList';
import { Loader2, Clock } from 'lucide-react';

interface FixedZmanFormProps {
  value: string;
  onChange: (value: string) => void;
}

export function FixedZmanForm({
  value,
  onChange,
}: FixedZmanFormProps) {
  // Fetch astronomical primitives from API (same as FixedOffsetForm)
  const { data: primitivesGrouped = [], isLoading } = useAstronomicalPrimitivesGrouped();

  // Find selected primitive for display
  const selectedPrimitive = primitivesGrouped
    .flatMap((cat) => cat.primitives)
    .find((p) => p.variable_name === value);

  return (
    <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
      {/* Main selector - matches FixedOffsetForm style */}
      <div className="space-y-3">
        <label className="text-sm font-semibold">Astronomical Event</label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-14">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading events...</span>
              </div>
            ) : (
              <SelectValue placeholder="Select astronomical event...">
                {selectedPrimitive ? (
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{selectedPrimitive.display_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {selectedPrimitive.description}
                    </span>
                  </div>
                ) : (
                  'Select astronomical event...'
                )}
              </SelectValue>
            )}
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            {/* Astronomical Primitives - organized by category from API */}
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
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default FixedZmanForm;
