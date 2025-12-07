'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, ChevronRight, Building2, Globe, Loader2, Mountain, Search, Navigation } from 'lucide-react';
import { SignInButton, UserButton, useUser } from '@clerk/nextjs';
import { RoleNavigation } from '@/components/home/RoleNavigation';
import { ModeToggle } from '@/components/mode-toggle';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { USER_TOOLTIPS } from '@/lib/tooltip-content';
import { useApi } from '@/lib/api-client';
import { Footer } from '@/components/shared/Footer';

interface Continent {
  code: string;
  name: string;
  city_count: number;
}

interface Country {
  id: number;
  country_code: string;
  country: string;
  city_count: number;
}

interface Region {
  id: number;
  code: string;
  name: string;
}

interface City {
  id: string;
  name: string;
  country: string;
  country_code: string;
  region: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  elevation: number | null;
  continent: string | null;
  display_name: string;
}

// localStorage keys
const STORAGE_KEY_CONTINENT = 'zmanim_selected_continent';
const STORAGE_KEY_COUNTRY = 'zmanim_selected_country';
const STORAGE_KEY_REGION = 'zmanim_selected_region';
const STORAGE_KEY_CITY = 'zmanim_selected_city';

export default function Home() {
  const router = useRouter();
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  const api = useApi();

  // Selection state
  const [selectedContinent, setSelectedContinent] = useState<Continent | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);

  // Data state
  const [continents, setContinents] = useState<Continent[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  // Loading state
  const [loadingContinents, setLoadingContinents] = useState(true);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<City[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadSavedSelections = () => {
    try {
      const savedCity = localStorage.getItem(STORAGE_KEY_CITY);
      if (savedCity) {
        const city = JSON.parse(savedCity) as City;
        setSelectedCity(city);
        // Don't auto-redirect - let user click to navigate
      }
    } catch {
      // Invalid stored data, ignore
    }
  };

  const loadContinents = useCallback(async () => {
    try {
      setLoadingContinents(true);
      setError(null);

      const data = await api.public.get<Continent[]>('/continents');
      setContinents(data || []);
    } catch (err) {
      console.error('Failed to load continents:', err);
      setError('Failed to load continents. Please try again.');
    } finally {
      setLoadingContinents(false);
    }
  }, [api]);

  // Load continents on mount
  useEffect(() => {
    loadContinents();
    loadSavedSelections();
  }, [loadContinents]);

  const loadCountries = useCallback(async (continentCode: string) => {
    try {
      setLoadingCountries(true);
      setError(null);
      setCountries([]);
      setRegions([]);
      setCities([]);

      const data = await api.public.get<Country[]>(`/countries?continent_code=${continentCode}`);
      setCountries(data || []);
    } catch (err) {
      console.error('Failed to load countries:', err);
      setError('Failed to load countries. Please try again.');
    } finally {
      setLoadingCountries(false);
    }
  }, [api]);

  const loadRegions = useCallback(async (countryCode: string) => {
    try {
      setLoadingRegions(true);
      setError(null);
      setRegions([]);
      setCities([]);

      const data = await api.public.get<{ regions: Region[]; total: number }>(`/regions?country_code=${countryCode}`);
      const regionList = data?.regions || [];
      setRegions(regionList);

      // If no regions, load cities directly
      if (regionList.length === 0) {
        loadCities(countryCode, null);
      }
    } catch (err) {
      console.error('Failed to load regions:', err);
      setError('Failed to load regions. Please try again.');
    } finally {
      setLoadingRegions(false);
    }
  }, [api]);

  // City search with debounce
  const searchCities = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const data = await api.public.get<{ cities: City[]; total: number }>(
        `/cities?search=${encodeURIComponent(query)}&limit=10`
      );
      setSearchResults(data?.cities || []);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [api]);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSearchResults(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchCities(value);
    }, 300);
  };

  const handleSearchResultSelect = (city: City) => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    localStorage.setItem(STORAGE_KEY_CITY, JSON.stringify(city));
    router.push(`/zmanim/${city.id}`);
  };

  // Geolocation
  const handleUseMyLocation = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsGeolocating(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;

      const nearbyData = await api.public.get<{ city: City }>(
        `/cities/nearby?lat=${latitude}&lng=${longitude}`
      );
      const city = nearbyData?.city;

      if (city) {
        localStorage.setItem(STORAGE_KEY_CITY, JSON.stringify(city));
        router.push(`/zmanim/${city.id}`);
      } else {
        setError('No city found near your location');
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

  const loadCities = async (countryCode: string, regionName: string | null) => {
    try {
      setLoadingCities(true);
      setError(null);

      let url = `/cities?country_code=${countryCode}&limit=100`;
      if (regionName) {
        url += `&region=${encodeURIComponent(regionName)}`;
      }

      const data = await api.public.get<{ cities: City[]; total: number }>(url);
      setCities(data?.cities || []);
    } catch (err) {
      console.error('Failed to load cities:', err);
      setError('Failed to load cities. Please try again.');
    } finally {
      setLoadingCities(false);
    }
  };

  const handleContinentSelect = (continent: Continent) => {
    setSelectedContinent(continent);
    setSelectedCountry(null);
    setSelectedRegion(null);
    setSelectedCity(null);
    localStorage.setItem(STORAGE_KEY_CONTINENT, JSON.stringify(continent));
    localStorage.removeItem(STORAGE_KEY_COUNTRY);
    localStorage.removeItem(STORAGE_KEY_REGION);
    localStorage.removeItem(STORAGE_KEY_CITY);
    loadCountries(continent.code);
  };

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setSelectedRegion(null);
    setSelectedCity(null);
    localStorage.setItem(STORAGE_KEY_COUNTRY, JSON.stringify(country));
    localStorage.removeItem(STORAGE_KEY_REGION);
    localStorage.removeItem(STORAGE_KEY_CITY);
    loadRegions(country.country_code);
  };

  const handleRegionSelect = (region: Region) => {
    setSelectedRegion(region);
    setSelectedCity(null);
    localStorage.setItem(STORAGE_KEY_REGION, JSON.stringify(region));
    localStorage.removeItem(STORAGE_KEY_CITY);
    if (selectedCountry) {
      loadCities(selectedCountry.country_code, region.name);
    }
  };

  const handleCitySelect = (city: City) => {
    setSelectedCity(city);
    localStorage.setItem(STORAGE_KEY_CITY, JSON.stringify(city));
    // Navigate to publisher selection
    router.push(`/zmanim/${city.id}`);
  };

  const handleBack = () => {
    if (selectedCity) {
      setSelectedCity(null);
      localStorage.removeItem(STORAGE_KEY_CITY);
    } else if (selectedRegion) {
      setSelectedRegion(null);
      setCities([]);
      localStorage.removeItem(STORAGE_KEY_REGION);
    } else if (selectedCountry) {
      setSelectedCountry(null);
      setRegions([]);
      setCities([]);
      localStorage.removeItem(STORAGE_KEY_COUNTRY);
    } else if (selectedContinent) {
      setSelectedContinent(null);
      setCountries([]);
      setRegions([]);
      setCities([]);
      localStorage.removeItem(STORAGE_KEY_CONTINENT);
    }
  };

  // Determine current step
  const getCurrentStep = () => {
    if (!selectedContinent) return 'continent';
    if (!selectedCountry) return 'country';
    if (regions.length > 0 && !selectedRegion) return 'region';
    if (!selectedCity) return 'city';
    return 'done';
  };

  const step = getCurrentStep();

  // Format elevation for display
  const formatElevation = (elevation: number | null) => {
    if (elevation === null || elevation === undefined) return null;
    if (elevation < 0) return `${elevation}m (below sea level)`;
    if (elevation === 0) return 'Sea level';
    return `${elevation}m`;
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <div className="bg-card border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="text-xl font-bold text-foreground">
              Zmanim Lab
            </div>
            <div className="flex items-center gap-4">
              <RoleNavigation />
              <ModeToggle />
              {userLoaded && (
                isSignedIn ? (
                  <UserButton afterSignOutUrl="/" />
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
              Zmanim Lab
            </h1>
            <p className="text-lg text-muted-foreground">
              Multi-Publisher Zmanim Platform
            </p>
            <p className="text-muted-foreground mt-2">
              Select your location to view prayer times from local authorities
            </p>

            {/* Quick Search & Location */}
            <div className="mt-8 max-w-xl mx-auto">
              <div className="flex gap-2">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchInput}
                    onFocus={() => setShowSearchResults(true)}
                    onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                    placeholder="Search for a city..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-foreground bg-card"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground animate-spin" />
                  )}

                  {/* Search Results Dropdown */}
                  {showSearchResults && (searchResults.length > 0 || searchQuery.length >= 2) && (
                    <div className="absolute z-50 w-full mt-2 py-2 bg-card border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto text-left">
                      {searchResults.length > 0 ? (
                        searchResults.map((city) => (
                          <button
                            key={city.id}
                            type="button"
                            onMouseDown={() => handleSearchResultSelect(city)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left"
                          >
                            <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-foreground truncate">{city.name}</div>
                              <div className="text-sm text-muted-foreground truncate">
                                {city.region && `${city.region}, `}{city.country}
                              </div>
                            </div>
                          </button>
                        ))
                      ) : searchQuery.length >= 2 && !isSearching ? (
                        <div className="px-4 py-3 text-muted-foreground text-center">No cities found</div>
                      ) : null}
                    </div>
                  )}
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
              onClick={() => {
                setSelectedContinent(null);
                setSelectedCountry(null);
                setSelectedRegion(null);
                setSelectedCity(null);
                setCountries([]);
                setRegions([]);
                setCities([]);
              }}
              className={`${!selectedContinent ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Globe className="w-4 h-4 inline mr-1" />
              Select Location
            </button>

            {selectedContinent && (
              <>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <button
                  onClick={() => {
                    setSelectedCountry(null);
                    setSelectedRegion(null);
                    setSelectedCity(null);
                    setRegions([]);
                    setCities([]);
                  }}
                  className={`${!selectedCountry ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {selectedContinent.name}
                </button>
              </>
            )}

            {selectedCountry && (
              <>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <button
                  onClick={() => {
                    setSelectedRegion(null);
                    setSelectedCity(null);
                    setCities([]);
                  }}
                  className={`${!selectedRegion && regions.length > 0 ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {selectedCountry.country}
                </button>
              </>
            )}

            {selectedRegion && (
              <>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <button
                  onClick={() => setSelectedCity(null)}
                  className={`${!selectedCity ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {selectedRegion.name}
                </button>
              </>
            )}
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

        {/* Continent Selection */}
        {step === 'continent' && (
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Select Continent</h2>

            {loadingContinents ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {continents.map((continent) => (
                  <button
                    key={continent.code}
                    onClick={() => handleContinentSelect(continent)}
                    className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:bg-muted hover:border-border transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <div className="text-foreground font-medium">{continent.name}</div>
                        <div className="text-sm text-muted-foreground">{continent.city_count.toLocaleString()} cities</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Country Selection */}
        {step === 'country' && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground"
              >
                ← Back
              </button>
              <h2 className="text-2xl font-bold text-foreground">
                Select Country in {selectedContinent?.name}
              </h2>
            </div>

            {loadingCountries ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {countries.map((country) => (
                  <button
                    key={country.country_code}
                    onClick={() => handleCountrySelect(country)}
                    className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:bg-muted hover:border-border transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <div className="text-foreground font-medium">{country.country}</div>
                        <div className="text-sm text-muted-foreground">{country.city_count.toLocaleString()} cities</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Region Selection */}
        {step === 'region' && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground"
              >
                ← Back
              </button>
              <h2 className="text-2xl font-bold text-foreground">
                Select Region in {selectedCountry?.country}
              </h2>
            </div>

            {loadingRegions ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {regions.map((region) => (
                  <button
                    key={region.id}
                    onClick={() => handleRegionSelect(region)}
                    className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:bg-muted hover:border-border transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <div className="text-foreground font-medium">{region.name}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* City Selection */}
        {step === 'city' && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground"
              >
                ← Back
              </button>
              <h2 className="text-2xl font-bold text-foreground">
                Select City {selectedRegion ? `in ${selectedRegion.name}` : `in ${selectedCountry?.country}`}
              </h2>
            </div>

            {loadingCities ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : cities.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No cities found in this location.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cities.map((city) => (
                  <button
                    key={city.id}
                    onClick={() => handleCitySelect(city)}
                    className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:bg-muted hover:border-border transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <div className="text-foreground font-medium">{city.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {city.region && `${city.region}, `}{city.country}
                        </div>
                        {city.elevation !== null && city.elevation !== undefined && (
                          <InfoTooltip content={USER_TOOLTIPS.elevation} side="right">
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 cursor-help">
                              <Mountain className="w-3 h-3" />
                              {formatElevation(city.elevation)}
                            </div>
                          </InfoTooltip>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Footer showDisclaimer showBecomePublisher />
    </main>
  );
}
