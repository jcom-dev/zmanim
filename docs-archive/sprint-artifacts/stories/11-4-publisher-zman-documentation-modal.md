# Story 11.4: Publisher Zman Documentation Modal

**Epic:** Epic 11 - Publisher Zmanim Registry Interface
**Status:** todo
**Priority:** P1
**Story Points:** 3
**Dependencies:** Story 11.2 (Master Zman Documentation Modal), Story 11.3 (Publisher Examples Browser)
**FRs:** FR28-FR29 (Publisher Zman Documentation)

---

## Standards Reference

See `docs/coding-standards.md` sections:
- "Frontend Standards > Component Structure" (hook ordering, state management)
- "Frontend Standards > Styling with Tailwind" (use design tokens)
- "Frontend Standards > Component Reusability" (DRY principle)
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Related Frontend Code:**
- `web/components/registry/MasterZmanDetailModal.tsx` - Master modal to reuse from
- `web/components/registry/RegistryPublisherBrowser.tsx` - Integration point

---

## Story

As a **publisher**,
I want **to view documentation for publisher zmanim showing both their custom implementation AND the inherited master documentation**,
So that **I can understand how a specific publisher adapted the formula while still seeing the canonical halachic basis**.

---

## Acceptance Criteria

### AC-11.4.1: Modal Trigger
- [ ] Given I am viewing a publisher zman card
- [ ] When I click the Info button (ℹ️)
- [ ] Then a documentation modal opens with two distinct sections

### AC-11.4.2: Publisher-Specific Section (Top)
- [ ] Modal displays header with publisher name + "Validated Publisher" badge
- [ ] Zman name shown (may be customized by publisher)
- [ ] Publisher DSL formula displayed with syntax highlighting (CodeMirror)
- [ ] "Copy to Clipboard" button functional for publisher formula
- [ ] Master registry reference shown: "Based on: [Master Zman Name]"
- [ ] Custom notes displayed (if publisher added any)
- [ ] Attribution displayed based on type:
  - If linked: "Linked from [Source Publisher Name]"
  - If copied: "Copied from [Source Publisher Name]"
  - If direct master import: (no attribution shown)

### AC-11.4.3: Master Documentation Section (Bottom)
- [ ] Divider with text: "Master Zman Documentation"
- [ ] Inherited master documentation displayed with all sections:
  - Summary
  - Formula explanation
  - Scientific explanation
  - Astronomical definition
  - Algorithm
  - Halachic significance
  - Halachic sources (expandable cards)
  - Practical notes
  - Related zmanim (clickable links)

### AC-11.4.4: Related Zmanim Navigation
- [ ] Given the publisher zman modal is open
- [ ] When I click a related zman link in the master documentation section
- [ ] Then the modal is replaced with that master zman's full documentation modal
- [ ] And I can navigate back using browser back button or close modal

### AC-11.4.5: Copy to Clipboard Functionality
- [ ] Given the publisher zman modal is open
- [ ] When I click "Copy to Clipboard" in the publisher formula section
- [ ] Then the publisher's DSL formula is copied (not the master formula)
- [ ] And button text temporarily changes to "Copied ✓" for 2 seconds

### AC-11.4.6: Conditional Custom Notes Display
- [ ] Given the publisher zman has no custom notes
- [ ] When that section would be displayed
- [ ] Then the "Custom Notes" section is hidden (not shown)

### AC-11.4.7: Modal Close Behavior
- [ ] Given the publisher zman modal is open
- [ ] When I press Escape key OR click outside modal (on overlay)
- [ ] Then the modal closes

### AC-11.4.8: Responsive Design
- [ ] Desktop: Modal max width 800px, centered
- [ ] Tablet: Modal max width 90vw
- [ ] Mobile: Modal full screen

### AC-11.4.9: Accessibility
- [ ] Focus trapped in modal when open
- [ ] Semantic HTML used (header, section, nav)
- [ ] ARIA labels on all interactive elements
- [ ] Focus returns to Info button after modal closes
- [ ] Keyboard navigation: Tab through elements, Escape to close

---

## Technical Context

### Component Architecture

**File: `web/components/registry/PublisherZmanDetailModal.tsx`**

The component should reuse the master documentation rendering logic:
- Extract master documentation section from `MasterZmanDetailModal.tsx` into shared component: `MasterDocumentationContent.tsx`
- Both modals import and use this shared component
- Fetch master zman documentation via `master_zmanim_id` from publisher zman

