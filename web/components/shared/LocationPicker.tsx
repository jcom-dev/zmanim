/**
 * @file LocationPicker.tsx
 * @purpose City/location search - geolocation, autocomplete
 * @pattern client-component
 * @dependencies useApi, Geolocation API, Command (shadcn)
 * @frequency high - 369 lines
 * @compliance Check docs/adr/ for pattern rationale
 */

'use client';
import { useApi } from '@/lib/api-client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Search, Navigation, X, Loader2 } from 'lucide-react';

// City type matching API response
interface City {
  id: string;
  name: string;
  country: string;
  country_code: string;
  region: string | null;
  region_type: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  population: number | null;
  display_name: string;
}

interface LocationPickerProps {
  onLocationSelect: (location: {
    city: City | null;
    latitude: number;
    longitude: number;
    timezone: string;
    displayName: string;
  }) => void;
  initialCity?: City | null;
  placeholder?: string;
}



// localStorage key for persisting location
const LOCATION_STORAGE_KEY = 'zmanim_selected_location';

export default function LocationPicker({
  onLocationSelect,
  initialCity,
  placeholder = 'Search for a city...',
}: LocationPickerProps) {
  const api = useApi();
  const [query, setQuery] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [selectedCity, setSelectedCity] = useState<City | null>(initialCity || null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load persisted location on mount
  useEffect(() => {
    if (!initialCity) {
      const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.city) {
            setSelectedCity(parsed.city);
            onLocationSelect(parsed);
          }
        } catch {
          // Invalid stored data, ignore
        }
      }
    }
  }, [initialCity, onLocationSelect]);

  // Search cities with debounce
  const searchCities = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setCities([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const data = await api.public.get<{ cities: City[] }>(
        `/cities?search=${encodeURIComponent(searchQuery)}&limit=10`
      );
      setCities(data?.cities || []);
    } catch (err) {
      console.error('City search error:', err);
      setError('Failed to search cities');
      setCities([]);
    } finally {
      setIsSearching(false);
    }
  }, [api]);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowDropdown(true);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      searchCities(value);
    }, 300);
  };

  // Handle city selection
  const handleSelectCity = (city: City) => {
    setSelectedCity(city);
    setQuery('');
    setCities([]);
    setShowDropdown(false);
    setError(null);

    const locationData = {
      city,
      latitude: city.latitude,
      longitude: city.longitude,
      timezone: city.timezone,
      displayName: city.display_name,
    };

    // Persist to localStorage
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locationData));

    onLocationSelect(locationData);
  };

  // Handle "Use My Location"
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

      // Call nearby API to find closest city
      const nearbyData = await api.public.get<{ city: City }>(
        `/cities/nearby?lat=${latitude}&lng=${longitude}`
      );
      const city = nearbyData?.city;

      if (city) {
        handleSelectCity(city);
      } else {
        setError('No city found near your location');
      }
    } catch (err) {
      console.error('Geolocation error:', err);
      if (err instanceof GeolocationPositionError) {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied. Please enable location access.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Location information is unavailable.');
            break;
          case err.TIMEOUT:
            setError('Location request timed out.');
            break;
          default:
            setError('Unable to get your location.');
        }
      } else {
        setError('Unable to get your location');
      }
    } finally {
      setIsGeolocating(false);
    }
  };

  // Handle clear selection
  const handleClear = () => {
    setSelectedCity(null);
    setQuery('');
    setCities([]);
    setError(null);
    localStorage.removeItem(LOCATION_STORAGE_KEY);

    onLocationSelect({
      city: null,
      latitude: 0,
      longitude: 0,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      displayName: '',
    });

    inputRef.current?.focus();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full">
      {/* Main input area */}
      <div className="relative">
        {selectedCity ? (
          // Show selected city
          <div className="flex items-center gap-2 p-3 bg-card border border-border rounded-xl">
            <MapPin className="w-5 h-5 text-apple-blue flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-foreground truncate">
                {selectedCity.name}
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {selectedCity.region && `${selectedCity.region}, `}
                {selectedCity.country}
              </div>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-muted rounded-lg transition-colors"
              aria-label="Clear location"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          // Show search input
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={() => setShowDropdown(true)}
              placeholder={placeholder}
              className="
                w-full pl-10 pr-4 py-3 rounded-xl
                border border-border
                focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20
                transition-all duration-200 outline-none
                text-foreground text-[15px]
                placeholder-muted-foreground
                bg-card
              "
              aria-label="Search for a city"
              aria-expanded={showDropdown}
              aria-controls="city-search-results"
              role="combobox"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground animate-spin" />
            )}
          </div>
        )}
      </div>

      {/* Dropdown with search results */}
      {showDropdown && !selectedCity && (
        <div
          ref={dropdownRef}
          id="city-search-results"
          className="
            absolute z-50 w-full mt-2 py-2
            bg-card border border-border rounded-xl
            shadow-lg max-h-64 overflow-y-auto
          "
          role="listbox"
        >
          {/* Use My Location button */}
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={isGeolocating}
            className="
              w-full flex items-center gap-3 px-4 py-3
              hover:bg-muted transition-colors
              text-left disabled:opacity-50
            "
          >
            {isGeolocating ? (
              <Loader2 className="w-5 h-5 text-apple-blue animate-spin" />
            ) : (
              <Navigation className="w-5 h-5 text-apple-blue" />
            )}
            <span className="font-medium text-apple-blue">
              {isGeolocating ? 'Getting location...' : 'Use My Location'}
            </span>
          </button>

          <div className="border-t border-border my-1" />

          {/* Search results */}
          {cities.length > 0 ? (
            cities.map((city) => (
              <button
                key={city.id}
                type="button"
                onClick={() => handleSelectCity(city)}
                className="
                  w-full flex items-center gap-3 px-4 py-3
                  hover:bg-muted transition-colors
                  text-left
                "
                role="option"
                aria-selected="false"
              >
                <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {city.name}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {city.region && `${city.region}, `}
                    {city.country}
                  </div>
                </div>
              </button>
            ))
          ) : query.length >= 2 && !isSearching ? (
            <div className="px-4 py-3 text-muted-foreground text-center">
              No cities found
            </div>
          ) : query.length < 2 ? (
            <div className="px-4 py-3 text-muted-foreground text-center text-sm">
              Type at least 2 characters to search
            </div>
          ) : null}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
