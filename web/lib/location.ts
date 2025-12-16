import { DEFAULT_LOCATION } from './constants';

export interface LocationData {
  latitude: number;
  longitude: number;
  timeZone: string;
  elevation?: number;
  name?: string;
}

/**
 * Get user's current location using browser geolocation API
 */
export const getCurrentLocation = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
};

/**
 * Detect timezone from latitude and longitude
 * This is a simple approximation - for production use, consider a timezone API
 */
export const detectTimeZone = (latitude: number, longitude: number): string => {
  // Simple timezone detection based on longitude
  // For more accuracy, use a timezone API service
  if (latitude >= 29 && latitude <= 33 && longitude >= 34 && longitude <= 36) {
    return 'Asia/Jerusalem';
  } else if (longitude >= -125 && longitude <= -114) {
    return 'America/Los_Angeles';
  } else if (longitude >= -106 && longitude <= -93) {
    return 'America/Chicago';
  } else if (longitude >= -87 && longitude <= -67) {
    return 'America/New_York';
  } else if (longitude >= -11 && longitude <= 3) {
    return 'Europe/London';
  } else if (longitude >= -5 && longitude <= 10) {
    return 'Europe/Paris';
  }

  // Default fallback to system timezone
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Validate latitude and longitude values
 */
export const validateCoordinates = (
  latitude: number,
  longitude: number
): { valid: boolean; error?: string } => {
  if (latitude < -90 || latitude > 90) {
    return {
      valid: false,
      error: 'Latitude must be between -90 and 90 degrees',
    };
  }

  if (longitude < -180 || longitude > 180) {
    return {
      valid: false,
      error: 'Longitude must be between -180 and 180 degrees',
    };
  }

  return { valid: true };
};
