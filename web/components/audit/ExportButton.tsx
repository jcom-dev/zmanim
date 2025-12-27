'use client';

import { useState } from 'react';
import { AuditFilters, ExportFormat } from '@/lib/types/audit';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useApi } from '@/lib/api-client';

interface ExportButtonProps {
  filters: AuditFilters;
  disabled?: boolean;
  /**
   * Optional custom export handler. If provided, the component delegates
   * export logic to the parent. If not provided, uses default publisher export API.
   */
  onExport?: (format: ExportFormat) => Promise<void>;
}

/**
 * Button with dropdown for exporting audit logs in CSV or JSON format
 */
export function ExportButton({ filters, disabled, onExport }: ExportButtonProps) {
  const api = useApi();
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);

    try {
      // Use custom handler if provided
      if (onExport) {
        await onExport(format);
        return;
      }

      // Default: Request export from publisher API
      const response = await api.postRaw('/publisher/audit-logs/export', {
        body: JSON.stringify({
          format,
          filters,
        }),
      });

      // Get the blob from response
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      // Could show a toast notification here
    } finally {
      setExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || !!exporting}>
          {exporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleExport('csv')}
          disabled={!!exporting}
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport('json')}
          disabled={!!exporting}
        >
          <FileJson className="w-4 h-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ExportButton;
