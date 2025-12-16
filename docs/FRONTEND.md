# Frontend

Next.js frontend architecture, components, and patterns for Shtetl Zmanim.

---

## Overview

- **Framework:** Next.js 16 (App Router)
- **React:** 19
- **Styling:** Tailwind CSS + shadcn/ui
- **State:** React Query + Context
- **Auth:** Clerk

### Structure

```
web/
├── app/                          # Next.js pages
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   ├── sign-in/                  # Auth pages
│   ├── admin/                    # Admin dashboard
│   ├── publisher/                # Publisher portal
│   │   ├── dashboard/
│   │   ├── algorithm/
│   │   ├── coverage/
│   │   ├── team/
│   │   └── ...
│   └── zmanim/                   # Public zmanim display
├── components/                   # React components
│   ├── ui/                       # shadcn/ui primitives
│   ├── publisher/                # Dashboard components
│   ├── algorithm/                # Formula editor
│   ├── shared/                   # Reusable components
│   └── ...
├── lib/                          # Utilities
│   ├── api-client.ts             # HTTP client
│   ├── hooks/                    # React Query hooks
│   └── utils.ts                  # Helpers
└── providers/                    # React contexts
```

---

## API Client

### useApi Hook

All HTTP requests go through the unified API client:

```tsx
import { useApi } from '@/lib/api-client';

function MyComponent() {
  const api = useApi();

  // Publisher endpoint (Auth + X-Publisher-Id header)
  const profile = await api.get<Profile>('/publisher/profile');

  // POST with body
  const result = await api.post<Zman, CreateRequest>('/publisher/zmanim', {
    key: 'alos',
    hebrew_name: 'עלות השחר'
  });

  // Public endpoint (no auth)
  const countries = await api.public.get<Country[]>('/countries');

  // Admin endpoint (Auth only, no X-Publisher-Id)
  const stats = await api.admin.get<Stats>('/admin/stats');
}
```

### FORBIDDEN Pattern

```tsx
// NEVER use raw fetch()
fetch(`${API_BASE}/api/v1/endpoint`)  // FORBIDDEN

// ALWAYS use api client
const api = useApi();
await api.get('/endpoint');
```

---

## React Query

### Query Hooks

```tsx
import { usePublisherQuery } from '@/lib/hooks';

function ZmanimList() {
  const { data, isLoading, error, refetch } = usePublisherQuery<Zman[]>(
    'zmanim-list',              // Query key
    '/publisher/zmanim'         // Endpoint
  );

  if (isLoading) return <Loader2 className="animate-spin" />;
  if (error) return <div className="text-destructive">{error.message}</div>;

  return (
    <ul>
      {data?.map(zman => (
        <li key={zman.id}>{zman.hebrew_name}</li>
      ))}
    </ul>
  );
}
```

### Mutation Hooks

```tsx
import { usePublisherMutation } from '@/lib/hooks';

function CreateZmanForm() {
  const mutation = usePublisherMutation<Zman, CreateRequest>(
    '/publisher/zmanim',
    'POST',
    {
      invalidateKeys: ['zmanim-list'],  // Invalidate after success
      onSuccess: (data) => {
        toast.success('Zman created');
      }
    }
  );

  const handleSubmit = (data: CreateRequest) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      {mutation.isPending && <Loader2 className="animate-spin" />}
      {mutation.error && <div className="text-destructive">{mutation.error.message}</div>}
      {/* form fields */}
    </form>
  );
}
```

### Built-in Hooks

| Hook | Purpose |
|------|---------|
| `useZmanimList()` | All publisher zmanim |
| `useZmanDetails(id)` | Single zman |
| `useCreateZman()` | Create mutation |
| `useUpdateZman(id)` | Update mutation |
| `useDeleteZman()` | Delete mutation |
| `usePreviewFormula()` | Formula preview |
| `usePreviewWeek()` | Week preview |
| `useLocationSearch(query)` | Location search |
| `useLocality(id)` | Locality details |
| `useMasterZmanim()` | Master registry |
| `usePublisherCoverage()` | Coverage areas |
| `usePublisherSnapshots()` | Backup snapshots |

---

## Component Pattern

### Standard Component

```tsx
'use client';  // Only if using hooks, events, or browser APIs

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';
import { useApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

interface Props {
  zmanId: number;
}

export function ZmanEditor({ zmanId }: Props) {
  // 1. Hooks first
  const { isLoaded, user } = useUser();
  const api = useApi();
  const [data, setData] = useState<Zman | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 2. Effects
  useEffect(() => {
    if (isLoaded) {
      loadZman();
    }
  }, [isLoaded, zmanId]);

  async function loadZman() {
    try {
      const result = await api.get<Zman>(`/publisher/zmanim/${zmanId}`);
      setData(result);
    } catch (err) {
      setError('Failed to load zman');
    }
  }

  // 3. Early returns: Loading -> Error -> Content
  if (!isLoaded) {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  if (error) {
    return <div className="text-destructive">{error}</div>;
  }

  if (!data) {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  // 4. Main render
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{data.hebrew_name}</h2>
      <p className="text-muted-foreground">{data.formula_dsl}</p>
      <Button onClick={loadZman}>Refresh</Button>
    </div>
  );
}
```

