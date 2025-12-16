'use client';

import { HelpCircle, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface InfoTooltipProps {
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
  iconClassName?: string;
  variant?: 'help' | 'info';
  asChild?: boolean;
  children?: React.ReactNode;
}

/**
 * InfoTooltip - A reusable tooltip component with an info/help icon trigger
 *
 * Usage:
 * - As standalone icon: <InfoTooltip content="Explanation here" />
 * - Wrapping element: <InfoTooltip content="Help text"><Button>Click</Button></InfoTooltip>
 */
export function InfoTooltip({
  content,
  side = 'top',
  align = 'center',
  className,
  iconClassName,
  variant = 'help',
  asChild = false,
  children,
}: InfoTooltipProps) {
  const Icon = variant === 'help' ? HelpCircle : Info;

  return (
    <Tooltip>
      <TooltipTrigger asChild={asChild || !!children}>
        {children || (
          <span
            role="button"
            tabIndex={0}
            className={cn(
              'inline-flex items-center justify-center rounded-full cursor-pointer',
              'text-muted-foreground hover:text-foreground',
              'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
              'transition-colors duration-200',
              className
            )}
            aria-label="More information"
          >
            <Icon className={cn('h-4 w-4', iconClassName)} />
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        className="max-w-xs text-sm"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * LabelWithTooltip - A label element with an integrated tooltip icon
 * Perfect for form field labels that need explanation
 */
interface LabelWithTooltipProps {
  label: string;
  tooltip: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function LabelWithTooltip({
  label,
  tooltip,
  htmlFor,
  required = false,
  className,
  side = 'top',
}: LabelWithTooltipProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <InfoTooltip content={tooltip} side={side} />
    </div>
  );
}

/**
 * StatusTooltip - Wraps status badges to add explanatory tooltips
 */
interface StatusTooltipProps {
  status: string;
  tooltip: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function StatusTooltip({
  tooltip,
  children,
  side = 'top',
}: StatusTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">{children}</span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-sm">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
