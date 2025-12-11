/**
 * @file AdminCityEditDialog.tsx
 * @purpose Dialog for admin to directly edit city data
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓
 * @story 6.5 - Public Correction Requests
 */

'use client';

import { useState, useEffect } from 'react';
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
import { useAdminApi } from '@/lib/api-client';
import { City } from '@/types/geography';
import { AlertCircle } from 'lucide-react';

interface AdminCityEditDialogProps {
  city: City;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AdminCityEditDialog({
  city,
  open,
  onOpenChange,
  onSuccess,
}: AdminCityEditDialogProps) {
  const api = useAdminApi();

  // Initialize with current city values
  const [latitude, setLatitude] = useState<string>(city.latitude.toString());
  const [longitude, setLongitude] = useState<string>(city.longitude.toString());
  const [elevation, setElevation] = useState<string>(city.elevation?.toString() ?? '0');
  const [timezone, setTimezone] = useState<string>(city.timezone);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens with new city
  useEffect(() => {
    if (open) {
      setLatitude(city.latitude.toString());
      setLongitude(city.longitude.toString());
      setElevation(city.elevation?.toString() ?? '0');
      setTimezone(city.timezone);
      setError(null);
    }
  }, [open, city]);

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
    if (!timezone.trim()) {
      return 'Timezone is required';
    }
    return null;
  };

  const hasChanges = (): boolean => {
    return (
      parseFloat(latitude) !== city.latitude ||
      parseFloat(longitude) !== city.longitude ||
      parseInt(elevation) !== (city.elevation ?? 0) ||
      timezone !== city.timezone
    );
  };

  const handleSave = async () => {
    setError(null);

    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!hasChanges()) {
      setError('No changes detected');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: {
        latitude?: number;
        longitude?: number;
        elevation?: number;
        timezone?: string;
      } = {};

      // Only include changed values
      if (parseFloat(latitude) !== city.latitude) {
        payload.latitude = parseFloat(latitude);
      }
      if (parseFloat(longitude) !== city.longitude) {
        payload.longitude = parseFloat(longitude);
      }
      if (parseInt(elevation) !== (city.elevation ?? 0)) {
        payload.elevation = parseInt(elevation);
      }
      if (timezone !== city.timezone) {
        payload.timezone = timezone;
      }

      await api.put(`/admin/cities/${city.id}`, {
        body: JSON.stringify(payload),
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update city data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit City Data</DialogTitle>
          <DialogDescription>
            Directly update global city data for {city.name}, {city.country}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Notice */}
          <div className="rounded-md bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-3">
            <div className="flex gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                This will immediately update the global city data and affect all users and publishers.
              </p>
            </div>
          </div>

          {/* Edit Fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="elevation">Elevation (meters)</Label>
              <Input
                id="elevation"
                type="number"
                value={elevation}
                onChange={(e) => setElevation(e.target.value)}
                placeholder="Elevation in meters"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="America/New_York"
              />
              <p className="text-xs text-muted-foreground">
                IANA timezone identifier (e.g., America/New_York, Europe/London)
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting || !hasChanges()}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
