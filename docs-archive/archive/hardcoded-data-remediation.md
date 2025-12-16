# Hardcoded Zmanim Data Remediation Plan

**Date:** 2025-12-03
**Status:** CRITICAL - Compliance Audit Required
**Priority:** P0 - Blocking

## Executive Summary

A comprehensive audit has revealed **extensive hardcoded zmanim-related data** scattered across 20+ files in both backend and frontend. This directly violates the project principle that **ALL zmanim metadata must be database-driven**.

**Zero Tolerance Policy:** No fallbacks, no defaults, no excuses. If metadata doesn't exist in the database, the system should fail explicitly rather than silently substitute hardcoded values.

---

## Critical Violations Inventory

### SEVERITY: CRITICAL (P0)

#### 1. Hebrew Name Fallbacks in Backend
**File:** `api/internal/handlers/zmanim.go`
**Lines:** 299-332

```go
// VIOLATION: Hardcoded Hebrew fallback for candle lighting
if candleHebrewName == "" {
    candleHebrewName = "הדלקת נרות"  // Line 302
}

// VIOLATION: Hardcoded Hebrew fallback for havdalah
if havdalahHebrewName == "" {
    havdalahHebrewName = "הבדלה"  // Line 331
}
```

**Also hardcoded in same function:**
- English name: "Candle Lighting" (Line 305)
- English name: "Havdalah" (Line 334)
- Time category: "sunset" (Line 310)
- Time category: "nightfall" (Line 339)
- Formula explanation: "Traditional candle lighting time..." (Line 318)
- Formula explanation: "Traditional havdalah time..." (Line 347)
- Fixed minutes: 18, 42 (Lines 297, 326)

---

#### 2. Hebrew Name Fallbacks in Frontend
**File:** `web/app/zmanim/[cityId]/[publisherId]/page.tsx`
**Lines:** 202-217

```typescript
// VIOLATION: Complete fallback map for Hebrew names
const fallbackHebrewNames: Record<string, string> = {
    alos_hashachar: 'עלות השחר',
    misheyakir: 'משיכיר',
    sunrise: 'הנץ החמה',
    sof_zman_shma_gra: 'סוף זמן ק״ש גר״א',
    sof_zman_shma_mga: 'סוף זמן ק״ש מג״א',
    sof_zman_tfila_gra: 'סוף זמן תפלה גר״א',
    sof_zman_tfila_mga: 'סוף זמן תפלה מג״א',
    chatzos: 'חצות היום',
    mincha_gedola: 'מנחה גדולה',
    mincha_ketana: 'מנחה קטנה',
    plag_hamincha: 'פלג המנחה',
    sunset: 'שקיעה',
    tzais: 'צאת הכוכבים',
    tzais_72: 'צאת (72 דקות)',
};
```

**Usage:** Line 499 - `fallbackHebrewNames[zman.key] || englishName`

---

#### 3. English Name Fallbacks in Frontend
**File:** `web/app/zmanim/[cityId]/[publisherId]/page.tsx`
**Lines:** 52-70

```typescript
// VIOLATION: Complete fallback map for English names
const formatZmanName = (key: string): string => {
  const names: Record<string, string> = {
    alos_hashachar: 'Alos HaShachar',
    misheyakir: 'Misheyakir',
    sunrise: 'Sunrise (Netz HaChama)',
    // ... 14 total entries
  };
  return names[key] || key.replace(/_/g, ' ')...;
};
```

---

#### 4. Bilingual Names Map in Backend
**File:** `api/internal/algorithm/types.go`
**Lines:** 84-152

```go
// VIOLATION: StandardZmanim array (Lines 84-99)
var StandardZmanim = []string{
    "alos_hashachar", "misheyakir", "sunrise", ...
}

// VIOLATION: ZmanDisplayNames map (Lines 102-117)
var ZmanDisplayNames = map[string]string{
    "alos_hashachar": "Alos HaShachar",
    // ... 14 entries
}

// VIOLATION: ZmanBilingualNames map (Lines 127-152)
var ZmanBilingualNames = map[string]BilingualName{
    "alos_hashachar": {Hebrew: "עלות השחר", English: "Dawn", Transliteration: "Alos HaShachar"},
    // ... 24 entries with Hebrew, English, Transliteration
}
```

