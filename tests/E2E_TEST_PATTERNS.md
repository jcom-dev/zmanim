# E2E Test Patterns for Custom Components

**Date:** 2025-12-29
**Purpose:** Document test patterns for custom UI components to prevent selector brittleness

---

## Core Principles

### 1. **Test Against Actual DOM, Not Assumptions**

❌ **BAD** - Assuming components follow ARIA patterns:
```typescript
await page.getByRole('menu').click(); // Assumes Radix/semantic HTML
```

✅ **GOOD** - Test actual implementation:
```typescript
// Custom dropdown uses buttons, not role="menu"
const dropdown = page.getByRole('button', { name: /Export/i });
await dropdown.click();
```

### 2. **Use Specific Selectors**

❌ **BAD** - Overly broad regex matches multiple elements:
```typescript
await page.getByRole('link', { name: /Profile/i }).click();
// Matches BOTH: navigation tab AND dashboard card
```

✅ **GOOD** - Combine selectors for uniqueness:
```typescript
await page.locator('a[href="/publisher/profile"]')
  .filter({ has: page.getByRole('heading', { name: 'Profile' }) })
  .click();
```

### 3. **Replace Timeouts with Assertions**

❌ **BAD** - Arbitrary waits:
```typescript
await page.waitForTimeout(500); // Race condition under load
```

✅ **GOOD** - Wait for specific state:
```typescript
await expect(searchResults).toBeVisible({ timeout: 5000 });
```

---

## Custom Component Patterns

### DropdownMenu (Custom Implementation)

**Component:** `<DropdownMenu>` (not Radix UI)

**Pattern:**
```typescript
// Open dropdown
const dropdown = page.getByRole('button', { name: /Export/i })
  .filter({ hasText: /Export/i }); // Avoid matching icons
await dropdown.click();

// Select menu item (uses buttons, not role="menuitem")
const menuItem = page.getByRole('button', { name: /Generate PDF Report/i });
await expect(menuItem).toBeVisible({ timeout: 5000 });
await menuItem.click();
```

**Key Points:**
- Custom dropdowns use `<button>` elements, NOT `role="menu"` or `role="menuitem"`
- Filter by text to avoid matching icon-only buttons
- Wait for menu items to appear with assertions, not `waitForTimeout()`

---

### LocalityPicker (Popover + Search)

**Component:** `<LocalityPicker>` in Popover

**Pattern:**
```typescript
// Open picker
const selectLocationButton = page.getByRole('button', { name: /select location/i }).first();
await selectLocationButton.click();

// Search for locality
const searchInput = page.getByPlaceholder(/search localities/i);
await expect(searchInput).toBeVisible({ timeout: 3000 });
await searchInput.fill('jerusalem');

// Select from results (buttons, not combobox options)
const resultButton = page.locator('button')
  .filter({ hasText: /jerusalem/i })
  .first();
await expect(resultButton).toBeVisible({ timeout: 5000 });
await resultButton.click();

// Wait for state propagation (zmanim counts update)
await page.waitForFunction(
  () => {
    const tabText = document.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
    return tabText && !tabText.includes('--');
  },
  { timeout: 10000 }
);
```

**Key Points:**
- NOT a combobox - uses Popover + Input + Button results
- Results render as `<button>` elements with locality names
- Must wait for API call completion (zmanim counts update)
- Don't use `waitForTimeout()` - wait for specific state changes

---

### Wizard Flow

**Component:** Multi-step wizard with conditional rendering

**Pattern:**
```typescript
async function skipWizardIfNeeded(page: Page) {
  // Wait for either wizard or main page to appear
  await page.waitForFunction(
    () => {
      const body = document.body.textContent || '';
      return body.includes('Welcome to Shtetl Zmanim') || body.includes('Versions');
    },
    { timeout: 10000 }
  );

  // If wizard is present, skip it
  const skipButton = page.getByRole('button', { name: /Skip wizard/i });
  if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipButton.click();

    // Wait for main page to load (verify key element appears)
    await expect(page.getByRole('button', { name: /Versions/i }))
      .toBeVisible({ timeout: 10000 });
  }
}
```

**Key Points:**
- Wizard may appear dynamically based on publisher state
- Wait for either outcome (wizard OR main page) before proceeding
- Verify page transition completed before continuing tests

