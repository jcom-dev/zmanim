# Story 5.17: Publisher Schema Refactor - Remove Organization, Mandatory Logo with AI Generation

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** Approved
**Priority:** P1
**Story Points:** 5
**Dependencies:** None (can run in parallel with other Epic 5 stories)

---

## Story

As a **platform user**,
I want **publisher profiles to be simplified (publisher IS the organization) with mandatory logos that can be AI-generated**,
So that **the data model is cleaner and all publishers have professional visual identity**.

---

## Acceptance Criteria

### AC-5.17.1: Remove Organization Field from Publishers
- [ ] `organization` column removed from `publishers` table
- [ ] `organization` column removed from `publisher_requests` table
- [ ] All SQLc queries updated to remove organization references
- [ ] All handlers updated to remove organization from request/response types
- [ ] Frontend forms no longer show organization field
- [ ] Existing data migrated: if organization was set, append to description or discard

### AC-5.17.2: Make Logo Mandatory for Publishers
- [ ] `logo_url` column changed to NOT NULL in `publishers` table
- [ ] Backend validation rejects publisher creation/update without logo
- [ ] Frontend shows logo as required field (marked with *)
- [ ] Cannot save profile without logo

### AC-5.17.3: AI Logo Generation from Name
- [ ] "Generate Logo" button added to publisher profile page
- [ ] Button generates a logo based on publisher name (initials + color scheme)
- [ ] Generated logo uses canvas/SVG with:
  - First 1-2 letters of publisher name as initials
  - Consistent, professional color palette
  - Clean geometric shape (circle or rounded square)
- [ ] User can customize background color before saving
- [ ] Generated logo is saved to storage and set as logo_url

### AC-5.17.4: Update All Publisher Interfaces
- [ ] `web/app/become-publisher/page.tsx` - remove organization, add mandatory logo
- [ ] `web/app/publisher/profile/page.tsx` - remove organization, add mandatory logo
- [ ] `web/app/admin/publishers/new/page.tsx` - remove organization, add mandatory logo
- [ ] `web/app/admin/publishers/[id]/page.tsx` - remove organization display
- [ ] `web/app/admin/publishers/page.tsx` - remove organization from list
- [ ] `web/components/shared/PublisherCard.tsx` - remove organization display
- [ ] `web/components/admin/PendingRequests.tsx` - remove organization

### AC-5.17.5: Update TypeScript Types
- [ ] Remove organization from all Publisher-related interfaces
- [ ] Add logo_url as required (not optional) in types
- [ ] Update API client types if applicable

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Migration applied successfully
- [ ] SQLc regenerated with no organization references
- [ ] All handlers compile and work without organization
- [ ] All frontend forms work without organization field
- [ ] Logo generation works and saves correctly
- [ ] Existing publishers without logos handled gracefully (prompt to add)
- [ ] E2E tests updated/passing

---

## Tasks / Subtasks

- [ ] Task 1: Database Migration (AC: 5.17.1, 5.17.2)
  - [ ] 1.1 Create migration `00000000000026_remove_organization_mandatory_logo.sql`
  - [ ] 1.2 Drop organization column from publishers
  - [ ] 1.3 Drop organization column from publisher_requests
  - [ ] 1.4 Set logo_url NOT NULL with default empty string (temporary)
  - [ ] 1.5 Run migration via `./scripts/migrate.sh`

- [ ] Task 2: Backend Updates (AC: 5.17.1, 5.17.2)
  - [ ] 2.1 Regenerate SQLc: `cd api && sqlc generate`
  - [ ] 2.2 Update `api/internal/handlers/publishers.go` - remove organization
  - [ ] 2.3 Update `api/internal/handlers/publisher_requests.go` - remove organization
  - [ ] 2.4 Update `api/internal/handlers/admin.go` - remove organization
  - [ ] 2.5 Add logo_url validation in profile update handler
  - [ ] 2.6 Update `api/internal/handlers/types.go` request/response types

- [ ] Task 3: Logo Generation Component (AC: 5.17.3)
  - [ ] 3.1 Create `web/components/publisher/LogoGenerator.tsx`
  - [ ] 3.2 Implement initials extraction from publisher name
  - [ ] 3.3 Implement canvas-based logo rendering
  - [ ] 3.4 Add color picker for background customization
  - [ ] 3.5 Implement save to storage (data URL or upload)

