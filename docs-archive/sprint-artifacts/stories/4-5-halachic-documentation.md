# Story 4.5: Halachic Documentation Comments

**Epic:** Epic 4 - Intuitive Zmanim Algorithm Editor with AI-Powered DSL
**Status:** dev-complete
**Priority:** P2
**Story Points:** 5
**Dependencies:** Story 4.3 (Bilingual Naming), Story 4.4 (Guided Formula Builder)

---

## Story

As a **publisher**,
I want **a rich text comments field for each zman that supports Hebrew and Markdown**,
So that **I can document the halachic sources and reasoning behind my calculation choices**.

---

## Acceptance Criteria

### AC-4.5.1: Database Schema
- [ ] `zman_definitions` table includes `halachic_notes` field (TEXT, nullable)
- [ ] Field supports UTF-8 with Hebrew characters
- [ ] Field supports Markdown syntax storage

### AC-4.5.2: Rich Text Editor
- [ ] Textarea with Markdown preview toggle
- [ ] Supports bold, italic, headers, links, and lists
- [ ] Hebrew text input with RTL support
- [ ] Mixed Hebrew/English content renders correctly
- [ ] Character limit: 5000 characters with counter

### AC-4.5.3: Source Citations
- [ ] Autocomplete for common halachic sources (Shulchan Aruch, Mishnah Berurah, etc.)
- [ ] Citation format helper: `[Source: Chapter:Section]`
- [ ] Link to external resources (HebrewBooks, Sefaria) when applicable

### AC-4.5.4: Display Integration
- [ ] Halachic notes appear in Formula Reveal panel
- [ ] Markdown renders as formatted HTML
- [ ] Hebrew portions render with proper RTL
- [ ] Expandable if content is long

### AC-4.5.5: API Support
- [ ] `PUT /api/publisher/zmanim/{id}` accepts `halachic_notes` field
- [ ] `GET /api/zmanim` returns `halachic_notes` with zman data
- [ ] Notes sanitized for XSS before storage and display

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Unit tests pass for Markdown sanitization
- [ ] Integration tests pass for API CRUD operations
- [ ] Component tests pass for rich text editor
- [ ] E2E tests pass for full documentation flow
- [ ] XSS vulnerability scan passes
- [ ] Code review workflow executed (`/bmad:bmm:workflows:code-review`)

---

## Tasks / Subtasks

- [ ] Task 1: Database Schema (AC: 4.5.1)
  - [ ] 1.1 Create migration adding `halachic_notes` column
  - [ ] 1.2 Ensure UTF-8 encoding for Hebrew support
  - [ ] 1.3 Run migration

- [ ] Task 2: API Updates (AC: 4.5.5)
  - [ ] 2.1 Update zman DTO with `halachic_notes` field
  - [ ] 2.2 Add Markdown sanitization (bluemonday or similar)
  - [ ] 2.3 Update PUT handler
  - [ ] 2.4 Update GET handler
  - [ ] 2.5 Write API tests

- [ ] Task 3: Rich Text Editor (AC: 4.5.2)
  - [ ] 3.1 Create `HalachicNotesEditor` component
  - [ ] 3.2 Use shadcn Textarea as base
  - [ ] 3.3 Add Markdown preview toggle (react-markdown)
  - [ ] 3.4 Add toolbar for common formatting
  - [ ] 3.5 Add RTL support for Hebrew input
  - [ ] 3.6 Add character counter

- [ ] Task 4: Source Citations (AC: 4.5.3)
  - [ ] 4.1 Create halachic sources data file
  - [ ] 4.2 Add autocomplete for sources
  - [ ] 4.3 Add citation format helper
  - [ ] 4.4 Add external link suggestions

- [ ] Task 5: Display Integration (AC: 4.5.4)
  - [ ] 5.1 Update FormulaPanel to show halachic notes
  - [ ] 5.2 Render Markdown to HTML (react-markdown)
  - [ ] 5.3 Handle mixed RTL/LTR content
  - [ ] 5.4 Add expandable section for long notes

- [ ] Task 6: Security (AC: 4.5.5)
  - [ ] 6.1 Implement server-side Markdown sanitization
  - [ ] 6.2 Implement client-side XSS protection
  - [ ] 6.3 Test for common XSS vectors
  - [ ] 6.4 Security audit

- [ ] Task 7: Testing
  - [ ] 7.1 Write unit tests (sanitization, validation)
  - [ ] 7.2 Write integration tests (API)
  - [ ] 7.3 Write component tests (editor)
  - [ ] 7.4 Write E2E tests (full flow)

---

## Dev Notes

### Halachic Sources Data

