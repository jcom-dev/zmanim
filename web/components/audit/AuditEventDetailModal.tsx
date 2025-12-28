'use client';

import { cn } from '@/lib/utils';
import {
  AuditEvent,
  SEVERITY_STYLES,
  STATUS_STYLES,
  RESOURCE_TYPE_LABELS,
  EVENT_ACTION_LABELS,
} from '@/lib/types/audit';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AuditDiff } from './AuditDiff';
import {
  User,
  Bot,
  Shield,
  Clock,
  Copy,
  Check,
  MapPin,
} from 'lucide-react';
import { useState } from 'react';

interface AuditEventDetailModalProps {
  event: AuditEvent | null;
  onClose: () => void;
}

/**
 * Format a date string for display
 */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Get a human-readable event title
 */
function getEventTitle(event: AuditEvent): string {
  const action = EVENT_ACTION_LABELS[event.event_action] || event.event_action;
  const resource = event.resource || {};
  const resourceType = RESOURCE_TYPE_LABELS[resource.type || ''] || resource.type || 'Resource';
  return `${resourceType} ${action}`;
}

/**
 * Modal showing full details of an audit event
 */
export function AuditEventDetailModal({ event, onClose }: AuditEventDetailModalProps) {
  const [copiedId, setCopiedId] = useState(false);

  if (!event) {
    return null;
  }

  const severityStyle = (event.event_severity && SEVERITY_STYLES[event.event_severity]) || SEVERITY_STYLES.info;
  const statusStyle = STATUS_STYLES[event.status] || STATUS_STYLES.success;

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(event.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = event.id;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  return (
    <Dialog open={!!event} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {/* Severity dot */}
            <div
              className={cn('w-3 h-3 rounded-full', severityStyle.dot)}
              aria-hidden="true"
            />
            {getEventTitle(event)}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {formatDateTime(event.occurred_at)}
            {event.duration_ms && (
              <span className="text-muted-foreground">
                ({event.duration_ms}ms)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4 overflow-y-auto max-h-[calc(90vh-8rem)] pr-2">
          {/* Status and Event ID */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="solid" className={cn('border', statusStyle)}>
              {event.status}
            </Badge>
            {event.event_severity && (
              <Badge variant="solid" className={cn('border', severityStyle.badge)}>
                {event.event_severity}
              </Badge>
            )}
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyId}
              className="text-xs text-muted-foreground"
            >
              {copiedId ? (
                <Check className="w-3 h-3 mr-1" />
              ) : (
                <Copy className="w-3 h-3 mr-1" />
              )}
              {event.id.slice(0, 12)}...
            </Button>
          </div>

          {/* Error message if any */}
          {event.error_message && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400">
                {event.error_message}
              </p>
            </div>
          )}

          {/* Actor section */}
          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Actor</h3>
            <div className="p-3 bg-secondary/50 rounded-lg">
              <div className="flex items-center gap-3">
                {event.actor?.is_system ? (
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                ) : (
                  <div className="p-2 bg-primary/10 rounded-full">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div>
                  <p className="font-medium">
                    {event.actor?.is_system ? 'System' : event.actor?.name || 'Unknown User'}
                  </p>
                  {event.actor?.email && (
                    <p className="text-sm text-muted-foreground">{event.actor.email}</p>
                  )}
                </div>
              </div>

              {/* Impersonation info */}
              {event.actor?.impersonator && (
                <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-500" />
                  <span className="text-sm text-amber-600 dark:text-amber-400">
                    Admin <strong>{event.actor.impersonator.name}</strong> acting as this user
                  </span>
                </div>
              )}

              {/* IP Address */}
              {event.actor?.ip_address && (
                <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground font-mono">
                    {event.actor.ip_address}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Resource section */}
          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Resource</h3>
            <div className="p-3 bg-secondary/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {RESOURCE_TYPE_LABELS[event.resource?.type || ''] || event.resource?.type || 'Unknown'}
                  </p>
                  {event.resource?.name && (
                    <p className="text-sm text-muted-foreground">{event.resource.name}</p>
                  )}
                </div>
                {event.resource?.id && (
                  <Badge variant="outline" className="font-mono text-xs">
                    ID: {event.resource.id}
                  </Badge>
                )}
              </div>
            </div>
          </section>

          {/* Changes section */}
          {event.changes && (
            <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Changes</h3>
              <div className="border rounded-lg overflow-hidden">
                <AuditDiff changes={event.changes} />
              </div>
            </section>
          )}

          {/* Metadata section */}
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Additional Details</h3>
              <div className="p-3 bg-secondary/50 rounded-lg">
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              </div>
            </section>
          )}

          {/* Request ID */}
          {event.request_id && (
            <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Request Correlation</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-muted-foreground">
                  {event.request_id}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(event.request_id)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AuditEventDetailModal;
