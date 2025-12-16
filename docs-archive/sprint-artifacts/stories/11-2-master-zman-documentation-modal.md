# Story 11.2: Master Zman Comprehensive Documentation Modal

**Story ID:** 11.2
**Epic:** Epic 11 - Publisher Zmanim Registry Interface
**Points:** 5
**Priority:** HIGH
**Risk:** Low

---

## User Story

**As a** publisher,
**I want** to view full documentation for any master zman including halachic sources, scientific explanations, and related zmanim,
**So that** I can understand the calculation method and halachic basis before importing.

---

## Background

This story implements the comprehensive documentation modal for master zmanim in the Publisher Registry interface. When publishers click the Info button (ℹ️) on any master zman card, they will see a full-screen modal displaying:

- Complete halachic sources and significance
- Scientific and astronomical explanations
- DSL formula with syntax highlighting
- Related zmanim for exploration
- Practical usage notes

This modal is critical for publisher education and confidence. It transforms the master registry from a simple catalog into a comprehensive learning tool that empowers publishers to understand the halachic and astronomical foundations of each calculation.

**Context:**
- Builds on Story 11.1 (Master Registry Browser) which provides the card layout and info button
- Master zman documentation fields populated by Story 11.0 (Data Foundation)
- Will be reused by Story 11.4 (Publisher Zman Documentation Modal)

---

## Acceptance Criteria

### SECTION 1: MODAL STRUCTURE AND DISPLAY

#### AC1.1: Modal Opens from Info Button
- [ ] Info button (ℹ️) appears on every master zman card
- [ ] Clicking Info button opens full-screen modal
- [ ] Modal renders within 200ms (no visible lag)
- [ ] Modal has accessible focus trap

**Verification:**
```bash
# E2E test
cd tests && npx playwright test master-zman-documentation-modal --grep "opens from info button"
```

#### AC1.2: Modal Header Section
- [ ] Displays zman name in Hebrew and English (e.g., "עלות השחר - Alos Hashachar (16.1°)")
- [ ] Displays zman_key reference (e.g., `[@alos_16_1]`)
- [ ] Close button (✕) in top-right corner
- [ ] Header has clear visual hierarchy (large font, bold)

**Verification:**
```tsx
// Component renders all header elements
const modal = screen.getByRole('dialog');
expect(modal).toContainElement(screen.getByText(/עלות השחר/));
expect(modal).toContainElement(screen.getByText(/Alos Hashachar/));
expect(modal).toContainElement(screen.getByText(/\[@alos_16_1\]/));
expect(modal).toContainElement(screen.getByLabelText('Close'));
```

---

### SECTION 2: DOCUMENTATION CONTENT SECTIONS

#### AC2.1: Summary Section
- [ ] Brief one-line description displayed prominently
- [ ] Text is readable (16px font size minimum)
- [ ] Section has clear visual separation from DSL Formula section

**Verification:**
```tsx
const summarySection = screen.getByText(/Summary/i).closest('section');
expect(summarySection).toContainElement(screen.getByText(masterZman.full_description));
```

#### AC2.2: DSL Formula Section
- [ ] Formula displayed with syntax highlighting (CodeMirror)
- [ ] "Copy to Clipboard" button next to formula
- [ ] Formula uses monospace font
- [ ] Syntax highlighting matches algorithm editor (primitives blue, functions green, operators gray)

**Verification:**
```tsx
const formulaSection = screen.getByText(/DSL Formula/i).closest('section');
expect(formulaSection).toContainElement(screen.getByText(/solar\(-16\.1\)/));
expect(formulaSection).toContainElement(screen.getByRole('button', { name: /copy/i }));
```

#### AC2.3: Scientific Explanation Section
- [ ] Plain language explanation of what the zman represents
- [ ] Displayed from `formula_explanation` field
- [ ] Readable typography (line height 1.6+)

**Verification:**
```sql
-- Ensure all master zmanim have this field populated (Story 11.0)
SELECT COUNT(*) FROM master_zmanim_registry
WHERE formula_explanation IS NULL;
-- Expected: 0
```

#### AC2.4: Astronomical Definition Section
- [ ] Technical astronomical details displayed
- [ ] Includes degree calculations, horizon references, etc.
- [ ] Optional section (shown only if data exists)

