# Story 8-29: Unified User Preferences with Cookie Persistence - Technical Design

**Status:** Ready for Development
**Date:** 2025-12-14
**Priority:** Medium

---

## Executive Summary

Create a centralized preferences system that:
1. Consolidates scattered localStorage keys into a unified context
2. Uses cookies for critical preferences (city, theme) for SSR support
3. Maintains localStorage for transient/preview settings
4. Enables cross-tab synchronization

---

## Current State Audit

### localStorage Keys in Use

| Key | Location | Purpose | Migration Plan |
|-----|----------|---------|----------------|
| `theme` | next-themes lib | Theme selection | → Cookie (SSR) |
| `zmanim_selected_city` | page.tsx | Selected city (JSON) | → Cookie (ID only) |
| `zmanim_selected_continent` | page.tsx | Breadcrumb state | Keep in localStorage |
| `zmanim_selected_country` | page.tsx | Breadcrumb state | Keep in localStorage |
| `zmanim_selected_region` | page.tsx | Breadcrumb state | Keep in localStorage |
| `selectedPublisherId` | PublisherContext | Publisher selection | → Cookie (Story 8-27) |
| `zmanim_selected_publisher` | various | Publisher object | Remove (redundant) |
| `zmanim-preview-date` | algorithm | Preview date | Keep (transient) |
| `zmanim-preview-location-{id}` | algorithm | Per-publisher preview | Keep (transient) |
| `impersonating` | sessionStorage | Admin impersonation | Keep (session-scoped) |

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PreferencesContext                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │   Cookie-Based  │  │ localStorage    │  │   SSR Hydration     │ │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────────┤ │
│  │ zmanim_city_id  │  │ breadcrumb state│  │ Read cookies in     │ │
│  │ zmanim_theme    │  │ preview settings│  │ layout.tsx for      │ │
│  │ zmanim_pub_id   │  │                 │  │ initial state       │ │
│  │ (via API)       │  │                 │  │                     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Cookie Specifications

| Cookie | Value | TTL | HttpOnly | Purpose |
|--------|-------|-----|----------|---------|
| `zmanim_city_id` | City ID (int) | 90 days | No | Last viewed city |
| `zmanim_theme` | light/dark/system | 1 year | No | Theme preference |
| `zmanim_publisher_id` | Publisher ID | 30 days | Yes (API) | Selected publisher |

### File Structure

```
web/
├── lib/
│   ├── contexts/
│   │   └── PreferencesContext.tsx  # New: Central preferences
│   ├── hooks/
│   │   └── usePreferences.ts       # New: Hook re-export
│   └── utils/
│       └── cookies.ts              # New: Cookie utilities
├── providers/
│   └── PublisherContext.tsx        # Modify: Delegate to Preferences
├── app/
│   ├── layout.tsx                  # Modify: SSR cookie reading
│   └── page.tsx                    # Modify: Use usePreferences
└── components/
    └── theme-provider.tsx          # Modify: Sync to cookie
```

---

## Implementation

### 1. Cookie Utilities

```typescript
// File: web/lib/utils/cookies.ts

import Cookies from 'js-cookie';

export const COOKIE_KEYS = {
  CITY_ID: 'zmanim_city_id',
  THEME: 'zmanim_theme',
  PUBLISHER_ID: 'zmanim_publisher_id', // httpOnly, managed by API
} as const;

export const COOKIE_DEFAULTS = {
  [COOKIE_KEYS.CITY_ID]: { expires: 90, sameSite: 'lax' as const },
  [COOKIE_KEYS.THEME]: { expires: 365, sameSite: 'lax' as const },
};

export function setCookie(key: string, value: string, options = {}) {
  const defaults = COOKIE_DEFAULTS[key] || {};
  Cookies.set(key, value, {
    ...defaults,
    ...options,
    secure: process.env.NODE_ENV === 'production',
  });
}

export function getCookie(key: string): string | undefined {
  return Cookies.get(key);
}

export function removeCookie(key: string) {
  Cookies.remove(key);
}
```

### 2. Preferences Context

