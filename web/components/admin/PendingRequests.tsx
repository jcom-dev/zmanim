'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAdminApi } from '@/lib/api-client';



interface PublisherRequest {
  id: string;
  name: string;
  email: string;
  website?: string;
  description: string;
  status: string;
  created_at: string;
}

interface PendingRequestsProps {
  onApprove?: () => void;
}

export function PendingRequests({ onApprove }: PendingRequestsProps) {
  const api = useAdminApi();
  const [requests, setRequests] = useState<PublisherRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PublisherRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<{ data: PublisherRequest[]; meta: { pending: number } }>('/admin/publisher-requests?status=pending');
      setRequests(data?.data || []);
      setPendingCount(data?.meta?.pending || 0);
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (request: PublisherRequest) => {
    setActionLoading(true);
    try {
      await api.post(`/admin/publisher-requests/${request.id}/approve`, {});
      setSelectedRequest(null);
      fetchRequests();
      onApprove?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    setActionLoading(true);
    try {
      await api.post(`/admin/publisher-requests/${selectedRequest.id}/reject`, {
        body: JSON.stringify({ reason: rejectReason }),
      });
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setRejectReason('');
      fetchRequests();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject request');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pending Requests
            <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-sm">...</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (pendingCount === 0) {
    return null;
  }

  return (
    <>
      <Card className="mb-6 border-yellow-200 bg-yellow-50">
        <CardHeader
          className="cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              Pending Requests
              <span className="bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full text-sm font-medium">
                {pendingCount}
              </span>
            </span>
            <svg
              className={`w-5 h-5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </CardTitle>
          <CardDescription className="text-yellow-700">
            {pendingCount} publisher {pendingCount === 1 ? 'application' : 'applications'} awaiting review
          </CardDescription>
        </CardHeader>
        {expanded && (
          <CardContent>
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="bg-card p-4 rounded-lg border border-yellow-200 hover:border-yellow-300 cursor-pointer"
                  onClick={() => setSelectedRequest(request)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{request.name}</h4>
                      <p className="text-sm text-muted-foreground">{request.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(request.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Request Details Dialog */}
      <Dialog open={!!selectedRequest && !showRejectDialog} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-lg">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle>Publisher Application</DialogTitle>
                <DialogDescription>Review the details below</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Publisher / Organization Name</label>
                  <p className="text-foreground">{selectedRequest.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-foreground">{selectedRequest.email}</p>
                </div>
                {selectedRequest.website && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Website</label>
                    <p className="text-foreground">
                      <a
                        href={selectedRequest.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {selectedRequest.website}
                      </a>
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="text-foreground whitespace-pre-wrap">{selectedRequest.description}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Submitted</label>
                  <p className="text-foreground">{new Date(selectedRequest.created_at).toLocaleString()}</p>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectDialog(true);
                  }}
                  disabled={actionLoading}
                >
                  Reject
                </Button>
                <Button onClick={() => handleApprove(selectedRequest)} disabled={actionLoading}>
                  {actionLoading ? 'Processing...' : 'Approve'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this application? You can optionally provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label htmlFor="reason" className="block text-sm font-medium text-muted-foreground mb-1">
              Reason (optional)
            </label>
            <textarea
              id="reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter a reason for rejection..."
              rows={3}
              className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
              {actionLoading ? 'Rejecting...' : 'Reject Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
