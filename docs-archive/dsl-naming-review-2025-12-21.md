# DSL Naming Review: Technical Jargon to Plain English
**Date:** 2025-12-21
**Author:** Claude (Language Analysis)
**Project:** Zmanim Platform
**Purpose:** Evaluate DSL naming for clarity and identify opportunities to replace technical jargon with plain English

---

## Executive Summary

### Philosophy Shift: From Programmer Comfort to User Clarity

The zmanim DSL currently serves two audiences:
1. **Technical users** (programmers, power users) who understand terms like "coalesce" and "proportional"
2. **Domain experts** (rabbis, community administrators) who understand Jewish law but may not know database terminology

This review evaluates each DSL component against the "grandma test": **Would a non-technical person understand this word?** The analysis balances clarity with practicality, recognizing that brevity matters and some traditional terms (like proper nouns) should be preserved.

### Key Findings

**GOOD NEWS:** ~65% of the DSL is already plain English or unavoidably technical
- Primitives: Mostly clear (sunrise, sunset, noon)
- Directions: Perfect plain English
- Bases: Proper nouns (unavoidable)
- Operators: Standard math symbols

**OPPORTUNITIES:** ~35% could benefit from clarity improvements
- Functions: 3 of 6 are technical jargon
- Some primitives use astronomical terminology that obscures meaning

### Approach

This document proposes an **alias-based migration** where:
- Old names remain valid (backward compatibility)
- New plain English names are added and promoted
- UI gradually shifts to showing new names first
- Documentation explains both during transition period

---

## 1. FUNCTIONS Analysis (6 total)

### 1.1 Function: `coalesce`

**Current Name:** `coalesce`
**Category:** Database terminology (SQL)
**Plain English?** NO - score 2/10
**Grandma Test:** "Coalesce means to come together or merge" - not intuitive for "use first valid value"

**What It Actually Does:**
Returns the first formula that successfully calculates, ignoring failures.

**Suggested Alternative:** `first_valid`
- Shorter than alternatives like `first_valid_time` or `try_in_order`
- Immediately clear what it does
- Natural reading: `first_valid(dawn_16deg, dawn_12deg, civil_dawn)`

**Example Migration:**
```
BEFORE: coalesce(solar(16.1, before_sunrise), civil_dawn)
AFTER:  first_valid(solar(16.1, before_sunrise), civil_dawn)
```

**Impact if Changed:**
- LOW: Function is already missing from UI (per gap analysis)
- Migration: Support both names, deprecate `coalesce` over 6-12 months
- Breaking formulas: Unknown (need query of publisher_zmanim table)

**Recommendation:** HIGH PRIORITY
- Add `first_valid` as primary name
- Keep `coalesce` as legacy alias
- UI shows `first_valid` in autocomplete (with note that `coalesce` also works)

---

### 1.2 Function: `midpoint`

**Current Name:** `midpoint`
**Category:** Mathematical term
**Plain English?** YES - score 9/10
**Grandma Test:** "The midpoint is the middle between two things" - clear!

**What It Actually Does:**
Calculates the exact middle time between two times.

**Analysis:**
This is already excellent plain English. "Midpoint" is a common word taught in elementary school geometry. No change needed.

**Alternative Considered:** `middle_of`
- Slightly more casual/conversational
- But "midpoint" is more precise and widely understood
- Not worth the migration effort

**Recommendation:** KEEP AS-IS
- Perfect example of technical term that's also plain English
- No action needed

---

### 1.3 Function: `proportional_hours`

**Current Name:** `proportional_hours`
**Category:** Mathematical terminology
**Plain English?** PARTIAL - score 6/10
**Grandma Test:** "Proportional means it scales with something" - somewhat clear, but doesn't explain the religious concept

**What It Actually Does:**
Divides the day into 12 equal parts (hours that expand/contract with day length). This is the Jewish concept of "shaos zmaniyos" (proportional hours).

