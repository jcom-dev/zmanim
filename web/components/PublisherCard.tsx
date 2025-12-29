/**
 * @file PublisherCard.tsx
 * @description Display card for a zmanim publisher organization
 * @module components
 *
 * Displays publisher information including:
 * - Name and logo
 * - Verified badge (if applicable)
 * - Subscriber count
 * - Description
 * - Website link
 *
 * Used in publisher listings and selection interfaces.
 *
 * @example
 * ```tsx
 * <PublisherCard
 *   publisher={publisher}
 *   onSelect={(p) => setSelectedPublisher(p)}
 *   isSelected={selectedPublisher?.id === publisher.id}
 * />
 * ```
 */
'use client';

import Image from 'next/image';
import { Publisher } from '@/lib/api';

/**
 * Props for the PublisherCard component
 */
interface PublisherCardProps {
  /** Publisher data to display */
  publisher: Publisher;
  /** Optional selection handler */
  onSelect?: (publisher: Publisher) => void;
  /** Whether this card is currently selected */
  isSelected?: boolean;
}

export default function PublisherCard({ publisher, onSelect, isSelected }: PublisherCardProps) {
  return (
    <div
      onClick={() => onSelect?.(publisher)}
      className={`
        relative bg-card rounded-2xl border-2 p-6 transition-all duration-200 cursor-pointer
        hover:shadow-lg hover:-translate-y-1
        ${isSelected
          ? 'border-blue-500 shadow-lg ring-2 ring-blue-200'
          : 'border-border hover:border-blue-300'
        }
      `}
    >
      {/* Verified Badge */}
      {publisher.is_verified && (
        <div className="absolute top-4 right-4">
          <div className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full flex items-center">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Verified
          </div>
        </div>
      )}

      {/* Publisher Logo */}
      <div className="flex items-center mb-4">
        {publisher.logo_url ? (
          <div className="relative w-16 h-16 mr-4">
            <Image
              src={publisher.logo_url}
              alt={`${publisher.name} logo`}
              fill
              className="rounded-xl object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-4">
            <span className="text-2xl text-white font-bold">
              {publisher.name.charAt(0)}
            </span>
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-xl font-bold text-foreground">{publisher.name}</h3>
          <div className="flex items-center text-sm text-muted-foreground mt-1">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            {publisher.subscriber_count.toLocaleString()} subscribers
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
        {publisher.description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <a
          href={publisher.website}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-primary hover:text-primary/80 text-sm font-medium flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Website
        </a>
        {isSelected && (
          <div className="text-primary font-semibold text-sm flex items-center">
            <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Selected
          </div>
        )}
      </div>
    </div>
  );
}
