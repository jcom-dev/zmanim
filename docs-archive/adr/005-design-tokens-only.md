# ADR-005: Design Tokens Only (No Hardcoded Colors)

**Status:** Accepted
**Date:** 2025-11-25
**Deciders:** Frontend Team, Design Lead
**Impact:** High (PR Blocker for UI changes)

## Context

Before November 2025, components used inconsistent color patterns:

```tsx
// Inconsistent hardcoded colors across 50+ components
<div className="text-[#1e3a5f] bg-[#f8fafc]">
<Badge style={{ color: '#0051D5', backgroundColor: '#E3F2FD' }}>
<div className="text-gray-600 dark:text-gray-300">
<span style={{ color: isActive ? '#00A000' : '#808080' }}>
```

**Problems:**
- **Dark mode broken:** 40+ components hard-light colors
- **Inconsistent UI:** Same semantic meaning, different colors
- **Hard to theme:** Change brand color → update 200+ files
- **Accessibility:** Color contrast not validated
- **Brittle:** Tailwind arbitrary values bypass design system

## Decision

**ALL color styling MUST use semantic design tokens from the theme.**

**FORBIDDEN:**
```tsx
// ✗ Arbitrary Tailwind values
className="text-[#111827]"
className="bg-[#0051D5]"

// ✗ Inline styles
style={{ color: '#ff0000' }}
style={{ backgroundColor: 'rgba(0, 81, 213, 0.1)' }}

// ✗ Raw Tailwind color classes (except with dark: variant)
className="text-gray-600"
className="bg-blue-500"
```

**REQUIRED:**
```tsx
// ✓ Semantic tokens
className="text-foreground"
className="bg-card"
className="text-primary"
className="border-border"

// ✓ With opacity
className="bg-primary/10"
className="text-muted-foreground/60"

// ✓ Raw colors with dark mode
className="text-green-600 dark:text-green-400"  // Status indicators
className="bg-blue-50 dark:bg-blue-950"         // Syntax highlighting
```

## Design Token System

### Semantic Tokens (CSS Variables)

Defined in `web/app/globals.css`:

```css
:root {
  --background: 0 0% 100%;           /* Page background */
  --foreground: 222.2 84% 4.9%;      /* Primary text */

  --card: 0 0% 100%;                 /* Card background */
  --card-foreground: 222.2 84% 4.9%; /* Card text */

  --primary: 221.2 83.2% 53.3%;      /* CTAs, links */
  --primary-foreground: 210 40% 98%; /* Text on primary */

  --muted: 210 40% 96.1%;            /* Disabled backgrounds */
  --muted-foreground: 215.4 16.3% 46.9%; /* Secondary text */

  --destructive: 0 84.2% 60.2%;      /* Errors, delete */
  --destructive-foreground: 210 40% 98%; /* Text on destructive */

  --border: 214.3 31.8% 91.4%;       /* Borders */
  --input: 214.3 31.8% 91.4%;        /* Form input borders */
  --ring: 221.2 83.2% 53.3%;         /* Focus rings */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... dark mode values */
}
```

### Token Categories

| Category | Tokens | Usage |
|----------|--------|-------|
| **Layout** | `background`, `foreground` | Page, primary text |
| **Components** | `card`, `card-foreground`, `popover`, `popover-foreground` | Component containers |
| **Actions** | `primary`, `primary-foreground`, `secondary`, `secondary-foreground` | Buttons, links, CTAs |
| **Status** | `destructive`, `destructive-foreground` | Errors, warnings, delete |
| **Interactive** | `accent`, `accent-foreground` | Hover states, highlights |
| **Disabled** | `muted`, `muted-foreground` | Disabled states, helper text |
| **Borders** | `border`, `input`, `ring` | Borders, inputs, focus |

### Status Badges (Special Cases)

Use custom CSS classes with token variables:

```tsx
// In globals.css
.status-badge-success {
  @apply bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300;
}
.status-badge-warning {
  @apply bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300;
}
.status-badge-error {
  @apply bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300;
}

// In component
<Badge className="status-badge-success">Verified</Badge>
<Badge className="status-badge-warning">Pending</Badge>
<Badge className="status-badge-error">Suspended</Badge>
```

## Consequences

### Positive
✅ **Dark mode automatic:** Change theme, all components update
✅ **Consistent UI:** Same semantic meaning = same color
✅ **Easy theming:** Update CSS variables, entire app changes
✅ **Accessible:** Tokens validated for WCAG contrast
✅ **Type-safe:** Tailwind config prevents typos
✅ **Future-proof:** Add new themes without changing components

### Negative
✗ **Learning curve:** Team must learn token names
✗ **Less explicit:** `text-primary` less clear than `text-blue-600`
✗ **Migration effort:** 100+ components need updates

**Trade-off accepted:** Long-term maintainability worth migration effort.

## Compliance Verification

**Detection:**
```bash
# Should return 0 results
grep -rE 'text-\[#|bg-\[#|style.*color:' web/components --include="*.tsx"

# Allowed exceptions (with dark: variant)
grep -rE 'text-(green|red|blue|yellow)-[0-9]' web/components --include="*.tsx" | grep -v 'dark:'
# Should return 0 results
```

**Current Status:** 100/100 (100%)
**Violations:** 0
**Last Migration:** 2025-12-01

## Examples

### ✓ Correct (Design Tokens)

