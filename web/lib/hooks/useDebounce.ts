/**
 * @file useDebounce.ts
 * @purpose Debounce hook for delaying state updates
 * @pattern hook
 * @compliance React:✓
 */

import { useState, useEffect } from 'react';

/**
 * Debounces a value by delaying its update until after a specified delay.
 *
 * This hook returns the debounced value which only updates after the specified
 * delay has passed without the value changing. Useful for search inputs, API calls,
 * and other scenarios where you want to wait for user input to stabilize before acting.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 *
 * @example
 * ```tsx
 * function SearchComponent() {
 *   const [query, setQuery] = useState('');
 *   const debouncedQuery = useDebounce(query, 500);
 *
 *   useEffect(() => {
 *     if (debouncedQuery) {
 *       // Make API call with debounced query
 *       searchAPI(debouncedQuery);
 *     }
 *   }, [debouncedQuery]);
 *
 *   return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
 * }
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout to update the debounced value after delay
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timeout if value changes before delay expires
    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delay]);

  return debouncedValue;
}
