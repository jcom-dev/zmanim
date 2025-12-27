 see# Zmanim Corrections Page - UX Design Specification

_Created on 2025-12-22 by BMad_
_Generated using BMad Method - Create UX Design Workflow v1.0_

---

## Executive Summary

**Feature:** Unified Location Corrections Page

**Problem Solved:** Publishers with global coverage cannot override location data because the Coverage page doesn't display individual localities. Location correction features are currently scattered across multiple interfaces.

**Solution:** A consolidated Corrections page that serves as the single hub for all location data fixes, supporting both publisher-specific overrides and public correction requests.

**Core User Experience:**
When publishers discover incorrect location data (coordinates or elevation), they can:
1. Search for any locality in the 4M+ location database
2. View the location on an interactive map with current data
3. Choose to either override the data for their publisher OR request a public correction
4. Track the status of all their overrides and correction requests in one place

This design eliminates the global coverage limitation while creating an intuitive, educational interface that helps publishers understand the difference between publisher overrides and public corrections.

---

## 1. Project Context

### 1.1 Product Overview

**Shtetl Zmanim** is a multi-publisher platform for Jewish Zmanim where:
- Publishers define calculation formulas using a DSL (Domain Specific Language)
- Users get accurate zmanim (Zmanim) for their specific location
- Location data (coordinates, elevation) comes from a global geo_localities database with ~4M localities
- Accuracy of location data is critical - even small coordinate errors can affect prayer time calculations

### 1.2 Target Users

**Primary Users:** Publishers (individuals or organizations publishing zmanim data)

**User Types:**
1. **Global Coverage Publishers** - Serve users worldwide, have no specific locality coverage configured
2. **Regional Publishers** - Serve specific cities, regions, or countries
3. **Precision-Focused Publishers** - May need different coordinate precision for their calculation methodology

**User Scenarios:**
- Publisher testing their formula notices times seem wrong for a location → discovers coordinates are incorrect
- Publisher receives user feedback: "The times for Salford are wrong" → needs to investigate and fix
- Publisher using a specific calculation methodology needs different elevation data than the public database provides

### 1.3 Technical Context

**Stack:** Next.js 16 (TypeScript/React), Go API, PostgreSQL+PostGIS
**Tables:** `geo_localities` (public data), `publisher_location_overrides` (publisher-specific), `location_correction_requests` (public requests)
**Existing UI:** Dark-themed publisher portal with tab navigation

---

## 2. Core User Experience Design

### 2.1 Defining Experience

**The ONE thing this feature does:**
Makes fixing location data issues effortless and intuitive, whether the fix benefits everyone or just one publisher.

**Core user journey:**
Search → Discover → Decide → Act → Track

**Emotional goal:**
Publishers should feel **confident and empowered** - they understand exactly what type of correction they need and can see their correction history transparently.

### 2.2 The Two-Path Problem

**Core UX Challenge:**
How do we help publishers understand and choose between two fundamentally different actions?

**Path 1: Publisher Override** (affects only my publisher)
- Use case: "The public data is fine for others, but I need different values for my methodology"
- Use case: "I need a quick fix while waiting for public correction approval"
- Result: Only this publisher's users see different zmanim calculations

**Path 2: Public Correction Request** (affects all publishers)
- Use case: "The coordinates in the database are factually wrong"
- Use case: "Everyone would benefit from corrected data"
- Result: Administrators review evidence and update the public database

**UX Solution:**
- **Visual separation** - Two distinct sections/cards that are never mixed
- **Educational empty states** - First-time users see explanations of both types
- **Clear labeling** - "My Publisher Overrides" vs "My Public Correction Requests"
- **Contextual guidance** - Action cards explain when to use each type
- **Status transparency** - Public requests show Pending/Approved/Rejected status

---

## 3. Information Architecture

### 3.1 Page Structure

**Corrections Page (Main View)**

```
┌─────────────────────────────────────────────────────────┐
│ Page Header                                             │
│ • Location Corrections                                  │
│ • Subtitle explaining the page                          │
│ • Search bar (prominent, always visible)                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Section 1: My Publisher Overrides                       │
│ • Table of overrides (if any exist)                     │
│ • Empty state card (if none exist)                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Section 2: My Public Correction Requests                │
│ • Table of requests with status (if any exist)          │
│ • Empty state card (if none exist)                      │
└─────────────────────────────────────────────────────────┘
```

**Location Search & Action View**

```
┌────────────────────┬────────────────────────────────────┐
│ LEFT (40%)         │ RIGHT (60%)                        │
│                    │                                    │
│ Search Input       │ Interactive Map                    │
│ Search Results     │ • Shows selected location          │
│                    │ • Current pin (blue)               │
│ Selected Location  │ • Override pin (purple, if editing)│
│ Details:           │ • Correction pin (green, if edit)  │
│ • Name             │                                    │
│ • Coordinates      │ Zoom controls                      │
│ • Elevation        │ Center button                      │
│ • Source           │                                    │
│                    │                                    │
│ Action Cards:      │                                    │
│ ┌────────────────┐ │                                    │
│ │ Override for   │ │                                    │
│ │ My Publisher   │ │                                    │
│ │ [Expands]      │ │                                    │
│ └────────────────┘ │                                    │
│ ┌────────────────┐ │                                    │
│ │ Request Public │ │                                    │
│ │ Correction     │ │                                    │
│ │ [Expands]      │ │                                    │
│ └────────────────┘ │                                    │
└────────────────────┴────────────────────────────────────┘
```

