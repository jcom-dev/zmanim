# Plan: Interactive Map View for Publisher Coverage Selection

**Status:** In Progress (Phase 3 - Region Selection Enhancement)
**Author:** Claude
**Date:** 2025-12-04
**Updated:** 2025-12-04

### Recent Changes (Phase 2 Complete)
- Installed `maplibre-gl@^4.7.1` and `react-map-gl@^7.1.9`
- Installed `topojson-client` for TopoJSON to GeoJSON conversion
- Created `CoverageMapViewGL` component with WebGL rendering
- Used **OpenFreeMap tiles** (CORS-friendly, no API key required)
- Loaded TopoJSON from `/geo/world-countries-110m.json` as GeoJSON overlay for clickable countries
- Added ISO numeric to ISO alpha-2 country code mapping
- Implemented dynamic fill/stroke colors based on selection state
- Integrated fly-to animation for city search results
- Updated `CoverageMapDialog` to use new MapLibre GL component
- Theme support (dark/light) with OpenFreeMap liberty/dark styles

---

## Overview

Add an interactive world map interface for publishers to visually select and manage geographic coverage areas. The map will allow intuitive region selection with zoom capability down to small regions (states/provinces), city search with map centering, and visual representation of existing coverage.

## Goals

1. **Visual Geographic Selection** - Publishers can see and select regions on a world map
2. **Drill-Down to Small Regions** - Zoom from world → country → state/province level
3. **Search + Map Integration** - Search for a city, map centers there, then expand selection to region
4. **Multi-Select Regions** - Easy selection of multiple regions with visual feedback
5. **Non-Technical UX** - Intuitive for users unfamiliar with geographic hierarchies
6. **Reusable Component** - Works in coverage page, onboarding wizard, and add/delete flows
7. **No API Key Required** - Use open-source mapping solution with free tiles
8. **Premium Cartographic Aesthetic** - Maintain the elegant dark/light theme styling

---

## Library Research & Recommendation

### Options Evaluated

| Library | Type | Bundle Size | API Key | Drill-Down | Best For |
|---------|------|-------------|---------|------------|----------|
| **react-simple-maps** | SVG | ~15KB | None | Country only | Choropleth, simple selection |
| **react-leaflet** | Tile + GeoJSON | ~42KB | None (OSM) | Full (raster) | Standard mapping |
| **MapLibre GL** | WebGL Vector | ~200KB | None | Full (vector) | High-perf, smooth zoom |
| **deck.gl** | WebGL | ~400KB | Requires base | Full | Massive datasets |

### Recommendation: **MapLibre GL JS** with **react-map-gl**

**Why MapLibre GL for this use case:**

1. **Full drill-down capability** - Smooth zoom from world to state/province level without loading extra GeoJSON
2. **Vector tiles** - Smaller, more efficient than raster, with dynamic styling
3. **Fully open-source** (BSD-3 license) - No proprietary restrictions (forked from Mapbox GL before license change)
4. **Growing ecosystem** - 713K weekly npm downloads, actively maintained, v5 released recently
5. **Free tile providers** - OpenFreeMap and MapLibre Demo Tiles require NO API key
6. **Premium visual quality** - WebGL rendering enables smooth animations and polished aesthetics
7. **Custom styling** - Can apply our cartographic elegance theme to vector tiles

**Why NOT react-simple-maps (current implementation):**
- Limited to country-level only without loading many GeoJSON files
- Cannot zoom to see state/province boundaries dynamically
- No tile-based drill-down capability

### Phase 1 Implementation (Completed)

Initial implementation with `react-simple-maps` for country-level selection:
- ✅ Basic map with country selection
- ✅ Theme-aware colors (dark/light)
- ✅ Zoom controls and reset
- ✅ City search for navigation
- ✅ Selection summary panel
- ✅ Integration with coverage page

### Phase 2 Implementation (Next)

Upgrade to `MapLibre GL JS` for region-level drill-down:
- Replace react-simple-maps with react-map-gl + maplibre-gl
- Use OpenFreeMap tiles (free, no API key)
- Add state/province level selection
- Preserve existing color scheme and UX

