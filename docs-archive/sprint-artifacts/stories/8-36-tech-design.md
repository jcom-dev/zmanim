# Story 8-36: Extended Display Preferences with Cookie Persistence - Technical Design

**Status:** Ready for Development
**Date:** 2025-12-14
**Priority:** Medium

---

## Executive Summary

Extend the PreferencesContext to include:
1. **Language preference** - English, Hebrew, transliteration
2. **Filter preferences** - Category filters, tag filters, visibility toggles
3. **Cross-view consistency** - All settings propagate to daily/weekly/algorithm views
4. **Unified settings panel** - Single dropdown for all preferences

---

## Current State Analysis

### PreferencesContext After Story 8.34

```typescript
interface UserPreferences {
  // Location (existing)
  cityId: number | null;
  continentId: number | null;
  countryId: number | null;
  regionId: number | null;

  // Theme (existing)
  theme: 'light' | 'dark' | 'system';

  // Display (from Story 8.34)
  showSeconds: boolean | null;
  roundingMode: RoundingMode;
}
```

### Language Handling Today

| Location | Current Implementation |
|----------|----------------------|
| Algorithm page | `displayLanguage` prop derived from `calendarMode` state |
| ZmanCard | `displayLanguage` prop: 'hebrew' / 'english' / 'both' |
| AlgorithmPreview | `displayLanguage` prop passed from page |
| Anonymous zmanim | Hardcoded English |

### Filter State Today

- Algorithm page has local `filterType` and `tagFilter` state
- Not persisted across sessions
- Not shared between pages

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PreferencesContext (Final State)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Location Prefs (Cookie):     Display Prefs (Cookie):                   │
│  ├── cityId                   ├── showSeconds                            │
│  ├── continentId (localStorage)├── roundingMode                          │
│  ├── countryId (localStorage)  ├── language ← NEW                        │
│  └── regionId (localStorage)   └── theme                                 │
│                                                                          │
│  Filter Prefs (Cookie - JSON):                                          │
│  ├── categories[]   ← NEW (which time categories to show)               │
│  ├── showOptional   ← NEW (show optional zmanim)                        │
│  ├── showCustom     ← NEW (show custom zmanim)                          │
│  └── showDisabled   ← NEW (publisher-only: show disabled)               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Cookie Strategy

| Cookie | Value | Size Est. | TTL |
|--------|-------|-----------|-----|
| `zmanim_city_id` | `12345` | ~10 bytes | 90 days |
| `zmanim_theme` | `dark` | ~10 bytes | 1 year |
| `zmanim_show_seconds` | `false` | ~10 bytes | 1 year |
| `zmanim_rounding_mode` | `math` | ~10 bytes | 1 year |
| `zmanim_language` | `he` | ~5 bytes | 1 year |
| `zmanim_filters` | `{"c":["d","m"],"o":1,"u":1}` | ~50 bytes | 90 days |
| **Total** | | **~95 bytes** | |

Well under 4KB limit. Cookie overhead (~40 bytes per cookie) brings total to ~350 bytes.

### File Structure

```
web/
├── lib/
│   ├── contexts/
│   │   └── PreferencesContext.tsx  # Extend with language + filters
│   └── utils/
│       └── filter-serialize.ts     # JSON serialization helpers
├── components/
│   └── shared/
│       ├── DisplaySettingsToggle.tsx  # From Story 8.34
│       └── UnifiedSettingsPanel.tsx   # NEW: Dropdown with all settings
└── app/
    ├── page.tsx                    # Consume language
    ├── zmanim/[cityId]/page.tsx    # Consume all preferences
    └── publisher/algorithm/page.tsx # Consume all preferences
```

---

## Implementation

### 1. Extended UserPreferences Interface

```typescript
// File: web/lib/contexts/PreferencesContext.tsx

export type Language = 'en' | 'he' | 'translit';

export type TimeCategory = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

export interface FilterPreferences {
  /** Which time categories to show (empty = all) */
  categories: TimeCategory[];

  /** Show optional zmanim */
  showOptional: boolean;

  /** Show publisher's custom zmanim */
  showCustom: boolean;

  /** Publisher-only: show disabled zmanim */
  showDisabled: boolean;
}

export interface UserPreferences {
  // Location (existing)
  cityId: number | null;
  continentId: number | null;
  countryId: number | null;
  regionId: number | null;

  // Theme (existing)
  theme: 'light' | 'dark' | 'system';

  // Display (from Story 8.34)
  showSeconds: boolean | null;
  roundingMode: RoundingMode;

  // NEW: Language
  language: Language;

  // NEW: Filters
  filters: FilterPreferences;
}

// Default values
export const DEFAULT_FILTERS: FilterPreferences = {
  categories: [], // Empty = show all
  showOptional: true,
  showCustom: true,
  showDisabled: false,
};

export const DEFAULT_LANGUAGE: Language = 'en';
```

