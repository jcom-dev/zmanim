/**
 * Test Builders - Fluent API for Creating Test Data
 *
 * Provides a builder pattern for creating test entities.
 * Replaces the repeated publisher/algorithm/coverage setup code
 * scattered across 15+ test files.
 *
 * @example
 * ```typescript
 * // Simple publisher
 * const { publisher } = await TestPublisher.create().build();
 *
 * // Full setup with algorithm and coverage
 * const { publisher, algorithm, coverage } = await TestPublisher.create()
 *   .withName('My Test Publisher')
 *   .verified()
 *   .withAlgorithm('GRA')
 *   .withCoverage('Jerusalem')
 *   .build();
 * ```
 */

import { createTestPublisherEntity, createTestAlgorithm, createTestCoverage, getTestCity } from './test-fixtures';
import { AlgorithmConfigs, AlgorithmConfigName, getAlgorithmConfig } from './algorithm-fixtures';

// =============================================================================
// Types
// =============================================================================

export interface TestPublisherData {
  id: string;
  name: string;
  status: string;
  email?: string;
}

export interface TestAlgorithmData {
  id: string;
  publisher_id: string;
  name: string;
  status: string;
  config: object;
}

export interface TestCoverageData {
  id: string;
  publisher_id: string;
  city_id: string;
  city_name?: string;
}

export interface TestPublisherBuildResult {
  publisher: TestPublisherData;
  algorithm?: TestAlgorithmData;
  coverage?: TestCoverageData;
}

// =============================================================================
// TestPublisher Builder
// =============================================================================

/**
 * Builder for creating test publishers with related entities.
 *
 * Uses a fluent API pattern for readable test setup.
 *
 * @example
 * ```typescript
 * // Basic publisher
 * const { publisher } = await TestPublisher.create().build();
 *
 * // Publisher with all customizations
 * const result = await TestPublisher.create()
 *   .withName('Custom Name')
 *   .withEmail('test@example.com')
 *   .verified()
 *   .withAlgorithm('GRA', { status: 'published' })
 *   .withCoverage('Jerusalem')
 *   .build();
 * ```
 */
export class TestPublisher {
  private _name: string;
  private _status: 'pending' | 'verified' | 'suspended' = 'pending';
  private _email?: string;

  private _algorithmConfig?: {
    configName: AlgorithmConfigName;
    options?: { name?: string; status?: string };
  };

  private _coverageCity?: string;

