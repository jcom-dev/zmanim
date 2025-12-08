/**
 * @file CorrectionRequestDialog.tsx
 * @purpose Dialog for publishers to request public corrections to city data
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓
 * @story 6.5 - Public Correction Requests
 */

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
import { City } from '@/types/geography';
import { Plus, X } from 'lucide-react';

interface CorrectionRequestDialogProps {
  city: City;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CorrectionRequestDialog({
  city,
  open,
  onOpenChange,
  onSuccess,
}: CorrectionRequestDialogProps) {
  const api = useApi();

  // Initialize proposed values as empty strings (not pre-filled with current values)
  const [proposedLatitude, setProposedLatitude] = useState<string>('');
  const [proposedLongitude, setProposedLongitude] = useState<string>('');
  const [proposedElevation, setProposedElevation] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateInputs = (): string | null => {
    // At least one proposed value must be provided
    const hasAtLeastOne =
      proposedLatitude.trim() !== '' ||
      proposedLongitude.trim() !== '' ||
      proposedElevation.trim() !== '';

    if (!hasAtLeastOne) {
      return 'At least one proposed value must be provided';
    }

    // Validate latitude if provided
    if (proposedLatitude.trim() !== '') {
      const lat = parseFloat(proposedLatitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return 'Latitude must be between -90 and 90';
      }
    }

    // Validate longitude if provided
    if (proposedLongitude.trim() !== '') {
      const lon = parseFloat(proposedLongitude);
      if (isNaN(lon) || lon < -180 || lon > 180) {
        return 'Longitude must be between -180 and 180';
      }
    }

    // Validate elevation if provided
    if (proposedElevation.trim() !== '') {
      const elev = parseInt(proposedElevation);
      if (isNaN(elev)) {
        return 'Elevation must be a valid integer';
      }
    }

    // Reason is required and must be at least 20 characters
    if (reason.trim().length < 20) {
      return 'Reason must be at least 20 characters';
    }

    // Validate evidence URLs if provided
    const nonEmptyUrls = evidenceUrls.filter((url) => url.trim() !== '');
    for (const url of nonEmptyUrls) {
      try {
        new URL(url);
      } catch {
        return `Invalid URL: ${url}`;
      }
    }

    return null;
  };

  const handleAddEvidenceUrl = () => {
    setEvidenceUrls([...evidenceUrls, '']);
  };

  const handleRemoveEvidenceUrl = (index: number) => {
    setEvidenceUrls(evidenceUrls.filter((_, i) => i !== index));
  };

  const handleEvidenceUrlChange = (index: number, value: string) => {
    const newUrls = [...evidenceUrls];
    newUrls[index] = value;
    setEvidenceUrls(newUrls);
  };

  const handleSubmit = async () => {
    setError(null);

    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: {
        city_id: number;
        proposed_latitude?: number;
        proposed_longitude?: number;
        proposed_elevation?: number;
        correction_reason: string;
        evidence_urls?: string[];
      } = {
        city_id: parseInt(city.id),
        correction_reason: reason.trim(),
      };

      // Only include proposed values that are not empty
      if (proposedLatitude.trim() !== '') {
        payload.proposed_latitude = parseFloat(proposedLatitude);
      }
      if (proposedLongitude.trim() !== '') {
        payload.proposed_longitude = parseFloat(proposedLongitude);
      }
      if (proposedElevation.trim() !== '') {
        payload.proposed_elevation = parseInt(proposedElevation);
      }

      // Only include non-empty evidence URLs
      const nonEmptyUrls = evidenceUrls.filter((url) => url.trim() !== '');
      if (nonEmptyUrls.length > 0) {
        payload.evidence_urls = nonEmptyUrls;
      }

      await api.post('/publisher/correction-requests', {
        body: JSON.stringify(payload),
      });

      onSuccess();
      onOpenChange(false);

      // Reset form
      setProposedLatitude('');
      setProposedLongitude('');
      setProposedElevation('');
      setReason('');
      setEvidenceUrls(['']);
    } catch (err: any) {
      setError(err.message || 'Failed to submit correction request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Public Correction</DialogTitle>
          <DialogDescription>
            Request a correction to global city data for {city.name}, {city.country}.
            This will affect all users if approved by admin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Data (Read-Only) */}
          <div className="rounded-md bg-muted p-4">
            <h4 className="font-medium text-sm mb-3">Current Global Data (Read-Only)</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Latitude:</div>
              <div>{city.latitude}</div>
              <div className="text-muted-foreground">Longitude:</div>
              <div>{city.longitude}</div>
              <div className="text-muted-foreground">Elevation:</div>
              <div>{city.elevation ?? 0}m</div>
            </div>
          </div>

          {/* Proposed Values */}
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Provide at least one proposed correction. Leave fields empty if no change needed.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proposed_latitude">Proposed Latitude</Label>
                <Input
                  id="proposed_latitude"
                  type="number"
                  step="0.0001"
                  min="-90"
                  max="90"
                  value={proposedLatitude}
                  onChange={(e) => setProposedLatitude(e.target.value)}
                  placeholder="-90 to 90"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="proposed_longitude">Proposed Longitude</Label>
                <Input
                  id="proposed_longitude"
                  type="number"
                  step="0.0001"
                  min="-180"
                  max="180"
                  value={proposedLongitude}
                  onChange={(e) => setProposedLongitude(e.target.value)}
                  placeholder="-180 to 180"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="proposed_elevation">Proposed Elevation (meters)</Label>
              <Input
                id="proposed_elevation"
                type="number"
                value={proposedElevation}
                onChange={(e) => setProposedElevation(e.target.value)}
                placeholder="Elevation in meters"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason (required, min 20 characters)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this correction is needed and how you verified the correct data..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {reason.trim().length}/20 characters minimum
              </p>
            </div>

            <div className="space-y-2">
              <Label>Evidence URLs (optional)</Label>
              {evidenceUrls.map((url, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    type="url"
                    value={url}
                    onChange={(e) => handleEvidenceUrlChange(index, e.target.value)}
                    placeholder="https://example.com/evidence"
                  />
                  {evidenceUrls.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEvidenceUrl(index)}
                      className="text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddEvidenceUrl}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Evidence URL
              </Button>
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
