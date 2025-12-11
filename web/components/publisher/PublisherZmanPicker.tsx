/**
 * @file PublisherZmanPicker.tsx
 * @purpose Publisher zman search - link/copy workflow
 * @pattern client-component
 * @dependencies useApi, Command (shadcn), publisher filtering
 * @frequency medium - 389 lines
 * @compliance Check docs/adr/ for pattern rationale
 */

'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useVerifiedPublishers,
  usePublisherZmanimForLinking,
  useCreateZmanFromPublisher,
  VerifiedPublisher,
  PublisherZmanForLinking,
} from '@/lib/hooks/useZmanimList';
import {
  Search,
  Plus,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Copy,
  Link2,
  Building2,
  AlertCircle,
} from 'lucide-react';

interface PublisherZmanPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'copy' | 'link';
  existingZmanKeys: string[];
  onSuccess?: () => void;
}

/**
 * PublisherZmanPicker - Browse and add zmanim from other publishers
 *
 * Two modes:
 * - Copy: Creates a snapshot copy of the formula (independent after creation)
 * - Link: Creates a live reference that always uses the source's latest formula
 *
 * Link mode is only available from verified publishers.
 */
export function PublisherZmanPicker({
  open,
  onOpenChange,
  mode,
  existingZmanKeys,
  onSuccess,
}: PublisherZmanPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPublisher, setSelectedPublisher] = useState<VerifiedPublisher | null>(null);
  const [selectedZman, setSelectedZman] = useState<PublisherZmanForLinking | null>(null);
  const [step, setStep] = useState<'publishers' | 'zmanim' | 'confirm'>('publishers');

  // Fetch verified publishers (for link mode, only verified; for copy mode, could be all public)
  const { data: publishers, isLoading: loadingPublishers } = useVerifiedPublishers();

  // Fetch zmanim from selected publisher
  const { data: publisherZmanim, isLoading: loadingZmanim } = usePublisherZmanimForLinking(
    selectedPublisher?.id || null
  );

  const createZman = useCreateZmanFromPublisher();

  // Filter publishers by search
  const filteredPublishers = useMemo(() => {
    if (!publishers) return [];
    if (!searchQuery) return publishers;

    const query = searchQuery.toLowerCase();
    return publishers.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.display_name.toLowerCase().includes(query)
    );
  }, [publishers, searchQuery]);

  // Filter zmanim by search and exclude existing
  const filteredZmanim = useMemo(() => {
    if (!publisherZmanim) return [];

    const query = searchQuery.toLowerCase();
    return publisherZmanim.filter((z) => {
      // Exclude already-added zmanim
      if (existingZmanKeys.includes(z.zman_key)) return false;

      // Apply search filter
      if (query) {
        return (
          z.hebrew_name.toLowerCase().includes(query) ||
          z.english_name.toLowerCase().includes(query) ||
          z.zman_key.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [publisherZmanim, searchQuery, existingZmanKeys]);

  const handleSelectPublisher = (publisher: VerifiedPublisher) => {
    setSelectedPublisher(publisher);
    setSearchQuery('');
    setStep('zmanim');
  };

  const handleSelectZman = (zman: PublisherZmanForLinking) => {
    setSelectedZman(zman);
    setStep('confirm');
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setSelectedZman(null);
      setStep('zmanim');
    } else if (step === 'zmanim') {
      setSelectedPublisher(null);
      setSearchQuery('');
      setStep('publishers');
    }
  };

  const handleAddZman = async () => {
    if (!selectedZman) return;

    try {
      await createZman.mutateAsync({
        source_publisher_zman_id: selectedZman.id,
        mode,
      });

      // Reset and close
      handleClose();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to add zman:', error);
    }
  };

  const handleClose = () => {
    setStep('publishers');
    setSelectedPublisher(null);
    setSelectedZman(null);
    setSearchQuery('');
    onOpenChange(false);
  };

  const isLink = mode === 'link';
  const ModeIcon = isLink ? Link2 : Copy;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ModeIcon className={`h-5 w-5 ${isLink ? 'text-green-600' : 'text-amber-600'}`} />
            {step === 'publishers' && (isLink ? 'Link to Publisher' : 'Copy from Publisher')}
            {step === 'zmanim' && `Select Zman from ${selectedPublisher?.display_name}`}
            {step === 'confirm' && 'Confirm'}
          </DialogTitle>
          <DialogDescription>
            {step === 'publishers' && (
              isLink
                ? 'Select a verified publisher to link to. Linked zmanim always use the source\'s latest formula.'
                : 'Select a publisher to copy from. You\'ll get a snapshot of their formula.'
            )}
            {step === 'zmanim' && 'Select a zman to add to your algorithm'}
            {step === 'confirm' && (
              isLink
                ? `This zman will always use ${selectedPublisher?.display_name}'s formula`
                : `A copy of this formula will be added to your algorithm`
            )}
          </DialogDescription>
        </DialogHeader>

        {step === 'publishers' && (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search publishers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Publishers List */}
            <ScrollArea className="flex-1 min-h-0 h-[400px]">
              {loadingPublishers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPublishers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  {searchQuery ? (
                    <p>No matching publishers found</p>
                  ) : isLink ? (
                    <div className="space-y-2">
                      <p>No verified publishers available</p>
                      <p className="text-xs">Only verified publishers can be linked to</p>
                    </div>
                  ) : (
                    <p>No publishers available</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {filteredPublishers.map((publisher) => (
                    <button
                      key={publisher.id}
                      onClick={() => handleSelectPublisher(publisher)}
                      className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{publisher.display_name}</div>
                            {publisher.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {publisher.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {publisher.zmanim_count} zmanim
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        )}

        {step === 'zmanim' && (
          <>
            {/* Back button and Search */}
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search zmanim..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Zmanim List */}
            <ScrollArea className="flex-1 min-h-0 h-[400px]">
              {loadingZmanim ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredZmanim.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? (
                    <p>No matching zmanim found</p>
                  ) : (
                    <p>All available zmanim have been added</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {filteredZmanim.map((zman) => (
                    <button
                      key={zman.id}
                      onClick={() => handleSelectZman(zman)}
                      className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {zman.hebrew_name}
                            <span className="text-muted-foreground mx-2">•</span>
                            {zman.english_name}
                          </div>
                          <code className="text-xs text-muted-foreground mt-1 block font-mono">
                            {zman.formula_dsl}
                          </code>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        )}

        {step === 'confirm' && selectedZman && selectedPublisher && (
          <div className="space-y-4">
            {/* Zman Details */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-lg font-semibold">
                {selectedZman.hebrew_name}
                <span className="text-muted-foreground mx-2">•</span>
                {selectedZman.english_name}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                From: {selectedPublisher.display_name}
              </p>
            </div>

            {/* Formula Preview */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Formula</label>
              <div className="p-3 bg-card border rounded-lg">
                <code className="text-sm font-mono">{selectedZman.formula_dsl}</code>
              </div>
            </div>

            {/* Mode Explanation */}
            <div className={`p-3 rounded-lg border ${isLink ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'}`}>
              <div className="flex items-start gap-2">
                <ModeIcon className={`h-4 w-4 mt-0.5 ${isLink ? 'text-green-600' : 'text-amber-600'}`} />
                <div className="text-sm">
                  {isLink ? (
                    <>
                      <p className="font-medium text-green-800 dark:text-green-200">Live Link</p>
                      <p className="text-green-700 dark:text-green-300 mt-0.5">
                        This zman will always use {selectedPublisher.display_name}&apos;s current formula.
                        When they update it, your zman updates automatically.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-amber-800 dark:text-amber-200">Snapshot Copy</p>
                      <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                        A copy of this formula will be added to your algorithm.
                        You can modify it independently.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {isLink && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <AlertCircle className="h-4 w-4 mt-0.5 text-blue-600" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  If the source zman is deleted, your linked zman will show a warning but continue to work with the last known formula.
                </p>
              </div>
            )}

            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleAddZman} disabled={createZman.isPending}>
                {createZman.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                {isLink ? 'Link Zman' : 'Copy Zman'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