#### AC2.5: Algorithm Section
- [ ] Calculation method displayed (e.g., "NOAA Solar Calculator")
- [ ] Source attribution shown
- [ ] Optional section (shown only if data exists)

#### AC2.6: Halachic Significance Section
- [ ] How this zman is used in halacha
- [ ] Which opinions use this calculation
- [ ] Practical applications explained
- [ ] Displayed from `usage_context` field (optional)

#### AC2.7: Halachic Sources Section
- [ ] Expandable cards for each posek/opinion
- [ ] Each card shows:
  - Posek name (e.g., "GRA", "MGA", "Baal Hatanya")
  - Explanation of their position
  - Source text reference
- [ ] Cards are collapsible (accordion pattern)
- [ ] Displayed from `halachic_source` field

**Verification:**
```tsx
const sourcesSection = screen.getByText(/Halachic Sources/i).closest('section');
const sourceCards = within(sourcesSection).getAllByRole('button', { expanded: false });
expect(sourceCards.length).toBeGreaterThan(0);

// Expand first source
fireEvent.click(sourceCards[0]);
expect(sourceCards[0]).toHaveAttribute('aria-expanded', 'true');
```

#### AC2.8: Practical Notes Section
- [ ] Usage context and when applicable
- [ ] Real-world examples (if available)
- [ ] Optional section (shown only if data exists)
- [ ] Placeholder text if missing: "No additional information available"

#### AC2.9: Related Zmanim Section
- [ ] Clickable chips/links to similar/alternative calculations
- [ ] Each chip shows zman name (Hebrew + English)
- [ ] Chips are styled distinctly (colored badges)
- [ ] Derived from `related_zmanim_ids` array field

**Verification:**
```tsx
const relatedSection = screen.getByText(/Related Zmanim/i).closest('section');
const relatedLinks = within(relatedSection).getAllByRole('button');
expect(relatedLinks.length).toBeGreaterThan(0);
```

---

### SECTION 3: INTERACTIVE FEATURES

#### AC3.1: Copy to Clipboard Functionality
- [ ] Clicking "Copy to Clipboard" button copies DSL formula
- [ ] Button text changes to "Copied ✓" for 2 seconds
- [ ] Original button text returns after 2 seconds
- [ ] Works on all modern browsers (Chrome, Firefox, Safari, Edge)

**Verification:**
```tsx
const copyButton = screen.getByRole('button', { name: /copy to clipboard/i });
fireEvent.click(copyButton);

// Check clipboard API called
expect(navigator.clipboard.writeText).toHaveBeenCalledWith('solar(-16.1)');

// Check button state change
expect(copyButton).toHaveTextContent(/copied/i);

// Wait 2 seconds
await waitFor(() => {
  expect(copyButton).toHaveTextContent(/copy to clipboard/i);
}, { timeout: 2100 });
```

#### AC3.2: Related Zman Navigation
- [ ] Clicking a related zman link replaces current modal content
- [ ] URL updates with related zman ID (enables back button)
- [ ] Modal title updates to new zman name
- [ ] All sections reload with new zman data
- [ ] Browser back button navigates to previous zman

**Verification:**
```tsx
// Open modal for Alos 16.1
const alosCard = screen.getByText(/Alos Hashachar \(16\.1°\)/);
const alosInfoButton = within(alosCard.closest('[data-testid="zman-card"]')).getByLabelText('Info');
fireEvent.click(alosInfoButton);

// Click related zman "Alos 72 min"
const relatedLink = screen.getByRole('button', { name: /Alos 72 min/i });
fireEvent.click(relatedLink);

// Verify modal content switched
expect(screen.getByText(/Alos 72 min/)).toBeInTheDocument();
expect(screen.queryByText(/Alos Hashachar \(16\.1°\)/)).not.toBeInTheDocument();
```

#### AC3.3: Cycle Detection and Breadcrumbs
- [ ] Breadcrumb trail shows navigation path: "Alos 16.1° > Alos 72 min > ..."
- [ ] Depth limited to 5 levels (prevents infinite loops)
- [ ] Warning shown if visiting a zman already in trail: "You've already viewed this zman in this session"
- [ ] Breadcrumb links are clickable (can jump back to earlier zman)

