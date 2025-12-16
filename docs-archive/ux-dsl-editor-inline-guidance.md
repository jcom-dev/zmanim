# DSL Editor Inline Guidance - UX Specification

_Created: 2025-12-02 by BMad with Sally (UX Designer)_
_Addendum to: ux-advanced-dsl-editor-spec.md_

---

## Executive Summary

**Problem:** The existing DSL Editor has a great reference panel, but users still get stuck when typing because:
1. Placeholders like `solar[degrees, direction]` don't explain what values are valid
2. Error messages speak "developer" not "human" (`unexpected token after expression: solar`)
3. No contextual hints appear where the cursor is — users must look away to the reference panel

**Solution:** Add three layers of inline guidance that meet users exactly where they are:
1. **Contextual Tooltips** — Smart hints that appear based on cursor position
2. **Human Error Messages** — Compassionate, actionable feedback with fix suggestions
3. **Smart Placeholders** — Real examples instead of abstract parameter names

**Target User:** Non-technical community admin (rabbi, gabbai, shul secretary) who knows halacha but not programming.

**Design Principle:** *"The editor should teach me while I use it, not require me to learn first."*

---

## 1. Problem Analysis

### 1.1 The Screenshot That Started This

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Guided Builder unavailable: This formula uses syntax    │
│ that the visual builder cannot represent. Use Advanced DSL │
│ mode to edit.                                               │
├─────────────────────────────────────────────────────────────┤
│ </> DSL Formula                               ⊗ 1 error     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ • sunrise solar[degrees, direction]                     │ │
│ │                ^^^^^^^^  ^^^^^^^^^                      │ │
│ │                   ???        ???                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ⊗ Validation Errors                                         │
│ • unexpected token after expression: solar                  │
│                                                             │
│ 🔤 autocomplete   Ctrl+Z undo   @ reference zman           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 What's Wrong Here

| Element | Problem | User Thinks |
|---------|---------|-------------|
| `degrees` placeholder | No hint what values are valid | "Is it 90? 45? A percentage?" |
| `direction` placeholder | No hint what options exist | "North? Up? Left?" |
| Error: "unexpected token" | Developer jargon | "I don't know what a token is" |
| Error: "after expression: solar" | Not actionable | "So... what do I do?" |
| Red dot indicator | No explanation | "Something's wrong but what?" |

### 1.3 The Knowledge Gap

**What the User Knows:**
- "I want misheyakir to be when the sun is 11 degrees below the horizon in the morning"
- Halachic concepts, not programming syntax

**What the Editor Requires:**
- `solar(11, before_sunrise)` — specific syntax with exact keywords

**The Gap:** User can't translate their knowledge into syntax without extensive documentation reading.

---

## 2. Design Solution: Three Layers of Guidance

### Layer 1: Contextual Tooltips (Inline)

**Concept:** Smart floating hints that appear based on cursor position, showing exactly what's needed right now.

#### 2.1.1 Trigger Conditions

| Cursor Position | Tooltip Appears | Content |
|-----------------|-----------------|---------|
| After `solar(` | Immediately | Degrees hint with examples |
| After first comma in `solar(X,` | Immediately | Direction options |
| After `proportional_hours(` | Immediately | Hours hint with examples |
| After first comma in `proportional_hours(X,` | Immediately | Base options |
| After `proportional_minutes(` | Immediately | Minutes hint with formula and examples |
| After first comma in `proportional_minutes(X,` | Immediately | Direction options |
| After `earlier_of(` | Immediately | Time selection hint |
| After `later_of(` | Immediately | Time selection hint |
| After `first_valid(` | Immediately | Fallback pattern hint |
| Inside empty editor | After 2 seconds | "Start typing or pick from examples →" |
| After typing unknown word | After 500ms | "Did you mean: [suggestions]" |

#### 2.1.2 Tooltip Designs

**For `solar()` degrees parameter:**
```
┌─────────────────────────────────────────────────────────┐
│ 📐 Degrees: Sun angle below horizon (0-90)              │
│                                                         │
│ Common values:                                          │
│   • 8.5°  — Tzeis (nightfall)                          │
│   • 11°   — Misheyakir (earliest tallis/tefillin)      │
│   • 16.1° — Alos hashachar (Magen Avraham dawn)        │
│   • 18°   — Astronomical twilight                       │
│                                                         │
│ Type a number, e.g., 16.1                              │
└─────────────────────────────────────────────────────────┘
```

