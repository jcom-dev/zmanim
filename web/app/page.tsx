'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, ChevronRight, Building2, Globe, Loader2, Navigation, History, Search, X } from 'lucide-react';
import { SignInButton, useUser } from '@clerk/nextjs';
import { UserContextMenu } from '@/components/shared/UserContextMenu';
import { LocalityPicker } from '@/components/shared/LocalityPicker';
import type { LocalitySelection } from '@/types/geography';
import { RoleNavigation } from '@/components/home/RoleNavigation';
import { ModeToggle } from '@/components/mode-toggle';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { USER_TOOLTIPS } from '@/lib/tooltip-content';
import { useApi } from '@/lib/api-client';
import { Footer } from '@/components/shared/Footer';
import { usePreferences } from '@/lib/contexts/PreferencesContext';
import { useLocality } from '@/lib/hooks/useLocality';

// Unified hierarchy item - used for continents, countries, regions, and localities
interface HierarchyItem {
  entity_type: 'continent' | 'country' | 'region' | 'locality';
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
  direct_child_count: number;
  descendant_count: number;
  has_children: boolean;
}

// Breadcrumb item for navigation
interface BreadcrumbItem {
  type: 'continent' | 'country' | 'region' | 'locality';
  id: number | string;
  name: string;
}

// Raw locality from nearby API
interface NearbyLocality {
  id: number;
  name: string;
  country_code: string;
  latitude: number;
  longitude: number;
  timezone: string;
  elevation_m: number | null;
  population: number | null;
  locality_type_code: string;
}

