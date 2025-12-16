# Preview Toolbar & Global Publisher Feature - Requirements Document

## Overview

Multiple publisher and admin pages need locality search, date picker, and EN/עב language toggle. Current implementations are scattered with inconsistent storage, UI patterns, and feature sets. This document defines requirements for a unified `<PreviewToolbar />` component and the new Global Publisher feature.

---

## Problem Statement

| Page | Current State | Issues |
|------|--------------|--------|
| Publisher Algorithm | Custom locality picker, dual calendar, EN/עב toggle | Not reusable, localStorage storage |
| Publisher Registry | LocalityPicker + simple calendar | Missing Hebrew calendar, no language toggle, no coverage restriction |
| Publisher Primitives | LocalityPicker + date nav buttons | Missing Hebrew calendar, no language toggle |
| Admin Registry | None | No preview capability at all |

**Additional Gap:** No way for publishers to declare "global coverage" - they must manually add coverage areas even if they serve worldwide.

---

## Scope

### Pages Requiring Preview Toolbar

1. **Publisher Algorithm** (`/publisher/algorithm`)
2. **Publisher Registry** (`/publisher/registry`)
3. **Publisher Primitives** (`/publisher/primitives`)
4. **Admin Registry** (`/admin/zmanim/registry`)

### New Feature: Global Publisher Flag

Publishers can be marked as "global" - meaning they provide zmanim for all localities worldwide without needing to define specific coverage areas.

---

## Requirements

### R1: Shared `<PreviewToolbar />` Component

A unified toolbar component providing:

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ 📍 [Jerusalem, Israel ▾] [📋]  📅 [Dec 22, 2025 ◀▶]  🌐 [EN|עב]                     │
└──────────────────────────────────────────────────────────────────────────────────────┘
      ↑ Locality Picker    ↑ Coverage    ↑ Date (format follows language)   ↑ Language
