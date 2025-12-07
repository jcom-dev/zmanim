/**
 * @file CoverageSelector.tsx
 * @purpose Multi-level geographic selection - continent → country → region → city
 * @pattern client-component-complex
 * @dependencies useApi, Select (shadcn), cascading dropdowns
 * @frequency high - 622 lines, used by 5 pages
 * @compliance Check docs/adr/ for pattern rationale
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Search, X, Loader2, Globe, Map, Globe2, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApi } from '@/lib/api-client';

// Type definitions - Updated for new ID-based schema
export interface City {
  id: string; // UUID
  name: string;
  country: string;
  country_code: string;
  region: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  display_name: string;
}

export interface Country {
  id: number; // smallint
  country_code: string;
  country: string; // name alias
  continent_code: string;
  continent: string;
  adm1_label?: string;
  adm2_label?: string;
  has_adm1?: boolean;
  has_adm2?: boolean;
  // For list endpoints with counts
  city_count?: number;
}

export interface Region {
  id: number; // integer
  code: string;
  name: string;
  country_id?: number;
  country_code?: string;
  country_name?: string;
  city_count?: number;
}

export interface Continent {
  id: number;
  code: string;
  name: string;
  city_count: number;
}

export interface District {
  id: number;
  code: string;
  name: string;
  region_id?: number;
  region_code?: string;
  region_name?: string;
  country_id?: number;
  country_code?: string;
  country_name?: string;
  city_count?: number;
}

export type CoverageType = 'city' | 'district' | 'region' | 'country' | 'continent';

export interface CoverageSelection {
  type: CoverageType;
  id: string;
  name: string;
}

// Quick select cities for common locations
const QUICK_SELECT_CITIES = [
  { name: 'Jerusalem', country: 'Israel', countryCode: 'IL' },
  { name: 'New York', country: 'USA', countryCode: 'US' },
  { name: 'Los Angeles', country: 'USA', countryCode: 'US' },
  { name: 'London', country: 'UK', countryCode: 'GB' },
  { name: 'Tel Aviv', country: 'Israel', countryCode: 'IL' },
  { name: 'Miami', country: 'USA', countryCode: 'US' },
];

export interface CoverageSelectorProps {
  /** Currently selected coverage items */
  selectedItems: CoverageSelection[];
  /** Callback when items change */
  onChange: (items: CoverageSelection[]) => void;
  /** Whether to show the quick select cities section */
  showQuickSelect?: boolean;
  /** Custom class name for the container */
  className?: string;
  /** Whether to show the selected items badge section */
  showSelectedBadges?: boolean;
  /** Header title (optional) */
  headerTitle?: string;
  /** Header description (optional) */
  headerDescription?: string;
}

/**
 * Shared CoverageSelector component for selecting geographic coverage areas.
 * Used in both the onboarding wizard and the coverage management page.
 * Provides a tabbed search interface for cities, regions, countries, and continents.
 */
