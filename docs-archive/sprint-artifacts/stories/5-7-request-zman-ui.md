# Story 5.7: Request New Zman UI

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** todo
**Priority:** P1
**Story Points:** 8
**Dependencies:** Story 5.6 (Request New Zman API)
**FRs:** FR109, FR110 (Request new zman UI)

---

## Standards Reference

See `docs/coding-standards.md` sections:
- "Frontend Standards > Component Structure" (hook ordering, state management)
- "Frontend Standards > Unified API Client" (use `useApi()` hook)
- "Frontend Standards > Styling with Tailwind" (use design tokens)
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**UX Considerations:**
- Step 3 (Formula) is optional - make this VERY clear with "Skip this step" button prominently visible
- Consider swapping Step 3 and Step 4 order so Review is always last
- Form validation should debounce (300ms) to prevent lag during fast typing

**Form State:**
- Consider using `react-hook-form` with `zod` for validation instead of manual state management
- This provides better error handling and validation UX

---

## Story

As a **publisher**,
I want **a guided form to request new zmanim**,
So that **I can submit complete requests with proper tags and optional formulas**.

---

## Acceptance Criteria

### AC-5.7.1: Multi-Step Form
- [ ] Page at `/publisher/zmanim/request`
- [ ] Progress indicator showing current step
- [ ] 4 steps: Names → Classification → Formula → Review
- [ ] Back/Next navigation between steps
- [ ] Form state preserved when navigating

### AC-5.7.2: Step 1 - Names
- [ ] Hebrew Name field (required, RTL input)
- [ ] English Name field (required)
- [ ] Transliteration field (optional)
- [ ] Clear labels and validation messages
- [ ] Cannot proceed without required fields

### AC-5.7.3: Step 2 - Classification
- [ ] Browse existing tags by category (event, timing, behavior, shita, method)
- [ ] Multi-select checkboxes for tags
- [ ] Search/filter tags
- [ ] "Request New Tag" button opens dialog
- [ ] New tag form: name, type (dropdown), description
- [ ] New tag requests displayed with "pending" badge

### AC-5.7.4: Step 3 - Formula (Optional)
- [ ] Clearly marked as optional step
- [ ] Simplified DSL editor (CodeMirror, same as advanced mode)
- [ ] Live validation runs as user types
- [ ] Validation errors shown but don't block submission
- [ ] "Skip this step" option

### AC-5.7.5: Step 4 - Review & Submit
- [ ] All entered data displayed in summary format
- [ ] Hebrew/English names shown prominently
- [ ] Tags listed with category badges
- [ ] Formula shown with validation status
- [ ] Justification field (required, text area)
- [ ] "Auto-add to my zmanim" checkbox (default checked)
- [ ] Submit button

### AC-5.7.6: Submission Flow
- [ ] Loading state while submitting
- [ ] Success message with confirmation email notice
- [ ] Redirect to requests list after success
- [ ] Error handling with retry option

### AC-5.7.7: Request List Page
- [ ] Page at `/publisher/zmanim/requests`
- [ ] Table of submitted requests
- [ ] Columns: Name, Status, Submitted Date
- [ ] Status badges: pending (yellow), approved (green), rejected (red)
- [ ] Click to view details

---

## Technical Context

### Page Structure

**File: `web/app/publisher/zmanim/request/page.tsx`**
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ZmanRequestForm } from '@/components/publisher/ZmanRequestForm';
import { useApi } from '@/lib/api-client';

