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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HighlightedFormula } from '@/components/shared/HighlightedFormula';
import { toast } from 'sonner';
import { X, Copy, Check, Users, ChevronRight, Link as LinkIcon, ExternalLink } from 'lucide-react';
import {
  MasterDocumentationContent,
  type MasterZmanDocumentation,
  type RelatedZmanInfo,
} from './MasterDocumentationContent';

// Types for API response
interface PublisherZmanDocumentationData {
  id: string;
  zman_key: string;
  hebrew_name: string;
  english_name: string;
  description?: string;
  formula_dsl: string;
  halachic_notes?: string;
  publisher_id: string;
  publisher_name: string;
  is_verified: boolean;
  master_zman_id?: string;
  master_hebrew_name?: string;
  master_english_name?: string;
  master_zman_key?: string;
  linked_publisher_name?: string;
  copied_from_publisher_name?: string;
  created_at: string;
  updated_at: string;
}

interface PublisherZmanDocumentationResponse {
  publisher_zman: PublisherZmanDocumentationData;
  master_zman?: MasterZmanDocumentation;
  related_zmanim: RelatedZmanInfo[];
}

interface PublisherZmanDetailModalProps {
  publisherZmanId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToMasterZman?: (masterZmanId: string) => void;
}

// Breadcrumb item for navigation history
interface BreadcrumbItem {
  id: string;
  name: string;
  type: 'publisher' | 'master';
}

