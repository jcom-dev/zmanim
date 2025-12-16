# Story 5.18: Publisher Zman Field Ownership - Description, Transliteration, Formula Diff/Revert

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** Drafted
**Priority:** P1
**Story Points:** 8
**Dependencies:** 5.0 (Database Schema)

---

## Story

As a **publisher**,
I want **my own editable copy of description, transliteration, and formula when I add a zman from the registry, with clear indication when my values differ from the source and easy one-click revert**,
So that **I can customize these fields for my community while maintaining visibility into registry changes**.

---

## Background

The current implementation already supports "publisher owns their copy" for **names** (hebrew_name, english_name). This pattern includes:
- Publisher's copy is stored in `publisher_zmanim` table
- Source/original values come from `master_zmanim_registry` via JOIN
- UI shows amber highlight when publisher's value differs from source
- Revert button restores source value with one click
- `BilingualInput` component handles the UX pattern

This story extends this pattern to:
1. **Description** - Publisher's halachic context or community-specific notes
2. **Transliteration** - Publisher's preferred phonetic spelling
3. **Formula** - Publisher's calculation method (already stored, but no diff/revert)

Additionally, **linked zmanim** (where `source_type = 'linked'`) should be completely non-editable - the edit button should not work.

---

## Acceptance Criteria

### AC-5.18.1: Database Schema Extension
- [ ] `publisher_zmanim` table has `transliteration` column (TEXT, nullable)
- [ ] `publisher_zmanim` table has `description` column (TEXT, nullable) - distinct from `publisher_comment`
- [ ] Migration is idempotent (can run multiple times safely)
- [ ] `CreatePublisherZmanFromRegistry` copies these fields from registry as initial values
- [ ] No need to store source values - compare via JOIN at display time (existing pattern)

### AC-5.18.2: Transliteration Field UI
- [ ] Edit page shows Transliteration input field below names (extend existing BilingualInput)
- [ ] Transliteration shows "Different from Registry" amber indicator when differs
- [ ] Revert button appears when different, copies current registry value
- [ ] Tooltip shows registry value on hover

### AC-5.18.3: Description Field UI
- [ ] Edit page shows Description field (separate from Publisher Comment)
- [ ] Description labeled as "Zman Description" with helper text: "Explain what this time represents"
- [ ] Description shows "Different from Registry" indicator when differs
- [ ] Revert button copies registry description
- [ ] Publisher Comment remains separate (for personal notes/minhag - always custom)

### AC-5.18.4: Formula Diff/Revert
- [ ] Formula input shows "Different from Registry" indicator when differs from registry default_formula_dsl
- [ ] Tooltip shows registry formula on hover
- [ ] "Sync with Registry" button appears when formula differs
- [ ] Clicking sync copies registry formula (creates new version in history)

### AC-5.18.5: Linked Zmanim Non-Editable
- [ ] ZmanCard edit button is disabled for linked zmanim (`source_type = 'linked'`)
- [ ] Disabled edit button shows tooltip: "Linked zmanim cannot be edited. Unlink to make changes."
- [ ] If user reaches edit page for linked zman, show banner: "This zman is linked to {publisher_name}. Changes sync automatically."
- [ ] All form fields disabled for linked zmanim except is_enabled, is_visible, is_published toggles

---

## Tasks / Subtasks

- [ ] Task 1: Database Migration (AC: 5.18.1)
  - [ ] 1.1 Create migration `00000000000029_publisher_zman_field_ownership.sql`
  - [ ] 1.2 Add `transliteration` TEXT column to `publisher_zmanim`
  - [ ] 1.3 Add `description` TEXT column to `publisher_zmanim`
  - [ ] 1.4 Run migration via `./scripts/migrate.sh`
  - [ ] 1.5 Regenerate SQLc: `cd api && sqlc generate`

- [ ] Task 2: SQLc Query Updates (AC: 5.18.1)
  - [ ] 2.1 Update `GetPublisherZmanim` to SELECT pz.transliteration, pz.description and JOIN mr.transliteration, mr.description, mr.default_formula_dsl
  - [ ] 2.2 Update `GetPublisherZmanByKey` similarly
  - [ ] 2.3 Update `CreatePublisherZmanFromRegistry` to copy transliteration and description from registry
  - [ ] 2.4 Update `UpdatePublisherZman` to accept transliteration and description
  - [ ] 2.5 Regenerate SQLc and verify Go builds

