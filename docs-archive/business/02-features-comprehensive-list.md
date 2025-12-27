# Shtetl Zmanim: Comprehensive Features List

This document provides an exhaustive breakdown of all features in Shtetl Zmanim, organized by user role and functional area.

---

## Table of Contents

1. [End User Features](#end-user-features)
2. [Publisher Features](#publisher-features)
3. [Admin Features](#admin-features)
4. [Platform Features (All Users)](#platform-features-all-users)

---

## End User Features

### Location Discovery & Selection

#### 1.1 Global Location Search
- **Fuzzy search** - Type partial city names, handles typos
- **Autocomplete** - Real-time suggestions as you type
- **Hierarchical display** - Shows "City, Region, Country" in results
- **Global coverage** - Thousands of cities worldwide via GeoNames dataset
- **Smart ranking** - Prioritizes larger cities, popular destinations

#### 1.2 Hierarchical Browsing
- **Browse by continent** - Start broad (Africa, Asia, Europe, North America, Oceania, South America)
- **Drill down to country** - See all countries in selected continent
- **Select region/state** - Navigate to provinces, states, districts
- **Choose city** - Final selection from region
- **Breadcrumb navigation** - Easy backtracking through hierarchy
- **Visual icons** - MapPin, Globe, Building icons for clarity

#### 1.3 Geolocation
- **"Use My Location" button** - One-click location detection
- **Browser geolocation API** - Automatic coordinate detection
- **Reverse geocoding** - Coordinates → nearest city lookup
- **Permission handling** - Graceful fallback if user denies permission
- **Mobile-optimized** - Works seamlessly on phones/tablets

#### 1.4 Location Memory
- **localStorage persistence** - Remembers last selected city
- **Quick return** - No need to re-search on subsequent visits
- **Multi-device** - Each device remembers separately

---

### Publisher Discovery

#### 2.1 Coverage-Based Matching
- **Smart matching algorithm** - Finds publishers serving your city
- **Hierarchical matching** - City-specific → Region → Country → Continent
- **Priority sorting** - Publishers set priorities for overlapping coverage
- **Coverage level indicator** - Shows "Serves this city directly" vs. "Regional coverage" vs. "National coverage"

#### 2.2 Publisher Cards
- **Publisher logo** - Visual branding (or auto-generated initials if no logo)
- **Publisher name** - Organization name displayed prominently
- **Verification badge** - "Verified" label for admin-approved publishers
- **Description preview** - Short bio (line-clamped to 2 lines)
- **Zmanim count indicator** - Shows if publisher has published algorithms

#### 2.3 No Coverage Handling
- **Warning message** - "No halachic authority covers this area yet"
- **Default calculations available** - View standard zmanim anyway
- **Disclaimer** - Clear note that default times aren't rabbi-endorsed
- **Fallback option** - "View Default Zmanim" button

---

### Zmanim Viewing & Display

#### 3.1 Daily Zmanim Display
- **Today's times by default** - Immediate relevance
- **Local timezone** - All times displayed in city's timezone
- **12-hour format** - AM/PM indicators
- **Clean list layout** - Readable, organized presentation
- **Hebrew names** - נץ החמה, סוף זמן שמע, etc.
- **English names** - Sunrise, Latest Shema Time, etc.
- **Transliteration** - Optional phonetic spelling (Netz HaChama, Sof Zman Sh

ma)

#### 3.2 Everyday vs. Event Zmanim
- **Tab interface** - Switch between "Everyday" and "Events"
- **Everyday tab** - Daily Zmanim (Alos, Sunrise, Shma, Chatzos, Mincha, Sunset, Tzeis, Midnight)
- **Events tab** - Shabbat/holiday-specific (Candle Lighting, Havdalah, Fast Start/End)
- **Automatic event detection** - Shows candle lighting on Friday, Havdalah on Saturday night
- **Hebrew calendar awareness** - Handles all 44 Jewish events (Rosh Hashanah, Yom Kippur, Chanukah, Purim, Pesach, Shavuot, Sukkot, Tisha B'Av, fasts, etc.)
- **Israel vs. Diaspora** - Respects regional rules for holiday observance

#### 3.3 Date Navigation
- **Previous/Next day arrows** - Quick navigation
- **"Today" button** - Jump back to current date
- **Date picker** - Select any date (past or future)
- **Unlimited range** - Calculate for any date
- **Gregorian/Hebrew calendar toggle** - Switch calendar modes
- **Hebrew date display** - Shows "15 Kislev 5784" alongside Gregorian

#### 3.4 Formula Reveal (Transparency Feature)
- **Info icon (ⓘ)** - Next to every zman time
- **Click to reveal** - Opens side panel (desktop) or bottom sheet (mobile)
- **Zman name** - Hebrew + English
- **Calculated time** - Reinforces the time shown
- **Method name** - E.g., "Solar Depression Angle", "Fixed Minutes Before Sunrise", "Proportional Hours (GRA)"
- **Parameters breakdown** - "18° below horizon", "72 minutes", "3 solar hours"
- **Plain-language explanation** - Non-technical description of what the formula means
- **Halachic notes (optional)** - Publisher can add sources, reasoning
- **Beta indicator** - If publisher marked zman as experimental
- **Close button** - X or click outside to dismiss
- **Keyboard accessible** - ESC key to close, focus trap

#### 3.5 Responsive Design
- **Mobile-optimized** - Full functionality on phones
- **Tablet-friendly** - Adaptive layouts
- **Desktop experience** - Side panels, more spacing
- **Touch-friendly** - Large tap targets
- **Swipe gestures** - Bottom sheet supports swipe-to-close on mobile

---

### User Convenience Features

#### 4.1 Multi-Language Support
- **Bilingual throughout** - Hebrew and English for all zman names
- **RTL support** - Hebrew names display right-to-left correctly
- **Font support** - Hebrew fonts loaded (web fonts)
- **Transliteration** - Optional phonetic spelling for non-Hebrew readers

#### 4.2 Accessibility
- **ARIA labels** - Screen reader support
- **Keyboard navigation** - Tab through elements, Enter to select
- **Focus indicators** - Visual cues for keyboard users
- **Color contrast** - WCAG AA compliant
- **Semantic HTML** - Proper heading hierarchy, landmarks

#### 4.3 Dark Mode
- **System preference detection** - Respects OS settings
- **Manual toggle** - Moon/sun icon to switch
- **Persistent choice** - Saves preference
- **Smooth transition** - No jarring flash when switching

---

## Publisher Features

### Account Management

#### 5.1 Publisher Registration
- **Self-service application** - "Become a Publisher" public form
- **Required fields** - Name, email, organization description
- **Optional fields** - Website
- **Email validation** - Proper format enforcement
- **Submission confirmation** - Success message after submit
- **Admin review queue** - Application enters pending status
- **Email notification** - Receives approval/rejection via email

#### 5.2 Multi-Publisher Support
- **Multi-publisher access** - One user can manage multiple publisher accounts
- **Publisher switcher** - Dropdown in nav to switch context
- **Context persistence** - Selected publisher saved in header
- **Team collaboration** - Multiple users can access same publisher
- **Role-based permissions** - Owner vs. team member roles

#### 5.3 Profile Management
- **Edit profile** - Name, email, website, bio
- **Logo upload** - With crop/zoom editor (react-easy-crop)
- **AI-generated logos** - Automatic initials-based logo fallback
- **Logo preview** - See how it looks before saving
- **Mandatory logo** - Cannot publish without logo
- **Bio field** - Markdown-supported rich text for organization description
- **Status indicator** - Verified, Pending, Suspended
- **Contact information** - Email displayed to users

### Algorithm/Zman Management

#### 6.1 Zman List & Organization
- **Complete zman list** - All configured zmanim in table/grid view
- **Everyday vs. Events filter** - Toggle between daily and holiday zmanim
- **Search & filter** - Find zmanim by name or key
- **Status filters** - Published, Draft, Essential, Optional, Hidden, Deleted
- **Tag-based filters** - Filter by GRA, MGA, Solar Angle, Fixed Minutes, Proportional, etc.
- **Sort order management** - Drag-and-drop reordering (future enhancement)
- **Bulk actions** - Select multiple, publish/unpublish batch

#### 6.2 Algorithm Editor - Guided Mode (Visual Builder)
- **Visual formula builder** - No code required
- **Method selection dropdown** - Choose from:
  - **Solar Angle** - Depression angle below horizon
  - **Fixed Minutes** - Offset from sunrise/sunset
  - **Proportional Hours (Shaos Zmaniyos)** - GRA or MGA method
  - **Midpoint** - Between two other zmanim
  - **Solar Midnight** - Exact halfway between sunset and sunrise
- **Parameter inputs** - Number fields for degrees, minutes, hours
- **Base selection** - Choose base zman (sunrise, sunset, alos, tzeis)
- **Direction** - Before sunrise, After sunrise, Before sunset, After sunset
- **Live preview** - See calculated time as you edit
- **Validation** - Real-time error checking
- **Save as draft** - Save without publishing

#### 6.3 Algorithm Editor - Advanced Mode
- **CodeMirror 6 integration** - Professional code editor
- **DSL syntax highlighting** - Color-coded formula elements
- **Autocomplete** - Suggest functions, primitives while typing
- **Inline validation** - Red squiggly lines for errors
- **Error tooltips** - Hover over error for explanation
- **Bracket matching** - Auto-close parentheses
- **Line numbers** - Easy reference
- **Undo/redo** - Full history
- **Format on save** - Auto-formatting

#### 6.4 AI Formula Generation
- **Natural language input** - Describe calculation in plain English or Hebrew
- **Example prompts** - Suggested starter prompts
- **AI processing** - Claude API generates DSL formula
- **Validation** - AI-generated formula automatically validated
- **Self-correction** - If invalid, AI retries with error context (up to 2 retries)
- **Confidence score** - Shows how confident AI is in the formula
- **Accept/Reject** - Review before applying
- **Regenerate** - Try again if not satisfied
- **Usage tracking** - Limited requests per month (e.g., 50)

#### 6.5 Hebrew & Bilingual Naming
- **Mandatory Hebrew name** - Required for all zmanim
- **Mandatory English name** - Required for all zmanim
- **Optional transliteration** - Phonetic spelling
- **Optional description** - Explain what the zman represents
- **Halachic notes field** - Markdown-supported commentary
- **Halachic source field** - Citation to Shulchan Aruch, Mishnah Berurah, etc.
- **Custom aliases** - Publishers can rename zmanim for their community (e.g., "Plag HaMincha" → "Earliest Maariv Time")

#### 6.6 Field Ownership & Registry Sync
- **Publisher owns copy** - Each field (description, transliteration, formula) is publisher's own
- **Source tracking** - System knows original registry value
- **Visual diff indicator** - "Different from Registry" badge
- **Sync button** - One-click revert to registry version
- **Selective sync** - Sync description but keep custom formula
- **Change history** - See what changed and when

#### 6.7 Preview & Testing
- **Live preview panel** - Right side of editor
- **Date selection** - Preview for any date
- **Location selection** - Choose from publisher's coverage areas or search any city
- **Search cities** - Find any city globally for testing
- **Calculated times** - See all zmanim calculated
- **Week view** - See entire week at once
- **Month view** - Calendar grid with all zmanim
- **Hebrew calendar toggle** - Switch between Gregorian and Hebrew months
- **Event detection** - Preview shows Shabbat/holiday zmanim

#### 6.8 Publishing & Versioning
- **Draft mode** - Work on algorithms without affecting users
- **Publish action** - Make algorithms live
- **Publish confirmation** - "This will update zmanim for X cities and Y users"
- **Bulk publish** - Publish all draft changes at once
- **Version history** - Track every change with timestamps
- **Visual diff** - Side-by-side comparison of versions
- **Rollback** - Restore previous version with one click
- **Change notes** - Add notes explaining why changes were made
- **Auto-invalidation** - Publishing clears cache automatically

#### 6.9 Import & Collaboration
- **Import defaults** - Bulk import standard zmanim from templates
- **Copy from publisher** - Fork another publisher's entire algorithm set
- **Copy single zman** - Adopt one zman from another publisher
- **Attribution** - System tracks source publisher
- **Linked zmanim** - Option to stay synced with source or break link
- **Restore deleted** - Undelete previously removed zmanim

---

### Coverage Management

#### 7.1 Coverage Area Definition
- **Add coverage** - Multi-step dialog
- **Coverage levels**:
  - **Continent** - Serve entire continent (e.g., Europe)
  - **Country** - Serve entire country (e.g., Israel, United States)
  - **Region** - Serve state/province (e.g., California, Ontario)
  - **City** - Serve specific city (e.g., Jerusalem, Brooklyn)
- **Map visualization** - See coverage areas on map (Leaflet or Mapbox)
- **Quick-select cities** - Common cities for rapid addition
- **Batch import** - Upload CSV of cities (future)
- **Coverage search** - Search while adding coverage

#### 7.2 Coverage Management
- **Coverage list** - All configured areas
- **Level badges** - Visual indicators (continent=purple, country=blue, region=green, city=yellow)
- **Display name** - "Paris, Île-de-France, France"
- **Priority setting** - 1-10 scale for match precedence
- **Active toggle** - Enable/disable coverage area without deleting
- **Delete coverage** - Remove area entirely
- **Cities covered count** - Estimate of how many cities included
- **Coverage stats** - Total areas, total cities

#### 7.3 Smart Matching
- **Hierarchical fallback** - If no city match, try region → country → continent
- **Priority resolution** - Higher priority wins when multiple publishers overlap
- **Match type indicator** - Shows users if publisher is city-specific or regional

---

### Analytics & Activity

#### 8.1 Dashboard
- **Publisher profile card** - Name, status (verified/pending), last updated
- **Algorithm status card** - Published/Draft, last edited
- **Coverage card** - Number of areas, total cities
- **Analytics card** - Calculations this month, total calculations
- **Recent activity** - Last 5-10 actions (algorithm updates, coverage changes, team additions)
- **Quick actions** - Links to edit profile, edit algorithm, manage coverage

#### 8.2 Analytics (Simple)
- **Total calculations** - All-time zmanim calculation count
- **Calculations this month** - Current month stats
- **Coverage areas** - Active areas count
- **Cities covered** - Estimate of reach
- **Coming soon indicators** - Placeholders for future charts/trends

#### 8.3 Activity Log (Placeholder)
- **Activity list** - All changes to publisher account
- **Action types** - Profile update, algorithm save, algorithm publish, coverage add/remove, user invited/removed
- **Actor tracking** - Who made the change (user or admin via impersonation)
- **Timestamp** - When action occurred
- **Filter by action type** - Narrow down log
- **Coming soon UI** - Currently empty, future feature

---

### Team Management

#### 9.1 Team Invitations
- **Invite by email** - Send invitation to colleague
- **Name + email required** - Identify team member
- **Auto-create account** - If email doesn't have Clerk account, one is created
- **Email notification** - Invitee receives email with setup link
- **Access granted** - Team member can immediately access publisher
- **Role assignment** - Owner vs. Member (future: granular permissions)

#### 9.2 Team List
- **Team member cards** - Photo/initials, name, email
- **Owner badge** - Indicates publisher creator
- **Joined date** - When added to team
- **Remove member** - Delete team member access (cannot remove owner or self)
- **Confirmation dialog** - Prevent accidental removal

---

### Publisher-Specific Tools

#### 10.1 Onboarding Wizard
- **First-time flow** - Guides new publishers through setup
- **Step 1: Welcome** - Introduction to platform
- **Step 2: Logo Upload** - Mandatory logo with crop/zoom editor or AI-generated initials
- **Step 3: Customize Zmanim** - Select essential zmanim, preview methods (GRA, MGA, 72min, 90min, etc.)
- **Step 4: Coverage** - Select geographic areas
- **Step 5: Review & Launch** - Confirm selections, publish
- **Progress indicator** - Visual stepper showing current step
- **Save & continue later** - Wizard state persists
- **Skip wizard** - Advanced users can skip to manual setup
- **Reset wizard** - Start over from scratch

#### 10.2 Request New Zman
- **Request form** - Multi-step wizard
- **Step 1: Basic Info** - Hebrew name, English name, transliteration
- **Step 2: Formula** - Describe calculation or use DSL editor
- **Step 3: Description** - What is this zman? When is it used?
- **Step 4: Halachic Context** - Sources, notes, reasoning
- **Step 5: Tags** - Select existing tags or request new tags
- **Tag approval** - New tags go through admin review
- **Auto-add option** - If approved, auto-add to publisher's list
- **Email notification** - Publisher notified when request is approved/rejected
- **Request tracking** - See status of submitted requests

---

## Admin Features

### Publisher Management

#### 11.1 Publisher Applications
- **Application queue** - List of pending publisher requests
- **Application details** - Name, email, organization, description, submitted date
- **Approve action** - Create verified publisher account
- **Reject action** - Decline with reason (email sent)
- **Verification workflow** - Change status to "verified"
- **Suspension** - Temporarily disable publisher
- **Reactivation** - Restore suspended publisher

#### 11.2 Publisher List
- **All publishers** - Complete list with search/filter
- **Status filter** - Verified, Pending, Suspended
- **Search** - By name or description
- **Publisher cards** - Name, logo, status, zmanim count, created date
- **Impersonation mode** - "View as Publisher" to troubleshoot
- **Publisher details** - Click for full profile

#### 11.3 Impersonation
- **View as Publisher** - Admin can access publisher dashboard as if they were that publisher
- **Session-based** - Stored in sessionStorage (no persistent cookies)
- **Visual indicator** - Yellow banner: "You are viewing as [Publisher Name]"
- **Exit impersonation** - Return to admin view
- **Audit logging** - All actions logged with "admin_impersonation" actor type
- **Permission preservation** - Admin has full publisher permissions while impersonating

### User Management

#### 12.1 Invite User to Publisher
- **Admin-initiated invite** - Add users to any publisher's team

- **Same workflow as publisher invite** - Email, name, auto-create account
- **Clerk integration** - Updates Clerk metadata with publisher access
- **No approval needed** - Admin action is instant

#### 12.2 Remove User from Publisher
- **User list** - All users with access to a publisher
- **Remove action** - Revoke access
- **Clerk metadata update** - Removes publisher ID from user's access list

### Zman Registry Management

#### 13.1 Master Zman Registry
- **Global zman catalog** - All zmanim available to all publishers
- **Create new registry zman** - Add zman to master list
- **Edit registry zman** - Update canonical names, descriptions, formulas
- **Tag management** - Create, edit, approve tags
- **Default formulas** - Standard calculations for each zman
- **Sort order** - Define display order for all publishers
- **Hide from catalog** - Mark zmanim as hidden (advanced use only)

#### 13.2 Zman Request Review
- **Request queue** - All publisher-submitted zman requests
- **Status filter** - Pending, Approved, Rejected
- **Search requests** - By name, publisher, category
- **Request details** - Full form data from publisher
- **Tag review** - Approve/reject new tag requests first (quality gate)
- **Edit before approval** - Admin can modify request details
- **Approve** - Add to master registry, email publisher, optionally add to publisher's list
- **Reject** - Email publisher with reason
- **Bulk actions** - Approve/reject multiple at once

### System Management

#### 14.1 Dashboard & Analytics
- **Platform stats** - Total publishers, active publishers, total users, total calculations
- **Recent activity** - System-wide actions
- **Cache stats** - Hit ratio, total cached entries, memory usage
- **Error monitoring** - Recent errors, error rate

#### 14.2 System Settings
- **Rate limits** - Adjust API rate limits per role (anonymous, user, publisher, admin)
- **Cache TTL** - Configure cache expiration (default 24 hours)
- **Feature flags** - Enable/disable features (AI generation, beta features)
- **Email templates** - Edit transactional email content (publisher approval, zman request approval)
- **Logo AI settings** - Configure initials generator (font, colors)

---

## Platform Features (All Users)

### Security & Authentication

#### 15.1 Authentication
- **Clerk integration** - Secure auth with email/password, social providers
- **JWT tokens** - Secure API requests
- **Role-based access** - Anonymous, User, Publisher, Admin
- **Session management** - Auto-logout on inactivity
- **Password reset** - Self-service password recovery
- **Multi-factor authentication** - Optional 2FA via Clerk

#### 15.2 Authorization
- **Publisher context** - X-Publisher-Id header for scoping
- **Permission checks** - Middleware validates user can access publisher
- **Team access control** - Users only see publishers they're assigned to
- **Admin overrides** - Admins can access everything via impersonation

### Performance

#### 16.1 Caching
- **Redis caching** - 24-hour TTL for zmanim calculations
- **Cache key structure** - `zmanim:{publisher_id}:{city_id}:{date}`
- **Cache invalidation** - Automatic on algorithm publish
- **Cache hit ratio** - Target >85%
- **Response time** - <100ms for cached results

#### 16.2 Database Optimization
- **PostGIS indexes** - Geo queries optimized
- **B-tree indexes** - Standard lookups
- **Partial indexes** - Published zmanim, active coverage
- **Query optimization** - Efficient JOINs, COALESCE for nullables

### API

#### 17.1 Public Endpoints
- **GET /api/publishers** - List publishers (with optional region filter, search, has_algorithm filter)
- **GET /api/publishers/:id** - Single publisher details
- **GET /api/cities** - Search cities
- **GET /api/cities/:id** - City details
- **GET /api/cities/:id/publishers** - Publishers covering a city
- **GET /api/zmanim** - Calculate zmanim by coordinates or city/publisher
- **GET /api/continents** - List continents
- **GET /api/countries** - List countries (optional continent filter)
- **GET /api/regions** - List regions (country filter)
- **POST /api/publisher-requests** - Submit publisher application (public)

#### 17.2 Authenticated Endpoints (Publisher)
- **GET /publisher/profile** - Own profile
- **PUT /publisher/profile** - Update profile
- **POST /publisher/logo/upload** - Upload logo
- **GET /publisher/zmanim** - List zmanim
- **GET /publisher/zmanim/:key** - Single zman
- **POST /publisher/zmanim** - Create custom zman
- **PUT /publisher/zmanim/:key** - Update zman
- **DELETE /publisher/zmanim/:key** - Delete custom zman
- **POST /publisher/zmanim/import** - Bulk import templates or from other publisher
- **GET /publisher/coverage** - List coverage areas
- **POST /publisher/coverage** - Add coverage
- **PUT /publisher/coverage/:id** - Update priority/active
- **DELETE /publisher/coverage/:id** - Remove coverage
- **GET /publisher/team** - List team members
- **POST /publisher/team/invite** - Invite team member
- **DELETE /publisher/team/:userId** - Remove team member
- **GET /publisher/analytics** - Analytics summary
- **GET /publisher/activity** - Activity log
- **GET /publisher/dashboard** - Dashboard summary
- **GET /publisher/onboarding** - Onboarding state
- **PUT /publisher/onboarding** - Update onboarding state
- **POST /publisher/onboarding/complete** - Complete onboarding
- **POST /publisher/onboarding/skip** - Skip onboarding
- **DELETE /publisher/onboarding** - Reset onboarding (deletes zmanim & coverage!)
- **GET /publisher/accessible** - List accessible publishers
- **POST /ai/generate-formula** - AI formula generation
- **POST /ai/explain-formula** - AI formula explanation
- **POST /publisher/zman-requests** - Submit new zman request
- **POST /publisher/copy-zman** - Copy zman from another publisher
- **GET /publisher/version-history/:zmanKey** - Version history
- **POST /publisher/restore-version** - Rollback to previous version

#### 17.3 Admin Endpoints
- **GET /admin/publishers** - All publishers with filters
- **POST /admin/publishers** - Create publisher manually
- **PUT /admin/publishers/:id/verify** - Verify publisher
- **PUT /admin/publishers/:id/suspend** - Suspend publisher
- **PUT /admin/publishers/:id/reactivate** - Reactivate

 publisher
- **POST /admin/impersonate/:publisherId** - Start impersonation session
- **POST /admin/publishers/:id/users/invite** - Invite user to publisher
- **DELETE /admin/publishers/:publisherId/users/:userId** - Remove user from publisher
- **GET /admin/stats** - Platform statistics
- **GET /admin/config** - System configuration
- **PUT /admin/config** - Update system configuration
- **GET /admin/zman-requests** - List zman requests
- **GET /admin/zman-requests/:id** - Request details
- **GET /admin/zman-requests/:id/tags** - Request's tag requests
- **POST /admin/zman-requests/:id/tags/:tagId/approve** - Approve tag
- **POST /admin/zman-requests/:id/tags/:tagId/reject** - Reject tag
- **PUT /admin/zman-requests/:id** - Approve/reject zman request
- **GET /admin/registry/zmanim** - Master registry zmanim
- **POST /admin/registry/zmanim** - Create registry zman
- **PUT /admin/registry/zmanim/:id** - Update registry zman

### Email Notifications

#### 18.1 Email Service (Resend Integration)
- **Publisher Application Approved** - Welcome email with login link
- **Publisher Application Rejected** - Explanation email
- **Team Member Invited** - Invitation to join publisher team
- **Zman Request Approved** - Notification that requested zman is now in registry
- **Zman Request Rejected** - Explanation with admin notes
- **Future**: Weekly digest, algorithm update notifications

### Error Handling

#### 19.1 User-Friendly Errors
- **Validation errors** - Highlight fields, show inline messages
- **Network errors** - Retry prompt, connection status indicator
- **404 pages** - Helpful "not found" with navigation
- **500 errors** - "Something went wrong" with refresh prompt
- **Rate limit errors** - "Too many requests, please wait" message

#### 19.2 Formula Validation Errors
- **Plain language** - "120° is too high" instead of "INVALID_SOLAR_ANGLE"
- **Suggestions** - "Try: solar(16.1, before_sunrise)"
- **Examples** - Show common values
- **Insert button** - One-click apply suggested fix

---

## Future Features (Mentioned in Docs)

### Coming Soon
- **Detailed analytics** - Charts, trends, geographic breakdowns
- **Activity logging** - Full audit trail (backend ready, UI pending)
- **Export zmanim** - Download CSV, iCal for events
- **Email subscriptions** - Daily zmanim emails
- **SMS notifications** - Text alerts for important times
- **Embedded widgets** - Iframe widgets for synagogue websites
- **Mobile apps** - Native iOS/Android
- **Offline support** - PWA with service workers, local calculation
- **API for developers** - Public API for third-party apps
- **Siddur integrations** - Partner with prayer apps
- **Community forums** - Publisher discussions
- **Halachic Q&A** - AI-powered question answering
- **Advanced permissions** - Granular team roles (viewer, editor, admin)
- **Drag-and-drop sort** - Reorder zmanim visually
- **CSV coverage import** - Bulk add cities
- **Calculation logs** - See when users viewed zmanim
- **Popular cities** - Trending locations
- **Social sharing** - Share zmanim on WhatsApp, Telegram

---

## Summary Statistics

### Feature Count by Category:
- **End User**: 30+ features across 4 major areas
- **Publisher**: 60+ features across 10 major areas
- **Admin**: 25+ features across 3 major areas
- **Platform**: 20+ infrastructure features

### Total Features: 135+ distinct features across 113 stories in 5 completed epics

This comprehensive list demonstrates Shtetl Zmanim's robust feature set, covering the entire lifecycle from publisher onboarding through end-user consumption, with sophisticated tools for collaboration, transparency, and accuracy.
