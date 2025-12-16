'use client';

import { useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ColorBadge, getTagTypeColor } from '@/components/ui/color-badge';
import { Loader2, X, Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TagSelectorTag } from './TagSelector';

interface TagGroup {
  key: string;
  label: string;
}

const TAG_GROUPS: TagGroup[] = [
  { key: 'behavior', label: 'Behavior' },
  { key: 'event', label: 'Event' },
  { key: 'jewish_day', label: 'Jewish Day' },
  { key: 'timing', label: 'Timing' },
  { key: 'shita', label: 'Shita' },
  { key: 'calculation', label: 'Calculation' },
  { key: 'category', label: 'Category' },
];

interface TagSelectorWithNegationProps {
  tags: TagSelectorTag[];
  selectedTagIds: number[]; // Changed from string[] to number[]
  negatedTagIds: number[]; // Changed from string[] to number[]
  onToggleTag: (tagId: number) => void; // Changed from string to number
  tagTypeLabels?: Record<string, string>;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * TagSelectorWithNegation - Tag selection with three states: unselected, selected (positive), negated
 *
 * Visual states:
 * - Unselected: No background, faded
 * - Selected (positive): Green check icon, green border
 * - Negated: Red X icon, red border, strikethrough effect
 *
 * Click cycles through: unselected -> positive -> negated -> unselected
 */
export function TagSelectorWithNegation({
  tags,
  selectedTagIds,
  negatedTagIds,
  onToggleTag,
  tagTypeLabels = {},
  isLoading = false,
  disabled = false,
  className,
}: TagSelectorWithNegationProps) {
  // Group and sort tags by type
  const tagGroups = useMemo(() => {
    return TAG_GROUPS.map((group) => ({
      ...group,
      tags: tags
        .filter((t) => t.tag_type === group.key)
        .sort(
          (a, b) =>
            (a.sort_order ?? Number.MAX_SAFE_INTEGER) -
              (b.sort_order ?? Number.MAX_SAFE_INTEGER) ||
            a.display_name_english.localeCompare(b.display_name_english)
        ),
    }));
  }, [tags]);

  // Convert to sets for faster lookup
  const selectedSet = useMemo(() => new Set(selectedTagIds), [selectedTagIds]);
  const negatedSet = useMemo(() => new Set(negatedTagIds), [negatedTagIds]);

  // Find first non-empty group for default tab
  const defaultTab = tagGroups.find((g) => g.tags.length > 0)?.key || 'event';

  if (isLoading) {
    return (
      <div className={cn('flex justify-center py-6', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tagGroups.every((g) => g.tags.length === 0)) {
    return (
      <div className={cn('text-sm text-muted-foreground py-4 text-center border rounded-md', className)}>
        No tags available
      </div>
    );
  }

  return (
    <Tabs defaultValue={defaultTab} className={cn('w-full', className)}>
      <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full justify-start">
        {tagGroups.map((group) => {
          if (group.tags.length === 0) return null;
          const selectedCount = group.tags.filter((t) => selectedSet.has(t.id)).length;
          const negatedCount = group.tags.filter((t) => negatedSet.has(t.id)).length;
          const positiveCount = selectedCount - negatedCount;
          return (
            <TabsTrigger
              key={group.key}
              value={group.key}
              className="text-xs px-3 py-1.5 data-[state=active]:bg-background relative"
            >
              {tagTypeLabels[group.key] || group.label}
              {selectedCount > 0 && (
                <span className="ml-1.5 flex items-center gap-0.5">
                  {positiveCount > 0 && (
                    <span className="bg-green-600 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {positiveCount}
                    </span>
                  )}
                  {negatedCount > 0 && (
                    <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {negatedCount}
                    </span>
                  )}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {tagGroups.map((group) => {
        if (group.tags.length === 0) return null;
        return (
          <TabsContent key={group.key} value={group.key} className="border rounded-md mt-2">
            <ScrollArea className="max-h-[1000px]">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2 p-3">
                {group.tags.map((tag) => {
                  const isSelected = selectedSet.has(tag.id);
                  const isNegated = negatedSet.has(tag.id);

                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => onToggleTag(tag.id)}
                      disabled={disabled}
                      className={cn(
                        'flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all cursor-pointer text-left w-full',
                        !isSelected && 'bg-card hover:bg-muted border-transparent opacity-70 hover:opacity-100',
                        isSelected && !isNegated && 'bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700',
                        isNegated && 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700'
                      )}
                    >
                      {/* State indicator icon */}
                      <div className={cn(
                        'shrink-0 w-5 h-5 rounded flex items-center justify-center',
                        !isSelected && 'border border-muted-foreground/30',
                        isSelected && !isNegated && 'bg-green-600 dark:bg-green-500',
                        isNegated && 'bg-red-600 dark:bg-red-500'
                      )}>
                        {isSelected && !isNegated && <Check className="h-3 w-3 text-white" />}
                        {isNegated && <X className="h-3 w-3 text-white" />}
                        {!isSelected && <Minus className="h-3 w-3 text-muted-foreground/50" />}
                      </div>

                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <ColorBadge
                            color={getTagTypeColor(tag.tag_type)}
                            size="sm"
                            className={cn(
                              'w-fit truncate',
                              isNegated && 'line-through opacity-75'
                            )}
                          >
                            {tag.display_name_english}
                          </ColorBadge>
                          {isNegated && (
                            <span className="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase">
                              NOT
                            </span>
                          )}
                        </div>
                        {tag.display_name_hebrew && (
                          <span className={cn(
                            'text-xs text-muted-foreground font-hebrew leading-none truncate',
                            isNegated && 'line-through opacity-75'
                          )}>
                            {tag.display_name_hebrew}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Legend */}
            <div className="flex items-center gap-4 px-3 py-2 border-t text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-green-600 flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-white" />
                </div>
                Include
              </span>
              <span className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-red-600 flex items-center justify-center">
                  <X className="h-2.5 w-2.5 text-white" />
                </div>
                Exclude (NOT)
              </span>
              <span className="flex items-center gap-1">
                <div className="w-4 h-4 rounded border border-muted-foreground/30 flex items-center justify-center">
                  <Minus className="h-2.5 w-2.5 text-muted-foreground/50" />
                </div>
                Unselected
              </span>
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
