# What is Shtetl Zmanim?

## Overview

**Shtetl Zmanim** is a **Halachic Zmanim Publishing Platform** - a multi-publisher platform that empowers Jewish halachic authorities (rabbis, batei din, Orthodox communities) to publish customized Zmanim (zmanim) with complete control over calculation algorithms and geographic coverage.

Think of it as "WordPress for Zmanim" - where any qualified halachic authority can become a publisher and define their own calculation methods without needing to code.

---

## The Big Picture

### What Are Zmanim?

**Zmanim** (Hebrew: זמנים, "times") are halachically significant times of day that determine when Jews can perform mitzvot (religious commandments), especially Zmanim. Examples include:

- **Alos Hashachar** (dawn) - earliest time for morning prayers
- **Sof Zman Shma** (latest Shema time) - deadline for reciting morning Shema
- **Chatzos** (midday) - exact solar noon
- **Tzeis Hakochavim** (nightfall) - when three stars appear, marking end of Shabbat

### The Challenge

Calculating zmanim is complex because:

1. **Astronomical precision required** - Based on sun position, sunrise, sunset, solar angles
2. **Geographic variation** - Different locations have different times
3. **Multiple halachic opinions** - Different rabbinic authorities use different methods:
   - **GRA (Vilna Gaon)** vs. **Magen Avraham (MGA)** for proportional hours
   - Different solar depression angles (16.1°, 18°, 19.8° for dawn)
   - Fixed minutes (72, 90 minutes) vs. angular calculations
4. **No centralized source of truth** - Each community follows their own authority

### What Makes Shtetl Zmanim Special

Shtetl Zmanim solves this through **two-sided transparency**:

#### For Publishers (Halachic Authorities):
- **Friendly UI** - Configure complex algorithms without writing code
- **Visual formula builder** - Drag-and-drop calculation method selection
- **AI assistance** - Describe what you want in plain language, get valid formula
- **Live preview** - See calculated times instantly as you edit
- **Geographic control** - Define service areas by continent, country, region, or city
- **Full customization** - Every zman, every parameter, exactly your way

#### For End Users:
- **Transparency** - Click any time to see exactly how it was calculated
- **Authority-specific** - Choose zmanim from your trusted rabbi
- **Location-first** - Start with your city, find publishers serving you
- **Multi-language** - Hebrew and English throughout
- **Mobile-friendly** - Access from phone, tablet, or desktop

---

## Why Shtetl Zmanim Exists

### The Core Mission

**Democratize zmanim publishing** - Any qualified halachic authority should be able to publish their calculation methods without needing technical expertise, while end users gain transparency into exactly how their Zmanim are calculated.

### Problems It Solves

#### Problem 1: Technical Barrier for Authorities
**Before:** A rabbi who wanted to publish zmanim for their community needed to:
1. Hire a developer
2. Maintain a custom app or website
3. Pay ongoing hosting costs
4. Handle bugs and updates

**After:** The rabbi:
1. Signs up on Shtetl Zmanim
2. Uses the visual editor to define formulas (or describes them to AI)
3. Selects geographic coverage
4. Publishes - done!

#### Problem 2: Black Box for Users
**Before:** Users saw a time (e.g., "6:42 AM") but had no idea:
- Which method was used
- Which rabbi endorsed it
- Why it differs from other apps

**After:** Users click any time and see:
- The exact formula: "18° below horizon" or "72 fixed minutes before sunrise"
- The rabbi/organization name
- A plain-language explanation

#### Problem 3: Algorithm Fragmentation
**Before:** Every zmanim app picked one method ("our way or the highway"):
- MyZmanim uses one set of algorithms
- Chabad.org uses another
- KosherJava has defaults
- Users can't follow their specific rav's psak (ruling)

**After:** Shtetl Zmanim is **multi-publisher**:
- User searches for "Brooklyn, NY"
- Sees: Rabbi Goldstein (Crown Heights), Rabbi Cohen (Flatbush), Rabbi Weiss (Boro Park)
- Selects their community's authority
- Gets that authority's exact calculations

#### Problem 4: No Collaboration
**Before:** Rabbis worked in isolation. If Rabbi A figured out a great formula for Mincha Ketana, Rabbi B couldn't easily adopt it.

**After:** Publishers can:
- Copy/fork other publishers' algorithms (with attribution)
- Request new zmanim to be added to the master registry
- See what formulas other authorities are using
- Build on community knowledge

