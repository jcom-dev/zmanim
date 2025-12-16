# Story 5.5: Publisher Zman Alias UI

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** todo
**Priority:** P2
**Story Points:** 5
**Dependencies:** Story 5.4 (Publisher Zman Alias API)
**FRs:** FR106 (Publisher zman alias UI)

---

## Standards Reference

See `docs/coding-standards.md` sections:
- "Frontend Standards > Component Structure" (hook ordering, state management)
- "Frontend Standards > Unified API Client" (use `useApi()` hook)
- "Frontend Standards > Styling with Tailwind" (use design tokens)
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Reusable Component Note:**
- Consider creating a reusable `HebrewEnglishNameEditor` component for the Hebrew/English/Transliteration triplet
- This pattern is reused in: ZmanAliasEditor (this story), ZmanRequestForm (Story 5.7)

---

## Story

As a **publisher**,
I want **to rename zmanim in the Advanced DSL editor**,
So that **I can customize display names while seeing the original canonical name**.

---

## Acceptance Criteria

### AC-5.5.1: Custom Display Name Section
- [ ] "Custom Display Name" section visible in Advanced DSL editor mode ONLY
- [ ] Section not visible in Guided Builder mode
- [ ] Section appears in zman edit page below the formula editor

### AC-5.5.2: Canonical Name Display
- [ ] Shows "Original: [canonical name]" label
- [ ] Canonical name always visible even when custom name is set
- [ ] Styled subtly (gray, smaller text) to not compete with custom name

### AC-5.5.3: Alias Form
- [ ] Form fields: Hebrew Name, English Name, Transliteration (optional)
- [ ] Hebrew name field supports RTL input
- [ ] Save button saves alias via API
- [ ] Cancel button discards changes

### AC-5.5.4: Existing Alias Display
- [ ] If alias exists, form is pre-populated with current values
- [ ] "Remove Custom Name" button appears when alias exists
- [ ] Clicking remove deletes alias and shows confirmation

### AC-5.5.5: Zman Card Display
- [ ] In algorithm list, zman cards show custom name prominently (if alias exists)
- [ ] Canonical name shown in parentheses or as subtitle
- [ ] Example: "עמוד השחר (עלות השחר)"

### AC-5.5.6: Visual Feedback
- [ ] Loading state while saving
- [ ] Success toast after save
- [ ] Error handling with user-friendly messages

---

## Technical Context

### Component Structure

**File: `web/components/publisher/ZmanAliasEditor.tsx`**
```typescript
interface ZmanAliasEditorProps {
  zmanKey: string;
  canonicalHebrewName: string;
  canonicalEnglishName: string;
  existingAlias?: {
    customHebrewName: string;
    customEnglishName: string;
    customTransliteration?: string;
  };
  onSave: (alias: AliasData) => Promise<void>;
  onRemove: () => Promise<void>;
}

export function ZmanAliasEditor({
  zmanKey,
  canonicalHebrewName,
  canonicalEnglishName,
  existingAlias,
  onSave,
  onRemove,
}: ZmanAliasEditorProps) {
  const [hebrewName, setHebrewName] = useState(existingAlias?.customHebrewName || '');
  const [englishName, setEnglishName] = useState(existingAlias?.customEnglishName || '');
  const [transliteration, setTransliteration] = useState(existingAlias?.customTransliteration || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ hebrewName, englishName, transliteration });
      toast.success('Custom name saved');
    } catch (error) {
      toast.error('Failed to save custom name');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-muted/30">
      <h4 className="font-medium mb-2">Custom Display Name</h4>

      {/* Canonical name reference */}
      <p className="text-sm text-muted-foreground mb-4">
        Original: {canonicalEnglishName} / {canonicalHebrewName}
      </p>

      <div className="space-y-4">
        {/* Hebrew Name (RTL) */}
        <div>
          <Label htmlFor="hebrewName">Hebrew Name</Label>
          <Input
            id="hebrewName"
            dir="rtl"
            value={hebrewName}
            onChange={(e) => setHebrewName(e.target.value)}
            placeholder={canonicalHebrewName}
          />
        </div>

        {/* English Name */}
        <div>
          <Label htmlFor="englishName">English Name</Label>
          <Input
            id="englishName"
            value={englishName}
            onChange={(e) => setEnglishName(e.target.value)}
            placeholder={canonicalEnglishName}
          />
        </div>

        {/* Transliteration (optional) */}
        <div>
          <Label htmlFor="transliteration">Transliteration (optional)</Label>
          <Input
            id="transliteration"
            value={transliteration}
            onChange={(e) => setTransliteration(e.target.value)}
            placeholder="e.g., Amud HaShachar"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Custom Name'}
          </Button>
          {existingAlias && (
            <Button variant="outline" onClick={onRemove}>
              Remove Custom Name
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Zman Card with Alias

**Modification to: `web/components/publisher/ZmanCard.tsx`**
```typescript
interface ZmanCardProps {
  zman: {
    key: string;
    customHebrewName?: string;
    customEnglishName?: string;
    canonicalHebrewName: string;
    canonicalEnglishName: string;
    formula?: string;
  };
}

