/**
 * @file useMapPreview.ts
 * @purpose Shared hook for MapLibre GL map initialization and management
 * @pattern hook
 * @compliance maplibre-gl:✓ cleanup:✓
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';

/**
 * Options for configuring the map preview hook
 */
export interface UseMapPreviewOptions {
  /** DOM element ID for the map container */
  containerId: string;
  /** Initial center coordinates [longitude, latitude] (default: [0, 0]) */
  initialCenter?: [number, number];
  /** Initial zoom level (0-22, default: 2) */
  initialZoom?: number;
  /** Map style URL (default: CartoDB Positron) */
  style?: string;
}

/**
 * Return value from useMapPreview hook
 */
export interface UseMapPreviewReturn {
  /** MapLibre map instance (null until loaded) */
  map: maplibregl.Map | null;
  /** Loading state (true until map is fully loaded) */
  loading: boolean;
  /** Error message if map initialization failed, null otherwise */
  error: string | null;
  /** Helper function to add a marker at specified coordinates */
  addMarker: (lat: number, lon: number, options?: maplibregl.MarkerOptions) => void;
  /** Helper function to add a GeoJSON boundary to the map */
  addBoundary: (geojson: GeoJSON.Geometry, options?: AddBoundaryOptions) => void;
}

/**
 * Options for adding boundaries to the map
 */
export interface AddBoundaryOptions {
  /** Source ID for the boundary (default: 'boundary') */
  sourceId?: string;
  /** Layer ID for the boundary (default: 'boundary') */
  layerId?: string;
  /** Fill color for the boundary (default: '#3b82f6' - blue-500, close to primary) */
  fillColor?: string;
  /** Fill opacity (default: 0.2) */
  fillOpacity?: number;
  /** Outline color (default: '#3b82f6' - blue-500, close to primary) */
  lineColor?: string;
  /** Outline width (default: 2) */
  lineWidth?: number;
}

// Default map style (CartoDB Positron - light, clean basemap)
const DEFAULT_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

/**
 * Hook for initializing and managing a MapLibre GL map.
 *
 * Features:
 * - Initializes MapLibre GL map on mount
 * - Handles map cleanup on unmount (prevents memory leaks)
 * - Provides loading and error states
 * - Helper functions for adding markers and boundaries
 * - Supports custom styles and initial view
 *
 * @param options - Configuration options for the map
 * @returns Object containing map instance, loading state, error, and helper functions
 *
 * @example Basic map initialization
 * ```tsx
 * function MapComponent() {
 *   const { map, loading, error, addMarker } = useMapPreview({
 *     containerId: 'map',
 *     initialCenter: [34.7818, 32.0853], // Tel Aviv
 *     initialZoom: 10,
 *   });
 *
 *   useEffect(() => {
 *     if (map && !loading) {
 *       addMarker(32.0853, 34.7818); // Add marker at Tel Aviv
 *     }
 *   }, [map, loading]);
 *
 *   return (
 *     <div>
 *       {loading && <p>Loading map...</p>}
 *       {error && <p>Error: {error}</p>}
 *       <div id="map" style={{ height: 400 }} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Map with boundary
 * ```tsx
 * function CoverageMap() {
 *   const { map, loading, addBoundary } = useMapPreview({
 *     containerId: 'coverage-map',
 *   });
 *
 *   useEffect(() => {
 *     if (map && !loading && cityBoundary) {
 *       addBoundary(cityBoundary, {
 *         fillColor: '#22c55e',
 *         lineColor: '#16a34a',
 *       });
 *     }
 *   }, [map, loading, cityBoundary]);
 *
 *   return <div id="coverage-map" style={{ height: 500 }} />;
 * }
 * ```
 */
export function useMapPreview(
  options: UseMapPreviewOptions
): UseMapPreviewReturn {
  const {
    containerId,
    initialCenter = [0, 0],
    initialZoom = 2,
    style = DEFAULT_STYLE,
  } = options;

  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize map on mount
  useEffect(() => {
    try {
      // Create map instance
      const mapInstance = new maplibregl.Map({
        container: containerId,
        style: style,
        center: initialCenter,
        zoom: initialZoom,
      });

      // Wait for map to load
      mapInstance.on('load', () => {
        setLoading(false);
      });

      // Handle map errors
      mapInstance.on('error', (e) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('Map error:', e);
        }
        setError(e.error?.message || 'Map initialization failed');
        setLoading(false);
      });

      mapRef.current = mapInstance;
      setMap(mapInstance);

      // Cleanup on unmount
      return () => {
        mapInstance.remove();
        mapRef.current = null;
        setMap(null);
      };
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to initialize map:', err);
      }
      setError(err.message || 'Map initialization failed');
      setLoading(false);
    }
  }, [containerId, initialCenter, initialZoom, style]);

  /**
   * Add a marker to the map at specified coordinates
   */
  const addMarker = useCallback(
    (lat: number, lon: number, markerOptions?: maplibregl.MarkerOptions) => {
      if (!mapRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Cannot add marker: map not initialized');
        }
        return;
      }

      const marker = new maplibregl.Marker(markerOptions)
        .setLngLat([lon, lat])
        .addTo(mapRef.current);

      return marker;
    },
    []
  );

  /**
   * Add a GeoJSON boundary (polygon/multipolygon) to the map
   *
   * Note: Uses hex color defaults (#3b82f6) because MapLibre GL requires
   * actual color values, not CSS variables. This is a justified exception
   * to the design tokens rule. Colors can be overridden via options.
   */
  const addBoundary = useCallback(
    (geojson: GeoJSON.Geometry, boundaryOptions?: AddBoundaryOptions) => {
      const map = mapRef.current;
      if (!map) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Cannot add boundary: map not initialized');
        }
        return;
      }

      const {
        sourceId = 'boundary',
        layerId = 'boundary',
        fillColor = '#3b82f6', // blue-500 - MapLibre requires hex, not CSS vars
        fillOpacity = 0.2,
        lineColor = '#3b82f6', // blue-500 - MapLibre requires hex, not CSS vars
        lineWidth = 2,
      } = boundaryOptions || {};

      // Remove existing source and layers if they exist
      if (map.getLayer(`${layerId}-fill`)) {
        map.removeLayer(`${layerId}-fill`);
      }
      if (map.getLayer(`${layerId}-outline`)) {
        map.removeLayer(`${layerId}-outline`);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }

      // Add source
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: geojson,
        },
      });

      // Add fill layer
      map.addLayer({
        id: `${layerId}-fill`,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': fillColor,
          'fill-opacity': fillOpacity,
        },
      });

      // Add outline layer
      map.addLayer({
        id: `${layerId}-outline`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': lineColor,
          'line-width': lineWidth,
        },
      });
    },
    []
  );

  return {
    map,
    loading,
    error,
    addMarker,
    addBoundary,
  };
}
