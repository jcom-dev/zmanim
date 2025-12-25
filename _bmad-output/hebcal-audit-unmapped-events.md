# HebCal Unmapped Events - Gap Analysis Report

**Generated:** 2025-12-25
**Test Scope:** Hebrew Years 5775-5785 (10 years)
**Locations:** Jerusalem (Israel mode), Salford (Diaspora mode)

---

## Executive Summary

This report details all HebCal events that did not match any tag in the database.
Each unmapped event represents a potential gap in coverage that requires a decision:

- **Add New Tag** - Event should be tracked and displayed to users
- **Extend Pattern** - Existing tag pattern should be modified to capture variation
- **Intentional Ignore** - Event is not needed for the platform (e.g., Omer count, Torah readings)

**Total Unmapped Events:** 1

---

## Unmapped Events by Category

### Category: holiday (1 events)

#### 1. "Birkat Hachamah"

- **Category:** holiday
- **First Date Seen:** 2037-04-08
- **Occurrences:** 2 times across test period
- **Locations:** Both locations
- **Israel Mode Context:** Both Israel and Diaspora modes

**Recommendation:** Add new exact match tag

**SQL Example:**
```sql
INSERT INTO zman_tags (
    tag_key,
    display_name_hebrew,
    display_name_english_ashkenazi,
    display_name_english_sephardi,
    tag_type_id,
    hebcal_match_type,
    hebcal_match_string,
    is_visible
) VALUES (
    'birkat_hachamah',
    '[Hebrew Name]',
    'Birkat Hachamah',
    'Birkat Hachamah',
    [tag_type_id],  -- Choose appropriate type
    'exact',
    'Birkat Hachamah',
    true  -- Set to false if should be hidden
);
```

**Notes:** New holiday or special Shabbat that should be tracked. Update Hebrew name and tag type as appropriate.

---

## Analysis: Common Gap Patterns

### Why do these gaps exist?

### Event Title Variations

HebCal may return slightly different titles for the same event depending on:

- **Year variations:** Leap years, calendar edge cases
- **Location variations:** Jerusalem vs. diaspora (e.g., Shushan Purim)
- **Transliteration:** Ashkenazi vs. Sephardi spelling
- **Postponement:** Observed fast days when moved to Sunday

Each variation should either:
1. Be captured by existing regex patterns (group match)
2. Have its own exact match entry
3. Be documented as intentionally unmapped

---

## Action Items

For each unmapped event above:

1. Review the event details and recommendation
2. Decide on the appropriate action (add tag / extend pattern / ignore)
3. If adding or extending, run the provided SQL
4. Re-run the audit to verify 100% coverage

**Goal:** Zero unmapped events (all events either tagged or documented as intentional)