- [ ] Task 3: Backend Handler Updates (AC: 5.18.1)
  - [ ] 3.1 Update response type to include transliteration, description, and source_* fields from registry JOIN
  - [ ] 3.2 Update `UpdateZmanRequest` type to accept transliteration and description
  - [ ] 3.3 Update `UpdatePublisherZman` handler to save new fields

- [ ] Task 4: Frontend Type Updates (AC: 5.18.2, 5.18.3, 5.18.4)
  - [ ] 4.1 Update `PublisherZman` type in `useZmanimList.ts` with transliteration, description
  - [ ] 4.2 Add source_transliteration, source_description, source_formula_dsl to type (from JOIN)
  - [ ] 4.3 Update `UpdateZmanPayload` type

- [ ] Task 5: BilingualInput Enhancement (AC: 5.18.2)
  - [ ] 5.1 Add transliteration field to BilingualInput with source comparison
  - [ ] 5.2 Add `sourceTransliteration` prop and sync-to-registry functionality
  - [ ] 5.3 Show amber highlight and sync button when different from registry

- [ ] Task 6: Description Field Component (AC: 5.18.3)
  - [ ] 6.1 Create description input section on edit page with source comparison
  - [ ] 6.2 Accept `sourceDescription` prop
  - [ ] 6.3 Show "Different from Registry" indicator and sync button
  - [ ] 6.4 Clearly label as "Zman Description" vs "Publisher Comment"

- [ ] Task 7: Formula Diff/Sync (AC: 5.18.4)
  - [ ] 7.1 Pass sourceFormulaDsl to edit page from zman data
  - [ ] 7.2 Show "Different from Registry" indicator near formula editor
  - [ ] 7.3 Add "Sync with Registry" button when formula differs
  - [ ] 7.4 Handle sync - copy registry formula and create new version

- [ ] Task 8: Linked Zmanim Restriction (AC: 5.18.5)
  - [ ] 8.1 Update ZmanCard to disable edit button for linked zmanim
  - [ ] 8.2 Add tooltip explaining why edit is disabled
  - [ ] 8.3 Update edit page to detect linked zman and show info banner
  - [ ] 8.4 Disable all form fields (except toggles) for linked zmanim

---

## Dev Notes

### Migration SQL

```sql
-- Migration: 00000000000029_publisher_zman_field_ownership.sql

-- Add transliteration column
ALTER TABLE publisher_zmanim
ADD COLUMN IF NOT EXISTS transliteration TEXT;

-- Add description column (distinct from publisher_comment)
ALTER TABLE publisher_zmanim
ADD COLUMN IF NOT EXISTS description TEXT;

-- Comment for clarity
COMMENT ON COLUMN publisher_zmanim.transliteration IS 'Publisher''s custom transliteration (can differ from registry)';
COMMENT ON COLUMN publisher_zmanim.description IS 'Publisher''s description of what this zman represents (can differ from registry)';
COMMENT ON COLUMN publisher_zmanim.publisher_comment IS 'Publisher''s personal notes, minhag, or halachic source';
```

### SQLc Query Pattern

```sql
-- Update GetPublisherZmanim to include source fields
SELECT
    pz.id, pz.publisher_id, pz.zman_key,
    pz.hebrew_name, pz.english_name, pz.transliteration, pz.description,
    pz.formula_dsl, pz.ai_explanation, pz.publisher_comment,
    -- Source fields from registry
    mr.canonical_hebrew_name AS source_hebrew_name,
    mr.canonical_english_name AS source_english_name,
    mr.transliteration AS source_transliteration,
    mr.description AS source_description,
    mr.default_formula_dsl AS source_formula_dsl,
    -- ... rest of query
FROM publisher_zmanim pz
LEFT JOIN master_zmanim_registry mr ON pz.master_zman_id = mr.id
-- ...
```

### Frontend Component Patterns

