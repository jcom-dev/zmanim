/**
 * @file ZmanCard.tsx
 * @purpose Individual zman display - versioning, aliasing, actions
 * @pattern client-component
 * @dependencies useApi, Badge, Dialog (shadcn)
 * @frequency high - 884 lines, reused 30+ times
 * @compliance Check docs/adr/ for pattern rationale
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ColorBadge, getTagTypeColor } from '@/components/ui/color-badge';
import { cn } from '@/lib/utils';
import { HighlightedFormula } from '@/components/shared/HighlightedFormula';
import {
  PublisherZman,
  useUpdateZman,
  useDeleteZman,
  useZmanVersionHistory,
  useRollbackZmanVersion,
  useRevertPublisherZmanTags,
  ZmanVersion,
} from '@/lib/hooks/useZmanimList';
import {
  Pencil,
  Trash2,
  History,
  RotateCcw,
  Loader2,
  Eye,
  EyeOff,
  Link2,
  Library,
  AlertTriangle,
  FlaskConical,
  Code2,
  X,
  Power,
  Info,
  MessageSquare,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { RoundingModeToggle } from './RoundingModeToggle';
import { ZmanMetadataEditor } from './ZmanMetadataEditor';
import { MasterZmanDetailModal } from '@/components/registry/MasterZmanDetailModal';
import { useTagDisplayName } from '@/lib/hooks/usePublisherSettings';

/**
 * Get the source name for a zman (Registry or linked publisher name)
 */
