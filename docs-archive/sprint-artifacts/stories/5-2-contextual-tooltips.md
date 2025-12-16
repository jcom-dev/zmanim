# Story 5.2: Contextual Tooltips in DSL Editor

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** todo
**Priority:** P1
**Story Points:** 8
**Dependencies:** Story 5.1 (Human-Friendly Error Messages)
**FRs:** FR97 (Contextual tooltips in DSL editor)

---

## Standards Reference

See `docs/coding-standards.md` sections:
- "Frontend Standards > Component Structure" (hook ordering, state management)
- "Frontend Standards > Styling with Tailwind" (use design tokens)
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Edge Cases to Handle:**
- Nested parentheses: `solar(midpoint(a, b), before_sunrise)` - detect innermost context
- Viewport boundaries: tooltip should flip above/below based on available space
- Performance: debounce cursor updates to prevent lag on fast typing

---

## Story

As a **non-technical publisher**,
I want **helpful hints that appear exactly where my cursor is**,
So that **I know what values to type without looking at documentation**.

---

## Acceptance Criteria

### AC-5.2.1: DSL Context Helper
- [ ] `web/lib/dsl-context-helper.ts` created
- [ ] Parses cursor position to determine context (function, parameter index)
- [ ] Returns context type: 'solar_degrees', 'solar_direction', 'hours', 'base', 'empty_editor', etc.
- [ ] Handles nested parentheses correctly

### AC-5.2.2: Solar Degrees Tooltip
- [ ] Appears when cursor is after `solar(` (first parameter position)
- [ ] Title: "📐 Degrees: Sun angle below horizon (0-90)"
- [ ] Shows common values: 8.5° (tzeis), 11° (misheyakir), 16.1° (alos), 18° (astronomical)
- [ ] Instruction: "Type a number, e.g., 16.1"

### AC-5.2.3: Solar Direction Tooltip
- [ ] Appears when cursor is after comma in `solar(X,` (second parameter position)
- [ ] Title: "🧭 Direction: When does this angle occur?"
- [ ] Shows clickable buttons: before_sunrise, after_sunset, before_noon, after_noon
- [ ] Clicking button inserts value at cursor

### AC-5.2.4: Proportional Hours Tooltip
- [ ] Appears when cursor is after `proportional_hours(`
- [ ] Shows hour values: 3 (Shema), 4 (Tefila), 6 (Chatzos), 9.5 (Mincha Ketana), 10.75 (Plag)
- [ ] Second parameter shows base options: gra, mga, mga_90, mga_120

### AC-5.2.5: Tooltip Behavior
- [ ] Appears 100ms after cursor enters trigger zone
- [ ] Dismisses on: Escape key, click outside, continue typing
- [ ] Clicking option inserts value and dismisses tooltip
- [ ] Position: above cursor line (or below if near top)
- [ ] Mobile: tap to show, tap option to insert

### AC-5.2.6: Empty Editor Tooltip
- [ ] Appears after 2 seconds in empty editor
- [ ] Shows quick start examples: `sunrise - 72min`, `solar(16.1, before_sunrise)`, etc.
- [ ] "Or pick from reference panel →" guidance

### AC-5.2.7: Keyboard Accessibility
- [ ] Arrow keys navigate tooltip options
- [ ] Enter selects highlighted option
- [ ] Tab advances to next logical position
- [ ] ARIA live regions announce tooltip content

---

## Technical Context

### DSL Context Helper

**File: `web/lib/dsl-context-helper.ts`**
```typescript
export type DSLContext =
  | { type: 'empty_editor' }
  | { type: 'solar_degrees'; position: number }
  | { type: 'solar_direction'; position: number }
  | { type: 'proportional_hours'; position: number }
  | { type: 'proportional_base'; position: number }
  | { type: 'primitive' }
  | { type: 'operator' }
  | { type: 'unknown' };

export function getDSLContext(formula: string, cursorPos: number): DSLContext {
  if (!formula.trim()) {
    return { type: 'empty_editor' };
  }

  // Find the function we're inside of
  const beforeCursor = formula.slice(0, cursorPos);

  // Check for solar() context
  const solarMatch = beforeCursor.match(/solar\s*\(\s*([^,)]*)?$/);
  if (solarMatch) {
    return { type: 'solar_degrees', position: cursorPos };
  }

  const solarWithFirstArg = beforeCursor.match(/solar\s*\([^,]+,\s*([^)]*)?$/);
  if (solarWithFirstArg) {
    return { type: 'solar_direction', position: cursorPos };
  }

  // Check for proportional_hours() context
  const phMatch = beforeCursor.match(/proportional_hours\s*\(\s*([^,)]*)?$/);
  if (phMatch) {
    return { type: 'proportional_hours', position: cursorPos };
  }

  const phWithFirstArg = beforeCursor.match(/proportional_hours\s*\([^,]+,\s*([^)]*)?$/);
  if (phWithFirstArg) {
    return { type: 'proportional_base', position: cursorPos };
  }

  return { type: 'unknown' };
}
```

### Tooltip Component

