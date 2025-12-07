// New unified API client (recommended)
export { usePublisherApi, useApi, useAdminApi, useApiFactory, ApiError, createApiClient, API_BASE } from '../api-client';

// API Query Factories (recommended for data fetching)
export {
  usePublisherQuery,
  usePublisherMutation,
  useGlobalQuery,
  useDynamicMutation,
  useDeleteMutation,
  useInvalidatePublisherQueries,
  usePrefetchPublisherQuery,
  type PublisherQueryOptions,
  type PublisherMutationOptions,
} from './useApiQuery';

// Zmanim List Hooks
export {
  useZmanimList,
  useZmanDetails,
  useCreateZman,
  useUpdateZman,
  useDeleteZman,
  useImportZmanim,
  useBrowseZmanim,
  usePreviewFormula,
  usePreviewWeek,
  useValidateFormula,
  categorizeZmanim,
  extractDependencies,
  type PublisherZman,
  type CreateZmanRequest,
  type UpdateZmanRequest,
  type PreviewLocation,
  type PreviewResult,
  type CalculationStep,
  type DayPreview,
  type WeeklyPreviewResult,
  type ImportZmanimRequest,
  type ImportZmanimResponse,
} from './useZmanimList';

// User Roles Hook (dual-role support)
export { useUserRoles, useHasPublisherAccess, type UserRoles } from './useUserRoles';

// Category Hooks (database-driven zmanim configuration)
export {
  useTimeCategories,
  useEventCategories,
  useTagTypes,
  useDisplayGroups,
  useAllCategories,
  useTimeCategoryByKey,
  useEventCategoryByKey,
  useTagTypeByKey,
  useCategoryMaps,
  useDisplayGroupMapping,
  type TimeCategory,
  type EventCategory,
  type TagType,
  type DisplayGroup,
} from './useCategories';
