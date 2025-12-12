/**
 * Publisher Snapshots Hooks
 *
 * Hooks for managing publisher version control / snapshot system.
 * Uses usePublisherQuery and usePublisherMutation for consistent
 * error handling, automatic cache invalidation, and type safety.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  usePublisherQuery,
  usePublisherMutation,
  useDeleteMutation,
  useDynamicMutation,
} from './useApiQuery';
import { useApi, API_BASE } from '@/lib/api-client';
import { usePublisherContext } from '@/providers/PublisherContext';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';

// =============================================================================
// Types
// =============================================================================

export interface SnapshotZman {
  zman_key: string;
  hebrew_name: string;
  english_name: string;
  transliteration?: string;
  description?: string;
  formula_dsl: string;
  ai_explanation?: string;
  publisher_comment?: string;
  is_enabled: boolean;
  is_visible: boolean;
  is_published: boolean;
  is_beta: boolean;
  is_custom: boolean;
  category: 'essential' | 'optional' | 'custom';
  master_zman_id?: string;
  linked_publisher_zman_id?: string;
}

export interface PublisherSnapshot {
  version: number;
  exported_at: string;
  description: string;
  zmanim: SnapshotZman[];
}

export interface SnapshotMeta {
  id: string;
  publisher_id: string;
  description: string;
  created_by: string;
  created_at: string;
}

export interface SnapshotWithData extends SnapshotMeta {
  snapshot: PublisherSnapshot;
}

export interface SaveVersionRequest {
  description?: string;
}

export interface ImportSnapshotRequest {
  snapshot: PublisherSnapshot;
}

export interface ImportSnapshotResponse {
  success: boolean;
  stats: {
    zmanim: number;
  };
}

export interface RestoreSnapshotResponse {
  success: boolean;
  auto_save_id: string;
}

export interface ListSnapshotsResponse {
  snapshots: SnapshotMeta[];
  total: number;
}

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Hook: List all saved snapshots/versions for the current publisher
 */
export const useSnapshotList = () =>
  usePublisherQuery<ListSnapshotsResponse>('publisher-snapshots', '/publisher/snapshots');

/**
 * Hook: Get a single snapshot with full data
 */
export const useSnapshot = (snapshotId: string | null) =>
  usePublisherQuery<SnapshotWithData>(
    ['publisher-snapshot', snapshotId],
    `/publisher/snapshot/${snapshotId}`,
    { enabled: !!snapshotId }
  );

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Hook: Save current state as a new version/snapshot
 */
export const useSaveVersion = () =>
  usePublisherMutation<SnapshotMeta, SaveVersionRequest>('/publisher/snapshot', 'POST', {
    invalidateKeys: ['publisher-snapshots'],
  });

/**
 * Hook: Import a snapshot from JSON
 */
export const useImportSnapshot = () =>
  usePublisherMutation<ImportSnapshotResponse, ImportSnapshotRequest>(
    '/publisher/snapshot/import',
    'POST',
    {
      invalidateKeys: ['publisher-snapshots', 'publisher-zmanim', 'publisher-profile', 'publisher-coverage'],
    }
  );

/**
 * Hook: Restore from a saved snapshot (auto-saves current state first)
 */
export function useRestoreSnapshot() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { selectedPublisher } = usePublisherContext();

  return useMutation({
    mutationFn: async (snapshotId: string) => {
      return api.post<RestoreSnapshotResponse>(`/publisher/snapshot/${snapshotId}/restore`);
    },
    onSuccess: () => {
      // Invalidate all publisher-related queries since restore affects everything
      queryClient.invalidateQueries({ queryKey: ['publisher-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['publisher-zmanim'] });
      queryClient.invalidateQueries({ queryKey: ['publisher-profile'] });
      queryClient.invalidateQueries({ queryKey: ['publisher-coverage'] });
    },
  });
}

/**
 * Hook: Delete a saved snapshot
 */
export const useDeleteSnapshot = () =>
  useDeleteMutation<void>('/publisher/snapshot', {
    invalidateKeys: ['publisher-snapshots'],
  });

// =============================================================================
// Export Hook (File Download)
// =============================================================================

/**
 * Hook: Export current state as JSON file download
 */
const JWT_TEMPLATE = process.env.NEXT_PUBLIC_CLERK_JWT_TEMPLATE || 'zmanim-api';

export function useExportSnapshot() {
  const { getToken } = useAuth();
  const { selectedPublisher } = usePublisherContext();

  const exportSnapshot = async (): Promise<void> => {
    const token = await getToken({ template: JWT_TEMPLATE });
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE}/api/v1/publisher/snapshot/export`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Publisher-Id': selectedPublisher?.id || '',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Export failed' }));
      throw new Error(error.message || 'Export failed');
    }

    // Get filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `publisher-snapshot-${new Date().toISOString().split('T')[0]}.json`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match) {
        filename = match[1];
      }
    }

    // Create blob and trigger download
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return useMutation({
    mutationFn: exportSnapshot,
    onSuccess: () => {
      toast.success('Snapshot exported successfully');
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Export failed';
      toast.error(message);
    },
  });
}

// =============================================================================
// Helper Hooks
// =============================================================================

/**
 * Hook: Parse and validate an uploaded snapshot file
 */
export function useParseSnapshotFile() {
  return useMutation({
    mutationFn: async (file: File): Promise<PublisherSnapshot> => {
      const text = await file.text();
      const snapshot = JSON.parse(text) as PublisherSnapshot;

      // Validate schema version
      if (!snapshot.version) {
        throw new Error('Invalid snapshot: missing version field');
      }
      if (snapshot.version !== 1) {
        throw new Error(`Unsupported snapshot version: ${snapshot.version}. Only version 1 is supported.`);
      }

      // Basic structure validation
      if (!Array.isArray(snapshot.zmanim)) {
        throw new Error('Invalid snapshot: missing zmanim data');
      }

      return snapshot;
    },
  });
}
