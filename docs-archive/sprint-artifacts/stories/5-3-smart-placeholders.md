# Story 5.3: Smart Placeholders with Real Examples

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** todo
**Priority:** P2
**Story Points:** 5
**Dependencies:** Story 5.2 (Contextual Tooltips)
**FRs:** FR98 (Smart placeholders with real examples)

---

## Standards Reference

See `docs/coding-standards.md` sections:
- "Frontend Standards > Component Structure" (hook ordering, state management)
- "Frontend Standards > Styling with Tailwind" (use design tokens)
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Accessibility Note:**
- Tab-to-next behavior must NOT break standard accessibility (Tab for focus navigation)
- Use Escape key to exit snippet mode and restore standard Tab behavior
- Consider using Ctrl+Tab or a different key combination for snippet navigation

---

## Story

As a **non-technical publisher**,
I want **function templates to show real examples instead of abstract placeholders**,
So that **I can immediately understand the correct format**.

---

## Acceptance Criteria

### AC-5.3.1: Real Example Insertion
- [ ] Clicking "solar()" in reference panel inserts `solar(16.1, before_sunrise)` (not `solar(degrees, direction)`)
- [ ] Clicking "proportional_hours()" inserts `proportional_hours(4, gra)`
- [ ] Clicking "midpoint()" inserts `midpoint(sunrise, sunset)`
- [ ] All functions insert real, working examples

### AC-5.3.2: Parameter Selection
- [ ] After inserting function, first parameter is selected/highlighted
- [ ] User can immediately type to replace the value
- [ ] Selection is visually clear (highlighted background)

### AC-5.3.3: Tab-to-Next-Parameter
- [ ] Pressing Tab after editing first parameter moves to second parameter
- [ ] Second parameter is selected
- [ ] Contextual tooltip appears for the new parameter
- [ ] Works for functions with 2+ parameters

### AC-5.3.4: Quick-Insert Chips in Reference Panel
- [ ] Reference panel shows "Quick insert:" section for each function
- [ ] Clickable chips for common values: [8.5°] [11°] [16.1°] [18°]
- [ ] Clicking chip inserts at current cursor position
- [ ] Chips are context-aware (only show relevant to current parameter)

### AC-5.3.5: Reference Data Enhancement
- [ ] `dsl-reference-data.ts` updated with `realWorldExample` property
- [ ] Each function has default example values
- [ ] Example values are halachically meaningful

---

## Technical Context

### Reference Data Structure

**File: `web/lib/dsl-reference-data.ts`** (modifications)
```typescript
export interface ReferenceItem {
  name: string;
  syntax: string;
  description: string;
  parameters?: ParameterInfo[];
  // NEW: Real-world example for insertion
  realWorldExample: string;
  // NEW: Quick insert chips
  quickInsertChips?: QuickInsertChip[];
}

interface ParameterInfo {
  name: string;
  type: string;
  description: string;
  // NEW: Default value for this parameter
  defaultValue: string;
  // NEW: Common values for quick insert
  commonValues?: { value: string; label: string; description: string }[];
}

interface QuickInsertChip {
  value: string;
  label: string;
  description: string;
}

// Updated reference data
export const DSL_FUNCTIONS: ReferenceItem[] = [
  {
    name: 'solar',
    syntax: 'solar(degrees, direction)',
    description: 'Calculate time when sun reaches specified angle below horizon',
    realWorldExample: 'solar(16.1, before_sunrise)',
    parameters: [
      {
        name: 'degrees',
        type: 'number',
        description: 'Sun angle below horizon (0-90)',
        defaultValue: '16.1',
        commonValues: [
          { value: '8.5', label: '8.5°', description: 'Tzeis' },
          { value: '11', label: '11°', description: 'Misheyakir' },
          { value: '16.1', label: '16.1°', description: 'Alos (MGA)' },
          { value: '18', label: '18°', description: 'Astronomical' },
        ],
      },
      {
        name: 'direction',
        type: 'keyword',
        description: 'When the angle occurs',
        defaultValue: 'before_sunrise',
        commonValues: [
          { value: 'before_sunrise', label: 'before_sunrise', description: 'Morning' },
          { value: 'after_sunset', label: 'after_sunset', description: 'Evening' },
        ],
      },
    ],
    quickInsertChips: [
      { value: 'solar(8.5, after_sunset)', label: 'Tzeis 8.5°', description: 'Standard nightfall' },
      { value: 'solar(16.1, before_sunrise)', label: 'Alos 16.1°', description: 'MGA dawn' },
    ],
  },
  // ... more functions
];
```

