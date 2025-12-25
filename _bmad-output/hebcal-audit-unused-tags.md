# HebCal Tag Coverage Audit - Unused Tags Report (Reverse Gap)

**Generated:** 2025-12-25
**Purpose:** Identify tags with HebCal mappings that NEVER matched any event

---

## Summary

- **Total HebCal-Mappable Tags:** 62
- **Tags Matched:** 58 (93.5%)
- **Tags Never Matched:** 4 (6.5%)

---

## Unused Tags by Match Type

### category Match (4 tags)

#### `hebcal_candles`

- **Display Name:** Candle Lighting
- **Match Type:** category
- **Match Category:** `candles`

**Recommendation:**
Verify HebCal category `candles` exists. Check if HebCal still uses this category in their API responses.

#### `hebcal_havdalah`

- **Display Name:** Havdalah
- **Match Type:** category
- **Match Category:** `havdalah`

**Recommendation:**
Verify HebCal category `havdalah` exists. Check if HebCal still uses this category in their API responses.

#### `hebcal_mevarchim`

- **Display Name:** Mevarchim HaChodesh
- **Match Type:** category
- **Match Category:** `mevarchim`

**Recommendation:**
Verify HebCal category `mevarchim` exists. Check if HebCal still uses this category in their API responses.

#### `hebcal_parashat`

- **Display Name:** Parashas HaShavua
- **Match Type:** category
- **Match Category:** `parashat`

**Recommendation:**
Verify HebCal category `parashat` exists. Check if HebCal still uses this category in their API responses.

---

## General Recommendations

For each unused tag, consider one of the following actions:

1. **Verify Pattern** - Check if the HebCal event name has changed
2. **Remove Mapping** - If the event is obsolete or not used by HebCal
3. **Mark as Rare** - Some events only occur in specific years (e.g., leap year events)
4. **Check Location** - Some events may be Israel-only or diaspora-only

To verify a tag pattern:
```sql
-- Check current mapping
SELECT tag_key, hebcal_match_type, hebcal_match_string, hebcal_match_pattern, hebcal_match_category
FROM zman_tags
WHERE tag_key = 'tag_name';

-- Remove mapping if obsolete
UPDATE zman_tags
SET hebcal_match_type = NULL,
    hebcal_match_string = NULL,
    hebcal_match_pattern = NULL,
    hebcal_match_category = NULL
WHERE tag_key = 'tag_name';
```

