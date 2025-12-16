'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminApi } from '@/lib/api-client';
import { useUser } from '@clerk/nextjs';
import {
  Search,
  Loader2,
  FileText,
  User,
  Calendar,
} from 'lucide-react';
import {
  ZmanRegistryForm,
  ZmanFormData,
  PendingTagRequest,
  ReviewSourceInfo,
  ZmanTag,
} from '@/components/admin/ZmanRegistryForm';
import { ColorBadge, getTimeCategoryColor } from '@/components/ui/color-badge';

interface ZmanRequest {
  id: string;
  publisher_id: string;
  requested_key: string;
  requested_hebrew_name: string;
  requested_english_name: string;
  transliteration?: string;
  requested_formula_dsl?: string;
  time_category: string;
  description?: string;
  halachic_notes?: string;
  halachic_source?: string;
  publisher_email?: string;
  publisher_name?: string;
  auto_add_on_approval?: boolean;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at?: string;
  reviewer_notes?: string;
  created_at: string;
  submitter_name?: string;
}

interface ZmanRequestListResponse {
  requests: ZmanRequest[];
  total: number;
}

interface ZmanRequestTagResponse {
  id: string;
  request_id: string;
  tag_id?: number; // Changed from string to number to match backend int32
  requested_tag_name?: string;
  requested_tag_type?: string;
  is_new_tag_request: boolean;
  existing_tag_key?: string;
  existing_tag_name?: string;
  existing_tag_type?: string;
}

// Color mappings are now in ColorBadge component

