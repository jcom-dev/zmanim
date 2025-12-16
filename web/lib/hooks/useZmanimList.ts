/**
 * Zmanim List Hooks
 *
 * Hooks for managing publisher zmanim using factory patterns.
 * Uses usePublisherQuery and usePublisherMutation for consistent
 * error handling, automatic cache invalidation, and type safety.
 */

import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  usePublisherQuery,
  usePublisherMutation,
  useDeleteMutation,
  useDynamicMutation,
  useGlobalQuery,
} from './useApiQuery';
import { useApi } from '@/lib/api-client';
import { usePublisherContext } from '@/providers/PublisherContext';
import { applyTimeRounding } from '@/lib/utils/time-format';

// =============================================================================
// Types (unchanged from original)
// =============================================================================

export interface ZmanTag {
  id: number; // Changed from string to number to match backend int32
  tag_key: string;
  name: string;
  display_name_hebrew: string;
  display_name_english: string;
  tag_type: 'event' | 'timing' | 'behavior' | 'shita' | 'calculation' | 'category' | 'jewish_day';
  description?: string | null;
  color?: string | null;
  sort_order?: number;
  is_negated?: boolean; // When true, zman should NOT appear on days matching this tag
  tag_source?: 'master' | 'publisher'; // Source of the tag
  source_is_negated?: boolean | null; // Original negation state from master registry
  is_modified?: boolean; // True if tag differs from master registry
}

// Display status controls how zmanim appear to users
// Note: Soft deletes use deleted_at timestamp, not this enum
export type DisplayStatus = 'core' | 'optional' | 'hidden';

export interface PublisherZman {
  id: string;
  publisher_id: string;
  zman_key: string;
  hebrew_name: string;
  english_name: string;
  transliteration?: string | null;
  description?: string | null;
  formula_dsl: string;
  ai_explanation: string | null;
  publisher_comment: string | null;
  is_enabled: boolean;
  is_visible: boolean;
  is_published: boolean;
  is_beta: boolean;
  is_event_zman: boolean;
  display_status: DisplayStatus; // core, optional, hidden
  dependencies: string[];
  time_category?: string;
  timestamp?: number; // Unix timestamp for time-based sorting
  rounding_mode: 'floor' | 'math' | 'ceil'; // Display rounding when seconds hidden (Story 8-34)
  created_at: string;
  updated_at: string;
  deleted_at?: string | null; // Soft delete timestamp (null = not deleted)
  tags?: ZmanTag[]; // Tags from master zman
  // Linked zmanim fields
  master_zman_id?: string | null;
  linked_publisher_zman_id?: string | null;
  is_linked: boolean;
  linked_source_publisher_name?: string | null;
  linked_source_is_deleted: boolean;
  // Source/original values from registry or linked publisher (for diff/revert functionality)
  source_hebrew_name?: string | null;
  source_english_name?: string | null;
  source_transliteration?: string | null;
  source_description?: string | null;
  source_formula_dsl?: string | null;
}

export interface CreateZmanRequest {
  zman_key: string;
  hebrew_name: string;
  english_name: string;
  formula_dsl: string;
  ai_explanation?: string;
  publisher_comment?: string;
  is_enabled?: boolean;
  is_visible?: boolean;
}

export interface UpdateZmanRequest {
  hebrew_name?: string;
  english_name?: string;
  transliteration?: string;
  description?: string;
  formula_dsl?: string;
  ai_explanation?: string;
  publisher_comment?: string;
  is_enabled?: boolean;
  is_visible?: boolean;
  is_published?: boolean;
  is_beta?: boolean;
  display_status?: DisplayStatus; // core, optional, hidden
  category?: string; // deprecated, use display_status
  rounding_mode?: 'floor' | 'math' | 'ceil'; // Display rounding when seconds hidden (Story 8-34)
}

export interface PreviewLocation {
  latitude: number;
  longitude: number;
  timezone: string;
  displayName: string;
}

export interface PreviewResult {
  result: string; // DEPRECATED: Use time_exact, time_rounded, or time_display instead
  time_exact?: string; // HH:mm:ss exact time with seconds
  time_rounded?: string; // HH:mm:ss rounded per rounding_mode (with :00)
  time_display?: string; // HH:mm rounded for display (no seconds)
  timestamp: number;
  breakdown: CalculationStep[];
}

export interface CalculationStep {
  step: number;
  description: string;
  value: string;
}