### 2. Cookie Constants and Helpers

```typescript
// File: web/lib/contexts/PreferencesContext.tsx (additions)

// Cookie names
const COOKIE_LANGUAGE = 'zmanim_language';
const COOKIE_FILTERS = 'zmanim_filters';

// TTLs
const TTL_LANGUAGE = 365;
const TTL_FILTERS = 90;

// Compact JSON serialization for filters
function serializeFilters(filters: FilterPreferences): string {
  return JSON.stringify({
    c: filters.categories,
    o: filters.showOptional ? 1 : 0,
    u: filters.showCustom ? 1 : 0,
    d: filters.showDisabled ? 1 : 0,
  });
}

function deserializeFilters(json: string | undefined): FilterPreferences {
  if (!json) return DEFAULT_FILTERS;

  try {
    const data = JSON.parse(json);
    return {
      categories: Array.isArray(data.c) ? data.c : [],
      showOptional: data.o === 1,
      showCustom: data.u === 1,
      showDisabled: data.d === 1,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}
```

### 3. Extended PreferencesProvider

```typescript
// File: web/lib/contexts/PreferencesContext.tsx (modifications)

interface PreferencesContextValue {
  // Existing
  preferences: UserPreferences;
  setCity: (cityId: number, hierarchy?: LocationHierarchy) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  clearCity: () => void;
  isLoading: boolean;

  // From Story 8.34
  setShowSeconds: (show: boolean) => void;
  setRoundingMode: (mode: RoundingMode) => void;

  // NEW
  setLanguage: (language: Language) => void;
  setFilters: (filters: FilterPreferences) => void;
  updateFilter: <K extends keyof FilterPreferences>(key: K, value: FilterPreferences[K]) => void;
  resetPreferences: () => void;
}

export function PreferencesProvider({ children, ... }) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    // ... existing
    language: DEFAULT_LANGUAGE,
    filters: DEFAULT_FILTERS,
  });

  // Load language from cookie
  useEffect(() => {
    const langCookie = Cookies.get(COOKIE_LANGUAGE) as Language | undefined;
    const filtersCookie = Cookies.get(COOKIE_FILTERS);

    setPreferences((prev) => ({
      ...prev,
      language: langCookie || DEFAULT_LANGUAGE,
      filters: deserializeFilters(filtersCookie),
    }));
  }, []);

  // Cross-tab sync handler (extend existing)
  useEffect(() => {
    const handleCookieChange = (e: CustomEvent) => {
      const { key, value } = e.detail;

      if (key === COOKIE_LANGUAGE) {
        setPreferences((prev) => ({ ...prev, language: value as Language }));
      } else if (key === COOKIE_FILTERS) {
        setPreferences((prev) => ({ ...prev, filters: deserializeFilters(value) }));
      }
      // ... existing handlers for other cookies
    };

    window.addEventListener('preferences-cookie-change' as any, handleCookieChange);
    return () => window.removeEventListener('preferences-cookie-change' as any, handleCookieChange);
  }, []);

  // Setters
  const setLanguage = useCallback((language: Language) => {
    Cookies.set(COOKIE_LANGUAGE, language, {
      expires: TTL_LANGUAGE,
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    });
    setPreferences((prev) => ({ ...prev, language }));

    // Cross-tab broadcast
    window.dispatchEvent(
      new CustomEvent('preferences-cookie-change', {
        detail: { key: COOKIE_LANGUAGE, value: language },
      })
    );
  }, []);

  const setFilters = useCallback((filters: FilterPreferences) => {
    Cookies.set(COOKIE_FILTERS, serializeFilters(filters), {
      expires: TTL_FILTERS,
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    });
    setPreferences((prev) => ({ ...prev, filters }));

    window.dispatchEvent(
      new CustomEvent('preferences-cookie-change', {
        detail: { key: COOKIE_FILTERS, value: serializeFilters(filters) },
      })
    );
  }, []);

  const updateFilter = useCallback(<K extends keyof FilterPreferences>(
    key: K,
    value: FilterPreferences[K]
  ) => {
    setFilters({ ...preferences.filters, [key]: value });
  }, [preferences.filters, setFilters]);

  const resetPreferences = useCallback(() => {
    // Remove all preference cookies
    Cookies.remove(COOKIE_SHOW_SECONDS);
    Cookies.remove(COOKIE_ROUNDING_MODE);
    Cookies.remove(COOKIE_LANGUAGE);
    Cookies.remove(COOKIE_FILTERS);

    // Reset to defaults
    setPreferences((prev) => ({
      ...prev,
      showSeconds: null,
      roundingMode: 'math',
      language: DEFAULT_LANGUAGE,
      filters: DEFAULT_FILTERS,
    }));

    // Broadcast
    window.dispatchEvent(new CustomEvent('preferences-cookie-change', { detail: { reset: true } }));
  }, []);

  // ... return provider
}
```

