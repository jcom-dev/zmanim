# ADR-002: Unified API Client Pattern (useApi)

**Status:** Accepted
**Date:** 2025-11-20
**Deciders:** Architecture Team, Frontend Lead
**Impact:** Critical (PR Blocker for new components)

## Context

Prior to November 2025, frontend API calls were inconsistent:
- 73 raw `fetch()` calls scattered across components
- Manual token handling in each component
- Inconsistent error handling
- No centralized auth header management
- X-Publisher-Id header manually set in 30+ places
- Different base URL logic across files

**Problems:**
```tsx
// 30+ variations of this pattern
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const token = await getToken();
const response = await fetch(`${API_BASE}/api/v1/publisher/zmanim`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-Publisher-Id': selectedPublisher?.id || '',
    'Content-Type': 'application/json',
  },
});
// Inconsistent error handling
if (!response.ok) throw new Error('Failed');
const data = await response.json();
```

This caused:
- 15+ auth bugs (token null, missing headers)
- Difficult refactoring (change auth → update 73 files)
- No type safety for responses
- Cannot mock API for testing

## Decision

**ALL frontend API calls MUST use the unified `useApi()` hook.**

**Implementation:** `web/lib/api-client.ts`

```tsx
import { useApi } from '@/lib/api-client';

export function Component() {
  const api = useApi();

  // Publisher endpoints (auto adds auth + X-Publisher-Id)
  await api.get<DataType>('/publisher/profile');
  await api.post('/publisher/zmanim', payload);
  await api.put('/publisher/zmanim/123', updates);
  await api.delete('/publisher/zmanim/123');

  // Public endpoints (no auth)
  await api.public.get('/countries');
  await api.public.get('/cities/search?q=Tel+Aviv');

  // Admin endpoints (auth only, no X-Publisher-Id)
  await api.admin.get('/admin/stats');
  await api.admin.put('/admin/publishers/5', data);
}
```

## Architecture

### API Client Structure

```typescript
interface ApiClient {
  // Publisher endpoints
  get<T>(endpoint: string, options?: RequestInit): Promise<T>;
  post<T>(endpoint: string, body?: any, options?: RequestInit): Promise<T>;
  put<T>(endpoint: string, body?: any, options?: RequestInit): Promise<T>;
  delete<T>(endpoint: string, options?: RequestInit): Promise<T>;

  // Public endpoints (no auth)
  public: {
    get<T>(endpoint: string): Promise<T>;
    post<T>(endpoint: string, body?: any): Promise<T>;
  };

  // Admin endpoints (auth, no X-Publisher-Id)
  admin: {
    get<T>(endpoint: string): Promise<T>;
    post<T>(endpoint: string, body?: any): Promise<T>;
    put<T>(endpoint: string, body?: any): Promise<T>;
    delete<T>(endpoint: string): Promise<T>;
  };
}
```

### Automatic Handling

The client automatically:
1. **Base URL:** Reads from `NEXT_PUBLIC_API_URL` env var
2. **Auth token:** Gets from Clerk `getToken()` (only if `isLoaded`)
3. **X-Publisher-Id:** Reads from `PublisherContext.selectedPublisher.id`
4. **Content-Type:** Sets to `application/json` for POST/PUT
5. **Error handling:** Parses error messages from API response
6. **Response unwrapping:** Extracts `data` from `{ data, meta }` envelope

## Consequences

### Positive
✅ **Centralized auth:** Change token logic once, all components update
✅ **Type safety:** Generics provide IDE autocomplete
✅ **Consistency:** Same error handling everywhere
✅ **Testability:** Mock useApi hook, not fetch
✅ **No header bugs:** X-Publisher-Id automatically set
✅ **Simpler code:** 5 lines → 1 line

### Negative
✗ **React dependency:** Can only use in components (not plain .ts files)
✗ **Learning curve:** Team must learn new pattern
✗ **PublisherContext coupling:** Requires context setup

**Trade-off accepted:** Benefits far outweigh coupling.

## Compliance Verification

**Detection:**
```bash
grep -r "await fetch(" web/app web/components --include="*.tsx" | wc -l
# Should return 0 (or only exempted cases)
```

