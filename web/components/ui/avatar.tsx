'use client';

import * as React from 'react';
import Image from 'next/image';

interface AvatarProps {
  className?: string;
  children: React.ReactNode;
}

interface AvatarImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
}

interface AvatarFallbackProps {
  children: React.ReactNode;
  className?: string;
}

export function Avatar({ className = '', children }: AvatarProps) {
  return (
    <div className={`relative inline-flex items-center justify-center overflow-hidden rounded-full bg-muted ${className}`}>
      {children}
    </div>
  );
}

export function AvatarImage({ src, alt, className = '' }: AvatarImageProps) {
  const [error, setError] = React.useState(false);

  if (!src || error) {
    return null;
  }

  return (
    <Image
      src={src}
      alt={alt || ''}
      fill
      className={`object-cover ${className}`}
      onError={() => setError(true)}
      unoptimized
    />
  );
}

export function AvatarFallback({ children, className = '' }: AvatarFallbackProps) {
  return (
    <span className={`flex items-center justify-center w-full h-full text-sm font-medium text-muted-foreground ${className}`}>
      {children}
    </span>
  );
}