### 4. UnifiedSettingsPanel Component

```typescript
// File: web/components/shared/UnifiedSettingsPanel.tsx

'use client';

import { usePreferences, Language, TimeCategory, DEFAULT_FILTERS } from '@/lib/contexts/PreferencesContext';
import { DisplaySettingsToggle } from './DisplaySettingsToggle';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, RotateCcw, Globe, Filter, Clock } from 'lucide-react';

interface UnifiedSettingsPanelProps {
  /** Show publisher-only settings (e.g., showDisabled) */
  showPublisherSettings?: boolean;
  /** Which sections to show */
  sections?: ('language' | 'display' | 'filters')[];
}

const TIME_CATEGORIES: { value: TimeCategory; label: string }[] = [
  { value: 'dawn', label: 'Dawn' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
];

export function UnifiedSettingsPanel({
  showPublisherSettings = false,
  sections = ['language', 'display', 'filters'],
}: UnifiedSettingsPanelProps) {
  const {
    preferences,
    setLanguage,
    updateFilter,
    resetPreferences,
  } = usePreferences();

  const hasLanguageSection = sections.includes('language');
  const hasDisplaySection = sections.includes('display');
  const hasFiltersSection = sections.includes('filters');

  // Check if any settings differ from defaults
  const hasCustomSettings =
    preferences.showSeconds !== null ||
    preferences.roundingMode !== 'math' ||
    preferences.language !== 'en' ||
    JSON.stringify(preferences.filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Settings className="h-5 w-5" />
          {hasCustomSettings && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Display Settings
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Language Section */}
        {hasLanguageSection && (
          <>
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Language</Label>
              </div>
              <ToggleGroup
                type="single"
                value={preferences.language}
                onValueChange={(v) => v && setLanguage(v as Language)}
                className="justify-start"
              >
                <ToggleGroupItem value="en" size="sm">
                  English
                </ToggleGroupItem>
                <ToggleGroupItem value="he" size="sm" className="font-hebrew">
                  עברית
                </ToggleGroupItem>
                <ToggleGroupItem value="translit" size="sm">
                  Translit
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Display Section (Seconds & Rounding) */}
        {hasDisplaySection && (
          <>
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Time Display</Label>
              </div>
              <DisplaySettingsToggle />
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Filters Section */}
        {hasFiltersSection && (
          <>
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Show</Label>
              </div>
              <div className="space-y-3">
                {/* Optional Zmanim */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-optional" className="text-sm">
                    Optional Zmanim
                  </Label>
                  <Switch
                    id="show-optional"
                    checked={preferences.filters.showOptional}
                    onCheckedChange={(v) => updateFilter('showOptional', v)}
                  />
                </div>

                {/* Custom Zmanim */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-custom" className="text-sm">
                    Custom Zmanim
                  </Label>
                  <Switch
                    id="show-custom"
                    checked={preferences.filters.showCustom}
                    onCheckedChange={(v) => updateFilter('showCustom', v)}
                  />
                </div>

                {/* Disabled Zmanim (Publisher only) */}
                {showPublisherSettings && (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-disabled" className="text-sm text-muted-foreground">
                      Disabled Zmanim
                    </Label>
                    <Switch
                      id="show-disabled"
                      checked={preferences.filters.showDisabled}
                      onCheckedChange={(v) => updateFilter('showDisabled', v)}
                    />
                  </div>
                )}
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Reset */}
        <DropdownMenuItem
          onClick={resetPreferences}
          disabled={!hasCustomSettings}
          className="text-muted-foreground"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 5. Integration: Algorithm Page

Update `web/app/publisher/algorithm/page.tsx`:

```typescript
// Add imports
import { usePreferences } from '@/lib/contexts/PreferencesContext';
import { UnifiedSettingsPanel } from '@/components/shared/UnifiedSettingsPanel';

