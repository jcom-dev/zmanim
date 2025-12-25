/**
 * @file useZmanimList.test.ts
 * @purpose Unit tests for useZmanimList hook helper functions
 * @priority P1 - Core data fetching logic
 *
 * Tests cover:
 * - categorizeZmanim helper function
 * - extractDependencies formula parsing
 * - Type definitions validation
 */

import { describe, it, expect } from 'vitest';
import {
  categorizeZmanim,
  extractDependencies,
  type PublisherZman,
  type DisplayStatus,
} from '../useZmanimList';

// =============================================================================
// Test Factories
// =============================================================================

/**
 * Factory for creating test PublisherZman objects
 */
function createTestZman(overrides: Partial<PublisherZman> = {}): PublisherZman {
  return {
    id: 'test-id-' + Math.random().toString(36).substring(7),
    publisher_id: 'pub-123',
    zman_key: 'test_zman',
    hebrew_name: 'זמן בדיקה',
    english_name: 'Test Zman',
    transliteration: 'Zman Bedika',
    description: 'A test zman for unit testing',
    formula_dsl: 'sunrise',
    ai_explanation: null,
    publisher_comment: null,
    is_enabled: true,
    is_visible: true,
    is_published: false,
    is_beta: false,
    is_event_zman: false,
    display_status: 'core' as DisplayStatus,
    dependencies: [],
    rounding_mode: 'floor',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    is_linked: false,
    linked_source_is_deleted: false,
    ...overrides,
  };
}

// =============================================================================
// categorizeZmanim Tests
// =============================================================================

describe('categorizeZmanim', () => {
  it('[P1] should return empty arrays when given empty input', () => {
    // GIVEN: Empty zmanim array
    const zmanim: PublisherZman[] = [];

    // WHEN: Categorizing zmanim
    const result = categorizeZmanim(zmanim);

    // THEN: All categories should be empty
    expect(result.core).toEqual([]);
    expect(result.optional).toEqual([]);
    expect(result.hidden).toEqual([]);
  });

  it('[P1] should correctly categorize zmanim by display_status', () => {
    // GIVEN: Zmanim with different display statuses
    const coreZman1 = createTestZman({ zman_key: 'sunrise', display_status: 'core' });
    const coreZman2 = createTestZman({ zman_key: 'sunset', display_status: 'core' });
    const optionalZman = createTestZman({ zman_key: 'mincha', display_status: 'optional' });
    const hiddenZman = createTestZman({ zman_key: 'debug_time', display_status: 'hidden' });

    const zmanim = [coreZman1, coreZman2, optionalZman, hiddenZman];

    // WHEN: Categorizing zmanim
    const result = categorizeZmanim(zmanim);

    // THEN: Zmanim should be in correct categories
    expect(result.core).toHaveLength(2);
    expect(result.core).toContain(coreZman1);
    expect(result.core).toContain(coreZman2);

    expect(result.optional).toHaveLength(1);
    expect(result.optional).toContain(optionalZman);

    expect(result.hidden).toHaveLength(1);
    expect(result.hidden).toContain(hiddenZman);
  });

  it('[P1] should handle zmanim with only one category', () => {
    // GIVEN: All zmanim are core
    const zmanim = [
      createTestZman({ zman_key: 'sunrise', display_status: 'core' }),
      createTestZman({ zman_key: 'sunset', display_status: 'core' }),
    ];

    // WHEN: Categorizing zmanim
    const result = categorizeZmanim(zmanim);

    // THEN: Only core should have items
    expect(result.core).toHaveLength(2);
    expect(result.optional).toHaveLength(0);
    expect(result.hidden).toHaveLength(0);
  });

  it('[P2] should preserve zman order within categories', () => {
    // GIVEN: Zmanim in specific order
    const zman1 = createTestZman({ zman_key: 'alos', display_status: 'core' });
    const zman2 = createTestZman({ zman_key: 'sunrise', display_status: 'core' });
    const zman3 = createTestZman({ zman_key: 'midday', display_status: 'core' });

    const zmanim = [zman1, zman2, zman3];

    // WHEN: Categorizing zmanim
    const result = categorizeZmanim(zmanim);

    // THEN: Order should be preserved
    expect(result.core[0]).toBe(zman1);
    expect(result.core[1]).toBe(zman2);
    expect(result.core[2]).toBe(zman3);
  });
});

// =============================================================================
// extractDependencies Tests
// =============================================================================

