# Component Registry

## Overview
~100 React components organized by feature. 98% use useApi pattern, 100% use design tokens, 95% check Clerk isLoaded.

## Directory Structure

| Directory | Count | Purpose | Auth Required |
|-----------|-------|---------|---------------|
| ui/ | 25 | shadcn/ui primitives (Button, Card, Dialog, etc.) | N/A |
| publisher/ | 18 | Publisher dashboard components | Publisher |
| shared/ | 18 | Reusable components across roles | Mixed |
| algorithm/ | 8 | Algorithm editor components | Publisher |
| onboarding/ | 6 | New publisher onboarding flow | Publisher |
| formula-builder/ | 8 | Visual formula builder | Publisher |
| zmanim/ | 5 | Public zmanim display | Public |
| admin/ | 3 | Admin dashboard | Admin |
| home/ | 2 | Landing page | Public |
| editor/ | 4 | DSL editor components | Publisher |
| preview/ | 3 | Zmanim preview dialogs | Publisher |

## Key Components

### Publisher Dashboard

| Component | APIs Used | Purpose |
|-----------|-----------|---------|
| PublisherCard.tsx | GET /publisher/context | Publisher profile card |
| ZmanCard.tsx | GET/PUT/DELETE /publisher/zmanim/:id | Zman management card |
| LogoUpload.tsx | POST /upload | Publisher logo upload |
| CoverageSummary.tsx | GET /publisher/coverage | Coverage area summary |
| TeamManagement.tsx | GET/POST/DELETE /publisher/team | Team member management |
| SnapshotHistory.tsx | GET /publisher/snapshots | Version history |
| PublisherProfile.tsx | GET/PUT /publisher/context | Profile editor |

### Algorithm Editor

| Component | APIs Used | Purpose |
|-----------|-----------|---------|
| WeeklyPreviewDialog.tsx | GET /zmanim/preview, GET /publisher/coverage | 7-day preview modal |
| FormulaBuilder.tsx | POST /dsl/validate | Visual formula builder |
| AIGeneratePanel.tsx | POST /ai/suggest-formula | AI formula suggestions |
| HighlightedFormula.tsx | None | Syntax highlighting for DSL |
| BaseTimeSelector.tsx | GET /categories | Select primitive time |
| MethodCard.tsx | None | Formula method selection |

### Location & Coverage

| Component | APIs Used | Purpose |
|-----------|-----------|---------|
| LocationPicker.tsx | GET /cities/search, POST /geo/select | Smart location search with geolocation |
| CoverageMapView.tsx | GET /geo/boundaries | Interactive coverage map (MapLibre GL) |
| CoverageSelector.tsx | GET /cities/search | City/region/country selector |
| CoverageMapDialog.tsx | GET /geo/boundaries | Coverage map modal |

### Onboarding

| Component | APIs Used | Purpose |
|-----------|-----------|---------|
| OnboardingWizard.tsx | POST /onboarding/init, POST /onboarding/publish | Multi-step wizard |
| WelcomeStep.tsx | None | Welcome screen |
| ProfileStep.tsx | None | Publisher profile form |
| AlgorithmStep.tsx | GET /master-registry | Algorithm selection |
| CoverageStep.tsx | GET /cities/search | Coverage selection |
| ReviewPublishStep.tsx | POST /onboarding/publish | Final review and publish |

### Shared Components

| Component | APIs Used | Purpose |
|-----------|-----------|---------|
| BilingualInput.tsx | None | Hebrew/English input pair |
| TagSelector.tsx | GET /master-registry/tags | Tag selection dropdown |
| ZmanName.tsx | None | Display zman name (Hebrew/English) |
| InfoTooltip.tsx | None | Inline help tooltip |
| ProfileDropdown.tsx | None | User profile dropdown menu |
| DevModeBanner.tsx | None | Development mode indicator |
| Footer.tsx | None | Site footer |

### Public Zmanim Display

| Component | APIs Used | Purpose |
|-----------|-----------|---------|
| ZmanimDisplay.tsx | GET /zmanim/:location/:date | Main zmanim table |
| DatePicker.tsx | None | Date selection |
| LocationInput.tsx | GET /cities/search | Location input |
| MethodCard.tsx | GET /publisher/:id | Publisher method card |

### Admin

| Component | APIs Used | Purpose |
|-----------|-----------|---------|
| AdminDashboard.tsx | GET /admin/stats | Admin statistics |
| PublisherManagement.tsx | GET/PUT /admin/publishers | Publisher approval/management |
| UserManagement.tsx | GET/PUT/DELETE /admin/users | User management |

## Pattern Compliance

### useApi Pattern (REQUIRED)
```tsx
'use client';
import { useApi } from '@/lib/api-client';

export function Component() {
  const api = useApi();

  const fetchData = async () => {
    const data = await api.get<DataType>('/endpoint');
    // or api.post(), api.put(), api.delete()
  };
}
```

**Compliance:** 98/100 (98%)
**Violations:**
- `CoverageMapViewGL.tsx:404` - Raw fetch for MapLibre tiles
- `LogoUpload.tsx:150` - Raw fetch for blob conversion

### Design Tokens (REQUIRED)
```tsx
// ✓ CORRECT
className="text-foreground bg-card border-border"
className="text-primary hover:text-primary/80"
className="text-muted-foreground"

// ✗ FORBIDDEN
className="text-[#111827]"
style={{ color: '#ff0000' }}
```

**Compliance:** 100/100 (100%)