**Existing Pattern (BilingualInput):**
```tsx
// Source comparison + revert pattern already implemented for names
<BilingualInput
  nameHebrew={hebrewName}
  nameEnglish={englishName}
  sourceHebrewName={zman?.source_hebrew_name}
  sourceEnglishName={zman?.source_english_name}
  sourceName={getSourceName(zman)}
/>
```

**New Components to Create:**
1. `DescriptionInput` - Similar pattern for description field
2. `FormulaSourceIndicator` - Shows diff indicator in formula editor

**Linked Zman UI Pattern:**
```tsx
// In ZmanCard
const isLinked = zman.source_type === 'linked';

<Button
  variant="ghost"
  size="icon"
  onClick={handleEdit}
  disabled={isLinked}
  title={isLinked ? "Linked zmanim cannot be edited. Unlink to make changes." : "Edit formula"}
>
  <Pencil className="h-4 w-4" />
</Button>
```

### Key Architecture Decisions

1. **Separate description from publisher_comment:**
   - `description` = What the zman IS (can be copied from registry, shown to users)
   - `publisher_comment` = Personal notes, minhag, source (always custom, internal)

2. **Simple comparison at display time (no source tracking):**
   - Compare publisher's current value to current registry value via SQL JOIN
   - If different → show amber "Different from Registry" indicator
   - No need to track "who changed" or "when changed"
   - This matches existing pattern for names in BilingualInput

3. **Linked zmanim immutability:**
   - Formula comes from source publisher (existing behavior)
   - Extend to prevent ALL edits on linked zmanim (edit button disabled)
   - Toggles (enabled, visible, published) remain editable

### Coding Standards (MUST FOLLOW)

**CRITICAL:** All implementation MUST strictly follow [docs/coding-standards.md](../../coding-standards.md). Key requirements:

**Backend:**
- Follow the 6-step handler pattern (resolve context → extract params → parse body → validate → execute → respond)
- Use `PublisherResolver.MustResolve()` for publisher endpoints
- Use SQLc for ALL database queries - never raw SQL in handlers
- Use `slog` for structured logging with context fields
- Use response helpers (`RespondJSON`, `RespondBadRequest`, etc.)
- Never expose internal errors to users

**Frontend:**
- Use `useApi()` hook for ALL API requests - never raw `fetch()`
- Use Tailwind design tokens (`text-foreground`, `bg-primary`, etc.) - never hardcode colors
- Check `isLoaded` before accessing Clerk user data
- Use React Query hooks for data fetching with caching

**Database:**
- All queries in `api/internal/db/queries/*.sql`
- Regenerate SQLc after schema changes: `cd api && sqlc generate`
- Migrations must be idempotent (use `IF NOT EXISTS`)

### References

- [docs/coding-standards.md](../../coding-standards.md) - **AUTHORITATIVE SOURCE** for all patterns
- [web/components/shared/BilingualInput.tsx](../../../../web/components/shared/BilingualInput.tsx) - Existing source comparison pattern
- [web/components/publisher/ZmanCard.tsx](../../../../web/components/publisher/ZmanCard.tsx) - hasNameModifications pattern
- [api/internal/db/queries/zmanim.sql](../../../../api/internal/db/queries/zmanim.sql) - Current query structure
- [api/internal/db/queries/master_registry.sql](../../../../api/internal/db/queries/master_registry.sql) - Registry field structure

---

## Testing Requirements

### Unit Tests
- [ ] BilingualInput shows transliteration with source comparison
- [ ] Description field shows "Different from Registry" indicator correctly
- [ ] Formula diff indicator detects difference from registry

### Integration Tests
- [ ] API returns source_* fields correctly from registry JOIN
- [ ] Update endpoint saves transliteration and description
- [ ] Linked zmanim can only update toggles (enabled, visible, published)

### E2E Tests
- [ ] Edit page shows "Different from Registry" for modified fields
- [ ] Sync buttons copy registry values correctly
- [ ] Linked zmanim edit button is disabled
- [ ] Edit page for linked zman shows info banner and disabled fields

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/5-18-publisher-zman-field-ownership-context.md (to be generated)

### Agent Model Used
(To be filled by dev agent)

### Completion Notes
(To be filled upon completion)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-02 | Story created per user request | Mary (Business Analyst) |
