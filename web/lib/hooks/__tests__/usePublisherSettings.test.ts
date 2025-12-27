/**
 * @file usePublisherSettings.test.ts
 * @purpose Unit tests for usePublisherSettings hooks and utilities
 * @priority P1 - Core publisher settings/transliteration logic
 *
 * Tests cover:
 * - usePublisherCalculationSettings hook
 * - getShabbatLabel utility
 * - getErevShabbatLabel utility
 * - useTagDisplayName hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  usePublisherCalculationSettings,
  getShabbatLabel,
  getErevShabbatLabel,
  useTagDisplayName,
} from '../usePublisherSettings';

// =============================================================================
// Mock Setup
// =============================================================================

const mockGet = vi.fn();

vi.mock('@/lib/api-client', () => ({
  useApi: () => ({
    get: mockGet,
  }),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status?: number) {
      super(message);
    }
  },
}));

const mockPublisherContext = {
  selectedPublisher: { id: 'pub-123', name: 'Test Publisher' },
  isLoading: false,
};

vi.mock('@/providers/PublisherContext', () => ({
  usePublisherContext: () => mockPublisherContext,
}));

// =============================================================================
// Test Utilities
// =============================================================================

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

// =============================================================================
// getShabbatLabel Tests
// =============================================================================

describe('getShabbatLabel', () => {
  it('[P1] should return "Shabbos" for ashkenazi style', () => {
    expect(getShabbatLabel('ashkenazi')).toBe('Shabbos');
  });

  it('[P1] should return "Shabbat" for sephardi style', () => {
    expect(getShabbatLabel('sephardi')).toBe('Shabbat');
  });

  it('[P1] should return "Shabbat" when style is undefined', () => {
    expect(getShabbatLabel(undefined)).toBe('Shabbat');
  });
});

// =============================================================================
// getErevShabbatLabel Tests
// =============================================================================

describe('getErevShabbatLabel', () => {
  it('[P1] should return "Erev Shabbos" for ashkenazi style', () => {
    expect(getErevShabbatLabel('ashkenazi')).toBe('Erev Shabbos');
  });

  it('[P1] should return "Erev Shabbat" for sephardi style', () => {
    expect(getErevShabbatLabel('sephardi')).toBe('Erev Shabbat');
  });

  it('[P1] should return "Erev Shabbat" when style is undefined', () => {
    expect(getErevShabbatLabel(undefined)).toBe('Erev Shabbat');
  });
});

// =============================================================================
// usePublisherCalculationSettings Tests
// =============================================================================

describe('usePublisherCalculationSettings', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    mockPublisherContext.selectedPublisher = { id: 'pub-123', name: 'Test Publisher' };
    mockPublisherContext.isLoading = false;
  });

  it('[P1] should fetch calculation settings', async () => {
    // GIVEN: API returns settings
    const mockSettings = {
      ignore_elevation: false,
      transliteration_style: 'ashkenazi' as const,
    };
    mockGet.mockResolvedValueOnce(mockSettings);

    // WHEN: Hook is called
    const { result } = renderHook(() => usePublisherCalculationSettings(), {
      wrapper: createWrapper(queryClient),
    });

    // THEN: Should fetch and return settings
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockSettings);
  });

  it('[P1] should call correct endpoint', async () => {
    // GIVEN: API returns settings
    mockGet.mockResolvedValueOnce({
      ignore_elevation: true,
      transliteration_style: 'sephardi',
    });

    // WHEN: Hook is called
    renderHook(() => usePublisherCalculationSettings(), {
      wrapper: createWrapper(queryClient),
    });

    // THEN: Should call correct endpoint
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/publisher/settings/calculation');
    });
  });

  it('[P2] should handle API error', async () => {
    // GIVEN: API returns error
    mockGet.mockRejectedValueOnce(new Error('Settings not found'));

    // WHEN: Hook is called
    const { result } = renderHook(() => usePublisherCalculationSettings(), {
      wrapper: createWrapper(queryClient),
    });

    // THEN: Should return error state
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('[P2] should not fetch when publisher not selected', () => {
    // GIVEN: No publisher selected
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPublisherContext.selectedPublisher = null as any;

    // WHEN: Hook is called
    const { result } = renderHook(() => usePublisherCalculationSettings(), {
      wrapper: createWrapper(queryClient),
    });

    // THEN: Should not fetch
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });
});

// =============================================================================
// useTagDisplayName Tests
// =============================================================================

describe('useTagDisplayName', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    mockPublisherContext.selectedPublisher = { id: 'pub-123', name: 'Test Publisher' };
    mockPublisherContext.isLoading = false;
  });

  it('[P1] should return ashkenazi name by default', async () => {
    // GIVEN: API returns ashkenazi style
    mockGet.mockResolvedValueOnce({
      ignore_elevation: false,
      transliteration_style: 'ashkenazi',
    });

    const testTag = {
      display_name_english_ashkenazi: 'Shabbos',
      display_name_english_sephardi: 'Shabbat',
    };

    // WHEN: Hook is called
    const { result } = renderHook(() => useTagDisplayName(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      const getTagName = result.current;
      expect(getTagName(testTag)).toBe('Shabbos');
    });
  });

  it('[P1] should return sephardi name when style is sephardi', async () => {
    // GIVEN: API returns sephardi style
    mockGet.mockResolvedValueOnce({
      ignore_elevation: false,
      transliteration_style: 'sephardi',
    });

    const testTag = {
      display_name_english_ashkenazi: 'Shabbos',
      display_name_english_sephardi: 'Shabbat',
    };

    // WHEN: Hook is called
    const { result } = renderHook(() => useTagDisplayName(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      const getTagName = result.current;
      expect(getTagName(testTag)).toBe('Shabbat');
    });
  });

  it('[P1] should fall back to display_name_english when available', async () => {
    // GIVEN: API returns ashkenazi style
    mockGet.mockResolvedValueOnce({
      ignore_elevation: false,
      transliteration_style: 'ashkenazi',
    });

    const testTag = {
      display_name_english: 'Default Name',
      display_name_english_ashkenazi: 'Ashkenazi Name',
    };

    // WHEN: Hook is called
    const { result } = renderHook(() => useTagDisplayName(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      const getTagName = result.current;
      // display_name_english takes priority for ashkenazi
      expect(getTagName(testTag)).toBe('Default Name');
    });
  });

  it('[P2] should fall back to ashkenazi name for sephardi when sephardi is null', async () => {
    // GIVEN: API returns sephardi style
    mockGet.mockResolvedValueOnce({
      ignore_elevation: false,
      transliteration_style: 'sephardi',
    });

    const testTag = {
      display_name_english_ashkenazi: 'Ashkenazi Name',
      display_name_english_sephardi: null,
      display_name_english: 'Default Name',
    };

    // WHEN: Hook is called
    const { result } = renderHook(() => useTagDisplayName(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      const getTagName = result.current;
      // Falls back to display_name_english or ashkenazi
      expect(getTagName(testTag)).toBe('Default Name');
    });
  });

  it('[P2] should handle tag with only ashkenazi name', async () => {
    // GIVEN: API returns ashkenazi style
    mockGet.mockResolvedValueOnce({
      ignore_elevation: false,
      transliteration_style: 'ashkenazi',
    });

    const testTag = {
      display_name_english_ashkenazi: 'Only Ashkenazi',
    };

    // WHEN: Hook is called
    const { result } = renderHook(() => useTagDisplayName(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      const getTagName = result.current;
      expect(getTagName(testTag)).toBe('Only Ashkenazi');
    });
  });

  it('[P2] should return empty string when no names available', async () => {
    // GIVEN: API returns settings
    mockGet.mockResolvedValueOnce({
      ignore_elevation: false,
      transliteration_style: 'ashkenazi',
    });

    const testTag = {};

    // WHEN: Hook is called
    const { result } = renderHook(() => useTagDisplayName(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      const getTagName = result.current;
      expect(getTagName(testTag)).toBe('');
    });
  });

  it('[P3] should use ashkenazi as default when settings not loaded', () => {
    // GIVEN: Settings not loaded yet
    mockGet.mockImplementation(() => new Promise(() => {})); // Never resolves

    const testTag = {
      display_name_english_ashkenazi: 'Ashkenazi',
      display_name_english_sephardi: 'Sephardi',
    };

    // WHEN: Hook is called immediately (before settings load)
    const { result } = renderHook(() => useTagDisplayName(), {
      wrapper: createWrapper(queryClient),
    });

    // THEN: Should default to ashkenazi
    const getTagName = result.current;
    expect(getTagName(testTag)).toBe('Ashkenazi');
  });
});
