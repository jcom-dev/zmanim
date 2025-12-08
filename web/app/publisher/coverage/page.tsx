/**
 * @file page.tsx
 * @purpose Publisher coverage management - search-first approach
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓ IDs-only:✓
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePublisherContext } from '@/providers/PublisherContext';
import { MapPin, Globe, Building2, Plus, Trash2, Loader2, Mountain, Map, Layers, EyeOff, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useApi } from '@/lib/api-client';
import { getCoverageBadgeClasses } from '@/lib/wcag-colors';
import { InfoTooltip, StatusTooltip } from '@/components/shared/InfoTooltip';
import { COVERAGE_TOOLTIPS, STATUS_TOOLTIPS } from '@/lib/tooltip-content';
import type { LocationSelection, PublisherLocationOverride, LocationOverridesListResponse, City } from '@/types/geography';
import { CoverageSearchPanel } from '@/components/shared/CoverageSearchPanel';
import { CoveragePreviewMap } from '@/components/shared/CoveragePreviewMap';
import { LocationOverrideDialog } from '@/components/publisher/LocationOverrideDialog';
import { LocationMapView } from '@/components/shared/LocationMapView';
import { CorrectionRequestDialog } from '@/components/publisher/CorrectionRequestDialog';

interface Coverage {
  id: string;
  publisher_id: string;
  coverage_level_id: number;
  coverage_level_key: 'continent' | 'country' | 'region' | 'district' | 'city';
  // ID-based fields (new schema)
  continent_id: number | null;
  country_id: number | null;
  region_id: number | null;
  district_id: number | null;
  city_id: number | null;
  // Display fields from joined geo tables
  continent_name: string | null;
  country_code: string | null;
  country_name: string | null;
  region_code: string | null;
  region_name: string | null;
  district_code: string | null;
  district_name: string | null;
  city_name: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function PublisherCoveragePage() {
  const api = useApi();
  const { selectedPublisher, isLoading: contextLoading } = usePublisherContext();

  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [addingCoverage, setAddingCoverage] = useState(false);

  // Location override state (Story 6.4)
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [selectedCityForOverride, setSelectedCityForOverride] = useState<City | null>(null);
  const [locationOverrides, setLocationOverrides] = useState<PublisherLocationOverride[]>([]);
  const [loadingCityDetails, setLoadingCityDetails] = useState(false);

  // Correction request state (Story 6.5)
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [selectedCityForCorrection, setSelectedCityForCorrection] = useState<City | null>(null);

  // Selected coverage item for map view (AC-6.4.8)
  const [selectedCoverageForMap, setSelectedCoverageForMap] = useState<Coverage | null>(null);

  const fetchCoverage = useCallback(async () => {
    if (!selectedPublisher) return;

    try {
      setIsLoading(true);
      setError(null);

      const data = await api.get<{ coverage: Coverage[] }>('/publisher/coverage');
      setCoverage(data.coverage || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load coverage');
    } finally {
      setIsLoading(false);
    }
  }, [api, selectedPublisher]);

  const fetchLocationOverrides = useCallback(async () => {
    if (!selectedPublisher) return;

    try {
      const data = await api.get<LocationOverridesListResponse>('/publisher/location-overrides');
      setLocationOverrides(data.overrides || []);
    } catch (err) {
      console.error('Failed to fetch location overrides:', err);
    }
  }, [api, selectedPublisher]);

  useEffect(() => {
    if (selectedPublisher) {
      fetchCoverage();
      fetchLocationOverrides();
    }
  }, [selectedPublisher, fetchCoverage, fetchLocationOverrides]);

  const handleOpenAddDialog = () => {
    setAddDialogOpen(true);
  };

  const handleCloseAddDialog = () => {
    setAddDialogOpen(false);
  };

  // Handle adding coverage from the search panel
  const handleAddCoverage = async (selections: LocationSelection[]) => {
    if (!selectedPublisher || selections.length === 0) return;

    try {
      setAddingCoverage(true);
      setError(null);

      for (const item of selections) {
        const body: Record<string, unknown> = { coverage_level: item.type };

        if (item.type === 'continent') {
          // Continent uses code, not ID
          body.continent_code = item.id;
        } else if (item.type === 'country') {
          body.country_id = parseInt(item.id, 10);
        } else if (item.type === 'region') {
          body.region_id = parseInt(item.id, 10);
        } else if (item.type === 'district') {
          body.district_id = parseInt(item.id, 10);
        } else if (item.type === 'city') {
          body.city_id = parseInt(item.id, 10);
        }

        await api.post('/publisher/coverage', {
          body: JSON.stringify(body),
        });
      }

      await fetchCoverage();
      handleCloseAddDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add coverage');
    } finally {
      setAddingCoverage(false);
    }
  };

  const handleDeleteCoverage = async (coverageId: string) => {
    if (!selectedPublisher) return;

    try {
      await api.delete(`/publisher/coverage/${coverageId}`);
      await fetchCoverage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete coverage');
    }
  };

  const handleToggleActive = async (coverageItem: Coverage) => {
    if (!selectedPublisher) return;

    try {
      await api.put(`/publisher/coverage/${coverageItem.id}`, {
        body: JSON.stringify({ is_active: !coverageItem.is_active }),
      });
      await fetchCoverage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update coverage');
    }
  };

  // Location override handlers (Story 6.4)
  const handleOpenOverrideDialog = async (cityItem: Coverage) => {
    if (!cityItem.city_id) return;

    setLoadingCityDetails(true);
    try {
      const cityData = await api.get<City>(`/cities/${cityItem.city_id}`);
      setSelectedCityForOverride(cityData);
      setOverrideDialogOpen(true);
    } catch (err) {
      console.error('Failed to fetch city details:', err);
      setError('Failed to load city details');
    } finally {
      setLoadingCityDetails(false);
    }
  };

  const handleOverrideSuccess = () => {
    fetchLocationOverrides();
  };

  // Convert coverage item to LocationSelection for map view
  const coverageToLocationSelection = (item: Coverage): LocationSelection | null => {
    if (item.coverage_level_key === 'city' && item.city_id) {
      return {
        type: 'city',
        id: item.city_id.toString(),
        name: item.city_name || '',
        country_code: item.country_code || undefined,
        // Note: coordinates not available in Coverage, need to fetch separately
        // For now, return without coordinates - LocationMapView will handle the fetch
      };
    } else if (item.coverage_level_key === 'country' && item.country_id) {
      return {
        type: 'country',
        id: item.country_id.toString(),
        name: item.country_name || '',
        country_code: item.country_code || undefined,
      };
    } else if (item.coverage_level_key === 'region' && item.region_id) {
      return {
        type: 'region',
        id: item.region_id.toString(),
        name: item.region_name || '',
        country_code: item.country_code || undefined,
      };
    } else if (item.coverage_level_key === 'district' && item.district_id) {
      return {
        type: 'district',
        id: item.district_id.toString(),
        name: item.district_name || '',
        country_code: item.country_code || undefined,
      };
    } else if (item.coverage_level_key === 'continent' && item.continent_id) {
      return {
        type: 'continent',
        id: item.continent_id.toString(),
        name: item.continent_name || '',
      };
    }
    return null;
  };

  // Handle clicking a coverage item to view on map
  const handleViewOnMap = async (item: Coverage) => {
    // If it's a city, fetch full details with coordinates
    if (item.coverage_level_key === 'city' && item.city_id) {
      setLoadingCityDetails(true);
      try {
        const cityData = await api.get<City>(`/cities/${item.city_id}`);
        setSelectedCoverageForMap({
          ...item,
          // Store city data for map display
          city_name: cityData.name,
        });
      } catch (err) {
        console.error('Failed to fetch city details:', err);
        setError('Failed to load city details');
      } finally {
        setLoadingCityDetails(false);
      }
    } else {
      setSelectedCoverageForMap(item);
    }
  };

  // Get location selection for the selected coverage item
  const selectedLocationForMap = selectedCoverageForMap ? coverageToLocationSelection(selectedCoverageForMap) : null;

  // Handle opening override dialog from map view
  const handleOverrideFromMap = async () => {
    if (!selectedCoverageForMap || selectedCoverageForMap.coverage_level_key !== 'city' || !selectedCoverageForMap.city_id) {
      return;
    }

    await handleOpenOverrideDialog(selectedCoverageForMap);
  };

  // Handle correction request (Story 6.5)
  const handleRequestCorrection = async () => {
    if (!selectedCoverageForMap || selectedCoverageForMap.coverage_level_key !== 'city' || !selectedCoverageForMap.city_id) {
      return;
    }

    setLoadingCityDetails(true);
    try {
      const cityData = await api.get<City>(`/cities/${selectedCoverageForMap.city_id}`);
      setSelectedCityForCorrection(cityData);
      setCorrectionDialogOpen(true);
    } catch (err) {
      console.error('Failed to fetch city details:', err);
      setError('Failed to load city details');
    } finally {
      setLoadingCityDetails(false);
    }
  };

  const handleCorrectionSuccess = () => {
    // Optionally show a success message or refresh data
    console.log('Correction request submitted successfully');
  };

  const getCityOverride = (cityId: number | null): PublisherLocationOverride | undefined => {
    if (!cityId) return undefined;
    return locationOverrides.find(o => o.city_id === cityId);
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'continent':
        return <Mountain className="w-4 h-4" />;
      case 'country':
        return <Globe className="w-4 h-4" />;
      case 'region':
        return <Building2 className="w-4 h-4" />;
      case 'district':
        return <Layers className="w-4 h-4" />;
      case 'city':
        return <MapPin className="w-4 h-4" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };

  const getLevelBadgeColor = (level: string) => {
    return getCoverageBadgeClasses(level);
  };

  // Convert coverage to format for map preview
  const existingCoverageForMap = useMemo(() =>
    coverage.map((c) => {
      let id: string;
      if (c.coverage_level_key === 'country' && c.country_id) {
        id = c.country_id.toString();
      } else if (c.coverage_level_key === 'region' && c.region_id) {
        id = c.region_id.toString();
      } else if (c.coverage_level_key === 'district' && c.district_id) {
        id = c.district_id.toString();
      } else if (c.coverage_level_key === 'city' && c.city_id) {
        id = c.city_id.toString();
      } else if (c.coverage_level_key === 'continent' && c.continent_id) {
        id = c.continent_id.toString();
      } else {
        return null;
      }

      return {
        type: c.coverage_level_key,
        id,
        name: c.coverage_level_key === 'country' ? c.country_name || ''
          : c.coverage_level_key === 'region' ? c.region_name || ''
          : c.coverage_level_key === 'district' ? c.district_name || ''
          : c.coverage_level_key === 'city' ? c.city_name || ''
          : c.continent_name || '',
        country_code: c.country_code || undefined,
      };
    }).filter((c): c is NonNullable<typeof c> => c !== null),
  [coverage]);

  // Convert coverage for search panel exclusion
  const existingForExclude: LocationSelection[] = useMemo(() =>
    coverage.map((c) => {
      let id: string;
      if (c.coverage_level_key === 'country' && c.country_id) {
        id = c.country_id.toString();
      } else if (c.coverage_level_key === 'region' && c.region_id) {
        id = c.region_id.toString();
      } else if (c.coverage_level_key === 'district' && c.district_id) {
        id = c.district_id.toString();
      } else if (c.coverage_level_key === 'city' && c.city_id) {
        id = c.city_id.toString();
      } else if (c.coverage_level_key === 'continent' && c.continent_id) {
        id = c.continent_id.toString();
      } else {
        id = c.id;
      }

      return {
        type: c.coverage_level_key,
        id,
        name: c.coverage_level_key === 'country' ? c.country_name || ''
          : c.coverage_level_key === 'region' ? c.region_name || ''
          : c.coverage_level_key === 'district' ? c.district_name || ''
          : c.coverage_level_key === 'city' ? c.city_name || ''
          : c.continent_name || '',
      };
    }),
  [coverage]);

  if (contextLoading || isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading coverage...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold">Coverage Areas</h1>
              <InfoTooltip content={COVERAGE_TOOLTIPS.matching} side="right" />
            </div>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Define where users can find your zmanim
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {coverage.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowMapPreview(!showMapPreview)}
                className="flex-1 sm:flex-none"
              >
                {showMapPreview ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Hide Map
                  </>
                ) : (
                  <>
                    <Map className="w-4 h-4 mr-2" />
                    View Map
                  </>
                )}
              </Button>
            )}
            <Button onClick={handleOpenAddDialog} className="flex-1 sm:flex-none">
              <Plus className="w-4 h-4 mr-2" />
              Add Coverage
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Map Preview (optional) */}
        {showMapPreview && coverage.length > 0 && (
          <div className="mb-6">
            <CoveragePreviewMap
              existingCoverage={existingCoverageForMap}
              height={300}
              className="rounded-lg"
            />
          </div>
        )}

        {/* Coverage List */}
        {coverage.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-8 sm:p-12 text-center">
            <MapPin className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">No Coverage Areas</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">
              Add coverage areas to define where users can find your zmanim.
            </p>
            <Button onClick={handleOpenAddDialog} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add Coverage
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {coverage.map((item) => (
              <div key={item.id} className="space-y-3">
                {/* Coverage Item */}
                <div
                  className={`bg-card rounded-lg border p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                    item.is_active ? 'border-border' : 'border-border opacity-60'
                  } ${selectedCoverageForMap?.id === item.id ? 'ring-2 ring-primary' : ''}`}
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${getLevelBadgeColor(item.coverage_level_key)}`}>
                      {getLevelIcon(item.coverage_level_key)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm sm:text-base truncate">
                        {item.coverage_level_key === 'continent' && item.continent_name}
                        {item.coverage_level_key === 'country' && item.country_name}
                        {item.coverage_level_key === 'region' && `${item.region_name}${item.country_name ? `, ${item.country_name}` : ''}`}
                        {item.coverage_level_key === 'district' && `${item.district_name}${item.region_name ? `, ${item.region_name}` : ''}`}
                        {item.coverage_level_key === 'city' && `${item.city_name}${item.region_name ? `, ${item.region_name}` : ''}${item.country_name ? `, ${item.country_name}` : ''}`}
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
                        <StatusTooltip
                          status={item.coverage_level_key}
                          tooltip={COVERAGE_TOOLTIPS.level[item.coverage_level_key]}
                        >
                          <span className={`px-2 py-0.5 rounded-full border text-xs ${getLevelBadgeColor(item.coverage_level_key)}`}>
                            {item.coverage_level_key}
                          </span>
                        </StatusTooltip>
                        {!item.is_active && (
                          <StatusTooltip status="inactive" tooltip={STATUS_TOOLTIPS.inactive}>
                            <span className="text-yellow-600 dark:text-yellow-400 whitespace-nowrap">Inactive</span>
                          </StatusTooltip>
                        )}
                        {item.coverage_level_key === 'city' && getCityOverride(item.city_id) && (
                          <span className="px-2 py-0.5 rounded-full border border-primary bg-primary/10 text-primary text-xs whitespace-nowrap">
                            <Settings className="w-3 h-3 inline mr-1" />
                            Overridden
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => selectedCoverageForMap?.id === item.id ? setSelectedCoverageForMap(null) : handleViewOnMap(item)}
                      className="text-xs sm:text-sm"
                      title="View on map"
                    >
                      {selectedCoverageForMap?.id === item.id ? (
                        <>
                          <EyeOff className="w-4 h-4 sm:mr-1" />
                          <span className="hidden sm:inline">Hide Map</span>
                        </>
                      ) : (
                        <>
                          <Map className="w-4 h-4 sm:mr-1" />
                          <span className="hidden sm:inline">View on Map</span>
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(item)}
                      className="text-xs sm:text-sm"
                    >
                      {item.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Coverage</AlertDialogTitle>
                          <AlertDialogDescription className="text-sm">
                            Are you sure you want to remove this coverage area?
                            Users in this area will no longer see your zmanim.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                          <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteCoverage(item.id)} className="w-full sm:w-auto">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Inline Map View (AC-6.4.8) */}
                {selectedCoverageForMap?.id === item.id && selectedLocationForMap && (
                  <div className="bg-card rounded-lg border p-4 space-y-4">
                    <LocationMapView
                      location={selectedLocationForMap}
                      height={400}
                      className="mb-4"
                    />

                    {/* Action Buttons (below map, not on map) */}
                    {item.coverage_level_key === 'city' && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleOverrideFromMap}
                          className="w-full sm:w-auto"
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Override for My Publisher
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRequestCorrection}
                          className="w-full sm:w-auto"
                        >
                          <MapPin className="w-4 h-4 mr-2" />
                          Request Public Correction
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Coverage Dialog - Search-First Approach */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Add Coverage Area</DialogTitle>
              <DialogDescription className="text-sm sm:text-base">
                Search and select geographic areas to add to your publisher coverage.
              </DialogDescription>
            </DialogHeader>

            <CoverageSearchPanel
              onAdd={handleAddCoverage}
              existingCoverage={existingForExclude}
              showQuickSelect={true}
            />

            {addingCoverage && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Adding coverage...</span>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Location Override Dialog (Story 6.4) */}
        {selectedCityForOverride && (
          <LocationOverrideDialog
            city={selectedCityForOverride}
            existingOverride={getCityOverride(parseInt(selectedCityForOverride.id))}
            open={overrideDialogOpen}
            onOpenChange={setOverrideDialogOpen}
            onSuccess={handleOverrideSuccess}
          />
        )}

        {/* Correction Request Dialog (Story 6.5) */}
        {selectedCityForCorrection && (
          <CorrectionRequestDialog
            city={selectedCityForCorrection}
            open={correctionDialogOpen}
            onOpenChange={setCorrectionDialogOpen}
            onSuccess={handleCorrectionSuccess}
          />
        )}
      </div>
    </div>
  );
}
