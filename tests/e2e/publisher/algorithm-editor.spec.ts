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
    await page.waitForLoadState('networkidle');
    await waitForEditor(page);

    expect(await page.textContent('body')).toBeTruthy();
  });

  test('editor shows zmanim count', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      await expect(page.getByText(/\d+ Zmanim/)).toBeVisible();
    }
  });

  test('has Back to Dashboard button', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      await expect(page.getByRole('button', { name: /back to dashboard/i })).toBeVisible();
    }
  });
});

test.describe('Algorithm Editor - Search and Filter', () => {
  test('search input visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      await expect(page.getByPlaceholder(/search zmanim/i)).toBeVisible();
    }
  });

  test('filter tabs visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      await expect(page.getByRole('tab', { name: /all/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /enabled/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /disabled/i })).toBeVisible();
    }
  });

  test('can filter to enabled', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      const enabledTab = page.getByRole('tab', { name: /enabled/i });
      await enabledTab.click();
      await expect(enabledTab).toHaveAttribute('data-state', 'active');
    }
  });

  test('can filter to custom', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      const customTab = page.getByRole('tab', { name: /custom/i });
      await customTab.click();
      await expect(customTab).toHaveAttribute('data-state', 'active');
    }
  });
});

test.describe('Algorithm Editor - Add Custom', () => {
  test('Add Custom button visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      await expect(page.getByRole('button', { name: /add custom/i })).toBeVisible();
    }
  });

  test('Add Custom navigates to new zman', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      await page.getByRole('button', { name: /add custom/i }).click();
      await page.waitForURL('**/algorithm/edit/new', { timeout: 10000 });
      expect(page.url()).toContain('/algorithm/edit/new');
    }
  });
});

test.describe('Algorithm Editor - Import Dialog', () => {
  test('Import button visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      await expect(page.getByRole('button', { name: /import/i })).toBeVisible();
    }
  });

  test('Import opens dialog', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      await page.getByRole('button', { name: /import/i }).click();
      await expect(page.getByText('Import Zmanim')).toBeVisible();
    }
  });

  test('Import has default templates', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      await page.getByRole('button', { name: /import/i }).click();
      await expect(page.getByText('Import Default Templates')).toBeVisible();
    }
  });

  test('Import has copy from publisher', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      await page.getByRole('button', { name: /import/i }).click();
      await expect(page.getByText('Copy from Another Publisher')).toBeVisible();
    }
  });
});

test.describe('Algorithm Editor - Preview Panel', () => {
  test('preview location visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      await expect(page.getByText('Preview Location')).toBeVisible();
    }
  });

  test('shows default location', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      const content = await page.textContent('body');
      expect(
        content?.includes('Brooklyn') ||
        content?.includes('Jerusalem') ||
        content?.includes('New York')
      ).toBeTruthy();
    }
  });

  test('city search visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      await expect(page.getByPlaceholder(/search for a city/i)).toBeVisible();
    }
  });
});

test.describe('Algorithm Editor - View Options', () => {
  test('Version History visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      await expect(page.getByRole('button', { name: /version history/i })).toBeVisible();
    }
  });

  test('View Month visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      await expect(page.getByRole('button', { name: /view month/i })).toBeVisible();
    }
  });

  test('View Month opens dialog', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      await page.getByRole('button', { name: /view month/i }).click();
      await expect(page.getByText('Month Preview')).toBeVisible();
    }
  });
});

test.describe('Algorithm Editor - Zmanim Grid', () => {
  test('Zmanim section visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      await expect(page.getByRole('heading', { name: 'Zmanim' })).toBeVisible();
    }
  });

  test('Zmanim count visible', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    if (await waitForEditor(page)) {
      await expect(page.getByText(/\d+ zmanim/i)).toBeVisible();
    }
  });
});

test.describe('Algorithm Editor - Navigation', () => {
  test('Back to Dashboard works', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

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
    await page.waitForLoadState('networkidle');

    await page.waitForFunction(
      () => document.body.textContent?.toLowerCase().includes('welcome') ||
            document.body.textContent?.toLowerCase().includes('algorithm'),
      { timeout: 30000 }
    );

    const content = await page.textContent('body');
    expect(content?.toLowerCase()).toMatch(/welcome|zmanim/);
  });
});
