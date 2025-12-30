'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePublisherContext } from '@/providers/PublisherContext';
import { useApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Languages, Info, Loader2, Mountain } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

interface CalculationSettings {
  ignore_elevation: boolean;
  transliteration_style: 'ashkenazi' | 'sephardi';
}

export default function CalculationSettingsPage() {
  const api = useApi();
  const { selectedPublisher, isLoading: contextLoading, error: contextError } = usePublisherContext();
  const [settings, setSettings] = useState<CalculationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!selectedPublisher) return;

    try {
      setLoading(true);
      setError(null);

      const data = await api.get<CalculationSettings>('/publisher/settings/calculation');
      setSettings(data);
    } catch (err) {
      console.error('Failed to load calculation settings:', err);
      setError('Failed to load calculation settings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [api, selectedPublisher]);

  useEffect(() => {
    if (selectedPublisher) {
      loadSettings();
    }
  }, [selectedPublisher, loadSettings]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (contextLoading || !selectedPublisher) {
        setLoadingTimeout(true);
        setLoading(false);
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [contextLoading, selectedPublisher]);

  const updateSettings = async (updates: Partial<CalculationSettings>) => {
    if (!selectedPublisher || !settings) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updated = await api.put<CalculationSettings>('/publisher/settings/calculation', {
        body: JSON.stringify({
          ignore_elevation: updates.ignore_elevation ?? settings.ignore_elevation,
          transliteration_style: updates.transliteration_style ?? settings.transliteration_style,
        }),
      });
      setSettings(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update calculation settings:', err);
      setError('Failed to update settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if ((contextLoading || loading) && !loadingTimeout) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Loading settings...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (contextError || loadingTimeout || error || !selectedPublisher) {
    const errorMessage = contextError || error ||
      (!selectedPublisher ? 'No publisher account found. Please contact support if you believe this is an error.' : 'Request timed out. Please try again.');

    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-destructive mb-2">Unable to Load Settings</p>
                <p className="text-destructive/80 text-sm mb-4">{errorMessage}</p>
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

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/publisher/profile"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Profile
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">Calculation Settings</h1>
          <p className="text-muted-foreground">
            Configure zmanim calculations for your organization
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-6 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            <Info className="h-4 w-4 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 mb-6 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200">
            <span className="text-sm">Settings saved</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Pronunciation Setting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="h-5 w-5" />
                Pronunciation Style for Events
              </CardTitle>
              <CardDescription>
                Choose how Hebrew events are transliterated in English
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Select
                  value={settings?.transliteration_style ?? 'ashkenazi'}
                  onValueChange={(value: 'ashkenazi' | 'sephardi') => updateSettings({ transliteration_style: value })}
                  disabled={saving}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ashkenazi">Ashkenazi (Shabbos)</SelectItem>
                    <SelectItem value="sephardi">Sephardi (Shabbat)</SelectItem>
                  </SelectContent>
                </Select>
                {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </CardContent>
          </Card>

          {/* Elevation Setting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mountain className="h-5 w-5" />
                Elevation
              </CardTitle>
              <CardDescription>
                Control how elevation affects calculations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="ignore-elevation" className="font-medium">
                    Ignore elevation (use sea level)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Some poskim prefer sea-level calculations regardless of actual elevation
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Switch
                    id="ignore-elevation"
                    checked={settings?.ignore_elevation ?? false}
                    onCheckedChange={(checked) => updateSettings({ ignore_elevation: checked })}
                    disabled={saving}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Back button */}
        <div className="mt-8">
          <Button variant="outline" asChild>
            <Link href="/publisher/profile">
              Back to Profile
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
