/**
 * @file CorrectionRequestHistory.tsx
 * @purpose Admin component for viewing and reverting correction request history
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Search, RotateCcw, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLocalitySearch } from '@/lib/hooks/useLocalitySearch';
import type { LocalitySearchResult } from '@/types/geography';

interface CorrectionHistoryItem {
  id: number;
  locality_id: number;
  locality_name: string;
  country_name: string;
  publisher_id: number | null;
  publisher_name: string | null;
  requester_email: string;
  requester_name: string | null;

  // Before values
  previous_latitude: number;
  previous_longitude: number;
  previous_elevation: number | null;

  // After values
  proposed_latitude: number | null;
  proposed_longitude: number | null;
  proposed_elevation: number | null;

  status: 'approved' | 'reverted';
  approved_at: string | null;
  reverted_at: string | null;
  reverted_by: string | null;
  revert_reason: string | null;
  created_at: string;
}

interface HistoryResponse {
  requests: CorrectionHistoryItem[];
  total: number;
}

export function CorrectionRequestHistory() {
  const api = useAdminApi();

  const [history, setHistory] = useState<CorrectionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocalityId, setSelectedLocalityId] = useState<string | null>(null);

  // Revert dialog state
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CorrectionHistoryItem | null>(null);
  const [revertReason, setRevertReason] = useState('');
  const [isReverting, setIsReverting] = useState(false);

  // Locality search
  const {
    results: localitySearchResults,
    isLoading: isSearchingLocalities,
    search: searchLocalities,
    clear: clearLocalitySearch,
    query: localitySearchQuery,
  } = useLocalitySearch({
    types: ['locality'],
    limit: 10,
  });

  const fetchHistory = useCallback(async (localityId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await api.get<HistoryResponse>(
        `/auth/correction-requests/history?locality_id=${localityId}`
      );
      setHistory(data.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load correction history');
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (selectedLocalityId) {
      fetchHistory(selectedLocalityId);
    }
  }, [selectedLocalityId, fetchHistory]);

  const handleLocalitySelect = (locality: LocalitySearchResult) => {
    setSelectedLocalityId(locality.id);
    clearLocalitySearch();
  };

  const handleOpenRevertDialog = (request: CorrectionHistoryItem) => {
    setSelectedRequest(request);
    setRevertReason('');
    setRevertDialogOpen(true);
  };

  const handleRevert = async () => {
    if (!selectedRequest) return;

    if (revertReason.trim().length < 20) {
      setError('Revert reason must be at least 20 characters');
      return;
    }

    setIsReverting(true);
    setError(null);

    try {
      await api.post(`/auth/correction-requests/${selectedRequest.id}/revert`, {
        body: JSON.stringify({ revert_reason: revertReason.trim() }),
      });

      setRevertDialogOpen(false);
      setSelectedRequest(null);
      setRevertReason('');

      // Refresh history
      if (selectedLocalityId) {
        await fetchHistory(selectedLocalityId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revert correction');
    } finally {
      setIsReverting(false);
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCoordinate = (value: number | null): string => {
    if (value === null) return 'N/A';
    return value.toFixed(6);
  };

  const formatElevation = (value: number | null): string => {
    if (value === null) return 'N/A';
    return `${value}m`;
  };

  return (
    <div className="space-y-6">
      {/* Locality Search */}
      <div className="bg-card rounded-lg border border-border p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-3">Search Correction History</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Search for a locality to view all approved and reverted corrections
        </p>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={localitySearchQuery}
            onChange={(e) => searchLocalities(e.target.value)}
            placeholder="Search for a locality by name..."
            className="pl-10"
          />
          {isSearchingLocalities && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>

        {/* Search Results Dropdown */}
        {localitySearchQuery.length >= 2 && localitySearchResults.length > 0 && (
          <div className="mt-2 bg-background border border-border rounded-md shadow-lg max-h-80 overflow-y-auto">
            {localitySearchResults.map((locality) => (
              <button
                key={locality.id}
                type="button"
                onClick={() => handleLocalitySelect(locality)}
                className="w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border last:border-b-0"
              >
                <div className="font-medium">{locality.name}</div>
                <div className="text-sm text-muted-foreground">
                  {locality.region_name && `${locality.region_name}, `}{locality.country}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {locality.latitude?.toFixed(4)}, {locality.longitude?.toFixed(4)}
                </div>
              </button>
            ))}
          </div>
        )}

        {localitySearchQuery.length >= 2 && !isSearchingLocalities && localitySearchResults.length === 0 && (
          <div className="mt-2 p-4 text-center text-sm text-muted-foreground bg-muted/30 rounded-md">
            No localities found for &quot;{localitySearchQuery}&quot;
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* History Table */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading correction history...</p>
        </div>
      ) : selectedLocalityId && history.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 sm:p-12 text-center">
          <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-semibold mb-2">No History Found</h3>
          <p className="text-sm sm:text-base text-muted-foreground">
            This locality has no approved or reverted corrections.
          </p>
        </div>
      ) : history.length > 0 ? (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-3 text-left font-medium">Request ID</th>
                  <th className="px-3 py-3 text-left font-medium">Locality</th>
                  <th className="px-3 py-3 text-left font-medium">Publisher</th>
                  <th className="px-3 py-3 text-left font-medium">Before</th>
                  <th className="px-3 py-3 text-left font-medium">After</th>
                  <th className="px-3 py-3 text-left font-medium">Approved At</th>
                  <th className="px-3 py-3 text-left font-medium">Status</th>
                  <th className="px-3 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-3 py-3 font-mono text-xs">#{item.id}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{item.locality_name}</div>
                      <div className="text-xs text-muted-foreground">{item.country_name}</div>
                    </td>
                    <td className="px-3 py-3">
                      {item.publisher_name || (
                        <span className="text-muted-foreground italic">Public</span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">
                      <div>Lat: {formatCoordinate(item.previous_latitude)}</div>
                      <div>Lng: {formatCoordinate(item.previous_longitude)}</div>
                      <div>Elev: {formatElevation(item.previous_elevation)}</div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">
                      <div className={item.proposed_latitude !== null ? 'text-green-600 dark:text-green-400' : ''}>
                        Lat: {formatCoordinate(item.proposed_latitude)}
                      </div>
                      <div className={item.proposed_longitude !== null ? 'text-green-600 dark:text-green-400' : ''}>
                        Lng: {formatCoordinate(item.proposed_longitude)}
                      </div>
                      <div className={item.proposed_elevation !== null ? 'text-green-600 dark:text-green-400' : ''}>
                        Elev: {formatElevation(item.proposed_elevation)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs">{formatDate(item.approved_at)}</td>
                    <td className="px-3 py-3">
                      {item.status === 'approved' ? (
                        <Badge variant="default" className="bg-green-600">Approved</Badge>
                      ) : (
                        <Badge variant="secondary">Reverted</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {item.status === 'approved' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenRevertDialog(item)}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Revert
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Reverted {item.reverted_at && `on ${formatDate(item.reverted_at)}`}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Revert Dialog */}
      {selectedRequest && (
        <Dialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Revert Correction #{selectedRequest.id}</DialogTitle>
              <DialogDescription>
                This will restore the locality to its state before this correction was applied.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Current vs Previous Values */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Will restore to:</div>
                  <div className="font-mono text-xs space-y-1">
                    <div>
                      Lat: {formatCoordinate(selectedRequest.previous_latitude)}
                      <span className="text-muted-foreground mx-2">from</span>
                      {formatCoordinate(selectedRequest.proposed_latitude)}
                    </div>
                    <div>
                      Lng: {formatCoordinate(selectedRequest.previous_longitude)}
                      <span className="text-muted-foreground mx-2">from</span>
                      {formatCoordinate(selectedRequest.proposed_longitude)}
                    </div>
                    <div>
                      Elev: {formatElevation(selectedRequest.previous_elevation)}
                      <span className="text-muted-foreground mx-2">from</span>
                      {formatElevation(selectedRequest.proposed_elevation)}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {/* Revert Reason */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Reason for Reverting (required, min 20 characters)
                </label>
                <Textarea
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  placeholder="Explain why this correction needs to be reverted..."
                  rows={4}
                  className="resize-none"
                />
                <div className="text-xs text-muted-foreground">
                  {revertReason.length} / 20 characters minimum
                </div>
              </div>

              {/* Warning */}
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This action will immediately update the global locality data and affect all users.
                  The correction request will be marked as reverted.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setRevertDialogOpen(false)}
                disabled={isReverting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRevert}
                disabled={isReverting || revertReason.trim().length < 20}
              >
                {isReverting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Reverting...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Revert Correction
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
