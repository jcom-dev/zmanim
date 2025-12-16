# Story 4.11: Publisher Onboarding Wizard

**Epic:** Epic 4 - Intuitive Zmanim Algorithm Editor with AI-Powered DSL
**Status:** ready-for-dev
**Priority:** P2
**Story Points:** 8
**Dependencies:** Story 4.4 (Guided Formula Builder), Story 4.3 (Bilingual Naming)

---

## Story

As a **new publisher**,
I want **a guided onboarding wizard that walks me through setting up my first algorithm**,
So that **I can quickly start publishing zmanim without feeling overwhelmed by all the options**.

---

## Acceptance Criteria

### AC-4.11.1: Wizard Flow
- [ ] Multi-step wizard with progress indicator
- [ ] Steps: Welcome → Template Selection → Customize Key Zmanim → Coverage Setup → Review & Publish
- [ ] Can navigate back to previous steps
- [ ] Progress saved if wizard abandoned (resume later)

### AC-4.11.2: Welcome Step
- [ ] Explains what the publisher will accomplish
- [ ] Shows estimated time to complete (5-10 minutes)
- [ ] Video or animated demo option
- [ ] "Skip wizard" option for experienced users

### AC-4.11.3: Template Selection
- [ ] Present 4 base templates: GRA Standard, Magen Avraham, Rabbeinu Tam, Custom
- [ ] Each template shows preview of key zmanim
- [ ] Brief explanation of each approach
- [ ] "Help me choose" option with questionnaire

### AC-4.11.4: Customize Key Zmanim
- [ ] Focus on 5-7 most common zmanim only
- [ ] Simplified controls (not full formula builder)
- [ ] Live preview of today's times as changes made
- [ ] "Advanced customization" link for power users
- [ ] Bilingual names pre-filled from template

### AC-4.11.5: Coverage Setup
- [ ] Simplified coverage selection (city search)
- [ ] Suggest common cities based on locale
- [ ] Map visualization of selected coverage
- [ ] "Add more coverage later" messaging

### AC-4.11.6: Review & Publish
- [ ] Summary of all selections
- [ ] Preview of how zmanim will appear to users
- [ ] "Publish" button to make algorithm live
- [ ] Confetti or celebration animation on success
- [ ] Next steps guidance (add more zmanim, expand coverage)

### AC-4.11.7: Onboarding State
- [ ] Track onboarding completion status per publisher
- [ ] Show "Complete Setup" prompt if not finished
- [ ] Hide wizard for publishers who completed or skipped
- [ ] Admin can reset onboarding state

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Component tests pass for each wizard step
- [ ] Integration tests pass for state persistence
- [ ] E2E tests pass for complete wizard flow
- [ ] UX review completed for new user experience
- [ ] Mobile responsiveness verified
- [ ] Code review workflow executed (`/bmad:bmm:workflows:code-review`)

---

## Tasks / Subtasks

- [ ] Task 1: Wizard Framework (AC: 4.11.1)
  - [ ] 1.1 Create `OnboardingWizard` container component
  - [ ] 1.2 Implement step navigation state
  - [ ] 1.3 Create progress indicator component
  - [ ] 1.4 Implement step transitions/animations
  - [ ] 1.5 Add keyboard navigation (Enter to continue)

- [ ] Task 2: Welcome Step (AC: 4.11.2)
  - [ ] 2.1 Create `WelcomeStep` component
  - [ ] 2.2 Design welcome content and messaging
  - [ ] 2.3 Add optional video/demo
  - [ ] 2.4 Add "Skip wizard" button
  - [ ] 2.5 Track time estimate

- [ ] Task 3: Template Selection (AC: 4.11.3)
  - [ ] 3.1 Create `TemplateSelectionStep` component
  - [ ] 3.2 Design template cards with previews
  - [ ] 3.3 Implement template data structure
  - [ ] 3.4 Create "Help me choose" questionnaire
  - [ ] 3.5 Load template into state on selection

- [ ] Task 4: Customize Key Zmanim (AC: 4.11.4)
  - [ ] 4.1 Create `CustomizeZmanimStep` component
  - [ ] 4.2 Design simplified customization controls
  - [ ] 4.3 Show live preview panel
  - [ ] 4.4 Pre-fill bilingual names
  - [ ] 4.5 Link to advanced formula builder

- [ ] Task 5: Coverage Setup (AC: 4.11.5)
  - [ ] 5.1 Create `CoverageSetupStep` component
  - [ ] 5.2 Implement city search with suggestions
  - [ ] 5.3 Add map visualization
  - [ ] 5.4 Suggest cities based on locale
  - [ ] 5.5 Handle multiple coverage selections

