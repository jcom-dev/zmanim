'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HighlightedFormula } from '@/components/shared/HighlightedFormula';
import {
  Wand2,
  Loader2,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Copy,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApi } from '@/lib/api-client';

interface AIFormulaGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: (formula: string, explanation: string) => void;
  currentFormula?: string;
}

interface GeneratedResult {
  formula: string;
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  suggestions?: string[];
}

const EXAMPLE_PROMPTS = [
  '72 minutes before sunrise according to the Magen Avraham',
  'Sunset plus 42 minutes for Rabbeinu Tam',
  'The midpoint between alos and sunrise',
  '3 proportional hours after sunrise using GRA method',
  'When the sun is 8.5 degrees below the horizon after sunset',
];

export function AIFormulaGenerator({
  open,
  onOpenChange,
  onAccept,
  currentFormula,
}: AIFormulaGeneratorProps) {
  const api = useApi();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error('Please describe what you want to calculate');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.post<{ data: GeneratedResult }>('/ai/generate-formula', {
        body: JSON.stringify({
          prompt: prompt.trim(),
          current_formula: currentFormula,
        }),
      });

      setResult(response.data);
    } catch (err) {
      console.error('Failed to generate formula:', err);
      setError('Failed to generate formula. Please try again or rephrase your request.');

      // Fallback: provide a helpful message
      toast.error('AI generation is not available yet. Try using the Guided Builder instead.');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, currentFormula, api]);

  const handleAccept = useCallback(() => {
    if (result) {
      onAccept(result.formula, result.explanation);
      onOpenChange(false);
      setPrompt('');
      setResult(null);
      toast.success('Formula applied!');
    }
  }, [result, onAccept, onOpenChange]);

  const handleCopyFormula = useCallback(() => {
    if (result) {
      navigator.clipboard.writeText(result.formula);
      toast.success('Formula copied to clipboard');
    }
  }, [result]);

  const handleReset = useCallback(() => {
    setPrompt('');
    setResult(null);
    setError(null);
  }, []);

  const handleExampleClick = useCallback((example: string) => {
    setPrompt(example);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[450px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            AI Formula Generator
          </SheetTitle>
          <SheetDescription>
            Describe the zman calculation you need in plain language, and AI will generate the DSL formula.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Input Section */}
          <div className="space-y-3">
            <Label htmlFor="ai-prompt">Describe your calculation</Label>
            <Textarea
              id="ai-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., 72 minutes before sunrise according to the Magen Avraham"
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Example Prompts */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Lightbulb className="h-3 w-3" />
              Example prompts
            </Label>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.slice(0, 3).map((example, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleExampleClick(example)}
                  className="inline-flex"
                >
                  <Badge
                    variant="outline"
                    className="cursor-pointer hover:bg-accent transition-colors text-xs"
                  >
                    {example.length > 40 ? example.substring(0, 40) + '...' : example}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate Formula
              </>
            )}
          </Button>

          {/* Error State */}
          {error && (
            <Card className="border-destructive/50 bg-destructive/10">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="text-sm text-destructive font-medium">Generation Failed</p>
                    <p className="text-xs text-muted-foreground mt-1">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Result Section */}
          {result && (
            <div className="space-y-4">
              <Card className="border-primary/50">
                <CardContent className="py-4 space-y-4">
                  {/* Confidence Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Generated Formula</span>
                    <Badge
                      variant={
                        result.confidence === 'high'
                          ? 'default'
                          : result.confidence === 'medium'
                          ? 'secondary'
                          : 'outline-solid'
                      }
                    >
                      {result.confidence} confidence
                    </Badge>
                  </div>

                  {/* Formula Display */}
                  <div className="relative">
                    <HighlightedFormula formula={result.formula} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={handleCopyFormula}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Explanation */}
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Explanation</span>
                    <p className="text-sm">{result.explanation}</p>
                  </div>

                  {/* Suggestions */}
                  {result.suggestions && result.suggestions.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">Suggestions</span>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {result.suggestions.map((suggestion, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-primary">•</span>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleReset} className="flex-1">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button onClick={handleAccept} className="flex-1">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Accept & Apply
                </Button>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground text-center">
            AI-generated formulas should be reviewed by someone familiar with halachic zmanim calculations.
          </p>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default AIFormulaGenerator;