### 3.2 Navigation Flow

**Entry Points:**
1. Publisher tab navigation → "Corrections" tab (main view)
2. Main view → Click search bar → Search & Action view
3. Main view → Click row in table → Search & Action view with that location loaded

**Navigation Patterns:**
- Search view has back button → Returns to main view
- Success modals offer: "View My Overrides/Requests" (→ main view) or "Search Another Location" (→ clear search)
- All "View on Map" actions → Load Search & Action view with location

---

## 4. Detailed Component Specifications

### 4.1 Main View - Empty States

**My Publisher Overrides - Empty State Card**

Visual Design:
- Icon: Settings/gear icon (24px, muted color)
- Card style: Subtle border, light background (dark mode: darker background)
- Padding: Generous (24px)

Content:
```
🔧 No Location Overrides

Override coordinates or elevation for specific locations that only
affect your publisher's zmanim calculations. The public database
remains unchanged.

When to use: Use this when the public data is correct for most
publishers, but you need different values for your calculation
methodology.
```

---

**My Public Correction Requests - Empty State Card**

Visual Design:
- Icon: Globe icon (24px, muted color)
- Card style: Subtle border, light background (dark mode: darker background)
- Padding: Generous (24px)

Content:
```
🌍 No Correction Requests

Request corrections to location coordinates or elevation in the
public database. When approved, all publishers using this location
will benefit from accurate data.

When to use: Use this when you've verified the coordinates or
elevation are factually incorrect.

Status Legend: 🟡 Pending • 🟢 Approved • 🔴 Rejected
```

### 4.2 Main View - Active States (Tables)

**My Publisher Overrides Table**

Columns:
1. **Location** - City, Region, Country (left-aligned)
   - Font: Medium weight, primary text color
   - Secondary line: Region, Country in smaller, muted text
2. **Override Type** - Badge component
   - "Coordinates" (blue badge)
   - "Elevation" (green badge)
   - "Both" (purple badge)
3. **Created** - Date (relative format: "2 days ago" or absolute: "Dec 20, 2025")
4. **Actions** - Icon buttons
   - View on Map (map icon)
   - Edit (pencil icon)
   - Remove (trash icon, destructive color)

Table Behavior:
- Sorting: Most recent first (created date descending)
- Hover: Entire row highlights subtly
- Click row: Navigates to Search & Action view with location loaded
- Click action icons: Perform specific action
- Max height: Scrollable if > 10 rows
- Empty state: Shows the empty state card

---

**My Public Correction Requests Table**

Columns:
1. **Location** - City, Region, Country (same style as overrides table)
2. **Correction Type** - Badge (same as override type)
3. **Status** - Color-coded badge:
   - 🟡 **Pending** (yellow/amber)
   - 🟢 **Approved** (green)
   - 🔴 **Rejected** (red)
4. **Submitted** - Date (same format as overrides)
5. **Actions** - Icon buttons
   - View Details (eye icon)
   - View on Map (map icon)

Table Behavior:
- Sorting: Pending first, then most recent
- Hover: Entire row highlights
- Click row: Opens location in Search & Action view
- Click "View Details": Expands row inline to show evidence, admin response, etc.
- Max height: Scrollable if > 10 rows
- Empty state: Shows the empty state card

### 4.3 Search & Action View - Location Details Panel

**Search Input**
- Large input field (48px height)
- Placeholder: "Search by city, region, or coordinates..."
- Icon: Search magnifying glass (left side)
- Clear button (X icon, right side, appears when typing)
- Dropdown: Search results appear below as user types

**Search Results Dropdown**
- Each result shows:
  ```
  Salford, United Kingdom
  (1 locality)
  ```
- Hover: Background highlight
- Click: Loads location details and centers map
- Max results shown: 10 (with "Show more results" if > 10)

**Selected Location Details Card**

```
┌─────────────────────────────────────────────────┐
│ Salford, Greater Manchester                     │
│ United Kingdom                                  │
│ Locality ID: 4993250                            │
│ [Status Badge if applicable]                    │
├─────────────────────────────────────────────────┤
│ Current Data                                    │
│                                                 │
│ Coordinates:                                    │
│   Latitude:  53.4875° N                         │
│   Longitude: -2.2901° W                         │
│                                                 │
│ Elevation: 42m                                  │
│                                                 │
│ Source: Overture Maps                           │
│ Last Updated: Nov 2024                          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Your Existing Data (if applicable)              │
│                                                 │
│ ✓ Override Active: Set on Dec 15, 2025         │
│   Coordinates: 53.4880° N, -2.2905° W           │
│                                                 │
│ ⏳ Pending Request: Submitted Dec 10, 2025      │
│   Requested correction to coordinates           │
└─────────────────────────────────────────────────┘
```

### 4.4 Action Cards (Collapsed State)

**Card 1: Override for My Publisher**

