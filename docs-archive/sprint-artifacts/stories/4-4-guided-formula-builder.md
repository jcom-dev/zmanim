# Story 4.4: Guided Formula Builder

**Epic:** Epic 4 - Intuitive Zmanim Algorithm Editor with AI-Powered DSL
**Status:** dev-complete
**Priority:** P1
**Story Points:** 13
**Dependencies:** Story 4.2 (DSL Parser), Story 4.3 (Bilingual Naming)

---

## Story

As a **publisher**,
I want **a visual, guided formula builder using shadcn/ui components**,
So that **I can construct valid DSL formulas without needing to learn syntax**.

---

## Acceptance Criteria

### AC-4.4.1: Formula Builder Layout
- [ ] Split-screen layout: formula builder on left, live preview on right
- [ ] Responsive: stacks vertically on mobile
- [ ] Preview updates in real-time as formula changes (debounced 300ms)

### AC-4.4.2: Base Time Selection
- [ ] Dropdown to select base time primitive (sunrise, sunset, solar_noon, etc.)
- [ ] Options grouped logically (Dawn, Day, Dusk, Night)
- [ ] Selection immediately updates formula

### AC-4.4.3: Method Cards
- [ ] Three method cards: Solar Angle, Fixed Offset, Proportional Hours
- [ ] Visual icons for each method type
- [ ] Only one method selectable at a time
- [ ] Selection reveals method-specific parameters

### AC-4.4.4: Solar Angle Method
- [ ] Slider for degrees (0.5° - 26°)
- [ ] Presets: 16.1° (common), 18° (astronomical), 19.8° (90 min equivalent)
- [ ] Direction toggle: "before sunrise" / "after sunset"
- [ ] Generated formula preview: `solar(16.1, before_sunrise)`

### AC-4.4.5: Fixed Offset Method
- [ ] Number input for minutes (or hours + minutes)
- [ ] Direction selector: "before" / "after"
- [ ] Base time selector (which primitive to offset from)
- [ ] Generated formula preview: `sunrise - 72min`

### AC-4.4.6: Proportional Hours Method
- [ ] Slider for hours (0.5 - 12 in 0.25 increments)
- [ ] Base system selector: GRA, MGA, Custom
- [ ] If Custom: ability to select start/end references
- [ ] Visual day arc diagram showing proportional division
- [ ] Generated formula preview: `shaos(3, gra)`

### AC-4.4.7: Formula Preview
- [ ] Shows generated DSL formula as user builds
- [ ] Syntax highlighted
- [ ] Validation status indicator (green check / red X)
- [ ] Error messages displayed inline

### AC-4.4.8: Live Calculation Preview
- [ ] Shows calculated time for today's date
- [ ] Shows calculated time for user's selected location
- [ ] Updates in real-time as formula changes
- [ ] Loading state while calculating

### AC-4.4.9: Save and Apply
- [ ] "Save" button to save formula to zman definition
- [ ] "Copy to Advanced" button to switch to code editor with formula
- [ ] Confirmation dialog before overwriting existing formula

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Component tests pass for all form controls
- [ ] Integration tests pass for formula generation
- [ ] E2E tests pass for complete builder flow
- [ ] Code review workflow executed (`/bmad:bmm:workflows:code-review`)
- [ ] All generated formulas validated by DSL parser
- [ ] Accessibility audit passes (keyboard navigation, screen readers)

---

## Tasks / Subtasks

- [ ] Task 1: Layout Components (AC: 4.4.1)
  - [ ] 1.1 Create `FormulaBuilder` page component
  - [ ] 1.2 Create split-screen layout with ResizablePanels (shadcn)
  - [ ] 1.3 Add responsive breakpoints for mobile stacking
  - [ ] 1.4 Style with Tailwind following UI wireframes

- [ ] Task 2: Base Time Selection (AC: 4.4.2)
  - [ ] 2.1 Create `BaseTimeSelector` component
  - [ ] 2.2 Use shadcn Select with grouped options
  - [ ] 2.3 Add icons for each time category
  - [ ] 2.4 Wire up state management (Zustand or React state)

- [ ] Task 3: Method Cards (AC: 4.4.3)
  - [ ] 3.1 Create `MethodCard` component
  - [ ] 3.2 Create `MethodSelector` with three cards
  - [ ] 3.3 Add visual icons (Sun, Clock, Scale)
  - [ ] 3.4 Implement mutual exclusion (radio-like behavior)
  - [ ] 3.5 Add expand/collapse animation on selection

- [ ] Task 4: Solar Angle Method (AC: 4.4.4)
  - [ ] 4.1 Create `SolarAngleForm` component
  - [ ] 4.2 Add degree slider with shadcn Slider
  - [ ] 4.3 Add preset buttons for common values
  - [ ] 4.4 Add direction toggle
  - [ ] 4.5 Generate DSL formula from inputs

- [ ] Task 5: Fixed Offset Method (AC: 4.4.5)
  - [ ] 5.1 Create `FixedOffsetForm` component
  - [ ] 5.2 Add duration input (minutes or hours+minutes)
  - [ ] 5.3 Add direction selector
  - [ ] 5.4 Add base time dropdown
  - [ ] 5.5 Generate DSL formula from inputs

- [ ] Task 6: Proportional Hours Method (AC: 4.4.6)
  - [ ] 6.1 Create `ProportionalHoursForm` component
  - [ ] 6.2 Add hours slider with 0.25 increments
  - [ ] 6.3 Add base system selector (GRA/MGA/Custom)
  - [ ] 6.4 Create `DayArcDiagram` visualization component
  - [ ] 6.5 Handle custom base reference selection
  - [ ] 6.6 Generate DSL formula from inputs