**Current Status:** 98/100 (98%)
**Violations:**
- `CoverageMapViewGL.tsx:404` - MapLibre tile URLs (exempted - third-party)
- `LogoUpload.tsx:150` - Blob conversion (needs migration)

**Exemptions:**
- Third-party library integration (MapLibre, etc.)
- Server-side API routes (use direct fetch)

## Examples

### ✓ Correct (useApi)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useApi } from '@/lib/api-client';

interface Publisher {
  id: number;
  name: string;
  status: string;
}

export function PublisherProfile() {
  const { isLoaded } = useUser();
  const api = useApi();
  const [publisher, setPublisher] = useState<Publisher | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    const fetchProfile = async () => {
      try {
        const data = await api.get<Publisher>('/publisher/profile');
        setPublisher(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [isLoaded, api]);

  if (isLoading) return <Loader2 className="animate-spin" />;
  if (error) return <div className="text-destructive">{error}</div>;

  return <div>{publisher?.name}</div>;
}
```

### ✗ Forbidden (Raw fetch)

```tsx
// FORBIDDEN - Manual token handling, no type safety
const API_BASE = process.env.NEXT_PUBLIC_API_URL;
const token = await getToken();
const response = await fetch(`${API_BASE}/api/v1/publisher/profile`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-Publisher-Id': selectedPublisher.id,
    'Content-Type': 'application/json',
  },
});
const json = await response.json();
const data = json.data; // Manual unwrapping
```

## Integration with React Query

For components with caching needs, combine with `usePublisherQuery`:

```tsx
import { usePublisherQuery } from '@/lib/hooks';

export function PublisherProfile() {
  const { data, isLoading, error } = usePublisherQuery<Publisher>(
    'publisher-profile',
    '/publisher/profile'
  );

  // usePublisherQuery internally uses useApi
  // + adds React Query caching, refetching, etc.
}
```

## Error Handling

The API client throws typed errors:

```tsx
try {
  await api.post('/publisher/zmanim', payload);
} catch (err) {
  if (err.status === 401) {
    // Unauthorized
  } else if (err.status === 400) {
    // Validation error - err.message has details
  } else {
    // Generic error
  }
}
```

## File Upload Example

```tsx
const handleUpload = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const result = await api.post('/upload', formData);
  // Content-Type: multipart/form-data auto-detected
};
```

## Migration Path

For existing raw fetch calls:
1. Import `useApi`
2. Replace fetch with `api.get/post/put/delete`
3. Remove manual token/header logic
4. Use TypeScript generics for type safety
5. Test auth flow (isLoaded check)
6. Delete old fetch code

**Before:**
```tsx
const token = await getToken();
const response = await fetch(`${API_BASE}/endpoint`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();
```

**After:**
```tsx
const api = useApi();
const data = await api.get<DataType>('/endpoint');
```

## PublisherContext Integration

The `useApi` hook automatically reads `selectedPublisher` from context:

```tsx
// In provider
<PublisherProvider>
  <Component />
</PublisherProvider>

// In component
const api = useApi(); // Automatically gets selectedPublisher.id
await api.get('/publisher/zmanim'); // X-Publisher-Id auto-set
```

## Related Standards

- Frontend Standards: Clerk isLoaded check REQUIRED
- Testing: Mock useApi hook, not fetch
- Error Handling: Consistent error display

## Related ADRs

- ADR-003: PublisherResolver Pattern (backend equivalent)
- ADR-005: Design Tokens Only (for error display styling)

## Review Checklist

When reviewing PRs:
- [ ] No raw `fetch()` calls (except exempted cases)
- [ ] Uses `useApi()` hook for API calls
- [ ] Type parameter provided (`api.get<Type>()`)
- [ ] Proper endpoint namespace (`/publisher/`, `/admin/`, public)
- [ ] Clerk `isLoaded` checked before API calls

## Last Audit

**Date:** 2025-12-07
**Result:** 98% compliance (2 violations, 1 exempted)
**Target:** 100% by 2025-12-15
**Next Review:** 2026-01-07
