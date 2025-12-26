/**
 * @file page.tsx
 * @purpose Admin correction requests review page
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓
 * @story 6.5 - Public Correction Requests
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Search, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminLocalityEditDialog } from '@/components/admin/AdminLocalityEditDialog';
import { CorrectionRequestHistory } from '@/components/admin/CorrectionRequestHistory';
import { useLocalitySearch } from '@/lib/hooks/useLocalitySearch';
import type { LocalitySearchResult } from '@/types/geography';

interface CorrectionRequest {
  id: number;
  locality_id: number;
  locality_name: string;
  country_name: string;
  publisher_id: number | null;
  publisher_name: string | null;
  requester_email: string;
  requester_name: string | null;
  current_latitude: number;
  current_longitude: number;
  current_elevation: number | null;
  proposed_latitude: number | null;
  proposed_longitude: number | null;
  proposed_elevation: number | null;
  correction_reason: string;
  evidence_urls: string[] | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CorrectionRequestsResponse {
  requests: CorrectionRequest[];
  total: number;
}

interface ApprovalResponse {
  status: string;
  message?: string;
  conflicting_request_ids?: number[];
  warning?: string;
}

export default function AdminCorrectionRequestsPage() {
  const api = useAdminApi();

  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<CorrectionRequest | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictingRequests, setConflictingRequests] = useState<CorrectionRequest[]>([]);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);

  // Locality search state
  const [selectedLocality, setSelectedLocality] = useState<LocalitySearchResult | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Use locality search hook
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

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await api.get<CorrectionRequestsResponse>('/auth/correction-requests?status=pending');
      setRequests(data.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load correction requests');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleOpenApproveDialog = async (request: CorrectionRequest) => {
    setSelectedRequest(request);
    setActionType('approve');
    setReviewNotes('');
    setConflictingRequests([]);
    setIsCheckingConflicts(true);
    setActionDialogOpen(true);

    // Fetch duplicates for this locality
    try {
      const duplicates = await api.get<CorrectionRequest[]>(
        `/auth/correction-requests/check-duplicates?locality_id=${request.locality_id}`
      );

      // Filter out the current request from duplicates
      const conflicts = duplicates.filter((dup) => dup.id !== request.id);
      setConflictingRequests(conflicts);
    } catch (err) {
      console.error('Failed to check for duplicate requests:', err);
      // Don't block the approval flow if duplicate check fails
    } finally {
      setIsCheckingConflicts(false);
    }
  };

  const handleOpenRejectDialog = (request: CorrectionRequest) => {
    setSelectedRequest(request);
    setActionType('reject');
    setReviewNotes('');
    setActionDialogOpen(true);
  };

  const handleLocalitySelect = (locality: LocalitySearchResult) => {
    setSelectedLocality(locality);
    setEditDialogOpen(true);
    clearLocalitySearch();
  };

  const handleEditSuccess = () => {
    // Optionally refresh data or show success message
    setSelectedLocality(null);
  };

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;

    // For rejection, review notes are required
    if (actionType === 'reject' && reviewNotes.trim() === '') {
      setError('Review notes are required for rejection');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await api.put<ApprovalResponse>(`/auth/correction-requests/${selectedRequest.id}/status`, {
        body: JSON.stringify({
          status: actionType === 'approve' ? 'approved' : 'rejected',
          review_notes: reviewNotes.trim(),
        }),
      });

      setActionDialogOpen(false);
      setSelectedRequest(null);
      setActionType(null);
      setReviewNotes('');
      setConflictingRequests([]);

      // Show warning if there are conflicting requests after approval
      if (actionType === 'approve' && response.conflicting_request_ids && response.conflicting_request_ids.length > 0) {
        // Show a brief alert about conflicts (we don't have a toast system, so we'll use an alert state)
        setError(`Request approved successfully. Note: There are ${response.conflicting_request_ids.length} other pending request(s) for this locality that may need review.`);
      }

      // Refresh the list
      await fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${actionType} request`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderDiff = (request: CorrectionRequest) => {
    const changes: Array<{ field: string; current: string | number; proposed: string | number }> = [];

    if (request.proposed_latitude !== null) {
      changes.push({
        field: 'Latitude',
        current: request.current_latitude,
        proposed: request.proposed_latitude,
      });
    }
    if (request.proposed_longitude !== null) {
      changes.push({
        field: 'Longitude',
        current: request.current_longitude,
        proposed: request.proposed_longitude,
      });
    }
    if (request.proposed_elevation !== null) {
      changes.push({
        field: 'Elevation',
        current: request.current_elevation ?? 0,
        proposed: request.proposed_elevation,
      });
    }

    return changes;
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading correction requests...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Locality Data Correction Requests</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Review and approve/reject correction requests from publishers
          </p>
        </div>

        {/* Locality Search Section */}
        <div className="mb-8 bg-card rounded-lg border border-border p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-3">Direct Locality Edit</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Search for any locality to directly edit its coordinates, elevation, or timezone
          </p>

          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>Search for locality to edit coordinates</TooltipContent>
            </Tooltip>
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
                    {locality.latitude?.toFixed(4)}, {locality.longitude?.toFixed(4)} • {locality.timezone}
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
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Tabs for Pending Requests and History */}
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="pending">Pending Requests</TabsTrigger>
            <TabsTrigger value="history">History &amp; Revert</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {/* Pending Requests Section */}
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Pending Publisher Requests</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Review correction requests submitted by publishers
              </p>
            </div>

            {/* Requests Table */}
            {requests.length === 0 ? (
              <div className="bg-card rounded-lg border border-border p-8 sm:p-12 text-center">
                <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-semibold mb-2">No Pending Requests</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  All correction requests have been reviewed.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div key={request.id} className="bg-card rounded-lg border border-border p-4 sm:p-6">
                    {/* Request Header */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {request.locality_name}, {request.country_name}
                        </h3>
                        <div className="text-sm text-muted-foreground mt-1">
                          Submitted by {request.requester_name || request.requester_email}
                          {request.publisher_name && ` (${request.publisher_name})`}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(request.created_at)}
                        </div>
                      </div>
                    </div>

                    {/* Diff View */}
                    <div className="mb-4">
                      <h4 className="font-medium text-sm mb-2">Proposed Changes</h4>
                      <div className="rounded-md border border-border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">Field</th>
                              <th className="px-3 py-2 text-left font-medium">Current</th>
                              <th className="px-3 py-2 text-left font-medium">Proposed</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {renderDiff(request).map((change, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2 font-medium">{change.field}</td>
                                <td className="px-3 py-2 text-muted-foreground">{change.current}</td>
                                <td className="px-3 py-2 text-green-600 dark:text-green-400 font-medium">
                                  {change.proposed}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="mb-4">
                      <h4 className="font-medium text-sm mb-2">Reason</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-md">
                        {request.correction_reason}
                      </p>
                    </div>

                    {/* Evidence URLs */}
                    {request.evidence_urls && request.evidence_urls.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium text-sm mb-2">Evidence URLs</h4>
                        <ul className="space-y-1">
                          {request.evidence_urls.map((url, idx) => (
                            <li key={idx}>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline"
                              >
                                {url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="default"
                            onClick={() => handleOpenApproveDialog(request)}
                            className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Approve correction and update global data</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            onClick={() => handleOpenRejectDialog(request)}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reject correction request</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <CorrectionRequestHistory />
          </TabsContent>
        </Tabs>

        {/* Action Confirmation Dialog */}
        {selectedRequest && actionType && (
          <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {actionType === 'approve' ? 'Approve' : 'Reject'} Correction Request
                </DialogTitle>
                <DialogDescription>
                  {actionType === 'approve'
                    ? 'This will update the global locality data for all users.'
                    : 'This will reject the correction request and notify the requester.'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="rounded-md bg-muted p-3">
                  <div className="font-medium text-sm mb-1">
                    {selectedRequest.locality_name}, {selectedRequest.country_name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {renderDiff(selectedRequest).length} field(s) will be updated
                  </div>
                </div>

                {/* Conflict Warning - only show for approval */}
                {actionType === 'approve' && isCheckingConflicts && (
                  <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 inline-block mr-2 animate-spin" />
                    Checking for duplicate requests...
                  </div>
                )}

                {actionType === 'approve' && !isCheckingConflicts && conflictingRequests.length > 0 && (
                  <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <AlertTitle className="text-yellow-800 dark:text-yellow-200">Multiple Pending Requests</AlertTitle>
                    <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                      There {conflictingRequests.length === 1 ? 'is' : 'are'} {conflictingRequests.length} other pending request(s) for this locality:
                      <ul className="mt-2 list-disc list-inside">
                        {conflictingRequests.map((req) => (
                          <li key={req.id}>
                            Request #{req.id} by {req.publisher_name || req.requester_email}
                          </li>
                        ))}
                      </ul>
                      You may want to review these after approving.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Review Notes {actionType === 'reject' && '(required)'}
                  </label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder={
                      actionType === 'approve'
                        ? 'Optional notes about this approval...'
                        : 'Explain why this request is being rejected...'
                    }
                    rows={4}
                  />
                </div>

                {actionType === 'approve' && (
                  <div className="rounded-md bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-3">
                    <div className="flex gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        This action will immediately update the global locality data and affect all users.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setActionDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant={actionType === 'approve' ? 'default' : 'destructive'}
                  onClick={handleAction}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {actionType === 'approve' ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Approve
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </>
                      )}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Locality Edit Dialog */}
        {selectedLocality && (
          <AdminLocalityEditDialog
            locality={selectedLocality}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            onSuccess={handleEditSuccess}
          />
        )}
      </div>
    </div>
  );
}
