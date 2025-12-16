'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useSnapshotList,
  useRestoreSnapshot,
  useDeleteSnapshot,
  SnapshotMeta,
} from '@/lib/hooks/usePublisherSnapshots';
import { Loader2, History, RotateCcw, Trash2, AlertTriangle, Clock, FileJson } from 'lucide-react';
import { toast } from 'sonner';

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore?: () => void;
}

/**
 * VersionHistoryDialog - Dialog for viewing and managing saved versions
 *
 * Features:
 * - List of saved versions with description and timestamp
 * - Restore version (auto-saves current state first)
 * - Delete version
 * - Shows confirmation dialogs for destructive actions
 */
export function VersionHistoryDialog({ open, onOpenChange, onRestore }: VersionHistoryDialogProps) {
  const { data, isLoading, refetch } = useSnapshotList();
  const restoreSnapshot = useRestoreSnapshot();
  const deleteSnapshot = useDeleteSnapshot();

  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotMeta | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const snapshots = data?.snapshots || [];

  const handleRestore = async () => {
    if (!selectedSnapshot) return;

    try {
      await restoreSnapshot.mutateAsync(selectedSnapshot.id);
      toast.success('Version restored successfully', {
        description: 'Your previous state was auto-saved before restoring.',
      });
      setShowRestoreConfirm(false);
      setSelectedSnapshot(null);
      onRestore?.();
      refetch();
    } catch (err) {
      console.error('Failed to restore version:', err);
      toast.error('Failed to restore version');
    }
  };

  const handleDelete = async () => {
    if (!selectedSnapshot) return;

    try {
      await deleteSnapshot.mutateAsync(selectedSnapshot.id);
      toast.success('Version deleted');
      setShowDeleteConfirm(false);
      setSelectedSnapshot(null);
      refetch();
    } catch (err) {
      console.error('Failed to delete version:', err);
      toast.error('Failed to delete version');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const isAutoSave = (description: string) => {
    return description.toLowerCase().includes('auto-save');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Version History
            </DialogTitle>
            <DialogDescription>
              View and restore previous versions of your publisher configuration.
              Maximum 20 versions are kept.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : snapshots.length === 0 ? (
              <div className="text-center py-8">
                <FileJson className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">No saved versions yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Use &quot;Save Version&quot; to create your first snapshot
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[350px] pr-4">
                <div className="space-y-3">
                  {snapshots.map((snapshot, index) => (
                    <div
                      key={snapshot.id}
                      className="p-4 rounded-lg border border-border hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-sm truncate">
                              {snapshot.description}
                            </h4>
                            {index === 0 && (
                              <Badge variant="secondary" className="text-xs">
                                Latest
                              </Badge>
                            )}
                            {isAutoSave(snapshot.description) && (
                              <Badge variant="outline" className="text-xs">
                                Auto-save
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatDate(snapshot.created_at)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedSnapshot(snapshot);
                              setShowRestoreConfirm(true);
                            }}
                            disabled={restoreSnapshot.isPending || deleteSnapshot.isPending}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedSnapshot(snapshot);
                              setShowDeleteConfirm(true);
                            }}
                            disabled={restoreSnapshot.isPending || deleteSnapshot.isPending}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation */}
      <AlertDialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Restore Version?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will replace your current configuration with the selected version.
              </p>
              {selectedSnapshot && (
                <div className="bg-muted p-3 rounded-md text-sm">
                  <strong>Version:</strong> {selectedSnapshot.description}
                  <br />
                  <strong>Created:</strong> {formatDate(selectedSnapshot.created_at)}
                </div>
              )}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-blue-800 dark:text-blue-200 text-sm">
                <strong>Note:</strong> Your current state will be automatically saved before restoring,
                so you can always go back.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreSnapshot.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={restoreSnapshot.isPending}
            >
              {restoreSnapshot.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore Version
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Version?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Are you sure you want to delete this version? This action cannot be undone.
              </p>
              {selectedSnapshot && (
                <div className="bg-muted p-3 rounded-md text-sm">
                  <strong>Version:</strong> {selectedSnapshot.description}
                  <br />
                  <strong>Created:</strong> {formatDate(selectedSnapshot.created_at)}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSnapshot.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteSnapshot.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteSnapshot.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Version
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
