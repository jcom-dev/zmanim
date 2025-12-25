# HebCal Yom Tov / Shabbos Detection Methods

## Overview
There are multiple methods to detect Shabbos and Yom Tov status from HebCal without relying on event name matching.

## Method 1: Direct YomTov Flag (MOST RELIABLE)

### HebCal API Response
```json
{
  "title": "Rosh Hashana 5785",
  "date": "2024-10-03",
  "category": "holiday",
  "subcat": "major",
  "yomtov": true,  // ← DIRECT FLAG
  "hebrew": "ראש השנה 5785"
}
```

### Detection Logic
```go
if event.YomTov {
    // This is a Yom Tov day with work restrictions (like Shabbos)
    // Applies to: Rosh Hashana, Yom Kippur, Sukkot days 1-2,
    //             Shmini Atzeret, Simchat Torah, Pesach days 1-2 & 7-8, Shavuot
}
```

### Advantages
- ✅ Most reliable - directly from HebCal
- ✅ No string matching needed
- ✅ Handles Israel vs Diaspora automatically (based on `il` parameter)
- ✅ Works for all Yom Tov days regardless of naming

---

## Method 2: Candle Lighting / Havdalah Categories

### HebCal API Response
```json
// Erev Shabbos / Erev Yom Tov
{
  "title": "Candle lighting: 18:57",
  "date": "2024-10-03T18:57:00+03:00",
  "category": "candles",  // ← INDICATES EREV
  "memo": "Rosh Hashana 5785"  // Optional: which holiday
}

// Motzei Shabbos / Motzei Yom Tov
{
  "title": "Havdalah: 19:58",
  "date": "2024-10-04T19:58:00+03:00",
  "category": "havdalah",  // ← INDICATES MOTZEI
  "memo": "Rosh Hashana II"  // Optional: which holiday
}
```

### Detection Logic
```go
if event.Category == "candles" {
    // This is Erev Shabbos or Erev Yom Tov
    // Candle lighting time = start of holy day
    // Show: candle_lighting, early_shabbos, etc.
}

if event.Category == "havdalah" {
    // This is Motzei Shabbos or Motzei Yom Tov
    // Havdalah time = end of holy day
    // Show: havdalah, tzeit_kochavim, etc.
}
```

### Advantages
- ✅ Works without event name matching
- ✅ Directly indicates Erev/Motzei status
- ✅ Includes precise times
- ✅ Optional `memo` field tells you which holiday

### Usage in API
```bash
# Get candles & havdalah times
curl "https://www.hebcal.com/hebcal?v=1&cfg=json&year=2024&month=10&geo=geoname&geonameid=281184&c=on"
```

**Note**: Set `c=on` to include candle lighting times. We currently use `c=off` and calculate our own times.

---

## Method 3: Day of Week (SHABBOS ONLY)

### Detection Logic
```go
func isShabbos(date time.Time) bool {
    return date.Weekday() == time.Saturday
}

func isErevShabbos(date time.Time) bool {
    return date.Weekday() == time.Friday
}
```

### Advantages
- ✅ Zero dependencies - pure date math
- ✅ Always accurate for Shabbos
- ✅ No API calls needed

### Limitations
- ❌ Only works for Shabbos, not Yom Tov

---

## Method 4: Subcat (Holiday Classification)

### HebCal Categories
```json
{
  "category": "holiday",
  "subcat": "major"  // Major holiday (usually Yom Tov)
}

{
  "category": "holiday",
  "subcat": "minor"  // Minor holiday (no work restrictions)
}
```

### Detection Logic
```go
if event.Category == "holiday" && event.Subcat == "major" {
    // Likely Yom Tov, but check yomtov flag to be sure
    // Some "major" holidays (e.g., Chanukah) are NOT Yom Tov
}
```

### Important Notes
- ⚠️ `subcat: "major"` does NOT always mean Yom Tov
  - Chanukah is "major" but NOT Yom Tov (no work restrictions)
  - Purim is "major" but NOT Yom Tov
- ✅ Always use `yomtov: true` flag for definitive Yom Tov status

---

## Method 5: Chol HaMoed Detection

### HebCal for Intermediate Days
```json
// Pesach III (Chol HaMoed)
{
  "title": "Pesach III (CH''M)",
  "category": "holiday",
  "subcat": "major",
  "yomtov": false  // ← NOT Yom Tov (work allowed)
}

// Sukkot V (Chol HaMoed)
{
  "title": "Sukkot V (CH''M)",
  "category": "holiday",
  "subcat": "major",
  "yomtov": false  // ← NOT Yom Tov
}
```

### Detection Logic
```go
if event.Category == "holiday" && event.Subcat == "major" && !event.YomTov {
    // This is Chol HaMoed (intermediate days)
    // Work allowed, but still special zmanim
}
```

---

## Recommended Implementation Strategy

### Priority Order
1. **Check `yomtov` flag** for definitive Yom Tov status
2. **Check `category: "candles"`** for Erev detection
3. **Check `category: "havdalah"`** for Motzei detection
4. **Check day of week** for Shabbos (Saturday) and Erev Shabbos (Friday)
5. **Check `subcat: "major"`** for holiday classification (but verify with `yomtov`)

