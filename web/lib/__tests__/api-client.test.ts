import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApiClient, ApiError } from '../api-client';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('createApiClient', () => {
  const mockGetToken = vi.fn().mockResolvedValue('test-token');
  const mockPublisher = { id: 'pub-123', name: 'Test Publisher' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('request', () => {
    it('should make GET request with auth token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: { message: 'success' } }),
      });

      const api = createApiClient(mockGetToken, mockPublisher);
      const result = await api.get('/publisher/profile');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/publisher/profile'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
            'X-Publisher-Id': 'pub-123',
          }),
        })
      );
      expect(result).toEqual({ message: 'success' });
    });

    it('should skip publisher ID header when requested', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: {} }),
      });

      const api = createApiClient(mockGetToken, mockPublisher);
      await api.get('/publisher/profile', { skipPublisherId: true });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['X-Publisher-Id']).toBeUndefined();
    });

    it('should skip auth when requested', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: {} }),
      });

      const api = createApiClient(mockGetToken, mockPublisher);
      await api.get('/publisher/profile', { skipAuth: true });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should throw ApiError on 401 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Not authenticated' }),
      });

      const api = createApiClient(mockGetToken, mockPublisher);

      await expect(api.get('/publisher/profile')).rejects.toThrow(ApiError);
    });

    it('should throw ApiError on 404 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Resource not found' }),
      });

      const api = createApiClient(mockGetToken, mockPublisher);

      try {
        await api.get('/publisher/profile');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).isNotFound).toBe(true);
      }
    });

    it('should throw ApiError when no token available', async () => {
      const noTokenFn = vi.fn().mockResolvedValue(null);
      const api = createApiClient(noTokenFn, mockPublisher);

      await expect(api.get('/publisher/profile')).rejects.toThrow(ApiError);
    });
  });

  describe('POST request', () => {
    it('should make POST request with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: { id: 'new-123' } }),
      });

      const api = createApiClient(mockGetToken, mockPublisher);
      const result = await api.post('/publisher/zmanim', {
        body: JSON.stringify({ name: 'test' }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/publisher/zmanim'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' }),
        })
      );
      expect(result).toEqual({ id: 'new-123' });
    });
  });

  describe('PUT request', () => {
    it('should make PUT request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: { updated: true } }),
      });

      const api = createApiClient(mockGetToken, mockPublisher);
      await api.put('/publisher/zmanim/123', {
        body: JSON.stringify({ name: 'updated' }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/publisher/zmanim/123'),
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });
  });

  describe('DELETE request', () => {
    it('should make DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      const api = createApiClient(mockGetToken, mockPublisher);
      await api.delete('/publisher/zmanim/123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/publisher/zmanim/123'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('public API', () => {
    it('should make public request without auth', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: { countries: [] } }),
      });

      const api = createApiClient(mockGetToken, mockPublisher);
      await api.public.get('/countries');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  describe('admin API', () => {
    it('should make admin request without publisher ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: { stats: {} } }),
      });

      const api = createApiClient(mockGetToken, mockPublisher);
      await api.admin.get('/admin/stats');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['X-Publisher-Id']).toBeUndefined();
      expect(headers['Authorization']).toBe('Bearer test-token');
    });
  });
});

describe('ApiError', () => {
  it('should have correct properties', () => {
    const error = new ApiError('Test error', 401, { detail: 'unauthorized' }, '/test');

    expect(error.message).toBe('Test error');
    expect(error.status).toBe(401);
    expect(error.data).toEqual({ detail: 'unauthorized' });
    expect(error.endpoint).toBe('/test');
  });

  it('should correctly identify unauthorized', () => {
    const error = new ApiError('Unauthorized', 401);
    expect(error.isUnauthorized).toBe(true);
    expect(error.isForbidden).toBe(false);
    expect(error.isNotFound).toBe(false);
    expect(error.isServerError).toBe(false);
  });

  it('should correctly identify forbidden', () => {
    const error = new ApiError('Forbidden', 403);
    expect(error.isUnauthorized).toBe(false);
    expect(error.isForbidden).toBe(true);
    expect(error.isNotFound).toBe(false);
  });

  it('should correctly identify not found', () => {
    const error = new ApiError('Not Found', 404);
    expect(error.isNotFound).toBe(true);
    expect(error.isServerError).toBe(false);
  });

  it('should correctly identify server error', () => {
    const error500 = new ApiError('Internal Server Error', 500);
    const error503 = new ApiError('Service Unavailable', 503);

    expect(error500.isServerError).toBe(true);
    expect(error503.isServerError).toBe(true);
  });
});