### Shared Component Extraction

**File: `web/components/registry/MasterDocumentationContent.tsx`**
```typescript
interface MasterDocumentationContentProps {
  masterZman: MasterZman;
  onRelatedZmanClick?: (masterZmanId: number) => void;
}

export function MasterDocumentationContent({
  masterZman,
  onRelatedZmanClick
}: MasterDocumentationContentProps) {
  // Render all master documentation sections:
  // - Summary
  // - Formula explanation
  // - Scientific explanation
  // - Astronomical definition
  // - Algorithm
  // - Halachic significance
  // - Halachic sources (expandable cards)
  // - Practical notes
  // - Related zmanim (clickable links)
}
```

### Publisher Modal Structure

**File: `web/components/registry/PublisherZmanDetailModal.tsx`**
```typescript
interface PublisherZmanDetailModalProps {
  publisherZman: PublisherZman;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToMasterZman?: (masterZmanId: number) => void;
}

export function PublisherZmanDetailModal({
  publisherZman,
  isOpen,
  onClose,
  onNavigateToMasterZman
}: PublisherZmanDetailModalProps) {
  // Top Section: Publisher-specific fields
  // - Header with publisher name + badge
  // - Zman name (customized)
  // - Publisher DSL formula (syntax-highlighted)
  // - Copy to clipboard button
  // - Master reference: "Based on: [Master Zman Name]"
  // - Custom notes (if any)
  // - Attribution (linked/copied/direct)

  // Divider

  // Bottom Section: Inherited master documentation
  // - Use <MasterDocumentationContent /> component
}
```

### Data Fetching

The publisher zman object should include:
- `master_zmanim_id` - to fetch master documentation
- `linked_from_publisher_zman_id` - for attribution
- `copied_from_publisher_id` - for attribution
- `custom_notes` - publisher's custom notes (optional)
- Publisher details (name, etc.)

If master documentation is not already included in the API response:
- Fetch via `master_zmanim_id` from the same API endpoint used by master modal
- OR extend publisher zman API to include nested master documentation

### Modal Styling

Use shadcn/ui Dialog component for modal foundation:
```typescript
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
```

Responsive styling:
```typescript
<DialogContent className="max-w-[800px] desktop:max-w-[800px] tablet:max-w-[90vw] mobile:max-w-full mobile:h-full">
  {/* Content */}
</DialogContent>
```

### CodeMirror Integration

Reuse existing CodeMirror setup from algorithm editor:
```typescript
import { CodeMirrorDSLEditor } from '@/components/editor/CodeMirrorDSLEditor';

<CodeMirrorDSLEditor
  value={publisherZman.formula_dsl}
  readOnly={true}
  showLineNumbers={false}
  height="auto"
/>
```

### Copy to Clipboard

```typescript
const [copied, setCopied] = useState(false);

const handleCopy = async () => {
  await navigator.clipboard.writeText(publisherZman.formula_dsl);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```

---

## Tasks / Subtasks

- [ ] Task 1: Extract Shared Master Documentation Component
  - [ ] 1.1 Create `web/components/registry/MasterDocumentationContent.tsx`
  - [ ] 1.2 Extract master documentation sections from `MasterZmanDetailModal.tsx`
  - [ ] 1.3 Add `onRelatedZmanClick` callback prop
  - [ ] 1.4 Test with master modal to ensure no regression

- [ ] Task 2: Create Publisher Zman Modal Component
  - [ ] 2.1 Create `web/components/registry/PublisherZmanDetailModal.tsx`
  - [ ] 2.2 Implement publisher-specific top section layout
  - [ ] 2.3 Add publisher name + "Validated Publisher" badge
  - [ ] 2.4 Integrate CodeMirror for formula display (read-only)
  - [ ] 2.5 Add "Copy to Clipboard" button with state management
  - [ ] 2.6 Display master reference link
  - [ ] 2.7 Conditionally render custom notes section
  - [ ] 2.8 Implement attribution logic (linked/copied/direct)

- [ ] Task 3: Integrate Master Documentation Section
  - [ ] 3.1 Add divider with "Master Zman Documentation" label
  - [ ] 3.2 Import and render `MasterDocumentationContent` component
  - [ ] 3.3 Pass master zman data from publisher zman object
  - [ ] 3.4 Wire up related zman navigation callback

