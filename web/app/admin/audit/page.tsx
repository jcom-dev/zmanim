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
      // Use mock data for development if endpoint not available
      setStats(createMockStats());
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
      // Use mock data for development if endpoint not available
      setEvents(createMockEvents());
      setTotal(10);
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

/**
 * Create mock stats for development when API is not available
 */
function createMockStats(): AuditStats {
  return {
    total_events_24h: 42,
    total_events_7d: 287,
    events_by_category: {
      publisher: 120,
      zman: 85,
      auth: 45,
      coverage: 22,
      user: 15,
    },
    events_by_action: {
      create: 80,
      update: 150,
      delete: 25,
      publish: 32,
    },
    events_by_status: {
      success: 265,
      failure: 15,
      error: 7,
    },
    top_actors: [
      { user_id: '1', username: 'Admin User', event_count: 85 },
      { user_id: '2', username: 'Rabbi Cohen', event_count: 62 },
      { user_id: '3', username: 'Sarah Levy', event_count: 45 },
    ],
    top_publishers: [
      { publisher_id: 1, publisher_name: 'Orthodox Union', event_count: 95 },
      { publisher_id: 2, publisher_name: 'Chabad', event_count: 72 },
      { publisher_id: 3, publisher_name: 'Young Israel', event_count: 55 },
    ],
    recent_critical_events: [],
  };
}

/**
 * Create mock events for development when API is not available
 */
function createMockEvents(): AuditEvent[] {
  const now = new Date();
  return [
    {
      id: '01HQGX8K9Z7ABCDEF1234567',
      event_type: 'publisher.update',
      event_category: 'publisher',
      event_action: 'update',
      event_severity: 'info',
      occurred_at: new Date(now.getTime() - 5 * 60000).toISOString(),
      actor: {
        user_id: '1',
        name: 'Admin User',
        email: 'admin@example.com',
        is_system: false,
      },
      publisher_id: 1,
      publisher_slug: 'orthodox-union',
      resource: {
        type: 'publisher',
        id: '1',
        name: 'Orthodox Union',
      },
      operation_type: 'UPDATE',
      changes: {
        diff: {
          name: { before: 'OU', after: 'Orthodox Union' },
        },
      },
      status: 'success',
      request_id: 'req-123-456',
    },
    {
      id: '01HQGX8K9Z7ABCDEF1234568',
      event_type: 'zman.create',
      event_category: 'zman',
      event_action: 'create',
      event_severity: 'info',
      occurred_at: new Date(now.getTime() - 15 * 60000).toISOString(),
      actor: {
        user_id: '2',
        name: 'Rabbi Cohen',
        email: 'rabbi@example.com',
        is_system: false,
      },
      publisher_id: 2,
      publisher_slug: 'chabad',
      resource: {
        type: 'publisher_zman',
        id: '42',
        name: 'Alos Hashachar',
      },
      operation_type: 'CREATE',
      status: 'success',
      request_id: 'req-789-012',
    },
    {
      id: '01HQGX8K9Z7ABCDEF1234569',
      event_type: 'auth.login',
      event_category: 'auth',
      event_action: 'login',
      event_severity: 'info',
      occurred_at: new Date(now.getTime() - 60 * 60000).toISOString(),
      actor: {
        user_id: '3',
        name: 'Sarah Levy',
        email: 'sarah@example.com',
        is_system: false,
      },
      resource: {
        type: 'user',
        id: '3',
      },
      operation_type: 'EXECUTE',
      status: 'success',
      request_id: 'req-345-678',
    },
  ];
}