export default function RequestZmanPage() {
  const router = useRouter();
  const api = useApi();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: ZmanRequestData) => {
    setIsSubmitting(true);
    try {
      await api.post('/publisher/zmanim/request', {
        body: JSON.stringify(data),
      });
      toast.success('Request submitted! Check your email for confirmation.');
      router.push('/publisher/zmanim/requests');
    } catch (error) {
      toast.error('Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-2xl font-bold mb-6">Request New Zman</h1>
      <ZmanRequestForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}
```

### Multi-Step Form Component

**File: `web/components/publisher/ZmanRequestForm.tsx`**
```typescript
interface ZmanRequestFormProps {
  onSubmit: (data: ZmanRequestData) => Promise<void>;
  isSubmitting: boolean;
}

export function ZmanRequestForm({ onSubmit, isSubmitting }: ZmanRequestFormProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<ZmanRequestData>>({
    autoAddOnApproval: true,
  });

  const steps = [
    { number: 1, title: 'Names', component: NamesStep },
    { number: 2, title: 'Classification', component: ClassificationStep },
    { number: 3, title: 'Formula', component: FormulaStep },
    { number: 4, title: 'Review', component: ReviewStep },
  ];

  const CurrentStep = steps[step - 1].component;

  return (
    <div>
      {/* Progress indicator */}
      <div className="flex justify-between mb-8">
        {steps.map((s) => (
          <div
            key={s.number}
            className={cn(
              'flex items-center gap-2',
              step >= s.number ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              step >= s.number ? 'bg-primary text-white' : 'bg-muted'
            )}>
              {s.number}
            </div>
            <span className="hidden sm:inline">{s.title}</span>
          </div>
        ))}
      </div>

      {/* Current step content */}
      <CurrentStep
        data={formData}
        onChange={(updates) => setFormData({ ...formData, ...updates })}
        onNext={() => setStep(step + 1)}
        onBack={() => setStep(step - 1)}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        isLastStep={step === 4}
      />
    </div>
  );
}
```

### Tag Selector Component

**File: `web/components/shared/TagSelector.tsx`**
```typescript
interface TagSelectorProps {
  selectedTagIds: string[];
  newTagRequests: NewTagRequest[];
  onTagToggle: (tagId: string) => void;
  onAddNewTag: (tag: NewTagRequest) => void;
  onRemoveNewTag: (index: number) => void;
}

export function TagSelector({
  selectedTagIds,
  newTagRequests,
  onTagToggle,
  onAddNewTag,
  onRemoveNewTag,
}: TagSelectorProps) {
  const { data: tags } = useQuery(['tags'], fetchAllTags);
  const [showNewTagDialog, setShowNewTagDialog] = useState(false);

  // Group tags by category
  const tagsByCategory = groupBy(tags, 'tag_type');

  return (
    <div className="space-y-6">
      {Object.entries(tagsByCategory).map(([category, categoryTags]) => (
        <div key={category}>
          <h4 className="font-medium capitalize mb-2">{category}</h4>
          <div className="flex flex-wrap gap-2">
            {categoryTags.map((tag) => (
              <button
                key={tag.id}
                className={cn(
                  'px-3 py-1 rounded-full text-sm border',
                  selectedTagIds.includes(tag.id)
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white border-gray-300 hover:border-primary'
                )}
                onClick={() => onTagToggle(tag.id)}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* New tag requests */}
      {newTagRequests.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Requested New Tags</h4>
          <div className="flex flex-wrap gap-2">
            {newTagRequests.map((tag, index) => (
              <Badge key={index} variant="outline" className="gap-1">
                {tag.name}
                <span className="text-xs text-yellow-600">(pending)</span>
                <X className="h-3 w-3 cursor-pointer" onClick={() => onRemoveNewTag(index)} />
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Button variant="outline" onClick={() => setShowNewTagDialog(true)}>
        + Request New Tag
      </Button>

      <NewTagDialog
        open={showNewTagDialog}
        onClose={() => setShowNewTagDialog(false)}
        onAdd={onAddNewTag}
      />
    </div>
  );
}
```

---

## Tasks / Subtasks

- [ ] Task 1: Create Request Page
  - [ ] 1.1 Create `web/app/publisher/zmanim/request/page.tsx`
  - [ ] 1.2 Set up multi-step form state management
  - [ ] 1.3 Implement progress indicator

- [ ] Task 2: Create Form Steps
  - [ ] 2.1 Create NamesStep component (Hebrew RTL, English, Transliteration)
  - [ ] 2.2 Create ClassificationStep component
  - [ ] 2.3 Create FormulaStep component (CodeMirror integration)
  - [ ] 2.4 Create ReviewStep component

- [ ] Task 3: Create Tag Selector
  - [ ] 3.1 Create `web/components/shared/TagSelector.tsx`
  - [ ] 3.2 Fetch and display existing tags by category
  - [ ] 3.3 Implement tag toggle selection
  - [ ] 3.4 Create NewTagDialog for requesting new tags

- [ ] Task 4: Formula Step
  - [ ] 4.1 Integrate simplified CodeMirror editor
  - [ ] 4.2 Add live validation
  - [ ] 4.3 Show validation status (valid/invalid) without blocking
  - [ ] 4.4 Add "Skip this step" option

- [ ] Task 5: Review Step
  - [ ] 5.1 Display all entered data in summary
  - [ ] 5.2 Add Justification textarea (required)
  - [ ] 5.3 Add Auto-add checkbox
  - [ ] 5.4 Style validation status

- [ ] Task 6: Create Requests List Page
  - [ ] 6.1 Create `web/app/publisher/zmanim/requests/page.tsx`
  - [ ] 6.2 Implement table with status badges
  - [ ] 6.3 Add click to view details

- [ ] Task 7: API Integration
  - [ ] 7.1 Create useZmanRequest hooks
  - [ ] 7.2 Wire up form submission
  - [ ] 7.3 Handle success/error states
  - [ ] 7.4 Add loading indicators

- [ ] Task 8: Testing
  - [ ] 8.1 Test complete form flow
  - [ ] 8.2 Test validation at each step
  - [ ] 8.3 Test tag selection and new tag requests
  - [ ] 8.4 Test mobile responsiveness

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] All 4 steps implemented and navigable
- [ ] Tag selector with new tag dialog working
- [ ] Formula step clearly marked as optional with "Skip" button
- [ ] Successful submission creates request
- [ ] Requests list page shows submitted requests
- [ ] Mobile responsive
- [ ] Form state persisted when navigating between steps
- [ ] Uses `useApi()` hook (not raw fetch)

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `web/app/publisher/zmanim/request/page.tsx` | Create | Request form page |
| `web/app/publisher/zmanim/requests/page.tsx` | Create | Request list page |
| `web/components/publisher/ZmanRequestForm.tsx` | Create | Multi-step form |
| `web/components/shared/TagSelector.tsx` | Create | Tag selection UI |
| `web/components/shared/NewTagDialog.tsx` | Create | New tag request dialog |

---

## UI Wireframe

```
┌─────────────────────────────────────────────────────────┐
│ Request New Zman                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  (1)──────(2)──────(3)──────(4)                        │
│ Names   Class.  Formula  Review                        │
│   ●───────○───────○───────○                            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ Step 1: Names                                           │
│                                                         │
│ Hebrew Name *                                           │
│ ┌─────────────────────────────────┐                    │
│ │                          (RTL) │                    │
│ └─────────────────────────────────┘                    │
│                                                         │
│ English Name *                                          │
│ ┌─────────────────────────────────┐                    │
│ │                                 │                    │
│ └─────────────────────────────────┘                    │
│                                                         │
│ Transliteration (optional)                              │
│ ┌─────────────────────────────────┐                    │
│ │                                 │                    │
│ └─────────────────────────────────┘                    │
│                                                         │
│                              [Next →]                   │
└─────────────────────────────────────────────────────────┘
```
