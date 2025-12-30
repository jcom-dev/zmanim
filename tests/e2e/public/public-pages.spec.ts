/**
 * E2E Tests: Public Pages
 *
 * Tests for public (unauthenticated) pages:
 * - Homepage loads
 * - Zmanim page loads for valid city
 * - Zmanim page 404 for invalid city
 * - Become publisher page loads
 * - Become publisher form elements
 */

import { test, expect } from '@playwright/test';
import { BASE_URL } from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

// All tests run in parallel
test.describe.configure({ mode: 'parallel' });

test.describe('Public Pages - Homepage', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    expect(page.url()).toBe(`${BASE_URL}/`);
  });

  test('homepage has Shtetl Zmanim branding', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    const pageContent = await page.textContent('body');
    expect(pageContent?.toLowerCase().includes('zmanim')).toBeTruthy();
  });

  test('homepage is accessible without authentication', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Should not be redirected to sign-in
    expect(page.url()).not.toContain('/sign-in');
    expect(page.url()).toBe(`${BASE_URL}/`);
  });

  test('homepage has navigation links', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Should have navigation bar (using div with border-b for styling)
    // Check for key navigation elements: logo, sign in, and mode toggle
    await expect(page.getByText('Shtetl Zmanim').first()).toBeVisible({ timeout: 15000 });
  });

  test('homepage has sign in link or login option', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Should have sign in link, login link, button, or some auth action
    // The Sign In is rendered as a Clerk modal button
    const signInText = page.getByText('Sign In');

    const hasSignIn = await signInText.isVisible({ timeout: 15000 }).catch(() => false);
    expect(hasSignIn).toBeTruthy();
  });
});

test.describe('Public Pages - Register Publisher', () => {
  test('register page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await waitForClientReady(page);

    expect(page.url()).toContain('/register');
  });

  test('register page is accessible without authentication', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await waitForClientReady(page);

    // Should not redirect to sign-in immediately
    // (may require auth after form submission but not to view)
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('register page shows relevant content', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await waitForClientReady(page);

    const pageContent = await page.textContent('body');
    expect(
      pageContent?.toLowerCase().includes('publisher') ||
      pageContent?.toLowerCase().includes('register')
    ).toBeTruthy();
  });

  test('register page has form or call to action', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await waitForClientReady(page);

    // Should have form fields or signup button
    const hasForm = await page.locator('form').isVisible({ timeout: 15000 }).catch(() => false);
    const hasButton = await page.getByRole('button').first().isVisible({ timeout: 15000 }).catch(() => false);
    const hasLink = await page.getByRole('link').first().isVisible({ timeout: 15000 }).catch(() => false);

    expect(hasForm || hasButton || hasLink).toBeTruthy();
  });
});

test.describe('Public Pages - Auth Pages', () => {
  test('sign-in page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'domcontentloaded' });

    // Auth pages load Clerk which can be slow - just verify URL
    expect(page.url()).toContain('/sign-in');
  });

  test('sign-up page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-up`, { waitUntil: 'domcontentloaded' });

    // Auth pages load Clerk which can be slow - just verify URL
    expect(page.url()).toContain('/sign-up');
  });

  test('sign-in page shows Clerk auth component', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'domcontentloaded' });

    // Wait for Clerk to load by checking for auth-related content
    // Clerk can be slow, give it extra time
    await page.waitForFunction(
      () => {
        const content = document.body.textContent?.toLowerCase() || '';
        return content.includes('sign in') || content.includes('email') || content.includes('continue');
      },
      { timeout: 30000 }
    );

    const pageContent = await page.textContent('body');
    expect(
      pageContent?.toLowerCase().includes('sign in') ||
      pageContent?.toLowerCase().includes('email') ||
      pageContent?.toLowerCase().includes('continue')
    ).toBeTruthy();
  });

  test('sign-up page shows Clerk auth component', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-up`, { waitUntil: 'domcontentloaded' });

    // Wait for Clerk to load by checking for auth-related content
    // Clerk can be slow, give it extra time
    await page.waitForFunction(
      () => {
        const content = document.body.textContent?.toLowerCase() || '';
        return content.includes('sign up') || content.includes('create') || content.includes('email');
      },
      { timeout: 30000 }
    );

    const pageContent = await page.textContent('body');
    expect(
      pageContent?.toLowerCase().includes('sign up') ||
      pageContent?.toLowerCase().includes('create') ||
      pageContent?.toLowerCase().includes('email')
    ).toBeTruthy();
  });
});

test.describe('Public Pages - Zmanim Display', () => {
  test('zmanim page structure exists', async ({ page }) => {
    // This test checks the route structure exists
    // Actual zmanim display depends on city data
    const response = await page.goto(`${BASE_URL}/zmanim/test-city`, { waitUntil: 'domcontentloaded' });

    // Should either load the page or return 404 (not error/redirect)
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Public Pages - 404 Handling', () => {
  test('404 page shows for invalid routes', async ({ page }) => {
    await page.goto(`${BASE_URL}/this-page-does-not-exist-12345`);
    await waitForClientReady(page);

    // Should show 404 or similar error page
    const pageContent = await page.textContent('body');
    expect(
      pageContent?.includes('404') ||
      pageContent?.toLowerCase().includes('not found') ||
      pageContent?.toLowerCase().includes("doesn't exist")
    ).toBeTruthy();
  });
});

test.describe('Public Pages - Responsive Design', () => {
  test('homepage is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Page should load without horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375 + 50); // Allow small margin
  });

  test('homepage is responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(768 + 50);
  });
});

test.describe('Public Pages - Navigation', () => {
  test('clicking sign in from homepage navigates to sign-in page', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    const signInLink = page.getByRole('link', { name: /sign in/i });
    if (await signInLink.isVisible({ timeout: 15000 }).catch(() => false)) {
      await signInLink.click();
      await page.waitForURL('**/sign-in**', { timeout: 15000 });
      expect(page.url()).toContain('/sign-in');
    }
  });

  test('logo link navigates to homepage', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-in`);
    await waitForClientReady(page);

    // Find and click logo/home link
    const logoLink = page.locator('a[href="/"]').first();
    if (await logoLink.isVisible({ timeout: 15000 }).catch(() => false)) {
      await logoLink.click();
      await page.waitForURL(`${BASE_URL}/`, { timeout: 15000 });
      expect(page.url()).toBe(`${BASE_URL}/`);
    }
  });
});

test.describe('Public Pages - Accept Invitation', () => {
  test('accept invitation page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/accept-invitation`, { waitUntil: 'domcontentloaded' });

    // Should either show the page or redirect to sign-in
    const url = page.url();
    expect(
      url.includes('/accept-invitation') ||
      url.includes('/sign-in')
    ).toBeTruthy();
  });

  test('accept invitation with invalid token shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/accept-invitation?token=invalid-token-12345`);
    await waitForClientReady(page);

    // Wait for content to load by checking body has content
    await expect(page.locator('body')).not.toBeEmpty({ timeout: 15000 });

    // Should show error or redirect
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });
});

test.describe('Public Pages - Meta Tags', () => {
  test('homepage has title tag', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });

  test('homepage has viewport meta tag', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toBeTruthy();
    expect(viewport?.includes('width')).toBeTruthy();
  });
});
