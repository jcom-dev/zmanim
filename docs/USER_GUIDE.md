# User Guide

A complete guide for using the Shtetl Zmanim platform - for Halachic Authorities (publishers) and community members.

---

## Who Is This Guide For?

- **Publishers (Halachic Authorities)**: Rabbis and organizations who want to publish their own zmanim calculations
- **Community Members**: Users who want to view and use zmanim from their chosen authority
- **Developers**: Those building integrations with the platform

---

## Quick Start

### For Community Members

1. **Visit the Platform**: Go to [https://zmanim.shtetl.io](https://zmanim.shtetl.io)
2. **Select Location**: Enter your city or use geolocation
3. **Choose Authority**: Select your preferred Halachic Authority
4. **View Zmanim**: See daily zmanim calculated according to your authority's methods

### For Publishers

1. **Register**: Request publisher access through the platform
2. **Complete Onboarding**: Follow the setup wizard
3. **Define Your Zmanim**: Create formulas for each zman using the visual builder or DSL
4. **Set Coverage**: Define which geographic areas you serve
5. **Publish**: Make your zmanim available to your community

---

## Understanding Zmanim on This Platform

### What Makes This Platform Different?

Traditional zmanim applications use one fixed calculation method. Shtetl Zmanim is different:

- **Multiple Authorities**: Each Halachic Authority publishes their own calculations
- **Complete Transparency**: Every formula is visible - users can see exactly how times are calculated
- **Halachic Accuracy**: Authorities control their own formulas, ensuring accuracy to their tradition
- **Geographic Precision**: Calculations use precise coordinates for each locality

### How Zmanim Are Organized

| Category | Examples | When Shown |
|----------|----------|------------|
| **Dawn** | Alos Hashachar, Misheyakir | Early morning |
| **Sunrise** | Hanetz HaChama | Morning |
| **Morning** | End of Shema, End of Tefillah | Morning prayers |
| **Midday** | Chatzos | Noon |
| **Afternoon** | Mincha Gedolah, Mincha Ketanah | Afternoon |
| **Sunset** | Shkiah, Candle Lighting | Evening |
| **Night** | Tzeis HaKochavim | Nightfall |

### Event-Based Zmanim

Some zmanim only appear on specific days:

| Event | Zmanim Shown |
|-------|--------------|
| **Erev Shabbos** | Candle Lighting, Plag HaMincha |
| **Motzei Shabbos** | Tzeis for Shabbos end |
| **Chanukah** | Earliest Chanukah Candle Lighting |
| **Fast Days** | Fast start/end times |

---

## For Publishers: Setting Up Your Zmanim

### Step 1: Registration

1. Click "Register as Publisher" on the homepage
2. Provide your organization details
3. Await approval from platform administrators

### Step 2: Onboarding Wizard

After approval, the onboarding wizard guides you through:

1. **Welcome**: Overview of the platform
2. **Select Zmanim**: Choose which zmanim to publish from the master registry
3. **Customize Formulas**: Adjust calculations to match your tradition
4. **Set Coverage**: Define your geographic service area
5. **Review & Publish**: Final review before going live

### Step 3: The Algorithm Editor

The algorithm page is where you manage your zmanim formulas.

#### Visual Formula Builder

For common calculations, use the visual builder:

1. **Select Method**: Choose from Solar Angle, Fixed Offset, Proportional Hours, etc.
2. **Configure Parameters**: Set values like angle degrees, minutes offset, etc.
3. **Preview**: See calculated times for any date and location
4. **Save**: Apply the formula

#### DSL Editor (Advanced)

For complex calculations, use the DSL (Domain-Specific Language):

```
# Alos Hashachar - 72 minutes before visible sunrise
visible_sunrise - 72min

# Tzeis using solar angle
solar(8.5, after_sunset)

# Proportional hours (Shaos Zmaniyos)
proportional_hours(3, gra)  # 3 hours after alos
```

See the [DSL Complete Guide](dsl-complete-guide.md) for full documentation.

### Step 4: Coverage Management

Define where your zmanim are available:

| Coverage Level | Description | Example |
|----------------|-------------|---------|
| **Global** | Available worldwide | Large organizations |
| **Country** | All localities in a country | National Beis Din |
| **Region** | State/province level | Regional authority |
| **Locality** | Specific cities | Local Rav |

### Step 5: Tags and Event Filtering

Tags control when zmanim appear:

- **Time Tags**: dawn, sunrise, morning, midday, afternoon, sunset, night
- **Event Tags**: erev_shabbos, chanukah, purim, fast_day, etc.
- **Display Tags**: core (always shown), optional, hidden

**Example**: Candle lighting should have:
- Time tag: `sunset`
- Event tag: `erev_shabbos`
- Display: `core`

---

## For Publishers: Daily Operations

### Dashboard Overview

Your dashboard shows:

- **Published Zmanim**: Count and status of your zmanim
- **Coverage Areas**: Where you're serving
- **Team Members**: Who has access to your account
- **Recent Activity**: Changes and updates

### Managing Zmanim

#### View All Zmanim

The main algorithm page lists all your zmanim in order of appearance during the day.

#### Edit a Zman

1. Click on any zman card
2. Modify the formula using the visual builder or DSL
3. Preview to verify calculations
4. Save changes

#### Add New Zman

1. Click "Browse Registry" to view available zmanim
2. Select from the master registry OR copy from another publisher
3. Customize the formula for your tradition
4. Add appropriate tags
5. Save and publish

#### Delete a Zman

1. Click the menu on the zman card
2. Select "Delete"
3. Confirm deletion

**Note**: Deleted zmanim are soft-deleted and can be restored within 30 days.

### Previewing Calculations

Before publishing, preview your zmanim:

1. **Single Day**: See all zmanim for a specific date
2. **Weekly**: View an entire week to catch patterns
3. **Year Export**: Download a full year as PDF or Excel

### Version History

Every formula change is tracked:

1. Click "Version History" on any zman
2. View all previous versions with timestamps
3. Compare differences between versions
4. Restore any previous version if needed

---

## For Publishers: Advanced Features

### Halachic Notes

Add explanations to your formulas:

```
# This follows the opinion of the Mishnah Berurah
# that considers 72 minutes as the time it takes
# to walk 4 mil before sunrise
visible_sunrise - 72min
```

Notes help users understand your calculation methodology.

### Linking vs Copying

When adding a zman from another publisher:

| Action | Behavior | Use When |
|--------|----------|----------|
| **Link** | Always uses their formula | You follow their psak exactly |
| **Copy** | Creates your own copy | You want to customize |

**Linking** means if they update their formula, yours updates too.
**Copying** gives you an independent copy to modify.

### Location Overrides

For specific localities, you can override coordinates:

- Useful for shuls not at city center
- Accounts for local horizon features
- Maintains precision for your community

### Snapshots and Backup

Create snapshots to save your entire configuration:

1. Go to Settings → Snapshots
2. Click "Create Snapshot"
3. Add a description
4. Export as JSON for backup

Snapshots can be imported to restore or migrate configurations.

### Team Management

Invite team members to help manage your zmanim:

| Role | Permissions |
|------|-------------|
| **Owner** | Full access, can delete account |
| **Admin** | Manage zmanim, team, settings |
| **Editor** | Edit zmanim only |
| **Viewer** | View-only access |

---

## For Community Members: Using Zmanim

### Finding Your Authority

1. **Browse by Location**: See authorities serving your area
2. **Search by Name**: Find a specific Rav or organization
3. **View Coverage**: See where each authority operates

### Viewing Daily Zmanim

1. Select your location
2. Choose your authority
3. View today's zmanim

**Features**:
- Times adjust automatically for your location
- Zmanim relevant to today's date appear
- Click any zman to see its formula and explanation

### Understanding the Display

| Element | Meaning |
|---------|---------|
| **Hebrew Name** | Traditional Hebrew name |
| **English Name** | English translation/transliteration |
| **Time** | Calculated time for your location |
| **Formula Icon** | Click to see the calculation method |

### Time Formats

The platform displays times in 12-hour format (2:30 PM).

Times are calculated for your selected location's timezone.

### Printing and Export

- **Print Daily**: Print today's zmanim
- **Weekly Calendar**: Print a week's zmanim
- **Year Export**: Download full year (PDF/Excel)

---

## Frequently Asked Questions

### General

**Q: Why do different authorities show different times?**

A: Different Halachic authorities use different calculation methods based on their tradition. For example, some calculate Alos as 72 minutes before sunrise, while others use a solar angle of 16.1 degrees below the horizon.

**Q: Which authority should I use?**

A: Consult with your local Rav. Generally, follow the authority your community or shul uses.

**Q: How accurate are the calculations?**

A: Calculations use precise astronomical formulas and location coordinates. Times are typically accurate to within seconds.

### For Publishers

**Q: Can I update my formulas after publishing?**

A: Yes, you can update formulas at any time. Changes take effect immediately.

**Q: How do I handle edge cases (like extreme latitudes)?**

A: The DSL supports conditional logic for handling special cases. See the [DSL Guide](dsl-complete-guide.md) for examples.

**Q: Can I unpublish a zman temporarily?**

A: Yes, you can disable a zman without deleting it. It won't appear to users but remains in your configuration.

### Technical

**Q: What timezone are times displayed in?**

A: Times are displayed in the local timezone of the selected location.

**Q: How is elevation handled?**

A: The system uses the locality's elevation data when available. You can override this for specific locations.

**Q: What happens on days without sunrise/sunset (polar regions)?**

A: The DSL supports conditional formulas to handle extreme latitudes with appropriate fallbacks.

---

## Getting Help

### Documentation

- [DSL Complete Guide](dsl-complete-guide.md) - Formula language reference
- [Tag System Reference](TAG-SYSTEM-REFERENCE.md) - Understanding tags
- [API Reference](API_REFERENCE.md) - For developers building integrations

### Support

- **Email**: Contact through the platform
- **Issues**: Report bugs via the feedback form

### Training

Publishers can request onboarding assistance when setting up their account.

---

## Glossary

| Term | Definition |
|------|------------|
| **Alos Hashachar** | Dawn, when the sky begins to lighten |
| **Hanetz HaChama** | Sunrise |
| **Chatzos** | Halachic midday |
| **Mincha Gedolah** | Earliest time for afternoon prayer |
| **Mincha Ketanah** | Later time for afternoon prayer |
| **Shkiah** | Sunset |
| **Tzeis HaKochavim** | Nightfall, when stars appear |
| **Shaos Zmaniyos** | Proportional hours (day/12) |
| **GRA** | Vilna Gaon's method (sunrise to sunset) |
| **MGA** | Magen Avraham's method (72 min before sunrise to 72 min after sunset) |
| **DSL** | Domain-Specific Language - the formula syntax |
| **Publisher** | A Halachic Authority publishing zmanim |
| **Locality** | A geographic location (city, town) |
| **Coverage** | The geographic areas a publisher serves |

---

*Last updated: December 2025*
