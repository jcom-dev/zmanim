/**
 * @file page.tsx
 * @purpose Publisher coverage management - search-first approach
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓ IDs-only:✓
 */

'use client';

import { useState, useMemo } from 'react';
import { usePublisherContext } from '@/providers/PublisherContext';
import { MapPin, Globe, Globe2, Building2, Plus, Trash2, Loader2, Mountain, Map, EyeOff, ChevronRight, ChevronDown, Users } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import { useApi } from '@/lib/api-client';
import { getCoverageBadgeClasses } from '@/lib/wcag-colors';
import { InfoTooltip, StatusTooltip } from '@/components/shared/InfoTooltip';
import { COVERAGE_TOOLTIPS, STATUS_TOOLTIPS } from '@/lib/tooltip-content';
import type { LocalitySelection, LocationSelection } from '@/types/geography';
import type { LocalitySearchResult } from '@/types/geography';
import { LocalityPicker } from '@/components/shared/LocalityPicker';
import { LocationMapView } from '@/components/shared/LocationMapView';
import { CorrectionRequestDialog } from '@/components/publisher/CorrectionRequestDialog';
import { usePublisherCoverage } from '@/lib/hooks/usePublisherCoverage';
import { usePublisherMutation } from '@/lib/hooks/useApiQuery';

