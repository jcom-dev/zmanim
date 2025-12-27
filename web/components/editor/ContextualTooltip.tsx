'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { DSLContext, TooltipOption } from '@/lib/dsl-context-helper';
import { getTooltipData } from '@/lib/dsl-context-helper';

interface ContextualTooltipProps {
  context: DSLContext;
  position: { x: number; y: number } | null;
  onInsert: (value: string) => void;
  onDismiss: () => void;
  visible: boolean;
}

export function ContextualTooltip({
  context,
  position,
  onInsert,
  onDismiss,
  visible,
}: ContextualTooltipProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);

  const tooltipData = getTooltipData(context);

  // Reset selection when context changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [context.type]);

  // Calculate position to avoid viewport overflow
  useEffect(() => {
    if (!position || !tooltipRef.current || !visible) {
      setTooltipPosition(null);
      return;
    }

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    let top = position.y - rect.height - 8; // Above cursor by default
    let left = position.x;

    // If tooltip would go above viewport, show below cursor
    if (top < 8) {
      top = position.y + 24; // Below cursor
    }

    // If tooltip would go off right edge
    if (left + rect.width > viewportWidth - 8) {
      left = viewportWidth - rect.width - 8;
    }

    // If tooltip would go off left edge
    if (left < 8) {
      left = 8;
    }

    setTooltipPosition({ top, left });
  }, [position, visible]);

  // Keyboard navigation
  useEffect(() => {
    if (!visible || !tooltipData) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => (i > 0 ? i - 1 : tooltipData.options.length - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => (i < tooltipData.options.length - 1 ? i + 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (tooltipData.options[selectedIndex]) {
            onInsert(tooltipData.options[selectedIndex].value);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onDismiss();
          break;
        case 'Tab':
          onDismiss();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, tooltipData, selectedIndex, onInsert, onDismiss]);

  // Click outside to dismiss
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };

    // Delay adding listener to prevent immediate dismiss
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible, onDismiss]);

  if (!visible || !tooltipData || !position) {
    return null;
  }

  const handleOptionClick = (option: TooltipOption) => {
    onInsert(option.value);
  };

  return (
    <div
      ref={tooltipRef}
      role="listbox"
      aria-label={tooltipData.title}
      className={cn(
        'fixed z-50 min-w-[280px] max-w-[380px]',
        'bg-popover text-popover-foreground',
        'border border-border rounded-lg shadow-lg',
        'animate-in fade-in-0 zoom-in-95 duration-150',
        !tooltipPosition && 'invisible'
      )}
      style={tooltipPosition ? { top: tooltipPosition.top, left: tooltipPosition.left } : {}}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-muted/30 rounded-t-lg">
        <h4 className="font-medium text-sm">{tooltipData.title}</h4>
        {tooltipData.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{tooltipData.description}</p>
        )}
      </div>

      {/* Options */}
      <ul className="p-1 max-h-[200px] overflow-y-auto">
        {tooltipData.options.map((option, index) => (
          <li
            key={option.value}
            role="option"
            aria-selected={index === selectedIndex}
            className={cn(
              'px-3 py-2 rounded-md cursor-pointer transition-colors',
              'flex items-center justify-between gap-2',
              index === selectedIndex
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-muted'
            )}
            onClick={() => handleOptionClick(option)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm font-medium truncate">{option.label}</div>
              {option.description && (
                <div className="text-xs text-muted-foreground truncate">
                  {option.description}
                  {option.hebrewDescription && (
                    <span className="mr-1 rtl:mr-0 rtl:ml-1"> • {option.hebrewDescription}</span>
                  )}
                </div>
              )}
            </div>
            {index === selectedIndex && (
              <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                ↵
              </kbd>
            )}
          </li>
        ))}
      </ul>

      {/* Footer hint */}
      {tooltipData.hint && (
        <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground bg-muted/20 rounded-b-lg">
          {tooltipData.hint}
        </div>
      )}

      {/* Keyboard hint */}
      <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground flex gap-3">
        <span><kbd className="bg-muted px-1 rounded">↑↓</kbd> navigate</span>
        <span><kbd className="bg-muted px-1 rounded">↵</kbd> select</span>
        <span><kbd className="bg-muted px-1 rounded">Esc</kbd> close</span>
      </div>
    </div>
  );
}

export default ContextualTooltip;