---

## Who It's For

### Primary Users: Publishers (Halachic Authorities)

**Who:**
- Batei din (rabbinical courts)
- Jewish community organizations
- Kashrus organizations

**What They Do:**
1. Define their halachic calculation methods
2. Set geographic coverage (who they serve)
3. Publish zmanim for their community
4. Update formulas as needed
5. Monitor usage analytics

**Value They Get:**
- No technical expertise required
- Professional platform with their branding (logo, name, bio)
- Instant reach to their community
- Full control over algorithms
- Transparency builds trust

### Secondary Users: End Users (Community Members)

**Who:**
- Observant Jews worldwide
- People seeking accurate Zmanim
- Those who want to follow a specific authority
- Jews traveling who need local customs

**What They Do:**
1. Select their location
2. Choose their trusted authority (or use default calculations)
3. View daily zmanim
4. See explanations for how times are calculated
5. Check dates in the past or future

**Value They Get:**
- Authority-specific times (following their rav)
- Transparency (understanding the "why")
- Geographic accuracy
- Event-based zmanim (candle lighting, havdalah for Shabbat/Yom Tov)
- Hebrew calendar integration

### Tertiary Users: Administrators

**Who:**
- Platform administrators (Shtetl Zmanim team)

**What They Do:**
1. Approve publisher applications
2. Review new zman requests
3. Monitor system health
4. Manage user issues
5. View platform analytics

---

## How It Works: The Journey

### Publisher Journey

```
1. Apply → Admin Approves → Onboarding Wizard → Define Algorithms → Set Coverage → Publish → Monitor
```

**Step 1: Registration**
- Publisher submits application via "Become a Publisher"
- Provides: Name, email, organization details

**Step 2: Admin Approval**
- Admin reviews application
- Verifies legitimacy
- Approves or rejects

**Step 3: Onboarding Wizard**
- Upload logo (with crop/zoom editor or AI-generated initials)
- Customize essential zmanim (visual preview of common methods)
- Select geographic coverage (map-based selection)
- Review and publish

**Step 4: Algorithm Management**
- Access `/publisher/algorithm` page
- See list of all zmanim (everyday vs. events)
- Edit formulas:
  - **Guided Mode**: Visual builder (select method, enter parameters, preview)
  - **Advanced Mode**: CodeMirror with syntax highlighting, autocomplete
  - **AI Mode**: Describe in natural language → get valid formula
- Preview calculations for any date/location
- View month/week calendar
- Publish changes

**Step 5: Coverage Management**
- Add coverage areas (continents, countries, regions, cities)
- Set priorities (which areas to match first)
- View map of coverage
- Activate/deactivate areas

**Step 6: Going Live**
- Publish algorithms (marks as active)
- Users in coverage areas can now find

 and use the publisher

### End User Journey

```
1. Visit Site → Select Location → Choose Publisher → View Zmanim → Reveal Formula
```

**Step 1: Homepage**
- User lands on zmanim.com
- Sees location selector with options:
  - **Search**: Type city name
  - **Browse**: Navigate continent → country → region → city
  - **Geolocation**: "Use my location" button

**Step 2: Publisher Selection**
- After selecting location, sees list of publishers covering that area
- Sorted by priority, then alphabetically
- Each card shows: Logo, Name, Brief description
- If no coverage: "No local authority - view default calculations" option

**Step 3: Zmanim Display**
- Shows today's zmanim in local timezone
- Two tabs: "Everyday" (daily prayers) and "Events" (Shabbat, holidays)
- Each zman shows: Hebrew name, English name, Time (with AM/PM), Info icon (ⓘ)
- Date navigation: Previous/Next day arrows, Date picker
- Hebrew calendar mode toggle

**Step 4: Formula Reveal**
- Click info icon (ⓘ) next to any time
- Side panel (desktop) or bottom sheet (mobile) opens
- Shows:
  - Zman name (Hebrew + English)
  - Calculated time
  - Method name (e.g., "Solar Depression Angle")
  - Parameters (e.g., "18° below horizon")
  - Plain-language explanation
  - Halachic notes (if publisher added)
- Close with X button or click outside

**Step 5: Exploration**
- Navigate to different dates (past or future)
- Toggle Gregorian/Hebrew calendar
- See event-based zmanim (candle lighting on Friday, Havdalah on Saturday night)
- Bookmark for quick access

---

## Key Differentiators

