# Story 8.34: Seconds Display Toggle with Publisher Rounding Control

Status: ready-for-review

## Story

**As a user** viewing zmanim times,
I want to toggle whether seconds are displayed,
So that I can see times at my preferred precision level.

**As a publisher** configuring my zmanim,
I want to control how each individual zman time is rounded when seconds are hidden,
So that I can ensure times are displayed appropriately for each zman's halachic purpose (e.g., round down for start times, round up for end times).

## Context

Currently, zmanim times are displayed with seconds (e.g., "06:42:30"). Users may prefer:
- **No seconds** (cleaner display): "06:42" or "06:43" depending on rounding
- **With seconds** (precision): "06:42:30"

### Two-Level Control Architecture

**User Level (Display Preference):**
- Users toggle show/hide seconds via their preferences
- This is stored in cookies and persists across sessions
- Users do NOT control rounding - that's determined by the publisher per-zman

**Publisher Level (Per-Zman Rounding):**
- Publishers set rounding mode for EACH zman individually on the ZmanCard
- Stored in the database `publisher_zmanim.rounding_mode` column
- Three rounding options with color-coded visual indicator:
  1. **Round down** (floor): 06:42:30 → 06:42 - **Blue** ⬇️ (always earlier, "safe" for starting times)
  2. **Round up** (ceil): 06:42:30 → 06:43 - **Red** ⬆️ (always later, "safe" for ending times)
  3. **Mathematical** (default): 06:42:30 → 06:43, 06:42:29 → 06:42 - **Gray** ≈ (standard ≥30 rounds up)

**Page Defaults:**
- Anonymous zmanim page (`/zmanim`): Seconds OFF by default
- Publisher algorithm page (`/publisher/algorithm`): Seconds ON by default

**Important:** Rounding only affects DISPLAY, not the underlying calculated value. The actual time remains precise; only the visual representation changes.

## Acceptance Criteria

### User Display Toggle
1. Toggle switch for "Show Seconds" appears at top of:
   - [x] Anonymous zmanim page (`/zmanim`)
   - [x] Publisher algorithm page (`/publisher/algorithm`)
2. Default states:
   - [x] Anonymous page: seconds OFF
   - [x] Algorithm page: seconds ON
3. Settings persist in cookies (integrates with PreferencesContext from Story 8.29)
4. Settings apply consistently across all time displays on the page

### Publisher Rounding Control (ZmanCard)
5. 3-way rounding toggle appears on each ZmanCard:
   - [x] Down arrow (blue) - "Round Down" (floor)
   - [x] Tilde/≈ (gray) - "Mathematical" (default)
   - [x] Up arrow (red) - "Round Up" (ceil)
6. [x] Rounding mode persists to database per-zman (`publisher_zmanim.rounding_mode`)
7. [x] Visual indicator clearly shows current rounding mode with distinct colors
8. [x] Tooltip explains each rounding mode's behavior
9. [x] Changes trigger React Query invalidation to update UI

### Time Display Behavior
10. [x] When user has seconds ON: Display full time with seconds (rounding not applied)
11. [x] When user has seconds OFF: Apply publisher's per-zman rounding mode

## Tasks / Subtasks

### User Display Preferences (Already Exists - Verify)
- [x] Task 1: PreferencesContext display settings (DONE - Story 8.29)
  - [x] 1.1 `showSeconds: boolean` in UserPreferences interface
  - [x] 1.2 Cookie constant `COOKIE_SHOW_SECONDS`
  - [x] 1.3 `setShowSeconds()` method
  - [x] 1.4 Cross-tab sync for showSeconds preference
  - **Note:** User-level `roundingMode` preference should be REMOVED or deprecated - rounding is per-zman publisher setting

### Time Formatting Utility (Already Exists - Verify)
- [x] Task 2: Time formatting utility (DONE)
  - [x] 2.1 `formatZmanTime()` in `web/lib/utils/time-format.ts`
  - [x] 2.2 Floor rounding (truncate seconds)
  - [x] 2.3 Ceil rounding (round up if any seconds)
  - [x] 2.4 Mathematical rounding (≥30 rounds up)
  - [x] 2.5 Update to accept rounding from zman data, not user preference

### User Display Toggle (Already Exists - Verify)
- [x] Task 3: DisplaySettingsToggle component (DONE - simplified)
  - [x] 3.1 `web/components/shared/DisplaySettingsToggle.tsx` exists
  - [x] 3.2 Seconds toggle switch implemented
  - **Note:** Rounding selector should NOT be in this component - it's per-zman on ZmanCard

### Publisher Rounding Control (NEW - Main Work)
- [x] Task 4: Add RoundingModeToggle to ZmanCard
  - [x] 4.1 Create `RoundingModeToggle` component with 3-way toggle
  - [x] 4.2 Style with distinct colors: Blue (floor), Gray (math), Red (ceil)
  - [x] 4.3 Use shadcn/ui ToggleGroup with arrow icons
  - [x] 4.4 Add tooltips explaining each mode's behavior
  - [x] 4.5 Integrate into ZmanCard component layout (status toggles section)

