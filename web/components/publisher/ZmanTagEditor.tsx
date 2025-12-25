'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tags } from 'lucide-react';
import { ZmanTag } from '@/lib/hooks/useZmanimList';
import { TagEditorDialog } from '@/components/shared/tags/TagEditorDialog';

interface ZmanTagEditorProps {
  zmanKey: string;
  currentTags: ZmanTag[];
  onTagsUpdated?: () => void;
}

/**
 * ZmanTagEditor - Dialog trigger for managing tags on a publisher zman
 *
 * Features:
 * - Uses TagEditorDialog component with 3 tabs (Event/Timing/Opinion)
 * - Event tab supports negation (include/exclude), other tabs are checkboxes only
 * - Timing tab enabled only when at least one event tag is selected
 * - Shows modification indicators for tags that differ from registry
 * - Supports reverting tags to master registry state
 */
export function ZmanTagEditor({ zmanKey, currentTags, onTagsUpdated }: ZmanTagEditorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 gap-1.5 text-xs border-dashed hover:bg-muted/50 pointer-events-auto relative z-10"
        onClick={() => setIsOpen(true)}
      >
        <Tags className="h-3.5 w-3.5" />
        {currentTags.length > 0 ? `Edit tags (${currentTags.length})` : 'Add tags'}
      </Button>

      <TagEditorDialog
        zmanKey={zmanKey}
        currentTags={currentTags}
        open={isOpen}
        onOpenChange={setIsOpen}
        onTagsUpdated={onTagsUpdated}
      />
    </>
  );
}