### 1. Multi-Publisher Architecture
**Not a single-algorithm app** - Each publisher has their own algorithms. Users choose their authority.

### 2. Two-Sided Transparency
**Publishers:** Visual editor makes algorithm creation friendly
** Users:** Formula reveal shows exactly how times are calculated

### 3. AI-Powered Formula Generation
**Unique Innovation:** Describe calculation in natural language → Claude AI generates valid DSL formula
Example: "Dawn when sun is 16.1 degrees below horizon" → `solar(16.1, before_sunrise)`

### 4. Bilingual Throughout
**Hebrew + English** for all zmanim names, explanations, and UI elements

### 5. Geographic Precision
**PostGIS-powered** - Continent/country/region/city hierarchy
**Flexible coverage** - Publisher can serve a single city or an entire continent

### 6. Collaborative Ecosystem
- **Master Zman Registry**: Community-driven catalog of calculation methods
- **Copy/Fork**: Publishers can adopt others' formulas (with attribution)
- **Request System**: Publishers request new zmanim → Admin approves → Available to all
- **Tag System**: Organize zmanim by events (Rosh Hashanah, Yom Kippur), timing methods (GRA, MGA), behaviors

### 7. Educational Transparency
**Not just "what time"** but **"why this time"**:
- Shows calculation method
- Explains parameters
- Links formulas to halachic sources (optional publisher notes)

---

## Technical Highlights (Non-Technical Summary)

### Robust Infrastructure
- **Frontend**: Modern web app (Next.js) - fast, responsive, works on any device
- **Backend**: Go API - reliable, high-performance
- **Database**: PostgreSQL via Xata - handles millions of cities, precise geographic queries
- **Caching**: Redis - fast lookups, 24-hour cache with auto-invalidation
- **Authentication**: Clerk - secure user and publisher accounts
- **AI**: Claude (Anthropic) - natural language formula generation
- **Calculation Engine**: Custom-built Go engine inspired by KosherJava

### Smart Caching
- Calculations cached for 24 hours
- Cache invalidated when publisher updates algorithm
- Sub-100ms response for cached results

### Event-Based Zmanim
- Integrates Hebrew calendar (hebcal-go)
- Automatically shows Shabbat candle lighting (18 min before sunset)
- Havdalah times (42 min after sunset, configurable)
- Handles 44 Jewish events (Rosh Hashanah, Yom Kippur, Chanukah, Purim, etc.)
- Respects Israel vs. Diaspora rules

### Security & Reliability
- Role-based access control (Admin, Publisher, User, Anonymous)
- Rate-limiting (prevents abuse)
- Audit logging (tracks changes)
- Error handling (graceful fallbacks)
- Comprehensive testing (130+ E2E tests)

---

## Success Metrics

### For Publishers
- Number of publishers onboarded
- Active publishers (published algorithms)
- Coverage breadth (cities/countries served)
- Algorithm updates frequency

### For Users
- Monthly active users
- Cities searched
- Formula reveals (transparency engagement)
- Return visitors
- Time spent on platform

### For Platform
- Calculation accuracy
- Cache hit ratio (performance)
- API uptime
- Response times (<200ms target)

---

## The Future Vision

Shtetl Zmanim aims to become the **trusted, global source for halachically accurate zmanim** by:

1. **Growing the publisher network** - Every major Jewish community has representation
2. **Expanding geographic coverage** - Global city database
3. **Enhancing AI capabilities** - Even smarter formula generation, halachic question answering
4. **Building community features** - Publisher forums, shared best practices
5. **Mobile apps** - Native iOS/Android with offline support
6. **API access** - Third-party developers can build on Shtetl Zmanim
7. **Integration with Jewish apps** - Siddur apps, calendar apps use Shtetl Zmanim as data source

---

## In Summary

**Shtetl Zmanim is...**

✅ A **platform** (not an app) for publishing Jewish Zmanim
✅ **Multi-publisher** (user chooses their authority)
✅ **Transparent** (formula reveal for every calculation)
✅ **Publisher-friendly** (visual editor, AI assistance, no coding required)
✅ **Globally precise** (geo-based matching)
✅ **Community-driven** (collaborative registry, copy/fork)
✅ **Bilingual** (Hebrew + English)
✅ **Reliable** (cached, performant, tested)

**Mission:** Democratize zmanim publishing for halachic authorities while providing transparency and accuracy for end users worldwide.
