/**
 * @file LocationInput.tsx
 * @description Manual latitude/longitude input with geolocation support
 * @module components
 *
 * Provides location input via:
 * - Manual coordinate entry (latitude/longitude)
 * - Browser geolocation API ("Use My Location" button)
 * - Automatic timezone detection based on coordinates
 *
 * @example
 * ```tsx
 * <LocationInput
 *   onLocationChange={(lat, lon, tz) => {
 *     setLocation({ latitude: lat, longitude: lon, timezone: tz });
 *   }}
 * />
 * ```
 */
'use client';

import { useState } from 'react';
import { getCurrentLocation, validateCoordinates, detectTimeZone } from '@/lib/location';
import { DEFAULT_LOCATION } from '@/lib/constants';

/**
 * Props for the LocationInput component
 */
interface LocationInputProps {
  /** Callback fired when location changes, includes timezone */
  onLocationChange: (latitude: number, longitude: number, timeZone: string) => void;
}

export default function LocationInput({ onLocationChange }: LocationInputProps) {
  const [latitude, setLatitude] = useState(DEFAULT_LOCATION.latitude.toString());
  const [longitude, setLongitude] = useState(DEFAULT_LOCATION.longitude.toString());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    const validation = validateCoordinates(lat, lon);
    if (!validation.valid) {
      setError(validation.error || 'Invalid coordinates');
      return;
    }

    const timeZone = detectTimeZone(lat, lon);
    onLocationChange(lat, lon, timeZone);
  };

  const handleUseMyLocation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const position = await getCurrentLocation();
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      setLatitude(lat.toFixed(4));
      setLongitude(lon.toFixed(4));

      const timeZone = detectTimeZone(lat, lon);
      onLocationChange(lat, lon, timeZone);
    } catch (err) {
      setError('Unable to get your location. Please enter coordinates manually.');
      console.error('Geolocation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl shadow-apple p-6 md:p-8 border border-border">
      <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center">
        <svg
          className="w-5 h-5 mr-2 text-apple-blue"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Location
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Latitude Input */}
          <div>
            <label
              htmlFor="latitude"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Latitude
            </label>
            <input
              id="latitude"
              type="number"
              step="0.0001"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="
                w-full px-4 py-2.5 rounded-xl
                border border-border
                focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20
                transition-all duration-200 outline-hidden
                text-foreground font-normal text-[15px]
                placeholder-muted-foreground
                bg-card
              "
              placeholder="31.7683"
            />
          </div>

          {/* Longitude Input */}
          <div>
            <label
              htmlFor="longitude"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Longitude
            </label>
            <input
              id="longitude"
              type="number"
              step="0.0001"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="
                w-full px-4 py-2.5 rounded-xl
                border border-border
                focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20
                transition-all duration-200 outline-hidden
                text-foreground font-normal text-[15px]
                placeholder-muted-foreground
                bg-card
              "
              placeholder="35.2137"
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="submit"
            className="
              flex-1 bg-apple-blue hover:bg-apple-blue/90
              text-white font-medium py-2.5 px-5 rounded-xl
              transition-all duration-200
              shadow-xs hover:shadow-md
            "
          >
            Update Location
          </button>

          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={isLoading}
            className="
              flex-1 bg-muted hover:bg-secondary
              text-foreground font-medium py-2.5 px-5 rounded-xl
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center
            "
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-foreground"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Getting Location...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 11c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z"
                  />
                </svg>
                Use My Location
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
