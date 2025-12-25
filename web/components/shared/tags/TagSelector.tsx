'use client';

import { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ColorBadge, getTagTypeColor } from '@/components/ui/color-badge';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTagDisplayName } from '@/lib/hooks/usePublisherSettings';

// Flexible tag interface that works with different tag sources
export interface TagSelectorTag {
  id: number; // Changed from string to number to match backend int32
  tag_key: string;
  tag_type: string;
  display_name_english: string;
  display_name_english_ashkenazi?: string;
  display_name_english_sephardi?: string | null;
  display_name_hebrew?: string | null;
  description?: string | null;
  sort_order?: number | null;
  is_hidden?: boolean; // When true, tag is used for internal filtering only (not displayed in UI)
}

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

interface TagSelectorProps {
  tags: TagSelectorTag[];
  selectedTagIds: number[]; // Changed from string[] to number[]
  onToggleTag: (tagId: number) => void; // Changed from string to number
  tagTypeLabels?: Record<string, string>;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * TagSelector - Reusable tabbed tag selection component
 *
 * Displays tags grouped by type in tabs, with checkboxes for selection.
 * Auto-sizes to fit all tags in the selected tab.
 */
export function TagSelector({
  tags,
  selectedTagIds,
  onToggleTag,
  tagTypeLabels = {},
  isLoading = false,
  disabled = false,
  className,
}: TagSelectorProps) {
  // Get tag display name function based on publisher settings
  const getTagName = useTagDisplayName();

  // Group and sort tags by type, excluding hidden tags
  const tagGroups = useMemo(() => {
    return TAG_GROUPS.map((group) => ({
      ...group,
      tags: tags
        .filter((t) => t.tag_type === group.key && !t.is_hidden) // Filter out hidden tags
        .sort(
          (a, b) =>
            (a.sort_order ?? Number.MAX_SAFE_INTEGER) -
              (b.sort_order ?? Number.MAX_SAFE_INTEGER) ||
            getTagName(a).localeCompare(getTagName(b))
        ),
    }));
  }, [tags, getTagName]);

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
          const selectedCount = group.tags.filter((t) => selectedTagIds.includes(t.id)).length;
          return (
            <TabsTrigger
              key={group.key}
              value={group.key}
              className="text-xs px-3 py-1.5 data-[state=active]:bg-background relative"
            >
              {tagTypeLabels[group.key] || group.label}
              {selectedCount > 0 && (
                <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {selectedCount}
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
            <ScrollArea className="max-h-[300px]">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2 p-3">
                {group.tags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <label
                      key={tag.id}
                      className={cn(
                        'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer',
                        isSelected
                          ? 'bg-primary/10 border-primary/30'
                          : 'bg-card hover:bg-muted border-transparent'
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleTag(tag.id)}
                        disabled={disabled}
                        className="shrink-0"
                      />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <ColorBadge color={getTagTypeColor(tag.tag_type)} size="sm" className="w-fit truncate">
                          {getTagName(tag)}
                        </ColorBadge>
                        {tag.display_name_hebrew && (
                          <span className="text-xs text-muted-foreground font-hebrew leading-none truncate">
                            {tag.display_name_hebrew}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
