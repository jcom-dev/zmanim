'use client';

import { useState, useRef, useCallback, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import { AlertCircle, CheckCircle2, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  tokenize,
  getTokenClass,
} from '@/lib/codemirror/dsl-tokens';
import {
  getCompletions,
  getReferenceCompletions,
  type Completion,
} from '@/lib/codemirror/dsl-completions';

export interface DSLEditorRef {
  insertAtCursor: (text: string) => void;
  focus: () => void;
}

interface DSLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidate?: (formula: string) => Promise<{ valid: boolean; errors: Array<{ message: string; position?: { start: number; end: number } }> }>;
  zmanimKeys?: string[];
  disabled?: boolean;
  className?: string;
}

interface ValidationState {
  valid: boolean;
  errors: Array<{ message: string; position?: { start: number; end: number } }>;
  loading: boolean;
}

export const DSLEditor = forwardRef<DSLEditorRef, DSLEditorProps>(function DSLEditor({
  value,
  onChange,
  onValidate,
  zmanimKeys = [],
  disabled = false,
  className,
}, ref) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Expose insertAtCursor method via ref
  useImperativeHandle(ref, () => ({
    insertAtCursor: (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = value.substring(0, start);
      const after = value.substring(end);
      const newValue = before + text + after;

      onChange(newValue);

      // Set cursor position after inserted text
      setTimeout(() => {
        textarea.focus();
        const newPos = start + text.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    },
    focus: () => {
      textareaRef.current?.focus();
    },
  }), [value, onChange]);
  const [showCompletions, setShowCompletions] = useState(false);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [selectedCompletion, setSelectedCompletion] = useState(0);
  const [completionPos, setCompletionPos] = useState({ x: 0, y: 0 });
  const [validation, setValidation] = useState<ValidationState>({
    valid: true,
    errors: [],
    loading: false,
  });

  // Tokenize the current value
  const tokens = useMemo(() => tokenize(value), [value]);

  // Render highlighted code
  const highlightedCode = useMemo(() => {
    if (!value) return null;

    let lastEnd = 0;
    const parts: React.ReactNode[] = [];

    tokens.forEach((token, i) => {
      // Add any skipped whitespace
      if (token.start > lastEnd) {
        parts.push(
          <span key={`ws-${i}`}>{value.substring(lastEnd, token.start)}</span>
        );
      }

      parts.push(
        <span key={i} className={getTokenClass(token.type)}>
          {token.value}
        </span>
      );

      lastEnd = token.end;
    });

    // Add trailing content
    if (lastEnd < value.length) {
      parts.push(
        <span key="trailing">{value.substring(lastEnd)}</span>
      );
    }

    return parts;
  }, [tokens, value]);

  // Debounced validation
  useEffect(() => {
    if (!onValidate || !value.trim()) {
      setValidation({ valid: true, errors: [], loading: false });
      return;
    }

    setValidation((prev) => ({ ...prev, loading: true }));

    const timeout = setTimeout(async () => {
      try {
        const result = await onValidate(value);
        setValidation({ ...result, loading: false });
      } catch {
        setValidation({ valid: false, errors: [{ message: 'Validation failed' }], loading: false });
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [value, onValidate]);

  // Handle text input
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      onChange(newValue);

      // Check for autocomplete trigger
      const cursorPos = e.target.selectionStart;
      const textBeforeCursor = newValue.substring(0, cursorPos);

      // Reference completion (@...)
      const refMatch = textBeforeCursor.match(/@(\w*)$/);
      if (refMatch) {
        const prefix = refMatch[1];
        const refCompletions = getReferenceCompletions(zmanimKeys).filter((c) =>
          c.label.toLowerCase().includes(prefix.toLowerCase())
        );
        if (refCompletions.length > 0) {
          setCompletions(refCompletions);
          setSelectedCompletion(0);
          setShowCompletions(true);
          updateCompletionPosition(e.target, cursorPos - refMatch[0].length);
          return;
        }
      }

      // Word completion
      const wordMatch = textBeforeCursor.match(/[a-zA-Z_]\w*$/);
      if (wordMatch && wordMatch[0].length >= 2) {
        const prefix = wordMatch[0];
        const wordCompletions = getCompletions(prefix);
        if (wordCompletions.length > 0) {
          setCompletions(wordCompletions);
          setSelectedCompletion(0);
          setShowCompletions(true);
          updateCompletionPosition(e.target, cursorPos - prefix.length);
          return;
        }
      }

      setShowCompletions(false);
    },
    [onChange, zmanimKeys]
  );

  // Update completion popup position
  const updateCompletionPosition = (textarea: HTMLTextAreaElement, wordStart: number) => {
    // Simple positioning - could be improved with a proper caret position library
    const rect = textarea.getBoundingClientRect();
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
    const lines = textarea.value.substring(0, wordStart).split('\n');
    const currentLine = lines.length - 1;
    const charInLine = lines[lines.length - 1].length;

    setCompletionPos({
      x: Math.min(charInLine * 8, rect.width - 200), // Approximate char width
      y: (currentLine + 1) * lineHeight + 4,
    });
  };

  // Handle keyboard for completions
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showCompletions) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCompletion((prev) => Math.min(prev + 1, completions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCompletion((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        insertCompletion(completions[selectedCompletion]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowCompletions(false);
      }
    },
    [showCompletions, completions, selectedCompletion]
  );

  // Insert selected completion
  const insertCompletion = useCallback(
    (completion: Completion) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = value.substring(0, cursorPos);

      // Find the word/reference to replace
      let replaceStart = cursorPos;
      const refMatch = textBeforeCursor.match(/@\w*$/);
      const wordMatch = textBeforeCursor.match(/[a-zA-Z_]\w*$/);

      if (refMatch) {
        replaceStart = cursorPos - refMatch[0].length;
      } else if (wordMatch) {
        replaceStart = cursorPos - wordMatch[0].length;
      }

      const insertText = completion.snippet || completion.label;
      const newValue =
        value.substring(0, replaceStart) + insertText + value.substring(cursorPos);

      onChange(newValue);
      setShowCompletions(false);

      // Position cursor after insertion
      setTimeout(() => {
        const newPos = replaceStart + insertText.length;
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    },
    [value, onChange]
  );

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-2">
          <Code2 className="h-4 w-4" />
          DSL Formula
        </label>
        <div className="flex items-center gap-2">
          {validation.loading ? (
            <span className="text-xs text-muted-foreground">Validating...</span>
          ) : validation.valid ? (
            <span className="text-xs text-green-500 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Valid
            </span>
          ) : (
            <span className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {validation.errors.length} error{validation.errors.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Editor container */}
      <div className="relative font-mono text-sm">
        {/* Syntax highlighted overlay */}
        <div
          className="absolute inset-0 p-3 pointer-events-none whitespace-pre-wrap wrap-break-word overflow-hidden"
          aria-hidden="true"
        >
          {highlightedCode}
        </div>

        {/* Actual textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowCompletions(false), 200)}
          disabled={disabled}
          spellCheck={false}
          className={cn(
            'w-full min-h-[200px] max-h-[500px] p-3 rounded-md border bg-transparent text-transparent caret-foreground resize-y',
            'focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2',
            disabled && 'cursor-not-allowed opacity-50'
          )}
          placeholder="// Enter DSL formula
sunrise - 72min"
        />

        {/* Autocomplete popup */}
        {showCompletions && completions.length > 0 && (
          <div
            className="absolute z-50 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto"
            style={{ left: completionPos.x, top: completionPos.y }}
          >
            {completions.map((completion, i) => (
              <button
                key={completion.label}
                type="button"
                className={cn(
                  'w-full text-left px-3 py-2 text-sm flex items-center gap-2',
                  i === selectedCompletion && 'bg-accent'
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertCompletion(completion);
                }}
                onMouseEnter={() => setSelectedCompletion(i)}
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    completion.type === 'primitive' && 'bg-green-500',
                    completion.type === 'function' && 'bg-blue-500',
                    completion.type === 'keyword' && 'bg-purple-500',
                    completion.type === 'reference' && 'bg-pink-500'
                  )}
                />
                <span className="font-medium">{completion.label}</span>
                {completion.detail && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {completion.detail}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error panel */}
      {!validation.valid && validation.errors.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <h4 className="text-sm font-medium text-destructive mb-2">Errors</h4>
          <ul className="space-y-1">
            {validation.errors.map((error, i) => (
              <li key={i} className="text-sm text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick reference */}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">
          Quick Reference
        </summary>
        <div className="mt-2 p-2 bg-muted rounded grid grid-cols-2 gap-2">
          <div>
            <strong>Primitives:</strong> sunrise, sunset, solar_noon, midnight
          </div>
          <div>
            <strong>Functions:</strong> solar(deg, dir), shaos(hrs, base)
          </div>
          <div>
            <strong>Operators:</strong> +, -, (e.g., sunrise - 72min)
          </div>
          <div>
            <strong>References:</strong> @zman_key
          </div>
        </div>
      </details>
    </div>
  );
});

export default DSLEditor;