```

**When language is Hebrew (עב):**
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ 📍 [Jerusalem, Israel ▾] [📋]  📅 [כ״א כסלו תשפ״ו ◀▶]  🌐 [EN|עב]                   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
**Note:** Locality names always display in English regardless of language setting.

**Sub-components:**
1. **Locality Picker** - With optional coverage restriction
2. **Coverage Indicator** - Coverage list popover (only for regional publishers)
3. **Date Picker** - Format follows language setting (Gregorian for EN, Hebrew for עב)
4. **Language Toggle** - Single EN/עב toggle controlling BOTH zman names AND date format

---

### R2: Storage Strategy

| Data | Storage | Key Pattern | Shared Across Pages? |
|------|---------|-------------|---------------------|
| Locality ID | Cookie | `zmanim_preview_{storageKey}_locality_id` | No - per page |
| Locality Name | Cookie | `zmanim_preview_{storageKey}_locality_name` | No - per page |
| Date | Cookie | `zmanim_preview_{storageKey}_date` | No - per page |
| Language (EN/עב) | Cookie | `zmanim_language` | **Yes - global** |

**Note:** Calendar mode removed - date format now follows the global language setting automatically.

**Storage Keys by Page:**
| Page | Storage Key |
|------|-------------|
| Publisher Algorithm | `algorithm` |
| Publisher Registry | `publisher_registry` |
| Publisher Primitives | `primitives` |
| Admin Registry | `admin_registry` |

**Cookie TTL:** 90 days for preview settings, 365 days for language

---

### R3: Coverage Restriction Logic

| Page | Restrict to Coverage? | Show Coverage Indicator? |
|------|----------------------|-------------------------|
| Publisher Algorithm | ✅ Yes (unless global) | ✅ Yes (only if NOT global) |
| Publisher Registry | ✅ Yes (unless global) | ✅ Yes (only if NOT global) |
| Publisher Primitives | ❌ No (always global search) | ❌ No |
| Admin Registry | ❌ No (always global search) | ❌ No |

**When `is_global = true`:**
- Coverage restriction is disabled (all localities searchable)
- Coverage indicator is **hidden** (not needed - they cover everything)
- No "View Coverage" button shown in toolbar

---

### R4: No Location = No Preview Behavior

When no locality is selected:
- Preview section displays placeholder message: **"Select a location to preview times"**
- Date picker and calendar mode remain functional (pre-configured for when location is chosen)
- No API calls made for preview data
- Zman list/table shows empty state with the placeholder

---

### R5: Coverage Indicator (Simplified List)

For pages with coverage restriction (`restrictToCoverage = true`), show a coverage list popover:

**Regional Publisher (is_global = false) - Coverage indicator SHOWN:**
```
┌─ Your Coverage Areas ───────────────────────────┐
│ 🌍 United States (423 localities)               │
│ 🌍 Israel (312 localities)                      │
│    └─ Jerusalem District (45)                   │
│    └─ Tel Aviv District (38)                    │
│ 🌍 United Kingdom (112 localities)              │
│ ─────────────────────────────────────────────── │
│ Total: 847 localities                           │
│                                                 │
│ [Manage Coverage →]                             │
└─────────────────────────────────────────────────┘
```

**Global Publisher (is_global = true) - Coverage indicator HIDDEN:**
- No coverage button/popover shown in toolbar
- Locality picker allows searching all localities worldwide
- User can go to Coverage page if they want to switch to regional

**Trigger:** Small button/icon next to locality picker (e.g., 📋 or "Coverage" link) - only visible for regional publishers

---

### R6: Date Picker (Language-Aware)

Date format automatically follows the global language setting:

**When language = EN (English):**
```
┌─────────────────────────────────┐
│ [Dec ▾] [22 ▾] [2025 ▾]  ◀  ▶  │
└─────────────────────────────────┘
```

**When language = עב (Hebrew):**
```
┌─────────────────────────────────┐
│ [כ״א ▾] [כסלו ▾] [תשפ״ו ▾]  ◀  ▶ │
└─────────────────────────────────┘
```

**Behavior:**
- Date format switches automatically when language changes
- Internal storage always uses Gregorian (ISO format) for consistency
- Display converts to Hebrew calendar when language is Hebrew
- API conversion via `/calendar/gregorian-date` and `/calendar/hebrew-date`
- Prev/Next buttons navigate by 1 day
- "Today" button resets to current date

---

### R7: Language Toggle (Unified, Shared Globally)

**Purpose:** Single toggle controlling ALL language-dependent display across ALL pages

**Storage:**
- `PreferencesContext` as `language: 'en' | 'he'`
- Cookie: `zmanim_language` (365-day TTL)
- Changes broadcast across tabs via `CustomEvent('preferences-cookie-change')`

**Affects:**
- **Date format** - Gregorian (EN) vs Hebrew calendar (עב)
- **Zman names** - English canonical name vs Hebrew canonical name
- **Zman descriptions** - English vs Hebrew
- **Halachic notes** - English vs Hebrew

**Does NOT affect:**
- **Locality names** - Always displayed in English for consistency

**UI:**
```
┌─────────┐
│ EN | עב │  ← Single segmented button
└─────────┘
```

**Important:** There is only ONE language toggle. It controls everything - no separate "calendar mode" toggle.

---

### R8: Global Publisher Feature

#### 8.1 Database Schema Change

```sql
ALTER TABLE publishers
ADD COLUMN is_global BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN publishers.is_global IS
  'When true, publisher provides zmanim for all localities worldwide without coverage restrictions';
