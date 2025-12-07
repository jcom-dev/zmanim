/**
 * @file ZmanCard.tsx
 * @purpose Individual zman display - versioning, aliasing, actions
 * @pattern client-component
 * @dependencies useApi, Badge, Dialog (shadcn)
 * @frequency high - 884 lines, reused 30+ times
 * @compliance Check docs/adr/ for pattern rationale
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ColorBadge, getTagTypeColor } from '@/components/ui/color-badge';
import { HighlightedFormula } from '@/components/shared/HighlightedFormula';
import {
  PublisherZman,
  useUpdateZman,
  useDeleteZman,
  useZmanVersionHistory,
  useRollbackZmanVersion,
  ZmanVersion,
} from '@/lib/hooks/useZmanimList';
import {
  Pencil,
  Trash2,
  Globe,
  CircleDashed,
  History,
  RotateCcw,
  Loader2,
  Eye,
  EyeOff,
  Link2,
  Copy,
  Library,
  AlertTriangle,
  FlaskConical,
  Edit2,
  Code2,
  X,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ZmanTagEditor } from './ZmanTagEditor';

// Infer tags from the formula DSL (same logic as Registry page)
interface InferredTags {
  shita?: string;
  method?: string;
  relative?: string; // e.g., "before sunset", "after sunrise"
  baseTime?: string; // the base astronomical event
}

function inferTagsFromFormula(formula: string): InferredTags {
  const result: InferredTags = {};

  // Check for shita
  if (formula.includes('gra') || formula.includes(', gra)')) {
    result.shita = 'GRA';
  } else if (formula.includes('mga') || formula.includes(', mga)')) {
    result.shita = 'MGA';
  } else if (formula.includes('alos_16_1')) {
    result.shita = '16.1°';
  }

  // Check for calculation method
  if (formula.includes('proportional_hours(')) {
    result.method = 'Proportional Hours';
  } else if (formula.includes('solar(')) {
    result.method = 'Solar Angle';
  } else if (/\d+\s*min/.test(formula)) {
    result.method = 'Fixed Minutes';
  }

  // Detect base time and before/after
  const baseTimePatterns = [
    { pattern: /sunset/i, name: 'sunset' },
    { pattern: /sunrise/i, name: 'sunrise' },
    { pattern: /chatzos/i, name: 'chatzos' },
    { pattern: /tzais/i, name: 'tzais' },
    { pattern: /alos/i, name: 'alos' },
  ];

  for (const { pattern, name } of baseTimePatterns) {
    if (pattern.test(formula)) {
      result.baseTime = name;
      // Check if before (-) or after (+)
      if (formula.includes('-') && /\d+\s*min/.test(formula)) {
        result.relative = `before ${name}`;
      } else if (formula.includes('+') && /\d+\s*min/.test(formula)) {
        result.relative = `after ${name}`;
      }
      break;
    }
  }

  return result;
}


/**
 * Get the source name for a zman (Registry or linked publisher name)
 */
function getSourceName(zman: PublisherZman): string | null {
  if (zman.is_linked && zman.linked_source_publisher_name) {
    return zman.linked_source_publisher_name;
  }
  // All zmanim come from either the registry or another publisher
  if (zman.source_type === 'registry' || zman.source_type === 'copied') {
    return 'Registry';
  }
  // If linked but no publisher name (shouldn't happen), fallback
  if (zman.source_type === 'linked') {
    return 'Linked Publisher';
  }
  return null;
}

/**
 * Check if the zman names have been modified from source
 */
function hasNameModifications(zman: PublisherZman): {
  hebrewModified: boolean;
  englishModified: boolean;
  anyModified: boolean;
} {
  const hebrewModified = zman.source_hebrew_name != null && zman.hebrew_name !== zman.source_hebrew_name;
  const englishModified = zman.source_english_name != null && zman.english_name !== zman.source_english_name;
  return {
    hebrewModified,
    englishModified,
    anyModified: hebrewModified || englishModified,
  };
}

/**
 * Normalize formula for comparison (handles whitespace differences)
 */
function normalizeFormula(formula: string): string {
  return formula
    .replace(/\s+/g, ' ')     // Collapse multiple spaces to single
    .replace(/\s*,\s*/g, ', ') // Normalize comma spacing
    .replace(/\s*\(\s*/g, '(') // No space after opening paren
    .replace(/\s*\)\s*/g, ')') // No space before closing paren
    .trim();
}

/**
 * Check if the zman formula has been modified from source
 */
