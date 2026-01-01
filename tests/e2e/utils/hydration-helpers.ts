import { Page } from '@playwright/test';

/**
 * Wait for React hydration to complete in production builds.
 * Production builds serve static HTML first, then hydrate with React.
 */
export async function waitForHydration(page: Page, timeout = 15000) {
  await page.waitForFunction(
    () => {
      // Check if Next.js has finished hydrating
      // In Next.js 13+, we can check for the absence of hydration markers
      const isHydrating = document.querySelector('[data-next-hydrate]');
      return !isHydrating;
    },
    { timeout }
  );
}

/**
 * Wait for page to be fully ready (network + hydration + effects).
 * Use this instead of just waitForLoadState('networkidle') for production builds.
 */
export async function waitForClientReady(page: Page) {
  // Wait for DOM to be ready first
  await page.waitForLoadState('domcontentloaded');

  // Try networkidle with a shorter timeout, but don't fail if it times out
  // Some pages have long-polling or websockets that never become "idle"
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch {
    // networkidle timeout is acceptable - page may have persistent connections
  }

  // Wait for React hydration
  await waitForHydration(page);

  // Small buffer for useEffect hooks to run
  await page.waitForTimeout(500);
}

/**
 * Wait for a specific element to be visible, accounting for hydration delays.
 * Use this for elements that are rendered after client-side data fetching.
 */
export async function waitForElement(
  page: Page,
  selector: string,
  options: { timeout?: number } = {}
) {
  const timeout = options.timeout || 15000;

  await waitForClientReady(page);
  await page.waitForSelector(selector, { state: 'visible', timeout });
}
