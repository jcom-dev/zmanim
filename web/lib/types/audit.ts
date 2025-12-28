/**
 * Audit Log Types
 *
 * Type definitions for the audit logging system.
 * Used by both admin and publisher audit log views.
 */

// =============================================================================
// Core Event Types
// =============================================================================

export type EventSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';
export type EventStatus = 'success' | 'failure' | 'partial' | 'error' | 'pending' | 'completed';
export type OperationType = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXECUTE' | 'GRANT' | 'REVOKE';

export interface AuditActor {
  user_id?: string;
  clerk_id?: string;
  name?: string;
  email?: string;
  ip_address?: string;
  is_system: boolean;
  impersonator?: {
    user_id: string;
    name: string;
  };
}

export interface AuditResource {
  type?: string;
  id?: string;
  name?: string;
}

export interface AuditChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  diff?: Record<string, { before: unknown; after: unknown }>;
}

export interface AuditEvent {
  id: string;
  event_type: string;
  event_category: string;
  event_action: string;
  event_severity?: EventSeverity;
  occurred_at: string;
  actor: AuditActor;
  publisher_id?: number;
  publisher_slug?: string;
  resource: AuditResource;
  operation_type: OperationType;
  changes?: AuditChanges;
  status: EventStatus;
  error_message?: string;
  duration_ms?: number;
  request_id: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Stats Types
// =============================================================================

export interface ActorStats {
  user_id: string;
  username: string;
  event_count: number;
}

export interface PublisherStats {
  publisher_id: number;
  publisher_name: string;
  event_count: number;
}

export interface AuditStats {
  total_events_24h: number;
  total_events_7d: number;
  events_by_category: Record<string, number>;
  events_by_action: Record<string, number>;
  events_by_status: Record<string, number>;
  events_by_day?: { date: string; count: number }[];
  top_actors: ActorStats[];
  top_publishers: PublisherStats[];
  recent_critical_events: AuditEvent[];
}

// =============================================================================
// Filter Types
// =============================================================================

export interface AuditFilters {
  event_action?: string;
  event_category?: string;
  resource_type?: string;
  status?: EventStatus;
  from?: string;
  to?: string;
  search?: string;
}

export interface AdminAuditFilters extends AuditFilters {
  publisher_id?: number;
  actor_id?: string;
  severity?: EventSeverity;
}

// =============================================================================
// Pagination Types
// =============================================================================

export interface AuditPagination {
  total: number;
  page_size: number;
  next_cursor?: string;
  prev_cursor?: string;
}

export interface AuditEventListResponse {
  events: AuditEvent[];
  pagination: AuditPagination;
}

// =============================================================================
// Export Types
// =============================================================================

export type ExportFormat = 'csv' | 'json';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ExportJob {
  id: string;
  status: ExportStatus;
  format: ExportFormat;
  requested_at: string;
  completed_at?: string;
  download_url?: string;
  expires_at?: string;
  entry_count?: number;
  file_size_bytes?: number;
  error_message?: string;
}

// =============================================================================
// Publisher Types (for admin filters)
// =============================================================================

export interface PublisherSummary {
  id: number;
  name: string;
  slug: string;
}

// =============================================================================
// UI Constants
// =============================================================================

// Date range presets for filtering
export interface DateRangePreset {
  label: string;
  value: string;
  getRange: () => { from: Date; to: Date };
}

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  {
    label: 'Last 24 hours',
    value: 'last_24h',
    getRange: () => ({
      from: new Date(Date.now() - 24 * 60 * 60 * 1000),
      to: new Date(),
    }),
  },
  {
    label: 'Last 7 days',
    value: 'last_7d',
    getRange: () => ({
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      to: new Date(),
    }),
  },
  {
    label: 'Last 30 days',
    value: 'last_30d',
    getRange: () => ({
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      to: new Date(),
    }),
  },
  {
    label: 'Last 90 days',
    value: 'last_90d',
    getRange: () => ({
      from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      to: new Date(),
    }),
  },
];

// Resource type labels for display
export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  publisher: 'Publisher',
  publisher_zman: 'Zman',
  coverage: 'Coverage',
  user: 'User',
  team: 'Team',
  algorithm: 'Algorithm',
  api_key: 'API Key',
};

// Event action labels for display
export const EVENT_ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  publish: 'Published',
  unpublish: 'Unpublished',
  restore: 'Restored',
  tag_update: 'Tags Updated',
  settings_update: 'Settings Updated',
  add_member: 'Member Added',
  remove_member: 'Member Removed',
  role_change: 'Role Changed',
  revoke: 'Revoked',
};

// Event category labels for display
export const EVENT_CATEGORY_LABELS: Record<string, string> = {
  auth: 'Authentication',
  publisher: 'Publisher',
  zman: 'Zman',
  algorithm: 'Algorithm',
  coverage: 'Coverage',
  user: 'User',
  team: 'Team',
  api_key: 'API Key',
  export: 'Export',
};

// Severity styles for UI display (using design tokens)
export const SEVERITY_STYLES: Record<EventSeverity, { dot: string; badge: string }> = {
  debug: {
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  info: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  warning: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  },
  error: {
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  },
  critical: {
    dot: 'bg-red-700',
    badge: 'bg-red-200 text-red-800 dark:bg-red-950 dark:text-red-200',
  },
};

// Status styles for UI display
export const STATUS_STYLES: Record<EventStatus, string> = {
  success: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  failure: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  error: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  pending: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
};