### Clerk Auth Check

```tsx
const { isLoaded, isSignedIn, user } = useUser();

// ALWAYS check isLoaded first
if (!isLoaded) {
  return <Loader2 className="animate-spin" />;
}

if (!isSignedIn) {
  redirect('/sign-in');
}

// Now safe to access user
console.log(user.id);
```

---

## Design System

### Design Tokens

Use design tokens for all colors:

```tsx
// CORRECT - Design tokens
<div className="text-foreground bg-background">
<div className="text-muted-foreground">
<Button className="bg-primary text-primary-foreground">
<div className="border-border">

// FORBIDDEN - Hardcoded colors
<div className="text-[#1e3a5f]">
<div style={{ color: '#ff0000' }}>
```

### Token Reference

| Token | Usage |
|-------|-------|
| `foreground` | Primary text |
| `background` | Page background |
| `card` / `card-foreground` | Card surfaces |
| `primary` / `primary-foreground` | CTAs, links |
| `secondary` / `secondary-foreground` | Secondary buttons |
| `muted` / `muted-foreground` | Disabled, secondary text |
| `destructive` / `destructive-foreground` | Errors, delete |
| `border` | Borders |
| `input` | Form input borders |
| `ring` | Focus rings |
| `accent` | Hover backgrounds |

### Status Colors Exception

Status colors require dark mode variant:

```tsx
<span className="text-green-600 dark:text-green-400">Active</span>
<span className="text-red-600 dark:text-red-400">Error</span>
<span className="text-yellow-600 dark:text-yellow-400">Warning</span>
```

---

## Component Library

### shadcn/ui Components

Located in `web/components/ui/`:

| Component | Usage |
|-----------|-------|
| `Button` | Actions, CTAs |
| `Input` | Text inputs |
| `Select` | Dropdowns (NEVER use native `<select>`) |
| `Dialog` | Modals |
| `Card` | Content containers |
| `Table` | Data tables |
| `Tabs` | Tab navigation |
| `Tooltip` | Hover hints |
| `Popover` | Floating content |
| `Command` | Searchable lists |
| `DropdownMenu` | Action menus |

### Select Component (MANDATORY)

```tsx
// FORBIDDEN - Native select
<select value={x} onChange={(e) => setValue(e.target.value)}>
  <option value="a">Option A</option>
</select>

// REQUIRED - shadcn Select
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

<Select value={x} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="a">Option A</SelectItem>
    <SelectItem value="b">Option B</SelectItem>
  </SelectContent>
</Select>
```

### Component Selection Guide

| Use Case | Component |
|----------|-----------|
| Single value selection | `Select` |
| Actions menu | `DropdownMenu` |
| Searchable selection | `Popover` + `Command` |
| Date picking | `DatePickerDropdown` |
| Multi-select with categories | `TagSelector` |
| Geographic search | `LocalityPicker` |

---

## Key Components

### Publisher Dashboard

| Component | Purpose |
|-----------|---------|
| `ZmanCard` | Individual zman management |
| `ZmanimList` | List of all zmanim |
| `PreviewToolbar` | Locality, date, language selection |
| `CoveragePreviewMap` | MapLibre coverage visualization |
| `ActivityLog` | Audit trail display |

### Formula Editor

| Component | Purpose |
|-----------|---------|
| `DSLEditor` | CodeMirror-based formula editor |
| `FormulaBuilder` | Visual formula construction |
| `FormulaPreview` | Live calculation preview |
| `WeekPreview` | 7-day preview table |
| `DSLReference` | Function documentation sidebar |

### Registry Browser

| Component | Purpose |
|-----------|---------|
| `RegistryBrowser` | Master registry navigation |
| `MasterZmanDetailModal` | Zman documentation modal |
| `ZmanDocumentation` | Detailed zman info |

### Shared Components

| Component | Purpose |
|-----------|---------|
| `LocalityPicker` | Location search with autocomplete |
| `DatePickerDropdown` | Date selection |
| `LanguageToggle` | Hebrew/English switch |
| `LoadingSpinner` | Consistent loading state |
| `ErrorBoundary` | Error handling wrapper |

---

## Time Formatting

### 12-Hour Format Only

```tsx
import { formatTime, formatTimeShort } from '@/lib/utils';

formatTime('14:30:36')      // "2:30:36 PM"
formatTimeShort('14:30:36') // "2:30 PM"
```

### Hebrew Date

```tsx
import { formatHebrewDate } from '@/lib/hebrew-date';

formatHebrewDate('2025-01-15')  // "15 Teves 5785"
```

---

## Providers

### Provider Hierarchy

```tsx
// app/layout.tsx
<ClerkProvider>
  <QueryClientProvider>
    <ThemeProvider>
      <PublisherProvider>
        <PreferencesProvider>
          {children}
        </PreferencesProvider>
      </PublisherProvider>
    </ThemeProvider>
  </QueryClientProvider>
</ClerkProvider>
```

