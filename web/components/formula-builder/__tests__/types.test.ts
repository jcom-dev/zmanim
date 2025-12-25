/**
 * @file types.test.ts
 * @purpose Unit tests for FormulaBuilder types, generateFormula, and parseFormula
 * @priority P1 - Core DSL parsing and generation logic
 *
 * Tests cover:
 * - generateFormula for all method types
 * - parseFormula for all formula patterns
 * - Edge cases and error handling
 * - Complexity detection
 */

import { describe, it, expect } from 'vitest';
import {
  generateFormula,
  parseFormula,
  initialState,
  type FormulaBuilderState,
  type SolarDirection,
  type ShaosBase,
} from '../types';

// =============================================================================
// Test Utilities
// =============================================================================

function createState(overrides: Partial<FormulaBuilderState> = {}): FormulaBuilderState {
  return {
    ...initialState,
    ...overrides,
  };
}

// =============================================================================
// generateFormula Tests
// =============================================================================

describe('generateFormula', () => {
  describe('no method selected', () => {
    it('[P1] should return baseTime when method is null', () => {
      // GIVEN: State with no method selected
      const state = createState({
        method: null,
        baseTime: 'visible_sunrise',
      });

      // WHEN: Generating formula
      const formula = generateFormula(state);

      // THEN: Should return base time
      expect(formula).toBe('visible_sunrise');
    });

    it('[P1] should return custom baseTime', () => {
      // GIVEN: State with custom baseTime
      const state = createState({
        method: null,
        baseTime: 'solar_noon',
      });

      // WHEN: Generating formula
      const formula = generateFormula(state);

      // THEN: Should return custom base time
      expect(formula).toBe('solar_noon');
    });
  });

  describe('solar method', () => {
    it('[P1] should generate solar formula with degrees and direction', () => {
      // GIVEN: Solar method state
      const state = createState({
        method: 'solar',
        solarDegrees: 16.1,
        solarDirection: 'before_visible_sunrise',
      });

      // WHEN: Generating formula
      const formula = generateFormula(state);

      // THEN: Should generate solar formula
      expect(formula).toBe('solar(16.1, before_visible_sunrise)');
    });

    it('[P1] should handle different solar directions', () => {
      const directions: SolarDirection[] = [
        'before_visible_sunrise',
        'after_visible_sunset',
        'before_noon',
        'after_noon',
      ];

      directions.forEach((direction) => {
        const state = createState({
          method: 'solar',
          solarDegrees: 18,
          solarDirection: direction,
        });

        const formula = generateFormula(state);
        expect(formula).toBe(`solar(18, ${direction})`);
      });
    });

    it('[P2] should handle decimal degrees', () => {
      // GIVEN: Decimal degrees
      const state = createState({
        method: 'solar',
        solarDegrees: 19.8,
        solarDirection: 'before_visible_sunrise',
      });

      // WHEN: Generating formula
      const formula = generateFormula(state);

      // THEN: Should preserve decimal
      expect(formula).toBe('solar(19.8, before_visible_sunrise)');
    });
  });

  describe('fixed offset method', () => {
    it('[P1] should generate before offset formula', () => {
      // GIVEN: Fixed offset before
      const state = createState({
        method: 'fixed',
        offsetBase: 'visible_sunrise',
        offsetDirection: 'before',
        offsetMinutes: 72,
      });

      // WHEN: Generating formula
      const formula = generateFormula(state);

      // THEN: Should generate subtraction formula
      expect(formula).toBe('visible_sunrise - 72min');
    });

    it('[P1] should generate after offset formula', () => {
      // GIVEN: Fixed offset after
      const state = createState({
        method: 'fixed',
        offsetBase: 'visible_sunset',
        offsetDirection: 'after',
        offsetMinutes: 18,
      });

      // WHEN: Generating formula
      const formula = generateFormula(state);

      // THEN: Should generate addition formula
      expect(formula).toBe('visible_sunset + 18min');
    });

    it('[P2] should handle different base times', () => {
      const bases = ['alos_hashachar', 'solar_noon', 'tzeis_hakochavim'];

      bases.forEach((base) => {
        const state = createState({
          method: 'fixed',
          offsetBase: base,
          offsetDirection: 'after',
          offsetMinutes: 30,
        });

        const formula = generateFormula(state);
        expect(formula).toBe(`${base} + 30min`);
      });
    });
  });

  describe('proportional hours method', () => {
    it('[P1] should generate proportional_hours with GRA base', () => {
      // GIVEN: Proportional hours with GRA
      const state = createState({
        method: 'proportional',
        shaosHours: 3,
        shaosBase: 'gra',
      });

      // WHEN: Generating formula
      const formula = generateFormula(state);

      // THEN: Should generate proportional formula
      expect(formula).toBe('proportional_hours(3, gra)');
    });

    it('[P1] should generate proportional_hours with MGA base', () => {
      // GIVEN: Proportional hours with MGA
      const state = createState({
        method: 'proportional',
        shaosHours: 4,
        shaosBase: 'mga',
      });

      // WHEN: Generating formula
      const formula = generateFormula(state);

      expect(formula).toBe('proportional_hours(4, mga)');
    });

    it('[P1] should generate proportional_hours with custom base', () => {
      // GIVEN: Custom proportional hours
      const state = createState({
        method: 'proportional',
        shaosHours: 9.5,
        shaosBase: 'custom',
        customStart: 'alos_hashachar',
        customEnd: 'tzeis_hakochavim',
      });

      // WHEN: Generating formula
      const formula = generateFormula(state);

      // THEN: Should generate custom formula
      expect(formula).toBe(
        'proportional_hours(9.5, custom(@alos_hashachar, @tzeis_hakochavim))'
      );
    });

    it('[P2] should handle all standard bases', () => {
      const bases: ShaosBase[] = ['gra', 'mga', 'mga_90', 'baal_hatanya'];

      bases.forEach((base) => {
        const state = createState({
          method: 'proportional',
          shaosHours: 6,
          shaosBase: base,
        });

        const formula = generateFormula(state);
        expect(formula).toBe(`proportional_hours(6, ${base})`);
      });
    });

    it('[P2] should handle fractional hours', () => {
      // GIVEN: Fractional hours
      const state = createState({
        method: 'proportional',
        shaosHours: 10.75,
        shaosBase: 'gra',
      });

      // WHEN: Generating formula
      const formula = generateFormula(state);

      expect(formula).toBe('proportional_hours(10.75, gra)');
    });

    it('[P3] should fallback to base without custom when custom fields missing', () => {
      // GIVEN: Custom base but missing custom fields
      const state = createState({
        method: 'proportional',
        shaosHours: 3,
        shaosBase: 'custom',
        customStart: undefined,
        customEnd: undefined,
      });

      // WHEN: Generating formula
      const formula = generateFormula(state);

      // THEN: Should generate without custom (backend may reject, but we test current behavior)
      expect(formula).toBe('proportional_hours(3, custom)');
    });
  });

  describe('fixed zman method', () => {
    it('[P1] should return selected fixed zman', () => {
      // GIVEN: Fixed zman selected
      const state = createState({
        method: 'fixed_zman',
        selectedFixedZman: 'visible_sunrise',
      });

      // WHEN: Generating formula
      const formula = generateFormula(state);

      // THEN: Should return the zman
      expect(formula).toBe('visible_sunrise');
    });

    it('[P1] should handle different fixed zmanim', () => {
      const zmanim = ['visible_sunrise', 'visible_sunset', 'solar_noon', 'solar_midnight'];

      zmanim.forEach((zman) => {
        const state = createState({
          method: 'fixed_zman',
          selectedFixedZman: zman,
        });

        const formula = generateFormula(state);
        expect(formula).toBe(zman);
      });
    });
  });
});