```

#### 8.2 Behavior Matrix

| Scenario | Locality Search | Coverage Indicator | Coverage Page |
|----------|----------------|-------------------|---------------|
| `is_global = false` | Restricted to coverage areas | Shows coverage list | Full management UI |
| `is_global = true` | All localities (no restriction) | Shows "Global" badge | Global status + toggle |

#### 8.3 Permission Model

- **Publisher:** Can toggle their own `is_global` flag (self-service)
- **Admin:** Can override any publisher's `is_global` flag
- **Audit:** Changes logged to audit trail

#### 8.4 Coverage Data Preservation

When switching TO global (`is_global = false → true`):
- Existing coverage records are **preserved** (not deleted)
- Coverage records become inactive/hidden
- If publisher switches back, coverage is restored

When switching FROM global (`is_global = true → false`):
- Previous coverage records become active again
- If no previous coverage exists, publisher starts fresh

#### 8.5 API Behavior

**GET /publisher/coverage** response when `is_global = true`:
```json
{
  "is_global": true,
  "coverage": [],
  "message": "Publisher has global coverage - no regional restrictions"
}
```

**Coverage mutation endpoints** when `is_global = true`:
- Return 400 Bad Request with message: "Cannot modify coverage for global publisher. Disable global coverage first."

**New endpoint: PUT /publisher/settings/global-coverage**
```json
// Request
{ "is_global": true }

// Response
{
  "is_global": true,
  "previous_coverage_preserved": true,
  "coverage_count": 5  // Number of preserved records
}
```

#### 8.6 Coverage Page UI Changes

**When `is_global = true`:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Coverage Settings                                                            │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 🌐 GLOBAL COVERAGE ENABLED                                            │   │
│  │                                                                        │   │
│  │ Your publisher provides zmanim for all localities worldwide.          │   │
│  │ No coverage area management is needed.                                 │   │
│  │                                                                        │   │
│  │ Previously defined coverage areas (5) are preserved and will be       │   │
│  │ restored if you switch back to regional coverage.                     │   │
│  │                                                                        │   │
│  │ [Switch to Regional Coverage]                                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**When `is_global = false` (current behavior + new toggle):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Coverage Settings                                                            │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 💡 Serve all localities worldwide?                                    │   │
│  │ [Enable Global Coverage]                                               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Your Coverage Areas                                                         │
│  ... existing coverage management UI ...                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component API Design

### PreviewToolbar Component

```typescript
interface PreviewToolbarProps {
  /** Unique storage key for this page's preview state */
  storageKey: string;

  /** Restrict locality search to publisher's coverage areas */
  restrictToCoverage?: boolean;  // Default: false

  /** Publisher ID (required if restrictToCoverage is true) */
  publisherId?: number;

  /** Whether publisher has global coverage (disables restriction) */
  isGlobalPublisher?: boolean;  // Default: false

  /** Show coverage indicator button (auto-enabled if restrictToCoverage) */
  showCoverageIndicator?: boolean;

  /** Show the date picker section */
  showDatePicker?: boolean;  // Default: true

  /** Show the language toggle */
  showLanguageToggle?: boolean;  // Default: true

  /** Callback when locality changes */
  onLocalityChange?: (localityId: number | null, name: string | null) => void;

  /** Callback when date changes */
  onDateChange?: (date: string) => void;  // ISO YYYY-MM-DD

  /** Callback when language changes */
  onLanguageChange?: (lang: 'en' | 'he') => void;

  /** Controlled mode: external locality ID */
  localityId?: number | null;

  /** Controlled mode: external locality name */
  localityName?: string | null;

  /** Controlled mode: external date */
  date?: string;
}
```

### usePreviewToolbar Hook

```typescript
interface UsePreviewToolbarOptions {
  storageKey: string;
  restrictToCoverage?: boolean;
  publisherId?: number;
  isGlobalPublisher?: boolean;
}

interface PreviewToolbarState {
  // Locality
  localityId: number | null;
  localityName: string | null;
  setLocality: (id: number | null, name: string | null) => void;

  // Date (always stored as Gregorian ISO internally)
  date: string;  // ISO YYYY-MM-DD
  setDate: (date: string) => void;

  // Language (global - controls date format, zman names, etc.)
  language: 'en' | 'he';
  setLanguage: (lang: 'en' | 'he') => void;

  // Convenience
  hasLocation: boolean;
  isGlobal: boolean;
  isHebrew: boolean;  // Shorthand for language === 'he'
}

