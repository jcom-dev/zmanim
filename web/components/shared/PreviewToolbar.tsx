/**
 * @file PreviewToolbar.tsx
 * @purpose Main preview toolbar component that composes LocalityPicker, DatePicker, CoverageIndicator, and LanguageToggle
 * @pattern react-component
 * @dependencies usePreviewToolbar, LocalityPicker, PreviewDatePicker, CoverageIndicator, LanguageToggle
 * @frequency high - used on Algorithm and Registry pages
 * @compliance Story 11 Task 2.5 - Preview Toolbar Main Component
 */

'use client';

import { useState } from 'react';
import { usePreviewToolbar } from '@/lib/hooks/usePreviewToolbar';
import { LocalityPicker } from '@/components/shared/LocalityPicker';
import { PreviewDatePicker } from '@/components/shared/PreviewDatePicker';
import { CoverageIndicator } from '@/components/shared/CoverageIndicator';
import { LanguageToggle } from '@/components/shared/LanguageToggle';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LocalitySelection } from '@/types/geography';

// =============================================================================
// Types
// =============================================================================

export interface PreviewToolbarProps {
  /** Unique storage key for this page's preview state */
  storageKey: string;

  /** Restrict locality search to publisher's coverage areas */
  restrictToCoverage?: boolean;

  /** Publisher ID (required if restrictToCoverage is true) */
  publisherId?: number;

  /** Whether publisher has global coverage (disables restriction) */
  isGlobalPublisher?: boolean;

  /** Show coverage indicator button (auto-enabled if restrictToCoverage) */
  showCoverageIndicator?: boolean;

  /** Show the date picker section */
  showDatePicker?: boolean;

  /** Show the language toggle */
  showLanguageToggle?: boolean;

  /** Callback when locality changes */
  onLocalityChange?: (localityId: number | null, name: string | null) => void;

  /** Callback when date changes */
  onDateChange?: (date: string) => void;

  /** Callback when language changes */
  onLanguageChange?: (lang: 'en' | 'he') => void;

  /** Controlled mode: external locality ID */
  localityId?: number | null;

  /** Controlled mode: external locality name */
  localityName?: string | null;

  /** Controlled mode: external date */
  date?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * PreviewToolbar - Unified toolbar for locality, date, and language selection
 *
 * Visual Layout:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ 📍 [Jerusalem, Israel ▾] [📋]  📅 [Dec 22, 2025 ◀▶]  🌐 [EN|עב]        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *      ↑ Locality Picker    ↑ Coverage    ↑ Date Picker      ↑ Language
 *
 * Features:
 * - Locality selection with optional coverage restriction
 * - Coverage indicator popover for regional publishers
 * - Language-aware date picker (Gregorian/Hebrew)
 * - Language toggle (EN/עב)
 * - Per-page state persistence via cookies
 * - Cross-tab synchronization
 * - Responsive layout (stacks on mobile)
 */
export function PreviewToolbar({
  storageKey,
  restrictToCoverage = false,
  publisherId,
  isGlobalPublisher = false,
  showCoverageIndicator,
  showDatePicker = true,
  showLanguageToggle = true,
  onLocalityChange,
  onDateChange,
  onLanguageChange,
  // Controlled mode
  localityId: controlledLocalityId,
  localityName: controlledLocalityName,
  date: controlledDate,
}: PreviewToolbarProps) {
  const [localityPickerOpen, setLocalityPickerOpen] = useState(false);

  // Use hook for state management
  const toolbar = usePreviewToolbar({
    storageKey,
    restrictToCoverage,
    publisherId,
    isGlobalPublisher,
  });

  // Support both controlled and uncontrolled modes
  const localityId = controlledLocalityId ?? toolbar.localityId;
  const localityName = controlledLocalityName ?? toolbar.localityName;
  const date = controlledDate ?? toolbar.date;
  const { language, setLanguage } = toolbar;

  // Determine if coverage indicator should show
  const shouldShowCoverageIndicator =
    showCoverageIndicator ?? (restrictToCoverage && !isGlobalPublisher);

  // Handle locality selection
  const handleLocalitySelect = (selection: LocalitySelection | LocalitySelection[]) => {
    // Only handle single selection (mode="single")
    if (Array.isArray(selection)) return;

    const id = parseInt(selection.id, 10);
    const name = selection.description || selection.name;
    toolbar.setLocality(id, name);
    onLocalityChange?.(id, name);
    setLocalityPickerOpen(false);
  };

  // Handle date change
  const handleDateChange = (newDate: string) => {
    toolbar.setDate(newDate);
    onDateChange?.(newDate);
  };

  // Handle language change
  const handleLanguageChange = (lang: 'en' | 'he') => {
    setLanguage(lang);
    onLanguageChange?.(lang);
  };

  return (
    <Card className="overflow-visible">
      <CardContent className="py-3 px-4 overflow-visible">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          {/* Left: Location + Coverage Indicator */}
          <div className="flex items-center gap-2">
            {/* Locality Picker */}
            <Popover open={localityPickerOpen} onOpenChange={setLocalityPickerOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background hover:bg-muted/50 transition-colors text-left">
                  <MapPin className={cn('h-4 w-4 shrink-0', !localityId && 'text-amber-500')} />
                  <span
                    className={cn(
                      'text-sm font-medium truncate max-w-[180px]',
                      !localityId && 'text-amber-600 dark:text-amber-400'
                    )}
                  >
                    {localityId ? localityName || 'Selected Location' : 'Select Location'}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-96 p-0" sideOffset={4}>
                <div className="p-3 border-b border-border">
                  <h4 className="text-sm font-medium">Select Preview Location</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {restrictToCoverage && !isGlobalPublisher
                      ? 'Search localities within your coverage areas'
                      : 'Search all localities'}
                  </p>
                </div>
                <div className="p-3">
                  <LocalityPicker
                    mode="single"
                    placeholder="Search localities..."
                    types={['locality', 'town', 'village', 'hamlet', 'neighborhood', 'borough']}
                    publisherId={
                      restrictToCoverage && !isGlobalPublisher && publisherId
                        ? String(publisherId)
                        : undefined
                    }
                    autoFocus
                    inlineResults
                    onSelect={handleLocalitySelect}
                  />
                </div>
              </PopoverContent>
            </Popover>

            {/* Coverage Indicator */}
            {shouldShowCoverageIndicator && publisherId && (
              <CoverageIndicator publisherId={publisherId} isGlobal={isGlobalPublisher} />
            )}
          </div>

          {/* Right: Date Picker + Language Toggle */}
          <div className="flex items-center gap-2">
            {showLanguageToggle && (
              <LanguageToggle value={language} onChange={handleLanguageChange} />
            )}

            {showDatePicker && (
              <PreviewDatePicker value={date} onChange={handleDateChange} language={language} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