**File: `web/components/editor/ContextualTooltip.tsx`**
```typescript
interface ContextualTooltipProps {
  context: DSLContext;
  position: { x: number; y: number };
  onInsert: (value: string) => void;
  onDismiss: () => void;
}

const TOOLTIP_CONTENT: Record<string, TooltipData> = {
  solar_degrees: {
    title: '📐 Degrees: Sun angle below horizon (0-90)',
    description: 'How far below the horizon is the sun?',
    options: [
      { value: '8.5', label: '8.5°', description: 'Tzeis (nightfall)' },
      { value: '11', label: '11°', description: 'Misheyakir (tallis/tefillin)' },
      { value: '16.1', label: '16.1°', description: 'Alos (Magen Avraham dawn)' },
      { value: '18', label: '18°', description: 'Astronomical twilight' },
    ],
    hint: 'Type a number, e.g., 16.1',
  },
  solar_direction: {
    title: '🧭 Direction: When does this angle occur?',
    description: 'Morning or evening?',
    options: [
      { value: 'before_sunrise', label: 'before_sunrise', description: 'Morning (dawn)' },
      { value: 'after_sunset', label: 'after_sunset', description: 'Evening (tzeis)' },
      { value: 'before_noon', label: 'before_noon', description: 'Late morning' },
      { value: 'after_noon', label: 'after_noon', description: 'Afternoon' },
    ],
  },
  // ... more contexts
};
```

### CodeMirror Integration

```typescript
// In CodeMirrorDSLEditor.tsx
import { EditorView } from '@codemirror/view';
import { getDSLContext } from '@/lib/dsl-context-helper';

const cursorListener = EditorView.updateListener.of((update) => {
  if (update.selectionSet || update.docChanged) {
    const pos = update.state.selection.main.head;
    const doc = update.state.doc.toString();
    const context = getDSLContext(doc, pos);

    // Calculate cursor coordinates for tooltip positioning
    const coords = update.view.coordsAtPos(pos);

    setTooltipContext(context);
    setTooltipPosition(coords);
  }
});
```

---

## Tasks / Subtasks

- [ ] Task 1: Create DSL Context Helper
  - [ ] 1.1 Create `web/lib/dsl-context-helper.ts`
  - [ ] 1.2 Implement solar() context detection
  - [ ] 1.3 Implement proportional_hours() context detection
  - [ ] 1.4 Handle nested parentheses edge cases
  - [ ] 1.5 Add unit tests for context detection

- [ ] Task 2: Create ContextualTooltip Component
  - [ ] 2.1 Create `web/components/editor/ContextualTooltip.tsx`
  - [ ] 2.2 Define tooltip content for all contexts
  - [ ] 2.3 Style with Tailwind (floating, shadow, rounded)
  - [ ] 2.4 Implement clickable option chips
  - [ ] 2.5 Add keyboard navigation (arrow keys, Enter)

- [ ] Task 3: Integrate with CodeMirror
  - [ ] 3.1 Add cursor position listener to CodeMirrorDSLEditor
  - [ ] 3.2 Calculate tooltip position from cursor coordinates
  - [ ] 3.3 Wire up tooltip visibility based on context
  - [ ] 3.4 Implement debounce (100ms delay)

- [ ] Task 4: Insert Behavior
  - [ ] 4.1 Implement value insertion at cursor
  - [ ] 4.2 Handle replacing selected text
  - [ ] 4.3 Advance cursor after insertion
  - [ ] 4.4 Dismiss tooltip after insertion

- [ ] Task 5: Empty Editor Tooltip
  - [ ] 5.1 Implement 2-second delay for empty editor
  - [ ] 5.2 Show quick start examples
  - [ ] 5.3 Add "pick from reference panel" guidance

- [ ] Task 6: Accessibility
  - [ ] 6.1 Add ARIA attributes to tooltip
  - [ ] 6.2 Implement keyboard focus management
  - [ ] 6.3 Add screen reader announcements

- [ ] Task 7: Mobile Support
  - [ ] 7.1 Test touch interactions
  - [ ] 7.2 Ensure tap-to-select works
  - [ ] 7.3 Adjust positioning for mobile viewports

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] All tooltip contexts implemented (solar, proportional_hours, empty_editor)
- [ ] Keyboard navigation functional (Arrow keys, Enter, Escape)
- [ ] Mobile tested and working
- [ ] Accessibility attributes in place (ARIA roles, live regions)
- [ ] Integration with CodeMirror complete
- [ ] Performance tested (no visible lag on cursor movement)
- [ ] Nested parentheses edge cases handled correctly
- [ ] Tooltip positioning handles viewport boundaries

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `web/lib/dsl-context-helper.ts` | Create | Cursor context detection |
| `web/components/editor/ContextualTooltip.tsx` | Create | Tooltip UI component |
| `web/components/editor/CodeMirrorDSLEditor.tsx` | Modify | Integration |

---

## UX Spec Reference

See: [ux-dsl-editor-inline-guidance.md](../../ux-dsl-editor-inline-guidance.md) - Section 2.1
