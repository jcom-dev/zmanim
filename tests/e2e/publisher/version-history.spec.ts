/**
 * E2E Tests: Publisher Algorithm Version History
 *
 * Tests for algorithm version history functionality:
 * - Creating version snapshots
 * - Viewing version history list
 * - Viewing version details
 * - Comparing versions (diff)
 * - Rolling back to previous versions
 *
 * Story: 8.1 - Wire Algorithm Version History Routes
 */

import { test, expect } from '@playwright/test';
import {
  loginAsPublisher,
} from '../utils';
import { getSharedPublisher } from '../utils/shared-fixtures';
import { publisherApiUrl } from '../utils/api-helpers';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Publisher Algorithm Version History', () => {
  const testPublisher = getSharedPublisher('with-algorithm-1');

  test('can retrieve version history list', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    // Navigate to algorithm page first to establish auth session
    await page.goto(`http://localhost:3001/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    // Wait for authentication to be ready
    await page.waitForTimeout(1000);

    // Call GET /api/v1/auth/publisher/algorithm/history
    // Use page.request to inherit authenticated session
    const response = await page.request.get(publisherApiUrl('algorithm/history'), {
      headers: {
        'X-Publisher-Id': String(testPublisher.id),
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Should have version history structure
    expect(data).toHaveProperty('versions');
    expect(Array.isArray(data.versions)).toBe(true);
    expect(data).toHaveProperty('current_version');
    expect(data).toHaveProperty('total');
  });

  test('can create version snapshot', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    // Navigate to algorithm page first to establish auth session
    await page.goto(`http://localhost:3001/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    // Create a snapshot
    const response = await page.request.post(publisherApiUrl('algorithm/snapshot'), {
      headers: {
        'X-Publisher-Id': String(testPublisher.id),
        'Content-Type': 'application/json',
      },
      data: {
        config: { name: 'Test Version Snapshot' },
        status: 'draft',
        description: 'E2E test version snapshot',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('version_id');
    expect(data).toHaveProperty('version_number');
    expect(data).toHaveProperty('status');
    expect(data.status).toBe('draft');
  });

  test('can retrieve version detail', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    // Navigate to algorithm page first to establish auth session
    await page.goto(`http://localhost:3001/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    // First create a snapshot to ensure we have at least one version
    await page.request.post(publisherApiUrl('algorithm/snapshot'), {
      headers: {
        'X-Publisher-Id': String(testPublisher.id),
        'Content-Type': 'application/json',
      },
      data: {
        config: { name: 'Test Detail Version' },
        status: 'draft',
        description: 'Test version for detail retrieval',
      },
    });

    // Get version history to find a version number
    const historyResponse = await page.request.get(publisherApiUrl('algorithm/history'), {
      headers: {
        'X-Publisher-Id': String(testPublisher.id),
      },
    });

    const historyData = await historyResponse.json();

    if (historyData.versions && historyData.versions.length > 0) {
      const versionNumber = historyData.versions[0].version_number;

      // Get version detail
      const detailResponse = await page.request.get(publisherApiUrl(`algorithm/history/${versionNumber}`), {
        headers: {
          'X-Publisher-Id': String(testPublisher.id),
        },
      });

      expect(detailResponse.ok()).toBeTruthy();
      const detailData = await detailResponse.json();

      expect(detailData).toHaveProperty('id');
      expect(detailData).toHaveProperty('version_number');
      expect(detailData).toHaveProperty('status');
      expect(detailData).toHaveProperty('config');
      expect(detailData).toHaveProperty('created_at');
    }
  });

  test('can compare versions (diff)', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    // Navigate to algorithm page first to establish auth session
    await page.goto(`http://localhost:3001/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    // Create two versions
    await page.request.post(publisherApiUrl('algorithm/snapshot'), {
      headers: {
        'X-Publisher-Id': String(testPublisher.id),
        'Content-Type': 'application/json',
      },
      data: {
        config: { name: 'Version 1 for Diff' },
        status: 'draft',
        description: 'First version',
      },
    });

    await page.request.post(publisherApiUrl('algorithm/snapshot'), {
      headers: {
        'X-Publisher-Id': String(testPublisher.id),
        'Content-Type': 'application/json',
      },
      data: {
        config: { name: 'Version 2 for Diff' },
        status: 'draft',
        description: 'Second version',
      },
    });

    // Get version history
    const historyResponse = await page.request.get(publisherApiUrl('algorithm/history'), {
      headers: {
        'X-Publisher-Id': String(testPublisher.id),
      },
    });

    const historyData = await historyResponse.json();

    if (historyData.versions && historyData.versions.length >= 2) {
      const v1 = historyData.versions[0].version_number;
      const v2 = historyData.versions[1].version_number;

      // Get diff
      const diffResponse = await page.request.get(publisherApiUrl(`algorithm/diff?v1=${v1}&v2=${v2}`), {
        headers: {
          'X-Publisher-Id': String(testPublisher.id),
        },
      });

      expect(diffResponse.ok()).toBeTruthy();
      const diffData = await diffResponse.json();

      expect(diffData).toHaveProperty('v1');
      expect(diffData).toHaveProperty('v2');
      expect(diffData).toHaveProperty('diff');
    }
  });

  test('can rollback to previous version', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    // Navigate to algorithm page first to establish auth session
    await page.goto(`http://localhost:3001/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    // Create a version to rollback to
    await page.request.post(publisherApiUrl('algorithm/snapshot'), {
      headers: {
        'X-Publisher-Id': String(testPublisher.id),
        'Content-Type': 'application/json',
      },
      data: {
        config: { name: 'Version for Rollback' },
        status: 'draft',
        description: 'Version to rollback to',
      },
    });

    // Get version history
    const historyResponse = await page.request.get(publisherApiUrl('algorithm/history'), {
      headers: {
        'X-Publisher-Id': String(testPublisher.id),
      },
    });

    const historyData = await historyResponse.json();

    if (historyData.versions && historyData.versions.length > 0) {
      const targetVersion = historyData.versions[0].version_number;

      // Perform rollback
      const rollbackResponse = await page.request.post(publisherApiUrl('algorithm/rollback'), {
        headers: {
          'X-Publisher-Id': String(testPublisher.id),
          'Content-Type': 'application/json',
        },
        data: {
          target_version: targetVersion,
          status: 'draft',
          description: 'E2E test rollback',
        },
      });

      expect(rollbackResponse.ok()).toBeTruthy();
      const rollbackData = await rollbackResponse.json();

      expect(rollbackData).toHaveProperty('new_version');
      expect(rollbackData).toHaveProperty('new_version_id');
      expect(rollbackData).toHaveProperty('message');
      expect(rollbackData.message).toContain('Successfully rolled back');
    }
  });

  test('full version history workflow', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    // Navigate to algorithm page first to establish auth session
    await page.goto(`http://localhost:3001/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    const headers = {
      'X-Publisher-Id': String(testPublisher.id),
      'Content-Type': 'application/json',
    };

    // Step 1: Create initial version
    const v1Response = await page.request.post(publisherApiUrl('algorithm/snapshot'), {
      headers,
      data: {
        config: { name: 'Initial Config', zmanim: [] },
        status: 'draft',
        description: 'Initial version',
      },
    });
    expect(v1Response.ok()).toBeTruthy();

    // Step 2: Create second version with changes
    const v2Response = await page.request.post(publisherApiUrl('algorithm/snapshot'), {
      headers,
      data: {
        config: { name: 'Updated Config', zmanim: [{ key: 'sunrise' }] },
        status: 'draft',
        description: 'Added sunrise',
      },
    });
    expect(v2Response.ok()).toBeTruthy();

    // Step 3: Get version history
    const historyResponse = await page.request.get(publisherApiUrl('algorithm/history'), {
      headers: {
        'X-Publisher-Id': String(testPublisher.id),
      },
    });
    expect(historyResponse.ok()).toBeTruthy();
    const historyData = await historyResponse.json();
    expect(historyData.versions.length).toBeGreaterThanOrEqual(2);

    // Step 4: Compare versions
    const versions = historyData.versions;
    const v1Num = versions[versions.length - 1].version_number;
    const v2Num = versions[versions.length - 2].version_number;

    const diffResponse = await page.request.get(publisherApiUrl(`algorithm/diff?v1=${v1Num}&v2=${v2Num}`), {
      headers: {
        'X-Publisher-Id': String(testPublisher.id),
      },
    });
    expect(diffResponse.ok()).toBeTruthy();
    const diffData = await diffResponse.json();
    expect(diffData).toHaveProperty('diff');

    // Step 5: Rollback to first version
    const rollbackResponse = await page.request.post(publisherApiUrl('algorithm/rollback'), {
      headers,
      data: {
        target_version: v1Num,
        status: 'draft',
        description: 'Rollback to initial',
      },
    });
    expect(rollbackResponse.ok()).toBeTruthy();
    const rollbackData = await rollbackResponse.json();
    expect(rollbackData.new_version).toBeGreaterThan(v2Num);

    // Step 6: Verify rollback created new version
    const finalHistoryResponse = await page.request.get(publisherApiUrl('algorithm/history'), {
      headers: {
        'X-Publisher-Id': String(testPublisher.id),
      },
    });
    expect(finalHistoryResponse.ok()).toBeTruthy();
    const finalHistoryData = await finalHistoryResponse.json();
    expect(finalHistoryData.versions.length).toBeGreaterThan(historyData.versions.length);
  });
});
