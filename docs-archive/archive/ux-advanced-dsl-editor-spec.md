# Advanced DSL Editor - UX Design Specification

_Created on 2025-11-30 by BMad with Sally (UX Designer)_
_Addendum to main UX Design Specification_

---

## Executive Summary

**Problem:** The Advanced DSL Editor is currently a nightmare to use - no discoverability, hidden Quick Reference, wasted screen space, and no guidance for users trying to write formulas.

**Solution:** Transform the editor with a Notion-style always-visible reference panel featuring searchable functions, click-to-insert, and common pattern examples.

**Inspiration:** Notion's formula editor - approachable, discoverable, makes users feel smart rather than intimidated.

**Desired User Feeling:** "Empowered and Confident" - The tool helps me, not fights me.

---

## 1. Current State Analysis

### What's Broken

| Issue | Impact | Screenshot Reference |
|-------|--------|---------------------|
| Quick Reference collapsed at bottom | Users never discover available functions | Left panel bottom |
| Right panel wasted on AI Explanation | Prime real estate for rarely-used feature | Right panel |
| No searchable function browser | Users must memorize syntax | N/A |
| No click-to-insert | Must type everything manually | N/A |
| Autocomplete only after 2 chars | Feels like fighting the tool | N/A |
| Error feedback delayed/vague | Users don't know what's wrong | N/A |

### Current Layout (Problematic)
```
LEFT (50%): Editor + Names + Collapsed Quick Reference
RIGHT (50%): Formula Preview + Result + AI Explanation + Publisher Comment
```

---

## 2. New Design Direction

### Proposed Layout
```
LEFT (55%): Editor + Names + Compact Result + Collapsible AI/Comments
RIGHT (45%): Searchable Reference Panel + Examples
```

### Key Changes

1. **Always-visible Reference Panel** - Replace wasted right panel space
2. **Search Bar** - Top of reference, instant filter
3. **Category Accordions** - Primitives, Functions, Operators, References
4. **Click-to-Insert** - Click any item to insert at cursor
5. **Common Patterns** - Example formulas users can start from
6. **Compact Result** - Move calculated result to left panel
7. **Collapsible AI/Comments** - Demote to collapsible sections
8. **AI Assistant button** - Only show in header when Advanced DSL mode is active (not needed for Guided Builder)

---

## 3. Component Specifications

### 3.1 DSLReferencePanel

**New component to replace current right panel content in Advanced DSL mode**

```typescript
interface DSLReferencePanelProps {
  onInsert: (text: string) => void;  // Insert at cursor
  onSetFormula: (formula: string) => void;  // Replace entire formula
  currentFormula: string;  // For "in use" badges
  zmanimKeys: string[];  // Publisher's existing zmanim
}
```

**Structure:**
```
┌─────────────────────────────────────────┐
│ 🔍 [Search functions, primitives...]    │
├─────────────────────────────────────────┤
│ ▾ PRIMITIVES (4)                        │
│   ○ sunrise    → Start of visible sun   │
│   ○ sunset     → End of visible sun     │
│   ○ solar_noon → Sun at highest point   │
│   ○ midnight   → Solar midnight         │
├─────────────────────────────────────────┤
│ ▾ FUNCTIONS (5)                         │
│   ● solar(deg, dir)   → (in use)        │
│   ○ shaos(hrs, base)  → Proportional    │
│   ○ offset(zman, min) → Add/subtract    │
│   ○ min(a, b)         → Earlier of two  │
│   ○ max(a, b)         → Later of two    │
├─────────────────────────────────────────┤
│ ▾ OPERATORS (4)                         │
│   ○ +   → Add duration                  │
│   ○ -   → Subtract duration             │
│   ○ min → Minutes unit                  │
│   ○ hr  → Hours unit                    │
├─────────────────────────────────────────┤
│ ▾ YOUR ZMANIM (12)                      │
│   ○ @alos_72, @sunrise, @chatzos...     │
├─────────────────────────────────────────┤
│ 💡 COMMON PATTERNS                      │
│ ┌─────────────────────────────────────┐ │
│ │ sunrise - 72min                     │ │
│ │ 72 minutes before sunrise           │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**States:**
- Default: All categories expanded
- Searching: Filtered results highlighted
- Item hover: Background highlight, pointer cursor
- Item in formula: "in use" badge, subtle highlight

**Behavior:**
- Click item → Insert text at cursor position in editor
- Click example → Confirm if replacing existing formula
- Search → Real-time filter across all categories
- Category header → Toggle collapse/expand

### 3.2 Color Coding

| Category | Dot Color | CSS Variable |
|----------|-----------|--------------|
| Primitives | Green | `--accent-green: #22c55e` |
| Functions | Blue | `--accent-blue: #3b82f6` |
| Operators | Purple | `--accent-purple: #a855f7` |
| References | Pink | `--accent-pink: #ec4899` |

### 3.3 CompactResultCard

**Replaces the large "Calculated Result" card - more compact, stays in left panel**

```
┌─────────────────────────────────────┐
│ RESULT           5:53:52 AM        │
│ Nov 30 • London, UK                │
└─────────────────────────────────────┘
```

---

## 4. User Journey: Write a Formula

### Happy Path