- [x] Task 5: Backend API for rounding mode
  - [x] 5.1 Verify `rounding_mode` column exists in `publisher_zmanim` table
  - [x] 5.2 Add `rounding_mode` to UpdatePublisherZman mutation
  - [x] 5.3 Return `rounding_mode` in GetPublisherZmanim query
  - [x] 5.4 Expose in API response and TypeScript types
  - [x] 5.5 Added GetPublisherZmanimSettings query for public API
  - [x] 5.6 Added `rounding_mode` field to ZmanWithFormula response

- [x] Task 6: Connect frontend to backend
  - [x] 6.1 Add `rounding_mode` to `PublisherZman` TypeScript interface
  - [x] 6.2 Update `useUpdateZman` hook to support rounding_mode
  - [x] 6.3 Invalidate queries on rounding mode change

### Integration
- [x] Task 7: Anonymous zmanim page integration
  - [x] 7.1 Add DisplaySettingsToggle to page header (seconds only)
  - [x] 7.2 Pass `showSeconds` to time display components
  - [x] 7.3 Read per-zman `rounding_mode` from API response
  - [x] 7.4 Apply publisher's rounding when seconds hidden

- [x] Task 8: Publisher algorithm page integration
  - [x] 8.1 Ensure DisplaySettingsToggle shows seconds toggle
  - [x] 8.2 Ensure RoundingModeToggle appears on each ZmanCard
  - [x] 8.3 Verify rounding persists to database
  - [x] 8.4 AlgorithmPreview component updated to use formatTimeString with per-zman rounding

### Testing
- [ ] Task 9: Testing
  - [ ] 9.1 Unit tests for time formatting utility
  - [ ] 9.2 Component tests for RoundingModeToggle
  - [ ] 9.3 E2E test: user seconds toggle persists across refresh
  - [ ] 9.4 E2E test: publisher rounding mode persists to DB
  - [ ] 9.5 Visual regression tests for time displays with different rounding

## Dev Notes

### Key Files
- `web/lib/contexts/PreferencesContext.tsx` - User showSeconds preference (rounding should be deprecated here)
- `web/lib/utils/time-format.ts` - Time formatting with rounding logic
- `web/components/shared/DisplaySettingsToggle.tsx` - User seconds toggle (simplified, no rounding)
- `web/components/publisher/ZmanCard.tsx` - Add RoundingModeToggle here
- `web/components/publisher/RoundingModeToggle.tsx` - NEW component for publisher rounding control
- `web/app/zmanim/page.tsx` - Anonymous zmanim page
- `web/app/publisher/algorithm/page.tsx` - Publisher algorithm page

### Database Schema
The `publisher_zmanim` table already has a `rounding_mode` column:
```sql
-- publisher_zmanim.rounding_mode
-- Values: 'floor' | 'math' | 'ceil'
-- Default: 'math'
```

### Cookie Names (User Preferences Only)
```typescript
const COOKIE_SHOW_SECONDS = 'zmanim_show_seconds';
// DEPRECATED: const COOKIE_ROUNDING_MODE - rounding is per-zman, not user preference
const TTL_DISPLAY_PREFS = 365; // 1 year
```

### RoundingModeToggle Component (NEW - Publisher Control)
```tsx
import { ArrowDown, ArrowUp, Equal } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type RoundingMode = 'floor' | 'math' | 'ceil';

interface RoundingModeToggleProps {
  value: RoundingMode;
  onChange: (mode: RoundingMode) => void;
  disabled?: boolean;
}

/**
 * 3-way toggle for publisher to set rounding mode per-zman
 * Color scheme:
 * - Floor (down): Blue - safe for start times (earlier)
 * - Math (middle): Gray - standard mathematical rounding
 * - Ceil (up): Red - safe for end times (later)
 */
export function RoundingModeToggle({ value, onChange, disabled }: RoundingModeToggleProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as RoundingMode)}
        disabled={disabled}
        className="h-7"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value="floor"
              className={`h-7 w-7 p-0 ${value === 'floor' ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300' : ''}`}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="text-xs">
              <p className="font-medium text-blue-600 dark:text-blue-400">Round Down (Floor)</p>
              <p>06:42:30 → 06:42</p>
              <p className="text-muted-foreground">Safe for start times</p>
            </div>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value="math"
              className={`h-7 w-7 p-0 ${value === 'math' ? 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300' : ''}`}
            >
              <Equal className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="text-xs">
              <p className="font-medium">Mathematical Rounding</p>
              <p>06:42:30 → 06:43 (≥30 rounds up)</p>
              <p>06:42:29 → 06:42 (&lt;30 rounds down)</p>
            </div>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value="ceil"
              className={`h-7 w-7 p-0 ${value === 'ceil' ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-300' : ''}`}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="text-xs">
              <p className="font-medium text-red-600 dark:text-red-400">Round Up (Ceil)</p>
              <p>06:42:01 → 06:43</p>
              <p className="text-muted-foreground">Safe for end times</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </TooltipProvider>
  );
}
```

### ZmanCard Integration
Add to the status toggles section in ZmanCard (around line 452):
```tsx
{/* Rounding Mode - Publisher control for display when seconds hidden */}
<div className="flex items-center gap-2">
  <span className="text-xs text-muted-foreground">Rounding:</span>
  <RoundingModeToggle
    value={zman.rounding_mode || 'math'}
    onChange={(mode) => updateZman.mutateAsync({ rounding_mode: mode })}
    disabled={updateZman.isPending}
  />
