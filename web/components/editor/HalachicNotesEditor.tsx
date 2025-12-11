'use client';

import { useState, useCallback, useMemo } from 'react';
import { Eye, Edit3, Bold, Italic, Heading2, List, Link2, BookOpen } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HALACHIC_SOURCES, searchSources, formatCitation } from '@/lib/halachic-sources';

interface HalachicNotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
}

// Simple markdown renderer (no external dependency)
function renderMarkdown(markdown: string): string {
  if (!markdown) return '';

  let html = markdown;

  // Escape HTML first for security
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-3 mb-1">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-4 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline" target="_blank" rel="noopener">$1</a>');

  // Citation format [Source: Reference]
  html = html.replace(/\[([^\]]+)\]/g, '<span class="text-amber-600 dark:text-amber-400 font-medium">[$1]</span>');

  // Lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>');
  html = html.replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc my-2">$&</ul>');

  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, '</p><p class="my-2">');
  html = '<p class="my-2">' + html + '</p>';

  // Single newlines to <br>
  html = html.replace(/\n/g, '<br>');

  return html;
}

export function HalachicNotesEditor({
  value,
  onChange,
  maxLength = 5000,
  disabled = false,
  className,
}: HalachicNotesEditorProps) {
  const [isPreview, setIsPreview] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');

  const filteredSources = useMemo(() => {
    if (!sourceSearch) return HALACHIC_SOURCES.slice(0, 10);
    return searchSources(sourceSearch);
  }, [sourceSearch]);

  const handleInsertFormatting = useCallback((before: string, after: string = before) => {
    const textarea = document.querySelector('textarea[data-halachic-notes]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newValue = value.substring(0, start) + before + selectedText + after + value.substring(end);

    onChange(newValue);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  }, [value, onChange]);

  const handleInsertSource = useCallback((sourceId: string) => {
    const citation = formatCitation(sourceId, '');
    const textarea = document.querySelector('textarea[data-halachic-notes]') as HTMLTextAreaElement;
    if (!textarea) {
      onChange(value + citation);
      return;
    }

    const start = textarea.selectionStart;
    const newValue = value.substring(0, start) + citation + value.substring(start);
    onChange(newValue);
    setShowSourcePicker(false);
    setSourceSearch('');

    setTimeout(() => {
      textarea.focus();
      // Position cursor inside the citation to add reference
      textarea.setSelectionRange(start + citation.length - 1, start + citation.length - 1);
    }, 0);
  }, [value, onChange]);

  const renderedMarkdown = useMemo(() => renderMarkdown(value), [value]);

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Halachic Notes
        </label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant={!isPreview ? 'default' : 'outline-solid'}
            size="sm"
            onClick={() => setIsPreview(false)}
            disabled={disabled}
          >
            <Edit3 className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button
            type="button"
            variant={isPreview ? 'default' : 'outline-solid'}
            size="sm"
            onClick={() => setIsPreview(true)}
            disabled={disabled}
          >
            <Eye className="h-3 w-3 mr-1" />
            Preview
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      {!isPreview && !disabled && (
        <div className="flex flex-wrap gap-1 p-2 bg-muted rounded-t-md border border-b-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleInsertFormatting('**')}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleInsertFormatting('*')}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleInsertFormatting('## ', '')}
            title="Heading"
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleInsertFormatting('- ', '')}
            title="List item"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleInsertFormatting('[', '](url)')}
            title="Link"
          >
            <Link2 className="h-4 w-4" />
          </Button>
          <div className="border-l mx-1" />
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowSourcePicker(!showSourcePicker)}
              title="Insert source citation"
            >
              <BookOpen className="h-4 w-4 mr-1" />
              Source
            </Button>

            {/* Source picker dropdown */}
            {showSourcePicker && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-popover border rounded-md shadow-lg z-50">
                <input
                  type="text"
                  placeholder="Search sources..."
                  className="w-full px-3 py-2 text-sm border-b bg-transparent"
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                  autoFocus
                />
                <div className="max-h-48 overflow-y-auto p-1">
                  {filteredSources.map((source) => (
                    <button
                      key={source.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded"
                      onClick={() => handleInsertSource(source.id)}
                    >
                      <div className="font-medium">{source.name}</div>
                      <div className="text-xs text-muted-foreground font-hebrew" dir="rtl">
                        {source.hebrew}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor or Preview */}
      {isPreview ? (
        <div
          className="min-h-[150px] p-4 border rounded-md bg-card prose prose-sm max-w-none dark:prose-invert"
          dir="auto"
          dangerouslySetInnerHTML={{ __html: renderedMarkdown || '<p class="text-muted-foreground">No notes yet...</p>' }}
        />
      ) : (
        <Textarea
          data-halachic-notes
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          disabled={disabled}
          dir="auto"
          className={cn(
            'min-h-[150px] font-hebrew resize-y',
            !isPreview && 'rounded-t-none'
          )}
          placeholder="Document halachic sources and reasoning...

Example:
## Sources
This follows the **Mishnah Berurah** (סימן רל&quot;ג) who rules...

### References
- [Shulchan Aruch OC 233:1]
- [Biur Halacha ד&quot;ה בצאת]"
        />
      )}

      {/* Character counter */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Supports Markdown and Hebrew text</span>
        <span className={cn(value.length > maxLength * 0.9 && 'text-amber-500', value.length >= maxLength && 'text-destructive')}>
          {value.length} / {maxLength}
        </span>
      </div>
    </div>
  );
}

export default HalachicNotesEditor;