function hasFormulaModification(zman: PublisherZman): boolean {
  if (zman.source_formula_dsl == null) return false;
  // Normalize both formulas before comparison to handle whitespace differences
  return normalizeFormula(zman.formula_dsl) !== normalizeFormula(zman.source_formula_dsl);
}

interface ZmanCardProps {
  zman: PublisherZman;
  category: 'essential' | 'optional';
  onEdit?: (zmanKey: string) => void;
  displayLanguage?: 'hebrew' | 'english' | 'both';
  allZmanim?: PublisherZman[];
}

/**
 * ZmanCard - Displays a single zman with quick actions
 *
 * Features:
 * - Bilingual name display (Hebrew • English)
 * - Syntax-highlighted formula
 * - Dependency badges
 * - Quick action buttons (Edit, Toggle Visibility, Delete)
 * - Drag handle for reordering
 */
export function ZmanCard({ zman, category, onEdit, displayLanguage = 'both', allZmanim = [] }: ZmanCardProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<ZmanVersion | null>(null);

  const updateZman = useUpdateZman(zman.zman_key);
  const deleteZman = useDeleteZman();

  // Find zmanim that depend on this one (have this zman_key in their dependencies)
  const dependentZmanim = allZmanim.filter(
    (z) => z.zman_key !== zman.zman_key && z.dependencies?.includes(zman.zman_key)
  );
  const hasDependents = dependentZmanim.length > 0;
  const { data: versionHistory, isLoading: historyLoading } = useZmanVersionHistory(
    showHistoryDialog ? zman.zman_key : null
  );
  const rollbackVersion = useRollbackZmanVersion(zman.zman_key);

  // Check for name and formula modifications from source
  const nameModifications = hasNameModifications(zman);
  const formulaModified = hasFormulaModification(zman);
  const sourceName = getSourceName(zman);

  const handleEdit = () => {
    if (onEdit) {
      onEdit(zman.zman_key);
    } else {
      router.push(`/publisher/algorithm/edit/${zman.zman_key}`);
    }
  };

  const handleTogglePublished = async () => {
    await updateZman.mutateAsync({
      is_published: !zman.is_published,
    });
  };

  const handleToggleCategory = async () => {
    const newCategory = zman.category === 'essential' ? 'optional' : 'essential';
    try {
      await updateZman.mutateAsync({
        category: newCategory,
      });
    } catch (error: unknown) {
      console.error('Failed to update category:', error);
    }
  };

  const handleToggleEnabled = async () => {
    await updateZman.mutateAsync({
      is_enabled: !zman.is_enabled,
    });
  };

  const handleToggleVisible = async () => {
    await updateZman.mutateAsync({
      is_visible: !zman.is_visible,
    });
  };

  const handleToggleBeta = async () => {
    await updateZman.mutateAsync({
      is_beta: !zman.is_beta,
    });
  };

  // Revert name to source
  const handleRevertNames = async () => {
    const updates: { hebrew_name?: string; english_name?: string } = {};
    if (nameModifications.hebrewModified && zman.source_hebrew_name) {
      updates.hebrew_name = zman.source_hebrew_name;
    }
    if (nameModifications.englishModified && zman.source_english_name) {
      updates.english_name = zman.source_english_name;
    }
    if (Object.keys(updates).length > 0) {
      await updateZman.mutateAsync(updates);
    }
  };

  // Revert formula to source
  const handleRevertFormula = async () => {
    if (zman.source_formula_dsl) {
      await updateZman.mutateAsync({
        formula_dsl: zman.source_formula_dsl,
      });
    }
  };

  const handleDelete = async () => {
    await deleteZman.mutateAsync(zman.zman_key);
    setShowDeleteDialog(false);
  };

  const handleRollback = async (version: ZmanVersion) => {
    await rollbackVersion.mutateAsync({ version_number: version.version_number });
    setShowHistoryDialog(false);
    setSelectedVersion(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Use zman.category for actual state (not the prop which is for grid styling)
  const isEssential = zman.category === 'essential';
  const isOptional = zman.category === 'optional';

  return (
    <>
      <Card
        className={`
          hover:border-primary/50 transition-colors group
          ${!zman.is_enabled ? 'opacity-60' : ''}
          ${!zman.is_visible ? 'border-dashed border-muted-foreground/30' : ''}
          ${zman.is_beta ? 'border-amber-400 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-950/20' : ''}
          ${formulaModified && !zman.is_beta ? 'border-l-4 border-l-amber-500 dark:border-l-amber-400' : ''}
        `}
      >
        <CardHeader className="pb-3">
          {/* Mobile: Actions on top, then title | Desktop: Title left, actions right */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
            {/* Left: Name and Dependencies */}
            <div className="flex-1 min-w-0">
              {/* Name - respects displayLanguage setting, shows modification indicator */}
              <div className="flex items-start gap-2 mb-2">
                <h3 className={`text-base sm:text-lg font-semibold leading-tight flex-1 ${displayLanguage === 'hebrew' ? 'font-hebrew' : ''}`}>
                  {displayLanguage === 'hebrew' ? (
                    <span className={nameModifications.hebrewModified ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'}>
                      {zman.hebrew_name}
                    </span>
                  ) : displayLanguage === 'english' ? (
                    <span className={nameModifications.englishModified ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'}>
                      {zman.english_name}
                    </span>
                  ) : (
                    <>
                      <span className={`block sm:inline font-hebrew ${nameModifications.hebrewModified ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'}`}>
                        {zman.hebrew_name}
                      </span>
                      <span className="text-muted-foreground mx-0 sm:mx-2 hidden sm:inline">•</span>
                      <span className={`block sm:inline ${nameModifications.englishModified ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'}`}>
                        {zman.english_name}
                      </span>
                    </>
                  )}
                </h3>

                {/* Modified indicator with revert - only shows when names have been changed */}
                {nameModifications.anyModified && sourceName && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRevertNames}
                          disabled={updateZman.isPending}
                          className="h-7 px-2 gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-900/50 flex-shrink-0"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span className="text-xs font-medium">Modified</span>
                          <RotateCcw className="h-3 w-3 ml-0.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <div className="text-sm space-y-1">
                          <p className="font-medium text-amber-600 dark:text-amber-400">
                            Name changed from {sourceName}
                          </p>
                          {nameModifications.hebrewModified && zman.source_hebrew_name && (
                            <p>
                              <span className="text-muted-foreground">Hebrew:</span>{' '}
                              <span className="font-hebrew">{zman.source_hebrew_name}</span>
                            </p>
                          )}
                          {nameModifications.englishModified && zman.source_english_name && (
                            <p>
                              <span className="text-muted-foreground">English:</span>{' '}
                              {zman.source_english_name}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground pt-1 border-t border-border mt-1">
                            Click to revert to {sourceName.toLowerCase()} names
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {/* Dependencies */}
              {zman.dependencies && zman.dependencies.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {zman.dependencies.map((dep) => (
                    <Badge key={dep} variant="outline" className="text-xs font-mono">
                      @{dep}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Status Toggles */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3">
                {/* Enabled/Disabled Toggle */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${!zman.is_enabled ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>
                    Enabled
                  </span>
                  <Switch
                    checked={zman.is_enabled}
                    onCheckedChange={handleToggleEnabled}
                    disabled={updateZman.isPending}
                  />
                </div>

                {/* Core/Optional Flag - clickable badge */}
                <Badge
                  variant={isEssential ? 'default' : 'outline'}
                  className={`cursor-pointer transition-colors select-none ${
                    isEssential
                      ? 'bg-primary hover:bg-primary/80'
                      : 'hover:bg-muted'
                  } ${updateZman.isPending ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={handleToggleCategory}
                  title={isEssential ? 'Click to mark as optional' : 'Click to mark as core'}
                >
                  {isEssential ? 'Core' : 'Optional'}
                </Badge>

                {/* Published Status Badge */}
                {zman.is_published ? (
                  <Badge className="text-xs bg-green-600 hover:bg-green-700">
                    Published
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                    Draft
                  </Badge>
                )}

                {/* Beta Status Badge - always visible, clickable to toggle */}
                <Badge
                  variant="outline"
                  className={`text-xs cursor-pointer transition-colors ${
                    zman.is_beta
                      ? 'bg-amber-100 text-amber-800 border-amber-400 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-600 font-medium'
                      : 'bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/50'
                  } ${updateZman.isPending ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={handleToggleBeta}
                  title={zman.is_beta ? 'Click to certify as stable' : 'Click to mark as beta'}
                >
                  <FlaskConical className={`h-3 w-3 mr-1 ${zman.is_beta ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`} />
                  {zman.is_beta ? 'Beta' : 'Stable'}
                </Badge>

                {/* Hidden Badge - when not visible to public */}
                {!zman.is_visible && (
                  <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/50">
                    <EyeOff className="h-3 w-3 mr-1" />
                    Hidden
                  </Badge>
                )}

                {/* Linked Status Badge - shows if zman is linked to another publisher */}
                {zman.is_linked && zman.linked_source_publisher_name && (
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      zman.linked_source_is_deleted
                        ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700'
                        : 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700'
                    }`}
                    title={
                      zman.linked_source_is_deleted
                        ? `Linked to ${zman.linked_source_publisher_name} (deleted)`
                        : `Linked to ${zman.linked_source_publisher_name}`
                    }
                  >
                    {zman.linked_source_is_deleted ? (
                      <AlertTriangle className="h-3 w-3 mr-1" />
                    ) : (
                      <Link2 className="h-3 w-3 mr-1" />
                    )}
                    {zman.linked_source_publisher_name}
                  </Badge>
                )}

                {/* Source Type Badge - shows how the zman was added */}
                {zman.source_type && !zman.is_linked && (
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      zman.source_type === 'registry'
                        ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700'
                        : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700'
                    }`}
                  >
                    {zman.source_type === 'registry' ? (
                      <>
                        <Library className="h-3 w-3 mr-1" />
                        Registry
                      </>
                    ) : zman.source_type === 'copied' ? (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copied
                      </>
                    ) : null}
                  </Badge>
                )}
              </div>

            </div>

            {/* Right: Quick Actions - top row centered on mobile, right side on desktop */}
            <div className="flex justify-center sm:justify-end gap-0.5 sm:gap-1 flex-shrink-0 w-full sm:w-auto">
              {/* Edit Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEdit}
                title="Edit formula"
                className="h-8 w-8"
              >
                <Pencil className="h-4 w-4" />
              </Button>

              {/* Toggle Published - shows globe icon */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleTogglePublished}
                title={zman.is_published ? 'Unpublish zman' : 'Publish zman'}
                className={`h-8 w-8 ${zman.is_published ? 'text-green-600 hover:text-green-700' : 'text-amber-600 hover:text-amber-700'}`}
                disabled={updateZman.isPending}
              >
                {zman.is_published ? (
                  <Globe className="h-4 w-4" />
                ) : (
                  <CircleDashed className="h-4 w-4" />
                )}
              </Button>

              {/* Toggle Visibility - hide from public display */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleVisible}
                title={zman.is_visible ? 'Hide from public display' : 'Show in public display'}
                className={`h-8 w-8 ${zman.is_visible ? 'text-foreground' : 'text-muted-foreground'}`}
                disabled={updateZman.isPending}
              >
                {zman.is_visible ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>

              {/* Toggle Beta - mark as beta/seeking feedback */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleBeta}
                title={zman.is_beta ? 'Certify as stable (remove beta)' : 'Mark as beta (seeking feedback)'}
                className={`h-8 w-8 ${zman.is_beta ? 'text-amber-600 hover:text-amber-700' : 'text-muted-foreground hover:text-amber-600'}`}
                disabled={updateZman.isPending}
              >
                <FlaskConical className="h-4 w-4" />
              </Button>

              {/* Version History */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHistoryDialog(true)}
                title="View version history"
                className="h-8 w-8"
              >
                <History className="h-4 w-4" />
              </Button>

              {/* Delete */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteDialog(true)}
                title="Delete zman"
                className="h-8 w-8 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Formula Display with Modification Indicator */}
          <div className="space-y-2">
            {/* Formula Modified Banner - prominent display */}
            {formulaModified && sourceName && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-amber-100/80 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700">
                <div className="flex items-center gap-2 min-w-0">
                  <Code2 className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Modified</span>
                  <span className="text-xs text-amber-600/80 dark:text-amber-400/80 truncate">
                    Original: <code className="font-mono">{zman.source_formula_dsl}</code>
                  </span>
                </div>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRevertFormula}
                        disabled={updateZman.isPending}
                        className="h-7 px-2 gap-1 text-amber-700 hover:text-amber-800 hover:bg-amber-200 dark:text-amber-300 dark:hover:text-amber-200 dark:hover:bg-amber-800/50 flex-shrink-0"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Revert</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Revert to {sourceName.toLowerCase()} formula
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <HighlightedFormula formula={zman.formula_dsl} />
              </div>
              {/* Inline Modified badge next to formula */}
              {formulaModified && (
                <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700 flex-shrink-0">
                  <Code2 className="h-3 w-3 mr-1" />
                  Modified
                </Badge>
              )}
            </div>
          </div>

          {/* Publisher Zman Tags - editable */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {zman.tags && zman.tags.map((tag) => (
              <ColorBadge
                key={tag.id}
                color={getTagTypeColor(tag.tag_type)}
                size="sm"
                className={tag.is_negated ? 'border-2 border-red-500 dark:border-red-400' : undefined}
              >
                {tag.is_negated && <X className="h-3 w-3 mr-1 text-red-500 dark:text-red-400" />}
                {tag.display_name_english}
              </ColorBadge>
            ))}
            <ZmanTagEditor
              zmanKey={zman.zman_key}
              currentTags={zman.tags || []}
            />
          </div>

          {/* Inferred Tags from Formula */}
          {(() => {
            const inferredTags = inferTagsFromFormula(zman.formula_dsl);
            const hasTags = inferredTags.shita || inferredTags.method || inferredTags.relative;
            if (!hasTags) return null;
            return (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {inferredTags.shita && (
                  <ColorBadge color="cyan" size="sm">
                    {inferredTags.shita}
                  </ColorBadge>
                )}
                {inferredTags.method && (
                  <ColorBadge color="violet" size="sm">
                    {inferredTags.method}
                  </ColorBadge>
                )}
                {inferredTags.relative && (
                  <ColorBadge color="pink" size="sm">
                    {inferredTags.relative}
                  </ColorBadge>
                )}
              </div>
            );
          })()}

          {/* AI Explanation (if exists) */}
          {zman.ai_explanation && (
            <div className="mt-3 p-3 bg-primary/5 rounded-md border border-primary/10">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-medium text-primary">AI:</span> {zman.ai_explanation}
              </p>
            </div>
          )}

          {/* Publisher Comment (if exists) */}
          {zman.publisher_comment && (
            <div className="mt-2 p-3 bg-muted/50 rounded-md">
              <p className="text-sm text-foreground leading-relaxed">
                {zman.publisher_comment}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${hasDependents ? 'text-amber-500' : 'text-destructive'}`} />
              {hasDependents ? 'Cannot Delete Zman' : 'Delete Zman?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {hasDependents ? (
                  <>
                    <p>
                      <strong>{zman.english_name}</strong> cannot be deleted because other zmanim depend on it.
                    </p>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-amber-800 dark:text-amber-200 text-sm">
                      <p className="font-medium mb-2">The following zmanim reference this one:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {dependentZmanim.map((dep) => (
                          <li key={dep.zman_key}>{dep.english_name}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Update or delete the dependent zmanim first, then try again.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Are you sure you want to delete <strong>{zman.english_name}</strong>?
                    </p>
                    {zman.is_published && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-amber-800 dark:text-amber-200 text-sm">
                        <strong>Warning:</strong> This zman is currently published. Deleting it will remove it from your public zmanim times.
                      </div>
                    )}
                    <div className="bg-muted/50 border border-border rounded-md p-3 text-sm">
                      <p className="text-muted-foreground">
                        You can restore this zman from the Deleted tab if needed.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {hasDependents ? (
              <AlertDialogCancel>Close</AlertDialogCancel>
            ) : (
              <>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Version History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>
              {zman.hebrew_name} • {zman.english_name}
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : versionHistory?.versions && versionHistory.versions.length > 0 ? (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {versionHistory.versions.map((version) => (
                  <div
                    key={version.id}
                    className={`
                      p-4 rounded-lg border
                      ${version.version_number === versionHistory.current_version
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'}
                    `}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={version.version_number === versionHistory.current_version ? 'default' : 'outline'}
                        >
                          v{version.version_number}
                        </Badge>
                        {version.version_number === versionHistory.current_version && (
                          <span className="text-xs text-primary font-medium">Current</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(version.created_at)}
                      </span>
                    </div>

                    <div className="text-sm font-mono bg-muted p-2 rounded mb-2 overflow-x-auto">
                      <code className="text-xs">{version.formula_dsl}</code>
                    </div>

                    {version.version_number !== versionHistory.current_version && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRollback(version)}
                        disabled={rollbackVersion.isPending}
                        className="mt-2"
                      >
                        {rollbackVersion.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RotateCcw className="h-3 w-3 mr-1" />
                        )}
                        Restore this version
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No version history available</p>
              <p className="text-xs mt-1">Changes to the formula will be tracked here</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * ZmanGrid - Grid layout for displaying multiple zman cards
 */
export function ZmanGrid({
  zmanim,
  category,
  onEdit,
  displayLanguage = 'both',
  allZmanim,
}: {
  zmanim: PublisherZman[];
  category: 'essential' | 'optional';
  onEdit?: (zmanKey: string) => void;
  displayLanguage?: 'hebrew' | 'english' | 'both';
  allZmanim?: PublisherZman[];
}) {
  if (zmanim.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No zmanim in this category</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {zmanim.map((zman) => (
        <ZmanCard key={zman.id} zman={zman} category={category} onEdit={onEdit} displayLanguage={displayLanguage} allZmanim={allZmanim} />
      ))}
    </div>
  );
}