**Verification:**
```tsx
// Navigate through multiple related zmanim
fireEvent.click(screen.getByRole('button', { name: /Alos 72 min/i }));
fireEvent.click(screen.getByRole('button', { name: /Alos 90 min/i }));
fireEvent.click(screen.getByRole('button', { name: /Alos Hashachar \(16\.1°\)/i })); // Back to first

// Check warning message
expect(screen.getByText(/already viewed this zman/i)).toBeInTheDocument();

// Check breadcrumb
const breadcrumb = screen.getByLabelText('Breadcrumb navigation');
expect(breadcrumb).toHaveTextContent(/Alos 16\.1° > Alos 72 min > Alos 90 min/);
```

#### AC3.4: Keyboard Navigation
- [ ] Pressing Escape key closes modal
- [ ] Pressing Tab cycles through interactive elements (copy button, related links, close button)
- [ ] Focus returns to Info button after modal closes
- [ ] No tab stops outside modal when open (focus trap)

**Verification:**
```tsx
// Open modal
fireEvent.click(screen.getByLabelText('Info'));

// Press Escape
fireEvent.keyDown(document, { key: 'Escape' });

// Modal closes
expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

// Focus returns to trigger
expect(document.activeElement).toBe(screen.getByLabelText('Info'));
```

#### AC3.5: Click Outside to Close
- [ ] Clicking on modal overlay (outside content) closes modal
- [ ] Clicking inside modal content does NOT close modal
- [ ] Overlay is semi-transparent (backdrop-blur effect)

**Verification:**
```tsx
// Click overlay
const overlay = screen.getByTestId('modal-overlay');
fireEvent.click(overlay);

// Modal closes
expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
```

---

### SECTION 4: MISSING DATA HANDLING

#### AC4.1: Optional Fields Show Placeholders
- [ ] If `usage_context` is NULL, section shows: "No additional information available"
- [ ] If `related_zmanim_ids` is empty, section shows: "No related zmanim available"
- [ ] Section is NOT completely hidden (maintains layout consistency)
- [ ] Placeholder text is styled differently (italic, muted color)

**Verification:**
```sql
-- Test with master zman that has missing optional fields
SELECT id FROM master_zmanim_registry
WHERE usage_context IS NULL
LIMIT 1;
```

```tsx
// Open modal for zman with missing data
const modal = screen.getByRole('dialog');
const practicalNotes = within(modal).getByText(/Practical Notes/i).closest('section');
expect(practicalNotes).toContainElement(screen.getByText(/No additional information available/i));
```

#### AC4.2: Required Fields Always Present
- [ ] `full_description` ALWAYS has value (enforced by Story 11.0 validation)
- [ ] `halachic_source` ALWAYS has value (enforced by Story 11.0 validation)
- [ ] `formula_explanation` ALWAYS has value (enforced by Story 11.0 validation)
- [ ] If ANY required field is NULL, show error modal: "Documentation incomplete. Please contact support."

**Verification:**
```sql
-- Validation query (should return 0 rows)
SELECT id, zman_key FROM master_zmanim_registry
WHERE full_description IS NULL
   OR halachic_source IS NULL
   OR formula_explanation IS NULL;
-- Expected: 0 rows
```

---

### SECTION 5: RESPONSIVE DESIGN AND ACCESSIBILITY

#### AC5.1: Desktop Layout
- [ ] Modal max width: 800px, centered
- [ ] Modal has margin on all sides (not edge-to-edge)
- [ ] Content sections have clear visual hierarchy
- [ ] Scrollable content area if content exceeds viewport height

**Verification:**
```tsx
const modal = screen.getByRole('dialog');
const styles = window.getComputedStyle(modal);
expect(styles.maxWidth).toBe('800px');
```

#### AC5.2: Tablet Layout
- [ ] Modal max width: 90vw
- [ ] Font sizes slightly reduced (but still readable: 14px minimum)
- [ ] Sections stack vertically (no multi-column layout)

**Verification:**
```tsx
// Set viewport to tablet size
window.resizeTo(768, 1024);
const modal = screen.getByRole('dialog');
const styles = window.getComputedStyle(modal);
expect(styles.maxWidth).toBe('90vw');
```