export default function AdminZmanRequestsPage() {
  const api = useAdminApi();
  const { user, isLoaded } = useUser();
  const [requests, setRequests] = useState<ZmanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  // Review dialog state
  const [selectedRequest, setSelectedRequest] = useState<ZmanRequest | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [pendingTagRequests, setPendingTagRequests] = useState<PendingTagRequest[]>([]);
  const [loadingRequest, setLoadingRequest] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      const data = await api.get<ZmanRequestListResponse>(`/admin/zman-requests?${params}`);
      setRequests(data?.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  }, [api, statusFilter]);

  useEffect(() => {
    if (isLoaded) {
      fetchRequests();
    }
  }, [fetchRequests, isLoaded]);

  const filteredRequests = requests.filter((req) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        req.requested_key.toLowerCase().includes(search) ||
        req.requested_hebrew_name.toLowerCase().includes(search) ||
        req.requested_english_name.toLowerCase().includes(search) ||
        req.publisher_name?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const openReviewDialog = async (request: ZmanRequest) => {
    try {
      setLoadingRequest(true);
      setError(null);

      // Open the dialog immediately with basic info
      setSelectedRequest(request);
      setReviewDialogOpen(true);

      // Fetch full request details and tags in parallel
      const [fullRequest, tags] = await Promise.all([
        api.get<ZmanRequest>(`/admin/zman-requests/${request.id}`),
        api.get<ZmanRequestTagResponse[]>(`/admin/zman-requests/${request.id}/tags`),
      ]);

      setSelectedRequest(fullRequest);

      // Convert to PendingTagRequest format - include ALL tag requests
      // The form will show pending ones with approve/reject buttons
      const pendingTags: PendingTagRequest[] = (tags || []).map((t) => ({
        id: t.id,
        zman_request_id: t.request_id,
        tag_id: t.tag_id,
        requested_tag_name: t.requested_tag_name,
        requested_tag_type: t.requested_tag_type,
        is_new_tag_request: t.is_new_tag_request,
      }));
      setPendingTagRequests(pendingTags);
    } catch (err) {
      console.error('Failed to load request details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load request');
      setReviewDialogOpen(false);
    } finally {
      setLoadingRequest(false);
    }
  };


  const handleApprove = async (data: ZmanFormData, reviewerNotes: string) => {
    if (!selectedRequest || !user?.id) return;

    // First, create the registry entry
    const registryPayload = {
      zman_key: data.zman_key,
      canonical_hebrew_name: data.canonical_hebrew_name,
      canonical_english_name: data.canonical_english_name,
      transliteration: data.transliteration || null,
      description: data.description || null,
      halachic_notes: data.halachic_notes || null,
      halachic_source: data.halachic_source || null,
      time_category: data.time_category,
      default_formula_dsl: data.default_formula_dsl,
      is_core: data.is_core,
      is_hidden: data.is_hidden,
      tags: data.tags, // { tag_id, is_negated }[]
    };

    // Create in registry first
    await api.post('/admin/registry/zmanim', {
      body: JSON.stringify(registryPayload),
    });

    // Then update the request status
    await api.put(`/admin/zman-requests/${selectedRequest.id}`, {
      body: JSON.stringify({
        status: 'approved',
        reviewer_notes: reviewerNotes.trim() || undefined,
      }),
    });

    setReviewDialogOpen(false);
    fetchRequests();
  };

  const handleReject = async (reviewerNotes: string) => {
    if (!selectedRequest || !user?.id) return;

    await api.put(`/admin/zman-requests/${selectedRequest.id}`, {
      body: JSON.stringify({
        status: 'rejected',
        reviewer_notes: reviewerNotes.trim() || undefined,
      }),
    });

    setReviewDialogOpen(false);
    fetchRequests();
  };

  const handleTagApprove = async (tagRequest: PendingTagRequest): Promise<ZmanTag | null> => {
    if (!selectedRequest) return null;

    const result = await api.post<{
      id: number; // Changed from string to number to match backend int32
      tag_key: string;
      name: string;
      display_name_hebrew: string;
      display_name_english: string;
      tag_type: string;
    }>(`/admin/zman-requests/${selectedRequest.id}/tags/${tagRequest.id}/approve`, {});

    if (result) {
      return {
        id: result.id,
        tag_key: result.tag_key,
        name: result.name,
        display_name_hebrew: result.display_name_hebrew,
        display_name_english: result.display_name_english,
        tag_type: result.tag_type as 'event' | 'timing' | 'behavior',
      };
    }
    return null;
  };

  const handleTagReject = async (tagRequest: PendingTagRequest): Promise<void> => {
    if (!selectedRequest) return;

    await api.post(`/admin/zman-requests/${selectedRequest.id}/tags/${tagRequest.id}/reject`, {});
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-amber-600 border-amber-600">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-600 hover:bg-green-700">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Map request data to form data
  const mapRequestToFormData = (request: ZmanRequest): Partial<ZmanFormData> => ({
    zman_key: request.requested_key,
    canonical_hebrew_name: request.requested_hebrew_name,
    canonical_english_name: request.requested_english_name,
    transliteration: request.transliteration || '',
    description: request.description || '',
    time_category: request.time_category,
    default_formula_dsl: request.requested_formula_dsl || '',
    halachic_notes: request.halachic_notes || '',
    halachic_source: request.halachic_source || '',
    is_core: false,
    is_hidden: false,
    // Include existing tag IDs from approved tags (all as positive/non-negated)
    tags: pendingTagRequests
      .filter((t) => !t.is_new_tag_request && t.tag_id)
      .map((t) => ({ tag_id: t.tag_id!, is_negated: false })),
  });

  // Build source info for the form
  const getSourceInfo = (request: ZmanRequest): ReviewSourceInfo | undefined => {
    if (!request) return undefined;
    return {
      publisher_name: request.publisher_name || request.submitter_name || 'Unknown Publisher',
      publisher_id: request.publisher_id,
      submitted_at: request.created_at,
      request_id: request.id,
    };
  };

  if (!isLoaded || loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Zman Requests</h1>
          <p className="text-muted-foreground mt-1">Loading...</p>
        </div>
        <div className="flex justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Zman Requests</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Review and approve requests from publishers to add new zmanim to the registry
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-destructive">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="mt-2"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 flex-1">
                    <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="Search requests, publishers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Search zman requests by name or publisher</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Status:</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{requests.length}</div>
            <p className="text-sm text-muted-foreground">Total Requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-600">
              {requests.filter((r) => r.status === 'pending').length}
            </div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {requests.filter((r) => r.status === 'approved').length}
            </div>
            <p className="text-sm text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">
              {requests.filter((r) => r.status === 'rejected').length}
            </div>
            <p className="text-sm text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5" />
            <div>
              <CardTitle>Zman Requests</CardTitle>
              <CardDescription>
                {filteredRequests.length} requests matching filters
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No requests found</p>
              <p className="text-xs mt-1">
                {statusFilter === 'pending'
                  ? 'No pending requests to review'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <div
                  key={request.id}
                  className="p-4 rounded-lg border hover:border-muted-foreground/50 transition-colors"
                >
                  {/* Header row: name + action buttons */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(request.status)}
                        <h3 className="font-semibold text-foreground">
                          <span className="font-hebrew">{request.requested_hebrew_name}</span>
                          <span className="mx-2 text-muted-foreground">•</span>
                          <span>{request.requested_english_name}</span>
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Key: <code className="font-mono bg-muted px-1 rounded">{request.requested_key}</code>
                      </p>
                    </div>
                    {request.status === 'pending' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openReviewDialog(request)}
                            className="shrink-0"
                          >
                            Review
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Review and approve or reject request</TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* Meta info row */}
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <ColorBadge color={getTimeCategoryColor(request.time_category)} size="sm">
                      {request.time_category}
                    </ColorBadge>
                    {request.publisher_name && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {request.publisher_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(request.created_at)}
                    </span>
                  </div>

                  {/* Description */}
                  {request.description && (
                    <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                      {request.description}
                    </p>
                  )}

                  {/* Reviewer notes (shown for non-pending) */}
                  {request.reviewer_notes && request.status !== 'pending' && (
                    <div className="mt-3 p-2 bg-muted rounded text-xs">
                      <span className="font-medium">Review Notes:</span> {request.reviewer_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog with ZmanRegistryForm */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>Review Zman Request</DialogTitle>
            <DialogDescription>
              Review and edit the request details before approving or rejecting
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loadingRequest ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : selectedRequest ? (
              <ZmanRegistryForm
                mode="review"
                initialData={mapRequestToFormData(selectedRequest)}
                sourceInfo={getSourceInfo(selectedRequest)}
                pendingTagRequests={pendingTagRequests}
                onApprove={handleApprove}
                onReject={handleReject}
                onTagApprove={handleTagApprove}
                onTagReject={handleTagReject}
                onCancel={() => setReviewDialogOpen(false)}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
