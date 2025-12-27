'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, Users, Building2, Activity } from 'lucide-react';
import type { AuditStats, AuditEvent } from '@/lib/types/audit';

interface AuditStatsDashboardProps {
  stats: AuditStats | null;
  isLoading?: boolean;
}

// Color mapping for event categories
const CATEGORY_COLORS: Record<string, string> = {
  publisher: 'bg-blue-500',
  zman: 'bg-green-500',
  auth: 'bg-purple-500',
  user: 'bg-orange-500',
  coverage: 'bg-cyan-500',
  algorithm: 'bg-pink-500',
  api_key: 'bg-red-500',
  export: 'bg-yellow-500',
  team: 'bg-indigo-500',
};

// Color mapping for status
const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-500',
  failure: 'bg-red-500',
  partial: 'bg-amber-500',
  error: 'bg-red-700',
};

// Severity colors for timeline indicators
const SEVERITY_COLORS: Record<string, string> = {
  debug: 'bg-slate-400',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  critical: 'bg-red-700',
};

export function AuditStatsDashboard({ stats, isLoading }: AuditStatsDashboardProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6 flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const totalCategories = Object.values(stats.events_by_category).reduce((a, b) => a + b, 0);
  const totalByStatus = Object.values(stats.events_by_status).reduce((a, b) => a + b, 0);

  // Calculate change percentage (mock - would need historical data)
  const changePercent24h = stats.total_events_7d > 0
    ? ((stats.total_events_24h / (stats.total_events_7d / 7)) - 1) * 100
    : 0;

  return (
    <div className="space-y-6 mb-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Activity className="w-4 h-4" />
              Events (24h)
            </CardDescription>
            <CardTitle className="text-3xl">{stats.total_events_24h.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm">
              {changePercent24h >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span className={changePercent24h >= 0 ? 'text-green-600' : 'text-red-600'}>
                {Math.abs(changePercent24h).toFixed(1)}%
              </span>
              <span className="text-muted-foreground">vs daily avg</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Activity className="w-4 h-4" />
              Events (7d)
            </CardDescription>
            <CardTitle className="text-3xl">{stats.total_events_7d.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              ~{Math.round(stats.total_events_7d / 7).toLocaleString()} per day
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              Active Actors
            </CardDescription>
            <CardTitle className="text-3xl">{stats.top_actors.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Users with activity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              Active Publishers
            </CardDescription>
            <CardTitle className="text-3xl">{stats.top_publishers.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Publishers with activity</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Events by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Events by Category</CardTitle>
            <CardDescription>Distribution of audit events by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.events_by_category)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
                .map(([category, count]) => (
                  <div key={category} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${CATEGORY_COLORS[category] || 'bg-gray-500'}`} />
                    <span className="capitalize flex-1">{category.replace('_', ' ')}</span>
                    <span className="text-muted-foreground">{count.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {totalCategories > 0 ? ((count / totalCategories) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                ))}
            </div>
            {/* Visual bar */}
            <div className="mt-4 h-3 bg-muted rounded-full overflow-hidden flex">
              {Object.entries(stats.events_by_category)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => (
                  <div
                    key={category}
                    className={CATEGORY_COLORS[category] || 'bg-gray-500'}
                    style={{ width: `${totalCategories > 0 ? (count / totalCategories) * 100 : 0}%` }}
                    title={`${category}: ${count}`}
                  />
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Events by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Events by Status</CardTitle>
            <CardDescription>Success vs failure rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.events_by_status)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[status] || 'bg-gray-500'}`} />
                    <span className="capitalize flex-1">{status}</span>
                    <span className="text-muted-foreground">{count.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {totalByStatus > 0 ? ((count / totalByStatus) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                ))}
            </div>
            {/* Visual bar */}
            <div className="mt-4 h-3 bg-muted rounded-full overflow-hidden flex">
              {Object.entries(stats.events_by_status)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <div
                    key={status}
                    className={STATUS_COLORS[status] || 'bg-gray-500'}
                    style={{ width: `${totalByStatus > 0 ? (count / totalByStatus) * 100 : 0}%` }}
                    title={`${status}: ${count}`}
                  />
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Actors and Publishers Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Actors */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Actors</CardTitle>
            <CardDescription>Most active users in the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.top_actors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No activity recorded</p>
            ) : (
              <div className="space-y-3">
                {stats.top_actors.slice(0, 5).map((actor, index) => (
                  <div key={actor.user_id} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-6">{index + 1}.</span>
                    <span className="flex-1 truncate">{actor.username || actor.user_id}</span>
                    <Badge variant="secondary">{actor.event_count.toLocaleString()} events</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Publishers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Publishers</CardTitle>
            <CardDescription>Most active publishers in the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.top_publishers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No activity recorded</p>
            ) : (
              <div className="space-y-3">
                {stats.top_publishers.slice(0, 5).map((publisher, index) => (
                  <div key={publisher.publisher_id} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-6">{index + 1}.</span>
                    <span className="flex-1 truncate">{publisher.publisher_name}</span>
                    <Badge variant="secondary">{publisher.event_count.toLocaleString()} events</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Critical Events */}
      {stats.recent_critical_events.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Recent Critical Events
            </CardTitle>
            <CardDescription>Events requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recent_critical_events.slice(0, 5).map((event) => (
                <CriticalEventRow key={event.id} event={event} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CriticalEventRow({ event }: { event: AuditEvent }) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
      <div className={`w-2 h-2 rounded-full mt-2 ${(event.event_severity && SEVERITY_COLORS[event.event_severity]) || 'bg-gray-500'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{event.event_type}</span>
          <Badge variant={event.status === 'success' ? 'secondary' : 'destructive'} className="text-xs">
            {event.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {event.actor.name || event.actor.user_id || 'System'} - {formatDate(event.occurred_at)}
        </p>
        {event.error_message && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1 truncate">{event.error_message}</p>
        )}
      </div>
    </div>
  );
}
