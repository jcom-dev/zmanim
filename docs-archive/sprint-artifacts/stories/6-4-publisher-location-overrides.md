# Story 6.4: Publisher Location Overrides

**Epic:** Epic 6 - Code Cleanup, Consolidation & Publisher Data Overrides
**Status:** ready-for-dev
**Priority:** P1
**Story Points:** 10
**Dependencies:** 6.1 (Type definitions)

---

## Story

As a **publisher**,
I want **to override city coordinates, elevation, and timezone for my users only**,
So that **my zmanim calculations use accurate location data specific to my community's needs**.

---

## Background

Sometimes city data in the global database is incorrect or imprecise for a specific community:
- Coordinates may point to city center instead of synagogue
- Elevation may be averaged instead of specific location
- Timezone may not reflect local observance practices

**Solution: Publisher-Specific Overrides**

Publishers can override location data for any city in their coverage area. Overrides:
- Apply ONLY to that publisher's users
- Do NOT affect other publishers or global data
- Can be reverted at any time
- Are used automatically in zmanim calculations

**Example:**
```
City: New York, NY (Global data: lat 40.7128, lon -74.0060, elevation 10m)
Publisher: "OU"
Override: lat 40.7589, lon -73.9851, elevation 33m (One World Trade Center)

Result:
- OU users see calculations based on override data
- Other publishers see calculations based on global data
```

---

## Acceptance Criteria

### AC-6.4.1: Create Database Schema
- [ ] Create migration `00000000000026_publisher_location_overrides.sql`
- [ ] Create table `publisher_location_overrides` with fields:
  - id (UUID, primary key)
  - publisher_id (UUID, foreign key)
  - city_id (BIGINT, foreign key to geo_cities)
  - override_latitude (nullable)
  - override_longitude (nullable)
  - override_elevation (nullable)
  - override_timezone (nullable)
  - reason (TEXT)
  - created_at, updated_at
- [ ] Add unique constraint (publisher_id, city_id)
- [ ] Add indexes on publisher_id and city_id

### AC-6.4.2: Create SQLc Queries
- [ ] Create `api/internal/db/queries/location_overrides.sql`
- [ ] Add query: `CreateLocationOverride`
- [ ] Add query: `GetPublisherLocationOverrides`
- [ ] Add query: `GetLocationOverrideForCalculation` (specific city)
- [ ] Add query: `UpdateLocationOverride`
- [ ] Add query: `DeleteLocationOverride`
- [ ] Run `sqlc generate`

### AC-6.4.3: Create Publisher API Endpoints
- [ ] Create handler `api/internal/handlers/location_overrides.go`
- [ ] Implement `POST /api/v1/publisher/locations/{cityId}/override`
- [ ] Implement `GET /api/v1/publisher/location-overrides`
- [ ] Implement `PUT /api/v1/publisher/location-overrides/{id}`
- [ ] Implement `DELETE /api/v1/publisher/location-overrides/{id}`
- [ ] Add routes to router in `api/cmd/api/main.go`

### AC-6.4.4: Integrate with Calculation Service
- [ ] Update `api/internal/services/calculation_service.go`
- [ ] Before calculation, check for location override
- [ ] If override exists, use override values instead of city data
- [ ] Log override usage in debug mode

### AC-6.4.5: Create Publisher UI Component
- [ ] Create `web/components/publisher/LocationOverrideDialog.tsx`
- [ ] Dialog shows: current data (read-only) + override fields (editable)
- [ ] Fields: latitude, longitude, elevation, timezone, reason
- [ ] Validate: lat (-90 to 90), lon (-180 to 180), elevation (integer)
- [ ] Show "Preview on Map" button
- [ ] Handle save, update, delete actions

### AC-6.4.6: Integrate with Coverage Page
- [ ] Update `web/app/publisher/coverage/page.tsx`
- [ ] Add "Override Location Data" button to city detail view
- [ ] Open LocationOverrideDialog on button click
- [ ] Show "⚙️ Overridden" badge on cities with overrides
- [ ] Refresh coverage list after save/delete

### AC-6.4.7: Inline Location Map View Component
- [ ] Create `web/components/shared/LocationMapView.tsx`
- [ ] Use `react-map-gl/maplibre` (same as deleted CoverageMapViewGL)
- [ ] Accept props: `location` (type, id, name, coordinates, boundaries)
- [ ] **Display only** - no click-to-select interactions

#### Map Controls & Navigation:
- [ ] Add `NavigationControl` with + / - zoom buttons (position="top-right", showCompass={false})
- [ ] Add `GeolocateControl` for user location (position="top-right")
- [ ] Enable **drag to pan** the map
- [ ] Enable **scroll wheel zoom**
- [ ] Enable **pinch zoom** on touch devices
- [ ] No click-to-select - purely for exploration/viewing

