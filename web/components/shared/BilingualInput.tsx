'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, RotateCcw, Edit2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BilingualInputProps {
  nameHebrew: string;
  nameEnglish: string;
  transliteration?: string;
  onHebrewChange: (value: string) => void;
  onEnglishChange: (value: string) => void;
  onTransliterationChange?: (value: string) => void;
  errors?: {
    name_hebrew?: string;
    name_english?: string;
    transliteration?: string;
  };
  disabled?: boolean;
  className?: string;
  // Source values for diff/revert functionality
  sourceHebrewName?: string | null;
  sourceEnglishName?: string | null;
  sourceTransliteration?: string | null;
  sourceName?: string; // e.g., "Registry" or publisher name
}

/**
 * Checks if a string contains Hebrew characters (U+0590-U+05FF)
 */
function containsHebrew(str: string): boolean {
  return /[\u0590-\u05FF]/.test(str);
}

/**
 * BilingualInput - Input component for Hebrew and English zman names
 *
 * Features:
 * - Side-by-side Hebrew and English input fields
 * - RTL direction for Hebrew input
 * - Hebrew character validation indicator
 * - Optional transliteration field
 * - Change indicator when name differs from source
 * - Revert button to restore source name
 */
export function BilingualInput({
  nameHebrew,
  nameEnglish,
  transliteration,
  onHebrewChange,
  onEnglishChange,
  onTransliterationChange,
  errors,
  disabled = false,
  className,
  sourceHebrewName,
  sourceEnglishName,
  sourceTransliteration,
  sourceName = 'Source',
}: BilingualInputProps) {
  const [hebrewFocused, setHebrewFocused] = useState(false);
  const hasHebrew = containsHebrew(nameHebrew);

  // Check if values have been modified from source
  const hebrewChanged = sourceHebrewName != null && nameHebrew !== sourceHebrewName;
  const englishChanged = sourceEnglishName != null && nameEnglish !== sourceEnglishName;
  const transliterationChanged = sourceTransliteration != null && transliteration !== sourceTransliteration;

  const handleHebrewChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onHebrewChange(e.target.value);
    },
    [onHebrewChange]
  );

  const handleEnglishChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onEnglishChange(e.target.value);
    },
    [onEnglishChange]
  );

  const handleTransliterationChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onTransliterationChange?.(e.target.value);
    },
    [onTransliterationChange]
  );

  const handleRevertHebrew = useCallback(() => {
    if (sourceHebrewName != null) {
      onHebrewChange(sourceHebrewName);
    }
  }, [sourceHebrewName, onHebrewChange]);

  const handleRevertEnglish = useCallback(() => {
    if (sourceEnglishName != null) {
      onEnglishChange(sourceEnglishName);
    }
  }, [sourceEnglishName, onEnglishChange]);

  const handleRevertTransliteration = useCallback(() => {
    if (sourceTransliteration != null && onTransliterationChange) {
      onTransliterationChange(sourceTransliteration);
    }
  }, [sourceTransliteration, onTransliterationChange]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Hebrew and English side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hebrew Name */}
        <div className="space-y-2">
          <Label htmlFor="name_hebrew" className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              Hebrew Name <span className="text-destructive">*</span>
              {hebrewChanged && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Edit2 className="h-3 w-3" />
                        <span className="text-xs">Modified</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-sm">
                        {sourceName}: <span className="font-hebrew">{sourceHebrewName}</span>
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </span>
            <span className="text-xs text-muted-foreground font-hebrew">שם בעברית</span>
          </Label>
          <div className="relative">
            <Input
              id="name_hebrew"
              dir="rtl"
              className={cn(
                'font-hebrew text-right pr-10',
                hebrewChanged && 'border-amber-500/50 ring-1 ring-amber-500/20',
                errors?.name_hebrew && 'border-destructive'
              )}
              value={nameHebrew}
              onChange={handleHebrewChange}
              onFocus={() => setHebrewFocused(true)}
              onBlur={() => setHebrewFocused(false)}
              placeholder="עלות השחר"
              disabled={disabled}
            />
            {/* Validation indicator */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {hebrewChanged && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-900/50"
                        onClick={handleRevertHebrew}
                        disabled={disabled}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-sm">Revert to {sourceName.toLowerCase()} name</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {nameHebrew.length > 0 && (
                hasHebrew ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )
              )}
            </div>
          </div>
          {/* Validation status */}
          <div className="text-xs">
            {errors?.name_hebrew ? (
              <span className="text-destructive">{errors.name_hebrew}</span>
            ) : hebrewFocused && nameHebrew.length > 0 && !hasHebrew ? (
              <span className="text-destructive">Must contain Hebrew characters (א-ת)</span>
            ) : hebrewChanged ? (
              <span className="text-muted-foreground">
                Changed from <span className="font-hebrew">&ldquo;{sourceHebrewName}&rdquo;</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* English Name */}
        <div className="space-y-2">
          <Label htmlFor="name_english" className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              English Name <span className="text-destructive">*</span>
              {englishChanged && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Edit2 className="h-3 w-3" />
                        <span className="text-xs">Modified</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-sm">
                        {sourceName}: {sourceEnglishName}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </span>
          </Label>
          <div className="relative">
            <Input
              id="name_english"
              className={cn(
                englishChanged && 'border-amber-500/50 ring-1 ring-amber-500/20',
                errors?.name_english && 'border-destructive'
              )}
              value={nameEnglish}
              onChange={handleEnglishChange}
              placeholder="Dawn"
              disabled={disabled}
            />
            {englishChanged && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-900/50"
                        onClick={handleRevertEnglish}
                        disabled={disabled}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-sm">Revert to {sourceName.toLowerCase()} name</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
          <div className="text-xs">
            {errors?.name_english ? (
              <p className="text-destructive">{errors.name_english}</p>
            ) : englishChanged ? (
              <p className="text-muted-foreground">Changed from &ldquo;{sourceEnglishName}&rdquo;</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Transliteration (optional) */}
      {onTransliterationChange && (
        <div className="space-y-2">
          <Label htmlFor="transliteration" className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span>Transliteration</span>
              <span className="text-xs text-muted-foreground">(optional)</span>
              {transliterationChanged && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Edit2 className="h-3 w-3" />
                        <span className="text-xs">Modified</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-sm">
                        {sourceName}: {sourceTransliteration}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </span>
          </Label>
          <div className="relative">
            <Input
              id="transliteration"
              className={cn(
                transliterationChanged && 'border-amber-500/50 ring-1 ring-amber-500/20',
                errors?.transliteration && 'border-destructive'
              )}
              value={transliteration || ''}
              onChange={handleTransliterationChange}
              placeholder="Alos HaShachar"
              disabled={disabled}
            />
            {transliterationChanged && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-900/50"
                        onClick={handleRevertTransliteration}
                        disabled={disabled}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-sm">Revert to {sourceName.toLowerCase()}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
          <div className="text-xs">
            {errors?.transliteration ? (
              <p className="text-destructive">{errors.transliteration}</p>
            ) : transliterationChanged ? (
              <p className="text-muted-foreground">Changed from &ldquo;{sourceTransliteration}&rdquo;</p>
            ) : (
              <p className="text-muted-foreground">Phonetic pronunciation for non-Hebrew speakers</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BilingualInput;