function usePreviewToolbar(options: UsePreviewToolbarOptions): PreviewToolbarState;
```

---

## Page Configurations

| Page | storageKey | restrictToCoverage | showCoverageIndicator | Notes |
|------|------------|-------------------|----------------------|-------|
| Publisher Algorithm | `algorithm` | ✅ true (unless global) | Only if NOT global | Coverage hidden when `is_global` |
| Publisher Registry | `publisher_registry` | ✅ true (unless global) | Only if NOT global | Coverage hidden when `is_global` |
| Publisher Primitives | `primitives` | ❌ false | ❌ Never | Always global search |
| Admin Registry | `admin_registry` | ❌ false | ❌ Never | Always global search |

---

## Files to Create

| File | Purpose |
|------|---------|
| `web/components/shared/PreviewToolbar.tsx` | Main toolbar component |
| `web/components/shared/DatePicker.tsx` | Language-aware date picker (Gregorian or Hebrew based on language) |
| `web/components/shared/CoverageIndicator.tsx` | Coverage list popover sub-component |
| `web/components/shared/LanguageToggle.tsx` | Single EN/עב toggle sub-component |
| `web/lib/hooks/usePreviewToolbar.ts` | State management hook |
| `db/migrations/YYYYMMDD_add_publisher_is_global.sql` | Database migration |
| `api/internal/handlers/publisher_settings.go` | Global toggle endpoint (if new file needed) |

---

## Files to Modify

| File | Changes |
|------|---------|
| `web/app/publisher/algorithm/page.tsx` | Replace custom controls with PreviewToolbar |
| `web/app/publisher/registry/page.tsx` | Add PreviewToolbar, add coverage restriction |
| `web/components/shared/PrimitivesTable.tsx` | Replace custom controls with PreviewToolbar |
| `web/app/admin/zmanim/registry/page.tsx` | Add PreviewToolbar |
| `web/app/publisher/coverage/page.tsx` | Add global toggle UI |
| `api/internal/handlers/coverage.go` | Handle is_global in responses |
| `api/internal/db/queries/publishers.sql` | Add is_global field queries |
| `api/internal/db/sqlcgen/*` | Regenerate after SQL changes |
| `web/lib/contexts/PreferencesContext.tsx` | Ensure language sync works correctly |

---

## Testing Requirements

### Unit Tests
- [ ] usePreviewToolbar hook state management
- [ ] Cookie read/write for each storage key
- [ ] Language toggle broadcasts across components
- [ ] Date conversion between Gregorian and Hebrew

### Integration Tests
- [ ] PreviewToolbar renders correctly with all prop combinations
- [ ] Coverage indicator shows correct data for regional publishers
- [ ] Coverage indicator shows global badge for global publishers
- [ ] Locality picker respects coverage restriction
- [ ] Locality picker allows all localities when global

### E2E Tests
- [ ] Full flow: select locality → select date → see preview
- [ ] Language toggle persists across page navigation
- [ ] Coverage toggle on coverage page works correctly
- [ ] Preview state persists across browser refresh

---

## Acceptance Criteria

1. ✅ All four pages have consistent Preview Toolbar UI
2. ✅ Each page stores locality/date independently (separate cookies)
3. ✅ Language preference is shared globally across all pages
4. ✅ Publisher Algorithm and Registry restrict locality to coverage (unless global)
5. ✅ Coverage indicator shows list for regional publishers, hidden for global publishers
6. ✅ No location selected = placeholder message, no preview API calls
7. ✅ Dual calendar works with EN/Hebrew mode toggle
8. ✅ Global publisher flag can be toggled on coverage page
9. ✅ Existing coverage preserved when switching to global
10. ✅ API returns appropriate responses for global publishers

---

## Out of Scope

- Map visualization in coverage indicator (simplified to list only)
- Hebrew RTL layout changes (existing RTL support is sufficient)
- Mobile-specific responsive breakpoints (use existing patterns)
- Offline/PWA support for preview state
