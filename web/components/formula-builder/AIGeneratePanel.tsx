import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useApi } from '@/lib/api-client';

// Example prompts for common zmanim calculations
const EXAMPLE_PROMPTS = [
  "Alos 72 minutes before sunrise",
  "Sunrise when sun is 16.1 degrees below horizon",
  "End of Shema 3 proportional hours after sunrise (GRA)",
  "Tzeis when 3 medium stars visible (8.5 degrees)",
  "Midpoint between sunrise and sunset",
  "90 minutes after shkia for Rabbeinu Tam",
];

interface AIGeneratePanelProps {
  onAccept: (formula: string) => void;
  onEdit: (formula: string) => void;
  className?: string;
}

interface GenerationResult {
  formula: string;
  confidence: number;
  tokens_used: number;
  valid: boolean;
}

export function AIGeneratePanel({ onAccept, onEdit, className = '' }: AIGeneratePanelProps) {
  const api = useApi();
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!description.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // api-client auto-unwraps the 'data' field from API response
      const result = await api.post<GenerationResult>('/ai/generate-formula', {
        body: JSON.stringify({ description }),
      });

      setResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      generate();
    }
  };

  const confidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return { text: 'High confidence', color: 'text-green-600' };
    if (confidence >= 0.7) return { text: 'Medium confidence', color: 'text-yellow-600' };
    return { text: 'Low confidence', color: 'text-red-600' };
  };

  return (
    <div className={`space-y-4 p-4 border rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 ${className}`}>
      <div className="flex items-center gap-2">
        <SparklesIcon className="h-5 w-5 text-purple-500" />
        <h3 className="font-medium">Generate with AI</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Describe the zman calculation in plain language, and AI will generate the DSL formula for you.
      </p>

      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe the calculation in plain language... (e.g., '72 minutes before sunrise' or 'when the sun is 8.5 degrees below the horizon after sunset')"
        maxLength={2000}
        dir="auto"
        className="min-h-[80px]"
      />

      <div className="text-xs text-muted-foreground text-right">
        {description.length}/2000 characters
      </div>

      {/* Example prompts */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Try an example:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setDescription(prompt)}
              className="text-xs px-2 py-1 rounded-full bg-card border hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <Button
        onClick={generate}
        disabled={loading || !description.trim()}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
      >
        {loading ? (
          <>
            <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <SparklesIcon className="mr-2 h-4 w-4" />
            Generate Formula
          </>
        )}
      </Button>

      {/* Error display */}
      {error && (
        <div className="alert-error">
          <p className="alert-error-text text-sm">{error}</p>
        </div>
      )}

      {/* Result display */}
      {result && (
        <div className="p-4 bg-card border rounded-md space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Generated Formula:</p>
              <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                {result.formula}
              </code>
            </div>
            {result.valid && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Valid
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className={confidenceLabel(result.confidence).color}>
              {confidenceLabel(result.confidence).text}
            </span>
            <span>Tokens: {result.tokens_used}</span>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => onAccept(result.formula)}
              className="flex-1"
            >
              <CheckIcon className="mr-1 h-4 w-4" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(result.formula)}
              className="flex-1"
            >
              <PencilIcon className="mr-1 h-4 w-4" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={generate}
            >
              <RefreshIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple icon components (inline to avoid additional dependencies)
function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/>
      <path d="M19 17v4"/>
      <path d="M3 5h4"/>
      <path d="M17 19h4"/>
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M8 16H3v5"/>
    </svg>
  );
}
