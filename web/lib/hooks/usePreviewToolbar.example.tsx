/**
 * @file usePreviewToolbar.example.tsx
 * @purpose Example usage of usePreviewToolbar hook
 * @note This is a documentation file, not part of the application
 */

import { usePreviewToolbar } from '@/lib/hooks/usePreviewToolbar';

/**
 * Example 1: Basic Usage (Publisher Algorithm Page)
 *
 * Per-page locality and date storage, global language from PreferencesContext
 */
export function AlgorithmPageExample() {
  const {
    localityId,
    localityName,
    setLocality,
    date,
    setDate,
    setLanguage,
    hasLocation,
    isHebrew,
  } = usePreviewToolbar({
    storageKey: 'algorithm',
    restrictToCoverage: true,
    publisherId: 123,
    isGlobalPublisher: false,
  });

  return (
    <div>
      {/* Location Status */}
      {hasLocation ? (
        <p>
          Previewing for: {localityName} (ID: {localityId})
        </p>
      ) : (
        <p>No location selected</p>
      )}

      {/* Date Display */}
      <p>Date: {date}</p>

      {/* Language Status */}
      <p>Language: {isHebrew ? 'Hebrew' : 'English'}</p>

      {/* Actions */}
      <button onClick={() => setLocality(12345, 'Jerusalem, Israel')}>
        Set Jerusalem
      </button>
      <button onClick={() => setDate('2025-12-25')}>Set Christmas</button>
      <button onClick={() => setLanguage('he')}>Switch to Hebrew</button>
    </div>
  );
}

/**
 * Example 2: Global Publisher (No Coverage Restriction)
 *
 * When publisher has global coverage, isGlobal is true
 */
export function GlobalPublisherExample() {
  const { hasLocation } = usePreviewToolbar({
    storageKey: 'publisher_registry',
    isGlobalPublisher: true, // Coverage restriction disabled
  });

  return (
    <div>
      {!hasLocation && <p>Select any locality worldwide to preview</p>}
    </div>
  );
}

/**
 * Example 3: Admin Registry (Always Global Search)
 *
 * No coverage restriction, no publisher context
 */
export function AdminRegistryExample() {
  const { localityId, date, setLocality, setDate } = usePreviewToolbar({
    storageKey: 'admin_registry',
    restrictToCoverage: false, // Admin can search all localities
  });

  return (
    <div>
      <LocalityPicker
        selectedId={localityId}
        onSelect={(id: number, name: string) => setLocality(id, name)}
        restrictToCoverage={false}
      />
      <DatePicker value={date} onChange={setDate} />
    </div>
  );
}

/**
 * Example 4: Multiple Instances on Same Page
 *
 * Different storage keys = independent state
 */
export function MultipleInstancesExample() {
  const algorithm = usePreviewToolbar({ storageKey: 'algorithm' });
  const primitives = usePreviewToolbar({ storageKey: 'primitives' });

  // These are independent - changing one doesn't affect the other
  return (
    <div>
      <div>
        <h3>Algorithm Preview</h3>
        <p>Location: {algorithm.localityName || 'None'}</p>
      </div>
      <div>
        <h3>Primitives Preview</h3>
        <p>Location: {primitives.localityName || 'None'}</p>
      </div>
      <div>
        <h3>Shared Language</h3>
        <p>Both use: {algorithm.language}</p>
        {/* Changing language affects both because it's global */}
        <button onClick={() => algorithm.setLanguage('he')}>
          Switch Both to Hebrew
        </button>
      </div>
    </div>
  );
}

/**
 * Example 5: Conditional API Calls Based on hasLocation
 *
 * Only fetch preview data when location is set
 */
export function ConditionalFetchExample() {
  const { localityId, date, hasLocation } = usePreviewToolbar({
    storageKey: 'algorithm',
  });

  // Don't make API calls if no location selected
  const { data, isLoading } = useQuery({
    queryKey: ['preview', localityId, date],
    queryFn: () => fetchPreviewData(localityId!, date),
    enabled: hasLocation, // Only fetch when hasLocation is true
  });

  if (!hasLocation) {
    return <EmptyState message="Select a location to preview times" />;
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return <PreviewResults data={data} />;
}

/**
 * Example 6: Cookie Naming Pattern
 *
 * Demonstrates how storage keys map to cookie names
 */
export function CookieNamingExample() {
  // storageKey: 'algorithm'
  // Creates cookies:
  //   - zmanim_preview_algorithm_locality_id
  //   - zmanim_preview_algorithm_locality_name
  //   - zmanim_preview_algorithm_date

  usePreviewToolbar({ storageKey: 'algorithm' });

  // storageKey: 'publisher_registry'
  // Creates cookies:
  //   - zmanim_preview_publisher_registry_locality_id
  //   - zmanim_preview_publisher_registry_locality_name
  //   - zmanim_preview_publisher_registry_date

  usePreviewToolbar({ storageKey: 'publisher_registry' });

  // Language is ALWAYS from global cookie: zmanim_language
  // (managed by PreferencesContext, not per-page)

  return null;
}

/**
 * Dummy components for examples
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LocalityPicker(_props: { selectedId?: number | null; onSelect: (id: number, name: string) => void; restrictToCoverage: boolean }) {
  return null;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function DatePicker(_props: { value: string; onChange: (date: string) => void }) {
  return null;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function EmptyState(_props: { message: string }) {
  return null;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LoadingSpinner() {
  return null;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PreviewResults(_props: { data: unknown }) {
  return null;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function useQuery(_options: { queryKey: unknown[]; queryFn: () => Promise<unknown>; enabled: boolean }) {
  return { data: null, isLoading: false };
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function fetchPreviewData(_localityId: number, _date: string) {
  return Promise.resolve(null);
}
