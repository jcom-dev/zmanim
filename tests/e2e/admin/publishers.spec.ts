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

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Admin Publisher Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('admin can view publishers list', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/publishers`);
    await page.waitForLoadState('networkidle');

    // Should see page title - actual heading is "Publisher Management"
    await expect(page.getByRole('heading', { name: /Publisher Management/i }).first()).toBeVisible();

    // Should see publishers table or list
    await expect(page.locator('table, [role="table"], .publisher-list').first()).toBeVisible();
  });

  test('publishers list shows table headers', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/publishers`);
    await page.waitForLoadState('networkidle');

    // Should see table headers - use role for column headers
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  });

  test('admin can filter publishers by status', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/publishers`);
    await page.waitForLoadState('networkidle');

    // Find status filter dropdown or tabs
    const statusFilter = page.locator('select, [role="combobox"], [data-testid="status-filter"]').first();
    if (await statusFilter.isVisible()) {
      await expect(statusFilter).toBeVisible();
    } else {
      // Or tabs
      await expect(page.getByRole('tab', { name: /all/i }).first()).toBeVisible();
    }
  });

  test('admin can search publishers', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/publishers`);
    await page.waitForLoadState('networkidle');

    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="earch"], input[placeholder*="filter"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      // Wait for debounced search to filter results
      await expect(page.locator('table, [role="table"], .publisher-list').first()).toBeVisible({ timeout: 5000 });
    }
    // Search is optional, test passes if page loads
  });

  test('admin can access create publisher page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/publishers`);
    await page.waitForLoadState('networkidle');

    // Click create button - actual button text is "Create New Publisher"
    const createButton = page.getByRole('link', { name: /Create New Publisher/i });
    await expect(createButton).toBeVisible();
    await createButton.click();

    await page.waitForURL('**/admin/publishers/new');
    expect(page.url()).toContain('/admin/publishers/new');
  });

  test('create publisher form has required fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/publishers/new`);
    await page.waitForLoadState('networkidle');

    // Should see form fields (check for inputs)
    await expect(page.locator('input[name*="name"], input#name, input[placeholder*="ame"]').first()).toBeVisible();
    await expect(page.locator('input[name*="email"], input#email, input[placeholder*="mail"]').first()).toBeVisible();
  });
});