**Religious Context:**
The halachic term is "sha'ah zmanis" (pl. "shaos zmaniyos") meaning "temporal hour" or "proportional hour". Most Jewish users would know this Hebrew term.

**Suggested Alternative:** `seasonal_hours`
- Emphasizes that hours change with seasons
- More concrete than "proportional"
- Natural: `seasonal_hours(3, gra)` = "3 seasonal hours using the GRA method"

**Alternative Considered:** `flexible_hours`, `scaling_hours`, `zmanis_hours`
- `flexible_hours` - too vague
- `scaling_hours` - still technical
- `zmanis_hours` - Hebrew term, not plain English

**Example Migration:**
```
BEFORE: proportional_hours(3, gra)
AFTER:  seasonal_hours(3, gra)
```

**Impact if Changed:**
- HIGH: This function is heavily used (Shema, Tefilla, Mincha times)
- Migration: MUST support both names indefinitely (alias approach)
- Breaking formulas: Potentially hundreds across all publishers

**Recommendation:** MEDIUM PRIORITY
- Add `seasonal_hours` as alias (equal status)
- UI shows both in autocomplete with preference for `seasonal_hours`
- Documentation explains both terms
- Consider `shaos_zmaniyos` as third alias for Hebrew-literate users
- NEVER deprecate `proportional_hours` (too widely used)

---

### 1.4 Function: `proportional_minutes`

**Current Name:** `proportional_minutes`
**Category:** Mathematical terminology
**Plain English?** PARTIAL - score 6/10
**Grandma Test:** Same as proportional_hours

**What It Actually Does:**
Scales a minute offset (like "72 minutes before sunrise") based on day length. In summer the offset is longer, in winter it's shorter.

**Suggested Alternative:** `seasonal_minutes`
- Matches `seasonal_hours` for consistency
- Emphasizes the scaling behavior
- Clear purpose: `seasonal_minutes(72, before_sunrise)`

**Alternative Considered:** `scaled_minutes`
- More technical than "seasonal"
- Doesn't convey the why (seasonal variation)

**Example Migration:**
```
BEFORE: proportional_minutes(72, before_sunrise)
AFTER:  seasonal_minutes(72, before_sunrise)
```

**Impact if Changed:**
- MEDIUM: Less common than proportional_hours but still used
- Migration: Alias approach (support both)
- Breaking formulas: Moderate impact

**Recommendation:** MEDIUM PRIORITY
- Add `seasonal_minutes` as alias
- Treat identically to proportional_hours decision
- Keep both names supported indefinitely

---

### 1.5 Function: `solar`

**Current Name:** `solar`
**Category:** Astronomical term
**Plain English?** PARTIAL - score 7/10
**Grandma Test:** "Solar relates to the sun" - understandable, but doesn't explain what it does

**What It Actually Does:**
Calculates when the sun is at a specific angle below (or above) the horizon.

**Suggested Alternative:** `sun_angle`
- More descriptive: tells you it's about the sun's angle
- Natural reading: `sun_angle(16.1, before_sunrise)`
- Still brief (2 syllables vs 2 syllables)

**Alternative Considered:**
- `angle` - too vague (angle of what?)
- `sun_position` - less clear that it's about degrees below horizon
- `horizon_angle` - doesn't emphasize the sun

**Example Migration:**
```
BEFORE: solar(16.1, before_sunrise)
AFTER:  sun_angle(16.1, before_sunrise)
```

**Impact if Changed:**
- HIGH: One of the most commonly used functions
- Migration: Alias approach required
- Breaking formulas: Potentially hundreds

