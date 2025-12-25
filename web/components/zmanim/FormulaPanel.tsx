'use client';

import { useEffect, useState } from 'react';
import { Clock, Calculator, BookOpen, Info, FlaskConical, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
// Note: This component is used on public zmanim pages without PublisherContext,
// so we use a standalone function instead of useTagDisplayName hook

export interface ZmanFormula {
  method: string;
  display_name: string;
  dsl?: string;
  parameters: Record<string, unknown>;
  explanation: string;
  halachic_source?: string;
}

export interface ZmanTag {
  name: string;
  display_name_english: string; // Deprecated: use display_name_english_ashkenazi
  display_name_english_ashkenazi?: string;
  display_name_english_sephardi?: string | null;
  display_name_hebrew: string;
  tag_type: string;
  color?: string;
  is_negated?: boolean; // When true, zman should NOT appear on days matching this tag
}

export interface Zman {
  name: string;
  hebrew_name?: string;
  key: string;
  time: string; // HH:mm:ss exact time with seconds
  time_rounded?: string; // HH:mm:ss rounded per rounding_mode (with :00)
  time_display?: string; // HH:mm rounded for display (no seconds)
  formula: ZmanFormula;
  is_beta?: boolean;
  is_core?: boolean;
  time_category?: string;
  rounding_mode?: 'floor' | 'math' | 'ceil'; // Story 8-34: per-zman rounding mode
  tags?: ZmanTag[];
}

interface FormulaPanelProps {
  zman: Zman | null;
  open: boolean;
  onClose: () => void;
}

// Format parameter values for display
const formatParameter = (key: string, value: unknown): string => {
  if (key === 'degrees' && typeof value === 'number') {
    return `${value}° below horizon`;
  }
  if (key === 'minutes' && typeof value === 'number') {
    return `${value} minutes`;
  }
  if (key === 'hours' && typeof value === 'number') {
    return `${value} hours`;
  }
  if (key === 'base') {
    return value === 'gra' ? 'GRA (Vilna Gaon)' : value === 'mga' ? 'MGA (Magen Avraham)' : String(value);
  }
  if (key === 'from') {
    return `from ${value}`;
  }
  return `${key}: ${value}`;
};

// Custom hook for media query
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

// Standalone function to get tag display name without requiring PublisherContext
// The backend already resolves the correct transliteration based on publisher settings,
// so we prefer display_name_english (which is pre-resolved) over the ashkenazi fallback
function getTagDisplayName(tag: {
  display_name_english_ashkenazi?: string;
  display_name_english_sephardi?: string | null;
  display_name_english?: string;
}): string {
  // Prefer backend-resolved display_name_english, then fall back to ashkenazi
  return tag.display_name_english || tag.display_name_english_ashkenazi || '';
}

export function FormulaPanel({ zman, open, onClose }: FormulaPanelProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (!zman) return null;

  const { formula } = zman;
  const parameters = formula?.parameters || {};
  const hasParameters = Object.keys(parameters).length > 0;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className={isDesktop ? 'w-[400px] sm:max-w-[400px]' : 'h-[70vh] max-h-[70vh] rounded-t-2xl'}
      >
        {/* Mobile drag handle */}
        {!isDesktop && (
          <div className="flex justify-center pb-4 -mt-2">
            <div className="w-12 h-1.5 bg-muted rounded-full" />
          </div>
        )}

        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-xl">{zman.name}</SheetTitle>
              <SheetDescription className="text-lg font-semibold text-primary">
                {zman.time}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6 overflow-y-auto">
          {/* Beta Warning Section */}
          {zman.is_beta && (
            <section className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-800/30 rounded-lg shrink-0 mt-0.5">
                  <FlaskConical className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
                    Beta Calculation
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                    This zman is currently in beta. The publisher is seeking feedback and may refine this calculation before certifying it as stable.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Tags Section */}
          {zman.tags && zman.tags.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Tags
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {zman.tags.map((tag) => (
                  <span
                    key={tag.name}
                    className={cn(
                      'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border',
                      // Negated tags: red border
                      tag.is_negated && 'border-2 border-red-500 dark:border-red-400'
                    )}
                    style={{
                      backgroundColor: tag.color ? `${tag.color}15` : undefined,
                      borderColor: tag.is_negated ? undefined : (tag.color || 'var(--border)'),
                      color: tag.color || 'var(--foreground)',
                    }}
                  >
                    {tag.is_negated && <X className="w-3 h-3 mr-1 text-red-500 shrink-0" />}
                    <span className={cn(tag.is_negated && 'line-through decoration-red-500')}>
                      {getTagDisplayName(tag)}
                    </span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Method Section */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Calculation Method
              </h3>
            </div>
            <div className="bg-card rounded-lg p-4">
              <p className="text-foreground font-medium">
                {formula?.display_name || formula?.method || 'Standard calculation'}
              </p>
            </div>
          </section>

          {/* DSL Formula Section */}
          {formula?.dsl && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Formula (DSL)
                </h3>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <code className="text-foreground">{formula.dsl}</code>
              </div>
            </section>
          )}

          {/* Parameters Section */}
          {hasParameters && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Parameters
                </h3>
              </div>
              <div className="bg-card rounded-lg p-4">
                <ul className="space-y-2">
                  {Object.entries(parameters).map(([key, value]) => (
                    <li key={key} className="flex items-center gap-2 text-muted-foreground">
                      <span className="w-2 h-2 bg-primary rounded-full" />
                      {formatParameter(key, value)}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Explanation Section */}
          {formula?.explanation && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Explanation
                </h3>
              </div>
              <div className="bg-card rounded-lg p-4">
                <p className="text-muted-foreground leading-relaxed">
                  {formula.explanation}
                </p>
              </div>
            </section>
          )}

          {/* Halachic Source Section */}
          {formula?.halachic_source && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                  Halachic Source
                </h3>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg p-4">
                <p className="text-amber-800 dark:text-amber-200 leading-relaxed">
                  {formula.halachic_source}
                </p>
              </div>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