#### For Non-City Locations (Continent/Country/Region/District):
- [ ] Render map fitting the boundary polygon
- [ ] Draw boundary with clear outline (dashed or colored border)
- [ ] Display location name as overlay
- [ ] Informational display only

#### For City Locations ONLY:
- [ ] Render map centered on city coordinates
- [ ] **Street-level zoom** (~15-16 zoom level)
- [ ] Show styled dot marker at city center
- [ ] **Hover tooltip** on marker shows: lat/long, elevation, timezone

### AC-6.4.8: Integrate Map View with Coverage Page
- [ ] Update `web/app/publisher/coverage/page.tsx`
- [ ] Click coverage list item → Show corresponding map view
- [ ] **Action buttons below/beside map** (not on map):
  - "Override for My Publisher" → Opens LocationOverrideDialog (city only)
  - "Request Public Correction" → Opens CorrectionRequestDialog (city only)
- [ ] Map appears inline or in expandable panel

### AC-6.4.9: Test End-to-End
- [ ] Publisher creates override
- [ ] Override appears in list with badge
- [ ] Zmanim calculation uses override data
- [ ] Publisher updates override
- [ ] Publisher deletes override
- [ ] Calculation reverts to global data
- [ ] Map view displays correctly for all location types
- [ ] City hover shows lat/long, elevation, timezone

---

## Tasks / Subtasks

- [ ] Task 1: Database Schema (AC: 6.4.1)
  - [ ] 1.1 Create migration file
  - [ ] 1.2 Define table schema
  - [ ] 1.3 Add constraints and indexes
  - [ ] 1.4 Run migration
  - [ ] 1.5 Verify schema in database

- [ ] Task 2: SQLc Queries (AC: 6.4.2)
  - [ ] 2.1 Create `location_overrides.sql`
  - [ ] 2.2 Write CreateLocationOverride query
  - [ ] 2.3 Write GetPublisherLocationOverrides query
  - [ ] 2.4 Write GetLocationOverrideForCalculation query
  - [ ] 2.5 Write UpdateLocationOverride query
  - [ ] 2.6 Write DeleteLocationOverride query
  - [ ] 2.7 Run `sqlc generate`
  - [ ] 2.8 Verify generated code

- [ ] Task 3: Backend API (AC: 6.4.3)
  - [ ] 3.1 Create handler file
  - [ ] 3.2 Implement CreateOverride handler (6-step pattern)
  - [ ] 3.3 Implement GetOverrides handler
  - [ ] 3.4 Implement UpdateOverride handler
  - [ ] 3.5 Implement DeleteOverride handler
  - [ ] 3.6 Add routes to router
  - [ ] 3.7 Test endpoints with curl

- [ ] Task 4: Calculation Integration (AC: 6.4.4)
  - [ ] 4.1 Update calculation service
  - [ ] 4.2 Add override lookup before calculation
  - [ ] 4.3 Apply override values if exists
  - [ ] 4.4 Add logging for override usage
  - [ ] 4.5 Test calculation with override

- [ ] Task 5: Frontend Component (AC: 6.4.5)
  - [ ] 5.1 Create LocationOverrideDialog.tsx
  - [ ] 5.2 Show current data (read-only)
  - [ ] 5.3 Add override input fields
  - [ ] 5.4 Add validation logic
  - [ ] 5.5 Add map preview (optional)
  - [ ] 5.6 Handle save action
  - [ ] 5.7 Handle delete action
  - [ ] 5.8 Add error handling

- [ ] Task 6: Coverage Page Integration (AC: 6.4.6)
  - [ ] 6.1 Update coverage page
  - [ ] 6.2 Add "Override" button to city view
  - [ ] 6.3 Open dialog on button click
  - [ ] 6.4 Show badge for overridden cities
  - [ ] 6.5 Refresh list after save/delete

- [ ] Task 7: Location Map View Component (AC: 6.4.7)
  - [ ] 7.1 Create `web/components/shared/LocationMapView.tsx`
  - [ ] 7.2 Set up react-map-gl/maplibre with NavigationControl and GeolocateControl
  - [ ] 7.3 Implement boundary rendering for non-city locations
  - [ ] 7.4 Implement city marker with street-level zoom
  - [ ] 7.5 Add hover tooltip (lat/long, elevation, timezone)
  - [ ] 7.6 Enable drag/pan, scroll zoom, pinch zoom
  - [ ] 7.7 Style with Tailwind design tokens

- [ ] Task 8: Coverage Page Map Integration (AC: 6.4.8)
  - [ ] 8.1 Add click handler for coverage list items
  - [ ] 8.2 Render LocationMapView on selection
  - [ ] 8.3 Add "Override for My Publisher" button (city only)
  - [ ] 8.4 Add "Request Public Correction" button (city only)
  - [ ] 8.5 Connect buttons to respective dialogs

