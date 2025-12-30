/**
 * Year Export Hook
 *
 * Hook for exporting a full Hebrew year of zmanim calculations.
 * Generates Excel spreadsheet matching the Machazekei HaDass Manchester format.
 */

import { useMutation } from '@tanstack/react-query';
import { useApi } from '@/lib/api-client';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { usePreferences } from '@/lib/contexts/PreferencesContext';

// Types from the API
interface YearExportLocation {
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  timezone_label: string;
  algorithm: string;
}

interface YearExportDayRow {
  date: string;
  day_of_week: string;
  hebrew_date: string;
  hebrew_date_he: string;
  parsha: string;
  parsha_he: string;
  times: Record<string, string>;
}

interface YearExportResponse {
  publisher: string;
  hebrew_year: number;
  location: YearExportLocation;
  generated_at: string;
  zmanim_order: string[];
  zmanim_labels: Record<string, string>;
  zmanim_labels_he?: Record<string, string>;
  zmanim_formulas: Record<string, string>;
  days: YearExportDayRow[];
  elevation_used: boolean;
}

export interface YearExportParams {
  hebrewYear: number;
  /** Locality ID - backend resolves coordinates/timezone */
  localityId: number;
}

/**
 * Format date as "Jan 1, 2025"
 */
function formatCivilDate(isoDate: string): string {
  const date = new Date(isoDate);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Format time as "6:27:58 AM" or "6:27 AM" or "N/A"
 */
function formatTime(time24: string | undefined, showSeconds: boolean): string {
  if (!time24) return 'N/A';

  const [hours, minutes, seconds] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

  if (showSeconds) {
    return `${hours12}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${period}`;
  } else {
    return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
  }
}

/**
 * Format day of week (use "Sha" for Saturday)
 */
function formatDayOfWeek(dow: string): string {
  return dow === 'Sat' ? 'Sha' : dow;
}

/**
 * Generate Excel workbook from year export data using ExcelJS
 */
async function generateExcelWorkbook(
  data: YearExportResponse,
  showSeconds: boolean,
  useHebrew: boolean
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();

  // Calculate Gregorian year range for sheet title
  const firstDay = new Date(data.days[0].date);
  const lastDay = new Date(data.days[data.days.length - 1].date);
  const firstYear = firstDay.getFullYear();
  const lastYear = lastDay.getFullYear();
  const yearRange = firstYear === lastYear ? `${firstYear}` : `${firstYear} - ${lastYear}`;
  const hebrewYearRange = data.hebrew_year === data.hebrew_year + 1
    ? `${data.hebrew_year}`
    : `${data.hebrew_year} - ${data.hebrew_year + 1}`;

  const sheetName = `Zmanim For ${yearRange} (${hebrewYearRange})`.substring(0, 31);
  const worksheet = workbook.addWorksheet(sheetName);

  // Build columns
  const columns: Partial<ExcelJS.Column>[] = [
    { header: ' Civil Date', key: 'civilDate', width: 14 },
    { header: useHebrew ? ' תאריך עברי' : ' Jewish Date', key: 'jewishDate', width: 22 },
    { header: ' Day of Week', key: 'dayOfWeek', width: 8 },
    { header: useHebrew ? ' פרשת השבוע / יום טוב' : ' Parshas Hashavua / Yom Tov', key: 'parsha', width: 40 },
  ];

  // Add zmanim columns
  for (const zmanKey of data.zmanim_order) {
    const label = useHebrew
      ? (data.zmanim_labels_he?.[zmanKey] || data.zmanim_labels[zmanKey] || zmanKey)
      : (data.zmanim_labels[zmanKey] || zmanKey);
    columns.push({
      header: ` ${label}`,
      key: zmanKey,
      width: 20,
    });
  }

  worksheet.columns = columns;

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4788' },
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // Add data rows
  data.days.forEach((day, index) => {
    const rowData: any = {
      civilDate: formatCivilDate(day.date),
      jewishDate: useHebrew ? day.hebrew_date_he : day.hebrew_date,
      dayOfWeek: formatDayOfWeek(day.day_of_week),
      parsha: useHebrew ? day.parsha_he : day.parsha,
    };

    // Add zmanim times
    for (const zmanKey of data.zmanim_order) {
      rowData[zmanKey] = formatTime(day.times[zmanKey], showSeconds);
    }

    const row = worksheet.addRow(rowData);

    // Determine day type from parsha field
    const parsha = day.parsha?.toLowerCase() || '';
    const isShabbat = day.day_of_week === 'Sat';
    const hasParsha = day.parsha && day.parsha !== '';

    // Check for Yom Tov (major holidays)
    const yomTovKeywords = ['rosh hashana', 'yom kippur', 'sukkot', 'sukkos', 'shmini atzeret', 'shmini atzeres',
                            'simchat torah', 'simchas torah', 'pesach', 'shavuot', 'shavuos'];
    const isYomTov = yomTovKeywords.some(keyword => parsha.includes(keyword));

    // Check for fast days
    const fastKeywords = ['tenth of teves', 'fast of gedaliah', 'fast of esther', 'tisha b', 'tish\'a b'];
    const isFast = fastKeywords.some(keyword => parsha.includes(keyword));

    row.eachCell((cell, colNumber) => {
      // Alignment
      cell.alignment = {
        horizontal: colNumber <= 4 ? 'left' : 'right',
        vertical: 'middle',
      };

      // Borders
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      };

      // Background color priority: Yom Tov > Fast > Shabbat > Alternating
      if (isYomTov) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF3CD' }, // Light gold/yellow for Yom Tov
        };
      } else if (isFast) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }, // Light gray for fast days
        };
      } else if (isShabbat) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE3F2FD' }, // Light blue for Shabbat
        };
      } else if (index % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9F9F9' }, // Alternating light gray
        };
      }

      // Bold parsha/holiday text
      if (colNumber === 4 && hasParsha) {
        cell.font = { bold: true, color: { argb: 'FF1565C0' } };
      }
    });
  });

  // Add location details
  const locationRow = worksheet.addRow([
    `Zmanim For ${data.location.name}, Latitude: ${data.location.latitude.toFixed(5)}, Longitude: ${data.location.longitude.toFixed(5)}, Elevation: ${data.location.elevation.toFixed(2)} Meters, Timezone: ${data.location.timezone}, Elevation calculated for all zmanim: ${data.elevation_used ? 'Yes' : 'No'}`,
  ]);
  locationRow.font = { italic: true, size: 10, color: { argb: 'FF424242' } };
  locationRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFDE7' }, // Light yellow
  };
  worksheet.mergeCells(`A${locationRow.number}:${String.fromCharCode(65 + columns.length - 1)}${locationRow.number}`);

  // Add disclaimer
  const disclaimerRow = worksheet.addRow([
    'Please do not rely on these zmanim to the second. Due to refraction variability, zmanim can be inaccurate by up to 2 minutes.',
  ]);
  disclaimerRow.font = { italic: true, size: 10, color: { argb: 'FF424242' } };
  disclaimerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFDE7' },
  };
  worksheet.mergeCells(`A${disclaimerRow.number}:${String.fromCharCode(65 + columns.length - 1)}${disclaimerRow.number}`);

  // Empty row
  worksheet.addRow([]);

  // Formula section header
  const formulaHeaderRow = worksheet.addRow(['Formula Definitions (DSL):']);
  formulaHeaderRow.font = { bold: true, size: 11, color: { argb: 'FF1B5E20' } };
  formulaHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8F5E9' }, // Light green
  };
  worksheet.mergeCells(`A${formulaHeaderRow.number}:${String.fromCharCode(65 + columns.length - 1)}${formulaHeaderRow.number}`);

  // Formula table headers
  const formulaTableHeaderRow = worksheet.addRow(['  Zman', 'DSL Formula']);
  formulaTableHeaderRow.font = { bold: true, size: 10, color: { argb: 'FF1B5E20' } };
  formulaTableHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8F5E9' }, // Light green
  };
  formulaTableHeaderRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1B5E20' } },
      bottom: { style: 'thin', color: { argb: 'FF1B5E20' } },
      left: { style: 'thin', color: { argb: 'FF1B5E20' } },
      right: { style: 'thin', color: { argb: 'FF1B5E20' } },
    };
  });

  // Add formulas in two-column table (respect language preference)
  const dslGreen = 'FFE8F5E9'; // Same green as header
  for (const zmanKey of data.zmanim_order) {
    const label = useHebrew
      ? (data.zmanim_labels_he?.[zmanKey] || data.zmanim_labels[zmanKey] || zmanKey)
      : (data.zmanim_labels[zmanKey] || zmanKey);
    const formula = data.zmanim_formulas[zmanKey] || 'N/A';

    const formulaRow = worksheet.addRow([`  ${label}`, formula]);

    // Apply green fill to entire row
    formulaRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: dslGreen },
    };

    // Style first column (label)
    formulaRow.getCell(1).font = { size: 9, color: { argb: 'FF424242' } };
    formulaRow.getCell(1).border = {
      top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      left: { style: 'thin', color: { argb: 'FF1B5E20' } },
      right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    };

    // Style second column (formula)
    formulaRow.getCell(2).font = { size: 9, name: 'Consolas', color: { argb: 'FF424242' } };
    formulaRow.getCell(2).border = {
      top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      right: { style: 'thin', color: { argb: 'FF1B5E20' } },
    };
  }

  // Freeze header row
  worksheet.views = [
    { state: 'frozen', ySplit: 1 }
  ];

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Hook to export a full Hebrew year of zmanim as Excel
 */
