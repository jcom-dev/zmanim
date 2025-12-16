/**
 * @file CorrectionRequestDialog.tsx
 * @purpose Dialog for publishers to request public corrections to locality data
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
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useApi } from '@/lib/api-client';
import { LocalitySearchResult } from '@/types/geography';
import { Plus, X, AlertTriangle } from 'lucide-react';
import { LocationMapView } from '@/components/shared/LocationMapView';
import { useMemo } from 'react';

interface ExistingRequest {
  id: number;
  proposed_latitude: number | null;
  proposed_longitude: number | null;
  proposed_elevation: number | null;
  correction_reason: string;
  evidence_urls: string[] | null;
}

interface DuplicateRequest {
  id: number;
  status: 'pending' | 'approved';
  publisher_name: string | null;
  created_at: string;
  approved_at: string | null;
}

interface CorrectionRequestDialogProps {
  locality: LocalitySearchResult;
  /** Existing request to edit (if editing mode) */
  existingRequest?: ExistingRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CorrectionRequestDialog({
  locality,
  existingRequest,
  open,
  onOpenChange,
  onSuccess,
}: CorrectionRequestDialogProps) {
  const api = useApi();
  const isEditMode = !!existingRequest;

  // Initialize proposed values - pre-fill if editing
  const [proposedLatitude, setProposedLatitude] = useState<string>('');
  const [proposedLongitude, setProposedLongitude] = useState<string>('');
  const [proposedElevation, setProposedElevation] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateRequest[]>([]);
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);

  // Reset form when dialog opens or existingRequest changes
  useEffect(() => {
    if (open) {
      if (existingRequest) {
        setProposedLatitude(existingRequest.proposed_latitude?.toString() ?? '');
        setProposedLongitude(existingRequest.proposed_longitude?.toString() ?? '');
        setProposedElevation(existingRequest.proposed_elevation?.toString() ?? '');
        setReason(existingRequest.correction_reason ?? '');
        setEvidenceUrls(existingRequest.evidence_urls?.length ? existingRequest.evidence_urls : ['']);
      } else {
        setProposedLatitude('');
        setProposedLongitude('');
        setProposedElevation('');
        setReason('');
        setEvidenceUrls(['']);
      }
      setError(null);

      // Check for duplicate requests when dialog opens
      if (locality?.id) {
        setIsLoadingDuplicates(true);
        api.get(`/publisher/correction-requests/check-duplicates?locality_id=${locality.id}`)
          .then((response) => {
            setDuplicates(response as DuplicateRequest[]);
          })
          .catch((err) => {
            console.error('Failed to check for duplicate requests:', err);
            setDuplicates([]);
          })
          .finally(() => {
            setIsLoadingDuplicates(false);
          });
      }
    }
  }, [open, existingRequest, locality?.id, api]);

  // Get the proposed location for map preview
  // Return null if coordinates are invalid to prevent Mapbox errors
  const proposedMapLocation = useMemo(() => {
    const lat = proposedLatitude.trim() !== '' ? parseFloat(proposedLatitude) : (locality.latitude ?? 0);
    const lng = proposedLongitude.trim() !== '' ? parseFloat(proposedLongitude) : (locality.longitude ?? 0);
    const elev = proposedElevation.trim() !== '' ? parseInt(proposedElevation) : (locality.elevation ?? 0);

    // Validate coordinates before passing to map
    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      return null;
    }

    return {
      type: 'locality' as const,
      id: locality.id,
      name: `${locality.name} (Proposed)`,
      latitude: lat,
      longitude: lng,
      elevation: elev,
      timezone: locality.timezone ?? '',
    };
  }, [locality, proposedLatitude, proposedLongitude, proposedElevation]);

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
        return 'Latitude must be between -90 and 90 degrees';
      }
    }

    // Validate longitude if provided
    if (proposedLongitude.trim() !== '') {
      const lon = parseFloat(proposedLongitude);
      if (isNaN(lon) || lon < -180 || lon > 180) {
        return 'Longitude must be between -180 and 180 degrees';
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

  // Real-time validation for coordinate fields only (don't validate reason or URLs yet)
  const coordinateValidationError = useMemo(() => {
    // Validate latitude if provided
    if (proposedLatitude.trim() !== '') {
      const lat = parseFloat(proposedLatitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return 'Latitude must be between -90 and 90 degrees';
      }
    }

    // Validate longitude if provided
    if (proposedLongitude.trim() !== '') {
      const lon = parseFloat(proposedLongitude);
      if (isNaN(lon) || lon < -180 || lon > 180) {
        return 'Longitude must be between -180 and 180 degrees';
      }
    }

    // Validate elevation if provided
    if (proposedElevation.trim() !== '') {
      const elev = parseInt(proposedElevation);
      if (isNaN(elev)) {
        return 'Elevation must be a valid integer';
      }
    }

    return null;
  }, [proposedLatitude, proposedLongitude, proposedElevation]);

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
        locality_id: number;
        proposed_latitude?: number;
        proposed_longitude?: number;
        proposed_elevation?: number;
        correction_reason: string;
        evidence_urls?: string[];
      } = {
        locality_id: parseInt(locality.id),
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

      if (isEditMode && existingRequest) {
        await api.put(`/publisher/correction-requests/${existingRequest.id}`, {
          body: JSON.stringify(payload),
        });
      } else {
        await api.post('/publisher/correction-requests', {
          body: JSON.stringify(payload),
        });
      }

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
          <DialogTitle>{isEditMode ? 'Edit Correction Request' : 'Request Public Correction'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? `Update your correction request for ${locality.name}, ${locality.country}.`
              : `Request a correction to global locality data for ${locality.name}, ${locality.country}. This will affect all users if approved by admin.`}
          </DialogDescription>
        </DialogHeader>

        {/* Duplicate Request Warning Banner */}
        {duplicates.length > 0 && !isLoadingDuplicates && (
          <Alert className="mb-4 border-amber-500/50 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle>Existing Requests Found</AlertTitle>
            <AlertDescription>
              There {duplicates.filter(d => d.status === 'pending').length === 1 ? 'is' : 'are'}{' '}
              {duplicates.filter(d => d.status === 'pending').length} pending request(s)
              for this locality from other publishers.
              {duplicates.some(d => d.status === 'approved') && (
                <> The most recent approved correction was applied on{' '}
                {new Date(duplicates.find(d => d.status === 'approved')?.approved_at || '').toLocaleDateString()}.
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-4">
          {/* Map Preview */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Location Preview</h4>
            {proposedMapLocation ? (
              <LocationMapView
                location={proposedMapLocation}
                height={180}
                className="rounded-md"
              />
            ) : (
              <div className="rounded-md bg-muted h-[180px] flex items-center justify-center text-sm text-muted-foreground">
                Invalid coordinates - map cannot be displayed
              </div>
            )}
          </div>

          {/* Current vs Proposed in side-by-side grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Current Data (Read-Only) */}
            <div className="rounded-md bg-muted p-3">
              <h4 className="font-medium text-xs mb-2 text-muted-foreground uppercase">Current</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lat:</span>
                  <span className="font-mono">{locality.latitude}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lng:</span>
                  <span className="font-mono">{locality.longitude}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Elev:</span>
                  <span className="font-mono">{locality.elevation ?? 0}m</span>
                </div>
              </div>
            </div>

            {/* Proposed Values */}
            <div className="rounded-md bg-primary/10 border border-primary/20 p-3">
              <h4 className="font-medium text-xs mb-2 text-primary uppercase">Proposed</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lat:</span>
                  <span className="font-mono">{proposedLatitude || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lng:</span>
                  <span className="font-mono">{proposedLongitude || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Elev:</span>
                  <span className="font-mono">{proposedElevation ? `${proposedElevation}m` : '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Coordinate Inputs */}
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the corrected values. Leave fields empty if no change needed.
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="proposed_latitude">Latitude</Label>
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
                <Label htmlFor="proposed_longitude">Longitude</Label>
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

              <div className="space-y-2">
                <Label htmlFor="proposed_elevation">Elevation (m)</Label>
                <Input
                  id="proposed_elevation"
                  type="number"
                  value={proposedElevation}
                  onChange={(e) => setProposedElevation(e.target.value)}
                  placeholder="Meters"
                />
              </div>
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

          {(error || coordinateValidationError) && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error || coordinateValidationError}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? (isEditMode ? 'Saving...' : 'Submitting...')
              : (isEditMode ? 'Save Changes' : 'Submit Request')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
