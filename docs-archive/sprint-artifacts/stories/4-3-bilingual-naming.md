# Story 4.3: Bilingual Naming System

**Epic:** Epic 4 - Intuitive Zmanim Algorithm Editor with AI-Powered DSL
**Status:** dev-complete
**Priority:** P1
**Story Points:** 5
**Dependencies:** Story 4.2 (DSL Parser)

---

## Story

As a **publisher**,
I want **mandatory Hebrew and English names for each zman I configure**,
So that **my algorithm serves both Hebrew-speaking and English-speaking communities with authentic terminology**.

---

## Acceptance Criteria

### AC-4.3.1: Database Schema Update
- [ ] `zman_definitions` table includes `name_hebrew` (required, RTL text)
- [ ] `zman_definitions` table includes `name_english` (required)
- [ ] `zman_definitions` table includes `transliteration` (optional, for non-Hebrew speakers)
- [ ] Migration runs successfully without data loss

### AC-4.3.2: API Support
- [ ] `POST /api/publisher/zmanim` requires both `name_hebrew` and `name_english`
- [ ] `PUT /api/publisher/zmanim/{id}` allows updating names
- [ ] `GET /api/zmanim` returns all name fields
- [ ] API validates Hebrew contains actual Hebrew characters (א-ת range)
- [ ] API returns validation error if Hebrew name missing Hebrew characters

### AC-4.3.3: Frontend Display
- [ ] Zman names display in user's preferred language (from locale)
- [ ] Hebrew names render with proper RTL alignment
- [ ] Transliteration shown as tooltip/subtitle when available
- [ ] Font supports Hebrew characters (Noto Sans Hebrew or similar)

### AC-4.3.4: Editor Integration
- [ ] Formula editor shows bilingual name fields side-by-side
- [ ] Hebrew input field has RTL direction
- [ ] Character counter shows Hebrew character validation status
- [ ] Common zman name suggestions available (autocomplete)

### AC-4.3.5: Seed Data
- [ ] Standard zmanim seeded with Hebrew + English names
- [ ] At least 20 common zmanim pre-populated
- [ ] Names sourced from authoritative halachic sources

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Unit tests pass for API validation (Hebrew character detection)
- [ ] Integration tests pass for CRUD operations
- [ ] Component tests pass for bilingual display
- [ ] E2E tests pass for editor bilingual flow
- [ ] Hebrew rendering verified manually on all supported browsers
- [ ] Code review workflow executed (`/bmad:bmm:workflows:code-review`)

---

## Tasks / Subtasks

- [ ] Task 1: Database Schema Update (AC: 4.3.1)
  - [ ] 1.1 Create migration for `zman_definitions` table schema
  - [ ] 1.2 Add `name_hebrew` column (TEXT NOT NULL)
  - [ ] 1.3 Add `name_english` column (TEXT NOT NULL)
  - [ ] 1.4 Add `transliteration` column (TEXT NULL)
  - [ ] 1.5 Add CHECK constraint for Hebrew character validation
  - [ ] 1.6 Run migration, verify no data loss

- [ ] Task 2: API Updates (AC: 4.3.2)
  - [ ] 2.1 Update zman request/response DTOs
  - [ ] 2.2 Add Hebrew character validation function
  - [ ] 2.3 Update POST handler with validation
  - [ ] 2.4 Update PUT handler with validation
  - [ ] 2.5 Update GET handler to return all name fields
  - [ ] 2.6 Write API unit tests

- [ ] Task 3: Frontend - Display Components (AC: 4.3.3)
  - [ ] 3.1 Create `ZmanName` component with locale-aware rendering
  - [ ] 3.2 Add RTL support for Hebrew text
  - [ ] 3.3 Add Hebrew web font (Noto Sans Hebrew)
  - [ ] 3.4 Add transliteration tooltip
  - [ ] 3.5 Write component tests

- [ ] Task 4: Frontend - Editor Integration (AC: 4.3.4)
  - [ ] 4.1 Create bilingual name input component
  - [ ] 4.2 Add RTL input direction for Hebrew field
  - [ ] 4.3 Add Hebrew character validation indicator
  - [ ] 4.4 Add autocomplete for common zman names
  - [ ] 4.5 Write editor component tests

- [ ] Task 5: Seed Data (AC: 4.3.5)
  - [ ] 5.1 Research authoritative zman names (Hebrew + English)
  - [ ] 5.2 Create seed data file with 20+ common zmanim
  - [ ] 5.3 Include transliterations
  - [ ] 5.4 Add seed script to migrations

- [ ] Task 6: Testing
  - [ ] 6.1 Write API unit tests (Hebrew validation)
  - [ ] 6.2 Write integration tests (CRUD)
  - [ ] 6.3 Write component tests (bilingual display)
  - [ ] 6.4 Write E2E tests (editor flow)
  - [ ] 6.5 Manual Hebrew rendering verification

