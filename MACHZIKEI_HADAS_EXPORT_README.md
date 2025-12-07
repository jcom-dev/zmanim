# Machzikei Hadas Publisher Export

## Overview

This SQL script contains a complete export of the **Machzikei Hadass - Manchester** publisher data from the Zmanim Lab database.

## Contents

- **Publisher Record**: Machzikei Hadass - Manchester (dniasoff@gmail.com) ✅
- **Algorithms**: 1 algorithm (Manchester Machzikei Hadass Standard) ✅
- **Publisher Zmanim**: 27 zmanim definitions ✅
- **Coverage**: 2 geographic coverage areas (commented out - see below) ⚠️

## File Details

- **File**: `machzikei_hadas_export.sql`
- **Lines**: ~850
- **Active INSERT Statements**: 29 (publisher + algorithm + 27 zmanim)
- **Generated**: 2025-12-07

## Quick Start

### Prerequisites

1. Target database must have the same schema as source
2. Run all migrations first:
   ```bash
   psql -d target_db -f db/migrations/00000000000001_schema.sql
   psql -d target_db -f db/migrations/00000000000002_seed_data.sql
   ```

### Import

```bash
psql -d target_db -f machzikei_hadas_export.sql
```

Or with connection details:

```bash
psql -h hostname -U username -d database_name -f machzikei_hadas_export.sql
```

### What Gets Imported

✅ **Publisher record** (with email, location, timezone)
✅ **1 Algorithm** (Manchester Machzikei Hadass Standard)
✅ **27 Publisher Zmanim** (complete with formulas and descriptions)
⚠️ **Coverage** - Commented out (requires manual setup - see below)

## Coverage Setup (Required After Import)

The geographic coverage is **commented out** in the export because city/region IDs vary between databases.

### Option 1: Add Coverage via UI (Recommended)

After importing, use the publisher management interface to add coverage areas for Manchester, England.

### Option 2: Add Coverage via SQL

1. Find the correct geographic IDs in your database:

```sql
-- Find Manchester city
SELECT id, name, name_ascii 
FROM geo_cities 
WHERE name ILIKE '%manchester%' 
  AND EXISTS (
    SELECT 1 FROM geo_regions r 
    JOIN geo_countries c ON r.country_id = c.id 
    WHERE r.id = geo_cities.region_id 
      AND c.code = 'GB'
  );

-- Find England/Greater Manchester region
SELECT r.id, r.name, c.name as country
FROM geo_regions r
JOIN geo_countries c ON r.country_id = c.id
WHERE c.code = 'GB'
  AND (r.name ILIKE '%manchester%' OR r.name ILIKE '%england%');
```

2. Update the IDs in the export file (search for "Coverage: city" and "Coverage: region")
3. Uncomment the INSERT statements
4. Re-run the import

**Example:**
```sql
-- If Manchester city ID in your DB is 12345
INSERT INTO publisher_coverage (
    publisher_id, coverage_level_id, city_id, is_active, priority
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    (SELECT id FROM coverage_levels WHERE key = 'city'),
    12345,  -- Your Manchester city ID
    true,
    5
);
```

## Data Structure

### Publisher Zmanim (27 total)

**Essential Times (9):**
- Alos HaShachar (2 versions: 12° and 16.1°)
- Misheyakir
- Sunrise (HaNetz)
- Chatzos (Midday)
- Chatzos Layla (Midnight)
- Sunset (Shkiah)
- Tzais HaKochavim (7.08°)
- Tzais Rabbeinu Tam (72min)
- Candle Lighting

**Shema Times (5):**
- Sof Zman Shema GRA
- Sof Zman Shema MGA (Manchester custom: 12° to 7.08°)
- Sof Zman Shema MGA (16.1° stringency)
- Sof Zman Shema MGA (72min standard)
- Sof Zman Shema (3 hours fixed)

**Tefila Times (2):**
- Sof Zman Tefila GRA
- Sof Zman Tefila MGA (Manchester custom)

**Mincha Times (2):**
- Mincha Gedola
- Mincha Ketana