```
┌─────────────────────────────────────────────────┐
│ 🔧 Override for My Publisher                    │
│                                                 │
│ Use different coordinates or elevation for YOUR │
│ publisher only                                  │
│                                                 │
│ Status: No override set                         │
│                                                 │
│ [Create Override] button                        │
└─────────────────────────────────────────────────┘
```

If override exists:
```
│ Status: ✓ Override active since Dec 15, 2025    │
│                                                 │
│ [Edit Override] [Remove Override] buttons       │
```

**Card 2: Request Public Correction**

```
┌─────────────────────────────────────────────────┐
│ 🌍 Request Public Correction                    │
│                                                 │
│ Request a correction to the public database     │
│ for all publishers                              │
│                                                 │
│ Status: No requests submitted                   │
│                                                 │
│ [Request Correction] button                     │
└─────────────────────────────────────────────────┘
```

If pending request exists:
```
│ ⚠️ You have a pending correction request        │
│ Submitted Dec 10, 2025 | Status: Pending Review │
│ Requested: Coordinates update                   │
│                                                 │
│ [Update Request] button                         │
```

If approved/rejected request exists:
```
│ ✅ Request approved on Dec 18, 2025             │
│ The public database has been updated            │
│                                                 │
│ [Request New Correction] button                 │
```

### 4.5 Action Cards (Expanded State)

**Override for My Publisher - Expanded Form**

```
┌─────────────────────────────────────────────────┐
│ 🔧 Override Location Data                       │
│                                                 │
│ What would you like to override?                │
│ ○ Coordinates                                   │
│ ○ Elevation                                     │
│ ○ Both                                          │
│                                                 │
│ ─── (If Coordinates selected) ───               │
│                                                 │
│ Current Coordinates:                            │
│   Latitude:  53.4875° N (grayed, read-only)     │
│   Longitude: -2.2901° W (grayed, read-only)     │
│                                                 │
│ Your Override Coordinates:                      │
│   Latitude:  [___________] ° [N ▼]              │
│   Longitude: [___________] ° [W ▼]              │
│                                                 │
│ ─── (If Elevation selected) ───                 │
│                                                 │
│ Current Elevation:                              │
│   42m (grayed, read-only)                       │
│                                                 │
│ Your Override Elevation:                        │
│   [_______] meters                              │
│                                                 │
│ ───────────────────────────────────────         │
│                                                 │
│ Reason for Override (optional):                 │
│ [Text area]                                     │
│ Why are you using different values? This helps  │
│ your team understand your methodology.          │
│                                                 │
│ [Save Override] [Cancel] buttons                │
└─────────────────────────────────────────────────┘
```

Map Behavior When Override Form Active:
- Shows TWO pins:
  - Blue pin: Current public location
  - Purple/Orange pin: Override location (updates as user types)
- Distance indicator: "15.2m difference" shown below map

---

**Request Public Correction - Expanded Form**

```
┌─────────────────────────────────────────────────┐
│ 🌍 Request Public Correction                    │
│                                                 │
│ What needs to be corrected?                     │
│ ○ Coordinates are incorrect                     │
│ ○ Elevation is incorrect                        │
│ ○ Both are incorrect                            │
│                                                 │
│ ─── (If Coordinates selected) ───               │
│                                                 │
│ Current Coordinates (Incorrect):                │
│   Latitude:  53.4875° N (grayed, read-only)     │
│   Longitude: -2.2901° W (grayed, read-only)     │
│                                                 │
│ Correct Coordinates Should Be:                  │
│   Latitude:  [___________] ° [N ▼]              │
│   Longitude: [___________] ° [W ▼]              │
│                                                 │
│ ─── (If Elevation selected) ───                 │
│                                                 │
│ Current Elevation (Incorrect):                  │
│   42m (grayed, read-only)                       │
│                                                 │
│ Correct Elevation Should Be:                    │
│   [_______] meters                              │
│                                                 │
│ ───────────────────────────────────────         │
│                                                 │
│ Evidence/Source (required): *                   │
│ [Text area]                                     │
│ How did you verify these coordinates?           │
│ (e.g., Google Maps, official government source, │
│ GPS measurement, local knowledge)               │
│                                                 │
│ [Submit Request] [Cancel] buttons               │
└─────────────────────────────────────────────────┘
```

Map Behavior When Correction Form Active:
- Shows TWO pins:
  - Red pin: Current incorrect location
  - Green pin: Proposed correct location (updates as user types)
- Distance indicator: "142m difference" shown below map

### 4.6 Validation & Error States

**Validation Rules:**

1. **Identical Values Check** (applies to both override and public correction)
   - Trigger: When user clicks "Save Override" or "Submit Request"
   - Check: Are new coordinates/elevation identical to current values?
   - Error Display: Inline below form fields
   - Message: "⚠️ The values you entered are identical to the current data. Please enter different values or cancel."
   - Button State: Primary button disabled until values change

2. **Evidence Field Required** (public corrections only)
   - Trigger: When user clicks "Submit Request"
   - Check: Is evidence/source field empty?
   - Error Display: Inline below evidence field
   - Message: "⚠️ Please provide evidence or source for this correction. This helps administrators verify the request."
   - Button State: Primary button disabled until evidence is entered

**No other validation applied** - Trust publishers to enter reasonable values.

