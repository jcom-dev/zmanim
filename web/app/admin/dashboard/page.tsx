'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

import { useApi } from '@/lib/api-client';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { ADMIN_TOOLTIPS } from '@/lib/tooltip-content';

interface AdminStats {
  publishers: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
  };
  calculations: {
    total: number;
    cache_hit_ratio: number;
  };
  timestamp: string;
}

export default function AdminDashboardPage() {
  const api = useApi();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await api.admin.get<AdminStats>('/admin/stats');
      setStats(data);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const StatCard = ({
    title,
    value,
    description,
    tooltip,
  }: {
    title: string;
    value: string | number;
    description?: string;
    tooltip?: string;
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-1.5">
          {title}
          {tooltip && <InfoTooltip content={tooltip} side="top" />}
        </CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      {description && (
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      )}
    </Card>
  );

  if (loading && !stats) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading statistics...</div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-red-300 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">{error}</p>
            <Button onClick={fetchStats} className="mt-4" variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform usage statistics and metrics</p>
        </div>
        <Button onClick={fetchStats} variant="outline" disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950">
          <CardContent className="pt-4">
            <p className="text-amber-700 dark:text-amber-300 text-sm">
              Could not refresh statistics. Showing last successful data.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="text-sm text-muted-foreground">
        Last updated: {lastRefreshed.toLocaleString()}
      </div>

      {/* Publisher Statistics */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Publisher Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Publishers"
            value={stats?.publishers.total ?? 0}
            description="All registered publishers"
          />
          <StatCard
            title="Active Publishers"
            value={stats?.publishers.active ?? 0}
            description="Verified and publishing"
            tooltip={ADMIN_TOOLTIPS.active_publishers}
          />
          <StatCard
            title="Pending Approval"
            value={stats?.publishers.pending ?? 0}
            description="Awaiting verification"
            tooltip={ADMIN_TOOLTIPS.pending_approval}
          />
          <StatCard
            title="Suspended"
            value={stats?.publishers.suspended ?? 0}
            description="Currently suspended"
            tooltip={ADMIN_TOOLTIPS.suspended_count}
          />
        </div>
      </div>

      {/* Calculation Statistics */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Calculation Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard
            title="Total Calculations"
            value={stats?.calculations.total ?? 0}
            description="Zmanim calculations performed"
            tooltip={ADMIN_TOOLTIPS.total_calculations}
          />
          <StatCard
            title="Cache Hit Ratio"
            value={`${((stats?.calculations.cache_hit_ratio ?? 0) * 100).toFixed(1)}%`}
            description="Percentage of cached responses"
            tooltip={ADMIN_TOOLTIPS.cache_hit_ratio}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/admin/publishers">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">Manage Publishers</CardTitle>
                <CardDescription>
                  View, create, and manage publisher accounts
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/admin/publishers/new">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">Create Publisher</CardTitle>
                <CardDescription>
                  Add a new publisher to the platform
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/admin/settings">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">System Settings</CardTitle>
                <CardDescription>
                  Configure rate limits and platform settings
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>

      {/* Publisher Breakdown */}
      {stats && stats.publishers.total > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Publisher Status Distribution</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span>Active (Verified)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">{stats.publishers.active}</span>
                    <span className="text-sm text-muted-foreground">
                      {((stats.publishers.active / stats.publishers.total) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                    <span>Pending Approval</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">{stats.publishers.pending}</span>
                    <span className="text-sm text-muted-foreground">
                      {((stats.publishers.pending / stats.publishers.total) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-red-500 rounded"></div>
                    <span>Suspended</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">{stats.publishers.suspended}</span>
                    <span className="text-sm text-muted-foreground">
                      {((stats.publishers.suspended / stats.publishers.total) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Visual Bar */}
              <div className="mt-6 h-4 bg-muted rounded-full overflow-hidden flex">
                <div
                  className="bg-green-500"
                  style={{ width: `${(stats.publishers.active / stats.publishers.total) * 100}%` }}
                />
                <div
                  className="bg-yellow-500"
                  style={{ width: `${(stats.publishers.pending / stats.publishers.total) * 100}%` }}
                />
                <div
                  className="bg-red-500"
                  style={{ width: `${(stats.publishers.suspended / stats.publishers.total) * 100}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