- [ ] Task 7: Formula Preview (AC: 4.4.7)
  - [ ] 7.1 Create `FormulaPreview` component
  - [ ] 7.2 Add syntax highlighting (simple token colorization)
  - [ ] 7.3 Add validation status indicator
  - [ ] 7.4 Display validation errors inline

- [ ] Task 8: Live Calculation Preview (AC: 4.4.8)
  - [ ] 8.1 Create `CalculationPreview` component
  - [ ] 8.2 Call `/api/dsl/preview` with debounced formula changes
  - [ ] 8.3 Display calculated time prominently
  - [ ] 8.4 Add loading skeleton while calculating
  - [ ] 8.5 Handle and display calculation errors

- [ ] Task 9: Save Flow (AC: 4.4.9)
  - [ ] 9.1 Add "Save" button with save handler
  - [ ] 9.2 Add "Copy to Advanced" button
  - [ ] 9.3 Create confirmation dialog for overwrites
  - [ ] 9.4 Handle API errors gracefully

- [ ] Task 10: Testing
  - [ ] 10.1 Write component tests for each form
  - [ ] 10.2 Write integration tests for formula generation
  - [ ] 10.3 Write E2E tests for complete flow
  - [ ] 10.4 Run accessibility audit

---

## Dev Notes

### Component Structure

```
web/components/formula-builder/
├── FormulaBuilder.tsx        # Main container
├── BaseTimeSelector.tsx      # Primitive dropdown
├── MethodSelector.tsx        # Method cards
├── MethodCard.tsx            # Individual card
├── methods/
│   ├── SolarAngleForm.tsx
│   ├── FixedOffsetForm.tsx
│   └── ProportionalHoursForm.tsx
├── preview/
│   ├── FormulaPreview.tsx    # DSL display
│   ├── CalculationPreview.tsx # Time result
│   └── DayArcDiagram.tsx     # Visual diagram
└── index.ts
```

### State Management

```tsx
// Using React state or Zustand
interface FormulaBuilderState {
  baseTime: string;           // 'sunrise', 'sunset', etc.
  method: 'solar' | 'fixed' | 'proportional' | null;

  // Solar angle params
  solarDegrees: number;
  solarDirection: 'before_sunrise' | 'after_sunset';

  // Fixed offset params
  offsetMinutes: number;
  offsetDirection: 'before' | 'after';
  offsetBase: string;

  // Proportional params
  shaosHours: number;
  shaosBase: 'gra' | 'mga' | 'custom';
  customStart?: string;
  customEnd?: string;

  // Derived
  generatedFormula: string;
  validationErrors: string[];
}
```

### Formula Generation Logic

```tsx
function generateFormula(state: FormulaBuilderState): string {
  switch (state.method) {
    case 'solar':
      return `solar(${state.solarDegrees}, ${state.solarDirection})`;

    case 'fixed':
      const op = state.offsetDirection === 'before' ? '-' : '+';
      return `${state.offsetBase} ${op} ${state.offsetMinutes}min`;

    case 'proportional':
      if (state.shaosBase === 'custom') {
        return `shaos(${state.shaosHours}, custom(@${state.customStart}, @${state.customEnd}))`;
      }
      return `shaos(${state.shaosHours}, ${state.shaosBase})`;

    default:
      return state.baseTime;
  }
}
```

### Day Arc Diagram (SVG)

```tsx
// Visual representation of proportional hours
function DayArcDiagram({ hours, base }: { hours: number; base: string }) {
  // SVG arc showing:
  // - Full day from alos to tzais (MGA) or sunrise to sunset (GRA)
  // - Tick marks for each hour
  // - Highlighted segment showing selected hours
  // - Sun position indicator
}
```

### UI Wireframe Reference

From `epic-4-ui-wireframes.md`:
- Split screen: 60% builder, 40% preview
- Method cards with icons and descriptions
- Slider with labeled tick marks
- Live preview with time in large font

### References

- [Source: docs/sprint-artifacts/epic-4-comprehensive-plan.md#Story 4.4]
- [Source: docs/sprint-artifacts/epic-4-ui-wireframes.md#Guided Mode Wireframe]
- [shadcn/ui Components](https://ui.shadcn.com/)

---

## Testing Requirements

### Unit Tests (TypeScript)
- [ ] `generateFormula` produces correct DSL for all methods
- [ ] Slider values map correctly to formula parameters
- [ ] Validation catches invalid inputs

### Component Tests (React Testing Library)
- [ ] BaseTimeSelector renders all options
- [ ] MethodCard selection state works correctly
- [ ] SolarAngleForm slider updates formula
- [ ] FixedOffsetForm generates correct formula
- [ ] ProportionalHoursForm handles custom base

### Integration Tests
- [ ] Formula builder connects to DSL validation API
- [ ] Preview updates with debounced API calls
- [ ] Save flow updates database correctly

### E2E Tests (Playwright)
- [ ] Publisher can build solar angle formula
- [ ] Publisher can build fixed offset formula
- [ ] Publisher can build proportional hours formula
- [ ] Preview shows correct calculated time
- [ ] Publisher can save formula to zman
- [ ] Formula can be copied to advanced editor

### Accessibility Tests
- [ ] All controls keyboard navigable
- [ ] ARIA labels on interactive elements
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader announces formula changes

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/4-4-guided-formula-builder.context.xml
- docs/sprint-artifacts/epic-4-comprehensive-plan.md
- docs/sprint-artifacts/epic-4-ui-wireframes.md

### Agent Model Used
(To be filled by dev agent)

### Completion Notes
(To be filled upon completion)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-28 | Story created from Epic 4 comprehensive plan | Party Mode Team |
| 2025-11-28 | Story context generated | Winston (Architect) |
