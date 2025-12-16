'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useTimeCategories, useTagTypes } from '@/lib/hooks/useCategories';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminApi } from '@/lib/api-client';
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  User,
  Calendar,
  Info,
} from 'lucide-react';
import { TagSelectorWithNegation } from '@/components/shared/tags/TagSelectorWithNegation';
import type { TagSelectorTag } from '@/components/shared/tags/TagSelector';

// Types
export interface ZmanTag {
  id: number; // Changed from string to number to match backend int32
  tag_key: string;
  name: string;
  display_name_hebrew: string;
  display_name_english: string;
  tag_type: 'event' | 'timing' | 'behavior' | 'shita' | 'calculation' | 'category' | 'jewish_day';
  description?: string | null;
  color?: string | null;
  sort_order?: number;
}

export interface PendingTagRequest {
  id: string;
  zman_request_id: string;
  tag_id?: number; // Changed from string to number to match backend int32
  requested_tag_name?: string;
  requested_tag_type?: string;
  is_new_tag_request: boolean;
}

export interface TagAssignment {
  tag_id: number; // Changed from string to number to match backend int32
  is_negated: boolean;
}

export interface ZmanFormData {
  zman_key: string;
  canonical_hebrew_name: string;
  canonical_english_name: string;
  transliteration: string;
  description: string;
  halachic_notes: string;
  halachic_source: string;
  time_category: string;
  default_formula_dsl: string;
  is_core: boolean;
  is_hidden: boolean;
  tags: TagAssignment[];
}

export interface ReviewSourceInfo {
  publisher_name: string;
  publisher_id: string;
  submitted_at: string;
  request_id: string;
}

interface ZmanRegistryFormProps {
  mode: 'create' | 'edit' | 'review';
  initialData?: Partial<ZmanFormData>;
  sourceInfo?: ReviewSourceInfo;
  pendingTagRequests?: PendingTagRequest[];
  disabled?: boolean;
  onSave?: (data: ZmanFormData) => Promise<void>;
  onApprove?: (data: ZmanFormData, reviewerNotes: string) => Promise<void>;
  onReject?: (reviewerNotes: string) => Promise<void>;
  onCancel?: () => void;
  onTagApprove?: (tagRequest: PendingTagRequest) => Promise<ZmanTag | null>;
  onTagReject?: (tagRequest: PendingTagRequest) => Promise<void>;
}

const DEFAULT_FORM_DATA: ZmanFormData = {
  zman_key: '',
  canonical_hebrew_name: '',
  canonical_english_name: '',
  transliteration: '',
  description: '',
  halachic_notes: '',
  halachic_source: '',
  time_category: 'sunrise',
  default_formula_dsl: '',
  is_core: false,
  is_hidden: false,
  tags: [],
};

/**
 * ZmanRegistryForm - Reusable form for creating, editing, and reviewing zmanim
 *
 * Modes:
 * - create: New zman entry with Save button
 * - edit: Edit existing zman with Save button
 * - review: Review request with Approve/Reject buttons and source info banner
 */
