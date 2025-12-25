# SQL Validation Queries for HebCal Event Coverage

## Overview
These queries help validate that database patterns in `tag_event_mappings` cover all possible HebCal events.

## 1. Check Coverage Statistics

```sql
-- Summary of tag event mappings
SELECT
    COUNT(*) as total_mappings,
    COUNT(DISTINCT zman_tag_id) as unique_tags,
    COUNT(DISTINCT event_name_pattern) as unique_patterns
FROM tag_event_mappings;
```

## 2. List All Event Patterns by Tag

```sql
-- View all event patterns grouped by tag
SELECT
    zt.tag_key,
    zt.name_english,
    tem.event_name_pattern,
    tem.priority
FROM tag_event_mappings tem
JOIN zman_tags zt ON zt.id = tem.zman_tag_id
ORDER BY zt.tag_key, tem.priority DESC, tem.event_name_pattern;
```

## 3. Find Tags Without Event Mappings

```sql
-- Tags that have no event mappings (orphaned tags)
SELECT
    zt.id,
    zt.tag_key,
    zt.name_english,
    zt.tag_type
FROM zman_tags zt
LEFT JOIN tag_event_mappings tem ON tem.zman_tag_id = zt.id
WHERE tem.id IS NULL
  AND zt.tag_type IN ('event', 'yomtov', 'fast', 'special_shabbat', 'rosh_chodesh', 'minor_holiday')
ORDER BY zt.tag_key;
```

## 4. Check for Duplicate or Overlapping Patterns

```sql
-- Find potential duplicate patterns (same pattern, different tags)
SELECT
    event_name_pattern,
    COUNT(*) as mapping_count,
    STRING_AGG(zt.tag_key, ', ' ORDER BY zt.tag_key) as tags
FROM tag_event_mappings tem
JOIN zman_tags zt ON zt.id = tem.zman_tag_id
GROUP BY event_name_pattern
HAVING COUNT(*) > 1
ORDER BY mapping_count DESC, event_name_pattern;
```

## 5. Validate Pattern Syntax

```sql
-- Check for patterns that might be malformed
SELECT
    zt.tag_key,
    tem.event_name_pattern,
    CASE
        WHEN tem.event_name_pattern IS NULL THEN 'NULL pattern'
        WHEN tem.event_name_pattern = '' THEN 'Empty pattern'
        WHEN tem.event_name_pattern LIKE '%  %' THEN 'Double space'
        WHEN tem.event_name_pattern != TRIM(tem.event_name_pattern) THEN 'Leading/trailing space'
        WHEN tem.event_name_pattern LIKE '% %' AND tem.event_name_pattern NOT LIKE '%''%' THEN 'Check spacing'
        ELSE 'OK'
    END as validation_status
FROM tag_event_mappings tem
JOIN zman_tags zt ON zt.id = tem.zman_tag_id
WHERE
    tem.event_name_pattern IS NULL
    OR tem.event_name_pattern = ''
    OR tem.event_name_pattern LIKE '%  %'
    OR tem.event_name_pattern != TRIM(tem.event_name_pattern)
ORDER BY validation_status, zt.tag_key;
```

## 6. Major Holidays Coverage Check

```sql
-- Verify major holidays are mapped
WITH expected_holidays AS (
    SELECT unnest(ARRAY[
        'Rosh Hashana%',
        'Yom Kippur',
        'Sukkot%',
        'Shmini Atzeret',
        'Simchat Torah',
        'Chanukah%',
        'Pesach%',
        'Shavuot%',
        'Purim',
        'Tish''a B''Av'
    ]) as holiday_pattern
)
SELECT
    eh.holiday_pattern,
    COALESCE(zt.tag_key, 'NOT MAPPED') as tag_key,
    tem.event_name_pattern
FROM expected_holidays eh
LEFT JOIN tag_event_mappings tem
    ON eh.holiday_pattern = tem.event_name_pattern
    OR tem.event_name_pattern LIKE eh.holiday_pattern
LEFT JOIN zman_tags zt ON zt.id = tem.zman_tag_id
ORDER BY eh.holiday_pattern;
```

## 7. Fast Days Coverage Check

```sql
-- Verify all fasts are mapped
WITH expected_fasts AS (
    SELECT unnest(ARRAY[
        'Yom Kippur',
        'Tish''a B''Av',
        'Tzom Gedaliah',
        'Asara B''Tevet',
        'Ta''anit Esther',
        'Tzom Tammuz',
        'Ta''anit Bechorot'
    ]) as fast_name
)
SELECT
    ef.fast_name,
    COALESCE(zt.tag_key, 'NOT MAPPED') as tag_key,
    zt.tag_type,
    tem.event_name_pattern
FROM expected_fasts ef
LEFT JOIN tag_event_mappings tem ON tem.event_name_pattern = ef.fast_name
LEFT JOIN zman_tags zt ON zt.id = tem.zman_tag_id
ORDER BY ef.fast_name;
```

## 8. Special Shabbatot Coverage Check

