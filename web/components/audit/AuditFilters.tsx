'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AuditFilters as AuditFiltersType,
  DATE_RANGE_PRESETS,
  RESOURCE_TYPE_LABELS,
  EVENT_ACTION_LABELS,
} from '@/lib/types/audit';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar, X, Filter } from 'lucide-react';

interface AuditFiltersProps {
  filters: AuditFiltersType;
  onChange: (filters: AuditFiltersType) => void;
}

/**
 * Format date for display
 */
function formatDateRange(from?: string, to?: string): string {
  if (!from && !to) return 'All time';

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  if (fromDate && toDate) {
    const fromStr = fromDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const toStr = toDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fromStr} - ${toStr}`;
  }

  if (fromDate) {
    return `From ${fromDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }

  if (toDate) {
    return `Until ${toDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }

  return 'All time';
}

/**
 * Check if any filters are active
 */
function hasActiveFilters(filters: AuditFiltersType): boolean {
  return !!(filters.resource_type || filters.event_type || filters.from || filters.to);
}

/**
 * Get active filter badges
 */
function getActiveFilterBadges(filters: AuditFiltersType): { key: string; label: string }[] {
  const badges: { key: string; label: string }[] = [];

  if (filters.resource_type) {
    badges.push({
      key: 'resource_type',
      label: RESOURCE_TYPE_LABELS[filters.resource_type] || filters.resource_type,
    });
  }

  if (filters.event_type) {
    const action = filters.event_type.split('.')[1];
    badges.push({
      key: 'event_type',
      label: EVENT_ACTION_LABELS[action] || filters.event_type,
    });
  }

  if (filters.from || filters.to) {
    badges.push({
      key: 'date_range',
      label: formatDateRange(filters.from, filters.to),
    });
  }

  return badges;
}

/**
 * Filters component for audit logs
 */
export function AuditFilters({ filters, onChange }: AuditFiltersProps) {
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const handleResourceTypeChange = (value: string) => {
    onChange({
      ...filters,
      resource_type: value === 'all' ? undefined : value,
    });
  };

  const handleEventActionChange = (value: string) => {
    onChange({
      ...filters,
      event_type: value === 'all' ? undefined : value,
    });
  };

  const handleDatePresetClick = (preset: (typeof DATE_RANGE_PRESETS)[0]) => {
    const range = preset.getRange();
    onChange({
      ...filters,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    });
    setDatePopoverOpen(false);
  };

  const handleClearDateRange = () => {
    onChange({
      ...filters,
      from: undefined,
      to: undefined,
    });
  };

  const handleRemoveFilter = (key: string) => {
    const newFilters = { ...filters };
    if (key === 'resource_type') {
      newFilters.resource_type = undefined;
    } else if (key === 'event_type') {
      newFilters.event_type = undefined;
    } else if (key === 'date_range') {
      newFilters.from = undefined;
      newFilters.to = undefined;
    }
    onChange(newFilters);
  };

  const handleClearAll = () => {
    onChange({});
  };

  const activeBadges = getActiveFilterBadges(filters);
  const hasFilters = hasActiveFilters(filters);

  return (
    <div className="space-y-4">
      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />
          <span>Filters:</span>
        </div>

        {/* Resource Type dropdown */}
        <Select
          value={filters.resource_type || 'all'}
          onValueChange={handleResourceTypeChange}
        >
          <SelectTrigger className="w-[140px]" aria-label="Filter by resource type">
            <SelectValue placeholder="Resource Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resources</SelectItem>
            {Object.entries(RESOURCE_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Event Action dropdown */}
        <Select
          value={filters.event_type || 'all'}
          onValueChange={handleEventActionChange}
        >
          <SelectTrigger className="w-[140px]" aria-label="Filter by action">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {Object.entries(EVENT_ACTION_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Range */}
        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'justify-start text-left font-normal',
                !filters.from && !filters.to && 'text-muted-foreground'
              )}
              aria-label="Select date range"
            >
              <Calendar className="mr-2 h-4 w-4" />
              {formatDateRange(filters.from, filters.to)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3 space-y-1">
              <p className="text-sm font-medium mb-2">Date Range</p>
              {DATE_RANGE_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => handleDatePresetClick(preset)}
                >
                  {preset.label}
                </Button>
              ))}
              {(filters.from || filters.to) && (
                <>
                  <div className="my-2 border-t border-border" />
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground"
                    onClick={handleClearDateRange}
                  >
                    Clear date range
                  </Button>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active filter badges */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active:</span>
          {activeBadges.map((badge) => (
            <Badge
              key={badge.key}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {badge.label}
              <button
                onClick={() => handleRemoveFilter(badge.key)}
                className="ml-1 p-0.5 rounded-full hover:bg-destructive/20 transition-colors"
                aria-label={`Remove ${badge.label} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-muted-foreground"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}

export default AuditFilters;
