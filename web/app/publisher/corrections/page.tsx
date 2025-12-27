/**
 * @file page.tsx
 * @purpose Unified Location Corrections page - combines publisher overrides and correction requests
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓
 * @story Epic 12 - Location Corrections Consolidation
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePublisherContext } from '@/providers/PublisherContext';
import { useApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, FileText, CheckCircle2, XCircle, Clock, Settings, Trash2, Eye, ArrowLeft, Edit, Database, Globe, Building2, Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { LocalityPicker } from '@/components/shared/LocalityPicker';
import { LocationMapView } from '@/components/shared/LocationMapView';
import { LocationOverrideDialog } from '@/components/publisher/LocationOverrideDialog';
import { CorrectionRequestDialog } from '@/components/publisher/CorrectionRequestDialog';
import type { LocalitySelection, LocalitySearchResult } from '@/types/geography';

interface CorrectionRequest {
  id: number;
  locality_id: number;
  locality_name: string;
  country_name: string;
  requester_email: string;
  requester_name: string | null;
  proposed_latitude: number | null;
  proposed_longitude: number | null;
  proposed_elevation: number | null;
  correction_reason: string;
  evidence_urls: string[] | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CorrectionRequestsResponse {
  requests: CorrectionRequest[];
  total: number;
}

interface LocationOverride {
  id: number;
  locality_id: number;
  locality_name: string;
  country_name: string;
  override_latitude: number;
  override_longitude: number;
  override_elevation: number;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

interface LocationOverridesResponse {
  overrides: LocationOverride[];
  total: number;
}

export default function PublisherCorrectionsPage() {
  const api = useApi();
  const { selectedPublisher, isLoading: contextLoading } = usePublisherContext();

  // Data state
  const [overrides, setOverrides] = useState<LocationOverride[]>([]);
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [isLoadingOverrides, setIsLoadingOverrides] = useState(true);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View state
  const [selectedLocality, setSelectedLocality] = useState<LocalitySearchResult | null>(null);
  const [originalLocalityCoords, setOriginalLocalityCoords] = useState<{ latitude: number; longitude: number; elevation: number } | null>(null);
  const [loadingLocalityDetails, setLoadingLocalityDetails] = useState(false);
  const [selectedSource, setSelectedSource] = useState<'default' | 'public' | 'publisher' | 'request'>('default');

  // Dialog states
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CorrectionRequest | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteOverrideId, setDeleteOverrideId] = useState<number | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [editingOverride, setEditingOverride] = useState<LocationOverride | null>(null);
  const [deleteRequestId, setDeleteRequestId] = useState<number | null>(null);
  const [deleteRequestConfirmOpen, setDeleteRequestConfirmOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<CorrectionRequest | null>(null);

  const fetchOverrides = useCallback(async () => {
    if (!selectedPublisher) return;

    try {
      setIsLoadingOverrides(true);
      setError(null);

      const data = await api.get<LocationOverridesResponse>('/publisher/location-overrides');
      setOverrides(data.overrides || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load location overrides');
    } finally {
      setIsLoadingOverrides(false);
    }
  }, [api, selectedPublisher]);

  const fetchRequests = useCallback(async () => {
    if (!selectedPublisher) return;

    try {
      setIsLoadingRequests(true);
      setError(null);

      const data = await api.get<CorrectionRequestsResponse>('/auth/correction-requests');
      setRequests(data.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load correction requests');
    } finally {
      setIsLoadingRequests(false);
    }
  }, [api, selectedPublisher]);

  useEffect(() => {
    if (selectedPublisher) {
      fetchOverrides();
      fetchRequests();
    }
  }, [selectedPublisher, fetchOverrides, fetchRequests]);

  const handleDeleteOverride = async () => {
    if (!deleteOverrideId) return;

    try {
      await api.delete(`/publisher/location-overrides/${deleteOverrideId}`);
      await fetchOverrides();
      setDeleteConfirmOpen(false);
      setDeleteOverrideId(null);

      // If we're viewing this locality, close the view and return to list
      if (selectedLocality) {
        const deletedOverride = overrides.find(o => o.id === deleteOverrideId);
        if (deletedOverride && deletedOverride.locality_id === parseInt(selectedLocality.id)) {
          // Close the locality view and return to the corrections list
          setSelectedLocality(null);
          setEditingOverride(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete override');
    }
  };

  const handleViewDetails = (request: CorrectionRequest) => {
    setSelectedRequest(request);
    setDetailsDialogOpen(true);
  };

  const handleEditRequest = async (request: CorrectionRequest) => {
    // Fetch locality details for the request
    setLoadingLocalityDetails(true);
    try {
      const localityData = await api.get<LocalitySearchResult & {
        elevation_m?: number;
        coordinate_source_key?: string;
        elevation_source_key?: string;
      }>(`/localities/${request.locality_id}`);

      const locality = {
        ...localityData,
        elevation: localityData.elevation_m,
        coordinate_source: localityData.coordinate_source_key,
        elevation_source: localityData.elevation_source_key,
      };
      setSelectedLocality(locality);
      // Store original coordinates from API (non-admin coordinates)
      setOriginalLocalityCoords({
        latitude: locality.original_latitude ?? locality.latitude ?? 0,
        longitude: locality.original_longitude ?? locality.longitude ?? 0,
        elevation: locality.original_elevation_m ?? locality.elevation ?? 0,
      });
      setSelectedSource('request'); // Show the pending request
      setEditingRequest(request);
      setCorrectionDialogOpen(true);
    } catch (err) {
      console.error('Failed to fetch locality details:', err);
      setError('Failed to load locality details');
    } finally {
      setLoadingLocalityDetails(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!deleteRequestId) return;

    try {
      await api.delete(`/publisher/correction-requests/${deleteRequestId}`);
      await fetchRequests();
      setDeleteRequestConfirmOpen(false);
      setDeleteRequestId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete correction request');
    }
  };

  const handleSearchClick = () => {
    setSearchDialogOpen(true);
  };

  const handleLocalitySelect = async (selection: LocalitySelection | LocalitySelection[]) => {
    const selected = Array.isArray(selection) ? selection[0] : selection;
    if (!selected) return;

    // Close search dialog
    setSearchDialogOpen(false);

    // Fetch full locality details
    setLoadingLocalityDetails(true);
    try {
      const localityData = await api.get<LocalitySearchResult & {
        elevation_m?: number;
        coordinate_source_key?: string;
        elevation_source_key?: string;
      }>(`/localities/${selected.id}`);
      // Map elevation_m to elevation for consistency with LocalitySearchResult type
      const locality = {
        ...localityData,
        elevation: localityData.elevation_m,
        coordinate_source: localityData.coordinate_source_key,
        elevation_source: localityData.elevation_source_key,
      };
      setSelectedLocality(locality);
      // Store original coordinates from API (non-admin coordinates)
      setOriginalLocalityCoords({
        latitude: locality.original_latitude ?? locality.latitude ?? 0,
        longitude: locality.original_longitude ?? locality.longitude ?? 0,
        elevation: locality.original_elevation_m ?? locality.elevation ?? 0,
      });

      // Auto-select the best source to show
      // Priority: request > publisher > public > default
      const pendingRequest = requests.find(r => r.locality_id === parseInt(selected.id) && r.status === 'pending');
      const override = overrides.find(o => o.locality_id === parseInt(selected.id));
      const hasPublicOverride = locality.coordinate_source === 'admin' || locality.elevation_source === 'admin';

      if (pendingRequest) {
        setSelectedSource('request');
      } else if (override) {
        setSelectedSource('publisher');
      } else if (hasPublicOverride) {
        setSelectedSource('public');
      } else {
        setSelectedSource('default');
      }
    } catch (err) {
      console.error('Failed to fetch locality details:', err);
      setError('Failed to load locality details');
    } finally {
      setLoadingLocalityDetails(false);
    }
  };

  const handleEditOverride = async (override: LocationOverride) => {
    // Fetch locality details
    setLoadingLocalityDetails(true);
    try {
      const localityData = await api.get<LocalitySearchResult & {
        elevation_m?: number;
        coordinate_source_key?: string;
        elevation_source_key?: string;
      }>(`/localities/${override.locality_id}`);
      // Map elevation_m to elevation for consistency with LocalitySearchResult type
      const locality = {
        ...localityData,
        elevation: localityData.elevation_m,
        coordinate_source: localityData.coordinate_source_key,
        elevation_source: localityData.elevation_source_key,
      };
      setSelectedLocality(locality);
      // Store original coordinates from API (non-admin coordinates)
      setOriginalLocalityCoords({
        latitude: locality.original_latitude ?? locality.latitude ?? 0,
        longitude: locality.original_longitude ?? locality.longitude ?? 0,
        elevation: locality.original_elevation_m ?? locality.elevation ?? 0,
      });
      setSelectedSource('publisher'); // Show the publisher override
      setEditingOverride(override);
      setOverrideDialogOpen(true);
    } catch (err) {
      console.error('Failed to fetch locality details:', err);
      setError('Failed to load locality details');
    } finally {
      setLoadingLocalityDetails(false);
    }
  };

  const handleBackToList = () => {
    setSelectedLocality(null);
  };

  const handleCreateOverride = () => {
    setOverrideDialogOpen(true);
  };

  const handleRequestCorrection = () => {
    setCorrectionDialogOpen(true);
  };

  const handleOverrideSuccess = useCallback(async () => {
    setOverrideDialogOpen(false);
    setEditingOverride(null);

    // Fetch fresh overrides list
    await fetchOverrides();

    // Auto-select the publisher source to show the newly created/updated override
    setSelectedSource('publisher');

    // No need to update selectedLocality - it should remain as the original database coordinates
    // The locationSources will be recomputed with the new override from fetchOverrides()
  }, [fetchOverrides]);

  const handleCorrectionSuccess = useCallback(() => {
    fetchRequests();
    setCorrectionDialogOpen(false);
    // Auto-select the request source to show the newly submitted correction
    setSelectedSource('request');
  }, [fetchRequests]);

  // Stable callback for override dialog open state change
  const handleOverrideDialogOpenChange = useCallback((open: boolean) => {
    setOverrideDialogOpen(open);
    if (!open) {
      setEditingOverride(null);
    }
  }, []);

  // Stable callback for correction dialog open state change
  const handleCorrectionDialogOpenChange = useCallback((open: boolean) => {
    setCorrectionDialogOpen(open);
    if (!open) {
      setEditingRequest(null);
    }
  }, []);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { icon: React.ReactElement; label: string; className: string; tooltip: string }> = {
      pending: {
        icon: <Clock className="w-3 h-3 mr-1" />,
        label: 'Pending',
        className: 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        tooltip: 'Awaiting admin review'
      },
      approved: {
        icon: <CheckCircle2 className="w-3 h-3 mr-1" />,
        label: 'Approved',
        className: 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
        tooltip: 'Location correction has been approved and applied'
      },
      rejected: {
        icon: <XCircle className="w-3 h-3 mr-1" />,
        label: 'Rejected',
        className: 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
        tooltip: 'Location correction request was not approved'
      },
    };

    const config = statusConfig[status];
    if (!config) return <Badge variant="outline">{status}</Badge>;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={config.className}>
            {config.icon}
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{config.tooltip}</TooltipContent>
      </Tooltip>
    );
  };

  const getOverrideTypeBadge = (type: string) => {
    const typeConfig: Record<string, { className: string }> = {
      'Coordinates': {
        className: 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
      },
      'Elevation': {
        className: 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
      },
      'Both': {
        className: 'bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800'
      }
    };

    const config = typeConfig[type] || typeConfig['Both'];
    return <Badge variant="outline" className={config.className}>{type}</Badge>;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Memoize existing override and request to prevent unnecessary re-renders
  // IMPORTANT: This must be before any conditional returns to satisfy Rules of Hooks
  const existingOverride = useMemo(() => {
    if (!selectedLocality) return undefined;

    // If we're editing an override, use that
    if (editingOverride && editingOverride.locality_id === parseInt(selectedLocality.id)) {
      return {
        id: editingOverride.id,
        publisher_id: parseInt(selectedPublisher?.id || '0'),
        locality_id: editingOverride.locality_id,
        override_latitude: editingOverride.override_latitude,
        override_longitude: editingOverride.override_longitude,
        override_elevation: editingOverride.override_elevation,
        reason: editingOverride.reason || undefined,
        created_at: editingOverride.created_at,
        updated_at: editingOverride.updated_at,
      };
    }

    const override = overrides.find(o => o.locality_id === parseInt(selectedLocality.id));
    if (!override) return undefined;

    return {
      id: override.id,
      publisher_id: parseInt(selectedPublisher?.id || '0'),
      locality_id: override.locality_id,
      override_latitude: override.override_latitude,
      override_longitude: override.override_longitude,
      override_elevation: override.override_elevation,
      reason: override.reason || undefined,
      created_at: override.created_at,
      updated_at: override.updated_at,
    };
  }, [selectedLocality, overrides, selectedPublisher, editingOverride]);

  const existingRequest = useMemo(() => {
    if (!selectedLocality) return undefined;
    return requests.find(r => r.locality_id === parseInt(selectedLocality.id) && r.status === 'pending');
  }, [selectedLocality, requests]);

  // Compute available location sources for the selected locality
  const locationSources = useMemo(() => {
    if (!selectedLocality) return null;

    const sources: {
      default?: { latitude: number; longitude: number; elevation: number; label: string };
      public?: { latitude: number; longitude: number; elevation: number; label: string };
      publisher?: { latitude: number; longitude: number; elevation: number; label: string };
      request?: { latitude: number; longitude: number; elevation: number; label: string };
    } = {};

    // Always have default (original database values from when we first loaded the locality)
    // Use originalLocalityCoords if available, otherwise fall back to selectedLocality
    const defaultCoords = originalLocalityCoords || {
      latitude: selectedLocality.latitude ?? 0,
      longitude: selectedLocality.longitude ?? 0,
      elevation: selectedLocality.elevation ?? 0,
    };

    sources.default = {
      latitude: defaultCoords.latitude,
      longitude: defaultCoords.longitude,
      elevation: defaultCoords.elevation,
      label: 'Default Database Location',
    };

    // Check for public override (admin-corrected)
    if (selectedLocality.coordinate_source === 'admin' || selectedLocality.elevation_source === 'admin') {
      sources.public = {
        latitude: selectedLocality.latitude ?? 0,
        longitude: selectedLocality.longitude ?? 0,
        elevation: selectedLocality.elevation ?? 0,
        label: 'Public Override (Admin)',
      };
    }

    // Check for publisher override
    if (existingOverride) {
      sources.publisher = {
        latitude: existingOverride.override_latitude,
        longitude: existingOverride.override_longitude,
        elevation: existingOverride.override_elevation,
        label: 'Publisher Override',
      };
    }

    // Check for pending correction request
    if (existingRequest &&
        (existingRequest.proposed_latitude !== null ||
         existingRequest.proposed_longitude !== null ||
         existingRequest.proposed_elevation !== null)) {
      sources.request = {
        latitude: existingRequest.proposed_latitude ?? defaultCoords.latitude,
        longitude: existingRequest.proposed_longitude ?? defaultCoords.longitude,
        elevation: existingRequest.proposed_elevation ?? defaultCoords.elevation,
        label: 'Pending Request',
      };
    }

    return sources;
  }, [selectedLocality, originalLocalityCoords, existingOverride, existingRequest]);

  // Get the coordinates to display based on selected source
  const displayedCoordinates = useMemo(() => {
    if (!locationSources) return null;
    const source = locationSources[selectedSource];
    return source || locationSources.default;
  }, [locationSources, selectedSource]);

  const isLoading = contextLoading || isLoadingOverrides || isLoadingRequests;

  // Use a single return to prevent dialog remounting
  // Content is determined by state, but dialogs are always mounted
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="p-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
              <p className="mt-4 text-muted-foreground">Loading corrections...</p>
            </div>
          </div>
        </div>
      );
    }

    // If a locality is selected, show the action view
    if (selectedLocality) {
      return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <Button variant="ghost" onClick={handleBackToList} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Corrections
          </Button>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left Panel (40% - 2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Selected Location Details */}
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg">{selectedLocality.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedLocality.country} • Locality ID: {selectedLocality.id}
                      </p>
                    </div>

                    {/* Source Toggle Buttons */}
                    {locationSources && Object.keys(locationSources).length > 1 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Location Source</h4>
                        <ToggleGroup
                          type="single"
                          value={selectedSource}
                          onValueChange={(value) => value && setSelectedSource(value as typeof selectedSource)}
                          className="justify-start flex-wrap"
                        >
                          {locationSources.default && (
                            <ToggleGroupItem
                              value="default"
                              variant="outline"
                              className={cn(
                                'flex items-center gap-2 px-3',
                                selectedSource === 'default' && 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                              )}
                            >
                              <Database className="h-4 w-4" />
                              <span className="text-xs">Default</span>
                            </ToggleGroupItem>
                          )}

                          {locationSources.public && (
                            <ToggleGroupItem
                              value="public"
                              variant="outline"
                              className={cn(
                                'flex items-center gap-2 px-3',
                                selectedSource === 'public' && 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                              )}
                            >
                              <Globe className="h-4 w-4" />
                              <span className="text-xs">Public Override</span>
                            </ToggleGroupItem>
                          )}

                          {locationSources.publisher && (
                            <ToggleGroupItem
                              value="publisher"
                              variant="outline"
                              className={cn(
                                'flex items-center gap-2 px-3',
                                selectedSource === 'publisher' && 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600'
                              )}
                            >
                              <Building2 className="h-4 w-4" />
                              <span className="text-xs">Publisher Override</span>
                            </ToggleGroupItem>
                          )}

                          {locationSources.request && (
                            <ToggleGroupItem
                              value="request"
                              variant="outline"
                              className={cn(
                                'flex items-center gap-2 px-3',
                                selectedSource === 'request' && 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                              )}
                            >
                              <Clock className="h-4 w-4" />
                              <span className="text-xs">Pending Request</span>
                            </ToggleGroupItem>
                          )}
                        </ToggleGroup>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">{displayedCoordinates?.label || 'Current Data'}</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Latitude:</span>
                          <span className="font-mono">{displayedCoordinates?.latitude.toFixed(7) || selectedLocality.latitude}°</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Longitude:</span>
                          <span className="font-mono">{displayedCoordinates?.longitude.toFixed(7) || selectedLocality.longitude}°</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Elevation:</span>
                          <span className="font-mono">{displayedCoordinates?.elevation || selectedLocality.elevation || 0}m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Timezone:</span>
                          <span className="font-mono">{selectedLocality.timezone}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </CardContent>
              </Card>

              {/* Action Card 1: Override for My Publisher */}
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Settings className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold">Override for My Publisher</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Use different coordinates or elevation for YOUR publisher only
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Status: {existingOverride ? '✓ Override active' : 'No override set'}
                    </p>
                    <Button className="w-full" onClick={handleCreateOverride}>
                      {existingOverride ? 'Edit Override' : 'Create Override'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Action Card 2: Request Public Correction */}
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold">Request Public Correction</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Request a correction to the public database for all publishers
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Status: {existingRequest ? '⏳ Pending request' : 'No requests submitted'}
                    </p>
                    <Button className="w-full" onClick={handleRequestCorrection}>
                      Request Correction
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel (60% - 3 cols) - Map */}
            <div className="lg:col-span-3">
              <div className="sticky top-4">
                {displayedCoordinates && (
                  <LocationMapView
                    key={`map-${selectedLocality.id}-${selectedSource}-${displayedCoordinates.latitude.toFixed(6)}-${displayedCoordinates.longitude.toFixed(6)}`}
                    location={{
                      type: 'locality',
                      id: selectedLocality.id,
                      name: selectedLocality.name,
                      country_code: selectedLocality.country_code,
                      latitude: displayedCoordinates.latitude,
                      longitude: displayedCoordinates.longitude,
                      elevation: displayedCoordinates.elevation,
                      timezone: selectedLocality.timezone,
                    }}
                    height={600}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
      );
    }

    // MAIN VIEW (List of overrides and requests)
    return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Location Corrections</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Fix location data issues or override coordinates for your publisher
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <Button
            variant="outline"
            className="w-full justify-start text-left h-12 text-muted-foreground hover:text-foreground"
            onClick={handleSearchClick}
          >
            <Search className="w-4 h-4 mr-2" />
            Search for a location...
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Search any locality to create overrides or request corrections
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Section 1: My Publisher Overrides */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">My Publisher Overrides</h2>

          {overrides.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-8 sm:p-12 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                <Settings className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2">No Location Overrides</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-4 max-w-2xl mx-auto">
                Override coordinates or elevation for specific locations that only affect your publisher&apos;s zmanim calculations. The public database remains unchanged.
              </p>
              <div className="bg-primary/10 border-l-4 border-primary rounded p-4 text-left max-w-2xl mx-auto">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">When to use:</strong> Use this when the public data is correct for most publishers, but you need different values for your calculation methodology.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="w-[40%] px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Location
                      </th>
                      <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Type
                      </th>
                      <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Date
                      </th>
                      <th className="w-[10%] px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {overrides.map((override) => (
                      <tr key={override.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{override.locality_name}</div>
                          <div className="text-sm text-muted-foreground">{override.country_name}</div>
                        </td>
                        <td className="px-4 py-3">
                          {getOverrideTypeBadge('Both')}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800">
                            Active
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(override.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditOverride(override)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setDeleteOverrideId(override.id);
                                    setDeleteConfirmOpen(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: My Public Correction Requests */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">My Public Correction Requests</h2>

          {requests.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-8 sm:p-12 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2">No Correction Requests</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-4 max-w-2xl mx-auto">
                Request corrections to location coordinates or elevation in the public database. When approved, all publishers using this location will benefit from accurate data.
              </p>
              <div className="bg-primary/10 border-l-4 border-primary rounded p-4 text-left max-w-2xl mx-auto mb-4">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">When to use:</strong> Use this when you&apos;ve verified the coordinates or elevation are factually incorrect.
                </p>
              </div>
              <div className="flex items-center justify-center gap-4 text-sm">
                <span className="text-muted-foreground font-medium">Status Legend:</span>
                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                  🟡 Pending
                </Badge>
                <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800">
                  🟢 Approved
                </Badge>
                <Badge variant="outline" className="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800">
                  🔴 Rejected
                </Badge>
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="w-[40%] px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Location
                      </th>
                      <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Type
                      </th>
                      <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Date
                      </th>
                      <th className="w-[10%] px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {requests.map((request) => {
                      // Determine correction type badge
                      const hasCoords = request.proposed_latitude !== null || request.proposed_longitude !== null;
                      const hasElev = request.proposed_elevation !== null;
                      const correctionType = hasCoords && hasElev ? 'Both' : hasCoords ? 'Coordinates' : 'Elevation';

                      return (
                        <tr key={request.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="font-medium">{request.locality_name}</div>
                            <div className="text-sm text-muted-foreground">{request.country_name}</div>
                          </td>
                          <td className="px-4 py-3">
                            {getOverrideTypeBadge(correctionType)}
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(request.status)}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {formatDate(request.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {request.status === 'pending' ? (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleEditRequest(request)}
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => {
                                          setDeleteRequestId(request.id);
                                          setDeleteRequestConfirmOpen(true);
                                        }}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete</TooltipContent>
                                  </Tooltip>
                                </>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleViewDetails(request)}
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Delete Override Confirmation Dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Location Override?</AlertDialogTitle>
              <AlertDialogDescription>
                This will revert to using the public coordinates for this location. Your zmanim calculations will use the standard database values. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteOverrideId(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteOverride}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove Override
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Correction Request Confirmation Dialog */}
        <AlertDialog open={deleteRequestConfirmOpen} onOpenChange={setDeleteRequestConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Correction Request?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your pending correction request. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteRequestId(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteRequest}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Request
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Request Details Dialog */}
        {selectedRequest && (
          <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
            <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Location Correction Request Details</DialogTitle>
                <DialogDescription>
                  Location data correction for {selectedRequest.locality_name}, {selectedRequest.country_name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  {getStatusBadge(selectedRequest.status)}
                </div>

                {/* Map showing proposed location */}
                {selectedRequest.proposed_latitude !== null && selectedRequest.proposed_longitude !== null && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Proposed Location</h4>
                    <LocationMapView
                      location={{
                        type: 'locality',
                        id: selectedRequest.locality_id.toString(),
                        name: selectedRequest.locality_name,
                        country_code: selectedRequest.country_name,
                        latitude: selectedRequest.proposed_latitude,
                        longitude: selectedRequest.proposed_longitude,
                        elevation: selectedRequest.proposed_elevation ?? undefined,
                        timezone: '',
                      }}
                      height={400}
                    />
                  </div>
                )}

                <div>
                  <h4 className="font-medium text-sm mb-2">Proposed Changes</h4>
                  <div className="rounded-md bg-muted p-3 space-y-1 text-sm">
                    {selectedRequest.proposed_latitude !== null && (
                      <div>Latitude: {selectedRequest.proposed_latitude}</div>
                    )}
                    {selectedRequest.proposed_longitude !== null && (
                      <div>Longitude: {selectedRequest.proposed_longitude}</div>
                    )}
                    {selectedRequest.proposed_elevation !== null && (
                      <div>Elevation: {selectedRequest.proposed_elevation}m</div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">Reason</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedRequest.correction_reason}
                  </p>
                </div>

                {selectedRequest.evidence_urls && selectedRequest.evidence_urls.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Evidence URLs</h4>
                    <ul className="space-y-1">
                      {selectedRequest.evidence_urls.map((url, idx) => (
                        <li key={idx}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedRequest.review_notes && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Admin Review Notes</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedRequest.review_notes}
                    </p>
                  </div>
                )}

                {selectedRequest.reviewed_at && (
                  <div className="text-sm text-muted-foreground">
                    Reviewed on {formatDate(selectedRequest.reviewed_at)}
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  Submitted on {formatDate(selectedRequest.created_at)}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Search Dialog */}
        <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Search Location</DialogTitle>
              <DialogDescription className="text-sm sm:text-base">
                Search for any location to create overrides or request corrections
              </DialogDescription>
            </DialogHeader>

            <LocalityPicker
              mode="single"
              types={['locality', 'town', 'village', 'hamlet', 'neighborhood', 'borough']}
              showTypeFilters={false}
              showQuickSelect={true}
              inlineResults={true}
              placeholder="Search localities, towns, neighborhoods..."
              onSelect={handleLocalitySelect}
            />

            {loadingLocalityDetails && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Loading location details...</span>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </div>
    );
  };

  // Single return with content + dialogs always mounted (controlled by open prop)
  return (
    <>
      {renderContent()}

      {/* LocationOverrideDialog - always mounted, controlled by open prop */}
      {selectedLocality && (
        <LocationOverrideDialog
          locality={selectedLocality}
          existingOverride={existingOverride}
          originalCoordinates={originalLocalityCoords ?? undefined}
          open={overrideDialogOpen}
          onOpenChange={handleOverrideDialogOpenChange}
          onSuccess={handleOverrideSuccess}
        />
      )}

      {/* CorrectionRequestDialog - always mounted, controlled by open prop */}
      {selectedLocality && (
        <CorrectionRequestDialog
          locality={selectedLocality}
          existingRequest={editingRequest ? {
            id: editingRequest.id,
            proposed_latitude: editingRequest.proposed_latitude,
            proposed_longitude: editingRequest.proposed_longitude,
            proposed_elevation: editingRequest.proposed_elevation,
            correction_reason: editingRequest.correction_reason,
            evidence_urls: editingRequest.evidence_urls,
          } : undefined}
          open={correctionDialogOpen}
          onOpenChange={handleCorrectionDialogOpenChange}
          onSuccess={handleCorrectionSuccess}
        />
      )}
    </>
  );
}