### Free Tile Providers (No API Key Required)

```javascript
// OpenFreeMap (recommended - completely free)
'https://tiles.openfreemap.org/styles/liberty'

// MapLibre Demo Tiles (free, hosted on GitHub Pages)
'https://demotiles.maplibre.org/style.json'

// CartoDB Dark Matter (free tier)
'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
```

### NPM Popularity (2024-2025)

| Library | Weekly Downloads | GitHub Stars | Trend |
|---------|------------------|--------------|-------|
| Leaflet | 1.59M | 43,369 | Stable |
| Mapbox GL | 1.54M | 11,792 | Proprietary since v2 |
| **MapLibre GL** | 713K | 8,041 | **Growing rapidly** |
| react-map-gl | 340K | 7,177 | Mature React wrapper |

Sources:
- [NPM Trends](https://npmtrends.com/leaflet-vs-mapbox-gl-vs-maplibre-gl-vs-react-map-gl)
- [OpenFreeMap](https://openfreemap.org/quick_start/)
- [MapLibre GL JS Docs](https://maplibre.org/maplibre-gl-js/docs/)

---

## Design Direction

### Aesthetic: **Cartographic Elegance**

A refined, editorial map experience inspired by premium atlas designs:

- **Dark base map** with subtle topographic contours and muted country borders
- **Glowing selection highlights** - selected regions pulse with a soft amber/gold glow
- **Smooth zoom animations** with easing curves
- **Floating info panels** that slide in when regions are selected
- **Custom markers** for cities with subtle drop shadows
- **Coverage "heatmap" overlay** showing existing coverage intensity

### Color Palette (Light/Dark Theme Support)

```css
/* Dark Theme */
--map-bg-dark: #1a1d23          /* Deep charcoal base */
--map-land-dark: #2a2f3a        /* Subtle land mass */
--map-borders-dark: #3d4452     /* Country borders */
--map-water-dark: #0f1115       /* Ocean/water */

/* Light Theme */
--map-bg-light: #f8fafc         /* Soft white base */
--map-land-light: #e2e8f0       /* Light gray land mass */
--map-borders-light: #cbd5e1    /* Subtle borders */
--map-water-light: #dbeafe      /* Light blue water */

/* Shared (both themes) */
--coverage-existing: #f59e0b    /* Amber for existing coverage */
--coverage-existing-fill: rgba(245, 158, 11, 0.25)
--coverage-selected: #22c55e    /* Green for new selections */
--coverage-selected-fill: rgba(34, 197, 94, 0.3)
--coverage-hover: #3b82f6       /* Blue hover state */
--coverage-hover-fill: rgba(59, 130, 246, 0.2)
```

**Implementation:** Use `next-themes` (already in project) to detect theme and apply appropriate palette via CSS variables or conditional styling.

### Typography

- **Panel Headers:** Inter Bold (already in project via Tailwind defaults)
- **Region Labels:** Inter Medium, slightly tracking-wide
- **City Labels:** Inter Regular, muted until hovered

---

## Technical Approach

### Map Library: **MapLibre GL JS** with **react-map-gl**

**Why MapLibre GL:**
- Full drill-down to state/province level via vector tiles
- No API key required with OpenFreeMap
- WebGL rendering for smooth animations
- Custom styling support for our theme
- Active open-source development

**Tile Provider:** OpenFreeMap (free, no API key)

```javascript
// Map initialization
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

<Map
  mapLib={import('maplibre-gl')}
  mapStyle="https://tiles.openfreemap.org/styles/liberty"
  // ... other props
/>
```

### Drill-Down Levels

| Zoom Level | Shows | Selectable |
|------------|-------|------------|
| 1-3 | Continents, countries | Countries |
| 4-6 | Countries, large regions | Countries, states/provinces |
| 7-10 | States, cities visible | States/provinces, regions |
| 10+ | Cities, roads | View only (no selection at street level) |

**Note:** Selection stops at state/province level. No street-level selection needed.

---

## Component Architecture

```
web/components/shared/
├── CoverageMapView/
│   ├── index.tsx                    # Main export
│   ├── CoverageMapView.tsx          # Container with ComposableMap
│   ├── WorldMap.tsx                 # Country-level view
│   ├── CountryMap.tsx               # State/province drill-down
│   ├── RegionGeography.tsx          # Single region with selection state
│   ├── CoverageHighlight.tsx        # Existing coverage glow effect
│   ├── MapSearchPanel.tsx           # Floating search with results
│   ├── SelectionPanel.tsx           # Selected regions summary (bottom)
│   ├── MapControls.tsx              # Zoom/reset/view toggle
│   ├── MapTooltip.tsx               # Hover info tooltip
│   ├── hooks/
│   │   ├── useMapProjection.ts      # D3-geo projection state
│   │   ├── useRegionSelection.ts    # Multi-select state management
│   │   ├── useGeoData.ts            # Load/cache GeoJSON files
│   │   └── useCoverageMapping.ts    # Map coverage → region codes
│   ├── data/
│   │   └── region-mappings.ts       # Country/region code → name mappings
│   └── styles.module.css            # SVG animation styles
│
web/public/geo/
├── world-countries-110m.json        # Simplified world countries (~100KB)
├── world-countries-50m.json         # Medium detail countries (~300KB)
├── states/
│   ├── US.json                      # US states
│   ├── CA.json                      # Canadian provinces
│   ├── GB.json                      # UK regions
│   ├── AU.json                      # Australian states
│   └── IL.json                      # Israel districts
└── continents.json                  # Continent outlines
```

### Key Components

#### 1. `CoverageMapView` (Main Component)

```tsx
interface CoverageMapViewProps {
  /** Current coverage items (for display) */
  existingCoverage?: Coverage[];
  /** Selected items for adding */
  selectedItems: CoverageSelection[];
  /** Selection change callback */
  onChange: (items: CoverageSelection[]) => void;
  /** Mode: 'view' shows existing, 'edit' allows selection */
  mode: 'view' | 'edit';
  /** Optional: Initial map center */
  initialCenter?: [number, number];
  /** Optional: Initial zoom level */
  initialZoom?: number;
  /** Height of map container */
  height?: string;
}
```

#### 2. `SearchPanel` (Floating Search)

- Search input with autocomplete
- Results show city + region context
- Click result → map flies to location
- "Add Region" button appears for the encompassing region
- "Add City Only" for specific city selection

#### 3. `RegionLayer` (Interactive Regions)

- Renders country/state polygons from GeoJSON
- Click to select/deselect
- Hover shows region info tooltip
- Multi-select with visual feedback
- Shift+click for range selection on map

#### 4. `SelectionPanel` (Bottom Drawer)

- Slides up when items selected
- Shows count of cities in selection
- "Add Selected Regions" button
- List of selected items with remove option
- Collapsible for more map space

---

## User Flows

### Flow 1: New Publisher (Onboarding)

1. Map opens at world view (zoom level 2)
2. Prompt: "Where do your zmanim calculations apply?"
3. User searches "Manchester, UK"
4. Map flies to Manchester, highlights Greater Manchester region
5. Popup: "Add Greater Manchester (23 cities)?" or "Add all of England?" or "Add just Manchester?"
6. User selects, region turns green
7. Can continue adding more regions
8. Selection panel shows: "3 regions selected (847 cities)"

### Flow 2: Existing Publisher (View Coverage)

1. Map opens centered on bounding box of all coverage
2. All covered regions shown with amber glow
3. Clicking a region shows info panel with:
   - Region name
   - Cities covered
   - Priority level
   - "Remove" / "Edit Priority" actions
4. "Add More Coverage" button switches to edit mode

### Flow 3: Add Region to Existing Coverage

1. Opens in edit mode
2. Existing coverage shown semi-transparent
3. Search or click to add new regions
4. Clear distinction between existing (amber) and new (blue)
5. Confirm button adds new selections

---

## Map Interactions

### Gestures
- **Pan:** Drag to move
- **Zoom:** Scroll wheel, pinch, or buttons
- **Select:** Click region polygon
- **Multi-select:** Hold Shift + Click (or toggle mode)
- **Deselect:** Click selected region again

### Keyboard
- **Escape:** Clear current selection
- **Enter:** Confirm selection
- **+/-:** Zoom in/out
- **Arrow keys:** Pan map

### Touch (Mobile)
- **Tap:** Select region
- **Double-tap:** Zoom to region
- **Pinch:** Zoom
- **Long-press:** Show region info

---

## API Integration

### Existing Endpoints Used

```
GET /api/v1/continents          # List continents with city counts
GET /api/v1/countries           # List countries
GET /api/v1/regions?country=XX  # List regions in country
GET /api/v1/cities?search=X     # Search cities
GET /api/v1/publisher/coverage  # Get existing coverage
POST /api/v1/publisher/coverage # Add coverage
DELETE /api/v1/publisher/coverage/:id
```

### New Endpoint Needed

```
GET /api/v1/geo/region-bounds?level=country&code=US
Response: { bounds: [[lat1, lng1], [lat2, lng2]] }
```

This helps the map fly to the correct location when a region is selected from search.

---

## GeoJSON Data Strategy

### File Structure

```
web/public/geo/
├── continents.json       # 7 continent outlines (~50KB)
├── countries.json        # 250 country boundaries (~500KB simplified)
├── regions/
│   ├── US.json           # US states (~200KB)
│   ├── CA.json           # Canadian provinces
│   ├── GB.json           # UK regions
│   ├── AU.json           # Australian states
│   ├── IL.json           # Israel districts
│   └── ...               # Load on demand
```

### Loading Strategy

1. **Initial load:** Continents + countries (simplified, low-res)
2. **On zoom:** Load detailed country regions when zoomed to country level
3. **Cache:** Store in memory after first load
4. **Simplify:** Use mapshaper to reduce file sizes (target <2MB total initial)

---

## Visual States

### Region States

| State | Fill | Stroke | Effect |
|-------|------|--------|--------|
| Default | Transparent | `--map-borders` | None |
| Hover | `rgba(59, 130, 246, 0.2)` | Blue 2px | Subtle pulse |
| Selected (new) | `rgba(34, 197, 94, 0.3)` | Green 2px | Check icon |
| Existing coverage | `rgba(245, 158, 11, 0.25)` | Amber 2px | Soft glow |
| Existing + hover | `rgba(245, 158, 11, 0.4)` | Amber 3px | Info popup |

### Map Controls

- Custom styled zoom buttons (not default Leaflet)
- Floating search panel (top-left, glassy background)
- Selection summary panel (bottom, slides up)
- Layer toggle (show/hide existing coverage)

---

## Implementation Steps

### Phase 1: Core Map Setup (✅ COMPLETED)
1. ✅ Install `react-simple-maps`, `@react-spring/web`, `d3-geo` + types
2. ✅ Download TopoJSON world countries → `/web/public/geo/`
3. ✅ Create `CoverageMapView` component with country selection
4. ✅ Style with dark/light theme matching design palette
5. ✅ Add zoom controls and reset button
6. ✅ Implement hover tooltips and selection states
7. ✅ Create `CoverageMapDialog` with search and confirmation
8. ✅ Integrate with coverage page ("Open Map" button)

### Phase 2: MapLibre GL Upgrade (✅ COMPLETED)
9. ✅ Install `maplibre-gl` and `react-map-gl`
10. ✅ Create new `CoverageMapViewGL` component using MapLibre
11. ✅ Configure OpenFreeMap tiles (CORS-friendly, free, no API key)
12. ✅ Load TopoJSON as GeoJSON overlay for clickable country polygons
13. ✅ Add ISO numeric → alpha-2 country code mapping
14. ✅ Apply dynamic fill/stroke colors (existing=amber, selected=green, hover=blue)
15. ✅ Implement smooth zoom with WebGL rendering
16. ✅ Add click-to-select for countries with toggle behavior
17. ✅ Preserve existing selection state management (MapSelection interface)
18. ✅ Theme support (dark/light) via OpenFreeMap styles
19. ✅ Premium tooltip with hover info display
20. ✅ Legend showing existing vs new selection colors

### Phase 3: Region Selection Enhancement
17. Detect zoom level and enable appropriate selection granularity
18. Add state/province selection at zoom 4-10
19. Match region names to database region codes
20. Show region info on hover (name, country, city count)
21. Implement selection constraints (max zoom for selection = 10)

### Phase 4: Search + Fly-To
22. Enhance city search to fly to location
23. Add "Add this region" quick action after search
24. Implement auto-fit to existing coverage on dialog open
25. Add "Fit to Selection" button

### Phase 5: Polish & Testing
26. Performance optimization (lazy load MapLibre)
27. Mobile touch support (tap to select, pinch to zoom)
28. Keyboard navigation (arrows, +/-, escape)
29. E2E tests for map interactions
30. Cross-browser testing (Safari WebGL)

---

## Dependencies

### Phase 1 (Completed - Country Level)

```json
{
  "dependencies": {
    "react-simple-maps": "^3.0.0",
    "@react-spring/web": "^9.7.3",
    "d3-geo": "^3.1.0"
  },
  "devDependencies": {
    "@types/d3-geo": "^3.1.0"
  }
}
```

**Bundle impact:** ~25KB gzipped

### Phase 2 (Completed - MapLibre GL)

```json
{
  "dependencies": {
    "maplibre-gl": "^4.7.1",
    "react-map-gl": "^7.1.9",
    "topojson-client": "^3.1.0"
  },
  "devDependencies": {
    "@types/topojson-client": "^3.1.5",
    "@types/topojson-specification": "^1.0.5"
  }
}
```

**Bundle impact:** ~200KB gzipped (includes WebGL renderer)

**Note:** Both `react-simple-maps` (Phase 1) and `react-map-gl` (Phase 2) are available. The dialog uses the MapLibre GL version for WebGL rendering.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| GeoJSON files too large | Use mapshaper simplification, lazy loading |
| Tile provider rate limits | Use multiple fallback providers |
| Complex region boundaries | Simplify to admin-level-1 (states/provinces) |
| Mobile performance | Reduce polygon detail on touch devices |
| SSR issues with Leaflet | Dynamic import with `next/dynamic` |

---

## Success Metrics

1. **Usability:** Publisher can add coverage in <30 seconds
2. **Performance:** Map loads in <2 seconds on 3G
3. **Engagement:** 80%+ of publishers use map view over list view
4. **Accuracy:** Region selections map correctly to database coverage

---

## Out of Scope

- Drawing custom coverage polygons
- Street-level selection (view only at high zoom)
- Offline map support
- Coverage overlap detection
- Real-time collaboration
- City-level pin selection (use list view for individual cities)

---

## Mockup Sketch

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Search cities or regions...          [View: Map | List] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│     ┌─────────────────────────────────────────────┐        │
│     │           ╭──────────────────╮              │        │
│     │          ╱                    ╲             │  [+]   │
│     │         │    ▓▓▓▓             │            │  [-]   │
│     │         │  ▓▓▓▓▓▓▓▓  ████     │            │        │
│     │          ╲  ▓▓▓▓▓  ████████  ╱             │        │
│     │           ╰────────────────╯               │        │
│     │                                            │        │
│     │    ▓ = existing coverage (amber glow)      │        │
│     │    █ = new selection (green)               │        │
│     └─────────────────────────────────────────────┘        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ✓ 3 regions selected                      [Clear] [Add →] │
│  ┌──────┐ ┌──────────┐ ┌─────────┐                         │
│  │ UK   │ │ New York │ │ Israel  │                         │
│  │ ×    │ │ ×        │ │ ×       │                         │
│  └──────┘ └──────────┘ └─────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Code Example: Map Dialog with Theme Support

```tsx
'use client';

import { useState, useCallback, memo } from 'react';
import { useTheme } from 'next-themes';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Map, X, Check } from 'lucide-react';

const geoUrl = '/geo/world-countries-110m.json';

// Theme-aware color config
const getThemeColors = (isDark: boolean) => ({
  bg: isDark ? '#1a1d23' : '#f8fafc',
  land: isDark ? '#2a2f3a' : '#e2e8f0',
  borders: isDark ? '#3d4452' : '#cbd5e1',
  water: isDark ? '#0f1115' : '#dbeafe',
});

interface CoverageMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCoverage: string[];
  onConfirm: (selectedCodes: string[]) => void;
}

export function CoverageMapDialog({
  open,
  onOpenChange,
  existingCoverage,
  onConfirm,
}: CoverageMapDialogProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const colors = getThemeColors(isDark);

  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  const handleClick = useCallback((geo: any) => {
    const code = geo.properties.ISO_A2;
    setSelectedRegions(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  }, []);

  const getRegionStyle = (geo: any) => {
    const code = geo.properties.ISO_A2;
    const isExisting = existingCoverage.includes(code);
    const isSelected = selectedRegions.includes(code);

    return {
      default: {
        fill: isExisting ? 'rgba(245, 158, 11, 0.25)'
            : isSelected ? 'rgba(34, 197, 94, 0.3)'
            : colors.land,
        stroke: isExisting ? '#f59e0b'
              : isSelected ? '#22c55e'
              : colors.borders,
        strokeWidth: isSelected || isExisting ? 1.5 : 0.5,
        outline: 'none',
        transition: 'all 0.2s ease',
      },
      hover: {
        fill: 'rgba(59, 130, 246, 0.2)',
        stroke: '#3b82f6',
        strokeWidth: 2,
        cursor: 'pointer',
      },
      pressed: {
        fill: 'rgba(34, 197, 94, 0.4)',
      },
    };
  };

  const handleConfirm = () => {
    onConfirm(selectedRegions);
    setSelectedRegions([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Map className="w-5 h-5" />
            Select Coverage Regions
          </DialogTitle>
        </DialogHeader>

        <div
          className="flex-1 relative overflow-hidden"
          style={{ backgroundColor: colors.bg }}
        >
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 140 }}
            style={{ width: '100%', height: '100%' }}
          >
            <ZoomableGroup center={[0, 20]} zoom={1}>
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={() => handleClick(geo)}
                      onMouseEnter={() => setHoveredRegion(geo.properties.ISO_A2)}
                      onMouseLeave={() => setHoveredRegion(null)}
                      style={getRegionStyle(geo)}
                    />
                  ))
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>

          {/* Hover tooltip */}
          {hoveredRegion && (
            <div className="absolute top-4 left-4 px-3 py-2 bg-card border rounded-lg shadow-lg text-sm">
              {hoveredRegion}
            </div>
          )}
        </div>

        {/* Selection summary footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedRegions.length > 0
              ? `${selectedRegions.length} region${selectedRegions.length > 1 ? 's' : ''} selected`
              : 'Click regions to select'}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedRegions.length === 0}
            >
              <Check className="w-4 h-4 mr-2" />
              Add Selected
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Usage in coverage page:
// <Button onClick={() => setMapOpen(true)}>
//   <Map className="w-4 h-4 mr-2" /> Open Map
// </Button>
// <CoverageMapDialog open={mapOpen} onOpenChange={setMapOpen} ... />
```

---

## Decisions (User Feedback)

1. **Map as toggle, not default** - Map opens as a popup/dialog when user clicks "Open Map" button. List view remains primary.
2. **No auto-suggest** - Don't auto-suggest regions based on publisher country.
3. **Select/deselect only** - Map is for selecting/deselecting regions. Priority editing stays in list view.
4. **Region-only for now** - Skip city pins initially. Keep it simple with clickable region polygons.
5. **Search to navigate** - Include city search to quickly pan/zoom map to a location.
6. **Auto-fit existing coverage** - When dialog opens, if publisher has existing coverage, auto-zoom to fit all covered regions in view.

---

## Enhanced Dialog Features

### City Search for Navigation

The map dialog includes a search input that:
1. Uses existing `/api/v1/cities?search=X` endpoint
2. Shows autocomplete dropdown with city results
3. On selection, map smoothly pans/zooms to that city's coordinates
4. Does NOT auto-select the region - just navigates there for user to decide

```tsx
// Search panel in dialog header
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input
    placeholder="Search city to navigate..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="pl-10 w-64"
  />
  {/* Dropdown results */}
  {searchResults.length > 0 && (
    <div className="absolute top-full mt-1 w-full bg-card border rounded-lg shadow-lg z-50">
      {searchResults.map(city => (
        <button
          key={city.id}
          onClick={() => flyToCity(city.latitude, city.longitude)}
          className="w-full px-3 py-2 text-left hover:bg-accent text-sm"
        >
          <div className="font-medium">{city.name}</div>
          <div className="text-xs text-muted-foreground">{city.country}</div>
        </button>
      ))}
    </div>
  )}
</div>
```

### Auto-Fit to Existing Coverage

When dialog opens with existing coverage:

```tsx
// Calculate bounding box from existing coverage
const calculateBounds = (coverageCodes: string[], geographies: any[]) => {
  const coveredGeos = geographies.filter(geo =>
    coverageCodes.includes(geo.properties.ISO_A2)
  );

  if (coveredGeos.length === 0) {
    return { center: [0, 20], zoom: 1 }; // World view default
  }

  // Use d3-geo to compute centroid and appropriate zoom
  const bounds = geoBounds(coveredGeos);
  const center = geoCentroid(coveredGeos);
  const zoom = calculateZoomFromBounds(bounds);

  return { center, zoom };
};

// On dialog open
useEffect(() => {
  if (open && existingCoverage.length > 0) {
    const { center, zoom } = calculateBounds(existingCoverage, geographies);
    setCenter(center);
    setZoom(zoom);
  }
}, [open, existingCoverage]);
```

### View Scenarios

| Scenario | Initial View |
|----------|--------------|
| No existing coverage | World view (zoom 1, center [0, 20]) |
| Single country (e.g., Israel) | Zoomed to fit Israel |
| Multiple countries (US + UK) | Zoomed to fit Atlantic view |
| Entire continent | Zoomed to fit continent |
| Global coverage | World view |

### Fly-To Animation

When user searches for a city or clicks "zoom to coverage":

```tsx
import { useSpring, animated } from '@react-spring/web';

const [mapState, setMapState] = useSpring(() => ({
  center: [0, 20],
  zoom: 1,
  config: { tension: 200, friction: 30 }
}));

const flyToCity = (lat: number, lng: number) => {
  setMapState({
    center: [lng, lat],
    zoom: 4, // City-level zoom
  });
};

const flyToCoverage = () => {
  const { center, zoom } = calculateBounds(existingCoverage, geographies);
  setMapState({ center, zoom });
};
```

---

## Updated Dialog Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🗺️ Select Coverage Regions          🔍 [Search city...]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│     ┌─────────────────────────────────────────────────┐        │
│     │                                                 │   [+]  │
│     │         ▓▓▓▓ (existing - amber)                │   [-]  │
│     │       ▓▓▓▓▓▓▓▓                                 │   [⟲]  │
│     │                    ████ (new selection - green) │        │
│     │                  ████████                       │        │
│     │                                                 │        │
│     └─────────────────────────────────────────────────┘        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Hovered: United Kingdom (1,200 cities)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  ✓ 2 new regions selected                    [Cancel] [Add →]  │
│  ┌────────┐ ┌────────┐                                         │
│  │ France │ │ Spain  │  + existing: UK, Israel                 │
│  │   ×    │ │   ×    │                                         │
│  └────────┘ └────────┘                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Controls (Right Side)
- **[+]** Zoom in
- **[-]** Zoom out
- **[⟲]** Reset to fit coverage (or world view if none)

### Footer Summary
- Shows NEW selections (not existing)
- Existing coverage listed separately as reference
- Clear visual distinction between what's being added vs what exists
