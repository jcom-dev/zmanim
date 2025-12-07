# Location Data Process

## Overview

Zmanim Lab uses a multi-source geographic data system to ensure the most accurate prayer time calculations. This document explains our data sources, their accuracy, and how we prioritize them.

## Why Accuracy Matters

Zmanim (Jewish prayer times) are calculated based on solar position relative to a specific location. Even small errors in geographic data can affect calculations:

| Error Type | Magnitude | Zmanim Impact |
|------------|-----------|---------------|
| Latitude/Longitude | 0.01° (~1.1 km) | ~40 seconds |
| Elevation | 10 meters | ~40 seconds |

For observances like candle lighting (typically 18 minutes before sunset), a 1-2 minute error can be significant.

## Data Import Process

Our geographic database is built through a multi-stage import process that combines data from multiple authoritative sources:

### Import Order & Strategy

1. **Who's On First (WOF)** - Foundation layer
   - Imported first to establish geographic hierarchy
   - Provides continents, countries, regions, districts, cities
   - Includes boundaries (polygons) for coverage matching
   - Creates baseline city coordinates (polygon centroids)

2. **Copernicus GLO-90** - Elevation enhancement
   - Queries elevation for all WOF cities
   - Adds precise elevation data to existing cities
   - Does not create new cities

3. **SimpleMaps** - Coordinate enhancement + City creation (Pro version recommended)
   - **First**: Attempts to match SimpleMaps cities to existing WOF cities
   - **If matched**: Updates city with more accurate SimpleMaps coordinates
   - **If not matched**:
     - **Pro version**: Creates new city with timezone data
     - **Basic version**: Skips creation (timezone required by default)
     - Use `--allow-no-timezone` flag to create cities with UTC fallback
   - **If country missing**: Creates country from ISO2/ISO3 codes with continent mapping

### Data Sources

#### City Coordinates (Latitude/Longitude)

We use multiple sources for city coordinates, prioritized from most to least accurate:

##### 1. Publisher Override (Highest Priority)
- **What**: Custom coordinates set by zmanim publishers for their specific communities
- **Accuracy**: Varies, but represents the publisher's authoritative choice
- **Coverage**: Only for cities in the publisher's coverage area
- **Use Case**: A publisher serving a specific synagogue or neighborhood

##### 2. Community Corrections
- **What**: User-submitted corrections verified by our team
- **Accuracy**: Typically high (GPS-verified submissions)
- **Coverage**: Major Jewish communities worldwide
- **Use Case**: When community members identify coordinate errors