- [ ] Task 4: Modal Behavior & Accessibility
  - [ ] 4.1 Implement Escape key handler
  - [ ] 4.2 Implement click-outside-to-close
  - [ ] 4.3 Add focus trap using shadcn/ui Dialog
  - [ ] 4.4 Ensure focus returns to Info button on close
  - [ ] 4.5 Add ARIA labels for all interactive elements
  - [ ] 4.6 Test keyboard navigation (Tab, Escape)

- [ ] Task 5: Responsive Design
  - [ ] 5.1 Test modal on desktop (800px max width)
  - [ ] 5.2 Test modal on tablet (90vw max width)
  - [ ] 5.3 Test modal on mobile (full screen)
  - [ ] 5.4 Verify scrolling behavior with long content
  - [ ] 5.5 Test formula syntax highlighting on small screens

- [ ] Task 6: Integration with Publisher Browser
  - [ ] 6.1 Import `PublisherZmanDetailModal` in `RegistryPublisherBrowser.tsx`
  - [ ] 6.2 Add state for selected publisher zman and modal open
  - [ ] 6.3 Wire Info button click to open modal
  - [ ] 6.4 Handle navigation to master zman modal (cross-modal navigation)
  - [ ] 6.5 Test end-to-end flow from publisher card to modal

- [ ] Task 7: Testing
  - [ ] 7.1 Test with linked publisher zman (verify attribution)
  - [ ] 7.2 Test with copied publisher zman (verify attribution)
  - [ ] 7.3 Test with direct master import (no attribution)
  - [ ] 7.4 Test with custom notes present
  - [ ] 7.5 Test with no custom notes (section hidden)
  - [ ] 7.6 Test copy to clipboard functionality
  - [ ] 7.7 Test related zman navigation
  - [ ] 7.8 Test modal close (Escape, click outside, X button)

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] `MasterDocumentationContent.tsx` extracted and tested with master modal (no regression)
- [ ] `PublisherZmanDetailModal.tsx` created and functional
- [ ] Publisher-specific section displays all required fields
- [ ] Master documentation section displays using shared component
- [ ] Copy to clipboard works for publisher formula
- [ ] Attribution logic correctly handles linked/copied/direct cases
- [ ] Custom notes section conditionally rendered
- [ ] Related zman navigation functional
- [ ] Modal close behavior works (Escape, click outside)
- [ ] Responsive design tested on desktop, tablet, mobile
- [ ] Accessibility requirements met (focus trap, ARIA labels, keyboard nav)
- [ ] Integration tested with publisher browser
- [ ] Manual testing completed with all publisher zman types

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `web/components/registry/MasterDocumentationContent.tsx` | Create | Shared master documentation rendering |
| `web/components/registry/PublisherZmanDetailModal.tsx` | Create | Publisher zman modal component |
| `web/components/registry/MasterZmanDetailModal.tsx` | Modify | Extract shared content, use new shared component |
| `web/components/registry/RegistryPublisherBrowser.tsx` | Modify | Integrate publisher modal |

---

## Component Reusability Strategy

### Before (Story 11.2):
```
MasterZmanDetailModal.tsx
├── All master documentation sections (inline)
└── Related zmanim navigation
```

### After (Story 11.4):
```
MasterDocumentationContent.tsx (SHARED)
├── Summary
├── Formula explanation
├── Scientific explanation
├── Astronomical definition
├── Algorithm
├── Halachic significance
├── Halachic sources
├── Practical notes
└── Related zmanim

MasterZmanDetailModal.tsx
└── Uses <MasterDocumentationContent />

PublisherZmanDetailModal.tsx
├── Publisher-specific section (top)
│   ├── Publisher name + badge
│   ├── Custom zman name
│   ├── Publisher formula (CodeMirror)
│   ├── Copy to clipboard
│   ├── Master reference
│   ├── Custom notes (conditional)
│   └── Attribution (linked/copied/direct)
├── Divider
└── Uses <MasterDocumentationContent /> (bottom)
```

---

## Attribution Logic Reference

| Condition | Attribution Display |
|-----------|---------------------|
| `linked_from_publisher_zman_id` IS NOT NULL | "Linked from [Source Publisher Name]" |
| `copied_from_publisher_id` IS NOT NULL | "Copied from [Source Publisher Name]" |
| Both NULL (direct master import) | (No attribution section) |

---

## UX Spec Reference

See Epic 11: Story 11.4 (lines 446-514) for complete acceptance criteria and technical notes.