#### AC5.3: Mobile Layout
- [ ] Modal is full screen (100vw x 100vh)
- [ ] Header sticky at top (remains visible during scroll)
- [ ] Close button always accessible
- [ ] Font sizes optimized for mobile (16px minimum to prevent zoom)

**Verification:**
```tsx
// Set viewport to mobile size
window.resizeTo(375, 667);
const modal = screen.getByRole('dialog');
const styles = window.getComputedStyle(modal);
expect(styles.width).toBe('100vw');
expect(styles.height).toBe('100vh');
```

#### AC5.4: Accessibility - Semantic HTML
- [ ] Modal uses `<dialog>` element or role="dialog"
- [ ] Header uses `<header>` tag
- [ ] Sections use `<section>` tag with aria-labelledby
- [ ] Related zmanim use `<nav>` tag with aria-label="Related zmanim"
- [ ] Halachic sources use `<details>` or accordion with ARIA

**Verification:**
```tsx
const modal = screen.getByRole('dialog');
expect(modal).toBeInTheDocument();

const header = within(modal).getByRole('banner');
expect(header).toBeInTheDocument();

const nav = within(modal).getByRole('navigation', { name: /related zmanim/i });
expect(nav).toBeInTheDocument();
```

#### AC5.5: Accessibility - ARIA Labels
- [ ] Info button: aria-label="View documentation for [Zman Name]"
- [ ] Close button: aria-label="Close documentation modal"
- [ ] Copy button: aria-label="Copy DSL formula to clipboard"
- [ ] Related zman links: aria-label="View documentation for [Related Zman Name]"
- [ ] Modal: aria-labelledby pointing to modal title

**Verification:**
```tsx
const infoButton = screen.getByLabelText(/view documentation for alos hashachar/i);
expect(infoButton).toBeInTheDocument();

const closeButton = screen.getByLabelText(/close documentation modal/i);
expect(closeButton).toBeInTheDocument();
```

#### AC5.6: Accessibility - Focus Management
- [ ] Modal opens with focus on close button (first interactive element)
- [ ] Focus trapped within modal (cannot tab to elements behind modal)
- [ ] Focus returns to Info button after modal closes
- [ ] All interactive elements are keyboard accessible

**Verification:**
```tsx
// Open modal
fireEvent.click(screen.getByLabelText('Info'));

// Focus is on close button
expect(document.activeElement).toBe(screen.getByLabelText(/close/i));

// Tab through elements
fireEvent.keyDown(document.activeElement, { key: 'Tab' });
// Focus should cycle within modal only
```

#### AC5.7: Accessibility - Color Contrast
- [ ] All text meets WCAG AA contrast ratio (4.5:1 for normal text)
- [ ] All UI elements meet 3:1 contrast ratio
- [ ] Test with color blindness simulators (links are distinguishable without color)

**Verification:**
```bash
# Use axe-core in Playwright tests
cd tests && npx playwright test master-zman-documentation-modal --grep "accessibility"
```

---

### SECTION 6: PERFORMANCE

#### AC6.1: Modal Render Performance
- [ ] Modal opens in <200ms (first paint)
- [ ] Content fully rendered in <500ms
- [ ] No layout shifts during render (CLS score = 0)

**Verification:**
```tsx
const startTime = performance.now();
fireEvent.click(screen.getByLabelText('Info'));
await waitFor(() => screen.getByRole('dialog'));
const endTime = performance.now();
expect(endTime - startTime).toBeLessThan(200);
```

#### AC6.2: Related Zman Navigation Performance
- [ ] Clicking related zman updates content in <300ms
- [ ] No full page reload (SPA behavior)
- [ ] Smooth transition animation (fade or slide)

#### AC6.3: Copy to Clipboard Performance
- [ ] Copy action completes in <50ms
- [ ] Button state change is instant (no delay)

---

## Definition of Done

### Functionality Complete
- [ ] All 6 content sections implemented and tested
- [ ] Copy to clipboard works on all browsers
- [ ] Related zman navigation works (including cycle detection)
- [ ] Keyboard navigation works (Escape, Tab, Enter)
- [ ] Click outside to close works