export interface DayPreview {
  date: string;
  hebrew_date: string;
  result: string;
  sunrise: string;
  sunset: string;
  events: string[];
  is_shabbat: boolean;
  is_yom_tov: boolean;
}

export interface WeeklyPreviewResult {
  days: DayPreview[];
}

export interface ImportZmanimRequest {
  source: 'defaults' | 'publisher';
  publisher_id?: string;
  zman_keys?: string[];
}

export interface ImportZmanimResponse {
  data: PublisherZman[];
  count: number;
  message: string;
}

// =============================================================================
// Query Hooks (Refactored)
// =============================================================================

/**
 * Hook: Get all zmanim for the current publisher
 *
 * Supports two modes:
 * 1. Raw list (no params): Returns zmanim with metadata only
 * 2. Calculated times (with params): Returns zmanim with calculated times for a specific date/location
 *
 * @param params - Optional calculation parameters
 * @param params.date - ISO date string (e.g., "2025-12-19")
 * @param params.latitude - Location latitude
 * @param params.longitude - Location longitude
 * @param params.enabled - Optional flag to disable the query (defaults to true)
 *
 * @example
 * // Raw list (no calculations)
 * const { data: zmanim } = useZmanimList();
 *
 * @example
 * // Calculated times for a specific date/location
 * const { data: zmanim } = useZmanimList({
 *   date: "2025-12-19",
 *   latitude: 40.7128,
 *   longitude: -74.0060
 * });
 *
 * @example
 * // Conditionally disable query
 * const { data: zmanim } = useZmanimList(
 *   hasCoverage ? { date, latitude, longitude } : { enabled: false }
 * );
 */
export const useZmanimList = (params?: {
  date?: string;
  latitude?: number;
  longitude?: number;
  enabled?: boolean;
}) =>
  usePublisherQuery<PublisherZman[]>(
    ['publisher-zmanim', params?.date, params?.latitude, params?.longitude],
    '/publisher/zmanim',
    {
      params: params && params.date && params.latitude !== undefined && params.longitude !== undefined
        ? {
            date: params.date,
            latitude: String(params.latitude),
            longitude: String(params.longitude),
          }
        : undefined,
      enabled: params?.enabled !== false, // Default to true, only disable if explicitly set to false
    }
  );

/**
 * Hook: Get single zman by key
 */
export const useZmanDetails = (zmanKey: string | null) =>
  usePublisherQuery<PublisherZman | null>(
    ['publisher-zman', zmanKey],
    `/publisher/zmanim/${zmanKey}`,
    { enabled: !!zmanKey }
  );

/**
 * Hook: Browse public zmanim with search
 */
export const useBrowseZmanim = (searchQuery?: string, category?: string) =>
  usePublisherQuery<Array<PublisherZman & { publisher_name: string; usage_count: number }>>(
    ['browse-zmanim', searchQuery, category],
    '/zmanim/browse',
    {
      params: { q: searchQuery, category },
      enabled: !!searchQuery || !!category,
    }
  );

// =============================================================================
// Mutation Hooks (Refactored)
// =============================================================================

/**
 * Hook: Create new zman
 * Invalidates both simple and locality-based zmanim caches
 */
export const useCreateZman = () =>
  usePublisherMutation<PublisherZman, CreateZmanRequest>('/publisher/zmanim', 'POST', {
    invalidateKeys: ['publisher-zmanim', 'publisher-zmanim-with-locality'],
  });

/**
 * Hook: Update zman
 *
 * Updates caches for both simple list and locality-based queries.
 * For simple property changes (enabled, visibility, display_status, published, beta, rounding),
 * we update the cache directly without refetching to prevent card reordering.
 *
 * For formula changes, the edit page handles full refetch separately.
 *
 * Special handling for is_enabled changes:
 * - When disabling: removes zman from visible lists, invalidates disabled-zmanim cache
 * - When enabling: invalidates caches to refetch fresh data
 */
