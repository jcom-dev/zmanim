/**
 * @file usePreviewToolbar.test.ts
 * @purpose Unit tests for usePreviewToolbar hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreviewToolbar } from '../usePreviewToolbar';

// Create mock cookie store
let mockCookies: Record<string, string | undefined> = {};

// Mock PreferencesContext
vi.mock('@/lib/contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    preferences: {
      language: 'en',
    },
    setLanguage: vi.fn(),
  }),
}));

// Mock js-cookie with typed functions
vi.mock('js-cookie', () => ({
  default: {
    get: vi.fn((key: string) => mockCookies[key]),
    set: vi.fn((key: string, value: string) => {
      mockCookies[key] = value;
    }),
    remove: vi.fn((key: string) => {
      delete mockCookies[key];
    }),
  },
}));

describe('usePreviewToolbar', () => {
  beforeEach(() => {
    // Clear mock cookie store
    mockCookies = {};
    vi.clearAllMocks();
  });

  it('should initialize with default values when no cookies exist', () => {
    const { result } = renderHook(() =>
      usePreviewToolbar({ storageKey: 'algorithm' })
    );

    expect(result.current.localityId).toBe(null);
    expect(result.current.localityName).toBe(null);
    expect(result.current.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // ISO format
    expect(result.current.language).toBe('en');
    expect(result.current.hasLocation).toBe(false);
    expect(result.current.isHebrew).toBe(false);
  });

  it('should initialize from cookies when they exist', () => {
    // Set up mock cookies
    mockCookies = {
      zmanim_preview_algorithm_locality_id: '12345',
      zmanim_preview_algorithm_locality_name: 'Jerusalem, Israel',
      zmanim_preview_algorithm_date: '2025-12-25',
    };

    const { result } = renderHook(() =>
      usePreviewToolbar({ storageKey: 'algorithm' })
    );

    expect(result.current.localityId).toBe(12345);
    expect(result.current.localityName).toBe('Jerusalem, Israel');
    expect(result.current.date).toBe('2025-12-25');
  });

  it('should use different cookie keys for different storage keys', () => {
    // Set up different cookies for different storage keys
    mockCookies = {
      zmanim_preview_algorithm_locality_id: '111',
      zmanim_preview_publisher_registry_locality_id: '222',
    };

    const { result: result1 } = renderHook(() =>
      usePreviewToolbar({ storageKey: 'algorithm' })
    );
    const { result: result2 } = renderHook(() =>
      usePreviewToolbar({ storageKey: 'publisher_registry' })
    );

    // Each hook should read from its own cookie namespace
    expect(result1.current.localityId).toBe(111);
    expect(result2.current.localityId).toBe(222);
  });

  it('should set locality and update cookies', () => {
    const { result } = renderHook(() =>
      usePreviewToolbar({ storageKey: 'algorithm' })
    );

    act(() => {
      result.current.setLocality(12345, 'Jerusalem, Israel');
    });

    expect(mockCookies['zmanim_preview_algorithm_locality_id']).toBe('12345');
    expect(mockCookies['zmanim_preview_algorithm_locality_name']).toBe('Jerusalem, Israel');
  });

  it('should set date and update cookies', () => {
    const { result } = renderHook(() =>
      usePreviewToolbar({ storageKey: 'algorithm' })
    );

    act(() => {
      result.current.setDate('2025-12-25');
    });

    expect(mockCookies['zmanim_preview_algorithm_date']).toBe('2025-12-25');
  });

  it('should clear locality when set to null', () => {
    // Set up initial cookies
    mockCookies = {
      zmanim_preview_algorithm_locality_id: '12345',
      zmanim_preview_algorithm_locality_name: 'Jerusalem, Israel',
    };

    const { result } = renderHook(() =>
      usePreviewToolbar({ storageKey: 'algorithm' })
    );

    act(() => {
      result.current.setLocality(null, null);
    });

    expect(mockCookies['zmanim_preview_algorithm_locality_id']).toBeUndefined();
    expect(mockCookies['zmanim_preview_algorithm_locality_name']).toBeUndefined();
  });

  it('should set isGlobal based on isGlobalPublisher option', () => {
    const { result: regionalResult } = renderHook(() =>
      usePreviewToolbar({ storageKey: 'algorithm', isGlobalPublisher: false })
    );

    const { result: globalResult } = renderHook(() =>
      usePreviewToolbar({ storageKey: 'algorithm', isGlobalPublisher: true })
    );

    expect(regionalResult.current.isGlobal).toBe(false);
    expect(globalResult.current.isGlobal).toBe(true);
  });

  it('should set hasLocation when locality is set', () => {
    const { result } = renderHook(() =>
      usePreviewToolbar({ storageKey: 'algorithm' })
    );

    expect(result.current.hasLocation).toBe(false);

    act(() => {
      result.current.setLocality(12345, 'Jerusalem, Israel');
    });

    expect(result.current.hasLocation).toBe(true);
  });
});
