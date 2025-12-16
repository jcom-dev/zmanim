# Story 8-34: Seconds Display Toggle with Rounding Options - Technical Design

**Status:** Ready for Development
**Date:** 2025-12-14
**Priority:** Medium

---

## Executive Summary

Add a display preferences feature that allows users to:
1. Toggle seconds visibility in time displays (ON/OFF)
2. Choose rounding behavior when seconds are hidden (floor/math/ceil)
3. Persist settings via cookies with cross-tab synchronization
4. Apply page-specific defaults (anonymous page: OFF, algorithm page: ON)

---

## Current State Analysis

### Time Display Locations

| Location | Current Format | File |
|----------|---------------|------|
| AlgorithmPreview | `h:mm AM/PM` (no seconds) | `web/components/publisher/AlgorithmPreview.tsx:116` |
| ZmanCard | No time display | `web/components/publisher/ZmanCard.tsx` |
| Home page | N/A | `web/app/page.tsx` |
| Anonymous zmanim | `HH:mm:ss` (with seconds) | `web/app/zmanim/[cityId]/page.tsx` |

### PreferencesContext Current State

From `web/lib/contexts/PreferencesContext.tsx`:
```typescript
interface UserPreferences {
  cityId: number | null;
  continentId: number | null;
  countryId: number | null;
  regionId: number | null;
  theme: 'light' | 'dark' | 'system';
}
```

The context already has:
- Cookie persistence with `js-cookie`
- Cross-tab sync via custom events
- SSR hydration support

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PreferencesContext (Extended)                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Existing:                     │  New Display Settings:                  │
│  - cityId (cookie)             │  - showSeconds: boolean | null (cookie) │
│  - theme (cookie)              │  - roundingMode: RoundingMode (cookie)  │
│  - continentId (localStorage)  │                                         │
│  - countryId (localStorage)    │  Methods:                               │
│  - regionId (localStorage)     │  - setShowSeconds(value)                │
│                                │  - setRoundingMode(mode)                │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           Time Formatting                                │
├─────────────────────────────────────────────────────────────────────────┤
│  formatZmanTime(time, showSeconds, roundingMode)                        │
│                                                                          │
│  Rounding Logic:                                                         │
│  - floor: Always truncate seconds (06:42:30 → 06:42)                    │
│  - math:  Round at 30s threshold (06:42:30 → 06:43, 06:42:29 → 06:42)   │
│  - ceil:  Round up if any seconds (06:42:30 → 06:43, 06:42:01 → 06:43)  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Cookie Specifications

| Cookie | Value | TTL | Purpose |
|--------|-------|-----|---------|
| `zmanim_show_seconds` | `true` / `false` | 365 days | Seconds visibility |
| `zmanim_rounding_mode` | `floor` / `math` / `ceil` | 365 days | Rounding preference |

### File Structure

```
web/
├── lib/
│   ├── contexts/
│   │   └── PreferencesContext.tsx  # Extend with display preferences
│   └── utils/
│       └── time-format.ts          # New: Time formatting utility
├── components/
│   └── shared/
│       └── DisplaySettingsToggle.tsx  # New: Toggle component
└── app/
    ├── page.tsx                    # Anonymous zmanim entry (N/A)
    ├── zmanim/[cityId]/page.tsx    # Apply: seconds OFF default
    └── publisher/algorithm/page.tsx # Apply: seconds ON default
```

---

## Implementation

### 1. Extend PreferencesContext

