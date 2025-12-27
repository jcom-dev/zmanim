'use client';

import { AuditEvent } from '@/lib/types/audit';
import { AuditEventCard } from './AuditEventCard';
import { Loader2, Clock } from 'lucide-react';

interface AuditEventListProps {
  events: AuditEvent[];
  loading: boolean;
  onSelectEvent: (event: AuditEvent) => void;
}

/**
 * Group events by date for timeline display
 */
function groupEventsByDate(events: AuditEvent[]): Map<string, AuditEvent[]> {
  const groups = new Map<string, AuditEvent[]>();

  events.forEach((event) => {
    const date = new Date(event.occurred_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let dateKey: string;

    if (date.toDateString() === today.toDateString()) {
      dateKey = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateKey = 'Yesterday';
    } else {
      dateKey = date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }

    const existing = groups.get(dateKey) || [];
    existing.push(event);
    groups.set(dateKey, existing);
  });

  return groups;
}

/**
 * Loading state component
 */
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <p className="mt-4 text-muted-foreground">Loading activity...</p>
    </div>
  );
}

/**
 * Empty state component
 */
function EmptyState() {
  return (
    <div className="bg-card rounded-lg border border-border p-12 text-center">
      <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
      <p className="text-muted-foreground">
        Your activity log will appear here once you start making changes.
      </p>
    </div>
  );
}

/**
 * Timeline-based list of audit events grouped by date
 */
export function AuditEventList({ events, loading, onSelectEvent }: AuditEventListProps) {
  if (loading) {
    return <LoadingState />;
  }

  if (events.length === 0) {
    return <EmptyState />;
  }

  const groupedEvents = groupEventsByDate(events);

  return (
    <div className="space-y-6">
      {Array.from(groupedEvents.entries()).map(([dateLabel, dateEvents]) => (
        <div key={dateLabel}>
          {/* Date header */}
          <h3 className="text-sm font-medium text-muted-foreground mb-3 pl-7">{dateLabel}</h3>

          {/* Events for this date */}
          <div className="space-y-2">
            {dateEvents.map((event, index) => (
              <AuditEventCard
                key={event.id}
                event={event}
                onClick={() => onSelectEvent(event)}
                showTimeline={index < dateEvents.length - 1}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default AuditEventList;
