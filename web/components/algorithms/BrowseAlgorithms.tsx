'use client';
import { useApi } from '@/lib/api-client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ZmanPreview {
  key: string;
  name: string;
  name_hebrew?: string;
  sample_time: string;
}

interface PublicAlgorithm {
  id: string;
  name: string;
  description: string;
  publisher_id: string;
  publisher_name: string;
  publisher_logo?: string;
  template?: string;
  zmanim_preview: ZmanPreview[];
  fork_count: number;
  created_at: string;
}

interface BrowseAlgorithmsProps {
  onCopy?: (algorithmId: string) => void;
  onFork?: (algorithmId: string) => void;
  onPreview?: (algorithm: PublicAlgorithm) => void;
}

export function BrowseAlgorithms({ onCopy, onFork, onPreview }: BrowseAlgorithmsProps) {
  const api = useApi();
  const [algorithms, setAlgorithms] = useState<PublicAlgorithm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 12;

  const loadAlgorithms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });
      if (search) {
        params.set('search', search);
      }

      const data = await api.get<{ algorithms: PublicAlgorithm[]; total: number }>(`/algorithms/public?${params}`);
      setAlgorithms(data?.algorithms || []);
      setTotal(data?.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load algorithms');
    } finally {
      setLoading(false);
    }
  }, [api, page, search]);

  useEffect(() => {
    loadAlgorithms();
  }, [loadAlgorithms]);

  const handleCopy = async (algorithmId: string) => {
    try {
      const data = await api.post<{ new_algorithm_id: string }>(`/algorithms/${algorithmId}/copy`, {});
      onCopy?.(data?.new_algorithm_id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy algorithm');
    }
  };

  const handleFork = async (algorithmId: string) => {
    try {
      const data = await api.post<{ new_algorithm_id: string }>(`/algorithms/${algorithmId}/fork`, {});
      onFork?.(data?.new_algorithm_id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fork algorithm');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  if (loading && algorithms.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading algorithms...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Browse Public Algorithms</h2>
          <p className="text-muted-foreground">
            Explore algorithms shared by other publishers
          </p>
        </div>
        <div className="w-full md:w-64">
          <input
            type="text"
            placeholder="Search algorithms..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      {error && (
        <div className="alert-error">
          <p className="alert-error-text">{error}</p>
        </div>
      )}

      {/* Algorithm grid */}
      {algorithms.length === 0 ? (
        <div className="text-center p-8 text-muted-foreground">
          No public algorithms found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {algorithms.map((algorithm) => (
            <AlgorithmCard
              key={algorithm.id}
              algorithm={algorithm}
              onCopy={() => handleCopy(algorithm.id)}
              onFork={() => handleFork(algorithm.id)}
              onPreview={() => onPreview?.(algorithm)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

interface AlgorithmCardProps {
  algorithm: PublicAlgorithm;
  onCopy: () => void;
  onFork: () => void;
  onPreview?: () => void;
}

function AlgorithmCard({ algorithm, onCopy, onFork, onPreview }: AlgorithmCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{algorithm.name}</CardTitle>
            <CardDescription className="mt-1">
              by {algorithm.publisher_name}
            </CardDescription>
          </div>
          {algorithm.publisher_logo && (
            <div className="relative w-10 h-10">
              <Image
                src={algorithm.publisher_logo}
                alt={algorithm.publisher_name}
                fill
                className="rounded-full object-cover"
                unoptimized
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {algorithm.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {algorithm.description}
          </p>
        )}

        {/* Zmanim preview */}
        {algorithm.zmanim_preview.length > 0 && (
          <div className="mb-3 space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Sample Zmanim:</div>
            <div className="flex flex-wrap gap-1">
              {algorithm.zmanim_preview.slice(0, 3).map((zman) => (
                <span
                  key={zman.key}
                  className="text-xs px-2 py-0.5 bg-muted rounded"
                >
                  {zman.name}
                </span>
              ))}
              {algorithm.zmanim_preview.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{algorithm.zmanim_preview.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <ForkIcon className="w-3 h-3" />
            {algorithm.fork_count} forks
          </span>
        </div>

        {/* Actions */}
        <div className="mt-auto flex gap-2">
          {onPreview && (
            <Button variant="outline" size="sm" onClick={onPreview} className="flex-1">
              Preview
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onCopy} className="flex-1">
            <CopyIcon className="w-3 h-3 mr-1" />
            Copy
          </Button>
          <Button variant="default" size="sm" onClick={onFork} className="flex-1">
            <ForkIcon className="w-3 h-3 mr-1" />
            Fork
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ForkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="6" r="3" />
      <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" />
      <path d="M12 12v3" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
