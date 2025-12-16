/**
 * @file CodeMirrorDSLEditor.tsx
 * @purpose Syntax-highlighted DSL editor - autocomplete, validation, linting
 * @pattern client-component-editor
 * @dependencies CodeMirror 6, custom DSL language mode
 * @frequency critical - 779 lines
 * @compliance Check docs/adr/ for pattern rationale
 */

'use client';

import { useRef, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef, useState } from 'react';
import { EditorView, keymap, placeholder, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { EditorState, StateField, StateEffect, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { autocompletion, completionKeymap, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { linter, Diagnostic } from '@codemirror/lint';
import { AlertCircle, CheckCircle2, Code2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dslLanguage, dslHighlighting, DSL_PRIMITIVES, DSL_FUNCTIONS, DSL_KEYWORDS } from '@/lib/codemirror/dsl-language';
import { humanizeError, type HumanError } from '@/lib/error-humanizer';
import { getDSLContext, getTooltipData, type DSLContext } from '@/lib/dsl-context-helper';
import { HumanErrorDisplay } from './HumanErrorDisplay';
import { ContextualTooltip } from './ContextualTooltip';

// Types
export interface CodeMirrorDSLEditorRef {
  insertAtCursor: (text: string) => void;
  focus: () => void;
  replaceAll: (text: string) => void;
}

interface ValidationError {
  message: string;
  position?: { start: number; end: number };
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface CodeMirrorDSLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidate?: (formula: string) => Promise<ValidationResult>;
  zmanimKeys?: string[];
  disabled?: boolean;
  className?: string;
  onNavigateToReference?: (section: string) => void;
}

// Custom completions for DSL
function createDSLCompletions(zmanimKeys: string[]) {
  return (context: CompletionContext): CompletionResult | null => {
    // Reference completion (@...)
    const refMatch = context.matchBefore(/@\w*/);
    if (refMatch) {
      const options = zmanimKeys.map(key => ({
        label: `@${key}`,
        type: 'variable',
        info: `Reference to ${key}`,
        boost: 2,
      }));

      return {
        from: refMatch.from,
        options,
        validFor: /@\w*/,
      };
    }

    // Word completion
    const wordMatch = context.matchBefore(/\w+/);
    if (!wordMatch || wordMatch.from === wordMatch.to) return null;

    const word = wordMatch.text.toLowerCase();

    // Build completion options
    const options: Array<{
      label: string;
      type: string;
      info?: string;
      detail?: string;
      apply?: string;
      boost?: number;
    }> = [];

    // Primitives
    DSL_PRIMITIVES.forEach(p => {
      if (p.toLowerCase().includes(word)) {
        options.push({
          label: p,
          type: 'constant',
          info: getPrimitiveInfo(p),
          boost: p.toLowerCase().startsWith(word) ? 3 : 1,
        });
      }
    });

    // Functions
    DSL_FUNCTIONS.forEach(f => {
      if (f.toLowerCase().includes(word)) {
        options.push({
          label: f,
          type: 'function',
          info: getFunctionInfo(f),
          detail: getFunctionSignature(f),
          apply: getFunctionSnippet(f),
          boost: f.toLowerCase().startsWith(word) ? 4 : 2,
        });
      }
    });

    // Keywords
    DSL_KEYWORDS.forEach(k => {
      if (k.toLowerCase().includes(word)) {
        options.push({
          label: k,
          type: 'keyword',
          info: getKeywordInfo(k),
          boost: k.toLowerCase().startsWith(word) ? 2 : 0,
        });
      }
    });

    if (options.length === 0) return null;

    return {
      from: wordMatch.from,
      options: options.sort((a, b) => (b.boost || 0) - (a.boost || 0)),
      validFor: /\w*/,
    };
  };
}

// Helper functions for completion info
function getPrimitiveInfo(primitive: string): string {
  const info: Record<string, string> = {
    sunrise: 'Time when sun crosses horizon (morning) - Netz HaChama',
    sunset: 'Time when sun crosses horizon (evening) - Shkias HaChama',
    solar_noon: 'Time when sun is at highest point - Chatzos HaYom',
    midnight: 'Solar midnight - Chatzos HaLailah',
    civil_dawn: 'When sun is 6° below horizon (morning)',
    civil_dusk: 'When sun is 6° below horizon (evening)',
    alos_hashachar: 'Dawn - typically 72 min before sunrise or 16.1° - עלות השחר',
    misheyakir: 'Earliest time for tallis/tefillin - משיכיר',
    tzeis_hakochavim: 'Nightfall - three stars visible - צאת הכוכבים',
    chatzos: 'Midday - solar noon',
  };
  return info[primitive] || `Solar event: ${primitive}`;
}

function getFunctionInfo(func: string): string {
  const info: Record<string, string> = {
    solar: 'Calculate time based on solar angle (degrees below/above horizon)',
    proportional_hours: 'Calculate using proportional hours (halachic hours)',
    midpoint: 'Calculate middle point between two times',
    min: 'Return the earlier of two times',
    max: 'Return the later of two times',
    if: 'Conditional expression for seasonal variations',
  };
  return info[func] || `Function: ${func}`;
}

function getFunctionSignature(func: string): string {
  const sigs: Record<string, string> = {
    solar: '(degrees, direction)',
    proportional_hours: '(hours, base)',
    midpoint: '(time1, time2)',
    min: '(time1, time2)',
    max: '(time1, time2)',
    if: '(condition, then, else)',
  };
  return sigs[func] || '';
}

function getFunctionSnippet(func: string): string {
  const snippets: Record<string, string> = {
    solar: 'solar(16.1, before_visible_sunrise)',
    proportional_hours: 'proportional_hours(3, gra)',
    midpoint: 'midpoint(sunrise, sunset)',
    min: 'min(, )',
    max: 'max(, )',
    if: 'if (condition) { } else { }',
  };
  return snippets[func] || func;
}

function getKeywordInfo(keyword: string): string {
  const info: Record<string, string> = {
    before_visible_sunrise: 'Direction: calculate time before sunrise',
    after_sunrise: 'Direction: calculate time after sunrise',
    before_sunset: 'Direction: calculate time before sunset',
    after_visible_sunset: 'Direction: calculate time after sunset',
    gra: 'GRA system (Vilna Gaon): sunrise to sunset',
    mga: 'MGA system (Magen Avraham): dawn to nightfall',
    custom: 'Custom day definition',
    alos_16_1: 'Use alos at 16.1° as day start',
    alos_72: 'Use alos at 72 minutes as day start',
  };
  return info[keyword] || keyword;
}

// Error highlight decoration
const addErrorHighlight = StateEffect.define<{ from: number; to: number }>();
const clearErrorHighlights = StateEffect.define();

const errorHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(clearErrorHighlights)) {
        decorations = Decoration.none;
      } else if (effect.is(addErrorHighlight)) {
        const { from, to } = effect.value;
        decorations = decorations.update({
          add: [
            Decoration.mark({
              class: 'cm-error-highlight',
            }).range(from, to),
          ],
        });
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Editor theme
const editorTheme = EditorView.theme({
  '&': {
    fontSize: '14px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  '.cm-content': {
    padding: '12px 16px',
    minHeight: '180px',
    caretColor: '#3b82f6',
  },
  '.cm-focused .cm-cursor': {
    borderLeftColor: '#3b82f6',
    borderLeftWidth: '2px',
  },
  '.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(59, 130, 246, 0.2) !important',
  },
  '.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(59, 130, 246, 0.3) !important',
  },
  // Error highlighting
  '.cm-error-highlight': {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderBottom: '2px wavy #ef4444',
  },
  // Autocomplete styling
  '.cm-tooltip-autocomplete': {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
  },
  '.cm-tooltip-autocomplete ul': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    maxHeight: '280px',
  },
  '.cm-tooltip-autocomplete ul li': {
    padding: '8px 12px',
    borderBottom: '1px solid hsl(var(--border))',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  '.cm-tooltip-autocomplete ul li:last-child': {
    borderBottom: 'none',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'hsl(var(--accent))',
    color: 'hsl(var(--accent-foreground))',
  },
  '.cm-completionIcon': {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: '600',
  },
  '.cm-completionIcon-constant': {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    color: '#10b981',
  },
  '.cm-completionIcon-function': {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#3b82f6',
  },
  '.cm-completionIcon-keyword': {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    color: '#a855f7',
  },
  '.cm-completionIcon-variable': {
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
    color: '#ec4899',
  },
  '.cm-completionLabel': {
    fontWeight: '500',
  },
  '.cm-completionDetail': {
    marginLeft: 'auto',
    opacity: '0.6',
    fontSize: '12px',
  },
  // Lint styling - hide gutter markers completely
  '.cm-lint-marker': {
    display: 'none !important',
  },
  '.cm-lintPoint': {
    display: 'none !important',
  },
  '.cm-lintPoint-error': {
    display: 'none !important',
  },
  '.cm-lintPoint-warning': {
    display: 'none !important',
  },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    borderBottom: '2px wavy #ef4444',
  },
  '.cm-lintRange-warning': {
    backgroundImage: 'none',
    borderBottom: '2px wavy #f59e0b',
  },
  '.cm-diagnostic': {
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '13px',
  },
  '.cm-diagnostic-error': {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderLeft: '3px solid #ef4444',
  },
  // Placeholder
  '.cm-placeholder': {
    color: '#6b7280',
    fontStyle: 'italic',
  },
}, { dark: true });

