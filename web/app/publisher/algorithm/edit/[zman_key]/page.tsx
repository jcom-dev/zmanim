'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Save,
  Calendar,
  Code2,
  GripVertical,
  Loader2,
  AlertCircle,
  Wand2,
  Copy,
  Check,
  RotateCcw,
  Tags,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatTime } from '@/lib/utils';
import { useApi } from '@/lib/api-client';
import { usePublisherContext } from '@/providers/PublisherContext';

import { DSLEditor, type DSLEditorRef } from '@/components/editor/DSLEditor';
import { DSLReferencePanel } from '@/components/editor/DSLReferencePanel';
import { FormulaBuilder } from '@/components/formula-builder/FormulaBuilder';
import { AIGeneratePanel } from '@/components/formula-builder/AIGeneratePanel';
import { parseFormula } from '@/components/formula-builder/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HighlightedFormula } from '@/components/shared/HighlightedFormula';
import { WeeklyPreviewDialog } from '@/components/algorithm/WeeklyPreviewDialog';
import { TagEditorDialog } from '@/components/shared/tags/TagEditorDialog';
import { usePreferences } from '@/lib/contexts/PreferencesContext';
import {
  useZmanDetails,
  useUpdateZman,
  useCreateZman,
  usePreviewFormula,
  useValidateFormula,
  useZmanimList,
  usePublisherZmanTags,
  type PreviewResult,
} from '@/lib/hooks/useZmanimList';

// localStorage key prefix for preview locality (per-publisher) - matches algorithm page
const PREVIEW_LOCALITY_KEY_PREFIX = 'zmanim-preview-locality-';
// localStorage key prefix for preview date
const PREVIEW_DATE_KEY = 'zmanim-preview-date';

interface PreviewLocation {
  latitude: number;
  longitude: number;
  timezone: string;
  displayName: string;
}

interface LocalityDetails {
  locality_id: number;
  name: string;
  ascii_name: string;
  country_id: number;
  country_name: string;
  region_id?: number;
  region_name?: string;
  latitude: number;
  longitude: number;
  timezone: string;
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

  // Editor state
  const [mode, setMode] = useState<EditorMode>('guided');
  const [hebrewName, setHebrewName] = useState('');
  const [englishName, setEnglishName] = useState('');
  const [formula, setFormula] = useState('');
  const [aiExplanation, setAiExplanation] = useState('');
  const [publisherComment, setPublisherComment] = useState('');
  const [copiedFormula, setCopiedFormula] = useState(false);

  // API client - must be declared before useEffect that uses it
  const api = useApi();

