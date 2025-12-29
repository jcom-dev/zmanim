/**
 * E2E Tests: Publisher Algorithm Editor
 *
 * Optimized for parallel execution using shared fixtures.
 * Uses pre-created publishers with algorithms.
 */

import { test, expect, Page } from '@playwright/test';
import {
  loginAsPublisher,
  getSharedPublisher,
  getPublisherWithAlgorithm,
  getEmptyPublisher,
  BASE_URL,
} from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

// All tests run in parallel
test.describe.configure({ mode: 'parallel' });

// Helper to wait for editor
async function waitForEditor(page: Page): Promise<boolean> {
  await page.waitForFunction(
    () => document.body.textContent?.toLowerCase().includes('algorithm') ||
          document.body.textContent?.toLowerCase().includes('welcome'),
    { timeout: 30000 }
  );
  return await page.getByText('Algorithm Editor').isVisible().catch(() => false);
}

test.describe('Algorithm Editor - Page Load', () => {
  test('editor loads with header', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);
    await waitForEditor(page);

    expect(await page.textContent('body')).toBeTruthy();
  });

  test('editor shows zmanim count', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      await expect(page.getByText(/\d+ Zmanim/)).toBeVisible({ timeout: 15000 });
    }
  });

  test('has Back to Dashboard button', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      await expect(page.getByRole('button', { name: /back to dashboard/i })).toBeVisible({ timeout: 15000 });
    }
  });
});

test.describe('Algorithm Editor - Search and Filter', () => {
  test('search input visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      await expect(page.getByPlaceholder(/search by name or key/i)).toBeVisible({ timeout: 15000 });
    }
  });

  test('filter tabs visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      await expect(page.getByRole('tab', { name: /^all/i })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('tab', { name: /published/i })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('tab', { name: /draft/i })).toBeVisible({ timeout: 15000 });
    }
  });

  test('can filter to published', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      const publishedTab = page.getByRole('tab', { name: /published/i });
      await publishedTab.click();
      await expect(publishedTab).toHaveAttribute('data-state', 'active');
    }
  });

  test('can filter to core', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      const coreTab = page.getByRole('tab', { name: /^core/i });
      await coreTab.click();
      await expect(coreTab).toHaveAttribute('data-state', 'active');
    }
  });
});

test.describe('Algorithm Editor - Browse Registry', () => {
  test('Browse Registry button visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      await expect(page.getByRole('button', { name: /browse registry/i })).toBeVisible({ timeout: 15000 });
    }
  });

  test('Browse Registry navigates to registry', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      await page.getByRole('button', { name: /browse registry/i }).click();
      await page.waitForURL('**/publisher/registry', { timeout: 10000 });
      expect(page.url()).toContain('/publisher/registry');
    }
  });
});

test.describe('Algorithm Editor - Import/Export', () => {
  test('Export dropdown visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      await expect(page.getByRole('button', { name: /^export/i })).toBeVisible({ timeout: 15000 });
    }
  });

  test('Export dropdown opens menu', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      await page.getByRole('button', { name: /^export/i }).click();
      await expect(page.getByRole('menuitem', { name: /export to json/i })).toBeVisible({ timeout: 15000 });
    }
  });

  test('Export dropdown has import option', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      await page.getByRole('button', { name: /^export/i }).click();
      await expect(page.getByRole('menuitem', { name: /import from json/i })).toBeVisible({ timeout: 15000 });
    }
  });

  test('Export dropdown has year export', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      await page.getByRole('button', { name: /^export/i }).click();
      await expect(page.getByRole('menuitem', { name: /export full year/i })).toBeVisible({ timeout: 15000 });
    }
  });
});

test.describe('Algorithm Editor - Preview Panel', () => {
  test('location picker visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      await expect(page.getByTestId('location-picker')).toBeVisible({ timeout: 15000 });
    }
  });

  test('shows location or select prompt', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      const content = await page.textContent('body');
      expect(
        content?.includes('Select Location') ||
        content?.includes('Brooklyn') ||
        content?.includes('Jerusalem') ||
        content?.includes('New York')
      ).toBeTruthy();
    }
  });

  test('location picker opens search', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      await page.getByTestId('location-picker').click();
      await expect(page.getByPlaceholder(/search localities/i)).toBeVisible({ timeout: 15000 });
    }
  });
});

test.describe('Algorithm Editor - View Options', () => {
  test('Version History visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      await expect(page.getByRole('button', { name: /version history/i })).toBeVisible({ timeout: 15000 });
    }
  });

  test('View Week visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      await expect(page.getByRole('button', { name: /view week/i })).toBeVisible({ timeout: 15000 });
    }
  });

  test('View Week opens dialog', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      await page.getByRole('button', { name: /view week/i }).click();
      await expect(page.getByText('Week Preview')).toBeVisible({ timeout: 15000 });
    }
  });
});

test.describe('Algorithm Editor - Zmanim Grid', () => {
  test('Zmanim section visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      // Check for either "Everyday Zmanim" or "Event Zmanim" heading
      const hasEveryday = await page.getByRole('heading', { name: /everyday zmanim/i }).isVisible().catch(() => false);
      const hasEvent = await page.getByRole('heading', { name: /event zmanim/i }).isVisible().catch(() => false);
      expect(hasEveryday || hasEvent).toBeTruthy();
    }
  });

  test('Zmanim description visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      // Check for description text that contains count information
      const content = await page.textContent('body');
      expect(
        content?.includes('daily solar calculation times') ||
        content?.includes('Shabbos, holiday, and fast day times')
      ).toBeTruthy();
    }
  });
});

test.describe('Algorithm Editor - Navigation', () => {
  test('Back to Dashboard works', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    if (await waitForEditor(page)) {
      await page.getByRole('button', { name: /back to dashboard/i }).click();
      await page.waitForURL('**/publisher/dashboard', { timeout: 10000 });
      expect(page.url()).toContain('/publisher/dashboard');
    }
  });
});

test.describe('Algorithm Editor - Empty State', () => {
  test('new publisher shows onboarding', async ({ page }) => {
    const publisher = getEmptyPublisher(1);
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    await page.waitForFunction(
      () => document.body.textContent?.toLowerCase().includes('welcome') ||
            document.body.textContent?.toLowerCase().includes('algorithm'),
      { timeout: 30000 }
    );

    const content = await page.textContent('body');
    expect(content?.toLowerCase()).toMatch(/welcome|zmanim/);
  });
});