- [ ] Task 9: End-to-End Testing (AC: 6.4.9)
  - [ ] 9.1 Test create override
  - [ ] 9.2 Test calculation uses override
  - [ ] 9.3 Test update override
  - [ ] 9.4 Test delete override
  - [ ] 9.5 Test calculation reverts to global
  - [ ] 9.6 Test map view for all location types
  - [ ] 9.7 Test city hover tooltip

---

## Dev Notes

### Database Schema

**File:** `db/migrations/00000000000026_publisher_location_overrides.sql`

```sql
CREATE TABLE publisher_location_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  city_id BIGINT NOT NULL REFERENCES geo_cities(id) ON DELETE CASCADE,

  -- Overrides (NULL = use original)
  override_latitude DOUBLE PRECISION,
  override_longitude DOUBLE PRECISION,
  override_elevation INTEGER,
  override_timezone TEXT,

  -- Metadata
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(publisher_id, city_id)
);

CREATE INDEX idx_publisher_overrides_publisher ON publisher_location_overrides(publisher_id);
CREATE INDEX idx_publisher_overrides_city ON publisher_location_overrides(city_id);

COMMENT ON TABLE publisher_location_overrides IS 'Publisher-specific location data overrides';
COMMENT ON COLUMN publisher_location_overrides.override_latitude IS 'Override latitude in decimal degrees';
COMMENT ON COLUMN publisher_location_overrides.override_longitude IS 'Override longitude in decimal degrees';
COMMENT ON COLUMN publisher_location_overrides.override_elevation IS 'Override elevation in meters';
COMMENT ON COLUMN publisher_location_overrides.override_timezone IS 'Override IANA timezone';
```

### SQLc Query Examples

**File:** `api/internal/db/queries/location_overrides.sql`

```sql
-- name: CreateLocationOverride :one
INSERT INTO publisher_location_overrides (
  publisher_id, city_id,
  override_latitude, override_longitude,
  override_elevation, override_timezone,
  reason
) VALUES (
  $1, $2, $3, $4, $5, $6, $7
) RETURNING *;

-- name: GetLocationOverrideForCalculation :one
SELECT
  override_latitude, override_longitude,
  override_elevation, override_timezone
FROM publisher_location_overrides
WHERE publisher_id = $1 AND city_id = $2;

-- name: GetPublisherLocationOverrides :many
SELECT
  plo.*,
  c.name AS city_name,
  c.country AS country_name
FROM publisher_location_overrides plo
JOIN geo_cities c ON plo.city_id = c.id
WHERE plo.publisher_id = $1
ORDER BY plo.updated_at DESC;
```

### Calculation Service Integration

**File:** `api/internal/services/calculation_service.go`

```go
// Before calculation, check for override
override, err := s.db.Queries.GetLocationOverrideForCalculation(ctx, sqlcgen.GetLocationOverrideForCalculationParams{
    PublisherID: publisherID,
    CityID:      cityID,
})

var lat, lon float64
var elevation int
var timezone string

if err == nil && override.OverrideLatitude != nil {
    // Use override data
    lat = *override.OverrideLatitude
    lon = *override.OverrideLongitude
    elevation = *override.OverrideElevation
    timezone = *override.OverrideTimezone

    slog.Debug("Using location override",
        "publisher_id", publisherID,
        "city_id", cityID,
        "override_lat", lat,
        "override_lon", lon)
} else {
    // Use global city data
    lat = city.Latitude
    lon = city.Longitude
    elevation = city.Elevation
    timezone = city.Timezone
}

// Continue with calculation using override/global data
```

### Frontend Component

**File:** `web/components/publisher/LocationOverrideDialog.tsx`