export function useUpdateZman(zmanKey: string) {
  const queryClient = useQueryClient();
  const { selectedPublisher } = usePublisherContext();

  return useDynamicMutation<PublisherZman, UpdateZmanRequest>(
    () => `/publisher/zmanim/${zmanKey}`,
    'PUT',
    (data) => data,
    {
      // No invalidateKeys - we manually update caches to prevent list re-sorting
      onSuccess: (updatedZman, variables) => {
        // Check if rounding_mode was changed - need to recalculate time_rounded
        const roundingModeChanged = variables.rounding_mode !== undefined;
        // Check if is_enabled changed
        const enabledChanged = variables.is_enabled !== undefined;

        // If is_enabled changed, invalidate disabled-zmanim cache and update lists
        if (enabledChanged) {
          // Always invalidate disabled-zmanim to refresh the Disabled Zmanim dialog
          queryClient.invalidateQueries({ queryKey: ['disabled-zmanim'] });

          // If the zman was disabled (is_enabled set to false), remove it from visible lists
          if (variables.is_enabled === false) {
            // Remove from simple zmanim list cache
            queryClient.setQueryData<PublisherZman[]>(
              ['publisher-zmanim', selectedPublisher?.id],
              (oldData) => oldData?.filter((z) => z.zman_key !== zmanKey)
            );

            // Remove from locality-based zmanim cache
            type FilteredZmanimResponse = {
              day_context: unknown;
              zmanim: Array<PublisherZman & { time?: string; time_rounded?: string; timestamp?: number }>;
            };
            queryClient.setQueriesData<FilteredZmanimResponse>(
              { queryKey: ['publisher-zmanim-with-locality', selectedPublisher?.id] },
              (oldData) => {
                if (!oldData) return oldData;
                return {
                  ...oldData,
                  zmanim: oldData.zmanim.filter((z) => z.zman_key !== zmanKey),
                };
              }
            );

            // Remove from preview caches
            type PreviewData = {
              day_context: unknown;
              zmanim: Array<{ zman_key: string; time?: string; time_rounded?: string; error?: string; rounding_mode?: 'floor' | 'math' | 'ceil' }>;
            };
            queryClient.setQueriesData<PreviewData>(
              { queryKey: ['zmanim-preview'] },
              (oldData) => {
                if (!oldData) return oldData;
                return {
                  ...oldData,
                  zmanim: oldData.zmanim.filter((z) => z.zman_key !== zmanKey),
                };
              }
            );
            return; // Skip the normal update logic since we removed the item
          }

          // If re-enabled (is_enabled set to true), invalidate caches to refetch
          // This ensures the zman appears in the correct position with fresh data
          queryClient.invalidateQueries({ queryKey: ['publisher-zmanim'] });
          queryClient.invalidateQueries({ queryKey: ['publisher-zmanim-with-locality'] });
          return;
        }

        // Helper to update a single zman in an array, with optional time_rounded recalculation
        // Note: The API response from PUT doesn't include tags or is_event_zman, so we must preserve them explicitly
        const updateZmanInArray = <T extends { zman_key: string; time?: string; time_rounded?: string; tags?: ZmanTag[]; is_event_zman?: boolean }>(arr: T[]): T[] =>
          arr.map((z) => {
            if (z.zman_key !== zmanKey) return z;

            // Preserve tags and is_event_zman from the original zman since API response doesn't include them
            const updated = { ...z, ...updatedZman, tags: z.tags, is_event_zman: z.is_event_zman };

            // If rounding mode changed and we have exact time, recalculate time_rounded
            if (roundingModeChanged && z.time && updatedZman.rounding_mode) {
              (updated as T & { time_rounded?: string }).time_rounded = applyTimeRounding(
                z.time,
                updatedZman.rounding_mode as 'floor' | 'math' | 'ceil'
              );
            }

            return updated;
          });

        // 1. Update simple zmanim list cache (used by useZmanimList)
        queryClient.setQueryData<PublisherZman[]>(
          ['publisher-zmanim', selectedPublisher?.id],
          (oldData) => oldData ? updateZmanInArray(oldData) : oldData
        );

        // 2. Update locality-based zmanim cache (used by useAlgorithmPageData)
        // Use setQueriesData to update all locality/date variants
        type FilteredZmanimResponse = {
          day_context: unknown;
          zmanim: Array<PublisherZman & { time?: string; time_rounded?: string; timestamp?: number }>;
        };
        queryClient.setQueriesData<FilteredZmanimResponse>(
          { queryKey: ['publisher-zmanim-with-locality', selectedPublisher?.id] },
          (oldData) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              zmanim: updateZmanInArray(oldData.zmanim),
            };
          }
        );

        // 3. Update preview caches (for AlgorithmPreview component)
        type PreviewData = {
          day_context: unknown;
          zmanim: Array<{ zman_key: string; time?: string; time_rounded?: string; error?: string; rounding_mode?: 'floor' | 'math' | 'ceil' }>;
        };
        queryClient.setQueriesData<PreviewData>(
          { queryKey: ['zmanim-preview'] },
          (oldData) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              zmanim: oldData.zmanim.map((z) => {
                if (z.zman_key !== zmanKey) return z;

                const updated = { ...z, rounding_mode: updatedZman.rounding_mode };

                // Recalculate time_rounded if rounding mode changed and we have exact time
                if (roundingModeChanged && z.time && updatedZman.rounding_mode) {
                  updated.time_rounded = applyTimeRounding(
                    z.time,
                    updatedZman.rounding_mode as 'floor' | 'math' | 'ceil'
                  );
                }

                return updated;
              }),
            };
          }
        );
      },
    }
  );
}

