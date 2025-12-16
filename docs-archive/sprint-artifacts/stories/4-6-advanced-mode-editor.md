# Story 4.6: Advanced Mode Editor (CodeMirror 6)

**Epic:** Epic 4 - Intuitive Zmanim Algorithm Editor with AI-Powered DSL
**Status:** dev-complete
**Priority:** P2
**Story Points:** 8
**Dependencies:** Story 4.2 (DSL Parser), Story 4.4 (Guided Formula Builder)

---

## Story

As a **power-user publisher**,
I want **a code editor with full DSL syntax support via CodeMirror 6**,
So that **I can write complex formulas with syntax highlighting, autocomplete, and inline validation**.

---

## Acceptance Criteria

### AC-4.6.1: CodeMirror Integration
- [ ] CodeMirror 6 editor integrated into formula editing page
- [ ] Editor loads existing formula from database
- [ ] Editor saves formula back to database
- [ ] Minimum height: 200px, maximum: 500px

### AC-4.6.2: DSL Syntax Highlighting
- [ ] Custom syntax highlighting for DSL language
- [ ] Keywords highlighted (sunrise, sunset, solar, shaos, etc.)
- [ ] Functions highlighted differently from primitives
- [ ] Operators highlighted
- [ ] References (`@zman_key`) highlighted with distinct color
- [ ] Comments highlighted (if DSL supports comments)
- [ ] Numbers and durations highlighted

### AC-4.6.3: Autocomplete
- [ ] Autocomplete for primitives (sunrise, sunset, etc.)
- [ ] Autocomplete for functions (solar, shaos, midpoint)
- [ ] Autocomplete for zman references (@) from publisher's defined zmanim
- [ ] Autocomplete shows documentation snippets
- [ ] Keyboard-accessible (Tab to accept, Esc to dismiss)

### AC-4.6.4: Inline Validation
- [ ] Real-time validation as user types (debounced 500ms)
- [ ] Syntax errors underlined with red squiggly
- [ ] Semantic errors underlined with yellow squiggly
- [ ] Hover over error shows message
- [ ] Error panel below editor lists all errors

### AC-4.6.5: Mode Toggle
- [ ] Easy toggle between Guided Mode and Advanced Mode
- [ ] Formula transfers correctly between modes
- [ ] Warning if switching from Advanced to Guided loses complex features

### AC-4.6.6: Live Preview
- [ ] Preview panel shows calculated result (same as Guided Mode)
- [ ] Preview updates as formula changes
- [ ] Preview shows calculation breakdown

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Component tests pass for CodeMirror integration
- [ ] Integration tests pass for validation API calls
- [ ] E2E tests pass for editor workflow
- [ ] All DSL syntax elements highlight correctly
- [ ] Autocomplete works for all token types
- [ ] Code review workflow executed (`/bmad:bmm:workflows:code-review`)

---

## Tasks / Subtasks

- [ ] Task 1: CodeMirror Setup (AC: 4.6.1)
  - [ ] 1.1 Install @codemirror/basic-setup and extensions
  - [ ] 1.2 Create `DSLEditor` component wrapper
  - [ ] 1.3 Configure editor options (line numbers, bracket matching)
  - [ ] 1.4 Wire up value/onChange props
  - [ ] 1.5 Handle responsive sizing

- [ ] Task 2: Custom DSL Language (AC: 4.6.2)
  - [ ] 2.1 Create `dsl-language.ts` with Lezer grammar
  - [ ] 2.2 Define token types (keyword, function, operator, etc.)
  - [ ] 2.3 Create highlighting theme
  - [ ] 2.4 Test highlighting with all DSL examples

- [ ] Task 3: Autocomplete (AC: 4.6.3)
  - [ ] 3.1 Create `dsl-completion.ts` completion source
  - [ ] 3.2 Define completions for primitives
  - [ ] 3.3 Define completions for functions with signatures
  - [ ] 3.4 Fetch publisher's zmanim for reference completions
  - [ ] 3.5 Add documentation snippets to completions

- [ ] Task 4: Inline Validation (AC: 4.6.4)
  - [ ] 4.1 Create `dsl-linting.ts` lint source
  - [ ] 4.2 Call `/api/dsl/validate` on changes (debounced)
  - [ ] 4.3 Convert API errors to CodeMirror diagnostics
  - [ ] 4.4 Display error panel below editor
  - [ ] 4.5 Add hover tooltips for errors

- [ ] Task 5: Mode Toggle (AC: 4.6.5)
  - [ ] 5.1 Add toggle UI in editor page
  - [ ] 5.2 Implement formula transfer (Guided → Advanced)
  - [ ] 5.3 Implement formula parsing (Advanced → Guided)
  - [ ] 5.4 Add warning dialog for lossy conversions

- [ ] Task 6: Live Preview (AC: 4.6.6)
  - [ ] 6.1 Reuse `CalculationPreview` component from Story 4.4
  - [ ] 6.2 Connect to Advanced Mode editor state
  - [ ] 6.3 Debounce preview updates

- [ ] Task 7: Testing
  - [ ] 7.1 Write component tests for editor
  - [ ] 7.2 Write integration tests for validation
  - [ ] 7.3 Write E2E tests for editor workflow
  - [ ] 7.4 Test keyboard accessibility

---

## Dev Notes

### CodeMirror Setup