### Design Implemented
- [ ] Responsive layout (desktop 800px, tablet 90vw, mobile 100%)
- [ ] Syntax highlighting matches algorithm editor
- [ ] Typography readable (16px minimum)
- [ ] Visual hierarchy clear (header > sections > content)

### Accessibility Complete
- [ ] Semantic HTML (dialog, header, section, nav)
- [ ] ARIA labels on all interactive elements
- [ ] Focus trap and focus management
- [ ] Keyboard accessible (no mouse required)
- [ ] Color contrast meets WCAG AA

### Performance Validated
- [ ] Modal opens in <200ms
- [ ] Content renders in <500ms
- [ ] No layout shifts

### Testing Complete
- [ ] Unit tests for component logic
- [ ] Integration tests for modal interactions
- [ ] E2E tests for full workflow
- [ ] Accessibility tests (axe-core)

### Documentation Complete
- [ ] Component documented in `web/components/INDEX.md`
- [ ] Props interface documented with JSDoc comments
- [ ] Usage examples in Storybook (optional)

### Code Quality
- [ ] No TODO/FIXME markers
- [ ] No hardcoded colors (use design tokens)
- [ ] TypeScript types for all props and state
- [ ] ESLint passes with no warnings

### Commit Requirements
- [ ] Commit message: `feat(registry): add master zman documentation modal (Story 11.2)`
- [ ] Code reviewed and approved
- [ ] PR merged to dev branch

---

## Technical Implementation

### Component Structure

```tsx
// web/components/registry/MasterZmanDetailModal.tsx

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CodeMirror } from '@/components/shared/CodeMirror';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

interface MasterZmanDetailModalProps {
  masterZman: MasterZman | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToRelated: (relatedZmanId: number) => void;
}

export function MasterZmanDetailModal({
  masterZman,
  isOpen,
  onClose,
  onNavigateToRelated,
}: MasterZmanDetailModalProps) {
  const [copiedState, setCopiedState] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Copy to clipboard handler
  const handleCopy = async () => {
    if (!masterZman?.formula_dsl) return;
    await navigator.clipboard.writeText(masterZman.formula_dsl);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  // Related zman navigation with cycle detection
  const handleRelatedClick = (relatedZmanId: number, relatedZmanName: string) => {
    if (breadcrumbs.includes(relatedZmanName)) {
      // Show warning (toast or inline message)
      toast.warning("You've already viewed this zman in this session");
      return;
    }

    if (breadcrumbs.length >= 5) {
      toast.warning("Maximum navigation depth reached");
      return;
    }

    setBreadcrumbs((prev) => [...prev, masterZman!.english_name]);
    onNavigateToRelated(relatedZmanId);
  };

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [isOpen]);

  if (!masterZman) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-[800px] max-h-[90vh] overflow-y-auto"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <DialogHeader>
          <DialogTitle id="modal-title">
            {masterZman.hebrew_name} - {masterZman.english_name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground font-mono">
            [@{masterZman.zman_key}]
          </p>
        </DialogHeader>

        {/* Breadcrumb Trail */}
        {breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb navigation" className="text-sm text-muted-foreground">
            {breadcrumbs.join(' > ')} > <strong>{masterZman.english_name}</strong>
          </nav>
        )}

        {/* Summary */}
        <section aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="text-lg font-semibold mb-2">Summary</h2>
          <p>{masterZman.full_description}</p>
        </section>

        {/* DSL Formula */}
        <section aria-labelledby="formula-heading">
          <h2 id="formula-heading" className="text-lg font-semibold mb-2">DSL Formula</h2>
          <div className="relative">
            <CodeMirror
              value={masterZman.formula_dsl}
              readOnly
              className="font-mono"
            />
            <Button
              onClick={handleCopy}
              className="absolute top-2 right-2"
              variant="outline"
              size="sm"
              aria-label="Copy DSL formula to clipboard"
            >
              {copiedState ? 'Copied ✓' : 'Copy to Clipboard'}
            </Button>
          </div>
        </section>

        {/* Scientific Explanation */}
        <section aria-labelledby="scientific-heading">
          <h2 id="scientific-heading" className="text-lg font-semibold mb-2">Scientific Explanation</h2>
          <p>{masterZman.formula_explanation}</p>
        </section>

        {/* Astronomical Definition (optional) */}
        {masterZman.astronomical_definition && (
          <section aria-labelledby="astronomical-heading">
            <h2 id="astronomical-heading" className="text-lg font-semibold mb-2">Astronomical Definition</h2>
            <p>{masterZman.astronomical_definition}</p>
          </section>
        )}

        {/* Algorithm (optional) */}
        {masterZman.algorithm && (
          <section aria-labelledby="algorithm-heading">
            <h2 id="algorithm-heading" className="text-lg font-semibold mb-2">Algorithm</h2>
            <p>{masterZman.algorithm}</p>
          </section>
        )}

        {/* Halachic Significance */}
        <section aria-labelledby="halachic-significance-heading">
          <h2 id="halachic-significance-heading" className="text-lg font-semibold mb-2">Halachic Significance</h2>
          <p>{masterZman.usage_context || 'No additional information available'}</p>
        </section>

        {/* Halachic Sources (expandable) */}
        <section aria-labelledby="halachic-sources-heading">
          <h2 id="halachic-sources-heading" className="text-lg font-semibold mb-2">Halachic Sources</h2>
          <Accordion type="multiple">
            {parsedHalachicSources.map((source, index) => (
              <AccordionItem key={index} value={`source-${index}`}>
                <AccordionTrigger>{source.posek}</AccordionTrigger>
                <AccordionContent>
                  <p><strong>Explanation:</strong> {source.explanation}</p>
                  <p className="text-sm text-muted-foreground mt-2"><strong>Source:</strong> {source.reference}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Practical Notes (optional) */}
        <section aria-labelledby="practical-notes-heading">
          <h2 id="practical-notes-heading" className="text-lg font-semibold mb-2">Practical Notes</h2>
          <p className="italic text-muted-foreground">
            {masterZman.practical_notes || 'No additional information available'}
          </p>
        </section>

        {/* Related Zmanim */}
        {masterZman.related_zmanim && masterZman.related_zmanim.length > 0 && (
          <section aria-labelledby="related-zmanim-heading">
            <h2 id="related-zmanim-heading" className="text-lg font-semibold mb-2">Related Zmanim</h2>
            <nav aria-label="Related zmanim" className="flex flex-wrap gap-2">
              {masterZman.related_zmanim.map((related) => (
                <Button
                  key={related.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleRelatedClick(related.id, related.english_name)}
                  aria-label={`View documentation for ${related.english_name}`}
                >
                  {related.hebrew_name} - {related.english_name}
                </Button>
              ))}
            </nav>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### API Integration (Optional - May Inline in List Response)

```typescript
// web/lib/api-client.ts

