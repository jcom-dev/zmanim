'use client';
import { useApi } from '@/lib/api-client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { cn, formatTime } from '@/lib/utils';

interface CalculationPreviewProps {
  formula: string;
  isValid: boolean;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  date?: Date;
  className?: string;
}

interface PreviewResult {
  time: string;
  formatted: string;
  success: boolean;
  error?: string;
}

export function CalculationPreview({
  formula,
  isValid,
  latitude = 40.7128,
  longitude = -74.006,
  date,
  className,
}: CalculationPreviewProps) {
  const api = useApi();
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stabilize date to prevent re-render loops when no date prop is passed
  const stableDate = useMemo(() => {
    if (date) return date;
    return new Date();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only create once on mount

  const dateString = useMemo(() => {
    const d = date || stableDate;
    return d.toISOString().split('T')[0];
  }, [date, stableDate]);

  const fetchPreview = useCallback(async () => {
    if (!isValid || !formula) {
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.public.post<{ time: string; result: string; formatted: string }>('/dsl/preview', {
        body: JSON.stringify({
          formula,
          latitude,
          longitude,
          date: dateString,
        }),
      });

      setResult({
        time: data?.time || data?.result || '',
        formatted: data?.formatted || formatTime(data?.time || data?.result || ''),
        success: true,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Preview failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [api, formula, isValid, latitude, longitude, dateString]);

  useEffect(() => {
    // Debounce API calls
    const timeoutId = setTimeout(fetchPreview, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [fetchPreview]);

  return (
    <div className={cn('rounded-xl border-2 border-primary/20 bg-card p-5 text-center', className)}>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Calculated Time</div>
      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto my-2" />
      ) : error ? (
        <span className="text-sm text-destructive block py-2">{error}</span>
      ) : result ? (
        <span className="text-4xl font-bold font-mono text-primary tracking-tight">
          {result.formatted}
        </span>
      ) : (
        <span className="text-3xl font-mono text-muted-foreground/50">--:--</span>
      )}
    </div>
  );
}

export default CalculationPreview;