  // Preview state - locality ID and coordinates
  const [previewLocalityId, setPreviewLocalityId] = useState<number | null>(null);
  const [previewLocation, setPreviewLocation] = useState<PreviewLocation | null>(null);
  const [previewDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedDate = localStorage.getItem(PREVIEW_DATE_KEY);
      if (savedDate) return savedDate;
    }
    return new Date().toISOString().split('T')[0];
  });
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [showWeeklyDialog, setShowWeeklyDialog] = useState(false);
  const [showTagEditorDialog, setShowTagEditorDialog] = useState(false);

  // Preferences for language
  usePreferences();

  // Fetch tags for this zman (for display in the button)
  const { data: zmanTags = [] } = usePublisherZmanTags(isNewZman ? null : zmanKey);

  // Load locality from cookies/localStorage, then fetch coordinates - matches algorithm page logic
  useEffect(() => {
    if (typeof window === 'undefined' || !selectedPublisher?.id) return;

    let localityIdToFetch: number | null = null;
    let localityName: string | null = null;

    // Priority 1: Check cookies (used by algorithm page's PreviewToolbar)
    const cookieLocalityId = document.cookie
      .split('; ')
      .find(row => row.startsWith('zmanim_preview_algorithm_locality_id='))
      ?.split('=')[1];
    const cookieLocalityName = document.cookie
      .split('; ')
      .find(row => row.startsWith('zmanim_preview_algorithm_locality_name='))
      ?.split('=')[1];

    if (cookieLocalityId) {
      const parsedId = parseInt(cookieLocalityId, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        localityIdToFetch = parsedId;
        localityName = cookieLocalityName ? decodeURIComponent(cookieLocalityName) : null;
      }
    }

    // Priority 2: Fallback to localStorage (legacy)
    if (!localityIdToFetch) {
      const savedKey = PREVIEW_LOCALITY_KEY_PREFIX + selectedPublisher.id;
      const saved = localStorage.getItem(savedKey);

      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.id === 'number' && parsed.id > 0) {
            localityIdToFetch = parsed.id;
            localityName = parsed.displayName || null;
          }
        } catch {
          // Invalid JSON, ignore
        }
      }
    }

    // Priority 3: Fetch publisher's default locality from settings
    if (!localityIdToFetch) {
      api.get<{ default_locality_id?: number; default_locality_name?: string }>('/publisher/settings')
        .then(settings => {
          if (settings.default_locality_id) {
            setPreviewLocalityId(settings.default_locality_id);
            // Fetch coordinates for the default locality
            return api.public.get<LocalityDetails>(`/localities/${settings.default_locality_id}`);
          }
          return null;
        })
        .then(locality => {
          if (locality) {
            setPreviewLocation({
              latitude: locality.latitude,
              longitude: locality.longitude,
              timezone: locality.timezone,
              displayName: locality.name || locality.ascii_name
            });
          }
        })
        .catch(() => {
          // If all else fails, leave null - user will need to select a location
        });
      return;
    }

    // If we have a locality ID from cookies/localStorage, fetch its coordinates
    // Set ID first, then fetch coordinates asynchronously
    const fetchLocality = async () => {
      setPreviewLocalityId(localityIdToFetch);
      try {
        const locality = await api.public.get<LocalityDetails>(`/localities/${localityIdToFetch}`);
        setPreviewLocation({
          latitude: locality.latitude,
          longitude: locality.longitude,
          timezone: locality.timezone,
          displayName: localityName || locality.name || locality.ascii_name
        });
      } catch {
        // If locality fetch fails, clear the invalid ID and try default
        setPreviewLocalityId(null);
      }
    };
    fetchLocality();
  }, [selectedPublisher?.id, api]);

  // Fetch data
  const { data: zman, isLoading: loadingZman } = useZmanDetails(isNewZman ? null : zmanKey);
  const { data: allZmanim = [] } = useZmanimList({ localityId: previewLocalityId });
  const updateZman = useUpdateZman(zmanKey);
  const createZman = useCreateZman();
  const previewFormula = usePreviewFormula();
  const validateFormula = useValidateFormula();

  // Load existing zman data when zman changes
  const prevZmanKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (zman && prevZmanKeyRef.current !== zman.zman_key) {
      prevZmanKeyRef.current = zman.zman_key;
      // Batch state updates asynchronously to avoid React hook warnings
      queueMicrotask(() => {
        setHebrewName(zman.hebrew_name);
        setEnglishName(zman.english_name);
        setFormula(zman.formula_dsl);
        setAiExplanation(zman.ai_explanation || '');
        setPublisherComment(zman.publisher_comment || '');
      });
    }
  }, [zman]);

  // Track changes - compute derived state instead of using useEffect
  const hasChanges = useMemo(() => {
    if (!zman) return false;
    return (
      hebrewName !== zman.hebrew_name ||
      englishName !== zman.english_name ||
      formula !== zman.formula_dsl ||
      aiExplanation !== (zman.ai_explanation || '') ||
      publisherComment !== (zman.publisher_comment || '')
    );
  }, [hebrewName, englishName, formula, aiExplanation, publisherComment, zman]);

  // Parse formula to determine if guided mode is available - compute derived state
  const formulaParseResult = useMemo(() => {
    if (!formula.trim()) {
      return null; // Empty formula - guided mode is available
    }
    return parseFormula(formula);
  }, [formula]);

  // Derived state for guided mode availability
  const guidedModeAvailable = formulaParseResult === null || formulaParseResult.success;

  // Auto-switch to advanced if formula becomes complex while in guided mode
  // Using queueMicrotask to defer state update and avoid React hook warning
  useEffect(() => {
    if (formulaParseResult && !formulaParseResult.success) {
      queueMicrotask(() => {
        setMode((currentMode) => currentMode === 'guided' ? 'advanced' : currentMode);
      });
    }
  }, [formulaParseResult]);

  // Live preview with debounce
  // Note: previewFormula.mutateAsync is stable, so we don't include the mutation object itself
  useEffect(() => {
    if (!formula.trim() || !previewLocation) {
      queueMicrotask(() => setPreviewResult(null));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- previewFormula.mutateAsync is stable
  }, [formula, previewDate, previewLocation, allZmanim]);

  // Handle resize
  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      setLeftWidth(Math.min(Math.max(newWidth, 30), 70));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

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

      // Wait for cache invalidation to complete before redirecting
      // This ensures the main algorithm page shows updated data immediately
      router.push('/publisher/algorithm');
    } catch (error) {
      console.error('[Save] Error:', error);
      toast.error(isNewZman ? 'Failed to create zman' : 'Failed to update zman');
    }
  };

  // Handle parse error from formula builder - no-op since useEffect already handles mode switching
  // Keep callback to satisfy FormulaBuilder's prop type, but don't double-switch modes
  const handleParseError = useCallback(() => {
    // Mode switching is handled by the formula parsing useEffect above
    // This callback exists only to satisfy FormulaBuilder's interface
  }, []);

  // Get zman keys for autocomplete
  const zmanimKeys = (allZmanim || []).map(z => z.zman_key);

  // Build references map for formula preview (memoized)
  const formulaReferences = useMemo(() => {
    const refMatches = formula.match(/@([a-zA-Z_][a-zA-Z0-9_]*)/g) || [];
    const refs: Record<string, string> = {};
    for (const match of refMatches) {
      const key = match.substring(1); // Remove @ prefix
      const referencedZman = allZmanim.find(z => z.zman_key === key);
      if (referencedZman?.formula_dsl) {
        refs[key] = referencedZman.formula_dsl;
      }
    }
    return Object.keys(refs).length > 0 ? refs : undefined;
  }, [formula, allZmanim]);

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
          {/* Edit Tags */}
          {!isNewZman && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTagEditorDialog(true)}
            >
              <Tags className="h-4 w-4 mr-2" />
              Edit Tags
              {zmanTags.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {zmanTags.length}
                </Badge>
              )}
            </Button>
          )}
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

            {/* Formula Editor */}
            {mode === 'guided' ? (
              <FormulaBuilder
                initialFormula={formula}
                onChange={setFormula}
                onParseError={handleParseError}
                localityId={previewLocalityId}
              />
            ) : (
              <>
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
                <Card className="border-2 border-primary/30 bg-gradient-to-br from-card to-primary/5">
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
                          {previewDate} • {previewLocation?.displayName || 'Loading location...'}
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

                {/* AI Generate Panel - at the bottom */}
                <AIGeneratePanel
                  onAccept={(generatedFormula) => setFormula(generatedFormula)}
                  onEdit={(generatedFormula) => setFormula(generatedFormula)}
                />
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
          {/* Formula Deviation Indicator - shown at top of right panel */}
          {zman?.source_formula_dsl && formula !== zman.source_formula_dsl && (
            <div className="p-4 border-b bg-amber-50 dark:bg-amber-950/30">
              <div className="rounded-lg border border-amber-500/50 px-4 py-3">
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
            </div>
          )}

          {mode === 'advanced' ? (
            /* DSL Reference Panel for Advanced Mode */
            <DSLReferencePanel
              onInsert={handleInsertAtCursor}
              onSetFormula={setFormula}
              currentFormula={formula}
              zmanimKeys={zmanimKeys}
              className="flex-1"
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
              <Card className="border-2 border-primary/30 bg-gradient-to-br from-card to-primary/5">
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
                        {previewDate} • {previewLocation?.displayName || 'Loading location...'}
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

            </div>
          )}
        </div>
      </div>

      {/* Weekly Preview Dialog */}
      {previewLocation && (
        <WeeklyPreviewDialog
          open={showWeeklyDialog}
          onOpenChange={setShowWeeklyDialog}
          formula={formula}
          location={previewLocation}
          zmanName={englishName || zman?.english_name}
          references={formulaReferences}
        />
      )}

      {/* Tag Editor Dialog */}
      {!isNewZman && (
        <TagEditorDialog
          zmanKey={zmanKey}
          currentTags={zmanTags}
          open={showTagEditorDialog}
          onOpenChange={setShowTagEditorDialog}
          onTagsUpdated={() => {
            // Tags will auto-refresh via React Query invalidation
            toast.success('Tags updated successfully');
          }}
        />
      )}
    </div>
  );
}
