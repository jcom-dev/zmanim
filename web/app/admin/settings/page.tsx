'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useApi } from '@/lib/api-client';

interface SystemConfig {
  [key: string]: {
    value: Record<string, unknown>;
    description: string;
    updated_at: string;
  };
}

export default function AdminSettingsPage() {
  const api = useApi();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [rateLimitAnonymous, setRateLimitAnonymous] = useState<number>(100);
  const [rateLimitAuthenticated, setRateLimitAuthenticated] = useState<number>(1000);
  const [cacheTTL, setCacheTTL] = useState<number>(24);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const configData = await api.admin.get<SystemConfig>('/admin/config');
      setConfig(configData);

      // Populate form fields
      if (configData?.rate_limit_anonymous) {
        setRateLimitAnonymous(configData.rate_limit_anonymous.value.requests_per_hour as number);
      }
      if (configData?.rate_limit_authenticated) {
        setRateLimitAuthenticated(configData.rate_limit_authenticated.value.requests_per_hour as number);
      }
      if (configData?.cache_ttl_hours) {
        setCacheTTL(configData.cache_ttl_hours.value.hours as number);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = async (key: string, value: Record<string, unknown>) => {
    await api.admin.put('/admin/config', {
      body: JSON.stringify({ key, value }),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Update each configuration setting
      await updateConfig('rate_limit_anonymous', { requests_per_hour: rateLimitAnonymous });
      await updateConfig('rate_limit_authenticated', { requests_per_hour: rateLimitAuthenticated });
      await updateConfig('cache_ttl_hours', { hours: cacheTTL });

      setSuccessMessage('Settings saved successfully!');
      await fetchConfig(); // Refresh to get updated timestamps
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground mt-1">Configure rate limits and cache settings</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-300 rounded-md">
          <p className="text-green-800 text-sm">{successMessage}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Rate Limiting */}
        <Card>
          <CardHeader>
            <CardTitle>Rate Limiting</CardTitle>
            <CardDescription>Control API request limits for different user types</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="rateLimitAnonymous" className="block text-sm font-medium mb-2">
                Anonymous Users (requests per hour)
              </label>
              <input
                type="number"
                id="rateLimitAnonymous"
                value={rateLimitAnonymous}
                onChange={(e) => setRateLimitAnonymous(parseInt(e.target.value))}
                min="0"
                className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
              />
              <p className="mt-1 text-sm text-muted-foreground">
                Current: {(config?.rate_limit_anonymous?.value.requests_per_hour as number) || 'N/A'}
              </p>
            </div>

            <div>
              <label htmlFor="rateLimitAuthenticated" className="block text-sm font-medium mb-2">
                Authenticated Users (requests per hour)
              </label>
              <input
                type="number"
                id="rateLimitAuthenticated"
                value={rateLimitAuthenticated}
                onChange={(e) => setRateLimitAuthenticated(parseInt(e.target.value))}
                min="0"
                className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
              />
              <p className="mt-1 text-sm text-muted-foreground">
                Current: {(config?.rate_limit_authenticated?.value.requests_per_hour as number) || 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cache Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Cache Settings</CardTitle>
            <CardDescription>Configure zmanim calculation cache time-to-live</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <label htmlFor="cacheTTL" className="block text-sm font-medium mb-2">
                Cache TTL (hours)
              </label>
              <input
                type="number"
                id="cacheTTL"
                value={cacheTTL}
                onChange={(e) => setCacheTTL(parseInt(e.target.value))}
                min="1"
                max="168"
                className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
              />
              <p className="mt-1 text-sm text-muted-foreground">
                Current: {(config?.cache_ttl_hours?.value.hours as number) || 'N/A'} hours
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                How long to cache zmanim calculations. Recommended: 24 hours.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Configuration Metadata */}
        {config && (
          <Card>
            <CardHeader>
              <CardTitle>Last Updated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                {config.rate_limit_anonymous && (
                  <div>
                    Rate Limit (Anonymous): {new Date(config.rate_limit_anonymous.updated_at).toLocaleString()}
                  </div>
                )}
                {config.rate_limit_authenticated && (
                  <div>
                    Rate Limit (Authenticated):{' '}
                    {new Date(config.rate_limit_authenticated.updated_at).toLocaleString()}
                  </div>
                )}
                {config.cache_ttl_hours && (
                  <div>Cache TTL: {new Date(config.cache_ttl_hours.updated_at).toLocaleString()}</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        <div className="flex gap-4 pt-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save configuration changes</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={fetchConfig} variant="outline" disabled={loading || saving}>
                Reset
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset to current saved values</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-300 rounded-md">
        <h3 className="font-semibold text-yellow-900 mb-2">Important Notes</h3>
        <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
          <li>Rate limit changes take effect immediately for new requests</li>
          <li>Cache TTL changes only affect new calculations</li>
          <li>All changes are logged and auditable</li>
        </ul>
      </div>
    </div>
  );
}
