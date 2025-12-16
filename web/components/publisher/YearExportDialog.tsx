'use client';

import { useState } from 'react';
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
import { Loader2, Download, MapPin } from 'lucide-react';
import { useYearExport, getAvailableHebrewYears } from '@/lib/hooks/useYearExport';

interface YearExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Locality ID for the export - backend resolves coordinates/timezone */
  localityId?: number;
}

export function YearExportDialog({
  open,
  onOpenChange,
  localityId,
}: YearExportDialogProps) {
  const yearExport = useYearExport();
  const availableYears = getAvailableHebrewYears();

  // Default to current Hebrew year (middle of the list)
  const [selectedYear, setSelectedYear] = useState<number>(availableYears[5]);

  const handleExport = async () => {
    if (!localityId) return;

    await yearExport.mutateAsync({
      hebrewYear: selectedYear,
      localityId,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Full Year
          </DialogTitle>
          <DialogDescription>
            Download a complete Hebrew year of zmanim calculations as an Excel spreadsheet.
            Each zman will have two columns: Shtetl (calculated) and Control (empty for comparison).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Hebrew Year Selection */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="year" className="text-right">
              Hebrew Year
            </Label>
            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="col-span-3">
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

          {/* Location display */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              <MapPin className="h-4 w-4 inline mr-1" />
              Location
            </Label>
            <div className="col-span-3 text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
              {localityId ? `Locality ID: ${localityId}` : 'No location selected'}
            </div>
          </div>
        </div>

        {!localityId && (
          <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-md mb-4">
            Please select a location on the Algorithm page before exporting.
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
