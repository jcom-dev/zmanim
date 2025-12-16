/**
 * @file PrimitivesTable.tsx
 * @purpose Shared astronomical primitives display component with detailed info dialogs
 * @pattern shared-component
 * @dependencies useApi, ColorBadge, Dialog
 * @compliance useApi:✓ design-tokens:✓
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useApi } from '@/lib/api-client';
import { Sun, Sunrise, Moon, Clock, Loader2, Info, BookOpen, Calculator, FlaskConical, Copy, Check, ExternalLink, Code, ChevronDown, ChevronUp, FileText, Scale } from 'lucide-react';
import { getPrimitiveDocumentation, type PrimitiveDocumentation } from '@/lib/primitives-documentation';
import { handleApiError } from '@/lib/utils/errorHandler';
import { PreviewToolbar } from '@/components/shared/PreviewToolbar';
import { usePreviewToolbar } from '@/lib/hooks/usePreviewToolbar';
import { formatTimeTo12Hour } from '@/lib/utils/time-format';
import { useQuery } from '@tanstack/react-query';

interface AstronomicalPrimitive {
  id: string;
  variable_name: string;
  display_name: string;
  description?: string;
  formula_dsl: string;
  category: string;
  sort_order: number;
}

interface PrimitivesGrouped {
  category: string;
  display_name: string;
  primitives: AstronomicalPrimitive[];
}

interface PrimitivePreviewData {
  variable_name: string;
  time: string; // HH:mm:ss exact time
  time_rounded: string; // HH:mm:ss rounded
  time_display: string; // HH:mm display format
}

interface PrimitivesPreviewResponse {
  date: string;
  locality_id: number;
  locality_name: string;
  primitives: PrimitivePreviewData[];
}

const categoryIcons: Record<string, React.ReactNode> = {
  horizon: <Sunrise className="w-5 h-5" />,
  civil_twilight: <Sun className="w-5 h-5" />,
  nautical_twilight: <Sun className="w-5 h-5 opacity-70" />,
  astronomical_twilight: <Moon className="w-5 h-5" />,
  solar_position: <Clock className="w-5 h-5" />,
};

const categoryColors: Record<string, string> = {
  horizon: 'border-l-amber-500 bg-amber-500/10',
  civil_twilight: 'border-l-orange-500 bg-orange-500/10',
  nautical_twilight: 'border-l-blue-500 bg-blue-500/10',
  astronomical_twilight: 'border-l-indigo-500 bg-indigo-500/10',
  solar_position: 'border-l-yellow-500 bg-yellow-500/10',
};

// Helper to format algorithm steps into a collapsible section
function AlgorithmSection({ doc }: { doc: PrimitiveDocumentation }) {
  const [expanded, setExpanded] = useState(false);
  const algorithm = doc.algorithm;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-semibold text-foreground w-full hover:text-primary transition-colors"
      >
        <Code className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
        Algorithm: {algorithm.name}
        {expanded ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
      </button>

      {expanded && (
        <div className="p-4 bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900 rounded-lg space-y-4">
          {/* Source Link */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Source:</span>
            {algorithm.sourceUrl ? (
              <a
                href={algorithm.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
              >
                {algorithm.source}
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-foreground">{algorithm.source}</span>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-foreground">{algorithm.description}</p>

          {/* Algorithm Steps */}
          <div className="space-y-2">
            <h5 className="text-sm font-semibold text-foreground">Calculation Steps:</h5>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              {algorithm.steps.map((step) => (
                <li key={step.step} className="text-foreground">
                  {step.description}
                  {step.formula && (
                    <code className="block ml-6 mt-1 p-2 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono overflow-x-auto">
                      {step.formula}
                    </code>
                  )}
                  {step.notes && (
                    <span className="block ml-6 mt-1 text-xs text-muted-foreground italic">{step.notes}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {/* Math Formulas */}
          {algorithm.mathFormulas && algorithm.mathFormulas.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold text-foreground">Key Formulas:</h5>
              <div className="space-y-2">
                {algorithm.mathFormulas.slice(0, 4).map((formula, idx) => (
                  <div key={idx} className="p-2 bg-slate-100 dark:bg-slate-800 rounded">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">{formula.name}:</span>
                    </div>
                    <code className="block mt-1 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
                      {formula.plain}
                    </code>
                    <p className="mt-1 text-xs text-muted-foreground">{formula.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Constants */}
          {algorithm.constants && Object.keys(algorithm.constants).length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold text-foreground">Constants Used:</h5>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(algorithm.constants).map(([name, info]) => (
                  <div key={name} className="flex items-baseline gap-2 text-xs">
                    <span className="font-semibold text-foreground">{name}:</span>
                    <code className="text-cyan-600 dark:text-cyan-400">{info.value}</code>
                    <span className="text-muted-foreground">— {info.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Elevation Adjustment */}
          {algorithm.elevationAdjustment && (
            <div className="text-xs text-muted-foreground border-t border-cyan-200 dark:border-cyan-800 pt-2">
              <span className="font-semibold">Elevation Adjustment:</span> {algorithm.elevationAdjustment}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PrimitiveDetailDialogProps {
  primitive: AstronomicalPrimitive | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PrimitiveDetailDialog({ primitive, open, onOpenChange }: PrimitiveDetailDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!primitive) return null;

  const doc = getPrimitiveDocumentation(primitive.variable_name);

  const handleCopy = () => {
    navigator.clipboard.writeText(`@${primitive.variable_name}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {categoryIcons[primitive.category]}
            <div>
              <DialogTitle className="text-xl">{primitive.display_name}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <code className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded text-sm font-mono font-semibold">
                  @{primitive.variable_name}
                </code>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={handleCopy}
                    >
                      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{copied ? 'Copied!' : 'Copy variable name'}</TooltipContent>
                </Tooltip>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Hebrew Name (if available) */}
          {doc?.hebrewName && (
            <div className="p-3 bg-linear-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-hebrew text-amber-800 dark:text-amber-200">{doc.hebrewName}</span>
                {doc.hebrewText && <span className="text-sm text-amber-600 dark:text-amber-400">{doc.hebrewText}</span>}
              </div>
            </div>
          )}

          {/* Description from DB */}
          {primitive.description && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-foreground">{primitive.description}</p>
            </div>
          )}

          {/* DSL Formula */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Calculator className="w-4 h-4 text-primary" />
              DSL Formula
            </div>
            <div className="p-3 bg-muted rounded-lg font-mono text-sm">
              {primitive.formula_dsl}
            </div>
          </div>

          {doc ? (
            <>
              {/* Scientific Explanation */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FlaskConical className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Scientific Explanation
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg space-y-3">
                  <p className="text-sm text-foreground leading-relaxed">{doc.scientificExplanation}</p>
                  {doc.astronomicalDefinition && (
                    <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800">
                      <p className="text-xs text-muted-foreground"><span className="font-semibold">Astronomical Definition:</span> {doc.astronomicalDefinition}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Algorithm Section (Collapsible) */}
              <AlgorithmSection doc={doc} />

              {/* Halachic Significance */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Scale className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Halachic Significance
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg">
                  <p className="text-sm text-foreground leading-relaxed">{doc.halachicSignificance}</p>
                </div>
              </div>

              {/* Halachic Sources */}
              {doc.halachicSources && doc.halachicSources.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    Halachic Sources
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-lg">
                    <ul className="space-y-2">
                      {doc.halachicSources.map((source, idx) => (
                        <li key={idx} className="text-sm">
                          <span className="font-semibold text-purple-800 dark:text-purple-200">{source.source}</span>
                          {source.reference && <span className="text-purple-600 dark:text-purple-400"> ({source.reference})</span>}
                          {source.url ? (
                            <a href={source.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-purple-600 dark:text-purple-400 hover:underline">
                              <ExternalLink className="w-3 h-3 inline" />
                            </a>
                          ) : null}
                          <p className="text-muted-foreground mt-0.5">{source.description}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Practical Notes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Info className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  Practical Notes
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                  <p className="text-sm text-foreground leading-relaxed">{doc.practicalNotes}</p>
                  {doc.accuracy && (
                    <p className="text-xs text-muted-foreground"><span className="font-semibold">Accuracy:</span> {doc.accuracy}</p>
                  )}
                  {doc.edgeCases && (
                    <p className="text-xs text-muted-foreground"><span className="font-semibold">Edge Cases:</span> {doc.edgeCases}</p>
                  )}
                </div>
              </div>

              {/* Authoritative Links */}
              {doc.authoritativeLinks && doc.authoritativeLinks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Authoritative References
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg">
                    <ul className="space-y-2">
                      {doc.authoritativeLinks.map((link, idx) => (
                        <li key={idx} className="text-sm">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-blue-700 dark:text-blue-300 hover:underline flex items-center gap-1"
                          >
                            {link.title}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <p className="text-muted-foreground text-xs">{link.description}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">
                Detailed documentation for this primitive is not yet available.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface PrimitivesTableProps {
  title?: string;
  description?: string;
}

/**
 * PrimitivesTable - Shared component displaying astronomical primitives
 *
 * Used by both admin and publisher primitives pages.
 * Fetches data from public registry endpoint.
 * Click on any primitive to see detailed scientific and halachic information.
 */
export function PrimitivesTable({
  title = 'Astronomical Primitives',
  description = 'Core astronomical times used as building blocks for zmanim calculations.',
}: PrimitivesTableProps) {
  const api = useApi();
  const [groupedPrimitives, setGroupedPrimitives] = useState<PrimitivesGrouped[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPrimitive, setSelectedPrimitive] = useState<AstronomicalPrimitive | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Use PreviewToolbar hook for state management
  const toolbar = usePreviewToolbar({
    storageKey: 'primitives',
  });

  // Fetch preview data for selected locality and date
  const {
    data: previewData,
    isLoading: previewLoading,
  } = useQuery<PrimitivesPreviewResponse>({
    queryKey: ['primitives-preview', toolbar.localityId, toolbar.date],
    queryFn: async () => {
      if (!toolbar.localityId) {
        throw new Error('No locality selected');
      }
      const response = await api.public.get<PrimitivesPreviewResponse>(
        `/registry/primitives/preview?locality_id=${toolbar.localityId}&date=${toolbar.date}`
      );
      return response;
    },
    enabled: !!toolbar.localityId && !!toolbar.date,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Create a map of variable_name -> preview data for easy lookup
  const previewMap = new Map<string, PrimitivePreviewData>();
  if (previewData?.primitives) {
    for (const p of previewData.primitives) {
      previewMap.set(p.variable_name, p);
    }
  }

  // Always show seconds for primitives (as requested by user)
  const showSeconds = true;

  const fetchPrimitives = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.public.get<PrimitivesGrouped[]>('/registry/primitives/grouped');
      setGroupedPrimitives(data || []);
    } catch (err) {
      handleApiError(err, 'Failed to load primitives');
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchPrimitives();
  }, [fetchPrimitives]);

  const handlePrimitiveClick = (primitive: AstronomicalPrimitive) => {
    setSelectedPrimitive(primitive);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-1">Loading...</p>
        </div>
        <div className="flex justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        </div>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        <p className="text-muted-foreground mt-1">
          {description}{' '}
          Use <code className="text-xs bg-muted px-1 rounded">@variable_name</code> in DSL formulas.
          Click any primitive for detailed information.
        </p>
      </div>

      {/* Preview Toolbar */}
      <PreviewToolbar
        storageKey="primitives"
        restrictToCoverage={false}
        showCoverageIndicator={false}
        showDatePicker={true}
        showLanguageToggle={true}
      />

      {/* Loading indicator when fetching preview data */}
      {previewLoading && toolbar.hasLocation && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Calculating times...
        </div>
      )}

      {/* No location selected message */}
      {!toolbar.hasLocation && (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Select a location to preview calculated times for all primitives
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>
            {groupedPrimitives.reduce((acc, g) => acc + g.primitives.length, 0)} astronomical primitives
            across {groupedPrimitives.length} categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {groupedPrimitives.map((group) => (
              <div key={group.category} className={`p-4 rounded-lg border-l-4 ${categoryColors[group.category] || 'border-l-muted bg-muted/50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {categoryIcons[group.category]}
                  <span className="font-medium text-sm text-foreground">{group.display_name}</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{group.primitives.length}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Primitives by Category */}
      {groupedPrimitives.map((group) => (
        <Card key={group.category}>
          <CardHeader>
            <div className="flex items-center gap-3">
              {categoryIcons[group.category]}
              <div>
                <CardTitle>{group.display_name}</CardTitle>
                <CardDescription>
                  {group.primitives.length} primitive{group.primitives.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="border-b border-border">
                  <tr className="text-left text-sm">
                    <th className="pb-3 font-semibold text-foreground w-[200px]">DSL Variable</th>
                    <th className="pb-3 font-semibold text-foreground">Name</th>
                    <th className="pb-3 font-semibold text-foreground w-[140px]">Time</th>
                    <th className="pb-3 font-semibold text-foreground w-[60px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {group.primitives.map((primitive) => {
                    const previewData = previewMap.get(primitive.variable_name);
                    const timeToDisplay = previewData
                      ? (showSeconds ? previewData.time : previewData.time_rounded)
                      : null;
                    const formattedTime = timeToDisplay
                      ? formatTimeTo12Hour(timeToDisplay, showSeconds)
                      : null;

                    return (
                      <tr
                        key={primitive.id}
                        className="border-b border-border hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => handlePrimitiveClick(primitive)}
                      >
                        <td className="py-3 pr-4 w-[200px]">
                          <code className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded text-sm font-mono font-semibold">
                            @{primitive.variable_name}
                          </code>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-foreground font-medium">{primitive.display_name}</span>
                            {primitive.description && (
                              <span className="text-sm text-muted-foreground max-w-md line-clamp-1">
                                {primitive.description}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4 w-[140px]">
                          {formattedTime ? (
                            <div className="font-mono text-sm font-medium text-foreground">
                              {formattedTime}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 w-[60px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 px-2">
                                <Info className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View details</TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Detail Dialog */}
      <PrimitiveDetailDialog
        primitive={selectedPrimitive}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
