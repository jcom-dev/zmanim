# Story 5.18 Context: Publisher Zman Field Ownership

**Generated:** 2025-12-02
**Story:** [5-18-publisher-zman-field-ownership.md](5-18-publisher-zman-field-ownership.md)
**Purpose:** Technical context for implementing publisher-owned copies of description, transliteration, and formula with diff/revert functionality

---

## Overview

This story extends the existing "publisher owns their copy" pattern (already implemented for names) to include:
1. **Description** - Publisher's explanation of what the zman represents
2. **Transliteration** - Publisher's preferred phonetic spelling
3. **Formula** - Publisher's calculation method (already stored, needs diff/revert UI)

Additionally, **linked zmanim** (`source_type = 'linked'`) must be completely non-editable.

---

## Current Architecture

### Database Schema (publisher_zmanim)

**File:** `db/migrations/00000000000000_initial_schema.sql` (lines 399-449)

Current columns in `publisher_zmanim`:
```sql
CREATE TABLE publisher_zmanim (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    zman_key TEXT NOT NULL,
    hebrew_name TEXT NOT NULL,
    english_name TEXT NOT NULL,
    formula_dsl TEXT NOT NULL,
    ai_explanation TEXT,
    publisher_comment TEXT,          -- Personal notes (always custom)
    is_enabled BOOLEAN DEFAULT true NOT NULL,
    is_visible BOOLEAN DEFAULT true NOT NULL,
    is_published BOOLEAN DEFAULT false NOT NULL,
    is_beta BOOLEAN DEFAULT false NOT NULL,
    is_custom BOOLEAN DEFAULT false NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('essential', 'optional', 'custom')),
    dependencies TEXT[] DEFAULT '{}' NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    master_zman_id UUID REFERENCES master_zmanim_registry(id),
    linked_publisher_zman_id UUID,   -- For linked zmanim
    source_type TEXT,                -- 'registry' | 'copied' | 'linked'
    current_version INT DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(publisher_id, zman_key)
);
```

**Columns to ADD:**
- `transliteration TEXT` - Publisher's phonetic spelling
- `description TEXT` - Publisher's zman description (distinct from `publisher_comment`)

### Master Registry Schema

**File:** `api/internal/db/queries/master_registry.sql`

The master registry already has:
- `canonical_hebrew_name`
- `canonical_english_name`
- `transliteration`
- `description`
- `default_formula_dsl`

These are the "source" values for comparison.

---

## Backend Implementation

### Current Handler Types

**File:** `api/internal/handlers/publisher_zmanim.go`

```go
// PublisherZman response type (lines 19-51)
type PublisherZman struct {
    ID               string    `json:"id"`
    PublisherID      string    `json:"publisher_id"`
    ZmanKey          string    `json:"zman_key"`
    HebrewName       string    `json:"hebrew_name"`
    EnglishName      string    `json:"english_name"`
    FormulaDSL       string    `json:"formula_dsl"`
    AIExplanation    *string   `json:"ai_explanation"`
    PublisherComment *string   `json:"publisher_comment"`
    // ... other fields ...
    // Source/original names from registry or linked publisher
    SourceHebrewName  *string `json:"source_hebrew_name,omitempty"`
    SourceEnglishName *string `json:"source_english_name,omitempty"`
    // ... linked fields ...
}

// UpdateZmanRequest (lines 81-94) - needs new fields
type UpdateZmanRequest struct {
    HebrewName       *string `json:"hebrew_name"`
    EnglishName      *string `json:"english_name"`
    FormulaDSL       *string `json:"formula_dsl"`
    // TODO: Add Transliteration and Description
    AIExplanation    *string `json:"ai_explanation"`
    PublisherComment *string `json:"publisher_comment"`
    IsEnabled        *bool   `json:"is_enabled"`
    IsVisible        *bool   `json:"is_visible"`
    IsPublished      *bool   `json:"is_published"`
    IsBeta           *bool   `json:"is_beta"`
    Category         *string `json:"category"`
    SortOrder        *int    `json:"sort_order"`
}
```

### Current Query (GetPublisherZmanim)

**File:** `api/internal/handlers/publisher_zmanim.go` (lines 133-174)

