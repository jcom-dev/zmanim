'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useApi } from '@/lib/api-client';

interface InvitationValidation {
  valid: boolean;
  user_status?: 'existing' | 'new';
  user_name?: string;
  publisher_name?: string;
  role?: string;
  role_display_english?: string;
  status?: string;
  expires_at?: string;
}

export default function InvitationAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const api = useApi();
  const token = params.token as string;

  const [validation, setValidation] = useState<InvitationValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    if (!token) return;

    // Fetch invitation details
    api.public.get<InvitationValidation>(`/invitations/${token}`)
      .then((data: InvitationValidation) => {
        setValidation(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        console.error('Failed to validate invitation:', err);
        setValidation({ valid: false });
        setLoading(false);
      });
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccepting(true);
    setError(null);

    try {
      // For new users, require first and last name
      if (validation?.user_status === 'new') {
        if (!firstName.trim() || !lastName.trim()) {
          setError('First and last name are required');
          setAccepting(false);
          return;
        }
      }

      const result = await api.public.post<{ success: boolean; message?: string }>(`/invitations/${token}/accept`, {
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
        }),
      });

      // Redirect to publisher dashboard or sign-in
      if (result && result.success) {
        router.push('/publisher/dashboard');
      }
    } catch (err: unknown) {
      console.error('Failed to accept invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept invitation. Please try again.');
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!validation?.valid) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <CardTitle>Invalid or Expired Invitation</CardTitle>
            </div>
            <CardDescription>
              This invitation link is no longer valid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Invitations expire after 7 days. Please contact the person who invited you
              to request a new invitation.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/')} variant="outline" className="w-full">
              Go to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Check if invitation is expired or already accepted
  if (validation.status === 'expired') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-6 w-6 text-orange-500" />
              <CardTitle>Invitation Expired</CardTitle>
            </div>
            <CardDescription>
              This invitation has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This invitation expired on {validation.expires_at ? new Date(validation.expires_at).toLocaleDateString() : 'an earlier date'}.
              Please contact the publisher to request a new invitation.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/')} variant="outline" className="w-full">
              Go to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (validation.status === 'accepted') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <CardTitle>Already Accepted</CardTitle>
            </div>
            <CardDescription>
              This invitation has already been accepted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You are already a member of this publisher.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/publisher/dashboard')} className="w-full">
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join {validation.publisher_name || 'Publisher'}</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join as a {validation.role_display_english || validation.role || 'member'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAccept}>
          <CardContent className="space-y-4">
            {validation.user_status === 'existing' ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900">
                  Welcome back{validation.user_name ? `, ${validation.user_name}` : ''}!
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Click below to add {validation.publisher_name} to your account.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-green-900">
                    Create Your Account
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    Enter your information to join {validation.publisher_name}.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter your first name"
                    required
                    disabled={accepting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter your last name"
                    required
                    disabled={accepting}
                  />
                </div>
              </>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={accepting}>
              {accepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {validation.user_status === 'existing' ? 'Accepting...' : 'Creating Account...'}
                </>
              ) : (
                validation.user_status === 'existing' ? 'Accept & Join' : 'Create Account & Join'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => router.push('/')}
              disabled={accepting}
            >
              Cancel
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
