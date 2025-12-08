'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useApi } from '@/lib/api-client';
import { City, PublisherLocationOverride, LocationOverrideCreateRequest } from '@/types/geography';

interface LocationOverrideDialogProps {
  city: City;
  existingOverride?: PublisherLocationOverride;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function LocationOverrideDialog({
  city,
  existingOverride,
  open,
  onOpenChange,
  onSuccess,
}: LocationOverrideDialogProps) {
  const api = useApi();

  // Initialize state with existing override or city defaults
  const [latitude, setLatitude] = useState<string>(
    existingOverride?.override_latitude?.toString() ?? city.latitude.toString()
  );
  const [longitude, setLongitude] = useState<string>(
    existingOverride?.override_longitude?.toString() ?? city.longitude.toString()
  );
  const [elevation, setElevation] = useState<string>(
    existingOverride?.override_elevation?.toString() ?? city.elevation?.toString() ?? '0'
  );
  const [reason, setReason] = useState<string>(existingOverride?.reason ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateInputs = (): string | null => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const elev = parseInt(elevation);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return 'Latitude must be between -90 and 90';
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      return 'Longitude must be between -180 and 180';
    }
    if (isNaN(elev)) {
      return 'Elevation must be a valid integer';
    }
    return null;
  };

  const handleSave = async () => {
    setError(null);

    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: LocationOverrideCreateRequest = {
        override_latitude: parseFloat(latitude),
        override_longitude: parseFloat(longitude),
        override_elevation: parseInt(elevation),
        reason: reason.trim() || undefined,
      };

      if (existingOverride) {
        // Update existing override
        await api.put(`/publisher/location-overrides/${existingOverride.id}`, {
          body: JSON.stringify(payload),
        });
      } else {
        // Create new override
        await api.post(`/publisher/locations/${city.id}/override`, {
          body: JSON.stringify(payload),
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save location override');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingOverride) return;

    if (!confirm('Are you sure you want to delete this override? This will revert to the global city data.')) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.delete(`/publisher/location-overrides/${existingOverride.id}`);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to delete location override');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {existingOverride ? 'Update' : 'Create'} Location Override
          </DialogTitle>
          <DialogDescription>
            Override location data for {city.name}, {city.country} (applies only to your publisher)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Global Data (Read-Only) */}
          <div className="rounded-md bg-muted p-4">
            <h4 className="font-medium text-sm mb-3">Global Data (Read-Only)</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Latitude:</div>
              <div>{city.latitude}</div>
              <div className="text-muted-foreground">Longitude:</div>
              <div>{city.longitude}</div>
              <div className="text-muted-foreground">Elevation:</div>
              <div>{city.elevation ?? 0}m</div>
              <div className="text-muted-foreground">Timezone:</div>
              <div>{city.timezone}</div>
            </div>
          </div>

          {/* Override Fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude">Override Latitude</Label>
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
                <Label htmlFor="longitude">Override Longitude</Label>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="elevation">Override Elevation (meters)</Label>
              <Input
                id="elevation"
                type="number"
                value={elevation}
                onChange={(e) => setElevation(e.target.value)}
                placeholder="Elevation in meters"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Using synagogue coordinates, more accurate elevation data"
                rows={3}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {existingOverride && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              Delete Override
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Override'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
