# Story 5.1: Human-Friendly Error Messages

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** todo
**Priority:** P1
**Story Points:** 5
**Dependencies:** Story 5.0 (Database Schema)
**FRs:** FR96 (Human-friendly error messages in DSL editor)

---

## Standards Reference

See `docs/coding-standards.md` sections:
- "Frontend Standards > Component Structure" (hook ordering, state management)
- "Frontend Standards > Styling with Tailwind" (use design tokens)
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Related Backend Code:**
- `api/internal/dsl/validator.go` - Source of error messages to humanize

---

## Story

As a **non-technical publisher**,
I want **error messages that explain what's wrong in plain language**,
So that **I can fix formula errors without understanding programming jargon**.

---

## Acceptance Criteria

### AC-5.1.1: Error Message Transformation Layer
- [ ] `web/lib/error-humanizer.ts` created with pattern matching
- [ ] All common backend errors mapped to human-friendly messages
- [ ] Each transformed error includes: headline, explanation, suggestion, example code
- [ ] Fallback message for unmapped errors

### AC-5.1.2: Parentheses/Syntax Errors
- [ ] `unexpected token after expression: solar` → "Oops! `solar` needs parentheses to work."
- [ ] Suggestion shows correct pattern: `solar(degrees, direction)`
- [ ] "Insert this example" button provides working code

### AC-5.1.3: Missing Argument Errors
- [ ] `solar() requires 2 arguments, got 1` → "Almost there! `solar()` needs two things."
- [ ] Explanation: "A number for degrees AND a direction."
- [ ] Visual breakdown shows parameter positions

### AC-5.1.4: Value Range Errors
- [ ] `degrees must be between 0 and 90, got 120` → "120° is too high."
- [ ] Explanation: "The sun can only be 0-90° below the horizon."
- [ ] Suggestion shows common values: "8.5° (tzeis), 16.1° (alos), 18° (astronomical)"

### AC-5.1.5: Unknown Identifier Errors
- [ ] `unknown primitive: sunrise2` → "I don't recognize 'sunrise2'."
- [ ] "Did you mean `sunrise`?" with fuzzy match suggestions
- [ ] Link to reference panel for valid primitives

### AC-5.1.6: Backend Suggestion Passthrough
- [ ] When backend includes `suggestion` field, display it
- [ ] Frontend mapping only used when no backend suggestion
- [ ] Backend suggestions styled consistently with frontend ones

### AC-5.1.7: HumanErrorDisplay Component
- [ ] `web/components/editor/HumanErrorDisplay.tsx` created
- [ ] Displays headline prominently
- [ ] Shows explanation in secondary text
- [ ] "Insert this example" button functional
- [ ] "Learn more" links to reference panel section

---

## Technical Context

### Error Humanizer Implementation

**File: `web/lib/error-humanizer.ts`**
```typescript
export interface HumanError {
  headline: string;
  explanation?: string;
  suggestion: string;
  exampleCode?: string;
  referenceLink?: string;
  highlightRange?: { start: number; end: number };
}

interface ErrorPattern {
  pattern: RegExp;
  humanize: (match: RegExpMatchArray, formula: string) => HumanError;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /unexpected token after expression: (\w+)/,
    humanize: (match) => ({
      headline: `Oops! \`${match[1]}\` needs parentheses to work.`,
      suggestion: `Try: ${match[1]}(...)`,
      exampleCode: getExampleForFunction(match[1]),
      referenceLink: `#function-${match[1]}`,
    }),
  },
  {
    pattern: /(\w+)\(\) requires (\d+) arguments.*got (\d+)/,
    humanize: (match) => ({
      headline: `Almost there! \`${match[1]}()\` needs ${match[2]} things.`,
      explanation: getParameterExplanation(match[1]),
      suggestion: `Example: ${getExampleForFunction(match[1])}`,
      exampleCode: getExampleForFunction(match[1]),
    }),
  },
  {
    pattern: /degrees must be between 0 and 90, got ([\d.]+)/,
    humanize: (match) => ({
      headline: `${match[1]}° is too high.`,
      explanation: 'The sun can only be 0-90° below the horizon.',
      suggestion: 'Common values: 8.5° (tzeis), 16.1° (alos), 18° (astronomical)',
    }),
  },
  {
    pattern: /unknown primitive: (\w+)/,
    humanize: (match) => ({
      headline: `I don't recognize "${match[1]}".`,
      suggestion: `Did you mean: ${findSimilarPrimitives(match[1]).join(', ')}?`,
      referenceLink: '#primitives',
    }),
  },
  {
    pattern: /invalid direction: (\w+)/,
    humanize: (match) => ({
      headline: `"${match[1]}" isn't a recognized direction.`,
      suggestion: 'Choose: before_sunrise, after_sunset, before_noon, after_noon',
      referenceLink: '#directions',
    }),
  },
  {
    pattern: /undefined reference: @(\w+)/,
    humanize: (match) => ({
      headline: `Can't find "@${match[1]}" in your zmanim.`,
      suggestion: 'Check your zman keys or use a primitive like sunrise',
      referenceLink: '#references',
    }),
  },
  {
    pattern: /circular reference/,
    humanize: () => ({
      headline: 'This formula references itself!',
      explanation: 'A formula can\'t depend on its own result.',
      suggestion: 'Use a primitive or reference a different zman.',
    }),
  },
];