- [ ] Task 4: Frontend Form Updates (AC: 5.17.4, 5.17.5)
  - [ ] 4.1 Update `web/app/become-publisher/page.tsx`
  - [ ] 4.2 Update `web/app/publisher/profile/page.tsx`
  - [ ] 4.3 Update `web/app/admin/publishers/new/page.tsx`
  - [ ] 4.4 Update `web/app/admin/publishers/[id]/page.tsx`
  - [ ] 4.5 Update `web/app/admin/publishers/page.tsx`
  - [ ] 4.6 Update `web/components/shared/PublisherCard.tsx`
  - [ ] 4.7 Update `web/components/admin/PendingRequests.tsx`

- [ ] Task 5: TypeScript Type Updates (AC: 5.17.5)
  - [ ] 5.1 Update `web/types/` interfaces
  - [ ] 5.2 Update `web/providers/PublisherContext.tsx`
  - [ ] 5.3 Fix any TypeScript errors from removed organization

- [ ] Task 6: Testing
  - [ ] 6.1 Update E2E tests for publisher flows
  - [ ] 6.2 Test logo generation functionality
  - [ ] 6.3 Test form validation for mandatory logo
  - [ ] 6.4 Verify admin publisher management works

---

## Dev Notes

### Migration SQL

```sql
-- Migration: 00000000000026_remove_organization_mandatory_logo.sql

-- Remove organization from publishers
ALTER TABLE publishers DROP COLUMN IF EXISTS organization;

-- Remove organization from publisher_requests
ALTER TABLE publisher_requests DROP COLUMN IF EXISTS organization;

-- For existing publishers without logo, we'll handle in app logic
-- (prompt them to add logo on next profile visit)
```

### Logo Generator Component

```tsx
// web/components/publisher/LogoGenerator.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface LogoGeneratorProps {
  publisherName: string;
  onGenerate: (dataUrl: string) => void;
}

const COLORS = [
  '#1e40af', // blue
  '#166534', // green
  '#9a3412', // orange
  '#7e22ce', // purple
  '#be123c', // rose
  '#0f766e', // teal
];

export function LogoGenerator({ publisherName, onGenerate }: LogoGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bgColor, setBgColor] = useState(COLORS[0]);

  const getInitials = (name: string): string => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  const generateLogo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 200;
    canvas.width = size;
    canvas.height = size;

    // Background circle
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
    ctx.fill();

    // Text
    const initials = getInitials(publisherName);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 80px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, size/2, size/2);

    const dataUrl = canvas.toDataURL('image/png');
    onGenerate(dataUrl);
  };

  useEffect(() => {
    generateLogo();
  }, [publisherName, bgColor]);

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex gap-2">
        {COLORS.map(color => (
          <button
            key={color}
            onClick={() => setBgColor(color)}
            className={`w-8 h-8 rounded-full border-2 ${bgColor === color ? 'border-black' : 'border-transparent'}`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <Button onClick={generateLogo}>
        Generate Logo
      </Button>
    </div>
  );
}
```

### Backend Validation

```go
// In handlers/publishers.go
func (h *Handlers) UpdatePublisherProfile(w http.ResponseWriter, r *http.Request) {
    // ... existing code ...

    // Step 4: Validate inputs
    if req.LogoURL == "" {
        RespondValidationError(w, r, "Logo is required", map[string]string{
            "logo_url": "Publisher logo is required",
        })
        return
    }

    // ... rest of handler ...
}
```

### References

- [Source: docs/epics.md#Epic 5]
- [Related: Story 5.10 Publisher Logo Editor]

---

## Testing Requirements

### Unit Tests
- [ ] Logo initials extraction works for single/multi-word names
- [ ] Canvas generates valid data URL

### Integration Tests
- [ ] Profile update rejects missing logo
- [ ] Profile update accepts valid logo_url
- [ ] Publisher creation requires logo

### E2E Tests
- [ ] Become publisher flow works without organization
- [ ] Publisher profile edit works with logo requirement
- [ ] Logo generation and save works
- [ ] Admin publisher management works without organization

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/5-10-publisher-logo-editor.md (related story)
- docs/coding-standards.md

### Agent Model Used
(To be filled by dev agent)

### Completion Notes
(To be filled upon completion)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-02 | Story created per user request | Dev Agent (Amelia) |