export default function Home() {
  const router = useRouter();
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  const api = useApi();
  const { preferences, setLocality, clearLocality: clearSavedLocality, isLoading: preferencesLoading } = usePreferences();

  // Unified hierarchy state - single array for ALL levels including continents
  const [items, setItems] = useState<HierarchyItem[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);

  // Loading state
  const [loadingItems, setLoadingItems] = useState(true);

  const [error, setError] = useState<string | null>(null);

  // Filter state for browse lists
  const [browseFilter, setBrowseFilter] = useState('');

  // Geolocation state
  const [isGeolocating, setIsGeolocating] = useState(false);

  // Fetch saved locality details using useLocality hook
  const {
    locality: savedLocalityDetails,
    isLoading: loadingSavedLocality,
    error: savedLocalityError,
  } = useLocality({
    id: preferences.localityId,
    enabled: !preferencesLoading && !!preferences.localityId,
  });

  // Clear saved locality if fetch failed (locality no longer exists)
  useEffect(() => {
    if (savedLocalityError && preferences.localityId) {
      console.warn('Saved locality not found, clearing preference:', savedLocalityError);
      clearSavedLocality();
    }
  }, [savedLocalityError, preferences.localityId, clearSavedLocality]);

  // Unified loading function - loads children of any entity type, or top-level continents
  const loadChildren = useCallback(async (
    parentType: 'continent' | 'country' | 'region' | 'locality' | null,
    parentId: number | null
  ) => {
    try {
      setLoadingItems(true);
      setError(null);

      // Build query params - when parentType is null, we get continents (top-level)
      const params = new URLSearchParams({ limit: '500' });
      if (parentType) {
        params.set('parent_type', parentType);
      }
      if (parentId !== null) {
        params.set('parent_id', String(parentId));
      }

      const data = await api.public.get<HierarchyItem[]>(`/localities/browse?${params}`);
      setItems(data || []);
    } catch (err) {
      console.error('Failed to load locations:', err);
      setError('Failed to load locations. Please try again.');
    } finally {
      setLoadingItems(false);
    }
  }, [api]);

  // Load top-level (continents) on mount
  useEffect(() => {
    loadChildren(null, null);
  }, [loadChildren]);

  // Handle locality selection from LocalityPicker
  const handleLocalityPickerSelect = useCallback((selection: LocalitySelection | LocalitySelection[]) => {
    const locality = Array.isArray(selection) ? selection[0] : selection;
    if (locality) {
      setLocality(parseInt(locality.id, 10));
      router.push(`/zmanim/${locality.id}`);
    }
  }, [setLocality, router]);

  // Geolocation
  const handleUseMyLocation = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsGeolocating(true);
    setError(null);

    try {
      // Use low accuracy - sufficient for locality lookup and faster/more reliable
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 30000,
          maximumAge: 600000, // Accept cached position up to 10 min old
        });
      });

      const { latitude, longitude } = position.coords;

      // API returns array of nearby localities, we take the closest one (first)
      const nearbyLocalities = await api.public.get<NearbyLocality[]>(
        `/localities/nearby?lat=${latitude}&lng=${longitude}&limit=1`
      );
      const nearbyLocality = nearbyLocalities?.[0];

      if (nearbyLocality) {
        // Save locality to cookie via preferences context
        setLocality(nearbyLocality.id);
        router.push(`/zmanim/${nearbyLocality.id}`);
      } else {
        setError('No locality found near your location');
      }
    } catch (err) {
      console.error('Geolocation error:', err);
      if (err instanceof GeolocationPositionError) {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Location unavailable');
            break;
          case err.TIMEOUT:
            setError('Location request timed out');
            break;
          default:
            setError('Unable to get location');
        }
      } else {
        setError('Unable to get your location');
      }
    } finally {
      setIsGeolocating(false);
    }
  };

  // Handle clicking any hierarchy item - unified handler for all levels
  const handleItemClick = (item: HierarchyItem) => {
    if (item.has_children) {
      // Has children - drill down
      setBreadcrumb(prev => [...prev, {
        type: item.entity_type,
        id: item.entity_id,
        name: item.display_name,
      }]);
      setBrowseFilter('');
      loadChildren(item.entity_type, item.entity_id);
    } else {
      // Leaf node - if it's a locality, navigate to zmanim page
      if (item.entity_type === 'locality' || item.locality_id) {
        const localityId = item.locality_id ?? item.entity_id;
        setLocality(localityId);
        router.push(`/zmanim/${localityId}`);
      }
    }
  };

  // Select current item as the final location (for items with children that user wants to use directly)
  const handleSelectCurrent = () => {
    const currentItem = breadcrumb[breadcrumb.length - 1];
    if (currentItem && currentItem.type === 'locality') {
      setLocality(currentItem.id as number);
      router.push(`/zmanim/${currentItem.id}`);
    }
  };

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      // Go back to top level (continents)
      setBreadcrumb([]);
      setBrowseFilter('');
      loadChildren(null, null);
    } else if (index < breadcrumb.length - 1) {
      // Navigate to that level
      const newBreadcrumb = breadcrumb.slice(0, index + 1);
      setBreadcrumb(newBreadcrumb);
      setBrowseFilter('');
      const target = newBreadcrumb[newBreadcrumb.length - 1];
      loadChildren(target.type, target.id as number);
    }
  };

  // Handle back button
  const handleBack = () => {
    setBrowseFilter('');
    if (breadcrumb.length > 1) {
      // Go back one level
      const newBreadcrumb = breadcrumb.slice(0, -1);
      setBreadcrumb(newBreadcrumb);
      const target = newBreadcrumb[newBreadcrumb.length - 1];
      loadChildren(target.type, target.id as number);
    } else if (breadcrumb.length === 1) {
      // Go back to top level (continents)
      setBreadcrumb([]);
      loadChildren(null, null);
    }
  };

  // Determine if we're at top level (viewing continents)
  const isTopLevel = breadcrumb.length === 0;

  // Get current parent for display (last breadcrumb item with children being viewed)
  const currentParent = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1] : null;

  // Filter items by search text
  const filterText = browseFilter.trim().toLowerCase();
  const filteredItems = filterText
    ? items.filter(item => item.display_name.toLowerCase().includes(filterText))
    : items;

  return (
    <main className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <div className="bg-card border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="text-xl font-bold text-foreground">
              Shtetl Zmanim
            </div>
            <div className="flex items-center gap-4">
              <RoleNavigation />
              <ModeToggle />
              {userLoaded && (
                isSignedIn ? (
                  <UserContextMenu />
                ) : (
                  <SignInButton mode="modal">
                    <button className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors">
                      Sign In
                    </button>
                  </SignInButton>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-card/50 border-b border-border">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold text-foreground mb-3">
              Shtetl Zmanim
            </h1>
            <p className="text-lg text-muted-foreground">
              Multi-Publisher Zmanim Platform
            </p>
            <p className="text-muted-foreground mt-2">
              Select your location to view prayer times from local authorities
            </p>

            {/* Welcome Back - Saved Location Prompt */}
            {savedLocalityDetails && (
              <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-xl max-w-md mx-auto">
                <div className="flex items-center gap-3 mb-3">
                  <History className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Welcome back!</span>
                </div>
                <p className="text-foreground font-medium mb-3">
                  Continue to {savedLocalityDetails.name}
                  {savedLocalityDetails.region_name && `, ${savedLocalityDetails.region_name}`}
                  {savedLocalityDetails.country_name && `, ${savedLocalityDetails.country_name}`}?
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => router.push(`/zmanim/${savedLocalityDetails.id}`)}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors text-sm font-medium"
                  >
                    Go to Saved Location
                  </button>
                  <button
                    type="button"
                    onClick={clearSavedLocality}
                    className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors text-sm"
                  >
                    Choose Different
                  </button>
                </div>
              </div>
            )}

            {/* Loading saved locality */}
            {loadingSavedLocality && !savedLocalityDetails && (
              <div className="mt-6 flex justify-center">
                <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              </div>
            )}

            {/* Quick Search & Location */}
            <div className="mt-8 max-w-xl mx-auto">
              <div className="flex gap-2">
                {/* Locality Picker */}
                <div className="flex-1">
                  <LocalityPicker
                    mode="single"
                    variant="inline"
                    placeholder="Search for a locality..."
                    onSelect={handleLocalityPickerSelect}
                    types={['locality', 'town', 'village', 'neighborhood']}
                  />
                </div>

                {/* Use My Location Button */}
                <InfoTooltip content={USER_TOOLTIPS.use_my_location} side="bottom" asChild>
                  <button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={isGeolocating}
                    className="flex items-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-xl transition-colors whitespace-nowrap"
                  >
                    {isGeolocating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Navigation className="w-5 h-5" />
                    )}
                    <span className="hidden sm:inline">
                      {isGeolocating ? 'Locating...' : 'Use My Location'}
                    </span>
                  </button>
                </InfoTooltip>
              </div>

              <p className="text-xs text-muted-foreground mt-3">
                Or browse by location below
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="bg-card/50 border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <button
              onClick={() => handleBreadcrumbClick(-1)}
              className={`${isTopLevel ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Globe className="w-4 h-4 inline mr-1" />
              Select Location
            </button>

            {/* Dynamic breadcrumb from breadcrumb state */}
            {breadcrumb.map((item, index) => (
              <span key={`${item.type}-${item.id}`} className="flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  className={`max-w-[200px] truncate ${index === breadcrumb.length - 1 ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  title={item.name}
                >
                  {item.name}
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 alert-error">
            <p className="alert-error-text">{error}</p>
          </div>
        )}

        {/* Unified Hierarchy Browser - works for ALL levels including continents */}
        <div>
          <div className="flex items-center gap-4 mb-6">
            {!isTopLevel && (
              <button
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground"
              >
                ← Back
              </button>
            )}
            <h2 className="text-2xl font-bold text-foreground">
              {isTopLevel
                ? 'Select Continent'
                : `Select Location in ${currentParent?.name}`}
            </h2>
          </div>

          {/* Option to select current locality (when viewing its children) */}
          {currentParent && currentParent.type === 'locality' && (
            <div className="mb-6">
              <button
                onClick={handleSelectCurrent}
                className="w-full flex items-center justify-between p-4 bg-primary/10 border-2 border-primary/30 rounded-lg hover:bg-primary/20 transition-colors text-left"
                title={`Select ${currentParent.name}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <MapPin className="w-5 h-5 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground font-medium truncate" title={currentParent.name}>
                      Select {currentParent.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Use this location for zmanim (don&apos;t drill down further)
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-primary shrink-0" />
              </button>
              <div className="mt-4 text-sm text-muted-foreground">
                Or select a more specific location below:
              </div>
            </div>
          )}

          {/* Filter input */}
          {!loadingItems && items.length > 10 && (
            <div className="mb-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={browseFilter}
                  onChange={(e) => setBrowseFilter(e.target.value)}
                  placeholder={isTopLevel ? 'Filter continents...' : 'Filter locations...'}
                  className="w-full pl-9 pr-9 py-2 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {browseFilter && (
                  <button
                    onClick={() => setBrowseFilter('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {browseFilter && (
                <p className="text-xs text-muted-foreground mt-1">
                  Showing {filteredItems.length} of {items.length} {isTopLevel ? 'continents' : 'locations'}
                </p>
              )}
            </div>
          )}

          {loadingItems ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No locations found.</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No results match &quot;{browseFilter}&quot;</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                // Choose icon based on entity type
                const Icon = item.entity_type === 'continent' ? Globe
                  : item.entity_type === 'country' ? Globe
                  : item.entity_type === 'region' ? Building2
                  : MapPin;

                return (
                  <button
                    key={`${item.entity_type}-${item.entity_id}`}
                    onClick={() => handleItemClick(item)}
                    className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:bg-muted hover:border-border transition-colors text-left"
                    title={item.display_hierarchy || item.display_name}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-foreground font-medium truncate" title={item.display_name}>
                          {item.display_name}
                        </div>
                        {item.descendant_count > 0 && (
                          <div className="text-xs text-primary flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {item.descendant_count.toLocaleString()} {item.descendant_count === 1 ? 'location' : 'locations'}
                            </span>
                          </div>
                        )}
                        {/* Show entity subtype for non-continent items */}
                        {item.entity_subtype && item.entity_type !== 'continent' && (
                          <div className="text-xs text-muted-foreground capitalize">
                            {item.entity_subtype}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Footer showDisclaimer showBecomePublisher />
    </main>
  );
}