```typescript
// File: web/lib/contexts/PreferencesContext.tsx

'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { setCookie, getCookie, removeCookie, COOKIE_KEYS } from '../utils/cookies';

interface LocationPreference {
  cityId: number | null;
  // Breadcrumb state (localStorage, not cookies)
  continentId: number | null;
  countryId: number | null;
  regionId: number | null;
}

interface UserPreferences {
  location: LocationPreference;
  theme: 'light' | 'dark' | 'system';
}

interface PreferencesContextValue {
  preferences: UserPreferences;
  setCity: (cityId: number, hierarchy?: { continentId?: number; countryId?: number; regionId?: number }) => void;
  clearCity: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  isLoading: boolean;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

interface PreferencesProviderProps {
  children: ReactNode;
  initialCityId?: number | null;
  initialTheme?: 'light' | 'dark' | 'system';
}

export function PreferencesProvider({
  children,
  initialCityId = null,
  initialTheme = 'system',
}: PreferencesProviderProps) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    location: {
      cityId: initialCityId,
      continentId: null,
      countryId: null,
      regionId: null,
    },
    theme: initialTheme,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load breadcrumb state from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedContinent = localStorage.getItem('zmanim_selected_continent');
    const storedCountry = localStorage.getItem('zmanim_selected_country');
    const storedRegion = localStorage.getItem('zmanim_selected_region');

    setPreferences(prev => ({
      ...prev,
      location: {
        ...prev.location,
        continentId: storedContinent ? parseInt(storedContinent) : null,
        countryId: storedCountry ? parseInt(storedCountry) : null,
        regionId: storedRegion ? parseInt(storedRegion) : null,
      },
    }));

    // Migrate legacy localStorage city to cookie
    migrateLegacyStorage();

    setIsLoading(false);
  }, []);

  // Cross-tab sync via storage events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith('zmanim_selected_')) {
        // Reload location preferences from storage
        // Debounce this in production
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const setCity = useCallback((
    cityId: number,
    hierarchy?: { continentId?: number; countryId?: number; regionId?: number }
  ) => {
    // Set cookie for SSR
    setCookie(COOKIE_KEYS.CITY_ID, String(cityId));

    // Store breadcrumb in localStorage
    if (hierarchy?.continentId) {
      localStorage.setItem('zmanim_selected_continent', String(hierarchy.continentId));
    }
    if (hierarchy?.countryId) {
      localStorage.setItem('zmanim_selected_country', String(hierarchy.countryId));
    }
    if (hierarchy?.regionId) {
      localStorage.setItem('zmanim_selected_region', String(hierarchy.regionId));
    }

    setPreferences(prev => ({
      ...prev,
      location: {
        cityId,
        continentId: hierarchy?.continentId ?? prev.location.continentId,
        countryId: hierarchy?.countryId ?? prev.location.countryId,
        regionId: hierarchy?.regionId ?? prev.location.regionId,
      },
    }));
  }, []);

  const clearCity = useCallback(() => {
    removeCookie(COOKIE_KEYS.CITY_ID);
    localStorage.removeItem('zmanim_selected_continent');
    localStorage.removeItem('zmanim_selected_country');
    localStorage.removeItem('zmanim_selected_region');

    setPreferences(prev => ({
      ...prev,
      location: { cityId: null, continentId: null, countryId: null, regionId: null },
    }));
  }, []);

  const setTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    setCookie(COOKIE_KEYS.THEME, theme);
    setPreferences(prev => ({ ...prev, theme }));
  }, []);

  return (
    <PreferencesContext.Provider value={{ preferences, setCity, clearCity, setTheme, isLoading }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
}

// Migration helper
function migrateLegacyStorage() {
  const legacyCity = localStorage.getItem('zmanim_selected_city');
  if (legacyCity && !getCookie(COOKIE_KEYS.CITY_ID)) {
    try {
      const city = JSON.parse(legacyCity);
      if (city.id) {
        setCookie(COOKIE_KEYS.CITY_ID, String(city.id));
      }
    } catch {}
    // Keep legacy for now, remove in future cleanup
  }
}
```

### 3. SSR Hydration in Layout

