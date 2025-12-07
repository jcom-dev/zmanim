'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePublisherContext } from '@/providers/PublisherContext';
import { MapPin, Globe, Building2, Plus, Trash2, Loader2, Mountain, Map, Layers } from 'lucide-react';
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
import { CoverageSelector, CoverageSelection } from '@/components/shared/CoverageSelector';
import { CoverageMapDialog } from '@/components/shared/CoverageMapView';

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

  // Add dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<CoverageSelection[]>([]);
  const [addingCoverage, setAddingCoverage] = useState(false);

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

  useEffect(() => {
    if (selectedPublisher) {
      fetchCoverage();
    }
  }, [selectedPublisher, fetchCoverage]);

  const handleOpenAddDialog = () => {
    setAddDialogOpen(true);
    setSelectedItems([]);
  };

  const handleCloseAddDialog = () => {
    setAddDialogOpen(false);
    setSelectedItems([]);
  };

  const handleAddSelected = async () => {
    if (!selectedPublisher || selectedItems.length === 0) return;

    try {
      setAddingCoverage(true);

      // Add each selected item
      for (const item of selectedItems) {
        const body: Record<string, unknown> = { coverage_level: item.type };

        if (item.type === 'continent') {
          body.continent_code = item.id;
        } else if (item.type === 'country') {
          // ID is now a numeric country_id
          body.country_id = parseInt(item.id, 10);
        } else if (item.type === 'region') {
          // ID is now a numeric region_id
          body.region_id = parseInt(item.id, 10);
        } else if (item.type === 'district') {
          // ID is a numeric district_id
          body.district_id = parseInt(item.id, 10);
        } else if (item.type === 'city') {
          // Handle quick-select cities with synthetic IDs (format: quick-cityname-COUNTRYCODE)
          if (item.id.startsWith('quick-')) {
            // Extract city name and country code from the synthetic ID
            const cityName = item.name.split(',')[0].trim();
            const idParts = item.id.split('-');
            const countryCode = idParts[idParts.length - 1]; // Last part is country code

            // Search with country code to get the correct city
            const searchResponse = await api.get<{ cities: { id: string }[] }>(
              `/cities?search=${encodeURIComponent(cityName)}&country_code=${encodeURIComponent(countryCode)}&limit=1`,
              { skipPublisherId: true }
            );
            if (searchResponse.cities && searchResponse.cities.length > 0) {
              body.city_id = parseInt(searchResponse.cities[0].id, 10);
            } else {
              console.error('Could not find city:', cityName, 'in country:', countryCode);
              continue;
            }
          } else {
            body.city_id = parseInt(item.id, 10);
          }
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

  // Handle map dialog confirmation
  const handleMapConfirm = async (selections: CoverageSelection[]) => {
    if (!selectedPublisher || selections.length === 0) return;

    try {
      setAddingCoverage(true);

      // Add each selected country from the map
      // Map selections use country_code (ISO), so we need to lookup the country_id
      for (const item of selections) {
        // Fetch country by code to get its numeric ID
        const countryResponse = await api.public.get<{ id: number; code: string }>(
          `/countries/${encodeURIComponent(item.id)}`
        );

        if (!countryResponse || !countryResponse.id) {
          console.error('Could not find country:', item.id);
          continue;
        }

        const body: Record<string, unknown> = {
          coverage_level: 'country',
          country_id: countryResponse.id,
        };

        await api.post('/publisher/coverage', {
          body: JSON.stringify(body),
        });
      }

      await fetchCoverage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add coverage');
    } finally {
      setAddingCoverage(false);
    }
  };

  // Get existing coverage country codes for map highlighting
  const existingCountryCodes = coverage
    .filter((c) => c.coverage_level_key === 'country' && c.country_code)
    .map((c) => c.country_code as string);

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
            <Button variant="outline" onClick={() => setMapDialogOpen(true)} className="flex-1 sm:flex-none">
              <Map className="w-4 h-4 mr-2" />
              Open Map
            </Button>
            <Button onClick={handleOpenAddDialog} className="flex-1 sm:flex-none">
              <Plus className="w-4 h-4 mr-2" />
              Add Coverage
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 alert-error">
            <p className="alert-error-text">{error}</p>
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
              <div
                key={item.id}
                className={`bg-card rounded-lg border p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                  item.is_active ? 'border-border' : 'border-border opacity-60'
                }`}
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
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
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
                      <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300">
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
            ))}
          </div>
        )}

        {/* Add Coverage Dialog - Using shared CoverageSelector */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Add Coverage Area</DialogTitle>
              <DialogDescription className="text-sm sm:text-base">
                Search and select coverage areas to add to your publisher profile.
              </DialogDescription>
            </DialogHeader>

            <CoverageSelector
              selectedItems={selectedItems}
              onChange={setSelectedItems}
              showQuickSelect={true}
              showSelectedBadges={true}
            />

            {/* Dialog Footer with Add Button */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={handleCloseAddDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleAddSelected}
                disabled={selectedItems.length === 0 || addingCoverage}
              >
                {addingCoverage ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add {selectedItems.length > 0 ? `${selectedItems.length} Area${selectedItems.length > 1 ? 's' : ''}` : 'Selected'}
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Map Dialog for visual country selection */}
        <CoverageMapDialog
          open={mapDialogOpen}
          onOpenChange={setMapDialogOpen}
          existingCoverage={existingCountryCodes}
          onConfirm={handleMapConfirm}
        />
      </div>
    </div>
  );
}
