/**
 * @file page.tsx
 * @purpose Publisher correction requests management page
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓
 * @story 6.5 - Public Correction Requests
 */

'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { usePublisherContext } from '@/providers/PublisherContext';
import { useApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CorrectionRequest {
  id: number;
  locality_id: number;
  locality_name: string;
  country_name: string;
  requester_email: string;
  requester_name: string | null;
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

export default function PublisherCorrectionRequestsPage() {
  const api = useApi();
  const { selectedPublisher, isLoading: contextLoading } = usePublisherContext();

  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<CorrectionRequest | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!selectedPublisher) return;

    try {
      setIsLoading(true);
      setError(null);

      const data = await api.get<CorrectionRequestsResponse>('/auth/correction-requests');
      setRequests(data.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load location correction requests');
    } finally {
      setIsLoading(false);
    }
  }, [api, selectedPublisher]);

  useEffect(() => {
    if (selectedPublisher) {
      fetchRequests();
    }
  }, [selectedPublisher, fetchRequests]);

  const handleViewDetails = (request: CorrectionRequest) => {
    setSelectedRequest(request);
    setDetailsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { icon: ReactNode; label: string; className: string; tooltip: string }> = {
      pending: {
        icon: <Clock className="w-3 h-3 mr-1" />,
        label: 'Pending',
        className: 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        tooltip: 'Awaiting admin review'
      },
      approved: {
        icon: <CheckCircle2 className="w-3 h-3 mr-1" />,
        label: 'Approved',
        className: 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
        tooltip: 'Location correction has been approved and applied'
      },
      rejected: {
        icon: <XCircle className="w-3 h-3 mr-1" />,
        label: 'Rejected',
        className: 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
        tooltip: 'Location correction request was not approved'
      },
    };

    const config = statusConfig[status];
    if (!config) return <Badge variant="outline">{status}</Badge>;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={config.className}>
            {config.icon}
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{config.tooltip}</TooltipContent>
      </Tooltip>
    );
  };

  const getProposedChanges = (request: CorrectionRequest): string[] => {
    const changes: string[] = [];
    if (request.proposed_latitude !== null) {
      changes.push(`Latitude: ${request.proposed_latitude}`);
    }
    if (request.proposed_longitude !== null) {
      changes.push(`Longitude: ${request.proposed_longitude}`);
    }
    if (request.proposed_elevation !== null) {
      changes.push(`Elevation: ${request.proposed_elevation}m`);
    }
    return changes;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (contextLoading || isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading location correction requests...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Location Correction Requests</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Track your submitted requests to correct location coordinates and elevation data for localities
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Requests Table */}
        {requests.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-8 sm:p-12 text-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>No location correction requests have been submitted</TooltipContent>
            </Tooltip>
            <h3 className="text-base sm:text-lg font-semibold mb-2">No Location Correction Requests</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">
              You have not submitted any location correction requests yet. You can submit requests to correct coordinates or elevation data from the coverage page when viewing locality details.
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Locality
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Proposed Changes
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requests.map((request) => (
                    <tr key={request.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{request.locality_name}</div>
                        <div className="text-sm text-muted-foreground">{request.country_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm space-y-1">
                          {getProposedChanges(request).map((change, idx) => (
                            <div key={idx} className="text-muted-foreground">
                              {change}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(request.status)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(request.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(request)}>
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Details Dialog */}
        {selectedRequest && (
          <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Location Correction Request Details</DialogTitle>
                <DialogDescription>
                  Location data correction for {selectedRequest.locality_name}, {selectedRequest.country_name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  {getStatusBadge(selectedRequest.status)}
                </div>

                {/* Proposed Changes */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Proposed Changes</h4>
                  <div className="rounded-md bg-muted p-3 space-y-1 text-sm">
                    {selectedRequest.proposed_latitude !== null && (
                      <div>Latitude: {selectedRequest.proposed_latitude}</div>
                    )}
                    {selectedRequest.proposed_longitude !== null && (
                      <div>Longitude: {selectedRequest.proposed_longitude}</div>
                    )}
                    {selectedRequest.proposed_elevation !== null && (
                      <div>Elevation: {selectedRequest.proposed_elevation}m</div>
                    )}
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Reason</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedRequest.correction_reason}
                  </p>
                </div>

                {/* Evidence URLs */}
                {selectedRequest.evidence_urls && selectedRequest.evidence_urls.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Evidence URLs</h4>
                    <ul className="space-y-1">
                      {selectedRequest.evidence_urls.map((url, idx) => (
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

                {/* Review Notes (if rejected or approved) */}
                {selectedRequest.review_notes && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Admin Review Notes</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedRequest.review_notes}
                    </p>
                  </div>
                )}

                {/* Reviewed At */}
                {selectedRequest.reviewed_at && (
                  <div className="text-sm text-muted-foreground">
                    Reviewed on {formatDate(selectedRequest.reviewed_at)}
                  </div>
                )}

                {/* Submitted */}
                <div className="text-sm text-muted-foreground">
                  Submitted on {formatDate(selectedRequest.created_at)}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