**For `solar()` direction parameter:**
```
┌─────────────────────────────────────────────────────────┐
│ 🧭 Direction: When does this angle occur?               │
│                                                         │
│ Click to insert:                                        │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ before_sunrise   │  │ after_sunset     │            │
│  │ Morning (dawn)   │  │ Evening (tzeis)  │            │
│  └──────────────────┘  └──────────────────┘            │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ before_noon      │  │ after_noon       │            │
│  │ Late morning     │  │ Afternoon        │            │
│  └──────────────────┘  └──────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

**For `proportional_hours()` hours parameter:**
```
┌─────────────────────────────────────────────────────────┐
│ ⏱️ Hours: Proportional hour number (0.5-12)             │
│                                                         │
│ Common values:                                          │
│   • 3    — Sof zman Shema                              │
│   • 4    — Sof zman Tefila                             │
│   • 6    — Chatzos (midday)                            │
│   • 9.5  — Mincha Ketana                               │
│   • 10.75— Plag HaMincha                               │
│                                                         │
│ Type a number, e.g., 4                                 │
└─────────────────────────────────────────────────────────┘
```

**For `proportional_hours()` base parameter:**
```
┌─────────────────────────────────────────────────────────┐
│ 📏 Base: How is the "day" calculated?                   │
│                                                         │
│ Click to insert:                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ gra                                              │   │
│  │ Vilna Gaon: sunrise to sunset                   │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ mga                                              │   │
│  │ Magen Avraham: 72 min before sunrise to 72 min │   │
│  │ after sunset                                     │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ mga_90 / mga_120                                 │   │
│  │ Extended MGA methods (90 or 120 minutes)        │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ateret_torah                                     │   │
│  │ Sephardic: sunrise to tzais 40 minutes          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**For `proportional_minutes()` minutes parameter:**
```
┌─────────────────────────────────────────────────────────┐
│ ⏱️ Minutes: Number of minutes to scale (0-720)          │
│                                                         │
│ Formula: offset = (minutes / 720) × day_length         │
│                                                         │
│ Common values:                                          │
│   • 72  — 1/10th of day (Magen Avraham method)        │
│   • 90  — 1/8th of day (some opinions)                │
│   • 120 — 1/6th of day (some opinions)                │
│                                                         │
│ Type a number, e.g., 72                                │
└─────────────────────────────────────────────────────────┘
```

**For `proportional_minutes()` direction parameter:**
```
┌─────────────────────────────────────────────────────────┐
│ 🧭 Direction: When to apply the offset?                 │
│                                                         │
│ Click to insert:                                        │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ before_sunrise   │  │ after_sunset     │            │
│  │ Dawn (alos)      │  │ Night (tzais)    │            │
│  └──────────────────┘  └──────────────────┘            │
│                                                         │
│ Example: proportional_minutes(72, before_sunrise)      │
│                                                         │
│ Example: proportional_minutes(10.75, ateret_torah)     │
└─────────────────────────────────────────────────────────┘
```

**For `earlier_of()` function:**
```
┌─────────────────────────────────────────────────────────┐
│ ⏪ earlier_of(time1, time2)                             │
│                                                         │
│ Returns whichever time comes first chronologically.    │
│                                                         │
│ Common uses:                                            │
│   • Ensuring a time doesn't extend past a boundary     │
│   • Choosing the more stringent (earlier) opinion      │
│   • Setting a maximum time limit                       │
│                                                         │
│ Examples:                                               │
│   • earlier_of(sunrise, civil_dawn)                    │
│   • earlier_of(@alos, sunrise - 72min)                 │
│                                                         │
│ Type the first time, comma, then second time           │
└─────────────────────────────────────────────────────────┘
```

**For `later_of()` function:**
```
┌─────────────────────────────────────────────────────────┐
│ ⏩ later_of(time1, time2)                               │
│                                                         │
│ Returns whichever time comes last chronologically.     │
│                                                         │
│ Common uses:                                            │
│   • Ensuring a time doesn't occur before a boundary    │
│   • Choosing the more stringent (later) opinion        │
│   • Setting a minimum time limit                       │
│                                                         │
│ Examples:                                               │
│   • later_of(sunset, civil_dusk)                       │
│   • later_of(@tzeis, sunset + 18min)                   │
│                                                         │
│ Type the first time, comma, then second time           │
└─────────────────────────────────────────────────────────┘
```

