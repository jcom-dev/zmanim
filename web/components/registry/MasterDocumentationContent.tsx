'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { HighlightedFormula } from '@/components/shared/HighlightedFormula';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types - exported for reuse
export interface RelatedZmanInfo {
  id: string;
  zman_key: string;
  canonical_hebrew_name: string;
  canonical_english_name: string;
  transliteration: string;
}

export interface MasterZmanDocumentation {
  id: string;
  zman_key: string;
  canonical_hebrew_name: string;
  canonical_english_name: string;
  transliteration: string;
  description: string;
  default_formula_dsl: string;
  halachic_notes?: string;
  halachic_source?: string;
  full_description?: string;
  formula_explanation?: string;
  usage_context?: string;
  related_zmanim_ids?: number[];
  shita?: string;
  category?: string;
  is_core: boolean;
  time_category?: string;
  created_at: string;
  updated_at: string;
}

export interface MasterZmanDocumentationResponse {
  master_zman: MasterZmanDocumentation;
  related_zmanim: RelatedZmanInfo[];
}

// Parse halachic source into structured data
export function parseHalachicSource(source: string | undefined): { posek: string; text: string }[] {
  if (!source) return [];

  const lines = source.split('\n').filter((line) => line.trim());

  if (lines.length <= 1 || !source.includes(':')) {
    return [{ posek: 'Source', text: source }];
  }

  return lines.map((line) => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0 && colonIndex < 50) {
      return {
        posek: line.substring(0, colonIndex).trim(),
        text: line.substring(colonIndex + 1).trim(),
      };
    }
    return { posek: 'Source', text: line.trim() };
  }).filter((item) => item.text);
}

interface MasterDocumentationContentProps {
  masterZman: MasterZmanDocumentation;
  relatedZmanim?: RelatedZmanInfo[];
  onRelatedZmanClick?: (masterZmanId: string, masterZmanName: string) => void;
  showFormula?: boolean;
  showCopyButton?: boolean;
  className?: string;
  localityId?: number;
}

export function MasterDocumentationContent({
  masterZman,
  relatedZmanim = [],
  onRelatedZmanClick,
  showFormula = true,
  showCopyButton = true,
  className,
}: MasterDocumentationContentProps) {
  const [copiedState, setCopiedState] = useState(false);

  const parsedHalachicSources = parseHalachicSource(masterZman.halachic_source);

  const handleCopy = useCallback(async () => {
    if (!masterZman.default_formula_dsl) return;
    try {
      await navigator.clipboard.writeText(masterZman.default_formula_dsl);
      setCopiedState(true);
      setTimeout(() => setCopiedState(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, [masterZman.default_formula_dsl]);

  return (
    <div className={className ? `space-y-6 ${className}` : 'space-y-6'}>
      {/* Category and Shita badges */}
      <div className="flex gap-2 flex-wrap">
        {masterZman.category && (
          <Badge variant="outline">{masterZman.category}</Badge>
        )}
        {masterZman.shita && (
          <Badge variant="secondary">{masterZman.shita}</Badge>
        )}
        {masterZman.is_core && (
          <Badge>Core</Badge>
        )}
      </div>

      {/* Summary Section */}
      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="text-lg font-semibold mb-2">
          Summary
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          {masterZman.full_description || masterZman.description || 'No description available.'}
        </p>
      </section>

      {/* DSL Formula Section */}
      {showFormula && (
        <section aria-labelledby="formula-heading">
          <h2 id="formula-heading" className="text-lg font-semibold mb-2">
            DSL Formula
          </h2>
          <div className="relative">
            <div className="bg-muted rounded-lg p-3 font-mono text-sm overflow-x-auto">
              <HighlightedFormula formula={masterZman.default_formula_dsl || ''} />
            </div>
            {showCopyButton && (
              <Button
                onClick={handleCopy}
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
                aria-label="Copy DSL formula to clipboard"
              >
                {copiedState ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            )}
          </div>
        </section>
      )}

      {/* Scientific Explanation Section */}
      {masterZman.formula_explanation && (
        <section aria-labelledby="scientific-heading">
          <h2 id="scientific-heading" className="text-lg font-semibold mb-2">
            Scientific Explanation
          </h2>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {masterZman.formula_explanation}
          </p>
        </section>
      )}

      {/* Halachic Significance Section */}
      <section aria-labelledby="halachic-significance-heading">
        <h2 id="halachic-significance-heading" className="text-lg font-semibold mb-2">
          Halachic Significance
        </h2>
        <p className={cn(
          "leading-relaxed whitespace-pre-wrap",
          !masterZman.usage_context && "italic text-muted-foreground"
        )}>
          {masterZman.usage_context || 'No additional information available.'}
        </p>
      </section>

      {/* Halachic Sources Section (expandable) */}
      {parsedHalachicSources.length > 0 && (
        <section aria-labelledby="halachic-sources-heading">
          <h2 id="halachic-sources-heading" className="text-lg font-semibold mb-2">
            Halachic Sources
          </h2>
          <Accordion type="multiple" className="w-full">
            {parsedHalachicSources.map((source, index) => (
              <AccordionItem key={index} value={`source-${index}`}>
                <AccordionTrigger className="text-left">
                  {source.posek}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {source.text}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      {/* Halachic Notes Section (if different from sources) */}
      {masterZman.halachic_notes && masterZman.halachic_notes !== masterZman.halachic_source && (
        <section aria-labelledby="halachic-notes-heading">
          <h2 id="halachic-notes-heading" className="text-lg font-semibold mb-2">
            Halachic Notes
          </h2>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {masterZman.halachic_notes}
          </p>
        </section>
      )}

      {/* Related Zmanim Section */}
      <section aria-labelledby="related-zmanim-heading">
        <h2 id="related-zmanim-heading" className="text-lg font-semibold mb-2">
          Related Zmanim
        </h2>
        {relatedZmanim.length > 0 ? (
          <nav aria-label="Related zmanim" className="flex flex-wrap gap-2">
            {relatedZmanim.map((related) => (
              <Button
                key={related.id}
                variant="outline"
                size="sm"
                onClick={() => onRelatedZmanClick?.(related.id, related.canonical_english_name)}
                aria-label={`View documentation for ${related.canonical_english_name}`}
                disabled={!onRelatedZmanClick}
              >
                <span className="font-hebrew mr-1">{related.canonical_hebrew_name}</span>
                <span className="text-muted-foreground">-</span>
                <span className="ml-1">{related.canonical_english_name}</span>
              </Button>
            ))}
          </nav>
        ) : (
          <p className="italic text-muted-foreground">No related zmanim available.</p>
        )}
      </section>
    </div>
  );
}
