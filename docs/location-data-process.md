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

## Data Sources

### City Coordinates (Latitude/Longitude)

We use multiple sources for city coordinates, prioritized from most to least accurate:

#### 1. Publisher Override (Highest Priority)
- **What**: Custom coordinates set by zmanim publishers for their specific communities
- **Accuracy**: Varies, but represents the publisher's authoritative choice
- **Coverage**: Only for cities in the publisher's coverage area
- **Use Case**: A publisher serving a specific synagogue or neighborhood

#### 2. Community Corrections
- **What**: User-submitted corrections verified by our team
- **Accuracy**: Typically high (GPS-verified submissions)
- **Coverage**: Major Jewish communities worldwide
- **Use Case**: When community members identify coordinate errors

#### 3. SimpleMaps Database
- **What**: Commercial database built from government sources
- **Sources**: [National Geospatial-Intelligence Agency (NGIA)](https://www.nga.mil/), [US Geological Survey](https://www.usgs.gov/), [US Census Bureau](https://www.census.gov/), [NASA](https://www.nasa.gov/)
- **Accuracy**: ~50 meters (government-surveyed coordinates)
- **Coverage**: ~4 million cities worldwide (with Pro license)
- **License**: [SimpleMaps World Cities Database](https://simplemaps.com/data/world-cities)

#### 4. Who's On First (Baseline)
- **What**: Open gazetteer with hierarchical geographic data
- **Sources**: [Who's On First Project](https://whosonfirst.org/)
- **Accuracy**: ~500-2000 meters (polygon centroids, not surveyed points)
- **Coverage**: 4.5+ million localities worldwide
- **Use Case**: Baseline data and geographic hierarchy

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
```

## Geographic Hierarchy

City data is organized hierarchically using Who's On First:

```
Continent (e.g., Europe)
└── Country (e.g., United Kingdom)
    └── Region (e.g., England)
        └── District (e.g., Greater London)
            └── City (e.g., London)
```

This hierarchy ensures:
- Consistent geographic relationships
- Multi-language name support
- Boundary data for coverage matching

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

## Data Updates

- **WOF**: Updated periodically as new releases are available
- **SimpleMaps**: Updated with new database purchases
- **GLO-90**: Static (2021 data collection)
- **Community**: Ongoing as corrections are submitted and verified

## Attribution

This platform uses data from:

- [Who's On First](https://whosonfirst.org/) - Geographic hierarchy and boundaries (CC-BY)
- [SimpleMaps](https://simplemaps.com/data/world-cities) - City coordinates
- [Copernicus Programme](https://www.copernicus.eu/) - Elevation data

## Questions?

If you believe the coordinates or elevation for a specific city are incorrect, please contact us with:

1. City name and country
2. What you believe the correct values are
3. Source of your corrected data (GPS reading, local survey, etc.)

We take data accuracy seriously and appreciate community contributions.
