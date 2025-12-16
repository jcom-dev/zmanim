'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Tags } from 'lucide-react';
import {
  ZmanTag,
  useZmanTags,
  useUpdatePublisherZmanTags,
  useRevertPublisherZmanTags,
} from '@/lib/hooks/useZmanimList';
import { TagManager, type TagAssignment } from '@/components/shared/tags/TagManager';
import type { TagSelectorTag } from '@/components/shared/tags/TagSelector';

interface ZmanTagEditorProps {
  zmanKey: string;
  currentTags: ZmanTag[];
  onTagsUpdated?: () => void;
}

/**
 * ZmanTagEditor - Dialog for managing tags on a publisher zman
 *
 * Features:
 * - Uses TagManager component with negation support
 * - Shows modification indicators for tags that differ from registry
 * - Supports reverting tags to master registry state
 */
export function ZmanTagEditor({ zmanKey, currentTags, onTagsUpdated }: ZmanTagEditorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: allTags, isLoading: tagsLoading } = useZmanTags();
  const updateTags = useUpdatePublisherZmanTags(zmanKey);
  const revertTags = useRevertPublisherZmanTags(zmanKey);

  // Convert ZmanTag[] to TagSelectorTag[] format
  const allAvailableTags: TagSelectorTag[] = (allTags || []).map((tag) => ({
    id: tag.id,
    tag_key: tag.tag_key,
    tag_type: tag.tag_type,
    display_name_english: tag.display_name_english,
    display_name_hebrew: tag.display_name_hebrew || undefined,
    description: tag.description || undefined,
    sort_order: tag.sort_order,
  }));

  const handleSave = async (tags: TagAssignment[]) => {
    await updateTags.mutateAsync({ tags });
    setIsOpen(false);
    onTagsUpdated?.();
  };

  const handleRevert = async () => {
    await revertTags.mutateAsync();
    setIsOpen(false);
    onTagsUpdated?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 gap-1.5 text-xs border-dashed hover:bg-muted/50 pointer-events-auto relative z-10"
        >
          <Tags className="h-3.5 w-3.5" />
          {currentTags.length > 0 ? `Edit tags (${currentTags.length})` : 'Add tags'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Tags</DialogTitle>
          <DialogDescription>
            Select tags to categorize this zman. Event and Jewish day tags support negation (exclude mode).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {tagsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : allAvailableTags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tags available
            </div>
          ) : (
            <TagManager
              currentTags={currentTags}
              allAvailableTags={allAvailableTags}
              onSave={handleSave}
              onRevert={handleRevert}
              showModificationIndicators={true}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
