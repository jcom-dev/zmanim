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
import { Loader2, Plus, FileText, X, Tag, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

interface ZmanRequestListResponse {
  requests: ZmanRequest[];
  total: number;
}

interface ZmanTag {
  id: string;
  tag_key: string;
  name: string;
  display_name_hebrew: string;
  display_name_english: string;
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
  const [formulaDsl, setFormulaDsl] = useState('');
  const [halachicNotes, setHalachicNotes] = useState('');
  const [halachicSource, setHalachicSource] = useState('');
  const [autoAddOnApproval, setAutoAddOnApproval] = useState(true);

  // Tags state
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
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
    setFormulaDsl('');
    setHalachicNotes('');
    setHalachicSource('');
    setAutoAddOnApproval(true);
    setSelectedTagIds([]);
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

    await submitRequest.mutateAsync({
      requested_key: requestedKey.trim(),
      requested_hebrew_name: hebrewName.trim(),
      requested_english_name: englishName.trim(),
      transliteration: transliteration.trim() || undefined,
      time_category: timeCategory,
      tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      requested_new_tags: requestedNewTags.length > 0 ? requestedNewTags : undefined,
      description: description.trim(),
      requested_formula_dsl: formulaDsl.trim() || undefined,
      halachic_notes: halachicNotes.trim() || undefined,
      halachic_source: halachicSource.trim() || undefined,
      auto_add_on_approval: autoAddOnApproval,
    });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
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
            <div className="space-y-4">
              {/* Basic Information */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Basic Information</h3>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="requested-key">
                      Zman Key <span className="text-destructive">*</span>
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
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tags
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select tags that describe this zman. You can also request new tags.
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

                      return (
                        <div key={tagType} className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">
                            {tagTypeLabelsMap[tagType] || tagType}
                          </Label>
                          <div className="flex flex-wrap gap-1.5">
                            {tags.map(tag => (
                              <Badge
                                key={tag.id}
                                variant={selectedTagIds.includes(tag.id) ? 'default' : 'outline-solid'}
                                className="cursor-pointer hover:bg-primary/80 transition-colors"
                                onClick={() => toggleTag(tag.id)}
                                title={tag.description || tag.display_name_english}
                              >
                                {tag.display_name_english}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Custom/New Tag Input */}
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-xs">Request New Tag</Label>
                  <div className="flex gap-2">
                    <Input
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      placeholder="Tag name"
                      className="flex-1 text-sm"
                    />
                    <Select value={customTagType} onValueChange={setCustomTagType}>
                      <SelectTrigger className="w-[140px]">
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
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    New tags will be reviewed by admins before being added to the system.
                  </p>

                  {/* Requested New Tags */}
                  {requestedNewTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {requestedNewTags.map(tag => (
                        <Badge
                          key={tag.name}
                          variant="secondary"
                          className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                        >
                          {formatTagLabel(tag.name)}
                          <span className="ml-1 text-xs opacity-70">({tagTypeLabelsMap[tag.type] || tag.type})</span>
                          <button
                            type="button"
                            onClick={() => removeRequestedTag(tag.name)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Description & Formula */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Details</h3>

                <div>
                  <Label htmlFor="description">
                    Description <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe this zman and how it is calculated..."
                    rows={3}
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
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Halachic Sources</h3>

                <div>
                  <Label htmlFor="halachic-source">Source Reference</Label>
                  <Input
                    id="halachic-source"
                    value={halachicSource}
                    onChange={(e) => setHalachicSource(e.target.value)}
                    placeholder="e.g., Shulchan Aruch O.C. 89:1"
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
                  />
                </div>
              </div>

              {/* Auto-add option */}
              <div className="flex items-center space-x-2">
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
                  keyExists === true ||
                  !!keyError ||
                  isValidatingKey ||
                  (formulaDsl.trim() && dslValid === false) ||
                  isValidatingDsl ||
                  submitRequest.isPending
                }
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
