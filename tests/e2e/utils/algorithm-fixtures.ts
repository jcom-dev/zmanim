/**
 * Algorithm Configuration Fixtures
 *
 * Centralized algorithm configurations for E2E tests.
 * These replace the duplicated algorithm configs scattered across test files.
 *
 * @example
 * ```typescript
 * import { AlgorithmConfigs, getAlgorithmConfig } from './algorithm-fixtures';
 *
 * // Use a predefined config
 * const algo = await createTestAlgorithm(publisherId, AlgorithmConfigs.GRA);
 *
 * // Get config with overrides
 * const customAlgo = getAlgorithmConfig('GRA', { name: 'Custom GRA' });
 * ```
 */

// =============================================================================
// Types
// =============================================================================

export interface ZmanCalculation {
  method: string;
  params: Record<string, number | string | boolean>;
}

export interface AlgorithmConfig {
  name: string;
  description?: string;
  version?: string;
  zmanim: Record<string, ZmanCalculation>;
}

export interface FullAlgorithmConfig extends AlgorithmConfig {
  is_published?: boolean;
  is_active?: boolean;
}

// =============================================================================
// Standard Algorithm Configurations
// =============================================================================

/**
 * GRA (Vilna Gaon) Algorithm Configuration
 *
 * The most commonly used traditional calculation method.
 * Uses sha'os zmanios (proportional hours) based on sunrise to sunset.
 */
export const GRA_CONFIG: AlgorithmConfig = {
  name: 'GRA (Vilna Gaon)',
  description: 'Traditional GRA calculation method using proportional hours from sunrise to sunset',
  version: '1.0.0',
  zmanim: {
    alos: {
      method: 'solar_angle',
      params: { degrees: 16.1 },
    },
    misheyakir: {
      method: 'solar_angle',
      params: { degrees: 11.5 },
    },
    sunrise: {
      method: 'sunrise',
      params: {},
    },
    sof_zman_shma_gra: {
      method: 'proportional',
      params: { hours: 3, base: 'gra' },
    },
    sof_zman_tefillah_gra: {
      method: 'proportional',
      params: { hours: 4, base: 'gra' },
    },
    chatzos: {
      method: 'midday',
      params: {},
    },
    mincha_gedola: {
      method: 'proportional',
      params: { hours: 6.5, base: 'gra' },
    },
    mincha_ketana: {
      method: 'proportional',
      params: { hours: 9.5, base: 'gra' },
    },
    plag_hamincha: {
      method: 'proportional',
      params: { hours: 10.75, base: 'gra' },
    },
    sunset: {
      method: 'sunset',
      params: {},
    },
    tzeis: {
      method: 'solar_angle',
      params: { degrees: 8.5 },
    },
    tzeis_rt: {
      method: 'fixed_minutes',
      params: { minutes: 72 },
    },
  },
};

/**
 * MGA (Magen Avraham) Algorithm Configuration
 *
 * Uses sha'os zmanios based on alos (72 minutes before sunrise) to tzeis (72 minutes after sunset).
 */
export const MGA_CONFIG: AlgorithmConfig = {
  name: 'MGA (Magen Avraham)',
  description: 'MGA calculation method using 72-minute dawn to 72-minute nightfall',
  version: '1.0.0',
  zmanim: {
    alos: {
      method: 'fixed_minutes',
      params: { minutes: -72, from: 'sunrise' },
    },
    misheyakir: {
      method: 'solar_angle',
      params: { degrees: 11.5 },
    },
    sunrise: {
      method: 'sunrise',
      params: {},
    },
    sof_zman_shma_mga: {
      method: 'proportional',
      params: { hours: 3, base: 'mga' },
    },
    sof_zman_tefillah_mga: {
      method: 'proportional',
      params: { hours: 4, base: 'mga' },
    },
    chatzos: {
      method: 'midday',
      params: {},
    },
    mincha_gedola_mga: {
      method: 'proportional',
      params: { hours: 6.5, base: 'mga' },
    },
    mincha_ketana_mga: {
      method: 'proportional',
      params: { hours: 9.5, base: 'mga' },
    },
    plag_hamincha_mga: {
      method: 'proportional',
      params: { hours: 10.75, base: 'mga' },
    },
    sunset: {
      method: 'sunset',
      params: {},
    },
    tzeis: {
      method: 'fixed_minutes',
      params: { minutes: 72 },
    },
  },
};

/**
 * Minimal Algorithm Configuration
 *
 * Used for fast tests that don't need full zmanim calculation.
 * Only includes the essential times.
 */
export const MINIMAL_CONFIG: AlgorithmConfig = {
  name: 'Minimal Test Algorithm',
  description: 'Minimal configuration for fast tests',
  version: '1.0.0',
  zmanim: {
    sunrise: {
      method: 'sunrise',
      params: {},
    },
    sunset: {
      method: 'sunset',
      params: {},
    },
    chatzos: {
      method: 'midday',
      params: {},
    },
  },
};

