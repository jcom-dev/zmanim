# Story 8-35: Zman Card Time Preview for Selected Date - Technical Design

**Status:** Ready for Development
**Date:** 2025-12-14
**Priority:** Medium

---

## Executive Summary

Add a live time preview directly on each ZmanCard in the algorithm editor, showing the calculated result for the current page date and location. This creates a tight feedback loop for publishers editing formulas.

**Key Behavior:**
- Each zman card shows calculated time inline
- Updates when formula, date, or location changes
- Respects display preferences (seconds toggle, rounding)
- Uses debouncing and caching for performance

---

## Current State Analysis

### Algorithm Page Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Algorithm Page (/publisher/algorithm)                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  Page State:                                                             │
│  - previewDate: Date (shared with AlgorithmPreview)                     │
│  - previewLocation: PreviewLocation (lat, lng, tz, displayName)         │
│  - zmanim: PublisherZman[] (from useZmanimList hook)                    │
│                                                                          │
│  ┌──────────────────┐    ┌─────────────────────────────────────────┐   │
│  │  ZmanCard        │    │  AlgorithmPreview (right sidebar)       │   │
│  │  - name          │    │  - Shows ALL zmanim with times          │   │
│  │  - formula       │    │  - Uses /publisher/zmanim?date=...      │   │
│  │  - badges        │    │  - Debounced 300ms                      │   │
│  │  - NO TIME ❌    │    └─────────────────────────────────────────┘   │
│  └──────────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### ZmanCard Current Structure

From `web/components/publisher/ZmanCard.tsx`:
- 979 lines, handles editing, publishing, version history
- Does NOT display calculated time
- Receives `zman: PublisherZman` which contains `formula_dsl`
- No access to date/location context

### AlgorithmPreview Calculation

From `web/components/publisher/AlgorithmPreview.tsx`:
- Calls `GET /publisher/zmanim?date=...&latitude=...&longitude=...&timezone=...`
- Backend returns `{ day_context, zmanim: [{ time, error }] }`
- Client formats time with `formatTime()`

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Algorithm Page                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Context Providers:                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  AlgorithmPreviewContext (NEW)                                      ││
│  │  - previewDate: DateTime                                            ││
│  │  - previewLocation: PreviewLocation                                 ││
│  │  - calculatedTimes: Map<zman_key, { time?, error? }>                ││
│  │  - isCalculating: boolean                                           ││
│  │  - triggerRecalculate: () => void                                   ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌──────────────────┐    ┌─────────────────────────────────────────┐   │
│  │  ZmanCard        │    │  AlgorithmPreview                       │   │
│  │  - formula       │    │  - Same data source                     │   │
│  │  - ZmanTimePreview│   │  - Preview table                        │   │
│  │    ↓ consumes     │    │                                         │   │
│  │    calculatedTimes│    │                                         │   │
│  └──────────────────┘    └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Page level** - Manages date/location, fetches all calculations
2. **Context** - Shares calculated times with all ZmanCards
3. **ZmanCard** - Looks up its own time from context
4. **Formula edit** - Triggers recalculation via context

### Approach Decision

**Option A: Client-side DSL calculation (kosher-zmanim)**
- Pros: No API call per card, instant feedback
- Cons: Complex to support full DSL, references, edge cases

**Option B: Centralized API call (CHOSEN)**
- Pros: Uses existing backend DSL engine, consistent results
- Cons: Slight latency (acceptable with debouncing)

**Decision:** Option B - Leverage existing `/publisher/zmanim` endpoint that already returns calculated times. The AlgorithmPreview already does this; we'll share the data.

---

## Implementation

### 1. AlgorithmPreviewContext

