# Lunar Zmanim Module - Design Proposal

**Status:** Proposal
**Date:** 2025-12-03
**Author:** Claude (AI Assistant)

## Overview

A separate module for lunar-based Jewish observances, parallel to but independent from the solar zmanim system. Publishers can customize which opinions they endorse and how they're presented to their subscribers.

---

## Navigation Structure

```
┌─────────────────────────────────────────────────────────┐
│  Shtetl Zmanim                                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Daily Zmanim]  [Lunar Calendar]  [My Publishers]     │
│       ↑                 ↑                               │
│   Solar (existing)   Lunar (new)                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Why Separation Makes Sense

| Aspect | Solar Zmanim | Lunar Zmanim |
|--------|-------------|--------------|
| **Calculation basis** | Sun position + location | Moon phase (global) |
| **Location dependency** | Critical (lat/long/elevation) | None (Jerusalem-based molad) |
| **Output type** | Time of day | Date/time range |
| **Frequency** | Daily | Monthly |
| **Publisher customization** | Heavy (many opinions per zman) | Light (few major opinions) |
| **UI pattern** | Daily schedule list | Monthly calendar overlay |
| **DSL complexity** | Complex (conditions, references) | Simple (offsets from molad) |

---

## Data Model

### Master Lunar Registry (Admin-managed, like `master_zmanim_registry`)

```sql
CREATE TABLE master_lunar_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    lunar_key VARCHAR(100) UNIQUE NOT NULL,  -- 'kiddush_levana', 'rosh_chodesh', 'molad'
    canonical_hebrew_name VARCHAR(255) NOT NULL,
    canonical_english_name VARCHAR(255) NOT NULL,
    transliteration VARCHAR(255),

    -- Classification
    lunar_category VARCHAR(50) NOT NULL,  -- 'monthly_observance', 'announcement', 'calculation'
    output_type VARCHAR(20) NOT NULL,     -- 'time_range', 'date', 'instant', 'announcement'

    -- Metadata
    description TEXT,
    halachic_source TEXT,
    is_core BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data
INSERT INTO master_lunar_registry (lunar_key, canonical_hebrew_name, canonical_english_name, lunar_category, output_type) VALUES
('molad', 'מולד', 'Molad', 'announcement', 'announcement'),
('kiddush_levana', 'קידוש לבנה', 'Kiddush Levana', 'monthly_observance', 'time_range'),
('rosh_chodesh', 'ראש חודש', 'Rosh Chodesh', 'monthly_observance', 'date'),
('shabbos_mevorchim', 'שבת מברכים', 'Shabbos Mevorchim', 'announcement', 'date');
```

### Lunar Opinions Registry (The different shitos)

```sql
CREATE TABLE lunar_opinion_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Links to master lunar item
    master_lunar_id UUID NOT NULL REFERENCES master_lunar_registry(id),

    -- Opinion identity
    opinion_key VARCHAR(100) NOT NULL,  -- 'mechaber_3_days', 'rema_7_days', 'maharil_half_cycle'
    opinion_hebrew_name VARCHAR(255) NOT NULL,
    opinion_english_name VARCHAR(255) NOT NULL,

    -- Calculation parameters (JSON for flexibility)
    calculation_params JSONB NOT NULL,
    /*
    For Kiddush Levana earliest:
    {"type": "offset_from_molad", "offset_days": 3}
    {"type": "offset_from_molad", "offset_days": 7}

    For Kiddush Levana latest:
    {"type": "offset_from_molad", "offset_days": 15}
    {"type": "half_lunar_cycle"}  -- 14d 18h 22m 1ch
    */

    -- Metadata
    halachic_source TEXT,           -- 'Shulchan Aruch OC 426:4'
    posek VARCHAR(255),             -- 'Mechaber', 'Rema', 'Maharil'
    community_tradition VARCHAR(50), -- 'sephardic', 'ashkenazi', 'universal'
    is_default BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(master_lunar_id, opinion_key)
);

-- Seed opinions for Kiddush Levana
INSERT INTO lunar_opinion_registry (master_lunar_id, opinion_key, opinion_hebrew_name, opinion_english_name, calculation_params, posek, community_tradition) VALUES
-- Earliest times
((SELECT id FROM master_lunar_registry WHERE lunar_key = 'kiddush_levana'),
 'earliest_3_days', 'ג'' ימים', '3 Days (Mechaber)',
 '{"type": "earliest", "method": "offset_from_molad", "offset_days": 3}',
 'Mechaber', 'sephardic'),

((SELECT id FROM master_lunar_registry WHERE lunar_key = 'kiddush_levana'),
 'earliest_7_days', 'ז'' ימים', '7 Days (Rema)',
 '{"type": "earliest", "method": "offset_from_molad", "offset_days": 7}',
 'Rema', 'ashkenazi'),

