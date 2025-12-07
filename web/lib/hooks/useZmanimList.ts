/**
 * Zmanim List Hooks
 *
 * Hooks for managing publisher zmanim using factory patterns.
 * Uses usePublisherQuery and usePublisherMutation for consistent
 * error handling, automatic cache invalidation, and type safety.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  usePublisherQuery,
  usePublisherMutation,
  useDeleteMutation,
  useDynamicMutation,
  useGlobalQuery,
} from './useApiQuery';
import { useApi } from '@/lib/api-client';
import { usePublisherContext } from '@/providers/PublisherContext';

// =============================================================================
// Types (unchanged from original)
// =============================================================================

export interface ZmanTag {
  id: string;
  tag_key: string;
  name: string;
  display_name_hebrew: string;
  display_name_english: string;
  tag_type: 'event' | 'timing' | 'behavior' | 'shita' | 'calculation' | 'category' | 'jewish_day';
  description?: string | null;
  color?: string | null;
  sort_order?: number;
  is_negated?: boolean; // When true, zman should NOT appear on days matching this tag
}

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
  category: 'essential' | 'optional';
  dependencies: string[];
  time_category?: string;
  created_at: string;
  updated_at: string;
  tags?: ZmanTag[]; // Tags from master zman
  // Linked zmanim fields
  master_zman_id?: string | null;
  linked_publisher_zman_id?: string | null;
  source_type?: 'registry' | 'copied' | 'linked' | null;
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
  category?: 'essential' | 'optional';
}

export interface PreviewLocation {
  latitude: number;
  longitude: number;
  timezone: string;
  displayName: string;
}

export interface PreviewResult {
  result: string;
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
 * BEFORE (15 lines):
 * ```
 * const { fetchWithAuth } = useAuthenticatedFetch();
 * const { selectedPublisher, isLoading } = usePublisherContext();
 * return useQuery({
 *   queryKey: ['publisher-zmanim', selectedPublisher?.id],
 *   queryFn: async () => {
 *     const response = await fetchWithAuth<{ data: PublisherZman[] }>('/api/v1/publisher/zmanim');
 *     return response.data;
 *   },
 *   enabled: !isLoading && !!selectedPublisher?.id,
 * });
 * ```
 *
 * AFTER (1 line):
 */
export const useZmanimList = () =>
  usePublisherQuery<PublisherZman[]>('publisher-zmanim', '/publisher/zmanim');

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
 */
export const useCreateZman = () =>
  usePublisherMutation<PublisherZman, CreateZmanRequest>('/publisher/zmanim', 'POST', {
    invalidateKeys: ['publisher-zmanim'],
  });

/**
 * Hook: Update zman
 */
export function useUpdateZman(zmanKey: string) {
  return useDynamicMutation<PublisherZman, UpdateZmanRequest>(
    () => `/publisher/zmanim/${zmanKey}`,
    'PUT',
    (data) => data,
    {
      invalidateKeys: ['publisher-zmanim', `publisher-zman-${zmanKey}`],
    }
  );
}

/**
 * Hook: Delete zman (custom only)
 */
export const useDeleteZman = () =>
  useDeleteMutation<void>('/publisher/zmanim', {
    invalidateKeys: ['publisher-zmanim'],
  });

/**
 * Hook: Import zmanim from defaults or another publisher
 */
export const useImportZmanim = () =>
  usePublisherMutation<ImportZmanimResponse, ImportZmanimRequest>('/publisher/zmanim/import', 'POST', {
    invalidateKeys: ['publisher-zmanim'],
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
  tag_id: string;
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
      invalidateKeys: ['publisher-zmanim', `publisher-zman-tags-${zmanKey}`],
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
      invalidateKeys: ['publisher-zmanim', `publisher-zman-tags-${zmanKey}`],
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
      invalidateKeys: ['publisher-zmanim', `publisher-zman-tags-${zmanKey}`],
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
    mutationFn: async (params: { formula: string; date: string; location: PreviewLocation }) => {
      return api.post<PreviewResult>('/dsl/preview', {
        body: JSON.stringify({
          formula: params.formula,
          date: params.date,
          latitude: params.location.latitude,
          longitude: params.location.longitude,
          timezone: params.location.timezone,
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
 * Categorize zmanim by category
 */
export function categorizeZmanim(zmanim: PublisherZman[]) {
  return {
    essential: zmanim.filter((z) => z.category === 'essential'),
    optional: zmanim.filter((z) => z.category === 'optional'),
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
  day_types?: DayType[];
  created_at: string;
  updated_at: string;
}

export interface DayType {
  id: string;
  name: string;
  display_name_hebrew: string;
  display_name_english: string;
  description: string | null;
  parent_type: string | null;
  sort_order: number;
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
 * @param dayTypes - Optional day types filter (string or array, e.g., 'weekday' or ['erev_shabbos', 'motzei_shabbos'])
 */
export const useMasterZmanimGrouped = (dayTypes?: string | string[]) => {
  // Convert to comma-separated string for API
  const dayTypesParam = Array.isArray(dayTypes) ? dayTypes.join(',') : dayTypes;

  return useGlobalQuery<GroupedMasterZmanim>(
    ['master-zmanim-grouped', dayTypesParam],
    '/registry/zmanim/grouped',
    {
      params: { day_types: dayTypesParam },
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

export interface ZmanDisplayContext {
  id: string;
  context_code: string;
  display_name_hebrew: string;
  display_name_english: string;
  sort_order: number;
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
 * Hook: Get display contexts for a zman (context-specific names)
 */
export const useZmanDisplayContexts = (zmanKey: string | null) =>
  useGlobalQuery<ZmanDisplayContext[]>(
    ['zman-display-contexts', zmanKey],
    '/registry/display-contexts',
    {
      params: { zman_key: zmanKey || undefined },
      enabled: !!zmanKey,
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
 * Hook: Get applicable day types for a specific zman
 */
export const useZmanDayTypes = (zmanKey: string | null) =>
  useGlobalQuery<DayType[]>(
    ['zman-day-types', zmanKey],
    `/registry/zmanim/${zmanKey}/day-types`,
    {
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
      queryClient.invalidateQueries({ queryKey: ['publisher-zmanim'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-zmanim'] });
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
      queryClient.invalidateQueries({ queryKey: ['deleted-zmanim'] });
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
  calculation_type: 'horizon' | 'solar_angle' | 'transit';
  solar_angle: number | null;
  is_dawn: boolean | null;
  edge_type: string;
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
