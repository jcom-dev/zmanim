# Story 1.8: Algorithm Editor

Status: done

## Story

As a **publisher**,
I want **to configure my zmanim calculation algorithm**,
so that **my community receives times according to my halachic opinions**.

## Acceptance Criteria

1. Publisher sees current algorithm configuration
2. Publisher can choose from templates (GRA, MGA, Rabbeinu Tam, Custom)
3. Clicking zman opens configuration modal
4. Modal shows method options with intellisense autocomplete
5. Live preview shows calculated time for today at sample location
6. "View Month" shows calendar with all zmanim for each day
7. Invalid configuration shows validation error
8. Unsaved changes trigger navigation warning

## Tasks / Subtasks

- [ ] Task 1: Create algorithms database table (AC: 1, 7)
  - [ ] 1.1 Create migration for algorithms table
  - [ ] 1.2 Add indexes for publisher_id and status
  - [ ] 1.3 Run database migration

- [ ] Task 2: Implement algorithm API (AC: 1, 5, 7)
  - [ ] 2.1 Create api/internal/handlers/algorithms.go
  - [ ] 2.2 GET /api/publisher/algorithm - get current
  - [ ] 2.3 PUT /api/publisher/algorithm - save draft
  - [ ] 2.4 POST /api/publisher/algorithm/preview - calculate preview
  - [ ] 2.5 Validate algorithm configuration

- [ ] Task 3: Create algorithm templates (AC: 2)
  - [ ] 3.1 Define GRA template JSON
  - [ ] 3.2 Define Magen Avraham (MGA) template JSON
  - [ ] 3.3 Define Rabbeinu Tam template JSON
  - [ ] 3.4 Define empty Custom template
  - [ ] 3.5 Store templates in api/data/templates/

- [ ] Task 4: Create algorithm editor page (AC: 1, 8)
  - [ ] 4.1 Create web/app/publisher/algorithm/page.tsx
  - [ ] 4.2 Display current algorithm or empty state
  - [ ] 4.3 Unsaved changes warning on navigation
  - [ ] 4.4 Save button with loading state

- [ ] Task 5: Create template selector (AC: 2)
  - [ ] 5.1 Create web/components/publisher/TemplateSelector.tsx
  - [ ] 5.2 Card display for each template
  - [ ] 5.3 Description of each template approach
  - [ ] 5.4 "Start from Template" action

- [ ] Task 6: Create zman list component (AC: 1, 3)
  - [ ] 6.1 Create web/components/publisher/ZmanList.tsx
  - [ ] 6.2 List all configurable zmanim
  - [ ] 6.3 Show current method for each
  - [ ] 6.4 Click to open configuration modal

- [ ] Task 7: Create zman configuration modal (AC: 3, 4, 7)
  - [ ] 7.1 Create web/components/publisher/ZmanConfigModal.tsx
  - [ ] 7.2 Method selector dropdown
  - [ ] 7.3 Parameter inputs based on method
  - [ ] 7.4 Intellisense/autocomplete for method names
  - [ ] 7.5 Validation with inline errors

- [ ] Task 8: Create live preview panel (AC: 5)
  - [ ] 8.1 Create web/components/publisher/AlgorithmPreview.tsx
  - [ ] 8.2 Show today's calculated times
  - [ ] 8.3 Use sample location (e.g., New York)
  - [ ] 8.4 Update on configuration change

- [ ] Task 9: Create month view component (AC: 6)
  - [ ] 9.1 Create web/components/publisher/MonthPreview.tsx
  - [ ] 9.2 Calendar grid display
  - [ ] 9.3 Show all zmanim for each day
  - [ ] 9.4 Navigation between months

## Dev Notes

### Architecture Patterns

- **Algorithm Storage:** JSON DSL in JSONB column
- **Draft Mode:** Changes saved as draft until published
- **Preview:** Server-side calculation for accuracy

### Database Schema

```sql
CREATE TABLE algorithms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'draft', -- draft, published, deprecated
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Standard Zmanim List

1. Alos HaShachar (Dawn)
2. Misheyakir (Earliest Tallis)
3. Sunrise (Netz)
4. Sof Zman Shma (Latest Shma)
5. Sof Zman Tefillah (Latest Shacharit)
6. Chatzos (Midday)
7. Mincha Gedola (Earliest Mincha)
8. Mincha Ketana (Ideal Mincha)
9. Plag HaMincha
10. Sunset (Shkiah)
11. Tzeis HaKochavim (Nightfall)
12. Tzeis Rabbeinu Tam (72 min)

### Algorithm Templates

| Template | Alos | Tzeis | Proportional Base |
|----------|------|-------|-------------------|
| GRA | 16.1° | 8.5° | Sunrise-Sunset |
| MGA | 72 min | 72 min | Alos-Tzeis |
| Rabbeinu Tam | 16.1° | 72 min | Sunrise-Sunset |

### References

- [Source: docs/architecture.md#Algorithm-DSL-Format]
- [Source: docs/epics.md#Story-1.8-Algorithm-Editor]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Story-1.8]
- [Source: docs/ux-design-specification.md#Algorithm-Editor]

## Dev Agent Record

### Context Reference
- Story 1.7 calculation engine implementation

### Agent Model Used
- Claude Code (claude-opus-4-5-20251101)

### Completion Notes List
- Added configuration column to algorithms table via migration
- Implemented algorithm API endpoints (GET/PUT /publisher/algorithm, templates, methods, preview)
- Created algorithm editor page with template selector, zman list, configuration modal
- Implemented live preview panel showing calculated times for sample location
- Added month view component with calendar grid navigation
- Unsaved changes warning implemented via beforeunload event
- All 13 Playwright E2E tests pass

### File List
- `db/migrations/20240008_update_algorithms_table.sql` - Database migration
- `api/internal/handlers/publisher_algorithm.go` - Algorithm API handlers
- `api/cmd/migrate/main.go` - Migration utility script
- `web/app/publisher/algorithm/page.tsx` - Algorithm editor page
- `web/components/publisher/TemplateSelector.tsx` - Template selection component
- `web/components/publisher/ZmanList.tsx` - Zman list display component
- `web/components/publisher/ZmanConfigModal.tsx` - Zman configuration modal with autocomplete
- `web/components/publisher/AlgorithmPreview.tsx` - Live preview panel
- `web/components/publisher/MonthPreview.tsx` - Month view calendar component
- `web/tests/algorithm-editor.spec.ts` - 13 Playwright E2E tests
