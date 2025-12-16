'use client';

import { useEffect, useState, Suspense } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useApi } from '@/lib/api-client';

function AcceptInvitationContent() {
  const { isLoaded, isSignedIn, user } = useUser();
  const api = useApi();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'accepting' | 'success' | 'error' | 'redirect'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [publisherName, setPublisherName] = useState<string | null>(null);

  const handleClerkInvitation = () => {
    // Original Clerk invitation flow
    if (!isSignedIn || !user) {
      router.push('/sign-up');
      return;
    }

    const metadata = user.publicMetadata as { is_admin?: boolean; publisher_access_list?: string[] };

    if (metadata?.publisher_access_list?.length) {
      router.push('/publisher/dashboard');
    } else {
      router.push('/');
    }
  };

  const acceptInvitation = async () => {
    if (!token) return;

    setStatus('accepting');

    try {
      const data = await api.post<{ publisher_name: string }>('/publisher/team/accept', {
        body: JSON.stringify({ token }),
      });

      setPublisherName(data?.publisher_name || null);
      setStatus('success');

      // Redirect to publisher dashboard after a short delay
      setTimeout(() => {
        router.push(`/publisher/dashboard`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
      setStatus('error');
    }
  };

  useEffect(() => {
    if (!isLoaded) return;

    // If there's a token, this is a publisher team invitation
    if (token) {
      if (!isSignedIn) {
        // User needs to sign in first
        // Preserve the token in the URL after sign-in
        const returnUrl = `/accept-invitation?token=${encodeURIComponent(token)}`;
        router.push(`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`);
        return;
      }

      // User is signed in, accept the invitation
      acceptInvitation();
    } else {
      // No token - this is the old Clerk invitation flow
      handleClerkInvitation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, token]);

  if (status === 'loading' || status === 'redirect') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <CardTitle>Welcome to Shtetl Zmanim!</CardTitle>
            <CardDescription>
              Setting up your account...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
            <p className="mt-4 text-muted-foreground">
              Please wait while we redirect you.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'accepting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <CardTitle>Accepting Invitation</CardTitle>
            <CardDescription>
              Please wait while we add you to the team...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4 border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-950">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <CardTitle className="text-green-800 dark:text-green-200">Welcome to the Team!</CardTitle>
            <CardDescription className="text-green-700 dark:text-green-300">
              You&apos;ve been added to {publisherName}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-green-700 dark:text-green-300 mb-4">
              Redirecting you to the dashboard...
            </p>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 dark:border-green-400 mx-auto"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4 border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-950">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <CardTitle className="text-red-800 dark:text-red-200">Invitation Error</CardTitle>
            <CardDescription className="text-red-700 dark:text-red-300">
              {error || 'This invitation is invalid or has expired.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-red-700 dark:text-red-300 mb-6">
              Please contact the person who invited you to request a new invitation.
            </p>
            <Link href="/">
              <Button variant="outline" className="border-red-600 text-red-700 dark:border-red-400 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900">
                Return to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    }>
      <AcceptInvitationContent />
    </Suspense>
  );
}
