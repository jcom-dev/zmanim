'use client';

import { useState, useMemo, useCallback, useDeferredValue, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Link as LinkIcon,
  Copy,
  Check,
  Loader2,
  Info,
  MapPin,
  Users,
  AlertCircle,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { HighlightedFormula } from '@/components/shared/HighlightedFormula';
import { PublisherZmanDetailModal } from './PublisherZmanDetailModal';
import { MasterZmanDetailModal } from './MasterZmanDetailModal';
import { cn } from '@/lib/utils';

// Types
interface ValidatedPublisher {
  id: string;
  name: string;
  description?: string;
}

interface PublisherZmanForExamples {
  id: string;
  zman_key: string;
  hebrew_name: string;
  english_name: string;
  description?: string;
  formula_dsl?: string;
  master_zman_id?: string;
  master_english_name?: string;
  category?: string;
  shita?: string;
  already_have_master: boolean;
  existing_is_deleted: boolean;
}

interface PublisherZmanimResponse {
  publisher: {
    id: string;
    name: string;
    description?: string;
  };
  zmanim: PublisherZmanForExamples[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface CoverageLocality {
  id: string;
  name: string;
  region?: string;
  country_name: string;
  latitude: number;
  longitude: number;
}

interface CoverageLocalitiesResponse {
  localities: CoverageLocality[];
}

// Category colors (reused from master registry)
const categoryColors: Record<string, string> = {
  ALOS: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  MISHEYAKIR: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  SHEMA: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  TEFILLA: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  CHATZOS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  MINCHA: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  PLAG: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  SHKIA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  BEIN_HASHMASHOS: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  TZAIS: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  CANDLE_LIGHTING: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  SPECIAL: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300',
};

// Shita colors
const shitaColors: Record<string, string> = {
  GRA: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  MGA: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  BAAL_HATANYA: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  RABBEINU_TAM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  GEONIM: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  ATERET_TORAH: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  YEREIM: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  AHAVAT_SHALOM: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  UNIVERSAL: 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300',
};

function formatCategory(category: string): string {
  return category
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formatShita(shita: string): string {
  const displayNames: Record<string, string> = {
    GRA: 'GRA (Vilna Gaon)',
    MGA: 'MGA (Magen Avraham)',
    BAAL_HATANYA: 'Baal HaTanya',
    RABBEINU_TAM: 'Rabbeinu Tam',
    GEONIM: 'Geonim',
    ATERET_TORAH: 'Ateret Torah',
    YEREIM: 'Yereim',
    AHAVAT_SHALOM: 'Ahavat Shalom',
    UNIVERSAL: 'Universal',
  };
  return displayNames[shita] || formatCategory(shita);
}

// Publisher Search Combobox
function PublisherSearchCombobox({
  publishers,
  selectedPublisher,
  onSelect,
  isLoading,
}: {
  publishers: ValidatedPublisher[];
  selectedPublisher: ValidatedPublisher | null;
  onSelect: (publisher: ValidatedPublisher | null) => void;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const filteredPublishers = useMemo(() => {
    if (!searchValue) return publishers;
    const lower = searchValue.toLowerCase();
    return publishers.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        (p.description && p.description.toLowerCase().includes(lower))
    );
  }, [publishers, searchValue]);

  // Handle keyboard input on the button to open popover and start searching
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // If user types a character, open the popover and start searching
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setSearchValue(e.key);
      setOpen(true);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto py-2"
          data-testid="publisher-selector"
          onKeyDown={handleKeyDown}
        >
          {selectedPublisher ? (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" />
              <div className="text-left">
                <div className="font-medium" data-testid="selected-publisher-name">{selectedPublisher.name}</div>
                {selectedPublisher.description && (
                  <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {selectedPublisher.description}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">Search for a publisher...</span>
          )}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start" data-testid="publisher-selector-popover" role="dialog">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search publishers..."
            value={searchValue}
            onValueChange={setSearchValue}
            data-testid="publisher-search-input"
            aria-label="Search publishers"
          />
          <CommandList data-testid="publisher-options-list" role="listbox">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : filteredPublishers.length === 0 ? (
              <CommandEmpty>No publishers found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredPublishers.map((publisher) => (
                  <CommandItem
                    key={publisher.id}
                    value={publisher.id}
                    onSelect={() => {
                      onSelect(publisher);
                      setOpen(false);
                      setSearchValue('');
                    }}
                    className="flex items-start gap-2 p-2"
                    data-testid={`publisher-option-${publisher.id}`}
                    role="option"
                    aria-selected={selectedPublisher?.id === publisher.id}
                  >
                    <Users className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{publisher.name}</div>
                      {publisher.description && (
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {publisher.description}
                        </div>
                      )}
                    </div>
                    {selectedPublisher?.id === publisher.id && (
                      <Check className="h-4 w-4 shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Location Picker (coverage-restricted)
function CoverageLocationPicker({
  publisherId,
  selectedLocation,
  onSelect,
}: {
  publisherId: string | null;
  selectedLocation: CoverageLocality | null;
  onSelect: (location: CoverageLocality | null) => void;
}) {
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const { data, isLoading } = useQuery<CoverageLocalitiesResponse>({
    queryKey: ['publisher-coverage', publisherId],
    queryFn: () => api.get<CoverageLocalitiesResponse>(`/publisher/registry/coverage/${publisherId}`),
    enabled: !!publisherId,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });

  const localities = data?.localities || [];

  const filteredLocalities = useMemo(() => {
    if (!searchValue) return localities.slice(0, 50); // Limit initial display
    const lower = searchValue.toLowerCase();
    return localities
      .filter(
        (l) =>
          l.name.toLowerCase().includes(lower) ||
          l.country_name.toLowerCase().includes(lower) ||
          (l.region && l.region.toLowerCase().includes(lower))
      )
      .slice(0, 50);
  }, [localities, searchValue]);

  if (!publisherId) {
    return (
      <Button variant="outline" disabled className="w-full justify-start text-muted-foreground" data-testid="location-selector-disabled">
        <MapPin className="mr-2 h-4 w-4" />
        Select a publisher first to choose a location
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          data-testid="location-selector"
        >
          {selectedLocation ? (
            <span className="truncate">
              {selectedLocation.name}, {selectedLocation.region ? `${selectedLocation.region}, ` : ''}
              {selectedLocation.country_name}
            </span>
          ) : (
            <span className="text-muted-foreground">Select a location...</span>
          )}
          <MapPin className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start" data-testid="location-selector-popover">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search locations..."
            value={searchValue}
            onValueChange={setSearchValue}
            data-testid="location-search-input"
          />
          <CommandList data-testid="location-options-list">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : localities.length === 0 ? (
              <CommandEmpty>This publisher has no coverage areas.</CommandEmpty>
            ) : filteredLocalities.length === 0 ? (
              <CommandEmpty>No matching locations found.</CommandEmpty>
            ) : (
              <CommandGroup heading={`${localities.length} coverage locations`}>
                {filteredLocalities.map((locality) => (
                  <CommandItem
                    key={locality.id}
                    value={locality.id}
                    onSelect={() => {
                      onSelect(locality);
                      setOpen(false);
                      setSearchValue('');
                    }}
                    data-testid={`location-option-${locality.id}`}
                  >
                    <MapPin className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {locality.name}
                      {locality.region && `, ${locality.region}`}
                      , {locality.country_name}
                    </span>
                    {selectedLocation?.id === locality.id && (
                      <Check className="ml-auto h-4 w-4" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Publisher Zman Card
function PublisherZmanCard({
  zman,
  publisherName,
  onLink,
  onCopy,
  onInfo,
  isProcessing,
}: {
  zman: PublisherZmanForExamples;
  publisherName: string;
  onLink: (id: string) => void;
  onCopy: (id: string) => void;
  onInfo: (id: string) => void;
  isProcessing: string | null;
}) {
  const isDisabled = zman.already_have_master;
  const isCurrentlyProcessing = isProcessing === zman.id;

  return (
    <Card className="relative overflow-hidden" data-testid="publisher-zman-card">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Names */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-foreground truncate" data-testid="zman-hebrew-name">
                {zman.hebrew_name}
              </h3>
              {isDisabled && (
                <Badge
                  variant={zman.existing_is_deleted ? "destructive" : "secondary"}
                  className="text-xs flex items-center gap-1 shrink-0"
                  data-testid="zman-status-badge"
                >
                  {zman.existing_is_deleted ? (
                    <>
                      <AlertCircle className="h-3 w-3" />
                      In Deleted Items
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3" />
                      Already in Your Catalog
                    </>
                  )}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-2 truncate" data-testid="zman-english-name">
              {zman.english_name}
            </p>

            {/* Publisher + Master Reference */}
            <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
              <Badge variant="outline" className="gap-1" data-testid="publisher-name-badge">
                <Users className="h-3 w-3" />
                {publisherName}
              </Badge>
              {zman.master_english_name && (
                <span className="text-muted-foreground">
                  Master: {zman.master_english_name}
                </span>
              )}
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {zman.category && (
                <Badge variant="outline" className={`text-xs ${categoryColors[zman.category] || ''}`}>
                  {formatCategory(zman.category)}
                </Badge>
              )}
              {zman.shita && (
                <Badge variant="outline" className={`text-xs ${shitaColors[zman.shita] || ''}`}>
                  {formatShita(zman.shita).split(' ')[0]}
                </Badge>
              )}
            </div>

            {/* Formula */}
            {zman.formula_dsl && (
              <div className="bg-muted/50 rounded-md p-2 mb-3" data-testid="zman-formula">
                <HighlightedFormula formula={zman.formula_dsl} inline />
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
              data-testid="zman-info-button"
            >
              <Info className="h-4 w-4" />
            </Button>

            {/* Link Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isDisabled || isCurrentlyProcessing}
                      onClick={() => onLink(zman.id)}
                      className="gap-1"
                      aria-label="Link"
                      data-testid="zman-link-button"
                    >
                      {isCurrentlyProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LinkIcon className="h-4 w-4" />
                      )}
                      Link
                    </Button>
                  </span>
                </TooltipTrigger>
                {isDisabled && (
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

            {/* Copy Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="sm"
                      variant="default"
                      disabled={isDisabled || isCurrentlyProcessing}
                      onClick={() => onCopy(zman.id)}
                      className="gap-1"
                      aria-label="Copy"
                      data-testid="zman-copy-button"
                    >
                      {isCurrentlyProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      Copy
                    </Button>
                  </span>
                </TooltipTrigger>
                {isDisabled && (
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

// Filter Panel for Publisher Zmanim
function PublisherFilterPanel({
  categories,
  shitas,
  selectedCategories,
  selectedShitas,
  status,
  onCategoryChange,
  onShitaChange,
  onStatusChange,
  onClear,
}: {
  categories: string[];
  shitas: string[];
  selectedCategories: string[];
  selectedShitas: string[];
  status: string;
  onCategoryChange: (categories: string[]) => void;
  onShitaChange: (shitas: string[]) => void;
  onStatusChange: (status: string) => void;
  onClear: () => void;
}) {
  const hasFilters = selectedCategories.length > 0 || selectedShitas.length > 0 || status !== 'all';

  return (
    <div className="space-y-6">
      {/* Status Filter */}
      <div>
        <h4 className="text-sm font-medium mb-3">Status</h4>
        <div className="space-y-2">
          {[
            { value: 'all', label: 'All Zmanim' },
            { value: 'available', label: 'Available to Link/Copy' },
            { value: 'owned', label: 'Already in My Catalog' },
          ].map(({ value, label }) => (
            <div key={value} className="flex items-center space-x-2">
              <input
                type="radio"
                id={`pub-status-${value}`}
                name="pub-status"
                value={value}
                checked={status === value}
                onChange={(e) => onStatusChange(e.target.value)}
                className="h-4 w-4"
              />
              <Label htmlFor={`pub-status-${value}`} className="text-sm cursor-pointer">
                {label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3">Category</h4>
          <ScrollArea className="h-48">
            <div className="space-y-2 pr-4">
              {categories.map((cat) => (
                <div key={cat} className="flex items-center space-x-2">
                  <Checkbox
                    id={`pub-cat-${cat}`}
                    checked={selectedCategories.includes(cat)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onCategoryChange([...selectedCategories, cat]);
                      } else {
                        onCategoryChange(selectedCategories.filter((c) => c !== cat));
                      }
                    }}
                  />
                  <Label htmlFor={`pub-cat-${cat}`} className="text-sm cursor-pointer">
                    {formatCategory(cat)}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Shita Filter */}
      {shitas.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3">Shita</h4>
          <ScrollArea className="h-48">
            <div className="space-y-2 pr-4">
              {shitas.map((shita) => (
                <div key={shita} className="flex items-center space-x-2">
                  <Checkbox
                    id={`pub-shita-${shita}`}
                    checked={selectedShitas.includes(shita)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onShitaChange([...selectedShitas, shita]);
                      } else {
                        onShitaChange(selectedShitas.filter((s) => s !== shita));
                      }
                    }}
                  />
                  <Label htmlFor={`pub-shita-${shita}`} className="text-sm cursor-pointer">
                    {formatShita(shita)}
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

// Main Component
export function RegistryPublisherBrowser() {
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();

  // State
  const [selectedPublisher, setSelectedPublisher] = useState<ValidatedPublisher | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<CoverageLocality | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedShitas, setSelectedShitas] = useState<string[]>([]);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Documentation modals (Story 11.4)
  const [publisherZmanDocId, setPublisherZmanDocId] = useState<string | null>(null);
  const [masterZmanDocId, setMasterZmanDocId] = useState<string | null>(null);

  const limit = 50;

  // Fetch validated publishers
  const { data: publishers = [], isLoading: publishersLoading } = useQuery<ValidatedPublisher[]>({
    queryKey: ['validated-publishers'],
    queryFn: () => api.get<ValidatedPublisher[]>('/publisher/registry/publishers'),
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  // Build query params for publisher zmanim
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', limit.toString());
    if (deferredSearch) params.set('search', deferredSearch);
    if (status && status !== 'all') params.set('status', status);
    if (selectedCategories.length > 0) {
      params.set('category', selectedCategories.join(','));
    }
    if (selectedShitas.length > 0) {
      params.set('shita', selectedShitas.join(','));
    }
    if (selectedLocation) {
      params.set('locality_id', selectedLocation.id);
    }
    return params.toString();
  }, [page, deferredSearch, status, selectedCategories, selectedShitas, selectedLocation]);

  // Fetch publisher zmanim
  const {
    data: zmanimData,
    isLoading: zmanimLoading,
    error: zmanimError,
    refetch: refetchPublisherZmanim,
  } = useQuery<PublisherZmanimResponse>({
    queryKey: ['publisher-zmanim-examples', selectedPublisher?.id, queryParams],
    queryFn: () =>
      api.get<PublisherZmanimResponse>(
        `/publisher/registry/publishers/${selectedPublisher!.id}/zmanim?${queryParams}`
      ),
    enabled: !!selectedPublisher?.id,
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  // Get unique categories and shitas from response
  const availableCategories = useMemo(() => {
    if (!zmanimData?.zmanim) return [];
    const cats = new Set<string>();
    zmanimData.zmanim.forEach((z) => z.category && cats.add(z.category));
    return Array.from(cats).sort();
  }, [zmanimData?.zmanim]);

  const availableShitas = useMemo(() => {
    if (!zmanimData?.zmanim) return [];
    const shitas = new Set<string>();
    zmanimData.zmanim.forEach((z) => z.shita && shitas.add(z.shita));
    return Array.from(shitas).sort();
  }, [zmanimData?.zmanim]);

  // Reset location when publisher changes (AC-5)
  useEffect(() => {
    if (selectedPublisher && selectedLocation) {
      // Location will be validated by the coverage query
      // For now, just clear it when publisher changes
      setSelectedLocation(null);
    }
    // Reset filters and page when publisher changes
    setPage(1);
    setSearchQuery('');
  }, [selectedPublisher?.id]);

  // Reset page when filters change
  const handleFilterChange = useCallback(<T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setPage(1);
  }, []);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSelectedCategories([]);
    setSelectedShitas([]);
    setStatus('all');
    setSearchQuery('');
    setPage(1);
  }, []);

  // Link zman
  const handleLink = async (publisherZmanId: string) => {
    if (processingId) return;

    setProcessingId(publisherZmanId);
    try {
      const result = await api.post<{ zman_key: string; message: string }>(
        '/publisher/registry/link',
        { body: JSON.stringify({ publisher_zmanim_id: parseInt(publisherZmanId, 10) }) }
      );

      const zman = zmanimData?.zmanim.find((z) => z.id === publisherZmanId);
      toast.success(`Linked to ${selectedPublisher?.name}'s ${zman?.english_name || 'zman'}`);

      // Invalidate queries and refetch publisher browser to update already_have_master flags
      await Promise.all([
        refetchPublisherZmanim(), // Refetch publisher browser to show updated status
        queryClient.invalidateQueries({ queryKey: ['publisher-zmanim'] }),
        queryClient.invalidateQueries({ queryKey: ['publisher-zmanim-with-locality'] }),
      ]);

      // Redirect to algorithm page with focus
      router.push(`/publisher/algorithm?focus=${result.zman_key}`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error('Failed to link zman:', err);
      toast.error(error?.message || 'Failed to link zman');
    } finally {
      setProcessingId(null);
    }
  };

  // Copy zman
  const handleCopy = async (publisherZmanId: string) => {
    if (processingId) return;

    setProcessingId(publisherZmanId);
    try {
      const result = await api.post<{ zman_key: string; message: string }>(
        '/publisher/registry/copy',
        { body: JSON.stringify({ publisher_zmanim_id: parseInt(publisherZmanId, 10) }) }
      );

      const zman = zmanimData?.zmanim.find((z) => z.id === publisherZmanId);
      toast.success(`Copied ${zman?.english_name || 'zman'} from ${selectedPublisher?.name}`);

      // Invalidate queries and refetch publisher browser to update already_have_master flags
      await Promise.all([
        refetchPublisherZmanim(), // Refetch publisher browser to show updated status
        queryClient.invalidateQueries({ queryKey: ['publisher-zmanim'] }),
        queryClient.invalidateQueries({ queryKey: ['publisher-zmanim-with-locality'] }),
      ]);

      // Redirect to algorithm page with focus
      router.push(`/publisher/algorithm?focus=${result.zman_key}`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error('Failed to copy zman:', err);
      toast.error(error?.message || 'Failed to copy zman');
    } finally {
      setProcessingId(null);
    }
  };

  // Active filter chips
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    selectedCategories.forEach((cat) => {
      chips.push({
        key: `cat-${cat}`,
        label: formatCategory(cat),
        onRemove: () => setSelectedCategories(selectedCategories.filter((c) => c !== cat)),
      });
    });

    selectedShitas.forEach((shita) => {
      chips.push({
        key: `shita-${shita}`,
        label: formatShita(shita).split(' ')[0],
        onRemove: () => setSelectedShitas(selectedShitas.filter((s) => s !== shita)),
      });
    });

    if (status === 'available') {
      chips.push({
        key: 'status-available',
        label: 'Available',
        onRemove: () => setStatus('all'),
      });
    } else if (status === 'owned') {
      chips.push({
        key: 'status-owned',
        label: 'Already in My Catalog',
        onRemove: () => setStatus('all'),
      });
    }

    return chips;
  }, [selectedCategories, selectedShitas, status]);

  return (
    <div className="space-y-6">
      {/* Publisher Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Select a Publisher
          </CardTitle>
          <CardDescription>
            Search for a validated publisher to view their zmanim catalog
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PublisherSearchCombobox
            publishers={publishers}
            selectedPublisher={selectedPublisher}
            onSelect={setSelectedPublisher}
            isLoading={publishersLoading}
          />

          {/* Location Picker (coverage-restricted) */}
          {selectedPublisher && (
            <div>
              <Label className="text-sm mb-2 block">Location (for preview times)</Label>
              <CoverageLocationPicker
                publisherId={selectedPublisher.id}
                selectedLocation={selectedLocation}
                onSelect={setSelectedLocation}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* No Publisher Selected */}
      {!selectedPublisher && (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">Select a Publisher</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Search for a validated publisher above to browse their zmanim catalog.
              You can link or copy their formulas to your own catalog.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Publisher Catalog */}
      {selectedPublisher && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Desktop Filter Panel */}
          <div className="hidden lg:block">
            <Card data-testid="filter-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PublisherFilterPanel
                  categories={availableCategories}
                  shitas={availableShitas}
                  selectedCategories={selectedCategories}
                  selectedShitas={selectedShitas}
                  status={status}
                  onCategoryChange={(cats) => handleFilterChange(setSelectedCategories, cats)}
                  onShitaChange={(shitas) => handleFilterChange(setSelectedShitas, shitas)}
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
                  placeholder="Search zmanim by name or formula..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                  data-testid="publisher-zmanim-search"
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
                    <PublisherFilterPanel
                      categories={availableCategories}
                      shitas={availableShitas}
                      selectedCategories={selectedCategories}
                      selectedShitas={selectedShitas}
                      status={status}
                      onCategoryChange={(cats) => handleFilterChange(setSelectedCategories, cats)}
                      onShitaChange={(shitas) => handleFilterChange(setSelectedShitas, shitas)}
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
            {zmanimLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : zmanimError ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                  <p className="text-destructive">Failed to load zmanim. Please try again.</p>
                </CardContent>
              </Card>
            ) : zmanimData?.zmanim.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No zmanim found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery
                      ? 'Try adjusting your search or filters.'
                      : 'This publisher has no zmanim in their catalog.'}
                  </p>
                  {(searchQuery || activeFilters.length > 0) && (
                    <Button variant="outline" onClick={handleClearFilters}>
                      Clear All Filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Results count */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {zmanimData?.zmanim.length} of {zmanimData?.total} zmanim from{' '}
                    <span className="font-medium">{selectedPublisher.name}</span>
                  </p>
                </div>

                {/* Zman Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {zmanimData?.zmanim.map((zman) => (
                    <PublisherZmanCard
                      key={zman.id}
                      zman={zman}
                      publisherName={selectedPublisher.name}
                      onLink={handleLink}
                      onCopy={handleCopy}
                      onInfo={(id) => setPublisherZmanDocId(id)}
                      isProcessing={processingId}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {zmanimData && zmanimData.total_pages > 1 && (
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
                      Page {page} of {zmanimData.total_pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= zmanimData.total_pages}
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
      )}

      {/* Publisher Zman Documentation Modal (Story 11.4) */}
      <PublisherZmanDetailModal
        publisherZmanId={publisherZmanDocId}
        isOpen={!!publisherZmanDocId}
        onClose={() => setPublisherZmanDocId(null)}
        onNavigateToMasterZman={(masterZmanId) => {
          setPublisherZmanDocId(null);
          setMasterZmanDocId(masterZmanId);
        }}
      />

      {/* Master Zman Documentation Modal (for navigation from publisher modal) */}
      <MasterZmanDetailModal
        masterZmanId={masterZmanDocId}
        isOpen={!!masterZmanDocId}
        onClose={() => setMasterZmanDocId(null)}
      />
    </div>
  );
}