export interface MasterZmanDocumentation {
  id: number;
  zman_key: string;
  hebrew_name: string;
  english_name: string;
  full_description: string;
  formula_dsl: string;
  formula_explanation: string;
  astronomical_definition?: string;
  algorithm?: string;
  halachic_source: string;
  usage_context?: string;
  practical_notes?: string;
  related_zmanim_ids?: number[];
  related_zmanim?: Array<{
    id: number;
    zman_key: string;
    hebrew_name: string;
    english_name: string;
  }>;
  shita?: string;
  category?: string;
}

// If separate endpoint needed (otherwise data comes from list response)
export async function getMasterZmanDocumentation(
  api: ApiClient,
  masterZmanId: number
): Promise<MasterZmanDocumentation> {
  return api.get(`/publisher/registry/master/${masterZmanId}/documentation`);
}
```

### Backend Implementation (If Separate Endpoint)

```go
// api/internal/handlers/publisher_registry.go

func (h *RegistryHandler) GetMasterZmanDocumentation(w http.ResponseWriter, r *http.Request) {
	// 1. Resolve publisher (authentication)
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. URL params
	masterZmanIDStr := chi.URLParam(r, "id")
	masterZmanID, err := strconv.ParseInt(masterZmanIDStr, 10, 64)
	if err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid master zman ID")
		return
	}

	// 3. No body to parse

	// 4. Validate (ID > 0)
	if masterZmanID <= 0 {
		RespondError(w, r, http.StatusBadRequest, "Invalid master zman ID")
		return
	}

	// 5. SQLc query
	doc, err := h.db.Queries.GetMasterZmanDocumentation(r.Context(), masterZmanID)
	if err != nil {
		if err == sql.ErrNoRows {
			RespondError(w, r, http.StatusNotFound, "Master zman not found")
			return
		}
		slog.Error("Failed to get master zman documentation",
			"error", err,
			"master_zman_id", masterZmanID)
		RespondError(w, r, http.StatusInternalServerError, "Failed to retrieve documentation")
		return
	}

	// Fetch related zmanim details if IDs exist
	var relatedZmanim []RelatedZman
	if len(doc.RelatedZmanimIds) > 0 {
		relatedZmanim, err = h.db.Queries.GetRelatedZmanimDetails(r.Context(), doc.RelatedZmanimIds)
		if err != nil {
			slog.Warn("Failed to fetch related zmanim details", "error", err)
			// Non-fatal, continue without related details
		}
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"master_zman":     doc,
		"related_zmanim": relatedZmanim,
	})
}
```

### SQLc Query (If Separate Endpoint)

```sql
-- api/internal/db/queries/master_registry.sql

