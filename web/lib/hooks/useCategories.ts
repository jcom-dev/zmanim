/**
 * Category Hooks for Database-Driven Zmanim Configuration
 *
 * These hooks fetch category data from the backend instead of using
 * hardcoded frontend constants. Data is aggressively cached (1 hour staleTime)
 * as categories rarely change.
 *
 * @example
 * ```tsx
 * import { useTimeCategories, useEventCategories, useTagTypes } from '@/lib/hooks/useCategories';
 *
 * function MyComponent() {
 *   const { data: timeCategories, isLoading } = useTimeCategories();
 *   const { data: eventCategories } = useEventCategories();
 *   const { data: tagTypes } = useTagTypes();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       {timeCategories?.map(tc => (
 *         <div key={tc.key}>{tc.display_name_english}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import { useApi, ApiError } from '@/lib/api-client';

// =============================================================================
// Types
// =============================================================================

export interface TimeCategory {
  id: string;
  key: string;
  display_name_hebrew: string;
  display_name_english: string;
  description?: string;
  icon_name?: string;
  color?: string;
  sort_order: number;
  is_everyday: boolean;
}

export interface EventCategory {
  id: string;
  key: string;
  display_name_hebrew: string;
  display_name_english: string;
  description?: string;
  icon_name?: string;
  color?: string;
  sort_order: number;
}

export interface TagType {
  id: string;
  key: string;
  display_name_hebrew: string;
  display_name_english: string;
  color?: string;
  sort_order: number;
}

export interface DisplayGroup {
  id: string;
  key: string;
  display_name_hebrew: string;
  display_name_english: string;
  description?: string;
  icon_name?: string;
  color?: string;
  sort_order: number;
  time_categories: string[];
}

// =============================================================================
// Cache Configuration
// =============================================================================

/**
 * Category data is nearly static, so we cache aggressively.
 * - staleTime: 1 hour (data won't be refetched unless this expires)
 * - gcTime: 24 hours (data kept in cache for this long)
 */
const CATEGORY_CACHE_CONFIG = {
  staleTime: 1000 * 60 * 60, // 1 hour
  gcTime: 1000 * 60 * 60 * 24, // 24 hours
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  retry: 2,
} as const;

// =============================================================================
// Hooks
// =============================================================================

/**
 * Fetch all time categories from the database.
 *
 * Time categories represent time-of-day groupings for everyday zmanim:
 * dawn, sunrise, morning, midday, afternoon, sunset, nightfall, midnight
 *
 * @example
 * ```tsx
 * const { data: timeCategories, isLoading } = useTimeCategories();
 *
 * // Group zmanim by time category
 * const zmanimByCategory = useMemo(() => {
 *   if (!timeCategories) return {};
 *   return timeCategories.reduce((acc, tc) => {
 *     acc[tc.key] = zmanim.filter(z => z.time_category === tc.key);
 *     return acc;
 *   }, {} as Record<string, Zman[]>);
 * }, [timeCategories, zmanim]);
 * ```
 */
export function useTimeCategories() {
  const api = useApi();

  return useQuery<TimeCategory[], ApiError>({
    queryKey: ['time-categories'],
    queryFn: () => api.public.get<TimeCategory[]>('/categories/time'),
    ...CATEGORY_CACHE_CONFIG,
  });
}

/**
 * Fetch all event categories from the database.
 *
 * Event categories represent special occasion zmanim:
 * candles, havdalah, yom_kippur, fast_day, tisha_bav, pesach
 *
 * @example
 * ```tsx
 * const { data: eventCategories } = useEventCategories();
 *
 * // Build picker options
 * const eventOptions = eventCategories?.map(ec => ({
 *   value: ec.key,
 *   label: ec.display_name_english,
 *   icon: getIcon(ec.icon_name),
 * }));
 * ```
 */
export function useEventCategories() {
  const api = useApi();

  return useQuery<EventCategory[], ApiError>({
    queryKey: ['event-categories'],
    queryFn: () => api.public.get<EventCategory[]>('/categories/events'),
    ...CATEGORY_CACHE_CONFIG,
  });
}

/**
 * Fetch all tag types from the database.
 *
 * Tag types categorize zmanim tags: timing, event, shita, method, behavior
 *
 * @example
 * ```tsx
 * const { data: tagTypes } = useTagTypes();
 *
 * // Get color classes for a tag type
 * const getTagColor = (tagTypeKey: string) => {
 *   const tagType = tagTypes?.find(tt => tt.key === tagTypeKey);
 *   return tagType?.color ?? 'bg-gray-100 text-gray-700';
 * };
 * ```
 */
export function useTagTypes() {
  const api = useApi();

  return useQuery<TagType[], ApiError>({
    queryKey: ['tag-types'],
    queryFn: () => api.public.get<TagType[]>('/tag-types'),
    ...CATEGORY_CACHE_CONFIG,
  });
}

