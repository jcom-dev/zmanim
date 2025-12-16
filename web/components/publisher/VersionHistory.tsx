'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApi } from '@/lib/api-client';

interface AlgorithmVersion {
  id: string;
  name: string;
  version: number;
  status: string;
  is_active: boolean;
  published_at?: string;
  deprecated_at?: string;
  created_at: string;
}

interface VersionHistoryProps {
  onClose?: () => void;
}

export function VersionHistory({ onClose }: VersionHistoryProps) {
  const api = useApi();
  const [versions, setVersions] = useState<AlgorithmVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deprecating, setDeprecating] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await api.get<{ versions: AlgorithmVersion[] }>('/publisher/algorithm/versions');
      setVersions(data?.versions || []);
    } catch (err) {
      console.error('Failed to load versions:', err);
      setError('Failed to load version history');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleDeprecate = async (versionId: string) => {
    try {
      setDeprecating(versionId);
      setError(null);

      await api.put(`/publisher/algorithm/versions/${versionId}/deprecate`, {});
      await loadVersions();
    } catch (err) {
      console.error('Failed to deprecate version:', err);
      setError('Failed to deprecate version');
    } finally {
      setDeprecating(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (version: AlgorithmVersion) => {
    if (version.is_active) {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded">
          ACTIVE
        </span>
      );
    }
    if (version.status === 'deprecated') {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded">
          DEPRECATED
        </span>
      );
    }
    if (version.status === 'archived') {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-slate-600 text-white rounded">
          ARCHIVED
        </span>
      );
    }
    if (version.status === 'draft') {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-yellow-600 text-white rounded">
          DRAFT
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded">
        {version.status.toUpperCase()}
      </span>
    );
  };

  return (
    <Card data-testid="version-history">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Version History</CardTitle>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="text-center py-8 text-muted-foreground">Loading versions...</div>
        )}

        {error && (
          <div className="alert-error mb-4">
            <p className="alert-error-text text-sm">{error}</p>
          </div>
        )}

        {!loading && versions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No versions found. Save and publish your first algorithm to start version history.
          </div>
        )}

        {!loading && versions.length > 0 && (
          <div className="space-y-4">
            {versions.map((version) => (
              <div
                key={version.id}
                className="border border-border rounded-lg p-4 flex items-center justify-between"
                data-testid={`version-${version.id}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-foreground font-medium">
                      {version.name} v{version.version}
                    </span>
                    {getStatusBadge(version)}
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Created: {formatDate(version.created_at)}</div>
                    {version.published_at && (
                      <div>Published: {formatDate(version.published_at)}</div>
                    )}
                    {version.deprecated_at && (
                      <div className="text-destructive">
                        Deprecated: {formatDate(version.deprecated_at)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {version.status === 'published' && version.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeprecate(version.id)}
                      disabled={deprecating === version.id}
                      className="text-destructive border-destructive hover:bg-red-900/50 dark:hover:bg-red-950/50"
                    >
                      {deprecating === version.id ? 'Deprecating...' : 'Deprecate'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