/**
 * Empty Algorithm Configuration
 *
 * Used for testing algorithm creation with no zmanim defined.
 */
export const EMPTY_CONFIG: AlgorithmConfig = {
  name: 'Empty Test Algorithm',
  description: 'Empty configuration for edge case testing',
  version: '1.0.0',
  zmanim: {},
};

// =============================================================================
// Exported Configuration Map
// =============================================================================

/**
 * Map of all predefined algorithm configurations.
 *
 * @example
 * ```typescript
 * const config = AlgorithmConfigs.GRA;
 * const mgaConfig = AlgorithmConfigs.MGA;
 * ```
 */
export const AlgorithmConfigs = {
  GRA: GRA_CONFIG,
  MGA: MGA_CONFIG,
  MINIMAL: MINIMAL_CONFIG,
  EMPTY: EMPTY_CONFIG,
} as const;

export type AlgorithmConfigName = keyof typeof AlgorithmConfigs;

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Get an algorithm configuration with optional overrides.
 *
 * @param name - Name of the predefined configuration
 * @param overrides - Optional properties to override
 * @returns Algorithm configuration with overrides applied
 *
 * @example
 * ```typescript
 * // Get GRA config with custom name
 * const config = getAlgorithmConfig('GRA', { name: 'My Custom GRA' });
 *
 * // Get minimal config with additional zmanim
 * const config = getAlgorithmConfig('MINIMAL', {
 *   zmanim: {
 *     ...AlgorithmConfigs.MINIMAL.zmanim,
 *     alos: { method: 'solar_angle', params: { degrees: 16.1 } },
 *   },
 * });
 * ```
 */
export function getAlgorithmConfig(
  name: AlgorithmConfigName,
  overrides?: Partial<AlgorithmConfig>
): AlgorithmConfig {
  const baseConfig = AlgorithmConfigs[name];
  return {
    ...baseConfig,
    ...overrides,
    zmanim: {
      ...baseConfig.zmanim,
      ...(overrides?.zmanim ?? {}),
    },
  };
}

/**
 * Create a full algorithm configuration ready for database insertion.
 *
 * @param name - Name of the predefined configuration
 * @param options - Additional options for the algorithm
 * @returns Full algorithm configuration with database fields
 *
 * @example
 * ```typescript
 * const algo = createFullAlgorithmConfig('GRA', {
 *   name: 'TEST_E2E_Publisher_Algorithm',
 *   is_published: true,
 * });
 * ```
 */
export function createFullAlgorithmConfig(
  name: AlgorithmConfigName,
  options?: {
    name?: string;
    description?: string;
    is_published?: boolean;
    is_active?: boolean;
  }
): FullAlgorithmConfig {
  const baseConfig = AlgorithmConfigs[name];
  return {
    ...baseConfig,
    name: options?.name ?? baseConfig.name,
    description: options?.description ?? baseConfig.description,
    is_published: options?.is_published ?? false,
    is_active: options?.is_active ?? true,
  };
}

// =============================================================================
// Test Data Generators
// =============================================================================

/**
 * Generate a unique algorithm name for tests.
 * Prevents collisions when running tests in parallel.
 */
export function generateTestAlgorithmName(prefix: string = 'TEST_E2E'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_Algorithm_${timestamp}_${random}`;
}

/**
 * Create a test algorithm configuration with unique name.
 *
 * @param configName - Base configuration to use
 * @param prefix - Prefix for the generated name
 * @returns Algorithm config with unique test name
 */
export function createTestAlgorithmConfig(
  configName: AlgorithmConfigName = 'GRA',
  prefix: string = 'TEST_E2E'
): FullAlgorithmConfig {
  return createFullAlgorithmConfig(configName, {
    name: generateTestAlgorithmName(prefix),
    is_published: false,
    is_active: true,
  });
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate that an algorithm configuration has required fields.
 */
export function validateAlgorithmConfig(config: unknown): config is AlgorithmConfig {
  if (!config || typeof config !== 'object') return false;

  const c = config as Record<string, unknown>;
  return (
    typeof c.name === 'string' &&
    c.name.length > 0 &&
    typeof c.zmanim === 'object' &&
    c.zmanim !== null
  );
}

/**
 * Get the list of zman keys from a configuration.
 */
export function getZmanKeys(config: AlgorithmConfig): string[] {
  return Object.keys(config.zmanim);
}

/**
 * Check if a configuration includes a specific zman.
 */
export function hasZman(config: AlgorithmConfig, zmanKey: string): boolean {
  return zmanKey in config.zmanim;
}