export function humanizeError(backendError: string, formula: string): HumanError {
  for (const { pattern, humanize } of ERROR_PATTERNS) {
    const match = backendError.match(pattern);
    if (match) {
      return humanize(match, formula);
    }
  }

  return {
    headline: 'Something isn\'t quite right.',
    suggestion: 'Check your formula against the examples in the reference panel.',
    referenceLink: '#examples',
  };
}
```

### Component Structure

**File: `web/components/editor/HumanErrorDisplay.tsx`**
```typescript
interface HumanErrorDisplayProps {
  error: HumanError;
  onInsertExample: (code: string) => void;
  onNavigateToReference: (section: string) => void;
}

export function HumanErrorDisplay({ error, onInsertExample, onNavigateToReference }: HumanErrorDisplayProps) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium text-amber-900">{error.headline}</h4>
          {error.explanation && (
            <p className="text-sm text-amber-700 mt-1">{error.explanation}</p>
          )}
          <p className="text-sm text-amber-800 mt-2">
            💡 {error.suggestion}
          </p>
          {error.exampleCode && (
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onInsertExample(error.exampleCode!)}
              >
                Insert this example
              </Button>
              {error.referenceLink && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onNavigateToReference(error.referenceLink!)}
                >
                  Learn more
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Tasks / Subtasks

- [ ] Task 1: Create Error Humanizer
  - [ ] 1.1 Create `web/lib/error-humanizer.ts`
  - [ ] 1.2 Implement ERROR_PATTERNS array with all mappings
  - [ ] 1.3 Implement helper functions (getExampleForFunction, findSimilarPrimitives)
  - [ ] 1.4 Install `fastest-levenshtein` for fuzzy matching: `npm install fastest-levenshtein`
  - [ ] 1.5 Add unit tests for error pattern matching

- [ ] Task 2: Create HumanErrorDisplay Component
  - [ ] 2.1 Create `web/components/editor/HumanErrorDisplay.tsx`
  - [ ] 2.2 Style with Tailwind (amber color scheme for warnings)
  - [ ] 2.3 Implement "Insert this example" button
  - [ ] 2.4 Implement "Learn more" navigation

- [ ] Task 3: Integrate with CodeMirror Editor
  - [ ] 3.1 Modify `CodeMirrorDSLEditor.tsx` to use HumanErrorDisplay
  - [ ] 3.2 Replace raw error display with humanized version
  - [ ] 3.3 Wire up insert and navigation callbacks

- [ ] Task 4: Backend Enhancement (Optional)
  - [ ] 4.1 Review `api/internal/dsl/validator.go` for suggestion support
  - [ ] 4.2 Ensure frontend receives and displays backend suggestions
  - [ ] 4.3 Add error codes to backend responses

- [ ] Task 5: Testing
  - [ ] 5.1 Test all error patterns with real examples
  - [ ] 5.2 Verify fuzzy matching works for typos
  - [ ] 5.3 Test "Insert this example" functionality
  - [ ] 5.4 Test on mobile viewport

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] All error patterns from UX spec implemented (see Reference table below)
- [ ] HumanErrorDisplay component styled and functional
- [ ] Integration with CodeMirrorDSLEditor complete
- [ ] Error patterns cover ALL common validation errors from `api/internal/dsl/validator.go`
- [ ] Fuzzy matching tested with common typos (e.g., "sunris", "solr")
- [ ] Manual testing with common error scenarios
- [ ] Mobile responsive
- [ ] i18n-ready structure (error strings externalized for future localization)

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `web/lib/error-humanizer.ts` | Create | Error transformation logic |
| `web/components/editor/HumanErrorDisplay.tsx` | Create | Error display component |
| `web/components/editor/CodeMirrorDSLEditor.tsx` | Modify | Integration |

---

## Reference: Error Mapping Table

| Backend Error Pattern | Human Headline | Suggestion |
|----------------------|----------------|------------|
| `unexpected token after expression: X` | Oops! `X` needs parentheses to work. | Try: `X(...)` |
| `X() requires N arguments, got M` | Almost there! `X()` needs N things. | [Parameter breakdown] |
| `degrees must be between 0 and 90` | N° is too high/low. | Common values: 8.5°, 16.1°, 18° |
| `invalid direction: X` | "X" isn't a recognized direction. | Choose: before_sunrise, after_sunset... |
| `unknown primitive: X` | I don't recognize "X". | Did you mean: [closest match]? |
| `unknown function: X` | "X" isn't a function I know. | Available: solar, proportional_hours... |
| `undefined reference: @X` | Can't find "@X" in your zmanim. | Available: [list first 5] |
| `cannot add two times` | You can't add times together. | To add minutes: `time + 30min` |
| `circular reference` | This formula references itself! | Use a primitive or different reference. |

---

## UX Spec Reference

See: [ux-dsl-editor-inline-guidance.md](../../ux-dsl-editor-inline-guidance.md) - Section 2.2