</div>
```

### PublisherZman Interface Update
```typescript
export interface PublisherZman {
  // ... existing fields
  rounding_mode: 'floor' | 'math' | 'ceil';  // NEW field from DB
}
```

### Time Display Usage (in time components)
```tsx
// When displaying a zman time, use the zman's rounding_mode, not user preference
const formattedTime = formatZmanTime(
  calculatedTime,
  preferences.showSeconds ?? defaultShowSeconds,
  zman.rounding_mode || 'math'  // Use per-zman setting
);
```

## References

- **Coding Standards:** [docs/coding-standards.md](../../coding-standards.md) - MUST READ before implementation
- **Global Standards:** [docs/coding-standards-global.md](../../coding-standards-global.md) - Cross-project patterns
- **Frontend Design:** [.claude/skills/frontend_design.md](../../.claude/skills/frontend_design.md) - UI/UX patterns
- **Related Stories:**
  - Story 8.29 - Unified User Preferences with Cookie Persistence (foundation)
  - Story 8.35 - Zman Card Time Preview (consumes these settings)
  - Story 8.36 - Extended Display Preferences Persistence (extends this)
- **PreferencesContext:** `web/lib/contexts/PreferencesContext.tsx`
- **Context File:** [8-34-seconds-display-toggle-with-rounding.context.xml](./8-34-seconds-display-toggle-with-rounding.context.xml)

## Definition of Done (DoD)

### User Display Toggle
- [x] Seconds toggle works on anonymous zmanim page (`/zmanim`)
- [x] Seconds toggle works on publisher algorithm page (`/publisher/algorithm`)
- [x] User seconds setting persists in cookies across sessions
- [x] Page defaults respected (anonymous=OFF, algorithm=ON)

### Publisher Rounding Control
- [x] RoundingModeToggle component displays on each ZmanCard
- [x] 3-way toggle shows: Blue ⬇️ (floor), Gray ≈ (math), Red ⬆️ (ceil)
- [x] Tooltips explain each rounding mode's behavior
- [x] Rounding mode persists to database per-zman
- [x] Changes invalidate React Query and update UI

### Time Display Behavior
- [x] When seconds ON: Full time displayed (no rounding)
- [x] When seconds OFF: Publisher's per-zman rounding mode applied
- [x] Rounding correctly applies to all time displays on page

### Testing
- [ ] Unit tests for `formatZmanTime()` utility
- [ ] Component tests for RoundingModeToggle
- [ ] E2E test: user seconds toggle persists across refresh
- [ ] E2E test: publisher rounding mode persists to DB
- [x] Type check passes: `cd web && npm run type-check`
- [ ] E2E tests pass: `cd tests && npx playwright test`

### Verification Commands
```bash
# Frontend type check
cd web && npm run type-check

# E2E tests
cd tests && npx playwright test

# Manual verification - User flow
# 1. Go to /zmanim - verify seconds OFF by default
# 2. Toggle seconds ON - verify times show :SS
# 3. Toggle seconds OFF - verify times rounded per zman's setting
# 4. Refresh page - verify seconds setting persists

# Manual verification - Publisher flow
# 1. Go to /publisher/algorithm - verify seconds ON by default
# 2. Find a ZmanCard and locate the 3-way rounding toggle
# 3. Click Blue ⬇️ (floor) - verify tooltip shows "Round Down"
# 4. Click Gray ≈ (math) - verify tooltip shows "Mathematical"
# 5. Click Red ⬆️ (ceil) - verify tooltip shows "Round Up"
# 6. Refresh page - verify rounding mode persisted
# 7. Toggle seconds OFF to see rounding in action
```

## Estimated Points

5 points (Feature - Medium complexity)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-14 | Story drafted | Claude Opus 4.5 |
| 2025-12-15 | Major revision: Split into user toggle (seconds) + publisher control (per-zman rounding with colored 3-way toggle) | Claude Opus 4.5 |
| 2025-12-15 | Implementation complete: Backend API updated (GetPublisherZmanimSettings, ZmanWithFormula.rounding_mode), Frontend integration (anonymous page, publisher page, AlgorithmPreview) | Claude Opus 4.5 |