```
1. User clicks "Advanced DSL" tab
   → Sees empty editor + full reference panel

2. User scans reference categories
   → Notices color-coded items with descriptions

3. User searches "angle" in search bar
   → Sees filtered results: solar(degrees, direction)

4. User clicks solar(degrees, direction)
   → Text inserted: "solar(degrees, direction)"
   → Item shows "in use" badge

5. User edits parameters: "solar(16.1, before_sunrise)"
   → Validation runs (500ms debounce)
   → Green checkmark appears
   → Result card shows: "5:53:52 AM"

6. User saves
   → Success toast
```

### Error Recovery Path

```
1. User types: "solar(16.1)"
   → Red X appears: "Missing parameter: direction"

2. User sees error, checks reference panel
   → Sees full signature: solar(degrees, direction)

3. User fixes: "solar(16.1, before_sunrise)"
   → Green checkmark
```

---

## 5. UX Pattern Decisions

| Pattern | Decision | Rationale |
|---------|----------|-----------|
| Search behavior | Instant filter, no submit button | Notion-style immediacy |
| Insert position | At cursor | Respects user's editing context |
| Example replace | Confirm dialog if non-empty | Prevent accidental loss |
| Validation timing | 500ms debounce | Fast but not overwhelming |
| Error display | Inline status + panel below editor | Clear without being intrusive |
| Categories default | All expanded | Maximize discoverability |
| "In use" indicator | Badge on items | Helps understand formula |
| Panel split | 55% left, 45% right | Balance editor and reference |
| AI/Comments | Collapsible, closed default | Secondary features |

---

## 6. Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| Desktop (>1024px) | Side-by-side panels, resizable |
| Tablet (768-1024px) | Narrower right panel (40%) |
| Mobile (<768px) | Stacked - editor above, reference below as collapsible |

---

## 7. Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Keyboard navigation | Tab through reference items, Enter to insert |
| Screen reader | ARIA labels on categories and items |
| Focus management | Return focus to editor after insert |
| Color contrast | All text meets 4.5:1 minimum |
| Touch targets | 44x44px minimum on mobile |

---

## 8. Implementation Notes

### Files to Modify

1. **`web/app/publisher/algorithm/edit/[zman_key]/page.tsx`**
   - Replace right panel content with `DSLReferencePanel` when in advanced mode
   - Move result card to left panel
   - Make AI Explanation and Publisher Comment collapsible
   - **Conditionally show AI Assistant button** - Only render when `mode === 'advanced'`

2. **`web/components/editor/DSLEditor.tsx`**
   - Add `onInsertAtCursor` callback prop
   - Remove/hide the collapsed Quick Reference section

3. **New: `web/components/editor/DSLReferencePanel.tsx`**
   - Searchable reference panel component
   - Categories with items
   - Click-to-insert functionality

4. **New: `web/lib/dsl-reference-data.ts`**
   - Static data for primitives, functions, operators
   - Descriptions and signatures

### Data Structure

```typescript
interface ReferenceItem {
  name: string;
  signature?: string;  // For functions: "solar(degrees, direction)"
  description: string;
  snippet: string;  // What to insert when clicked
  category: 'primitive' | 'function' | 'operator' | 'reference';
}

const DSL_REFERENCE: ReferenceItem[] = [
  {
    name: 'sunrise',
    description: 'Start of visible sun (amud hashachar)',
    snippet: 'sunrise',
    category: 'primitive',
  },
  {
    name: 'solar',
    signature: 'solar(degrees, direction)',
    description: 'Time when sun reaches specified angle below horizon',
    snippet: 'solar(degrees, direction)',
    category: 'function',
  },
  // ...
];
```

---

## 9. Interactive Mockup

**Open in browser:** [ux-advanced-dsl-editor-mockup.html](./ux-advanced-dsl-editor-mockup.html)

Features demonstrated:
- Search filtering
- Click-to-insert
- Category collapse/expand
- "In use" badge on items
- Example patterns

---

## 10. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Time to write first formula | Unknown (frustrating) | < 60 seconds |
| Formula errors on save | High | < 10% |
| Use of examples/templates | Low | > 50% of new formulas |
| User satisfaction | "nightmare" | "I feel like a pro" |

---

## Appendix: Reference Data

### Primitives
| Name | Description |
|------|-------------|
| `sunrise` | Start of visible sun (netz) |
| `sunset` | End of visible sun (shkiah) |
| `solar_noon` | Sun at highest point (chatzos hayom) |
| `midnight` | Solar midnight (chatzos halayla) |

### Functions
| Signature | Description |
|-----------|-------------|
| `solar(degrees, direction)` | Time when sun reaches angle. Directions: before_sunrise, after_sunrise, before_sunset, after_sunset |
| `shaos(hours, base)` | Proportional hours from base zman |
| `offset(zman, minutes)` | Add/subtract fixed minutes |
| `min(a, b)` | Earlier of two times |
| `max(a, b)` | Later of two times |

### Operators
| Operator | Usage |
|----------|-------|
| `+` | Add duration: `sunrise + 30min` |
| `-` | Subtract duration: `sunset - 18min` |
| `min` | Minutes unit: `72min` |
| `hr` | Hours unit: `1hr` |

### Common Patterns
| Pattern | Description |
|---------|-------------|
| `sunrise - 72min` | Dawn, 72 fixed minutes before |
| `solar(16.1, before_sunrise)` | Dawn at 16.1 degrees |
| `shaos(4, sunrise)` | End of 4th proportional hour |
| `sunset - 18min` | Candle lighting |
| `solar(8.5, after_sunset)` | Tzeis at 8.5 degrees |

---

_This specification was created through collaborative UX design facilitation with user input at every step._
