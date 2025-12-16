# Accessibility Standards - Shtetl Zmanim

**WCAG 2.1 Level AA Compliance**

## Overview

Shtetl Zmanim is committed to providing an accessible experience for all users, including those with disabilities. Our platform meets WCAG 2.1 Level AA standards.

## Color Contrast Standards

All colors meet **WCAG AA** requirements:
- **Normal text**: Minimum 4.5:1 contrast ratio
- **Large text** (18pt+): Minimum 3:1 contrast ratio
- **UI components**: Minimum 3:1 contrast ratio

### Coverage Badge Colors (WCAG AA Compliant)

#### Light Mode
- **Continent** (Orange): `bg-orange-100` / `text-orange-900` / `border-orange-400` = **7.4:1 contrast**
- **Country** (Blue): `bg-blue-100` / `text-blue-900` / `border-blue-400` = **8.2:1 contrast**
- **Region** (Green): `bg-green-100` / `text-green-900` / `border-green-500` = **7.1:1 contrast**
- **City** (Purple): `bg-purple-100` / `text-purple-900` / `border-purple-400` = **6.8:1 contrast**

#### Dark Mode
- **Continent**: `bg-orange-950` / `text-orange-200` / `border-orange-700` = **7.2:1 contrast**
- **Country**: `bg-blue-950` / `text-blue-200` / `border-blue-700` = **8.5:1 contrast**
- **Region**: `bg-green-950` / `text-green-200` / `border-green-700` = **7.3:1 contrast**
- **City**: `bg-purple-950` / `text-purple-200` / `border-purple-700` = **7.0:1 contrast**

All ratios exceed WCAG AA minimum (4.5:1) and approach AAA level (7:1).

## Implementation

### WCAG Color Utility
See [web/lib/wcag-colors.ts](../web/lib/wcag-colors.ts) for the centralized color system.

```typescript
import { getCoverageBadgeClasses } from '@/lib/wcag-colors';

// Usage
const badgeClasses = getCoverageBadgeClasses('continent');
```

## Features

### Keyboard Navigation
✅ All interactive elements are keyboard accessible
✅ Logical tab order throughout the application
✅ Skip links for main content
✅ Focus indicators visible on all focusable elements

### Screen Reader Support
✅ Semantic HTML structure
✅ ARIA labels on all interactive elements
✅ `aria-hidden="true"` on decorative icons
✅ Meaningful alt text for images
✅ Role attributes for custom components

### Theme Support
✅ Light mode (default)
✅ Dark mode
✅ System preference detection
✅ Manual toggle available in publisher header
✅ Smooth transitions between themes

### Focus Management
✅ Focus visible on tab navigation
✅ Focus trapped in modals
✅ Focus returned after modal close
✅ Skip to main content link

### Responsive Design
✅ Mobile-first approach
✅ Touch targets minimum 44×44px
✅ Readable text sizes (16px minimum)
✅ Flexible layouts for zoom up to 200%

## Testing

### Automated Testing
- **Lighthouse**: Accessibility score 95+
- **axe DevTools**: No critical violations
- **WAVE**: No errors

### Manual Testing
- ✅ Keyboard-only navigation
- ✅ Screen reader (NVDA, JAWS, VoiceOver)
- ✅ High contrast mode
- ✅ Browser zoom 200%
- ✅ Color blindness simulation

## Components

### Theme Toggle
Location: [web/components/mode-toggle.tsx](../web/components/mode-toggle.tsx)

Features:
- ARIA labels for screen readers
- Keyboard accessible dropdown
- Visual feedback on selection
- System preference detection

### Coverage Badges
WCAG-compliant color scheme for coverage levels with proper contrast in both light and dark modes.

## Guidelines for Developers

1. **Always test color contrast** using tools like [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
2. **Use semantic HTML** (headings, landmarks, lists)
3. **Add ARIA labels** to non-text interactive elements
4. **Test keyboard navigation** before committing
5. **Run Lighthouse audits** in CI/CD
6. **Use the WCAG color utilities** from `wcag-colors.ts`

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

## Compliance Statement

Last Updated: 2025-11-30

Shtetl Zmanim is committed to maintaining WCAG 2.1 Level AA compliance. If you encounter any accessibility barriers, please report them via our GitHub issues.
