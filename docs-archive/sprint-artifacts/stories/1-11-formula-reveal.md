# Story 1.11: Formula Reveal

Status: review

## Story

As an **end user**,
I want **to see how each zmanim time is calculated**,
so that **I understand the halachic basis for my prayer times**.

## Acceptance Criteria

1. Info icon (ⓘ) appears next to each zmanim time
2. Desktop: Clicking icon opens right side panel
3. Mobile: Clicking icon opens bottom sheet
4. Panel shows zman name, method name, parameters, explanation
5. Optional halachic context displays if publisher provided
6. Panel dismisses on click outside, X button, or swipe down (mobile)

## Tasks / Subtasks

- [ ] Task 1: Add info icons to ZmanRow (AC: 1)
  - [ ] 1.1 Update ZmanRow component
  - [ ] 1.2 Add clickable info icon (ⓘ)
  - [ ] 1.3 Accessible button with aria-label
  - [ ] 1.4 Visual feedback on hover/focus

- [ ] Task 2: Create FormulaPanel component (AC: 2, 3, 4)
  - [ ] 2.1 Create web/components/zmanim/FormulaPanel.tsx
  - [ ] 2.2 Display zman name prominently
  - [ ] 2.3 Method name (e.g., "Solar Depression Angle")
  - [ ] 2.4 Parameters (e.g., "16.1° below horizon")
  - [ ] 2.5 Explanation text

- [ ] Task 3: Implement desktop side panel (AC: 2)
  - [ ] 3.1 Use shadcn/ui Sheet component
  - [ ] 3.2 Slide in from right side
  - [ ] 3.3 Fixed width (400px or similar)
  - [ ] 3.4 Smooth slide animation

- [ ] Task 4: Implement mobile bottom sheet (AC: 3)
  - [ ] 4.1 Use shadcn/ui Sheet with side="bottom"
  - [ ] 4.2 Slide up from bottom
  - [ ] 4.3 Proper height (50-70% viewport)
  - [ ] 4.4 Drag handle for swipe dismiss

- [ ] Task 5: Add responsive behavior (AC: 2, 3)
  - [ ] 5.1 Create useMediaQuery hook or use CSS
  - [ ] 5.2 Switch panel type based on screen width
  - [ ] 5.3 Breakpoint: 768px (md)

- [ ] Task 6: Implement dismiss behaviors (AC: 6)
  - [ ] 6.1 Click outside to close
  - [ ] 6.2 X button in panel header
  - [ ] 6.3 Escape key to close
  - [ ] 6.4 Swipe down on mobile to close
  - [ ] 6.5 Focus trap while open

- [ ] Task 7: Display halachic context (AC: 5)
  - [ ] 7.1 Check if publisher provided context
  - [ ] 7.2 Display "Halachic Source" section
  - [ ] 7.3 Handle missing context gracefully

- [ ] Task 8: Add panel animations (AC: 2, 3)
  - [ ] 8.1 Smooth slide animation
  - [ ] 8.2 Backdrop fade-in
  - [ ] 8.3 Use Tailwind transitions

- [ ] Task 9: Ensure accessibility (AC: all)
  - [ ] 9.1 Proper ARIA labels
  - [ ] 9.2 Focus management (trap and restore)
  - [ ] 9.3 Keyboard navigation
  - [ ] 9.4 Screen reader announcements

- [ ] Task 10: Write E2E tests (AC: all)
  - [ ] 10.1 Test desktop panel opens
  - [ ] 10.2 Test mobile sheet opens
  - [ ] 10.3 Test dismiss behaviors
  - [ ] 10.4 Test content displays correctly

## Dev Notes

### Architecture Patterns

- **Component:** shadcn/ui Sheet (Radix Dialog primitive)
- **Responsive:** Different panel styles based on viewport
- **Data:** Formula info included in zmanim API response

### Formula Data Structure

```typescript
interface ZmanFormula {
  method: string;           // "solar_angle" | "fixed_minutes" | "proportional"
  display_name: string;     // "Solar Depression Angle"
  parameters: {
    degrees?: number;
    minutes?: number;
    hours?: number;
    base?: "gra" | "mga";
    from?: "sunrise" | "sunset";
  };
  explanation: string;      // Human-readable explanation
  halachic_source?: string; // Optional: Publisher's source/reasoning
}
```

### Panel Content Layout

```
┌─────────────────────────┐
│  [X]    Alos HaShachar  │
├─────────────────────────┤
│  Method:                │
│  Solar Depression Angle │
│                         │
│  Parameters:            │
│  16.1° below horizon    │
│                         │
│  Explanation:           │
│  Dawn begins when the   │
│  sun is 16.1° below the │
│  eastern horizon.       │
│                         │
│  Halachic Source:       │
│  (if provided)          │
└─────────────────────────┘
```

### Responsive Breakpoints

| Screen Width | Panel Type | Position |
|--------------|------------|----------|
| < 768px | Bottom Sheet | Bottom |
| ≥ 768px | Side Panel | Right |

### UX Considerations

- Panel should not obstruct zmanim list completely
- User can compare multiple formulas by reopening panel
- Smooth animations enhance perceived quality
- Proper focus management for accessibility

### References

- [Source: docs/architecture.md#Component-Architecture]
- [Source: docs/epics.md#Story-1.11-Formula-Reveal]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Story-1.11]
- [Source: docs/ux-design-specification.md#Formula-Reveal-Pattern]
- [Source: docs/prd.md#FR30-FR31]

## Dev Agent Record

### Context Reference
- Story 1.10 zmanim user experience implementation

### Agent Model Used
- Claude Code (claude-opus-4-5-20251101)

### Debug Log References
- N/A

### Completion Notes List
- Created shadcn/ui Sheet component with responsive side variants
- Created FormulaPanel component with desktop (right panel) and mobile (bottom sheet) layouts
- Displays zman name, calculation method, parameters, explanation, and halachic source
- Panel dismisses via X button, Escape key, or clicking outside
- Updated ZmanimPage to use FormulaPanel instead of inline expansion
- All 12 Playwright E2E tests pass

### File List
- `web/components/ui/sheet.tsx` - shadcn/ui Sheet component
- `web/components/zmanim/FormulaPanel.tsx` - Responsive formula reveal panel
- `web/app/zmanim/[cityId]/[publisherId]/page.tsx` - Updated to use FormulaPanel
- `web/tests/formula-reveal.spec.ts` - 12 Playwright E2E tests