-- Latest times
((SELECT id FROM master_lunar_registry WHERE lunar_key = 'kiddush_levana'),
 'latest_half_cycle', 'חצי מחזור (מהרי''ל)', 'Half Cycle (Maharil)',
 '{"type": "latest", "method": "half_lunar_cycle"}',
 'Maharil', 'ashkenazi'),

((SELECT id FROM master_lunar_registry WHERE lunar_key = 'kiddush_levana'),
 'latest_15_days', 'ט''ו ימים', '15 Days (Shulchan Aruch)',
 '{"type": "latest", "method": "offset_from_molad", "offset_days": 15}',
 'Mechaber', 'universal');
```

### Publisher Lunar Settings (Publisher's choices)

```sql
CREATE TABLE publisher_lunar_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID NOT NULL REFERENCES publishers(id),
    master_lunar_id UUID NOT NULL REFERENCES master_lunar_registry(id),

    -- Publisher customization
    is_enabled BOOLEAN DEFAULT true,
    is_visible BOOLEAN DEFAULT true,

    -- Custom display names (optional override)
    custom_hebrew_name VARCHAR(255),
    custom_english_name VARCHAR(255),

    -- Publisher's note about this observance
    publisher_comment TEXT,

    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(publisher_id, master_lunar_id)
);

-- Which opinions does the publisher endorse?
CREATE TABLE publisher_lunar_opinions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID NOT NULL REFERENCES publishers(id),
    opinion_id UUID NOT NULL REFERENCES lunar_opinion_registry(id),

    -- Publisher's stance
    is_primary BOOLEAN DEFAULT false,  -- Their main recommendation
    is_shown BOOLEAN DEFAULT true,     -- Show to users

    -- Optional customization
    publisher_note TEXT,  -- "This is our minhag in community X"

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(publisher_id, opinion_id)
);
```

---

## Publisher Dashboard UI

```
┌─────────────────────────────────────────────────────────────────┐
│  Publisher Dashboard > Lunar Settings                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Configure which lunar observances and opinions you publish.    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Kiddush Levana                                    [Enabled]│ │
│  │ קידוש לבנה                                                 │ │
│  │                                                            │ │
│  │ Earliest Time Opinion:                                     │ │
│  │ ○ 3 Days - Mechaber (Sephardic)                           │ │
│  │ ● 7 Days - Rema (Ashkenazi)  ← PRIMARY                    │ │
│  │                                                            │ │
│  │ Latest Time Opinion:                                       │ │
│  │ ● Half Cycle - Maharil  ← PRIMARY                         │ │
│  │ ○ 15 Days - Shulchan Aruch                                │ │
│  │                                                            │ │
│  │ Publisher Note:                                            │ │
│  │ ┌─────────────────────────────────────────────────────┐   │ │
│  │ │ Our community follows the Rema's opinion of 7 days │   │ │
│  │ │ and the Maharil for the latest time.               │   │ │
│  │ └─────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Molad Announcement                                [Enabled]│ │
│  │ מולד                                                       │ │
│  │                                                            │ │
│  │ Display Format:                                            │ │
│  │ ● Traditional (hours & chalakim)                          │ │
│  │ ○ Modern (standard time)                                  │ │
│  │ ○ Both                                                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Rosh Chodesh                                     [Enabled]│ │
│  │ ראש חודש                                                   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│                                          [Save Changes]         │
└─────────────────────────────────────────────────────────────────┘
```

---

## User-Facing UI

```
┌─────────────────────────────────────────────────────────────────┐
│  Lunar Calendar                           Publisher: OU Kosher  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ◀ Kislev 5785          Teves 5785          Shevat 5785 ▶      │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ MOLAD TEVES                                                │ │
│  │ Wednesday, January 1, 2025                                 │ │
│  │ 4 hours, 22 minutes, 13 chalakim after midnight           │ │
│  │ (6:22:43 AM Jerusalem time)                               │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ KIDDUSH LEVANA WINDOW                                      │ │
│  │                                                            │ │
│  │ Earliest: Wed, Jan 8 at nightfall (7 days - Rema)         │ │
│  │ Latest:   Wed, Jan 15 at 12:44 AM (Maharil)               │ │
│  │                                                            │ │
│  │ Jan 2025                                                   │ │
│  │ Su  Mo  Tu  We  Th  Fr  Sa                                │ │
│  │              1   2   3   4                                 │ │
│  │  5   6   7  ▓8▓ ▓9▓▓10▓▓11▓    ▓ = Window open            │ │
│  │▓12▓▓13▓▓14▓▓15▓ 16  17  18                                │ │
│  │ 19  20  21  22  23  24  25                                │ │
│  │ 26  27  28  29 [30][31]        [ ] = Rosh Chodesh Shevat  │ │
│  │                                                            │ │
│  │ ℹ️ Our community follows Rema's opinion of 7 days and     │ │
│  │   the Maharil for the latest time.                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Other opinions: [Show all ▼]                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

