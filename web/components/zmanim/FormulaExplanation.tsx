import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/api-client';

interface FormulaExplanationProps {
  formula: string;
  language?: 'en' | 'he';
  customExplanation?: string;
  className?: string;
}

interface ExplainResult {
  explanation: string;
  source: 'ai' | 'cached' | 'custom';
  language: string;
}

export function FormulaExplanation({
  formula,
  language = 'en',
  customExplanation,
  className = '',
}: FormulaExplanationProps) {
  const api = useApi();
  const [explanation, setExplanation] = useState<ExplainResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // If custom explanation is provided, use it directly
  useEffect(() => {
    if (customExplanation) {
      setExplanation({
        explanation: customExplanation,
        source: 'custom',
        language,
      });
    }
  }, [customExplanation, language]);

  const fetchExplanation = async () => {
    if (customExplanation) return;
    if (!formula) return;

    setLoading(true);
    setError(null);

    try {
      const data = await api.public.post<ExplainResult>('/ai/explain-formula', {
        body: JSON.stringify({ formula, language }),
      });
      setExplanation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when shown
  useEffect(() => {
    if (showExplanation && !explanation && !loading) {
      fetchExplanation();
    }
  }, [showExplanation]);

  const isRTL = language === 'he';
  const title = isRTL ? 'איך זה מחושב' : 'How It\'s Calculated';
  const buttonText = isRTL ? 'הסבר' : 'Explain';
  const loadingText = isRTL ? 'טוען...' : 'Loading...';
  const retryText = isRTL ? 'נסה שוב' : 'Retry';

  if (!showExplanation) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowExplanation(true)}
        className={className}
      >
        <LightbulbIcon className="h-4 w-4 mr-1" />
        {buttonText}
      </Button>
    );
  }

  return (
    <div className={`rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4 ${className}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <LightbulbIcon className="h-4 w-4 text-amber-600" />
          {title}
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowExplanation(false)}
          className="h-6 w-6 p-0"
        >
          <XIcon className="h-4 w-4" />
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderIcon className="h-4 w-4 animate-spin" />
          {loadingText}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600">
          <p>{error}</p>
          <Button
            variant="link"
            size="sm"
            onClick={fetchExplanation}
            className="p-0 h-auto text-amber-600"
          >
            {retryText}
          </Button>
        </div>
      )}

      {explanation && !loading && (
        <div className="space-y-2">
          <p className="text-sm text-foreground leading-relaxed">
            {explanation.explanation}
          </p>
          {explanation.source !== 'custom' && (
            <p className="text-xs text-muted-foreground">
              {explanation.source === 'cached' ? (
                <span className="flex items-center gap-1">
                  <CacheIcon className="h-3 w-3" />
                  {isRTL ? 'מהמטמון' : 'Cached'}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <SparklesIcon className="h-3 w-3" />
                  {isRTL ? 'נוצר ע"י AI' : 'AI Generated'}
                </span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Inline icon components
function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
      <path d="M9 18h6"/>
      <path d="M10 22h4"/>
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18"/>
      <path d="m6 6 12 12"/>
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}

function CacheIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M3 5v14a9 3 0 0 0 18 0V5"/>
      <path d="M3 12a9 3 0 0 0 18 0"/>
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
  );
}