export function CoverageSelector({
  selectedItems,
  onChange,
  showQuickSelect = true,
  className,
  showSelectedBadges = true,
  headerTitle,
  headerDescription,
}: CoverageSelectorProps) {
  const api = useApi();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<CoverageType>('city');
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [countryResults, setCountryResults] = useState<Country[]>([]);
  const [regionResults, setRegionResults] = useState<Region[]>([]);
  const [districtResults, setDistrictResults] = useState<District[]>([]);
  const [continentResults, setContinentResults] = useState<Continent[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search with debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setCityResults([]);
      setCountryResults([]);
      setRegionResults([]);
      setDistrictResults([]);
      setContinentResults([]);
      setShowDropdown(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      setShowDropdown(true);

      try {
        if (searchType === 'city') {
          const data = await api.public.get<{ cities: City[] }>(
            `/cities?search=${encodeURIComponent(searchQuery)}&limit=10`
          );
          setCityResults(data?.cities || []);
        } else if (searchType === 'country') {
          const data = await api.public.get<Country[]>('/countries');
          const countries = data || [];
          // Filter by search query
          const filtered = countries.filter((c: Country) =>
            c.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.country_code.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setCountryResults(filtered.slice(0, 10));
        } else if (searchType === 'region') {
          const data = await api.public.get<{ regions: Region[] }>(
            `/regions?search=${encodeURIComponent(searchQuery)}&limit=10`
          );
          setRegionResults(data?.regions || []);
        } else if (searchType === 'district') {
          const data = await api.public.get<{ districts: District[] }>(
            `/districts?search=${encodeURIComponent(searchQuery)}&limit=10`
          );
          setDistrictResults(data?.districts || []);
        } else if (searchType === 'continent') {
          const data = await api.public.get<Continent[]>('/continents');
          const continents = data || [];
          // Filter by search query
          const filtered = continents.filter((c: Continent) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.code.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setContinentResults(filtered);
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchType, api]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addItem = useCallback((item: CoverageSelection) => {
    if (!selectedItems.find((i) => i.id === item.id && i.type === item.type)) {
      const updated = [...selectedItems, item];
      onChange(updated);
    }
    setSearchQuery('');
    setCityResults([]);
    setCountryResults([]);
    setRegionResults([]);
    setDistrictResults([]);
    setContinentResults([]);
    setShowDropdown(false);
  }, [selectedItems, onChange]);

  const addCity = useCallback((city: City) => {
    addItem({
      type: 'city',
      id: city.id,
      name: city.display_name || `${city.name}, ${city.country}`,
    });
  }, [addItem]);

  const addCountry = useCallback((country: Country) => {
    addItem({
      type: 'country',
      id: String(country.id),
      name: country.country,
    });
  }, [addItem]);

  const addRegion = useCallback((region: Region) => {
    addItem({
      type: 'region',
      id: String(region.id),
      name: `${region.name}${region.country_name ? `, ${region.country_name}` : ''}`,
    });
  }, [addItem]);

  const addDistrict = useCallback((district: District) => {
    addItem({
      type: 'district',
      id: String(district.id),
      name: `${district.name}${district.region_name ? `, ${district.region_name}` : ''}${district.country_name ? `, ${district.country_name}` : ''}`,
    });
  }, [addItem]);

  const addContinent = useCallback((continent: Continent) => {
    addItem({
      type: 'continent',
      id: continent.code,
      name: continent.name,
    });
  }, [addItem]);

  const addQuickCity = useCallback((city: typeof QUICK_SELECT_CITIES[0]) => {
    const cityId = `quick-${city.name.toLowerCase().replace(/\s+/g, '-')}-${city.countryCode}`;
    addItem({
      type: 'city',
      id: cityId,
      name: `${city.name}, ${city.country}`,
    });
  }, [addItem]);

  const removeItem = useCallback((itemId: string, itemType: CoverageType) => {
    const updated = selectedItems.filter((i) => !(i.id === itemId && i.type === itemType));
    onChange(updated);
  }, [selectedItems, onChange]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setCityResults([]);
    setCountryResults([]);
    setRegionResults([]);
    setDistrictResults([]);
    setContinentResults([]);
    setShowDropdown(false);
  }, []);

  const switchSearchType = useCallback((type: CoverageType) => {
    setSearchType(type);
    clearSearch();
  }, [clearSearch]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Optional Header */}
      {(headerTitle || headerDescription) && (
        <div className="text-center space-y-2">
          {headerTitle && <h2 className="text-2xl font-bold">{headerTitle}</h2>}
          {headerDescription && (
            <p className="text-muted-foreground">{headerDescription}</p>
          )}
        </div>
      )}

      {/* Selected items badges */}
      {showSelectedBadges && selectedItems.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Selected Coverage ({selectedItems.length}):</label>
          <div className="flex flex-wrap gap-2">
            {selectedItems.map((item) => (
              <span
                key={`${item.type}-${item.id}`}
                className={cn(
                  "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm",
                  getTypeColor(item.type)
                )}
              >
                {getIcon(item.type)}
                {item.name}
                <button
                  type="button"
                  onClick={() => removeItem(item.id, item.type)}
                  className="ml-1 hover:opacity-70 transition-opacity"
                  aria-label={`Remove ${item.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search type tabs */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Add coverage by:</label>
        <div className="flex gap-2 border-b overflow-x-auto">
          {[
            { type: 'city' as const, label: 'City', icon: MapPin },
            { type: 'district' as const, label: 'County/District', icon: Building2 },
            { type: 'region' as const, label: 'State/Region', icon: Map },
            { type: 'country' as const, label: 'Country', icon: Globe },
            { type: 'continent' as const, label: 'Continent', icon: Globe2 },
          ].map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => switchSearchType(type)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[2px] whitespace-nowrap",
                searchType === type
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowDropdown(true)}
            placeholder={getSearchPlaceholder(searchType)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"
          >
            {isSearching ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                Searching...
              </div>
            ) : searchType === 'city' && cityResults.length > 0 ? (
              <div className="py-1">
                {cityResults.map((city) => {
                  const isSelected = selectedItems.some((i) => i.id === city.id && i.type === 'city');
                  return (
                    <button
                      key={city.id}
                      type="button"
                      onClick={() => !isSelected && addCity(city)}
                      disabled={isSelected}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm flex items-start gap-2",
                        isSelected ? "bg-muted text-muted-foreground" : "hover:bg-accent"
                      )}
                    >
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{city.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {city.region ? `${city.region}, ` : ''}{city.country}
                        </div>
                      </div>
                      {isSelected && <span className="text-xs text-primary shrink-0">Added</span>}
                    </button>
                  );
                })}
              </div>
            ) : searchType === 'country' && countryResults.length > 0 ? (
              <div className="py-1">
                {countryResults.map((country) => {
                  const isSelected = selectedItems.some((i) => i.id === String(country.id) && i.type === 'country');
                  return (
                    <button
                      key={country.id}
                      type="button"
                      onClick={() => !isSelected && addCountry(country)}
                      disabled={isSelected}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm flex items-start gap-2",
                        isSelected ? "bg-muted text-muted-foreground" : "hover:bg-accent"
                      )}
                    >
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{country.country}</div>
                        <div className="text-xs text-muted-foreground">
                          {country.city_count ? `${country.city_count.toLocaleString()} cities available` : country.continent}
                        </div>
                      </div>
                      {isSelected && <span className="text-xs text-primary shrink-0">Added</span>}
                    </button>
                  );
                })}
              </div>
            ) : searchType === 'region' && regionResults.length > 0 ? (
              <div className="py-1">
                {regionResults.map((region) => {
                  const regionId = String(region.id);
                  const isSelected = selectedItems.some((i) => i.id === regionId && i.type === 'region');
                  return (
                    <button
                      key={region.id}
                      type="button"
                      onClick={() => !isSelected && addRegion(region)}
                      disabled={isSelected}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm flex items-start gap-2",
                        isSelected ? "bg-muted text-muted-foreground" : "hover:bg-accent"
                      )}
                    >
                      <Map className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{region.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {region.country_name ? `${region.country_name} · ` : ''}{region.city_count ? `${region.city_count.toLocaleString()} cities` : ''}
                        </div>
                      </div>
                      {isSelected && <span className="text-xs text-primary shrink-0">Added</span>}
                    </button>
                  );
                })}
              </div>
            ) : searchType === 'district' && districtResults.length > 0 ? (
              <div className="py-1">
                {districtResults.map((district) => {
                  const districtId = String(district.id);
                  const isSelected = selectedItems.some((i) => i.id === districtId && i.type === 'district');
                  return (
                    <button
                      key={district.id}
                      type="button"
                      onClick={() => !isSelected && addDistrict(district)}
                      disabled={isSelected}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm flex items-start gap-2",
                        isSelected ? "bg-muted text-muted-foreground" : "hover:bg-accent"
                      )}
                    >
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{district.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {district.region_name ? `${district.region_name}, ` : ''}{district.country_name || ''}
                          {district.city_count ? ` · ${district.city_count.toLocaleString()} cities` : ''}
                        </div>
                      </div>
                      {isSelected && <span className="text-xs text-primary shrink-0">Added</span>}
                    </button>
                  );
                })}
              </div>
            ) : searchType === 'continent' && continentResults.length > 0 ? (
              <div className="py-1">
                {continentResults.map((continent) => {
                  const isSelected = selectedItems.some((i) => i.id === continent.code && i.type === 'continent');
                  return (
                    <button
                      key={continent.code}
                      type="button"
                      onClick={() => !isSelected && addContinent(continent)}
                      disabled={isSelected}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm flex items-start gap-2",
                        isSelected ? "bg-muted text-muted-foreground" : "hover:bg-accent"
                      )}
                    >
                      <Globe2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{continent.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {continent.city_count.toLocaleString()} cities available
                        </div>
                      </div>
                      {isSelected && <span className="text-xs text-primary shrink-0">Added</span>}
                    </button>
                  );
                })}
              </div>
            ) : searchQuery.length >= 2 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No {getSearchTypeLabel(searchType)} found for &quot;{searchQuery}&quot;
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Quick select cities */}
      {showQuickSelect && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Quick add popular cities:</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {QUICK_SELECT_CITIES.map((city) => {
              const cityId = `quick-${city.name.toLowerCase().replace(/\s+/g, '-')}-${city.countryCode}`;
              const isSelected = selectedItems.some((i) => i.id === cityId);
              return (
                <button
                  key={cityId}
                  type="button"
                  onClick={() => addQuickCity(city)}
                  disabled={isSelected}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-colors",
                    isSelected
                      ? "bg-primary/10 border-primary cursor-default"
                      : "hover:border-primary hover:bg-muted"
                  )}
                >
                  <div className="font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {city.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {city.country}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
function getIcon(type: CoverageType) {
  switch (type) {
    case 'continent': return <Globe2 className="w-3 h-3" />;
    case 'country': return <Globe className="w-3 h-3" />;
    case 'region': return <Map className="w-3 h-3" />;
    case 'district': return <Building2 className="w-3 h-3" />;
    default: return <MapPin className="w-3 h-3" />;
  }
}

function getTypeColor(type: CoverageType) {
  switch (type) {
    case 'continent': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'country': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'region': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'district': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    default: return 'bg-primary/10 text-primary';
  }
}

function getSearchPlaceholder(type: CoverageType) {
  switch (type) {
    case 'city': return "Search cities (e.g., Manchester, Paris...)";
    case 'district': return "Search counties/districts (e.g., Los Angeles County, Greater Manchester...)";
    case 'region': return "Search states/regions (e.g., California, Ontario...)";
    case 'country': return "Search countries (e.g., United States, Israel...)";
    case 'continent': return "Search continents (e.g., Europe, North America...)";
  }
}

function getSearchTypeLabel(type: CoverageType) {
  switch (type) {
    case 'city': return 'cities';
    case 'district': return 'districts';
    case 'region': return 'regions';
    case 'country': return 'countries';
    case 'continent': return 'continents';
  }
}

// Export helper functions for external use
export { getIcon as getCoverageIcon, getTypeColor as getCoverageTypeColor };
