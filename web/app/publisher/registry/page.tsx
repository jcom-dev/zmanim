'use client';

import { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePublisherContext } from '@/providers/PublisherContext';
import { useApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Library,
  Users,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Import,
  Check,
  Loader2,
  Info,
  AlertCircle,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import { MasterZmanDetailModal } from '@/components/registry/MasterZmanDetailModal';
import { RegistryPublisherBrowser } from '@/components/registry/RegistryPublisherBrowser';
import { RequestZmanModal } from '@/components/publisher/RequestZmanModal';
import { PlusCircle } from 'lucide-react';
import { PreviewToolbar } from '@/components/shared/PreviewToolbar';
import { usePreviewToolbar } from '@/lib/hooks/usePreviewToolbar';
import { usePublisherCoverage } from '@/lib/hooks/usePublisherCoverage';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Types
interface ZmanTag {
  id: number;
  tag_key: string;
  name: string;
  display_name_hebrew: string;
  display_name_english: string;
  display_name_english_ashkenazi: string;
  display_name_english_sephardi?: string;
  tag_type: string;
  description?: string;
  color?: string;
  is_negated: boolean;
  created_at: string;
}

interface MasterZmanForRegistry {
  id: string;
  zman_key: string;
  canonical_hebrew_name: string;
  canonical_english_name: string;
  transliteration?: string;
  description?: string;
  default_formula_dsl?: string;
  time_category?: string;
  is_core?: boolean;
  already_imported: boolean;
  existing_is_deleted: boolean;
  preview_time?: string;
  tags?: ZmanTag[];
}

interface RegistryBrowserResponse {
  items: MasterZmanForRegistry[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface RegistryFilterTag {
  id: number;
  tag_key: string;
  display_name: string;
}

interface RegistryFiltersResponse {
  categories: RegistryFilterTag[];
  shitas: RegistryFilterTag[];
}

// Category colors (keyed by tag_key)
const categoryColors: Record<string, string> = {
  alos: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  misheyakir: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  shema: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  tefilla: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  chatzos: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  mincha: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  plag: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  shkia: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  bein_hashmashos: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  tzais: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  candle_lighting: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  special: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300',
};

// Shita colors (keyed by tag_key)
const shitaColors: Record<string, string> = {
  gra: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  mga: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  baal_hatanya: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  rabbeinu_tam: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  geonim: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  ateret_torah: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  yereim: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  ahavat_shalom: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

// Helper to get category tag from zman's tags array
function getCategoryTag(tags?: ZmanTag[]): ZmanTag | undefined {
  return tags?.find(t => t.tag_type === 'category');
}

// Helper to get shita tag from zman's tags array
function getShitaTag(tags?: ZmanTag[]): ZmanTag | undefined {
  return tags?.find(t => t.tag_type === 'shita');
}

// Zman Card Component
function ZmanCard({
  zman,
  onImport,
  onInfo,
  isImporting,
  isHebrew,
}: {
  zman: MasterZmanForRegistry;
  onImport: (id: string) => void;
  onInfo: (id: string) => void;
  isImporting: boolean;
  isHebrew: boolean;
}) {
  // Get the display name based on language preference
  const displayName = isHebrew ? zman.canonical_hebrew_name : zman.canonical_english_name;

  // Extract category and shita tags
  const categoryTag = getCategoryTag(zman.tags);
  const shitaTag = getShitaTag(zman.tags);

  return (
    <Card
      className="relative overflow-hidden"
      data-testid="zman-card"
      data-zman-key={zman.zman_key}
      data-master-zman-id={zman.id}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Name and Preview Time */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3
                    className={`font-medium text-foreground truncate ${isHebrew ? 'font-hebrew' : ''}`}
                    dir={isHebrew ? 'rtl' : 'ltr'}
                  >
                    {displayName}
                  </h3>
                  <span className="text-xs font-mono text-muted-foreground/70">
                    @{zman.zman_key}
                  </span>
                </div>
              </div>
              {zman.preview_time && (
                <div className="shrink-0 text-right">
                  <div className="text-lg font-semibold text-primary tabular-nums" data-testid="preview-time">
                    {zman.preview_time}
                  </div>
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {categoryTag && (
                <Badge variant="outline" className={`text-xs ${categoryColors[categoryTag.tag_key] || ''}`}>
                  {categoryTag.display_name_english_ashkenazi}
                </Badge>
              )}
              {shitaTag && (
                <Badge variant="outline" className={`text-xs ${shitaColors[shitaTag.tag_key] || ''}`}>
                  {shitaTag.display_name_english_ashkenazi}
                </Badge>
              )}
              {zman.is_core && (
                <Badge variant="secondary" className="text-xs">
                  Core
                </Badge>
              )}
            </div>

            {/* Formula */}
            {zman.default_formula_dsl && (
              <div className="bg-muted/50 rounded-md p-2 mb-3">
                <code className="text-xs font-mono text-muted-foreground break-all">
                  {zman.default_formula_dsl}
                </code>
              </div>
            )}

            {/* Description */}
            {zman.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {zman.description}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="shrink-0 flex flex-col gap-2">
            {/* Info Button */}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onInfo(zman.id)}
              aria-label="Info"
            >
              <Info className="h-4 w-4" />
            </Button>
            {/* Import Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="sm"
                      variant={zman.already_imported ? 'ghost' : 'default'}
                      disabled={zman.already_imported || isImporting}
                      onClick={() => onImport(zman.id)}
                      className="gap-1"
                    >
                      {isImporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : zman.already_imported ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Import className="h-4 w-4" />
                      )}
                      {zman.already_imported ? 'Imported' : 'Import'}
                    </Button>
                  </span>
                </TooltipTrigger>
                {zman.already_imported && (
                  <TooltipContent>
                    {zman.existing_is_deleted ? (
                      <p>This zman is in your deleted items. Restore it to use it again.</p>
                    ) : (
                      <p>This zman is already in your catalog</p>
                    )}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Filter Panel Component
function FilterPanel({
  filters,
  selectedCategoryIds,
  selectedShitaIds,
  status,
  onCategoryChange,
  onShitaChange,
  onStatusChange,
  onClear,
}: {
  filters?: RegistryFiltersResponse;
  selectedCategoryIds: number[];
  selectedShitaIds: number[];
  status: string;
  onCategoryChange: (ids: number[]) => void;
  onShitaChange: (ids: number[]) => void;
  onStatusChange: (status: string) => void;
  onClear: () => void;
}) {
  const hasFilters = selectedCategoryIds.length > 0 || selectedShitaIds.length > 0 || status !== 'all';

  return (
    <div className="space-y-6">
      {/* Status Filter */}
      <div>
        <h4 className="text-sm font-medium mb-3">Status</h4>
        <div className="space-y-2">
          {[
            { value: 'all', label: 'All Zmanim' },
            { value: 'available', label: 'Available to Import' },
            { value: 'imported', label: 'Already Imported' },
          ].map(({ value, label }) => (
            <div key={value} className="flex items-center space-x-2">
              <input
                type="radio"
                id={`status-${value}`}
                name="status"
                value={value}
                checked={status === value}
                onChange={(e) => onStatusChange(e.target.value)}
                className="h-4 w-4"
              />
              <Label htmlFor={`status-${value}`} className="text-sm cursor-pointer">
                {label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      {filters?.categories && filters.categories.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3">Category</h4>
          <ScrollArea className="h-48">
            <div className="space-y-2 pr-4">
              {filters.categories.map((cat) => (
                <div key={cat.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cat-${cat.id}`}
                    checked={selectedCategoryIds.includes(cat.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onCategoryChange([...selectedCategoryIds, cat.id]);
                      } else {
                        onCategoryChange(selectedCategoryIds.filter((id) => id !== cat.id));
                      }
                    }}
                  />
                  <Label htmlFor={`cat-${cat.id}`} className="text-sm cursor-pointer">
                    {cat.display_name}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Shita Filter */}
      {filters?.shitas && filters.shitas.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3">Shita</h4>
          <ScrollArea className="h-48">
            <div className="space-y-2 pr-4">
              {filters.shitas.map((shita) => (
                <div key={shita.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`shita-${shita.id}`}
                    checked={selectedShitaIds.includes(shita.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onShitaChange([...selectedShitaIds, shita.id]);
                      } else {
                        onShitaChange(selectedShitaIds.filter((id) => id !== shita.id));
                      }
                    }}
                  />
                  <Label htmlFor={`shita-${shita.id}`} className="text-sm cursor-pointer">
                    {shita.display_name}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Clear Filters */}
      {hasFilters && (
        <Button variant="outline" size="sm" onClick={onClear} className="w-full">
          <X className="h-4 w-4 mr-2" />
          Clear All Filters
        </Button>
      )}
    </div>
  );
}

// Main Registry Page
export default function RegistryPage() {
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();
  const { selectedPublisher } = usePublisherContext();

  // Get coverage data to determine if publisher is global
  const { coverage } = usePublisherCoverage();
  const isGlobalPublisher = coverage?.is_global ?? false;

  // Get toolbar state for use in the page
  const toolbar = usePreviewToolbar({
    storageKey: 'publisher_registry',
    restrictToCoverage: false,
    publisherId: selectedPublisher?.id ? parseInt(selectedPublisher.id, 10) : undefined,
    isGlobalPublisher,
  });

  // State
  const [activeTab, setActiveTab] = useState<'master' | 'publishers'>('master');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedShitaIds, setSelectedShitaIds] = useState<number[]>([]);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [documentationModalId, setDocumentationModalId] = useState<string | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);

  const limit = 50;

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', limit.toString());
    // Strip leading @ for zman_key searches
    if (deferredSearch) {
      const searchTerm = deferredSearch.startsWith('@') ? deferredSearch.slice(1) : deferredSearch;
      params.set('search', searchTerm);
    }
    if (status && status !== 'all') params.set('status', status);
    if (selectedCategoryIds.length > 0) {
      params.set('category_tag_ids', selectedCategoryIds.join(','));
    }
    if (selectedShitaIds.length > 0) {
      params.set('shita_tag_ids', selectedShitaIds.join(','));
    }
    if (toolbar.localityId) {
      params.set('locality_id', toolbar.localityId.toString());
      params.set('date', toolbar.date);
    }
    return params.toString();
  }, [page, deferredSearch, status, selectedCategoryIds, selectedShitaIds, toolbar.localityId, toolbar.date]);

  // Fetch master zmanim
  const {
    data: registryData,
    isLoading,
    error,
    refetch,
  } = useQuery<RegistryBrowserResponse>({
    queryKey: ['registry-master', queryParams, selectedPublisher?.id],
    queryFn: () => api.get<RegistryBrowserResponse>(`/publisher/registry/master?${queryParams}`),
    enabled: !!selectedPublisher?.id,
  });

  // Fetch filter options
  const { data: filters } = useQuery<RegistryFiltersResponse>({
    queryKey: ['registry-filters', selectedPublisher?.id],
    queryFn: () => api.get<RegistryFiltersResponse>('/publisher/registry/filters'),
    enabled: !!selectedPublisher?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Reset page when filters change
  const handleFilterChange = useCallback(<T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setPage(1);
  }, []);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSelectedCategoryIds([]);
    setSelectedShitaIds([]);
    setStatus('all');
    setSearchQuery('');
    setPage(1);
  }, []);

  // Import zman
  const handleImport = async (masterZmanId: string) => {
    if (importingId) return;

    setImportingId(masterZmanId);
    try {
      await api.post('/publisher/zmanim', { body: JSON.stringify({ master_zman_id: masterZmanId }) });
      toast.success('Zman imported successfully');

      // Find the zman to get the key for redirect
      const zman = registryData?.items.find((z) => z.id === masterZmanId);

      // Invalidate queries to refresh data - await to ensure cache updates before redirect
      await Promise.all([
        refetch(), // Refetch registry to update already_imported status
        queryClient.invalidateQueries({ queryKey: ['publisher-zmanim'] }),
        queryClient.invalidateQueries({ queryKey: ['publisher-zmanim-with-locality'] }),
      ]);

      // Redirect to algorithm page with focus
      if (zman) {
        router.push(`/publisher/algorithm?focus=${zman.zman_key}`);
      }
    } catch (err: unknown) {
      console.error('Failed to import zman:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to import zman';
      toast.error(errorMessage);
    } finally {
      setImportingId(null);
    }
  };

  // Active filter chips
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    selectedCategoryIds.forEach((id) => {
      const cat = filters?.categories.find((c) => c.id === id);
      chips.push({
        key: `cat-${id}`,
        label: cat?.display_name || `Category ${id}`,
        onRemove: () => setSelectedCategoryIds(selectedCategoryIds.filter((c) => c !== id)),
      });
    });

    selectedShitaIds.forEach((id) => {
      const shita = filters?.shitas.find((s) => s.id === id);
      chips.push({
        key: `shita-${id}`,
        label: shita?.display_name || `Shita ${id}`,
        onRemove: () => setSelectedShitaIds(selectedShitaIds.filter((s) => s !== id)),
      });
    });

    if (status === 'available') {
      chips.push({
        key: 'status-available',
        label: 'Available',
        onRemove: () => setStatus('all'),
      });
    } else if (status === 'imported') {
      chips.push({
        key: 'status-imported',
        label: 'Imported',
        onRemove: () => setStatus('all'),
      });
    }

    return chips;
  }, [selectedCategoryIds, selectedShitaIds, status, filters]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
                Zmanim Registry
              </h1>
              <p className="text-muted-foreground">
                Browse and import zmanim from the master registry or other publishers
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowRequestModal(true)}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Request Addition
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/publisher/algorithm')}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back to Zmanim
              </Button>
            </div>
          </div>

          {/* Preview Toolbar */}
          <PreviewToolbar
            storageKey="publisher_registry"
            restrictToCoverage={false}
            publisherId={selectedPublisher?.id ? parseInt(selectedPublisher.id, 10) : undefined}
            isGlobalPublisher={isGlobalPublisher}
            showCoverageIndicator={false}
            showDatePicker={true}
            showLanguageToggle={true}
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'master' | 'publishers')}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="master" className="gap-2">
              <Library className="h-4 w-4" />
              Master Registry
              <Badge variant="secondary" className="ml-1">
                {registryData?.total ?? '...'}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="publishers" className="gap-2">
              <Users className="h-4 w-4" />
              Publisher Examples
            </TabsTrigger>
          </TabsList>

          <TabsContent value="master">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
              {/* Desktop Filter Panel */}
              <div className="hidden lg:block">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Filters
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FilterPanel
                      filters={filters}
                      selectedCategoryIds={selectedCategoryIds}
                      selectedShitaIds={selectedShitaIds}
                      status={status}
                      onCategoryChange={(ids) => handleFilterChange(setSelectedCategoryIds, ids)}
                      onShitaChange={(ids) => handleFilterChange(setSelectedShitaIds, ids)}
                      onStatusChange={(s) => handleFilterChange(setStatus, s)}
                      onClear={handleClearFilters}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Main Content */}
              <div className="space-y-4">
                {/* Search and Mobile Filter */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by key (@alos_hashachar)..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="pl-10"
                    />
                  </div>
                  <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" className="lg:hidden gap-2">
                        <Filter className="h-4 w-4" />
                        Filters
                        {activeFilters.length > 0 && (
                          <Badge variant="secondary" className="ml-1">
                            {activeFilters.length}
                          </Badge>
                        )}
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-80">
                      <SheetHeader>
                        <SheetTitle>Filters</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        <FilterPanel
                          filters={filters}
                          selectedCategoryIds={selectedCategoryIds}
                          selectedShitaIds={selectedShitaIds}
                          status={status}
                          onCategoryChange={(ids) => handleFilterChange(setSelectedCategoryIds, ids)}
                          onShitaChange={(ids) => handleFilterChange(setSelectedShitaIds, ids)}
                          onStatusChange={(s) => handleFilterChange(setStatus, s)}
                          onClear={handleClearFilters}
                        />
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>

                {/* Active Filter Chips */}
                {activeFilters.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {activeFilters.map((filter) => (
                      <Badge
                        key={filter.key}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
                        {filter.label}
                        <button
                          onClick={filter.onRemove}
                          className="ml-1 p-0.5 hover:bg-muted rounded-sm"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="h-6 px-2 text-xs"
                    >
                      Clear all
                    </Button>
                  </div>
                )}

                {/* Results */}
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : error ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-destructive">Failed to load zmanim. Please try again.</p>
                    </CardContent>
                  </Card>
                ) : registryData?.items.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No zmanim found</h3>
                      <p className="text-muted-foreground mb-4">
                        Try adjusting your search or filters.
                      </p>
                      <Button variant="outline" onClick={handleClearFilters}>
                        Clear All Filters
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Results count */}
                    <p className="text-sm text-muted-foreground">
                      Showing {registryData?.items.length} of {registryData?.total} zmanim
                    </p>

                    {/* Zman Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {registryData?.items.map((zman) => (
                        <ZmanCard
                          key={zman.id}
                          zman={zman}
                          onImport={handleImport}
                          onInfo={(id) => setDocumentationModalId(id)}
                          isImporting={importingId === zman.id}
                          isHebrew={toolbar.isHebrew}
                        />
                      ))}
                    </div>

                    {/* Pagination */}
                    {registryData && registryData.total_pages > 1 && (
                      <div className="flex items-center justify-center gap-4 pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => p - 1)}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {page} of {registryData.total_pages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= registryData.total_pages}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="publishers">
            <RegistryPublisherBrowser />
          </TabsContent>
        </Tabs>
      </div>

      {/* Master Zman Documentation Modal */}
      <MasterZmanDetailModal
        masterZmanId={documentationModalId}
        isOpen={!!documentationModalId}
        onClose={() => setDocumentationModalId(null)}
        localityId={toolbar.localityId || undefined}
      />

      {/* Request Addition Modal */}
      <RequestZmanModal
        open={showRequestModal}
        onOpenChange={setShowRequestModal}
        onSuccess={() => {
          toast.success('Request submitted. Admin review pending.');
          setShowRequestModal(false);
        }}
      />
    </div>
  );
}