```
# Public endpoints
GET /api/v1/lunar/calendar?month=2025-01&publisher_id=xxx
GET /api/v1/lunar/molad?hebrew_year=5785&hebrew_month=10
GET /api/v1/lunar/kiddush-levana?hebrew_year=5785&hebrew_month=10&publisher_id=xxx

# Publisher endpoints (authenticated)
GET  /api/v1/publisher/lunar/settings
PUT  /api/v1/publisher/lunar/settings/:lunar_key
GET  /api/v1/publisher/lunar/opinions
PUT  /api/v1/publisher/lunar/opinions/:opinion_id

# Admin endpoints
GET  /api/v1/admin/lunar/registry
POST /api/v1/admin/lunar/registry
GET  /api/v1/admin/lunar/opinions
POST /api/v1/admin/lunar/opinions
```

---

## Package Structure

```
api/internal/
├── lunar/
│   ├── hebrewcal/
│   │   ├── convert.go      # Gregorian ↔ Hebrew conversion
│   │   ├── molad.go        # Molad calculation
│   │   ├── months.go       # Hebrew month names, lengths
│   │   └── types.go        # HebrewDate, Molad types
│   │
│   ├── calculate.go        # KiddushLevana, RoshChodesh calculations
│   ├── opinions.go         # Opinion evaluation from params
│   └── types.go            # LunarEvent, TimeWindow, etc.
│
├── handlers/
│   ├── lunar.go            # Public lunar endpoints
│   └── lunar_publisher.go  # Publisher lunar settings

web/
├── app/
│   ├── lunar/
│   │   ├── page.tsx                    # Main lunar calendar
│   │   └── [hebrewMonth]/page.tsx      # Specific month
│   │
│   └── publisher/
│       └── lunar/
│           └── page.tsx                # Publisher lunar settings

├── components/
│   └── lunar/
│       ├── LunarCalendar.tsx
│       ├── MoladCard.tsx
│       ├── KiddushLevanaWindow.tsx
│       ├── HebrewMonthPicker.tsx
│       └── OpinionSelector.tsx
```

---

## Key Differences from Solar Zmanim

| Aspect | Solar Zmanim | Lunar Module |
|--------|-------------|--------------|
| **Customization** | Full DSL formula editing | Opinion selection only |
| **Registry** | Zman definitions | Observances + Opinions |
| **Publisher control** | Create custom formulas | Choose which opinions to endorse |
| **Calculation** | Complex astronomical DSL | Fixed algorithms per opinion |
| **Coverage** | Geographic (per location) | N/A (global) |
| **Output** | Time of day | Date ranges, announcements |

---

## Future Lunar Observances (Expandable)

The registry pattern allows adding more lunar-based items:

- **Birkas HaChama** - Blessing on the sun (every 28 years)
- **Tekufos** - Seasonal markers
- **Shmita year** tracking
- **Yovel** (Jubilee) calculations
- **Omer counter** integration

---

## Implementation Phases

### Phase 1: Hebrew Calendar Core
- Implement `hebrewcal` package with Gregorian ↔ Hebrew conversion
- Implement molad calculation
- Unit tests for date conversions

### Phase 2: Database & Registry
- Migration to create lunar tables
- Seed master lunar registry
- Seed opinion registry with standard opinions

### Phase 3: API Endpoints
- Public lunar calendar endpoint
- Molad calculation endpoint
- Kiddush Levana window endpoint

### Phase 4: Publisher Settings
- Publisher lunar settings CRUD
- Publisher opinion selection

### Phase 5: Frontend
- Lunar calendar page
- Publisher lunar settings page
- Components for molad, KL window display

---

## References

- [KosherJava Kiddush Levana](https://kosherjava.com/tag/kiddush-levana/)
- [JewishCalendar API Documentation](https://kosherjava.com/zmanim/docs/api/com/kosherjava/zmanim/hebrewcalendar/JewishCalendar.html)
- [Calculating Kiddush Levana Times](https://kosherjava.com/2011/05/20/calculating-kiddush-levana-times/)
- [Molad Times - Chabad.org](https://www.chabad.org/library/article_cdo/aid/216238/jewish/Molad-Times.htm)

---

_This proposal is for future implementation. The lunar module is not currently scheduled for development._
