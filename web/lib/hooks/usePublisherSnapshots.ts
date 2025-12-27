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
} from './useApiQuery';
import { useApi } from '@/lib/api-client';
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
  rounding_mode: string;
  display_status: string;
  category: 'essential' | 'optional' | 'custom';
  master_zman_id?: string;
  linked_publisher_zman_id?: string;
  tags?: Array<{ tag_key: string; is_negated: boolean }>;
}

export interface PublisherSnapshot {
  format_type?: string;
  format_version: number;
  exported_at: string;
  description: string;
  publisher_id?: number;
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
  zmanim_created: number;
  zmanim_updated: number;
  zmanim_unchanged: number;
  message?: string;
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
export function useExportSnapshot() {
  const api = useApi();

  const exportSnapshot = async (): Promise<void> => {
    const response = await api.getRaw('/publisher/snapshot/export');

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

      // Validate schema version (support format_version 1 or 2)
      if (!snapshot.format_version) {
        throw new Error('Invalid snapshot: missing format_version field');
      }
      if (snapshot.format_version !== 1 && snapshot.format_version !== 2) {
        throw new Error(`Unsupported snapshot version: ${snapshot.format_version}. Only versions 1 and 2 are supported.`);
      }

      // Basic structure validation
      if (!Array.isArray(snapshot.zmanim)) {
        throw new Error('Invalid snapshot: missing zmanim data');
      }

      return snapshot;
    },
  });
}