```typescript
// web/lib/halachic-sources.ts
export const HALACHIC_SOURCES = [
  { id: 'sa', name: 'Shulchan Aruch', hebrew: 'שולחן ערוך' },
  { id: 'mb', name: 'Mishnah Berurah', hebrew: 'משנה ברורה' },
  { id: 'rema', name: 'Rema', hebrew: 'רמ"א' },
  { id: 'rambam', name: 'Rambam', hebrew: 'רמב"ם' },
  { id: 'tur', name: 'Tur', hebrew: 'טור' },
  { id: 'gemara', name: 'Talmud Bavli', hebrew: 'תלמוד בבלי' },
  { id: 'igm', name: 'Igros Moshe', hebrew: 'אגרות משה' },
  { id: 'yosef', name: 'Yalkut Yosef', hebrew: 'ילקוט יוסף' },
  { id: 'bhl', name: 'Biur Halacha', hebrew: 'ביאור הלכה' },
  // ... more sources
];

export function formatCitation(source: string, ref: string): string {
  const s = HALACHIC_SOURCES.find(src => src.id === source);
  return s ? `[${s.name} ${ref}]` : `[${source} ${ref}]`;
}
```

### Markdown Sanitization (Go)

```go
// api/internal/sanitize/markdown.go
import "github.com/microcosm-cc/bluemonday"

var markdownPolicy = bluemonday.UGCPolicy()

func SanitizeMarkdown(input string) string {
    // Allow standard Markdown elements
    // Strip dangerous HTML/scripts
    return markdownPolicy.Sanitize(input)
}
```

### Rich Text Editor Component

```tsx
// web/components/editor/HalachicNotesEditor.tsx
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';

interface HalachicNotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

export function HalachicNotesEditor({
  value,
  onChange,
  maxLength = 5000
}: HalachicNotesEditorProps) {
  const [isPreview, setIsPreview] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium">Halachic Notes</label>
        <Toggle
          pressed={isPreview}
          onPressedChange={setIsPreview}
          size="sm"
        >
          Preview
        </Toggle>
      </div>

      {isPreview ? (
        <div className="prose prose-sm min-h-[150px] p-3 border rounded-md">
          <ReactMarkdown>{value}</ReactMarkdown>
        </div>
      ) : (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          dir="auto"  // Auto-detect RTL/LTR
          className="min-h-[150px] font-hebrew"
          placeholder="Document halachic sources and reasoning..."
        />
      )}

      <div className="text-xs text-muted-foreground text-right">
        {value.length} / {maxLength}
      </div>
    </div>
  );
}
```

### Display in Formula Panel

```tsx
// Update web/components/zmanim/FormulaPanel.tsx
{formula.halachic_notes && (
  <div className="mt-4 pt-4 border-t">
    <h4 className="text-sm font-medium mb-2">Halachic Sources</h4>
    <div className="prose prose-sm max-w-none" dir="auto">
      <ReactMarkdown>{formula.halachic_notes}</ReactMarkdown>
    </div>
  </div>
)}
```

### Example Halachic Note

```markdown
## Sources

This calculation follows the opinion of the **Mishnah Berurah** (סימן רל"ג ס"ק ב) who rules that צאת הכוכבים is when three medium stars are visible.

### References
- [Shulchan Aruch OC 233:1]
- [Mishnah Berurah 233:2]
- See also: [Biur Halacha ד"ה בצאת]

### Reasoning
We use 8.5° below the horizon as this corresponds to approximately 35 minutes after sunset at equatorial latitudes, matching the traditional "three stars" criterion.
```

### References

- [Source: docs/sprint-artifacts/epic-4-comprehensive-plan.md#Story 4.5]
- [Source: docs/sprint-artifacts/epic-4-ui-wireframes.md#Documentation Panel]
- [bluemonday - Go HTML sanitizer](https://github.com/microcosm-cc/bluemonday)
- [react-markdown](https://github.com/remarkjs/react-markdown)

---

## Testing Requirements

### Unit Tests (Go)
- [ ] `TestSanitizeMarkdown` - strips dangerous HTML
- [ ] `TestSanitizeMarkdown` - preserves valid Markdown
- [ ] `TestSanitizeMarkdown` - handles Hebrew text

### Unit Tests (TypeScript)
- [ ] `formatCitation` produces correct format
- [ ] Source autocomplete filters correctly

### Integration Tests (API)
- [ ] Create zman with halachic notes
- [ ] Update zman halachic notes
- [ ] Get zman returns halachic notes
- [ ] XSS payloads are sanitized

### Component Tests (React)
- [ ] Editor shows preview when toggled
- [ ] Character counter updates
- [ ] Hebrew text renders RTL
- [ ] Markdown preview renders correctly

### E2E Tests (Playwright)
- [ ] Publisher can add halachic notes to zman
- [ ] Notes save and persist correctly
- [ ] Notes appear in Formula Reveal panel
- [ ] Mixed Hebrew/English renders correctly

### Security Tests
- [ ] Script tags stripped
- [ ] Event handlers stripped (onclick, etc.)
- [ ] Data URLs sanitized
- [ ] iframes not allowed

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/4-5-halachic-documentation.context.xml
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