/**
 * Hook: Delete zman (custom only)
 * Invalidates both simple and locality-based zmanim caches, plus deleted zmanim list
 */
export const useDeleteZman = () =>
  useDeleteMutation<void>('/publisher/zmanim', {
    invalidateKeys: ['publisher-zmanim', 'publisher-zmanim-with-locality', 'deleted-zmanim'],
  });

/**
 * Hook: Import zmanim from defaults or another publisher
 * Invalidates both simple and locality-based zmanim caches
 */
export const useImportZmanim = () =>
  usePublisherMutation<ImportZmanimResponse, ImportZmanimRequest>('/publisher/zmanim/import', 'POST', {
    invalidateKeys: ['publisher-zmanim', 'publisher-zmanim-with-locality'],
  });

/**
 * Hook: Get tags for a publisher zman
 */
export const usePublisherZmanTags = (zmanKey: string | null) =>
  usePublisherQuery<ZmanTag[]>(
    ['publisher-zman-tags', zmanKey],
    `/publisher/zmanim/${zmanKey}/tags`,
    { enabled: !!zmanKey }
  );

/**
 * Tag assignment with optional negation
 */
export interface TagAssignment {
  tag_id: number; // Changed from string to number to match backend int32
  is_negated: boolean;
}

/**
 * Hook: Update tags for a publisher zman (replace all tags)
 * Supports negated tags for exclusion logic (e.g., "show on Yom Tov except Pesach")
 */
export function useUpdatePublisherZmanTags(zmanKey: string) {
  return useDynamicMutation<ZmanTag[], { tags: TagAssignment[] }>(
    () => `/publisher/zmanim/${zmanKey}/tags`,
    'PUT',
    (data) => data,
    {
      invalidateKeys: ['publisher-zmanim', 'publisher-zmanim-with-locality', `publisher-zman-tags-${zmanKey}`],
    }
  );
}

/**
 * Hook: Add a single tag to a publisher zman
 */
export function useAddPublisherZmanTag(zmanKey: string) {
  return useDynamicMutation<void, { tagId: string }>(
    (vars) => `/publisher/zmanim/${zmanKey}/tags/${vars.tagId}`,
    'POST',
    () => undefined,
    {
      invalidateKeys: ['publisher-zmanim', 'publisher-zmanim-with-locality', `publisher-zman-tags-${zmanKey}`],
    }
  );
}

/**
 * Hook: Remove a single tag from a publisher zman
 */
export function useRemovePublisherZmanTag(zmanKey: string) {
  return useDynamicMutation<void, { tagId: string }>(
    (vars) => `/publisher/zmanim/${zmanKey}/tags/${vars.tagId}`,
    'DELETE',
    () => undefined,
    {
      invalidateKeys: ['publisher-zmanim', 'publisher-zmanim-with-locality', `publisher-zman-tags-${zmanKey}`],
    }
  );
}

/**
 * Hook: Revert all tags to master registry state
 * Deletes publisher-specific tag overrides and reverts to master defaults
 */
export function useRevertPublisherZmanTags(zmanKey: string) {
  return useDynamicMutation<{ message: string; tags: ZmanTag[] }, void>(
    () => `/publisher/zmanim/${zmanKey}/tags/revert`,
    'POST',
    (data) => data,
    {
      invalidateKeys: ['publisher-zmanim', 'publisher-zmanim-with-locality', `publisher-zman-tags-${zmanKey}`],
    }
  );
}

// =============================================================================
// Preview/Validation Hooks (Refactored)
// =============================================================================

/**
 * Hook: Preview formula (single day)
 *
 * Note: This uses the api directly since it's a one-off preview operation,
 * not a data fetching pattern that needs caching.
 */
