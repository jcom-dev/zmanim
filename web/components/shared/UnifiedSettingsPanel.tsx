/**
 * @file UnifiedSettingsPanel.tsx
 * @purpose Unified dropdown panel for all display preferences (language, time display, filters)
 * @pattern react-component
 * @dependencies shadcn/ui (DropdownMenu, Switch, ToggleGroup), lucide-react, PreferencesContext
 * @frequency critical - unified settings across all views
 * @compliance Story 8-36 - Extended Display Preferences with Cookie Persistence
 */

'use client';

import {
  usePreferences,
  Language,
  DEFAULT_FILTERS,
} from '@/lib/contexts/PreferencesContext';
import { DisplaySettingsToggle } from './DisplaySettingsToggle';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, RotateCcw, Globe, Filter, Clock } from 'lucide-react';

interface UnifiedSettingsPanelProps {
  /** Show publisher-only settings (e.g., showDisabled) */
  showPublisherSettings?: boolean;
  /** Which sections to show */
  sections?: ('language' | 'display' | 'filters')[];
}

/**
 * Unified settings panel dropdown
 *
 * @example
 * // Publisher pages (show all sections + publisher settings)
 * <UnifiedSettingsPanel showPublisherSettings />
 *
 * @example
 * // Public pages (show language + display only)
 * <UnifiedSettingsPanel sections={['language', 'display']} />
 */
export function UnifiedSettingsPanel({
  showPublisherSettings = false,
  sections = ['language', 'display', 'filters'],
}: UnifiedSettingsPanelProps) {
  const { preferences, setLanguage, updateFilter, resetToDefaults } = usePreferences();

  const hasLanguageSection = sections.includes('language');
  const hasDisplaySection = sections.includes('display');
  const hasFiltersSection = sections.includes('filters');

  // Check if any settings differ from defaults
  const hasCustomSettings =
    preferences.showSeconds !== null ||
    preferences.roundingMode !== 'math' ||
    preferences.language !== 'en' ||
    JSON.stringify(preferences.filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Display settings">
          <Settings className="h-5 w-5" />
          {hasCustomSettings && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Display Settings
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Language Section */}
        {hasLanguageSection && (
          <>
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Language</Label>
              </div>
              <ToggleGroup
                type="single"
                value={preferences.language}
                onValueChange={(v: string) => v && setLanguage(v as Language)}
                className="justify-start"
              >
                <ToggleGroupItem value="en" size="sm">
                  English
                </ToggleGroupItem>
                <ToggleGroupItem value="he" size="sm" className="font-hebrew">
                  עברית
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Display Section (Seconds & Rounding) */}
        {hasDisplaySection && (
          <>
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Time Display</Label>
              </div>
              <DisplaySettingsToggle compact />
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Filters Section */}
        {hasFiltersSection && (
          <>
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Show</Label>
              </div>
              <div className="space-y-3">
                {/* Optional Zmanim */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-optional" className="text-sm cursor-pointer">
                    Optional Zmanim
                  </Label>
                  <Switch
                    id="show-optional"
                    checked={preferences.filters.showOptional}
                    onCheckedChange={(v) => updateFilter('showOptional', v)}
                  />
                </div>

                {/* Disabled Zmanim (Publisher only) */}
                {showPublisherSettings && (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-disabled" className="text-sm text-muted-foreground cursor-pointer">
                      Disabled Zmanim
                    </Label>
                    <Switch
                      id="show-disabled"
                      checked={preferences.filters.showDisabled}
                      onCheckedChange={(v) => updateFilter('showDisabled', v)}
                    />
                  </div>
                )}
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Reset */}
        <DropdownMenuItem
          onClick={resetToDefaults}
          disabled={!hasCustomSettings}
          className="text-muted-foreground cursor-pointer"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
