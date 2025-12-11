'use client';

import { AlertCircle, Lightbulb, ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState, useCallback } from 'react';
import type { HumanError } from '@/lib/error-humanizer';

interface HumanErrorDisplayProps {
  error: HumanError;
  onInsertExample?: (code: string) => void;
  onNavigateToReference?: (section: string) => void;
  className?: string;
}

export function HumanErrorDisplay({
  error,
  onInsertExample,
  onNavigateToReference,
  className,
}: HumanErrorDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyExample = useCallback(async () => {
    if (!error.exampleCode) return;
    try {
      await navigator.clipboard.writeText(error.exampleCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback - just insert
      onInsertExample?.(error.exampleCode);
    }
  }, [error.exampleCode, onInsertExample]);

  const handleInsertExample = useCallback(() => {
    if (error.exampleCode && onInsertExample) {
      onInsertExample(error.exampleCode);
    }
  }, [error.exampleCode, onInsertExample]);

  const handleNavigate = useCallback(() => {
    if (error.referenceLink && onNavigateToReference) {
      onNavigateToReference(error.referenceLink);
    }
  }, [error.referenceLink, onNavigateToReference]);

  return (
    <div
      className={cn(
        'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4',
        'animate-in fade-in-0 slide-in-from-top-2 duration-200',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          {/* Headline */}
          <h4 className="font-medium text-amber-900 dark:text-amber-100 text-sm leading-snug">
            {error.headline}
          </h4>

          {/* Explanation */}
          {error.explanation && (
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1.5 leading-relaxed">
              {error.explanation}
            </p>
          )}

          {/* Suggestion */}
          <div className="flex items-start gap-2 mt-3 text-sm text-amber-800 dark:text-amber-200">
            <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <span>{error.suggestion}</span>
          </div>

          {/* Example Code */}
          {error.exampleCode && (
            <div className="mt-3 bg-amber-100 dark:bg-amber-900/40 rounded-md p-3 relative group">
              <code className="text-sm font-mono text-amber-900 dark:text-amber-100 block pr-20">
                {error.exampleCode}
              </code>
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-amber-700 hover:text-amber-900 hover:bg-amber-200 dark:text-amber-300 dark:hover:text-amber-100 dark:hover:bg-amber-800"
                  onClick={handleCopyExample}
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {(error.exampleCode || error.referenceLink) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {error.exampleCode && onInsertExample && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleInsertExample}
                  className="h-8 text-xs bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200 hover:text-amber-900 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-800"
                >
                  Insert this example
                </Button>
              )}
              {error.referenceLink && onNavigateToReference && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleNavigate}
                  className="h-8 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300 dark:hover:text-amber-100 dark:hover:bg-amber-900/40"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Learn more
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HumanErrorDisplay;