export function usePreviewFormula() {
  const api = useApi();

  return useMutation({
    mutationFn: async (params: {
      formula: string;
      date: string;
      location: PreviewLocation;
      references?: Record<string, string>;
    }) => {
      return api.post<PreviewResult>('/dsl/preview', {
        body: JSON.stringify({
          formula: params.formula,
          date: params.date,
          latitude: params.location.latitude,
          longitude: params.location.longitude,
          timezone: params.location.timezone,
          references: params.references,
        }),
      });
    },
  });
}

/**
 * Hook: Preview formula (weekly)
 */
export function usePreviewWeek() {
  const api = useApi();

  return useMutation({
    mutationFn: async (params: { formula: string; start_date: string; location: PreviewLocation }) => {
      return api.post<WeeklyPreviewResult>('/dsl/preview-week', {
        body: JSON.stringify({
          formula: params.formula,
          start_date: params.start_date,
          latitude: params.location.latitude,
          longitude: params.location.longitude,
          timezone: params.location.timezone,
        }),
      });
    },
  });
}

/**
 * Hook: Validate DSL formula
 */
export function useValidateFormula() {
  const api = useApi();

  return useMutation({
    mutationFn: async (formula: string) => {
      return api.post<{
        valid: boolean;
        errors?: Array<{ message: string; line?: number; column?: number }>;
        dependencies?: string[];
      }>('/dsl/validate', {
        body: JSON.stringify({ formula }),
      });
    },
  });
}

// =============================================================================
// Helper Functions (unchanged)
// =============================================================================

/**
 * Categorize zmanim by display_status
 */
export function categorizeZmanim(zmanim: PublisherZman[]) {
  return {
    core: zmanim.filter((z) => z.display_status === 'core'),
    optional: zmanim.filter((z) => z.display_status === 'optional'),
    hidden: zmanim.filter((z) => z.display_status === 'hidden'),
  };
}

/**
 * Extract dependencies from formula (client-side)
 */
export function extractDependencies(formula: string): string[] {
  const regex = /@([a-z_][a-z0-9_]*)/g;
  const matches = formula.matchAll(regex);
  const deps = new Set<string>();

  for (const match of matches) {
    deps.add(match[1]);
  }

  return Array.from(deps);
}

// =============================================================================
// Master Zmanim Registry Types & Hooks
// =============================================================================

// Note: ZmanTag is defined at the top of this file - this type extends it
// for the master zman context with additional fields
export interface MasterZmanTag extends ZmanTag {
  description: string | null;
  color: string | null;
}

export interface MasterZman {
  id: string;
  zman_key: string;
  canonical_hebrew_name: string;
  canonical_english_name: string;
  transliteration: string | null;
  description: string | null;
  halachic_notes: string | null;
  halachic_source: string | null;
  time_category: 'dawn' | 'sunrise' | 'morning' | 'midday' | 'afternoon' | 'sunset' | 'nightfall' | 'midnight';
  default_formula_dsl: string;
  is_core: boolean;
  tags: MasterZmanTag[];
  created_at: string;
  updated_at: string;
}

export interface GroupedMasterZmanim {
  [timeCategory: string]: MasterZman[];
}

/**
 * Hook: Get all master zmanim from registry
 */
export const useMasterZmanim = () =>
  useGlobalQuery<MasterZman[]>('master-zmanim', '/registry/zmanim', {
    staleTime: 1000 * 60 * 60, // 1 hour - registry is mostly static
  });

/**
 * Hook: Get master zmanim grouped by time category
 */
export const useMasterZmanimGrouped = () => {
  return useGlobalQuery<GroupedMasterZmanim>(
    'master-zmanim-grouped',
    '/registry/zmanim/grouped',
    {
      staleTime: 1000 * 60 * 5, // 5 minutes - shorter for registry updates
    }
  );
};

/**
 * Hook: Get event zmanim grouped by event_category (candles, havdalah, etc.)
 * Based on HebCal's approach - event zmanim are grouped by PURPOSE not day type
 */
