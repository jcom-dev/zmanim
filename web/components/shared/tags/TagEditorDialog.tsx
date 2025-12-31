/**
 * @file TagEditorDialog.tsx
 * @purpose Dialog for editing zman tags with tabbed interface organized by tag type
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Save, RotateCcw, AlertCircle } from 'lucide-react';
import {
  ZmanTag,
  useZmanTags,
  useUpdatePublisherZmanTags,
  useRevertPublisherZmanTags,
} from '@/lib/hooks/useZmanimList';
import { TagSelectorWithNegation } from './TagSelectorWithNegation';
import { TagSelector, type TagSelectorTag } from './TagSelector';
import { TagChip } from './TagChip';
import { Tag, TagType } from './constants';
import { cn } from '@/lib/utils';

export interface TagAssignment {
  tag_id: number;
  is_negated: boolean;
}

interface TagEditorDialogProps {
  /** The zman being edited */
  zmanKey: string;
  /** Current tag assignments */
  currentTags: ZmanTag[];
  /** Dialog open state */
  open: boolean;
  /** Dialog state handler */
  onOpenChange: (open: boolean) => void;
  /** Callback after save */
  onTagsUpdated?: () => void;
}

/**
 * TagEditorDialog - Tabbed dialog for managing tags on a publisher zman
 *
 * Features:
 * - 3 tabs: Event (with negation), Timing, Opinion (simple checkboxes)
 * - Timing tab enabled only when at least one event tag is selected
 * - Modification indicators for tags that differ from registry
 * - Supports reverting tags to master registry state
 * - Save and Revert buttons with state management
 */