**Recommendation:** LOW PRIORITY
- "Solar" is reasonably clear in context
- Native speakers understand "solar" = "related to the sun"
- Migration effort doesn't justify modest clarity gain
- Consider adding `sun_angle` as equal-status alias (don't deprecate either)
- Let users choose their preferred term

---

### 1.6 Function: `seasonal_solar`

**Current Name:** `seasonal_solar`
**Category:** Astronomical + Mathematical term
**Plain English?** PARTIAL - score 6/10
**Grandma Test:** "Seasonal solar" = something about the sun and seasons, but mechanism unclear

**What It Actually Does:**
Like `solar()` but applies seasonal scaling (calculates angle at equinox, then scales based on current day length). Used in Sephardic calculations per Rabbi Ovadia Yosef.

**Analysis:**
The name actually does a good job combining two concepts:
- "seasonal" = scales with season
- "solar" = sun angle calculation

**Suggested Alternative:** `seasonal_sun_angle`
- If we rename `solar` to `sun_angle`, this should match
- Otherwise, keep as-is for consistency

**Recommendation:** CONDITIONAL
- If `solar` → `sun_angle`, then `seasonal_solar` → `seasonal_sun_angle`
- Otherwise, KEEP AS-IS
- Name is already reasonably descriptive

---

## 2. PRIMITIVES Analysis (12 total)

### 2.1 Primitive: `sunrise`
**Plain English?** YES - score 10/10
**Recommendation:** KEEP - perfect

### 2.2 Primitive: `sunset`
**Plain English?** YES - score 10/10
**Recommendation:** KEEP - perfect

### 2.3 Primitive: `solar_noon`
**Plain English?** MOSTLY - score 8/10
**Analysis:** "Solar noon" is the standard astronomical term. "Noon" alone would be ambiguous (12:00 PM vs actual midday).
**Alternative Considered:** `midday`, `true_noon`, `sun_highest`
- `midday` - unclear if clock noon or solar noon
- `true_noon` - "true" is vague
- `sun_highest` - wordy, less standard
**Recommendation:** KEEP - "solar noon" is the accepted plain English term

### 2.4 Primitive: `solar_midnight`
**Plain English?** MOSTLY - score 8/10
**Analysis:** Same logic as solar_noon. Standard astronomical term.
**Recommendation:** KEEP - consistent with solar_noon

### 2.5 Primitive: `visible_sunrise`
**Plain English?** YES - score 9/10
**Analysis:** Clear that it's the sunrise you can see (vs geometric/calculated)
**Recommendation:** KEEP - descriptive and clear

### 2.6 Primitive: `visible_sunset`
**Plain English?** YES - score 9/10
**Recommendation:** KEEP - matches visible_sunrise

### 2.7 Primitive: `civil_dawn`
**Plain English?** NO - score 4/10
**Grandma Test:** "What does 'civil' mean here?" - obscure technical term from navigation

**What It Actually Means:**
The time when there's enough light for outdoor activities without artificial light. Called "civil" because it's when civil (daily civilian) activities can begin. Sun is 6 degrees below horizon.

**Suggested Alternative:** `first_light`
- Immediately understandable
- Poetic and accurate
- Natural: "earliest activity begins at first_light"

**Alternative Considered:**
- `outdoor_light` - descriptive but wordy
- `practical_dawn` - doesn't flow naturally
- `usable_light` - too vague

**Impact if Changed:**
- MEDIUM: Used in some formulas as fallback for high latitudes
- Migration: Alias approach

**Recommendation:** HIGH PRIORITY
- Add `first_light` as primary name
- Keep `civil_dawn` as technical alias
- UI promotes `first_light`

---

### 2.8 Primitive: `civil_dusk`
**Plain English?** NO - score 4/10
**Analysis:** Same issues as civil_dawn

**Suggested Alternative:** `last_light`
- Matches `first_light` for consistency
- Clear meaning: when outdoor activities must end

**Recommendation:** HIGH PRIORITY
- Add `last_light` as primary name
- Keep `civil_dusk` as alias
- Pair with civil_dawn → first_light change

---

### 2.9 Primitive: `nautical_dawn`
**Plain English?** NO - score 3/10
**Grandma Test:** "Nautical means related to ships/sailing" - confusing why it's in a Zmanim calculator

**What It Actually Means:**
Dawn as defined for marine navigation (horizon visible at sea). Sun is 12 degrees below horizon. Used in some zmanim calculations as intermediate twilight level.

**Suggested Alternative:** `deep_twilight_start`
- Descriptive: it's a deeper level of twilight than first_light
- "Start" indicates morning
- Removes naval terminology

**Alternative Considered:**
- `early_twilight` - ambiguous (earlier than what?)
- `horizon_dawn` - still technical
- `twilight_12deg` - too technical

**Impact if Changed:**
- LOW: Rarely used in formulas (mostly as reference point)
- Migration: Alias approach

**Recommendation:** MEDIUM PRIORITY
- Add `deep_twilight_start` as primary name
- Keep `nautical_dawn` for technical users
- Document that it's 12 degrees (vs 6 for first_light)

---

### 2.10 Primitive: `nautical_dusk`
**Plain English?** NO - score 3/10

**Suggested Alternative:** `deep_twilight_end`
- Matches `deep_twilight_start`
- Symmetrical naming

**Recommendation:** MEDIUM PRIORITY
- Pair with nautical_dawn renaming

---

### 2.11 Primitive: `astronomical_dawn`
**Plain English?** NO - score 3/10
**Grandma Test:** "Astronomical means related to astronomy/stars" - doesn't explain when or why

**What It Actually Means:**
The moment when astronomical observations become difficult due to sunlight. Sun is 18 degrees below horizon. Complete darkness ends. Used for stringent Alos calculations.

**Suggested Alternative:** `full_night_end`
- Clear: full/complete night is ending
- Accessible to non-technical users
- Symmetrical with `full_night_start`

**Alternative Considered:**
- `darkness_end` - less specific
- `night_twilight_start` - awkward
- `earliest_twilight` - doesn't explain it's the transition from full night

**Impact if Changed:**
- LOW: Rarely used directly (18-degree calculations usually specify angle)
- Migration: Alias approach

**Recommendation:** MEDIUM PRIORITY
- Add `full_night_end` as primary name
- Keep `astronomical_dawn` as technical alias

---

### 2.12 Primitive: `astronomical_dusk`
**Plain English?** NO - score 3/10

**Suggested Alternative:** `full_night_start`
- Matches `full_night_end`
- Clear that complete darkness begins

**Recommendation:** MEDIUM PRIORITY
- Pair with astronomical_dawn renaming

---

## 3. BASES Analysis (22 total)

### Philosophy: Proper Nouns Should Not Be Changed

**Analysis:**
The vast majority of bases are abbreviations or transliterations of rabbinic authorities:
- **GRA** = Gaon Rabbi Eliyahu (Vilna Gaon)
- **MGA** = Magen Avraham
- **Baal HaTanya** = Rabbi Schneur Zalman of Liadi
- **Ateret Torah** = Rabbi Ovadia Yosef's method

These are **proper nouns** in Jewish law. Changing them would:
1. Break connection to halachic sources
2. Confuse users who know these authorities
3. Lose important attribution

**Recommendation for ALL Bases:** KEEP AS-IS

### Individual Base Review

**3.1 Base: `gra`**
- **Plain English?** NO (acronym)
- **Recommendation:** KEEP - proper noun (Vilna Gaon)
- **UI Enhancement:** Tooltip should explain "GRA = Vilna Gaon (sunrise to sunset)"

**3.2-3.7 Bases: `mga`, `mga_60`, `mga_72`, `mga_90`, `mga_96`, `mga_120`**
- **Plain English?** NO (acronym + number)
- **Recommendation:** KEEP ALL - proper noun with variant indicators
- **UI Enhancement:** Tooltips explain "MGA = Magen Avraham; number = minutes before/after sunrise/sunset"

**3.8-3.10 Bases: `mga_72_zmanis`, `mga_90_zmanis`, `mga_96_zmanis`**
- **Plain English?** NO (acronym + Hebrew term)
- **Recommendation:** KEEP - "zmanis" is technical halachic term users should learn
- **UI Enhancement:** Tooltip: "zmanis = proportional/seasonal (scales with day length)"

**3.11-3.14 Bases: `mga_16_1`, `mga_18`, `mga_19_8`, `mga_26`**
- **Plain English?** NO (acronym + angle)
- **Recommendation:** KEEP - numbers indicate solar angles
- **UI Enhancement:** Tooltips explain each angle's significance

**3.15 Base: `baal_hatanya`**
- **Plain English?** NO (Hebrew proper noun)
- **Recommendation:** KEEP - proper noun (Chabad method)
- **UI Enhancement:** Tooltip: "Baal HaTanya = Rabbi Schneur Zalman (Chabad/Shulchan Aruch HaRav)"

**3.16 Base: `ateret_torah`**
- **Plain English?** NO (Hebrew)
- **Recommendation:** KEEP - proper noun (Sephardic method)
- **UI Enhancement:** Tooltip: "Ateret Torah = Rabbi Ovadia Yosef method (sunrise to tzais 40min)"

**3.17 Base: `custom`**
- **Plain English?** YES - score 10/10
- **Recommendation:** KEEP - perfect descriptor

---

## 4. DIRECTIONS Analysis (4 total)

**Category:** PERFECT PLAIN ENGLISH

### 4.1 Direction: `before_sunrise`
- **Plain English?** YES - score 10/10
- **Recommendation:** KEEP - model of clarity

### 4.2 Direction: `after_sunset`
- **Plain English?** YES - score 10/10
- **Recommendation:** KEEP

### 4.3 Direction: `before_noon`
- **Plain English?** YES - score 10/10
- **Recommendation:** KEEP

### 4.4 Direction: `after_noon`
- **Plain English?** YES - score 10/10
- **Recommendation:** KEEP

**Analysis:**
Directions are the gold standard for plain English naming. They serve as a model for what the rest of the DSL should aspire to:
- Immediately understandable
- No jargon
- Natural reading
- Unambiguous

---

## 5. CONDITION VARIABLES (8 total)

**Category:** MOSTLY PLAIN ENGLISH

### 5.1-5.2: `latitude`, `longitude`
- **Plain English?** YES - score 8/10
- **Analysis:** Standard geographic terms, widely understood
- **Recommendation:** KEEP

### 5.3: `day_length`
- **Plain English?** YES - score 10/10
- **Recommendation:** KEEP - perfect

### 5.4-5.7: `month`, `day`, `day_of_year`, `date`
- **Plain English?** YES - score 10/10
- **Recommendation:** KEEP ALL - perfect

### 5.8: `season`
- **Plain English?** YES - score 10/10
- **Recommendation:** KEEP - perfect

---

## 6. Priority Recommendations

### HIGH PRIORITY (Implement in Phase 1)

**1. Function: `coalesce` → `first_valid`**
- **Why:** Database jargon, confusing to non-programmers
- **Impact:** Currently missing from UI anyway (low breaking risk)
- **Migration:** Add `first_valid` as primary, keep `coalesce` as alias
- **Timeline:** Implement immediately

**2. Primitives: Twilight Terms**
- `civil_dawn` → `first_light`
- `civil_dusk` → `last_light`
- **Why:** "Civil" is obscure navigation jargon
- **Impact:** MEDIUM (used in fallback scenarios)
- **Migration:** Alias approach, UI promotes new names
- **Timeline:** Phase 1 (Month 1)

---

### MEDIUM PRIORITY (Implement in Phase 2)

**3. Primitives: Deep Twilight**
- `nautical_dawn` → `deep_twilight_start`
- `nautical_dusk` → `deep_twilight_end`
- `astronomical_dawn` → `full_night_end`
- `astronomical_dusk` → `full_night_start`
- **Why:** Navigation/astronomy jargon
- **Impact:** LOW (rarely used directly)
- **Migration:** Alias approach
- **Timeline:** Phase 2 (Month 2-3)

**4. Functions: Proportional → Seasonal**
- `proportional_hours` → `seasonal_hours` (alias)
- `proportional_minutes` → `seasonal_minutes` (alias)
- **Why:** "Seasonal" is more concrete than "proportional"
- **Impact:** HIGH usage (must maintain both names indefinitely)
- **Migration:** Equal-status aliases, never deprecate old names
- **Timeline:** Phase 2 (Month 2-3)

---

### LOW PRIORITY (Consider for Future)

**5. Function: `solar` → `sun_angle` (optional)**
- **Why:** Modest clarity improvement
- **Impact:** HIGH usage
- **Migration:** Equal-status alias only if demanded by users
- **Timeline:** Defer until user feedback indicates need

---

### NO CHANGE RECOMMENDED

**6. Keep As-Is:**
- All **BASES** (proper nouns - sacred terminology)
- All **DIRECTIONS** (already perfect plain English)
- All **CONDITION VARIABLES** (already clear)
- `midpoint` (already plain English)
- `solar_noon`, `solar_midnight` (standard terms)
- `visible_sunrise`, `visible_sunset` (clear descriptors)

---

## 7. Migration Strategy

### Approach: Dual-Name Alias System

Rather than breaking changes, implement a **graceful alias system**:

1. **Backend Changes:**
   - Modify lexer/parser to accept BOTH old and new names
   - Internal representation can use either (doesn't matter)
   - Validation accepts both

2. **UI Changes:**
   - Autocomplete shows **new name first**, old name second
   - Example: Type "first" → suggests `first_valid (or coalesce)`
   - Tooltips explain: "Also known as: coalesce"

3. **Documentation Changes:**
   - Primary examples use new names
   - Table showing old vs new names
   - Explain: "Both names work; use whichever is clearer to you"

4. **Timeline:**
   - Phase 1 (Month 1): Implement HIGH priority aliases
   - Phase 2 (Month 2-3): Implement MEDIUM priority aliases
   - Phase 3 (Month 4-6): Gather user feedback, refine
   - Phase 4 (Month 7+): Analytics on which names users prefer

### Example Implementation

**Parser Change (Go):**
```go
// In token.go, expand Functions map
var Functions = map[string]bool{
    "coalesce": true,
    "first_valid": true,  // Alias for coalesce
    "midpoint": true,
    // ... etc
}

// In executor, treat as identical
func (e *Executor) executeCoalesce(args []Expression) (Time, error) {
    // Works for both "coalesce" and "first_valid"
}
```

**UI Change (TypeScript):**
```typescript
// In dsl-reference-data.ts
{
  name: 'first_valid',
  aliases: ['coalesce'],
  category: 'function',
  description: 'Returns the first successfully calculated time',
  example: 'first_valid(solar(16.1, before_sunrise), sunrise - 72min)'
}
```

**Autocomplete Display:**
```
User types: "fir"

Suggestions:
  ► first_valid(expr1, expr2, ...)
    └─ Alias: coalesce
    └─ Returns first valid calculation
```

### No Deprecation for Heavily-Used Terms

**CRITICAL:** Never deprecate `proportional_hours`, `proportional_minutes`, or `solar`:
- Too widely deployed in production formulas
- Technical users may prefer these terms
- Maintain both names at equal status permanently
- Let natural selection determine which becomes dominant

---

## 8. Impact Analysis

### Breaking Formula Count Estimate

Query needed:
```sql
SELECT
  COUNT(*) as total_formulas,
  COUNT(*) FILTER (WHERE formula LIKE '%coalesce%') as uses_coalesce,
  COUNT(*) FILTER (WHERE formula LIKE '%proportional_hours%') as uses_prop_hours,
  COUNT(*) FILTER (WHERE formula LIKE '%proportional_minutes%') as uses_prop_min,
  COUNT(*) FILTER (WHERE formula LIKE '%civil_dawn%' OR formula LIKE '%civil_dusk%') as uses_civil,
  COUNT(*) FILTER (WHERE formula LIKE '%nautical_%' OR formula LIKE '%astronomical_%') as uses_astro
FROM publisher_zmanim
WHERE formula IS NOT NULL;
```

**Expected Results:**
- **coalesce:** 0-5 (missing from UI, rarely used)
- **proportional_hours:** 500-1000+ (extremely common)
- **proportional_minutes:** 100-200 (moderate)
- **civil_dawn/dusk:** 20-50 (fallback scenarios)
- **nautical/astronomical:** 5-15 (rare, mostly reference)

**Migration Risk:**
- **Alias approach = ZERO breaking changes**
- All existing formulas continue to work
- New formulas can use either naming scheme

---

## 9. User Experience Benefits

### Before: Technical Jargon DSL
```
# Confusing to non-programmers
coalesce(solar(16.1, before_sunrise), civil_dawn)
proportional_hours(3, gra)
astronomical_dusk
```

**User confusion:**
- "What does coalesce mean?"
- "Why 'civil' dawn?"
- "Astronomical? Is this about stars?"

### After: Plain English DSL (with aliases)
```
# Immediately clear
first_valid(sun_angle(16.1, before_sunrise), first_light)
seasonal_hours(3, gra)
full_night_start
```

**User understanding:**
- "Ah, it tries the first one, then the second if it fails"
- "First light makes sense - when light appears"
- "Full night starts - complete darkness"

### Power Users Can Still Use Technical Terms
```
# Both valid, user chooses preference:
first_valid(...)  OR  coalesce(...)
seasonal_hours(...)  OR  proportional_hours(...)
first_light  OR  civil_dawn
```

---

## 10. Documentation Updates Required

### Files to Update

**1. docs/dsl-complete-guide.md**
- Add "Naming: Old vs New" section
- Update all examples to use new names (with old names in parentheses)
- Add equivalence table

**2. docs/dsl-quick-reference.md** (if exists)
- Dual-column format: "Recommended Name | Also Known As"

**3. UI Tooltips** (web/lib/tooltip-content.ts)
- Update all function/primitive tooltips
- Include both names with "Also known as: ..."

**4. Inline Help** (web/lib/dsl-context-helper.ts)
- Autocomplete suggestions show new names first
- Include old names as searchable aliases

---

## 11. Testing Strategy

### Unit Tests
```go
// Test that both names work identically
func TestCoalesceAlias(t *testing.T) {
    tests := []struct{
        formula string
        shouldPass bool
    }{
        {"coalesce(sunrise, sunset)", true},
        {"first_valid(sunrise, sunset)", true},
    }
    // Both should parse and execute identically
}
```

### Integration Tests
- Verify UI shows both names in autocomplete
- Verify tooltips display aliases
- Verify parser accepts both naming schemes
- Verify validation works for both

### User Acceptance
- A/B test: show random users old vs new names
- Track which names users actually type
- Survey: "Which name is clearer?"

---

## 12. Rollout Plan

### Month 1: High Priority (No Breaking Changes)
- [ ] Add `first_valid` as alias for `coalesce`
- [ ] Add `first_light` / `last_light` as aliases for civil dawn/dusk
- [ ] Update UI autocomplete to show new names
- [ ] Update tooltips with "Also known as"
- [ ] Deploy to production (100% backward compatible)

### Month 2-3: Medium Priority
- [ ] Add `seasonal_hours` / `seasonal_minutes` as aliases
- [ ] Add deep twilight / full night aliases for nautical/astronomical
- [ ] Update documentation with equivalence tables
- [ ] Analytics: track which names users type
- [ ] User feedback survey

### Month 4-6: Refinement
- [ ] Analyze usage data: which names are users choosing?
- [ ] Adjust UI prominence based on preferences
- [ ] Consider adding `sun_angle` if requested
- [ ] Refine tooltips based on support questions

### Month 7+: Maintenance
- [ ] Monitor support tickets for confusion
- [ ] Iterate on descriptions
- [ ] Never deprecate old names (maintain both indefinitely)

---

## 13. Success Metrics

### Quantitative
1. **Adoption Rate:** % of new formulas using new vs old names
2. **Support Tickets:** Decrease in "what does X mean?" questions
3. **Autocomplete Usage:** Click-through rate on new vs old names
4. **Formula Errors:** No increase in parse errors (backward compatibility maintained)

### Qualitative
1. **User Surveys:** "Which name is clearer?" preference polls
2. **Onboarding:** New user comprehension of DSL during first use
3. **Documentation Feedback:** Reduced confusion in comments/questions

### Success Criteria
- **Zero breaking changes** (all old formulas still work)
- **50%+ adoption** of new names in new formulas within 6 months
- **25%+ reduction** in "terminology confusion" support tickets
- **Positive user feedback** (>70% prefer new names or are neutral)

---

## 14. Glossary: Old vs New Names

### Quick Reference Table

| Old Name | New Name | Type | Status |
|----------|----------|------|--------|
| `coalesce` | `first_valid` | Function | Alias (Phase 1) |
| `proportional_hours` | `seasonal_hours` | Function | Equal-status alias (Phase 2) |
| `proportional_minutes` | `seasonal_minutes` | Function | Equal-status alias (Phase 2) |
| `solar` | `sun_angle` | Function | Optional (future) |
| `seasonal_solar` | `seasonal_sun_angle` | Function | Conditional (if solar renamed) |
| `civil_dawn` | `first_light` | Primitive | Alias (Phase 1) |
| `civil_dusk` | `last_light` | Primitive | Alias (Phase 1) |
| `nautical_dawn` | `deep_twilight_start` | Primitive | Alias (Phase 2) |
| `nautical_dusk` | `deep_twilight_end` | Primitive | Alias (Phase 2) |
| `astronomical_dawn` | `full_night_end` | Primitive | Alias (Phase 2) |
| `astronomical_dusk` | `full_night_start` | Primitive | Alias (Phase 2) |
| `midpoint` | (keep) | Function | No change |
| All bases | (keep all) | Bases | No change (proper nouns) |
| All directions | (keep all) | Directions | No change (perfect) |
| All condition vars | (keep all) | Variables | No change (clear) |

---

## 15. Conclusion

### Summary of Findings

**Clarity Assessment:**
- **65% of DSL is already clear:** Directions, conditions, midpoint, visible times, proper nouns
- **35% has improvement opportunities:** 3 functions, 6 primitives

**Recommendations:**
- **Change 9 terms** (with aliases, not replacements)
- **Keep 37 terms** as-is (already clear or proper nouns)
- **Zero breaking changes** (alias migration strategy)

### Philosophy

This review advocates for **additive clarity, not destructive change**:
- Add plain English aliases for jargon terms
- Preserve technical terms for power users
- Let users choose their preferred terminology
- Measure adoption and iterate

### Next Steps

1. **Stakeholder Review:** Share this document with product, engineering, rabbinical advisors
2. **User Research:** Survey sample users on name preferences
3. **Implementation Plan:** Engineering estimate for Phase 1 changes
4. **Documentation Draft:** Update guide with dual naming
5. **Rollout:** Phase 1 launch with analytics

### Final Thought

The goal isn't to eliminate all technical terminology - it's to **make the DSL accessible to non-programmers while maintaining precision for experts**. By offering both names, we serve both audiences without compromise.

**Question for stakeholders:** Should we pursue the alias strategy, or is the current naming acceptable?

---

**Document prepared by:** Claude (Language Analysis Agent)
**Review requested from:** Product Team, Engineering, Tech Writer, Rabbinical Advisors
**Next review date:** After Phase 1 implementation (Month 2)
