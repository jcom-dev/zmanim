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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Download, MapPin, Calendar } from 'lucide-react';
import { LocalityPicker } from '@/components/shared/LocalityPicker';
import { useYearExport, getAvailableHebrewYears } from '@/lib/hooks/useYearExport';
import type { LocalitySelection } from '@/types/geography';

interface YearExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Default locality ID from the algorithm page */
  defaultLocalityId?: number;
  /** Default locality name for display */
  defaultLocalityName?: string;
}

export function YearExportDialog({
  open,
  onOpenChange,
  defaultLocalityId,
  defaultLocalityName,
}: YearExportDialogProps) {
  const yearExport = useYearExport();
  const availableYears = getAvailableHebrewYears();

  // Default to current Hebrew year (middle of the list)
  const [selectedYear, setSelectedYear] = useState<number>(availableYears[5]);
  const [selectedLocality, setSelectedLocality] = useState<LocalitySelection | null>(null);

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

  // Reset locality when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedLocality(null);
    }
  }, [open]);

  const handleLocalityChange = useCallback((selection: LocalitySelection | LocalitySelection[]) => {
    if (Array.isArray(selection)) {
      setSelectedLocality(selection.length > 0 ? selection[0] : null);
    } else {
      setSelectedLocality(selection);
    }
  }, []);

  const handleExport = async () => {
    if (!selectedLocality) return;

    await yearExport.mutateAsync({
      hebrewYear: selectedYear,
      localityId: parseInt(selectedLocality.id, 10),
    });

    onOpenChange(false);
  };

  const localityId = selectedLocality ? parseInt(selectedLocality.id, 10) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Export Full Year
          </DialogTitle>
          <DialogDescription>
            Download a complete Hebrew year of zmanim calculations as an Excel spreadsheet.
            Includes parsha/holiday names, location details, and DSL formulas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Hebrew Year Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Hebrew Year
            </Label>
            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
        </div>

        {!localityId && (
          <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-md mb-4">
            Please select a location to export zmanim for.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={!localityId || yearExport.isPending}>
            {yearExport.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export to Excel
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
