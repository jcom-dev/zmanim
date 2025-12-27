# Shtetl Zmanim UX Design Specification

_Created on 2025-11-25 by BMad_
_Generated using BMad Method - Create UX Design Workflow v1.0_

---

## Executive Summary

**Vision:** Democratize zmanim publishing with halachic transparency - any qualified authority can publish their calculations, and end users gain unprecedented insight into how their Zmanim are determined.

**Target Users:**
- **Publishers (Halachic Authorities):** Should feel empowered and in control, yet confident and guided through algorithm configuration
- **End Users (Community Members):** Should feel enlightened and curious (learning about zmanim) while remaining efficient and informed (quickly getting accurate times)

**Core Experience:** Location (city) → Publisher → Zmanim Times → Educational Formula Reveal

**Platform:** Web application (Next.js frontend, responsive)

---

## 1. Design System Foundation

### 1.1 Design System Choice

**Selected:** shadcn/ui

**Rationale:**
- Already in existing codebase
- Radix primitives provide excellent accessibility
- Tailwind-based, fully customizable
- Copy-paste model means full ownership of components
- Clean aesthetic aligns with Apple-inspired direction

**Components from shadcn/ui:**
- Button, Input, Select, Dialog, Popover
- Card, Badge, Separator
- Dropdown Menu, Command (for intellisense)
- Skeleton (for loading states)

---

## 2. Visual Foundation

### 2.1 Color System: Midnight Trust

**Personality:** Professional, reliable, trustworthy

```css
:root {
  /* Primary */
  --primary: #1e3a5f;
  --primary-light: #2d5a8a;
  --primary-muted: #5a7a9a;

  /* Backgrounds */
  --bg-subtle: #f0f4f8;
  --bg-card: #ffffff;

  /* Borders */
  --border: #d0dce8;

  /* Text */
  --text: #1e3a5f;
  --text-muted: #5a7a9a;

  /* Semantic */
  --success: #16a34a;
  --warning: #d97706;
  --error: #dc2626;
  --info: #2563eb;
}
```

### 2.2 Typography

- **Font Family:** System fonts (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto)
- **Scale:** Default Tailwind scale
- **Weights:** 400 (body), 500 (labels), 600 (headings)

### 2.3 Spacing

- **Base unit:** 4px
- **Scale:** Tailwind default (4, 8, 12, 16, 20, 24, 32, 40, 48...)
- **Border radius:** 10px (inputs), 12px (cards), 16px (large cards)

---

## 3. Core User Experience

### 3.1 Design Philosophy

**"Invisible Complexity"** - Sophisticated astronomical calculations behind simple, intuitive UI.

**Core Principles:**
| Principle | Decision | Rationale |
|-----------|----------|-----------|
| Speed | Instant time display, panels load <200ms | Daily use demands efficiency |
| Guidance | Progressive - simple default, depth on demand | Balance enlightened + efficient |
| Flexibility | Publishers have full control, users get clean defaults | Empower without overwhelming |
| Feedback | Subtle animations, no celebratory excess | Respectful, understated |

### 3.2 Inspiration Sources

- **Apple Apps:** Clean UI, minimal clutter, clarity and deference to content
- **Sefaria:** Side panel reveals, interconnected educational content, open-source community vibe

---

## 4. Novel UX Pattern: Educational Formula Reveal

### 4.1 Pattern Definition

**Purpose:** Allow users to understand the halachic basis for each zmanim time

**Trigger:** Info icon (ⓘ) next to each time

**Content (Medium depth):**
- Method name (e.g., "Solar Depression Angle")
- Parameters (e.g., "16.1° below horizon")
- Halachic context (optional - only if publisher provided)

**Behavior:**
- Desktop: Side panel slides in from right
- Mobile: Bottom sheet slides up
- Dismissal: Tap outside, X button, or swipe down (mobile)

### 4.2 Visual Specification

```
┌──────────────────────────┐
│  ✕  Alos HaShachar       │
│                          │
│  METHOD                  │
│  Solar Depression Angle  │
│                          │
│  PARAMETERS              │
│  16.1° below horizon     │
│                          │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │  ← Only if provided
│  HALACHIC CONTEXT        │
│  "Based on the opinion   │
│  that dawn begins..."    │
└──────────────────────────┘
```

---

## 5. Layout & Navigation

### 5.1 End User - Zmanim View

**Desktop (≥768px):** Two-column during selection, full-width after publisher chosen

**Selection Phase:**
```
┌─────────────────────┬────────────────────────────┐
│  Location           │  Publishers                │
│  [City search]      │  [Publisher cards]         │
└─────────────────────┴────────────────────────────┘
```

**Viewing Phase (after publisher selected):**
```
┌─────────────────────────────────────────────────────────────────┐
│  Shtetl Zmanim                     Jerusalem  ▾    [Change]        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│              Tuesday, November 25, 2025            ← →          │
│                                                                 │
│              Alos HaShachar              5:23 AM   ⓘ           │
│              Misheyakir                  5:47 AM   ⓘ           │
│              Sunrise                     6:18 AM   ⓘ           │
│              ...                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Mobile (<768px):** Single column, stacked flow

### 5.2 Publisher - Algorithm Configuration

**Layout:** Single column list of zmanim

**Interaction:** Click zman → Modal with intellisense editor

```
┌─────────────────────────────────────────────────────────────────┐
│  Configure: Alos HaShachar                               ✕     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ solar_angle(16.1)                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Suggestions:                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ solar_angle(degrees)       - Sun below horizon          │   │
│  │ minutes_before(sunrise, n) - Fixed minutes              │   │
│  │ proportional(start, end, fraction)                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Live Preview: 5:23 AM (Nov 25, Jerusalem)                     │
│                                                                 │
│                              [Cancel]  [Save]                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. User Journey Flows

