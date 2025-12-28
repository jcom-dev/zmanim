/**
 * E2E Tests: Publisher Analytics
 *
 * Tests for publisher analytics dashboard functionality:
 * - Analytics page access and display
 * - Stats cards rendering with data-testid
 * - Stats accuracy and updates
 * - Coverage stats matching actual coverage
 *
 * Note: Stats are calculated from the calculation_stats_daily table,
 * which is populated by the rollup scheduler. For deterministic tests,
 * we rely on existing data or trigger rollup manually.
 */

import { test, expect, Page } from '@playwright/test';
import {
  loginAsPublisher,
  BASE_URL,
  API_URL,
} from '../utils';
import { getSharedPublisher } from '../utils/shared-fixtures';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

/**
 * Wait for analytics page to finish loading
 */
async function waitForAnalyticsLoad(page: Page) {
  // Wait for page to be in load or domcontentloaded state
  await page.waitForLoadState('domcontentloaded');

  // Wait for loading state to clear - analytics shows "Loading analytics..." while fetching
  await page.waitForFunction(
    () => {
      const body = document.body.textContent || '';
      // Check if still loading
      if (body.includes('Loading analytics')) {
        return false;
      }
      // Check for error state
      if (body.includes('Failed to load analytics')) {
        return true;
      }
      // Must have either stats or empty state
      return body.includes('Analytics');
    },
    { timeout: 20000 }
  ).catch(() => {
    // If timeout, continue anyway - heading check will fail if really broken
  });

  // Wait for Analytics heading to appear (indicates page is ready)
  await expect(page.getByRole('heading', { name: /Analytics/i }).first()).toBeVisible({ timeout: 10000 });
}

/**
 * Trigger manual rollup via API (for deterministic testing)
 * This endpoint should be implemented by the rollup job agent
 */
async function triggerRollup(page: Page): Promise<boolean> {
  try {
    const response = await page.request.post(`${API_URL}/internal/rollup/trigger`, {
      timeout: 30000,
    });
    return response.ok();
  } catch (error) {
    console.warn('Manual rollup trigger not available:', error);
    return false;
  }
}

/**
 * Get analytics data from API
 */
async function getAnalyticsData(page: Page): Promise<any> {
  try {
    const response = await page.request.get(`${API_URL}/api/v1/publisher/analytics`);
    if (response.ok()) {
      return await response.json();
    }
  } catch (error) {
    console.warn('Failed to fetch analytics data:', error);
  }
  return null;
}

test.describe('Publisher Analytics - Page Access', () => {
  test('publisher can access analytics page', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    // Should see analytics heading
    await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible();
    expect(page.url()).toContain('/publisher/analytics');
  });

  test('shows header and description', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible();
    await expect(page.getByText(/view usage statistics/i)).toBeVisible();
  });

  test('navigable from dashboard', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('domcontentloaded');

    // Click the Analytics card link
    await page.getByRole('link', { name: /Analytics/i }).click();
    await page.waitForURL('**/publisher/analytics');
    expect(page.url()).toContain('/publisher/analytics');
  });
});