export function useYearExport() {
  const api = useApi();
  const preferences = usePreferences();

  return useMutation({
    mutationFn: async (params: YearExportParams) => {
      // Fetch data from API - backend resolves coordinates from locality_id
      const response = await api.get<YearExportResponse>(
        `/publisher/zmanim/year?hebrew_year=${params.hebrewYear}&locality_id=${params.localityId}`
      );

      // Use user preferences for display
      const showSeconds = preferences.preferences.showSeconds ?? true; // Default to true (show seconds)
      const useHebrew = preferences.preferences.language === 'he';

      // Debug logging
      console.log('[YearExport] Preferences:', {
        showSeconds,
        useHebrew,
        language: preferences.preferences.language,
        fullPrefs: preferences.preferences
      });
      console.log('[YearExport] API Response:', {
        publisher: response.publisher,
        zmanimCount: response.zmanim_order.length,
        daysCount: response.days.length,
        firstSaturday: response.days.find(d => d.day_of_week === 'Sat')
      });

      // Generate Excel workbook
      const buffer = await generateExcelWorkbook(response, showSeconds, useHebrew);

      // Create filename
      const locationSlug = response.location.name.replace(/\s+/g, '_').toLowerCase();
      const filename = `zmanim_${locationSlug}.xlsx`;

      // Trigger download
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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
