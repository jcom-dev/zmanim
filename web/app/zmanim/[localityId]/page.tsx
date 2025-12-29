'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { MapPin, ChevronRight, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useApi } from '@/lib/api-client';
import { ModeToggle } from '@/components/mode-toggle';
import { Footer } from '@/components/shared/Footer';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { LocalitySearchResult } from '@/types/geography';

// Extend LocalitySearchResult with optional fields
interface Locality extends Omit<LocalitySearchResult, 'country_name'> {
  country: string;  // API returns 'country' field for backward compatibility
  locality_type?: string;       // Locality type code (city, town, village, etc.)
  locality_type_name?: string;  // Human-readable locality type name
  display_hierarchy?: string;   // Full hierarchy path
}

// API response shape from get_publishers_for_locality
interface PublisherApiResponse {
  publisher_id: string;
  publisher_name: string;
  coverage_level: string;
  priority: number;
  match_type: string;
}

// Normalized publisher for UI
interface Publisher {
  id: string;
  name: string;
  description: string | null;
  logo: string | null; // Base64 data URL
  website: string | null;
  priority: number;
  is_verified: boolean;
  coverage_level?: string;
  match_type?: string;
}

interface LocalityPublishersResponse {
  locality: Locality;
  publishers: Publisher[];
  has_coverage: boolean;
}

export default function LocalityPublishersPage() {
  const params = useParams();
  const router = useRouter();
  const api = useApi();
  const localityId = params.localityId as string;

  const [data, setData] = useState<LocalityPublishersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPublishers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const raw = await api.public.get<{ locality: Locality; publishers: PublisherApiResponse[]; has_coverage: boolean }>(`/localities/${localityId}/publishers`);

      // Map API response to normalized Publisher shape
      const normalizedPublishers: Publisher[] = (raw?.publishers || []).map((p: PublisherApiResponse) => ({
        id: p.publisher_id,
        name: p.publisher_name,
        description: null,
        logo: null,
        website: null,
        priority: p.priority,
        is_verified: false,
        coverage_level: p.coverage_level,
        match_type: p.match_type,
      }));

      setData({
        locality: raw?.locality as Locality,
        publishers: normalizedPublishers,
        has_coverage: raw?.has_coverage ?? normalizedPublishers.length > 0,
      });
    } catch (err) {
      console.error('Failed to load publishers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load publishers');
    } finally {
      setLoading(false);
    }
  }, [api, localityId]);

  useEffect(() => {
    if (localityId) {
      loadPublishers();
    }
  }, [localityId, loadPublishers]);

  const handlePublisherSelect = (publisher: Publisher) => {
    // Save selection and navigate to zmanim view
    localStorage.setItem('zmanim_selected_publisher', JSON.stringify(publisher));
    router.push(`/zmanim/${localityId}/${publisher.id}`);
  };

  const handleUseDefault = () => {
    // Navigate with no publisher (default calculation)
    router.push(`/zmanim/${localityId}/default`);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="alert-error p-6 text-center">
            <AlertCircle className="w-12 h-12 alert-error-icon mx-auto mb-4" />
            <h2 className="text-xl alert-error-title mb-2">Error</h2>
            <p className="alert-error-text mb-4">{error}</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to location selection
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const locality = data?.locality;
  const publishers = data?.publishers || [];
  const hasCoverage = data?.has_coverage || publishers.length > 0;

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-start mb-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Change location
                </Link>
              </TooltipTrigger>
              <TooltipContent>Return to location selection</TooltipContent>
            </Tooltip>
            <ModeToggle />
          </div>

          <div className="flex items-center gap-3">
            <MapPin className="w-8 h-8 text-primary" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">{locality?.name}</h1>
                {locality?.locality_type_name && (
                  <Badge variant="secondary" className="capitalize">
                    {locality.locality_type_name}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                {locality?.display_hierarchy || (
                  <>
                    {locality?.region_name && `${locality.region_name}, `}{locality?.country}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-foreground mb-6">
          {hasCoverage ? 'Select Publisher' : 'No Local Authority'}
        </h2>

        {/* No Coverage Warning */}
        {!hasCoverage && (
          <div className="mb-8 alert-warning p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 alert-warning-icon shrink-0 mt-1" />
              <div>
                <h3 className="text-lg alert-warning-title mb-2">
                  No Local Authority Covers This Area
                </h3>
                <p className="alert-warning-text mb-4">
                  There is no halachic authority registered for this location yet.
                  You can view default zmanim calculated using standard algorithms,
                  but these are not endorsed by a local rabbi.
                </p>
                <button
                  onClick={handleUseDefault}
                  className="btn-warning"
                >
                  View Default Zmanim
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Publisher List */}
        {publishers.length > 0 && (
          <div className="space-y-4">
            {publishers.map((publisher) => (
              <button
                key={publisher.id}
                onClick={() => handlePublisherSelect(publisher)}
                className="w-full flex items-center gap-4 p-6 bg-card border border-border rounded-lg hover:bg-muted hover:border-border transition-colors text-left"
              >
                {/* Logo */}
                <div className="relative w-16 h-16 bg-muted rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                  {publisher.logo ? (
                    <Image
                      src={publisher.logo}
                      alt={publisher.name}
                      fill
                      className="object-cover rounded-lg"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center rounded-lg">
                      <span className="text-lg font-bold text-primary-foreground tracking-tight">
                        {(publisher.name || 'P').split(/\s+/).slice(0, 3).map(w => w.charAt(0).toUpperCase()).join('')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-foreground truncate">
                      {publisher.name}
                    </h3>
                    {publisher.is_verified && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="px-2 py-0.5 text-xs bg-green-600 dark:text-green-400 text-foreground rounded cursor-help">
                            Verified
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>This publisher is verified and trusted</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {publisher.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {publisher.description}
                    </p>
                  )}
                  {/* Coverage info from API */}
                  {publisher.match_type && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {publisher.match_type === 'exact_locality' && 'Serves this locality directly'}
                      {publisher.match_type === 'region_match' && 'Regional coverage'}
                      {publisher.match_type === 'country_match' && 'National coverage'}
                    </p>
                  )}
                </div>

                {/* Arrow */}
                <ChevronRight className="w-6 h-6 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Alternative: Use Default */}
        {hasCoverage && (
          <div className="mt-8 pt-8 border-t border-border">
            <button
              onClick={handleUseDefault}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Or use default calculations without a specific publisher →
            </button>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