### 4.7 Confirmation Modals

**Override Created Successfully**

```
┌─────────────────────────────────────────────────┐
│                     ✅                          │
│                                                 │
│         Override Created Successfully           │
│                                                 │
│ Location override has been saved for            │
│ Salford, United Kingdom                         │
│                                                 │
│ What was overridden:                            │
│ • Coordinates: 53.4875° N, -2.2901° W →         │
│               53.4880° N, -2.2905° W            │
│                                                 │
│ This override only affects your publisher's     │
│ zmanim calculations.                            │
│                                                 │
│ [View My Overrides]  [Search Another Location]  │
│                                          [X]    │
└─────────────────────────────────────────────────┘
```

Buttons:
- **Primary:** "View My Overrides" → Returns to main Corrections page
- **Secondary:** "Search Another Location" → Clears search, stays on search view
- **Tertiary:** X close icon → Stays on current location in search view

---

**Correction Request Submitted**

```
┌─────────────────────────────────────────────────┐
│                     ✅                          │
│                                                 │
│        Correction Request Submitted             │
│                                                 │
│ Your correction request for                     │
│ Salford, United Kingdom                         │
│ has been submitted to administrators.           │
│                                                 │
│ What you requested:                             │
│ • Coordinates: 53.4875° N, -2.2901° W →         │
│               53.4880° N, -2.2905° W            │
│                                                 │
│ Status: 🟡 Pending Review                       │
│                                                 │
│ You'll be notified when this request is         │
│ reviewed. You can track the status in your      │
│ Correction Requests list.                       │
│                                                 │
│ [View My Requests]   [Search Another Location]  │
│                                          [X]    │
└─────────────────────────────────────────────────┘
```

---

**Remove Override Confirmation**

```
┌─────────────────────────────────────────────────┐
│                     ⚠️                          │
│                                                 │
│         Remove Location Override?               │
│                                                 │
│ This will revert to using the public            │
│ coordinates for Salford, United Kingdom.        │
│ Your zmanim calculations will use the standard  │
│ database values.                                │
│                                                 │
│ Current override:                               │
│ • Coordinates: 53.4880° N, -2.2905° W           │
│                                                 │
│ Will revert to:                                 │
│ • Coordinates: 53.4875° N, -2.2901° W           │
│                                                 │
│ [Remove Override]                    [Cancel]   │
│ (destructive/red)                               │
└─────────────────────────────────────────────────┘
```

### 4.8 Special States & Edge Cases

**State: Location Has Existing Override**
- When user opens location in search view
- Action Card 1 shows:
  - "Override active since [date]"
  - "Edit Override" button (instead of "Create Override")
  - "Remove Override" button (destructive action)
- When "Edit Override" clicked:
  - Form expands with current override values pre-filled
  - Button text: "Update Override" (instead of "Save Override")
  - Additional info: "Last updated: [date]"

**State: Location Has Pending Public Request**
- When user opens location in search view
- Warning banner appears above Action Card 2:
  ```
  ⚠️ You have a pending correction request for this location
  Submitted Dec 10, 2025 | Status: Pending Review
  Requested: Coordinates update
  ```
