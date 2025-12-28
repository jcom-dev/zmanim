'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollText, RefreshCw, Loader2 } from 'lucide-react';
import {
  AuditStatsDashboard,
  AdminAuditFilters,
  AuditEventList,
  AuditEventDetailModal,
  ExportButton,
} from '@/components/audit';
import type {
  AuditEvent,
  AuditStats,
  AdminAuditFilters as AdminAuditFiltersType,
  AuditEventListResponse,
  PublisherSummary,
} from '@/lib/types/audit';

/**
 * Admin Audit Log Page
 *
 * Full system audit log with dashboard stats, filtering, and export capabilities.
 * Admin users can view audit events from all publishers.
 */
export default function AdminAuditPage() {
  const api = useAdminApi();

  // State
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filters, setFilters] = useState<AdminAuditFiltersType>({});
  const [publishers, setPublishers] = useState<PublisherSummary[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  // Loading states
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  /**
   * Fetch audit stats for the dashboard
   */
  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      // Note: This endpoint should be implemented on the backend
      const data = await api.get<AuditStats>('/admin/audit-logs/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch audit stats:', err);
      // Show empty stats on error instead of mock data
      setStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, [api]);

  /**
   * Fetch audit events with filters
   */
  const fetchEvents = useCallback(async (resetCursor = true) => {
    setIsLoadingEvents(true);
    try {
      const params = new URLSearchParams();

      // Add filters
      if (filters.event_category) params.set('event_category', filters.event_category);
      if (filters.resource_type) params.set('resource_type', filters.resource_type);
      if (filters.publisher_id) params.set('publisher_id', filters.publisher_id.toString());
      if (filters.severity) params.set('severity', filters.severity);
      if (filters.status) params.set('status', filters.status);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.search) params.set('search', filters.search);

      // Pagination
      params.set('limit', '50');
      if (!resetCursor && cursor) {
        params.set('cursor', cursor);
      }

      const data = await api.get<AuditEventListResponse>(`/admin/audit-logs?${params}`);

      if (resetCursor) {
        setEvents(data.events || []);
      } else {
        setEvents((prev) => [...prev, ...(data.events || [])]);
      }

      setTotal(data.pagination?.total || 0);
      setCursor(data.pagination?.next_cursor);
      setHasMore(!!data.pagination?.next_cursor);
    } catch (err) {
      console.error('Failed to fetch audit events:', err);
      // Show empty state on error instead of mock data
      setEvents([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [api, filters, cursor]);

  /**
   * Fetch publishers for filter dropdown
   */
  const fetchPublishers = useCallback(async () => {
    try {
      const data = await api.get<{ publishers: PublisherSummary[] }>('/admin/publishers');
      setPublishers(data.publishers || []);
    } catch (err) {
      console.error('Failed to fetch publishers:', err);
    }
  }, [api]);

  /**
   * Handle refresh
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchStats(), fetchEvents(true)]);
    } finally {
      setIsRefreshing(false);
    }
  };

  /**
   * Handle filter change
   */
  const handleFilterChange = (newFilters: AdminAuditFiltersType) => {
    setFilters(newFilters);
    setCursor(undefined);
  };

  /**
   * Handle load more
   */
  const handleLoadMore = () => {
    if (hasMore && !isLoadingEvents) {
      fetchEvents(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchStats();
    fetchPublishers();
  }, [fetchStats, fetchPublishers]);

  // Fetch events when filters change
  useEffect(() => {
    fetchEvents(true);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <ScrollText className="w-7 h-7" />
            System Audit Log
          </h1>
          <p className="text-muted-foreground mt-1">
            Track all administrative and system activities
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
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
            disabled={isLoadingEvents}
          />
        </div>
      </div>

      {/* Stats Dashboard */}
      <AuditStatsDashboard stats={stats} isLoading={isLoadingStats} />

      {/* Filters */}
      <AdminAuditFilters
        filters={filters}
        onChange={handleFilterChange}
        publishers={publishers}
        isLoading={isLoadingEvents}
      />

      {/* Events List */}
      <AuditEventList
        events={events}
        loading={isLoadingEvents && events.length === 0}
        onSelectEvent={setSelectedEvent}
      />

      {/* Load More */}
      {hasMore && !isLoadingEvents && (
        <div className="text-center py-4">
          <Button variant="outline" onClick={handleLoadMore}>
            Load More
          </Button>
        </div>
      )}

      {/* Loading indicator for pagination */}
      {isLoadingEvents && events.length > 0 && (
        <div className="text-center py-4">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      )}

      {/* Event count */}
      {!isLoadingEvents && events.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing {events.length} of {total.toLocaleString()} events
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
