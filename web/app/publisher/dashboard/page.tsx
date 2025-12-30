'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { User, MapPin, Code, BarChart3, AlertTriangle, Clock, Loader2, Plus, CheckCircle } from 'lucide-react';
import { usePublisherContext } from '@/providers/PublisherContext';
import { useApi } from '@/lib/api-client';
import { StatusTooltip } from '@/components/shared/InfoTooltip';
import { STATUS_TOOLTIPS, ADMIN_TOOLTIPS } from '@/lib/tooltip-content';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface DashboardSummary {
  profile: {
    name: string;
    is_verified: boolean;
    status: string;
  };
  algorithm: {
    status: 'none' | 'draft' | 'published' | 'active' | 'archived';
    name: string | null;
    updated_at: string | null;
  };
  coverage: {
    total_areas: number;
    total_localities: number;
  };
  analytics: {
    calculations_this_month: number;
    calculations_total: number;
  };
  recent_activity: Array<{
    action_type: string;
    description: string;
    created_at: string;
    actor_type: string;
  }>;
}

export default function PublisherDashboardPage() {
  const api = useApi();
  const { selectedPublisher, isLoading: contextLoading, error: contextError } = usePublisherContext();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (!selectedPublisher) return;

    try {
      setIsLoading(true);
      setError(null);

      const data = await api.get<DashboardSummary>('/publisher/dashboard');
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [api, selectedPublisher]);

  useEffect(() => {
    if (selectedPublisher) {
      fetchDashboard();
    } else if (!contextLoading) {
      // No publisher and context finished loading - stop local loading state
      setIsLoading(false);
    }
  }, [selectedPublisher, contextLoading, fetchDashboard]);

  // Add timeout for context loading - only triggers if context is stuck loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (contextLoading) {
        setLoadingTimeout(true);
        setIsLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timer);
  }, [contextLoading]);

  // Show loading only if not timed out
  if ((contextLoading || isLoading) && !loadingTimeout) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show "No Publisher" state when user has no publisher access
  if (!selectedPublisher && !contextLoading && !loadingTimeout) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-card border border-border rounded-lg p-8 text-center" data-testid="publisher-dashboard-no-publisher-state">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <User className="w-8 h-8 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Publisher account not found</TooltipContent>
              </Tooltip>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">No Publisher Account</h2>
            <p className="text-muted-foreground mb-6">
              You don&apos;t have access to any publisher accounts yet. To publish zmanim on Shtetl Zmanim, you need to become a publisher.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Become a Publisher
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Register as a new publisher to share your zmanim</TooltipContent>
              </Tooltip>
              <Link
                href="/"
                className="inline-flex items-center justify-center px-6 py-3 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 font-medium"
              >
                Return to Home
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-6">
              If you believe you should have access to a publisher account, please contact support.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error if context failed or timeout occurred
  if (contextError || loadingTimeout || error) {
    const errorMessage = contextError || error || 'Request timed out. Please try again.';

    return (
      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Dashboard error occurred</TooltipContent>
              </Tooltip>
              <div className="flex-1">
                <p className="font-semibold text-destructive mb-2">Unable to Load Dashboard</p>
                <p className="text-destructive/90 text-sm mb-4">{errorMessage}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <StatusTooltip status={status} tooltip={STATUS_TOOLTIPS.verified}>
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" /> Verified
            </span>
          </StatusTooltip>
        );
      case 'pending':
      case 'pending_verification':
        return (
          <StatusTooltip status={status} tooltip={STATUS_TOOLTIPS.pending}>
            <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 text-sm">
              <Clock className="w-4 h-4" /> Pending
            </span>
          </StatusTooltip>
        );
      default:
        return <span className="text-muted-foreground text-sm">{status}</span>;
    }
  };

  const getAlgorithmStatus = () => {
    if (!summary) return null;
    switch (summary.algorithm.status) {
      case 'published':
      case 'active':
        return (
          <StatusTooltip status="published" tooltip={STATUS_TOOLTIPS.published}>
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" /> Published
            </span>
          </StatusTooltip>
        );
      case 'draft':
        return (
          <StatusTooltip status="draft" tooltip={STATUS_TOOLTIPS.draft}>
            <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 text-sm">
              <AlertTriangle className="w-4 h-4" /> Draft
            </span>
          </StatusTooltip>
        );
      case 'none':
        return <span className="text-muted-foreground text-sm">Not configured</span>;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-4 md:mb-8">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          {selectedPublisher && (
            <p className="text-muted-foreground mt-1">
              Managing: {selectedPublisher.name}
            </p>
          )}
        </div>

        {/* Main Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* Profile Card */}
          <Link
            href="/publisher/profile"
            className="bg-card rounded-lg p-6 border border-border hover:border-primary/50 transition-colors group"
            data-testid="publisher-dashboard-profile-card"
          >
            <div className="flex items-start justify-between mb-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <User className="w-8 h-8 text-primary" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Manage your publisher profile and contact information</TooltipContent>
              </Tooltip>
              {summary && getStatusBadge(summary.profile.status)}
            </div>
            <h2 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">Profile</h2>
            {summary && (
              <>
                <p className="text-foreground">{summary.profile.name}</p>
              </>
            )}
          </Link>

          {/* Zmanim Card */}
          <Link
            href="/publisher/algorithm"
            className={`bg-card rounded-lg p-6 border transition-colors group ${summary?.algorithm.status === 'draft'
              ? 'border-yellow-500/50 hover:border-yellow-500'
              : 'border-border hover:border-primary/50'
              }`}
            data-testid="publisher-dashboard-algorithm-card"
          >
            <div className="flex items-start justify-between mb-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Code className="w-8 h-8 text-purple-500" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Configure your zmanim calculation formulas</TooltipContent>
              </Tooltip>
              {getAlgorithmStatus()}
            </div>
            <h2 className="text-lg font-semibold mb-1 group-hover:text-purple-400 transition-colors">Zmanim</h2>
            {summary && (
              <>
                <p className="text-foreground">{summary.algorithm.name || 'No zmanim configured'}</p>
                <p className="text-muted-foreground text-sm">
                  Updated: {formatDate(summary.algorithm.updated_at)}
                </p>
              </>
            )}
            {summary?.algorithm.status === 'draft' && (
              <div className="mt-3 flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                Zmanim not published - users can&apos;t see your times
              </div>
            )}
          </Link>

          {/* Coverage Card */}
          <Link
            href="/publisher/coverage"
            className="bg-card rounded-lg p-6 border border-border hover:border-primary/50 transition-colors group"
            data-testid="publisher-dashboard-coverage-card"
          >
            <div className="flex items-start justify-between mb-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <MapPin className="w-8 h-8 text-green-500" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Define geographic areas where your zmanim are available</TooltipContent>
              </Tooltip>
              {summary && summary.coverage.total_areas > 0 && (
                <span className="text-green-600 dark:text-green-400 text-sm">{summary.coverage.total_areas} areas</span>
              )}
            </div>
            <h2 className="text-lg font-semibold mb-1 group-hover:text-green-400 transition-colors">Coverage</h2>
            {summary && summary.coverage.total_areas > 0 ? (
              <>
                <p className="text-foreground">{summary.coverage.total_areas} coverage areas</p>
                <p className="text-muted-foreground text-sm">{summary.coverage.total_localities.toLocaleString()} localities covered</p>
              </>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      <span>Add your first coverage area</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Start by adding geographic regions for your zmanim</TooltipContent>
                </Tooltip>
              </div>
            )}
          </Link>

          {/* Analytics Card */}
          <Link
            href="/publisher/analytics"
            className="bg-card rounded-lg p-6 border border-border hover:border-primary/50 transition-colors group"
            data-testid="publisher-dashboard-analytics-card"
          >
            <div className="flex items-start justify-between mb-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <BarChart3 className="w-8 h-8 text-orange-500" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>View usage statistics for your zmanim</TooltipContent>
              </Tooltip>
            </div>
            <h2 className="text-lg font-semibold mb-1 group-hover:text-orange-400 transition-colors">Analytics</h2>
            {summary && (
              <>
                <p className="text-3xl font-bold text-foreground">
                  {summary.analytics.calculations_this_month.toLocaleString()}
                </p>
                <StatusTooltip status="calculations" tooltip={ADMIN_TOOLTIPS.calculations_this_month}>
                  <p className="text-muted-foreground text-sm">calculations this month</p>
                </StatusTooltip>
              </>
            )}
          </Link>
        </div>

        {/* Recent Activity Section */}
        <div className="bg-card rounded-lg border border-border p-6" data-testid="publisher-dashboard-recent-activity">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          {summary && summary.recent_activity.length > 0 ? (
            <div className="space-y-3">
              {summary.recent_activity.map((activity, index) => (
                <div key={index} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Clock className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Activity timestamp</TooltipContent>
                  </Tooltip>
                  <div className="flex-1">
                    <p className="text-foreground text-sm">{activity.description}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(activity.created_at)} • {activity.actor_type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Activity log is empty</TooltipContent>
              </Tooltip>
              <p>No recent activity</p>
              <p className="text-xs mt-1">Activity will appear here as you make changes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
