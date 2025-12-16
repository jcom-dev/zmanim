'use client';

import { CheckCircle2, XCircle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface FormulaPreviewProps {
  formula: string;
  isValid: boolean;
  errors: string[];
  className?: string;
}

// Simple syntax highlighting for DSL formulas
function highlightFormula(formula: string): React.ReactNode {
  // Keywords
  const keywords = ['solar', 'proportional_hours', 'midpoint', 'gra', 'mga', 'custom', 'before_visible_sunrise', 'after_visible_sunset', 'before_noon', 'after_noon'];
  // Primitives
  const primitives = ['sunrise', 'sunset', 'solar_noon', 'midnight', 'alos_hashachar', 'tzeis_hakochavim'];

  // Simple tokenization
  const tokens = formula.split(/(\s+|[(),@+-])/g).filter(Boolean);

  return tokens.map((token, i) => {
    const lowerToken = token.toLowerCase();

    if (keywords.includes(lowerToken)) {
      return (
        <span key={i} className="text-blue-400">
          {token}
        </span>
      );
    }
    if (primitives.includes(lowerToken)) {
      return (
        <span key={i} className="text-green-400">
          {token}
        </span>
      );
    }
    if (/^\d+(\.\d+)?$/.test(token)) {
      return (
        <span key={i} className="text-amber-400">
          {token}
        </span>
      );
    }
    if (/^\d+min$/.test(token) || /^\d+h(r)?$/.test(token)) {
      return (
        <span key={i} className="text-purple-400">
          {token}
        </span>
      );
    }
    if (token === '@') {
      return (
        <span key={i} className="text-pink-400">
          {token}
        </span>
      );
    }
    return <span key={i}>{token}</span>;
  });
}

export function FormulaPreview({
  formula,
  isValid,
  errors,
  className,
}: FormulaPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formula);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold flex items-center gap-2">
          Generated Formula
          {isValid ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
        </label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-8 px-3"
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copied ? 'Copied!' : 'Copy formula'}</TooltipContent>
        </Tooltip>
      </div>

      <div
        className={cn(
          'font-mono text-sm p-4 rounded-xl border-2',
          isValid
            ? 'bg-card border-primary/20'
            : 'bg-destructive/10 border-destructive'
        )}
      >
        <code className="text-base">{highlightFormula(formula)}</code>
      </div>

      {errors.length > 0 && (
        <ul className="text-sm text-destructive space-y-1">
          {errors.map((error, i) => (
            <li key={i} className="flex items-start gap-2">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default FormulaPreview;