**For `first_valid()` function:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔄 first_valid(primary, fallback, ...)                 │
│                                                         │
│ Returns first successful calculation. Great for        │
│ high-latitude fallbacks.                                │
│                                                         │
│ How it works:                                           │
│   1. Try the first formula                             │
│   2. If it fails, try the next one                     │
│   3. Return first successful result                    │
│                                                         │
│ Examples:                                               │
│   • first_valid(solar(16.1, before_sunrise),           │
│                 solar_midnight)                         │
│   • first_valid(solar(16.1, before_sunrise),           │
│                 solar(12, before_sunrise),              │
│                 civil_dawn)                             │
│                                                         │
│ Type formulas separated by commas                      │
└─────────────────────────────────────────────────────────┘
```

#### 2.1.3 Tooltip Behavior

| Behavior | Specification |
|----------|--------------|
| Appear | 100ms after cursor enters trigger zone |
| Position | Above cursor line, or below if near top |
| Dismiss | Click outside, press Escape, or continue typing |
| Click option | Inserts value and dismisses tooltip |
| Persistence | Stays visible while cursor is in trigger zone |
| Mobile | Tap to show, tap option to insert |

---

### Layer 2: Human Error Messages

**Concept:** Transform every error into a learning moment with clear explanation and fix suggestion.

#### 2.2.1 Error Message Transformation Map

| Backend Error | Human Message | Suggested Fix |
|---------------|---------------|---------------|
| `unexpected token after expression: solar` | **Oops! `solar` needs parentheses to work.** | Try: `solar(degrees, direction)` — like `solar(16.1, before_sunrise)` |
| `solar() requires 2 arguments (degrees, direction), got 1` | **Almost there! `solar()` needs two things:** a number for degrees AND a direction. | Example: `solar(16.1, before_sunrise)` |
| `solar() degrees must be between 0 and 90, got 120` | **120° is too high.** The sun can only be 0-90° below the horizon. | Common values: 8.5° (tzeis), 16.1° (alos), 18° (astronomical) |
| `invalid direction: above` | **"above" isn't a recognized direction.** | Choose one: `before_sunrise`, `after_sunset`, `before_noon`, `after_noon` |
| `unknown primitive: sunrise2` | **Hmm, I don't recognize "sunrise2".** | Did you mean `sunrise`? |
| `undefined reference: @shachris` | **Can't find a zman called "@shachris".** | Available: @alos_hashachar, @sunrise, @chatzos... |
| `cannot add two times` | **You can't add two times together** (like sunrise + sunset). | To add minutes: `sunrise + 30min`. To find the middle: `midpoint(sunrise, sunset)` |
| `circular reference: @alos references itself` | **Whoops! This formula references itself**, which would create an infinite loop. | Use a primitive like `sunrise` or reference a different zman. |
| `earlier_of() requires 2 arguments` | **`earlier_of()` needs exactly two times.** | Example: `earlier_of(sunrise, civil_dawn)` |
| `later_of() requires 2 arguments` | **`later_of()` needs exactly two times.** | Example: `later_of(sunset, civil_dusk)` |
| `first_valid() requires at least 2 arguments` | **`first_valid()` needs at least two options.** | Example: `first_valid(solar(16.1, before_sunrise), civil_dawn)` |

#### 2.2.2 Error Display Design

**Current (Bad):**
```
┌─────────────────────────────────────────────────────────┐
│ ⊗ Validation Errors                                     │
│ • unexpected token after expression: solar              │
└─────────────────────────────────────────────────────────┘
```

**Proposed (Good):**
```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ Let's fix this                                       │
│                                                         │
│ Oops! `solar` needs parentheses to work.               │
│                                                         │
│ 💡 Try this pattern:                                    │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ solar(16.1, before_sunrise)                         │ │
│ │       ^^^^  ^^^^^^^^^^^^^^^                         │ │
│ │       │     └── direction (when)                    │ │
│ │       └── degrees (sun angle, 0-90)                │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Insert this example]  [Learn more about solar()]      │
└─────────────────────────────────────────────────────────┘
```

#### 2.2.3 Error Message Components

```typescript
interface HumanError {
  // What went wrong (friendly language)
  headline: string;

  // Why it matters / more context (optional)
  explanation?: string;

  // How to fix it
  suggestion: string;

  // A working example they can insert
  exampleCode?: string;