interface Coverage {
  id: string;
  publisher_id: string;
  coverage_level_id: number;
  coverage_level_key: 'continent' | 'country' | 'region' | 'locality';
  // ID-based fields (new schema)
  continent_id: number | null;
  country_id: number | null;
  region_id: number | null;
  locality_id: number | null;
  // Display fields from joined geo tables
  continent_name: string | null;
  country_code: string | null;
  country_name: string | null;
  region_code: string | null;
  region_name: string | null;
  locality_name: string | null;
  locality_count: number;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Hierarchy browser types - matches BrowseHierarchyRow from API
interface HierarchyItem {
  entity_type: string;
  entity_id: number;
  entity_subtype: string | null;
  locality_id: number | null;
  display_name: string;
  display_hierarchy: string;
  locality_type_id: number | null;
  population: number | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  direct_child_count: number | null;
  descendant_count: number | null;
  has_children: boolean | null;
}

// Inline hierarchy browser component for drilling down into coverage areas
function CoverageHierarchyBrowser({
  coverage,
  api
}: {
  coverage: Coverage;
  api: ReturnType<typeof useApi>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<HierarchyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedChildren, setExpandedChildren] = useState<Set<string>>(new Set());
  const [childrenData, setChildrenData] = useState<Record<string, HierarchyItem[]>>({});
  const [loadingChildren, setLoadingChildren] = useState<Set<string>>(new Set());

  // Get parent type and ID based on coverage level
  const getParentInfo = (): { type: string; id: number } | null => {
    switch (coverage.coverage_level_key) {
      case 'continent':
        return coverage.continent_id ? { type: 'continent', id: coverage.continent_id } : null;
      case 'country':
        return coverage.country_id ? { type: 'country', id: coverage.country_id } : null;
      case 'region':
        return coverage.region_id ? { type: 'region', id: coverage.region_id } : null;
      case 'locality':
        return coverage.locality_id ? { type: 'locality', id: coverage.locality_id } : null;
      default:
        return null;
    }
  };

  const loadChildren = async () => {
    const parentInfo = getParentInfo();
    if (!parentInfo) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        parent_type: parentInfo.type,
        parent_id: parentInfo.id.toString(),
        limit: '100',
      });
      const data = await api.public.get<HierarchyItem[]>(`/localities/browse?${params.toString()}`);
      setChildren(data || []);
    } catch (err) {
      console.error('Failed to load children:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadNestedChildren = async (item: HierarchyItem) => {
    const key = `${item.entity_type}-${item.entity_id}`;

    if (expandedChildren.has(key)) {
      // Collapse
      setExpandedChildren(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      return;
    }

    // Load children
    setLoadingChildren(prev => new Set(prev).add(key));
    try {
      const params = new URLSearchParams({
        parent_type: item.entity_type,
        parent_id: item.entity_id.toString(),
        limit: '100',
      });
      const data = await api.public.get<HierarchyItem[]>(`/localities/browse?${params.toString()}`);
      setChildrenData(prev => ({ ...prev, [key]: data || [] }));
      setExpandedChildren(prev => new Set(prev).add(key));
    } catch (err) {
      console.error('Failed to load nested children:', err);
    } finally {
      setLoadingChildren(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleToggle = () => {
    if (!isExpanded && children.length === 0) {
      loadChildren();
    }
    setIsExpanded(!isExpanded);
  };

  // Only show for non-locality coverage (they have children)
  if (coverage.coverage_level_key === 'locality') {
    return null;
  }

  const getItemIcon = (entityType: string) => {
    switch (entityType) {
      case 'continent': return <Mountain className="w-3 h-3" />;
      case 'country': return <Globe className="w-3 h-3" />;
      case 'region': return <Building2 className="w-3 h-3" />;
      case 'locality': return <MapPin className="w-3 h-3" />;
      default: return <MapPin className="w-3 h-3" />;
    }
  };

  const formatPopulation = (pop: number | null) => {
    if (!pop) return null;
    if (pop >= 1000000) return `${(pop / 1000000).toFixed(1)}M`;
    if (pop >= 1000) return `${(pop / 1000).toFixed(0)}K`;
    return pop.toString();
  };

  const renderItem = (item: HierarchyItem, depth: number = 0) => {
    const key = `${item.entity_type}-${item.entity_id}`;
    const isItemExpanded = expandedChildren.has(key);
    const isItemLoading = loadingChildren.has(key);
    const itemChildren = childrenData[key] || [];
    const hasChildren = item.has_children || (item.descendant_count && item.descendant_count > 0);

    return (
      <div key={key}>
        <div
          className={`flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded text-sm ${depth > 0 ? 'ml-4' : ''}`}
          style={{ marginLeft: depth * 16 }}
        >
          {hasChildren ? (
            <button
              onClick={() => loadNestedChildren(item)}
              className="p-0.5 hover:bg-muted rounded"
              disabled={isItemLoading}
            >
              {isItemLoading ? (
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              ) : isItemExpanded ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}

          <span className="text-muted-foreground">{getItemIcon(item.entity_type)}</span>
          <span className="flex-1 truncate">{item.display_name}</span>

          {/* Show population for all items that have it */}
          {item.population != null && item.population > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" />
              {formatPopulation(item.population)}
            </span>
          )}

          {/* Show descendant count for items that have children */}
          {item.descendant_count != null && item.descendant_count > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {item.descendant_count.toLocaleString()}
            </span>
          )}
        </div>

        {isItemExpanded && itemChildren.length > 0 && (
          <div className="border-l border-border ml-4" style={{ marginLeft: depth * 16 + 16 }}>
            {itemChildren.map(child => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-2">
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        {isExpanded ? 'Hide' : 'View'} sub-localities
      </button>

      {isExpanded && (
        <div className="mt-2 bg-muted/30 rounded-lg p-2 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : children.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No sub-localities found</p>
          ) : (
            <div className="space-y-0.5">
              {children.map(item => renderItem(item))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Global coverage banner component
function GlobalCoverageBanner({
  coverageCount,
  onDisable
}: {
  coverageCount: number;
  onDisable: () => void;
}) {
  return (
    <Card className="bg-primary/10 border-primary/30">
      <CardContent className="py-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/20 rounded-full">
            <Globe2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Global Coverage Enabled</h3>
            <p className="text-muted-foreground mt-1">
              Your publisher provides zmanim for all localities worldwide.
              No coverage area management is needed.
            </p>
            {coverageCount > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Previously defined coverage areas ({coverageCount}) are preserved and will be
                restored if you switch back to regional coverage.
              </p>
            )}
            <Button
              variant="outline"
              className="mt-4"
              onClick={onDisable}
            >
              Switch to Regional Coverage
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Enable global coverage prompt
function EnableGlobalPrompt({ onEnable }: { onEnable: () => void }) {
  return (
    <Card className="bg-muted/50">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe2 className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Serve all localities worldwide?</span>
          </div>
          <Button variant="outline" onClick={onEnable}>
            Enable Global Coverage
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PublisherCoveragePage() {
  const api = useApi();
  const { selectedPublisher, isLoading: contextLoading } = usePublisherContext();

  // Use coverage hook for query and mutations
  const { coverage: coverageData, isLoading, error: coverageError, addCoverage, deleteCoverage, toggleActive } = usePublisherCoverage();
  const coverage = coverageData?.coverage || [];
  const isGlobal = coverageData?.is_global || false;

  // Local error state for non-mutation errors
  const [error, setError] = useState<string | null>(coverageError?.message || null);

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [globalConfirmDialogOpen, setGlobalConfirmDialogOpen] = useState(false);
  const [pendingGlobalState, setPendingGlobalState] = useState<boolean | null>(null);

  // Selected coverage item for map view (AC-6.4.8)
  const [selectedCoverageForMap, setSelectedCoverageForMap] = useState<Coverage | null>(null);

  // Global coverage toggle mutation
  const toggleGlobalMutation = usePublisherMutation<
    { is_global: boolean; coverage_count: number },
    { is_global: boolean }
  >(
    '/publisher/settings/global-coverage',
    'PUT',
    { invalidateKeys: ['publisher-coverage'] }
  );

  // Correction request state (Story 6.5)
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [selectedLocalityForCorrection, setSelectedLocalityForCorrection] = useState<LocalitySearchResult | null>(null);

  const handleOpenAddDialog = () => {
    setAddDialogOpen(true);
  };

  const handleCloseAddDialog = () => {
    setAddDialogOpen(false);
  };

  // Handle adding coverage from LocalityPicker
  const handleAddCoverage = async (selection: LocalitySelection | LocalitySelection[]) => {
    if (!selectedPublisher) return;

    // LocalityPicker in multi mode returns array, in single mode returns single selection
    const selections = Array.isArray(selection) ? selection : [selection];
    if (selections.length === 0) return;

    // Map locality subtypes to coverage level
    const getCoverageLevel = (type: string): string => {
      // All locality subtypes map to 'locality' coverage level
      if (['locality', 'town', 'village', 'hamlet', 'neighborhood', 'borough'].includes(type)) {
        return 'locality';
      }
      // All region subtypes map to 'region' coverage level
      if (['region', 'state', 'province', 'county', 'localadmin', 'prefecture'].includes(type)) {
        return 'region';
      }
      return type; // 'country' and 'continent' pass through
    };

    for (const item of selections) {
      const coverageLevel = getCoverageLevel(item.type);
      const body: {
        coverage_level: 'continent' | 'country' | 'region' | 'locality';
        continent_code?: string;
        country_id?: number;
        region_id?: number;
        locality_id?: number;
      } = { coverage_level: coverageLevel as 'continent' | 'country' | 'region' | 'locality' };

      if (coverageLevel === 'continent') {
        // Continent uses code, not ID
        body.continent_code = item.id;
      } else if (coverageLevel === 'country') {
        body.country_id = parseInt(item.id, 10);
      } else if (coverageLevel === 'region') {
        body.region_id = parseInt(item.id, 10);
      } else if (coverageLevel === 'locality') {
        body.locality_id = parseInt(item.id, 10);
      }

      await addCoverage.mutateAsync(body);
    }

    handleCloseAddDialog();
  };

  const handleDeleteCoverage = async (coverageId: string) => {
    if (!selectedPublisher) return;
    await deleteCoverage.mutateAsync(coverageId);
  };

  const handleToggleActive = async (coverageItem: Coverage) => {
    if (!selectedPublisher) return;
    await toggleActive.mutateAsync({
      id: coverageItem.id,
      is_active: !coverageItem.is_active,
    });
  };

  // Handle global coverage toggle request
  const handleGlobalToggleRequest = (enable: boolean) => {
    setPendingGlobalState(enable);
    setGlobalConfirmDialogOpen(true);
  };

  // Confirm and execute global coverage toggle
  const handleConfirmGlobalToggle = async () => {
    if (pendingGlobalState === null || !selectedPublisher) return;

    try {
      await toggleGlobalMutation.mutateAsync({ is_global: pendingGlobalState });
      setGlobalConfirmDialogOpen(false);
      setPendingGlobalState(null);
    } catch (err) {
      console.error('Failed to toggle global coverage:', err);
      setError('Failed to update global coverage setting');
    }
  };

  // Convert coverage item to LocationSelection for map view
  const coverageToLocationSelection = (item: Coverage): LocationSelection | null => {
    if (item.coverage_level_key === 'locality' && item.locality_id) {
      return {
        type: 'locality',
        id: item.locality_id.toString(),
        name: item.locality_name || '',
        country_code: item.country_code || undefined,
      };
    } else if (item.coverage_level_key === 'region' && item.region_id) {
      return {
        type: 'region',
        id: item.region_id.toString(),
        name: item.region_name || '',
        country_code: item.country_code || undefined,
      };
    } else if (item.coverage_level_key === 'country' && item.country_id) {
      return {
        type: 'country',
        id: item.country_id.toString(),
        name: item.country_name || '',
        country_code: item.country_code || undefined,
      };
    }
    return null;
  };

  // Handle clicking a coverage item to view on map
  const handleViewOnMap = async (item: Coverage) => {
    // If it's a locality, fetch full details with coordinates
    if (item.coverage_level_key === 'locality' && item.locality_id) {
      try {
        const localityData = await api.get<LocalitySearchResult>(`/localities/${item.locality_id}`);
        setSelectedCoverageForMap({
          ...item,
          // Store locality data for map display
          locality_name: localityData.name,
        });
      } catch (err) {
        console.error('Failed to fetch locality details:', err);
      }
    } else {
      // For regions and countries, just set the coverage item
      setSelectedCoverageForMap(item);
    }
  };

  // Get location selection for the selected coverage item
  const selectedLocationForMap = selectedCoverageForMap ? coverageToLocationSelection(selectedCoverageForMap) : null;

  // Handle correction request (Story 6.5)
  const handleRequestCorrection = async () => {
    if (!selectedCoverageForMap || selectedCoverageForMap.coverage_level_key !== 'locality' || !selectedCoverageForMap.locality_id) {
      return;
    }

    try {
      const localityData = await api.get<LocalitySearchResult>(`/localities/${selectedCoverageForMap.locality_id}`);
      setSelectedLocalityForCorrection(localityData);
      setCorrectionDialogOpen(true);
    } catch (err) {
      console.error('Failed to fetch locality details:', err);
    }
  };

  const handleCorrectionSuccess = () => {
    // Optionally show a success message or refresh data
    console.log('Correction request submitted successfully');
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'continent':
        return <Mountain className="w-4 h-4" />;
      case 'country':
        return <Globe className="w-4 h-4" />;
      case 'region':
        return <Building2 className="w-4 h-4" />;
      case 'locality':
        return <MapPin className="w-4 h-4" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };

  const getLevelBadgeColor = (level: string) => {
    return getCoverageBadgeClasses(level);
  };

  // Convert coverage for LocalityPicker exclusion
  const existingForExclude: LocalitySelection[] = useMemo(() =>
    coverage.map((c) => {
      let id: string;
      if (c.coverage_level_key === 'country' && c.country_id) {
        id = c.country_id.toString();
      } else if (c.coverage_level_key === 'region' && c.region_id) {
        id = c.region_id.toString();
      } else if (c.coverage_level_key === 'locality' && c.locality_id) {
        id = c.locality_id.toString();
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
          : c.coverage_level_key === 'locality' ? c.locality_name || ''
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
          {!isGlobal && (
            <Button onClick={handleOpenAddDialog} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add Coverage
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Global Coverage Banner or Enable Prompt */}
        {isGlobal ? (
          <div className="mb-6">
            <GlobalCoverageBanner
              coverageCount={coverage.length}
              onDisable={() => handleGlobalToggleRequest(false)}
            />
          </div>
        ) : (
          <div className="mb-6">
            <EnableGlobalPrompt onEnable={() => handleGlobalToggleRequest(true)} />
          </div>
        )}

        {/* Coverage List - only show when not global */}
        {!isGlobal && (coverage.length === 0 ? (
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
                  className={`bg-card rounded-lg border p-3 sm:p-4 ${
                    item.is_active ? 'border-border' : 'border-border opacity-60'
                  }`}
                >
                  {/* Header row with info and actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${getLevelBadgeColor(item.coverage_level_key)}`}>
                        {getLevelIcon(item.coverage_level_key)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm sm:text-base truncate">
                          {item.coverage_level_key === 'continent' && (item.continent_name || 'Unknown Continent')}
                          {item.coverage_level_key === 'country' && (item.country_name || 'Unknown Country')}
                          {item.coverage_level_key === 'region' && `${item.region_name || 'Unknown Region'}${item.country_name ? `, ${item.country_name}` : ''}`}
                          {item.coverage_level_key === 'locality' && `${item.locality_name || 'Unknown Locality'}${item.country_name ? `, ${item.country_name}` : ''}`}
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
                          {item.locality_count > 0 && (
                            <span className="text-muted-foreground whitespace-nowrap">
                              {item.locality_count.toLocaleString()} {item.locality_count === 1 ? 'locality' : 'localities'}
                            </span>
                          )}
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

                  {/* Expandable sub-localities browser - inside the card */}
                  {item.locality_count > 0 && item.coverage_level_key !== 'locality' && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <CoverageHierarchyBrowser coverage={item} api={api} />
                    </div>
                  )}
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
                    {item.coverage_level_key === 'locality' && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRequestCorrection}
                          className="w-full sm:w-auto"
                        >
                          Request Data Correction
                        </Button>
                      </div>
                    )}
                  </div>
                )}

              </div>
            ))}
          </div>
        ))}

        {/* Confirmation Dialog for Global Coverage Toggle */}
        <AlertDialog open={globalConfirmDialogOpen} onOpenChange={setGlobalConfirmDialogOpen}>
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingGlobalState ? 'Enable Global Coverage?' : 'Switch to Regional Coverage?'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                {pendingGlobalState ? (
                  <>
                    Your publisher will provide zmanim for all localities worldwide.
                    {coverage.length > 0 && (
                      <> Your {coverage.length} existing coverage {coverage.length === 1 ? 'area' : 'areas'} will be preserved and can be restored later.</>
                    )}
                  </>
                ) : (
                  <>
                    You will need to manage specific coverage areas.
                    {coverage.length > 0 && (
                      <> Your {coverage.length} previously defined coverage {coverage.length === 1 ? 'area' : 'areas'} will be restored.</>
                    )}
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmGlobalToggle}
                disabled={toggleGlobalMutation.isPending}
                className="w-full sm:w-auto"
              >
                {toggleGlobalMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  pendingGlobalState ? 'Enable Global Coverage' : 'Switch to Regional'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Coverage Dialog - Search-First Approach */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Add Coverage Area</DialogTitle>
              <DialogDescription className="text-sm sm:text-base">
                Search and select geographic areas to add to your publisher coverage.
              </DialogDescription>
            </DialogHeader>

            <LocalityPicker
              mode="multi"
              filterPreset="coverage"
              showTypeFilters={true}
              showQuickSelect={true}
              inlineResults={true}
              placeholder="Search localities, regions, countries..."
              onSelect={handleAddCoverage}
              exclude={existingForExclude}
            />

            {addCoverage.isPending && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Adding coverage...</span>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Correction Request Dialog (Story 6.5) */}
        {selectedLocalityForCorrection && (
          <CorrectionRequestDialog
            locality={selectedLocalityForCorrection}
            open={correctionDialogOpen}
            onOpenChange={setCorrectionDialogOpen}
            onSuccess={handleCorrectionSuccess}
          />
        )}
      </div>
    </div>
  );
}
