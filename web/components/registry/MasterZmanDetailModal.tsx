'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { X, ChevronRight } from 'lucide-react';
import {
  MasterDocumentationContent,
  type MasterZmanDocumentationResponse,
} from './MasterDocumentationContent';

interface MasterZmanDetailModalProps {
  masterZmanId: string | null;
  isOpen: boolean;
  onClose: () => void;
  localityId?: number;
}

// Breadcrumb item for navigation history
interface BreadcrumbItem {
  id: string;
  name: string;
}

export function MasterZmanDetailModal({
  masterZmanId,
  isOpen,
  onClose,
  localityId,
}: MasterZmanDetailModalProps) {
  const api = useApi();
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Navigation breadcrumbs
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [currentZmanId, setCurrentZmanId] = useState<string | null>(null);

  // Track current zman ID
  useEffect(() => {
    if (isOpen && masterZmanId) {
      setCurrentZmanId(masterZmanId);
      setBreadcrumbs([]); // Reset breadcrumbs when opening fresh
    }
  }, [isOpen, masterZmanId]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [isOpen]);

  // Fetch documentation
  const { data, isLoading, error } = useQuery({
    queryKey: ['master-zman-documentation', currentZmanId],
    queryFn: async () => {
      if (!currentZmanId) return null;
      return api.get<MasterZmanDocumentationResponse>(
        `/publisher/registry/master/${currentZmanId}/documentation`
      );
    },
    enabled: isOpen && !!currentZmanId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const masterZman = data?.master_zman;
  const relatedZmanim = data?.related_zmanim || [];

  // Related zman navigation with cycle detection
  const handleRelatedClick = useCallback((relatedId: string, relatedName: string) => {
    // Check for cycle
    if (breadcrumbs.some((b) => b.id === relatedId)) {
      toast.warning("You've already viewed this zman in this session");
      return;
    }

    // Check depth limit
    if (breadcrumbs.length >= 5) {
      toast.warning('Maximum navigation depth reached');
      return;
    }

    // Add current zman to breadcrumbs before navigating
    if (masterZman) {
      setBreadcrumbs((prev) => [
        ...prev,
        { id: masterZman.id, name: masterZman.canonical_english_name },
      ]);
    }

    setCurrentZmanId(relatedId);
  }, [breadcrumbs, masterZman]);

  // Navigate back via breadcrumb
  const handleBreadcrumbClick = useCallback((index: number) => {
    const targetBreadcrumb = breadcrumbs[index];
    // Remove all breadcrumbs after the clicked one
    setBreadcrumbs((prev) => prev.slice(0, index));
    setCurrentZmanId(targetBreadcrumb.id);
  }, [breadcrumbs]);

  // Reset state when closing
  const handleClose = useCallback(() => {
    setBreadcrumbs([]);
    setCurrentZmanId(null);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="max-w-[800px] max-h-[90vh] p-0 gap-0"
        aria-labelledby="modal-title"
      >
        {/* Header - sticky */}
        <DialogHeader className="sticky top-0 z-10 bg-background border-b p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {isLoading ? (
                <div className="animate-pulse">
                  <div className="h-7 w-48 bg-muted rounded mb-2" />
                  <div className="h-5 w-32 bg-muted rounded" />
                </div>
              ) : masterZman ? (
                <>
                  <DialogTitle id="modal-title" className="text-xl font-semibold leading-tight">
                    <span className="font-hebrew">{masterZman.canonical_hebrew_name}</span>
                    <span className="text-muted-foreground mx-2">-</span>
                    <span>{masterZman.canonical_english_name}</span>
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground font-mono mt-1">
                    [@{masterZman.zman_key}]
                  </p>
                </>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label="Close documentation modal"
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Breadcrumb Trail */}
          {breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb navigation" className="mt-2 text-sm">
              <ol className="flex items-center gap-1 flex-wrap">
                {breadcrumbs.map((crumb, index) => (
                  <li key={crumb.id} className="flex items-center gap-1">
                    <button
                      onClick={() => handleBreadcrumbClick(index)}
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {crumb.name}
                    </button>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  </li>
                ))}
                <li className="font-medium">{masterZman?.canonical_english_name}</li>
              </ol>
            </nav>
          )}
        </DialogHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 max-h-[calc(90vh-120px)]">
          <div className="p-4 sm:p-6">
            {error ? (
              <div className="text-center py-8 text-destructive">
                <p>Failed to load documentation.</p>
                <p className="text-sm text-muted-foreground mt-1">Please try again later.</p>
              </div>
            ) : isLoading ? (
              <div className="space-y-6 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i}>
                    <div className="h-5 w-24 bg-muted rounded mb-2" />
                    <div className="h-16 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : masterZman ? (
              <MasterDocumentationContent
                masterZman={masterZman}
                relatedZmanim={relatedZmanim}
                onRelatedZmanClick={handleRelatedClick}
                localityId={localityId}
              />
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