```sql
SELECT
    pz.id, pz.publisher_id, pz.zman_key, pz.hebrew_name, pz.english_name,
    COALESCE(linked_pz.formula_dsl, pz.formula_dsl) AS formula_dsl,
    pz.ai_explanation, pz.publisher_comment,
    -- ...other fields...
    -- Source names from registry or linked publisher
    COALESCE(mr.canonical_hebrew_name, linked_pz.hebrew_name) AS source_hebrew_name,
    COALESCE(mr.canonical_english_name, linked_pz.english_name) AS source_english_name,
    -- ...
FROM publisher_zmanim pz
LEFT JOIN publisher_zmanim linked_pz ON pz.linked_publisher_zman_id = linked_pz.id
LEFT JOIN publishers linked_pub ON linked_pz.publisher_id = linked_pub.id
LEFT JOIN master_zmanim_registry mr ON pz.master_zman_id = mr.id
```

**Changes needed:**
- Add `pz.transliteration, pz.description` to SELECT
- Add `mr.transliteration AS source_transliteration` to SELECT
- Add `mr.description AS source_description` to SELECT
- Add `mr.default_formula_dsl AS source_formula_dsl` to SELECT

---

## Frontend Implementation

### Current Types

**File:** `web/lib/hooks/useZmanimList.ts` (lines 39-69)

```typescript
export interface PublisherZman {
  id: string;
  publisher_id: string;
  zman_key: string;
  hebrew_name: string;
  english_name: string;
  formula_dsl: string;
  ai_explanation: string | null;
  publisher_comment: string | null;
  // ... other fields ...
  source_hebrew_name?: string | null;
  source_english_name?: string | null;
  // TODO: Add these fields
  // transliteration?: string | null;
  // description?: string | null;
  // source_transliteration?: string | null;
  // source_description?: string | null;
  // source_formula_dsl?: string | null;
}

export interface UpdateZmanRequest {
  hebrew_name?: string;
  english_name?: string;
  formula_dsl?: string;
  // TODO: Add transliteration and description
  ai_explanation?: string;
  publisher_comment?: string;
  // ... other fields ...
}
```

### BilingualInput Component (Pattern Reference)

**File:** `web/components/shared/BilingualInput.tsx`

This component shows the existing pattern for source comparison + revert:

```typescript
interface BilingualInputProps {
  nameHebrew: string;
  nameEnglish: string;
  transliteration?: string;
  onHebrewChange: (value: string) => void;
  onEnglishChange: (value: string) => void;
  onTransliterationChange?: (value: string) => void;
  // Source names for revert functionality
  sourceHebrewName?: string | null;
  sourceEnglishName?: string | null;
  sourceName?: string; // e.g., "Registry" or publisher name
  // ...
}
```

**Key patterns to replicate:**
1. Compare value to source: `const hebrewChanged = sourceHebrewName != null && nameHebrew !== sourceHebrewName;`
2. Show "Modified" badge with amber styling when different
3. Show tooltip with original value on hover
4. Provide revert button that copies source value
5. Amber border/highlight on input when modified

### ZmanCard Component (Pattern Reference)

**File:** `web/components/publisher/ZmanCard.tsx` (lines 159-192)

```typescript
// Check if names have been modified from source
function hasNameModifications(zman: PublisherZman): {
  hebrewModified: boolean;
  englishModified: boolean;
  anyModified: boolean;
} {
  const hebrewModified = zman.source_hebrew_name != null && zman.hebrew_name !== zman.source_hebrew_name;
  const englishModified = zman.source_english_name != null && zman.english_name !== zman.source_english_name;
  return {
    hebrewModified,
    englishModified,
    anyModified: hebrewModified || englishModified,
  };
}

// Get the source name for display
function getSourceName(zman: PublisherZman): string | null {
  if (zman.is_linked && zman.linked_source_publisher_name) {
    return zman.linked_source_publisher_name;
  }
  if (zman.source_type === 'registry' || zman.source_type === 'copied') {
    return 'Registry';
  }
  return null;
}
```

### Edit Page Structure

**File:** `web/app/publisher/algorithm/edit/[zman_key]/page.tsx`

The edit page uses:
- `BilingualInput` for names (already has source comparison)
- `DSLEditor` for formula
- Collapsible sections for AI explanation and publisher comment
- Uses `useZmanDetails()` to load zman data
- Uses `useUpdateZman()` to save changes

**Key state variables to add:**
```typescript
const [transliteration, setTransliteration] = useState('');
const [description, setDescription] = useState('');
// Source values for comparison (from zman data)
const sourceTransliteration = zman?.source_transliteration;
const sourceDescription = zman?.source_description;
const sourceFormulaDsl = zman?.source_formula_dsl;
```

---

## Implementation Tasks Detail

### Task 1: Database Migration

**Create:** `db/migrations/00000000000029_publisher_zman_field_ownership.sql`

