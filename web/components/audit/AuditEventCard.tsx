'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  AuditEvent,
  SEVERITY_STYLES,
  STATUS_STYLES,
  RESOURCE_TYPE_LABELS,
  EVENT_ACTION_LABELS,
} from '@/lib/types/audit';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  User,
  Code,
  MapPin,
  UserPlus,
  Settings,
  Key,
  Users,
  Shield,
  Bot,
  ChevronRight,
} from 'lucide-react';

interface AuditEventCardProps {
  event: AuditEvent;
  onClick: () => void;
  showTimeline?: boolean;
}

/**
 * Format a date string to relative time (e.g., "2 minutes ago")
 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

/**
 * Format a date string to absolute time for tooltip
 */
function formatAbsoluteTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Get the icon for a resource type
 */
function getResourceIcon(resourceType?: string): ReactNode {
  const iconMap: Record<string, ReactNode> = {
    publisher: <User className="w-4 h-4" />,
    publisher_zman: <Code className="w-4 h-4" />,
    coverage: <MapPin className="w-4 h-4" />,
    user: <UserPlus className="w-4 h-4" />,
    team: <Users className="w-4 h-4" />,
    algorithm: <Code className="w-4 h-4" />,
    api_key: <Key className="w-4 h-4" />,
    settings: <Settings className="w-4 h-4" />,
  };

  return iconMap[resourceType || ''] || <Settings className="w-4 h-4" />;
}

/**
 * Get a human-readable description of the event
 */
function getEventDescription(event: AuditEvent): string {
  const action = EVENT_ACTION_LABELS[event.event_action] || event.event_action;
  const resource = event.resource || {};
  const resourceType = RESOURCE_TYPE_LABELS[resource.type || ''] || resource.type || 'resource';
  const resourceName = resource.name ? ` "${resource.name}"` : '';

  return `${action} ${resourceType.toLowerCase()}${resourceName}`;
}

/**
 * Single event card in the audit log timeline
 */
export function AuditEventCard({ event, onClick, showTimeline = true }: AuditEventCardProps) {
  const severityStyle = (event.event_severity && SEVERITY_STYLES[event.event_severity]) || SEVERITY_STYLES.info;
  const statusStyle = STATUS_STYLES[event.status] || STATUS_STYLES.success;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'relative flex items-start gap-4 p-4 bg-card rounded-lg border border-border',
        'cursor-pointer transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
      )}
      aria-label={`View details for ${getEventDescription(event)}`}
    >
      {/* Timeline indicator */}
      {showTimeline && (
        <div className="relative flex-shrink-0">
          {/* Severity dot */}
          <div
            className={cn('w-3 h-3 rounded-full border-2 border-background', severityStyle.dot)}
            aria-hidden="true"
          />
          {/* Vertical line */}
          <div
            className="absolute left-1/2 top-4 -translate-x-1/2 w-px h-full bg-border"
            aria-hidden="true"
          />
        </div>
      )}

      {/* Icon */}
      <div className="flex-shrink-0 p-2 bg-secondary rounded-full text-muted-foreground">
        {getResourceIcon(event.resource?.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Event description */}
        <p className="font-medium text-foreground truncate">{getEventDescription(event)}</p>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
          {/* Timestamp */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">{formatRelativeTime(event.occurred_at)}</span>
            </TooltipTrigger>
            <TooltipContent>{formatAbsoluteTime(event.occurred_at)}</TooltipContent>
          </Tooltip>

          <span className="text-border">|</span>

          {/* Actor */}
          <span className="flex items-center gap-1">
            {event.actor?.is_system ? (
              <>
                <Bot className="w-3 h-3" />
                <span>System</span>
              </>
            ) : (
              <>
                <User className="w-3 h-3" />
                <span>{event.actor?.name || 'Unknown'}</span>
              </>
            )}
          </span>

          {/* Impersonation badge */}
          {event.actor?.impersonator && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="solid"
                  className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                >
                  <Shield className="w-3 h-3 mr-1" />
                  Acting as
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Admin {event.actor?.impersonator?.name} is acting as this user
              </TooltipContent>
            </Tooltip>
          )}

          {/* Status badge (only if not success) */}
          {event.status !== 'success' && (
            <Badge variant="solid" className={cn('border', statusStyle)}>
              {event.status}
            </Badge>
          )}
        </div>
      </div>

      {/* Chevron indicator */}
      <div className="flex-shrink-0 text-muted-foreground">
        <ChevronRight className="w-5 h-5" />
      </div>
    </div>
  );
}

export default AuditEventCard;
