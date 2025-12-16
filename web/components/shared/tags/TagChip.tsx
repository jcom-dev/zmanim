'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tag, TagType, TAG_TYPE_BADGE_CLASSES } from './constants';

interface TagChipProps {
  tag: Tag;
  onRemove?: () => void;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
  showType?: boolean;
  showNegatedIndicator?: boolean;
  showModifiedIndicator?: boolean;
}

export function TagChip({
  tag,
  onRemove,
  selected = false,
  onClick,
  size = 'md',
  showType = false,
  showNegatedIndicator = false,
  showModifiedIndicator = false,
}: TagChipProps) {
  const badgeClass = TAG_TYPE_BADGE_CLASSES[tag.tag_type as TagType] || TAG_TYPE_BADGE_CLASSES.category;
  const isNegated = 'is_negated' in tag && (tag as { is_negated?: boolean }).is_negated === true;
  const isModified = 'is_modified' in tag && (tag as { is_modified?: boolean }).is_modified === true;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border font-medium transition-colors',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm',
        badgeClass,
        selected && 'ring-2 ring-primary ring-offset-1',
        onClick && 'cursor-pointer hover:opacity-80',
        showNegatedIndicator && isNegated && 'ring-2 ring-red-500 ring-offset-1',
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {showType && (
        <span className="opacity-60 text-xs">
          {tag.tag_type}:
        </span>
      )}
      <span className="truncate max-w-[150px]">
        {tag.display_name_english}
      </span>
      {showModifiedIndicator && isModified && (
        <span
          className="h-2 w-2 rounded-full bg-amber-500 shrink-0"
          title="Modified from registry"
          aria-label="Modified"
        />
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:bg-black/10 rounded-full p-0.5 transition-colors"
          aria-label={`Remove ${tag.display_name_english}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

// Compact display for showing multiple tags inline
interface TagChipsProps {
  tags: Tag[];
  maxVisible?: number;
  size?: 'sm' | 'md';
  onTagClick?: (tag: Tag) => void;
}

export function TagChips({
  tags,
  maxVisible = 3,
  size = 'sm',
  onTagClick,
}: TagChipsProps) {
  const visibleTags = tags.slice(0, maxVisible);
  const remainingCount = tags.length - maxVisible;

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visibleTags.map((tag) => (
        <TagChip
          key={tag.id}
          tag={tag}
          size={size}
          onClick={onTagClick ? () => onTagClick(tag) : undefined}
        />
      ))}
      {remainingCount > 0 && (
        <span className="text-xs text-muted-foreground px-1">
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}