### Clerk isLoaded Check (REQUIRED)
```tsx
const { isLoaded, isSignedIn, user } = useUser();

if (!isLoaded) return <Loader2 className="animate-spin" />;
if (!isSignedIn) redirect('/sign-in');
// NOW safe to use user/token
```

**Compliance:** 95/100 (95%)

### React Query Hooks
```tsx
import { usePublisherQuery, usePublisherMutation } from '@/lib/hooks';

const { data, isLoading, error } = usePublisherQuery<DataType>(
  'query-key',
  '/publisher/endpoint'
);

const mutation = usePublisherMutation<Result, Payload>(
  '/publisher/endpoint',
  'POST',
  { invalidateKeys: ['query-key'] }
);
```

**Compliance:** 60/100 (60%) - Gradual migration in progress

## Component Patterns

### Client Component Pattern
```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useApi } from '@/lib/api-client';

export function Component() {
  // 1. Hooks
  const { user, isLoaded } = useUser();
  const api = useApi();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // 2. Callbacks
  const fetchData = useCallback(async () => {
    try {
      setData(await api.get('/endpoint'));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  // 3. Effects
  useEffect(() => {
    if (isLoaded) fetchData();
  }, [isLoaded, fetchData]);

  // 4. Early returns
  if (!isLoaded || isLoading) return <Loader2 className="animate-spin" />;
  if (error) return <div className="text-destructive">{error}</div>;

  // 5. Render
  return <div>{/* content */}</div>;
}
```

### Form Component Pattern
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Required'),
});

export function FormComponent() {
  const api = useApi();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  });

  const onSubmit = async (data) => {
    await api.post('/endpoint', data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* form fields */}
      </form>
    </Form>
  );
}
```

## Component → API Dependencies

### Publisher Endpoints
```
PublisherProfile.tsx → GET/PUT /publisher/context
ZmanCard.tsx → GET/PUT/DELETE /publisher/zmanim/:id
CoverageSummary.tsx → GET /publisher/coverage
TeamManagement.tsx → GET/POST/DELETE /publisher/team
LogoUpload.tsx → POST /upload
SnapshotHistory.tsx → GET /publisher/snapshots
WeeklyPreviewDialog.tsx → GET /zmanim/preview, GET /publisher/coverage
```

### Public Endpoints
```
ZmanimDisplay.tsx → GET /zmanim/:location/:date
LocationPicker.tsx → GET /cities/search, POST /geo/select
CoverageMapView.tsx → GET /geo/boundaries
```

### Admin Endpoints
```
AdminDashboard.tsx → GET /admin/stats
PublisherManagement.tsx → GET/PUT /admin/publishers
UserManagement.tsx → GET/PUT/DELETE /admin/users
```

## State Management

### Global State (PublisherContext)
```tsx
import { usePublisherContext } from '@/providers/PublisherProvider';

const {
  selectedPublisher,
  publishers,
  setSelectedPublisherId,
  isImpersonating
} = usePublisherContext();
```

**Used by:** All publisher/* components

### Local State
- Form state: react-hook-form
- UI state: useState
- Server state: React Query (usePublisherQuery)

## Styling

### Tailwind Classes
- Use semantic design tokens
- Responsive: `sm:`, `md:`, `lg:` breakpoints
- Dark mode: `dark:` variant

### Common Patterns
```tsx
// Card
<Card className="border-border bg-card">
  <CardHeader>
    <CardTitle className="text-foreground">Title</CardTitle>
  </CardHeader>
  <CardContent className="text-muted-foreground">
    Content
  </CardContent>
</Card>

// Button
<Button variant="default" size="sm" className="bg-primary text-primary-foreground">
  Click Me
</Button>

// Loading
<Loader2 className="w-4 h-4 animate-spin" />

// Error
<div className="text-destructive">{error}</div>
```

## Icon Usage

Lucide React icons only:
```tsx
import { Settings, Loader2, ChevronRight } from 'lucide-react';

<Settings className="w-4 h-4" />  // Small
<Loader2 className="w-5 h-5" />   // Medium
<ChevronRight className="w-8 h-8" /> // Large
```

## Time Formatting

ALWAYS use 12-hour format:
```tsx
import { formatTime, formatTimeShort } from '@/lib/utils';

formatTime('14:30:36')      // "2:30:36 PM"
formatTimeShort('14:30:36') // "2:30 PM"
```

## Testing

Component tests use Playwright E2E:
```bash
cd tests && npx playwright test
```

## File Naming

- Components: `PascalCase.tsx` (ComponentName.tsx)
- Hooks: `camelCase.ts` (useHookName.ts)
- Utils: `kebab-case.ts` (utility-name.ts)

## Import Order

1. React/framework
2. Third-party libraries
3. Internal components/hooks
4. Types

```tsx
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import type { Publisher } from '@/types';
```

## Recent Changes

- 2025-12-07: Added LocationPicker geolocation support
- 2025-12-07: Enhanced CoverageMapView with backend-driven selection
- 2025-12-02: Migrated 80% to useApi pattern (from raw fetch)
- 2025-12-01: 100% design token compliance achieved

## Known Issues

- `CoverageMapViewGL.tsx:404`: Raw fetch for MapLibre tile URLs (exempted - third-party library)
- `LogoUpload.tsx:150`: Raw fetch for blob conversion (needs useApi migration)
- React Query migration 60% complete (40 components remaining)

## Performance Notes

- Use `React.memo()` for expensive renders
- Debounce search inputs (300ms)
- Lazy load heavy components (MapLibre, formula editor)
- Image optimization via Next.js Image component

## Accessibility

- All interactive elements have aria-labels
- Keyboard navigation support
- Focus management in modals
- Screen reader friendly