/**
 * Fetch all display groups from the database.
 *
 * Display groups aggregate multiple time_categories into UI sections:
 * dawn, morning, midday, evening
 *
 * @example
 * ```tsx
 * const { data: displayGroups } = useDisplayGroups();
 *
 * // Map a time_category to its display group
 * const getDisplayGroup = (timeCategory: string) => {
 *   return displayGroups?.find(dg =>
 *     dg.time_categories.includes(timeCategory)
 *   );
 * };
 * ```
 */
export function useDisplayGroups() {
  const api = useApi();

  return useQuery<DisplayGroup[], ApiError>({
    queryKey: ['display-groups'],
    queryFn: () => api.public.get<DisplayGroup[]>('/categories/display-groups'),
    ...CATEGORY_CACHE_CONFIG,
  });
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Get all categories combined (useful for components that need everything)
 *
 * @example
 * ```tsx
 * const { timeCategories, eventCategories, tagTypes, isLoading } = useAllCategories();
 * ```
 */
export function useAllCategories() {
  const { data: timeCategories, isLoading: timeCategoriesLoading } = useTimeCategories();
  const { data: eventCategories, isLoading: eventCategoriesLoading } = useEventCategories();
  const { data: tagTypes, isLoading: tagTypesLoading } = useTagTypes();

  return {
    timeCategories,
    eventCategories,
    tagTypes,
    isLoading: timeCategoriesLoading || eventCategoriesLoading || tagTypesLoading,
  };
}

/**
 * Get a time category by its key
 *
 * @example
 * ```tsx
 * const { data: dawnCategory } = useTimeCategoryByKey('dawn');
 * console.log(dawnCategory?.display_name_hebrew); // "שחר"
 * ```
 */
export function useTimeCategoryByKey(key: string | undefined) {
  const { data: categories, isLoading } = useTimeCategories();

  const category = key ? categories?.find(c => c.key === key) : undefined;

  return {
    data: category,
    isLoading,
  };
}

/**
 * Get an event category by its key
 */
export function useEventCategoryByKey(key: string | undefined) {
  const { data: categories, isLoading } = useEventCategories();

  const category = key ? categories?.find(c => c.key === key) : undefined;

  return {
    data: category,
    isLoading,
  };
}

/**
 * Get a tag type by its key
 */
export function useTagTypeByKey(key: string | undefined) {
  const { data: tagTypes, isLoading } = useTagTypes();

  const tagType = key ? tagTypes?.find(t => t.key === key) : undefined;

  return {
    data: tagType,
    isLoading,
  };
}

/**
 * Build lookup maps for efficient access to category data
 *
 * @example
 * ```tsx
 * const { timeCategoriesMap, eventCategoriesMap, tagTypesMap, isLoading } = useCategoryMaps();
 *
 * // O(1) lookup by key
 * const dawnCategory = timeCategoriesMap['dawn'];
 * const candlesCategory = eventCategoriesMap['candles'];
 * const timingTagType = tagTypesMap['timing'];
 * ```
 */
export function useCategoryMaps() {
  const { timeCategories, eventCategories, tagTypes, isLoading } = useAllCategories();

  const timeCategoriesMap = timeCategories?.reduce((acc, tc) => {
    acc[tc.key] = tc;
    return acc;
  }, {} as Record<string, TimeCategory>) ?? {};

  const eventCategoriesMap = eventCategories?.reduce((acc, ec) => {
    acc[ec.key] = ec;
    return acc;
  }, {} as Record<string, EventCategory>) ?? {};

  const tagTypesMap = tagTypes?.reduce((acc, tt) => {
    acc[tt.key] = tt;
    return acc;
  }, {} as Record<string, TagType>) ?? {};

  return {
    timeCategoriesMap,
    eventCategoriesMap,
    tagTypesMap,
    isLoading,
  };
}

/**
 * Build a mapping from time_category to display_group key
 *
 * @example
 * ```tsx
 * const { timeCategoryToDisplayGroup, displayGroupsMap, isLoading } = useDisplayGroupMapping();
 *
 * // Map a zman's time_category to its display group
 * const displayGroupKey = timeCategoryToDisplayGroup['sunrise']; // 'morning'
 * const displayGroup = displayGroupsMap['morning'];
 * ```
 */
export function useDisplayGroupMapping() {
  const { data: displayGroups, isLoading } = useDisplayGroups();

  // Create reverse mapping: time_category -> display_group key
  const timeCategoryToDisplayGroup = displayGroups?.reduce((acc, dg) => {
    for (const tc of dg.time_categories) {
      acc[tc] = dg.key;
    }
    return acc;
  }, {} as Record<string, string>) ?? {};

  // Create display groups map by key
  const displayGroupsMap = displayGroups?.reduce((acc, dg) => {
    acc[dg.key] = dg;
    return acc;
  }, {} as Record<string, DisplayGroup>) ?? {};

  return {
    timeCategoryToDisplayGroup,
    displayGroupsMap,
    displayGroups,
    isLoading,
  };
}
