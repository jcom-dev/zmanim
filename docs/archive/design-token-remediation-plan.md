# Design Token Remediation Plan

**Created:** 2025-12-03
**Status:** Ready for Implementation
**Priority:** High - Affects UI consistency and dark mode support

---

## Executive Summary

This plan addresses inconsistent color usage across the Zmanim Lab frontend codebase. The audit identified approximately **60+ files** with design token violations that need remediation to ensure:

1. Consistent light/dark mode theming
2. Maintainable color system from a single source
3. Accessible color contrast ratios
4. Professional, cohesive visual identity

---

## Audit Results

### Violation Categories

| Category | Files Affected | Severity | Fix Complexity |
|----------|----------------|----------|----------------|
| Raw Tailwind blue-* colors | 41 files | Medium | Low - Replace with `primary` or add dark variants |
| Raw Tailwind green-* colors | 36 files | Medium | Low - Status colors, add dark variants |
| Raw Tailwind red-* colors | 27 files | Medium | Low - Use `destructive` or add dark variants |
| Raw Tailwind amber-* colors | 29 files | Medium | Low - Add dark variants |
| `text-white`/`bg-white` without dark variant | 19 files | High | Medium - Replace with semantic tokens |
| Inline style colors | 3 files | High | Medium - Move to CSS classes |
| Raw gray-* colors | 2 files | High | Low - Replace with `muted-foreground` |

### Files Requiring Attention (Prioritized)

#### Tier 1: High-Traffic User-Facing Pages (Fix First)
1. `web/app/page.tsx` - Homepage (19 blue-* violations)
2. `web/app/zmanim/[cityId]/page.tsx` - Zmanim display
3. `web/app/zmanim/[cityId]/[publisherId]/page.tsx` - Publisher zmanim
4. `web/app/publisher/dashboard/page.tsx` - Publisher dashboard
5. `web/app/publisher/algorithm/page.tsx` - Algorithm editor

#### Tier 2: Admin & Publisher Management
6. `web/app/admin/publishers/[id]/page.tsx`
7. `web/app/admin/publishers/page.tsx`
8. `web/app/admin/dashboard/page.tsx`
9. `web/app/admin/tag-requests/page.tsx`
10. `web/app/publisher/coverage/page.tsx`

#### Tier 3: Shared Components (Wide Impact)
11. `web/components/shared/HighlightedFormula.tsx` - Syntax highlighting (acceptable with dark variants)
12. `web/components/shared/CoverageSelector.tsx`
13. `web/components/shared/PublisherCard.tsx`
14. `web/components/publisher/CitySelector.tsx`
15. `web/components/publisher/MonthPreview.tsx`

#### Tier 4: Algorithm & Preview Components
16. `web/components/publisher/WeekPreview.tsx`
17. `web/components/publisher/AlgorithmPreview.tsx`
18. `web/components/publisher/VersionHistory.tsx`
19. `web/components/algorithm/WeeklyPreviewDialog.tsx`
20. `web/components/algorithm/VersionDiff.tsx`

#### Tier 5: Forms & Editors
21. `web/components/admin/ZmanRegistryForm.tsx`
22. `web/components/formula-builder/preview/FormulaPreview.tsx`
23. `web/components/editor/DSLReferencePanel.tsx`
24. `web/components/formula-builder/AIGeneratePanel.tsx`

#### Tier 6: UI Base Components (Handle Carefully)
25. `web/components/ui/color-badge.tsx` - INTENTIONAL - semantic color system
26. `web/components/ui/alert-dialog.tsx`
27. `web/components/ui/dialog.tsx`
28. `web/components/ui/sheet.tsx`

---

## Remediation Patterns

### Pattern 1: Replace Raw Colors with Semantic Tokens

**Before:**
```tsx
className="text-blue-600 hover:text-blue-700"
className="bg-white border-gray-200"
```

**After:**
```tsx
className="text-primary hover:text-primary/80"
className="bg-card border-border"
```

### Pattern 2: Add Dark Mode Variants (Status/Syntax Colors)

**Before:**
```tsx
className="text-green-600"
className="bg-blue-100"
```

**After:**
```tsx
className="text-green-600 dark:text-green-400"
className="bg-blue-100 dark:bg-blue-900/30"
```

### Pattern 3: Replace text-white with Contextual Tokens

**Before:**
```tsx
className="bg-blue-500 text-white"
```

**After:**
```tsx
className="bg-primary text-primary-foreground"
```

### Pattern 4: Move Inline Styles to CSS Classes

