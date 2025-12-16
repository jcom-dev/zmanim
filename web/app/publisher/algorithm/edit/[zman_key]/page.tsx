'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Save,
  Sparkles,
  Calendar,
  Code2,
  GripVertical,
  Loader2,
  AlertCircle,
  Wand2,
  Copy,
  Check,
  ArrowDownToLine,
  ChevronDown,
  MessageSquare,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatTime, isHebrewText } from '@/lib/utils';
import { useApi } from '@/lib/api-client';
import { usePublisherContext } from '@/providers/PublisherContext';

import { DSLEditor, type DSLEditorRef } from '@/components/editor/DSLEditor';
import { DSLReferencePanel } from '@/components/editor/DSLReferencePanel';
import { FormulaBuilder } from '@/components/formula-builder/FormulaBuilder';
import { AIGeneratePanel } from '@/components/formula-builder/AIGeneratePanel';
import { parseFormula, type ParseResult } from '@/components/formula-builder/types';
import { BilingualInput } from '@/components/shared/BilingualInput';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HighlightedFormula } from '@/components/shared/HighlightedFormula';
import { WeeklyPreviewDialog } from '@/components/algorithm/WeeklyPreviewDialog';
import {
  useZmanDetails,
  useUpdateZman,
  useCreateZman,
  usePreviewFormula,
  useValidateFormula,
  useZmanimList,
  type PreviewResult,
} from '@/lib/hooks/useZmanimList';

// Default Brooklyn location
const DEFAULT_LOCATION = {
  latitude: 40.6782,
  longitude: -73.9442,
  timezone: 'America/New_York',
  displayName: 'Brooklyn, NY',
};

// localStorage key prefix for preview location (per-publisher)
const PREVIEW_LOCATION_KEY_PREFIX = 'zmanim-preview-location-';
// localStorage key prefix for preview date
const PREVIEW_DATE_KEY = 'zmanim-preview-date';

interface PreviewLocation {
  latitude: number;
  longitude: number;
  timezone: string;
  displayName: string;
}

type EditorMode = 'guided' | 'advanced';

