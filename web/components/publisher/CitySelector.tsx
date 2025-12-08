/**
 * @file CitySelector.tsx
 * @purpose City/region search for coverage - hierarchical search
 * @pattern client-component
 * @dependencies useApi, Command (shadcn), geo API
 * @frequency medium - 408 lines
 * @compliance Check docs/adr/ for pattern rationale
 */

'use client';
import { useApi } from '@/lib/api-client';
import type { City, Country, Region, CoverageLevel, CoverageSelection } from '@/types/geography';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Search, MapPin, Globe, Flag, Building } from 'lucide-react';

interface CitySelectorProps {
  onSelect: (selection: CoverageSelection) => void;
  onCancel: () => void;
}



export default function CitySelector({ onSelect, onCancel }: CitySelectorProps) {
  const api = useApi();
  const [level, setLevel] = useState<CoverageLevel>('country');
  const [countries, setCountries] = useState<Country[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);

  const [countrySearch, setCountrySearch] = useState('');
  const [regionSearch, setRegionSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');

  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [isLoadingRegions, setIsLoadingRegions] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCountries = useCallback(async () => {
    setIsLoadingCountries(true);
    setError(null);
    try {
      const data = await api.public.get<{ countries: Country[] }>('/countries');
      setCountries(data?.countries || []);
    } catch (err) {
      console.error('Failed to fetch countries:', err);
      setError('Failed to load countries');
    } finally {
      setIsLoadingCountries(false);
    }
  }, [api]);

  const fetchRegions = useCallback(async (countryCode: string) => {
    setIsLoadingRegions(true);
    setError(null);
    try {
      const data = await api.public.get<{ regions: Region[] }>(`/regions?country_code=${countryCode}`);
      setRegions(data?.regions || []);
    } catch (err) {
      console.error('Failed to fetch regions:', err);
      setError('Failed to load regions');
    } finally {
      setIsLoadingRegions(false);
    }
  }, [api]);

  const searchCities = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCities([]);
      return;
    }

    setIsLoadingCities(true);
    try {
      const data = await api.public.get<{ cities: City[] }>(`/cities?search=${encodeURIComponent(query)}&limit=20`);
      let fetchedCities = data?.cities || [];

      // Client-side filter by country/region if selected
      if (selectedCountry) {
        fetchedCities = fetchedCities.filter((c: City) => c.country_code === selectedCountry.code);
      }
      if (selectedRegion) {
        fetchedCities = fetchedCities.filter((c: City) => c.region === selectedRegion.name);
      }

      setCities(fetchedCities);
    } catch (err) {
      console.error('Failed to search cities:', err);
    } finally {
      setIsLoadingCities(false);
    }
  }, [api, selectedCountry, selectedRegion]);

  // Fetch countries on mount
  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

  // Fetch regions when country changes
  useEffect(() => {
    if (selectedCountry && (level === 'region' || level === 'city')) {
      fetchRegions(selectedCountry.code);
    } else {
      setRegions([]);
    }
    setSelectedRegion(null);
    setCities([]);
  }, [selectedCountry, level, fetchRegions]);

  // Debounced city search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (citySearch) {
        searchCities(citySearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [citySearch, searchCities]);

  const handleConfirm = () => {
    if (level === 'country' && selectedCountry) {
      onSelect({
        level: 'country',
        countryCode: selectedCountry.code,
        countryName: selectedCountry.name,
        displayName: selectedCountry.name,
      });
    } else if (level === 'region' && selectedCountry && selectedRegion) {
      onSelect({
        level: 'region',
        countryCode: selectedCountry.code,
        countryName: selectedCountry.name,
        region: selectedRegion.name,
        displayName: `${selectedRegion.name}, ${selectedCountry.code}`,
      });
    }
    // City is selected directly from the list
  };

  const handleCitySelect = (city: City) => {
    onSelect({
      level: 'city',
      cityId: city.id,
      cityName: city.name,
      countryCode: city.country_code,
      countryName: city.country,
      region: city.region || undefined,
      displayName: city.display_name,
    });
  };

  const filteredCountries = countries.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const filteredRegions = regions.filter(r =>
    r.name.toLowerCase().includes(regionSearch.toLowerCase())
  );

  const canConfirm =
    (level === 'country' && selectedCountry) ||
    (level === 'region' && selectedCountry && selectedRegion);

  return (
    <div className="space-y-6">
      {/* Level Selector */}
      <div>
        <label className="block text-sm font-medium mb-2">Coverage Level</label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={level === 'country' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLevel('country')}
            className="flex items-center gap-2"
          >
            <Globe className="w-4 h-4" />
            Country
          </Button>
          <Button
            type="button"
            variant={level === 'region' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLevel('region')}
            className="flex items-center gap-2"
          >
            <Flag className="w-4 h-4" />
            Region
          </Button>
          <Button
            type="button"
            variant={level === 'city' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLevel('city')}
            className="flex items-center gap-2"
          >
            <Building className="w-4 h-4" />
            City
          </Button>
        </div>
      </div>

      {/* Country Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Country {level !== 'city' ? '*' : '(optional filter)'}
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={countrySearch}
            onChange={(e) => setCountrySearch(e.target.value)}
            placeholder="Search countries..."
            className="w-full pl-9 pr-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
          />
        </div>
        {isLoadingCountries ? (
          <p className="text-sm text-muted-foreground mt-2">Loading countries...</p>
        ) : (
          <div className="mt-2 max-h-40 overflow-y-auto border rounded-md">
            {filteredCountries.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  setSelectedCountry(country);
                  setCountrySearch('');
                }}
                className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 ${
                  selectedCountry?.code === country.code ? 'bg-primary/10 text-primary' : ''
                }`}
              >
                <span className="font-medium">{country.name}</span>
                <span className="text-muted-foreground text-sm">({country.code})</span>
              </button>
            ))}
            {filteredCountries.length === 0 && (
              <p className="px-3 py-2 text-muted-foreground text-sm">No countries found</p>
            )}
          </div>
        )}
        {selectedCountry && (
          <div className="mt-2 p-2 bg-primary/10 rounded-md flex items-center justify-between">
            <span className="text-primary font-medium">{selectedCountry.name}</span>
            <button
              type="button"
              onClick={() => setSelectedCountry(null)}
              className="text-primary hover:text-primary/80 text-sm"
            >
              Change
            </button>
          </div>
        )}
      </div>

      {/* Region Selection (for region/city level) */}
      {(level === 'region' || level === 'city') && selectedCountry && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Region {level === 'region' ? '*' : '(optional filter)'}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={regionSearch}
              onChange={(e) => setRegionSearch(e.target.value)}
              placeholder="Search regions..."
              className="w-full pl-9 pr-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
            />
          </div>
          {isLoadingRegions ? (
            <p className="text-sm text-muted-foreground mt-2">Loading regions...</p>
          ) : (
            <div className="mt-2 max-h-40 overflow-y-auto border rounded-md">
              {filteredRegions.map((region) => (
                <button
                  key={region.name}
                  type="button"
                  onClick={() => {
                    setSelectedRegion(region);
                    setRegionSearch('');
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-muted ${
                    selectedRegion?.name === region.name ? 'bg-primary/10 text-primary' : ''
                  }`}
                >
                  {region.name}
                  {region.type && <span className="text-muted-foreground text-sm ml-2">({region.type})</span>}
                </button>
              ))}
              {filteredRegions.length === 0 && (
                <p className="px-3 py-2 text-muted-foreground text-sm">No regions found</p>
              )}
            </div>
          )}
          {selectedRegion && (
            <div className="mt-2 p-2 bg-primary/10 rounded-md flex items-center justify-between">
              <span className="text-primary font-medium">{selectedRegion.name}</span>
              <button
                type="button"
                onClick={() => setSelectedRegion(null)}
                className="text-primary hover:text-primary/80 text-sm"
              >
                Change
              </button>
            </div>
          )}
        </div>
      )}

      {/* City Search (for city level) */}
      {level === 'city' && (
        <div>
          <label className="block text-sm font-medium mb-2">City *</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={citySearch}
              onChange={(e) => setCitySearch(e.target.value)}
              placeholder="Search for a city..."
              className="w-full pl-9 pr-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
            />
          </div>
          {isLoadingCities ? (
            <p className="text-sm text-muted-foreground mt-2">Searching cities...</p>
          ) : cities.length > 0 ? (
            <div className="mt-2 max-h-48 overflow-y-auto border rounded-md">
              {cities.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => handleCitySelect(city)}
                  className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="font-medium">{city.name}</span>
                    <span className="text-muted-foreground text-sm ml-2">
                      {city.region && `${city.region}, `}{city.country}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : citySearch.length >= 2 ? (
            <p className="text-sm text-muted-foreground mt-2">No cities found</p>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">Type at least 2 characters to search</p>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {level !== 'city' && (
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Add Coverage
          </Button>
        )}
      </div>
    </div>
  );
}
