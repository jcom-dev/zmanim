/**
 * @file ZmanMetadataEditor.tsx
 * @purpose Modal for editing zman metadata (names, description, AI explanation)
 * @pattern client-component
 * @dependencies Dialog, BilingualInput, useUpdateZman
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BilingualInput } from '@/components/shared/BilingualInput';
import { cn, isHebrewText } from '@/lib/utils';
import { useApi } from '@/lib/api-client';
import { useUpdateZman, type PublisherZman } from '@/lib/hooks/useZmanimList';
import {
  Loader2,
  Sparkles,
  Save,
  ChevronDown,
  ArrowDownToLine,
} from 'lucide-react';
import { toast } from 'sonner';

interface ZmanMetadataEditorProps {
  zman: PublisherZman;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ZmanMetadataEditor - Modal for editing zman metadata
 *
 * Features:
 * - Bilingual name editing (Hebrew/English)
 * - AI explanation generation (Mixed/English/Hebrew)
 * - Publisher comment field
 * - Revert to source functionality
 */
export function ZmanMetadataEditor({
  zman,
  open,
  onOpenChange,
}: ZmanMetadataEditorProps) {
  const api = useApi();
  const updateZman = useUpdateZman(zman.zman_key);

  // Form state
  const [hebrewName, setHebrewName] = useState(zman.hebrew_name);
  const [englishName, setEnglishName] = useState(zman.english_name);
  const [aiExplanation, setAiExplanation] = useState(zman.ai_explanation || '');
  const [publisherComment, setPublisherComment] = useState(zman.publisher_comment || '');
  const [aiExplanationOpen, setAiExplanationOpen] = useState(true);
  const [publisherCommentOpen, setPublisherCommentOpen] = useState(!!zman.publisher_comment);

  // Generation state
  const [generatingExplanation, setGeneratingExplanation] = useState<'en' | 'he' | 'mixed' | null>(null);

  // Reset form when zman changes or modal opens
  useEffect(() => {
    if (open) {
      setHebrewName(zman.hebrew_name);
      setEnglishName(zman.english_name);
      setAiExplanation(zman.ai_explanation || '');
      setPublisherComment(zman.publisher_comment || '');
      setAiExplanationOpen(true);
      setPublisherCommentOpen(!!zman.publisher_comment);
    }
  }, [open, zman]);

  // Track changes
  const hasChanges =
    hebrewName !== zman.hebrew_name ||
    englishName !== zman.english_name ||
    aiExplanation !== (zman.ai_explanation || '') ||
    publisherComment !== (zman.publisher_comment || '');

  // Generate AI explanation
  const handleGenerateExplanation = async (language: 'en' | 'he' | 'mixed') => {
    if (!zman.formula_dsl.trim()) {
      toast.error('No formula to explain');
      return;
    }

    setGeneratingExplanation(language);
    try {
      const response = await api.post<{ explanation: string; language: string; source: string }>(
        '/ai/explain-formula',
        { body: JSON.stringify({ formula: zman.formula_dsl, language }) }
      );
      setAiExplanation(response.explanation);
      setAiExplanationOpen(true);
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
    if (!hebrewName.trim() || !englishName.trim()) {
      toast.error('Names are required');
      return;
    }

    try {
      await updateZman.mutateAsync({
        hebrew_name: hebrewName,
        english_name: englishName,
        ai_explanation: aiExplanation || undefined,
        publisher_comment: publisherComment || undefined,
      });
      toast.success('Zman updated');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update zman:', error);
      toast.error('Failed to update zman');
    }
  };

  // Get source name for diff display
  const sourceName = zman.is_linked
    ? zman.linked_source_publisher_name || 'Linked Publisher'
    : 'Registry';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-hebrew">{zman.hebrew_name}</span>
            <span className="text-muted-foreground">•</span>
            <span>{zman.english_name}</span>
          </DialogTitle>
          <DialogDescription>
            Edit the display names, AI explanation, and publisher comment for this zman.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Bilingual Name Inputs */}
          <BilingualInput
            nameHebrew={hebrewName}
            nameEnglish={englishName}
            onHebrewChange={setHebrewName}
            onEnglishChange={setEnglishName}
            sourceHebrewName={zman.source_hebrew_name}
            sourceEnglishName={zman.source_english_name}
            sourceName={sourceName}
          />

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
                {aiExplanation && !aiExplanationOpen && (
                  <span className="text-xs text-muted-foreground">(has content)</span>
                )}
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
                    disabled={generatingExplanation !== null}
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
                    disabled={generatingExplanation !== null}
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
                    disabled={generatingExplanation !== null}
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
                  placeholder="Generate an AI explanation of the formula..."
                  rows={3}
                  className={cn(
                    'min-h-[80px] resize-none',
                    isHebrewText(aiExplanation) && 'text-right'
                  )}
                  dir={isHebrewText(aiExplanation) ? 'rtl' : 'ltr'}
                />
                {aiExplanation.trim() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPublisherComment(aiExplanation);
                      setPublisherCommentOpen(true);
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
                <Label className="text-sm font-medium cursor-pointer">Publisher Comment</Label>
                {publisherComment && !publisherCommentOpen && (
                  <span className="text-xs text-muted-foreground">(has content)</span>
                )}
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateZman.isPending}
          >
            {updateZman.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