```tsx
interface LocationOverrideDialogProps {
  city: City;
  existingOverride?: LocationOverride;
  onSave: (override: LocationOverrideInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

export function LocationOverrideDialog({ city, existingOverride, onSave, onDelete, onClose }: LocationOverrideDialogProps) {
  const [latitude, setLatitude] = useState(existingOverride?.override_latitude ?? city.latitude);
  const [longitude, setLongitude] = useState(existingOverride?.override_longitude ?? city.longitude);
  const [elevation, setElevation] = useState(existingOverride?.override_elevation ?? city.elevation);
  const [timezone, setTimezone] = useState(existingOverride?.override_timezone ?? city.timezone);
  const [reason, setReason] = useState(existingOverride?.reason ?? '');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override Location Data</DialogTitle>
          <DialogDescription>
            City: {city.name}, {city.country}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-gray-50 p-3">
            <h4 className="font-medium text-sm mb-2">Global Data (Read-Only)</h4>
            <div className="text-xs space-y-1">
              <div>Latitude: {city.latitude}</div>
              <div>Longitude: {city.longitude}</div>
              <div>Elevation: {city.elevation}m</div>
              <div>Timezone: {city.timezone}</div>
            </div>
          </div>

          <div>
            <Label>Override Latitude (-90 to 90)</Label>
            <Input
              type="number"
              step="0.0001"
              value={latitude}
              onChange={(e) => setLatitude(parseFloat(e.target.value))}
              min={-90}
              max={90}
            />
          </div>

          <div>
            <Label>Override Longitude (-180 to 180)</Label>
            <Input
              type="number"
              step="0.0001"
              value={longitude}
              onChange={(e) => setLongitude(parseFloat(e.target.value))}
              min={-180}
              max={180}
            />
          </div>

          <div>
            <Label>Override Elevation (meters)</Label>
            <Input
              type="number"
              value={elevation}
              onChange={(e) => setElevation(parseInt(e.target.value))}
            />
          </div>

          <div>
            <Label>Override Timezone</Label>
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/New_York"
            />
          </div>

          <div>
            <Label>Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Using One World Trade Center location"
            />
          </div>
        </div>

        <DialogFooter>
          {existingOverride && onDelete && (
            <Button variant="destructive" onClick={onDelete}>
              Delete Override
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave({ latitude, longitude, elevation, timezone, reason })}>
            Save Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Location Map View Reference (from deleted CoverageMapViewGL.tsx)

**File:** `web/components/shared/LocationMapView.tsx`

```tsx
import MapGL, {
  NavigationControl,
  GeolocateControl,
  Source,
  Layer,
  MapRef,
  Marker,
  Popup,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

// Map style URLs
const MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

// Inside component:
<MapGL
  initialViewState={{
    longitude: location.longitude,
    latitude: location.latitude,
    zoom: location.type === 'city' ? 15 : 6,
  }}
  style={{ width: '100%', height: '400px' }}
  mapStyle={isDark ? MAP_STYLES.dark : MAP_STYLES.light}
  attributionControl={false}
  // Display only - no click interactions
  cursor="grab"
>
  <NavigationControl position="top-right" showCompass={false} />
  <GeolocateControl
    position="top-right"
    trackUserLocation={false}
    showUserLocation={true}
    showAccuracyCircle={false}
    fitBoundsOptions={{ maxZoom: 10 }}
  />

  {/* For city: show marker with hover popup */}
  {location.type === 'city' && (
    <>
      <Marker longitude={location.longitude} latitude={location.latitude}>
        <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
      </Marker>
      {/* Popup on hover showing lat/long, elevation, timezone */}
    </>
  )}

  {/* For non-city: show boundary polygon */}
  {location.type !== 'city' && location.boundary && (
    <Source type="geojson" data={location.boundary}>
      <Layer
        type="fill"
        paint={{ 'fill-color': '#3b82f6', 'fill-opacity': 0.2 }}
      />
      <Layer
        type="line"
        paint={{ 'line-color': '#3b82f6', 'line-width': 2, 'line-dasharray': [2, 2] }}
      />
    </Source>
  )}
</MapGL>
```

### Coding Standards (MUST FOLLOW)

**CRITICAL:** All implementation MUST strictly follow [docs/coding-standards.md](../../coding-standards.md).

**Backend:**
- Follow 6-step handler pattern
- Use PublisherResolver
- Use SQLc for all queries
- Use `slog` for logging

**Frontend:**
- Use `useApi` hook
- Use Tailwind design tokens
- Validate inputs before submission

### References

- [web/types/geography.ts](../../../../web/types/geography.ts) - Type definitions
- [web/app/publisher/coverage/page.tsx](../../../../web/app/publisher/coverage/page.tsx)
- [api/internal/services/calculation_service.go](../../../../api/internal/services/calculation_service.go)
- [docs/coding-standards.md](../../coding-standards.md)

---

## Testing Requirements

### Unit Tests
- [ ] Override validation logic
- [ ] Calculation service override lookup

### Integration Tests
- [ ] Create override endpoint
- [ ] Get overrides endpoint
- [ ] Update override endpoint
- [ ] Delete override endpoint
- [ ] Calculation uses override data

### E2E Tests
- [ ] Publisher creates override via UI
- [ ] Override badge appears in coverage list
- [ ] Zmanim calculation uses override
- [ ] Publisher deletes override
- [ ] Calculation reverts to global data

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/6-4-publisher-location-overrides-context.xml (generated 2025-12-08)

### Agent Model Used
TBD (to be filled during implementation)

### Completion Notes
TBD (to be filled during implementation)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-08 | Story created from Epic 6 | Bob (Scrum Master) |
