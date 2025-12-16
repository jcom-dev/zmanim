# Story 5.9: Reference Panel Contextual Enhancements

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** todo
**Priority:** P2
**Story Points:** 5
**Dependencies:** Story 5.3 (Smart Placeholders)
**FRs:** FR99 (Reference panel contextual enhancements)

---

## Standards Reference

See `docs/coding-standards.md` sections:
- "Frontend Standards > Component Structure" (hook ordering, state management)
- "Frontend Standards > Styling with Tailwind" (use design tokens)
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Scroll Behavior Note:**
- `scrollIntoView({ behavior: 'smooth' })` may conflict with user manual scrolling
- Use `requestAnimationFrame` or debounce to prevent scroll fights
- Consider only auto-scrolling when element is completely out of view

**State Management:**
- Context helper functions (`getHighlightedFunction`, `getHighlightedParam`) should be in the same file or co-located with `dsl-context-helper.ts`

---

## Story

As a **non-technical publisher**,
I want **the reference panel to highlight where I am in my formula**,
So that **I always know what documentation is relevant**.

---

## Acceptance Criteria

### AC-5.9.1: Function Highlighting
- [ ] When cursor is inside `solar(...)`, the solar() entry in reference panel is highlighted
- [ ] Highlighting uses distinct visual style (border, background color)
- [ ] Smooth scroll to highlighted entry if not visible

### AC-5.9.2: Parameter Indicator
- [ ] "YOU ARE HERE" badge appears next to current parameter
- [ ] When at degrees position, degrees parameter is marked
- [ ] When at direction position, direction parameter is marked
- [ ] Badge is visually distinct (small, colored)

### AC-5.9.3: Parameter Expansion
- [ ] Current parameter section is auto-expanded in reference panel
- [ ] Shows full description for current parameter
- [ ] Other parameters can be collapsed to save space

### AC-5.9.4: Quick-Insert Chips
- [ ] Clickable chips appear for current parameter's common values
- [ ] Clicking chip inserts value at cursor position
- [ ] Chips are context-aware (only show for current parameter type)
- [ ] Example: [8.5°] [11°] [16.1°] [18°] for degrees

### AC-5.9.5: Chip Insertion Behavior
- [ ] Chip click replaces current parameter value
- [ ] Cursor moves to next parameter after insertion
- [ ] Works with empty parameter and existing value

### AC-5.9.6: No Function Context
- [ ] When cursor is not inside any function, no special highlighting
- [ ] Reference panel shows default state
- [ ] All entries equally visible

---

## Technical Context

### Integration with Context Helper

The `dsl-context-helper.ts` from Story 5.2 provides the cursor context. This story extends that context to drive the reference panel.

```typescript
// Share context between editor and reference panel
const [cursorContext, setCursorContext] = useState<DSLContext | null>(null);

// In CodeMirrorDSLEditor
const handleCursorChange = (context: DSLContext) => {
  setCursorContext(context);
  // Also used for contextual tooltips from Story 5.2
};

// In DSLReferencePanel
<DSLReferencePanel
  cursorContext={cursorContext}
  onInsertValue={(value) => insertAtCursor(value)}
/>
```

### Enhanced Reference Panel

**Modifications to: `web/components/editor/DSLReferencePanel.tsx`**
```typescript
interface DSLReferencePanelProps {
  cursorContext?: DSLContext;
  onInsertValue: (value: string) => void;
}

export function DSLReferencePanel({ cursorContext, onInsertValue }: DSLReferencePanelProps) {
  const highlightedFunction = getHighlightedFunction(cursorContext);
  const highlightedParam = getHighlightedParam(cursorContext);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to highlighted function
  useEffect(() => {
    if (highlightedFunction && panelRef.current) {
      const element = panelRef.current.querySelector(`[data-function="${highlightedFunction}"]`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedFunction]);

  return (
    <div ref={panelRef} className="h-full overflow-y-auto p-4 space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search..." className="pl-9" />
      </div>

      {/* Functions Section */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 font-medium">
          <ChevronDown className="h-4 w-4" />
          FUNCTIONS
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 mt-2">
          {DSL_FUNCTIONS.map((func) => (
            <FunctionEntry
              key={func.name}
              function={func}
              isHighlighted={highlightedFunction === func.name}
              highlightedParam={highlightedFunction === func.name ? highlightedParam : null}
              onInsertValue={onInsertValue}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>

      {/* Primitives Section */}
      {/* ... */}
    </div>
  );
}

function FunctionEntry({
  function: func,
  isHighlighted,
  highlightedParam,
  onInsertValue,
}: FunctionEntryProps) {
  return (
    <div
      data-function={func.name}
      className={cn(
        'rounded-lg p-3 transition-colors',
        isHighlighted ? 'bg-blue-50 border-2 border-blue-200' : 'bg-muted/50'
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn(
          'font-mono text-sm',
          isHighlighted && 'text-blue-700 font-medium'
        )}>
          {func.name}({func.parameters?.map(p => p.name).join(', ')})
        </span>
        {isHighlighted && (
          <Badge variant="secondary" className="text-xs">In use</Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-1">{func.description}</p>

      {/* Parameters */}
      {func.parameters?.map((param, idx) => (
        <div
          key={param.name}
          className={cn(
            'mt-2 pl-3 border-l-2',
            highlightedParam === idx ? 'border-blue-500' : 'border-gray-200'
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{param.name}</span>
            {highlightedParam === idx && (
              <Badge className="text-[10px] bg-blue-500">YOU ARE HERE</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{param.description}</p>

          {/* Quick Insert Chips - show when this param is highlighted */}
          {highlightedParam === idx && param.commonValues && (
            <div className="flex flex-wrap gap-1 mt-2">
              {param.commonValues.map((cv) => (
                <button
                  key={cv.value}
                  className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  onClick={() => onInsertValue(cv.value)}
                  title={cv.description}
                >
                  {cv.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Helper Functions

```typescript
function getHighlightedFunction(context: DSLContext | undefined): string | null {
  if (!context) return null;

  switch (context.type) {
    case 'solar_degrees':
    case 'solar_direction':
      return 'solar';
    case 'proportional_hours':
    case 'proportional_base':
      return 'proportional_hours';
    default:
      return null;
  }
}