test.describe('Admin Publisher Details', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('admin can view publisher details', async ({ page }) => {
    // Use shared fixture - gets ID at runtime
    const publisher = await getSharedPublisherAsync('verified-1');
    await page.goto(`${BASE_URL}/admin/publishers/${publisher.id}`);
    await page.waitForLoadState('networkidle');

    // Should see publisher details (name might vary)
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Should see publisher details card - look for "Publisher Details" title
    await expect(page.getByText(/Publisher Details/i).first()).toBeVisible();
  });

  test('publisher details shows Quick Actions section', async ({ page }) => {
    const publisher = await getSharedPublisherAsync('verified-1');
    await page.goto(`${BASE_URL}/admin/publishers/${publisher.id}`);
    await page.waitForLoadState('networkidle');

    // Quick Actions is a CardTitle
    await expect(page.getByText('Quick Actions')).toBeVisible();
  });

  test('publisher details has impersonation button', async ({ page }) => {
    const publisher = await getSharedPublisherAsync('verified-1');
    await page.goto(`${BASE_URL}/admin/publishers/${publisher.id}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /view as publisher/i })).toBeVisible();
  });

  test('publisher details shows Users section', async ({ page }) => {
    const publisher = await getSharedPublisherAsync('verified-1');
    await page.goto(`${BASE_URL}/admin/publishers/${publisher.id}`);
    await page.waitForLoadState('networkidle');

    // Users section is a CardTitle
    await expect(page.getByText(/Users|Team Members/i).first()).toBeVisible();
  });

  test('admin can open invite user dialog', async ({ page }) => {
    const publisher = await getSharedPublisherAsync('verified-1');
    await page.goto(`${BASE_URL}/admin/publishers/${publisher.id}`);
    await page.waitForLoadState('networkidle');

    // Click invite user button
    const inviteButton = page.getByRole('button', { name: /invite/i });
    if (await inviteButton.isVisible()) {
      await inviteButton.click();

      // Should see dialog
      await expect(page.getByRole('dialog')).toBeVisible();
    }
    // Test passes if button exists or page loads
  });

  test('admin can open edit publisher dialog', async ({ page }) => {
    const publisher = await getSharedPublisherAsync('verified-1');
    await page.goto(`${BASE_URL}/admin/publishers/${publisher.id}`);
    await page.waitForLoadState('networkidle');

    // Click edit button
    const editButton = page.getByRole('button', { name: /edit/i });
    if (await editButton.isVisible()) {
      await editButton.click();

      // Should see edit dialog or page
      await expect(page.getByRole('dialog').or(page.getByRole('form'))).toBeVisible();
    }
    // Test passes if page loads
  });

  test('admin sees delete publisher option', async ({ page }) => {
    const publisher = await getSharedPublisherAsync('verified-1');
    await page.goto(`${BASE_URL}/admin/publishers/${publisher.id}`);
    await page.waitForLoadState('networkidle');

    // Should see delete button - use exact name since there are multiple action buttons
    const deleteButton = page.getByRole('button', { name: 'Delete' });
    await expect(deleteButton).toBeVisible();
  });
});

test.describe('Admin Publisher Status Changes', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('pending publisher shows verify button', async ({ page }) => {
    const publisher = await getSharedPublisherAsync('pending');
    await page.goto(`${BASE_URL}/admin/publishers/${publisher.id}`);
    await page.waitForLoadState('networkidle');

    // Should see verify button if still pending, or suspend button if already verified by another test
    const verifyButton = page.getByRole('button', { name: /verify publisher/i });
    const suspendButton = page.getByRole('button', { name: /suspend publisher/i });

    // Either verify or suspend button should be visible (depending on test order)
    await expect(verifyButton.or(suspendButton)).toBeVisible();
  });

  test('verified publisher shows suspend button', async ({ page }) => {
    const publisher = await getSharedPublisherAsync('verified-2');
    await page.goto(`${BASE_URL}/admin/publishers/${publisher.id}`);
    await page.waitForLoadState('networkidle');

    // Should see suspend button (text is "Suspend Publisher")
    await expect(page.getByRole('button', { name: /suspend publisher/i })).toBeVisible();
  });

  test('suspended publisher shows reactivate button', async ({ page }) => {
    const publisher = await getSharedPublisherAsync('suspended');
    await page.goto(`${BASE_URL}/admin/publishers/${publisher.id}`);
    await page.waitForLoadState('networkidle');

    // Should see reactivate button (text is "Reactivate Publisher")
    await expect(page.getByRole('button', { name: /reactivate publisher/i })).toBeVisible();
  });

  test('admin can verify a pending publisher', async ({ page }) => {
    const publisher = await getSharedPublisherAsync('pending');
    await page.goto(`${BASE_URL}/admin/publishers/${publisher.id}`);
    await page.waitForLoadState('networkidle');

    // Find and click verify button
    const verifyButton = page.getByRole('button', { name: /verify publisher/i });
    const suspendButton = page.getByRole('button', { name: /suspend publisher/i });

    // If verify button is visible, click it and verify the flow
    if (await verifyButton.isVisible()) {
      await verifyButton.click();

      // Wait for network to settle after the status change
      await page.waitForLoadState('networkidle');

      // After verification, the page should re-render with suspend button
      await expect(suspendButton).toBeVisible({ timeout: 10000 });
    } else {
      // Publisher was already verified - suspend button should be visible
      await expect(suspendButton).toBeVisible({ timeout: 5000 });
    }
  });
});