export function TagEditorDialog({
  zmanKey,
  currentTags,
  open,
  onOpenChange,
  onTagsUpdated,
}: TagEditorDialogProps) {
  const { data: allTags, isLoading: tagsLoading } = useZmanTags();
  const updateTags = useUpdatePublisherZmanTags(zmanKey);
  const revertTags = useRevertPublisherZmanTags(zmanKey);

  // Track selected tag IDs and negated tag IDs
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(() => {
    const ids = currentTags
      .map((t) => {
        const id = typeof t.id === 'string' ? parseInt(t.id, 10) : t.id;
        return isNaN(id) ? 0 : id;
      })
      .filter((id) => id > 0);
    return ids;
  });

  const [negatedTagIds, setNegatedTagIds] = useState<number[]>(() => {
    const ids = currentTags
      .filter((t) => t.is_negated)
      .map((t) => {
        const id = typeof t.id === 'string' ? parseInt(t.id, 10) : t.id;
        return isNaN(id) ? 0 : id;
      })
      .filter((id) => id > 0);
    return ids;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens or currentTags changes
  useEffect(() => {
    if (open) {
      const ids = currentTags
        .map((t) => {
          const id = typeof t.id === 'string' ? parseInt(t.id, 10) : t.id;
          return isNaN(id) ? 0 : id;
        })
        .filter((id) => id > 0);
      setSelectedTagIds(ids);

      const negatedIds = currentTags
        .filter((t) => t.is_negated)
        .map((t) => {
          const id = typeof t.id === 'string' ? parseInt(t.id, 10) : t.id;
          return isNaN(id) ? 0 : id;
        })
        .filter((id) => id > 0);
      setNegatedTagIds(negatedIds);
    }
  }, [open, currentTags]);

  // Convert ZmanTag[] to TagSelectorTag[] format, filtering out hidden tags
  const allAvailableTags: TagSelectorTag[] = useMemo(() => {
    return (allTags || [])
      .filter((tag) => !tag.is_hidden) // Filter out hidden tags
      .map((tag) => ({
        id: tag.id,
        tag_key: tag.tag_key,
        tag_type: tag.tag_type,
        display_name_english: tag.display_name_english,
        display_name_english_ashkenazi: tag.display_name_english_ashkenazi,
        display_name_english_sephardi: tag.display_name_english_sephardi,
        display_name_hebrew: tag.display_name_hebrew || undefined,
        description: tag.description || undefined,
        sort_order: tag.sort_order,
        is_hidden: tag.is_hidden,
      }));
  }, [allTags]);

  // Split tags by type for each tab
  const tagsByType = useMemo(() => {
    const eventTags = allAvailableTags.filter((t) => t.tag_type === 'event');
    const categoryTags = allAvailableTags.filter((t) => t.tag_type === 'category');
    const timingTags = allAvailableTags.filter((t) => t.tag_type === 'timing');
    const shitaTags = allAvailableTags.filter((t) => t.tag_type === 'shita');

    return { eventTags, categoryTags, timingTags, shitaTags };
  }, [allAvailableTags]);

  // Check if there are any modifications from master
  const hasModifications = useMemo(() => {
    return currentTags.some((t) => t.is_modified);
  }, [currentTags]);

  // Check if current state differs from saved state
  const hasUnsavedChanges = useMemo(() => {
    const currentIds = new Set(currentTags.map((t) => t.id));
    const currentNegated = new Set(currentTags.filter((t) => t.is_negated).map((t) => t.id));
    const selectedIds = new Set(selectedTagIds);
    const negatedIds = new Set(negatedTagIds);

    // Check if selection changed
    if (currentIds.size !== selectedIds.size) return true;
    for (const id of currentIds) {
      if (!selectedIds.has(id)) return true;
    }
    for (const id of selectedIds) {
      if (!currentIds.has(id)) return true;
    }

    // Check if negation changed
    if (currentNegated.size !== negatedIds.size) return true;
    for (const id of currentNegated) {
      if (!negatedIds.has(id)) return true;
    }
    for (const id of negatedIds) {
      if (!currentNegated.has(id)) return true;
    }

    return false;
  }, [currentTags, selectedTagIds, negatedTagIds]);

  // Toggle tag for negatable tags (3-state: Event)
  const handleToggleEventTag = (tagId: number) => {
    setSelectedTagIds((prev) => {
      const isSelected = prev.includes(tagId);
      const isNegated = negatedTagIds.includes(tagId);

      if (!isSelected) {
        // Unselected → Positive
        return [...prev, tagId];
      } else if (!isNegated) {
        // Positive → Negated
        setNegatedTagIds((negated) => [...negated, tagId]);
        return prev; // Keep selected
      } else {
        // Negated → Unselected
        setNegatedTagIds((negated) => negated.filter((id) => id !== tagId));
        return prev.filter((id) => id !== tagId);
      }
    });
  };

  // Toggle tag for non-negatable tags (simple checkbox)
  const handleToggleSimpleTag = (tagId: number) => {
    setSelectedTagIds((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      } else {
        return [...prev, tagId];
      }
    });
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const assignments: TagAssignment[] = selectedTagIds.map((tagId) => ({
        tag_id: tagId,
        is_negated: negatedTagIds.includes(tagId),
      }));

      await updateTags.mutateAsync({ tags: assignments });
      onOpenChange(false);
      onTagsUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tags');
    } finally {
      setIsSaving(false);
    }
  };

  // Revert to master registry
  const handleRevert = async () => {
    setIsReverting(true);
    setError(null);

    try {
      await revertTags.mutateAsync();
      onOpenChange(false);
      onTagsUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revert tags');
    } finally {
      setIsReverting(false);
    }
  };

  // Preview chips
  const previewTags = useMemo(() => {
    const tags: Array<Tag & { is_negated: boolean; is_modified: boolean }> = [];

    selectedTagIds.forEach((selectedId) => {
      const availableTag = allAvailableTags.find((t) => t.id === selectedId);

      if (availableTag) {
        const currentTag = currentTags.find((ct) => ct.id === selectedId);
        // Map backend tag_type to UI TagType
        const tagType: TagType = availableTag.tag_type === 'jewish_day' ? 'event' :
                                   availableTag.tag_type === 'behavior' ? 'category' :
                                   availableTag.tag_type === 'calculation' ? 'category' :
                                   availableTag.tag_type as TagType;
        tags.push({
          id: availableTag.id,
          tag_key: availableTag.tag_key,
          display_name_hebrew: availableTag.display_name_hebrew || '',
          display_name_english: availableTag.display_name_english,
          display_name_english_ashkenazi:
            availableTag.display_name_english_ashkenazi || availableTag.display_name_english,
          display_name_english_sephardi: availableTag.display_name_english_sephardi,
          tag_type: tagType,
          sort_order: availableTag.sort_order || 0,
          is_negated: negatedTagIds.includes(selectedId),
          is_modified: currentTag?.is_modified === true,
        });
      }
    });

    return tags;
  }, [allAvailableTags, selectedTagIds, negatedTagIds, currentTags]);

  // Determine default tab (first non-empty, in order: Category, Event, Timing, Opinion)
  const defaultTab = useMemo(() => {
    if (tagsByType.categoryTags.length > 0) return 'category';
    if (tagsByType.eventTags.length > 0) return 'event';
    if (tagsByType.timingTags.length > 0) return 'timing';
    if (tagsByType.shitaTags.length > 0) return 'shita';
    return 'category';
  }, [tagsByType]);

  // Check if any event tags are selected (to enable Timing tab)
  const hasEventTagsSelected = useMemo(() => {
    const result = selectedTagIds.some((id) => {
      const tag = allAvailableTags.find((t) => t.id === id);
      return tag?.tag_type === 'event';
    });
    console.log('hasEventTagsSelected:', result, 'selectedTagIds:', selectedTagIds, 'timingTags.length:', tagsByType.timingTags.length, 'disabled will be:', tagsByType.timingTags.length === 0 || !result);
    return result;
  }, [selectedTagIds, allAvailableTags, tagsByType.eventTags]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Tags</DialogTitle>
          <DialogDescription>
            Select tags to categorize this zman. Event tags support negation (exclude mode), while Timing and Opinion tags are include-only.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {tagsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : allAvailableTags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No tags available</div>
          ) : (
            <>
              {/* Preview chips */}
              {previewTags.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Selected Tags</label>
                  <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
                    {previewTags.map((tag) => (
                      <TagChip
                        key={tag.id}
                        tag={tag}
                        size="sm"
                        showNegatedIndicator={true}
                        showModifiedIndicator={true}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Modification banner */}
              {hasModifications && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-500 bg-amber-50 dark:bg-amber-950/30">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="flex items-center justify-between flex-1 gap-2">
                    <span className="text-sm text-amber-900 dark:text-amber-100">
                      Some tags have been modified from the master registry
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRevert}
                      disabled={isReverting}
                      className="shrink-0"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      {isReverting ? 'Reverting...' : 'Revert All'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Error display */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive bg-destructive/10">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-sm text-destructive">{error}</span>
                </div>
              )}

              {/* Tabs for different tag types */}
              <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger
                    value="category"
                    disabled={tagsByType.categoryTags.length === 0}
                    className="relative"
                  >
                    Category
                    {tagsByType.categoryTags.filter((t) => selectedTagIds.includes(t.id)).length >
                      0 && (
                      <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {tagsByType.categoryTags.filter((t) => selectedTagIds.includes(t.id)).length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="event"
                    disabled={tagsByType.eventTags.length === 0}
                    className="relative"
                  >
                    Event
                    {tagsByType.eventTags.filter((t) => selectedTagIds.includes(t.id)).length >
                      0 && (
                      <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {tagsByType.eventTags.filter((t) => selectedTagIds.includes(t.id)).length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="timing"
                    disabled={tagsByType.timingTags.length === 0 || !hasEventTagsSelected}
                    className="relative"
                  >
                    Timing
                    {tagsByType.timingTags.filter((t) => selectedTagIds.includes(t.id)).length >
                      0 && (
                      <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {tagsByType.timingTags.filter((t) => selectedTagIds.includes(t.id)).length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="shita"
                    disabled={tagsByType.shitaTags.length === 0}
                    className="relative"
                  >
                    Opinion
                    {tagsByType.shitaTags.filter((t) => selectedTagIds.includes(t.id)).length >
                      0 && (
                      <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {tagsByType.shitaTags.filter((t) => selectedTagIds.includes(t.id)).length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Category Tab - simple checkbox */}
                <TabsContent value="category" className="mt-4">
                  {tagsByType.categoryTags.length > 0 ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Category Tags (Include Only)
                      </label>
                      <TagSelector
                        tags={tagsByType.categoryTags}
                        selectedTagIds={selectedTagIds.filter((id) =>
                          tagsByType.categoryTags.some((t) => t.id === id)
                        )}
                        onToggleTag={handleToggleSimpleTag}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No category tags available
                    </div>
                  )}
                </TabsContent>

                {/* Event Tab - 3-state selector with negation */}
                <TabsContent value="event" className="mt-4">
                  {tagsByType.eventTags.length > 0 ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Event Tags (Include/Exclude)
                      </label>
                      <TagSelectorWithNegation
                        tags={tagsByType.eventTags}
                        selectedTagIds={selectedTagIds.filter((id) =>
                          tagsByType.eventTags.some((t) => t.id === id)
                        )}
                        negatedTagIds={negatedTagIds}
                        onToggleTag={handleToggleEventTag}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No event tags available
                    </div>
                  )}
                </TabsContent>

                {/* Timing Tab - simple checkbox */}
                <TabsContent value="timing" className="mt-4">
                  {tagsByType.timingTags.length > 0 ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Timing Tags (Include Only)
                      </label>
                      <TagSelector
                        tags={tagsByType.timingTags}
                        selectedTagIds={selectedTagIds.filter((id) =>
                          tagsByType.timingTags.some((t) => t.id === id)
                        )}
                        onToggleTag={handleToggleSimpleTag}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No timing tags available
                    </div>
                  )}
                </TabsContent>

                {/* Opinion Tab - simple checkbox */}
                <TabsContent value="shita" className="mt-4">
                  {tagsByType.shitaTags.length > 0 ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Opinion Tags (Include Only)
                      </label>
                      <TagSelector
                        tags={tagsByType.shitaTags}
                        selectedTagIds={selectedTagIds.filter((id) =>
                          tagsByType.shitaTags.some((t) => t.id === id)
                        )}
                        onToggleTag={handleToggleSimpleTag}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No opinion tags available
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>

        {/* Footer with Save button */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving || isReverting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving || isReverting}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Tags'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