### Complete Detection Function
```go
type DayStatus struct {
    IsShabbos      bool
    IsYomTov       bool
    IsErevShabbos  bool
    IsErevYomTov   bool
    IsMoetzei      bool
    IsCholHaMoed   bool
    YomTovName     string
}

func GetDayStatus(date time.Time, hebcalEvents []HebCalEvent) DayStatus {
    status := DayStatus{}

    // Method 3: Check day of week for Shabbos
    if date.Weekday() == time.Saturday {
        status.IsShabbos = true
    }
    if date.Weekday() == time.Friday {
        status.IsErevShabbos = true
    }

    // Method 1 & 2: Check HebCal events
    for _, event := range hebcalEvents {
        // Direct Yom Tov flag
        if event.YomTov {
            status.IsYomTov = true
            status.YomTovName = event.Title
        }

        // Candle lighting = Erev
        if event.Category == "candles" {
            if !status.IsErevShabbos {
                status.IsErevYomTov = true
            }
        }

        // Havdalah = Motzei
        if event.Category == "havdalah" {
            status.IsMoetzei = true
        }

        // Chol HaMoed detection
        if event.Category == "holiday" &&
           event.Subcat == "major" &&
           !event.YomTov &&
           strings.Contains(event.Title, "CH''M") {
            status.IsCholHaMoed = true
        }
    }

    return status
}
```

---

## Database Schema Implications

### Current Approach (Event Name Matching)
```sql
-- OLD: Relies on string matching of event names
SELECT tag_key
FROM zman_tags zt
JOIN tag_event_mappings tem ON zt.id = tem.tag_id
WHERE 'Rosh Hashana 5785' ~ tem.hebcal_event_pattern;
```

### Recommended Approach (Category-Based)
```sql
-- NEW: Store category flags directly
ALTER TABLE zman_tags ADD COLUMN hebcal_category VARCHAR(20);
ALTER TABLE zman_tags ADD COLUMN hebcal_yomtov_level INTEGER;
-- 0 = no restrictions (Chanukah, Purim)
-- 1 = Chol HaMoed (some restrictions)
-- 2 = Full Yom Tov (like Shabbos)
```

### Hybrid Approach (Current + Enhanced)
```sql
-- Keep event matching for specific events (Rosh Chodesh, Parasha)
-- Add category-based detection for Yom Tov status
ALTER TABLE zman_tags
ADD COLUMN requires_yomtov BOOLEAN DEFAULT FALSE,
ADD COLUMN requires_candles BOOLEAN DEFAULT FALSE;
```

---

## HebCal API Parameters for Maximum Info

### Recommended API Call
```bash
curl "https://www.hebcal.com/hebcal?\
v=1&\
cfg=json&\
year=2024&month=10&day=3&\
geo=geoname&geonameid=281184&\  # Location for candles/havdalah
il=false&\  # false=Diaspora, true=Israel (affects Yom Tov durations)
maj=on&\    # Major holidays
min=on&\    # Minor holidays
mod=on&\    # Modern holidays
nx=on&\     # Rosh Chodesh
mf=on&\     # Minor fasts
ss=on&\     # Special Shabbatot
c=on&\      # Candle lighting times ← IMPORTANT
M=on&\      # Havdalah/Motzei times ← IMPORTANT
s=on"       # Sedra/Parasha
```

### Fields to Parse
```json
{
  "yomtov": true,           // ← PRIORITY 1: Definitive Yom Tov flag
  "category": "candles",    // ← PRIORITY 2: Erev indicator
  "category": "havdalah",   // ← PRIORITY 3: Motzei indicator
  "subcat": "major",        // ← Supplementary classification
  "memo": "Holiday Name",   // ← Optional context
  "hdate": "1 Tishrei 5785" // ← Hebrew date
}
```

---

## Summary

### ✅ BEST METHODS (No event name matching)
1. **`yomtov: true`** flag → Definitive Yom Tov status
2. **`category: "candles"`** → Erev Shabbos/Yom Tov
3. **`category: "havdalah"`** → Motzei Shabbos/Yom Tov
4. **Day of week** → Shabbos (Saturday) / Erev Shabbos (Friday)

### ⚠️ SUPPLEMENTARY METHODS
5. **`subcat: "major"`** → Holiday classification (verify with `yomtov` flag)
6. Event name patterns → Only for specific events (Rosh Chodesh, Parasha)

### ❌ AVOID
- Relying solely on event titles
- Assuming `subcat: "major"` always means Yom Tov (it doesn't)
- Hardcoding holiday dates

---

## Migration Path

### Phase 1: Enhance Data Model ✅
- Add `yomtov`, `subcat` fields to `HebCalEvent` struct
- Update HebCal API calls to include `c=on` for candles

### Phase 2: Implement Category-Based Detection ⏳
- Create `GetDayStatus()` function using categories
- Add Yom Tov level detection to `EventDayInfo`

### Phase 3: Optimize Database ⏳
- Add category-based flags to `zman_tags`
- Keep event name matching only for specific cases (Rosh Chodesh, Parasha)
- Remove redundant event mappings

### Phase 4: Test & Validate ⏳
- Test Israel vs Diaspora Yom Tov durations
- Verify Chol HaMoed detection
- Validate candle lighting times