```typescript
// File: web/lib/contexts/AlgorithmPreviewContext.tsx

'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useApi } from '@/lib/api-client';
import { DateTime } from 'luxon';

interface PreviewLocation {
  latitude: number;
  longitude: number;
  timezone: string;
  displayName: string;
}

interface CalculatedTime {
  time?: string;  // HH:mm:ss format
  error?: string;
}

interface DayContext {
  date: string;
  hebrew_date: string;
  is_shabbos: boolean;
  is_yom_tov: boolean;
  // ... other fields from API
}

interface AlgorithmPreviewContextValue {
  // State
  previewDate: Date;
  previewLocation: PreviewLocation | null;
  dayContext: DayContext | null;
  calculatedTimes: Map<string, CalculatedTime>;
  isCalculating: boolean;

  // Setters
  setPreviewDate: (date: Date) => void;
  setPreviewLocation: (location: PreviewLocation) => void;

  // Actions
  getTimeForZman: (zmanKey: string) => CalculatedTime | null;
  triggerRecalculate: () => void;
}

const AlgorithmPreviewContext = createContext<AlgorithmPreviewContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  initialDate?: Date;
  initialLocation?: PreviewLocation | null;
}

export function AlgorithmPreviewProvider({
  children,
  initialDate = new Date(),
  initialLocation = null,
}: ProviderProps) {
  const api = useApi();

  const [previewDate, setPreviewDate] = useState<Date>(initialDate);
  const [previewLocation, setPreviewLocation] = useState<PreviewLocation | null>(initialLocation);
  const [dayContext, setDayContext] = useState<DayContext | null>(null);
  const [calculatedTimes, setCalculatedTimes] = useState<Map<string, CalculatedTime>>(new Map());
  const [isCalculating, setIsCalculating] = useState(false);
  const [recalculateTrigger, setRecalculateTrigger] = useState(0);

  // Format date for API
  const dateStr = previewDate.toISOString().split('T')[0];

  // Fetch calculations when inputs change
  useEffect(() => {
    if (!previewLocation || previewLocation.latitude === 0) {
      setCalculatedTimes(new Map());
      setDayContext(null);
      return;
    }

    const abortController = new AbortController();

    const fetchCalculations = async () => {
      setIsCalculating(true);

      try {
        const params = new URLSearchParams({
          date: dateStr,
          latitude: previewLocation.latitude.toString(),
          longitude: previewLocation.longitude.toString(),
          timezone: previewLocation.timezone,
        });

        const response = await api.get<{
          day_context: DayContext;
          zmanim: Array<{ zman_key: string; time?: string; error?: string }>;
        }>(`/publisher/zmanim?${params}`, { signal: abortController.signal });

        if (!abortController.signal.aborted) {
          setDayContext(response.day_context);

          const timesMap = new Map<string, CalculatedTime>();
          for (const z of response.zmanim || []) {
            timesMap.set(z.zman_key, { time: z.time, error: z.error });
          }
          setCalculatedTimes(timesMap);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error('Failed to calculate preview:', err);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsCalculating(false);
        }
      }
    };

    // Debounce
    const timeoutId = setTimeout(fetchCalculations, 300);

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [api, dateStr, previewLocation, recalculateTrigger]);

  const getTimeForZman = useCallback((zmanKey: string): CalculatedTime | null => {
    return calculatedTimes.get(zmanKey) || null;
  }, [calculatedTimes]);

  const triggerRecalculate = useCallback(() => {
    setRecalculateTrigger((prev) => prev + 1);
  }, []);

  return (
    <AlgorithmPreviewContext.Provider
      value={{
        previewDate,
        previewLocation,
        dayContext,
        calculatedTimes,
        isCalculating,
        setPreviewDate,
        setPreviewLocation,
        getTimeForZman,
        triggerRecalculate,
      }}
    >
      {children}
    </AlgorithmPreviewContext.Provider>
  );
}

export function useAlgorithmPreview() {
  const context = useContext(AlgorithmPreviewContext);
  if (!context) {
    throw new Error('useAlgorithmPreview must be used within AlgorithmPreviewProvider');
  }
  return context;
}
```

### 2. ZmanTimePreview Component

```typescript
// File: web/components/publisher/ZmanTimePreview.tsx

'use client';

import { useAlgorithmPreview } from '@/lib/contexts/AlgorithmPreviewContext';
import { usePreferences } from '@/lib/contexts/PreferencesContext';
import { formatZmanTime, parseTimeString } from '@/lib/utils/time-format';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZmanTimePreviewProps {
  zmanKey: string;
  className?: string;
}

export function ZmanTimePreview({ zmanKey, className }: ZmanTimePreviewProps) {
  const { getTimeForZman, isCalculating, previewLocation } = useAlgorithmPreview();
  const { preferences } = usePreferences();

  // No location selected
  if (!previewLocation || previewLocation.latitude === 0) {
    return (
      <Badge
        variant="outline"
        className={cn('text-xs text-muted-foreground', className)}
      >
        Select location
      </Badge>
    );
  }

  // Still calculating
  if (isCalculating) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const result = getTimeForZman(zmanKey);

  // No result (zman not in calculation response)
  if (!result) {
    return null;
  }

  // Error calculating
  if (result.error) {
    return (
      <Badge
        variant="outline"
        className={cn('text-xs text-destructive border-destructive/50', className)}
      >
        <AlertTriangle className="h-3 w-3 mr-1" />
        Error
      </Badge>
    );
  }

  // Valid time
  if (result.time) {
    const dt = parseTimeString(result.time);
    // Algorithm page default: show seconds
    const showSeconds = preferences.showSeconds ?? true;
    const formatted = formatZmanTime(dt, showSeconds, preferences.roundingMode, true);

    return (
      <Badge
        variant="outline"
        className={cn(
          'font-mono text-sm bg-primary/5 border-primary/20 text-primary',
          className
        )}
      >
        <Clock className="h-3 w-3 mr-1.5" />
        {formatted}
      </Badge>
    );
  }

  return null;
}
```

