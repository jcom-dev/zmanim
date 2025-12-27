'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AuditChanges } from '@/lib/types/audit';

interface AuditDiffProps {
  changes: AuditChanges | undefined;
  compact?: boolean;
}

/**
 * Side-by-side diff visualization for audit changes
 * Shows before/after values with color-coded highlights
 */
export function AuditDiff({ changes, compact = false }: AuditDiffProps) {
  if (!changes) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No changes recorded
      </p>
    );
  }

  const { before, after, diff } = changes;

  // If we have a computed diff, use that for a cleaner display
  if (diff && Object.keys(diff).length > 0) {
    return <DiffTable diff={diff} compact={compact} />;
  }

  // Otherwise show full before/after
  return (
    <div className={`grid ${compact ? 'gap-2' : 'grid-cols-1 md:grid-cols-2 gap-4'}`}>
      {before && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm font-medium text-red-600 dark:text-red-400">
              Before
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <JsonDisplay data={before} variant="removed" />
          </CardContent>
        </Card>
      )}
      {after && (
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm font-medium text-green-600 dark:text-green-400">
              After
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <JsonDisplay data={after} variant="added" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface DiffTableProps {
  diff: Record<string, { before: unknown; after: unknown }>;
  compact?: boolean;
}

function DiffTable({ diff }: DiffTableProps) {
  const entries = Object.entries(diff);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No changes detected
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-medium">Field</th>
            <th className="text-left py-2 px-3 font-medium text-red-600 dark:text-red-400">Before</th>
            <th className="text-left py-2 px-3 font-medium text-green-600 dark:text-green-400">After</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([field, { before, after }]) => (
            <tr key={field} className="border-b last:border-0">
              <td className="py-2 px-3 font-medium text-muted-foreground">{formatFieldName(field)}</td>
              <td className="py-2 px-3">
                <DiffValue value={before} variant="removed" />
              </td>
              <td className="py-2 px-3">
                <DiffValue value={after} variant="added" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface JsonDisplayProps {
  data: Record<string, unknown>;
  variant: 'added' | 'removed';
}

function JsonDisplay({ data, variant }: JsonDisplayProps) {
  const bgClass = variant === 'added'
    ? 'bg-green-50 dark:bg-green-950/30'
    : 'bg-red-50 dark:bg-red-950/30';

  return (
    <pre className={`text-xs p-2 rounded overflow-x-auto ${bgClass}`}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

interface DiffValueProps {
  value: unknown;
  variant: 'added' | 'removed';
}

function DiffValue({ value, variant }: DiffValueProps) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }

  const textClass = variant === 'added'
    ? 'text-green-700 dark:text-green-400'
    : 'text-red-700 dark:text-red-400 line-through';

  const bgClass = variant === 'added'
    ? 'bg-green-100 dark:bg-green-900/50'
    : 'bg-red-100 dark:bg-red-900/50';

  // Handle objects and arrays
  if (typeof value === 'object') {
    return (
      <pre className={`text-xs p-1 rounded ${bgClass}`}>
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  // Handle booleans
  if (typeof value === 'boolean') {
    return (
      <span className={`px-1.5 py-0.5 rounded text-xs ${bgClass} ${textClass}`}>
        {value ? 'true' : 'false'}
      </span>
    );
  }

  // Handle strings and numbers
  return (
    <span className={`px-1.5 py-0.5 rounded ${bgClass} ${textClass}`}>
      {String(value)}
    </span>
  );
}

/**
 * Format a snake_case or camelCase field name to Title Case
 */
function formatFieldName(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Inline diff for compact displays (single line)
 */
export function InlineDiff({ changes }: { changes: AuditChanges | undefined }) {
  if (!changes?.diff) {
    return null;
  }

  const entries = Object.entries(changes.diff);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {entries.slice(0, 3).map(([field, { before, after }]) => (
        <span key={field} className="inline-flex items-center gap-1">
          <span className="text-muted-foreground">{formatFieldName(field)}:</span>
          <span className="text-red-600 dark:text-red-400 line-through">
            {formatValue(before)}
          </span>
          <span className="text-muted-foreground">-&gt;</span>
          <span className="text-green-600 dark:text-green-400">
            {formatValue(after)}
          </span>
        </span>
      ))}
      {entries.length > 3 && (
        <span className="text-muted-foreground">+{entries.length - 3} more</span>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default AuditDiff;
