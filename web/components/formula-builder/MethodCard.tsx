'use client';

import { Sun, Clock, Scale, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import type { MethodType } from './types';

interface MethodCardProps {
  method: MethodType;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
  tooltip?: string;
}

const methodIcons: Record<string, React.ReactNode> = {
  solar: <Sun className="h-5 w-5" />,
  fixed: <Clock className="h-5 w-5" />,
  proportional: <Scale className="h-5 w-5" />,
  fixed_zman: <Star className="h-5 w-5" />,
};

export function MethodCard({
  method,
  title,
  description,
  selected,
  onSelect,
  children,
  tooltip,
}: MethodCardProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl border-2 transition-all cursor-pointer',
        selected
          ? 'border-primary bg-primary/5 shadow-lg ring-1 ring-primary/20'
          : 'border-border bg-card hover:border-primary/50 hover:shadow-md'
      )}
      onClick={onSelect}
    >
      <div className="p-5">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'p-3 rounded-xl transition-all shrink-0',
              selected
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {method && methodIcons[method]}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-base">{title}</h3>
              {tooltip && (
                <InfoTooltip
                  content={tooltip}
                  side="right"
                  iconClassName="h-3.5 w-3.5"
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-snug">{description}</p>
          </div>
        </div>

        {/* Expandable parameters section */}
        {selected && children && (
          <div className="mt-5 pt-5 border-t border-border animate-in slide-in-from-top-2 duration-200">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export default MethodCard;
