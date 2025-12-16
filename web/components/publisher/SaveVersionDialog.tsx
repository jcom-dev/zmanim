'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSaveVersion } from '@/lib/hooks/usePublisherSnapshots';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface SaveVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * SaveVersionDialog - Dialog for saving the current publisher state as a named version
 *
 * Features:
 * - Optional description input (defaults to "Version save - {datetime}")
 * - Shows loading state during save
 * - Success toast notification
 */
export function SaveVersionDialog({ open, onOpenChange, onSuccess }: SaveVersionDialogProps) {
  const [description, setDescription] = useState('');
  const saveVersion = useSaveVersion();

  const handleSave = async () => {
    try {
      await saveVersion.mutateAsync({
        description: description.trim() || undefined, // Let backend use default if empty
      });
      toast.success('Version saved successfully');
      setDescription('');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Failed to save version:', err);
      toast.error('Failed to save version');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setDescription('');
    }
    onOpenChange(newOpen);
  };

  // Generate default description preview
  const defaultDescription = `Version save - ${new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Save Version
          </DialogTitle>
          <DialogDescription>
            Create a snapshot of your current publisher configuration. You can restore this version later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder={defaultDescription}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saveVersion.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use the default format
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={saveVersion.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveVersion.isPending}
          >
            {saveVersion.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Save Version
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