### 3. Update ZmanCard

Update `web/components/publisher/ZmanCard.tsx`:

```typescript
// Add import at top
import { ZmanTimePreview } from './ZmanTimePreview';

// In the ZmanCard component, update the CardHeader section:
<CardHeader className="pb-3">
  <div className="flex flex-col-reverse sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
    {/* Left: Name and Dependencies */}
    <div className="flex-1 min-w-0">
      {/* Name - existing code */}
      <div className="flex items-start gap-2 mb-2">
        <h3 className={`text-base sm:text-lg font-semibold leading-tight flex-1 ${displayLanguage === 'hebrew' ? 'font-hebrew' : ''}`}>
          {/* ... existing name display ... */}
        </h3>

        {/* NEW: Time Preview - positioned after name */}
        <ZmanTimePreview zmanKey={zman.zman_key} className="shrink-0" />

        {/* Modified indicator - existing */}
        {nameModifications.anyModified && sourceName && (
          /* ... existing tooltip ... */
        )}
      </div>

      {/* Dependencies - existing */}
      {/* Status Toggles - existing */}
    </div>

    {/* Right: Quick Actions - existing */}
  </div>
</CardHeader>
```

### 4. Update Algorithm Page

Update `web/app/publisher/algorithm/page.tsx`:

```typescript
// Add import
import { AlgorithmPreviewProvider } from '@/lib/contexts/AlgorithmPreviewContext';

// Wrap content in provider
export default function AlgorithmEditorPage() {
  // ... existing state ...

  return (
    <AlgorithmPreviewProvider
      initialDate={previewDate}
      initialLocation={previewLocation}
    >
      <div className="min-h-screen bg-background p-8">
        {/* ... existing content ... */}
      </div>
    </AlgorithmPreviewProvider>
  );
}

// Also sync state changes to context:
// When previewDate or previewLocation changes, update context
// This can be done by lifting state into context or using useEffect
```

**Alternative: Lift state into context**

A cleaner approach is to move `previewDate` and `previewLocation` state INTO the context provider, then have the algorithm page use the context's setters:

```typescript
// In algorithm page:
const { previewDate, setPreviewDate, previewLocation, setPreviewLocation } = useAlgorithmPreview();

// Use these instead of local useState
```

### 5. Update AlgorithmPreview to Use Context

Update `web/components/publisher/AlgorithmPreview.tsx`:

```typescript
'use client';

import { useAlgorithmPreview } from '@/lib/contexts/AlgorithmPreviewContext';
import { usePreferences } from '@/lib/contexts/PreferencesContext';
import { formatZmanTime, parseTimeString } from '@/lib/utils/time-format';
// ... other imports

interface AlgorithmPreviewProps {
  displayLanguage?: 'hebrew' | 'english' | 'both';
  hasCoverage?: boolean;
}

export function AlgorithmPreview({
  displayLanguage = 'both',
  hasCoverage = true,
}: AlgorithmPreviewProps) {
  const { dayContext, calculatedTimes, isCalculating, previewLocation } = useAlgorithmPreview();
  const { preferences } = usePreferences();

  // Convert Map to array for rendering
  const preview = Array.from(calculatedTimes.entries()).map(([zmanKey, data]) => ({
    zman_key: zmanKey,
    time: data.time,
    error: data.error,
    // Note: We need zman names - either pass them in or fetch separately
  }));

  // Format time with preferences
  const formatTime = (timeStr: string): string => {
    const dt = parseTimeString(timeStr);
    const showSeconds = preferences.showSeconds ?? true;
    return formatZmanTime(dt, showSeconds, preferences.roundingMode, true);
  };

  // ... rest of component with updated logic
}
```

---

## Formula Edit Trigger

When a publisher edits a formula, we need to recalculate. This happens in the edit page (`/publisher/algorithm/edit/[zman_key]`).

