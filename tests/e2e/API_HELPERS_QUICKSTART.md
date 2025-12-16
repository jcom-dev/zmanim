# API Helpers Quick Start Guide

**For E2E Test Authors**

This guide shows how to use the new API helper utilities introduced in Epic 9 Story 9.7.

## Import the Helpers

```typescript
import { test, expect } from '@playwright/test';
import {
  publisherApiUrl,
  adminApiUrl,
  publicApiUrl,
  normalizeApiPath,
} from '../utils';
```

## Usage Examples

### Publisher-Scoped Endpoints

For endpoints that require authentication + `X-Publisher-Id` header:

```typescript
// Get publisher profile
const response = await page.request.get(publisherApiUrl('profile'), {
  headers: { 'X-Publisher-Id': publisherId }
});

// Get publisher algorithm
const response = await page.request.get(publisherApiUrl('algorithm'), {
  headers: { 'X-Publisher-Id': publisherId }
});

// Create publisher zman
const response = await page.request.post(publisherApiUrl('zmanim'), {
  headers: {
    'X-Publisher-Id': publisherId,
    'Content-Type': 'application/json',
  },
  data: { ... }
});

// With URL parameters
const response = await page.request.get(
  publisherApiUrl('algorithm/history'),
  { headers: { 'X-Publisher-Id': publisherId } }
);

// With query string
const response = await page.request.get(
  publisherApiUrl(`zmanim?status=published`),
  { headers: { 'X-Publisher-Id': publisherId } }
);

// With dynamic segments
const versionId = '123';
const response = await page.request.get(
  publisherApiUrl(`algorithm/history/${versionId}`),
  { headers: { 'X-Publisher-Id': publisherId } }
);
```

**Generated URLs:**
- `publisherApiUrl('profile')` → `http://localhost:8080/api/v1/auth/publisher/profile`
- `publisherApiUrl('algorithm')` → `http://localhost:8080/api/v1/auth/publisher/algorithm`
- `publisherApiUrl('zmanim')` → `http://localhost:8080/api/v1/auth/publisher/zmanim`

### Admin-Scoped Endpoints

For endpoints that require authentication + admin role:

```typescript
// List all publishers (admin only)
const response = await page.request.get(adminApiUrl('publishers'));

// Get publisher details as admin
const response = await page.request.get(adminApiUrl(`publishers/${publisherId}`));

// Update publisher status (admin only)
const response = await page.request.patch(
  adminApiUrl(`publishers/${publisherId}/status`),
  {
    headers: { 'Content-Type': 'application/json' },
    data: { status: 'active' }
  }
);

// Get admin dashboard stats
const response = await page.request.get(adminApiUrl('stats'));
```

**Generated URLs:**
- `adminApiUrl('publishers')` → `http://localhost:8080/api/v1/auth/admin/publishers`
- `adminApiUrl('stats')` → `http://localhost:8080/api/v1/auth/admin/stats`

### Public Endpoints

For endpoints that don't require authentication:

```typescript
// Get list of cities
const response = await request.get(publicApiUrl('cities'));

// Get list of countries
const response = await request.get(publicApiUrl('countries'));

// Search locations
const query = 'London';
const response = await request.get(
  publicApiUrl(`locations/search?q=${encodeURIComponent(query)}`)
);

// Get list of active publishers
const response = await request.get(publicApiUrl('publishers'));

// Calculate zmanim for a location
const response = await request.get(
  publicApiUrl(`zmanim?city_id=123&date=2025-12-15`)
);
```

**Generated URLs:**
- `publicApiUrl('cities')` → `http://localhost:8080/api/v1/public/cities`
- `publicApiUrl('publishers')` → `http://localhost:8080/api/v1/public/publishers`
- `publicApiUrl('locations/search')` → `http://localhost:8080/api/v1/public/locations/search`

## Path Normalization

The `normalizeApiPath()` function automatically converts old paths to new structure:

