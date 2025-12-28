'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Search, X, Filter, CalendarDays } from 'lucide-react';
import type { AdminAuditFilters as AdminAuditFiltersType, PublisherSummary, EventSeverity } from '@/lib/types/audit';
import { DATE_RANGE_PRESETS } from '@/lib/types/audit';

interface AdminAuditFiltersProps {
  filters: AdminAuditFiltersType;
  onChange: (filters: AdminAuditFiltersType) => void;
  publishers?: PublisherSummary[];
  isLoading?: boolean;
}

// Event categories and their actions
const EVENT_CATEGORIES = [
  { value: 'auth', label: 'Authentication' },
  { value: 'publisher', label: 'Publisher' },
  { value: 'zman', label: 'Zman' },
  { value: 'algorithm', label: 'Algorithm' },
  { value: 'coverage', label: 'Coverage' },
  { value: 'user', label: 'User' },
  { value: 'team', label: 'Team' },
  { value: 'api_key', label: 'API Key' },
  { value: 'export', label: 'Export' },
];

// Resource types
const RESOURCE_TYPES = [
  { value: 'publisher', label: 'Publisher' },
  { value: 'publisher_zman', label: 'Zman' },
  { value: 'coverage', label: 'Coverage' },
  { value: 'user', label: 'User' },
  { value: 'team', label: 'Team' },
  { value: 'algorithm', label: 'Algorithm' },
  { value: 'api_key', label: 'API Key' },
];

// Severity levels
const SEVERITY_LEVELS: { value: EventSeverity; label: string }[] = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'critical', label: 'Critical' },
];

// Status options
const STATUS_OPTIONS = [
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
  { value: 'error', label: 'Error' },
];

export function AdminAuditFilters({
  filters,
  onChange,
  publishers = [],
  isLoading,
}: AdminAuditFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const [dateRangeLabel, setDateRangeLabel] = useState<string>('');

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
    // Simple debounce - in production would use a debounce hook
    const timeout = setTimeout(() => {
      onChange({ ...filters, search: value || undefined });
    }, 300);
    return () => clearTimeout(timeout);
  }, [filters, onChange]);

  const handleCategoryChange = (value: string) => {
    onChange({ ...filters, event_category: value && value !== 'all' ? value : undefined });
  };

  const handleResourceTypeChange = (value: string) => {
    onChange({ ...filters, resource_type: value && value !== 'all' ? value : undefined });
  };

  const handleSeverityChange = (value: string) => {
    onChange({ ...filters, severity: value && value !== 'all' ? (value as EventSeverity) : undefined });
  };

  const handleStatusChange = (value: string) => {
    onChange({ ...filters, status: value && value !== 'all' ? value as AdminAuditFiltersType['status'] : undefined });
  };

  const handlePublisherChange = (value: string) => {
    onChange({ ...filters, publisher_id: value && value !== 'all' ? parseInt(value, 10) : undefined });
  };

  const handleDatePreset = (preset: typeof DATE_RANGE_PRESETS[number]) => {
    const range = preset.getRange();
    setDateRangeLabel(preset.label);
    onChange({
      ...filters,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    });
  };

  const handleClearDateRange = () => {
    setDateRangeLabel('');
    onChange({ ...filters, from: undefined, to: undefined });
  };

  const clearAllFilters = () => {
    setSearchValue('');
    setDateRangeLabel('');
    onChange({});
  };

  const removeFilter = (key: keyof AdminAuditFiltersType) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    if (key === 'from' || key === 'to') {
      delete newFilters.from;
      delete newFilters.to;
      setDateRangeLabel('');
    }
    if (key === 'search') {
      setSearchValue('');
    }
    onChange(newFilters);
  };

  // Count active filters
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'from' || key === 'to') return false; // Count date range as one
    return value !== undefined && value !== '';
  }).length + (filters.from || filters.to ? 1 : 0);

  return (
    <div className="space-y-4 mb-6">
      {/* Search and Date Range Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search events, actors, resources..."
            className="pl-10"
            disabled={isLoading}
          />
        </div>

        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
              <CalendarDays className="mr-2 h-4 w-4" />
              {dateRangeLabel || 'Select date range'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="end">
            <div className="space-y-1">
              {DATE_RANGE_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  variant="ghost"
                  className="w-full justify-start font-normal"
                  onClick={() => handleDatePreset(preset)}
                >
                  {preset.label}
                </Button>
              ))}
              {dateRangeLabel && (
                <>
                  <div className="border-t my-2" />
                  <Button
                    variant="ghost"
                    className="w-full justify-start font-normal text-muted-foreground"
                    onClick={handleClearDateRange}
                  >
                    Clear date filter
                  </Button>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Filter Dropdowns Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Publisher Filter (Admin Only) */}
        <Select
          value={filters.publisher_id?.toString() || 'all'}
          onValueChange={handlePublisherChange}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Publishers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Publishers</SelectItem>
            {publishers.map((publisher) => (
              <SelectItem key={publisher.id} value={publisher.id.toString()}>
                {publisher.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category Filter */}
        <Select
          value={filters.event_category || 'all'}
          onValueChange={handleCategoryChange}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {EVENT_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Resource Type Filter */}
        <Select
          value={filters.resource_type || 'all'}
          onValueChange={handleResourceTypeChange}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Resources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resources</SelectItem>
            {RESOURCE_TYPES.map((rt) => (
              <SelectItem key={rt.value} value={rt.value}>
                {rt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Severity Filter */}
        <Select
          value={filters.severity || 'all'}
          onValueChange={handleSeverityChange}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            {SEVERITY_LEVELS.map((sev) => (
              <SelectItem key={sev.value} value={sev.value}>
                {sev.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={filters.status || 'all'}
          onValueChange={handleStatusChange}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active Filters */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Active filters:</span>

          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Search: &quot;{filters.search}&quot;
              <button
                onClick={() => removeFilter('search')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {(filters.from || filters.to) && dateRangeLabel && (
            <Badge variant="secondary" className="gap-1">
              {dateRangeLabel}
              <button
                onClick={() => removeFilter('from')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.publisher_id && (
            <Badge variant="secondary" className="gap-1">
              Publisher: {publishers.find((p) => p.id === filters.publisher_id)?.name || filters.publisher_id}
              <button
                onClick={() => removeFilter('publisher_id')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.event_category && (
            <Badge variant="secondary" className="gap-1">
              Category: {EVENT_CATEGORIES.find((c) => c.value === filters.event_category)?.label}
              <button
                onClick={() => removeFilter('event_category')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.resource_type && (
            <Badge variant="secondary" className="gap-1">
              Resource: {RESOURCE_TYPES.find((r) => r.value === filters.resource_type)?.label}
              <button
                onClick={() => removeFilter('resource_type')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.severity && (
            <Badge variant="secondary" className="gap-1">
              Severity: {SEVERITY_LEVELS.find((s) => s.value === filters.severity)?.label}
              <button
                onClick={() => removeFilter('severity')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              Status: {STATUS_OPTIONS.find((s) => s.value === filters.status)?.label}
              <button
                onClick={() => removeFilter('status')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
}
