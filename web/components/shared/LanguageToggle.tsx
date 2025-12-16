/**
 * @file LanguageToggle.tsx
 * @purpose Reusable EN/עב language toggle component
 * @pattern react-component
 * @dependencies PreferencesContext
 * @frequency high - used across multiple pages (algorithm, registry, primitives)
 * @compliance Story Task 2.2 - Language Toggle Component
 */

'use client';

import { usePreferences } from '@/lib/contexts/PreferencesContext';
import { cn } from '@/lib/utils';

export interface LanguageToggleProps {
  /** Current language (for controlled mode) */
  value?: 'en' | 'he';
  /** Callback when language changes */
  onChange?: (lang: 'en' | 'he') => void;
  /** Optional className for styling */
  className?: string;
}

/**
 * Language toggle component for switching between English and Hebrew display
 *
 * Controls:
 * - Date format (Gregorian vs Hebrew calendar)
 * - Zman names (English vs Hebrew)
 * - Zman descriptions
 * - Halachic notes
 *
 * Does NOT affect:
 * - Locality names (always English)
 */
export function LanguageToggle({ value, onChange, className }: LanguageToggleProps) {
  const { preferences, setLanguage } = usePreferences();

  // Use provided value or fall back to context
  const currentLanguage = value ?? preferences.language;

  const handleChange = (lang: 'en' | 'he') => {
    setLanguage(lang);  // Update global preference
    onChange?.(lang);   // Also call optional callback
  };

  return (
    <div className={cn("flex rounded-md border border-input overflow-hidden h-9", className)}>
      <button
        onClick={() => handleChange('en')}
        className={cn(
          "px-3 py-2 text-sm font-medium transition-colors",
          currentLanguage === 'en'
            ? "bg-primary text-primary-foreground"
            : "bg-background hover:bg-muted text-muted-foreground"
        )}
        aria-label="Switch to English"
        aria-pressed={currentLanguage === 'en'}
      >
        EN
      </button>
      <button
        onClick={() => handleChange('he')}
        className={cn(
          "px-3 py-2 text-sm font-medium font-hebrew transition-colors",
          currentLanguage === 'he'
            ? "bg-primary text-primary-foreground"
            : "bg-background hover:bg-muted text-muted-foreground"
        )}
        aria-label="Switch to Hebrew"
        aria-pressed={currentLanguage === 'he'}
      >
        עב
      </button>
    </div>
  );
}
