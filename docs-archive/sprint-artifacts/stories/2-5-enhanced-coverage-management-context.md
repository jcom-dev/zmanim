# Story Context: 2.5 Enhanced Coverage Management

**Generated:** 2025-11-26
**Story:** Enhanced Coverage Management
**Epic:** Epic 2 - Publisher User Management & Dashboard

---

## Relevant Documentation

### From PRD (docs/prd.md)

**Coverage Area Management Requirements:**
- FR16: Publishers can define geographic coverage areas using polygon boundaries
- FR17: Publishers can view coverage areas on an interactive map
- FR18: Publishers can set priority levels for overlapping coverage areas
- FR19: Publishers can name and describe each coverage area
- FR20: Publishers can activate/deactivate coverage areas

**Architecture Decision (ADR-002):**
> **City-Based Coverage Model:** Use city selection instead of polygon boundaries for geographic coverage. Polygon drawing adds significant UX and PostGIS complexity. Simpler MVP, may need polygon support for precise boundaries later.

### From Architecture (docs/architecture.md)

**Database Schema:**
```sql
-- Publisher coverage (many-to-many)
CREATE TABLE publisher_cities (
    publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE,
    city_id UUID REFERENCES cities(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 0,  -- Higher = preferred
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (publisher_id, city_id)
);
```

**Cities Table:**
```sql
CREATE TABLE cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    state TEXT,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    timezone TEXT NOT NULL,
    population INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### From Tech Spec (docs/sprint-artifacts/tech-spec-epic-2.md)

**Schema Modifications:**
```sql
ALTER TABLE publisher_cities ADD COLUMN coverage_level TEXT NOT NULL DEFAULT 'city';
-- Values: 'country', 'region', 'city'

ALTER TABLE publisher_cities ADD COLUMN geo_reference TEXT;
-- For country: country code (e.g., 'US')
-- For region: region identifier (e.g., 'US-NY')
-- For city: NULL (use existing city_id)

ALTER TABLE publisher_cities ADD COLUMN display_name TEXT;
```

---

## Existing Code References

### Backend - Coverage Handlers

**File:** `api/internal/handlers/coverage.go`

Existing endpoints (need to review current implementation):
- Coverage CRUD operations
- Publisher-city relationship management

### Backend - Cities Handlers

**File:** `api/internal/handlers/cities.go`

Existing endpoints:
- `GET /api/v1/countries` - List countries
- `GET /api/v1/regions` - List regions by country
- `GET /api/v1/cities` - List/search cities

### Frontend - Home Page Location Selection

**File:** `web/app/page.tsx`

Has existing location hierarchy pattern (lines 77-142):
```typescript
const loadCountries = async () => { ... }
const loadRegions = useCallback(async (countryCode: string) => { ... }
const loadCities = async (countryCode: string, regionName: string | null) => { ... }
```

This pattern can be adapted for the coverage picker.

### Frontend - Existing Coverage Page

**File:** `web/app/publisher/coverage/` (if exists, need to check)

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Story 1.6 (Publisher Coverage) | ✅ Done | Basic coverage implemented |
| Cities data seeded | ✅ Done | Countries, regions, cities exist |
| Story 2.2 (Publisher Switcher) | Required | For publisher context |

---

## Database Migration

**File to create:** `db/migrations/XXXXXX_add_coverage_hierarchy.sql`

```sql
-- Add coverage level tracking
ALTER TABLE publisher_cities
ADD COLUMN IF NOT EXISTS coverage_level TEXT NOT NULL DEFAULT 'city';

-- Add geo reference for non-city levels
ALTER TABLE publisher_cities
ADD COLUMN IF NOT EXISTS geo_reference TEXT;

-- Add display name for clarity
ALTER TABLE publisher_cities
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add is_active for toggling
ALTER TABLE publisher_cities
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Index for coverage queries
CREATE INDEX IF NOT EXISTS idx_publisher_cities_level
ON publisher_cities(coverage_level);

CREATE INDEX IF NOT EXISTS idx_publisher_cities_geo_ref
ON publisher_cities(geo_reference);

-- Comment for documentation
COMMENT ON COLUMN publisher_cities.coverage_level IS 'country, region, or city';
COMMENT ON COLUMN publisher_cities.geo_reference IS 'Country code (US), region code (US-NY), or NULL for city-level';
```

---

## Component Specifications

### CoverageManager Component

**File to create:** `web/components/publisher/CoverageManager.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CoverageList } from './CoverageList';
import { CoverageHierarchyPicker } from './CoverageHierarchyPicker';
import { CoverageMap } from './CoverageMap';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface CoverageArea {
  id: string;
  coverage_level: 'country' | 'region' | 'city';
  geo_reference: string | null;
  city_id: string | null;
  display_name: string;
  priority: number;
  is_active: boolean;
  city_count?: number;
}