// Inside component:
const { preferences } = usePreferences();

// Use preferences.language for display
const displayLanguage = preferences.language === 'he' ? 'hebrew' : 'english';

// Use preferences.filters for filtering
const filteredZmanim = useMemo(() => {
  let result = viewMode === 'everyday' ? [...everydayZmanim] : [...eventZmanim];

  // Apply preference filters
  if (!preferences.filters.showOptional) {
    result = result.filter(z => z.category !== 'optional');
  }
  if (!preferences.filters.showCustom) {
    result = result.filter(z => !z.is_custom);
  }
  if (!preferences.filters.showDisabled) {
    result = result.filter(z => z.is_enabled);
  }

  // ... existing search and type filters
  return result;
}, [everydayZmanim, eventZmanim, viewMode, preferences.filters, searchQuery, filterType]);

// In JSX header, add UnifiedSettingsPanel:
<div className="flex items-center gap-2">
  <UnifiedSettingsPanel showPublisherSettings />
  {/* ... existing buttons */}
</div>
```

### 6. RTL Layout Support

When Hebrew is selected, apply RTL:

```typescript
// File: web/app/layout.tsx

export default async function RootLayout({ children }) {
  // Read language cookie for SSR
  const cookieStore = await cookies();
  const languageCookie = cookieStore.get('zmanim_language');
  const language = languageCookie?.value || 'en';
  const dir = language === 'he' ? 'rtl' : 'ltr';

  return (
    <html lang={language} dir={dir}>
      <body>
        {/* ... */}
      </body>
    </html>
  );
}

// Or client-side via context:
// File: web/app/layout.tsx (client wrapper)
'use client';

import { usePreferences } from '@/lib/contexts/PreferencesContext';

function LayoutWrapper({ children }) {
  const { preferences } = usePreferences();
  const dir = preferences.language === 'he' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = preferences.language === 'he' ? 'he' : 'en';
  }, [dir, preferences.language]);

  return <>{children}</>;
}
```

---

## Cross-View Consistency

### Consumer Pattern

Every view that displays zmanim should consume preferences:

```typescript
// Pattern for any zmanim view component
function ZmanimView() {
  const { preferences } = usePreferences();
  const { language, filters, showSeconds, roundingMode } = preferences;

  // Filter zmanim
  const displayedZmanim = useMemo(() => {
    return zmanim.filter(z => {
      if (!filters.showOptional && z.category === 'optional') return false;
      if (!filters.showCustom && z.is_custom) return false;
      return true;
    });
  }, [zmanim, filters]);

  // Get display name based on language
  const getDisplayName = (z: Zman) => {
    switch (language) {
      case 'he': return z.hebrew_name;
      case 'translit': return z.transliteration || z.english_name;
      default: return z.english_name;
    }
  };

  // Format time with preferences
  const formatTime = (time: string) => {
    return formatZmanTime(parseTimeString(time), showSeconds ?? false, roundingMode);
  };

  return (
    <div dir={language === 'he' ? 'rtl' : 'ltr'}>
      {displayedZmanim.map(z => (
        <div key={z.id}>
          <span>{getDisplayName(z)}</span>
          <span>{formatTime(z.time)}</span>
        </div>
      ))}
    </div>
  );
}
```

### Views to Update

| View | File | Changes |
|------|------|---------|
| Algorithm page | `web/app/publisher/algorithm/page.tsx` | Add panel, consume all prefs |
| Algorithm preview | `web/components/publisher/AlgorithmPreview.tsx` | Consume language, time prefs |
| Week preview | `web/components/publisher/WeekPreview.tsx` | Consume all prefs |
| Anonymous zmanim | `web/app/zmanim/[cityId]/page.tsx` | Add panel, consume prefs |
| ZmanCard | `web/components/publisher/ZmanCard.tsx` | Consume language for names |

---

## Test Plan

### Unit Tests

```typescript
// File: web/lib/contexts/__tests__/PreferencesContext.test.ts

describe('Filter serialization', () => {
  test('serializes filters to compact JSON');
  test('deserializes filters from JSON');
  test('handles malformed JSON gracefully');
  test('returns defaults for missing cookie');
});

