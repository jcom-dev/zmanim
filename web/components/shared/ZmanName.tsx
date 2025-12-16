'use client';

import { cn } from '@/lib/utils';

interface ZmanNameProps {
  nameHebrew: string;
  nameEnglish: string;
  transliteration?: string;
  locale?: 'he' | 'en';
  showBoth?: boolean;
  className?: string;
}

/**
 * ZmanName - Displays a zman name with bilingual support
 *
 * Renders Hebrew text with RTL direction and proper font,
 * or English text with LTR direction based on locale.
 */
export function ZmanName({
  nameHebrew,
  nameEnglish,
  transliteration,
  locale = 'en',
  showBoth = false,
  className,
}: ZmanNameProps) {
  const isHebrew = locale === 'he';
  const displayName = isHebrew ? nameHebrew : nameEnglish;

  if (showBoth) {
    return (
      <div className={cn('flex flex-col gap-0.5', className)}>
        <span dir="ltr" className="text-foreground">
          {nameEnglish}
        </span>
        <span dir="rtl" className="font-hebrew text-muted-foreground text-sm">
          {nameHebrew}
        </span>
        {transliteration && (
          <span className="text-xs text-muted-foreground italic">
            {transliteration}
          </span>
        )}
      </div>
    );
  }

  return (
    <span
      dir={isHebrew ? 'rtl' : 'ltr'}
      className={cn(
        isHebrew && 'font-hebrew',
        className
      )}
      title={transliteration || (isHebrew ? nameEnglish : nameHebrew)}
    >
      {displayName}
    </span>
  );
}

/**
 * ZmanNameCompact - Compact version showing primary name with hover tooltip
 */
export function ZmanNameCompact({
  nameHebrew,
  nameEnglish,
  transliteration,
  locale = 'en',
  className,
}: Omit<ZmanNameProps, 'showBoth'>) {
  const isHebrew = locale === 'he';
  const primaryName = isHebrew ? nameHebrew : nameEnglish;
  const secondaryName = isHebrew ? nameEnglish : nameHebrew;

  return (
    <span
      dir={isHebrew ? 'rtl' : 'ltr'}
      className={cn(
        'cursor-help',
        isHebrew && 'font-hebrew',
        className
      )}
      title={`${secondaryName}${transliteration ? ` (${transliteration})` : ''}`}
    >
      {primaryName}
    </span>
  );
}

/**
 * ZmanNameInline - Inline display with both names
 */
export function ZmanNameInline({
  nameHebrew,
  nameEnglish,
  separator = ' / ',
  className,
}: {
  nameHebrew: string;
  nameEnglish: string;
  separator?: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span>{nameEnglish}</span>
      <span className="text-muted-foreground">{separator}</span>
      <span dir="rtl" className="font-hebrew">
        {nameHebrew}
      </span>
    </span>
  );
}

export default ZmanName;
