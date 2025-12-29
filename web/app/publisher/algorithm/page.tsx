'use client';

import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePublisherContext } from '@/providers/PublisherContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ZmanGrid } from '@/components/publisher/ZmanCard';
import { AlgorithmPreview } from '@/components/publisher/AlgorithmPreview';
import { WeekPreview } from '@/components/publisher/WeekPreview';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { useAlgorithmPageData } from '@/lib/hooks/useAlgorithmPageData';
import {
  useImportZmanim,
  PublisherZman,
} from '@/lib/hooks/useZmanimList';
import { usePublisherMutation } from '@/lib/hooks/useApiQuery';
import { SaveVersionDialog } from '@/components/publisher/SaveVersionDialog';
import { VersionHistoryDialog } from '@/components/publisher/VersionHistoryDialog';
import { ImportSnapshotDialog } from '@/components/publisher/ImportSnapshotDialog';
import { DeletedZmanimDialog } from '@/components/publisher/DeletedZmanimDialog';
import { DisabledZmanimDialog } from '@/components/publisher/DisabledZmanimDialog';
import { YearExportDialog } from '@/components/publisher/YearExportDialog';
import { ZmanimReportDialog } from '@/components/publisher/ZmanimReportDialog';
import { useExportSnapshot } from '@/lib/hooks/usePublisherSnapshots';
import { usePublisherCoverage } from '@/lib/hooks/usePublisherCoverage';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { TagFilterDropdown } from '@/components/shared/tags';
import { useTags } from '@/components/shared/tags/hooks/useTags';
import { DisplaySettingsToggle } from '@/components/shared/DisplaySettingsToggle';
import { usePreferences } from '@/lib/contexts/PreferencesContext';
import { formatTimeTo12Hour } from '@/lib/utils/time-format';
import { PreviewToolbar } from '@/components/shared/PreviewToolbar';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { MapPin, Search, Download, Upload, AlertTriangle, CalendarDays, Flame, ChevronDown, Library, History, Save, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StatusTooltip } from '@/components/shared/InfoTooltip';
import { ALGORITHM_TOOLTIPS, STATUS_TOOLTIPS } from '@/lib/tooltip-content';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
type FilterType = 'all' | 'published' | 'draft' | 'essential' | 'optional' | 'hidden';