```typescript
// File: web/lib/contexts/PreferencesContext.tsx

// Add new cookie constants
const COOKIE_SHOW_SECONDS = 'zmanim_show_seconds';
const COOKIE_ROUNDING_MODE = 'zmanim_rounding_mode';
const TTL_DISPLAY = 365; // 1 year

export type RoundingMode = 'floor' | 'math' | 'ceil';

export interface UserPreferences {
  // Existing
  cityId: number | null;
  continentId: number | null;
  countryId: number | null;
  regionId: number | null;
  theme: 'light' | 'dark' | 'system';

  // NEW: Display preferences
  showSeconds: boolean | null; // null = use page default
  roundingMode: RoundingMode;
}

interface PreferencesContextValue {
  // Existing
  preferences: UserPreferences;
  setCity: (cityId: number, hierarchy?: LocationHierarchy) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  clearCity: () => void;
  isLoading: boolean;

  // NEW: Display setters
  setShowSeconds: (show: boolean) => void;
  setRoundingMode: (mode: RoundingMode) => void;
}

// In PreferencesProvider:
const [preferences, setPreferences] = useState<UserPreferences>({
  // ... existing
  showSeconds: null, // Will use page default
  roundingMode: 'math',
});

// Load from cookies on mount
useEffect(() => {
  const showSecondsCookie = Cookies.get(COOKIE_SHOW_SECONDS);
  const roundingModeCookie = Cookies.get(COOKIE_ROUNDING_MODE);

  setPreferences((prev) => ({
    ...prev,
    showSeconds: showSecondsCookie === 'true' ? true : showSecondsCookie === 'false' ? false : null,
    roundingMode: (roundingModeCookie as RoundingMode) || 'math',
  }));
}, []);

// Setters with cross-tab sync
const setShowSeconds = useCallback((show: boolean) => {
  Cookies.set(COOKIE_SHOW_SECONDS, String(show), {
    expires: TTL_DISPLAY,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
  });
  setPreferences((prev) => ({ ...prev, showSeconds: show }));

  // Cross-tab broadcast
  window.dispatchEvent(
    new CustomEvent('preferences-cookie-change', {
      detail: { key: COOKIE_SHOW_SECONDS, value: String(show) },
    })
  );
}, []);

const setRoundingMode = useCallback((mode: RoundingMode) => {
  Cookies.set(COOKIE_ROUNDING_MODE, mode, {
    expires: TTL_DISPLAY,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
  });
  setPreferences((prev) => ({ ...prev, roundingMode: mode }));

  window.dispatchEvent(
    new CustomEvent('preferences-cookie-change', {
      detail: { key: COOKIE_ROUNDING_MODE, value: mode },
    })
  );
}, []);
```

### 2. Time Formatting Utility

```typescript
// File: web/lib/utils/time-format.ts

import { DateTime } from 'luxon';

export type RoundingMode = 'floor' | 'math' | 'ceil';

/**
 * Format a zman time with configurable seconds and rounding
 *
 * @param time - DateTime object or ISO string
 * @param showSeconds - Whether to display seconds
 * @param roundingMode - How to round when seconds hidden
 * @param format12h - Use 12-hour format (default: true)
 * @returns Formatted time string
 */
export function formatZmanTime(
  time: DateTime | string,
  showSeconds: boolean,
  roundingMode: RoundingMode = 'math',
  format12h: boolean = true
): string {
  const dt = typeof time === 'string' ? DateTime.fromISO(time) : time;

  if (!dt.isValid) {
    return '--:--';
  }

  if (showSeconds) {
    return format12h ? dt.toFormat('h:mm:ss a') : dt.toFormat('HH:mm:ss');
  }

  // Apply rounding when hiding seconds
  let rounded: DateTime;
  const seconds = dt.second;

  switch (roundingMode) {
    case 'floor':
      // Truncate seconds
      rounded = dt.startOf('minute');
      break;
    case 'ceil':
      // Round up if any seconds present
      rounded = seconds > 0
        ? dt.startOf('minute').plus({ minutes: 1 })
        : dt.startOf('minute');
      break;
    case 'math':
    default:
      // Standard rounding: ≥30 rounds up
      rounded = seconds >= 30
        ? dt.startOf('minute').plus({ minutes: 1 })
        : dt.startOf('minute');
      break;
  }

  return format12h ? rounded.toFormat('h:mm a') : rounded.toFormat('HH:mm');
}

/**
 * Parse HH:mm:ss string to DateTime for display formatting
 */
export function parseTimeString(timeStr: string, referenceDate?: DateTime): DateTime {
  const [hours, minutes, seconds = '0'] = timeStr.split(':').map(Number);
  const base = referenceDate || DateTime.now();
  return base.set({ hour: hours, minute: minutes, second: seconds, millisecond: 0 });
}
```

### 3. DisplaySettingsToggle Component

