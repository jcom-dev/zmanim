/**
 * @file LocationMapView.tsx
 * @purpose Display-only inline map view for location visualization (Story 6.4 AC-6.4.7)
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
 * For Non-City Locations (Continent/Country/Region/District):
 * - Render map fitting the boundary polygon
 * - Draw boundary with dashed outline
 * - Display location name as overlay
 *
 * For City Locations:
 * - Render map centered on city coordinates
 * - Street-level zoom (~15-16 zoom level)
 * - Show styled dot marker at city center
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
  const [initialViewState, setInitialViewState] = useState({
    longitude: 0,
    latitude: 0,
    zoom: 2,
  });

  // Fetch boundary geometry for non-city locations
  const fetchBoundary = useCallback(async () => {
    if (location.type === 'city') {
      // Cities use point marker, no boundary needed
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const feature = await api.public.get<GeoJSON.Feature>(
        `/geo/feature/${location.type}/${location.id}`
      );
      setBoundaryFeature(feature);
    } catch (err) {
      handleApiError(err, `Failed to load boundary for ${location.type}`);
    } finally {
      setIsLoading(false);
    }
  }, [api, location.type, location.id]);

  // Fetch city details if coordinates are missing
  const fetchCityDetails = useCallback(async () => {
    if (location.type !== 'city') return null;

    try {
      const cityData = await api.get<{
        id: string;
        name: string;
        latitude: number;
        longitude: number;
        elevation?: number;
        timezone: string;
      }>(`/cities/${location.id}`);
      return cityData;
    } catch (err) {
      handleApiError(err, 'Failed to load city details');
      return null;
    }
  }, [api, location.id, location.type]);

  // Set initial view state based on location type
  useEffect(() => {
    const initializeMap = async () => {
      if (location.type === 'city') {
        if (location.latitude && location.longitude) {
          // City with coordinates: street-level zoom (~15-16)
          setInitialViewState({
            longitude: location.longitude,
            latitude: location.latitude,
            zoom: 15,
          });
          setIsLoading(false);
        } else {
          // City without coordinates: fetch details
          setIsLoading(true);
          const cityData = await fetchCityDetails();
          if (cityData) {
            setInitialViewState({
              longitude: cityData.longitude,
              latitude: cityData.latitude,
              zoom: 15,
            });
            // Update location with fetched coordinates (for marker and popup)
            location.latitude = cityData.latitude;
            location.longitude = cityData.longitude;
            location.elevation = cityData.elevation;
            location.timezone = cityData.timezone;
          }
          setIsLoading(false);
        }
      } else {
        // Non-city: fetch boundary and fit to bounds
        fetchBoundary();
      }
    };

    initializeMap();
  }, [location, fetchBoundary, fetchCityDetails]);

  // Fit map to boundary after it loads
  useEffect(() => {
    if (!boundaryFeature || !mapRef.current) return;

    const map = mapRef.current.getMap();
    if (!map) return;

    // Calculate bounds from boundary geometry
    const calculateBounds = (geometry: GeoJSON.Geometry): [[number, number], [number, number]] | null => {
      let minLng = Infinity;
      let minLat = Infinity;
      let maxLng = -Infinity;
      let maxLat = -Infinity;

      const processCoordinates = (coords: any) => {
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
      map.fitBounds(bounds, { padding: 50, maxZoom: 10 });
    }
  }, [boundaryFeature]);

  // Determine map style based on theme
  const mapStyle = resolvedTheme === 'dark' ? MAP_STYLES.dark : MAP_STYLES.light;

  return (
    <div className={cn("relative rounded-lg overflow-hidden border", className)} style={{ height }}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <span className="text-sm text-muted-foreground">Loading map...</span>
          </div>
        </div>
      )}

      {/* Map */}
      {!isLoading && (
        <MapGL
          ref={mapRef}
          initialViewState={initialViewState}
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

          {/* For City: Show marker with hover popup */}
          {location.type === 'city' && location.latitude && location.longitude && (
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

          {/* For Non-City: Show boundary polygon with dashed outline */}
          {location.type !== 'city' && boundaryFeature && (
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
      )}

      {/* Location name overlay for non-city locations */}
      {!isLoading && location.type !== 'city' && (
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
    </div>
  );
}
