'use client';

import { cn } from '@/lib/utils';

interface QuickInsertChipProps {
  value: string;
  label: string;
  description?: string;
  onClick: (value: string) => void;
  size?: 'sm' | 'md';
  variant?: 'default' | 'secondary';
}

export function QuickInsertChip({
  value,
  label,
  description,
  onClick,
  size = 'sm',
  variant = 'default',
}: QuickInsertChipProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center rounded font-medium transition-colors',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-2.5 py-1 text-sm',
        variant === 'default' && 'bg-primary/10 text-primary hover:bg-primary/20',
        variant === 'secondary' && 'bg-muted text-muted-foreground hover:bg-muted/80'
      )}
      onClick={() => onClick(value)}
      title={description}
    >
      {label}
    </button>
  );
}

interface QuickInsertChipGroupProps {
  chips: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
  onInsert: (value: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function QuickInsertChipGroup({
  chips,
  onInsert,
  size = 'sm',
  className,
}: QuickInsertChipGroupProps) {
  if (!chips || chips.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {chips.map((chip) => (
        <QuickInsertChip
          key={chip.value}
          value={chip.value}
          label={chip.label}
          description={chip.description}
          onClick={onInsert}
          size={size}
        />
      ))}
    </div>
  );
}

export default QuickInsertChip;
