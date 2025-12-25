# HebCal Tag Coverage - Actionable Recommendations

**Generated:** 2025-12-25
**Purpose:** SQL statements to fix unmapped events and investigate unused tags

---

## HIGH PRIORITY: Unmapped Events Requiring Action

_No unmapped events found. All HebCal events are covered!_

---

## MEDIUM PRIORITY: Pattern Extensions

_No medium priority recommendations._

---

## LOW PRIORITY: Review & Document

_No low priority items._

---

## UNUSED TAGS: Investigate Why No Matches

These tags exist in the database but were never matched during the audit.
Verify the patterns are correct or consider removing if obsolete.

### Tag: `hebcal_candles`

**Display Name:** הדלקת נרות (Candle Lighting)  
**Match Type:** category  
**Match Category:** candles  
**Hidden:** true  

**Recommendation:**  
- Verify the pattern is correct by checking HebCal API documentation
- This tag may be for rare events not occurring in the 10-year test window (5775-5785)
- Consider testing with a longer date range if this is a known event

```sql
-- If obsolete, consider removing:
-- DELETE FROM zman_tags WHERE tag_key = 'hebcal_candles';
```

---

### Tag: `hebcal_havdalah`

**Display Name:** הבדלה (Havdalah)  
**Match Type:** category  
**Match Category:** havdalah  
**Hidden:** true  

**Recommendation:**  
- Verify the pattern is correct by checking HebCal API documentation
- This tag may be for rare events not occurring in the 10-year test window (5775-5785)
- Consider testing with a longer date range if this is a known event

```sql
-- If obsolete, consider removing:
-- DELETE FROM zman_tags WHERE tag_key = 'hebcal_havdalah';
```

---

### Tag: `hebcal_mevarchim`

**Display Name:** מברכים חודש (Mevarchim HaChodesh)  
**Match Type:** category  
**Match Category:** mevarchim  
**Hidden:** true  

**Recommendation:**  
- Verify the pattern is correct by checking HebCal API documentation
- This tag may be for rare events not occurring in the 10-year test window (5775-5785)
- Consider testing with a longer date range if this is a known event

```sql
-- If obsolete, consider removing:
-- DELETE FROM zman_tags WHERE tag_key = 'hebcal_mevarchim';
```

---

### Tag: `hebcal_parashat`

**Display Name:** פרשת השבוע (Parashas HaShavua)  
**Match Type:** category  
**Match Category:** parashat  
**Hidden:** true  

**Recommendation:**  
- Verify the pattern is correct by checking HebCal API documentation
- This tag may be for rare events not occurring in the 10-year test window (5775-5785)
- Consider testing with a longer date range if this is a known event

```sql
-- If obsolete, consider removing:
-- DELETE FROM zman_tags WHERE tag_key = 'hebcal_parashat';
```

---

---

## Summary

- **Unmapped Events:** 0
- **Unused Tags:** 4

**Next Steps:**
1. Review HIGH PRIORITY items and run SQL fixes
2. Test changes with `./scripts/run-hebcal-matching-audit.sh`
3. Investigate UNUSED TAGS to verify patterns
4. Document any intentional ignores in this file
