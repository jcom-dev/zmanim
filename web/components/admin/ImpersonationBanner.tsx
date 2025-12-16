'use client';

import { usePublisherContext } from '@/providers/PublisherContext';

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedPublisher, exitImpersonation } = usePublisherContext();

  if (!isImpersonating || !impersonatedPublisher) {
    return null;
  }

  return (
    <div className="bg-yellow-500 text-yellow-950 px-3 sm:px-4 py-2">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="min-w-0">
            <span className="font-medium text-sm sm:text-base">
              Impersonating: {impersonatedPublisher.name}
            </span>
          </div>
        </div>
        <button
          onClick={exitImpersonation}
          className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded text-sm font-medium transition-colors whitespace-nowrap shrink-0"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Exit
        </button>
      </div>
    </div>
  );
}