describe('Language preference', () => {
  test('setLanguage updates cookie');
  test('setLanguage broadcasts to other tabs');
  test('respects SSR initial value');
});
```

### E2E Tests

```typescript
// File: tests/e2e/preferences/settings.spec.ts

test('language preference persists', async ({ page }) => {
  await page.goto('/publisher/algorithm');

  // Open settings
  await page.getByRole('button', { name: /settings/i }).click();

  // Change to Hebrew
  await page.getByRole('radio', { name: /עברית/i }).click();

  // Close dropdown
  await page.keyboard.press('Escape');

  // Verify RTL layout
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  // Refresh
  await page.reload();

  // Should persist
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('filter preferences persist', async ({ page }) => {
  await page.goto('/publisher/algorithm');

  // Open settings
  await page.getByRole('button', { name: /settings/i }).click();

  // Turn off optional zmanim
  await page.getByRole('switch', { name: /optional/i }).click();

  // Verify optional zmanim hidden
  // (Assumes optional zmanim have some indicator)

  // Refresh
  await page.reload();

  // Should persist
  await page.getByRole('button', { name: /settings/i }).click();
  await expect(page.getByRole('switch', { name: /optional/i })).not.toBeChecked();
});

test('cross-tab sync works', async ({ context }) => {
  const page1 = await context.newPage();
  const page2 = await context.newPage();

  await page1.goto('/publisher/algorithm');
  await page2.goto('/publisher/algorithm');

  // Change language in tab 1
  await page1.getByRole('button', { name: /settings/i }).click();
  await page1.getByRole('radio', { name: /עברית/i }).click();

  // Wait for sync
  await page2.waitForTimeout(100);

  // Tab 2 should update
  await expect(page2.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('reset preferences works', async ({ page }) => {
  await page.goto('/publisher/algorithm');

  // Set some preferences
  await page.getByRole('button', { name: /settings/i }).click();
  await page.getByRole('radio', { name: /עברית/i }).click();
  await page.getByRole('switch', { name: /optional/i }).click();

  // Reset
  await page.getByRole('button', { name: /settings/i }).click();
  await page.getByRole('menuitem', { name: /reset/i }).click();

  // Verify defaults
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});
```

---

## Files to Create/Modify

| File | Action | Effort |
|------|--------|--------|
| `web/lib/contexts/PreferencesContext.tsx` | Modify | 2 |
| `web/components/shared/UnifiedSettingsPanel.tsx` | Create | 2 |
| `web/app/publisher/algorithm/page.tsx` | Modify | 1 |
| `web/components/publisher/AlgorithmPreview.tsx` | Modify | 0.5 |
| `web/components/publisher/WeekPreview.tsx` | Modify | 0.5 |
| `web/components/publisher/ZmanCard.tsx` | Modify | 0.5 |
| `web/app/zmanim/[cityId]/page.tsx` | Modify | 1 |
| `web/app/layout.tsx` | Modify | 0.5 |
| `tests/e2e/preferences/settings.spec.ts` | Create | 1 |

---

## Estimated Effort

| Task | Points |
|------|--------|
| Extend PreferencesContext | 2 |
| UnifiedSettingsPanel component | 2 |
| Algorithm page integration | 1 |
| Other view updates | 1.5 |
| RTL layout support | 0.5 |
| E2E tests | 1 |
| **Total** | **8 points** |

---

## Dependencies

- Story 8.29 (Unified User Preferences) - Foundation
- Story 8.34 (Seconds Display Toggle) - Display settings
- `js-cookie` package - Already installed

---

## Cookie Size Verification

```typescript
// Test to verify cookie size
test('total cookie size under 4KB', () => {
  const maxFilters: FilterPreferences = {
    categories: ['dawn', 'morning', 'afternoon', 'evening', 'night'],
    showOptional: true,
    showCustom: true,
    showDisabled: true,
  };

  const allCookies = [
    `zmanim_city_id=123456789`,
    `zmanim_theme=dark`,
    `zmanim_show_seconds=false`,
    `zmanim_rounding_mode=math`,
    `zmanim_language=translit`,
    `zmanim_filters=${serializeFilters(maxFilters)}`,
  ].join('; ');

  expect(allCookies.length).toBeLessThan(4096);
});
```

---

## Future Enhancements (Out of Scope)

1. **Category multi-select UI** - Let users pick which time categories to show
2. **Per-publisher filter presets** - Save filter configurations per publisher
3. **Export/import settings** - Share settings across devices
4. **Localized UI strings** - Translate settings panel labels