export function ZmanCard({ zman }: ZmanCardProps) {
  const displayName = zman.customEnglishName || zman.canonicalEnglishName;
  const displayHebrewName = zman.customHebrewName || zman.canonicalHebrewName;
  const hasAlias = zman.customEnglishName && zman.customEnglishName !== zman.canonicalEnglishName;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{displayName}</span>
          <span dir="rtl" className="text-lg">{displayHebrewName}</span>
        </CardTitle>
        {hasAlias && (
          <CardDescription className="text-xs">
            Original: {zman.canonicalEnglishName}
          </CardDescription>
        )}
      </CardHeader>
      {/* ... rest of card */}
    </Card>
  );
}
```

### Integration in Edit Page

**Modification to: `web/app/publisher/algorithm/edit/[zman_key]/page.tsx`**
```typescript
// Only show in Advanced mode
{editorMode === 'advanced' && (
  <ZmanAliasEditor
    zmanKey={zmanKey}
    canonicalHebrewName={zman.canonicalHebrewName}
    canonicalEnglishName={zman.canonicalEnglishName}
    existingAlias={zman.alias}
    onSave={handleSaveAlias}
    onRemove={handleRemoveAlias}
  />
)}
```

---

## Tasks / Subtasks

- [ ] Task 1: Create ZmanAliasEditor Component
  - [ ] 1.1 Create `web/components/publisher/ZmanAliasEditor.tsx`
  - [ ] 1.2 Implement form with Hebrew (RTL), English, Transliteration fields
  - [ ] 1.3 Add save/remove buttons
  - [ ] 1.4 Add loading states

- [ ] Task 2: API Integration
  - [ ] 2.1 Create hooks for alias CRUD operations
  - [ ] 2.2 Wire up onSave to PUT endpoint
  - [ ] 2.3 Wire up onRemove to DELETE endpoint
  - [ ] 2.4 Handle errors gracefully

- [ ] Task 3: Edit Page Integration
  - [ ] 3.1 Modify `edit/[zman_key]/page.tsx` to include ZmanAliasEditor
  - [ ] 3.2 Only show when editorMode === 'advanced'
  - [ ] 3.3 Fetch existing alias data

- [ ] Task 4: Zman Card Updates
  - [ ] 4.1 Modify ZmanCard to show custom name prominently
  - [ ] 4.2 Show canonical name as subtitle when alias exists
  - [ ] 4.3 Update algorithm list page

- [ ] Task 5: RTL Support
  - [ ] 5.1 Ensure Hebrew input field has dir="rtl"
  - [ ] 5.2 Test Hebrew text display
  - [ ] 5.3 Test mixed Hebrew/English display

- [ ] Task 6: Testing
  - [ ] 6.1 Test creating new alias
  - [ ] 6.2 Test updating existing alias
  - [ ] 6.3 Test removing alias
  - [ ] 6.4 Test display in zman cards
  - [ ] 6.5 Verify Advanced mode only

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] ZmanAliasEditor component complete
- [ ] Only visible in Advanced DSL mode
- [ ] Canonical name always visible
- [ ] Zman cards show custom names correctly
- [ ] RTL Hebrew input works
- [ ] Save/remove functionality tested
- [ ] Uses `useApi()` hook (not raw fetch)
- [ ] Uses `usePublisherQuery` factory hook for data fetching

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `web/components/publisher/ZmanAliasEditor.tsx` | Create | Alias editing form |
| `web/app/publisher/algorithm/edit/[zman_key]/page.tsx` | Modify | Integration |
| `web/components/publisher/ZmanCard.tsx` | Modify | Display custom names |
| `web/lib/hooks/usePublisherAliases.ts` | Create | API hooks |

---

## UI Mockup

```
┌─────────────────────────────────────────────────────────┐
│ Edit Zman: Alos HaShachar                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [Formula Editor - CodeMirror]                          │
│ solar(16.1, before_sunrise)                            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ Custom Display Name                                     │
│                                                         │
│ Original: Dawn / עלות השחר                              │
│                                                         │
│ Hebrew Name:                                            │
│ ┌─────────────────────────────────┐                    │
│ │ עמוד השחר                        │ (RTL input)       │
│ └─────────────────────────────────┘                    │
│                                                         │
│ English Name:                                           │
│ ┌─────────────────────────────────┐                    │
│ │ Dawn Column                      │                   │
│ └─────────────────────────────────┘                    │
│                                                         │
│ Transliteration (optional):                             │
│ ┌─────────────────────────────────┐                    │
│ │ Amud HaShachar                   │                   │
│ └─────────────────────────────────┘                    │
│                                                         │
│ [Save Custom Name]  [Remove Custom Name]               │
└─────────────────────────────────────────────────────────┘
```
