/**
 * @file proxy.ts
 * @purpose Next.js proxy (formerly middleware) - auth routing, public/protected route logic
 * @pattern next-proxy
 * @dependencies Clerk auth(), publicRoutes matcher
 * @frequency critical - authentication flow
 * @compliance Check docs/adr/ for pattern rationale
 */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Routes that require authentication
const isPublisherRoute = createRouteMatcher(['/publisher(.*)']);
const isAdminRoute = createRouteMatcher(['/admin(.*)']);

// User roles interface matching the new dual-role metadata structure
interface UserRoles {
  isAdmin: boolean;
  hasPublisherAccess: boolean;
  publisherAccessList: string[];
}

// Helper to extract roles from session claims
// Clerk session token must be customized to include: {"metadata": "{{user.public_metadata}}"}
function getRolesFromClaims(sessionClaims: any): UserRoles {
  const metadata = sessionClaims?.metadata || {};

  const isAdmin = metadata.is_admin === true;
  const publisherAccessList: string[] = metadata.publisher_access_list || [];
  const hasPublisherAccess = publisherAccessList.length > 0;

  return {
    isAdmin,
    hasPublisherAccess,
    publisherAccessList,
  };
}

export default clerkMiddleware(async (auth, req) => {
  // Publisher routes require publisher access or admin role
  if (isPublisherRoute(req)) {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }

    const roles = getRolesFromClaims(sessionClaims);
    if (!roles.hasPublisherAccess && !roles.isAdmin) {
      // Access denied - no publisher access
      return new NextResponse('Forbidden: Publisher access required', { status: 403 });
    }
  }

  // Admin routes require admin role
  if (isAdminRoute(req)) {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }

    const roles = getRolesFromClaims(sessionClaims);
    if (!roles.isAdmin) {
      // Access denied - admin role required
      return new NextResponse('Forbidden: Admin role required', { status: 403 });
    }
  }

  // Explicitly return to allow request to proceed
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
