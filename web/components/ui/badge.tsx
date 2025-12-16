import * as React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'outline' | 'outline-solid' | 'destructive' | 'solid';
}

export function Badge({ children, variant = 'default', className = '', ...props }: BadgeProps) {
  const variantClasses = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    outline: 'border border-border text-foreground bg-transparent',
    'outline-solid': 'border border-border text-foreground bg-background',
    destructive: 'bg-destructive text-destructive-foreground',
    // solid: minimal base styles - expects custom bg/text/border classes via className
    solid: 'border',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