---

#### 5. Time Category Hardcoding
**File:** `api/internal/handlers/master_registry.go`

```go
// Line 331: Hardcoded category order
categoryOrder := []string{"dawn", "sunrise", "morning", "midday", "afternoon", "sunset", "nightfall", "midnight"}

// Line 411: Hardcoded event category order
categoryOrder := []string{"candles", "havdalah", "fast_day", "tisha_bav", "pesach"}

// Lines 2846-2856: AdminGetTimeCategories returns hardcoded data
categories := []map[string]string{
    {"key": "dawn", "display_name": "Dawn"},
    {"key": "sunrise", "display_name": "Sunrise"},
    // ...
}
```

**File:** `web/app/zmanim/[cityId]/[publisherId]/page.tsx`

```typescript
// Lines 75-91: mapTimeCategory function
const mapTimeCategory = (category?: string): string => {
  switch (category) {
    case 'dawn': return 'dawn';
    case 'sunrise':
    case 'morning': return 'morning';
    // ...
  }
};

// Lines 135-162: getSectionTitle function (Hebrew & English)
const getSectionTitle = (section: string, hebrew: boolean = false) => {
  if (hebrew) {
    switch (section) {
      case 'dawn': return 'שחר';
      case 'morning': return 'בוקר';
      // ...
    }
  }
  // English cases...
};

// Line 165: SECTION_ORDER constant
const SECTION_ORDER = ['dawn', 'morning', 'midday', 'evening'] as const;
```

---

### SEVERITY: HIGH (P1)

#### 6. Tag Type Labels and Colors
**File:** `web/components/publisher/RequestZmanModal.tsx`
**Lines:** 76-85

```typescript
const TAG_TYPE_LABELS: Record<string, string> = {
  event: 'Event Type',
  timing: 'Time of Day',
  behavior: 'Behavior',
  shita: 'Shita (Opinion)',
  method: 'Calculation Method',
};

const TAG_TYPE_ORDER = ['timing', 'event', 'shita', 'method', 'behavior'];
```

**File:** `web/app/admin/tag-requests/page.tsx`
**Lines:** 45-49

```typescript
const TAG_TYPE_COLORS: Record<string, string> = {
    event: 'bg-blue-500/10 text-blue-700...',
    timing: 'bg-green-500/10 text-green-700...',
    behavior: 'bg-purple-500/10 text-purple-700...',
    // ...
};
```

---

#### 7. Event Category Mapping
**File:** `api/internal/handlers/master_registry.go`
**Lines:** 471-500

```go
// VIOLATION: Hardcoded switch for behavior tag to category mapping
switch tag.Name {
    case "is_candle_lighting":
        category = "candles"
    case "is_havdalah":
        category = "havdalah"
    case "is_fast_start", "is_fast_end":
        category = "fast_day"
        // Special logic for tisha_bav
}
```

---

#### 8. Algorithm Templates
**File:** `api/internal/handlers/publisher_algorithm.go`
**Lines:** 386-472

```go
// VIOLATION: Complete algorithm templates hardcoded
templates := []map[string]interface{}{
    {
        "id": "gra",
        "name": "GRA (Vilna Gaon)",
        "description": "Standard GRA calculations...",
        "zmanim": map[string]interface{}{
            "alos_hashachar": map[string]interface{}{
                "method": "solar_angle",
                "degrees": 16.1,
            },
            // ... complete zmanim configuration
        },
    },
    // MGA, Rabbeinu Tam, Custom templates...
}
```

---

### SEVERITY: MEDIUM (P2)

#### 9. DSL Editor Completions
**File:** `web/lib/codemirror/dsl-completions.ts`
**Lines:** 11-60

```typescript
// VIOLATION: Hardcoded primitive completions with Hebrew
const PRIMITIVE_COMPLETIONS = [
    { label: 'sunrise', info: 'Sun rises above horizon', detail: 'נץ החמה' },
    { label: 'sunset', info: 'Sun sets below horizon', detail: 'שקיעה' },
    // ... 21 entries
];
```

