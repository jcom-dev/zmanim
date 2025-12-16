'use client';

export function DevModeBanner() {
  const envMode = process.env.NEXT_PUBLIC_ENV_MODE || 'dev';

  if (envMode === 'prod') {
    return null;
  }

  return (
    <div className="bg-red-600 text-white px-3 sm:px-4 py-2 text-center">
      <div className="flex items-center justify-center gap-2">
        <svg
          className="w-5 h-5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span className="font-medium text-sm sm:text-base">
          Development Environment - Do not rely on zmanim times
        </span>
      </div>
    </div>
  );
}
