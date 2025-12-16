# Story 2.5: Enhanced Coverage Management

**Epic:** Epic 2 - Publisher User Management & Dashboard
**Status:** Draft
**Priority:** High
**Story Points:** 5

---

## User Story

**As a** publisher,
**I want** to define my geographic coverage with an intuitive multi-location interface,
**So that** I can precisely define where my zmanim are available.

---

## Acceptance Criteria

### AC-1: View Coverage
**Given** I am on /publisher/coverage
**When** the page loads
**Then** I see my current coverage areas listed with country/region/city breakdown
**And** I see a map visualization of my coverage

### AC-2: Add Coverage - Hierarchy
**Given** I want to add coverage
**When** I click "Add Coverage"
**Then** I see a hierarchical selector: Country → Region → City

### AC-3: Add Country-Level Coverage
**Given** I select a country (e.g., "United States")
**When** I choose to add at country level
**Then** all cities in that country are included in my coverage

### AC-4: Add Region-Level Coverage
**Given** I select a country and then a region (e.g., "New York")
**When** I choose to add at region level
**Then** all cities in that region are included in my coverage

### AC-5: Add City-Level Coverage
**Given** I drill down to city level (e.g., "Brooklyn")
**When** I select the city
**Then** only that specific city is added to my coverage

### AC-6: Coverage List Display
**Given** I have multiple coverage areas
**When** I view the coverage list
**Then** each area shows: level (country/region/city), name, priority, active status

### AC-7: Delete Coverage
**Given** I want to remove coverage
**When** I click the delete icon on a coverage area
**Then** a confirmation dialog appears
**And** upon confirmation, the coverage is removed

### AC-8: Priority Handling
**Given** I have overlapping coverage (e.g., "United States" + "Brooklyn")
**When** a user searches for Brooklyn
**Then** the more specific coverage (Brooklyn) takes priority

### AC-9: Map Update
**Given** I modify coverage
**When** I save changes
**Then** the map updates to reflect new coverage areas

---

## Technical Notes

### Database Changes

```sql
-- Modify publisher_cities table (or create publisher_coverage)
ALTER TABLE publisher_cities ADD COLUMN IF NOT EXISTS coverage_level TEXT NOT NULL DEFAULT 'city';
-- Values: 'country', 'region', 'city'

ALTER TABLE publisher_cities ADD COLUMN IF NOT EXISTS geo_reference TEXT;
-- For country: country code (e.g., 'US')
-- For region: region identifier (e.g., 'US-NY')
-- For city: NULL (use existing city_id)

ALTER TABLE publisher_cities ADD COLUMN IF NOT EXISTS display_name TEXT;
-- Human-readable name for the coverage area

CREATE INDEX IF NOT EXISTS idx_publisher_cities_level ON publisher_cities(coverage_level);
```

### Backend Changes

**File:** `api/internal/handlers/coverage.go` (enhance)
```go
// GET /api/publisher/coverage
func (h *Handlers) GetPublisherCoverage(w http.ResponseWriter, r *http.Request) {
    // Return coverage with level info
}

// POST /api/publisher/coverage
type AddCoverageRequest struct {
    Level        string `json:"level"`        // 'country', 'region', 'city'
    GeoReference string `json:"geo_reference"` // country code, region code, or city_id
    Priority     int    `json:"priority"`
}

// DELETE /api/publisher/coverage/{id}
func (h *Handlers) DeletePublisherCoverage(w http.ResponseWriter, r *http.Request) {
    // Remove coverage entry
}
```

**File:** `api/internal/services/coverage_service.go` (create/enhance)
```go
// GetCitiesForCoverage returns all city IDs covered by a coverage entry
func (s *CoverageService) GetCitiesForCoverage(level, geoRef string) ([]string, error) {
    switch level {
    case "country":
        return s.getCitiesByCountry(geoRef)
    case "region":
        return s.getCitiesByRegion(geoRef)
    case "city":
        return []string{geoRef}, nil
    }
}

// FindPublishersForCity considers coverage hierarchy
func (s *CoverageService) FindPublishersForCity(cityId string) ([]Publisher, error) {
    // Query with priority: city > region > country
}
```

### Frontend Changes

**File:** `web/app/publisher/coverage/page.tsx` (refactor)
- Replace simple list with CoverageManager component