export function CoverageManager() {
  const [isAddingCoverage, setIsAddingCoverage] = useState(false);
  const queryClient = useQueryClient();

  const { data: coverage, isLoading } = useQuery({
    queryKey: ['publisher', 'coverage'],
    queryFn: fetchPublisherCoverage,
  });

  const addMutation = useMutation({
    mutationFn: addCoverage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publisher', 'coverage'] });
      setIsAddingCoverage(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCoverage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publisher', 'coverage'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Coverage Areas</h1>
        <Dialog open={isAddingCoverage} onOpenChange={setIsAddingCoverage}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Coverage
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Coverage Area</DialogTitle>
            </DialogHeader>
            <CoverageHierarchyPicker
              onSelect={(level, geoRef, displayName) => {
                addMutation.mutate({ level, geo_reference: geoRef, display_name: displayName });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CoverageList
          coverage={coverage || []}
          onDelete={(id) => deleteMutation.mutate(id)}
          isLoading={isLoading}
        />
        <CoverageMap coverage={coverage || []} />
      </div>
    </div>
  );
}
```

### CoverageHierarchyPicker Component

**File to create:** `web/components/publisher/CoverageHierarchyPicker.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Globe, Building2, MapPin, Check } from 'lucide-react';

interface Props {
  onSelect: (level: string, geoReference: string, displayName: string) => void;
}

export function CoverageHierarchyPicker({ onSelect }: Props) {
  const [selectedCountry, setSelectedCountry] = useState<{ code: string; name: string } | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<{ name: string; type: string } | null>(null);

  const { data: countries } = useQuery({
    queryKey: ['countries'],
    queryFn: fetchCountries,
  });

  const { data: regions } = useQuery({
    queryKey: ['regions', selectedCountry?.code],
    queryFn: () => fetchRegions(selectedCountry!.code),
    enabled: !!selectedCountry,
  });

  const { data: cities } = useQuery({
    queryKey: ['cities', selectedCountry?.code, selectedRegion?.name],
    queryFn: () => fetchCities(selectedCountry!.code, selectedRegion?.name),
    enabled: !!selectedCountry,
  });

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={selectedCountry ? 'text-primary' : ''}>Country</span>
        <span>→</span>
        <span className={selectedRegion ? 'text-primary' : ''}>Region</span>
        <span>→</span>
        <span>City</span>
      </div>

      {/* Country Selection */}
      {!selectedCountry && (
        <div className="space-y-2">
          <h3 className="font-medium">Select Country</h3>
          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
            {countries?.map((country) => (
              <Button
                key={country.code}
                variant="outline"
                className="justify-start"
                onClick={() => setSelectedCountry(country)}
              >
                <Globe className="w-4 h-4 mr-2" />
                {country.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Country Selected - Options */}
      {selectedCountry && !selectedRegion && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Selected: <strong>{selectedCountry.name}</strong></span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedCountry(null)}>
              Change
            </Button>
          </div>

          <Button
            className="w-full"
            onClick={() => onSelect('country', selectedCountry.code, selectedCountry.name)}
          >
            <Check className="w-4 h-4 mr-2" />
            Add entire country ({selectedCountry.name})
          </Button>

          {regions && regions.length > 0 && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or select a region
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {regions.map((region) => (
                  <Button
                    key={region.name}
                    variant="outline"
                    className="justify-start"
                    onClick={() => setSelectedRegion(region)}
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    {region.name}
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Region Selected - Options */}
      {selectedCountry && selectedRegion && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>
              Selected: <strong>{selectedRegion.name}, {selectedCountry.name}</strong>
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedRegion(null)}>
              Change
            </Button>
          </div>

          <Button
            className="w-full"
            onClick={() => onSelect(
              'region',
              `${selectedCountry.code}-${selectedRegion.name}`,
              `${selectedRegion.name}, ${selectedCountry.name}`
            )}
          >
            <Check className="w-4 h-4 mr-2" />
            Add entire region ({selectedRegion.name})
          </Button>

          {cities && cities.length > 0 && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or select a city
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {cities.map((city) => (
                  <Button
                    key={city.id}
                    variant="outline"
                    className="justify-start"
                    onClick={() => onSelect('city', city.id, `${city.name}, ${selectedRegion.name}`)}
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    {city.name}
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## API Endpoints

### GET /api/publisher/coverage (enhanced)

**Response:**
```json
{
  "coverage": [
    {
      "id": "uuid",
      "coverage_level": "country",
      "geo_reference": "US",
      "city_id": null,
      "display_name": "United States",
      "priority": 5,
      "is_active": true,
      "city_count": 500
    },
    {
      "id": "uuid",
      "coverage_level": "region",
      "geo_reference": "US-NY",
      "city_id": null,
      "display_name": "New York, United States",
      "priority": 10,
      "is_active": true,
      "city_count": 50
    },
    {
      "id": "uuid",
      "coverage_level": "city",
      "geo_reference": null,
      "city_id": "city-uuid",
      "display_name": "Brooklyn, New York",
      "priority": 15,
      "is_active": true,
      "city_count": 1
    }
  ]
}
```

### POST /api/publisher/coverage (enhanced)

**Request:**
```json
{
  "level": "region",
  "geo_reference": "US-NY",
  "display_name": "New York, United States",
  "priority": 10
}
```

---

## Backend Query for Finding Publishers

```go
// FindPublishersForCity considers coverage hierarchy
func (s *CoverageService) FindPublishersForCity(ctx context.Context, cityID string) ([]Publisher, error) {
    query := `
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
        ORDER BY publisher_id, specificity DESC, priority DESC
    `
    // ...
}
```

---

## Implementation Checklist

### Database Tasks
- [ ] Create migration for new columns
- [ ] Run migration
- [ ] Update existing coverage data if needed

### Backend Tasks
- [ ] Update coverage handlers for hierarchy support
- [ ] Add `GetCitiesForCoverage()` service method
- [ ] Update `FindPublishersForCity()` for hierarchy query
- [ ] Add city count calculation for country/region coverage

### Frontend Tasks
- [ ] Create `CoverageManager` component
- [ ] Create `CoverageHierarchyPicker` component
- [ ] Create `CoverageList` component
- [ ] Create `CoverageMap` component (simple)
- [ ] Update `/publisher/coverage/page.tsx`

### Testing
- [ ] Unit test: Coverage service hierarchy logic
- [ ] Integration test: CRUD with different levels
- [ ] E2E test: Add country, region, city coverage