### Tab Navigation Implementation

```typescript
// Using CodeMirror snippet functionality
import { snippet, snippetKeymap } from '@codemirror/autocomplete';

// Create snippet with tab stops
const solarSnippet = snippet('solar(${1:16.1}, ${2:before_sunrise})');

// Insert with tab navigation
function insertFunctionExample(view: EditorView, example: string) {
  // Parse example to create tab stops
  const template = createSnippetTemplate(example);

  // Insert at cursor
  const transaction = view.state.update({
    changes: { from: view.state.selection.main.head, insert: template },
  });

  view.dispatch(transaction);

  // Select first parameter
  selectFirstParameter(view);
}
```

### Quick Insert Chip Component

**File: `web/components/editor/QuickInsertChip.tsx`**
```typescript
interface QuickInsertChipProps {
  value: string;
  label: string;
  description: string;
  onClick: (value: string) => void;
}

export function QuickInsertChip({ value, label, description, onClick }: QuickInsertChipProps) {
  return (
    <button
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                 bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
      onClick={() => onClick(value)}
      title={description}
    >
      {label}
    </button>
  );
}
```

---

## Tasks / Subtasks

- [ ] Task 1: Update Reference Data
  - [ ] 1.1 Add `realWorldExample` to all functions in `dsl-reference-data.ts`
  - [ ] 1.2 Add `defaultValue` to all parameter definitions
  - [ ] 1.3 Add `commonValues` for quick insert chips
  - [ ] 1.4 Add `quickInsertChips` to function definitions

- [ ] Task 2: Implement Example Insertion
  - [ ] 2.1 Modify reference panel click handler to use realWorldExample
  - [ ] 2.2 Create snippet template parser for tab stops
  - [ ] 2.3 Implement first parameter selection after insert

- [ ] Task 3: Implement Tab Navigation
  - [ ] 3.1 Add CodeMirror snippet support
  - [ ] 3.2 Create tab stop positions for each parameter
  - [ ] 3.3 Wire Tab key to advance to next parameter
  - [ ] 3.4 Trigger contextual tooltip on tab advance

- [ ] Task 4: Quick Insert Chips
  - [ ] 4.1 Create `QuickInsertChip` component
  - [ ] 4.2 Add chips to reference panel entries
  - [ ] 4.3 Implement chip click → insert at cursor
  - [ ] 4.4 Make chips context-aware (filter by current parameter)

- [ ] Task 5: Reference Panel Integration
  - [ ] 5.1 Update `DSLReferencePanel.tsx` to show quick insert section
  - [ ] 5.2 Add "Quick insert:" label with chips
  - [ ] 5.3 Style chips in a horizontal scrollable row

- [ ] Task 6: Testing
  - [ ] 6.1 Test all function insertions
  - [ ] 6.2 Test Tab navigation through parameters
  - [ ] 6.3 Test quick insert chips
  - [ ] 6.4 Test on mobile

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] All functions insert real examples (not abstract placeholders)
- [ ] Tab navigation works between parameters
- [ ] Escape key exits snippet mode and restores standard Tab behavior
- [ ] Quick insert chips functional
- [ ] Contextual tooltips appear on tab advance
- [ ] Accessibility tested (Tab behavior doesn't break form navigation)
- [ ] Mobile tested

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `web/lib/dsl-reference-data.ts` | Modify | Add realWorldExample, defaultValue, commonValues |
| `web/components/editor/QuickInsertChip.tsx` | Create | Chip component |
| `web/components/editor/DSLReferencePanel.tsx` | Modify | Show quick insert section |
| `web/components/editor/CodeMirrorDSLEditor.tsx` | Modify | Tab navigation |

---

## Example Function Mappings

| Function | Abstract Placeholder | Real Example |
|----------|---------------------|--------------|
| `solar()` | `solar(degrees, direction)` | `solar(16.1, before_sunrise)` |
| `proportional_hours()` | `proportional_hours(hours, base)` | `proportional_hours(4, gra)` |
| `midpoint()` | `midpoint(a, b)` | `midpoint(sunrise, sunset)` |
| `fixed_offset()` | `fixed_offset(base, minutes)` | `fixed_offset(sunset, 72)` |

---

## UX Spec Reference

See: [ux-dsl-editor-inline-guidance.md](../../ux-dsl-editor-inline-guidance.md) - Section 2.3