```typescript
// File: web/components/shared/DisplaySettingsToggle.tsx

'use client';

import { usePreferences, RoundingMode } from '@/lib/contexts/PreferencesContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ArrowDown, Calculator, ArrowUp, Clock } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DisplaySettingsToggleProps {
  /** Page-level default when user has no preference saved */
  defaultShowSeconds?: boolean;
  /** Compact mode for tight spaces */
  compact?: boolean;
  className?: string;
}

export function DisplaySettingsToggle({
  defaultShowSeconds = false,
  compact = false,
  className,
}: DisplaySettingsToggleProps) {
  const { preferences, setShowSeconds, setRoundingMode } = usePreferences();

  // Use saved preference if set, otherwise page default
  const showSeconds = preferences.showSeconds ?? defaultShowSeconds;
  const roundingMode = preferences.roundingMode ?? 'math';

  const handleToggle = (checked: boolean) => {
    setShowSeconds(checked);
  };

  const handleRoundingChange = (value: string) => {
    if (value) {
      setRoundingMode(value as RoundingMode);
    }
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Seconds Toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="show-seconds"
          checked={showSeconds}
          onCheckedChange={handleToggle}
        />
        <Label
          htmlFor="show-seconds"
          className={cn('text-sm cursor-pointer', compact && 'sr-only')}
        >
          {compact ? (
            <Clock className="h-4 w-4" />
          ) : (
            'Show Seconds'
          )}
        </Label>
      </div>

      {/* Rounding Mode - only visible when seconds hidden */}
      {!showSeconds && (
        <TooltipProvider delayDuration={0}>
          <ToggleGroup
            type="single"
            value={roundingMode}
            onValueChange={handleRoundingChange}
            size="sm"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="floor" aria-label="Round down">
                  <ArrowDown className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">Round Down (Floor)</p>
                <p className="text-xs text-muted-foreground">
                  Always show earlier time. Safe for start times.
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="math" aria-label="Mathematical rounding">
                  <Calculator className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">Mathematical Rounding</p>
                <p className="text-xs text-muted-foreground">
                  Standard rounding: 30+ seconds rounds up.
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="ceil" aria-label="Round up">
                  <ArrowUp className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">Round Up (Ceiling)</p>
                <p className="text-xs text-muted-foreground">
                  Always show later time. Safe for end times.
                </p>
              </TooltipContent>
            </Tooltip>
          </ToggleGroup>
        </TooltipProvider>
      )}
    </div>
  );
}

// Helper for cn() if not imported
import { cn } from '@/lib/utils';
```

### 4. Integration: AlgorithmPreview

Update `web/components/publisher/AlgorithmPreview.tsx`:

```typescript
// Add imports
import { usePreferences } from '@/lib/contexts/PreferencesContext';
import { formatZmanTime, parseTimeString } from '@/lib/utils/time-format';

// Inside component:
export function AlgorithmPreview({ location, selectedDate, displayLanguage = 'both', hasCoverage = true }: AlgorithmPreviewProps) {
  const { preferences } = usePreferences();

  // Replace existing formatTime function:
  const formatTime = (timeStr: string): string => {
    try {
      const dt = parseTimeString(timeStr);
      // Algorithm page default: show seconds ON
      const showSeconds = preferences.showSeconds ?? true;
      return formatZmanTime(dt, showSeconds, preferences.roundingMode, true);
    } catch {
      return timeStr;
    }
  };

  // ... rest unchanged
}
```

### 5. Integration: Algorithm Page Header

Update `web/app/publisher/algorithm/page.tsx` to add DisplaySettingsToggle:

```typescript
// Add import
import { DisplaySettingsToggle } from '@/components/shared/DisplaySettingsToggle';

// In JSX, add to the Location & Date Header Card after date controls:
<Card className="overflow-visible">
  <CardContent className="py-3 px-4 overflow-visible">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 min-w-0">
      {/* Existing location dropdown */}
      <div className="flex items-center justify-between sm:justify-start gap-2">
        {/* ... location dropdown ... */}
      </div>

      {/* Date Controls - existing */}
      <div className="flex items-center justify-between sm:justify-end gap-1 w-full sm:w-auto min-w-0">
        {/* ... date picker controls ... */}
      </div>

      {/* NEW: Display Settings */}
      <div className="flex items-center justify-center sm:justify-end border-t sm:border-t-0 sm:border-l border-border pt-2 sm:pt-0 sm:pl-3">
        <DisplaySettingsToggle defaultShowSeconds={true} compact />
      </div>
    </div>
  </CardContent>
</Card>
```

---

## Page Defaults

| Page | Default `showSeconds` | Rationale |
|------|----------------------|-----------|
| Anonymous zmanim (`/zmanim/*`) | `false` | Cleaner display for end users |
| Algorithm editor (`/publisher/algorithm`) | `true` | Publishers need precision |
| Week preview | Inherit from page | Consistency |

---

## Migration Strategy

### Phase 1: Core Implementation
1. Extend PreferencesContext with new fields
2. Create time-format utility
3. Create DisplaySettingsToggle component

