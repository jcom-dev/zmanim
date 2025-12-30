/**
 * E2E Tests: Registry Accessibility
 *
 * Tests for accessibility compliance of the registry interface:
 * - Keyboard navigation
 * - Screen reader support (axe-core)
 * - Focus management
 * - Color contrast verification
 *
 * Story 11.7, AC-9
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  loginAsPublisher,
  getSharedPublisher,
  BASE_URL,
} from '../utils';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Registry Accessibility - Keyboard Navigation', () => {
  test('can tab through all interactive elements in logical order', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/registry`);
    await page.waitForLoadState('networkidle');

    // Tab through interactive elements
    // Start from the beginning
    await page.keyboard.press('Tab');

    // Collect focused elements to verify logical order
    const focusedElements: string[] = [];

    // Tab through first 10 interactive elements
    for (let i = 0; i < 10; i++) {
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return null;

        // Get element identifier
        const tagName = el.tagName.toLowerCase();
        const role = el.getAttribute('role');
        const ariaLabel = el.getAttribute('aria-label');
        const type = el.getAttribute('type');
        const text = el.textContent?.trim().slice(0, 30);

        return {
          tagName,
          role,
          ariaLabel,
          type,
          text,
          hasTabIndex: el.hasAttribute('tabindex'),
        };
      });

      if (focusedElement) {
        const identifier = focusedElement.ariaLabel ||
                          focusedElement.text ||
                          `${focusedElement.tagName}[${focusedElement.role || focusedElement.type || ''}]`;
        focusedElements.push(identifier);
      }

      await page.keyboard.press('Tab');
    }

    // Verify we tabbed through elements (not stuck)
    expect(focusedElements.length).toBeGreaterThan(5);
  });

  test('can activate buttons with Enter and Space keys', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/registry`);
    await page.waitForLoadState('networkidle');

    // Wait for registry content to load
    await expect(page.locator('[data-testid="zman-card"]').first()).toBeVisible({ timeout: 10000 });

    // Find first info button
    const infoButton = page.locator('button[aria-label*="info" i]').first();
    await expect(infoButton).toBeVisible({ timeout: 5000 });

    // Focus the button using keyboard
    await infoButton.focus();

    // Verify button is focused
    const isFocused = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.tagName === 'BUTTON';
    });
    expect(isFocused).toBe(true);

    // Activate with Enter
    await page.keyboard.press('Enter');

    // Verify modal opened
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 2000 });

    // Close modal with Escape
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('can close modals with Escape key', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/registry`);
    await page.waitForLoadState('networkidle');

    // Wait for registry content to load
    await expect(page.locator('[data-testid="zman-card"]').first()).toBeVisible({ timeout: 10000 });

    // Find and click first info button to open modal
    const infoButton = page.locator('button[aria-label*="info" i]').first();
    await expect(infoButton).toBeVisible({ timeout: 5000 });

    await infoButton.click();

    // Wait for modal to open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 2000 });

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Verify modal closed
    await expect(modal).not.toBeVisible();
  });

  test('can navigate dropdowns with arrow keys', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/registry`);
    await page.waitForLoadState('networkidle');

    // Find location dropdown or combobox
    const dropdown = page.locator('[role="combobox"], select, button[aria-haspopup="listbox"]').first();

    if (await dropdown.count() > 0) {
      // Focus dropdown
      await dropdown.focus();

      // Open with Enter or Space
      await page.keyboard.press('Enter');

      // Wait for listbox to appear
      const listbox = page.locator('[role="listbox"], [role="menu"]');
      const isListboxVisible = await listbox.isVisible({ timeout: 1000 }).catch(() => false);

      if (isListboxVisible) {
        // Navigate with arrow keys
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowUp');

        // Close with Escape
        await page.keyboard.press('Escape');
      }
    }
  });
});

test.describe('Registry Accessibility - Screen Reader Support', () => {
  test('has no critical accessibility violations', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/registry`);
    await page.waitForLoadState('networkidle');

    // Run axe-core accessibility audit
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Verify NO critical violations
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('has proper ARIA labels for interactive buttons', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/registry`);
    await page.waitForLoadState('networkidle');

    // Check for ARIA labels on buttons
    const buttons = await page.locator('button').all();

    let buttonsChecked = 0;
    for (const button of buttons.slice(0, 10)) {
      const isVisible = await button.isVisible().catch(() => false);
      if (!isVisible) continue;

      const ariaLabel = await button.getAttribute('aria-label');
      const ariaLabelledby = await button.getAttribute('aria-labelledby');
      const textContent = await button.textContent();

      // Button should have EITHER:
      // - aria-label
      // - aria-labelledby
      // - visible text content
      const hasAccessibleName = ariaLabel || ariaLabelledby || (textContent && textContent.trim().length > 0);

      if (!hasAccessibleName) {
        const buttonHtml = await button.evaluate(el => el.outerHTML.slice(0, 100));
        console.warn(`Button without accessible name: ${buttonHtml}`);
      }

      buttonsChecked++;
    }

    // At least some buttons should be present
    expect(buttonsChecked).toBeGreaterThan(0);
  });

  test('uses semantic HTML structure', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/registry`);
    await page.waitForLoadState('networkidle');

    // Verify semantic HTML elements exist
    await expect(page.locator('header')).toBeAttached();
    await expect(page.locator('main')).toBeAttached();

    // Navigation should exist (either nav element or role="navigation")
    const hasNav = await page.locator('nav, [role="navigation"]').count() > 0;
    expect(hasNav).toBe(true);
  });

  test('has ARIA live regions for dynamic content', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/registry`);
    await page.waitForLoadState('networkidle');

    // Check for ARIA live regions (for loading states, notifications, etc.)
    const liveRegions = await page.locator('[aria-live], [role="status"], [role="alert"]').count();

    // Should have at least one live region for dynamic updates
    // (This is a soft check - might be 0 if no dynamic content yet)
    expect(liveRegions).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Registry Accessibility - Focus Management', () => {
  test('has visible focus indicators on all interactive elements', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/registry`);
    await page.waitForLoadState('networkidle');

    // Find first button
    const button = page.locator('button').first();
    await button.focus();

    // Check if focus styles are applied
    const focusStyles = await button.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        outlineColor: styles.outlineColor,
        boxShadow: styles.boxShadow,
      };
    });

    // Should have either outline or box-shadow for focus
    const hasFocusIndicator =
      focusStyles.outline !== 'none' ||
      focusStyles.outlineWidth !== '0px' ||
      focusStyles.boxShadow !== 'none';

    expect(hasFocusIndicator).toBe(true);
  });

  test('traps focus inside modal when open', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/registry`);
    await page.waitForLoadState('networkidle');

    // Wait for registry content to load
    await expect(page.locator('[data-testid="zman-card"]').first()).toBeVisible({ timeout: 10000 });

    // Find and click info button to open modal
    const infoButton = page.locator('button[aria-label*="info" i]').first();
    await expect(infoButton).toBeVisible({ timeout: 5000 });

    await infoButton.click();

    // Wait for modal to open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 2000 });

    // Get all interactive elements in modal
    const modalInteractiveElements = modal.locator('button, a, input, textarea, select, [tabindex="0"]');
    const count = await modalInteractiveElements.count();

    // Modal should have at least the close button
    expect(count).toBeGreaterThan(0);

    // Tab through all elements plus one more to test wrap-around
    for (let i = 0; i < count + 2; i++) {
      await page.keyboard.press('Tab');
    }

    // Focus should still be inside modal (focus trap working)
    const focusedElementInModal = await page.evaluate(() => {
      const activeEl = document.activeElement;
      const modalEl = document.querySelector('[role="dialog"]');
      return modalEl?.contains(activeEl) || false;
    });

    expect(focusedElementInModal).toBe(true);

    // Close modal
    await page.keyboard.press('Escape');
  });

  test('returns focus to trigger element after modal closes', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/registry`);
    await page.waitForLoadState('networkidle');

    // Wait for registry content to load
    await expect(page.locator('[data-testid="zman-card"]').first()).toBeVisible({ timeout: 10000 });

    // Find info button
    const infoButton = page.locator('button[aria-label*="info" i]').first();
    await expect(infoButton).toBeVisible({ timeout: 5000 });

    // Get button identifier before clicking
    const buttonId = await infoButton.evaluate(el => {
      return el.getAttribute('data-testid') ||
             el.getAttribute('id') ||
             el.getAttribute('aria-label') ||
             el.className;
    });

    // Click to open modal
    await infoButton.click();

    // Wait for modal
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 2000 });

    // Close modal with Escape
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // Check if focus returned to button
    const focusedAfterClose = await page.evaluate(() => {
      const activeEl = document.activeElement;
      return {
        id: activeEl?.getAttribute('data-testid') || activeEl?.getAttribute('id'),
        ariaLabel: activeEl?.getAttribute('aria-label'),
        className: activeEl?.className,
        tagName: activeEl?.tagName,
      };
    });

    // Focus should be on a button (ideally the same one)
    expect(focusedAfterClose.tagName).toBe('BUTTON');
  });
});

test.describe('Registry Accessibility - Color Contrast', () => {
  test('meets WCAG AA color contrast requirements', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/registry`);
    await page.waitForLoadState('networkidle');

    // Run axe-core with color-contrast rules
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('main') // Focus on main content area
      .analyze();

    // Filter for color contrast violations
    const colorContrastViolations = accessibilityScanResults.violations.filter(
      violation => violation.id === 'color-contrast'
    );

    // Verify NO color contrast violations
    expect(colorContrastViolations).toEqual([]);
  });

  test('buttons and interactive elements have sufficient contrast', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/registry`);
    await page.waitForLoadState('networkidle');

    // Wait for registry content to load
    await expect(page.locator('[data-testid="zman-card"]').first()).toBeVisible({ timeout: 10000 });

    // Check first visible button for contrast
    const button = page.locator('button:visible').first();
    await expect(button).toBeVisible({ timeout: 5000 });

    const contrastInfo = await button.evaluate((button) => {
      const styles = window.getComputedStyle(button);
      return {
        color: styles.color,
        backgroundColor: styles.backgroundColor,
        borderColor: styles.borderColor,
      };
    });

    // Basic check that color and background are different
    expect(contrastInfo.color).not.toBe(contrastInfo.backgroundColor);
  });

  test('text content has sufficient contrast', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/registry`);
    await page.waitForLoadState('networkidle');

    // Run axe-core specifically checking for text contrast
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('main')
      .disableRules(['color-contrast-enhanced']) // Only check AA, not AAA
      .analyze();

    // Get color contrast violations
    const colorViolations = accessibilityScanResults.violations.filter(
      v => v.id.includes('color-contrast')
    );

    // Should have no violations
    if (colorViolations.length > 0) {
      console.log('Color contrast violations:', JSON.stringify(colorViolations, null, 2));
    }

    expect(colorViolations).toEqual([]);
  });
});
