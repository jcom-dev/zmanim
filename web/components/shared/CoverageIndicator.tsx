/**
 * @file CoverageIndicator.tsx
 * @purpose Coverage areas popover indicator for regional publishers
 * @pattern react-component
 * @dependencies usePublisherCoverage, Popover, Button
 * @frequency high - used in PreviewToolbar on Algorithm and Registry pages
 * @compliance Story Task 2.4 - Coverage Indicator Component
 */

'use client';

import { usePublisherCoverage } from '@/lib/hooks/usePublisherCoverage';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ListTree, Globe2, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface CoverageIndicatorProps {
  /** Publisher ID to fetch coverage for */
  publisherId: number;
  /** Whether publisher has global coverage */
  isGlobal?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * Coverage indicator component showing publisher's coverage areas in a popover
 *
 * Shows:
 * - List of coverage areas with locality counts
 * - Total localities count
 * - Link to manage coverage page
 *
 * Hidden when:
 * - isGlobal = true (global publishers don't need coverage indicator)
 */
export function CoverageIndicator({ isGlobal, className }: CoverageIndicatorProps) {
  const router = useRouter();
  const { coverage, isLoading } = usePublisherCoverage();

  // Don't show for global publishers
  if (isGlobal) return null;

  // Extract coverage data from response
  // API returns: { data: { is_global, coverage, total, message }, meta }
  // Hook returns: coverage.data which is the PublisherCoverageListResponse
  const coverageData = coverage?.coverage || [];
  const totalLocalities = coverageData.reduce((sum, c) => sum + c.locality_count, 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn("h-9 w-9", className)}
          aria-label="Coverage areas"
        >
          <ListTree className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="space-y-3">
          <h4 className="font-semibold">Your Coverage Areas</h4>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : coverageData.length === 0 ? (
            <div className="text-sm text-muted-foreground">No coverage areas configured</div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {coverageData.map((c) => {
                // Determine the display name based on coverage level
                const displayName = c.locality_name || c.region_name || c.country_name || c.continent_name || 'Unknown';

                return (
                  <div key={c.id} className="flex items-start gap-2 text-sm">
                    <Globe2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="truncate">{displayName}</span>
                        <span className="text-muted-foreground whitespace-nowrap">
                          ({c.locality_count.toLocaleString()})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t pt-2 space-y-2">
            <div className="text-sm text-muted-foreground">
              Total: {totalLocalities.toLocaleString()} localities
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between"
              onClick={() => router.push('/publisher/coverage')}
            >
              Manage Coverage
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