export const useEventZmanimGrouped = () =>
  useGlobalQuery<GroupedMasterZmanim>(
    'event-zmanim-grouped',
    '/registry/zmanim/events',
    {
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  );

/**
 * Hook: Get all tags
 */
export const useZmanTags = () => {
  const query = useGlobalQuery<{ tags: ZmanTag[] }>('zman-tags', '/registry/tags', {
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Extract tags array from response
  return {
    ...query,
    data: query.data?.tags ?? [],
  };
};

// =============================================================================
// Jewish Events Types & Hooks
// =============================================================================

export interface JewishEvent {
  id: string;
  code: string;
  name_hebrew: string;
  name_english: string;
  event_type: 'weekly' | 'yom_tov' | 'fast' | 'informational';
  duration_days_israel: number;
  duration_days_diaspora: number;
  fast_start_type: 'dawn' | 'sunset' | null;
  parent_event_code: string | null;
  sort_order: number;
}

export interface EventDayInfo {
  gregorian_date: string;
  hebrew_date: {
    year: number;
    month: number;
    day: number;
    month_name: string;
    formatted: string;
    formatted_hebrew: string;
  };
  day_of_week: number;
  is_shabbat: boolean;
  is_yomtov: boolean;
  is_fast_day: boolean;
  is_in_israel: boolean;
  active_events: ActiveEvent[];
  erev_events: ActiveEvent[];
  moetzei_events: ActiveEvent[];
  special_contexts: string[];
  holidays: Array<{
    name: string;
    name_hebrew: string;
    category: string;
    yomtov: boolean;
  }>;
}

export interface ActiveEvent {
  event_code: string;
  name_hebrew: string;
  name_english: string;
  day_number: number;
  total_days: number;
  is_final_day: boolean;
  fast_start_type?: string;
}

export interface ZmanimContext {
  show_daily_zmanim: boolean;
  show_candle_lighting: boolean;
  show_candle_lighting_sheni: boolean;
  show_shabbos_yomtov_ends: boolean;
  show_fast_starts: boolean;
  fast_start_type: string;
  show_fast_ends: boolean;
  show_chametz_times: boolean;
  display_contexts: string[];
  active_event_codes: string[];
}

/**
 * Hook: Get all Jewish events
 */
export const useJewishEvents = (eventType?: string) =>
  useGlobalQuery<JewishEvent[]>(
    ['jewish-events', eventType],
    '/calendar/events',
    {
      params: { type: eventType },
      staleTime: 1000 * 60 * 60, // 1 hour - events don't change
    }
  );

/**
 * Hook: Get event day info for a specific date and location
 */
export function useEventDayInfo(params: {
  date: string;
  latitude: number;
  longitude: number;
  timezone?: string;
} | null) {
  return useGlobalQuery<EventDayInfo>(
    ['event-day-info', params?.date, params?.latitude, params?.longitude],
    '/calendar/day-info',
    {
      params: params ? {
        date: params.date,
        latitude: String(params.latitude),
        longitude: String(params.longitude),
        timezone: params.timezone,
      } : undefined,
      enabled: !!params?.date && !!params?.latitude && !!params?.longitude,
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  );
}

/**
 * Hook: Get zmanim context for a date (determines which zmanim to show)
 */
export function useZmanimContext(params: {
  date: string;
  latitude: number;
  longitude: number;
  timezone?: string;
} | null) {
  return useGlobalQuery<ZmanimContext>(
    ['zmanim-context', params?.date, params?.latitude, params?.longitude],
    '/calendar/zmanim-context',
    {
      params: params ? {
        date: params.date,
        latitude: String(params.latitude),
        longitude: String(params.longitude),
        timezone: params.timezone,
      } : undefined,
      enabled: !!params?.date && !!params?.latitude && !!params?.longitude,
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  );
}

/**
 * Hook: Get event info for a week
 */
export function useWeekEventInfo(params: {
  start_date: string;
  latitude: number;
  longitude: number;
  timezone?: string;
} | null) {
  return useGlobalQuery<Record<string, EventDayInfo>>(
    ['week-event-info', params?.start_date, params?.latitude, params?.longitude],
    '/calendar/week-events',
    {
      params: params ? {
        start_date: params.start_date,
        latitude: String(params.latitude),
        longitude: String(params.longitude),
        timezone: params.timezone,
      } : undefined,
      enabled: !!params?.start_date && !!params?.latitude && !!params?.longitude,
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  );
}

/**
 * Hook: Get zmanim filtered by Jewish event
 */
export const useMasterZmanimByEvent = (eventCode: string | null, dayNumber?: number) =>
  useGlobalQuery<MasterZman[]>(
    ['master-zmanim-by-event', eventCode, dayNumber],
    '/registry/zmanim/by-event',
    {
      params: {
        event_code: eventCode || undefined,
        day_number: dayNumber !== undefined ? String(dayNumber) : undefined,
      },
      enabled: !!eventCode,
      staleTime: 1000 * 60 * 60, // 1 hour
    }
  );

/**
 * Hook: Get applicable events for a specific zman
 */
export const useZmanApplicableEvents = (zmanKey: string | null) =>
  useGlobalQuery<Array<{
    event: JewishEvent;
    applies_to_day: number | null;
    is_default: boolean;
    notes: string | null;
  }>>(
    ['zman-applicable-events', zmanKey],
    '/registry/zman-events',
    {
      params: { zman_key: zmanKey || undefined },
      enabled: !!zmanKey,
      staleTime: 1000 * 60 * 60, // 1 hour
    }
  );

/**
 * Hook: Create zman from master registry
 */
export interface CreateFromRegistryRequest {
  master_zman_id: string;
  formula_dsl?: string;
}

export const useCreateZmanFromRegistry = () =>
  usePublisherMutation<PublisherZman, CreateFromRegistryRequest>('/publisher/zmanim', 'POST', {
    invalidateKeys: ['publisher-zmanim'],
  });

// =============================================================================
// Per-Zman Version History Types & Hooks
// =============================================================================

export interface ZmanVersion {
  id: string;
  publisher_zman_id: string;
  version_number: number;
  formula_dsl: string;
  created_by: string | null;
  created_at: string;
}

export interface ZmanVersionHistoryResponse {
  versions: ZmanVersion[];
  current_version: number;
  total: number;
}

/**
 * Hook: Get version history for a specific zman
 */
export function useZmanVersionHistory(zmanKey: string | null) {
  return usePublisherQuery<ZmanVersionHistoryResponse>(
    ['zman-version-history', zmanKey],
    `/publisher/zmanim/${zmanKey}/history`,
    { enabled: !!zmanKey }
  );
}

/**
 * Hook: Rollback zman to a previous version
 */
export function useRollbackZmanVersion(zmanKey: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { selectedPublisher } = usePublisherContext();

  return useMutation({
    mutationFn: async (params: { version_number: number }) => {
      return api.post<PublisherZman>(`/publisher/zmanim/${zmanKey}/rollback`, {
        body: JSON.stringify(params),
      });
    },
    onSuccess: () => {
      // Invalidate both the zman and its version history
      queryClient.invalidateQueries({ queryKey: ['publisher-zmanim'] });
      queryClient.invalidateQueries({ queryKey: ['publisher-zman', zmanKey] });
      queryClient.invalidateQueries({ queryKey: ['zman-version-history', zmanKey] });
    },
  });
}

// =============================================================================
// Soft Delete & Restore Types & Hooks
// =============================================================================

export interface DeletedZman {
  id: string;
  publisher_id: string;
  zman_key: string;
  hebrew_name: string;
  english_name: string;
  formula_dsl: string;
  time_category: string;
  deleted_at: string;
  deleted_by: string | null;
  master_zman_id: string | null;
}

/**
 * Hook: Get deleted zmanim for restore
 */
export const useDeletedZmanim = () =>
  usePublisherQuery<DeletedZman[]>('deleted-zmanim', '/publisher/zmanim/deleted');

/**
 * Hook: Restore a soft-deleted zman
 */
export function useRestoreZman() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (zmanKey: string) => {
      return api.post<PublisherZman>(`/publisher/zmanim/${zmanKey}/restore`);
    },
    onSuccess: () => {
      // Invalidate and refetch all matching queries regardless of additional params
      queryClient.invalidateQueries({ queryKey: ['publisher-zmanim'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['publisher-zmanim-with-locality'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['deleted-zmanim'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['publisher-zmanim-examples'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['registry-master'], refetchType: 'all' });
    },
  });
}

/**
 * Hook: Permanently delete a soft-deleted zman
 */
export function usePermanentDeleteZman() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (zmanKey: string) => {
      return api.delete<void>(`/publisher/zmanim/${zmanKey}/permanent`);
    },
    onSuccess: () => {
      // Invalidate and refetch all deleted-zmanim queries
      queryClient.invalidateQueries({ queryKey: ['deleted-zmanim'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['publisher-zmanim-examples'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['registry-master'], refetchType: 'all' });
    },
  });
}

// =============================================================================
// Disabled Zmanim Types & Hooks
// =============================================================================

/**
 * Disabled zman type - zmanim with is_enabled=false
 */
export interface DisabledZman {
  id: string;
  publisher_id: string;
  zman_key: string;
  hebrew_name: string;
  english_name: string;
  formula_dsl: string;
  time_category?: string;
  is_enabled: boolean;
  is_published: boolean;
  master_zman_id: string | null;
  updated_at: string;
}

/**
 * Hook: Get disabled zmanim for enable/manage
 * Requires locality_id to fetch zmanim with includeDisabled=true
 */
export function useDisabledZmanim(localityId: number | null) {
  const api = useApi();
  const { selectedPublisher } = usePublisherContext();

  return useQuery({
    queryKey: ['disabled-zmanim', selectedPublisher?.id, localityId],
    queryFn: async () => {
      if (!localityId) return [];
      // Fetch all zmanim including disabled ones
      // api-client auto-unwraps .data, so response is the FilteredZmanimResponse
      const response = await api.get<{ zmanim: DisabledZman[] }>(
        `/publisher/zmanim?locality_id=${localityId}&includeDisabled=true`
      );
      // Filter to only disabled zmanim
      const zmanim = response?.zmanim || [];
      return zmanim.filter((z: DisabledZman) => !z.is_enabled);
    },
    enabled: !!selectedPublisher?.id && !!localityId,
    staleTime: 0, // Always refetch to get latest status
  });
}

/**
 * Hook: Enable a disabled zman (set is_enabled=true)
 */
export function useEnableZman() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (zmanKey: string) => {
      return api.put<PublisherZman>(`/publisher/zmanim/${zmanKey}`, {
        body: JSON.stringify({ is_enabled: true }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publisher-zmanim'] });
      queryClient.invalidateQueries({ queryKey: ['disabled-zmanim'] });
      queryClient.invalidateQueries({ queryKey: ['publisher-zmanim-with-locality'] });
    },
  });
}

/**
 * Hook: Disable a zman (set is_enabled=false)
 */
export function useDisableZman() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (zmanKey: string) => {
      return api.put<PublisherZman>(`/publisher/zmanim/${zmanKey}`, {
        body: JSON.stringify({ is_enabled: false }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publisher-zmanim'] });
      queryClient.invalidateQueries({ queryKey: ['disabled-zmanim'] });
      queryClient.invalidateQueries({ queryKey: ['publisher-zmanim-with-locality'] });
    },
  });
}

// =============================================================================
// Astronomical Primitives Types & Hooks
// =============================================================================

export interface AstronomicalPrimitive {
  id: string;
  variable_name: string;
  display_name: string;
  description: string | null;
  formula_dsl: string;
  category: string;
  sort_order: number;
}

export interface AstronomicalPrimitivesGrouped {
  category: string;
  display_name: string;
  primitives: AstronomicalPrimitive[];
}

/**
 * Hook: Get all astronomical primitives (flat list)
 */
export const useAstronomicalPrimitives = () =>
  useGlobalQuery<AstronomicalPrimitive[]>('astronomical-primitives', '/registry/primitives', {
    staleTime: 1000 * 60 * 60, // 1 hour - primitives are static
  });

/**
 * Hook: Get astronomical primitives grouped by category
 */
export const useAstronomicalPrimitivesGrouped = () =>
  useGlobalQuery<AstronomicalPrimitivesGrouped[]>(
    'astronomical-primitives-grouped',
    '/registry/primitives/grouped',
    {
      staleTime: 1000 * 60 * 60, // 1 hour - primitives are static
    }
  );

// =============================================================================
// Linked Zmanim Types & Hooks
// =============================================================================

export interface VerifiedPublisher {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  zmanim_count: number;
}

export interface PublisherZmanForLinking {
  id: string;
  zman_key: string;
  hebrew_name: string;
  english_name: string;
  formula_dsl: string;
  category: string;
}

export interface CreateFromPublisherRequest {
  source_publisher_zman_id: string;
  mode: 'copy' | 'link';
}

/**
 * Hook: Get verified publishers for linking
 */
export const useVerifiedPublishers = () =>
  usePublisherQuery<VerifiedPublisher[]>(
    'verified-publishers',
    '/publishers/verified',
    {
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  );

/**
 * Hook: Get zmanim from a specific publisher for linking
 */
export const usePublisherZmanimForLinking = (publisherId: string | null) =>
  usePublisherQuery<PublisherZmanForLinking[]>(
    ['publisher-zmanim-for-linking', publisherId],
    `/publishers/${publisherId}/zmanim`,
    {
      enabled: !!publisherId,
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  );

/**
 * Hook: Create zman from another publisher (copy or link)
 */
export const useCreateZmanFromPublisher = () =>
  usePublisherMutation<PublisherZman, CreateFromPublisherRequest>(
    '/publisher/zmanim/from-publisher',
    'POST',
    {
      invalidateKeys: ['publisher-zmanim'],
    }
  );