export function PublisherZmanDetailModal({
  publisherZmanId,
  isOpen,
  onClose,
  onNavigateToMasterZman,
}: PublisherZmanDetailModalProps) {
  const api = useApi();
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Copy to clipboard state
  const [copiedState, setCopiedState] = useState(false);

  // Navigation breadcrumbs
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [currentZmanId, setCurrentZmanId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'publisher' | 'master'>('publisher');

  // Track current zman ID
  useEffect(() => {
    if (isOpen && publisherZmanId) {
      setCurrentZmanId(publisherZmanId);
      setBreadcrumbs([]);
      setViewMode('publisher');
    }
  }, [isOpen, publisherZmanId]);

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
    queryKey: ['publisher-zman-documentation', currentZmanId],
    queryFn: async () => {
      if (!currentZmanId) return null;
      return api.get<PublisherZmanDocumentationResponse>(
        `/publisher/registry/publisher-zman/${currentZmanId}/documentation`
      );
    },
    enabled: isOpen && !!currentZmanId && viewMode === 'publisher',
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const publisherZman = data?.publisher_zman;
  const masterZman = data?.master_zman;
  const relatedZmanim = data?.related_zmanim || [];

  // Copy publisher formula to clipboard
  const handleCopy = useCallback(async () => {
    if (!publisherZman?.formula_dsl) return;
    try {
      await navigator.clipboard.writeText(publisherZman.formula_dsl);
      setCopiedState(true);
      setTimeout(() => setCopiedState(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, [publisherZman?.formula_dsl]);

  // Navigate to a related zman (switches to master view)
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

    // Add current to breadcrumbs
    if (publisherZman) {
      setBreadcrumbs((prev) => [
        ...prev,
        { id: currentZmanId!, name: publisherZman.english_name, type: viewMode },
      ]);
    }

    // Navigate to master zman modal via callback
    if (onNavigateToMasterZman) {
      onNavigateToMasterZman(relatedId);
    }
  }, [breadcrumbs, publisherZman, currentZmanId, viewMode, onNavigateToMasterZman]);

  // Navigate back via breadcrumb
  const handleBreadcrumbClick = useCallback((index: number) => {
    const targetBreadcrumb = breadcrumbs[index];
    // Remove all breadcrumbs after the clicked one
    setBreadcrumbs((prev) => prev.slice(0, index));
    setCurrentZmanId(targetBreadcrumb.id);
    setViewMode(targetBreadcrumb.type);
  }, [breadcrumbs]);

  // Reset state when closing
  const handleClose = useCallback(() => {
    setBreadcrumbs([]);
    setCurrentZmanId(null);
    setCopiedState(false);
    setViewMode('publisher');
    onClose();
  }, [onClose]);

  // Get attribution text
  const getAttribution = () => {
    if (publisherZman?.linked_publisher_name) {
      return { type: 'linked', text: `Linked from ${publisherZman.linked_publisher_name}` };
    }
    if (publisherZman?.copied_from_publisher_name) {
      return { type: 'copied', text: `Copied from ${publisherZman.copied_from_publisher_name}` };
    }
    return null;
  };

  const attribution = getAttribution();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="max-w-[800px] max-h-[90vh] p-0 gap-0 sm:max-w-[90vw] md:max-w-[800px]"
        aria-labelledby="publisher-modal-title"
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
              ) : publisherZman ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle id="publisher-modal-title" className="text-xl font-semibold leading-tight">
                      <span className="font-hebrew">{publisherZman.hebrew_name}</span>
                      <span className="text-muted-foreground mx-2">-</span>
                      <span>{publisherZman.english_name}</span>
                    </DialogTitle>
                    <Badge variant="outline" className="gap-1 shrink-0">
                      <Users className="h-3 w-3" />
                      {publisherZman.publisher_name}
                    </Badge>
                    {publisherZman.is_verified && (
                      <Badge variant="secondary" className="shrink-0">Validated</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground font-mono mt-1">
                    [@{publisherZman.zman_key}]
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
                <li className="font-medium">{publisherZman?.english_name}</li>
              </ol>
            </nav>
          )}
        </DialogHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 max-h-[calc(90vh-120px)]">
          <div className="p-4 sm:p-6 space-y-6">
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
            ) : publisherZman ? (
              <>
                {/* ================================================ */}
                {/* PUBLISHER-SPECIFIC SECTION (Top) */}
                {/* ================================================ */}

                {/* Attribution */}
                {attribution && (
                  <div className="flex items-center gap-2 text-sm">
                    {attribution.type === 'linked' ? (
                      <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground">{attribution.text}</span>
                  </div>
                )}

                {/* Master Zman Reference */}
                {publisherZman.master_zman_id && publisherZman.master_english_name && (
                  <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg p-3">
                    <span className="text-muted-foreground">Based on:</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-foreground"
                      onClick={() => onNavigateToMasterZman?.(publisherZman.master_zman_id!)}
                    >
                      <span className="font-hebrew mr-1">{publisherZman.master_hebrew_name}</span>
                      <span>- {publisherZman.master_english_name}</span>
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                )}

                {/* Publisher DSL Formula */}
                <section aria-labelledby="publisher-formula-heading">
                  <h2 id="publisher-formula-heading" className="text-lg font-semibold mb-2">
                    Publisher Formula
                  </h2>
                  <div className="relative">
                    <div className="bg-muted rounded-lg p-3 font-mono text-sm overflow-x-auto">
                      <HighlightedFormula formula={publisherZman.formula_dsl || ''} />
                    </div>
                    <Button
                      onClick={handleCopy}
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      aria-label="Copy formula to clipboard"
                    >
                      {copiedState ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </section>

                {/* Publisher Description */}
                {publisherZman.description && (
                  <section aria-labelledby="publisher-description-heading">
                    <h2 id="publisher-description-heading" className="text-lg font-semibold mb-2">
                      Publisher Notes
                    </h2>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {publisherZman.description}
                    </p>
                  </section>
                )}

                {/* Custom Halachic Notes (if any) */}
                {publisherZman.halachic_notes && (
                  <section aria-labelledby="custom-notes-heading">
                    <h2 id="custom-notes-heading" className="text-lg font-semibold mb-2">
                      Custom Halachic Notes
                    </h2>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {publisherZman.halachic_notes}
                    </p>
                  </section>
                )}

                {/* ================================================ */}
                {/* DIVIDER */}
                {/* ================================================ */}
                {masterZman && (
                  <>
                    <div className="relative py-4">
                      <hr className="border-t border-border" />
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-4 text-sm text-muted-foreground">
                        Master Zman Documentation
                      </span>
                    </div>

                    {/* ================================================ */}
                    {/* MASTER DOCUMENTATION SECTION (Bottom) */}
                    {/* ================================================ */}
                    <MasterDocumentationContent
                      masterZman={masterZman}
                      relatedZmanim={relatedZmanim}
                      onRelatedZmanClick={handleRelatedClick}
                      showFormula={true}
                      showCopyButton={false}
                    />
                  </>
                )}
              </>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