  // Link to relevant reference panel section
  referenceLink?: string;

  // Position in the formula to highlight
  highlightRange?: { start: number; end: number };
}
```

---

### Layer 3: Smart Placeholders

**Concept:** Replace abstract parameter names with real examples that teach by showing.

#### 2.3.1 Current vs. Proposed Placeholders

| Function | Current Placeholder | Proposed Placeholder |
|----------|--------------------|--------------------|
| `solar()` | `solar(degrees, direction)` | `solar(16.1, before_sunrise)` |
| `proportional_hours()` | `proportional_hours(hours, base)` | `proportional_hours(4, gra)` |
| `midpoint()` | `midpoint(a, b)` | `midpoint(sunrise, sunset)` |
| `earlier_of()` | `earlier_of(a, b)` | `earlier_of(sunrise, civil_dawn)` |
| `later_of()` | `later_of(a, b)` | `later_of(sunset, civil_dusk)` |
| `first_valid()` | `first_valid(a, b)` | `first_valid(solar(16.1, before_sunrise), civil_dawn)` |

#### 2.3.2 Placeholder Behavior

When user clicks a function in the reference panel:
1. **Insert real example** (not abstract placeholder)
2. **Select the first parameter** (so user can immediately type their value)
3. **Show contextual tooltip** for that parameter

**Example flow:**
```
1. User clicks "solar()" in reference panel
2. Editor inserts: solar(16.1, before_sunrise)
                         ^^^^
                         [selected, ready to replace]
3. Tooltip appears showing degrees options
4. User types "8.5" → solar(8.5, before_sunrise)
5. User presses Tab → cursor moves to direction, tooltip updates
6. User sees direction options, clicks "after_sunset"
7. Result: solar(8.5, after_sunset) ✓
```

---

## 3. Reference Panel Enhancements

### 3.1 Contextual Highlighting

When user is typing inside a function, highlight the relevant section in the reference panel:

```
┌─────────────────────────────────────────────────────────┐
│ 🔍 [Search...]                                          │
├─────────────────────────────────────────────────────────┤
│ ▾ FUNCTIONS                                             │
│   ┌─────────────────────────────────────────────────┐   │
│   │ 🔵 solar(degrees, direction)                    │   │ ← Highlighted
│   │    ├─ degrees: 0-90 (sun angle)                │   │
│   │    │  └─ YOU ARE HERE                          │   │ ← Indicator
│   │    └─ direction: before_sunrise, after_sunset...│   │
│   └─────────────────────────────────────────────────┘   │
│   ○ proportional_hours(hours, base)                     │
│   ○ midpoint(a, b)                                      │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Quick-Insert Chips for Common Values

Inside the reference panel, show clickable chips for the most common values:

```
┌─────────────────────────────────────────────────────────┐
│ 🔵 solar(degrees, direction)                            │
│    Calculate time when sun reaches angle                │
│                                                         │
│    Quick insert degrees:                                │
│    [8.5°] [11°] [16.1°] [18°]                          │
│                                                         │
│    Quick insert direction:                              │
│    [before_sunrise] [after_sunset]                     │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Implementation Specification

### 4.1 New Components

#### `ContextualTooltip.tsx`
```typescript
interface ContextualTooltipProps {
  // What parameter we're helping with
  context: 'solar_degrees' | 'solar_direction' | 'hours' | 'base' |
           'proportional_minutes' | 'proportional_direction' |
           'earlier_of' | 'later_of' | 'first_valid' | 'empty_editor';

  // Position relative to cursor
  position: { x: number; y: number };

  // Callback when user clicks an option
  onInsert: (value: string) => void;