**Option A: Refetch on edit page save**
- When save succeeds, the `useZmanimList` query invalidates
- Algorithm page re-renders with fresh data
- Context recalculates automatically

**Option B: Manual trigger**
- Edit page calls `triggerRecalculate()` on success
- Requires prop drilling or context access

**Decision:** Option A is simpler since React Query cache invalidation already handles this.

---

## Performance Considerations

1. **Debouncing** - 300ms delay before API call (already in place)
2. **Single API call** - One call fetches ALL zman times, shared via context
3. **Abort controller** - Cancels in-flight requests on input change
4. **Memoization** - `getTimeForZman` is memoized to prevent re-renders

---

## Test Plan

### Unit Tests

```typescript
// File: web/lib/contexts/__tests__/AlgorithmPreviewContext.test.tsx

describe('AlgorithmPreviewContext', () => {
  it('returns null for zman not in response');
  it('returns time for zman in response');
  it('returns error for zman with calculation error');
  it('debounces API calls');
  it('cancels previous request on new input');
});
```

### Component Tests

```typescript
// File: web/components/publisher/__tests__/ZmanTimePreview.test.tsx

describe('ZmanTimePreview', () => {
  it('shows "Select location" when no location');
  it('shows loading spinner when calculating');
  it('shows error badge for calculation errors');
  it('formats time with preferences');
  it('returns null for unknown zman key');
});
```

### E2E Tests

```typescript
// File: tests/e2e/publisher/time-preview.spec.ts

test('zman cards show time preview', async ({ page }) => {
  await page.goto('/publisher/algorithm');

  // Wait for location to load
  await page.waitForSelector('[data-testid="algorithm-preview"]');

  // Check zman cards have time badges
  const zmanimCards = await page.locator('[data-testid^="zman-card-"]').all();
  expect(zmanimCards.length).toBeGreaterThan(0);

  for (const card of zmanimCards.slice(0, 3)) {
    const timeBadge = card.locator('.font-mono');
    await expect(timeBadge).toBeVisible();
  }
});

test('time preview updates on date change', async ({ page }) => {
  await page.goto('/publisher/algorithm');

  // Get initial time
  const firstCard = page.locator('[data-testid^="zman-card-"]').first();
  const initialTime = await firstCard.locator('.font-mono').textContent();

  // Change date (go to next month)
  await page.getByRole('button', { name: /next/i }).click();
  await page.waitForTimeout(400); // Debounce

  // Time should potentially change
  const newTime = await firstCard.locator('.font-mono').textContent();
  // Note: Times may be the same depending on date, but component should re-render
});

test('time preview shows error for invalid formula', async ({ page }) => {
  // Navigate to edit page
  await page.goto('/publisher/algorithm');
  await page.locator('[data-testid^="zman-card-"]').first().getByRole('button', { name: /edit/i }).click();

  // Enter invalid formula
  await page.getByRole('textbox', { name: /formula/i }).fill('invalid_function()');
  await page.getByRole('button', { name: /save/i }).click();

  // Navigate back
  await page.goto('/publisher/algorithm');

  // Should show error badge
  await expect(page.locator('text=Error')).toBeVisible();
});
```

---

## Files to Create/Modify

| File | Action | Effort |
|------|--------|--------|
| `web/lib/contexts/AlgorithmPreviewContext.tsx` | Create | 2 |
| `web/components/publisher/ZmanTimePreview.tsx` | Create | 1 |
| `web/components/publisher/ZmanCard.tsx` | Modify | 1 |
| `web/app/publisher/algorithm/page.tsx` | Modify | 1 |
| `web/components/publisher/AlgorithmPreview.tsx` | Modify | 1 |
| `tests/e2e/publisher/time-preview.spec.ts` | Create | 1 |

---

## Estimated Effort

| Task | Points |
|------|--------|
| AlgorithmPreviewContext | 2 |
| ZmanTimePreview component | 1 |
| ZmanCard integration | 0.5 |
| Algorithm page updates | 0.5 |
| AlgorithmPreview refactor | 0.5 |
| E2E tests | 0.5 |
| **Total** | **5 points** |

---

## Dependencies

- Story 8.34 (Seconds Display Toggle) - Display preferences
- Existing `/publisher/zmanim` endpoint - Already returns calculated times
- React Query - Cache invalidation on formula save

---

## Future Enhancements (Out of Scope)

1. **Client-side DSL preview** - For instant feedback without API call
2. **Formula diff highlighting** - Show which part of formula changed
3. **Time comparison** - Show before/after when editing
