'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Trash2, RotateCcw, Loader2, AlertTriangle, Archive, Skull } from 'lucide-react';
import {
  useDeletedZmanim,
  useRestoreZman,
  usePermanentDeleteZman,
  DeletedZman,
} from '@/lib/hooks/useZmanimList';
import { usePreferences } from '@/lib/contexts/PreferencesContext';

/**
 * DeletedZmanItem - Individual deleted zman card within the dialog
 */
function DeletedZmanItem({
  zman,
  onRestore,
  onPurge,
  isRestoring,
  isPurging,
}: {
  zman: DeletedZman;
  onRestore: () => void;
  onPurge: () => void;
  isRestoring: boolean;
  isPurging: boolean;
}) {
  const { preferences } = usePreferences();
  const isHebrew = preferences.language === 'he';

  const deletedDate = new Date(zman.deleted_at);
  const formattedDate = deletedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = deletedDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div
      className="group relative p-4 rounded-lg border border-destructive/20 bg-destructive/5
                 hover:bg-destructive/10 hover:border-destructive/30
                 transition-all duration-200 ease-out overflow-hidden"
    >
      {/* Subtle corner accent */}
      <div className="absolute top-0 right-0 w-8 h-8 overflow-hidden">
        <div className="absolute -top-4 -right-4 w-8 h-8 bg-destructive/10 rotate-45" />
      </div>

      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-2 overflow-hidden">
          {/* Name - respects language preference */}
          <div>
            <h4 className="font-semibold text-foreground leading-tight">
              {isHebrew ? zman.hebrew_name : zman.english_name}
            </h4>
            <p className="text-sm text-muted-foreground">
              {isHebrew ? zman.english_name : zman.hebrew_name}
            </p>
          </div>

          {/* Formula - wrap with line breaks */}
          <div className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded break-all">
            {zman.formula_dsl}
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Trash2 className="h-3 w-3" />
              Deleted {formattedDate} at {formattedTime}
            </span>
            {zman.time_category && (
              <>
                <span className="text-border">•</span>
                <Badge variant="outline" className="text-xs py-0 h-5">
                  {zman.time_category}
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={onRestore}
                disabled={isRestoring || isPurging}
                className="gap-1.5 border-primary/30 hover:border-primary hover:bg-primary/10"
              >
                {isRestoring ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Restore
              </Button>
            </TooltipTrigger>
            <TooltipContent>Restore this zman</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={onPurge}
                disabled={isRestoring || isPurging}
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {isPurging ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Skull className="h-3.5 w-3.5" />
                )}
                Purge
              </Button>
            </TooltipTrigger>
            <TooltipContent>Permanently delete</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

/**
 * PurgeConfirmDialog - Confirmation dialog for permanent deletion
 */
function PurgeConfirmDialog({
  zman,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  zman: DeletedZman | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const { preferences } = usePreferences();
  const isHebrew = preferences.language === 'he';

  if (!zman) return null;

  const displayName = isHebrew ? zman.hebrew_name : zman.english_name;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Permanently Delete?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                You are about to permanently delete{' '}
                <strong className="text-foreground">{displayName}</strong>.
              </p>
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-destructive text-sm">
                <div className="flex items-start gap-2">
                  <Skull className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <strong>This action is irreversible.</strong>
                    <p className="mt-1 text-destructive/80">
                      The zman will be permanently removed from the database and cannot be recovered.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              'Delete Forever'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * DeletedZmanimDialog - Main dialog for viewing and managing deleted zmanim
 */
export function DeletedZmanimDialog() {
  const [open, setOpen] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<DeletedZman | null>(null);
  const [restoringKey, setRestoringKey] = useState<string | null>(null);

  const { data: deletedZmanim = [], isLoading } = useDeletedZmanim();
  const restoreZman = useRestoreZman();
  const permanentDelete = usePermanentDeleteZman();

  const handleRestore = async (zman: DeletedZman) => {
    setRestoringKey(zman.zman_key);
    try {
      await restoreZman.mutateAsync(zman.zman_key);
      setOpen(false);
    } finally {
      setRestoringKey(null);
    }
  };

  const handlePurge = async () => {
    if (!purgeTarget) return;
    try {
      await permanentDelete.mutateAsync(purgeTarget.zman_key);
      setPurgeTarget(null);
      setOpen(false);
    } catch {
      // Error handling is done by React Query
    }
  };

  const count = deletedZmanim.length;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <Archive className="h-4 w-4" />
            <span>Deleted</span>
            {count > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 px-1.5 min-w-5"
              >
                {count}
              </Badge>
            )}
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-muted-foreground" />
              Deleted Zmanim
            </DialogTitle>
            <DialogDescription>
              {count === 0
                ? 'No deleted zmanim. Deleted items will appear here for restoration.'
                : `${count} deleted ${count === 1 ? 'zman' : 'zmanim'} available for restoration or permanent removal.`}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">Loading deleted zmanim...</p>
            </div>
          ) : count === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="relative">
                <Archive className="h-16 w-16 text-muted-foreground/30" />
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">0</span>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Nothing in the archive
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Deleted zmanim will appear here
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px] -mx-6 px-6">
              <div className="space-y-3 py-1">
                {deletedZmanim.map((zman) => (
                  <DeletedZmanItem
                    key={zman.id}
                    zman={zman}
                    onRestore={() => handleRestore(zman)}
                    onPurge={() => setPurgeTarget(zman)}
                    isRestoring={restoringKey === zman.zman_key}
                    isPurging={permanentDelete.isPending && purgeTarget?.zman_key === zman.zman_key}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <PurgeConfirmDialog
        zman={purgeTarget}
        open={!!purgeTarget}
        onOpenChange={(open) => !open && setPurgeTarget(null)}
        onConfirm={handlePurge}
        isPending={permanentDelete.isPending}
      />
    </>
  );
}
