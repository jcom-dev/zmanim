/**
 * E2E Tests: Admin Dashboard
 *
 * Tests for admin dashboard functionality including:
 * - Dashboard access and display
 * - Statistics rendering
 * - Navigation to other admin pages
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, BASE_URL } from '../utils';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('admin can access dashboard and see welcome message', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');

    // Should see welcome message
    await expect(page.getByRole('heading', { name: 'Welcome to Admin Portal' })).toBeVisible();

    // Should see navigation tabs (exact match)
    await expect(page.getByRole('link', { name: 'Publishers', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
  });

  test('admin can navigate to dashboard stats page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should see dashboard title
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();

    // Should see statistics sections
    await expect(page.getByText('Publisher Statistics')).toBeVisible();
  });

  test('dashboard shows publisher statistics cards', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should see stat cards (use first() for multiple matches)
    // Wait for actual content instead of hard timeout
    await expect(page.getByText('Total Publishers').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Active Publishers').first()).toBeVisible();
    await expect(page.getByText('Pending Approval').first()).toBeVisible();
  });

  test('dashboard has quick action links', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should see quick actions section
    await expect(page.getByText('Quick Actions')).toBeVisible();

    // Should have links to other admin pages - check for card titles
    await expect(page.getByRole('heading', { name: /Manage Publishers/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Create Publisher/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /System Settings/i })).toBeVisible();
  });

  test('can refresh dashboard statistics', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/dashboard`);
    await page.waitForLoadState('networkidle');

    // Find and click refresh button
    const refreshButton = page.getByRole('button', { name: /refresh/i });
    await expect(refreshButton).toBeVisible();

    await refreshButton.click();

    // Wait for stats to reload by checking content is visible
    // This replaces the hard timeout with a deterministic wait
    await expect(page.getByText('Total Publishers').first()).toBeVisible({ timeout: 10000 });
  });

  test('admin portal shows publisher requests section', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');

    // Should see publisher requests info section
    await expect(page.getByText('Publisher Requests')).toBeVisible();
    await expect(page.getByText('Publisher Management').first()).toBeVisible();
  });

  test('admin can navigate from portal to publisher management', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');

    // Click on Publisher Management card (use the card link, not nav)
    await page.locator('a[href="/admin/publishers"]').filter({ hasText: 'Publisher Management' }).first().click();

    await page.waitForURL('**/admin/publishers');
    expect(page.url()).toContain('/admin/publishers');
  });

  test('admin can navigate from portal to create publisher', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');

    // Click on Create Publisher card
    await page.locator('a[href="/admin/publishers/new"]').first().click();

    await page.waitForURL('**/admin/publishers/new');
    expect(page.url()).toContain('/admin/publishers/new');
  });

  test('admin can navigate from portal to system settings', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');

    // Click on System Settings card
    await page.locator('a[href="/admin/settings"]').filter({ hasText: 'System Settings' }).first().click();

    await page.waitForURL('**/admin/settings');
    expect(page.url()).toContain('/admin/settings');
  });
});