```sql
-- Add transliteration column
ALTER TABLE publisher_zmanim
ADD COLUMN IF NOT EXISTS transliteration TEXT;

-- Add description column (distinct from publisher_comment)
ALTER TABLE publisher_zmanim
ADD COLUMN IF NOT EXISTS description TEXT;

-- Comments for clarity
COMMENT ON COLUMN publisher_zmanim.transliteration IS 'Publisher custom transliteration (can differ from registry)';
COMMENT ON COLUMN publisher_zmanim.description IS 'Publisher description of what this zman represents (can differ from registry)';
COMMENT ON COLUMN publisher_zmanim.publisher_comment IS 'Publisher personal notes, minhag, or halachic source (always custom)';
```

### Task 2: SQLc Query Updates

**File:** `api/internal/db/queries/zmanim.sql`

Update GetPublisherZmanim and GetPublisherZmanByKey to:
1. SELECT pz.transliteration, pz.description
2. JOIN and SELECT mr.transliteration AS source_transliteration
3. JOIN and SELECT mr.description AS source_description
4. JOIN and SELECT mr.default_formula_dsl AS source_formula_dsl

Update CreatePublisherZmanFromRegistry to copy transliteration and description from registry.

Update UpdatePublisherZman to accept transliteration and description parameters.

### Task 3: Backend Handler Updates

**File:** `api/internal/handlers/publisher_zmanim.go`

1. Add to `PublisherZman` struct:
```go
Transliteration       *string `json:"transliteration,omitempty"`
Description           *string `json:"description,omitempty"`
SourceTransliteration *string `json:"source_transliteration,omitempty"`
SourceDescription     *string `json:"source_description,omitempty"`
SourceFormulaDsl      *string `json:"source_formula_dsl,omitempty"`
```

2. Add to `UpdateZmanRequest` struct:
```go
Transliteration *string `json:"transliteration"`
Description     *string `json:"description"`
```

3. Update handler to save new fields

### Task 4: Frontend Type Updates

**File:** `web/lib/hooks/useZmanimList.ts`

Add to `PublisherZman` interface:
```typescript
transliteration?: string | null;
description?: string | null;
source_transliteration?: string | null;
source_description?: string | null;
source_formula_dsl?: string | null;
```

Add to `UpdateZmanRequest` interface:
```typescript
transliteration?: string;
description?: string;
```

### Task 5: BilingualInput Enhancement

**File:** `web/components/shared/BilingualInput.tsx`

The component already supports transliteration but needs source comparison:

1. Add props:
```typescript
sourceTransliteration?: string | null;
```

2. Add comparison logic:
```typescript
const transliterationChanged = sourceTransliteration != null && transliteration !== sourceTransliteration;
```

3. Add revert handler:
```typescript
const handleRevertTransliteration = useCallback(() => {
  if (sourceTransliteration != null) {
    onTransliterationChange?.(sourceTransliteration);
  }
}, [sourceTransliteration, onTransliterationChange]);
```

4. Add amber styling and revert button to transliteration input

### Task 6: Description Field

**File:** `web/app/publisher/algorithm/edit/[zman_key]/page.tsx`

Create a new description section similar to the existing publisher comment section:

```tsx
{/* Description Field - with source comparison */}
<div className="space-y-2">
  <Label className="flex items-center justify-between">
    <span className="flex items-center gap-2">
      Zman Description
      {descriptionChanged && (
        <span className="inline-flex items-center gap-1 text-amber-600">
          <Edit2 className="h-3 w-3" />
          <span className="text-xs">Modified</span>
        </span>
      )}
    </span>
    {descriptionChanged && (
      <Button variant="ghost" size="sm" onClick={handleRevertDescription}>
        <RotateCcw className="h-3 w-3 mr-1" />
        Sync with Registry
      </Button>
    )}
  </Label>
  <Textarea
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    placeholder="Explain what this time represents..."
    className={cn(descriptionChanged && 'border-amber-500/50')}
  />
  <p className="text-xs text-muted-foreground">
    A description of what this zman represents (shown to users)
  </p>
</div>
```

### Task 7: Formula Diff/Sync

**File:** `web/app/publisher/algorithm/edit/[zman_key]/page.tsx`

Add indicator near the formula editor:

