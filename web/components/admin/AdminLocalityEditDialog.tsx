/**
 * @file AdminLocalityEditDialog.tsx
 * @purpose Dialog for admin to directly edit locality data
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
import { LocalitySearchResult } from '@/types/geography';
import { AlertCircle } from 'lucide-react';

interface AdminLocalityEditDialogProps {
  locality: LocalitySearchResult;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AdminLocalityEditDialog({
  locality,
  open,
  onOpenChange,
  onSuccess,
}: AdminLocalityEditDialogProps) {
  const api = useAdminApi();

  // Initialize with current locality values
  const [latitude, setLatitude] = useState<string>(locality.latitude?.toString() ?? '0');
  const [longitude, setLongitude] = useState<string>(locality.longitude?.toString() ?? '0');
  const [elevation, setElevation] = useState<string>('0');
  const [timezone, setTimezone] = useState<string>(locality.timezone ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens with new locality
  useEffect(() => {
    if (open) {
      setLatitude(locality.latitude?.toString() ?? '0');
      setLongitude(locality.longitude?.toString() ?? '0');
      setElevation('0');
      setTimezone(locality.timezone ?? '');
      setError(null);
    }
  }, [open, locality]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const parsedLat = parseFloat(latitude);
      const parsedLng = parseFloat(longitude);
      const parsedElev = parseFloat(elevation);

      if (isNaN(parsedLat) || isNaN(parsedLng) || isNaN(parsedElev)) {
        throw new Error('Invalid number format');
      }

      if (parsedLat < -90 || parsedLat > 90) {
        throw new Error('Latitude must be between -90 and 90');
      }

      if (parsedLng < -180 || parsedLng > 180) {
        throw new Error('Longitude must be between -180 and 180');
      }

      if (!timezone.trim()) {
        throw new Error('Timezone is required');
      }

      await api.put(`/admin/localities/${locality.id}`, {
        body: JSON.stringify({
          latitude: parsedLat,
          longitude: parsedLng,
          elevation: parsedElev,
          timezone: timezone.trim(),
        }),
      });

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update locality');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Locality Data</DialogTitle>
          <DialogDescription>
            Directly edit global data for {locality.name}. This will affect all users and publishers.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive rounded-md p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="elevation">Elevation (meters)</Label>
              <Input
                id="elevation"
                type="number"
                step="any"
                value={elevation}
                onChange={(e) => setElevation(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. America/New_York"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