**File:** `web/lib/dsl-context-helper.ts`
**Lines:** 209-311

```typescript
// VIOLATION: TOOLTIP_CONTENT with Hebrew descriptions
const TOOLTIP_CONTENT = {
    // Solar angles with Hebrew names
    // Proportional hours with Hebrew descriptions
    // Base systems with explanations
};
```

---

#### 10. Halachic Glossary
**File:** `web/lib/halachic-glossary.ts`
**Lines:** 20-225

```typescript
// VIOLATION: Complete glossary with bilingual definitions
export const HALACHIC_TERMS: HalachicTerm[] = [
    {
        key: 'alos_hashachar',
        hebrew: 'עלות השחר',
        transliteration: 'Alos HaShachar',
        shortDefinition: 'Dawn - first light',
        fullDefinition: '...',
    },
    // ... 30+ entries
];
```

---

#### 11. Formula Explanations
**File:** `api/internal/algorithm/parser.go`
**Lines:** 87-132

```go
// VIOLATION: Hardcoded English explanation strings
func GetFormulaInfo() string {
    "The moment when the upper edge of the sun appears on the horizon"
    "When the sun is %.1f° below the horizon"
    "%.0f minutes after %s"
    "%.2f proportional hours from %s"
}
```

---

#### 12. Astronomical Primitive Display Names
**File:** `api/internal/handlers/master_registry.go`
**Lines:** 2138-2143

```go
categoryDisplayNames := map[string]string{
    "horizon":               "Horizon Events",
    "civil_twilight":        "Civil Twilight",
    "nautical_twilight":     "Nautical Twilight",
    "astronomical_twilight": "Astronomical Twilight",
    "solar_position":        "Solar Position",
}
```

---

#### 13. ZmanTagEditor Labels
**File:** `web/components/publisher/ZmanTagEditor.tsx`
**Line:** 91

```typescript
const tagTypeLabels: Record<string, string> = {
    event: 'Event Type',
    timing: 'Time of Day',
    behavior: 'Behavior',
    shita: 'Shita',
    method: 'Method',
};
```

---

## Compliance Violations Summary

| Category | Files Affected | Hardcoded Items | Severity |
|----------|----------------|-----------------|----------|
| Hebrew Names | 3 | 40+ | CRITICAL |
| English Names | 4 | 30+ | CRITICAL |
| Time Categories | 4 | 16+ | CRITICAL |
| Tag Types | 3 | 15+ | HIGH |
| Algorithm Templates | 1 | 4 complete | HIGH |
| DSL/Editor Data | 3 | 50+ | MEDIUM |
| Formula Explanations | 2 | 10+ | MEDIUM |
| Glossary Data | 1 | 30+ | MEDIUM |

**Total: ~200 hardcoded data items across 20+ files**

---

## Required Database Schema

The existing `database-driven-zmanim-plan.md` covers most schema changes. Additional requirements:

### 1. Extend `master_zmanim_registry` Table

```sql
-- Ensure these columns exist with NOT NULL constraints
ALTER TABLE master_zmanim_registry
    ALTER COLUMN canonical_hebrew_name SET NOT NULL,
    ALTER COLUMN canonical_english_name SET NOT NULL;

-- Add formula explanation template
ALTER TABLE master_zmanim_registry
    ADD COLUMN IF NOT EXISTS formula_explanation_template TEXT;
```

### 2. Add `display_groups` Table (for UI grouping)

```sql
CREATE TABLE IF NOT EXISTS display_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,
    display_name_hebrew VARCHAR(100) NOT NULL,
    display_name_english VARCHAR(100) NOT NULL,
    icon_name VARCHAR(50),
    sort_order INTEGER NOT NULL,
    time_categories TEXT[] NOT NULL, -- Maps time_categories to this group
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO display_groups (key, display_name_hebrew, display_name_english, icon_name, sort_order, time_categories) VALUES
('dawn', 'שחר', 'Dawn', 'Moon', 1, ARRAY['dawn']),
('morning', 'בוקר', 'Morning', 'Sun', 2, ARRAY['sunrise', 'morning']),
('midday', 'צהריים', 'Midday', 'Clock', 3, ARRAY['midday', 'afternoon']),
('evening', 'ערב', 'Evening', 'Sunset', 4, ARRAY['sunset', 'nightfall', 'midnight']);
```

