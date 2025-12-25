/**
 * @file useDebounce.test.ts
 * @purpose Unit tests for useDebounce hook
 * @priority P1 - Core utility hook used across the application
 *
 * Tests cover:
 * - Initial value behavior
 * - Debounce delay functionality
 * - Value updates after delay
 * - Cleanup on value change
 * - Custom delay times
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

// =============================================================================
// Test Setup
// =============================================================================

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// =============================================================================
// useDebounce Tests
// =============================================================================

describe('useDebounce', () => {
  it('[P1] should return initial value immediately', () => {
    // GIVEN: An initial value
    const initialValue = 'test';

    // WHEN: Hook is rendered
    const { result } = renderHook(() => useDebounce(initialValue));

    // THEN: Should return the initial value
    expect(result.current).toBe('test');
  });

  it('[P1] should not update value before delay expires', () => {
    // GIVEN: Initial value
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    // WHEN: Value changes
    rerender({ value: 'updated' });

    // AND: Less than delay time passes
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // THEN: Debounced value should still be initial
    expect(result.current).toBe('initial');
  });

  it('[P1] should update value after delay expires', () => {
    // GIVEN: Initial value
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    // WHEN: Value changes
    rerender({ value: 'updated' });

    // AND: Delay time passes
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // THEN: Debounced value should update
    expect(result.current).toBe('updated');
  });

  it('[P1] should reset timer on rapid changes', () => {
    // GIVEN: Initial value
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    // WHEN: Value changes multiple times rapidly
    rerender({ value: 'change1' });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: 'change2' });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: 'change3' });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // THEN: Value should still be initial (timer keeps resetting)
    expect(result.current).toBe('initial');

    // WHEN: Full delay passes after last change
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // THEN: Should have final value
    expect(result.current).toBe('change3');
  });

  it('[P1] should use default delay of 300ms when not specified', () => {
    // GIVEN: Hook without delay parameter
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: 'initial' } }
    );

    // WHEN: Value changes
    rerender({ value: 'updated' });

    // AND: 299ms passes
    act(() => {
      vi.advanceTimersByTime(299);
    });

    // THEN: Should still be initial
    expect(result.current).toBe('initial');

    // WHEN: 1 more ms passes (300 total)
    act(() => {
      vi.advanceTimersByTime(1);
    });

    // THEN: Should update
    expect(result.current).toBe('updated');
  });

  it('[P2] should work with custom delay', () => {
    // GIVEN: Custom delay of 500ms
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    // WHEN: Value changes
    rerender({ value: 'updated' });

    // AND: 400ms passes
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // THEN: Should still be initial
    expect(result.current).toBe('initial');

    // WHEN: 100 more ms passes (500 total)
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // THEN: Should update
    expect(result.current).toBe('updated');
  });

  it('[P2] should work with number values', () => {
    // GIVEN: Number initial value
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 0 } }
    );

    // WHEN: Value changes to different number
    rerender({ value: 42 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // THEN: Should return number
    expect(result.current).toBe(42);
  });

  it('[P2] should work with object values', () => {
    // GIVEN: Object initial value
    const initialObj = { name: 'initial' };
    const updatedObj = { name: 'updated' };

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: initialObj } }
    );

    // WHEN: Value changes to different object
    rerender({ value: updatedObj });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // THEN: Should return updated object
    expect(result.current).toEqual({ name: 'updated' });
  });

  it('[P2] should work with null and undefined', () => {
    // GIVEN: Null initial value
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce<string | null | undefined>(value, 300),
      { initialProps: { value: null as string | null | undefined } }
    );

    expect(result.current).toBeNull();

    // WHEN: Value changes to undefined
    rerender({ value: undefined });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // THEN: Should return undefined
    expect(result.current).toBeUndefined();

    // WHEN: Value changes to string
    rerender({ value: 'hello' });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // THEN: Should return string
    expect(result.current).toBe('hello');
  });

  it('[P2] should handle delay change', () => {
    // GIVEN: Initial delay of 300ms
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    // WHEN: Value changes
    rerender({ value: 'updated', delay: 300 });

    // AND: 200ms passes
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // AND: Delay changes to 100ms
    rerender({ value: 'updated', delay: 100 });

    // AND: 100ms more passes
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // THEN: Value should update (new delay applied)
    expect(result.current).toBe('updated');
  });

  it('[P3] should clean up timeout on unmount', () => {
    // GIVEN: Hook is rendered
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { rerender, unmount } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    // WHEN: Value changes (creates a timeout)
    rerender({ value: 'updated' });

    // AND: Component unmounts
    unmount();

    // THEN: Timeout should be cleared
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it('[P3] should handle boolean values', () => {
    // GIVEN: Boolean initial value
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: false } }
    );

    expect(result.current).toBe(false);

    // WHEN: Value changes to true
    rerender({ value: true });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // THEN: Should return true
    expect(result.current).toBe(true);
  });

  it('[P3] should handle empty string', () => {
    // GIVEN: Non-empty string
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'has content' } }
    );

    // WHEN: Value changes to empty string
    rerender({ value: '' });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // THEN: Should return empty string
    expect(result.current).toBe('');
  });

  it('[P3] should handle zero delay', () => {
    // GIVEN: Zero delay
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 0),
      { initialProps: { value: 'initial' } }
    );

    // WHEN: Value changes
    rerender({ value: 'updated' });

    // AND: Any time passes
    act(() => {
      vi.advanceTimersByTime(0);
    });

    // THEN: Should update immediately
    expect(result.current).toBe('updated');
  });
});
