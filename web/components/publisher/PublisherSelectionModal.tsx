'use client';

import { Building2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface Publisher {
  id: string;
  name: string;
  status: string;
}

interface PublisherSelectionModalProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  publishers: Publisher[];
  onSelect: (publisher: Publisher) => void;
  /** When true, modal cannot be dismissed (no close button, no backdrop click) */
  required?: boolean;
}

export function PublisherSelectionModal({
  open,
  onOpenChange,
  publishers,
  onSelect,
  required = false,
}: PublisherSelectionModalProps) {
  const handleSelect = (publisher: Publisher) => {
    onSelect(publisher);
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'verified':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            {status}
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            {status}
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
            {status}
          </span>
        );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={required ? undefined : onOpenChange}
    >
      <DialogContent
        hideCloseButton={required}
        onPointerDownOutside={required ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={required ? (e) => e.preventDefault() : undefined}
        onInteractOutside={required ? (e) => e.preventDefault() : undefined}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Select Publisher
          </DialogTitle>
          <DialogDescription>
            {required
              ? 'Please select which publisher you want to manage.'
              : 'Choose a publisher to switch to.'}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-2">
          {publishers.map((publisher) => (
            <button
              key={publisher.id}
              onClick={() => handleSelect(publisher)}
              className="w-full flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-semibold">
                    {publisher.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-foreground">
                    {publisher.name}
                  </div>
                </div>
              </div>
              {getStatusBadge(publisher.status)}
            </button>
          ))}
        </div>

        {publishers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No publishers available.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