### 3. Add `algorithm_templates` Table

```sql
CREATE TABLE IF NOT EXISTS algorithm_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    algorithm_json JSONB NOT NULL,
    is_default BOOLEAN DEFAULT false,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. Add `dsl_primitives` Table

```sql
CREATE TABLE IF NOT EXISTS dsl_primitives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,
    display_name_hebrew VARCHAR(100) NOT NULL,
    display_name_english VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- horizon, twilight, solar_position
    completion_info TEXT, -- For IDE autocomplete
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Remediation Phases

### Phase 1: Database Schema & Seed Data (Day 1)
**Priority:** P0

1. Create migration `00000000000004_hardcoded_remediation.sql`:
   - Add `display_groups` table
   - Add `algorithm_templates` table
   - Add `dsl_primitives` table
   - Extend `time_categories` with all required fields
   - Extend `tag_types` with colors
   - Ensure `master_zmanim_registry` has NOT NULL on name columns

2. Create seed data script with all current hardcoded values

3. Run migrations and verify data integrity

---

### Phase 2: Backend API Endpoints (Day 1-2)
**Priority:** P0

1. **New Endpoints:**
   - `GET /api/categories/display-groups` - For UI grouping
   - `GET /api/templates/algorithms` - Algorithm templates from DB
   - `GET /api/dsl/primitives` - DSL completion data

2. **Update Existing:**
   - `GET /api/categories/time` - Already exists, ensure complete
   - `GET /api/tag-types` - Add color field

3. **Remove Hardcoding in Handlers:**
   - `zmanim.go`: Remove Hebrew fallbacks, fail if not in DB
   - `master_registry.go`: Remove all hardcoded category arrays
   - `publisher_algorithm.go`: Load templates from DB
   - `algorithm/types.go`: Remove all hardcoded maps

---

### Phase 3: Frontend Hook Migration (Day 2-3)
**Priority:** P0

1. **Create/Update Hooks in `web/lib/hooks/`:**
   ```typescript
   // useDisplayGroups.ts - For UI section grouping
   // useAlgorithmTemplates.ts - For template selection
   // useDslPrimitives.ts - For editor completions
   // Update useTagTypes.ts - Add colors
   ```

2. **Update Components:**
   - `[cityId]/[publisherId]/page.tsx`: Remove all fallback maps
   - `RequestZmanModal.tsx`: Use `useTagTypes()` for labels/colors
   - `ZmanTagEditor.tsx`: Use `useTagTypes()` for labels
   - `tag-requests/page.tsx`: Use `useTagTypes()` for colors

---

### Phase 4: Zero-Fallback Enforcement (Day 3)
**Priority:** P0

1. **Backend: Fail Explicitly**
   ```go
   // BEFORE (wrong):
   if hebrewName == "" {
       hebrewName = "הדלקת נרות"
   }

   // AFTER (correct):
   if hebrewName == "" {
       slog.Error("missing hebrew name in master registry", "zman_key", key)
       RespondInternalError(w, r, "Configuration error: missing zman metadata")
       return
   }
   ```

2. **Frontend: Show Error State**
   ```typescript
   // BEFORE (wrong):
   const hebrewName = zman.hebrew_name || fallbackHebrewNames[zman.key] || englishName;

   // AFTER (correct):
   if (!zman.hebrew_name) {
       console.error(`Missing hebrew_name for zman: ${zman.key}`);
       // Show error indicator in UI
   }
   const hebrewName = zman.hebrew_name;
   ```

---

### Phase 5: Cleanup & Verification (Day 4)
**Priority:** P0

1. **Delete Hardcoded Data:**
   - `api/internal/algorithm/types.go`: Remove `StandardZmanim`, `ZmanDisplayNames`, `ZmanBilingualNames`
   - `web/lib/halachic-glossary.ts`: Remove or migrate to DB
   - `web/lib/codemirror/dsl-completions.ts`: Use API data

