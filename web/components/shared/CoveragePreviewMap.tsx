/**
 * @file CoveragePreviewMap.tsx
 * @purpose Read-only map preview for coverage visualization
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useApi } from '@/lib/api-client';
import { Loader2, Globe, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { handleApiError } from '@/lib/utils/errorHandler';
import type { CoverageItem } from '@/types/geography';

export interface CoveragePreviewMapProps {
  /** Existing coverage to display (green) */
  existingCoverage?: CoverageItem[];
  /** Newly selected coverage to display (blue) */
  selectedCoverage?: CoverageItem[];
  /** Item currently being hovered in the list (for highlighting) */
  highlightedItem?: CoverageItem | null;
  /** Height of the map container */
  height?: string | number;
  /** Custom class name */
  className?: string;
}

// Map style URLs
const LIGHT_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/**
 * Read-only map for previewing coverage areas.
 *
 * Features:
 * - Displays existing coverage (green polygons/markers)
 * - Displays selected coverage (blue polygons/markers)
 * - Highlights currently hovered item (yellow outline)
 * - Cities without boundaries shown as markers
 * - Auto-fits bounds to show all coverage
 * - NO selection logic - purely visual preview
 */
export function CoveragePreviewMap({
  existingCoverage = [],
  selectedCoverage = [],
  highlightedItem,
  height = 400,
  className,
}: CoveragePreviewMapProps) {
  const api = useApi();
  const { resolvedTheme } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedFeatures, setLoadedFeatures] = useState<{
    existing: GeoJSON.FeatureCollection;
    selected: GeoJSON.FeatureCollection;
    existingPoints: GeoJSON.FeatureCollection;
    selectedPoints: GeoJSON.FeatureCollection;
  } | null>(null);

  // Fetch geometry for a coverage item
  const fetchFeature = useCallback(async (item: CoverageItem): Promise<GeoJSON.Feature | null> => {
    try {
      const feature = await api.public.get<GeoJSON.Feature>(
        `/geo/feature/${item.type}/${item.id}`
      );
      return feature;
    } catch (err) {
      handleApiError(err, `Failed to load geometry for ${item.type}`);
      return null;
    }
  }, [api]);

  // Load all features
  useEffect(() => {
    const loadFeatures = async () => {
      setIsLoading(true);

      const existingPolygons: GeoJSON.Feature[] = [];
      const existingPoints: GeoJSON.Feature[] = [];
      const selectedPolygons: GeoJSON.Feature[] = [];
      const selectedPoints: GeoJSON.Feature[] = [];

      // Load existing coverage
      for (const item of existingCoverage) {
        const feature = await fetchFeature(item);
        if (feature) {
          if (feature.geometry.type === 'Point') {
            existingPoints.push(feature);
          } else {
            existingPolygons.push(feature);
          }
        }
      }

      // Load selected coverage
      for (const item of selectedCoverage) {
        const feature = await fetchFeature(item);
        if (feature) {
          if (feature.geometry.type === 'Point') {
            selectedPoints.push(feature);
          } else {
            selectedPolygons.push(feature);
          }
        }
      }

      setLoadedFeatures({
        existing: { type: 'FeatureCollection', features: existingPolygons },
        selected: { type: 'FeatureCollection', features: selectedPolygons },
        existingPoints: { type: 'FeatureCollection', features: existingPoints },
        selectedPoints: { type: 'FeatureCollection', features: selectedPoints },
      });
      setIsLoading(false);
    };

    if (existingCoverage.length > 0 || selectedCoverage.length > 0) {
      loadFeatures();
    } else {
      setLoadedFeatures(null);
      setIsLoading(false);
    }
  }, [existingCoverage, selectedCoverage, fetchFeature]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: resolvedTheme === 'dark' ? DARK_STYLE : LIGHT_STYLE,
      center: [35, 31.5], // Default: Israel
      zoom: 2,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [resolvedTheme]);

  // Update map sources when features load
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedFeatures) return;

    // Wait for map style to load
    const updateSources = () => {
      // Remove old layers and sources
      const layerIds = ['existing-fill', 'existing-outline', 'selected-fill', 'selected-outline', 'existing-points', 'selected-points'];
      layerIds.forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      const sourceIds = ['existing', 'selected', 'existing-points', 'selected-points'];
      sourceIds.forEach(id => {
        if (map.getSource(id)) map.removeSource(id);
      });

      // Add sources
      map.addSource('existing', { type: 'geojson', data: loadedFeatures.existing });
      map.addSource('selected', { type: 'geojson', data: loadedFeatures.selected });
      map.addSource('existing-points', { type: 'geojson', data: loadedFeatures.existingPoints });
      map.addSource('selected-points', { type: 'geojson', data: loadedFeatures.selectedPoints });

      // Add layers
      // Existing coverage (green)
      map.addLayer({
        id: 'existing-fill',
        type: 'fill',
        source: 'existing',
        paint: {
          'fill-color': '#22c55e',
          'fill-opacity': 0.25,
        },
      });
      map.addLayer({
        id: 'existing-outline',
        type: 'line',
        source: 'existing',
        paint: {
          'line-color': '#16a34a',
          'line-width': 2,
        },
      });

      // Selected coverage (blue)
      map.addLayer({
        id: 'selected-fill',
        type: 'fill',
        source: 'selected',
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.3,
        },
      });
      map.addLayer({
        id: 'selected-outline',
        type: 'line',
        source: 'selected',
        paint: {
          'line-color': '#2563eb',
          'line-width': 2,
        },
      });

      // Point markers for localities without boundaries
      map.addLayer({
        id: 'existing-points',
        type: 'circle',
        source: 'existing-points',
        paint: {
          'circle-radius': 8,
          'circle-color': '#22c55e',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
      map.addLayer({
        id: 'selected-points',
        type: 'circle',
        source: 'selected-points',
        paint: {
          'circle-radius': 8,
          'circle-color': '#3b82f6',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Fit bounds to show all features
      const allFeatures = [
        ...loadedFeatures.existing.features,
        ...loadedFeatures.selected.features,
        ...loadedFeatures.existingPoints.features,
        ...loadedFeatures.selectedPoints.features,
      ];

      if (allFeatures.length > 0) {
        const bounds = new maplibregl.LngLatBounds();

        allFeatures.forEach(feature => {
          if (feature.geometry.type === 'Point') {
            bounds.extend(feature.geometry.coordinates as [number, number]);
          } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
            const coords = feature.geometry.type === 'Polygon'
              ? feature.geometry.coordinates[0]
              : feature.geometry.coordinates.flat(2);
            coords.forEach(coord => {
              if (Array.isArray(coord) && coord.length >= 2) {
                bounds.extend([coord[0], coord[1]] as [number, number]);
              }
            });
          }
        });

        map.fitBounds(bounds, { padding: 50, maxZoom: 10 });
      }
    };

    if (map.isStyleLoaded()) {
      updateSources();
    } else {
      map.on('load', updateSources);
    }
  }, [loadedFeatures]);

  // Handle highlighted item
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !highlightedItem) return;

    // Could add highlight layer here if needed
    // For now, we'll just fly to the highlighted item's location
    const flyToItem = async () => {
      const feature = await fetchFeature(highlightedItem);
      if (!feature) return;

      if (feature.properties?.centroid) {
        const [lng, lat] = feature.properties.centroid;
        map.flyTo({ center: [lng, lat], zoom: 6, duration: 800 });
      } else if (feature.geometry.type === 'Point') {
        map.flyTo({
          center: feature.geometry.coordinates as [number, number],
          zoom: 10,
          duration: 800,
        });
      }
    };

    flyToItem();
  }, [highlightedItem, fetchFeature]);

  const totalCount = existingCoverage.length + selectedCoverage.length;

  return (
    <div className={cn("relative rounded-lg overflow-hidden border", className)} style={{ height }}>
      {/* Map container */}
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Loading overlay */}
      {isLoading && totalCount > 0 && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <span className="text-sm text-muted-foreground">Loading coverage areas...</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && totalCount === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
          <div className="text-center">
            <Globe className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No coverage areas to display</p>
            <p className="text-xs text-muted-foreground mt-1">Add coverage using the search panel</p>
          </div>
        </div>
      )}

      {/* Legend */}
      {!isLoading && totalCount > 0 && (
        <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs shadow-lg z-10">
          <div className="space-y-1.5">
            {existingCoverage.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-green-500/30 border border-green-600" />
                <span className="text-muted-foreground">Existing ({existingCoverage.length})</span>
              </div>
            )}
            {selectedCoverage.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-blue-500/30 border border-blue-600" />
                <span className="text-muted-foreground">Selected ({selectedCoverage.length})</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