- [ ] Task 6: Review & Publish (AC: 4.11.6)
  - [ ] 6.1 Create `ReviewPublishStep` component
  - [ ] 6.2 Display summary of all selections
  - [ ] 6.3 Show zmanim preview as users will see
  - [ ] 6.4 Implement publish action
  - [ ] 6.5 Add celebration animation
  - [ ] 6.6 Show next steps guidance

- [ ] Task 7: State Persistence (AC: 4.11.1, 4.11.7)
  - [ ] 7.1 Create onboarding state API endpoints
  - [ ] 7.2 Save progress on each step completion
  - [ ] 7.3 Resume from saved state on return
  - [ ] 7.4 Track completion status in database
  - [ ] 7.5 Add admin reset capability

- [ ] Task 8: Testing
  - [ ] 8.1 Write component tests for each step
  - [ ] 8.2 Write integration tests for persistence
  - [ ] 8.3 Write E2E tests for complete flow
  - [ ] 8.4 Mobile responsiveness testing
  - [ ] 8.5 UX review and iteration

---

## Dev Notes

### Wizard State Structure

```typescript
interface OnboardingState {
  currentStep: number;
  completedSteps: number[];
  data: {
    template: TemplateType | null;
    customizations: ZmanCustomization[];
    coverage: CoverageSelection[];
  };
  startedAt: string;
  lastUpdatedAt: string;
}

type TemplateType = 'gra' | 'mga' | 'rabbeinu_tam' | 'custom';

interface ZmanCustomization {
  key: string;
  nameHebrew: string;
  nameEnglish: string;
  formula: string;
  modified: boolean;
}

interface CoverageSelection {
  type: 'city' | 'region' | 'country';
  id: string;
  name: string;
}
```

### Template Definitions

```typescript
const TEMPLATES: Record<TemplateType, Template> = {
  gra: {
    name: 'GRA Standard',
    nameHebrew: 'גר"א סטנדרטי',
    description: 'Based on the Vilna Gaon, uses sunrise to sunset for proportional hours',
    zmanim: [
      { key: 'alos', formula: 'solar(16.1, before_sunrise)', nameHebrew: 'עלות השחר', nameEnglish: 'Dawn' },
      { key: 'sunrise', formula: 'sunrise', nameHebrew: 'נץ החמה', nameEnglish: 'Sunrise' },
      { key: 'sof_zman_shema', formula: 'sunrise + shaos(3, gra)', nameHebrew: 'סוף זמן שמע', nameEnglish: 'Latest Shema' },
      { key: 'sof_zman_tefillah', formula: 'sunrise + shaos(4, gra)', nameHebrew: 'סוף זמן תפילה', nameEnglish: 'Latest Shacharit' },
      { key: 'chatzos', formula: 'solar_noon', nameHebrew: 'חצות', nameEnglish: 'Midday' },
      { key: 'mincha_gedolah', formula: 'solar_noon + shaos(0.5, gra)', nameHebrew: 'מנחה גדולה', nameEnglish: 'Earliest Mincha' },
      { key: 'sunset', formula: 'sunset', nameHebrew: 'שקיעה', nameEnglish: 'Sunset' },
      { key: 'tzais', formula: 'solar(8.5, after_sunset)', nameHebrew: 'צאת הכוכבים', nameEnglish: 'Nightfall' },
    ],
  },
  mga: {
    name: 'Magen Avraham',
    nameHebrew: 'מגן אברהם',
    description: 'Uses dawn to nightfall (72 minutes) for proportional hours',
    zmanim: [
      { key: 'alos', formula: 'sunrise - 72min', nameHebrew: 'עלות השחר', nameEnglish: 'Dawn' },
      // ... more zmanim
    ],
  },
  // ... other templates
};
```

### Wizard Container Component