function getSourceName(zman: PublisherZman): string | null {
  if (zman.is_linked && zman.linked_source_publisher_name) {
    return zman.linked_source_publisher_name;
  }
  // Not linked = from registry
  return 'Registry';
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

/**
 * Check if any tags have been modified from source (master registry)
 */
function hasTagModifications(zman: PublisherZman): {
  hasModified: boolean;
  modifiedTags: Array<{ tag_key: string; display_name_english: string; change: string }>;
} {
  const modifiedTags: Array<{ tag_key: string; display_name_english: string; change: string }> = [];

  if (!zman.tags) {
    return { hasModified: false, modifiedTags: [] };
  }

  // Check for tags with is_modified flag
  for (const tag of zman.tags) {
    if (tag.is_modified) {
      // Determine what changed
      let change = 'modified';
      if (tag.source_is_negated !== undefined && tag.source_is_negated !== null) {
        const currentState = tag.is_negated ? 'negated' : 'positive';
        const sourceState = tag.source_is_negated ? 'negated' : 'positive';
        if (currentState !== sourceState) {
          change = `Changed from ${sourceState} to ${currentState}`;
        }
      }

      modifiedTags.push({
        tag_key: tag.tag_key,
        display_name_english: tag.display_name_english,
        change,
      });
    }
  }

  return {
    hasModified: modifiedTags.length > 0,
    modifiedTags,
  };
}

interface ZmanCardProps {
  zman: PublisherZman;
  category: 'core' | 'optional' | 'hidden'; // For grid styling
  onEdit?: (zmanKey: string) => void;
  displayLanguage?: 'hebrew' | 'english' | 'both';
  allZmanim?: PublisherZman[];
  /** Pre-calculated time from API (format: "HH:MM:SS" or "HH:MM") */
  previewTime?: string | null;
  /** Compact view mode - hides secondary information */
  compact?: boolean;
  /** Whether this card should be highlighted (focused) */
  isFocused?: boolean;
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
export function ZmanCard({ zman, category, onEdit, displayLanguage = 'both', allZmanim = [], previewTime, compact = false, isFocused = false }: ZmanCardProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const getTagName = useTagDisplayName();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  const [showMasterZmanModal, setShowMasterZmanModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<ZmanVersion | null>(null);
  // Track which field is currently being updated to avoid flickering on unrelated buttons
  const [pendingField, setPendingField] = useState<string | null>(null);

  // Scroll into view when focused
  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isFocused]);

  const updateZman = useUpdateZman(zman.zman_key);
  const deleteZman = useDeleteZman();
  const revertTags = useRevertPublisherZmanTags(zman.zman_key);

  // Find zmanim that depend on this one (have this zman_key in their dependencies)
  const dependentZmanim = allZmanim.filter(
    (z) => z.zman_key !== zman.zman_key && z.dependencies?.includes(zman.zman_key)
  );
  const hasDependents = dependentZmanim.length > 0;
  const { data: versionHistory, isLoading: historyLoading } = useZmanVersionHistory(
    showHistoryDialog ? zman.zman_key : null
  );
  const rollbackVersion = useRollbackZmanVersion(zman.zman_key);

  // Check for name, formula, and tag modifications from source
  const nameModifications = hasNameModifications(zman);
  const formulaModified = hasFormulaModification(zman);
  const tagModifications = hasTagModifications(zman);
  const sourceName = getSourceName(zman);

  // Linked zmanim are not editable (they inherit from another publisher)
  const isEditable = !zman.is_linked;

  // Open DSL formula editor (full page)
  const handleEditDSL = () => {
    if (onEdit) {
      onEdit(zman.zman_key);
    } else {
      router.push(`/publisher/algorithm/edit/${zman.zman_key}`);
    }
  };

  // Open metadata editor modal (names, description, AI explanation)
  const handleEditMetadata = () => {
    setShowMetadataEditor(true);
  };

  const handleTogglePublished = async () => {
    setPendingField('is_published');
    try {
      await updateZman.mutateAsync({
        is_published: !zman.is_published,
      });
    } finally {
      setPendingField(null);
    }
  };

  const handleToggleEnabled = async () => {
    // If currently enabled, show confirmation dialog before disabling
    if (zman.is_enabled) {
      setShowDisableDialog(true);
      return;
    }
    // If disabled, enable directly without confirmation
    setPendingField('is_enabled');
    try {
      await updateZman.mutateAsync({
        is_enabled: true,
      });
    } finally {
      setPendingField(null);
    }
  };

  const handleConfirmDisable = async () => {
    setPendingField('is_enabled');
    try {
      await updateZman.mutateAsync({
        is_enabled: false,
      });
      setShowDisableDialog(false);
    } finally {
      setPendingField(null);
    }
  };

  const handleToggleVisible = async () => {
    setPendingField('is_visible');
    try {
      await updateZman.mutateAsync({
        is_visible: !zman.is_visible,
      });
    } finally {
      setPendingField(null);
    }
  };

  const handleToggleBeta = async () => {
    setPendingField('is_beta');
    try {
      await updateZman.mutateAsync({
        is_beta: !zman.is_beta,
      });
    } finally {
      setPendingField(null);
    }
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

  // Revert tags to master registry
  const handleRevertTags = async () => {
    await revertTags.mutateAsync();
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

  // Check if anything has been modified from source
  const hasAnyModification = nameModifications.anyModified || formulaModified || tagModifications.hasModified;

  return (
    <>
      <Card
        ref={cardRef}
        className={cn(
          "group relative overflow-hidden transition-all duration-200",
          "bg-background hover:border-border",
          // Disabled state
          !zman.is_enabled && "opacity-50",
          // Hidden from public - dashed border
          !zman.is_visible && "border-dashed",
          // Focused state - highlight with ring
          isFocused && "ring-2 ring-primary ring-offset-2"
        )}
      >
        <div className="p-3 sm:p-4 min-w-0">
          {/* === ROW 1: Name + Modified + Actions === */}
          <div className="flex items-start justify-between gap-2">
            {/* Left: Names + Modified badge inline */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Primary name based on language setting */}
                {displayLanguage === 'english' ? (
                  // English only: show English as primary
                  <h3 className="text-base font-semibold leading-tight text-foreground">
                    {zman.english_name}
                  </h3>
                ) : displayLanguage === 'hebrew' ? (
                  // Hebrew only: show Hebrew as primary
                  <h3 className="text-base font-semibold font-hebrew leading-tight text-foreground">
                    {zman.hebrew_name}
                  </h3>
                ) : (
                  // Both: show Hebrew primary, English secondary
                  <>
                    <h3 className="text-base font-semibold font-hebrew leading-tight text-foreground">
                      {zman.hebrew_name}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {zman.english_name}
                    </span>
                  </>
                )}
                {/* Zman key for reference */}
                <span className="text-[10px] font-mono text-muted-foreground/70">
                  @{zman.zman_key}
                </span>
                {/* Modified badge - inline with name */}
                {hasAnyModification && (
                  <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-[10px] px-1.5 py-0">
                    <Pencil className="h-2.5 w-2.5 mr-1" />
                    Modified
                  </Badge>
                )}
                {/* Publisher comment indicator - just shows icon, full comment displayed below */}
                {zman.publisher_comment && (
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5 shrink-0">
              <TooltipProvider delayDuration={300}>
                <div className="flex items-center gap-0.5 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                {/* Metadata edit button (names, description) - only for non-linked zmanim */}
                {isEditable && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleEditMetadata} className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit names &amp; description</TooltipContent>
                  </Tooltip>
                )}
                {/* DSL formula edit button - only for non-linked zmanim */}
                {isEditable && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleEditDSL} className="h-8 w-8">
                        <Code2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit formula (DSL)</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleToggleVisible} className={cn("h-8 w-8", !zman.is_visible && "text-muted-foreground")}>
                      {zman.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{zman.is_visible ? 'Hide from public' : 'Show to public'}</TooltipContent>
                </Tooltip>
                {/* Info button - show master registry details (for both linked and copied zmanim) */}
                {zman.master_zman_id && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => setShowMasterZmanModal(true)} className="h-8 w-8">
                        <Info className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View master registry documentation</TooltipContent>
                  </Tooltip>
                )}
                {/* History button - only for non-linked zmanim */}
                {isEditable && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => setShowHistoryDialog(true)} className="h-8 w-8">
                        <History className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Version history</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleToggleEnabled}
                      disabled={pendingField === 'is_enabled'}
                      className={cn(
                        "h-8 w-8",
                        zman.is_enabled
                          ? "text-emerald-500 hover:text-emerald-600"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{zman.is_enabled ? 'Disable' : 'Enable'}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setShowDeleteDialog(true)} className="h-8 w-8 text-destructive/60 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
                </div>
              </TooltipProvider>
            </div>
          </div>

          {/* === ROW 2: Controls + Time === */}
          <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
            {/* Left: Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Rounding */}
              <RoundingModeToggle
                value={zman.rounding_mode || 'math'}
                onChange={async (mode) => {
                  setPendingField('rounding_mode');
                  try {
                    await updateZman.mutateAsync({ rounding_mode: mode });
                  } finally {
                    setPendingField(null);
                  }
                }}
                disabled={pendingField === 'rounding_mode'}
              />

              {/* Published - editable for non-linked, display-only for linked */}
              {isEditable ? (
                <button
                  onClick={handleTogglePublished}
                  disabled={pendingField === 'is_published'}
                  className={cn(
                    "text-xs font-medium px-2.5 py-1 rounded transition-colors",
                    zman.is_published
                      ? "bg-green-600/80 text-white hover:bg-green-600"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25"
                  )}
                >
                  {zman.is_published ? 'Published' : 'Draft'}
                </button>
              ) : (
                <span
                  className={cn(
                    "text-xs font-medium px-2.5 py-1 rounded",
                    zman.is_published
                      ? "bg-green-600/80 text-white"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  )}
                >
                  {zman.is_published ? 'Published' : 'Draft'}
                </span>
              )}

              {/* Beta - editable for non-linked, display-only for linked */}
              {zman.is_beta && (
                isEditable ? (
                  <button
                    onClick={handleToggleBeta}
                    disabled={pendingField === 'is_beta'}
                    className="text-xs font-medium px-2.5 py-1 rounded bg-amber-500/80 text-white hover:bg-amber-500 transition-colors"
                  >
                    <FlaskConical className="h-3 w-3 inline mr-1" />
                    Beta
                  </button>
                ) : (
                  <span className="text-xs font-medium px-2.5 py-1 rounded bg-amber-500/80 text-white">
                    <FlaskConical className="h-3 w-3 inline mr-1" />
                    Beta
                  </span>
                )
              )}

              {/* Source - Registry or Linked */}
              {zman.is_linked ? (
                <span className={cn(
                  "text-xs px-2.5 py-1 rounded",
                  zman.linked_source_is_deleted
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-muted/60 text-muted-foreground"
                )}>
                  <Link2 className="h-3 w-3 inline mr-1" />
                  {zman.linked_source_publisher_name}
                </span>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300">
                  <Library className="h-3 w-3 inline mr-1" />
                  Registry
                </span>
              )}
            </div>

            {/* Right: Time */}
            {previewTime && (
              <div className="shrink-0">
                <span className="text-xl sm:text-2xl font-mono font-medium tabular-nums text-primary">
                  {previewTime}
                </span>
              </div>
            )}
          </div>

          {/* === ROW 3: Formula === */}
          <div className="mt-2 min-w-0 overflow-hidden">
            <HighlightedFormula formula={zman.formula_dsl} />
          </div>

          {/* === ROW 4: Tags === */}
          {!compact && (
            <div className="mt-2 flex items-center gap-1.5">
              {/* Only show tag editor for editable (non-linked) zmanim */}
              {isEditable && (
                <ZmanTagEditor zmanKey={zman.zman_key} currentTags={zman.tags || []} />
              )}

              {zman.tags && zman.tags.length > 0 && zman.tags.map((tag, index) => (
                <ColorBadge
                  key={tag.tag_key || `tag-${index}`}
                  color={getTagTypeColor(tag.tag_type)}
                  size="sm"
                  className={cn(
                    // Negated tags: red border + strikethrough
                    tag.is_negated && "border-2 border-red-500 dark:border-red-400"
                  )}
                >
                  {tag.is_negated && <X className="h-2.5 w-2.5 mr-0.5 text-red-500 shrink-0" />}
                  <span className={cn(tag.is_negated && "line-through decoration-red-500")}>
                    {getTagName(tag)}
                  </span>
                </ColorBadge>
              ))}
            </div>
          )}

          {/* === Dependencies === */}
          {!compact && zman.dependencies && zman.dependencies.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {zman.dependencies.map((dep) => (
                <span key={dep} className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 bg-muted/50 rounded">
                  @{dep}
                </span>
              ))}
            </div>
          )}

          {/* === Comments === */}
          {!compact && zman.publisher_comment && (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {zman.publisher_comment}
            </p>
          )}
        </div>
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

      {/* Disable Confirmation Dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Power className="h-5 w-5 text-amber-500" />
              Disable Zman?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to disable <strong>{zman.english_name}</strong>?
                </p>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-amber-800 dark:text-amber-200 text-sm">
                  Disabled zmanim are excluded from calculations and will not appear in output times.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDisable}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Disable
            </AlertDialogAction>
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
                          variant={version.version_number === versionHistory.current_version ? 'default' : 'outline-solid'}
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

      {/* Metadata Editor Modal */}
      <ZmanMetadataEditor
        zman={zman}
        open={showMetadataEditor}
        onOpenChange={setShowMetadataEditor}
      />

      {/* Master Zman Documentation Modal */}
      {zman.master_zman_id && (
        <MasterZmanDetailModal
          masterZmanId={showMasterZmanModal ? zman.master_zman_id : null}
          isOpen={showMasterZmanModal}
          onClose={() => setShowMasterZmanModal(false)}
        />
      )}
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
  previewTimes,
  focusZmanKey,
}: {
  zmanim: PublisherZman[];
  category: 'core' | 'optional' | 'hidden';
  onEdit?: (zmanKey: string) => void;
  displayLanguage?: 'hebrew' | 'english' | 'both';
  allZmanim?: PublisherZman[];
  /** Map of zman_key to pre-calculated time string from API */
  previewTimes?: Record<string, string>;
  /** Key of zman to focus/highlight and scroll to */
  focusZmanKey?: string | null;
}) {
  if (zmanim.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No zmanim in this category</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {zmanim.map((zman) => (
        <ZmanCard
          key={zman.id}
          zman={zman}
          category={category}
          onEdit={onEdit}
          displayLanguage={displayLanguage}
          allZmanim={allZmanim}
          previewTime={previewTimes?.[zman.zman_key]}
          isFocused={focusZmanKey === zman.zman_key}
        />
      ))}
    </div>
  );
}
