# Audit Log UX Patterns & Design System

> **Research Date:** 2025-12-26
> **Focus:** UI/UX patterns for audit log visualization based on industry leaders
> **Compliance Target:** WCAG 2.2 Level AA

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Research Findings - Industry Patterns](#research-findings---industry-patterns)
3. [Existing UI Components Analysis](#existing-ui-components-analysis)
4. [Timeline Visualization Patterns](#timeline-visualization-patterns)
5. [Filtering & Search UI](#filtering--search-ui)
6. [Diff Visualization (Before/After)](#diff-visualization-beforeafter)
7. [Actor Display Patterns](#actor-display-patterns)
8. [Event Grouping & Threading](#event-grouping--threading)
9. [Export UI Flows](#export-ui-flows)
10. [Real-Time Update Indicators](#real-time-update-indicators)
11. [Empty & Error States](#empty--error-states)
12. [Mobile Responsiveness](#mobile-responsiveness)
13. [Accessibility Considerations (WCAG AA)](#accessibility-considerations-wcag-aa)
14. [Component Breakdown](#component-breakdown)
15. [Interaction Flows](#interaction-flows)
16. [Color Coding System](#color-coding-system)
17. [View Comparison Matrix](#view-comparison-matrix)

---

## Executive Summary

This document synthesizes audit log UI/UX best practices from **Stripe**, **GitHub**, **Auth0**, **AWS CloudTrail**, **Supabase**, and **Linear** to create implementation-ready design patterns for the zmanim platform's audit logging system.

### Key Recommendations

1. **Primary View:** Timeline-based table with vertical timeline indicator (hybrid approach)
2. **Filtering:** Multi-select filters with live search, date range picker, and preset quick filters
3. **Diff Visualization:** Side-by-side comparison with color-coded changes (JSON diff for complex data)
4. **Real-Time Updates:** Subtle banner notification with manual refresh (avoid aggressive auto-refresh)
5. **Export:** CSV and JSON with filtered results preservation
6. **Mobile:** Card-based stacked layout with collapsible details

---

## Research Findings - Industry Patterns

### 1. Stripe Dashboard - Activity Logs

**Key Features:**
- 15-month data retention with full request/response context
- Multi-dimensional filtering (API version, error type, source, resource ID)
- Dashboard UI + CSV export capability
- Request logs accessible in Developers Dashboard (now "Workbench")

**UI Patterns Observed:**
- Tabular data display with expandable rows for detailed context
- Filter chips that remain visible while browsing
- Inline status indicators (success/error) with color coding

**Sources:**
- [Stripe View API Request Logs](https://docs.stripe.com/development/dashboard/request-logs?locale=en-GB)
- [Stripe Web Dashboard Documentation](https://docs.stripe.com/dashboard/basics)

---

### 2. GitHub - Audit Log Viewer

**Key Features:**
- 180-day audit log retention with 90-day default display
- Search queries using qualifiers (operation, country, created date with ISO8601)
- Export to JSON or CSV
- Audit log streaming (public beta - real-time streaming to external systems)

**UI Patterns Observed:**
- Default attribute filter excludes read-only events (configurable)
- Time range filter + single attribute filter constraint
- Export dropdown with format selection (JSON/CSV)
- Side-by-side event comparison capability
- Download up to 200,000 events in single file

**Sources:**
- [GitHub Reviewing Audit Log for Organizations](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization)
- [GitHub Audit Log Streaming](https://github.blog/news-insights/product-news/audit-log-streaming-public-beta/)
- [GitHub Audit Log Streaming API Requests GA](https://github.blog/changelog/2025-01-13-audit-log-streaming-of-api-requests-is-generally-available/)

---

### 3. Auth0 - Log Streams

**Key Features:**
- Navigate via Monitoring >> Streams interface
- Custom webhook configuration with payload URL and authorization token
- Health tab monitors stream status ("Active: Your latest log delivery was successful")
- JSON Object content format
- FGA Logging API provides comprehensive audit trail

**UI Patterns Observed:**
- Stream configuration wizard with step-by-step setup
- Real-time health monitoring with status badges
- Integration-first approach (SIEM platform connectors)
- Event-driven architecture (react to password changes, registrations)

**Sources:**
- [Auth0 Logs Documentation](https://auth0.com/docs/deploy-monitor/logs)
- [Auth0 FGA Logging API Audit Trail](https://auth0.com/blog/auth0-fga-logging-api-a-complete-audit-trail-for-authorization/)
- [Pangea Auth0 Event Stream](https://pangea.cloud/docs/audit/log-streaming/auth0)

---

### 4. AWS CloudTrail - Event History

**Key Features:**
- 90-day viewable, searchable, downloadable event history
- Attribute filter + time range filter (only one attribute filter at a time)
- Customizable event columns (show/hide)
- Side-by-side event comparison
- Download up to 200,000 events (CSV/JSON)
- CloudTrail Lake for SQL-based queries with AI-powered natural language query generation
- Visualization via Kibana, QuickSight, Managed Grafana

**UI Patterns Observed:**
- Default filter: Read-only = false (excludes read events)
- Event history customization (events per page, column selection)
- Near real-time streaming to CloudWatch Logs → Elasticsearch → Kibana
- Lake dashboards for top event trends visualization

**Sources:**
- [AWS CloudTrail Working with Event History](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/view-cloudtrail-events.html)
- [AWS CloudTrail Viewing Recent Management Events](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/view-cloudtrail-events-console.html)
- [AWS Visualizing CloudTrail Events with Kibana](https://aws.amazon.com/blogs/mt/visualizing-aws-cloudtrail-events-using-kibana/)

---

### 5. Supabase - Table Activity Audit Logs

**Key Features:**
- Auth audit logs in `auth.audit_log_entries` table
- Logs Explorer with BigQuery SQL syntax
- PGAudit extension for generic table auditing
- Custom audit log tables with JSONB change tracking
- Dashboard UI access to logs

**UI Patterns Observed:**
- SQL-based querying interface (Logs Explorer)
- Automatic capture with dashboard accessibility
- JSONB format for flexible change representation
- Integration with Postgres Logs for pgAudit extension

**Sources:**
- [Supabase Auth Audit Logs](https://supabase.com/docs/guides/auth/audit-logs)
- [Supabase PGAudit Extension](https://supabase.com/docs/guides/database/extensions/pgaudit)
- [GitHub supabase/supa_audit](https://github.com/supabase/supa_audit)
- [Supabase Logging Documentation](https://supabase.com/docs/guides/telemetry/logs)

---

### 6. Linear - Issue Activity Feed

**Key Features:**
- Collapsed issue history with grouped consecutive events
- Discussion summaries for substantial activity (captures decisions, blockers, debates)
- Timeline view for project planning (draggable project bars)
- Real-time sync with near-instantaneous updates
- Unified "Pulse" feed for personalized updates

**UI Patterns Observed:**
- Event grouping to reduce clutter (similar consecutive events collapsed)
- Auto-regenerating summaries when new activity occurs
- Visual timeline with project bars (drag-and-drop)
- Keyboard-first navigation
- Clean UI with reduced visual noise

**Sources:**
- [Linear Collapsed Issue History Changelog](https://linear.app/changelog/2025-04-03-collapsed-issue-history)
- [Linear How We Redesigned the UI (Part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Linear Timeline Documentation](https://linear.app/docs/timeline)

---

## Existing UI Components Analysis

### Current Component Inventory

The zmanim codebase has **~123 React components** with the following relevant patterns:

#### **Table/Grid Components:**
1. **PrimitivesTable.tsx** - Astronomical primitives display
   - Grouped category sections with expandable cards
   - Table with sortable columns
   - Click-to-view-details dialog pattern
   - Preview toolbar with date/location filters
   - React Query for data fetching

2. **VersionHistory.tsx** - Timeline-based version tracking
   - **Timeline pattern:** Vertical border-left with dot indicators
   - Color-coded status badges (published = green, draft = gray)
   - "Current" badge for active version
   - Compare and Restore actions
   - Expandable diff view
   - Format: `formatDate()` helper with month/day/year + time

3. **CorrectionRequestHistory.tsx** - Admin correction history
   - Search-driven interface (locality search)
   - Before/After comparison in table cells
   - Color-coded changes (green for new values)
   - Revert dialog with confirmation
   - Status badges (Approved/Reverted)
   - Monospace font for coordinates/data

#### **Existing Patterns to Reuse:**

| Pattern | Component | Implementation |
|---------|-----------|----------------|
| **Timeline dots** | VersionHistory.tsx | `border-l-2` with `absolute left-[-9px]` dots |
| **Status badges** | Multiple | Badge component with variant colors |
| **Before/After comparison** | CorrectionRequestHistory.tsx | Side-by-side columns with color highlights |
| **Search with dropdown results** | CorrectionRequestHistory.tsx | Input with floating result list |
| **Dialog confirmations** | Multiple | shadcn/ui Dialog with header/footer |
| **Loading states** | All components | Loader2 icon with animate-spin |
| **Empty states** | Multiple | Centered icon + heading + description |
| **Date formatting** | VersionHistory.tsx | `toLocaleDateString()` with options |

#### **Design Token Compliance:**
- 100% design token usage (no hardcoded colors)
- Dark mode support via CSS variables
- Consistent spacing with Tailwind classes
- shadcn/ui component primitives (25 components)

---

## Timeline Visualization Patterns

### Recommended Pattern: Hybrid Timeline Table

Based on research and existing codebase patterns, use a **table layout with timeline indicators** in the leftmost column.

#### Visual Structure (ASCII Diagram)

```
┌─────────────────────────────────────────────────────────────────┐
│  Audit Log Timeline                                [Filters] [Export] │
├─────────────────────────────────────────────────────────────────┤
│ Timeline │ Event        │ Actor     │ Action      │ Resource   │
├──────────┼──────────────┼───────────┼─────────────┼────────────┤
│    ●     │ 2m ago       │ John Doe  │ Updated     │ Zman #42   │
│    │     │              │ (admin)   │ formula     │            │
│    │     │              │           │             │ [View Diff]│
├──────────┼──────────────┼───────────┼─────────────┼────────────┤
│    ●     │ 15m ago      │ Jane S.   │ Created     │ Publisher  │
│    │     │              │ (publisher)│ new zman   │ "Chabad"   │
├──────────┼──────────────┼───────────┼─────────────┼────────────┤
│    ●     │ 1h ago       │ System    │ Published   │ Algorithm  │
│    │     │              │           │ snapshot   │ v3.2       │
│    ├─ Grouped (3 similar events) ─ [Expand]                     │
├──────────┼──────────────┼───────────┼─────────────┼────────────┤
│    ●     │ 2h ago       │ Admin Bot │ Approved    │ Correction │
│    │     │              │ (imperson)│ request    │ #891       │
└──────────┴──────────────┴───────────┴─────────────┴────────────┘
```

#### Implementation Details

**Timeline Column:**
```tsx
// Timeline dot indicator
<div className="relative pl-6">
  <div className={cn(
    "absolute left-[-9px] w-4 h-4 rounded-full border-2",
    event.severity === 'critical' ? 'bg-red-500 border-red-500' :
    event.severity === 'warning' ? 'bg-amber-500 border-amber-500' :
    'bg-primary border-primary'
  )} />
  {/* Vertical line */}
  <div className="absolute left-0 top-4 bottom-0 w-px bg-border" />
</div>
```

**Responsive Behavior:**
- Desktop: Full table with all columns
- Tablet: Hide less critical columns (collapse to cards on mobile)
- Mobile: Stack as cards with timeline indicator on left edge

#### Alternative: Pure Timeline View

```
┌─────────────────────────────────────────────────────────────────┐
│  Today                                                           │
├─────────────────────────────────────────────────────────────────┤
│ ● 2:30 PM  John Doe updated formula for Zman "Alos Hashachar"  │
│   │        Before: sunrise - 72min                               │
│   │        After:  sunrise - 90min                               │
│   │        [View Full Diff] [Revert]                            │
│   │                                                              │
│ ● 1:15 PM  Jane Smith created new zman "Tzeis Hakochavim"      │
│   │        Category: Evening                                     │
│   │        [View Details]                                        │
│   │                                                              │
│ ● 12:45 PM System published algorithm snapshot v3.2             │
│   │        Changes: 5 zmanim, 2 corrections                     │
│   ├─────────────────────────────────────────────────────────────│
│ Yesterday                                                        │
│ ● 11:20 AM Admin approved correction request #891              │
│   │        Locality: Jerusalem, Israel                           │
│   │        [View Request]                                        │
└─────────────────────────────────────────────────────────────────┘
```

**Use Cases:**
- Better for mobile-first design
- Emphasizes chronological flow
- Good for activity feeds with context

**Trade-offs:**
- Less efficient for scanning specific columns
- Harder to implement sortable columns
- More vertical space per event

---

## Filtering & Search UI

### Recommended Filter Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ [Search events..............................]  [Date Range ▼]   │
│                                                                   │
│ Filters: [Event Type ▼] [Actor ▼] [Resource ▼] [Severity ▼]    │
│          [Clear All]                                              │
│                                                                   │
│ Active: ✕ Updated  ✕ John Doe  ✕ Last 7 days                    │
└──────────────────────────────────────────────────────────────────┘
```

### Filter Components

#### 1. **Search Input**
```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input
    type="text"
    value={searchQuery}
    onChange={(e) => handleSearch(e.target.value)}
    placeholder="Search events, actors, resources..."
    className="pl-10"
  />
  {isSearching && (
    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
  )}
</div>
```

**Behavior:**
- Debounced search (300ms delay)
- Searches across: event description, actor name/email, resource name, metadata
- Shows loading spinner during search
- Preserves other filters while searching

#### 2. **Date Range Picker**

Use existing `PreviewDatePicker` pattern from zmanim codebase:

```tsx
import { PreviewDatePicker } from '@/components/shared/PreviewDatePicker';

// Preset options
const datePresets = [
  { label: 'Last 24 hours', value: 'last_24h' },
  { label: 'Last 7 days', value: 'last_7d' },
  { label: 'Last 30 days', value: 'last_30d' },
  { label: 'Last 90 days', value: 'last_90d' },
  { label: 'Custom range', value: 'custom' },
];

<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" className="justify-start text-left font-normal">
      <Calendar className="mr-2 h-4 w-4" />
      {dateRange ? formatDateRange(dateRange) : 'Select date range'}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0" align="start">
    <div className="p-3 space-y-2">
      {datePresets.map(preset => (
        <Button
          key={preset.value}
          variant="ghost"
          className="w-full justify-start"
          onClick={() => handlePresetSelect(preset.value)}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  </PopoverContent>
</Popover>
```

#### 3. **Multi-Select Dropdowns**

Use shadcn/ui `Command` component for multi-select:

```tsx
import { Command, CommandInput, CommandList, CommandItem } from '@/components/ui/command';

<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">
      Event Type {selectedTypes.length > 0 && `(${selectedTypes.length})`}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="p-0" align="start">
    <Command>
      <CommandInput placeholder="Search event types..." />
      <CommandList>
        {eventTypes.map(type => (
          <CommandItem
            key={type.value}
            onSelect={() => toggleEventType(type.value)}
          >
            <Checkbox checked={selectedTypes.includes(type.value)} />
            <span className="ml-2">{type.label}</span>
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

#### 4. **Filter Chips (Active Filters)**

```tsx
<div className="flex flex-wrap gap-2">
  {activeFilters.map(filter => (
    <Badge key={filter.id} variant="secondary" className="gap-1">
      {filter.label}
      <button
        onClick={() => removeFilter(filter.id)}
        className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  ))}
  {activeFilters.length > 0 && (
    <Button variant="ghost" size="sm" onClick={clearAllFilters}>
      Clear All
    </Button>
  )}
</div>
```

### Filter Options by Category

| Filter Category | Options | UI Component |
|----------------|---------|--------------|
| **Event Type** | Created, Updated, Deleted, Published, Approved, Reverted | Multi-select dropdown |
| **Actor** | User list (autocomplete), Role filter | Combo box with search |
| **Resource Type** | Zman, Publisher, User, Algorithm, Coverage, Correction | Multi-select dropdown |
| **Severity** | Info, Warning, Error, Critical | Multi-select with icons |
| **Date Range** | Presets + custom range | Date picker popover |
| **Impersonation** | All, Only impersonated, Exclude impersonated | Radio group |

### Best Practices from Research

**From GitHub:**
- Single attribute filter + time range (avoid overwhelming users)
- Default filter: Exclude read-only events (reduces noise)

**From AWS CloudTrail:**
- Customizable column visibility
- Events per page selector (10, 25, 50, 100)

**From Linear:**
- Intelligent grouping of similar consecutive events
- Filter presets for common use cases

**Recommended Implementation:**
- Start with 3-4 most common filters visible
- "Advanced filters" accordion for additional options
- Save filter presets per user (localStorage or backend)
- URL query params preserve filter state (shareable links)

---

## Diff Visualization (Before/After)

### Pattern 1: Side-by-Side JSON Diff (Complex Data)

For complex changes (formulas, metadata, JSON structures):

```
┌─────────────────────────────────────────────────────────────────┐
│  Changes to Zman "Alos Hashachar" - Formula Update              │
├──────────────────────────────────────────────────────────────────┤
│  Before                          │  After                        │
├──────────────────────────────────┼───────────────────────────────┤
│  {                                │  {                            │
│    "formula_dsl": "sunrise - 72min", │    "formula_dsl": "sunrise - 90min", │  [Changed]
│    "description_hebrew": "...",   │    "description_hebrew": "...",│
│    "tags": ["daily"]              │    "tags": ["daily", "erev_shabbos"] │  [Added]
│  }                                │  }                            │
└──────────────────────────────────┴───────────────────────────────┘
```

**Implementation with react-diff-viewer or custom:**

```tsx
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

<ReactDiffViewer
  oldValue={JSON.stringify(before, null, 2)}
  newValue={JSON.stringify(after, null, 2)}
  splitView={true}
  compareMethod={DiffMethod.WORDS}
  styles={{
    variables: {
      dark: {
        diffViewerBackground: 'hsl(var(--card))',
        addedBackground: 'hsl(var(--success) / 0.1)',
        removedBackground: 'hsl(var(--destructive) / 0.1)',
      }
    }
  }}
/>
```

### Pattern 2: Inline Field-by-Field Diff (Simple Changes)

For simple field updates (coordinates, text, numbers):

```
┌─────────────────────────────────────────────────────────────────┐
│  Changes to Locality "Jerusalem, Israel" - Coordinates          │
├──────────────────────────────────────────────────────────────────┤
│  Field               Before              →  After               │
├──────────────────────────────────────────────────────────────────┤
│  Latitude            31.776970           →  31.776950  [Changed] │
│  Longitude           35.234394              35.234394  [No change]│
│  Elevation           754m                →  760m       [Changed] │
│  Updated by          System                 John Doe (admin)     │
│  Reason              —                      GPS correction       │
└──────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```tsx
interface DiffRow {
  field: string;
  before: string | number | null;
  after: string | number | null;
  changed: boolean;
}

function FieldDiffTable({ changes }: { changes: DiffRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border">
        <tr>
          <th className="text-left py-2 px-3 font-medium">Field</th>
          <th className="text-left py-2 px-3 font-medium">Before</th>
          <th className="text-center py-2 px-3 font-medium w-8">→</th>
          <th className="text-left py-2 px-3 font-medium">After</th>
          <th className="text-right py-2 px-3 font-medium w-24">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {changes.map((change) => (
          <tr key={change.field} className={change.changed ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
            <td className="py-2 px-3 font-medium">{change.field}</td>
            <td className={cn(
              "py-2 px-3 font-mono text-xs",
              change.changed && "text-destructive line-through"
            )}>
              {change.before ?? '—'}
            </td>
            <td className="py-2 px-3 text-center text-muted-foreground">→</td>
            <td className={cn(
              "py-2 px-3 font-mono text-xs",
              change.changed && "text-green-600 dark:text-green-400 font-semibold"
            )}>
              {change.after ?? '—'}
            </td>
            <td className="py-2 px-3 text-right">
              {change.changed ? (
                <Badge variant="outline" className="text-xs">Changed</Badge>
              ) : (
                <span className="text-xs text-muted-foreground">No change</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Pattern 3: Visual Diff for Formulas (DSL-Specific)

Leverage existing `HighlightedFormula` component:

```tsx
import { HighlightedFormula } from '@/components/shared/HighlightedFormula';

<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div>
    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
      <AlertCircle className="w-4 h-4 text-destructive" />
      Before
    </h4>
    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
      <HighlightedFormula formula={beforeFormula} />
    </div>
  </div>
  <div>
    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
      <CheckCircle className="w-4 h-4 text-green-600" />
      After
    </h4>
    <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
      <HighlightedFormula formula={afterFormula} />
    </div>
  </div>
</div>
```

### Color Coding Standards (from research)

| Change Type | Background | Text Color | Icon |
|-------------|------------|------------|------|
| **Added** | `bg-green-50 dark:bg-green-950/20` | `text-green-600 dark:text-green-400` | `<Plus />` |
| **Removed** | `bg-red-50 dark:bg-red-950/20` | `text-red-600 dark:text-red-400` | `<Minus />` |
| **Changed** | `bg-amber-50 dark:bg-amber-950/20` | `text-amber-600 dark:text-amber-400` | `<Edit />` |
| **No change** | `bg-muted/50` | `text-muted-foreground` | — |

### Modal vs Inline Diff

**Modal Dialog (Recommended for complex diffs):**
- Full-screen focus on changes
- Better for large JSON structures
- Allows scrolling without losing context

**Inline Expandable Row (Recommended for simple diffs):**
- Quick view without navigation
- Good for 2-3 field changes
- Maintains timeline context

**Implementation:**

```tsx
// Expandable row
const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

<tr>
  <td colSpan={columns.length}>
    <Collapsible open={expandedRows.has(event.id)}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" onClick={() => toggleRow(event.id)}>
          {expandedRows.has(event.id) ? <ChevronUp /> : <ChevronDown />}
          View Changes
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <FieldDiffTable changes={event.changes} />
      </CollapsibleContent>
    </Collapsible>
  </td>
</tr>

// Modal dialog for complex diff
<Dialog open={diffDialogOpen} onOpenChange={setDiffDialogOpen}>
  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Changes to {resource.name}</DialogTitle>
      <DialogDescription>
        Updated by {event.actor} on {formatDate(event.timestamp)}
      </DialogDescription>
    </DialogHeader>
    <ReactDiffViewer {...diffProps} />
  </DialogContent>
</Dialog>
```

---

## Actor Display Patterns

### Actor Information Structure

```tsx
interface AuditActor {
  id: string;
  type: 'user' | 'system' | 'api_key' | 'webhook';
  name: string;
  email?: string;
  avatar_url?: string;
  role: 'admin' | 'publisher' | 'public';
  is_impersonating?: boolean;
  impersonated_by?: {
    id: string;
    name: string;
    email: string;
  };
}
```

### Display Patterns

#### 1. **Avatar + Name + Role**

```tsx
function ActorDisplay({ actor }: { actor: AuditActor }) {
  return (
    <div className="flex items-center gap-3">
      {/* Avatar */}
      <Avatar className="h-8 w-8">
        {actor.avatar_url ? (
          <AvatarImage src={actor.avatar_url} alt={actor.name} />
        ) : (
          <AvatarFallback className={cn(
            actor.type === 'system' && "bg-blue-100 dark:bg-blue-900/30",
            actor.type === 'user' && "bg-purple-100 dark:bg-purple-900/30"
          )}>
            {actor.type === 'system' ? (
              <Bot className="h-4 w-4" />
            ) : (
              <User className="h-4 w-4" />
            )}
          </AvatarFallback>
        )}
      </Avatar>

      {/* Name + Role */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{actor.name}</span>
          {actor.is_impersonating && (
            <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/30">
              <ShieldAlert className="w-3 h-3 mr-1" />
              Impersonating
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {actor.role}
          {actor.email && ` • ${actor.email}`}
        </span>
      </div>
    </div>
  );
}
```

#### 2. **Impersonation Badge (Prominent)**

Based on existing `ImpersonationBanner` component pattern:

```tsx
{actor.is_impersonating && actor.impersonated_by && (
  <Alert variant="warning" className="mt-2">
    <ShieldAlert className="h-4 w-4" />
    <AlertDescription>
      {actor.impersonated_by.name} ({actor.impersonated_by.email})
      performed this action while impersonating {actor.name}
    </AlertDescription>
  </Alert>
)}
```

#### 3. **System Actions (Special Treatment)**

```tsx
function ActorBadge({ actor }: { actor: AuditActor }) {
  if (actor.type === 'system') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Bot className="w-3 h-3" />
        System
      </Badge>
    );
  }

  if (actor.type === 'api_key') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Key className="w-3 h-3" />
        API Key
      </Badge>
    );
  }

  if (actor.type === 'webhook') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Webhook className="w-3 h-3" />
        Webhook
      </Badge>
    );
  }

  return <Badge>{actor.role}</Badge>;
}
```

### Actor Filtering

```tsx
// Actor filter with autocomplete
const { results: actorResults, search: searchActors } = useActorSearch();

<Command>
  <CommandInput
    placeholder="Search actors..."
    onValueChange={searchActors}
  />
  <CommandList>
    <CommandGroup heading="Users">
      {actorResults.users.map(user => (
        <CommandItem onSelect={() => filterByActor(user.id)}>
          <Avatar className="h-6 w-6 mr-2">
            <AvatarImage src={user.avatar_url} />
            <AvatarFallback>{user.name[0]}</AvatarFallback>
          </Avatar>
          {user.name} <span className="text-muted-foreground ml-2">{user.email}</span>
        </CommandItem>
      ))}
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading="System Actors">
      <CommandItem onSelect={() => filterByActor('system')}>
        <Bot className="h-4 w-4 mr-2" />
        System
      </CommandItem>
      <CommandItem onSelect={() => filterByActor('api_key')}>
        <Key className="h-4 w-4 mr-2" />
        API Keys
      </CommandItem>
    </CommandGroup>
  </CommandList>
</Command>
```

---

## Event Grouping & Threading

### Grouping Strategy (from Linear research)

**Principle:** Collapse similar consecutive events to reduce clutter while maintaining visibility.

#### Pattern 1: Consecutive Event Grouping

```
┌─────────────────────────────────────────────────────────────────┐
│ ● 2:30 PM  John Doe updated 5 zmanim formulas                   │
│   │        [Expand to see 5 events] ▼                            │
│   │                                                              │
│ ● 1:15 PM  Jane Smith created publisher "Chabad Lubavitch"     │
└─────────────────────────────────────────────────────────────────┘

// When expanded:
┌─────────────────────────────────────────────────────────────────┐
│ ● 2:30 PM  John Doe updated 5 zmanim formulas                   │
│   │        [Collapse] ▲                                          │
│   │                                                              │
│   ├─ 2:30:45 PM  Updated "Alos Hashachar" formula               │
│   ├─ 2:30:32 PM  Updated "Tzeis Hakochavim" formula             │
│   ├─ 2:30:18 PM  Updated "Plag Hamincha" formula                │
│   ├─ 2:30:05 PM  Updated "Shkiah" formula                       │
│   └─ 2:29:52 PM  Updated "Chatzos" formula                      │
│   │                                                              │
│ ● 1:15 PM  Jane Smith created publisher "Chabad Lubavitch"     │
└─────────────────────────────────────────────────────────────────┘
```

**Grouping Rules:**
1. Same actor
2. Same event type (e.g., all "Updated")
3. Same resource type (e.g., all "Zman")
4. Within 2-minute time window
5. Minimum 3 events to create a group

**Implementation:**

```tsx
interface EventGroup {
  id: string;
  summary: string;
  actor: AuditActor;
  timestamp: string;
  event_type: string;
  events: AuditEvent[];
  is_grouped: true;
}

function groupConsecutiveEvents(events: AuditEvent[]): (AuditEvent | EventGroup)[] {
  const grouped: (AuditEvent | EventGroup)[] = [];
  let currentGroup: AuditEvent[] = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const prev = events[i - 1];

    if (
      prev &&
      prev.actor.id === event.actor.id &&
      prev.event_type === event.event_type &&
      prev.resource_type === event.resource_type &&
      Math.abs(new Date(prev.timestamp).getTime() - new Date(event.timestamp).getTime()) < 120000 // 2 min
    ) {
      if (currentGroup.length === 0) currentGroup.push(prev);
      currentGroup.push(event);
    } else {
      if (currentGroup.length >= 3) {
        grouped.push({
          id: `group-${currentGroup[0].id}`,
          summary: `${currentGroup[0].actor.name} ${currentGroup[0].event_type} ${currentGroup.length} ${currentGroup[0].resource_type}s`,
          actor: currentGroup[0].actor,
          timestamp: currentGroup[0].timestamp,
          event_type: currentGroup[0].event_type,
          events: currentGroup,
          is_grouped: true,
        });
      } else {
        grouped.push(...currentGroup);
      }
      currentGroup = [];
    }
  }

  return grouped;
}
```

#### Pattern 2: Thread-Based Grouping (Resource-Centric)

For tracking all changes to a specific resource:

```
┌─────────────────────────────────────────────────────────────────┐
│  Zman "Alos Hashachar" Activity Thread                          │
├─────────────────────────────────────────────────────────────────┤
│ ● 3:45 PM  John Doe published zman                              │
│   │        Status: Draft → Published                            │
│   │                                                              │
│ ● 2:30 PM  John Doe updated formula                             │
│   │        Before: sunrise - 72min                               │
│   │        After:  sunrise - 90min                               │
│   │                                                              │
│ ● 10:15 AM Sarah L. added tag "erev_shabbos"                    │
│   │                                                              │
│ ● 9:00 AM  John Doe created zman                                │
│   │        Category: Morning                                     │
└─────────────────────────────────────────────────────────────────┘
```

**Use Case:** Detail view for a specific resource (zman, publisher, user)

**Implementation:**

```tsx
// API endpoint: GET /audit-log/resource/:resource_type/:resource_id
const { data: resourceThread } = useQuery({
  queryKey: ['audit-thread', resourceType, resourceId],
  queryFn: async () => {
    return api.get<AuditEvent[]>(
      `/audit-log/resource/${resourceType}/${resourceId}?limit=50`
    );
  },
});

// Component
<Dialog>
  <DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle>Activity History: {resource.name}</DialogTitle>
      <DialogDescription>
        Complete audit trail for this {resourceType}
      </DialogDescription>
    </DialogHeader>
    <ScrollArea className="h-[600px]">
      <TimelineView events={resourceThread} grouped={false} />
    </ScrollArea>
  </DialogContent>
</Dialog>
```

### Auto-Collapse Rules

**Based on Linear's pattern:**
- Collapse events older than 7 days by default
- Keep last 20 events always expanded
- User preference to "Expand all" (saved in localStorage)
- Highlight new events since last visit (using timestamp comparison)

```tsx
const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
  // Auto-expand recent events (< 7 days)
  const recent = new Set<string>();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  events.forEach(event => {
    if (new Date(event.timestamp).getTime() > sevenDaysAgo) {
      if ('is_grouped' in event) recent.add(event.id);
    }
  });

  return recent;
});
```

---

## Export UI Flows

### Export Options

Based on GitHub and AWS CloudTrail patterns:

1. **CSV Export** - Tabular data for Excel/Google Sheets
2. **JSON Export** - Complete data with metadata for programmatic analysis
3. **PDF Export** (optional) - Human-readable report

### Export Button with Dropdown

```tsx
import { Download, FileSpreadsheet, FileJson, FilePdf } from 'lucide-react';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" className="gap-2">
      <Download className="h-4 w-4" />
      Export
      <ChevronDown className="h-4 w-4 opacity-50" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => handleExport('csv')}>
      <FileSpreadsheet className="h-4 w-4 mr-2" />
      Export as CSV
      <span className="ml-auto text-xs text-muted-foreground">
        {filteredCount} events
      </span>
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleExport('json')}>
      <FileJson className="h-4 w-4 mr-2" />
      Export as JSON
      <span className="ml-auto text-xs text-muted-foreground">
        {filteredCount} events
      </span>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => handleExport('pdf')}>
      <FilePdf className="h-4 w-4 mr-2" />
      Generate PDF Report
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Export Configuration Dialog

For large exports (>1000 events), show configuration dialog:

```tsx
<Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Export Audit Log</DialogTitle>
      <DialogDescription>
        Configure your export preferences. Current filters will be applied.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4">
      {/* Format selection */}
      <div>
        <label className="text-sm font-medium">Format</label>
        <RadioGroup value={exportFormat} onValueChange={setExportFormat}>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="csv" id="csv" />
            <label htmlFor="csv" className="text-sm">CSV (Excel compatible)</label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="json" id="json" />
            <label htmlFor="json" className="text-sm">JSON (Full metadata)</label>
          </div>
        </RadioGroup>
      </div>

      {/* Date range override */}
      <div>
        <label className="text-sm font-medium">Date Range</label>
        <p className="text-xs text-muted-foreground mb-2">
          Current filter: {formatDateRange(dateFilter)}
        </p>
        <Checkbox
          checked={useCustomRange}
          onCheckedChange={setUseCustomRange}
        >
          Override with custom range
        </Checkbox>
        {useCustomRange && (
          <DateRangePicker
            value={customRange}
            onChange={setCustomRange}
          />
        )}
      </div>

      {/* Field selection (CSV only) */}
      {exportFormat === 'csv' && (
        <div>
          <label className="text-sm font-medium">Columns to Include</label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {exportColumns.map(col => (
              <Checkbox
                key={col.key}
                checked={selectedColumns.includes(col.key)}
                onCheckedChange={(checked) => toggleColumn(col.key, checked)}
              >
                {col.label}
              </Checkbox>
            ))}
          </div>
        </div>
      )}

      {/* Limit warning */}
      {filteredCount > 10000 && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Export includes {filteredCount.toLocaleString()} events.
            This may take several minutes. Consider narrowing your filters.
          </AlertDescription>
        </Alert>
      )}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleExportConfirm} disabled={isExporting}>
        {isExporting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Export {filteredCount.toLocaleString()} Events
          </>
        )}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Export Implementation

```tsx
async function handleExport(format: 'csv' | 'json') {
  try {
    setIsExporting(true);

    // Build query params from filters
    const params = new URLSearchParams({
      format,
      ...buildFilterParams(activeFilters),
      start_date: dateRange.start,
      end_date: dateRange.end,
    });

    // Request download URL from backend
    const response = await api.post(`/audit-log/export?${params}`);

    // Trigger browser download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format}-${new Date().toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast.success(`Export complete: ${filteredCount} events downloaded`);
  } catch (error) {
    toast.error('Export failed. Please try again.');
  } finally {
    setIsExporting(false);
  }
}
```

### Backend Export Endpoint Pattern

```go
// GET/POST /api/v1/admin/audit-log/export
func (h *AuditLogHandler) ExportAuditLog(w http.ResponseWriter, r *http.Request) {
    // Parse filters
    filters := parseAuditLogFilters(r)
    format := r.URL.Query().Get("format") // csv or json

    // Stream results (don't load all into memory)
    events, err := h.db.StreamAuditLog(r.Context(), filters, 50000) // Max 50k events

    if format == "csv" {
        w.Header().Set("Content-Type", "text/csv")
        w.Header().Set("Content-Disposition", "attachment; filename=audit-log.csv")
        writer := csv.NewWriter(w)
        // Stream write CSV rows
    } else {
        w.Header().Set("Content-Type", "application/json")
        w.Header().Set("Content-Disposition", "attachment; filename=audit-log.json")
        json.NewEncoder(w).Encode(events)
    }
}
```

---

## Real-Time Update Indicators

### Pattern 1: Banner Notification (Recommended)

Based on research, **avoid aggressive auto-refresh** that disrupts user context. Instead, show a notification banner with manual refresh option.

```tsx
import { RefreshCw, AlertCircle } from 'lucide-react';

{hasNewEvents && (
  <Alert className="mb-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
    <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
    <AlertDescription className="flex items-center justify-between">
      <span>
        {newEventCount} new {newEventCount === 1 ? 'event' : 'events'} available
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        className="ml-4"
      >
        <RefreshCw className="h-3 w-3 mr-1" />
        Refresh
      </Button>
    </AlertDescription>
  </Alert>
)}
```

**Behavior:**
- Poll for new events every 30 seconds (configurable)
- Show banner when new events detected
- Preserve scroll position and filter state
- Update count dynamically
- Dismiss banner on refresh or close

### Pattern 2: Live Update Indicator (Subtle)

For real-time environments with WebSocket support:

```tsx
<div className="flex items-center gap-2 text-xs text-muted-foreground">
  <div className={cn(
    "h-2 w-2 rounded-full",
    isConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"
  )} />
  <span>
    {isConnected ? 'Live updates active' : 'Disconnected'}
  </span>
</div>
```

### Pattern 3: Toast Notifications (Informational Only)

For critical events only (avoid notification fatigue):

```tsx
import { toast } from 'sonner';

useEffect(() => {
  if (newEvent && newEvent.severity === 'critical') {
    toast.error(
      `Critical Event: ${newEvent.description}`,
      {
        action: {
          label: 'View',
          onClick: () => scrollToEvent(newEvent.id),
        },
      }
    );
  }
}, [newEvent]);
```

### WebSocket Implementation (Optional)

If implementing real-time updates via WebSocket:

```tsx
import { useEffect, useRef } from 'react';

function useAuditLogWebSocket(publisherId: string, onNewEvent: (event: AuditEvent) => void) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Only for admin/publisher audit logs, not public
    if (!publisherId) return;

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}/audit-log/stream?publisher_id=${publisherId}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsConnected(true);
      console.log('[AuditLog] WebSocket connected');
    };

    ws.current.onmessage = (event) => {
      const auditEvent = JSON.parse(event.data) as AuditEvent;
      onNewEvent(auditEvent);
    };

    ws.current.onerror = (error) => {
      console.error('[AuditLog] WebSocket error:', error);
      setIsConnected(false);
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      console.log('[AuditLog] WebSocket disconnected');
    };

    return () => {
      ws.current?.close();
    };
  }, [publisherId, onNewEvent]);

  return { isConnected };
}
```

### Polling Implementation (Simpler Alternative)

```tsx
import { useQuery } from '@tanstack/react-query';

function useAuditLogPolling(filters: AuditLogFilters) {
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);

  const { data: newEvents } = useQuery({
    queryKey: ['audit-log-poll', lastSeenId],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...filters,
        since_id: lastSeenId || '',
      });
      return api.get<{ events: AuditEvent[]; count: number }>(
        `/audit-log/poll?${params}`
      );
    },
    refetchInterval: 30000, // Poll every 30 seconds
    enabled: !!lastSeenId, // Only poll after initial load
  });

  return {
    newEventCount: newEvents?.count || 0,
    hasNewEvents: (newEvents?.count || 0) > 0,
  };
}
```

### Best Practices

**From Research:**
1. **Context Preservation:** Never reset pagination, active filters, sort order, inline edits, or scroll position on update
2. **Low Latency:** Target ≤ 1s end-to-end latency under normal load
3. **Subtle Highlighting:** Flash new/changed items with subtle background animation (fade in/out)
4. **User Control:** Always provide manual refresh option (don't force updates)

---

## Empty & Error States

### Empty State Patterns

#### 1. **No Audit Log Events Yet**

```tsx
<div className="flex flex-col items-center justify-center py-12 px-4">
  <div className="rounded-full bg-muted p-6 mb-4">
    <FileText className="h-12 w-12 text-muted-foreground" />
  </div>
  <h3 className="text-xl font-semibold mb-2">No Audit Events Yet</h3>
  <p className="text-muted-foreground text-center max-w-md mb-6">
    Audit events will appear here as users make changes to zmanim, publishers,
    and system configurations.
  </p>
  <Button variant="outline" onClick={handleRefresh}>
    <RefreshCw className="h-4 w-4 mr-2" />
    Refresh
  </Button>
</div>
```

#### 2. **No Results for Current Filters**

```tsx
<div className="flex flex-col items-center justify-center py-12 px-4">
  <div className="rounded-full bg-muted p-6 mb-4">
    <SearchX className="h-12 w-12 text-muted-foreground" />
  </div>
  <h3 className="text-xl font-semibold mb-2">No Events Found</h3>
  <p className="text-muted-foreground text-center max-w-md mb-6">
    No audit events match your current filters. Try adjusting your search criteria
    or clearing filters.
  </p>
  <div className="flex gap-3">
    <Button variant="outline" onClick={clearFilters}>
      Clear Filters
    </Button>
    <Button variant="outline" onClick={handleRefresh}>
      <RefreshCw className="h-4 w-4 mr-2" />
      Refresh
    </Button>
  </div>

  {/* Show active filters summary */}
  <div className="mt-6 text-sm text-muted-foreground">
    <p className="mb-2 font-medium">Active Filters:</p>
    <ul className="list-disc list-inside space-y-1">
      {activeFilters.map(filter => (
        <li key={filter.id}>{filter.label}</li>
      ))}
    </ul>
  </div>
</div>
```

#### 3. **First-Time User Guidance**

```tsx
<Card className="border-dashed">
  <CardContent className="pt-6">
    <div className="flex flex-col items-center text-center">
      <div className="rounded-full bg-primary/10 p-4 mb-4">
        <ShieldCheck className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Welcome to Audit Logs</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        This is your complete audit trail for all actions in your workspace.
        You can filter by event type, actor, date range, and more.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
        <div className="p-4 bg-muted/50 rounded-lg">
          <Filter className="h-6 w-6 text-primary mb-2 mx-auto" />
          <h4 className="font-medium mb-1">Filter Events</h4>
          <p className="text-xs text-muted-foreground">
            Use filters to narrow down specific events
          </p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg">
          <Download className="h-6 w-6 text-primary mb-2 mx-auto" />
          <h4 className="font-medium mb-1">Export Data</h4>
          <p className="text-xs text-muted-foreground">
            Download audit logs as CSV or JSON
          </p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg">
          <Eye className="h-6 w-6 text-primary mb-2 mx-auto" />
          <h4 className="font-medium mb-1">View Changes</h4>
          <p className="text-xs text-muted-foreground">
            See before/after diffs for all updates
          </p>
        </div>
      </div>
    </div>
  </CardContent>
</Card>
```

### Error State Patterns

#### 1. **Failed to Load Audit Log**

```tsx
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Failed to Load Audit Log</AlertTitle>
  <AlertDescription className="mt-2">
    <p className="mb-3">
      {error?.message || 'An unexpected error occurred while loading the audit log.'}
    </p>
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleRetry}>
        <RefreshCw className="h-4 w-4 mr-1" />
        Retry
      </Button>
      {error?.code === 'PERMISSION_DENIED' && (
        <Button variant="outline" size="sm" onClick={handleContactSupport}>
          Contact Support
        </Button>
      )}
    </div>
  </AlertDescription>
</Alert>
```

#### 2. **Export Failed**

```tsx
toast.error(
  'Export failed',
  {
    description: 'Unable to generate export file. Please try again or reduce your date range.',
    action: {
      label: 'Retry',
      onClick: () => handleExportRetry(),
    },
  }
);
```

#### 3. **Rate Limit Exceeded**

```tsx
<Alert variant="warning" className="mb-4">
  <Clock className="h-4 w-4" />
  <AlertTitle>Rate Limit Exceeded</AlertTitle>
  <AlertDescription>
    Too many requests. Please wait {countdown} seconds before refreshing.
  </AlertDescription>
</Alert>
```

#### 4. **Permission Denied**

```tsx
<Card className="border-destructive/50 bg-destructive/5">
  <CardContent className="pt-6">
    <div className="flex flex-col items-center text-center">
      <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">
        You don't have permission to view audit logs. Contact your administrator
        to request access.
      </p>
      <Button variant="outline" onClick={() => router.push('/dashboard')}>
        Return to Dashboard
      </Button>
    </div>
  </CardContent>
</Card>
```

### Loading States

#### 1. **Initial Load (Skeleton)**

```tsx
function AuditLogSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border border-border rounded-lg">
          <Skeleton className="h-4 w-4 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-3 w-[180px]" />
          </div>
          <Skeleton className="h-8 w-[100px]" />
        </div>
      ))}
    </div>
  );
}
```

#### 2. **Pagination Loading**

```tsx
{isPaginating && (
  <div className="flex justify-center items-center gap-2 py-4">
    <Loader2 className="h-4 w-4 animate-spin text-primary" />
    <span className="text-sm text-muted-foreground">Loading more events...</span>
  </div>
)}
```

#### 3. **Filter Loading (Inline)**

```tsx
<div className="relative">
  <Select disabled={isLoadingFilters}>
    <SelectTrigger>
      <SelectValue placeholder="Select event type" />
    </SelectTrigger>
  </Select>
  {isLoadingFilters && (
    <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
  )}
</div>
```

---

## Mobile Responsiveness

### Breakpoint Strategy

```tsx
// Tailwind breakpoints
sm: '640px'   // Small tablets, large phones (landscape)
md: '768px'   // Tablets
lg: '1024px'  // Laptops, desktops
xl: '1280px'  // Large desktops
```

### Mobile Layout Pattern: Card-Based Stacking

On mobile (<768px), convert table rows to stacked cards:

```tsx
function AuditEventCard({ event }: { event: AuditEvent }) {
  return (
    <Card className="mb-3">
      <CardContent className="p-4 space-y-3">
        {/* Header: Timeline dot + Actor */}
        <div className="flex items-start gap-3">
          <div className="relative pt-1">
            <div className={cn(
              "h-3 w-3 rounded-full border-2",
              getSeverityColor(event.severity)
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <ActorDisplay actor={event.actor} compact />
            <p className="text-xs text-muted-foreground mt-1">
              {formatRelativeTime(event.timestamp)}
            </p>
          </div>
        </div>

        {/* Event description */}
        <div className="pl-6">
          <p className="text-sm font-medium">{event.description}</p>
          {event.resource && (
            <p className="text-xs text-muted-foreground mt-1">
              {event.resource.type}: {event.resource.name}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pl-6">
          <Button variant="outline" size="sm" onClick={() => viewDetails(event)}>
            <Eye className="h-3 w-3 mr-1" />
            Details
          </Button>
          {event.has_changes && (
            <Button variant="outline" size="sm" onClick={() => viewDiff(event)}>
              <GitCompare className="h-3 w-3 mr-1" />
              Diff
            </Button>
          )}
        </div>

        {/* Expandable metadata */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
            <ChevronDown className="h-3 w-3" />
            Show metadata
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 pt-2 text-xs space-y-1">
            <div>Event ID: <code className="text-xs">{event.id}</code></div>
            <div>IP Address: {event.ip_address}</div>
            <div>User Agent: {event.user_agent}</div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
```

### Responsive Filter UI

Desktop: Horizontal filter bar
Mobile: Bottom sheet or full-screen filter modal

```tsx
function MobileFilters({ filters, onApply }: MobileFiltersProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Trigger button */}
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="md:hidden w-full"
      >
        <Filter className="h-4 w-4 mr-2" />
        Filters
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="ml-2">
            {activeFilterCount}
          </Badge>
        )}
      </Button>

      {/* Full-screen sheet on mobile */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[90vh]">
          <SheetHeader>
            <SheetTitle>Filter Audit Log</SheetTitle>
            <SheetDescription>
              Narrow down events by type, actor, date, and more
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(90vh-8rem)] mt-6">
            <div className="space-y-6 pr-4">
              {/* Date range */}
              <div>
                <label className="text-sm font-medium">Date Range</label>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              </div>

              {/* Event type */}
              <div>
                <label className="text-sm font-medium">Event Type</label>
                {eventTypes.map(type => (
                  <Checkbox
                    key={type.value}
                    checked={selectedTypes.includes(type.value)}
                    onCheckedChange={() => toggleType(type.value)}
                  >
                    {type.label}
                  </Checkbox>
                ))}
              </div>

              {/* ... more filters */}
            </div>
          </ScrollArea>

          <SheetFooter className="border-t pt-4 flex gap-2">
            <Button variant="outline" onClick={clearFilters} className="flex-1">
              Clear All
            </Button>
            <Button onClick={applyFilters} className="flex-1">
              Apply Filters
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

### Touch-Friendly Interactions

```tsx
// Minimum touch target: 44x44px (WCAG AA)
<Button size="lg" className="min-h-[44px] min-w-[44px]">
  <Download className="h-5 w-5" />
</Button>

// Swipe gestures for cards (optional enhancement)
import { useSwipeable } from 'react-swipeable';

const handlers = useSwipeable({
  onSwipedLeft: () => handleDelete(event.id),
  onSwipedRight: () => handleArchive(event.id),
  trackMouse: false,
});

<div {...handlers} className="touch-pan-y">
  <AuditEventCard event={event} />
</div>
```

### Responsive Table → Card Transformation

```tsx
function AuditLogView({ events }: AuditLogViewProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    return (
      <div className="space-y-3">
        {events.map(event => (
          <AuditEventCard key={event.id} event={event} />
        ))}
      </div>
    );
  }

  return (
    <table className="w-full">
      {/* Desktop table layout */}
    </table>
  );
}
```

---

## Accessibility Considerations (WCAG AA)

### WCAG 2.2 Level AA Requirements

#### 1. **Keyboard Navigation**

**Requirements:**
- All interactive elements accessible via keyboard
- Logical tab order
- Visible focus indicators
- Keyboard shortcuts for common actions

**Implementation:**

```tsx
// Focus trap in modal
import { FocusTrap } from '@radix-ui/react-focus-scope';

<Dialog>
  <FocusTrap asChild>
    <DialogContent onKeyDown={handleKeyDown}>
      {/* Modal content */}
    </DialogContent>
  </FocusTrap>
</Dialog>

// Keyboard shortcuts
useEffect(() => {
  function handleKeyPress(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case 'f':
          e.preventDefault();
          focusSearchInput();
          break;
        case 'e':
          e.preventDefault();
          handleExport('csv');
          break;
        case 'r':
          e.preventDefault();
          handleRefresh();
          break;
      }
    }
  }

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);

// Keyboard shortcut help
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon">
      <Keyboard className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent side="left" className="max-w-xs">
    <div className="space-y-2 text-xs">
      <div className="flex justify-between gap-4">
        <kbd>⌘/Ctrl + F</kbd>
        <span>Focus search</span>
      </div>
      <div className="flex justify-between gap-4">
        <kbd>⌘/Ctrl + E</kbd>
        <span>Export</span>
      </div>
      <div className="flex justify-between gap-4">
        <kbd>⌘/Ctrl + R</kbd>
        <span>Refresh</span>
      </div>
    </div>
  </TooltipContent>
</Tooltip>
```

#### 2. **Screen Reader Support**

**Requirements:**
- Proper semantic HTML
- ARIA labels and descriptions
- Table headers and relationships
- Status announcements

**Implementation:**

```tsx
// Semantic table structure
<table role="table" aria-label="Audit log events">
  <thead>
    <tr>
      <th scope="col" id="event-time">Time</th>
      <th scope="col" id="event-actor">Actor</th>
      <th scope="col" id="event-action">Action</th>
      <th scope="col" id="event-resource">Resource</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td headers="event-time">
        <time dateTime={event.timestamp}>
          {formatRelativeTime(event.timestamp)}
        </time>
      </td>
      <td headers="event-actor">
        <ActorDisplay actor={event.actor} />
      </td>
      {/* ... */}
    </tr>
  </tbody>
</table>

// Live region for status updates
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
  {statusMessage}
</div>

// Example usage
function announceFilterChange(count: number) {
  setStatusMessage(`${count} events match your filters`);
}

// Descriptive buttons
<Button
  aria-label={`View details for event: ${event.description}`}
  onClick={() => viewDetails(event)}
>
  <Eye className="h-4 w-4" aria-hidden="true" />
  <span className="sr-only">View details</span>
</Button>

// Dialog accessibility
<Dialog>
  <DialogContent
    aria-describedby="dialog-description"
    onOpenAutoFocus={(e) => {
      // Focus first interactive element
      const firstInput = e.currentTarget.querySelector('input, button');
      (firstInput as HTMLElement)?.focus();
    }}
  >
    <DialogHeader>
      <DialogTitle id="dialog-title">Event Details</DialogTitle>
      <DialogDescription id="dialog-description">
        Complete information about this audit event
      </DialogDescription>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

#### 3. **Color Contrast (WCAG AA: 4.5:1 for text)**

**Verify Contrast:**
- Text: 4.5:1 minimum
- Large text (18pt+): 3:1 minimum
- UI components: 3:1 minimum

**Implementation:**

```tsx
// Use design tokens that meet contrast requirements
// Already compliant in existing zmanim codebase

// Example: Success/error states
<Badge
  variant="success"
  className="bg-green-600 text-white" // 4.52:1 contrast
>
  Approved
</Badge>

<Badge
  variant="destructive"
  className="bg-red-600 text-white" // 4.54:1 contrast
>
  Rejected
</Badge>

// Severity indicators with icons (not color-only)
function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  const config = {
    info: { icon: Info, label: 'Info', className: 'bg-blue-100 text-blue-800' },
    warning: { icon: AlertTriangle, label: 'Warning', className: 'bg-amber-100 text-amber-800' },
    error: { icon: XCircle, label: 'Error', className: 'bg-red-100 text-red-800' },
    critical: { icon: AlertOctagon, label: 'Critical', className: 'bg-red-600 text-white' },
  }[severity];

  const Icon = config.icon;

  return (
    <Badge className={config.className}>
      <Icon className="h-3 w-3 mr-1" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}
```

#### 4. **Focus Management**

```tsx
// Return focus after dialog close
const triggerRef = useRef<HTMLButtonElement>(null);

<Dialog onOpenChange={(open) => {
  if (!open) {
    triggerRef.current?.focus();
  }
}}>
  <DialogTrigger ref={triggerRef}>Open Details</DialogTrigger>
  <DialogContent>
    {/* ... */}
  </DialogContent>
</Dialog>

// Skip links for long lists
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground"
>
  Skip to content
</a>
```

#### 5. **Motion & Animation (Reduced Motion)**

```tsx
// Respect prefers-reduced-motion
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

<div className={cn(
  "transition-all",
  !prefersReducedMotion && "animate-in fade-in-0 slide-in-from-left-5"
)}>
  {/* Content */}
</div>

// CSS approach
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

#### 6. **Form Labels & Error Messages**

```tsx
// Proper label association
<div className="space-y-2">
  <label htmlFor="search-input" className="text-sm font-medium">
    Search Events
  </label>
  <Input
    id="search-input"
    type="text"
    value={searchQuery}
    onChange={handleSearch}
    aria-describedby={hasError ? "search-error" : undefined}
    aria-invalid={hasError}
  />
  {hasError && (
    <p id="search-error" className="text-sm text-destructive" role="alert">
      Search query must be at least 3 characters
    </p>
  )}
</div>
```

#### 7. **Accessible Data Tables**

Based on research findings:

```tsx
// Proper table markup
<table>
  <caption className="sr-only">Audit log events</caption>
  <thead>
    <tr>
      <th scope="col" abbr="Time">Timestamp</th>
      <th scope="col" abbr="User">Actor</th>
      <th scope="col" abbr="Type">Event Type</th>
      <th scope="col" abbr="Item">Resource</th>
      <th scope="col" abbr="Actions">Actions</th>
    </tr>
  </thead>
  <tbody>
    {events.map(event => (
      <tr key={event.id}>
        <th scope="row">
          <time dateTime={event.timestamp}>
            {formatTime(event.timestamp)}
          </time>
        </th>
        <td>{event.actor.name}</td>
        <td>{event.event_type}</td>
        <td>{event.resource?.name}</td>
        <td>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`View details for ${event.description}`}
          >
            Details
          </Button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

### Testing Checklist

- [ ] Screen reader testing (NVDA/VoiceOver)
- [ ] Keyboard-only navigation
- [ ] Color contrast verification (WebAIM tool)
- [ ] Focus indicator visibility
- [ ] Form validation and error messages
- [ ] ARIA attributes validation
- [ ] Reduced motion preference
- [ ] Touch target sizes (minimum 44x44px)
- [ ] Zoom to 200% without loss of functionality
- [ ] Text spacing adjustments

---

## Component Breakdown

### Core Components Required

| Component | Purpose | Dependencies | Priority |
|-----------|---------|--------------|----------|
| **AuditLogTable** | Main table view with timeline | Table, Badge, Button | P0 |
| **AuditLogFilters** | Filter bar with multi-select | Command, Popover, DatePicker | P0 |
| **AuditEventCard** | Mobile card layout | Card, Badge, ActorDisplay | P0 |
| **ActorDisplay** | Actor info with avatar + role | Avatar, Badge | P0 |
| **EventDiffDialog** | Before/after comparison modal | Dialog, ReactDiffViewer | P0 |
| **FieldDiffTable** | Inline field-by-field diff | Table | P0 |
| **ExportButton** | Export dropdown menu | DropdownMenu, Dialog | P1 |
| **FilterChips** | Active filter badges | Badge, Button | P1 |
| **LiveUpdateBanner** | New events notification | Alert, Button | P1 |
| **AuditLogPagination** | Pagination controls | Button | P1 |
| **EventGroupCollapse** | Grouped events collapse | Collapsible, Button | P2 |
| **ResourceActivityThread** | Resource-specific timeline | Dialog, ScrollArea | P2 |
| **MobileFilters** | Mobile filter sheet | Sheet, ScrollArea | P2 |
| **AuditLogSkeleton** | Loading skeleton | Skeleton | P2 |

### Component Hierarchy

```
AuditLogPage
├── AuditLogFilters
│   ├── SearchInput
│   ├── DateRangePicker
│   ├── EventTypeFilter (Command multi-select)
│   ├── ActorFilter (Command multi-select)
│   ├── SeverityFilter (Command multi-select)
│   └── FilterChips
│
├── LiveUpdateBanner (conditional)
│
├── AuditLogTable (desktop)
│   ├── TimelineColumn
│   ├── ActorDisplay
│   ├── EventDescription
│   ├── ResourceLink
│   ├── ActionButtons
│   │   ├── ViewDetailsButton → EventDetailsDialog
│   │   └── ViewDiffButton → EventDiffDialog
│   │       ├── FieldDiffTable (simple)
│   │       └── ReactDiffViewer (complex)
│   └── EventGroupCollapse (for grouped events)
│
├── AuditEventCardList (mobile)
│   └── AuditEventCard[]
│       ├── ActorDisplay
│       ├── EventDescription
│       └── ExpandableMetadata
│
├── AuditLogPagination
│   ├── PreviousButton
│   ├── PageNumbers
│   ├── NextButton
│   └── ItemsPerPageSelector
│
└── ExportButton
    └── ExportDialog
```

### Shared Component Reuse

From existing zmanim codebase:

| Existing Component | Reuse For |
|-------------------|-----------|
| `Badge` | Status indicators, filter chips, severity badges |
| `Dialog` | Event details, diff viewer, export config |
| `Button` | All actions |
| `Input` | Search field |
| `Avatar` | Actor display |
| `Card` | Mobile event cards, empty states |
| `Alert` | Error messages, warnings, live update banner |
| `Skeleton` | Loading states |
| `ScrollArea` | Long event lists, mobile filter sheet |
| `Popover` | Filter dropdowns, tooltips |
| `Command` | Multi-select filters with search |
| `Checkbox` | Filter options |
| `Collapsible` | Event groups, expandable metadata |
| `Tooltip` | Info icons, keyboard shortcuts |
| `Sheet` | Mobile filters (bottom sheet) |

---

## Interaction Flows

### Flow 1: Viewing Audit Log (First Visit)

```
1. User navigates to /admin/audit-log
   ↓
2. System checks permissions
   ↓ (authorized)
3. Load last 50 events (default: last 7 days, all types)
   ↓
4. Display timeline table with:
   - Search bar
   - Filter bar (collapsed by default)
   - Event list
   - Pagination
   ↓
5. User sees empty state OR events
   ↓ (if first-time user)
6. Show onboarding tooltip/guide
```

### Flow 2: Filtering Events

```
1. User clicks "Event Type" filter
   ↓
2. Popover opens with multi-select options
   ↓
3. User selects "Updated" and "Deleted"
   ↓
4. Filter chips appear below filter bar
   ↓
5. Table refreshes with filtered results
   ↓
6. URL updates: /admin/audit-log?event_type=updated,deleted
   ↓
7. User adds date range filter
   ↓
8. Both filters apply (AND logic)
   ↓
9. Event count updates in header: "234 events"
```

### Flow 3: Viewing Event Diff

```
1. User clicks "View Diff" button on event row
   ↓
2. System determines diff type:
   - Simple field changes → FieldDiffTable (inline)
   - Complex JSON → Modal with ReactDiffViewer
   ↓
3. Modal opens with:
   - Event metadata header
   - Before/After comparison
   - Color-coded changes
   - Close button
   ↓
4. User reviews changes
   ↓
5. (Optional) User clicks "Revert" button
   ↓
6. Confirmation dialog appears
   ↓
7. User confirms revert
   ↓
8. API call to revert change
   ↓
9. Success toast appears
   ↓
10. Audit log refreshes with new "Reverted" event
```

### Flow 4: Exporting Audit Log

```
1. User clicks "Export" dropdown
   ↓
2. Menu shows:
   - Export as CSV (234 events)
   - Export as JSON (234 events)
   - Generate PDF Report
   ↓
3. User selects "Export as CSV"
   ↓
4. (If >1000 events) Export config dialog opens:
   - Format selection
   - Date range override
   - Column selection (CSV only)
   - Limit warning
   ↓
5. User clicks "Export 234 Events"
   ↓
6. Button shows loading state: "Exporting..."
   ↓
7. Backend generates CSV file
   ↓
8. Browser downloads: audit-log-csv-2025-12-26.csv
   ↓
9. Success toast: "Export complete: 234 events downloaded"
```

### Flow 5: Real-Time Update Notification

```
1. User viewing audit log (polling every 30s)
   ↓
2. Backend detects 3 new events since last poll
   ↓
3. Banner appears at top:
   "3 new events available [Refresh]"
   ↓
4. User clicks "Refresh" button
   ↓
5. Table smoothly updates:
   - New events appear at top
   - Flash animation on new rows
   - Scroll position preserved
   ↓
6. Banner dismisses
```

### Flow 6: Mobile Filtering

```
1. User on mobile device (<768px)
   ↓
2. Sees "Filters" button (horizontal bar collapsed)
   ↓
3. Taps "Filters" button
   ↓
4. Bottom sheet slides up (90vh height)
   ↓
5. User scrolls through filter options:
   - Date range presets
   - Event type checkboxes
   - Actor search
   - Severity badges
   ↓
6. User selects filters
   ↓
7. Badge count updates on "Filters" button
   ↓
8. User taps "Apply Filters"
   ↓
9. Sheet closes
   ↓
10. Event list refreshes with filters applied
```

### Flow 7: Keyboard Navigation

```
1. User presses Tab (focus on search input)
   ↓
2. User types search query
   ↓
3. Presses Ctrl/Cmd + F (focus search input - already focused)
   ↓
4. Presses Tab repeatedly:
   → Event Type filter
   → Date Range filter
   → First event row
   → "View Details" button
   → "View Diff" button
   → Next event row
   ↓
5. User presses Enter on "View Details"
   ↓
6. Dialog opens, focus traps inside
   ↓
7. User presses Esc
   ↓
8. Dialog closes, focus returns to trigger button
   ↓
9. User presses Ctrl/Cmd + E (export shortcut)
   ↓
10. Export dropdown opens
```

---

## Color Coding System

### Event Severity Colors

| Severity | Badge Color | Timeline Dot | Use Case |
|----------|-------------|--------------|----------|
| **Info** | `bg-blue-100 text-blue-800` | `bg-blue-500` | Standard operations (create, read) |
| **Warning** | `bg-amber-100 text-amber-800` | `bg-amber-500` | Potentially risky actions (bulk delete, config change) |
| **Error** | `bg-red-100 text-red-800` | `bg-red-500` | Failed operations, validation errors |
| **Critical** | `bg-red-600 text-white` | `bg-red-600 animate-pulse` | Security events, system failures, data breaches |

### Event Type Colors

| Event Type | Badge Color | Icon |
|------------|-------------|------|
| **Created** | `bg-green-100 text-green-800` | `<Plus />` |
| **Updated** | `bg-amber-100 text-amber-800` | `<Edit />` |
| **Deleted** | `bg-red-100 text-red-800` | `<Trash />` |
| **Published** | `bg-purple-100 text-purple-800` | `<Rocket />` |
| **Approved** | `bg-green-100 text-green-800` | `<CheckCircle />` |
| **Rejected** | `bg-red-100 text-red-800` | `<XCircle />` |
| **Reverted** | `bg-orange-100 text-orange-800` | `<RotateCcw />` |

### Actor Type Indicators

| Actor Type | Avatar Background | Icon |
|------------|-------------------|------|
| **User** | `bg-purple-100` | `<User />` |
| **Admin** | `bg-red-100` | `<ShieldCheck />` |
| **System** | `bg-blue-100` | `<Bot />` |
| **API Key** | `bg-gray-100` | `<Key />` |
| **Webhook** | `bg-cyan-100` | `<Webhook />` |
| **Impersonating** | `bg-amber-100` | `<ShieldAlert />` |

### Diff Visualization Colors

| Change Type | Background | Text | Border |
|-------------|------------|------|--------|
| **Added** | `bg-green-50 dark:bg-green-950/20` | `text-green-600 dark:text-green-400` | `border-green-200 dark:border-green-900` |
| **Removed** | `bg-red-50 dark:bg-red-950/20` | `text-red-600 dark:text-red-400` | `border-red-200 dark:border-red-900` |
| **Changed** | `bg-amber-50 dark:bg-amber-950/20` | `text-amber-600 dark:text-amber-400` | `border-amber-200 dark:border-amber-900` |
| **No Change** | `bg-muted/50` | `text-muted-foreground` | `border-border` |

### Status Colors (Audit-Specific)

| Status | Badge | Use Case |
|--------|-------|----------|
| **Pending Review** | `bg-yellow-100 text-yellow-800` | Actions awaiting approval |
| **In Progress** | `bg-blue-100 text-blue-800` | Long-running operations |
| **Completed** | `bg-green-100 text-green-800` | Successfully finished |
| **Failed** | `bg-red-100 text-red-800` | Operation failed |
| **Cancelled** | `bg-gray-100 text-gray-800` | User-cancelled action |

---

## View Comparison Matrix

| Aspect | Timeline View | Table View | Card View (Mobile) |
|--------|---------------|------------|-------------------|
| **Best For** | Activity feeds, chronological storytelling | Data analysis, filtering, sorting | Mobile devices, touch interfaces |
| **Information Density** | Low-Medium | High | Low |
| **Scanning Efficiency** | Medium (vertical flow) | High (column scanning) | Low (scrolling required) |
| **Context Visibility** | High (shows flow of events) | Medium | High (per-card) |
| **Filtering Support** | Medium | Excellent | Medium |
| **Diff Visualization** | Inline expandable | Modal dialog | Modal dialog |
| **Grouping Support** | Excellent | Good | Good |
| **Accessibility** | Good (semantic HTML) | Excellent (table structure) | Good (heading hierarchy) |
| **Mobile Experience** | Fair (lots of scrolling) | Poor (horizontal scroll) | Excellent (native) |
| **Implementation Complexity** | Medium | Low | Medium |
| **Example Use Case** | "Show me what John did today" | "Find all updates to zmanim in December" | "Browse audit log on phone" |

### Recommended Hybrid Approach

**Desktop (≥768px):**
- **Primary View:** Table with timeline indicators (leftmost column)
- Combines scanning efficiency of tables with visual flow of timelines
- Sortable columns, inline filters

**Mobile (<768px):**
- **Primary View:** Stacked cards with timeline dots on left edge
- Native mobile experience
- Bottom sheet for filters

**Implementation:**

```tsx
function AuditLogView({ events }: { events: AuditEvent[] }) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <>
      {/* Filters (responsive) */}
      {isMobile ? <MobileFilters /> : <DesktopFilters />}

      {/* Event list */}
      {isMobile ? (
        <AuditEventCardList events={events} />
      ) : (
        <AuditLogTable events={events} />
      )}

      {/* Pagination */}
      <AuditLogPagination />
    </>
  );
}
```

---

## Implementation Roadmap

### Phase 1: Core Functionality (P0 - Week 1-2)

- [ ] Database schema and migrations (audit_log table)
- [ ] Backend endpoints (list, filter, single event)
- [ ] AuditLogTable component (desktop)
- [ ] Basic filtering (event type, date range)
- [ ] ActorDisplay component
- [ ] Pagination
- [ ] Loading and error states

### Phase 2: Enhanced Features (P1 - Week 3-4)

- [ ] AuditEventCard component (mobile responsive)
- [ ] EventDiffDialog (before/after comparison)
- [ ] Export functionality (CSV, JSON)
- [ ] FilterChips (active filters)
- [ ] Search functionality
- [ ] LiveUpdateBanner (polling)
- [ ] Multi-select filters (Command component)

### Phase 3: Advanced Features (P2 - Week 5-6)

- [ ] Event grouping and threading
- [ ] ResourceActivityThread (resource-specific view)
- [ ] MobileFilters (bottom sheet)
- [ ] Real-time updates (WebSocket - optional)
- [ ] PDF export (optional)
- [ ] Advanced analytics dashboard (optional)
- [ ] Audit log retention policies

### Phase 4: Polish & Optimization (Week 7-8)

- [ ] Accessibility audit (WCAG AA compliance)
- [ ] Performance optimization (virtualized lists for large datasets)
- [ ] Keyboard shortcuts
- [ ] User preferences (saved filters, column visibility)
- [ ] Documentation
- [ ] E2E tests (Playwright)

---

## Sources & References

### Industry Research

**Stripe:**
- [View API Request Logs](https://docs.stripe.com/development/dashboard/request-logs?locale=en-GB)
- [Web Dashboard Basics](https://docs.stripe.com/dashboard/basics)
- [Audit Your Numbers](https://docs.stripe.com/revenue-recognition/reports/audit-numbers)

**GitHub:**
- [Reviewing Audit Log for Organizations](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization)
- [Audit Log Streaming Public Beta](https://github.blog/news-insights/product-news/audit-log-streaming-public-beta/)
- [Audit Log Streaming API Requests GA](https://github.blog/changelog/2025-01-13-audit-log-streaming-of-api-requests-is-generally-available/)

**Auth0:**
- [Auth0 Logs Documentation](https://auth0.com/docs/deploy-monitor/logs)
- [Auth0 FGA Logging API Audit Trail](https://auth0.com/blog/auth0-fga-logging-api-a-complete-audit-trail-for-authorization/)
- [Pangea Auth0 Event Stream](https://pangea.cloud/docs/audit/log-streaming/auth0)

**AWS CloudTrail:**
- [Working with CloudTrail Event History](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/view-cloudtrail-events.html)
- [Viewing Recent Management Events](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/view-cloudtrail-events-console.html)
- [Visualizing CloudTrail Events with Kibana](https://aws.amazon.com/blogs/mt/visualizing-aws-cloudtrail-events-using-kibana/)

**Supabase:**
- [Auth Audit Logs](https://supabase.com/docs/guides/auth/audit-logs)
- [PGAudit Extension](https://supabase.com/docs/guides/database/extensions/pgaudit)
- [GitHub supabase/supa_audit](https://github.com/supabase/supa_audit)
- [Logging Documentation](https://supabase.com/docs/guides/telemetry/logs)

**Linear:**
- [Collapsed Issue History Changelog](https://linear.app/changelog/2025-04-03-collapsed-issue-history)
- [How We Redesigned the Linear UI (Part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Timeline Documentation](https://linear.app/docs/timeline)

### Best Practices & Patterns

**Audit Log Design:**
- [Guide to Building Audit Logs for Application Software (Medium)](https://medium.com/@tony.infisical/guide-to-building-audit-logs-for-application-software-b0083bb58604)
- [The Surprising Complexities of Building Audit Logs (Harness)](https://www.harness.io/blog/complexities-of-building-audit-logs)
- [What Makes a Good Audit Trail (Apptrail)](https://apptrail.com/blog/2022/02/05/what-makes-a-good-audit-trail)

**UI/UX Patterns:**
- [Diff Viewer (SmartBear Collaborator)](https://support.smartbear.com/collaborator/docs/reference/ui/diff-viewer.html)
- [Visual Comparison Techniques for Before/After Analysis (Dev3lop)](https://dev3lop.com/visual-comparison-techniques-for-before-after-analysis/)
- [Design Better Pagination (Andrew Coyle)](https://www.andrewcoyle.com/blog/design-better-pagination)
- [Designing Perfect Feature Comparison Table (Smashing Magazine)](https://www.smashingmagazine.com/2017/08/designing-perfect-feature-comparison-table/)

**Real-Time Updates:**
- [Real-Time Notification System with Node.js and WebSockets (Codefinity)](https://codefinity.com/blog/Real-Time-Notification-System-with-Node.js-and-WebSockets)
- [Implementing Real-time Notifications in Next.js with WebSockets (CloudDevs)](https://clouddevs.com/next/real-time-notifications-with-websockets/)
- [Real-Time Updates: Why I Chose SSE Over WebSockets (DEV)](https://dev.to/okrahul/real-time-updates-in-web-apps-why-i-chose-sse-over-websockets-k8k)

**Accessibility:**
- [WebAIM WCAG 2 Checklist](https://webaim.org/standards/wcag/checklist)
- [WCAG Audit: How to Test for Accessibility Compliance (AudioEye)](https://www.audioeye.com/post/wcag-audit/)
- [Understanding WCAG 2.2 (GOV.UK Service Manual)](https://www.gov.uk/service-manual/helping-people-to-use-your-service/understanding-wcag)
- [WCAG Level AA Checklist (accessiBe)](https://accessibe.com/blog/knowledgebase/wcag-checklist)

---

## Appendix: Code Examples

### Complete AuditLogTable Component (TypeScript)

```tsx
/**
 * @file AuditLogTable.tsx
 * @purpose Main audit log table component with timeline visualization
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓ wcag-aa:✓
 */

'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAdminApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Eye,
  GitCompare,
  Loader2,
  AlertCircle,
  RefreshCw,
  Download,
} from 'lucide-react';
import { ActorDisplay } from './ActorDisplay';
import { EventDiffDialog } from './EventDiffDialog';
import { AuditLogFilters, type AuditLogFilters as FilterState } from './AuditLogFilters';
import { LiveUpdateBanner } from './LiveUpdateBanner';
import { cn, formatRelativeTime } from '@/lib/utils';

interface AuditEvent {
  id: string;
  timestamp: string;
  event_type: 'created' | 'updated' | 'deleted' | 'published' | 'approved' | 'rejected' | 'reverted';
  severity: 'info' | 'warning' | 'error' | 'critical';
  description: string;
  actor: {
    id: string;
    type: 'user' | 'system' | 'api_key';
    name: string;
    email?: string;
    avatar_url?: string;
    role: 'admin' | 'publisher' | 'public';
    is_impersonating?: boolean;
  };
  resource?: {
    type: string;
    id: string;
    name: string;
  };
  changes?: Record<string, { before: unknown; after: unknown }>;
  metadata?: Record<string, unknown>;
}

interface AuditLogResponse {
  events: AuditEvent[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export function AuditLogTable() {
  const api = useAdminApi();
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    event_types: [],
    actor_ids: [],
    severity: [],
    date_range: { start: null, end: null },
  });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);

  // Fetch audit log events
  const {
    data: auditLog,
    isLoading,
    error,
    refetch,
  } = useQuery<AuditLogResponse>({
    queryKey: ['audit-log', filters, page, perPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
        ...buildFilterParams(filters),
      });
      return api.get<AuditLogResponse>(`/audit-log?${params}`);
    },
    staleTime: 30000, // 30 seconds
    retry: 1,
  });

  const handleViewDiff = useCallback((event: AuditEvent) => {
    setSelectedEvent(event);
    setDiffDialogOpen(true);
  }, []);

  const getSeverityColor = (severity: AuditEvent['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600 border-red-600 animate-pulse';
      case 'error':
        return 'bg-red-500 border-red-500';
      case 'warning':
        return 'bg-amber-500 border-amber-500';
      default:
        return 'bg-blue-500 border-blue-500';
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to Load Audit Log</AlertTitle>
        <AlertDescription>
          <p className="mb-3">{error.message}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Audit Log</h1>
          <p className="text-muted-foreground mt-1">
            Complete audit trail for all actions in your workspace
          </p>
        </div>
        <Button variant="outline" onClick={() => handleExport('csv')}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <AuditLogFilters filters={filters} onFiltersChange={setFilters} />

      {/* Live updates */}
      <LiveUpdateBanner onRefresh={refetch} />

      {/* Table */}
      {isLoading ? (
        <AuditLogSkeleton />
      ) : auditLog && auditLog.events.length > 0 ? (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table" aria-label="Audit log events">
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="w-8 px-3 py-3"></th>
                  <th scope="col" className="px-3 py-3 text-left font-medium">Time</th>
                  <th scope="col" className="px-3 py-3 text-left font-medium">Actor</th>
                  <th scope="col" className="px-3 py-3 text-left font-medium">Event</th>
                  <th scope="col" className="px-3 py-3 text-left font-medium">Resource</th>
                  <th scope="col" className="px-3 py-3 text-left font-medium">Severity</th>
                  <th scope="col" className="px-3 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditLog.events.map((event, index) => (
                  <tr
                    key={event.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {/* Timeline indicator */}
                    <td className="px-3 py-4 w-8">
                      <div className="relative">
                        <div
                          className={cn(
                            'h-3 w-3 rounded-full border-2',
                            getSeverityColor(event.severity)
                          )}
                        />
                        {index < auditLog.events.length - 1 && (
                          <div className="absolute left-[5px] top-3 bottom-0 w-px bg-border" />
                        )}
                      </div>
                    </td>

                    {/* Timestamp */}
                    <td className="px-3 py-4 whitespace-nowrap">
                      <time dateTime={event.timestamp} className="text-muted-foreground">
                        {formatRelativeTime(event.timestamp)}
                      </time>
                    </td>

                    {/* Actor */}
                    <td className="px-3 py-4">
                      <ActorDisplay actor={event.actor} compact />
                    </td>

                    {/* Event description */}
                    <td className="px-3 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{event.description}</span>
                        <code className="text-xs text-muted-foreground">
                          {event.event_type}
                        </code>
                      </div>
                    </td>

                    {/* Resource */}
                    <td className="px-3 py-4">
                      {event.resource ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{event.resource.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {event.resource.type}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Severity */}
                    <td className="px-3 py-4">
                      <SeverityBadge severity={event.severity} />
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-4">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(event)}
                          aria-label={`View details for ${event.description}`}
                        >
                          <Eye className="h-3 w-3" aria-hidden="true" />
                        </Button>
                        {event.changes && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDiff(event)}
                            aria-label={`View changes for ${event.description}`}
                          >
                            <GitCompare className="h-3 w-3" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-border p-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {((page - 1) * perPage) + 1} to {Math.min(page * perPage, auditLog.total)} of {auditLog.total} events
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={!auditLog.has_more}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState filters={filters} onClearFilters={() => setFilters({})} />
      )}

      {/* Diff Dialog */}
      {selectedEvent && (
        <EventDiffDialog
          event={selectedEvent}
          open={diffDialogOpen}
          onOpenChange={setDiffDialogOpen}
        />
      )}
    </div>
  );
}

// Helper function to build filter params
function buildFilterParams(filters: FilterState): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.search) params.search = filters.search;
  if (filters.event_types?.length) params.event_type = filters.event_types.join(',');
  if (filters.actor_ids?.length) params.actor_id = filters.actor_ids.join(',');
  if (filters.severity?.length) params.severity = filters.severity.join(',');
  if (filters.date_range?.start) params.start_date = filters.date_range.start;
  if (filters.date_range?.end) params.end_date = filters.date_range.end;

  return params;
}
```

---

## Conclusion

This document provides a comprehensive blueprint for implementing audit log visualization in the zmanim platform, based on industry best practices from leading platforms and tailored to the existing codebase patterns.

**Key Takeaways:**
1. Use a **hybrid timeline-table layout** for desktop, **card-based** for mobile
2. Implement **multi-select filters** with search, date ranges, and quick presets
3. Provide **side-by-side diff visualization** with color coding for changes
4. Show **actor information prominently** with impersonation badges
5. Support **CSV and JSON export** with filter preservation
6. Use **subtle notifications** for real-time updates (avoid aggressive auto-refresh)
7. Ensure **WCAG AA compliance** with semantic HTML, ARIA labels, keyboard navigation
8. Reuse existing components from zmanim codebase (Badge, Dialog, Button, etc.)

**Next Steps:**
1. Review and approve UX patterns with stakeholders
2. Create detailed database schema for audit_log table
3. Implement backend endpoints (Phase 1)
4. Build core UI components (Phase 1-2)
5. Add enhanced features (Phase 2-3)
6. Conduct accessibility audit (Phase 4)
7. Launch and iterate based on user feedback
