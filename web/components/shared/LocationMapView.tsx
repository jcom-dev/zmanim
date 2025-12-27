/**
 * @file LocationMapView.tsx
 * @purpose Display-only inline map view for location visualization (Story 6.4 AC-6.4.7)
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓
 */

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTheme } from 'next-themes';
import MapGL, {
  NavigationControl,
  GeolocateControl,
  Source,
  Layer,
  Marker,
  Popup,
  type MapRef,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useApi } from '@/lib/api-client';
import { Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { handleApiError } from '@/lib/utils/errorHandler';
import type { LocationSelection } from '@/types/geography';

// Map style URLs
const MAP_STYLES = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

export interface LocationMapViewProps {
  /** Location to display */
  location: LocationSelection;
  /** Height of the map container */
  height?: string | number;
  /** Custom class name */
  className?: string;
}

/**
 * Display-only inline map view component for visualizing locations.
 *
 * AC-6.4.7 Features:
 * - Display only - no click-to-select interactions
 * - NavigationControl (+/- zoom buttons, position="top-right", showCompass={false})
 * - GeolocateControl (position="top-right")
 * - Enable drag to pan, scroll wheel zoom, pinch zoom
 *
 * For Non-Locality Locations (Continent/Country/Region):
 * - Render map fitting the boundary polygon
 * - Draw boundary with dashed outline
 * - Display location name as overlay
 *
 * For Locality Locations:
 * - Render map centered on locality coordinates
 * - Street-level zoom (~15-16 zoom level)
 * - Show styled dot marker at locality center
 * - Hover tooltip on marker shows: lat/long, elevation, timezone
 */
export function LocationMapView({
  location,
  height = 400,
  className,
}: LocationMapViewProps) {
  const api = useApi();
  const { resolvedTheme } = useTheme();
  const mapRef = useRef<MapRef>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const [boundaryFeature, setBoundaryFeature] = useState<GeoJSON.Feature | null>(null);
  const [hasBoundary, setHasBoundary] = useState<boolean | null>(null);

  // Track which location we've initialized to prevent re-running effects
  const initializedLocationRef = useRef<string | null>(null);
  const [initialViewState, setInitialViewState] = useState({
    longitude: 0,
    latitude: 0,
    zoom: 2,
  });

  // API response type for boundary feature
  interface BoundaryFeatureResponse extends GeoJSON.Feature {
    properties: {
      has_boundary?: boolean;
      [key: string]: unknown;
    };
  }

  // Fetch boundary geometry for non-locality locations
  const fetchBoundary = useCallback(async () => {
    try {
      // Don't set loading for localities (they show marker immediately)
      if (location.type !== 'locality') {
        setIsLoading(true);
      }
      const feature = await api.public.get<BoundaryFeatureResponse>(
        `/geo/feature/${location.type}/${location.id}`
      );
      setBoundaryFeature(feature);
      // Check if the feature has actual boundary geometry
      const boundaryExists = feature.properties?.has_boundary === true && feature.geometry !== null;
      setHasBoundary(boundaryExists);
    } catch (err) {
      handleApiError(err, `Failed to load boundary for ${location.type}`);
      setHasBoundary(false);
    } finally {
      setIsLoading(false);
    }
  }, [api, location.type, location.id]);

  // Fetch locality details if coordinates are missing
  const fetchLocalityDetails = useCallback(async () => {
    if (location.type !== 'locality') return null;

    try {
      const localityData = await api.get<{
        id: string;
        name: string;
        latitude: number;
        longitude: number;
        elevation_m?: number;
        timezone: string;
        coordinate_source_key?: string;
        elevation_source_key?: string;
      }>(`/localities/${location.id}`);
      // Map elevation_m to elevation for consistency
      return {
        ...localityData,
        elevation: localityData.elevation_m,
        coordinate_source: localityData.coordinate_source_key,
        elevation_source: localityData.elevation_source_key,
      };
    } catch (err) {
      handleApiError(err, 'Failed to load locality details');
      return null;
    }
  }, [api, location.id, location.type]);

  // Set initial view state based on location type
  // Use a stable key to prevent re-initialization when callbacks change reference
  const locationKey = `${location.type}-${location.id}-${location.latitude}-${location.longitude}`;

  useEffect(() => {
    const needsInitialization = initializedLocationRef.current !== locationKey;

    // Always update the view state when coordinates change
    if (location.type === 'locality' && location.latitude && location.longitude) {
      const newViewState = {
        longitude: location.longitude,
        latitude: location.latitude,
        zoom: 15,
      };

      // Always set initial view state for new renders
      setInitialViewState(newViewState);

      // Always fly to the location if map exists
      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [location.longitude, location.latitude],
          zoom: 15,
          duration: needsInitialization ? 0 : 500, // Instant for first load, quick animation for changes
        });
      }
      setIsLoading(false);
    }

    // Skip full initialization if we've already done it for this exact location
    if (!needsInitialization) {
      return;
    }

    initializedLocationRef.current = locationKey;

    const initializeMap = async () => {
      if (location.type === 'locality') {
        if (location.latitude && location.longitude) {
          // Already handled above
          setIsLoading(false);
        } else {
          // Locality without coordinates: fetch details
          setIsLoading(true);
          const localityData = await fetchLocalityDetails();
          if (localityData) {
            const newViewState = {
              longitude: localityData.longitude,
              latitude: localityData.latitude,
              zoom: 15,
            };
            setInitialViewState(newViewState);

            // If map is already initialized, fly to new location
            if (mapRef.current) {
              mapRef.current.flyTo({
                center: [localityData.longitude, localityData.latitude],
                zoom: 15,
                duration: 1000,
              });
            }
            // Update location with fetched coordinates (for marker and popup)
            location.latitude = localityData.latitude;
            location.longitude = localityData.longitude;
            location.elevation = localityData.elevation;
            location.timezone = localityData.timezone;
          }
          setIsLoading(false);
        }
        // Also fetch boundary for locality (may or may not exist)
        fetchBoundary();
      } else {
        // Non-locality: fetch boundary and fit to bounds
        fetchBoundary();
      }
    };

    initializeMap();
  }, [locationKey, location.type, location.latitude, location.longitude, fetchBoundary, fetchLocalityDetails]);

  // Fit map to boundary after it loads
  useEffect(() => {
    if (!boundaryFeature || !mapRef.current || !hasBoundary) return;

    const map = mapRef.current.getMap();
    if (!map) return;

    // Calculate bounds from boundary geometry
    const calculateBounds = (geometry: GeoJSON.Geometry): [[number, number], [number, number]] | null => {
      let minLng = Infinity;
      let minLat = Infinity;
      let maxLng = -Infinity;
      let maxLat = -Infinity;

      const processCoordinates = (coords: unknown): void => {
        if (Array.isArray(coords) && coords.length === 2 && typeof coords[0] === 'number') {
          // Single coordinate pair [lng, lat]
          minLng = Math.min(minLng, coords[0]);
          maxLng = Math.max(maxLng, coords[0]);
          minLat = Math.min(minLat, coords[1]);
          maxLat = Math.max(maxLat, coords[1]);
        } else if (Array.isArray(coords)) {
          // Nested array
          coords.forEach(processCoordinates);
        }
      };

      // Handle different geometry types
      if (geometry.type === 'GeometryCollection') {
        geometry.geometries.forEach(g => {
          if ('coordinates' in g) {
            processCoordinates(g.coordinates);
          }
        });
      } else if ('coordinates' in geometry) {
        processCoordinates(geometry.coordinates);
      }

      if (minLng === Infinity || minLat === Infinity || maxLng === -Infinity || maxLat === -Infinity) {
        return null;
      }

      return [[minLng, minLat], [maxLng, maxLat]];
    };

    const bounds = calculateBounds(boundaryFeature.geometry);
    if (bounds) {
      // For localities with boundaries, allow higher zoom to fit the region nicely
      // For non-localities (countries/regions), cap at zoom 10
      const maxZoom = location.type === 'locality' ? 16 : 10;
      map.fitBounds(bounds, { padding: 50, maxZoom });
    }
  }, [boundaryFeature, hasBoundary, location.type]);

  // Determine map style based on theme - memoize to prevent map reload
  const mapStyle = useMemo(() =>
    resolvedTheme === 'dark' ? MAP_STYLES.dark : MAP_STYLES.light,
    [resolvedTheme]
  );

  // Handle map load - ensure it's centered on the correct location
  const handleMapLoad = useCallback(() => {
    if (location.type === 'locality' && location.latitude && location.longitude && mapRef.current) {
      mapRef.current.flyTo({
        center: [location.longitude, location.latitude],
        zoom: 15,
        duration: 0, // Instant jump on load
      });
    }
  }, [location.type, location.latitude, location.longitude]);

  return (
    <div className={cn("relative rounded-lg overflow-hidden border", className)} style={{ height }}>
      {/* Loading overlay - shown on top of map */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <span className="text-sm text-muted-foreground">Loading map...</span>
          </div>
        </div>
      )}

      {/* Map - always rendered to prevent remounting, hidden during loading */}
      <div style={{ visibility: isLoading ? 'hidden' : 'visible', width: '100%', height: '100%' }}>
        <MapGL
          ref={mapRef}
          initialViewState={initialViewState}
          onLoad={handleMapLoad}
          style={{ width: '100%', height: '100%' }}
          mapStyle={mapStyle}
          attributionControl={false}
          cursor="grab"
          // Enable interactions for exploration
          dragPan={true}
          scrollZoom={true}
          doubleClickZoom={true}
          touchZoomRotate={true}
        >
          {/* Navigation Controls */}
          <NavigationControl position="top-right" showCompass={false} />
          <GeolocateControl
            position="top-right"
            trackUserLocation={false}
            showUserLocation={true}
            showAccuracyCircle={false}
            fitBoundsOptions={{ maxZoom: 10 }}
          />

          {/* For Locality: Show marker with hover popup */}
          {location.type === 'locality' && location.latitude && location.longitude && (
            <>
              <Marker
                longitude={location.longitude}
                latitude={location.latitude}
                anchor="center"
              >
                <div
                  className="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg cursor-pointer"
                  onMouseEnter={() => setShowPopup(true)}
                  onMouseLeave={() => setShowPopup(false)}
                />
              </Marker>

              {/* Hover tooltip showing lat/long, elevation, timezone */}
              {showPopup && (
                <Popup
                  longitude={location.longitude}
                  latitude={location.latitude}
                  anchor="bottom"
                  closeButton={false}
                  closeOnClick={false}
                  offset={15}
                  className="location-popup"
                >
                  <div className="p-2 text-xs space-y-1">
                    <div className="font-semibold text-foreground">{location.name}</div>
                    <div className="text-muted-foreground">
                      <div>Lat: {location.latitude.toFixed(4)}</div>
                      <div>Lng: {location.longitude.toFixed(4)}</div>
                      {location.elevation !== undefined && (
                        <div>Elevation: {location.elevation}m</div>
                      )}
                      {location.timezone && (
                        <div>Timezone: {location.timezone}</div>
                      )}
                    </div>
                  </div>
                </Popup>
              )}
            </>
          )}

          {/* Show boundary polygon with dashed outline (for any location type with boundary) */}
          {boundaryFeature && hasBoundary && (
            <Source
              type="geojson"
              data={boundaryFeature}
            >
              {/* Fill layer */}
              <Layer
                id="boundary-fill"
                type="fill"
                paint={{
                  'fill-color': '#3b82f6',
                  'fill-opacity': 0.2,
                }}
              />
              {/* Dashed outline layer */}
              <Layer
                id="boundary-outline"
                type="line"
                paint={{
                  'line-color': '#3b82f6',
                  'line-width': 2,
                  'line-dasharray': [2, 2],
                }}
              />
            </Source>
          )}
        </MapGL>
      </div>

      {/* Location name overlay for non-locality locations */}
      {!isLoading && location.type !== 'locality' && (
        <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg z-10">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <div>
              <div className="font-semibold text-sm text-foreground">{location.name}</div>
              <div className="text-xs text-muted-foreground capitalize">{location.type}</div>
            </div>
          </div>
        </div>
      )}

      {/* No boundary available message for non-locality locations */}
      {!isLoading && location.type !== 'locality' && hasBoundary === false && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-20">
          <div className="text-center p-4">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium text-muted-foreground">
              No boundary data available for this {location.type}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              The map shows the general area
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