- Button changes: "Request Correction" → "Update Request"
- When "Update Request" clicked:
  - Form expands with pending request values pre-filled
  - Submit updates the existing request (doesn't create new one)

**State: Public Request Was Approved**
- Info banner above Action Card 2:
  ```
  ✅ Your correction request was approved on Dec 18, 2025
  The public database has been updated with your corrections.
  ```
- Button: "Request New Correction" (allows submitting another if needed)

**State: Public Request Was Rejected**
- Info banner above Action Card 2:
  ```
  ❌ Your correction request was declined on Dec 18, 2025
  Reason: "Coordinates verified as correct via official survey data"
  ```
- Button: "Request New Correction" (allows resubmitting with better evidence)

**State: Both Override AND Pending Request Exist**
- Both Action Cards show their respective states
- No conflict - user can have override while waiting for public correction approval

**State: Request History**
- Below current request status, small link: "View request history (3)"
- Expands inline to show previous requests:
  ```
  Previous Requests:
  • Dec 5, 2025 - Coordinates - Rejected
  • Nov 20, 2025 - Elevation - Approved
  ```

---

## 5. Visual Foundation

### 5.1 Existing Design System - "Midnight Trust"

**Decision:** Use the existing Zmanim design system for consistency across all pages.

The Corrections page will match the existing publisher portal design exactly, using the established "Midnight Trust" theme.

**Current Design System:**

**Primary Color:** Blue (#3B82F6 / hsl(217 91% 60%))
- Used for: Primary buttons, links, focus states, active states

**Semantic Colors:**
- Success: Emerald (#10B981)
- Warning: Amber (#F59E0B)
- Error: Red (#EF4444)
- Info: Blue (#3B82F6)

**Light Mode:**
- Background: hsl(210 20% 98%) - Very light blue-gray
- Card: #FFFFFF - Pure white
- Foreground: hsl(222 47% 11%) - Very dark blue-gray
- Muted: hsl(210 40% 96%) - Light gray
- Muted Foreground: hsl(215 16% 47%) - Medium gray
- Border: hsl(214 32% 80%) - Light blue-gray

**Dark Mode:**
- Background: hsl(222 47% 11%) - Very dark blue-gray
- Card: hsl(217 33% 17%) - Dark blue-gray
- Foreground: hsl(210 40% 98%) - Very light
- Muted: hsl(217 33% 17%) - Dark card color
- Muted Foreground: hsl(215 20% 65%) - Light gray
- Border: hsl(217 33% 30%) - Dark border

**Utility Classes Already Available:**
- `.status-badge-success` - Emerald background, high contrast
- `.status-badge-warning` - Amber background, high contrast
- `.status-badge-error` - Red background, high contrast
- `.status-badge-pending` - Blue background, high contrast
- `.status-badge-neutral` - Gray background, high contrast
- `.alert-warning` - Amber alert boxes with border
- `.alert-error` - Red alert boxes
- `.alert-success` - Emerald alert boxes
- `.alert-info` - Blue alert boxes
- `.btn-warning` - Amber action buttons
- `.btn-error` - Red destructive buttons
- `.btn-success` - Emerald success buttons

**Shadows:**
- Soft: `0 2px 16px rgba(0, 0, 0, 0.08)`
- Medium: `0 4px 24px rgba(0, 0, 0, 0.12)`
- Large: `0 8px 40px rgba(0, 0, 0, 0.16)`

**Border Radius:**
- Default: 0.5rem (8px)
- Large: 12px
- XL: 16px

**Transitions:**
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (Apple-style smooth)

**No custom themes needed** - all design decisions below use the existing Tailwind + shadcn/ui components and utility classes.

### 5.2 Typography System

**Font Families (Already Configured):**
- **Sans-serif:** `-apple-system, BlinkMacSystemFont, SF Pro Display, Segoe UI, system-ui, sans-serif`
  - Apple-style system fonts for native feel and performance
- **Hebrew (when needed):** Noto Sans Hebrew, Arial Hebrew, David, sans-serif
- **Monospace:** Use default monospace for coordinates, IDs, technical data

**Type Scale (Use Tailwind utilities):**
- H1: `text-2xl` or `text-3xl` (24-30px) - Page titles
- H2: `text-xl` (20px) - Section headers
- H3: `text-lg` (18px) - Card headers
- Body: `text-base` (16px) - Default text
- Small: `text-sm` (14px) - Secondary text, captions
- Tiny: `text-xs` (12px) - Labels, badges

**Font Weights (Use Tailwind utilities):**
- Regular: `font-normal` (400) - Body text
- Medium: `font-medium` (500) - Emphasis, labels
- Semibold: `font-semibold` (600) - Headings, buttons
- Bold: `font-bold` (700) - Strong emphasis (use sparingly)

**Line Heights:**
- Use Tailwind defaults (`leading-tight`, `leading-normal`, `leading-relaxed`)

### 5.3 Spacing System

**Use Tailwind Spacing Scale:**
- Tailwind's spacing scale (0-96) with 4px base unit
- Common values: `p-4`, `mb-6`, `gap-8`, etc.

**Component Spacing Recommendations:**
- Card padding: `p-6` (24px)
- Form field spacing: `space-y-4` (16px)
- Button padding: Tailwind button utilities from shadcn/ui
- Table cell padding: `px-4 py-3`
- Section spacing: `space-y-8` or `space-y-12`

### 5.4 Layout Grid

**Responsive Breakpoints (Tailwind defaults):**
- Mobile: < 640px (sm)
- Tablet: 640px - 1024px (md, lg)
- Desktop: > 1024px (xl, 2xl)

**Desktop (> 1024px):**
- Max container width: Use Tailwind `max-w-7xl` (1280px)
- Two-column split: `grid grid-cols-5 gap-6` → 2 cols / 3 cols
- Use existing layout patterns from other pages

**Tablet (768px - 1024px):**
- Responsive grid: `grid-cols-1 lg:grid-cols-5`
- Tables: Horizontal scroll if needed

**Mobile (< 768px):**
- Single column: `grid-cols-1`
- Stack all content vertically
- Tables: Convert to card view (like other pages)

---

## 6. UX Pattern Decisions

### 6.1 Button Hierarchy

**Primary Actions:**
- Style: Filled, primary color background, white text
- Use: Main action on screen ("Save Override", "Submit Request")
- Hover: Slightly darker shade
- Disabled: 50% opacity, no hover effect

**Secondary Actions:**
- Style: Outlined, primary color border and text, transparent background
- Use: Alternative actions ("Cancel", "Search Another Location")
- Hover: Light primary color background

**Destructive Actions:**
- Style: Filled, error color background (red), white text
- Use: Dangerous actions ("Remove Override")
- Hover: Darker red
- Confirmation: Always require confirmation dialog

**Tertiary/Ghost Actions:**
- Style: Text only, primary color text, no border or background
- Use: Low-priority actions ("View history", close icons)
- Hover: Light background

### 6.2 Feedback Patterns

**Success:**
- Pattern: Modal dialog for major actions (save override, submit request)
- Style: Green checkmark icon, success message, action buttons
- Duration: User-dismissed (not auto-close)
- Position: Centered overlay

**Error:**
- Pattern: Inline below form fields for validation errors
- Style: Red warning icon, error text in red
- Duration: Persistent until fixed
- Position: Directly below the problematic field

**Warning:**
- Pattern: Banner above action cards for informational warnings
- Style: Amber/yellow background, warning icon, informational text
- Example: "You have a pending request"
- Duration: Persistent while condition exists

**Loading:**
- Pattern: Spinner + text for API calls
- Style: Primary color spinner, "Loading..." text
- Position: Replace button content during submission
- Example: "Save Override" button → [Spinner] "Saving..."

### 6.3 Form Patterns

**Label Position:**
- Above input fields
- Bold or medium weight
- Required indicator: Asterisk (*) in error color after label

**Validation Timing:**
- onSubmit: Check for identical values, required fields
- Not onChange or onBlur (don't interrupt user while typing)

**Error Display:**
- Inline below field
- Red text with warning icon
- Specific message explaining what's wrong
- Field border changes to error color

**Help Text:**
- Below input field, above error space
- Muted text color
- Provides context: "How did you verify these coordinates?"

**Input Types:**
- Text inputs: Standard bordered inputs
- Dropdowns: Native select or custom dropdown (N/S/E/W)
- Text areas: Multi-line, auto-expanding preferred
- Radio buttons: For mutually exclusive choices (override type)

### 6.4 Modal Patterns

**Size Variants:**
- Small: Confirmation dialogs (remove override) - max-width: 400px
- Medium: Success modals - max-width: 500px
- Large: Not used in this feature

**Dismiss Behavior:**
- Explicit close required (X button or action button)
- ESC key closes modal
- Click outside: Does NOT close (prevents accidental dismissal)

**Focus Management:**
- Auto-focus on primary button when modal opens
- Tab cycles through modal elements only
- Return focus to trigger element when closed

### 6.5 Table Patterns

**Hover State:**
- Entire row highlights with subtle background color change
- Cursor changes to pointer
- Indicates row is clickable

**Click Behavior:**
- Click row: Navigate to detail view (Search & Action view with location)
- Click action icon: Perform specific action (don't navigate)

**Sorting:**
- Default: Most recent first (created/submitted date)
- Visual indicator: Sort arrow in column header (if sortable)
- For requests: Pending status prioritized, then by date

**Empty State:**
- Show empty state card instead of empty table
- Educational content explaining the feature

**Responsive:**
- Desktop: Full table with all columns
- Tablet: May hide less important columns
- Mobile: Convert to card list view (stack fields vertically)

### 6.6 Status Badge Patterns

**Visual Design:**
- Small pill shape (rounded corners)
- Uppercase text or sentence case
- Icon optional (dot or emoji)

**Color Coding:**
- 🟡 Pending: Yellow/amber background, darker amber text
- 🟢 Approved: Green background, darker green text
- 🔴 Rejected: Red background, darker red text
- 🔵 Override types: Blue/purple/green based on type

**Placement:**
- In tables: Aligned in status column
- In cards: Upper right corner or below title
- In banners: Inline with warning message

### 6.7 Map Interaction Patterns

**Pin Colors:**
- **Blue pin:** Current public location (default state)
- **Purple/Orange pin:** Publisher override location (when editing override)
- **Red pin:** Current incorrect location (when requesting correction)
- **Green pin:** Proposed correct location (when requesting correction)

**Pin Interaction:**
- Pins are NOT draggable (coordinates entered via form only)
- Click pin: Shows popup with coordinate details
- Map is pannable and zoomable

**Controls:**
- Zoom: +/- buttons
- Center: Button to recenter on selected location
- Style: Match existing Coverage page map style

**Difference Indicator:**
- When two pins visible: Show distance between them
- Display: "15.2m difference" below map
- Updates live as user types coordinates

---

## 7. Responsive Design & Accessibility

### 7.1 Responsive Breakpoints

**Desktop (≥ 1024px):**
- Full two-column layout in Search & Action view (40% / 60%)
- Tables show all columns
- Side-by-side action cards

**Tablet (768px - 1023px):**
- Two-column layout maintained (45% / 55%)
- Tables may hide less critical columns
- Action cards still side-by-side if space allows

**Mobile (< 768px):**
- Single column, vertical stack
- Search & Action view:
  - Search input + results: Full width
  - Location details: Full width
  - Map: Full width, height: 300px
  - Action cards: Stacked vertically, full width
- Tables: Convert to card list view
  - Each row becomes a card
  - Fields stack vertically
  - Actions at bottom of card

### 7.2 Touch Targets (Mobile)

**Minimum Touch Target Size:** 44x44px (iOS HIG standard)

Applied to:
- All buttons
- All clickable rows
- All form inputs
- All action icons
- Map controls

### 7.3 Accessibility Requirements

**Target Compliance Level:** WCAG 2.1 Level AA

**Key Requirements:**

**Color Contrast:**
- Text vs background: Minimum 4.5:1 ratio (normal text)
- Large text (18pt+): Minimum 3:1 ratio
- UI components: Minimum 3:1 ratio
- Status badges: Ensure text readable against background

**Keyboard Navigation:**
- All interactive elements accessible via Tab
- Logical tab order (top to bottom, left to right)
- Focus indicators: Visible 2px outline in primary color
- No keyboard traps
- Shortcuts: ESC closes modals, Enter submits forms

**ARIA Labels:**
- Form inputs: Proper label associations via `<label for="id">`
- Buttons: Descriptive text or aria-label
- Status badges: aria-label explains meaning ("Status: Pending Review")
- Map: aria-label="Interactive map showing location"
- Modals: role="dialog", aria-labelledby, aria-describedby

**Screen Reader Support:**
- All meaningful images: alt text
- Icon-only buttons: aria-label
- Status changes: aria-live regions for dynamic updates
- Form errors: Associated with fields via aria-describedby

**Form Accessibility:**
- Required fields: aria-required="true" + visual indicator
- Error messages: aria-invalid="true" + aria-describedby
- Field hints: Associated via aria-describedby
- Fieldsets: Group related fields (radio buttons) with legend

**Testing Strategy:**
- Automated: Lighthouse accessibility audit (target: 90+ score)
- Manual: Keyboard-only navigation testing
- Screen reader: Test with NVDA (Windows) or VoiceOver (Mac)

---

## 8. Implementation Guidance

### 8.1 Component Reusability

**Shared Components to Build:**

1. **LocationSearchInput**
   - Props: onSelect, placeholder, initialValue
   - Reusable: Could be used in other location-selection contexts

2. **LocationDetailsCard**
   - Props: location, showOverride, showRequest
   - Displays current coordinates, elevation, source

3. **ActionCard**
   - Props: title, description, icon, status, onExpand, children (form)
   - Generic expandable card component

4. **CoordinateInput**
   - Props: label, value, onChange, readOnly, error
   - Latitude/longitude input with N/S/E/W dropdown
   - Reusable: Any coordinate input needs

5. **StatusBadge**
   - Props: status (pending/approved/rejected), type (override-type)
   - Consistent badge rendering across tables and cards

6. **ConfirmationModal**
   - Props: title, message, primaryAction, secondaryAction, icon
   - Reusable for all confirmation dialogs

7. **SuccessModal**
   - Props: title, message, details, actions
   - Reusable for success feedback

8. **LocationMap**
   - Props: center, pins[], onPinClick, showDistance
   - Interactive map with multiple pin support
   - Reusable: Coverage page already uses maps

### 8.2 State Management

**Component State:**
- Search input value
- Selected location
- Expanded action card (override or request)
- Form field values
- Validation errors

**Server State (API):**
- Publisher's overrides list
- Publisher's correction requests list
- Location search results
- Location details
- Submit override mutation
- Submit request mutation
- Delete override mutation

**Suggested Approach:**
- Use React hooks (useState, useEffect) for local component state
- Use your existing `useApi()` hook for data fetching
- Consider React Query or SWR for server state caching and mutations

### 8.3 API Endpoints (Already Exist!)

**✅ All backend infrastructure is already implemented.**

**Existing Endpoints:**
```
GET /auth/location-overrides
  → Returns publisher's overrides list ✅

GET /auth/correction-requests
  → Returns publisher's correction requests with status ✅

POST /auth/location-overrides
  → Create override ✅

PUT /auth/location-overrides/{id}
  → Update existing override ✅

DELETE /auth/location-overrides/{id}
  → Delete override ✅

POST /auth/correction-requests
  → Submit new correction request ✅
```

**Existing Components:**
- `LocationOverrideDialog.tsx` - Dialog for creating/editing overrides ✅
- `CorrectionRequestDialog.tsx` - Dialog for submitting correction requests ✅
- `/publisher/correction-requests/page.tsx` - Table showing requests ✅

**What Needs to Be Built (UI Only):**
1. **New unified Corrections page** (`/publisher/corrections/page.tsx`)
   - Combines overrides table + requests table on one page
   - Add prominent search bar at top
   - Reuse existing empty state patterns

2. **New search & action view** (can be same page or sub-route)
   - Location search functionality
   - Map display (reuse existing map components from Coverage)
   - Reuse existing LocationOverrideDialog
   - Reuse existing CorrectionRequestDialog

3. **Remove overrides UI from Coverage page**
   - Keep "View on Map" functionality
   - Remove LocationOverrideDialog integration

**No backend changes needed** - this is purely UI consolidation!

### 8.4 Database Schema (Already Exists)

**✅ Tables and indexes already implemented in migration files.**

See:
- `db/migrations/00000000000001_schema.sql`
- Tables: `publisher_location_overrides`, `location_correction_requests`
- SQLc queries: `api/internal/db/queries/location_overrides.sql`, `correction_requests.sql`
- Handlers: `api/internal/handlers/location_overrides.go`, `correction_requests.go`

### 8.5 Key User Flows (Implementation Checklist)

**Flow 1: Create Publisher Override**
1. ✅ User clicks search bar on Corrections main page
2. ✅ Navigate to Search & Action view
3. ✅ User types location name → API search call
4. ✅ Display search results dropdown
5. ✅ User selects location → Load location details, center map
6. ✅ Display location details card + action cards
7. ✅ User clicks "Create Override" → Expand form inline
8. ✅ User selects override type (coordinates/elevation/both)
9. ✅ User enters new values → Map updates with purple pin, shows distance
10. ✅ User clicks "Save Override" → Validate (not identical)
11. ✅ Submit POST request → Show loading state
12. ✅ On success → Show success modal
13. ✅ User clicks "View My Overrides" → Return to main page with override in table

**Flow 2: Submit Public Correction Request**
1. ✅ User navigates to Search & Action view (same as Flow 1, steps 1-6)
2. ✅ User clicks "Request Correction" → Expand form inline
3. ✅ User selects correction type
4. ✅ User enters correct values → Map updates with red/green pins, shows distance
5. ✅ User enters evidence (required)
6. ✅ User clicks "Submit Request" → Validate (not identical, evidence required)
7. ✅ Submit POST request → Show loading state
8. ✅ On success → Show success modal
9. ✅ User clicks "View My Requests" → Return to main page with request in table

**Flow 3: Update Pending Request**
1. ✅ User opens location with pending request
2. ✅ Warning banner shows: "Pending request exists"
3. ✅ Button text: "Update Request"
4. ✅ User clicks → Form expands with pending values pre-filled
5. ✅ User modifies values and/or evidence
6. ✅ User submits → PUT request updates existing request
7. ✅ Success modal confirms update

**Flow 4: Remove Override**
1. ✅ User opens location with existing override
2. ✅ Action card shows "Edit" and "Remove" buttons
3. ✅ User clicks "Remove Override" → Confirmation dialog appears
4. ✅ Dialog shows current override and what it will revert to
5. ✅ User confirms → DELETE request
6. ✅ On success → Close dialog, update UI to show no override
7. ✅ Optional: Return to main page or show toast success message

---

## 9. Next Steps

### 9.1 Design Artifacts Created

✅ **UX Design Specification** (this document)
- Complete interaction patterns
- Component specifications
- Visual foundation (color, typography, spacing)
- Responsive and accessibility strategy
- Implementation guidance

🎨 **Interactive Color Theme Visualizer** (to be generated)
- [ux-color-themes.html](./ux-color-themes.html)
- 4 theme options in light + dark modes
- Live UI component examples
- Side-by-side comparison

🎨 **Design Direction Mockups** (to be generated)
- [ux-design-corrections-page-mockups.html](./ux-design-corrections-page-mockups.html)
- Main Corrections page (empty states)
- Main Corrections page (active states with data)
- Search & Action view (collapsed action cards)
- Search & Action view (expanded override form)
- Search & Action view (expanded correction request form)
- Confirmation modals
- Both light and dark themes

### 9.2 Implementation Phases (Recommended)

**Phase 1: Foundation (MVP)**
- Build Search & Action view layout (two-column)
- Implement location search API integration
- Build map component with pin rendering
- Create basic action cards (collapsed state)

**Phase 2: Core Functionality**
- Implement override form (expanded state)
- Implement correction request form (expanded state)
- Add validation logic
- Build success/confirmation modals
- Integrate override CRUD API calls

**Phase 3: Main Dashboard**
- Build main Corrections page layout
- Implement override table with data
- Implement correction requests table with data
- Add empty state cards
- Connect navigation between views

**Phase 4: Polish & Edge Cases**
- Handle all special states (pending requests, approved/rejected)
- Add remove override confirmation
- Implement update pending request flow
- Add request history expansion
- Mobile responsive refinements

**Phase 5: Accessibility & Testing**
- Keyboard navigation testing
- Screen reader testing
- ARIA labels and roles
- Color contrast verification
- Touch target size verification (mobile)

### 9.3 Open Questions for Development

1. **Map Library:** Which mapping library are you using? (Mapbox, Google Maps, Leaflet, etc.) - Need to ensure pin rendering matches this spec.

2. **Coordinate Format:** Should we support DMS (Degrees, Minutes, Seconds) input format in addition to decimal degrees? Or decimal only?

3. **Admin Workflow:** How do admins review and approve/reject correction requests? (Future feature, but may affect request status display)

4. **Notifications:** Should publishers be notified when their correction requests are approved/rejected? Email? In-app notifications?

5. **Permissions:** Can all publishers submit correction requests and create overrides, or are there role restrictions?

---

## Appendix

### Related Documents

- Product Requirements: [prd.md](./prd.md)
- API Documentation: Check Swagger UI at http://localhost:8080/swagger/index.html
- Coding Standards: [coding-standards.md](./coding-standards.md)

### Design Deliverables

This UX Design Specification was created through collaborative design facilitation:

- **Color Theme Visualizer**: [ux-color-themes.html](./ux-color-themes.html) _(to be generated)_
  - Interactive HTML showing all 4 color theme options
  - Light and dark modes for each theme
  - Live UI component examples in each theme
  - Side-by-side comparison

- **Design Direction Mockups**: [ux-design-corrections-page-mockups.html](./ux-design-corrections-page-mockups.html) _(to be generated)_
  - Interactive HTML with complete page mockups
  - All states documented in this spec
  - Both light and dark themes
  - Responsive preview toggle

### Version History

| Date       | Version | Changes                              | Author |
| ---------- | ------- | ------------------------------------ | ------ |
| 2025-12-22 | 1.0     | Initial UX Design Specification      | BMad   |

---

_This UX Design Specification was created through collaborative design facilitation with the UX Designer agent. All decisions were made through conversation and are documented with rationale._
