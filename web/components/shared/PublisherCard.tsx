'use client';

import Image from 'next/image';
import { Building2, Globe, Mail, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PublisherCardProps {
  name: string;
  logoUrl?: string | null;
  website?: string | null;
  email?: string | null;
  bio?: string | null;
  isVerified?: boolean;
  subscriberCount?: number;
  onClick?: () => void;
}

export function PublisherCard({
  name,
  logoUrl,
  website,
  email,
  bio,
  isVerified = false,
  subscriberCount = 0,
  onClick,
}: PublisherCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <Card
      className={`hover:shadow-lg transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <CardHeader>
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="shrink-0">
            {logoUrl ? (
              <div className="relative w-16 h-16">
                <Image
                  src={logoUrl}
                  alt={`${name} logo`}
                  fill
                  className="rounded-lg object-cover border border-border"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-background">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl truncate">{name}</CardTitle>
              {isVerified && (
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" aria-label="Verified Publisher" />
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Bio */}
        {bio && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {bio}
          </p>
        )}

        {/* Contact Info */}
        <div className="space-y-2">
          {website && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="w-4 h-4 shrink-0" />
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary hover:underline truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-4 h-4 shrink-0" />
              <a
                href={`mailto:${email}`}
                className="hover:text-primary hover:underline truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {email}
              </a>
            </div>
          )}
        </div>

        {/* Subscriber Count */}
        {subscriberCount > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {subscriberCount.toLocaleString()} {subscriberCount === 1 ? 'subscriber' : 'subscribers'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
