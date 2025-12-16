'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2, XCircle, AlertCircle, Clock, UserCheck, UserPlus } from 'lucide-react';

interface VerificationResponse {
  valid: boolean;
  user_status?: 'existing' | 'new';
  user_first_name?: string;
  publisher_name?: string;
  expired?: boolean;
  message?: string;
}

export default function VerifyRegistrationPage() {
  const params = useParams();
  const router = useRouter();
  const api = useApi();
  const token = params.token as string;

  const [verification, setVerification] = useState<VerificationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      try {
        setLoading(true);
        const response = await api.public.get<VerificationResponse>(
          `/publishers/register/verify/${token}`
        );
        setVerification(response);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to verify token';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      verifyToken();
    }
  }, [token, api.public]);

  const handleConfirm = async (isConfirmed: boolean) => {
    if (!verification) return;

    try {
      setConfirming(true);
      setError(null);

      await api.public.post(
        `/publishers/register/confirm/${token}`,
        {
          body: JSON.stringify({ confirmed: isConfirmed }),
        }
      );

      if (isConfirmed) {
        setConfirmed(true);
      } else {
        // Cancelled - redirect home
        router.push('/');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to confirm registration';
      setError(message);
    } finally {
      setConfirming(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-lg">Verifying your email...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state or invalid token
  if (error || !verification || !verification.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <CardTitle>Verification Failed</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {verification?.expired ? (
              <Alert variant="destructive">
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  This verification link has expired. Please submit a new publisher registration request.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {verification?.message || error || 'Invalid or expired verification token. Please try again or contact support.'}
                </AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => router.push('/')}
              >
                Return Home
              </Button>
              <Button
                className="flex-1"
                onClick={() => router.push('/register')}
              >
                Register Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already confirmed - show success message
  if (confirmed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <CardTitle>Application Submitted!</CardTitle>
            </div>
            <CardDescription>
              Your publisher registration is now under review
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <strong>{verification.publisher_name}</strong> has been submitted for admin review.
                You&apos;ll receive an email once your application is approved.
              </AlertDescription>
            </Alert>
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium">What happens next?</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Our team will review your application</li>
                <li>You&apos;ll receive an email with the decision</li>
                <li>If approved, you can sign in and start publishing zmanim</li>
              </ol>
            </div>
            <Button
              className="w-full"
              onClick={() => router.push('/')}
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verification successful - show confirmation UI
  const { user_status, user_first_name, publisher_name } = verification;
  const isExistingUser = user_status === 'existing';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <CardTitle>Email Verified!</CardTitle>
          </div>
          <CardDescription>
            Complete your registration for <strong>{publisher_name}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isExistingUser ? (
            // Existing user - show confirmation dialog
            <div className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                <UserCheck className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <p className="font-medium">Welcome back{user_first_name ? `, ${user_first_name}` : ''}!</p>
                  <p className="mt-1">We found an existing account with this email address. Your new publisher will be linked to this account.</p>
                </AlertDescription>
              </Alert>

              <p className="text-sm text-muted-foreground">
                Is this your account? Confirm to continue with the publisher registration.
              </p>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleConfirm(false)}
                  disabled={confirming}
                >
                  No, not me
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleConfirm(true)}
                  disabled={confirming}
                >
                  {confirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    "Yes, that's me"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            // New user - just confirm and proceed to admin review
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <UserPlus className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  <p className="font-medium">Email verified successfully!</p>
                  <p className="mt-1">Click the button below to submit your publisher application for review.</p>
                </AlertDescription>
              </Alert>

              <div className="text-sm text-muted-foreground space-y-2">
                <p>After submission:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Our team will review your application</li>
                  <li>You&apos;ll receive an email with the decision</li>
                  <li>A sign-in link will be included if approved</li>
                </ul>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                className="w-full"
                onClick={() => handleConfirm(true)}
                disabled={confirming}
              >
                {confirming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit for Review'
                )}
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center pt-2">
            By continuing, you agree to our terms of service.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