```typescript
// File: web/app/layout.tsx

import { cookies } from 'next/headers';
import { PreferencesProvider } from '@/lib/contexts/PreferencesContext';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();

  const themeCookie = cookieStore.get('zmanim_theme');
  const cityIdCookie = cookieStore.get('zmanim_city_id');

  const initialTheme = (themeCookie?.value as 'light' | 'dark' | 'system') || 'system';
  const initialCityId = cityIdCookie?.value ? parseInt(cityIdCookie.value) : null;

  return (
    <html lang="en" className={initialTheme === 'dark' ? 'dark' : ''}>
      <body>
        <PreferencesProvider
          initialTheme={initialTheme}
          initialCityId={initialCityId}
        >
          {/* existing providers */}
          {children}
        </PreferencesProvider>
      </body>
    </html>
  );
}
```

### 4. Theme Provider Integration

```typescript
// File: web/components/theme-provider.tsx

'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { usePreferences } from '@/lib/contexts/PreferencesContext';
import { useEffect } from 'react';
import { setCookie, COOKIE_KEYS } from '@/lib/utils/cookies';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      onThemeChange={(theme) => {
        // Sync theme to cookie for SSR
        if (theme) {
          setCookie(COOKIE_KEYS.THEME, theme);
        }
      }}
    >
      {children}
    </NextThemesProvider>
  );
}
```

### 5. Home Page Integration

```typescript
// File: web/app/page.tsx

'use client';

import { usePreferences } from '@/lib/contexts/PreferencesContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { preferences, isLoading } = usePreferences();
  const router = useRouter();

  // Auto-navigate to last city if set
  useEffect(() => {
    if (!isLoading && preferences.location.cityId) {
      // Optional: Show "Welcome back" prompt instead of auto-redirect
      // router.push(`/zmanim/${preferences.location.cityId}`);
    }
  }, [isLoading, preferences.location.cityId]);

  return (
    <div>
      {preferences.location.cityId && (
        <div className="mb-4 p-4 bg-blue-50 rounded">
          <p>Welcome back! Continue to your last location?</p>
          <button onClick={() => router.push(`/zmanim/${preferences.location.cityId}`)}>
            Continue
          </button>
          <button onClick={() => clearCity()}>
            Change Location
          </button>
        </div>
      )}
      {/* Rest of home page */}
    </div>
  );
}
```

---

## Migration Strategy

### Phase 1: Deploy PreferencesContext
- Add new context alongside existing storage
- Read from both sources (cookie + localStorage)
- Write to new cookie-based system

### Phase 2: Update Consumers
- Update `page.tsx` to use `usePreferences()`
- Update theme provider to sync cookies
- Verify SSR hydration

### Phase 3: Cleanup (Deferred)
- Remove legacy localStorage reads after 90 days
- Clean up redundant keys

---

## Test Plan

### Unit Tests
```typescript
describe('PreferencesContext', () => {
  test('setCity persists to cookie');
  test('setTheme persists to cookie');
  test('SSR hydration uses initial props');
  test('migration converts legacy localStorage');
  test('clearCity removes cookie and localStorage');
});
```

### E2E Tests
```typescript
test('city selection persists across sessions', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-city="123"]');
  await page.reload();
  // Should show "Welcome back" with city 123
});

test('theme persists without flash', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-theme="dark"]');
  await page.reload();
  // Should render dark theme immediately (no flash)
});
```

---

## Dependencies

| Package | Purpose | Install |
|---------|---------|---------|
| `js-cookie` | Client-side cookie management | `npm i js-cookie @types/js-cookie` |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `web/lib/contexts/PreferencesContext.tsx` | Create |
| `web/lib/hooks/usePreferences.ts` | Create (re-export) |
| `web/lib/utils/cookies.ts` | Create |
| `web/app/layout.tsx` | Modify (SSR reading) |
| `web/app/page.tsx` | Modify (use preferences) |
| `web/components/theme-provider.tsx` | Modify (sync to cookie) |
| `web/providers/PublisherContext.tsx` | Modify (delegate storage) |

---

## Estimated Effort

| Task | Points |
|------|--------|
| PreferencesContext implementation | 3 |
| SSR integration | 2 |
| Theme cookie sync | 1 |
| Migration logic | 1 |
| Testing | 1 |
| Total | **8 points** |

---

## Dependencies

- Story 8-27 (Multi-Publisher Switcher) - Cookie naming alignment
- Story 8-26 (Publisher Access Validation) - Secure publisher cookie
