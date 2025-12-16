'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  useImportSnapshot,
  useParseSnapshotFile,
  PublisherSnapshot,
} from '@/lib/hooks/usePublisherSnapshots';
import { Loader2, Upload, FileJson, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ImportSnapshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * ImportSnapshotDialog - Dialog for importing a snapshot from a JSON file
 *
 * Features:
 * - File upload with drag & drop
 * - JSON validation and preview
 * - Shows what will be imported (counts)
 * - Confirmation before overwriting current data
 */
export function ImportSnapshotDialog({ open, onOpenChange, onSuccess }: ImportSnapshotDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedSnapshot, setParsedSnapshot] = useState<PublisherSnapshot | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const parseFile = useParseSnapshotFile();
  const importSnapshot = useImportSnapshot();

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setParseError(null);
    setParsedSnapshot(null);

    try {
      const snapshot = await parseFile.mutateAsync(file);
      setParsedSnapshot(snapshot);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse file';
      setParseError(message);
      setParsedSnapshot(null);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/json') {
      handleFileSelect(file);
    } else {
      setParseError('Please drop a JSON file');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleImport = async () => {
    if (!parsedSnapshot) return;

    try {
      const result = await importSnapshot.mutateAsync({ snapshot: parsedSnapshot });

      // Build description based on what was imported
      const total = result.zmanim_created + result.zmanim_updated + result.zmanim_unchanged;
      const description = `${total} zmanim (${result.zmanim_created} created, ${result.zmanim_updated} updated)`;

      toast.success('Import completed successfully', { description });
      resetState();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Failed to import snapshot:', err);
      const message = err instanceof Error ? err.message : 'Failed to import snapshot';
      toast.error('Import failed', { description: message });
    }
  };

  const resetState = () => {
    setSelectedFile(null);
    setParsedSnapshot(null);
    setParseError(null);
    setShowConfirm(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import from JSON
            </DialogTitle>
            <DialogDescription>
              Upload a previously exported snapshot file to restore your zmanim configuration.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* File Upload Area */}
            <div
              className={`
                border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
                ${isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                ${parseError ? 'border-destructive' : ''}
                ${parsedSnapshot ? 'border-green-500 bg-green-500/5' : ''}
              `}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {parsedSnapshot ? (
                <div className="space-y-2">
                  <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />
                  <p className="font-medium text-green-700 dark:text-green-400">
                    {selectedFile?.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Click to select a different file
                  </p>
                </div>
              ) : parseError ? (
                <div className="space-y-2">
                  <XCircle className="h-10 w-10 mx-auto text-destructive" />
                  <p className="font-medium text-destructive">{parseError}</p>
                  <p className="text-sm text-muted-foreground">
                    Click to select a different file
                  </p>
                </div>
              ) : parseFile.isPending ? (
                <div className="space-y-2">
                  <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
                  <p className="text-muted-foreground">Parsing file...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <FileJson className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="font-medium">Drop a JSON file here</p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse
                  </p>
                </div>
              )}
            </div>

            {/* Snapshot Preview */}
            {parsedSnapshot && (
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-sm">Snapshot Preview</h4>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Format:</span>
                    <Badge variant="secondary" className="ml-2">
                      v{parsedSnapshot.format_version}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Exported:</span>
                    <span className="ml-2">{formatDate(parsedSnapshot.exported_at)}</span>
                  </div>
                </div>

                <div className="text-sm">
                  <span className="text-muted-foreground">Description:</span>
                  <p className="mt-1">{parsedSnapshot.description}</p>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  <Badge variant="outline">
                    {parsedSnapshot.zmanim.length} Zmanim
                  </Badge>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={importSnapshot.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => setShowConfirm(true)}
              disabled={!parsedSnapshot || importSnapshot.isPending}
            >
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Confirmation */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Import Snapshot?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground space-y-3">
                <p>
                  This will <strong>update</strong> your zmanim with the data from this snapshot.
                  Zmanim not in the snapshot will be soft-deleted.
                </p>
                {parsedSnapshot && (
                  <div className="bg-muted p-3 rounded-md text-sm">
                    <strong>Importing:</strong>
                    <ul className="mt-1 list-disc list-inside">
                      <li>{parsedSnapshot.zmanim.length} zmanim</li>
                    </ul>
                  </div>
                )}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-blue-800 dark:text-blue-200 text-sm">
                  <strong>Note:</strong> Your current state will be automatically saved before importing,
                  so you can always go back.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importSnapshot.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleImport}
              disabled={importSnapshot.isPending}
            >
              {importSnapshot.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Snapshot
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
