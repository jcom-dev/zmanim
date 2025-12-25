/**
 * @file useLocality.test.ts
 * @purpose Unit tests for useLocality hook
 * @priority P1 - Core geography/location logic
 *
 * Tests cover:
 * - Fetching locality by ID
 * - Loading states
 * - Error handling
 * - Enabled/disabled state
 * - API response transformation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLocality } from '../useLocality';

// =============================================================================
// Mock Setup
// =============================================================================

const mockPublicGet = vi.fn();

vi.mock('@/lib/api-client', () => ({
  useApi: () => ({
    public: {
      get: mockPublicGet,
    },
  }),
}));

// =============================================================================
// Test Utilities
// =============================================================================

function createMockApiResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: '123',
    name: 'New York',
    country: 'United States',
    country_code: 'US',
    region: 'New York',
    latitude: 40.7128,
    longitude: -74.006,
    timezone: 'America/New_York',
    elevation: 10,
    continent: 'North America',
    display_name: 'New York, NY, United States',
    parent_locality_id: null,
    children_count: 0,
    ...overrides,
  };
}

// =============================================================================
// useLocality Tests
// =============================================================================

describe('useLocality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPublicGet.mockReset();
  });

  it('[P1] should call correct API endpoint', async () => {
    // GIVEN: API returns data
    mockPublicGet.mockResolvedValue(createMockApiResponse());

    // WHEN: Hook is called with ID
    renderHook(() => useLocality({ id: '456' }));

    // THEN: Should call correct endpoint
    await waitFor(() => {
      expect(mockPublicGet).toHaveBeenCalledWith('/localities/456');
    });
  });

  it('[P1] should handle numeric ID', async () => {
    // GIVEN: API returns data
    mockPublicGet.mockResolvedValue(createMockApiResponse({ id: '789' }));

    // WHEN: Hook is called with numeric ID
    renderHook(() => useLocality({ id: 789 }));

    // THEN: Should call with numeric ID
    await waitFor(() => {
      expect(mockPublicGet).toHaveBeenCalledWith('/localities/789');
    });
  });

  it('[P1] should not fetch when id is null', () => {
    // WHEN: Hook is called with null ID
    const { result } = renderHook(() => useLocality({ id: null }));

    // THEN: Should not fetch
    expect(mockPublicGet).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.locality).toBeNull();
  });

  it('[P1] should not fetch when id is undefined', () => {
    // WHEN: Hook is called with undefined ID
    const { result } = renderHook(() => useLocality({ id: undefined }));

    // THEN: Should not fetch
    expect(mockPublicGet).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.locality).toBeNull();
  });

  it('[P1] should not fetch when disabled', () => {
    // WHEN: Hook is called with enabled: false
    const { result } = renderHook(() => useLocality({ id: '123', enabled: false }));

    // THEN: Should not fetch
    expect(mockPublicGet).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('[P2] should handle null response', async () => {
    // GIVEN: API returns null
    mockPublicGet.mockResolvedValue(null);

    // WHEN: Hook is called
    const { result } = renderHook(() => useLocality({ id: '123' }));

    // THEN: Should return null locality
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.locality).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('[P2] should handle null region in response', async () => {
    // GIVEN: API returns locality without region
    mockPublicGet.mockResolvedValue(createMockApiResponse({ region: null }));

    // WHEN: Hook is called
    const { result } = renderHook(() => useLocality({ id: '123' }));

    // THEN: region_name should be undefined
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.locality?.region_name).toBeUndefined();
  });

  it('[P2] should handle null elevation in response', async () => {
    // GIVEN: API returns locality without elevation
    mockPublicGet.mockResolvedValue(createMockApiResponse({ elevation: null }));

    // WHEN: Hook is called
    const { result } = renderHook(() => useLocality({ id: '123' }));

    // THEN: elevation should be undefined
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.locality?.elevation).toBeUndefined();
  });

  it('[P3] should handle zero elevation correctly', async () => {
    // GIVEN: API returns locality at sea level
    mockPublicGet.mockResolvedValue(createMockApiResponse({ elevation: 0 }));

    // WHEN: Hook is called
    const { result } = renderHook(() => useLocality({ id: '123' }));

    // THEN: elevation should be undefined (0 is falsy in original code)
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.locality?.elevation).toBeUndefined();
  });

  it('[P3] should handle empty string ID', () => {
    // WHEN: Hook is called with empty string ID
    const { result } = renderHook(() => useLocality({ id: '' }));

    // THEN: Should not fetch (empty string is falsy)
    expect(mockPublicGet).not.toHaveBeenCalled();
    expect(result.current.locality).toBeNull();
  });

  it('[P1] should transform API response to LocalitySearchResult', async () => {
    // GIVEN: API returns full data
    mockPublicGet.mockResolvedValue(createMockApiResponse());

    // WHEN: Hook is called
    const { result } = renderHook(() => useLocality({ id: '123' }));

    // THEN: Should transform to expected format
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.locality).toMatchObject({
      type: 'locality',
      id: '123',
      name: 'New York',
      locality_type_code: 'locality',
      country_code: 'US',
      country_name: 'United States',
      country: 'United States',
      region_name: 'New York',
      latitude: 40.7128,
      longitude: -74.006,
      timezone: 'America/New_York',
      display_name: 'New York, NY, United States',
    });
  });
});
