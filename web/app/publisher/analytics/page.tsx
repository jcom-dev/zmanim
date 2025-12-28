'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePublisherContext } from '@/providers/PublisherContext';
import { BarChart3, Globe, Calculator, Calendar, MapPin, Loader2, RefreshCw } from 'lucide-react';
import { useApi } from '@/lib/api-client';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Sparkline } from '@/components/ui/sparkline';

interface Analytics {
  calculations_total: number;
  calculations_this_month: number;
  coverage_areas: number;
  localities_covered: number;
  daily_trend: { date: string; count: number }[];
  top_localities: { name: string; count: number }[];
}

export default function PublisherAnalyticsPage() {
  const api = useApi();
  const { selectedPublisher, isLoading: contextLoading } = usePublisherContext();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (isManualRefresh = false) => {
    if (!selectedPublisher) {
      setIsLoading(false);
      return;
    }

    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const data = await api.get<Analytics>('/publisher/analytics');
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [api, selectedPublisher]);

  const handleRefresh = useCallback(() => {
    fetchAnalytics(true);
  }, [fetchAnalytics]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (contextLoading || isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <BarChart3 className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-1">Failed to load analytics</h3>
                <p className="text-sm text-destructive/80">{error}</p>
              </div>
            </div>
            <div className="mt-4">
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                variant="outline"
                size="sm"
                className="border-destructive/20 hover:bg-destructive/5"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasActivity = analytics && (analytics.calculations_total > 0 || analytics.coverage_areas > 0);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-4 md:mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground mt-1">
              View usage statistics for your zmanim
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            data-testid="refresh-analytics-btn"
            className="mt-1"
          >
            {isRefreshing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </div>

        {/* Empty State */}
        {!hasActivity && (
          <div className="bg-card rounded-lg border border-border p-12 text-center">
            <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No activity yet</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Once users start viewing your zmanim and you add coverage areas,
              you&apos;ll see statistics here.
            </p>
          </div>
        )}

        {/* Stats Cards */}
        {hasActivity && analytics && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-card rounded-lg border border-border p-6" data-testid="total-calculations">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Calculator className="w-5 h-5" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Total number of zmanim calculations performed</TooltipContent>
                    </Tooltip>
                    <span className="text-sm font-medium">Total Calculations</span>
                  </div>
                  {analytics.daily_trend && analytics.daily_trend.length > 0 && (
                    <Sparkline
                      data={analytics.daily_trend.map(d => d.count)}
                      color="currentColor"
                      height={32}
                      className="text-primary opacity-50"
                      data-testid="daily-trend-sparkline"
                    />
                  )}
                </div>
                <p className="text-4xl font-bold text-foreground">
                  {analytics.calculations_total.toLocaleString()}
                </p>
                <p className="text-muted-foreground text-sm mt-1">all time</p>
              </div>

              <div className="bg-card rounded-lg border border-border p-6" data-testid="monthly-calculations">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Calendar className="w-5 h-5" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Calculations performed this month</TooltipContent>
                    </Tooltip>
                    <span className="text-sm font-medium">This Month</span>
                  </div>
                  {analytics.daily_trend && analytics.daily_trend.length > 0 && (
                    <Sparkline
                      data={analytics.daily_trend.map(d => d.count)}
                      color="currentColor"
                      height={32}
                      className="text-primary opacity-50"
                      data-testid="daily-trend-sparkline"
                    />
                  )}
                </div>
                <p className="text-4xl font-bold text-foreground">
                  {analytics.calculations_this_month.toLocaleString()}
                </p>
                <p className="text-muted-foreground text-sm mt-1">calculations</p>
              </div>

              <div className="bg-card rounded-lg border border-border p-6" data-testid="coverage-areas">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Globe className="w-5 h-5" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Number of active coverage areas</TooltipContent>
                  </Tooltip>
                  <span className="text-sm font-medium">Coverage Areas</span>
                </div>
                <p className="text-4xl font-bold text-foreground">
                  {analytics.coverage_areas.toLocaleString()}
                </p>
                <p className="text-muted-foreground text-sm mt-1">active areas</p>
              </div>

              <div className="bg-card rounded-lg border border-border p-6" data-testid="localities-covered">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <MapPin className="w-5 h-5" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Total number of localities within coverage areas</TooltipContent>
                </Tooltip>
                  <span className="text-sm font-medium">Localities Covered</span>
                </div>
                <p className="text-4xl font-bold text-foreground">
                  {analytics.localities_covered.toLocaleString()}
                </p>
                <p className="text-muted-foreground text-sm mt-1">total localities</p>
              </div>
            </div>

            {/* Top Localities */}
            {analytics.top_localities && analytics.top_localities.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-6" data-testid="top-localities-section">
                <div className="flex items-center gap-2 text-muted-foreground mb-4">
                  <MapPin className="w-5 h-5" />
                  <h2 className="text-lg font-semibold text-foreground">Top Localities</h2>
                </div>
                <div className="space-y-3">
                  {analytics.top_localities.map((locality, index) => {
                    const maxCount = analytics.top_localities[0]?.count || 1;
                    const percentage = (locality.count / maxCount) * 100;
                    return (
                      <div key={index} className="space-y-1" data-testid="top-locality-item">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">{locality.name}</span>
                          <span className="text-muted-foreground">{locality.count.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