---

## Common Mistakes & Fixes

### Mistake 1: Wrong Dropdown

❌ **Problem:**
```typescript
// Test clicked "Versions" dropdown instead of "Export" dropdown
const versionsButton = page.getByRole('button', { name: /Versions/i });
await versionsButton.click();
const pdfButton = page.getByRole('button', { name: /Generate PDF Report/i });
// FAILS: PDF button is in Export dropdown, not Versions!
```

✅ **Solution:**
```typescript
// Use correct dropdown
const exportButton = page.getByRole('button', { name: /Export/i })
  .filter({ hasText: /Export/i });
await exportButton.click();
const pdfButton = page.getByRole('button', { name: /Generate PDF Report/i });
```

**Lesson:** Always verify UI structure before writing tests. Don't assume menu items are in a specific dropdown.

---

### Mistake 2: Selector Ambiguity

❌ **Problem:**
```typescript
// Matches BOTH navigation tab AND dashboard card
await page.getByRole('link', { name: /Profile/i }).click();
```

✅ **Solution:**
```typescript
// Be specific - use URL + context
await page.locator('a[href="/publisher/profile"]')
  .filter({ has: page.getByRole('heading', { name: 'Profile' }) })
  .click();
```

**Lesson:** When regex matches multiple elements, add structural context (href, parent elements, etc.).

---

### Mistake 3: Testing Wrong Scenario

❌ **Problem:**
```typescript
test('error handling when location is not selected', async ({ page }) => {
  await selectLocationForPreview(page); // Pre-selects location!

  // Open PDF modal - location is ALREADY selected from toolbar
  // Test expects error but location was pre-filled
});
```

✅ **Solution:**
```typescript
test('PDF generation uses pre-selected location from toolbar', async ({ page }) => {
  await selectLocationForPreview(page);

  // Open PDF modal
  // Verify location IS pre-filled (correct behavior)
  await expect(modal.getByText(/Selected:.*Jerusalem/i)).toBeVisible();
});
```

**Lesson:** Understand component behavior before testing. Modal pre-fills from toolbar state - that's not an error case.

---

## Best Practices Summary

1. ✅ **Read component source** before writing tests
2. ✅ **Use structural selectors** (href, data-testid, heading context)
3. ✅ **Wait for state, not time** (`expect().toBeVisible()` not `waitForTimeout()`)
4. ✅ **Test actual behavior** (custom components ≠ library components)
5. ✅ **Filter ambiguous selectors** (`.filter({ has: })`, `.filter({ hasText: })`)
6. ✅ **Verify test assumptions** (check DOM snapshots when tests fail)

---

## Testing Checklist

Before writing tests for a new component:

- [ ] Inspect actual DOM structure in browser DevTools
- [ ] Identify if component uses semantic roles or custom implementation
- [ ] Note any dynamic behavior (modals, dropdowns, async state)
- [ ] Check if selectors are unique (won't match unintended elements)
- [ ] Verify state changes complete before next action
- [ ] Replace all `waitForTimeout()` with state-based waits
- [ ] Add error context screenshots to debug failures

---

## Quick Reference

| Component | Selector Strategy | Key Gotcha |
|-----------|------------------|------------|
| **DropdownMenu** | `getByRole('button')` | Uses buttons, not `role="menu"` |
| **LocalityPicker** | `getByPlaceholder()` + `locator('button')` | Not a combobox - custom Popover |
| **Dashboard Cards** | `locator('a[href]').filter({ has: heading })` | Regex matches nav tabs too |
| **Wizard** | `waitForFunction()` for page state | May appear dynamically |
| **Modals** | `getByRole('dialog')` | Standard dialog role works |

---

## Troubleshooting Failed Tests

1. **Check error-context.md** - Contains page snapshot at failure
2. **Look for selector ambiguity** - Does regex match multiple elements?
3. **Verify component structure** - Custom or library component?
4. **Check timing** - Is `waitForTimeout()` hiding a race condition?
5. **Review recent UI changes** - Did component library change?

---

**Last Updated:** 2025-12-29
**Maintainer:** Test Architecture Team
**Related:** [tests/TESTING.md](./TESTING.md)
