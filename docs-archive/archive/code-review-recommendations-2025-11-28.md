# Code Review Recommendations - 2025-11-28

**Reviewer:** AI Code Review + ESLint Analysis
**Scope:** Full codebase review
**Focus Areas:** Ad-hoc styles, authentication patterns, code duplication, reusable functions

---

## ESLint Analysis Summary

**Total Issues: 88** (15 errors, 73 warnings)

| Category | Count | Severity |
|----------|-------|----------|
| `react-hooks/exhaustive-deps` | 24 | Warning |
| `@typescript-eslint/no-unused-vars` | 23 | Warning |
| `@next/next/no-img-element` | 11 | Warning |
| `react/no-unescaped-entities` | 12 | Error |
| `@typescript-eslint/no-explicit-any` | 6 | Warning |
| Other | 12 | Mixed |

---

## Executive Summary

The codebase has several systemic issues that violate DRY (Don't Repeat Yourself) principles and create maintenance burden:

1. **11+ files** define their own `API_BASE` constant instead of importing from `lib/api.ts`
2. **50+ instances** of duplicated fetch-with-auth pattern across components
3. **5+ files** use hardcoded hex colors instead of design tokens
4. **No centralized** authenticated fetch hook despite clear pattern repetition
5. **Status badge styling** is duplicated across multiple components
6. **24 React hooks** have missing dependencies (potential bugs)
7. **23 unused variables** need cleanup
8. **11 `<img>` tags** should use Next.js `<Image>` component

**Severity:** HIGH - These issues compound technical debt and increase bug surface area.

---

## Priority 1: Create Missing Infrastructure (Do First)

### 1.1 Create Centralized Authenticated Fetch Hook

**File to create:** `web/lib/hooks/useAuthenticatedFetch.ts`

```typescript
'use client';

import { useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { usePublisherContext } from '@/providers/PublisherContext';
import { API_BASE } from '@/lib/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface FetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  skipPublisherId?: boolean;
}

export function useAuthenticatedFetch() {
  const { getToken } = useAuth();
  const { selectedPublisher } = usePublisherContext();

  const fetchWithAuth = useCallback(async <T>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T> => {
    const { skipPublisherId, headers: customHeaders, ...fetchOptions } = options;

    // Get token - will throw if not authenticated
    const token = await getToken();
    if (!token) {
      throw new Error('Not authenticated - no token available');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...customHeaders,
    };

    // Add publisher ID for publisher routes (unless explicitly skipped)
    if (!skipPublisherId && selectedPublisher?.id) {
      headers['X-Publisher-Id'] = selectedPublisher.id;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ApiError(
        error.message || `API Error: ${response.status}`,
        response.status,
        error
      );
    }

    const json = await response.json();
    return json.data !== undefined ? json.data : json;
  }, [getToken, selectedPublisher]);

  return { fetchWithAuth };
}
```

### 1.2 Add Status Badge Utilities to globals.css

**File:** `web/app/globals.css`

Add after the existing `@layer utilities` block:

```css
@layer utilities {
  /* Existing utilities... */

  /* Status Badges - Reusable across all components */
  .status-badge {
    @apply inline-flex items-center px-3 py-1 rounded-full text-sm font-medium;
  }

  .status-badge-success {
    @apply status-badge bg-green-100 text-green-800;
  }

  .status-badge-warning {
    @apply status-badge bg-yellow-100 text-yellow-800;
  }

  .status-badge-error {
    @apply status-badge bg-red-100 text-red-800;
  }

  .status-badge-pending {
    @apply status-badge bg-blue-100 text-blue-800;
  }

  .status-badge-neutral {
    @apply status-badge bg-gray-100 text-gray-800;
  }

  /* Form Input Base - Consistent styling */
  .input-base {
    @apply w-full px-4 py-2 border border-input rounded-md bg-background
           focus:outline-none focus:ring-2 focus:ring-ring
           placeholder:text-muted-foreground;
  }

  /* Error Display - Consistent error styling */
  .error-display {
    @apply bg-destructive/10 border border-destructive/20 rounded-md p-4;
  }

  .error-display-text {
    @apply text-destructive text-sm;
  }
}
```

### 1.3 Create Hooks Index File

**File to create:** `web/lib/hooks/index.ts`

```typescript
export { useAuthenticatedFetch, ApiError } from './useAuthenticatedFetch';
```

---

## Priority 2: Remove Duplicated API_BASE Definitions

### Files to Update (remove local API_BASE, import from lib/api)

| File | Line | Action |
|------|------|--------|
| `web/app/accept-invitation/page.tsx` | 10 | Delete line, add `import { API_BASE } from '@/lib/api';` |
| `web/app/admin/settings/page.tsx` | 8 | Delete line, add `import { API_BASE } from '@/lib/api';` |
| `web/app/admin/publishers/[id]/page.tsx` | 31 | Delete line, add `import { API_BASE } from '@/lib/api';` |
| `web/app/admin/publishers/new/page.tsx` | 10 | Delete line, add `import { API_BASE } from '@/lib/api';` |
| `web/app/publisher/activity/page.tsx` | 8 | Delete line, add `import { API_BASE } from '@/lib/api';` |
| `web/app/become-publisher/page.tsx` | 8 | Delete line, add `import { API_BASE } from '@/lib/api';` |
| `web/app/zmanim/[cityId]/page.tsx` | 8 | Delete line, add `import { API_BASE } from '@/lib/api';` |
| `web/app/zmanim/[cityId]/[publisherId]/page.tsx` | 13 | Delete line, add `import { API_BASE } from '@/lib/api';` |
| `web/app/publisher/analytics/page.tsx` | 8 | Delete line, add `import { API_BASE } from '@/lib/api';` |
| `web/app/publisher/coverage/page.tsx` | 27 | Delete line, add `import { API_BASE } from '@/lib/api';` |
| `web/app/publisher/team/page.tsx` | 29 | Delete line, add `import { API_BASE } from '@/lib/api';` |

**Note:** `web/app/publisher/profile/page.tsx` already correctly imports from `@/lib/api`.

---

## Priority 3: Fix Hardcoded Colors

### 3.1 Badge Component

**File:** `web/components/ui/badge.tsx`

**Current (line 11):**
```tsx
default: 'bg-[#1e3a5f] text-white',
```

**Replace with:**
```tsx
default: 'bg-primary text-primary-foreground',
```

### 3.2 DatePicker Component

**File:** `web/components/DatePicker.tsx`

**Current (line 99):**
```tsx
w-full bg-apple-blue hover:bg-[#0051D5]
```

**Replace with:**
```tsx
w-full bg-apple-blue hover:bg-apple-blue/90
```

### 3.3 LocationInput Component

**File:** `web/components/LocationInput.tsx`

**Current (line 148):**
```tsx
flex-1 bg-apple-blue hover:bg-[#0051D5]
```

**Replace with:**
```tsx
flex-1 bg-apple-blue hover:bg-apple-blue/90
```

### 3.4 BecomePublisher Page

**File:** `web/app/become-publisher/page.tsx`

**Current (line 170):**
```tsx
<Link href="/" className="text-2xl font-bold text-[#1e3a5f] mb-4 inline-block">
```

**Replace with:**
```tsx
<Link href="/" className="text-2xl font-bold text-primary mb-4 inline-block">
```

### 3.5 Constants File

**File:** `web/lib/constants.ts`

**Current (lines 37-55):**
```typescript
export const CATEGORY_COLORS = {
  fixed: {
    bg: '#007AFF',
    text: 'text-[#007AFF]',
    border: 'border-[#007AFF]',
    accent: 'bg-blue-50',
  },
  // ...
};
```

**Replace with design tokens:**
```typescript
export const CATEGORY_COLORS = {
  fixed: {
    bg: 'hsl(var(--primary))',
    text: 'text-primary',
    border: 'border-primary',
    accent: 'bg-primary/10',
  },
  zmaniyos: {
    bg: 'hsl(var(--chart-4))',
    text: 'text-chart-4',
    border: 'border-chart-4',
    accent: 'bg-chart-4/10',
  },
  angle: {
    bg: 'hsl(var(--destructive))',
    text: 'text-destructive',
    border: 'border-destructive',
    accent: 'bg-destructive/10',
  },
};
```

---

## Priority 4: Refactor Components to Use Centralized Hooks

Once `useAuthenticatedFetch` is created, refactor these high-traffic components:

### 4.1 Publisher Coverage Page (Most Complex)

**File:** `web/app/publisher/coverage/page.tsx`

This file has **7 separate fetch calls** with identical patterns. Refactor to:

```typescript
// Before: 7 duplicate patterns like this
const token = await getToken();
const response = await fetch(`${API_BASE}/api/v1/publisher/coverage`, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Publisher-Id': selectedPublisher.id,
  },
});

// After: Clean single-line calls
const { fetchWithAuth } = useAuthenticatedFetch();
const data = await fetchWithAuth<CoverageData>('/api/v1/publisher/coverage');
```

### 4.2 Publisher Team Page

**File:** `web/app/publisher/team/page.tsx`

Has **5 fetch calls** - refactor similarly.

### 4.3 Admin Publishers Detail Page

**File:** `web/app/admin/publishers/[id]/page.tsx`

Has **7 fetch calls** - refactor similarly.

### 4.4 Publisher Algorithm Page

**File:** `web/app/publisher/algorithm/page.tsx`

Has **4 fetch calls** - refactor similarly.

---

## Priority 5: Create Missing Reusable Components

### 5.1 StatusBadge Component

**File to create:** `web/components/ui/status-badge.tsx`

```tsx
import { cn } from '@/lib/utils';

type BadgeVariant = 'success' | 'warning' | 'error' | 'pending' | 'neutral';

interface StatusBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'status-badge-success',
  warning: 'status-badge-warning',
  error: 'status-badge-error',
  pending: 'status-badge-pending',
  neutral: 'status-badge-neutral',
};

export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return (
    <span className={cn(variantClasses[variant], className)}>
      {children}
    </span>
  );
}

// Usage helper for common status values
export function getStatusVariant(status: string): BadgeVariant {
  switch (status.toLowerCase()) {
    case 'verified':
    case 'active':
    case 'approved':
    case 'done':
      return 'success';
    case 'pending':
    case 'draft':
    case 'in-progress':
      return 'pending';
    case 'suspended':
    case 'rejected':
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'neutral';
  }
}
```

### 5.2 ErrorDisplay Component

**File to create:** `web/components/ui/error-display.tsx`

```tsx
import { AlertCircle } from 'lucide-react';
import { Button } from './button';

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorDisplay({ message, onRetry, className }: ErrorDisplayProps) {
  return (
    <div className={`error-display ${className || ''}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="error-display-text">{message}</p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-3"
            >
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 5.3 LoadingSpinner Component

**File to create:** `web/components/ui/loading-spinner.tsx`

```tsx
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export function LoadingSpinner({ size = 'md', className, text }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}
```

---

## Priority 6: Add Type Definitions

### 6.1 Clerk Metadata Types

**File to create:** `web/types/clerk.ts`

```typescript
export interface ClerkPublicMetadata {
  role?: 'admin' | 'publisher' | 'user';
  publisher_access_list?: string[];
  primary_publisher_id?: string;
  organization?: string;
}

export interface ClerkUser {
  id: string;
  publicMetadata: ClerkPublicMetadata;
  primaryEmailAddress?: {
    emailAddress: string;
  };
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
}
```

### 6.2 API Response Types

**File to create:** `web/types/api.ts`

```typescript
export interface ApiResponse<T> {
  data: T;
  meta?: {
    timestamp: string;
    request_id?: string;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
  meta?: {
    timestamp: string;
    request_id?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

// Publisher types
export interface Publisher {
  id: string;
  name: string;
  organization?: string;
  email: string;
  website?: string;
  bio?: string;
  logo_url?: string;
  status: 'pending' | 'verified' | 'suspended';
  created_at: string;
  updated_at: string;
}

// Coverage types
export interface Coverage {
  id: string;
  publisher_id: string;
  coverage_level: 'country' | 'region' | 'city';
  country_code: string | null;
  region: string | null;
  city_id: string | null;
  display_name: string;
  is_active: boolean;
}
```

---

## Implementation Order

1. **Day 1: Infrastructure**
   - [ ] Create `useAuthenticatedFetch` hook
   - [ ] Add utility classes to globals.css
   - [ ] Create type definition files

2. **Day 2: Quick Wins**
   - [ ] Remove all duplicated API_BASE definitions (11 files)
   - [ ] Fix all hardcoded colors (5 files)

3. **Day 3: Component Refactoring**
   - [ ] Create StatusBadge, ErrorDisplay, LoadingSpinner components
   - [ ] Refactor publisher/coverage page to use new hook

4. **Day 4-5: Systematic Refactoring**
   - [ ] Refactor remaining pages to use centralized hooks
   - [ ] Replace inline status badge styling with StatusBadge component

---

## Testing Checklist

After each change, verify:

- [ ] No TypeScript errors
- [ ] Page loads correctly
- [ ] API calls work with authentication
- [ ] Styling looks consistent
- [ ] E2E tests pass (run affected tests)

---

## Appendix A: Full ESLint Report

### ERRORS (Must Fix - 15 total)

**Unescaped entities in JSX (fix by escaping quotes):**
```
app/admin/page.tsx:96,104
app/admin/publishers/[id]/page.tsx:589
app/publisher/analytics/page.tsx:104
app/publisher/dashboard/page.tsx:199
components/onboarding/steps/ReviewPublishStep.tsx:59
components/onboarding/steps/WelcomeStep.tsx:36,72
```

**Other errors:**
```
components/publisher/CitySelector.tsx:125 - 'url' should be const
components/ui/textarea.tsx:6 - Empty interface
tailwind.config.ts:136 - require() not allowed
```

### WARNINGS - React Hooks (24 total)

Files with missing useEffect/useCallback dependencies:
```
app/accept-invitation/page.tsx:42
app/admin/dashboard/page.tsx:61
app/admin/settings/page.tsx:77
app/zmanim/[cityId]/page.tsx:52
app/zmanim/[cityId]/[publisherId]/page.tsx:88
components/ZmanimDisplay.tsx:43
components/algorithm/VersionDiff.tsx:36
components/algorithm/VersionHistory.tsx:58
components/algorithms/BrowseAlgorithms.tsx:77
components/algorithms/MyForks.tsx:29
components/editor/DSLEditor.tsx:192
components/formula-builder/FormulaBuilder.tsx:62
components/onboarding/OnboardingWizard.tsx:68
components/onboarding/steps/CustomizeZmanimStep.tsx:31
components/preview/WeeklyPreview.tsx:121
components/publisher/AlgorithmPreview.tsx:50
components/publisher/MonthPreview.tsx:51
components/publisher/TemplateSelector.tsx:38
components/publisher/VersionHistory.tsx:32
components/publisher/ZmanConfigModal.tsx:71
components/shared/ProfileDropdown.tsx:35
components/zmanim/FormulaExplanation.tsx:72
```

### WARNINGS - Unused Variables (23 total)

```
app/accept-invitation/page.tsx:76 - err
app/admin/dashboard/page.tsx:67 - trend
app/become-publisher/page.tsx:106 - err
app/publisher/activity/page.tsx:24,53 - error, err
app/publisher/team/page.tsx:134 - err
app/zmanim/[cityId]/[publisherId]/page.tsx:11 - ZmanFormula
components/ZmanimDisplay.tsx:168-216 - 9 unused relative time functions
components/editor/DSLEditor.tsx:4-15 - 7 unused imports
components/editor/FormulaEditorPage.tsx:5,50 - ChevronDown, setKey
components/formula-builder/methods/SolarAngleForm.tsx:5 - cn
components/preview/WeeklyPreview.tsx:83-87 - 5 unused destructured vars
components/publisher/CitySelector.tsx:6 - ChevronDown
components/zmanim/FormulaPanel.tsx:4 - X
lib/location.ts:65 - offset
providers/PublisherContext.tsx:51 - publisherIds
```

### WARNINGS - Use Next.js Image (11 total)

Replace `<img>` with `<Image>` from next/image:
```
app/admin/publishers/[id]/page.tsx:608
app/publisher/team/page.tsx:323
app/zmanim/[cityId]/[publisherId]/page.tsx:203
app/zmanim/[cityId]/page.tsx:190
components/PublisherCard.tsx:39
components/algorithms/BrowseAlgorithms.tsx:235
components/publisher/LogoUpload.tsx:157
components/shared/PublisherCard.tsx:45
components/ui/avatar.tsx:37
```

### WARNINGS - any Type (6 total)

```
app/admin/publishers/new/page.tsx:75
app/admin/settings/page.tsx:12,79
app/debug-auth/page.tsx:26,30
lib/api.ts:41
middleware.ts:10
```

---

## Notes

- The Go backend passes `go vet` with no issues
- TypeScript compilation passes with no errors
- The Go backend authentication (`api/internal/middleware/auth.go`) is well-structured and doesn't need changes
- The Clerk service (`api/internal/services/clerk_service.go`) is properly factored
- Focus is on frontend code duplication and styling consistency

---

## Quick Fix Commands

```bash
# Auto-fix what ESLint can fix
cd web && npx eslint . --ext .ts,.tsx --fix

# Check TypeScript
npm run type-check

# Run lint after fixes
npx eslint . --ext .ts,.tsx
```

---

_Generated: 2025-11-28_
_Review Scope: Full codebase_
_Tools Used: ESLint 8.57.1, TypeScript, go vet_