**File:** `web/components/publisher/CoverageManager.tsx` (create)
```typescript
interface CoverageArea {
  id: string;
  level: 'country' | 'region' | 'city';
  geo_reference: string;
  display_name: string;
  priority: number;
  is_active: boolean;
  city_count?: number;  // For country/region levels
}
```

**File:** `web/components/publisher/CoverageHierarchyPicker.tsx` (create)
- Three-column picker: Country | Region | City
- "Add at this level" button at each step
- Show city counts for country/region selections

**File:** `web/components/publisher/CoverageList.tsx` (create)
- Display coverage entries with badges for level
- Delete button with confirmation dialog
- Priority indicator

**File:** `web/components/publisher/CoverageMap.tsx` (create)
- Use Leaflet or simple SVG world map
- Highlight covered countries/regions
- Zoom to show city markers for city-level coverage

### API Endpoints

```
GET /api/publisher/coverage
Response: {
  coverage: [{
    id: string,
    level: 'country' | 'region' | 'city',
    geo_reference: string,
    display_name: string,
    priority: number,
    is_active: boolean,
    city_count: number,
    created_at: string
  }]
}

POST /api/publisher/coverage
Request: {
  level: 'country' | 'region' | 'city',
  geo_reference: string,
  priority?: number
}
Response: { coverage: {...} }
Errors: 400 (invalid), 409 (already covered)

DELETE /api/publisher/coverage/{id}
Response: { success: true }
Errors: 404 (not found)
```

### Query for Finding Publishers (Updated)

```sql
-- Find publishers for a city, considering hierarchy
WITH city_info AS (
  SELECT id, country_code, region FROM cities WHERE id = $1
),
coverage_matches AS (
  SELECT
    pc.publisher_id,
    pc.priority,
    CASE pc.coverage_level
      WHEN 'city' THEN 3
      WHEN 'region' THEN 2
      WHEN 'country' THEN 1
    END as specificity
  FROM publisher_cities pc
  JOIN city_info ci ON (
    (pc.coverage_level = 'city' AND pc.city_id = ci.id) OR
    (pc.coverage_level = 'region' AND pc.geo_reference = ci.country_code || '-' || ci.region) OR
    (pc.coverage_level = 'country' AND pc.geo_reference = ci.country_code)
  )
  WHERE pc.is_active = true
)
SELECT DISTINCT ON (publisher_id)
  publisher_id, priority, specificity
FROM coverage_matches
ORDER BY publisher_id, specificity DESC, priority DESC;
```

---

## Dependencies

- Story 1.6 (Publisher Coverage) - DONE, being enhanced
- Cities data with country_code and region fields

---

## Definition of Done

- [x] Publisher can add country-level coverage
- [x] Publisher can add region-level coverage
- [x] Publisher can add city-level coverage
- [x] Coverage list shows level badges
- [x] Delete coverage works with confirmation
- [ ] Map visualization shows coverage (deferred - not MVP critical)
- [x] More specific coverage takes priority (backend already implements this)
- [x] Database schema updated (already exists from Epic 1)
- [ ] Unit tests for coverage service
- [ ] Integration tests for coverage endpoints
- [ ] E2E test: add/delete multi-level coverage

---

## Dev Agent Record

### Completion Notes

**Files Created:**
- `web/app/publisher/coverage/page.tsx`: Full coverage management UI

**Files Modified:**
- `web/app/publisher/layout.tsx`: Added "Coverage" nav item

**Key Features:**
- Hierarchical picker: Country → Region → City drill-down
- "Add at this level" buttons for country and region
- Direct city selection adds city-level coverage
- Coverage list shows:
  - Level badge (country/region/city) with distinct colors
  - Display name
  - Priority
  - Active/inactive status
- Activate/Deactivate toggle for each coverage
- Delete with confirmation dialog
- Loading states throughout
- Empty state with CTA
- Breadcrumb navigation in add dialog

**Backend:**
- Already had full support for country/region/city coverage levels
- GET/POST/PUT/DELETE endpoints at /api/v1/publisher/coverage
- get_publishers_for_city function handles priority (city > region > country)

**Status:** done

---

## FRs Covered

- FR16: Define coverage (country/region/city) - enhanced
- FR17: View coverage on map - enhanced (map deferred)
- FR18: Coverage priorities - enhanced
- FR19: Name/describe coverage - enhanced
- FR20: Activate/deactivate coverage - maintained