```typescript
// Old paths are automatically converted
normalizeApiPath('/api/v1/publisher/profile')
// → '/api/v1/auth/publisher/profile'

normalizeApiPath('/api/v1/admin/publishers')
// → '/api/v1/auth/admin/publishers'

normalizeApiPath('/api/v1/cities')
// → '/api/v1/public/cities'

// New paths pass through unchanged
normalizeApiPath('/api/v1/auth/publisher/profile')
// → '/api/v1/auth/publisher/profile'
```

## Complete Example

```typescript
import { test, expect } from '@playwright/test';
import { loginAsPublisher, publisherApiUrl, publicApiUrl } from '../utils';
import { getSharedPublisher } from '../utils/shared-fixtures';

test.describe('Publisher Algorithm', () => {
  const testPublisher = getSharedPublisher('with-algorithm-1');

  test('publisher can update their algorithm', async ({ page }) => {
    // Login as publisher
    await loginAsPublisher(page, testPublisher.id);

    // Get current algorithm
    const getResponse = await page.request.get(
      publisherApiUrl('algorithm'),
      {
        headers: { 'X-Publisher-Id': testPublisher.id }
      }
    );

    expect(getResponse.ok()).toBeTruthy();
    const currentAlgorithm = await getResponse.json();

    // Update algorithm
    const updateResponse = await page.request.patch(
      publisherApiUrl('algorithm'),
      {
        headers: {
          'X-Publisher-Id': testPublisher.id,
          'Content-Type': 'application/json',
        },
        data: {
          status: 'published',
          config: { ...currentAlgorithm.config, updated: true }
        }
      }
    );

    expect(updateResponse.ok()).toBeTruthy();

    // Verify public can see it
    const publicResponse = await page.request.get(
      publicApiUrl(`publishers/${testPublisher.id}/algorithm`)
    );

    expect(publicResponse.ok()).toBeTruthy();
  });
});
```

## Best Practices

1. **Always use helper functions** - Don't hardcode API paths
2. **Use X-Publisher-Id header** - For all publisher-scoped endpoints
3. **Handle leading slashes** - Helpers work with or without leading `/`
4. **Encode query params** - Use `encodeURIComponent()` for query strings
5. **Test authentication** - Public endpoints should work without auth
6. **Test authorization** - Verify role-based access works correctly

## API Structure Reference

```
/api/v1/
├── auth/
│   ├── publisher/      (requires auth + X-Publisher-Id header)
│   │   ├── profile
│   │   ├── algorithm
│   │   ├── zmanim
│   │   ├── coverage
│   │   ├── team
│   │   └── correction-requests
│   │
│   └── admin/          (requires auth + admin role)
│       ├── publishers
│       ├── stats
│       └── ...
│
└── public/             (no authentication required)
    ├── cities
    ├── countries
    ├── publishers
    ├── locations/search
    └── zmanim
```

## Migration from Old Paths

**Old structure:**
```typescript
// ❌ Don't do this anymore
await page.request.get(`${API_BASE_URL}/publisher/profile`)
await page.request.get(`${API_URL}/api/v1/cities`)
```

**New structure:**
```typescript
// ✅ Use helpers instead
await page.request.get(publisherApiUrl('profile'))
await page.request.get(publicApiUrl('cities'))
```

## Environment Variables

The helpers automatically use the correct API URL from config:

```typescript
// From tests/config.ts
export const API_URL = process.env.API_URL || 'http://localhost:8080';
```

Override in CI/CD or different environments:
```bash
API_URL=https://api-dev.zmanim.shtetl.io npm run test:e2e
```

## Need Help?

- See `/home/coder/workspace/zmanim/tests/e2e/utils/api-helpers.ts` for implementation
- See `/home/coder/workspace/zmanim/docs/sprint-artifacts/stories/9-7-e2e-test-suite-refresh-SUMMARY.md` for detailed documentation
- Check existing tests for usage examples:
  - `tests/e2e/publisher/version-history.spec.ts`
  - `tests/e2e/search/location-search.spec.ts`