describe('extractDependencies', () => {
  it('[P1] should extract single dependency from formula', () => {
    // GIVEN: Formula with one dependency
    const formula = '@sunrise + 30min';

    // WHEN: Extracting dependencies
    const deps = extractDependencies(formula);

    // THEN: Should find sunrise dependency
    expect(deps).toEqual(['sunrise']);
  });

  it('[P1] should extract multiple dependencies from formula', () => {
    // GIVEN: Formula with multiple dependencies
    const formula = '(@sunrise + @sunset) / 2';

    // WHEN: Extracting dependencies
    const deps = extractDependencies(formula);

    // THEN: Should find both dependencies
    expect(deps).toContain('sunrise');
    expect(deps).toContain('sunset');
    expect(deps).toHaveLength(2);
  });

  it('[P1] should return empty array when no dependencies', () => {
    // GIVEN: Formula with no dependencies
    const formula = 'solar(-16.1)';

    // WHEN: Extracting dependencies
    const deps = extractDependencies(formula);

    // THEN: Should return empty array
    expect(deps).toEqual([]);
  });

  it('[P1] should deduplicate repeated dependencies', () => {
    // GIVEN: Formula with repeated dependency
    const formula = '@alos_hashachar + @alos_hashachar - 10min';

    // WHEN: Extracting dependencies
    const deps = extractDependencies(formula);

    // THEN: Should return unique dependency
    expect(deps).toEqual(['alos_hashachar']);
  });

  it('[P2] should handle complex DSL formulas', () => {
    // GIVEN: Complex real-world formula
    const formula = '@alos_hashachar + ((@sunrise - @alos_hashachar) * 0.5)';

    // WHEN: Extracting dependencies
    const deps = extractDependencies(formula);

    // THEN: Should find all dependencies
    expect(deps).toContain('alos_hashachar');
    expect(deps).toContain('sunrise');
    expect(deps).toHaveLength(2);
  });

  it('[P2] should handle underscores in dependency names', () => {
    // GIVEN: Formula with underscore-containing dependencies
    const formula = '@sof_zman_shma_gra + @mincha_gedola';

    // WHEN: Extracting dependencies
    const deps = extractDependencies(formula);

    // THEN: Should extract full names with underscores
    expect(deps).toContain('sof_zman_shma_gra');
    expect(deps).toContain('mincha_gedola');
  });

  it('[P2] should handle formulas with numbers in dependency names', () => {
    // GIVEN: Formula with numbers in dependency name
    const formula = '@tzeis_72min + 10min';

    // WHEN: Extracting dependencies
    const deps = extractDependencies(formula);

    // THEN: Should extract dependency with numbers
    expect(deps).toContain('tzeis_72min');
  });

  it('[P3] should handle empty formula', () => {
    // GIVEN: Empty formula
    const formula = '';

    // WHEN: Extracting dependencies
    const deps = extractDependencies(formula);

    // THEN: Should return empty array
    expect(deps).toEqual([]);
  });

  it('[P3] should handle formula with only whitespace', () => {
    // GIVEN: Whitespace-only formula
    const formula = '   \n\t  ';

    // WHEN: Extracting dependencies
    const deps = extractDependencies(formula);

    // THEN: Should return empty array
    expect(deps).toEqual([]);
  });
});

// =============================================================================
// Type Validation Tests
// =============================================================================

describe('PublisherZman type', () => {
  it('[P2] should have all required fields', () => {
    // GIVEN: A minimal valid PublisherZman
    const zman = createTestZman();

    // THEN: All required fields should be present
    expect(zman.id).toBeDefined();
    expect(zman.publisher_id).toBeDefined();
    expect(zman.zman_key).toBeDefined();
    expect(zman.hebrew_name).toBeDefined();
    expect(zman.english_name).toBeDefined();
    expect(zman.formula_dsl).toBeDefined();
    expect(zman.is_enabled).toBeDefined();
    expect(zman.is_visible).toBeDefined();
    expect(zman.is_published).toBeDefined();
    expect(zman.display_status).toBeDefined();
    expect(zman.rounding_mode).toBeDefined();
  });

  it('[P2] should accept valid display_status values', () => {
    // GIVEN/WHEN/THEN: Each valid status should work
    expect(() => createTestZman({ display_status: 'core' })).not.toThrow();
    expect(() => createTestZman({ display_status: 'optional' })).not.toThrow();
    expect(() => createTestZman({ display_status: 'hidden' })).not.toThrow();
  });

  it('[P2] should accept valid rounding_mode values', () => {
    // GIVEN/WHEN/THEN: Each valid rounding mode should work
    expect(() => createTestZman({ rounding_mode: 'floor' })).not.toThrow();
    expect(() => createTestZman({ rounding_mode: 'math' })).not.toThrow();
    expect(() => createTestZman({ rounding_mode: 'ceil' })).not.toThrow();
  });
});
