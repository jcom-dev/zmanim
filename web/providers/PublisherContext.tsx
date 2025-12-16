/**
 * @file PublisherContext.tsx
 * @purpose Publisher selection state - impersonation, multi-publisher routing
 * @pattern react-context
 * @dependencies useApi, useUser (Clerk), PreferencesContext for cookie persistence
 * @frequency critical - used by all publisher pages
 * @compliance Check docs/adr/ for pattern rationale
 */

'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, Suspense } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { createApiClient, ApiError } from '@/lib/api-client';
import { usePreferences } from '@/lib/contexts/PreferencesContext';
import type { ClerkPublicMetadata } from '@/types/clerk';

const JWT_TEMPLATE = process.env.NEXT_PUBLIC_CLERK_JWT_TEMPLATE || 'zmanim-api';

interface Publisher {
  id: string;
  name: string;
  status: string;
}

interface PublisherContextType {
  selectedPublisherId: string | null;
  setSelectedPublisherId: (id: string) => void;
  publishers: Publisher[];
  selectedPublisher: Publisher | null;
  isLoading: boolean;
  error: string | null;
  refreshPublishers: () => Promise<void>;
  // True when user has multiple publishers and none is selected yet (requires modal)
  requiresSelection: boolean;
  // Impersonation state
  isImpersonating: boolean;
  impersonatedPublisher: Publisher | null;
  startImpersonation: (publisherId: string, publisher: Publisher) => void;
  exitImpersonation: () => void;
}

const PublisherContext = createContext<PublisherContextType | null>(null);