  private constructor() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    this._name = `TEST_E2E_Publisher_${timestamp}_${random}`;
  }

  /**
   * Create a new TestPublisher builder instance.
   */
  static create(): TestPublisher {
    return new TestPublisher();
  }

  /**
   * Set the publisher name.
   */
  withName(name: string): this {
    this._name = name;
    return this;
  }

  /**
   * Set the email address.
   */
  withEmail(email: string): this {
    this._email = email;
    return this;
  }

  /**
   * Set publisher status to verified.
   */
  verified(): this {
    this._status = 'verified';
    return this;
  }

  /**
   * Set publisher status to pending.
   */
  pending(): this {
    this._status = 'pending';
    return this;
  }

  /**
   * Set publisher status to suspended.
   */
  suspended(): this {
    this._status = 'suspended';
    return this;
  }

  /**
   * Set a specific status.
   */
  withStatus(status: 'pending' | 'verified' | 'suspended'): this {
    this._status = status;
    return this;
  }

  /**
   * Add an algorithm to the publisher.
   *
   * @param configName - Predefined algorithm configuration name
   * @param options - Optional overrides for the algorithm
   */
  withAlgorithm(
    configName: AlgorithmConfigName = 'GRA',
    options?: { name?: string; status?: string }
  ): this {
    this._algorithmConfig = { configName, options };
    return this;
  }

  /**
   * Add coverage for a city to the publisher.
   *
   * @param cityName - Name of the city (e.g., 'Jerusalem', 'New York')
   */
  withCoverage(cityName: string): this {
    this._coverageCity = cityName;
    return this;
  }

  /**
   * Build and create the test entities in the database.
   *
   * @returns Object containing the created publisher and optional algorithm/coverage
   */
  async build(): Promise<TestPublisherBuildResult> {
    // Create the publisher
    const publisher = await createTestPublisherEntity({
      name: this._name,
      status: this._status,
      email: this._email,
    });

    const result: TestPublisherBuildResult = { publisher };

    // Create algorithm if requested
    if (this._algorithmConfig) {
      const config = getAlgorithmConfig(
        this._algorithmConfig.configName,
        this._algorithmConfig.options
      );

      result.algorithm = await createTestAlgorithm(publisher.id, {
        ...config,
        status: this._algorithmConfig.options?.status ?? 'published',
      });
    }

    // Create coverage if requested
    if (this._coverageCity) {
      const city = await getTestCity(this._coverageCity);
      if (city) {
        result.coverage = await createTestCoverage(publisher.id, city.id);
        result.coverage.city_name = city.name;
      }
    }

    return result;
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a minimal test publisher quickly.
 *
 * @param status - Publisher status (default: 'pending')
 * @returns Created publisher data
 */
export async function createMinimalPublisher(
  status: 'pending' | 'verified' | 'suspended' = 'pending'
): Promise<TestPublisherData> {
  const { publisher } = await TestPublisher.create().withStatus(status).build();
  return publisher;
}

/**
 * Create a verified test publisher with GRA algorithm.
 *
 * This is the most common test setup pattern.
 *
 * @returns Created publisher with algorithm
 */
export async function createVerifiedPublisherWithAlgorithm(): Promise<{
  publisher: TestPublisherData;
  algorithm: TestAlgorithmData;
}> {
  const { publisher, algorithm } = await TestPublisher.create()
    .verified()
    .withAlgorithm('GRA')
    .build();

  return { publisher, algorithm: algorithm! };
}

/**
 * Create a full test setup with publisher, algorithm, and coverage.
 *
 * @param cityName - City for coverage (default: 'Jerusalem')
 * @returns Created publisher with algorithm and coverage
 */
export async function createFullTestSetup(cityName: string = 'Jerusalem'): Promise<{
  publisher: TestPublisherData;
  algorithm: TestAlgorithmData;
  coverage: TestCoverageData;
}> {
  const { publisher, algorithm, coverage } = await TestPublisher.create()
    .verified()
    .withAlgorithm('GRA', { status: 'published' })
    .withCoverage(cityName)
    .build();

  return {
    publisher,
    algorithm: algorithm!,
    coverage: coverage!,
  };
}

// =============================================================================
// Test Data Generators
// =============================================================================

/**
 * Generate a unique test name with timestamp and random suffix.
 *
 * @param prefix - Prefix for the name
 * @returns Unique test name
 */
export function generateTestName(prefix: string = 'TEST_E2E'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate a test email address.
 *
 * @param prefix - Prefix for the email
 * @returns Unique test email
 */
export function generateTestEmail(prefix: string = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}@test.example.com`;
}

// =============================================================================
// Test Context Builder (for complex scenarios)
// =============================================================================

export interface TestContextData {
  publishers: TestPublisherData[];
  algorithms: TestAlgorithmData[];
  coverages: TestCoverageData[];
}

/**
 * Builder for creating complex test contexts with multiple publishers.
 *
 * @example
 * ```typescript
 * const context = await TestContext.create()
 *   .addPublisher('Publisher A', 'verified', 'GRA')
 *   .addPublisher('Publisher B', 'pending')
 *   .build();
 *
 * console.log(context.publishers.length); // 2
 * console.log(context.algorithms.length); // 1 (only Publisher A has algorithm)
 * ```
 */
export class TestContext {
  private _publisherConfigs: Array<{
    name: string;
    status: 'pending' | 'verified' | 'suspended';
    algorithmConfig?: AlgorithmConfigName;
    coverageCity?: string;
  }> = [];

  private constructor() {}

  static create(): TestContext {
    return new TestContext();
  }

  /**
   * Add a publisher to the test context.
   */
  addPublisher(
    name: string,
    status: 'pending' | 'verified' | 'suspended' = 'pending',
    algorithmConfig?: AlgorithmConfigName,
    coverageCity?: string
  ): this {
    this._publisherConfigs.push({ name, status, algorithmConfig, coverageCity });
    return this;
  }

  /**
   * Build all test entities.
   */
  async build(): Promise<TestContextData> {
    const context: TestContextData = {
      publishers: [],
      algorithms: [],
      coverages: [],
    };

    for (const config of this._publisherConfigs) {
      const builder = TestPublisher.create()
        .withName(config.name)
        .withStatus(config.status);

      if (config.algorithmConfig) {
        builder.withAlgorithm(config.algorithmConfig);
      }

      if (config.coverageCity) {
        builder.withCoverage(config.coverageCity);
      }

      const result = await builder.build();
      context.publishers.push(result.publisher);

      if (result.algorithm) {
        context.algorithms.push(result.algorithm);
      }

      if (result.coverage) {
        context.coverages.push(result.coverage);
      }
    }

    return context;
  }
}

// =============================================================================
// Cleanup Helpers
// =============================================================================

/**
 * Track created test entities for cleanup.
 *
 * Usage:
 * ```typescript
 * const tracker = new TestEntityTracker();
 * const { publisher } = await tracker.track(TestPublisher.create().build());
 *
 * // In afterAll
 * await tracker.cleanup();
 * ```
 */
export class TestEntityTracker {
  private _publisherIds: string[] = [];

  /**
   * Track a publisher for later cleanup.
   */
  track<T extends { publisher: TestPublisherData }>(result: T): T {
    this._publisherIds.push(result.publisher.id);
    return result;
  }

  /**
   * Get all tracked publisher IDs.
   */
  get publisherIds(): string[] {
    return [...this._publisherIds];
  }

  /**
   * Clear tracked entities (call after cleanup).
   */
  clear(): void {
    this._publisherIds = [];
  }
}
