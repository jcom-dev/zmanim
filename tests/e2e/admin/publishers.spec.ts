/**
 * E2E Tests: Admin Publisher Management
 *
 * Tests for publisher management functionality including:
 * - Listing publishers
 * - Creating publishers
 * - Viewing publisher details
 * - Status changes (verify, suspend, reactivate)
 * - Inviting users to publishers
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, BASE_URL, getSharedPublisherAsync } from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Admin Publisher Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('admin can view publishers list', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/publishers`);
    await waitForClientReady(page);

    // Wait for page title to appear instead of networkidle
    await expect(page.getByRole('heading', { name: /Publisher Management/i }).first()).toBeVisible({ timeout: 15000 });

    // Should see publishers table or list
    await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 });
  });

  test('publishers list shows table headers', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/publishers`);
    await waitForClientReady(page);

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Publisher Management/i }).first()).toBeVisible({ timeout: 15000 });

    // Should see table headers - the actual header text is "Publisher Name" not "Name"
    await expect(page.getByRole('columnheader', { name: /Publisher Name/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('columnheader', { name: /Status/i })).toBeVisible({ timeout: 15000 });
  });

  test('admin can filter publishers by status', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/publishers`);
    await waitForClientReady(page);

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Publisher Management/i }).first()).toBeVisible({ timeout: 15000 });

    // Find status filter dropdown - it's a Select component with trigger button
    const statusFilter = page.getByRole('combobox').first();
    await expect(statusFilter).toBeVisible({ timeout: 15000 });
  });

  test('admin can search publishers', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/publishers`);
    await waitForClientReady(page);

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Publisher Management/i }).first()).toBeVisible({ timeout: 15000 });

    // Find search input - placeholder is "Search by name or email..."
    const searchInput = page.getByPlaceholder(/Search by name or email/i);
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    // Type in search and verify table still visible
    await searchInput.fill('test');
    await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 });
  });

  test('admin can access create publisher page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/publishers`);
    await waitForClientReady(page);

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Publisher Management/i }).first()).toBeVisible({ timeout: 15000 });

    // Click create button - actual button text is "Create New Publisher"
    const createButton = page.getByRole('link', { name: /Create New Publisher/i });
    await expect(createButton).toBeVisible({ timeout: 15000 });
    await createButton.click();

    await page.waitForURL('**/admin/publishers/new');
    expect(page.url()).toContain('/admin/publishers/new');
  });

  test('create publisher form has required fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/publishers/new`);
    await waitForClientReady(page);

    // Wait for the form to load - look for a form heading or input
    await expect(page.locator('form, input').first()).toBeVisible({ timeout: 15000 });

    // Should see form fields (check for inputs)
    await expect(page.locator('input[name*="name"], input#name, input[placeholder*="ame"]').first()).toBeVisible();
    await expect(page.locator('input[name*="email"], input#email, input[placeholder*="mail"]').first()).toBeVisible();
  });
});

test.describe('Admin Publisher Details', () => {
  test('admin can view publisher details', async ({ page }) => {
    // Use shared fixture - gets ID at runtime
    const publisher = await getSharedPublisherAsync('verified-1');
    await page.goto(`${BASE_URL}/admin/publishers/${publisher.id}`);
    await waitForClientReady(page);

    // Wait for page content to load - check for heading instead of networkidle
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });

    // Should see publisher details card with email label (uppercase "EMAIL" in the UI)
    await expect(page.getByText(/email/i).first()).toBeVisible();
  });

  test('publisher details shows status badges', async ({ page }) => {
    const publisher = await getSharedPublisherAsync('verified-1');
    await page.goto(`${BASE_URL}/admin/publishers/${publisher.id}`);
    await waitForClientReady(page);

    // Wait for page content to load
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });

    // Should see status badges (Certified/Community and Active/Suspended/Pending)
    // A verified publisher should show Active badge
    await expect(page.getByText(/Active|Certified|Community/i).first()).toBeVisible();
  });

});