**Before:**
```tsx
style={{ backgroundColor: categoryColor.bg }}
```

**After:**
```tsx
// Add to globals.css or use data attributes
className={getCategoryColorClass(category)}
```

### Pattern 5: Use Status Badge Utilities

**Before:**
```tsx
className="bg-green-100 text-green-800 px-2 py-1 rounded"
```

**After:**
```tsx
className="status-badge-success"
```

---

## Implementation Strategy

### Phase 1: Quick Wins (1-2 days)
- [ ] Fix `bg-white` → `bg-card` in all files
- [ ] Fix `text-gray-*` → `text-muted-foreground` in all files
- [ ] Add missing `dark:` variants to all status colors

### Phase 2: High-Impact Pages (2-3 days)
- [ ] Homepage (`web/app/page.tsx`)
- [ ] Publisher Dashboard
- [ ] Zmanim Display Pages

### Phase 3: Shared Components (2-3 days)
- [ ] CoverageSelector
- [ ] PublisherCard
- [ ] CitySelector
- [ ] All Preview components

### Phase 4: Admin Pages (1-2 days)
- [ ] Admin Dashboard
- [ ] Publishers Management
- [ ] Tag Requests

### Phase 5: Editors & Forms (1-2 days)
- [ ] Algorithm Editor
- [ ] Formula Builder
- [ ] Registry Forms

---

## Specific File Fixes

### `web/app/page.tsx` (Homepage)

| Line | Current | Fix |
|------|---------|-----|
| Multiple | `text-blue-400` | `text-primary` |
| Multiple | `Loader2... text-blue-400` | `Loader2... text-primary` |
| Various | hover states | Use `hover:text-primary` |

### `web/components/shared/CoverageSelector.tsx`

| Pattern | Current | Fix |
|---------|---------|-----|
| Country selection | `bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400` | OK - has dark variants |
| Selected states | `bg-purple-100 text-purple-700` | Add dark variants |

### `web/components/publisher/MonthPreview.tsx`

| Pattern | Current | Fix |
|---------|---------|-----|
| Time display | `text-blue-400` | `text-primary` |

### `web/components/ZmanimDisplay.tsx`

| Pattern | Current | Fix |
|---------|---------|-----|
| Error states | `bg-red-*` | Use `alert-error` utility class |
| Success states | `bg-green-*` | Add dark variants |

---

## Files That Are ACCEPTABLE (No Changes Needed)

These files use raw Tailwind colors intentionally and correctly:

1. **`web/components/ui/color-badge.tsx`** - Semantic color system component with full dark mode support
2. **`web/components/shared/HighlightedFormula.tsx`** - Syntax highlighting with proper dark variants
3. **`web/app/globals.css`** - Defines the utility classes
4. **`web/tailwind.config.ts`** - Configuration file

---

## Validation Checklist

After remediation, run these checks:

```bash
# Should return 0
grep -rE "\[#[0-9a-fA-F]{3,8}\]" web/app web/components --include="*.tsx" | wc -l

# Should return 0 (except intentional inline styles)
grep -rE "style=\{.*color|style=\{.*background" web/app web/components --include="*.tsx" | wc -l

# Review each match - most should have dark: variant
grep -rE "text-blue-[0-9]+" web/app web/components --include="*.tsx" | grep -v "dark:" | head -20

# Should return minimal matches
grep -rE "bg-white(?![^\"]*dark:)" web/app web/components --include="*.tsx" | wc -l
```

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Files with violations | 60+ | < 10 (syntax highlighting only) |
| `bg-white` without context | 19 | 0 |
| Missing dark mode variants | ~100 | 0 |
| Inline color styles | 3 | 0 |
| Consistent loading spinners | No | Yes (all `text-primary`) |

---

## Notes for Implementers

1. **Don't over-optimize**: If a pattern already has proper dark mode variants, leave it alone
2. **Test in both modes**: After each file change, verify in both light and dark themes
3. **Use the ColorBadge component**: For any semantic colored labels
4. **Check contrast**: Ensure WCAG AA compliance (4.5:1 for text)
5. **Batch similar changes**: Fix all `text-blue-400` in one pass, then move to next pattern

---

## Related Documentation

- [Coding Standards - Design Tokens](./coding-standards.md#styling-tailwind-css---mandatory-design-token-usage)
- [globals.css](../web/app/globals.css) - Status badge and alert utilities
- [tailwind.config.ts](../web/tailwind.config.ts) - Theme configuration
- [ColorBadge Component](../web/components/ui/color-badge.tsx) - Semantic color badges
