'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePublisherContext } from '@/providers/PublisherContext';
import { useApi, ApiError } from '@/lib/api-client';
import {
  AuditEvent,
  AuditFilters as AuditFiltersType,
} from '@/lib/types/audit';
import {
  AuditEventList,
  AuditFilters,
  AuditEventDetailModal,
  ExportButton,
} from '@/components/audit';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollText, RefreshCw, Loader2 } from 'lucide-react';

export default function PublisherAuditPage() {
  const api = useApi();
  const { selectedPublisher, isLoading: contextLoading } = usePublisherContext();

  // State
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filters, setFilters] = useState<AuditFiltersType>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  /**
   * Fetch audit logs with current filters and cursor
   */
  const fetchAuditLogs = useCallback(
    async (loadMore = false) => {
      if (!selectedPublisher) return;

      try {
        if (loadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        // Build query params
        const params = new URLSearchParams();
        params.set('limit', '50');

        if (loadMore && cursor) {
          params.set('cursor', cursor);
        }

        if (filters.resource_type) {
          params.set('resource_type', filters.resource_type);
        }
        if (filters.event_category) {
          params.set('event_category', filters.event_category);
        }
        if (filters.event_action) {
          params.set('event_action', filters.event_action);
        }
        if (filters.from) {
          params.set('from', filters.from);
        }
        if (filters.to) {
          params.set('to', filters.to);
        }

        // Backend returns { data: [...], next_cursor: "...", has_more: true }
        const response = await api.get<{
          data: AuditEvent[];
          next_cursor?: string;
          has_more: boolean;
        }>(`/publisher/audit-logs?${params.toString()}`);

        if (loadMore) {
          setEvents((prev) => [...prev, ...(response.data || [])]);
        } else {
          setEvents(response.data || []);
        }

        setCursor(response.next_cursor || null);
        setHasMore(response.has_more || false);
      } catch (err) {
        // If endpoint doesn't exist yet, show empty state
        if (err instanceof ApiError && err.isNotFound) {
          setEvents([]);
          setHasMore(false);
          return;
        }
        // For other errors, log but don't crash
        console.error('Failed to fetch audit logs:', err);
        setEvents([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [api, selectedPublisher, cursor, filters]
  );

  // Initial load and when filters change
  useEffect(() => {
    if (selectedPublisher) {
      setCursor(null);
      setHasMore(false);
      fetchAuditLogs(false);
    }
  }, [selectedPublisher, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Handle filter changes
   */
  const handleFiltersChange = (newFilters: AuditFiltersType) => {
    setFilters(newFilters);
    // Reset pagination when filters change
    setCursor(null);
    setHasMore(false);
  };

  /**
   * Load more events
   */
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchAuditLogs(true);
    }
  };

  /**
   * Refresh the list
   */
  const handleRefresh = () => {
    setCursor(null);
    setHasMore(false);
    fetchAuditLogs(false);
  };

  // Show loading state while context is loading
  if (contextLoading) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <ScrollText className="w-7 h-7" />
            Activity Log
          </h1>
          <p className="text-muted-foreground mt-1">
            Track changes made to your publisher account
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>

          <ExportButton
            filters={filters}
            disabled={loading || events.length === 0}
          />
        </div>
      </div>

      {/* Filters */}
      <AuditFilters filters={filters} onChange={handleFiltersChange} />

      {/* Events List */}
      <AuditEventList
        events={events}
        loading={loading && events.length === 0}
        onSelectEvent={setSelectedEvent}
      />

      {/* Load More */}
      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}

      {/* Event Detail Modal */}
      <AuditEventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
