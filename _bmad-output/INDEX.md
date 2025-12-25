# _bmad-output Directory Index

This directory contains analysis, restoration scripts, and documentation for the zmanim tag system.

## Latest: Publisher Tags Restoration (2025-12-25)

### Quick Start

**Status:** ✅ COMPLETE - 61 tag associations restored

**Read this first:**
- `RESTORATION_COMPLETE.md` - Executive summary and results

**For details:**
- `restoration-summary.md` - Comprehensive restoration report
- `tag-analysis.md` - Tag usage distribution and insights
- `publisher-tags-restoration.sql` - SQL script with analysis queries

### Key Results

- **Coverage improved:** 66.7% → 95.9%
- **Tags restored:** 61 associations
- **Publisher zmanim tagged:** 114 → 164
- **Remaining untagged:** 7 (publisher-specific, no master match)

---

## All Files

### Restoration & Analysis (Latest)

| File | Description | Size |
|------|-------------|------|
| `RESTORATION_COMPLETE.md` | Executive summary - START HERE | 6.0K |
| `restoration-summary.md` | Comprehensive restoration report | 8.1K |
| `tag-analysis.md` | Tag distribution and insights | 5.4K |
| `publisher-tags-restoration.sql` | SQL restoration script | 8.7K |

### Master Tags (Previous Work)

| File | Description | Size |
|------|-------------|------|
| `master-tags-restoration.sql` | Master zmanim tag restoration | 18K |
| `TAGGING_PATTERNS_REFERENCE.md` | Tag pattern documentation | 11K |

### Implementation Phases

| File | Description | Size |
|------|-------------|------|
| `PHASE-2-IMPLEMENTATION-SUMMARY.md` | Phase 2 summary | 7.7K |
| `PHASE-2-README.md` | Phase 2 documentation | 8.8K |
| `PHASE-3-UNUSED-TAGS-IMPLEMENTATION.md` | Unused tags cleanup | 6.4K |

### Planning & Audit

| File | Description | Size |
|------|-------------|------|
| `hebcal-tag-coverage-audit-plan.md` | HebCal coverage audit plan | 17K |
| `README.md` | Original directory readme | 6.2K |

---

## Quick Reference

### Database State (After Restoration)

```
Total publisher_zmanim: 171
  With tags: 164 (95.9%)
  Without tags: 7 (4.1%)

Total tag associations: 238
  Before restoration: 177
  Restored: 61

Publisher breakdown:
  Publisher 1 (Machzikei Hadass): 24/27 tagged (88.9%)
  Publisher 2 (Rabbi Ovadia Yosef): 140/144 tagged (97.2%)
```

### Tag Distribution

```
Top 5 tags:
  1. shita_mga (58) - 24.4%
  2. shita_gra (44) - 18.5%
  3. category_mincha (32) - 13.4%
  4. shita_geonim (23) - 9.7%
  5. category_shema (20) - 8.4%

By type:
  Shita tags: 164 (68.9%)
  Category tags: 71 (29.8%)
  Event tags: 3 (1.3%)
```

### Untagged Zmanim (Intentional)

7 publisher zmanim remain untagged due to no master match:
- Publisher 1: `misheyakir_bedieved`, `sunrise`, `sunset`
- Publisher 2: `shkia`, `sunrise`, `sunset`, `tzeis`

These are publisher-specific naming variations.

---

## Related Documentation

### Project Documentation
- `/home/daniel/repos/zmanim/docs/TAG-SYSTEM-REFERENCE.md`
- `/home/daniel/repos/zmanim/docs/architecture/tag-driven-events.md`
- `/home/daniel/repos/zmanim/docs/migration/eliminate-hardcoded-logic.md`

### Database Schema
- `/home/daniel/repos/zmanim/db/migrations/00000000000001_schema.sql`

### API Queries
- `/home/daniel/repos/zmanim/api/internal/db/queries/tag_events.sql`
- `/home/daniel/repos/zmanim/api/internal/db/queries/publisher_zmanim.sql`
- `/home/daniel/repos/zmanim/api/internal/db/queries/zmanim_tags.sql`

---

## Verification Commands

### Check Tag Coverage
```bash
source api/.env && psql "$DATABASE_URL" -c "
SELECT
    COUNT(DISTINCT pz.id) as total,
    COUNT(DISTINCT CASE WHEN pzt.publisher_zman_id IS NOT NULL THEN pz.id END) as tagged,
    ROUND(100.0 * COUNT(DISTINCT CASE WHEN pzt.publisher_zman_id IS NOT NULL THEN pz.id END) / COUNT(DISTINCT pz.id), 1) as pct
FROM publisher_zmanim pz
LEFT JOIN publisher_zman_tags pzt ON pzt.publisher_zman_id = pz.id
WHERE pz.deleted_at IS NULL;
"
```

### List Untagged Zmanim
```bash
source api/.env && psql "$DATABASE_URL" -c "
SELECT pz.id, pz.publisher_id, pz.zman_key, pz.english_name
FROM publisher_zmanim pz
WHERE pz.deleted_at IS NULL
  AND pz.id NOT IN (SELECT publisher_zman_id FROM publisher_zman_tags)
ORDER BY pz.publisher_id, pz.zman_key;
"
```

### Tag Distribution
```bash
source api/.env && psql "$DATABASE_URL" -c "
SELECT zt.tag_key, COUNT(*) as count
FROM publisher_zman_tags pzt
JOIN zman_tags zt ON zt.id = pzt.tag_id
GROUP BY zt.tag_key
ORDER BY count DESC
LIMIT 10;
"
```

---

## Changelog

### 2025-12-25: Publisher Tags Restoration
- Restored 61 tag associations
- Improved coverage from 66.7% to 95.9%
- Created comprehensive documentation
- Files: `RESTORATION_COMPLETE.md`, `restoration-summary.md`, `tag-analysis.md`, `publisher-tags-restoration.sql`

### Previous: Master Tags Work
- Master zmanim tag restoration
- Tag pattern documentation
- HebCal coverage audit planning

---

## Notes

- All restoration operations are **idempotent** - safe to re-run
- Tag restoration is **conservative** - only copies from master, never invents
- Remaining untagged zmanim are **intentional** - publisher-specific variants
- Tag system is **selective by design** - not all zmanim need tags

---

*Last updated: 2025-12-25*
