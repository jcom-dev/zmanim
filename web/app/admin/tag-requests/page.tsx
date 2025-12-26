'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { useAdminApi } from '@/lib/api-client';
import { useUser } from '@clerk/nextjs';
import { useTagTypes } from '@/lib/hooks';
import {
    Search,
    Loader2,
    Tag,
    CheckCircle2,
    XCircle,
    FileText,
    Calendar,
} from 'lucide-react';

interface TagRequest {
    id: string;
    request_id: string;
    requested_tag_name: string;
    requested_tag_type: string;
    is_new_tag_request: boolean;
    created_at: string;
    // From the parent zman request
    zman_hebrew_name?: string;
    zman_english_name?: string;
    zman_key?: string;
    publisher_name?: string;
}

interface TagRequestWithZman extends TagRequest {
    zman_request: {
        id: string;
        requested_key: string;
        requested_hebrew_name: string;
        requested_english_name: string;
        publisher_name?: string;
        created_at: string;
    };
}

// Fallback colors when database color not available
const DEFAULT_TAG_TYPE_COLOR = 'bg-muted text-muted-foreground border-border';

export default function AdminTagRequestsPage() {
    const api = useAdminApi();
    const { isLoaded } = useUser();
    const [tagRequests, setTagRequests] = useState<TagRequestWithZman[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [processingTagId, setProcessingTagId] = useState<string | null>(null);

    // Fetch tag types from database for colors and labels
    const { data: tagTypes } = useTagTypes();

    // Build tag type color map from database
    const tagTypeColors = useMemo(() => {
        if (!tagTypes) return {} as Record<string, string>;
        return tagTypes.reduce((acc, tt) => {
            acc[tt.key] = tt.color || DEFAULT_TAG_TYPE_COLOR;
            return acc;
        }, {} as Record<string, string>);
    }, [tagTypes]);

    // Build tag type labels map from database
    const tagTypeLabels = useMemo(() => {
        if (!tagTypes) return {} as Record<string, string>;
        return tagTypes.reduce((acc, tt) => {
            acc[tt.key] = tt.display_name_english;
            return acc;
        }, {} as Record<string, string>);
    }, [tagTypes]);

    const fetchTagRequests = useCallback(async () => {
        try {
            setLoading(true);
            // Get all pending zman requests
            const requestsData = await api.get<{ requests: Array<{
                id: string;
                requested_key: string;
                requested_hebrew_name: string;
                requested_english_name: string;
                publisher_name?: string;
                created_at: string;
            }> }>('/admin/zman-requests?status=pending');

            // For each request, get its tag requests
            const allTagRequests: TagRequestWithZman[] = [];
            for (const req of requestsData?.requests || []) {
                const tags = await api.get<TagRequest[]>(`/admin/zman-requests/${req.id}/tags`);
                const newTagRequests = (tags || [])
                    .filter((t) => t.is_new_tag_request)
                    .map((t) => ({
                        ...t,
                        zman_request: {
                            id: req.id,
                            requested_key: req.requested_key,
                            requested_hebrew_name: req.requested_hebrew_name,
                            requested_english_name: req.requested_english_name,
                            publisher_name: req.publisher_name,
                            created_at: req.created_at,
                        },
                    }));
                allTagRequests.push(...newTagRequests);
            }

            setTagRequests(allTagRequests);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch tag requests');
        } finally {
            setLoading(false);
        }
    }, [api]);

    useEffect(() => {
        if (isLoaded) {
            fetchTagRequests();
        }
    }, [fetchTagRequests, isLoaded]);

    const handleApprove = async (tagRequest: TagRequestWithZman) => {
        setProcessingTagId(tagRequest.id);
        try {
            await api.post(
                `/admin/zman-requests/${tagRequest.request_id}/tags/${tagRequest.id}/approve`,
                {}
            );
            // Remove from list
            setTagRequests((prev) => prev.filter((t) => t.id !== tagRequest.id));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to approve tag');
        } finally {
            setProcessingTagId(null);
        }
    };

    const handleReject = async (tagRequest: TagRequestWithZman) => {
        setProcessingTagId(tagRequest.id);
        try {
            await api.post(
                `/admin/zman-requests/${tagRequest.request_id}/tags/${tagRequest.id}/reject`,
                {}
            );
            // Remove from list
            setTagRequests((prev) => prev.filter((t) => t.id !== tagRequest.id));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reject tag');
        } finally {
            setProcessingTagId(null);
        }
    };

    const filteredRequests = tagRequests.filter((req) => {
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            return (
                req.requested_tag_name?.toLowerCase().includes(search) ||
                req.zman_request.requested_key.toLowerCase().includes(search) ||
                req.zman_request.requested_hebrew_name.toLowerCase().includes(search) ||
                req.zman_request.requested_english_name.toLowerCase().includes(search) ||
                req.zman_request.publisher_name?.toLowerCase().includes(search)
            );
        }
        return true;
    });

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

    if (!isLoaded || loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Tag Requests</h1>
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
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">Tag Requests</h1>
                    <p className="text-sm md:text-base text-muted-foreground mt-1">
                        Review and approve new tag requests from publishers
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

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-amber-500/10 rounded-lg">
                                <Tag className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-foreground">{tagRequests.length}</div>
                                <p className="text-sm text-muted-foreground">Pending Tags</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-500/10 rounded-lg">
                                <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-foreground">
                                    {new Set(tagRequests.map((t) => t.request_id)).size}
                                </div>
                                <p className="text-sm text-muted-foreground">Zman Requests</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-green-500/10 rounded-lg">
                                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">
                                    Process tags to unlock zman reviews
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="pt-6">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-2">
                                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                                <Input
                                    placeholder="Search tags, zmanim, publishers..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="flex-1"
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>Search tag requests by name, zman, or publisher</TooltipContent>
                    </Tooltip>
                </CardContent>
            </Card>

            {/* Tag Requests List */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Tag className="w-5 h-5" />
                        <div>
                            <CardTitle>New Tag Requests</CardTitle>
                            <CardDescription>
                                {filteredRequests.length} tag{filteredRequests.length !== 1 ? 's' : ''} awaiting review
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredRequests.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Tag className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>No pending tag requests</p>
                            <p className="text-xs mt-1">
                                All tags have been processed
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredRequests.map((tagReq) => (
                                <div
                                    key={tagReq.id}
                                    className="p-4 rounded-lg border hover:border-muted-foreground/50 transition-colors bg-card"
                                >
                                    {/* Tag Info */}
                                    <div className="flex items-start justify-between gap-4 mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Tag className="w-4 h-4 text-muted-foreground" />
                                                <h3 className="font-semibold text-lg text-foreground">
                                                    {tagReq.requested_tag_name}
                                                </h3>
                                                <Badge
                                                    variant="outline"
                                                    className={tagTypeColors[tagReq.requested_tag_type] || DEFAULT_TAG_TYPE_COLOR}
                                                >
                                                    {tagTypeLabels[tagReq.requested_tag_type] || tagReq.requested_tag_type}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleReject(tagReq)}
                                                        disabled={processingTagId === tagReq.id}
                                                        className="text-destructive hover:text-destructive"
                                                    >
                                                        {processingTagId === tagReq.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <XCircle className="h-4 w-4 mr-1" />
                                                                Reject
                                                            </>
                                                        )}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Reject tag request</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleApprove(tagReq)}
                                                        disabled={processingTagId === tagReq.id}
                                                        className="bg-green-600 hover:bg-green-700"
                                                    >
                                                        {processingTagId === tagReq.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                                                Approve
                                                            </>
                                                        )}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Approve tag and add to registry</TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>

                                    {/* Linked Zman Request */}
                                    <div className="pl-6 border-l-2 border-muted">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                            <FileText className="w-3.5 h-3.5" />
                                            <span className="font-medium">Requested for zman:</span>
                                        </div>
                                        <div className="mt-2">
                                            <div className="font-medium text-foreground">
                                                <span className="font-hebrew">{tagReq.zman_request.requested_hebrew_name}</span>
                                                <span className="mx-2 text-muted-foreground">•</span>
                                                <span>{tagReq.zman_request.requested_english_name}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                                                <code className="px-2 py-0.5 bg-muted rounded font-mono">
                                                    {tagReq.zman_request.requested_key}
                                                </code>
                                                {tagReq.zman_request.publisher_name && (
                                                    <span>Publisher: {tagReq.zman_request.publisher_name}</span>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {formatDate(tagReq.zman_request.created_at)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