### PublisherContext

```tsx
import { usePublisher } from '@/providers/PublisherContext';

function MyComponent() {
  const { publisher, isLoading, switchPublisher } = usePublisher();

  if (isLoading) return <Loader2 />;

  return (
    <div>
      <h1>{publisher.name}</h1>
      <Button onClick={() => switchPublisher(2)}>Switch</Button>
    </div>
  );
}
```

### PreferencesContext

```tsx
import { usePreferences } from '@/providers/PreferencesContext';

function MyComponent() {
  const { locale, setLocale, preferredLocality } = usePreferences();

  return (
    <Button onClick={() => setLocale(locale === 'en' ? 'he' : 'en')}>
      Toggle Language
    </Button>
  );
}
```

---

## Page Structure

### Publisher Pages

```
app/publisher/
├── layout.tsx              # Publisher layout with sidebar
├── dashboard/
│   └── page.tsx            # Main dashboard
├── algorithm/
│   ├── page.tsx            # Zmanim list
│   └── edit/[zman_key]/
│       └── page.tsx        # Formula editor
├── coverage/
│   └── page.tsx            # Coverage management
├── team/
│   └── page.tsx            # Team members
├── profile/
│   └── page.tsx            # Publisher settings
├── registry/
│   └── page.tsx            # Master registry browser
├── primitives/
│   └── page.tsx            # Astronomical primitives
├── analytics/
│   └── page.tsx            # Statistics
├── activity/
│   └── page.tsx            # Audit log
└── correction-requests/
    └── page.tsx            # Community feedback
```

### Admin Pages

```
app/admin/
├── layout.tsx              # Admin layout
├── page.tsx                # Dashboard
├── publishers/
│   └── page.tsx            # Manage publishers
├── users/
│   └── page.tsx            # Manage users
└── correction-requests/
    └── page.tsx            # All correction requests
```

---

## Form Handling

### React Hook Form Pattern

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  hebrew_name: z.string().min(1, 'Required'),
  formula_dsl: z.string().min(1, 'Required'),
});

type FormData = z.infer<typeof schema>;

function ZmanForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      hebrew_name: '',
      formula_dsl: '',
    },
  });

  const onSubmit = (data: FormData) => {
    // Handle submit
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input
        {...form.register('hebrew_name')}
        error={form.formState.errors.hebrew_name?.message}
      />
      <Button type="submit" disabled={form.formState.isSubmitting}>
        Save
      </Button>
    </form>
  );
}
```

---

## Error Handling

### Error Boundary

```tsx
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

<ErrorBoundary fallback={<ErrorFallback />}>
  <ComponentThatMightFail />
</ErrorBoundary>
```

### API Errors

```tsx
import { humanizeError } from '@/lib/error-humanizer';

try {
  await api.post('/endpoint', data);
} catch (err) {
  const message = humanizeError(err);
  toast.error(message);
}
```

### Common Error States

```tsx
function DataDisplay() {
  const { data, error, isLoading } = useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{error.message}</p>
        <Button variant="outline" size="sm" onClick={refetch} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No data available
      </div>
    );
  }

  return <DataTable data={data} />;
}
```

---

## Testing

### Component Testing

```tsx
// tests/components/ZmanCard.test.tsx
import { render, screen } from '@testing-library/react';
import { ZmanCard } from '@/components/publisher/ZmanCard';

describe('ZmanCard', () => {
  it('displays zman name', () => {
    render(<ZmanCard zman={{ hebrew_name: 'עלות השחר' }} />);
    expect(screen.getByText('עלות השחר')).toBeInTheDocument();
  });
});
```

### E2E Page Tests

```typescript
// tests/publisher/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test('publisher can view dashboard', async ({ page }) => {
  await loginAsPublisher(page, publisherId);
  await page.goto('/publisher/dashboard');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
```

---

## Performance

### Code Splitting

```tsx
import dynamic from 'next/dynamic';

// Heavy components loaded on demand
const MapComponent = dynamic(
  () => import('@/components/publisher/CoveragePreviewMap'),
  { loading: () => <Loader2 className="animate-spin" /> }
);
```

### Image Optimization

```tsx
import Image from 'next/image';

<Image
  src="/logo.png"
  alt="Logo"
  width={200}
  height={50}
  priority  // For above-the-fold images
/>
```

### Memoization

```tsx
import { useMemo, useCallback } from 'react';

const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
```

---

## File Organization

### Component Index

Every component folder should have an `INDEX.md` file documenting:

1. Component purpose
2. Props interface
3. Usage examples
4. Dependencies

### Import Aliases

```tsx
// Use @ alias for clean imports
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/api-client';
import { formatTime } from '@/lib/utils';

// Avoid relative imports
import { Button } from '../../../components/ui/button';  // AVOID
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Component files | PascalCase | `ZmanCard.tsx` |
| Hook files | camelCase | `useZmanimList.ts` |
| Utility files | camelCase | `api-client.ts` |
| Types | PascalCase | `interface ZmanProps` |
| CSS classes | kebab-case | `zman-card-header` |
