# Tooltip Implementation Plan

## Overview

This plan outlines a comprehensive tooltip implementation across the Shtetl Zmanim platform. Tooltips will enhance user experience by providing contextual help for technical terminology, status indicators, form fields, and complex features.

## Current State

- **Tooltip component:** EXISTS at `web/components/ui/tooltip.tsx` (shadcn/ui Radix-based)
- **Global provider:** NOT configured (each usage requires local `TooltipProvider`)
- **Existing usage:** Single implementation in algorithm editor for disabled state explanation

## Implementation Strategy

### Phase 1: Infrastructure Setup

**1.1 Add Global TooltipProvider**

Add `TooltipProvider` to the root layout so tooltips work consistently across all pages without wrapping each component individually.

- **File:** `web/app/layout.tsx`
- **Change:** Wrap children with `<TooltipProvider delayDuration={300}>`

**1.2 Create Reusable Tooltip Components**

Create helper components for common tooltip patterns to ensure consistency.

- **File:** `web/components/shared/InfoTooltip.tsx` (NEW)
- **Purpose:** Small info icon (?) that reveals tooltip on hover
- **Usage:** Form field labels, table headers, status badges

```tsx
// Example API
<InfoTooltip content="Explanation text here" />
<InfoTooltip content="Longer explanation" side="right" />
```

**1.3 Create Tooltip Content Constants**

Centralize tooltip content for consistency and easy updates.

- **File:** `web/lib/tooltip-content.ts` (NEW)
- **Contents:** Organized by category (status, technical, halachic, actions)

---

### Phase 2: High Priority - Public-Facing Pages

**2.1 Homepage (`web/app/page.tsx`)**

| Element | Tooltip Content |
|---------|----------------|
| "Use My Location" button | "Requires browser location permission. Your location data is only used for finding nearby zmanim and is not stored." |
| City elevation display | "Elevation affects sunrise and sunset times. Higher elevations see the sun earlier in the morning and later in the evening." |
| Coverage level badges | "Publishers can cover entire continents, countries, regions, or specific cities. More specific coverage typically means more localized accuracy." |

**2.2 Zmanim Display Pages**

- **Files:** `web/app/zmanim/[cityId]/page.tsx`, `web/app/zmanim/[cityId]/[publisherId]/page.tsx`

| Element | Tooltip Content |
|---------|----------------|
| Verified badge | "This publisher has been verified by our team. Their identity and halachic authority have been confirmed." |
| Time format | "All times shown in 12-hour format (AM/PM)" |
| Zman category tags | Dynamic based on category (Essential, Optional, Event-based) |

---

### Phase 3: Publisher Pages

**3.1 Publisher Dashboard (`web/app/publisher/dashboard/page.tsx`)**

| Element | Tooltip Content |
|---------|----------------|
| Status: "Verified" | "Your account is fully verified. Your zmanim are visible to users in your coverage areas." |
| Status: "Pending" | "Your account is awaiting admin verification. This typically takes 1-3 business days." |
| Status: "Draft" | "These zmanim are not yet published. Users cannot see draft zmanim." |
| "Calculations this month" | "Number of times users have requested zmanim that included your calculations." |

**3.2 Publisher Profile (`web/app/publisher/profile/page.tsx`)**

| Element | Tooltip Content |
|---------|----------------|
| Organization field | "The name of your synagogue, organization, or religious authority. This is displayed to users." |
| Bio field | "A brief description of your halachic approach and authority. Help users understand your methodology." |
| Logo upload | "Recommended: Square image, minimum 200x200 pixels. PNG or JPG format." |

**3.3 Algorithm List (`web/app/publisher/algorithm/page.tsx`)**

| Element | Tooltip Content |
|---------|----------------|
| "Everyday" tab | "Regular daily zmanim like Alos, Sunrise, Sunset, etc." |
| "Events" tab | "Special occasion zmanim like Shabbos candle lighting, Havdalah, and holiday times." |
| Tag: "GRA" | "Gra of Vilna calculation method: Uses actual sunrise to sunset for day length." |
| Tag: "MGA" | "Magen Abraham calculation method: Uses Alos to Tzeis for day length." |
| Tag: "16.1°" | "Solar angle of 16.1 degrees below the horizon, commonly used for Alos and Tzeis." |
| Status: "Draft" | "Not visible to users. Publish to make available." |
| Status: "Published" | "Visible to users in your coverage areas." |