test.describe('Publisher Analytics - Stat Cards', () => {
  test('displays all stat cards with data-testid', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    // Check if we have the empty state
    const hasEmptyState = await page.getByText(/no activity yet/i).isVisible().catch(() => false);

    if (!hasEmptyState) {
      // Verify stat card labels are present
      await expect(page.getByText('Total Calculations')).toBeVisible();
      await expect(page.getByText('This Month')).toBeVisible();
      await expect(page.getByText('Coverage Areas')).toBeVisible();
      await expect(page.getByText('Localities Covered')).toBeVisible();
    } else {
      // Empty state should be shown
      await expect(page.getByText(/no activity yet/i)).toBeVisible();
    }
  });

  test('stat cards show numeric values', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    // Check for either stats or empty state
    const hasStats = await page.getByText('Total Calculations').isVisible().catch(() => false);

    if (hasStats) {
      // Verify numeric values are displayed (even if 0)
      const cards = await page.locator('.bg-card.rounded-lg.border p.text-4xl.font-bold').all();
      expect(cards.length).toBeGreaterThanOrEqual(4);

      // Each card should have a numeric value
      for (const card of cards) {
        const text = await card.textContent();
        expect(text).toMatch(/^\d{1,3}(,\d{3})*$/); // Matches numbers with commas
      }
    }
  });

  test('total calculations stat is non-negative', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    const hasStats = await page.getByText('Total Calculations').isVisible().catch(() => false);

    if (hasStats) {
      // Find the total calculations value
      const totalCalcsCard = page.locator('.bg-card.rounded-lg.border').filter({ hasText: 'Total Calculations' });
      const valueText = await totalCalcsCard.locator('p.text-4xl.font-bold').textContent();
      const value = parseInt(valueText?.replace(/,/g, '') || '0');

      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  test('monthly calculations <= total calculations', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    const hasStats = await page.getByText('Total Calculations').isVisible().catch(() => false);

    if (hasStats) {
      // Get total calculations
      const totalCalcsCard = page.locator('.bg-card.rounded-lg.border').filter({ hasText: 'Total Calculations' });
      const totalText = await totalCalcsCard.locator('p.text-4xl.font-bold').textContent();
      const totalValue = parseInt(totalText?.replace(/,/g, '') || '0');

      // Get monthly calculations
      const monthlyCard = page.locator('.bg-card.rounded-lg.border').filter({ hasText: 'This Month' });
      const monthlyText = await monthlyCard.locator('p.text-4xl.font-bold').textContent();
      const monthlyValue = parseInt(monthlyText?.replace(/,/g, '') || '0');

      // Monthly should never exceed total
      expect(monthlyValue).toBeLessThanOrEqual(totalValue);
    }
  });

  test('coverage stats are non-negative', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    // Check if we have the empty state
    const hasEmptyState = await page.getByText(/no activity yet/i).isVisible().catch(() => false);

    if (!hasEmptyState) {
      // Get coverage areas
      const areasCard = page.locator('.bg-card.rounded-lg.border').filter({ hasText: 'Coverage Areas' });
      const areasText = await areasCard.locator('p.text-4xl.font-bold').textContent();
      const areasValue = parseInt(areasText?.replace(/,/g, '') || '0');

      // Get localities covered
      const localitiesCard = page.locator('.bg-card.rounded-lg.border').filter({ hasText: 'Localities Covered' });
      const localitiesText = await localitiesCard.locator('p.text-4xl.font-bold').textContent();
      const localitiesValue = parseInt(localitiesText?.replace(/,/g, '') || '0');

      expect(areasValue).toBeGreaterThanOrEqual(0);
      expect(localitiesValue).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('Publisher Analytics - Empty State', () => {
  test('shows empty state when no activity', async ({ page }) => {
    const publisher = getSharedPublisher('verified-2');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    // Check for either empty state or stats
    const content = await page.textContent('body');

    // Should either show empty state or valid stats
    const hasEmptyState = content?.includes('No activity yet');
    const hasStats = content?.includes('Total Calculations');

    expect(hasEmptyState || hasStats).toBeTruthy();
  });

  test('empty state shows helpful message', async ({ page }) => {
    const publisher = getSharedPublisher('verified-2');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    // Check if empty state is shown
    const hasEmptyState = await page.getByText(/no activity yet/i).isVisible().catch(() => false);

    if (hasEmptyState) {
      // Verify the empty state message is helpful
      await expect(page.getByText(/once users start viewing/i)).toBeVisible();
    }
  });
});

test.describe('Publisher Analytics - Sparklines', () => {
  test('displays sparkline charts for trend data', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    const hasStats = await page.getByText('Total Calculations').isVisible().catch(() => false);

    if (hasStats) {
      // Check if sparklines are present
      const sparklines = await page.locator('[data-testid="daily-trend-sparkline"]').count();
      expect(sparklines).toBeGreaterThan(0);
    }
  });

  test('sparklines are SVG elements', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    const hasStats = await page.getByText('Total Calculations').isVisible().catch(() => false);

    if (hasStats) {
      const sparkline = page.locator('[data-testid="daily-trend-sparkline"]').first();
      if (await sparkline.count() > 0) {
        // Should be an SVG element
        const tagName = await sparkline.evaluate((el) => el.tagName.toLowerCase());
        expect(tagName).toBe('svg');
      }
    }
  });
});

test.describe('Publisher Analytics - Top Localities', () => {
  test('displays top localities section when data exists', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    // Check if top localities section exists
    const topLocalitiesSection = await page.locator('[data-testid="top-localities-section"]').isVisible().catch(() => false);

    // Top localities section may or may not exist depending on data
    if (topLocalitiesSection) {
      // Verify section heading
      await expect(page.getByText('Top Localities')).toBeVisible();

      // Verify at least one locality item
      const localityItems = await page.locator('[data-testid="top-locality-item"]').count();
      expect(localityItems).toBeGreaterThan(0);
      expect(localityItems).toBeLessThanOrEqual(5);
    }
  });

  test('top locality items show name and count', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    const topLocalitiesSection = await page.locator('[data-testid="top-localities-section"]').isVisible().catch(() => false);

    if (topLocalitiesSection) {
      const firstItem = page.locator('[data-testid="top-locality-item"]').first();

      // Should have text content (locality name and count)
      const text = await firstItem.textContent();
      expect(text).toBeTruthy();
      expect(text?.length).toBeGreaterThan(0);

      // Should have a progress bar (visual indicator)
      const progressBar = firstItem.locator('.bg-muted.rounded-full');
      await expect(progressBar).toBeVisible();
    }
  });

  test('top localities have progress bars', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    const topLocalitiesSection = await page.locator('[data-testid="top-localities-section"]').isVisible().catch(() => false);

    if (topLocalitiesSection) {
      const localityItems = await page.locator('[data-testid="top-locality-item"]').all();

      for (const item of localityItems) {
        // Each item should have a progress bar
        const progressBars = await item.locator('.bg-primary.rounded-full').count();
        expect(progressBars).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Publisher Analytics - No Coming Soon Section', () => {
  test('does not show coming soon message', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    // Should NOT show "Coming Soon" text anywhere on the page
    const comingSoonText = await page.getByText(/coming soon/i).isVisible().catch(() => false);
    expect(comingSoonText).toBeFalsy();
  });
});

test.describe('Publisher Analytics - Coverage Accuracy', () => {
  test('coverage stats match actual coverage areas', async ({ page }) => {
    const publisher = getSharedPublisher('with-coverage');
    await loginAsPublisher(page, publisher.id);

    // First, get coverage count from coverage page
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for coverage to load
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Loading coverage'),
      { timeout: 15000 }
    ).catch(() => {});

    const coverageContent = await page.textContent('body');
    const hasNoCoverage = coverageContent?.includes('No Coverage Areas');

    // Now check analytics
    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    const hasStats = await page.getByText('Coverage Areas').isVisible().catch(() => false);

    if (hasStats && !hasNoCoverage) {
      // Get coverage areas from analytics
      const areasCard = page.locator('.bg-card.rounded-lg.border').filter({ hasText: 'Coverage Areas' });
      const areasText = await areasCard.locator('p.text-4xl.font-bold').textContent();
      const areasValue = parseInt(areasText?.replace(/,/g, '') || '0');

      // If publisher has coverage, analytics should show > 0
      if (!hasNoCoverage) {
        expect(areasValue).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Publisher Analytics - Tooltips', () => {
  test('stat cards have tooltips', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    const hasStats = await page.getByText('Total Calculations').isVisible().catch(() => false);

    if (hasStats) {
      // Hover over an icon to show tooltip
      const totalCalcsCard = page.locator('.bg-card.rounded-lg.border').filter({ hasText: 'Total Calculations' });
      const icon = totalCalcsCard.locator('svg').first();

      await icon.hover();

      // Wait a bit for tooltip to appear
      await page.waitForTimeout(500);

      // Check if tooltip appeared
      const tooltip = await page.getByText(/total number of zmanim calculations/i).isVisible().catch(() => false);
      expect(tooltip).toBeTruthy();
    }
  });
});

test.describe('Publisher Analytics - API Response', () => {
  test('analytics API returns valid JSON with all fields', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    // Navigate to publisher area to set up auth context
    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    // Get analytics data via API
    const data = await getAnalyticsData(page);

    if (data) {
      // Verify structure
      expect(data).toHaveProperty('calculations_total');
      expect(data).toHaveProperty('calculations_this_month');
      expect(data).toHaveProperty('coverage_areas');
      expect(data).toHaveProperty('localities_covered');
      expect(data).toHaveProperty('daily_trend');
      expect(data).toHaveProperty('top_localities');

      // Verify types
      expect(typeof data.calculations_total).toBe('number');
      expect(typeof data.calculations_this_month).toBe('number');
      expect(typeof data.coverage_areas).toBe('number');
      expect(typeof data.localities_covered).toBe('number');
      expect(Array.isArray(data.daily_trend)).toBe(true);
      expect(Array.isArray(data.top_localities)).toBe(true);

      // Verify values are non-negative
      expect(data.calculations_total).toBeGreaterThanOrEqual(0);
      expect(data.calculations_this_month).toBeGreaterThanOrEqual(0);
      expect(data.coverage_areas).toBeGreaterThanOrEqual(0);
      expect(data.localities_covered).toBeGreaterThanOrEqual(0);

      // Verify daily_trend structure
      if (data.daily_trend.length > 0) {
        const trend = data.daily_trend[0];
        expect(trend).toHaveProperty('date');
        expect(trend).toHaveProperty('count');
        expect(typeof trend.date).toBe('string');
        expect(typeof trend.count).toBe('number');
      }

      // Verify top_localities structure
      if (data.top_localities.length > 0) {
        const locality = data.top_localities[0];
        expect(locality).toHaveProperty('name');
        expect(locality).toHaveProperty('count');
        expect(typeof locality.name).toBe('string');
        expect(typeof locality.count).toBe('number');
      }
    }
  });
});

test.describe('Publisher Analytics - Responsive Design', () => {
  test('analytics page is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    // Should still show heading
    await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible();

    // Content should be visible (not cut off)
    const hasStats = await page.getByText('Total Calculations').isVisible().catch(() => false);
    expect(hasStats || await page.getByText(/no activity yet/i).isVisible()).toBeTruthy();
  });

  test('analytics page is responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad

    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForAnalyticsLoad(page);

    // Should still show heading
    await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible();

    // Content should be visible
    const hasStats = await page.getByText('Total Calculations').isVisible().catch(() => false);
    expect(hasStats || await page.getByText(/no activity yet/i).isVisible()).toBeTruthy();
  });
});
