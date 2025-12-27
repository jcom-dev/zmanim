/**
 * API Client for Shtetl Zmanim Backend
 *
 * Centralized API configuration and client.
 * Use API_BASE for direct fetch calls or the api singleton for typed requests.
 *
 * @example Direct fetch:
 * const response = await fetch(`${API_BASE}/api/v1/endpoint`, {
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 *
 * @example With api client:
 * const publishers = await api.getPublishers();
 */

/** Base URL for API requests. Use this instead of hardcoding URLs. */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface Publisher {
  id: string;
  name: string;
  description: string;
  website: string;
  contact_email: string;
  logo_url?: string;
  is_verified: boolean;
  subscriber_count: number;
  created_at: string;
  updated_at: string;
}

export interface Algorithm {
  id: string;
  publisher_id: string;
  name: string;
  description: string;
  version: string;
  configuration: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ZmanimRequest {
  date: string;
  latitude: number;
  longitude: number;
  timezone: string;
  publisher_id?: string;
  elevation?: number;
}

export interface ZmanimResponse {
  date: string;
  location: {
    name: string;
    latitude: number;
    longitude: number;
    timezone: string;
    elevation?: number;
  };
  publisher?: Publisher;
  algorithm?: Algorithm;
  zmanim: Record<string, string>;
  cached_at?: string;
  calculated_at: string;
}

export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `API Error: ${response.status}`);
    }

    const json = await response.json();
    // Unwrap the data field from the API response
    // Backend returns: { data: {...}, meta: {...} }
    return json.data !== undefined ? json.data : json;
  }

  // Health check
  async healthCheck() {
    return this.fetch('/health');
  }

  // Publishers
  async getPublishers(params?: { page?: number; page_size?: number; region_id?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.page_size) queryParams.set('page_size', params.page_size.toString());
    if (params?.region_id) queryParams.set('region_id', params.region_id);

    const query = queryParams.toString();
    return this.fetch<{ publishers: Publisher[]; total: number; page: number; page_size: number }>(
      `/api/v1/publishers${query ? `?${query}` : ''}`
    );
  }

  async getPublisher(id: string) {
    return this.fetch<Publisher>(`/api/v1/publishers/${id}`);
  }

  // Locations
  async getLocations() {
    return this.fetch<{ locations: Location[]; total: number }>('/api/v1/locations');
  }

  // Zmanim
  async calculateZmanim(request: ZmanimRequest) {
    return this.fetch<ZmanimResponse>('/api/v1/zmanim', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }
}

export const api = new ApiClient();
