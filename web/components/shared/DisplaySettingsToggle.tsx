/**
 * @file DisplaySettingsToggle.tsx
 * @purpose Toggle component for seconds display preference
 * @pattern react-component
 * @dependencies shadcn/ui (Switch, Label), PreferencesContext
 * @frequency critical - controls time display across the application
 * @compliance Story 8-34 - Seconds Display Toggle
 *
 * Note: Rounding mode is now a per-zman publisher setting, not a user preference.
 * Publishers set rounding mode on each zman via the ZmanCard component.
 */

'use client';

import { usePreferences } from '@/lib/contexts/PreferencesContext';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';

interface DisplaySettingsToggleProps {
  /**
   * Default value for showSeconds if no preference exists
   * - true: seconds ON by default (publisher pages)
   * - false: seconds OFF by default (anonymous pages)
   */
  defaultShowSeconds?: boolean;

  /**
   * Compact mode - show inline without card wrapper
   */
  compact?: boolean;
}

/**
 * Display settings toggle for showing/hiding seconds
 *
 * Note: Rounding mode has been moved to per-zman publisher settings.
 * When seconds are hidden, the time will be rounded according to
 * the rounding_mode set by the publisher for each individual zman.
 *
 * @example
 * // Publisher algorithm page (default seconds ON)
 * <DisplaySettingsToggle defaultShowSeconds={true} />
 *
 * @example
 * // Anonymous zmanim page (default seconds OFF)
 * <DisplaySettingsToggle defaultShowSeconds={false} />
 *
 * @example
 * // Compact inline mode
 * <DisplaySettingsToggle compact />
 */
export function DisplaySettingsToggle({
  defaultShowSeconds = false,
  compact = false,
}: DisplaySettingsToggleProps) {
  const { preferences, setShowSeconds } = usePreferences();

  // Use preference if set, otherwise use default
  const showSeconds = preferences.showSeconds ?? defaultShowSeconds;

  const handleToggleSeconds = (checked: boolean) => {
    setShowSeconds(checked);
  };

  const content = (
    <div className="flex items-center justify-between space-x-4">
      <Label htmlFor="show-seconds" className="text-sm font-medium cursor-pointer">
        Show Seconds
      </Label>
      <Switch
        id="show-seconds"
        checked={showSeconds}
        onCheckedChange={handleToggleSeconds}
      />
    </div>
  );

  // Return compact version or card-wrapped version
  if (compact) {
    return content;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {content}
      </CardContent>
    </Card>
  );
}