---

## Dev Notes

### Hebrew Character Validation

```go
// api/internal/validation/hebrew.go
func ContainsHebrew(s string) bool {
    for _, r := range s {
        if r >= 0x0590 && r <= 0x05FF { // Hebrew Unicode block
            return true
        }
    }
    return false
}

func ValidateHebrewName(name string) error {
    if !ContainsHebrew(name) {
        return errors.New("Hebrew name must contain Hebrew characters (א-ת)")
    }
    return nil
}
```

### Database Schema

```sql
-- Add to existing zman_definitions or create new table
ALTER TABLE zman_definitions
ADD COLUMN name_hebrew TEXT NOT NULL DEFAULT '',
ADD COLUMN name_english TEXT NOT NULL DEFAULT '',
ADD COLUMN transliteration TEXT;

-- Constraint to ensure Hebrew characters present
ALTER TABLE zman_definitions
ADD CONSTRAINT chk_hebrew_name
CHECK (name_hebrew ~ '[א-ת]');
```

### Common Zmanim Seed Data

| name_english | name_hebrew | transliteration |
|--------------|-------------|-----------------|
| Dawn | עלות השחר | Alos HaShachar |
| Sunrise | נץ החמה | Netz HaChama |
| Latest Shema (GRA) | סוף זמן שמע גר"א | Sof Zman Shma GRA |
| Latest Shema (MGA) | סוף זמן שמע מג"א | Sof Zman Shma MGA |
| Latest Shacharit | סוף זמן תפילה | Sof Zman Tefillah |
| Midday | חצות היום | Chatzos HaYom |
| Earliest Mincha | מנחה גדולה | Mincha Gedolah |
| Small Mincha | מנחה קטנה | Mincha Ketanah |
| Plag HaMincha | פלג המנחה | Plag HaMincha |
| Sunset | שקיעת החמה | Shkias HaChama |
| Nightfall | צאת הכוכבים | Tzeis HaKochavim |
| Midnight | חצות הלילה | Chatzos HaLailah |

### Frontend Component

```tsx
// web/components/shared/ZmanName.tsx
interface ZmanNameProps {
  nameHebrew: string;
  nameEnglish: string;
  transliteration?: string;
  locale?: 'he' | 'en';
}

export function ZmanName({ nameHebrew, nameEnglish, transliteration, locale = 'en' }: ZmanNameProps) {
  const displayName = locale === 'he' ? nameHebrew : nameEnglish;
  const isRTL = locale === 'he';

  return (
    <span
      dir={isRTL ? 'rtl' : 'ltr'}
      className={isRTL ? 'font-hebrew' : ''}
      title={transliteration}
    >
      {displayName}
    </span>
  );
}
```

### Tailwind Config for Hebrew Font

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        hebrew: ['Noto Sans Hebrew', 'Arial Hebrew', 'sans-serif'],
      },
    },
  },
}
```

### References

- [Source: docs/sprint-artifacts/epic-4-comprehensive-plan.md#Story 4.3]
- [Source: docs/sprint-artifacts/epic-4-ui-wireframes.md#Bilingual Support]
- Unicode Hebrew Block: U+0590 to U+05FF

---

## Testing Requirements

### Unit Tests (Go)
- [ ] `TestContainsHebrew` - validates Hebrew detection
- [ ] `TestValidateHebrewName` - validates error handling
- [ ] `TestZmanAPIValidation` - validates API rejects invalid Hebrew

### Integration Tests (API)
- [ ] Create zman with valid Hebrew/English names
- [ ] Create zman with missing Hebrew name (expect 400)
- [ ] Create zman with English-only in Hebrew field (expect 400)
- [ ] Update zman names
- [ ] Get zman returns all name fields

### Component Tests (React)
- [ ] ZmanName renders Hebrew with RTL direction
- [ ] ZmanName renders English with LTR direction
- [ ] ZmanName shows transliteration tooltip
- [ ] BilingualInput validates Hebrew field

### E2E Tests (Playwright)
- [ ] Publisher can add zman with Hebrew and English names
- [ ] Hebrew text renders correctly (visual regression)
- [ ] Validation errors show for invalid Hebrew input
- [ ] User can view zmanim in their preferred language

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/4-3-bilingual-naming.context.xml
- docs/sprint-artifacts/epic-4-comprehensive-plan.md
- docs/sprint-artifacts/epic-4-ui-wireframes.md

### Agent Model Used
(To be filled by dev agent)

### Completion Notes
(To be filled upon completion)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-28 | Story created from Epic 4 comprehensive plan | Party Mode Team |
| 2025-11-28 | Story context generated | Winston (Architect) |
