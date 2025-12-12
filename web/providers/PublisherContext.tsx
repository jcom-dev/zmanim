/**
 * @file PublisherContext.tsx
 * @purpose Publisher selection state - impersonation, multi-publisher routing
 * @pattern react-context
 * @dependencies useApi, useUser (Clerk), localStorage for persistence
 * @frequency critical - used by all publisher pages
 * @compliance Check docs/adr/ for pattern rationale
 */

'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, Suspense } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { createApiClient, ApiError } from '@/lib/api-client';
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
        const storedId = typeof window !== 'undefined' ? localStorage.getItem('selectedPublisherId') : null;

        let initialId = null;

        // Priority: URL param > localStorage > primary > first
        if (urlPublisherId && fetchedPublishers.some((p: Publisher) => p.id === urlPublisherId)) {
          initialId = urlPublisherId;
        } else if (storedId && fetchedPublishers.some((p: Publisher) => p.id === storedId)) {
          initialId = storedId;
        } else if (primaryPublisherId && fetchedPublishers.some((p: Publisher) => p.id === primaryPublisherId)) {
          initialId = primaryPublisherId;
        } else {
          initialId = fetchedPublishers[0].id;
        }

        setSelectedPublisherIdState(initialId);
        selectedPublisherIdRef.current = initialId;
        if (typeof window !== 'undefined' && initialId) {
          localStorage.setItem('selectedPublisherId', initialId);
        }
      }
    } catch (err) {
      if (!mountedRef.current) {
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
  }, [userLoaded, user, getToken, searchParams, primaryPublisherId]);

  // Fetch publishers on mount - only run once when user is ready
  useEffect(() => {
    if (userLoaded && user) {
      fetchPublishers();
    }
  }, [userLoaded, user, fetchPublishers]);

  // Handle publisher selection change
  const setSelectedPublisherId = useCallback((id: string) => {
    setSelectedPublisherIdState(id);
    selectedPublisherIdRef.current = id;

    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedPublisherId', id);
    }

    // Update URL without full navigation
    const params = new URLSearchParams(searchParams.toString());
    params.set('p', id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

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

  const contextValue: PublisherContextType = {
    selectedPublisherId,
    setSelectedPublisherId,
    publishers,
    selectedPublisher,
    isLoading: isLoading || !userLoaded,
    error,
    refreshPublishers: fetchPublishers,
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