```tsx
{/* Formula Source Indicator */}
{sourceFormulaDsl && formula !== sourceFormulaDsl && (
  <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-800">
    <AlertCircle className="h-4 w-4 text-amber-600" />
    <span className="text-sm text-amber-700 dark:text-amber-300">
      Formula differs from registry
    </span>
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={handleSyncFormula}>
            <RotateCcw className="h-3 w-3 mr-1" />
            Sync with Registry
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-mono text-xs">{sourceFormulaDsl}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
)}
```

### Task 8: Linked Zmanim Restriction

**File:** `web/components/publisher/ZmanCard.tsx`

Update edit button:
```tsx
const isLinked = zman.source_type === 'linked';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleEdit}
        disabled={isLinked}
        className={cn("h-8 w-8", isLinked && "opacity-50 cursor-not-allowed")}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    {isLinked && (
      <TooltipContent>
        Linked zmanim cannot be edited. Unlink to make changes.
      </TooltipContent>
    )}
  </Tooltip>
</TooltipProvider>
```

**File:** `web/app/publisher/algorithm/edit/[zman_key]/page.tsx`

Add check for linked zman:
```tsx
// Check if zman is linked
const isLinked = zman?.source_type === 'linked';

{/* Show banner for linked zmanim */}
{isLinked && (
  <Alert variant="default" className="mb-4">
    <Link2 className="h-4 w-4" />
    <AlertTitle>Linked Zman</AlertTitle>
    <AlertDescription>
      This zman is linked to {zman?.linked_source_publisher_name}.
      Changes sync automatically. Only toggles can be modified.
    </AlertDescription>
  </Alert>
)}

{/* Disable all inputs for linked zmanim except toggles */}
<BilingualInput
  // ...
  disabled={isLinked}
/>
```

---

## Design Tokens / Styling

**Modified state (amber theme):**
- Border: `border-amber-500/50`
- Ring: `ring-1 ring-amber-500/20`
- Text: `text-amber-600 dark:text-amber-400`
- Background: `bg-amber-50 dark:bg-amber-950/30`
- Hover: `hover:bg-amber-100 dark:hover:bg-amber-900/50`

**Icon:** `Edit2` for "Modified" indicator, `RotateCcw` for revert/sync

---

## Testing Checklist

### Backend Tests
- [ ] Migration runs successfully, is idempotent
- [ ] GetPublisherZmanim returns source_* fields
- [ ] GetPublisherZmanByKey returns source_* fields
- [ ] CreatePublisherZmanFromRegistry copies transliteration/description
- [ ] UpdatePublisherZman saves transliteration/description

### Frontend Tests
- [ ] BilingualInput shows transliteration with source comparison
- [ ] Description field shows "Modified" indicator when different
- [ ] Formula shows "Different from Registry" indicator
- [ ] Sync buttons copy registry values
- [ ] Linked zman edit button is disabled
- [ ] Linked zman edit page shows banner and disables fields

### E2E Tests
- [ ] Publisher adds zman from registry - fields are copied
- [ ] Publisher edits transliteration - shows modified indicator
- [ ] Publisher edits description - shows modified indicator
- [ ] Publisher edits formula - shows modified indicator
- [ ] Click sync button - value is reverted to registry
- [ ] Navigate to linked zman - edit button disabled
- [ ] Try to edit linked zman - fields are disabled

---

## Files to Modify

### Backend
1. `db/migrations/00000000000029_publisher_zman_field_ownership.sql` (NEW)
2. `api/internal/db/queries/zmanim.sql` (MODIFY)
3. `api/internal/handlers/publisher_zmanim.go` (MODIFY)
4. `api/internal/db/sqlcgen/` (REGENERATE)

### Frontend
5. `web/lib/hooks/useZmanimList.ts` (MODIFY types)
6. `web/components/shared/BilingualInput.tsx` (MODIFY - add transliteration source)
7. `web/app/publisher/algorithm/edit/[zman_key]/page.tsx` (MODIFY - add description, formula indicator)
8. `web/components/publisher/ZmanCard.tsx` (MODIFY - disable edit for linked)

---

## Coding Standards Reference

- Backend: Follow 6-step handler pattern (`docs/coding-standards.md`)
- Frontend: Use design tokens, never hardcode colors
- SQLc: Regenerate after schema changes
- Tests: Use shared fixtures, parallel-safe

---

## Estimated Complexity

- Migration: Low (2 columns)
- SQLc Updates: Medium (multiple queries)
- Backend Handlers: Low (add fields)
- BilingualInput Enhancement: Low (follow existing pattern)
- Description Field: Low (copy existing pattern)
- Formula Indicator: Medium (new component)
- Linked Zmanim: Low (add disabled state)

**Total Story Points: 8** (as estimated)
