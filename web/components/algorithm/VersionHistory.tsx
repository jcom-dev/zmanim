'use client';
import { useApi } from '@/lib/api-client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { VersionDiff } from './VersionDiff';
import { RestoreDialog } from './RestoreDialog';

interface Version {
  id: string;
  version_number: number;
  status: string;
  description?: string;
  created_by?: string;
  created_at: string;
  is_current: boolean;
}

interface VersionHistoryProps {
  onRestore?: () => void;
}

export function VersionHistory({ onRestore }: VersionHistoryProps) {
  const api = useApi();
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<[number, number] | null>(null);
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ versions: Version[]; current_version: number }>('/publisher/algorithm/history');
      setVersions(data?.versions || []);
      setCurrentVersion(data?.current_version || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const selectForComparison = (versionNum: number) => {
    if (!selectedVersions) {
      setSelectedVersions([versionNum, currentVersion]);
    } else if (selectedVersions[0] === versionNum) {
      setSelectedVersions(null);
    } else {
      setSelectedVersions([selectedVersions[0], versionNum]);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleRestoreComplete = () => {
    setRestoreVersion(null);
    loadVersions();
    onRestore?.();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading version history...</div>
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

  if (versions.length === 0) {
    return (
      <div className="text-center p-8">
        <HistoryIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Version History</h3>
        <p className="text-muted-foreground">
          Save your algorithm to start tracking versions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Version History</h3>
        {selectedVersions && (
          <Button variant="outline" size="sm" onClick={() => setSelectedVersions(null)}>
            Clear Selection
          </Button>
        )}
      </div>

      {/* Timeline */}
      <div className="relative border-l-2 border-border ml-3">
        {versions.map((version) => (
          <div
            key={version.id}
            className={`relative pl-6 pb-4 ${
              version.is_current ? 'bg-primary/5 -ml-3 pl-9 rounded-r-lg py-2' : ''
            }`}
          >
            {/* Timeline dot */}
            <div
              className={`absolute left-[-9px] w-4 h-4 rounded-full border-2 ${
                version.status === 'published'
                  ? 'bg-green-500 border-green-500'
                  : 'bg-card border-border'
              }`}
            />

            {/* Version info */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">v{version.version_number}</span>
              <span
                className={`px-2 py-0.5 text-xs rounded ${
                  version.status === 'published'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {version.status}
              </span>
              {version.is_current && (
                <span className="px-2 py-0.5 text-xs rounded bg-primary/20 text-primary">
                  Current
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground mt-1">
              {formatDate(version.created_at)}
            </p>

            {version.description && (
              <p className="text-sm mt-1">{version.description}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => selectForComparison(version.version_number)}
                className={
                  selectedVersions?.includes(version.version_number)
                    ? 'bg-primary/10'
                    : ''
                }
              >
                <DiffIcon className="w-3 h-3 mr-1" />
                Compare
              </Button>
              {!version.is_current && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRestoreVersion(version.version_number)}
                >
                  <RestoreIcon className="w-3 h-3 mr-1" />
                  Restore
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Diff View */}
      {selectedVersions && (
        <VersionDiff
          v1={Math.min(...selectedVersions)}
          v2={Math.max(...selectedVersions)}
        />
      )}

      {/* Restore Dialog */}
      {restoreVersion !== null && (
        <RestoreDialog
          version={restoreVersion}
          onClose={() => setRestoreVersion(null)}
          onRestore={handleRestoreComplete}
        />
      )}
    </div>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function DiffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v18M3 12h18" />
    </svg>
  );
}

function RestoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
