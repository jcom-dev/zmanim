'use client';
import { useApi } from '@/lib/api-client';

import { useState, useEffect, useCallback } from 'react';

interface ZmanChange {
  zman_key: string;
  zman_name?: string;
  field: string;
  old_value: string;
  new_value: string;
  change_type: string;
}

interface AlgorithmDiff {
  summary: string;
  changes: ZmanChange[];
  added_zmanim: string[];
  removed_zmanim: string[];
  total_changes: number;
}

interface VersionDiffProps {
  v1: number;
  v2: number;
}

export function VersionDiff({ v1, v2 }: VersionDiffProps) {
  const api = useApi();
  const [diff, setDiff] = useState<AlgorithmDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDiff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ diff: AlgorithmDiff }>(
        `/publisher/algorithm/diff?v1=${v1}&v2=${v2}`
      );
      setDiff(data?.diff || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diff');
    } finally {
      setLoading(false);
    }
  }, [api, v1, v2]);

  useEffect(() => {
    loadDiff();
  }, [loadDiff]);

  if (loading) {
    return (
      <div className="border rounded-lg p-4">
        <div className="text-muted-foreground">Loading diff...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-4 text-red-600">
        {error}
      </div>
    );
  }

  if (!diff) {
    return null;
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <h4 className="font-medium">
        Comparing v{v1} → v{v2}
      </h4>

      {/* Summary */}
      <div className="bg-muted p-3 rounded-md">
        <p className="text-sm">{diff.summary}</p>
        <div className="flex gap-4 mt-2 text-xs">
          {diff.added_zmanim.length > 0 && (
            <span className="text-green-600 dark:text-green-400">
              +{diff.added_zmanim.length} added
            </span>
          )}
          {diff.removed_zmanim.length > 0 && (
            <span className="text-red-600 dark:text-red-400">
              -{diff.removed_zmanim.length} removed
            </span>
          )}
          {diff.changes.length > 0 && (
            <span className="text-yellow-600 dark:text-yellow-400">
              ~{diff.changes.length} modified
            </span>
          )}
        </div>
      </div>

      {/* Added Zmanim */}
      {diff.added_zmanim.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-green-600 dark:text-green-400">
            Added Zmanim
          </h5>
          <div className="flex flex-wrap gap-2">
            {diff.added_zmanim.map((key) => (
              <span
                key={key}
                className="px-2 py-1 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded"
              >
                + {key}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Removed Zmanim */}
      {diff.removed_zmanim.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-red-600 dark:text-red-400">
            Removed Zmanim
          </h5>
          <div className="flex flex-wrap gap-2">
            {diff.removed_zmanim.map((key) => (
              <span
                key={key}
                className="px-2 py-1 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded"
              >
                - {key}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Changes */}
      {diff.changes.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-sm font-medium">Changes</h5>
          {diff.changes.map((change, i) => (
            <ChangeItem key={i} change={change} />
          ))}
        </div>
      )}

      {/* No changes */}
      {diff.total_changes === 0 && (
        <div className="text-center text-muted-foreground py-4">
          No differences found between these versions.
        </div>
      )}
    </div>
  );
}

function ChangeItem({ change }: { change: ZmanChange }) {
  const fieldLabel = formatFieldName(change.field);
  const isConfigChange = change.zman_key === '_config';

  return (
    <div className="border rounded p-3">
      <div className="font-medium text-sm mb-2">
        {isConfigChange ? (
          <span className="text-muted-foreground">Config: {fieldLabel}</span>
        ) : (
          <>
            {change.zman_name || change.zman_key}
            <span className="text-muted-foreground font-normal ml-2">
              ({fieldLabel})
            </span>
          </>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
          <span className="text-red-600 dark:text-red-400 mr-1">-</span>
          <code className="text-xs break-all">{change.old_value || '(empty)'}</code>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded">
          <span className="text-green-600 dark:text-green-400 mr-1">+</span>
          <code className="text-xs break-all">{change.new_value || '(empty)'}</code>
        </div>
      </div>
    </div>
  );
}

function formatFieldName(field: string): string {
  const fieldNames: Record<string, string> = {
    formula: 'Formula',
    nameEnglish: 'English Name',
    nameHebrew: 'Hebrew Name',
    method: 'Method',
    enabled: 'Enabled',
    name: 'Algorithm Name',
    description: 'Description',
  };
  return fieldNames[field] || field;
}
