'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Printer, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApi } from '@/lib/api-client';
import { usePreferences } from '@/lib/contexts/PreferencesContext';
import { toast } from 'sonner';

interface ZmanimCounts {
  published: number;
  draft: number;
  optional: number;
  hidden: number;
  events: number;
}

interface WeeklyCalendarSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: string; // YYYY-MM-DD format (Sunday of the week)
  localityId: number;
  localityName: string;
  zmanimCounts: ZmanimCounts;
}

export function WeeklyCalendarSelectionDialog({
  open,
  onOpenChange,
  startDate,
  localityId,
  localityName,
  zmanimCounts,
}: WeeklyCalendarSelectionDialogProps) {
  const api = useApi();
  const { preferences } = usePreferences();

  const [includeDraft, setIncludeDraft] = useState(false);
  const [includeOptional, setIncludeOptional] = useState(false);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset selections when dialog opens
  useEffect(() => {
    if (open) {
      setIncludeDraft(false);
      setIncludeOptional(false);
      setIncludeHidden(false);
      setError(null);
    }
  }, [open]);

  // Calculate total zmanim count (published + events are always included)
  const totalCount =
    zmanimCounts.published +
    zmanimCounts.events +
    (includeDraft ? zmanimCounts.draft : 0) +
    (includeOptional ? zmanimCounts.optional : 0) +
    (includeHidden ? zmanimCounts.hidden : 0);

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await api.postRaw('/publisher/calendar/weekly-pdf', {
        body: JSON.stringify({
          start_date: startDate,
          locality_id: localityId,
          language: preferences.language, // Respect user's language preference
          include_draft: includeDraft,
          include_optional: includeOptional,
          include_hidden: includeHidden,
          include_events: true, // Event zmanim are always included
        }),
      });

      // Get the PDF blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename: Zmanim_Weekly_[Location]_[Date].pdf
      const locationName = localityName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Zmanim_Weekly_${locationName}_${startDate}.pdf`;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Weekly calendar downloaded successfully');

      onOpenChange(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate weekly calendar PDF';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Weekly Calendar Options</DialogTitle>
          <DialogDescription>
            Select which types of zmanim to include on your printable calendar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Published zmanim - always included */}
          <div className="flex items-start gap-3 rounded-lg border border-green-500/50 bg-green-50 dark:bg-green-950/20 p-3">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-green-500 text-white">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Label className="font-medium text-foreground">
                  Published zmanim
                </Label>
                <span className="inline-block rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Always included
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {zmanimCounts.published} zmanim • Finalized and approved for publication
              </p>
            </div>
          </div>

          {/* Event zmanim - always included */}
          <div className="flex items-start gap-3 rounded-lg border border-purple-500/50 bg-purple-50 dark:bg-purple-950/20 p-3">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-purple-500 text-white">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Label className="font-medium text-foreground">
                  Event zmanim
                </Label>
                <span className="inline-block rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Always included
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {zmanimCounts.events} zmanim • Candle lighting, Havdalah, fast times
              </p>
            </div>
          </div>

          {/* Optionally include section */}
          <div className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Optionally include:
            </div>

            {/* Draft zmanim */}
            <label className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/30 cursor-pointer transition-colors">
              <Checkbox
                id="draft"
                checked={includeDraft}
                onCheckedChange={(checked) => setIncludeDraft(checked === true)}
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="draft" className="font-medium text-foreground cursor-pointer">
                    Draft zmanim
                  </Label>
                  <span className="inline-block rounded-full bg-yellow-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Beta
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {zmanimCounts.draft} zmanim • In testing, not yet published
                </p>
              </div>
            </label>

            {/* Optional zmanim */}
            <label className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/30 cursor-pointer transition-colors">
              <Checkbox
                id="optional"
                checked={includeOptional}
                onCheckedChange={(checked) => setIncludeOptional(checked === true)}
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="optional" className="font-medium text-foreground cursor-pointer">
                    Optional zmanim
                  </Label>
                  <span className="inline-block rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Optional
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {zmanimCounts.optional} zmanim • Alternative or supplementary times
                </p>
              </div>
            </label>

            {/* Hidden zmanim */}
            <label className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/30 cursor-pointer transition-colors">
              <Checkbox
                id="hidden"
                checked={includeHidden}
                onCheckedChange={(checked) => setIncludeHidden(checked === true)}
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="hidden" className="font-medium text-foreground cursor-pointer">
                    Hidden zmanim
                  </Label>
                  <span className="inline-block rounded-full bg-gray-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Hidden
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {zmanimCounts.hidden} zmanim • Deprecated or disabled
                </p>
              </div>
            </label>
          </div>

          {/* Total count */}
          <div className="rounded-md bg-muted/50 p-3 text-center text-sm text-muted-foreground">
            Calendar will include <strong className="font-semibold text-foreground">{totalCount} zmanim</strong>
          </div>

          {/* Info box */}
          <div className="flex items-start gap-3 rounded-lg border border-blue-500/50 bg-blue-50 dark:bg-blue-950/20 p-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <p className="text-sm text-blue-900 dark:text-blue-100">
              All selected zmanim will appear on the calendar in their defined display order.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGeneratePDF}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Printer className="mr-2 h-4 w-4" />
                Generate PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