export default function AlgorithmEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedPublisher } = usePublisherContext();
  const { preferences } = usePreferences();

  // Focus parameter from URL (used when redirecting from registry import)
  const focusZmanKey = searchParams.get('focus');

  // Clear focus parameter from URL after initial scroll (after a delay)
  useEffect(() => {
    if (focusZmanKey) {
      const timeout = setTimeout(() => {
        // Remove the focus param from URL without triggering navigation
        const url = new URL(window.location.href);
        url.searchParams.delete('focus');
        window.history.replaceState({}, '', url.toString());
      }, 2000); // Clear after 2 seconds
      return () => clearTimeout(timeout);
    }
  }, [focusZmanKey]);

  // Use unified algorithm page data hook - only locality_id needed
  const {
    localityId,
    localityDisplayName,
    dayContext,
    zmanim: zmanimData,
    isLoading,
    isInitialized,
    error: zmanimError,
    selectedDate: selectedDateStr,
    refetch,
    setPreviewDate: setPreviewDateStr,
    setPreviewLocality,
  } = useAlgorithmPageData();

  // Memoize to prevent unnecessary re-renders of child components
  const zmanim = useMemo(() => Array.isArray(zmanimData) ? zmanimData : [], [zmanimData]);
  const importZmanim = useImportZmanim();

  // Fetch all tags for the filter dropdown
  const { data: allTags = [] } = useTags();

  // Reset wizard by purging all zmanim
  const resetWizardMutation = usePublisherMutation<void, void>(
    '/publisher/onboarding',
    'DELETE',
    { invalidateKeys: ['publisher-zmanim', 'publisher-coverage'] }
  );

  // Version control / snapshots
  const exportSnapshot = useExportSnapshot();

  // Publisher coverage - check if publisher has any coverage areas
  const { coverage, isLoading: coverageLoading } = usePublisherCoverage();
  const isGlobalPublisher = coverage?.is_global ?? false;
  const hasCoverage = (coverage?.coverage ?? []).length > 0 || isGlobalPublisher;

  const [showMonthView, setShowMonthView] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [forceShowWizard, setForceShowWizard] = useState(false);
  const [showSaveVersionDialog, setShowSaveVersionDialog] = useState(false);
  const [showVersionHistoryDialog, setShowVersionHistoryDialog] = useState(false);
  const [showImportSnapshotDialog, setShowImportSnapshotDialog] = useState(false);
  const [showYearExportDialog, setShowYearExportDialog] = useState(false);
  const [showZmanimReportDialog, setShowZmanimReportDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Defer the search query to avoid blocking UI during typing
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<'everyday' | 'events'>('everyday');
  const [tagFilter, setTagFilter] = useState<string>('all');

  // Display language for zman names - from global preferences
  const displayLanguage = preferences.language === 'he' ? 'hebrew' : 'english';

  // Build lookup map for preview times from zmanim data
  // - previewTimes: formatted for display (respects showSeconds preference)
  // Publisher algorithm page defaults to seconds ON (true) when no preference is set
  // Backend returns both `time` (exact with seconds) and `time_rounded` (rounded per rounding_mode)
  const showSeconds = preferences.showSeconds ?? true;
  const previewTimes = useMemo(() => {
    if (!zmanim || zmanim.length === 0) return {};
    const formatted: Record<string, string> = {};
    for (const z of zmanim) {
      // Check if zman has calculated time (when params are provided)
      const zmanWithTime = z as PublisherZman & { time?: string; time_rounded?: string; error?: string };
      const error = zmanWithTime.error;
      if (error) continue;

      // Use exact time when showing seconds, rounded time when not
      const timeToDisplay = showSeconds ? zmanWithTime.time : zmanWithTime.time_rounded;
      if (timeToDisplay) {
        // Just convert to 12-hour format - no rounding needed, backend already handled it
        formatted[z.zman_key] = formatTimeTo12Hour(timeToDisplay, showSeconds);
      }
    }
    return formatted;
  }, [zmanim, showSeconds]);

  // Save date to localStorage for sharing with edit page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('zmanim-preview-date', selectedDateStr);
    }
  }, [selectedDateStr]);


  // Separate zmanim into everyday and event categories using tag_type
  const { everydayZmanim, eventZmanim } = useMemo(() => {
    const everyday: PublisherZman[] = [];
    const events: PublisherZman[] = [];

    zmanim.forEach(z => {
      // Server determines event status via is_event_zman field (based on event-type tags)
      if (z.is_event_zman) {
        events.push(z);
      } else {
        everyday.push(z);
      }
    });

    return { everydayZmanim: everyday, eventZmanim: events };
  }, [zmanim]);

  // Compute available tags from current view zmanim (tags that are actually used)
  const availableTagKeys = useMemo(() => {
    const currentViewZmanim = viewMode === 'everyday' ? everydayZmanim : eventZmanim;
    const tagKeySet = new Set<string>();
    currentViewZmanim.forEach(z => {
      // Check if zman has tags array (from API response)
      if (z.tags && Array.isArray(z.tags)) {
        z.tags.forEach((tag: { tag_key: string }) => {
          if (tag.tag_key) tagKeySet.add(tag.tag_key);
        });
      }
    });
    return tagKeySet;
  }, [everydayZmanim, eventZmanim, viewMode]);

  // Filter allTags to only show tags that are actually used in current view
  const availableTags = useMemo(() => {
    return allTags.filter(tag => availableTagKeys.has(tag.tag_key));
  }, [allTags, availableTagKeys]);

  // Reset tag filter when switching view modes (available tags may differ)
  useEffect(() => {
    setTagFilter('all');
  }, [viewMode]);

  // Simple stable order from API response
  // Backend sends pre-sorted data by category and time, so we just preserve that order
  const stableOrderMap = useMemo(() => {
    const order = new Map<string, number>();
    zmanim.forEach((z, i) => order.set(z.zman_key, i));
    return order;
  }, [zmanim]); // Only recalculates when zmanim list changes from API

  // Filter zmanim based on viewMode and other filters
  // Uses deferredSearchQuery to avoid blocking UI during typing
  const filteredZmanim = useMemo(() => {
    // Start with zmanim based on view mode
    let result = viewMode === 'everyday' ? [...everydayZmanim] : [...eventZmanim];

    // Apply search filter (using deferred value for non-blocking updates)
    if (deferredSearchQuery.trim() !== '') {
      // Strip leading @ for zman_key searches
      const rawQuery = deferredSearchQuery.trim();
      const query = rawQuery.startsWith('@') ? rawQuery.slice(1).toLowerCase() : rawQuery.toLowerCase();
      result = result.filter(z =>
        z.hebrew_name.toLowerCase().includes(query) ||
        z.english_name.toLowerCase().includes(query) ||
        z.zman_key.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    switch (filterType) {
      case 'published':
        result = result.filter(z => z.is_published);
        break;
      case 'draft':
        result = result.filter(z => !z.is_published);
        break;
      case 'essential':
        result = result.filter(z => z.display_status === 'core');
        break;
      case 'optional':
        result = result.filter(z => z.display_status === 'optional');
        break;
      case 'hidden':
        result = result.filter(z => z.display_status === 'hidden');
        break;
    }

    // Apply tag filter - use actual zman tags from API
    if (tagFilter !== 'all') {
      result = result.filter(z => {
        if (!z.tags || !Array.isArray(z.tags)) return false;
        return z.tags.some((tag: { tag_key: string }) => tag.tag_key === tagFilter);
      });
    }

    // Maintain stable order from API response
    result.sort((a, b) => {
      const orderA = stableOrderMap.get(a.zman_key) ?? Number.MAX_SAFE_INTEGER;
      const orderB = stableOrderMap.get(b.zman_key) ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });

    return result;
  }, [everydayZmanim, eventZmanim, viewMode, deferredSearchQuery, filterType, tagFilter, stableOrderMap]);

  // Navigate to editor
  const handleEditZman = (zmanKey: string) => {
    router.push(`/publisher/algorithm/edit/${zmanKey}`);
  };

  // Import handlers
  const handleImportDefaults = async () => {
    try {
      await importZmanim.mutateAsync({ source: 'defaults' });
      setShowImportDialog(false);
    } catch (err) {
      console.error('Failed to import defaults:', err);
    }
  };

  // Calculate counts for current view
  const everydayCount = everydayZmanim.length;
  const eventCount = eventZmanim.length;
  const currentViewCount = viewMode === 'everyday' ? everydayCount : eventCount;
  const currentViewZmanim = viewMode === 'everyday' ? everydayZmanim : eventZmanim;
  const currentViewPublishedCount = currentViewZmanim.filter(z => z.is_published).length;
  const currentViewDraftCount = currentViewZmanim.filter(z => !z.is_published).length;
  // Total published count across all zmanim (for header badge)
  const totalPublishedCount = zmanim.filter(z => z.is_published).length;
  const currentViewCoreCount = currentViewZmanim.filter(z => z.display_status === 'core').length;
  const currentViewOptionalCount = currentViewZmanim.filter(z => z.display_status === 'optional').length;
  const currentViewHiddenCount = currentViewZmanim.filter(z => z.display_status === 'hidden').length;

  // Show loading state only if not initialized yet OR if data is loading
  // IMPORTANT: Must check this BEFORE wizard logic to avoid flash of wizard while coverage loads
  if (!isInitialized || isLoading || coverageLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="text-foreground">Loading zmanim...</div>
          </div>
        </div>
      </div>
    );
  }

  // Auto-launch wizard when there are 0 zmanim AND no coverage (new publisher or after restart)
  // The wizard helps set up both coverage and zmanim
  // IMPORTANT: This check must come AFTER the loading check above
  const shouldShowWizard = forceShowWizard || (zmanim.length === 0 && !hasCoverage);

  if (shouldShowWizard) {
    return (
      <div className="min-h-screen bg-background">
        <OnboardingWizard
          onComplete={() => {
            refetch();
            setForceShowWizard(false);
          }}
          onSkip={() => {
            setForceShowWizard(false);
            setShowImportDialog(true);
          }}
        />
      </div>
    );
  }

  // Restart wizard - purges all zmanim and coverage
  const handleRestartWizard = async () => {
    setShowRestartConfirm(false);

    resetWizardMutation.mutate(undefined, {
      onSuccess: () => {
        setForceShowWizard(true);
      },
      onError: (err: unknown) => {
        console.error('Failed to restart wizard:', err);
      },
    });
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-foreground">Algorithm Editor</h1>
              <Badge variant="outline" className="text-sm">
                {zmanim.length} Zmanim
              </Badge>
              <Badge variant="secondary" className="text-sm">
                {totalPublishedCount} Published
              </Badge>
            </div>
            <p className="text-muted-foreground">Configure your zmanim calculation formulas</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              onClick={() => router.push('/publisher/dashboard')}
            >
              Back to Dashboard
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowRestartConfirm(true)}
            >
              Restart Wizard
            </Button>

            {/* Export/Import Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    exportSnapshot.mutate(undefined, {
                      onSuccess: () => {
                        // Toast handled in the hook
                      },
                      onError: () => {
                        // Toast handled in the hook
                      },
                    });
                  }}
                  disabled={exportSnapshot.isPending}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exportSnapshot.isPending ? 'Exporting...' : 'Export to JSON'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowImportSnapshotDialog(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import from JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowYearExportDialog(true)}>
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Export Full Year
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowZmanimReportDialog(true)}>
                  <Printer className="h-4 w-4 mr-2" />
                  Generate PDF Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              onClick={() => setShowVersionHistoryDialog(true)}
            >
              <History className="h-4 w-4 mr-2" />
              Version History
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowMonthView(true)}
            >
              View Week
            </Button>
          </div>
        </div>

        {/* Error message */}
        {zmanimError && (
          <div className="mb-6 bg-destructive/10 border border-destructive/50 rounded-md p-4">
            <p className="text-destructive text-sm">Failed to load zmanim. Please refresh the page.</p>
          </div>
        )}

        {/* No Coverage State */}
        {!hasCoverage && (
          <Card className="mt-6">
            <CardContent className="py-16">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-6">
                  <MapPin className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">No Coverage Areas Configured</h2>
                <p className="text-muted-foreground max-w-md mb-6">
                  Before you can preview and configure zmanim, you need to define which geographic areas your publication covers.
                  Add at least one coverage area to get started.
                </p>
                <Button
                  onClick={() => router.push('/publisher/coverage')}
                  className="gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  Configure Coverage Areas
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Two-column layout: Controls on left, Live Preview on right - only show when coverage exists */}
        {hasCoverage && <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Left Column: All controls and zmanim list */}
          <div className="space-y-6">
            {/* Preview Toolbar - Unified location, date, and language controls */}
            <PreviewToolbar
              storageKey="algorithm"
              restrictToCoverage={true}
              publisherId={selectedPublisher?.id ? parseInt(selectedPublisher.id, 10) : undefined}
              isGlobalPublisher={isGlobalPublisher}
              showCoverageIndicator={true}
              onLocalityChange={(id, name) => {
                if (id && name) {
                  setPreviewLocality(id, name);
                }
              }}
              onDateChange={(date) => setPreviewDateStr(date)}
              localityId={localityId}
              localityName={localityDisplayName}
              date={selectedDateStr}
            />
            {/* Everyday / Events Tabs */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'everyday' | 'events')}>
              <TabsList className="grid w-full grid-cols-2">
                <StatusTooltip status="everyday" tooltip={ALGORITHM_TOOLTIPS.everyday_tab}>
                  <TabsTrigger value="everyday" className="gap-1 sm:gap-2 w-full">
                    <CalendarDays className="h-4 w-4 hidden sm:block" />
                    <span className="text-xs sm:text-sm">Everyday</span>
                    <Badge variant="secondary" className="ml-0.5 sm:ml-1 text-xs">
                      {localityId ? everydayCount : '--'}
                    </Badge>
                  </TabsTrigger>
                </StatusTooltip>
                <StatusTooltip status="events" tooltip={ALGORITHM_TOOLTIPS.events_tab}>
                  <TabsTrigger value="events" className="gap-1 sm:gap-2 w-full">
                    <Flame className="h-4 w-4 hidden sm:block" />
                    <span className="text-xs sm:text-sm">Events</span>
                    <Badge variant="secondary" className="ml-0.5 sm:ml-1 text-xs">
                      {localityId ? eventCount : '--'}
                    </Badge>
                  </TabsTrigger>
                </StatusTooltip>
              </TabsList>
            </Tabs>

            {/* Search, Filter, and Actions Bar */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 w-full">
                  <div className="relative w-full sm:flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or key (@alos_hashachar)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-full"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto sm:justify-start">
                    {/* Tag Filter Dropdown - show all tags or filter to available */}
                    {allTags.length > 0 && (
                      <TagFilterDropdown
                        value={tagFilter}
                        onChange={setTagFilter}
                        tags={availableTags.length > 0 ? availableTags : allTags}
                        placeholder="All Tags"
                      />
                    )}

                    {/* Story 8-34: Seconds toggle - default ON for publisher algorithm page */}
                    <DisplaySettingsToggle defaultShowSeconds={true} compact />

                    <DisabledZmanimDialog localityId={localityId} />
                    <DeletedZmanimDialog />

                    <Button
                      variant="default"
                      onClick={() => router.push('/publisher/registry')}
                      className="flex items-center gap-2 whitespace-nowrap"
                    >
                      <Library className="h-4 w-4" />
                      Browse Registry
                    </Button>
                  </div>
                </div>

                {/* Filter Tabs */}
                <Tabs value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
                  <div className="overflow-x-auto -mx-4 px-4 sm:overflow-visible sm:mx-0 sm:px-0 scrollbar-hide">
                  <TabsList className="w-max sm:w-full h-auto justify-start gap-1">
                    <TabsTrigger value="all">
                      All ({localityId ? currentViewCount : '--'})
                    </TabsTrigger>
                    <StatusTooltip status="published" tooltip={STATUS_TOOLTIPS.published}>
                      <TabsTrigger value="published">
                        Published ({localityId ? currentViewPublishedCount : '--'})
                      </TabsTrigger>
                    </StatusTooltip>
                    <StatusTooltip status="draft" tooltip={STATUS_TOOLTIPS.draft}>
                      <TabsTrigger value="draft">
                        Draft ({localityId ? currentViewDraftCount : '--'})
                      </TabsTrigger>
                    </StatusTooltip>
                    <StatusTooltip status="core" tooltip={ALGORITHM_TOOLTIPS.core_zman}>
                      <TabsTrigger value="essential">
                        Core ({localityId ? currentViewCoreCount : '--'})
                      </TabsTrigger>
                    </StatusTooltip>
                    <StatusTooltip status="optional" tooltip={ALGORITHM_TOOLTIPS.optional_zman}>
                      <TabsTrigger value="optional">
                        Optional ({localityId ? currentViewOptionalCount : '--'})
                      </TabsTrigger>
                    </StatusTooltip>
                    {(localityId ? currentViewHiddenCount : 0) > 0 && (
                      <TabsTrigger value="hidden" className="text-muted-foreground">
                        Hidden ({currentViewHiddenCount})
                      </TabsTrigger>
                    )}
                  </TabsList>
                  </div>
                </Tabs>
              </CardContent>
            </Card>

            {/* Zmanim List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {viewMode === 'everyday' ? 'Everyday Zmanim' : 'Event Zmanim'}
                    </CardTitle>
                    <CardDescription>
                      {!localityId
                        ? 'Select a location to view zmanim'
                        : viewMode === 'everyday'
                          ? `${filteredZmanim.length} daily solar calculation times ${filterType !== 'all' || tagFilter !== 'all' ? '(filtered)' : ''}`
                          : `${filteredZmanim.length} Shabbos, holiday, and fast day times ${filterType !== 'all' || tagFilter !== 'all' ? '(filtered)' : ''}`}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* No Locality Selected State - Show placeholder instead of empty zmanim */}
                {!localityId ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <MapPin className="h-12 w-12 text-amber-500 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Location Selected</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      To preview and configure your zmanim calculations, select a locality from the toolbar above.
                    </p>
                  </div>
                ) : (
                  <ZmanGrid
                    zmanim={filteredZmanim}
                    category="core" // This is just for styling, actual display_status comes from zman
                    onEdit={handleEditZman}
                    displayLanguage={displayLanguage}
                    allZmanim={zmanim}
                    previewTimes={previewTimes}
                    focusZmanKey={focusZmanKey}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Live Preview (sticky) */}
          <div className="hidden lg:block">
            <div className="sticky top-6">
              <AlgorithmPreview
                zmanim={zmanim}
                dayContext={dayContext}
                displayLanguage={displayLanguage}
                isLoading={isLoading}
                error={zmanimError?.message || null}
                hasCoverage={!!localityId}
              />
            </div>
          </div>
        </div>}

        {/* Mobile Live Preview (shown below content on small screens) - only show when coverage exists */}
        {hasCoverage && (
          <div className="lg:hidden mt-6">
            <AlgorithmPreview
              zmanim={zmanim}
              dayContext={dayContext}
              displayLanguage={displayLanguage}
              isLoading={isLoading}
              error={zmanimError?.message || null}
              hasCoverage={!!localityId}
            />
          </div>
        )}

        {/* Week View Dialog - Shows all zmanim (event zmanim filtered by day) */}
        <Dialog open={showMonthView} onOpenChange={setShowMonthView}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Week Preview</DialogTitle>
            </DialogHeader>
            {localityId ? (
              <WeekPreview localityId={String(localityId)} displayName={localityDisplayName || 'Selected Location'} initialDate={new Date(selectedDateStr + 'T12:00:00')} displayLanguage={displayLanguage} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm font-medium">No Location Selected</p>
                <p className="text-xs mt-1">Select a locality to see week preview</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Zmanim</DialogTitle>
              <DialogDescription>
                Choose how to add zmanim to your algorithm
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={handleImportDefaults}
                disabled={importZmanim.isPending}
              >
                <div className="text-left">
                  <div className="font-medium">Import Default Templates</div>
                  <div className="text-sm text-muted-foreground">
                    Add all 18 standard zmanim based on common halachic methods
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => {
                  setShowImportDialog(false);
                }}
              >
                <div className="text-left">
                  <div className="font-medium">Copy from Another Publisher</div>
                  <div className="text-sm text-muted-foreground">
                    Browse and copy algorithms from other publishers
                  </div>
                </div>
              </Button>
            </div>
          </DialogContent>
        </Dialog>


        {/* Version Control Dialogs */}
        <SaveVersionDialog
          open={showSaveVersionDialog}
          onOpenChange={setShowSaveVersionDialog}
        />
        <VersionHistoryDialog
          open={showVersionHistoryDialog}
          onOpenChange={setShowVersionHistoryDialog}
          onRestore={() => refetch()}
        />
        <ImportSnapshotDialog
          open={showImportSnapshotDialog}
          onOpenChange={setShowImportSnapshotDialog}
          onSuccess={() => refetch()}
        />

        {/* Year Export Dialog */}
        <YearExportDialog
          open={showYearExportDialog}
          onOpenChange={setShowYearExportDialog}
          defaultLocalityId={localityId || undefined}
          defaultLocalityName={localityDisplayName || undefined}
        />

        {/* Zmanim PDF Report Dialog */}
        <ZmanimReportDialog
          open={showZmanimReportDialog}
          onOpenChange={setShowZmanimReportDialog}
          defaultLocalityId={localityId || undefined}
          defaultLocalityName={localityDisplayName || undefined}
        />

        {/* Restart Wizard Confirmation Dialog */}
        <AlertDialog open={showRestartConfirm} onOpenChange={setShowRestartConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Restart Setup Wizard?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  This will <strong>permanently delete</strong> all your current zmanim and coverage areas.
                  You will start fresh with the setup wizard.
                </p>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-amber-800 dark:text-amber-200 text-sm">
                  <strong>Warning:</strong> This action cannot be undone. All zmanim and coverage areas will be permanently deleted.
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRestartWizard}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete & Restart
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