### 6.1 End User - Find Zmanim

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────┐    ┌──────────────┐
│ Select City │ →  │ Select Publisher │ →  │ View Zmanim │ →  │ Reveal Formula│
└─────────────┘    └──────────────────┘    └─────────────┘    └──────────────┘
                          │                                          │
                          ▼                                          │
                   (If no local                                      │
                    authority)                                       │
                          │                                          │
                          ▼                                          │
              ┌─────────────────────┐                                │
              │ Show Default        │ ←──────────────────────────────┘
              │ (Non-authoritative) │
              │ + Request CTA       │
              └─────────────────────┘
```

**Location Model:**
- Hierarchy: Country → State → City
- Users always select at city level
- Publishers can cover: country, state, city, or multiple
- Database seeded with global cities

### 6.2 Default Publisher Warning

When no authoritative publisher covers a location:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  No local halachic authority covers this area yet.         │
│                                                                 │
│  Showing standard calculations (not authoritative).            │
│  Consult your local rabbi for halachic guidance.               │
│                                                                 │
│  [Request your authority join Shtetl Zmanim]                      │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Publisher - Configure Algorithm

```
┌───────┐    ┌───────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────┐
│ Login │ →  │ Dashboard │ →  │ Select Zman │ →  │ Edit (Modal)│ →  │ Save │
└───────┘    └───────────┘    └─────────────┘    └─────────────┘    └──────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │ Intellisense    │
                                              │ + Live Preview  │
                                              └─────────────────┘
```

---

## 7. Component Library

### 7.1 From shadcn/ui (standard)

- Button (primary, secondary, ghost)
- Input, Select, Command (intellisense)
- Card, Dialog, Popover
- Skeleton, Badge, Separator

### 7.2 Custom Components

| Component | Purpose |
|-----------|---------|
| ZmanRow | Single zmanim time with info icon |
| FormulaPanel | Side panel / bottom sheet for formula reveal |
| PublisherCard | Publisher selection card |
| LocationPicker | City search with autocomplete |
| AlgorithmEditor | Intellisense-based formula editor |
| NonAuthoritativeWarning | Default publisher disclaimer |

---

## 8. UX Pattern Decisions

### 8.1 Forms & Validation

| Pattern | Decision |
|---------|----------|
| Validation timing | Inline on blur |
| Error display | Inline below field |
| Required indicator | Asterisk (*) |
| Help text | Caption below field |

### 8.2 Feedback Patterns

| Pattern | Decision |
|---------|----------|
| Loading | Skeleton loaders |
| Success | Toast notification (top-right) |
| Error | Inline + toast for critical |
| Empty state | Helpful message + CTA |

### 8.3 Modal Patterns

| Pattern | Decision |
|---------|----------|
| Dismissal | Click outside OR X button |
| Mobile | Bottom sheet |
| Focus | Auto-focus first input |

### 8.4 Navigation Patterns

| Pattern | Decision |
|---------|----------|
| Remember location | Yes (localStorage) |
| Back behavior | Browser back |
| Active state | Primary color underline |

---

## 9. Responsive Design

### 9.1 Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 768px | Single column |
| Desktop | ≥ 768px | Two column (where applicable) |

### 9.2 Responsive Adaptations

| Element | Mobile | Desktop |
|---------|--------|---------|
| Formula reveal | Bottom sheet | Side panel |
| Publisher selection | Full screen | Inline cards |
| Navigation | Hamburger menu | Inline links |
| Zmanim list | Full width | Centered, max-width |

---

## 10. Accessibility

### 10.1 Compliance Target

**WCAG 2.1 Level AA**

### 10.2 Requirements

| Requirement | Implementation |
|-------------|----------------|
| Color contrast | 4.5:1 minimum (Midnight Trust meets this) |
| Keyboard navigation | All interactive elements focusable |
| Focus indicators | Visible focus ring on all elements |
| Screen reader | ARIA labels on icons, semantic HTML |
| Touch targets | Minimum 44x44px on mobile |

### 10.3 Testing Strategy

- Automated: Lighthouse, axe DevTools
- Manual: Keyboard-only navigation
- Screen reader: VoiceOver / NVDA testing

---

## 11. Implementation Summary

### 11.1 Key Decisions

| Decision | Choice |
|----------|--------|
| Design System | shadcn/ui |
| Color Theme | Midnight Trust (#1e3a5f primary) |
| Layout | Two-column desktop, single-column mobile |
| Formula Reveal | Info icon → side panel (desktop) / bottom sheet (mobile) |
| Publisher Config | Single column + modal with intellisense editor |
| Validation | Inline on blur |
| Loading | Skeleton loaders |
| Persistence | Remember last city (localStorage) |
| Accessibility | WCAG 2.1 AA |

### 11.2 Design Principles Summary

1. **Invisible Complexity** - Simple UI, powerful calculations behind
2. **Progressive Disclosure** - Show times simply, reveal depth on demand
3. **Trust Through Transparency** - Every time traceable to its formula
4. **Publisher Authority** - Clear distinction between authoritative and default
5. **Educational** - Formula reveal teaches, not just informs

---

## Appendix

### Related Documents

- Product Requirements: `docs/prd.md`

### Version History

| Date       | Version | Changes                         | Author |
| ---------- | ------- | ------------------------------- | ------ |
| 2025-11-25 | 1.0     | Initial UX Design Specification | BMad   |

---

_This UX Design Specification was created through collaborative design facilitation. All decisions were made with user input and documented with rationale._
