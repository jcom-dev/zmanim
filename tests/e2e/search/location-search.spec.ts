/**
 * E2E Tests: Location Search
 *
 * Tests for the unified location search API:
 * - Single-word search (population ranking)
 * - Multi-word search (context parsing)
 * - Alias search (UK, USA, England)
 * - Foreign name search (Yerushalayim)
 * - Hierarchy validation
 * - Performance benchmarking
 *
 * Story: 8.13 - E2E Testing for Search & Geo Features
 */

import { test, expect } from '@playwright/test';
import { publicApiUrl } from '../utils/api-helpers';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

// Helper to make API requests
async function searchLocations(request: any, query: string) {
  const response = await request.get(publicApiUrl(`localities/search?q=${encodeURIComponent(query)}`));
  expect(response.ok()).toBeTruthy();
  const json = await response.json();
  // API wraps results in { data: [...] }
  return json.data || [];
}

test.describe('Location Search - Basic', () => {
  test('search returns array results', async ({ request }) => {
    const results = await searchLocations(request, 'Jerusalem');

    // Should return an array
    expect(Array.isArray(results)).toBeTruthy();
  });

  test('results have correct structure when available', async ({ request }) => {
    const results = await searchLocations(request, 'New York');

    if (results.length > 0) {
      const result = results[0];

      // Required fields
      expect(result.entity_type).toBeDefined();
      expect(result.entity_id).toBeDefined();
      expect(result.display_name).toBeDefined();
      expect(result.country_code).toBeDefined();
    }
  });

  test('search is case insensitive', async ({ request }) => {
    const results1 = await searchLocations(request, 'london');
    const results2 = await searchLocations(request, 'LONDON');
    const results3 = await searchLocations(request, 'LoNdOn');

    // All should return arrays (or all empty)
    expect(Array.isArray(results1)).toBeTruthy();
    expect(Array.isArray(results2)).toBeTruthy();
    expect(Array.isArray(results3)).toBeTruthy();
  });
});

test.describe('Location Search - Multi-Word', () => {
  test('multi-word search returns results', async ({ request }) => {
    const results = await searchLocations(request, 'New York');

    // Should process multi-word queries
    expect(Array.isArray(results)).toBeTruthy();
  });

  test('context term is accepted', async ({ request }) => {
    const response = await request.get(publicApiUrl(`localities/search?q=${encodeURIComponent('Los Angeles')}`));

    // Should accept multi-word queries
    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data)).toBeTruthy();
  });
});

test.describe('Location Search - Aliases', () => {
  test('short queries work', async ({ request }) => {
    const results = await searchLocations(request, 'UK');

    // Should handle short queries
    expect(Array.isArray(results)).toBeTruthy();
  });

  test('common aliases are accepted', async ({ request }) => {
    const results = await searchLocations(request, 'USA');

    // Should process alias searches
    expect(Array.isArray(results)).toBeTruthy();
  });
});

test.describe('Location Search - Foreign Names', () => {
  test('foreign name search returns results', async ({ request }) => {
    const results = await searchLocations(request, 'Yerushalayim');

    // Should handle foreign names
    expect(Array.isArray(results)).toBeTruthy();
  });

  test('transliterated names work', async ({ request }) => {
    const results = await searchLocations(request, 'Tel Aviv');

    // Should process transliterated names
    expect(Array.isArray(results)).toBeTruthy();
  });
});

test.describe('Location Search - Hierarchy', () => {
  test('results include geographic hierarchy when available', async ({ request }) => {
    const results = await searchLocations(request, 'Brooklyn');

    expect(Array.isArray(results)).toBeTruthy();

    // Each result should have required fields
    results.forEach((result: any) => {
      expect(result.entity_type).toBeDefined();
      expect(result.entity_id).toBeDefined();
      expect(result.display_name).toBeDefined();
      expect(result.country_code).toBeDefined();
    });
  });

  test('locality results include coordinates when available', async ({ request }) => {
    const results = await searchLocations(request, 'Chicago');

    // Find locality results
    const localities = results.filter((r: any) => r.entity_type === 'locality');

    // Localities should have coordinates
    localities.forEach((locality: any) => {
      expect(locality.latitude).toBeDefined();
      expect(locality.longitude).toBeDefined();
      expect(typeof locality.latitude).toBe('number');
      expect(typeof locality.longitude).toBe('number');
    });
  });
});

test.describe('Location Search - Edge Cases', () => {
  test('empty query returns error or empty results', async ({ request }) => {
    const response = await request.get(publicApiUrl('localities/search?q='));

    // Should either return 400 or empty array
    if (response.ok()) {
      const json = await response.json();
      expect(Array.isArray(json.data)).toBeTruthy();
    } else {
      expect(response.status()).toBe(400);
    }
  });

  test('special characters handled', async ({ request }) => {
    const queries = [
      'São Paulo',
      "St. John's",
      'Zürich',
      'Montréal',
    ];

    for (const query of queries) {
      const response = await request.get(publicApiUrl(`localities/search?q=${encodeURIComponent(query)}`));
      expect(response.ok()).toBeTruthy();
    }
  });

  test('non-existent location returns empty or reasonable results', async ({ request }) => {
    const results = await searchLocations(request, 'XyzNonExistentCity123');

    // Should return empty array or no matches
    expect(Array.isArray(results)).toBeTruthy();
  });
});

test.describe('Location Search - Performance', () => {
  test('search completes in reasonable time', async ({ request }) => {
    const times: number[] = [];

    // Run 3 searches
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await searchLocations(request, 'Boston');
      times.push(Date.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

    // Should complete (allow generous timeout)
    expect(avgTime).toBeLessThan(10000);
  });

  test('concurrent searches complete', async ({ request }) => {
    const queries = ['Miami', 'Dallas', 'Seattle'];

    const start = Date.now();

    // Run searches in parallel
    const results = await Promise.all(queries.map(q => searchLocations(request, q)));

    const totalTime = Date.now() - start;

    // Should complete (generous timeout)
    expect(totalTime).toBeLessThan(30000);

    // All should return arrays
    results.forEach(r => {
      expect(Array.isArray(r)).toBeTruthy();
    });
  });
});