##### 3. SimpleMaps Database
- **What**: Commercial database built from government sources
- **Sources**: [National Geospatial-Intelligence Agency (NGIA)](https://www.nga.mil/), [US Geological Survey](https://www.usgs.gov/), [US Census Bureau](https://www.census.gov/), [NASA](https://www.nasa.gov/)
- **Accuracy**: ~50 meters (government-surveyed coordinates)
- **Coverage**: ~48,000 cities (Basic), ~4 million cities (Pro license)
- **Timezone Data**:
  - Pro/Comprehensive version includes IANA timezone identifiers
  - Basic (free) version does NOT include timezone data
- **Import Behavior**:
  - Matches to existing WOF cities using multi-pass fuzzy matching
  - Updates matched cities with SimpleMaps coordinates (keeps WOF timezone)
  - Creates new cities when no WOF match exists (uses SimpleMaps timezone if available)
  - Creates missing countries automatically from ISO codes
- **License**: [SimpleMaps World Cities Database](https://simplemaps.com/data/world-cities)

##### 4. Who's On First (Baseline)
- **What**: Open gazetteer with hierarchical geographic data
- **Sources**: [Who's On First Project](https://whosonfirst.org/)
- **Accuracy**: ~500-2000 meters (polygon centroids, not surveyed points)
- **Coverage**: 4.5+ million localities worldwide
- **Use Case**: Baseline data, geographic hierarchy, boundaries

### Elevation Data

#### 1. Publisher Override (Highest Priority)
- **What**: Custom elevation set by zmanim publishers
- **Use Case**: Publisher has local surveyed elevation data

#### 2. Community Corrections
- **What**: User-submitted elevation corrections
- **Accuracy**: Varies (ideally from local surveys or GPS)

#### 3. Copernicus GLO-90 DEM
- **What**: Global 90-meter Digital Elevation Model
- **Sources**: [Copernicus Programme](https://www.copernicus.eu/) (European Space Agency)
- **Accuracy**: 0.55 meters RMSE (root mean square error)
- **Coverage**: Global (except Armenia and Azerbaijan)
- **License**: Free for commercial use with attribution
- **Attribution**: "© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved"

#### 4. SRTM (Legacy Fallback)
- **What**: Shuttle Radar Topography Mission data
- **Accuracy**: 9.73 meters RMSE (up to 15+ meters in urban/forested areas)
- **Coverage**: ±60° latitude
- **Note**: Being phased out in favor of GLO-90

## Data Quality Tiers

Each city is assigned a data quality tier:

| Tier | Coordinate Source | Elevation Source | Typical Accuracy |
|------|-------------------|------------------|------------------|
| **1 - Verified** | Publisher or verified community | Publisher or verified | Highest |
| **2 - Authoritative** | SimpleMaps (NGIA) | GLO-90 | ~50m coords, ~1m elevation |
| **3 - Mixed** | SimpleMaps OR GLO-90 | (one or other) | Good |
| **4 - Baseline** | WOF centroid | SRTM | ~1km coords, ~10m elevation |

## How Priority Works

When calculating zmanim, the system automatically selects the best available data:

```
For Coordinates:
1. Check for publisher override (if publisher-specific request)
2. Check for verified community correction
3. Use SimpleMaps if available
4. Fall back to WOF centroid

For Elevation:
1. Check for publisher override (if publisher-specific request)
2. Check for verified community correction
3. Use GLO-90 if available
4. Fall back to SRTM

For Timezone:
1. Check for publisher override (if publisher-specific request)
2. Check for verified community correction
3. Use WOF timezone (most reliable - from wof:timezone property)
4. Use SimpleMaps timezone (Pro version only, for new cities)
5. Fall back to UTC
```

### Timezone Priority Explained

**Why WOF timezone has higher priority than SimpleMaps:**
- WOF timezone data is curated and validated against IANA timezone database
- WOF uses polygon boundaries to accurately determine timezone regions
- SimpleMaps timezone (available only in Pro version) is algorithmically derived
- For matched cities: WOF timezone is preserved during SimpleMaps import
- For new cities: SimpleMaps timezone is used if available, otherwise UTC

## SimpleMaps Import Details

The SimpleMaps import uses intelligent matching and creation logic:

### City Matching Strategy (Multi-Pass)

When importing SimpleMaps cities, the system tries to match them to existing WOF cities using:

1. **Exact name match** on ASCII name
2. **Normalized name match** (St.→Saint, removes suffixes like "City", "upon Tyne")
3. **Alternative names** via geo_names table (e.g., Rangoon→Yangon)
4. **Fuzzy trigram matching** (similarity > 0.4, within 25km)
5. **Fuzzy match on alternative names**

### What Happens When Matched

- SimpleMaps coordinates **replace** WOF centroid coordinates (higher accuracy)
- City retains WOF hierarchy (region, district)
- Coordinate source marked as "SimpleMaps"

### What Happens When NOT Matched

SimpleMaps creates a new city with complete geographic hierarchy:

1. **Check for country**:
   - If country exists (by ISO2 code) → use it
   - If country missing → **create country** from ISO2/ISO3 codes with continent mapping

2. **Create city** with:
   - Continent (derived from country's continent OR ISO2→continent lookup)
   - Country (from ISO2 code, created if needed)
   - Region (via PostGIS point-in-polygon matching against `geo_regions`)
   - District (via PostGIS point-in-polygon matching against `geo_districts`)
   - SimpleMaps coordinates, population
   - Timezone: SimpleMaps timezone (Pro version) or UTC (Basic version)

3. **Add coordinate record** to `geo_city_coordinates`

### Country Creation from ISO Codes

When SimpleMaps encounters a city in a country not yet in the database:

- Uses ISO 3166-1 alpha-2 → continent mapping
- Source: [ISO-3166-Countries-with-Regional-Codes](https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes)
- Creates `geo_countries` record with ISO2, ISO3, name, continent
- Handles all ~250 countries including disputed territories

**Example**: SimpleMaps city in "XK" (Kosovo) would:
1. Look up "XK" → "EU" (Europe) in ISO2→continent map
2. Create Kosovo country record with continent=Europe
3. Create city with full hierarchy

## Geographic Hierarchy

City data is organized hierarchically using Who's On First as the foundation:

```
Continent (e.g., Europe)
└── Country (e.g., United Kingdom)
    └── Region (e.g., England)
        └── District (e.g., Greater London)
            └── City (e.g., London)
```

### Hierarchy Sources

- **WOF imports**: Provides complete hierarchy with boundaries
- **SimpleMaps imports**:
  - For matched cities: Uses WOF hierarchy
  - For new cities: Assigns hierarchy via point-in-polygon matching
  - For new countries: Uses ISO2→continent mapping

This hierarchy ensures:
- Consistent geographic relationships
- Multi-language name support
- Boundary data for coverage matching
- Publisher coverage area matching

## Publisher Overrides

Publishers can override coordinates and elevation for cities in their coverage area. This is useful when:

- The community center/synagogue is in a specific location
- Local surveys provide more accurate data
- The publisher has halachic reasons for using specific coordinates

Publisher overrides only affect that publisher's zmanim calculations, not other publishers or the global defaults.

## Community Corrections

Users can submit corrections for cities with inaccurate data:

1. **Submit**: Provide corrected latitude, longitude, and/or elevation with source
2. **Review**: Our team verifies the submission
3. **Apply**: Once verified, the correction becomes available to all users

To submit a correction, contact us through the platform or your publisher.

## Transparency

We believe in data transparency. For any city, you can see:

- Current effective coordinates and elevation
- Source of each data point
- Data quality tier
- Available alternative sources

## Known Limitations

1. **WOF Centroids**: Baseline coordinates may be 1-2 km from actual city centers
2. **Urban Elevation**: GLO-90 measures surface (including buildings); may be higher than ground level in dense cities
3. **Small Towns**: Less data available for small communities without SimpleMaps coverage
4. **Ocean/Coastal**: Elevation models may have artifacts near coastlines

## Import Tools

The geographic database is built using specialized import tools:

### 1. `import-wof` - Who's On First Importer
- **Location**: `api/cmd/import-wof/`
- **Purpose**: Foundation import - countries, regions, districts, cities, boundaries
- **Data Source**: WOF SQLite bundles per country
- **Key Features**:
  - Imports hierarchical geography (continents → countries → regions → districts → cities)
  - Imports polygon boundaries for coverage matching
  - Imports multi-language names to `geo_names` table
  - Creates baseline city coordinates from polygon centroids
- **Run First**: Must be run before other imports

### 2. `import-elevation` - Copernicus GLO-90 Importer
- **Location**: `api/cmd/import-elevation/`
- **Purpose**: Add elevation data to existing cities
- **Data Source**: Copernicus GLO-90 DEM GeoTIFF files
- **Key Features**:
  - Queries elevation for all cities in database
  - Updates `geo_cities.elevation_m` field
  - Does NOT create new cities
- **Prerequisites**: WOF must be imported first

### 3. `import-simplemaps` - SimpleMaps City Importer
- **Location**: `api/cmd/import-simplemaps/`
- **Purpose**: Enhanced coordinates + city/country creation
- **Data Source**: SimpleMaps worldcities.csv (Pro version recommended)
- **Key Features**:
  - **Matches** SimpleMaps cities to WOF cities (multi-pass fuzzy matching)
  - **Updates** matched cities with SimpleMaps coordinates (higher accuracy)
  - **Creates** new cities when no WOF match found (requires timezone by default)
  - **Creates** missing countries from ISO2/ISO3 codes
  - **Assigns** region/district via PostGIS point-in-polygon
- **Timezone Policy**:
  - Default: Requires timezone (Pro version) for new city creation
  - Use `--allow-no-timezone` flag to create cities with UTC fallback (Basic version)
- **Recommended Order**: Run after WOF (but works standalone if needed)

### Import Sequence

**Recommended order** for a complete database build:

```bash
# 1. Foundation: Import WOF data
cd api
./import-wof import --country US
./import-wof import --country GB
# ... (repeat for all countries)

# 2. Elevation: Add GLO-90 elevation data
./import-elevation import --tiff-dir data/glo90/

# 3. Coordinates: Import SimpleMaps data
# Pro version (recommended - has timezone):
./import-simplemaps import --csv data/simplemaps/worldcities.csv

# OR Basic version (free - no timezone, only updates matched cities):
./import-simplemaps import --csv data/simplemaps/worldcities-basic.csv

# OR Basic version with city creation (uses UTC for new cities):
./import-simplemaps import --csv data/simplemaps/worldcities-basic.csv --allow-no-timezone
```

**Result**:
- WOF cities have: centroid coordinates + GLO-90 elevation + boundaries + hierarchy
- SimpleMaps-matched cities have: SimpleMaps coordinates (better) + GLO-90 elevation + WOF hierarchy
- SimpleMaps-only cities have: SimpleMaps coordinates + point-in-polygon hierarchy

## Data Updates

- **WOF**: Updated periodically as new releases are available
- **SimpleMaps**: Updated with new database purchases (re-import updates existing, creates new)
- **GLO-90**: Static (2021 data collection)
- **Community**: Ongoing as corrections are submitted and verified

### Re-importing Data

All import tools are **idempotent** and support updates:

- **WOF**: Re-importing a country updates existing cities, adds new ones
- **GLO-90**: Re-importing updates elevation for all cities
- **SimpleMaps**: Re-importing updates coordinates for matched cities, creates new cities/countries

## Attribution

This platform uses data from:

- [Who's On First](https://whosonfirst.org/) - Geographic hierarchy and boundaries (CC-BY)
- [SimpleMaps](https://simplemaps.com/data/world-cities) - City coordinates and population data
- [Copernicus Programme](https://www.copernicus.eu/) - GLO-90 elevation data (© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018)
- [ISO-3166-Countries-with-Regional-Codes](https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes) - ISO 3166-1 alpha-2 country to continent mappings

## Questions?

If you believe the coordinates or elevation for a specific city are incorrect, please contact us with:

1. City name and country
2. What you believe the correct values are
3. Source of your corrected data (GPS reading, local survey, etc.)

We take data accuracy seriously and appreciate community contributions.