2. **Verification Script:**
   ```bash
   # Should return 0 matches
   grep -rE "Record<string,.*string>.*=.*\{" web/ --include="*.tsx" | \
     grep -v "errors:" | grep -v "formData:"

   # Should return 0 matches
   grep -r "fallback" web/ --include="*.tsx" | grep -i "name"

   # Should return 0 matches
   grep -r '= "ה' api/internal/ --include="*.go"
   grep -r '= "ע' api/internal/ --include="*.go"
   ```

---

## Success Criteria

### Must Pass Before Merge:

1. **No Hebrew strings in Go code** (except test files)
   ```bash
   grep -rP '[\u0590-\u05FF]' api/internal/ --include="*.go" | wc -l
   # Expected: 0
   ```

2. **No English name fallback maps in TSX**
   ```bash
   grep -r "const.*Names.*Record" web/ --include="*.tsx" | wc -l
   # Expected: 0
   ```

3. **No default/fallback patterns for zman names**
   ```bash
   grep -rE "fallback|default.*Name|\|\|.*Name" web/ --include="*.tsx" | wc -l
   # Expected: 0 (for zman-related)
   ```

4. **All zmanim API responses include hebrew_name**
   ```bash
   # Test API response
   curl localhost:8080/api/v1/zmanim?cityId=... | jq '.data.zmanim[].hebrew_name' | grep null
   # Expected: no output (no nulls)
   ```

5. **Database has all required metadata**
   ```sql
   SELECT COUNT(*) FROM master_zmanim_registry WHERE canonical_hebrew_name IS NULL;
   -- Expected: 0

   SELECT COUNT(*) FROM time_categories;
   -- Expected: 8+ rows

   SELECT COUNT(*) FROM tag_types WHERE color IS NOT NULL;
   -- Expected: 5+ rows
   ```

---

## Risk Mitigation

1. **Rollback Plan:** Keep hardcoded maps in separate file but don't import
2. **Feature Flag:** `REQUIRE_DB_METADATA=true` environment variable
3. **Monitoring:** Alert on any "missing metadata" log entries
4. **Testing:** E2E tests must verify all zmanim display correctly

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 | 4 hours | Schema + seed data |
| Phase 2 | 6 hours | Backend API updates |
| Phase 3 | 6 hours | Frontend hook migration |
| Phase 4 | 4 hours | Zero-fallback enforcement |
| Phase 5 | 4 hours | Cleanup + verification |
| **Total** | **24 hours** | Complete remediation |

---

## Appendix: Files to Modify

### Backend (Go)
- [ ] `api/internal/handlers/zmanim.go` - Remove Hebrew fallbacks
- [ ] `api/internal/handlers/master_registry.go` - Remove hardcoded categories
- [ ] `api/internal/handlers/publisher_algorithm.go` - Load templates from DB
- [ ] `api/internal/handlers/categories.go` - New file for category endpoints
- [ ] `api/internal/algorithm/types.go` - Remove all hardcoded maps
- [ ] `api/internal/algorithm/parser.go` - Get explanations from DB
- [ ] `api/internal/db/queries/categories.sql` - Add queries

### Frontend (TypeScript/React)
- [ ] `web/app/zmanim/[cityId]/[publisherId]/page.tsx` - Remove all fallback maps
- [ ] `web/components/publisher/RequestZmanModal.tsx` - Use hooks
- [ ] `web/components/publisher/ZmanTagEditor.tsx` - Use hooks
- [ ] `web/app/admin/tag-requests/page.tsx` - Use hooks
- [ ] `web/lib/hooks/useDisplayGroups.ts` - New hook
- [ ] `web/lib/hooks/useDslPrimitives.ts` - New hook
- [ ] `web/lib/codemirror/dsl-completions.ts` - Use API data
- [ ] `web/lib/dsl-context-helper.ts` - Use API data
- [ ] `web/lib/halachic-glossary.ts` - Migrate or remove

### Database
- [ ] `db/migrations/00000000000004_hardcoded_remediation.sql` - New migration
- [ ] Seed data script

---

_Last Updated: 2025-12-03_
_Audit performed by: Claude Code_
