/**
 * @file TagManager.tsx
 * @purpose Unified tag manager with negation support, modification tracking, and revert functionality
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw, Save } from 'lucide-react';
import { TagSelectorWithNegation } from './TagSelectorWithNegation';
import { TagSelector, type TagSelectorTag } from './TagSelector';
import { TagChip } from './TagChip';
import { canNegateTag } from '@/lib/utils/tagNegation';
import { cn } from '@/lib/utils';
import type { ZmanTag } from '@/lib/hooks/useZmanimList';

export interface TagAssignment {
  tag_id: number; // Changed from string to number to match backend int32
  is_negated: boolean;
}

interface TagManagerProps {
  /** Current tags with source tracking information */
  currentTags: ZmanTag[];
  /** All available tags for selection */
  allAvailableTags: TagSelectorTag[];
  /** Callback when tags are saved */
  onSave: (tags: TagAssignment[]) => Promise<void>;
  /** Callback when tags are reverted to registry */
  onRevert?: () => Promise<void>;
  /** Show modification indicators (amber dots) */
  showModificationIndicators?: boolean;
  /** Disable all interactions */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * TagManager - Unified tag editor with negation, modification tracking, and revert
 *
 * Features:
 * - 3-state selector for negatable tags (event)
 * - Simple checkboxes for non-negatable tags (timing, shita, category)
 * - Modification indicators for tags that differ from master registry
 * - Revert functionality to reset to master state
 * - Preview chips showing current selection
 */
export function TagManager({
  currentTags,
  allAvailableTags,
  onSave,
  onRevert,
  showModificationIndicators = true,
  disabled = false,
  className,
}: TagManagerProps) {
  // Split tags into negatable and non-negatable
  const { negatableTags, nonNegatableTags } = useMemo(() => {
    const negatable: TagSelectorTag[] = [];
    const nonNegatable: TagSelectorTag[] = [];

    allAvailableTags.forEach((tag) => {
      if (canNegateTag(tag)) {
        negatable.push(tag);
      } else {
        nonNegatable.push(tag);
      }
    });

    return { negatableTags: negatable, nonNegatableTags: nonNegatable };
  }, [allAvailableTags]);

  // Track selected tag IDs and negated tag IDs
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(() => {
    const ids = currentTags.map((t) => {
      // Ensure ID is a number (convert if string for backward compatibility)
      const id = typeof t.id === 'string' ? parseInt(t.id, 10) : t.id;
      return isNaN(id) ? 0 : id;
    }).filter(id => id > 0); // Filter out invalid IDs
    return ids;
  });
  const [negatedTagIds, setNegatedTagIds] = useState<number[]>(() => {
    const ids = currentTags
      .filter((t) => t.is_negated)
      .map((t) => {
        const id = typeof t.id === 'string' ? parseInt(t.id, 10) : t.id;
        return isNaN(id) ? 0 : id;
      })
      .filter(id => id > 0);
    return ids;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Toggle tag for negatable tags (3-state)
  const handleToggleNegatableTag = useCallback((tagId: number) => {
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
  }, [negatedTagIds]);

  // Toggle tag for non-negatable tags (simple checkbox)
  const handleToggleNonNegatableTag = useCallback((tagId: number) => {
    setSelectedTagIds((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      } else {
        return [...prev, tagId];
      }
    });
  }, []);

  // Save changes
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    try {
      const assignments: TagAssignment[] = selectedTagIds.map((tagId) => ({
        tag_id: tagId,
        is_negated: negatedTagIds.includes(tagId),
      }));

      await onSave(assignments);

      // Success - parent component will refetch
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tags');
    } finally {
      setIsSaving(false);
    }
  }, [selectedTagIds, negatedTagIds, onSave]);

  // Revert to master registry
  const handleRevert = useCallback(async () => {
    if (!onRevert) return;

    setIsReverting(true);
    setError(null);

    try {
      await onRevert();

      // Reset local state to match reverted tags
      // Parent component will refetch, but we update immediately for UX
      const revertedTags = currentTags.filter((t) => t.tag_source === 'master');
      setSelectedTagIds(revertedTags.map((t) => t.id));
      setNegatedTagIds(revertedTags.filter((t) => t.is_negated).map((t) => t.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revert tags');
    } finally {
      setIsReverting(false);
    }
  }, [onRevert, currentTags]);

  // Preview chips
  const previewTags = useMemo(() => {
    const tags: any[] = [];

    // Map selected tags from allAvailableTags
    selectedTagIds.forEach((selectedId) => {
      // First try to find in allAvailableTags
      const availableTag = allAvailableTags.find((t) => t.id === selectedId);

      if (availableTag) {
        const currentTag = currentTags.find((ct) => ct.id === selectedId);
        tags.push({
          id: availableTag.id,
          tag_key: availableTag.tag_key,
          name: availableTag.display_name_english,
          display_name_hebrew: availableTag.display_name_hebrew || '',
          display_name_english: availableTag.display_name_english,
          tag_type: availableTag.tag_type as any,
          sort_order: availableTag.sort_order || 0,
          is_negated: negatedTagIds.includes(selectedId),
          is_modified: showModificationIndicators && currentTag?.is_modified === true,
        });
      } else {
        // Fallback: tag exists in selectedTagIds but not in allAvailableTags
        // This can happen if currentTags has a tag that's not in the full list yet
        const currentTag = currentTags.find((ct) => ct.id === selectedId);
        if (currentTag) {
          tags.push({
            id: currentTag.id,
            tag_key: currentTag.tag_key,
            name: currentTag.display_name_english,
            display_name_hebrew: currentTag.display_name_hebrew || '',
            display_name_english: currentTag.display_name_english,
            tag_type: currentTag.tag_type as any,
            sort_order: currentTag.sort_order || 0,
            is_negated: negatedTagIds.includes(selectedId),
            is_modified: showModificationIndicators && currentTag?.is_modified === true,
          });
        }
      }
    });

    return tags;
  }, [allAvailableTags, selectedTagIds, negatedTagIds, currentTags, showModificationIndicators]);

  return (
    <div className={cn('space-y-4', className)}>
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
                showModifiedIndicator={showModificationIndicators}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modification banner */}
      {showModificationIndicators && hasModifications && onRevert && (
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
              disabled={disabled || isReverting}
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

      {/* Negatable tags (3-state) */}
      {negatableTags.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Event Tags (Include/Exclude)
          </label>
          <TagSelectorWithNegation
            tags={negatableTags}
            selectedTagIds={selectedTagIds.filter((id) =>
              negatableTags.some((t) => t.id === id)
            )}
            negatedTagIds={negatedTagIds}
            onToggleTag={handleToggleNegatableTag}
            disabled={disabled}
          />
        </div>
      )}

      {/* Non-negatable tags (simple checkbox) */}
      {nonNegatableTags.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Classification Tags (Include Only)
          </label>
          <TagSelector
            tags={nonNegatableTags}
            selectedTagIds={selectedTagIds.filter((id) =>
              nonNegatableTags.some((t) => t.id === id)
            )}
            onToggleTag={handleToggleNonNegatableTag}
            disabled={disabled}
          />
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          onClick={handleSave}
          disabled={disabled || !hasUnsavedChanges || isSaving}
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Tags'}
        </Button>
      </div>
    </div>
  );
}