### Phase 2: Integration
1. Add toggle to algorithm page header
2. Update AlgorithmPreview to use formatZmanTime
3. Update anonymous zmanim pages (if they exist)

### Phase 3: Testing
1. Unit tests for formatZmanTime
2. E2E tests for persistence

---

## Test Plan

### Unit Tests

```typescript
// File: web/lib/utils/__tests__/time-format.test.ts

describe('formatZmanTime', () => {
  const testTime = DateTime.fromObject({ hour: 6, minute: 42, second: 30 });

  describe('showSeconds = true', () => {
    it('displays seconds in 12h format', () => {
      expect(formatZmanTime(testTime, true, 'math', true)).toBe('6:42:30 AM');
    });
    it('displays seconds in 24h format', () => {
      expect(formatZmanTime(testTime, true, 'math', false)).toBe('06:42:30');
    });
  });

  describe('floor rounding', () => {
    it('truncates seconds', () => {
      expect(formatZmanTime(testTime, false, 'floor')).toBe('6:42 AM');
    });
    it('truncates 59 seconds', () => {
      const t = DateTime.fromObject({ hour: 6, minute: 42, second: 59 });
      expect(formatZmanTime(t, false, 'floor')).toBe('6:42 AM');
    });
  });

  describe('math rounding', () => {
    it('rounds up at 30 seconds', () => {
      expect(formatZmanTime(testTime, false, 'math')).toBe('6:43 AM');
    });
    it('rounds down at 29 seconds', () => {
      const t = DateTime.fromObject({ hour: 6, minute: 42, second: 29 });
      expect(formatZmanTime(t, false, 'math')).toBe('6:42 AM');
    });
  });

  describe('ceil rounding', () => {
    it('rounds up with any seconds', () => {
      const t = DateTime.fromObject({ hour: 6, minute: 42, second: 1 });
      expect(formatZmanTime(t, false, 'ceil')).toBe('6:43 AM');
    });
    it('keeps exact minute', () => {
      const t = DateTime.fromObject({ hour: 6, minute: 42, second: 0 });
      expect(formatZmanTime(t, false, 'ceil')).toBe('6:42 AM');
    });
  });
});
```

### E2E Tests

```typescript
// File: tests/e2e/publisher/display-settings.spec.ts

test('seconds toggle persists across refresh', async ({ page }) => {
  await page.goto('/publisher/algorithm');

  // Default: seconds ON for algorithm page
  const toggle = page.getByRole('switch', { name: /show seconds/i });
  await expect(toggle).toBeChecked();

  // Toggle OFF
  await toggle.click();
  await expect(toggle).not.toBeChecked();

  // Verify rounding selector appears
  await expect(page.getByRole('group', { name: /rounding/i })).toBeVisible();

  // Refresh
  await page.reload();

  // Should persist
  await expect(toggle).not.toBeChecked();
});

test('rounding mode selection persists', async ({ page }) => {
  await page.goto('/publisher/algorithm');

  // Turn off seconds to reveal rounding selector
  await page.getByRole('switch', { name: /show seconds/i }).click();

  // Select ceil rounding
  await page.getByRole('radio', { name: /round up/i }).click();

  await page.reload();

  // Should persist
  await expect(page.getByRole('radio', { name: /round up/i })).toBeChecked();
});
```

---

## Files to Create/Modify

| File | Action | Effort |
|------|--------|--------|
| `web/lib/contexts/PreferencesContext.tsx` | Modify | 2 |
| `web/lib/utils/time-format.ts` | Create | 1 |
| `web/lib/utils/__tests__/time-format.test.ts` | Create | 1 |
| `web/components/shared/DisplaySettingsToggle.tsx` | Create | 2 |
| `web/components/publisher/AlgorithmPreview.tsx` | Modify | 1 |
| `web/app/publisher/algorithm/page.tsx` | Modify | 1 |
| `tests/e2e/publisher/display-settings.spec.ts` | Create | 1 |

---

## Estimated Effort

| Task | Points |
|------|--------|
| Extend PreferencesContext | 1 |
| Time formatting utility | 1 |
| DisplaySettingsToggle component | 1 |
| Algorithm page integration | 1 |
| Unit tests | 0.5 |
| E2E tests | 0.5 |
| **Total** | **5 points** |

---

## Dependencies

- Story 8.29 (Unified User Preferences) - Foundation
- Story 8.35 (Zman Card Time Preview) - Consumer
- Story 8.36 (Extended Display Preferences) - Extension
