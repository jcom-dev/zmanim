'use client';

import { usePublisherContext } from '@/providers/PublisherContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function PublisherSwitcher() {
  const { publishers, selectedPublisherId, setSelectedPublisherId, selectedPublisher, isLoading, isImpersonating } = usePublisherContext();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="publisher-switcher-loading">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>Loading...</span>
      </div>
    );
  }

  // When impersonating, show only the impersonated publisher (no dropdown)
  if (isImpersonating && selectedPublisher) {
    return (
      <div className="flex items-center gap-2" data-testid="publisher-switcher-impersonating">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-primary font-semibold text-sm">
            {selectedPublisher.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-sm text-foreground">{selectedPublisher.name}</span>
        </div>
      </div>
    );
  }

  // Don't show switcher for single publisher or no publishers
  if (publishers.length <= 1) {
    if (selectedPublisher) {
      return (
        <div className="flex items-center gap-2" data-testid="publisher-switcher-single">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-semibold text-sm">
              {selectedPublisher.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-sm text-foreground">{selectedPublisher.name}</span>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="flex items-center gap-2" data-testid="publisher-switcher">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <span className="text-primary font-semibold text-sm">
          {selectedPublisher?.name.charAt(0).toUpperCase() || '?'}
        </span>
      </div>
      <Select
        value={selectedPublisherId || ''}
        onValueChange={setSelectedPublisherId}
      >
        <SelectTrigger className="min-w-[200px] text-sm font-medium" data-testid="publisher-switcher-trigger">
          <SelectValue placeholder="Select publisher" />
        </SelectTrigger>
        <SelectContent>
          {publishers.map((publisher) => (
            <SelectItem key={publisher.id} value={publisher.id}>
              {publisher.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