**3.4 Algorithm Editor (`web/app/publisher/algorithm/edit/[zman_key]/page.tsx`)**

| Element | Tooltip Content |
|---------|----------------|
| "Guided Builder" tab | "Visual formula builder for common calculation patterns. Best for standard calculations." |
| "Advanced DSL" tab | "Direct formula editing with full syntax access. For complex or custom calculations." |
| Hebrew name field | "Required. Must contain Hebrew characters (א-ת). Displayed to Hebrew-reading users." |
| Transliteration field | "Phonetic pronunciation for non-Hebrew speakers. Example: 'Alos HaShachar'" |
| AI Explanation button | "Generate a plain-language explanation of this zman using AI. Available in Hebrew or English." |
| Publisher Comment | "Optional note displayed to end users. Use for halachic context or special instructions." |
| Preview section | "Test your formula with different dates and locations to verify calculations." |

**3.5 Coverage Setup (`web/app/publisher/coverage/page.tsx`)**

| Element | Tooltip Content |
|---------|----------------|
| Coverage Level: Continent | "Your zmanim apply to all cities in selected continents. Broadest coverage." |
| Coverage Level: Country | "Your zmanim apply to all cities in selected countries." |
| Coverage Level: Region | "Your zmanim apply to all cities in selected states/provinces/regions." |
| Coverage Level: City | "Your zmanim apply only to specifically selected cities. Most precise coverage." |
| Priority field | "When multiple publishers cover an area, higher priority publishers appear first. Default is 0." |
| Active toggle | "Inactive coverage areas are hidden from users but preserved for later use." |

---

### Phase 4: Admin Pages

**4.1 Admin Dashboard (`web/app/admin/dashboard/page.tsx`)**

| Element | Tooltip Content |
|---------|----------------|
| "Active Publishers" | "Publishers with verified status whose zmanim are visible to users." |
| "Pending Approval" | "Publishers awaiting identity and authority verification." |
| "Suspended" | "Publishers temporarily disabled due to policy violations or at their request." |
| "Cache Hit Ratio" | "Percentage of zmanim requests served from cache. Higher is better for performance." |

**4.2 Admin Publishers (`web/app/admin/publishers/page.tsx`)**

| Element | Tooltip Content |
|---------|----------------|
| "Verify" action | "Approve this publisher. Their zmanim will become visible to users in their coverage areas." |
| "Suspend" action | "Temporarily disable this publisher. Their zmanim will be hidden from users." |
| Status: "pending_verification" | "Publisher has completed profile but awaits admin review." |

**4.3 Master Registry (`web/app/admin/zmanim/registry/page.tsx`)**

| Element | Tooltip Content |
|---------|----------------|
| Time Category | "Classification of when this zman occurs: morning, midday, evening, night, or variable." |
| Tag Type | "Event: special occasions. Timing: daily prayers. Behavior: calculation methods." |
| is_core toggle | "Core zmanim are essential and shown by default. Optional zmanim are secondary." |
| is_hidden toggle | "Hidden zmanim are not shown to publishers or users but remain in the system." |
| default_formula_dsl | "The default DSL formula used when publishers don't specify their own calculation." |
| Halachic Source | "Primary reference (e.g., 'Shulchan Aruch OC 89:1')" |
| Halachic Notes | "Additional context about the zman's halachic significance and variations." |

---

### Phase 5: Shared Components

**5.1 DSL Reference Panel (`web/components/editor/DSLReferencePanel.tsx`)**

Add tooltips to each DSL primitive and function explaining syntax and usage.

| Category | Examples with Tooltips |
|----------|----------------------|
| Primitives | `SUNRISE`, `SUNSET`, `ALOS`, `TZEIS` - each with definition |
| Functions | `SolarAngle(degrees, direction)`, `FixedOffset(base, minutes)` |
| Shaos Bases | `GRA` vs `MGA` explanation |
| Operators | `+`, `-`, `MIN`, `MAX` with examples |

