'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollText, Download, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

interface AuditEntry {
  id: string;
  action_type: string;
  concept: string;
  user_id: string;
  actor_name?: string;
  entity_type: string;
  entity_id: string;
  payload?: {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
  status: string;
  started_at: string;
  description: string;
}

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'admin_publisher_verify', label: 'Publisher Verified' },
  { value: 'admin_publisher_suspend', label: 'Publisher Suspended' },
  { value: 'admin_publisher_reactivate', label: 'Publisher Reactivated' },
  { value: 'admin_publisher_delete', label: 'Publisher Deleted' },
  { value: 'admin_publisher_restore', label: 'Publisher Restored' },
  { value: 'admin_publisher_certified', label: 'Publisher Certified' },
  { value: 'admin_publisher_create', label: 'Publisher Created' },
  { value: 'admin_publisher_update', label: 'Publisher Updated' },
  { value: 'admin_user_add', label: 'User Added' },
  { value: 'admin_user_remove', label: 'User Removed' },
  { value: 'admin_correction_approve', label: 'Correction Approved' },
  { value: 'admin_correction_reject', label: 'Correction Rejected' },
];

export default function AdminAuditLogPage() {
  const api = useApi();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Filters
  const [actionType, setActionType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchAuditLog = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '50',
      });
      if (actionType) params.set('action_type', actionType);
      if (startDate) params.set('start_date', new Date(startDate).toISOString());
      if (endDate) params.set('end_date', new Date(endDate).toISOString());

      const data = await api.admin.get<{ entries: AuditEntry[]; total: number }>(
        `/admin/audit-log?${params}`
      );
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch audit log', err);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [api, page, actionType, startDate, endDate]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCSV = () => {
    // Build CSV from current entries
    const headers = ['Timestamp', 'Action', 'Actor', 'Entity Type', 'Entity ID', 'Status'];
    const rows = entries.map(e => [
      e.started_at,
      e.action_type,
      e.actor_name || e.user_id,
      e.entity_type,
      e.entity_id,
      e.status,
    ]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ScrollText className="w-8 h-8" />
              Audit Log
            </h1>
            <p className="text-muted-foreground mt-1">
              Track all administrative actions
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={exportCSV} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export current audit log to CSV</TooltipContent>
          </Tooltip>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value || 'all'}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                placeholder="Start date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />

              <Input
                type="date"
                placeholder="End date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => { setActionType(''); setStartDate(''); setEndDate(''); }}>
                    Clear Filters
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset all filters</TooltipContent>
              </Tooltip>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" />
          </div>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ScrollText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No audit entries found</h3>
              <p className="text-muted-foreground">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              {entries.map(entry => (
                <Card key={entry.id}>
                  <CardContent className="py-4">
                    <div
                      className="flex items-center gap-4 cursor-pointer"
                      onClick={() => toggleRow(entry.id)}
                    >
                      {entry.payload ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              {expandedRows.has(entry.id) ?
                                <ChevronDown className="w-4 h-4" /> :
                                <ChevronRight className="w-4 h-4" />}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {expandedRows.has(entry.id) ? 'Collapse details' : 'Expand details'}
                          </TooltipContent>
                        </Tooltip>
                      ) : <div className="w-4" />}

                      <div className="flex-1 grid grid-cols-5 gap-4">
                        <span className="text-sm text-muted-foreground">
                          {formatDate(entry.started_at)}
                        </span>
                        <span className="font-medium">{entry.description}</span>
                        <span className="text-sm">{entry.actor_name || entry.user_id}</span>
                        <span className="text-sm">{entry.entity_type}</span>
                        <span className="text-sm text-muted-foreground">{entry.entity_id}</span>
                      </div>
                    </div>

                    {/* Expanded diff view */}
                    {expandedRows.has(entry.id) && entry.payload && (
                      <div className="mt-4 ml-8 p-4 bg-muted rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                          {entry.payload.old && (
                            <div>
                              <h4 className="font-medium text-red-600 mb-2">Before</h4>
                              <pre className="text-sm bg-background p-2 rounded">
                                {JSON.stringify(entry.payload.old, null, 2)}
                              </pre>
                            </div>
                          )}
                          {entry.payload.new && (
                            <div>
                              <h4 className="font-medium text-green-600 mb-2">After</h4>
                              <pre className="text-sm bg-background p-2 rounded">
                                {JSON.stringify(entry.payload.new, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-6">
              <span className="text-sm text-muted-foreground">
                Showing {entries.length} of {total} entries
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={entries.length < 50}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
