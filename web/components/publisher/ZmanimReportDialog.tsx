'use client';

import { useState, useCallback, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Loader2, Printer, MapPin, Calendar, FileText, AlertCircle } from 'lucide-react';
import { LocalityPicker } from '@/components/shared/LocalityPicker';
import { useApi } from '@/lib/api-client';
import { toast } from 'sonner';
import type { LocalitySelection } from '@/types/geography';

interface ZmanimReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLocalityId?: number;
  defaultLocalityName?: string;
}

export function ZmanimReportDialog({
  open,
  onOpenChange,
  defaultLocalityId,
  defaultLocalityName,
}: ZmanimReportDialogProps) {
  const api = useApi();

  const [selectedLocality, setSelectedLocality] = useState<LocalitySelection | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
  });
  const [includeGlossary, setIncludeGlossary] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default locality when dialog opens or defaults change
  useEffect(() => {
    if (open && defaultLocalityId && defaultLocalityName && !selectedLocality) {
      setSelectedLocality({
        type: 'locality',
        id: String(defaultLocalityId),
        name: defaultLocalityName,
        description: defaultLocalityName,
      });
    }
  }, [open, defaultLocalityId, defaultLocalityName, selectedLocality]);

  const handleLocalityChange = useCallback((selection: LocalitySelection | LocalitySelection[]) => {
    if (Array.isArray(selection)) {
      setSelectedLocality(selection.length > 0 ? selection[0] : null);
    } else {
      setSelectedLocality(selection);
    }
    setError(null);
  }, []);

  const handleGeneratePDF = async () => {
    if (!selectedLocality) {
      setError('Please select a location');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await api.postRaw('/publisher/reports/zmanim-pdf', {
        body: JSON.stringify({
          locality_id: parseInt(selectedLocality.id, 10),
          date: selectedDate,
          include_glossary: includeGlossary,
        }),
      });

      // Get the PDF blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename
      const locationName = selectedLocality.name.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Zmanim_${locationName}_${selectedDate}.pdf`;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Zmanim report downloaded successfully');

      onOpenChange(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate PDF report';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDisplayDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            Generate Zmanim Report
          </DialogTitle>
          <DialogDescription>
            Generate a comprehensive PDF report of your published zmanim for a specific location and date.
            The report includes calculated times, formulas, and explanations.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Location Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Location
            </Label>
            <LocalityPicker
              mode="single"
              variant="dropdown"
              filterPreset="coverage"
              onSelect={handleLocalityChange}
              placeholder="Search for a location..."
            />
            {selectedLocality && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedLocality.name}
                {selectedLocality.region && `, ${selectedLocality.region}`}
                {selectedLocality.country_code && ` (${selectedLocality.country_code})`}
              </p>
            )}
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label htmlFor="report-date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Date
            </Label>
            <div className="flex gap-2">
              <input
                id="report-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              >
                Today
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDisplayDate(selectedDate)}
            </p>
          </div>

          {/* Glossary Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="include-glossary" className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Include Glossary
              </Label>
              <p className="text-sm text-muted-foreground">
                Add detailed explanations of primitives and functions used in your formulas.
              </p>
            </div>
            <Switch
              id="include-glossary"
              checked={includeGlossary}
              onCheckedChange={setIncludeGlossary}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Info Note */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <strong>Note:</strong> The PDF will include all your enabled zmanim with their calculated times,
            DSL formulas, and explanations. Generation may take a few seconds.
          </div>
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
            disabled={!selectedLocality || isGenerating}
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