export default function ZmanEditorPage() {
  const router = useRouter();
  const params = useParams();
  const zmanKey = params.zman_key as string;
  const isNewZman = zmanKey === 'new';
  const { selectedPublisher } = usePublisherContext();

  // Panel resizing
  const [leftWidth, setLeftWidth] = useState(55);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dslEditorRef = useRef<DSLEditorRef>(null);

  // Collapsible sections state (for advanced mode)
  const [aiExplanationOpen, setAiExplanationOpen] = useState(false);
  const [publisherCommentOpen, setPublisherCommentOpen] = useState(false);

  // Editor state
  const [mode, setMode] = useState<EditorMode>('guided');
  const [hebrewName, setHebrewName] = useState('');
  const [englishName, setEnglishName] = useState('');
  const [formula, setFormula] = useState('');
  const [aiExplanation, setAiExplanation] = useState('');
  const [publisherComment, setPublisherComment] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [copiedFormula, setCopiedFormula] = useState(false);

  // Formula parsing state for guided mode availability
  const [formulaParseResult, setFormulaParseResult] = useState<ParseResult | null>(null);
  const guidedModeAvailable = formulaParseResult === null || formulaParseResult.success;

  // Preview state - inherit from localStorage or use today's date
  const [previewLocation, setPreviewLocation] = useState<PreviewLocation>(DEFAULT_LOCATION);
  const [previewDate, setPreviewDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedDate = localStorage.getItem(PREVIEW_DATE_KEY);
      if (savedDate) return savedDate;
    }
    return new Date().toISOString().split('T')[0];
  });
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [showWeeklyDialog, setShowWeeklyDialog] = useState(false);

  // Load location from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedPublisher?.id) {
      const savedLocation = localStorage.getItem(PREVIEW_LOCATION_KEY_PREFIX + selectedPublisher.id);
      if (savedLocation) {
        try {
          const parsed = JSON.parse(savedLocation) as PreviewLocation;
          setPreviewLocation(parsed);
        } catch {
          // Ignore parse errors, use default
        }
      }
    }
  }, [selectedPublisher?.id]);

  // Dialog state
  const [generatingExplanation, setGeneratingExplanation] = useState<'en' | 'he' | 'mixed' | null>(null);

  // API client
  const api = useApi();

  // Fetch data
  const { data: zman, isLoading: loadingZman } = useZmanDetails(isNewZman ? null : zmanKey);
  const { data: allZmanim = [] } = useZmanimList();
  const updateZman = useUpdateZman(zmanKey);
  const createZman = useCreateZman();
  const previewFormula = usePreviewFormula();
  const validateFormula = useValidateFormula();

  // Load existing zman data
  useEffect(() => {
    if (zman) {
      setHebrewName(zman.hebrew_name);
      setEnglishName(zman.english_name);
      setFormula(zman.formula_dsl);
      setAiExplanation(zman.ai_explanation || '');
      setPublisherComment(zman.publisher_comment || '');
      setHasChanges(false);
    }
  }, [zman]);

  // Track changes
  useEffect(() => {
    if (!zman) return;
    const changed =
      hebrewName !== zman.hebrew_name ||
      englishName !== zman.english_name ||
      formula !== zman.formula_dsl ||
      aiExplanation !== (zman.ai_explanation || '') ||
      publisherComment !== (zman.publisher_comment || '');
    setHasChanges(changed);
  }, [hebrewName, englishName, formula, aiExplanation, publisherComment, zman]);

  // Parse formula to determine if guided mode is available
  useEffect(() => {
    if (!formula.trim()) {
      // Empty formula - guided mode is available
      setFormulaParseResult(null);
      return;
    }

    const result = parseFormula(formula);
    setFormulaParseResult(result);

    // Auto-switch to advanced if formula becomes complex while in guided mode
    // Use functional update to avoid needing mode in dependency array
    if (!result.success) {
      setMode((currentMode) => currentMode === 'guided' ? 'advanced' : currentMode);
    }
  }, [formula]);

  // Live preview with debounce
  useEffect(() => {
    if (!formula.trim()) {
      setPreviewResult(null);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        // Extract references from formula (e.g., @alos_12, @sunrise)
        const refMatches = formula.match(/@([a-zA-Z_][a-zA-Z0-9_]*)/g) || [];
        const references: Record<string, string> = {};
        for (const match of refMatches) {
          const key = match.substring(1); // Remove @ prefix
          const referencedZman = allZmanim.find(z => z.zman_key === key);
          if (referencedZman?.formula_dsl) {
            references[key] = referencedZman.formula_dsl;
          }
        }

        const result = await previewFormula.mutateAsync({
          formula,
          date: previewDate,
          location: previewLocation,
          references: Object.keys(references).length > 0 ? references : undefined,
        });
        setPreviewResult(result);
      } catch {
        setPreviewResult(null);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [formula, previewDate, previewLocation, allZmanim]);

  // Handle resize
  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      setLeftWidth(Math.min(Math.max(newWidth, 30), 70));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Validation handler for DSLEditor
  const handleValidation = useCallback(async (formulaToValidate: string) => {
    try {
      const result = await validateFormula.mutateAsync(formulaToValidate);
      return {
        valid: result.valid,
        errors: result.errors?.map(e => ({ message: e.message })) || [],
      };
    } catch {
      return { valid: false, errors: [{ message: 'Validation failed' }] };
    }
  }, [validateFormula]);

  // Generate AI explanation handler
  const handleGenerateExplanation = async (language: 'en' | 'he' | 'mixed') => {
    if (!formula.trim()) {
      toast.error('Please enter a formula first');
      return;
    }

    setGeneratingExplanation(language);
    try {
      const response = await api.post<{ explanation: string; language: string; source: string }>(
        '/ai/explain-formula',
        { body: JSON.stringify({ formula, language }) }
      );
      setAiExplanation(response.explanation);
      setHasChanges(true);
      toast.success('AI explanation generated');
    } catch (error) {
      console.error('Failed to generate explanation:', error);
      toast.error('Failed to generate AI explanation. The AI service may not be configured.');
    } finally {
      setGeneratingExplanation(null);
    }
  };

  // Save handler
  const handleSave = async () => {
    if (!hebrewName.trim() || !englishName.trim() || !formula.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    toast.info('Saving...');

    try {
      if (isNewZman) {
        // Generate zman_key from english name
        const newKey = englishName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        await createZman.mutateAsync({
          zman_key: newKey,
          hebrew_name: hebrewName,
          english_name: englishName,
          formula_dsl: formula,
          ai_explanation: aiExplanation || undefined,
          publisher_comment: publisherComment || undefined,
        });
        toast.success('Zman created successfully');
      } else {
        await updateZman.mutateAsync({
          hebrew_name: hebrewName,
          english_name: englishName,
          formula_dsl: formula,
          ai_explanation: aiExplanation || undefined,
          publisher_comment: publisherComment || undefined,
        });
        toast.success('Zman updated successfully');
      }
      router.push('/publisher/algorithm');
    } catch (error) {
      console.error('[Save] Error:', error);
      toast.error(isNewZman ? 'Failed to create zman' : 'Failed to update zman');
    }
  };

  // Handle parse error from formula builder - no-op since useEffect already handles mode switching
  // Keep callback to satisfy FormulaBuilder's prop type, but don't double-switch modes
  const handleParseError = useCallback((_error: string) => {
    // Mode switching is handled by the formula parsing useEffect above
    // This callback exists only to satisfy FormulaBuilder's interface
  }, []);

  // Get zman keys for autocomplete
  const zmanimKeys = (allZmanim || []).map(z => z.zman_key);

  // Handler for inserting text from reference panel
  const handleInsertAtCursor = useCallback((text: string) => {
    dslEditorRef.current?.insertAtCursor(text);
  }, []);

  if (loadingZman && !isNewZman) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/publisher/algorithm')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-xl font-bold">
            {isNewZman ? 'New Custom Zman' : (
              <>
                <span className="font-hebrew">{zman?.hebrew_name}</span>
                <span className="mx-2 text-muted-foreground">•</span>
                <span>{zman?.english_name}</span>
              </>
            )}
          </h1>
          {zman?.display_status && (
            <Badge variant={zman.display_status === 'core' ? 'default' : 'secondary'}>
              {zman.display_status === 'core' ? 'Core' : zman.display_status === 'optional' ? 'Optional' : 'Hidden'}
            </Badge>
          )}
          {/* Preview Week - Prominent Position */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowWeeklyDialog(true)}
            disabled={!formula.trim()}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Preview Week
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {/* Save */}
          <Button
            type="button"
            onClick={handleSave}
            disabled={
              (!hasChanges && !isNewZman) ||
              updateZman.isPending ||
              createZman.isPending
            }
          >
            {(updateZman.isPending || createZman.isPending) ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isNewZman ? 'Create' : 'Save'}
          </Button>
        </div>
      </header>

      {/* Main Content: Split View */}
      <div
        ref={containerRef}
        className="flex-1 flex overflow-hidden"
        style={{ cursor: isResizing ? 'col-resize' : 'default' }}
      >
        {/* Left: Editor Panel */}
        <div
          style={{ width: `${leftWidth}%` }}
          className="flex flex-col border-r overflow-hidden"
          role="region"
          aria-label="Formula editor"
        >
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Mode Toggle */}
            <Tabs value={mode} onValueChange={(v) => {
              // Only allow switching to guided if it's available
              if (v === 'guided' && !guidedModeAvailable) return;
              setMode(v as EditorMode);
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="w-full">
                        <TabsTrigger
                          value="guided"
                          disabled={!guidedModeAvailable}
                          className={cn(
                            'w-full',
                            !guidedModeAvailable && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <Wand2 className="h-4 w-4 mr-2" />
                          Guided Builder
                          {!guidedModeAvailable && (
                            <AlertCircle className="h-3 w-3 ml-1 text-amber-500" />
                          )}
                        </TabsTrigger>
                      </span>
                    </TooltipTrigger>
                    {!guidedModeAvailable && formulaParseResult?.complexityDetails && (
                      <TooltipContent side="bottom" className="max-w-xs">
                        <p className="text-sm">{formulaParseResult.complexityDetails}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
                <TabsTrigger value="advanced">
                  <Code2 className="h-4 w-4 mr-2" />
                  Advanced DSL
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Bilingual Name Inputs */}
            <BilingualInput
              nameHebrew={hebrewName}
              nameEnglish={englishName}
              onHebrewChange={setHebrewName}
              onEnglishChange={setEnglishName}
              sourceHebrewName={zman?.source_hebrew_name}
              sourceEnglishName={zman?.source_english_name}
              sourceName={zman?.is_linked ? zman?.linked_source_publisher_name || 'Linked Publisher' : 'Registry'}
            />

            {/* Formula Deviation Indicator */}
            {zman?.source_formula_dsl && formula !== zman.source_formula_dsl && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Code2 className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Formula modified from {zman.is_linked ? zman.linked_source_publisher_name || 'Linked Publisher' : 'Registry'}
                      </p>
                      <div className="text-xs text-amber-700/80 dark:text-amber-300/80">
                        <span className="font-medium">Original:</span>{' '}
                        <code className="bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded font-mono">
                          {zman.source_formula_dsl}
                        </code>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFormula(zman.source_formula_dsl!)}
                    className="h-8 px-3 text-amber-700 border-amber-400 hover:bg-amber-100 hover:text-amber-800 dark:text-amber-300 dark:border-amber-600 dark:hover:bg-amber-900/50 dark:hover:text-amber-200 shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Revert to Original
                  </Button>
                </div>
              </div>
            )}

            {/* Formula Editor */}
            {mode === 'guided' ? (
              <FormulaBuilder
                initialFormula={formula}
                onChange={setFormula}
                onParseError={handleParseError}
              />
            ) : (
              <>
                {/* AI Generate Panel - prominent position above DSL editor */}
                <AIGeneratePanel
                  onAccept={(generatedFormula) => setFormula(generatedFormula)}
                  onEdit={(generatedFormula) => setFormula(generatedFormula)}
                />

                {/* Info banner when Guided Builder is unavailable */}
                {!guidedModeAvailable && formulaParseResult?.complexityDetails && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>
                        <strong>Guided Builder unavailable:</strong> {formulaParseResult.complexityDetails}
                      </span>
                    </div>
                  </div>
                )}
                <DSLEditor
                  ref={dslEditorRef}
                  value={formula}
                  onChange={setFormula}
                  onValidate={handleValidation}
                  zmanimKeys={zmanimKeys}
                />

                {/* Compact Result Card - in left panel for advanced mode */}
                <Card className="border-2 border-primary/30 bg-linear-to-br from-card to-primary/5">
                  <CardContent className="py-5">
                    {previewResult ? (
                      <div className="animate-in fade-in-0 duration-200 text-center">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          Calculated Result
                        </div>
                        <div
                          className="text-4xl font-bold font-mono tracking-tight"
                          role="status"
                          aria-live="polite"
                          aria-label={`Calculated time: ${formatTime(previewResult.result)}`}
                        >
                          {formatTime(previewResult.result)}
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">
                          {previewDate} • {previewLocation.displayName}
                        </div>
                      </div>
                    ) : previewFormula.isError ? (
                      <div className="flex items-center justify-center gap-2 text-destructive py-3" role="alert">
                        <AlertCircle className="h-5 w-5" aria-hidden="true" />
                        <span className="text-base">Error calculating result</span>
                      </div>
                    ) : (
                      <div className="text-center py-3">
                        <p className="text-sm text-muted-foreground italic">
                          Enter a valid formula to see the calculated time
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Collapsible AI Explanation */}
                <div className="rounded-lg border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAiExplanationOpen(!aiExplanationOpen)}
                    className="flex items-center justify-between w-full px-4 py-3 bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-sm font-medium">AI Explanation</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform',
                        aiExplanationOpen && 'rotate-180'
                      )}
                    />
                  </button>
                  {aiExplanationOpen && (
                    <div className="p-4 bg-card space-y-3">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateExplanation('mixed')}
                          disabled={generatingExplanation !== null || !formula.trim()}
                          title="English with Hebrew terms"
                        >
                          {generatingExplanation === 'mixed' ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                          )}
                          Mixed
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateExplanation('en')}
                          disabled={generatingExplanation !== null || !formula.trim()}
                          title="Full English"
                        >
                          {generatingExplanation === 'en' ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                          )}
                          English
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateExplanation('he')}
                          disabled={generatingExplanation !== null || !formula.trim()}
                          title="Full Hebrew"
                        >
                          {generatingExplanation === 'he' ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                          )}
                          עברית
                        </Button>
                      </div>
                      <Textarea
                        value={aiExplanation}
                        onChange={(e) => setAiExplanation(e.target.value)}
                        placeholder="Generate an AI explanation..."
                        rows={3}
                        className={cn(
                          "min-h-[80px] resize-none",
                          isHebrewText(aiExplanation) && "text-right"
                        )}
                        dir={isHebrewText(aiExplanation) ? "rtl" : "ltr"}
                      />
                      {aiExplanation.trim() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPublisherComment(aiExplanation);
                            setHasChanges(true);
                            toast.success('Copied to Publisher Comment');
                          }}
                          className="h-8 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <ArrowDownToLine className="h-3 w-3 mr-1.5" />
                          Copy to Publisher Comment
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Collapsible Publisher Comment */}
                <div className="rounded-lg border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPublisherCommentOpen(!publisherCommentOpen)}
                    className="flex items-center justify-between w-full px-4 py-3 bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      <span className="text-sm font-medium">Publisher Comment</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform',
                        publisherCommentOpen && 'rotate-180'
                      )}
                    />
                  </button>
                  {publisherCommentOpen && (
                    <div className="p-4 bg-card">
                      <Textarea
                        value={publisherComment}
                        onChange={(e) => setPublisherComment(e.target.value)}
                        placeholder="Add a note for users viewing this zman (e.g., halachic source, custom minhag)..."
                        rows={3}
                        className="min-h-[80px] resize-none"
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Resizer */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={Math.round(leftWidth)}
          aria-valuemin={30}
          aria-valuemax={70}
          aria-label="Resize panels"
          tabIndex={0}
          className={cn(
            'w-2 bg-border hover:bg-primary/50 cursor-col-resize flex items-center justify-center transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2',
            isResizing && 'bg-primary'
          )}
          onMouseDown={handleMouseDown}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setLeftWidth((w) => Math.max(30, w - 5));
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              setLeftWidth((w) => Math.min(70, w + 5));
            }
          }}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>

        {/* Right Panel - Different content based on mode */}
        <div
          style={{ width: `${100 - leftWidth}%` }}
          className="flex flex-col overflow-hidden"
          role="region"
          aria-label={mode === 'advanced' ? 'DSL Reference' : 'Formula preview and calculation'}
        >
          {mode === 'advanced' ? (
            /* DSL Reference Panel for Advanced Mode */
            <DSLReferencePanel
              onInsert={handleInsertAtCursor}
              onSetFormula={setFormula}
              currentFormula={formula}
              zmanimKeys={zmanimKeys}
              className="h-full"
            />
          ) : (
            /* Preview Panel for Guided Mode */
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-muted/30">
              {/* Formula Preview */}
              <Card className="border-2">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold">Formula</CardTitle>
                    {formula.trim() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(formula);
                          setCopiedFormula(true);
                          setTimeout(() => setCopiedFormula(false), 2000);
                          toast.success('Formula copied to clipboard');
                        }}
                        className="h-8 px-3"
                      >
                        {copiedFormula ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {formula.trim() ? (
                    <HighlightedFormula formula={formula} />
                  ) : (
                    <p className="text-sm text-muted-foreground italic py-2">
                      Enter a formula to see the syntax highlighted preview
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Calculated Result - Hero Card */}
              <Card className="border-2 border-primary/30 bg-linear-to-br from-card to-primary/5">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold">Calculated Result</CardTitle>
                    {previewFormula.isPending && (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  {previewResult ? (
                    <div className="animate-in fade-in-0 duration-200 text-center py-4">
                      <div
                        className="text-5xl font-bold font-mono tracking-tight transition-all duration-300"
                        role="status"
                        aria-live="polite"
                        aria-label={`Calculated time: ${formatTime(previewResult.result)}`}
                      >
                        {formatTime(previewResult.result)}
                      </div>
                      <div className="text-sm text-muted-foreground mt-3">
                        {previewDate} • {previewLocation.displayName}
                      </div>
                    </div>
                  ) : previewFormula.isError ? (
                    <div className="flex items-center justify-center gap-2 text-destructive py-6" role="alert">
                      <AlertCircle className="h-5 w-5" aria-hidden="true" />
                      <span className="text-base">Error calculating result</span>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-base text-muted-foreground italic">
                        Enter a valid formula to see the calculated time
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AI Explanation */}
              <Card className="border-2">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg font-semibold">AI Explanation</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="default"
                        onClick={() => handleGenerateExplanation('mixed')}
                        disabled={generatingExplanation !== null || !formula.trim()}
                        className="h-9 px-3"
                        title="English with Hebrew terms"
                      >
                        {generatingExplanation === 'mixed' ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Mixed
                      </Button>
                      <Button
                        variant="outline"
                        size="default"
                        onClick={() => handleGenerateExplanation('en')}
                        disabled={generatingExplanation !== null || !formula.trim()}
                        className="h-9 px-3"
                        title="Full English"
                      >
                        {generatingExplanation === 'en' ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        English
                      </Button>
                      <Button
                        variant="outline"
                        size="default"
                        onClick={() => handleGenerateExplanation('he')}
                        disabled={generatingExplanation !== null || !formula.trim()}
                        className="h-9 px-3"
                        title="Full Hebrew"
                      >
                        {generatingExplanation === 'he' ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        עברית
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={aiExplanation}
                    onChange={(e) => setAiExplanation(e.target.value)}
                    placeholder="Generate an AI explanation..."
                    rows={4}
                    className={cn(
                      "min-h-[100px] resize-none",
                      isHebrewText(aiExplanation) && "text-right"
                    )}
                    dir={isHebrewText(aiExplanation) ? "rtl" : "ltr"}
                  />
                  {aiExplanation.trim() && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPublisherComment(aiExplanation);
                        setHasChanges(true);
                        toast.success('Copied to Publisher Comment');
                      }}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ArrowDownToLine className="h-3 w-3 mr-1.5" />
                      Copy to Publisher Comment
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Publisher Comment */}
              <Card className="border-2">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold">Publisher Comment</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={publisherComment}
                    onChange={(e) => setPublisherComment(e.target.value)}
                    placeholder="Add a note for users viewing this zman (e.g., halachic source, custom minhag)..."
                    rows={3}
                    className="min-h-[80px] resize-none"
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Weekly Preview Dialog */}
      <WeeklyPreviewDialog
        open={showWeeklyDialog}
        onOpenChange={setShowWeeklyDialog}
        formula={formula}
        location={previewLocation}
        zmanName={englishName || zman?.english_name}
      />
    </div>
  );
}
