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
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AdminCityEditDialog } from '@/components/admin/AdminCityEditDialog';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { City } from '@/types/geography';

interface CorrectionRequest {
  id: number;
  city_id: number;
  city_name: string;
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

  // City search state
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const debouncedCitySearch = useDebounce(citySearchQuery, 300);
  const [citySearchResults, setCitySearchResults] = useState<City[]>([]);
  const [isSearchingCities, setIsSearchingCities] = useState(false);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await api.get<CorrectionRequestsResponse>('/admin/correction-requests?status=pending');
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

  // City search effect
  useEffect(() => {
    if (debouncedCitySearch.length < 2) {
      setCitySearchResults([]);
      return;
    }

    const searchCities = async () => {
      setIsSearchingCities(true);
      try {
        const data = await api.get<{ cities: City[] }>(
          `/cities?search=${encodeURIComponent(debouncedCitySearch)}&limit=10`
        );
        setCitySearchResults(data.cities || []);
      } catch (err) {
        console.error('City search failed:', err);
        setCitySearchResults([]);
      } finally {
        setIsSearchingCities(false);
      }
    };

    searchCities();
  }, [debouncedCitySearch, api]);

  const handleOpenApproveDialog = (request: CorrectionRequest) => {
    setSelectedRequest(request);
    setActionType('approve');
    setReviewNotes('');
    setActionDialogOpen(true);
  };

  const handleOpenRejectDialog = (request: CorrectionRequest) => {
    setSelectedRequest(request);
    setActionType('reject');
    setReviewNotes('');
    setActionDialogOpen(true);
  };

  const handleCitySelect = (city: City) => {
    setSelectedCity(city);
    setEditDialogOpen(true);
    setCitySearchQuery('');
    setCitySearchResults([]);
  };

  const handleEditSuccess = () => {
    // Optionally refresh data or show success message
    setSelectedCity(null);
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
      await api.post(`/admin/correction-requests/${selectedRequest.id}/${actionType}`, {
        body: JSON.stringify({
          review_notes: reviewNotes.trim(),
        }),
      });

      setActionDialogOpen(false);
      setSelectedRequest(null);
      setActionType(null);
      setReviewNotes('');

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
          <h1 className="text-2xl sm:text-3xl font-bold">City Data Correction Requests</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Review and approve/reject correction requests from publishers
          </p>
        </div>

        {/* City Search Section */}
        <div className="mb-8 bg-card rounded-lg border border-border p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-3">Direct City Edit</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Search for any city to directly edit its coordinates, elevation, or timezone
          </p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={citySearchQuery}
              onChange={(e) => setCitySearchQuery(e.target.value)}
              placeholder="Search for a city by name..."
              className="pl-10"
            />
            {isSearchingCities && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
            )}
          </div>

          {/* Search Results Dropdown */}
          {citySearchQuery.length >= 2 && citySearchResults.length > 0 && (
            <div className="mt-2 bg-background border border-border rounded-md shadow-lg max-h-80 overflow-y-auto">
              {citySearchResults.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => handleCitySelect(city)}
                  className="w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border last:border-b-0"
                >
                  <div className="font-medium">{city.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {city.region && `${city.region}, `}{city.country}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {city.latitude.toFixed(4)}, {city.longitude.toFixed(4)} • {city.timezone}
                  </div>
                </button>
              ))}
            </div>
          )}

          {citySearchQuery.length >= 2 && !isSearchingCities && citySearchResults.length === 0 && (
            <div className="mt-2 p-4 text-center text-sm text-muted-foreground bg-muted/30 rounded-md">
              No cities found for &quot;{citySearchQuery}&quot;
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

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
                      {request.city_name}, {request.country_name}
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
                  <Button
                    variant="default"
                    onClick={() => handleOpenApproveDialog(request)}
                    className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleOpenRejectDialog(request)}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

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
                    ? 'This will update the global city data for all users.'
                    : 'This will reject the correction request and notify the requester.'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="rounded-md bg-muted p-3">
                  <div className="font-medium text-sm mb-1">
                    {selectedRequest.city_name}, {selectedRequest.country_name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {renderDiff(selectedRequest).length} field(s) will be updated
                  </div>
                </div>

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
                      <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        This action will immediately update the global city data and affect all users.
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

        {/* City Edit Dialog */}
        {selectedCity && (
          <AdminCityEditDialog
            city={selectedCity}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            onSuccess={handleEditSuccess}
          />
        )}
      </div>
    </div>
  );
}