```tsx
// web/components/onboarding/OnboardingWizard.tsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { WelcomeStep } from './steps/WelcomeStep';
import { TemplateSelectionStep } from './steps/TemplateSelectionStep';
import { CustomizeZmanimStep } from './steps/CustomizeZmanimStep';
import { CoverageSetupStep } from './steps/CoverageSetupStep';
import { ReviewPublishStep } from './steps/ReviewPublishStep';
import { WizardProgress } from './WizardProgress';

const STEPS = [
  { id: 'welcome', title: 'Welcome', component: WelcomeStep },
  { id: 'template', title: 'Choose Template', component: TemplateSelectionStep },
  { id: 'customize', title: 'Customize Zmanim', component: CustomizeZmanimStep },
  { id: 'coverage', title: 'Set Coverage', component: CoverageSetupStep },
  { id: 'review', title: 'Review & Publish', component: ReviewPublishStep },
];

export function OnboardingWizard() {
  const [state, setState] = useState<OnboardingState | null>(null);

  // Load saved state
  const { data: savedState } = useQuery({
    queryKey: ['onboarding-state'],
    queryFn: fetchOnboardingState,
  });

  // Save state on changes
  const saveMutation = useMutation({
    mutationFn: saveOnboardingState,
  });

  useEffect(() => {
    if (savedState) {
      setState(savedState);
    }
  }, [savedState]);

  const currentStep = state?.currentStep ?? 0;
  const StepComponent = STEPS[currentStep].component;

  const goToStep = (step: number) => {
    const newState = { ...state, currentStep: step, lastUpdatedAt: new Date().toISOString() };
    setState(newState);
    saveMutation.mutate(newState);
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <WizardProgress steps={STEPS} currentStep={currentStep} />

      <div className="mt-8">
        <StepComponent
          state={state}
          onUpdate={(updates) => setState({ ...state, ...updates })}
          onNext={() => goToStep(currentStep + 1)}
          onBack={() => goToStep(currentStep - 1)}
          onSkip={() => window.location.href = '/publisher/algorithm'}
        />
      </div>
    </div>
  );
}
```

### "Help Me Choose" Questionnaire

```tsx
const QUESTIONNAIRE = [
  {
    question: "What tradition does your community follow?",
    questionHebrew: "איזה מנהג הקהילה שלך?",
    options: [
      { value: 'ashkenaz', label: 'Ashkenazi', suggests: 'gra' },
      { value: 'sefard', label: 'Sephardi', suggests: 'gra' },
      { value: 'chabad', label: 'Chabad', suggests: 'mga' },
      { value: 'yemenite', label: 'Yemenite', suggests: 'gra' },
      { value: 'unsure', label: "I'm not sure", suggests: 'gra' },
    ],
  },
  {
    question: "How do you calculate the earliest time for Shema?",
    options: [
      { value: 'sunrise', label: 'From sunrise', suggests: 'gra' },
      { value: 'dawn', label: 'From dawn (72 minutes before sunrise)', suggests: 'mga' },
      { value: 'unsure', label: "I'm not sure", suggests: 'gra' },
    ],
  },
];
```

### Celebration Animation

```tsx
// web/components/onboarding/Confetti.tsx
import Confetti from 'react-confetti';
import { useWindowSize } from '@/hooks/useWindowSize';

export function SuccessConfetti() {
  const { width, height } = useWindowSize();

  return (
    <Confetti
      width={width}
      height={height}
      recycle={false}
      numberOfPieces={500}
      gravity={0.3}
    />
  );
}
```

### API Endpoints

```go
// GET /api/publisher/onboarding
// Returns current onboarding state or null if not started

// PUT /api/publisher/onboarding
// Saves onboarding state

// POST /api/publisher/onboarding/complete
// Marks onboarding as complete, creates algorithm from wizard data

// DELETE /api/publisher/onboarding
// Admin: resets onboarding state
```

### References

- [Source: docs/sprint-artifacts/epic-4-comprehensive-plan.md#Story 4.11]
- [Source: docs/sprint-artifacts/epic-4-ui-wireframes.md#Onboarding Wizard]

---

## Testing Requirements

### Component Tests (React)
- [ ] WizardProgress shows correct step
- [ ] WelcomeStep renders correctly
- [ ] TemplateSelectionStep loads templates
- [ ] CustomizeZmanimStep shows live preview
- [ ] CoverageSetupStep handles city search
- [ ] ReviewPublishStep shows summary

### Integration Tests (API)
- [ ] GET onboarding state returns saved state
- [ ] PUT onboarding state saves correctly
- [ ] Complete endpoint creates algorithm
- [ ] Resume from saved state works

### E2E Tests (Playwright)
- [ ] New publisher sees onboarding wizard
- [ ] Can navigate through all steps
- [ ] Can go back to previous steps
- [ ] Template selection updates preview
- [ ] Customization changes show in preview
- [ ] Coverage selection works
- [ ] Publish creates live algorithm
- [ ] Celebration animation shows
- [ ] Wizard hidden after completion

### UX Tests
- [ ] Mobile layout works correctly
- [ ] Progress indicator accurate
- [ ] Skip option works
- [ ] Time estimate reasonable

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/4-11-publisher-onboarding.context.xml
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