// =============================================================================
// parseFormula Tests
// =============================================================================

describe('parseFormula', () => {
  describe('empty/invalid input', () => {
    it('[P1] should return error for empty formula', () => {
      const result = parseFormula('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty formula');
    });

    it('[P1] should return error for whitespace-only formula', () => {
      const result = parseFormula('   \n\t  ');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty formula');
    });
  });

  describe('solar formulas', () => {
    it('[P1] should parse solar formula with before_visible_sunrise', () => {
      const result = parseFormula('solar(16.1, before_visible_sunrise)');

      expect(result.success).toBe(true);
      expect(result.state?.method).toBe('solar');
      expect(result.state?.solarDegrees).toBe(16.1);
      expect(result.state?.solarDirection).toBe('before_visible_sunrise');
    });

    it('[P1] should parse solar formula with after_visible_sunset', () => {
      const result = parseFormula('solar(18, after_visible_sunset)');

      expect(result.success).toBe(true);
      expect(result.state?.method).toBe('solar');
      expect(result.state?.solarDegrees).toBe(18);
      expect(result.state?.solarDirection).toBe('after_visible_sunset');
    });

    it('[P1] should parse solar formula with before_noon', () => {
      const result = parseFormula('solar(6, before_noon)');

      expect(result.success).toBe(true);
      expect(result.state?.solarDirection).toBe('before_noon');
    });

    it('[P1] should parse solar formula with after_noon', () => {
      const result = parseFormula('solar(6, after_noon)');

      expect(result.success).toBe(true);
      expect(result.state?.solarDirection).toBe('after_noon');
    });

    it('[P2] should handle whitespace in solar formula', () => {
      const result = parseFormula('solar( 19.8 , before_visible_sunrise )');

      expect(result.success).toBe(true);
      expect(result.state?.solarDegrees).toBe(19.8);
    });

    it('[P2] should parse decimal degrees', () => {
      const result = parseFormula('solar(16.5, before_visible_sunrise)');

      expect(result.success).toBe(true);
      expect(result.state?.solarDegrees).toBe(16.5);
    });
  });

  describe('proportional hours formulas', () => {
    it('[P1] should parse proportional_hours with gra', () => {
      const result = parseFormula('proportional_hours(3, gra)');

      expect(result.success).toBe(true);
      expect(result.state?.method).toBe('proportional');
      expect(result.state?.shaosHours).toBe(3);
      expect(result.state?.shaosBase).toBe('gra');
    });

    it('[P1] should parse proportional_hours with mga', () => {
      const result = parseFormula('proportional_hours(4, mga)');

      expect(result.success).toBe(true);
      expect(result.state?.shaosBase).toBe('mga');
    });

    it('[P1] should parse proportional_hours with mga_90', () => {
      const result = parseFormula('proportional_hours(9, mga_90)');

      expect(result.success).toBe(true);
      expect(result.state?.shaosBase).toBe('mga_90');
    });

    it('[P1] should parse proportional_hours with baal_hatanya', () => {
      const result = parseFormula('proportional_hours(10, baal_hatanya)');

      expect(result.success).toBe(true);
      expect(result.state?.shaosBase).toBe('baal_hatanya');
    });

    it('[P1] should parse proportional_hours with custom base', () => {
      const result = parseFormula(
        'proportional_hours(9.5, custom(@alos_hashachar, @tzeis_hakochavim))'
      );

      expect(result.success).toBe(true);
      expect(result.state?.method).toBe('proportional');
      expect(result.state?.shaosHours).toBe(9.5);
      expect(result.state?.shaosBase).toBe('custom');
      expect(result.state?.customStart).toBe('alos_hashachar');
      expect(result.state?.customEnd).toBe('tzeis_hakochavim');
    });

    it('[P2] should handle fractional hours', () => {
      const result = parseFormula('proportional_hours(10.75, gra)');

      expect(result.success).toBe(true);
      expect(result.state?.shaosHours).toBe(10.75);
    });

    it('[P2] should reject advanced MGA variants', () => {
      const advancedVariants = [
        'mga_60', 'mga_72', 'mga_96', 'mga_120',
        'mga_72_zmanis', 'mga_90_zmanis', 'mga_96_zmanis',
        'mga_16_1', 'mga_18', 'mga_19_8', 'mga_26',
      ];

      advancedVariants.forEach((variant) => {
        const result = parseFormula(`proportional_hours(3, ${variant})`);

        expect(result.success).toBe(false);
        expect(result.complexityReason).toBe('unknown_syntax');
      });
    });

    it('[P2] should reject proportional_minutes', () => {
      const result = parseFormula('proportional_minutes(45, gra)');

      expect(result.success).toBe(false);
      expect(result.complexityReason).toBe('unknown_function');
      expect(result.error).toContain('proportional_minutes');
    });
  });

  describe('fixed offset formulas', () => {
    it('[P1] should parse subtraction offset', () => {
      const result = parseFormula('visible_sunrise - 72min');

      expect(result.success).toBe(true);
      expect(result.state?.method).toBe('fixed');
      expect(result.state?.offsetBase).toBe('visible_sunrise');
      expect(result.state?.offsetDirection).toBe('before');
      expect(result.state?.offsetMinutes).toBe(72);
    });

    it('[P1] should parse addition offset', () => {
      const result = parseFormula('visible_sunset + 18min');

      expect(result.success).toBe(true);
      expect(result.state?.method).toBe('fixed');
      expect(result.state?.offsetBase).toBe('visible_sunset');
      expect(result.state?.offsetDirection).toBe('after');
      expect(result.state?.offsetMinutes).toBe(18);
    });

    it('[P1] should parse offset with @ prefix', () => {
      const result = parseFormula('@alos_hashachar + 30min');

      expect(result.success).toBe(true);
      expect(result.state?.method).toBe('fixed');
      expect(result.state?.offsetBase).toBe('alos_hashachar');
      expect(result.state?.offsetDirection).toBe('after');
      expect(result.state?.offsetMinutes).toBe(30);
    });

    it('[P2] should handle whitespace in offset formula', () => {
      const result = parseFormula('sunrise   -   40min');

      expect(result.success).toBe(true);
      expect(result.state?.offsetMinutes).toBe(40);
    });

    it('[P2] should handle various base times', () => {
      const bases = ['sunrise', 'sunset', 'solar_noon', 'tzeis_hakochavim'];

      bases.forEach((base) => {
        const result = parseFormula(`${base} - 30min`);

        expect(result.success).toBe(true);
        expect(result.state?.offsetBase).toBe(base);
      });
    });
  });

  describe('fixed zman formulas', () => {
    it('[P1] should parse visible_sunrise', () => {
      const result = parseFormula('visible_sunrise');

      expect(result.success).toBe(true);
      expect(result.state?.method).toBe('fixed_zman');
      expect(result.state?.selectedFixedZman).toBe('visible_sunrise');
    });

    it('[P1] should parse visible_sunset', () => {
      const result = parseFormula('visible_sunset');

      expect(result.success).toBe(true);
      expect(result.state?.selectedFixedZman).toBe('visible_sunset');
    });

    it('[P1] should parse solar_noon', () => {
      const result = parseFormula('solar_noon');

      expect(result.success).toBe(true);
      expect(result.state?.selectedFixedZman).toBe('solar_noon');
    });

    it('[P1] should parse solar_midnight', () => {
      const result = parseFormula('solar_midnight');

      expect(result.success).toBe(true);
      expect(result.state?.selectedFixedZman).toBe('solar_midnight');
    });

    it('[P1] should parse @reference style zman', () => {
      const result = parseFormula('@custom_zman');

      expect(result.success).toBe(true);
      expect(result.state?.method).toBe('fixed_zman');
      expect(result.state?.selectedFixedZman).toBe('custom_zman');
    });

    it('[P2] should parse all known primitives', () => {
      const primitives = [
        'geometric_sunrise', 'geometric_sunset',
        'civil_dawn', 'civil_dusk',
        'nautical_dawn', 'nautical_dusk',
        'astronomical_dawn', 'astronomical_dusk',
        'midnight',
      ];

      primitives.forEach((primitive) => {
        const result = parseFormula(primitive);

        expect(result.success).toBe(true);
        expect(result.state?.method).toBe('fixed_zman');
      });
    });
  });

  describe('complexity detection', () => {
    it('[P1] should detect conditional formulas', () => {
      const result = parseFormula('if(is_friday, sunset - 40min, sunset - 18min)');

      expect(result.success).toBe(false);
      expect(result.complexityReason).toBe('conditional');
    });

    it('[P1] should detect else keyword', () => {
      const result = parseFormula('sunrise else sunset');

      expect(result.success).toBe(false);
      expect(result.complexityReason).toBe('conditional');
    });

    it('[P1] should detect midpoint formulas', () => {
      const result = parseFormula('midpoint(sunrise, sunset)');

      expect(result.success).toBe(false);
      expect(result.complexityReason).toBe('midpoint');
    });

    it('[P1] should detect chained operations', () => {
      const result = parseFormula('sunrise + 30min - 10min');

      expect(result.success).toBe(false);
      expect(result.complexityReason).toBe('chained_operations');
    });

    it('[P2] should detect unknown functions', () => {
      const result = parseFormula('custom_function(arg1, arg2)');

      expect(result.success).toBe(false);
      expect(result.complexityReason).toBe('unknown_function');
    });

    it('[P2] should provide complexity details', () => {
      const result = parseFormula('if(condition, a, b)');

      expect(result.complexityDetails).toBeDefined();
      expect(result.complexityDetails).toContain('conditional');
    });
  });

  describe('roundtrip tests', () => {
    it('[P1] should roundtrip solar formula', () => {
      const original = 'solar(16.1, before_visible_sunrise)';
      const parsed = parseFormula(original);

      expect(parsed.success).toBe(true);

      const state = createState(parsed.state);
      const generated = generateFormula(state);

      expect(generated).toBe(original);
    });

    it('[P1] should roundtrip fixed offset formula', () => {
      const original = 'visible_sunrise - 72min';
      const parsed = parseFormula(original);

      expect(parsed.success).toBe(true);

      const state = createState(parsed.state);
      const generated = generateFormula(state);

      expect(generated).toBe(original);
    });

    it('[P1] should roundtrip proportional hours formula', () => {
      const original = 'proportional_hours(3, gra)';
      const parsed = parseFormula(original);

      expect(parsed.success).toBe(true);

      const state = createState(parsed.state);
      const generated = generateFormula(state);

      expect(generated).toBe(original);
    });

    it('[P1] should roundtrip fixed zman', () => {
      const original = 'visible_sunrise';
      const parsed = parseFormula(original);

      expect(parsed.success).toBe(true);

      const state = createState(parsed.state);
      const generated = generateFormula(state);

      expect(generated).toBe(original);
    });

    it('[P2] should roundtrip custom proportional hours', () => {
      const original = 'proportional_hours(9.5, custom(@alos_hashachar, @tzeis_hakochavim))';
      const parsed = parseFormula(original);

      expect(parsed.success).toBe(true);

      const state = createState(parsed.state);
      const generated = generateFormula(state);

      expect(generated).toBe(original);
    });
  });
});

// =============================================================================
// initialState Tests
// =============================================================================

describe('initialState', () => {
  it('[P1] should have valid default values', () => {
    expect(initialState.method).toBeNull();
    expect(initialState.baseTime).toBe('visible_sunrise');
    expect(initialState.selectedFixedZman).toBe('visible_sunrise');
    expect(initialState.solarDegrees).toBe(16.1);
    expect(initialState.solarDirection).toBe('before_visible_sunrise');
    expect(initialState.offsetMinutes).toBe(72);
    expect(initialState.offsetDirection).toBe('before');
    expect(initialState.offsetBase).toBe('visible_sunrise');
    expect(initialState.shaosHours).toBe(3);
    expect(initialState.shaosBase).toBe('gra');
    expect(initialState.isValid).toBe(true);
    expect(initialState.validationErrors).toEqual([]);
  });

  it('[P2] should generate valid formula from initial state', () => {
    const formula = generateFormula(initialState);

    expect(formula).toBe('visible_sunrise');
  });
});