```tsx
// Layout
<div className="bg-background text-foreground">
  Main content
</div>

// Card
<Card className="bg-card text-card-foreground border-border">
  <CardHeader>
    <CardTitle className="text-foreground">Title</CardTitle>
    <CardDescription className="text-muted-foreground">
      Description
    </CardDescription>
  </CardHeader>
  <CardContent>
    Content
  </CardContent>
</Card>

// Button
<Button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Submit
</Button>

// Destructive action
<Button variant="destructive" className="bg-destructive text-destructive-foreground">
  Delete
</Button>

// Muted text
<p className="text-muted-foreground">
  Helper text
</p>

// With opacity
<div className="bg-primary/10 text-primary">
  Highlighted section
</div>

// Status badge (custom class)
<Badge className="status-badge-success">
  Active
</Badge>
```

### ✓ Allowed Exceptions (Status Colors)

```tsx
// Status indicators with dark mode
<div className="flex items-center gap-2">
  <div className="w-2 h-2 rounded-full bg-green-600 dark:bg-green-400" />
  <span className="text-green-600 dark:text-green-400">Online</span>
</div>

// Syntax highlighting
<code className="text-blue-600 dark:text-blue-400">
  function
</code>

// Charts (data visualization)
<Bar fill="hsl(var(--primary))" />
<Bar fill="hsl(var(--destructive))" />
```

### ✗ Forbidden (Hardcoded Colors)

```tsx
// ✗ Arbitrary values
<div className="text-[#1e3a5f] bg-[#f8fafc]">
  Forbidden
</div>

// ✗ Inline styles
<Badge style={{ color: '#0051D5', backgroundColor: '#E3F2FD' }}>
  Forbidden
</Badge>

// ✗ Raw Tailwind colors without dark mode
<div className="text-gray-600 bg-blue-50">
  Forbidden (breaks dark mode)
</div>

// ✗ RGB/HSL inline
<div style={{ color: 'rgb(30, 58, 95)' }}>
  Forbidden
</div>
```

## Token Mapping Guide

For developers migrating old code:

| Old Pattern | New Pattern | Use Case |
|-------------|-------------|----------|
| `text-black` | `text-foreground` | Primary text |
| `text-gray-600` | `text-muted-foreground` | Secondary text |
| `bg-white` | `bg-background` or `bg-card` | Backgrounds |
| `bg-gray-100` | `bg-muted` | Disabled backgrounds |
| `text-blue-600` | `text-primary` | Links, CTAs |
| `bg-red-50 text-red-700` | `className="status-badge-error"` | Error status |
| `border-gray-300` | `border-border` | Borders |
| `text-[#...]` | Find semantic equivalent | None |

## Dynamic Colors from Backend

When backend provides colors (e.g., status badges):

```tsx
// ✓ CORRECT - Use data attribute + CSS
<Badge
  data-status={status.key}
  className="status-badge"
  style={{ '--badge-color': status.color } as React.CSSProperties}
>
  {status.display_name}
</Badge>

// In CSS
.status-badge {
  background-color: color-mix(in srgb, var(--badge-color) 10%, transparent);
  color: var(--badge-color);
}

// ✗ FORBIDDEN - Direct inline style
<Badge style={{ backgroundColor: status.color }}>
```

## Theme Switching

Users can switch between light/dark modes:

```tsx
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Toggle Theme
    </Button>
  );
}

// All components update automatically via CSS variables
```

## Adding New Tokens

If semantic token doesn't exist:

1. Propose token in design review
2. Add to `globals.css`:
   ```css
   :root {
     --new-token: 210 40% 96.1%;
   }
   .dark {
     --new-token: 222.2 47.4% 11.2%;
   }
   ```
3. Add to `tailwind.config.ts`:
   ```ts
   colors: {
     newToken: 'hsl(var(--new-token))',
   }
   ```
4. Use in components: `className="bg-newToken"`

**DO NOT** create one-off arbitrary values.

## Component Library (shadcn/ui)

shadcn/ui components already use design tokens:

```tsx
// ✓ CORRECT - Use shadcn variants
<Button variant="default">Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button variant="ghost">Ghost</Button>

// ✗ FORBIDDEN - Custom styles
<Button className="bg-[#0051D5] text-white">
  Forbidden
</Button>
```

## Migration Checklist

When updating old components:

- [ ] Remove arbitrary Tailwind values (`text-[#...]`, `bg-[#...]`)
- [ ] Remove inline color styles (`style={{ color: '...' }}`)
- [ ] Replace `text-gray-*` with `text-foreground` or `text-muted-foreground`
- [ ] Replace `bg-white/gray-*` with `bg-background/card/muted`
- [ ] Use `status-badge-*` classes for status indicators
- [ ] Add `dark:` variants if using raw colors
- [ ] Test in both light and dark modes

## Accessibility

Design tokens ensure WCAG 2.1 Level AA compliance:

- `foreground` on `background`: 7:1 contrast (AAA)
- `primary-foreground` on `primary`: 4.5:1 minimum
- `card-foreground` on `card`: 7:1 contrast
- All status colors: 4.5:1 minimum

**Validation:**
```bash
npm run check-contrast  # Validates all token combinations
```

## Related Standards

- Frontend Standards: Tailwind + shadcn/ui
- Time Formatting: 12-hour only
- Icons: Lucide React

## Related ADRs

- ADR-004: Lookup Table Normalization (backend provides status colors)
- ADR-002: useApi Pattern (fetch status data with colors)

## Review Checklist

When reviewing PRs:
- [ ] No arbitrary values (`text-[#...]`, `bg-[#...]`)
- [ ] No inline color styles (`style={{ color: ... }}`)
- [ ] Uses semantic tokens (`text-foreground`, `bg-card`, etc.)
- [ ] Status colors have `dark:` variants OR use `status-badge-*`
- [ ] Tested in both light and dark modes
- [ ] No raw `text-gray-*` without `dark:` variant

## Last Audit

**Date:** 2025-12-07
**Result:** 100% compliance (0 violations)
**Components Migrated:** 100/100
**Next Review:** 2026-01-07