export function ZmanRegistryForm({
  mode,
  initialData,
  sourceInfo,
  pendingTagRequests = [],
  disabled = false,
  onSave,
  onApprove,
  onReject,
  onCancel,
  onTagApprove,
  onTagReject,
}: ZmanRegistryFormProps) {
  const api = useAdminApi();
  const { data: timeCategories, isLoading: loadingTimeCategories } = useTimeCategories();
  const { data: tagTypes, isLoading: tagTypesLoading } = useTagTypes();
  const [formData, setFormData] = useState<ZmanFormData>({
    ...DEFAULT_FORM_DATA,
    ...initialData,
  });
  const [originalData, setOriginalData] = useState<ZmanFormData | null>(null);
  const [allTags, setAllTags] = useState<ZmanTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingTagId, setProcessingTagId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Key validation state (for create mode)
  const [keyValidation, setKeyValidation] = useState<{
    available: boolean | null;
    reason: string | null;
    isValidating: boolean;
  }>({ available: null, reason: null, isValidating: false });

  // Track pending tag requests that haven't been resolved yet
  const [resolvedTagIds, setResolvedTagIds] = useState<Set<string>>(new Set());

  // Initialize form data and track original for change detection
  useEffect(() => {
    const data = { ...DEFAULT_FORM_DATA, ...initialData };
    setFormData(data);
    if (mode === 'review') {
      setOriginalData(data);
    }
  }, [initialData, mode]);

  // Fetch all available tags
  const fetchTags = useCallback(async () => {
    setTagsLoading(true);
    try {
      const response = await api.get<{ tags?: ZmanTag[] } | ZmanTag[]>('/admin/registry/tags');
      const tags = Array.isArray(response) ? response : response?.tags ?? [];
      setAllTags(tags);
    } catch (err) {
      console.error('Failed to fetch tags:', err);
    } finally {
      setTagsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Validate zman key format
  const isValidKeyFormat = (key: string): boolean => {
    return /^[a-z][a-z0-9_]*$/.test(key);
  };

  // Debounced key validation (for create mode only)
  const validateKey = useCallback(async (key: string) => {
    const trimmedKey = key.trim().toLowerCase();
    if (!trimmedKey) {
      setKeyValidation({ available: null, reason: null, isValidating: false });
      return;
    }

    if (trimmedKey.length < 2) {
      setKeyValidation({ available: false, reason: 'Key must be at least 2 characters', isValidating: false });
      return;
    }

    if (!isValidKeyFormat(trimmedKey)) {
      setKeyValidation({
        available: false,
        reason: 'Key must start with a letter and contain only lowercase letters, numbers, and underscores',
        isValidating: false,
      });
      return;
    }

    setKeyValidation({ available: null, reason: null, isValidating: true });
    try {
      const result = await api.get<{ available: boolean; reason?: string }>(
        `/registry/zmanim/validate-key?key=${encodeURIComponent(trimmedKey)}`
      );
      setKeyValidation({
        available: result.available,
        reason: result.available ? null : (result.reason || 'Key is not available'),
        isValidating: false,
      });
    } catch {
      setKeyValidation({ available: null, reason: 'Could not validate key', isValidating: false });
    }
  }, [api]);

  // Debounce key validation on zman_key change (create mode only)
  useEffect(() => {
    if (mode !== 'create') return;

    const timer = setTimeout(() => {
      if (formData.zman_key.trim()) {
        validateKey(formData.zman_key);
      } else {
        setKeyValidation({ available: null, reason: null, isValidating: false });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.zman_key, mode, validateKey]);

  // Check if form data has been modified from original (for review mode)
  const hasChanges = useMemo(() => {
    if (mode !== 'review' || !originalData) return false;
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  }, [mode, formData, originalData]);

  // Count unresolved pending tag requests
  const unresolvedTagRequests = useMemo(() => {
    return pendingTagRequests.filter(
      (req) => req.is_new_tag_request && !resolvedTagIds.has(req.id)
    );
  }, [pendingTagRequests, resolvedTagIds]);

  // Map of tag type key -> label from DB (fallback to key)
  const tagTypeLabelsMap = useMemo(() => {
    return tagTypes?.reduce((acc, tt) => {
      acc[tt.key] = tt.display_name_english;
      return acc;
    }, {} as Record<string, string>) ?? {};
  }, [tagTypes]);

  const canApprove = mode === 'review' && unresolvedTagRequests.length === 0;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleTagApprove = async (tagRequest: PendingTagRequest) => {
    if (!onTagApprove) return;
    setProcessingTagId(tagRequest.id);
    try {
      const newTag = await onTagApprove(tagRequest);
      if (newTag) {
        // Add the new tag to selected tags (positive by default)
        setFormData((prev) => ({
          ...prev,
          tags: [...prev.tags, { tag_id: newTag.id, is_negated: false }],
        }));
        // Add to all tags list
        setAllTags((prev) => [...prev, newTag]);
      }
      // Mark as resolved
      setResolvedTagIds((prev) => new Set([...prev, tagRequest.id]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve tag');
    } finally {
      setProcessingTagId(null);
    }
  };

  const handleTagReject = async (tagRequest: PendingTagRequest) => {
    if (!onTagReject) return;
    setProcessingTagId(tagRequest.id);
    try {
      await onTagReject(tagRequest);
      // Mark as resolved
      setResolvedTagIds((prev) => new Set([...prev, tagRequest.id]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject tag');
    } finally {
      setProcessingTagId(null);
    }
  };

  const handleSubmit = async () => {
    setError(null);

    // Basic validation
    const errors: string[] = [];

    if (!formData.zman_key.trim()) {
      errors.push('Zman Key is required');
    }
    if (!formData.canonical_hebrew_name.trim()) {
      errors.push('Hebrew Name is required');
    }
    if (!formData.canonical_english_name.trim()) {
      errors.push('English Name is required');
    }
    if (!formData.default_formula_dsl.trim()) {
      errors.push('Default Formula (DSL) is required');
    }

    // Key validation check (create mode only)
    if (mode === 'create') {
      if (keyValidation.isValidating) {
        errors.push('Please wait for key validation to complete');
      } else if (keyValidation.available === false) {
        errors.push(keyValidation.reason || 'Zman key is not available');
      }
    }

    if (errors.length > 0) {
      setError(errors.join('. '));
      return;
    }

    setIsSubmitting(true);
    try {
      // Validate DSL formula before proceeding
      const dslValidation = await api.post<{
        valid: boolean;
        errors?: Array<{ message: string; line?: number; column?: number }>;
      }>('/dsl/validate', {
        body: JSON.stringify({ formula: formData.default_formula_dsl }),
      });

      if (!dslValidation.valid) {
        const dslErrors = dslValidation.errors?.map(e => e.message).join('; ') || 'Invalid formula syntax';
        setError(`Formula validation failed: ${dslErrors}`);
        setIsSubmitting(false);
        return;
      }

      if (mode === 'review' && onApprove) {
        await onApprove(formData, reviewerNotes);
      } else if (onSave) {
        await onSave(formData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    setError(null);

    // Require reviewer notes for rejection
    if (!reviewerNotes.trim()) {
      setError('Please provide a reason for rejecting this request');
      return;
    }

    setIsSubmitting(true);
    try {
      await onReject(reviewerNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3-state toggle: unselected → positive → negated → unselected
  const toggleTag = (tagId: number) => { // Changed from string to number
    setFormData((prev) => {
      const existingTag = prev.tags.find((t) => t.tag_id === tagId);

      if (!existingTag) {
        // Not selected -> add as positive
        return {
          ...prev,
          tags: [...prev.tags, { tag_id: tagId, is_negated: false }],
        };
      } else if (!existingTag.is_negated) {
        // Positive -> make negated
        return {
          ...prev,
          tags: prev.tags.map((t) =>
            t.tag_id === tagId ? { ...t, is_negated: true } : t
          ),
        };
      } else {
        // Negated -> remove
        return {
          ...prev,
          tags: prev.tags.filter((t) => t.tag_id !== tagId),
        };
      }
    });
  };

  // Compute selectedTagIds and negatedTagIds for TagSelectorWithNegation
  const selectedTagIds = useMemo(() => formData.tags.map((t) => t.tag_id), [formData.tags]);
  const negatedTagIds = useMemo(() => formData.tags.filter((t) => t.is_negated).map((t) => t.tag_id), [formData.tags]);

  return (
    <div className="space-y-6">
      {/* Source Info Banner (Review Mode) */}
      {mode === 'review' && sourceInfo && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-blue-900 dark:text-blue-100">
                Reviewing Zman Request
              </h3>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-blue-700 dark:text-blue-300">
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {sourceInfo.publisher_name}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(sourceInfo.submitted_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Tag Requests (Review Mode) */}
      {mode === 'review' && unresolvedTagRequests.length > 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-amber-900 dark:text-amber-100">
                Pending Tag Requests ({unresolvedTagRequests.length})
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Resolve all tag requests before approving this zman
              </p>
              <div className="mt-3 space-y-2">
                {unresolvedTagRequests.map((tagReq) => (
                  <div
                    key={tagReq.id}
                    className="flex items-center justify-between p-2 bg-card rounded border border-border"
                  >
                    <div>
                      <span className="font-medium">{tagReq.requested_tag_name}</span>
                      {tagReq.requested_tag_type && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {tagReq.requested_tag_type}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTagReject(tagReq)}
                        disabled={processingTagId === tagReq.id || disabled}
                        className="text-destructive hover:text-destructive"
                      >
                        {processingTagId === tagReq.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleTagApprove(tagReq)}
                        disabled={processingTagId === tagReq.id || disabled}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {processingTagId === tagReq.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Changes Warning (Review Mode) */}
      {mode === 'review' && hasChanges && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm">
            You modified the request. These changes will be saved when you approve.
          </span>
        </div>
      )}

      {/* Form Fields */}
      <div className="grid gap-4">
        {/* Zman Key and Time Category */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="zman_key">Zman Key *</Label>
              {/* Key Validation Status (create mode only) */}
              {mode === 'create' && formData.zman_key.trim() && (
                <div className="flex items-center gap-1.5">
                  {keyValidation.isValidating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Checking...</span>
                    </>
                  ) : keyValidation.available === true ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-xs text-green-600">Available</span>
                    </>
                  ) : keyValidation.available === false ? (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      <span className="text-xs text-destructive">Unavailable</span>
                    </>
                  ) : null}
                </div>
              )}
            </div>
            <Input
              id="zman_key"
              value={formData.zman_key}
              onChange={(e) => setFormData({ ...formData, zman_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
              placeholder="e.g., candle_lighting_18"
              disabled={mode === 'edit' || disabled}
              className={`font-mono ${
                mode === 'create' && formData.zman_key.trim() && keyValidation.available === false
                  ? 'border-destructive focus-visible:ring-destructive'
                  : mode === 'create' && formData.zman_key.trim() && keyValidation.available === true
                  ? 'border-green-500 focus-visible:ring-green-500'
                  : ''
              }`}
            />
            {/* Key Error Message */}
            {mode === 'create' && keyValidation.reason ? (
              <p className="text-xs text-destructive flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                {keyValidation.reason}
              </p>
            ) : formData.zman_key ? (
              <p className="text-xs text-muted-foreground">
                DSL Reference:{' '}
                <code className="px-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded">
                  @{formData.zman_key}
                </code>
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="time_category">Time Category *</Label>
            <Select
              value={formData.time_category}
              onValueChange={(v) => setFormData({ ...formData, time_category: v })}
              disabled={disabled || loadingTimeCategories}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeCategories?.map((cat) => (
                  <SelectItem key={cat.key} value={cat.key}>
                    {cat.display_name_english}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tags Section */}
        <div className="space-y-2">
          <Label>Tags</Label>
          <p className="text-xs text-muted-foreground">
            Click once to include, click again to exclude (negate), click again to remove.
          </p>
          <TagSelectorWithNegation
            tags={allTags as TagSelectorTag[]}
            selectedTagIds={selectedTagIds}
            negatedTagIds={negatedTagIds}
            onToggleTag={toggleTag}
            tagTypeLabels={tagTypeLabelsMap}
            isLoading={tagsLoading || tagTypesLoading}
            disabled={disabled}
          />
        </div>

        {/* Hebrew and English Names */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="canonical_hebrew_name">Hebrew Name *</Label>
            <Input
              id="canonical_hebrew_name"
              value={formData.canonical_hebrew_name}
              onChange={(e) =>
                setFormData({ ...formData, canonical_hebrew_name: e.target.value })
              }
              placeholder="עלות השחר"
              dir="rtl"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="canonical_english_name">English Name *</Label>
            <Input
              id="canonical_english_name"
              value={formData.canonical_english_name}
              onChange={(e) =>
                setFormData({ ...formData, canonical_english_name: e.target.value })
              }
              placeholder="Dawn"
              disabled={disabled}
            />
          </div>
        </div>

        {/* Transliteration */}
        <div className="space-y-2">
          <Label htmlFor="transliteration">Transliteration</Label>
          <Input
            id="transliteration"
            value={formData.transliteration}
            onChange={(e) => setFormData({ ...formData, transliteration: e.target.value })}
            placeholder="Alos HaShachar"
            disabled={disabled}
          />
        </div>

        {/* Default Formula */}
        <div className="space-y-2">
          <Label htmlFor="default_formula_dsl">Default Formula (DSL) *</Label>
          <Input
            id="default_formula_dsl"
            value={formData.default_formula_dsl}
            onChange={(e) =>
              setFormData({ ...formData, default_formula_dsl: e.target.value })
            }
            placeholder="sunrise - 72m"
            className="font-mono"
            disabled={disabled}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of this zman..."
            rows={2}
            disabled={disabled}
          />
        </div>

        {/* Halachic Notes */}
        <div className="space-y-2">
          <Label htmlFor="halachic_notes">Halachic Notes</Label>
          <Textarea
            id="halachic_notes"
            value={formData.halachic_notes}
            onChange={(e) => setFormData({ ...formData, halachic_notes: e.target.value })}
            placeholder="Relevant halachic information..."
            rows={2}
            disabled={disabled}
          />
        </div>

        {/* Halachic Source and Sort Order */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="halachic_source">Halachic Source</Label>
            <Input
              id="halachic_source"
              value={formData.halachic_source}
              onChange={(e) =>
                setFormData({ ...formData, halachic_source: e.target.value })
              }
              placeholder="e.g., Shulchan Aruch 89:1"
              disabled={disabled}
            />
          </div>
        </div>

        {/* Core and Hidden Toggles */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              id="is_core"
              checked={formData.is_core}
              onCheckedChange={(v) => setFormData({ ...formData, is_core: v })}
              disabled={disabled}
            />
            <Label htmlFor="is_core">Core Zman</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="is_hidden"
              checked={formData.is_hidden}
              onCheckedChange={(v) => setFormData({ ...formData, is_hidden: v })}
              disabled={disabled}
            />
            <Label htmlFor="is_hidden">Hidden</Label>
          </div>
        </div>

        {/* Reviewer Notes (Review Mode) */}
        {mode === 'review' && (
          <div className="space-y-2">
            <Label htmlFor="reviewer_notes">Reviewer Notes</Label>
            <Textarea
              id="reviewer_notes"
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              placeholder="Add notes about your decision (required for rejection)..."
              rows={3}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {/* Error Alert (shown near buttons for visibility) */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Footer Buttons */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}

        {mode === 'review' ? (
          <>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isSubmitting || disabled}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Reject
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || disabled || !canApprove}
              className="bg-green-600 hover:bg-green-700"
              title={
                !canApprove
                  ? `Resolve ${unresolvedTagRequests.length} pending tag request(s) before approving`
                  : undefined
              }
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Approve
            </Button>
          </>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              disabled ||
              (mode === 'create' && (keyValidation.isValidating || keyValidation.available === false))
            }
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : keyValidation.isValidating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking key...
              </>
            ) : null}
            {!isSubmitting && !keyValidation.isValidating && (mode === 'create' ? 'Create' : 'Update')}
          </Button>
        )}
      </div>
    </div>
  );
}

export default ZmanRegistryForm;