-- name: GetMasterZmanDocumentation :one
SELECT
  id,
  zman_key,
  hebrew_name,
  english_name,
  full_description,
  formula_dsl,
  formula_explanation,
  astronomical_definition,
  algorithm,
  halachic_source,
  usage_context,
  practical_notes,
  related_zmanim_ids,
  shita,
  category
FROM master_zmanim_registry
WHERE id = $1
  AND deleted_at IS NULL;

-- name: GetRelatedZmanimDetails :many
SELECT
  id,
  zman_key,
  hebrew_name,
  english_name
FROM master_zmanim_registry
WHERE id = ANY($1::bigint[])
  AND deleted_at IS NULL
ORDER BY english_name ASC;
```

### Styling (Tailwind + shadcn/ui)

```tsx
// Component uses shadcn/ui primitives:
// - Dialog (from @radix-ui/react-dialog)
// - Button (custom button component)
// - Badge (custom badge component)
// - Accordion (from @radix-ui/react-accordion)

// Custom CSS for syntax highlighting (if CodeMirror not used)
<style>
  .dsl-primitive { color: #3B82F6; } /* blue */
  .dsl-function { color: #10B981; } /* green */
  .dsl-operator { color: #6B7280; } /* gray */
  .dsl-number { color: #F59E0B; } /* orange */
</style>
```

---

## Out of Scope

- Editing master zman documentation (admin-only feature, different epic)
- Printing or exporting documentation (future feature)
- Comparing multiple master zmanim side-by-side (future feature)
- User comments or annotations on documentation (future feature)

---

## Dependencies

**Requires:**
- Story 11.0 (Data Foundation) - Documentation fields populated
- Story 11.1 (Master Registry Browser) - Provides card layout and Info button

**Blocks:**
- Story 11.4 (Publisher Zman Documentation Modal) - Will reuse MasterDocumentationContent component

---

## Estimated Effort

| Task | Hours |
|------|-------|
| Component structure and layout | 3 |
| Content sections implementation | 4 |
| Copy to clipboard feature | 1 |
| Related zman navigation | 2 |
| Cycle detection and breadcrumbs | 2 |
| Keyboard navigation and accessibility | 3 |
| Responsive design (desktop/tablet/mobile) | 2 |
| Styling and polish | 2 |
| Unit and integration tests | 4 |
| E2E tests | 2 |
| Documentation | 1 |
| **Total** | **26** (~5 story points at 5-6 hours per point) |

---

## Notes

- Reuse CodeMirror configuration from algorithm editor for consistent syntax highlighting
- Extract master documentation rendering into shared component (`MasterDocumentationContent.tsx`) for reuse in Story 11.4
- Modal should be lazy-loaded (don't bundle documentation rendering code until Info button clicked)
- Consider using React Query for caching documentation data (reduce API calls for frequently viewed zmanim)
- Hebrew text rendering: Ensure font supports Hebrew characters (use system fonts or web fonts like Frank Ruehl CLM)
- Test with actual KosherJava-populated documentation data (from Story 11.0) to validate layout and content flow
