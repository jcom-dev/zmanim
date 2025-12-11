'use client';
import { useApi } from '@/lib/api-client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface VisibilityToggleProps {
  isPublic: boolean;
  onChange?: (isPublic: boolean) => void;
}

export function VisibilityToggle({ isPublic: initialPublic, onChange }: VisibilityToggleProps) {
  const api = useApi();
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleVisibility = async () => {
    setLoading(true);
    setError(null);
    const newValue = !isPublic;

    try {
      await api.put('/publisher/algorithm/visibility', {
        body: JSON.stringify({ is_public: newValue }),
      });

      setIsPublic(newValue);
      onChange?.(newValue);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update visibility');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="font-medium">Algorithm Visibility</div>
        <div className="text-sm text-muted-foreground">
          {isPublic
            ? 'Your algorithm is public and can be viewed, copied, or forked by others.'
            : 'Your algorithm is private and only visible to you.'}
        </div>
        {error && (
          <div className="text-sm text-red-600 mt-1">{error}</div>
        )}
      </div>
      <Button
        variant={isPublic ? 'default' : 'outline-solid'}
        onClick={toggleVisibility}
        disabled={loading}
        className="min-w-[100px]"
      >
        {loading ? (
          'Saving...'
        ) : isPublic ? (
          <>
            <GlobeIcon className="w-4 h-4 mr-2" />
            Public
          </>
        ) : (
          <>
            <LockIcon className="w-4 h-4 mr-2" />
            Private
          </>
        )}
      </Button>
    </div>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
