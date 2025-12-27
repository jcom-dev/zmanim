'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDynamicMutation } from '@/lib/hooks/useApiQuery';
import { LocalitySearchResult, PublisherLocationOverride, LocationOverrideCreateRequest } from '@/types/geography';
import { LocationMapView } from '@/components/shared/LocationMapView';
import { Database, Building2, Globe, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';


type LocationSource = 'default' | 'publisher' | 'public';

interface LocationData {
  latitude: number;
  longitude: number;
  elevation: number;
  source: string;
}

interface LocationOverrideDialogProps {
  locality: LocalitySearchResult;
  existingOverride?: PublisherLocationOverride;
  /** Public/admin override data if it exists */
  publicOverride?: {
    latitude?: number;
    longitude?: number;
    elevation?: number;
  };
  /** Original database coordinates (before any overrides) */
  originalCoordinates?: {
    latitude: number;
    longitude: number;
    elevation: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function LocationOverrideDialog({
  locality,
  existingOverride,
  publicOverride,
  originalCoordinates,
  open,
  onOpenChange,
  onSuccess,
}: LocationOverrideDialogProps) {
  // Track if we've initialized to prevent re-initialization on every render
  const hasInitialized = useRef(false);

  // Selected source toggle
  const [selectedSource, setSelectedSource] = useState<LocationSource>('default');

  // Form state - initialized empty, populated via useEffect
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [elevation, setElevation] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Compute location data for each source
  const locationSources = useMemo((): Record<LocationSource, LocationData | null> => {
    // Use originalCoordinates if provided, otherwise fall back to locality
    const defaultCoords = originalCoordinates || {
      latitude: locality.latitude ?? 0,
      longitude: locality.longitude ?? 0,
      elevation: locality.elevation ?? 0,
    };

    const defaultData: LocationData = {
      latitude: defaultCoords.latitude,
      longitude: defaultCoords.longitude,
      elevation: defaultCoords.elevation,
      source: 'Default (Database)',
    };

    const publisherData: LocationData | null = existingOverride ? {
      latitude: existingOverride.override_latitude ?? defaultData.latitude,
      longitude: existingOverride.override_longitude ?? defaultData.longitude,
      elevation: existingOverride.override_elevation ?? defaultData.elevation,
      source: 'Publisher Override',
    } : null;

    // Check if there's a public/admin override (from coordinate_source === 'admin')
    const hasPublicOverride = locality.coordinate_source === 'admin' ||
                              locality.elevation_source === 'admin' ||
                              publicOverride !== undefined;

    const publicData: LocationData | null = hasPublicOverride ? {
      latitude: publicOverride?.latitude ?? locality.latitude ?? 0,
      longitude: publicOverride?.longitude ?? locality.longitude ?? 0,
      elevation: publicOverride?.elevation ?? locality.elevation ?? 0,
      source: 'Public Override (Admin)',
    } : null;

    return {
      default: defaultData,
      publisher: publisherData,
      public: publicData,
    };
  }, [locality, existingOverride, publicOverride, originalCoordinates]);

  // Determine which source to auto-select
  const determineInitialSource = (): LocationSource => {
    if (existingOverride) return 'publisher';
    if (locationSources.public) return 'public';
    return 'default';
  };

  // Initialize form state when dialog opens or when locality/override changes
  useEffect(() => {
    if (open && !hasInitialized.current) {
      const initialSource = determineInitialSource();
      setSelectedSource(initialSource);

      // If editing existing override, populate the override fields
      // Otherwise, leave them empty
      if (existingOverride) {
        setLatitude(existingOverride.override_latitude?.toString() ?? '');
        setLongitude(existingOverride.override_longitude?.toString() ?? '');
        setElevation(existingOverride.override_elevation?.toString() ?? '');
        setReason(existingOverride.reason ?? '');
      } else {
        // Start with empty override fields for new overrides
        setLatitude('');
        setLongitude('');
        setElevation('');
        setReason('');
      }
      setError(null);
      hasInitialized.current = true;
    }
    // Reset flag when dialog closes so it re-initializes next time
    if (!open) {
      hasInitialized.current = false;
    }
  }, [open, locality, existingOverride]);

  // Update form when source changes - copy coordinates to override fields
  const handleSourceChange = (value: string) => {
    if (!value) return;
    const newSource = value as LocationSource;
    setSelectedSource(newSource);

    // When user selects a source, copy those coordinates to the override fields
    const sourceData = locationSources[newSource] || locationSources.default;
    if (sourceData) {
      setLatitude(sourceData.latitude.toString());
      setLongitude(sourceData.longitude.toString());
      setElevation(sourceData.elevation.toString());
    }
  };

  // Get the current location for the map preview
  // Priority: use input field values if both lat/lon are valid, otherwise use selected source
  const currentMapLocation = useMemo(() => {
    const sourceData = locationSources[selectedSource] || locationSources.default;

    // Try to use the input field values first (what the user is typing)
    const inputLat = parseFloat(latitude);
    const inputLon = parseFloat(longitude);
    const inputElev = parseInt(elevation) || (sourceData?.elevation ?? locality.elevation ?? 0);

    // Check if input coordinates are valid
    const inputValid = !isNaN(inputLat) && !isNaN(inputLon) &&
      inputLat >= -90 && inputLat <= 90 &&
      inputLon >= -180 && inputLon <= 180;

    // Use input values if valid, otherwise fall back to selected source
    const lat = inputValid ? inputLat : (sourceData?.latitude ?? locality.latitude ?? 0);
    const lon = inputValid ? inputLon : (sourceData?.longitude ?? locality.longitude ?? 0);
    const elev = inputValid ? inputElev : (sourceData?.elevation ?? locality.elevation ?? 0);

    // Check if final coordinates are valid
    const isValid = lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

    return {
      type: 'locality' as const,
      id: locality.id,
      name: locality.name,
      latitude: isValid ? lat : 0,
      longitude: isValid ? lon : 0,
      elevation: elev,
      timezone: locality.timezone ?? '',
      isValid,
    };
  }, [locality, selectedSource, locationSources, latitude, longitude, elevation]);

  // Save mutation (create or update)
  const saveMutation = useDynamicMutation<PublisherLocationOverride, LocationOverrideCreateRequest>(
    () => existingOverride
      ? `/publisher/location-overrides/${existingOverride.id}`
      : `/publisher/localities/${locality.id}/override`,
    existingOverride ? 'PUT' : 'POST',
    (vars) => vars,
    { invalidateKeys: ['publisher-location-overrides', 'publisher-zmanim'] }
  );

  // Delete mutation
  const deleteMutation = useDynamicMutation<void, void>(
    () => `/publisher/location-overrides/${existingOverride?.id}`,
    'DELETE',
    () => undefined,
    { invalidateKeys: ['publisher-location-overrides', 'publisher-zmanim'] }
  );

  const validateInputs = (): string | null => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const elev = parseInt(elevation);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return 'Latitude must be between -90 and 90 degrees';
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      return 'Longitude must be between -180 and 180 degrees';
    }
    if (isNaN(elev)) {
      return 'Elevation must be a valid integer';
    }
    return null;
  };

  // Check if override fields are filled with valid values
  const isOverrideValid = useMemo(() => {
    if (!latitude.trim() || !longitude.trim() || !elevation.trim()) {
      return false;
    }
    return validateInputs() === null;
  }, [latitude, longitude, elevation]);

  // Real-time validation error for display
  const validationError = useMemo(() => {
    // Don't show validation errors if fields are empty
    if (!latitude.trim() && !longitude.trim() && !elevation.trim()) {
      return null;
    }
    // Only show validation errors if at least one field has a value
    if (latitude.trim() || longitude.trim() || elevation.trim()) {
      return validateInputs();
    }
    return null;
  }, [latitude, longitude, elevation]);

  const handleSave = async () => {
    setError(null);

    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload: LocationOverrideCreateRequest = {
      override_latitude: parseFloat(latitude),
      override_longitude: parseFloat(longitude),
      override_elevation: parseInt(elevation),
      reason: reason.trim() || undefined,
    };

    saveMutation.mutate(payload, {
      onSuccess: () => {
        // Auto-select publisher override after saving
        setSelectedSource('publisher');
        onSuccess();
        onOpenChange(false);
      },
      onError: (err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save location override';
        setError(errorMessage);
      },
    });
  };

  const handleDeleteClick = () => {
    if (!existingOverride) return;
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (!existingOverride) return;

    setError(null);
    setShowDeleteConfirm(false);

    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        onSuccess();
        onOpenChange(false);
      },
      onError: (err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete location override';
        setError(errorMessage);
      },
    });
  };

  // Check if override fields are different from the selected source
  const isModified = useMemo(() => {
    // If fields are empty, not modified
    if (!latitude || !longitude || !elevation) return false;

    const sourceData = locationSources[selectedSource];
    if (!sourceData) return true;

    return (
      parseFloat(latitude) !== sourceData.latitude ||
      parseFloat(longitude) !== sourceData.longitude ||
      parseInt(elevation) !== sourceData.elevation
    );
  }, [selectedSource, locationSources, latitude, longitude, elevation]);

  // Prevent focus trap from causing re-renders
  const handleOpenAutoFocus = (e: Event) => {
    e.preventDefault();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={handleOpenAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>
            {existingOverride ? 'Update' : 'Create'} Location Override
          </DialogTitle>
          <DialogDescription>
            Override location data for {locality.name}, {locality.country} (applies only to your publisher)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Source Toggle Buttons - only show if there are multiple sources */}
          {(locationSources.public || existingOverride) && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Location Source</Label>
              <ToggleGroup
                type="single"
                value={selectedSource}
                onValueChange={handleSourceChange}
                className="justify-start"
              >
                <ToggleGroupItem
                  value="default"
                  variant="outline"
                  className={cn(
                    'flex items-center gap-2 px-4',
                    selectedSource === 'default' && 'bg-primary text-primary-foreground'
                  )}
                >
                  <Database className="h-4 w-4" />
                  <span>Default</span>
                </ToggleGroupItem>

                {locationSources.public && (
                  <ToggleGroupItem
                    value="public"
                    variant="outline"
                    className={cn(
                      'flex items-center gap-2 px-4',
                      selectedSource === 'public' && 'bg-blue-500 text-white'
                    )}
                  >
                    <Globe className="h-4 w-4" />
                    <span>Public Override</span>
                  </ToggleGroupItem>
                )}

                {existingOverride && (
                  <ToggleGroupItem
                    value="publisher"
                    variant="outline"
                    className={cn(
                      'flex items-center gap-2 px-4',
                      selectedSource === 'publisher' && 'bg-blue-500 text-white'
                    )}
                  >
                    <Building2 className="h-4 w-4" />
                    <span>Publisher Override</span>
                  </ToggleGroupItem>
                )}
              </ToggleGroup>
            </div>
          )}

          {/* Current Source Info */}
          <div className={cn(
            'rounded-lg border p-4',
            selectedSource === 'default' && 'border-blue-500/30 bg-blue-500/5',
            selectedSource === 'public' && 'border-blue-500/30 bg-blue-500/5',
            selectedSource === 'publisher' && 'border-blue-500/30 bg-blue-500/5'
          )}>
            <div className="flex items-center gap-2 mb-3">
              {selectedSource === 'default' && <Database className="h-4 w-4 text-blue-600" />}
              {selectedSource === 'public' && <Globe className="h-4 w-4 text-blue-600" />}
              {selectedSource === 'publisher' && <Building2 className="h-4 w-4 text-blue-600" />}
              <h4 className="font-medium text-sm">
                {selectedSource === 'default' && 'Default Database Location'}
                {selectedSource === 'public' && 'Public Override (Admin Corrected)'}
                {selectedSource === 'publisher' && (existingOverride ? 'Your Publisher Override' : 'Create New Override')}
              </h4>
              {isModified && selectedSource !== 'publisher' && (
                <span className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-600 dark:text-blue-400">
                  Modified
                </span>
              )}
            </div>

            {/* Coordinates Display */}
            <div className="grid grid-cols-3 gap-4 text-sm mb-4">
              <div>
                <div className="text-muted-foreground text-xs mb-1">Latitude</div>
                <div className="font-mono">{locationSources[selectedSource]?.latitude.toFixed(6) || '0.000000'}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-1">Longitude</div>
                <div className="font-mono">{locationSources[selectedSource]?.longitude.toFixed(6) || '0.000000'}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-1">Elevation</div>
                <div className="font-mono">{locationSources[selectedSource]?.elevation || 0}m</div>
              </div>
            </div>

            {/* Map Preview */}
            {currentMapLocation.isValid && (
              <LocationMapView
                location={{
                  type: currentMapLocation.type,
                  id: currentMapLocation.id,
                  name: currentMapLocation.name,
                  latitude: currentMapLocation.latitude,
                  longitude: currentMapLocation.longitude,
                  elevation: currentMapLocation.elevation,
                  timezone: currentMapLocation.timezone,
                }}
                height={200}
                className="rounded-md"
              />
            )}
          </div>

          {/* Override Fields - Always show */}
          <div className="space-y-4 pt-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4 text-blue-600" />
              <span>Publisher Override Coordinates</span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="0.0001"
                  min="-90"
                  max="90"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="-90 to 90"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="0.0001"
                  min="-180"
                  max="180"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="-180 to 180"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="elevation">Elevation (m)</Label>
                <Input
                  id="elevation"
                  type="number"
                  value={elevation}
                  onChange={(e) => setElevation(e.target.value)}
                  placeholder="Meters"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Using synagogue coordinates, more accurate elevation data"
                rows={2}
              />
            </div>
          </div>

          {/* Timezone (read-only) */}
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span>Timezone:</span>
            <span className="font-mono">{locality.timezone}</span>
          </div>

          {(error || validationError) && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error || validationError}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {existingOverride && (
            <Button
              variant="destructive"
              onClick={handleDeleteClick}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Override'}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending || deleteMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isOverrideValid || saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save Override'}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location Override?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your custom coordinates for {locality.name} and revert to the global locality data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Override
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