  // Callback to dismiss
  onDismiss: () => void;
}
```

#### `HumanErrorDisplay.tsx`
```typescript
interface HumanErrorDisplayProps {
  error: HumanError;
  onInsertExample: (code: string) => void;
  onNavigateToReference: (section: string) => void;
}
```

### 4.2 Enhanced Autocomplete

Modify the existing CodeMirror autocomplete to:

1. **Detect function context** — Know when cursor is inside `solar(`, `proportional_hours(`, etc.
2. **Show parameter-specific completions** — Not just all keywords, but relevant ones
3. **Include value examples** — Show `16.1` as a completion for degrees, not just keywords

```typescript
// Enhanced completion for solar() degrees
{
  label: '16.1',
  type: 'value',
  info: 'Alos hashachar (Magen Avraham dawn)',
  detail: 'common value',
  boost: 10, // High priority
}
```

### 4.3 Error Message Mapping

Create a mapping layer between backend errors and human messages:

```typescript
// File: web/lib/error-humanizer.ts

interface ErrorPattern {
  // Regex to match backend error
  pattern: RegExp;

  // Function to generate human error
  humanize: (match: RegExpMatchArray, formula: string) => HumanError;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /unexpected token after expression: (\w+)/,
    humanize: (match, formula) => ({
      headline: `Oops! \`${match[1]}\` needs parentheses to work.`,
      suggestion: `Try: ${match[1]}(...)`,
      exampleCode: getExampleForFunction(match[1]),
    }),
  },
  {
    pattern: /solar\(\) requires 2 arguments.*got (\d+)/,
    humanize: (match) => ({
      headline: `Almost there! \`solar()\` needs two things.`,
      explanation: 'A number for degrees AND a direction.',
      suggestion: 'Example: solar(16.1, before_sunrise)',
      exampleCode: 'solar(16.1, before_sunrise)',
    }),
  },
  // ... more patterns
];

export function humanizeError(backendError: string, formula: string): HumanError {
  for (const pattern of ERROR_PATTERNS) {
    const match = backendError.match(pattern.pattern);
    if (match) {
      return pattern.humanize(match, formula);
    }
  }

  // Fallback for unknown errors
  return {
    headline: 'Something isn\'t quite right.',
    suggestion: 'Check your formula against the examples in the reference panel.',
  };
}
```

### 4.4 Backend Enhancement (Optional but Recommended)

The Go validator already has `addErrorWithSuggestion()` — ensure frontend receives and displays these:

```go
// Already exists in validator.go
v.addErrorWithSuggestion(n.Pos,
    fmt.Sprintf("solar() degrees must be between 0 and 90, got %.1f", numNode.Value),
    "Common values: 8.5° (Tzeis), 11.5° (Misheyakir), 16.1° (Alos/MGA)")
```

**Frontend should:**
1. Receive suggestion in API response
2. Display it in the `HumanErrorDisplay` component
3. Fall back to client-side `humanizeError()` if no suggestion provided

---

## 5. User Journey: Before & After

### Before (Current Experience)

```
1. Rabbi David wants to set misheyakir at 11° before sunrise
2. Opens Advanced DSL editor, sees empty field
3. Types: "sunrise solar 11 before"
4. Gets error: "unexpected token after expression: solar"
5. Confused — looks at error, doesn't understand "token"
6. Tries: "solar 11 before_sunrise"
7. Gets error: "unexpected token: 11"
8. Frustrated — gives up, asks for help or abandons feature
```

### After (With Inline Guidance)

```
1. Rabbi David wants to set misheyakir at 11° before sunrise
2. Opens Advanced DSL editor, sees placeholder: "Enter formula, e.g., sunrise - 72min"
3. Sees reference panel on right, notices "solar()" function
4. Clicks "solar(16.1, before_sunrise)" in reference panel
5. Formula inserted: solar(16.1, before_sunrise)
                            ^^^^
                            [selected]
6. Tooltip appears: "📐 Degrees: Common values: 8.5°, 11°, 16.1°..."
7. Types "11" → solar(11, before_sunrise)
8. Presses Tab → cursor moves to direction
9. Tooltip shows direction options, "before_sunrise" is already correct
10. Presses Enter → Validates successfully ✓
11. Result shows: "5:47:23 AM" — Rabbi David knows it worked!
12. Total time: 15 seconds. Zero confusion.
```

---

## 6. Accessibility Considerations

| Feature | Implementation |
|---------|----------------|
| Tooltip announcements | ARIA live regions announce tooltip content |
| Keyboard navigation | Arrow keys navigate tooltip options |
| Focus management | Focus returns to editor after tooltip selection |
| High contrast | Tooltips meet 4.5:1 contrast minimum |
| Screen reader | Error messages read as: "Error: [headline]. Suggestion: [suggestion]" |

---

## 7. Success Metrics

| Metric | Current State | Target |
|--------|---------------|--------|
| Time to valid formula (new user) | 3-5 minutes (with failures) | < 30 seconds |
| Error rate on first attempt | ~80% | < 20% |
| Users who give up | Unknown (high) | < 5% |
| Support tickets about formula syntax | Weekly | Near zero |
| User sentiment | "nightmare" | "this is actually easy!" |

---

## 8. Implementation Priority

### Phase 1: Human Error Messages (Highest Impact)
1. Create `error-humanizer.ts` mapping layer
2. Update `HumanErrorDisplay` component
3. Surface backend suggestions when available

### Phase 2: Smart Placeholders
1. Update reference panel to insert real examples
2. Auto-select first parameter on insert
3. Tab-to-next-parameter behavior

### Phase 3: Contextual Tooltips
1. Detect cursor context (which function, which parameter)
2. Create tooltip component with option chips
3. Position tooltips relative to cursor
4. Keyboard navigation support

### Phase 4: Reference Panel Enhancements
1. Contextual highlighting (show where user is)
2. Quick-insert chips for common values
3. "You are here" indicator

---

## Appendix A: Error Message Reference

Full mapping of all backend errors to human messages:

| Backend Error Pattern | Human Headline | Suggestion |
|----------------------|----------------|------------|
| `unexpected token after expression: X` | Oops! `X` needs parentheses to work. | Try: `X(...)` |
| `X() requires N arguments, got M` | Almost there! `X()` needs N things. | [Show parameter breakdown] |
| `X() degrees must be between 0 and 90` | N° is too high/low. | Common values: 8.5°, 16.1°, 18° |
| `invalid direction: X` | "X" isn't a recognized direction. | Choose: before_sunrise, after_sunset... |
| `unknown primitive: X` | I don't recognize "X". | Did you mean: [closest match]? |
| `unknown function: X` | "X" isn't a function I know. | Available functions: solar, proportional_hours... |
| `undefined reference: @X` | Can't find "@X" in your zmanim. | Available: [list first 5] |
| `cannot add two times` | You can't add times together. | To add minutes: `time + 30min` |
| `cannot multiply time values` | Times can't be multiplied. | To calculate proportional: use `proportional_hours()` |
| `circular reference` | This formula references itself! | Use a primitive or different reference. |
| `earlier_of() requires 2 arguments` | `earlier_of()` needs exactly two times. | earlier_of(sunrise, civil_dawn) |
| `later_of() requires 2 arguments` | `later_of()` needs exactly two times. | later_of(sunset, civil_dusk) |
| `first_valid() requires at least 2 arguments` | `first_valid()` needs at least two options. | first_valid(solar(...), fallback) |
| `first_valid(): all arguments failed` | None of the options could calculate. | Check your fallback values. |
| `invalid date literal: X` | "X" isn't a valid date format. | Use D-Mon format like 21-May, 1-Jan |

---

## Appendix B: Contextual Tooltip Content

### Empty Editor (after 2 seconds)
```
👋 Let's write a formula!

Quick start:
• sunrise - 72min (72 minutes before sunrise)
• solar(16.1, before_sunrise) (dawn at 16.1°)
• proportional_hours(4, gra) (end of 4th hour)
• earlier_of(sunrise, civil_dawn) (whichever comes first)

Or pick something from the reference panel →
```

### After Unknown Word (500ms)
```
🤔 I don't recognize "sunris"

Did you mean:
• sunrise
• sunset

Or check the Primitives section →
```

### After `first_valid(`
```
🔄 first_valid(primary, fallback, ...)

Returns first successful calculation. Great for high-latitude fallbacks.

Example:
• first_valid(solar(16.1, before_sunrise), solar_midnight)
  Try solar angle first, use midnight if it fails
```

### After `earlier_of(`
```
⏪ earlier_of(time1, time2)

Returns whichever time comes first chronologically.

Examples:
• earlier_of(sunrise, civil_dawn)
• earlier_of(@alos, sunrise - 72min)

Great for ensuring a time doesn't extend past a boundary.
```

### After `later_of(`
```
⏩ later_of(time1, time2)

Returns whichever time comes last chronologically.

Examples:
• later_of(sunset, civil_dusk)
• later_of(@tzeis, sunset + 18min)

Great for ensuring a time is at least a certain value.
```

### After `date >=` or `date <=`
```
📅 Date comparison

Use D-Mon format:
• 21-May (May 21st)
• 1-Jan (January 1st)
• 15-Sep (September 15th)

Example:
if (date >= 21-May && date <= 21-Jul) { ... }
```

---

_This specification was created through collaborative UX design facilitation, focused on the needs of non-technical community admins who deserve tools that teach rather than frustrate._