function getHighlightedParam(context: DSLContext | undefined): number | null {
  if (!context) return null;

  switch (context.type) {
    case 'solar_degrees':
    case 'proportional_hours':
      return 0; // First parameter
    case 'solar_direction':
    case 'proportional_base':
      return 1; // Second parameter
    default:
      return null;
  }
}
```

---

## Tasks / Subtasks

- [ ] Task 1: Share Cursor Context
  - [ ] 1.1 Lift cursor context state to parent component
  - [ ] 1.2 Pass context to DSLReferencePanel
  - [ ] 1.3 Pass insert callback to panel

- [ ] Task 2: Function Highlighting
  - [ ] 2.1 Add getHighlightedFunction helper
  - [ ] 2.2 Style highlighted function entry
  - [ ] 2.3 Implement auto-scroll to highlighted

- [ ] Task 3: Parameter Indicator
  - [ ] 3.1 Add getHighlightedParam helper
  - [ ] 3.2 Create "YOU ARE HERE" badge component
  - [ ] 3.3 Show badge on current parameter

- [ ] Task 4: Quick Insert Chips
  - [ ] 4.1 Show chips only for highlighted parameter
  - [ ] 4.2 Wire chip clicks to onInsertValue
  - [ ] 4.3 Style chips distinctly

- [ ] Task 5: Insert Behavior
  - [ ] 5.1 Implement value replacement at cursor
  - [ ] 5.2 Handle cursor advancement after insert
  - [ ] 5.3 Test with empty and existing values

- [ ] Task 6: Testing
  - [ ] 6.1 Test highlighting for all function contexts
  - [ ] 6.2 Test "YOU ARE HERE" badge positions
  - [ ] 6.3 Test chip insertion
  - [ ] 6.4 Test auto-scroll

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Function highlighting working for solar(), proportional_hours()
- [ ] "YOU ARE HERE" badge shows on current parameter
- [ ] Quick insert chips appear for highlighted parameter
- [ ] Chip insertion replaces value at cursor
- [ ] Auto-scroll to highlighted function (only when out of view)
- [ ] Scroll behavior doesn't fight with user manual scrolling

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `web/components/editor/DSLReferencePanel.tsx` | Modify | Add contextual highlighting |
| `web/components/editor/CodeMirrorDSLEditor.tsx` | Modify | Share context with panel |
| `web/app/publisher/algorithm/edit/[zman_key]/page.tsx` | Modify | State management |

---

## UI Mockup

```
┌────────────────────────────┐
│ 🔍 [Search...]             │
├────────────────────────────┤
│ ▾ FUNCTIONS                │
│                            │
│ ┌────────────────────────┐ │
│ │ 🔵 solar(deg, dir)     │ │ ← Highlighted (blue border)
│ │    [In use]            │ │
│ │                        │ │
│ │  • degrees             │ │
│ │    ├─ [YOU ARE HERE]   │ │ ← Badge
│ │    └─ 0-90 angle       │ │
│ │    Quick insert:       │ │
│ │    [8.5°] [11°] [16.1°]│ │ ← Chips
│ │                        │ │
│ │  • direction           │ │
│ │    └─ before/after     │ │
│ └────────────────────────┘ │
│                            │
│ ○ proportional_hours()     │
│ ○ midpoint()               │
└────────────────────────────┘
```

---

## UX Spec Reference

See: [ux-dsl-editor-inline-guidance.md](../../ux-dsl-editor-inline-guidance.md) - Section 3
