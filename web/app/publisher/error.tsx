'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PublisherError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error('Publisher error:', error);
  }, [error]);

  // Check if this is a network error (common during prefetch/navigation)
  const isNetworkError = error.message === 'Failed to fetch' ||
    error.message.includes('network') ||
    error.message.includes('Network');

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {isNetworkError ? 'Connection Error' : 'Something went wrong'}
        </h2>
        <p className="text-muted-foreground mb-6">
          {isNetworkError
            ? 'Unable to connect to the server. Please check your connection and try again.'
            : 'An unexpected error occurred while loading this page.'}
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="default">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try again
          </Button>
          <Button onClick={() => window.location.href = '/'} variant="outline">
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