function PublisherProviderInner({ children }: { children: ReactNode }) {
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { preferences, setPublisherId: setCookiePublisherId } = usePreferences();

  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [selectedPublisherId, setSelectedPublisherIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Impersonation state
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedPublisher, setImpersonatedPublisher] = useState<Publisher | null>(null);

  // Use refs to avoid stale closures in async operations
  const selectedPublisherIdRef = useRef(selectedPublisherId);
  const fetchInProgressRef = useRef(false);
  const mountedRef = useRef(true);

  // Keep ref in sync with state
  useEffect(() => {
    selectedPublisherIdRef.current = selectedPublisherId;
  }, [selectedPublisherId]);

  // Track mount status
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Extract publisher IDs from Clerk metadata
  const metadata = user?.publicMetadata as ClerkPublicMetadata | undefined;
  const primaryPublisherId = metadata?.primary_publisher_id;

  // Fetch publisher details from API
  const fetchPublishers = useCallback(async () => {
    if (!userLoaded || !user) {
      setIsLoading(false);
      return;
    }

    // Prevent concurrent fetches
    if (fetchInProgressRef.current) {
      return;
    }
    fetchInProgressRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      // Create API client without publisher context (we're bootstrapping it)
      // Use JWT template for API Gateway auth
      const getApiToken = () => getToken({ template: JWT_TEMPLATE });
      const api = createApiClient(getApiToken, null);

      const data = await api.get<{ publishers: Publisher[] }>('/publisher/accessible', {
        skipPublisherId: true,
      });

      // Check if component is still mounted
      if (!mountedRef.current) {
        return;
      }

      const fetchedPublishers = data.publishers || [];
      setPublishers(fetchedPublishers);

      // Initialize selection if we have publishers but no selection yet
      // Use ref to get current value, avoiding stale closure
      if (fetchedPublishers.length > 0 && !selectedPublisherIdRef.current) {
        const urlPublisherId = searchParams.get('p');

        // One-time migration: read from localStorage, migrate to cookie, then delete
        let legacyStoredId: string | null = null;
        if (typeof window !== 'undefined') {
          legacyStoredId = localStorage.getItem('selectedPublisherId');
          if (legacyStoredId) {
            // Migrate to cookie and clean up
            setCookiePublisherId(legacyStoredId);
            localStorage.removeItem('selectedPublisherId');
          }
        }

        // Use cookie value (which includes migrated value)
        const cookieId = preferences.publisherId || legacyStoredId;

        let initialId: string | null = null;

        // Priority: URL param > cookie > primary > (first only if single publisher)
        if (urlPublisherId && fetchedPublishers.some((p: Publisher) => p.id === urlPublisherId)) {
          initialId = urlPublisherId;
        } else if (cookieId && fetchedPublishers.some((p: Publisher) => p.id === cookieId)) {
          initialId = cookieId;
        } else if (primaryPublisherId && fetchedPublishers.some((p: Publisher) => p.id === primaryPublisherId)) {
          initialId = primaryPublisherId;
        } else if (fetchedPublishers.length === 1) {
          // Only auto-select if there's exactly one publisher
          initialId = fetchedPublishers[0].id;
        }
        // If multiple publishers and no saved selection, leave initialId as null
        // This triggers requiresSelection = true, showing the blocking modal

        if (initialId) {
          setSelectedPublisherIdState(initialId);
          selectedPublisherIdRef.current = initialId;
          // Save to cookie
          setCookiePublisherId(initialId);
        }
      }
    } catch (err) {
      if (!mountedRef.current) {
        return;
      }
      // Handle network errors gracefully (common during prefetch/navigation)
      if (err instanceof Error && err.message === 'Failed to fetch') {
        // Network error - likely CORS, connection, or auth timing issue
        // Don't set an error that would block the UI - the user can retry
        console.warn('Network error fetching publishers - will retry on next render');
        setError(null);
        return;
      }
      if (err instanceof ApiError && err.isUnauthorized) {
        setError('Not authenticated');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load publishers');
      }
      console.error('Failed to fetch publishers:', err);
    } finally {
      fetchInProgressRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [userLoaded, user, getToken, searchParams, primaryPublisherId, preferences.publisherId, setCookiePublisherId]);

  // Fetch publishers on mount - only run once when user is ready
  useEffect(() => {
    if (userLoaded && user) {
      fetchPublishers();
    }
  }, [userLoaded, user, fetchPublishers]);

  // Handle publisher selection change
  const setSelectedPublisherId = useCallback((id: string) => {
    const previousId = selectedPublisherIdRef.current;
    setSelectedPublisherIdState(id);
    selectedPublisherIdRef.current = id;

    // Save to cookie
    setCookiePublisherId(id);

    // If publisher actually changed (not initial load), invalidate all queries
    // This ensures coverage, zmanim, and other publisher-specific data is refetched
    if (previousId && previousId !== id) {
      // Invalidate all queries to force refetch with new publisher context
      queryClient.invalidateQueries();
    }

    // Update URL without full navigation
    const params = new URLSearchParams(searchParams.toString());
    params.set('p', id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname, setCookiePublisherId, queryClient]);

  // Start impersonation (admin only)
  const startImpersonation = useCallback((publisherId: string, publisher: Publisher) => {
    setIsImpersonating(true);
    setImpersonatedPublisher(publisher);
    setSelectedPublisherIdState(publisherId);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('impersonating', JSON.stringify({ publisherId, publisher }));
    }
    router.push('/publisher/dashboard');
  }, [router]);

  // Exit impersonation
  const exitImpersonation = useCallback(() => {
    setIsImpersonating(false);
    const previousPublisher = impersonatedPublisher;
    setImpersonatedPublisher(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('impersonating');
    }
    router.push(previousPublisher ? `/admin/publishers/${previousPublisher.id}` : '/admin/publishers');
  }, [router, impersonatedPublisher]);

  // Check for impersonation state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('impersonating');
      if (stored) {
        try {
          const { publisherId, publisher } = JSON.parse(stored);
          setIsImpersonating(true);
          setImpersonatedPublisher(publisher);
          setSelectedPublisherIdState(publisherId);
        } catch {
          sessionStorage.removeItem('impersonating');
        }
      }
    }
  }, []);

  // Get the effective selected publisher (impersonated or regular)
  const selectedPublisher = isImpersonating && impersonatedPublisher
    ? impersonatedPublisher
    : publishers.find(p => p.id === selectedPublisherId) || null;

  // Requires selection when: multiple publishers exist, none selected, not loading, and not impersonating
  const requiresSelection = !isLoading && !isImpersonating && publishers.length > 1 && !selectedPublisherId;

  const contextValue: PublisherContextType = {
    selectedPublisherId,
    setSelectedPublisherId,
    publishers,
    selectedPublisher,
    isLoading: isLoading || !userLoaded,
    error,
    refreshPublishers: fetchPublishers,
    requiresSelection,
    // Impersonation
    isImpersonating,
    impersonatedPublisher,
    startImpersonation,
    exitImpersonation,
  };

  return (
    <PublisherContext.Provider value={contextValue}>
      {children}
    </PublisherContext.Provider>
  );
}

export function PublisherProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PublisherProviderInner>{children}</PublisherProviderInner>
    </Suspense>
  );
}

export function usePublisherContext() {
  const context = useContext(PublisherContext);
  if (!context) {
    throw new Error('usePublisherContext must be used within PublisherProvider');
  }
  return context;
}

/**
 * Optional version of usePublisherContext that returns null instead of throwing
 * when used outside of PublisherProvider. Useful for components that work
 * both inside and outside the provider.
 */
export function usePublisherContextOptional() {
  return useContext(PublisherContext);
}