**5.2 Formula Builder (`web/components/formula-builder/FormulaBuilder.tsx`)**

| Element | Tooltip Content |
|---------|----------------|
| Method: Fixed Zman | "A specific time that doesn't change (e.g., always 6:00 AM)" |
| Method: Solar Angle | "Time when sun reaches specific angle below horizon" |
| Method: Fixed Offset | "Minutes before or after another zman" |
| Method: Proportional Hours | "Fraction of halachic day based on GRA or MGA" |

**5.3 Bilingual Input (`web/components/shared/BilingualInput.tsx`)**

Convert existing inline help text to tooltips on the field labels for cleaner UI.

---

### Phase 6: Halachic Terminology Glossary Tooltips

Create a centralized glossary for consistent halachic term tooltips.

**File:** `web/lib/halachic-glossary.ts` (NEW)

```tsx
export const HALACHIC_TERMS = {
  alos_hashachar: "Dawn - the first light visible on the eastern horizon",
  netz_hachama: "Sunrise - when the sun's upper edge appears on the horizon",
  sof_zman_shema: "Latest time to recite the morning Shema prayer",
  sof_zman_tefillah: "Latest time for the morning Amidah prayer",
  chatzos: "Midday - when the sun is at its highest point",
  mincha_gedolah: "Earliest time for afternoon prayer",
  mincha_ketanah: "Preferred start time for afternoon prayer",
  plag_hamincha: "Transitional time between afternoon and evening",
  shkiah: "Sunset - when the sun's upper edge disappears below horizon",
  tzeis_hakochavim: "Nightfall - when three medium stars are visible",
  // ... etc
};
```

---

## Implementation Order

1. **Infrastructure** (Phase 1) - Enables all subsequent work
2. **Publisher Algorithm Editor** (Phase 3.4) - Most complex page, highest user confusion
3. **Publisher Dashboard & Status** (Phase 3.1) - High visibility, common questions
4. **Homepage** (Phase 2.1) - First touchpoint for new users
5. **Coverage Setup** (Phase 3.5) - Complex concept needing explanation
6. **Admin Pages** (Phase 4) - Lower priority, internal users
7. **DSL Components** (Phase 5) - Technical depth for power users

---

## Files to Create

| File | Purpose |
|------|---------|
| `web/components/shared/InfoTooltip.tsx` | Reusable info icon with tooltip |
| `web/lib/tooltip-content.ts` | Centralized tooltip strings |
| `web/lib/halachic-glossary.ts` | Halachic term definitions |

## Files to Modify

| File | Changes |
|------|---------|
| `web/app/layout.tsx` | Add global `TooltipProvider` |
| `web/app/page.tsx` | Add tooltips to location UI |
| `web/app/publisher/dashboard/page.tsx` | Status badge tooltips |
| `web/app/publisher/profile/page.tsx` | Form field tooltips |
| `web/app/publisher/algorithm/page.tsx` | Tag and status tooltips |
| `web/app/publisher/algorithm/edit/[zman_key]/page.tsx` | Editor tooltips |
| `web/app/publisher/coverage/page.tsx` | Coverage level tooltips |
| `web/app/admin/dashboard/page.tsx` | Metric tooltips |
| `web/app/admin/publishers/page.tsx` | Action tooltips |
| `web/app/admin/zmanim/registry/page.tsx` | Field tooltips |
| `web/components/editor/DSLReferencePanel.tsx` | DSL primitive tooltips |
| `web/components/formula-builder/FormulaBuilder.tsx` | Method tooltips |
| `web/components/shared/BilingualInput.tsx` | Convert inline help to tooltips |

---

## Success Criteria

- All status badges have tooltips explaining their meaning
- All technical terms (DSL, GRA, MGA, solar angle) have clear explanations
- All form fields with non-obvious purposes have helper tooltips
- Tooltips are consistent in tone and length (1-2 sentences)
- No tooltip blocks interaction with underlying elements
- Tooltips work on both desktop (hover) and mobile (tap)

---

## Estimated Scope

- **New files:** 3
- **Modified files:** ~15
- **Individual tooltips:** ~60-80
- **Complexity:** Medium (mostly additive, low risk)