**Plag HaMincha (3):**
- Plag (Levush/GRA)
- Plag (MA/72min)
- Plag (Terumas HaDeshen - Manchester custom)

**Special Times (6):**
- Fast Begins
- Fast Ends
- Shabbos Ends (Motzei Shabbos)
- Alos 72min (optional)
- Alos 90min (optional)
- Alos for Aravos (Shemini Atzeres - custom)

### Manchester-Specific Calculations

The Machzikei Hadas calculations include several custom formulas based on 80 years of community practice:

- **Dawn 2 (Primary)**: `solar(12, before_sunrise)` - Per Minchas Yitzchak 9:9
- **MGA Day Definition**: 12° before sunrise to 7.08° after sunset
- **Polar Summer Handling**: Conditional logic for May-July at latitudes > 50°
- **Custom Proportional Hours**: Using Manchester day definition

## Schema Dependencies

Required tables:
- `publishers` (unique on email)
- `publisher_statuses` (with 'active' key)
- `algorithms`
- `publisher_zmanim` (unique on publisher_id, zman_key)
- `zman_source_types` (keys: master, custom, linked, registry)
- `master_zmanim_registry`
- `coverage_levels` (keys: city, region, country, district, continent)
- `publisher_coverage`

Optional (for coverage):
- `geo_cities`
- `geo_regions`
- `geo_countries`

## Conflict Resolution

- **Publisher**: `ON CONFLICT DO UPDATE` - Updates if email exists
- **Algorithm**: No conflict handling - will fail if duplicate
- **Zmanim**: `ON CONFLICT DO UPDATE` - Updates formula/names if (publisher_id, zman_key) exists
- **Coverage**: `ON CONFLICT DO NOTHING` - Skips if exists (when uncommented)

## Troubleshooting

### Import Succeeds but No Coverage

This is **expected and normal**. The coverage section is commented out to prevent FK constraint errors. Add coverage manually after import (see "Coverage Setup" above).

### Publisher Already Exists

The script will **update** the existing publisher record with the data from this export.

### Algorithm Duplicate Error

```sql
-- Check if algorithm exists
SELECT id, name FROM algorithms 
WHERE publisher_id = (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com');

-- If it exists and you want to replace it, delete first:
DELETE FROM algorithms 
WHERE publisher_id = (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com');
```

### Master Zman Links Missing

Some zmanim reference master_zmanim_registry entries. If you get NULL master_zman_id:

```sql
-- Check which master zmanim exist
SELECT zman_key FROM master_zmanim_registry 
WHERE zman_key IN ('alos_hashachar', 'sunrise', 'sunset', 'chatzos');

-- If missing, ensure you ran the seed migration
\i db/migrations/00000000000002_seed_data.sql
```

### Source Type Not Found

```sql
-- Verify source types exist
SELECT * FROM zman_source_types;

-- Should have: master, custom, linked, registry
```

## Transaction Safety

✅ All operations are wrapped in a `BEGIN/COMMIT` transaction
✅ If ANY error occurs, **everything** rolls back
✅ Your database remains unchanged on failure
✅ Safe to re-run after fixing errors

## What This Export Does NOT Include

- ❌ Publisher users/permissions
- ❌ Publisher invitations
- ❌ Publisher onboarding state
- ❌ Algorithm version history
- ❌ Publisher zman versions
- ❌ Publisher snapshots
- ❌ Audit logs
- ❌ Geographic data (cities, regions, countries)

## License & Attribution

This export contains the calculation methods for **Machzikei Hadass Manchester** community:
- Based on nearly 80 years of community practice
- Follows rulings of Minchas Yitzchak 9:9
- Custom MGA calculations using 12° dawn and 7.08° nightfall
- Special handling for Northern European latitudes

## Support

For questions about:
- **This export**: Contact Zmanim Lab development team
- **Calculations**: Contact Machzikei Hadass Manchester (dniasoff@gmail.com)
- **Import issues**: Check troubleshooting section above or create an issue

---

**Last Updated**: 2025-12-07
**Export Version**: 1.0
