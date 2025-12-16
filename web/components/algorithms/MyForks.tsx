'use client';
import { useApi } from '@/lib/api-client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Fork {
  id: string;
  name: string;
  attribution: string;
  source_id: string;
  source_name: string;
  source_publisher: string;
}

interface MyForksProps {
  onEdit?: (algorithmId: string) => void;
}

export function MyForks({ onEdit }: MyForksProps) {
  const api = useApi();
  const [forks, setForks] = useState<Fork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadForks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ forks: Fork[] }>('/publisher/algorithm/forks');
      setForks(data?.forks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forks');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadForks();
  }, [loadForks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading your forks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert-error">
        <p className="alert-error-text">{error}</p>
      </div>
    );
  }

  if (forks.length === 0) {
    return (
      <div className="text-center p-8">
        <div className="mb-4">
          <ForkIcon className="w-12 h-12 mx-auto text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No Forked Algorithms</h3>
        <p className="text-muted-foreground">
          You haven&apos;t forked any algorithms yet. Browse public algorithms to find one to fork.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">My Forked Algorithms</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {forks.map((fork) => (
          <Card key={fork.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{fork.name}</CardTitle>
              <CardDescription className="text-xs">
                {fork.attribution}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" />
                    From: {fork.source_name}
                  </span>
                </div>
                {onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(fork.id)}
                  >
                    Edit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ForkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="6" r="3" />
      <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" />
      <path d="M12 12v3" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
