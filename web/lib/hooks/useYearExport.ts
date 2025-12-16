/**
 * Year Export Hook
 *
 * Hook for exporting a full Hebrew year of zmanim calculations.
 * Generates Excel spreadsheet with Shtetl (calculated) and Control columns.
 */

import { useMutation } from '@tanstack/react-query';
import { useApi } from '@/lib/api-client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// Types from the API
interface YearExportLocation {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

interface YearExportDayRow {
  date: string;
  day_of_week: string;
  hebrew_date: string;
  times: Record<string, string>;
}

interface YearExportResponse {
  publisher: string;
  hebrew_year: number;
  location: YearExportLocation;
  generated_at: string;
  zmanim_order: string[];
  zmanim_labels: Record<string, string>;
  days: YearExportDayRow[];
}

export interface YearExportParams {
  hebrewYear: number;
  /** Locality ID - backend resolves coordinates/timezone */
  localityId: number;
}

/**
 * Generate Excel workbook from year export data
 */
function generateExcelWorkbook(data: YearExportResponse): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Build header rows
  // Row 1: Merged headers for each zman (Zman Name spans 2 columns: Shtetl, Control)
  // Row 2: Shtetl | Control for each zman

  const headerRow1: (string | null)[] = ['Date', 'Day', 'Hebrew Date'];
  const headerRow2: string[] = ['', '', ''];

  for (const zmanKey of data.zmanim_order) {
    const label = data.zmanim_labels[zmanKey] || zmanKey;
    headerRow1.push(label, null); // Second cell is null (will be merged)
    headerRow2.push('Shtetl', 'Control');
  }

  // Build data rows
  const dataRows: (string | number)[][] = data.days.map((day) => {
    const row: (string | number)[] = [day.date, day.day_of_week, day.hebrew_date];

    for (const zmanKey of data.zmanim_order) {
      const time = day.times[zmanKey] || '';
      row.push(time, ''); // Shtetl time, empty Control column
    }

    return row;
  });

  // Combine all rows
  const allRows = [headerRow1, headerRow2, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Set column widths
  const colWidths: { wch: number }[] = [
    { wch: 12 }, // Date
    { wch: 5 },  // Day
    { wch: 18 }, // Hebrew Date
  ];
  for (let i = 0; i < data.zmanim_order.length; i++) {
    colWidths.push({ wch: 9 }, { wch: 9 }); // Shtetl, Control
  }
  ws['!cols'] = colWidths;

  // Create merges for header row (zman names spanning 2 columns)
  const merges: XLSX.Range[] = [];
  let col = 3; // Start after Date, Day, Hebrew Date
  for (let i = 0; i < data.zmanim_order.length; i++) {
    merges.push({
      s: { r: 0, c: col },     // Start: row 0, column col
      e: { r: 0, c: col + 1 }  // End: row 0, column col+1
    });
    col += 2;
  }
  ws['!merges'] = merges;

  XLSX.utils.book_append_sheet(wb, ws, 'Zmanim Comparison');

  // Add notes sheet
  const notesData = [
    [`${data.publisher} Zmanim Export - Hebrew Year ${data.hebrew_year}`],
    [''],
    ['Location:'],
    [`  Name: ${data.location.name}`],
    [`  Coordinates: ${data.location.latitude.toFixed(4)}, ${data.location.longitude.toFixed(4)}`],
    [`  Timezone: ${data.location.timezone}`],
    [''],
    ['Column Structure:'],
    ['  Each zman has 2 columns:'],
    ['  - Shtetl: Calculated time from our system'],
    ['  - Control: Empty column for comparison data'],
    [''],
    ['Times include seconds for precision (HH:MM:SS)'],
    [''],
    [`Generated: ${data.generated_at}`],
    [`Total days: ${data.days.length}`],
    [`Total zmanim: ${data.zmanim_order.length}`],
  ];

  const wsNotes = XLSX.utils.aoa_to_sheet(notesData);
  wsNotes['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsNotes, 'Notes');

  return wb;
}

/**
 * Hook to export a full Hebrew year of zmanim as Excel
 */
export function useYearExport() {
  const api = useApi();

  return useMutation({
    mutationFn: async (params: YearExportParams) => {
      // Fetch data from API - backend resolves coordinates from locality_id
      const response = await api.get<YearExportResponse>(
        `/publisher/zmanim/year?hebrew_year=${params.hebrewYear}&locality_id=${params.localityId}`
      );

      // Generate Excel workbook
      const wb = generateExcelWorkbook(response);

      // Create filename
      const filename = `${response.publisher.replace(/\s+/g, '-')}-zmanim-${params.hebrewYear}.xlsx`;

      // Write to buffer and trigger download
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { filename, daysCount: response.days.length, zmanimCount: response.zmanim_order.length };
    },
    onSuccess: (result) => {
      toast.success(`Exported ${result.daysCount} days with ${result.zmanimCount} zmanim to ${result.filename}`);
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Export failed';
      toast.error(message);
    },
  });
}

/**
 * Get available Hebrew years for export (5 years back, 5 years forward)
 */
export function getAvailableHebrewYears(): number[] {
  // Calculate current Hebrew year approximately
  const now = new Date();
  const gregorianYear = now.getFullYear();
  // Hebrew year is roughly Gregorian year + 3760
  // But we need to account for the fact that Hebrew new year is in Sept/Oct
  const month = now.getMonth(); // 0-11
  const currentHebrewYear = gregorianYear + 3760 + (month >= 8 ? 1 : 0);

  // Return 5 years back and 5 years forward
  const years: number[] = [];
  for (let i = -5; i <= 5; i++) {
    years.push(currentHebrewYear + i);
  }
  return years;
}