```typescript
// web/lib/codemirror/dsl-language.ts
import { LRLanguage, LanguageSupport } from '@codemirror/language';
import { styleTags, tags as t } from '@lezer/highlight';
import { parser } from './dsl-parser'; // Generated from Lezer grammar

export const dslLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      styleTags({
        Primitive: t.keyword,
        Function: t.function(t.variableName),
        Operator: t.operator,
        Number: t.number,
        Duration: t.number,
        Reference: t.variableName,
        Comment: t.comment,
      }),
    ],
  }),
  languageData: {
    commentTokens: { line: '//' },
  },
});

export function dsl() {
  return new LanguageSupport(dslLanguage, [
    dslCompletion(),
    dslLinting(),
  ]);
}
```

### Lezer Grammar (Simplified)

```
// web/lib/codemirror/dsl.grammar
@top Formula { expression }

expression {
  Primitive |
  FunctionCall |
  BinaryOp |
  Reference |
  Conditional |
  "(" expression ")"
}

Primitive { "sunrise" | "sunset" | "solar_noon" | "civil_dawn" | "civil_dusk" }

FunctionCall { Function "(" Args ")" }
Function { "solar" | "shaos" | "midpoint" }
Args { expression ("," expression)* }

BinaryOp { expression Operator expression }
Operator { "+" | "-" | "*" | "/" }

Reference { "@" identifier }

Duration { Number ("min" | "hr" | "h" | "m") }

Conditional { "if" "(" expression ")" "{" expression "}" "else" "{" expression "}" }

@tokens {
  Number { $[0-9]+ ("." $[0-9]+)? }
  identifier { $[a-z_]+ }
  whitespace { $[ \t\n\r]+ }
}

@skip { whitespace }
```

### Autocomplete Source

```typescript
// web/lib/codemirror/dsl-completion.ts
import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

const primitives = [
  { label: 'sunrise', type: 'keyword', info: 'Time when sun crosses horizon (morning)' },
  { label: 'sunset', type: 'keyword', info: 'Time when sun crosses horizon (evening)' },
  { label: 'solar_noon', type: 'keyword', info: 'Time when sun is at highest point' },
  { label: 'civil_dawn', type: 'keyword', info: 'When sun is 6° below horizon (morning)' },
  { label: 'civil_dusk', type: 'keyword', info: 'When sun is 6° below horizon (evening)' },
];

const functions = [
  { label: 'solar', type: 'function', info: 'solar(degrees, direction) - Solar angle calculation' },
  { label: 'shaos', type: 'function', info: 'shaos(hours, base) - Proportional hours' },
  { label: 'midpoint', type: 'function', info: 'midpoint(t1, t2) - Middle point between two times' },
];

export function dslCompletion(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  // Check for reference autocomplete
  const refMatch = context.matchBefore(/@\w*/);
  if (refMatch) {
    // Fetch publisher's zmanim from context/API
    return {
      from: refMatch.from,
      options: getZmanimReferences(), // Dynamic from publisher data
    };
  }

  return {
    from: word.from,
    options: [...primitives, ...functions],
  };
}
```

### Lint Source

```typescript
// web/lib/codemirror/dsl-linting.ts
import { Diagnostic, linter } from '@codemirror/lint';

export const dslLinter = linter(async (view) => {
  const formula = view.state.doc.toString();

  try {
    const response = await fetch('/api/dsl/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formula }),
    });

    const result = await response.json();

    if (result.valid) return [];

    return result.errors.map((err: any): Diagnostic => ({
      from: err.position?.start ?? 0,
      to: err.position?.end ?? formula.length,
      severity: err.type === 'syntax' ? 'error' : 'warning',
      message: err.message,
    }));
  } catch {
    return [];
  }
}, {
  delay: 500,
});
```

### Editor Component

```tsx
// web/components/editor/DSLEditor.tsx
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { useEffect, useRef } from 'react';
import { dsl } from '@/lib/codemirror/dsl-language';

interface DSLEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function DSLEditor({ value, onChange }: DSLEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();

  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        dsl(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
      ],
    });

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    return () => viewRef.current?.destroy();
  }, []);

  return (
    <div
      ref={editorRef}
      className="border rounded-md min-h-[200px] max-h-[500px] overflow-auto"
    />
  );
}
```

### References

- [Source: docs/sprint-artifacts/epic-4-comprehensive-plan.md#Story 4.6]
- [Source: docs/sprint-artifacts/epic-4-ui-wireframes.md#Advanced Mode]
- [CodeMirror 6](https://codemirror.net/)
- [Lezer Parser Generator](https://lezer.codemirror.net/)

---

## Testing Requirements

### Unit Tests (TypeScript)
- [ ] DSL language tokenizes correctly
- [ ] Autocomplete returns correct options
- [ ] Lint source converts API errors to diagnostics

### Component Tests (React)
- [ ] Editor renders with initial value
- [ ] Editor calls onChange when modified
- [ ] Syntax highlighting applied to all token types
- [ ] Autocomplete dropdown appears on trigger

### Integration Tests
- [ ] Editor validates formula via API
- [ ] Errors display inline
- [ ] Completions include publisher's zmanim

### E2E Tests (Playwright)
- [ ] Publisher can write formula in Advanced Mode
- [ ] Autocomplete suggests primitives
- [ ] Autocomplete suggests publisher's zmanim
- [ ] Validation errors appear inline
- [ ] Formula saves correctly
- [ ] Mode toggle preserves formula

### Accessibility Tests
- [ ] Editor focusable via keyboard
- [ ] Autocomplete navigable with arrow keys
- [ ] Tab accepts completion
- [ ] Screen reader announces errors

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/4-6-advanced-mode-editor.context.xml
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