```sql
-- Verify special Shabbatot are mapped
WITH expected_shabbatot AS (
    SELECT unnest(ARRAY[
        'Shabbat Shekalim',
        'Shabbat Zachor',
        'Shabbat Parah',
        'Shabbat HaChodesh',
        'Shabbat HaGadol',
        'Shabbat Chazon',
        'Shabbat Nachamu',
        'Shabbat Shuva',
        'Shabbat Shirah'
    ]) as shabbat_name
)
SELECT
    es.shabbat_name,
    COALESCE(zt.tag_key, 'NOT MAPPED') as tag_key,
    tem.event_name_pattern
FROM expected_shabbatot es
LEFT JOIN tag_event_mappings tem ON tem.event_name_pattern = es.shabbat_name
LEFT JOIN zman_tags zt ON zt.id = tem.zman_tag_id
ORDER BY es.shabbat_name;
```

## 9. Erev Events Coverage

```sql
-- Check for Erev event patterns
SELECT
    zt.tag_key,
    zt.name_english,
    tem.event_name_pattern
FROM tag_event_mappings tem
JOIN zman_tags zt ON zt.id = tem.zman_tag_id
WHERE tem.event_name_pattern LIKE 'Erev%'
ORDER BY tem.event_name_pattern;
```

## 10. Pattern Priority Analysis

```sql
-- Analyze priority distribution to ensure proper ordering
SELECT
    priority,
    COUNT(*) as pattern_count,
    STRING_AGG(DISTINCT event_name_pattern, ', ' ORDER BY event_name_pattern) as patterns
FROM tag_event_mappings
GROUP BY priority
ORDER BY priority DESC;
```

## 11. Tag Type Distribution

```sql
-- Distribution of tags by type
SELECT
    zt.tag_type,
    COUNT(DISTINCT zt.id) as tag_count,
    COUNT(tem.id) as mapping_count,
    ROUND(COUNT(tem.id)::numeric / NULLIF(COUNT(DISTINCT zt.id), 0), 2) as avg_mappings_per_tag
FROM zman_tags zt
LEFT JOIN tag_event_mappings tem ON tem.zman_tag_id = zt.id
WHERE zt.tag_type IN ('event', 'yomtov', 'fast', 'special_shabbat', 'rosh_chodesh', 'minor_holiday')
GROUP BY zt.tag_type
ORDER BY tag_count DESC;
```

## 12. Check for Unmapped Chol HaMoed Days

```sql
-- Ensure Chol HaMoed is properly mapped
SELECT
    tem.event_name_pattern,
    zt.tag_key,
    zt.name_english
FROM tag_event_mappings tem
JOIN zman_tags zt ON zt.id = tem.zman_tag_id
WHERE tem.event_name_pattern LIKE '%CH''M%'
   OR tem.event_name_pattern LIKE '%Chol ha-Moed%'
ORDER BY tem.event_name_pattern;
```

## 13. Wildcard Pattern Analysis

```sql
-- Analyze wildcard usage
SELECT
    CASE
        WHEN event_name_pattern LIKE '%\%%' THEN 'Has wildcard'
        ELSE 'Exact match'
    END as pattern_type,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage
FROM tag_event_mappings
GROUP BY pattern_type
ORDER BY count DESC;
```

## 14. Find Potential Coverage Gaps

```sql
-- This query helps identify common words in event names that might not be covered
-- Run this after collecting actual HebCal event names
SELECT
    word,
    COUNT(*) as occurrences
FROM (
    SELECT unnest(string_to_array(event_name_pattern, ' ')) as word
    FROM tag_event_mappings
) words
GROUP BY word
HAVING LENGTH(word) > 2
ORDER BY occurrences DESC
LIMIT 30;
```

## 15. Cross-Reference Visibility Flags

```sql
-- Check that tags with event mappings have appropriate visibility settings
SELECT
    zt.tag_key,
    zt.name_english,
    zt.visibility_mode,
    zt.visible_on_weekday,
    zt.visible_on_shabbat,
    zt.visible_on_yomtov,
    COUNT(tem.id) as event_mapping_count
FROM zman_tags zt
JOIN tag_event_mappings tem ON tem.zman_tag_id = zt.id
GROUP BY zt.id, zt.tag_key, zt.name_english, zt.visibility_mode,
         zt.visible_on_weekday, zt.visible_on_shabbat, zt.visible_on_yomtov
HAVING
    (zt.visibility_mode = 'always_visible')
    OR (zt.visible_on_weekday = false AND zt.visible_on_shabbat = false AND zt.visible_on_yomtov = false)
ORDER BY zt.tag_key;
```

## Usage Instructions

1. **Initial Coverage Check**: Run queries 1, 2, 6, 7, 8 to get baseline coverage
2. **Find Gaps**: Run queries 3, 9, 12 to identify missing mappings
3. **Validate Quality**: Run queries 4, 5, 10, 13 to check pattern quality
4. **Ongoing Monitoring**: Use query 1 regularly to track coverage percentage
5. **After Adding Events**: Run query 14 to identify new patterns to map

## Expected Coverage Goals

- **Major Holidays**: 100% (all Yom Tov days)
- **Fast Days**: 100% (all 6 major/minor fasts)
- **Special Shabbatot**: 100% (all 9 special Shabbatot)
- **Rosh Chodesh**: 100% (pattern-based)
- **Minor Holidays**: 95%+ (Chanukah, Purim, etc.)
- **Informational**: 90%+ (Omer, Sefirah, etc.)

## Automated Testing

For continuous validation, combine these SQL queries with the Go test suite:
- Run `TestEventCoverage` to validate against hebcal-go library
- Use these SQL queries to verify database integrity
- Cross-reference results to ensure 100% coverage
