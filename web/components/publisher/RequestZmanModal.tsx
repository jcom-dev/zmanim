/**
 * @file RequestZmanModal.tsx
 * @purpose Multi-step zman registry request flow - form wizard with validation
 * @pattern client-component-complex
 * @dependencies useApi, Form (shadcn), DSL editor
 * @frequency critical - 967 lines
 * @compliance Check docs/adr/ for pattern rationale
 */

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePublisherMutation, usePublisherQuery, useTagTypes } from '@/lib/hooks';
import { useApi } from '@/lib/api-client';
import { useTagDisplayName } from '@/lib/hooks/usePublisherSettings';
import { Loader2, Plus, FileText, X, Tag, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ZmanRequest {
  id: string;
  requested_key: string;
  requested_hebrew_name: string;
  requested_english_name: string;
  transliteration?: string;
  time_category: string;
  tags?: string[];
  status: string;
  reviewed_at?: string;
  reviewer_notes?: string;
  created_at: string;
}

// Tag selection state: null = unselected, true = included, false = negated (excluded)
type TagSelectionState = null | true | false;

interface ZmanRequestListResponse {
  requests: ZmanRequest[];
  total: number;
}

interface ZmanTag {
  id: string;
  tag_key: string;
  name: string;
  display_name_hebrew: string;
  display_name_english: string; // Deprecated: use display_name_english_ashkenazi
  display_name_english_ashkenazi?: string;
  display_name_english_sephardi?: string | null;
  tag_type: 'event' | 'timing' | 'behavior' | 'shita' | 'method';
  description?: string;
  color?: string;
}

interface TagsResponse {
  tags: ZmanTag[];
}

interface RequestZmanModalProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  onOpen?: () => void;
  /** Controlled mode: open state */
  open?: boolean;
  /** Controlled mode: callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

/**
 * RequestZmanModal - Modal for requesting a new zman to be added to the master registry
 *
 * Features:
 * - Form for submitting new zman request
 * - Validation for required fields
 * - Halachic source fields
 * - Tag selection with tags fetched from API, organized by type
 * - Request new tags with type selection
 * - Request history with status badges
 * - Uses useApi() hook for all API calls
 * - Supports both controlled (open/onOpenChange) and uncontrolled (trigger) modes
 *
 * Story 5.7: Request New Zman UI
 */
export function RequestZmanModal({ trigger, onSuccess, onOpen, open: controlledOpen, onOpenChange }: RequestZmanModalProps) {
  const getTagName = useTagDisplayName();
  const [internalOpen, setInternalOpen] = useState(false);

  // Use controlled mode if open prop is provided, otherwise use internal state
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && onOpen) {
      onOpen();
    }
  };
  const [showHistory, setShowHistory] = useState(false);

  // Form state
  const [requestedKey, setRequestedKey] = useState('');
  const [hebrewName, setHebrewName] = useState('');
  const [englishName, setEnglishName] = useState('');
  const [transliteration, setTransliteration] = useState('');
  const [timeCategory, setTimeCategory] = useState('');
  const [description, setDescription] = useState('');
  const [justification, setJustification] = useState('');
  const [formulaDsl, setFormulaDsl] = useState('');
  const [halachicNotes, setHalachicNotes] = useState('');
  const [halachicSource, setHalachicSource] = useState('');
  const [autoAddOnApproval, setAutoAddOnApproval] = useState(true);

  // Tags state - using map for three states: unselected (not in map), included (true), negated (false)
  const [tagSelectionStates, setTagSelectionStates] = useState<Map<string, boolean>>(new Map());
  const [customTagInput, setCustomTagInput] = useState('');
  const [customTagType, setCustomTagType] = useState<string>('');
  const [requestedNewTags, setRequestedNewTags] = useState<{ name: string; type: string }[]>([]);

  // DSL validation state
  const [dslValid, setDslValid] = useState<boolean | null>(null);
  const [dslError, setDslError] = useState<string | null>(null);
  const [isValidatingDsl, setIsValidatingDsl] = useState(false);

  // Key validation state
  const [keyExists, setKeyExists] = useState<boolean | null>(null);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Form error state
  const [formError, setFormError] = useState<string | null>(null);

  // API client for DSL validation
  const api = useApi();

  // Fetch tag types from database for labels and ordering
  const { data: tagTypesData, isLoading: tagTypesLoading } = useTagTypes();

  // Build tag type labels and order from database
  const tagTypeLabelsMap = useMemo(() => {
    if (!tagTypesData) return {} as Record<string, string>;
    return tagTypesData.reduce((acc, tt) => {
      acc[tt.key] = tt.display_name_english;
      return acc;
    }, {} as Record<string, string>);
  }, [tagTypesData]);

  // Use database sort_order for consistent ordering
  const tagTypeOrder = useMemo(() => {
    if (!tagTypesData) return [];
    return [...tagTypesData].sort((a, b) => a.sort_order - b.sort_order).map(tt => tt.key);
  }, [tagTypesData]);

  // Fetch available tags from API
  const { data: tagsData, isLoading: tagsLoading } = usePublisherQuery<TagsResponse>(
    'zman-tags',
    '/registry/tags',
    {
      enabled: open,
    }
  );

  // Group tags by type
  const tagsByType = useMemo(() => {
    if (!tagsData?.tags) return {};

    const grouped: Record<string, ZmanTag[]> = {};
    for (const tag of tagsData.tags) {
      if (!grouped[tag.tag_type]) {
        grouped[tag.tag_type] = [];
      }
      grouped[tag.tag_type].push(tag);
    }
    return grouped;
  }, [tagsData?.tags]);

  // Fetch request history
  const { data: historyData, isLoading: historyLoading } = usePublisherQuery<ZmanRequestListResponse>(
    'zman-requests',
    '/publisher/zman-requests',
    {
      enabled: showHistory && open,
    }
  );

  // Mutation to submit request
  const submitRequest = usePublisherMutation<unknown, {
    requested_key: string;
    requested_hebrew_name: string;
    requested_english_name: string;
    transliteration?: string;
    time_category: string;
    tag_ids?: string[];
    negated_tag_ids?: string[];
    requested_new_tags?: { name: string; type: string }[];
    description: string;
    requested_formula_dsl?: string;
    halachic_notes?: string;
    halachic_source?: string;
    auto_add_on_approval?: boolean;
  }>(
    '/publisher/zman-requests',
    'POST',
    {
      invalidateKeys: ['zman-requests'],
      onSuccess: () => {
        handleReset();
        setOpen(false);
        onSuccess?.();
      },
    }
  );

  // Validate zman key format
  const isValidKeyFormat = (key: string): boolean => {
    // Key must be lowercase, alphanumeric with underscores only
    return /^[a-z][a-z0-9_]*$/.test(key);
  };

  // Debounced key uniqueness validation - checks if key already exists in master registry
  const validateKeyUniqueness = useCallback(async (key: string) => {
    const trimmedKey = key.trim().toLowerCase();
    if (!trimmedKey) {
      setKeyExists(null);
      setKeyError(null);
      setIsValidatingKey(false);
      return;
    }

    // Validate format first (basic check before API call)
    if (!isValidKeyFormat(trimmedKey)) {
      setKeyError('Key must start with a letter and contain only lowercase letters, numbers, and underscores');
      setKeyExists(null);
      setIsValidatingKey(false);
      return;
    }

    setIsValidatingKey(true);
    setKeyError(null);
    try {
      // Use dedicated validation endpoint
      const result = await api.public.get<{ available: boolean; reason?: string }>(
        `/registry/zmanim/validate-key?key=${encodeURIComponent(trimmedKey)}`
      );

      if (result.available) {
        setKeyExists(false);
        setKeyError(null);
      } else {
        setKeyExists(true);
        setKeyError(result.reason || 'This zman key is not available');
      }
    } catch {
      // Couldn't validate
      setKeyError('Could not validate key availability');
      setKeyExists(null);
    } finally {
      setIsValidatingKey(false);
    }
  }, [api]);

  // Debounced DSL validation - validates formula on every change with 300ms debounce
  const validateDsl = useCallback(async (formula: string) => {
    if (!formula.trim()) {
      setDslValid(null);
      setDslError(null);
      setIsValidatingDsl(false);
      return;
    }

    setIsValidatingDsl(true);
    try {
      const result = await api.post<{
        valid: boolean;
        errors?: Array<{ message: string; line?: number; column?: number }>;
      }>('/dsl/validate', {
        body: JSON.stringify({ formula }),
      });

      setDslValid(result.valid);
      if (!result.valid && result.errors && result.errors.length > 0) {
        setDslError(result.errors.map(e => e.message).join('; '));
      } else {
        setDslError(null);
      }
    } catch {
      setDslError('Failed to validate formula');
      setDslValid(false);
    } finally {
      setIsValidatingDsl(false);
    }
  }, [api]);

  // Debounce key validation on requestedKey change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (requestedKey.trim()) {
        validateKeyUniqueness(requestedKey);
      } else {
        setKeyExists(null);
        setKeyError(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [requestedKey, validateKeyUniqueness]);

  // Debounce DSL validation on formulaDsl change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formulaDsl.trim()) {
        validateDsl(formulaDsl);
      } else {
        setDslValid(null);
        setDslError(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formulaDsl, validateDsl]);

  const handleReset = () => {
    setRequestedKey('');
    setHebrewName('');
    setEnglishName('');
    setTransliteration('');
    setTimeCategory('');
    setDescription('');
    setJustification('');
    setFormulaDsl('');
    setHalachicNotes('');
    setHalachicSource('');
    setAutoAddOnApproval(true);
    setTagSelectionStates(new Map());
    setCustomTagInput('');
    setCustomTagType('');
    setRequestedNewTags([]);
    // Reset DSL validation state
    setDslValid(null);
    setDslError(null);
    // Reset key validation state
    setKeyExists(null);
    setKeyError(null);
    setFormError(null);
  };

  const handleSubmit = async () => {
    setFormError(null);

    // Validate required fields
    const errors: string[] = [];
    if (!requestedKey.trim()) errors.push('Zman Key is required');
    if (!hebrewName.trim()) errors.push('Hebrew Name is required');
    if (!englishName.trim()) errors.push('English Name is required');
    if (!timeCategory) errors.push('Time Category is required');
    if (!description.trim()) errors.push('Description is required');
    if (!justification.trim()) errors.push('Justification is required');

    if (errors.length > 0) {
      setFormError(errors.join('. '));
      return;
    }

    // Validate key format and uniqueness
    if (keyError) {
      setFormError(keyError);
      return;
    }

    if (keyExists === true) {
      setFormError('This zman key already exists in the registry. Please choose a different key.');
      return;
    }

    // If key validation is still running, wait
    if (isValidatingKey) {
      setFormError('Please wait for key validation to complete.');
      return;
    }

    // Validate DSL if provided
    if (formulaDsl.trim() && dslValid === false) {
      setFormError('Formula is invalid. Please fix the formula before submitting.');
      return;
    }

    // If DSL is provided but validation hasn't completed yet, wait for it
    if (formulaDsl.trim() && isValidatingDsl) {
      setFormError('Please wait for formula validation to complete.');
      return;
    }

    // Convert tag selection states to arrays for API
    const includedTagIds: string[] = [];
    const negatedTagIds: string[] = [];
    tagSelectionStates.forEach((isIncluded, tagId) => {
      if (isIncluded) {
        includedTagIds.push(tagId);
      } else {
        negatedTagIds.push(tagId);
      }
    });

    await submitRequest.mutateAsync({
      requested_key: requestedKey.trim(),
      requested_hebrew_name: hebrewName.trim(),
      requested_english_name: englishName.trim(),
      transliteration: transliteration.trim() || undefined,
      time_category: timeCategory,
      tag_ids: includedTagIds.length > 0 ? includedTagIds : undefined,
      negated_tag_ids: negatedTagIds.length > 0 ? negatedTagIds : undefined,
      requested_new_tags: requestedNewTags.length > 0 ? requestedNewTags : undefined,
      description: description.trim(),
      requested_formula_dsl: formulaDsl.trim() || undefined,
      halachic_notes: halachicNotes.trim() || undefined,
      halachic_source: halachicSource.trim() || undefined,
      auto_add_on_approval: autoAddOnApproval,
    });
  };

  // Three-state toggle: unselected -> included -> negated -> unselected
  const toggleTag = (tagId: string) => {
    setTagSelectionStates(prev => {
      const newMap = new Map(prev);
      const currentState = prev.get(tagId);

      if (currentState === undefined) {
        // Unselected -> Included
        newMap.set(tagId, true);
      } else if (currentState === true) {
        // Included -> Negated
        newMap.set(tagId, false);
      } else {
        // Negated -> Unselected
        newMap.delete(tagId);
      }

      return newMap;
    });
  };

  // Helper to get tag selection state
  const getTagState = (tagId: string): 'unselected' | 'included' | 'negated' => {
    const state = tagSelectionStates.get(tagId);
    if (state === undefined) return 'unselected';
    if (state === true) return 'included';
    return 'negated';
  };

  const addCustomTag = () => {
    const tagName = customTagInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (tagName && customTagType && !requestedNewTags.some(t => t.name === tagName)) {
      setRequestedNewTags(prev => [...prev, { name: tagName, type: customTagType }]);
      setCustomTagInput('');
      setCustomTagType('');
    }
  };

  const removeRequestedTag = (tagName: string) => {
    setRequestedNewTags(prev => prev.filter(t => t.name !== tagName));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-amber-600 border-amber-600">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-600 hover:bg-green-700">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTagLabel = (tag: string) => {
    return tag
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Only render DialogTrigger if trigger prop is provided (uncontrolled mode) */}
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      {/* In controlled mode without trigger, show default button */}
      {!trigger && !isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Request New Zman
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Request New Zman</DialogTitle>
          <DialogDescription>
            Request a new zman to be added to the master registry. Admins will review your request.
          </DialogDescription>
        </DialogHeader>

        {/* Toggle between form and history */}
        <div className="flex gap-2 border-b">
          <Button
            variant={!showHistory ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setShowHistory(false)}
            className="rounded-b-none"
          >
            <FileText className="h-4 w-4 mr-2" />
            New Request
          </Button>
          <Button
            variant={showHistory ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setShowHistory(true)}
            className="rounded-b-none"
          >
            Request History
          </Button>
        </div>

        {showHistory ? (
          /* Request History View */
          <ScrollArea className="h-[400px]">
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : historyData?.requests && historyData.requests.length > 0 ? (
              <div className="space-y-3">
                {historyData.requests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 rounded-lg border hover:border-muted-foreground/50"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">
                          <span className="font-hebrew">{request.requested_hebrew_name}</span>
                          <span className="mx-2 text-muted-foreground">•</span>
                          <span>{request.requested_english_name}</span>
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Key: <code className="font-mono">{request.requested_key}</code>
                        </p>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                      <span>Category: {request.time_category}</span>
                      <span>•</span>
                      <span>Submitted: {formatDate(request.created_at)}</span>
                    </div>

                    {request.tags && request.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {request.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {formatTagLabel(tag)}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {request.reviewer_notes && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <span className="font-medium">Admin Notes:</span> {request.reviewer_notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No requests yet</p>
                <p className="text-xs mt-1">Your submitted requests will appear here</p>
              </div>
            )}
          </ScrollArea>
        ) : (
          /* New Request Form */
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-5">
              {/* Basic Information */}
              <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
                <h3 className="font-semibold text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Basic Information
                </h3>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="requested-key">
                      Zman Name <span className="text-destructive">*</span>
                    </Label>
                    {/* Key Validation Status */}
                    {requestedKey.trim() && (
                      <div className="flex items-center gap-1.5">
                        {isValidatingKey ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Checking...</span>
                          </>
                        ) : keyExists === false && !keyError ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-xs text-green-600">Available</span>
                          </>
                        ) : keyError || keyExists === true ? (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                            <span className="text-xs text-destructive">Unavailable</span>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <Input
                    id="requested-key"
                    value={requestedKey}
                    onChange={(e) => setRequestedKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    placeholder="e.g., alos_my_minhag"
                    className={`font-mono ${
                      requestedKey.trim() && (keyError || keyExists === true)
                        ? 'border-destructive focus-visible:ring-destructive'
                        : requestedKey.trim() && keyExists === false && !keyError
                        ? 'border-green-500 focus-visible:ring-green-500'
                        : ''
                    }`}
                  />
                  {/* Key Error Message */}
                  {keyError ? (
                    <p className="text-xs text-destructive mt-1 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      {keyError}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      Unique identifier (lowercase, underscores only)
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="hebrew-name">
                    Hebrew Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="hebrew-name"
                    value={hebrewName}
                    onChange={(e) => setHebrewName(e.target.value)}
                    className="font-hebrew"
                    placeholder="שם בעברית"
                    dir="rtl"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <Label htmlFor="english-name">
                    English Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="english-name"
                    value={englishName}
                    onChange={(e) => setEnglishName(e.target.value)}
                    placeholder="English name"
                  />
                </div>

                <div>
                  <Label htmlFor="transliteration">Transliteration</Label>
                  <Input
                    id="transliteration"
                    value={transliteration}
                    onChange={(e) => setTransliteration(e.target.value)}
                    placeholder="e.g., Alos HaShachar"
                  />
                </div>

                <div>
                  <Label htmlFor="time-category">
                    Time Category <span className="text-destructive">*</span>
                  </Label>
                  <Select value={timeCategory} onValueChange={setTimeCategory}>
                    <SelectTrigger id="time-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="afternoon">Afternoon</SelectItem>
                      <SelectItem value="evening">Evening</SelectItem>
                      <SelectItem value="night">Night</SelectItem>
                      <SelectItem value="event">Event-based</SelectItem>
                      <SelectItem value="seasonal">Seasonal</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tags Section */}
              <div className="space-y-4 p-4 rounded-xl bg-gradient-to-br from-blue-50/50 via-purple-50/30 to-pink-50/50 dark:from-blue-950/20 dark:via-purple-950/10 dark:to-pink-950/20 border border-blue-200/50 dark:border-blue-800/30">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <Tag className="h-4 w-4" />
                    Tags
                  </h3>
                  {/* Legend */}
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <span className="w-3 h-3 rounded-full bg-green-500 flex items-center justify-center">
                        <CheckCircle2 className="h-2 w-2 text-white" />
                      </span>
                      Include
                    </span>
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <span className="w-3 h-3 rounded-full border-2 border-red-500 flex items-center justify-center relative">
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="w-[10px] h-[2px] bg-red-500 rotate-45 absolute" />
                        </span>
                      </span>
                      Exclude
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  Click once to include, twice to exclude (NOT), three times to clear.
                </p>

                {tagsLoading || tagTypesLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Tags by Type */}
                    {tagTypeOrder.map(tagType => {
                      const tags = tagsByType[tagType];
                      if (!tags || tags.length === 0) return null;

                      // Get type-specific colors
                      const typeColors = {
                        event: { bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-300 dark:border-blue-700', text: 'text-blue-700 dark:text-blue-300', label: 'text-blue-600 dark:text-blue-400' },
                        timing: { bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-300', label: 'text-orange-600 dark:text-orange-400' },
                        shita: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', border: 'border-cyan-300 dark:border-cyan-700', text: 'text-cyan-700 dark:text-cyan-300', label: 'text-cyan-600 dark:text-cyan-400' },
                        category: { bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-300', label: 'text-amber-600 dark:text-amber-400' },
                        behavior: { bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-300 dark:border-purple-700', text: 'text-purple-700 dark:text-purple-300', label: 'text-purple-600 dark:text-purple-400' },
                        calculation: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', border: 'border-indigo-300 dark:border-indigo-700', text: 'text-indigo-700 dark:text-indigo-300', label: 'text-indigo-600 dark:text-indigo-400' },
                        method: { bg: 'bg-rose-100 dark:bg-rose-900/30', border: 'border-rose-300 dark:border-rose-700', text: 'text-rose-700 dark:text-rose-300', label: 'text-rose-600 dark:text-rose-400' },
                      }[tagType] || { bg: 'bg-gray-100 dark:bg-gray-900/30', border: 'border-gray-300 dark:border-gray-700', text: 'text-gray-700 dark:text-gray-300', label: 'text-gray-600 dark:text-gray-400' };

                      return (
                        <div key={tagType} className="space-y-2">
                          <Label className={cn('text-xs font-semibold uppercase tracking-wide', typeColors.label)}>
                            {tagTypeLabelsMap[tagType] || tagType}
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {tags.map(tag => {
                              const state = getTagState(tag.id);
                              const isIncluded = state === 'included';
                              const isNegated = state === 'negated';

                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => toggleTag(tag.id)}
                                  title={`${tag.description || getTagName(tag)}\n\nClick: Include → Exclude → Clear`}
                                  className={cn(
                                    'relative px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all duration-200 cursor-pointer',
                                    // Base styling
                                    !isIncluded && !isNegated && [
                                      typeColors.bg,
                                      typeColors.border,
                                      typeColors.text,
                                      'opacity-70 hover:opacity-100 hover:scale-105',
                                    ],
                                    // Included state - green
                                    isIncluded && [
                                      'bg-green-500 dark:bg-green-600',
                                      'border-green-600 dark:border-green-500',
                                      'text-white',
                                      'shadow-md shadow-green-200 dark:shadow-green-900/50',
                                      'ring-2 ring-green-300 dark:ring-green-700 ring-offset-1',
                                    ],
                                    // Negated state - red border + line-through
                                    isNegated && [
                                      typeColors.bg,
                                      'border-red-500 dark:border-red-400',
                                      'border-[3px]',
                                      typeColors.text,
                                    ],
                                  )}
                                >
                                  {/* Check mark for included */}
                                  {isIncluded && (
                                    <CheckCircle2 className="inline-block h-3.5 w-3.5 mr-1 -ml-0.5" />
                                  )}

                                  {/* X icon for negated */}
                                  {isNegated && (
                                    <X className="inline-block h-3.5 w-3.5 mr-1 -ml-0.5 text-red-500" />
                                  )}

                                  <span className={cn(isNegated && 'line-through decoration-red-500')}>
                                    {getTagName(tag)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Custom/New Tag Input */}
                <div className="space-y-2 pt-3 border-t border-blue-200/50 dark:border-blue-800/30">
                  <Label className="text-xs font-semibold text-purple-600 dark:text-purple-400">Request New Tag</Label>
                  <div className="flex gap-2">
                    <Input
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      placeholder="Tag name"
                      className="flex-1 text-sm bg-white/80 dark:bg-gray-900/50"
                    />
                    <Select value={customTagType} onValueChange={setCustomTagType}>
                      <SelectTrigger className="w-[140px] bg-white/80 dark:bg-gray-900/50">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {tagTypesData?.map(tt => (
                          <SelectItem key={tt.key} value={tt.key}>
                            {tt.display_name_english}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCustomTag}
                      disabled={!customTagInput.trim() || !customTagType}
                      className="bg-purple-500 hover:bg-purple-600 text-white border-purple-600 disabled:bg-gray-300 disabled:text-gray-500"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    New tags will be reviewed by admins before being added to the system.
                  </p>

                  {/* Requested New Tags */}
                  {requestedNewTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {requestedNewTags.map(tag => (
                        <span
                          key={tag.name}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-sm"
                        >
                          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">NEW</span>
                          {formatTagLabel(tag.name)}
                          <span className="text-xs opacity-80">({tagTypeLabelsMap[tag.type] || tag.type})</span>
                          <button
                            type="button"
                            onClick={() => removeRequestedTag(tag.name)}
                            className="ml-0.5 hover:bg-white/20 rounded-full p-0.5 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Description & Formula */}
              <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-violet-50/50 to-fuchsia-50/50 dark:from-violet-950/20 dark:to-fuchsia-950/20 border border-violet-200/50 dark:border-violet-800/30">
                <h3 className="font-semibold text-sm text-violet-700 dark:text-violet-300 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Details
                </h3>

                <div>
                  <Label htmlFor="description">
                    Description <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this zman represents..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="justification">
                    Justification <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="justification"
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Explain why this zman should be added to the registry..."
                    rows={2}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="formula-dsl">Suggested Formula (optional)</Label>
                    {/* DSL Validation Status */}
                    {formulaDsl.trim() && (
                      <div className="flex items-center gap-1.5">
                        {isValidatingDsl ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Validating...</span>
                          </>
                        ) : dslValid === true ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-xs text-green-600">Valid formula</span>
                          </>
                        ) : dslValid === false ? (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                            <span className="text-xs text-destructive">Invalid</span>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <Textarea
                    id="formula-dsl"
                    value={formulaDsl}
                    onChange={(e) => setFormulaDsl(e.target.value)}
                    placeholder='e.g., sunrise - 72m'
                    className={`font-mono text-sm ${
                      formulaDsl.trim() && dslValid === false
                        ? 'border-destructive focus-visible:ring-destructive'
                        : formulaDsl.trim() && dslValid === true
                        ? 'border-green-500 focus-visible:ring-green-500'
                        : ''
                    }`}
                    rows={2}
                  />
                  {/* DSL Error Message */}
                  {dslError && (
                    <p className="text-xs text-destructive mt-1 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      {dslError}
                    </p>
                  )}
                  {!dslError && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Optional DSL formula suggestion for this zman
                    </p>
                  )}
                </div>
              </div>

              {/* Halachic Sources */}
              <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-amber-50/50 to-yellow-50/50 dark:from-amber-950/20 dark:to-yellow-950/20 border border-amber-200/50 dark:border-amber-800/30">
                <h3 className="font-semibold text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Halachic Sources
                </h3>

                <div>
                  <Label htmlFor="halachic-source">Source Reference</Label>
                  <Input
                    id="halachic-source"
                    value={halachicSource}
                    onChange={(e) => setHalachicSource(e.target.value)}
                    placeholder="e.g., Shulchan Aruch O.C. 89:1"
                    className="bg-white/80 dark:bg-gray-900/50"
                  />
                </div>

                <div>
                  <Label htmlFor="halachic-notes">Halachic Notes</Label>
                  <Textarea
                    id="halachic-notes"
                    value={halachicNotes}
                    onChange={(e) => setHalachicNotes(e.target.value)}
                    placeholder="Optional notes about the halachic basis..."
                    rows={2}
                    className="bg-white/80 dark:bg-gray-900/50"
                  />
                </div>
              </div>

              {/* Auto-add option */}
              <div className="flex items-center space-x-2 p-3 rounded-lg bg-green-50/50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/30">
                <Checkbox
                  id="auto-add"
                  checked={autoAddOnApproval}
                  onCheckedChange={(checked) => setAutoAddOnApproval(checked === true)}
                />
                <Label
                  htmlFor="auto-add"
                  className="text-sm font-normal cursor-pointer"
                >
                  Automatically add this zman to my zmanim when approved
                </Label>
              </div>
            </div>
          </ScrollArea>
        )}

        {!showHistory && (
          <div className="space-y-3">
            {/* Form Error Display */}
            {formError && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="text-sm">{formError}</span>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  handleReset();
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  !requestedKey.trim() ||
                  !hebrewName.trim() ||
                  !englishName.trim() ||
                  !timeCategory ||
                  !description.trim() ||
                  !justification.trim() ||
                  keyExists === true ||
                  !!keyError ||
                  isValidatingKey ||
                  (formulaDsl.trim() && dslValid === false) ||
                  isValidatingDsl ||
                  submitRequest.isPending
                }
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-md"
              >
                {submitRequest.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : isValidatingKey ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking key...
                  </>
                ) : isValidatingDsl ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating formula...
                  </>
                ) : (
                  'Submit Request'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
