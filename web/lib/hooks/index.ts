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
  useTagTypes,
  useDisplayGroups,
  useAllCategories,
  useTimeCategoryByKey,
  useTagTypeByKey,
  useCategoryMaps,
  useDisplayGroupMapping,
  type TimeCategory,
  type TagType,
  type DisplayGroup,
} from './useCategories';

// Shared Utility Hooks (Story 6.2)
export { useDebounce } from './useDebounce';
export {
  useLocationSearch,
  type UseLocationSearchOptions,
  type UseLocationSearchReturn,
} from './useLocationSearch';
export {
  useMapPreview,
  type UseMapPreviewOptions,
  type UseMapPreviewReturn,
  type AddBoundaryOptions,
} from './useMapPreview';

// Preview Toolbar Hook (Preview Toolbar Requirements R2)
export {
  usePreviewToolbar,
  type UsePreviewToolbarOptions,
  type PreviewToolbarState,
} from './usePreviewToolbar';

// Publisher Settings Hook
export {
  usePublisherCalculationSettings,
  getShabbatLabel,
  getErevShabbatLabel,
  type CalculationSettings,
} from './usePublisherSettings';