// Light theme variant
const editorThemeLight = EditorView.theme({
  '.cm-content': {
    backgroundColor: 'hsl(var(--background))',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(59, 130, 246, 0.15) !important',
  },
  '.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(59, 130, 246, 0.25) !important',
  },
});

export const CodeMirrorDSLEditor = forwardRef<CodeMirrorDSLEditorRef, CodeMirrorDSLEditorProps>(
  function CodeMirrorDSLEditor(
    { value, onChange, onValidate, zmanimKeys = [], disabled = false, className, onNavigateToReference },
    ref
  ) {
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const editorViewRef = useRef<EditorView | null>(null);
    const [validationState, setValidationState] = useState<{
      valid: boolean;
      errors: ValidationError[];
      loading: boolean;
      humanError?: HumanError;
    }>({ valid: true, errors: [], loading: false });

    // Contextual tooltip state
    const [tooltipState, setTooltipState] = useState<{
      context: DSLContext;
      position: { x: number; y: number } | null;
      visible: boolean;
    }>({ context: { type: 'unknown' }, position: null, visible: false });
    const tooltipDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const emptyEditorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Create linter that uses external validation
    const createLinter = useCallback(() => {
      return linter(async (view): Promise<Diagnostic[]> => {
        if (!onValidate) return [];

        const doc = view.state.doc.toString();
        if (!doc.trim()) return [];

        try {
          const result = await onValidate(doc);
          if (result.valid) return [];

          return result.errors.map((error) => ({
            from: error.position?.start ?? 0,
            to: error.position?.end ?? doc.length,
            severity: 'error' as const,
            message: error.message,
          }));
        } catch {
          return [];
        }
      }, { delay: 500 });
    }, [onValidate]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      insertAtCursor: (text: string) => {
        const view = editorViewRef.current;
        if (!view) return;

        const { from, to } = view.state.selection.main;
        const doc = view.state.doc.toString();

        // Smart spacing: add space before if needed
        let insertText = text;
        if (from > 0) {
          const charBefore = doc[from - 1];
          // Don't add space if: at start, after space, after opening bracket/paren, or after operator
          const needsSpace = !/[\s(\[{,]/.test(charBefore);
          if (needsSpace) {
            insertText = ' ' + text;
          }
        }

        view.dispatch({
          changes: { from, to, insert: insertText },
          selection: { anchor: from + insertText.length },
        });
        view.focus();
      },
      focus: () => {
        editorViewRef.current?.focus();
      },
      replaceAll: (text: string) => {
        const view = editorViewRef.current;
        if (!view) return;

        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
        });
      },
    }), []);

    // Store onChange in a ref to avoid stale closure issues
    const onChangeRef = useRef(onChange);
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    // Store zmanimKeys in a ref to avoid reinitializing editor when array reference changes
    const zmanimKeysRef = useRef(zmanimKeys);
    useEffect(() => {
      zmanimKeysRef.current = zmanimKeys;
    }, [zmanimKeys]);

    // Initialize editor only once (or when disabled changes)
    useEffect(() => {
      if (!editorContainerRef.current) return;

      // Prevent double initialization
      if (editorViewRef.current) {
        editorViewRef.current.destroy();
      }

      const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged) {
          const newValue = update.state.doc.toString();
          onChangeRef.current(newValue);
        }

        // Handle cursor position changes for contextual tooltip
        if (update.selectionSet || update.docChanged) {
          // Clear any pending debounce
          if (tooltipDebounceRef.current) {
            clearTimeout(tooltipDebounceRef.current);
          }
          if (emptyEditorTimeoutRef.current) {
            clearTimeout(emptyEditorTimeoutRef.current);
          }

          const pos = update.state.selection.main.head;
          const doc = update.state.doc.toString();
          const context = getDSLContext(doc, pos);

          // Check if this context has tooltip data
          const tooltipData = getTooltipData(context);

          if (context.type === 'empty_editor') {
            // Delay showing empty editor tooltip by 2 seconds
            emptyEditorTimeoutRef.current = setTimeout(() => {
              const coords = update.view.coordsAtPos(pos);
              if (coords) {
                setTooltipState({
                  context,
                  position: { x: coords.left, y: coords.top },
                  visible: true,
                });
              }
            }, 2000);
          } else if (tooltipData) {
            // Debounce tooltip appearance by 100ms
            tooltipDebounceRef.current = setTimeout(() => {
              const coords = update.view.coordsAtPos(pos);
              if (coords) {
                setTooltipState({
                  context,
                  position: { x: coords.left, y: coords.top },
                  visible: true,
                });
              }
            }, 100);
          } else {
            // Hide tooltip for unknown/operator contexts
            setTooltipState(prev => ({ ...prev, visible: false }));
          }
        }
      });

      const state = EditorState.create({
        doc: value,
        extensions: [
          // Ensure editor is editable and focusable
          EditorView.editable.of(!disabled),
          EditorState.readOnly.of(disabled),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': 'DSL Formula Editor' }),

          // Basic editing
          history(),
          indentOnInput(),
          bracketMatching(),

          // Keymaps
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),

          // Language support
          dslLanguage,
          dslHighlighting,

          // Autocomplete (uses zmanimKeysRef to avoid stale closure)
          autocompletion({
            override: [(context) => createDSLCompletions(zmanimKeysRef.current)(context)],
            icons: true,
            addToOptions: [
              {
                render(completion) {
                  const span = document.createElement('span');
                  span.className = `cm-completionIcon cm-completionIcon-${completion.type}`;
                  span.textContent = completion.type?.[0]?.toUpperCase() || '?';
                  return span;
                },
                position: 0,
              },
            ],
          }),

          // Linting (no gutter - errors shown inline with wavy underline)
          createLinter(),

          // Error highlight field
          errorHighlightField,

          // Theme
          editorTheme,

          // Placeholder (shows when editor is empty)
          placeholder('Enter your formula, e.g. sunrise - 72min'),

          // Update listener
          updateListener,

          // Note: Tab behavior is handled by indentWithTab in keymaps above
          // No need for additional key handlers
        ],
      });

      const view = new EditorView({
        state,
        parent: editorContainerRef.current,
      });

      editorViewRef.current = view;

      // Focus the editor after a short delay to ensure it's mounted
      requestAnimationFrame(() => {
        view.focus();
      });

      return () => {
        view.destroy();
        editorViewRef.current = null;
      };
    }, [disabled]); // Only reinitialize when disabled changes - other values use refs

    // Update editor when external value changes
    useEffect(() => {
      const view = editorViewRef.current;
      if (!view) return;

      const currentValue = view.state.doc.toString();
      if (currentValue !== value) {
        view.dispatch({
          changes: { from: 0, to: currentValue.length, insert: value },
        });
      }
    }, [value]);

    // Store onValidate in a ref to avoid triggering effect when callback reference changes
    const onValidateRef = useRef(onValidate);
    useEffect(() => {
      onValidateRef.current = onValidate;
    }, [onValidate]);

    // Run validation separately for status display
    useEffect(() => {
      if (!onValidateRef.current || !value.trim()) {
        setValidationState({ valid: true, errors: [], loading: false, humanError: undefined });
        return;
      }

      setValidationState(prev => ({ ...prev, loading: true }));

      const timeout = setTimeout(async () => {
        try {
          const result = await onValidateRef.current!(value);
          // If there are errors, humanize the first one
          const humanError = result.errors.length > 0
            ? humanizeError(result.errors[0].message, value)
            : undefined;
          setValidationState({ ...result, loading: false, humanError });
        } catch {
          const humanError = humanizeError('Validation failed', value);
          setValidationState({ valid: false, errors: [{ message: 'Validation failed' }], loading: false, humanError });
        }
      }, 500);

      return () => clearTimeout(timeout);
    }, [value]); // Only depend on value, not onValidate

    return (
      <div className={cn('space-y-3', className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            DSL Formula
          </label>
          <div className="flex items-center gap-2">
            {validationState.loading ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Validating...
              </span>
            ) : validationState.valid ? (
              <span className="text-xs text-emerald-500 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Valid
              </span>
            ) : (
              <span className="text-xs text-destructive flex items-center gap-1.5 font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                {validationState.errors.length} error{validationState.errors.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Editor container */}
        <div
          ref={editorContainerRef}
          onClick={() => editorViewRef.current?.focus()}
          className={cn(
            'relative rounded-lg border bg-card overflow-hidden transition-all duration-200 cursor-text',
            'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
            validationState.valid ? 'border-border' : 'border-destructive/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />

        {/* Human-friendly error display */}
        {!validationState.valid && validationState.humanError && (
          <HumanErrorDisplay
            error={validationState.humanError}
            onInsertExample={(code) => {
              const view = editorViewRef.current;
              if (view) {
                view.dispatch({
                  changes: { from: 0, to: view.state.doc.length, insert: code },
                });
                view.focus();
              }
            }}
            onNavigateToReference={onNavigateToReference}
          />
        )}

        {/* Contextual tooltip */}
        <ContextualTooltip
          context={tooltipState.context}
          position={tooltipState.position}
          visible={tooltipState.visible}
          onInsert={(value) => {
            const view = editorViewRef.current;
            if (view) {
              // Use paramStart/paramEnd from context to replace the entire parameter
              const context = tooltipState.context;
              let from: number, to: number;

              if ('paramStart' in context && 'paramEnd' in context) {
                // Replace the entire current parameter value
                from = context.paramStart;
                to = context.paramEnd;
              } else {
                // Fallback to current selection (for empty_editor, etc.)
                const sel = view.state.selection.main;
                from = sel.from;
                to = sel.to;
              }

              view.dispatch({
                changes: { from, to, insert: value },
                selection: { anchor: from + value.length },
              });
              view.focus();
            }
            setTooltipState(prev => ({ ...prev, visible: false }));
          }}
          onDismiss={() => setTooltipState(prev => ({ ...prev, visible: false }))}
        />

        {/* Keyboard shortcuts hint */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Tab</kbd>
            {' '}autocomplete
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Ctrl+Z</kbd>
            {' '}undo
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">@</kbd>
            {' '}reference zman
          </span>
        </div>
      </div>
    );
  }
);

export default CodeMirrorDSLEditor;
