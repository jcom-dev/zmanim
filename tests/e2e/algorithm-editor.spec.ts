import { test, expect } from '@playwright/test';
import { BASE_URL, TIMEOUTS } from './helpers/mcp-playwright';
import { loginAsPublisher } from './utils';

/**
 * Algorithm Editor E2E Tests
 *
 * Tests the algorithm editor page which allows publishers to:
 * - View and configure their zmanim calculations
 * - Edit individual zman formulas
 * - Preview calculated times
 * - View week preview
 * - Export/import snapshots
 *
 * NOTE: The original AC1-AC8 from Story 1.8 are now obsolete.
 * The UI was completely redesigned with:
 * - No template selector (replaced by onboarding wizard)
 * - No modal editor (replaced by dedicated edit page)
 * - Always-on live preview sidebar
 * - Tag-based filtering instead of hardcoded categories
 */

// Enable parallel execution (Story 5.14)
test.describe.configure({ mode: 'parallel' });

test.describe('Algorithm Editor', () => {
  test.describe('Authentication & Access', () => {
    test('should require authentication and redirect to sign-in', async ({ page }) => {
      await page.goto(`${BASE_URL}/publisher/algorithm`);

      // Should be redirected to sign-in
      await page.waitForURL(/sign-in/, { timeout: TIMEOUTS.MEDIUM });

      expect(page.url()).toContain('sign-in');
      expect(page.url()).toContain('redirect_url');
    });
  });

  test.describe('Algorithm Page Display', () => {
    test('should display algorithm editor page with zmanim list', async ({ page }) => {
      await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');
      await page.goto(`${BASE_URL}/publisher/algorithm`);
      await page.waitForLoadState('networkidle');

      // Should show page heading
      await expect(page.getByRole('heading', { name: 'Algorithm Editor' })).toBeVisible();

      // Should show description
      await expect(page.getByText('Configure your zmanim calculation formulas')).toBeVisible();
    });

    test('should display everyday/events tabs', async ({ page }) => {
      await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');
      await page.goto(`${BASE_URL}/publisher/algorithm`);
      await page.waitForLoadState('networkidle');

      // Should show tabs
      await expect(page.getByRole('tab', { name: /Everyday/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Events/i })).toBeVisible();
    });

    test('should show search and filter controls', async ({ page }) => {
      await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');
      await page.goto(`${BASE_URL}/publisher/algorithm`);
      await page.waitForLoadState('networkidle');

      // Should show search input
      await expect(page.getByPlaceholder(/Search by name or key/i)).toBeVisible();

      // Should show filter tabs
      await expect(page.getByRole('tab', { name: /All/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Published/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Draft/i })).toBeVisible();
    });

    test('should show action buttons', async ({ page }) => {
      await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');
      await page.goto(`${BASE_URL}/publisher/algorithm`);
      await page.waitForLoadState('networkidle');

      // Should show restart wizard button
      await expect(page.getByRole('button', { name: /Restart Wizard/i })).toBeVisible();

      // Should show export button
      await expect(page.getByRole('button', { name: /Export/i })).toBeVisible();

      // Should show version history button
      await expect(page.getByRole('button', { name: /Version History/i })).toBeVisible();

      // Should show view week button
      await expect(page.getByRole('button', { name: /View Week/i })).toBeVisible();
    });
  });

  test.describe('Live Preview', () => {
    test('should display live preview sidebar on desktop', async ({ page }) => {
      // Set viewport to desktop size
      await page.setViewportSize({ width: 1280, height: 720 });

      await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');
      await page.goto(`${BASE_URL}/publisher/algorithm`);
      await page.waitForLoadState('networkidle');

      // Live preview should be visible in sidebar (hidden on mobile via lg:block)
      // Use first() to handle multiple matches
      await expect(page.getByText('Live Preview').first()).toBeVisible();
    });
  });

  test.describe('Week View', () => {
    test('should open week preview dialog', async ({ page }) => {
      await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');
      await page.goto(`${BASE_URL}/publisher/algorithm`);
      await page.waitForLoadState('networkidle');

      // Click view week button
      await page.getByRole('button', { name: /View Week/i }).click();

      // Dialog should open with week preview title
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Week Preview' })).toBeVisible();
    });
  });

  test.describe('Export/Import', () => {
    test('should show export dropdown menu', async ({ page }) => {
      await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');
      await page.goto(`${BASE_URL}/publisher/algorithm`);
      await page.waitForLoadState('networkidle');

      // Click export button to open dropdown
      await page.getByRole('button', { name: /Export/i }).click();

      // Should show export options
      await expect(page.getByText('Export to JSON')).toBeVisible();
      await expect(page.getByText('Import from JSON')).toBeVisible();
      await expect(page.getByText('Export Full Year')).toBeVisible();
      await expect(page.getByText('Generate PDF Report')).toBeVisible();
    });
  });
});
